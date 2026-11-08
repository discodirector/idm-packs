import { adsr, alloc, cents, clamp, delayLine, finish, panGains, rng, svf, wanderer, type NoteEvent, type Params, type Rendered } from "./core.ts";

/**
 * The bow-string friction curve (after Smith / STK's BowTable): how much of the bow's velocity the string takes,
 * given the velocity difference. Pressure steepens it (`slope` 5 - 4 x pressure).
 */
function bowTable(dv: number, slope: number): number {
  let s = Math.abs(dv * slope) + 0.75;
  s *= s;
  s = 1 / (s * s);
  return s < 0.01 ? 0.01 : s > 0.98 ? 0.98 : s;
}

/**
 * Bowed strings, a waveguide friction model (McIntyre-Schumacher-Woodhouse, in the form of Smith's bowed string):
 * the string is two delay lines (bow to nut, bow to bridge) meeting at the bow, where a nonlinear friction curve
 * makes the stick-slip of the Helmholtz motion; a lossy one-pole at the bridge. Every player bows on their own: a
 * pressure and speed a little off, entry up to `entry` s late, vibrato (rate and depth their own) that arrives after
 * `vibDelay`, a few cents off pitch, a place in the stereo field. Through a body (an air mode, a wood mode and a
 * bridge mode as wide resonances) and a closing lowpass (sustained-voice rule: calm above ~2.5 kHz).
 * Ensembles: 3-4 players a note, slow bow. Stabs: a hard, short bow stroke.
 */
export function bowed(ev: NoteEvent, p: Params, sr: number): Rendered {
  const rand = rng(ev.seed);
  const v = clamp(ev.vel, 0, 1.2);
  const f0 = ev.freq;
  const players = clamp(Math.round(p.players ?? 3), 1, 6);
  const rel = p.r ?? 0.3;
  const out = alloc(ev.hold + (p.entry ?? 0.03) + rel * 2.5 + 0.25, sr, true);
  const { L } = out;
  const R = out.R!;
  const width = p.width ?? 0.7;
  const lowFix = f0 < 150 ? 1 : 0;
  const pole = 0.75 - (0.2 * 22050) / sr;
  const glideN = ev.from && ev.from > 0 && (p.glide ?? 0) > 0 ? p.glide * sr : 0;
  const glideR = glideN ? ev.from! / f0 : 1;
  type Player = {
    neck: ReturnType<typeof delayLine>;
    bridge: ReturnType<typeof delayLine>;
    base: number;
    beta: number;
    sf: number;
    neckOut: number;
    bridgeOut: number;
    env: ReturnType<typeof adsr>;
    maxVel: number;
    slope: number;
    vibPh: number;
    vibInc: number;
    vibDepth: number;
    at: number;
    gl: number;
    gr: number;
    wand: () => number;
    vibM: number;
    wob: number;
  };
  const ps: Player[] = [];
  for (let k = 0; k < players; k++) {
    const det = players > 1 ? (k / (players - 1) - 0.5) * (p.detune ?? 8) : 0;
    const f = f0 * cents(det + (rand() - 0.5) * 2);
    // The loop: neck + bridge delays, the bridge one-pole's delay and the read offsets (comp, calibrated by a pitch test).
    const base = sr / f - (p.comp ?? -0.3) - pole / (1 - pole);
    const beta = 0.127 + 0.03 * (rand() - 0.5);
    const pan = clamp(ev.pan + width * (players > 1 ? k / (players - 1) - 0.5 : 0) * 1.4 + (rand() - 0.5) * 0.1, -1, 1);
    const [gl, gr] = panGains(pan);
    const press = clamp((p.pressure ?? 0.6) + (rand() - 0.5) * 0.12, 0, 1);
    ps.push({
      neck: delayLine(Math.ceil(sr / f) * 2 + 16),
      bridge: delayLine(Math.ceil(sr / f) + 16),
      base,
      beta,
      sf: 0,
      neckOut: 0,
      bridgeOut: 0,
      env: adsr(sr, (p.a ?? 0.25) * (0.8 + 0.4 * rand()), p.d ?? 0.3, p.s ?? 0.85, rel * (0.85 + 0.3 * rand()), ev.hold),
      maxVel: (0.03 + 0.2 * Math.min(1, v) * (p.bow ?? 0.8)) * (0.9 + 0.2 * rand()),
      slope: 5 - 4 * press,
      vibPh: rand(),
      vibInc: ((p.vibRate ?? 5.1) * (0.85 + 0.3 * rand())) / sr,
      vibDepth: (p.vib ?? 14) * (0.7 + 0.6 * rand()),
      at: Math.round((p.entry ?? 0.03) * rand() * sr),
      gl,
      gr,
      wand: wanderer(rand, 0.3, sr / 16),
      vibM: 1,
      wob: 1,
    });
  }
  const vibN = Math.max(1, (p.vibDelay ?? 0.3) * sr);
  // Body: an air mode, a wood mode, a bridge mode (wide), a highpass and the closing lowpass.
  const bodyScale = Math.pow(clamp(f0 / 330, 0.25, 2), 0.35) * (lowFix ? 0.8 : 1);
  const mkBody = () => ({
    hp: svf(sr, 70 * bodyScale, 0.7),
    a: svf(sr, 280 * bodyScale, 1.4),
    b: svf(sr, 470 * bodyScale, 1.8),
    c: svf(sr, 1150 * bodyScale, 1.2),
    lp1: svf(sr, (p.lp ?? 2400) * Math.pow(2, 0.4 * (ev.bright - 0.8)), 0.65),
    lp2: svf(sr, (p.lp ?? 2400) * Math.pow(2, 0.4 * (ev.bright - 0.8)) * 1.3, 0.55),
  });
  const bl = mkBody();
  const br = mkBody();
  const body = (b: ReturnType<typeof mkBody>, x: number) => {
    b.hp.run(x);
    const y = b.hp.hp;
    b.a.run(y);
    b.b.run(y);
    b.c.run(y);
    return b.lp2.run(b.lp1.run(0.6 * y + 0.9 * b.a.bp + 0.7 * b.b.bp + 0.45 * b.c.bp));
  };
  const g = (p.level ?? 1) * 0.28 / Math.sqrt(players);
  for (let i = 0; i < L.length; i++) {
    let l = 0;
    let r = 0;
    let pitch = 1;
    if (glideN && i < glideN) pitch = Math.pow(glideR, 1 - i / glideN);
    for (const pl of ps) {
      const n = i - pl.at;
      if (n < 0) continue;
      const bowV = pl.maxVel * pl.env.next() * pl.wob;
      pl.vibPh += pl.vibInc;
      if (pl.vibPh >= 1) pl.vibPh -= 1;
      if ((n & 15) === 0) {
        pl.vibM = cents(pl.vibDepth * Math.min(1, n / vibN) * Math.sin(2 * Math.PI * pl.vibPh));
        pl.wob = 1 + 0.03 * pl.wand();
      }
      const D = pl.base / pitch / pl.vibM;
      // Bridge reflection through the lossy one-pole, nut reflection, the bow junction.
      pl.sf = 0.95 * (1 - pole) * pl.bridgeOut + pole * pl.sf;
      const bridgeRefl = -pl.sf;
      const nutRefl = -pl.neckOut;
      const sv = bridgeRefl + nutRefl;
      const dv = bowV - sv;
      const nv = bowV > 1e-6 ? dv * bowTable(dv, pl.slope) : 0;
      pl.neck.write(bridgeRefl + nv);
      pl.bridge.write(nutRefl + nv);
      pl.neckOut = pl.neck.read(Math.max(1, D * (1 - pl.beta) - 1));
      pl.bridgeOut = pl.bridge.read(Math.max(1, D * pl.beta - 1));
      l += pl.bridgeOut * pl.gl;
      r += pl.bridgeOut * pl.gr;
    }
    L[i] = body(bl, l) * g;
    R[i] = body(br, r) * g;
  }
  return finish(out, 2e-5);
}
