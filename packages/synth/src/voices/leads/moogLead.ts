import type { Source, VoiceModule } from "../types.ts";
import { adsr, biquad, brightCut, gainNode, lfo, noteOsc, satCurve, shaper, sumAll } from "../util.ts";

/**
 * Monophonic Minimoog-style lead: three oscillators (saw, a narrow pulse a few cents up, a sine) gliding together
 * from the last note (legato portamento), driven into a 24 dB "ladder" (two cascaded resonant lowpasses, the second
 * resonant) with its own envelope and key tracking, a delayed deep vibrato on all three, and a pure sine an octave up
 * (`whistle`) that rides over it: the high whine of G-funk (Dr. Dre, Warren G, DJ Quik, "the whistle"). Turn the
 * whistle up and the saw down for the sine-like whistle; the other way round for a buzzier Moog line.
 */
const defaults = {
  saw: 0.6,
  pulse: 0.3,
  sine: 0.7,
  whistle: 0.3,
  cutoff: 1500,
  env: 1200,
  envDecay: 0.4,
  q: 4,
  track: 0.5,
  bright: 0.25,
  drive: 1.4,
  glide: 0.09,
  vib: 24,
  vibRate: 5.6,
  vibDelay: 0.22,
  a: 0.02,
  d: 0.4,
  s: 0.85,
  r: 0.25,
  gain: 1,
};
export type MoogLeadParams = typeof defaults;

export const moogLead: VoiceModule<MoogLeadParams> = {
  doc: "Minimoog-style mono lead: saw + pulse + sine gliding, driven 24 dB ladder with env + key track, delayed vibrato, sine whistle 8va.",
  defaults,
  ranges: {
    saw: [0, 1.5], pulse: [0, 1.5], sine: [0, 1.5], whistle: [0, 1.5], cutoff: [100, 10000], env: [0, 8000], envDecay: [0.02, 3], q: [0.3, 14],
    track: [0, 1], bright: [0, 0.9], drive: [0, 4], glide: [0, 0.4], vib: [0, 60], vibRate: [0.5, 9], vibDelay: [0, 2], a: [0.001, 2], d: [0.01, 3],
    s: [0, 1], r: [0.02, 3], gain: [0, 2],
  },
  play(h, n, p) {
    const { ctx } = h;
    const sources: Source[] = [];
    const keep: AudioNode[] = [];
    const vib = p.vib > 0 ? lfo(ctx, h.wave("sine", n.seed % 16), p.vibRate, p.vib, n.time, sources, keep, Math.min(n.length, p.vibDelay)) : null;
    const parts: AudioNode[] = [];
    const add = (o: OscillatorNode, level: number) => {
      vib?.connect(o.detune);
      const g = gainNode(ctx, level);
      o.connect(g);
      sources.push(o);
      keep.push(g);
      parts.push(g);
    };
    if (p.saw > 0) add(noteOsc(ctx, n, 1, { wave: h.wave("saw", n.seed % 16), glide: p.glide }), p.saw);
    if (p.pulse > 0) add(noteOsc(ctx, n, 1, { wave: h.wave("pulse", (n.seed + 5) % 16, 0.18), detune: 6, glide: p.glide }), p.pulse);
    if (p.sine > 0) add(noteOsc(ctx, n, 1, { type: "sine", glide: p.glide }), p.sine);
    let chain = sumAll(ctx, parts, keep);
    const peak = 0.11 * p.gain * (0.6 + 0.4 * n.vel);
    let end = n.time;
    if (chain) {
      if (p.drive > 0) {
        const sh = shaper(ctx, satCurve(p.drive, 0.12));
        chain.connect(sh);
        keep.push(sh);
        chain = sh;
      }
      const base = brightCut(p.cutoff * Math.pow(n.freq / 440, p.track), n, p.bright);
      const lp1 = biquad(ctx, "lowpass", base, 0.7);
      const lp2 = biquad(ctx, "lowpass", base, p.q);
      for (const lp of [lp1, lp2]) {
        lp.frequency.setValueAtTime(Math.min(18000, base + p.env * n.vel), n.time);
        if (p.env > 0) lp.frequency.exponentialRampToValueAtTime(base, n.time + p.envDecay);
      }
      const amp = gainNode(ctx, 0);
      end = adsr(amp.gain, n.time, peak, p.a, p.d, p.s, n.length, p.r);
      chain.connect(lp1);
      lp1.connect(lp2);
      lp2.connect(amp);
      keep.push(lp1, lp2, amp, ...h.out(amp, n.pan));
    }
    if (p.whistle > 0) {
      const o = noteOsc(ctx, n, 2, { type: "sine", glide: p.glide });
      vib?.connect(o.detune);
      const amp = gainNode(ctx, 0);
      end = Math.max(end, adsr(amp.gain, n.time, peak * p.whistle * 0.6, Math.max(p.a, 0.03), p.d, p.s, n.length, p.r));
      o.connect(amp);
      sources.push(o);
      keep.push(amp, ...h.out(amp, n.pan));
    }
    h.play(sources, keep, n.time, end + 0.05);
  },
};
