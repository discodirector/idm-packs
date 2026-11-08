import { hash32 } from "../hash.ts";
import type { VoiceHost } from "./types.ts";
import { makeNoise, stereo } from "./util.ts";
import { waveCoefficients } from "./waves.ts";

/**
 * A pairwise stereo sum into `dest` (engine.ts MixChain, offline flavour): each new input and the running sum meet in a
 * fresh two-input gain, so no node ever has three inputs (bit-exact offline renders).
 */
export class PairBus {
  private acc: AudioNode | null = null;
  constructor(
    private readonly ctx: BaseAudioContext,
    readonly dest: AudioNode,
  ) {}
  add(source: AudioNode) {
    if (this.acc == null) {
      source.connect(this.dest);
      this.acc = source;
      return;
    }
    const sum = this.ctx.createGain();
    stereo(sum);
    this.acc.disconnect(this.dest);
    this.acc.connect(sum);
    source.connect(sum);
    sum.connect(this.dest);
    this.acc = sum;
  }
}

export interface HostOptions {
  /** The noise buffer's seed (default: the engine's for pattern 0, hash32(0, 0x4e01)). */
  noiseSeed?: number;
  /** Where the voice's stereo output goes: a PairBus (default: a new one on `dest`). */
  bus?: PairBus;
}

/**
 * A standalone host on any context (an OfflineAudioContext for auditions and IDM Sounds renders, a live AudioContext for
 * the Style Lab): an equal-power pan per note (as engine.ts panNode) into a pairwise sum on `dest`. The engine has its
 * own host on its buses (VoiceEngine.voiceHost on sound/hiphop-trap); both pan and sum the same way.
 */
export function createHost(ctx: BaseAudioContext, dest: AudioNode, opts: HostOptions = {}): VoiceHost {
  const bus = opts.bus ?? new PairBus(ctx, dest);
  const bufs = new Map<string, AudioBuffer>();
  const waves = new Map<string, PeriodicWave>();
  let noise: AudioBuffer | null = null;
  return {
    ctx,
    noise: () => (noise ??= makeNoise(ctx, opts.noiseSeed ?? hash32(0, 0x4e01))),
    buffer: (key, make) => {
      let b = bufs.get(key);
      if (!b) bufs.set(key, (b = make()));
      return b;
    },
    wave: (kind, k, duty = 0.5) => {
      const key = `${kind}:${k}:${duty}`;
      let w = waves.get(key);
      if (!w) {
        const { real, imag } = waveCoefficients(kind, k, duty);
        waves.set(key, (w = ctx.createPeriodicWave(real, imag)));
      }
      return w;
    },
    out: (node, pan) => {
      const left = ctx.createGain();
      const right = ctx.createGain();
      const merger = ctx.createChannelMerger(2);
      const a = Math.max(-1, Math.min(1, pan));
      left.gain.value = Math.cos(((a + 1) * Math.PI) / 4);
      right.gain.value = Math.sin(((a + 1) * Math.PI) / 4);
      node.connect(left);
      node.connect(right);
      left.connect(merger, 0, 0);
      right.connect(merger, 0, 1);
      bus.add(merger);
      return [left, right, merger];
    },
    center: (node) => {
      bus.add(node);
      return [];
    },
    play: (sources, _nodes, time, end) => {
      for (const s of sources) {
        s.start(time);
        s.stop(end);
      }
    },
  };
}
