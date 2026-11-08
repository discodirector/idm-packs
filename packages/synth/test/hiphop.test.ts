import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { VoiceEngine } from "../src/engine.ts";
import {
  eraById,
  eraOf,
  HOUSE_PROGRAM,
  initialState,
  instanceKey,
  PACKS,
  planSteps,
  programFromPack,
  styleOf,
  validatePack,
  type Program,
  type StationPack,
} from "../src/index.ts";
import hiphopTrap from "../src/stations/hiphop-trap.ts";

// The hip-hop beat (styledata.ts HipHopSpec): an opt-in table of trip-hop classic. Left out, Rhodes Break schedules
// exactly the house (the engine trace and pack.test.ts check that); given, the beat plays; the pack validates.

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

/** The hash of what a trip-hop engine schedules at `epoch` in `program` over a busy stretch from bar `bar`. */
function schedule(epoch: number, program: Program, seconds = 40, bar = 8): string {
  const { ctx, log } = recordingContext();
  const engine = new VoiceEngine(ctx, eraById("triphop").index, epoch, program);
  const busy = (k: number) => ({
    ...initialState(),
    patternId: 4 * epoch + (k % 4),
    pattern: 0x9249_ffff_4924_9249n ^ BigInt(k * 0x1357),
    bass: 0x8421_8421_8421_8421n >> BigInt(k % 5),
    heat: 0.4,
    lastTick: k * 400,
  });
  const points = Array.from({ length: 8 }, (_, k) => ({ time: k * 5, state: busy(k) }));
  for (const hit of planSteps(points, seconds, "triphop", bar, program)) if (hit.time < seconds) engine.trigger(hit);
  return createHash("sha256").update(log.join("\n")).digest("hex");
}

const copy = (): any => JSON.parse(JSON.stringify(hiphopTrap));
const one = (style: object) => ({ key: "hh", name: "Hh", genres: ["triphop"], styles: { triphop: [style] }, patches: hiphopTrap.patches }) as unknown as StationPack;
let classicEpoch = 0;
while (!(eraOf(classicEpoch).id === "triphop" && styleOf(eraById("triphop"), classicEpoch).style.id === "classic")) classicEpoch++;

describe("the hip-hop beat (opt-in)", () => {
  it("the pack validates and is baked", () => {
    expect(validatePack(hiphopTrap)).toEqual([]);
    expect(PACKS["hiphop-trap"]).toBe(hiphopTrap);
  });

  it("each style keeps its own key, and the players name it", () => {
    const program = programFromPack(hiphopTrap);
    const era = eraById("triphop");
    const keys = hiphopTrap.styles.triphop!.map((s, i) => {
      expect(styleOf(era, i, program).style.id).toBe(s.id);
      expect(instanceKey(era, i, program)).toBe(s.keys![0]);
      return s.keys![0];
    });
    expect(new Set(keys).size).toBe(5);
  });

  it("a style with the beat schedules something else than Rhodes Break, the same every time, each style its own", () => {
    const house = schedule(classicEpoch, HOUSE_PROGRAM);
    const seen = new Set<string>();
    for (const style of hiphopTrap.styles.triphop!) {
      const program = programFromPack(one({ ...style, id: "hh-x" }));
      const a = schedule(0, program);
      expect(a).not.toBe(house);
      expect(schedule(0, program)).toBe(a);
      seen.add(a);
    }
    expect(seen.size).toBe(5);
  });

  it("the lanes, the glides and the half steps change what plays", () => {
    const base = copy().styles.triphop[1];
    const at = (change: (s: any) => void) => {
      const s = JSON.parse(JSON.stringify(base));
      s.id = "hh-x";
      change(s);
      expect(validatePack(one(s))).toEqual([]);
      return schedule(0, programFromPack(one(s)));
    };
    const ref = at(() => {});
    expect(at((s) => (s.data.hiphop.beats[0].hat = s.data.hiphop.beats[0].hat.replace(/[rtq]/g, "7")))).not.toBe(ref);
    expect(at((s) => s.data.hiphop.basslines[0].forEach((n: any) => delete n.glide))).not.toBe(ref);
    expect(at((s) => (s.data.hiphop.beats[0].kick = s.data.hiphop.beats[0].kick.replace("H", "9")))).not.toBe(ref);
    expect(at((s) => (s.data.hiphop.bass = { ...s.data.hiphop.bass, mode: "synth", level: 1 }))).not.toBe(ref);
  });

  it("v2's opt-in sound (the reverb, the voices, the patch fields) changes what plays; each left out plays without it", () => {
    const at = (i: number, change: (s: any) => void) => {
      const s = copy().styles.triphop[i];
      s.id = "hh-x";
      change(s);
      expect(validatePack(one(s))).toEqual([]);
      return schedule(0, programFromPack(one(s)));
    };
    for (const i of [0, 2, 4]) {
      const ref = at(i, () => {});
      expect(at(i, (s) => delete s.data.fx.verb)).not.toBe(ref);
      expect(at(i, (s) => delete s.data.hiphop.voices)).not.toBe(ref);
      expect(at(i, (s) => (s.data.hiphop.voices[0].pan = 0.9))).not.toBe(ref);
    }
    const lofi = at(2, () => {});
    for (const field of ["wow", "trem", "index"]) expect(at(2, (s) => delete s.data.hiphop.keysLayers[0].params[field])).not.toBe(lofi);
    for (const field of ["chiff", "wow", "blipTime"]) {
      const p = copy();
      const st = p.styles.triphop[2];
      st.id = "hh-x";
      const patch = { ...p.patches[st.leads[0]] };
      delete patch[field];
      const pack = { ...one(st), patches: { ...p.patches, [st.leads[0]]: patch } } as unknown as StationPack;
      expect(validatePack(pack)).toEqual([]);
      expect(schedule(0, programFromPack(pack))).not.toBe(lofi);
    }
    const drill = at(3, () => {});
    expect(at(3, (s) => delete s.data.hiphop.voices[1].chord)).not.toBe(drill);
    expect(at(3, (s) => (s.data.hiphop.voices[1].parts = ["breakdown"]))).not.toBe(drill);
  });

  it("v3's opt-in layers, lanes and bus processing change what plays; each left out plays without it", () => {
    const at = (i: number, change: (s: any) => void) => {
      const s = copy().styles.triphop[i];
      s.id = "hh-x";
      change(s);
      expect(validatePack(one(s))).toEqual([]);
      return schedule(0, programFromPack(one(s)));
    };
    for (const i of [0, 1, 2, 3, 4]) {
      const ref = at(i, () => {});
      expect(at(i, () => {})).toBe(ref);
      for (const field of ["melodyLayers", "bassLayers", "padLayers", "kickLayers"]) {
        expect(at(i, (s) => delete s.data.hiphop[field])).not.toBe(ref);
      }
      // Keys without a patch are their layers: a layer's level then changes what plays.
      const keys = copy().styles.triphop[i].data.hiphop.keys;
      if (keys?.patch) expect(at(i, (s) => delete s.data.hiphop.keysLayers)).not.toBe(ref);
      if (keys) expect(at(i, (s) => (s.data.hiphop.keysLayers[0].level *= 0.5))).not.toBe(ref);
      for (const field of ["glue", "tape"]) expect(at(i, (s) => delete s.data.fx[field])).not.toBe(ref);
      expect(at(i, (s) => (s.data.hiphop.padLayers[0].params = { ...s.data.hiphop.padLayers[0].params, bright: 0 }))).not.toBe(ref);
    }
    const boombap = at(0, () => {});
    expect(at(0, (s) => s.data.hiphop.beats.forEach((b: any) => delete b.shaker))).not.toBe(boombap);
    expect(at(0, (s) => delete s.data.fx.excite)).not.toBe(boombap);
    expect(at(0, (s) => (s.data.hiphop.voices[1].layers[0].parts = ["full"]))).not.toBe(boombap);
    // A voice with only layers (no patch) and keys with only layers play.
    expect(at(0, (s) => (s.data.hiphop.voices[0].layers = undefined))).not.toBe(boombap);
    // The bass at level 0 leaves the 808 to its layers; back at a level it plays under them.
    const trap = at(1, () => {});
    expect(at(1, (s) => (s.data.hiphop.bass.level = 1))).not.toBe(trap);
  });

  const bad: [string, (h: any, d: any) => void, RegExp][] = [
    ["a layer of an unknown voice", (h) => (h.keysLayers[0].voice = "theremin"), /keysLayers\[0\]\.voice/],
    ["a layer param out of its range", (h) => (h.keysLayers[0].params.index = 99), /keysLayers\[0\]\.params\.index/],
    ["a layer param the voice does not have", (h) => (h.keysLayers[0].params.cutoff = 900), /params\.cutoff: not a parameter of fmKeys/],
    ["a layer an octave too far", (h) => (h.padLayers[0].oct = 3), /padLayers\[0\]\.oct/],
    ["a voice with neither a patch nor layers", (h) => delete h.voices[1].layers, /voices\[1\]: give it a patch, layers or both/],
    ["a shaker lane without its voice", (h) => delete h.shaker, /hiphop\.shaker: the beats play a shaker lane/],
    ["keys without a patch or layers", (h) => delete h.keysLayers, /keys\.patch: missing \(or give keysLayers\)/],
    ["seven voices", (h) => (h.voices = Array.from({ length: 7 }, () => h.voices[1])), /voices: expected 1\.\.6 entries/],
    ["a glue ratio of 20", (_, d) => (d.fx.glue.drums.ratio = 20), /glue\.drums\.ratio/],
    ["a tape drive of 5", (_, d) => (d.fx.tape.drums = 5), /tape\.drums/],
    ["a voice note past its bars", (h) => (h.voices[0].figures[0][0].s = 130), /voices\[0\]/],
    ["a voice on an unknown bus", (h) => (h.voices[0].bus = "kick"), /voices\[0\]\.bus/],
    ["a voice patch's tremolo deeper than 1", (h) => (h.voices[0].patch.trem = { rate: 4, depth: 2 }), /trem\.depth/],
    ["a reverb longer than 6 s", (_, d) => (d.fx.verb.decay = 9), /verb\.decay/],
    ["a lane of the wrong length", (h) => (h.beats[0].kick = h.beats[0].kick.slice(0, 16)), /beats\[0\]\.kick: expected 32 characters/],
    ["an unknown lane character", (h) => (h.beats[0].hat = "x".repeat(32)), /beats\[0\]\.hat/],
    ["a chord index outside the chords", (h) => (h.progression = [0, 9]), /progression\[1\]/],
    ["a note off the 32nd grid", (h) => (h.basslines[0][0].s = 0.3), /basslines\[0\]\[0\]\.s/],
    ["a bass note past its bars", (h) => (h.basslines[0][0].s = 70), /basslines\[0\]\[0\]\.s: expected under 64/],
    ["melodies without their length", (h) => delete h.melodyBars, /melodyBars: missing/],
    ["a chord of two tones", (h) => (h.chords[0] = [0, 7]), /chords\[0\]/],
    ["a Rhodes Break table beside the beat", (_, d) => (d.sub = 0.5), /data\.sub: Rhodes Break's table does nothing beside hiphop/],
  ];
  for (const [what, breakIt, message] of bad) {
    it(`rejects ${what}`, () => {
      const p = copy();
      breakIt(p.styles.triphop[0].data.hiphop, p.styles.triphop[0].data);
      expect(validatePack(p).join("\n")).toMatch(message);
    });
  }
  it("rejects the beat on Bristol Dark (only classic reads it)", () => {
    const p = copy();
    p.styles.triphop[0].base = "bristol";
    expect(validatePack(p).join("\n")).toMatch(/data\.hiphop: base "bristol" does not read it/);
  });
});
