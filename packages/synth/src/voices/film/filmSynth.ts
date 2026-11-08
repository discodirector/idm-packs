import { hash32 } from "../../hash.ts";
import type { VoiceHost, VoiceNote } from "../types.ts";
import { midiOf, pairSum, phasedWave, pulseWave, tanhCurve } from "../util.ts";

/**
 * The film-score synth (Cinematic v2, engine.ts scoreSynth on sound/cinematic, tag cinematic-v2-approved), ported value
 * for value: the "expensive synths" reference. Every oscillator can be an ensemble of unison copies at their own
 * phases with a slow shared drift, split into two stereo halves; an optional drive; a highpass; an optional vowel /
 * body formant bank; an enveloped, key-tracked lowpass breathing on a slow LFO; an ADSR (or an exponential swell); an
 * optional tremolo. One renderer, many instruments: the string ensemble pad, violins, celli, spiccato, french horns,
 * the braam, low-brass stabs, the low strings and the "aah" / "ooh" choirs are presets of it (film/presets.ts).
 *
 * The shape of `FilmSynthParams` is the pack's `ScoreSynthVoice` (styledata.ts on sound/cinematic), so a Cinematic
 * voice literal plays here unchanged. Library mapping of the engine's context:
 * - the score arc's intensity (0..9) is `n.bright` x 9 (1 = the climax: the cutoff fully open);
 * - the market colour on the cutoff is 1 (neutral);
 * - the arc's level points are one level, `gain` (default 1);
 * - the part's glide memory is `n.from`; the per-part hash seed is `n.seed`;
 * - the ensemble-chorus send (`chorus`) is the caller's: put fx/ensemble.ts stringEnsemble on the voice's bus.
 */
export interface FilmSynthParams {
  kind?: "synth";
  osc: readonly { type: OscillatorType | "pulse25" | "pulse12"; detune: number; oct: number; level: number }[];
  spread: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  cutoff: number;
  track: number;
  env: number;
  fa: number;
  fd: number;
  q: number;
  vel: number;
  vib?: { rate: number; depth: number; delay: number };
  scoop?: number;
  scoopTime?: number;
  glide?: number;
  trem?: { rate: number; depth: number };
  drive?: number;
  hp?: number;
  level: number;
  unison?: { voices: number; cents: number; drift?: number; rate?: number };
  formants?: readonly { f: number; q: number; level: number }[];
  flfo?: { rate: number; depth: number };
  swell?: boolean;
  chorus?: number;
  /** Library: the note's level (the score's arc level at this note), default 1. */
  gain?: number;
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** An ADSR to `off`, then the release (engine.ts scoreEnv). */
export function scoreEnv(g: AudioParam, t: number, off: number, peak: number, a: number, d: number, sus: number, r: number, swell = false) {
  const floor = 0.0001;
  const s = Math.max(floor, peak * sus);
  if (swell) {
    g.setValueAtTime(floor, t);
    const top = off <= t + a ? Math.max(floor, peak * Math.pow(floor / peak, 1 - (off - t) / a)) : peak;
    g.exponentialRampToValueAtTime(top, Math.min(off, t + a));
    if (off > t + a) {
      if (off <= t + a + d) g.exponentialRampToValueAtTime(Math.max(floor, peak * Math.pow(Math.max(floor / peak, sus), (off - t - a) / d)), off);
      else {
        g.exponentialRampToValueAtTime(s, t + a + d);
        g.setValueAtTime(s, off);
      }
    }
    g.exponentialRampToValueAtTime(floor, off + r);
    g.setValueAtTime(0, off + r);
    return;
  }
  g.setValueAtTime(0, t);
  if (off <= t + a) {
    const at = Math.max(floor, (peak * (off - t)) / a);
    g.linearRampToValueAtTime(at, off);
  } else {
    g.linearRampToValueAtTime(peak, t + a);
    if (off <= t + a + d) {
      const x = (off - t - a) / d;
      g.exponentialRampToValueAtTime(Math.max(floor, peak * Math.pow(Math.max(floor / peak, sus), x)), off);
    } else {
      g.exponentialRampToValueAtTime(s, t + a + d);
      g.setValueAtTime(s, off);
    }
  }
  g.exponentialRampToValueAtTime(floor, off + r);
  g.setValueAtTime(0, off + r);
}

/** One note of the film synth. */
export function playFilmSynth(h: VoiceHost, n: VoiceNote, v: FilmSynthParams) {
  const ctx = h.ctx;
  const f = n.freq;
  const midi = Math.round(midiOf(f));
  const part = n.seed;
  const t = n.time;
  const len = n.length;
  const vel = n.vel;
  const intensity = 9 * clamp(n.bright, 0, 1);
  const prev = n.from ?? 0;
  const off = t + Math.max(0.01, len);
  const end = off + v.release + 0.08;
  const nodes: AudioNode[] = [];
  const sources: OscillatorNode[] = [];
  let vib: GainNode | null = null;
  if (v.vib && v.vib.depth > 0) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = v.vib.rate;
    vib = ctx.createGain();
    vib.gain.setValueAtTime(0, t);
    const from = t + Math.min(v.vib.delay, Math.max(0, len - 0.05));
    vib.gain.setValueAtTime(0, from);
    vib.gain.linearRampToValueAtTime(v.vib.depth, from + 0.4);
    lfo.connect(vib);
    sources.push(lfo);
    nodes.push(vib);
  }
  // Unison: each oscillator an ensemble of copies at their own phases, a slow shared drift on them.
  const uni = v.unison && v.unison.voices > 1 ? v.unison : null;
  const copies = uni ? uni.voices : 1;
  const drift: GainNode[] = [];
  if (uni && (uni.drift ?? 0) > 0) {
    const rate = uni.rate ?? 0.25;
    const seed = hash32(part, midi, Math.round(t * 1000));
    [rate, rate * 1.37].forEach((r, k) => {
      const lfo = ctx.createOscillator();
      lfo.setPeriodicWave(phasedWave(ctx, "sine", (seed >>> (k * 3)) % 8));
      lfo.frequency.value = r;
      sources.push(lfo);
      for (const sign of [1, -1]) {
        const g = ctx.createGain();
        g.gain.value = sign * (uni.drift ?? 0) * (k === 0 ? 1 : 0.7);
        lfo.connect(g);
        nodes.push(g);
        drift.push(g);
      }
    });
  }
  // One input per detune param: vibrato + drift summed pairwise first.
  const mods: AudioNode[] = drift.length ? drift.map((d) => (vib ? pairSum(ctx, vib, d, nodes) : d)) : vib ? [vib] : [];
  const halves = v.spread > 0 && v.osc.length * copies > 1 ? 2 : 1;
  const norm = 1 / Math.sqrt(v.osc.length * copies);
  const cutoff = clamp(v.cutoff * Math.pow(f / 261.63, v.track) * Math.pow(2, (-(9 - intensity) / 9) * 2 * v.vel), 60, 16000);
  const peakHz = clamp(cutoff + v.env * vel, 60, 18000);
  const level = 0.11 * v.level * vel;
  for (let half = 0; half < halves; half++) {
    let chain: AudioNode | null = null;
    v.osc.forEach((o, k) => {
      let group: AudioNode | null = null;
      for (let u = 0; u < copies; u++) {
        const j = k * copies + u;
        if (halves === 2 && (uni ? j : k) % 2 !== half) continue;
        const osc = ctx.createOscillator();
        if (o.type === "pulse25" || o.type === "pulse12") osc.setPeriodicWave(pulseWave(ctx, o.type === "pulse25" ? 0.25 : 0.125));
        else if (uni && o.type !== "sine") osc.setPeriodicWave(phasedWave(ctx, o.type, hash32(part, midi, j, Math.round(t * 1000)) % 8));
        else osc.type = o.type;
        const target = f * Math.pow(2, o.oct);
        if (v.glide && prev > 0 && prev !== f) {
          osc.frequency.setValueAtTime(prev * Math.pow(2, o.oct), t);
          osc.frequency.exponentialRampToValueAtTime(target, t + v.glide);
        } else osc.frequency.setValueAtTime(target, t);
        const scoop = v.scoop ?? 0;
        const det = o.detune + (uni ? (u / (copies - 1) - 0.5) * uni.cents : 0);
        osc.detune.setValueAtTime(det - scoop, t);
        if (scoop > 0) osc.detune.linearRampToValueAtTime(det, t + (v.scoopTime ?? 0.12));
        if (mods.length) mods[j % mods.length].connect(osc.detune);
        sources.push(osc);
        if (uni) {
          group = pairSum(ctx, group, osc, nodes);
          continue;
        }
        const g = ctx.createGain();
        g.gain.value = o.level * norm;
        osc.connect(g);
        nodes.push(g);
        chain = pairSum(ctx, chain, g, nodes);
      }
      if (group) {
        const g = ctx.createGain();
        g.gain.value = o.level * norm;
        (group as AudioNode).connect(g);
        nodes.push(g);
        chain = pairSum(ctx, chain, g, nodes);
      }
    });
    if (!chain) continue;
    let node: AudioNode = chain;
    if (v.drive && v.drive > 0) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = new Float32Array(tanhCurve(v.drive));
      shaper.oversample = "none";
      node.connect(shaper);
      nodes.push(shaper);
      node = shaper;
    }
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = v.hp ?? 30;
    hp.Q.value = 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = v.q;
    lp.frequency.setValueAtTime(cutoff, t);
    lp.frequency.linearRampToValueAtTime(peakHz, t + v.fa);
    lp.frequency.exponentialRampToValueAtTime(cutoff, t + v.fa + v.fd);
    node.connect(hp);
    nodes.push(hp, lp);
    if (v.formants && v.formants.length) {
      // A vowel: parallel band-passes summed into the lowpass.
      let bank: AudioNode | null = null;
      for (const fm of v.formants) {
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = fm.f;
        bp.Q.value = fm.q;
        const g = ctx.createGain();
        g.gain.value = fm.level;
        hp.connect(bp);
        bp.connect(g);
        nodes.push(bp, g);
        bank = pairSum(ctx, bank, g, nodes);
      }
      (bank as AudioNode).connect(lp);
    } else hp.connect(lp);
    if (v.flfo && v.flfo.depth > 0) {
      const lfo = ctx.createOscillator();
      lfo.setPeriodicWave(phasedWave(ctx, "sine", hash32(part, midi, half, Math.round(t * 1000)) % 8));
      lfo.frequency.value = v.flfo.rate;
      const g = ctx.createGain();
      g.gain.value = v.flfo.depth;
      lfo.connect(g);
      g.connect(lp.detune);
      sources.push(lfo);
      nodes.push(g);
    }
    const env = ctx.createGain();
    scoreEnv(env.gain, t, off, level, v.attack, v.decay, v.sustain, v.release, v.swell);
    lp.connect(env);
    nodes.push(env);
    let tail: AudioNode = env;
    if (v.trem && v.trem.depth > 0) {
      const trem = ctx.createGain();
      trem.gain.value = 1 - v.trem.depth / 2;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = v.trem.rate;
      const depth = ctx.createGain();
      depth.gain.value = v.trem.depth / 2;
      lfo.connect(depth);
      depth.connect(trem.gain);
      sources.push(lfo);
      env.connect(trem);
      nodes.push(trem, depth);
      tail = trem;
    }
    const dyn = ctx.createGain();
    dyn.gain.setValueAtTime(v.gain ?? 1, t);
    tail.connect(dyn);
    nodes.push(dyn);
    const side = halves === 2 ? (half === 0 ? -1 : 1) * v.spread * 0.7 : 0;
    nodes.push(...h.out(dyn, clamp(n.pan + side, -1, 1)));
  }
  h.play(sources, nodes, t, end);
}
