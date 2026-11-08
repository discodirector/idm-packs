/**
 * FM operators (a DX7 / TX81Z stack, DMX Krew's one-box sound): 1..3 sine modulators in series into a sine carrier,
 * each modulator's index (peak deviation over its own frequency) falling from `index` to `index * floor` over
 * `decay`, so the tone is bright in the attack and pure in the tail: bells and glassy bleeps (ratio 3.5 / 7),
 * electric-piano tines (1 + 14), metallic keys (1.41), woody basses (1 / 0.5). Two carriers a few cents apart, left
 * and right, share the modulator stack.
 */
import type { VoiceBus, VoiceHost } from "./host.ts";
import { adsr, hz, osc, run } from "./util.ts";

export interface FmOp {
  /** Frequency ratio to the note 0.25..16. */
  ratio: number;
  /** Peak index 0..12. */
  index: number;
  /** Index fall time s. */
  decay: number;
  /** The index it falls to, a fraction of `index` 0..1 (default 0.05). */
  floor?: number;
}

export interface FmSpec {
  /** Modulators, the one nearest the carrier first. */
  ops: readonly FmOp[];
  /** Detune of the two carriers, cents 0..20 (0: one carrier in the centre). */
  detune: number;
  width: number;
  attack: number;
  dec: number;
  sustain: number;
  release: number;
  level: number;
}

export function fmTone(h: VoiceHost, t: number, midi: number, hold: number, level: number, s: FmSpec, bus: VoiceBus, pan = 0, bright = 1) {
  const ctx = h.ctx;
  const f = hz(midi);
  const rest: AudioNode[] = [];
  const sources: OscillatorNode[] = [];
  // Build the stack from the outside in: each modulator's output drives the next one's frequency.
  let drive: GainNode | null = null;
  for (let i = s.ops.length - 1; i >= 0; i--) {
    const op = s.ops[i];
    const fm = f * op.ratio;
    const m = osc(ctx, "sine", fm, t);
    if (drive) drive.connect(m.frequency);
    const g = ctx.createGain();
    const depth = Math.max(0.01, op.index * bright * fm);
    g.gain.setValueAtTime(depth, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.01, depth * (op.floor ?? 0.05)), t + Math.max(0.005, op.decay));
    m.connect(g);
    sources.push(m);
    rest.push(g);
    drive = g;
  }
  const end = adsrEnd(t, s, hold);
  const sides = s.detune > 0 ? 2 : 1;
  for (let side = 0; side < sides; side++) {
    const c = osc(ctx, "sine", f, t, sides === 1 ? 0 : (side === 0 ? -1 : 1) * s.detune);
    if (drive) drive.connect(c.frequency);
    const amp = ctx.createGain();
    adsr(amp.gain, t, s.level * level * (sides === 2 ? 0.75 : 1), s.attack, s.dec, s.sustain, hold, s.release);
    c.connect(amp);
    sources.push(c);
    rest.push(amp);
    rest.push(...h.out(amp, bus, sides === 1 ? pan : Math.max(-1, Math.min(1, pan + (side === 0 ? -1 : 1) * s.width))));
  }
  run(h, sources, rest, t, end + 0.05);
}

function adsrEnd(t: number, s: FmSpec, hold: number) {
  return t + Math.max(s.attack + s.dec, hold) + s.release;
}
