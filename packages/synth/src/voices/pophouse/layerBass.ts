/**
 * Layered house bass, the part over the sub (the sub sine stays its own mono voice): two layers with distinct roles.
 *   growl (mid, 110 Hz..1.5 kHz)  by `kind`:
 *     "slap"   a 3-operator FM bass guitar: a sine carrier, a ratio-1 modulator whose index falls from a thumb
 *              transient (~50 ms) to a woody body, a ratio-3 modulator for the string's edge; octave pops brighter;
 *     "saw"    two saws 7 cents apart and a square an octave down, a 24 dB lowpass with a fast envelope (the italo /
 *              disco synth bass: Solton, Juno, Prophet);
 *     "organ"  the M1 organ bass: sines at 1, 2 and 3 x f with a key click, driven;
 *     "pluck"  a saw and a 25% pulse through a resonant lowpass snapping shut (future-house bounce);
 *   then a highpass (the sub owns the bottom), a tanh stage (harmonics that read on small speakers);
 *   top (1.2..6 kHz)  the growl's own bright edge, highpassed and given a short envelope: the attack you hear on a
 *            phone, the "click" of the pick or thumb.
 * Mono, centred: the bass never spreads.
 */
import { adsr, clamp, hz, type BusIn, type VoiceHost } from "./host.ts";

export type BassKind = "slap" | "saw" | "organ" | "pluck";

export interface LayerBassOptions {
  kind: BassKind;
  level: number;
  /** Lowpass Hz of the growl, its envelope 0..1, decay s. */
  cutoff: number;
  env: number;
  decay: number;
  /** Amp sustain 0..1, release s. */
  sustain: number;
  release: number;
  /** tanh drive 0..5; the top layer 0..1; highpass under the growl, Hz. */
  drive: number;
  top: number;
  hp: number;
}

/** One bass note an octave over the sub at `midi`, `from` (Hz, 0 = none) the pitch it glides in from over `glide` s. */
export function layerBass(h: VoiceHost, t: number, midi: number, length: number, vel: number, from: number, glide: number, o: LayerBassOptions, bus: BusIn) {
  const ctx = h.ctx;
  const f = hz(midi);
  const v = clamp(vel, 0, 1.15);
  const hold = Math.max(0.03, length);
  const rest: AudioNode[] = [];
  const oscs: OscillatorNode[] = [];
  let chain: AudioNode | null = null;
  const pitch = (osc: OscillatorNode, ratio: number) => {
    if (from > 0 && from !== f) {
      osc.frequency.setValueAtTime(from * ratio, t);
      osc.frequency.exponentialRampToValueAtTime(f * ratio, t + glide);
    } else osc.frequency.setValueAtTime(f * ratio, t);
  };
  const add = (type: OscillatorType, ratio: number, cents: number, level: number) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    pitch(osc, ratio);
    osc.detune.setValueAtTime(cents, t);
    const g = ctx.createGain();
    g.gain.value = level;
    osc.connect(g);
    rest.push(g);
    chain = h.sum(chain, g, rest);
    oscs.push(osc);
    return osc;
  };
  const pop = midi >= 52;
  if (o.kind === "slap") {
    const car = ctx.createOscillator();
    car.type = "sine";
    pitch(car, 1);
    // Both modulators summed in one gain (two inputs), then into the carrier's frequency (one input).
    const mods = ctx.createGain();
    mods.connect(car.frequency);
    rest.push(mods);
    for (const [ratio, idx, fall, floor] of [[1, pop ? 7 : 5, 0.05, 0.22], [3, pop ? 1.6 : 0.9, 0.025, 0.05]] as const) {
      const mod = ctx.createOscillator();
      mod.type = "sine";
      pitch(mod, ratio);
      const index = ctx.createGain();
      const depth = Math.max(0.01, f * idx * (0.6 + 0.4 * v));
      index.gain.setValueAtTime(depth, t);
      index.gain.exponentialRampToValueAtTime(Math.max(0.01, depth * floor), t + fall);
      mod.connect(index);
      index.connect(mods);
      rest.push(index);
      oscs.push(mod);
    }
    const g = ctx.createGain();
    g.gain.value = 0.9;
    car.connect(g);
    rest.push(g);
    chain = g;
    oscs.push(car);
  } else if (o.kind === "saw") {
    add("sawtooth", 1, -7, 0.5);
    add("sawtooth", 1, 7, 0.5);
    add("square", 0.5, 0, 0.25);
  } else if (o.kind === "organ") {
    add("sine", 1, 0, 0.8);
    add("sine", 2, 2, 0.45);
    add("sine", 3, -2, 0.16);
    add("square", 1, 0, 0.08);
  } else {
    add("sawtooth", 1, -4, 0.55);
    add("square", 1, 4, 0.35);
  }
  const src = chain as AudioNode | null;
  if (!src) return;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = o.hp;
  hp.Q.value = 0.7;
  src.connect(hp);
  const cut = o.cutoff * (0.7 + 0.3 * Math.min(1, v));
  const peakCut = clamp(cut * (1 + 6 * o.env * Math.min(1, v) * (pop ? 1.3 : 1)), cut, 16000);
  let node: AudioNode = hp;
  for (let i = 0; i < (o.kind === "saw" || o.kind === "pluck" ? 2 : 1); i++) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = i === 0 ? (o.kind === "pluck" ? 5 : 1.2) : 0.6;
    lp.frequency.setValueAtTime(peakCut, t);
    lp.frequency.exponentialRampToValueAtTime(cut, t + o.decay);
    node.connect(lp);
    rest.push(lp);
    node = lp;
  }
  rest.push(hp);
  const driven = h.drive(node, o.drive * (0.7 + 0.3 * Math.min(1, v)), rest);
  const amp = ctx.createGain();
  const end = adsr(amp.gain, t, 0.15 * o.level * (0.6 + 0.4 * Math.min(1, v)), 0.002, o.decay * 1.5, o.sustain, hold, o.release);
  driven.connect(amp);
  // Top layer: the growl's bright edge, highpassed, gone in ~60 ms.
  let out: AudioNode = amp;
  if (o.top > 0) {
    const thp = ctx.createBiquadFilter();
    thp.type = "highpass";
    thp.frequency.value = 1200;
    thp.Q.value = 0.8;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0, t);
    tg.gain.linearRampToValueAtTime(1.6 * o.top * (pop ? 1.4 : 1), t + 0.002);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    tg.gain.setValueAtTime(0, t + 0.07);
    driven.connect(thp);
    thp.connect(tg);
    rest.push(thp, tg);
    const sum = ctx.createGain();
    tg.connect(sum);
    // The top rides the amp envelope's level: through `amp` too would double it, so it goes beside it.
    const topAmp = ctx.createGain();
    topAmp.gain.value = 0.15 * o.level;
    sum.connect(topAmp);
    out = h.sum(amp, topAmp, rest);
    rest.push(sum, topAmp);
  }
  bus.add(out);
  rest.push(amp);
  for (const osc of oscs) osc.start(t);
  oscs.forEach((osc, i) => h.end(osc, i === 0 ? rest : [], end + 0.05));
}
