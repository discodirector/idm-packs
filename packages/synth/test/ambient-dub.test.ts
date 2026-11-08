import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { VoiceEngine } from "../src/engine.ts";
import { eraById, initialState, planSteps, programFromPack, stylesAt, type Program } from "../src/index.ts";
import ambientDub from "../src/stations/ambient-dub.ts";
import ambientDub2 from "../src/stations/ambient-dub-2.ts";
import { AMBIENT_DUB_FROM } from "../src/eras.ts";

// The IDM station's Ambient Dub (eras.ts AMBIENT_DUB_FROM, styles.ts AMBIENT_DUB_STYLES) is the two Ambient Dub packs'
// twenty styles under the house genre "ambientdub", played by the dub techno renderer. Each must schedule exactly what
// the same style schedules in its pack (the sound the owner approved), on a stand-in context that logs every node,
// connection, parameter write and buffer (as test/attention.test.ts and scripts/engine-trace.ts do).

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
    const fn = function () {};
    return new Proxy(fn, {
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

/** A busy stretch of chain states with heat (pack.test.ts schedule()), full song-form section from bar 16. */
function trace(genre: string, program: Program, epoch: number, seconds = 30) {
  const busy = (k: number) => ({
    ...initialState(),
    patternId: epoch * 4 + (k % 4),
    pattern: 0x9249_2492_4924_9249n ^ BigInt(k * 0x1357),
    bass: 0x8421_8421_8421_8421n >> BigInt(k % 5),
    heat: Math.min(1, k / 6),
    pressure: (k % 3) * 3000 - 3000,
    lastTick: k * 400,
  });
  const points = Array.from({ length: 8 }, (_, k) => ({ time: k * 4, state: busy(k) }));
  const { ctx, log } = recordingContext();
  const engine = new VoiceEngine(ctx, eraById(genre).index, epoch, program);
  for (const hit of planSteps(points, seconds, genre, 16, program)) if (hit.time < seconds) engine.trigger(hit);
  return createHash("sha256").update(log.join("\n")).digest("hex");
}

describe("Ambient Dub on the IDM station", () => {
  const packStyles = [...ambientDub.styles.dubtechno, ...ambientDub2.styles.dubtechno];
  const house = stylesAt("ambientdub", AMBIENT_DUB_FROM);

  it("the twenty pack styles, in the packs' order", () => {
    expect(house.map((s) => s.id)).toEqual(packStyles.map((s) => s.id.replace(/^ambient-dub-/, "")));
    expect(house.map((s) => s.name)).toEqual(packStyles.map((s) => s.name));
  });

  it("each schedules exactly what it schedules in its pack (same epoch, same states)", () => {
    for (const [i, style] of house.entries()) {
      const pack = i < 10 ? ambientDub : ambientDub2;
      const packProgram = programFromPack(pack);
      const resolved = packProgram.styles[0].styles.dubtechno!.find((s) => s.id === packStyles[i].id)!;
      const asPack: Program = { key: "t-pack", eras: [{ fromEpoch: 0, ids: ["dubtechno"] }], styles: [{ fromEpoch: 0, styles: { dubtechno: [resolved] } }] };
      const asHouse: Program = { key: "t-house", eras: [{ fromEpoch: 0, ids: ["ambientdub"] }], styles: [{ fromEpoch: 0, styles: { ambientdub: [style] } }] };
      for (const epoch of [AMBIENT_DUB_FROM + i, 777]) {
        expect(trace("ambientdub", asHouse, epoch), `${style.name} @${epoch}`).toBe(trace("dubtechno", asPack, epoch));
      }
    }
  });

  it("the styles differ (the trace is not empty)", () => {
    const one = (k: number): Program => ({ key: `t-${k}`, eras: [{ fromEpoch: 0, ids: ["ambientdub"] }], styles: [{ fromEpoch: 0, styles: { ambientdub: [house[k]] } }] });
    expect(new Set(house.map((_, k) => trace("ambientdub", one(k), 777))).size).toBe(20);
  });

  it("no heat riser: every style turns the riser off", () => {
    for (const style of house) expect(style.riser, style.name).toBe(0);
  });
});
