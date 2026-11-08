import type { Source, VoiceModule } from "./types.ts";
import { adsr, biquad, brightCut, gainNode, lfo, noteOsc, satCurve, shaper, sumAll } from "./util.ts";

/**
 * Supersaw: a unison stack of 3..9 band-limited saws (each starting at its own phase), detuned on a JP-8000-like curve
 * (the outer voices further out), split into a left and a right half each through its own resonant lowpass, so the
 * stack is wide while a centre sine keeps the root solid. The filter opens with an envelope, breathes with a slow LFO
 * and follows the song form. Pads, strings beds, big chords, trance-ish leads.
 */
const defaults = {
  voices: 7,
  detune: 22,
  spread: 0.8,
  center: 0.35,
  oct: 0,
  cutoff: 1800,
  env: 1500,
  envDecay: 0.5,
  q: 0.8,
  lfoRate: 0.15,
  lfoDepth: 0.25,
  bright: 0.4,
  hp: 120,
  drive: 0,
  a: 0.08,
  d: 0.6,
  s: 0.7,
  r: 0.6,
  gain: 1,
};
export type SupersawParams = typeof defaults;

export const supersaw: VoiceModule<SupersawParams> = {
  doc: "Unison saw stack (3..9 voices, phase-spread, curved detune), split L/R through two lowpasses, centre sine, filter env + LFO.",
  defaults,
  ranges: {
    voices: [3, 9], detune: [0, 60], spread: [0, 1], center: [0, 1], oct: [-2, 2], cutoff: [100, 12000], env: [0, 8000], envDecay: [0.02, 4],
    q: [0.3, 8], lfoRate: [0.02, 8], lfoDepth: [0, 0.9], bright: [0, 0.9], hp: [20, 2000], drive: [0, 4], a: [0.001, 4], d: [0.01, 4],
    s: [0, 1], r: [0.02, 4], gain: [0, 2],
  },
  play(h, n, p) {
    const { ctx } = h;
    const sources: Source[] = [];
    const keep: AudioNode[] = [];
    const mult = Math.pow(2, Math.round(p.oct));
    const count = Math.round(p.voices);
    const halves: AudioNode[][] = [[], []];
    for (let i = 0; i < count; i++) {
      const x = count > 1 ? (i / (count - 1)) * 2 - 1 : 0;
      // The JP-8000 curve: the inner voices close, the outer ones far.
      const cents = Math.sign(x) * Math.pow(Math.abs(x), 1.4) * p.detune;
      const o = noteOsc(ctx, n, mult, { wave: h.wave("saw", (n.seed + i * 5) % 16), detune: cents, glide: 0.08 });
      const g = gainNode(ctx, (Math.abs(x) < 0.01 ? 0.8 : 1) / Math.sqrt(count));
      o.connect(g);
      sources.push(o);
      keep.push(g);
      if (Math.abs(x) < 0.01) {
        halves[0].push(g);
        halves[1].push(g);
      } else halves[x < 0 ? 0 : 1].push(g);
    }
    const peak = 0.12 * p.gain * (0.55 + 0.45 * n.vel);
    const cut = brightCut(p.cutoff, n, p.bright);
    const filterLfo = p.lfoDepth > 0 ? lfo(ctx, h.wave("sine", n.seed % 16), p.lfoRate, cut * p.lfoDepth, n.time, sources, keep) : null;
    let end = n.time;
    halves.forEach((half, side) => {
      const sum = sumAll(ctx, half, keep);
      if (!sum) return;
      let chain: AudioNode = sum;
      if (p.drive > 0) {
        const sh = shaper(ctx, satCurve(p.drive));
        chain.connect(sh);
        keep.push(sh);
        chain = sh;
      }
      const hp = biquad(ctx, "highpass", p.hp, 0.6);
      const lp = biquad(ctx, "lowpass", cut, p.q);
      lp.frequency.setValueAtTime(cut + p.env * n.vel, n.time);
      if (p.env > 0) lp.frequency.exponentialRampToValueAtTime(cut, n.time + p.envDecay);
      filterLfo?.connect(lp.frequency);
      const amp = gainNode(ctx, 0);
      end = adsr(amp.gain, n.time, peak, p.a, p.d, p.s, n.length, p.r);
      chain.connect(hp);
      hp.connect(lp);
      lp.connect(amp);
      keep.push(hp, lp, amp, ...h.out(amp, n.pan + (side ? 1 : -1) * p.spread));
    });
    if (p.center > 0) {
      const o = noteOsc(ctx, n, mult, { type: "sine", glide: 0.08 });
      const amp = gainNode(ctx, 0);
      adsr(amp.gain, n.time, peak * p.center * 0.8, p.a, p.d, p.s, n.length, p.r);
      o.connect(amp);
      sources.push(o);
      keep.push(amp, ...h.out(amp, n.pan));
    }
    h.play(sources, keep, n.time, end + 0.05);
  },
};
