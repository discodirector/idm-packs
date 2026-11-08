import { hash32 } from "../../hash.ts";
import { LIBRARY_BY_ID, paramsOf } from "../catalog.ts";
import type { LibraryVoice, VoiceHost, VoiceNote } from "../types.ts";
import { NEW_LIBRARY_BY_ID } from "./catalog.ts";

// The new voices' audition (web/scripts/voice-library/new-audition.mjs -> sim/voice-library/new-v1): every new voice on a
// short phrase in a dark-house idiom (122 BPM, A minor / sus chords, unresolved loops), dry; then the same phrase in a
// small dry groove (kick, clap, sub); then the nearest voice we already had on the same phrase (A/B). Not used by the
// engine.

export const BPM = 122;
export const S16 = 60 / BPM / 4;
export const BARS = 2;
export const T0 = 0.05;
export const TAIL = 1.4;
export const SECONDS = T0 + BARS * 16 * S16 + TAIL;
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** One phrase note: 16th step, length in 16ths, MIDI note(s), velocity, optional preset for this hit, glide flag. */
export type Row = { s: number; len: number; m: number | number[]; vel: number; preset?: string; glide?: boolean };

const AM9 = [57, 60, 64, 71];
const DM9 = [53, 57, 60, 64];
const ESUS = [52, 57, 59, 62];

export const PHRASES: Record<string, Row[]> = {
  // Off-beat dotted house comping: Am9 | Dm9 .. Esus4 (never resolves).
  comp: [
    { s: 0, len: 2, m: AM9, vel: 0.75 }, { s: 3, len: 1, m: AM9, vel: 0.5 }, { s: 6, len: 2, m: AM9, vel: 0.9 }, { s: 10, len: 1, m: AM9, vel: 0.55 }, { s: 11, len: 3, m: AM9, vel: 0.85 },
    { s: 16, len: 2, m: DM9, vel: 0.75 }, { s: 19, len: 1, m: DM9, vel: 0.5 }, { s: 22, len: 2, m: DM9, vel: 0.95 }, { s: 24, len: 7, m: ESUS, vel: 0.7 },
  ],
  // A minor pentatonic 16th riff with rests (clav, muted guitar).
  riff: [
    { s: 0, len: 1, m: 57, vel: 0.9 }, { s: 2, len: 1, m: 60, vel: 0.6 }, { s: 3, len: 1, m: 57, vel: 0.75 }, { s: 5, len: 1, m: 62, vel: 0.85 }, { s: 7, len: 1, m: 60, vel: 0.5 },
    { s: 8, len: 1, m: 64, vel: 0.9 }, { s: 10, len: 1, m: 62, vel: 0.55 }, { s: 11, len: 1, m: 60, vel: 0.8 }, { s: 13, len: 1, m: 57, vel: 0.6 }, { s: 14, len: 2, m: 55, vel: 0.85 },
    { s: 16, len: 1, m: 57, vel: 0.9 }, { s: 18, len: 1, m: 60, vel: 0.6 }, { s: 19, len: 1, m: 57, vel: 0.75 }, { s: 21, len: 1, m: 62, vel: 0.85 }, { s: 23, len: 1, m: 64, vel: 0.5 },
    { s: 24, len: 1, m: 67, vel: 0.95 }, { s: 26, len: 1, m: 64, vel: 0.55 }, { s: 27, len: 1, m: 62, vel: 0.8 }, { s: 29, len: 3, m: 59, vel: 0.7 },
  ],
  // An unresolved ostinato over Am9 then Dm9 (kalimba, harp, nylon).
  arp: [
    ...[57, 64, 71, 72, 64, 71, 72, 67].map((m, k) => ({ s: k * 2, len: 2, m, vel: k % 4 === 0 ? 0.9 : 0.6 + 0.1 * (k % 2) })),
    ...[53, 60, 64, 69, 60, 64, 69, 71].map((m, k) => ({ s: 16 + k * 2, len: 2, m, vel: k % 4 === 0 ? 0.9 : 0.6 + 0.1 * (k % 2) })),
  ],
  // Two held chords (choir, ensemble, swell).
  pad: [{ s: 0, len: 15, m: AM9, vel: 0.75 }, { s: 16, len: 15, m: DM9, vel: 0.8 }],
  // Off-beat chord stabs (vox stab, string stab, brass stab).
  stab: [2, 6, 10, 13, 18, 22, 26, 29].map((s, k) => ({ s, len: k % 4 === 3 ? 2 : 1, m: k < 4 ? AM9 : k < 7 ? DM9 : ESUS, vel: k % 2 ? 0.7 : 0.9 })),
  // Vocal chop call: short hits on the off-beats, a call and a falling answer.
  chop: [
    { s: 2, len: 2, m: 69, vel: 0.9 }, { s: 6, len: 1, m: 67, vel: 0.7 }, { s: 7, len: 2, m: 64, vel: 0.85 }, { s: 12, len: 3, m: 62, vel: 0.8 },
    { s: 18, len: 2, m: 69, vel: 0.9 }, { s: 22, len: 1, m: 72, vel: 0.75 }, { s: 23, len: 2, m: 71, vel: 0.85 }, { s: 28, len: 4, m: 64, vel: 0.8 },
  ],
  // A hypnotic minor lead line, legato (glides), ending on the 2nd (unresolved).
  line: [
    { s: 0, len: 2, m: 64, vel: 0.85 }, { s: 3, len: 1, m: 67, vel: 0.6, glide: true }, { s: 4, len: 3, m: 69, vel: 0.9, glide: true }, { s: 7, len: 1, m: 67, vel: 0.55, glide: true },
    { s: 8, len: 3, m: 64, vel: 0.8, glide: true }, { s: 12, len: 2, m: 62, vel: 0.7 }, { s: 14, len: 2, m: 64, vel: 0.75, glide: true },
    { s: 16, len: 2, m: 64, vel: 0.85 }, { s: 19, len: 1, m: 67, vel: 0.6, glide: true }, { s: 20, len: 3, m: 72, vel: 0.95, glide: true }, { s: 23, len: 1, m: 71, vel: 0.6, glide: true },
    { s: 24, len: 4, m: 67, vel: 0.8, glide: true }, { s: 28, len: 4, m: 71, vel: 0.75, glide: true },
  ],
  // A pentatonic koto line with one bend.
  koto: [
    { s: 0, len: 3, m: 69, vel: 0.9 }, { s: 3, len: 1, m: 72, vel: 0.6 }, { s: 4, len: 4, m: 71, vel: 0.8 }, { s: 8, len: 2, m: 64, vel: 0.7 }, { s: 10, len: 2, m: 69, vel: 0.65 }, { s: 12, len: 4, m: 67, vel: 0.85, preset: "oshide" },
    { s: 16, len: 3, m: 69, vel: 0.9 }, { s: 19, len: 1, m: 72, vel: 0.6 }, { s: 20, len: 4, m: 76, vel: 0.85 }, { s: 24, len: 2, m: 74, vel: 0.65 }, { s: 26, len: 6, m: 71, vel: 0.8 },
  ],
  // Off-beat house bass with a slide into bar 2.
  bass: [
    { s: 2, len: 2, m: 33, vel: 0.9 }, { s: 6, len: 2, m: 33, vel: 0.8 }, { s: 10, len: 2, m: 33, vel: 0.9 }, { s: 13, len: 2, m: 36, vel: 0.7 },
    { s: 18, len: 2, m: 38, vel: 0.9, glide: true }, { s: 22, len: 2, m: 38, vel: 0.8 }, { s: 26, len: 2, m: 40, vel: 0.9, glide: true }, { s: 29, len: 3, m: 31, vel: 0.75, glide: true },
  ],
  // Long Reese notes.
  reese: [{ s: 0, len: 7, m: 33, vel: 0.9 }, { s: 8, len: 6, m: 36, vel: 0.8, glide: true }, { s: 16, len: 8, m: 38, vel: 0.9, glide: true }, { s: 24, len: 7, m: 31, vel: 0.85, glide: true }],
  clap: [4, 12, 20, 28].map((s, k) => ({ s, len: 1, m: 39, vel: k === 3 ? 1 : 0.9 })),
  rim: [3, 7, 10, 14, 19, 23, 26, 30].map((s, k) => ({ s, len: 1, m: 37, vel: [0.9, 0.5, 0.8, 0.6, 0.9, 0.5, 0.85, 0.55][k] })),
  conga: [0, 16].flatMap((o) => [
    { s: o + 2, len: 1, m: 57, vel: 0.85, preset: "congaSlap" }, { s: o + 3, len: 1, m: 52, vel: 0.75 }, { s: o + 6, len: 1, m: 57, vel: 0.5, preset: "congaMute" },
    { s: o + 7, len: 1, m: 57, vel: 0.8 }, { s: o + 10, len: 1, m: 57, vel: 0.85, preset: "congaSlap" }, { s: o + 11, len: 1, m: 52, vel: 0.8 }, { s: o + 14, len: 1, m: 57, vel: 0.75 }, { s: o + 15, len: 1, m: 52, vel: 0.7 },
  ]),
  bongo: [0, 16].flatMap((o) => [2, 3, 6, 10, 11, 14].map((s, k) => ({ s: o + s, len: 1, m: k % 2 ? 69 : 64, vel: k % 3 === 0 ? 0.9 : 0.6 }))),
  block: [3, 6, 10, 14, 19, 22, 27].map((s, k) => ({ s, len: 1, m: [76, 79, 76, 81, 76, 79, 83][k], vel: k % 2 ? 0.65 : 0.85 })),
  shaker: [2, 3, 6, 7, 10, 11, 15, 18, 19, 22, 23, 26, 27, 29, 30].map((s) => ({ s, len: 1, m: 60, vel: s % 4 === 2 ? 0.9 : 0.5 })),
};

/** Kinds whose rows of tones play as one strummed note (the voice reads `chord`). */
const STRUMS = new Set(["guitar", "physHarp"]);

/** The audition list: [new voice, preset, phrase, the nearest existing voice and preset for the A/B (or none)]. */
export const ENTRIES: [string, string, string, [string, string?] | null][] = [
  ["roundClap", "round", "clap", ["hit", "hamster.blackice"]],
  ["roundClap", "crack", "clap", null],
  ["rim", "sidestick", "rim", null],
  ["rim", "rimshot", "rim", null],
  ["handDrum", "congaOpen", "conga", null],
  ["handDrum", "bongo", "bongo", null],
  ["handDrum", "woodblock", "block", null],
  ["shaker", "shaker", "shaker", null],
  ["shaker", "egg", "shaker", null],
  ["choir", "ahh", "pad", ["filmChoir"]],
  ["choir", "ooh", "pad", ["vox"]],
  ["choir", "ah-oh", "pad", null],
  ["voxChop", "ya-oh", "chop", ["vox", "gfunk.voices0.layers0"]],
  ["voxChop", "stab", "stab", null],
  ["voxChop", "hey", "chop", null],
  ["guitar", "nylon", "arp", ["pluck"]],
  ["guitar", "muted funk", "riff", ["pluck"]],
  ["guitar", "12-string", "pad", null],
  ["physHarp", "concert", "arp", ["filmPluck"]],
  ["koto", "koto", "koto", ["pluck"]],
  ["physWurli", "200A", "comp", ["fmKeys"]],
  ["physWurli", "bark", "comp", null],
  ["clav", "funk", "riff", null],
  ["uprightPiano", "upright", "comp", ["feltPiano"]],
  ["uprightPiano", "felt", "arp", null],
  ["kalimba", "kalimba", "arp", ["fmBell"]],
  ["bowedStrings", "ensemble", "pad", ["strings"]],
  ["bowedStrings", "celli", "reese", ["filmStrings", "CELLI · pursuit.celli"]],
  ["bowedStrings", "stab", "stab", ["filmStrings", "SPICC (spiccato ostinato) · titan.spicc"]],
  ["softBrass", "section", "pad", ["filmBrass"]],
  ["softBrass", "stab", "stab", ["brass"]],
  ["wideReese", "reese", "reese", ["electroBass"]],
  ["uprightBass", "pizz", "bass", ["bassStack"]],
  ["rubberSub", "rubber", "bass", ["bass808"]],
  ["rubberSub", "bouncy", "bass", null],
  ["sawLead", "character", "line", ["moogLead"]],
  ["sawLead", "glide mono", "line", ["patchLead", "foghorn"]],
];

/** The octave shift a phrase needs for a voice's register (cello, bass on the reese line, etc.). */
function shiftFor(v: LibraryVoice<any>, rows: Row[]): number {
  const ms = rows.flatMap((r) => (Array.isArray(r.m) ? r.m : [r.m]));
  const lo = Math.min(...ms);
  const hi = Math.max(...ms);
  const [a, b] = v.register;
  if (a === b) return 0;
  let sh = 0;
  while (lo + sh < a - 2 && hi + sh + 12 <= b + 5) sh += 12;
  while (hi + sh > b + 2 && lo + sh - 12 >= a - 5) sh -= 12;
  return sh;
}

/** Plays phrase `kind` on voice `v` (params `params`, per-hit presets from `presetOf`) into host `h`. */
export function playPhrase(h: VoiceHost, v: LibraryVoice<any>, params: object, kind: string, at = T0, presetOf?: (name: string) => object) {
  const rows = PHRASES[kind];
  const sh = shiftFor(v, rows);
  const isDrum = v.category === "drums" && v.register[0] === v.register[1];
  let prev: number | undefined;
  rows.forEach((r, k) => {
    const p = r.preset && presetOf ? presetOf(r.preset) : params;
    const tones = (Array.isArray(r.m) ? r.m : [r.m]).map((m) => (isDrum ? v.register[0] : m + sh));
    const note = (m: number, j: number, extra: Partial<VoiceNote> = {}): VoiceNote => ({
      time: at + r.s * S16, freq: mtof(m), length: r.len * S16 * 0.95, vel: r.vel, pan: tones.length > 1 ? (j / (tones.length - 1) - 0.5) * 0.5 : 0, bright: 0.85,
      seed: hash32(k, m, 0x6e77) % 65536, ...extra,
    });
    if (tones.length > 1 && STRUMS.has(v.id)) v.play(h, note(tones[0], 0, { chord: tones.map((m) => m - tones[0]), pan: 0 }), p);
    else tones.forEach((m, j) => v.play(h, note(m, j, r.glide && prev ? { from: prev } : {}), p));
    prev = mtof(tones[tones.length - 1]);
  });
}

/** Entry i's new voice and its params; the A/B voice and params (or null). */
export function entry(i: number) {
  const [id, preset, kind, ab] = ENTRIES[i];
  const v = NEW_LIBRARY_BY_ID[id];
  const old = ab ? LIBRARY_BY_ID[ab[0]] : null;
  return {
    id, preset, kind, v, params: paramsOf(v, preset),
    presetOf: (name: string) => paramsOf(v, name),
    old, oldPreset: old ? ab![1] ?? old.preferred ?? Object.keys(old.presets)[0] : null,
  };
}

/** The dry groove under a phrase: four-on-the-floor kick, clap on 2 and 4, an off-beat sub (each part optional). */
export function playBed(hs: { kick?: VoiceHost; clap?: VoiceHost; sub?: VoiceHost }, at = T0) {
  const kick = LIBRARY_BY_ID.kick;
  const kp = paramsOf(kick, "hamster.blackice");
  if (hs.kick) for (let s = 0; s < BARS * 16; s += 4) kick.play(hs.kick, { time: at + s * S16, freq: 55, length: 0.2, vel: s % 16 === 0 ? 0.95 : 0.85, pan: 0, bright: 1, seed: s }, kp);
  if (hs.clap) playPhrase(hs.clap, NEW_LIBRARY_BY_ID.roundClap, paramsOf(NEW_LIBRARY_BY_ID.roundClap, "round"), "clap", at);
  if (hs.sub) playPhrase(hs.sub, NEW_LIBRARY_BY_ID.rubberSub, paramsOf(NEW_LIBRARY_BY_ID.rubberSub, "pure"), "bass", at);
}
