import type { Source, VoiceModule } from "../types.ts";
import { adsr, biquad, gainNode, lfo, noteOsc, satCurve, shaper, sumAll } from "../util.ts";

/**
 * Formant voice: a buzz (saw + pulse, 1..4 unison voices per side, detuned) and a breath noise through a bank of four
 * parallel bandpass formants (F1..F4 at their own bandwidths and levels) per side. The vowel morphs from `vowelA` to
 * `vowelB` over `morph` s (0 a, 1 e, 2 i, 3 o, 4 u; fractions blend): with one voice and a glide that is a talk box
 * ("wah-ooh" over a synth line, Roger Troutman / DJ Quik); with four detuned voices, a slow vowel and a delayed vibrato
 * it is a choir ("aah" into "ooh"). `shift` scales the formants (above 1 a smaller, younger throat).
 */
const defaults = {
  vowelA: 0,
  vowelB: 3,
  morph: 0.3,
  voices: 1,
  detune: 8,
  spread: 0.4,
  pulse: 0.4,
  breath: 0.05,
  shift: 1,
  q: 1,
  vib: 14,
  vibRate: 5.4,
  vibDelay: 0.25,
  glide: 0.07,
  scoop: -1,
  drive: 1.2,
  a: 0.02,
  d: 0.3,
  s: 0.8,
  r: 0.15,
  gain: 1,
};
export type VoxParams = typeof defaults;

/** Formants (Hz) and levels of the five vowels a e i o u (adult male, after Peterson & Barney). */
const VOWELS: readonly (readonly [number, number][])[] = [
  [[730, 1], [1090, 0.5], [2440, 0.28], [3400, 0.12]],
  [[530, 1], [1840, 0.4], [2480, 0.3], [3500, 0.12]],
  [[300, 1], [2290, 0.22], [3010, 0.25], [3600, 0.1]],
  [[570, 1], [840, 0.55], [2410, 0.16], [3400, 0.08]],
  [[320, 1], [870, 0.32], [2240, 0.1], [3300, 0.05]],
];
const BW = [80, 95, 120, 140];

function vowel(x: number): [number, number][] {
  const v = Math.max(0, Math.min(4, x));
  const i = Math.min(3, Math.floor(v));
  const t = v - i;
  return VOWELS[i].map(([f, g], k) => [f + (VOWELS[i + 1][k][0] - f) * t, g + (VOWELS[i + 1][k][1] - g) * t]);
}

export const vox: VoiceModule<VoxParams> = {
  doc: "Formant voice: saw+pulse buzz (1..4 unison/side) + breath through 4 parallel formants per side, vowel morph A->B.",
  defaults,
  ranges: {
    vowelA: [0, 4], vowelB: [0, 4], morph: [0.01, 4], voices: [1, 4], detune: [0, 40], spread: [0, 1], pulse: [0, 1.5], breath: [0, 1], shift: [0.6, 1.6],
    q: [0.3, 3], vib: [0, 60], vibRate: [0.5, 9], vibDelay: [0, 2], glide: [0, 0.4], scoop: [-12, 12], drive: [0, 4], a: [0.001, 4], d: [0.01, 4],
    s: [0, 1], r: [0.02, 4], gain: [0, 2],
  },
  play(h, n, p) {
    const { ctx } = h;
    const sources: Source[] = [];
    const keep: AudioNode[] = [];
    const count = Math.round(p.voices);
    const vibHz = n.freq * (Math.pow(2, p.vib / 1200) - 1);
    const vib = p.vib > 0 ? lfo(ctx, h.wave("sine", n.seed % 16), p.vibRate, vibHz, n.time, sources, keep, p.vibDelay) : null;
    const from = vowel(p.vowelA);
    const to = vowel(p.vowelB);
    const peak = 0.16 * p.gain * (0.5 + 0.5 * n.vel) / Math.sqrt(count);
    let end = n.time;
    const sides = count > 1 || p.spread > 0 ? [-1, 1] : [0];
    for (const side of sides) {
      const parts: AudioNode[] = [];
      for (let i = 0; i < count; i++) {
        const x = count > 1 ? (i / (count - 1)) * 2 - 1 : 0;
        const det = x * p.detune + side * (p.detune / 4);
        for (const [kind, level] of [["saw", 1], ["pulse", p.pulse]] as const) {
          if (level <= 0) continue;
          const o = noteOsc(ctx, n, 1, { wave: h.wave(kind, (n.seed + i * 3 + (side > 0 ? 8 : 0) + (kind === "pulse" ? 5 : 0)) % 16, 0.22), detune: det, glide: p.glide, scoop: p.scoop, scoopTime: 0.06 });
          vib?.connect(o.frequency);
          const g = gainNode(ctx, level);
          o.connect(g);
          sources.push(o);
          keep.push(g);
          parts.push(g);
        }
      }
      if (p.breath > 0) {
        const src = ctx.createBufferSource();
        src.buffer = h.noise();
        src.loop = true;
        const g = gainNode(ctx, p.breath * 2);
        src.connect(g);
        sources.push(src);
        keep.push(g);
        parts.push(g);
      }
      let buzz = sumAll(ctx, parts, keep);
      if (!buzz) continue;
      if (p.drive > 0) {
        const sh = shaper(ctx, satCurve(p.drive));
        buzz.connect(sh);
        keep.push(sh);
        buzz = sh;
      }
      const bank: AudioNode[] = [];
      for (let k = 0; k < 4; k++) {
        const f0 = from[k][0] * p.shift;
        const f1 = to[k][0] * p.shift;
        const bp = biquad(ctx, "bandpass", f0, (f0 / BW[k]) * p.q);
        bp.frequency.setValueAtTime(f0, n.time);
        bp.frequency.linearRampToValueAtTime(f1, n.time + p.morph);
        const g = gainNode(ctx, 0);
        g.gain.setValueAtTime(from[k][1], n.time);
        g.gain.linearRampToValueAtTime(to[k][1], n.time + p.morph);
        buzz.connect(bp);
        bp.connect(g);
        keep.push(bp, g);
        bank.push(g);
      }
      const formed = sumAll(ctx, bank, keep);
      if (!formed) continue;
      const amp = gainNode(ctx, 0);
      end = adsr(amp.gain, n.time, peak * 3, p.a, p.d, p.s, n.length, p.r);
      formed.connect(amp);
      const hp = biquad(ctx, "highpass", 150, 0.6);
      amp.connect(hp);
      keep.push(amp, hp, ...h.out(hp, n.pan + side * p.spread));
    }
    h.play(sources, keep, n.time, end + 0.05);
  },
};
