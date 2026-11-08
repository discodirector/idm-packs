/**
 * Layered bass, three layers with three jobs, all mono:
 *   sub   a clean sine (or triangle) an octave under the line: the weight, 30-65 Hz, untouched by filter or drive;
 *   mid   the line itself: band-limited saws / squares / pulses on staggered phases into a 24 dB resonant lowpass
 *         with an acid-style envelope (accents open it further and ring harder), driven through tanh and
 *         highpassed so it does not double the sub: the note you hear on small speakers, 80 Hz-1.5 kHz;
 *   grit  a parallel, harder-driven copy of the mid through a bandpass (1-2.5 kHz): the snarl and the edge.
 * `open` (0..1, the caller's slow knob over the bars) and `bright` move the cutoff, so the line's timbre travels.
 */
import type { VoiceHost } from "./host.ts";
import { biquad, gainNode, hz, osc, run, shaper, type WaveName } from "./util.ts";

export interface LayerBassSpec {
  /** Sub level 0..2 and its wave. */
  sub: number;
  subWave?: "sine" | "triangle";
  /** The mid layer's oscillators: wave, detune cents, level. */
  osc: readonly { wave: WaveName; detune: number; level: number }[];
  /** Lowpass floor Hz, peak = floor * open[accent], fall time s [plain, accent], resonance [plain, accent]. */
  cutoff: number;
  open: readonly [number, number];
  decay: readonly [number, number];
  q: readonly [number, number];
  /** How far the slow knob moves the floor, Hz. */
  sweep: number;
  /** tanh drive of the mid 0.5..6. */
  drive: number;
  /** Mid highpass Hz (keeps it off the sub). */
  hp: number;
  /** Grit level 0..1 and band centre Hz. */
  grit: number;
  gritHz: number;
  /** Mid level and the whole voice's level. */
  mid: number;
  level: number;
  glide: number;
}

export interface BassPlay {
  from: number | null;
  accent: boolean;
  /** Slow knob 0..1. */
  open: number;
  /** Cutoff multiplier (market colour, heat). */
  bright: number;
  /** Extra drive (heat). */
  heat: number;
}

export function layerBass(h: VoiceHost, t: number, midi: number, length: number, s: LayerBassSpec, p: BassPlay) {
  const ctx = h.ctx;
  const f = hz(midi);
  const f0 = p.from !== null ? hz(p.from) : f;
  const glide = p.from !== null ? s.glide : 0;
  const a = p.accent ? 1 : 0;
  const rest: AudioNode[] = [];
  const sources: OscillatorNode[] = [];
  const glideTo = (o: OscillatorNode, target: number, start: number) => {
    if (glide > 0) {
      o.frequency.setValueAtTime(start, t);
      o.frequency.exponentialRampToValueAtTime(target, t + glide);
    }
  };
  // Mid.
  let mid: AudioNode | null = null;
  s.osc.forEach((o, i) => {
    const node = osc(ctx, o.wave, f, t, o.detune, (i * 3 + 1) / 8);
    glideTo(node, f, f0);
    const g = gainNode(ctx, o.level);
    node.connect(g);
    rest.push(g);
    mid = h.sum(mid, g, rest);
    sources.push(node);
  });
  const floor = Math.max(70, (s.cutoff + s.sweep * p.open) * p.bright);
  const peak = Math.min(9000, floor * s.open[a] * (1 + 0.5 * p.heat));
  const lp1 = biquad(ctx, "lowpass", peak, 0.7, t);
  const lp2 = biquad(ctx, "lowpass", peak, s.q[a], t);
  for (const lp of [lp1, lp2]) lp.frequency.exponentialRampToValueAtTime(floor, t + s.decay[a]);
  (mid as unknown as AudioNode).connect(lp1);
  lp1.connect(lp2);
  const sat = shaper(ctx, s.drive + 1.5 * p.heat, true);
  lp2.connect(sat);
  const hp = biquad(ctx, "highpass", s.hp, 0.7, t);
  sat.connect(hp);
  const midG = gainNode(ctx, s.mid);
  hp.connect(midG);
  rest.push(lp1, lp2, sat, hp, midG);
  let body: AudioNode = midG;
  if (s.grit > 0) {
    const hard = shaper(ctx, 4 + 2 * p.heat, true);
    const bp = biquad(ctx, "bandpass", s.gritHz * (0.8 + 0.4 * p.open), 1.1, t);
    const gg = gainNode(ctx, s.grit * s.mid * 0.5);
    lp2.connect(hard);
    hard.connect(bp);
    bp.connect(gg);
    rest.push(hard, bp, gg);
    body = h.sum(body, gg, rest);
  }
  // Sub.
  if (s.sub > 0) {
    const sub = osc(ctx, s.subWave ?? "sine", f / 2, t);
    glideTo(sub, f / 2, f0 / 2);
    const sg = gainNode(ctx, s.sub);
    sub.connect(sg);
    rest.push(sg);
    sources.push(sub);
    body = h.sum(body, sg, rest);
  }
  const hold = Math.max(0.04, length);
  const amp = ctx.createGain();
  const top = s.level * (p.accent ? 1 : 0.85);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(top, t + 0.003);
  amp.gain.setValueAtTime(top * 0.85, t + hold * 0.7);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + hold + 0.025);
  amp.gain.setValueAtTime(0, t + hold + 0.025);
  body.connect(amp);
  rest.push(amp);
  rest.push(...h.out(amp, "bass"));
  run(h, sources, rest, t, t + hold + 0.08);
}
