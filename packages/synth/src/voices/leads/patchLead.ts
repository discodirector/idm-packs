import type { Source, VoiceHost, VoiceNote } from "../types.ts";
import { pairSum, setWave, tanhCurve, type OscWave } from "../util.ts";

/**
 * The engine's lead-patch voice (engine.ts motifNote, leads.ts LeadPatch), ported value for value: an oscillator stack
 * (any wave or a narrow pulse, each with its octave and detune) with a shared vibrato and optional FM on the pitch,
 * optional breath noise, a tanh drive, an enveloped lowpass (or two vowel formants into it) and an ADSR. In Hamster Dark
 * Electro II v2 it is the "stacked driven saw" lead (Foghorn, Cold Pluck, Talkbox presets). The shape is the pack's
 * `LeadPatch` (minus id / name); `gain` here is the note level the engine passed (the section's lead level).
 */
export interface PatchLeadParams {
  osc: readonly { type: OscWave; detune: number; oct: number; level: number }[];
  fm?: { ratio: number; index: number; decay: number; floor: number };
  filter: { type: BiquadFilterType; cutoff: number; env: number; decay: number; q: number };
  formants?: readonly [number, number];
  amp: { a: number; d: number; s: number; r: number };
  vib?: { rate: number; depth: number; delay: number };
  glide?: number;
  blip?: number;
  noise?: number;
  drive?: number;
  gain: number;
  /** Library: the note's level (the engine's `level`: section x core / ornament), default 1. */
  level?: number;
  /** Library: caps the amp attack (s) so a slow patch still speaks on its step; left out, the patch plays as it is. */
  attackCap?: number;
}

export function playPatchLead(h: VoiceHost, n: VoiceNote, patch: PatchLeadParams) {
  const ctx = h.ctx;
  const time = n.time;
  const freq = n.freq;
  const level = patch.level ?? 1;
  const hold = Math.max(0.06, n.length * 0.94);
  const end = time + hold + patch.amp.r + 0.05;
  const nodes: AudioNode[] = [];
  const sources: Source[] = [];
  const prev = n.from ?? 0;

  let vib: GainNode | null = null;
  if (patch.vib) {
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(patch.vib.rate, time);
    vib = ctx.createGain();
    const depth = freq * (Math.pow(2, patch.vib.depth / 1200) - 1);
    vib.gain.setValueAtTime(0, time);
    vib.gain.setValueAtTime(0, time + Math.min(hold, patch.vib.delay));
    vib.gain.linearRampToValueAtTime(depth, time + Math.min(hold, patch.vib.delay) + 0.25);
    lfo.connect(vib);
    sources.push(lfo);
    nodes.push(vib);
  }
  let fm: GainNode | null = null;
  if (patch.fm) {
    const mod = ctx.createOscillator();
    mod.frequency.setValueAtTime(freq * patch.fm.ratio, time);
    fm = ctx.createGain();
    fm.gain.setValueAtTime(freq * patch.fm.index, time);
    fm.gain.exponentialRampToValueAtTime(Math.max(0.01, freq * patch.fm.index * patch.fm.floor), time + patch.fm.decay);
    mod.connect(fm);
    sources.push(mod);
    nodes.push(fm);
  }
  let pitchMod: AudioNode | null = vib ?? fm;
  if (vib && fm) {
    const both = ctx.createGain();
    vib.connect(both);
    fm.connect(both);
    nodes.push(both);
    pitchMod = both;
  }
  let chain: AudioNode | null = null;
  for (const o of patch.osc) {
    const osc = ctx.createOscillator();
    setWave(ctx, osc, o.type);
    const target = freq * Math.pow(2, o.oct);
    if (patch.glide && prev > 0) {
      osc.frequency.setValueAtTime(prev * Math.pow(2, o.oct), time);
      osc.frequency.exponentialRampToValueAtTime(target, time + patch.glide);
    } else if (patch.blip) {
      osc.frequency.setValueAtTime(target * Math.pow(2, patch.blip / 12), time);
      osc.frequency.exponentialRampToValueAtTime(target, time + 0.04);
    } else {
      osc.frequency.setValueAtTime(target, time);
    }
    osc.detune.setValueAtTime(o.detune, time);
    pitchMod?.connect(osc.frequency);
    const g = ctx.createGain();
    g.gain.value = o.level;
    osc.connect(g);
    nodes.push(g);
    sources.push(osc);
    chain = pairSum(ctx, chain, g, nodes);
  }
  if (patch.noise) {
    const src = ctx.createBufferSource();
    src.buffer = h.noise();
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = patch.noise;
    src.connect(g);
    nodes.push(g);
    sources.push(src);
    chain = pairSum(ctx, chain, g, nodes);
  }
  let voice = chain as AudioNode | null;
  if (!voice) return;
  if (patch.drive) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = new Float32Array(tanhCurve(patch.drive));
    shaper.oversample = "none";
    voice.connect(shaper);
    nodes.push(shaper);
    voice = shaper;
  }
  const filter = ctx.createBiquadFilter();
  filter.type = patch.filter.type;
  filter.Q.value = patch.filter.q;
  filter.frequency.setValueAtTime(patch.filter.cutoff + patch.filter.env, time);
  if (patch.filter.env > 0) filter.frequency.exponentialRampToValueAtTime(patch.filter.cutoff, time + patch.filter.decay);
  nodes.push(filter);
  if (patch.formants) {
    const [f1, f2] = patch.formants;
    const a = ctx.createBiquadFilter();
    const b = ctx.createBiquadFilter();
    a.type = "bandpass";
    b.type = "bandpass";
    a.frequency.value = f1;
    b.frequency.value = f2;
    a.Q.value = 6;
    b.Q.value = 8;
    voice.connect(a);
    voice.connect(b);
    const mix = ctx.createGain();
    a.connect(mix);
    b.connect(mix);
    mix.connect(filter);
    nodes.push(a, b, mix);
  } else {
    voice.connect(filter);
  }
  const amp = ctx.createGain();
  const peak = 0.11 * patch.gain * level;
  const { d, s: sus, r } = patch.amp;
  const a = patch.attackCap === undefined ? patch.amp.a : Math.min(patch.amp.a, patch.attackCap);
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.linearRampToValueAtTime(peak, time + a);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), time + a + d);
  amp.gain.setValueAtTime(Math.max(0.0001, peak * sus), time + Math.max(a + d, hold));
  amp.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(a + d, hold) + r);
  amp.gain.setValueAtTime(0, time + Math.max(a + d, hold) + r);
  filter.connect(amp);
  nodes.push(amp, ...h.out(amp, n.pan));
  h.play(sources, nodes, time, end);
}
