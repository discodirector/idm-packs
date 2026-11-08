import { hash32 } from "../hash.ts";
import { LIBRARY_BY_ID, paramsOf } from "./catalog.ts";
import { createHost } from "./host.ts";
import type { LibraryVoice, VoiceCategory, VoiceSource } from "./types.ts";

// The label's sample packs from the voice library (docs/X402-MUSIC.md section 3, docs/sound/VOICE-LIBRARY.md): every
// preset of every voice, as multi-sampled notes (melodic voices, with an SFZ map so a sampler plays them as an
// instrument) or one-shots (drums), grouped into four packs by the approved pack each preset comes from. This file is
// the plan (what to render and how files are named) and the note renderer; bot/scripts/music-samples.ts renders the
// plan in headless Chromium and zips it. Not used by the engine.

export const SAMPLE_RATE = 44100;

/** One rendered file: a note of a preset (or a drum's one-shot). */
export interface SampleNote {
  /** File name in its preset folder, `.wav` included. */
  file: string;
  midi: number;
  vel: number;
  /** Held length, s (the voice's release follows). */
  hold: number;
  /** Render length, s: the hold and room for the release; the tail is trimmed after rendering. */
  seconds: number;
  /** SFZ key range this note covers (melodic voices). */
  lokey: number;
  hikey: number;
}

export interface SamplePreset {
  voice: string;
  /** The library's preset name (catalog.ts). */
  preset: string;
  /** File-safe name: "<voice>-<preset>", unique in the pack. */
  slug: string;
  category: VoiceCategory;
  /** "multi": notes over the register + an SFZ; "one-shot": one hit. */
  mode: "multi" | "one-shot";
  notes: SampleNote[];
}

export interface SamplePackPlan {
  /** Shop id (packs.json): lower-case, digits, dashes. */
  id: string;
  title: string;
  kind: "voices" | "drums";
  /** Public genres (bot catalog GENRES) the pack suits. */
  genres: string[];
  /** One plain line on what is inside (the shop lists it). */
  blurb: string;
  presets: SamplePreset[];
}

/** Notes every minor third: each sample is played at most a semitone and a half off its own pitch. */
export const NOTE_STEP = 3;
/** At most this span (semitones) of a voice's register, centred: two octaves. */
export const MAX_SPAN = 24;
/** Melodic samples are played at this velocity (drums at full). */
export const NOTE_VEL = 0.85;
/** The song form's openness the voices see (as the library's audition plays them). */
export const BRIGHT = 0.85;
/** Trailing samples quieter than this (-80 dBFS) are trimmed; the last 10 ms fade to zero. */
export const TRIM_FLOOR = 1e-4;
/** Each preset is scaled so its loudest note peaks here (-1 dBFS); its notes keep their balance. */
export const PEAK_TARGET = 10 ** (-1 / 20);

/** A preset its pack played muted (level or gain 0: the style used another voice there) has no sound to sell. */
export function isMuted(params: object): boolean {
  const p = params as { level?: unknown; gain?: unknown };
  return p.level === 0 || p.gain === 0;
}

/** Hold and release room per shelf, s. */
const TIMING: Record<VoiceCategory, { hold: number; tail: number }> = {
  pads: { hold: 3, tail: 4 },
  strings: { hold: 3, tail: 4 },
  choirs: { hold: 3, tail: 4 },
  brass: { hold: 2, tail: 3 },
  keys: { hold: 1.5, tail: 4 },
  plucks: { hold: 0.5, tail: 3 },
  bells: { hold: 0.5, tail: 4 },
  leads: { hold: 1.5, tail: 2.5 },
  bass: { hold: 1, tail: 2 },
  drums: { hold: 0.2, tail: 3 },
  fx: { hold: 0.5, tail: 3 },
};

const NOTE_NAMES = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];
/** "C4" = MIDI 60; sharps as "s" (file-safe): 61 = "Cs4". */
export const noteName = (midi: number) => `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
export const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** A preset's file-safe name: the cue path of a film preset ("ENS (...) · titan.strings" -> "titan-strings"), layer numbers kept short. */
export function presetSlug(preset: string): string {
  const path = preset.includes(" · ") ? preset.split(" · ").pop()! : preset;
  return path
    .replace(/\(\+(\d) oct\)/g, "up$1")
    .replace(/\(-(\d) oct\)/g, "down$1")
    .replace(/\.?[lL]ayers(\d+)/g, (_, d: string) => (d === "0" ? "" : `-${d}`))
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "fmKeys" -> "fm-keys". */
export const voiceSlug = (id: string) => id.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/** The notes a melodic preset is sampled at: every NOTE_STEP over at most MAX_SPAN of the register, centred. */
export function sampleMidis(register: readonly [number, number]): number[] {
  const [lo, hi] = register;
  const span = Math.min(MAX_SPAN, hi - lo);
  const from = lo + Math.floor((hi - lo - span) / 2);
  const out: number[] = [];
  for (let m = from; m <= from + span; m += NOTE_STEP) out.push(m);
  return out;
}

/**
 * A preset's public name: the voice and the preset ("fm-keys-boombap-keys"); drum kits by their part and world
 * ("kick-boombap", "snare-electro-blackice", "film-titan-taiko").
 */
export function sampleSlug(voice: string, preset: string): string {
  const world = /^(hiphop|hamster|cinematic)\./.exec(preset)?.[1];
  const rest = presetSlug(world ? preset.slice(world.length + 1) : preset);
  if (voice === "kick" || voice === "hit") {
    if (world === "cinematic") return `film-${rest}`;
    return `${voice === "kick" ? "kick" : "snare"}-${world === "hamster" ? "electro-" : ""}${rest}`;
  }
  return `${voiceSlug(voice)}-${rest}`;
}

function planPreset(v: LibraryVoice, preset: string): SamplePreset {
  const slug = sampleSlug(v.id, preset);
  const { hold, tail } = TIMING[v.category];
  if (v.category === "drums") {
    const midi = v.register[0];
    return { voice: v.id, preset, slug, category: v.category, mode: "one-shot", notes: [{ file: `${slug}.wav`, midi, vel: 1, hold, seconds: hold + tail, lokey: midi, hikey: midi }] };
  }
  const midis = sampleMidis(v.register);
  const half = Math.floor(NOTE_STEP / 2);
  const notes = midis.map((midi, k) => ({
    file: `${slug}-${String(midi).padStart(3, "0")}-${noteName(midi)}.wav`,
    midi,
    vel: NOTE_VEL,
    hold,
    seconds: hold + tail,
    // Each note covers up to half a step either side; the outer notes reach a few semitones past the sampled span.
    lokey: k === 0 ? Math.max(0, midi - 5) : midi - half,
    hikey: k === midis.length - 1 ? Math.min(127, midi + 5) : midi + (NOTE_STEP - 1 - half),
  }));
  return { voice: v.id, preset, slug, category: v.category, mode: "multi", notes };
}

/** Which pack a preset goes to: its own approved pack when the preset names one (drum kits are shared), else the voice's. */
function sourceOf(v: LibraryVoice, preset: string): VoiceSource {
  if (preset.startsWith("hamster.")) return "hamster-electro-2-v2";
  if (preset.startsWith("hiphop.")) return "hiphop-trap-v3";
  if (preset.startsWith("cinematic.")) return "cinematic-v2";
  return v.source[0]!;
}

const PACKS: { id: string; title: string; kind: "voices" | "drums"; source: VoiceSource | null; genres: string[]; blurb: string }[] = [
  {
    id: "idm-voices-film", title: "IDM Voices: Film", kind: "voices", source: "cinematic-v2", genres: ["Cinematic"],
    blurb: "Film strings, ensemble pads, horns, choirs, felt piano, pluck, lead and bass",
  },
  {
    id: "idm-voices-hiphop", title: "IDM Voices: Hip-Hop", kind: "voices", source: "hiphop-trap-v3", genres: ["Hip-Hop"],
    blurb: "FM e-piano, analog pads, string ensemble, brass, vocal pads, plucks, bells, leads and 808 basses",
  },
  {
    id: "idm-voices-electro", title: "IDM Voices: Dark Electro", kind: "voices", source: "hamster-electro-2-v2", genres: ["Electro"],
    blurb: "Dark electro pads, fat electro basses and lead patches",
  },
  {
    id: "idm-drums", title: "IDM Drums", kind: "drums", source: null, genres: ["Hip-Hop", "Electro", "Cinematic"],
    blurb: "Kicks, snares, claps and film percussion (taiko, toms, timpani, booms, risers, ticks) as one-shots",
  },
];

/** The sample pack a preset goes to (its index in PACKS), or -1 when its source has no pack yet. */
function packOf(v: LibraryVoice, preset: string): number {
  return v.category === "drums" ? PACKS.findIndex((p) => p.kind === "drums") : PACKS.findIndex((p) => p.source === sourceOf(v, preset));
}

/** True when a preset belongs in one of the sample packs (its source has a pack; the library's later shelves do not yet). */
export const inSamplePacks = (v: LibraryVoice, preset: string) => packOf(v, preset) >= 0;

/** The four sample packs: every sounding preset of the library in exactly one (drums in IDM Drums, the rest by source). */
export function samplePacks(): SamplePackPlan[] {
  const plans = PACKS.map((p) => ({ id: p.id, title: p.title, kind: p.kind, genres: p.genres, blurb: p.blurb, presets: [] as SamplePreset[] }));
  for (const v of Object.values(LIBRARY_BY_ID)) {
    for (const preset of Object.keys(v.presets)) {
      if (isMuted(paramsOf(v as LibraryVoice<object>, preset))) continue;
      const k = packOf(v, preset);
      // Voices from packs that have no sample pack yet (the library's later shelves) are left out.
      if (k < 0) continue;
      plans[k]!.presets.push(planPreset(v, preset));
    }
  }
  return plans;
}

/** Renders one planned note into `ctx` (an OfflineAudioContext of note.seconds at SAMPLE_RATE): the voice dry, centred. */
export function playSample(ctx: BaseAudioContext, p: Pick<SamplePreset, "voice" | "preset">, note: SampleNote) {
  const v = LIBRARY_BY_ID[p.voice];
  if (!v) throw new Error(`no voice ${p.voice}`);
  const params = paramsOf(v as LibraryVoice<object>, p.preset);
  const h = createHost(ctx, ctx.destination);
  v.play(h, { time: 0, freq: midiToFreq(note.midi), length: note.hold, vel: note.vel, pan: 0, bright: BRIGHT, seed: hash32(note.midi, 0x5a3) % 4096 }, params);
}

/**
 * Where a rendered sample ends: after its last sample above TRIM_FLOOR, plus 10 ms (whole frames, at most the
 * buffer). The caller fades the last 10 ms to zero.
 */
export function trimEnd(channels: readonly Float32Array[], sampleRate = SAMPLE_RATE): number {
  const n = channels[0]?.length ?? 0;
  let last = 0;
  for (const ch of channels) for (let i = n - 1; i > last; i--) if (Math.abs(ch[i]!) > TRIM_FLOOR) { last = i; break; }
  return Math.min(n, last + 1 + Math.round(0.01 * sampleRate));
}

/** Trims a rendered sample (trimEnd) and fades its last 10 ms out (raised cosine), in place on copies. */
export function finishSample(channels: readonly Float32Array[], sampleRate = SAMPLE_RATE): Float32Array[] {
  const end = trimEnd(channels, sampleRate);
  const fade = Math.min(end, Math.round(0.01 * sampleRate));
  return channels.map((ch) => {
    const out = ch.slice(0, end);
    for (let i = 0; i < fade; i++) out[end - 1 - i] = out[end - 1 - i]! * (0.5 - 0.5 * Math.cos((Math.PI * i) / fade));
    return out;
  });
}

/** The gain that brings a preset's loudest note (its peak, linear) to PEAK_TARGET; 1 for silence. */
export function presetGain(peak: number): number {
  return peak > 0 ? PEAK_TARGET / peak : 1;
}

/** Shelves whose notes ring out on their own (one-shot in a sampler); the rest stop on key release. */
const RING_OUT: readonly VoiceCategory[] = ["plucks", "bells", "drums"];

/**
 * The SFZ map of a multi-sampled preset: one region per note, keys as planned. Plucks and bells play out whole;
 * held voices play while the key is down (up to their sampled hold) and fade over 0.3 s after it.
 */
export function sfzOf(p: SamplePreset, title: string): string {
  const lines = [
    `// ${title}: ${p.slug} (IDM, theidm.fun)`,
    `// ${p.notes.length} notes every ${NOTE_STEP} semitones, WAV 24-bit ${SAMPLE_RATE} Hz stereo, velocity ${NOTE_VEL}, loudest note at -1 dBFS.`,
    RING_OUT.includes(p.category) ? "<group> loop_mode=one_shot" : "<group> loop_mode=no_loop ampeg_release=0.3",
    ...p.notes.map((n) => `<region> sample=${n.file} lokey=${n.lokey} hikey=${n.hikey} pitch_keycenter=${n.midi}`),
    "",
  ];
  return lines.join("\n");
}
