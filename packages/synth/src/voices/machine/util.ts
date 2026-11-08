/**
 * Shared building blocks of the voice library: band-limited waves with a start phase (so a unison stack does not
 * start every saw on the same edge), envelopes that land on exactly 0, saturation curves, MIDI to Hz.
 */
import type { Source, VoiceHost } from "./host.ts";

export type WaveName = "saw" | "square" | "pulse25" | "pulse12" | "triangle" | "sine";

export const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

const waveCache = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();

/**
 * A wave from its Fourier series, started `phase` (0..1) into its cycle. Phases are quantised to eighths, so a
 * context holds at most 8 tables per wave. Normalised like the built-in oscillator types.
 */
export function wave(ctx: BaseAudioContext, name: WaveName, phase = 0): PeriodicWave {
  let cache = waveCache.get(ctx);
  if (!cache) {
    cache = new Map();
    waveCache.set(ctx, cache);
  }
  const ph = (((Math.round(phase * 8) % 8) + 8) % 8) / 8;
  const key = `${name}:${ph}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const n = name === "sine" ? 2 : 160;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  const th = 2 * Math.PI * ph;
  for (let k = 1; k < n; k++) {
    // sin-series waves: b_k sin(k(wt + th)); cos-series (pulses): a_k cos(k(wt + th)).
    let b = 0;
    let a = 0;
    if (name === "saw") b = ((k % 2 === 1 ? 1 : -1) * 2) / (k * Math.PI);
    else if (name === "square") b = k % 2 === 1 ? 4 / (k * Math.PI) : 0;
    else if (name === "triangle") b = k % 2 === 1 ? ((((k - 1) / 2) % 2 === 0 ? 1 : -1) * 8) / (k * k * Math.PI * Math.PI) : 0;
    else if (name === "sine") b = k === 1 ? 1 : 0;
    else a = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * (name === "pulse25" ? 0.25 : 0.125));
    real[k] = b * Math.sin(k * th) + a * Math.cos(k * th);
    imag[k] = b * Math.cos(k * th) - a * Math.sin(k * th);
  }
  const w = ctx.createPeriodicWave(real, imag);
  cache.set(key, w);
  return w;
}

/** An oscillator on a wave at `freq`, its `detune` in cents, started and stopped by the caller. */
export function osc(ctx: BaseAudioContext, name: WaveName, freq: number, t: number, detune = 0, phase = 0): OscillatorNode {
  const o = ctx.createOscillator();
  if (name === "sine" && phase === 0) o.type = "sine";
  else o.setPeriodicWave(wave(ctx, name, phase));
  o.frequency.setValueAtTime(freq, t);
  if (detune) o.detune.setValueAtTime(detune, t);
  return o;
}

/**
 * ADSR on a gain: linear attack to `peak`, exponential decay to `peak * sustain`, held to `hold` (from t), then an
 * exponential release that lands on exactly 0 (a resonant filter after it must not ring on). Returns the end time.
 */
export function adsr(g: AudioParam, t: number, peak: number, a: number, d: number, s: number, hold: number, r: number): number {
  const p = Math.max(0.0002, peak);
  const sus = Math.max(0.0001, p * s);
  const at = Math.max(0.001, a);
  const top = Math.max(at + Math.max(0.005, d), hold);
  g.setValueAtTime(0.0001, t);
  g.linearRampToValueAtTime(p, t + at);
  g.exponentialRampToValueAtTime(sus, t + at + Math.max(0.005, d));
  g.setValueAtTime(sus, t + top);
  g.exponentialRampToValueAtTime(0.0001, t + top + Math.max(0.01, r));
  g.setValueAtTime(0, t + top + Math.max(0.01, r));
  return t + top + Math.max(0.01, r);
}

/** A percussive envelope: `attack` up, an exponential fall over `decay`, landing on 0. Returns the end time. */
export function hit(g: AudioParam, t: number, peak: number, attack: number, decay: number): number {
  const a = Math.max(0.001, attack);
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.exponentialRampToValueAtTime(0.0001, t + a + Math.max(0.01, decay));
  g.setValueAtTime(0, t + a + Math.max(0.01, decay));
  return t + a + Math.max(0.01, decay);
}

const curveCache = new Map<string, Float32Array<ArrayBuffer>>();

/**
 * A soft saturation curve over the shaper's [-1, 1]: tanh(k x) / k for unity gain on small signals (a bus or a layer
 * keeps its level, its peaks round off) or, `normalise`, tanh(k x) / tanh(k) (a driven voice, full scale).
 */
export function satCurve(k: number, normalise = false): Float32Array<ArrayBuffer> {
  const key = `${k.toFixed(3)}:${normalise}`;
  const hit = curveCache.get(key);
  if (hit) return hit;
  const n = 2049;
  const c = new Float32Array(n);
  const d = Math.max(0.01, k);
  const norm = normalise ? Math.tanh(d) : d;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * d) / norm;
  }
  curveCache.set(key, c);
  return c;
}

/** A WaveShaper on a saturation curve (no oversampling: bit-exact offline). */
export function shaper(ctx: BaseAudioContext, k: number, normalise = false): WaveShaperNode {
  const s = ctx.createWaveShaper();
  s.curve = satCurve(k, normalise);
  s.oversample = "none";
  return s;
}

export function biquad(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.7, t = 0): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(Math.min(20000, Math.max(20, freq)), t);
  f.Q.value = q;
  return f;
}

export function gainNode(ctx: BaseAudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

/** A looping noise source on the host's buffer. */
export function noiseSrc(h: VoiceHost): AudioBufferSourceNode {
  const n = h.ctx.createBufferSource();
  n.buffer = h.noise();
  n.loop = true;
  return n;
}

/** Starts every source at `t` and stops them at `when`, the first one freeing `rest`. */
export function run(h: VoiceHost, sources: Source[], rest: AudioNode[], t: number, when: number) {
  for (const s of sources) s.start(t);
  sources.forEach((s, i) => h.end(s, i === 0 ? rest : [], when));
}
