import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { VoiceEngine } from "../src/engine.ts";
import {
  dropBar,
  eraById,
  eraOf,
  formBars,
  formSectionAt,
  HOUSE_PROGRAM,
  initialState,
  PACKS,
  planSteps,
  programFromPack,
  styleOf,
  validatePack,
  type Program,
  type StationPack,
} from "../src/index.ts";
import liquidDnb from "../src/stations/liquid-dnb.ts";
import { LIQUID_VOICE_KINDS, renderVoice } from "../src/voices/dnb/index.ts";

// The liquid drum & bass recipe (the study's approved B): every engine field it adds is opt-in. Left out, a soulful
// style schedules exactly the house; each field, given, changes what is scheduled; the pack validates.

/** A stand-in BaseAudioContext that logs every node, connection, parameter write and buffer (as test/pack.test.ts). */
function recordingContext() {
  const log: string[] = [];
  let next = 0;
  const hashData = (data: ArrayLike<number>) => createHash("sha1").update(Buffer.from(Float32Array.from(data).buffer)).digest("hex").slice(0, 12);
  const fmt = (x: unknown): string => {
    if (x === null || x === undefined || typeof x !== "object") return typeof x === "function" ? ((x as any).__id ?? "fn") : String(x);
    if ((x as any).__id) return (x as any).__id;
    if ((x as any).__buffer) return `${(x as any).__buffer}:${(x as any).channels.map(hashData).join("/")}`;
    if (ArrayBuffer.isView(x)) return `f32:${hashData(x as unknown as ArrayLike<number>)}`;
    if (Array.isArray(x)) return `[${x.map(fmt).join(",")}]`;
    return JSON.stringify(x);
  };
  const node = (id: string): any => {
    const stored = new Map<PropertyKey, unknown>();
    const kids = new Map<PropertyKey, unknown>();
    return new Proxy(function () {}, {
      get(_, prop) {
        if (prop === "__id") return id;
        if (prop === "then" || typeof prop === "symbol") return undefined;
        if (stored.has(prop)) return stored.get(prop);
        if (prop === "value") return 0;
        if (!kids.has(prop)) kids.set(prop, node(`${id}.${String(prop)}`));
        return kids.get(prop);
      },
      set(_, prop, value) {
        log.push(`${id}.${String(prop)}=${fmt(value)}`);
        stored.set(prop, value);
        return true;
      },
      apply(_, __, args) {
        log.push(`${id}(${args.map(fmt).join(",")})`);
        if (id.endsWith(".connect")) return args[0];
        return node(`${id}()`);
      },
    });
  };
  const ctx: any = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "sampleRate") return 44100;
        if (prop === "currentTime") return 0;
        if (prop === "then" || typeof prop === "symbol") return undefined;
        if (prop === "createBuffer") {
          return (channels: number, length: number, sampleRate: number) => {
            const buf = { __buffer: `buf${next++}`, length, sampleRate, numberOfChannels: channels, duration: length / sampleRate, channels: [] as Float32Array[] };
            for (let i = 0; i < channels; i++) buf.channels.push(new Float32Array(length));
            log.push(`createBuffer(${channels},${length},${sampleRate})`);
            return Object.assign(buf, { getChannelData: (i: number) => buf.channels[i] });
          };
        }
        return (...args: unknown[]) => {
          const id = `n${next++}`;
          log.push(`${String(prop)}(${args.map(fmt).join(",")})->${id}`);
          return node(id);
        };
      },
    },
  );
  return { ctx, log };
}

/** The hash of what a liquid engine schedules at `epoch` in `program` over a busy stretch from bar `bar`. */
function schedule(epoch: number, program: Program, seconds = 40, bar = 8): string {
  const { ctx, log } = recordingContext();
  const engine = new VoiceEngine(ctx, eraById("liquid").index, epoch, program);
  const busy = (k: number) => ({
    ...initialState(),
    patternId: 4 * epoch + (k % 4),
    pattern: 0x9249_ffff_4924_9249n ^ BigInt(k * 0x1357),
    bass: 0x8421_8421_8421_8421n >> BigInt(k % 5),
    heat: 0.4,
    lastTick: k * 400,
  });
  const points = Array.from({ length: 8 }, (_, k) => ({ time: k * 5, state: busy(k) }));
  for (const hit of planSteps(points, seconds, "liquid", bar, program)) if (hit.time < seconds) engine.trigger(hit);
  return createHash("sha256").update(log.join("\n")).digest("hex");
}

const pack = (data: object, style: object = {}) =>
  ({ key: "lq", name: "Lq", genres: ["liquid"], styles: { liquid: [{ id: "lq-style", name: "L", base: "soulful", ...style, data }] } }) as unknown as StationPack;
let soulEpoch = 0;
while (!(eraOf(soulEpoch).id === "liquid" && styleOf(eraById("liquid"), soulEpoch).style.id === "soulful")) soulEpoch++;
const at = (data: object, style: object = {}, bar = 8) => {
  const p = pack(data, style);
  expect(validatePack(p)).toEqual([]);
  return schedule(soulEpoch, programFromPack(p), 40, bar);
};
const house = schedule(soulEpoch, HOUSE_PROGRAM);

const BREAK = {
  kick: "9.........8.....9.........8....3",
  snare: "....9.......9.......9.......9...",
  ghost: ".......3.3.....4..2....3...3..4.",
  hat: "4.8.3.7.4.8.3.7.4.8.3.7.4.8.3.6.",
  open: "",
};

describe("liquid drum & bass recipe fields (all off by default)", () => {
  it("a soulful style with no data schedules the house; with the fields left out, nothing changes", () => {
    expect(at({})).toBe(house);
    expect(at({ kit: { breaks: [BREAK] } })).toBe(at({ kit: { breaks: [BREAK] } }));
  });

  it("each played-break field changes the drums", () => {
    const base = at({ kit: { breaks: [BREAK] } });
    for (const extra of [
      { freshNoise: true }, { ghostTail: 0.7 }, { humanDb: 1.5 }, { jitter: 0.004 }, { swing: 0.1 }, { fillCut: true },
      { ride: { lane: "9...6...8...6...", level: 1, hp: 3200, decay: 1.4, from: 0 } },
    ]) {
      expect(at({ kit: { breaks: [BREAK], ...extra } }), JSON.stringify(extra)).not.toBe(base);
    }
    expect(at({ kit: { breaks: [{ ...BREAK, shaker: "..3..2.4..3..2.4..3..2.4..3..2.4" }] } })).not.toBe(base);
    const four = Object.fromEntries(Object.entries(BREAK).map(([k, v]) => [k, v ? v + v : v]));
    expect(at({ kit: { breakBars: 4, breaks: [{ ...four, kick: four.kick.slice(0, 48) + "9.......4.8....." }] } })).not.toBe(base);
  });

  it("the legato sub, the anticipation, the fold and the bass mute change the bass", () => {
    const walk = [{ s: 0, len: 26, oct: 0, core: true }, { s: 26, len: 4, oct: 0, core: true }, { s: 30, len: 2, oct: 0, core: true }];
    const base = at({ walks: [walk] });
    expect(at({ walks: [walk], bass: { legato: true } })).not.toBe(base);
    expect(at({ walks: [walk], bass: { legato: true, release: 0.02 } })).not.toBe(at({ walks: [walk], bass: { legato: true } }));
    expect(at({ walks: [walk.map((n) => (n.s === 30 ? { ...n, next: true } : n))] })).not.toBe(base);
    expect(at({ walks: [walk], dnb: { bassMute: true } }, {}, 12)).not.toBe(at({ walks: [walk] }, {}, 12));
    // The house progressions put roots over D#2 for some tonics; the fold moves them, else it is a no-op.
    expect(at({ walks: [walk], dnb: { subFold: true } })).toBe(at({ walks: [walk], dnb: { subFold: true } }));
  });

  it("the tine electric piano replaces the comp voice; its fields, velocities, strum and answer shape it", () => {
    const comps = [[{ s: 0, len: 6, core: true, vel: 0.8 }, { s: 7, len: 2, core: true, vel: 0.55 }, { s: 24, len: 4, core: true }, { s: 31, len: 6, core: true, vel: 0.72 }]];
    const plain = at({ comps });
    const ep = at({ comps, dnb: { ep: {} } });
    expect(ep).not.toBe(plain);
    expect(at({ comps, dnb: { ep: { tine: 0.2 } } })).not.toBe(ep);
    expect(at({ comps: [comps[0].map((n) => ({ ...n, vel: 0.4 }))], dnb: { ep: {} } })).not.toBe(ep);
    for (const extra of [{ strum: 0.0045 }, { topAccent: 1.1 }, { velJitter: 0.08 }, { chorus: { wet: 0.55 } }, { chorus: { wet: 0.55, pad: 0.6 } }]) {
      expect(at({ comps, dnb: { ep: {}, ...extra } }), JSON.stringify(extra)).not.toBe(ep);
    }
    const answer = { level: 0.7, sections: ["build", "full"], figures: [[{ s: 2, len: 3, tone: 3, oct: 1 }, { s: 34, len: 8, tone: 1, oct: 1, vel: 0.6 }]] };
    expect(at({ comps, dnb: { ep: {}, answer } })).not.toBe(ep);
  });

  it("v2 fields: chord bars, explicit anticipations, the keys patch, the choir, the pad cut, the lead's sections", () => {
    const comps = [[{ s: 0, len: 3, core: true, vel: 0.8 }, { s: 7, len: 2, core: true, vel: 0.55 }, { s: 14, len: 2, core: true, vel: 0.6 }]];
    const prog = [
      { pad: [3, 7, 10, 14], root: 0 }, { pad: [3, 7, 10, 12], root: 8 }, { pad: [2, 5, 7, 10], root: 3 }, { pad: [2, 5, 7, 12], root: 10 },
    ];
    const ep = at({ comps, progressions: [prog], dnb: { ep: {} } });
    expect(at({ comps, progressions: [prog], dnb: { ep: {}, chordBars: 1 } })).not.toBe(ep);
    expect(at({ comps, progressions: [[...prog, ...prog.slice(0, 2)]], dnb: { ep: {}, chordBars: 1 } })).not.toBe(at({ comps, progressions: [prog], dnb: { ep: {}, chordBars: 1 } }));
    expect(at({ comps: [comps[0].map((n) => (n.s === 14 ? { ...n, next: true } : n))], progressions: [prog], dnb: { ep: {}, chordBars: 1 } })).not.toBe(
      at({ comps, progressions: [prog], dnb: { ep: {}, chordBars: 1 } }),
    );
    // `next: false` on a hit at 30+ keeps it on its own chord.
    const push = [[{ s: 0, len: 3, core: true }, { s: 30, len: 2, core: true }]];
    expect(at({ comps: [push[0].map((n) => ({ ...n, next: false }))], progressions: [prog], dnb: { ep: {} } })).not.toBe(at({ comps: push, progressions: [prog], dnb: { ep: {} } }));
    const patch = { name: "Pluck", osc: [{ type: "sawtooth", detune: 0, oct: 0, level: 0.6 }], filter: { type: "lowpass", cutoff: 600, env: 2000, decay: 0.2, q: 1 }, amp: { a: 0.002, d: 0.3, s: 0, r: 0.1 }, gain: 0.6 };
    expect(at({ comps, progressions: [prog], dnb: { keys: { patch, level: 1 } } })).not.toBe(ep);
    expect(at({ comps, progressions: [prog], dnb: { ep: {}, choir: 1 } })).not.toBe(ep);
    expect(at({ comps, progressions: [prog], choir: { level: 0.1 }, dnb: { ep: {}, choir: 1 } })).not.toBe(at({ comps, progressions: [prog], dnb: { ep: {}, choir: 1 } }));
    expect(at({ comps, progressions: [prog], dnb: { ep: {}, padCut: 6 } })).not.toBe(ep);
    const motif = { patch, level: 0.8, figures: [[{ s: 2, len: 4, tone: 3, oct: 1 }, { s: 66, len: 4, tone: 1, oct: 1 }]] };
    expect(at({ dnb: { motif: { ...motif, sections: ["intro"] } } }, {}, 0)).not.toBe(at({ dnb: { motif: { ...motif, sections: ["full"] } } }, {}, 0));
  });

  it("v2 fields: the fold's floor, the kick drop, the triplet fill, the crash every four bars", () => {
    const walk = [{ s: 0, len: 16, oct: 0, core: true }, { s: 16, len: 16, oct: 0, core: true }];
    expect(at({ walks: [walk], dnb: { subFold: true, subFloor: 24 } })).not.toBe(at({ walks: [walk], dnb: { subFold: true } }));
    const fills = [{ kick: "..8.....", snare: "....5678" }];
    const base = at({ kit: { breaks: [BREAK] }, fills });
    expect(at({ kit: { breaks: [BREAK] }, fills: [{ ...fills[0], drop: true }] })).not.toBe(base);
    expect(at({ kit: { breaks: [BREAK] }, fills: [{ ...fills[0], trip: "345678" }] })).not.toBe(base);
    expect(at({ kit: { breaks: [BREAK], crash: 0.1, crashBars: 4 }, fills })).not.toBe(at({ kit: { breaks: [BREAK], crash: 0.1 }, fills }));
  });

  it("v3 fields: the noise ride, the four-bar ride lane, the lead now and then, comps that move, the sweep, the swell", () => {
    const ride = { lane: "9...6...8...6...", level: 1, hp: 3200, decay: 1.4, from: 0 };
    const kit = (r: object) => at({ kit: { breaks: [BREAK], ride: r } });
    const pitched = kit(ride);
    expect(kit({ ...ride, noise: true })).not.toBe(pitched);
    expect(kit({ ...ride, noise: false })).toBe(pitched);
    // A 64-character lane that repeats the one bar four times is the one-bar lane.
    expect(kit({ ...ride, lane: ride.lane.repeat(4) })).toBe(pitched);
    // (with two-bar breaks it reads the first two bars)
    expect(kit({ ...ride, lane: ride.lane + "9.5.7.5.9.5.7.5." + ride.lane.repeat(2) })).not.toBe(pitched);
    const patch = { name: "Pluck", osc: [{ type: "sawtooth", detune: 0, oct: 0, level: 0.6 }], filter: { type: "lowpass", cutoff: 600, env: 2000, decay: 0.2, q: 1 }, amp: { a: 0.002, d: 0.3, s: 0, r: 0.1 }, gain: 0.6 };
    const motif = { patch, level: 0.8, figures: [[{ s: 2, len: 4, tone: 3, oct: 1 }, { s: 66, len: 4, tone: 1, oct: 1 }], [{ s: 10, len: 4, tone: 2, oct: 1 }]] };
    const every = (m: object) => at({ dnb: { motif: { ...motif, ...m } } }, {}, 16);
    expect(every({})).not.toBe(every({ every: 2 }));
    expect(every({ every: 2 })).not.toBe(every({ every: 2, phase: 1 }));
    expect(every({ every: 1 })).not.toBe(every({}));
    const comps = [[{ s: 0, len: 3, core: true, vel: 0.8 }], [{ s: 6, len: 2, core: true, vel: 0.6 }, { s: 22, len: 2, core: true }]];
    expect(at({ comps, dnb: { ep: {}, compRotate: 2 } })).not.toBe(at({ comps, dnb: { ep: {} } }));
    const form = { form: { intro: 16, build: 8, drop: 32, breakdown: 8 } };
    expect(at({ dnb: { rotate: false, sweep: 0.3 } }, form, 0)).not.toBe(at({ dnb: { rotate: false } }, form, 0));
    // Without a style form the sweep does nothing.
    expect(at({ dnb: { rotate: false, sweep: 0.3 } }, {}, 0)).toBe(at({ dnb: { rotate: false } }, {}, 0));
    expect(at({ dnb: { rotate: false, swell: { level: 0.6, bars: 4 } } }, form, 16)).not.toBe(at({ dnb: { rotate: false } }, form, 16));
  });

  it("the rooms, the pad's breath, the full-time intro and the style form", () => {
    expect(at({ dnb: { drumRoom: { decay: 0.9, lp: 5000, hp: 300, send: 0.22 } } })).not.toBe(house);
    expect(at({ dnb: { hall: { decay: 2.6, lp: 3500, hp: 200, harm: 0.3, lead: 0.18, fx: 0.3 } } })).not.toBe(house);
    expect(at({ dnb: { padLfo: { rate: 0.11, depth: 0.3 } } })).not.toBe(house);
    expect(at({ dnb: { fullIntro: true } }, {}, 0)).not.toBe(at({}, {}, 0));
    expect(at({}, { form: { intro: 16, build: 8, drop: 32, breakdown: 8 } })).not.toBe(house);
  });

  it("the style form: sections, bars and the drop", () => {
    const f = { intro: 16, build: 8, drop: 32, breakdown: 8 };
    expect(formBars(f)).toBe(64);
    expect(dropBar(f)).toBe(24);
    expect(dropBar()).toBe(16);
    expect([0, 8, 16, 24, 55, 56, 63, 64].map((b) => formSectionAt(b, f).name)).toEqual(["intro", "intro", "build", "full", "full", "breakdown", "breakdown", "intro"]);
    expect(formSectionAt(3, f).kick).toBe(0);
    expect(formSectionAt(3, f).bass).toBe(0);
    expect(formSectionAt(3, f).snare).toBe(0);
    expect(formSectionAt(9, f).snare).toBeGreaterThan(0);
    expect(formSectionAt(20, f).bass).toBe(0);
    expect(formSectionAt(30, f).bass).toBe(1);
  });

  it("validation of the new fields", () => {
    const err = (data: object, style: object = {}) => validatePack(pack(data, style)).join("\n");
    expect(err({}, { form: { intro: 16, build: 8, drop: 30, breakdown: 8 } })).toMatch(/form: expected 16\.\.128 bars/);
    expect(err({ kit: { breaks: [{ ...BREAK, kick: BREAK.kick + BREAK.kick }] } })).toMatch(/kit\.breaks\[0\]\.kick: expected 32 characters/);
    expect(err({ kit: { breakBars: 4, breaks: [BREAK] } })).toMatch(/expected 64 characters/);
    expect(err({ dnb: { ep: { tine: 2 } } })).toMatch(/dnb\.ep\.tine/);
    expect(err({ dnb: { ep: { organ: 1 } } })).toMatch(/dnb\.ep\.organ: unknown field/);
    expect(err({ bass: { legato: 1 } })).toMatch(/bass\.legato/);
    expect(err({ comps: [[{ s: 0, len: 4, core: true, vel: 2 }]] })).toMatch(/comps\[0\]\[0\]\.vel/);
    expect(err({ kit: { swing: 0.5 } })).toMatch(/kit\.swing/);
    const five = [0, 1, 2, 3, 4].map(() => ({ pad: [3, 7, 10], root: 0 }));
    expect(err({ progressions: [five] })).toMatch(/expected 4 chords \(4\.\.8 only with dnb\.chordBars\)/);
    expect(err({ progressions: [five], dnb: { chordBars: 1 } })).toBe("");
    expect(err({ dnb: { chordBars: 3 } })).toMatch(/dnb\.chordBars/);
    expect(err({ fills: [{ kick: "........", snare: "........", trip: "12345" }] })).toMatch(/fills\[0\]\.trip/);
    expect(err({ dnb: { subFloor: 40 } })).toMatch(/dnb\.subFloor/);
    expect(err({ kit: { ride: { lane: "9...".repeat(8), level: 1, hp: 3200, decay: 1 } } })).toMatch(/kit\.ride\.lane: expected 16 characters/);
    expect(err({ kit: { ride: { lane: "9...".repeat(16), level: 1, hp: 3200, decay: 1, noise: true } } })).toBe("");
    expect(err({ dnb: { compRotate: 3 } })).toMatch(/dnb\.compRotate/);
    expect(err({ dnb: { sweep: 0 } })).toMatch(/dnb\.sweep/);
    expect(err({ dnb: { swell: { level: 0.5, bars: 9 } } })).toMatch(/dnb\.swell\.bars/);
  });
});

describe("liquid voices (dnb.voices, voices.ts; off by default)", () => {
  /** The strongest frequency within +-60 cents of f0 over 0.1..0.7 s of the left channel (a direct DFT on a 2-cent grid). */
  const peak = (x: Float32Array, f0: number) => {
    const a = Math.round(0.1 * 44100);
    const b = Math.min(x.length, Math.round(0.7 * 44100));
    let best = 0;
    let bestF = 0;
    for (let c = -60; c <= 60; c += 2) {
      const f = f0 * Math.pow(2, c / 1200);
      let re = 0;
      let im = 0;
      const w = (2 * Math.PI * f) / 44100;
      for (let i = a; i < b; i += 2) {
        const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i - a)) / (b - a));
        re += x[i] * h * Math.cos(w * i);
        im += x[i] * h * Math.sin(w * i);
      }
      const m = re * re + im * im;
      if (m > best) {
        best = m;
        bestF = f;
      }
    }
    return bestF;
  };

  it("every kind renders finite, deterministic audio at its pitch", () => {
    for (const kind of LIQUID_VOICE_KINDS) {
      const bass = kind === "reese" || kind === "moog" || kind === "upright";
      const midi = bass ? 36 : 60;
      const note = { midi: [midi], dur: 1, vel: 0.7, sr: 44100, seed: 3 };
      const a = renderVoice(kind, note);
      const b = renderVoice(kind, note);
      expect(a.L.length, kind).toBeGreaterThan(44100);
      expect(Buffer.from(a.L.buffer).equals(Buffer.from(b.L.buffer)), kind).toBe(true);
      let max = 0;
      for (let i = 0; i < a.L.length; i++) {
        expect(Number.isFinite(a.L[i]) && Number.isFinite(a.R[i]), kind).toBe(true);
        max = Math.max(max, Math.abs(a.L[i]), Math.abs(a.R[i]));
      }
      expect(max, kind).toBeGreaterThan(0.01);
      expect(max, kind).toBeLessThan(4);
      const f0 = 440 * Math.pow(2, (midi - 69) / 12);
      const f = peak(a.L, f0);
      // The reese's three saws beat +-13 cents around the note: its peak may sit on a side saw.
      expect(Math.abs(1200 * Math.log2(f / f0)), kind).toBeLessThanOrEqual(kind === "reese" ? 20 : 10);
    }
  });

  it("each role, given, changes what is scheduled; left out, the style is what it was", () => {
    const v = { kind: "rhodes", level: 1 };
    expect(at({ dnb: { ep: {}, voices: {} } })).toBe(at({ dnb: { ep: {} } }));
    expect(at({ dnb: { ep: {}, voices: { keys: v } } })).not.toBe(at({ dnb: { ep: {} } }));
    expect(at({ dnb: { voices: { keys: v } } })).not.toBe(house);
    expect(at({ dnb: { voices: { pad: { kind: "juno", level: 1 } } } })).not.toBe(house);
    expect(at({ dnb: { voices: { pad: { kind: "juno", level: 1 }, pad2: { kind: "choir", level: 0.5 } } } })).not.toBe(at({ dnb: { voices: { pad: { kind: "juno", level: 1 } } } }));
    expect(at({ dnb: { voices: { bass: { kind: "upright", level: 1 } } } })).not.toBe(house);
    const patch = { name: "Pluck", osc: [{ type: "sawtooth", detune: 0, oct: 0, level: 0.6 }], filter: { type: "lowpass", cutoff: 600, env: 2000, decay: 0.2, q: 1 }, amp: { a: 0.002, d: 0.3, s: 0, r: 0.1 }, gain: 0.6 };
    const motif = { patch, level: 0.8, figures: [[{ s: 2, len: 4, tone: 3, oct: 1 }, { s: 66, len: 8, tone: 1, oct: 1 }]] };
    expect(at({ dnb: { motif, voices: { lead: { kind: "flute", level: 1 } } } }, {}, 16)).not.toBe(at({ dnb: { motif } }, {}, 16));
    const answer = { level: 0.8, figures: [[{ s: 4, len: 4, tone: 1, oct: 1 }]], sections: ["full"] };
    expect(at({ dnb: { ep: {}, answer, voices: { answer: { kind: "vibes", level: 1 } } } }, {}, 16)).not.toBe(at({ dnb: { ep: {}, answer } }, {}, 16));
  });

  it("validation", () => {
    const err = (data: object) => validatePack(pack(data)).join("\n");
    expect(err({ dnb: { voices: { keys: { kind: "harpsichord", level: 1 } } } })).toMatch(/dnb\.voices\.keys\.kind/);
    expect(err({ dnb: { voices: { pad: { kind: "juno", level: 3 } } } })).toMatch(/dnb\.voices\.pad\.level/);
    expect(err({ dnb: { voices: { bass: { kind: "upright", level: 1, oct: 3 } } } })).toMatch(/dnb\.voices\.bass\.oct/);
    expect(err({ dnb: { voices: { drums: { kind: "upright", level: 1 } } } })).toMatch(/dnb\.voices\.drums: unknown field/);
    expect(err({ dnb: { voices: { lead: { kind: "sax", level: 1, bright: 0.3, oct: -1 } } } })).toBe("");
  });
});

describe("liquid v6 fields: the singer's presence, the glass strike, the pads' duck (all off by default)", () => {
  it("presence, the strike's fields and the pads' duck under the line change what is scheduled", () => {
    const glass = { kind: "glass", level: 1 };
    const g = at({ dnb: { voices: { pad: glass } } }, {}, 16);
    for (const extra of [{ strike: 0.3 }, { strikeRatio: 2 }, { strikeBars: 16 }]) {
      expect(at({ dnb: { voices: { pad: { ...glass, ...extra } } } }, {}, 16), JSON.stringify(extra)).not.toBe(g);
    }
    const patch = { name: "Pluck", osc: [{ type: "sawtooth", detune: 0, oct: 0, level: 0.6 }], filter: { type: "lowpass", cutoff: 600, env: 2000, decay: 0.2, q: 1 }, amp: { a: 0.002, d: 0.3, s: 0, r: 0.1 }, gain: 0.6 };
    const motif = { patch, level: 0.8, every: 1, figures: [[{ s: 2, len: 4, tone: 3, oct: 1 }, { s: 66, len: 8, tone: 1, oct: 1 }]] };
    const lead = { kind: "voice", level: 1 };
    const sung = at({ dnb: { motif, voices: { lead, pad: glass } } }, {}, 16);
    expect(at({ dnb: { motif, voices: { lead: { ...lead, presence: 3 }, pad: glass } } }, {}, 16)).not.toBe(sung);
    expect(at({ dnb: { motif: { ...motif, padDuck: 0.7 }, voices: { lead, pad: glass } } }, {}, 16)).not.toBe(sung);
  });

  it("validation", () => {
    const err = (data: object) => validatePack(pack(data)).join("\n");
    expect(err({ dnb: { voices: { pad: { kind: "glass", level: 1, strikeRatio: 5 } } } })).toMatch(/strikeRatio/);
    expect(err({ dnb: { voices: { lead: { kind: "voice", level: 1, presence: 3 }, pad: { kind: "glass", level: 1, strike: 0.3, strikeRatio: 2, strikeBars: 16 } } } })).toBe("");
  });
});

describe("the Liquid DnB pack", () => {
  it("is valid, baked, and its nine styles are 170..176 BPM in nine keys", () => {
    expect(validatePack(liquidDnb)).toEqual([]);
    expect(PACKS["liquid-dnb"]).toBe(liquidDnb);
    const styles = liquidDnb.styles.liquid!;
    expect(styles.length).toBe(9);
    for (const s of styles) {
      expect(s.bpm![0]).toBeGreaterThanOrEqual(170);
      expect(s.bpm![1]).toBeLessThanOrEqual(176);
    }
    expect(new Set(styles.map((s) => s.keys![0])).size).toBe(9);
  });

  it("schedules deterministically, and every style differs", () => {
    const program = programFromPack(liquidDnb);
    const era = eraById("liquid");
    const hashes = liquidDnb.styles.liquid!.map((s) => {
      let epoch = 0;
      while (styleOf(era, epoch, program).style.id !== s.id) epoch++;
      const h = schedule(epoch, program, 30, 20);
      expect(schedule(epoch, program, 30, 20)).toBe(h);
      return h;
    });
    expect(new Set(hashes).size).toBe(9);
  });
});
