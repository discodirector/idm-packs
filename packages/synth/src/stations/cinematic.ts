import type { StationPack } from "../pack.ts";
import type { ScorePianoVoice, ScoreSynthVoice } from "../styledata.ts";

// Cinematic: film scores made with synths, one 32-bar cue per pass of the form (styledata.ts ScoreSpec, the triphop
// Cinematic base with its opt-in `score`). Every style is a cue with a theme and an arc: the intro states the world,
// the build brings the ostinato and the percussion in, the climax (form bars 16-23) plays the theme in full, the
// release falls away (often subito) and leads back into the intro.
//
// v2, the premium palette (the owner: "the synths must sound much more expensive"; the organ is gone). Every
// sustained voice is an ensemble: unison copies at their own phases with a slow drift, an ensemble chorus, a slow
// filter LFO, filtered highs (nothing bright in 2-5 kHz), a long dark hall with early reflections. No square or pulse
// waves in a sustained voice, no tremolo chords, no resonant mid-range brass: what read as an organ is now string
// ensemble pads and choirs. The shared voices below are the reusable kit (stations/README.md "Film score voices"):
//   ENS        a string-ensemble pad: 2 saws x 2 unison copies, slow attack, chorus, a breathing filter
//   VIOLINS    a legato violin section for themes      CELLI   low strings, marcato to legato
//   SPICC      the spiccato ostinato (Oppenheimer)     HORNS   soft french horns: an ensemble with a horn's body
//   BRAAM      the Inception braam: low saws an octave deep, driven, the filter opening over 1.6 s
//   STAB       a dark low-brass stab                   LOW     celli and basses on the root
//   CHOIR_AH   an "aah" choir (formants 700/1150 Hz)   CHOIR_OO  a dark "ooh" choir (380/820 Hz)
//   FELT       a felt piano (soft hammer, dark, long)
// plus the score's risers (a Shepard glissando, reverse swells) and the hall's shimmer.
// Five cues, five worlds:
//   Titan       epic hybrid trailer, D minor, 100 BPM: taikos, spiccato 16ths, low brass stabs, a horn theme over
//               string ensembles, the climax's braams and an "aah" choir, a reverse swell into it.
//   Horizon     hopeful and wide (Interstellar), A minor, 80 BPM: a string pulse, a clock tick, a felt piano in the
//               intro, strings and an "ooh" choir swelling for 16 bars, a long-note violin theme, a shimmering hall.
//   Neon Rain   synthetic noir (Blade Runner / 2049), E minor, 67 BPM: CS-80 ensemble pads, a singing CS-80 lead,
//               echoing plucks, a Shepard rise into the climax, sub braams and a dark choir under it; beatless.
//   Pursuit     driving tension (Dunkirk / Bourne), C minor, 92 BPM: the low spiccato pedal, a ticking clock, a
//               heartbeat, dark string pads, a Shepard glissando under the build, the motif in the celli (horns
//               and violins join at the climax), low brass stabs and string swells; the Neapolitan in the climax.
//   Letters     intimate and calm, Eb major, 72 BPM: a felt piano theme over left-hand arpeggios, warm string
//               ensembles, violins doubling the theme at the climax, a soft choir; a long hall with a faint shimmer.
// Keys are the styles' own (GenreStyle.keys); intensities and the form are the score's arc (32 digits a cue).

/** A string-ensemble pad: the lush bed (two saws x two unison copies, a slow attack, chorus, a breathing filter). */
const ENS: ScoreSynthVoice = {
  osc: [
    { type: "sawtooth", detune: -5, oct: 0, level: 0.8 },
    { type: "sawtooth", detune: 6, oct: 0, level: 0.8 },
  ],
  unison: { voices: 2, cents: 14, drift: 5, rate: 0.2 },
  spread: 0.9, attack: 1.2, decay: 2, sustain: 0.9, release: 2.6,
  cutoff: 1900, track: 0.25, env: 700, fa: 1.5, fd: 2.5, q: 0.4, vel: 0.8,
  vib: { rate: 4.8, depth: 4, delay: 1 }, flfo: { rate: 0.08, depth: 260 }, chorus: 0.6, hp: 150, level: 1,
};
/** A legato violin section for themes: a quicker bow, a singing vibrato, a softened top. */
const VIOLINS: ScoreSynthVoice = {
  osc: [
    { type: "sawtooth", detune: -4, oct: 0, level: 0.8 },
    { type: "sawtooth", detune: 5, oct: 0, level: 0.8 },
  ],
  unison: { voices: 2, cents: 12, drift: 4, rate: 0.3 },
  spread: 0.6, attack: 0.3, decay: 1, sustain: 0.9, release: 1.2,
  cutoff: 2600, track: 0.15, env: 600, fa: 0.4, fd: 1.2, q: 0.4, vel: 0.7,
  vib: { rate: 5.3, depth: 9, delay: 0.4 }, chorus: 0.5, hp: 220, level: 1,
};
/** Low strings (celli and violas): a marcato bite that settles into a legato line. */
const CELLI: ScoreSynthVoice = {
  osc: [
    { type: "sawtooth", detune: -5, oct: 0, level: 0.8 },
    { type: "sawtooth", detune: 6, oct: 0, level: 0.8 },
  ],
  unison: { voices: 2, cents: 12, drift: 3, rate: 0.25 },
  spread: 0.5, attack: 0.07, decay: 0.8, sustain: 0.85, release: 0.8,
  cutoff: 800, track: 0.3, env: 900, fa: 0.08, fd: 0.6, q: 0.5, vel: 0.7,
  vib: { rate: 5, depth: 6, delay: 0.5 }, chorus: 0.4, hp: 60, level: 1,
};
/** The spiccato ostinato: short bowed notes, each copy at its own phase (no machine-gun sameness). */
const SPICC: ScoreSynthVoice = {
  osc: [
    { type: "sawtooth", detune: -6, oct: 0, level: 0.8 },
    { type: "sawtooth", detune: 6, oct: 0, level: 0.8 },
  ],
  spread: 0.45, attack: 0.004, decay: 0.14, sustain: 0.12, release: 0.12,
  cutoff: 850, track: 0.4, env: 2400, fa: 0.004, fd: 0.09, q: 0.6, vel: 0.6, chorus: 0.3, hp: 70, level: 1.2,
};
/** Soft french horns: an ensemble through a horn's body (formants 480 / 1150 Hz), a gentle scoop, no square. */
const HORNS: ScoreSynthVoice = {
  osc: [
    { type: "sawtooth", detune: -3, oct: 0, level: 0.8 },
    { type: "sawtooth", detune: 4, oct: 0, level: 0.8 },
  ],
  unison: { voices: 2, cents: 8, drift: 3, rate: 0.25 },
  formants: [{ f: 480, q: 2.2, level: 1.6 }, { f: 1150, q: 3.5, level: 0.45 }],
  spread: 0.3, attack: 0.16, decay: 0.8, sustain: 0.85, release: 0.9,
  cutoff: 1100, track: 0.25, env: 900, fa: 0.22, fd: 0.9, q: 0.5, vel: 0.8,
  vib: { rate: 4.8, depth: 5, delay: 0.6 }, scoop: 12, drive: 1.3, chorus: 0.35, hp: 90, level: 1.1,
};
/** The braam (Inception): low saws with one an octave deep, driven, the filter opening slowly over the hit. */
const BRAAM: ScoreSynthVoice = {
  osc: [
    { type: "sawtooth", detune: -6, oct: 0, level: 0.8 },
    { type: "sawtooth", detune: 6, oct: 0, level: 0.8 },
    { type: "sawtooth", detune: 0, oct: -1, level: 0.6 },
  ],
  unison: { voices: 2, cents: 14, drift: 4, rate: 0.15 },
  spread: 0.6, attack: 0.3, decay: 3, sustain: 0.8, release: 1.8,
  cutoff: 150, track: 0, env: 1500, fa: 1.6, fd: 3, q: 0.8, vel: 0.4, drive: 2.4, chorus: 0.25, hp: 32, level: 1,
};
/** A dark low-brass stab: the braam's ensemble, short, the filter snapping open and shut. */
const STAB: ScoreSynthVoice = {
  ...BRAAM,
  osc: [
    { type: "sawtooth", detune: -6, oct: 0, level: 0.8 },
    { type: "sawtooth", detune: 6, oct: 0, level: 0.8 },
  ],
  unison: { voices: 2, cents: 12 },
  attack: 0.03, decay: 0.5, sustain: 0.45, release: 0.5, cutoff: 260, env: 1500, fa: 0.06, fd: 0.5, q: 0.6, vel: 0.8, drive: 1.6, hp: 110,
};
/** Celli and basses on the root (the bass bus): a slow bow, a dark filter, the sine sub under it. */
const LOW: ScoreSynthVoice = {
  osc: [
    { type: "sawtooth", detune: -6, oct: 0, level: 0.8 },
    { type: "sawtooth", detune: 6, oct: 0, level: 0.8 },
  ],
  unison: { voices: 2, cents: 8, drift: 2, rate: 0.2 },
  spread: 0.2, attack: 0.4, decay: 1.5, sustain: 0.9, release: 1.2,
  cutoff: 360, track: 0, env: 250, fa: 0.5, fd: 1.2, q: 0.6, vel: 0.6, hp: 30, level: 1,
};
/** An "aah" choir: an ensemble through the vowel's formants, a slow swell, a wide chorus. */
const CHOIR_AH: ScoreSynthVoice = {
  osc: [
    { type: "sawtooth", detune: 0, oct: 0, level: 0.8 },
    { type: "sawtooth", detune: 7, oct: 0, level: 0.8 },
  ],
  unison: { voices: 2, cents: 16, drift: 5, rate: 0.22 },
  formants: [{ f: 700, q: 5, level: 2.2 }, { f: 1150, q: 6, level: 1.2 }, { f: 2600, q: 9, level: 0.2 }],
  spread: 0.9, attack: 1.6, decay: 2, sustain: 0.95, release: 2.8,
  cutoff: 2600, track: 0, env: 300, fa: 1.2, fd: 2, q: 0.3, vel: 0.6,
  vib: { rate: 5, depth: 7, delay: 0.9 }, chorus: 0.8, hp: 180, level: 1.3,
};
/** A dark "ooh" choir: the same ensemble on the darker vowel. */
const CHOIR_OO: ScoreSynthVoice = {
  ...CHOIR_AH,
  formants: [{ f: 380, q: 5, level: 2.6 }, { f: 820, q: 6, level: 0.9 }, { f: 2300, q: 9, level: 0.08 }],
  cutoff: 1600, hp: 120,
};
/** A felt piano: a soft hammer, dark partials, a long aftersound for a big hall. */
const FELT: ScorePianoVoice = {
  kind: "piano",
  partials: 8, stretch: 0.0004, detune: 1.6, prompt: 0.4, decay: 7, damp: 0.9, bright: 0.25, hammer: 0.5,
  cutoff: 2600, release: 0.7, hp: 50, level: 1.1,
};

export default {
  key: "cinematic",
  name: "Cinematic",
  genres: ["triphop"],
  styles: {
    triphop: [
      // ------------------------------------------------------------------------------------------------ Titan
      {
        id: "cine-titan",
        name: "Titan",
        base: "cinematic",
        bpm: [99, 101],
        swing: 0.5,
        microScale: 0,
        trim: 1.02,
        riser: 0,
        keys: [2],
        data: {
          vinyl: 0,
          mix: { lead: 4, bass: -3, kick: -2 },
          score: {
            scale: [0, 2, 3, 5, 7, 8, 10],
            chords: [
              { bass: 0, tones: [-5, 0, 3, 7] },
              { bass: -4, tones: [-4, 0, 3, 8] },
              { bass: 3, tones: [-5, -2, 3, 7] },
              { bass: -2, tones: [-7, -2, 2, 5] },
            ],
            harmony: [0, 0, 1, 1, 2, 2, 3, 3, 0, 0, 1, 1, 2, 2, 3, 3, 0, 1, 2, 3, 0, 1, 3, 3, 1, 1, 0, 0, 1, 1, 3, 3],
            arc: "33344455556677889999999955444333",
            open: 0.8,
            voices: {
              strings: ENS,
              violins: { ...VIOLINS, attack: 0.14, fa: 0.2 },
              spicc: SPICC,
              horn: HORNS,
              stab: STAB,
              braam: BRAAM,
              low: LOW,
              choir: CHOIR_AH,
            },
            parts: [
              // Celli and basses on the root, the sine sub an octave under.
              { voice: "low", play: "root", bus: "bass", on: [2, 9], oct: 0, level: 1, dyn: 0.36, hold: 2, sub: 0.35 },
              // The string section on the chord, then the violins an octave up from the build.
              { voice: "strings", play: "chord", bus: "harm", on: [2, 9], oct: 24, level: 1, dyn: 0.33, hold: 4, pan: -0.1 },
              { voice: "strings", play: "chord", bus: "harm", on: [6, 9], oct: 36, level: 0.6, dyn: 0.42, tones: [1, 2, 3], pan: 0.15 },
              // The climax's "aah" choir over the strings.
              { voice: "choir", play: "chord", bus: "harm", on: [9, 9], oct: 24, level: 0.8, dyn: 0, hold: 2, tones: [1, 2, 3], pan: -0.05 },
              // The spiccato ostinato: eighths, then the 3-3-2 sixteenths (violins an octave up in the climax).
              {
                voice: "spicc", play: "figure", bus: "harm", on: [3, 9], oct: 12, level: 1, dyn: 0.4, bars: 1, blocks: [0, 1, 1, 0],
                figures: [
                  [
                    { s: 0, len: 1.5, t: 0, v: 0.9 }, { s: 2, len: 1.5, t: 0, v: 0.5 }, { s: 4, len: 1.5, t: 2, v: 0.7 }, { s: 6, len: 1.5, t: 0, v: 0.5 },
                    { s: 8, len: 1.5, t: 3, v: 0.8 }, { s: 10, len: 1.5, t: 0, v: 0.5 }, { s: 12, len: 1.5, t: 2, v: 0.7 }, { s: 14, len: 1.5, t: 1, v: 0.6 },
                  ],
                  [
                    { s: 0, len: 0.8, t: 0, v: 1 }, { s: 1, len: 0.8, t: 0, v: 0.55 }, { s: 2, len: 0.8, t: 0, v: 0.55 }, { s: 3, len: 0.8, t: 2, v: 0.9 },
                    { s: 4, len: 0.8, t: 0, v: 0.55 }, { s: 5, len: 0.8, t: 0, v: 0.55 }, { s: 6, len: 0.8, t: 3, v: 0.95 }, { s: 7, len: 0.8, t: 0, v: 0.55 },
                    { s: 8, len: 0.8, t: 0, v: 1 }, { s: 9, len: 0.8, t: 0, v: 0.55 }, { s: 10, len: 0.8, t: 0, v: 0.55 }, { s: 11, len: 0.8, t: 2, v: 0.9 },
                    { s: 12, len: 0.8, t: 0, v: 0.55 }, { s: 13, len: 0.8, t: 0, v: 0.55 }, { s: 14, len: 0.8, t: 1, v: 0.95 }, { s: 15, len: 0.8, t: 2, v: 0.6 },
                  ],
                ],
                doubles: [{ voice: "spicc", oct: 24, level: 0.5, on: [9, 9] }],
              },
              // Brass stabs with the build's taikos.
              {
                voice: "stab", play: "figure", bus: "harm", on: [5, 8], oct: 24, level: 0.9, dyn: 0.4, bars: 1, blocks: [-1, 0, -1, -1],
                figures: [[{ s: 0, len: 2.5, c: true, v: 1 }, { s: 3, len: 1.5, c: true, v: 0.7 }, { s: 6, len: 3, c: true, v: 0.85 }]],
              },
              // The climax's braams: root, fifth and octave, two bars each.
              {
                voice: "braam", play: "figure", bus: "harm", on: [9, 9], oct: 12, level: 0.9, dyn: 0, bars: 2, blocks: [-1, -1, 0, -1],
                figures: [[{ s: 0, len: 28, t: 0 }, { s: 0, len: 28, t: 2 }, { s: 0, len: 28, t: 3 }]],
              },
              // The horn theme: in augmentation in the build, in full at the climax (violins an octave up, low brass
              // an octave down), a fragment in the release.
              {
                voice: "horn", play: "figure", bus: "lead", on: [2, 9], oct: 24, level: 1, dyn: 0.4, bars: 8, blocks: [-1, 0, 1, 2],
                figures: [
                  [
                    { s: 0, len: 6, n: 0 }, { s: 6, len: 2, n: 2, v: 0.8 }, { s: 8, len: 4, n: 3 }, { s: 12, len: 20, n: 7 },
                    { s: 32, len: 6, n: 8 }, { s: 38, len: 2, n: 7, v: 0.8 }, { s: 40, len: 24, n: 3 },
                    { s: 64, len: 6, n: 10 }, { s: 70, len: 2, n: 8, v: 0.8 }, { s: 72, len: 24, n: 7 },
                    { s: 96, len: 12, n: 5 }, { s: 108, len: 4, n: 2, v: 0.8 },
                  ],
                  [
                    { s: 0, len: 6, n: 0 }, { s: 6, len: 2, n: 2, v: 0.8 }, { s: 8, len: 4, n: 3 }, { s: 12, len: 4, n: 7 },
                    { s: 16, len: 6, n: 8 }, { s: 22, len: 2, n: 7, v: 0.8 }, { s: 24, len: 8, n: 3 },
                    { s: 32, len: 6, n: 10 }, { s: 38, len: 2, n: 8, v: 0.8 }, { s: 40, len: 8, n: 7 },
                    { s: 48, len: 12, n: 5 }, { s: 60, len: 4, n: 2, v: 0.85 },
                    { s: 64, len: 6, n: 0 }, { s: 70, len: 2, n: 2, v: 0.8 }, { s: 72, len: 4, n: 3 }, { s: 76, len: 4, n: 7 },
                    { s: 80, len: 8, n: 12 }, { s: 88, len: 4, n: 10 }, { s: 92, len: 4, n: 8 },
                    { s: 96, len: 6, n: 10 }, { s: 102, len: 2, n: 12, v: 0.85 }, { s: 104, len: 8, n: 14 },
                    { s: 112, len: 14, n: 14 },
                  ],
                  [
                    { s: 0, len: 8, n: 3, v: 0.8 }, { s: 8, len: 8, n: 0, v: 0.75 }, { s: 16, len: 16, n: -4, v: 0.7 },
                    { s: 32, len: 6, n: 0, v: 0.75 }, { s: 38, len: 2, n: 2, v: 0.6 }, { s: 40, len: 8, n: 3, v: 0.75 }, { s: 48, len: 16, n: -5, v: 0.7 },
                    { s: 96, len: 8, n: 2, v: 0.6 }, { s: 104, len: 8, n: -2, v: 0.6 }, { s: 112, len: 16, n: 2, v: 0.6 },
                  ],
                ],
                doubles: [
                  { voice: "violins", oct: 36, level: 0.7, on: [8, 9] },
                  { voice: "horn", oct: 12, level: 0.55, on: [9, 9] },
                ],
              },
            ],
            drums: {
              taiko: {
                layers: [
                  { tone: "sine", freq: 92, to: 50, sweep: 0.07, decay: 0.7, level: 1.2 },
                  { tone: "triangle", freq: 190, to: 105, sweep: 0.04, decay: 0.14, level: 0.45 },
                  { noise: "lowpass", freq: 900, q: 0.7, decay: 0.06, level: 0.5 },
                ],
                bus: "kick",
              },
              tom: {
                layers: [
                  { tone: "sine", freq: 150, to: 100, sweep: 0.05, decay: 0.35, level: 0.9 },
                  { tone: "triangle", freq: 300, to: 190, sweep: 0.05, decay: 0.1, level: 0.3 },
                  { noise: "bandpass", freq: 1400, q: 1, decay: 0.04, level: 0.35 },
                ],
                bus: "perc",
                pan: 0.25,
              },
              snare: {
                layers: [
                  { noise: "bandpass", freq: 1900, q: 0.7, decay: 0.22, level: 0.8 },
                  { tone: "triangle", freq: 200, to: 165, sweep: 0.05, decay: 0.1, level: 0.5 },
                  { noise: "highpass", freq: 5200, q: 0.7, decay: 0.1, level: 0.25 },
                ],
                bus: "snare",
              },
              boom: {
                layers: [
                  { tone: "sine", freq: 64, to: 30, sweep: 0.5, decay: 2, level: 1.5 },
                  { noise: "lowpass", freq: 500, q: 0.7, decay: 0.5, level: 0.6 },
                  { tone: "triangle", freq: 120, to: 45, sweep: 0.3, decay: 0.6, level: 0.5 },
                ],
                bus: "kick",
              },
              rise: { layers: [{ noise: "highpass", freq: 700, to: 7000, q: 0.8, attack: 1.75, decay: 0.08, level: 0.5 }], bus: "fx" },
            },
            lanes: [
              { drum: "taiko", hits: "9.......6.......", on: [2, 5], level: 0.8, dyn: 0.4 },
              { drum: "taiko", hits: "9..6..8.9..6.7..", on: [6, 8], level: 0.95, dyn: 0.5 },
              { drum: "taiko", hits: "9.79..8.9..7.8..9.79..8.9.7.9876", on: [9, 9], level: 1.05, dyn: 0 },
              { drum: "tom", hits: "....7.....6...7.", on: [9, 9], level: 0.75, dyn: 0 },
              { drum: "tom", hits: "........5.6.7899", on: [5, 9], bars: [15], level: 0.9, dyn: 0 },
              { drum: "snare", hits: "....9.......9...", on: [9, 9], level: 0.75, dyn: 0 },
              { drum: "snare", hits: "4.4.5.5.6.6.....", on: [5, 9], bars: [15], level: 0.7, dyn: 0 },
              { drum: "boom", hits: "9...............", on: [0, 9], bars: [16, 20], level: 1.1, dyn: 0 },
              { drum: "boom", hits: "9...............", on: [0, 9], bars: [8], level: 0.6, dyn: 0 },
            ],
            // A reverse swell of the choir and air into the climax (bars 14-15, cut at bar 16's boom).
            risers: [{ kind: "swell", at: 14, bars: 2, level: 0.9, oct: 24, voice: "choir", noise: 0.6 }],
            ensemble: { rate: 0.45, depth: 2.6, delay: 11, mix: 1 },
            hall: { decay: 4.6, lp: 4200, hp: 200, early: 0.5, pre: 28, send: { harm: 0.38, lead: 0.32, perc: 0.3, kick: 0.15, snare: 0.3, fx: 0.3 } },
          },
        },
      },
      // ------------------------------------------------------------------------------------------------ Horizon
      {
        id: "cine-horizon",
        name: "Horizon",
        base: "cinematic",
        bpm: [79, 81],
        swing: 0.5,
        microScale: 0,
        trim: 1.43,
        riser: 0,
        keys: [9],
        data: {
          vinyl: 0,
          mix: { lead: 3, bass: -2, kick: -4 },
          score: {
            scale: [0, 2, 3, 5, 7, 8, 10],
            chords: [
              { bass: 0, tones: [0, 7, 12, 15] },
              { bass: -4, tones: [0, 8, 12, 15] },
              { bass: 5, tones: [0, 8, 12, 17] },
              { bass: 7, tones: [-2, 7, 14, 19] },
              { bass: 3, tones: [3, 7, 10, 15] },
              { bass: -2, tones: [-2, 5, 10, 14] },
            ],
            harmony: [0, 0, 1, 1, 2, 2, 3, 3, 0, 0, 1, 1, 2, 2, 3, 3, 0, 1, 4, 5, 0, 1, 4, 5, 1, 1, 0, 0, 1, 1, 0, 0],
            arc: "22233344555667789999999944332222",
            open: 0.8,
            voices: {
              pulse: {
                osc: [
                  { type: "sawtooth", detune: -6, oct: 0, level: 0.75 },
                  { type: "triangle", detune: 5, oct: 0, level: 0.6 },
                ],
                unison: { voices: 2, cents: 12 },
                spread: 0.6, attack: 0.01, decay: 0.32, sustain: 0.22, release: 0.3,
                cutoff: 1300, track: 0.3, env: 800, fa: 0.01, fd: 0.2, q: 0.5, vel: 0.7, hp: 120, chorus: 0.45, level: 1,
              },
              strings: { ...ENS, attack: 1.8, release: 3, fa: 2.6, fd: 3, cutoff: 2100 },
              choir: CHOIR_OO,
              violins: { ...VIOLINS, attack: 0.45, fa: 0.6 },
              low: LOW,
              felt: FELT,
            },
            parts: [
              { voice: "low", play: "root", bus: "bass", on: [2, 9], oct: 12, level: 1, dyn: 0.42, hold: 2, sub: 0.4 },
              { voice: "strings", play: "chord", bus: "harm", on: [2, 9], oct: 24, level: 1, dyn: 0.42, hold: 8, pan: -0.1 },
              { voice: "strings", play: "chord", bus: "harm", on: [6, 9], oct: 36, level: 0.6, dyn: 0.48, tones: [1, 2, 3], pan: 0.2 },
              // An "ooh" choir swelling with the strings from the second half of the build (the v1 chorale's place).
              { voice: "choir", play: "chord", bus: "harm", on: [6, 9], oct: 24, level: 0.75, dyn: 0.48, hold: 4, tones: [0, 1, 2] },
              // A felt piano in the quiet: the chord's tones falling and rising, far away in the hall.
              {
                voice: "felt", play: "figure", bus: "lead", on: [2, 5], oct: 36, level: 0.8, dyn: 0.3, bars: 2, fold: true, pan: 0.2,
                figures: [[
                  { s: 0, len: 8, t: 4, v: 0.7 }, { s: 6, len: 6, t: 3, v: 0.5 }, { s: 12, len: 8, t: 2, v: 0.55 },
                  { s: 20, len: 4, t: 3, v: 0.45 }, { s: 24, len: 8, t: 5, v: 0.6 },
                ]],
              },
              // The pulse: root and fifth in eighths all through, sixteenths at the climax.
              {
                voice: "pulse", play: "figure", bus: "harm", on: [2, 9], oct: 24, level: 0.9, dyn: 0.4, bars: 1, fold: true, blocks: [0, 0, 1, 0],
                figures: [
                  [
                    { s: 0, len: 1.6, t: 0, v: 0.9 }, { s: 2, len: 1.6, t: 2, v: 0.6 }, { s: 4, len: 1.6, t: 0, v: 0.8 }, { s: 6, len: 1.6, t: 2, v: 0.6 },
                    { s: 8, len: 1.6, t: 0, v: 0.9 }, { s: 10, len: 1.6, t: 2, v: 0.6 }, { s: 12, len: 1.6, t: 0, v: 0.8 }, { s: 14, len: 1.6, t: 2, v: 0.6 },
                  ],
                  [
                    { s: 0, len: 0.9, t: 0, v: 0.9 }, { s: 1, len: 0.9, t: 2, v: 0.55 }, { s: 2, len: 0.9, t: 3, v: 0.7 }, { s: 3, len: 0.9, t: 2, v: 0.55 },
                    { s: 4, len: 0.9, t: 0, v: 0.85 }, { s: 5, len: 0.9, t: 2, v: 0.55 }, { s: 6, len: 0.9, t: 3, v: 0.7 }, { s: 7, len: 0.9, t: 2, v: 0.55 },
                    { s: 8, len: 0.9, t: 0, v: 0.9 }, { s: 9, len: 0.9, t: 2, v: 0.55 }, { s: 10, len: 0.9, t: 3, v: 0.7 }, { s: 11, len: 0.9, t: 2, v: 0.55 },
                    { s: 12, len: 0.9, t: 0, v: 0.85 }, { s: 13, len: 0.9, t: 2, v: 0.55 }, { s: 14, len: 0.9, t: 3, v: 0.7 }, { s: 15, len: 0.9, t: 2, v: 0.55 },
                  ],
                ],
              },
              // Three against four: a dotted-eighth figure over the pulse.
              {
                voice: "pulse", play: "figure", bus: "harm", on: [6, 9], oct: 24, level: 0.6, dyn: 0.4, bars: 1, fold: true, pan: 0.3, blocks: [-1, 0, 0, -1],
                figures: [[{ s: 0, len: 2.5, t: 3, v: 0.8 }, { s: 3, len: 2.5, t: 4, v: 0.7 }, { s: 6, len: 2.5, t: 3, v: 0.75 }, { s: 9, len: 2.5, t: 4, v: 0.7 }, { s: 12, len: 2.5, t: 5, v: 0.8 }]],
              },
              // The violin theme in long notes (violas an octave under at the climax).
              {
                voice: "violins", play: "figure", bus: "lead", on: [4, 9], oct: 36, level: 1, dyn: 0.4, bars: 8, blocks: [-1, 0, 1, -1],
                figures: [
                  [
                    { s: 0, len: 12, n: 7 }, { s: 12, len: 4, n: 5, v: 0.8 }, { s: 16, len: 16, n: 3 },
                    { s: 32, len: 8, n: 3 }, { s: 40, len: 8, n: 0 }, { s: 48, len: 16, n: -4 },
                    { s: 64, len: 8, n: 0 }, { s: 72, len: 8, n: 5 }, { s: 80, len: 16, n: 8 },
                    { s: 96, len: 12, n: 7 }, { s: 108, len: 4, n: 5, v: 0.8 }, { s: 112, len: 16, n: 2 },
                  ],
                  [
                    { s: 0, len: 8, n: 7 }, { s: 8, len: 8, n: 12 },
                    { s: 16, len: 12, n: 8 }, { s: 28, len: 4, n: 7, v: 0.8 },
                    { s: 32, len: 8, n: 7 }, { s: 40, len: 8, n: 10 },
                    { s: 48, len: 8, n: 5 }, { s: 56, len: 8, n: 2 },
                    { s: 64, len: 8, n: 3 }, { s: 72, len: 8, n: 7 },
                    { s: 80, len: 16, n: 12 },
                    { s: 96, len: 12, n: 10 }, { s: 108, len: 4, n: 7, v: 0.8 },
                    { s: 112, len: 16, n: 5 },
                  ],
                ],
                doubles: [{ voice: "violins", oct: 24, level: 0.5, on: [9, 9] }],
              },
            ],
            drums: {
              tick: {
                layers: [
                  { noise: "highpass", freq: 5000, q: 1.2, decay: 0.01, level: 0.6 },
                  { tone: "triangle", freq: 2600, decay: 0.008, level: 0.25 },
                ],
                bus: "hat",
                pan: -0.3,
              },
              timp: {
                layers: [
                  { tone: "sine", freq: 55, to: 53, sweep: 0.4, decay: 1.8, level: 1.2 },
                  { tone: "sine", freq: 82.5, decay: 0.9, level: 0.35 },
                  { noise: "lowpass", freq: 260, q: 0.7, decay: 0.07, level: 0.4 },
                ],
                bus: "kick",
                tune: 0,
              },
            },
            lanes: [
              { drum: "tick", hits: "9...5...7...5...", on: [2, 9], level: 0.45, dyn: 0.3 },
              { drum: "timp", hits: "9.......5.......", on: [9, 9], level: 1, dyn: 0 },
              { drum: "timp", hits: "9...............", on: [0, 9], bars: [8, 12], level: 0.6, dyn: 0 },
            ],
            risers: [{ kind: "swell", at: 14, bars: 2, level: 0.8, oct: 24, voice: "strings", noise: 0.3 }],
            ensemble: { rate: 0.4, depth: 3, delay: 12, mix: 1.1 },
            hall: { decay: 6.5, lp: 4000, hp: 200, early: 0.4, pre: 35, shimmer: 0.12, send: { harm: 0.42, lead: 0.45, kick: 0.3, hat: 0.15, perc: 0.3 } },
          },
        },
      },
      // ---------------------------------------------------------------------------------------------- Neon Rain
      {
        id: "cine-neon",
        name: "Neon Rain",
        base: "cinematic",
        bpm: [66, 68],
        swing: 0.5,
        microScale: 0,
        trim: 1.01,
        riser: 0,
        keys: [4],
        data: {
          vinyl: 0,
          mix: { harm: 5, bass: -4, lead: 1 },
          fx: {
            echo: { steps: 3, taps: 5, fb: 0.45, lp: 2200, hp: 350 },
            echoSend: { lead: 0.28, perc: 0.35, harm: 0.08 },
          },
          score: {
            scale: [0, 2, 3, 5, 7, 8, 10],
            chords: [
              { bass: 0, tones: [0, 3, 7, 14] },
              { bass: 8, tones: [-4, 0, 3, 7] },
              { bass: 5, tones: [-7, -4, 0, 3] },
              { bass: 10, tones: [-2, 2, 5, 10] },
              { bass: 7, tones: [-5, -2, 2, 5] },
            ],
            harmony: [0, 0, 1, 1, 2, 2, 3, 3, 0, 0, 1, 1, 2, 2, 4, 4, 1, 3, 0, 0, 1, 3, 0, 0, 2, 2, 0, 0, 2, 2, 0, 0],
            arc: "33334444555566788999998876554433",
            open: 0.8,
            voices: {
              cspad: {
                osc: [
                  { type: "sawtooth", detune: -7, oct: 0, level: 0.8 },
                  { type: "sawtooth", detune: 7, oct: 0, level: 0.8 },
                ],
                unison: { voices: 2, cents: 12, drift: 6, rate: 0.15 },
                spread: 0.9, attack: 1.4, decay: 2.2, sustain: 0.85, release: 2.6,
                cutoff: 620, track: 0.3, env: 1700, fa: 1.8, fd: 2.6, q: 1.5, vel: 0.8,
                vib: { rate: 5.5, depth: 5, delay: 1.2 }, flfo: { rate: 0.06, depth: 400 }, chorus: 0.7, hp: 140, level: 1,
              },
              cslead: {
                osc: [
                  { type: "sawtooth", detune: -4, oct: 0, level: 0.9 },
                  { type: "sawtooth", detune: 5, oct: 0, level: 0.7 },
                  { type: "triangle", detune: 0, oct: -1, level: 0.4 },
                ],
                spread: 0.25, attack: 0.2, decay: 1, sustain: 0.85, release: 1.8,
                cutoff: 850, track: 0.4, env: 1700, fa: 0.4, fd: 1.2, q: 1.6, vel: 0.6,
                vib: { rate: 5.4, depth: 24, delay: 0.55 }, scoop: 45, scoopTime: 0.18, glide: 0.14, drive: 1.1, hp: 180, chorus: 0.3, level: 1,
              },
              csbass: {
                osc: [
                  { type: "sawtooth", detune: 0, oct: 0, level: 0.7 },
                  { type: "triangle", detune: 0, oct: 0, level: 0.6 },
                ],
                spread: 0, attack: 0.3, decay: 1.5, sustain: 0.9, release: 1.2,
                cutoff: 260, track: 0, env: 500, fa: 0.3, fd: 1, q: 1.2, vel: 0.6, hp: 30, level: 1,
              },
              pluck: {
                osc: [
                  { type: "sawtooth", detune: -3, oct: 0, level: 0.8 },
                  { type: "triangle", detune: 4, oct: 0, level: 0.6 },
                ],
                spread: 0.5, attack: 0.005, decay: 0.6, sustain: 0, release: 0.4,
                cutoff: 650, track: 0.4, env: 2000, fa: 0.005, fd: 0.25, q: 1.4, vel: 0.6, hp: 200, level: 0.9,
              },
              braam: { ...BRAAM, cutoff: 130, env: 1200, fa: 2.2, fd: 3.5 },
              choir: CHOIR_OO,
            },
            parts: [
              { voice: "csbass", play: "root", bus: "bass", on: [3, 9], oct: 12, level: 1, dyn: 0.3, hold: 2, sub: 0.35 },
              { voice: "cspad", play: "chord", bus: "harm", on: [3, 9], oct: 36, level: 1, dyn: 0.3, hold: 2 },
              // A dark choir under the climax, and the 2049 braams: root and octave on each chord.
              { voice: "choir", play: "chord", bus: "harm", on: [8, 9], oct: 24, level: 0.7, dyn: 0.3, hold: 2, tones: [0, 1, 2] },
              {
                voice: "braam", play: "figure", bus: "harm", on: [8, 9], oct: 12, level: 0.85, dyn: 0, bars: 4, blocks: [-1, -1, 0, -1],
                figures: [[{ s: 0, len: 15, r: true }, { s: 16, len: 15, r: true }, { s: 32, len: 30, r: true }]],
                doubles: [{ voice: "braam", oct: 24, level: 0.5 }],
              },
              // The echoing plucks: an arpeggio in eighths over two bars.
              {
                voice: "pluck", play: "figure", bus: "perc", on: [5, 8], oct: 36, level: 0.6, dyn: 0.4, bars: 2, fold: true, pan: 0.35, blocks: [-1, 0, -1, 0],
                figures: [[
                  { s: 0, len: 3, t: 0, v: 0.8 }, { s: 2, len: 3, t: 1, v: 0.6 }, { s: 4, len: 3, t: 2, v: 0.7 }, { s: 6, len: 3, t: 3, v: 0.6 },
                  { s: 8, len: 3, t: 4, v: 0.75 }, { s: 10, len: 3, t: 3, v: 0.55 }, { s: 12, len: 3, t: 2, v: 0.65 }, { s: 14, len: 3, t: 1, v: 0.55 },
                  { s: 16, len: 3, t: 0, v: 0.75 }, { s: 18, len: 3, t: 1, v: 0.55 }, { s: 20, len: 3, t: 2, v: 0.65 }, { s: 22, len: 3, t: 3, v: 0.55 },
                  { s: 24, len: 3, t: 4, v: 0.7 }, { s: 26, len: 3, t: 5, v: 0.55 }, { s: 28, len: 3, t: 4, v: 0.6 }, { s: 30, len: 3, t: 2, v: 0.5 },
                ]],
              },
              // The CS-80 lead: a pickup in the intro, the theme, its climax an octave higher, a falling fragment.
              {
                voice: "cslead", play: "figure", bus: "lead", on: [4, 9], oct: 36, level: 1, dyn: 0.4, bars: 8, blocks: [0, 1, 2, 3],
                figures: [
                  [
                    { s: 64, len: 12, n: 7, v: 0.8 }, { s: 76, len: 4, n: 5, v: 0.7 }, { s: 80, len: 16, n: 3, v: 0.8 },
                    { s: 96, len: 12, n: 2, v: 0.8 }, { s: 108, len: 4, n: 5, v: 0.7 }, { s: 112, len: 16, n: 10, v: 0.8 },
                  ],
                  [
                    { s: 0, len: 12, n: 7 }, { s: 12, len: 2, n: 5, v: 0.7 }, { s: 14, len: 2, n: 3, v: 0.7 }, { s: 16, len: 8, n: 2 }, { s: 24, len: 8, n: 0 },
                    { s: 32, len: 8, n: 3 }, { s: 40, len: 16, n: 12 }, { s: 56, len: 8, n: 10 },
                    { s: 64, len: 16, n: 8 }, { s: 80, len: 8, n: 7 }, { s: 88, len: 8, n: 5 },
                    { s: 96, len: 12, n: 2 }, { s: 108, len: 4, n: 5, v: 0.8 }, { s: 112, len: 16, n: 7 },
                  ],
                  [
                    { s: 0, len: 8, n: 12 }, { s: 8, len: 8, n: 15 },
                    { s: 16, len: 12, n: 14 }, { s: 28, len: 2, n: 12, v: 0.7 }, { s: 30, len: 2, n: 10, v: 0.7 },
                    { s: 32, len: 16, n: 12 },
                    { s: 48, len: 8, n: 15 }, { s: 56, len: 8, n: 14 },
                    { s: 64, len: 16, n: 12 },
                    { s: 80, len: 8, n: 10 }, { s: 88, len: 8, n: 5 },
                    { s: 96, len: 32, n: 7 },
                  ],
                  [
                    { s: 0, len: 16, n: 8, v: 0.8 }, { s: 16, len: 16, n: 7, v: 0.75 }, { s: 32, len: 16, n: 3, v: 0.7 }, { s: 48, len: 16, n: 0, v: 0.65 },
                  ],
                ],
                doubles: [{ voice: "cslead", oct: 24, level: 0.45, on: [9, 9] }],
              },
            ],
            drums: {
              thunder: {
                layers: [
                  { tone: "sine", freq: 62, to: 34, sweep: 0.4, decay: 2, level: 1.3 },
                  { noise: "lowpass", freq: 240, q: 0.7, decay: 1.1, level: 0.45 },
                  { tone: "triangle", freq: 110, to: 60, sweep: 0.2, decay: 0.5, level: 0.3 },
                ],
                bus: "kick",
              },
            },
            lanes: [
              { drum: "thunder", hits: "9...............", on: [0, 9], bars: [8, 16, 20], level: 1, dyn: 0 },
              { drum: "thunder", hits: "........6.......", on: [9, 9], level: 0.7, dyn: 0 },
            ],
            // A dark Shepard rise under the build's last four bars.
            risers: [{ kind: "shepard", at: 12, bars: 4, level: 0.7, oct: 12, speed: 0.35, bright: 1500, bus: "harm" }],
            ensemble: { rate: 0.35, depth: 3.2, delay: 13, mix: 1.1 },
            hall: { decay: 7.5, lp: 3500, hp: 180, early: 0.5, pre: 40, send: { harm: 0.5, lead: 0.5, kick: 0.35, perc: 0.4 } },
          },
        },
      },
      // ------------------------------------------------------------------------------------------------ Pursuit
      {
        id: "cine-pursuit",
        name: "Pursuit",
        base: "cinematic",
        bpm: [91, 93],
        swing: 0.5,
        microScale: 0,
        trim: 1.62,
        riser: 0,
        keys: [0],
        data: {
          vinyl: 0,
          mix: { lead: 3, bass: -3 },
          score: {
            scale: [0, 2, 3, 5, 7, 8, 10],
            colour: [1],
            chords: [
              { bass: 0, tones: [-5, 0, 3, 7] },
              { bass: -4, tones: [-4, 0, 3, 8] },
              { bass: 5, tones: [-4, 0, 5, 8] },
              { bass: 1, tones: [-4, 1, 5, 8] },
              { bass: 7, tones: [-5, -2, 2, 7] },
            ],
            harmony: [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 4, 4, 0, 0, 1, 1, 2, 2, 3, 3, 0, 0, 0, 0, 1, 1, 0, 0],
            arc: "33334444445566778999999955444433",
            open: 0.8,
            voices: {
              spicc: { ...SPICC, cutoff: 950, env: 2000 },
              pad: { ...ENS, cutoff: 1400, env: 500, attack: 1, flfo: { rate: 0.11, depth: 350 } },
              stab: STAB,
              swell: { ...ENS, attack: 2.2, swell: true, decay: 1, sustain: 1, release: 0.6, cutoff: 1500, env: 900, fa: 2.4, fd: 1 },
              horn: HORNS,
              celli: CELLI,
              violins: { ...VIOLINS, attack: 0.12, fa: 0.15 },
              low: LOW,
              choir: CHOIR_OO,
            },
            parts: [
              // The pedal: a low spiccato C in eighths, then 3-3-2 sixteenths turning on Eb and D (basses an octave
              // under in the climax). Over the Db chord it rubs on purpose.
              {
                voice: "spicc", play: "figure", bus: "harm", on: [1, 9], oct: 12, level: 1, dyn: 0.4, bars: 1, blocks: [0, 1, 1, 0],
                figures: [
                  [
                    { s: 0, len: 0.8, n: 0, v: 1 }, { s: 2, len: 0.8, n: 0, v: 0.5 }, { s: 3, len: 0.8, n: 0, v: 0.7 }, { s: 6, len: 0.8, n: 0, v: 0.9 },
                    { s: 8, len: 0.8, n: 0, v: 1 }, { s: 10, len: 0.8, n: 0, v: 0.5 }, { s: 11, len: 0.8, n: 0, v: 0.7 }, { s: 14, len: 0.8, n: 0, v: 0.9 },
                  ],
                  [
                    { s: 0, len: 0.8, n: 0, v: 1 }, { s: 1, len: 0.8, n: 0, v: 0.5 }, { s: 2, len: 0.8, n: 0, v: 0.5 }, { s: 3, len: 0.8, n: 0, v: 1 },
                    { s: 4, len: 0.8, n: 0, v: 0.5 }, { s: 5, len: 0.8, n: 0, v: 0.5 }, { s: 6, len: 0.8, n: 0, v: 1 }, { s: 7, len: 0.8, n: 0, v: 0.5 },
                    { s: 8, len: 0.8, n: 0, v: 1 }, { s: 9, len: 0.8, n: 0, v: 0.5 }, { s: 10, len: 0.8, n: 0, v: 0.5 }, { s: 11, len: 0.8, n: 0, v: 1 },
                    { s: 12, len: 0.8, n: 0, v: 0.5 }, { s: 13, len: 0.8, n: 0, v: 0.5 }, { s: 14, len: 0.8, n: 3, v: 0.9 }, { s: 15, len: 0.8, n: 2, v: 0.6 },
                  ],
                ],
                doubles: [{ voice: "spicc", oct: 0, level: 0.6, on: [8, 9] }],
              },
              { voice: "low", play: "root", bus: "bass", on: [2, 9], oct: 0, level: 1, dyn: 0.36, hold: 2, sub: 0.35 },
              // Dark string pads where v1 had its tremolo chord; a dark choir joins at the climax.
              { voice: "pad", play: "chord", bus: "harm", on: [5, 9], oct: 24, level: 0.75, dyn: 0.36, hold: 2, tones: [1, 2, 3], pan: 0.15 },
              { voice: "choir", play: "chord", bus: "harm", on: [9, 9], oct: 24, level: 0.6, dyn: 0, hold: 2, tones: [0, 1, 2], pan: -0.15 },
              // Brass: short stabs on the one and the "and" of four in the build, two-bar swells in the climax.
              {
                voice: "stab", play: "figure", bus: "harm", on: [5, 7], oct: 24, level: 0.85, dyn: 0.4, bars: 1, blocks: [-1, 0, -1, -1],
                figures: [[{ s: 0, len: 2, c: true, v: 1 }, { s: 14, len: 1.5, c: true, v: 0.8 }]],
              },
              {
                voice: "swell", play: "figure", bus: "harm", on: [8, 9], oct: 24, level: 0.8, dyn: 0, bars: 2, blocks: [-1, -1, 0, -1],
                figures: [[{ s: 0, len: 30, c: true }]],
              },
              // The horn motif: C Eb D, down to G; in the climax over iv and the Neapolitan (violins an octave up).
              {
                voice: "celli", play: "figure", bus: "lead", on: [4, 9], oct: 12, level: 1.1, dyn: 0.4, bars: 8, blocks: [-1, 0, 1, -1],
                figures: [
                  [
                    { s: 0, len: 6, n: 0 }, { s: 6, len: 6, n: 3 }, { s: 12, len: 4, n: 2, v: 0.85 }, { s: 16, len: 16, n: -5 },
                    { s: 32, len: 6, n: 0 }, { s: 38, len: 6, n: 3 }, { s: 44, len: 4, n: 5, v: 0.85 }, { s: 48, len: 16, n: 3 },
                    { s: 64, len: 6, n: 0 }, { s: 70, len: 6, n: 3 }, { s: 76, len: 4, n: 2, v: 0.85 }, { s: 80, len: 16, n: -5 },
                    { s: 96, len: 6, n: -2 }, { s: 102, len: 6, n: 2 }, { s: 108, len: 4, n: 0, v: 0.85 }, { s: 112, len: 16, n: 2 },
                  ],
                  [
                    { s: 0, len: 6, n: 0 }, { s: 6, len: 6, n: 3 }, { s: 12, len: 4, n: 2, v: 0.85 }, { s: 16, len: 16, n: -5 },
                    { s: 32, len: 6, n: 0 }, { s: 38, len: 6, n: 3 }, { s: 44, len: 4, n: 5, v: 0.85 }, { s: 48, len: 16, n: 3 },
                    { s: 64, len: 6, n: 5 }, { s: 70, len: 6, n: 8 }, { s: 76, len: 4, n: 7, v: 0.85 }, { s: 80, len: 16, n: 0 },
                    { s: 96, len: 6, n: 1 }, { s: 102, len: 6, n: 5 }, { s: 108, len: 4, n: 3, v: 0.85 }, { s: 112, len: 16, n: -4 },
                  ],
                ],
                doubles: [
                  { voice: "celli", oct: 24, level: 0.55, on: [7, 9] },
                  { voice: "horn", oct: 24, level: 0.5, on: [9, 9] },
                  { voice: "violins", oct: 36, level: 0.45, on: [9, 9] },
                ],
              },
            ],
            drums: {
              tick: {
                layers: [
                  { noise: "highpass", freq: 3500, q: 1.5, decay: 0.012, level: 0.7 },
                  { tone: "triangle", freq: 1900, decay: 0.01, level: 0.35 },
                ],
                bus: "hat",
                pan: 0.3,
              },
              heart: {
                layers: [
                  { tone: "sine", freq: 68, to: 44, sweep: 0.06, decay: 0.28, level: 1.1 },
                  { noise: "lowpass", freq: 300, q: 0.7, decay: 0.03, level: 0.3 },
                ],
                bus: "kick",
              },
              tom: {
                layers: [
                  { tone: "sine", freq: 120, to: 80, sweep: 0.05, decay: 0.4, level: 1 },
                  { tone: "triangle", freq: 240, to: 150, sweep: 0.04, decay: 0.1, level: 0.3 },
                  { noise: "bandpass", freq: 1100, q: 1, decay: 0.05, level: 0.35 },
                ],
                bus: "perc",
                pan: -0.2,
              },
              snare: {
                layers: [
                  { noise: "bandpass", freq: 2100, q: 0.8, decay: 0.16, level: 0.7 },
                  { tone: "triangle", freq: 190, to: 160, sweep: 0.04, decay: 0.08, level: 0.4 },
                ],
                bus: "snare",
              },
              boom: {
                layers: [
                  { tone: "sine", freq: 64, to: 30, sweep: 0.5, decay: 1.8, level: 1.4 },
                  { noise: "lowpass", freq: 500, q: 0.7, decay: 0.45, level: 0.55 },
                ],
                bus: "kick",
              },
              rise: { layers: [{ noise: "highpass", freq: 600, to: 6000, q: 0.8, attack: 1.95, decay: 0.08, level: 0.45 }], bus: "fx" },
            },
            lanes: [
              { drum: "tick", hits: "9.5.7.5.9.5.7.5.", on: [1, 6], level: 0.55, dyn: 0.3 },
              { drum: "tick", hits: "9575957595759575", on: [7, 9], level: 0.5, dyn: 0.2 },
              { drum: "heart", hits: "9..6............", on: [3, 9], level: 1, dyn: 0.5 },
              { drum: "tom", hits: "9.....7...9.7.8.9.....7...9.7898", on: [9, 9], level: 0.9, dyn: 0 },
              { drum: "snare", hits: "........9.......", on: [9, 9], level: 0.8, dyn: 0 },
              { drum: "snare", hits: "3.3.4.4.5.5.6.7.", on: [5, 9], bars: [15], level: 0.7, dyn: 0 },
              { drum: "tom", hits: "........6.7.8.99", on: [5, 9], bars: [15], level: 0.85, dyn: 0 },
              { drum: "boom", hits: "9...............", on: [0, 9], bars: [16, 20], level: 1.1, dyn: 0 },
            ],
            // Dunkirk: a Shepard glissando climbing under the build's second half, then a reverse swell into the hit.
            risers: [
              { kind: "shepard", at: 8, bars: 6, level: 0.6, oct: 12, speed: 0.5, bright: 1800, bus: "harm" },
              { kind: "swell", at: 14, bars: 2, level: 0.7, oct: 24, voice: "pad", noise: 0.5 },
            ],
            ensemble: { rate: 0.5, depth: 2.4, delay: 10, mix: 1 },
            hall: { decay: 3.6, lp: 4000, hp: 230, early: 0.5, pre: 24, send: { harm: 0.32, lead: 0.32, perc: 0.3, snare: 0.25, kick: 0.1, fx: 0.3 } },
          },
        },
      },
      // ------------------------------------------------------------------------------------------------ Letters
      {
        id: "cine-letters",
        name: "Letters",
        base: "cinematic",
        bpm: [71, 73],
        swing: 0.5,
        microScale: 0,
        trim: 2.05,
        riser: 0,
        keys: [3],
        data: {
          vinyl: 0,
          mix: { lead: 3, harm: -1 },
          score: {
            scale: [0, 2, 4, 5, 7, 9, 11],
            chords: [
              { bass: 0, tones: [-5, 0, 4, 7] },
              { bass: -5, tones: [-5, -1, 2, 7] },
              { bass: -3, tones: [-3, 0, 4, 9] },
              { bass: -7, tones: [-3, 0, 5, 9] },
              { bass: 2, tones: [-3, 2, 5, 9] },
              { bass: 4, tones: [-5, -1, 4, 7] },
            ],
            harmony: [0, 1, 2, 3, 0, 1, 3, 1, 2, 3, 0, 1, 2, 3, 4, 1, 3, 1, 5, 2, 4, 1, 0, 0, 3, 0, 3, 0, 3, 1, 0, 0],
            arc: "33334444455667788999999865544333",
            open: 0.82,
            voices: {
              piano: FELT,
              strings: { ...ENS, attack: 1.1, cutoff: 1700, env: 500, chorus: 0.5 },
              violins: { ...VIOLINS, attack: 0.3, cutoff: 2400 },
              cello: { ...CELLI, attack: 0.35, fa: 0.4, fd: 1, cutoff: 650, env: 300, hp: 50 },
              choir: CHOIR_OO,
            },
            parts: [
              // The left hand: the chord broken in eighths from its bass, up and back down.
              {
                voice: "piano", play: "figure", bus: "harm", on: [0, 9], oct: 0, level: 0.75, dyn: 0.4, bars: 1,
                figures: [[
                  { s: 0, len: 16, t: 0, v: 0.85 }, { s: 2, len: 4, t: 2, v: 0.55 }, { s: 4, len: 4, t: 3, v: 0.6 }, { s: 6, len: 4, t: 4, v: 0.6 },
                  { s: 8, len: 4, t: 5, v: 0.65 }, { s: 10, len: 4, t: 4, v: 0.55 }, { s: 12, len: 4, t: 3, v: 0.55 }, { s: 14, len: 2, t: 2, v: 0.5 },
                ]],
              },
              // The right hand: the theme (violins in unison from the build's end, an octave up at the climax).
              {
                voice: "piano", play: "figure", bus: "lead", on: [0, 9], oct: 24, level: 1, dyn: 0.4, bars: 8, blocks: [0, 1, 2, 3],
                figures: [
                  [
                    { s: 0, len: 6, n: 4 }, { s: 6, len: 2, n: 2, v: 0.7 }, { s: 8, len: 4, n: 0, v: 0.85 }, { s: 12, len: 4, n: 7, v: 0.85 },
                    { s: 16, len: 6, n: 11 }, { s: 22, len: 2, n: 9, v: 0.7 }, { s: 24, len: 8, n: 7, v: 0.85 },
                    { s: 32, len: 6, n: 9 }, { s: 38, len: 2, n: 11, v: 0.7 }, { s: 40, len: 4, n: 12, v: 0.85 }, { s: 44, len: 4, n: 16 },
                    { s: 48, len: 6, n: 14 }, { s: 54, len: 2, n: 12, v: 0.7 }, { s: 56, len: 8, n: 9, v: 0.85 },
                    { s: 64, len: 6, n: 4 }, { s: 70, len: 2, n: 2, v: 0.7 }, { s: 72, len: 4, n: 0, v: 0.85 }, { s: 76, len: 4, n: 7, v: 0.85 },
                    { s: 80, len: 6, n: 11 }, { s: 86, len: 2, n: 12, v: 0.7 }, { s: 88, len: 8, n: 14 },
                    { s: 96, len: 6, n: 12 }, { s: 102, len: 2, n: 9, v: 0.7 }, { s: 104, len: 8, n: 5, v: 0.85 },
                    { s: 112, len: 8, n: 7, v: 0.85 }, { s: 120, len: 8, n: 11, v: 0.8 },
                  ],
                  [
                    { s: 0, len: 8, n: 12 }, { s: 8, len: 4, n: 11, v: 0.75 }, { s: 12, len: 4, n: 9, v: 0.8 },
                    { s: 16, len: 8, n: 9 }, { s: 24, len: 4, n: 5, v: 0.8 }, { s: 28, len: 4, n: 7, v: 0.75 },
                    { s: 32, len: 8, n: 7 }, { s: 40, len: 8, n: 12 },
                    { s: 48, len: 12, n: 11 }, { s: 60, len: 4, n: 9, v: 0.75 },
                    { s: 64, len: 8, n: 12 }, { s: 72, len: 8, n: 16 },
                    { s: 80, len: 6, n: 14 }, { s: 86, len: 2, n: 12, v: 0.7 }, { s: 88, len: 8, n: 9, v: 0.85 },
                    { s: 96, len: 8, n: 9 }, { s: 104, len: 8, n: 5, v: 0.85 },
                    { s: 112, len: 16, n: 11 },
                  ],
                  [
                    { s: 0, len: 6, n: 12 }, { s: 6, len: 2, n: 14, v: 0.75 }, { s: 8, len: 4, n: 12, v: 0.85 }, { s: 12, len: 4, n: 9, v: 0.85 },
                    { s: 16, len: 6, n: 11 }, { s: 22, len: 2, n: 12, v: 0.75 }, { s: 24, len: 8, n: 14 },
                    { s: 32, len: 8, n: 16 }, { s: 40, len: 4, n: 14, v: 0.85 }, { s: 44, len: 4, n: 11, v: 0.85 },
                    { s: 48, len: 12, n: 12 }, { s: 60, len: 4, n: 11, v: 0.75 },
                    { s: 64, len: 6, n: 9 }, { s: 70, len: 2, n: 12, v: 0.75 }, { s: 72, len: 8, n: 14 },
                    { s: 80, len: 8, n: 14 }, { s: 88, len: 4, n: 11, v: 0.85 }, { s: 92, len: 4, n: 12, v: 0.8 },
                    { s: 96, len: 16, n: 12 },
                    { s: 112, len: 8, n: 7, v: 0.8 }, { s: 120, len: 8, n: 4, v: 0.75 },
                  ],
                  [
                    { s: 0, len: 16, n: 9, v: 0.8 }, { s: 16, len: 8, n: 7, v: 0.75 }, { s: 24, len: 8, n: 4, v: 0.7 },
                    { s: 32, len: 8, n: 5, v: 0.75 }, { s: 40, len: 8, n: 9, v: 0.75 }, { s: 48, len: 16, n: 7, v: 0.7 },
                    { s: 64, len: 8, n: 12, v: 0.7 }, { s: 72, len: 8, n: 9, v: 0.65 }, { s: 80, len: 16, n: 11, v: 0.65 },
                    { s: 96, len: 24, n: 12, v: 0.6 },
                  ],
                ],
                doubles: [
                  { voice: "violins", oct: 24, level: 0.55, on: [7, 9] },
                  { voice: "violins", oct: 36, level: 0.35, on: [9, 9] },
                ],
              },
              { voice: "strings", play: "chord", bus: "harm", on: [5, 9], oct: 24, level: 0.8, dyn: 0.42, hold: 2, pan: -0.15 },
              { voice: "cello", play: "root", bus: "bass", on: [6, 9], oct: 12, level: 0.7, dyn: 0.42, hold: 1 },
              { voice: "strings", play: "chord", bus: "harm", on: [8, 9], oct: 36, level: 0.45, dyn: 0.48, tones: [1, 2, 3], pan: 0.2 },
              { voice: "choir", play: "chord", bus: "harm", on: [8, 9], oct: 24, level: 0.45, dyn: 0.3, hold: 2, tones: [0, 1, 2], pan: 0.1 },
            ],
            drums: {
              timp: {
                layers: [
                  { tone: "sine", freq: 77.8, to: 75, sweep: 0.3, decay: 1.8, level: 1 },
                  { tone: "sine", freq: 116, decay: 0.9, level: 0.35 },
                  { noise: "lowpass", freq: 400, q: 0.7, decay: 0.06, level: 0.3 },
                ],
                bus: "perc",
                tune: 0,
              },
            },
            lanes: [
              { drum: "timp", hits: "9...............", on: [0, 9], bars: [16, 20], level: 0.55, dyn: 0 },
              { drum: "timp", hits: "2233344455566778", on: [0, 9], bars: [15], level: 0.45, dyn: 0 },
            ],
            ensemble: { rate: 0.4, depth: 2.6, delay: 11, mix: 1 },
            hall: { decay: 6, lp: 4200, hp: 160, early: 0.4, pre: 34, shimmer: 0.12, send: { harm: 0.42, lead: 0.42, perc: 0.35, bass: 0.1 } },
          },
        },
      },
    ],
  },
} satisfies StationPack;
