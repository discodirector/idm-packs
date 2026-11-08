import type { Source, VoiceNote } from "./types.ts";

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
