import { describe, expect, it } from "vitest";
import { LIBRARY, paramsOf } from "../src/voices/index.ts";
import { NEW_LIBRARY, NEW_LIBRARY_BY_ID, NEW_RENDERERS, renderNote } from "../src/voices/new/index.ts";
import { ENTRIES, PHRASES } from "../src/voices/new/audition.ts";
import type { Renderer } from "../src/voices/new/dsp/core.ts";
import type { VoiceNote } from "../src/voices/types.ts";

// The new voices (src/voices/new, docs/sound/VOICE-LIBRARY-NEW.md): every voice and preset renders finite, bounded
// notes that end on exactly 0, deterministically from the seed, in tune, with the timbre rules the owner set.

const SR = 44100;
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const R = NEW_RENDERERS as Record<string, Renderer>;
const note = (midi: number, extra: Partial<VoiceNote> = {}): VoiceNote => ({ time: 0, freq: mtof(midi), length: 0.4, vel: 0.8, pan: 0, bright: 0.85, seed: 1234, ...extra });
const render = (id: string, preset: string | undefined, n: VoiceNote, sr = SR) => renderNote(R[id], n, paramsOf(NEW_LIBRARY_BY_ID[id], preset), sr);
const mid = (id: string) => {
  const [a, b] = NEW_LIBRARY_BY_ID[id].register;
  return Math.round((a + b) / 2);
};

/** Pitch error in cents by normalised autocorrelation around the expected period. */
function centsOff(x: Float32Array, from: number, len: number, f: number, sr = SR) {
  const P = sr / f;
  const ac = (l: number) => {
    let s = 0;
    for (let i = from; i < from + len; i++) s += x[i] * x[i + l];
    return s;
  };
  let best = -Infinity;
  let bl = 0;
  for (let l = Math.floor(P * 0.94); l <= Math.ceil(P * 1.06); l++) {
    const v = ac(l);
    if (v > best) {
      best = v;
      bl = l;
    }
  }
  const a = ac(bl - 1);
  const b = ac(bl);
  const c = ac(bl + 1);
  const d = (a - c) / (2 * (a - 2 * b + c));
  return 1200 * Math.log2(sr / (bl + d) / f);
}

/** Energy of x at frequency fr (a windowed DFT bin). */
function at(x: Float32Array, from: number, n: number, fr: number) {
  let re = 0;
  let im = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
    const s = x[from + i] * w;
    re += s * Math.cos((2 * Math.PI * fr * i) / SR);
    im += s * Math.sin((2 * Math.PI * fr * i) / SR);
  }
  return re * re + im * im;
}

describe("new voices: catalog", () => {
  it("has unique ids that do not collide with the library's", () => {
    const ids = NEW_LIBRARY.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    const old = new Set(LIBRARY.map((v) => v.id));
    for (const id of ids) expect(old.has(id), id).toBe(false);
    expect(ids.length).toBeGreaterThanOrEqual(12);
  });

  it("names only known params in presets, and a preferred preset that exists", () => {
    for (const v of NEW_LIBRARY) {
      for (const [name, p] of Object.entries(v.presets)) for (const k of Object.keys(p)) expect(k in v.defaults, `${v.id}.${name}.${k}`).toBe(true);
      if (v.preferred) expect(v.presets[v.preferred], v.id).toBeDefined();
      expect(R[v.id], v.id).toBeTypeOf("function");
    }
  });

  it("auditions every voice, on phrases that exist", () => {
    for (const [id, preset, kind] of ENTRIES) {
      expect(NEW_LIBRARY_BY_ID[id].presets[preset], `${id}:${preset}`).toBeDefined();
      expect(PHRASES[kind], kind).toBeDefined();
    }
    expect(new Set(ENTRIES.map((e) => e[0]))).toEqual(new Set(NEW_LIBRARY.map((v) => v.id)));
  });
});

describe("new voices: every preset renders", () => {
  for (const v of NEW_LIBRARY)
    for (const preset of Object.keys(v.presets))
      it(`${v.id} · ${preset}: finite, bounded, sounding, ends on exactly 0 (44.1 and 48 kHz)`, () => {
        for (const sr of [44100, 48000]) {
          const r = render(v.id, preset, note(mid(v.id), { length: 0.35 }), sr);
          let pk = 0;
          for (const ch of [r.L, r.R].filter(Boolean) as Float32Array[]) {
            for (const s of ch) {
              expect(Number.isFinite(s)).toBe(true);
              pk = Math.max(pk, Math.abs(s));
            }
            expect(ch[ch.length - 1]).toBe(0);
          }
          expect(pk).toBeGreaterThan(0.01);
          expect(pk).toBeLessThan(1.6);
          if (r.R) expect(r.R.length).toBe(r.L.length);
          expect(r.L.length / sr).toBeLessThan(14.01);
        }
      });
});

describe("new voices: deterministic", () => {
  it("the same note renders the same samples; another seed differs", () => {
    for (const v of NEW_LIBRARY) {
      const a = render(v.id, undefined, note(mid(v.id)));
      const b = render(v.id, undefined, note(mid(v.id)));
      expect(a.L).toEqual(b.L);
      const c = render(v.id, undefined, note(mid(v.id), { seed: 99 }));
      const n = Math.min(a.L.length, c.L.length);
      let diff = 0;
      for (let i = 0; i < n; i++) diff += Math.abs(a.L[i] - c.L[i]);
      if (v.id !== "rubberSub") expect(diff, v.id).toBeGreaterThan(0);
    }
  });
});

describe("new voices: in tune", () => {
  const pitched: [string, number[]][] = [
    ["guitar", [45, 57, 69]], ["physHarp", [48, 67, 84]], ["koto", [60, 72]], ["uprightBass", [33, 45]], ["clav", [55, 67]],
    ["physWurli", [57, 69]], ["uprightPiano", [48, 60, 72]], ["kalimba", [67, 79]], ["bowedStrings", [36, 48, 60, 72, 79]],
    ["softBrass", [50, 62]], ["wideReese", [33]], ["rubberSub", [33, 40]], ["sawLead", [64, 76]], ["choir", [57, 69]],
  ];
  for (const [id, notes] of pitched)
    it(`${id} within 10 cents`, () => {
      for (const m of notes) {
        const p = { ...paramsOf(NEW_LIBRARY_BY_ID[id]), ...(id === "bowedStrings" ? { players: 1, vib: 0 } : {}), ...(id === "choir" ? { voices: 1, vib: 0, detune: 0 } : {}) };
        const r = renderNote(R[id], note(m, { length: 1 }), p, SR);
        const c = centsOff(r.L, Math.round(0.35 * SR), 4096, mtof(m));
        expect(Math.abs(c), `${id} @${m}: ${c.toFixed(1)} c`).toBeLessThan(10);
      }
    });
});

describe("new voices: the owner's timbre rules", () => {
  it("kalimba is tuned to the chord: under 1% of its energy between harmonics", () => {
    const f = mtof(69);
    const r = render("kalimba", undefined, note(69, { length: 1 }));
    let harm = 0;
    let between = 0;
    for (let h = 1; h <= 8; h++) {
      harm += at(r.L, 400, 8192, h * f);
      between += at(r.L, 400, 8192, (h + 0.5) * f);
    }
    expect(between / harm).toBeLessThan(0.01);
  });

  it("the round clap has no hissy tail: 150 ms on it is 40 dB down, and little energy above 10 kHz", () => {
    const r = render("roundClap", "round", note(39, { length: 0.1 }));
    let pk = 0;
    for (const s of r.L) pk = Math.max(pk, Math.abs(s));
    let tail = 0;
    for (let i = Math.round(0.15 * SR); i < r.L.length; i++) tail = Math.max(tail, Math.abs(r.L[i]));
    expect(20 * Math.log10(tail / pk)).toBeLessThan(-40);
    let hi = 0;
    let all = 0;
    for (let k = 1; k < 160; k++) {
      const e = at(r.L, 0, 4096, k * 125);
      all += e;
      if (k * 125 > 10000) hi += e;
    }
    expect(hi / all).toBeLessThan(0.02);
  });

  it("the Wurlitzer and the upright bark with velocity: harmonics 2-4 rise against the fundamental", () => {
    for (const id of ["physWurli", "uprightPiano"]) {
      const f = mtof(57);
      const ratio = (vel: number) => {
        const r = render(id, undefined, note(57, { vel, length: 0.8 }));
        const h1 = at(r.L, 1000, 8192, f);
        let up = 0;
        for (let h = 2; h <= 4; h++) up += at(r.L, 1000, 8192, h * f * (id === "uprightPiano" ? Math.sqrt(1 + 0.0004 * 0.6 * h * h) : 1));
        return up / h1;
      };
      expect(ratio(1) / ratio(0.3), id).toBeGreaterThan(2);
    }
  });

  it("sustained voices stay calm above 5 kHz (strings, brass, choir)", () => {
    for (const [id, m] of [["bowedStrings", 60], ["softBrass", 57], ["choir", 64]] as const) {
      const r = render(id, undefined, note(m, { length: 1 }));
      let hi = 0;
      let all = 0;
      for (let k = 1; k < 160; k++) {
        const e = at(r.L, Math.round(0.4 * SR), 4096, k * 125);
        all += e;
        if (k * 125 > 5000) hi += e;
      }
      expect(hi / all, id).toBeLessThan(0.01);
    }
  });

  it("the bass voices keep the low end mono", () => {
    for (const id of ["uprightBass", "rubberSub"]) expect(render(id, undefined, note(33)).R, id).toBeNull();
    const r = render("wideReese", undefined, note(33, { length: 1 }));
    // Below the crossover L and R are the same: their difference is quiet at the fundamental.
    const side = new Float32Array(r.L.length);
    const midS = new Float32Array(r.L.length);
    for (let i = 0; i < side.length; i++) {
      side[i] = r.L[i] - r.R![i];
      midS[i] = r.L[i] + r.R![i];
    }
    expect(at(side, 8000, 8192, mtof(33)) / at(midS, 8000, 8192, mtof(33))).toBeLessThan(0.01);
  });
});

describe("new voices: through a VoiceHost", () => {
  it("plays one buffer source per note: mono voices panned (or centred), stereo voices hard left / right", () => {
    const made: string[] = [];
    const outs: number[] = [];
    let centred = 0;
    let started = 0;
    const node = (): any => ({ connect: () => undefined, gain: { value: 1 } });
    const ctx: any = {
      sampleRate: SR,
      createBuffer: (ch: number, n: number) => {
        made.push(`buffer${ch}`);
        const data = Array.from({ length: ch }, () => new Float32Array(n));
        return { getChannelData: (c: number) => data[c], length: n };
      },
      createBufferSource: () => (made.push("source"), { ...node(), buffer: null, start: () => started++, stop: () => undefined }),
      createChannelSplitter: () => (made.push("splitter"), node()),
      createGain: () => node(),
    };
    const h: any = { ctx, out: (_n: unknown, pan: number) => (outs.push(pan), []), center: () => (centred++, []), play: (s: any[], _n: unknown, t: number, end: number) => s.forEach((x) => (x.start(t), expect(end).toBeGreaterThan(t))) };
    NEW_LIBRARY_BY_ID.rim.play(h, note(37, { pan: 0.3 }), paramsOf(NEW_LIBRARY_BY_ID.rim));
    expect(outs).toEqual([0.3]);
    NEW_LIBRARY_BY_ID.rubberSub.play(h, note(33), paramsOf(NEW_LIBRARY_BY_ID.rubberSub));
    expect(centred).toBe(1);
    NEW_LIBRARY_BY_ID.choir.play(h, note(64), paramsOf(NEW_LIBRARY_BY_ID.choir));
    expect(outs).toEqual([0.3, -1, 1]);
    expect(made).toEqual(["buffer1", "source", "buffer1", "source", "buffer2", "source", "splitter"]);
    expect(started).toBe(3);
  });
});
