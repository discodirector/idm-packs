import { describe, expect, it } from "vitest";
import { HOUSE_PROGRAM } from "../src/program.ts";
import { programFromPack, validatePack, type StationPack } from "../src/pack.ts";
import rallyHouse from "../src/stations/rally-house.ts";
import rallyV2 from "../src/stations/rally-house-v2.ts";
import v2Tracks from "../src/stations/synth-v2-tracks.ts";
import { makeV2Dsp, type V2Event } from "../src/v2/dsp.ts";
import { V2_PRESETS, V2_VOICE_NAMES } from "../src/v2/presets.ts";
import { chopShape, programUsesV2, resolveV2, v2WorkletSource } from "../src/v2/voices.ts";

// Synth v2 (docs/sound/SYNTH-V2.md): the DSP core is deterministic and well behaved, the worklet module is the same
// code sample for sample, the pack slots validate. In-browser bit identity of whole renders: web/scripts/synth-v2.

const SR = 44100;
const CHORD = [60, 64, 67, 71];

/** An event of preset `name` as the engine would make it (voices.ts playV2). */
function eventOf(name: keyof typeof V2_PRESETS, over: Partial<V2Event> = {}, extra: Record<string, unknown> = {}): V2Event {
  const r = resolveV2({ level: 1, voice: name })!;
  const bass = name.endsWith("Bass");
  return {
    kind: r.kind,
    notes: name === "chop" ? [] : bass ? [45] : CHORD,
    vel: 0.85,
    hold: 0.5,
    seed: 1234,
    gain: r.gain,
    pan: 0,
    width: 0.5,
    from: 0,
    glide: 0,
    alive: { drift: r.alive.drift, driftRate: r.alive.driftRate, wander: r.alive.wander, envVar: r.alive.envVar, velBright: r.alive.velBright },
    p: { ...r.p, ...(name === "chop" ? { chord: [3, 7, 10, 14], root: 57, semi: 5 } : {}), ...extra },
    ...over,
  };
}

const peakOf = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
/** Amplitude of frequency f in x (a Hann-windowed DFT bin). */
function amp(x: Float32Array, f: number, from = 0, to = x.length): number {
  let re = 0;
  let im = 0;
  for (let i = from; i < to; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i - from)) / (to - from));
    re += x[i] * w * Math.cos((2 * Math.PI * f * i) / SR);
    im += x[i] * w * Math.sin((2 * Math.PI * f * i) / SR);
  }
  return Math.hypot(re, im) / ((to - from) / 4);
}

describe("synth v2 dsp", () => {
  it("renders every preset finite, bounded, ending on exactly 0", () => {
    const dsp = makeV2Dsp();
    for (const name of V2_VOICE_NAMES) {
      const { L, R } = dsp.renderEvent(eventOf(name), SR, 8);
      expect(L.length, name).toBeGreaterThan(SR * 0.3);
      expect(L.length, `${name} ends before the 8 s cap`).toBeLessThan(SR * 8);
      for (const ch of [L, R]) {
        expect(ch.every(Number.isFinite), name).toBe(true);
        expect(peakOf(ch), name).toBeGreaterThan(0.005);
        expect(peakOf(ch), name).toBeLessThan(2);
        expect(ch[ch.length - 1], `${name} last sample`).toBe(0);
      }
    }
  });

  it("is deterministic: the same event renders the same samples, in a fresh core too", () => {
    for (const name of V2_VOICE_NAMES) {
      const a = makeV2Dsp().renderEvent(eventOf(name), SR, 4);
      const dsp = makeV2Dsp();
      dsp.renderEvent(eventOf(name, { seed: 99 }), SR, 4); // other events first: no shared state leaks in
      const b = dsp.renderEvent(eventOf(name), SR, 4);
      expect(Buffer.from(b.L.buffer).equals(Buffer.from(a.L.buffer)), name).toBe(true);
      expect(Buffer.from(b.R.buffer).equals(Buffer.from(a.R.buffer)), name).toBe(true);
    }
  });

  it("is alive: another seed plays the note a little differently", () => {
    const dsp = makeV2Dsp();
    for (const name of ["rhodes", "analogPad", "ladderBass", "fmEp", "morphPad", "pluck"] as const) {
      const a = dsp.renderEvent(eventOf(name), SR, 1).L;
      const b = dsp.renderEvent(eventOf(name, { seed: 77 }), SR, 1).L;
      let diff = 0;
      for (let i = 0; i < Math.min(a.length, b.length); i++) diff = Math.max(diff, Math.abs(a[i] - b[i]));
      expect(diff, name).toBeGreaterThan(1e-4);
    }
  });

  it("opens with velocity: a hard Rhodes has more upper harmonics (the pickup's bark) than a soft one", () => {
    const dsp = makeV2Dsp();
    const ratio = (vel: number) => {
      const { L } = dsp.renderEvent(eventOf("rhodes", { notes: [57], vel, alive: { drift: 0, driftRate: 0.3, wander: 0, envVar: 0, velBright: 0.75 } }), SR, 1);
      const a = Math.round(0.03 * SR);
      const b = Math.round(0.3 * SR);
      const f = 220;
      return (amp(L, 2 * f, a, b) + amp(L, 3 * f, a, b)) / amp(L, f, a, b);
    };
    expect(ratio(1)).toBeGreaterThan(3 * ratio(0.3));
  });

  it("keeps the bell tuned: its partials are harmonics of the note", () => {
    const { L } = makeV2Dsp().renderEvent(eventOf("bell", { notes: [69], alive: { drift: 0, driftRate: 0.3, wander: 0, envVar: 0, velBright: 0.6 } }), SR, 2);
    const a = Math.round(0.05 * SR);
    const b = Math.round(0.8 * SR);
    let harmonic = 0;
    let between = 0;
    for (let k = 1; k <= 8; k++) {
      harmonic += amp(L, 440 * k, a, b) ** 2;
      between += amp(L, 440 * (k + 0.5), a, b) ** 2;
    }
    expect(between / harmonic).toBeLessThan(1e-3);
  });

  it("glides a bass from the previous note", () => {
    const dsp = makeV2Dsp();
    const a = dsp.renderEvent(eventOf("ladderBass"), SR, 0.3).L;
    const b = dsp.renderEvent(eventOf("ladderBass", { from: 55, glide: 0.06 }), SR, 0.3).L;
    expect(Buffer.from(a.buffer).equals(Buffer.from(b.buffer))).toBe(false);
  });

  it("repitches the chop like a sampler: up a fifth plays shorter", () => {
    const dsp = makeV2Dsp();
    const len = (semi: number) => dsp.renderEvent(eventOf("chop", { hold: 3 }, { semi, s: 1, d: 5 }), SR, 4).L.length;
    expect(len(7)).toBeLessThan(len(0) * 0.75);
  });
});

describe("synth v2 chop source", () => {
  it("plays the same from a source made elsewhere (the main thread) as from its own", () => {
    const ev = eventOf("chop");
    const src = makeV2Dsp().chopSource(ev, SR);
    const a = makeV2Dsp().renderEvent(ev, SR);
    const b = makeV2Dsp().renderEvent({ ...ev, p: { ...ev.p, src } }, SR);
    expect(b.L).toEqual(a.L);
    expect(b.R).toEqual(a.R);
  });
});

describe("synth v2 worklet", () => {
  it("is the dsp core, sample for sample, from its start frame", () => {
    const registered: Record<string, any> = {};
    const scope = { sampleRate: SR, currentFrame: 0 };
    class Proc {
      port = { postMessage: () => undefined };
    }
    const run = new Function("AudioWorkletProcessor", "registerProcessor", "scope", `with (scope) { ${v2WorkletSource()} }`);
    run(Proc, (name: string, cls: any) => (registered[name] = cls), scope);
    const P = registered["imd-v2"];
    expect(P).toBeTruthy();
    const ev = eventOf("rhodes");
    const start = 300.37 / SR; // lands inside the third block
    const proc = new P({ processorOptions: { ...ev, start, live: false } });
    const L: number[] = [];
    const R: number[] = [];
    let alive = true;
    for (let block = 0; alive && block < 2000; block++) {
      scope.currentFrame = block * 128;
      const out = [new Float32Array(128), new Float32Array(128)];
      alive = proc.process([], [out]);
      L.push(...out[0]);
      R.push(...out[1]);
    }
    const ref = makeV2Dsp().renderEvent(ev, SR);
    const at = Math.round(start * SR);
    expect(L.slice(0, at).every((x) => x === 0)).toBe(true);
    // Both end on a block boundary of their own (the worklet's blocks are offset by the start): compare the overlap,
    // the rest is silence.
    const n = Math.min(L.length - at, ref.L.length);
    expect(n).toBeGreaterThan(ref.L.length - 128);
    expect(Float32Array.from(L.slice(at, at + n))).toEqual(ref.L.slice(0, n));
    expect(Float32Array.from(R.slice(at, at + n))).toEqual(ref.R.slice(0, n));
    expect(ref.L.slice(n).every((x) => x === 0)).toBe(true);
    expect(alive).toBe(false);
  });
});

describe("synth v2 pack slots", () => {
  it("validates the lab pack, and only the lab pack uses v2", () => {
    expect(validatePack(rallyV2)).toEqual([]);
    expect(programUsesV2(programFromPack(rallyV2))).toBe(true);
    expect(programUsesV2(programFromPack(rallyHouse))).toBe(false);
    expect(programUsesV2(HOUSE_PROGRAM)).toBe(false);
  });

  it("validates the round-2 tracks, every style on v2 voices", () => {
    expect(validatePack(v2Tracks)).toEqual([]);
    expect(programUsesV2(programFromPack(v2Tracks))).toBe(true);
    for (const style of v2Tracks.styles.futuregarage!) expect(Object.keys((style.data as any).ukg.v2).length, style.id).toBeGreaterThan(1);
  });

  it("rejects bad slots", () => {
    const withV2 = (v2: unknown): StationPack => {
      const style = rallyV2.styles.futuregarage![0] as any;
      return { ...rallyV2, styles: { futuregarage: [{ ...style, data: { ...style.data, ukg: { ...style.data.ukg, v2 } } }] } } as StationPack;
    };
    const errs = (v2: unknown) => validatePack(withV2(v2)).join("\n");
    expect(errs({ keys: { level: 1, voice: "rhodes" } })).toBe("");
    expect(errs({ keys: { level: 1, voice: "theremin" } })).toMatch(/voice: expected one of/);
    expect(errs({ keys: { level: 1, voice: "chop" } })).toMatch(/only plays in the chop slot/);
    expect(errs({ chop: { level: 1, voice: "rhodes" } })).toMatch(/the chop slot plays the "chop" voice/);
    expect(errs({ keys: { level: 1, voice: "rhodes", p: { cutoff: 900 } } })).toMatch(/not a parameter of the rhodes voice/);
    expect(errs({ bass: { level: 1, voice: "ladderBass", p: { res: 2 } } })).toMatch(/res: expected a number in 0..0.99/);
    expect(errs({ bass: { level: 1, voice: "ladderBass", p: { filter: "sallen" } } })).toMatch(/filter: expected one of/);
    expect(errs({ keys: { level: 1, voice: "rhodes", p: { modes: [[1, 1]] } } })).toMatch(/modes\[0\]/);
    expect(errs({ pad: { level: 1, voice: "analogPad", alive: { drift: 99 } } })).toMatch(/drift: expected a number/);
    expect(errs({ lead: { level: 1, voice: "rhodes" } })).toMatch(/unknown field/);
    expect(errs({ motif: { level: 1, voice: "mallet", in: ["full"] } })).toBe("");
    expect(errs({ motif: { level: 1, voice: "mallet", max: 1 } })).toMatch(/max: unknown field/);
    expect(errs({ keys: { level: 1, voice: "rhodes", in: ["full"] } })).toMatch(/in: unknown field/);
  });

  it("shapes chop chords rootless from the third", () => {
    expect(chopShape([60, 64, 67, 71], 57)).toEqual([3, 7, 10, 14]); // Am9
    expect(chopShape([53, 57, 60, 64], 62)).toEqual([3, 7, 10, 14]); // Dm9: the same sample, repitched
    expect(chopShape([55, 57, 59, 62], 52)).toEqual([3, 5, 7, 10]); // Em11
  });
});
