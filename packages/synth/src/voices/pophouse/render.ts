/**
 * Offline-rendered one-shots for the voice library: plain-JS DSP (oscillator banks, biquads, delay lines) written into
 * an AudioBuffer once per (context, key) and replayed by AudioBufferSourceNodes. This is how the library gets
 * per-partial envelopes, Karplus-Strong strings and four-formant voices without hundreds of nodes per note, and
 * without samples: every buffer is computed here from numbers, seeded, identical on every run.
 */
import { mulberry32 } from "../../hash.ts";

const caches = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
/** Buffers kept per context; the oldest is let go past this (a live page keeps memory flat). */
const LIMIT = 240;

/** The buffer for `key` in `ctx`, rendered by `make` (channels of Float32Array at the context's rate) on first use. */
export function cached(ctx: BaseAudioContext, key: string, make: (sr: number) => Float32Array[]): AudioBuffer {
  let map = caches.get(ctx);
  if (!map) caches.set(ctx, (map = new Map()));
  const hit = map.get(key);
  if (hit) return hit;
  const chans = make(ctx.sampleRate);
  const buf = ctx.createBuffer(chans.length, chans[0].length, ctx.sampleRate);
  chans.forEach((d, i) => buf.getChannelData(i).set(d));
  map.set(key, buf);
  if (map.size > LIMIT) {
    const first = map.keys().next().value;
    if (first !== undefined) map.delete(first);
  }
  return buf;
}

export { mulberry32 };

/** A direct-form biquad in JS (RBJ cookbook), for offline one-shots. */
export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  constructor(
    private readonly sr: number,
    type: "lp" | "hp" | "bp" | "peak",
    freq: number,
    q: number,
    db = 0,
  ) {
    this.set(type, freq, q, db);
  }
  set(type: "lp" | "hp" | "bp" | "peak", freq: number, q: number, db = 0) {
    const w = (2 * Math.PI * Math.min(freq, this.sr * 0.45)) / this.sr;
    const cw = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
    if (type === "lp") [b0, b1, b2, a0, a1, a2] = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2, 1 + alpha, -2 * cw, 1 - alpha];
    else if (type === "hp") [b0, b1, b2, a0, a1, a2] = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2, 1 + alpha, -2 * cw, 1 - alpha];
    else if (type === "bp") [b0, b1, b2, a0, a1, a2] = [alpha, 0, -alpha, 1 + alpha, -2 * cw, 1 - alpha];
    else {
      const A = 10 ** (db / 40);
      [b0, b1, b2, a0, a1, a2] = [1 + alpha * A, -2 * cw, 1 - alpha * A, 1 + alpha / A, -2 * cw, 1 - alpha / A];
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }
  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** Fades the last `ms` of each channel to exactly 0 and normalises the loudest channel's peak to `peak`. */
export function finish(chans: Float32Array[], sr: number, peak = 0.9, ms = 8): Float32Array[] {
  const n = chans[0].length;
  const fade = Math.min(n, Math.round((sr * ms) / 1000));
  let max = 1e-9;
  for (const d of chans) {
    for (let i = 0; i < fade; i++) d[n - 1 - i] *= i / fade;
    d[n - 1] = 0;
    for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(d[i]));
  }
  const k = peak / max;
  for (const d of chans) for (let i = 0; i < n; i++) d[i] *= k;
  return chans;
}
