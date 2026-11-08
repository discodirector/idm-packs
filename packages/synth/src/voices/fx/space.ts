import { hash32, mulberry32 } from "../../hash.ts";
import { PairBus } from "../host.ts";
import { pairSum, stereo } from "../util.ts";

/**
 * Convolution spaces from seeded impulses (no sample files), ported value for value. Depth comes from these, but the
 * house rule stands: "fuller" means new voices, layers and arrangement, never more reverb (docs/sound/VOICE-LIBRARY.md).
 *
 * `plate` (Hamster Dark Electro II v2, engine.ts buildPlate): a stereo noise tail, decorrelated left / right, its early
 * part brighter, decaying 60 dB over `decay` s after `predelay` ms, energy-normalised; the return highpassed and
 * lowpassed. Black Ice 3.4 s, Long Wave 2.8 s, Fault Line 1.7 s, Servo Funk 1.3 s.
 *
 * `hall` (Cinematic v2, engine.ts buildScoreHall + buildShimmer): a long dark concert hall, the noise darkening from
 * `lp` to a third of it as it decays, `pre` ms predelay, opt-in `early` reflections (a dozen dark walls in the first
 * 90 ms) and an opt-in `shimmer` (the tail through an octave-up pitch shifter fed back into the hall: the halo over a
 * held chord). Return at 0.7 after a highpass.
 *
 * Both return `{ bus, output }`: `add` each send to `bus` (a pairwise sum: never connect three nodes into one input),
 * then call `bus.done()` once, and connect `output` to the mains. Offline, a -120 dB constant keeps the convolver's input from ever going silent (as the
 * engine; the return's highpass removes it): pass `offline` false on a live context.
 */
export interface PlateSpec {
  level?: number;
  decay?: number;
  predelay?: number;
  lp?: number;
  hp?: number;
}

/** The sends' chain: `add` each send (a stereo gain), then `done` once (adds the offline keep-alive). */
export interface SendBus {
  add(node: AudioNode): void;
  done(): void;
}

export function plate(ctx: BaseAudioContext, p: PlateSpec, offline = true): { bus: SendBus; output: GainNode } {
  const sr = ctx.sampleRate;
  const decay = p.decay ?? 2.2;
  const pre = Math.floor(((p.predelay ?? 18) / 1000) * sr);
  const n = pre + Math.floor(decay * 1.1 * sr);
  const ir = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    const rnd = mulberry32(hash32(0x91a7e, ch, Math.round(decay * 1000)));
    let lp = 0;
    let energy = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      const x = rnd() * 2 - 1;
      const a = Math.max(0.2, 1 - t / (decay * 0.6));
      lp += a * (x - lp);
      const v = lp * Math.exp((-6.9 * t) / decay) * Math.min(1, t / 0.004 + 0.3);
      data[i] = v;
      energy += v * v;
    }
    const norm = 1 / Math.sqrt(Math.max(1e-9, energy));
    for (let i = pre; i < n; i++) data[i] *= norm;
  }
  const input = ctx.createGain();
  stereo(input);
  const sum = new PairBus(ctx, input);
  const conv = ctx.createConvolver();
  conv.normalize = false;
  conv.buffer = ir;
  input.connect(conv);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = p.hp ?? 280;
  hp.Q.value = 0.6;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = p.lp ?? 6500;
  lp.Q.value = 0.5;
  const output = ctx.createGain();
  output.gain.value = p.level ?? 1;
  stereo(output);
  conv.connect(hp);
  hp.connect(lp);
  lp.connect(output);
  return {
    bus: {
      add: (node) => sum.add(node),
      done() {
        if (!offline) return;
        const keep = ctx.createConstantSource();
        keep.offset.value = 1e-6;
        keep.start(0);
        sum.add(keep);
      },
    },
    output,
  };
}

export interface HallSpec {
  /** Seconds to -60 dB. */
  decay: number;
  /** The tail's lowpass at its start, Hz (falls to a third). */
  lp: number;
  /** The return's highpass, Hz. */
  hp: number;
  /** Predelay, ms (default 22). */
  pre?: number;
  /** Early reflections 0..1 (opt-in). */
  early?: number;
  /** Shimmer feedback 0..0.5 (opt-in). */
  shimmer?: number;
}

/**
 * The hall's sends meet in a pairwise chain before the convolver; the engine built that chain from its bus taps, the
 * library hands it out as `bus` (add the sends there, then the offline keep-alive is added last, as the engine did).
 */
export function hall(ctx: BaseAudioContext, h: HallSpec, offline = true): { bus: SendBus; output: GainNode } {
  const sr = ctx.sampleRate;
  const n = Math.ceil(sr * h.decay);
  const ir = ctx.createBuffer(2, n, sr);
  const pre = Math.round((sr * (h.pre ?? 22)) / 1000);
  for (let ch = 0; ch < 2; ch++) {
    const rnd = mulberry32(hash32(0x4a1c, ch, Math.round(h.decay * 1000), Math.round(h.lp)));
    const data = ir.getChannelData(ch);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const x = i / n;
      const hz = h.lp * (1 - 0.67 * x);
      const a = Math.exp((-2 * Math.PI * hz) / sr);
      y = (1 - a) * (rnd() * 2 - 1) + a * y;
      data[i] = i < pre ? 0 : y * Math.exp(-6.9 * x) * Math.min(1, (i - pre) / (sr * 0.03));
    }
    if ((h.early ?? 0) > 0) {
      const er = new Float32Array(Math.min(n, Math.round(sr * 0.1)));
      const rer = mulberry32(hash32(0xe417, ch, Math.round(h.decay * 1000)));
      for (let j = 0; j < 12; j++) {
        const at = Math.round(sr * (0.006 + rer() * 0.084));
        if (at < er.length) er[at] += (rer() < 0.5 ? -1 : 1) * (1 - j / 14) * (0.4 + 0.6 * rer());
      }
      const a = Math.exp((-2 * Math.PI * 2000) / sr);
      let z = 0;
      let z2 = 0;
      for (let i = 0; i < er.length; i++) {
        z = (1 - a) * er[i] + a * z;
        z2 = (1 - a) * z + a * z2;
        data[i] += (h.early ?? 0) * 6 * z2;
      }
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = h.hp;
  hp.Q.value = 0.6;
  const output = ctx.createGain();
  output.gain.value = 0.7;
  stereo(output);
  conv.connect(hp);
  hp.connect(output);
  if ((h.shimmer ?? 0) > 0) shimmer(ctx, conv, hp, h.shimmer ?? 0);
  // The sends: a pairwise chain (each send a stereo gain the caller made), closed by `done` (the keep-alive, offline).
  let chain: AudioNode | null = null;
  const rest: AudioNode[] = [];
  return {
    bus: {
      add(node: AudioNode) {
        chain = pairSum(ctx, chain, node, rest);
      },
      done() {
        if (offline) {
          const keep = ctx.createConstantSource();
          keep.offset.value = 1e-6;
          keep.start(0);
          chain = pairSum(ctx, chain, keep, rest);
        }
        chain?.connect(conv);
      },
    },
    output,
  };
}

/** The hall's shimmer (engine.ts buildShimmer): two delay taps sweeping down a 60 ms window, crossfaded, octave up. */
function shimmer(ctx: BaseAudioContext, conv: ConvolverNode, from: AudioNode, amount: number) {
  const sr = ctx.sampleRate;
  const W = 0.06;
  const len = Math.round(sr * W);
  const ramp = (shift: number) => {
    const b = ctx.createBuffer(1, len, sr);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = W * (1 - ((i / len + shift) % 1));
    return b;
  };
  const win = (shift: number) => {
    const b = ctx.createBuffer(1, len, sr);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.pow(Math.sin(Math.PI * ((i / len + shift) % 1)), 2);
    return b;
  };
  const lpIn = ctx.createBiquadFilter();
  lpIn.type = "lowpass";
  lpIn.frequency.value = 2000;
  lpIn.Q.value = 0.5;
  from.connect(lpIn);
  let sum: AudioNode | null = null;
  const rest: AudioNode[] = [];
  for (const shift of [0, 0.5]) {
    const d = ctx.createDelay(W + 0.01);
    d.delayTime.value = 0;
    const rs = ctx.createBufferSource();
    rs.buffer = ramp(shift);
    rs.loop = true;
    rs.connect(d.delayTime);
    const g = ctx.createGain();
    g.gain.value = 0;
    const ws = ctx.createBufferSource();
    ws.buffer = win(shift);
    ws.loop = true;
    ws.connect(g.gain);
    lpIn.connect(d);
    d.connect(g);
    rs.start(0);
    ws.start(0);
    sum = pairSum(ctx, sum, g, rest);
  }
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 3000;
  lp.Q.value = 0.5;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 400;
  hp.Q.value = 0.5;
  const fb = ctx.createGain();
  fb.gain.value = amount;
  stereo(fb);
  (sum as AudioNode).connect(lp);
  lp.connect(hp);
  hp.connect(fb);
  fb.connect(conv);
}
