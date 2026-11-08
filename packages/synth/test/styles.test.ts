import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AMBIENT_DUB_FROM, ERA_SCHEDULE, ERAS, eraOf, IDM_GENRES_BACK, IMD_AMBIENT_DUB_FROM } from "../src/eras.ts";
import { IMD_ETH_PROGRAM } from "../src/program.ts";
import type { Program } from "../src/program.ts";
import { allStyles, GENRE_STYLES, STYLE_SCHEDULE, styleById, styleListAt, styleOf, stylesAt, type StyleScheduleEntry } from "../src/styles.ts";
import { SYNTH_VERSION } from "../src/version.ts";

// The style of a past epoch must never change once the app is live: bot posts and releases name it.
// FROZEN_EPOCHS covers epochs 0..4095 ("<genre index>:<style id>" per epoch, comma-joined). If this test fails, a change
// rewrote history: revert it and append a STYLE_SCHEDULE entry from a future epoch instead. Only raise FROZEN_EPOCHS
// with a digest that still matches the old prefix.
const FROZEN_EPOCHS = 4096;
// Pinned 2026-10-18, before launch: the owner's style order, one launch list per genre (STYLE_SCHEDULE entry 0).
const FROZEN_STYLES_SHA256 = "74f243f88d39de86ce8ee56863bb221e2ea67c4718797755d7a62376961a19b7";

// The launch schedules alone (entry 0 of each): FROZEN_STYLES_SHA256 pins them.
const LAUNCH: Program = { key: "launch", eras: [ERA_SCHEDULE[0]], styles: [STYLE_SCHEDULE[0]] };
// Pinned 2026-11-02: the launch (genre, style) up to AMBIENT_DUB_FROM, Ambient Dub's first two styles (epochs 91-92),
// then the launch genres again from IDM_GENRES_BACK, their styles still in turn.
const FROZEN_STYLES_SHA256_IDM_BACK = "1de054d665e656a68e1977befaee324110bb797a1b0942b7da5a7f055eaeae8b";

const sequence = (n: number, schedule?: readonly StyleScheduleEntry[] | Program) =>
  Array.from({ length: n }, (_, e) => {
    const era = eraOf(e, schedule && !Array.isArray(schedule) ? (schedule as Program) : undefined);
    return `${era.index}:${styleOf(era, e, schedule).style.id}`;
  });

describe("style history", () => {
  it("the launch (genre, style) walk is unchanged", () => {
    const seq = sequence(FROZEN_EPOCHS, LAUNCH).join(",");
    expect(createHash("sha256").update(seq).digest("hex")).toBe(FROZEN_STYLES_SHA256);
  });

  it("every epoch before Ambient Dub keeps its (genre, style); epochs 91-92 play Ambient Dub's first two styles", () => {
    expect(sequence(AMBIENT_DUB_FROM)).toEqual(sequence(AMBIENT_DUB_FROM, LAUNCH));
    const list = stylesAt("ambientdub", AMBIENT_DUB_FROM);
    expect(list.length).toBe(20);
    for (let e = AMBIENT_DUB_FROM; e < IDM_GENRES_BACK; e++) expect(styleOf(eraOf(e), e).style.id).toBe(list[e - AMBIENT_DUB_FROM].id);
  });

  it("the (genre, style) of every frozen epoch is unchanged", () => {
    const seq = sequence(FROZEN_EPOCHS).join(",");
    expect(createHash("sha256").update(seq).digest("hex")).toBe(FROZEN_STYLES_SHA256_IDM_BACK);
  });

  it("IMD/ETH: the house (genre, style) until its epoch 11, then Ambient Dub's twenty styles in turn", () => {
    expect(sequence(IMD_AMBIENT_DUB_FROM, IMD_ETH_PROGRAM)).toEqual(sequence(IMD_AMBIENT_DUB_FROM));
    const list = stylesAt("ambientdub", IMD_AMBIENT_DUB_FROM, IMD_ETH_PROGRAM);
    expect(list.map((s) => s.id)).toEqual(stylesAt("ambientdub", AMBIENT_DUB_FROM).map((s) => s.id));
    for (let k = 0; k < 45; k++) {
      const e = IMD_AMBIENT_DUB_FROM + k;
      expect(styleOf(eraOf(e, IMD_ETH_PROGRAM), e, IMD_ETH_PROGRAM).style.id).toBe(list[k % 20].id);
    }
  });

  it("the schedule starts at epoch 0, only moves forward, and covers every genre", () => {
    expect(STYLE_SCHEDULE[0].fromEpoch).toBe(0);
    for (let i = 1; i < STYLE_SCHEDULE.length; i++) {
      expect(STYLE_SCHEDULE[i].fromEpoch).toBeGreaterThan(STYLE_SCHEDULE[i - 1].fromEpoch);
    }
    // Every genre of a pool has a list in force from the pool's first epoch.
    for (const entry of ERA_SCHEDULE) for (const id of entry.ids) expect(styleListAt(id, entry.fromEpoch).fromEpoch).toBeLessThanOrEqual(entry.fromEpoch);
    for (const era of ERAS) expect(GENRE_STYLES[era.id].length).toBeGreaterThan(0);
  });

  it("a style id means one sound: ids are unique per list, and a reused id keeps its definition", () => {
    for (const era of ERAS) {
      const seen = new Map<string, unknown>();
      for (const entry of STYLE_SCHEDULE) {
        const list = entry.styles[era.id] ?? [];
        expect(new Set(list.map((s) => s.id)).size).toBe(list.length);
        for (const st of list) {
          if (seen.has(st.id)) expect(st).toEqual(seen.get(st.id));
          seen.set(st.id, st);
        }
      }
    }
  });

  it("appearances walk the list round-robin", () => {
    for (const era of ERAS) {
      const n = stylesAt(era.id, 0).length;
      let k = 0;
      for (let e = 0; e < 400; e++) {
        if (eraOf(e).index !== era.index) continue;
        expect(styleOf(era, e).index).toBe(k % n);
        k++;
      }
    }
  });

  it("the synth version matches package.json", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(SYNTH_VERSION).toBe(pkg.version);
  });
});

describe("style schedule: an appended entry (test only)", () => {
  // A dummy fourth Acid style and a reordered Liquid list from epoch 1000; the other genres are left out.
  const acid = STYLE_SCHEDULE[0].styles.acid!;
  const liquid = STYLE_SCHEDULE[0].styles.liquid!;
  const FROM = 1000;
  const dummy = { id: "dummy", name: "Dummy", trim: 1 };
  // Over the launch genre order (the house pool is Ambient Dub alone from AMBIENT_DUB_FROM).
  const schedule: Program = {
    key: "test",
    eras: LAUNCH.eras,
    styles: [STYLE_SCHEDULE[0], { fromEpoch: FROM, styles: { acid: [dummy, ...acid], liquid: [liquid[2], liquid[0], liquid[1]] } }],
  };

  it("epochs before fromEpoch keep their style", () => {
    expect(sequence(FROM, schedule)).toEqual(sequence(FROM, LAUNCH));
  });

  it("from fromEpoch the new list rotates from its first style, counting appearances since fromEpoch", () => {
    for (const id of ["acid", "liquid"] as const) {
      const era = ERAS.find((e) => e.id === id)!;
      const list = styleListAt(id, FROM, schedule).styles;
      let k = 0;
      for (let e = FROM; e < FROM + 300; e++) {
        if (eraOf(e, schedule).index !== era.index) continue;
        expect(styleOf(era, e, schedule).style.id).toBe(list[k % list.length].id);
        k++;
      }
      expect(k).toBeGreaterThan(list.length);
    }
  });

  it("genres the entry leaves out keep their rotation", () => {
    const after = sequence(FROM + 300, schedule).slice(FROM);
    const before = sequence(FROM + 300, LAUNCH).slice(FROM);
    after.forEach((x, i) => {
      const g = Number(x.split(":")[0]);
      if (g !== ERAS.find((e) => e.id === "acid")!.index && g !== ERAS.find((e) => e.id === "liquid")!.index) expect(x).toBe(before[i]);
    });
  });

  it("every style ever defined is listed and found by id", () => {
    expect(allStyles("acid", schedule).map((s) => s.id)).toEqual([...acid.map((s) => s.id), "dummy"]);
    expect(allStyles("liquid", schedule).map((s) => s.id)).toEqual(liquid.map((s) => s.id));
    const era = ERAS.find((e) => e.id === "acid")!;
    for (const st of GENRE_STYLES.acid) expect(styleById(era, st.id).style).toBe(st);
  });
});
