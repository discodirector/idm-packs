import { describe, expect, it } from "vitest";
import { createHost, finishSample, inSamplePacks, isMuted, LIBRARY, paramsOf, playSample, presetGain, sampleMidis, samplePacks, sfzOf, VOICES } from "../src/voices/index.ts";

// The voice library's catalog (src/voices): every shelf filled, every preset reachable, every voice and preset playable.
// Fidelity to the approved packs is checked in the browser (web/scripts/voice-library/fidelity.mjs: bit-identical).

/** A stand-in BaseAudioContext: every node accepts every call; counts the nodes made and the sources started. */
function fakeContext() {
  const stats = { nodes: 0, started: 0, stopped: 0 };
  const node = (): any =>
    new Proxy(function () {}, {
      get(_, prop) {
        if (prop === "then" || typeof prop === "symbol") return undefined;
        if (prop === "start") return () => stats.started++;
        if (prop === "stop") return () => stats.stopped++;
        if (prop === "getChannelData") return () => new Float32Array(64);
        if (prop === "value" || prop === "sampleRate") return prop === "sampleRate" ? 44100 : 0;
        return node();
      },
      set: () => true,
      apply: () => node(),
    });
  const ctx: any = new Proxy({}, {
    get(_, prop) {
      if (prop === "sampleRate") return 44100;
      if (prop === "createBuffer") return (ch: number, n: number) => ({ getChannelData: () => new Float32Array(n), length: n, numberOfChannels: ch });
      if (typeof prop === "string" && prop.startsWith("create")) return () => (stats.nodes++, node());
      return node();
    },
  });
  return { ctx, stats };
}

describe("voice library catalog", () => {
  it("fills every shelf, with unique ids", () => {
    const shelves = new Set(LIBRARY.map((v) => v.category));
    expect([...shelves].sort()).toEqual(["bass", "bells", "brass", "choirs", "drums", "fx", "keys", "leads", "pads", "plucks", "strings"]);
    expect(new Set(LIBRARY.map((v) => v.id)).size).toBe(LIBRARY.length);
  });

  it("names a preferred preset that exists, and documents rules", () => {
    for (const v of LIBRARY) {
      if (v.preferred) expect(v.presets[v.preferred], v.id).toBeDefined();
      expect(v.doc.length, v.id).toBeGreaterThan(20);
      expect(Object.keys(v.presets).length, v.id).toBeGreaterThan(0);
    }
  });

  it("keeps numeric presets inside the module's ranges", () => {
    for (const v of LIBRARY) {
      if (!v.ranges) continue;
      for (const [name, p] of Object.entries(v.presets)) {
        for (const [k, x] of Object.entries(p as Record<string, unknown>)) {
          const r = (v.ranges as Record<string, readonly [number, number]>)[k];
          if (!r || typeof x !== "number") continue;
          expect(x >= r[0] && x <= r[1], `${v.id} ${name} ${k}=${x} not in ${r}`).toBe(true);
        }
      }
    }
  });

  it("plays every voice with every preset, starting and stopping its sources", () => {
    for (const v of LIBRARY) {
      for (const name of Object.keys(v.presets)) {
        const { ctx, stats } = fakeContext();
        const h = createHost(ctx, ctx.destination);
        v.play(h, { time: 0.1, freq: 110, length: 0.5, vel: 0.9, pan: 0.1, bright: 0.8, seed: 7, chord: [0, 3, 7] }, paramsOf(v, name));
        expect(stats.nodes, `${v.id} ${name}`).toBeGreaterThan(0);
        expect(stats.started, `${v.id} ${name}`).toBeGreaterThan(0);
        expect(stats.stopped, `${v.id} ${name}`).toBe(stats.started);
      }
    }
  });

  it("keeps Hip-Hop & Trap v3's VOICES map (the re-pointing API)", () => {
    expect(Object.keys(VOICES).sort()).toEqual(["analogPad", "bassStack", "brass", "fmBell", "fmKeys", "moogLead", "pluck", "strings", "supersaw", "vox"]);
  });
});

describe("sample packs", () => {
  const packs = samplePacks();

  it("put every sounding preset of the library in exactly one pack, with unique file names", () => {
    const all = packs.flatMap((p) => p.presets.map((x) => `${x.voice}:${x.preset}`));
    const muted = LIBRARY.flatMap((v) => Object.keys(v.presets).filter((p) => isMuted(paramsOf(v, p))).map((p) => `${v.id}:${p}`));
    // The library's later shelves (sources with no sample pack yet) are not in the packs.
    const want = LIBRARY.flatMap((v) => Object.keys(v.presets).filter((p) => inSamplePacks(v, p)).map((p) => `${v.id}:${p}`)).filter((k) => !muted.includes(k));
    expect([...all].sort()).toEqual([...want].sort());
    // The two 808 presets the trap and drill styles played at level 0 (their bass is bassStack).
    expect(muted.sort()).toEqual(["bass808:drill", "bass808:trap"]);
    expect(presetGain(0.5)).toBeCloseTo(2 * 10 ** (-1 / 20), 9);
    expect(presetGain(0)).toBe(1);
    const slugs = packs.flatMap((p) => p.presets.map((x) => x.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    const files = packs.flatMap((p) => p.presets.flatMap((x) => x.notes.map((n) => n.file)));
    expect(new Set(files).size).toBe(files.length);
    for (const p of packs) expect(p.id).toMatch(/^[a-z0-9][a-z0-9-]{0,31}$/);
  });

  it("names no station and no team: drums by part and world, film presets by their cue", () => {
    const text = JSON.stringify(packs.map((p) => [p.title, p.blurb, p.presets.map((x) => [x.slug, x.notes.map((n) => n.file)])]));
    expect(text).not.toMatch(/hamster|squeek|credits|inception|hiphop\./i);
    expect(packs.find((p) => p.id === "idm-drums")!.presets.every((x) => x.mode === "one-shot")).toBe(true);
  });

  it("samples melodic voices every minor third over at most two octaves of their register, keys covered without gaps", () => {
    for (const v of LIBRARY.filter((v) => v.category !== "drums")) {
      const m = sampleMidis(v.register);
      expect(m[0]).toBeGreaterThanOrEqual(v.register[0]);
      expect(m.at(-1)!).toBeLessThanOrEqual(v.register[1]);
      expect(m.at(-1)! - m[0]!).toBeLessThanOrEqual(24);
    }
    for (const x of packs.flatMap((p) => p.presets).filter((x) => x.mode === "multi")) {
      for (let k = 1; k < x.notes.length; k++) expect(x.notes[k]!.lokey).toBe(x.notes[k - 1]!.hikey + 1);
      const sfz = sfzOf(x, "IDM Voices");
      for (const n of x.notes) expect(sfz).toContain(`sample=${n.file} lokey=${n.lokey} hikey=${n.hikey} pitch_keycenter=${n.midi}`);
    }
  });

  it("every planned note plays (stand-in context)", () => {
    for (const x of packs.flatMap((p) => p.presets)) {
      const { ctx, stats } = fakeContext();
      playSample(ctx, x, x.notes[0]!);
      expect(stats.started).toBeGreaterThan(0);
    }
  });

  it("trims a sample after its last audible frame and fades it to zero", () => {
    const ch = new Float32Array(44100);
    for (let i = 0; i < 4410; i++) ch[i] = 0.5 * Math.sin(i / 10);
    const [out] = finishSample([ch, ch.slice()]);
    expect(out!.length).toBeLessThan(4410 + 441 + 2);
    expect(out!.length).toBeGreaterThan(4400);
    expect(out!.at(-1)).toBe(0);
  });
});
