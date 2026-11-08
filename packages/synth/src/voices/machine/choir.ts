/**
 * Formant choir: the vocoder "robot voice" of Kraftwerk, Rother and Dopplereffekt (a VP-330 / Orville choir) without
 * a voice to analyse. A carrier per chord tone (a bright saw, a breath of noise under it) runs through a bank of four
 * resonant bandpasses at a vowel's formants (F1, F2, F3 and a fixed presence band); the bank moves from vowel to vowel
 * over the note, so the chord "sings" a word. Two banks, left and right, on carriers a few cents apart; an optional
 * ring modulator makes it metallic.
 */
import type { VoiceBus, VoiceHost } from "./host.ts";
import { adsr, biquad, gainNode, hz, noiseSrc, osc, run } from "./util.ts";

/** A vowel's first three formants, Hz ("ah" [730, 1090, 2440], "ee" [270, 2290, 3010], "oo" [300, 870, 2240]). */
export type Vowel = readonly [number, number, number];

export interface ChoirSpec {
  /** Detune of the two sides, cents 0..20. */
  detune: number;
  /** Stereo spread of the two banks 0..1. */
  width: number;
  /** Formant resonance (F1's Q; the higher bands sharper). */
  q: number;
  /** Noise breath under the carrier 0..1. */
  breath: number;
  /** Ring modulation at this ratio of the root (0: none). */
  ring?: number;
  attack: number;
  release: number;
  level: number;
}

const BAND_GAIN = [1, 0.75, 0.42, 0.22];

export function choir(h: VoiceHost, t: number, midis: readonly number[], length: number, level: number, vowels: readonly Vowel[], s: ChoirSpec, bus: VoiceBus) {
  const ctx = h.ctx;
  const rest: AudioNode[] = [];
  const sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  const end = t + length + s.release;
  const vs = vowels.length ? vowels : [[730, 1090, 2440] as Vowel];
  for (let side = 0; side < 2; side++) {
    let head: AudioNode | null = null;
    midis.forEach((m, k) => {
      const o = osc(ctx, "saw", hz(m), t, (side === 0 ? -1 : 1) * s.detune, (side * 4 + k * 3) / 8);
      const g = gainNode(ctx, 0.6 / Math.sqrt(midis.length));
      o.connect(g);
      rest.push(g);
      head = h.sum(head, g, rest);
      sources.push(o);
    });
    if (s.breath > 0) {
      const n = noiseSrc(h);
      const g = gainNode(ctx, 0.25 * s.breath);
      n.connect(g);
      rest.push(g);
      head = h.sum(head, g, rest);
      sources.push(n);
    }
    let src = head as unknown as AudioNode;
    if (s.ring) {
      const rm = osc(ctx, "sine", hz(midis[0]) * s.ring, t);
      const ring = ctx.createGain();
      ring.gain.value = 0;
      rm.connect(ring.gain);
      src.connect(ring);
      sources.push(rm);
      rest.push(ring);
      const dry = gainNode(ctx, 0.5);
      src.connect(dry);
      rest.push(dry);
      src = h.sum(ring, dry, rest);
    }
    let bank: AudioNode | null = null;
    for (let b = 0; b < 4; b++) {
      const bp = biquad(ctx, "bandpass", b < 3 ? vs[0][b] : 3400, s.q * (1 + 0.35 * b), t);
      if (b < 3) {
        vs.forEach((v, i) => {
          if (i === 0) return;
          const at = t + (length * i) / Math.max(1, vs.length - 1);
          // Hold each vowel, then move to the next in the last fifth of its span (a sung syllable, not a sweep).
          bp.frequency.setValueAtTime(vs[i - 1][b], at - (length / Math.max(1, vs.length - 1)) * 0.2);
          bp.frequency.linearRampToValueAtTime(v[b], at);
        });
      }
      const g = gainNode(ctx, BAND_GAIN[b] * (2 + s.q * 0.25));
      src.connect(bp);
      bp.connect(g);
      rest.push(bp, g);
      bank = h.sum(bank, g, rest);
    }
    const amp = ctx.createGain();
    adsr(amp.gain, t, s.level * level, s.attack, 0.15, 0.85, length, s.release);
    (bank as unknown as AudioNode).connect(amp);
    rest.push(amp);
    rest.push(...h.out(amp, bus, (side === 0 ? -1 : 1) * s.width));
  }
  run(h, sources, rest, t, end + 0.05);
}
