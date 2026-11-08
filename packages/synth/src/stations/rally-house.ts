import type { StationPack } from "../pack.ts";

// Rally House v1 (docs/sound/RALLY-HOUSE.md): the club strand of the young rally-house microgenre. Roots: late-90s
// arcade racing scores (Hiroshi Okubo's Ridge Racer Type 4: acid jazz and progressive house "more mature, more
// fashionable"; Sega Rally's organ house; Rave Racer) on 90s club house (Kerri Chandler, Full Intention), heard today
// through SAM WAITIN, nuphory, Gemi, wev, lunar lander, X CLUB., Reformist. Not the phonk / TikTok strand.
// The brief: "a really fashionable sound, not yet another kids' matinee". Hard rules, every style:
//   minor 7/9/11 and Dorian harmony on 1-2-chord loops (no major victory tunes, no pop 4-chord loops, no leads at all:
//   the pluck and the lead are off; the only melodic voice is the diva, as short chops on chord tones with 9ths);
//   Rhodes, M1 organ and piano, a filtered chord loop (no square / saw / supersaw leads, no chiptune);
//   swing 0.58..0.64 (the engine's: an odd 16th lands (swing - 0.5) of a 16th late, so MPC 54..57%), ghost notes,
//   basslines on the offbeats with octave jumps, every hit its own velocity;
//   the "PSX" lives in the texture (ukg.psx: 10-12 bit, 22 / 15 kHz hold on the chords, the voice and the drums),
//   no game SFX, no riser (riser 0, no lift), the drop's noise crash off (ukg.impact 0), the heat's hat doubles off;
//   4-5 elements at a time, the long filter build (ukg.filter on the chord bus), a breakbeat fill closing every 8 bars;
//   a deep mono sub under a solid kick, a dark top (master and drum lowpasses 10.5-12.5 kHz);
//   round tone-led snares under the kick (triangle bodies, short dark noise, no clap wires), sparse hats in lanes.
// On the future garage genre's UK garage voices (engine.ts garageUkg) with the Rally House opt-ins (psx, filter,
// breaks, lanes, chop, rolls, impact; scale "dorian"). Baked but on no station: a Style Lab shelf.

/** The round snare: two triangle bodies and a short dark noise, nothing over ~4 kHz to speak of. */
const SNARE = [
  { tone: "triangle", freq: 190, to: 165, sweep: 0.04, decay: 0.12, level: 0.8 },
  { tone: "triangle", freq: 330, to: 290, sweep: 0.03, decay: 0.05, level: 0.3 },
  { noise: "bandpass", freq: 1500, q: 0.9, decay: 0.07, level: 0.45 },
  { noise: "lowpass", freq: 3000, q: 0.7, decay: 0.035, level: 0.22 },
  { noise: "bandpass", freq: 2600, q: 1.2, decay: 0.035, level: 0.55 },
] as const;
/** A ghost: a small tone and a short band of noise. */
const GHOST = [
  { tone: "triangle", freq: 480, to: 430, decay: 0.025, level: 0.55 },
  { noise: "bandpass", freq: 2100, q: 1, decay: 0.025, level: 0.35 },
] as const;
const HAT = { hp: 6500, decay: 0.024, metal: 0.04, q: 0.8, level: 0.58 };
const OPEN = { hp: 6200, decay: 0.11, metal: 0.04, q: 0.7, level: 0.45 };
const SHAKER = { freq: 6400, q: 1.1, decay: 0.035, attack: 0.008, level: 0.2, off: 0.12 };
const KICK = { start: 130, end: 47, sweep: 0.045, decay: 0.32, click: 0.06, clickHp: 2600, drive: 0.5, body: 1.15 };
/** Four to the floor. */
const FOUR = { lo: [[0, 4, 8, 12]], mid: [[0, 4, 8, 12]], hi: [[0, 4, 8, 12]] };
/** The diva's vowels (female F1/F2): ah, oh, eh, ooh, ay. */
const VOWELS = [[820, 1220], [520, 880], [580, 1750], [420, 820], [650, 1550]] as const;

export default {
  key: "rally-house",
  name: "Rally House",
  genres: ["futuregarage"],
  styles: {
    futuregarage: [
      // Acid jazz house (Ridge Racer Type 4 "One More Win", Jamiroquai's Full Intention mix): the Rhodes comping min9
      // chords, Am9 - Dm9 two bars each (the next cycle adds Fmaj9 - Em11), a live finger bass on the offbeats with
      // octave jumps and ghost notes, the diva chopped on the 9ths, brushed tops (a dark shaker in a lane, few hats).
      {
        id: "rally-one-more-lap",
        name: "One More Lap",
        base: "classic",
        bpm: [124, 124],
        swing: 0.62,
        microScale: 0.3,
        trim: 1.093,
        riser: 0,
        data: {
          chords: [
            { bass: 0, pad: [3, 7, 10, 14], guide: 10, dark: [0, 7, 15] }, // i m9 (Am9: C E G B over A)
            { bass: 5, pad: [-4, 0, 3, 7], guide: 3, dark: [5, 12, 20] }, // iv m9 (Dm9: F A C E over D)
            { bass: 8, pad: [0, 3, 7, 10], guide: 7, dark: [8, 15, 19] }, // bVI maj9 (Fmaj9: A C E G over F)
            { bass: 7, pad: [-2, 0, 2, 5], guide: 2, dark: [7, 14, 19] }, // v m11 (Em11: G A B D over E)
          ],
          progressions: [[0, 1, 0, 1], [0, 1, 2, 3]],
          kicks: FOUR,
          skips: [[[7, 0.3], [15, 0.22], [23, 0.3], [29, 0.35], [31, 0.25]]],
          stabs: [
            [
              { s: 0, len: 3, vel: 0.8, core: true }, { s: 3, len: 1, vel: 0.5, core: false }, { s: 6, len: 2, vel: 0.85, core: true },
              { s: 11, len: 3, vel: 0.9, core: true }, { s: 18, len: 1.5, vel: 0.7, core: true }, { s: 22, len: 3, vel: 0.88, core: true },
              { s: 27, len: 1, vel: 0.5, core: false }, { s: 30, len: 2, vel: 0.72, core: true },
            ],
            [
              { s: 0, len: 6, vel: 0.85, core: true }, { s: 7, len: 1, vel: 0.6, core: true }, { s: 10, len: 4, vel: 0.8, core: true },
              { s: 19, len: 1, vel: 0.55, core: false }, { s: 22, len: 6, vel: 0.85, core: true }, { s: 30, len: 1, vel: 0.5, core: true },
            ],
          ],
          basslines: [
            [
              { s: 0, len: 1.5, semi: 0, vel: 1, core: true }, { s: 3, len: 0.5, semi: 12, vel: 0.5, core: true },
              { s: 6, len: 1, semi: 0, vel: 0.85, core: true }, { s: 10, len: 1, semi: 7, vel: 0.8, core: true },
              { s: 11, len: 0.5, semi: 12, vel: 0.45, core: false }, { s: 14, len: 1.5, semi: 12, vel: 0.75, core: true, glide: true },
              { s: 16, len: 1.5, semi: 0, vel: 0.95, core: true }, { s: 19, len: 1, semi: 7, vel: 0.7, core: true },
              { s: 22, len: 1, semi: 0, vel: 0.85, core: true }, { s: 26, len: 1, semi: 12, vel: 0.8, core: true },
              { s: 27, len: 0.5, semi: 7, vel: 0.45, core: false }, { s: 30, len: 1.5, semi: -5, vel: 0.7, core: true, glide: true },
            ],
            [
              { s: 0, len: 2, semi: 0, vel: 1, core: true }, { s: 3, len: 0.5, semi: 0, vel: 0.45, core: true },
              { s: 6, len: 1, semi: 12, vel: 0.8, core: true }, { s: 7, len: 1, semi: 7, vel: 0.6, core: true, glide: true },
              { s: 10, len: 1.5, semi: 0, vel: 0.85, core: true }, { s: 14, len: 1, semi: 12, vel: 0.7, core: true },
              { s: 16, len: 2, semi: 0, vel: 0.95, core: true }, { s: 19, len: 0.5, semi: 12, vel: 0.5, core: false },
              { s: 22, len: 1, semi: 7, vel: 0.8, core: true }, { s: 23, len: 1, semi: 12, vel: 0.6, core: true, glide: true },
              { s: 26, len: 1.5, semi: 0, vel: 0.85, core: true }, { s: 30, len: 1, semi: 7, vel: 0.65, core: true },
            ],
          ],
          calls: [
            [{ s: 6, len: 1, vowel: 0, tone: 3, core: true }, { s: 14, len: 2, vowel: 1, to: 0, tone: 2, rep: 1, core: true }, { s: 27, len: 1, vowel: 2, tone: 3, core: false }],
            [{ s: 3, len: 1, vowel: 4, tone: 2, core: true }, { s: 10, len: 3, vowel: 3, to: 0, tone: 3, core: true }],
          ],
          vowels: VOWELS,
          ukg: {
            keys: [9],
            bars: 2,
            turn: 0,
            vary: 1,
            pump: 1,
            rolls: 0,
            impact: 0,
            stab: { level: 0 },
            ep: { level: 1.15, octave: 0, ratio: 1, index: 4, floor: 0.2, decay: 0.8, chorus: 7, cutoff: 5500, release: 0.4, tine: 0.9, trem: 4.4, tremDepth: 0.45 },
            bed: { kind: "organ", level: 0.55, in: ["breakdown", "rebuild"], cutoff: 1500, lfoBars: 8, lfoDepth: 0.3, attack: 0.4, release: 0.8, octave: 0, width: 0.6, ensemble: 0.5 },
            sub: { level: 0.61, attack: 0.004, decay: 0.35, sustain: 0.6, release: 0.06, drive: 0.4, glide: 0.06 },
            mid: { level: 0 },
            bass2: { kind: "pluck", level: 1, cutoff: 650, env: 0.4, decay: 0.25, sustain: 0.4, release: 0.06, drive: 1, top: 0.2, hp: 85 },
            midEarly: 1,
            pluck: { level: 0 },
            lead: { level: 0 },
            vox: { level: 1 },
            voc: { level: 1.35, scoop: -1, scoopSec: 0.05, vibrato: 14, breath: 0.2, consonant: 0.45, release: 0.08, presence: 3, duck: 0.3 },
            chop: { in: ["build", "full", "rebuild"], alt: 0, every: 2 },
            groove: { hatLate: 0.06, percLate: 0.08, jitter: 0.5, ghost: 0.6, perc: 0, open: 0, offOpen: 0, tamb: 0, ghostKick: 0, metal: 0 },
            lanes: {
              hat: "..6...8...6...9...6...8...5.7.8.",
              shaker: "5..3.7..4.3.7...5..3.7..4.3.7.3.",
              open: "..............4...............5.",
              rim: "",
            },
            breaks: {
              level: 0.9, in: ["breakdown"], alt: 0, every: 8, from: 12,
              fillKick: "", fillSnare: "............6..8", fillGhost: ".............4..", fillHat: "............3.3.",
            },
            drums: { kick: 0.85, knock: 0.6, click: 0.5, kickDecay: 0.34, clap: 0, shaker: 0, ride: 0, crash: 0, conga: 0.3, toms: 0 },
            filter: { on: 1, lo: 500, hi: 14000, q: 0.9, bars: 16, depth: 0.25 },
            psx: { bits: 12, rate: 22050, drive: 0.6, lp: 12500, harm: 0.5, lead: 0.35, drums: 0.35 },
            chorus: { lead: 0.12, harm: 0.15 },
            hall: { level: 0.22, decay: 1.6, lp: 5000, hp: 400, pre: 0.02, harm: 0.15, lead: 0.12, snare: 0.06, fx: 0.3 },
            bus: { tape: 1, mix: 0.4, exciter: 0.5, width: 0.4, drums: 1.2, mud: 2 },
          },
          kit: { kick: KICK, snare: SNARE, ghost: GHOST, hat: HAT, shaker: SHAKER, open: OPEN },
          vinyl: 0,
          mix: { kick: 0, bass: 0.5 },
          fx: {
            echo: { steps: 3, taps: 3, fb: 0.35, lp: 3200, hp: 500 },
            echoSend: { kick: 0, bass: 0, snare: 0.03, perc: 0.1, lead: 0.2, harm: 0.05, fx: 0.5 },
            space: { size: 0.8, fb: 0.5, lp: 5000 },
            spaceSend: { kick: 0, bass: 0, snare: 0.08, hat: 0.03, perc: 0.15, lead: 0.12, harm: 0.08, tex: 0, fx: 0.25 },
            drumLp: 14000,
            drive: 1.05,
            pressDrive: 0.08,
            duck: { bass: 0.55, harm: 0.6 },
            duckTime: { bass: 0.14, harm: 0.2 },
            master: { lp: 15000 },
          },
        },
      },
      // Deep (Kerri Chandler): G Dorian, Gm11 - C9 (the major 6th of the Dorian in the IV9), two bars each. A heavy
      // round bass (sub + a dark organ bass, round, low), dub M1 organ stabs on the offbeats into a dotted echo, a rim, a
      // dark shaker, a rare diva "ooh" every fourth figure of the drop. Minimal: never more than four elements.
      {
        id: "rally-select",
        name: "Select",
        base: "classic",
        bpm: [122, 122],
        swing: 0.64,
        microScale: 0.3,
        trim: 1.097,
        riser: 0,
        data: {
          chords: [
            { bass: 0, pad: [3, 5, 10, 14], guide: 10, dark: [0, 7, 15] }, // i m11 (Gm11: Bb C F A over G)
            { bass: 5, pad: [-3, 0, 3, 7], guide: 3, dark: [5, 12, 19] }, // IV9 (C9: E G Bb D over C)
          ],
          progressions: [[0, 1, 0, 1], [0, 0, 0, 1]],
          kicks: FOUR,
          skips: [[[15, 0.2], [31, 0.28]]],
          stabs: [
            [{ s: 3, len: 1, vel: 0.9, core: true }, { s: 10, len: 1, vel: 0.7, core: true }, { s: 22, len: 1.5, vel: 0.85, core: true }, { s: 27, len: 1, vel: 0.5, core: false }],
            [{ s: 2, len: 1, vel: 0.85, core: true }, { s: 14, len: 1, vel: 0.65, core: true }, { s: 19, len: 1, vel: 0.9, core: true }, { s: 30, len: 1, vel: 0.6, core: true }],
          ],
          basslines: [
            [
              { s: 0, len: 3, semi: 0, vel: 1, core: true }, { s: 6, len: 1, semi: 0, vel: 0.7, core: true },
              { s: 7, len: 1.5, semi: 12, vel: 0.8, core: true, glide: true }, { s: 10, len: 2, semi: 0, vel: 0.85, core: true },
              { s: 14, len: 1, semi: 7, vel: 0.6, core: true }, { s: 16, len: 3, semi: 0, vel: 1, core: true },
              { s: 22, len: 1, semi: 12, vel: 0.75, core: true }, { s: 23, len: 1.5, semi: 7, vel: 0.7, core: true, glide: true },
              { s: 26, len: 2, semi: 0, vel: 0.85, core: true }, { s: 30, len: 1, semi: 10, vel: 0.55, core: false },
            ],
            [
              { s: 2, len: 2, semi: 0, vel: 1, core: true }, { s: 6, len: 1, semi: 12, vel: 0.75, core: true },
              { s: 10, len: 2, semi: 0, vel: 0.9, core: true }, { s: 13, len: 1, semi: -5, vel: 0.6, core: true, glide: true },
              { s: 18, len: 2, semi: 0, vel: 1, core: true }, { s: 22, len: 1, semi: 12, vel: 0.75, core: true },
              { s: 26, len: 2, semi: 7, vel: 0.8, core: true }, { s: 29, len: 1.5, semi: 0, vel: 0.65, core: true, glide: true },
            ],
          ],
          calls: [[{ s: 28, len: 3, vowel: 3, to: 1, tone: 2, core: true }], [{ s: 12, len: 2, vowel: 1, to: 0, tone: 3, core: true }]],
          vowels: VOWELS,
          ukg: {
            keys: [7],
            scale: "dorian",
            bars: 2,
            turn: 0,
            vary: 1,
            pump: 1,
            rolls: 0,
            impact: 0,
            stab: { level: 0 },
            m1: { level: 1.2, octave: 0, cutoff: 4400, drive: 1.8, click: 0.6, decay: 0.2, sustain: 0.15, release: 0.12 },
            bed: { kind: "juno", level: 0.5, in: ["build", "full", "breakdown", "rebuild"], cutoff: 2200, lfoBars: 8, lfoDepth: 0.3, attack: 0.6, release: 1, octave: 0, width: 0.6, ensemble: 0.5 },
            sub: { level: 0.68, attack: 0.004, decay: 0.6, sustain: 0.8, release: 0.08, drive: 0.5, glide: 0.07 },
            mid: { level: 0 },
            bass2: { kind: "organ", level: 0.7, cutoff: 480, env: 0.2, decay: 0.3, sustain: 0.5, release: 0.06, drive: 0.8, top: 0.08, hp: 100 },
            midEarly: 1,
            pluck: { level: 0 },
            lead: { level: 0 },
            vox: { level: 1 },
            voc: { level: 1, scoop: -1.5, scoopSec: 0.07, vibrato: 18, breath: 0.25, consonant: 0.25, release: 0.15, presence: 3, duck: 0.2 },
            chop: { in: ["build", "full"], alt: 0, every: 4 },
            groove: { hatLate: 0.08, percLate: 0.1, jitter: 0.5, ghost: 0.5, perc: 0, open: 0, offOpen: 0, tamb: 0, ghostKick: 0, metal: 0 },
            lanes: {
              hat: "....7.......8.......7.......8.6.",
              shaker: "..5...5...5..35...5...5...5...4.",
              open: "..5.......5.......4.......5.....",
              rim: "...........8..........7.....8...",
            },
            breaks: {
              level: 0.85, in: ["breakdown"], alt: 0, every: 8, from: 12,
              fillKick: "", fillSnare: "............5..7", fillGhost: "..............3.", fillHat: "",
            },
            drums: { kick: 0.81, knock: 0.5, click: 0.45, kickDecay: 0.38, clap: 0, shaker: 0, ride: 0, crash: 0, conga: 0, toms: 0 },
            filter: { on: 1, lo: 400, hi: 13000, q: 1, bars: 16, depth: 0.25 },
            psx: { bits: 12, rate: 22050, drive: 0.5, lp: 12000, harm: 0.45, lead: 0.3, drums: 0.3 },
            hall: { level: 0.15, decay: 1.8, lp: 4500, hp: 400, pre: 0.02, harm: 0.1, lead: 0.15, snare: 0.05, fx: 0.3 },
            bus: { tape: 1.1, mix: 0.4, exciter: 0.5, width: 0.3, drums: 1.2, mud: 2 },
          },
          kit: { kick: KICK, snare: SNARE, ghost: GHOST, hat: HAT, shaker: SHAKER, open: OPEN },
          vinyl: 0,
          mix: { kick: 0, bass: 1 },
          fx: {
            // The dub: the organ bus into a dotted echo that rings into the next stab.
            echo: { steps: 3, taps: 4, fb: 0.45, lp: 2500, hp: 600 },
            echoSend: { kick: 0, bass: 0, snare: 0.03, perc: 0.15, lead: 0.2, harm: 0.28, fx: 0.6 },
            space: { size: 0.9, fb: 0.5, lp: 4500 },
            spaceSend: { kick: 0, bass: 0, snare: 0.06, hat: 0.03, perc: 0.15, lead: 0.15, harm: 0.08, tex: 0, fx: 0.25 },
            drumLp: 13500,
            drive: 1.05,
            pressDrive: 0.08,
            duck: { bass: 0.6, harm: 0.55 },
            duckTime: { bass: 0.15, harm: 0.22 },
            master: { lp: 14500 },
          },
        },
      },
      // Fast house (SAM WAITIN, nuphory): the filtered M1 chord loop (the layered house piano with its M1 organ blend
      // over a quiet M1 organ, chopped on the 16ths, through the filter-house lowpass that opens over the build and
      // breathes in the drop), F#m9 - Dmaj7 a bar each; a kick with a garage bounce (a skipped kick before the 4, a
      // ghost kick into the next bar), the organ bass on the offbeats, diva stutters, a breakbeat fill every 8 bars,
      // the heaviest PSX grit (10 bit, a 15 kHz hold).
      {
        id: "rally-replay",
        name: "Replay",
        base: "classic",
        bpm: [130, 130],
        swing: 0.6,
        microScale: 0.2,
        trim: 1.046,
        riser: 0,
        data: {
          chords: [
            { bass: 0, pad: [3, 7, 10, 14], guide: 10, dark: [0, 7, 15] }, // i m9 (F#m9: A C# E G#)
            { bass: 8, pad: [-4, 0, 3, 7], guide: 7, dark: [8, 15, 19] }, // bVI maj7 (Dmaj7: D F# A C#)
            { bass: 7, pad: [-5, -2, 2, 5], guide: 2, dark: [7, 14, 19] }, // v m7 (C#m7: C# E G# B)
          ],
          progressions: [[0, 1, 0, 1], [0, 1, 0, 2]],
          kicks: { lo: [[0, 4, 8, 12]], mid: [[0, 4, 8, 12], [0, 4, 8, 11, 12]], hi: [[0, 4, 8, 12], [0, 4, 8, 11, 12]] },
          skips: [[[7, 0.3], [14, 0.25], [23, 0.3], [27, 0.25], [31, 0.35]]],
          stabs: [
            [
              { s: 0, len: 1, vel: 0.9, core: true }, { s: 2, len: 0.75, vel: 0.55, core: false }, { s: 3, len: 1, vel: 0.8, core: true },
              { s: 6, len: 1, vel: 0.85, core: true }, { s: 10, len: 1, vel: 0.8, core: true }, { s: 11, len: 0.75, vel: 0.5, core: false },
              { s: 14, len: 1.5, vel: 0.85, core: true }, { s: 16, len: 1, vel: 0.9, core: true }, { s: 19, len: 1, vel: 0.75, core: true },
              { s: 22, len: 1, vel: 0.85, core: true }, { s: 26, len: 1, vel: 0.8, core: true }, { s: 28, len: 2, vel: 0.7, core: true },
            ],
            [
              { s: 0, len: 1.5, vel: 0.95, core: true }, { s: 3, len: 1, vel: 0.7, core: true }, { s: 7, len: 1, vel: 0.8, core: true },
              { s: 10, len: 1.5, vel: 0.85, core: true }, { s: 13, len: 1, vel: 0.6, core: false }, { s: 16, len: 1.5, vel: 0.95, core: true },
              { s: 19, len: 1, vel: 0.7, core: true }, { s: 23, len: 1, vel: 0.8, core: true }, { s: 26, len: 2, vel: 0.85, core: true },
            ],
          ],
          basslines: [
            [
              { s: 2, len: 1.5, semi: 0, vel: 0.95, core: true }, { s: 6, len: 1, semi: 12, vel: 0.85, core: true },
              { s: 7, len: 0.5, semi: 0, vel: 0.5, core: false }, { s: 10, len: 1.5, semi: 0, vel: 0.9, core: true },
              { s: 14, len: 1, semi: 12, vel: 0.8, core: true }, { s: 18, len: 1.5, semi: 0, vel: 0.95, core: true },
              { s: 22, len: 1, semi: 7, vel: 0.85, core: true }, { s: 26, len: 1.5, semi: 0, vel: 0.9, core: true },
              { s: 30, len: 1, semi: 12, vel: 0.75, core: true, glide: true },
            ],
            [
              { s: 2, len: 1, semi: 0, vel: 0.95, core: true }, { s: 3, len: 0.5, semi: 12, vel: 0.55, core: true },
              { s: 6, len: 1, semi: 0, vel: 0.85, core: true }, { s: 10, len: 1, semi: 12, vel: 0.85, core: true },
              { s: 11, len: 1, semi: 7, vel: 0.65, core: true }, { s: 14, len: 1.5, semi: 0, vel: 0.85, core: true },
              { s: 18, len: 1, semi: 0, vel: 0.95, core: true }, { s: 22, len: 1, semi: 12, vel: 0.85, core: true },
              { s: 26, len: 1, semi: 7, vel: 0.8, core: true }, { s: 27, len: 0.5, semi: 12, vel: 0.5, core: false }, { s: 30, len: 1.5, semi: 0, vel: 0.75, core: true },
            ],
          ],
          calls: [
            [{ s: 6, len: 0.75, vowel: 0, tone: 3, rep: 2, core: true }, { s: 22, len: 0.75, vowel: 2, tone: 2, core: true }],
            [{ s: 14, len: 1, vowel: 4, tone: 3, rep: 1, core: true }, { s: 30, len: 1, vowel: 0, tone: 2, core: true }],
          ],
          vowels: VOWELS,
          ukg: {
            keys: [6, 8],
            bars: 1,
            turn: 1,
            vary: 1,
            pump: 1,
            rolls: 0,
            impact: 0,
            stab: { level: 0 },
            grand: { level: 1.15, in: [], alt: 0, octave: 0, double: 0.15, decay: 1, release: 0.15, bright: 0.6, detune: 1.2, bark: 0.35, hammer: 0.4, organ: 0.55, thin: 0 },
            m1: { level: 0.4, octave: 0, cutoff: 3400, drive: 2.0, click: 0.6, decay: 0.2, sustain: 0.2, release: 0.08 },
            sub: { level: 0.55, attack: 0.004, decay: 0.3, sustain: 0.55, release: 0.05, drive: 0.5, glide: 0.06 },
            mid: { level: 0 },
            bass2: { kind: "organ", level: 0.85, cutoff: 750, env: 0.3, decay: 0.16, sustain: 0.3, release: 0.05, drive: 1.3, top: 0.15, hp: 100 },
            midEarly: 1,
            pluck: { level: 0 },
            lead: { level: 0 },
            vox: { level: 1 },
            voc: { level: 1.05, scoop: -1, scoopSec: 0.04, vibrato: 10, breath: 0.15, consonant: 0.55, release: 0.05, presence: 3, duck: 0.25 },
            chop: { in: ["build", "full"], alt: 0, every: 2 },
            groove: { hatLate: 0.05, percLate: 0.06, jitter: 0.4, ghost: 0.7, perc: 0, open: 0, offOpen: 0, tamb: 0, ghostKick: 0.55, metal: 0 },
            lanes: {
              hat: "7.5.8...7.5.9...7.5.8...7.5.9.6.",
              shaker: "",
              open: "..6.......6.......6.......6.....",
              rim: "",
            },
            breaks: {
              level: 1, in: ["breakdown"], alt: 0, every: 8, from: 8,
              fillKick: "........8.....6.", fillSnare: "............7..9", fillGhost: "..........4..5..", fillHat: "........5.4.6.4.",
            },
            drums: { kick: 0.77, knock: 0.8, click: 0.6, kickDecay: 0.3, clap: 0.35, body: 0.6, wires: 0, tail: 0.1, shaker: 0, ride: 0, crash: 0, conga: 0, toms: 0 },
            filter: { on: 1, lo: 300, hi: 12500, q: 1.4, bars: 16, depth: 0.5 },
            psx: { bits: 10, rate: 15000, drive: 1, lp: 11000, harm: 0.7, lead: 0.5, drums: 0.5 },
            hall: { level: 0.15, decay: 1.4, lp: 5000, hp: 400, pre: 0.015, harm: 0.08, lead: 0.12, snare: 0.05, fx: 0.3 },
            bus: { tape: 1.3, mix: 0.45, exciter: 0.5, width: 0.4, drums: 1.6, mud: 2.5 },
          },
          kit: { kick: KICK, snare: SNARE, ghost: GHOST, hat: HAT, shaker: SHAKER, open: OPEN },
          vinyl: 0,
          mix: { kick: 0.5, harm: 1 },
          fx: {
            echo: { steps: 3, taps: 3, fb: 0.35, lp: 3500, hp: 500 },
            echoSend: { kick: 0, bass: 0, snare: 0.03, perc: 0.1, lead: 0.25, harm: 0.04, fx: 0.5 },
            space: { size: 0.7, fb: 0.5, lp: 5000 },
            spaceSend: { kick: 0, bass: 0, snare: 0.06, hat: 0.02, perc: 0.12, lead: 0.12, harm: 0.06, tex: 0, fx: 0.25 },
            drumLp: 13500,
            drive: 1.15,
            pressDrive: 0.1,
            duck: { bass: 0.45, harm: 0.4 },
            duckTime: { bass: 0.13, harm: 0.2 },
            master: { lp: 15000 },
          },
        },
      },
      // Dark UK hardgroove / garage (Gemi): E Dorian, Em11 - A9, dry and tight. A hard dry kick, skippy ghost snares,
      // rolling congas and a rim in the gaps, hats with gaps, a short dark M1 organ stab with a dark filtered saw body
      // under it (24 dB, under 1 kHz: a stab, never a lead), a rolling sub with a dark saw bass, no room to speak of.
      {
        id: "rally-night-stage",
        name: "Night Stage",
        base: "classic",
        bpm: [134, 134],
        swing: 0.6,
        microScale: 0.15,
        trim: 1.253,
        riser: 0,
        data: {
          chords: [
            { bass: 0, pad: [3, 5, 10, 14], guide: 10, dark: [0, 7, 15] }, // i m11 (Em11: G A D F#)
            { bass: 5, pad: [-3, 0, 3, 7], guide: 3, dark: [5, 12, 19] }, // IV9 (A9: C# E G B)
          ],
          progressions: [[0, 0, 0, 1], [0, 1, 0, 1]],
          kicks: FOUR,
          skips: [[[3, 0.3], [7, 0.35], [14, 0.3], [19, 0.3], [23, 0.35], [27, 0.3], [30, 0.3]]],
          stabs: [
            [{ s: 2, len: 0.75, vel: 0.9, core: true }, { s: 7, len: 0.75, vel: 0.7, core: true }, { s: 13, len: 0.75, vel: 0.8, core: true }, { s: 18, len: 0.75, vel: 0.9, core: true }, { s: 26, len: 1, vel: 0.75, core: true }],
            [{ s: 3, len: 0.75, vel: 0.9, core: true }, { s: 10, len: 0.75, vel: 0.75, core: true }, { s: 19, len: 0.75, vel: 0.9, core: true }, { s: 22, len: 0.75, vel: 0.6, core: false }, { s: 29, len: 1, vel: 0.8, core: true }],
          ],
          basslines: [
            [
              { s: 2, len: 1, semi: 0, vel: 0.95, core: true }, { s: 6, len: 1, semi: 0, vel: 0.85, core: true },
              { s: 7, len: 0.5, semi: 12, vel: 0.55, core: false }, { s: 10, len: 1, semi: 0, vel: 0.9, core: true },
              { s: 13, len: 1, semi: 12, vel: 0.7, core: true }, { s: 14, len: 1, semi: 0, vel: 0.85, core: true },
              { s: 18, len: 1, semi: 0, vel: 0.95, core: true }, { s: 22, len: 1, semi: 7, vel: 0.8, core: true },
              { s: 26, len: 1, semi: 0, vel: 0.9, core: true }, { s: 29, len: 1, semi: 10, vel: 0.65, core: true }, { s: 30, len: 1, semi: 12, vel: 0.7, core: true, glide: true },
            ],
          ],
          calls: [[{ s: 13, len: 0.75, vowel: 2, tone: 2, rep: 1, core: true }]],
          vowels: VOWELS,
          ukg: {
            keys: [4],
            scale: "dorian",
            bars: 2,
            turn: 1,
            vary: 1,
            pump: 1,
            rolls: 0,
            impact: 0,
            stab: { level: 0.8, voices: 2, detune: 8, osc2: 0, cutoff: 1400, q: 1.6, slope: 24, env: 0.3, fdecay: 0.1, attack: 0.002, decay: 0.12, sustain: 0, release: 0.05, drive: 1.2, vel: 0.6, width: 0.4, octave: -12 },
            m1: { level: 1.1, octave: 0, cutoff: 4000, drive: 2.4, click: 0.65, decay: 0.12, sustain: 0.05, release: 0.05 },
            sub: { level: 0.61, attack: 0.003, decay: 0.25, sustain: 0.5, release: 0.04, drive: 0.6, glide: 0.05 },
            mid: { level: 0 },
            bass2: { kind: "saw", level: 0.7, cutoff: 420, env: 0.4, decay: 0.12, sustain: 0.25, release: 0.04, drive: 1.8, top: 0.05, hp: 110 },
            midEarly: 1,
            pluck: { level: 0 },
            lead: { level: 0 },
            vox: { level: 0.9 },
            voc: { level: 1, scoop: -0.5, scoopSec: 0.03, vibrato: 0, breath: 0.15, consonant: 0.6, release: 0.04, presence: 3, duck: 0 },
            chop: { in: ["full"], alt: 0, every: 4 },
            groove: { hatLate: 0.04, percLate: 0.05, jitter: 0.3, ghost: 0.85, perc: 1, open: 0, offOpen: 0, tamb: 0, ghostKick: 0, metal: 0 },
            lanes: {
              hat: "..7.6.9...7.6.9...7.6.9...7.5.9.",
              shaker: "",
              open: "..5.......5...........5...5.....",
              rim: ".....6..........7..6.......7....",
            },
            breaks: {
              level: 1, in: ["breakdown"], alt: 0, every: 8, from: 12,
              fillKick: "............7...", fillSnare: ".............6.8", fillGhost: "..............4.", fillHat: "",
            },
            drums: { kick: 0.85, knock: 0.9, click: 0.55, kickDecay: 0.26, clap: 0, shaker: 0, ride: 0, crash: 0, conga: 0.8, toms: 0 },
            filter: { on: 1, lo: 250, hi: 12000, q: 1.2, bars: 8, depth: 0.25 },
            psx: { bits: 12, rate: 22050, drive: 0.8, lp: 11500, harm: 0.45, lead: 0.3, drums: 0.4 },
            bus: { tape: 1.2, mix: 0.45, exciter: 0.5, width: 0.25, drums: 1.8, mud: 2 },
          },
          kit: {
            kick: { start: 140, end: 48, sweep: 0.035, decay: 0.26, click: 0.08, clickHp: 2600, drive: 0.8, body: 1.15 },
            snare: [
              { tone: "triangle", freq: 200, to: 170, sweep: 0.03, decay: 0.09, level: 0.8 },
              { tone: "triangle", freq: 340, to: 300, sweep: 0.02, decay: 0.04, level: 0.3 },
              { noise: "bandpass", freq: 1700, q: 1, decay: 0.05, level: 0.45 },
            ],
            ghost: GHOST,
            hat: { hp: 7200, decay: 0.018, metal: 0.04, q: 0.8, level: 0.2 },
            shaker: SHAKER,
            open: { hp: 6500, decay: 0.08, metal: 0.04, q: 0.7, level: 0.18 },
          },
          vinyl: 0,
          mix: { kick: 0.5, bass: 0.5 },
          fx: {
            echo: { steps: 3, taps: 2, fb: 0.3, lp: 3000, hp: 600 },
            echoSend: { kick: 0, bass: 0, snare: 0, perc: 0.08, lead: 0.12, harm: 0.03, fx: 0.4 },
            space: { size: 0.4, fb: 0.35, lp: 4500 },
            spaceSend: { kick: 0, bass: 0, snare: 0.03, hat: 0.01, perc: 0.08, lead: 0.06, harm: 0.03, tex: 0, fx: 0.15 },
            drumLp: 13000,
            drive: 1.15,
            pressDrive: 0.1,
            duck: { bass: 0.5, harm: 0.45 },
            duckTime: { bass: 0.12, harm: 0.18 },
            master: { lp: 13500 },
          },
        },
      },
      // Breaks + house (Rave Racer, grown up): F minor, Fm - Dbmaj7 / Fm - Eb6. A breakbeat over the four to the floor
      // (its snares, ghosts and 8th hats carry the top, the house hats rest), a filtered rave stab (the M1 organ and a
      // dark saw body through the filter-house lowpass, opening over the build), an organ bass on the offbeats, a choir
      // bed in the breakdown, diva stutters in the build. No hoover, no supersaw, no riser.
      {
        id: "rally-final-lap",
        name: "Final Lap",
        base: "classic",
        bpm: [136, 136],
        swing: 0.58,
        microScale: 0.15,
        trim: 1.054,
        riser: 0,
        data: {
          chords: [
            { bass: 0, pad: [0, 3, 7, 12], guide: 3, dark: [0, 7, 15] }, // i (Fm: F Ab C F, the rave stab)
            { bass: 8, pad: [-4, 0, 3, 7], guide: 7, dark: [8, 15, 19] }, // bVI maj7 (Dbmaj7: Db F Ab C)
            { bass: 10, pad: [-2, 2, 5, 7], guide: 2, dark: [10, 17, 22] }, // bVII 6 (Eb6: Eb G Bb C)
            { bass: 0, pad: [3, 7, 10, 14], guide: 10, dark: [0, 7, 15] }, // i m9 (Fm9: Ab C Eb G)
          ],
          progressions: [[0, 1, 0, 2], [3, 1, 3, 2]],
          kicks: FOUR,
          skips: [[[7, 0.25], [23, 0.25]]],
          stabs: [
            [
              { s: 0, len: 1, vel: 0.95, core: true }, { s: 3, len: 1, vel: 0.75, core: true }, { s: 6, len: 1, vel: 0.85, core: true },
              { s: 10, len: 1.5, vel: 0.8, core: true }, { s: 16, len: 1, vel: 0.9, core: true }, { s: 19, len: 1, vel: 0.7, core: true },
              { s: 22, len: 1, vel: 0.85, core: true }, { s: 27, len: 1, vel: 0.6, core: false }, { s: 28, len: 2, vel: 0.8, core: true },
            ],
            [
              { s: 0, len: 2, vel: 0.95, core: true }, { s: 6, len: 1, vel: 0.8, core: true }, { s: 11, len: 1, vel: 0.85, core: true },
              { s: 16, len: 2, vel: 0.95, core: true }, { s: 22, len: 1, vel: 0.8, core: true }, { s: 26, len: 1, vel: 0.7, core: true }, { s: 29, len: 1, vel: 0.6, core: false },
            ],
          ],
          basslines: [
            [
              { s: 2, len: 1, semi: 0, vel: 0.95, core: true }, { s: 6, len: 1, semi: 12, vel: 0.85, core: true },
              { s: 10, len: 1, semi: 0, vel: 0.9, core: true }, { s: 11, len: 0.5, semi: 12, vel: 0.5, core: false },
              { s: 14, len: 1, semi: 7, vel: 0.8, core: true }, { s: 18, len: 1, semi: 0, vel: 0.95, core: true },
              { s: 22, len: 1, semi: 12, vel: 0.85, core: true }, { s: 26, len: 1, semi: 0, vel: 0.9, core: true },
              { s: 29, len: 1, semi: 7, vel: 0.7, core: true }, { s: 30, len: 1, semi: 12, vel: 0.75, core: true, glide: true },
            ],
          ],
          calls: [[{ s: 14, len: 0.75, vowel: 4, tone: 3, rep: 2, core: true }, { s: 30, len: 1.5, vowel: 0, to: 1, tone: 2, core: true }]],
          vowels: VOWELS,
          ukg: {
            keys: [5],
            bars: 1,
            turn: 1,
            vary: 1,
            pump: 1,
            rolls: 0,
            impact: 0,
            stab: { level: 0.6, voices: 2, detune: 9, osc2: 0.15, cutoff: 2000, q: 1.5, slope: 24, env: 0.5, fdecay: 0.15, attack: 0.002, decay: 0.18, sustain: 0, release: 0.06, drive: 1.2, vel: 0.6, width: 0.5, octave: -12 },
            m1: { level: 1, octave: 0, cutoff: 3400, drive: 2.2, click: 0.7, decay: 0.18, sustain: 0.15, release: 0.07 },
            bed: { kind: "choir", level: 0.7, in: ["breakdown"], cutoff: 1800, lfoBars: 8, lfoDepth: 0.3, attack: 0.6, release: 1, octave: 0, width: 0.7, ensemble: 0.6 },
            sub: { level: 0.59, attack: 0.003, decay: 0.3, sustain: 0.55, release: 0.05, drive: 0.5, glide: 0.06 },
            mid: { level: 0 },
            bass2: { kind: "organ", level: 0.8, cutoff: 650, env: 0.3, decay: 0.15, sustain: 0.3, release: 0.05, drive: 1.4, top: 0.1, hp: 100 },
            midEarly: 1,
            pluck: { level: 0 },
            lead: { level: 0 },
            vox: { level: 1 },
            voc: { level: 1, scoop: -1, scoopSec: 0.04, vibrato: 12, breath: 0.15, consonant: 0.55, release: 0.06, presence: 3, duck: 0.2 },
            chop: { in: ["build", "rebuild"], alt: 0, every: 2 },
            groove: { hatLate: 0.04, percLate: 0.05, jitter: 0.3, ghost: 0.6, perc: 0, open: 0, offOpen: 0, tamb: 0, ghostKick: 0, metal: 0 },
            lanes: { hat: "", shaker: "", open: "..........5...............5.....", rim: "" },
            breaks: {
              level: 1, in: ["build", "full", "rebuild"], alt: 0, quiet: 1,
              kick: "..........6.............5.......",
              snare: ".........5...............5....6.",
              ghost: ".......3..4...3........3...4..3.",
              hat: "8.5.9...8.6.9.5.8.5.9...8.6.9...",
              every: 8, from: 8,
              fillKick: "........8.....7.", fillSnare: "..........6.7.89", fillGhost: "........3..4....", fillHat: "........6.4.....",
            },
            drums: { kick: 0.81, knock: 0.8, click: 0.55, kickDecay: 0.3, clap: 0.3, body: 0.6, wires: 0, tail: 0.1, shaker: 0, ride: 0, crash: 0, conga: 0, toms: 0 },
            filter: { on: 1, lo: 350, hi: 11000, q: 1.6, bars: 16, depth: 0.45 },
            psx: { bits: 10, rate: 15000, drive: 1, lp: 11000, harm: 0.6, lead: 0.4, drums: 0.55 },
            hall: { level: 0.15, decay: 1.6, lp: 4500, hp: 400, pre: 0.02, harm: 0.1, lead: 0.12, snare: 0.05, fx: 0.3 },
            bus: { tape: 1.3, mix: 0.45, exciter: 0.5, width: 0.35, drums: 1.8, mud: 2 },
          },
          kit: { kick: KICK, snare: SNARE, ghost: GHOST, hat: HAT, shaker: SHAKER, open: OPEN },
          vinyl: 0,
          mix: { kick: 0.5, harm: 0.5 },
          fx: {
            echo: { steps: 3, taps: 3, fb: 0.35, lp: 3200, hp: 500 },
            echoSend: { kick: 0, bass: 0, snare: 0.03, perc: 0.1, lead: 0.22, harm: 0.05, fx: 0.5 },
            space: { size: 0.7, fb: 0.5, lp: 4800 },
            spaceSend: { kick: 0, bass: 0, snare: 0.06, hat: 0.02, perc: 0.12, lead: 0.12, harm: 0.06, tex: 0, fx: 0.25 },
            drumLp: 13500,
            drive: 1.15,
            pressDrive: 0.1,
            duck: { bass: 0.5, harm: 0.45 },
            duckTime: { bass: 0.13, harm: 0.2 },
            master: { lp: 14500 },
          },
        },
      },
    ],
  },
} satisfies StationPack;
