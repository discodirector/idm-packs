import type { Source, VoiceModule } from "../types.ts";
import { biquad, gainNode, noteOsc, satCurve, shaper, sumAll } from "../util.ts";

/**
 * Layered bass in three bands with distinct jobs, all on one pitch line (punch, glide) and one amp shape:
 * - sub: a clean sine (the weight under 100 Hz, kept clean so it stays mono and solid);
 * - growl: a saw / triangle blend pushed hard through a tanh (the harmonics a phone speaker hears: the distorted
 *   808 of trap and drill, a Minimoog bass's bite), highpassed off the sub and lowpassed with its own envelope and
 *   resonance (`env` > 0 and a high `q` make it the G-funk Moog bass's "bow");
 * - top: a short noise click (the attack that tells the beat where the note starts).
 * `growlAttack` fades the growl in after the sub's attack: the harmonics swell instead of clicking, so an 808 that
 * moves off the kick (drill slides) never reads as an extra drum hit.
 * The 808 shape: an exponential fall of `decay` s held to the note's end (a short decay is a plucked bass, a long one
 * the held 808), a pitch punch falling from `punch` x over `punchTime`, glides of `glide` s from the last note.
 */
const defaults = {
  sub: 1,
  growl: 0.45,
  saw: 0.5,
  drive: 3,
  growlHp: 110,
  growlLp: 1100,
  env: 0,
  envTime: 0.15,
  q: 0.8,
  top: 0.12,
  growlAttack: 0,
  punch: 1.6,
  punchTime: 0.03,
  glide: 0.1,
  decay: 1.2,
  gain: 1,
};
export type BassStackParams = typeof defaults;

export const bassStack: VoiceModule<BassStackParams> = {
  doc: "Layered bass: clean sub sine + driven saw/triangle growl (hp, enveloped resonant lp) + click top; 808 punch, fall, glide.",
  defaults,
  ranges: {
    sub: [0, 2], growl: [0, 2], saw: [0, 1], drive: [0, 6], growlHp: [40, 600], growlLp: [150, 6000], env: [0, 6000], envTime: [0.02, 1], q: [0.3, 10],
    top: [0, 1], growlAttack: [0, 0.15], punch: [1, 4], punchTime: [0.005, 0.15], glide: [0.02, 0.4], decay: [0.05, 4], gain: [0, 2],
  },
  play(h, n, p) {
    const { ctx } = h;
    const sources: Source[] = [];
    const keep: AudioNode[] = [];
    const time = n.time;
    const end = time + Math.max(0.06, n.length);
    const pitch = (o: OscillatorNode, mult: number) => {
      const f = n.freq * mult;
      if (n.from) {
        o.frequency.setValueAtTime(n.from * mult, time);
        o.frequency.exponentialRampToValueAtTime(f, time + p.glide);
      } else if (p.punch > 1) {
        o.frequency.setValueAtTime(f * p.punch, time);
        o.frequency.exponentialRampToValueAtTime(f, time + p.punchTime);
      } else o.frequency.setValueAtTime(f, time);
    };
    // One amp shape for every band: attack, the 808 fall, cut at the end (mono by composition: notes do not overlap).
    const shape = (g: AudioParam, peak: number, slow = 0) => {
      const attack = Math.max(n.from ? 0.012 : 0.003, slow);
      const cut = Math.max(time + attack + 0.005, end - 0.025);
      g.setValueAtTime(0, time);
      g.linearRampToValueAtTime(peak, time + attack);
      g.exponentialRampToValueAtTime(Math.max(0.0001, peak * Math.exp(-(cut - time - attack) / p.decay)), cut);
      g.linearRampToValueAtTime(0, end);
    };
    const peak = 0.22 * p.gain * (0.5 + 0.5 * n.vel) * (n.from ? 0.9 : 1);
    const bands: AudioNode[] = [];
    if (p.sub > 0) {
      const o = ctx.createOscillator();
      o.type = "sine";
      pitch(o, 1);
      const lp = biquad(ctx, "lowpass", 260, 0.5);
      const amp = gainNode(ctx, 0);
      shape(amp.gain, peak * p.sub);
      o.connect(lp);
      lp.connect(amp);
      sources.push(o);
      keep.push(lp, amp);
      bands.push(amp);
    }
    if (p.growl > 0) {
      const parts: AudioNode[] = [];
      for (const [wave, level] of [["saw", p.saw], ["tri", 1 - p.saw]] as const) {
        if (level <= 0) continue;
        const o = ctx.createOscillator();
        if (wave === "saw") o.setPeriodicWave(h.wave("saw", n.seed % 16));
        else o.type = "triangle";
        pitch(o, 1);
        const g = gainNode(ctx, level);
        o.connect(g);
        sources.push(o);
        keep.push(g);
        parts.push(g);
      }
      const mix = sumAll(ctx, parts, keep);
      if (mix) {
        const pre = gainNode(ctx, 0);
        shape(pre.gain, 1, p.growlAttack);
        const sh = shaper(ctx, satCurve(p.drive, 0.08));
        const hp = biquad(ctx, "highpass", p.growlHp, 0.7);
        const lp = biquad(ctx, "lowpass", p.growlLp, p.q);
        if (p.env > 0) {
          lp.frequency.setValueAtTime(p.growlLp + p.env * (0.5 + 0.5 * n.vel), time);
          lp.frequency.exponentialRampToValueAtTime(p.growlLp, time + p.envTime);
        }
        const amp = gainNode(ctx, peak * p.growl * 0.6);
        mix.connect(pre);
        pre.connect(sh);
        sh.connect(hp);
        hp.connect(lp);
        lp.connect(amp);
        keep.push(pre, sh, hp, lp, amp);
        bands.push(amp);
      }
    }
    if (p.top > 0 && !n.from) {
      const src = ctx.createBufferSource();
      src.buffer = h.noise();
      const hp = biquad(ctx, "bandpass", 2600, 0.8);
      const g = gainNode(ctx, 0);
      g.gain.setValueAtTime(peak * p.top, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.018);
      g.gain.setValueAtTime(0, time + 0.02);
      src.connect(hp);
      hp.connect(g);
      sources.push(src);
      keep.push(hp, g);
      bands.push(g);
    }
    const out = sumAll(ctx, bands, keep);
    if (!out) return;
    keep.push(...h.out(out, 0));
    h.play(sources, keep, time, end + 0.05);
  },
};
