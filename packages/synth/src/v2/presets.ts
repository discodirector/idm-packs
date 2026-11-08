import type { V2Alive, V2Kind } from "./dsp.ts";

/**
 * The Synth v2 voices a pack can name (docs/sound/SYNTH-V2.md). Each is a family (dsp.ts) with its parameters and
 * its alive layer; a pack slot overrides any of them (`p`, `alive`). `gain` levels the voice against the v1 voice it
 * replaces (measured: SYNTH-V2.md "Levels").
 */
export interface V2AliveSpec extends V2Alive {
  /** Micro-timing, ms: each hit lands up to this much late (a little early now and then), seeded, on top of the swing. */
  timing: number;
}

export interface V2Preset {
  kind: V2Kind;
  /** One line for the docs and the voice tour. */
  doc: string;
  gain: number;
  p: Record<string, number | string | number[][]>;
  alive: V2AliveSpec;
}

/** Gains are levelled against the v1 voice in the slot at that voice's level 1 (SYNTH-V2.md "Levels"). */
const STILL: V2AliveSpec = { drift: 0, driftRate: 0.3, wander: 0, envVar: 0, velBright: 0.5, timing: 0 };

export const V2_PRESETS = {
  /** Physical Rhodes: hammer, tine and tonebar resonators, the pickup's nonlinearity (bark with velocity). */
  rhodes: {
    kind: "modal",
    doc: "Rhodes: a hammer into tine + tonebar resonators, the tine's short inharmonic ding, a nonlinear pickup (bark rises with velocity)",
    gain: 0.47,
    p: {
      // [ratio, amplitude, T60 s at C4, cents]: the tine, the tonebar (beating against it), the cantilever modes.
      modes: [[1, 1, 3.2], [1, 0.45, 4.2, 2.5], [6.27, 0.16, 0.2], [17.55, 0.05, 0.05]],
      pickup: 0.6,
      offset: 0.4,
      hammer: 0.6,
      bright: 8000,
      damp: 0.16,
      thump: 0.15,
      level: 1,
    },
    alive: { drift: 3, driftRate: 0.25, wander: 0.2, envVar: 0.25, velBright: 0.75, timing: 4 },
  },
  /** DX7-style FM e-piano: body pair + 14:1 tine pair, velocity to the index (the bark). */
  fmEp: {
    kind: "fm",
    doc: "FM e-piano (DX7 E.PIANO shape): a 1:1 body pair and a 14:1 tine pair, velocity drives the index (bark)",
    gain: 0.26,
    p: {
      algo: "pairs",
      chorus: 6,
      fb: 0,
      level: 1,
      ops: [
        [1, 0, 1, 0.002, 1.6, 0.3, 0.3, 0, 0],
        [1, 0, 1.6, 0.001, 0.7, 0.2, 0.3, 0.8, 0.3],
        [1, 0, 0.35, 0.001, 0.3, 0, 0.2, 0.3, 0],
        [14, 0, 2.2, 0.001, 0.045, 0, 0.05, 0.9, 0.5],
      ],
    },
    alive: { drift: 3, driftRate: 0.3, wander: 0.25, envVar: 0.25, velBright: 0.75, timing: 4 },
  },
  /** FM organ stab: buzz (a feedback operator), a growl at 2:1 and a 3:1 percussion that decays, velocity to the index. */
  fmOrgan: {
    kind: "fm",
    doc: "FM organ stab: one carrier fanned by a 2:1 growl, a 3:1 percussion and a feedback buzz; the index decays (attack bite, darker body)",
    gain: 0.25,
    p: {
      algo: "fan",
      chorus: 7,
      fb: 0.7,
      level: 1,
      ops: [
        [1, 0, 1, 0.002, 0.25, 0.55, 0.1, 0.3, 0],
        [2, 0, 1.8, 0.001, 0.18, 0.45, 0.1, 0.8, 0.3],
        [3, 0, 1, 0.001, 0.07, 0.12, 0.05, 0.9, 0.4],
        [1, 0, 1.1, 0.001, 0.4, 0.6, 0.1, 0.5, 0.2],
      ],
    },
    alive: { drift: 2, driftRate: 0.35, wander: 0.3, envVar: 0.2, velBright: 0.8, timing: 3 },
  },
  /** FM bass: a 4-op stack with a feedback top. */
  fmBass: {
    kind: "fm",
    doc: "FM bass: a 4-operator stack, a feedback top, the index snapping down after the attack",
    gain: 0.6,
    p: {
      algo: "stack",
      chorus: 0,
      fb: 0.4,
      level: 1,
      ops: [
        [1, 0, 1, 0.002, 0.3, 0.6, 0.06, 0, 0],
        [1, 0, 1.4, 0.001, 0.2, 0.3, 0.06, 0.7, 0],
        [2, 0, 0.5, 0.001, 0.08, 0, 0.05, 0.8, 0],
        [1, 0, 0.6, 0.001, 0.15, 0.2, 0.05, 0.5, 0],
      ],
    },
    alive: { drift: 2, driftRate: 0.4, wander: 0.2, envVar: 0.2, velBright: 0.8, timing: 2 },
  },
  /** Tuned FM bell: integer ratios only, so its partials are harmonics of the chord tone it plays. */
  bell: {
    kind: "fm",
    doc: "Tuned FM bell: integer ratios only (1, 2, 4), so every partial is a harmonic of its chord tone: no clashing metal",
    gain: 0.3,
    p: {
      algo: "pairs",
      chorus: 3,
      fb: 0,
      level: 1,
      ops: [
        [1, 0, 1, 0.002, 2.5, 0, 1, 0, 0],
        [2, 0, 1.2, 0.001, 1.2, 0, 0.6, 0.6, 0.3],
        [2, 0, 0.3, 0.001, 1.5, 0, 0.8, 0.3, 0],
        [4, 0, 0.8, 0.001, 0.6, 0, 0.4, 0.6, 0.4],
      ],
    },
    alive: { drift: 1, driftRate: 0.2, wander: 0.1, envVar: 0.2, velBright: 0.6, timing: 3 },
  },
  /** Analog pad: three saws per note at their own phases and drift, ladder filter breathing, stereo. */
  analogPad: {
    kind: "analog",
    doc: "Analog pad: 3 drifting saws per note, a saturating ladder filter that opens slowly and wanders, copies left and right",
    gain: 0.48,
    p: { unison: 3, detune: 16, wave: 0, pwm: 0.15, sub: 0, filter: "ladder", cutoff: 650, res: 0.15, env: 1.2, fa: 0.6, fd: 1.5, fs: 0.4, track: 0.3, drive: 0.6, a: 0.4, d: 1.5, s: 0.85, r: 0.8, stereo: 1, level: 1 },
    alive: { drift: 5, driftRate: 0.2, wander: 0.5, envVar: 0.2, velBright: 0.4, timing: 0 },
  },
  /** Ladder bass: two saw / pulse copies into a driven Moog-style ladder with a snappy envelope, mono. */
  ladderBass: {
    kind: "analog",
    doc: "Ladder bass: 2 saw/pulse copies into a driven Moog-style ladder (saturation in the loop), a snappy filter envelope, mono",
    gain: 3,
    p: { unison: 2, detune: 7, wave: 0.25, pwm: 0.1, sub: 0, filter: "ladder", cutoff: 260, res: 0.35, env: 3.2, fa: 0.002, fd: 0.18, fs: 0.1, track: 0.5, drive: 1.6, a: 0.003, d: 0.25, s: 0.5, r: 0.06, stereo: 0, level: 1 },
    alive: { drift: 2, driftRate: 0.4, wander: 0.2, envVar: 0.2, velBright: 0.8, timing: 2 },
  },
  /** Diode bass: the same through the 303-style diode filter, more resonance. */
  diodeBass: {
    kind: "analog",
    doc: "Diode bass: one saw into the 303-style diode filter (lows kept under resonance), squelchy envelope, mono",
    gain: 3,
    p: { unison: 1, detune: 0, wave: 0, pwm: 0, sub: 0, filter: "diode", cutoff: 300, res: 0.6, env: 3, fa: 0.002, fd: 0.2, fs: 0.05, track: 0.5, drive: 1.5, a: 0.003, d: 0.25, s: 0.5, r: 0.06, stereo: 0, level: 1 },
    alive: { drift: 2, driftRate: 0.4, wander: 0.3, envVar: 0.2, velBright: 0.8, timing: 2 },
  },
  /** Morph pad: the wavetable position walks inside the note (dark to vowel to full and back). */
  morphPad: {
    kind: "morph",
    doc: "Morph pad: a wavetable whose position moves inside every note (dark flute > soft vowel > warm full), 2 drifting copies, gentle lowpass",
    gain: 0.17,
    p: { pos: 0.1, posEnv: 0.5, pa: 0.8, pd: 2, ps: 0.5, lfo: 0.12, lfoDepth: 0.12, cutoff: 2400, res: 0.15, detune: 9, a: 0.4, d: 1.5, s: 0.85, r: 0.8, level: 1 },
    alive: { drift: 4, driftRate: 0.2, wander: 0.5, envVar: 0.2, velBright: 0.5, timing: 0 },
  },
  /** Karplus-Strong pluck. */
  pluck: {
    kind: "pluck",
    doc: "Waveguide pluck (Karplus-Strong): a one-period delay loop, a pick-shaped noise burst, a damped release, a small body",
    gain: 0.7,
    p: { decay: 1.8, bright: 0.45, position: 0.18, tone: 0.5, body: 190, bodyLevel: 0.4, damp: 0.1, level: 1 },
    alive: { drift: 2, driftRate: 0.3, wander: 0, envVar: 0.3, velBright: 0.7, timing: 4 },
  },
  /** Mallet (marimba): tuned bar modes 1, 4, 10. */
  mallet: {
    kind: "modal",
    doc: "Mallet: a tuned bar (modes x 1, 4, 10: in tune with the chord), wooden, short, a soft thump",
    gain: 0.5,
    p: { modes: [[1, 1, 1.2], [4, 0.25, 0.35], [10, 0.06, 0.08]], pickup: 0, offset: 0, hammer: 0.5, bright: 5000, damp: 0.12, thump: 0.4, level: 1 },
    alive: { drift: 1, driftRate: 0.3, wander: 0, envVar: 0.25, velBright: 0.7, timing: 4 },
  },
  /** The resampled chord chop. */
  chop: {
    kind: "chop",
    doc: "Chord chop: a rich chord (FM e-piano + analog saws) rendered once, sampled at 26 kHz / 12 bit, then played chopped and repitched like a house sampler",
    gain: 0.75,
    p: { rate: 26040, bits: 12, interp: 0, lp: 7500, a: 0.0015, d: 0.4, s: 0.85, r: 0.05, start: 0, level: 1 },
    alive: { ...STILL, envVar: 0.5, velBright: 0.6, timing: 3 },
  },
} as const satisfies Record<string, V2Preset>;

export type V2VoiceName = keyof typeof V2_PRESETS;
export const V2_VOICE_NAMES = Object.keys(V2_PRESETS) as V2VoiceName[];

/** FM operator rows in presets: [ratio, detune cents, level, a, d, s, r, velocity sensitivity, key scaling]. */
export function fmOps(rows: readonly (readonly number[])[]) {
  return rows.map(([ratio, detune, level, a, d, s, r, vel, key]) => ({ ratio, detune, level, a, d, s, r, vel, key }));
}
