import type { Source, VoiceModule } from "../types.ts";
import { adsr, gainNode, lfo, noteOsc, satCurve, shaper } from "../util.ts";

/**
 * FM electric piano after the DX7's E.PIANO 1, in two operator pairs: the body (a carrier at the note, its modulator
 * at `ratio` with an index that falls from a velocity-scaled peak to `floor`) and the tine (a quiet carrier whose
 * modulator at `tineRatio` (14) barks for a few tens of ms: the metallic attack); the body's modulator runs `detune`
 * cents off its ratio (a slow beating inside the note). The piano is then auto-panned left and right of
 * its place by one LFO in opposite phase (the Suitcase's stereo tremolo). Tape wow bends it, a soft drive warms the
 * tine; the brightness is the modulation index (velocity, `lp`, the song form), no filter. Rhodes, Wurli, keys.
 */
const defaults = {
  ratio: 1,
  index: 1.8,
  indexDecay: 0.6,
  floor: 0.12,
  tine: 0.35,
  tineRatio: 14,
  tineIndex: 2.5,
  tineDecay: 0.05,
  detune: 5,
  spread: 0.5,
  trem: 0.25,
  tremRate: 4.2,
  wow: 0,
  wowRate: 0.5,
  lp: 3800,
  bright: 0.3,
  drive: 1.2,
  a: 0.002,
  d: 1.6,
  s: 0.25,
  r: 0.35,
  gain: 1,
};
export type FmKeysParams = typeof defaults;

export const fmKeys: VoiceModule<FmKeysParams> = {
  doc: "Two-pair FM e-piano (body + 14:1 tine bark through a drive), index as brightness, auto-pan tremolo, tape wow.",
  defaults,
  ranges: {
    ratio: [0.5, 4], index: [0, 8], indexDecay: [0.02, 4], floor: [0, 1], tine: [0, 1.5], tineRatio: [2, 20], tineIndex: [0, 10], tineDecay: [0.005, 0.5],
    detune: [0, 30], spread: [0, 1], trem: [0, 1], tremRate: [0.3, 10], wow: [0, 40], wowRate: [0.1, 6], lp: [300, 14000], bright: [0, 0.9],
    drive: [0, 4], a: [0.001, 1], d: [0.05, 6], s: [0, 1], r: [0.02, 3], gain: [0, 2],
  },
  play(h, n, p) {
    const { ctx } = h;
    const sources: Source[] = [];
    const keep: AudioNode[] = [];
    const f = n.freq;
    const vel = 0.4 + 0.6 * n.vel;
    // Brightness is the modulation index (no filter): velocity, `lp` (re 3800 Hz) and the song form scale it.
    const tone = Math.max(0.15, (p.lp / 3800) * (1 + p.bright * (n.bright * 2 - 1)));
    const mod = noteOsc(ctx, n, p.ratio, { type: "sine", detune: p.detune });
    const idx = gainNode(ctx, 0);
    idx.gain.setValueAtTime(f * p.index * vel * tone, n.time);
    idx.gain.exponentialRampToValueAtTime(Math.max(0.01, f * p.index * vel * tone * p.floor), n.time + p.indexDecay);
    mod.connect(idx);
    const wow = p.wow > 0 ? lfo(ctx, h.wave("sine", n.seed % 16), p.wowRate, p.wow, n.time, sources, keep) : null;
    const car = noteOsc(ctx, n, 1, { type: "sine" });
    idx.connect(car.frequency);
    wow?.connect(car.detune);
    const peak = 0.11 * p.gain * vel;
    const amp = gainNode(ctx, 0);
    const end = adsr(amp.gain, n.time, peak, p.a, p.d, p.s, n.length, p.r);
    car.connect(amp);
    sources.push(mod, car);
    keep.push(idx, amp);
    let body: AudioNode = amp;
    if (p.tine > 0) {
      // The tine: a quiet carrier whose 14:1 modulator barks for a few tens of ms, through a warm drive.
      const tm = noteOsc(ctx, n, p.tineRatio, { type: "sine" });
      const ti = gainNode(ctx, 0);
      ti.gain.setValueAtTime(f * p.tineIndex * vel * tone, n.time);
      ti.gain.exponentialRampToValueAtTime(Math.max(0.01, f * p.tineIndex * vel * tone * 0.02), n.time + p.tineDecay);
      tm.connect(ti);
      const tc = noteOsc(ctx, n, 1, { type: "sine" });
      ti.connect(tc.frequency);
      const ta = gainNode(ctx, 0);
      adsr(ta.gain, n.time, peak * p.tine * vel, 0.001, Math.min(p.d, 0.5), 0.05, Math.min(n.length, 0.5), Math.min(p.r, 0.25));
      tc.connect(ta);
      let tine: AudioNode = ta;
      if (p.drive > 0) {
        const sh = shaper(ctx, satCurve(p.drive, 0.2));
        ta.connect(sh);
        keep.push(sh);
        tine = sh;
      }
      const both = gainNode(ctx, 1);
      amp.connect(both);
      tine.connect(both);
      sources.push(tm, tc);
      keep.push(ti, ta, both);
      body = both;
    }
    // The Suitcase's auto-pan: the mono piano panned left and right of its place by one LFO in opposite phase.
    const trem = p.trem > 0 ? lfo(ctx, h.wave("sine", (n.seed + 4) % 16), p.tremRate, p.trem / 2, n.time, sources, keep) : null;
    let inv: GainNode | null = null;
    if (trem) {
      inv = gainNode(ctx, -1);
      trem.connect(inv);
      keep.push(inv);
    }
    for (const side of [-1, 1]) {
      const g = gainNode(ctx, 1 - p.trem / 2);
      (side < 0 ? trem : inv)?.connect(g.gain);
      body.connect(g);
      keep.push(g, ...h.out(g, n.pan + side * p.spread));
    }
    h.play(sources, keep, n.time, end + 0.05);
  },
};
