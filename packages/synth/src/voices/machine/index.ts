/** The synth voice library (see host.ts). */
export type { Source, VoiceBus, VoiceHost } from "./host.ts";
export { layerBass, type BassPlay, type LayerBassSpec } from "./bass.ts";
export { bleep, type BleepSpec } from "./bleep.ts";
export { choir, type ChoirSpec, type Vowel } from "./choir.ts";
export { kickLayers, machineHat, perc, snareLayers, type KickLayers, type MachineHat, type PercVoice, type SnareLayers } from "./drums.ts";
export { fmTone, type FmOp, type FmSpec } from "./fm.ts";
export { strings, type StringSpec } from "./strings.ts";
export { unison, type UnisonPlay, type UnisonSpec } from "./unison.ts";
export { adsr, hz, satCurve, shaper, wave, type WaveName } from "./util.ts";
