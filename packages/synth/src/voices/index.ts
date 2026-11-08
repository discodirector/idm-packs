import { analogPad } from "./pads/analogPad.ts";
import { bassStack } from "./bass/bassStack.ts";
import { brass } from "./brass/brass.ts";
import { fmBell } from "./bells/fmBell.ts";
import { fmKeys } from "./keys/fmKeys.ts";
import { moogLead } from "./leads/moogLead.ts";
import { pluck } from "./plucks/pluck.ts";
import { strings } from "./strings/strings.ts";
import { supersaw } from "./leads/supersaw.ts";
import type { VoiceHost, VoiceModule, VoiceNote, VoiceParams } from "./types.ts";
import { vox } from "./choirs/vox.ts";

/**
 * The shared synth voice library (docs/sound/VOICE-LIBRARY.md). Nothing in the engine imports it yet: every station
 * sounds exactly as before (engine-trace identical). Packs adopt it by naming a voice:
 * - `LIBRARY` / `LIBRARY_BY_ID` / `shelf` / `paramsOf` (catalog.ts): every voice on its shelf with its doc, rules and
 *   presets (presets.ts: exactly what the approved packs played);
 * - `VOICES` / `playVoice` / `waveCoefficients`: the numeric voice modules under the same names and API as
 *   sound/hiphop-trap's packages/synth/src/voices/index.ts, so Hip-Hop & Trap re-points here by changing its import;
 * - the ported engine voices (film synth, felt piano, electro bass / pad, lead patch, 808, kick and drum layers) take
 *   the packs' own spec shapes (ScoreSynthVoice, ElectroBassSpec, LeadPatch, KickSpec, DrumVoice, ...);
 * - bus processing: glue / tape / exciter, ensemble choruses, plate and hall (+ shimmer), the Shepard riser, a duck;
 * - `createHost`: a standalone host (auditions, the Style Lab, IDM Sounds renders).
 */
export type { LibraryVoice, Source, VoiceCategory, VoiceHost, VoiceModule, VoiceNote, VoiceParams, VoiceSource } from "./types.ts";
export { waveCoefficients } from "./waves.ts";
export { createHost, PairBus, type HostOptions } from "./host.ts";
export { LIBRARY, LIBRARY_BY_ID, paramsOf, shelf, SHELVES } from "./catalog.ts";
export * as PRESETS from "./presets.ts";
export { audition, auditionVoice, entries as auditionEntries, SECONDS as AUDITION_SECONDS } from "./audition.ts";
export { finishSample, inSamplePacks, isMuted, playSample, presetGain, SAMPLE_RATE as SAMPLE_PACK_RATE, sampleMidis, samplePacks, sampleSlug, sfzOf, type SampleNote, type SamplePackPlan, type SamplePreset } from "./samples.ts";

export { playFilmSynth, type FilmSynthParams } from "./film/filmSynth.ts";
export { playFeltPiano, type FeltPianoParams } from "./keys/feltPiano.ts";
export { playElectroBass, type ElectroBassParams } from "./bass/electroBass.ts";
export { playBass808, type Bass808Params } from "./bass/bass808.ts";
export { playElectroPad, type ElectroPadParams } from "./pads/electroPad.ts";
export { playPatchLead, type PatchLeadParams } from "./leads/patchLead.ts";
export { CLAP, noiseHit, playHit, playKick, toneHit, type DrumLayer, type HitParams, type KickParams } from "./drums/drums.ts";

export { exciter, glue, tape, type GlueSpec } from "./fx/bus.ts";
export { ensembleChorus, stringEnsemble, type EnsembleChorusSpec, type StringEnsembleSpec } from "./fx/ensemble.ts";
export { hall, plate, type HallSpec, type PlateSpec, type SendBus } from "./fx/space.ts";
export { shepard, type ShepardSpec } from "./fx/riser.ts";
export { sidechain } from "./fx/duck.ts";

// Phase 2: the imported packs' adapters (each pack's code stays in its folder, as its engine plays it).
export { machineHost, type MachineBassParams, type MachineChoirParams, type MachineFmParams, type MachineHatParams, type MachinePercParams, type MachineStackParams } from "./machine/library.ts";
export { popHost, type FormantVocalParams, type HouseBassParams, type HouseClapParams, type HousePadParams, type HouseSawParams } from "./pophouse/library.ts";
export { playLiquid, type LiquidParams } from "./dnb/library.ts";
export { loadSynthV2, playSynthV2, type SynthV2Params } from "./v2/library.ts";
export { exciter as popExciter, tape as popTape, widen as popWiden } from "./pophouse/busFx.ts";
export { ensembleFx as popEnsemble } from "./pophouse/ensemble.ts";

/**
 * The numeric voice modules (Hip-Hop & Trap v3's `VOICES`, same keys): a station style's `SynthLayer` names one and
 * sets any of its numeric params (validated against the module's `ranges`); the rest come from the module's `defaults`.
 */
export const VOICES = { supersaw, fmKeys, fmBell, analogPad, strings, pluck, vox, brass, moogLead, bassStack } as const satisfies Record<string, VoiceModule<any>>;
export type VoiceKind = keyof typeof VOICES;
export const VOICE_KINDS = Object.keys(VOICES) as VoiceKind[];

/** Plays one note of a numeric voice: its params merged over the module's defaults. */
export function playVoice(kind: VoiceKind, h: VoiceHost, n: VoiceNote, params?: Partial<VoiceParams>) {
  const m = VOICES[kind] as VoiceModule<VoiceParams>;
  m.play(h, n, params ? ({ ...m.defaults, ...params } as VoiceParams) : m.defaults);
}
