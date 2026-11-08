import { adsr, alloc, blep, cents, clamp, finish, panGains, rng, svf, wanderer, type NoteEvent, type Params, type Rendered } from "./core.ts";

/**
 * Formant tables (Hz, dB, bandwidth Hz) for the vowels a e i o u, a tenor and a soprano (the classic singing tables).
 * The voice interpolates between the two by pitch (or `sex`) and between vowels by `vowel` 0..4.
 */
const TENOR: [number[], number[], number[]][] = [
  [[650, 1080, 2650, 2900, 3250], [0, -6, -7, -8, -22], [80, 90, 120, 130, 140]],
  [[400, 1700, 2600, 3200, 3580], [0, -14, -12, -14, -20], [70, 80, 100, 120, 120]],
  [[290, 1870, 2800, 3250, 3540], [0, -15, -18, -20, -30], [40, 90, 100, 120, 120]],
  [[400, 800, 2600, 2800, 3000], [0, -10, -12, -12, -26], [40, 80, 100, 120, 120]],
  [[350, 600, 2700, 2900, 3300], [0, -20, -17, -14, -26], [40, 60, 100, 120, 120]],
];
const SOPRANO: [number[], number[], number[]][] = [
  [[800, 1150, 2900, 3900, 4950], [0, -6, -32, -20, -50], [80, 90, 120, 130, 140]],
  [[350, 2000, 2800, 3600, 4950], [0, -20, -15, -40, -56], [60, 100, 120, 150, 200]],
  [[270, 2140, 2950, 3900, 4950], [0, -12, -26, -26, -44], [60, 90, 100, 120, 120]],
  [[450, 800, 2830, 3800, 4950], [0, -11, -22, -22, -50], [70, 80, 100, 130, 135]],
  [[325, 700, 2700, 3800, 4950], [0, -16, -35, -40, -60], [50, 60, 170, 180, 200]],
];

/** Formant k at vowel position `vw` (0..4) and voice type `sx` (0 tenor .. 1 soprano): [Hz, linear amp, Q]. */
function formant(vw: number, sx: number, k: number, bright: number): [number, number, number] {
  const i = Math.min(3, Math.floor(clamp(vw, 0, 4)));
  const t = clamp(vw, 0, 4) - i;
  const at = (tab: typeof TENOR, j: number) => tab[i][j][k] + (tab[Math.min(4, i + 1)][j][k] - tab[i][j][k]) * t;
  const F = at(TENOR, 0) + (at(SOPRANO, 0) - at(TENOR, 0)) * sx;
  let dB = at(TENOR, 1) + (at(SOPRANO, 1) - at(TENOR, 1)) * sx;
  const bw = at(TENOR, 2) + (at(SOPRANO, 2) - at(TENOR, 2)) * sx;
  // Brightness: the singer's formant region (F3, F4) lifted, F5 a little.
  if (k === 2 || k === 3) dB += 24 * bright;
  else if (k === 4) dB += 14 * bright;
  if (dB > -1 && k > 0) dB = -1;
  return [F, Math.pow(10, dB / 20), F / Math.max(30, bw)];
}

/**
 * Vocal voice, a source-filter model. Per side, `voices` singers: a band-limited glottal buzz (a polyBLEP saw tilted by
 * a one-pole lowpass: the radiated glottal spectrum) with its own pitch drift, jitter and shimmer, vibrato that arrives
 * late, and breath (aspiration noise gated by the glottal cycle). Each side's singers sound through five formant
 * resonators (the vowel tables, tenor to soprano by pitch), the right side's formants a few % higher (width). The vowel
 * can move inside the note (`vowel` -> `vowelTo` over `morph` s); `scoop` / `fall` bend into and out of the note,
 * `consonant` puts an "h" of breath on the onset. Choirs: 3-4 singers a side, slow attack. Chops and stabs: one or two
 * singers, short, bright.
 */
export function vox(ev: NoteEvent, p: Params, sr: number): Rendered {
  const rand = rng(ev.seed);
  const v = clamp(ev.vel, 0, 1.2);
  const f0 = ev.freq;
  const per = clamp(Math.round(p.voices ?? 3), 1, 5);
  const sx = (p.sex ?? -1) >= 0 ? clamp(p.sex, 0, 1) : clamp((Math.log2(f0 / 130) / 1.6), 0, 1);
  const shift = Math.pow(2, (p.shift ?? 0) / 12);
  const width = clamp(p.width ?? 0.7, 0, 1);
  const bright = clamp((p.bright ?? 0.5) + 0.2 * (ev.bright - 0.7) + 0.15 * (v - 0.8), 0, 1);
  const vowelA = p.vowel ?? 0;
  const vowelB = (p.vowelTo ?? -1) >= 0 ? p.vowelTo : vowelA;
  const morphN = Math.max(1, (p.morph ?? 0.3) * sr);
  const morphAt = (p.morphAt ?? 0) * sr;
  const rel = p.r ?? 0.4;
  const out = alloc(ev.hold + rel * 1.6 + 0.08, sr, true);
  const { L } = out;
  const R = out.R!;
  const breath = (p.breath ?? 0.12) * 0.6;
  const cons = (p.consonant ?? 0) * 1.2;
  const consN = 0.035 * sr;
  const tiltA = Math.exp(-2 * Math.PI * clamp(p.tilt ?? 2600, 300, 12000) / sr);
  const scoop = p.scoop ?? 0;
  const scoopN = Math.max(1, (p.scoopTime ?? 0.07) * sr);
  const fall = p.fall ?? 0;
  const gateN = Math.round(ev.hold * sr);
  const fallN = Math.max(1, rel * sr);
  const vibD = (p.vib ?? 18) * (0.85 + 0.3 * rand());
  const vibN = Math.max(1, (p.vibDelay ?? 0.35) * sr);
  const glideN = ev.from && ev.from > 0 && (p.glide ?? 0) > 0 ? p.glide * sr : 0;
  const glideR = glideN ? ev.from! / f0 : 1;
  type Singer = { ph: number; cents: number; drift: () => number; jit: () => number; shim: () => number; m: number; amp: number; vibPh: number; vibInc: number; env: ReturnType<typeof adsr>; tilt: number; side: number; delay: number };
  const singers: Singer[] = [];
  for (let s = 0; s < per * 2; s++) {
    const side = s % 2;
    const k = Math.floor(s / 2);
    const spread = per > 1 ? (k / (per - 1) - 0.5) * (p.detune ?? 12) : 0;
    singers.push({
      ph: rand(),
      cents: spread + (rand() - 0.5) * 3,
      drift: wanderer(rand, 0.25 * (0.7 + 0.6 * rand()), sr / 8),
      jit: wanderer(rand, 28 + 10 * rand(), sr / 8),
      shim: wanderer(rand, 18 + 8 * rand(), sr / 8),
      m: 1,
      amp: 1,
      vibPh: rand(),
      vibInc: ((p.vibRate ?? 5.2) * (0.88 + 0.24 * rand())) / sr,
      env: adsr(sr, (p.a ?? 0.25) * (0.8 + 0.4 * rand()), p.d ?? 0.4, p.s ?? 0.85, rel * (0.85 + 0.3 * rand()), ev.hold),
      tilt: 0,
      side,
      delay: Math.round((p.stagger ?? 0.012) * rand() * sr),
    });
  }
  // Formant banks, one per side; coefficients refreshed every 32 samples (the vowel moves).
  const banks = [0, 1].map(() => Array.from({ length: 5 }, () => svf(sr, 500, 5)));
  const amps = [new Float64Array(5), new Float64Array(5)];
  const setBanks = (vw: number) => {
    for (let side = 0; side < 2; side++) {
      const sh = shift * (side ? 1 + 0.035 * width : 1 - 0.015 * width);
      for (let k = 0; k < 5; k++) {
        const [F, a, q] = formant(vw, sx, k, bright);
        banks[side][k].set(F * sh, q);
        amps[side][k] = a;
      }
    }
  };
  const [pl, pr] = panGains(ev.pan);
  const sideGain = [pl * (1 + 0.3 * (1 - width)), pr * (1 + 0.3 * (1 - width))];
  const g = (p.level ?? 1) * 0.55 * Math.pow(v, 0.9) / Math.sqrt(per);
  const n0 = Math.max(0, Math.round(0));
  let vw = vowelA;
  let pitch = 1;
  for (let i = n0; i < L.length; i++) {
    if ((i & 31) === 0) {
      const x = clamp((i - morphAt) / morphN, 0, 1);
      vw = vowelA + (vowelB - vowelA) * x * x * (3 - 2 * x);
      setBanks(vw);
    }
    if ((i & 7) === 0) {
      pitch = 1;
      if (scoop) pitch *= cents(scoop * Math.max(0, 1 - i / scoopN) ** 2);
      if (fall && i > gateN) pitch *= cents(-fall * Math.min(1, (i - gateN) / fallN));
      if (glideN && i < glideN) pitch *= Math.pow(glideR, 1 - i / glideN);
    }
    let src0 = 0;
    let src1 = 0;
    const nz0 = rand() * 2 - 1;
    const nz1 = rand() * 2 - 1;
    for (const s of singers) {
      const j = i - s.delay;
      if (j < 0) continue;
      const e = s.env.next();
      s.vibPh += s.vibInc;
      if (s.vibPh >= 1) s.vibPh -= 1;
      // Pitch and shimmer at control rate (every 8 samples).
      if ((j & 7) === 0) {
        const vibAmt = Math.min(1, j / vibN);
        s.m = cents(s.cents + 4 * s.drift() + 0.9 * s.jit() + vibD * vibAmt * Math.sin(2 * Math.PI * s.vibPh));
        s.amp = 1 + 0.04 * s.shim();
      }
      const fr = f0 * pitch * s.m;
      const dt = fr / sr;
      s.ph += dt;
      if (s.ph >= 1) s.ph -= 1;
      const buzz = 2 * s.ph - 1 - blep(s.ph, dt);
      // Glottal tilt (a one-pole lowpass), breath gated by the open phase, shimmer on the amplitude.
      s.tilt = buzz + tiltA * (s.tilt - buzz);
      const open = s.ph < 0.6 ? 1 : 0.25;
      const asp = (s.side ? nz1 : nz0) * (breath + (cons > 0 && j < consN * 3 ? cons * Math.exp(-j / consN) : 0)) * open;
      const y = (s.tilt * 1.6 + asp) * e * s.amp;
      if (s.side) src1 += y;
      else src0 += y;
    }
    let l = 0;
    let r = 0;
    for (let k = 0; k < 5; k++) {
      banks[0][k].run(src0);
      banks[1][k].run(src1);
      l += banks[0][k].bp * amps[0][k];
      r += banks[1][k].bp * amps[1][k];
    }
    L[i] = l * g * sideGain[0];
    R[i] = r * g * sideGain[1];
  }
  return finish(out);
}
