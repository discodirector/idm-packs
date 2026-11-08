import type { EraScheduleEntry } from "./eras.ts";
import { LEAD_PATCHES, type LeadPatch } from "./leads.ts";
import type { Program } from "./program.ts";
import { BUS_NAMES, DATA_FIELDS, DATA_GENRES, type DataGenre, type GenreDataMap } from "./styledata.ts";
import { AMBIENT_KIT_PARTS } from "./styledata.ts";
import { LIQUID_VOICE_KINDS } from "./voices/dnb/index.ts";
import { STYLE_SCHEDULE, type GenreStyle, type StyleScheduleEntry } from "./styles.ts";
import { VOICE_KINDS, VOICES } from "./voices/hiphop/index.ts";
import { V2_PRESETS, V2_VOICE_NAMES } from "./v2/presets.ts";
import { libraryVoice, voiceLibraryLoaded } from "./voices/registry.ts";

/**
 * Style packs: a station's sound as one data-only file, `stations/<key>.ts` (docs/STATIONS.md "Style pack",
 * stations/README.md). A pack names 1 or more of the opened genres (styledata.ts DATA_GENRES) and 1..10 styles for each;
 * every style is a variant of a house style (`base`) with its own id, feel and table overrides (`data`).
 * validatePack checks the whole contract; programFromPack turns a valid pack into the station's Program.
 */

/** The house styles each opened genre's styles may name as `base` (the renderers in engine.ts). */
export interface PackBases {
  liquid: "classic" | "atmos" | "soulful";
  futuregarage: "classic" | "dark" | "atmos";
  triphop: "classic" | "bristol" | "cinematic";
  lofihouse: "classic" | "chop" | "rave";
  acid: "classic" | "acidhouse" | "rubber";
  dubtechno: "classic" | "ixtlan" | "moment";
  electro: "classic" | "client03" | "alienrave";
  ambientidm: "classic" | "boc" | "crystal";
  drone: "classic" | "dark" | "pulse";
}

/**
 * A station style of genre G. Fields left out are inherited from the base style (bpm, swing, microScale, trim,
 * leads); `data` tables left out keep the house tables. So `{ id, name, base }` alone plays exactly like the base.
 */
export interface StationStyle<G extends DataGenre = DataGenre> extends Omit<GenreStyle, "base" | "data"> {
  base: PackBases[G];
  data?: GenreDataMap[G];
}

export interface StationPack {
  /** The station key (registry `program`): lowercase letters, digits and "-", 2..24 characters. */
  key: string;
  /** Display name of the sound, 1..40 characters. */
  name: string;
  /**
   * 1 or more distinct opened genres; the first cycle plays them in this order, later cycles shuffle them. One genre
   * plays every epoch (its styles still walk in order).
   */
  genres: readonly DataGenre[];
  /** For each genre in `genres` (and no other), 1..10 styles, in play order. */
  styles: { readonly [G in DataGenre]?: readonly StationStyle<G>[] };
  /**
   * The pack's own lead patches (the LeadPatch shape of leads.ts, without `id`), by id: 1..8 of them, ids like style
   * ids and not a house patch id. A style's `leads` may name them next to the house patches. Same field ranges as
   * the house patches (PATCH_CHECK).
   */
  patches?: Readonly<Record<string, PackLeadPatch>>;
  /**
   * From page `from` on, a new epoch (genre and style) every `every` pages (1..4) instead of 4: a station whose source
   * is slow (a hamster's night is ~4 pages) still moves on. Pages before `from` keep their epochs (eras.ts epochOf).
   */
  epochPages?: { from: number; every: number };
  /**
   * Appended schedule entries (a live station's music changes from a future epoch; its past is frozen): from each
   * entry's `fromEpoch` (increasing, > 0) the station plays `genres` (cut in exactly there: the cycle running then ends
   * at it) and `styles` (1..16 per genre, walked in order from that epoch), whose `leads` may name the pack's
   * `patches` and the entry's own (1..16). A style or patch id already defined may be listed again only as the same
   * definition. Epochs before the first entry keep `genres` / `styles`.
   */
  next?: readonly StationPackEntry[];
}

/** A `next` entry of a pack (StationPack.next). */
export interface StationPackEntry {
  fromEpoch: number;
  genres: readonly DataGenre[];
  styles: { readonly [G in DataGenre]?: readonly StationStyle<G>[] };
  patches?: Readonly<Record<string, PackLeadPatch>>;
}

/** A lead patch written in a pack: leads.ts LeadPatch, its id being its key in `patches`. */
export type PackLeadPatch = Omit<LeadPatch, "id">;

/** Station keys the house programs use. */
const HOUSE_KEYS = ["idm", "imd-eth"];

/** Every style id the house schedules ever defined, in any genre: a station id must not reuse one. */
const HOUSE_STYLE_IDS: ReadonlySet<string> = new Set(
  STYLE_SCHEDULE.flatMap((entry) => Object.values(entry.styles).flatMap((list) => (list ?? []).map((s) => s.id))),
);

/** Tempo window a station style's `bpm` range must sit in, per genre (around the house range). */
const PACK_BPM: Record<DataGenre, readonly [number, number]> = {
  liquid: [160, 180],
  futuregarage: [120, 145],
  triphop: [66, 104],
  lofihouse: [112, 132],
  acid: [108, 140],
  dubtechno: [112, 130],
  electro: [110, 140],
  ambientidm: [70, 124],
  drone: [40, 100],
};

// ---------------------------------------------------------------------------------------------- checks

type Err = (msg: string) => void;
type Check = (x: unknown, path: string, err: Err) => void;

const show = (x: unknown) => {
  try {
    const s = JSON.stringify(x);
    return s === undefined ? String(x) : s.length > 60 ? `${s.slice(0, 57)}...` : s;
  } catch {
    return String(x);
  }
};
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

const num =
  (lo: number, hi: number, int = false): Check =>
  (x, p, e) => {
    if (typeof x !== "number" || !Number.isFinite(x) || (int && !Number.isInteger(x)) || x < lo || x > hi) {
      e(`${p}: expected ${int ? "an integer" : "a number"} in ${lo}..${hi}, got ${show(x)}`);
    }
  };
const int = (lo: number, hi: number) => num(lo, hi, true);
const bool: Check = (x, p, e) => {
  if (typeof x !== "boolean") e(`${p}: expected true or false, got ${show(x)}`);
};
const oneOf =
  (values: readonly unknown[]): Check =>
  (x, p, e) => {
    if (!values.includes(x)) e(`${p}: expected one of ${values.map(show).join(", ")}, got ${show(x)}`);
  };
const list =
  (min: number, max: number, each: Check): Check =>
  (x, p, e) => {
    if (!Array.isArray(x)) return e(`${p}: expected a list, got ${show(x)}`);
    if (x.length < min || x.length > max) e(`${p}: expected ${min === max ? min : `${min}..${max}`} entries, got ${x.length}`);
    x.forEach((v, i) => each(v, `${p}[${i}]`, e));
  };
/** An object with exactly these fields; names in `optional` may be left out. */
const shape =
  (fields: Record<string, Check>, optional: readonly string[] = []): Check =>
  (x, p, e) => {
    if (!isObj(x)) return e(`${p}: expected an object, got ${show(x)}`);
    for (const k of Object.keys(x)) if (!(k in fields)) e(`${p}.${k}: unknown field (allowed: ${Object.keys(fields).join(", ")})`);
    for (const [k, check] of Object.entries(fields)) {
      if (x[k] === undefined) {
        if (!optional.includes(k)) e(`${p}.${k}: missing`);
      } else check(x[k], `${p}.${k}`, e);
    }
  };
const both =
  (...checks: Check[]): Check =>
  (x, p, e) => {
    for (const check of checks) check(x, p, e);
  };
/** A fixed-length list: one check per position. */
const tuple =
  (...checks: Check[]): Check =>
  (x, p, e) => {
    if (!Array.isArray(x) || x.length !== checks.length) return e(`${p}: expected [${checks.length} values], got ${show(x)}`);
    checks.forEach((check, i) => check(x[i], `${p}[${i}]`, e));
  };
/** A break lane of two bars (32) or four (64; a kit with breakBars 4, crossCheck). */
const lanes: Check = (x, p, e) => (typeof x === "string" && x.length === 64 ? lane(64)(x, p, e) : lane(32)(x, p, e));
const lanesOrEmpty: Check = (x, p, e) => (typeof x === "string" && x.length === 64 ? lane(64)(x, p, e) : lane(32, true)(x, p, e));
/** A drum lane: `len` characters of "." (rest) or 1-9 (velocity in ninths); `empty` also allows "". */
const lane =
  (len: number, empty = false): Check =>
  (x, p, e) => {
    if (typeof x !== "string" || !/^[.1-9]*$/.test(x) || !(x.length === len || (empty && x.length === 0))) {
      e(`${p}: expected ${len} characters of "." or 1-9${empty ? ' (or "")' : ""}, got ${show(x)}`);
    }
  };

/** A hat lane (MachineSpec.hats): "." a rest, 1-9 a closed hat, a-i an open one. */
const hatLane =
  (len: number): Check =>
  (x, p, e) => {
    if (typeof x !== "string" || !/^[.1-9a-i]*$/.test(x) || x.length !== len) e(`${p}: expected ${len} characters of "." 1-9 or a-i, got ${show(x)}`);
  };

/** A step note on a grid of `steps` 16ths, plus extra fields. */
const note = (steps: number, extra: Record<string, Check> = {}, optional: readonly string[] = []) =>
  shape({ s: int(0, steps - 1), len: num(0.25, 64), ...extra }, optional);
const coreNote = (steps: number, extra: Record<string, Check> = {}) => note(steps, { core: bool, ...extra });
/** A table of 1..6 figures, each of `min..max` notes. */
const figures = (min: number, max: number, each: Check) => list(1, 6, list(min, max, each));
/** A pad chord: 2..6 tones -12..26, at least two of them in 0..12 (the voices that take the top tones), root -12..12. */
const padChord: Check = both(shape({ pad: list(2, 6, int(-12, 26)), root: int(-12, 12) }), (x, p, e) => {
  const pad = isObj(x) && Array.isArray(x.pad) ? x.pad : [];
  if (pad.filter((t) => typeof t === "number" && t >= 0 && t <= 12).length < 2) e(`${p}.pad: needs at least two tones in 0..12`);
});
const vamps = list(1, 6, shape({ a: padChord, b: padChord }));
const kickFigures = shape({
  lo: list(1, 4, list(1, 6, int(0, 15))),
  mid: list(1, 4, list(1, 6, int(0, 15))),
  hi: list(1, 4, list(1, 6, int(0, 15))),
});
const kickSpec = shape(
  {
    osc: oneOf(["sine", "triangle", "square", "sawtooth"]),
    start: num(40, 250),
    end: num(30, 120),
    sweep: num(0.005, 0.2),
    decay: num(0.05, 1),
    click: num(0, 1),
    clickHp: num(500, 8000),
    drive: num(0, 4),
    body: num(0, 1.5),
    punch: shape({ freq: num(60, 400), decay: num(0.01, 0.12), level: num(0, 1) }),
  },
  ["osc", "clickHp", "drive", "body", "punch"],
);
// Sound fields (styledata.ts "sound"): every number bounded, so a pack can colour the sound but never break it.
const hatFields = { hp: num(1000, 14000), decay: num(0.005, 1), metal: num(0, 1), q: num(0.3, 4), level: num(0, 1.5), off: num(0, 1.5), crush: int(3, 8) };
const hat = shape(hatFields, ["q", "off", "crush"]);
const liquidHat = shape({ ...hatFields, pan: num(-1, 1) }, ["q", "off", "crush"]);
const waves = ["sine", "triangle", "square", "sawtooth"] as const;
/** Future garage mention voices (styledata.ts GarageMentionVoice). */
const garageVoices = ["reverse", "foley", "groove", "yeah"] as const;
/** Liquid mention voices (styledata.ts LiquidMentionVoice). */
const liquidVoices = ["nature", "amen", "keys"] as const;
/** A list without repeats. */
const distinct: Check = (x, p, e) => {
  if (Array.isArray(x) && new Set(x).size !== x.length) e(`${p}: expected each entry once, got ${show(x)}`);
};
const layerCommon = { level: num(0, 1.5), at: num(0, 0.08), tail: bool, pan: num(-1, 1), flip: bool, accent: bool };
const layerOptional = ["at", "tail", "pan", "flip", "accent"];
const toneLayer = shape(
  { tone: oneOf(waves), freq: num(30, 4000), to: num(20, 4000), sweep: num(0.005, 1), decay: num(0.005, 2), attack: num(0.001, 0.5), floor: num(0, 0.2), ...layerCommon },
  ["to", "sweep", "attack", "floor", ...layerOptional],
);
const noiseLayer = shape(
  {
    noise: oneOf(["bandpass", "highpass", "lowpass"]), freq: num(100, 16000), to: num(50, 16000), q: num(0.3, 12), decay: num(0.005, 3),
    attack: num(0, 2), color: num(0, 4000), press: num(0, 0.5), ...layerCommon,
  },
  ["to", "attack", "color", "press", ...layerOptional],
);
const crushLayer = shape(
  { crush: int(3, 8), filter: oneOf(["bandpass", "highpass"]), freq: num(200, 12000), q: num(0.3, 4), decay: num(0.005, 1), level: num(0, 1.5), at: num(0, 0.08), tail: bool, lp: num(1000, 16000) },
  ["q", "at", "tail", "lp"],
);
const clapLayer = shape({ clap: num(0, 1.5), at: num(0, 0.08), flip: bool }, ["at", "flip"]);
/** A drum layer: its kind is the field it has (tone, noise, crush or clap). */
const drumLayer: Check = (x, p, e) => {
  if (!isObj(x)) return e(`${p}: expected a drum layer { tone | noise | crush | clap, ... }, got ${show(x)}`);
  if ("tone" in x) toneLayer(x, p, e);
  else if ("noise" in x) noiseLayer(x, p, e);
  else if ("crush" in x) crushLayer(x, p, e);
  else if ("clap" in x) clapLayer(x, p, e);
  else e(`${p}: a drum layer needs one of tone, noise, crush, clap`);
};
const drumVoice = list(1, 6, drumLayer);
const shaker = shape(
  { freq: num(2000, 14000), color: num(0, 4000), q: num(0.3, 6), decay: num(0.005, 0.3), offDecay: num(0.005, 0.3), attack: num(0, 0.05), level: num(0, 1), off: num(0, 1) },
  ["color", "offDecay", "off"],
);
/** Every field optional: a spec is merged over the base's. */
const partial = (fields: Record<string, Check>) => shape(fields, Object.keys(fields));

/**
 * A library voice (styledata.ts ElectroData.library, voices/types.ts LibraryVoiceRef): a catalog id, a preset it has,
 * overrides of fields its params have (numbers within the voice's ranges where it gives them), a velocity scale 0..2
 * and a register shift -24..24.
 */
const libraryRef: Check = both(
  shape(
    {
      voice: (x, p, e) => {
        if (!voiceLibraryLoaded()) e(`${p}: the voice library is not loaded (a pack naming library voices imports voices/catalog.ts)`);
        else if (typeof x !== "string" || !libraryVoice(x)) e(`${p}: unknown library voice ${show(x)}`);
      },
      preset: (x, p, e) => {
        if (typeof x !== "string") e(`${p}: expected a preset name, got ${show(x)}`);
      },
      params: (x, p, e) => {
        if (!isObj(x)) e(`${p}: expected an object, got ${show(x)}`);
      },
      level: num(0, 2),
      octave: int(-24, 24),
    },
    ["preset", "params", "level", "octave"],
  ),
  (x, p, e) => {
    if (!isObj(x) || typeof x.voice !== "string") return;
    const v = libraryVoice(x.voice);
    if (!v) return;
    if (typeof x.preset === "string" && !(x.preset in v.presets)) e(`${p}.preset: "${x.preset}" is not a preset of ${v.id}`);
    if (!isObj(x.params)) return;
    const known = new Set([...Object.keys(v.defaults), ...Object.values(v.presets).flatMap((pr) => Object.keys(pr))]);
    for (const [k, val] of Object.entries(x.params)) {
      if (!known.has(k)) e(`${p}.params.${k}: not a parameter of ${v.id}`);
      const range = (v.ranges as Record<string, readonly [number, number]> | undefined)?.[k];
      if (range) num(range[0], range[1])(val, `${p}.params.${k}`, e);
    }
  },
);
const subSpec = partial({ wave: oneOf(["sine", "triangle"]), attack: num(0.002, 0.1), hold: num(0.3, 1), drive: num(0, 4), octave: num(0, 0.5) });
const padSpec = partial({
  osc: list(1, 4, shape({ type: oneOf(waves), detune: num(-40, 40), level: num(0, 1) })),
  cutoff: num(150, 8000), q: num(0.3, 6), attack: num(0.003, 8), release: num(0.02, 6), level: num(0.005, 1), vib: num(0, 30),
  drive: num(0.1, 4), noise: num(0, 1), hp: num(20, 1000),
});
/** A bus compressor (styledata.ts GlueData). */
const glueData = shape({ thresh: num(0.02, 1), ratio: num(1, 10), speed: num(2, 60), makeup: num(0.5, 4) });
const busLevels = (lo: number, hi: number) => partial(Object.fromEntries(BUS_NAMES.map((b) => [b, num(lo, hi)])));

// Machine Electro's full arrangement (styledata.ts MachineSpec, voices/): every number bounded.
const mpair = (lo: number, hi: number) => tuple(num(lo, hi), num(lo, hi));
const vwave = oneOf(["saw", "square", "pulse25", "pulse12", "triangle", "sine"]);
const unisonSpec = shape(
  {
    voices: int(1, 9), detune: num(0, 60), width: num(0, 1), wave: vwave, sub: num(0, 1), top: num(0, 1),
    cutoff: num(80, 12000), env: num(0, 12000), decay: num(0.005, 4), q: num(0.3, 14), keytrack: num(0, 1),
    attack: num(0.001, 4), dec: num(0.005, 4), sustain: num(0, 1), release: num(0.01, 6), drive: num(0, 6), scoop: num(0, 3),
    vib: shape({ rate: num(0.1, 12), depth: num(0, 40), delay: num(0, 4) }), level: num(0, 1),
  },
  ["wave", "sub", "top", "keytrack", "drive", "scoop", "vib"],
);
const stringSpec = shape(
  {
    octave: num(0, 1), detune: num(0, 20), slow: tuple(num(0.05, 3), num(0, 30)), fast: tuple(num(1, 12), num(0, 12)), width: num(0, 1),
    cutoff: num(300, 12000), q: num(0.3, 6), hp: num(30, 1500), attack: num(0.005, 6), release: num(0.02, 8), level: num(0, 1),
  },
  ["octave"],
);
const fmSpec = shape(
  {
    ops: list(1, 3, shape({ ratio: num(0.25, 16), index: num(0, 12), decay: num(0.005, 6), floor: num(0, 1) }, ["floor"])),
    detune: num(0, 20), width: num(0, 1), attack: num(0.001, 4), dec: num(0.005, 6), sustain: num(0, 1), release: num(0.01, 6), level: num(0, 1),
  },
);
const vowel = tuple(num(150, 1200), num(500, 3500), num(1500, 4500));
const choirSpec = shape(
  { detune: num(0, 20), width: num(0, 1), q: num(1, 20), breath: num(0, 1), ring: num(0, 4), attack: num(0.005, 4), release: num(0.02, 6), level: num(0, 1) },
  ["ring"],
);
const bleepSpec = shape({ wave: vwave, ring: num(0, 8), lp: num(300, 14000), decay: num(0.01, 2), sonar: num(0, 1), level: num(0, 0.6) }, ["sonar"]);
const formMask = lane(32);
/** A figure of `bars` bars: every onset inside it. */
const figureIn = (key: string): Check => (x, p, e) => {
  if (!isObj(x) || typeof x.bars !== "number" || !Array.isArray(x[key])) return;
  for (const [i, n] of (x[key] as unknown[]).entries()) {
    if (isObj(n) && typeof n.s === "number" && n.s >= 16 * x.bars) e(`${p}.${key}[${i}].s: onset ${n.s} past the ${x.bars}-bar figure`);
  }
};
const figBars = oneOf([1, 2, 4, 8]);
const machineNote = shape({ s: int(0, 127), len: num(0.25, 64), n: int(-8, 16), x: int(-12, 12) }, ["x"]);
const machineSpec = partial({
  kick: partial({
    knock: shape({ freq: num(40, 600), to: num(30, 400), decay: num(0.01, 0.5), level: num(0, 1) }),
    click: shape({ freq: num(500, 10000), decay: num(0.002, 0.05), level: num(0, 1) }),
    boom: shape({ freq: num(28, 90), glide: num(1, 4), decay: num(0.05, 2), drive: num(0, 6), level: num(0, 1) }),
  }),
  snare: partial({
    body: shape({ freqs: list(1, 3, num(80, 1200)), decay: num(0.01, 0.5), level: num(0, 1) }),
    snap: shape({ hp: num(500, 12000), decay: num(0.005, 0.6), level: num(0, 1.2) }),
    clap: shape({ bp: num(400, 5000), q: num(0.3, 6), gap: num(0.003, 0.03), decay: num(0.02, 0.8), width: num(0, 1), level: num(0, 1.2) }),
    air: shape({ hp: num(3000, 15000), decay: num(0.02, 1.5), level: num(0, 0.6) }),
  }),
  bass: shape({
    sub: num(0, 2), subWave: oneOf(["sine", "triangle"]),
    osc: list(1, 4, shape({ wave: vwave, detune: num(-40, 40), level: num(0, 1) })),
    cutoff: num(60, 2000), open: mpair(1, 16), decay: mpair(0.01, 1), q: mpair(0.3, 16), sweep: num(0, 2000), drive: num(0.5, 6), hp: num(20, 400),
    grit: num(0, 1), gritHz: num(300, 5000), mid: num(0, 2), level: num(0.02, 0.4), glide: num(0.001, 0.3), knob: num(1, 64),
  }, ["subWave"]),
  strings: shape({ voice: stringSpec, floor: int(24, 84), form: formMask, every: oneOf([1, 2, 4]) }),
  stab: both(shape({ voice: unisonSpec, floor: int(24, 84), form: formMask, bars: figBars, hits: list(1, 16, shape({ s: int(0, 127), len: num(0.25, 64) })) }), figureIn("hits")),
  lead: both(shape({ voice: unisonSpec, floor: int(24, 84), form: formMask, bars: figBars, notes: list(1, 64, machineNote), glide: num(0, 0.4) }), figureIn("notes")),
  counter: both(shape({ voice: fmSpec, floor: int(24, 84), form: formMask, bars: figBars, notes: list(1, 64, machineNote) }), figureIn("notes")),
  choir: both(
    shape({ voice: choirSpec, floor: int(24, 84), form: formMask, bars: figBars, hits: list(1, 16, shape({ s: int(0, 127), len: num(0.25, 64), vowels: list(1, 6, vowel) })) }),
    figureIn("hits"),
  ),
  arp: shape({ voice: unisonSpec, floor: int(24, 84), form: formMask, cell: list(2, 16, int(-8, 16)), rate: int(1, 4), gate: num(0.1, 4), sweep: num(1, 64), depth: num(0, 0.9) }),
  bleeps: both(shape({ voice: bleepSpec, floor: int(24, 96), form: formMask, bars: figBars, notes: list(1, 32, shape({ s: int(0, 127), n: int(-8, 16) })) }), figureIn("notes")),
  perc: list(1, 8, shape(
    { voice: oneOf(["tom", "conga", "cowbell", "clave", "rim", "shaker", "crash", "clap"]), grid: lane(32), fill: lane(16), tune: num(0.5, 2), decay: num(0.3, 3), pan: num(-1, 1), level: num(0, 1.5), form: formMask },
    ["fill"],
  )),
  hats: shape({
    voice: shape({
      metal: num(0, 1), tune: num(0.5, 2), noise: num(0, 1), bp: num(1500, 12000), q: num(0.3, 6), hp: num(500, 12000), lp: num(2000, 18000),
      attack: num(0.0005, 0.01), closed: num(0.01, 0.3), open: num(0.05, 1), room: num(0, 0.04), roomLevel: num(0, 1), level: num(0, 1),
    }),
    spread: num(0, 1),
    lanes: list(1, 6, shape({ grid: hatLane(32), fill: hatLane(16), pan: num(-1, 1), form: formMask }, ["fill"])),
  }),
  drive: busLevels(0, 4),
});
const FX_FIELDS = {
  echo: partial({ steps: int(1, 8), taps: int(1, 12), fb: num(0, 0.75), lp: num(400, 8000), hp: num(80, 1500) }),
  echoSend: busLevels(0, 1),
  space: partial({ size: num(0.4, 2.5), fb: num(0, 0.85), lp: num(800, 9000) }),
  spaceSend: busLevels(0, 1),
  drumLp: num(1500, 18000),
  drive: num(0.8, 1.8),
  pressDrive: num(0, 0.6),
  duck: partial({ bass: num(0.1, 1), harm: num(0.3, 1) }),
  duckTime: partial({ bass: num(0.05, 0.6), harm: num(0.05, 0.6) }),
  master: partial({ lp: num(2000, 18000), hp: num(20, 200), crush: int(6, 12) }),
  plate: shape({ decay: num(0.3, 4), pre: num(0, 0.12), lp: num(1000, 14000), hp: num(80, 1500), damp: num(0, 1), level: num(0, 1.5), echo: num(0, 1) }, ["pre", "lp", "hp", "damp", "level", "echo"]),
  ensemble: partial(Object.fromEntries(BUS_NAMES.map((b) => [b, shape({ mix: num(0, 1), hp: num(60, 2000), rate: num(0.05, 4), depth: num(0.2, 6) }, ["hp", "rate", "depth"])]))),
  hall: partial({ level: num(0, 1.5), decay: num(0.4, 6), predelay: num(0, 120), lp: num(1500, 12000), hp: num(60, 1200) }),
  hallSend: busLevels(0, 1),
  plateSend: busLevels(0, 1),
  verb: partial({ decay: num(0.3, 6), pre: num(0, 0.15), lp: num(1000, 14000), hp: num(80, 1500), level: num(0, 2) }),
  verbSend: busLevels(0, 1),
  glue: partial({ drums: glueData, mix: glueData }),
  tape: partial({ drums: num(0.2, 3), harm: num(0.2, 3) }),
  excite: partial({ harm: num(0, 1), lead: num(0, 1), fx: num(0, 1) }),
};
const fxData = partial(FX_FIELDS);
/** The fields every base reads (styledata.ts SoundData). */
const SOUND_CHECKS = { mix: busLevels(-6, 6), fx: fxData, vinyl: num(0, 2.5) };

const liquidKit = shape(
  {
    kick: kickSpec,
    kickLevel: num(0, 2),
    snare: (x, p, e) => (typeof x === "string" ? oneOf(["keys", "soft", "soul"])(x, p, e) : drumVoice(x, p, e)),
    snareLevel: num(0, 2),
    ghostLevel: num(0, 1),
    hat: liquidHat,
    shaker: liquidHat,
    open: liquidHat,
    crash: num(0, 0.5),
    // Lanes of 32 (two bars), or 64 with breakBars 4 (crossCheck).
    breaks: list(1, 4, shape({ kick: lanes, snare: lanes, ghost: lanes, hat: lanes, open: lanesOrEmpty, shaker: lanes }, ["shaker"])),
    // Opt-in (styledata.ts LiquidKit): the shaker's own swing, the ghost layer's own voice.
    hatSwing: num(0, 0.08),
    ghost: drumVoice,
    // Opt-in, a played break (styledata.ts LiquidKit).
    freshNoise: bool, ghostTail: num(0.1, 1.5), humanDb: num(0, 3), jitter: num(0, 0.01), swing: num(0, 0.2), fillCut: bool,
    breakBars: oneOf([2, 4]), crashBars: oneOf([4, 8]),
    ride: shape(
      { lane: (x, p, e) => (typeof x === "string" && x.length === 64 ? lane(64)(x, p, e) : lane(16)(x, p, e)), level: num(0, 1.5), hp: num(1500, 9000), decay: num(0.2, 3), from: int(0, 64), pan: num(-1, 1), noise: bool },
      ["from", "pan", "noise"],
    ),
  },
  ["kick", "kickLevel", "snare", "snareLevel", "ghostLevel", "hat", "shaker", "open", "crash", "breaks", "hatSwing", "ghost",
    "freshNoise", "ghostTail", "humanDb", "jitter", "swing", "fillCut", "breakBars", "ride", "crashBars"],
);
/** The liquid sub: the common sub voice plus its opt-in saturation and glide (styledata.ts SubSpec). */
const liquidSubSpec = partial({
  wave: oneOf(["sine", "triangle"]), attack: num(0.002, 0.1), hold: num(0.3, 1), drive: num(0, 4), octave: num(0, 0.5),
  sat: num(0, 1), satLp: num(60, 200), glide: num(0.01, 0.3), legato: bool, release: num(0.005, 0.2),
});
const garageChord = shape(
  { bass: int(-12, 12), pad: list(3, 6, int(-12, 26)), hook: list(5, 5, int(0, 26)), guide: int(0, 24), dark: list(3, 3, int(-12, 26)) },
  ["hook"],
);
const tripHopKeys = list(1, 8, note(32, { p: oneOf(["C", "U", "L", 0, 1, 2, 3]), opt: bool }, ["opt"]));
const acidNote: Check = (x, p, e) => {
  if (x === null) return;
  shape({ degree: int(0, 4), octave: int(-1, 1), flags: int(0, 7), gate: num(0.1, 4) }, ["gate"])(x, p, e);
};
/**
 * A lead patch (leads.ts LeadPatch without `id`). The ranges hold every house patch in LEAD_PATCHES (test/pack.test.ts
 * checks them all), so a pack patch can be anything from a glass bell to an acid lead, and nothing beyond.
 */
export const PATCH_CHECK: Check = shape(
  {
    name: (x, p, e) => (typeof x !== "string" || x.trim().length === 0 || x.length > 24) && e(`${p}: expected 1..24 characters, got ${show(x)}`),
    osc: list(1, 5, shape({ type: oneOf([...waves, "pulse25", "pulse12"]), detune: num(-50, 50), oct: int(-2, 2), level: num(0, 1.5) })),
    fm: shape({ ratio: num(0.25, 8), index: num(0, 8), decay: num(0.01, 3), floor: num(0, 1) }),
    filter: shape({ type: oneOf(["lowpass", "bandpass", "highpass"]), cutoff: num(100, 12000), env: num(0, 6000), decay: num(0.01, 2), q: num(0.3, 14) }),
    formants: tuple(num(200, 3000), num(200, 4000)),
    amp: shape({ a: num(0.001, 1), d: num(0.01, 3), s: num(0, 1), r: num(0.02, 2) }),
    vib: shape({ rate: num(0.5, 10), depth: num(0, 40), delay: num(0, 1) }),
    glide: num(0, 0.3),
    blip: num(-24, 24),
    noise: num(0, 0.3),
    drive: num(0, 4),
    gain: num(0.1, 1.5),
    fm2: shape({ ratio: num(0.25, 16), index: num(0, 8), decay: num(0.01, 3), floor: num(0, 1) }),
    blipTime: num(0.01, 0.4),
    wow: shape({ rate: num(0.1, 8), depth: num(0, 40) }),
    chiff: shape({ level: num(0, 1), decay: num(0.005, 0.3) }),
    trem: shape({ rate: num(0.5, 12), depth: num(0, 1) }),
    hp: num(20, 2000),
  },
  ["fm", "formants", "vib", "glide", "blip", "noise", "drive", "fm2", "blipTime", "wow", "chiff", "trem", "hp"],
);

/** Film score (styledata.ts ScoreSpec, the Cinematic base, opt-in): the shapes; scoreCheck adds the cross-references. */
const scoreSynth = shape(
  {
    kind: oneOf(["synth"]),
    osc: list(1, 6, shape({ type: oneOf([...waves, "pulse25", "pulse12"]), detune: num(-50, 50), oct: int(-2, 2), level: num(0, 1.5) })),
    spread: num(0, 1), attack: num(0.002, 4), decay: num(0.02, 4), sustain: num(0, 1), release: num(0.02, 6),
    cutoff: num(80, 12000), track: num(0, 1), env: num(0, 8000), fa: num(0.002, 3), fd: num(0.02, 4), q: num(0.3, 8), vel: num(0, 1),
    vib: shape({ rate: num(0.5, 9), depth: num(0, 40), delay: num(0, 3) }),
    scoop: num(0, 100), scoopTime: num(0.02, 0.4), glide: num(0, 0.5),
    trem: shape({ rate: num(2, 16), depth: num(0, 0.9) }),
    drive: num(0, 4), hp: num(20, 1000), level: num(0.05, 2),
    unison: shape({ voices: int(2, 9), cents: num(0, 60), drift: num(0, 20), rate: num(0.03, 2) }, ["drift", "rate"]),
    formants: list(1, 5, shape({ f: num(150, 5000), q: num(0.5, 20), level: num(0, 3) })),
    flfo: shape({ rate: num(0.02, 2), depth: num(0, 2400) }),
    swell: bool,
    chorus: num(0, 1),
  },
  ["kind", "vib", "scoop", "scoopTime", "glide", "trem", "drive", "hp", "unison", "formants", "flfo", "swell", "chorus"],
);
const scorePiano = shape(
  {
    kind: oneOf(["piano"]), partials: int(3, 10), stretch: num(0, 0.002), detune: num(0, 4), prompt: num(0.1, 0.9), decay: num(0.5, 12),
    damp: num(0, 2), bright: num(0, 1), hammer: num(0, 1), cutoff: num(1000, 12000), release: num(0.05, 2), hp: num(20, 600), level: num(0.05, 2),
  },
  ["hp"],
);
const scoreVoice: Check = (x, p, e) => (isObj(x) && x.kind === "piano" ? scorePiano(x, p, e) : scoreSynth(x, p, e));
const arcWindow = both(tuple(int(0, 9), int(0, 9)), (x, p, e) => Array.isArray(x) && x[0] > x[1] && e(`${p}: expected [low, high] with low <= high, got ${show(x)}`));
const scoreNote = both(
  shape({ s: int(0, 127), len: num(0.25, 128), v: num(0.1, 1), o: bool, t: int(-8, 11), n: int(-24, 48), c: oneOf([true]), r: oneOf([true]) }, ["v", "o", "t", "n", "c", "r"]),
  (x, p, e) => {
    if (!isObj(x)) return;
    const kinds = ["t", "n", "c", "r"].filter((k) => x[k] !== undefined);
    if (kinds.length !== 1) e(`${p}: expected exactly one pitch (t, n, c or r), got ${kinds.length ? kinds.join(", ") : "none"}`);
  },
);
const scorePart = shape(
  {
    voice: (x, p, e) => typeof x !== "string" && e(`${p}: expected a voice name, got ${show(x)}`),
    play: oneOf(["chord", "root", "figure"]), bus: oneOf(["harm", "lead", "bass", "perc"]), on: arcWindow, oct: int(-12, 60), level: num(0, 2), dyn: num(0, 1),
    pan: num(-1, 1), tones: both(list(1, 5, int(0, 4)), distinct), hold: int(1, 16), sub: num(0, 1.5), bars: oneOf([1, 2, 4, 8]),
    figures: list(1, 6, list(1, 64, scoreNote)), blocks: list(4, 4, int(-1, 5)),
    doubles: list(1, 3, shape(
      {
        voice: (x, p, e) => typeof x !== "string" && e(`${p}: expected a voice name, got ${show(x)}`),
        oct: int(-12, 60), level: num(0, 2), on: arcWindow, bus: oneOf(["harm", "lead", "bass", "perc"]),
      },
      ["on", "bus"],
    )),
    fold: bool,
  },
  ["pan", "tones", "hold", "sub", "bars", "figures", "blocks", "doubles", "fold"],
);
const scoreSpec = shape(
  {
    scale: both(list(5, 9, int(0, 11)), distinct),
    colour: both(list(1, 4, int(0, 11)), distinct),
    chords: list(2, 12, shape({ bass: int(-12, 12), tones: list(3, 5, int(-12, 36)) })),
    harmony: (x, p, e) => {
      if (!Array.isArray(x) || ![8, 16, 32].includes(x.length)) return e(`${p}: expected 8, 16 or 32 chord indices, got ${show(x)}`);
      x.forEach((v, i) => int(0, 11)(v, `${p}[${i}]`, e));
    },
    arc: (x, p, e) => (typeof x !== "string" || !/^[0-9]{32}$/.test(x)) && e(`${p}: expected 32 digits 0..9 (one per form bar), got ${show(x)}`),
    open: num(0, 1),
    voices: (x, p, e) => {
      if (!isObj(x) || Object.keys(x).length < 1 || Object.keys(x).length > 10) return e(`${p}: expected 1..10 voices by name, got ${show(x)}`);
      for (const [k, v] of Object.entries(x)) scoreVoice(v, `${p}.${k}`, e);
    },
    parts: list(1, 14, scorePart),
    drums: (x, p, e) => {
      if (!isObj(x) || Object.keys(x).length < 1 || Object.keys(x).length > 10) return e(`${p}: expected 1..10 drums by name, got ${show(x)}`);
      for (const [k, v] of Object.entries(x)) {
        shape({ layers: drumVoice, bus: oneOf(["kick", "snare", "hat", "perc", "fx"]), pan: num(-1, 1), tune: int(-12, 36) }, ["pan", "tune"])(v, `${p}.${k}`, e);
      }
    },
    lanes: list(1, 16, shape(
      {
        drum: (x, p, e) => typeof x !== "string" && e(`${p}: expected a drum name, got ${show(x)}`),
        hits: (x, p, e) => (typeof x !== "string" || !/^[.1-9]*$/.test(x) || ![16, 32, 64].includes(x.length)) && e(`${p}: expected 16, 32 or 64 characters of "." or 1-9, got ${show(x)}`),
        on: arcWindow, level: num(0, 2), dyn: num(0, 1), bars: both(list(1, 32, int(0, 31)), distinct), o: bool,
      },
      ["bars", "o"],
    )),
    hall: shape(
      {
        decay: num(0.5, 12), lp: num(800, 12000), hp: num(60, 1000),
        send: partial(Object.fromEntries(["kick", "snare", "hat", "perc", "bass", "harm", "lead", "fx"].map((b) => [b, num(0, 1)]))),
        early: num(0, 1), pre: num(0, 120), shimmer: num(0, 0.6),
      },
      ["early", "pre", "shimmer"],
    ),
    ensemble: shape({ rate: num(0.1, 3), depth: num(0.2, 8), delay: num(4, 25), mix: num(0, 1.5) }),
    risers: list(1, 8, shape(
      {
        kind: oneOf(["shepard", "swell"]), at: int(0, 31), bars: int(1, 8), level: num(0, 2), oct: int(-12, 60),
        bus: oneOf(["harm", "lead", "perc"]), speed: num(0.05, 1), bright: num(300, 6000),
        voice: (x, p, e) => typeof x !== "string" && e(`${p}: expected a voice name, got ${show(x)}`), noise: num(0, 1),
      },
      ["bus", "speed", "bright", "voice", "noise"],
    )),
  },
  ["colour", "open", "drums", "lanes", "hall", "ensemble", "risers"],
);
/**
 * The film score's cross-references: harmony indices, voice and drum names, figure lengths and blocks, every chord
 * tone and `n` note in the scale (or a colour), the voicings' tones in reach of the parts' registers.
 */
function scoreCheck(x: unknown, p: string, e: Err) {
  scoreSpec(x, p, e);
  if (!isObj(x)) return;
  const chords = Array.isArray(x.chords) ? (x.chords as unknown[]) : [];
  const scale = new Set([...(Array.isArray(x.scale) ? x.scale : []), ...(Array.isArray(x.colour) ? x.colour : [])] as number[]);
  const pc = (semi: number) => ((semi % 12) + 12) % 12;
  if (Array.isArray(x.harmony)) x.harmony.forEach((h, i) => typeof h === "number" && h >= chords.length && e(`${p}.harmony[${i}]: chord ${h} is not in chords (0..${chords.length - 1})`));
  chords.forEach((c, i) => {
    if (!isObj(c)) return;
    if (typeof c.bass === "number" && !scale.has(pc(c.bass))) e(`${p}.chords[${i}].bass: ${c.bass} is outside the scale (and colour)`);
    if (Array.isArray(c.tones)) {
      c.tones.forEach((t, j) => typeof t === "number" && !scale.has(pc(t)) && e(`${p}.chords[${i}].tones[${j}]: ${t} is outside the scale (and colour)`));
      if (new Set(c.tones.map((t) => (typeof t === "number" ? pc(t) : t))).size < 3) e(`${p}.chords[${i}].tones: needs at least three pitch classes`);
    }
  });
  const voices = isObj(x.voices) ? Object.keys(x.voices) : [];
  const drums = isObj(x.drums) ? Object.keys(x.drums) : [];
  const parts = Array.isArray(x.parts) ? x.parts : [];
  parts.forEach((part, i) => {
    if (!isObj(part)) return;
    const q = `${p}.parts[${i}]`;
    if (typeof part.voice === "string" && !voices.includes(part.voice)) e(`${q}.voice: "${part.voice}" is not in voices (${voices.join(", ")})`);
    const figure = part.play === "figure";
    if (figure && !Array.isArray(part.figures)) e(`${q}.figures: a figure part needs its figures`);
    if (!figure) for (const k of ["figures", "bars", "blocks", "doubles", "fold"]) if (part[k] !== undefined) e(`${q}.${k}: only a figure part reads it`);
    if (Array.isArray(part.doubles)) {
      part.doubles.forEach((d, j) => isObj(d) && typeof d.voice === "string" && !voices.includes(d.voice) && e(`${q}.doubles[${j}].voice: "${d.voice}" is not in voices (${voices.join(", ")})`));
    }
    if (part.play !== "chord" && part.tones !== undefined) e(`${q}.tones: only a chord part reads it`);
    if (part.play !== "root" && part.sub !== undefined) e(`${q}.sub: only a root part reads it`);
    if (part.play === "figure" && part.hold !== undefined) e(`${q}.hold: a figure part does not read it`);
    const steps = 16 * (typeof part.bars === "number" ? part.bars : 1);
    const figs = Array.isArray(part.figures) ? part.figures : [];
    if (Array.isArray(part.blocks)) part.blocks.forEach((b, j) => typeof b === "number" && b >= figs.length && e(`${q}.blocks[${j}]: figure ${b} is not in figures (0..${figs.length - 1})`));
    figs.forEach((fig, j) => {
      if (!Array.isArray(fig)) return;
      fig.forEach((n, k) => {
        if (!isObj(n)) return;
        if (typeof n.s === "number" && n.s >= steps) e(`${q}.figures[${j}][${k}].s: ${n.s} is past the figure's ${steps} steps (bars ${steps / 16})`);
        if (typeof n.n === "number" && !scale.has(pc(n.n + (typeof part.oct === "number" ? part.oct : 0)))) {
          e(`${q}.figures[${j}][${k}].n: ${n.n} (over oct ${part.oct}) is outside the scale (and colour)`);
        }
      });
    });
  });
  const lanes = Array.isArray(x.lanes) ? x.lanes : [];
  lanes.forEach((l, i) => isObj(l) && typeof l.drum === "string" && !drums.includes(l.drum) && e(`${p}.lanes[${i}].drum: "${l.drum}" is not in drums (${drums.join(", ")})`));
  const risers = Array.isArray(x.risers) ? x.risers : [];
  risers.forEach((r, i) => {
    if (!isObj(r)) return;
    const q = `${p}.risers[${i}]`;
    if (r.kind === "swell" && r.voice === undefined && r.noise === undefined) e(`${q}: a swell needs a voice or noise`);
    if (r.kind === "shepard" && (r.voice !== undefined || r.noise !== undefined)) e(`${q}: a shepard reads neither voice nor noise`);
    if (r.kind === "swell" && (r.speed !== undefined || r.bright !== undefined)) e(`${q}: a swell reads neither speed nor bright`);
    if (typeof r.voice === "string") {
      const v = isObj(x.voices) ? (x.voices as Record<string, unknown>)[r.voice] : undefined;
      if (!v) e(`${q}.voice: "${r.voice}" is not in voices (${voices.join(", ")})`);
      else if (isObj(v) && v.kind === "piano") e(`${q}.voice: "${r.voice}" is a piano; a swell needs a synth voice`);
    }
  });
}

const garageKit = partial({ kick: kickSpec, snare: drumVoice, ghost: list(0, 6, drumLayer), hat, shaker, open: hat });
const tripHopKit = partial({ kick: kickSpec, snare: drumVoice, drag: num(0, 0.04), hat, open: hat });
/** A hip-hop beat lane (styledata.ts HipHopBeat): "." rest, 1-9 a hit, the rolls r t q and the half-step h / H. */
const hipLane: Check = (x, p, e) => {
  if (typeof x !== "string" || !/^[.1-9rtqhH]*$/.test(x) || ![16, 32, 64].includes(x.length)) {
    e(`${p}: expected 16, 32 or 64 characters of "." 1-9 r t q h H, got ${show(x)}`);
  }
};
const hipBeat = shape(
  { kick: hipLane, snare: hipLane, clap: hipLane, rim: hipLane, hat: hipLane, open: hipLane, perc: hipLane, shaker: hipLane, tom: hipLane },
  ["clap", "rim", "open", "perc", "shaker", "tom"],
);
const PARTS = ["intro", "build", "full", "breakdown", "rebuild"];
/** A synth layer (styledata.ts SynthLayer): a voice of the library and any of its params, each within the module's ranges. */
const synthLayer: Check = (x, p, e) => {
  shape(
    {
      voice: oneOf(VOICE_KINDS),
      level: num(0, 2),
      params: (v, at, err) => {
        if (!isObj(v)) return err(`${at}: expected an object of numbers, got ${show(v)}`);
        const kind = isObj(x) ? (x.voice as string) : "";
        const ranges = (VOICES as Record<string, { ranges: Record<string, readonly [number, number]> }>)[kind]?.ranges;
        if (!ranges) return;
        for (const [k, val] of Object.entries(v)) {
          const r = ranges[k];
          if (!r) err(`${at}.${k}: not a parameter of ${kind} (allowed: ${Object.keys(ranges).join(", ")})`);
          else num(r[0], r[1])(val, `${at}.${k}`, err);
        }
      },
      oct: int(-2, 2),
      pan: num(-1, 1),
      bus: oneOf(["lead", "harm", "fx", "bass"]),
      parts: list(1, 5, oneOf(PARTS)),
    },
    ["params", "oct", "pan", "bus", "parts"],
  )(x, p, e);
};
const synthLayers = list(1, 4, synthLayer);
/** A hip-hop note (styledata.ts HipHopNote): `s` on a 32nd grid (halves of a 16th). */
const hipNote = (steps: number): Check =>
  both(
    shape({ s: num(0, steps - 0.5), len: num(0.25, 64), semi: int(-12, 24), vel: num(0.1, 1), glide: bool }, ["vel", "glide"]),
    (x, p, e) => isObj(x) && typeof x.s === "number" && !Number.isInteger(x.s * 2) && e(`${p}.s: expected a whole or half 16th, got ${x.s}`),
  );
/** The hip-hop beat (styledata.ts HipHopSpec); lengths against `bars`, `bassBars` etc. are checked in crossCheck. */
const hipHop = shape(
  {
    bars: oneOf([1, 2, 4]),
    beats: list(1, 4, hipBeat),
    rotate: oneOf([8, 16]),
    fill: hipBeat,
    roll: num(0.1, 1),
    clap: drumVoice,
    rim: drumVoice,
    perc: drumVoice,
    chords: list(1, 8, list(3, 5, int(-12, 24))),
    progression: list(1, 8, int(0, 7)),
    chordBars: oneOf([1, 2, 4]),
    keys: shape({
      patch: (x, p, e) => PATCH_CHECK(x, p, e),
      level: num(0, 2),
      bars: oneOf([1, 2]),
      figures: list(1, 4, list(1, 16, shape({ s: int(0, 31), len: num(0.25, 32), vel: num(0.1, 1), top: bool }, ["vel", "top"]))),
    }, ["patch"]),
    pad: padSpec,
    bass: partial({
      mode: oneOf(["808", "synth"]), wave: oneOf(["sine", "triangle"]), level: num(0, 2), decay: num(0.1, 3), punch: num(1, 3), punchTime: num(0.005, 0.1),
      glide: num(0.02, 0.3), drive: num(0, 4), lp: num(80, 2000), cutoff: num(80, 2000), env: num(0, 4000), envTime: num(0.02, 1), q: num(0.3, 8), sub: num(0, 1.5),
    }),
    bassBars: oneOf([1, 2, 4, 8]),
    basslines: list(1, 4, list(1, 48, hipNote(128))),
    melodyBars: oneOf([2, 4, 8]),
    melodies: list(1, 4, list(1, 32, hipNote(128))),
    melodyLevel: num(0, 2),
    voices: list(1, 6, shape({
      patch: (x, p, e) => PATCH_CHECK(x, p, e),
      layers: synthLayers,
      level: num(0, 2),
      bus: oneOf(["lead", "harm", "fx"]),
      pan: num(-1, 1),
      bars: oneOf([2, 4, 8]),
      figures: list(1, 4, list(1, 32, hipNote(128))),
      chord: bool,
      parts: list(1, 5, oneOf(PARTS)),
    }, ["patch", "layers", "bus", "pan", "chord", "parts"])),
    keysLayers: synthLayers,
    melodyLayers: synthLayers,
    bassLayers: synthLayers,
    padLayers: synthLayers,
    kickLayers: drumVoice,
    shaker: drumVoice,
    tom: drumVoice,
  },
  [
    "rotate", "fill", "roll", "clap", "rim", "perc", "keys", "pad", "melodyBars", "melodies", "melodyLevel", "voices",
    "keysLayers", "melodyLayers", "bassLayers", "padLayers", "kickLayers", "shaker", "tom",
  ],
);
const lofiKit = partial({ kick: kickSpec, clap: drumVoice, snare: drumVoice, hat, open: hat, shaker });
const acidKit = partial({ kick: kickSpec, clap: drumVoice, snare: drumVoice, hat, open: hat, perc: drumVoice });

// Dub techno: every voice is merged field by field over the base's, so every field is optional.
const dubKit = partial({
  kick: partial({
    center: num(30, 90), rise: num(1, 4), sweep: num(0.005, 0.3), hold: num(0.02, 0.3), decay: num(0.3, 1.5), drive: num(0.1, 4), lp: num(60, 2000),
    click: num(0, 1), clickHz: num(300, 8000), level: num(0, 0.6),
  }),
  clap: partial({ level: num(0, 3), hz: num(300, 6000), decay: num(0.01, 0.5), rim: bool }),
  hat: partial({
    off: num(0, 1.2), decay: num(0.005, 0.5), hp: num(1000, 14000), metal: num(0, 1), shaker: num(0, 1), shakerDecay: num(0.005, 0.2),
    shuffle: tuple(num(0, 1.5), num(0, 1.5), num(0, 1.5), num(0, 1.5)),
  }),
  perc: partial({ level: num(0, 1), decay: num(0.02, 0.5) }),
});
/** A sub note of a dub bassline: [step, length, level] or [step, length, level, interval]. */
const dubSubNote: Check = (x, p, e) => {
  if (!Array.isArray(x) || (x.length !== 3 && x.length !== 4)) return e(`${p}: expected [step, length, level] or [step, length, level, interval], got ${show(x)}`);
  int(0, 15)(x[0], `${p}[0]`, e);
  num(0.25, 16)(x[1], `${p}[1]`, e);
  num(0, 1.5)(x[2], `${p}[2]`, e);
  if (x.length === 4) int(0, 24)(x[3], `${p}[3]`, e);
};

// Electro.
const electroSnare: Check = (x, p, e) => (typeof x === "string" ? oneOf(["808", "client", "alien"])(x, p, e) : drumVoice(x, p, e));
const electroKit = partial({
  kick: kickSpec,
  snare: electroSnare,
  ghost: drumVoice,
  hat: shape({ hp: num(1000, 14000), decay: num(0.005, 1), metal: num(0, 1), q: num(0.3, 4) }, ["q"]),
  open: shape({ hp: num(1000, 14000), decay: num(0.005, 1), metal: num(0, 1), q: num(0.3, 4), level: num(0, 1.5), crush: int(3, 8) }, ["q", "crush"]),
  accents: tuple(num(0, 1), num(0, 1), num(0, 1), num(0, 1)),
});
/** A [plain, accent] pair, both in lo..hi. */
const pair = (lo: number, hi: number) => tuple(num(lo, hi), num(lo, hi));
const electroKicks = shape({
  half: list(1, 6, list(1, 12, int(0, 31))),
  lo: list(1, 6, list(1, 12, int(0, 31))),
  mid: list(1, 6, list(1, 12, int(0, 31))),
  hi: list(1, 6, list(1, 12, int(0, 31))),
});
const formant = tuple(num(200, 1200), num(600, 3000));
const alienStep: Check = (x, p, e) => {
  if (x === null) return;
  tuple(int(-12, 24), int(0, 7))(x, p, e);
};
// Ambient IDM and drone (styledata.ts AmbientIdmData, DroneData). Their voices are long and stacked, so the counts
// (oscillators, partials, layers, ring times) are capped as well as the levels.
const osc = shape({ type: oneOf(waves), detune: num(-40, 40), level: num(0, 1) });
/** Density thresholds [low, high] in 0..1, low first. */
const tiers = both(tuple(num(0, 1), num(0, 1)), (x, p, e) => {
  if (Array.isArray(x) && x[0] > x[1]) e(`${p}: expected [low, high] with low <= high, got ${show(x)}`);
});
/** An Ambient IDM chord; Tape Haze plays the pad tones at and above 0, so two of them must be there. */
const ambientChord: Check = both(
  shape({ bass: int(-12, 12), pad: list(2, 6, int(-24, 26)), glass: list(2, 6, int(-12, 31)), arp: list(4, 4, int(-12, 24)), sing: list(5, 5, int(-12, 24)) }),
  (x, p, e) => {
    const pad = isObj(x) && Array.isArray(x.pad) ? x.pad : [];
    if (pad.filter((t) => typeof t === "number" && t >= 0).length < 2) e(`${p}.pad: needs at least two tones at or above 0`);
  },
);
const ambientNoise = shape({ noise: oneOf(["bandpass", "highpass", "lowpass"]), freq: num(100, 16000), q: num(0.3, 12), decay: num(0.005, 0.5), level: num(0, 1) });
const ambientKit = partial({
  kick: kickSpec, thump: num(0, 0.2), click: drumVoice, snare: drumVoice, dust: drumVoice, ghost: drumVoice,
  rim: shape({ level: num(0, 1), pitch: num(0.5, 2.5) }), crack: ambientNoise, tick: ambientNoise, hat, open: hat,
});
const dronePadFields = {
  level: num(0.005, 0.15), waves: list(1, 6, oneOf(waves)), detune: num(0, 20), spread: num(0, 8),
  cutoff: num(150, 2000), glow: num(0, 1500), range: num(1, 3), period: num(6, 60),
};
const sineBed = list(1, 6, tuple(int(-12, 24), num(-30, 30), num(0, 1)));
const AMBIENT_CHECKS: Readonly<Record<keyof GenreDataMap["ambientidm"] & string, Check>> = {
  chords: list(2, 8, ambientChord),
  progressions: list(1, 6, list(1, 8, int(0, 7))),
  figures: figures(1, 12, tuple(int(0, 31), int(0, 6), int(0, 2))),
  phrases: figures(1, 12, tuple(int(0, 127), int(0, 4), num(1, 32), int(-1, 1), int(0, 2))),
  arps: list(1, 6, list(2, 16, int(0, 8))),
  tiers,
  notes: list(2, 12, int(0, 24)),
  ...SOUND_CHECKS,
  kit: ambientKit,
  pad: padSpec,
  bass: partial({ osc: list(1, 4, osc), cutoff: num(80, 1200), level: num(0, 0.2), sub: num(0, 0.25) }),
  lead: partial({
    osc: list(1, 4, shape({ type: oneOf(waves), oct: int(-1, 2), detune: num(-40, 40), level: num(0, 1) })),
    cutoff: num(200, 6000), level: num(0, 0.3), scoop: num(0, 100), vib: num(0, 30),
  }),
  line: partial({ level: num(0, 0.06), cutoff: num(600, 9000), osc: list(1, 4, osc) }),
  glass: partial({
    level: num(0.005, 0.25), partials: list(1, 6, shape({ type: oneOf(waves), ratio: num(0.5, 8), detune: num(-40, 40), level: num(0, 1) })),
    cutoff: num(800, 9000), hp: num(40, 1000), attack: num(0.05, 8), release: num(0.1, 8),
  }),
  bell: partial({ level: num(0, 0.12), ratio: num(0.5, 8), index: num(0, 8), decay: num(0.1, 4) }),
  // The arp can run in sixteenths: a long ring would stack dozens of voices.
  shimmer: partial({ level: num(0, 0.4), partials: list(1, 4, shape({ ratio: num(0.5, 8), detune: num(-40, 40), level: num(0, 1) })), decay: num(0.05, 1.5), short: num(0.05, 1) }),
};
const DRONE_CHECKS: Readonly<Record<keyof GenreDataMap["drone"] & string, Check>> = {
  bars: int(2, 16),
  voicing: list(2, 6, int(-12, 48)),
  colours: list(1, 4, list(2, 6, int(-12, 48))),
  busy: int(-12, 48),
  glints: list(1, 8, int(0, 36)),
  partials: list(1, 12, shape({ n: int(1, 16), g: num(0, 0.5), group: int(0, 3) })),
  figures: list(1, 6, list(1, 8, int(0, 1))),
  mix: SOUND_CHECKS.mix,
  // The drone's drums sit behind a very low wall (house 240 Hz), its master highpass is 18 Hz, and its echo is a
  // long one (house 8 steps; the echo is capped at 2.4 s whatever the steps).
  fx: partial({
    ...FX_FIELDS,
    echo: partial({ steps: int(1, 12), taps: int(1, 8), fb: num(0, 0.75), lp: num(400, 8000), hp: num(80, 1500) }),
    drumLp: num(150, 18000),
    master: partial({ lp: num(2000, 18000), hp: num(15, 200), crush: int(6, 12) }),
  }),
  vinyl: SOUND_CHECKS.vinyl,
  wall: partial({ ...dronePadFields, depth: num(0, 0.6), drift: num(0, 12), core: list(0, 3, tuple(int(-24, 0), num(0, 0.5))) }),
  pad: partial(dronePadFields),
  bed: partial({ subLevel: num(0, 0.12), bodyLevel: num(0, 0.15), subs: sineBed, body: sineBed, beat: num(0.2, 2), drive: num(0.5, 3), cutoff: num(100, 900) }),
  kick: partial({
    osc: oneOf(waves), start: num(30, 120), end: num(20, 80), sweep: num(0.05, 1.5), decay: num(0.3, 3), click: num(0, 1), clickHp: num(500, 8000),
    drive: num(0, 4), body: num(0, 1.5),
  }),
  overtone: partial({ level: num(0.02, 0.4), cutoff: num(400, 6000), glow: num(0, 3000), depths: list(4, 4, num(0, 1)) }),
  glint: partial({ level: num(0, 0.06), decay: num(0.5, 10), attack: num(0.005, 1), top: num(500, 8000), gap: num(1, 8) }),
  breath: num(0, 0.08),
  rumble: num(0, 0.12),
  swell: num(0, 0.15),
};

/** A UK garage mid bass (styledata.ts UkgMidSpec). */
const ukgMid = partial({
  kind: oneOf(["saw", "fm", "reese", "organ"]), level: num(0, 1.5), cutoff: num(150, 3000), env: num(0, 1), q: num(0.3, 8), decay: num(0.05, 1),
  sustain: num(0, 1), release: num(0.02, 0.4), drive: num(0, 5), detune: num(0, 40), ratio: num(0.5, 6), index: num(0, 8), fmDecay: num(0.03, 0.6),
  floor: num(0, 1), hp: num(40, 300), bend: num(0, 12), bendTime: num(0.02, 0.4),
});

/** Where a v3 layer plays (styledata.ts UkgWhere): song-form parts, 32-bar cycles. */
const ukgWhere = {
  in: both(list(0, 5, oneOf(["intro", "build", "full", "breakdown", "rebuild"])), distinct),
  alt: oneOf([0, 1, 2]),
};

/** A UK garage convolution room (styledata.ts UkgRoomSpec). */
/**
 * Synth v2 slot parameters (`ukg.v2.<slot>.p`, v2/presets.ts): the ranges of every number a preset may be given. A
 * key must exist in the named voice's preset; strings and tables are checked by name.
 */
const V2_RANGES: Record<string, readonly [number, number]> = {
  level: [0, 2], gain: [0, 4], unison: [1, 4], detune: [0, 60], wave: [0, 1], pwm: [0, 0.45], sub: [0, 1], cutoff: [40, 16000], res: [0, 0.99], env: [0, 6],
  fa: [0.001, 4], fd: [0.005, 6], fs: [0, 1], track: [0, 1], drive: [0, 4], a: [0.0005, 6], d: [0.005, 8], s: [0, 1], r: [0.01, 6], stereo: [0, 1],
  chorus: [0, 30], fb: [0, 1], pickup: [0, 1], offset: [0, 1], hammer: [0, 1], bright: [0, 16000], damp: [0.02, 4], thump: [0, 1], decay: [0.05, 12],
  position: [0.02, 0.5], tone: [0, 1], body: [60, 600], bodyLevel: [0, 1], pos: [0, 1], posEnv: [-1, 1], pa: [0.001, 6], pd: [0.01, 8], ps: [0, 1],
  lfo: [0, 8], lfoDepth: [0, 1], rate: [8000, 48000], bits: [6, 16], interp: [0, 1], lp: [400, 16000], start: [0, 1],
};
const v2Params =
  (voice: unknown): Check =>
  (x, p, e) => {
    if (!isObj(x)) return e(`${p}: expected an object of parameters, got ${show(x)}`);
    const preset = V2_PRESETS[voice as keyof typeof V2_PRESETS];
    if (!preset) return;
    for (const [k, v] of Object.entries(x)) {
      const at = `${p}.${k}`;
      if (!(k in preset.p)) e(`${at}: not a parameter of the ${String(voice)} voice (allowed: ${Object.keys(preset.p).join(", ")})`);
      else if (k === "algo") oneOf(["pairs", "stack", "fan"])(v, at, e);
      else if (k === "filter") oneOf(["ladder", "diode"])(v, at, e);
      else if (k === "modes") list(1, 8, v2Mode)(v, at, e);
      else if (k === "ops") list(4, 4, tuple(num(0.25, 32), num(-100, 100), num(0, 12), num(0.0005, 6), num(0.005, 8), num(0, 1), num(0.01, 6), num(0, 1), num(0, 1)))(v, at, e);
      else if (V2_RANGES[k]) num(V2_RANGES[k][0], V2_RANGES[k][1])(v, at, e);
    }
  };
/** A modal voice's mode: [ratio, amplitude, T60 s] or with cents. */
const v2Mode: Check = (x, p, e) => {
  if (!Array.isArray(x) || x.length < 3 || x.length > 4) return e(`${p}: expected [ratio, amplitude, T60] or [ratio, amplitude, T60, cents], got ${show(x)}`);
  num(0.25, 40)(x[0], `${p}[0]`, e);
  num(0, 2)(x[1], `${p}[1]`, e);
  num(0.005, 20)(x[2], `${p}[2]`, e);
  if (x.length === 4) num(-100, 100)(x[3], `${p}[3]`, e);
};
const v2Alive = partial({ drift: num(0, 30), driftRate: num(0.01, 5), wander: num(0, 1), envVar: num(0, 1), velBright: num(0, 1), timing: num(0, 15) });
const v2Slot =
  (chop: boolean, where = chop): Check =>
  (x, p, e) => {
    if (!isObj(x)) return e(`${p}: expected an object, got ${show(x)}`);
    const fields: Record<string, Check> = { level: num(0, 2), voice: oneOf(V2_VOICE_NAMES), octave: int(-24, 24), p: v2Params(x.voice), alive: v2Alive };
    if (where) Object.assign(fields, ukgWhere);
    if (chop) Object.assign(fields, { max: num(0.25, 16) });
    shape(fields, Object.keys(fields).filter((k) => k !== "level" && k !== "voice"))(x, p, e);
    if (chop && x.voice !== "chop") e(`${p}.voice: the chop slot plays the "chop" voice, got ${show(x.voice)}`);
    if (!chop && x.voice === "chop") e(`${p}.voice: "chop" only plays in the chop slot`);
  };

const ukgRoom = partial({
  level: num(0, 1.5), decay: num(0.3, 5), lp: num(1000, 14000), hp: num(80, 1500), pre: num(0, 0.08), harm: num(0, 1), lead: num(0, 1), snare: num(0, 1), fx: num(0, 1),
});

/**
 * The key of the UK garage voices: the natural minor over the tonic. Chord tones may be 7ths, 9ths, 11ths and 13ths
 * (minor 7 / minor 9 / major 7 / major 9 / sus / 6/9 voicings), but every pitch class must be in this scale, so
 * the extensions never clash with the sub, the chain's bass onsets or each other.
 */
export const UKG_KEY: readonly number[] = [0, 2, 3, 5, 7, 8, 10];
/** The scales a UK garage style may name (`ukg.scale`); "minor" is UKG_KEY. */
export const UKG_SCALES: Readonly<Record<string, readonly number[]>> = {
  minor: UKG_KEY,
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  dark: [0, 1, 2, 3, 5, 6, 7, 8, 10, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};
/** The bass of each chord of the default UK garage table (engine.ts UKG_CHORDS), for basslines over it. */
export const UKG_CHORD_BASS: readonly number[] = [0, 0, 8, 3, 5, 7, 10, 0, 5];
/** How many chords the default UK garage progressions (engine.ts UKG_PROGRESSIONS) index, and how many vowels UKG_VOWELS has. */
const UKG_CHORD_COUNT = 9;
const UKG_VOWEL_COUNT = 5;
const pc = (x: number) => ((x % 12) + 12) % 12;

/** UK garage (futuregarage classic with `ukg`): the figures need the voices on, and every note stays in the key. */
/** The UK garage voices are on: `ukg` given and its level (default 1) above 0 (engine.ts ukgSpec). */
const ukgOn = (data: Record<string, unknown>) => isObj(data.ukg) && (typeof data.ukg.level === "number" ? data.ukg.level > 0 : true);

function ukgCheck(data: Record<string, unknown>, p: string, e: Err) {
  const on = ukgOn(data);
  for (const k of ["stabs", "basslines", "motifs", "calls", "arps", "strums"]) {
    if (data[k] !== undefined && !on) e(`${p}.${k}: only the UK garage voices read it; give the style ukg (level > 0)`);
  }
  if (!on) return;
  const ukg = data.ukg as Record<string, unknown>;
  const scaleName = typeof ukg.scale === "string" && ukg.scale in UKG_SCALES ? ukg.scale : "minor";
  const KEY = UKG_SCALES[scaleName];
  const chords = Array.isArray(data.chords) ? data.chords.filter(isObj) : null;
  chords?.forEach((c, i) => {
    if (typeof c.bass === "number" && !KEY.includes(pc(c.bass))) e(`${p}.chords[${i}].bass: ${c.bass} is out of the key (${scaleName}: ${KEY.join(" ")})`);
    if (Array.isArray(c.pad)) c.pad.forEach((t, j) => typeof t === "number" && !KEY.includes(pc(t)) && e(`${p}.chords[${i}].pad[${j}]: ${t} is out of the key (${scaleName}: ${KEY.join(" ")})`));
  });
  const basses = chords ? chords.map((c) => (typeof c.bass === "number" ? c.bass : 0)) : UKG_CHORD_BASS;
  if (Array.isArray(data.basslines)) {
    data.basslines.forEach((line, i) => {
      if (!Array.isArray(line)) return;
      line.forEach((n, j) => {
        if (!isObj(n) || typeof n.semi !== "number") return;
        const semi = n.semi;
        const off = basses.filter((b) => !KEY.includes(pc(b + semi)));
        if (off.length) e(`${p}.basslines[${i}][${j}].semi: ${semi} over the chord bass ${off.join(", ")} is out of the key`);
      });
    });
  }
  const vowels = Array.isArray(data.vowels) ? data.vowels.length : UKG_VOWEL_COUNT;
  if (Array.isArray(data.calls)) {
    data.calls.forEach((fig, i) => {
      if (!Array.isArray(fig)) return;
      fig.forEach((x, j) => {
        if (!isObj(x)) return;
        for (const k of ["vowel", "to"]) if (typeof x[k] === "number" && (x[k] as number) >= vowels) e(`${p}.calls[${i}][${j}].${k}: vowel ${x[k]} is not in vowels (0..${vowels - 1})`);
      });
    });
  }
}

/** Rules that depend on the base: the Ambient IDM kit parts it plays, Overtone Pulse's glints (partial numbers). */
function baseCheck(genre: DataGenre, base: string, data: Record<string, unknown>, p: string, e: Err) {
  if (genre === "futuregarage" && base === "classic") ukgCheck(data, p, e);
  if (genre === "ambientidm" && Array.isArray(data.progressions)) {
    const n = Array.isArray(data.chords) ? data.chords.length : 5;
    data.progressions.forEach((prog, i) => {
      if (Array.isArray(prog)) prog.forEach((c, j) => typeof c === "number" && c >= n && e(`${p}.progressions[${i}][${j}]: chord ${c} is not in chords (0..${n - 1})`));
    });
  }
  if (genre === "ambientidm" && isObj(data.kit)) {
    const parts = AMBIENT_KIT_PARTS[base as keyof typeof AMBIENT_KIT_PARTS] as readonly string[];
    for (const k of Object.keys(data.kit)) {
      if (!parts.includes(k)) e(`${p}.kit.${k}: base "${base}" does not play it (its kit: ${parts.join(", ")})`);
    }
  }
  if (genre === "drone" && base === "pulse" && Array.isArray(data.glints)) {
    if (data.glints.length < 2) e(`${p}.glints: Overtone Pulse needs at least 2 glints (it never repeats one), got ${data.glints.length}`);
    data.glints.forEach((n, i) => typeof n === "number" && (n < 2 || n > 16) && e(`${p}.glints[${i}]: expected a harmonic number in 2..16, got ${show(n)}`));
  }
}

/** A liquid voice (styledata.ts LiquidVoiceSpec). */
const liquidVoiceSpec: Check = (x, p, e) =>
  shape(
    { kind: oneOf(LIQUID_VOICE_KINDS), level: num(0, 2), bright: num(0, 1), oct: int(-2, 2), presence: num(0, 6), strike: num(0, 1), strikeRatio: num(1, 4), strikeBars: int(4, 32) },
    ["bright", "oct", "presence", "strike", "strikeRatio", "strikeBars"],
  )(x, p, e);

/** The check of every data field, per genre (shapes and ranges as documented in styledata.ts). */
const FIELD_CHECKS: { readonly [G in DataGenre]: Readonly<Record<keyof GenreDataMap[G] & string, Check>> } = {
  liquid: {
    vamps,
    stabs: figures(1, 12, coreNote(64)),
    answers: figures(1, 4, note(16)),
    contours: list(1, 6, list(4, 16, int(0, 7))),
    phrases: figures(1, 12, coreNote(64)),
    kit: liquidKit,
    fills: list(1, 6, shape({ kick: lane(8), snare: lane(8), roll: lane(8), drop: bool, trip: lane(6) }, ["roll", "drop", "trip"])),
    sub: num(0, 1),
    // Four chords; 4..8 only with dnb.chordBars (crossCheck).
    progressions: list(1, 6, list(4, 8, padChord)),
    // Onsets 0..31 and 1..12 notes (two bars); 0..63 and up to 24 only with dnb.walkBars 4 (crossCheck).
    walks: figures(1, 24, note(64, { core: bool, oct: int(0, 1), semi: int(-12, 12), next: bool }, ["semi", "next"])),
    comps: figures(1, 10, note(32, { core: bool, vel: num(0.1, 1), next: bool }, ["vel", "next"])),
    ...SOUND_CHECKS,
    bass: liquidSubSpec,
    // The reese over the sub (styledata.ts LiquidReeseSpec): off at level 0; hp, beat, lp2 opt-in.
    // level up to 3: a quiet warm mid layer under a legato sub needs ~2.5 to sit 8 dB under it (liquid-dnb.ts).
    reese: partial({
      level: num(0, 3), detune: num(0, 40), drive: num(0.1, 5), cutoff: num(60, 1200), q: num(0.3, 8), depth: num(0, 1), rate: num(0.0625, 4),
      hp: num(60, 300), beat: num(0.25, 4), lp2: num(2000, 10000),
    }),
    // The drum & bass discipline (styledata.ts LiquidDnbSpec): every field opt-in.
    dnb: partial({
      gap: num(0, 2), walkBars: oneOf([2, 4]), vampBars: oneOf([1, 2, 4]), breakSub: num(0, 1), dropout: bool, rotate: bool,
      snareDuck: num(0.3, 1), harmHp: num(100, 400), leadHp: num(100, 400), stringsOct: oneOf([-1, 0]),
      motif: shape({
        patch: (x, p, e) => PATCH_CHECK(x, p, e),
        level: num(0, 1.5),
        figures: list(1, 4, list(1, 24, shape({ s: int(0, 127), len: num(0.25, 32), tone: int(0, 5), oct: int(-1, 2) }))),
        sections: both(list(1, 4, oneOf(["intro", "build", "full", "breakdown"])), distinct),
        every: int(1, 4), phase: int(0, 3), padDuck: num(0.3, 1),
      }, ["sections", "every", "phase", "padDuck"]),
      // The liquid drum & bass recipe (styledata.ts LiquidDnbSpec ep .. bassMute).
      ep: partial({
        bark: num(0, 4), barkDecay: num(0.05, 1), floor: num(0, 0.5), detune: num(0, 20), tine: num(0, 0.4), tineRatio: num(2, 20),
        tineLevel: num(0, 1), tineDecay: num(0.05, 1.5), fast: num(0.1, 1), d: num(0.03, 1), tail: num(0.2, 4), r: num(0.02, 0.5),
        keyTrack: num(1, 4), cutoff: num(400, 6000), cutoffVel: num(0, 8000), close: num(0.2, 1), drive: num(0.5, 4), hp: num(60, 400),
        trem: num(0, 8), tremDepth: num(0, 0.6), gain: num(0.1, 2),
      }),
      strum: num(0, 0.02), topAccent: num(1, 1.4), velJitter: num(0, 0.3),
      answer: shape({
        level: num(0, 1.5),
        figures: list(1, 4, list(1, 24, shape({ s: int(0, 127), len: num(0.25, 32), tone: int(0, 5), oct: int(-1, 2), vel: num(0.1, 1) }, ["vel"]))),
        sections: both(list(1, 4, oneOf(["intro", "build", "full", "breakdown"])), distinct),
      }, ["sections"]),
      drumRoom: shape({ decay: num(0.3, 2), lp: num(2000, 12000), hp: num(100, 800), send: num(0, 0.6) }),
      hall: shape({ decay: num(1, 5), lp: num(1500, 9000), hp: num(100, 600), harm: num(0, 0.8), lead: num(0, 0.8), fx: num(0, 0.8) }),
      chorus: shape({ wet: num(0, 1), pad: num(0, 1) }, ["pad"]),
      padLfo: shape({ rate: num(0.02, 1), depth: num(0, 0.6) }),
      fullIntro: bool, subFold: bool, bassMute: bool,
      subFloor: int(24, 33), chordBars: oneOf([1, 2, 4]),
      keys: shape({ patch: (x, p, e) => PATCH_CHECK(x, p, e), level: num(0, 1.5) }),
      choir: num(0, 1.5), choirOct: int(-1, 1), padCut: num(0, 12),
      // v3 (styledata.ts LiquidDnbSpec): comps that move, a filter sweep into the drop, a noise swell before it.
      compRotate: oneOf([2, 4, 8]), sweep: num(0.1, 1), swell: shape({ level: num(0, 1), bars: int(1, 8) }),
      // v4 (styledata.ts LiquidVoiceSpec): instrument models per role (voices.ts).
      voices: partial({ keys: liquidVoiceSpec, answer: liquidVoiceSpec, lead: liquidVoiceSpec, pad: liquidVoiceSpec, pad2: liquidVoiceSpec, bass: liquidVoiceSpec }),
    }),
    pad: padSpec,
    choir: padSpec,
    strings: padSpec,
    // The attention layer's mention voices (styledata.ts LiquidOrnamentSpec): each voice once, level at most x1.6 the preset.
    ornament: partial({
      voices: both(list(1, 3, oneOf(liquidVoices)), distinct),
      smart: both(list(1, 3, oneOf(liquidVoices)), distinct),
      nature: both(list(1, 3, oneOf(["bird", "gust", "drop"])), distinct),
      level: num(0, 1.6),
      slots: list(1, 8, int(0, 15)),
    }),
  },
  futuregarage: {
    chords: list(2, 12, garageChord),
    progressions: list(1, 6, list(1, 8, int(0, 11))),
    skips: figures(1, 10, tuple(int(0, 31), num(0, 1))),
    foley: figures(1, 10, tuple(int(0, 31), int(0, 2))),
    kicks: kickFigures,
    sub: num(0, 1.2),
    vamps,
    choirs: figures(1, 10, coreNote(32, { swell: bool })),
    pans: figures(1, 8, note(32)),
    ...SOUND_CHECKS,
    kit: garageKit,
    bass: subSpec,
    reese: partial({ detune: num(0, 40), drive: num(0.1, 5), cutoff: num(60, 1200), q: num(0.3, 8), depth: num(0, 1), level: num(0, 0.2) }),
    pad: padSpec,
    choir: padSpec,
    vowels: list(1, 6, tuple(num(200, 1200), num(600, 3000))),
    rain: num(0, 2.5),
    // The attention layer's mention voices (styledata.ts GarageOrnamentSpec): each voice once, level at most x1.6 the preset.
    ornament: partial({
      voices: both(list(1, 4, oneOf(garageVoices)), distinct),
      smart: both(list(1, 4, oneOf(garageVoices)), distinct),
      foley: both(list(1, 3, oneOf(["lighter", "drop", "vinyl"])), distinct),
      level: num(0, 1.6),
      slots: list(1, 8, int(0, 15)),
    }),
    // UK garage (styledata.ts UkgSpec and the figures it reads); the key rules are in baseCheck.
    stabs: figures(2, 16, coreNote(32, { len: num(0.25, 8), vel: num(0.1, 1) })),
    basslines: figures(2, 32, shape({ s: int(0, 31), len: num(0.25, 8), semi: int(-12, 24), vel: num(0.1, 1), core: bool, glide: bool }, ["glide"])),
    motifs: figures(2, 16, shape({ s: int(0, 31), len: num(0.25, 8), tone: int(0, 5), oct: int(-1, 2), core: bool }, ["oct"])),
    calls: figures(1, 12, shape({ s: int(0, 31), len: num(0.5, 8), vowel: int(0, 5), to: int(0, 5), tone: int(0, 5), oct: int(-1, 1), rep: int(0, 4), core: bool }, ["to", "oct", "rep"])),
    arps: figures(2, 32, shape({ s: int(0, 31), len: num(0.25, 8), tone: int(0, 5), oct: int(-1, 2), core: bool }, ["oct"])),
    strums: figures(2, 24, shape({ s: int(0, 31), len: num(0.25, 8), vel: num(0.1, 1), up: bool, core: bool }, ["up"])),
    ukg: partial({
      level: num(0, 1.5),
      bars: int(1, 2),
      stab: partial({
        level: num(0, 1.5), voices: int(1, 4), detune: num(0, 40), osc2: num(0, 1), cutoff: num(400, 9000), q: num(0.3, 8), slope: oneOf([12, 24]),
        env: num(0, 1), fdecay: num(0.03, 1), attack: num(0.001, 0.05), decay: num(0.05, 1), sustain: num(0, 1), release: num(0.02, 0.6),
        punch: num(0, 12), punchTime: num(0.005, 0.1), drive: num(0, 4), vel: num(0, 1), width: num(0, 1), octave: int(-12, 12),
      }),
      organ: partial({
        level: num(0, 1.5), bars: tuple(num(0, 1), num(0, 1), num(0, 1)), chorus: num(0, 20), drive: num(0, 4), cutoff: num(600, 9000),
        decay: num(0.05, 1.5), sustain: num(0, 1), release: num(0.02, 0.8),
      }),
      sub: partial({ level: num(0, 1.5), attack: num(0.001, 0.03), decay: num(0.1, 1.5), sustain: num(0, 1), release: num(0.03, 0.4), drive: num(0, 3), glide: num(0.02, 0.2), bend: num(0, 12), bendTime: num(0.02, 0.4), h2: num(0, 1) }),
      mid: ukgMid,
      drop2: ukgMid,
      pluck: partial({
        level: num(0, 1.5), wave: oneOf(["sawtooth", "triangle", "square"]), cutoff: num(400, 9000), env: num(0, 1), decay: num(0.05, 0.6),
        release: num(0.03, 0.5), bend: num(0, 12), pan: num(0, 1), voices: int(1, 5), detune: num(0, 40), width: num(0, 1),
      }),
      vox: partial({ level: num(0, 1.5), q: num(2, 14), breath: num(0, 1), bend: num(-12, 12), scoop: num(0.01, 0.2), release: num(0.02, 0.5), lp: num(1000, 9000) }),
      lead: partial({
        level: num(0, 1.5), glide: num(0, 0.2), detune: num(0, 25), cutoff: num(600, 9000), release: num(0.03, 0.6), kind: oneOf(["square", "saw", "vox"]),
        vib: num(0, 40),
      }),
      groove: partial({
        hatLate: num(0, 0.35), percLate: num(0, 0.35), jitter: num(0, 1), ghost: num(0, 1.5), perc: num(0, 1.5), open: num(0, 1.5), tamb: num(0, 1.5),
        ghostKick: num(0, 1.5), offOpen: num(0, 1.5), metal: num(0, 1.5),
      }),
      keys: both(list(1, 6, int(0, 11)), distinct),
      scale: oneOf(Object.keys(UKG_SCALES)),
      midEarly: num(0, 1),
      turn: oneOf([0, 1]),
      sweep: partial({ bars: oneOf([8, 16, 32]), depth: num(0, 1) }),
      m1: partial({ level: num(0, 1.5), octave: int(-12, 12), cutoff: num(600, 8000), drive: num(0, 4), click: num(0, 1), decay: num(0.05, 1), sustain: num(0, 1), release: num(0.02, 0.4) }),
      ep: partial({
        level: num(0, 1.5), octave: int(-12, 12), ratio: num(0.5, 4), index: num(0, 6), floor: num(0, 1), decay: num(0.05, 2), chorus: num(0, 20),
        cutoff: num(800, 9000), release: num(0.05, 1.5), tine: num(0, 1), trem: num(0, 8), tremDepth: num(0, 1),
      }),
      piano: partial({
        level: num(0, 1.5), octave: int(-12, 12), cutoff: num(800, 9000), bright: num(0, 1), decay: num(0.2, 4), release: num(0.05, 1.5),
        hammer: num(0, 1), detune: num(0, 20), width: num(0, 1), double: num(0, 1), drive: num(0, 3),
      }),
      brass: partial({
        level: num(0, 1.5), octave: int(-12, 12), detune: num(0, 30), cutoff: num(500, 8000), env: num(0, 2), swell: num(0.01, 0.3), scoop: num(0, 3),
        scoopTime: num(0.01, 0.2), decay: num(0.05, 1), sustain: num(0, 1), release: num(0.02, 0.6), drive: num(0, 3), vib: num(0, 40), drop: oneOf([0, 1]), min: num(0, 1),
      }),
      lift: partial({ level: num(0, 1.5), bars: int(1, 8), from: num(100, 2000), to: num(1000, 12000), detune: num(0, 40), roll: num(0, 1.5) }),
      chorus: partial({ lead: num(0, 1), harm: num(0, 1) }),
      hall: ukgRoom,
      plate: ukgRoom,
      pump: oneOf([0, 1]),
      vary: oneOf([0, 1]),
      strings: partial({ level: num(0, 1.5), detune: num(0, 40), cutoff: num(400, 6000), attack: num(0.05, 4), release: num(0.1, 4), hold: num(0, 1) }),
      // Pop house v3: the shared voice library (styledata.ts UkgGrandSpec .. UkgBusSpec).
      grand: partial({
        ...ukgWhere, level: num(0, 1.5), octave: int(-12, 12), double: num(0, 1), decay: num(0.4, 4), release: num(0.05, 1.5), bright: num(0, 1), detune: num(0, 4),
        bark: num(0, 1), hammer: num(0, 1), organ: num(0, 1), thin: oneOf([0, 1]),
      }),
      saws: partial({
        ...ukgWhere, level: num(0, 1.5), voices: int(3, 9), detune: num(0, 60), mix: num(0, 1), cutoff: num(300, 12000), env: num(0, 1), fdecay: num(0.02, 1),
        q: num(0.3, 6), attack: num(0.001, 0.5), decay: num(0.03, 2), sustain: num(0, 1), release: num(0.02, 2), width: num(0, 1), sub: num(0, 1), drive: num(0, 3),
        octave: int(-12, 12), follow: oneOf([0, 1]),
      }),
      bed: partial({
        ...ukgWhere, kind: oneOf(["juno", "strings", "choir", "organ"]), level: num(0, 1.5), cutoff: num(300, 9000), lfoBars: oneOf([0, 2, 4, 8, 16, 32, 64]),
        lfoDepth: num(0, 1), attack: num(0.005, 4), release: num(0.05, 4), octave: int(-12, 12), width: num(0, 1), ensemble: num(0, 1),
      }),
      arp: partial({ ...ukgWhere, kind: oneOf(["saw", "guitar", "piano"]), level: num(0, 1.5), octave: int(-12, 24), pan: num(0, 1), cutoff: num(400, 12000), echo: num(0, 1) }),
      gtr: partial({ ...ukgWhere, level: num(0, 1.5), mute: num(0, 1), bright: num(0, 1), pan: num(-1, 1), octave: int(-12, 12) }),
      bass2: partial({
        kind: oneOf(["slap", "saw", "organ", "pluck"]), level: num(0, 1.5), cutoff: num(150, 6000), env: num(0, 1), decay: num(0.02, 1), sustain: num(0, 1),
        release: num(0.02, 0.4), drive: num(0, 5), top: num(0, 1), hp: num(60, 300),
      }),
      horns: partial({
        ...ukgWhere, level: num(0, 1.5), min: num(0, 1), octave: int(-12, 12), cutoff: num(500, 9000), env: num(0, 2), attack: num(0.005, 0.3), decay: num(0.03, 1.5),
        sustain: num(0, 1), release: num(0.02, 1), scoop: num(0, 4), breath: num(0, 1), bones: num(0, 1), fall: num(0, 1), drive: num(0, 3), width: num(0, 1),
      }),
      voc: partial({ level: num(0, 1.5), scoop: num(-7, 7), scoopSec: num(0.005, 0.3), vibrato: num(0, 60), breath: num(0, 1), consonant: num(0, 1), release: num(0.02, 0.6), presence: num(0, 6), duck: num(0, 0.8), bright: num(0, 1), wide: num(0, 1) }),
      drums: partial({
        rideNoise: oneOf([0, 1]),
        kick: num(0, 1.5), knock: num(0, 1.5), click: num(0, 1.5), kickDecay: num(0.1, 0.8), clap: num(0, 1.5), body: num(0, 1.5), wires: num(0, 1.5), tail: num(0.06, 0.5),
        shaker: num(0, 1.5), ride: num(0, 1.5), crash: num(0, 1.5), conga: num(0, 1.5), toms: num(0, 1.5),
      }),
      bus: partial({ tape: num(0, 4), mix: num(0, 1), exciter: num(0, 1), width: num(0, 1), drums: num(0, 4), mud: num(0, 9), carve: num(0, 9) }),
      // Rally House (styledata.ts UkgPsxSpec .. UkgChopSpec, rolls, impact).
      psx: partial({ bits: (x, p, e) => x !== 0 && num(6, 14)(x, p, e), rate: (x, p, e) => x !== 0 && num(6000, 32000)(x, p, e), drive: num(0, 4), lp: num(2000, 16000), harm: num(0, 1), lead: num(0, 1), drums: num(0, 1) }),
      filter: partial({ on: oneOf([0, 1]), lo: num(150, 2000), hi: num(1000, 16000), q: num(0.5, 6), bars: oneOf([0, 8, 16, 32]), depth: num(0, 1) }),
      breaks: partial({
        ...ukgWhere, level: num(0, 1.5), kick: lane(32, true), snare: lane(32, true), ghost: lane(32, true), hat: lane(32, true),
        fillKick: lane(16, true), fillSnare: lane(16, true), fillGhost: lane(16, true), fillHat: lane(16, true), every: oneOf([0, 4, 8, 16]), from: int(0, 15), quiet: oneOf([0, 1]),
      }),
      lanes: partial({ hat: lane(32, true), open: lane(32, true), shaker: lane(32, true), rim: lane(32, true) }),
      chop: partial({ ...ukgWhere, every: int(1, 4) }),
      rolls: oneOf([0, 1]),
      impact: num(0, 1),
      // Synth v2 (styledata.ts UkgV2Spec, docs/sound/SYNTH-V2.md).
      // Rally House phase 6: library voices (styledata.ts UkgSpec.library).
      library: partial({ motif: libraryRef }),
      // Rally House phase 3 (styledata.ts UkgPhrasesSpec): table entries per 8-bar phrase.
      phrases: partial({ progressions: list(1, 16, int(0, 5)), stabs: list(1, 16, int(0, 5)), basslines: list(1, 16, int(0, 5)), motifs: list(1, 16, int(0, 5)), calls: list(1, 16, int(0, 5)) }),
      // Rally House phase 0 (styledata.ts UkgStreetSpec).
      street: partial({ cut: num(0, 9), cutHz: num(150, 600), shelf: num(0, 8), shelfHz: num(1500, 6000), lead: num(0, 8), sat: num(0, 1), clipDrums: num(0, 12), clipMaster: num(0, 9), bassWidth: num(0, 1) }),
      v2: partial({ keys: v2Slot(false), organ: v2Slot(false), pad: v2Slot(false), bass: v2Slot(false), chop: v2Slot(true), motif: v2Slot(false, true) }),
    }),
  },
  triphop: {
    chords: (x, p, e) => {
      if (!isObj(x)) return e(`${p}: expected an object of chords by name, got ${show(x)}`);
      const chord = shape({ root: int(0, 11), voice: list(4, 4, int(-12, 24)), alt: list(4, 4, int(-12, 24)) });
      for (const [name, c] of Object.entries(x)) chord(c, `${p}.${name}`, e);
    },
    progressions: list(1, 6, list(4, 4, (x, p, e) => typeof x !== "string" && e(`${p}: expected a chord name, got ${show(x)}`))),
    statements: list(1, 4, tripHopKeys),
    answers: list(1, 4, tripHopKeys),
    turns: list(1, 4, tripHopKeys),
    space: list(1, 4, tripHopKeys),
    kicks: kickFigures,
    sub: num(0, 1),
    pedal: list(4, 4, int(0, 12)),
    strings: list(2, 5, int(-12, 24)),
    calls: figures(1, 6, note(32, { semi: int(-12, 24) })),
    voicings: list(2, 4, shape({ pad: list(3, 5, int(-12, 24)), root: int(-12, 12) })),
    cuts: list(1, 10, coreNote(32)),
    ...SOUND_CHECKS,
    kit: tripHopKit,
    bass: subSpec,
    bassTone: partial({
      wave: oneOf(waves), cutoff: num(80, 2000), color: num(0, 2000), q: num(0.3, 8), drive: num(0.1, 5), level: num(0.01, 0.3), sustain: num(0.001, 0.3),
    }),
    bowed: padSpec,
    hiphop: hipHop,
    score: scoreCheck,
  },
  lofihouse: {
    vamps,
    stabs: figures(1, 12, coreNote(32)),
    chops: figures(1, 16, coreNote(32, { slice: int(0, 3) })),
    organ: list(2, 8, int(0, 12)),
    sub: num(0, 1),
    ...SOUND_CHECKS,
    kit: lofiKit,
    bass: subSpec,
    organTone: partial({
      drawbars: list(1, 6, tuple(num(0.5, 8), num(0, 1))), drive: num(0.1, 4), cutoff: num(300, 6000), q: num(0.3, 6),
      level: num(0, 0.4), click: num(0, 0.1), sub: num(0, 1),
    }),
    pad: padSpec,
    chop: padSpec,
    pump: partial({ bass: num(0.05, 1), harm: num(0.05, 1), release: num(1, 8) }),
  },
  acid: {
    lines: list(1, 6, both(list(16, 16, acidNote), (x, p, e) => {
      if (Array.isArray(x) && x.filter((n) => n !== null).length < 4) e(`${p}: needs at least 4 notes`);
    })),
    ...SOUND_CHECKS,
    kit: acidKit,
    voice: partial({
      wave: oneOf(["saw", "square"]), cutoff: num(50, 400), envMod: num(300, 4000), resonance: num(1.5, 4.2), decay: num(0.05, 0.6),
      drive: num(0.5, 3), level: num(0.05, 0.4), accent: num(1, 1.6), gate: num(0.1, 4), sweep: num(4, 32), sub: num(0, 1),
    }),
  },
  dubtechno: {
    chords: (x, p, e) => {
      if (!isObj(x)) return e(`${p}: expected an object of chords by name, got ${show(x)}`);
      const chord = shape({ root: int(-12, 12), upper: list(2, 5, int(-12, 26)) });
      for (const [name, c] of Object.entries(x)) chord(c, `${p}.${name}`, e);
    },
    progressions: list(1, 6, shape({
      bars: int(1, 8),
      seq: list(1, 8, (x, p, e) => typeof x !== "string" && e(`${p}: expected a chord name, got ${show(x)}`)),
    })),
    figures: list(1, 6, list(1, 6, int(0, 15))),
    accents: list(1, 6, num(0, 1.5)),
    stabBars: list(1, 16, num(0, 1.5)),
    bassline: list(1, 16, dubSubNote),
    bells: list(1, 6, list(1, 8, tuple(int(0, 63), int(0, 5), num(0, 1.5)))),
    percs: list(1, 8, tuple(int(0, 31), num(0.5, 3), num(0, 1.5))),
    claps: list(1, 8, tuple(int(0, 31), num(0, 1.5))),
    hats: list(1, 16, (x, p, e) => {
      if (!Array.isArray(x) || (x.length !== 2 && x.length !== 3)) return e(`${p}: expected [16th, level] or [16th, level, decay], got ${show(x)}`);
      int(0, 31)(x[0], `${p}[0]`, e);
      num(0, 1.5)(x[1], `${p}[1]`, e);
      if (x.length === 3) num(0.005, 0.5)(x[2], `${p}[2]`, e);
    }),
    ...SOUND_CHECKS,
    kit: dubKit,
    subTone: partial({
      level: num(0, 1.2), octave: num(0, 0.5), lp: num(80, 1000), attack: num(0.002, 0.2), release: num(0.01, 1), drive: num(0.1, 4),
      glide: num(0, 0.5), warmth: num(0, 1),
    }),
    stabTone: partial({
      octave: int(-12, 12), wave: oneOf(waves), detune: num(0, 40), lp: num(150, 4000), env: num(1, 6), envTime: num(0.01, 1), q: num(0.3, 12),
      hp: num(20, 1000), attack: num(0.001, 1), release: num(0.02, 3), gain: num(0, 1.5), pan: num(-1, 1), move: num(0, 1),
      wave2: oneOf([...waves, "pulse"]), mix2: num(0, 1.5), width: num(0.05, 0.5), octave2: int(-12, 24), velLp: num(0, 1),
      engine: oneOf(["osc", "fm", "pluck"]),
      fm: partial({
        ratio: num(0.5, 12), index: num(0, 12), floor: num(0, 1), decay: num(0.01, 2), ratio2: num(0.5, 16), index2: num(0, 12), decay2: num(0.005, 1),
        vel: num(0, 1),
      }),
      pluck: partial({ modes: list(1, 4, num(0.5, 16)), decay: num(0.05, 4), damp: num(0, 2), tone: num(200, 10000), burst: num(0.0002, 0.005), vel: num(0, 1) }),
    }),
    padTone: partial({
      level: num(0, 3), wave: oneOf(waves), detune: num(0, 40), octave: int(-12, 12), lp: num(150, 5000), attack: num(0.01, 8), release: num(0.05, 6),
      hp: num(20, 1000),
    }),
    bellTone: partial({ level: num(0, 3), every: int(1, 8), ratio: num(0.5, 8), index: num(0, 4), decay: num(0.1, 4) }),
    sweep: partial({ stab: num(2, 64), echo: num(2, 64), send: num(0, 1), fb: num(0, 1), breath: num(2, 64) }),
    field: partial({ level: num(0, 3), hz: num(200, 6000) }),
    rumble: partial({ level: num(0, 1.5), lp: num(60, 400), decay: num(0.3, 3), duck: num(0, 1) }),
    echoTone: partial({ width: num(0, 1), alt: int(0, 8), wobble: num(0, 1), rate: num(0.05, 2) }),
    melody: partial({
      level: num(0, 2), wave: oneOf(waves), detune: num(0, 30), octave: int(-12, 24), notes: list(1, 8, int(-12, 24)),
      every: int(1, 16), count: int(1, 4), chance: num(0, 1), attack: num(0.005, 4), hold: num(0, 32), release: num(0.1, 8),
      lp: num(200, 8000), echo: num(0, 1), space: num(0, 1),
    }),
    // The opt-in additions (styledata.ts DubTechnoData kicks / air / hiss): absent = the house kick, field and hiss.
    kicks: list(1, 6, list(0, 16, int(0, 31))),
    air: shape(
      {
        layers: list(1, 6, shape(
          {
            filter: oneOf(["bandpass", "lowpass", "highpass", "crackle", "hum"]), hz: num(40, 8000), q: num(0.3, 8), level: num(0, 3), pan: num(-1, 1),
            cycle: int(1, 64), on: num(0, 1), drift: num(0, 1), swell: num(0, 1),
          },
          ["q", "pan", "cycle", "on", "drift", "swell"],
        )),
        swell: both(
          shape({ every: int(4, 64), chance: num(0, 1), gain: num(1, 16), bars: int(2, 32), rise: int(1, 32), fall: int(1, 16) }, ["bars", "rise", "fall"]),
          (x, p, e) => {
            if (!isObj(x)) return;
            if (x.rise === undefined && x.bars === undefined) e(`${p}: give its length (bars) or its shape (rise, fall)`);
            if (x.rise === undefined && x.fall !== undefined) e(`${p}.fall: needs rise`);
          },
        ),
        floor: num(0, 1),
      },
      ["swell", "floor"],
    ),
    hiss: partial({ hz: num(200, 8000), q: num(0.2, 4), lp: num(500, 16000) }),
  },
  electro: {
    kicks: electroKicks,
    arps: list(1, 6, list(1, 3, int(0, 24))),
    chords: list(2, 8, shape({ bass: int(-12, 12), tones: list(3, 5, int(-12, 24)), third: oneOf([3, 4]), seventh: oneOf([10, 11]) }, ["third", "seventh"])),
    progressions: list(1, 6, list(4, 4, int(0, 7))),
    ghosts: list(1, 6, list(1, 12, shape({ s: int(0, 31), vel: num(0, 1), core: bool }))),
    warps: list(1, 6, list(16, 16, num(0.5, 1.5))),
    chops: list(1, 6, shape({ open: int(0, 15), steps: list(0, 4, int(0, 15)) })),
    riffs: list(1, 6, list(1, 24, shape({ s: int(0, 31), semi: int(-12, 24), len: num(0.25, 16), f: int(0, 15) }))),
    answers: list(1, 6, list(1, 16, shape({ s: int(0, 31), semi: int(-12, 24), len: num(0.25, 16), core: bool }))),
    words: list(1, 6, shape({ s: int(0, 15), syl: list(1, 8, tuple(num(200, 1200), num(600, 3000), oneOf(["k", "t", "p", "s", null]))) })),
    opens: list(1, 6, list(0, 4, int(0, 15))),
    lines: list(1, 6, both(list(6, 16, alienStep), (x, p, e) => {
      if (Array.isArray(x) && x.filter((n) => n !== null).length < 2) e(`${p}: needs at least 2 notes`);
    })),
    stabs: list(1, 6, list(1, 10, shape({ s: int(0, 31), len: num(0.25, 16), core: bool }))),
    arpCells: list(1, 6, list(2, 16, int(0, 11))),
    calls: list(1, 6, shape({ s: int(0, 15), len: num(1, 16), vowels: list(1, 4, formant) })),
    // The machine-electro additions (styledata.ts ElectroSeqSpec, ElectroMetalSpec, ElectroJitter): off unless given.
    seq: both(
      shape(
        {
          notes: list(3, 16, (x, p, e) => (x === null ? undefined : int(-12, 24)(x, p, e))),
          rate: int(1, 4), octave: int(-24, 12), follow: bool, gate: num(0.25, 4), level: num(0, 1.2), accent: num(0, 1), evolve: int(0, 32),
        },
        ["rate", "octave", "follow", "gate", "level", "accent", "evolve"],
      ),
      (x, p, e) => {
        if (isObj(x) && Array.isArray(x.notes) && x.notes.filter((n) => n !== null).length < 2) e(`${p}.notes: needs at least 2 notes`);
      },
    ),
    metal: both(
      shape(
        { steps: list(3, 16, num(0, 1)), freq: num(200, 6000), ratio: num(0.5, 8), index: num(0, 8), decay: num(0.01, 0.4), level: num(0, 0.5), pan: num(0, 1), jitter: num(0, 15) },
        ["freq", "ratio", "index", "decay", "level", "pan", "jitter"],
      ),
      (x, p, e) => {
        if (isObj(x) && Array.isArray(x.steps) && !x.steps.some((n) => typeof n === "number" && n > 0)) e(`${p}.steps: needs at least one hit`);
      },
    ),
    jitter: partial({ hat: num(0, 15), ghost: num(0, 15) }),
    ...SOUND_CHECKS,
    kit: electroKit,
    bassTone: partial({
      osc: list(1, 4, shape({ type: oneOf([...waves, "pulse25", "pulse12"]), detune: num(-40, 40), level: num(0, 1) })),
      cutoff: num(60, 1200), color: num(0, 3000), q: pair(0.3, 14), open: pair(1, 12), decay: pair(0.01, 0.5), drive: num(0.1, 5),
      level: pair(0.02, 0.3), sub: pair(0, 2), glide: num(0.001, 0.2), fm: pair(0, 4), ratio: num(0.5, 4),
      fold: int(28, 52), gate: pair(0.2, 4),
      body: shape({ level: num(0, 1.5), drive: num(0.5, 6), lp: num(200, 4000), hp: num(60, 600) }, ["hp"]),
      drift: num(0, 20), subWave: oneOf(["sine", "triangle"]),
    }),
    pad: padSpec,
    voice: partial({ pitch: num(60, 400), bits: int(3, 8), hp: num(100, 2000), lp: num(1000, 8000), level: num(0, 0.15), every: oneOf([2, 4, 8]) }),
    hoover: partial({
      cutoff: num(200, 4000), color: num(0, 4000), q: num(0.3, 8), hp: num(20, 1000), bend: num(0, 12), detune: list(1, 4, num(-50, 50)), level: num(0, 0.4),
    }),
    vox: partial({ ring: num(0.25, 4), level: num(0, 1.2) }),
    laser: partial({ from: num(300, 6000), color: num(0, 4000), q: num(0.3, 12), level: num(0, 0.4) }),
    arp: partial({ open: num(1, 8), color: num(0, 6), cap: num(500, 11000), q: num(0.3, 12), level: num(0, 0.4) }),
    tom: partial({ bend: num(1, 2) }),
    // The attention layer's robot word (styledata.ts RobotWordSpec): quiet by construction (level <= 0.1), echo feedback < 0.7.
    ornament: partial({
      vowels: list(1, 4, tuple(num(150, 1200), num(500, 3500))),
      wave: oneOf(waves),
      steps: int(2, 16),
      octave: int(-24, 24),
      syllable: num(0.5, 4),
      ring: num(0, 4),
      lowpass: num(0, 12000),
      echo: (x, p, e) => (x === null ? undefined : partial({ steps: int(1, 8), feedback: num(0, 0.7) })(x, p, e)),
      level: num(0.01, 0.1),
      slots: list(1, 8, int(0, 15)),
    }),
    machine: machineSpec,
    library: partial({ bass: libraryRef, pad: libraryRef, lead: libraryRef }),
  },
  ambientidm: AMBIENT_CHECKS,
  drone: DRONE_CHECKS,
};

/** Fields whose valid values depend on another table (progression indices / names), checked on the tables in force. */
function crossCheck(genre: DataGenre, data: Record<string, unknown>, p: string, e: Err) {
  // Liquid break lanes are two bars (32) unless the kit asks for four (kit.breakBars 4: 64), all of one length.
  if (genre === "liquid" && isObj(data.kit) && Array.isArray(data.kit.breaks)) {
    const want = data.kit.breakBars === 4 ? 64 : 32;
    data.kit.breaks.forEach((b, i) => {
      if (!isObj(b)) return;
      for (const [k, v] of Object.entries(b)) {
        if (typeof v === "string" && v.length > 0 && v.length !== want) e(`${p}.kit.breaks[${i}].${k}: expected ${want} characters (kit.breakBars ${want === 64 ? 4 : "2, the default"}), got ${v.length}`);
      }
    });
  }
  // Liquid progressions are four chords unless the style sets dnb.chordBars (then 4..8).
  if (genre === "liquid" && Array.isArray(data.progressions) && !(isObj(data.dnb) && data.dnb.chordBars !== undefined)) {
    data.progressions.forEach((prog, i) => {
      if (Array.isArray(prog) && prog.length !== 4) e(`${p}.progressions[${i}]: expected 4 chords (4..8 only with dnb.chordBars), got ${prog.length}`);
    });
  }
  // Liquid walks are two bars (onsets 0..31) unless the style asks for four (dnb.walkBars 4).
  if (genre === "liquid" && Array.isArray(data.walks) && !(isObj(data.dnb) && data.dnb.walkBars === 4)) {
    data.walks.forEach((walk, i) => {
      if (Array.isArray(walk) && walk.length > 12) e(`${p}.walks[${i}]: expected 1..12 entries (a two-bar walk; dnb.walkBars 4 opens 24), got ${walk.length}`);
      if (Array.isArray(walk)) walk.forEach((n, j) => isObj(n) && typeof n.s === "number" && n.s > 31 && e(`${p}.walks[${i}][${j}].s: expected 0..31 (a two-bar walk; dnb.walkBars 4 opens 0..63), got ${n.s}`));
    });
  }
  // With the UK garage voices on, the default chords and progressions are the UK garage ones (9 chords).
  const house = genre === "futuregarage" && ukgOn(data) ? UKG_CHORD_COUNT : 7;
  if (genre === "futuregarage" && Array.isArray(data.progressions)) {
    const n = Array.isArray(data.chords) ? data.chords.length : house;
    data.progressions.forEach((prog, i) => {
      if (Array.isArray(prog)) prog.forEach((c, j) => typeof c === "number" && c >= n && e(`${p}.progressions[${i}][${j}]: chord ${c} is not in chords (0..${n - 1})`));
    });
  } else if (genre === "futuregarage" && Array.isArray(data.chords) && data.chords.length < house) {
    e(`${p}.chords: the house progressions use chords 0..${house - 1}; give ${house} or more chords, or your own progressions`);
  }
  // Ambient IDM's progression indices are checked in baseCheck; here only the house progressions over fewer chords.
  if (genre === "ambientidm" && !Array.isArray(data.progressions) && Array.isArray(data.chords) && data.chords.length < 5) {
    e(`${p}.chords: the house progressions use chords 0..4; give 5 or more chords, or your own progressions`);
  }
  if (genre === "electro" && Array.isArray(data.progressions)) {
    const n = Array.isArray(data.chords) ? data.chords.length : 6;
    data.progressions.forEach((prog, i) => {
      if (Array.isArray(prog)) prog.forEach((c, j) => typeof c === "number" && c >= n && e(`${p}.progressions[${i}][${j}]: chord ${c} is not in chords (0..${n - 1})`));
    });
  } else if (genre === "electro" && Array.isArray(data.chords) && data.chords.length < 6) {
    e(`${p}.chords: the house progressions use chords 0..5; give 6 or more chords, or your own progressions`);
  }
  if (genre === "dubtechno" && Array.isArray(data.progressions)) {
    const names = new Set(["i9", "i11", "iv7", "VI9", "VII9", "v7", ...(isObj(data.chords) ? Object.keys(data.chords) : [])]);
    data.progressions.forEach((prog, i) => {
      const seq = isObj(prog) && Array.isArray(prog.seq) ? prog.seq : [];
      seq.forEach((c, j) => typeof c === "string" && !names.has(c) && e(`${p}.progressions[${i}].seq[${j}]: unknown chord "${c}" (known: ${[...names].join(" ")})`));
    });
  }
  // The hip-hop beat: lane lengths, figure onsets and chord indices against its own bar counts.
  if (genre === "triphop" && isObj(data.hiphop)) {
    const h = data.hiphop;
    const q = `${p}.hiphop`;
    const bars = typeof h.bars === "number" ? h.bars : 1;
    const lanes = (beat: unknown, n: number, at: string) => {
      if (isObj(beat)) for (const [k, v] of Object.entries(beat)) if (typeof v === "string" && v.length !== n * 16) e(`${at}.${k}: expected ${n * 16} characters (${n} bar${n > 1 ? "s" : ""}), got ${v.length}`);
    };
    if (Array.isArray(h.beats)) h.beats.forEach((b, i) => lanes(b, bars, `${q}.beats[${i}]`));
    if (h.fill !== undefined) lanes(h.fill, 1, `${q}.fill`);
    const n = Array.isArray(h.chords) ? h.chords.length : 0;
    if (Array.isArray(h.progression)) h.progression.forEach((c, i) => typeof c === "number" && c >= n && e(`${q}.progression[${i}]: chord ${c} is not in chords (0..${n - 1})`));
    const onsets = (figs: unknown, max: number, at: string) => {
      if (Array.isArray(figs)) figs.forEach((f, i) => Array.isArray(f) && f.forEach((x, j) => isObj(x) && typeof x.s === "number" && x.s >= max && e(`${at}[${i}][${j}].s: expected under ${max} (the figure's 16ths), got ${x.s}`)));
    };
    onsets(h.basslines, (typeof h.bassBars === "number" ? h.bassBars : 1) * 16, `${q}.basslines`);
    if (h.melodies !== undefined && h.melodyBars === undefined) e(`${q}.melodyBars: missing (the melodies' length)`);
    onsets(h.melodies, (typeof h.melodyBars === "number" ? h.melodyBars : 8) * 16, `${q}.melodies`);
    if (Array.isArray(h.voices)) h.voices.forEach((v, i) => isObj(v) && onsets(v.figures, (typeof v.bars === "number" ? v.bars : 8) * 16, `${q}.voices[${i}].figures`));
    if (isObj(h.keys)) onsets(h.keys.figures, (typeof h.keys.bars === "number" ? h.keys.bars : 1) * 16, `${q}.keys.figures`);
    // The opt-in layers: a voice plays a patch or layers (or both); keys layers need the keys; lanes need their voices.
    if (Array.isArray(h.voices)) h.voices.forEach((v, i) => isObj(v) && v.patch === undefined && v.layers === undefined && e(`${q}.voices[${i}]: give it a patch, layers or both`));
    if (isObj(h.keys) && h.keys.patch === undefined && h.keysLayers === undefined) e(`${q}.keys.patch: missing (or give keysLayers)`);
    if (h.keysLayers !== undefined && !isObj(h.keys)) e(`${q}.keysLayers: the keys layers play the keys' figures; give keys`);
    if (h.melodyLayers !== undefined && h.melodies === undefined) e(`${q}.melodyLayers: the melody layers play the melodies; give melodies`);
    for (const lane of ["shaker", "tom"] as const) {
      const used = [...(Array.isArray(h.beats) ? h.beats : []), h.fill].some((b) => isObj(b) && b[lane] !== undefined);
      if (used && h[lane] === undefined) e(`${q}.${lane}: the beats play a ${lane} lane; give its voice`);
    }
    // Beside the beat, Rhodes Break's own tables would do nothing.
    for (const k of ["chords", "progressions", "statements", "answers", "turns", "space", "kicks", "sub", "bass", "bowed"]) {
      if (data[k] !== undefined) e(`${p}.${k}: Rhodes Break's table does nothing beside hiphop (the beat has its own)`);
    }
  }
  if (genre === "triphop" && Array.isArray(data.progressions)) {
    const names = new Set(["i", "iv", "VI", "VII", "v", "IV", ...(isObj(data.chords) ? Object.keys(data.chords) : [])]);
    data.progressions.forEach((prog, i) => {
      if (Array.isArray(prog)) prog.forEach((c, j) => typeof c === "string" && !names.has(c) && e(`${p}.progressions[${i}][${j}]: unknown chord "${c}" (known: ${[...names].join(" ")})`));
    });
  }
}

/** The style a base names, from the house lists of its genre. */
function houseStyle(genre: DataGenre, id: string): GenreStyle | undefined {
  for (const entry of STYLE_SCHEDULE) {
    const hit = entry.styles[genre]?.find((s) => s.id === id);
    if (hit) return hit;
  }
  return undefined;
}

function checkStyle(genre: DataGenre, style: unknown, p: string, e: Err, seen: Set<string>, patchIds: readonly string[]) {
  if (!isObj(style)) return e(`${p}: expected a style object, got ${show(style)}`);
  const allowed = ["id", "name", "base", "bpm", "swing", "microScale", "trim", "riser", "heat", "breakdown", "intro", "keys", "form", "leads", "data"];
  for (const k of Object.keys(style)) if (!allowed.includes(k)) e(`${p}.${k}: unknown field (allowed: ${allowed.join(", ")})`);
  const { id, name, base, bpm, swing, microScale, trim, riser, heat, breakdown, intro, keys, form, leads, data } = style;
  // The style's own song form (styles.ts GenreStyle.form): whole bars, 16..128 of them in all, in 8-bar phrases.
  if (form !== undefined) {
    shape({ intro: int(0, 32), build: int(0, 32), drop: int(8, 64), breakdown: int(0, 32) })(form, `${p}.form`, e);
    if (isObj(form)) {
      const total = ["intro", "build", "drop", "breakdown"].reduce((a, k) => a + (typeof form[k] === "number" ? (form[k] as number) : 0), 0);
      if (total % 8 !== 0 || total < 16 || total > 128) e(`${p}.form: expected 16..128 bars in all, a multiple of 8, got ${total}`);
    }
  }
  // The style's own tonics (styles.ts GenreStyle.keys): 1..4 distinct pitch classes.
  if (keys !== undefined) both(list(1, 4, int(0, 11)), distinct)(keys, `${p}.keys`, e);
  if (typeof id !== "string" || !/^[a-z][a-z0-9-]{1,23}$/.test(id)) e(`${p}.id: expected 2..24 of a-z 0-9 "-" starting with a letter, got ${show(id)}`);
  else if (HOUSE_STYLE_IDS.has(id)) e(`${p}.id: "${id}" is a house style id; give the station style its own id`);
  else if (seen.has(id)) e(`${p}.id: "${id}" is used twice in this pack`);
  else seen.add(id);
  if (typeof name !== "string" || name.trim().length === 0 || name.length > 24) e(`${p}.name: expected 1..24 characters, got ${show(name)}`);
  const bases = Object.keys(DATA_FIELDS[genre]);
  if (typeof base !== "string" || !bases.includes(base) || !houseStyle(genre, base)) {
    return e(`${p}.base: expected one of ${bases.join(", ")} (a ${genre} house style), got ${show(base)}`);
  }
  if (bpm !== undefined) {
    const [lo, hi] = PACK_BPM[genre];
    list(2, 2, num(lo, hi))(bpm, `${p}.bpm`, e);
    if (Array.isArray(bpm) && bpm[0] > bpm[1]) e(`${p}.bpm: expected [low, high], got ${show(bpm)}`);
  }
  // Future garage may swing harder (to an MPC ~65%: the engine delays the odd 16ths by swing - 0.5 of a 16th).
  if (swing !== undefined) num(0.5, genre === "futuregarage" ? 0.8 : 0.68)(swing, `${p}.swing`, e);
  if (microScale !== undefined) num(0, 2.5)(microScale, `${p}.microScale`, e);
  if (trim !== undefined) num(0.25, 3)(trim, `${p}.trim`, e);
  if (riser !== undefined) num(0, 1)(riser, `${p}.riser`, e);
  if (heat !== undefined) num(0, 1)(heat, `${p}.heat`, e);
  // The breakdown's and the intro's own layer levels (styles.ts GenreStyle.breakdown, .intro).
  const layer = num(0, 1);
  const layers = partial({ kick: layer, snare: layer, hat: layer, glitch: layer, bass: layer, pad: layer, lead: layer, texture: layer, bed: layer, filter: layer });
  if (breakdown !== undefined) layers(breakdown, `${p}.breakdown`, e);
  if (intro !== undefined) layers(intro, `${p}.intro`, e);
  if (leads !== undefined) {
    const known = (x: unknown) => typeof x === "string" && (x in LEAD_PATCHES || patchIds.includes(x));
    list(1, 4, (x, q, err) => !known(x) && err(`${q}: unknown lead patch ${show(x)} (leads.ts, or the pack's patches)`))(leads, `${p}.leads`, e);
  }
  if (data === undefined) return;
  if (!isObj(data)) return e(`${p}.data: expected an object, got ${show(data)}`);
  const fields = DATA_FIELDS[genre][base] as readonly string[];
  const checks = FIELD_CHECKS[genre] as Record<string, Check>;
  for (const [k, v] of Object.entries(data)) {
    if (!(k in checks)) e(`${p}.data.${k}: unknown ${genre} table (styledata.ts)`);
    else if (!fields.includes(k)) e(`${p}.data.${k}: base "${base}" does not read it (it reads: ${fields.join(", ")})`);
    else if (v !== undefined) checks[k](v, `${p}.data.${k}`, e);
  }
  crossCheck(genre, data, `${p}.data`, e);
  baseCheck(genre, base, data, `${p}.data`, e);
}

/** A pack's (or a `next` entry's) lead patches: their problems into `e`, the valid ids returned. */
function checkPatches(patches: unknown, p: string, max: number, e: Err): string[] {
  const ids: string[] = [];
  if (patches === undefined) return ids;
  if (!isObj(patches) || Object.keys(patches).length < 1 || Object.keys(patches).length > max) {
    e(`${p}: expected an object of 1..${max} lead patches by id, got ${show(patches)}`);
    return ids;
  }
  for (const [id, patch] of Object.entries(patches)) {
    if (!/^[a-z][a-z0-9-]{1,23}$/.test(id)) e(`${p}.${id}: expected an id of 2..24 a-z 0-9 "-" starting with a letter`);
    else if (id in LEAD_PATCHES) e(`${p}.${id}: "${id}" is a house lead patch; give yours its own id`);
    else ids.push(id);
    PATCH_CHECK(patch, `${p}.${id}`, e);
  }
  return ids;
}

/** A genre pool (`genres`): its problems into `e`, the valid genres returned. */
function checkGenres(genres: unknown, p: string, e: Err): DataGenre[] {
  const pool: DataGenre[] = [];
  if (!Array.isArray(genres)) {
    e(`${p}: expected a list of 1..${DATA_GENRES.length} of ${DATA_GENRES.join(", ")}`);
    return pool;
  }
  if (genres.length < 1 || genres.length > DATA_GENRES.length) e(`${p}: expected 1..${DATA_GENRES.length} genres, got ${genres.length}`);
  genres.forEach((g, i) => {
    if (!(DATA_GENRES as readonly unknown[]).includes(g)) e(`${p}[${i}]: expected one of ${DATA_GENRES.join(", ")}, got ${show(g)}`);
    else if (pool.includes(g as DataGenre)) e(`${p}[${i}]: "${g}" is listed twice`);
    else pool.push(g as DataGenre);
  });
  return pool;
}

/** The most styles a genre may list in a `next` entry (the first lists keep 1..10). */
const NEXT_MAX_STYLES = 16;
/** The most lead patches a `next` entry may add. */
const NEXT_MAX_PATCHES = 16;

/** Every rule a pack breaks, as "path: problem" lines; empty when the pack is valid. */
export function validatePack(pack: unknown): string[] {
  const errors: string[] = [];
  const e: Err = (msg) => void errors.push(msg);
  if (!isObj(pack)) return [`pack: expected an object (export default { key, name, genres, styles }), got ${show(pack)}`];
  const top = ["key", "name", "genres", "styles", "patches", "epochPages", "next"];
  for (const k of Object.keys(pack)) if (!top.includes(k)) e(`${k}: unknown field (allowed: ${top.join(", ")})`);
  const { key, name, genres, styles, patches, epochPages, next } = pack;
  if (epochPages !== undefined) {
    const ok = isObj(epochPages) && Object.keys(epochPages).every((k) => k === "from" || k === "every")
      && Number.isInteger(epochPages.from) && (epochPages.from as number) >= 0 && (epochPages.from as number) <= 0xffffffff
      && Number.isInteger(epochPages.every) && (epochPages.every as number) >= 1 && (epochPages.every as number) <= 4;
    if (!ok) e(`epochPages: expected { from: a page 0..2^32-1, every: 1..4 }, got ${show(epochPages)}`);
  }
  const patchIds = checkPatches(patches, "patches", 8, e);
  if (typeof key !== "string" || !/^[a-z0-9][a-z0-9-]{1,23}$/.test(key)) e(`key: expected 2..24 of a-z 0-9 "-", got ${show(key)}`);
  else if (HOUSE_KEYS.includes(key)) e(`key: "${key}" is a house station`);
  if (typeof name !== "string" || name.trim().length === 0 || name.length > 40) e(`name: expected 1..40 characters, got ${show(name)}`);
  const pool = checkGenres(genres, "genres", e);
  if (!isObj(styles)) return [...errors, `styles: expected an object { <genre>: [style, ...] }`];
  for (const g of Object.keys(styles)) if (!pool.includes(g as DataGenre)) e(`styles.${g}: not in genres`);
  const seen = new Set<string>();
  // Every style and patch defined so far, by id: a later entry may list one again only as the same definition.
  const defined = new Map<string, string>();
  const patchDefs = new Map<string, string>();
  if (isObj(patches)) for (const [id, patch] of Object.entries(patches)) patchDefs.set(id, JSON.stringify(patch));
  for (const g of pool) {
    const list = styles[g];
    if (!Array.isArray(list) || list.length < 1 || list.length > 10) {
      e(`styles.${g}: expected 1..10 styles, got ${Array.isArray(list) ? list.length : show(list)}`);
      continue;
    }
    list.forEach((style, i) => {
      checkStyle(g, style, `styles.${g}[${i}]`, e, seen, patchIds);
      if (isObj(style) && typeof style.id === "string") defined.set(style.id, JSON.stringify({ g, style }));
    });
  }
  if (next !== undefined) {
    if (!Array.isArray(next) || next.length < 1 || next.length > 16) e(`next: expected a list of 1..16 entries { fromEpoch, genres, styles, patches? }, got ${show(next)}`);
    else {
      let last = 0;
      next.forEach((entry, n) => {
        const p = `next[${n}]`;
        if (!isObj(entry)) return e(`${p}: expected { fromEpoch, genres, styles, patches? }, got ${show(entry)}`);
        for (const k of Object.keys(entry)) if (!["fromEpoch", "genres", "styles", "patches"].includes(k)) e(`${p}.${k}: unknown field (allowed: fromEpoch, genres, styles, patches)`);
        const from = entry.fromEpoch;
        if (!Number.isInteger(from) || (from as number) <= last || (from as number) > 0xffffffff) {
          e(`${p}.fromEpoch: expected an epoch after ${last} (entries in increasing order), got ${show(from)}`);
        } else last = from as number;
        const own = checkPatches(entry.patches, `${p}.patches`, NEXT_MAX_PATCHES, e);
        if (isObj(entry.patches)) {
          for (const [id, patch] of Object.entries(entry.patches)) {
            const was = patchDefs.get(id);
            if (was !== undefined && was !== JSON.stringify(patch)) e(`${p}.patches.${id}: "${id}" was defined before as another patch; give a changed patch a new id`);
            patchDefs.set(id, JSON.stringify(patch));
          }
        }
        const ids = [...new Set([...patchIds, ...own])];
        const entryPool = checkGenres(entry.genres, `${p}.genres`, e);
        const lists = entry.styles;
        if (!isObj(lists)) return e(`${p}.styles: expected an object { <genre>: [style, ...] }`);
        for (const g of Object.keys(lists)) if (!entryPool.includes(g as DataGenre)) e(`${p}.styles.${g}: not in ${p}.genres`);
        const here = new Set<string>();
        for (const g of entryPool) {
          const list = lists[g];
          if (!Array.isArray(list) || list.length < 1 || list.length > NEXT_MAX_STYLES) {
            e(`${p}.styles.${g}: expected 1..${NEXT_MAX_STYLES} styles, got ${Array.isArray(list) ? list.length : show(list)}`);
            continue;
          }
          list.forEach((style, i) => {
            const q = `${p}.styles.${g}[${i}]`;
            checkStyle(g, style, q, e, here, ids);
            if (!isObj(style) || typeof style.id !== "string") return;
            const def = JSON.stringify({ g, style });
            const was = defined.get(style.id);
            // A style id, once defined, means one sound (styles.ts): reused only as the same definition.
            if (was !== undefined && was !== def) e(`${q}.id: "${style.id}" was defined before as another style; give a changed sound a new id`);
            defined.set(style.id, def);
          });
        }
      });
    }
  }
  return errors;
}

/** Throws with every problem listed when the pack is invalid. */
export function assertPack(pack: unknown): asserts pack is StationPack {
  const errors = validatePack(pack);
  if (errors.length) throw new Error(`invalid style pack:\n  ${errors.join("\n  ")}`);
}

/**
 * A station style with the base's feel filled in where the pack leaves it out (the base's id and name are its own),
 * and the pack's own lead patches its `leads` name.
 */
function resolveStyle(genre: DataGenre, style: StationStyle, patches: StationPack["patches"]): GenreStyle {
  const { id: _id, name: _name, ...inherit } = houseStyle(genre, style.base)!;
  const own = (style.leads ?? []).filter((id) => patches?.[id]);
  if (!own.length) return { ...inherit, ...style };
  return { ...inherit, ...style, patches: Object.fromEntries(own.map((id) => [id, { id, ...patches![id] }])) };
}

const programs = new WeakMap<StationPack, Program>();

/** One schedule entry's style lists, each style resolved over its base with the patches it may name. */
function resolveLists(genres: readonly DataGenre[], styles: StationPack["styles"], patches: StationPack["patches"]): StyleScheduleEntry["styles"] {
  return Object.fromEntries(genres.map((g) => [g, (styles[g] as readonly StationStyle[]).map((s) => resolveStyle(g, s, patches))]));
}

/**
 * The station's Program: its genres from epoch 0 (first cycle in listed order, then shuffled cycles of the pool,
 * eras.ts eraOf) and its style lists from epoch 0, each style resolved over its base; then each `next` entry from its
 * fromEpoch (its pool cut in exactly there, its lists from there). Validates first (throws).
 * One Program per pack object, so the schedule caches (keyed on the arrays) are shared by every caller.
 * A live station is frozen like the house: changes go in as appended entries, never edits (stations/README.md).
 */
export function programFromPack(pack: StationPack): Program {
  const hit = programs.get(pack);
  if (hit) return hit;
  assertPack(pack);
  const eras: EraScheduleEntry[] = [{ fromEpoch: 0, ids: [...pack.genres] }];
  const styles: StyleScheduleEntry[] = [{ fromEpoch: 0, styles: resolveLists(pack.genres, pack.styles, pack.patches) }];
  for (const entry of pack.next ?? []) {
    eras.push({ fromEpoch: entry.fromEpoch, ids: [...entry.genres], cut: true });
    styles.push({ fromEpoch: entry.fromEpoch, styles: resolveLists(entry.genres, entry.styles, { ...pack.patches, ...entry.patches }) });
  }
  const program: Program = {
    key: pack.key,
    eras,
    styles,
    ...(pack.epochPages ? { epochPages: { ...pack.epochPages } } : {}),
    eachEpoch: true,
  };
  programs.set(pack, program);
  return program;
}
