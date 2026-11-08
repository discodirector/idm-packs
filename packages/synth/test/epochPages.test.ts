// A station's own epoch length (eras.ts epochOf / patternIdOf, StationPack.epochPages): pages before `from` keep their
// epochs, from `from` on a new epoch every `every` pages; the house and stations without it are unchanged.
import { describe, expect, it } from "vitest";
import { epochOf, eraAt, patternIdOf, programFromPack, sleepAt, sleepState, styleOf, validatePack, withSleep, PACKS, type StationPack } from "../src/index.ts";

const pages = { epochPages: { from: 96, every: 1 } };

describe("epochPages", () => {
  it("leaves every page before `from` where it was, then moves on every page", () => {
    for (let p = 0; p < 96; p++) expect(epochOf({ patternId: p }, pages)).toBe(Math.floor(p / 4));
    expect([96, 97, 98, 99, 100].map((p) => epochOf({ patternId: p }, pages))).toEqual([24, 25, 26, 27, 28]);
    expect(epochOf({ patternId: 97 })).toBe(24);
    expect([10, 11, 12].map((p) => epochOf({ patternId: p }, { epochPages: { from: 10, every: 2 } }))).toEqual([2, 2, 3]);
  });

  it("patternIdOf finds a page of every epoch", () => {
    for (const r of [undefined, { from: 96, every: 1 }, { from: 10, every: 2 }, { from: 9, every: 3 }]) {
      const prog = r ? { epochPages: r } : undefined;
      for (let e = 0; e < 300; e++) expect(epochOf({ patternId: patternIdOf(e, prog) }, prog)).toBe(e);
    }
  });

  it("the hamster pack: same genres as before up to page 95, a new one each page after", () => {
    const p = programFromPack(PACKS.hamster);
    expect(p.epochPages).toEqual({ from: 96, every: 1 });
    expect(eraAt(95, null, p).id).toBe(eraAt(95, null, { ...p, epochPages: undefined }).id);
    const ids = [96, 97, 98, 99].map((pid) => `${eraAt(pid, null, p).id}:${styleOf(eraAt(pid, null, p), epochOf({ patternId: pid }, p), p).style.id}`);
    expect(new Set(ids).size).toBe(4);
  });

  it("sleep pins the slot's style under the station's epoch length", () => {
    const awake = withSleep(programFromPack(PACKS.hamster), PACKS["hamster-sleep"]);
    for (let k = 0; k < 20; k++) {
      const now = (60_000_000 + k) * 1800 + 60;
      const slot = sleepAt(now - 700, now, awake, PACKS["hamster-sleep"])!;
      const st = sleepState({ patternId: 400 } as never, slot, awake);
      expect(styleOf(slot.era, epochOf(st, awake), awake).style.id).toBe(slot.styleId);
    }
  });

  it("validates", () => {
    const base = { key: "t-pages", name: "T", genres: ["acid"], styles: { acid: [{ id: "t-a", name: "A", base: "acidhouse" }] } } as StationPack;
    expect(validatePack({ ...base, epochPages: { from: 8, every: 1 } })).toEqual([]);
    for (const bad of [{ from: -1, every: 1 }, { from: 8, every: 0 }, { from: 8, every: 5 }, { from: 8 }, { from: 8, every: 1, x: 1 }, "1"])
      expect(validatePack({ ...base, epochPages: bad }).some((m) => m.startsWith("epochPages"))).toBe(true);
  });
});
