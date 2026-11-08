/**
 * Supersaw (Roland JP-8000 style, the future-house / pop-dance chord and the plucky "Kungs / Joel Corry" stab).
 * Per note 7 (or `voices`, 3..9) band-limited saws at the JP-8000 detune ratios (Adam Szabo's measurements: the
 * outer pair at +-11% of the full spread, the inner ones closer), each with its own free-running start phase (a
 * phase-shifted PeriodicWave, so the stack never starts as one hard zap), the centre saw loud and the side saws mixed
 * by `mix` along Szabo's curves; the side saws alternate left and right (the centre in both). A highpass at the
 * note's fundamental keeps the stack from muddying the bass (as the JP-8000 does); an optional sine an octave down
 * gives it body; a lowpass with its own envelope and a tanh stage after it; an amp ADSR. Pluck or pad by envelope.
 */
import { adsr, clamp, hz, type BusIn, type VoiceHost } from "./host.ts";

/** JP-8000 relative detune offsets of the 7 saws (Szabo, "How to Emulate the Super Saw", 2010). */
const OFFSETS7 = [-0.11002313, -0.06288439, -0.01952356, 0, 0.01991221, 0.06216538, 0.10745242];

export interface SupersawOptions {
  level: number;
  /** Saws per note, 3..9 (odd). */
  voices: number;
  /** The outer saws' spread, cents 0..60. */
  detune: number;
  /** Side saws against the centre, 0..1 (Szabo's mix knob). */
  mix: number;
  /** Lowpass Hz, its envelope 0..1 (to cutoff x (1 + 6 env)) and decay s; resonance. */
  cutoff: number;
  env: number;
  fdecay: number;
  q: number;
  /** Amp envelope. */
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  /** Stereo width of the side saws 0..1; sine an octave down 0..1; tanh drive 0..3. */
  width: number;
  sub: number;
  drive: number;
  /** Optional: the whole stack moved across the stereo field, -1..1 (an arp's ping-pong). Default 0. */
  pan?: number;
}

const waves = new WeakMap<BaseAudioContext, PeriodicWave[]>();

/** Nine band-limited saws, each starting at its own phase (deterministic). */
function sawWaves(ctx: BaseAudioContext): PeriodicWave[] {
  let w = waves.get(ctx);
  if (!w) {
    w = [];
    const N = 64;
    for (let v = 0; v < 9; v++) {
      const phase = (v * 2.399963) % (2 * Math.PI);
      const real = new Float32Array(N + 1);
      const imag = new Float32Array(N + 1);
      for (let k = 1; k <= N; k++) {
        // A saw's k-th harmonic, its phase moved by k x phase: the same wave, started later.
        const a = ((k % 2 ? 1 : -1) * 2) / (Math.PI * k);
        real[k] = a * Math.sin(k * phase);
        imag[k] = a * Math.cos(k * phase);
      }
      w.push(ctx.createPeriodicWave(real, imag, { disableNormalization: false }));
    }
    waves.set(ctx, w);
  }
  return w;
}

/** The detune offsets (fractions of the outer spread, -1..1) of `n` saws. */
function offsets(n: number): number[] {
  if (n === 7) return OFFSETS7.map((x) => x / 0.11);
  return Array.from({ length: n }, (_, i) => (n === 1 ? 0 : (2 * i) / (n - 1) - 1) * (0.55 + 0.45 * Math.abs((2 * i) / (n - 1) - 1)));
}

/** Plays a supersaw chord at `t` for `length` s at `vel` 0..1 into `bus`; `cutMul` scales the cutoff (filter arcs). */
export function supersaw(h: VoiceHost, t: number, midis: readonly number[], length: number, vel: number, o: SupersawOptions, bus: BusIn, cutMul = 1) {
  const ctx = h.ctx;
  const v = clamp(vel, 0, 1);
  const n = clamp(Math.round(o.voices) | 1, 3, 9);
  const offs = offsets(n);
  const centre = -0.55366 * o.mix + 0.99785;
  const side = -0.73764 * o.mix * o.mix + 1.2841 * o.mix + 0.044372;
  const ws = sawWaves(ctx);
  const hold = Math.max(0.03, length);
  const cut = clamp(o.cutoff * cutMul * (0.6 + 0.4 * v), 120, 16000);
  const top = clamp(cut * (1 + 6 * o.env * v), cut, 18000);
  const low = Math.min(...midis);
  const peak = (0.15 * o.level * (0.45 + 0.55 * v)) / Math.sqrt(midis.length * (1 + 0.35 * (n - 1) * side));
  for (const s of [-1, 1]) {
    const rest: AudioNode[] = [];
    const oscs: OscillatorNode[] = [];
    let chain: AudioNode | null = null;
    midis.forEach((m, mi) => {
      const f = hz(m);
      offs.forEach((x, i) => {
        const mine = x === 0 || (i % 2 === 0 ? s < 0 : s > 0);
        if (!mine) return;
        const osc = ctx.createOscillator();
        osc.setPeriodicWave(ws[(i + mi * 3) % 9]);
        osc.frequency.setValueAtTime(f, t);
        osc.detune.setValueAtTime(x * o.detune, t);
        const g = ctx.createGain();
        g.gain.value = x === 0 ? centre * 0.5 : side;
        osc.connect(g);
        rest.push(g);
        chain = h.sum(chain, g, rest);
        oscs.push(osc);
      });
      if (o.sub > 0) {
        const sub = ctx.createOscillator();
        sub.type = "sine";
        sub.frequency.setValueAtTime(f / 2, t);
        const g = ctx.createGain();
        g.gain.value = 0.5 * o.sub;
        sub.connect(g);
        rest.push(g);
        chain = h.sum(chain, g, rest);
        oscs.push(sub);
      }
    });
    if (!chain) continue;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = hz(low) * (o.sub > 0 ? 0.4 : 0.8);
    hp.Q.value = 0.6;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = o.q;
    lp.frequency.setValueAtTime(top, t);
    lp.frequency.exponentialRampToValueAtTime(cut, t + o.fdecay);
    (chain as AudioNode).connect(hp);
    hp.connect(lp);
    rest.push(hp, lp);
    const node = h.drive(lp, o.drive, rest);
    const amp = ctx.createGain();
    const end = adsr(amp.gain, t, peak, o.attack, o.decay, o.sustain, hold, o.release);
    node.connect(amp);
    const pan = h.pan(clamp(s * o.width + (o.pan ?? 0), -1, 1), bus);
    pan.add(amp);
    rest.push(amp, pan.dest);
    for (const osc of oscs) osc.start(t);
    oscs.forEach((osc, i) => h.end(osc, i === 0 ? rest : [], end + 0.05));
  }
}
