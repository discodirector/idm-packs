import { hash32 } from "./hash.ts";

/**
 * Epoch = floor(patternId / 4), from on-chain state. No contract change.
 * Era = the epoch's slot in the genre cycles of ERA_SCHEDULE (see eraOf): every genre once per cycle.
 *
 * Each era is a GENRE: one coherent sound world with its own palette, groove rules and tempo range.
 * The chain drives rhythm and timbre, not pitch: harmony is a fixed tonal centre per genre instance
 * (from the epoch hash) and a small allowed note set. See sim/genres/NOTES.md.
 */
export type GenreId =
  | "dubtechno" | "electro" | "acid" | "ambientidm" | "drone" | "liquid"
  | "futuregarage" | "triphop" | "lofihouse" | "wonky" | "ambientdub";

/** A genre with a renderer of its own (engine.ts); the others name one with Era.renders. */
export type RendererId = Exclude<GenreId, "ambientdub">;

export interface Era {
  id: GenreId;
  name: string;
  index: number;
  /** Genre tempo range. The on-chain bpm (72..118) maps linearly into it. */
  bpm: readonly [number, number];
  /** Odd-16th swing. 0.5 is straight. The grid is still 16th notes. */
  swing: number;
  microScale: number;
  ratchetEvery: number;
  stutterEvery: number;
  /** Tonic pitch classes this genre may sit on; the epoch picks one and keeps it (no key changes). */
  keys: readonly number[];
  /** Semitones above the tonic that bass/stab/melody may use. Everything else is never played. */
  notes: readonly number[];
  /** What sounds at once (at most four), for the rack and NOTES.md. */
  layers: readonly string[];
  /** Master trim so every genre lands near the same loudness under the ceiling. */
  trim: number;
  hp: number;
  // Rack labels (site ERA rack reads these names).
  bassMode: string;
  padMode: string;
  leadMode: string;
  snare: string;
  hat: string;
  /**
   * The genre whose renderer (engine.ts) plays this one, its mix, ornaments and leads; absent: its own. A genre added
   * after launch can be a new name over an existing sound (Ambient Dub over the dub techno renderer).
   */
  renders?: RendererId;
  /**
   * A new engine every epoch, even when the next epoch has the same genre (a one-genre pool still walks its styles).
   * Absent: an engine lives while its genre lasts, as ever.
   */
  eachEpoch?: boolean;
}

/** One bar — four beats — inside the spec's 1–2 bar crossfade. */
export const ERA_CROSSFADE_BARS = 1;

const ERA_LIST: readonly Era[] = [
  {
    id: "dubtechno",
    name: "Dub Techno",
    index: 0,
    bpm: [120, 126],
    swing: 0.53,
    microScale: 0.3,
    ratchetEvery: 96,
    stutterEvery: 97,
    keys: [5, 7, 9, 2], // F, G, A, D
    notes: [0, 3, 7, 10, 14],
    layers: ["round 4/4 kick, clap, swung shaker", "minor-9 chord stabs -> dub echo", "rolling sub on the chord root", "warm pad, bell, rain"],
    trim: 1.6,
    hp: 26,
    bassMode: "rolling sub",
    padMode: "m9 stabs+pad",
    leadMode: "bell fragments",
    snare: "clap",
    hat: "soft",
  },
  {
    id: "electro",
    name: "Electro",
    index: 1,
    bpm: [118, 130],
    swing: 0.52,
    microScale: 0.25,
    ratchetEvery: 64,
    stutterEvery: 71,
    keys: [9, 11, 2, 4], // A, B, D, E
    notes: [0, 7, 10, 12, 15],
    layers: ["808 breakbeat", "1-3 note bass arp", "cold sparse stabs"],
    trim: 1.25,
    hp: 30,
    bassMode: "arp 1-3",
    padMode: "none",
    leadMode: "cold stab",
    snare: "808",
    hat: "808",
  },
  {
    id: "acid",
    name: "Acid",
    index: 2,
    bpm: [120, 132],
    swing: 0.55,
    microScale: 0.3,
    ratchetEvery: 72,
    stutterEvery: 83,
    keys: [9, 10, 0, 2], // A, A#, C, D
    notes: [0, 3, 7, 10, 12],
    layers: ["dry 808 kit", "303 line (slides/accents)"],
    trim: 1.25,
    hp: 30,
    bassMode: "303",
    padMode: "none",
    leadMode: "none",
    snare: "808 clap",
    hat: "808",
  },
  {
    id: "ambientidm",
    name: "Ambient IDM",
    index: 3,
    bpm: [84, 100],
    swing: 0.58,
    microScale: 1.6,
    ratchetEvery: 128,
    stutterEvery: 127,
    keys: [2, 4, 6, 9], // D, E, F#, A
    notes: [0, 3, 5, 7, 10, 12, 15],
    layers: ["warm detuned pad (2 chords)", "lofi soft drums", "one simple melody"],
    trim: 2.3,
    hp: 24,
    bassMode: "in pad",
    padMode: "wow pad",
    leadMode: "melody",
    snare: "tape",
    hat: "soft",
  },
  {
    id: "drone",
    name: "Ambient Drone",
    index: 4,
    bpm: [60, 80],
    swing: 0.5,
    microScale: 2,
    ratchetEvery: 128,
    stutterEvery: 127,
    keys: [0, 2, 4, 5], // C, D, E, F
    notes: [0, 7, 12, 19, 24],
    layers: ["crossfading pads and tones", "breath and soft glints", "rare deep sub swell"],
    trim: 3.4,
    hp: 18,
    bassMode: "drone",
    padMode: "drone",
    leadMode: "none",
    snare: "none",
    hat: "grains",
  },
  {
    id: "liquid",
    name: "Liquid DnB",
    index: 5,
    bpm: [170, 176],
    swing: 0.51,
    microScale: 0.3,
    ratchetEvery: 64,
    stutterEvery: 79,
    keys: [2, 4, 7, 9], // D, E, G, A
    notes: [0, 3, 7, 10, 14],
    layers: ["two-step break (kick 1 + 3&, snare 2 + 4, ghosts)", "rolling sub on the chord root", "lush pad (2-chord vamp)", "warm keys"],
    trim: 1.3,
    hp: 28,
    bassMode: "rolling sub",
    padMode: "lush vamp",
    leadMode: "warm keys",
    snare: "crisp+ghost",
    hat: "shuffle",
  },
  {
    id: "futuregarage",
    name: "Future Garage",
    index: 6,
    bpm: [130, 138],
    swing: 0.58,
    microScale: 0.6,
    ratchetEvery: 96,
    stutterEvery: 89,
    keys: [1, 3, 8, 10], // C#, D#, G#, A#
    notes: [0, 3, 7, 10, 12],
    layers: ["2-step shuffle kit + crackle", "deep sub", "ghost pad", "pitched vocal chops"],
    trim: 1.4,
    hp: 26,
    bassMode: "deep sub",
    padMode: "ghost pad",
    leadMode: "vocal chops",
    snare: "clap/rim",
    hat: "shuffle",
  },
  {
    id: "triphop",
    name: "Trip-hop",
    index: 7,
    bpm: [84, 96],
    swing: 0.56,
    microScale: 0.8,
    ratchetEvery: 128,
    stutterEvery: 113,
    keys: [0, 2, 4, 7], // C, D, E, G
    notes: [0, 3, 7, 10],
    layers: ["heavy slow break", "deep bass on the chord root", "dark strings (2 chords)", "vinyl + scratches"],
    trim: 1.02,
    hp: 24,
    bassMode: "deep",
    padMode: "dark strings",
    leadMode: "none",
    snare: "fat",
    hat: "dusty",
  },
  {
    id: "lofihouse",
    name: "Lofi House",
    index: 8,
    bpm: [118, 124],
    swing: 0.56,
    microScale: 0.5,
    ratchetEvery: 128,
    stutterEvery: 101,
    keys: [0, 2, 5, 7], // C, D, F, G
    notes: [0, 3, 7, 10, 14],
    layers: ["dusty 4/4 (soft kick, clap, open hat)", "warm chord stabs (2 chords)", "round bass", "tape hiss"],
    trim: 1.45,
    hp: 28,
    bassMode: "round",
    padMode: "keys stabs",
    leadMode: "warm keys",
    snare: "clap",
    hat: "open/dusty",
  },
  {
    id: "wonky",
    name: "Wonky",
    index: 9,
    bpm: [80, 94],
    // What the rack shows. Dilla Swing plays straight on the clock and drags each voice by its own composed amount.
    swing: 0.58,
    microScale: 0.3,
    ratchetEvery: 112,
    stutterEvery: 107,
    keys: [2, 5, 7, 10], // D, F, G, A#
    notes: [0, 3, 5, 7, 10, 14],
    layers: ["drunk MPC kit (straight kick, late snare)", "chopped soul / woozy synth chords (minor 7-9)", "round 808 sub on the chord root", "vinyl"],
    trim: 1.2,
    hp: 26,
    bassMode: "808 sub",
    padMode: "soul chops",
    leadMode: "glints",
    snare: "late clap",
    hat: "drunk",
  },
  // Added 2026-11-02: the IMD/ETH station's only genre from IMD_AMBIENT_DUB_FROM (and the IDM station's for epochs
  // AMBIENT_DUB_FROM..IDM_GENRES_BACK - 1): the twenty Ambient Dub styles (styles.ts AMBIENT_DUB_STYLES), played by the
  // dub techno renderer. Dub techno's tables (keys, notes, trim, hp), its own name.
  {
    id: "ambientdub",
    name: "Ambient Dub",
    index: 10,
    bpm: [112, 130],
    swing: 0.53,
    microScale: 0.3,
    ratchetEvery: 96,
    stutterEvery: 97,
    keys: [5, 7, 9, 2], // F, G, A, D
    notes: [0, 3, 7, 10, 14],
    layers: ["soft, sparse or no kick", "dub stab -> long dark echo", "warm sliding sub", "city air in rare swells"],
    trim: 1.6,
    hp: 26,
    bassMode: "sliding sub",
    padMode: "dub stabs",
    leadMode: "far tones",
    snare: "rim",
    hat: "shaker",
    renders: "dubtechno",
    eachEpoch: true,
  },
];

export const ERAS: readonly Era[] = ERA_LIST;

/**
 * The genre order. History is frozen: the genre of a past epoch must never change once the app is live (bot posts,
 * recordings and replays name it). So:
 *   - never edit or remove an entry; to change the pool, APPEND an entry starting at a future epoch (it takes effect
 *     at the first cycle that starts on or after it);
 *   - never reorder ERA_LIST or change an `index`; new genres go at the end of ERA_LIST.
 * Epochs run in cycles of one appearance per genre. The very first cycle plays `ids` in the listed order (the
 * owner's hand-picked opening); every later cycle is a seeded shuffle of the pool that never repeats a genre or
 * makes an A-B-A across the seam. Variations inside a genre (styles, timbres, phrases) do not touch this table.
 */
/** One step of a genre schedule: from `fromEpoch` on, the cycles walk this pool. */
export interface EraScheduleEntry {
  fromEpoch: number;
  ids: readonly GenreId[];
  /**
   * Starts exactly at fromEpoch: the cycle running then is cut short there (its earlier epochs keep their genres).
   * Absent: the pool takes over at the first cycle that starts on or after fromEpoch.
   */
  cut?: boolean;
}

/**
 * The epoch the IDM station turned to Ambient Dub alone (2026-11-02: "now", not waiting for an epoch). Live then:
 * page 367, the last page of epoch 91, so the epoch already playing switched on deploy; epochs 0-90 keep their genres.
 * A mix-up: Ambient Dub was meant for the IMD/ETH station (IMD_AMBIENT_DUB_FROM). Epochs 91-92 stay Ambient Dub (track
 * #23 finished and was posted in them); the IDM station's ten genres return at IDM_GENRES_BACK.
 */
export const AMBIENT_DUB_FROM = 91;
/** The IDM station's ten launch genres again (owner, 2026-11-02), from the epoch after the one playing (92). */
export const IDM_GENRES_BACK = 93;
/**
 * The IMD/ETH station (registry "imd-eth", program.ts IMD_ETH_PROGRAM) plays Ambient Dub alone from its own epoch 11,
 * the one playing on 2026-11-02 (pages 44-47, since 2026-11-01 21:46 UTC; no IMD/ETH track finished in it). Its epochs
 * 0-10 keep the house walk.
 */
export const IMD_AMBIENT_DUB_FROM = 11;

/** The launch pool (ERA_SCHEDULE entry 0, the owner's first-cycle order). */
const LAUNCH_GENRES: readonly GenreId[] = ["liquid", "wonky", "triphop", "lofihouse", "futuregarage", "electro", "drone", "ambientidm", "dubtechno", "acid"];

export const ERA_SCHEDULE: readonly EraScheduleEntry[] = [
  { fromEpoch: 0, ids: LAUNCH_GENRES },
  { fromEpoch: AMBIENT_DUB_FROM, ids: ["ambientdub"], cut: true },
  { fromEpoch: IDM_GENRES_BACK, ids: LAUNCH_GENRES },
];

/** The IMD/ETH station's genre schedule: the house walk until IMD_AMBIENT_DUB_FROM, then Ambient Dub alone. */
export const IMD_ETH_ERA_SCHEDULE: readonly EraScheduleEntry[] = [ERA_SCHEDULE[0], { fromEpoch: IMD_AMBIENT_DUB_FROM, ids: ["ambientdub"], cut: true }];

/** Genre pool in force at `epoch` in `schedule`: the last entry that has started. */
function poolAt(epoch: number, schedule: readonly EraScheduleEntry[]): readonly Era[] {
  let ids = schedule[0].ids;
  for (const entry of schedule) if (entry.fromEpoch <= epoch) ids = entry.ids;
  return ids.map(eraById);
}

/**
 * The genre index of every epoch walked so far, per genre schedule. Keyed by the schedule array itself (not by a
 * program key): the order depends on nothing else, so two programs sharing a schedule share the walk, and a test
 * program can never read the house cache. The house walk lives under ERA_SCHEDULE.
 */
const eraOrders = new WeakMap<readonly EraScheduleEntry[], number[]>();

/**
 * A station's own epoch length (program.ts Program.epochPages): from page `from` on, an epoch every `every` pages
 * instead of 4. Pages before `from` keep their epochs, so what already played stays what it was.
 */
export interface EpochPages {
  from: number;
  every: number;
}

export function epochOf(state: { patternId: number }, program?: { readonly epochPages?: EpochPages }): number {
  const p = state.patternId >>> 0;
  const r = program?.epochPages;
  if (!r || p < r.from) return Math.floor(p / 4);
  return Math.floor(r.from / 4) + Math.floor((p - r.from) / r.every);
}

/** The first page of `epoch` (epochOf's inverse on page starts), e.g. to pin an epoch on a state. */
export function patternIdOf(epoch: number, program?: { readonly epochPages?: EpochPages }): number {
  const r = program?.epochPages;
  const base = r ? Math.floor(r.from / 4) : 0;
  if (!r || epoch < base) return epoch * 4;
  return epoch === base ? Math.floor(r.from / 4) * 4 : r.from + (epoch - base) * r.every;
}

/**
 * Deterministic era for an epoch: cycles of the pool in force, the first in schedule order, then shuffled.
 * `program` picks the genre schedule (a station plays a subset of the genres); omitted, the house program
 * (ERA_SCHEDULE). Only `program.eras` is read, so this takes any Program (program.ts) without importing it.
 * Any pool works. Three genres: the seam rule forces the same order every cycle. Two: no repeat, but A-B-A is
 * unavoidable. One: the genre repeats.
 */
export function eraOf(epoch: number, program?: { readonly eras: readonly EraScheduleEntry[] }): Era {
  const schedule = program?.eras ?? ERA_SCHEDULE;
  let eraOrder = eraOrders.get(schedule);
  if (!eraOrder) eraOrders.set(schedule, (eraOrder = []));
  const target = Number.isFinite(epoch) ? Math.max(0, Math.floor(epoch)) : 0;
  while (eraOrder.length <= target) {
    const start = eraOrder.length;
    const pool = poolAt(start, schedule).map((era) => era.index);
    const prev = start > 0 ? eraOrder[start - 1] : -1;
    const prev2 = start > 1 ? eraOrder[start - 2] : -1;
    // Across the seam: no repeat and no A-B-A. Reshuffle with the next seed until the cycle fits.
    // Pools of 10 (house) take the first branch exactly as before launch: FROZEN_SHA256 pins it. Small station pools
    // (2-3 genres) have few fitting orders (1 in 6 for three), so they get more tries, and two genres still avoid
    // the repeat (an A-B-A cannot be avoided with two).
    let cycle = pool;
    const small = pool.length < 4;
    for (let attempt = 0; start > 0; attempt++) {
      cycle = shuffledCycle(pool, start, attempt);
      if (!small && ((cycle[0] !== prev && cycle[0] !== prev2 && cycle[1] !== prev) || attempt >= 63)) break;
      if (small && (cycle.length < 2 || (cycle[0] !== prev && (cycle.length < 3 || (cycle[0] !== prev2 && cycle[1] !== prev))) || attempt >= 255)) break;
    }
    // A pool that starts mid-cycle (EraScheduleEntry.cut) ends this cycle at its first epoch.
    const cutAt = schedule.find((entry) => entry.cut && entry.fromEpoch > start && entry.fromEpoch < start + cycle.length);
    eraOrder.push(...(cutAt ? cycle.slice(0, cutAt.fromEpoch - start) : cycle));
  }
  return ERA_LIST[eraOrder[target]];
}

/** Fisher-Yates over the pool, seeded by the cycle's first epoch and the attempt. */
function shuffledCycle(pool: readonly number[], start: number, attempt: number): number[] {
  const order = [...pool];
  for (let i = order.length - 1; i > 0; i--) {
    const j = hash32(start, i, attempt, 0xe01c) % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function eraById(id: string): Era {
  const found = ERA_LIST.find((era) => era.id === id);
  if (!found) throw new Error(`unknown era ${id}`);
  return found;
}

export function eraByIndex(index: number): Era {
  return ERA_LIST[index] ?? ERA_LIST[0];
}

/** On-chain bpm range (core BPM_MIN..BPM_MAX). */
export const CHAIN_BPM: readonly [number, number] = [72, 118];

/**
 * The genre's tempo for an on-chain bpm: a linear map of 72..118 into the genre range, rounded,
 * so a fast market is still a fast track within the genre. Out-of-range input falls back to 96.
 */
export function genreTempo(era: Era, chainBpm: number, range: readonly [number, number] = era.bpm): number {
  const b = chainBpm >= 40 && chainBpm <= 300 ? chainBpm : 96;
  const u = Math.max(0, Math.min(1, (b - CHAIN_BPM[0]) / (CHAIN_BPM[1] - CHAIN_BPM[0])));
  return Math.round(range[0] + u * (range[1] - range[0]));
}

/** Tonic pitch class of a genre instance: fixed per epoch, from the epoch hash. */
export function genreKey(era: Era, epoch: number): number {
  return era.keys[hash32(epoch >>> 0, era.index, 0x70e1) % era.keys.length];
}

/** Length of the era crossfade. One bar of quarter notes at `bpm`. */
export function crossfadeSeconds(bpm: number): number {
  const b = bpm >= 40 && bpm <= 300 ? bpm : 96;
  return ERA_CROSSFADE_BARS * 4 * (60 / b);
}
