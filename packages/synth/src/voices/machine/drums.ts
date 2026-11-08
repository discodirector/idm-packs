/**
 * 808-family drum layers and machine percussion. A kick or a snare here is not one voice but the layers you would
 * stack on a desk, each with one job:
 *   kick   knock (a triangle falling 2 octaves in 40 ms: the 100-200 Hz punch), click (a short bandpassed noise tick
 *          and a sine blip: the attack on small speakers) and boom (a long saturated sine with a pitch glide: the
 *          808 tail, its overtones from the drive);
 *   snare  body (two tuned modes, the 808's ~180 / ~330 Hz), snap (highpassed noise), a stereo clap (four bursts,
 *          alternating sides, then a diffuse tail) and air (a long quiet hiss over 7 kHz).
 * Percussion: 808 toms and congas (a sine with a small fall and a skin tick), the cowbell (two squares at 540 / 800 Hz
 * through a bandpass, a fast then a slow decay), claves and rims, a shaker (noise with a soft attack) and a crash
 * (inharmonic metal partials on noise). The caller picks the bus.
 */
import type { Source, VoiceBus, VoiceHost } from "./host.ts";
import { biquad, gainNode, hit, noiseSrc, osc, run, shaper } from "./util.ts";

export interface KickLayers {
  knock?: { freq: number; to: number; decay: number; level: number };
  click?: { freq: number; decay: number; level: number };
  boom?: { freq: number; glide: number; decay: number; drive: number; level: number };
}

export interface SnareLayers {
  body?: { freqs: readonly number[]; decay: number; level: number };
  snap?: { hp: number; decay: number; level: number };
  clap?: { bp: number; q: number; gap: number; decay: number; width: number; level: number };
  air?: { hp: number; decay: number; level: number };
}

/** A filtered noise burst on `bus` at `pan`. */
function burst(h: VoiceHost, t: number, peak: number, type: BiquadFilterType, freq: number, q: number, attack: number, decay: number, bus: VoiceBus, pan?: number) {
  const n = noiseSrc(h);
  const f = biquad(h.ctx, type, freq, q, t);
  const g = h.ctx.createGain();
  const end = hit(g.gain, t, peak, attack, decay);
  n.connect(f);
  f.connect(g);
  const rest: AudioNode[] = [f, g, ...h.out(g, bus, pan)];
  run(h, [n], rest, t, end + 0.03);
}

/** A sine (or triangle) with a pitch fall, on `bus`. */
function tone(h: VoiceHost, t: number, peak: number, wave: "sine" | "triangle", from: number, to: number, sweep: number, decay: number, bus: VoiceBus, pan?: number, drive = 0) {
  const o = osc(h.ctx, wave, from, t);
  if (to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + Math.max(0.003, sweep));
  const g = h.ctx.createGain();
  const end = hit(g.gain, t, peak, 0.002, decay);
  o.connect(g);
  const rest: AudioNode[] = [g];
  let node: AudioNode = g;
  if (drive > 0) {
    const sh = shaper(h.ctx, drive, true);
    g.connect(sh);
    const trim = gainNode(h.ctx, 0.8);
    sh.connect(trim);
    rest.push(sh, trim);
    node = trim;
  }
  rest.push(...h.out(node, bus, pan));
  run(h, [o], rest, t, end + 0.03);
}

export function kickLayers(h: VoiceHost, t: number, vel: number, k: KickLayers) {
  if (k.knock) tone(h, t, k.knock.level * vel, "triangle", k.knock.freq, k.knock.to, k.knock.decay * 0.5, k.knock.decay, "kick");
  if (k.click) {
    burst(h, t, k.click.level * vel, "bandpass", k.click.freq, 0.9, 0.0005, k.click.decay, "kick");
    tone(h, t, 0.5 * k.click.level * vel, "sine", k.click.freq * 0.45, k.click.freq * 0.3, 0.006, 0.008, "kick");
  }
  if (k.boom) tone(h, t, k.boom.level * vel, "sine", k.boom.freq * k.boom.glide, k.boom.freq, 0.07, k.boom.decay, "kick", undefined, k.boom.drive);
}

export function snareLayers(h: VoiceHost, t: number, vel: number, s: SnareLayers, pan = 0) {
  if (s.body) {
    s.body.freqs.forEach((f, i) => tone(h, t, (s.body!.level * vel) / (1 + 0.6 * i), i === 0 ? "triangle" : "sine", f * 1.12, f, 0.02, s.body!.decay * (i === 0 ? 1 : 0.7), "snare", pan));
  }
  if (s.snap) burst(h, t, s.snap.level * vel, "highpass", s.snap.hp, 0.7, 0.0008, s.snap.decay, "snare", pan);
  if (s.clap) {
    const c = s.clap;
    for (let i = 0; i < 4; i++) {
      const side = (i % 2 === 0 ? -1 : 1) * c.width * 0.6;
      burst(h, t + i * c.gap, c.level * vel * (i === 3 ? 1 : 0.7), "bandpass", c.bp * (1 + 0.04 * i), c.q, 0.0008, i === 3 ? c.decay : 0.011, "snare", side);
    }
    // The diffuse tail, wider than the hits.
    burst(h, t + 3 * c.gap, c.level * vel * 0.35, "bandpass", c.bp * 0.85, c.q * 0.6, 0.004, c.decay * 1.8, "snare", c.width * 0.9);
  }
  if (s.air) burst(h, t, s.air.level * vel, "highpass", s.air.hp, 0.5, 0.004, s.air.decay, "snare", -pan);
}

/**
 * A machine hat (Machine Electro v4.2): not a highpassed noise tick but the 808's metal, darker and with a body.
 *   metal  the 808's six squares (205-800 Hz x `tune`) summed, through a bandpass at `bp` (the clang lives there,
 *          not in the fizz above it);
 *   noise  a bandpassed noise layer at `bp` (`q`): the hat's breath;
 *   then a highpass at `hp` (takes the squares' fundamentals out) and a lowpass at `lp` (takes the 8-12 kHz fizz out),
 *   a soft `attack` (1-3 ms, not a click), and `closed` / `open` decays;
 *   room   an early reflection: the noise layer again `room` s later, darker (lp x 0.6), at `roomLevel`, on the other
 *          side: the hat sits a little back in a small room instead of right at the ear. No reverb tail.
 */
export interface MachineHat {
  metal: number;
  tune: number;
  noise: number;
  bp: number;
  q: number;
  hp: number;
  lp: number;
  attack: number;
  closed: number;
  open: number;
  room: number;
  roomLevel: number;
  level: number;
}

const HAT808 = [205.3, 304.4, 369.6, 522.7, 540, 800];

/** One machine hat: closed, or `open` (the long decay); `vel` 0..1 x the spec's level, at `pan`. */
export function machineHat(h: VoiceHost, t: number, vel: number, s: MachineHat, open: boolean, pan: number, bus: VoiceBus = "hat") {
  const ctx = h.ctx;
  const decay = open ? s.open : s.closed;
  const peak = s.level * vel;
  if (peak <= 0) return;
  const rest: AudioNode[] = [];
  const srcs: Source[] = [];
  const hp = biquad(ctx, "highpass", s.hp, 0.7, t);
  const lp = biquad(ctx, "lowpass", s.lp, 0.6, t);
  const env = ctx.createGain();
  const end = hit(env.gain, t, peak, s.attack, decay);
  hp.connect(lp);
  lp.connect(env);
  rest.push(hp, lp, env, ...h.out(env, bus, pan));
  let head: AudioNode | null = null;
  if (s.metal > 0) {
    const sum: AudioNode[] = [];
    let chain: AudioNode | null = null;
    for (const f of HAT808) {
      const o = osc(ctx, "square", f * s.tune, t, 0, 0);
      const g = gainNode(ctx, s.metal / 6);
      o.connect(g);
      sum.push(g);
      chain = h.sum(chain, g, sum);
      srcs.push(o);
    }
    const bp = biquad(ctx, "bandpass", s.bp, s.q, t);
    (chain as AudioNode).connect(bp);
    rest.push(...sum, bp);
    head = h.sum(head, bp, rest);
  }
  if (s.noise > 0) {
    const n = noiseSrc(h);
    const bp = biquad(ctx, "bandpass", s.bp * 0.9, s.q * 0.8, t);
    const g = gainNode(ctx, s.noise);
    n.connect(bp);
    bp.connect(g);
    rest.push(bp, g);
    srcs.push(n);
    head = h.sum(head, g, rest);
  }
  if (!head) return;
  head.connect(hp);
  run(h, srcs, rest, t, end + 0.02);
  if (s.room > 0 && s.roomLevel > 0) {
    const n = noiseSrc(h);
    const bp = biquad(ctx, "bandpass", s.bp * 0.8, s.q * 0.6, t + s.room);
    const lp2 = biquad(ctx, "lowpass", s.lp * 0.6, 0.6, t + s.room);
    const g = ctx.createGain();
    const end2 = hit(g.gain, t + s.room, peak * s.roomLevel * Math.max(0.3, s.noise + 0.5 * s.metal), 0.004, decay * 1.6);
    n.connect(bp);
    bp.connect(lp2);
    lp2.connect(g);
    run(h, [n], [bp, lp2, g, ...h.out(g, bus, -pan * 0.7)], t + s.room, end2 + 0.02);
  }
}

export type PercVoice = "tom" | "conga" | "cowbell" | "clave" | "rim" | "shaker" | "crash" | "clap";

/** One percussion hit: `tune` scales its pitch (1 = the 808's), `decay` its length (1 = the 808's). */
export function perc(h: VoiceHost, t: number, voice: PercVoice, vel: number, tune: number, decay: number, pan: number, bus: VoiceBus) {
  switch (voice) {
    case "tom":
      tone(h, t, 0.42 * vel, "sine", 150 * tune * 1.07, 150 * tune, 0.05, 0.26 * decay, bus, pan);
      burst(h, t, 0.06 * vel, "bandpass", 1900 * tune, 1.2, 0.0005, 0.018, bus, pan);
      return;
    case "conga":
      tone(h, t, 0.36 * vel, "sine", 330 * tune * 1.05, 330 * tune, 0.025, 0.16 * decay, bus, pan);
      burst(h, t, 0.05 * vel, "bandpass", 2600 * tune, 1.5, 0.0005, 0.01, bus, pan);
      return;
    case "cowbell": {
      const ctx = h.ctx;
      const rest: AudioNode[] = [];
      const srcs: OscillatorNode[] = [];
      let head: AudioNode | null = null;
      for (const f of [540, 800]) {
        const o = osc(ctx, "square", f * tune, t, 0, 0);
        const g = gainNode(ctx, 0.5);
        o.connect(g);
        rest.push(g);
        head = h.sum(head, g, rest);
        srcs.push(o);
      }
      const bp = biquad(ctx, "bandpass", 1150 * tune, 1.6, t);
      const env = ctx.createGain();
      const len = 0.28 * decay;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.16 * vel, t + 0.001);
      env.gain.exponentialRampToValueAtTime(0.05 * vel, t + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, t + len);
      env.gain.setValueAtTime(0, t + len);
      (head as unknown as AudioNode).connect(bp);
      bp.connect(env);
      rest.push(bp, env, ...h.out(env, bus, pan));
      run(h, srcs, rest, t, t + len + 0.03);
      return;
    }
    case "clave":
      tone(h, t, 0.3 * vel, "sine", 2500 * tune, 2500 * tune, 0.01, 0.045 * decay, bus, pan);
      return;
    case "rim":
      tone(h, t, 0.28 * vel, "triangle", 1700 * tune, 1600 * tune, 0.01, 0.03 * decay, bus, pan);
      burst(h, t, 0.18 * vel, "bandpass", 3200 * tune, 2, 0.0005, 0.012, bus, pan);
      return;
    case "shaker":
      burst(h, t, 0.16 * vel, "bandpass", 7200 * tune, 1.1, 0.008, 0.05 * decay, bus, pan);
      return;
    case "crash": {
      for (const [f, q] of [[5200, 0.8], [8600, 0.6]] as const) burst(h, t, 0.09 * vel, "bandpass", f * tune, q, 0.002, 1.6 * decay, bus, pan * (f > 6000 ? -1 : 1));
      tone(h, t, 0.03 * vel, "sine", 3311 * tune, 3311 * tune, 0.01, 0.9 * decay, bus, pan);
      return;
    }
    case "clap":
      snareLayers(h, t, vel, { clap: { bp: 1100 * tune, q: 1.4, gap: 0.009, decay: 0.12 * decay, width: 0.6, level: 0.5 } }, pan);
      return;
  }
}
