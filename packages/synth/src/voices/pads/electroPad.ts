import type { Source, VoiceHost, VoiceNote } from "../types.ts";
import { pairSum, transpose } from "../util.ts";

/**
 * The dark detuned-saw pad (Hamster Dark Electro II v2, engine.ts clientPad on sound/hamster-electro-2), ported value
 * for value. A chord voice: per chord tone (`n.chord`, semitones over `n.freq`) the pad's oscillators (slow detuned
 * saws in the v2 presets, no triangle drones), plus a faint sine an octave over the first tone, all through ONE dark
 * lowpass that breathes over the chord (60% -> 100% at 45% of the length -> 55%), a slow attack and a long release.
 * In the pack it sat at pan -0.12 on the harmony bus, ducked by the kick (fx/duck.ts) and widened by the ensemble
 * chorus (fx/ensemble.ts), with 0.35 of it sent to the lead bus's echo and room (the caller's routing, not here).
 * The shape is the pack's `PadSpec`; `gain` is the section's pad level (default 1).
 */
export interface ElectroPadParams {
  osc: readonly { type: OscillatorType; detune: number; level: number }[];
  cutoff: number;
  q: number;
  attack: number;
  release: number;
  level: number;
  /** Library: the section level (the engine's sec.pad x energy), default 1. */
  gain?: number;
  /** Library: the pool tick 0..1 (+1100 Hz) and heat 0..1 (+500 Hz) on the cutoff, default 0. */
  tick?: number;
  heat?: number;
}

export function playElectroPad(h: VoiceHost, n: VoiceNote, p: ElectroPadParams) {
  const ctx = h.ctx;
  const t = n.time;
  const length = n.length;
  const tones = n.chord && n.chord.length ? n.chord : [0];
  const level = p.gain ?? 1;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = p.q;
  const dark = (p.cutoff + 1100 * (p.tick ?? 0) + 500 * (p.heat ?? 0));
  lp.frequency.setValueAtTime(dark * 0.6, t);
  lp.frequency.linearRampToValueAtTime(dark, t + length * 0.45);
  lp.frequency.linearRampToValueAtTime(dark * 0.55, t + length);
  const amp = ctx.createGain();
  const attack = Math.min(p.attack, length * 0.2);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(p.level * level, t + attack);
  amp.gain.setValueAtTime(p.level * level, t + length * 0.7);
  amp.gain.linearRampToValueAtTime(0.0001, t + length + p.release);
  amp.gain.setValueAtTime(0, t + length + p.release);
  lp.connect(amp);
  const rest: AudioNode[] = [lp, amp, ...h.out(amp, n.pan)];
  const oscs: Source[] = [];
  let chain: AudioNode | null = null;
  const voices: [OscillatorType, number, number, number][] = [];
  for (const semi of tones) for (const o of p.osc) voices.push([o.type, transpose(n.freq, semi), o.detune, o.level]);
  voices.push(["sine", transpose(n.freq, tones[0] + 12), 0, 0.18]);
  for (const [type, freq, cents, gain] of voices) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.detune.setValueAtTime(cents, t);
    const g = ctx.createGain();
    g.gain.value = gain;
    osc.connect(g);
    rest.push(g);
    chain = pairSum(ctx, chain, g, rest);
    oscs.push(osc);
  }
  chain!.connect(lp);
  h.play(oscs, rest, t, t + length + (p.release + 0.05));
}
