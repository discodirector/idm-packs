/**
 * Brass section stab (the disco / filter-house horn hit: Kungs "This Girl", Cassius, the Chic horns), as an ensemble
 * stack of three instruments per chord:
 *   trumpets   on the chord tones: per tone two saws and a 1/3-duty pulse a few cents apart, a lip scoop (the pitch
 *              rising ~1.5 semitones into the note in 40 ms), a breath burst (bandpassed noise at 1.6 kHz) on the
 *              attack; split left and right;
 *   trombones  the chord's root and fifth an octave down, darker, centred;
 *   brightness rides loudness (the one rule of brass): a lowpass opening with the amp swell and closing with it,
 *   then two formant peaks (1.2 kHz and 2.7 kHz, the bell's resonances) and a little drive.
 * `fall` adds a fall-off: the pitch drops ~4 semitones over the release (the disco "doo-wah" ending).
 */
import { adsr, clamp, hz, type BusIn, type VoiceHost } from "./host.ts";

export interface BrassOptions {
  level: number;
  /** Lowpass Hz at full loudness and how far it opens 0..2. */
  cutoff: number;
  env: number;
  /** Swell (attack) s, decay s, sustain 0..1, release s. */
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  /** Lip scoop, semitones; breath 0..1; trombones 0..1; fall-off 0..1; drive 0..3; stereo width 0..1. */
  scoop: number;
  breath: number;
  bones: number;
  fall: number;
  drive: number;
  width: number;
}

const pulses = new WeakMap<BaseAudioContext, PeriodicWave>();
function pulse33(ctx: BaseAudioContext): PeriodicWave {
  let w = pulses.get(ctx);
  if (!w) {
    const N = 48;
    const real = new Float32Array(N + 1);
    const imag = new Float32Array(N + 1);
    for (let k = 1; k <= N; k++) real[k] = (2 / (Math.PI * k)) * Math.sin((Math.PI * k) / 3);
    w = ctx.createPeriodicWave(real, imag);
    pulses.set(ctx, w);
  }
  return w;
}

/** A horn stab at `t`, `length` s, `vel` 0..1, of `midis` (the voicing, low to high) into `bus`. */
export function brassSection(h: VoiceHost, t: number, midis: readonly number[], length: number, vel: number, o: BrassOptions, bus: BusIn) {
  const ctx = h.ctx;
  const v = clamp(vel, 0, 1);
  const hold = Math.max(0.05, length);
  const groups: { notes: number[]; pan: number; dark: number; level: number }[] = [
    { notes: midis.filter((_, i) => i % 2 === 0), pan: -o.width, dark: 1, level: 1 },
    { notes: midis.filter((_, i) => i % 2 === 1), pan: o.width, dark: 1, level: 1 },
  ];
  if (o.bones > 0) groups.push({ notes: [midis[0] - 12, midis[0] - 5], pan: 0, dark: 0.45, level: 0.8 * o.bones });
  const peakAll = (0.17 * o.level * (0.4 + 0.6 * v)) / Math.sqrt(midis.length + (o.bones > 0 ? 2 : 0));
  for (const gp of groups) {
    if (!gp.notes.length) continue;
    const rest: AudioNode[] = [];
    const srcs: AudioScheduledSourceNode[] = [];
    let chain: AudioNode | null = null;
    const peak = peakAll * gp.level;
    const end0 = t + hold + o.release;
    for (const m of gp.notes) {
      const f = hz(m);
      const parts: [OscillatorType | PeriodicWave, number, number][] = [["sawtooth", -6, 0.45], ["sawtooth", 5, 0.45], [pulse33(ctx), 0, 0.35]];
      for (const [type, cents, level] of parts) {
        const osc = ctx.createOscillator();
        if (typeof type === "string") osc.type = type as OscillatorType;
        else osc.setPeriodicWave(type);
        osc.frequency.setValueAtTime(f * 2 ** (-o.scoop / 12), t);
        osc.frequency.exponentialRampToValueAtTime(f, t + 0.04);
        if (o.fall > 0) {
          osc.frequency.setValueAtTime(f, t + hold);
          osc.frequency.exponentialRampToValueAtTime(f * 2 ** ((-4 * o.fall) / 12), end0);
        }
        osc.detune.setValueAtTime(cents, t);
        const g = ctx.createGain();
        g.gain.value = level;
        osc.connect(g);
        rest.push(g);
        chain = h.sum(chain, g, rest);
        srcs.push(osc);
      }
    }
    if (o.breath > 0 && gp.dark === 1) {
      const n = ctx.createBufferSource();
      n.buffer = h.noise();
      n.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1600;
      bp.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5 * o.breath, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      g.gain.setValueAtTime(0, t + 0.08);
      n.connect(bp);
      bp.connect(g);
      rest.push(bp, g);
      chain = h.sum(chain, g, rest);
      srcs.push(n);
    }
    const cut = o.cutoff * gp.dark * (0.6 + 0.4 * v);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 0.9;
    // Brightness follows loudness: the filter's envelope is the amp's shape.
    lp.frequency.setValueAtTime(cut * 0.25, t);
    lp.frequency.exponentialRampToValueAtTime(cut * (1 + o.env * v), t + Math.max(0.01, o.attack));
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, cut * (0.35 + 0.65 * o.sustain)), t + o.attack + o.decay);
    lp.frequency.setValueAtTime(Math.max(200, cut * (0.35 + 0.65 * o.sustain)), t + hold);
    lp.frequency.exponentialRampToValueAtTime(Math.max(150, cut * 0.25), end0);
    (chain as AudioNode).connect(lp);
    const f1 = ctx.createBiquadFilter();
    f1.type = "peaking";
    f1.frequency.value = 1200;
    f1.Q.value = 1.4;
    f1.gain.value = 5;
    const f2 = ctx.createBiquadFilter();
    f2.type = "peaking";
    f2.frequency.value = 2700;
    f2.Q.value = 1.8;
    f2.gain.value = 3.5;
    lp.connect(f1);
    f1.connect(f2);
    rest.push(lp, f1, f2);
    const node = h.drive(f2, o.drive * (0.6 + 0.6 * v), rest);
    const amp = ctx.createGain();
    const end = adsr(amp.gain, t, peak, o.attack, o.decay, o.sustain, hold, o.release);
    node.connect(amp);
    const pan = h.pan(gp.pan, bus);
    pan.add(amp);
    rest.push(amp, pan.dest);
    for (const s of srcs) s.start(t);
    srcs.forEach((s, i) => h.end(s, i === 0 ? rest : [], end + 0.05));
  }
}
