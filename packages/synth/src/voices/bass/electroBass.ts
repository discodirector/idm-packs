import { hash32 } from "../../hash.ts";
import type { Source, VoiceHost, VoiceNote } from "../types.ts";
import { center, pairSum, seedHi, seedLo, setWave, tanhCurve, type OscWave } from "../util.ts";

/**
 * The fat electro bass (Hamster Dark Electro II v2, engine.ts clientBass / alienBass + bassBody / bassDrift on
 * sound/hamster-electro-2, tag hamster-electro-2-v2-approved), ported value for value. 1..4 detuned oscillators with
 * per-note analog drift, gliding together:
 * - "client" (Client_03): two cascaded lowpasses (a 24 dB slope) with an envelope, then tanh;
 * - "alien" (Alien Rave): one resonant lowpass on a slow hand-on-the-cutoff sweep (`knob`), plus an FM "snarl" sine;
 * and on both the opt-in parallel `body` (the oscillators through their own lowpass, tanh and highpass: the 90 Hz-1 kHz
 * harmonics a dark bass needs to be heard on any speaker while the main filter stays closed) and a clean mono `sub` an
 * octave under, outside the filter and the drive. Accented notes (`vel` >= `accentVel`) take the second value of every
 * pair; "client" ghost notes (`vel` < `ghostVel`) barely open the filter and skip the sub.
 *
 * The shape is the pack's `ElectroBassSpec` (styledata.ts) plus `mode`; the market terms are library params (`heat`
 * 0..1 adds grit and opening, `tick` 0..1 scales `color`, `press` the buy / sell pressure), all neutral by default.
 * Since phase 2 the engine's clientBass / alienBass play this voice (engine-trace identical: `accent`, `ghost`,
 * `driftKey`, `press`, the host's `pulse`).
 */
export interface ElectroBassParams {
  mode: "client" | "alien";
  osc: readonly { type: OscWave; detune: number; level: number }[];
  cutoff: number;
  color: number;
  q: readonly [number, number];
  open: readonly [number, number];
  decay: readonly [number, number];
  drive: number;
  level: readonly [number, number];
  sub: readonly [number, number];
  glide: number;
  fm?: readonly [number, number];
  ratio?: number;
  body?: { level: number; drive: number; lp: number; hp?: number };
  drift?: number;
  subWave?: "sine" | "triangle";
  /** Library: the market's heat 0..1 (the engine's c.heat), default 0. */
  heat?: number;
  /** Library: the pool tick 0..1 that adds `color` Hz to the cutoff (the engine's c.color), default 0. */
  tick?: number;
  /** Library, alien: the slow sweep's position 0..1 (the engine moves it over eight bars), default 0.5. */
  knob?: number;
  /** Library: velocity at and over which a note is accented (default 0.8). */
  accentVel?: number;
  /** Library, client: velocity under which a note is a dead (ghost) note (default 0.3). */
  ghostVel?: number;
  /** Library: the market's buy (> 0) / sell (< 0) pressure -1..1 (the engine's c.press), default 0. */
  press?: number;
  /** Library: 1 / 0 forces the note accented or plain (the engine's riff flag), over `accentVel`. */
  accent?: number;
  /** Library, client: 1 / 0 forces a ghost note or not (the engine's flag), over `ghostVel`. */
  ghost?: number;
  /** Library: the drift's two hash parts (the engine's epoch and note counter), in place of the note's seed. */
  driftKey?: readonly [number, number];
}

/** Analog drift: ± `cents` per oscillator and note, hashed from the note's seed (engine.ts bassDrift). */
const driftOf = (seed: number, cents: number | undefined, i: number, key?: readonly [number, number]) =>
  cents ? ((hash32(key ? key[0] : seedHi(seed), key ? key[1] : seedLo(seed), 0xd71 + i) % 2001) / 1000 - 1) * cents : 0;

/** The parallel drive (engine.ts bassBody): returns its gain. */
function body(ctx: BaseAudioContext, src: AudioNode, b: NonNullable<ElectroBassParams["body"]>, rest: AudioNode[]): AudioNode {
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = b.lp;
  lp.Q.value = 0.7;
  const shaper = ctx.createWaveShaper();
  shaper.curve = new Float32Array(tanhCurve(b.drive));
  shaper.oversample = "none";
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = b.hp ?? 140;
  hp.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.value = b.level;
  src.connect(lp);
  lp.connect(shaper);
  shaper.connect(hp);
  hp.connect(g);
  rest.push(lp, shaper, hp, g);
  return g;
}

export function playElectroBass(h: VoiceHost, n: VoiceNote, b: ElectroBassParams) {
  if (b.mode === "alien") alien(h, n, b);
  else client(h, n, b);
}

function client(h: VoiceHost, n: VoiceNote, b: ElectroBassParams) {
  const ctx = h.ctx;
  const t = n.time;
  const freq = n.freq;
  const heat = b.heat ?? 0;
  const tick = b.tick ?? 0;
  const accent = b.accent !== undefined ? b.accent > 0 : n.vel >= (b.accentVel ?? 0.8);
  const ghost = b.ghost !== undefined ? b.ghost > 0 : n.vel < (b.ghostVel ?? 0.3);
  const buy = Math.max(0, b.press ?? 0);
  const sell = Math.max(0, -(b.press ?? 0));
  const a = accent ? 1 : 0;
  const floorHz = Math.max(110, (b.cutoff + b.color * tick + 220 * buy) * (1 - 0.3 * sell));
  const peakHz = ghost ? floorHz * 1.6 : Math.min(5200, floorHz * b.open[a] * (1 + 0.4 * heat));
  const env = ghost ? 0.03 : b.decay[a];
  const lps: BiquadFilterNode[] = [];
  for (let i = 0; i < 2; i++) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = i === 0 ? 0.7 : b.q[a] + 2.5 * sell;
    lp.frequency.setValueAtTime(peakHz, t);
    lp.frequency.exponentialRampToValueAtTime(floorHz, t + env);
    lps.push(lp);
  }
  lps[0].connect(lps[1]);
  const hold = Math.max(0.035, n.length);
  const amp = ctx.createGain();
  const peak = ghost ? 0.08 : b.level[a];
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(peak, t + 0.003);
  amp.gain.setValueAtTime(peak * 0.8, t + hold * 0.75);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + hold + 0.02);
  amp.gain.setValueAtTime(0, t + hold + 0.02);
  const startF = n.from ?? freq;
  const glide = n.from !== undefined ? b.glide : 0.001;
  const oscs: Source[] = [];
  const rest: AudioNode[] = [...lps];
  let chain: AudioNode | null = null;
  for (const o of b.osc) {
    const osc = ctx.createOscillator();
    setWave(ctx, osc, o.type, h);
    osc.frequency.setValueAtTime(startF, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + glide);
    osc.detune.setValueAtTime(o.detune + driftOf(n.seed, b.drift, oscs.length, b.driftKey), t);
    const g = ctx.createGain();
    g.gain.value = o.level;
    osc.connect(g);
    rest.push(g);
    chain = pairSum(ctx, chain, g, rest);
    oscs.push(osc);
  }
  const shaper = ctx.createWaveShaper();
  shaper.curve = new Float32Array(tanhCurve(b.drive + 1.4 * heat + 0.5 * buy));
  shaper.oversample = "none";
  chain!.connect(lps[0]);
  lps[1].connect(shaper);
  if (b.body) pairSum(ctx, shaper, body(ctx, chain!, b.body, rest), rest).connect(amp);
  else shaper.connect(amp);
  rest.push(shaper, amp);
  if (!ghost) {
    const sub = ctx.createOscillator();
    sub.type = b.subWave ?? "sine";
    sub.frequency.setValueAtTime(startF / 2, t);
    sub.frequency.exponentialRampToValueAtTime(freq / 2, t + glide);
    const sg = ctx.createGain();
    sg.gain.value = b.sub[a];
    sub.connect(sg);
    sg.connect(amp);
    rest.push(sg);
    oscs.push(sub);
  }
  rest.push(...(n.pan === 0 ? center(h, amp) : h.out(amp, n.pan)));
  h.play(oscs, rest, t, t + hold + 0.06);
}

function alien(h: VoiceHost, n: VoiceNote, b: ElectroBassParams) {
  const ctx = h.ctx;
  const t = n.time;
  const freq = n.freq;
  const heat = b.heat ?? 0;
  const tick = b.tick ?? 0;
  const buy = Math.max(0, b.press ?? 0);
  const sell = Math.max(0, -(b.press ?? 0));
  const a = (b.accent !== undefined ? b.accent > 0 : n.vel >= (b.accentVel ?? 0.8)) ? 1 : 0;
  const knob = b.knob ?? 0.5;
  const floorHz = Math.max(120, (b.cutoff + b.color * tick + 260 * knob + 300 * buy) * (1 - 0.3 * sell));
  const peakHz = Math.min(7000, floorHz * b.open[a] * (1 + 0.6 * heat));
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = b.q[a] + 3 * sell;
  lp.frequency.setValueAtTime(peakHz, t);
  lp.frequency.exponentialRampToValueAtTime(floorHz, t + b.decay[a]);
  const hold = Math.max(0.05, n.length);
  const amp = ctx.createGain();
  const peak = b.level[a];
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(peak, t + 0.003);
  amp.gain.setValueAtTime(peak * 0.75, t + hold * 0.7);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + hold);
  amp.gain.setValueAtTime(0, t + hold);
  const startF = n.from ?? freq;
  const glide = n.from !== undefined ? b.glide : 0.001;
  const oscs: Source[] = [];
  const rest: AudioNode[] = [];
  let chain: AudioNode | null = null;
  for (const o of b.osc) {
    const osc = ctx.createOscillator();
    setWave(ctx, osc, o.type, h);
    osc.frequency.setValueAtTime(startF, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + glide);
    osc.detune.setValueAtTime(o.detune + driftOf(n.seed, b.drift, oscs.length, b.driftKey), t);
    const g = ctx.createGain();
    g.gain.value = o.level;
    osc.connect(g);
    rest.push(g);
    chain = pairSum(ctx, chain, g, rest);
    oscs.push(osc);
  }
  const carrier = ctx.createOscillator();
  carrier.type = "sine";
  carrier.frequency.setValueAtTime(startF, t);
  carrier.frequency.exponentialRampToValueAtTime(freq, t + glide);
  const mod = ctx.createOscillator();
  mod.type = "sine";
  const ratio = b.ratio ?? 2;
  mod.frequency.setValueAtTime(startF * ratio, t);
  mod.frequency.exponentialRampToValueAtTime(freq * ratio, t + glide);
  const index = ctx.createGain();
  const depth = freq * (b.fm ?? [0, 0])[a] * (1 + 1.2 * heat + 0.6 * buy);
  index.gain.setValueAtTime(depth, t);
  index.gain.exponentialRampToValueAtTime(Math.max(1, depth * 0.18), t + 0.09);
  mod.connect(index);
  index.connect(carrier.frequency);
  const cg = ctx.createGain();
  cg.gain.value = 0.44;
  carrier.connect(cg);
  rest.push(index, cg);
  chain = pairSum(ctx, chain, cg, rest);
  oscs.push(carrier, mod);
  const shaper = ctx.createWaveShaper();
  shaper.curve = new Float32Array(tanhCurve(b.drive + 1.2 * heat + 0.6 * buy));
  shaper.oversample = "none";
  chain!.connect(lp);
  lp.connect(shaper);
  if (b.body) pairSum(ctx, shaper, body(ctx, chain!, b.body, rest), rest).connect(amp);
  else shaper.connect(amp);
  rest.push(lp, shaper, amp);
  const sub = ctx.createOscillator();
  sub.type = b.subWave ?? "sine";
  sub.frequency.setValueAtTime(startF / 2, t);
  sub.frequency.exponentialRampToValueAtTime(freq / 2, t + glide);
  const sg = ctx.createGain();
  sg.gain.value = b.sub[a];
  sub.connect(sg);
  sg.connect(amp);
  rest.push(sg);
  oscs.push(sub);
  rest.push(...(n.pan === 0 ? center(h, amp) : h.out(amp, n.pan)));
  h.play(oscs, rest, t, t + hold + 0.04);
}
