import { mulberry32 } from "../../hash.ts";
import type { Source, VoiceModule } from "../types.ts";
import { biquad, brightCut, gainNode } from "../util.ts";

/**
 * Karplus-Strong plucked string, computed once per pitch into a buffer: the string shape at the pick position plus a
 * burst of seeded noise coloured by the pick (`pick` 0 dark thumb .. 1 bright plectrum) recirculates in
 * a delay line of one period whose averaging filter (`damp`) eats the highs a little more each pass, decaying to -60 dB
 * over `sustain` s. The loop length is a whole number of samples and the buffer is played back at the rate that puts
 * it exactly on pitch. A second, slightly detuned string on the other side (`double`) makes a 12-string / chorus
 * shimmer. A lowpass body and a release mute at the note's end. Guitar, harp, koto, pizzicato, upright attack.
 */
const defaults = {
  pick: 0.55,
  position: 0.18,
  damp: 0.5,
  sustain: 2.2,
  double: 0.35,
  doubleCents: 7,
  spread: 0.5,
  body: 3200,
  bright: 0.3,
  mute: 0.12,
  gain: 1,
};
export type PluckParams = typeof defaults;

const RATE_REF = 44100;

/** One string's ring at a whole-sample period `period`, `seconds` long. */
function karplus(rate: number, period: number, seconds: number, p: PluckParams, seed: number): Float32Array {
  const len = Math.max(period * 4, Math.round(rate * seconds));
  const out = new Float32Array(len);
  const rnd = mulberry32(seed);
  // The excitation: the string's shape when the pick lets go (a triangle peaking at the pick position: a strong
  // fundamental, partials falling as 1/n^2 with the position's notches), plus one period of noise coloured by the pick.
  const line = new Float32Array(period);
  const a = 0.08 + 0.9 * p.pick;
  const apex = Math.max(1, Math.min(period - 1, Math.round(period * p.position)));
  let y = 0;
  let mean = 0;
  for (let i = 0; i < period; i++) {
    y += a * (rnd() * 2 - 1 - y);
    const tri = i <= apex ? i / apex : (period - i) / (period - apex);
    line[i] = tri * (1 - 0.35 * p.pick) + y * (0.25 + 0.6 * p.pick);
    mean += line[i];
  }
  mean /= period;
  let peak = 1e-9;
  for (let i = 0; i < period; i++) {
    line[i] -= mean;
    peak = Math.max(peak, Math.abs(line[i]));
  }
  for (let i = 0; i < period; i++) line[i] /= peak;
  // The loop: each pass blends neighbours (damp 1 = the classic two-point average, darkest; 0 = no damping) and loses g.
  const g = Math.pow(10, (-3 * period) / (rate * Math.max(0.05, p.sustain)));
  const w = 0.5 + 0.5 * (1 - Math.min(1, Math.max(0, p.damp)));
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const k = i % period;
    const cur = line[k];
    const next = g * (w * cur + (1 - w) * prev);
    prev = cur;
    out[i] = cur;
    line[k] = next;
  }
  return out;
}

export const pluck: VoiceModule<PluckParams> = {
  doc: "Karplus-Strong string (pick-shape + seeded noise excitation, damped loop), exact pitch by playback rate, detuned double.",
  defaults,
  ranges: {
    pick: [0, 1], position: [0.02, 0.5], damp: [0, 1], sustain: [0.1, 8], double: [0, 1], doubleCents: [0, 30], spread: [0, 1], body: [300, 12000],
    bright: [0, 0.9], mute: [0.01, 1], gain: [0, 2],
  },
  play(h, n, p) {
    const { ctx } = h;
    const rate = ctx.sampleRate || RATE_REF;
    const period = Math.max(2, Math.round(rate / n.freq));
    const seconds = Math.min(6, Math.max(0.3, p.sustain * 1.2));
    const key = `ks:${rate}:${period}:${p.pick}:${p.position}:${p.damp}:${p.sustain}`;
    const buf = h.buffer(key, () => {
      const b = ctx.createBuffer(1, Math.max(period * 4, Math.round(rate * seconds)), rate);
      b.getChannelData(0).set(karplus(rate, period, seconds, p, period * 7919 + Math.round(p.pick * 100)));
      return b;
    });
    const sources: Source[] = [];
    const keep: AudioNode[] = [];
    const playback = n.freq / (rate / period);
    const peak = 0.13 * p.gain * (0.35 + 0.65 * n.vel);
    const hold = Math.max(0.02, n.length);
    const end = Math.min(n.time + hold + p.mute, n.time + buf.duration / playback);
    const lpHz = brightCut(p.body * (0.6 + 0.6 * n.vel), n, p.bright);
    const voices: [number, number, number][] = [[0, 1, -1]];
    if (p.double > 0) voices.push([p.doubleCents, p.double, 1]);
    for (const [cents, level, side] of voices) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.setValueAtTime(playback * Math.pow(2, cents / 1200), n.time);
      const lp = biquad(ctx, "lowpass", lpHz, 0.6);
      const amp = gainNode(ctx, 0);
      amp.gain.setValueAtTime(peak * level, n.time);
      amp.gain.setValueAtTime(peak * level, Math.max(n.time, end - p.mute));
      amp.gain.exponentialRampToValueAtTime(0.0001, end);
      amp.gain.setValueAtTime(0, end);
      src.connect(lp);
      lp.connect(amp);
      sources.push(src);
      keep.push(lp, amp, ...h.out(amp, n.pan + side * (p.double > 0 ? p.spread : 0)));
    }
    h.play(sources, keep, n.time, end + 0.03);
  },
};
