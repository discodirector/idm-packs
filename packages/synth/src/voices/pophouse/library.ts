import { PairBus } from "../host.ts";
import { POP_BASS, POP_BED, POP_CLAP, POP_GUITAR, POP_HORNS, POP_KICK, POP_PIANO, POP_SAWS, POP_VOC } from "../presets.ts";
import type { LibraryVoice, VoiceHost as LibraryHost, VoiceNote } from "../types.ts";
import { center, midiExact, notesOf, pairSum, stopSource, tanhCurve } from "../util.ts";
import { brassSection, type BrassOptions } from "./brassSection.ts";
import { conga, discoTom, layeredClap, layeredKick, noiseRide, shaker, type KickOptions } from "./drums.ts";
import { padChord, type PadOptions } from "./ensemble.ts";
import { formantVox, type VoxOptions } from "./formantVox.ts";
import type { BusIn, VoiceHost } from "./host.ts";
import { housePiano, type HousePianoOptions } from "./housePiano.ts";
import { guitarNote, type GuitarOptions } from "./ksGuitar.ts";
import { layerBass, type LayerBassOptions } from "./layerBass.ts";
import { supersaw, type SupersawOptions } from "./supersaw.ts";

// Pop House v3 (tag pop-house-v3-approved, 890af3c) in the library. The files in this folder are the pack's
// packages/synth/src/voices/*.ts, as the construction-kits branch keeps them (the same audio; busFx.tape also returns its
// levels). The adapter lends them the pack's host over a library host:
//   pan(amount, bus)  -> a unity input gain out at `amount` (h.out), summed pairwise into it (the engine's panNode)
//   bus.add(node)     -> center (stereo one-shots straight in)
//   sum -> pairSum;  end -> stop;  drive -> the engine's ukgDrive (tanh at drive rounded to 1/20);  noise -> noise
// The presets are each style's `ukg` spec merged over the engine's UKG_SPEC (what the pack played).

interface Lent {
  host: VoiceHost;
  bus: BusIn;
}
const lent = new WeakMap<LibraryHost, Lent>();

/** The Pop House host and its bus over a library host (one per host). */
export function popHost(h: LibraryHost): Lent {
  let l = lent.get(h);
  if (!l) {
    const ctx = h.ctx;
    const bus: BusIn = { add: (node) => void center(h, node) };
    l = {
      bus,
      host: {
        ctx,
        live: h.live ?? false,
        sum: (chain, node, rest) => pairSum(ctx, chain, node, rest),
        pan: (amount) => {
          const input = ctx.createGain();
          h.out(input, amount);
          const chain = new PairBus(ctx, input);
          return { add: (node: AudioNode) => chain.add(node), dest: input };
        },
        end: (src, rest, when) => stopSource(h, src as OscillatorNode, rest, when),
        drive: (node, drive, rest) => {
          if (drive <= 0.05) return node;
          const shaper = ctx.createWaveShaper();
          shaper.curve = new Float32Array(tanhCurve(Math.round(drive * 20) / 20));
          shaper.oversample = "none";
          node.connect(shaper);
          rest.push(shaper);
          return shaper;
        },
        noise: () => h.noise(),
      },
    };
    lent.set(h, l);
  }
  return l;
}

const SRC = ["pop-house-v3"] as const;
const first = <T>(book: Readonly<Record<string, unknown>>) => Object.values(book)[0] as T;
const asBook = <T>(book: unknown) => book as Readonly<Record<string, Partial<T>>>;
const midi = (n: VoiceNote) => midiExact(n.freq);

/** The supersaw's params: its options plus the song form's cutoff multiplier (`cutMul`, default 1). */
export type HouseSawParams = SupersawOptions & { cutMul?: number };
/** The pad bed's params: its options plus where in its LFO the chord starts (`phase` 0..1). */
export type HousePadParams = PadOptions & { phase?: number };
/** The formant vocal's params: its options plus the vowel it starts on and the one it glides to ([F1, F2] Hz). */
export type FormantVocalParams = VoxOptions & { from: readonly [number, number]; to: readonly [number, number] };
export type HouseBassParams = LayerBassOptions & { glide?: number };
export interface HouseClapParams {
  clap: number;
  body: number;
  wires: number;
  tail: number;
}

export const POP_VOICES: readonly LibraryVoice[] = [
  {
    id: "housePiano", category: "keys", source: SRC, register: [48, 84], chordal: true,
    doc: "Pop House's layered house piano (a chord voice): additive strings with per-partial decay and unison detune, a hammer thud, an FM bark and an optional M1 organ blend, rendered per note into velocity layers. The Robin S / Purple Disco Machine piano.",
    rules: ["Keep `organ` at or under ~0.3 (more reads as an organ).", "Under a vocal: drop the lowest tone and the octave double."],
    defaults: first<HousePianoOptions>(POP_PIANO), presets: asBook<HousePianoOptions>(POP_PIANO),
    play: (h, n, p: HousePianoOptions) => {
      const l = popHost(h);
      housePiano(l.host, n.time, notesOf(n), n.length, n.vel, p, l.bus);
    },
  } satisfies LibraryVoice<HousePianoOptions>,
  {
    id: "housePad", category: "pads", source: SRC, register: [48, 76], chordal: true,
    doc: "Pop House's pad bed (a chord voice): Juno (saw + pulse + sub), a string section or a choir, each tone at its own phase across the stereo field, a lowpass breathing on an LFO; the pack runs it into an ensemble chorus.",
    rules: ["`organ` kind is an organ by design: avoid it (owner: no organ-like tones).", "The `juno` pulse is one layer of three, under a lowpass; keep the cutoff under ~2.5 kHz."],
    defaults: first<HousePadParams>(POP_BED), presets: asBook<HousePadParams>(POP_BED),
    play: (h, n, p: HousePadParams) => {
      const l = popHost(h);
      padChord(l.host, n.time, notesOf(n), n.length, p, l.bus, p.phase ?? 0);
    },
  } satisfies LibraryVoice<HousePadParams>,
  {
    id: "houseGuitar", category: "plucks", source: SRC, register: [40, 76],
    doc: "Pop House's disco rhythm guitar: a Karplus-Strong string (pick position, palm mute, pick brightness) rendered per note, a body resonance, at its stereo place. The Nile Rodgers comp and the muted 16th scratch.",
    rules: ["Muted (`mute` >= 0.6) for 16th scratches; open strings only on sparse comps."],
    defaults: first<GuitarOptions>(POP_GUITAR), presets: asBook<GuitarOptions>(POP_GUITAR),
    play: (h, n, p: GuitarOptions) => {
      const l = popHost(h);
      guitarNote(l.host, n.time, midi(n), n.length, n.vel, p, l.bus, p.pan + n.pan);
    },
  } satisfies LibraryVoice<GuitarOptions>,
  {
    id: "brassSection", category: "brass", source: SRC, register: [48, 79], chordal: true,
    doc: "Pop House's brass section (a chord voice): trumpets (saws + a 33% pulse) and trombones an octave down per tone, a scoop up, breath, a fall-off, an enveloped lowpass and drive, the section spread across the field.",
    rules: ["Stabs on accents, not sustained chords.", "The pulse is under saws and a lowpass: keep `cutoff` under ~3 kHz in darker styles."],
    defaults: first<BrassOptions>(POP_HORNS), presets: asBook<BrassOptions>(POP_HORNS),
    play: (h, n, p: BrassOptions) => {
      const l = popHost(h);
      brassSection(l.host, n.time, notesOf(n), n.length, n.vel, p, l.bus);
    },
  } satisfies LibraryVoice<BrassOptions>,
  {
    id: "formantVocal", category: "choirs", source: SRC, register: [55, 79],
    doc: "Pop House's formant vocal: a glottal pulse through four formants gliding from one vowel to another, a pitch scoop, vibrato, breath and a consonant onset, rendered per note. Vocal chops, the hook, the talk box.",
    rules: ["A little `presence` (<= 3 dB) and almost no chorus or hall: the voice up front, dry."],
    defaults: first<FormantVocalParams>(POP_VOC), presets: asBook<FormantVocalParams>(POP_VOC),
    play: (h, n, p: FormantVocalParams) => {
      const l = popHost(h);
      formantVox(l.host, n.time, midi(n), n.length, p.from, p.to, p, l.bus, n.pan);
    },
  } satisfies LibraryVoice<FormantVocalParams>,
  {
    id: "houseSupersaw", category: "leads", source: SRC, register: [48, 84], chordal: true,
    doc: "Pop House's JP-8000 supersaw (a chord voice): 3..9 saws per tone at free phases and Szabo's detune offsets, a sine sub, an enveloped resonant lowpass, drive, split left and right. Future-house chords and the 16th ostinato.",
    rules: ["Bright by nature: not for the dark stations.", ...["Fuller = more voices and layers, never just more reverb."]],
    defaults: first<HouseSawParams>(POP_SAWS), presets: asBook<HouseSawParams>(POP_SAWS),
    play: (h, n, p: HouseSawParams) => {
      const l = popHost(h);
      supersaw(l.host, n.time, notesOf(n), n.length, n.vel, p, l.bus, p.cutMul ?? 1);
    },
  } satisfies LibraryVoice<HouseSawParams>,
  {
    id: "houseBass", category: "bass", source: SRC, register: [24, 48],
    doc: "Pop House's layered bass (an octave over the pack's sub): slap (FM thumb), saw, organ or pluck growl through an enveloped lowpass and drive, a top layer, highpassed off the sub; glides in from `n.from`.",
    rules: ["Under a separate sub: it is the mid layer.", "The `organ` kind reads as an organ: only under a piano house piano."],
    defaults: first<HouseBassParams>(POP_BASS), presets: asBook<HouseBassParams>(POP_BASS),
    play: (h, n, p: HouseBassParams) => {
      const l = popHost(h);
      layerBass(l.host, n.time, midi(n), n.length, n.vel, n.from ?? 0, p.glide ?? 0.06, p, l.bus);
    },
  } satisfies LibraryVoice<HouseBassParams>,
  {
    id: "houseKick", category: "drums", source: SRC, register: [36, 36],
    doc: "Pop House's layered kick: a swept sine body, a knock (the punch) and a click, each at its own level.",
    rules: ["The knock is what a phone hears: keep it >= 0.5."],
    defaults: first<KickOptions>(POP_KICK), presets: asBook<KickOptions>(POP_KICK),
    play: (h, n, p: KickOptions) => {
      const l = popHost(h);
      layeredKick(l.host, n.time, n.vel, p, l.bus);
    },
  } satisfies LibraryVoice<KickOptions>,
  {
    id: "houseClap", category: "drums", source: SRC, register: [39, 39],
    doc: "Pop House's rendered clap over a snare body and wires (each a level; `tail` its room), on the 2 and 4.",
    rules: ["Round and short: body first, wires and tail low (no hissy tails)."],
    defaults: first<HouseClapParams>(POP_CLAP), presets: asBook<HouseClapParams>(POP_CLAP),
    play: (h, n, p: HouseClapParams) => {
      const l = popHost(h);
      layeredClap(l.host, n.time, n.vel, p.clap, p.body, p.wires, p.tail, l.bus);
    },
  } satisfies LibraryVoice<HouseClapParams>,
  {
    id: "houseShaker", category: "drums", source: SRC, register: [70, 70],
    doc: "Pop House's 16th shaker: a rendered seed shake, accented or not (`accent` 1), at its pan.",
    rules: ["Accents and ghost notes; not a flat 16th carpet."],
    defaults: { accent: 0 }, presets: { plain: { accent: 0 }, accent: { accent: 1 } },
    play: (h, n, p: { accent: number }) => {
      const l = popHost(h);
      shaker(l.host, n.time, n.vel, p.accent > 0, n.pan, l.bus);
    },
  } satisfies LibraryVoice<{ accent: number }>,
  {
    id: "noiseRide", category: "drums", source: SRC, register: [51, 51],
    doc: "Pop House's noise ride: a ride with no fixed partials (nothing rings against the harmony), in `variant`s. The replacement for the metal ride the owner rejected in Piano Sunrise's drop.",
    rules: ["The ride to use where a ride must ring (no pitched metal)."],
    defaults: { variant: 0 }, presets: { a: { variant: 0 }, b: { variant: 1 } },
    play: (h, n, p: { variant: number }) => {
      const l = popHost(h);
      noiseRide(l.host, n.time, n.vel, p.variant, l.bus);
    },
  } satisfies LibraryVoice<{ variant: number }>,
  {
    id: "houseConga", category: "drums", source: SRC, register: [62, 64],
    doc: "Pop House's conga: a tuned membrane (low or `high`) with a `slap` 0..1, at its pan.",
    rules: ["A two-bar figure under the groove, low in the mix."],
    defaults: { high: 0, slap: 0.3 }, presets: { low: { high: 0, slap: 0.3 }, high: { high: 1, slap: 0.3 }, slap: { high: 1, slap: 1 } },
    play: (h, n, p: { high: number; slap: number }) => {
      const l = popHost(h);
      conga(l.host, n.time, n.vel, p.high > 0, p.slap, n.pan, l.bus);
    },
  } satisfies LibraryVoice<{ high: number; slap: number }>,
  {
    id: "discoTom", category: "drums", source: SRC, register: [45, 57],
    doc: "Pop House's disco tom: a pitched membrane at the note's pitch with its fall (the fills closing every 8th bar).",
    rules: ["Fills only."],
    defaults: {}, presets: { tom: {} },
    play: (h, n) => {
      const l = popHost(h);
      discoTom(l.host, n.time, n.vel, n.freq, n.pan, l.bus);
    },
  } satisfies LibraryVoice<Record<string, never>>,
];
