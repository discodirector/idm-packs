import type { Source, VoiceHost, VoiceNote } from "../types.ts";
import { midiOf, pairSum, pulseEnv } from "../util.ts";

/**
 * The felt piano (Cinematic v2, engine.ts scorePiano on sound/cinematic), ported value for value. Per note a hammered
 * string of `partials` sine partials on a stretched series, the lowest two as a slightly detuned pair (the unison's
 * warmth), each falling in two stages (a quick "prompt" drop, then the long aftersound; higher partials faster), the
 * felt's thump (a lowpassed noise tick), a velocity lowpass and the damper `release` after the note's length. Low notes
 * sit a little left, high a little right. The shape is the pack's `ScorePianoVoice`; `gain` is the library's note level.
 */
export interface FeltPianoParams {
  kind?: "piano";
  partials: number;
  stretch: number;
  detune: number;
  prompt: number;
  decay: number;
  damp: number;
  bright: number;
  hammer: number;
  cutoff: number;
  release: number;
  hp?: number;
  level: number;
  /** Library: the note's level (the score's arc level), default 1. */
  gain?: number;
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export function playFeltPiano(h: VoiceHost, n: VoiceNote, v: FeltPianoParams) {
  const ctx = h.ctx;
  const f = n.freq;
  const midi = Math.round(midiOf(f));
  const t = n.time;
  const vel = n.vel;
  const dec = v.decay * Math.pow(261.63 / f, 0.7);
  const off = t + Math.max(0.05, n.length);
  const natural = t + dec * 1.1;
  const end = Math.min(off + v.release * 1.3, natural) + 0.05;
  const nodes: AudioNode[] = [];
  const sources: Source[] = [];
  let chain: AudioNode | null = null;
  const tilt = 1.45 - 0.75 * v.bright * (0.4 + 0.6 * vel);
  for (let k = 1; k <= v.partials; k++) {
    const fk = k * f * Math.sqrt(1 + v.stretch * k * k);
    if (fk > 9000) break;
    const amp = Math.pow(k, -tilt);
    const tau = dec / 6.9 / (1 + v.damp * (k - 1));
    const prompt = Math.min(0.4, tau / 6);
    const pair = k <= 2 && v.detune > 0 ? 2 : 1;
    for (let u = 0; u < pair; u++) {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(fk, t);
      if (u === 1) osc.detune.setValueAtTime(v.detune, t);
      const g = ctx.createGain();
      const a = amp * (pair === 2 ? (u === 0 ? 0.6 : 0.4) : 1);
      const knee = Math.min(off, t + 0.003 + 3 * prompt);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a, t + 0.003);
      g.gain.setTargetAtTime(a * v.prompt, t + 0.003, prompt);
      if (knee < off) g.gain.setTargetAtTime(0, knee, tau);
      g.gain.setTargetAtTime(0, off, v.release / 5);
      osc.connect(g);
      nodes.push(g);
      sources.push(osc);
      chain = pairSum(ctx, chain, g, nodes);
    }
  }
  if (v.hammer > 0) {
    const src = ctx.createBufferSource();
    src.buffer = h.noise();
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "lowpass";
    bp.frequency.value = Math.min(6000, 2.5 * f + 600 + 1800 * vel);
    const g = ctx.createGain();
    pulseEnv(g.gain, t, 0.001, 0.25 * v.hammer * vel, 0.03);
    src.connect(bp);
    bp.connect(g);
    nodes.push(bp, g);
    sources.push(src);
    chain = pairSum(ctx, chain, g, nodes);
  }
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = clamp(v.cutoff * (0.35 + 0.65 * vel), 300, 16000);
  lp.Q.value = 0.5;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = v.hp ?? 40;
  hp.Q.value = 0.5;
  const amp = ctx.createGain();
  amp.gain.value = 0.11 * v.level * (0.25 + 0.75 * vel);
  const dyn = ctx.createGain();
  dyn.gain.setValueAtTime(v.gain ?? 1, t);
  (chain as AudioNode).connect(lp);
  lp.connect(hp);
  hp.connect(amp);
  amp.connect(dyn);
  nodes.push(lp, hp, amp, dyn);
  // A piano's width: low strings a little left, high a little right.
  nodes.push(...h.out(dyn, clamp(n.pan + (midi - 60) / 60, -0.6, 0.6)));
  h.play(sources, nodes, t, end);
}
