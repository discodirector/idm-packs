import type { StationPack, StationStyle } from "../pack.ts";
import "../voices/catalog.ts";
import { NEW_LIBRARY_BY_ID } from "../voices/new/catalog.ts";
import { registerVoices } from "../voices/registry.ts";
import rallyHouse from "./rally-house.ts";
import v2Tracks from "./synth-v2-tracks.ts";

/**
 * Rally House phase 0 (docs/sound/RALLY-HOUSE-2.md): does mix, tempo and groove alone move our sound from "kids'
 * matinee / polite house" toward street club? No new voices. Two existing tracks, each patched with ONLY these opt-in
 * changes (`ukg.street`, `sub.h2` and existing fields):
 *   1. tilt   a low-mid cut on the keys / harmony bus (-8 dB at 280 Hz) and a high shelf (+7 dB over 2.5 kHz), the
 *             bus exciter up; master
 *             lowpass at 18 kHz, drum lowpass at 16 kHz, the PSX reconstruction lowpass at 15 kHz and no PSX on drums;
 *   2. density a soft clipper on the drums and on the master, parallel saturation on the keys (crest toward 10-11 dB);
 *   3. tempo  138-139;
 *   4. groove a skippy 16th shaker lane (accents on the "e" and the "a", short decay) on the style's swing (MPC ~55%);
 *             hats stay sparse;
 *   5. sub    a rubber sub: sine + its octave (h2), a 2-semitone drop into every note over 45 ms, louder; the layered
 *             bass over it quieter (the 120-500 Hz build-up).
 * And a third "street" Pit Lane: drums and sub forward, the chords as short gritty chops only (no comping, no pad), the
 * diva rarer, the kick punchier and clipped harder.
 *
 * The A/B renders apply PHASE0 / STREET as patches to the original packs' styles (web/scripts/synth-v2/render.mjs
 * `patch`), so the epochs, tonics and figure picks stay the same as the originals. The default export is the same
 * three styles as a pack of their own for the Style Lab (its epochs differ from the originals). On no station.
 */

/** A 32-step soft 16th shaker: the "e" and the "a" up (the skip), the beat soft, the offbeat medium. */
const SHAKER_16 = "37573757375737683757375737573768";

/** Phase 0, common to both tracks (a deep patch: objects merge field by field, lists replace). */
const PHASE0_COMMON = {
  data: {
    ukg: {
      street: { cut: 8, cutHz: 280, shelf: 8, shelfHz: 2000, lead: 6, sat: 0.35, clipDrums: 5, clipMaster: 3 },
      sub: { level: 0.95, decay: 0.25, sustain: 0.55, drive: 0.3, bend: 2, bendTime: 0.045, h2: 0.25 },
      bus: { exciter: 1 },
      lanes: { shaker: SHAKER_16 },
      psx: { lp: 15000, drums: 0 },
    },
    kit: { shaker: { freq: 7000, q: 1.2, decay: 0.026, attack: 0.004, level: 0.6, off: 0.6, offDecay: 0.03 } },
    fx: { drumLp: 16000, master: { lp: 18000 } },
  },
};

export const PHASE0: Record<string, Record<string, unknown>> = {
  "rally-replay": merge(PHASE0_COMMON, {
    bpm: [139, 139],
    // Replay's top was already the brightest of v1 (the M1 piano, a busy hat lane): without the drum PSX its hats
    // alone put 7.6% of the drop above 6 kHz. So: a gentler shelf, the hats and open hats lower, the drums under
    // 9.5 kHz, a quieter shaker: the top opens without fizz.
    data: {
      ukg: { bass2: { level: 0.3, hp: 140 }, street: { shelf: 4, lead: 3 }, bus: { exciter: 0.5 } },
      kit: { shaker: { level: 0.35, off: 0.35 }, hat: { level: 0.38 }, open: { level: 0.3 } },
      fx: { drumLp: 9500 },
    },
  }),
  "v2-pit-lane": merge(PHASE0_COMMON, {
    bpm: [138, 138],
    swing: 0.6,
    // The hats a step back so the shaker's skip reads (still the same sparse lane, lower).
    data: { ukg: { v2: { bass: { level: 0.4 } }, lanes: { hat: "..4...5...4.....4...5...3.5.5..." } } },
  }),
};

/** The street Pit Lane: phase 0 plus drums and sub forward, chords back as chops, nothing cute. */
export const STREET: Record<string, unknown> = merge(PHASE0["v2-pit-lane"], {
  data: {
    // Stabs, not comping: four or five short hits per two bars, all chops (max 1 16th).
    stabs: [
      [{ s: 3, len: 1, vel: 0.95, core: true }, { s: 10, len: 0.75, vel: 0.8, core: true }, { s: 19, len: 1, vel: 1, core: true }, { s: 26, len: 0.75, vel: 0.75, core: true }],
      [{ s: 2, len: 1, vel: 0.9, core: true }, { s: 11, len: 0.75, vel: 0.85, core: true }, { s: 18, len: 1, vel: 1, core: true }, { s: 27, len: 0.75, vel: 0.7, core: true }, { s: 30, len: 0.5, vel: 0.6, core: false }],
    ],
    ukg: {
      street: { sat: 0.6, clipDrums: 9, clipMaster: 5 },
      sub: { level: 1.1, h2: 0.35 },
      ep: { level: 0.85 },
      bed: { level: 0 },
      chop: { every: 4 },
      drums: { kick: 1, knock: 0.85, click: 0.8, kickDecay: 0.28 },
      v2: {
        chop: { level: 0.9, voice: "chop", max: 1, in: ["intro", "build", "full", "breakdown", "rebuild"], p: { bits: 10, rate: 22050, lp: 9000 } },
        bass: { level: 0.35 },
      },
    },
    mix: { kick: 0.3, bass: 0.5 },
  },
});

// ---- Phase 1 (docs/sound/RALLY-HOUSE-2.md "Phase 1"): composition, on top of phase 0's mix, de-harshed ----------

/** A two-bar figure that is one bar played twice (the loop repeats exactly: hypnotic, not a call and its answer). */
const twice = <T extends { s: number }>(bar: T[]): T[] => [...bar, ...bar.map((x) => ({ ...x, s: x.s + 16 }))];
const hit = (s: number, len: number, vel: number) => ({ s, len, vel, core: true });
const bass = (s: number, len: number, semi: number, vel: number) => ({ s, len, semi, vel, core: true });
const riff = (s: number, len: number, tone: number) => ({ s, len, tone, core: true });
/** A diva hook: one short static cut (a stutter before it), falling into the note, the same in both bars. */
const hook = (s: number, tone: number, vowel: number, rep: number) => [
  { s, len: 0.5, vowel, tone, rep, core: true },
  { s: s + 16, len: 0.5, vowel, tone, rep, core: true },
];

/**
 * De-harsh phase 0 ("the dry sound sometimes cuts"): the shelf moved up out of 2-5 kHz (4 dB over 4.5 kHz: air, not
 * bite), the lead shelf 2 dB, softer clipping, less parallel saturation; the diva's consonant burst and presence down,
 * the chops' attack 4 ms instead of 1.5. No reverb added (the styles' own small rooms are unchanged).
 */
const DEHARSH = {
  data: {
    ukg: {
      street: { shelf: 4, shelfHz: 4500, lead: 2, sat: 0.25, clipDrums: 3, clipMaster: 1.5 },
      voc: { consonant: 0.25, presence: 1.5, scoop: 1, scoopSec: 0.06 },
    },
  },
};

/**
 * Composition: one chord for 14 bars, a second for 2 (about one change per 8 bars, the references' 0.5..1 instead of
 * our 3.5..8); the tonic voiced rootless as a minor 11 without its 3rd (5th, 7th, 9th, 11th: the 11th on top); one-bar
 * figures played twice (the references repeat 0.97, ours 0.88..0.90); stabs on the off-16ths with space; the bass
 * stomping the offbeats with octave pushes; a 2-note riff (11th and 9th, mostly one pitch repeated) instead of a tune;
 * the diva as one short static stutter hook, falling into the note; no turnaround (turn 0), no table walking (vary 0).
 */
export const PHASE1: Record<string, Record<string, unknown>> = {
  "v2-pit-lane": merge(merge(PHASE0["v2-pit-lane"], DEHARSH), {
    data: {
      chords: [
        { bass: 0, pad: [-5, -2, 2, 5], guide: 14, dark: [0, 7, 15] }, // Gm11 rootless, no 3rd: D F A C
        { bass: 5, pad: [-4, 0, 3, 7], guide: 15, dark: [5, 12, 20] }, // Cm9 (iv): Eb G Bb D (darker than the Ebmaj9)
      ],
      progressions: [[0, 0, 0, 0, 0, 0, 0, 1]],
      stabs: [[hit(0, 6, 0.45), hit(3, 0.75, 0.9), hit(6, 0.75, 0.7), hit(11, 0.75, 1), hit(14, 0.5, 0.6), hit(19, 0.75, 0.9), hit(22, 0.75, 0.7), hit(27, 0.75, 1), hit(30, 0.5, 0.6)]],
      basslines: [twice([bass(0, 1.5, 0, 1), bass(3, 0.5, 12, 0.6), bass(6, 1, 0, 0.85), bass(10, 1, 7, 0.8), bass(14, 1, 12, 0.7)])],
      motifs: [twice([riff(2, 0.5, 3), riff(5, 0.5, 3), riff(7, 0.5, 2), riff(10, 0.5, 3), riff(13, 0.5, 3)])],
      calls: [hook(6, 3, 3, 2)],
      ukg: {
        bars: 2,
        turn: 0,
        vary: 0,
        pluck: { level: 0.6, pan: 0.3 },
        chop: { in: ["build", "full", "rebuild"], every: 1 },
        v2: {
          motif: { level: 1, voice: "pluck", in: ["build", "full", "rebuild"], p: { decay: 0.45, bright: 0.35, damp: 0.05, position: 0.12 } },
          chop: { p: { a: 0.004 } },
        },
      },
    },
  }),
  "rally-replay": merge(merge(PHASE0["rally-replay"], DEHARSH), {
    data: {
      chords: [
        { bass: 0, pad: [-5, -2, 2, 5], guide: 14, dark: [0, 7, 15] }, // F#m11 rootless, no 3rd: C# E G# B
        { bass: 5, pad: [-4, 0, 3, 7], guide: 15, dark: [5, 12, 20] }, // Bm9 (iv): D F# A C#
      ],
      progressions: [[0, 0, 0, 0, 0, 0, 0, 1]],
      stabs: [twice([hit(0, 0.75, 0.9), hit(3, 0.5, 0.6), hit(6, 0.75, 0.85), hit(8, 0.5, 0.5), hit(11, 0.75, 0.95), hit(14, 0.5, 0.7)])],
      basslines: [twice([bass(2, 1, 0, 1), bass(6, 1, 12, 0.8), bass(10, 1, 0, 0.9), bass(14, 1, 12, 0.75), bass(15, 0.5, 7, 0.5)])],
      calls: [hook(6, 3, 0, 1)],
      ukg: { bars: 2, turn: 0, vary: 0, chop: { in: ["build", "full", "rebuild"], every: 1 } },
    },
  }),
};

/**
 * The new track, "Apex" (139, A# minor), written to the phase 1 rules from the start, on Pit Lane's phase 0 kit and mix:
 * a funky house piano (the voice library's) and the resampled chop layered on short off-16th stabs, Bbm11 for 14 bars
 * and Ebm9 for 2, a stompy offbeat bass with octave pushes over the rubber sub, a muted waveguide pluck riff on one
 * pitch (the 11th) with the 7th, the diva as a static "ooh" stutter on the 9th.
 */
export const APEX: Record<string, unknown> = merge(PHASE1["v2-pit-lane"], {
  bpm: [139, 139],
  data: {
    chords: [
      { bass: 0, pad: [-5, -2, 2, 5], guide: 14, dark: [0, 7, 15] }, // Bbm11 rootless, no 3rd: F Ab C Eb
      { bass: 5, pad: [-4, 0, 3, 7], guide: 15, dark: [5, 12, 20] }, // Ebm9 (iv): Gb Bb Db F
    ],
    stabs: [twice([hit(1, 0.5, 0.55), hit(3, 0.75, 0.95), hit(6, 0.5, 0.7), hit(9, 0.75, 0.85), hit(12, 0.5, 0.5), hit(14, 0.75, 1)])],
    basslines: [twice([bass(2, 1, 0, 1), bass(5, 0.5, 12, 0.55), bass(6, 1, 0, 0.9), bass(10, 1, 12, 0.85), bass(13, 0.5, 7, 0.6), bass(14, 1, 0, 0.9)])],
    motifs: [twice([riff(0, 0.5, 3), riff(3, 0.5, 3), riff(4, 0.5, 1), riff(8, 0.5, 3), riff(11, 0.5, 3), riff(12, 0.5, 1)])],
    calls: [hook(10, 2, 3, 2)],
    ukg: {
      keys: [10],
      ep: { level: 0.6 },
      grand: { level: 0.9, in: [], alt: 0, octave: 0, double: 0.1, decay: 0.6, release: 0.1, bright: 0.6, detune: 1, bark: 0.5, hammer: 0.5, organ: 0.4, thin: 0 },
      bed: { level: 0 },
      drums: { kick: 0.95, knock: 0.75, click: 0.65, kickDecay: 0.3 },
      v2: { chop: { max: 0.75 } },
    },
  },
});

// ---- Phase 2 (docs/sound/RALLY-HOUSE-2.md "Phase 2"): open the voices, on the phase 1 composition ---------------

/**
 * "The synths are cramped": the measured causes (stems.py) and the answer to each, all existing opt-in fields plus
 * `street.bassWidth`:
 *   - the piano, the pluck riff, the diva and the bass top are mono or nearly (L/R correlation 0.96-1.00): the
 *     ensemble chorus on the harmony and lead buses (`chorus` 0.3 / 0.3), the harmony bus widener up (`bus.width` 0.5),
 *     the riff panned wider (`pluck.pan` 0.7) and louder (0.85: the brightest voice carries the 2-6 kHz), the bass top widened over 250 Hz (`street.bassWidth` 0.3; the sub mono);
 *   - the PS1 sampler on the chords and the lead cut their top (95% rolloff 6.2 kHz clean vs 3.3 kHz): `psx.harm` /
 *     `psx.lead` 0; the chop sampler at 32 kHz / 14 bit with its lowpass at 14 kHz (was 26 kHz / 12 bit / 7.5 kHz);
 *   - gated stabs (they sound 41% of the time and ring ~90 ms; the approved Cinematic and Hamster Electro chords 100%):
 *     the chop's release 0.18 s (was 0.05), the piano's decay and release longer, and a quiet, dark, wide analog pad
 *     under the drop and rebuild (the "air" layer: level 0.3, closed, no sweetness);
 *   - few partials in the stab body: a short, dark saw-stack layer under the stabs (`saws`: 5 detuned saws, 1.8 kHz
 *     lowpass opening on each hit, wide; a stab body, not a lead), the piano's hammer and brightness up;
 *   - the diva narrow and dark (95% under 910 Hz): presence 2.5 and breath 0.35 back up, through the lead chorus;
 *   - crest: the clippers a little firmer again (drums 4, master 3 dB), the parallel saturation unchanged;
 *   - the top over 6 kHz kept inside the references' range: the harmony shelf 2 dB (was 4), the riff's pick darker.
 * Space: no reverb added; the chorus and the widener are the only "space" (short modulated delays, 7-11 ms).
 */
const OPEN = {
  data: {
    ukg: {
      psx: { harm: 0, lead: 0 },
      chorus: { harm: 0.3, lead: 0.3 },
      bus: { width: 0.5 },
      pluck: { pan: 0.7, level: 0.85 },
      street: { bassWidth: 0.3, clipDrums: 4, clipMaster: 3, shelf: 2 },
      // The riff a little darker: with the PSX gone and louder, it carried most of the top over 6 kHz.
      voc: { presence: 2.5, breath: 0.35 },
      saws: { level: 0.35, in: ["build", "full", "rebuild"], alt: 0, voices: 5, detune: 14, mix: 0.4, cutoff: 1800, env: 0.6, fdecay: 0.12, q: 0.7, attack: 0.003, decay: 0.25, sustain: 0.2, release: 0.2, width: 0.9, sub: 0, drive: 0.4, octave: 0, follow: 1 },
      bed: { kind: "juno", level: 0.3, in: ["full", "rebuild"], alt: 0, cutoff: 1200, lfoBars: 16, lfoDepth: 0.3, attack: 0.8, release: 1.2, octave: 0, width: 1, ensemble: 0.6 },
      v2: {
        chop: { p: { rate: 32000, bits: 14, lp: 14000, r: 0.18 } },
        pad: { level: 1, voice: "analogPad", p: { cutoff: 550, res: 0.1, env: 1, fa: 1.5 } },
        motif: { p: { bright: 0.22 } },
      },
    },
  },
};

export const PHASE2: Record<string, Record<string, unknown>> = {
  "v2-pit-lane": merge(PHASE1["v2-pit-lane"], OPEN),
};

export const APEX2: Record<string, unknown> = merge(APEX, merge(OPEN, { data: { ukg: { grand: { level: 1.1, bright: 0.8, hammer: 0.7, decay: 1, release: 0.25 } } } }));

// ---- Phase 3 (docs/sound/RALLY-HOUSE-2.md "Phase 3"): the theme develops inside the form -----------------------

/**
 * Owner on phase 2: "now we repeat too much, literally only repetition; the theme must develop within a part; in house
 * a repeat of about 32 bars is fine, but no more". Phase 1's tension and phase 2's width stay; the material now changes
 * per 8-bar phrase (`ukg.phrases`): every phrase differs from the one before in at least one table (stabs, bass, riff,
 * hook, chord move), so one identical loop lasts 8 bars, and the same combination returns only after 32 or more.
 * Tables: 0 = the phase 1 loop (A); 1 = A' (a note changed, hits displaced in the second bar); 2 = B (a new bass move, a
 * counter-riff answering the hook, sparse break stabs). The arc over two 32-bar forms:
 *   phrase  part              stabs  bass  riff  hook  chords
 *   0       intro             A      A     A     A     one chord
 *   1       build             A      A'    A     A'    the iv for the last 2 bars
 *   2       drop              A'     A'    A'    A     one chord
 *   3       break + rebuild   B      A     B     A'    the iv for the last 4 bars
 *   4       intro 2           A'     A     A'    A     one chord
 *   5       build 2           A'     B     A'    A'    the iv for the last 4 bars
 *   6       drop 2 ("B")      A      B     B     A'    the iv for the last 4 bars
 *   7       break 2           B      A'    A     A     the iv for the last 2 bars
 * (then from phrase 8 the arc starts again, 64 bars later).
 */
const PHRASES = {
  stabs: [0, 0, 1, 2, 1, 1, 0, 2],
  basslines: [0, 1, 1, 0, 0, 2, 2, 1],
  motifs: [0, 0, 1, 2, 1, 1, 2, 0],
  calls: [0, 1, 0, 1, 0, 1, 1, 0],
  progressions: [0, 0, 0, 1, 0, 1, 1, 0],
};
const PROGS = [[0, 0, 0, 0, 0, 0, 0, 1], [0, 0, 1, 1, 0, 0, 1, 1]];

export const APEX3: Record<string, unknown> = merge(APEX2, {
  data: {
    progressions: PROGS,
    stabs: [
      twice([hit(1, 0.5, 0.55), hit(3, 0.75, 0.95), hit(6, 0.5, 0.7), hit(9, 0.75, 0.85), hit(12, 0.5, 0.5), hit(14, 0.75, 1)]),
      // A': the first bar as A, the second pushed: hits moved a 16th, one more push before the bar line.
      [hit(1, 0.5, 0.55), hit(3, 0.75, 0.95), hit(6, 0.5, 0.7), hit(9, 0.75, 0.85), hit(12, 0.5, 0.5), hit(14, 0.75, 1),
        hit(19, 0.75, 0.9), hit(22, 0.5, 0.65), hit(24, 0.75, 0.85), hit(27, 0.5, 0.6), hit(30, 0.75, 1), hit(31, 0.5, 0.5)],
      // B: the break, four hits in two bars.
      [hit(3, 1, 0.85), hit(11, 0.75, 0.7), hit(19, 1, 0.9), hit(27, 0.75, 0.65)],
    ],
    basslines: [
      twice([bass(2, 1, 0, 1), bass(5, 0.5, 12, 0.55), bass(6, 1, 0, 0.9), bass(10, 1, 12, 0.85), bass(13, 0.5, 7, 0.6), bass(14, 1, 0, 0.9)]),
      // A': the second bar climbs the octave and falls to the 5th under.
      [bass(2, 1, 0, 1), bass(5, 0.5, 12, 0.55), bass(6, 1, 0, 0.9), bass(10, 1, 12, 0.85), bass(13, 0.5, 7, 0.6), bass(14, 1, 0, 0.9),
        bass(18, 1, 0, 1), bass(20, 0.5, 7, 0.6), bass(22, 1, 12, 0.9), bass(26, 1, 0, 0.85), bass(28, 0.5, -5, 0.7), bass(30, 1, 12, 0.85)],
      // B: a new syncopation, off the kick throughout.
      twice([bass(3, 1, 0, 0.95), bass(6, 0.5, 12, 0.7), bass(7, 0.5, 7, 0.6), bass(11, 1, 0, 0.9), bass(14, 0.5, 12, 0.8), bass(15, 0.5, -5, 0.55)]),
    ],
    motifs: [
      twice([riff(0, 0.5, 3), riff(3, 0.5, 3), riff(4, 0.5, 1), riff(8, 0.5, 3), riff(11, 0.5, 3), riff(12, 0.5, 1)]),
      // A': in the second bar the 7th becomes the 9th and the last note comes a 16th late.
      [riff(0, 0.5, 3), riff(3, 0.5, 3), riff(4, 0.5, 1), riff(8, 0.5, 3), riff(11, 0.5, 3), riff(12, 0.5, 1),
        riff(16, 0.5, 3), riff(19, 0.5, 3), riff(21, 0.5, 2), riff(24, 0.5, 3), riff(27, 0.5, 3), riff(29, 0.5, 1)],
      // B: a low counter-riff answering the hook (the root of the voicing, static, off-beat).
      twice([riff(2, 0.5, 0), riff(6, 0.5, 0), riff(7, 0.5, 1), riff(13, 0.5, 0)]),
    ],
    calls: [
      hook(10, 2, 3, 2),
      // A': the hook's second half changes rhythm: a longer cut, then a late short one.
      [{ s: 10, len: 0.5, vowel: 3, tone: 2, rep: 2, core: true }, { s: 26, len: 1, vowel: 3, tone: 2, rep: 0, core: true }, { s: 30, len: 0.5, vowel: 1, tone: 3, rep: 1, core: true }],
    ],
    ukg: { phrases: PHRASES },
  },
});

export const PHASE3: Record<string, Record<string, unknown>> = {
  "v2-pit-lane": merge(PHASE2["v2-pit-lane"], {
    data: {
      progressions: PROGS,
      stabs: [
        [hit(0, 6, 0.45), hit(3, 0.75, 0.9), hit(6, 0.75, 0.7), hit(11, 0.75, 1), hit(14, 0.5, 0.6), hit(19, 0.75, 0.9), hit(22, 0.75, 0.7), hit(27, 0.75, 1), hit(30, 0.5, 0.6)],
        [hit(0, 6, 0.45), hit(3, 0.75, 0.9), hit(6, 0.75, 0.7), hit(11, 0.75, 1), hit(14, 0.5, 0.6), hit(18, 0.75, 0.85), hit(21, 0.5, 0.6), hit(24, 0.75, 0.95), hit(27, 0.75, 0.7), hit(31, 0.5, 0.55)],
        [hit(0, 8, 0.5), hit(11, 0.75, 0.8), hit(27, 0.75, 0.75)],
      ],
      basslines: [
        twice([bass(0, 1.5, 0, 1), bass(3, 0.5, 12, 0.6), bass(6, 1, 0, 0.85), bass(10, 1, 7, 0.8), bass(14, 1, 12, 0.7)]),
        [bass(0, 1.5, 0, 1), bass(3, 0.5, 12, 0.6), bass(6, 1, 0, 0.85), bass(10, 1, 7, 0.8), bass(14, 1, 12, 0.7),
          bass(16, 1.5, 0, 1), bass(19, 0.5, 7, 0.6), bass(22, 1, 12, 0.85), bass(26, 1, 0, 0.8), bass(28, 0.5, -5, 0.65), bass(30, 1, 7, 0.75)],
        twice([bass(2, 1, 0, 0.95), bass(5, 0.5, 12, 0.65), bass(7, 1, 7, 0.75), bass(10, 1, 0, 0.9), bass(13, 0.5, 12, 0.7), bass(15, 0.5, -5, 0.5)]),
      ],
      motifs: [
        twice([riff(2, 0.5, 3), riff(5, 0.5, 3), riff(7, 0.5, 2), riff(10, 0.5, 3), riff(13, 0.5, 3)]),
        [riff(2, 0.5, 3), riff(5, 0.5, 3), riff(7, 0.5, 2), riff(10, 0.5, 3), riff(13, 0.5, 3),
          riff(18, 0.5, 3), riff(21, 0.5, 3), riff(24, 0.5, 2), riff(26, 0.5, 3), riff(30, 0.5, 2)],
        twice([riff(1, 0.5, 0), riff(4, 0.5, 0), riff(9, 0.5, 1), riff(12, 0.5, 0)]),
      ],
      calls: [
        hook(6, 3, 3, 2),
        [{ s: 6, len: 0.5, vowel: 3, tone: 3, rep: 2, core: true }, { s: 22, len: 1, vowel: 3, tone: 3, rep: 0, core: true }, { s: 27, len: 0.5, vowel: 1, tone: 2, rep: 1, core: true }],
      ],
      ukg: { phrases: PHRASES },
    },
  }),
};

// ---- Phase 4 part 1 (docs/sound/RALLY-HOUSE-2.md "Phase 4"): brightness from parts, a second vocal ---------------

/**
 * 2-6 kHz from bright PARTS, not EQ: a round clap on 2 and 4 under the snare (the rendered clap + the two tone bodies,
 * no noise wires, a 80 ms tail), congas from the build on, a rim written in a lane; Apex's piano top doubled an octave
 * up (the stab top). The phase 3 structure, the phase 2 width and the phase 0 mix untouched.
 */
const BRIGHT = {
  data: {
    ukg: {
      drums: { clap: 0.8, body: 0.7, wires: 0, tail: 0.08, conga: 0.5 },
      lanes: { rim: "...........7..........6.....7..." },
      // The bright melodic parts up a step: the riff, the diva.
      pluck: { level: 1 },
      voc: { level: 1.45 },
    },
  },
};
/** Vocal B: the same formant chops, a brighter source and upper formants, two detuned takes spread left and right. */
export const VOX_B = { data: { ukg: { voc: { bright: 0.8, wide: 0.6, presence: 2 } } } };
/** Without the quiet wide pad under the drop (phase 2's unconfirmed layer). */
export const NO_PAD = { data: { ukg: { bed: { level: 0 } } } };

export const APEX4: Record<string, unknown> = merge(APEX3, merge(BRIGHT, { data: { ukg: { grand: { double: 0.7 } } } }));
export const PIT4: Record<string, unknown> = merge(PHASE3["v2-pit-lane"], BRIGHT);

// ---- Phase 4 part 2: the set (five distinct styles on the phase 3 phrase engine and the part 1 parts) -------------

/** One bar as A, then A' = the same first bar and `alt` as the second (an evolved bar), both two-bar figures. */
const pairOf = <T extends { s: number }>(bar: T[], alt: T[]): [T[], T[]] => [twice(bar), [...bar, ...alt.map((x) => ({ ...x, s: x.s + 16 }))]];
/** The set's common ground: Pit Lane phase 4's kit, mix, width and bright parts, vocal B, no pad; no composition kept. */
/**
 * Phase 5 (owner on phase 4: "remove the vocal everywhere in Rally House, it doesn't work for us; only Apex may keep it,
 * playing ~25% of the track; no difference heard between A and B; the pad not heard, so keep it"): the set has the pad
 * (phase 2's quiet wide bed) and no vocal; the hook's role (phase 3's A / A' change every 8 bars) is carried by the stab,
 * bass and riff tables, which already change every phrase. Apex keeps vocal A in the second form's build, drop and
 * rebuild only.
 */
const NO_VOX = { data: { ukg: { vox: { level: 0 } } } };
const SET_BASE = merge(PIT4, NO_VOX);
const tone = (s: number, len: number, t: number, oct = 0) => ({ s, len, tone: t, core: true, ...(oct ? { oct } : {}) });

/** 3. Gridlock (142, E minor): the FM organ stab carries it (Sega Rally organ house), a squelchy diode bass, a "yeah". */
const GRIDLOCK: Record<string, unknown> = (() => {
  const [sA, sA2] = pairOf([hit(0, 0.75, 0.9), hit(3, 0.5, 0.6), hit(6, 0.75, 0.85), hit(10, 0.5, 0.7), hit(12, 0.75, 0.95)], [hit(2, 0.5, 0.7), hit(6, 0.75, 0.9), hit(9, 0.5, 0.6), hit(12, 0.75, 0.95), hit(15, 0.5, 0.65)]);
  const [bA, bA2] = pairOf([bass(2, 0.5, 0, 1), bass(4, 0.5, 12, 0.6), bass(6, 0.5, 0, 0.9), bass(10, 0.5, 12, 0.85), bass(12, 0.5, 7, 0.6), bass(14, 0.5, 0, 0.9)], [bass(2, 0.5, 0, 1), bass(3, 0.5, 12, 0.7), bass(6, 0.5, 7, 0.85), bass(8, 0.5, 0, 0.6), bass(10, 0.5, 12, 0.9), bass(14, 0.5, -5, 0.8)]);
  return merge(SET_BASE, {
    bpm: [142, 142],
    swing: 0.58,
    data: {
      chords: [
        { bass: 0, pad: [-5, -2, 2, 5], guide: 14, dark: [0, 7, 15] }, // Em11 rootless, no 3rd: B D F# A
        { bass: 5, pad: [-4, 0, 3, 7], guide: 15, dark: [5, 12, 20] }, // Am9 (iv): C E G B
      ],
      progressions: PROGS,
      stabs: [sA, sA2, [hit(0, 2, 0.8), hit(11, 0.75, 0.7), hit(16, 2, 0.75), hit(27, 0.75, 0.65)]],
      basslines: [bA, bA2, twice([bass(3, 1, 0, 0.95), bass(7, 0.5, 12, 0.7), bass(11, 1, 0, 0.9), bass(14, 0.5, 7, 0.7), bass(15, 0.5, 12, 0.6)])],
      motifs: [twice([tone(0, 0.5, 3)])],
      calls: [hook(14, 3, 0, 3), [{ s: 14, len: 0.5, vowel: 0, tone: 3, rep: 3, core: true }, { s: 28, len: 0.75, vowel: 2, tone: 2, rep: 1, core: true }]],
      ukg: {
        keys: [4],
        ep: { level: 0 },
        grand: { level: 0 },
        m1: { level: 1.1, octave: 0, cutoff: 4400, drive: 1.6, click: 0.5, decay: 0.2, sustain: 0.2, release: 0.1 },
        pluck: { level: 0 },
        saws: { level: 0.3 },
        phrases: { ...PHRASES, motifs: [0] },
        v2: {
          organ: { level: 1, voice: "fmOrgan" },
          chop: { level: 0, voice: "chop" },
          bass: { level: 0.5, voice: "diodeBass", p: { cutoff: 320, res: 0.6, env: 3, fd: 0.16 } },
        },
      },
    },
  });
})();

/** 4. Slipstream (135, D Dorian): DX e-piano comping stabs, short chops, a rubbery FM bass, a high pluck riff. */
const SLIPSTREAM: Record<string, unknown> = (() => {
  const [sA, sA2] = pairOf([hit(0, 3, 0.55), hit(3, 0.75, 0.9), hit(7, 0.5, 0.6), hit(10, 0.75, 0.85), hit(14, 0.5, 0.7)], [hit(0, 3, 0.5), hit(4, 0.75, 0.85), hit(7, 0.5, 0.6), hit(11, 0.75, 0.9), hit(13, 0.5, 0.55)]);
  const [bA, bA2] = pairOf([bass(0, 1, 0, 1), bass(3, 0.5, 12, 0.6), bass(6, 1, 7, 0.8), bass(10, 1, 0, 0.9), bass(13, 0.5, 12, 0.7)], [bass(0, 1, 0, 1), bass(3, 0.5, 12, 0.6), bass(6, 1, 0, 0.8), bass(9, 0.5, 7, 0.7), bass(11, 1, 12, 0.85), bass(14, 0.5, -5, 0.7)]);
  const [mA, mA2] = pairOf([tone(1, 0.5, 3), tone(4, 0.5, 3), tone(6, 0.5, 2), tone(9, 0.5, 3), tone(12, 0.5, 3)], [tone(1, 0.5, 3), tone(4, 0.5, 2), tone(7, 0.5, 2), tone(9, 0.5, 3), tone(13, 0.5, 1)]);
  const out = merge(SET_BASE, {
    bpm: [135, 135],
    swing: 0.62,
    data: {
      chords: [
        { bass: 0, pad: [-5, -2, 2, 5], guide: 14, dark: [0, 7, 15] }, // Dm11 rootless, no 3rd: A C E G
        { bass: 5, pad: [-3, 0, 3, 7], guide: 15, dark: [5, 12, 19] }, // G9 (Dorian IV): B D F A
      ],
      progressions: PROGS,
      stabs: [sA, sA2, [hit(0, 4, 0.6), hit(10, 0.75, 0.75), hit(16, 4, 0.55), hit(26, 0.75, 0.7)]],
      basslines: [bA, bA2, twice([bass(2, 1, 0, 0.95), bass(5, 0.5, 12, 0.65), bass(8, 1, 7, 0.75), bass(11, 1, 0, 0.9), bass(15, 0.5, 12, 0.6)])],
      motifs: [mA, mA2, twice([tone(2, 0.5, 0), tone(5, 0.5, 0), tone(10, 0.5, 1)])],
      calls: [hook(6, 2, 1, 1), [{ s: 6, len: 0.5, vowel: 1, tone: 2, rep: 1, core: true }, { s: 22, len: 1, vowel: 3, tone: 3, rep: 0, core: true }]],
      ukg: {
        keys: [2],
        scale: "dorian",
        ep: { level: 1 },
        grand: { level: 0 },
        pluck: { level: 0.9 },
        phrases: PHRASES,
        v2: {
          keys: { level: 1, voice: "fmEp", alive: { velBright: 0.9 } },
          chop: { level: 0.9, voice: "chop", max: 0.75 },
          motif: { level: 1, voice: "pluck", in: ["build", "full", "rebuild"], p: { decay: 0.4, bright: 0.3, damp: 0.05, position: 0.1 } },
        },
      },
    },
  });
  // The FM bass replaces the inherited ladder bass slot whole (its analog parameters do not apply).
  return merge(out, { data: { ukg: { v2: { bass: { level: 0.7, voice: "fmBass", p: undefined } } } } });
})();

/** 5. Night Shift (140, F Phrygian): dark chord chops only, a low muted pluck riff, a rolling ladder bass with glides. */
const NIGHT_SHIFT: Record<string, unknown> = (() => {
  const [sA, sA2] = pairOf([hit(2, 0.5, 0.8), hit(6, 0.75, 0.95), hit(11, 0.5, 0.7), hit(14, 0.75, 0.9)], [hit(2, 0.5, 0.8), hit(5, 0.5, 0.6), hit(8, 0.75, 0.95), hit(13, 0.5, 0.7), hit(15, 0.5, 0.6)]);
  const roll = (s0: number, v: number) => [bass(s0, 0.5, 0, v), bass(s0 + 1, 0.5, 12, v * 0.6)];
  const [bA, bA2] = pairOf([...roll(0, 1), ...roll(3, 0.8), bass(6, 1, 0, 0.9), ...roll(10, 0.85), bass(13, 1, 7, 0.75)], [...roll(0, 1), ...roll(3, 0.8), bass(6, 1, 7, 0.9), bass(9, 0.5, 12, 0.7), ...roll(10, 0.85), bass(14, 1, -5, 0.75)]);
  const [mA, mA2] = pairOf([tone(0, 0.5, 1, -1), tone(3, 0.5, 1, -1), tone(5, 0.5, 0, -1), tone(8, 0.5, 1, -1), tone(11, 0.5, 1, -1)], [tone(0, 0.5, 1, -1), tone(3, 0.5, 1, -1), tone(6, 0.5, 2, -1), tone(8, 0.5, 1, -1), tone(12, 0.5, 0, -1)]);
  return merge(SET_BASE, {
    bpm: [140, 140],
    swing: 0.57,
    data: {
      chords: [
        { bass: 0, pad: [-5, -2, 0, 5], guide: 12, dark: [0, 7, 15] }, // Fm11 with no 3rd and no 9th (Phrygian): C Eb F Bb
        { bass: 1, pad: [-4, 0, 1, 5], guide: 13, dark: [1, 8, 13] }, // Gbmaj7 (the flat second): Db F Gb Bb
      ],
      progressions: PROGS,
      stabs: [sA, sA2, [hit(6, 0.75, 0.85), hit(22, 0.75, 0.8)]],
      basslines: [bA, bA2, twice([bass(2, 1, 0, 0.95), bass(4, 0.5, 12, 0.6), bass(7, 1, 0, 0.9), bass(10, 0.5, 7, 0.7), bass(12, 1, 0, 0.85), bass(15, 0.5, 12, 0.6)])],
      motifs: [mA, mA2, twice([tone(4, 0.5, 3), tone(12, 0.5, 3)])],
      calls: [[{ s: 26, len: 1.5, vowel: 3, tone: 2, core: true }], [{ s: 10, len: 0.5, vowel: 3, tone: 2, rep: 1, core: true }, { s: 26, len: 1.5, vowel: 1, tone: 2, core: true }]],
      ukg: {
        keys: [5],
        scale: "phrygian",
        ep: { level: 0 },
        grand: { level: 0 },
        pluck: { level: 0.9 },
        saws: { level: 0.25 },
        phrases: PHRASES,
        v2: {
          chop: { level: 1, voice: "chop", max: 1, in: ["intro", "build", "full", "breakdown", "rebuild"], p: { lp: 9000 } },
          bass: { level: 0.55, voice: "ladderBass", p: { cutoff: 380, res: 0.45, env: 3.2, fd: 0.14 } },
          motif: { level: 1, voice: "pluck", in: ["build", "full", "rebuild"], p: { decay: 0.35, bright: 0.25, damp: 0.04, position: 0.15 } },
        },
      },
    },
  });
})();

/** Apex: vocal A only in the second 32-bar form's build, drop and rebuild (20 of its 95 bars, ~21%). */
const APEX5: Record<string, unknown> = merge(APEX4, { data: { ukg: { chop: { in: ["build", "full", "rebuild"], alt: 1, every: 1 } } } });

/**
 * Gridlock B (an alternative for the A/B, the owner dislikes organ-like synths): no organ; the same stab rhythm played by
 * the resampled chord chop (a rich FM e-piano + saw chord sampled once, repitched per chord) over the saw-stack body.
 */
export const GRIDLOCK_CHOP: Record<string, unknown> = merge(GRIDLOCK, {
  data: {
    ukg: {
      m1: { level: 0 },
      saws: { level: 0.4 },
      v2: {
        organ: { level: 0, voice: "fmOrgan" },
        chop: { level: 1, voice: "chop", max: 2, in: ["intro", "build", "full", "breakdown", "rebuild"], p: { lp: 12000 } },
      },
    },
  },
});

/** Phase 5's set (kept for the phase 5 vs 6 A/B renders). */
export const SET5: Record<string, { name: string; patch: Record<string, unknown> }> = {
  "rh-apex": { name: "Apex", patch: APEX5 },
  "rh-pit-lane": { name: "Pit Lane", patch: SET_BASE },
  "rh-gridlock": { name: "Gridlock", patch: GRIDLOCK },
  "rh-slipstream": { name: "Slipstream", patch: SLIPSTREAM },
  "rh-night-shift": { name: "Night Shift", patch: NIGHT_SHIFT },
};

// ---- Phase 6 (docs/sound/RALLY-HOUSE-2.md "Phase 6"): each style its own top voice ---------------------------------

// The library's newer shelf (voices/new: kalimba, guitar, sawLead, ...) joins the catalog for this pack's slots.
registerVoices(NEW_LIBRARY_BY_ID);

/**
 * Owner on phase 5: "all of Rally House sounds like the same top synth; only Gridlock is different". The four riffs
 * were all phase 2's waveguide pluck. Each style now plays its riff on its own voice family from the shared library
 * (`ukg.library.motif`, voice-library-v2-approved), same notes, parts and phrase tables:
 *   Apex         physRhodes (keys: hammer, tine, tonebar, pickup bark), its brighter preset an octave up
 *   Pit Lane     waveguidePluck, the Slow Bloom guitar the owner liked (now Pit Lane's alone)
 *   Gridlock     unchanged: the FM organ stab is its top (no riff)
 *   Slipstream   kalimba first (phase 6); phase 6.1 replaced it with junoStab on a darker riff (below)
 *   Night Shift  clav "funk" (a string held by a rubber tip, a magnetic pickup near the bridge, a yarn damper's thwack):
 *                low, percussive and gritty. (sawLead "dark mono" was tried first: its MFCC distance to Apex's Rhodes was
 *                only 10, the two read alike.)
 */
const TOP: Record<string, Record<string, unknown>> = {
  // Levels matched to phase 5's riff (its stem alone at about -22 LUFS) through each voice's own `level`.
  "rh-apex": { voice: "physRhodes", preset: "slowBloom.keys", octave: 12, params: { level: 1.75 } },
  "rh-pit-lane": { voice: "waveguidePluck", preset: "slowBloom.motif", params: { level: 0.75 } },
  "rh-slipstream": { voice: "kalimba", preset: "kalimba", octave: 12, params: { level: 0.48 } },
  "rh-night-shift": { voice: "clav", preset: "funk", params: { level: 0.68 } },
};

/**
 * Phase 6.1 (owner: "Slipstream started to sound like a Hawaiian melody"): the kalimba an octave up over a riff that
 * walked the 11th to the 9th (G - E: a sing-song falling third) and, in B, the Dorian major 6th: island and sweet. The
 * riff now sits on the 7th and the 11th (a fourth, C - G), mostly one pitch repeated, no 9th, no 6th, in its own octave;
 * candidates for the voice (none of them a mallet, tine, steel or plucked string):
 */
const SLIP_RIFF = (() => {
  const [mA, mA2] = pairOf([tone(1, 0.5, 1), tone(4, 0.5, 1), tone(6, 0.5, 3), tone(9, 0.5, 1), tone(12, 0.5, 1)], [tone(1, 0.5, 1), tone(4, 0.5, 1), tone(7, 0.5, 1), tone(9, 0.5, 3), tone(13, 0.5, 1)]);
  return { data: { motifs: [mA, mA2, twice([tone(2, 0.5, 1), tone(5, 0.5, 1), tone(10, 0.5, 1)])] } };
})();
export const SLIP_TOPS: Record<string, Record<string, unknown>> = {
  // Levelled to the riff's -22 LUFS alone. (bowedStrings "stab" was tried: on these 32nd-note hits the bow barely
  // speaks, -40 LUFS alone; left out.)
  juno: { voice: "junoStab", preset: "undertow.keys", params: { level: 0.67 } },
  brass: { voice: "softBrass", preset: "stab", params: { level: 1 } },
  saw: { voice: "sawLead", preset: "character", params: { level: 0.8, cutoff: 600 } },
};
function slipWith(top: Record<string, unknown>): Record<string, unknown> {
  return merge(SET5["rh-slipstream"].patch, merge(SLIP_RIFF, { data: { ukg: { library: { motif: top } } } }));
}

/**
 * The pick (owner, after the A/B: "the Juno stab no; the soft brass is great"): softBrass "stab" on the darker riff, as
 * heard in the A/B. It measures 21 MFCC from Gridlock's organ; an octave down was tried to separate them and put 76% of
 * the riff under 200 Hz (into the bass), so the register the owner approved stays: the two never play in one track, and
 * the tracks differ in key (D Dorian vs E minor), tempo (135 vs 142) and articulation (a breathy scooped stab vs a
 * percussive organ hit).
 */
export const SET: Record<string, { name: string; patch: Record<string, unknown> }> = Object.fromEntries(
  Object.entries(SET5).map(([id, x]) => [
    id,
    { name: x.name, patch: id === "rh-slipstream" ? slipWith(SLIP_TOPS.brass) : TOP[id] ? merge(x.patch, { data: { ukg: { library: { motif: TOP[id] } } } }) : x.patch },
  ]),
);

/** Every patch by name, for the renders (render.mjs `patch`: PATCHES[name][style id]). */
export const PATCHES: Record<string, Record<string, Record<string, unknown>>> = {
  phase0: PHASE0,
  street: { "v2-pit-lane": STREET },
  phase1: PHASE1,
  apex: { "v2-pit-lane": APEX },
  phase2: PHASE2,
  apex2: { "v2-pit-lane": APEX2 },
  phase3: PHASE3,
  apex3: { "v2-pit-lane": APEX3 },
  apex4: { "v2-pit-lane": APEX4 },
  apex4voxb: { "v2-pit-lane": merge(APEX4, VOX_B) },
  apex4nopad: { "v2-pit-lane": merge(APEX4, NO_PAD) },
  pit4: { "v2-pit-lane": PIT4 },
  // The set, each style on Pit Lane's place in the synth-v2 pack (render.mjs; the Style Lab pack below has its own epochs).
  ...Object.fromEntries(Object.entries(SET).map(([id, x]) => [id, { "v2-pit-lane": x.patch }])),
  "rh-gridlock-chop": { "v2-pit-lane": GRIDLOCK_CHOP },
  // Phase 6.1: Slipstream's candidate tops on the darker riff.
  ...Object.fromEntries(Object.entries(SLIP_TOPS).map(([k, top]) => [`slip-${k}`, { "v2-pit-lane": slipWith(top) }])),
  // Phase 5's set, for the A/B against phase 6.
  ...Object.fromEntries(Object.entries(SET5).map(([id, x]) => [`p5-${id}`, { "v2-pit-lane": x.patch }])),
};

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Deep merge: objects field by field, everything else (lists included, and `undefined`: a field cleared) replaced. */
export function merge<T>(base: T, patch: Record<string, unknown>): T {
  if (!isObj(base)) return patch as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : v;
  return out as T;
}

const replay = rallyHouse.styles.futuregarage!.find((s) => s.id === "rally-replay")!;
const pitLane = v2Tracks.styles.futuregarage!.find((s) => s.id === "v2-pit-lane")!;

/**
 * The pack: the phase 4 set, five distinct Rally House styles (a Style Lab shelf, on no station). The earlier phases
 * (phase 0 .. 3, Replay, the street version) are patches only (PATCHES), rendered in place on their original packs.
 */
export default {
  key: "rally-house-2",
  name: "Rally House 2",
  genres: ["futuregarage"],
  styles: {
    futuregarage: Object.entries(SET).map(([id, x]) => ({ ...merge(pitLane, x.patch), id, name: x.name })) as StationStyle[],
  },
} as StationPack;
