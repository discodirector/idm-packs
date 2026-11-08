import type { StationPack } from "../pack.ts";

// Synth v2, round 2 (docs/sound/SYNTH-V2.md "Round 2: tracks"): six new tracks written FOR the Synth v2 voices, on
// the UK garage renderer (futuregarage classic with `ukg`), every tonal part on a v2 slot (`ukg.v2`): the physical
// Rhodes and its velocity bark, FM e-piano and FM organ stabs, the resampled chord chop, analog and morph pads, ladder,
// diode and FM basses, a mallet, a waveguide pluck and a tuned bell. Baked but on no station: a Style Lab shelf.
// The house rules, every track: minor / Dorian / Phrygian 7th-9th-11th harmony, no leads (the only melodic parts are
// chord-tone motifs and sparse diva chops), dry rooms (hall <= 0.15, or none), riser 0, no noise crash, no heat hat
// doubles, round tone-led snares (two triangle bodies, short dark noise), sparse hats written in lanes with gaps.
// The renderer's tempo range is 120..145 (futuregarage): the slow, lush track is a laid-back 120 two-step, not 90..110.

/** The round snare (Rally House): two triangle bodies and a short dark noise. */
const SNARE = [
  { tone: "triangle", freq: 190, to: 165, sweep: 0.04, decay: 0.12, level: 0.8 },
  { tone: "triangle", freq: 330, to: 290, sweep: 0.03, decay: 0.05, level: 0.3 },
  { noise: "bandpass", freq: 1500, q: 0.9, decay: 0.07, level: 0.45 },
  { noise: "lowpass", freq: 3000, q: 0.7, decay: 0.035, level: 0.22 },
  { noise: "bandpass", freq: 2600, q: 1.2, decay: 0.035, level: 0.5 },
] as const;
/** A softer, rounder snare for the deep and slow tracks. */
const SNARE_SOFT = [
  { tone: "triangle", freq: 180, to: 158, sweep: 0.05, decay: 0.14, level: 0.85 },
  { tone: "triangle", freq: 310, to: 275, sweep: 0.03, decay: 0.05, level: 0.25 },
  { noise: "bandpass", freq: 1300, q: 0.9, decay: 0.07, level: 0.4 },
  { noise: "lowpass", freq: 2600, q: 0.7, decay: 0.03, level: 0.2 },
] as const;
const GHOST = [
  { tone: "triangle", freq: 480, to: 430, decay: 0.025, level: 0.55 },
  { noise: "bandpass", freq: 2100, q: 1, decay: 0.025, level: 0.35 },
] as const;
const HAT = { hp: 6500, decay: 0.024, metal: 0.04, q: 0.8, level: 0.58 };
const OPEN = { hp: 6200, decay: 0.11, metal: 0.04, q: 0.7, level: 0.45 };
const SHAKER = { freq: 6400, q: 1.1, decay: 0.035, attack: 0.008, level: 0.2, off: 0.12 };
const KICK = { start: 130, end: 47, sweep: 0.045, decay: 0.32, click: 0.06, clickHp: 2600, drive: 0.5, body: 1.15 };
const FOUR = { lo: [[0, 4, 8, 12]], mid: [[0, 4, 8, 12]], hi: [[0, 4, 8, 12]] };
const VOWELS = [[820, 1220], [520, 880], [580, 1750], [420, 820], [650, 1550]] as const;
const KIT = { kick: KICK, snare: SNARE, ghost: GHOST, hat: HAT, shaker: SHAKER, open: OPEN };
const KIT_SOFT = { ...KIT, snare: SNARE_SOFT };

/** A chord: its bass (over the tonic) and its stab voicing (pad tones over the tonic's voicing note). */
const ch = (bass: number, pad: number[]) => ({ bass, pad, guide: (((pad[1] % 12) + 12) % 12) + 12, dark: [bass, bass + 7, bass + 15] });

/** One stab hit / bass note / motif note (two-bar figures, 32 16ths). */
const st = (s: number, len: number, vel: number, core = true) => ({ s, len, vel, core });
const bn = (s: number, len: number, semi: number, vel: number, glide = false, core = true) => ({ s, len, semi, vel, core, ...(glide ? { glide: true } : {}) });
const mo = (s: number, len: number, tone: number, oct = 0, core = true) => ({ s, len, tone, core, ...(oct ? { oct } : {}) });

/** The voice-free defaults every track shares (the v1 slots the v2 voices take over are given their levels). */
const COMMON = {
  bars: 2,
  turn: 0,
  vary: 1,
  pump: 1,
  rolls: 0,
  impact: 0,
  stab: { level: 0 },
  mid: { level: 0 },
  midEarly: 1,
  lead: { level: 0 },
  sub: { level: 0.6, attack: 0.004, decay: 0.35, sustain: 0.6, release: 0.06, drive: 0.4, glide: 0.06 },
  bass2: { kind: "pluck", level: 1, cutoff: 650, env: 0.4, decay: 0.25, sustain: 0.4, release: 0.06, drive: 1, top: 0.2, hp: 85 },
  drums: { kick: 0.85, knock: 0.6, click: 0.5, kickDecay: 0.34, clap: 0, shaker: 0, ride: 0, crash: 0, conga: 0, toms: 0 },
  bus: { tape: 1, mix: 0.4, exciter: 0.4, width: 0.4, drums: 1.2, mud: 2 },
} as const;

const FX = {
  echo: { steps: 3, taps: 3, fb: 0.35, lp: 3000, hp: 500 },
  echoSend: { kick: 0, bass: 0, snare: 0.03, perc: 0.1, lead: 0.15, harm: 0.05, fx: 0.5 },
  space: { size: 0.8, fb: 0.5, lp: 5000 },
  spaceSend: { kick: 0, bass: 0, snare: 0.06, hat: 0.03, perc: 0.12, lead: 0.1, harm: 0.06, tex: 0, fx: 0.25 },
  drumLp: 13500,
  drive: 1.05,
  pressDrive: 0.08,
  duck: { bass: 0.55, harm: 0.6 },
  duckTime: { bass: 0.14, harm: 0.2 },
  master: { lp: 14500 },
};

export default {
  key: "synth-v2-tracks",
  name: "Synth v2 Tracks",
  genres: ["futuregarage"],
  styles: {
    futuregarage: [
      // 1. Club rally house (125, G minor). The physical Rhodes comps with a wide velocity range (0.35 .. 1: the soft
      // hits round, the hard ones bark), its short hits become resampled chord chops in the build, drop and rebuild;
      // a ladder bass that moves (octaves, fifths, glides, its filter opening with each accent); the analog pad only in
      // the breakdown and rebuild; the diva as rare chops on 9ths.
      {
        id: "v2-pit-lane",
        name: "Pit Lane",
        base: "classic",
        bpm: [125, 125],
        swing: 0.61,
        microScale: 0.3,
        riser: 0,
        data: {
          chords: [ch(0, [3, 7, 10, 14]), ch(8, [0, 3, 7, 10]), ch(5, [-4, 0, 3, 7]), ch(7, [-2, 0, 2, 5])],
          progressions: [[0, 1, 0, 2], [0, 1, 2, 3]],
          kicks: FOUR,
          skips: [[[7, 0.3], [15, 0.22], [23, 0.3], [29, 0.3]]],
          stabs: [
            [st(0, 3, 0.95), st(3, 1, 0.4), st(6, 1, 0.75), st(8, 2, 0.55), st(11, 1, 0.9), st(14, 2, 0.5), st(18, 1, 0.8), st(22, 3, 1), st(27, 1, 0.45, false), st(30, 1, 0.7)],
            [st(0, 2, 0.9), st(2, 1, 0.5), st(6, 4, 0.7), st(11, 1, 0.95), st(16, 3, 0.6), st(19, 1, 0.85), st(22, 1, 0.45), st(24, 4, 1), st(30, 1, 0.6)],
          ],
          basslines: [
            [bn(0, 1.5, 0, 1), bn(3, 0.5, 12, 0.55), bn(6, 1, 0, 0.85), bn(8, 0.5, 7, 0.5, false, false), bn(10, 1, 12, 0.9), bn(13, 1, 7, 0.7), bn(14, 1.5, 12, 0.8, true), bn(16, 1.5, 0, 1), bn(19, 1, 7, 0.75), bn(22, 1, 12, 0.95), bn(24, 0.5, 0, 0.5, false, false), bn(26, 1, 7, 0.8), bn(28, 1, 12, 0.7), bn(30, 1.5, -5, 0.75, true)],
            [bn(0, 2, 0, 1), bn(3, 0.5, 0, 0.5), bn(6, 1, 12, 0.85), bn(7, 1, 7, 0.65, true), bn(10, 1.5, 0, 0.9), bn(13, 1, 12, 0.8), bn(16, 2, 0, 1), bn(19, 0.5, 12, 0.55), bn(22, 1, 7, 0.85), bn(23, 1, 12, 0.7, true), bn(26, 1.5, 0, 0.9), bn(29, 1, -5, 0.7), bn(30, 1, 0, 0.6)],
          ],
          calls: [[{ s: 14, len: 2, vowel: 1, to: 0, tone: 3, core: true }], [{ s: 27, len: 1, vowel: 2, tone: 1, rep: 1, core: true }]],
          vowels: VOWELS,
          ukg: {
            ...COMMON,
            keys: [7],
            ep: { level: 1.15 },
            bed: { kind: "organ", level: 0.55, in: ["breakdown", "rebuild"], cutoff: 1500, lfoBars: 8, lfoDepth: 0.3, attack: 0.5, release: 0.9, octave: 0, width: 0.7, ensemble: 0.5 },
            pluck: { level: 0 },
            vox: { level: 1 },
            voc: { level: 1.2, scoop: -1, scoopSec: 0.05, vibrato: 14, breath: 0.2, consonant: 0.4, release: 0.08, presence: 3, duck: 0.3 },
            chop: { in: ["full", "rebuild"], alt: 0, every: 2 },
            groove: { hatLate: 0.06, percLate: 0.08, jitter: 0.5, ghost: 0.6, perc: 0, open: 0, offOpen: 0, tamb: 0, ghostKick: 0, metal: 0 },
            lanes: { hat: "..6...8...6.....6...8...5.7.8...", shaker: "5..3.7..4.3.7...5..3.7..4.3.7.3.", open: "..............4...............5.", rim: "" },
            breaks: { level: 0.85, in: ["breakdown"], alt: 0, every: 8, from: 12, fillKick: "", fillSnare: "............6..8", fillGhost: ".............4..", fillHat: "............3.3." },
            filter: { on: 1, lo: 500, hi: 14000, q: 0.9, bars: 16, depth: 0.25 },
            psx: { bits: 12, rate: 22050, drive: 0.5, lp: 12500, harm: 0.3, lead: 0.3, drums: 0.3 },
            hall: { level: 0.15, decay: 1.5, lp: 4800, hp: 400, pre: 0.02, harm: 0.12, lead: 0.12, snare: 0.05, fx: 0.3 },
            v2: {
              keys: { level: 1, voice: "rhodes", alive: { velBright: 0.9 } },
              chop: { level: 1, voice: "chop", max: 1, in: ["build", "full", "rebuild"] },
              bass: { level: 1, voice: "ladderBass", p: { cutoff: 480, res: 0.35, fd: 0.2, env: 3 } },
              pad: { level: 1, voice: "analogPad", p: { cutoff: 600, fa: 1.2, env: 1.5 } },
            },
          },
          kit: KIT,
          vinyl: 0,
          mix: { kick: 0, bass: 0.5 },
          fx: FX,
        },
      },
      // 2. Garage (132, E Dorian, Em9 - A9 a bar each). The FM organ stab carries it (buzz, a 2:1 growl, a 3:1
      // percussion; velocity drives the index), every short skippy hit a resampled chop; 2-step kicks, skippy ghosts,
      // a rolling ladder bass, diva stutters.
      {
        id: "v2-overtake",
        name: "Overtake",
        base: "classic",
        bpm: [132, 132],
        swing: 0.6,
        microScale: 0.25,
        trim: 1.08,
        riser: 0,
        data: {
          chords: [ch(0, [-9, -5, -2, 2]), ch(5, [-3, 0, 3, 7]), ch(3, [-5, -2, 2, 5]), ch(10, [-7, -3, 2, 5])],
          progressions: [[0, 1, 0, 1], [0, 1, 2, 3]],
          skips: [[[3, 0.3], [7, 0.35], [14, 0.25], [19, 0.3], [23, 0.35], [27, 0.25], [30, 0.3]]],
          stabs: [
            [st(0, 1.5, 0.9), st(3, 0.75, 0.55), st(6, 1, 0.85), st(10, 0.75, 0.6), st(14, 1.5, 0.9), st(16, 1, 0.8), st(19, 0.75, 0.5, false), st(22, 1.5, 0.95), st(26, 0.75, 0.6), st(29, 1, 0.75)],
            [st(2, 1.5, 0.85), st(6, 0.75, 0.55), st(8, 1, 0.8), st(11, 0.75, 0.6), st(14, 2, 0.9), st(18, 1.5, 0.85), st(21, 0.75, 0.5), st(24, 1, 0.8), st(27, 0.75, 0.55, false), st(30, 1.5, 0.9)],
          ],
          basslines: [
            [bn(0, 1, 0, 1), bn(2, 0.5, 12, 0.6), bn(4, 1, 7, 0.75), bn(7, 1.5, 0, 0.9), bn(10, 1, 12, 0.8), bn(12, 0.5, 7, 0.55), bn(14, 1.5, 0, 0.9, true), bn(16, 1, 0, 1), bn(19, 1, 12, 0.75), bn(22, 1.5, 7, 0.85), bn(25, 1, 0, 0.8), bn(28, 1, 12, 0.7), bn(30, 1, -5, 0.75, true)],
            [bn(0, 1.5, 0, 1), bn(3, 1, 12, 0.7), bn(6, 1, 0, 0.85), bn(8, 0.5, 7, 0.5), bn(10, 1.5, 0, 0.9), bn(13, 1, 12, 0.75, true), bn(16, 1, 0, 1), bn(18, 1, 7, 0.7), bn(20, 1, 12, 0.8), bn(23, 1.5, 0, 0.85), bn(26, 1, 7, 0.75), bn(29, 1, 12, 0.7, true)],
          ],
          calls: [[{ s: 6, len: 0.75, vowel: 0, tone: 3, rep: 2, core: true }, { s: 22, len: 1, vowel: 2, tone: 2, core: true }], [{ s: 14, len: 1, vowel: 4, tone: 1, rep: 1, core: true }]],
          vowels: VOWELS,
          ukg: {
            ...COMMON,
            keys: [4],
            scale: "dorian",
            bars: 1,
            m1: { level: 1.2, octave: 0, cutoff: 4400, drive: 1.8, click: 0.6, decay: 0.2, sustain: 0.15, release: 0.12 },
            bed: { kind: "juno", level: 0.45, in: ["breakdown"], cutoff: 2000, lfoBars: 8, lfoDepth: 0.3, attack: 0.6, release: 1, octave: 0, width: 0.6, ensemble: 0.5 },
            pluck: { level: 0 },
            vox: { level: 1 },
            voc: { level: 1.2, scoop: -1, scoopSec: 0.05, vibrato: 14, breath: 0.2, consonant: 0.45, release: 0.08, presence: 3, duck: 0.3 },
            chop: { in: ["build", "full", "rebuild"], alt: 0, every: 2 },
            groove: { hatLate: 0.07, percLate: 0.09, jitter: 0.5, ghost: 0.7, perc: 0, open: 0, offOpen: 0, tamb: 0, ghostKick: 0.6, metal: 0 },
            lanes: { hat: "....7...6...8.....6.7...8...6...", shaker: "..5...5..4..5...5...5..4..5...4.", open: "..............5...............4.", rim: "...........7..........6.....7..." },
            breaks: { level: 0.85, in: ["breakdown"], alt: 0, every: 8, from: 12, fillKick: "", fillSnare: "............5.68", fillGhost: "............4...", fillHat: "" },
            drums: { ...COMMON.drums, conga: 0.25 },
            filter: { on: 1, lo: 450, hi: 13500, q: 1, bars: 16, depth: 0.25 },
            psx: { bits: 12, rate: 22050, drive: 0.5, lp: 12000, harm: 0.35, lead: 0.3, drums: 0.3 },
            hall: { level: 0.12, decay: 1.4, lp: 4500, hp: 400, pre: 0.02, harm: 0.1, lead: 0.12, snare: 0.05, fx: 0.3 },
            v2: {
              organ: { level: 1, voice: "fmOrgan" },
              chop: { level: 1, voice: "chop", max: 0.75, in: ["build", "full", "rebuild"], p: { lp: 8000 } },
              bass: { level: 1, voice: "ladderBass", p: { cutoff: 420, res: 0.4, env: 3.2, fd: 0.16 } },
              pad: { level: 1, voice: "analogPad" },
            },
          },
          kit: KIT,
          vinyl: 0,
          mix: { kick: 0, bass: 0.6 },
          fx: { ...FX, echoSend: { ...FX.echoSend, harm: 0.15 } },
        },
      },
      // 3. Deep, late night (121, D Dorian, Dm9 - G13, then Fmaj9 - Em7). The morph pad holds every chord and moves
      // inside it (dark to vowel and back), the FM e-piano comps on top (its tine bark rising with velocity), a mallet
      // answers on chord tones (a tuned bar), a round ladder bass. No diva, no PSX: clean and deep.
      {
        id: "v2-after-hours",
        name: "After Hours",
        base: "classic",
        bpm: [121, 121],
        swing: 0.62,
        microScale: 0.3,
        riser: 0,
        data: {
          chords: [ch(0, [-9, -5, -2, 2]), ch(5, [-9, -5, -3, 2]), ch(3, [-5, -2, 2, 5]), ch(2, [-7, -3, 0, 2])],
          progressions: [[0, 1, 0, 1], [0, 1, 2, 3]],
          kicks: FOUR,
          skips: [[[15, 0.2], [31, 0.25]]],
          stabs: [
            [st(3, 1.5, 0.7), st(10, 1, 0.5), st(14, 2, 0.85), st(22, 1.5, 0.65), st(27, 1, 0.45, false)],
            [st(2, 2, 0.8), st(7, 1, 0.45), st(12, 1.5, 0.6), st(18, 2, 0.9), st(26, 1.5, 0.55)],
          ],
          basslines: [
            [bn(0, 3, 0, 1), bn(6, 1, 0, 0.7), bn(7, 1.5, 12, 0.75, true), bn(10, 2, 0, 0.85), bn(16, 3, 0, 1), bn(22, 1, 7, 0.75), bn(26, 2, 0, 0.85), bn(30, 1, 12, 0.6, false, false)],
            [bn(2, 2, 0, 1), bn(6, 1, 12, 0.75), bn(10, 2, 0, 0.9), bn(13, 1, -5, 0.6, true), bn(18, 2, 0, 1), bn(22, 1, 12, 0.75), bn(26, 2, 7, 0.8), bn(29, 1.5, 0, 0.65, true)],
          ],
          motifs: [
            [mo(4, 1, 3), mo(6, 1, 2), mo(9, 2, 1), mo(20, 1, 3), mo(22, 1, 2), mo(25, 1, 3, 0, false), mo(26, 2, 0)],
            [mo(2, 1, 1), mo(5, 1, 2), mo(8, 2, 3), mo(18, 1, 2), mo(21, 1, 1), mo(24, 3, 0)],
          ],
          calls: [[{ s: 28, len: 3, vowel: 3, to: 1, tone: 2, core: true }]],
          vowels: VOWELS,
          ukg: {
            ...COMMON,
            keys: [2],
            scale: "dorian",
            ep: { level: 1 },
            bed: { kind: "organ", level: 0.5, in: [], cutoff: 1800, lfoBars: 16, lfoDepth: 0.3, attack: 0.8, release: 1.2, octave: 0, width: 0.8, ensemble: 0.5 },
            pluck: { level: 0.8, wave: "triangle", cutoff: 2600, env: 0.5, decay: 0.22, release: 0.15, bend: 0, pan: 0.6 },
            vox: { level: 0 },
            voc: { level: 0 },
            groove: { hatLate: 0.08, percLate: 0.1, jitter: 0.5, ghost: 0.5, perc: 0, open: 0, offOpen: 0, tamb: 0, ghostKick: 0, metal: 0 },
            lanes: { hat: "....6.......7.......6.......7.5.", shaker: "..4...4...4..34...4...4...4...3.", open: "..4.......4.......4.......4.....", rim: "...........7..........6.....7..." },
            breaks: { level: 0.8, in: ["breakdown"], alt: 0, every: 8, from: 12, fillKick: "", fillSnare: "............4..6", fillGhost: "..............3.", fillHat: "" },
            drums: { ...COMMON.drums, kick: 0.82, knock: 0.5, click: 0.4, kickDecay: 0.38 },
            filter: { on: 1, lo: 400, hi: 13000, q: 0.9, bars: 16, depth: 0.2 },
            hall: { level: 0.12, decay: 1.8, lp: 4200, hp: 400, pre: 0.02, harm: 0.08, lead: 0.15, snare: 0.04, fx: 0.3 },
            v2: {
              keys: { level: 1, voice: "fmEp" },
              pad: { level: 1, voice: "morphPad", p: { posEnv: 0.6, pa: 1.6, pd: 3, lfo: 0.08, cutoff: 2200 } },
              motif: { level: 1, voice: "mallet", in: ["build", "full", "rebuild"] },
              bass: { level: 1, voice: "ladderBass", p: { cutoff: 240, res: 0.2, env: 1.6, wave: 0, fd: 0.3 } },
            },
          },
          kit: KIT_SOFT,
          vinyl: 0,
          mix: { kick: 0, bass: 0.8 },
          fx: { ...FX, echoSend: { ...FX.echoSend, lead: 0.25 } },
        },
      },
      // 4. Dark, acid / electro leaning (128, F# Phrygian, F#m7 - Gmaj7 the flat second). The diode bass carries it: a
      // dense line on roots, fifths and octaves whose accents open the filter and squelch, glides between octaves; dark
      // chord chops are the only chords (few, short, filtered); the analog pad only in the breakdown. No diva.
      {
        id: "v2-diode-line",
        name: "Diode Line",
        base: "classic",
        bpm: [128, 128],
        swing: 0.56,
        microScale: 0.2,
        trim: 0.8,
        riser: 0,
        data: {
          chords: [ch(0, [0, 3, 7, 10]), ch(1, [1, 5, 8, 12])],
          progressions: [[0, 0, 0, 1], [0, 0, 1, 0]],
          kicks: FOUR,
          skips: [[[7, 0.25], [23, 0.3], [30, 0.25]]],
          stabs: [
            [st(3, 0.75, 0.8), st(11, 0.5, 0.55), st(19, 0.75, 0.85), st(26, 0.75, 0.6, false)],
            [st(6, 0.75, 0.75), st(14, 0.5, 0.6), st(22, 0.75, 0.9), st(30, 0.5, 0.5, false)],
          ],
          basslines: [
            [bn(0, 1, 0, 1), bn(2, 0.5, 0, 0.5), bn(3, 0.5, 12, 0.9), bn(4, 1, 0, 0.6), bn(6, 0.5, 7, 0.85), bn(7, 0.5, 0, 0.5), bn(8, 1, 0, 0.7), bn(10, 0.5, 12, 1, true), bn(11, 0.5, 0, 0.55), bn(12, 1, 7, 0.75), bn(14, 1, 12, 0.95, true),
              bn(16, 1, 0, 1), bn(18, 0.5, 0, 0.5), bn(19, 0.5, 12, 0.9), bn(20, 1, 0, 0.6), bn(22, 0.5, -5, 0.85), bn(23, 0.5, 0, 0.6, true), bn(24, 1, 0, 0.7), bn(26, 0.5, 12, 1), bn(27, 0.5, 7, 0.6), bn(28, 1, 0, 0.75), bn(30, 1, 12, 0.95, true)],
            [bn(0, 1.5, 0, 1), bn(3, 0.5, 0, 0.6), bn(4, 0.5, 12, 0.95, true), bn(5, 0.5, 0, 0.5), bn(6, 1, 7, 0.8), bn(8, 0.5, 0, 0.6), bn(9, 0.5, 12, 0.9), bn(10, 1, 0, 0.7), bn(12, 0.5, -5, 0.85), bn(13, 0.5, 0, 0.55, true), bn(14, 1, 12, 1),
              bn(16, 1.5, 0, 1), bn(19, 0.5, 12, 0.95, true), bn(20, 0.5, 0, 0.55), bn(22, 1, 7, 0.8), bn(24, 0.5, 0, 0.6), bn(25, 0.5, 12, 0.9), bn(26, 1, 0, 0.7), bn(28, 0.5, 7, 0.85), bn(29, 0.5, 12, 0.6, true), bn(30, 1, 0, 0.9)],
          ],
          calls: [[{ s: 28, len: 2, vowel: 3, tone: 1, core: true }]],
          vowels: VOWELS,
          ukg: {
            ...COMMON,
            keys: [6],
            scale: "phrygian",
            pump: 1,
            m1: { level: 0 },
            ep: { level: 0 },
            bed: { kind: "juno", level: 0.4, in: ["breakdown", "rebuild"], cutoff: 1500, lfoBars: 8, lfoDepth: 0.3, attack: 0.8, release: 1, octave: 0, width: 0.6, ensemble: 0.4 },
            sub: { level: 0.5, attack: 0.004, decay: 0.3, sustain: 0.55, release: 0.05, drive: 0.5, glide: 0.05 },
            pluck: { level: 0 },
            vox: { level: 0 },
            voc: { level: 0 },
            groove: { hatLate: 0.04, percLate: 0.06, jitter: 0.4, ghost: 0.5, perc: 0, open: 0, offOpen: 0, tamb: 0, ghostKick: 0, metal: 0 },
            lanes: { hat: "..7...6...7.....5...7...6...7...", shaker: "", open: "..............5...............5.", rim: "......6...............6........." },
            breaks: { level: 0.8, in: ["breakdown"], alt: 0, every: 8, from: 12, fillKick: "", fillSnare: "............5..7", fillGhost: "..............4.", fillHat: "" },
            drums: { ...COMMON.drums, kick: 0.9, knock: 0.7, click: 0.55 },
            filter: { on: 1, lo: 350, hi: 9000, q: 1.1, bars: 16, depth: 0.3 },
            psx: { bits: 12, rate: 22050, drive: 0.6, lp: 11000, harm: 0.3, lead: 0, drums: 0.25 },
            v2: {
              chop: { level: 1, voice: "chop", max: 1, in: ["build", "full", "breakdown", "rebuild"], p: { lp: 4200, rate: 22050, bits: 10 } },
              bass: { level: 0.85, voice: "diodeBass", p: { cutoff: 260, res: 0.72, env: 3.4, fd: 0.17, drive: 1.8 } },
              pad: { level: 1, voice: "analogPad", p: { cutoff: 420, res: 0.3, env: 1.8, fa: 2 } },
            },
          },
          kit: { ...KIT, snare: SNARE },
          vinyl: 0,
          mix: { kick: 0, bass: 0.7 },
          fx: { ...FX, echoSend: { ...FX.echoSend, harm: 0.2 }, master: { lp: 13000 }, drumLp: 12000 },
        },
      },
      // 5. Slow and lush (120, the renderer's lowest tempo, B minor, Bm9 - Gmaj9 - Em9 - F#m7). A laid-back two-step
      // (kick on the one and the "and" of three), long Rhodes chords doubled by a quiet tuned FM bell (integer ratios:
      // every partial a harmonic of its chord tone), a waveguide pluck answering on chord tones, the analog pad under
      // everything, a soft ladder bass, a rare diva "ooh".
      {
        id: "v2-slow-bloom",
        name: "Slow Bloom",
        base: "classic",
        bpm: [120, 120],
        swing: 0.62,
        microScale: 0.35,
        riser: 0,
        data: {
          chords: [ch(0, [-9, -5, -2, 2]), ch(8, [-9, -5, -2, 0]), ch(5, [-4, 0, 3, 7]), ch(7, [-2, 2, 5, 7])],
          progressions: [[0, 1, 2, 3], [0, 1, 0, 3]],
          kicks: { lo: [[0, 10]], mid: [[0, 10]], hi: [[0, 10], [0, 7, 10]] },
          skips: [[[15, 0.2], [31, 0.25]]],
          stabs: [
            [st(0, 6, 0.8), st(10, 2, 0.5), st(14, 2, 0.65), st(22, 6, 0.75), st(30, 1, 0.4, false)],
            [st(2, 5, 0.75), st(8, 2, 0.45), st(18, 6, 0.85), st(28, 2, 0.5)],
          ],
          basslines: [
            [bn(0, 4, 0, 1), bn(6, 1, 12, 0.6), bn(10, 2, 7, 0.75), bn(16, 4, 0, 0.95), bn(22, 1, 12, 0.6), bn(26, 2, 0, 0.75, true)],
            [bn(0, 3, 0, 1), bn(4, 1, 7, 0.6), bn(10, 2, 0, 0.8), bn(14, 1, 12, 0.55, true), bn(16, 4, 0, 1), bn(26, 2, 7, 0.7)],
          ],
          motifs: [
            [mo(4, 1.5, 2), mo(7, 1, 3), mo(12, 2, 1), mo(20, 1.5, 3), mo(23, 1, 2), mo(28, 3, 0)],
            [mo(3, 1, 1), mo(5, 1, 2), mo(8, 2, 3), mo(19, 1, 2), mo(21, 1, 1), mo(24, 3, 0)],
          ],
          calls: [[{ s: 28, len: 3, vowel: 3, to: 1, tone: 3, core: true }], [{ s: 12, len: 2, vowel: 1, to: 0, tone: 3, core: true }]],
          vowels: VOWELS,
          ukg: {
            ...COMMON,
            keys: [11],
            ep: { level: 1.1 },
            m1: { level: 0.4, octave: 12, cutoff: 3000, drive: 0.5, click: 0, decay: 0.3, sustain: 0.2, release: 0.2 },
            bed: { kind: "juno", level: 0.45, in: [], cutoff: 1800, lfoBars: 16, lfoDepth: 0.3, attack: 1.2, release: 1.5, octave: 0, width: 0.8, ensemble: 0.6 },
            sub: { level: 0.55, attack: 0.006, decay: 0.5, sustain: 0.7, release: 0.1, drive: 0.3, glide: 0.08 },
            pluck: { level: 0.75, wave: "triangle", cutoff: 2600, env: 0.5, decay: 0.22, release: 0.15, bend: 0, pan: 0.55 },
            vox: { level: 1 },
            voc: { level: 1, scoop: -1.5, scoopSec: 0.07, vibrato: 18, breath: 0.25, consonant: 0.25, release: 0.15, presence: 2, duck: 0.2 },
            chop: { in: ["full"], alt: 0, every: 4 },
            groove: { hatLate: 0.09, percLate: 0.1, jitter: 0.5, ghost: 0.45, perc: 0, open: 0, offOpen: 0, tamb: 0, ghostKick: 0, metal: 0 },
            lanes: { hat: "......6.........7.......5.......", shaker: "..4.....4...3...4.....4...4.....", open: "..............4.................", rim: "...........6..............5....." },
            breaks: { level: 0.75, in: ["breakdown"], alt: 0, every: 8, from: 12, fillKick: "", fillSnare: "............4..5", fillGhost: "", fillHat: "" },
            drums: { ...COMMON.drums, kick: 0.8, knock: 0.45, click: 0.35, kickDecay: 0.4 },
            filter: { on: 1, lo: 450, hi: 12000, q: 0.8, bars: 16, depth: 0.2 },
            hall: { level: 0.15, decay: 2, lp: 4000, hp: 350, pre: 0.025, harm: 0.1, lead: 0.15, snare: 0.04, fx: 0.3 },
            v2: {
              keys: { level: 1, voice: "rhodes", p: { bright: 6000, pickup: 0.5, damp: 0.25 } },
              organ: { level: 1, voice: "bell", octave: 12 },
              motif: { level: 1, voice: "pluck", in: ["build", "full", "rebuild"], p: { bright: 0.4, decay: 2.2 } },
              pad: { level: 1, voice: "analogPad", p: { cutoff: 650, fa: 1.5 } },
              bass: { level: 1, voice: "ladderBass", p: { cutoff: 220, res: 0.2, env: 1.4, wave: 0, fd: 0.35 } },
            },
          },
          kit: KIT_SOFT,
          vinyl: 0,
          mix: { kick: 0, bass: 0.8 },
          fx: { ...FX, echoSend: { ...FX.echoSend, lead: 0.25 } },
        },
      },
      // 6. My pick: 2-step night garage (134, C minor, Cm9 - Abmaj9 - Fm9 - Gm7). The DX7 e-piano stabs barking on the
      // hard hits, the chop on the short skips, a mallet motif on chord tones, and the FM bass (a 4-operator stack with
      // a feedback top: the index snaps down after each attack) in place of an analog bass.
      {
        id: "v2-night-bus",
        name: "Night Bus",
        base: "classic",
        bpm: [134, 134],
        swing: 0.6,
        microScale: 0.25,
        riser: 0,
        data: {
          chords: [ch(0, [-9, -5, -2, 2]), ch(8, [-9, -5, -2, 0]), ch(5, [-4, 0, 3, 7]), ch(7, [-2, 2, 5, 7])],
          progressions: [[0, 1, 0, 1], [0, 1, 2, 3]],
          skips: [[[3, 0.3], [7, 0.35], [11, 0.2], [19, 0.3], [23, 0.35], [27, 0.25], [30, 0.3]]],
          stabs: [
            [st(0, 1, 1), st(3, 0.75, 0.5), st(6, 1.5, 0.8), st(10, 0.75, 0.55), st(14, 1, 0.95), st(18, 1.5, 0.7), st(22, 0.75, 0.5), st(24, 1, 0.9), st(27, 0.75, 0.45, false), st(30, 1, 0.75)],
            [st(2, 1.5, 0.9), st(6, 0.75, 0.5), st(8, 1, 0.8), st(13, 0.75, 0.6), st(16, 1.5, 1), st(20, 0.75, 0.5), st(22, 1, 0.85), st(26, 0.75, 0.55), st(28, 1.5, 0.8)],
          ],
          basslines: [
            [bn(0, 1, 0, 1), bn(3, 1, 12, 0.7), bn(6, 1, 0, 0.85), bn(10, 1.5, 7, 0.8), bn(13, 1, 12, 0.7, true), bn(16, 1, 0, 1), bn(19, 1, 0, 0.6), bn(22, 1.5, 12, 0.85), bn(26, 1, 7, 0.75), bn(29, 1, 0, 0.8, true)],
            [bn(0, 1.5, 0, 1), bn(4, 0.5, 12, 0.6), bn(7, 1, 7, 0.8), bn(10, 1, 0, 0.85), bn(14, 1, 12, 0.75, true), bn(16, 1.5, 0, 1), bn(20, 1, 7, 0.7), bn(22, 1, 12, 0.85), bn(25, 1, 0, 0.75), bn(28, 1.5, -5, 0.8, true)],
          ],
          motifs: [
            [mo(4, 1, 3), mo(5, 1, 2), mo(9, 1.5, 3), mo(20, 1, 1), mo(21, 1, 2), mo(25, 1.5, 0)],
            [mo(2, 1, 2), mo(4, 1, 3), mo(11, 2, 1), mo(18, 1, 3), mo(20, 1, 2), mo(27, 2, 0)],
          ],
          calls: [[{ s: 6, len: 0.75, vowel: 0, tone: 3, rep: 2, core: true }], [{ s: 30, len: 1, vowel: 2, tone: 3, core: true }]],
          vowels: VOWELS,
          ukg: {
            ...COMMON,
            keys: [0],
            bars: 1,
            ep: { level: 1.1 },
            bed: { kind: "juno", level: 0.4, in: ["breakdown", "rebuild"], cutoff: 1800, lfoBars: 8, lfoDepth: 0.3, attack: 0.6, release: 1, octave: 0, width: 0.6, ensemble: 0.5 },
            pluck: { level: 0.7, wave: "triangle", cutoff: 2600, env: 0.5, decay: 0.22, release: 0.15, bend: 0, pan: 0.6 },
            vox: { level: 1 },
            voc: { level: 1.1, scoop: -1, scoopSec: 0.05, vibrato: 14, breath: 0.2, consonant: 0.45, release: 0.08, presence: 3, duck: 0.3 },
            chop: { in: ["build", "full"], alt: 0, every: 2 },
            groove: { hatLate: 0.07, percLate: 0.09, jitter: 0.5, ghost: 0.7, perc: 0, open: 0, offOpen: 0, tamb: 0, ghostKick: 0.5, metal: 0 },
            lanes: { hat: "..6...7.....6...8...6.....7.....", shaker: "..5...4...5..4....5...4...5...4.", open: "..............5.................", rim: "...........7..........6........." },
            breaks: { level: 0.85, in: ["breakdown"], alt: 0, every: 8, from: 12, fillKick: "", fillSnare: "............5.68", fillGhost: "............4...", fillHat: "" },
            filter: { on: 1, lo: 450, hi: 13500, q: 1, bars: 16, depth: 0.25 },
            psx: { bits: 12, rate: 22050, drive: 0.5, lp: 12000, harm: 0.3, lead: 0.25, drums: 0.3 },
            hall: { level: 0.12, decay: 1.4, lp: 4500, hp: 400, pre: 0.02, harm: 0.1, lead: 0.12, snare: 0.05, fx: 0.3 },
            v2: {
              keys: { level: 1, voice: "fmEp", alive: { velBright: 0.9 } },
              chop: { level: 1, voice: "chop", max: 0.75, in: ["full", "rebuild"] },
              motif: { level: 1, voice: "mallet", in: ["full", "rebuild"] },
              bass: { level: 1, voice: "fmBass" },
              pad: { level: 1, voice: "morphPad", p: { cutoff: 1800 } },
            },
          },
          kit: KIT,
          vinyl: 0,
          mix: { kick: 0, bass: 0.6 },
          fx: FX,
        },
      },
    ],
  },
} as StationPack;
