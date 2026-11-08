import { alloc, cents, clamp, dcBlock, finish, mode, ModalBank, panGains, pulse, rng, sat, svf, wanderer, type NoteEvent, type Params, type Rendered } from "./core.ts";

/**
 * Wurlitzer (200A-style), a physical model: a felt hammer (contact 2.2 ms soft .. 0.6 ms hard, shorter on high keys)
 * strikes a steel reed (a cantilever: its fundamental plus the bending modes x 6.27 and x 17.55, gone in tens of ms),
 * heard through the electrostatic pickup: the reed is one plate of a capacitor, so the output is x / (1 - k x), an
 * asymmetric curve that adds the 2nd and 3rd harmonics as the reed swings further. The harder the note, the more the
 * Wurli barks, from the pickup, not from a filter. Then the small amp and speaker (a soft clip, a ~1 kHz bump, a
 * closing lowpass). Shorter sustain and a more nasal, reedy-sweet colour than the Rhodes. `trem` the vibrato knob
 * (0 by default: no tremolo chords).
 */
export function wurli(ev: NoteEvent, p: Params, sr: number): Rendered {
  const rand = rng(ev.seed);
  const v = clamp(ev.vel, 0, 1.2);
  const f = ev.freq * cents((rand() - 0.5) * (p.drift ?? 3));
  const keyScale = Math.pow(261.63 / f, 0.5);
  const T1 = (p.decay ?? 2.2) * Math.pow(261.63 / f, 0.6) * (0.9 + 0.2 * rand());
  const rel = p.damp ?? 0.12;
  const out = alloc(Math.min(ev.hold, T1 * 1.5) + rel * 4 + 0.1, sr, true);
  const { L } = out;
  const R = out.R!;
  const rows: [number, number, number][] = [[1, 1, T1], [6.27, 0.22, 0.07], [17.55, 0.06, 0.02]];
  const bank = new ModalBank(sr);
  for (const [ra, a, t] of rows) if (f * ra < sr * 0.45) bank.add(f * ra * cents((rand() - 0.5) * 4), t, a);
  const hard = clamp((p.hammer ?? 0.5) * (0.35 + 0.75 * Math.min(1, v)), 0, 1);
  const contact = (0.0011 - 0.0008 * hard) * sr * clamp(keyScale, 0.5, 1.6);
  const swing = clamp((p.swing ?? 0.8) * Math.pow(Math.min(1.2, v), 1.2), 0, 0.92);
  const hit = pulse(contact, swing);
  const k = clamp(p.pickup ?? 0.88, 0, 0.95);
  const dc = dcBlock(0.9993);
  const hp = svf(sr, 110, 0.7);
  const bump = svf(sr, p.speaker ?? 1000, 1.1);
  const lp = svf(sr, (p.lp ?? 3800) * Math.pow(2, 0.5 * (v - 0.8)), 0.7);
  const drive = p.drive ?? 1.2;
  const gateN = Math.round(ev.hold * sr);
  const trem = p.trem ?? 0;
  const tremInc = (p.tremRate ?? 5.6) / sr;
  let tph = rand();
  const [pl, pr] = panGains(ev.pan);
  const g = (p.level ?? 1) * 0.75;
  for (let i = 0; i < L.length; i++) {
    if (i === gateN) for (let j = 0; j < bank.n; j++) bank.setT60(j, Math.min(rel, bank.t60[j]));
    const disp = bank.tick(hit(i));
    // The capacitive pickup: an asymmetric curve, DC removed.
    let y = dc(disp / (1 - k * clamp(disp, -0.95, 0.95)));
    hp.run(y);
    y = hp.hp;
    bump.run(y);
    y = sat(drive * (y + 0.35 * bump.bp)) / drive;
    y = lp.run(y);
    let tl = 1;
    let tr = 1;
    if (trem > 0) {
      tph += tremInc;
      if (tph >= 1) tph -= 1;
      const s = Math.sin(2 * Math.PI * tph) * trem * 0.5;
      tl = 1 - s;
      tr = 1 + s;
    }
    L[i] = y * g * pl * tl;
    R[i] = y * g * pr * tr;
  }
  return finish(out);
}

/**
 * Upright piano, a modal string model. Per key 1-3 strings (a few cents apart: the beating and the two-stage decay of
 * a real unison), each a bank of partials at the stiff string's slightly stretched frequencies n f sqrt(1 + B n^2),
 * struck by a felt hammer: the contact time (4 ms soft .. 1 ms hard) is the hammer's nonlinearity (a harder blow is a
 * shorter, brighter pulse) and the strike point (1/8 of the string) notches its partials. Higher partials die faster;
 * the damper stops them at the gate. A hammer knock, then the upright's case: a low and a boxy mid resonance and a
 * closed-lid lowpass. Bass strings sit left, treble right.
 */
export function upright(ev: NoteEvent, p: Params, sr: number): Rendered {
  const rand = rng(ev.seed);
  const v = clamp(ev.vel, 0, 1.2);
  const f = ev.freq;
  const midi = 69 + 12 * Math.log2(f / 440);
  const nStr = f < 70 ? 1 : f < 180 ? 2 : clamp(Math.round(p.unison ?? 3), 1, 3);
  const B = (p.inharm ?? 0.0004) * Math.pow(2, ((midi - 60) / 12) * 0.9);
  const T1 = (p.decay ?? 7) * Math.pow(261.63 / f, 0.55);
  const rel = p.damp ?? 0.14;
  const out = alloc(Math.min(ev.hold, T1) + rel * 5 + 0.12, sr, true);
  const { L } = out;
  const R = out.R!;
  const beta = p.strike ?? 0.125;
  const top = Math.min(sr * 0.45, p.top ?? 6000);
  const maxP = Math.round(p.partials ?? 22);
  const hf = p.hfDamp ?? 0.6;
  const hard = clamp(0.25 + 0.85 * Math.min(1, v) * (p.hammer ?? 1), 0, 1.1);
  const contact = (0.0028 - 0.0021 * Math.min(1, hard)) * sr * clamp(Math.pow(261.63 / f, 0.35), 0.5, 2);
  const hit = pulse(contact, 0.5 * Math.pow(Math.min(1.2, v), 1.1));
  const bank = new ModalBank(sr);
  const det = p.detune ?? 1.2;
  for (let s = 0; s < nStr; s++) {
    const c = nStr === 1 ? 0 : (s / (nStr - 1) - 0.5) * 2 * det + (rand() - 0.5) * det * 0.6;
    const tMul = s === 0 ? 1 : s === 1 ? 0.55 : 1.25;
    for (let n = 1; n <= maxP; n++) {
      const fn = n * f * Math.sqrt(1 + B * n * n) * cents(c);
      if (fn > top) break;
      const w = Math.sin(n * Math.PI * beta) / Math.pow(n, 0.55);
      if (Math.abs(w) < 0.05) continue;
      const t = (T1 * tMul) / (1 + hf * Math.pow(fn / 1000, 1.4));
      bank.add(fn, t, w / nStr);
    }
  }
  const knock = svf(sr, 1100, 0.8);
  const knockLevel = (p.knock ?? 0.25) * Math.min(1, v);
  const knockN = 0.006 * sr;
  const gateN = Math.round(ev.hold * sr);
  const hp = svf(sr, 55, 0.7);
  const res1 = svf(sr, p.box1 ?? 190, 1.3);
  const res2 = svf(sr, p.box2 ?? 680, 1.6);
  const lid = svf(sr, (p.lid ?? 4200) * Math.pow(2, 0.7 * (v - 0.8)), 0.6);
  const [pl, pr] = panGains(clamp(ev.pan + (p.spread ?? 0.35) * clamp((midi - 60) / 30, -1, 1), -1, 1));
  const drift = wanderer(rand, 0.2, sr);
  const dr = p.drift ?? 0;
  const g = (p.level ?? 1) * 0.6;
  for (let i = 0; i < L.length; i++) {
    if (i === gateN) for (let j = 0; j < bank.n; j++) bank.setT60(j, Math.min(bank.t60[j], rel));
    if (dr > 0 && (i & 63) === 0) bank.retune(cents(dr * drift()));
    else if (dr > 0) drift();
    let y = bank.tick(hit(i));
    if (i < knockN * 5) {
      knock.run((rand() * 2 - 1) * Math.exp(-i / knockN));
      y += knock.lp * knockLevel;
    }
    hp.run(y);
    y = hp.hp;
    res1.run(y);
    res2.run(y);
    y = lid.run(y + 0.35 * res1.bp + (p.boxy ?? 0.3) * res2.bp);
    L[i] = y * g * pl;
    R[i] = y * g * pr;
  }
  return finish(out);
}

/**
 * Kalimba / mbira tuned to the chord: a thumb plucks a steel tine whose modes are retuned to harmonics (x 1 and a
 * short x 6 "ting", x 3 faint), so a kalimba on chord tones never rings against the harmony; a soft thumb click and
 * the wooden box's air resonance under it.
 */
export function kalimba(ev: NoteEvent, p: Params, sr: number): Rendered {
  const rand = rng(ev.seed);
  const v = clamp(ev.vel, 0, 1.2);
  const f = ev.freq * cents((rand() - 0.5) * 2);
  const T = (p.decay ?? 1.4) * Math.pow(440 / f, 0.4) * (0.9 + 0.2 * rand());
  const rel = p.damp ?? 0.4;
  const out = alloc(Math.min(ev.hold, T * 1.3) + rel * 4 + 0.1, sr, false);
  const { L } = out;
  const ting = (p.ting ?? 0.3) * (0.5 + 0.7 * Math.min(1, v));
  const rows: [number, number, number][] = [[1, 1, T], [6, ting, 0.09], [3, p.third ?? 0.1, T * 0.25], [2, p.octave ?? 0.08, T * 0.5]];
  const bank = new ModalBank(sr);
  for (const [ra, a, t] of rows) if (f * ra < sr * 0.45 && a > 0) bank.add(f * ra, t, a);
  const hit = pulse(0.0003 * sr * (1.2 - 0.4 * Math.min(1, v)), 0.6);
  const box = mode(sr, p.box ?? 260, 0.12);
  const boxLevel = (p.boxLevel ?? 0.35) * (1 - box.r);
  const click = svf(sr, 2500, 0.7);
  const clickN = 0.003 * sr;
  const lp = svf(sr, p.lp ?? 7000, 0.6);
  const gateN = Math.round(ev.hold * sr);
  const g = (p.level ?? 1) * 0.8 * Math.pow(v, 1.05);
  for (let i = 0; i < L.length; i++) {
    if (i === gateN) for (let j = 0; j < bank.n; j++) bank.setT60(j, Math.min(rel, bank.t60[j]));
    let y = bank.tick(hit(i));
    y += box.drive(y * boxLevel) * 1.5;
    if (i < clickN * 5) {
      click.run((rand() * 2 - 1) * Math.exp(-i / clickN));
      y += click.lp * (p.click ?? 0.15);
    }
    L[i] = lp.run(y) * g;
  }
  return finish(out);
}
