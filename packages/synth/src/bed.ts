// Music beds (docs/sound/BEDS.md): music of an exact length with the drop on a chosen second, for short video,
// voice-over, podcasts and streams. Opt-in: nothing here changes a release, a station or the live player.
//
// A bed is not a cut of a track. Its form is planned around the target: the tempo is picked inside the style's
// range so the drop lands on a beat (a bar line when it can) exactly at `dropAt`, the bars after it end on a bar
// line followed by a ring-out (natural, button) or run to the end under a fade, and the file is exactly `seconds`
// long. The plan is a ReleasePlan, so the release renderer plays it unchanged: once with the lead, once with the
// melodic lead voices silenced (renderReleaseStems `melody: false`, opt-in), so chords and pads on the lead bus stay.
//
// Pure planning and PCM post-processing (EQ, loudness, limiter) live here; renderBed needs an OfflineAudioContext.
import { counterBars, type ReleasePlan, type ReleaseSection } from "./release.ts";
import { sectionAt } from "./arrange.ts";
import { BUS_NAMES } from "./styledata.ts";
import { stepCharacter, type StepHit } from "./clock.ts";
import { eraById, genreKey, patternIdOf, type GenreId } from "./eras.ts";
import { hash32, mulberry32 } from "./hash.ts";
import type { Program } from "./program.ts";
import { HOUSE_PROGRAM } from "./program.ts";
import type { SequencerState } from "./state.ts";
import { allStyles, styleFeel, type GenreStyle } from "./styles.ts";
import { programFor } from "./stations/index.ts";
import { planReleaseCuts, seamlessLoop, type Pcm, type ReleaseCut } from "./cuts.ts";

// ------------------------------------------------------------------ request

/**
 * How a bed ends.
 * - natural: the drums fall away for the last bars, a last chord on a bar line rings out to silence;
 * - button: full to the end, a final hit (kick, chord, impact) on a bar line rings out;
 * - fade: the music runs to the end under an equal-power fade (two bars, 2–6 s);
 * - loop: a seamless loop of exactly `seconds` (its tails folded into its start), no drop.
 */
export type BedEnding = "natural" | "button" | "fade" | "loop";

export interface BedRequest {
  /** Genre and style id, as the style lists name them (styles.ts, a station pack). */
  genre: GenreId;
  style: string;
  /** Where the style lives: a registry program key ("idm", "imd-eth", "credits", ...) or a Program. Default house. */
  program?: string | Program;
  /** Exact length, s (6/15/30/60/90/120 or any, 0.5..900). */
  seconds: number;
  /**
   * The drop: the downbeat where the full arrangement lands with an impact, s from the start. null/undefined: no
   * drop (a soft entry). 0: the drop is the first downbeat. Ignored for loops.
   */
  dropAt?: number | null;
  /** Default "natural". */
  ending?: BedEnding;
  /**
   * Voice-over arrangement: calmer grooves (no snare rolls or pickups, no glitch ornaments, no roll into the drop).
   * Both variants are rendered either way (renderBed): the mix with the lead and the lead-free speech bed.
   */
  voiceover?: boolean;
  /** Any uint32; picks the key, the motif and the grooves. Same request, same bed. Default 1. */
  seed?: number;
}

/** Loudness and peak every bed is mastered to (QA: -14 LUFS ±1, peak ≤ -1 dBFS). */
export const BED_TARGET_LUFS = -14;
/** Sample-peak ceiling of the limiter, dBFS: under -1 dBFS true peak with room for inter-sample overs. */
export const BED_CEILING_DBFS = -1.5;

/** The voice-over bed's speech pocket: a wide, gentle peaking dip centred in the 1–4 kHz band. */
export const SPEECH_DIP = { hz: 2000, q: 0.7, db: -4 } as const;

// ------------------------------------------------------------------ program and style

const programs = new Map<string, Program>();

/** The style a bed request names, from its program's lists (every list ever in force). */
export function bedStyle(genre: GenreId, style: string, program: string | Program = HOUSE_PROGRAM): { style: GenreStyle; source: Program } {
  const source = typeof program === "string" ? programFor(program) : program;
  const found = allStyles(genre, source).find((s) => s.id === style);
  if (!found) throw new Error(`bed: no style ${genre}/${style} in program ${source.key}`);
  return { style: found, source };
}

/** A one-genre, one-style program for a bed (cached per source, genre and style, as programs must be). */
export function bedProgram(genre: GenreId, style: string, program: string | Program = HOUSE_PROGRAM): Program {
  const { style: st, source } = bedStyle(genre, style, program);
  const key = `bed:${source.key}:${genre}:${style}`;
  let p = programs.get(key);
  if (!p) {
    p = { key, eras: [{ fromEpoch: 0, ids: [genre] }], styles: [{ fromEpoch: 0, styles: { [genre]: [st] } }] };
    programs.set(key, p);
  }
  return p;
}

// ------------------------------------------------------------------ timing

export interface BedTiming {
  /** Tempo, bpm (fractional: the bars land on the seconds). */
  tempo: number;
  /** The style's range it was picked from, and how far past it the solver had to go (0 = inside). */
  range: readonly [number, number];
  widened: number;
  /** Beats before the drop (0 without a drop); a partial first bar when not a multiple of 4; quarter beats (16ths) only as a last resort. */
  preBeats: number;
  /** Whole bars from the drop (or the start) to the ending's bar line. */
  postBars: number;
  /** The ending's bar line, s (natural/button: the last hit; fade: the end; loop: the loop length). */
  endTime: number;
  /** Ring-out after the last bar line, s (natural, button). */
  tail: number;
}

/** What a pickup before the drop costs, by 16ths before it: a bar line 0, half a bar, a beat, a 16th (last resort). */
const pickupCost = (steps: number) => (steps % 16 === 0 ? 0 : steps % 8 === 0 ? 0.3 : steps % 4 === 0 ? 0.6 : 1.5);

function tailWindow(ending: BedEnding, bar: number): { lo: number; hi: number; ideal: number } {
  if (ending === "button") {
    const lo = Math.min(0.5, 0.3 * bar);
    return { lo, hi: lo + 1.02 * bar, ideal: Math.max(1, Math.min(2, 0.75 * bar)) };
  }
  const lo = Math.min(0.75, 0.4 * bar);
  return { lo, hi: lo + 1.02 * bar, ideal: Math.max(1.5, Math.min(3, bar)) };
}

/**
 * The tempo and bar counts of a bed: the drop on a beat exactly at `dropAt` (bar-aligned when the range allows),
 * the end on a bar line with the ending's ring-out, the tempo as close to the middle of the style's range as that
 * allows. Widens the range (2, 4, 8, 15 %) only when nothing fits inside it.
 */
export function bedTiming(seconds: number, dropAt: number | null, ending: BedEnding, range: readonly [number, number]): BedTiming {
  const [lo0, hi0] = range;
  const centre = (lo0 + hi0) / 2;
  const span = Math.max(1, hi0 - lo0);
  for (const w of [0, 0.02, 0.04, 0.08, 0.15]) {
    const lo = Math.max(40, lo0 * (1 - w));
    const hi = Math.min(300, hi0 * (1 + w));
    let best: (BedTiming & { score: number }) | null = null;
    const consider = (t: number, preBeats: number, postBars: number, endTime: number, tail: number, extra: number) => {
      if (!(t >= lo - 1e-9 && t <= hi + 1e-9)) return;
      const score = Math.abs(t - centre) / span + extra;
      if (!best || score < best.score - 1e-12) best = { tempo: t, range, widened: w, preBeats, postBars, endTime, tail, score };
    };
    if (ending === "loop") {
      for (let L = Math.max(1, Math.ceil((seconds * lo) / 240)); L <= Math.floor((seconds * hi) / 240); L++) {
        consider((240 * L) / seconds, 0, L, seconds, 0, L % 4 === 0 ? 0 : L % 2 === 0 ? 0.3 : 0.6);
      }
    } else if (dropAt != null && dropAt > 0) {
      const rem = seconds - dropAt;
      for (let S = Math.max(1, Math.ceil((dropAt * lo) / 15 - 1e-9)); S <= Math.floor((dropAt * hi) / 15 + 1e-9); S++) {
        const t = (15 * S) / dropAt;
        const bar = 240 / t;
        const pick = pickupCost(S);
        const B = S / 4;
        if (ending === "fade") {
          consider(t, B, Math.max(1, Math.ceil(rem / bar - 1e-9)), seconds, 0, pick);
          continue;
        }
        const win = tailWindow(ending, bar);
        for (let P = 0; P * bar <= rem; P++) {
          const tail = rem - P * bar;
          if (tail < win.lo || tail > win.hi) continue;
          consider(t, B, P, dropAt + P * bar, tail, pick + (0.5 * Math.abs(tail - win.ideal)) / bar);
        }
      }
    } else {
      // No drop, or the drop on the first downbeat: the tempo is free; bar counts that land the end exactly.
      if (ending === "fade") {
        for (let P = Math.max(1, Math.ceil((seconds * lo) / 240)); P <= Math.floor((seconds * hi) / 240); P++) {
          consider((240 * P) / seconds, 0, P, seconds, 0, 0);
        }
        // Too short for a whole bar in range: one bar at the middle tempo, cut by the fade.
        if (!best && seconds < 240 / hi) consider(centre, 0, 1, seconds, 0, 0);
      } else {
        for (let P = 0; P <= Math.floor((seconds * hi) / 240); P++) {
          // For each P: the tempo whose ring-out is the ideal, clamped into the range, then the window checked.
          const ideal = (t: number) => tailWindow(ending, 240 / t).ideal;
          let t = centre;
          for (let k = 0; k < 4 && P > 0; k++) t = Math.max(lo, Math.min(hi, (240 * P) / Math.max(1e-6, seconds - ideal(t))));
          const bar = 240 / t;
          const tail = seconds - P * bar;
          const win = tailWindow(ending, bar);
          if (tail < win.lo || tail > win.hi) continue;
          consider(t, 0, P, P * bar, tail, (0.5 * Math.abs(tail - win.ideal)) / bar);
        }
      }
    }
    if (best) {
      const { score: _s, ...timing } = best as BedTiming & { score: number };
      return timing;
    }
  }
  throw new Error(`bed: no tempo fits ${seconds} s with the drop at ${dropAt} s (${ending}) in ${range[0]}..${range[1]} bpm`);
}

// ------------------------------------------------------------------ grooves

/** Exactly `k` of 16 steps, from the PRNG; `must` steps always on. */
function word(rng: () => number, k: number, must: readonly number[] = [], avoid: readonly number[] = []): number {
  let w = 0;
  for (const s of must) w |= 1 << s;
  const free = Array.from({ length: 16 }, (_, s) => s).filter((s) => !must.includes(s) && !avoid.includes(s));
  while (popcount(w) < k && free.length) {
    const i = Math.floor(rng() * free.length);
    w |= 1 << free.splice(i, 1)[0];
  }
  return w;
}

function popcount(w: number): number {
  let n = 0;
  for (let v = w >>> 0; v; v &= v - 1) n++;
  return n;
}

const range = (rng: () => number, a: number, b: number) => a + Math.floor(rng() * (b - a + 1));

interface Densities {
  kick: [number, number];
  snare: [number, number];
  hat: [number, number];
  glitch: [number, number];
  bass: [number, number];
}

const PRE: Densities = { kick: [3, 4], snare: [3, 3], hat: [5, 6], glitch: [1, 2], bass: [3, 4] };
const POST: Densities = { kick: [5, 7], snare: [5, 7], hat: [8, 11], glitch: [3, 5], bass: [4, 6] };
// Voice-over: no snare rolls (they need 4 snares), no ghosts beyond one, no glitch ornaments, steadier hats.
const PRE_VO: Densities = { kick: [3, 4], snare: [2, 2], hat: [4, 5], glitch: [0, 0], bass: [3, 4] };
const POST_VO: Densities = { kick: [4, 5], snare: [2, 3], hat: [6, 8], glitch: [0, 0], bass: [4, 5] };

function grooveState(rng: () => number, d: Densities, patternId: number, color: number, press: number): SequencerState {
  const kick = word(rng, range(rng, ...d.kick), [0]);
  const snare = word(rng, range(rng, ...d.snare), [4, 12]);
  const hat = word(rng, range(rng, ...d.hat), [2]);
  const glitch = word(rng, range(rng, ...d.glitch));
  const pattern = BigInt(kick) | (BigInt(snare) << 16n) | (BigInt(hat) << 32n) | (BigInt(glitch) << 48n);
  const onsets = word(rng, range(rng, ...d.bass), [0]);
  let bass = 0n;
  for (let s = 0; s < 16; s++) if ((onsets >> s) & 1) bass |= BigInt(1 + Math.floor(rng() * 12)) << BigInt(4 * s);
  return {
    pattern,
    bass,
    swapCount: 0,
    lastTs: 0,
    bpm: 96,
    root: 9,
    mode: 0,
    patternId,
    lastTick: Math.round(1500 * (color - 0.25)),
    pressure: Math.round(12000 * press),
    intervalEma: 600,
    releaseCount: 0,
    heat: 0,
    trackNo: 0,
  };
}

/** The bed's grooves from its seed: one before the drop, three after it (A B A C over four-bar phrases). */
export function bedStates(seed: number, patternId: number, voiceover: boolean): { pre: SequencerState; post: SequencerState[] } {
  const rng = mulberry32(hash32(seed >>> 0, 0xbed5, voiceover ? 1 : 0));
  const color = 0.35 + 0.35 * rng();
  const pre = grooveState(rng, voiceover ? PRE_VO : PRE, patternId, color, 0);
  const post = [0, 1, 2].map((k) => grooveState(rng, voiceover ? POST_VO : POST, patternId, color + 0.05 * k, 0.12 + 0.06 * k));
  return { pre, post };
}

// ------------------------------------------------------------------ form

/** One bar of a bed: its song-form bar, groove, and the steps it plays. */
export interface BedBar {
  form: number;
  state: SequencerState;
  /** First step played (a pickup bar starts late), and one past the last (a final hit plays step 0 only). */
  from: number;
  to: number;
  /** The drop's downbeat: an impact (engine trackImpact) and the drop's exact time. */
  drop?: boolean;
}

/** Full eight, full eight, breakdown four, rebuild four (its roll leads back into full); voice-over: no roll. */
function postForm(k: number, voiceover: boolean): number {
  const p = k % 24;
  const f = p < 16 ? 16 + (p % 8) : p < 20 ? 24 + (p - 16) : 28 + (p - 20);
  return voiceover && f === 31 ? 30 : f;
}

/**
 * The bars before the drop. Short: the intro's dark, filtered bars, then the roll bar (31) into the drop, so the drop
 * opens the filter and brings the drums in. Longer: an intro and a build; past 20 bars, full and a breakdown, then
 * the release's four rebuild bars (half-time, then the roll). Voice-over: the roll bar is the rebuild's bar 30.
 */
function preForms(K: number, voiceover: boolean): number[] {
  const roll = voiceover ? 30 : 31;
  if (K <= 0) return [];
  const R = K - 1;
  if (R <= 8) return [...Array.from({ length: R }, (_, i) => 8 - R + i), roll];
  if (K < 24) {
    const intro = Math.min(8, Math.ceil(R / 2));
    const build = Math.min(8, R - intro);
    return [
      ...Array.from({ length: intro }, (_, i) => 8 - intro + i),
      ...Array.from({ length: build }, (_, i) => 16 - build + i),
      ...Array.from({ length: R - intro - build }, (_, i) => 16 + (i % 8)),
      roll,
    ];
  }
  const rest = K - 16 - 4;
  const brk = rest >= 8 ? 4 : 0;
  return [
    ...Array.from({ length: 16 }, (_, i) => i),
    ...Array.from({ length: rest - brk }, (_, i) => 16 + (i % 8)),
    ...Array.from({ length: brk }, (_, i) => 24 + i),
    28,
    29,
    30,
    roll,
  ];
}

/** A loop's bars: full, then (room allowing) a breakdown, and the rebuild that leads back into its first bar. */
function loopForms(L: number, voiceover: boolean): number[] {
  const out: number[] = [];
  if (L >= 16) {
    for (let i = 0; i < L - 8; i++) out.push(16 + (i % 8));
    out.push(24, 25, 26, 27, 28, 29, 30, 31);
  } else if (L >= 8) {
    for (let i = 0; i < L - 4; i++) out.push(16 + (i % 8));
    out.push(28, 29, 30, 31);
  } else for (let i = 0; i < L; i++) out.push(16 + (i % 8));
  return voiceover ? out.map((f) => (f === 31 ? 30 : f)) : out;
}

// ------------------------------------------------------------------ plan

export interface BedPlan extends ReleasePlan {
  request: Required<Omit<BedRequest, "program" | "dropAt">> & { dropAt: number | null; program: string };
  timing: BedTiming;
  /** Per bar (in render order, pre-roll included for loops). */
  layout: BedBar[];
  /** The drop's exact second (as asked), or null. */
  drop: number | null;
  /** Loops: the loop's start and end in the render, s (the render has two bars on each side). */
  loop: { start: number; end: number } | null;
}

/** Output length of a bed in samples: exactly `seconds` at the rate. */
export const bedSamples = (seconds: number, sampleRate: number) => Math.round(seconds * sampleRate);

/** Plans a bed: deterministic, pure. renderBed renders it. */
export function planBed(req: BedRequest): BedPlan {
  const seconds = req.seconds;
  if (!(seconds >= 0.5 && seconds <= 900)) throw new Error("bed: seconds must be 0.5..900");
  const ending: BedEnding = req.ending ?? "natural";
  const voiceover = !!req.voiceover;
  const seed = (req.seed ?? 1) >>> 0;
  const dropAt = ending === "loop" || req.dropAt == null ? null : req.dropAt;
  if (dropAt != null && !(dropAt >= 0 && dropAt < seconds)) throw new Error("bed: dropAt must be inside the bed");
  const programKey = typeof req.program === "string" ? req.program : (req.program?.key ?? HOUSE_PROGRAM.key);
  const program = bedProgram(req.genre, req.style, req.program ?? HOUSE_PROGRAM);
  const era = eraById(req.genre);
  const style = program.styles[0].styles[req.genre]![0];
  const feel = styleFeel(era, style);
  const timing = bedTiming(seconds, dropAt, ending, feel.bpm);
  const { tempo } = timing;
  const dur = 15 / tempo;
  const epoch = 1 + (hash32(seed, 0xe90c) % 4000);
  const patternId = patternIdOf(epoch, program);
  const { pre, post } = bedStates(seed, patternId, voiceover);
  const postState = (k: number) => post[[0, 1, 0, 2][(k >> 2) & 3]];

  const layout: BedBar[] = [];
  let loop: BedPlan["loop"] = null;
  if (ending === "loop") {
    const L = timing.postBars;
    const forms = loopForms(L, voiceover);
    const bar = (i: number): BedBar => ({ form: forms[((i % L) + L) % L], state: postState(((i % L) + L) % L), from: 0, to: 16 });
    for (let i = -2; i < L + 2; i++) layout.push(bar(i));
    loop = { start: 2 * 16 * dur, end: (L + 2) * 16 * dur };
  } else {
    const S = Math.round(timing.preBeats * 4);
    const K = Math.ceil(S / 16);
    const pickup = S % 16;
    const hasDrop = dropAt != null;
    if (hasDrop && dropAt > 0) {
      preForms(K, voiceover).forEach((form, i) => layout.push({ form, state: pre, from: i === 0 && pickup ? 16 - pickup : 0, to: 16 }));
    }
    const P = timing.postBars;
    // No drop: a soft entry (intro, build) in the first bars, no impact; at least one bar of full stays.
    const base = hasDrop ? [] : seconds >= 20 ? [6, 7, 14, 15] : seconds >= 8 ? [7, 15] : [];
    const room = Math.max(0, P - 1);
    const entry = room > 0 ? base.slice(-Math.min(room, base.length)) : [];
    for (let k = 0; k < P; k++) {
      if (k < entry.length) {
        layout.push({ form: entry[k], state: pre, from: 0, to: 16 });
        continue;
      }
      const kk = k - entry.length;
      layout.push({ form: postForm(kk, voiceover), state: postState(kk), from: 0, to: 16, ...(hasDrop && k === 0 ? { drop: true } : {}) });
    }
    const last = postState(Math.max(0, P - entry.length));
    if (P === 0) {
      // The end's bar line is the drop (or, without a drop, the only hit): one hit that rings out.
      layout.push({ form: 16, state: last, from: 0, to: 1, ...(hasDrop || ending === "button" ? { drop: true } : {}) });
    } else if (ending === "natural") {
      // The drums fall away for the last bars (never the drop bar), then the last chord on the end's bar line.
      const n = Math.min(2, P - (hasDrop ? 1 : entry.length));
      for (let i = 0; i < n; i++) layout[layout.length - n + i].form = 24 + i;
      layout.push({ form: n > 0 ? 26 : 16, state: last, from: 0, to: 1 });
    } else if (ending === "button") {
      layout.push({ form: 16, state: last, from: 0, to: 1, drop: true });
    }
  }

  // Hits, as the release planner makes them (planAt), at the bed's one tempo.
  const formBars = layout.map((b) => b.form);
  const counter = counterBars(formBars);
  const hits: StepHit[] = [];
  const barTimes: number[] = [];
  let g = 0;
  const render = loop ? loop.end + 2 * 16 * dur : seconds;
  layout.forEach((b, i) => {
    barTimes.push(Math.max(0, (g - b.from) * dur));
    for (let step = b.from; step < b.to; step++) {
      const grid = g * dur;
      g++;
      if (grid >= render) continue;
      const character = stepCharacter(b.state.patternId, step, req.genre, epoch, program);
      const isDrop = !!b.drop && step === 0;
      let time = grid;
      if (!isDrop) {
        if (step % 2 === 1) time += (character.swing - 0.5) * dur;
        time += character.micro;
      }
      if (time < 0) time = 0;
      if (hits.length > 0 && !isDrop) time = Math.max(time, hits[hits.length - 1].time + 0.008);
      hits.push({
        gridTime: grid,
        time,
        step,
        bar: counter[i],
        duration: dur,
        tempo,
        state: b.state,
        nowSec: null,
        idle: null,
        ...(isDrop ? { trackDrop: true } : {}),
        ...character,
      });
    }
  });

  // The output fade: fade endings over their last bars; ring-outs after the hit has spoken; loops none.
  let fadeAt = render;
  if (ending === "fade") fadeAt = Math.max(0, seconds - Math.min(seconds / 3, Math.min(6, Math.max(2, 32 * dur))));
  else if (ending === "natural" || ending === "button") fadeAt = timing.endTime + 0.35 * timing.tail;

  const sections: ReleaseSection[] = [];
  layout.forEach((b, r) => {
    const name = sectionAt(b.form).name;
    const last = sections.at(-1);
    if (last && last.name === name) last.to = r + 1;
    else sections.push({ name, from: r, to: r + 1, time: barTimes[r] });
  });
  const dropIndex = layout.findIndex((b) => b.drop);
  return {
    hits,
    seconds: render,
    bars: layout.length,
    introBars: 0,
    bodyBars: layout.length,
    outroBars: 0,
    dropBar: dropIndex >= 0 ? dropIndex : null,
    dropTime: dropAt,
    fadeAt,
    pace: { slotSteps: 16, bodyBars: layout.length, swapSteps: [], swapsPerBar: 0, tempo },
    swapTimes: [],
    formBars,
    sections,
    genre: { epoch, era: req.genre, eraName: era.name, style: style.id, styleName: style.name },
    program,
    saturationBar: null,
    request: { genre: req.genre, style: req.style, program: programKey, seconds, dropAt, ending, voiceover, seed },
    timing,
    layout,
    drop: dropAt,
    loop,
  };
}

/** The key a bed plays in (pitch class 0..11, C = 0): the genre instance's tonic. */
export function bedKey(plan: BedPlan): number {
  return genreKey(eraById(plan.genre.era), plan.genre.epoch);
}

// ------------------------------------------------------------------ PCM: EQ, loudness, limiter

/** RBJ peaking EQ, in place, per channel (state from zero). */
export function peakingEq(pcm: Pcm, hz: number, q: number, db: number): Pcm {
  const sr = pcm.sampleRate;
  const A = 10 ** (db / 40);
  const w0 = (2 * Math.PI * hz) / sr;
  const alpha = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  const a0 = 1 + alpha / A;
  const b0 = (1 + alpha * A) / a0;
  const b1 = (-2 * cos) / a0;
  const b2 = (1 - alpha * A) / a0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha / A) / a0;
  return { sampleRate: sr, channels: pcm.channels.map((x) => biquad(x, b0, b1, b2, a1, a2)) };
}

function biquad(x: Float32Array, b0: number, b1: number, b2: number, a1: number, a2: number): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = xi;
    y2 = y1;
    y1 = yi;
    y[i] = yi;
  }
  return y;
}

/** Integrated loudness, LUFS (ITU-R BS.1770-4: K-weighting, 400 ms blocks at 75 % overlap, both gates). */
export function integratedLufs(pcm: Pcm): number {
  const sr = pcm.sampleRate;
  // Stage 1: the head's high shelf; stage 2: the RLB high-pass (coefficients for any rate, as libebur128).
  let f0 = 1681.974450955533;
  const G = 3.999843853973347;
  let Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / sr);
  const Vh = 10 ** (G / 20);
  const Vb = Vh ** 0.4996667741545416;
  let a0 = 1 + K / Q + K * K;
  const s1 = [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
  f0 = 38.13547087602444;
  Q = 0.5003270373238773;
  K = Math.tan((Math.PI * f0) / sr);
  a0 = 1 + K / Q + K * K;
  const s2 = [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
  const weighted = pcm.channels.map((x) => {
    const a = biquad(x, s1[0], s1[1], s1[2], s1[3], s1[4]);
    return biquad(a, s2[0], s2[1], s2[2], s2[3], s2[4]);
  });
  const n = weighted[0].length;
  const block = Math.round(0.4 * sr);
  const hop = Math.round(0.1 * sr);
  // Prefix sums of the squares per channel.
  const sums = weighted.map((w) => {
    const s = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) s[i + 1] = s[i] + w[i] * w[i];
    return s;
  });
  const z: number[] = [];
  if (n < block) {
    let tot = 0;
    for (const s of sums) tot += s[n] / Math.max(1, n);
    z.push(tot);
  } else {
    for (let start = 0; start + block <= n; start += hop) {
      let tot = 0;
      for (const s of sums) tot += (s[start + block] - s[start]) / block;
      z.push(tot);
    }
  }
  const lk = (p: number) => -0.691 + 10 * Math.log10(p);
  const abs = z.filter((p) => p > 0 && lk(p) > -70);
  if (abs.length === 0) return -Infinity;
  const rel = lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const gated = abs.filter((p) => lk(p) > rel);
  return lk(gated.reduce((a, b) => a + b, 0) / gated.length);
}

/** Lanczos (a = 4) taps for the points a quarter, a half and three quarters after a sample. */
const LANCZOS4: Float64Array[] = [0.25, 0.5, 0.75].map((f) => {
  const taps = new Float64Array(8);
  for (let j = -3; j <= 4; j++) {
    const x = f - j;
    const sinc = (v: number) => (v === 0 ? 1 : Math.sin(Math.PI * v) / (Math.PI * v));
    taps[j + 3] = sinc(x) * sinc(x / 4);
  }
  return taps;
});

/** Per sample: the largest of |x[i]| and |x| at a quarter, half and three quarters past it (4x interpolation). */
export function interPeaks(x: Float32Array): Float32Array {
  const n = x.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let p = Math.abs(x[i]);
    if (i >= 3 && i + 4 < n) {
      for (const taps of LANCZOS4) {
        let y = 0;
        for (let j = 0; j < 8; j++) y += taps[j] * x[i - 3 + j];
        p = Math.max(p, Math.abs(y));
      }
    }
    out[i] = p;
  }
  return out;
}

/** True peak estimate (4x interpolation), dBFS. */
export function truePeakDbfs(pcm: Pcm): number {
  let p = 0;
  for (const ch of pcm.channels) {
    const pk = interPeaks(ch);
    for (let i = 0; i < pk.length; i++) p = Math.max(p, pk[i]);
  }
  return p > 0 ? 20 * Math.log10(p) : -Infinity;
}

/** Largest absolute sample, dBFS. */
export function samplePeakDbfs(pcm: Pcm): number {
  let p = 0;
  for (const ch of pcm.channels) for (let i = 0; i < ch.length; i++) p = Math.max(p, Math.abs(ch[i]));
  return p > 0 ? 20 * Math.log10(p) : -Infinity;
}

/**
 * Lookahead peak limiter to `ceilingDb` (true peak: 4x interpolated): the gain each sample needs, held over the lookahead and
 * ramped in over it (so it is already down when the peak arrives), released with a one-pole curve. `cyclic`: a
 * loop, limited as if it repeated (its start sees its end), so the gain is seamless at the wrap. Returns the PCM and
 * the deepest gain reduction, dB.
 */
export function limit(pcm: Pcm, ceilingDb = BED_CEILING_DBFS, cyclic = false, lookaheadSec = 0.002, releaseSec = 0.08): { pcm: Pcm; reductionDb: number } {
  const sr = pcm.sampleRate;
  const n0 = pcm.channels[0].length;
  const src = cyclic ? pcm.channels.map((ch) => { const t = new Float32Array(3 * n0); t.set(ch, 0); t.set(ch, n0); t.set(ch, 2 * n0); return t; }) : pcm.channels;
  const n = src[0].length;
  const ceil = 10 ** (ceilingDb / 20);
  const W = Math.max(1, Math.round(lookaheadSec * sr));
  const need = new Float32Array(n);
  // Peaks between samples count (4x interpolation), so the true peak stays under the ceiling too.
  const peaks = src.map(interPeaks);
  for (let i = 0; i < n; i++) {
    let p = 0;
    for (const pk of peaks) p = Math.max(p, pk[i]);
    need[i] = p > ceil ? ceil / p : 1;
  }
  // Forward min over W (monotonic deque), then a box average over the W before: gain[i] <= need[i].
  const fmin = new Float32Array(n);
  const dq = new Int32Array(n);
  let h = 0;
  let t = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (t > h && need[dq[t - 1]] >= need[i]) t--;
    dq[t++] = i;
    while (dq[h] > i + W - 1) h++;
    fmin[i] = need[dq[h]];
  }
  const gain = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += fmin[i];
    if (i >= W) acc -= fmin[i - W];
    gain[i] = acc / Math.min(i + 1, W);
  }
  const r = 1 - Math.exp(-1 / (releaseSec * sr));
  let g = 1;
  let deepest = 1;
  for (let i = 0; i < n; i++) {
    g = Math.min(gain[i], g + (1 - g) * r);
    gain[i] = g;
  }
  const from = cyclic ? n0 : 0;
  const channels = src.map((ch) => {
    const out = new Float32Array(n0);
    for (let i = 0; i < n0; i++) {
      out[i] = ch[from + i] * gain[from + i];
    }
    return out;
  });
  for (let i = from; i < from + n0; i++) deepest = Math.min(deepest, gain[i]);
  // Float rounding: never a hair over the ceiling.
  for (const ch of channels) for (let i = 0; i < n0; i++) if (Math.abs(ch[i]) > ceil) ch[i] = Math.sign(ch[i]) * ceil;
  return { pcm: { channels, sampleRate: sr }, reductionDb: 20 * Math.log10(deepest) };
}

export interface Mastered {
  pcm: Pcm;
  /** Gain applied before the limiter, dB; the limiter's deepest reduction, dB; the result's loudness and peak. */
  gainDb: number;
  reductionDb: number;
  lufs: number;
  peakDbfs: number;
  /** True peak estimate (4x), dBFS. */
  truePeakDbfs: number;
}

/** Loudness to `target` LUFS under the ceiling: gain, limit, measure, correct the gain once, limit again. */
export function master(pcm: Pcm, cyclic = false, target = BED_TARGET_LUFS, ceilingDb = BED_CEILING_DBFS): Mastered {
  const scaled = (db: number) => ({ sampleRate: pcm.sampleRate, channels: pcm.channels.map((ch) => { const k = 10 ** (db / 20); const o = new Float32Array(ch.length); for (let i = 0; i < ch.length; i++) o[i] = ch[i] * k; return o; }) });
  let gainDb = target - integratedLufs(pcm);
  if (!Number.isFinite(gainDb)) gainDb = 0;
  let out = limit(scaled(gainDb), ceilingDb, cyclic);
  for (let k = 0; k < 2; k++) {
    const miss = target - integratedLufs(out.pcm);
    if (!Number.isFinite(miss) || Math.abs(miss) < 0.05) break;
    gainDb += miss;
    out = limit(scaled(gainDb), ceilingDb, cyclic);
  }
  return { pcm: out.pcm, gainDb, reductionDb: out.reductionDb, lufs: integratedLufs(out.pcm), peakDbfs: samplePeakDbfs(out.pcm), truePeakDbfs: truePeakDbfs(out.pcm) };
}

/** Sum of PCM parts (same length). */
export function sumPcm(parts: readonly Pcm[]): Pcm {
  const n = parts[0].channels[0].length;
  const channels = parts[0].channels.map((_, c) => {
    const out = new Float32Array(n);
    for (const p of parts) {
      const ch = p.channels[c];
      for (let i = 0; i < n; i++) out[i] += ch[i];
    }
    return out;
  });
  return { channels, sampleRate: parts[0].sampleRate };
}

/** A bed's raw render as PCM, cut to its exact length (or folded into its seamless loop). */
export function shapeBed(plan: BedPlan, pcm: Pcm): Pcm {
  if (plan.loop) {
    const beat = (60 / plan.timing.tempo);
    const looped = seamlessLoop(pcm, plan.loop.start, plan.loop.end, beat);
    // seamlessLoop rounds start and end separately: trim or pad to the exact length.
    return exact(looped, bedSamples(plan.request.seconds, pcm.sampleRate));
  }
  return exact(pcm, bedSamples(plan.request.seconds, pcm.sampleRate));
}

function exact(pcm: Pcm, n: number): Pcm {
  return {
    sampleRate: pcm.sampleRate,
    channels: pcm.channels.map((ch) => {
      if (ch.length === n) return ch;
      const out = new Float32Array(n);
      out.set(ch.subarray(0, Math.min(n, ch.length)));
      return out;
    }),
  };
}

/** Energy of (a - b) against a's, dB: how much the melody carried. */
function diffDb(a: Pcm, b: Pcm): number {
  let d = 0;
  let e = 0;
  a.channels.forEach((x, c) => {
    const y = b.channels[c];
    for (let i = 0; i < x.length; i++) {
      const r = x[i] - y[i];
      d += r * r;
      e += x[i] * x[i];
    }
  });
  return d > 0 && e > 0 ? 10 * Math.log10(d / e) : -Infinity;
}

/**
 * From a bed's two renders (the same plan, with and without the melody): the mix with the lead, and the voice-over
 * bed (the melody-free render with the speech dip), both cut to length (or looped) and mastered.
 */
export function finishBed(plan: BedPlan, mix: Pcm, noMelody: Pcm): { withLead: Mastered; voiceover: Mastered; melodyDb: number } {
  const dipped = peakingEq(noMelody, SPEECH_DIP.hz, SPEECH_DIP.q, SPEECH_DIP.db);
  const cyclic = !!plan.loop;
  return {
    withLead: master(shapeBed(plan, mix), cyclic),
    voiceover: master(shapeBed(plan, dipped), cyclic),
    melodyDb: diffDb(mix, noMelody),
  };
}

// ------------------------------------------------------------------ render (OfflineAudioContext)

/** One stem holding every bus: the stem pass only for its `melody` option (the mix is channels 0-1). */
const ONE_STEM = [{ name: "all", buses: BUS_NAMES }];

export interface BedRender {
  plan: BedPlan;
  /** The bed with its lead, exactly `seconds` long, mastered. */
  withLead: Mastered;
  /** The voice-over bed: the same plan without the melodic lead voices, the speech dip, mastered. */
  voiceover: Mastered;
  /** What the melody carried: the two renders' difference against the mix, dB (very low: little or no lead). */
  melodyDb: number;
  /** The request's own variant: voiceover ? voiceover : withLead. */
  main: Mastered;
}

/**
 * Renders a bed (browser: OfflineAudioContext): the plan twice, with and without the melody (renderReleaseStems
 * `melody: false`), sample-aligned. Same request, same bytes in a given browser.
 */
export async function renderBed(req: BedRequest, sampleRate = 44100): Promise<BedRender> {
  const { renderReleaseToBuffer, renderReleaseStems } = await import("./player.ts");
  const plan = planBed(req);
  const pcm = (b: AudioBuffer): Pcm => ({ channels: [b.getChannelData(0), b.getChannelData(1)], sampleRate: b.sampleRate });
  const lead = pcm(await renderReleaseToBuffer(plan, sampleRate));
  const bed = pcm((await renderReleaseStems(plan, sampleRate, ONE_STEM, { melody: false })).mix);
  const done = finishBed(plan, lead, bed);
  return { plan, ...done, main: plan.request.voiceover ? done.voiceover : done.withLead };
}

// ------------------------------------------------------------------ a track's voice-over bed (the loop product)

/**
 * The voice-over variant id of a track's loop or cut (cuts.ts planReleaseCuts): cut-15s -> bed-15s, loop-8bar ->
 * bed-loop-8bar. Sold as the loop product next to the cut it mirrors.
 */
export const bedCutId = (id: string): string => (id.startsWith("cut-") ? `bed-${id.slice(4)}` : `bed-${id}`);

/** A track's loops and cuts as voice-over beds: the same bars as planReleaseCuts, the bed ids. */
export function planReleaseBedCuts(...args: Parameters<typeof planReleaseCuts>): ReleaseCut[] {
  return planReleaseCuts(...args).map((c) => ({ ...c, id: bedCutId(c.id) }));
}

/**
 * A track's voice-over bed (browser): the release rendered again without its melodic lead voices (renderReleaseStems
 * `melody: false`), sample-aligned with track.wav, with the speech dip; the track's own level (no mastering), so
 * applyReleaseCut with planReleaseBedCuts gives bed-6s .. bed-60s and the bed loops next to the track's cuts.
 */
export async function renderReleaseBed(plan: ReleasePlan, sampleRate = 44100): Promise<Pcm> {
  const { renderReleaseStems } = await import("./player.ts");
  const r = await renderReleaseStems(plan, sampleRate, ONE_STEM, { melody: false });
  const pcm: Pcm = { channels: [r.mix.getChannelData(0), r.mix.getChannelData(1)], sampleRate: r.mix.sampleRate };
  return peakingEq(pcm, SPEECH_DIP.hz, SPEECH_DIP.q, SPEECH_DIP.db);
}
