import type { StationPack } from "../pack.ts";

// Pop House v3: bright, radio-friendly house at 121..127 BPM (sim/stations/pop-house/RECIPE.md). The owner heard v1
// as children's / NES music and v2 as "reverb on the snare": thin, not full. v3 is sound design and layering, not
// space: every main part is 2-3 layers from the shared voice library (packages/synth/src/voices), the arrangement
// adds beds, comping, ostinatos and percussion that enter and leave by part and by 32-bar cycle, and the buses get
// tape saturation, an exciter, mid/side width and drum glue (the rooms were turned down, not up).
//   Piano Sunrise   piano house (Purple Disco Machine, Robin S, Black Box): the layered house piano (additive strings
//                   with per-partial decay + hammer + FM bark + an M1 organ blend), a string-section bed through the
//                   ensemble, a piano octave line in the build and breakdown, the layered M1 organ bass, the
//                   formant-vocal hook. Under the hook the vocal gets its room (the owner: "the vocal is buried,
//                   mush"): the string bed sits out the drop, the piano drops its lowest tone and double, no organ
//                   blend, the harmony bus is cut at 300 Hz and 1.2 kHz and ducks under every sung note, the vocal has
//                   3 dB of presence and almost no chorus or hall.
//   Filter Disco    French filter house (Stardust, Daft Punk, Cassius): the chopped saw loop through its 16-bar filter,
//                   a phasing string bed under it, a muted Karplus-Strong guitar scratching 16ths, a brass section
//                   stack (trumpets + trombones, breath, falls) on the drop's accents, the layered saw bass, the talkbox.
//   Velvet Chops    deep vocal house (Disclosure, Duke Dumont, MK): M1 stabs over a Juno pad bed (saw + pulse + sub,
//                   ensemble, a breathing filter), formant-vocal chops and hook, a blip line into the echo, the layered
//                   pluck bass, congas and 16th shakers.
//   Future Bounce   pop-dance / future house (Joel Corry, Kungs, Calvin Harris): the JP-8000 supersaw (7 saws, free
//                   phases, a sine sub) pumping on the stabs, a Juno bed under the build and breakdown, a 16th supersaw
//                   ostinato every other cycle, the saw lead, the layered pluck bass, the hardest kit (knock, big clap).
//   Disco Strings   nu-disco / funky house (Purple Disco Machine "Body Funk", Kungs, Dimitri From Paris): a string
//                   section bed on every chord, the Nile Rodgers guitar comp, the Rhodes, a horn section with falls on
//                   every other cycle, the layered FM slap bass, congas, toms, tambourine.
// Every style: a layered kit (kick body + knock + click; a rendered clap over a snare body and wires; 16th shakers;
// ride, congas, crash, tom fills by style), the song form (intro / build / drop / breakdown / rebuild) and `ukg.vary`
// walking the figures one entry per 32-bar cycle. Engine: the future garage UK garage voices (engine.ts garageUkg),
// four to the floor, with the opt-in pop house fields (v2: piano, brass, lift, chorus, hall, plate, pump, vary ...;
// v3: grand, saws, bed, arp, gtr, bass2, horns, voc, drums, bus, and the arps / strums tables), all off for every
// other style. Major-key pop progressions are written over the relative natural minor (ukg.keys picks the minor
// tonic: A minor = C major). No noise risers (riser 0), no vinyl.
// Baked (stations/index.ts PACKS) but on no station; the Style Lab's Pop House tab.

export default {
  key: "pop-house",
  name: "Pop House",
  genres: ["futuregarage"],
  styles: {
    futuregarage: [
      // Piano house. The piano carries the track (no saw stab): the classic syncopated piano figures, one chord a bar,
      // three progressions walked a form cycle each. The M1 organ bass on the off-8ths; a vocal-chop hook in the
      // drop; strings swell in the breakdown; the build's last four bars rise (a filtered saw riser and a snare build).
      {
        id: "pop-house-piano",
        name: "Piano Sunrise",
        base: "classic",
        bpm: [122, 124],
        swing: 0.52,
        microScale: 0.15,
        trim: 1.03,
        riser: 0,
        data: {
          chords: [
            { bass: 3, pad: [3, 7, 10, 15], guide: 7, dark: [3, 7, 10] }, // I (C E G C in C major)
            { bass: 10, pad: [2, 5, 10, 14], guide: 2, dark: [2, 5, 10] }, // V/3 (B D G B)
            { bass: 0, pad: [3, 7, 12, 15], guide: 3, dark: [0, 3, 7] }, // vi (C E A C)
            { bass: 8, pad: [3, 8, 12, 15], guide: 12, dark: [0, 3, 8] }, // IV/5 (C F A C)
            { bass: 5, pad: [2, 5, 8, 12], guide: 5, dark: [5, 8, 12] }, // ii (B D F A: Dm7 over D)
          ],
          progressions: [[0, 1, 2, 3], [2, 3, 0, 1], [3, 0, 4, 1]],
          kicks: { lo: [[0, 4, 8, 12]], mid: [[0, 4, 8, 12]], hi: [[0, 4, 8, 12], [0, 4, 8, 12, 15]] },
          skips: [[[7, 0.25], [23, 0.25], [15, 0.3], [31, 0.35]]],
          stabs: [
            [
              { s: 0, len: 1.5, vel: 1, core: true }, { s: 3, len: 1, vel: 0.78, core: true }, { s: 6, len: 1.5, vel: 0.9, core: true },
              { s: 10, len: 1, vel: 0.75, core: true }, { s: 13, len: 1, vel: 0.7, core: false }, { s: 16, len: 1.5, vel: 0.95, core: true },
              { s: 19, len: 1, vel: 0.76, core: true }, { s: 22, len: 1.5, vel: 0.88, core: true }, { s: 26, len: 3, vel: 0.85, core: true },
              { s: 30, len: 1, vel: 0.6, core: false },
            ],
            [
              { s: 2, len: 2, vel: 0.95, core: true }, { s: 6, len: 1, vel: 0.75, core: true }, { s: 8, len: 1.5, vel: 0.85, core: true },
              { s: 11, len: 2, vel: 0.9, core: true }, { s: 14, len: 1, vel: 0.6, core: false }, { s: 18, len: 2, vel: 0.95, core: true },
              { s: 22, len: 1, vel: 0.75, core: true }, { s: 24, len: 1.5, vel: 0.85, core: true }, { s: 27, len: 3, vel: 0.9, core: true },
            ],
            [
              { s: 0, len: 1, vel: 0.9, core: true }, { s: 2, len: 1, vel: 0.7, core: true }, { s: 3, len: 1.5, vel: 0.85, core: true },
              { s: 7, len: 2, vel: 0.95, core: true }, { s: 10, len: 1, vel: 0.7, core: true }, { s: 12, len: 1, vel: 0.6, core: false },
              { s: 16, len: 1, vel: 0.9, core: true }, { s: 18, len: 1, vel: 0.7, core: true }, { s: 19, len: 1.5, vel: 0.85, core: true },
              { s: 23, len: 2, vel: 0.95, core: true }, { s: 26, len: 1, vel: 0.7, core: true }, { s: 28, len: 3, vel: 0.8, core: true },
            ],
          ],
          basslines: [
            [
              { s: 2, len: 1.5, semi: 0, vel: 0.95, core: true }, { s: 6, len: 1.5, semi: 0, vel: 0.85, core: true },
              { s: 10, len: 1.5, semi: 0, vel: 0.9, core: true }, { s: 14, len: 1.5, semi: 12, vel: 0.8, core: true },
              { s: 18, len: 1.5, semi: 0, vel: 0.95, core: true }, { s: 22, len: 1.5, semi: 0, vel: 0.85, core: true },
              { s: 26, len: 1.5, semi: 7, vel: 0.85, core: true }, { s: 30, len: 1.5, semi: 12, vel: 0.8, core: false },
            ],
            [
              { s: 0, len: 1, semi: 0, vel: 1, core: true }, { s: 3, len: 1, semi: 12, vel: 0.8, core: true },
              { s: 6, len: 1.5, semi: 0, vel: 0.85, core: true }, { s: 10, len: 1, semi: 12, vel: 0.85, core: true },
              { s: 11, len: 1.5, semi: 7, vel: 0.75, core: true }, { s: 14, len: 1.5, semi: 0, vel: 0.8, core: true },
              { s: 16, len: 1, semi: 0, vel: 1, core: true }, { s: 19, len: 1, semi: 12, vel: 0.8, core: true },
              { s: 22, len: 1.5, semi: 0, vel: 0.85, core: true }, { s: 26, len: 1, semi: 12, vel: 0.85, core: true },
              { s: 27, len: 1.5, semi: 7, vel: 0.75, core: true }, { s: 30, len: 1.5, semi: 12, vel: 0.75, core: false, glide: true },
            ],
          ],
          motifs: [
            [
              { s: 2, len: 1, tone: 3, core: true }, { s: 3, len: 1, tone: 3, core: true }, { s: 6, len: 2, tone: 2, core: true },
              { s: 10, len: 1, tone: 3, core: true }, { s: 13, len: 2, tone: 1, core: true },
              { s: 18, len: 1, tone: 3, core: true }, { s: 19, len: 1, tone: 3, core: true }, { s: 22, len: 3, tone: 4, core: true },
            ],
            [
              { s: 0, len: 2, tone: 2, core: true }, { s: 3, len: 1, tone: 3, core: true }, { s: 6, len: 1, tone: 3, core: true },
              { s: 8, len: 3, tone: 2, core: true }, { s: 16, len: 2, tone: 2, core: true }, { s: 19, len: 1, tone: 3, core: true },
              { s: 22, len: 1, tone: 4, core: true }, { s: 24, len: 4, tone: 3, core: true },
            ],
          ],
          vowels: [[760, 1150], [500, 850], [560, 1800], [640, 1190]],
          // v3: a piano octave line answering the chords in the drop (the house piano, an octave up).
          arps: [
            [
              { s: 2, len: 1, tone: 3, core: true }, { s: 6, len: 1, tone: 2, core: true }, { s: 10, len: 1, tone: 3, core: true }, { s: 13, len: 1, tone: 4, core: true },
              { s: 18, len: 1, tone: 3, core: true }, { s: 22, len: 1, tone: 2, core: true }, { s: 26, len: 1, tone: 1, core: true }, { s: 29, len: 2, tone: 2, core: true },
            ],
            [
              { s: 3, len: 1, tone: 4, core: true }, { s: 6, len: 1, tone: 3, core: true }, { s: 11, len: 1, tone: 4, core: true }, { s: 14, len: 2, tone: 5, core: true },
              { s: 19, len: 1, tone: 4, core: true }, { s: 22, len: 1, tone: 3, core: true }, { s: 27, len: 1, tone: 2, core: true }, { s: 30, len: 1, tone: 3, core: true },
            ],
          ],
          ukg: {
            keys: [9, 7],
            bars: 1,
            turn: 0,
            vary: 1,
            pump: 1,
            stab: { level: 0 },
            // v3 layers: the layered house piano (strings, hammer, FM bark, an M1 organ blend) carries the chords; a
            // string-section bed with its filter breathing over 16 bars from the build on; a piano octave line in the
            // drop on every second cycle; the layered M1 organ bass; the formant vocal for the hook.
            grand: { level: 1.4, octave: 0, double: 0.35, decay: 1.9, release: 0.3, bright: 0.75, detune: 1.6, bark: 0.45, hammer: 0.55, organ: 0, thin: 1 },
            bed: { kind: "strings", level: 1.1, in: ["build", "breakdown", "rebuild"], cutoff: 2800, lfoBars: 16, lfoDepth: 0.35, attack: 0.5, release: 1.2, octave: 0, width: 0.8, ensemble: 0.7 },
            arp: { kind: "piano", level: 0.55, in: ["build", "breakdown"], alt: 1, octave: 12, pan: 0.4, echo: 0.3 },
            sub: { level: 0.8, attack: 0.004, decay: 0.25, sustain: 0.6, release: 0.06, drive: 0.4 },
            mid: { kind: "organ", level: 0.8, cutoff: 1100, env: 0.3, q: 0.8, decay: 0.18, sustain: 0.35, release: 0.05, drive: 1.2, hp: 100 },
            bass2: { kind: "organ", level: 0.8, cutoff: 1000, env: 0.3, decay: 0.16, sustain: 0.3, release: 0.05, drive: 1.5, top: 0.2, hp: 100 },
            pluck: { level: 0 },
            lead: { level: 0.75, kind: "vox" },
            vox: { level: 0, q: 6, breath: 0.2, bend: -1, scoop: 0.05, release: 0.14, lp: 4200 },
            voc: { level: 1.4, scoop: -1.5, scoopSec: 0.06, vibrato: 22, breath: 0.12, consonant: 0.4, release: 0.1, presence: 3, duck: 0.55 },
            lift: { level: 1, bars: 4, from: 300, to: 5500, detune: 16, roll: 0.8 },
            chorus: { lead: 0.12, harm: 0.2 },
            hall: { level: 0.3, decay: 1.8, lp: 7000, hp: 350, pre: 0.02, harm: 0.3, lead: 0.08, snare: 0.12, fx: 0.4 },
            groove: { hatLate: 0.02, percLate: 0.03, jitter: 0.3, ghost: 0.35, perc: 0, open: 0.5, offOpen: 1, tamb: 0.5, ghostKick: 0, metal: 0 },
            drums: { rideNoise: 1, kick: 0.7, knock: 0.85, click: 0.6, kickDecay: 0.36, clap: 0.8, body: 0.5, wires: 0.5, tail: 0.2, shaker: 1.2, ride: 0.7, crash: 0.8, conga: 0.3, toms: 0 },
            bus: { tape: 1.1, mix: 0.45, exciter: 0.5, width: 0.5, drums: 1.6, mud: 3, carve: 3.5 },
          },
          kit: {
            kick: { start: 150, end: 50, sweep: 0.04, decay: 0.3, click: 0.14, clickHp: 3500, drive: 0.5, body: 1.1 },
            snare: [
              { noise: "bandpass", freq: 1500, q: 1, decay: 0.1, level: 0.2 },
              { clap: 0.5 },
            ],
            ghost: [{ noise: "bandpass", freq: 3200, q: 0.9, decay: 0.03, level: 0.25 }],
            hat: { hp: 8500, decay: 0.02, metal: 0.2, level: 0.18 },
            shaker: { freq: 7600, q: 1.2, decay: 0.03, attack: 0.006, level: 0.06, off: 0.05 },
            open: { hp: 7000, decay: 0.16, metal: 0.3, level: 0.3 },
          },
          vinyl: 0,
          mix: { kick: 1, bass: 0.5 },
          fx: {
            echo: { steps: 3, taps: 3, fb: 0.35, lp: 4000, hp: 500 },
            echoSend: { kick: 0, bass: 0, snare: 0.05, perc: 0.1, lead: 0.22, harm: 0.06, fx: 0.5 },
            space: { size: 1.2, fb: 0.6, lp: 6000 },
            spaceSend: { kick: 0, bass: 0, snare: 0.15, hat: 0.04, perc: 0.2, lead: 0.15, harm: 0.12, tex: 0, fx: 0.3 },
            drumLp: 17000,
            drive: 1.05,
            pressDrive: 0.1,
            duck: { bass: 0.4, harm: 0.6 },
            duckTime: { bass: 0.15, harm: 0.2 },
            master: { lp: 17000 },
          },
        },
      },
      // French filter house: one detuned saw chord loop chopped on the 16ths (a sampled disco loop) through a 24 dB
      // lowpass that opens over 16 bars and closes over 16, into the harmony bus under the hardest pump of the pack,
      // a chorus on it; a disco horn section on the loop's strong hits in the drop; a funky saw bass with octave pops,
      // fifths and slides from the intro on; loud disco open hats; a talkbox "ooh-ah" over the drop; a plate on the
      // claps; IV-V-iii-vi or vi-IV-V-iii, one chord a bar.
      {
        id: "pop-house-filter",
        name: "Filter Disco",
        base: "classic",
        bpm: [124, 126],
        swing: 0.51,
        microScale: 0.1,
        trim: 0.76,
        riser: 0,
        data: {
          chords: [
            { bass: 8, pad: [3, 8, 12, 15], guide: 12, dark: [0, 3, 8] }, // IV (C F A C in C major)
            { bass: 10, pad: [2, 5, 10, 14], guide: 2, dark: [2, 5, 10] }, // V (B D G B)
            { bass: 7, pad: [2, 7, 10, 14], guide: 7, dark: [2, 7, 10] }, // iii (B E G B)
            { bass: 0, pad: [3, 7, 12, 15], guide: 3, dark: [0, 3, 7] }, // vi (C E A C)
          ],
          progressions: [[0, 1, 2, 3], [3, 0, 1, 2]],
          kicks: { lo: [[0, 4, 8, 12]], mid: [[0, 4, 8, 12]], hi: [[0, 4, 8, 12]] },
          skips: [[[7, 0.2], [15, 0.25], [23, 0.2], [31, 0.3]]],
          stabs: [
            [
              { s: 0, len: 0.75, vel: 0.95, core: true }, { s: 2, len: 0.75, vel: 0.7, core: true }, { s: 3, len: 0.75, vel: 0.6, core: false },
              { s: 6, len: 1.5, vel: 0.92, core: true }, { s: 10, len: 0.75, vel: 0.75, core: true }, { s: 11, len: 0.75, vel: 0.55, core: false },
              { s: 14, len: 1.5, vel: 0.8, core: true }, { s: 16, len: 0.75, vel: 0.95, core: true }, { s: 18, len: 0.75, vel: 0.7, core: true },
              { s: 22, len: 1.5, vel: 0.92, core: true }, { s: 26, len: 0.75, vel: 0.75, core: true }, { s: 28, len: 2, vel: 0.85, core: true },
            ],
            [
              { s: 0, len: 1.5, vel: 0.95, core: true }, { s: 3, len: 0.75, vel: 0.65, core: true }, { s: 4, len: 0.75, vel: 0.55, core: false },
              { s: 6, len: 0.75, vel: 0.8, core: true }, { s: 8, len: 1.5, vel: 0.92, core: true }, { s: 11, len: 0.75, vel: 0.7, core: true },
              { s: 14, len: 0.75, vel: 0.75, core: true }, { s: 16, len: 1.5, vel: 0.95, core: true }, { s: 19, len: 0.75, vel: 0.65, core: true },
              { s: 22, len: 0.75, vel: 0.8, core: true }, { s: 24, len: 1.5, vel: 0.92, core: true }, { s: 27, len: 2.5, vel: 0.85, core: true },
            ],
          ],
          basslines: [
            [
              { s: 0, len: 1.5, semi: 0, vel: 1, core: true }, { s: 3, len: 0.75, semi: 12, vel: 0.75, core: true },
              { s: 6, len: 1, semi: 0, vel: 0.85, core: true }, { s: 9, len: 1, semi: 7, vel: 0.8, core: true },
              { s: 11, len: 0.75, semi: 12, vel: 0.75, core: true, glide: true }, { s: 14, len: 1, semi: 0, vel: 0.8, core: true },
              { s: 16, len: 1.5, semi: 0, vel: 1, core: true }, { s: 19, len: 0.75, semi: 12, vel: 0.75, core: true },
              { s: 22, len: 1, semi: 7, vel: 0.85, core: true, glide: true }, { s: 25, len: 1, semi: 0, vel: 0.8, core: true },
              { s: 27, len: 0.75, semi: 12, vel: 0.75, core: true }, { s: 30, len: 1, semi: 7, vel: 0.7, core: false, glide: true },
            ],
            [
              { s: 0, len: 1, semi: 0, vel: 1, core: true }, { s: 2, len: 0.75, semi: 0, vel: 0.7, core: true },
              { s: 4, len: 1, semi: 12, vel: 0.85, core: true }, { s: 7, len: 1, semi: 0, vel: 0.8, core: true },
              { s: 10, len: 1, semi: 7, vel: 0.85, core: true }, { s: 12, len: 1, semi: 12, vel: 0.8, core: true, glide: true },
              { s: 14, len: 1, semi: 7, vel: 0.75, core: true }, { s: 16, len: 1, semi: 0, vel: 1, core: true },
              { s: 18, len: 0.75, semi: 0, vel: 0.7, core: true }, { s: 20, len: 1, semi: 12, vel: 0.85, core: true },
              { s: 23, len: 1, semi: 0, vel: 0.8, core: true }, { s: 26, len: 1, semi: 7, vel: 0.85, core: true },
              { s: 28, len: 1, semi: 12, vel: 0.8, core: true, glide: true }, { s: 30, len: 1, semi: 7, vel: 0.7, core: false },
            ],
          ],
          calls: [
            [
              { s: 4, len: 2, vowel: 3, to: 1, tone: 3, core: false }, { s: 8, len: 1, vowel: 1, tone: 2, core: false },
              { s: 12, len: 3, vowel: 1, to: 3, tone: 3, core: true },
            ],
            [{ s: 10, len: 2, vowel: 1, to: 3, tone: 2, core: true }, { s: 26, len: 4, vowel: 3, to: 1, tone: 3, core: true }],
          ],
          // v3: the rhythm guitar's chicken scratch (muted 16ths, the off-8ths accented) and its two-bar answer.
          strums: [
            [
              { s: 0, len: 0.5, vel: 0.5, core: false }, { s: 2, len: 0.75, vel: 0.95, core: true }, { s: 3, len: 0.5, vel: 0.5, up: true, core: true },
              { s: 6, len: 0.75, vel: 0.95, core: true }, { s: 7, len: 0.5, vel: 0.45, up: true, core: false }, { s: 10, len: 0.75, vel: 0.95, core: true },
              { s: 11, len: 0.5, vel: 0.5, up: true, core: true }, { s: 14, len: 0.75, vel: 0.95, core: true }, { s: 18, len: 0.75, vel: 0.95, core: true },
              { s: 19, len: 0.5, vel: 0.5, up: true, core: true }, { s: 22, len: 0.75, vel: 0.95, core: true }, { s: 25, len: 0.5, vel: 0.55, up: true, core: false },
              { s: 26, len: 0.75, vel: 0.95, core: true }, { s: 29, len: 0.5, vel: 0.5, up: true, core: true }, { s: 30, len: 1, vel: 0.9, core: true },
            ],
          ],
          ukg: {
            keys: [4, 2],
            bars: 1,
            turn: 0,
            vary: 1,
            pump: 1,
            midEarly: 1,
            sweep: { bars: 16, depth: 0.9 },
            stab: { level: 1.05, voices: 3, detune: 12, osc2: 0, cutoff: 1500, q: 2.2, slope: 24, env: 0.15, fdecay: 0.2, attack: 0.004, decay: 0.2, sustain: 0.55, release: 0.08, drive: 1.4, vel: 0.4, width: 0.7, octave: -12 },
            // v3 layers: a string bed phasing through the ensemble (its filter over 32 bars) under the filtered loop; a
            // muted funk guitar from the build; the brass section stack (trumpets, trombones, breath, a fall) on the
            // loop's accents in the drop; the layered saw bass (growl + pick edge).
            bed: { kind: "strings", level: 0.75, in: ["build", "full", "breakdown", "rebuild"], cutoff: 2600, lfoBars: 32, lfoDepth: 0.6, attack: 0.3, release: 0.8, octave: 0, width: 0.8, ensemble: 0.85 },
            gtr: { level: 0.9, in: ["build", "full", "rebuild"], mute: 0.75, bright: 0.7, pan: 0.5, octave: 12 },
            horns: { level: 1, in: ["full", "rebuild"], min: 0.9, cutoff: 2800, env: 1.2, attack: 0.02, decay: 0.18, sustain: 0.5, release: 0.14, scoop: 1.5, breath: 0.6, bones: 0.8, fall: 0.3, drive: 0.9, width: 0.55 },
            sub: { level: 0.9, attack: 0.004, decay: 0.3, sustain: 0.5, release: 0.05, drive: 0.5, glide: 0.06 },
            mid: { kind: "saw", level: 1.05, cutoff: 650, env: 0.6, q: 3, decay: 0.12, sustain: 0.3, release: 0.05, drive: 2, detune: 6, hp: 85, bend: 0 },
            bass2: { kind: "saw", level: 1, cutoff: 750, env: 0.6, decay: 0.12, sustain: 0.35, release: 0.05, drive: 2, top: 0.4, hp: 90 },
            pluck: { level: 0 },
            lead: { level: 0 },
            vox: { level: 0.55, q: 10, breath: 0.08, bend: -1, scoop: 0.04, release: 0.12, lp: 3600 },
            chorus: { harm: 0.35 },
            plate: { level: 0.35, decay: 1.1, lp: 9000, hp: 450, pre: 0.006, harm: 0, lead: 0.25, snare: 0.5, fx: 0 },
            groove: { hatLate: 0.03, percLate: 0.04, jitter: 0.3, ghost: 0.3, perc: 0, open: 0.4, offOpen: 1, tamb: 0, ghostKick: 0, metal: 0 },
            drums: { kick: 1, knock: 0.9, click: 0.4, kickDecay: 0.36, clap: 0.8, body: 0.6, wires: 0.4, tail: 0.16, shaker: 0.8, ride: 0, crash: 0.7, conga: 0.35, toms: 0.6 },
            bus: { tape: 1.6, mix: 0.5, exciter: 0.25, width: 0.3, drums: 2 },
          },
          kit: {
            kick: { start: 130, end: 48, sweep: 0.05, decay: 0.28, click: 0.1, clickHp: 3000, drive: 1.2, body: 1.15 },
            snare: [
              { noise: "bandpass", freq: 1300, q: 1, decay: 0.12, level: 0.35 },
              { clap: 0.7 },
              { clap: 0.45, at: 0.011, flip: true },
            ],
            ghost: [{ noise: "bandpass", freq: 3000, q: 0.9, decay: 0.03, level: 0.22 }],
            hat: { hp: 9000, decay: 0.022, metal: 0.25, level: 0.16 },
            shaker: { freq: 7600, q: 1.2, decay: 0.03, attack: 0.006, level: 0.04, off: 0.03 },
            open: { hp: 7000, decay: 0.18, metal: 0.3, level: 0.27 },
          },
          vinyl: 0,
          mix: { kick: 1.5, harm: 2 },
          fx: {
            echo: { steps: 3, taps: 3, fb: 0.4, lp: 3500, hp: 500 },
            echoSend: { kick: 0, bass: 0, snare: 0.05, perc: 0.1, lead: 0.3, harm: 0.04, fx: 0.5 },
            space: { size: 1, fb: 0.55, lp: 5500 },
            spaceSend: { kick: 0, bass: 0, snare: 0.12, hat: 0.03, perc: 0.15, lead: 0.2, harm: 0.08, tex: 0, fx: 0.3 },
            drumLp: 16000,
            drive: 1.3,
            pressDrive: 0.15,
            duck: { bass: 0.32, harm: 0.3 },
            duckTime: { bass: 0.18, harm: 0.3 },
            master: { lp: 15000 },
          },
        },
      },
      // Deep vocal house: M1 organ chord stabs on a syncopated figure, vocal chops (the vocal synth stuttering on
      // the calls, the hook as a chop in the drop), a rubbery filtered saw bass, a Juno-style pad held under a chorus,
      // ghost kicks and swung hats; minor: i9-VI-III-VII, two bars a chord.
      {
        id: "pop-house-chops",
        name: "Velvet Chops",
        base: "classic",
        bpm: [121, 123],
        swing: 0.56,
        microScale: 0.3,
        trim: 0.95,
        riser: 0,
        data: {
          chords: [
            { bass: 0, pad: [3, 7, 10, 14], guide: 3, dark: [0, 3, 7] }, // i9 (Eb G Bb D in C minor)
            { bass: 8, pad: [-4, 0, 3, 7], guide: 0, dark: [0, 3, 8] }, // VImaj7 (Ab C Eb G)
            { bass: 3, pad: [-2, 3, 7, 10], guide: 7, dark: [3, 7, 10] }, // III6 (Bb Eb G Bb)
            { bass: 10, pad: [-2, 2, 5, 10], guide: 2, dark: [2, 5, 10] }, // VII (Bb D F Bb)
            { bass: 5, pad: [0, 3, 8, 12], guide: 3, dark: [5, 8, 12] }, // iv7 (C Eb Ab C over F)
          ],
          progressions: [[0, 1, 2, 3], [0, 4, 1, 3], [1, 2, 3, 0]],
          kicks: { lo: [[0, 4, 8, 12]], mid: [[0, 4, 8, 12]], hi: [[0, 4, 8, 12], [0, 4, 8, 11, 12]] },
          skips: [[[3, 0.3], [7, 0.25], [14, 0.3], [19, 0.3], [23, 0.25], [27, 0.3], [31, 0.35]]],
          stabs: [
            [
              { s: 2, len: 1, vel: 0.95, core: true }, { s: 7, len: 1.5, vel: 0.75, core: true }, { s: 10, len: 1, vel: 0.88, core: true },
              { s: 14, len: 1, vel: 0.6, core: false }, { s: 18, len: 1, vel: 0.95, core: true }, { s: 23, len: 2, vel: 0.8, core: true },
              { s: 27, len: 1, vel: 0.66, core: false }, { s: 30, len: 1.5, vel: 0.85, core: true },
            ],
            [
              { s: 3, len: 1.5, vel: 1, core: true }, { s: 6, len: 1, vel: 0.7, core: true }, { s: 11, len: 2, vel: 0.9, core: true },
              { s: 19, len: 1.5, vel: 0.95, core: true }, { s: 22, len: 1, vel: 0.68, core: true }, { s: 25, len: 1, vel: 0.6, core: false },
              { s: 29, len: 2, vel: 0.85, core: true },
            ],
          ],
          basslines: [
            [
              { s: 0, len: 2, semi: 0, vel: 1, core: true }, { s: 3, len: 1, semi: 12, vel: 0.75, core: true },
              { s: 6, len: 1.5, semi: 0, vel: 0.85, core: true, glide: true }, { s: 10, len: 1, semi: 7, vel: 0.8, core: true },
              { s: 12, len: 2, semi: 12, vel: 0.75, core: true, glide: true }, { s: 16, len: 2, semi: 0, vel: 0.95, core: true },
              { s: 19, len: 1, semi: 12, vel: 0.7, core: true }, { s: 22, len: 2, semi: 7, vel: 0.8, core: true, glide: true },
              { s: 26, len: 1, semi: 0, vel: 0.8, core: true }, { s: 28, len: 2, semi: 12, vel: 0.7, core: false },
            ],
            [
              { s: 0, len: 1.5, semi: 0, vel: 1, core: true }, { s: 3, len: 1, semi: 0, vel: 0.75, core: true },
              { s: 6, len: 1, semi: 12, vel: 0.85, core: true }, { s: 7, len: 2, semi: 7, vel: 0.75, core: true, glide: true },
              { s: 11, len: 1.5, semi: 7, vel: 0.8, core: true }, { s: 14, len: 1.5, semi: 0, vel: 0.75, core: true },
              { s: 16, len: 1.5, semi: 0, vel: 1, core: true }, { s: 19, len: 1, semi: 0, vel: 0.75, core: true },
              { s: 22, len: 1, semi: 12, vel: 0.85, core: true }, { s: 23, len: 2, semi: 7, vel: 0.75, core: true, glide: true },
              { s: 27, len: 1.5, semi: 12, vel: 0.8, core: true }, { s: 30, len: 1.5, semi: 7, vel: 0.7, core: false, glide: true },
            ],
          ],
          motifs: [
            [
              { s: 0, len: 1, tone: 2, core: true }, { s: 2, len: 1, tone: 3, core: true }, { s: 3, len: 1, tone: 3, core: true },
              { s: 6, len: 2, tone: 2, core: true }, { s: 10, len: 1, tone: 3, core: true }, { s: 11, len: 3, tone: 1, core: true },
              { s: 22, len: 1, tone: 2, core: true }, { s: 24, len: 3, tone: 3, core: true },
            ],
            [
              { s: 2, len: 1, tone: 3, core: true }, { s: 4, len: 1, tone: 2, core: true }, { s: 7, len: 2, tone: 3, core: true },
              { s: 10, len: 1, tone: 4, core: true }, { s: 18, len: 1, tone: 3, core: true }, { s: 20, len: 1, tone: 2, core: true },
              { s: 23, len: 3, tone: 1, core: true },
            ],
          ],
          calls: [
            [
              { s: 6, len: 1, vowel: 1, tone: 3, core: true }, { s: 14, len: 1, vowel: 3, tone: 2, rep: 1, core: true },
              { s: 22, len: 1, vowel: 1, tone: 3, core: false }, { s: 28, len: 3, vowel: 0, to: 1, tone: 3, rep: 2, core: true },
            ],
            [
              { s: 3, len: 1, vowel: 3, tone: 2, core: true }, { s: 11, len: 2, vowel: 1, to: 3, tone: 3, core: true },
              { s: 19, len: 1, vowel: 3, tone: 2, core: false }, { s: 26, len: 1, vowel: 0, tone: 3, rep: 3, core: true },
            ],
          ],
          vowels: [[300, 2300], [760, 1150], [560, 1800], [500, 850], [640, 1190]],
          // v3: a sparse blip line (the "Latch" beep) an octave up, thrown into the echo now and then.
          arps: [
            [
              { s: 3, len: 0.5, tone: 4, core: true }, { s: 7, len: 0.5, tone: 3, core: true }, { s: 10, len: 0.5, tone: 4, core: true }, { s: 14, len: 0.5, tone: 2, core: false },
              { s: 19, len: 0.5, tone: 4, core: true }, { s: 23, len: 0.5, tone: 3, core: true }, { s: 26, len: 0.5, tone: 5, core: true }, { s: 30, len: 0.5, tone: 2, core: false },
            ],
          ],
          ukg: {
            keys: [0, 5],
            bars: 2,
            turn: 1,
            vary: 1,
            stab: { level: 0 },
            m1: { level: 1.05, octave: 0, cutoff: 3600, drive: 1.6, click: 0.5, decay: 0.22, sustain: 0.25, release: 0.08 },
            // v3 layers: a Juno pad bed under everything (saw + pulse + sub, ensemble, its filter breathing over 16
            // bars); the formant vocal for the chops and the hook (glottal source, four formants, a consonant on
            // the attack); a blip line in the build and drop; the layered pluck bass.
            bed: { kind: "juno", level: 1.3, cutoff: 2600, lfoBars: 16, lfoDepth: 0.5, attack: 0.25, release: 0.6, octave: 0, width: 0.75, ensemble: 0.75 },
            arp: { kind: "saw", level: 0.6, in: ["build", "full"], alt: 0, octave: 12, pan: 0.6, cutoff: 3200, echo: 0.5 },
            sub: { level: 0.85, attack: 0.004, decay: 0.4, sustain: 0.6, release: 0.06, drive: 0.5, glide: 0.07 },
            mid: { kind: "saw", level: 0.95, cutoff: 420, env: 0.75, q: 4, decay: 0.16, sustain: 0.25, release: 0.06, drive: 2.2, detune: 8, hp: 90, bend: 0 },
            bass2: { kind: "pluck", level: 1, cutoff: 480, env: 0.7, decay: 0.14, sustain: 0.3, release: 0.06, drive: 2.2, top: 0.3, hp: 90 },
            drop2: { kind: "reese", level: 0.85, cutoff: 700, env: 0.4, q: 1.5, decay: 0.3, sustain: 0.5, release: 0.08, drive: 2.2, detune: 14, hp: 90, bend: 0 },
            pluck: { level: 0 },
            lead: { level: 0.75, kind: "vox" },
            vox: { level: 0.6, q: 8, breath: 0.15, bend: -2, scoop: 0.05, release: 0.1, lp: 4800 },
            voc: { level: 1.25, scoop: -2, scoopSec: 0.05, vibrato: 12, breath: 0.2, consonant: 0.5, release: 0.06 },
            strings: { level: 0 },
            chorus: { lead: 0.3, harm: 0.35 },
            hall: { level: 0.3, decay: 2.2, lp: 6000, hp: 350, pre: 0.025, harm: 0.25, lead: 0.35, snare: 0.15, fx: 0.4 },
            groove: { hatLate: 0.1, percLate: 0.08, jitter: 0.5, ghost: 0.7, perc: 0.3, open: 0.7, offOpen: 0.6, tamb: 0, ghostKick: 0.8, metal: 0 },
            drums: { kick: 0.75, knock: 0.75, click: 0.7, kickDecay: 0.38, clap: 0.7, body: 0.6, wires: 0.7, tail: 0.15, shaker: 1.5, ride: 0, crash: 0.6, conga: 0.8, toms: 0 },
            bus: { tape: 1.2, mix: 0.4, exciter: 1, width: 0.7, drums: 1.4 },
          },
          kit: {
            kick: { start: 125, end: 46, sweep: 0.05, decay: 0.32, click: 0.08, clickHp: 3000, drive: 0.6, body: 1.15 },
            snare: [
              { noise: "bandpass", freq: 1800, q: 1, decay: 0.1, level: 0.3 },
              { clap: 0.6 },
            ],
            ghost: [{ noise: "bandpass", freq: 3400, q: 1, decay: 0.03, level: 0.25 }],
            hat: { hp: 9000, decay: 0.02, metal: 0.15, level: 0.17 },
            shaker: { freq: 7400, q: 1.2, decay: 0.035, attack: 0.006, level: 0.06, off: 0.05 },
            open: { hp: 7500, decay: 0.14, metal: 0.25, level: 0.24 },
          },
          vinyl: 0,
          mix: { kick: 1, harm: 0.5 },
          fx: {
            echo: { steps: 3, taps: 4, fb: 0.4, lp: 4200, hp: 600 },
            echoSend: { kick: 0, bass: 0, snare: 0.05, perc: 0.15, lead: 0.32, harm: 0.08, fx: 0.5 },
            space: { size: 1.3, fb: 0.6, lp: 6500 },
            spaceSend: { kick: 0, bass: 0, snare: 0.15, hat: 0.04, perc: 0.2, lead: 0.15, harm: 0.15, tex: 0, fx: 0.3 },
            drumLp: 16000,
            drive: 1.1,
            pressDrive: 0.1,
            duck: { bass: 0.45, harm: 0.55 },
            duckTime: { bass: 0.15, harm: 0.22 },
            master: { lp: 16500 },
          },
        },
      },
      // Pop-dance house: wide supersaw chord stabs (four saws a tone, chorused) pumping under the kick on a syncopated
      // figure; a pluck bass bouncing octaves on the off-8ths; a wide saw pluck plays the hook in the build, a supersaw
      // lead with vibrato in the drop; a metallic FM bass for the drop's second half and the rebuild; the build rises
      // (a filtered saw riser, a snare build); a "y-y-yeah" closing two bars; IV-V-vi-vi / vi-IV-I-V, two bars a chord.
      {
        id: "pop-house-future",
        name: "Future Bounce",
        base: "classic",
        bpm: [126, 128],
        swing: 0.5,
        microScale: 0.05,
        trim: 0.9,
        riser: 0,
        data: {
          chords: [
            { bass: 0, pad: [3, 7, 12, 15], guide: 3, dark: [0, 3, 7] }, // vi (C E A C in C major)
            { bass: 8, pad: [3, 8, 12, 15], guide: 12, dark: [0, 3, 8] }, // IV (C F A C)
            { bass: 10, pad: [2, 5, 10, 14], guide: 2, dark: [2, 5, 10] }, // V (B D G B)
            { bass: 3, pad: [3, 7, 10, 15], guide: 7, dark: [3, 7, 10] }, // I (C E G C)
          ],
          progressions: [[1, 2, 0, 0], [0, 1, 3, 2], [1, 2, 0, 3]],
          kicks: { lo: [[0, 4, 8, 12]], mid: [[0, 4, 8, 12]], hi: [[0, 4, 8, 12], [0, 4, 8, 12, 14]] },
          skips: [[[15, 0.3], [31, 0.35]]],
          stabs: [
            [
              { s: 0, len: 0.75, vel: 0.85, core: true }, { s: 3, len: 0.75, vel: 0.75, core: true }, { s: 6, len: 0.75, vel: 0.9, core: true },
              { s: 10, len: 0.75, vel: 0.8, core: true }, { s: 12, len: 0.5, vel: 0.6, core: false }, { s: 14, len: 0.75, vel: 0.75, core: true },
              { s: 19, len: 0.75, vel: 0.8, core: true }, { s: 22, len: 0.75, vel: 0.9, core: true }, { s: 26, len: 0.75, vel: 0.8, core: true },
              { s: 28, len: 0.5, vel: 0.65, core: false },
            ],
            [
              { s: 2, len: 1.5, vel: 0.9, core: true }, { s: 6, len: 1.5, vel: 0.85, core: true }, { s: 10, len: 1.5, vel: 0.9, core: true },
              { s: 14, len: 1.5, vel: 0.8, core: true }, { s: 18, len: 1.5, vel: 0.9, core: true }, { s: 22, len: 1.5, vel: 0.85, core: true },
              { s: 26, len: 1.5, vel: 0.9, core: true }, { s: 29, len: 1, vel: 0.7, core: false },
            ],
          ],
          basslines: [
            [
              { s: 0, len: 1, semi: 0, vel: 0.9, core: true }, { s: 2, len: 1.5, semi: 12, vel: 0.95, core: true },
              { s: 6, len: 1.5, semi: 12, vel: 0.9, core: true }, { s: 10, len: 1.5, semi: 12, vel: 0.9, core: true },
              { s: 13, len: 1, semi: 7, vel: 0.75, core: false }, { s: 14, len: 1.5, semi: 12, vel: 0.9, core: true },
              { s: 16, len: 1, semi: 0, vel: 0.9, core: true }, { s: 18, len: 1.5, semi: 12, vel: 0.95, core: true },
              { s: 22, len: 1.5, semi: 12, vel: 0.9, core: true }, { s: 26, len: 1.5, semi: 12, vel: 0.9, core: true },
              { s: 29, len: 1, semi: 7, vel: 0.8, core: true }, { s: 30, len: 1.5, semi: 12, vel: 0.85, core: true, glide: true },
            ],
            [
              { s: 2, len: 1.5, semi: 0, vel: 0.95, core: true }, { s: 6, len: 1.5, semi: 12, vel: 0.9, core: true },
              { s: 10, len: 1.5, semi: 0, vel: 0.9, core: true }, { s: 14, len: 1.5, semi: 12, vel: 0.85, core: true },
              { s: 18, len: 1.5, semi: 0, vel: 0.95, core: true }, { s: 22, len: 1.5, semi: 12, vel: 0.9, core: true },
              { s: 26, len: 1.5, semi: 7, vel: 0.9, core: true }, { s: 30, len: 1.5, semi: 12, vel: 0.85, core: true },
            ],
          ],
          motifs: [
            [
              { s: 0, len: 1, tone: 3, core: true }, { s: 2, len: 1, tone: 3, core: true }, { s: 3, len: 2, tone: 4, core: true },
              { s: 6, len: 2, tone: 3, core: true }, { s: 16, len: 1, tone: 3, core: true }, { s: 18, len: 1, tone: 3, core: true },
              { s: 19, len: 2, tone: 5, core: true }, { s: 22, len: 3, tone: 4, core: true },
            ],
            [
              { s: 2, len: 2, tone: 4, core: true }, { s: 6, len: 1, tone: 3, core: true }, { s: 8, len: 2, tone: 4, core: true },
              { s: 11, len: 3, tone: 5, core: true }, { s: 18, len: 2, tone: 4, core: true }, { s: 22, len: 1, tone: 3, core: true },
              { s: 24, len: 4, tone: 2, core: true },
            ],
          ],
          calls: [[{ s: 28, len: 2, vowel: 0, to: 1, tone: 2, rep: 2, core: true }]],
          // v3: a 16th supersaw ostinato on the chord tones (the build and the drop).
          arps: [
            [
              { s: 0, len: 0.75, tone: 0, core: true }, { s: 1, len: 0.75, tone: 2, core: true }, { s: 2, len: 0.75, tone: 1, core: true }, { s: 3, len: 0.75, tone: 3, core: true },
              { s: 4, len: 0.75, tone: 2, core: true }, { s: 5, len: 0.75, tone: 4, core: true }, { s: 6, len: 0.75, tone: 3, core: true }, { s: 7, len: 0.75, tone: 2, core: true },
              { s: 8, len: 0.75, tone: 0, core: true }, { s: 9, len: 0.75, tone: 2, core: true }, { s: 10, len: 0.75, tone: 1, core: true }, { s: 11, len: 0.75, tone: 3, core: true },
              { s: 12, len: 0.75, tone: 2, core: true }, { s: 13, len: 0.75, tone: 4, core: true }, { s: 14, len: 0.75, tone: 3, core: true }, { s: 15, len: 0.75, tone: 4, core: false },
              { s: 16, len: 0.75, tone: 0, core: true }, { s: 17, len: 0.75, tone: 2, core: true }, { s: 18, len: 0.75, tone: 1, core: true }, { s: 19, len: 0.75, tone: 3, core: true },
              { s: 20, len: 0.75, tone: 2, core: true }, { s: 21, len: 0.75, tone: 4, core: true }, { s: 22, len: 0.75, tone: 3, core: true }, { s: 23, len: 0.75, tone: 2, core: true },
              { s: 24, len: 0.75, tone: 1, core: true }, { s: 25, len: 0.75, tone: 3, core: true }, { s: 26, len: 0.75, tone: 2, core: true }, { s: 27, len: 0.75, tone: 4, core: true },
              { s: 28, len: 0.75, tone: 3, core: true }, { s: 29, len: 0.75, tone: 5, core: true }, { s: 30, len: 0.75, tone: 4, core: true }, { s: 31, len: 0.75, tone: 3, core: false },
            ],
          ],
          ukg: {
            keys: [6, 8],
            bars: 2,
            turn: 0,
            vary: 1,
            pump: 1,
            stab: { level: 0 },
            // v3 layers: the JP-8000 supersaw (7 saws, free phases, a sine sub, pumping) on the chord stabs; a Juno
            // pad bed under the build, the breakdown and the rebuild; a 16th supersaw ostinato in the build and the
            // drop, every other cycle; the layered pluck bass bouncing octaves (the FM second drop stays).
            saws: { level: 1.45, voices: 7, detune: 26, mix: 0.5, cutoff: 5500, env: 0.5, fdecay: 0.12, q: 0.9, attack: 0.002, decay: 0.22, sustain: 0.2, release: 0.12, width: 0.85, sub: 0.3, drive: 0.6, octave: 0, follow: 1 },
            bed: { kind: "juno", level: 1, in: ["build", "breakdown", "rebuild"], cutoff: 3000, lfoBars: 8, lfoDepth: 0.45, attack: 0.5, release: 0.8, octave: 0, width: 0.8, ensemble: 0.55 },
            arp: { kind: "saw", level: 0.75, in: ["build", "full"], alt: 2, octave: 12, pan: 0.45, cutoff: 4500, echo: 0.2 },
            sub: { level: 0.85, attack: 0.003, decay: 0.25, sustain: 0.5, release: 0.05, drive: 0.6, glide: 0.05 },
            mid: { kind: "saw", level: 1.1, cutoff: 650, env: 0.85, q: 3, decay: 0.11, sustain: 0.15, release: 0.05, drive: 2.4, detune: 10, hp: 100, bend: 0 },
            bass2: { kind: "pluck", level: 1.05, cutoff: 700, env: 0.85, decay: 0.1, sustain: 0.15, release: 0.05, drive: 2.4, top: 0.5, hp: 100 },
            drop2: { kind: "fm", level: 1, cutoff: 1400, env: 0.5, q: 1.2, decay: 0.12, sustain: 0.2, release: 0.05, drive: 1.5, ratio: 2, index: 4, fmDecay: 0.08, floor: 0.15, hp: 110, bend: 0 },
            pluck: { level: 0.7, wave: "sawtooth", cutoff: 2600, env: 0.6, decay: 0.16, release: 0.12, bend: 0, pan: 0.3, voices: 4, detune: 18, width: 0.6 },
            lead: { level: 1, kind: "saw", glide: 0.03, detune: 14, cutoff: 4200, release: 0.15, vib: 14 },
            vox: { level: 0.45, q: 9, breath: 0.15, bend: -2, scoop: 0.05, release: 0.1, lp: 4500 },
            voc: { level: 1, scoop: -1, scoopSec: 0.04, vibrato: 10, breath: 0.15, consonant: 0.6, release: 0.06 },
            lift: { level: 1.2, bars: 4, from: 250, to: 7000, detune: 22, roll: 1 },
            chorus: { lead: 0.4, harm: 0.25 },
            hall: { level: 0.3, decay: 2, lp: 7500, hp: 350, pre: 0.02, harm: 0.2, lead: 0.35, snare: 0.12, fx: 0.4 },
            groove: { hatLate: 0, percLate: 0.02, jitter: 0.2, ghost: 0.25, perc: 0, open: 0.6, offOpen: 0.9, tamb: 0, ghostKick: 0, metal: 0 },
            drums: { kick: 0.8, knock: 1, click: 0.9, kickDecay: 0.32, clap: 1, body: 0.9, wires: 0.7, tail: 0.22, shaker: 0.7, ride: 0.7, crash: 1, conga: 0, toms: 0 },
            bus: { tape: 1.4, mix: 0.5, exciter: 0.8, width: 0.5, drums: 2.2 },
          },
          kit: {
            kick: { start: 170, end: 50, sweep: 0.03, decay: 0.26, click: 0.25, clickHp: 4000, drive: 1, body: 1.2 },
            snare: [
              { noise: "bandpass", freq: 2000, q: 0.9, decay: 0.12, level: 0.3 },
              { clap: 0.7 },
            ],
            ghost: [{ noise: "bandpass", freq: 3500, q: 0.9, decay: 0.03, level: 0.22 }],
            hat: { hp: 10000, decay: 0.018, metal: 0.2, level: 0.14 },
            shaker: { freq: 8000, q: 1.2, decay: 0.025, attack: 0.004, level: 0.04, off: 0.03 },
            open: { hp: 8000, decay: 0.12, metal: 0.3, level: 0.28 },
          },
          vinyl: 0,
          mix: { kick: 1.5, snare: 0.5, harm: 3, lead: 1 },
          fx: {
            echo: { steps: 3, taps: 3, fb: 0.32, lp: 5000, hp: 600 },
            echoSend: { kick: 0, bass: 0, snare: 0.04, perc: 0.1, lead: 0.25, harm: 0.05, fx: 0.5 },
            space: { size: 1.3, fb: 0.6, lp: 8000 },
            spaceSend: { kick: 0, bass: 0, snare: 0.12, hat: 0.03, perc: 0.15, lead: 0.12, harm: 0.1, tex: 0, fx: 0.3 },
            drumLp: 18000,
            drive: 1.15,
            pressDrive: 0.12,
            duck: { bass: 0.4, harm: 0.3 },
            duckTime: { bass: 0.13, harm: 0.22 },
            master: { lp: 17000 },
          },
        },
      },
      // Nu-disco / funky house: a string section on the stabs (wide detuned saws, a soft attack, a chorus) and a
      // Rhodes (FM, its tine, the suitcase tremolo) comping on ii7-V7-I6-vi9, one chord a bar; a slap bass (a bright FM
      // thumb) with octave pops, walk-ups and slides from the intro on; a funk-guitar pluck answering; a flammed clap,
      // a tambourine, congas, a live shuffle; strings swell in the breakdown; a big hall.
      {
        id: "pop-house-disco",
        name: "Disco Strings",
        base: "classic",
        bpm: [120, 122],
        swing: 0.55,
        microScale: 0.35,
        trim: 0.83,
        riser: 0,
        data: {
          chords: [
            { bass: 5, pad: [5, 8, 12, 15], guide: 8, dark: [5, 8, 12] }, // ii7 (F Ab C Eb in Eb major)
            { bass: 10, pad: [5, 8, 10, 14], guide: 8, dark: [2, 5, 10] }, // V7 (F Ab Bb D)
            { bass: 3, pad: [3, 7, 10, 12], guide: 7, dark: [3, 7, 10] }, // I6 (Eb G Bb C)
            { bass: 0, pad: [3, 7, 10, 14], guide: 3, dark: [0, 3, 7] }, // vi9 (Eb G Bb D over C)
            { bass: 8, pad: [3, 7, 8, 12], guide: 7, dark: [0, 3, 8] }, // IVmaj7 (Eb G Ab C over Ab)
          ],
          progressions: [[0, 1, 2, 3], [4, 1, 2, 3], [0, 1, 3, 4]],
          kicks: { lo: [[0, 4, 8, 12]], mid: [[0, 4, 8, 12]], hi: [[0, 4, 8, 12]] },
          skips: [[[7, 0.3], [11, 0.2], [23, 0.3], [27, 0.2], [31, 0.35]]],
          stabs: [
            [
              { s: 3, len: 1, vel: 0.75, core: true }, { s: 6, len: 2, vel: 0.95, core: true }, { s: 10, len: 1, vel: 0.7, core: true },
              { s: 14, len: 2, vel: 0.8, core: false }, { s: 19, len: 1, vel: 0.75, core: true }, { s: 22, len: 2, vel: 0.95, core: true },
              { s: 26, len: 3, vel: 0.85, core: true }, { s: 30, len: 1, vel: 0.6, core: false },
            ],
            [
              { s: 0, len: 3, vel: 0.9, core: true }, { s: 6, len: 1, vel: 0.75, core: true }, { s: 8, len: 2, vel: 0.85, core: true },
              { s: 14, len: 1, vel: 0.7, core: true }, { s: 16, len: 3, vel: 0.9, core: true }, { s: 22, len: 1, vel: 0.75, core: true },
              { s: 24, len: 2, vel: 0.85, core: true }, { s: 28, len: 3, vel: 0.8, core: false },
            ],
          ],
          basslines: [
            [
              { s: 0, len: 1.5, semi: 0, vel: 1, core: true }, { s: 3, len: 0.5, semi: 12, vel: 0.7, core: true },
              { s: 6, len: 1, semi: 12, vel: 0.85, core: true }, { s: 7, len: 0.5, semi: 7, vel: 0.65, core: false },
              { s: 9, len: 1, semi: 0, vel: 0.85, core: true }, { s: 11, len: 0.5, semi: 12, vel: 0.7, core: true },
              { s: 13, len: 0.75, semi: 14, vel: 0.75, core: true }, { s: 14, len: 1, semi: 12, vel: 0.8, core: true, glide: true },
              { s: 16, len: 1.5, semi: 0, vel: 1, core: true }, { s: 19, len: 0.5, semi: 12, vel: 0.7, core: true },
              { s: 22, len: 1, semi: 12, vel: 0.85, core: true }, { s: 23, len: 0.5, semi: 14, vel: 0.65, core: false, glide: true },
              { s: 25, len: 1, semi: 7, vel: 0.85, core: true }, { s: 27, len: 0.5, semi: 12, vel: 0.7, core: true },
              { s: 29, len: 0.75, semi: 2, vel: 0.75, core: true }, { s: 30, len: 1, semi: 7, vel: 0.8, core: true, glide: true },
            ],
            [
              { s: 0, len: 1, semi: 0, vel: 1, core: true }, { s: 2, len: 0.5, semi: 12, vel: 0.75, core: true },
              { s: 4, len: 1, semi: 0, vel: 0.8, core: true }, { s: 6, len: 0.5, semi: 12, vel: 0.8, core: true },
              { s: 8, len: 1, semi: 7, vel: 0.85, core: true }, { s: 10, len: 0.5, semi: 12, vel: 0.75, core: true },
              { s: 12, len: 1, semi: 0, vel: 0.8, core: true }, { s: 14, len: 1, semi: 12, vel: 0.8, core: true, glide: true },
              { s: 16, len: 1, semi: 0, vel: 1, core: true }, { s: 18, len: 0.5, semi: 12, vel: 0.75, core: true },
              { s: 20, len: 1, semi: 0, vel: 0.8, core: true }, { s: 22, len: 0.5, semi: 12, vel: 0.8, core: true },
              { s: 24, len: 1, semi: 7, vel: 0.85, core: true }, { s: 26, len: 0.5, semi: 12, vel: 0.75, core: true },
              { s: 28, len: 1, semi: 2, vel: 0.8, core: true }, { s: 30, len: 1, semi: 7, vel: 0.8, core: true, glide: true },
            ],
          ],
          motifs: [
            [
              { s: 12, len: 0.75, tone: 3, core: true }, { s: 13, len: 0.75, tone: 4, core: true }, { s: 14, len: 1.5, tone: 5, core: true },
              { s: 28, len: 0.75, tone: 4, core: true }, { s: 30, len: 1.5, tone: 3, core: true },
            ],
            [
              { s: 2, len: 0.5, tone: 3, core: true }, { s: 5, len: 0.5, tone: 3, core: true }, { s: 7, len: 0.75, tone: 4, core: true },
              { s: 10, len: 0.5, tone: 3, core: true }, { s: 18, len: 0.5, tone: 3, core: true }, { s: 21, len: 0.5, tone: 3, core: true },
              { s: 23, len: 0.75, tone: 5, core: true }, { s: 26, len: 1, tone: 4, core: true },
            ],
          ],
          // v3: the Nile Rodgers comp, two bars of 16th strums (down on the beat, up between, the "and" of 2 and 4 hit).
          strums: [
            [
              { s: 0, len: 0.5, vel: 0.85, core: true }, { s: 1, len: 0.5, vel: 0.45, up: true, core: false }, { s: 2, len: 0.5, vel: 0.65, core: true },
              { s: 3, len: 0.5, vel: 0.8, up: true, core: true }, { s: 6, len: 1, vel: 0.95, core: true }, { s: 7, len: 0.5, vel: 0.45, up: true, core: false },
              { s: 9, len: 0.5, vel: 0.6, up: true, core: true }, { s: 10, len: 0.5, vel: 0.9, core: true }, { s: 11, len: 0.5, vel: 0.5, up: true, core: true },
              { s: 14, len: 1, vel: 0.95, core: true }, { s: 15, len: 0.5, vel: 0.5, up: true, core: false }, { s: 16, len: 0.5, vel: 0.85, core: true },
              { s: 18, len: 0.5, vel: 0.65, core: true }, { s: 19, len: 0.5, vel: 0.8, up: true, core: true }, { s: 22, len: 1, vel: 0.95, core: true },
              { s: 25, len: 0.5, vel: 0.6, up: true, core: true }, { s: 26, len: 0.5, vel: 0.9, core: true }, { s: 27, len: 0.5, vel: 0.5, up: true, core: true },
              { s: 29, len: 0.5, vel: 0.55, up: true, core: false }, { s: 30, len: 1, vel: 0.95, core: true },
            ],
          ],
          ukg: {
            keys: [0, 10],
            bars: 1,
            turn: 0,
            vary: 1,
            pump: 1,
            midEarly: 1,
            stab: { level: 0.7, voices: 4, detune: 18, osc2: 0, cutoff: 3000, q: 0.8, slope: 12, env: 0.25, fdecay: 0.2, attack: 0.014, decay: 0.35, sustain: 0.45, release: 0.25, drive: 0.5, vel: 0.5, width: 0.9 },
            ep: { level: 0.75, octave: 0, ratio: 1, index: 1.8, floor: 0.2, decay: 0.6, chorus: 8, cutoff: 3800, release: 0.3, tine: 0.5, trem: 4.5, tremDepth: 0.5 },
            // v3 layers: a string section bed through the ensemble on every chord (the disco strings, swelling in
            // the breakdown); the Karplus-Strong rhythm guitar comping from the build; a horn section with falls on
            // the drop's accents, every other cycle; the layered FM slap bass with its thumb and pops.
            bed: { kind: "strings", level: 0.85, cutoff: 3600, lfoBars: 32, lfoDepth: 0.3, attack: 0.35, release: 1, octave: 0, width: 0.85, ensemble: 0.9 },
            gtr: { level: 1, in: ["build", "full", "rebuild"], mute: 0.65, bright: 0.7, pan: -0.5, octave: 12 },
            horns: { level: 0.9, in: ["full", "rebuild"], alt: 1, min: 0.85, cutoff: 3000, env: 1, attack: 0.03, decay: 0.25, sustain: 0.55, release: 0.25, scoop: 1.2, breath: 0.5, bones: 0.7, fall: 0.6, drive: 0.8, width: 0.6 },
            sub: { level: 0.85, attack: 0.004, decay: 0.3, sustain: 0.6, release: 0.06, drive: 0.4, glide: 0.05 },
            mid: { kind: "fm", level: 1.15, cutoff: 1300, env: 0.6, q: 1.2, decay: 0.2, sustain: 0.4, release: 0.05, drive: 1.4, ratio: 1, index: 3.5, fmDecay: 0.04, floor: 0.2, hp: 70, bend: 0 },
            bass2: { kind: "slap", level: 1.1, cutoff: 2200, env: 0.5, decay: 0.12, sustain: 0.4, release: 0.05, drive: 1.4, top: 0.6, hp: 70 },
            pluck: { level: 0 },
            lead: { level: 0 },
            strings: { level: 0 },
            chorus: { lead: 0.3, harm: 0.4 },
            hall: { level: 0.35, decay: 2.2, lp: 6500, hp: 350, pre: 0.025, harm: 0.3, lead: 0.3, snare: 0.2, fx: 0.4 },
            groove: { hatLate: 0.06, percLate: 0.08, jitter: 0.5, ghost: 0.5, perc: 0, open: 0.8, offOpen: 0.9, tamb: 1, ghostKick: 0, metal: 0 },
            drums: { kick: 0.9, knock: 0.6, click: 0.3, kickDecay: 0.42, clap: 0.6, body: 0.6, wires: 0.4, tail: 0.18, shaker: 0.6, ride: 0.4, crash: 0.7, conga: 0.9, toms: 0.8 },
            bus: { tape: 1.2, mix: 0.45, exciter: 0.3, width: 0.3, drums: 1.4 },
          },
          kit: {
            kick: { start: 120, end: 46, sweep: 0.05, decay: 0.34, click: 0.06, clickHp: 3000, drive: 0.4, body: 1.15 },
            snare: [
              { noise: "bandpass", freq: 1250, q: 1.1, decay: 0.02, level: 0.5 },
              { noise: "bandpass", freq: 1250, q: 1.1, decay: 0.02, level: 0.5, at: 0.011 },
              { noise: "bandpass", freq: 1250, q: 1.1, decay: 0.16, level: 0.5, at: 0.022 },
            ],
            ghost: [{ noise: "bandpass", freq: 2800, q: 1, decay: 0.035, level: 0.25 }],
            hat: { hp: 8000, decay: 0.03, metal: 0.2, level: 0.2 },
            shaker: { freq: 7200, q: 1.2, decay: 0.03, attack: 0.006, level: 0.05, off: 0.04 },
            open: { hp: 7000, decay: 0.2, metal: 0.3, level: 0.3 },
          },
          vinyl: 0,
          mix: { kick: 0.5, bass: 0.5, harm: 1.5 },
          fx: {
            echo: { steps: 4, taps: 2, fb: 0.3, lp: 3500, hp: 500 },
            echoSend: { kick: 0, bass: 0, snare: 0.05, perc: 0.12, lead: 0.25, harm: 0.06, fx: 0.5 },
            space: { size: 1.4, fb: 0.62, lp: 6000 },
            spaceSend: { kick: 0, bass: 0, snare: 0.15, hat: 0.04, perc: 0.22, lead: 0.15, harm: 0.15, tex: 0, fx: 0.3 },
            drumLp: 15000,
            drive: 1.1,
            pressDrive: 0.1,
            duck: { bass: 0.5, harm: 0.5 },
            duckTime: { bass: 0.15, harm: 0.22 },
            master: { lp: 15000 },
          },
        },
      },
    ],
  },
} satisfies StationPack;
