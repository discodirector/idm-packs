import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AMBIENT_DUB_FROM, epochOf, ERA_SCHEDULE, ERAS, eraOf, IDM_GENRES_BACK, IMD_AMBIENT_DUB_FROM, patternIdOf } from "../src/eras.ts";
import { IMD_ETH_PROGRAM } from "../src/program.ts";

// The genre of a past epoch must never change once the app is live: bot posts, recordings and replays name it.
// FROZEN_EPOCHS covers epochs 0..4095 (index digits). If this test fails, a change rewrote history: revert it and
// append an ERA_SCHEDULE entry from a future epoch instead. Only raise FROZEN_EPOCHS with a digest that still
// matches the old prefix.
const FROZEN_EPOCHS = 4096;
// Re-pinned 2026-10-18, before launch: Industrial left, the owner's first-cycle order, then shuffled cycles.
const FROZEN_SHA256 = "d8c74e5df4528a7313bae7ade5b018ca4f12e2726d8ae74470cc8249815bc426";

// The launch schedule alone (ERA_SCHEDULE entry 0): FROZEN_SHA256 pins its walk, and every epoch before the first
// appended entry still plays it.
const LAUNCH = { eras: [ERA_SCHEDULE[0]] };
// Pinned 2026-11-02: the launch walk up to AMBIENT_DUB_FROM, Ambient Dub for epochs 91-92, the ten launch genres again
// from IDM_GENRES_BACK (Ambient Dub was meant for IMD/ETH). Epochs 0-92 as in the 31c611fa… pin before it.
const FROZEN_SHA256_IDM_BACK = "d8f51e84829855968a17a59ef965ebca5c4af0ab2f83e506f1bbe85e424856f9";

describe("genre history", () => {
  it("the launch walk is unchanged", () => {
    const seq = Array.from({ length: FROZEN_EPOCHS }, (_, e) => eraOf(e, LAUNCH).index).join("");
    expect(createHash("sha256").update(seq).digest("hex")).toBe(FROZEN_SHA256);
  });

  it("every epoch before Ambient Dub plays the launch walk, then Ambient Dub until the ten genres return", () => {
    for (let e = 0; e < AMBIENT_DUB_FROM; e++) expect(eraOf(e).index, `epoch ${e}`).toBe(eraOf(e, LAUNCH).index);
    for (let e = AMBIENT_DUB_FROM; e < IDM_GENRES_BACK; e++) expect(eraOf(e).id).toBe("ambientdub");
    // Back to cycles of the ten launch genres: each cycle plays every one once, Ambient Dub never.
    const launch = new Set(ERA_SCHEDULE[0].ids);
    for (let start = IDM_GENRES_BACK; start < IDM_GENRES_BACK + 100; start += 10) {
      const cycle = Array.from({ length: 10 }, (_, k) => eraOf(start + k).id);
      expect(new Set(cycle)).toEqual(launch);
    }
  });

  it("the genre of every frozen epoch is unchanged", () => {
    const seq = Array.from({ length: FROZEN_EPOCHS }, (_, e) => eraOf(e).index).join("");
    expect(createHash("sha256").update(seq).digest("hex")).toBe(FROZEN_SHA256_IDM_BACK);
  });

  it("neighbouring epochs never share a genre while the pool has more than one", () => {
    for (let e = 1; e < FROZEN_EPOCHS; e++) if (e !== IDM_GENRES_BACK - 1) expect(eraOf(e).index, `epoch ${e}`).not.toBe(eraOf(e - 1).index);
  });

  it("IMD/ETH: pages before 44 keep their epochs; from page 44 an epoch is one page", () => {
    for (let p = 0; p <= 44; p++) expect(epochOf({ patternId: p }, IMD_ETH_PROGRAM), `page ${p}`).toBe(Math.floor(p / 4));
    for (let p = 45; p < 300; p++) expect(epochOf({ patternId: p }, IMD_ETH_PROGRAM)).toBe(p - 33);
    for (let e = 11; e < 200; e++) expect(epochOf({ patternId: patternIdOf(e, IMD_ETH_PROGRAM) }, IMD_ETH_PROGRAM)).toBe(e);
  });

  it("IMD/ETH: the house walk until its epoch 11, then Ambient Dub alone", () => {
    for (let e = 0; e < IMD_AMBIENT_DUB_FROM; e++) expect(eraOf(e, IMD_ETH_PROGRAM).index, `epoch ${e}`).toBe(eraOf(e).index);
    for (let e = IMD_AMBIENT_DUB_FROM; e < 500; e++) expect(eraOf(e, IMD_ETH_PROGRAM).id).toBe("ambientdub");
  });

  it("the schedule starts at epoch 0, only moves forward, and names real genres", () => {
    expect(ERA_SCHEDULE[0].fromEpoch).toBe(0);
    for (let i = 1; i < ERA_SCHEDULE.length; i++) {
      expect(ERA_SCHEDULE[i].fromEpoch).toBeGreaterThan(ERA_SCHEDULE[i - 1].fromEpoch);
    }
    const ids = new Set(ERAS.map((e) => e.id));
    for (const entry of ERA_SCHEDULE) for (const id of entry.ids) expect(ids.has(id)).toBe(true);
  });

  it("ERAS indices match their position (append-only list)", () => {
    ERAS.forEach((era, i) => expect(era.index).toBe(i));
  });
});
