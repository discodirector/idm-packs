import { mulberry32 } from "../hash.ts";
import type { Source, VoiceHost, VoiceNote } from "./types.ts";

/** Normalised tanh curve (1025 points); `bias` > 0 makes it asymmetric (even harmonics, a tube / tape colour). */
export function satCurve(drive: number, bias = 0): Float32Array {
  const n = 1025;
  const curve = new Float32Array(n);
  const d = Math.max(0.05, drive);
  const off = Math.tanh(bias);
  const norm = Math.max(Math.abs(Math.tanh(d + bias) - off), Math.abs(Math.tanh(-d + bias) - off));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = (Math.tanh(x * d + bias) - off) / norm;
  }
  return curve;
}

export function shaper(ctx: BaseAudioContext, curve: Float32Array): WaveShaperNode {
  const s = ctx.createWaveShaper();
  s.curve = new Float32Array(curve);
  s.oversample = "none";
  return s;
}

export function gainNode(ctx: BaseAudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

export function biquad(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/** Sums nodes two at a time (a binary tree of gains, each with exactly two inputs): bit-exact offline. */
export function sumAll(ctx: BaseAudioContext, inputs: AudioNode[], keep: AudioNode[]): AudioNode | null {
  let level = inputs.slice();
  if (!level.length) return null;
  while (level.length > 1) {
    const next: AudioNode[] = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 >= level.length) {
        next.push(level[i]);
        continue;
      }
      const g = ctx.createGain();
      level[i].connect(g);
      level[i + 1].connect(g);
      keep.push(g);
      next.push(g);
    }
    level = next;
  }
  return level[0];
}

/** An oscillator on the note: glides from `n.from` over `glide` s, else a scoop of `scoop` semitones settling in `scoopTime`. */
export function noteOsc(
  ctx: BaseAudioContext,
  n: VoiceNote,
  mult: number,
  opts: { type?: OscillatorType; wave?: PeriodicWave; detune?: number; glide?: number; scoop?: number; scoopTime?: number },
): OscillatorNode {
  const o = ctx.createOscillator();
  if (opts.wave) o.setPeriodicWave(opts.wave);
  else o.type = opts.type ?? "sine";
  const f = n.freq * mult;
  if (n.from && opts.glide) {
    o.frequency.setValueAtTime(n.from * mult, n.time);
    o.frequency.exponentialRampToValueAtTime(f, n.time + opts.glide);
  } else if (opts.scoop) {
    o.frequency.setValueAtTime(f * Math.pow(2, opts.scoop / 12), n.time);
    o.frequency.exponentialRampToValueAtTime(f, n.time + (opts.scoopTime ?? 0.04));
  } else o.frequency.setValueAtTime(f, n.time);
  if (opts.detune) o.detune.setValueAtTime(opts.detune, n.time);
  return o;
}

/**
 * An ADSR on a gain: from 0 to `peak` over `a`, down to `peak * s` over `d`, held to `hold` s after the onset, released
 * over `r` to exactly 0. Returns the end time.
 */
export function adsr(g: AudioParam, time: number, peak: number, a: number, d: number, s: number, hold: number, r: number): number {
  const p = Math.max(0.0002, peak);
  const sus = Math.max(0.0001, p * s);
  const at = Math.max(0.001, a);
  const held = Math.max(at + 0.005, hold);
  g.setValueAtTime(0, time);
  g.linearRampToValueAtTime(p, time + at);
  if (held > at + d) {
    g.exponentialRampToValueAtTime(sus, time + at + Math.max(0.005, d));
    g.setValueAtTime(sus, time + held);
  } else {
    // Released inside the decay: the level where the decay is at `held`.
    const lvl = p * Math.pow(sus / p, (held - at) / Math.max(0.005, d));
    g.exponentialRampToValueAtTime(Math.max(0.0001, lvl), time + held);
  }
  const rel = Math.max(0.01, r);
  g.exponentialRampToValueAtTime(0.0001, time + held + rel);
  g.setValueAtTime(0, time + held + rel);
  return time + held + rel;
}

/** A sine LFO into a gain of `depth`, its phase from `k` (a PeriodicWave), its rate from `rate`; a fade-in `delay` s. */
export function lfo(ctx: BaseAudioContext, wave: PeriodicWave, rate: number, depth: number, time: number, sources: Source[], keep: AudioNode[], delay = 0): GainNode {
  const o = ctx.createOscillator();
  o.setPeriodicWave(wave);
  o.frequency.setValueAtTime(rate, time);
  const g = ctx.createGain();
  if (delay > 0) {
    g.gain.setValueAtTime(0, time);
    g.gain.setValueAtTime(0, time + delay);
    g.gain.linearRampToValueAtTime(depth, time + delay + 0.3);
  } else g.gain.setValueAtTime(depth, time);
  o.connect(g);
  sources.push(o);
  keep.push(g);
  return g;
}

/** Cutoff of a filter that follows the song form's brightness: `base` x (1 - amount .. 1 + amount). */
export const brightCut = (base: number, n: VoiceNote, amount: number) => Math.min(18000, Math.max(60, base * (1 + amount * (n.bright * 2 - 1))));

export const clampNum = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

// ------------------------------------------------------------------------------------------------------------------
// Engine-shaped helpers: the ported Cinematic v2 and Hamster Dark Electro II v2 voices were written inside engine.ts;
// these are the engine's own functions, copied value for value, so the library renders them sample for sample.

/** The engine's tanh curve (engine.ts tanhCurve): symmetric, normalised to ±1 at full scale. */
export function tanhCurve(drive: number): Float32Array {
  const n = 1025;
  const curve = new Float32Array(n);
  const norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / norm;
  }
  return curve;
}

/** Pairwise sum (engine.ts pairSum): `chain` + `node` into a new gain (two inputs), or `node` alone. */
export function pairSum(ctx: BaseAudioContext, chain: AudioNode | null, node: AudioNode, keep: AudioNode[]): AudioNode {
  if (!chain) return node;
  const sum = ctx.createGain();
  chain.connect(sum);
  node.connect(sum);
  keep.push(sum);
  return sum;
}

/** The engine's one-shot envelope (engine.ts pulse): exponential up over `attack`, down over `release`, then 0. */
export function pulseEnv(gain: AudioParam, time: number, attack: number, peak: number, release: number) {
  const a = Math.max(0.001, attack);
  const peakSafe = Math.max(0.001, peak);
  gain.cancelScheduledValues(time);
  gain.setValueAtTime(0.0001, time);
  gain.exponentialRampToValueAtTime(peakSafe, time + a);
  gain.exponentialRampToValueAtTime(0.0001, time + a + Math.max(0.01, release));
  gain.setValueAtTime(0, time + a + Math.max(0.01, release));
}

export const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** The MIDI note of a pitch (fractional when it is between notes). */
export const midiOf = (freq: number) => 69 + 12 * Math.log2(freq / 440);

/** A pitch `semi` semitones over `freq`, computed as the engine does (midiToFreq) when `freq` is on a note. */
export function transpose(freq: number, semi: number): number {
  const m = midiOf(freq);
  const r = Math.round(m);
  return Math.abs(m - r) < 1e-6 ? midiToFreq(r + semi) : freq * 2 ** (semi / 12);
}

/** Two seeds for a three-part hash: the engine hashed (epoch, note) where the library has one seed. */
export const seedHi = (seed: number) => (seed >>> 16) & 0xffff;
export const seedLo = (seed: number) => seed & 0xffff;

/** A seeded white-noise buffer, two seconds (engine.ts makeNoise). */
export function makeNoise(ctx: BaseAudioContext, seed: number): AudioBuffer {
  const samples = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, samples, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const r = mulberry32(seed);
  for (let i = 0; i < samples; i++) data[i] = r() * 2 - 1;
  return buffer;
}

const waveCache = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();
function cachedWave(ctx: BaseAudioContext, key: string, make: () => { real: Float32Array; imag: Float32Array }): PeriodicWave {
  let m = waveCache.get(ctx);
  if (!m) waveCache.set(ctx, (m = new Map()));
  let w = m.get(key);
  if (!w) {
    const { real, imag } = make();
    w = ctx.createPeriodicWave(real, imag);
    m.set(key, w);
  }
  return w;
}

/** A sine, saw, square or triangle starting at phase `phase` / 8 of a turn (engine.ts phasedWave). */
export function phasedWave(ctx: BaseAudioContext, type: OscillatorType, phase: number): PeriodicWave {
  return cachedWave(ctx, `phased:${type}:${phase}`, () => {
    const n = type === "sine" ? 2 : 64;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    const phi = (phase / 8) * 2 * Math.PI;
    for (let k = 1; k < n; k++) {
      // Sine-series amplitudes: saw 1/k, square odd 1/k, triangle odd 1/k^2 alternating.
      const b = type === "sine" ? 1 : type === "sawtooth" ? 1 / k : type === "square" ? (k % 2 ? 1 / k : 0) : k % 2 ? ((k % 4 === 1 ? 1 : -1) / (k * k)) : 0;
      real[k] = b * Math.sin(k * phi);
      imag[k] = b * Math.cos(k * phi);
    }
    return { real, imag };
  });
}

/** A narrow pulse from its Fourier series (engine.ts pulseWave): duty 0.25 or 0.125 in the packs. */
export function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  return cachedWave(ctx, `pulse:${duty}`, () => {
    const n = 64;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return { real, imag };
  });
}

/** An oscillator wave by the packs' names: the WebAudio types plus "pulse25" / "pulse12" (narrow pulses). */
export type OscWave = OscillatorType | "pulse25" | "pulse12";
export function setWave(ctx: BaseAudioContext, osc: OscillatorNode, type: OscWave, h?: VoiceHost) {
  if (type === "pulse25" || type === "pulse12") {
    const duty = type === "pulse25" ? 0.25 : 0.125;
    osc.setPeriodicWave(h?.pulse ? h.pulse(duty) : pulseWave(ctx, duty));
  } else osc.type = type;
}

/** Sets the channel layout of a stereo node (engine.ts stereo). */
export function stereo(node: AudioNode) {
  node.channelCount = 2;
  node.channelCountMode = "explicit";
  node.channelInterpretation = "speakers";
}

/** A mono node into the host's bus without a pan law (VoiceHost.center), or centred with it when the host has none. */
export const center = (h: VoiceHost, node: AudioNode): AudioNode[] => (h.center ? h.center(node) : h.out(node, 0));

/**
 * A note's MIDI number from its pitch, snapped to the integer when it is one to 1e-9 (an equal-tempered note given as
 * Hz comes back as its exact integer, so the imported packs' MIDI-keyed caches and `hz(midi)` see the pack's own value).
 */
export function midiExact(freq: number): number {
  const m = 69 + 12 * Math.log2(freq / 440);
  const r = Math.round(m);
  return Math.abs(m - r) < 1e-9 ? r : m;
}

/** The MIDI notes a chordal voice plays for `n`: its chord over its pitch, or the pitch alone. */
export const notesOf = (n: VoiceNote): number[] => {
  const root = midiExact(n.freq);
  return n.chord && n.chord.length ? n.chord.map((s) => root + s) : [root];
};

/** Stops a source the voice started itself and frees `nodes` with it (VoiceHost.stop, else a plain stop). */
export function stopSource(h: VoiceHost, src: Source, nodes: AudioNode[], when: number) {
  if (h.stop) h.stop(src, nodes, when);
  else src.stop(when);
}
