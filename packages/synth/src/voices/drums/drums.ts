import type { Source, VoiceHost, VoiceNote } from "../types.ts";
import { center, pulseEnv, tanhCurve } from "../util.ts";

/**
 * Drum layers, ported value for value from engine.ts (kick, toneHit, noiseHit, crushHit, drum, clap; the kick's opt-in
 * punch from sound/hamster-electro-2). Every station's synthesised kit is built from these: a kick is a swept body
 * (optionally driven), a noise click and a punch knock; a snare / clap / rim / perc is 1..6 layers fired together
 * (a pitched body, filtered noise bursts, a crushed crack, the house clap). The shapes are styledata.ts `KickSpec` and
 * `DrumVoice`, so a pack's kit plays here unchanged. `n.vel` is the hit's velocity, `n.pan` its place; `n.freq` is
 * ignored (kits are tuned by their own Hz).
 */
export type Wave = "sine" | "square" | "sawtooth" | "triangle";

export interface KickParams {
  osc?: OscillatorType;
  start: number;
  end: number;
  sweep: number;
  decay: number;
  click: number;
  clickHp?: number;
  drive?: number;
  body?: number;
  punch?: { freq: number; decay: number; level: number };
}

interface LayerBase {
  level: number;
  at?: number;
  tail?: boolean;
  pan?: number;
  flip?: boolean;
  accent?: boolean;
}
export interface ToneLayer extends LayerBase {
  tone: Wave;
  freq: number;
  to?: number;
  sweep?: number;
  decay: number;
  attack?: number;
  floor?: number;
}
export interface NoiseLayer extends LayerBase {
  noise: "bandpass" | "highpass" | "lowpass";
  freq: number;
  to?: number;
  q: number;
  decay: number;
  attack?: number;
  color?: number;
  press?: number;
}
export interface CrushLayer {
  crush: number;
  filter: "bandpass" | "highpass";
  freq: number;
  q?: number;
  decay: number;
  level: number;
  at?: number;
  tail?: boolean;
  lp?: number;
}
export interface ClapLayer {
  clap: number;
  at?: number;
  flip?: boolean;
}
export type DrumLayer = ToneLayer | NoiseLayer | CrushLayer | ClapLayer;

export interface HitParams {
  layers: readonly DrumLayer[];
  /** Scales the decay of `tail` layers (ghosts and rolls are short), default 1. */
  tail?: number;
  /** false leaves out the `accent` layers (a ghost), default true. */
  accent?: boolean;
}

/** The house clap: three bandpassed bursts (engine.ts CLAP). */
export const CLAP: readonly DrumLayer[] = [
  { noise: "bandpass", freq: 1250, q: 1.1, decay: 0.02, level: 0.68 },
  { noise: "bandpass", freq: 1250, q: 1.1, decay: 0.02, level: 0.68, at: 1 * 0.011 },
  { noise: "bandpass", freq: 1250, q: 1.1, decay: 0.24, level: 0.68, at: 2 * 0.011 },
];

function bitCurve(bits: number): Float32Array {
  const n = 257;
  const curve = new Float32Array(n);
  const levels = 2 ** (Math.max(2, bits) - 1);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.round(x * levels) / levels;
  }
  return curve;
}

/** A kick (engine.ts kick): body and click unpanned on the kick bus; the punch knock panned centre (as the engine). */
export function playKick(h: VoiceHost, n: VoiceNote, k: KickParams) {
  const ctx = h.ctx;
  const time = n.time;
  const velocity = n.vel;
  const osc = ctx.createOscillator();
  osc.type = k.osc ?? "sine";
  const body = ctx.createGain();
  osc.frequency.setValueAtTime(k.start, time);
  osc.frequency.exponentialRampToValueAtTime(Math.max(28, k.end), time + k.sweep);
  pulseEnv(body.gain, time, 0.003, 0.45 * velocity * (k.body ?? 1), k.decay);
  osc.connect(body);
  const rest: AudioNode[] = [body];
  if (k.drive) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = new Float32Array(tanhCurve(k.drive));
    shaper.oversample = "none";
    body.connect(shaper);
    const trim = ctx.createGain();
    trim.gain.value = 0.85;
    shaper.connect(trim);
    rest.push(shaper, trim, ...center(h, trim));
  } else {
    rest.push(...center(h, body));
  }
  h.play([osc], rest, time, time + k.decay + 0.1);
  if (k.click > 0) {
    const click = ctx.createBufferSource();
    click.buffer = h.noise();
    click.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = k.clickHp ?? 1800;
    const g = ctx.createGain();
    pulseEnv(g.gain, time, 0.001, 0.2 * velocity * k.click, 0.012);
    click.connect(hp);
    hp.connect(g);
    h.play([click], [hp, g, ...center(h, g)], time, time + 0.05);
  }
  if (k.punch && k.punch.level > 0) {
    const p = k.punch;
    toneHit(h, time, 0.45 * velocity * (k.body ?? 1) * p.level, { type: "triangle", freq: p.freq, to: p.freq * 0.6, sweep: p.decay, decay: p.decay, attack: 0.001, pan: 0 });
  }
}

/** A filtered-noise hit (engine.ts noiseHit). */
export function noiseHit(h: VoiceHost, time: number, peak: number, o: { type: BiquadFilterType; freq: number; q: number; decay: number; attack?: number; to?: number; pan: number }) {
  const ctx = h.ctx;
  const src = ctx.createBufferSource();
  src.buffer = h.noise();
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.type;
  f.frequency.setValueAtTime(o.freq, time);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, time + o.decay);
  f.Q.value = o.q;
  const g = ctx.createGain();
  pulseEnv(g.gain, time, o.attack ?? 0.001, peak, o.decay);
  src.connect(f);
  f.connect(g);
  h.play([src], [f, g, ...h.out(g, o.pan)], time, time + (o.attack ?? 0) + o.decay + 0.06);
}

/** A pitched one-shot with an optional pitch drop (engine.ts toneHit). */
export function toneHit(h: VoiceHost, time: number, peak: number, o: { type: OscillatorType; freq: number; to?: number; sweep?: number; decay: number; attack?: number; pan: number }) {
  const ctx = h.ctx;
  const osc = ctx.createOscillator();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.freq, time);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, time + (o.sweep ?? o.decay));
  const g = ctx.createGain();
  pulseEnv(g.gain, time, o.attack ?? 0.002, peak, o.decay);
  osc.connect(g);
  h.play([osc], [g, ...h.out(g, o.pan)], time, time + (o.attack ?? 0) + o.decay + 0.05);
}

function crushHit(h: VoiceHost, time: number, velocity: number, panAmount: number, tail: number, l: CrushLayer) {
  const ctx = h.ctx;
  const decay = l.tail ? l.decay * tail : l.decay;
  const src = ctx.createBufferSource();
  src.buffer = h.noise();
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = l.filter;
  f.frequency.value = l.freq;
  const sources: Source[] = [src];
  if (l.lp === undefined) {
    if (l.q !== undefined) f.Q.value = l.q;
    const g = ctx.createGain();
    pulseEnv(g.gain, time, 0.001, l.level * velocity, decay);
    const crush = ctx.createWaveShaper();
    crush.curve = new Float32Array(bitCurve(l.crush));
    crush.oversample = "none";
    src.connect(f);
    f.connect(g);
    g.connect(crush);
    h.play(sources, [f, g, crush, ...h.out(crush, panAmount)], time, time + decay + 0.06);
    return;
  }
  f.Q.value = l.q ?? 0.6;
  const env = ctx.createGain();
  pulseEnv(env.gain, time, 0.001, 0.9, decay);
  const crush = ctx.createWaveShaper();
  crush.curve = new Float32Array(bitCurve(l.crush));
  crush.oversample = "none";
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = l.lp;
  const out = ctx.createGain();
  out.gain.value = l.level * velocity;
  src.connect(f);
  f.connect(env);
  env.connect(crush);
  crush.connect(lp);
  lp.connect(out);
  h.play(sources, [f, env, crush, lp, out, ...h.out(out, panAmount)], time, time + decay + 0.08);
}

/** A layered hit (engine.ts drum): each layer at `n.vel` x its level, in order. */
export function playHit(h: VoiceHost, n: VoiceNote, p: HitParams) {
  layers(h, p.layers, n.time, n.vel, n.pan, p.tail ?? 1, p.accent ?? true);
}

function layers(h: VoiceHost, voice: readonly DrumLayer[], time: number, velocity: number, panAmount: number, tail: number, accent: boolean) {
  for (const l of voice) {
    const at = l.at ? time + l.at : time;
    if ("clap" in l) {
      layers(h, CLAP, at, l.clap * velocity, l.flip ? -panAmount : panAmount, 1, true);
      continue;
    }
    if ("crush" in l) {
      crushHit(h, at, velocity, panAmount, tail, l);
      continue;
    }
    if (l.accent && !accent) continue;
    const pan = l.pan ?? (l.flip ? -panAmount : panAmount);
    const floor = "tone" in l ? l.floor : undefined;
    const decay = l.tail ? (floor ? l.decay * tail + floor : l.decay * tail) : l.decay;
    if ("tone" in l) {
      toneHit(h, at, l.level * velocity, { type: l.tone, freq: l.freq, to: l.to, sweep: l.sweep, decay, attack: l.attack, pan });
      continue;
    }
    noiseHit(h, at, l.level * velocity, { type: l.noise, freq: l.freq, to: l.to, q: l.q, decay, attack: l.attack, pan });
  }
}
