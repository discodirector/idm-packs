import { playBass808, type Bass808Params } from "./bass/bass808.ts";
import { bassStack } from "./bass/bassStack.ts";
import { playElectroBass, type ElectroBassParams } from "./bass/electroBass.ts";
import { fmBell } from "./bells/fmBell.ts";
import { brass } from "./brass/brass.ts";
import { vox } from "./choirs/vox.ts";
import { playHit, playKick, type HitParams, type KickParams } from "./drums/drums.ts";
import { playFilmSynth, type FilmSynthParams } from "./film/filmSynth.ts";
import { playFeltPiano, type FeltPianoParams } from "./keys/feltPiano.ts";
import { fmKeys } from "./keys/fmKeys.ts";
import { moogLead } from "./leads/moogLead.ts";
import { playPatchLead, type PatchLeadParams } from "./leads/patchLead.ts";
import { supersaw } from "./leads/supersaw.ts";
import { analogPad } from "./pads/analogPad.ts";
import { playElectroPad, type ElectroPadParams } from "./pads/electroPad.ts";
import { pluck } from "./plucks/pluck.ts";
import * as P from "./presets.ts";
import { strings } from "./strings/strings.ts";
import type { LibraryVoice, VoiceCategory, VoiceModule, VoiceParams } from "./types.ts";
import { registerVoiceLibrary } from "./registry.ts";
import { LIQUID_VOICE_ENTRIES } from "./dnb/library.ts";
import { MACHINE_VOICES } from "./machine/library.ts";
import { POP_VOICES } from "./pophouse/library.ts";
import { SYNTHV2_VOICES } from "./v2/library.ts";

// The catalog: every voice of the library on its shelf, with its doc, its rules and its presets (each the exact settings
// an approved pack played it with: presets.ts, extracted from the frozen tags). docs/sound/VOICE-LIBRARY.md is the
// human version of this file.

/** House rules for every sustained voice (Cinematic v2, the "expensive synths" reference). */
const SUSTAINED = [
  "Sustained voices: cutoff at or under ~2.6 kHz, resonance q < 1.6, nothing bright in 2-5 kHz.",
  "No square or pulse waves in a sustained voice (they read as an organ / accordion).",
  "Fuller = more voices, layers and arrangement, never just more reverb.",
] as const;

/** A preset book from presets.ts: the `_oct` note becomes part of the name, gain stays (params.gain x layer level). */
function book<T extends object>(src: Readonly<Record<string, T>>, rename: (name: string) => string = (n) => n): Record<string, Partial<T>> {
  const out: Record<string, Partial<T>> = {};
  for (const [name, v] of Object.entries(src)) {
    const { _oct, ...rest } = v as T & { _oct?: number };
    out[rename(name) + (_oct ? ` (${_oct > 0 ? "+" : ""}${_oct} oct)` : "")] = rest as unknown as Partial<T>;
  }
  return out;
}
const fromModule = <Q extends VoiceParams>(m: VoiceModule<Q>) => ({ defaults: m.defaults, ranges: m.ranges, play: m.play });

const FILM = P.CINEMATIC_SYNTH as unknown as Record<string, FilmSynthParams>;

/** Cinematic voices with their recipe names (cinematic.ts on sound/cinematic: ENS, VIOLINS, CELLI, ...). */
const FILM_NAMES: Record<string, string> = {
  "titan.strings": "ENS (string-ensemble pad)",
  "titan.violins": "VIOLINS (Titan: quicker bow)",
  "titan.spicc": "SPICC (spiccato ostinato)",
  "titan.horn": "HORNS (soft french horns)",
  "titan.stab": "STAB (dark low-brass stab)",
  "titan.braam": "BRAAM (Inception braam)",
  "titan.low": "LOW (celli + basses on the root)",
  "titan.choir": "CHOIR_AH (aah choir)",
  "horizon.choir": "CHOIR_OO (dark ooh choir)",
  "horizon.violins": "VIOLINS",
  "pursuit.celli": "CELLI",
  "horizon.felt": "FELT (felt piano)",
};
const filmBook = (names: readonly string[]) => {
  const out: Record<string, Partial<FilmSynthParams>> = {};
  for (const n of names) out[FILM_NAMES[n] ? `${FILM_NAMES[n]} · ${n}` : n] = FILM[n];
  return out;
};
const filmEntry = (id: string, category: VoiceCategory, doc: string, register: readonly [number, number], names: readonly string[], rules: readonly string[] = SUSTAINED): LibraryVoice<FilmSynthParams> => {
  const presets = filmBook(names);
  const first = Object.keys(presets)[0];
  return { id, category, source: ["cinematic-v2"], doc, rules, register, defaults: presets[first] as FilmSynthParams, presets, preferred: first, play: playFilmSynth };
};

/** The library's bell default: integer ratios (a tuned, harmonic bell), so a bell on a chord tone never rings against it. */
const TUNED_BELL = { ratio1: 2, index1: 1.2, decay1: 0.6, ratio2: 4, index2: 0.3, decay2: 0.05, detune: 4, spread: 0.5, sub: 0, ring: 1.4, lp: 3200, bright: 0.2 };

const BASS808_DEFAULTS: Bass808Params = {
  mode: "808", wave: "sine", level: 1, decay: 0.9, punch: 1.5, punchTime: 0.03, glide: 0.08, drive: 0.6, lp: 600,
  cutoff: 400, env: 1200, envTime: 0.18, q: 2, sub: 0.8,
};

const HAMSTER_BASS = P.HAMSTER_BASS as unknown as Record<string, ElectroBassParams>;
const KICKS = { ...book(P.HIPHOP_KICKS as unknown as Record<string, KickParams>, (n) => `hiphop.${n}`), ...book(P.HAMSTER_KICKS as unknown as Record<string, KickParams>, (n) => `hamster.${n}`) };
const hitBook = (src: Readonly<Record<string, unknown>>, prefix: string) =>
  Object.fromEntries(Object.entries(src).map(([n, layers]) => [`${prefix}.${n}`, { layers } as Partial<HitParams>]));

/** Phase 1: the voices ported from Cinematic v2, Hip-Hop & Trap v3 and Hamster Dark Electro II v2. */
const PHASE1: readonly LibraryVoice[] = [
  // ------------------------------------------------------------------------------------------------------------ keys
  {
    id: "fmKeys", category: "keys", source: ["hiphop-trap-v3"], register: [48, 79],
    doc: "Two-pair FM e-piano (DX7 E.PIANO 1): a body pair and a 14:1 tine bark through a soft drive, index = brightness, Suitcase auto-pan tremolo, tape wow. Rhodes / Wurli comping.",
    rules: ["Comp chords, keep `lp` <= ~3.3 kHz under a lead.", "Wow / tremolo are the lo-fi colour: off for drill-tight keys."],
    ...fromModule(fmKeys), presets: book(P.HIPHOP_FMKEYS), preferred: "boombap.keysLayers0",
  } satisfies LibraryVoice<typeof fmKeys.defaults>,
  {
    id: "feltPiano", category: "keys", source: ["cinematic-v2"], register: [36, 84],
    doc: "Felt piano: stretched sine partials (low two as a detuned pair), two-stage decay, felt thump, velocity lowpass, damper release. Intimate themes and arpeggios in a big hall.",
    rules: ["Dark: cutoff 2.6 kHz, bright 0.25.", "Let it ring: long notes into the hall, sparse left hand."],
    defaults: P.CINEMATIC_PIANO["horizon.felt"] as unknown as FeltPianoParams,
    presets: { "FELT · horizon.felt": P.CINEMATIC_PIANO["horizon.felt"] as unknown as FeltPianoParams },
    play: playFeltPiano,
  } satisfies LibraryVoice<FeltPianoParams>,
  // ------------------------------------------------------------------------------------------------------------ pads
  filmEntry("filmPad", "pads", "Film-synth ensemble pads: 2 saws x 2 unison copies at their own phases, slow drift, slow attack, breathing filter LFO; the string-ensemble bed (ENS), the CS-80 pad, the swell.", [48, 76], ["titan.strings", "neon.cspad", "pursuit.pad", "pursuit.swell"]),
  {
    id: "analogPad", category: "pads", source: ["hiphop-trap-v3"], register: [48, 72],
    doc: "Juno-style pad: saw L / pulse R / square sub centre, highpassed, resonant lowpass swelling with the attack and an LFO, oscillator-drift chorus. A wide moving bed under hip-hop keys.",
    rules: ["Keep the pulse low (<= 0.6) and the cutoff under ~1.3 kHz: it sits under keys, never in front.", ...SUSTAINED.slice(2)],
    ...fromModule(analogPad), presets: book(P.HIPHOP_ANALOGPAD), preferred: "lofi.padLayers0",
  } satisfies LibraryVoice<typeof analogPad.defaults>,
  {
    id: "electroPad", category: "pads", source: ["hamster-electro-2-v2"], register: [48, 64],
    doc: "Dark detuned-saw chord pad (a chord voice: n.chord): per tone 2-3 slow detuned saws plus a faint sine 8va, one dark lowpass breathing over the chord. Ducked by the kick and widened by the ensemble chorus in the pack.",
    rules: ["Voice it low (under ~400 Hz roots) with a 520-650 Hz cutoff: a shadow, not a wash.", "Duck it under the kick (fx/duck.ts, 0.6 / 0.32 s) so it breathes with the groove.", "No triangle drones (v1's hollow sound)."],
    defaults: P.HAMSTER_PADS.blackice as unknown as ElectroPadParams,
    presets: book(P.HAMSTER_PADS as unknown as Record<string, ElectroPadParams>), preferred: "blackice",
    play: playElectroPad,
  } satisfies LibraryVoice<ElectroPadParams>,
  // --------------------------------------------------------------------------------------------------------- strings
  filmEntry("filmStrings", "strings", "Film-synth string sections: legato violins (singing vibrato), celli (marcato into legato), the spiccato ostinato (each copy at its own phase), low strings on the root, a string pulse.", [36, 84],
    ["titan.violins", "horizon.violins", "pursuit.violins", "letters.violins", "pursuit.celli", "letters.cello", "titan.low", "titan.spicc", "pursuit.spicc", "horizon.pulse"]),
  {
    id: "strings", category: "strings", source: ["hiphop-trap-v3"], register: [48, 84],
    doc: "Solina-style string ensemble: 3 saws (outer pair on an opposite-phase drift, centre shimmer), delayed vibrato, bow noise, swelling lowpass. Ominous drill strings, G-funk string pads.",
    rules: ["Highpass 200-280 Hz under a chord (no mud).", ...SUSTAINED],
    ...fromModule(strings), presets: book(P.HIPHOP_STRINGS), preferred: "drill.padLayers0",
  } satisfies LibraryVoice<typeof strings.defaults>,
  // ----------------------------------------------------------------------------------------------------------- brass
  filmEntry("filmBrass", "brass", "Film-synth brass: soft french horns (an ensemble through a horn's 480/1150 Hz body, a gentle scoop), the dark low-brass stab, the braam (low saws an octave deep, driven, the filter opening over 1.6 s).", [36, 72],
    ["titan.horn", "titan.stab", "titan.braam", "neon.braam"], [...SUSTAINED, "No resonant mid-range brass: horns through the formant body, braams under 1.5 kHz."]),
  {
    id: "brass", category: "brass", source: ["hiphop-trap-v3"], register: [48, 76],
    doc: "Brass section stab: a detuned saw per side over an octave-down square, scoop, breath spit, drive, velocity filter blat. Premier / Pete Rock horn stabs.",
    rules: ["Short stabs, not sustained pads (the square under it is for the attack's weight).", "Velocity is the blat: vary it."],
    ...fromModule(brass), presets: book(P.HIPHOP_BRASS), preferred: "boombap.voices0.layers0",
  } satisfies LibraryVoice<typeof brass.defaults>,
  // ---------------------------------------------------------------------------------------------------------- choirs
  filmEntry("filmChoir", "choirs", "Film-synth choirs: a 2x2 saw ensemble through the vowel's formants: \"aah\" (700/1150/2600 Hz) and the darker \"ooh\" (380/820/2300 Hz), slow swell, wide chorus.", [48, 76], ["titan.choir", "horizon.choir"]),
  {
    id: "vox", category: "choirs", source: ["hiphop-trap-v3"], register: [48, 76],
    doc: "Formant voice: saw + pulse buzz (1..4 unison per side) and breath through 4 formants per side, vowel morph A -> B: with one voice and a glide a talk box, with four a choir.",
    rules: ["Choir: 2-4 voices, pulse 0, slow morph, delayed vibrato.", "Talk box: 1 voice, glide, quick morph; keep it out of dark styles' upper mids."],
    ...fromModule(vox), presets: book(P.HIPHOP_VOX), preferred: "drill.voices1.layers0",
  } satisfies LibraryVoice<typeof vox.defaults>,
  // ---------------------------------------------------------------------------------------------------------- plucks
  {
    id: "pluck", category: "plucks", source: ["hiphop-trap-v3"], register: [40, 84],
    doc: "Karplus-Strong plucked string (pick shape + seeded noise, damped loop), exact pitch by playback rate, detuned double. Guitar, harp, koto, pizzicato.",
    rules: ["Dark body (800-2600 Hz) for under-the-beat figures; bright picks only as a lead."],
    ...fromModule(pluck), presets: book(P.HIPHOP_PLUCK), preferred: "lofi.voices1.layers0",
  } satisfies LibraryVoice<typeof pluck.defaults>,
  filmEntry("filmPluck", "plucks", "Film-synth pluck: a saw and a triangle, a fast filter blip into a long echo (Blade Runner plucks).", [48, 84], ["neon.pluck"], ["Echo, not reverb, carries it.", ...SUSTAINED.slice(0, 1)]),
  // ----------------------------------------------------------------------------------------------------------- bells
  {
    id: "fmBell", category: "bells", source: ["hiphop-trap-v3"], register: [60, 96],
    doc: "3-op FM bell: two modulators each with its own index fall on twin detuned carriers L/R, sub body, motor tremolo option. Music boxes, celestas, mallets, trap bells.",
    rules: [
      "Tuned to the chord: play chord tones only, and prefer integer ratios (the `tuned` preset, the library default): no inharmonic ringing against the harmony.",
      "The trap / drill inharmonic presets (3.5 / 7.07) are for sparse melodies, never sustained under a chord change.",
      "No pitched ringing metal rides or bells in dark styles.",
    ],
    defaults: { ...fmBell.defaults, ...TUNED_BELL }, ranges: fmBell.ranges,
    presets: { tuned: TUNED_BELL, "hiphop default (inharmonic)": fmBell.defaults, ...book(P.HIPHOP_FMBELL) }, preferred: "tuned",
    play: fmBell.play,
  } satisfies LibraryVoice<typeof fmBell.defaults>,
  // ----------------------------------------------------------------------------------------------------------- leads
  {
    id: "moogLead", category: "leads", source: ["hiphop-trap-v3"], register: [60, 88],
    doc: "Minimoog mono lead: saw + pulse + sine gliding into a driven 24 dB ladder with envelope and key tracking, delayed vibrato, a sine whistle 8va. The G-funk whistle.",
    rules: ["Whistle up and saw down for the G-funk sine; saw up for a buzzier line.", "No reedy / accordion-like bright pulse leads in dark styles."],
    ...fromModule(moogLead), presets: book(P.HIPHOP_MOOGLEAD), preferred: "gfunk.melodyLayers0",
  } satisfies LibraryVoice<typeof moogLead.defaults>,
  {
    id: "patchLead", category: "leads", source: ["hamster-electro-2-v2"], register: [36, 72],
    doc: "The engine's lead-patch voice: a stacked oscillator patch (detuned saws, an octave-down layer) with drive, an enveloped lowpass or two vowel formants, vibrato. Hamster v2's stacked driven saw leads: Foghorn, Cold Pluck, Talkbox.",
    rules: ["Dark styles: low register, closed lowpass (600-1500 Hz), drive for density.", "No reedy / accordion-like bright pulse leads: a pulse only as one layer under saws."],
    defaults: P.HAMSTER_LEADS.foghorn as unknown as PatchLeadParams,
    presets: book(P.HAMSTER_LEADS as unknown as Record<string, PatchLeadParams>), preferred: "foghorn",
    play: playPatchLead,
  } satisfies LibraryVoice<PatchLeadParams>,
  filmEntry("filmLead", "leads", "Film-synth singing lead (the CS-80 lead): two saws and a triangle an octave down, slow vibrato, glide.", [55, 84], ["neon.cslead"]),
  {
    id: "supersaw", category: "leads", source: ["hiphop-trap-v3"], register: [48, 84],
    doc: "Unison saw stack (3..9 voices at their own phases, JP-8000 detune curve) split L/R through two lowpasses, centre sine, filter envelope + LFO. Big chords, trance-ish leads. (In the library, not used by an approved pack yet.)",
    rules: SUSTAINED,
    ...fromModule(supersaw), presets: { default: supersaw.defaults },
  } satisfies LibraryVoice<typeof supersaw.defaults>,
  // ------------------------------------------------------------------------------------------------------------ bass
  {
    id: "bassStack", category: "bass", source: ["hiphop-trap-v3"], register: [24, 48],
    doc: "Layered bass in three bands: a clean sine sub, a driven saw / triangle growl (hp, enveloped resonant lp) and a click top, on one pitch line with 808 punch, fall and glide. Trap / drill distorted 808s, the G-funk Moog bass.",
    rules: ["`growlAttack` on bass lines that move off the kick: 808 transients between kicks read as messy drums (\"сбитая драмка\").", "Sub stays clean and mono."],
    ...fromModule(bassStack), presets: book(P.HIPHOP_BASSSTACK), preferred: "trap.bassLayers0",
  } satisfies LibraryVoice<typeof bassStack.defaults>,
  {
    id: "bass808", category: "bass", source: ["hiphop-trap-v3"], register: [24, 48],
    doc: "The hip-hop bass: \"808\" (sine / triangle with pitch punch or glide, driven, lowpassed, falling over `decay`) or \"synth\" (saw + square through an enveloped resonant lowpass over a sine: G-funk).",
    rules: ["Mono by composition: each note ends where the next begins.", "No 808 transients between kicks (glide instead of re-punching)."],
    defaults: BASS808_DEFAULTS,
    presets: Object.fromEntries(Object.entries(P.HIPHOP_BASS).map(([k, v]) => [k, { ...v } as Partial<Bass808Params>])), preferred: "boombap",
    play: playBass808,
  } satisfies LibraryVoice<Bass808Params>,
  {
    id: "electroBass", category: "bass", source: ["hamster-electro-2-v2"], register: [24, 48],
    doc: "The fat electro bass: 3-4 detuned oscillators with analog drift, a 24 dB (client) or swept resonant (alien, + FM snarl) lowpass, a parallel driven body for 90 Hz-1 kHz, a clean mono sub an octave down.",
    rules: ["Filter floor 290-340 Hz (a bare fundamental + sub sounds hollow).", "The body is what small speakers hear: keep it on.", "Sub mono; widen only above ~260 Hz (fx/ensemble.ts ensembleChorus hp 260)."],
    defaults: HAMSTER_BASS.blackice,
    presets: book(HAMSTER_BASS), preferred: "blackice",
    play: playElectroBass,
  } satisfies LibraryVoice<ElectroBassParams>,
  filmEntry("filmBass", "bass", "Film-synth bass: a saw and a triangle through a dark lowpass, slow bow (the CS-80 bass of a noir cue).", [24, 48], ["neon.csbass"]),
  // ----------------------------------------------------------------------------------------------------------- drums
  {
    id: "kick", category: "drums", source: ["hiphop-trap-v3", "hamster-electro-2-v2"], register: [36, 36],
    doc: "Synth kick: a swept sine body (optionally driven), a highpassed noise click and the opt-in punch knock (a 140-185 Hz triangle falling to 0.6x: the kick heard on small speakers).",
    rules: ["Punch layer for any kick that must read on a phone.", "Click 0.1-0.5; drive <= 2."],
    defaults: P.HAMSTER_KICKS.blackice as unknown as KickParams, presets: KICKS, preferred: "hamster.blackice",
    play: playKick,
  } satisfies LibraryVoice<KickParams>,
  {
    id: "hit", category: "drums", source: ["hiphop-trap-v3", "hamster-electro-2-v2", "cinematic-v2"], register: [38, 38],
    doc: "Layered drum hit: pitched bodies, filtered noise bursts, crushed cracks and the house clap fired together. Snares (body / ring / snap / tail), claps, rims, taikos, toms, timpani, ticks.",
    rules: [
      "Snares dry unless the pack says otherwise (a body + a snap + a short noise tail; the plate send is the pack's choice).",
      "Hats are not a constant dry 16th carpet: vary velocity, gaps, open hats.",
      "No pitched ringing metal (rides, bells) clashing with the harmony.",
    ],
    defaults: { layers: P.HAMSTER_SNARES.blackice } as unknown as HitParams,
    presets: { ...hitBook(P.HIPHOP_SNARES, "hiphop"), ...hitBook(P.HAMSTER_SNARES, "hamster"), ...hitBook(P.CINEMATIC_DRUMS, "cinematic") },
    preferred: "hamster.blackice",
    play: playHit,
  } satisfies LibraryVoice<HitParams>,
];

/**
 * Every voice: phase 1, then phase 2's imports (docs/sound/VOICE-LIBRARY.md "Phase 2"): Machine Electro v4.2,
 * Pop House v3, Liquid DnB v7 and the Synth v2 voices, each through its pack's own code and an adapter, ordered by
 * shelf within each pack.
 */
export const LIBRARY: readonly LibraryVoice[] = [...PHASE1, ...MACHINE_VOICES, ...POP_VOICES, ...LIQUID_VOICE_ENTRIES, ...SYNTHV2_VOICES];

/** The shelves in the order the audition and the dev page show them. */
export const SHELVES: readonly VoiceCategory[] = ["keys", "pads", "strings", "brass", "choirs", "plucks", "bells", "leads", "bass", "drums", "fx"];

/** The catalog by id. */
export const LIBRARY_BY_ID: Readonly<Record<string, LibraryVoice>> = Object.fromEntries(LIBRARY.map((v) => [v.id, v]));
if (Object.keys(LIBRARY_BY_ID).length !== LIBRARY.length) throw new Error("voice library: duplicate voice ids");
registerVoiceLibrary(LIBRARY_BY_ID);

/** The catalog by shelf, in catalog order. */
export function shelf(category: VoiceCategory): LibraryVoice[] {
  return LIBRARY.filter((v) => v.category === category);
}

/** A voice's params: a preset (or its preferred one, or its defaults) merged over its defaults, then `over`. */
export function paramsOf<T extends object>(v: LibraryVoice<T>, preset?: string, over?: Partial<T>): T {
  const name = preset ?? v.preferred;
  const base = name ? v.presets[name] : undefined;
  if (preset && !base) throw new Error(`voice ${v.id}: no preset "${preset}"`);
  return { ...v.defaults, ...(base ?? {}), ...(over ?? {}) } as T;
}
