import { adsr, alloc, blep, cents, clamp, finish, gOf, ladder, panGains, rng, sat, svf, wanderer, type NoteEvent, type Params, type Rendered } from "./core.ts";

/**
 * A drifting band-limited saw (polyBLEP). `tick(f)` returns the next sample at `f` Hz (before drift); the drift is
 * computed every 16 samples (its wanderer runs at 1/16 of the rate).
 */
function saw(rand: () => number, sr: number, driftC: number, driftRate: number) {
  let ph = rand();
  const w = wanderer(rand, driftRate * (0.7 + 0.6 * rand()), sr / 16);
  let m = 1;
  let c = 0;
  return (f: number) => {
    if ((c++ & 15) === 0) m = cents(driftC * w());
    const dt = (f * m) / sr;
    ph += dt;
    if (ph >= 1) ph -= 1;
    return 2 * ph - 1 - blep(ph, dt);
  };
}

/** The glide ratio at sample n (from `from` Hz into f over `n` samples, a curved approach). */
function glider(ev: NoteEvent, f: number, glide: number, sr: number) {
  if (!(ev.from && ev.from > 0) || ev.from === f || !(glide > 0)) return () => 1;
  const ratio = ev.from / f;
  const N = Math.max(1, Math.round(glide * sr));
  let n = 0;
  return () => {
    if (n >= N) return 1;
    const x = n++ / N;
    return Math.pow(ratio, 1 - x * (2 - x));
  };
}

/**
 * Soft brass section: `players` (3) per note, each a drifting saw that scoops up into the pitch, through a 24 dB
 * ladder whose cutoff follows the player's own breath envelope to the power 1.5: brass gets brighter as it gets
 * louder (the brass law), so the swell opens and the release darkens; a little breath noise. Low resonance and a
 * closed ceiling (no resonant mid-range brass, no pulse). Players enter a few ms apart and sit across the stereo field.
 */
export function softBrass(ev: NoteEvent, p: Params, sr: number): Rendered {
  const rand = rng(ev.seed);
  const v = clamp(ev.vel, 0, 1.2);
  const f0 = ev.freq;
  const players = clamp(Math.round(p.players ?? 3), 1, 5);
  const rel = p.r ?? 0.25;
  const out = alloc(ev.hold + rel * 2 + 0.1, sr, true);
  const { L } = out;
  const R = out.R!;
  const width = p.width ?? 0.6;
  const k = clamp((p.res ?? 0.08) * 4, 0, 3);
  const base = (p.cutoff ?? 380) * Math.pow(f0 / 220, clamp(p.track ?? 0.6, 0, 1));
  const open = (p.open ?? 2.3) * (0.6 + 0.5 * Math.min(1, v));
  const ceil = p.ceiling ?? 2600;
  const ps = Array.from({ length: players }, (_, j) => {
    const pan = clamp(ev.pan + width * (players > 1 ? j / (players - 1) - 0.5 : 0) * 1.5, -1, 1);
    const [gl, gr] = panGains(pan);
    return {
      osc: saw(rand, sr, p.drift ?? 4, 0.3),
      osc2: saw(rand, sr, p.drift ?? 4, 0.3),
      detM: cents(players > 1 ? (j / (players - 1) - 0.5) * (p.detune ?? 10) : 0),
      sc: 1,
      env: adsr(sr, (p.a ?? 0.06) * (0.8 + 0.4 * rand()), p.d ?? 0.4, p.s ?? 0.7, rel * (0.85 + 0.3 * rand()), ev.hold),
      fl: ladder(false),
      at: Math.round((p.entry ?? 0.012) * rand() * sr),
      scoop: (p.scoop ?? 40) * (0.6 + 0.8 * rand()),
      scoopN: Math.max(1, (p.scoopTime ?? 0.05) * sr * (0.8 + 0.4 * rand())),
      gl,
      gr,
      G: gOf(base, 2 * sr),
      bp: svf(sr, 1300, 1),
    };
  });
  const breath = (p.breath ?? 0.04) * 1.5;
  const glide = glider(ev, f0, p.glide ?? 0, sr);
  const g = (p.level ?? 1) * 0.9 / Math.sqrt(players);
  for (let i = 0; i < L.length; i++) {
    let l = 0;
    let r = 0;
    const gli = glide();
    for (const pl of ps) {
      const n = i - pl.at;
      if (n < 0) continue;
      const e = pl.env.next();
      if ((n & 15) === 0) pl.sc = n < pl.scoopN ? cents(-pl.scoop * Math.pow(1 - n / pl.scoopN, 2)) : 1;
      const f = f0 * gli * pl.sc * pl.detM;
      const x = 0.6 * pl.osc(f) + 0.4 * pl.osc2(f * 1.002892);
      if ((n & 15) === 0) pl.G = gOf(Math.min(ceil, base * Math.pow(2, open * Math.pow(e, 1.5))), 2 * sr);
      pl.bp.run(rand() * 2 - 1);
      const y = pl.fl.run(x * 0.7 + pl.bp.bp * breath, pl.G, k) * e;
      l += y * pl.gl;
      r += y * pl.gr;
    }
    L[i] = l * g;
    R[i] = r * g;
  }
  return finish(out);
}

/**
 * Reese bass: three drifting saws, two of them detuned against the centre one (the slow phasing "Reese" movement),
 * the left side hearing centre + upper, the right centre + lower, each side through its own saturating ladder that
 * wanders slowly. Split at `xover`: below it everything is summed to mono with a clean sine sub (a club-safe low
 * end), above it the two sides stay wide (dark-bass rule: widen only above ~260 Hz).
 */
export function reese(ev: NoteEvent, p: Params, sr: number): Rendered {
  const rand = rng(ev.seed);
  const v = clamp(ev.vel, 0, 1.2);
  const f0 = ev.freq;
  const rel = p.r ?? 0.08;
  const out = alloc(ev.hold + rel * 2 + 0.05, sr, true);
  const { L } = out;
  const R = out.R!;
  const det = p.detune ?? 14;
  const oc = saw(rand, sr, p.drift ?? 3, 0.25);
  const ou = saw(rand, sr, p.drift ?? 3, 0.25);
  const od = saw(rand, sr, p.drift ?? 3, 0.25);
  const env = adsr(sr, p.a ?? 0.004, p.d ?? 0.6, p.s ?? 0.85, rel, ev.hold);
  const fenv = adsr(sr, 0.002, p.fd ?? 0.35, p.fs ?? 0.2, rel, ev.hold);
  const k = clamp((p.res ?? 0.25) * 4, 0, 3.5);
  const fl = ladder(false);
  const fr = ladder(false);
  const wl = wanderer(rand, p.moveRate ?? 0.35, sr);
  const wr = wanderer(rand, (p.moveRate ?? 0.35) * 1.13, sr);
  const base = (p.cutoff ?? 520) * Math.pow(2, 0.6 * (v - 0.8));
  const envOct = (p.env ?? 1.2) * Math.min(1, v);
  const move = p.move ?? 0.4;
  const drive = 1 + (p.drive ?? 0.8);
  const xo = p.xover ?? 220;
  const lowL = svf(sr, xo, 0.707);
  const lowR = svf(sr, xo, 0.707);
  const sub = p.sub ?? 0.7;
  let subPh = 0;
  const glide = glider(ev, f0, p.glide ?? 0.05, sr);
  const detU = cents(det);
  const detD = cents(-det * 0.93);
  let GL = gOf(base, 2 * sr);
  let GR = GL;
  const g = (p.level ?? 1) * 0.55;
  for (let i = 0; i < L.length; i++) {
    const gl = glide();
    const f = f0 * gl;
    const c = oc(f);
    const u = ou(f * detU);
    const d = od(f * detD);
    const fe = fenv.next();
    const ml = wl();
    const mr = wr();
    if ((i & 15) === 0) {
      GL = gOf(base * Math.pow(2, envOct * fe + move * ml), 2 * sr);
      GR = gOf(base * Math.pow(2, envOct * fe + move * mr), 2 * sr);
    }
    const e = env.next();
    const yl = fl.run((c + u) * 0.5 * drive, GL, k) / drive;
    const yr = fr.run((c + d) * 0.5 * drive, GR, k) / drive;
    // Crossover: lows to mono, highs stay wide.
    lowL.run(yl);
    lowR.run(yr);
    subPh += f / sr;
    if (subPh >= 1) subPh -= 1;
    const mono = 0.5 * (lowL.lp + lowR.lp) + sub * 0.5 * Math.sin(2 * Math.PI * subPh);
    L[i] = sat((mono + (yl - lowL.lp)) * e * 1.2) * g;
    R[i] = sat((mono + (yr - lowR.lp)) * e * 1.2) * g;
  }
  return finish(out);
}

/**
 * Rubber sub: a sine that drops into its note from `bend` semitones above (the bounce), glides from the previous note,
 * and is squeezed by a decaying asymmetric drive (2nd and 3rd harmonics while the note is fresh: it reads on a phone,
 * then relaxes into a pure sub). Mono, no click.
 */
export function rubberSub(ev: NoteEvent, p: Params, sr: number): Rendered {
  const v = clamp(ev.vel, 0, 1.2);
  const f0 = ev.freq;
  const rel = p.r ?? 0.06;
  const out = alloc(ev.hold + rel * 2 + 0.03, sr, false);
  const { L } = out;
  const env = adsr(sr, p.a ?? 0.003, p.d ?? 0.5, p.s ?? 0.8, rel, ev.hold);
  const bend = p.bend ?? 5;
  const bendN = Math.max(1, (p.bendTime ?? 0.035) * sr);
  const drive = (p.drive ?? 0.6) * Math.min(1, v);
  const driveN = Math.max(1, (p.driveDecay ?? 0.16) * sr);
  const glide = glider(ev, f0, p.glide ?? 0.06, sr);
  const glides = !!(ev.from && ev.from > 0 && (p.glide ?? 0.06) > 0);
  let ph = 0;
  const g = (p.level ?? 1) * 0.7 * Math.pow(v, 0.8);
  for (let i = 0; i < L.length; i++) {
    const b = glides ? 1 : Math.pow(2, (bend * Math.exp(-i / bendN)) / 12);
    ph += (f0 * glide() * b) / sr;
    if (ph >= 1) ph -= 1;
    const s = Math.sin(2 * Math.PI * ph);
    const d = drive * Math.exp(-i / driveN) + (p.floor ?? 0.1);
    const y = d > 0 ? sat(s * (1 + 2.5 * d) + 0.3 * d) - sat(0.3 * d) : s;
    L[i] = (y / (1 + 0.5 * d)) * env.next() * g;
  }
  return finish(out);
}

/**
 * Filtered saw lead: two drifting saws (a few cents apart) and a sine an octave down, through a driven ladder (or the
 * diode for the squelchy glide line) with key tracking, its own envelope and velocity on the cutoff; a post-filter
 * saturation for the edge, vibrato that arrives late, glide from the previous note. Stereo: the second saw through
 * its own filter on the other side (`width`). No pulse (not reedy), dark by default.
 */
export function sawLead(ev: NoteEvent, p: Params, sr: number): Rendered {
  const rand = rng(ev.seed);
  const v = clamp(ev.vel, 0, 1.2);
  const f0 = ev.freq;
  const rel = p.r ?? 0.12;
  const out = alloc(ev.hold + rel * 2 + 0.05, sr, true);
  const { L } = out;
  const R = out.R!;
  const diode = (p.filter ?? 0) >= 0.5;
  const fa = ladder(diode);
  const fb = ladder(diode);
  const o1 = saw(rand, sr, p.drift ?? 3, 0.3);
  const o2 = saw(rand, sr, p.drift ?? 3, 0.3);
  const det = p.detune ?? 7;
  const sub = p.sub ?? 0.25;
  let subPh = rand();
  const env = adsr(sr, p.a ?? 0.004, p.d ?? 0.3, p.s ?? 0.8, rel, ev.hold);
  const fenv = adsr(sr, 0.002, p.fd ?? 0.35, p.fs ?? 0.2, rel * 1.2, ev.hold);
  const k = clamp((p.res ?? 0.32) * 4, 0, 3.8);
  const base = (p.cutoff ?? 700) * Math.pow(f0 / 261.63, clamp(p.track ?? 0.5, 0, 1)) * Math.pow(2, 0.8 * (v - 0.8)) * Math.pow(2, 0.5 * (ev.bright - 0.8));
  const envOct = (p.env ?? 2.2) * (0.5 + 0.6 * Math.min(1, v));
  const drive = 1 + (p.drive ?? 0.9);
  const glide = glider(ev, f0, p.glide ?? 0.07, sr);
  const vib = p.vib ?? 12;
  const vibN = Math.max(1, (p.vibDelay ?? 0.35) * sr);
  const vibInc = (p.vibRate ?? 5.2) / sr;
  let vibPh = rand();
  const wnd = wanderer(rand, 0.4, sr);
  const width = clamp(p.width ?? 0.3, 0, 1);
  const [pl, pr] = panGains(ev.pan);
  let G = gOf(base, 2 * sr);
  let vibM = 1;
  const detA = cents(-det / 2);
  const detB = cents(det / 2);
  const g = (p.level ?? 1) * 0.5;
  for (let i = 0; i < L.length; i++) {
    vibPh += vibInc;
    if (vibPh >= 1) vibPh -= 1;
    if ((i & 15) === 0) vibM = vib > 0 ? cents(vib * Math.min(1, i / vibN) * Math.sin(2 * Math.PI * vibPh)) : 1;
    const f = f0 * glide() * vibM;
    const a = o1(f * detA);
    const b = o2(f * detB);
    subPh += f / (2 * sr);
    if (subPh >= 1) subPh -= 1;
    const s = sub * Math.sin(2 * Math.PI * subPh);
    const fe = fenv.next();
    const w = wnd();
    if ((i & 15) === 0) G = gOf(Math.min(sr * 0.2, base * Math.pow(2, envOct * fe + 0.2 * w)), 2 * sr);
    const e = env.next();
    const mid = (a + b) * 0.5;
    const ya = sat(fa.run((mid * (1 - width) + a * width + s) * 0.6 * drive, G, k) * 1.3) / 1.3;
    const yb = sat(fb.run((mid * (1 - width) + b * width + s) * 0.6 * drive, G, k) * 1.3) / 1.3;
    L[i] = ya * e * g * pl * 1.41;
    R[i] = yb * e * g * pr * 1.41;
  }
  return finish(out);
}
