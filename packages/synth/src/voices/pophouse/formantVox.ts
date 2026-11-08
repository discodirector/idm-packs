/**
 * Formant vocal chop (the Disclosure / Duke Dumont / MK chopped-vocal hook, a "yeah", an "ooh"), rendered once per
 * (pitch, vowels, length) by plain-JS parallel formant synthesis (Klatt's parallel branch) and replayed:
 *   source   a band-limited glottal pulse train (harmonics falling 1/k^1.1, cosine phase: a sharp glottal closure),
 *            a pitch scoop into the note, vibrato fading in after 150 ms, a little jitter; aspiration noise;
 *   tract    four resonators (F1..F4 with bandwidths 80..180 Hz, female formant values) in parallel, their
 *            frequencies gliding from the first vowel to the second over the note; F1/F2 come from the style's
 *            `vowels` table, F3/F4 follow them (F3 >= F2 + 900);
 *   onset    a consonant: a 6 ms band of noise around 3.5 kHz (a "d"/"y" attack) at `consonant`.
 * The chop's gate (where the note is cut) is the caller's amp envelope.
 */
import { clamp, hz, type BusIn, type VoiceHost } from "./host.ts";
import { Biquad, cached, finish, mulberry32 } from "./render.ts";

export interface VoxOptions {
  level: number;
  /** Pitch scoop into the note, semitones (negative from below), over `scoopSec`. */
  scoop: number;
  scoopSec: number;
  /** Vibrato depth, cents. */
  vibrato: number;
  /** Aspiration 0..1, consonant onset 0..1. */
  breath: number;
  consonant: number;
  /** Release after the gate, s. */
  release: number;
  /** Optional: presence, a peak at 3 kHz, dB 0..6 (0 = none). */
  presence?: number;
  /**
   * Optional (Rally House phase 4): a brighter voice 0..1: the glottal source falls slower (1/k^(1.1 - 0.4 x)) and the
   * upper formants F3 / F4 sing louder (x 1 + 2 x / 1 + 3 x). 0 or absent: the voice as it was.
   */
  bright?: number;
  /**
   * Optional (Rally House phase 4): a wider voice 0..1: a second take of the note, 12 cents up with its own jitter,
   * panned to the other side; the pair spread to +-wide. 0 or absent: one take at `pan`.
   */
  wide?: number;
}

type Vowel = readonly [number, number];

function formants(v: Vowel): number[] {
  const [f1, f2] = v;
  return [f1, f2, Math.max(2500, f2 + 900), Math.max(3600, f2 + 1900)];
}

function render(sr: number, midi: number, from: Vowel, to: Vowel, len: number, o: VoxOptions): Float32Array[] {
  const n = Math.ceil((len + 0.05) * sr);
  const out = new Float32Array(n);
  const f0 = hz(midi);
  const rnd = mulberry32(midi * 131 + Math.round(from[0] + to[1]) + (Number.isInteger(midi) ? 0 : 7919));
  const K = Math.min(60, Math.floor((sr * 0.45) / f0));
  const br = Math.max(0, Math.min(1, o.bright ?? 0));
  const amps = Array.from({ length: K + 1 }, (_, k) => (k ? 1 / k ** (1.1 - 0.4 * br) : 0));
  const F = formants(from);
  const G = formants(to);
  const bw = [80, 100, 140, 180];
  const gains = [1, 0.75, 0.32 * (1 + 2 * br), 0.18 * (1 + 3 * br)];
  const res = F.map((f, i) => new Biquad(sr, "bp", f, f / bw[i]));
  const consonant = new Biquad(sr, "bp", 3500, 2);
  let phase = 0;
  let jit = 0;
  const block = 64;
  for (let i0 = 0; i0 < n; i0 += block) {
    const x = Math.min(1, i0 / Math.max(1, len * 0.85 * sr));
    const glide = x * x * (3 - 2 * x);
    for (let k = 0; k < 4; k++) {
      const f = F[k] + (G[k] - F[k]) * glide;
      res[k].set("bp", f, f / bw[k]);
    }
    jit = 0.9 * jit + 0.1 * (rnd() * 2 - 1);
    for (let i = i0; i < Math.min(n, i0 + block); i++) {
      const t = i / sr;
      const scoop = o.scoop * Math.exp(-t / Math.max(0.005, o.scoopSec));
      const vib = t > 0.15 ? o.vibrato * Math.min(1, (t - 0.15) / 0.25) * Math.sin(2 * Math.PI * 5.3 * t) : 0;
      const f = f0 * 2 ** ((scoop + (vib + 6 * jit) / 100) / 12);
      phase += (2 * Math.PI * f) / sr;
      if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
      let src = 0;
      // Harmonics above Nyquist at this instant's pitch are skipped.
      const kmax = Math.min(K, Math.floor((sr * 0.45) / f));
      for (let k = 1; k <= kmax; k++) src += amps[k] * Math.cos(k * phase);
      const noise = rnd() * 2 - 1;
      const exc = src * 0.6 + noise * o.breath * 0.35;
      let y = 0;
      for (let k = 0; k < 4; k++) y += gains[k] * res[k].run(k >= 2 ? exc + noise * o.breath * 0.4 : exc);
      if (i < 0.006 * sr && o.consonant > 0) y += consonant.run(noise) * o.consonant * 4 * (1 - i / (0.006 * sr));
      out[i] = y;
    }
  }
  if ((o.presence ?? 0) > 0) {
    const pk = new Biquad(sr, "peak", 3000, 0.9, o.presence);
    for (let i = 0; i < n; i++) out[i] = pk.run(out[i]);
  }
  return finish([out], sr, 0.9, 20);
}

/**
 * Sings `midi` at `t` for `length` s (the gate), the vowel gliding `from` -> `to`, into `bus` at `pan`.
 * `cut` (s, 0 = none): a short stutter cut instead of the full note.
 */
export function formantVox(h: VoiceHost, t: number, midi: number, length: number, from: Vowel, to: Vowel, o: VoxOptions, bus: BusIn, pan: number) {
  const lenQ = Math.max(0.06, Math.round(length * 50) / 50);
  const wide = Math.max(0, Math.min(1, o.wide ?? 0));
  if (wide > 0) {
    // Two takes, 12 cents apart, one each side (each at -3 dB, so the pair sums to the single take's level).
    const half = { ...o, wide: 0, level: o.level * Math.SQRT1_2 };
    playTake(h, t, midi, length, from, to, half, bus, clamp(pan - wide, -1, 1), lenQ);
    playTake(h, t, midi + 0.12, length, from, to, half, bus, clamp(pan + wide, -1, 1), lenQ);
    return;
  }
  playTake(h, t, midi, length, from, to, o, bus, pan, lenQ);
}

function playTake(h: VoiceHost, t: number, midi: number, length: number, from: Vowel, to: Vowel, o: VoxOptions, bus: BusIn, pan: number, lenQ: number) {
  const ctx = h.ctx;
  const extra = (o.bright ?? 0) > 0 ? `:b${o.bright}` : "";
  const key = `vx:${midi}:${from.join(",")}:${to.join(",")}:${lenQ}:${o.scoop}:${o.scoopSec}:${o.vibrato}:${o.breath}:${o.consonant}:${o.presence ?? 0}${extra}`;
  const buffer = cached(ctx, key, (sr) => render(sr, midi, from, to, lenQ, o));
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const amp = ctx.createGain();
  const peak = 0.2 * o.level;
  const off = t + Math.max(0.03, length);
  const end = Math.min(t + buffer.duration, off + o.release);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(peak, t + 0.006);
  amp.gain.setValueAtTime(peak, Math.max(t + 0.007, off - 0.004));
  amp.gain.linearRampToValueAtTime(0, Math.max(t + 0.01, end));
  src.connect(amp);
  const p = h.pan(clamp(pan, -1, 1), bus);
  p.add(amp);
  src.start(t);
  h.end(src, [amp, p.dest], end + 0.02);
}
