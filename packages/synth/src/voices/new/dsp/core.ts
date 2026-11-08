/**
 * The new voices' DSP helpers (docs/sound/VOICE-LIBRARY-NEW.md). Every new voice renders one note sample by sample
 * into Float32Arrays (pure functions: no Web Audio, no Math.random, no clock), so the same note is the same samples in
 * Node, in Chromium, offline or live. voices.ts then plays the rendered note through the library's VoiceHost as an
 * AudioBuffer. Physical models and nonlinear filters live here because the stock Web Audio blocks cannot do them.
 */

export const TAU = 2 * Math.PI;

/** One note as a renderer sees it. */
export interface NoteEvent {
  /** Pitch, Hz. */
  freq: number;
  /** 0..1 (up to 1.2 for accents). */
  vel: number;
  /** Gate length, s: the release (damper, bow lift, breath out) starts here. */
  hold: number;
  /** All randomness of the note. */
  seed: number;
  /** -1..1 */
  pan: number;
  /** 0..1, the song form's openness (opens filters a little). */
  bright: number;
  /** Glide from this pitch, Hz. */
  from?: number;
  /** Chord tones as semitones over `freq` (strums, chord voices). */
  chord?: readonly number[];
}

/** A rendered note: stereo, or mono when `R` is null (bass and drums: the host centres or pans it). */
export interface Rendered {
  L: Float32Array;
  R: Float32Array | null;
}

export type Params = Record<string, number>;
export type Renderer = (ev: NoteEvent, p: Params, sr: number) => Rendered;

/** The longest note any voice renders, s. */
export const MAX_SEC = 14;

/** mulberry32: a small seeded PRNG, 0..1. */
export function rng(seed: number): () => number {
  let a = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const cents = (c: number) => Math.pow(2, c / 1200);

/** A rational tanh: smooth saturation, exact everywhere (|x| > 3 clips to +-1). */
export function sat(x: number): number {
  if (x > 3) return 1;
  if (x < -3) return -1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}

/** polyBLEP residual for a step at phase 0 (phase t in 0..1, increment dt). */
export function blep(t: number, dt: number): number {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

/** Slow value noise in -1..1: a new seeded target every 1/rate s, smoothstep between targets. One call per sample. */
export function wanderer(rand: () => number, rate: number, sr: number) {
  let a = rand() * 2 - 1;
  let b = rand() * 2 - 1;
  let ph = rand();
  const inc = Math.max(1e-6, rate) / sr;
  return () => {
    ph += inc;
    if (ph >= 1) {
      ph -= 1;
      a = b;
      b = rand() * 2 - 1;
    }
    const s = ph * ph * (3 - 2 * ph);
    return a + (b - a) * s;
  };
}

/** Equal-power pan gains [L, R]. */
export function panGains(p: number): [number, number] {
  const a = ((clamp(p, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}

/** Per-note variance: 1 +- amt/2 (seeded). */
export const vary = (rand: () => number, amt: number) => 1 + (rand() - 0.5) * amt;

/**
 * ADSR, one call per sample: a curved attack (fast start, soft landing), exponential decay to the sustain, held to
 * the gate, an exponential release to 1% in `r` s, then exactly 0 over 64 samples. `done` once at 0.
 */
export function adsr(sr: number, a: number, d: number, s: number, r: number, hold: number) {
  const aN = Math.max(1, Math.round(a * sr));
  const gate = Math.max(1, Math.round(hold * sr));
  const dCo = Math.exp(-4.6 / Math.max(1, d * sr));
  const rCo = Math.exp(-4.6 / Math.max(1, r * sr));
  const sus = clamp(s, 0, 1);
  let n = 0;
  let lvl = 0;
  let ph = 0;
  let stage = 0;
  let fade = 0;
  let step = 0;
  const env = {
    done: false,
    released: false,
    next(): number {
      if (stage < 2 && n >= gate) {
        stage = 2;
        env.released = true;
      }
      if (stage === 0) {
        ph += 1 / aN;
        if (ph >= 1) {
          ph = 1;
          stage = 1;
        }
        lvl = 1 - (1 - ph) * (1 - ph);
      } else if (stage === 1) lvl = sus + (lvl - sus) * dCo;
      else if (stage === 2) {
        lvl *= rCo;
        if (lvl < 0.004) {
          stage = 3;
          fade = 64;
          step = lvl / 64;
        }
      } else if (stage === 3) {
        lvl -= step;
        if (--fade <= 0) {
          lvl = 0;
          stage = 4;
          env.done = true;
        }
      }
      n++;
      return lvl;
    },
  };
  return env;
}

/** A one-pole lowpass coefficient for cutoff fc (impulse-invariant). */
export const onePoleA = (fc: number, sr: number) => 1 - Math.exp((-TAU * clamp(fc, 1, sr * 0.49)) / sr);

/** The TPT one-pole / ladder coefficient G = g / (1 + g), g = tan(pi fc / sr). */
export function gOf(fc: number, sr: number): number {
  const g = Math.tan((Math.PI * clamp(fc, 10, sr * 0.49)) / sr);
  return g / (1 + g);
}

/**
 * A zero-delay state-variable filter (Simper / TPT). `set(fc, q)` then `run(x)`; after a run `lp`, `bp` (unity peak
 * gain: k * v1) and `hp` hold the three outputs.
 */
export function svf(sr: number, fc = 1000, q = 0.707) {
  let ic1 = 0;
  let ic2 = 0;
  let a1 = 0;
  let a2 = 0;
  let a3 = 0;
  let k = 1;
  const f = {
    lp: 0,
    bp: 0,
    hp: 0,
    set(fc: number, q: number) {
      const g = Math.tan((Math.PI * clamp(fc, 10, sr * 0.49)) / sr);
      k = 1 / Math.max(0.05, q);
      a1 = 1 / (1 + g * (g + k));
      a2 = g * a1;
      a3 = g * a2;
    },
    run(x: number): number {
      const v3 = x - ic2;
      const v1 = a1 * ic1 + a2 * v3;
      const v2 = ic2 + a2 * ic1 + a3 * v3;
      ic1 = 2 * v1 - ic1;
      ic2 = 2 * v2 - ic2;
      f.lp = v2;
      f.bp = k * v1;
      f.hp = x - k * v1 - v2;
      return v2;
    },
  };
  f.set(fc, q);
  return f;
}

/**
 * A modal resonator: an exactly tuned decaying rotation (frequency fr Hz, T60 s). `drive(x)` adds x to the state and
 * returns the displacement (the imaginary part). `retune(ratio)` moves its frequency (tension, drift); `setT60`
 * changes its decay (a damper).
 */
export function mode(sr: number, fr: number, t60: number) {
  let re = 0;
  let im = 0;
  let w = (TAU * fr) / sr;
  let c = Math.cos(w);
  let s = Math.sin(w);
  let r = Math.exp(-6.9 / (Math.max(0.002, t60) * sr));
  return {
    get r() {
      return r;
    },
    retune(ratio: number) {
      const ww = w * ratio;
      c = Math.cos(ww);
      s = Math.sin(ww);
    },
    setT60(t: number) {
      r = Math.exp(-6.9 / (Math.max(0.002, t) * sr));
    },
    drive(x: number): number {
      const nr = r * (c * re - s * im) + x;
      im = r * (s * re + c * im);
      re = nr;
      return im;
    },
  };
}

/**
 * The ladder filters (from Synth v2), run at twice the sample rate (the midpoint, then the sample, averaged). `k`
 * 0..4 resonance with the saturation inside the feedback loop: "ladder" a Moog-style TPT 4-pole, "diode" the same loop
 * with the feedback's lows removed, an asymmetric drive and a softer slope (303-ish). G from gOf(fc, 2 * sr).
 */
export function ladder(diode: boolean) {
  let s1 = 0;
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  let y4 = 0;
  let hpS = 0;
  let prev = 0;
  function step(x: number, G: number, k: number): number {
    const G2 = G * G;
    const b = 1 - G;
    const sigma = G2 * G * b * s1 + G2 * b * s2 + G * b * s3 + b * s4;
    let u: number;
    if (diode) {
      hpS += 0.0107 * (y4 - hpS);
      u = (x - k * (sigma - hpS)) / (1 + k * G2 * G2);
      u = sat(1.2 * u + 0.12) - 0.1194;
    } else u = sat((x - k * sigma) / (1 + k * G2 * G2));
    let v = (u - s1) * G;
    let y = v + s1;
    s1 = y + v;
    v = (y - s2) * G;
    y = v + s2;
    s2 = y + v;
    v = (y - s3) * G;
    y = v + s3;
    s3 = y + v;
    const y3 = y;
    v = (y - s4) * G;
    y = v + s4;
    s4 = y + v;
    y4 = y;
    return diode ? 0.35 * y3 + 0.65 * y : y;
  }
  return {
    run(x: number, G: number, k: number): number {
      const a = step(0.5 * (prev + x), G, k);
      const b = step(x, G, k);
      prev = x;
      return 0.5 * (a + b);
    },
  };
}

/** A delay line read at a fractional delay with 4-point Lagrange interpolation (modulated waveguides). */
export function delayLine(maxSamples: number) {
  let size = 1;
  while (size < maxSamples + 8) size <<= 1;
  const buf = new Float32Array(size);
  const mask = size - 1;
  let w = 0;
  return {
    /** The sample written `d` samples ago (d >= 1). */
    read(d: number): number {
      const di = Math.floor(d);
      const f = d - di;
      const i = w - di;
      const xm1 = buf[(i + 1) & mask];
      const x0 = buf[i & mask];
      const x1 = buf[(i - 1) & mask];
      const x2 = buf[(i - 2) & mask];
      // Lagrange 3rd order around x0 (delay di) .. x1 (di + 1).
      const c0 = x0;
      const c1 = x1 - xm1 / 3 - x0 / 2 - x2 / 6;
      const c2 = 0.5 * (xm1 + x1) - x0;
      const c3 = (x2 - xm1) / 6 + 0.5 * (x0 - x1);
      return ((c3 * f + c2) * f + c1) * f + c0;
    },
    write(x: number) {
      w = (w + 1) & mask;
      buf[w] = x;
    },
  };
}

/** A DC blocker (one-pole highpass at ~sr/2000 Hz). */
export function dcBlock(r = 0.9995) {
  let x1 = 0;
  let y1 = 0;
  return (x: number) => {
    y1 = x - x1 + r * y1;
    x1 = x;
    return y1;
  };
}

/** Buffers for a note of at most `sec` seconds. */
export function alloc(sec: number, sr: number, stereo: boolean): Rendered {
  const n = Math.max(64, Math.round(Math.min(MAX_SEC, sec) * sr));
  return { L: new Float32Array(n), R: stereo ? new Float32Array(n) : null };
}

/**
 * Ends a rendered note: cuts it after its last sample above `floor` (plus a 64-sample fade to exactly 0), and fades
 * the last 256 samples of a note that hit MAX_SEC. Every note therefore ends on exactly 0.
 */
export function finish(out: Rendered, floor = 1e-5): Rendered {
  const { L, R } = out;
  let last = 0;
  for (let i = L.length - 1; i >= 0; i--) {
    if (Math.abs(L[i]) > floor || (R && Math.abs(R[i]) > floor)) {
      last = i;
      break;
    }
  }
  const fadeN = last + 1 >= L.length ? 256 : 64;
  const end = Math.min(L.length, last + 1 + (fadeN === 64 ? 64 : 0));
  const start = Math.max(0, end - fadeN);
  for (let i = start; i < end; i++) {
    const g = (end - 1 - i) / Math.max(1, end - 1 - start);
    L[i] *= g;
    if (R) R[i] *= g;
  }
  const cut = (x: Float32Array) => (end < x.length ? x.slice(0, Math.max(end, 64)) : x);
  const res = { L: cut(L), R: R ? cut(R) : null };
  res.L[res.L.length - 1] = 0;
  if (res.R) res.R[res.R.length - 1] = 0;
  return res;
}

/** Equal-power pan of a mono render into stereo. */
export function toStereo(m: Float32Array, pan: number): Rendered {
  const [gl, gr] = panGains(pan);
  const L = new Float32Array(m.length);
  const R = new Float32Array(m.length);
  for (let i = 0; i < m.length; i++) {
    L[i] = m[i] * gl;
    R[i] = m[i] * gr;
  }
  return { L, R };
}

/** Adds `src` (from sample `at`) into `dst`, scaled. */
export function mixInto(dst: Float32Array, src: Float32Array, at: number, g = 1) {
  const n = Math.min(src.length, dst.length - at);
  for (let i = 0; i < n; i++) dst[at + i] += src[i] * g;
}

/**
 * A strike's force pulse, `n` samples long (the contact time): a Gaussian (+-2.5 sigma), so its spectrum rolls off
 * smoothly with no nulls (a felt or a finger: shorter = brighter). It sums to `amp`, so a resonator it drives swings
 * to ~amp.
 */
export function pulse(n: number, amp: number) {
  const N = Math.max(3, Math.round(n));
  const c = (N - 1) / 2;
  const sg = N / 5;
  const w = new Float64Array(N);
  let sum = 0;
  for (let i = 0; i < N; i++) sum += w[i] = Math.exp(-0.5 * ((i - c) / sg) ** 2);
  for (let i = 0; i < N; i++) w[i] *= amp / sum;
  return (i: number) => (i >= 0 && i < N ? w[i] : 0);
}

/**
 * A string's loop loss filter (one-pole, after Välimäki's design): per pass of the loop it lets the fundamental decay
 * with T60 `t60` s and a reference frequency `fRef` Hz with `t60hf` s, so the upper harmonics of a low string die as
 * fast as a real string's (a two-point average keeps a low string bright for seconds). `delay` = its phase delay at the
 * fundamental, in samples (the waveguide subtracts it). `set` again at the gate for the damper.
 */
export function lossFilter(f0: number, sr: number, fRef: number) {
  let g0 = 1;
  let a = 0;
  let y = 0;
  const w0 = (TAU * f0) / sr;
  const wr = (TAU * Math.max(f0 * 2, Math.min(fRef, sr * 0.4))) / sr;
  const c0 = Math.cos(w0);
  const f = {
    delay: 0,
    set(t60: number, t60hf: number) {
      // Per-pass gains at the fundamental and at the reference; the pole a gives their ratio, G puts the fundamental's.
      const g1 = Math.pow(10, -3 / (Math.max(0.005, t60) * f0));
      const gr = Math.pow(10, -3 / (Math.max(0.001, Math.min(t60hf, t60)) * f0));
      const rho2 = Math.pow(gr / g1, 2);
      if (rho2 >= 0.999999) a = 0;
      else {
        const B = c0 - rho2 * Math.cos(wr);
        const C = 1 - rho2;
        a = clamp((B - Math.sqrt(Math.max(0, B * B - C * C))) / C, 0, 0.995);
      }
      // The DC gain must stay under 1 (a lowpass passes DC more than the fundamental): ease the pole until it does.
      g0 = (g1 * Math.sqrt(1 - 2 * a * c0 + a * a)) / (1 - a);
      while (g0 > 0.9995 && a > 0) {
        a = Math.max(0, a - 0.01);
        g0 = (g1 * Math.sqrt(1 - 2 * a * c0 + a * a)) / (1 - a);
      }
      g0 = Math.min(g0, 0.9995);
      f.delay = Math.atan2(a * Math.sin(w0), 1 - a * c0) / w0;
    },
    run(x: number): number {
      y = g0 * (1 - a) * x + a * y;
      return y;
    },
  };
  return f;
}

/**
 * A bank of modal resonators in flat arrays (the hot loop of the modal voices: keys, mallets, drums). `add` a mode
 * (Hz, T60 s, input gain), then `tick(x)` drives every mode with x and returns the sum of their displacements.
 */
export class ModalBank {
  n = 0;
  private re = new Float64Array(64);
  private im = new Float64Array(64);
  private c = new Float64Array(64);
  private s = new Float64Array(64);
  private r = new Float64Array(64);
  private a = new Float64Array(64);
  private w = new Float64Array(64);
  /** Each mode's T60 as added (dampers read it). */
  t60 = new Float64Array(64);
  constructor(private readonly sr: number) {}
  add(fr: number, t60: number, amp: number): number {
    if (this.n === this.re.length) {
      const grow = (x: Float64Array) => {
        const y = new Float64Array(x.length * 2);
        y.set(x);
        return y;
      };
      this.re = grow(this.re);
      this.im = grow(this.im);
      this.c = grow(this.c);
      this.s = grow(this.s);
      this.r = grow(this.r);
      this.a = grow(this.a);
      this.w = grow(this.w);
      this.t60 = grow(this.t60);
    }
    const i = this.n++;
    const w = (TAU * fr) / this.sr;
    this.w[i] = w;
    this.c[i] = Math.cos(w);
    this.s[i] = Math.sin(w);
    this.r[i] = Math.exp(-6.9 / (Math.max(0.002, t60) * this.sr));
    this.t60[i] = t60;
    this.a[i] = amp;
    return i;
  }
  /** The pole radius of mode i (its input gain at resonance is 1 / (1 - r)). */
  radius(i: number) {
    return this.r[i];
  }
  setT60(i: number, t60: number) {
    this.r[i] = Math.exp(-6.9 / (Math.max(0.002, t60) * this.sr));
  }
  /** Moves every mode's frequency by `ratio` (tension, drift). */
  retune(ratio: number) {
    for (let i = 0; i < this.n; i++) {
      const w = this.w[i] * ratio;
      this.c[i] = Math.cos(w);
      this.s[i] = Math.sin(w);
    }
  }
  tick(x: number): number {
    const { re, im, c, s, r, a } = this;
    let y = 0;
    for (let i = 0; i < this.n; i++) {
      const pr = re[i];
      const pi = im[i];
      re[i] = r[i] * (c[i] * pr - s[i] * pi) + x * a[i];
      const ni = r[i] * (s[i] * pr + c[i] * pi);
      im[i] = ni;
      y += ni;
    }
    return y;
  }
}
