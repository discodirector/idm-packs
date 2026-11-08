// The $IDM station's noise risers are off from IDM_RISER_OFF_FROM (styles.ts); every epoch before keeps its style as
// released, and station packs keep their own risers.
import { describe, expect, it } from "vitest";
import { eraOf, styleOf, programFromPack, IDM_RISER_OFF_FROM, HOUSE_PROGRAM, IMD_ETH_PROGRAM, PACKS, STYLE_SCHEDULE } from "../src/index.ts";

describe("IDM riser off", () => {
  it("is after the last released $IDM track (#24, epoch 93)", () => {
    expect(IDM_RISER_OFF_FROM).toBe(94);
  });

  it("keeps every earlier epoch's style object as defined", () => {
    for (let e = 0; e < IDM_RISER_OFF_FROM; e++) {
      const era = eraOf(e, HOUSE_PROGRAM);
      const { index, style } = styleOf(era, e, HOUSE_PROGRAM);
      const list = STYLE_SCHEDULE.filter((s) => s.fromEpoch <= e && s.styles[era.id]).at(-1)!.styles[era.id]!;
      expect(style).toBe(list[index]);
    }
  });

  it("turns the risers off from the switch, the same style otherwise, one stable object", () => {
    for (let e = IDM_RISER_OFF_FROM; e < IDM_RISER_OFF_FROM + 200; e++) {
      const era = eraOf(e, HOUSE_PROGRAM);
      const a = styleOf(era, e, HOUSE_PROGRAM).style;
      expect(a.riser).toBe(0);
      expect(styleOf(era, e).style).toBe(a);
      const { riser: _r, ...rest } = a;
      const list = STYLE_SCHEDULE.filter((s) => s.fromEpoch <= e && s.styles[era.id]).at(-1)!.styles[era.id]!;
      const { riser: _o, ...orig } = list[styleOf(era, e).index];
      expect(rest).toEqual(orig);
    }
  });

  it("leaves other programs alone", () => {
    for (const program of [IMD_ETH_PROGRAM, programFromPack(PACKS.hamster), programFromPack(PACKS.credits ?? PACKS.hamster)]) {
      for (let e = IDM_RISER_OFF_FROM; e < IDM_RISER_OFF_FROM + 40; e++) {
        const era = eraOf(e, program);
        const { index, style } = styleOf(era, e, program);
        const list = program.styles.filter((s) => s.fromEpoch <= e && s.styles[era.id]).at(-1)?.styles[era.id];
        if (list) expect(style).toBe(list[index]);
      }
    }
  });
});
