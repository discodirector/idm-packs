import type { LibraryVoice, VoiceSource } from "../types.ts";
import { reese, rubberSub, sawLead, softBrass } from "./dsp/analog.ts";
import { bowed } from "./dsp/bowed.ts";
import type { Params } from "./dsp/core.ts";
import { kalimba, upright, wurli } from "./dsp/keys.ts";
import { handDrum, rim, roundClap, shaker } from "./dsp/percussion.ts";
import { clav, plucked } from "./dsp/plucked.ts";
import { vox } from "./dsp/vocal.ts";
import { player } from "./voices.ts";

// The new voices of the shared library (docs/sound/VOICE-LIBRARY-NEW.md), phase "new-v1": physical models and
// nonlinear filters rendered sample by sample (dsp/), played through the library's VoiceHost. Every voice here is
// opt-in: nothing in the engine names them. Kept in their own list so they merge into catalog.ts as appended entries.

/** The new voices' source tag (not an approved pack yet: the owner's ear decides). */
const NEW = ["voice-library-new"] as unknown as readonly VoiceSource[];

const DRY = "Dry: no reverb in the voice. Fuller = more voices / layers, never more reverb.";
const SUSTAIN = "Sustained voice: closed lowpass (<= ~2.6 kHz), calm 2-5 kHz, no pulse waves (no organ / accordion).";

type V = LibraryVoice<Params>;

export const NEW_LIBRARY: V[] = [
  // ------------------------------------------------------------------------------------------------------------- drums
  {
    id: "roundClap", category: "drums", source: NEW, register: [39, 39],
    doc: "Round clap: 3-5 hand bursts a few ms apart, each panned on its own, all through three resonant band-passes (~1.1 / 2.1 / 3.6 kHz) and a closing lowpass, with a round low tone under it. Bright 2-6 kHz presence, a tonal tail 40 dB down after ~110 ms, no hiss.",
    rules: ["Sits under the kick's level, on 2 and 4 or layered on the snare body ('layer' preset).", "The tail is a short ringing tone (`decay` = time to -40 dB): never past ~0.16 s (that becomes the hissy 'усатый' clap).", DRY],
    defaults: { ref: 39, tone: 1250, bursts: 4, spread: 0.0085, burstDecay: 0.0028, decay: 0.11, snap: 0.55, air: 0.25, body: 0.35, bodyFreq: 230, bodyDecay: 0.06, width: 0.35, lp: 7000, level: 1 },
    presets: {
      round: {},
      crack: { tone: 1600, bursts: 3, decay: 0.075, snap: 0.8, air: 0.4, body: 0.2 },
      deep: { tone: 950, decay: 0.13, body: 0.6, air: 0.1, lp: 5500 },
      layer: { bursts: 3, decay: 0.07, body: 0, level: 0.7 },
    },
    preferred: "round",
    play: player(roundClap),
  },
  {
    id: "rim", category: "drums", source: NEW, register: [37, 37],
    doc: "Rim / stick crack: a 0.35 ms stick strike on five short wood modes (a low knock, the crack, three partials that die in 10-30 ms) and a 2.5 ms click at ~4 kHz. Bright and dry; a knock, never a ring.",
    rules: ["Syncopated accents and fills, not a constant 16th line.", "Keep `decay` under ~0.06 s: longer modes start to ring like metal.", DRY],
    defaults: { ref: 37, tone: 1650, decay: 0.045, wood: 0.5, body: 0.5, click: 0.6, lp: 8000, level: 1 },
    presets: {
      rimshot: { wood: 0.2, tone: 2100, click: 0.8 },
      sidestick: { wood: 0.8, tone: 1500, decay: 0.035, body: 0.7 },
      tick: { tone: 2400, decay: 0.025, wood: 0.6, body: 0.2, click: 0.4, level: 0.8 },
    },
    preferred: "sidestick",
    play: player(rim),
  },
  {
    id: "handDrum", category: "drums", source: NEW, register: [48, 84],
    doc: "Hand percussion, modal: a membrane (circular-membrane modes, a hand strike whose contact time sets the brightness, pitch falling as the head relaxes, slap and mute) or a wooden block / log drum. The fundamental is the note, so congas and blocks play chord tones.",
    rules: ["Tuned: play chord tones (the conga's open tone is a pitch).", "Short and dry; let the pattern leave gaps.", DRY],
    defaults: { kind: 0, contact: 3, bend: 0.05, bendTime: 0.03, decay: 0.35, edge: 0.4, slap: 0, mute: 0, skin: 0.15, lp: 9000, level: 0.6 },
    presets: {
      congaOpen: {},
      congaSlap: { contact: 0.9, slap: 0.7, edge: 0.8, mute: 0.4, decay: 0.3 },
      congaMute: { mute: 0.8, contact: 2.5 },
      bongo: { contact: 0.7, decay: 0.22, bend: 0.03, edge: 0.6, level: 0.9 },
      woodblock: { kind: 1, contact: 0.4, decay: 0.08, edge: 0.6, skin: 0, level: 1 },
      logDrum: { kind: 1, contact: 1.5, decay: 0.35, edge: 0.3, skin: 0.05, level: 0.6 },
    },
    preferred: "congaOpen",
    play: player(handDrum),
  },
  {
    id: "shaker", category: "drums", source: NEW, register: [60, 60],
    doc: "Shaker, a particle model (PhISEM): the shake's energy makes seeds collide at random; every collision a tiny noise grain with its own pan, sounding through two shell resonances and a closing lowpass. The note's length is the shake gesture.",
    rules: ["Sparse: accents and gaps, not a constant carpet (the hats rule).", "Grains, not hiss: keep `density` <= ~0.7 and `lp` <= ~10 kHz.", DRY],
    defaults: { ref: 60, tone: 3400, tone2: 5600, q: 2.4, mix2: 0.55, density: 0.5, grain: 0.0011, shape: 0.6, width: 0.4, lp: 9000, level: 0.6 },
    presets: {
      shaker: {},
      egg: { tone: 2400, tone2: 4200, lp: 7000, density: 0.65, grain: 0.0014 },
      tight: { tone: 4200, density: 0.35, grain: 0.0007, lp: 10000, shape: 0.35 },
    },
    preferred: "shaker",
    play: player(shaker),
  },
  // ------------------------------------------------------------------------------------------------------------ choirs
  {
    id: "choir", category: "choirs", source: NEW, register: [48, 79],
    doc: "Choir, source-filter: 3-4 singers a side, each a band-limited glottal buzz with its own drift, jitter, shimmer, late vibrato and breath, through five formant resonators (tenor to soprano tables by pitch; the singer's formant lifted for brightness). Wide (the sides' formants differ) and brighter than `vox` / `filmChoir`. Ahh, ooh, hum, vowels that move.",
    rules: ["Chords as one note per tone; slow attack.", SUSTAIN.replace("closed lowpass (<= ~2.6 kHz), ", ""), DRY],
    defaults: { voices: 2, detune: 12, vib: 16, vibRate: 5.2, vibDelay: 0.35, vowel: 0, vowelTo: -1, morph: 0.3, morphAt: 0, shift: 0, bright: 0.7, breath: 0.12, consonant: 0, tilt: 4500, a: 0.3, d: 0.5, s: 0.9, r: 0.6, scoop: 0, scoopTime: 0.07, fall: 0, stagger: 0.03, width: 0.8, sex: -1, glide: 0, level: 1 },
    presets: {
      ahh: {},
      ooh: { vowel: 3.6, bright: 0.35, tilt: 1800 },
      hum: { vowel: 4, bright: 0.15, tilt: 1200, breath: 0.06 },
      "ah-oh": { vowel: 0, vowelTo: 3, morph: 1.2, morphAt: 0.2 },
      wide: { voices: 4, detune: 18, width: 1, bright: 0.75 },
    },
    preferred: "ahh",
    play: player(vox),
  },
  {
    id: "voxChop", category: "choirs", source: NEW, register: [55, 79],
    doc: "Vocal chop and stab: one or two singers, short, bright (formants a semitone up, the singer's formant lifted), a breathy 'h' onset, a scoop into the pitch and vowels that move inside the note ('ya-oh', 'hey'): the house vocal chop, made, not sampled.",
    rules: ["Short hits on the off-beats or as a call; not a sustained lead.", "Minor / sus chord tones; never a sunny major hook.", DRY],
    defaults: { voices: 1, detune: 6, vib: 0, vibRate: 5.2, vibDelay: 0.2, vowel: 0, vowelTo: -1, morph: 0.12, morphAt: 0, shift: 1, bright: 1, breath: 0.1, consonant: 0.6, tilt: 9000, a: 0.006, d: 0.12, s: 0.75, r: 0.08, scoop: -80, scoopTime: 0.04, fall: 0, stagger: 0.005, width: 0.5, sex: -1, glide: 0, level: 1 },
    presets: {
      stab: { voices: 2, detune: 8, a: 0.004, d: 0.09, s: 0.4, r: 0.07, consonant: 0.8, level: 1.4 },
      "ya-oh": { vowel: 2, vowelTo: 3, morph: 0.12, morphAt: 0.03 },
      hey: { vowel: 1, vowelTo: 2, morph: 0.1, morphAt: 0.05, consonant: 0.9 },
      "oh fall": { vowel: 3, fall: 250, r: 0.15 },
    },
    preferred: "ya-oh",
    play: player(vox),
  },
  // ------------------------------------------------------------------------------------------------------------ plucks
  {
    id: "guitar", category: "plucks", source: NEW, register: [40, 76],
    doc: "Guitar, a waveguide string model: two polarisations (two-stage decay and slow beating), a pick-shaped excitation (velocity opens it; the pick position combs it), a tension kick that settles the pitch, palm-mute loop lowpass, a damper, a body of modal resonances; chords strum. Steel, nylon, muted funk, a 12-string with its octave courses.",
    rules: ["Muted funk: 16th figures with rests, low velocity variation does the groove.", "12-string shimmer on slow chords only.", DRY],
    defaults: { decay: 2.6, bright: 0.5, position: 0.13, tone: 0.5, body: 0, bodyLevel: 0.5, polar: 1.2, polarMix: 0.6, damp: 0.12, mute: 0, octave: 0, course: 6, strum: 0.012, width: 0.3, kick: 5, kickTime: 0.05, bend: 0, lp: 9000, level: 0.9, timing: 3 },
    presets: {
      steel: {},
      nylon: { body: 1, bright: 0.3, position: 0.18, tone: 0.4, decay: 2.4, bodyLevel: 0.7, kick: 3 },
      "muted funk": { mute: 0.85, bright: 0.7, position: 0.1, decay: 1.2, damp: 0.04, bodyLevel: 0.35, strum: 0.006, kick: 8, level: 2.2 },
      "12-string": { octave: 0.55, course: 6, bright: 0.6, position: 0.12, decay: 3, polar: 1.6, strum: 0.016, level: 1 },
    },
    preferred: "nylon",
    play: player(plucked),
  },
  {
    id: "physHarp", category: "plucks", source: NEW, register: [43, 88],
    doc: "Harp, the waveguide string plucked near its middle by a soft finger (round, slightly hollow), long decay, a soundboard body; chords roll (`strum` 40 ms).",
    rules: ["Arpeggios and rolled chords; dry, the long string decay is the space.", DRY],
    defaults: { decay: 4, bright: 0.42, position: 0.42, tone: 0.35, body: 2, bodyLevel: 0.5, polar: 0.6, polarMix: 0.4, damp: 0.6, kick: 2, kickTime: 0.04, width: 0.4, strum: 0.04, bend: 0, mute: 0, octave: 0, lp: 8000, level: 0.9, timing: 2 },
    presets: { concert: {}, lever: { decay: 2.2, damp: 0.25, bright: 0.5 } },
    preferred: "concert",
    play: player(plucked),
  },
  {
    id: "koto", category: "plucks", source: NEW, register: [55, 86],
    doc: "Koto-like pluck: the waveguide string plucked hard near the bridge with an ivory pick (thin, twangy), a strong tension kick (sharp, then settling), optional oshide bend (the left hand pressing the string a semitone up after the pluck).",
    rules: ["Pentatonic minor / in-scale lines, sparse; the bend on one note a phrase.", DRY],
    defaults: { decay: 2.4, bright: 0.85, position: 0.07, tone: 0.7, body: 3, bodyLevel: 0.55, polar: 1, polarMix: 0.5, damp: 0.25, kick: 14, kickTime: 0.06, bend: 0, bendAt: 0.18, bendTime: 0.12, width: 0.2, mute: 0, octave: 0, lp: 8500, level: 2, timing: 3 },
    presets: { koto: {}, oshide: { bend: 1, bendAt: 0.22, bendTime: 0.14 }, soft: { bright: 0.6, position: 0.12, tone: 0.55 } },
    preferred: "koto",
    play: player(plucked),
  },
  // -------------------------------------------------------------------------------------------------------------- keys
  {
    id: "physWurli", category: "keys", source: NEW, register: [48, 84],
    doc: "Wurlitzer, physical: a felt hammer on a steel reed (fundamental + short bending modes) heard through the electrostatic pickup (x / (1 - k x): the 2nd and 3rd harmonics grow with velocity: the bark comes from the playing), a small amp and speaker. Shorter and more nasal than a Rhodes; no organ, no tremolo by default.",
    rules: ["Comping with a wide velocity range: soft = round, hard = bark.", "Tremolo (`trem`) only on sparse chords.", DRY],
    defaults: { decay: 2.2, damp: 0.12, hammer: 0.55, swing: 0.9, pickup: 0.92, speaker: 1000, lp: 4600, drive: 1.2, trem: 0, tremRate: 5.6, drift: 3, level: 0.5, timing: 3 },
    presets: { "200A": {}, bark: { hammer: 0.85, swing: 1, pickup: 0.94, drive: 1.8, level: 0.4 }, soft: { hammer: 0.3, swing: 0.6, pickup: 0.75, lp: 2800, level: 0.7 } },
    preferred: "200A",
    play: player(wurli),
  },
  {
    id: "clav", category: "keys", source: NEW, register: [48, 79],
    doc: "Clavinet: a string struck and held by the key's rubber tip (bright), heard through a magnetic pickup near the bridge (a comb: the nasal funk), released into a yarn damper with the tip's 'thwack'; preamp drive; optional envelope wah.",
    rules: ["Short, syncopated, muted figures: the release thwack is part of the groove.", DRY],
    defaults: { decay: 1.6, damp: 0.035, bright: 0.8, tone: 0.75, pickup: 0.1, thwack: 1, drive: 1.4, lp: 6000, wah: 0, drift: 2, level: 1.6, timing: 2 },
    presets: { funk: {}, mellow: { pickup: 0.28, bright: 0.55, lp: 3800, tone: 0.6 }, wah: { wah: 1, lp: 5000 } },
    preferred: "funk",
    play: player(clav),
  },
  {
    id: "uprightPiano", category: "keys", source: NEW, register: [36, 88],
    doc: "Upright piano, modal: 1-3 detuned strings per key, partials on the stiff string's stretched series, a felt hammer whose contact time is its nonlinearity (hard = short = bright), the strike point's notch, per-partial decay, a damper, a hammer knock and the upright's boxy case behind a closed lid.",
    rules: ["Chords and lines; soft playing is dark, not just quiet.", DRY],
    defaults: { decay: 7, damp: 0.14, unison: 3, detune: 1.2, inharm: 0.0004, strike: 0.125, partials: 28, top: 7500, hfDamp: 0.6, hammer: 1, knock: 0.25, box1: 190, box2: 680, boxy: 0.3, lid: 6000, spread: 0.35, drift: 0, level: 0.6, timing: 3 },
    presets: { upright: {}, felt: { lid: 2400, hammer: 0.6, knock: 0.35, boxy: 0.2, level: 1.5 }, honky: { detune: 4, boxy: 0.5, lid: 5000 } },
    preferred: "upright",
    play: player(upright),
  },
  // ------------------------------------------------------------------------------------------------------------- bells
  {
    id: "kalimba", category: "bells", source: NEW, register: [60, 91],
    doc: "Kalimba tuned to the chord: a thumb-plucked tine whose modes are retuned to harmonics (x 1, a short x 6 'ting', faint x 2 and x 3), a soft click and the box's air resonance. Mallet-like, wooden-warm, never inharmonic metal.",
    rules: ["Chord tones only, hypnotic ostinati (unresolved loops), sparse.", DRY],
    defaults: { decay: 1.4, damp: 0.4, ting: 0.45, octave: 0.15, box: 260, boxLevel: 0.35, click: 0.15, lp: 7000, level: 1.2, timing: 3 },
    presets: { kalimba: {}, "deep box": { box: 180, boxLevel: 0.6, ting: 0.18, decay: 1.8 }, plink: { decay: 0.6, ting: 0.4, click: 0.25 } },
    preferred: "kalimba",
    play: player(kalimba),
  },
  // ----------------------------------------------------------------------------------------------------------- strings
  {
    id: "bowedStrings", category: "strings", source: NEW, register: [36, 81],
    doc: "Bowed strings, a waveguide friction model (the stick-slip of a real bow): every player bows on their own (pressure, speed, entry, vibrato rate and depth, a few cents off), through a body (air, wood and bridge modes) and a closing lowpass. An ensemble that breathes; a staccato stab; celli.",
    rules: [SUSTAIN, "Stabs: off-beat or on the one, short, a chord of 3-4 tones.", DRY],
    defaults: { players: 3, detune: 8, pressure: 0.6, bow: 0.8, a: 0.25, d: 0.3, s: 0.85, r: 0.35, vib: 14, vibRate: 5.1, vibDelay: 0.3, entry: 0.03, width: 0.7, lp: 2400, comp: -0.3, glide: 0, level: 0.6 },
    presets: {
      ensemble: { players: 4 },
      celli: { lp: 1800, vib: 10, a: 0.35, level: 1.9 },
      stab: { players: 4, a: 0.012, d: 0.12, s: 0.15, r: 0.1, pressure: 0.75, bow: 1, vib: 0, entry: 0.008, level: 5 },
      solo: { players: 1, vib: 18, width: 0 },
    },
    preferred: "ensemble",
    play: player(bowed),
  },
  // ------------------------------------------------------------------------------------------------------------- brass
  {
    id: "softBrass", category: "brass", source: NEW, register: [43, 79],
    doc: "Soft brass section: 3 players a note, each a drifting saw scooping into pitch through a saturating ladder whose cutoff follows the player's own breath (the brass law: louder = brighter), a little breath. Low resonance, a closed ceiling: warm section stabs and swells, not a resonant synth brass.",
    rules: [SUSTAIN, "Stabs on chord tones in the low-mid register; swells under a drop.", DRY],
    defaults: { players: 3, detune: 10, drift: 4, cutoff: 380, track: 0.6, open: 2.3, ceiling: 2600, res: 0.08, a: 0.06, d: 0.4, s: 0.7, r: 0.25, scoop: 40, scoopTime: 0.05, entry: 0.012, breath: 0.04, width: 0.6, glide: 0, level: 0.55 },
    presets: {
      section: {},
      stab: { a: 0.01, d: 0.16, s: 0.25, r: 0.12, open: 2.6, scoop: 25, level: 1 },
      swell: { a: 0.45, d: 0.6, s: 0.85, r: 0.5, open: 1.8 },
      "low horns": { cutoff: 280, ceiling: 1500, open: 1.8 },
    },
    preferred: "section",
    play: player(softBrass),
  },
  // -------------------------------------------------------------------------------------------------------------- bass
  {
    id: "wideReese", category: "bass", source: NEW, register: [24, 48],
    doc: "Reese bass: three drifting saws phasing against each other, each side through its own wandering saturating ladder; below `xover` (220 Hz) summed to mono with a clean sine sub, above it wide.",
    rules: ["Long notes and slow movement; the sub stays mono (dark-bass rule: widen only above ~260 Hz).", DRY],
    defaults: { detune: 14, drift: 3, cutoff: 520, env: 1.2, fd: 0.35, fs: 0.2, res: 0.25, drive: 0.8, move: 0.4, moveRate: 0.35, xover: 220, sub: 0.7, a: 0.004, d: 0.6, s: 0.85, r: 0.08, glide: 0.05, level: 0.7 },
    presets: { reese: {}, dark: { cutoff: 360, env: 0.8, move: 0.25, detune: 10 }, growl: { cutoff: 700, res: 0.4, drive: 1.6, move: 0.7, detune: 18 } },
    preferred: "reese",
    play: player(reese),
  },
  {
    id: "uprightBass", category: "bass", source: NEW, register: [28, 55],
    doc: "Upright (double) bass pizzicato: the waveguide string plucked by a finger (soft, low position), a strong tension kick (the 'boing' that settles), a big body (air ~60 Hz, plates). Mono-centred low end.",
    rules: ["Walking or sparse off-kick figures; glides are slides, not re-plucks.", DRY],
    defaults: { decay: 1.6, bright: 0.22, position: 0.28, tone: 0.35, body: 4, bodyLevel: 0.7, polar: 0.6, polarMix: 0.5, damp: 0.08, kick: 12, kickTime: 0.06, width: 0, mute: 0, octave: 0, bend: 0, lp: 4000, mono: 1, level: 0.85, timing: 0 },
    presets: { pizz: {}, slap: { bright: 0.6, position: 0.12, kick: 18, lp: 6000 }, muted: { mute: 0.6, decay: 0.6, damp: 0.05 } },
    preferred: "pizz",
    play: player(plucked, true),
  },
  {
    id: "rubberSub", category: "bass", source: NEW, register: [24, 48],
    doc: "Rubber sub: a sine that drops into its note from a few semitones above (the bounce), glides from the last note, squeezed by a decaying asymmetric drive (harmonics while fresh: it reads on a phone) then pure. Mono, no click.",
    rules: ["Off-kick bass notes; glide instead of re-punching between kicks (the 'сбитая драмка' rule).", DRY],
    defaults: { bend: 5, bendTime: 0.03, drive: 0.6, driveDecay: 0.16, floor: 0.1, a: 0.003, d: 0.5, s: 0.8, r: 0.06, glide: 0.06, level: 0.5 },
    presets: { rubber: {}, bouncy: { bend: 12, bendTime: 0.045, drive: 0.8 }, pure: { bend: 0, drive: 0.2, floor: 0.03 } },
    preferred: "rubber",
    play: player(rubberSub, true),
  },
  // ------------------------------------------------------------------------------------------------------------- leads
  {
    id: "sawLead", category: "leads", source: NEW, register: [55, 84],
    doc: "Filtered saw lead: two drifting saws and a sine sub-octave through a driven ladder (or the squelchier diode for the glide line) with key tracking and velocity on its envelope, a post-filter edge, late vibrato, glide. No pulse: not reedy; dark by default.",
    rules: ["Minor / modal riffs that loop unresolved; no sunny major hooks.", "Glide mono: legato notes (pass `from`).", DRY],
    defaults: { detune: 7, drift: 3, sub: 0.25, cutoff: 700, track: 0.5, env: 2.2, fd: 0.35, fs: 0.2, res: 0.32, filter: 0, drive: 0.9, glide: 0.07, vib: 12, vibRate: 5.2, vibDelay: 0.35, a: 0.004, d: 0.3, s: 0.8, r: 0.12, width: 0.3, level: 1 },
    presets: {
      character: {},
      "glide mono": { filter: 1, glide: 0.12, res: 0.45, cutoff: 520, env: 2.6, fd: 0.25, detune: 3, width: 0.1, sub: 0.35, vib: 0 },
      "dark mono": { cutoff: 420, env: 1.6, res: 0.2, vib: 8 },
    },
    preferred: "character",
    play: player(sawLead),
  },
];

/** The new voices by id. */
export const NEW_LIBRARY_BY_ID: Readonly<Record<string, V>> = Object.fromEntries(NEW_LIBRARY.map((v) => [v.id, v]));

/** The renderer behind each new voice (Node renders, CPU measurement, tests). */
export const NEW_RENDERERS = {
  roundClap, rim, handDrum, shaker, choir: vox, voxChop: vox, guitar: plucked, physHarp: plucked, koto: plucked, physWurli: wurli, clav, uprightPiano: upright, kalimba,
  bowedStrings: bowed, softBrass, wideReese: reese, uprightBass: plucked, rubberSub, sawLead,
} as const;
