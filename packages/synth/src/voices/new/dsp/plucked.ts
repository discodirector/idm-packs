import { alloc, cents, clamp, dcBlock, delayLine, finish, lossFilter, mode, onePoleA, panGains, rng, sat, svf, type NoteEvent, type Params, type Rendered } from "./core.ts";

/**
 * Body resonances per instrument: [Hz, level, T60 s]. The string drives them; they colour the attack and give the
 * box its size (an air mode, the top plate, a higher plate mode).
 */
const BODIES: Record<number, [number, number, number][]> = {
  0: [[98, 0.9, 0.12], [204, 1, 0.08], [390, 0.5, 0.05], [1150, 0.22, 0.02]], // steel guitar
  1: [[100, 1, 0.15], [212, 0.9, 0.1], [420, 0.45, 0.06]], // nylon
  2: [[180, 0.7, 0.12], [350, 0.6, 0.08], [700, 0.3, 0.04]], // harp soundboard
  3: [[140, 0.6, 0.15], [300, 0.7, 0.1], [900, 0.35, 0.03]], // koto
  4: [[62, 1, 0.25], [112, 0.9, 0.18], [205, 0.6, 0.1], [410, 0.25, 0.05]], // upright bass
};

interface StringSpec {
  f: number;
  vel: number;
  /** Onset, samples into the note. */
  at: number;
  level: number;
  /** Extra brightness for this string (12-string octave course). */
  brightAdd: number;
}

/**
 * Plucked strings: a waveguide (Karplus-Strong) per string with the things that make it a string and not a "pluck"
 * preset. Two polarisations (a second loop a cent or so apart that dies faster: the two-stage decay and slow beating
 * of a real string), a pick-shaped excitation (a lowpass that opens with velocity and a comb at the pick position:
 * near the bridge = thin and bright, near the middle = round and hollow), a tension kick (the pitch starts sharp and
 * settles), a loop lowpass for palm muting, a damper at the gate, and an instrument body of modal resonances. The delay
 * is read with Lagrange interpolation, so the pitch can bend (koto oshide). Chords strum (`strum` s per string, low
 * to high); `octave` adds the 12-string's octave / unison course.
 */
export function plucked(ev: NoteEvent, p: Params, sr: number): Rendered {
  const rand = rng(ev.seed);
  const v = clamp(ev.vel, 0, 1.2);
  const tones = ev.chord && ev.chord.length ? ev.chord : [0];
  const strum = (p.strum ?? 0.012) * sr;
  const specs: StringSpec[] = [];
  tones.forEach((semi, k) => {
    const f = ev.freq * Math.pow(2, semi / 12);
    const at = Math.round(k * strum * (0.8 + 0.4 * rand()));
    const vk = v * (1 - 0.04 * k) * (0.92 + 0.16 * rand());
    specs.push({ f, vel: vk, at, level: 1, brightAdd: 0 });
    const oct = p.octave ?? 0;
    if (oct > 0) {
      // 12-string course: an octave string on the low courses (struck just before), a unison pair on the top two.
      const octaveCourse = f < 330;
      specs.push({ f: (octaveCourse ? 2 * f : f) * cents((p.course ?? 6) * (rand() - 0.3)), vel: vk * 0.9, at: Math.max(0, at - Math.round(0.004 * sr)), level: oct, brightAdd: 0.15 });
    }
  });
  const decay = p.decay ?? 2.5;
  const rel = p.damp ?? 0.12;
  const out = alloc(Math.min(ev.hold, decay * 1.8) + rel * 3 + 0.25 + (specs.length * strum) / sr, sr, true);
  const { L } = out;
  const R = out.R!;
  const body = BODIES[Math.round(p.body ?? 0)] ?? BODIES[0];
  const bodyLevel = p.bodyLevel ?? 0.5;
  const mute = clamp(p.mute ?? 0, 0, 1);
  const width = p.width ?? 0.3;
  const gateN = Math.round(ev.hold * sr);
  const bendSemi = p.bend ?? 0;
  const bendAt = (p.bendAt ?? 0.18) * sr;
  const bendN = Math.max(1, (p.bendTime ?? 0.12) * sr);
  const kick = p.kick ?? 6;
  const kickN = Math.max(1, (p.kickTime ?? 0.05) * sr);
  const strings = specs.map((s, si) => {
    const pols = (p.polar ?? 1) > 0 ? 2 : 1;
    const bright = clamp((p.bright ?? 0.5) + s.brightAdd + 0.5 * (Math.min(1, s.vel) - 0.7), 0.03, 1);
    const pos = clamp((p.position ?? 0.15) * (0.92 + 0.16 * rand()), 0.03, 0.5);
    const pan = clamp(ev.pan + width * (specs.length > 1 ? si / (specs.length - 1) - 0.5 : rand() - 0.5), -1, 1);
    const [gl, gr] = panGains(pan);
    const lines = Array.from({ length: pols }, (_, k) => {
      const f = s.f * (k ? cents((p.polar ?? 1) * (0.6 + 0.8 * rand())) : 1);
      const period = sr / f;
      // Loop loss: the fundamental's T60 and a much shorter one at 3 kHz (`tone` and palm muting set it).
      const tone = clamp((p.tone ?? 0.5) * (1 - 0.7 * mute), 0, 1);
      const t60 = decay * (k ? 0.55 : 1) * (1 - 0.9 * mute) * Math.pow(220 / f, 0.35) * (0.9 + 0.2 * rand());
      const hf = 0.015 + 0.6 * tone * tone;
      const lossF = lossFilter(f, sr, 3000);
      lossF.set(t60, t60 * hf);
      const line = delayLine(Math.ceil(period * 1.2) + 8);
      // Excitation, one period long: the plucked string's shape (a triangle with its apex at the pick position: a
      // full fundamental) plus noise (the pick's scrape, more for a bright pick), through the pick's lowpass; the
      // noise is combed at the pick position.
      const N = Math.max(4, Math.round(period));
      const exc = new Float32Array(N);
      const a = onePoleA(250 + 9500 * bright * bright, sr);
      const pp = Math.max(1, Math.round(pos * N));
      const noiseAmt = 0.15 + 0.6 * bright;
      const nz = new Float32Array(N);
      for (let i = 0; i < N; i++) nz[i] = rand() * 2 - 1;
      for (let i = N - 1; i >= pp; i--) nz[i] -= nz[i - pp];
      let st = 0;
      for (let i = 0; i < N; i++) {
        const tri = i < pp ? i / pp : (N - i) / (N - pp);
        st += a * (tri * 2 * (1 - noiseAmt) + nz[i] * noiseAmt - st);
        exc[i] = st;
      }
      // Smooth twice more for a soft finger (bright < 0.4).
      if (bright < 0.4) for (let pass = 0; pass < 2; pass++) for (let i = 1; i < N; i++) exc[i] = 0.5 * (exc[i] + exc[i - 1]);
      let mean = 0;
      for (let i = 0; i < N; i++) mean += exc[i];
      mean /= N;
      let peak = 1e-9;
      for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(exc[i] - mean));
      for (let i = 0; i < N; i++) exc[i] = ((exc[i] - mean) / peak) * Math.min(1.1, s.vel);
      return {
        period,
        lossF,
        t60,
        hf,
        line,
        exc,
        N,
        level: (k ? 0.55 * (p.polarMix ?? 0.6) : 1) * s.level,
      };
    });
    const modes = body.map(([hz, lv, t]) => {
      const m = mode(sr, hz * (0.97 + 0.06 * rand()), t);
      return { m, lv: lv * (1 - m.r) };
    });
    return { s, gl, gr, lines, modes, dc: dcBlock(0.999) };
  });
  const kickR = (n: number) => cents(kick * Math.exp(-n / kickN));
  const bendR = (n: number) => {
    if (!bendSemi || n < bendAt) return 1;
    const x = Math.min(1, (n - bendAt) / bendN);
    return Math.pow(2, (bendSemi * x * x * (3 - 2 * x)) / 12);
  };
  const lpOut = svf(sr, p.lp ?? 9000, 0.6);
  const lpOutR = svf(sr, p.lp ?? 9000, 0.6);
  const g = (p.level ?? 1) * 0.42;
  for (let i = 0; i < L.length; i++) {
    let l = 0;
    let r = 0;
    for (const st of strings) {
      const n = i - st.s.at;
      if (n < 0) continue;
      const ratio = kickR(n) * bendR(n);
      let y = 0;
      for (const ln of st.lines) {
        if (n === gateN) ln.lossF.set(Math.min(ln.t60, rel), Math.min(ln.t60, rel) * ln.hf);
        const d = ln.period / ratio - ln.lossF.delay;
        const cur = ln.line.read(d - 1);
        const filt = ln.lossF.run(cur);
        ln.line.write(filt + (n < ln.N ? ln.exc[n] : 0));
        y += cur * ln.level;
      }
      let b = 0;
      for (const m of st.modes) b += m.m.drive(y * m.lv);
      const o = st.dc(y + b * bodyLevel * 2);
      l += o * st.gl;
      r += o * st.gr;
    }
    L[i] = lpOut.run(l) * g;
    R[i] = lpOutR.run(r) * g;
  }
  // `mono` (the upright bass): one centred channel.
  if ((p.mono ?? 0) > 0) {
    for (let i = 0; i < L.length; i++) L[i] = (L[i] + R[i]) * 0.7071;
    return finish({ L, R: null });
  }
  return finish(out);
}

/**
 * Clavinet: a string the key's rubber tip strikes and holds against an anvil (bright, hard), heard through a magnetic
 * pickup near the bridge (a comb at the pickup's place: the nasal, funky clav), released into a yarn damper with the
 * "thwack" of the tip leaving the string (a second, smaller excitation at the gate). A little preamp drive.
 * `pickup` 0.08 (bridge, funk) .. 0.3 (neck, mellow).
 */
export function clav(ev: NoteEvent, p: Params, sr: number): Rendered {
  const rand = rng(ev.seed);
  const v = clamp(ev.vel, 0, 1.2);
  const f = ev.freq * cents((rand() - 0.5) * (p.drift ?? 2));
  const period = sr / f;
  const decay = (p.decay ?? 1.6) * Math.pow(220 / f, 0.3);
  const rel = p.damp ?? 0.035;
  const out = alloc(Math.min(ev.hold, decay * 2) + rel * 4 + 0.12, sr, false);
  const { L } = out;
  const tone = clamp(p.tone ?? 0.75, 0, 1);
  const line = delayLine(Math.ceil(period) + 8);
  const N = Math.max(4, Math.round(period));
  const bright = clamp((p.bright ?? 0.8) + 0.4 * (Math.min(1, v) - 0.7), 0.1, 1);
  const mkExc = (amp: number, b: number, pos: number) => {
    const e = new Float32Array(N);
    const a = onePoleA(400 + 11000 * b * b, sr);
    let s = 0;
    for (let i = 0; i < N; i++) {
      s += a * (rand() * 2 - 1 - s);
      e[i] = s;
    }
    const pp = Math.max(1, Math.round(pos * N));
    for (let i = N - 1; i >= pp; i--) e[i] -= e[i - pp];
    let peak = 1e-9;
    for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(e[i]));
    for (let i = 0; i < N; i++) e[i] = (e[i] / peak) * amp;
    return e;
  };
  const exc = mkExc(Math.min(1.1, v), bright, 0.11);
  const off = mkExc(0.28 * Math.min(1, v) * (p.thwack ?? 1), 0.9, 0.06);
  const hf = 0.02 + 0.6 * tone * tone;
  const lossF = lossFilter(f, sr, 3000);
  lossF.set(decay, decay * hf);
  const gateN = Math.round(ev.hold * sr);
  const pickN = clamp(p.pickup ?? 0.1, 0.03, 0.5) * period;
  const hist = delayLine(Math.ceil(period) + 8);
  const drive = p.drive ?? 1.4;
  const lp = svf(sr, (p.lp ?? 6000) * Math.pow(2, 0.6 * (v - 0.8)), 0.8);
  const hp = dcBlock(0.995);
  const wah = (p.wah ?? 0) > 0 ? svf(sr, 600, 3) : null;
  let wEnv = 0;
  const g = (p.level ?? 1) * 0.5;
  for (let i = 0; i < L.length; i++) {
    if (i === gateN) lossF.set(Math.min(decay, rel), Math.min(decay, rel) * hf);
    const cur = line.read(period - lossF.delay - 1);
    const filt = lossF.run(cur);
    let x = 0;
    if (i < N) x += exc[i];
    if (i >= gateN && i < gateN + N) x += off[i - gateN];
    line.write(filt + x);
    hist.write(cur);
    // The pickup: the string here minus the string a pickup-distance away (a comb), then the preamp.
    let y = cur - 0.92 * hist.read(pickN);
    y = sat(drive * y) / drive;
    y = lp.run(hp(y));
    if (wah) {
      wEnv += (Math.abs(y) > wEnv ? 0.02 : 0.0004) * (Math.abs(y) - wEnv);
      wah.set(350 + 2600 * Math.min(1, wEnv * 3 * p.wah), 2.8);
      wah.run(y);
      y = 0.35 * y + 1.1 * wah.bp;
    }
    L[i] = y * g;
  }
  return finish(out);
}
