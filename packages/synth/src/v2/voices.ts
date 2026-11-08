/**
 * Synth v2 on the engine side (docs/sound/SYNTH-V2.md): the AudioWorklet module (built from dsp.ts's source text),
 * its loader, the pack slots (`ukg.v2`) resolved over the presets, and `playV2`, which starts one event as one
 * AudioWorkletNode.
 *
 * Loaded only when a program has a style with a v2 slot on (programUsesV2): renderTimelineToBuffer and the release
 * renders await `loadV2` before scheduling; the live player starts loading and the engine plays the v1 voice in a
 * slot's place until the module is ready. Nothing here runs for any other style.
 */
import { makeV2Dsp, type V2Alive, type V2Event, type V2Kind } from "./dsp.ts";
import { fmOps, V2_PRESETS, type V2AliveSpec, type V2VoiceName } from "./presets.ts";

export { makeV2Dsp, V2_PRESETS };
export type { V2AliveSpec, V2Event, V2Kind, V2VoiceName };

/** The processor's registered name. */
export const V2_PROCESSOR = "imd-v2";

/**
 * The worklet module's text: the dsp factory inlined, a processor that runs one event from its start frame (sample
 * exact: the first block is zero up to the start), then returns false. `live` events post a message when done so the
 * main thread can disconnect them.
 */
export function v2WorkletSource(): string {
  return `// Synth v2 worklet (generated from packages/synth/src/v2/dsp.ts)
const __name = (f) => f;
const DSP = (${makeV2Dsp.toString()})();
class ImdV2Processor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const ev = options.processorOptions;
    this.start = Math.round(ev.start * sampleRate);
    this.live = !!ev.live;
    this.voice = DSP.createVoice(ev, sampleRate);
  }
  process(inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const R = out.length > 1 ? out[1] : out[0];
    const n = L.length;
    const f0 = currentFrame;
    if (f0 + n <= this.start) {
      L.fill(0);
      R.fill(0);
      return true;
    }
    const off = Math.max(0, this.start - f0);
    const alive = this.voice.render(L, R, off, n - off);
    if (!alive && this.live) this.port.postMessage(0);
    return alive;
  }
}
registerProcessor(${JSON.stringify(V2_PROCESSOR)}, ImdV2Processor);
`;
}

/** The dsp core on the main thread: the chop sources (computed here, then handed to the worklet). */
let mainDsp: ReturnType<typeof makeV2Dsp> | null = null;

const loading = new WeakMap<BaseAudioContext, Promise<void>>();
const ready = new WeakSet<BaseAudioContext>();

/** Adds the v2 worklet module to `ctx` (once per context). Rejects where there is no AudioWorklet. */
export function loadV2(ctx: BaseAudioContext): Promise<void> {
  let p = loading.get(ctx);
  if (!p) {
    const worklet = (ctx as { audioWorklet?: AudioWorklet }).audioWorklet;
    if (!worklet || typeof URL === "undefined" || typeof Blob === "undefined") return Promise.reject(new Error("synth v2: no AudioWorklet here"));
    const url = URL.createObjectURL(new Blob([v2WorkletSource()], { type: "text/javascript" }));
    p = worklet.addModule(url).then(
      () => {
        ready.add(ctx);
        URL.revokeObjectURL(url);
      },
      (err) => {
        URL.revokeObjectURL(url);
        throw err;
      },
    );
    loading.set(ctx, p);
  }
  return p;
}

/** True once loadV2 has finished on `ctx`. */
export const v2Ready = (ctx: BaseAudioContext) => ready.has(ctx);

/** A pack's v2 slot (`ukg.v2.<slot>`, styledata.ts UkgV2Slot): a voice by name, its level, overrides. */
export interface V2Slot {
  /** 0 = off (the v1 voice plays). */
  level: number;
  voice: V2VoiceName;
  /** Register shift, semitones. */
  octave?: number;
  /** Overrides of the preset's parameters. */
  p?: Record<string, number | string | number[][]>;
  /** Overrides of the preset's alive layer. */
  alive?: Partial<V2AliveSpec>;
}

/** A slot resolved over its preset, ready to make events. */
export interface V2Resolved {
  kind: V2Kind;
  gain: number;
  octave: number;
  p: Record<string, unknown>;
  alive: V2AliveSpec;
}

const resolvedCache = new WeakMap<object, V2Resolved>();

/** The slot over its preset (cached per slot object); null when off or unknown. */
export function resolveV2(slot: V2Slot | undefined | null): V2Resolved | null {
  if (!slot || !(slot.level > 0)) return null;
  const hit = resolvedCache.get(slot);
  if (hit) return hit;
  const preset = V2_PRESETS[slot.voice];
  if (!preset) return null;
  const p: Record<string, unknown> = { ...preset.p, ...(slot.p ?? {}) };
  if (Array.isArray(p.ops)) p.ops = fmOps(p.ops as number[][]);
  const r: V2Resolved = { kind: preset.kind, gain: preset.gain * slot.level, octave: slot.octave ?? 0, p, alive: { ...preset.alive, ...(slot.alive ?? {}) } };
  resolvedCache.set(slot, r);
  return r;
}

/** Where an event goes: anything that sums a node in (engine.ts MixChain). */
export interface V2Bus {
  add(node: AudioNode): void;
}

export interface V2Play {
  time: number;
  notes: readonly number[];
  vel: number;
  hold: number;
  seed: number;
  pan?: number;
  width?: number;
  from?: number;
  glide?: number;
  /** Extra parameters for this one event (the chop's chord, root, semitones, start). */
  extra?: Record<string, unknown>;
  /** Times the slot's gain. */
  gain?: number;
}

/**
 * Starts one event of slot `r` on `ctx` into `bus`: one AudioWorkletNode (no inputs, one stereo output) for the
 * whole note or chord. False when the module is not loaded on `ctx` (the caller plays its v1 voice instead).
 */
export function playV2(ctx: BaseAudioContext, live: boolean, bus: V2Bus, r: V2Resolved, e: V2Play): boolean {
  if (!ready.has(ctx)) return false;
  const alive: V2Alive = { drift: r.alive.drift, driftRate: r.alive.driftRate, wander: r.alive.wander, envVar: r.alive.envVar, velBright: r.alive.velBright };
  const ev: V2Event & { start: number; live: boolean } = {
    kind: r.kind,
    notes: e.notes.map((m) => m + r.octave),
    vel: e.vel,
    hold: Math.max(0.01, e.hold),
    seed: e.seed >>> 0,
    gain: r.gain * (e.gain ?? 1),
    pan: e.pan ?? 0,
    width: e.width ?? 0,
    from: e.from ?? 0,
    glide: e.glide ?? 0,
    alive,
    p: e.extra ? { ...r.p, ...e.extra } : r.p,
    start: Math.max(0, e.time),
    live,
  };
  if (ev.kind === "chop") {
    // The sampled chord, rendered once per chord quality here on the main thread (never on the audio thread).
    mainDsp ??= makeV2Dsp();
    ev.p = { ...ev.p, src: mainDsp.chopSource(ev, ctx.sampleRate) };
  }
  const node = new AudioWorkletNode(ctx, V2_PROCESSOR, { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: ev });
  if (live) {
    node.port.onmessage = () => {
      node.port.onmessage = null;
      try {
        node.disconnect();
      } catch {
        /* already gone */
      }
    };
  }
  bus.add(node);
  return true;
}

/**
 * The seeded micro-timing of one hit, s: up to `timing` ms late, now and then a little early (h: 0..1 from the
 * engine's per-step hash). Small against a 16th (121 ms at 124 BPM), on top of the style's swing.
 */
export const v2Late = (r: V2Resolved, h: number) => ((h - 0.25) * r.alive.timing) / 1000;

/**
 * A chord's shape for the chop sampler: its tones as intervals over the chord's bass root, rootless and closed from
 * the third (an interval under 3 semitones goes up an octave), sorted. Chords of one quality share one sample.
 */
export function chopShape(tones: readonly number[], root: number): number[] {
  const set = new Set<number>();
  for (const t of tones) {
    let x = (((t - root) % 12) + 12) % 12;
    if (x < 3) x += 12;
    set.add(x);
  }
  return [...set].sort((a, b) => a - b);
}

/** Does any style of this program name a v2 voice (with level > 0)? Then its renders load the worklet first. */
export function programUsesV2(program: { styles: readonly { styles: Partial<Record<string, readonly unknown[]>> }[] }): boolean {
  for (const entry of program.styles) {
    for (const list of Object.values(entry.styles)) {
      for (const style of list ?? []) {
        const v2 = (style as { data?: { ukg?: { v2?: Record<string, V2Slot | undefined> } } }).data?.ukg?.v2;
        if (v2 && Object.values(v2).some((s) => s && s.level > 0)) return true;
      }
    }
  }
  return false;
}
