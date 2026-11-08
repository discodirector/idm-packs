import { analogPad } from "./analogPad.ts";
import { bassStack } from "./bassStack.ts";
import { brass } from "./brass.ts";
import { fmBell } from "./fmBell.ts";
import { fmKeys } from "./fmKeys.ts";
import { moogLead } from "./moogLead.ts";
import { pluck } from "./pluck.ts";
import { strings } from "./strings.ts";
import { supersaw } from "./supersaw.ts";
import type { VoiceHost, VoiceModule, VoiceNote, VoiceParams } from "./types.ts";
import { vox } from "./vox.ts";

export type { Source, VoiceHost, VoiceModule, VoiceNote, VoiceParams } from "./types.ts";
export { exciter, glue, glueParts, tape, type GlueSpec } from "./bus.ts";

/**
 * The synth voice library (each module documents its technique). A station style names a voice by its key and sets any
 * of its numeric params (validated against the module's `ranges`); the rest come from the module's `defaults`.
 */
export const VOICES = { supersaw, fmKeys, fmBell, analogPad, strings, pluck, vox, brass, moogLead, bassStack } as const satisfies Record<string, VoiceModule<any>>;
export type VoiceKind = keyof typeof VOICES;
export const VOICE_KINDS = Object.keys(VOICES) as VoiceKind[];

/** Plays one note of a voice: its params merged over the module's defaults. */
export function playVoice(kind: VoiceKind, h: VoiceHost, n: VoiceNote, params?: Partial<VoiceParams>) {
  const m = VOICES[kind] as VoiceModule<VoiceParams>;
  m.play(h, n, params ? ({ ...m.defaults, ...params } as VoiceParams) : m.defaults);
}

/** Saw / pulse / sine PeriodicWave coefficients at phase k / 16 (64 harmonics; the browser band-limits them). */
export function waveCoefficients(kind: "saw" | "pulse" | "sine", k: number, duty = 0.5): { real: Float32Array; imag: Float32Array } {
  const N = kind === "sine" ? 2 : 64;
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  const phi = (k / 16) * 2 * Math.PI;
  for (let m = 1; m < N; m++) {
    // b_m sin(m(wt + phi)) = b_m cos(m phi) sin(m wt) + b_m sin(m phi) cos(m wt).
    let b = 0;
    let a = 0;
    if (kind === "sine") b = 1;
    else if (kind === "saw") b = ((m % 2 ? 1 : -1) * 2) / (Math.PI * m);
    else {
      // A pulse of width `duty`, centred: cosine series 2 sin(pi m d) / (pi m).
      a = (2 * Math.sin(Math.PI * m * duty)) / (Math.PI * m);
    }
    real[m] = a * Math.cos(m * phi) + b * Math.sin(m * phi);
    imag[m] = b * Math.cos(m * phi) - a * Math.sin(m * phi);
  }
  return { real, imag };
}
