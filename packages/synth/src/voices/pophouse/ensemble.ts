/**
 * Pad beds and string sections, and the ensemble chorus they play through.
 *
 * `ensembleFx`: a Solina / Juno-style BBD ensemble, built once per bus: three short delays (5.5, 8.3, 11.1 ms), each
 * swept by a slow (0.63 Hz) and a fast (5.9 Hz) sine 120 degrees apart from the others (phase-shifted PeriodicWaves on
 * oscillators, never automation, so offline renders stay bit-exact), tap 1 left, tap 2 right, tap 3 both, under the
 * dry signal; a lowpass on the wet (the BBD's dark side). The thick, moving width of a 70s string machine.
 *
 * `padChord`: a sustained chord, one of
 *   "juno"     per note a saw and a 30% pulse 5 cents apart and a quiet square an octave down (the Juno-106's DCO
 *              mix), a 24 dB lowpass whose cutoff breathes with a slow LFO (one period over `lfoSec`) and a soft
 *              attack envelope, through the ensemble;
 *   "strings"  a string section: per note three saws (-7, 0, +7 cents) and a saw an octave up, a 5.6 Hz vibrato
 *              fading in, a lowpass and a body peak at 1.1 kHz (the violins' bite) and a cut under 180 Hz;
 *   "choir"    an "aah" pad: per note two detuned saws through three parallel formant bandpasses (F1 F2 F3 of /a/);
 *   "organ"    a drawbar organ (8' 4' 2 2/3' 2') with a 6.7 Hz vibrato-chorus (the house organ under a piano).
 * Every kind: tones spread across the stereo field low-left to high-right; envelopes end on exactly 0.
 */
import { clamp, hz, type BusIn, type VoiceHost } from "./host.ts";

const sines = new WeakMap<BaseAudioContext, Map<number, PeriodicWave>>();

/** A sine starting at `phase` radians, as a PeriodicWave (oscillators cannot be given a start phase otherwise). */
export function phasedSine(ctx: BaseAudioContext, phase: number): PeriodicWave {
  let m = sines.get(ctx);
  if (!m) sines.set(ctx, (m = new Map()));
  const key = Math.round(phase * 1000);
  let w = m.get(key);
  if (!w) {
    w = ctx.createPeriodicWave(new Float32Array([0, Math.sin(phase)]), new Float32Array([0, Math.cos(phase)]), { disableNormalization: true });
    m.set(key, w);
  }
  return w;
}

const pulses = new WeakMap<BaseAudioContext, PeriodicWave>();
/** A band-limited pulse of 30% duty. */
function pulse30(ctx: BaseAudioContext): PeriodicWave {
  let w = pulses.get(ctx);
  if (!w) {
    const N = 64;
    const real = new Float32Array(N + 1);
    const imag = new Float32Array(N + 1);
    for (let k = 1; k <= N; k++) {
      // Pulse of duty d: (2 / (pi k)) sin(pi k d) cos(k theta) (centred).
      real[k] = (2 / (Math.PI * k)) * Math.sin(Math.PI * k * 0.3);
    }
    w = ctx.createPeriodicWave(real, imag);
    pulses.set(ctx, w);
  }
  return w;
}

/**
 * The ensemble chorus into `dest`, built once: returns its (stereo) input. `wet` 0..1, `depth` scales the sweeps.
 * Persistent: its LFOs run for the life of the context.
 */
export function ensembleFx(h: VoiceHost, dest: AudioNode, wet: number, depth = 1): GainNode {
  const ctx = h.ctx;
  const input = ctx.createGain();
  input.channelCount = 2;
  input.channelCountMode = "explicit";
  if (!h.live) {
    // Offline: a -120 dB constant keeps the delays from going silent (their tails would end at a main-thread moment).
    const keep = ctx.createConstantSource();
    keep.offset.value = 1e-6;
    keep.start(0);
    keep.connect(input);
  }
  const mono = ctx.createGain();
  mono.channelCount = 1;
  mono.channelCountMode = "explicit";
  input.connect(mono);
  const wetLp = ctx.createBiquadFilter();
  wetLp.type = "lowpass";
  wetLp.frequency.value = 7500;
  mono.connect(wetLp);
  const taps: GainNode[] = [];
  [0.0055, 0.0083, 0.0111].forEach((sec, i) => {
    const d = ctx.createDelay(0.05);
    d.delayTime.value = sec;
    // The two sweeps summed in one gain (two inputs), then into the delay time (one input).
    const sweep = ctx.createGain();
    for (const [rate, amount] of [[0.63, 0.0019], [5.9, 0.00022]] as const) {
      const lfo = ctx.createOscillator();
      lfo.setPeriodicWave(phasedSine(ctx, (i * 2 * Math.PI) / 3));
      lfo.frequency.value = rate;
      const g = ctx.createGain();
      g.gain.value = amount * depth;
      lfo.connect(g);
      g.connect(sweep);
      lfo.start(0);
    }
    sweep.connect(d.delayTime);
    wetLp.connect(d);
    const g = ctx.createGain();
    g.gain.value = wet * 0.8;
    d.connect(g);
    taps.push(g);
  });
  // Tap 1 + tap 3 left, tap 2 + tap 3 right (two inputs per sum).
  const left = ctx.createGain();
  const right = ctx.createGain();
  const third = ctx.createGain();
  third.gain.value = 0.7;
  taps[2].connect(third);
  taps[0].connect(left);
  third.connect(left);
  taps[1].connect(right);
  third.connect(right);
  const merger = ctx.createChannelMerger(2);
  left.connect(merger, 0, 0);
  right.connect(merger, 0, 1);
  const out = ctx.createGain();
  out.channelCount = 2;
  out.channelCountMode = "explicit";
  input.connect(out);
  merger.connect(out);
  out.connect(dest);
  return input;
}

export type PadKind = "juno" | "strings" | "choir" | "organ";

export interface PadOptions {
  kind: PadKind;
  level: number;
  /** Lowpass Hz; LFO period s (0 = none) and depth 0..1 (cutoff x 2^(+-2 depth)). */
  cutoff: number;
  lfoSec: number;
  lfoDepth: number;
  /** Attack and release, s. */
  attack: number;
  release: number;
  /** Register shift, semitones. */
  octave: number;
  /** Stereo spread of the tones 0..1. */
  width: number;
}

/** Holds a pad chord at `t` for `length` s into `bus`. `phase` (0..1) is where in its LFO period the chord starts. */
export function padChord(h: VoiceHost, t: number, midis: readonly number[], length: number, o: PadOptions, bus: BusIn, phase = 0) {
  const ctx = h.ctx;
  const notes = midis.map((m) => m + o.octave);
  const attack = Math.min(o.attack, length * 0.7);
  const end = t + length + o.release;
  const peak = (0.05 * o.level) / Math.sqrt(notes.length);
  notes.forEach((m, i) => {
    const f = hz(m);
    const rest: AudioNode[] = [];
    const oscs: OscillatorNode[] = [];
    let chain: AudioNode | null = null;
    const add = (osc: OscillatorNode, level: number) => {
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g);
      rest.push(g);
      chain = h.sum(chain, g, rest);
      oscs.push(osc);
    };
    const osc = (type: OscillatorType | PeriodicWave, freq: number, cents: number) => {
      const o2 = ctx.createOscillator();
      if (typeof type === "string") o2.type = type as OscillatorType;
      else o2.setPeriodicWave(type);
      o2.frequency.setValueAtTime(freq, t);
      o2.detune.setValueAtTime(cents, t);
      return o2;
    };
    let vib: GainNode | null = null;
    if (o.kind === "strings" || o.kind === "organ") {
      const lfo = ctx.createOscillator();
      lfo.setPeriodicWave(phasedSine(ctx, i * 1.3));
      lfo.frequency.value = o.kind === "strings" ? 5.6 + 0.13 * i : 6.7;
      vib = ctx.createGain();
      const depth = o.kind === "strings" ? 9 : 5;
      vib.gain.setValueAtTime(0, t);
      vib.gain.linearRampToValueAtTime(depth, t + Math.max(0.3, attack));
      lfo.connect(vib);
      rest.push(vib);
      oscs.push(lfo);
    }
    const voices: [OscillatorNode, number][] = [];
    if (o.kind === "juno") {
      voices.push([osc("sawtooth", f, -5), 0.5], [osc(pulse30(ctx), f, 5), 0.45], [osc("square", f / 2, 0), 0.16]);
    } else if (o.kind === "strings") {
      voices.push([osc("sawtooth", f, -7), 0.4], [osc("sawtooth", f, 0.5), 0.4], [osc("sawtooth", f, 7), 0.4], [osc("sawtooth", f * 2, 3), 0.16]);
    } else if (o.kind === "choir") {
      voices.push([osc("sawtooth", f, -6), 0.6], [osc("sawtooth", f, 6), 0.6]);
    } else {
      voices.push([osc("sine", f, 0), 0.7], [osc("sine", f * 2, 1), 0.45], [osc("sine", f * 3, -1), 0.28], [osc("sine", f * 4, 0), 0.18]);
    }
    for (const [x, level] of voices) {
      if (vib) vib.connect(x.detune);
      add(x, level);
    }
    let node = chain as AudioNode | null;
    if (!node) return;
    if (o.kind === "choir") {
      let sum: AudioNode | null = null;
      for (const [ff, q, g] of [[760, 9, 1], [1150, 11, 0.55], [2700, 14, 0.28]] as const) {
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = ff;
        bp.Q.value = q;
        const gg = ctx.createGain();
        gg.gain.value = g * 3;
        node.connect(bp);
        bp.connect(gg);
        rest.push(bp, gg);
        sum = h.sum(sum, gg, rest);
      }
      node = sum as AudioNode;
    }
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = o.kind === "juno" ? 1.4 : 0.6;
    lp.frequency.setValueAtTime(o.cutoff * 0.5, t);
    lp.frequency.linearRampToValueAtTime(o.cutoff, t + Math.max(0.05, attack));
    node.connect(lp);
    rest.push(lp);
    let last: AudioNode = lp;
    if (o.lfoSec > 0 && o.lfoDepth > 0) {
      // The slow filter LFO, in octaves of the cutoff through detune (cents): +-2 x depth octaves.
      const lfo = ctx.createOscillator();
      lfo.setPeriodicWave(phasedSine(ctx, 2 * Math.PI * (phase % 1) - Math.PI / 2));
      lfo.frequency.value = 1 / o.lfoSec;
      const g = ctx.createGain();
      g.gain.value = 1200 * clamp(o.lfoDepth, 0, 1);
      lfo.connect(g);
      g.connect(lp.detune);
      rest.push(g);
      oscs.push(lfo);
    }
    if (o.kind === "juno") {
      const lp2 = ctx.createBiquadFilter();
      lp2.type = "lowpass";
      lp2.frequency.value = o.cutoff * 1.6;
      lp2.Q.value = 0.5;
      last.connect(lp2);
      rest.push(lp2);
      last = lp2;
    }
    if (o.kind === "strings") {
      const body = ctx.createBiquadFilter();
      body.type = "peaking";
      body.frequency.value = 1100;
      body.Q.value = 1.2;
      body.gain.value = 4;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 180;
      last.connect(body);
      body.connect(hp);
      rest.push(body, hp);
      last = hp;
    }
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(peak, t + Math.max(0.01, attack));
    amp.gain.setValueAtTime(peak, t + length);
    amp.gain.linearRampToValueAtTime(0.0001, end);
    amp.gain.setValueAtTime(0, end);
    last.connect(amp);
    const pan = h.pan(notes.length === 1 ? 0 : (-1 + (2 * i) / (notes.length - 1)) * o.width, bus);
    pan.add(amp);
    rest.push(amp, pan.dest);
    for (const x of oscs) x.start(t);
    oscs.forEach((x, k) => h.end(x, k === 0 ? rest : [], end + 0.05));
  });
}
