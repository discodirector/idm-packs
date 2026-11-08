/**
 * House piano (the big piano-house stab: Korg M1 "Piano 16'", the Purple Disco Machine / Robin S / Black Box chord).
 * Three layers per key, rendered once per (key, velocity layer) by plain-JS additive synthesis and replayed:
 *   body    up to 28 partials of three unison strings each, stretched by the string's inharmonicity (f_n = n f0
 *           sqrt(1 + B n^2)), the strike point combing the spectrum, every partial with its own two-stage decay (a
 *           prompt sound and a long aftersound, higher partials dying first): the timbre darkens as it rings;
 *   attack  a felt-hammer thud (lowpassed noise, ~4 ms) and a 2-operator FM "bark" (ratio 1, index falling in ~30 ms)
 *           that gives the stab its percussive front;
 *   air     the three strings split across the stereo field (left hears strings 1+2, right 2+3), so each note beats
 *           and spreads like a real close-miked piano; an optional sustained organ layer (sine 8' + 4') for the M1
 *           piano-organ blend.
 * Velocity picks one of three layers (soft / medium / hard), each brighter (hammer harder) than the last.
 */
import { clamp, hz, type BusIn, type VoiceHost } from "./host.ts";
import { cached, finish, mulberry32 } from "./render.ts";

export interface HousePianoOptions {
  /** Level 0..1.5. */
  level: number;
  /** Ring time at middle C, s (0.4..4); shorter up the keyboard. */
  decay: number;
  /** Damper release at the note's end, s. */
  release: number;
  /** Brightness 0..1 (the hammer's hardness: how far up the partial series the strike reaches). */
  bright: number;
  /** Unison string detune, cents 0..4 (beating and width). */
  detune: number;
  /** FM bark 0..1, hammer thud 0..1. */
  bark: number;
  hammer: number;
  /** M1 organ layer 0..1 (0 = a pure piano). */
  organ: number;
}

const LAYERS = [0.45, 0.72, 1];

function renderNote(sr: number, midi: number, layer: number, o: HousePianoOptions): Float32Array[] {
  const f0 = hz(midi);
  const v = LAYERS[layer];
  const keyScale = 2 ** (-(midi - 60) / 24);
  const ring = clamp(o.decay, 0.4, 4) * keyScale;
  const len = Math.min(4.5, ring * 2.2 + 0.2);
  const n = Math.ceil(len * sr);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const B = 0.00012 * 2 ** ((midi - 48) / 15);
  const strike = 1 / 7.3;
  const tilt = 1.35 - 0.55 * v * (0.5 + 0.5 * o.bright);
  const maxP = Math.min(28, Math.floor((sr * 0.42) / f0));
  const cents = [-o.detune, 0.15 * o.detune, o.detune];
  for (let p = 1; p <= maxP; p++) {
    const fp = p * f0 * Math.sqrt(1 + B * p * p);
    if (fp > sr * 0.45) break;
    const comb = Math.abs(Math.sin(Math.PI * p * strike)) * 0.85 + 0.15;
    const amp = (comb / p ** tilt) * (p > 10 ? Math.exp(-(p - 10) * (0.25 - 0.15 * v)) : 1);
    if (amp < 1e-4) continue;
    // Two-stage decay: prompt (fast) and aftersound (slow); higher partials go first.
    const t1 = (ring * 0.35) / (1 + 0.12 * (p - 1));
    const t2 = ring / (1 + 0.05 * (p - 1));
    const d1 = Math.exp(-1 / (t1 * sr));
    const d2 = Math.exp(-1 / (t2 * sr));
    for (let s = 0; s < 3; s++) {
      const f = fp * 2 ** (cents[s] / 1200);
      const w = (2 * Math.PI * f) / sr;
      const c = Math.cos(w);
      const si = Math.sin(w);
      // Rotation oscillator. The hammer strikes the unison strings together: same start phase, the beating (and
      // the width) grows as they drift apart, and the note stays mono-compatible.
      let re = Math.cos(p * 1.7);
      let im = Math.sin(p * 1.7);
      let e1 = 0.7 * amp;
      let e2 = 0.3 * amp;
      const toL = s < 2 ? 1 : 0;
      const toR = s > 0 ? 1 : 0;
      for (let i = 0; i < n; i++) {
        const y = im * (e1 + e2);
        if (toL) L[i] += y;
        if (toR) R[i] += y;
        const r2 = re * c - im * si;
        im = re * si + im * c;
        re = r2;
        e1 *= d1;
        e2 *= d2;
        if (e1 + e2 < 1e-6) break;
      }
    }
  }
  // Hammer thud: lowpassed noise, ~4 ms, centred; the FM bark: a sine carrier at f0, modulator at f0, index falling fast.
  const rnd = mulberry32(midi * 7 + layer);
  let lp = 0;
  const a = Math.exp((-2 * Math.PI * Math.min(6000, 900 + f0 * 3) * (0.6 + 0.6 * v)) / sr);
  const hn = Math.round(0.012 * sr);
  for (let i = 0; i < hn; i++) {
    lp = (1 - a) * (rnd() * 2 - 1) + a * lp;
    const e = Math.exp(-i / (0.0035 * sr)) * o.hammer * 1.6 * v;
    L[i] += lp * e;
    R[i] += lp * e;
  }
  if (o.bark > 0) {
    const bn = Math.round(0.25 * sr);
    const w = (2 * Math.PI * f0) / sr;
    for (let i = 0; i < bn; i++) {
      const idx = 2.6 * v * Math.exp(-i / (0.03 * sr));
      const y = Math.sin(w * i + idx * Math.sin(w * i)) * Math.exp(-i / (0.09 * sr)) * 0.35 * o.bark;
      L[i] += y;
      R[i] += y;
    }
  }
  if (o.organ > 0) {
    const w = (2 * Math.PI * f0) / sr;
    for (let i = 0; i < n; i++) {
      const env = Math.min(1, i / (0.004 * sr)) * (0.6 + 0.4 * Math.exp(-i / (0.4 * sr)));
      const y = (Math.sin(w * i) + 0.5 * Math.sin(2 * w * i) + 0.18 * Math.sin(3 * w * i)) * 0.18 * o.organ * env;
      L[i] += y;
      R[i] += y;
    }
  }
  const out = finish([L, R], sr, 0.9);
  // Velocity layers keep their loudness relation (finish normalises each to the same peak).
  const k = 0.55 + 0.45 * v;
  for (const d of out) for (let i = 0; i < n; i++) d[i] *= k;
  return out;
}

/**
 * Plays a chord on the house piano at `t` for `length` s (the damper falls then), at `vel` 0..1, into `bus` (stereo,
 * added as is: the width is in the strings).
 */
export function housePiano(h: VoiceHost, t: number, midis: readonly number[], length: number, vel: number, o: HousePianoOptions, bus: BusIn) {
  const v = clamp(vel, 0, 1);
  const layer = v < 0.55 ? 0 : v < 0.85 ? 1 : 2;
  const key = `hp:${o.decay}:${o.bright}:${o.detune}:${o.bark}:${o.hammer}:${o.organ}`;
  const off = t + Math.max(0.05, length);
  const peak = (0.16 * o.level * (0.55 + 0.45 * v)) / Math.sqrt(midis.length);
  for (const m of midis) {
    const buffer = cached(h.ctx, `${key}:${m}:${layer}`, (sr) => renderNote(sr, m, layer, o));
    const src = h.ctx.createBufferSource();
    src.buffer = buffer;
    const amp = h.ctx.createGain();
    const end = Math.min(t + buffer.duration, off + o.release * 1.2 + 0.02);
    amp.gain.setValueAtTime(peak, t);
    amp.gain.setValueAtTime(peak, off);
    amp.gain.setTargetAtTime(0, off, o.release / 5);
    amp.gain.setValueAtTime(0, end);
    src.connect(amp);
    bus.add(amp);
    src.start(t);
    h.end(src, [amp], end + 0.02);
  }
}
