import { hash32 } from "../hash.ts";
import { LIBRARY_BY_ID, paramsOf } from "./catalog.ts";
import { ensembleChorus, stringEnsemble, type StringEnsembleSpec } from "./fx/ensemble.ts";
import { glue, tape } from "./fx/bus.ts";
import { sidechain } from "./fx/duck.ts";
import { hall, plate, type HallSpec } from "./fx/space.ts";
import { createHost, PairBus } from "./host.ts";
import * as PRESETS from "./presets.ts";
import type { LibraryVoice, VoiceHost, VoiceNote } from "./types.ts";

// The library's audition: one short phrase per voice role (C minor, 96 BPM, two bars), dry or in context (its pack's
// bed and bus fx). Used by web/scripts/voice-library/audition.mjs (sim/voice-library/v1) and the dev page
// site/voices.html. Not used by the engine.

export const BPM = 96;
export const S16 = 60 / BPM / 4;
export const BAR = 16 * S16;
export const T0 = 0.05;
export const TAIL = 1.6;
export const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);

export interface Entry {
  id: string;
  voice: string;
  preset: string;
  category: string;
  source: string;
}

/** What each audition entry plays: [voice id, preset (omitted: the preferred one), the phrase kind, base MIDI]. */
export type Kind = "line" | "chords" | "bass" | "beat" | "snare" | "chordvoice" | "hats" | "hits" | "fill" | "stabs";
export const PLAN: [string, string | undefined, Kind, number][] = [
  ["fmKeys", undefined, "chords", 60],
  ["feltPiano", undefined, "line", 60],
  ["filmPad", undefined, "chords", 60],
  ["filmPad", "neon.cspad", "chords", 60],
  ["analogPad", undefined, "chords", 60],
  ["electroPad", undefined, "chordvoice", 50],
  ["filmStrings", "VIOLINS · horizon.violins", "line", 72],
  ["filmStrings", "CELLI · pursuit.celli", "line", 48],
  ["filmStrings", "SPICC (spiccato ostinato) · titan.spicc", "line", 60],
  ["strings", undefined, "chords", 60],
  ["filmBrass", undefined, "line", 60],
  ["filmBrass", "BRAAM (Inception braam) · titan.braam", "bass", 36],
  ["brass", undefined, "line", 60],
  ["filmChoir", undefined, "chords", 60],
  ["filmChoir", "CHOIR_OO (dark ooh choir) · horizon.choir", "chords", 60],
  ["vox", undefined, "chords", 60],
  ["vox", "gfunk.voices0.layers0", "line", 60],
  ["pluck", undefined, "line", 60],
  ["filmPluck", undefined, "line", 72],
  ["fmBell", undefined, "line", 72],
  ["moogLead", undefined, "line", 72],
  ["patchLead", "foghorn", "line", 48],
  ["patchLead", "talkbox", "line", 60],
  ["filmLead", undefined, "line", 72],
  ["supersaw", undefined, "chords", 60],
  ["bassStack", undefined, "bass", 36],
  ["bass808", undefined, "bass", 36],
  ["electroBass", undefined, "bass", 36],
  ["electroBass", "servo", "bass", 36],
  ["filmBass", undefined, "bass", 36],
  ["kick", undefined, "beat", 36],
  ["kick", "hiphop.boombap", "beat", 36],
  ["hit", undefined, "snare", 38],
  ["hit", "hiphop.boombap", "snare", 38],
  ["hit", "cinematic.titan.taiko", "beat", 38],
];

const LINE: [number, number, number, number][] = [[0, 3, 7, 0.9], [3, 3, 3, 0.6], [6, 2, 0, 0.75], [8, 6, 2, 1], [16, 2, 3, 0.55], [18, 2, 5, 0.85], [20, 4, 7, 0.7], [24, 8, 0, 0.95]];
const CHORDS: [number, number[]][] = [[0, [0, 3, 7]], [16, [-4, 0, 3]]];
const BASSLINE: [number, number, number, number][] = [[0, 3, 0, 1], [3, 2, 0, 0.6], [6, 2, 3, 0.85], [8, 4, 0, 0.9], [14, 2, -2, 0.7], [16, 3, -4, 1], [19, 2, -4, 0.6], [22, 2, 0, 0.85], [24, 6, -5, 0.9], [30, 2, -2, 0.7]];
const KICKS = [0, 6, 10, 16, 22, 26];
const SNARES = [4, 12, 20, 28];
/** Hats and shakers: 8ths with accents and gaps (never a flat 16th carpet). */
const HATS: [number, number][] = [[2, 0.9], [6, 0.7], [8, 0.35], [10, 0.95], [14, 0.6], [18, 0.9], [22, 0.75], [24, 0.4], [26, 1], [30, 0.55]];
/** Percussion hits: a two-bar figure. */
const HITS: [number, number][] = [[0, 1], [3, 0.6], [6, 0.85], [10, 0.7], [12, 0.5], [16, 1], [19, 0.6], [22, 0.9], [27, 0.7]];
/** Stabs: short chord hits (the chop sampler, stab voices). */
const STABS: [number, number, number][] = [[0, 1, 0.95], [3, 1, 0.6], [6, 1, 0.8], [10, 1.5, 0.9], [16, 1, 1], [19, 1, 0.6], [22, 1, 0.85], [26, 1.5, 0.75]];

const voice = (id: string) => LIBRARY_BY_ID[id] as LibraryVoice<any>;

export function entries(): Entry[] {
  return PLAN.map(([id, preset]) => {
    const v = voice(id);
    const p = preset ?? v.preferred ?? Object.keys(v.presets)[0];
    return { id: `${id}:${p}`, voice: id, preset: p, category: v.category, source: v.source.join(" + ") };
  });
}

/** Plays the phrase of `kind` on a voice. */
export function phrase(v: LibraryVoice<any>, h: VoiceHost, params: object, kind: Kind, base: number, at: number, level = 1) {
  const note = (t: number, midi: number, len: number, vel: number, k: number, from?: number, chord?: number[]): VoiceNote => ({
    time: at + t, freq: midiToFreq(midi), length: len, vel: Math.min(1, vel * level), pan: 0, bright: 0.85, seed: hash32(midi, k, 0x7a1) % 4096, from, chord,
  });
  const glides = (params as { glide?: number }).glide ?? 0;
  if (kind === "line") {
    let prev: number | undefined;
    LINE.forEach(([s, len, semi, vel], k) => {
      const f = midiToFreq(base + semi);
      v.play(h, note(s * S16, base + semi, len * S16, vel, k, glides > 0 || v.id.startsWith("film") || v.id === "patchLead" ? prev : undefined), params);
      prev = f;
    });
  } else if (kind === "chords") {
    CHORDS.forEach(([s, tones], k) => tones.forEach((semi, j) => v.play(h, { ...note(s * S16, base + semi, 15 * S16, 0.8, k * 8 + j), pan: (j - 1) * 0.25 }, params)));
  } else if (kind === "chordvoice") {
    CHORDS.forEach(([s, tones], k) => v.play(h, { ...note(s * S16, base, 15 * S16, 0.8, k), pan: -0.12, chord: tones }, params));
  } else if (kind === "bass") {
    let prev: number | undefined;
    BASSLINE.forEach(([s, len, semi, vel], k) => {
      const f = midiToFreq(base + semi);
      v.play(h, note(s * S16, base + semi, len * S16 * 0.92, vel, k, k % 4 === 3 ? prev : undefined), params);
      prev = f;
    });
  } else if (kind === "hats") {
    HATS.forEach(([st, vel], k) => v.play(h, { ...note(st * S16, base, 0.1, vel, k), pan: k % 2 ? 0.2 : -0.2 }, params));
  } else if (kind === "hits") {
    HITS.forEach(([st, vel], k) => v.play(h, { ...note(st * S16, base + (k % 3 === 2 ? 5 : 0), 0.2, vel, k), pan: k % 2 ? 0.35 : -0.35 }, params));
  } else if (kind === "fill") {
    // A tom fill closing each bar (Pop House's disco toms: high to low across the field).
    for (const bar of [0, 16]) {
      [240, 200, 165, 135].forEach((f, k) => v.play(h, { time: at + (bar + 12 + k) * S16, freq: f, length: 0.3, vel: Math.min(1, (0.75 + 0.08 * k) * level), pan: [-0.5, -0.15, 0.15, 0.5][k], bright: 0.85, seed: k }, params));
    }
  } else if (kind === "stabs") {
    STABS.forEach(([st, len, vel], k) => {
      const tones = st < 16 ? CHORDS[0][1] : CHORDS[1][1];
      v.play(h, { ...note(st * S16, base, len * S16, vel, k), chord: tones }, params);
    });
  } else if (kind === "beat") {
    KICKS.forEach((s, k) => v.play(h, note(s * S16, base, 0.2, [1, 0.7, 0.85, 1, 0.7, 0.9][k], k), params));
  } else {
    SNARES.forEach((s, k) => v.play(h, { ...note(s * S16, base, 0.2, [0.9, 1, 0.85, 1][k], k), pan: 0.1 }, params));
  }
}

/** A stereo gain. */
function sum(ctx: BaseAudioContext, value = 1) {
  const g = ctx.createGain();
  g.gain.value = value;
  g.channelCount = 2;
  g.channelCountMode = "explicit";
  g.channelInterpretation = "speakers";
  return g;
}

/**
 * The context: the voice on its own bus with its pack's fx, over a small bed in the pack's world.
 * - cinematic-v2: string-ensemble chorus send, the Titan hall, LOW on the root, a timpani;
 * - hiphop-trap-v3: the boom-bap kick, snare and 808, glue and tape on the drums;
 * - hamster-electro-2-v2: the Black Ice kick (punch), snare, fat bass, ducked dark pad, ensemble chorus, the plate.
 */
export function context(ctx: BaseAudioContext, v: LibraryVoice<any>, preset: string, params: object, kind: Kind, base: number) {
  // The pack's world: the preset's own pack when it names one (drum kits are shared), else the voice's.
  const src = preset.startsWith("hamster.") ? "hamster-electro-2-v2" : preset.startsWith("hiphop.") ? "hiphop-trap-v3" : preset.startsWith("cinematic.") ? "cinematic-v2" : v.source[0];
  const voiceBus = sum(ctx);
  const bedBus = sum(ctx);
  const drumBus = sum(ctx);
  const vh = createHost(ctx, voiceBus);
  const bh = createHost(ctx, bedBus);
  const dh = createHost(ctx, drumBus);
  const mains = new PairBus(ctx, ctx.destination);
  const lead = kind !== "bass" && kind !== "beat" && kind !== "snare";
  phrase(v, vh, params, kind, base, T0);
  const drums = () => {
    const kick = voice("kick");
    const hit = voice("hit");
    const kp = paramsOf(kick, src === "hiphop-trap-v3" ? "hiphop.boombap" : "hamster.blackice");
    const sp = paramsOf(hit, src === "hiphop-trap-v3" ? "hiphop.boombap" : "hamster.blackice");
    if (kind !== "beat") phrase(kick, dh, kp, "beat", 36, T0, 0.8);
    if (kind !== "snare") phrase(hit, dh, sp, "snare", 38, T0, 0.8);
  };
  if (src === "cinematic-v2") {
    if (kind !== "bass" && v.id !== "feltPiano") phrase(voice("filmStrings"), bh, paramsOf(voice("filmStrings"), "LOW (celli + basses on the root) · titan.low"), "bass", 36, T0, 0.7);
    if (lead || kind === "bass") phrase(voice("filmPad"), bh, paramsOf(voice("filmPad")), "chords", 60, T0, 0.5);
    const timp = voice("hit");
    [0, 16].forEach((s) => timp.play(dh, { time: T0 + s * S16, freq: 50, length: 1, vel: 0.5, pan: 0, bright: 1, seed: 0 }, paramsOf(timp, "cinematic.horizon.timp")));
    const ens = stringEnsemble(ctx, PRESETS.CINEMATIC_ENSEMBLES.titan as StringEnsembleSpec);
    const send = sum(ctx, (params as { chorus?: number }).chorus ?? 0.4);
    voiceBus.connect(send);
    send.connect(ens.input);
    const hl = hall(ctx, PRESETS.CINEMATIC_HALLS.titan as HallSpec);
    const hs = sum(ctx, 0.4);
    voiceBus.connect(hs);
    const ds = sum(ctx, 0.3);
    drumBus.connect(ds);
    hl.bus.add(hs);
    hl.bus.add(ds);
    hl.bus.done();
    mains.add(voiceBus);
    mains.add(ens.output);
    mains.add(bedBus);
    mains.add(drumBus);
    mains.add(hl.output);
    return;
  }
  if (src === "hiphop-trap-v3") {
    drums();
    if (kind !== "bass") phrase(voice("bass808"), bh, { ...paramsOf(voice("bass808"), "boombap"), level: 0.8 }, "bass", 36, T0);
    if (lead) phrase(voice("analogPad"), bh, { ...paramsOf(voice("analogPad")), gain: 0.25 }, "chords", 60, T0);
    const fx = PRESETS.HIPHOP_BUSFX.boombap as any;
    const glued = glue(ctx, tape(ctx, drumBus, fx.tape.drums), fx.glue.drums);
    mains.add(voiceBus);
    mains.add(bedBus);
    mains.add(glued);
    return;
  }
  // hamster-electro-2-v2
  drums();
  if (kind !== "bass") phrase(voice("electroBass"), bh, paramsOf(voice("electroBass")), "bass", 36, T0, 0.9);
  const padBus = sum(ctx);
  const duck = sidechain(ctx, 0.6, 0.32);
  padBus.connect(duck.node);
  if (lead && v.id !== "electroPad") phrase(voice("electroPad"), createHost(ctx, padBus), paramsOf(voice("electroPad")), "chordvoice", 50, T0);
  for (const s of KICKS) duck.hit(T0 + s * S16);
  const ens = ensembleChorus(ctx, voiceBus, { mix: 0.45, rate: 0.5 });
  const pl = plate(ctx, PRESETS.HAMSTER_PLATES.blackice);
  const ps = sum(ctx, 0.4);
  voiceBus.connect(ps);
  const pd = sum(ctx, 0.2);
  drumBus.connect(pd);
  pl.bus.add(ps);
  pl.bus.add(pd);
  pl.bus.done();
  mains.add(voiceBus);
  mains.add(ens);
  mains.add(bedBus);
  mains.add(duck.node);
  mains.add(drumBus);
  mains.add(pl.output);
}

/** The audition's length (s): the phrase and its tail. */
export const SECONDS = T0 + 2 * BAR + TAIL;

/** Plays audition entry `i` (PLAN) on `ctx`: dry into the destination, or in context. */
export function audition(ctx: BaseAudioContext, i: number, wet: boolean) {
  const e = entries()[i];
  const [, , kind, base] = PLAN[i];
  const v = voice(e.voice);
  const params = paramsOf(v, e.preset);
  if (wet) context(ctx, v, e.preset, params, kind, base);
  else phrase(v, createHost(ctx, ctx.destination), params, kind, base, T0);
}

/** The phrase role and base note a voice auditions on (its first PLAN row; a score drum kit plays the beat). */
export function roleOf(voiceId: string, preset: string): [Kind, number] {
  if (voiceId === "hit" && preset.startsWith("cinematic.")) return ["beat", 38];
  const row = PLAN.find((r) => r[0] === voiceId) ?? MEDLEY.find((r) => r[0] === voiceId);
  if (row) return [row[2], row[3]];
  const v = voice(voiceId);
  return v.category === "bass" ? ["bass", 36] : v.chordal ? ["chordvoice", 55] : v.category === "drums" ? ["beat", 36] : ["line", 60];
}

/** Any voice and preset on its audition phrase: dry into the destination, or in context. */
export function auditionVoice(ctx: BaseAudioContext, voiceId: string, preset: string | undefined, wet: boolean) {
  const v = voice(voiceId);
  const name = preset ?? v.preferred ?? Object.keys(v.presets)[0];
  const [kind, base] = roleOf(voiceId, name);
  const params = paramsOf(v, name);
  if (wet) context(ctx, v, name, params, kind, base);
  else phrase(v, createHost(ctx, ctx.destination), params, kind, base, T0);
}

// ================================================================================================ phase 2: medleys

/**
 * The phase-2 audition (web/scripts/voice-library/medley.mjs, sim/voice-library/v2): one medley per shelf, every
 * voice DRY on its phrase (C minor, 96 BPM, two bars) with its name in contents.txt. [voice, preset (omitted: the
 * preferred one), phrase, base MIDI]. Voices with a `caution` (organ, reed, inharmonic bells) are left out and listed.
 */
export const MEDLEY: [string, string | undefined, Kind, number][] = [
  // keys
  ["physRhodes", "pitLane.keys", "chordvoice", 55],
  ["rhodesTine", undefined, "chordvoice", 55],
  ["housePiano", undefined, "chordvoice", 60],
  ["fmEp", "afterHours.keys", "chordvoice", 55],
  ["fmKeys", undefined, "chords", 60],
  ["feltPiano", undefined, "line", 60],
  ["machineFm", "roller", "line", 72],
  ["junoStab", undefined, "stabs", 55],
  // pads
  ["ladderPad", "pitLane.pad", "chordvoice", 55],
  ["morphPad", "afterHours.pad", "chordvoice", 55],
  ["junoPad", undefined, "chordvoice", 55],
  ["jpStrings", undefined, "chordvoice", 55],
  ["glassPad", undefined, "chordvoice", 55],
  ["housePad", "future.juno", "chordvoice", 55],
  ["filmPad", undefined, "chords", 60],
  ["filmPad", "neon.cspad", "chords", 60],
  ["analogPad", undefined, "chords", 60],
  ["electroPad", undefined, "chordvoice", 50],
  // strings
  ["filmStrings", "VIOLINS · horizon.violins", "line", 72],
  ["filmStrings", "CELLI · pursuit.celli", "line", 48],
  ["strings", undefined, "chords", 60],
  ["machineStrings", "control", "chordvoice", 55],
  ["stringMachine", undefined, "chordvoice", 55],
  // brass
  ["filmBrass", undefined, "line", 60],
  ["filmBrass", "BRAAM (Inception braam) · titan.braam", "bass", 36],
  ["brass", undefined, "line", 60],
  ["brassSection", "filter", "stabs", 60],
  ["fmTrumpet", undefined, "line", 67],
  // choirs
  ["filmChoir", undefined, "chords", 60],
  ["filmChoir", "CHOIR_OO (dark ooh choir) · horizon.choir", "chords", 60],
  ["vox", undefined, "chords", 60],
  ["machineChoir", "control", "chordvoice", 55],
  ["liquidChoir", "undertow.pad", "chordvoice", 55],
  ["formantVocal", "piano", "line", 67],
  ["soloVoice", undefined, "line", 67],
  ["altoHum", undefined, "line", 60],
  // plucks
  ["waveguidePluck", "slowBloom.motif", "line", 67],
  ["pluck", undefined, "line", 60],
  ["jazzGuitar", undefined, "line", 60],
  ["harp", undefined, "line", 67],
  ["houseGuitar", "disco", "line", 60],
  ["filmPluck", undefined, "line", 72],
  // bells
  ["malletV2", "afterHours.motif", "line", 72],
  ["v2Bell", "slowBloom.organ", "line", 72],
  ["vibes", undefined, "line", 72],
  ["fmBell", undefined, "line", 72],
  // leads
  ["machineStack", "control.lead", "line", 60],
  ["machineStack", "circuit.arp", "line", 60],
  ["patchLead", "foghorn", "line", 48],
  ["moogLead", undefined, "line", 72],
  ["filmLead", undefined, "line", 72],
  ["flute", undefined, "line", 72],
  ["panFlute", undefined, "line", 72],
  ["houseSupersaw", "future", "chordvoice", 60],
  ["supersaw", undefined, "chords", 60],
  // bass
  ["ladderBass", "pitLane.bass", "bass", 36],
  ["diodeBass", "diodeLine.bass", "bass", 36],
  ["fmBass", "nightBus.bass", "bass", 36],
  ["machineBass", "control", "bass", 36],
  ["electroBass", undefined, "bass", 36],
  ["electroBass", "servo", "bass", 36],
  ["reese", undefined, "bass", 36],
  ["moogBass", undefined, "bass", 36],
  ["upright", undefined, "bass", 36],
  ["houseBass", "disco.slap", "bass", 36],
  ["bassStack", undefined, "bass", 36],
  ["bass808", undefined, "bass", 36],
  ["filmBass", undefined, "bass", 36],
  // drums
  ["kick", undefined, "beat", 36],
  ["houseKick", "future", "beat", 36],
  ["machineKick", "control", "beat", 36],
  ["hit", undefined, "snare", 38],
  ["hit", "hiphop.boombap", "snare", 38],
  ["houseClap", "chops", "snare", 38],
  ["machineHat", "control", "hats", 42],
  ["houseShaker", "accent", "hats", 70],
  ["noiseRide", "a", "hats", 51],
  ["machinePerc", "memory.conga", "hits", 50],
  ["houseConga", "low", "hits", 62],
  ["discoTom", "tom", "fill", 45],
  // fx
  ["chordChop", "pitLane.chop", "stabs", 55],
  ["chordChop", "diodeLine.chop", "stabs", 55],
  ["machineBleep", "control", "line", 79],
  ["machineBleep", "circuit", "line", 79],
];

export interface MedleyEntry extends Entry {
  /** Phase 2 (an import of this round) or phase 1. */
  phase: 1 | 2;
  doc: string;
}

const PHASE1 = new Set(["hiphop-trap-v3", "cinematic-v2", "hamster-electro-2-v2"]);

export function medleyEntries(): MedleyEntry[] {
  return MEDLEY.map(([id, preset]) => {
    const v = voice(id);
    const p = preset ?? v.preferred ?? Object.keys(v.presets)[0];
    if (!(p in v.presets)) throw new Error(`medley: ${id} has no preset ${p}`);
    return { id: `${id}:${p}`, voice: id, preset: p, category: v.category, source: v.source.join(" + "), phase: v.source.some((s) => !PHASE1.has(s)) ? 2 : 1, doc: v.doc };
  });
}

/** The voices left out of the medleys (their `caution`). */
export function medleyLeftOut(): { id: string; caution: string }[] {
  return [
    ...Object.values(LIBRARY_BY_ID).filter((v) => v.caution).map((v) => ({ id: v.id, caution: v.caution! })),
    { id: "machineSnare", caution: "layers the pack adds over a snare (snap, clap, air): alone they read as a hissy tail, so not auditioned alone" },
  ];
}

/** Plays medley entry `i` dry into the destination. */
export function medley(ctx: BaseAudioContext, i: number) {
  const [id, , kind, base] = MEDLEY[i];
  const e = medleyEntries()[i];
  const v = voice(id);
  phrase(v, createHost(ctx, ctx.destination), paramsOf(v, e.preset), kind, base, T0);
}
