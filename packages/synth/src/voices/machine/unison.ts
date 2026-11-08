/**
 * Unison stack: the layered analog lead / stab of electro and trance (a JP-8000 supersaw, a Jupiter's unison, a
 * Juno saw + sub). 1..9 band-limited saws (or squares / pulses), each started at its own phase and detuned on a
 * slightly uneven spread (no two pairs beat at the same rate), split into a left and a right half, each half through
 * its own drive and a 24 dB resonant lowpass with an envelope; a square an octave under for the body and a narrow
 * pulse an octave up for the bite go to both halves. Optional pitch scoop and delayed vibrato. Polyphony is the
 * caller's: one call per note.
 */
import type { VoiceBus, VoiceHost } from "./host.ts";
import { adsr, biquad, gainNode, hz, osc, run, shaper, type WaveName } from "./util.ts";

export interface UnisonSpec {
  /** Stack voices 1..9. */
  voices: number;
  /** The outer voices' detune, cents 0..60. */
  detune: number;
  /** Stereo spread of the two halves 0..1 (0: both in the centre). */
  width: number;
  /** The stack's wave (default "saw"). */
  wave?: WaveName;
  /** A square an octave under, level 0..1 (the body). */
  sub?: number;
  /** A 25% pulse an octave up, level 0..1 (the bite). */
  top?: number;
  /** Lowpass floor Hz, envelope amount Hz on top of it, its decay s, resonance. */
  cutoff: number;
  env: number;
  decay: number;
  q: number;
  /** Cutoff follows the note: 0 fixed .. 1 fully (re C4). */
  keytrack?: number;
  /** Amp ADSR (s, s, 0..1, s). */
  attack: number;
  dec: number;
  sustain: number;
  release: number;
  /** tanh drive before the filter (0: clean). */
  drive?: number;
  /** Pitch scoop from below, semitones 0..3, over 40 ms. */
  scoop?: number;
  /** Vibrato: rate Hz, depth cents, delay s. */
  vib?: { rate: number; depth: number; delay: number };
  level: number;
}

export interface UnisonPlay {
  /** Centre pan -1..1. */
  pan?: number;
  /** Cutoff multiplier (market colour, song-form brightness), default 1. */
  bright?: number;
  /** Glide from this MIDI note (portamento lead), over `glide` s. */
  from?: number;
  glide?: number;
}

/** The detune of voice i of n, cents: an uneven symmetric spread, outermost at +-`detune`. */
function spread(i: number, n: number, detune: number): number {
  if (n === 1) return 0;
  const x = (i / (n - 1)) * 2 - 1;
  const uneven = [0, 0.13, -0.07, 0.11, -0.12, 0.05, -0.09, 0.08, -0.04][i % 9];
  return detune * (Math.sign(x) * Math.pow(Math.abs(x), 1.25) + uneven * 0.15);
}

export function unison(h: VoiceHost, t: number, midi: number, hold: number, level: number, s: UnisonSpec, bus: VoiceBus, p: UnisonPlay = {}) {
  const ctx = h.ctx;
  const f = hz(midi);
  const n = Math.max(1, Math.min(9, Math.round(s.voices)));
  const rest: AudioNode[] = [];
  const sources: OscillatorNode[] = [];
  const start = p.from !== undefined ? hz(p.from) : null;
  const pitch = (o: OscillatorNode, target: number) => {
    if (start !== null) {
      o.frequency.setValueAtTime(start * (target / f), t);
      o.frequency.exponentialRampToValueAtTime(target, t + Math.max(0.005, p.glide ?? 0.06));
    } else if (s.scoop) {
      o.frequency.setValueAtTime(target * Math.pow(2, -s.scoop / 12), t);
      o.frequency.exponentialRampToValueAtTime(target, t + 0.04);
    }
  };
  let vib: GainNode | null = null;
  if (s.vib && s.vib.depth > 0) {
    const lfo = osc(ctx, "sine", s.vib.rate, t);
    vib = ctx.createGain();
    const d0 = Math.min(hold, s.vib.delay);
    vib.gain.setValueAtTime(0, t);
    vib.gain.setValueAtTime(0, t + d0);
    vib.gain.linearRampToValueAtTime(s.vib.depth, t + d0 + 0.3);
    lfo.connect(vib);
    sources.push(lfo);
    rest.push(vib);
  }
  const halves: (AudioNode | null)[] = [null, null];
  for (let i = 0; i < n; i++) {
    const o = osc(ctx, s.wave ?? "saw", f, t, spread(i, n, s.detune), (i * 3) / 8 + (i % 2) * 0.0625);
    pitch(o, f);
    vib?.connect(o.detune);
    const g = gainNode(ctx, (Math.abs(i - (n - 1) / 2) < 0.6 ? 1 : 0.78) / Math.sqrt(n));
    o.connect(g);
    rest.push(g);
    const side = n === 1 ? 0 : i % 2;
    halves[side] = h.sum(halves[side], g, rest);
    sources.push(o);
  }
  const extra = (name: WaveName, ratio: number, lvl: number) => {
    if (!(lvl > 0)) return;
    const o = osc(ctx, name, f * ratio, t, 0, 0.25);
    pitch(o, f * ratio);
    vib?.connect(o.detune);
    sources.push(o);
    for (let side = 0; side < (n === 1 ? 1 : 2); side++) {
      const g = gainNode(ctx, lvl * 0.5);
      o.connect(g);
      rest.push(g);
      halves[side] = h.sum(halves[side], g, rest);
    }
  };
  extra("square", 0.5, s.sub ?? 0);
  extra("pulse25", 2, s.top ?? 0);
  const bright = p.bright ?? 1;
  const track = Math.pow(f / 261.6, s.keytrack ?? 0.5);
  const floor = Math.max(60, s.cutoff * track * bright);
  const peak = Math.min(16000, floor + s.env * bright);
  const end = t + Math.max(s.attack + s.dec, hold) + s.release;
  const pan = p.pan ?? 0;
  halves.forEach((head, side) => {
    if (!head) return;
    let node: AudioNode = head;
    if (s.drive) {
      const sh = shaper(ctx, s.drive, true);
      node.connect(sh);
      rest.push(sh);
      node = sh;
    }
    for (let k = 0; k < 2; k++) {
      const lp = biquad(ctx, "lowpass", peak, k === 0 ? 0.6 : s.q, t);
      lp.frequency.setValueAtTime(peak, t + Math.min(0.004, s.attack));
      lp.frequency.exponentialRampToValueAtTime(floor, t + Math.min(0.004, s.attack) + Math.max(0.01, s.decay));
      node.connect(lp);
      rest.push(lp);
      node = lp;
    }
    const amp = ctx.createGain();
    adsr(amp.gain, t, s.level * level * (n === 1 ? 1 : 0.75), s.attack, s.dec, s.sustain, hold, s.release);
    node.connect(amp);
    rest.push(amp);
    const at = n === 1 ? pan : Math.max(-1, Math.min(1, pan + (side === 0 ? -1 : 1) * s.width));
    rest.push(...h.out(amp, bus, at));
  });
  run(h, sources, rest, t, end + 0.05);
}
