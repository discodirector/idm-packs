/**
 * String machine (Solina / ARP String Ensemble, Roland RS-09): a chord of band-limited saws (8') with an optional
 * pulse an octave up (4'), copied into three ensemble lines. Where the real machine runs the sum through three BBD
 * delays swept by a slow (~0.6 Hz) and a fast (~6 Hz) LFO, the lines here sweep their oscillators' pitch instead
 * (an automated DelayNode is not bit-exact offline; the audible result, three slightly detuned, differently
 * wobbling copies, is the same idea): one slow + fast LFO pair drives the outer lines in opposite directions and the
 * centre line stays still (the BBD lines' phase offsets, with two LFOs a chord instead of six). The lines sit left, centre and right, each through a highpass and a lowpass that swells open with the
 * attack and settles darker over the chord.
 */
import type { VoiceBus, VoiceHost } from "./host.ts";
import { adsr, biquad, gainNode, hz, osc, run } from "./util.ts";

export interface StringSpec {
  /** The 4' pulse an octave up, level 0..1. */
  octave?: number;
  /** Detune between the lines, cents 0..20. */
  detune: number;
  /** Ensemble LFOs: slow rate Hz and depth cents, fast rate Hz and depth cents. */
  slow: [number, number];
  fast: [number, number];
  /** Stereo spread of the outer lines 0..1. */
  width: number;
  cutoff: number;
  q: number;
  hp: number;
  attack: number;
  release: number;
  level: number;
}

export function strings(h: VoiceHost, t: number, midis: readonly number[], length: number, level: number, s: StringSpec, bus: VoiceBus, bright = 1) {
  const ctx = h.ctx;
  const rest: AudioNode[] = [];
  const sources: OscillatorNode[] = [];
  const end = t + length + s.release;
  const norm = 0.5 / Math.sqrt(Math.max(1, midis.length));
  // The wobble: slow + fast sines summed, in cents; the left line takes it, the right line takes it inverted.
  const slow = osc(ctx, "sine", s.slow[0], t, 0, 0);
  const fast = osc(ctx, "sine", s.fast[0], t, 0, 0);
  const sg = gainNode(ctx, s.slow[1]);
  const fg = gainNode(ctx, s.fast[1]);
  slow.connect(sg);
  fast.connect(fg);
  const wob = ctx.createGain();
  sg.connect(wob);
  fg.connect(wob);
  const inv = gainNode(ctx, -1);
  wob.connect(inv);
  sources.push(slow, fast);
  rest.push(sg, fg, wob, inv);
  for (let line = 0; line < 3; line++) {
    const mod = line === 0 ? wob : line === 2 ? inv : null;
    const cents = (line - 1) * s.detune;
    let head: AudioNode | null = null;
    midis.forEach((m, k) => {
      const o = osc(ctx, "saw", hz(m), t, cents, (line * 3 + k * 5) / 8);
      mod?.connect(o.detune);
      const g = gainNode(ctx, norm);
      o.connect(g);
      rest.push(g);
      head = h.sum(head, g, rest);
      sources.push(o);
      if ((s.octave ?? 0) > 0) {
        const o2 = osc(ctx, "pulse25", hz(m + 12), t, cents * 1.5, (line + k * 3) / 8);
        mod?.connect(o2.detune);
        const g2 = gainNode(ctx, norm * (s.octave ?? 0) * 0.7);
        o2.connect(g2);
        rest.push(g2);
        head = h.sum(head, g2, rest);
        sources.push(o2);
      }
    });
    if (!head) return;
    const hp = biquad(ctx, "highpass", s.hp, 0.6, t);
    const cut = s.cutoff * bright * (line === 1 ? 0.9 : 1.05);
    const lp = biquad(ctx, "lowpass", cut * 0.45, s.q, t);
    lp.frequency.linearRampToValueAtTime(cut, t + Math.max(0.05, s.attack * 1.2));
    lp.frequency.linearRampToValueAtTime(cut * 0.75, t + Math.max(s.attack * 1.2 + 0.05, length));
    const amp = ctx.createGain();
    adsr(amp.gain, t, s.level * level, s.attack, 0.2, 0.92, length, s.release);
    (head as AudioNode).connect(hp);
    hp.connect(lp);
    lp.connect(amp);
    rest.push(hp, lp, amp);
    rest.push(...h.out(amp, bus, (line - 1) * s.width));
  }
  run(h, sources, rest, t, end + 0.05);
}
