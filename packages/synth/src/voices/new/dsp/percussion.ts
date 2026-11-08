import { alloc, clamp, finish, ModalBank, mode, pulse, rng, sat, svf, type NoteEvent, type Params, type Rendered } from "./core.ts";

// Bright, round percussion for the 2-6 kHz gap (Rally House): every tail goes through resonant band-passes and a
// closing lowpass, so it rings as a short tone, never as a hissy noise tail ("усатый" snares and claps are banned).

/** `p.tone` is the preset's pitch at `p.ref` (MIDI); other notes transpose it (tuned percussion follows the chord). */
const tuneOf = (ev: NoteEvent, p: Params) => (p.ref ? ev.freq / (440 * Math.pow(2, (p.ref - 69) / 12)) : 1);

/**
 * Round clap: 3-5 hand bursts a few ms apart (each its own place in the stereo field), every burst and the short tail
 * through three resonant band-passes (body ~1.2 kHz, snap ~2.1 kHz, air ~3.6 kHz) and a closing lowpass, plus a
 * round low tone under it. The tail is a ringing tone, 40 dB down after `decay` (110 ms), not noise.
 */
export function roundClap(ev: NoteEvent, p: Params, sr: number): Rendered {
  const rand = rng(ev.seed);
  const v = clamp(ev.vel, 0, 1.2);
  const bursts = clamp(Math.round(p.bursts ?? 4), 1, 6);
  const spread = p.spread ?? 0.0085;
  const decay = (p.decay ?? 0.11) * (0.9 + 0.2 * rand());
  const tone = (p.tone ?? 1250) * tuneOf(ev, p) * Math.pow(2, 0.25 * (v - 0.8));
  const width = p.width ?? 0.35;
  const out = alloc(spread * bursts + decay * 2 + 0.06, sr, true);
  const { L } = out;
  const R = out.R!;
  // Burst onsets and their pans.
  const at: number[] = [];
  const amp: number[] = [];
  const gl: number[] = [];
  const gr: number[] = [];
  let t = 0;
  for (let k = 0; k < bursts; k++) {
    at.push(Math.round(t * sr));
    amp.push((0.65 + 0.35 * rand()) * (k === bursts - 1 ? 1 : 0.8));
    const pan = clamp(ev.pan + width * (rand() * 2 - 1), -1, 1);
    gl.push(Math.cos(((pan + 1) * Math.PI) / 4));
    gr.push(Math.sin(((pan + 1) * Math.PI) / 4));
    t += spread * (0.75 + 0.5 * rand());
  }
  const bdN = (p.burstDecay ?? 0.0028) * sr;
  const tlN = (decay * sr) / 4.6;
  const atkN = 0.0004 * sr;
  const mk = () => [svf(sr, tone * 0.85, 2.2), svf(sr, tone * 1.7, 3), svf(sr, tone * 2.9, 3.5), svf(sr, p.lp ?? 7000, 0.6)];
  const fl = mk();
  const fr = mk();
  const snap = p.snap ?? 0.55;
  const air = p.air ?? 0.25;
  const body = mode(sr, (p.bodyFreq ?? 230) * tuneOf(ev, p), p.bodyDecay ?? 0.06);
  const bodyHit = pulse(0.0015 * sr, 1);
  const bodyLevel = (p.body ?? 0.35) * 0.5;
  const g = (p.level ?? 1) * 0.9 * Math.pow(v, 1.2);
  for (let i = 0; i < L.length; i++) {
    let el = 0;
    let er = 0;
    for (let k = 0; k < bursts; k++) {
      const x = i - at[k];
      if (x < 0) continue;
      const e = amp[k] * Math.min(1, x / atkN) * Math.exp(-x / (k === bursts - 1 ? tlN : bdN));
      el += e * gl[k];
      er += e * gr[k];
    }
    const n = rand() * 2 - 1;
    const filt = (f: typeof fl, x: number) => {
      f[0].run(x);
      f[1].run(x);
      f[2].run(x);
      const y = f[0].bp + snap * 1.2 * f[1].bp + air * 1.3 * f[2].bp;
      return f[3].run(y);
    };
    const b = body.drive(bodyHit(i - at[0])) * bodyLevel;
    L[i] = (filt(fl, n * el) * 1.6 + b) * g;
    R[i] = (filt(fr, n * er) * 1.6 + b) * g;
  }
  return finish(out);
}

/**
 * Rim / stick crack: a stick hitting a wooden rim. A hard 0.35 ms strike drives five short modes (a low wood mode, the
 * crack at `tone`, three partials above it that die in 10-30 ms: a woody knock, never a ring) and a 2.5 ms click
 * band-passed at ~4 kHz. `wood` 0 = a brighter rimshot, 1 = a sidestick / woodblock-like knock.
 */
export function rim(ev: NoteEvent, p: Params, sr: number): Rendered {
  const rand = rng(ev.seed);
  const v = clamp(ev.vel, 0, 1.2);
  const tone = (p.tone ?? 1650) * tuneOf(ev, p) * (0.99 + 0.02 * rand());
  const decay = p.decay ?? 0.045;
  const wood = clamp(p.wood ?? 0.5, 0, 1);
  const rows: [number, number, number][] = [
    [0.33, p.body ?? 0.5, decay * 1.6],
    [1, 1, decay],
    [1.47, 0.55 * (1 - 0.5 * wood), decay * 0.7],
    [2.09, 0.35 * (1 - 0.6 * wood), decay * 0.45],
    [2.72, 0.2 * (1 - wood), decay * 0.3],
  ];
  const bank = new ModalBank(sr);
  for (const [ra, a, t] of rows) if (tone * ra < sr * 0.45) bank.add(tone * ra, t, a);
  const out = alloc(decay * 8 + 0.03, sr, false);
  const { L } = out;
  const hit = pulse(0.00035 * sr * (1.3 - 0.4 * Math.min(1, v)), 1);
  const click = svf(sr, 4200, 1.2);
  const clickN = 0.0025 * sr;
  const clickLevel = (p.click ?? 0.6) * 0.8;
  const lp = svf(sr, p.lp ?? 8000, 0.6);
  const g = (p.level ?? 1) * 0.6 * Math.pow(v, 1.15);
  for (let i = 0; i < L.length; i++) {
    let y = bank.tick(hit(i));
    if (i < clickN * 4) {
      click.run((rand() * 2 - 1) * Math.exp(-i / clickN));
      y += click.bp * clickLevel;
    }
    L[i] = lp.run(y) * g;
  }
  return finish(out);
}

/**
 * Hand percussion, a modal model. `kind` 0, a membrane (conga, bongo, low tom): the circular-membrane modes
 * (x 1, 1.59, 2.14, 2.30, 2.65, 2.92, 3.16), a hand strike whose contact time sets the brightness, the pitch falling
 * from `bend` above as the head relaxes (tension modulation), `edge` exciting the upper modes, `slap` a cupped crack,
 * `mute` a hand left on the head. `kind` 1, a wooden bar / block (woodblock, log drum): modes x 1, 2.57, 4.25, short.
 * The fundamental is the note: tuned percussion plays chord tones.
 */
export function handDrum(ev: NoteEvent, p: Params, sr: number): Rendered {
  const rand = rng(ev.seed);
  const v = clamp(ev.vel, 0, 1.2);
  const f = ev.freq * (0.997 + 0.006 * rand());
  const wood = (p.kind ?? 0) >= 0.5;
  const decay = (p.decay ?? 0.35) * (0.9 + 0.2 * rand());
  const mute = clamp(p.mute ?? 0, 0, 1);
  const edge = clamp(p.edge ?? 0.4, 0, 1);
  const rows: [number, number, number][] = wood
    ? [[1, 1, 1], [2.57, 0.45 + 0.3 * edge, 0.45], [4.25, 0.2 + 0.2 * edge, 0.25], [6.1, 0.08 * edge, 0.15]]
    : [[1, 1, 1], [1.59, 0.35 + 0.5 * edge, 0.55], [2.14, 0.2 + 0.35 * edge, 0.4], [2.3, 0.15 + 0.3 * edge, 0.35], [2.65, 0.1 + 0.25 * edge, 0.3], [2.92, 0.06 + 0.2 * edge, 0.25], [3.16, 0.05 + 0.15 * edge, 0.2]];
  const damp = 1 - 0.85 * mute;
  const bank = new ModalBank(sr);
  for (const [ra, a, t] of rows) if (f * ra < sr * 0.45) bank.add(f * ra, decay * t * damp, a);
  const out = alloc(decay * damp * 7 + 0.05, sr, false);
  const { L } = out;
  // Contact: a palm (3-5 ms) is dark, fingertips / a stick (0.4-1 ms) bright; harder = shorter.
  const contact = (p.contact ?? 3) * 0.001 * sr * (1.25 - 0.45 * Math.min(1, v));
  const hit = pulse(contact, 1);
  const bend = (p.bend ?? 0.05) * Math.min(1, v);
  const bendN = (p.bendTime ?? 0.03) * sr;
  const slap = (p.slap ?? 0) * 0.9;
  const crack = svf(sr, 2800 * (0.95 + 0.1 * rand()), 1.5);
  const skin = svf(sr, 1200, 0.7);
  const skinLevel = (p.skin ?? 0.15) * 0.7;
  const lp = svf(sr, p.lp ?? 9000, 0.6);
  const g = (p.level ?? 1) * 0.55 * Math.pow(v, 1.1);
  for (let i = 0; i < L.length; i++) {
    if (bend > 0 && (i & 15) === 0 && i < 8 * bendN) {
      bank.retune(1 + bend * Math.exp(-i / bendN));
    }
    let y = bank.tick(hit(i));
    if (i < 0.03 * sr) {
      const n = rand() * 2 - 1;
      if (slap > 0) {
        crack.run(n * Math.exp(-i / (0.006 * sr)));
        y += crack.bp * slap;
      }
      skin.run(n * Math.exp(-i / (0.004 * sr)));
      y += skin.lp * skinLevel;
    }
    L[i] = lp.run(y) * g;
  }
  return finish(out);
}

/**
 * Shaker, a particle model (after Perry Cook's PhISEM): the shake's energy (a gesture `hold` s long, peaking early or
 * late with `shape`) makes seeds collide at random; each collision is a tiny decaying noise grain, panned on its own;
 * the grains sound through two resonances of the shell (`tone`, `tone2`) and a closing lowpass. Sparse grains read as a
 * shaker, not as hiss.
 */
export function shaker(ev: NoteEvent, p: Params, sr: number): Rendered {
  const rand = rng(ev.seed);
  const v = clamp(ev.vel, 0, 1.2);
  const T = Math.max(0.03, ev.hold);
  const shape = clamp(p.shape ?? 0.6, 0.05, 0.95);
  const skew = Math.log(0.5) / Math.log(shape);
  const out = alloc(T + 0.08, sr, true);
  const { L } = out;
  const R = out.R!;
  const prob = clamp(p.density ?? 0.5, 0, 1) / (0.0016 * sr);
  const gco = Math.exp(-1 / (Math.max(0.0002, p.grain ?? 0.0011) * sr));
  const tone = (p.tone ?? 3400) * tuneOf(ev, p);
  const mk = () => [svf(sr, tone, p.q ?? 2.4), svf(sr, (p.tone2 ?? 5600) * tuneOf(ev, p), 3), svf(sr, p.lp ?? 9000, 0.6)];
  const fl = mk();
  const fr = mk();
  const width = p.width ?? 0.4;
  const mix2 = p.mix2 ?? 0.55;
  let al = 0;
  let ar = 0;
  const Tn = T * sr;
  const g = (p.level ?? 1) * 2.4 * Math.pow(v, 1.3);
  for (let i = 0; i < L.length; i++) {
    const x = i / Tn;
    const e = x < 1 ? Math.pow(Math.sin(Math.PI * Math.pow(x, skew)), 2) : 0;
    if (e > 0 && rand() < prob * e) {
      const a = (0.4 + 0.6 * rand()) * e;
      const pan = clamp(ev.pan + width * (rand() * 2 - 1), -1, 1);
      al += a * Math.cos(((pan + 1) * Math.PI) / 4);
      ar += a * Math.sin(((pan + 1) * Math.PI) / 4);
    }
    al *= gco;
    ar *= gco;
    const n = rand() * 2 - 1;
    const run = (f: typeof fl, s: number) => {
      f[0].run(s);
      f[1].run(s);
      return f[2].run(f[0].bp + mix2 * f[1].bp);
    };
    L[i] = sat(run(fl, n * al) * g);
    R[i] = sat(run(fr, n * ar) * g);
  }
  return finish(out);
}
