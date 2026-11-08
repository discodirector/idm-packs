import { makeV2Dsp } from "../../v2/dsp.ts";
import { V2_PRESETS, type V2AliveSpec, type V2VoiceName } from "../../v2/presets.ts";
import { chopShape, loadV2, playV2, resolveV2, v2Ready, type V2Play, type V2Resolved, type V2Slot } from "../../v2/voices.ts";
import { SYNTHV2_SLOTS } from "../presets.ts";
import type { LibraryVoice, Source, VoiceCategory, VoiceHost, VoiceNote } from "../types.ts";
import { center, midiExact, notesOf } from "../util.ts";

// Synth v2 (tag synth-v2-house-tracks-ready, 3750c2c; docs/sound/SYNTH-V2.md on sound/synth-v2) in the library: the
// sample-by-sample voices (physical Rhodes, waveguide pluck, 4-op FM, ladder / diode analog, morph wavetable, the chop
// sampler). packages/synth/src/v2/ is the branch's code as it is. On the branch they only play in the UK garage
// renderer's `ukg.v2` slots (120..145 BPM); here any library host plays them, at any tempo, two ways that give the
// same samples:
//   - worklet: when `loadSynthV2(ctx)` has run on the context, one AudioWorkletNode per event (the branch's playV2):
//     the audio thread renders it (the live radio);
//   - buffer: otherwise, the same DSP core (makeV2Dsp) renders the event on the calling thread into a stereo buffer,
//     block by block exactly as the worklet would from its start frame, cached by the event (offline renders, tests,
//     IDM Sounds, any page that has not loaded the worklet). No AudioWorklet needed.
// The engine slot's micro-timing (`alive.timing`) is the caller's: the library plays the note at `n.time`.

/** A Synth v2 voice's params: the pack slot's fields (level, octave, overrides of the preset and its alive layer). */
export interface SynthV2Params {
  /** The slot level 0..2 (x the preset's gain). */
  level: number;
  /** Register shift, semitones. */
  octave?: number;
  /** How far a chord's notes spread around `n.pan`, 0..1. */
  width?: number;
  /** Glide time from `n.from`, s. */
  glide?: number;
  /** Overrides of the preset's parameters (dsp.ts: `ops` rows, `modes` rows, `filter`, `algo`, numbers). */
  p?: Record<string, number | string | number[][]>;
  /** Overrides of the preset's alive layer. */
  alive?: Partial<V2AliveSpec>;
}

/** Adds the Synth v2 worklet to `ctx` (once): its voices then render on the audio thread. Optional (see above). */
export const loadSynthV2 = loadV2;

let dsp: ReturnType<typeof makeV2Dsp> | null = null;
const MAX_SEC = 30;

/** The event as the worklet would run it, rendered here from frame `start` in the worklet's blocks into a stereo buffer. */
function renderBuffer(ctx: BaseAudioContext, ev: Parameters<ReturnType<typeof makeV2Dsp>["createVoice"]>[0], start: number): AudioBuffer {
  dsp ??= makeV2Dsp();
  const sr = ctx.sampleRate;
  const voice = dsp.createVoice(ev, sr);
  const cap = Math.round((ev.hold + MAX_SEC) * sr);
  const L = new Float32Array(cap);
  const R = new Float32Array(cap);
  // The worklet's first call writes from the start frame to the end of its 128-frame block, then whole blocks.
  let at = 0;
  let n = 128 - (start % 128);
  while (at < cap) {
    n = Math.min(n, cap - at);
    const alive = voice.render(L.subarray(at, at + n), R.subarray(at, at + n), 0, n);
    at += n;
    n = 128;
    if (!alive) break;
  }
  const buf = ctx.createBuffer(2, Math.max(1, at), sr);
  buf.getChannelData(0).set(L.subarray(0, at));
  buf.getChannelData(1).set(R.subarray(0, at));
  return buf;
}

/** One event of a Synth v2 voice: a note, or the chord (`n.chord`) as one event. */
export function playSynthV2(voice: V2VoiceName, h: VoiceHost, n: VoiceNote, s: SynthV2Params) {
  const slot: V2Slot = { level: s.level, voice, octave: s.octave, p: s.p, alive: s.alive };
  const r = resolveV2(slot) as V2Resolved;
  if (!r) return;
  const notes = r.kind === "chop" ? [] : notesOf(n);
  let extra: Record<string, unknown> | undefined;
  if (r.kind === "chop") {
    // The chord sampled once per chord quality, around a reference in F#3..F4, and repitched to its root (the sampler).
    const tones = notesOf(n);
    const root = tones[0];
    const semi = ((((root - 60) % 12) + 18) % 12) - 6;
    const ref = root - semi;
    extra = { chord: chopShape(tones, root), root: ref, semi };
  }
  const e: V2Play = { time: n.time, notes, vel: n.vel, hold: n.length, seed: n.seed, pan: n.pan, width: s.width ?? (notes.length > 1 ? 0.5 : 0), from: n.from ?? 0, glide: n.from !== undefined ? (s.glide ?? 0.06) : 0, extra };
  const ctx = h.ctx;
  if (v2Ready(ctx)) {
    // The worklet: exactly the branch's playV2, into the host's bus (stereo, unity).
    playV2(ctx, h.live ?? false, { add: (node) => void center(h, node) }, r, e);
    return;
  }
  // The buffer: the same event the worklet would get (voices.ts playV2), rendered here.
  const ev = {
    kind: r.kind,
    notes: e.notes.map((m) => m + r.octave),
    vel: e.vel,
    hold: Math.max(0.01, e.hold),
    seed: e.seed >>> 0,
    gain: r.gain,
    pan: e.pan ?? 0,
    width: e.width ?? 0,
    from: e.from ?? 0,
    glide: e.glide ?? 0,
    alive: { drift: r.alive.drift, driftRate: r.alive.driftRate, wander: r.alive.wander, envVar: r.alive.envVar, velBright: r.alive.velBright },
    p: extra ? { ...r.p, ...extra } : r.p,
  };
  if (ev.kind === "chop") {
    dsp ??= makeV2Dsp();
    ev.p = { ...ev.p, src: dsp.chopSource(ev, ctx.sampleRate) };
  }
  const start = Math.round(Math.max(0, n.time) * ctx.sampleRate);
  const { src: _src, ...keyP } = ev.p as Record<string, unknown>;
  const key = `v2:${voice}:${start % 128}:${JSON.stringify({ ...ev, p: keyP })}`;
  const buf = h.buffer(key, () => renderBuffer(ctx, ev, start));
  const node = ctx.createBufferSource();
  node.buffer = buf;
  const at = start / ctx.sampleRate;
  h.play([node as Source], center(h, node), at, at + buf.duration + 0.01);
}

interface Def {
  id: string;
  voice: V2VoiceName;
  category: VoiceCategory;
  register: readonly [number, number];
  rules: readonly string[];
  caution?: string;
  chordal?: boolean;
  preferred?: string;
}

const DEFS: readonly Def[] = [
  { id: "physRhodes", voice: "rhodes", category: "keys", register: [43, 79], chordal: true, rules: ["The bark is velocity (0.35..1: round to barking); no filter tricks.", "Dry: the room is the pack's."] },
  { id: "fmEp", voice: "fmEp", category: "keys", register: [48, 79], chordal: true, rules: ["Comp chords; hard hits bark."] },
  { id: "fmOrgan", voice: "fmOrgan", category: "keys", register: [48, 76], chordal: true, rules: ["A short stab, never a held chord."], caution: "an organ stab by design (the owner: no organ tones); short stabs only, if at all" },
  { id: "malletV2", voice: "mallet", category: "bells", register: [55, 91], rules: ["Tuned bar (1, 4, 10): chord tones, short motifs."] },
  { id: "v2Bell", voice: "bell", category: "bells", register: [60, 96], chordal: true, rules: ["Integer ratios only (1, 2, 4): every partial a harmonic of its chord tone, safe on chords."] },
  { id: "ladderPad", voice: "analogPad", category: "pads", register: [48, 76], chordal: true, rules: ["Saws only (wave 0), the ladder under ~1 kHz: a warm bed, never an organ."] },
  { id: "morphPad", voice: "morphPad", category: "pads", register: [48, 76], chordal: true, rules: ["The timbre moves inside every chord: no LFO needed on top."] },
  { id: "waveguidePluck", voice: "pluck", category: "plucks", register: [45, 84], rules: ["The owner's favourite (Slow Bloom's motif): chord tones on a figure, alternating sides.", "Dark pick (`bright` 0.35..0.45) under the beat."], preferred: "slowBloom.motif" },
  { id: "ladderBass", voice: "ladderBass", category: "bass", register: [24, 52], rules: ["Mono, over a separate sub; glide from `n.from`."] },
  { id: "diodeBass", voice: "diodeBass", category: "bass", register: [24, 52], rules: ["Accents squelch: vary the velocity; resonance <= 0.75."] },
  { id: "fmBass", voice: "fmBass", category: "bass", register: [24, 48], rules: ["Short notes: the index snaps down after the attack."] },
  { id: "chordChop", voice: "chop", category: "fx", register: [48, 72], chordal: true, rules: ["Short hits only (<= 1.5 16ths): it is a sampled stab.", "The 10-12 bit grit is the point; keep the lowpass under ~8 kHz."] },
];

const short = (id: string) => id.replace(/^v2-/, "").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** The pack's slots (synth-v2-tracks.ts `ukg.v2`) naming `voice`, by `<track>.<slot>`. */
function slotsOf(voice: V2VoiceName): Record<string, Partial<SynthV2Params>> {
  const out: Record<string, Partial<SynthV2Params>> = {};
  for (const [name, slot] of Object.entries(SYNTHV2_SLOTS as unknown as Record<string, V2Slot>)) {
    if (slot.voice !== voice) continue;
    const [style, part] = name.split(".");
    out[`${short(style)}.${part}`] = { level: slot.level, ...(slot.octave ? { octave: slot.octave } : {}), ...(slot.p ? { p: slot.p } : {}), ...(slot.alive ? { alive: slot.alive } : {}) };
  }
  return out;
}

export const SYNTHV2_VOICES: readonly LibraryVoice[] = DEFS.map((d) => {
  const preset = V2_PRESETS[d.voice];
  const presets: Record<string, Partial<SynthV2Params>> = { default: { level: 1 }, ...slotsOf(d.voice) };
  return {
    id: d.id, category: d.category, source: ["synth-v2"], register: d.register, rules: d.rules,
    doc: `Synth v2 ${preset.kind} voice "${d.voice}" (AudioWorklet DSP, alive layer: drift, wander, velocity to timbre): ${preset.doc}.`,
    ...(d.caution ? { caution: d.caution } : {}), ...(d.chordal ? { chordal: true } : {}),
    defaults: { level: 1 }, presets, preferred: d.preferred && presets[d.preferred] ? d.preferred : "default",
    play: (h: VoiceHost, n: VoiceNote, p: SynthV2Params) => playSynthV2(d.voice, h, n, p),
  } satisfies LibraryVoice<SynthV2Params>;
});

