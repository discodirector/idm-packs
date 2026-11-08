/**
 * Funk / disco rhythm guitar (Nile Rodgers "chicken scratch", the Chic / Daft Punk "Get Lucky" / Purple Disco Machine
 * comp) by Karplus-Strong, rendered once per (string pitch, mute) in plain JS and replayed:
 *   string   a delay line one period long (fractional delay by a first-order allpass), its loop through a two-tap
 *            averaging loss filter and a decay factor (open: ~1.5 s; palm-muted: ~0.12 s, darker);
 *   pluck    the excitation a burst of seeded noise, lowpassed (pick hardness) and combed at the pick position
 *            (1/5 of the string from the bridge: the bright, nasal single-coil sound);
 *   body     a highpass at 120 Hz, a presence peak at 2.4 kHz and a soft tanh (a clean amp pushed a little).
 * `guitarStrum` plays a chord as a strum: the tones staggered 9 ms (down) or reversed (up), each panned a little.
 */
import { clamp, hz, type BusIn, type VoiceHost } from "./host.ts";
import { Biquad, cached, finish, mulberry32 } from "./render.ts";

export interface GuitarOptions {
  level: number;
  /** Palm mute 0..1 (0 = ringing open strings, 1 = the dead "chk"). */
  mute: number;
  /** Pick brightness 0..1. */
  bright: number;
  /** How long a strum's notes ring before the hand chokes them, s. */
  hold: number;
  /** Stereo position of the guitar -1..1. */
  pan: number;
}

function render(sr: number, midi: number, mute: number, bright: number): Float32Array[] {
  const f0 = hz(midi);
  const dur = 0.25 + 1.4 * (1 - mute);
  const n = Math.ceil(dur * sr);
  const out = new Float32Array(n);
  const period = sr / f0;
  const N = Math.floor(period - 0.5);
  const frac = period - N - 0.5; // the averaging filter adds half a sample
  const ap = (1 - frac) / (1 + frac);
  const line = new Float32Array(N + 2);
  const rnd = mulberry32(midi * 977 + Math.round(mute * 100));
  // Excitation: lowpassed noise, combed at the pick position.
  const pick = Math.max(1, Math.round(N / 5));
  let lp = 0;
  const a = Math.exp((-2 * Math.PI * (1500 + 6000 * bright)) / sr);
  const exc = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    lp = (1 - a) * (rnd() * 2 - 1) + a * lp;
    exc[i] = lp;
  }
  for (let i = 0; i < N; i++) line[i] = exc[i] - (i >= pick ? exc[i - pick] : 0);
  const decaySec = 0.09 + 1.6 * (1 - mute) ** 2;
  const rho = Math.exp(-1 / (decaySec * f0));
  const damp = 0.5 + 0.3 * mute; // more averaging when muted: darker
  let idx = 0;
  let prev = 0;
  let apX = 0;
  let apY = 0;
  for (let i = 0; i < n; i++) {
    const x = line[idx];
    const y = rho * ((1 - damp) * x + damp * prev);
    prev = x;
    // Fractional delay: first-order allpass.
    const z = ap * y + apX - ap * apY;
    apX = y;
    apY = z;
    line[idx] = z;
    idx = idx + 1 >= N ? 0 : idx + 1;
    out[i] = x;
  }
  const hp = new Biquad(sr, "hp", 120, 0.7);
  const pres = new Biquad(sr, "peak", 2400, 1.1, 5);
  const top = new Biquad(sr, "lp", 7000 - 3000 * mute, 0.7);
  for (let i = 0; i < n; i++) out[i] = Math.tanh(1.6 * top.run(pres.run(hp.run(out[i])))) / 1.6;
  return finish([out], sr, 0.9, 10);
}

/** One plucked string at `t` held `length` s. */
export function guitarNote(h: VoiceHost, t: number, midi: number, length: number, vel: number, o: GuitarOptions, bus: BusIn, pan = o.pan) {
  const ctx = h.ctx;
  const mute = Math.round(clamp(o.mute, 0, 1) * 4) / 4;
  const bright = Math.round(clamp(o.bright, 0, 1) * 4) / 4;
  const buffer = cached(ctx, `ks:${midi}:${mute}:${bright}`, (sr) => render(sr, midi, mute, bright));
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const amp = ctx.createGain();
  const peak = 0.14 * o.level * (0.35 + 0.65 * clamp(vel, 0, 1));
  const off = t + Math.max(0.02, length);
  const end = Math.min(t + buffer.duration, off + 0.04);
  amp.gain.setValueAtTime(peak, t);
  amp.gain.setValueAtTime(peak, Math.min(off, end - 0.001));
  amp.gain.linearRampToValueAtTime(0, end);
  src.connect(amp);
  const p = h.pan(pan, bus);
  p.add(amp);
  src.start(t);
  h.end(src, [amp, p.dest], end + 0.02);
}

/** A strum of `midis` (low to high) at `t`: down (low first) or up, the strings 9 ms apart. */
export function guitarStrum(h: VoiceHost, t: number, midis: readonly number[], length: number, vel: number, up: boolean, o: GuitarOptions, bus: BusIn) {
  const order = up ? [...midis].reverse() : midis;
  order.forEach((m, i) => {
    const at = t + i * 0.009;
    guitarNote(h, at, m, Math.max(0.02, length - i * 0.009), vel * (1 - 0.06 * i), o, bus, clamp(o.pan + (i - (order.length - 1) / 2) * 0.12, -1, 1));
  });
}
