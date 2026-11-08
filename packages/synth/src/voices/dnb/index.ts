// Liquid voices: sample-free instrument models rendered per note (or per chord) in plain JS into stereo buffers that
// the engine plays (engine.ts liquidVoice; opt-in through a liquid style's `dnb.voices`). Each is its own synthesis
// technique, not a re-parameterised oscillator + filter:
//
//   keys    rhodes     tine model: a cantilever tine (fundamental + its inharmonic 6.27x mode) read through a
//                      nonlinear electromagnetic pickup (the output is d/dt of the flux, 1/sqrt((x-x0)^2+1)): the
//                      harder the strike, the more "bark"; a damper; a stereo suitcase autopan
//           wurli      reed model: a decaying reed read through an asymmetric electrostatic pickup x/(1-kx) (strong
//                      2nd harmonic, nasal), a preamp band, an amplitude tremolo
//           vibes      modal: three bar modes tuned 1:4:10 with their own decays, a yarn-mallet strike, the motor's
//                      amplitude tremolo on the fundamental
//           guitar     Karplus-Strong (Jaffe-Smith extended): a fractional-delay string loop, a pluck at a pick
//                      position, two hollow-body resonances, a neck-pickup lowpass
//           stab       Juno-style DCO stab: PWM pulse + saw + sub square, a 4-pole ladder with a fast envelope, the
//                      BBD chorus II
//   pads    juno       Juno-106 pad: PWM pulse + saw + sub square, a highpass, a 4-pole ladder with a slow envelope,
//                      chorus I+II (one BBD line swept by a triangle, wet + left, wet - right)
//           supersaw   JP-8000 supersaw strings: seven polyBLEP saws per note at Szabo's detune offsets, random phases,
//                      the pitch-tracking highpass, alternate saws left and right, slow attack
//           ensemble   string machine (Solina): saw 8' + 4' through a formant band into a three-phase BBD ensemble
//                      (three delay lines swept by a 0.6 Hz + 6 Hz pair 120 degrees apart, fully wet)
//           organ      tonewheel organ: drawbar sines (16', 8', 4', 2 2/3'), key click, a slow Leslie (a crossover, the
//                      drum's and the horn's amplitude and Doppler rotation into two mics)
//           choir      formant choir: per note four singers, each a band-limited glottal wavetable with its own
//                      vibrato, jitter and aspiration, through a five-formant bank (soprano/alto or tenor tables)
//                      morphing "oo" -> "aah" (`ooh`: the reverse, darker)
//   leads   voice      a solo formant singer ("aah" -> "oh") with a soft double, portamento, delayed vibrato
//           flute      additive flute: a near-sine with weak harmonics, breath noise in bands at f and 2f, a chiff
//                      on the attack, delayed vibrato, portamento
//           sax        waveshaped alto sax: an asymmetric tanh whose drive follows the breath envelope (louder =
//                      brighter), three body formants, breath noise, vibrato
//           trumpet    Chowning FM brass (index following the amplitude envelope), a pitch scoop, a harmon mute
//   bass    reese      three polyBLEP saws whose detune itself drifts, a driven 4-pole ladder, highpassed over the sub
//           moog       two saws and a square an octave down, a resonant ladder with a plucked filter envelope
//           upright    Karplus-Strong upright bass: a thumb pluck, a dark loop, a body resonance
//
// Every voice is deterministic (a seeded PRNG, no Date or Math.random): the same note renders the same samples.

export type LiquidVoiceKind =
  | "rhodes"
  | "wurli"
  | "vibes"
  | "guitar"
  | "stab"
  | "juno"
  | "supersaw"
  | "ensemble"
  | "organ"
  | "choir"
  | "ooh"
  | "voice"
  | "flute"
  | "sax"
  | "trumpet"
  | "reese"
  | "moog"
  | "upright"
  | "bell"
  | "harp"
  | "glass"
  | "pan"
  | "alto";

export const LIQUID_VOICE_KINDS: readonly LiquidVoiceKind[] = [
  "rhodes", "wurli", "vibes", "guitar", "stab", "juno", "supersaw", "ensemble", "organ", "choir", "ooh", "voice", "flute", "sax", "trumpet",
  "reese", "moog", "upright", "bell", "harp", "glass", "pan", "alto",
];

/** One render request: the notes (MIDI; a chord for the pads), the held length (s), velocity 0..1. */
export interface VoiceNote {
  midi: readonly number[];
  dur: number;
  vel: number;
  sr: number;
  seed: number;
  /** 0..1, the voice's brightness (its filter, mallet or breath), default 0.5. */
  bright?: number;
  /** The previous lead note (MIDI) to glide from (leads only). */
  prev?: number;
  /** 0..1, the phase of a free-running modulator at the note's start (the vibes' motor). */
  phase?: number;
  /** The glass pad (opt-in): its FM strike's level 0..1 (left out 1) and ratio (left out 2.76). */
  strike?: number;
  strikeRatio?: number;
}

export interface VoiceOut {
  L: Float32Array;
  R: Float32Array;
}

const TAU = Math.PI * 2;
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RBJ biquad (direct form II transposed). */
class Biquad {
  b0 = 1;
  b1 = 0;
  b2 = 0;
  a1 = 0;
  a2 = 0;
  z1 = 0;
  z2 = 0;
  constructor(type?: "lp" | "hp" | "bp" | "peak", f?: number, q?: number, sr?: number, db = 0) {
    if (type) this.set(type, f!, q!, sr!, db);
  }
  set(type: "lp" | "hp" | "bp" | "peak", f: number, q: number, sr: number, db = 0) {
    const w = (TAU * clamp(f, 10, sr * 0.45)) / sr;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    const al = sw / (2 * q);
    let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
    if (type === "lp") {
      b0 = (1 - cw) / 2;
      b1 = 1 - cw;
      b2 = b0;
      a0 = 1 + al;
      a1 = -2 * cw;
      a2 = 1 - al;
    } else if (type === "hp") {
      b0 = (1 + cw) / 2;
      b1 = -(1 + cw);
      b2 = b0;
      a0 = 1 + al;
      a1 = -2 * cw;
      a2 = 1 - al;
    } else if (type === "bp") {
      // Constant 0 dB peak gain.
      b0 = al;
      b1 = 0;
      b2 = -al;
      a0 = 1 + al;
      a1 = -2 * cw;
      a2 = 1 - al;
    } else {
      const A = Math.pow(10, db / 40);
      b0 = 1 + al * A;
      b1 = -2 * cw;
      b2 = 1 - al * A;
      a0 = 1 + al / A;
      a1 = -2 * cw;
      a2 = 1 - al / A;
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }
  run(x: number): number {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

/** A 4-pole transistor-ladder-style lowpass: four one-poles, tanh on the input, resonance from the last pole. */
class Ladder {
  s0 = 0;
  s1 = 0;
  s2 = 0;
  s3 = 0;
  run(x: number, fc: number, k: number, sr: number): number {
    const g = 1 - Math.exp((-TAU * clamp(fc, 20, sr * 0.42)) / sr);
    const u = Math.tanh(x - k * this.s3);
    this.s0 += g * (u - this.s0);
    this.s1 += g * (this.s0 - this.s1);
    this.s2 += g * (this.s1 - this.s2);
    this.s3 += g * (this.s2 - this.s3);
    return this.s3 * (1 + 0.5 * k);
  }
}

const blep = (t: number, dt: number) => {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
};
const saw = (ph: number, dt: number) => 2 * ph - 1 - blep(ph, dt);
const pulse = (ph: number, dt: number, pw: number) => (ph < pw ? 1 : -1) + blep(ph, dt) - blep((ph - pw + 1) % 1, dt);

/** A fractional delay line (linear interpolation). */
class Delay {
  buf: Float32Array;
  w = 0;
  constructor(n: number) {
    this.buf = new Float32Array(n);
  }
  push(x: number) {
    this.buf[this.w] = x;
    this.w = (this.w + 1) % this.buf.length;
  }
  /** `d` samples back (>= 1). */
  read(d: number): number {
    const n = this.buf.length;
    const r = this.w - d;
    const i = Math.floor(r);
    const fr = r - i;
    const a = this.buf[((i % n) + n) % n];
    const b = this.buf[(((i + 1) % n) + n) % n];
    return a + (b - a) * fr;
  }
}

/** Linear attack, held level, a release of time constant `r` after `dur`. */
function asr(t: number, a: number, dur: number, r: number): number {
  if (t < a) return t / a;
  if (t < dur) return 1;
  return Math.exp(-(t - dur) / r);
}

const out = (n: number): VoiceOut => ({ L: new Float32Array(n), R: new Float32Array(n) });
const len = (sr: number, dur: number, tail: number) => Math.max(1, Math.ceil(sr * Math.min(14, dur + tail)));

/** A one-pole DC blocker. */
class DcBlock {
  x1 = 0;
  y1 = 0;
  run(x: number) {
    const y = x - this.x1 + 0.997 * this.y1;
    this.x1 = x;
    this.y1 = y;
    return y;
  }
}

// ---------------------------------------------------------------------------------------------------------- keys

function rhodes(n: VoiceNote): VoiceOut {
  const { sr, vel } = n;
  const m = n.midi[0];
  const f = mtof(m);
  const kt = Math.pow(2, -(m - 60) / 24);
  const N = len(sr, n.dur, 0.5);
  const o = out(N);
  const r = rng(n.seed);
  const A = 0.35 + 1.25 * vel * vel; // displacement over the pickup's reach: the bark
  const tau1 = clamp(2.8 * kt, 0.8, 7);
  const tauF = 0.3 * kt;
  const tau2 = 0.07 * kt;
  const bell = 0.05 + 0.1 * vel;
  const x0 = 0.32 + 0.12 * (n.bright ?? 0.5); // the voicing: the tine's offset from the pickup's center
  const phi = (x: number) => 1 / Math.sqrt((x - x0) * (x - x0) + 1);
  const lp = new Biquad("lp", 3000 + 1800 * (n.bright ?? 0.5), 0.6, sr);
  const lp2 = new Biquad("lp", 5200, 0.6, sr);
  const dc = new DcBlock();
  const thumpLp = new Biquad("lp", 900, 0.7, sr);
  const scale = sr / (TAU * f);
  const panRate = 4.4;
  const panPh = (n.seed % 997) / 997;
  let prev = phi(0);
  const w1 = (TAU * f) / sr;
  const w2 = (TAU * f * 6.27) / sr;
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    // The hammer's contact (~2 ms, a raised cosine), then the damper after the note.
    const damp = (t < 0.004 ? 0.5 - 0.5 * Math.cos((Math.PI * t) / 0.004) : 1) * (t < n.dur ? 1 : Math.exp(-(t - n.dur) / 0.08));
    const a1 = A * (0.55 * Math.exp(-t / tauF) + 0.45 * Math.exp(-t / tau1));
    const x = damp * (a1 * Math.sin(w1 * i) + A * bell * Math.exp(-t / tau2) * Math.sin(w2 * i));
    const p = phi(x);
    let y = (p - prev) * scale;
    prev = p;
    y = dc.run(lp2.run(lp.run(y)));
    // The hammer's felt thump: lowpassed noise under a 3 ms decay (the filter runs on, so nothing is cut).
    y += thumpLp.run(t < 0.03 ? (r() * 2 - 1) * Math.exp(-t / 0.004) * 0.04 * vel : 0);
    const pan = 0.32 * Math.sin(TAU * (panRate * t + panPh));
    o.L[i] = y * (1 + pan);
    o.R[i] = y * (1 - pan);
  }
  return o;
}

function wurli(n: VoiceNote): VoiceOut {
  const { sr, vel } = n;
  const m = n.midi[0];
  const f = mtof(m);
  const kt = Math.pow(2, -(m - 60) / 24);
  const N = len(sr, n.dur, 0.35);
  const o = out(N);
  const r = rng(n.seed);
  const A = 0.25 + 0.6 * vel;
  const k = 0.5 + 0.38 * vel;
  const tau = clamp(1.5 * kt, 0.5, 4);
  const hp0 = new Biquad("hp", 40, 0.7, sr);
  const hp = new Biquad("hp", 190, 0.7, sr);
  const lp = new Biquad("lp", 2800 + 2200 * (n.bright ?? 0.5), 0.8, sr);
  const tremPh = (n.seed % 991) / 991;
  const w = (TAU * f) / sr;
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    const damp = t < n.dur ? 1 : Math.exp(-(t - n.dur) / 0.06);
    const x = damp * A * (0.6 * Math.exp(-t / (0.25 * kt)) + 0.4 * Math.exp(-t / tau)) * Math.sin(w * i);
    let y = x / (1 - k * x); // the electrostatic pickup's asymmetry: x + kx^2 + k^2x^3 .. (its DC goes in the highpass)
    if (t < 0.004) y += (r() * 2 - 1) * 0.025 * vel * (1 - t / 0.004);
    y = Math.tanh(1.6 * lp.run(hp.run(hp0.run(y)))) / 1.6;
    const trem = 1 - 0.2 * (0.5 + 0.5 * Math.sin(TAU * (5.6 * t + tremPh)));
    o.L[i] = y * trem;
    o.R[i] = y * trem;
  }
  return o;
}

function vibes(n: VoiceNote): VoiceOut {
  const { sr, vel } = n;
  const m = n.midi[0];
  const f = mtof(m);
  const kt = Math.pow(2, -(m - 60) / 24);
  const N = len(sr, n.dur, 1.4);
  const o = out(N);
  const r = rng(n.seed);
  const hard = 0.3 + 0.7 * (n.bright ?? 0.5) * (0.5 + 0.5 * vel); // the mallet: yarn (soft) .. cord
  const modes = [
    { ratio: 1, amp: 1, tau: 3.2 * kt },
    { ratio: 3.98, amp: 0.3 * hard, tau: 0.7 * kt },
    { ratio: 9.85, amp: 0.025 * hard * hard, tau: 0.12 * kt },
  ];
  const motor = n.phase ?? 0;
  const strikeLp = new Biquad("lp", 1500 + 2500 * hard, 0.7, sr);
  // Each mode a recursive sinusoid (a rotation), its decay a per-sample factor.
  const live = modes.filter((md) => f * md.ratio < sr * 0.45);
  const c = live.map((md) => Math.cos((TAU * f * md.ratio) / sr));
  const sn = live.map((md) => Math.sin((TAU * f * md.ratio) / sr));
  const dec = live.map((md) => Math.exp(-1 / (md.tau * sr)));
  const re = live.map((md) => md.amp);
  const im = live.map(() => 0);
  const lvl = (0.3 + 0.7 * vel) * 0.6;
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    // The pedal: held while the note is, then the damper bar over ~0.35 s.
    const damp = t < n.dur + 0.25 ? 1 : Math.exp(-(t - n.dur - 0.25) / 0.35);
    const trem = 1 - 0.42 * (0.5 + 0.5 * Math.sin(TAU * (5.2 * t + motor)));
    let l = 0;
    let rr = 0;
    for (let j = 0; j < live.length; j++) {
      const v = im[j] * (j === 0 ? trem : 1 - 0.2 * (1 - trem));
      l += v * (j === 2 ? 0.7 : 1);
      rr += v * (j === 1 ? 0.8 : 1);
      const a = re[j] * c[j] - im[j] * sn[j];
      const b = re[j] * sn[j] + im[j] * c[j];
      re[j] = a * dec[j];
      im[j] = b * dec[j];
    }
    let s = 0;
    s = strikeLp.run(t < 0.006 ? (r() * 2 - 1) * Math.sin((Math.PI * t) / 0.006) : 0) * 0.08 * hard;
    o.L[i] = (l + s) * damp * lvl;
    o.R[i] = (rr + s) * damp * lvl;
  }
  return o;
}

/** The phase delay (samples) of a filter H(z) = (b0 + b1 z^-1) / (1 + a1 z^-1) at angular frequency w. */
function phaseDelay(b0: number, b1: number, a1: number, w: number): number {
  const nr = b0 + b1 * Math.cos(w);
  const ni = -b1 * Math.sin(w);
  const dr = 1 + a1 * Math.cos(w);
  const di = -a1 * Math.sin(w);
  const ph = Math.atan2(ni, nr) - Math.atan2(di, dr);
  return -ph / w;
}

/**
 * A plucked string (Jaffe-Smith extended Karplus-Strong): a loop of an integer delay, a two-tap loss filter
 * (`s` 0..0.5, 0.5 darkest), a one-pole lowpass `p`, and a first-order allpass for the fraction; the loop's
 * total phase delay at f equals sr/f. `t60` the ring, `t60off` after the note.
 */
function pluckString(n: VoiceNote, f: number, N: number, opt: { s: number; p: number; t60: number; t60off: number; exc: Float32Array }): Float32Array {
  const { sr } = n;
  const w = (TAU * f) / sr;
  const total = sr / f;
  const dLoss = phaseDelay(1 - opt.s, opt.s, 0, w);
  const dLp = phaseDelay(1 - opt.p, 0, -opt.p, w);
  let D = Math.floor(total - dLoss - dLp - 0.1);
  let frac = total - dLoss - dLp - D;
  if (frac < 0.1) {
    D -= 1;
    frac += 1;
  }
  // A first-order allpass's phase delay at low frequency ~ (1 - C) / (1 + C) = frac.
  const C = (1 - frac) / (1 + frac);
  const line = new Float32Array(Math.max(2, D));
  const y = new Float32Array(N);
  const gOn = Math.pow(10, -3 / (opt.t60 * f));
  const gOff = Math.pow(10, -3 / (opt.t60off * f));
  let w0 = 0;
  let lossX1 = 0;
  let lpY = 0;
  let apX1 = 0;
  let apY1 = 0;
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    const g = t < n.dur ? gOn : gOff;
    const d = line[w0];
    const loss = (1 - opt.s) * d + opt.s * lossX1;
    lossX1 = d;
    lpY = (1 - opt.p) * loss + opt.p * lpY;
    const ap = C * lpY + apX1 - C * apY1;
    apX1 = lpY;
    apY1 = ap;
    const v = (i < opt.exc.length ? opt.exc[i] : 0) + g * ap;
    line[w0] = v;
    w0 = (w0 + 1) % line.length;
    y[i] = v;
  }
  return y;
}

function guitar(n: VoiceNote): VoiceOut {
  const { sr, vel } = n;
  const m = n.midi[0];
  const f = mtof(m);
  const N = len(sr, n.dur, 0.25);
  const o = out(N);
  const r = rng(n.seed);
  const P = Math.round(sr / f);
  const exc = new Float32Array(P);
  const soft = 0.75 - 0.35 * vel * (n.bright ?? 0.5); // a thumb / soft pick
  let lp = 0;
  for (let i = 0; i < P; i++) {
    lp = (1 - soft) * (r() * 2 - 1) + soft * lp;
    exc[i] = lp;
  }
  // The pick position: a comb (a node at 1/5 of the string).
  const beta = Math.max(1, Math.round(P * 0.2));
  for (let i = P - 1; i >= beta; i--) exc[i] -= exc[i - beta];
  for (let i = 0; i < P; i++) exc[i] *= 0.9 * (0.4 + 0.6 * vel);
  const t60 = clamp(3.4 * Math.pow(2, -(m - 52) / 24), 1, 5);
  const y = pluckString(n, f, N, { s: 0.45, p: 0.42 - 0.2 * (n.bright ?? 0.5), t60, t60off: 0.09, exc });
  const body1 = new Biquad("bp", 105, 2.5, sr);
  const body2 = new Biquad("bp", 230, 2, sr);
  const body3 = new Biquad("peak", 1100, 1, sr, -3);
  const pick = new Biquad("lp", 1900 + 1400 * (n.bright ?? 0.5), 0.8, sr);
  const dc = new DcBlock();
  const late = new Delay(1024);
  const lateN = Math.round(sr * 0.011);
  for (let i = 0; i < N; i++) {
    let v = y[i];
    v = v + 0.6 * body1.run(v) + 0.35 * body2.run(v);
    v = dc.run(pick.run(body3.run(v)));
    late.push(v);
    o.L[i] = v;
    o.R[i] = 0.82 * v + 0.3 * late.read(lateN);
  }
  return o;
}

/** The DCO voice of the Juno pads and stabs: saw + PWM pulse + sub square an octave down, per note. */
function junoDco(n: VoiceNote, N: number, levels: { saw: number; pulse: number; sub: number }, pwmRate: number): Float32Array {
  const { sr } = n;
  const x = new Float32Array(N);
  n.midi.forEach((m, j) => {
    const f = mtof(m) * (1 + (j - 1) * 0.0004);
    const dt = f / sr;
    let ph = (j * 0.37) % 1;
    let sph = (j * 0.21) % 1;
    const pwPh = j * 0.31;
    for (let i = 0; i < N; i++) {
      const pw = 0.5 + 0.32 * Math.sin(TAU * (pwmRate * (i / sr) + pwPh));
      x[i] += levels.saw * saw(ph, dt) + levels.pulse * pulse(ph, dt, pw) + levels.sub * pulse(sph, dt / 2, 0.5);
      ph += dt;
      if (ph >= 1) ph -= 1;
      sph += dt / 2;
      if (sph >= 1) sph -= 1;
    }
  });
  return x;
}

/** The Juno chorus: one BBD line swept by a triangle, wet added left and subtracted right (I: 0.51 Hz, II: 0.83 Hz). */
function junoChorus(x: Float32Array, sr: number, o: VoiceOut, mode: "I" | "II" | "I+II", gain: number) {
  const rate = mode === "I" ? 0.51 : mode === "II" ? 0.83 : 9.75;
  const depth = mode === "I+II" ? 0.0004 : 0.0019;
  const d = new Delay(Math.ceil(sr * 0.012));
  const bbd = new Biquad("lp", 7500, 0.7, sr);
  const center = sr * 0.0035;
  for (let i = 0; i < x.length; i++) {
    d.push(x[i]);
    const ph = (rate * i) / sr;
    const tri = 4 * Math.abs(ph - Math.floor(ph + 0.5)) - 1;
    const wet = bbd.run(d.read(center + tri * depth * sr));
    o.L[i] = gain * (x[i] + wet) * 0.7;
    o.R[i] = gain * (x[i] - 0.85 * wet) * 0.7;
  }
}

function stab(n: VoiceNote): VoiceOut {
  const { sr, vel } = n;
  const N = len(sr, n.dur, 0.35);
  const x = junoDco(n, N, { saw: 0.45, pulse: 0.5, sub: 0.25 }, 0.7);
  const lad = new Ladder();
  const hp = new Biquad("hp", 160, 0.7, sr);
  const top = 500 + 3200 * vel * (n.bright ?? 0.5);
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    const fc = 380 + top * Math.exp(-t / 0.13);
    const amp = (t < 0.003 ? t / 0.003 : 0.35 + 0.65 * Math.exp(-(t - 0.003) / 0.22)) * (t < n.dur ? 1 : Math.exp(-(t - n.dur) / 0.09));
    x[i] = hp.run(lad.run(x[i] * 0.6, fc, 0.9, sr)) * amp;
  }
  const o = out(N);
  junoChorus(x, sr, o, "II", 0.8);
  return o;
}

// ---------------------------------------------------------------------------------------------------------- pads

function juno(n: VoiceNote): VoiceOut {
  const { sr } = n;
  const N = len(sr, n.dur, 1.4);
  const x = junoDco(n, N, { saw: 0.4, pulse: 0.55, sub: 0.3 }, 0.55);
  const lad = new Ladder();
  const hp = new Biquad("hp", 130, 0.7, sr);
  const cut = 650 + 1500 * (n.bright ?? 0.5);
  const att = Math.min(0.9, n.dur * 0.4);
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    const env = t < att ? t / att : t < n.dur ? 1 : Math.exp(-(t - n.dur) / 0.55);
    const fc = 300 + cut * (t < 1.4 ? t / 1.4 : 1) * (0.85 + 0.15 * env);
    x[i] = hp.run(lad.run(x[i] * 0.45, fc, 0.7, sr)) * env;
  }
  const o = out(N);
  junoChorus(x, sr, o, "I", 0.8);
  return o;
}

const SZABO = [-0.11002313, -0.06288439, -0.01952356, 0, 0.01991221, 0.06216538, 0.10745242];

function supersaw(n: VoiceNote): VoiceOut {
  const { sr } = n;
  const N = len(sr, n.dur, 1.8);
  const o = out(N);
  const r = rng(n.seed);
  const detune = 0.22;
  const mix = 0.55;
  const center = -0.55366 * mix + 0.99785;
  const side = -0.73764 * mix * mix + 1.2841 * mix + 0.044372;
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  for (const m of n.midi) {
    const f = mtof(m);
    const hpL = new Biquad("hp", f * 0.95, 0.7, sr);
    const hpR = new Biquad("hp", f * 0.95, 0.7, sr);
    const ph = SZABO.map(() => r());
    const dts = SZABO.map((o) => (f * (1 + o * detune)) / sr);
    for (let i = 0; i < N; i++) {
      let l = 0;
      let rr = 0;
      for (let k = 0; k < 7; k++) {
        const v = saw(ph[k], dts[k]) * (k === 3 ? center : side);
        ph[k] += dts[k];
        if (ph[k] >= 1) ph[k] -= 1;
        if (k === 3) {
          l += v * 0.7;
          rr += v * 0.7;
        } else if (k % 2 === 0) l += v;
        else rr += v;
      }
      L[i] += hpL.run(l);
      R[i] += hpR.run(rr);
    }
  }
  const cut = 1800 + 2600 * (n.bright ?? 0.5);
  const lpL = new Biquad("lp", cut, 0.6, sr);
  const lpR = new Biquad("lp", cut, 0.6, sr);
  const lpL2 = new Biquad("lp", cut * 1.4, 0.6, sr);
  const lpR2 = new Biquad("lp", cut * 1.4, 0.6, sr);
  const att = Math.min(1.2, n.dur * 0.45);
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    const env = asr(t, att, n.dur, 0.7);
    o.L[i] = lpL2.run(lpL.run(L[i])) * env * 0.16;
    o.R[i] = lpR2.run(lpR.run(R[i])) * env * 0.16;
  }
  return o;
}

function ensemble(n: VoiceNote): VoiceOut {
  const { sr } = n;
  const N = len(sr, n.dur, 1.5);
  const o = out(N);
  const x = new Float32Array(N);
  n.midi.forEach((m, j) => {
    const f = mtof(m);
    const dt = f / sr;
    let a = (j * 0.29) % 1;
    let b = (j * 0.61) % 1;
    for (let i = 0; i < N; i++) {
      x[i] += saw(a, dt) + 0.55 * saw(b, dt * 2);
      a += dt;
      if (a >= 1) a -= 1;
      b += dt * 2;
      if (b >= 1) b -= 1;
    }
  });
  const hp = new Biquad("hp", 220, 0.7, sr);
  const peak = new Biquad("peak", 1150, 0.9, sr, 4);
  const lp = new Biquad("lp", 2400 + 2000 * (n.bright ?? 0.5), 0.7, sr);
  const lp2 = new Biquad("lp", 3400 + 2600 * (n.bright ?? 0.5), 0.7, sr);
  const att = Math.min(0.7, n.dur * 0.4);
  for (let i = 0; i < N; i++) x[i] = lp2.run(lp.run(peak.run(hp.run(x[i])))) * asr(i / sr, att, n.dur, 0.6);
  // The three-phase ensemble: three lines swept by a slow and a fast sine, 120 degrees apart; no dry signal.
  const d = new Delay(Math.ceil(sr * 0.02));
  const base = sr * 0.006;
  for (let i = 0; i < N; i++) {
    d.push(x[i]);
    const t = i / sr;
    const taps = [0, 1, 2].map((k) => {
      const p = (k * TAU) / 3;
      return d.read(base + sr * (0.0016 * Math.sin(TAU * 0.6 * t + p) + 0.00022 * Math.sin(TAU * 6.1 * t + p)));
    });
    o.L[i] = (taps[0] + 0.55 * taps[1]) * 0.11;
    o.R[i] = (taps[2] + 0.55 * taps[1]) * 0.11;
  }
  return o;
}

function organ(n: VoiceNote): VoiceOut {
  const { sr } = n;
  const N = len(sr, n.dur, 0.6);
  const o = out(N);
  const r = rng(n.seed);
  const bars = [
    [0.5, 0.75],
    [1, 1],
    [2, 0.5],
    [3, 0.16 + 0.2 * (n.bright ?? 0.5)],
  ];
  const x = new Float32Array(N);
  n.midi.forEach((m, j) => {
    const f = mtof(m);
    for (const [ratio, amp] of bars) {
      const w = (TAU * f * ratio) / sr;
      const p0 = (j + ratio) * 1.3;
      for (let i = 0; i < N; i++) x[i] += amp * Math.sin(w * i + p0);
    }
  });
  const click = new Biquad("bp", 2600, 1.2, sr);
  const att = Math.min(0.25, n.dur * 0.3);
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    const c = t < 0.003 ? click.run(r() * 2 - 1) * 0.08 * (1 - t / 0.003) : 0;
    x[i] = (x[i] * asr(t, att, n.dur, 0.12) + c) * 0.12;
  }
  // The Leslie, slow (chorale): a crossover at 800 Hz, the drum (low) turning at 0.67 Hz, the horn at 0.83 Hz with its
  // Doppler; two mics 90 degrees apart.
  const lo = new Biquad("lp", 800, 0.6, sr);
  const hi = new Biquad("hp", 800, 0.6, sr);
  const d = new Delay(Math.ceil(sr * 0.006));
  const c0 = sr * 0.0025;
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    const l = lo.run(x[i]);
    const h = hi.run(x[i]);
    d.push(h);
    const ad = TAU * 0.67 * t;
    const ah = TAU * 0.83 * t;
    const hL = d.read(c0 + sr * 0.00032 * Math.sin(ah)) * (1 - 0.32 * (0.5 + 0.5 * Math.cos(ah)));
    const hR = d.read(c0 + sr * 0.00032 * Math.sin(ah + Math.PI / 2)) * (1 - 0.32 * (0.5 + 0.5 * Math.cos(ah + Math.PI / 2)));
    const lL = l * (1 - 0.14 * (0.5 + 0.5 * Math.cos(ad)));
    const lR = l * (1 - 0.14 * (0.5 + 0.5 * Math.cos(ad + Math.PI / 2)));
    o.L[i] = lL + hL;
    o.R[i] = lR + hR;
  }
  return o;
}

// Formant tables (F Hz, amplitude dB, bandwidth Hz), five formants each (the classic Csound/IRCAM vocal tables).
type Vowel = { f: number[]; a: number[]; bw: number[] };
const VOWELS: Record<string, Vowel> = {
  sopA: { f: [800, 1150, 2900, 3900, 4950], a: [0, -6, -32, -20, -50], bw: [80, 90, 120, 130, 140] },
  sopO: { f: [450, 800, 2830, 3800, 4950], a: [0, -11, -22, -22, -50], bw: [70, 80, 100, 130, 135] },
  sopU: { f: [325, 700, 2700, 3800, 4950], a: [0, -16, -35, -40, -60], bw: [50, 60, 170, 180, 200] },
  altA: { f: [800, 1150, 2800, 3500, 4950], a: [0, -4, -20, -36, -60], bw: [80, 90, 120, 130, 140] },
  altO: { f: [450, 800, 2830, 3500, 4950], a: [0, -9, -16, -28, -55], bw: [70, 80, 100, 130, 135] },
  altU: { f: [325, 700, 2530, 3500, 4950], a: [0, -12, -30, -40, -64], bw: [50, 60, 170, 180, 200] },
  tenA: { f: [650, 1080, 2650, 2900, 3250], a: [0, -6, -7, -8, -22], bw: [80, 90, 120, 130, 140] },
  tenO: { f: [400, 800, 2600, 2800, 3000], a: [0, -10, -12, -12, -26], bw: [40, 80, 100, 120, 120] },
  tenU: { f: [350, 600, 2700, 2900, 3300], a: [0, -20, -17, -14, -26], bw: [40, 60, 100, 120, 120] },
};

/** A band-limited glottal pulse (one period, harmonics to ~9 kHz falling ~-10 dB/octave), a wavetable. */
function glottalTable(f: number, sr: number): Float32Array {
  const T = 2048;
  const tab = new Float32Array(T + 1);
  const K = Math.max(1, Math.floor(Math.min(9000, sr * 0.45) / f));
  for (let k = 1; k <= K; k++) {
    const a = Math.pow(k, -1.65);
    for (let i = 0; i <= T; i++) tab[i] += a * Math.sin((TAU * k * i) / T);
  }
  return tab;
}

/** A five-formant bank, its filters' coefficients moved every 64 samples along a vowel morph. */
class Formants {
  bp = [0, 1, 2, 3, 4].map(() => new Biquad());
  amp = [1, 1, 1, 1, 1];
  set(v: Vowel, sr: number) {
    for (let k = 0; k < 5; k++) {
      this.bp[k].set("bp", v.f[k], v.f[k] / v.bw[k], sr);
      this.amp[k] = Math.pow(10, v.a[k] / 20);
    }
  }
  run(x: number) {
    let y = 0;
    for (let k = 0; k < 5; k++) y += this.amp[k] * this.bp[k].run(x);
    return y;
  }
}
const lerpVowel = (a: Vowel, b: Vowel, u: number): Vowel => ({
  f: a.f.map((x, k) => x + (b.f[k] - x) * u),
  a: a.a.map((x, k) => x + (b.a[k] - x) * u),
  bw: a.bw.map((x, k) => x + (b.bw[k] - x) * u),
});

/**
 * Singers into a stereo formant bank: `voices` per note, each a glottal wavetable with its own vibrato (rate, delay),
 * jitter (a slow random walk) and aspiration; the vowel morphing from `from` to `to` over `morph` s.
 */
function singers(
  n: VoiceNote,
  N: number,
  opt: { voices: number; detune: number; vib: number; vibDelay: number; breath: number; from: Vowel; to: Vowel; morph: number; glide?: number; spread: number },
): VoiceOut {
  const { sr } = n;
  const r = rng(n.seed);
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  for (const m of n.midi) {
    const f = mtof(m);
    const tab = glottalTable(f, sr);
    for (let v = 0; v < opt.voices; v++) {
      const cents = opt.voices === 1 ? 0 : ((v / (opt.voices - 1)) * 2 - 1) * opt.detune + (r() - 0.5) * 4;
      const rate = 4.9 + r() * 0.8;
      const vph = r() * TAU;
      const pan = opt.voices === 1 ? 0 : ((v / (opt.voices - 1)) * 2 - 1) * opt.spread;
      const gl = Math.cos(((pan + 1) * Math.PI) / 4);
      const gr = Math.sin(((pan + 1) * Math.PI) / 4);
      const lvl = 1 / Math.sqrt(opt.voices);
      let ph = r();
      let jit = 0;
      const from = opt.glide !== undefined && n.prev !== undefined ? mtof(n.prev) / f : 1;
      for (let i = 0; i < N; i++) {
        const t = i / sr;
        if ((i & 255) === 0) jit = jit * 0.9 + (r() - 0.5) * 0.0016;
        const vibOn = clamp((t - opt.vibDelay) / 0.4, 0, 1);
        const vib = opt.vib * vibOn * Math.sin(TAU * rate * t + vph);
        const g = from !== 1 && t < (opt.glide ?? 0) ? from + (1 - from) * (t / (opt.glide ?? 1)) : 1;
        const hz = f * g * Math.pow(2, (cents + vib) / 1200) * (1 + jit);
        ph += hz / sr;
        if (ph >= 1) ph -= Math.floor(ph);
        const pos = ph * 2048;
        const k = Math.floor(pos);
        const s = tab[k] + (tab[k + 1] - tab[k]) * (pos - k);
        const asp = (r() * 2 - 1) * opt.breath * (0.6 + 0.4 * Math.cos(TAU * ph));
        const x = (s + asp) * lvl;
        L[i] += x * gl;
        R[i] += x * gr;
      }
    }
  }
  const fl = new Formants();
  const fr = new Formants();
  const o = out(N);
  for (let i = 0; i < N; i++) {
    if ((i & 63) === 0) {
      const v = lerpVowel(opt.from, opt.to, clamp(i / sr / opt.morph, 0, 1));
      fl.set(v, sr);
      fr.set(v, sr);
    }
    o.L[i] = fl.run(L[i]);
    o.R[i] = fr.run(R[i]);
  }
  return o;
}

function choir(n: VoiceNote, dark: boolean): VoiceOut {
  const { sr } = n;
  const N = len(sr, n.dur, 1.6);
  const hi = n.midi.reduce((a, b) => a + b, 0) / n.midi.length >= 58;
  const A = hi ? VOWELS.altA : VOWELS.tenA;
  const O = hi ? VOWELS.altO : VOWELS.tenO;
  const U = hi ? VOWELS.altU : VOWELS.tenU;
  const o = singers(n, N, {
    voices: 4,
    detune: 11,
    vib: 22,
    vibDelay: 0.2,
    breath: 0.05,
    from: dark ? O : U,
    to: dark ? U : A,
    morph: Math.max(0.5, n.dur * 0.6),
    spread: 0.75,
  });
  const att = Math.min(0.9, n.dur * 0.4);
  const g = 0.55 / Math.sqrt(n.midi.length);
  for (let i = 0; i < N; i++) {
    const e = asr(i / sr, att, n.dur, 0.6) * g;
    o.L[i] *= e;
    o.R[i] *= e;
  }
  return o;
}

// ---------------------------------------------------------------------------------------------------------- leads

function voice(n: VoiceNote): VoiceOut {
  const { sr } = n;
  const N = len(sr, n.dur, 0.5);
  const lead: VoiceNote = { ...n, midi: [n.midi[0]] };
  const main = singers(lead, N, { voices: 1, detune: 0, vib: 30, vibDelay: 0.28, breath: 0.09, from: VOWELS.sopA, to: VOWELS.sopO, morph: Math.max(0.6, n.dur), glide: 0.09, spread: 0 });
  const dbl = singers({ ...lead, seed: n.seed ^ 0x5a5a }, N, { voices: 2, detune: 9, vib: 24, vibDelay: 0.35, breath: 0.05, from: VOWELS.sopA, to: VOWELS.altA, morph: Math.max(0.6, n.dur), glide: 0.12, spread: 0.6 });
  const o = out(N);
  for (let i = 0; i < N; i++) {
    const e = asr(i / sr, 0.07, n.dur, 0.18) * 0.9;
    o.L[i] = (main.L[i] + 0.4 * dbl.L[i]) * e;
    o.R[i] = (main.R[i] + 0.4 * dbl.R[i]) * e;
  }
  return o;
}

/** Pitch (Hz) at time t for a lead: a glide from the previous note, delayed vibrato, an optional scoop. */
function leadPitch(n: VoiceNote, f: number, t: number, o: { glide: number; vib: number; vibRate: number; vibDelay: number; scoop: number }) {
  let g = 1;
  if (n.prev !== undefined && t < o.glide) {
    const from = mtof(n.prev) / f;
    g = from * Math.pow(1 / from, t / o.glide);
  } else if (n.prev === undefined && o.scoop && t < 0.07) g = Math.pow(2, (-o.scoop * (1 - t / 0.07)) / 1200);
  const vib = o.vib * clamp((t - o.vibDelay) / 0.35, 0, 1) * Math.sin(TAU * o.vibRate * t);
  return f * g * Math.pow(2, vib / 1200);
}

function flute(n: VoiceNote): VoiceOut {
  const { sr, vel } = n;
  const f = mtof(n.midi[0]);
  const N = len(sr, n.dur, 0.3);
  const o = out(N);
  const r = rng(n.seed);
  const harm = [1, 0.22, 0.1, 0.045, 0.02];
  const ph = harm.map(() => 0);
  const b1 = new Biquad("bp", f, 9, sr);
  const b2 = new Biquad("bp", f * 2, 9, sr);
  const b1b = new Biquad("bp", f, 9, sr);
  const b2b = new Biquad("bp", f * 2, 9, sr);
  const air = new Biquad("bp", 3200, 1.5, sr);
  const breath = 0.06 + 0.08 * (n.bright ?? 0.5);
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    const hz = leadPitch(n, f, t, { glide: 0.07, vib: 13, vibRate: 5.1, vibDelay: 0.28, scoop: 0 });
    const env = asr(t, 0.07, n.dur, 0.09);
    const chiff = t < 0.06 ? 1 - t / 0.06 : 0;
    let s = 0;
    for (let k = 0; k < harm.length; k++) {
      ph[k] += (hz * (k + 1)) / sr;
      if (ph[k] >= 1) ph[k] -= 1;
      s += harm[k] * (k === 1 ? 1 + 2.5 * chiff : 1) * Math.sin(TAU * ph[k]);
    }
    const nz = r() * 2 - 1;
    const tremolo = 1 + 0.07 * clamp((t - 0.28) / 0.35, 0, 1) * Math.sin(TAU * 5.1 * t);
    const y = (s * tremolo + breath * 9 * (b1b.run(b1.run(nz)) + 0.5 * b2b.run(b2.run(nz))) + air.run(nz) * (0.0006 + 0.03 * chiff)) * env * (0.5 + 0.5 * vel) * 0.28;
    o.L[i] = y;
    o.R[i] = y;
  }
  return o;
}

function sax(n: VoiceNote): VoiceOut {
  const { sr, vel } = n;
  const f = mtof(n.midi[0]);
  const N = len(sr, n.dur, 0.3);
  const o = out(N);
  const r = rng(n.seed);
  const f1 = new Biquad("bp", 520, 1.8, sr);
  const f2 = new Biquad("bp", 1500, 3, sr);
  const f3 = new Biquad("bp", 2700, 4, sr);
  const lp = new Biquad("lp", 3200 + 1500 * (n.bright ?? 0.5), 0.7, sr);
  const dc = new DcBlock();
  const air = new Biquad("bp", 2400, 2.5, sr);
  const air2 = new Biquad("lp", 3500, 0.7, sr);
  let ph = 0;
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    const hz = leadPitch(n, f, t, { glide: 0.06, vib: 18, vibRate: 5.3, vibDelay: 0.32, scoop: 35 });
    ph += hz / sr;
    if (ph >= 1) ph -= 1;
    const env = (t < 0.05 ? t / 0.05 : 0.88 + 0.12 * Math.exp(-(t - 0.05) / 0.15)) * (t < n.dur ? 1 : Math.exp(-(t - n.dur) / 0.07));
    const drive = 0.6 + 2.6 * env * (0.4 + 0.6 * vel);
    const x = Math.tanh(drive * Math.sin(TAU * ph) + 0.35) - Math.tanh(0.35);
    const y = dc.run(x);
    const body = 1.0 * f1.run(y) + 0.8 * f2.run(y) + 0.35 * f3.run(y) + 0.3 * lp.run(y);
    const nz = air2.run(air.run(r() * 2 - 1)) * 0.005 * env;
    const s = (body + nz) * env * 0.42;
    o.L[i] = s;
    o.R[i] = s;
  }
  return o;
}

function trumpet(n: VoiceNote): VoiceOut {
  const { sr, vel } = n;
  const f = mtof(n.midi[0]);
  const N = len(sr, n.dur, 0.25);
  const o = out(N);
  const hp = new Biquad("hp", 480, 0.7, sr);
  const mute = new Biquad("peak", 1750, 2.4, sr, 9);
  const lp = new Biquad("lp", 3600 + 1200 * (n.bright ?? 0.5), 0.7, sr);
  let pc = 0;
  let pm = 0;
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    const hz = leadPitch(n, f, t, { glide: 0.05, vib: 14, vibRate: 5.6, vibDelay: 0.3, scoop: 45 });
    const env = (t < 0.04 ? (t / 0.04) * 1.12 : 0.86 + 0.26 * Math.exp(-(t - 0.04) / 0.08)) * (t < n.dur ? 1 : Math.exp(-(t - n.dur) / 0.06));
    const index = (0.5 + 3.1 * vel) * Math.min(1, env);
    pm += hz / sr;
    pc += hz / sr;
    if (pm >= 1) pm -= 1;
    if (pc >= 1) pc -= 1;
    const y = Math.sin(TAU * pc + index * Math.sin(TAU * pm)) * env;
    const s = lp.run(mute.run(hp.run(y))) * 0.2;
    o.L[i] = s;
    o.R[i] = s;
  }
  return o;
}

// ---------------------------------------------------------------------------------------------------------- bass

function reese(n: VoiceNote): VoiceOut {
  const { sr, vel } = n;
  const f = mtof(n.midi[0]);
  const N = len(sr, n.dur, 0.12);
  const o = out(N);
  const r = rng(n.seed);
  const ph = [r(), r(), r()];
  const lad = new Ladder();
  const hp = new Biquad("hp", 85, 0.7, sr);
  const hp2 = new Biquad("hp", 85, 0.7, sr);
  const base = 260 + 420 * (n.bright ?? 0.5);
  const drift = r() * TAU;
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    const cents = 13 * (1 + 0.45 * Math.sin(TAU * 0.17 * t + drift));
    const hz = [f, f * Math.pow(2, cents / 1200), f * Math.pow(2, (-0.7 * cents) / 1200)];
    let s = 0;
    for (let k = 0; k < 3; k++) {
      const dt = hz[k] / sr;
      s += saw(ph[k], dt) * (k === 0 ? 0.5 : 0.42);
      ph[k] += dt;
      if (ph[k] >= 1) ph[k] -= 1;
    }
    const fc = base + 380 * vel * Math.exp(-t / 0.25);
    const env = (t < 0.006 ? t / 0.006 : 1) * (t < n.dur ? 1 : Math.exp(-(t - n.dur) / 0.03));
    const y = Math.tanh(1.8 * lad.run(s * 0.7, fc, 1.1, sr)) * env;
    const v = hp2.run(hp.run(y)) * 0.55;
    o.L[i] = v;
    o.R[i] = v;
  }
  return o;
}

function moog(n: VoiceNote): VoiceOut {
  const { sr, vel } = n;
  const f = mtof(n.midi[0]);
  const N = len(sr, n.dur, 0.1);
  const o = out(N);
  const lad = new Ladder();
  const hp = new Biquad("hp", 55, 0.7, sr);
  let a = 0;
  let b = 0.3;
  let c = 0.6;
  const top = 250 + 1700 * vel * (n.bright ?? 0.5);
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    const dt = f / sr;
    const dtb = (f * Math.pow(2, 6 / 1200)) / sr;
    const s = 0.45 * saw(a, dt) + 0.4 * saw(b, dtb) + 0.35 * pulse(c, dt / 2, 0.5);
    a += dt;
    b += dtb;
    c += dt / 2;
    if (a >= 1) a -= 1;
    if (b >= 1) b -= 1;
    if (c >= 1) c -= 1;
    const fc = 180 + top * Math.exp(-t / 0.16);
    const env = (t < 0.003 ? t / 0.003 : 0.75 + 0.25 * Math.exp(-t / 0.2)) * (t < n.dur ? 1 : Math.exp(-(t - n.dur) / 0.025));
    const v = hp.run(Math.tanh(1.5 * lad.run(s * 0.8, fc, 2.2, sr))) * env * 0.6;
    o.L[i] = v;
    o.R[i] = v;
  }
  return o;
}

function upright(n: VoiceNote): VoiceOut {
  const { sr, vel } = n;
  const m = n.midi[0];
  const f = mtof(m);
  const N = len(sr, n.dur, 0.2);
  const o = out(N);
  const r = rng(n.seed);
  const P = Math.round(sr / f);
  const exc = new Float32Array(P);
  // The thumb: a soft half-sine push plus lowpassed noise, an eighth of the period wide.
  const w = Math.max(4, Math.round(P * 0.3));
  let lp = 0;
  for (let i = 0; i < P; i++) {
    lp = 0.12 * (r() * 2 - 1) + 0.88 * lp;
    exc[i] = (i < w ? Math.sin((Math.PI * i) / w) : 0) * 0.8 + lp * 0.5;
  }
  for (let i = 0; i < P; i++) exc[i] *= 0.5 + 0.5 * vel;
  const y = pluckString(n, f, N, { s: 0.5, p: 0.78 - 0.2 * (n.bright ?? 0.5), t60: clamp(1.8 * Math.pow(2, -(m - 40) / 24), 0.6, 3), t60off: 0.07, exc });
  const body = new Biquad("peak", 95, 1.5, sr, 6);
  const wood = new Biquad("peak", 700, 1.2, sr, 3);
  const lpo = new Biquad("lp", 900 + 900 * (n.bright ?? 0.5), 0.7, sr);
  const dc = new DcBlock();
  for (let i = 0; i < N; i++) {
    const v = dc.run(lpo.run(wood.run(body.run(y[i])))) * 0.45;
    o.L[i] = v;
    o.R[i] = v;
  }
  return o;
}

// ---------------------------------------------------------------------------------------------- v5 additions

/**
 * FM bell (DX7 soft bell / E.PIANO bell): a 1:1 body pair and a 3.5:1 inharmonic pair whose index falls fast (a
 * glassy strike melting into a round tone), long key-tracked decays, a lowpass so no partial rings as a "ting".
 */
function bell(n: VoiceNote): VoiceOut {
  const { sr, vel } = n;
  const m = n.midi[0];
  const f = mtof(m);
  const kt = Math.pow(2, -(m - 60) / 24);
  const N = len(sr, n.dur, 1.6);
  const o = out(N);
  const lp = new Biquad("lp", 2400 + 2000 * (n.bright ?? 0.5), 0.6, sr);
  const panPh = (n.seed % 883) / 883;
  let pc = 0;
  let pm = 0;
  let qc = 0;
  let qm = 0;
  const i0 = 0.6 + 1.6 * vel * (n.bright ?? 0.5);
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    const damp = (t < 0.003 ? t / 0.003 : 1) * (t < n.dur + 0.4 ? 1 : Math.exp(-(t - n.dur - 0.4) / 0.5));
    pm += f / sr;
    pc += f / sr;
    qm += (f * 3.5) / sr;
    qc += f / sr;
    pm -= Math.floor(pm);
    pc -= Math.floor(pc);
    qm -= Math.floor(qm);
    qc -= Math.floor(qc);
    const body = Math.sin(TAU * pc + 0.8 * Math.exp(-t / 0.6) * Math.sin(TAU * pm)) * Math.exp(-t / (2.6 * kt));
    const glass = Math.sin(TAU * qc + i0 * Math.exp(-t / (0.22 * kt)) * Math.sin(TAU * qm)) * Math.exp(-t / (0.9 * kt)) * 0.45;
    const y = lp.run(body + glass) * damp * (0.35 + 0.65 * vel) * 0.4;
    const pan = 0.18 * Math.sin(TAU * (0.6 * t + panPh));
    o.L[i] = y * (1 + pan);
    o.R[i] = y * (1 - pan);
  }
  return o;
}

/** Harp: a bright, long Karplus-Strong string plucked near its middle (a round tone), a soundboard, a little width. */
function harp(n: VoiceNote): VoiceOut {
  const { sr, vel } = n;
  const m = n.midi[0];
  const f = mtof(m);
  const N = len(sr, n.dur, 1.2);
  const o = out(N);
  const r = rng(n.seed);
  const P = Math.round(sr / f);
  const exc = new Float32Array(P);
  let lp = 0;
  const soft = 0.55 - 0.3 * vel * (n.bright ?? 0.5);
  for (let i = 0; i < P; i++) {
    lp = (1 - soft) * (r() * 2 - 1) + soft * lp;
    // A finger's round pluck: a triangle-shaped displacement plus a little noise.
    exc[i] = (1 - Math.abs((2 * i) / P - 1)) * 0.9 + lp * 0.35;
  }
  const beta = Math.max(1, Math.round(P * 0.45));
  for (let i = P - 1; i >= beta; i--) exc[i] -= 0.6 * exc[i - beta];
  for (let i = 0; i < P; i++) exc[i] *= 0.4 + 0.6 * vel;
  const t60 = clamp(5 * Math.pow(2, -(m - 55) / 20), 1.4, 7);
  // A harp is not damped at the note's end: it rings on (its own release, 1.2 s).
  const y = pluckString({ ...n, dur: n.dur + 0.6 }, f, N, { s: 0.3, p: 0.12, t60, t60off: 0.5, exc });
  const board = new Biquad("peak", 300, 1, sr, 3);
  const top = new Biquad("lp", 3800 + 2500 * (n.bright ?? 0.5), 0.7, sr);
  const dc = new DcBlock();
  const late = new Delay(2048);
  const lateN = Math.round(sr * 0.017);
  for (let i = 0; i < N; i++) {
    const v = dc.run(top.run(board.run(y[i]))) * 0.7;
    late.push(v);
    o.L[i] = 0.9 * v + 0.2 * late.read(lateN);
    o.R[i] = 0.75 * v + 0.35 * late.read(lateN + 37);
  }
  return o;
}

/**
 * Glass pad (D-50 style "linear arithmetic"): a short FM attack (ratio 2.76, inharmonic; opt-in a harmonic ratio, a
 * lower level, or none) over a sustained pad of two
 * detuned saws through a 4-pole ladder, a breath band at 2f, the Juno chorus I for width.
 */
function glass(n: VoiceNote): VoiceOut {
  const { sr } = n;
  const N = len(sr, n.dur, 1.6);
  const r = rng(n.seed);
  const x = new Float32Array(N);
  const att = Math.min(1.0, n.dur * 0.4);
  // The strike (opt-in `strike`, `strikeRatio`): left out, v5's (level 1, ratio 2.76, index 2.2). An integer ratio
  // keeps its partials harmonics of the note, and a lower index (1.2) its upper sidebands quiet.
  const sk = n.strike ?? 1;
  const ratio = n.strikeRatio ?? 2.76;
  const index = n.strikeRatio === undefined ? 2.2 : 1.2;
  n.midi.forEach((m, j) => {
    const f = mtof(m);
    const dt = f / sr;
    const dt2 = (f * Math.pow(2, 9 / 1200)) / sr;
    let a = (j * 0.41) % 1;
    let b = (j * 0.73) % 1;
    let pm = 0;
    let pc = 0;
    const lad = new Ladder();
    const breathBp = new Biquad("bp", f * 2, 6, sr);
    const cut = 900 + 1400 * (n.bright ?? 0.5);
    for (let i = 0; i < N; i++) {
      const t = i / sr;
      const env = asr(t, att, n.dur, 0.7);
      const sawPad = saw(a, dt) + saw(b, dt2);
      a += dt;
      b += dt2;
      if (a >= 1) a -= 1;
      if (b >= 1) b -= 1;
      const pad = lad.run(sawPad * 0.35, cut, 0.4, sr) * env;
      pm += (f * ratio) / sr;
      pc += f / sr;
      pm -= Math.floor(pm);
      pc -= Math.floor(pc);
      const strike = sk > 0 && t < 1.2 ? Math.sin(TAU * pc + index * Math.exp(-t / 0.18) * Math.sin(TAU * pm)) * Math.exp(-t / 0.35) * 0.35 * sk : 0;
      const air = breathBp.run(r() * 2 - 1) * 0.25 * env;
      x[i] += pad + strike + air;
    }
  });
  const hp = new Biquad("hp", 150, 0.7, sr);
  for (let i = 0; i < N; i++) x[i] = hp.run(x[i]) * 0.5;
  const o = out(N);
  junoChorus(x, sr, o, "I", 0.8);
  return o;
}

/** Pan flute ("wind"): a breathy near-sine whose noise is pitched (narrow bands at f and 2f), a soft chiff, light vibrato. */
function pan(n: VoiceNote): VoiceOut {
  const { sr, vel } = n;
  const f = mtof(n.midi[0]);
  const N = len(sr, n.dur, 0.35);
  const o = out(N);
  const r = rng(n.seed);
  const harm = [1, 0.12, 0.05];
  const ph = harm.map(() => 0);
  const b1 = new Biquad("bp", f, 6, sr);
  const b1b = new Biquad("bp", f, 6, sr);
  const b2 = new Biquad("bp", f * 2, 5, sr);
  const b2b = new Biquad("bp", f * 2, 5, sr);
  const wind = new Biquad("bp", 1800, 0.9, sr);
  const breath = 0.2 + 0.25 * (n.bright ?? 0.5);
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    const hz = leadPitch(n, f, t, { glide: 0.09, vib: 8, vibRate: 4.6, vibDelay: 0.4, scoop: 0 });
    const env = (t < 0.09 ? t / 0.09 : 1) * (t < n.dur ? 1 : Math.exp(-(t - n.dur) / 0.12));
    const chiff = t < 0.08 ? 1 - t / 0.08 : 0;
    let s = 0;
    for (let k = 0; k < harm.length; k++) {
      ph[k] += (hz * (k + 1)) / sr;
      if (ph[k] >= 1) ph[k] -= 1;
      s += harm[k] * Math.sin(TAU * ph[k]);
    }
    const nz = r() * 2 - 1;
    const y = (s * (0.9 + 0.1 * Math.sin(TAU * 4.6 * t)) + breath * 14 * (b1b.run(b1.run(nz)) + 0.4 * b2b.run(b2.run(nz))) + wind.run(nz) * (0.004 + 0.05 * chiff)) * env * (0.5 + 0.5 * vel) * 0.3;
    o.L[i] = y;
    o.R[i] = y;
  }
  return o;
}

/** Alto hum: a formant alto soloist on "ooh" opening to "oh", a soft double, slow portamento, a late vibrato. */
function alto(n: VoiceNote): VoiceOut {
  const { sr } = n;
  const N = len(sr, n.dur, 0.6);
  const lead: VoiceNote = { ...n, midi: [n.midi[0]] };
  const main = singers(lead, N, { voices: 1, detune: 0, vib: 22, vibDelay: 0.4, breath: 0.06, from: VOWELS.altU, to: VOWELS.altO, morph: Math.max(0.8, n.dur), glide: 0.14, spread: 0 });
  const dbl = singers({ ...lead, seed: n.seed ^ 0x3c3c }, N, { voices: 2, detune: 7, vib: 18, vibDelay: 0.5, breath: 0.04, from: VOWELS.altU, to: VOWELS.altA, morph: Math.max(0.8, n.dur), glide: 0.16, spread: 0.5 });
  const o = out(N);
  for (let i = 0; i < N; i++) {
    const e = asr(i / sr, 0.12, n.dur, 0.25);
    o.L[i] = (main.L[i] + 0.45 * dbl.L[i]) * e;
    o.R[i] = (main.R[i] + 0.45 * dbl.R[i]) * e;
  }
  return o;
}

/** Output gain per kind, so every voice reads ~-20 dBFS RMS on a mid note at velocity 0.7 (calibrated, test/voices). */
export const VOICE_GAIN: Record<LiquidVoiceKind, number> = {
  rhodes: 0.5,
  wurli: 0.29,
  vibes: 0.2,
  guitar: 1.03,
  stab: 0.94,
  juno: 0.59,
  supersaw: 0.8,
  ensemble: 0.53,
  organ: 0.62,
  choir: 2.03,
  ooh: 0.84,
  voice: 0.5,
  flute: 0.68,
  sax: 0.57,
  trumpet: 1.19,
  reese: 0.98,
  moog: 0.91,
  upright: 1.68,
  bell: 0.18,
  harp: 0.39,
  glass: 0.72,
  pan: 0.69,
  alto: 0.78,
};

/** Renders one note (or chord) of a liquid voice: stereo, `dur` + the voice's own release tail. */
export function renderVoice(kind: LiquidVoiceKind, n: VoiceNote): VoiceOut {
  const o = RENDER[kind](n);
  const g = VOICE_GAIN[kind];
  if (g !== 1) {
    for (let i = 0; i < o.L.length; i++) {
      o.L[i] *= g;
      o.R[i] *= g;
    }
  }
  // A 1 ms fade in and a 3 ms fade at the very end, so no buffer starts or stops on a step.
  const N = o.L.length;
  const fin = Math.min(N, Math.round(n.sr * 0.001));
  for (let i = 0; i < fin; i++) {
    o.L[i] *= i / fin;
    o.R[i] *= i / fin;
  }
  const fade = Math.min(N, Math.round(n.sr * 0.003));
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    o.L[N - 1 - i] *= k;
    o.R[N - 1 - i] *= k;
  }
  return o;
}

const RENDER: Record<LiquidVoiceKind, (n: VoiceNote) => VoiceOut> = {
  rhodes,
  wurli,
  vibes,
  guitar,
  stab,
  juno,
  supersaw,
  ensemble,
  organ,
  choir: (n) => choir(n, false),
  ooh: (n) => choir(n, true),
  voice,
  flute,
  sax,
  trumpet,
  reese,
  moog,
  upright,
  bell,
  harp,
  glass,
  pan,
  alto,
};
