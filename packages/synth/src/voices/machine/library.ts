import { MACHINE_BASS, MACHINE_BLEEPS, MACHINE_CHOIR, MACHINE_COUNTER, MACHINE_HATS, MACHINE_KICK, MACHINE_PERC, MACHINE_SNARE, MACHINE_STACK, MACHINE_STRINGS } from "../presets.ts";
import type { LibraryVoice, VoiceHost as LibraryHost, VoiceNote } from "../types.ts";
import { center, midiExact, notesOf, pairSum, stopSource } from "../util.ts";
import { layerBass, type LayerBassSpec } from "./bass.ts";
import { bleep, type BleepSpec } from "./bleep.ts";
import { choir, type ChoirSpec, type Vowel } from "./choir.ts";
import { kickLayers, machineHat, perc, snareLayers, type KickLayers, type MachineHat, type PercVoice, type SnareLayers } from "./drums.ts";
import { fmTone, type FmSpec } from "./fm.ts";
import type { VoiceHost } from "./host.ts";
import { strings, type StringSpec } from "./strings.ts";
import { unison, type UnisonSpec } from "./unison.ts";

// Machine Electro v4.2 (tag machine-electro-v4.2-approved, bfdee2c; on air on Squeekchain) in the library: its voices
// stay in this folder exactly as the engine plays them (engine.ts imports ./voices/machine/index.ts), and these
// catalog entries play them through any library host. The adapter maps the pack's host onto the library's:
//   out(node, bus)       -> center (straight in, unity: the bass, the kick layers)
//   out(node, bus, pan)  -> out(node, pan) (the engine's panNode adds a unity input gain: the same samples)
//   sum                  -> pairSum;  end -> stop (the voice starts its own sources);  noise -> noise
// The engine's market terms (cutoff multiplier `bright`, the bass knob and heat) are params with neutral defaults.

const hosts = new WeakMap<LibraryHost, VoiceHost>();

/** The Machine Electro host over a library host (one per host). */
export function machineHost(h: LibraryHost): VoiceHost {
  let m = hosts.get(h);
  if (!m) {
    m = {
      ctx: h.ctx,
      out: (node, _bus, pan) => (pan === undefined ? center(h, node) : h.out(node, pan)),
      sum: (chain, node, rest) => pairSum(h.ctx, chain, node, rest),
      end: (src, rest, when) => stopSource(h, src, rest, when),
      noise: () => h.noise(),
    };
    hosts.set(h, m);
  }
  return m;
}

const SRC = ["machine-electro-v4.2"] as const;
const first = <T>(book: Readonly<Record<string, T>>) => Object.values(book)[0];
const asBook = <T>(book: unknown) => book as Readonly<Record<string, Partial<T>>>;

/** The unison stack's params: the spec plus the engine's cutoff multiplier and glide time. */
export type MachineStackParams = UnisonSpec & { bright?: number; glide?: number };
/**
 * The layered bass's params: the spec plus where the slow knob is (`knobAt` 0..1, default 0.5; the engine moves it over `knob` bars),
 * the market's heat and cutoff multiplier, the accent velocity.
 */
export type MachineBassParams = LayerBassSpec & { knob?: number; knobAt?: number; heat?: number; bright?: number; accentVel?: number };
export type MachineChoirParams = ChoirSpec & { vowels: readonly Vowel[] };
export type MachineFmParams = FmSpec & { bright?: number };
/** The machine hat's params: the spec plus `openHat` 1 (the long, open decay). */
export type MachineHatParams = MachineHat & { openHat?: number };
export interface MachinePercParams {
  voice: PercVoice;
  tune: number;
  decay: number;
}

const midi = (n: VoiceNote) => midiExact(n.freq);

export const MACHINE_VOICES: readonly LibraryVoice[] = [
  {
    id: "machineStack", category: "leads", source: SRC, register: [43, 79],
    doc: "Machine Electro's unison stack: 1..9 saws (or a chosen wave) at uneven detune, a square sub 8vb and a 25% pulse 8va as options, drive into a resonant lowpass with its own envelope and key tracking, scoop and delayed vibrato, spread in two halves. The pack's chord stabs, leads and poly arps.",
    rules: ["Dark: cutoff floor under ~1.2 kHz, env as the bite, not a bright static filter.", "The `top` pulse only as a thin layer under the saws (no reedy leads)."],
    defaults: first(MACHINE_STACK) as unknown as MachineStackParams, presets: asBook<MachineStackParams>(MACHINE_STACK), preferred: Object.keys(MACHINE_STACK)[0],
    play: (h, n, p: MachineStackParams) => unison(machineHost(h), n.time, midi(n), n.length, n.vel, p, "lead", { pan: n.pan, bright: p.bright ?? 1, from: n.from !== undefined ? midiExact(n.from) : undefined, glide: p.glide }),
  } satisfies LibraryVoice<MachineStackParams>,
  {
    id: "machineStrings", category: "strings", source: SRC, register: [48, 76], chordal: true,
    doc: "Machine Electro's string machine (a chord voice): three detuned saw lines per tone on slow and fast ensemble LFOs, an optional 4' pulse, high- and lowpassed, spread wide. The cold string bed under the machine.",
    rules: ["Keep the 4' `octave` low (<= 0.3): it is a pulse.", "Highpass it (hp >= 180 Hz) under the bass."],
    defaults: first(MACHINE_STRINGS) as unknown as StringSpec, presets: asBook<StringSpec>(MACHINE_STRINGS),
    play: (h, n, p: StringSpec & { bright?: number }) => strings(machineHost(h), n.time, notesOf(n), n.length, n.vel, p, "harm", p.bright ?? 1),
  } satisfies LibraryVoice<StringSpec & { bright?: number }>,
  {
    id: "machineChoir", category: "choirs", source: SRC, register: [48, 72], chordal: true,
    doc: "Machine Electro's formant choir (a chord voice): a buzz and breath through three vowel formants per side, walking its `vowels` across the note; optional ring modulation for the robot.",
    rules: ["Low and slow: long attacks, dark vowels (oo / oh) in the dark styles."],
    defaults: first(MACHINE_CHOIR) as unknown as MachineChoirParams, presets: asBook<MachineChoirParams>(MACHINE_CHOIR),
    play: (h, n, p: MachineChoirParams) => choir(machineHost(h), n.time, notesOf(n), n.length, n.vel, p.vowels, p, "harm"),
  } satisfies LibraryVoice<MachineChoirParams>,
  {
    id: "machineFm", category: "keys", source: SRC, register: [48, 84],
    doc: "Machine Electro's FM tone: a chain of modulators (each with its own index fall) on two detuned carriers spread L/R. The counter-lines' glassy FM keys.",
    rules: ["Integer ratios for anything that sits on the chord; inharmonic ratios only for sparse lines."],
    defaults: first(MACHINE_COUNTER) as unknown as MachineFmParams, presets: asBook<MachineFmParams>(MACHINE_COUNTER),
    play: (h, n, p: MachineFmParams) => fmTone(machineHost(h), n.time, midi(n), n.length, n.vel, p, "lead", n.pan, p.bright ?? 1),
  } satisfies LibraryVoice<MachineFmParams>,
  {
    id: "machineBass", category: "bass", source: SRC, register: [24, 48],
    doc: "Machine Electro's layered bass: a clean sub (sine or triangle), a mid layer of detuned oscillators through an accented resonant lowpass on a slow knob, tanh drive, a highpass off the sub and a grit band.",
    rules: ["Sub mono and clean; the mid carries the riff.", "Accent (vel >= 0.8) opens the filter; the knob (0..1) is the slow hand on the cutoff."],
    defaults: first(MACHINE_BASS) as unknown as MachineBassParams, presets: asBook<MachineBassParams>(MACHINE_BASS),
    play: (h, n, p: MachineBassParams) =>
      layerBass(machineHost(h), n.time, midi(n), n.length, p, { from: n.from !== undefined ? midiExact(n.from) : null, accent: n.vel >= (p.accentVel ?? 0.8), open: p.knobAt ?? 0.5, bright: p.bright ?? 1, heat: p.heat ?? 0 }),
  } satisfies LibraryVoice<MachineBassParams>,
  {
    id: "machineBleep", category: "fx", source: SRC, register: [60, 96],
    doc: "Machine Electro's sci-fi bleep: a short wave through a lowpass, optional ring modulation and a sonar ping answering on the other side.",
    rules: ["Sparse, on chord tones, low in the mix.", "Ring ratios 1.41 / 2.76 are metallic: only for short blips, never sustained."],
    defaults: first(MACHINE_BLEEPS) as unknown as BleepSpec, presets: asBook<BleepSpec>(MACHINE_BLEEPS),
    play: (h, n, p: BleepSpec) => bleep(machineHost(h), n.time, midi(n), n.vel, p, "fx", n.pan),
  } satisfies LibraryVoice<BleepSpec>,
  {
    id: "machineKick", category: "drums", source: SRC, register: [36, 36],
    doc: "Machine Electro's kick layers (added over a kick): a triangle knock, a band click and a driven sine boom.",
    rules: ["Layers, not a kick on their own: put them over `kick` or a pack's kick."],
    defaults: first(MACHINE_KICK) as unknown as KickLayers, presets: asBook<KickLayers>(MACHINE_KICK),
    play: (h, n, p: KickLayers) => kickLayers(machineHost(h), n.time, n.vel, p),
  } satisfies LibraryVoice<KickLayers>,
  {
    id: "machineSnare", category: "drums", source: SRC, register: [38, 38],
    doc: "Machine Electro's snare layers: tuned bodies, a highpassed snap, a four-burst clap and air (added over a backbeat snare).",
    rules: ["Round body first; snap and air short (no hissy tails)."],
    defaults: first(MACHINE_SNARE) as unknown as SnareLayers, presets: asBook<SnareLayers>(MACHINE_SNARE),
    play: (h, n, p: SnareLayers) => snareLayers(machineHost(h), n.time, n.vel, p, n.pan),
  } satisfies LibraryVoice<SnareLayers>,
  {
    id: "machineHat", category: "drums", source: SRC, register: [42, 42],
    doc: "The machine hat: the 808's six squares through a bandpass plus a noise breath, high- and lowpassed (no fizz), a soft attack and an early reflection on the other side. `openHat` 1: the long decay.",
    rules: ["Sparse lanes with accents and gaps, not a 16th carpet."],
    defaults: first(MACHINE_HATS) as unknown as MachineHatParams, presets: asBook<MachineHatParams>(MACHINE_HATS),
    play: (h, n, p: MachineHatParams) => machineHat(machineHost(h), n.time, n.vel, p, (p.openHat ?? 0) > 0, n.pan),
  } satisfies LibraryVoice<MachineHatParams>,
  {
    id: "machinePerc", category: "drums", source: SRC, register: [50, 50],
    doc: "Machine Electro's 808 percussion: tom, conga, cowbell, clave, rim, shaker, crash, clap (`voice`), pitch `tune` and length `decay` multipliers.",
    rules: ["The cowbell and crash are metal: short, sparse, never on every beat."],
    defaults: first(MACHINE_PERC) as unknown as MachinePercParams, presets: asBook<MachinePercParams>(MACHINE_PERC),
    play: (h, n, p: MachinePercParams) => perc(machineHost(h), n.time, p.voice, n.vel, p.tune, p.decay, n.pan, "perc"),
  } satisfies LibraryVoice<MachinePercParams>,
];
