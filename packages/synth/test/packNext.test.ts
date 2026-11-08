// A pack's appended schedule entries (pack.ts StationPack.next): a live station's music changes from a future epoch,
// every epoch before it keeps its genre and style. And the Squeekchain station's electro switch (stations/hamster.ts).
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { composerPalette, eraOf, programFromPack, sleepAt, sleepState, epochOf, styleOf, validatePack, withSleep, PACKS, SLEEP_COMPOSERS, SLEEP_SLOT_SEC, type StationPack } from "../src/index.ts";
import { SQUEEKCHAIN_ELECTRO_FROM } from "../src/stations/hamster.ts";

const base = {
  key: "t-next",
  name: "T",
  genres: ["acid", "liquid"],
  styles: { acid: [{ id: "t-a", name: "A", base: "acidhouse" }], liquid: [{ id: "t-l", name: "L", base: "classic" }] },
} as StationPack;
const electro = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t-e${i}`, name: `E${i}`, base: i % 2 ? "client03" : "alienrave" }));
const entry = (o: Record<string, unknown> = {}) => ({ fromEpoch: 40, genres: ["electro"], styles: { electro: electro(3) }, ...o });
const rows = (p: ReturnType<typeof programFromPack>, from: number, to: number) => {
  const out: string[] = [];
  for (let e = from; e < to; e++) {
    const era = eraOf(e, p);
    out.push(`${e} ${era.id} ${styleOf(era, e, p).style.id}`);
  }
  return out;
};

describe("pack next entries", () => {
  it("validate", () => {
    expect(validatePack({ ...base, next: [entry()] })).toEqual([]);
    expect(validatePack({ ...base, next: [entry({ styles: { electro: electro(16) } })] })).toEqual([]);
    // The same style again, as the same definition: fine; changed under the same id: refused.
    expect(validatePack({ ...base, next: [entry({ genres: ["acid"], styles: { acid: [base.styles.acid![0]] } })] })).toEqual([]);
    const bad: [string, unknown][] = [
      ["next", []],
      ["next", [entry({ fromEpoch: 0 })]],
      ["next[1].fromEpoch", [entry(), entry()]],
      ["next[0].x", [entry({ x: 1 })]],
      ["next[0].styles.electro", [entry({ styles: { electro: electro(17) } })]],
      ["next[0].styles.acid", [entry({ styles: { electro: electro(2), acid: base.styles.acid } })]],
      ["next[0].genres", [entry({ genres: ["electro", "electro"] })]],
      ["next[0].styles.acid[0].id", [entry({ genres: ["acid"], styles: { acid: [{ ...base.styles.acid![0], bpm: [120, 125] }] } })]],
      ["next[0].styles.electro[0].leads", [entry({ styles: { electro: [{ ...electro(1)[0], leads: ["t-nope"] }] } })]],
    ];
    for (const [path, next] of bad) expect(validatePack({ ...base, next }).some((m) => m.startsWith(path)), path).toBe(true);
    // An entry's own patches are named by its styles.
    const patch = PACKS["machine-electro"].patches!["mach-cold"];
    const withPatch = entry({ styles: { electro: [{ ...electro(1)[0], leads: ["t-cold"] }] }, patches: { "t-cold": patch } });
    expect(validatePack({ ...base, next: [withPatch] })).toEqual([]);
  });

  it("keep every epoch before the entry, then cut in its pool and walk its styles in order", () => {
    const before = programFromPack(base);
    const after = programFromPack({ ...base, next: [entry({ fromEpoch: 41 })] } as StationPack);
    expect(rows(after, 0, 41)).toEqual(rows(before, 0, 41));
    expect(rows(after, 41, 47)).toEqual([0, 1, 2, 0, 1, 2].map((k, i) => `${41 + i} electro t-e${k}`));
    expect(after.eachEpoch).toBe(true);
  });
});

describe("Squeekchain electro switch (stations/hamster.ts)", () => {
  const hamster = PACKS.hamster;
  const program = programFromPack(hamster);
  const { next: _next, ...past } = hamster;
  const old = programFromPack(past as StationPack);

  it("plays the epochs on air before the switch as before", () => {
    // Epochs 0..83 (page 155, 2026-11-03), pinned against the program before the switch (4e608da).
    expect(createHash("sha256").update(rows(program, 0, 84).join("\n")).digest("hex")).toBe("470a11ff154f817712638ab7a3b2d3443cd235995209a09b4a7ddbe2756d7179");
    expect(SQUEEKCHAIN_ELECTRO_FROM).toBeGreaterThan(83);
    expect(rows(program, 0, SQUEEKCHAIN_ELECTRO_FROM)).toEqual(rows(old, 0, SQUEEKCHAIN_ELECTRO_FROM));
    for (let e = 0; e < SQUEEKCHAIN_ELECTRO_FROM; e++) {
      const era = eraOf(e, program);
      expect(styleOf(era, e, program).style).toEqual(styleOf(era, e, old).style);
    }
  });

  it("then electro only: fourteen styles, a new one every epoch, Zero Kelvin first, the packs' exact styles", () => {
    const names = rows(program, SQUEEKCHAIN_ELECTRO_FROM, SQUEEKCHAIN_ELECTRO_FROM + 28).map((r) => r.split(" ").slice(1).join(" "));
    expect(names.every((n) => n.startsWith("electro "))).toBe(true);
    const ids = names.map((n) => n.split(" ")[1]);
    expect(ids[0]).toBe("hamster-delectro-kelvin");
    expect(new Set(ids.slice(0, 14)).size).toBe(14);
    expect(ids.slice(14)).toEqual(ids.slice(0, 14));
    for (let k = 1; k < ids.length; k++) expect(ids[k]).not.toBe(ids[k - 1]);
    const me = programFromPack(PACKS["machine-electro"]);
    const he2 = programFromPack(PACKS["hamster-electro-2"]);
    const packStyles = [...me.styles[0].styles.electro!, ...he2.styles[0].styles.electro!];
    expect(packStyles.length).toBe(11);
    for (const st of packStyles) {
      const at = SQUEEKCHAIN_ELECTRO_FROM + ids.indexOf(st.id);
      expect(styleOf(eraOf(at, program), at, program).style).toEqual(st);
    }
    // The three hamster dark electro styles are the ones on air before.
    for (const id of ["hamster-delectro-kelvin", "hamster-delectro-breach", "hamster-delectro-hypno"]) {
      const at = SQUEEKCHAIN_ELECTRO_FROM + ids.indexOf(id);
      expect(styleOf(eraOf(at, program), at, program).style).toEqual(old.styles[0].styles.electro!.find((s) => s.id === id));
    }
  });

  it("sleep mode is unchanged and the station validates as JSON (the bot sends it to the release page)", () => {
    const sleepy = withSleep(program, PACKS["hamster-sleep"]);
    expect(rows(sleepy, 0, SQUEEKCHAIN_ELECTRO_FROM + 14)).toEqual(rows(program, 0, SQUEEKCHAIN_ELECTRO_FROM + 14));
    expect(validatePack(JSON.parse(JSON.stringify(hamster)))).toEqual([]);
  });

  it("asleep, every slot plays what it played before the switch (the rig's pinned slot and the Dream Receiver piece)", () => {
    const sleep = PACKS["hamster-sleep"];
    const now = withSleep(program, sleep);
    const before = withSleep(old, sleep);
    expect(SLEEP_COMPOSERS[sleep.key]?.length).toBeGreaterThan(0);
    for (let k = 0; k < 400; k++) {
      const t = (985_000 + k) * SLEEP_SLOT_SEC + 77;
      const a = sleepAt(t - 900, t, now, sleep)!;
      const b = sleepAt(t - 900, t, before, sleep)!;
      expect(a).toEqual(b);
      // The slots pin epochs far past the switch: the electro entry must not reach them.
      expect(a.epoch).toBeGreaterThan(SQUEEKCHAIN_ELECTRO_FROM);
      expect(styleOf(a.era, a.epoch, now).style).toEqual(styleOf(b.era, b.epoch, before).style);
      const st = sleepState({ patternId: 400 } as never, a, now);
      expect(epochOf(st, now)).toBe(a.epoch);
      // The piece depends on the sleep pack and the slot only.
      expect(composerPalette(sleep.key, a.slot)).toEqual(composerPalette(sleep.key, b.slot));
    }
  });
});
