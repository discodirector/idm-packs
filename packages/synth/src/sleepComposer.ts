// Sleep composer (prototype): a generative ambient piece for a station's sleep mode, built as a dynamic system rather
// than a loop. A seed (the 30-min slot) writes a score before any audio: scenes (void, emergence, float, bloom,
// dissolve) with their density, brightness and space; harmony states walked through a transition matrix; a sparse
// melody of one motif and its transformations; rare bells, resonant swells and low thumps with cooldowns; slow random
// walks for the continuous parameters. The generators remember what they did (no note or chord twice in a row, a
// bell makes the next one less likely, a layer long gone comes back). Every layer keeps its own clock (prime-ish
// periods), so nothing lines up into a short loop. The score is plain data and deterministic: every listener and
// every render of a slot hears the same piece. renderSleepScore turns it into WebAudio nodes (live or offline).

/** A palette: the key, the harmony states and the timbres a piece is written in. */
export interface SleepPalette {
  id: string;
  name: string;
  /**
   * "drone" (default): drone, pad, bass, melody, bells, swells, thumps, wind. "receiver" (after Tetsu Inoue's World
   * Receiver): no held drone at all: grain clouds on the chord's tones, a radio dial searching through noise (now and
   * then a signal), bursts of digital blips, drips, short chord glows, rare low blooms and breathing air.
   */
  kind?: "drone" | "receiver";
  /** Receiver palettes: the character of each layer (RECEIVER_DEFAULTS for what is left out). */
  receiver?: Partial<ReceiverOptions>;
  /** MIDI note of the tonic in the bass register (e.g. 38 = D2). */
  root: number;
  /** The mode, semitones from the tonic (the melody's notes). */
  scale: readonly number[];
  /** Harmony states: chord tones, semitones from the tonic (lowest first). */
  states: readonly (readonly number[])[];
  /** Transition weights between states (row: from, column: to). */
  moves: readonly (readonly number[])[];
  /** The melody's motif, as scale steps (0 = the tonic's step). */
  motif: readonly number[];
  /** Lowest MIDI note of the melody's register (it spans about an octave and a half above). */
  melodyFrom: number;
  /** Melody voice: FM ratio and index at full brightness (0 = a pure sine). */
  fm: { ratio: number; index: number };
  /** Layer levels (0..1). */
  levels: { drone: number; pad: number; bass: number; melody: number; bell: number; swell: number; thump: number; noise: number };
  /** Pad oscillator and the pad filter's range (Hz at brightness 0 and 1). */
  pad: { wave: OscillatorType; cutoff: readonly [number, number] };
  /** Noise texture: its filter's range (Hz) — a low wind or a soft rain. */
  noise: { cutoff: readonly [number, number] };
  /** Reverb tail, seconds. */
  reverb: number;
  /** How dark the reverb's tail is, 0..1 (default 0). */
  reverbDark?: number;
  /** The delay's lowpass, Hz (default 1600). */
  delayLp?: number;
  /** A lowpass on the whole piece before the master, Hz (none by default). */
  masterLp?: number;
  /** The master's highpass, Hz (default 28): higher keeps the sub out. */
  masterHp?: number;
}

type Pt = readonly [time: number, value: number];

export interface SleepScene {
  t: number;
  name: SceneName;
}
export interface SleepChord {
  t: number;
  state: number;
}
export interface SleepNote {
  t: number;
  midi: number;
  dur: number;
  vel: number;
  pan: number;
}
export interface SleepEvent {
  t: number;
  midi: number;
  vel: number;
  pan: number;
}

export interface SleepScore {
  seed: number;
  seconds: number;
  palette: string;
  scenes: SleepScene[];
  chords: SleepChord[];
  notes: SleepNote[];
  bells: SleepEvent[];
  swells: SleepEvent[];
  thumps: SleepEvent[];
  /** Macro curves (0..1) and the noise filter walk (0..1), as time points. */
  density: Pt[];
  brightness: Pt[];
  space: Pt[];
  noiseWalk: Pt[];
  /** Receiver palettes only (SleepPalette.kind). */
  receiver?: ReceiverScore;
}

/** How a receiver palette's layers behave; one palette differs from another by these. */
export interface ReceiverOptions {
  /** Grains: oscillator, FM index (0 = none), the low and the high cloud's lowest note, their span (semitones), length and rate scales. */
  grain: { wave: OscillatorType; fm: number; low: number; high: number; span: number; len: number; rate: number; cutoff?: readonly [number, number]; attack?: number };
  /** Clouds: spacing scale (1 = default, 2 = half as many). */
  cloudGap: number;
  /** The dial: odds scale, the share that finds a signal, band Q, flutter Hz, the signal's oscillator. */
  dial: { odds: number; signal: number; q: number; flutter: number; wave: OscillatorType };
  /** Blips: odds scale, glide range (semitones), register (MIDI). */
  blips: { odds: number; glide: number; lo: number; hi: number };
  /** Drips per minute at density 0 and 1. */
  drips: readonly [number, number];
  /** Drip pitch range, Hz. */
  dripHz: readonly [number, number];
  /** The trickle's register (MIDI). */
  trickle: readonly [number, number];
  /** Seconds between trickle tones (a narrow range is a slow pulse). */
  trickleGap: readonly [number, number];
  /** The register a dial's found signal sits in (MIDI). */
  dialSignal: readonly [number, number];
  /** A glow's voices above this note fold down an octave (MIDI; none by default). */
  glowMax?: number;
  /**
   * Soft voicing (the owner heard held tones ring in the second set): every tonal voice above 300 Hz falls with pitch (18 dB an octave), clouds keep to their span (no octave leaps),
   * glows sit an octave lower as lowpassed triangles with a slow deep movement, the found signal far quieter and dipping,
   * blooms 16 dB down and drifting ~20 cents, the melody 12 dB down. Off by default.
   */
  soft?: boolean;
  /** Detune of a glow's sine pairs, cents (0 = pure, no beating). */
  glowDetune: number;
  /** Air: breaths per 10 minutes (each 8–20 s); between them it is silent. */
  breaths: number;
  /** Odds of a glow on a chord change. */
  glow: number;
  /** Bloom odds scale. */
  bloom: number;
}

export const RECEIVER_DEFAULTS: ReceiverOptions = {
  grain: { wave: "sine", fm: 0, low: 60, high: 69, span: 12, len: 1, rate: 1 },
  cloudGap: 1,
  dial: { odds: 1, signal: 0.5, q: 14, flutter: 4, wave: "triangle" },
  blips: { odds: 1, glide: 7, lo: 67, hi: 86 },
  drips: [1, 9],
  dripHz: [700, 2437],
  trickle: [60, 79],
  trickleGap: [1.2, 4],
  dialSignal: [64, 81],
  glowDetune: 4,
  breaths: 3,
  glow: 0.75,
  bloom: 1,
};

const receiverOf = (p: SleepPalette): ReceiverOptions => {
  const o = p.receiver ?? {};
  return { ...RECEIVER_DEFAULTS, ...o, grain: { ...RECEIVER_DEFAULTS.grain, ...o.grain }, dial: { ...RECEIVER_DEFAULTS.dial, ...o.dial }, blips: { ...RECEIVER_DEFAULTS.blips, ...o.blips } };
};

/** A grain cloud: grains per second, each `len` long, on the chord's tones between `lo` and `hi` (MIDI). */
export interface SleepCloud {
  t: number;
  dur: number;
  rate: number;
  len: number;
  lo: number;
  hi: number;
}
/** The dial: a band of noise sweeping `from`→`to` Hz; `signal`: a tone found half way (MIDI), for `hold` s. */
export interface SleepDial {
  t: number;
  dur: number;
  from: number;
  to: number;
  signal?: number;
  hold: number;
  pan: number;
}
/** A burst of blips: `count` pips from `midi`, gliding `glide` semitones, `gap` s apart, panned across. */
export interface SleepBurst {
  t: number;
  count: number;
  midi: number;
  glide: number;
  gap: number;
  pan: number;
}
export interface ReceiverScore {
  clouds: SleepCloud[];
  dials: SleepDial[];
  bursts: SleepBurst[];
  /** Water drops: time and pitch (Hz). */
  drips: { t: number; hz: number; pan: number }[];
  /** Short chord glows (the chord at `t`, `dur` s). */
  glows: { t: number; dur: number; vel: number }[];
  /** Rare low blooms on the root. */
  blooms: SleepEvent[];
  /** Air breaths: the only time the noise is heard. */
  breaths: { t: number; dur: number; vel: number }[];
  /** The trickle: quiet soft tones every few seconds, so a sparse stretch is never empty. */
  trickle: SleepEvent[];
}

type SceneName = "void" | "emergence" | "float" | "bloom" | "dissolve";
const SCENES: Record<SceneName, { density: [number, number]; brightness: [number, number]; space: [number, number]; next: Partial<Record<SceneName, number>> }> = {
  void: { density: [0.08, 0.22], brightness: [0.08, 0.25], space: [0.75, 0.95], next: { emergence: 3, float: 1 } },
  emergence: { density: [0.25, 0.45], brightness: [0.2, 0.42], space: [0.6, 0.8], next: { float: 3, bloom: 1, void: 0.5 } },
  float: { density: [0.4, 0.6], brightness: [0.3, 0.55], space: [0.5, 0.75], next: { bloom: 2, dissolve: 1.5, emergence: 1 } },
  bloom: { density: [0.62, 0.85], brightness: [0.45, 0.72], space: [0.4, 0.62], next: { dissolve: 2, float: 1.5 } },
  dissolve: { density: [0.18, 0.38], brightness: [0.12, 0.35], space: [0.75, 0.95], next: { void: 2, emergence: 1.5, float: 0.5 } },
};

/** mulberry32: a small seeded generator; one per score, so the score is the seed's alone. */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo: number, hi: number) => lo + (hi - lo) * next(),
    pick<T>(items: readonly T[], weights: readonly number[]): T {
      const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= Math.max(0, weights[i]);
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    },
  };
}
type Rng = ReturnType<typeof rng>;

/** The curve's value at `t` (linear between points, held at the ends). */
export function curveAt(c: readonly Pt[], t: number): number {
  if (!c.length) return 0;
  if (t <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    if (t <= c[i][0]) {
      const [t0, v0] = c[i - 1];
      const [t1, v1] = c[i];
      return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return c[c.length - 1][1];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The score of a piece: everything that will happen, before any sound. */
export function composeSleep(palette: SleepPalette, seed: number, seconds: number): SleepScore {
  const r = rng(seed);

  // Scenes: the piece falls asleep first (void), then walks the scene graph, never twice the same in a row.
  const scenes: SleepScene[] = [];
  let name: SceneName = "void";
  for (let t = 0; t < seconds; ) {
    scenes.push({ t, name });
    t += r.range(110, 280);
    // memory: a scene heard in the last two is a quarter as likely, so the piece goes somewhere
    const options = Object.entries(SCENES[name].next) as [SceneName, number][];
    const lately = scenes.slice(-2).map((x) => x.name);
    name = r.pick(options.map(([n]) => n), options.map(([n, w]) => (lately.includes(n) ? w * 0.25 : w)));
  }

  // Macro curves: each scene's targets, reached over a 30-90 s transition, with a small random walk on top.
  const density: Pt[] = [];
  const brightness: Pt[] = [];
  const space: Pt[] = [];
  const target = (range: [number, number]) => r.range(range[0], range[1]);
  scenes.forEach((s, i) => {
    const end = scenes[i + 1]?.t ?? seconds;
    const ramp = i === 0 ? 0 : Math.min(r.range(30, 90), (end - s.t) * 0.6);
    const sc = SCENES[s.name];
    const dv = target(sc.density);
    const bv = target(sc.brightness);
    const sv = target(sc.space);
    for (const [c, v] of [[density, dv], [brightness, bv], [space, sv]] as const) {
      if (i === 0) c.push([0, v]);
      c.push([s.t + ramp, v]);
      // wander inside the scene: a point every 9-23 s, at most ±0.06 from the target
      let w = v;
      for (let t = s.t + ramp + r.range(9, 23); t < end - 5; t += r.range(9, 23)) {
        w = Math.min(v + 0.06, Math.max(v - 0.06, w + r.range(-0.03, 0.03)));
        c.push([t, clamp01(w)]);
      }
    }
  });
  const noiseWalk: Pt[] = [];
  for (let t = 0, w = 0.4; t <= seconds; t += r.range(5, 13)) {
    w = clamp01(w + r.range(-0.08, 0.08));
    noiseWalk.push([t, w]);
  }

  // Harmony: a walk through the states, 40-180 s each (denser scenes move sooner); the state just left is unlikely.
  const chords: SleepChord[] = [];
  let state = 0;
  let previous = -1;
  for (let t = 0; t < seconds; ) {
    chords.push({ t, state });
    t += r.range(40, 180) * (1.25 - 0.6 * curveAt(density, t));
    // memory: never the same state again (no change is not a change), the one just left rarely
    const weights = palette.moves[state].map((w, j) => (j === state ? 0 : j === previous ? w * 0.2 : w));
    previous = state;
    state = r.pick(palette.states.map((_, j) => j), weights);
  }
  const chordAt = (t: number) => {
    let s = chords[0].state;
    for (const c of chords) if (c.t <= t) s = c.state;
    return palette.states[s];
  };

  // Melody: phrases of the motif, transformed; notes 2-17 s apart, phrases rarer in sparse scenes.
  const notes: SleepNote[] = [];
  const steps = palette.scale.length;
  const midiOfStep = (k: number) => palette.melodyFrom + 12 * Math.floor(k / steps) + palette.scale[((k % steps) + steps) % steps];
  const transforms: ((m: readonly number[]) => number[])[] = [
    (m) => [...m],
    (m) => m.map((x) => m[0] - (x - m[0])), // inversion
    (m) => [...m].reverse(), // retrograde
    (m) => m.map((x, i) => (i === m.length - 1 ? x + steps : x)), // the last note an octave up
    (m) => m.filter((_, i) => i !== 1), // a note left out
    (m) => [...m, m[m.length - 1] + 2], // a note added
    (m) => m.map((x) => x + 2), // up a third
  ];
  let lastTransform = -1;
  let lastMidi = -1;
  const recent: number[] = [];
  for (let t = r.range(20, 50); t < seconds - 10; ) {
    const d = curveAt(density, t);
    if (r.next() < 0.25 + 0.7 * d) {
      let k = Math.floor(r.next() * transforms.length);
      if (k === lastTransform) k = (k + 1) % transforms.length;
      lastTransform = k;
      const phrase = transforms[k](palette.motif);
      let at = t;
      for (const step of phrase) {
        let midi = midiOfStep(step);
        // memory: no note twice in a row, and a note heard in the last few gets moved a step
        if (midi === lastMidi || recent.slice(-4).includes(midi)) midi = midiOfStep(step + (r.next() < 0.5 ? 1 : -1));
        if (midi === lastMidi) midi = midiOfStep(step + 2);
        lastMidi = midi;
        recent.push(midi);
        notes.push({ t: at, midi, dur: r.range(3, 8), vel: r.range(0.55, 1) * (0.6 + 0.4 * d), pan: r.range(-0.6, 0.6) });
        at += r.range(2, 17) * (1.3 - 0.7 * d);
      }
      t = at + r.range(15, 45) * (1.4 - d);
    } else t += r.range(20, 40);
  }

  // Rare events, each with its own clock and cooldown; absence raises the odds.
  const events = (period: [number, number], cooldown: number, odds: (d: number, waited: number) => number, pitch: (t: number) => number, vel: [number, number]) => {
    const out: SleepEvent[] = [];
    let last = -cooldown;
    let lastPitch = -1;
    for (let t = r.range(period[0], period[1]); t < seconds - 8; t += r.range(period[0], period[1])) {
      const waited = t - last;
      if (waited < cooldown) continue;
      if (r.next() < odds(curveAt(density, t), waited)) {
        let midi = pitch(t);
        if (midi === lastPitch) midi = pitch(t + 1) === midi ? midi + 7 : pitch(t + 1);
        lastPitch = midi;
        last = t;
        out.push({ t, midi, vel: r.range(vel[0], vel[1]), pan: r.range(-0.8, 0.8) });
      }
    }
    return out;
  };
  const chordTone = (t: number, lo: number, hi: number) => {
    const tones = chordAt(t);
    for (let tries = 0; tries < 8; tries++) {
      const n = palette.root + tones[Math.floor(r.next() * tones.length)] + 12 * Math.floor(r.range(1, 5));
      if (n >= lo && n <= hi) return n;
    }
    return palette.root + tones[0] + 24;
  };
  const bells = events([9, 17], 40, (d, w) => (0.05 + 0.15 * d) * Math.min(2.5, w / 60), (t) => chordTone(t, 55, 72), [0.4, 0.9]);
  const swells = events([13, 29], 60, (d, w) => (0.06 + 0.12 * d) * Math.min(2, w / 90), (t) => chordTone(t, 50, 67), [0.5, 1]);
  const thumps = events([23, 41], 90, (d, w) => (0.04 + 0.2 * d) * Math.min(2, w / 120), () => palette.root - 12, [0.5, 0.9]);

  const receiver = palette.kind === "receiver" ? composeReceiver(r, palette, seconds, density, brightness, chords) : undefined;
  return { seed, seconds, palette: palette.id, scenes, chords, notes, bells, swells, thumps, density, brightness, space, noiseWalk, ...(receiver ? { receiver } : {}) };
}

/** The receiver's streams, each on its own clock, with memory (registers alternate, cooldowns, absence raises odds). */
function composeReceiver(r: Rng, palette: SleepPalette, seconds: number, density: Pt[], brightness: Pt[], chords: SleepChord[]): ReceiverScore {
  const o = receiverOf(palette);
  const chordAt = (t: number) => {
    let s = chords[0].state;
    for (const c of chords) if (c.t <= t) s = c.state;
    return palette.states[s];
  };
  const tone = (t: number, lo: number, hi: number) => {
    const tones = chordAt(t);
    for (let k = 0; k < 10; k++) {
      const n = palette.root + tones[Math.floor(r.next() * tones.length)] + 12 * Math.floor(r.range(1, 5));
      if (n >= lo && n <= hi) return n;
    }
    return palette.root + tones[0] + 36;
  };

  // Clouds: denser scenes bring them sooner and thicker; a denser cloud has shorter grains (correlated, not random).
  const clouds: SleepCloud[] = [];
  let high = false;
  for (let t = r.range(4, 14); t < seconds - 6; ) {
    const d = curveAt(density, t);
    const b = curveAt(brightness, t);
    const rate = (2 + 16 * d * r.range(0.6, 1.2)) * o.grain.rate;
    high = !high && r.next() < 0.6;
    // airy, not murky: the low cloud starts at C4, the high one at A4
    const lo = high ? o.grain.high : o.grain.low;
    clouds.push({ t, dur: r.range(8, 18), rate, len: Math.max(0.035, 0.3 - 0.012 * rate) * r.range(0.8, 1.25) * o.grain.len, lo, hi: lo + o.grain.span + (o.soft ? 0 : Math.round(10 * b)) });
    // a silence never runs long (the owner: long gaps of nothing)
    t += Math.min(22, r.range(10, 38) * (1.3 - 0.8 * d) * o.cloudGap);
  }

  // The dial: a sweep through the noise every so often; half the time it finds a signal on the chord.
  const dials: SleepDial[] = [];
  let lastDial = -60;
  for (let t = r.range(20, 50); t < seconds - 20; t += r.range(18, 47)) {
    const d = curveAt(density, t);
    if (t - lastDial < 25 || r.next() > (0.35 + 0.4 * d) * o.dial.odds) continue;
    lastDial = t;
    const from = 300 * 2 ** r.range(0, 3);
    dials.push({ t, dur: r.range(6, 18), from, to: from * 2 ** r.range(-1.6, 1.6), ...(r.next() < o.dial.signal ? { signal: tone(t, o.dialSignal[0], o.dialSignal[1]) } : {}), hold: r.range(2, 6), pan: r.range(-0.7, 0.7) });
  }

  // Bursts of blips: a cooldown, odds growing with the wait.
  const bursts: SleepBurst[] = [];
  let lastBurst = -40;
  for (let t = r.range(10, 30); t < seconds - 5; t += r.range(11, 29)) {
    const waited = t - lastBurst;
    if (waited < 15 || r.next() > (0.15 + 0.5 * curveAt(density, t)) * Math.min(2, waited / 40) * o.blips.odds) continue;
    lastBurst = t;
    bursts.push({ t, count: Math.round(r.range(3, 9)), midi: tone(t, o.blips.lo, o.blips.hi), glide: r.range(-o.blips.glide, o.blips.glide), gap: r.range(0.06, 0.2), pan: r.range(-0.9, 0.9) });
  }

  // Drips: a Poisson rain, thicker in denser scenes.
  const drips: ReceiverScore["drips"] = [];
  for (let t = r.range(1, 5); t < seconds - 2; ) {
    const perMin = o.drips[0] + (o.drips[1] - o.drips[0]) * curveAt(density, t);
    t += -Math.log(1 - r.next() * 0.999) * (60 / perMin);
    drips.push({ t, hz: o.dripHz[0] * (o.dripHz[1] / o.dripHz[0]) ** (r.range(0, 1.8) / 1.8), pan: r.range(-0.9, 0.9) });
  }

  // Glows at most chord changes, and now and then between them.
  const glows: ReceiverScore["glows"] = [];
  for (const c of chords) if (r.next() < o.glow) glows.push({ t: c.t + r.range(0, 4), dur: r.range(10, 18), vel: r.range(0.6, 1) });
  for (let t = r.range(30, 70); t < seconds - 20; t += r.range(40, 90)) if (r.next() < 0.4) glows.push({ t, dur: r.range(8, 14), vel: r.range(0.4, 0.8) });
  glows.sort((a, b) => a.t - b.t);

  // Blooms: the low end comes and goes (no held bass).
  const blooms: SleepEvent[] = [];
  let lastBloom = -90;
  for (let t = r.range(15, 40); t < seconds - 16; t += r.range(25, 55)) {
    const waited = t - lastBloom;
    if (waited < 45 || r.next() > (0.2 + 0.5 * curveAt(density, t)) * Math.min(2, waited / 90) * o.bloom) continue;
    lastBloom = t;
    blooms.push({ t, midi: palette.root + chordAt(t)[0], vel: r.range(0.6, 1), pan: 0 });
  }
  // Air: silent except a few breaths, more likely in denser scenes, never two close together.
  const breaths: ReceiverScore["breaths"] = [];
  const gap = 600 / Math.max(0.1, o.breaths);
  for (let t = r.range(30, gap); t < seconds - 25; t += r.range(0.6, 1.4) * gap) {
    if (r.next() < 0.5 + 0.5 * curveAt(density, t)) breaths.push({ t, dur: r.range(8, 20), vel: r.range(0.5, 1) });
  }
  // Trickle: a soft tone of the chord every 1-4 s, louder when the scene is sparse (it fills, never leads).
  const trickle: SleepEvent[] = [];
  let lastTrickle = -1;
  for (let t = r.range(1, 3); t < seconds - 3; t += r.range(...o.trickleGap)) {
    let midi = tone(t, o.trickle[0], o.trickle[1]);
    if (midi === lastTrickle) midi = tone(t, o.trickle[0], o.trickle[1]);
    lastTrickle = midi;
    trickle.push({ t, midi, vel: (1 - 0.6 * curveAt(density, t)) * r.range(0.5, 1), pan: r.range(-0.8, 0.8) });
  }
  return { clouds, dials, bursts, drips, glows, blooms, breaths, trickle };
}

// ------------------------------------------------------------------------------------------------ audio

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Writes a curve onto an AudioParam: `map` turns the curve's 0..1 into the param's unit. */
function automate(p: AudioParam, curve: readonly Pt[], map: (v: number) => number, t0: number, startAt = t0) {
  const first = Math.max(startAt, t0 + curve[0][0]);
  p.setValueAtTime(map(curveAt(curve, first - t0)), first);
  for (const [t, v] of curve) if (t0 + t > first) p.linearRampToValueAtTime(map(v), t0 + t);
}

/** Seeded noise buffers: brown (the wind) and white (the swells' excitation). */
function noiseBuffer(ctx: BaseAudioContext, seconds: number, seed: number, brown: boolean) {
  const r = rng(seed);
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = r.next() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
  }
  return buf;
}

/** A stereo reverb impulse: decaying noise, darker as it fades. */
function reverbImpulse(ctx: BaseAudioContext, seconds: number, seed: number, dark = 0) {
  const r = rng(seed ^ 0x5eed);
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const x = i / n;
      const k = Math.min(0.995, 0.5 + 0.4 * dark + (0.48 - 0.1 * dark) * x); // the tail loses its highs (sooner when dark)
      lp = lp * k + (r.next() * 2 - 1) * (1 - k);
      d[i] = lp * (1 - x) ** 2.2 * 2.2;
    }
  }
  return buf;
}

/**
 * Schedules a score on `ctx` into `out`, from context time `t0` (the score's 0). Offline: the whole piece; live,
 * the same call on a running context (a later version will schedule a window at a time).
 */
/** A piece on an audio context: its output, and the scheduler of its events in a window of score seconds. */
export interface SleepRig {
  output: GainNode;
  /** Schedules the events with a score time in [from, to). Receiver palettes only; the drone palettes schedule all at build. */
  schedule(from: number, to: number): void;
  /**
   * Live only (BuildOptions.live): stops and disconnects the whole graph and lets go of its buffers. Call once the
   * piece is faded out. Without it a piece's graph stays connected and alive after its output is unplugged: the
   * reverb alone (a 6-12 s stereo ConvolverNode) holds ~70-130 MB of native memory in Chromium, so every slot change
   * leaked one (the radio's 768 MB container ran out within a few slots, 2026-11-01). Offline renders: a no-op.
   */
  dispose(): void;
}

/** buildSleep options. */
export interface BuildOptions {
  /**
   * A live player (not an offline render): each event's nodes are disconnected when it ends, and dispose() can tear
   * the piece down. Offline renders leave it off, so their graph (and output) is exactly as before.
   */
  live?: boolean;
}

/** Disconnects without throwing (a node already disconnected, a context already closed). */
function unplug(n: AudioNode) {
  try {
    n.disconnect();
  } catch {
    /* already disconnected */
  }
}

/**
 * Live mode: a view of the context that records every node made through it while `track.on` (the piece's lasting
 * graph), and after that gives every event's source an onended that disconnects it and the nodes made with it (the
 * nodes made since the previous event source, i.e. its envelope, filter and pan), the way engine.ts disposes voices.
 */
function liveContext(ctx: BaseAudioContext) {
  const lasting: AudioNode[] = [];
  const track = { on: true };
  let group: AudioNode[] = [];
  const view = new Proxy(ctx, {
    get(target, prop) {
      const v = Reflect.get(target, prop, target) as unknown;
      if (typeof v !== "function" || typeof prop !== "string" || !prop.startsWith("create")) return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
      return (...args: unknown[]) => {
        const node = (v as (...a: unknown[]) => unknown).apply(target, args);
        if (!node || typeof (node as AudioNode).disconnect !== "function") return node;
        if (track.on) lasting.push(node as AudioNode);
        else group.push(node as AudioNode);
        return node;
      };
    },
  });
  return { view: view as BaseAudioContext, lasting, track, takeGroup: () => { const g = group; group = []; return g; } };
}

/** The whole piece, offline: the graph and every event. */
export function renderSleepScore(ctx: BaseAudioContext, score: SleepScore, palette: SleepPalette, out: AudioNode, t0 = 0) {
  const rig = buildSleep(ctx, score, palette, out, t0);
  rig.schedule(0, score.seconds);
  return rig.output;
}

/**
 * The piece's graph on `ctx` into `out`, its score time 0 at context time `t0` (negative when joining a piece already
 * under way); `startAt` (context time, default t0) is when it starts sounding. Events come from schedule(), a window at
 * a time, so a live player keeps only a few seconds of nodes ahead.
 */
export function buildSleep(ctx: BaseAudioContext, score: SleepScore, palette: SleepPalette, out: AudioNode, t0 = 0, startAt = Math.max(0, t0), opts: BuildOptions = {}): SleepRig {
  if (!opts.live) return buildGraph(ctx, score, palette, out, t0, startAt, null);
  const live = liveContext(ctx);
  const rig = buildGraph(live.view, score, palette, out, t0, startAt, live.takeGroup);
  live.track.on = false;
  let gone = false;
  return {
    output: rig.output,
    schedule(from, to) {
      if (!gone) rig.schedule(from, to);
    },
    dispose() {
      if (gone) return;
      gone = true;
      for (const n of live.lasting) {
        if ("stop" in n && typeof (n as AudioScheduledSourceNode).stop === "function") {
          try {
            (n as AudioScheduledSourceNode).stop();
          } catch {
            /* never started, or already stopped */
          }
        }
        unplug(n);
        if (typeof ConvolverNode !== "undefined" && n instanceof ConvolverNode) n.buffer = null;
      }
      live.lasting.length = 0;
      // events still scheduled ahead: their sources stop with their graph unplugged
      for (const n of live.takeGroup()) unplug(n);
    },
  };
}

/**
 * The graph itself. `takeGroup` (live): the nodes made since the last call, handed to an event source's onended so
 * they are disconnected when it ends; null offline (nothing is disconnected, the render is as before).
 */
function buildGraph(ctx: BaseAudioContext, score: SleepScore, palette: SleepPalette, out: AudioNode, t0: number, startAt: number, takeGroup: (() => AudioNode[]) | null): SleepRig {
  const end = t0 + score.seconds;
  const L = palette.levels;

  // Master: a gentle glue, a ceiling, then the trim.
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = palette.masterHp ?? 28;
  // A slow leveller: long swells are eased down (the owner: a peak that builds and then holds is uncomfortable),
  // single strikes pass.
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -30;
  glue.knee.value = 12;
  glue.ratio.value = 2.5;
  glue.attack.value = 1;
  glue.release.value = 3;
  const ceiling = ctx.createDynamicsCompressor();
  ceiling.threshold.value = -3;
  ceiling.knee.value = 0;
  ceiling.ratio.value = 20;
  ceiling.attack.value = 0.003;
  ceiling.release.value = 0.25;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  if (palette.masterLp) {
    const mlp = ctx.createBiquadFilter();
    mlp.type = "lowpass";
    mlp.frequency.value = palette.masterLp;
    mlp.Q.value = 0.5;
    hp.connect(mlp).connect(glue);
  } else hp.connect(glue);
  glue.connect(ceiling).connect(master).connect(out);

  // Space: a long reverb and a dark feedback delay; the sends follow the space curve.
  const reverb = ctx.createConvolver();
  reverb.buffer = reverbImpulse(ctx, palette.reverb, score.seed, palette.reverbDark ?? 0);
  const reverbIn = ctx.createGain();
  automate(reverbIn.gain, score.space, (v) => 0.25 + 0.75 * v, t0, startAt);
  reverbIn.connect(reverb).connect(hp);
  const delay = ctx.createDelay(4);
  delay.delayTime.value = 0.86;
  const fb = ctx.createGain();
  fb.gain.value = 0.38;
  const delayLp = ctx.createBiquadFilter();
  delayLp.type = "lowpass";
  delayLp.frequency.value = palette.delayLp ?? 1600;
  const delayIn = ctx.createGain();
  automate(delayIn.gain, score.space, (v) => 0.15 + 0.35 * v, t0, startAt);
  delayIn.connect(delay).connect(delayLp).connect(fb).connect(delay);
  delayLp.connect(hp);
  delayLp.connect(reverbIn);

  const bright = (lo: number, hi: number) => (v: number) => lo * (hi / lo) ** v;

  if (palette.kind === "receiver" && score.receiver) {
    return { output: master, schedule: renderReceiver(ctx, score, palette, { hp, reverbIn, delayIn, t0, end, startAt }, takeGroup), dispose() {} };
  }

  // Drone: additive partials of the chord's two lowest tones, each partial breathing on its own slow clock.
  const droneLp = ctx.createBiquadFilter();
  droneLp.type = "lowpass";
  automate(droneLp.frequency, score.brightness, bright(260, 1400), t0, startAt);
  const droneOut = ctx.createGain();
  droneOut.gain.value = L.drone * 0.07;
  droneLp.connect(droneOut).connect(hp);
  droneOut.connect(reverbIn);
  const partials: [number, number][] = [[1, 1], [2.004, 0.42], [2.997, 0.22], [4.012, 0.11], [5.02, 0.06]];
  const periods = [17, 29, 43, 71, 113];
  score.chords.forEach((c, i) => {
    const from = t0 + c.t;
    const to = Math.min(end, t0 + (score.chords[i + 1]?.t ?? score.seconds) + 14);
    const tones = palette.states[c.state].slice(0, 2);
    tones.forEach((semi, v) => {
      const f = hz(palette.root + 12 + semi);
      partials.forEach(([ratio, level], k) => {
        const o = ctx.createOscillator();
        o.frequency.value = f * ratio;
        o.detune.value = (k % 2 ? 1 : -1) * (2 + k);
        const g = ctx.createGain();
        const peak = level * (v === 0 ? 1 : 0.6);
        g.gain.setValueAtTime(0, from);
        g.gain.linearRampToValueAtTime(peak, from + 12);
        g.gain.setValueAtTime(peak, Math.max(from + 12, to - 14));
        g.gain.linearRampToValueAtTime(0, to);
        // The breath sits on its own stage, before the envelope: the envelope still ends at exactly 0 (no click).
        const breath = ctx.createGain();
        breath.gain.value = 0.7;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 1 / periods[(k + v + i) % periods.length];
        const depth = ctx.createGain();
        depth.gain.value = 0.3;
        lfo.connect(depth).connect(breath.gain);
        o.connect(breath).connect(g).connect(droneLp);
        o.start(from);
        lfo.start(from);
        o.stop(to);
        lfo.stop(to);
      });
    });
  });

  // Pad: the chord in an open voicing, two detuned voices per tone, slow in and out; louder as the scene fills.
  const padLp = ctx.createBiquadFilter();
  padLp.type = "lowpass";
  padLp.Q.value = 0.4;
  automate(padLp.frequency, score.brightness, bright(palette.pad.cutoff[0], palette.pad.cutoff[1]), t0, startAt);
  const padOut = ctx.createGain();
  automate(padOut.gain, score.density, (v) => L.pad * (0.052 + 0.125 * v), t0, startAt);
  padLp.connect(padOut).connect(hp);
  padOut.connect(reverbIn);
  score.chords.forEach((c, i) => {
    const from = t0 + c.t;
    const to = Math.min(end, t0 + (score.chords[i + 1]?.t ?? score.seconds) + 10);
    palette.states[c.state].forEach((semi, v) => {
      const midi = palette.root + 24 + semi + (v >= 2 ? 12 : 0);
      const pan = ctx.createStereoPanner();
      pan.pan.value = (v % 2 ? 1 : -1) * 0.35;
      pan.connect(padLp);
      for (const det of [-5, 5]) {
        const o = ctx.createOscillator();
        o.type = palette.pad.wave;
        o.frequency.value = hz(midi);
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, from);
        g.gain.linearRampToValueAtTime(0.5, from + 9);
        g.gain.setValueAtTime(0.5, Math.max(from + 9, to - 10));
        g.gain.linearRampToValueAtTime(0, to);
        o.connect(g).connect(pan);
        o.start(from);
        o.stop(to);
      }
    });
  });

  // Bass: one sine on the chord's root, centred; it owns the sub.
  const bassLp = ctx.createBiquadFilter();
  bassLp.type = "lowpass";
  bassLp.frequency.value = 160;
  const bassOut = ctx.createGain();
  automate(bassOut.gain, score.density, (v) => L.bass * (0.075 + 0.037 * v), t0, startAt);
  bassLp.connect(bassOut).connect(hp);
  score.chords.forEach((c, i) => {
    const from = t0 + c.t;
    const to = Math.min(end, t0 + (score.chords[i + 1]?.t ?? score.seconds) + 6);
    const o = ctx.createOscillator();
    o.frequency.value = hz(palette.root + palette.states[c.state][0]);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, from);
    g.gain.linearRampToValueAtTime(1, from + 6);
    g.gain.setValueAtTime(1, Math.max(from + 6, to - 6));
    g.gain.linearRampToValueAtTime(0, to);
    o.connect(g).connect(bassLp);
    o.start(from);
    o.stop(to);
  });

  // Melody: a soft FM voice, brighter (more index) as the scene brightens, into the delay and the room.
  const melOut = ctx.createGain();
  melOut.gain.value = L.melody * 0.36;
  const melLp = ctx.createBiquadFilter();
  melLp.type = "lowpass";
  automate(melLp.frequency, score.brightness, bright(700, 3200), t0, startAt);
  melOut.connect(melLp).connect(hp);
  melLp.connect(delayIn);
  melLp.connect(reverbIn);
  for (const n of score.notes) {
    const at = t0 + n.t;
    const stop = at + n.dur + 0.5;
    if (stop > end) continue;
    const f = hz(n.midi);
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(n.vel, at + 0.12);
    env.gain.exponentialRampToValueAtTime(0.0008, at + n.dur);
    if (palette.fm.index > 0) {
      const mod = ctx.createOscillator();
      mod.frequency.value = f * palette.fm.ratio;
      const idx = ctx.createGain();
      const peak = f * palette.fm.index * (0.3 + 0.7 * curveAt(score.brightness, n.t));
      idx.gain.setValueAtTime(peak, at);
      idx.gain.exponentialRampToValueAtTime(Math.max(1, peak * 0.05), at + 1.4);
      mod.connect(idx).connect(car.frequency);
      mod.start(at);
      mod.stop(stop);
    }
    const pan = ctx.createStereoPanner();
    pan.pan.value = n.pan;
    car.connect(env).connect(pan).connect(melOut);
    car.start(at);
    car.stop(stop);
  }

  // Bells: rare, low and soft (the owner dislikes ringing glass), mostly in the room.
  const bellOut = ctx.createGain();
  bellOut.gain.value = L.bell * 0.2;
  const bellLp = ctx.createBiquadFilter();
  bellLp.type = "lowpass";
  bellLp.frequency.value = 1500;
  bellOut.connect(bellLp);
  bellLp.connect(hp);
  bellLp.connect(reverbIn);
  bellLp.connect(delayIn);
  for (const b of score.bells) {
    const at = t0 + b.t;
    const pan = ctx.createStereoPanner();
    pan.pan.value = b.pan;
    pan.connect(bellOut);
    // Soft mallets, not glass: two partials, a 25 ms strike, nothing above ~1.5 kHz.
    for (const [ratio, level, decay] of [[1, 1, 7], [2.76, 0.22, 2.5]] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = hz(b.midi) * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(b.vel * level, at + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0005, at + decay);
      o.connect(g).connect(pan);
      o.start(at);
      o.stop(at + decay + 0.1);
    }
  }

  // Swells: white noise through a bank of narrow filters on the chord's tones, slow in and out.
  const white = noiseBuffer(ctx, 4, score.seed ^ 0x77, false);
  const swellOut = ctx.createGain();
  swellOut.gain.value = L.swell * 1.38;
  swellOut.connect(reverbIn);
  swellOut.connect(hp);
  for (const s of score.swells) {
    const at = t0 + s.t;
    const src = ctx.createBufferSource();
    src.buffer = white;
    src.loop = true;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(s.vel, at + 4);
    env.gain.linearRampToValueAtTime(0, at + 11);
    const pan = ctx.createStereoPanner();
    pan.pan.value = s.pan * 0.6;
    env.connect(pan).connect(swellOut);
    const tones = [0, 7, 12].map((x) => s.midi + x);
    for (const m of tones) {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = hz(m);
      bp.Q.value = 40;
      src.connect(bp).connect(env);
    }
    src.start(at);
    src.stop(at + 11.5);
  }

  // Thumps: a soft low drop, far away.
  const thumpOut = ctx.createGain();
  thumpOut.gain.value = L.thump * 0.24;
  thumpOut.connect(hp);
  thumpOut.connect(reverbIn);
  for (const s of score.thumps) {
    const at = t0 + s.t;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(hz(s.midi) * 1.6, at);
    o.frequency.exponentialRampToValueAtTime(hz(s.midi), at + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(s.vel, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0005, at + 3);
    o.connect(g).connect(thumpOut);
    o.start(at);
    o.stop(at + 3.2);
  }

  // Noise texture: brown noise, its filter on its own slow walk, louder as the scene fills.
  const brown = ctx.createBufferSource();
  brown.buffer = noiseBuffer(ctx, 23, score.seed ^ 0x99, true);
  brown.loop = true;
  const nLp = ctx.createBiquadFilter();
  nLp.type = "lowpass";
  automate(nLp.frequency, score.noiseWalk, bright(palette.noise.cutoff[0], palette.noise.cutoff[1]), t0, startAt);
  const nOut = ctx.createGain();
  automate(nOut.gain, score.density, (v) => L.noise * (0.105 + 0.17 * v), t0, startAt);
  // Air, not rumble: the bass and the drone own the lows.
  const nHp = ctx.createBiquadFilter();
  nHp.type = "highpass";
  nHp.frequency.value = 140;
  brown.connect(nHp).connect(nLp).connect(nOut).connect(hp);
  brown.start(t0);
  brown.stop(end);

  return { output: master, schedule: () => {}, dispose() {} };
}

/** The receiver's layers (SleepPalette.kind "receiver"): nothing held, everything arrives and leaves. */
function renderReceiver(ctx: BaseAudioContext, score: SleepScore, palette: SleepPalette, bus: { hp: AudioNode; reverbIn: AudioNode; delayIn: AudioNode; t0: number; end: number; startAt: number }, takeGroup: (() => AudioNode[]) | null) {
  const { hp, reverbIn, delayIn, t0, end, startAt } = bus;
  /** Live: the event's nodes (made since the last event) are disconnected once all its sources have ended. */
  const reap = (...sources: AudioScheduledSourceNode[]) => {
    if (!takeGroup) return;
    const group = takeGroup();
    let left = sources.length;
    for (const src of sources) {
      src.onended = () => {
        if (--left === 0) for (const n of group) unplug(n);
      };
    }
  };
  /** Event writers, each scheduling its events with a score time in [from, to). */
  const jobs: ((from: number, to: number) => void)[] = [];
  const inWin = (t: number, from: number, to: number) => t >= from && t < to && t0 + t >= startAt;
  const rec = score.receiver!;
  const opt = receiverOf(palette);
  const L = palette.levels;
  const bright = (lo: number, hi: number) => (v: number) => lo * (hi / lo) ** v;
  // Soft voicing: a level that falls with pitch above 300 Hz (18 dB an octave), so no mid tone stands out over the body.
  const tilt = (f: number) => (opt.soft && f > 300 ? (300 / f) ** 3 : 1);
  const chordAt = (t: number) => {
    let st = score.chords[0].state;
    for (const c of score.chords) if (c.t <= t) st = c.state;
    return palette.states[st];
  };
  const out = (gain: number, dry: number, wet: number, echo = 0) => {
    const g = ctx.createGain();
    g.gain.value = gain;
    const d = ctx.createGain();
    d.gain.value = dry;
    g.connect(d).connect(hp);
    const w = ctx.createGain();
    w.gain.value = wet;
    g.connect(w).connect(reverbIn);
    if (echo) {
      const e = ctx.createGain();
      e.gain.value = echo;
      g.connect(e).connect(delayIn);
    }
    return g;
  };

  // Clouds: sine grains with a soft hump of an envelope, each on a tone of the chord, each panned on its own.
  const cloudLp = ctx.createBiquadFilter();
  cloudLp.type = "lowpass";
  automate(cloudLp.frequency, score.brightness, bright(...(opt.grain.cutoff ?? [1600, 4800])), t0, startAt);
  cloudLp.connect(out(L.drone * 2.6, 0.6, 0.6, 0.2));
  jobs.push((from, to) => rec.clouds.forEach((c, ci) => {
    if (c.t >= to || c.t + c.dur + 2 < from) return;
    const g = rng((score.seed ^ 0xc10d) + ci * 7919);
    for (let t = c.t; t < c.t + c.dur && t0 + t < end - 1; t += -Math.log(1 - g.next() * 0.999) / c.rate) {
      const tones = chordAt(t);
      let midi = palette.root + tones[Math.floor(g.next() * tones.length)];
      while (midi < c.lo) midi += 12;
      while (midi > c.hi) midi -= 12;
      if (midi < c.lo) continue;
      // spread the energy: now and then an octave up, so it does not pile up on the same few notes (a resonance)
      if (g.next() < 0.2 && midi + 12 <= c.hi + (opt.soft ? 0 : 7)) midi += 12;
      // the cloud swells in and out over its life; a denser cloud is thicker, not louder (amplitude ~ 1/sqrt(rate))
      const life = (t - c.t) / c.dur;
      const amp = 0.12 * Math.sin(Math.PI * life) ** 1.4 * g.range(0.4, 1) * Math.min(1.2, Math.sqrt(4 / c.rate)) * tilt(hz(midi));
      const at = t0 + t;
      const len = c.len * g.range(0.7, 1.4);
      const detune = g.range(-16, 16);
      const fmRatio = opt.grain.fm > 0 ? (g.next() < 0.5 ? 2 : 3) : 0;
      const panAt = g.range(-1, 1);
      if (!inWin(t, from, to)) continue;
      const o = ctx.createOscillator();
      o.type = opt.grain.wave;
      o.frequency.value = hz(midi);
      o.detune.value = detune;
      if (opt.grain.fm > 0) {
        const m = ctx.createOscillator();
        m.frequency.value = hz(midi) * fmRatio;
        const mi = ctx.createGain();
        mi.gain.value = hz(midi) * opt.grain.fm;
        m.connect(mi).connect(o.frequency);
        m.start(at);
        m.stop(at + len + 0.01);
      }
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(amp, at + len * (opt.grain.attack ?? 0.45));
      env.gain.linearRampToValueAtTime(0, at + len);
      const pan = ctx.createStereoPanner();
      pan.pan.value = panAt;
      o.connect(env).connect(pan).connect(cloudLp);
      o.start(at);
      o.stop(at + len + 0.01);
      reap(o);
    }
  }));

  // The dial: a narrow band of noise sweeping, fluttering; a found signal rises out of it and sinks back.
  const white = noiseBuffer(ctx, 3, score.seed ^ 0xd1a1, false);
  const dialOut = out(L.swell * 0.2, 0.6, 0.6, 0.2);
  jobs.push((from, to) => {
  for (const d of rec.dials) {
    if (!inWin(d.t, from, to)) continue;
    const at = t0 + d.t;
    if (at + d.dur > end) continue;
    const src = ctx.createBufferSource();
    src.buffer = white;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = opt.dial.q;
    bp.frequency.setValueAtTime(d.from, at);
    bp.frequency.exponentialRampToValueAtTime(d.to, at + d.dur);
    const flutter = ctx.createGain();
    flutter.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = opt.dial.flutter + (d.from % 5);
    const depth = ctx.createGain();
    depth.gain.value = 0.4;
    lfo.connect(depth).connect(flutter.gain);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.35, at + 2);
    env.gain.setValueAtTime(0.35, at + d.dur - 3);
    env.gain.linearRampToValueAtTime(0, at + d.dur);
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(d.pan, at);
    pan.pan.linearRampToValueAtTime(-d.pan * 0.5, at + d.dur);
    src.connect(bp).connect(flutter).connect(env).connect(pan).connect(dialOut);
    src.start(at);
    lfo.start(at);
    src.stop(at + d.dur + 0.05);
    lfo.stop(at + d.dur + 0.05);
    if (d.signal !== undefined) {
      // the station: a tone with a slow wobble, through a radio band, fading in and out mid-sweep
      const s0 = at + d.dur * 0.35;
      const sig = ctx.createOscillator();
      sig.type = opt.dial.wave;
      sig.frequency.value = hz(d.signal);
      const vib = ctx.createOscillator();
      vib.frequency.value = 5.3;
      const vd = ctx.createGain();
      vd.gain.value = hz(d.signal) * 0.004;
      vib.connect(vd).connect(sig.frequency);
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 1100;
      band.Q.value = 0.9;
      const se = ctx.createGain();
      const sv = opt.soft ? 0.06 * tilt(hz(d.signal)) : 0.5;
      se.gain.setValueAtTime(0, s0);
      se.gain.linearRampToValueAtTime(sv, s0 + 1.2);
      if (opt.soft) {
        // it fades in and out of reach, never a held tone
        se.gain.linearRampToValueAtTime(sv * 0.3, s0 + 1.2 + (d.hold - 1.2) / 2);
        se.gain.linearRampToValueAtTime(sv, s0 + d.hold);
      } else se.gain.setValueAtTime(sv, s0 + d.hold);
      se.gain.linearRampToValueAtTime(0, s0 + d.hold + 1.5);
      sig.connect(band).connect(se).connect(pan);
      sig.start(s0);
      vib.start(s0);
      sig.stop(s0 + d.hold + 1.6);
      vib.stop(s0 + d.hold + 1.6);
      reap(src, lfo, sig, vib);
    } else reap(src, lfo);
  }
  });


  // Blips: short sine pips gliding, a little line of them across the field.
  const blipOut = out(L.bell * 1.25, 0.5, 0.7, 0.5);
  jobs.push((from, to) => {
  for (const b of rec.bursts) {
    if (!inWin(b.t, from, to)) continue;
    for (let k = 0; k < b.count; k++) {
      const at = t0 + b.t + k * b.gap;
      if (at > end - 1) break;
      const f0 = hz(b.midi + (k % 3) * 2);
      const len = 0.045 + 0.02 * (k % 2);
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(f0 * 2 ** (b.glide / 12), at + len);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(0.5 * (1 - k / (b.count + 2)) * tilt(f0), at + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0005, at + len + 0.08);
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, b.pan + (k / Math.max(1, b.count - 1) - 0.5) * 0.8 * -Math.sign(b.pan || 1)));
      o.connect(env).connect(pan).connect(blipOut);
      o.start(at);
      o.stop(at + len + 0.1);
      reap(o);
    }
  }
  });


  // Drips: a quick rising sine, the way a drop sounds, mostly in the room.
  const dripOut = out(L.noise * 0.16, 0.35, 0.9);
  jobs.push((from, to) => {
  for (const d of rec.drips) {
    if (!inWin(d.t, from, to)) continue;
    const at = t0 + d.t;
    if (at > end - 1) continue;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(d.hz, at);
    o.frequency.exponentialRampToValueAtTime(d.hz * 1.7, at + 0.03);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.4 * tilt(d.hz), at + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0005, at + 0.09);
    const pan = ctx.createStereoPanner();
    pan.pan.value = d.pan;
    o.connect(env).connect(pan).connect(dripOut);
    o.start(at);
    o.stop(at + 0.12);
    reap(o);
  }
  });


  // Glows: the chord as soft sine pairs, a slow breath in and out (seconds, not minutes: nothing is held).
  const glowLp = ctx.createBiquadFilter();
  glowLp.type = "lowpass";
  automate(glowLp.frequency, score.brightness, bright(600, 2200), t0, startAt);
  glowLp.connect(out(L.pad * 0.1, 0.6, 0.8, 0.15));
  jobs.push((from, to) => {
  for (const gl of rec.glows) {
    if (!inWin(gl.t, from, to)) continue;
    const at = t0 + gl.t;
    if (at + gl.dur > end) continue;
    chordAt(gl.t).forEach((semi, v) => {
      let midi = palette.root + (opt.soft ? 12 : 24) + semi + (v >= 2 ? 12 : 0);
      if (opt.glowMax !== undefined) while (midi > opt.glowMax) midi -= 12;
      if (opt.soft) {
        // one lowpassed triangle per tone (a few weak partials), its level moving slowly and deeply
        const f = hz(midi);
        const o = ctx.createOscillator();
        o.type = "triangle";
        o.frequency.value = f;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = Math.min(1.15 * f, 700);
        lp.Q.value = 0.5;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, at);
        env.gain.linearRampToValueAtTime(gl.vel * tilt(f), at + gl.dur * 0.35);
        env.gain.linearRampToValueAtTime(0, at + gl.dur);
        const move = ctx.createGain();
        move.gain.value = 0.6;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.11 + 0.05 * v;
        const depth = ctx.createGain();
        depth.gain.value = 0.4;
        lfo.connect(depth).connect(move.gain);
        const pan = ctx.createStereoPanner();
        pan.pan.value = (v % 2 ? 1 : -1) * 0.4;
        o.connect(lp).connect(env).connect(move).connect(pan).connect(glowLp);
        o.start(at);
        lfo.start(at);
        o.stop(at + gl.dur + 0.05);
        lfo.stop(at + gl.dur + 0.05);
        reap(o, lfo);
        return;
      }
      for (const det of [-opt.glowDetune, opt.glowDetune]) {
        const o = ctx.createOscillator();
        o.frequency.value = hz(midi);
        o.detune.value = det;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, at);
        env.gain.linearRampToValueAtTime(gl.vel * 0.5, at + gl.dur * 0.35);
        env.gain.linearRampToValueAtTime(0, at + gl.dur);
        const pan = ctx.createStereoPanner();
        pan.pan.value = (v % 2 ? 1 : -1) * 0.5 * (det > 0 ? 1 : 0.6);
        o.connect(env).connect(pan).connect(glowLp);
        o.start(at);
        o.stop(at + gl.dur + 0.05);
        reap(o);
      }
    });
  }
  });


  // Blooms: the root and its fifth swell up from below and leave.
  const bloomLp = ctx.createBiquadFilter();
  bloomLp.type = "lowpass";
  bloomLp.frequency.value = 220;
  bloomLp.connect(out(L.bass * 0.09, 1, 0.25));
  jobs.push((from, to) => {
  for (const b of rec.blooms) {
    if (!inWin(b.t, from, to)) continue;
    const at = t0 + b.t;
    if (at + 16 > end) continue;
    for (const [semi, lvl] of [[0, 1], [7, 0.45], [12, 0.25]] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = hz(b.midi + semi);
      let vib: OscillatorNode | null = null;
      if (opt.soft) {
        // a slow drift of ~20 cents smears the line (one voice, no beating)
        vib = ctx.createOscillator();
        vib.frequency.value = 0.07;
        const vd = ctx.createGain();
        vd.gain.value = hz(b.midi + semi) * 0.012;
        vib.connect(vd).connect(o.frequency);
        vib.start(at);
        vib.stop(at + 15.1);
      }
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(b.vel * lvl * (opt.soft ? 0.15 : 1), at + 5);
      env.gain.linearRampToValueAtTime(0, at + 15);
      o.connect(env).connect(bloomLp);
      o.start(at);
      o.stop(at + 15.1);
      if (vib) reap(o, vib);
      else reap(o);
    }
  }
  });


  // Tones: the sparse melody as soft sines, no strike, into the echo.
  const toneOut = out(L.melody * 0.43, 0.6, 0.7, 0.45);
  jobs.push((from, to) => {
  for (const n of score.notes) {
    if (!inWin(n.t, from, to)) continue;
    const at = t0 + n.t;
    if (at + n.dur + 0.3 > end) continue;
    const o = ctx.createOscillator();
    o.frequency.value = hz(n.midi);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(n.vel * 0.6 * tilt(hz(n.midi)) * (opt.soft ? 0.25 : 1), at + 0.35);
    env.gain.exponentialRampToValueAtTime(0.0005, at + n.dur);
    const pan = ctx.createStereoPanner();
    pan.pan.value = n.pan;
    o.connect(env).connect(pan).connect(toneOut);
    o.start(at);
    o.stop(at + n.dur + 0.1);
    reap(o);
  }
  });


  // Trickle: soft sine tones with a slow attack, far in the room, so no stretch is empty.
  const trickleOut = out(L.melody * 0.12, 0.5, 0.8, 0.3);
  jobs.push((from, to) => {
  for (const n of rec.trickle) {
    if (!inWin(n.t, from, to)) continue;
    const at = t0 + n.t;
    if (at + 2 > end) continue;
    const len = 0.6 + (n.midi % 5) * 0.2;
    const o = ctx.createOscillator();
    o.frequency.value = hz(n.midi);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(n.vel * 0.5 * tilt(hz(n.midi)), at + 0.15);
    env.gain.exponentialRampToValueAtTime(0.0005, at + len);
    const pan = ctx.createStereoPanner();
    pan.pan.value = n.pan;
    o.connect(env).connect(pan).connect(trickleOut);
    o.start(at);
    o.stop(at + len + 0.05);
    reap(o);
  }
  });


  // Air: silent but for a few breaths (the owner: a noise bed reads as a blanket over everything), its band on a slow walk.
  const air = ctx.createBufferSource();
  air.buffer = noiseBuffer(ctx, 19, score.seed ^ 0xa1a1, true);
  air.loop = true;
  const aHp = ctx.createBiquadFilter();
  aHp.type = "highpass";
  aHp.frequency.value = 380;
  const aLp = ctx.createBiquadFilter();
  aLp.type = "lowpass";
  automate(aLp.frequency, score.noiseWalk, bright(palette.noise.cutoff[0], palette.noise.cutoff[1]), t0, startAt);
  const aOut = ctx.createGain();
  aOut.gain.value = 0;
  for (const b of rec.breaths) {
    const at = t0 + b.t;
    if (at + b.dur > end || at < startAt) continue;
    const peak = L.noise * 0.22 * b.vel;
    aOut.gain.setValueAtTime(0, at);
    aOut.gain.linearRampToValueAtTime(peak, at + b.dur * 0.4);
    aOut.gain.linearRampToValueAtTime(0, at + b.dur);
  }
  air.connect(aHp).connect(aLp).connect(aOut).connect(hp);
  aOut.connect(reverbIn);
  air.start(Math.max(t0, startAt));
  air.stop(end);
  return (from: number, to: number) => {
    for (const job of jobs) job(from, to);
  };
}

/**
 * Stations whose sleep mode is a composer piece instead of the sleep pack's styles: the sleep pack's key → the
 * palettes it rotates through, one per SLEEP_SLOT_SEC slot (the hamster: the owner's Receiver set, 2026-10-31).
 */
export const SLEEP_COMPOSERS: Readonly<Record<string, readonly string[]>> = {
  "hamster-sleep": ["receiver-darkwarm", "organic", "psycho", "night"],
};

/** The genre a composer station shows while it dreams (its palettes are the styles). */
export const SLEEP_COMPOSER_GENRES: Readonly<Record<string, string>> = {
  "hamster-sleep": "Dream Receiver",
};

/**
 * A slot's palette: the palettes play in seeded shuffled cycles (each once per cycle), and a cycle never opens with
 * the palette the one before closed on, so no palette plays twice in a row. Null for a station without a composer.
 */
export function composerPalette(sleepKey: string, slot: number): SleepPalette | null {
  const ids = SLEEP_COMPOSERS[sleepKey];
  if (!ids?.length) return null;
  const n = ids.length;
  const cycle = (c: number) => {
    const r = rng(Math.imul(c, 2654435761) >>> 0);
    const order = ids.map((_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(r.next() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  };
  const c = Math.floor(slot / n);
  const order = cycle(c);
  // Only the first two swap, so a cycle's last stays put for the next cycle's check (with 2 palettes: alternate).
  if (n > 2 && order[0] === cycle(c - 1)[n - 1]) [order[0], order[1]] = [order[1], order[0]];
  const i = n === 2 ? slot % 2 : order[slot - c * n];
  return SLEEP_PALETTES[ids[i]] ?? null;
}

/** Prototype palettes: a dark burrow, a moonlit cage, a warm tape dream; and the receiver. */
export const SLEEP_PALETTES: Record<string, SleepPalette> = {
  burrow: {
    id: "burrow",
    name: "Burrow",
    root: 38, // D2
    scale: [0, 2, 3, 5, 7, 9, 10], // Dorian
    states: [[0, 7, 15, 22], [-2, 5, 12, 19], [3, 10, 17, 22], [5, 12, 15, 21], [-4, 3, 10, 17]],
    moves: [[0.3, 0.3, 0.2, 0.1, 0.1], [0.4, 0.2, 0.2, 0.1, 0.1], [0.3, 0.2, 0.2, 0.2, 0.1], [0.4, 0.1, 0.2, 0.2, 0.1], [0.5, 0.2, 0.1, 0.1, 0.1]],
    motif: [0, 2, 4],
    melodyFrom: 57,
    fm: { ratio: 2, index: 0.6 },
    levels: { drone: 1, pad: 0.8, bass: 1, melody: 0.7, bell: 0.5, swell: 0.7, thump: 0.8, noise: 0.9 },
    pad: { wave: "triangle", cutoff: [280, 1400] },
    noise: { cutoff: [150, 700] },
    reverb: 9,
  },
  moon: {
    id: "moon",
    name: "Moon Over the Cage",
    root: 41, // F2
    scale: [0, 2, 4, 6, 7, 9, 11], // Lydian
    states: [[0, 7, 16, 23], [2, 9, 14, 21], [-1, 7, 14, 19], [4, 11, 16, 19], [-3, 4, 11, 16]],
    moves: [[0.2, 0.3, 0.2, 0.2, 0.1], [0.4, 0.1, 0.2, 0.2, 0.1], [0.4, 0.2, 0.1, 0.2, 0.1], [0.3, 0.2, 0.2, 0.1, 0.2], [0.5, 0.2, 0.1, 0.1, 0.1]],
    motif: [4, 3, 1, 2],
    melodyFrom: 60,
    fm: { ratio: 1, index: 0.25 },
    levels: { drone: 0.9, pad: 1, bass: 0.9, melody: 0.8, bell: 0.6, swell: 0.6, thump: 0.5, noise: 0.6 },
    pad: { wave: "sine", cutoff: [400, 2000] },
    noise: { cutoff: [300, 1600] },
    reverb: 12,
  },
  receiver: {
    id: "receiver",
    name: "World Receiver",
    kind: "receiver",
    root: 40, // E2
    scale: [0, 2, 3, 7, 9, 10], // a minor pentatonic with the sixth
    states: [[0, 7, 10, 14], [-2, 5, 9, 14], [3, 10, 14, 17], [5, 12, 15, 19], [-4, 3, 10, 15]],
    moves: [[0.2, 0.3, 0.2, 0.2, 0.1], [0.4, 0.1, 0.2, 0.2, 0.1], [0.3, 0.2, 0.1, 0.3, 0.1], [0.3, 0.2, 0.3, 0.1, 0.1], [0.5, 0.2, 0.1, 0.1, 0.1]],
    motif: [0, 2, 3, 5],
    melodyFrom: 64,
    fm: { ratio: 1, index: 0 },
    levels: { drone: 0.7, pad: 1, bass: 1, melody: 1, bell: 1, swell: 1, thump: 0, noise: 1 },
    pad: { wave: "sine", cutoff: [600, 2200] },
    noise: { cutoff: [800, 3000] },
    reverb: 7,
  },
  "receiver-soft": {
    id: "receiver-soft",
    name: "World Receiver (soft)",
    kind: "receiver",
    // the same piece, its clouds rounder (slower grain attack) and darker (a lower filter ceiling)
    receiver: { grain: { wave: "sine", fm: 0, low: 60, high: 69, span: 12, len: 1, rate: 1, cutoff: [1100, 2800], attack: 0.62 } },
    root: 40, // E2
    scale: [0, 2, 3, 7, 9, 10], // a minor pentatonic with the sixth
    states: [[0, 7, 10, 14], [-2, 5, 9, 14], [3, 10, 14, 17], [5, 12, 15, 19], [-4, 3, 10, 15]],
    moves: [[0.2, 0.3, 0.2, 0.2, 0.1], [0.4, 0.1, 0.2, 0.2, 0.1], [0.3, 0.2, 0.1, 0.3, 0.1], [0.3, 0.2, 0.3, 0.1, 0.1], [0.5, 0.2, 0.1, 0.1, 0.1]],
    motif: [0, 2, 3, 5],
    melodyFrom: 64,
    fm: { ratio: 1, index: 0 },
    levels: { drone: 0.7, pad: 1, bass: 1, melody: 1, bell: 1, swell: 1, thump: 0, noise: 1 },
    pad: { wave: "sine", cutoff: [600, 2200] },
    noise: { cutoff: [800, 3000] },
    reverb: 7,
  },
  "receiver-dark": {
    id: "receiver-dark",
    name: "World Receiver · darker",
    kind: "receiver",
    // everything a step lower: clouds, drips, blips and the trickle down; the dial's signal a pure sine; glows without beating
    receiver: { grain: { wave: "sine", fm: 0, low: 55, high: 62, span: 12, len: 1, rate: 1, cutoff: [1200, 3200] }, blips: { odds: 1, glide: 4, lo: 60, hi: 74 }, dripHz: [400, 1100], trickle: [55, 72], dial: { odds: 1, signal: 0.5, q: 14, flutter: 4, wave: "sine" }, glowDetune: 0 },
    root: 40, // E2
    scale: [0, 2, 3, 7, 9, 10], // a minor pentatonic with the sixth
    states: [[0, 7, 10, 14], [-2, 5, 9, 14], [3, 10, 14, 17], [5, 12, 15, 19], [-4, 3, 10, 15]],
    moves: [[0.2, 0.3, 0.2, 0.2, 0.1], [0.4, 0.1, 0.2, 0.2, 0.1], [0.3, 0.2, 0.1, 0.3, 0.1], [0.3, 0.2, 0.3, 0.1, 0.1], [0.5, 0.2, 0.1, 0.1, 0.1]],
    motif: [0, 2, 3, 5],
    melodyFrom: 64,
    fm: { ratio: 1, index: 0 },
    levels: { drone: 0.7, pad: 1, bass: 1, melody: 1, bell: 1, swell: 1, thump: 0, noise: 1 },
    pad: { wave: "sine", cutoff: [600, 2200] },
    noise: { cutoff: [800, 3000] },
    reverb: 7,
  },
  "receiver-warm": {
    id: "receiver-warm",
    name: "World Receiver · warmer",
    kind: "receiver",
    // the same register under a warm lowpass on the whole piece; longer, rounder grains; glows barely detuned
    receiver: { grain: { wave: "sine", fm: 0, low: 60, high: 69, span: 12, len: 1.6, rate: 1, attack: 0.6 }, dial: { odds: 1, signal: 0.5, q: 14, flutter: 4, wave: "sine" }, glowDetune: 2 },
    root: 40, // E2
    scale: [0, 2, 3, 7, 9, 10], // a minor pentatonic with the sixth
    states: [[0, 7, 10, 14], [-2, 5, 9, 14], [3, 10, 14, 17], [5, 12, 15, 19], [-4, 3, 10, 15]],
    moves: [[0.2, 0.3, 0.2, 0.2, 0.1], [0.4, 0.1, 0.2, 0.2, 0.1], [0.3, 0.2, 0.1, 0.3, 0.1], [0.3, 0.2, 0.3, 0.1, 0.1], [0.5, 0.2, 0.1, 0.1, 0.1]],
    motif: [0, 2, 3, 5],
    melodyFrom: 64,
    fm: { ratio: 1, index: 0 },
    levels: { drone: 0.7, pad: 1, bass: 1, melody: 1, bell: 1, swell: 1, thump: 0, noise: 1 },
    pad: { wave: "sine", cutoff: [600, 2200] },
    noise: { cutoff: [800, 3000] },
    reverb: 7,
    masterLp: 2500,
  },
  "receiver-simple": {
    id: "receiver-simple",
    name: "World Receiver · simpler",
    kind: "receiver",
    // no small high events (no blips, no drips); fewer, softer clouds; a dark room and echo: soft clouds, glows and the low end
    receiver: { grain: { wave: "sine", fm: 0, low: 60, high: 69, span: 12, len: 1.5, rate: 0.6, cutoff: [1000, 2600], attack: 0.6 }, blips: { odds: 0, glide: 7, lo: 67, hi: 86 }, drips: [0, 0], dial: { odds: 0.6, signal: 0.5, q: 14, flutter: 4, wave: "sine" } },
    root: 40, // E2
    scale: [0, 2, 3, 7, 9, 10], // a minor pentatonic with the sixth
    states: [[0, 7, 10, 14], [-2, 5, 9, 14], [3, 10, 14, 17], [5, 12, 15, 19], [-4, 3, 10, 15]],
    moves: [[0.2, 0.3, 0.2, 0.2, 0.1], [0.4, 0.1, 0.2, 0.2, 0.1], [0.3, 0.2, 0.1, 0.3, 0.1], [0.3, 0.2, 0.3, 0.1, 0.1], [0.5, 0.2, 0.1, 0.1, 0.1]],
    motif: [0, 2, 3, 5],
    melodyFrom: 64,
    fm: { ratio: 1, index: 0 },
    levels: { drone: 0.7, pad: 1, bass: 1, melody: 1, bell: 1, swell: 1, thump: 0, noise: 1 },
    pad: { wave: "sine", cutoff: [600, 2200] },
    noise: { cutoff: [800, 3000] },
    reverb: 7,
    reverbDark: 0.6,
    delayLp: 900,
  },
  "receiver-darkwarm": {
    id: "receiver-darkwarm",
    name: "World Receiver",
    kind: "receiver",
    // the darker variant under the warmer one's lowpass, with its longer, rounder grains
    receiver: { grain: { wave: "sine", fm: 0, low: 55, high: 62, span: 12, len: 1.6, rate: 1, cutoff: [1200, 3200], attack: 0.6 }, blips: { odds: 1, glide: 4, lo: 60, hi: 74 }, dripHz: [400, 1100], trickle: [55, 72], dial: { odds: 1, signal: 0.5, q: 14, flutter: 4, wave: "sine" }, glowDetune: 0 },
    root: 40, // E2
    scale: [0, 2, 3, 7, 9, 10], // a minor pentatonic with the sixth
    states: [[0, 7, 10, 14], [-2, 5, 9, 14], [3, 10, 14, 17], [5, 12, 15, 19], [-4, 3, 10, 15]],
    moves: [[0.2, 0.3, 0.2, 0.2, 0.1], [0.4, 0.1, 0.2, 0.2, 0.1], [0.3, 0.2, 0.1, 0.3, 0.1], [0.3, 0.2, 0.3, 0.1, 0.1], [0.5, 0.2, 0.1, 0.1, 0.1]],
    motif: [0, 2, 3, 5],
    melodyFrom: 64,
    fm: { ratio: 1, index: 0 },
    levels: { drone: 0.7, pad: 1, bass: 1, melody: 1, bell: 1, swell: 1, thump: 0, noise: 1 },
    pad: { wave: "sine", cutoff: [600, 2200] },
    noise: { cutoff: [800, 3000] },
    reverb: 7,
    masterLp: 2500,
  },
  organic: {
    id: "organic",
    name: "Organic Cloud",
    kind: "receiver",
    // darker + warmer (2026-10-31, the owner's pick against ringing overtones): a step lower, rounder grains, pure sines, a warm lowpass on the whole piece
    root: 41, // F2
    scale: [0, 2, 4, 6, 7, 9, 11], // Lydian
    states: [[0, 7, 16, 21], [2, 9, 14, 19], [7, 14, 19, 23], [-1, 6, 14, 19], [4, 11, 16, 23]],
    moves: [[0.2, 0.3, 0.2, 0.1, 0.2], [0.4, 0.1, 0.2, 0.2, 0.1], [0.3, 0.3, 0.1, 0.1, 0.2], [0.4, 0.2, 0.2, 0.1, 0.1], [0.4, 0.2, 0.2, 0.1, 0.1]],
    motif: [0, 1, 2, 4],
    melodyFrom: 60,
    fm: { ratio: 1, index: 0 },
    // warm and slow: long triangle grains low in the field, many soft clouds, the dial rare and mostly empty
    receiver: {
      grain: { wave: "sine", fm: 0, low: 52, high: 59, span: 10, len: 2.4, rate: 0.6, cutoff: [1100, 2800], attack: 0.6 },
      cloudGap: 0.8,
      dial: { odds: 0.4, signal: 0.3, q: 8, flutter: 2.5, wave: "sine" },
      blips: { odds: 0.3, glide: 3, lo: 57, hi: 72 },
      drips: [0.5, 4],
      dripHz: [400, 1100],
      trickle: [55, 72],
      glowDetune: 0,
      breaths: 2,
      glow: 0.9,
      bloom: 1.2,
    },
    levels: { drone: 0.7, pad: 1.1, bass: 1, melody: 0.8, bell: 0.5, swell: 1, thump: 0, noise: 1 },
    pad: { wave: "sine", cutoff: [500, 1800] },
    noise: { cutoff: [500, 2000] },
    masterLp: 2500,
    reverb: 10,
  },
  psycho: {
    id: "psycho",
    name: "Psycho-Acoustic",
    kind: "receiver",
    // darker + warmer (2026-10-31, the owner's pick against ringing overtones): a step lower, rounder grains, pure sines, a warm lowpass on the whole piece
    root: 38, // D2
    scale: [0, 2, 3, 5, 7, 9, 10], // Dorian
    states: [[0, 7, 10, 14], [5, 12, 15, 19], [-2, 5, 9, 14], [3, 10, 14, 19], [7, 14, 17, 22]],
    moves: [[0.2, 0.3, 0.2, 0.2, 0.1], [0.4, 0.1, 0.2, 0.2, 0.1], [0.3, 0.2, 0.1, 0.3, 0.1], [0.3, 0.3, 0.2, 0.1, 0.1], [0.5, 0.2, 0.1, 0.1, 0.1]],
    motif: [0, 3, 1, 4],
    melodyFrom: 62,
    fm: { ratio: 1, index: 0 },
    // digital and busy: short FM grains, the dial often on with signals, blips gliding wide
    receiver: {
      grain: { wave: "sine", fm: 0.3, low: 57, high: 65, span: 14, len: 1.0, rate: 1.5, cutoff: [1200, 3200], attack: 0.6 },
      cloudGap: 1.2,
      dial: { odds: 1.4, signal: 0.7, q: 22, flutter: 7, wave: "sine" },
      blips: { odds: 1.8, glide: 7, lo: 57, hi: 77 },
      drips: [2, 12],
      dripHz: [400, 1100],
      trickle: [55, 72],
      glowDetune: 0,
      breaths: 2,
      glow: 0.5,
      bloom: 0.8,
    },
    levels: { drone: 0.63, pad: 0.8, bass: 1, melody: 0.9, bell: 1, swell: 1, thump: 0, noise: 1 },
    pad: { wave: "sine", cutoff: [600, 2400] },
    noise: { cutoff: [900, 3200] },
    masterLp: 2500,
    reverb: 6,
  },
  night: {
    id: "night",
    name: "Night Receiver",
    kind: "receiver",
    // darker + warmer (2026-10-31, the owner's pick against ringing overtones): a step lower, rounder grains, pure sines, a warm lowpass on the whole piece
    root: 37, // C#2
    scale: [0, 1, 3, 5, 7, 8, 10], // Phrygian
    states: [[0, 7, 10, 15], [1, 8, 13, 17], [-2, 5, 10, 15], [3, 10, 15, 20], [-4, 3, 8, 15]],
    moves: [[0.2, 0.25, 0.25, 0.2, 0.1], [0.4, 0.1, 0.2, 0.2, 0.1], [0.4, 0.2, 0.1, 0.2, 0.1], [0.3, 0.2, 0.3, 0.1, 0.1], [0.5, 0.2, 0.1, 0.1, 0.1]],
    motif: [0, 2, 1, 4],
    melodyFrom: 58,
    fm: { ratio: 1, index: 0 },
    // dark and sparse: low clouds far apart, the dial finding distant signals, more low blooms, a few breaths
    receiver: {
      grain: { wave: "sine", fm: 0, low: 52, high: 57, span: 10, len: 2.1, rate: 0.7, cutoff: [1000, 2600], attack: 0.6 },
      cloudGap: 1.4,
      dial: { odds: 1.2, signal: 0.6, q: 10, flutter: 3, wave: "sine" },
      blips: { odds: 0.5, glide: 3, lo: 55, hi: 70 },
      drips: [0.3, 3],
      dripHz: [400, 1100],
      trickle: [55, 72],
      glowDetune: 0,
      breaths: 4,
      glow: 0.6,
      bloom: 1.6,
    },
    levels: { drone: 0.7, pad: 0.9, bass: 1.2, melody: 0.8, bell: 0.6, swell: 1, thump: 0, noise: 1 },
    pad: { wave: "sine", cutoff: [400, 1500] },
    noise: { cutoff: [400, 1600] },
    masterLp: 2500,
    reverb: 12,
  },
  tape: {
    id: "tape",
    name: "Tape Dream",
    root: 39, // Eb2
    scale: [0, 2, 4, 7, 9], // major pentatonic
    states: [[0, 7, 16, 21], [5, 12, 16, 21], [-3, 4, 12, 19], [2, 9, 14, 21], [7, 14, 19, 23]],
    moves: [[0.2, 0.35, 0.2, 0.15, 0.1], [0.4, 0.1, 0.2, 0.2, 0.1], [0.3, 0.3, 0.1, 0.2, 0.1], [0.3, 0.2, 0.2, 0.1, 0.2], [0.5, 0.2, 0.1, 0.1, 0.1]],
    motif: [0, 1, 2, 4],
    melodyFrom: 63,
    fm: { ratio: 1, index: 0.9 },
    levels: { drone: 0.8, pad: 1, bass: 0.9, melody: 1, bell: 0.4, swell: 0.5, thump: 0.6, noise: 0.8 },
    pad: { wave: "triangle", cutoff: [500, 2400] },
    noise: { cutoff: [600, 3000] },
    reverb: 8,
  },
  // Dream Receiver, the second set (2026-10-31, not on air until the owner listens): the darker + warmer recipe, each led by another layer;
  // then narrowed like v5 (the owner: a high overtone cut the ears, the bass too low): glows folded under G5/A5, signals and blips lower,
  // the lowest blooms at C2 or above, a 45-55 Hz highpass.
  lantern: {
    id: "lantern",
    name: "Lantern Glow",
    kind: "receiver",
    // the glows lead: the chord breathes in and out as soft lowpassed triangles, the clouds few and low, the rest nearly gone
    root: 39, // Eb2
    scale: [0, 2, 3, 5, 7, 8, 10], // Aeolian
    states: [[0, 7, 10, 14], [8, 15, 19, 24], [5, 12, 15, 20], [-2, 5, 10, 14], [3, 10, 15, 19]],
    moves: [[0.1, 0.35, 0.2, 0.2, 0.15], [0.3, 0.1, 0.3, 0.2, 0.1], [0.3, 0.2, 0.1, 0.3, 0.1], [0.4, 0.2, 0.1, 0.1, 0.2], [0.4, 0.2, 0.2, 0.1, 0.1]],
    motif: [0, 2, 4, 3],
    melodyFrom: 58,
    fm: { ratio: 1, index: 0 },
    receiver: {
      grain: { wave: "sine", fm: 0, low: 51, high: 58, span: 9, len: 1.6, rate: 0.8, cutoff: [900, 2200], attack: 0.6 },
      cloudGap: 1.6,
      dial: { odds: 0.3, signal: 0.4, q: 10, flutter: 2, wave: "sine" },
      blips: { odds: 0.2, glide: 2, lo: 58, hi: 70 },
      drips: [0.3, 2],
      dripHz: [380, 950],
      trickle: [55, 70],
      glowDetune: 0,
      glowMax: 62,
      soft: true,
      dialSignal: [57, 69],
      breaths: 1.5,
      glow: 1,
      bloom: 0.9,
    },
    levels: { drone: 0.9, pad: 1.05, bass: 0.6, melody: 0.7, bell: 0.5, swell: 0.8, thump: 0, noise: 0.8 },
    pad: { wave: "sine", cutoff: [500, 1800] },
    noise: { cutoff: [400, 1500] },
    masterLp: 2200,
    masterHp: 45,
    reverb: 11,
  },
  rain: {
    id: "rain",
    name: "Rain Signal",
    kind: "receiver",
    // drops and the trickle lead: a soft rain of rising drops and little tones, short low grains under it
    root: 43, // G2
    scale: [0, 3, 5, 7, 10], // minor pentatonic
    states: [[0, 7, 10, 15], [3, 10, 15, 19], [-2, 5, 10, 14], [5, 12, 15, 20]],
    moves: [[0.1, 0.35, 0.3, 0.25], [0.4, 0.1, 0.3, 0.2], [0.4, 0.3, 0.1, 0.2], [0.5, 0.2, 0.2, 0.1]],
    motif: [0, 1, 3, 2],
    melodyFrom: 58,
    fm: { ratio: 1, index: 0 },
    receiver: {
      grain: { wave: "sine", fm: 0, low: 50, high: 55, span: 9, len: 0.7, rate: 1.1, cutoff: [800, 2000], attack: 0.5 },
      cloudGap: 1.5,
      dial: { odds: 0.5, signal: 0.5, q: 12, flutter: 3, wave: "sine" },
      blips: { odds: 0.6, glide: 3, lo: 57, hi: 69 },
      drips: [5, 16],
      dripHz: [320, 720],
      trickle: [55, 67],
      trickleGap: [0.7, 2.4],
      glowDetune: 0,
      glowMax: 67,
      soft: true,
      dialSignal: [57, 69],
      breaths: 1,
      glow: 0.5,
      bloom: 1.4,
    },
    levels: { drone: 1.33, pad: 1.56, bass: 1.4, melody: 1.4, bell: 0.75, swell: 0.9, thump: 0, noise: 1.5 },
    pad: { wave: "sine", cutoff: [500, 1800] },
    noise: { cutoff: [400, 1500] },
    masterLp: 2200,
    masterHp: 45,
    reverb: 8,
  },
  orbit: {
    id: "orbit",
    name: "Low Orbit",
    kind: "receiver",
    // the deep end leads: quartal chords low in the field, a soft bloom about once a minute
    // PARKED (2026-10-31): fails the narrow-tone gate (its D4 cloud line stands 5 dB under the top), left out of the demos
    root: 38, // D2
    scale: [0, 3, 5, 7, 10], // minor pentatonic, stacked in fourths
    states: [[0, 5, 10, 15], [7, 12, 17, 22], [-2, 3, 7, 12], [5, 10, 15, 19]],
    moves: [[0.1, 0.3, 0.3, 0.3], [0.4, 0.1, 0.3, 0.2], [0.4, 0.3, 0.1, 0.2], [0.5, 0.2, 0.2, 0.1]],
    motif: [0, 2, 1, 3],
    melodyFrom: 57,
    fm: { ratio: 1, index: 0 },
    receiver: {
      grain: { wave: "sine", fm: 0, low: 50, high: 55, span: 9, len: 1.1, rate: 1.2, cutoff: [700, 1800], attack: 0.6 },
      cloudGap: 1.1,
      dial: { odds: 0.3, signal: 0.4, q: 10, flutter: 2, wave: "sine" },
      blips: { odds: 0.2, glide: 2, lo: 55, hi: 67 },
      drips: [0.2, 1.5],
      dripHz: [300, 800],
      trickle: [52, 64],
      glowDetune: 0,
      glowMax: 62,
      soft: true,
      dialSignal: [57, 69],
      breaths: 1.5,
      glow: 0.5,
      bloom: 2.6,
    },
    levels: { drone: 1.05, pad: 0.55, bass: 1.35, melody: 0.6, bell: 0.34, swell: 0.6, thump: 0, noise: 0.68 },
    pad: { wave: "sine", cutoff: [400, 1400] },
    noise: { cutoff: [300, 1200] },
    masterLp: 1900,
    masterHp: 55,
    reverb: 13,
  },
  far: {
    id: "far",
    name: "Far Station",
    kind: "receiver",
    // the dial leads: a narrow band searching slowly and nearly always finding a far signal; everything else sparse
    root: 42, // F#2
    scale: [0, 2, 4, 5, 7, 9, 10], // Mixolydian
    states: [[0, 7, 14, 16], [-2, 5, 9, 14], [5, 12, 16, 21], [-5, 2, 7, 10]],
    moves: [[0.1, 0.4, 0.3, 0.2], [0.5, 0.1, 0.2, 0.2], [0.4, 0.3, 0.1, 0.2], [0.5, 0.2, 0.2, 0.1]],
    motif: [0, 4, 2, 1],
    melodyFrom: 58,
    fm: { ratio: 1, index: 0 },
    receiver: {
      grain: { wave: "sine", fm: 0, low: 52, high: 58, span: 9, len: 1.8, rate: 0.5, cutoff: [900, 2200], attack: 0.6 },
      cloudGap: 2.2,
      dial: { odds: 1.5, signal: 0.85, q: 16, flutter: 1.5, wave: "sine" },
      blips: { odds: 0.25, glide: 3, lo: 57, hi: 69 },
      drips: [0.2, 1.2],
      dripHz: [400, 1000],
      trickle: [55, 70],
      glowDetune: 0,
      glowMax: 67,
      soft: true,
      dialSignal: [57, 69],
      breaths: 2,
      glow: 0.35,
      bloom: 0.6,
    },
    levels: { drone: 0.84, pad: 1.04, bass: 1, melody: 0.7, bell: 0.5, swell: 1.1, thump: 0, noise: 0.8 },
    pad: { wave: "sine", cutoff: [500, 1800] },
    noise: { cutoff: [400, 1500] },
    masterLp: 2200,
    masterHp: 45,
    reverb: 14,
  },
  dawn: {
    id: "dawn",
    name: "Dawn Receiver",
    kind: "receiver",
    // the brightest, still soft: major, the clouds higher and lighter, more blips, a warm ceiling kept
    root: 45, // A2
    scale: [0, 2, 4, 7, 9], // major pentatonic
    states: [[0, 7, 14, 16], [5, 12, 16, 21], [-3, 4, 9, 12], [2, 9, 14, 19], [-5, 2, 7, 14]],
    moves: [[0.1, 0.35, 0.2, 0.2, 0.15], [0.4, 0.1, 0.2, 0.2, 0.1], [0.3, 0.3, 0.1, 0.2, 0.1], [0.3, 0.2, 0.2, 0.1, 0.2], [0.6, 0.2, 0.1, 0.1, 0]],
    motif: [0, 1, 2, 4],
    melodyFrom: 60,
    fm: { ratio: 1, index: 0 },
    receiver: {
      grain: { wave: "sine", fm: 0, low: 55, high: 60, span: 8, len: 1.4, rate: 0.9, cutoff: [1100, 2600], attack: 0.6 },
      cloudGap: 0.9,
      dial: { odds: 0.6, signal: 0.6, q: 14, flutter: 3, wave: "sine" },
      blips: { odds: 0.9, glide: 3, lo: 60, hi: 72 },
      drips: [0.8, 5],
      dripHz: [400, 950],
      trickle: [57, 72],
      glowDetune: 0,
      glowMax: 67,
      soft: true,
      dialSignal: [60, 72],
      breaths: 1.5,
      glow: 0.8,
      bloom: 0.7,
    },
    levels: { drone: 0.98, pad: 1.51, bass: 0.6, melody: 1.04, bell: 0.8, swell: 0.9, thump: 0, noise: 0.9 },
    pad: { wave: "sine", cutoff: [600, 2200] },
    noise: { cutoff: [500, 1800] },
    masterLp: 2400,
    masterHp: 45,
    reverb: 9,
  },
  tidal: {
    id: "tidal",
    name: "Tidal Pulse",
    kind: "receiver",
    // a slow pulse leads: a low soft tone every ~2.4 s like a tide, swelling grains over it
    // PARKED (2026-10-31): fails the narrow-tone gate (its Eb4 line stands 7 dB under the top), left out of the demos
    root: 39, // Eb2
    scale: [0, 2, 3, 5, 7, 9, 10], // Dorian
    states: [[0, 7, 10, 14], [5, 12, 17, 21], [3, 10, 14, 19], [-2, 5, 9, 14], [7, 14, 19, 22]],
    moves: [[0.1, 0.3, 0.25, 0.25, 0.1], [0.4, 0.1, 0.2, 0.2, 0.1], [0.3, 0.2, 0.1, 0.3, 0.1], [0.4, 0.2, 0.2, 0.1, 0.1], [0.5, 0.2, 0.1, 0.1, 0.1]],
    motif: [0, 2, 1, 3],
    melodyFrom: 58,
    fm: { ratio: 1, index: 0 },
    receiver: {
      grain: { wave: "sine", fm: 0, low: 51, high: 54, span: 9, len: 1.6, rate: 0.7, cutoff: [800, 2000], attack: 0.6 },
      cloudGap: 1.2,
      dial: { odds: 0.4, signal: 0.4, q: 10, flutter: 2, wave: "sine" },
      blips: { odds: 0.3, glide: 2, lo: 58, hi: 70 },
      drips: [0.3, 2],
      dripHz: [350, 900],
      trickle: [51, 63],
      trickleGap: [2.3, 2.5],
      glowDetune: 0,
      glowMax: 62,
      soft: true,
      dialSignal: [57, 69],
      breaths: 2,
      glow: 0.6,
      bloom: 1.2,
    },
    levels: { drone: 0.95, pad: 0.55, bass: 0.5, melody: 1.38, bell: 0.37, swell: 0.64, thump: 0, noise: 0.74 },
    pad: { wave: "sine", cutoff: [400, 1500] },
    noise: { cutoff: [350, 1300] },
    masterLp: 2000,
    masterHp: 55,
    reverb: 9,
  },
};
