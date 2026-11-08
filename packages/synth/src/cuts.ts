// Loops and short cuts from a rendered release (or its stems): plain post-processing on PCM, no Web Audio.
// Cut the mix and every stem with the same bars and they stay aligned.
import type { ReleasePlan } from "./release.ts";

/** Planar PCM: one Float32Array per channel. */
export interface Pcm {
  channels: Float32Array[];
  sampleRate: number;
}

/** Grid seconds of every bar line of a release, bar 0 .. plan.bars (the last is the end). */
export function releaseBarTimes(plan: Pick<ReleasePlan, "hits" | "bars" | "seconds">): number[] {
  const out: number[] = [];
  for (let b = 0; b < plan.bars; b++) out.push(plan.hits[b * 16].gridTime);
  out.push(plan.seconds);
  return out;
}

/**
 * A loop of `bars` bars for the demo and the shop: the first range that fits inside one "full" section (else
 * "rebuild", else "build"), on a bar that is a multiple of `bars`, never in the intro or outro. Release bar index.
 */
export function pickLoopBar(plan: Pick<ReleasePlan, "sections" | "introBars" | "bars" | "outroBars">, bars: number): number {
  for (const name of ["full", "rebuild", "build"] as const) {
    for (const s of plan.sections) {
      if (s.name !== name) continue;
      const from = Math.ceil(s.from / bars) * bars;
      if (from + bars <= s.to) return from;
      if (s.from + bars <= s.to) return s.from;
    }
  }
  // Whatever the body holds: its first bar.
  return Math.min(plan.introBars, Math.max(0, plan.bars - plan.outroBars - bars));
}

/**
 * A seamless loop of the bars from `startSec` to `endSec` (bar lines). The body's start already carries the bar
 * before's tails; the loop's own tails ring past its end, so its first `fadeSec` crossfade (raised cosine) from the
 * track's continuation after the end into the body. Sample 0 is then the sample that follows the last one in the
 * track: no click, the end's echo and room keep ringing into the next pass.
 */
export function seamlessLoop(pcm: Pcm, startSec: number, endSec: number, fadeSec = 0.25): Pcm {
  const sr = pcm.sampleRate;
  const n = pcm.channels[0].length;
  const s = Math.round(startSec * sr);
  const e = Math.round(endSec * sr);
  const len = e - s;
  if (s < 0 || len <= 0 || e > n) throw new Error(`loop ${startSec}..${endSec} s outside the buffer`);
  const x = Math.max(0, Math.min(Math.round(fadeSec * sr), len, n - e));
  const channels = pcm.channels.map((src) => {
    const out = src.slice(s, e);
    for (let i = 0; i < x; i++) {
      const w = 0.5 - 0.5 * Math.cos((Math.PI * i) / x);
      out[i] = w * src[s + i] + (1 - w) * src[e + i];
    }
    return out;
  });
  return { channels, sampleRate: sr };
}

/**
 * A short cut of exactly `seconds` from `startSec` (a bar line): a 3 ms fade-in, then the music, faded out with an
 * equal-power curve that starts on a bar line and reaches silence at the cut's end (`fadeSec` long or the last
 * whole bars before it, at least one bar). `barSec` is the bar length at the cut's end.
 */
export function shortCut(pcm: Pcm, startSec: number, seconds: number, barSec: number, fadeSec = 2 * barSec): Pcm {
  const sr = pcm.sampleRate;
  const n = pcm.channels[0].length;
  const s = Math.round(startSec * sr);
  const len = Math.round(seconds * sr);
  if (s < 0 || s + len > n) throw new Error(`cut ${startSec} + ${seconds} s outside the buffer`);
  // The fade starts on the bar line at or before end - fadeSec.
  const bars = Math.max(1, Math.round(fadeSec / barSec));
  const fadeFrom = Math.max(0, Math.floor(seconds / barSec - bars)) * barSec;
  const f0 = Math.round(fadeFrom * sr);
  const fin = Math.round(0.003 * sr);
  const channels = pcm.channels.map((src) => {
    const out = src.slice(s, s + len);
    for (let i = 0; i < Math.min(fin, len); i++) out[i] *= i / fin;
    const span = len - f0;
    for (let i = f0; i < len; i++) out[i] *= Math.cos(((i - f0) / span) * (Math.PI / 2));
    return out;
  });
  return { channels, sampleRate: sr };
}

/** The shop's seamless loops, in bars, and short cuts, in seconds (docs/X402-MUSIC.md section 3). */
export const LOOP_BARS: readonly number[] = [4, 8, 16];
export const CUT_SECONDS: readonly number[] = [6, 15, 30, 60];

/** One loop or cut of a release: where it sits and how long it is. applyReleaseCut makes its audio. */
export interface ReleaseCut {
  /** Shop id: "loop-8bar", "cut-15s". */
  id: string;
  kind: "loop" | "cut";
  /** Loops: their bars; cuts: null. */
  bars: number | null;
  /** The release bar it starts on. */
  bar: number;
  /** Start in the release, s (a bar line). */
  start: number;
  /** Exact length, s. */
  seconds: number;
  /** Loops: the crossfade that folds the tails in; cuts: the fade-out's target length. Both s. */
  fade: number;
  /** Cuts: the bar length at the cut's end, s. */
  barSec: number;
}

/**
 * The shop's loops and cuts of a release, in a fixed order. Loops: pickLoopBar's bars, the tails folded in over a
 * beat. Cuts: from the 16-bar loop's bar (the body's start, else the release's start, when that does not fit before
 * the outro fade), with a natural ending (a bar's fade for cuts under 8 s, else two bars). A length that does not
 * fit the release is left out. Same plan, same cuts.
 */
export function planReleaseCuts(
  plan: Pick<ReleasePlan, "hits" | "bars" | "seconds" | "sections" | "introBars" | "outroBars" | "fadeAt">,
  loopBars: readonly number[] = LOOP_BARS,
  cutSeconds: readonly number[] = CUT_SECONDS,
): ReleaseCut[] {
  const times = releaseBarTimes(plan);
  const barLen = (b: number) => times[Math.min(b + 1, plan.bars)] - times[Math.min(b, plan.bars - 1)];
  const barAtSec = (t: number) => {
    let b = 0;
    while (b + 1 < plan.bars && times[b + 1] <= t) b++;
    return b;
  };
  const out: ReleaseCut[] = [];
  for (const n of loopBars) {
    if (n < 1 || n > plan.bars) continue;
    const bar = pickLoopBar(plan, n);
    if (bar < 0 || bar + n > plan.bars) continue;
    const start = times[bar];
    out.push({ id: `loop-${n}bar`, kind: "loop", bars: n, bar, start, seconds: times[bar + n] - start, fade: barLen(bar) / 4, barSec: barLen(bar) });
  }
  const from = [...new Set([pickLoopBar(plan, Math.min(16, plan.bars)), plan.introBars, 0])].filter((b) => b >= 0 && b < plan.bars);
  for (const sec of cutSeconds) {
    const bar = from.find((b) => times[b] + sec <= plan.fadeAt) ?? from.find((b) => times[b] + sec <= plan.seconds);
    if (bar === undefined) continue;
    const start = times[bar];
    const barSec = barLen(barAtSec(start + sec - 1e-6));
    out.push({ id: `cut-${sec}s`, kind: "cut", bars: null, bar, start, seconds: sec, fade: sec < 8 ? barSec : 2 * barSec, barSec });
  }
  return out;
}

/** A planned loop or cut of a release's PCM (the mix or any stem: the same bars). */
export function applyReleaseCut(pcm: Pcm, cut: ReleaseCut): Pcm {
  return cut.kind === "loop"
    ? seamlessLoop(pcm, cut.start, cut.start + cut.seconds, cut.fade)
    : shortCut(pcm, cut.start, cut.seconds, cut.barSec, cut.fade);
}

/** Root-mean-square over every channel. */
export function rms(pcm: Pcm): number {
  let sum = 0;
  let count = 0;
  for (const ch of pcm.channels) {
    for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
    count += ch.length;
  }
  return Math.sqrt(sum / Math.max(1, count));
}

/** Null test: (sum of the parts) - whole, as RMS and peak in dB relative to the whole's RMS and peak. */
export function nullTest(whole: Pcm, parts: readonly Pcm[]): { residualRmsDb: number; residualPeakDb: number; residualPeakDbfs: number } {
  let sq = 0;
  let wsq = 0;
  let peak = 0;
  let wpeak = 0;
  let count = 0;
  whole.channels.forEach((w, c) => {
    for (let i = 0; i < w.length; i++) {
      let sum = 0;
      for (const p of parts) sum += p.channels[c][i];
      const d = sum - w[i];
      sq += d * d;
      wsq += w[i] * w[i];
      peak = Math.max(peak, Math.abs(d));
      wpeak = Math.max(wpeak, Math.abs(w[i]));
    }
    count += w.length;
  });
  const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  return {
    residualRmsDb: db(Math.sqrt(sq / count)) - db(Math.sqrt(wsq / count)),
    residualPeakDb: db(peak) - db(wpeak),
    residualPeakDbfs: db(peak),
  };
}

/** The jump at a loop's wrap (last sample to the first) against the loop's largest sample-to-sample step. */
export function wrapJump(pcm: Pcm): { wrap: number; maxStep: number } {
  let wrap = 0;
  let maxStep = 0;
  for (const ch of pcm.channels) {
    wrap = Math.max(wrap, Math.abs(ch[0] - ch[ch.length - 1]));
    for (let i = 1; i < ch.length; i++) maxStep = Math.max(maxStep, Math.abs(ch[i] - ch[i - 1]));
  }
  return { wrap, maxStep };
}
