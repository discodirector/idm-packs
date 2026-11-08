import { describe, expect, it } from "vitest";
import { validatePack, type StationPack } from "../src/pack.ts";
import rh2, { APEX3, merge, PHASE0, PHASE3, SET, STREET } from "../src/stations/rally-house-2.ts";

// Rally House phase 0 (docs/sound/RALLY-HOUSE-2.md): the patches validate, merge deeply, and bad values are refused.
// Off by default: engine-trace --ref HEAD stays identical (the house and the baked packs schedule what they did).

describe("rally house phase 3: the material changes every 8-bar phrase", () => {
  it("no two neighbouring phrases share all their tables, and the same combination waits 32+ bars", () => {
    const all: [string, any][] = [["pit-lane-p3", PHASE3["v2-pit-lane"]], ["apex-p3", APEX3], ...Object.entries(SET).map(([id, x]) => [id, x.patch] as [string, any])];
    for (const [id, patch] of all) {
      const ph = { stabs: [0], basslines: [0], motifs: [0], calls: [0], progressions: [0], ...(patch.data as any).ukg.phrases };
      const state = (k: number) => ["stabs", "basslines", "motifs", "calls", "progressions"].map((t) => ph[t][k % ph[t].length]).join();
      for (let k = 0; k < 12; k++) {
        expect(state(k), `${id} phrase ${k}`).not.toBe(state(k + 1));
        for (let j = 1; j < 4; j++) expect(state(k), `${id} phrase ${k} vs ${k + j}`).not.toBe(state(k + j));
      }
    }
  });
});

describe("rally house phase 5: no vocal but in Apex, a quarter of it", () => {
  it("silences the hook in four styles and keeps Apex's to the second form's build, drop and rebuild", () => {
    for (const style of rh2.styles.futuregarage!) {
      const u = (style.data as any).ukg;
      if (style.id === "rh-apex") {
        expect(u.vox?.level ?? 1).toBeGreaterThan(0);
        expect(u.chop).toMatchObject({ in: ["build", "full", "rebuild"], alt: 1 });
      } else expect(u.vox.level, style.id).toBe(0);
      expect(u.bed.level, `${style.id} keeps the pad`).toBeGreaterThan(0);
    }
  });
});

describe("rally house phase 6: each style its own top voice", () => {
  it("names four different library voices for the riffs, Gridlock keeping its organ stab", () => {
    const tops = rh2.styles.futuregarage!.map((s) => (s.data as any).ukg.library?.motif?.voice ?? null);
    expect(tops).toEqual(["physRhodes", "waveguidePluck", null, "softBrass", "clav"]);
    expect(validatePack(rh2)).toEqual([]);
  });
});

describe("rally house phase 0", () => {
  it("validates the set", () => {
    expect(validatePack(rh2)).toEqual([]);
    expect(rh2.styles.futuregarage!.map((s) => s.id)).toEqual(["rh-apex", "rh-pit-lane", "rh-gridlock", "rh-slipstream", "rh-night-shift"]);
  });

  it("patches deeply: objects field by field, lists replaced", () => {
    const a = { data: { ukg: { sub: { level: 0.5, drive: 0.4 }, keys: [6, 8] } } };
    expect(merge(a, { data: { ukg: { sub: { level: 0.9 }, keys: [7] } } })).toEqual({ data: { ukg: { sub: { level: 0.9, drive: 0.4 }, keys: [7] } } });
    expect((PHASE0["rally-replay"] as any).bpm).toEqual([139, 139]);
    expect((STREET as any).data.ukg.street.clipDrums).toBeGreaterThan((PHASE0["v2-pit-lane"] as any).data.ukg.street.clipDrums);
  });

  it("refuses out-of-range street and sub values", () => {
    const style = rh2.styles.futuregarage![0] as any;
    const withUkg = (ukg: object): StationPack => ({ ...rh2, styles: { futuregarage: [{ ...style, data: { ...style.data, ukg: { ...style.data.ukg, ...ukg } } }] } }) as StationPack;
    const errs = (ukg: object) => validatePack(withUkg(ukg)).join("\n");
    expect(errs({ street: { cut: 12 } })).toMatch(/cut: expected a number in 0..9/);
    expect(errs({ street: { shelfHz: 9000 } })).toMatch(/shelfHz/);
    expect(errs({ street: { clipMaster: -1 } })).toMatch(/clipMaster/);
    expect(errs({ street: { reverb: 1 } })).toMatch(/unknown field/);
    expect(errs({ sub: { h2: 2 } })).toMatch(/h2: expected a number in 0..1/);
    expect(errs({ street: { bassWidth: 2 } })).toMatch(/bassWidth: expected a number in 0..1/);
    expect(errs({ street: { bassWidth: 0.3 } })).toBe("");
    expect(errs({ phrases: { stabs: [0, 1, 2], motifs: [0] } })).toBe("");
    expect(errs({ phrases: { stabs: [9] } })).toMatch(/phrases.stabs\[0\]/);
    expect(errs({ phrases: { drums: [0] } })).toMatch(/unknown field/);
    expect(errs({ voc: { bright: 0.8, wide: 0.6 } })).toBe("");
    expect(errs({ voc: { bright: 2 } })).toMatch(/bright: expected a number in 0..1/);
  });
});
