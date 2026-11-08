/**
 * Sci-fi bleeps (the MS-10 "UFO" effects of Cybotron, Dopplereffekt's telemetry): a short tone on a scale note,
 * ring-modulated by a sine at an inharmonic ratio (the metallic, radio-transmission colour) and lowpassed, held
 * steady in pitch (no falling "pew" laser), with an optional resonant "sonar" ping (a sine with a long, soft
 * tail). Quiet by design: answers in the gaps, into the echo.
 */
import type { VoiceBus, VoiceHost } from "./host.ts";
import { biquad, hit, hz, osc, run, type WaveName } from "./util.ts";

export interface BleepSpec {
  wave: WaveName;
  /** Ring modulator ratio to the note (0: none; 1.41, 2.76: metallic). */
  ring: number;
  /** Lowpass Hz. */
  lp: number;
  /** Decay s. */
  decay: number;
  /** A sonar ping under it: its level 0..1 (0: none). */
  sonar?: number;
  level: number;
}

export function bleep(h: VoiceHost, t: number, midi: number, level: number, s: BleepSpec, bus: VoiceBus, pan = 0) {
  const ctx = h.ctx;
  const f = hz(midi);
  const rest: AudioNode[] = [];
  const srcs: OscillatorNode[] = [];
  const o = osc(ctx, s.wave, f, t, 0, 0.25);
  srcs.push(o);
  let node: AudioNode = o;
  if (s.ring > 0) {
    const rm = osc(ctx, "sine", f * s.ring, t);
    const ring = ctx.createGain();
    ring.gain.value = 0;
    rm.connect(ring.gain);
    o.connect(ring);
    srcs.push(rm);
    rest.push(ring);
    node = ring;
  }
  const lp = biquad(ctx, "lowpass", s.lp, 1.2, t);
  const g = ctx.createGain();
  const end = hit(g.gain, t, s.level * level, 0.002, s.decay);
  node.connect(lp);
  lp.connect(g);
  rest.push(lp, g, ...h.out(g, bus, pan));
  if ((s.sonar ?? 0) > 0) {
    const p = osc(ctx, "sine", f / 2, t);
    const pg = ctx.createGain();
    const pend = hit(pg.gain, t, s.level * level * (s.sonar ?? 0), 0.004, s.decay * 6);
    const bp = biquad(ctx, "bandpass", f / 2, 4, t);
    p.connect(bp);
    bp.connect(pg);
    rest.push(bp, pg, ...h.out(pg, bus, -pan));
    srcs.push(p);
    run(h, srcs, rest, t, Math.max(end, pend) + 0.03);
    return;
  }
  run(h, srcs, rest, t, end + 0.03);
}
