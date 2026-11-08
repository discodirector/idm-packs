import type { Source, VoiceModule } from "./types.ts";
import { adsr, biquad, gainNode, noteOsc, satCurve, shaper, sumAll } from "./util.ts";

/**
 * Brass section stab: a saw on each side `detune` cents apart (two players: a section, not one horn) over a square an
 * octave down in the middle (the low brass), all scooping up into the note; a short breath-noise spit at the attack;
 * a drive (a horn section pushed through a console); a lowpass whose envelope opens with the velocity squared (the
 * "blat": soft notes mellow, hard ones bright) and falls back. Premier / Pete Rock horn stabs, G-funk brass hits.
 */
const defaults = {
  detune: 9,
  spread: 0.55,
  low: 0.35,
  scoop: -1.2,
  scoopTime: 0.06,
  cutoff: 700,
  env: 2600,
  envDecay: 0.18,
  q: 1.4,
  spit: 0.25,
  drive: 1.6,
  a: 0.012,
  d: 0.25,
  s: 0.55,
  r: 0.14,
  gain: 1,
};
export type BrassParams = typeof defaults;

export const brass: VoiceModule<BrassParams> = {
  doc: "Brass section: detuned saw per side over an octave-down square, scoop, breath spit, drive, velocity filter blat.",
  defaults,
  ranges: {
    detune: [0, 40], spread: [0, 1], low: [0, 1], scoop: [-12, 12], scoopTime: [0.005, 0.3], cutoff: [100, 8000], env: [0, 8000], envDecay: [0.02, 2],
    q: [0.3, 8], spit: [0, 1], drive: [0, 4], a: [0.001, 1], d: [0.01, 3], s: [0, 1], r: [0.02, 3], gain: [0, 2],
  },
  play(h, n, p) {
    const { ctx } = h;
    const sources: Source[] = [];
    const keep: AudioNode[] = [];
    const peak = 0.12 * p.gain * (0.45 + 0.55 * n.vel);
    const glideOpts = { scoop: p.scoop, scoopTime: p.scoopTime, glide: 0.06 };
    // The middle: the low brass (a square an octave down) and the breath spit, fed to both sides.
    const middle: AudioNode[] = [];
    if (p.low > 0) {
      const o = noteOsc(ctx, n, 0.5, { wave: h.wave("pulse", (n.seed + 2) % 16, 0.5), ...glideOpts });
      const g = gainNode(ctx, p.low);
      o.connect(g);
      sources.push(o);
      keep.push(g);
      middle.push(g);
    }
    if (p.spit > 0) {
      const src = ctx.createBufferSource();
      src.buffer = h.noise();
      const g = gainNode(ctx, 0);
      g.gain.setValueAtTime(p.spit * 0.8, n.time);
      g.gain.exponentialRampToValueAtTime(0.0001, n.time + 0.05);
      g.gain.setValueAtTime(0, n.time + 0.055);
      src.connect(g);
      sources.push(src);
      keep.push(g);
      middle.push(g);
    }
    const mid = sumAll(ctx, middle, keep);
    const open = p.cutoff + p.env * n.vel * n.vel;
    const at = Math.max(0.008, p.a * 1.5);
    let end = n.time;
    for (const side of [-1, 1]) {
      const o = noteOsc(ctx, n, 1, { wave: h.wave("saw", (n.seed + (side > 0 ? 9 : 0)) % 16), detune: side * p.detune, ...glideOpts });
      const g = gainNode(ctx, 0.75);
      o.connect(g);
      sources.push(o);
      keep.push(g);
      let chain: AudioNode = g;
      if (mid) {
        const both = gainNode(ctx, 1);
        g.connect(both);
        mid.connect(both);
        keep.push(both);
        chain = both;
      }
      if (p.drive > 0) {
        const sh = shaper(ctx, satCurve(p.drive, 0.15));
        chain.connect(sh);
        keep.push(sh);
        chain = sh;
      }
      // The blat: the lowpass opens with the attack, as far as the velocity says, and falls back.
      const lp = biquad(ctx, "lowpass", p.cutoff, p.q);
      lp.frequency.setValueAtTime(p.cutoff, n.time);
      lp.frequency.linearRampToValueAtTime(open, n.time + at);
      lp.frequency.exponentialRampToValueAtTime(Math.max(100, p.cutoff * 1.2), n.time + at + p.envDecay);
      const amp = gainNode(ctx, 0);
      end = adsr(amp.gain, n.time, peak, p.a, p.d, p.s, n.length, p.r);
      chain.connect(lp);
      lp.connect(amp);
      keep.push(lp, amp, ...h.out(amp, n.pan + side * p.spread));
    }
    h.play(sources, keep, n.time, end + 0.05);
  },
};
