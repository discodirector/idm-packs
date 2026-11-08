import { describe, expect, it } from "vitest";
import { bedTiming, integratedLufs, limit, master, planBed, peakingEq, samplePeakDbfs, truePeakDbfs, type BedEnding } from "../src/bed.ts";
import type { Pcm } from "../src/cuts.ts";

const SR = 44100;
const sine = (seconds: number, hz: number, amp: number, sr = SR): Pcm => {
  const n = Math.round(seconds * sr);
  const ch = new Float32Array(n);
  for (let i = 0; i < n; i++) ch[i] = amp * Math.sin((2 * Math.PI * hz * i) / sr);
  return { channels: [ch, ch.slice()], sampleRate: sr };
};

describe("bedTiming", () => {
  const RANGES: [number, number][] = [
    [119, 123],
    [124, 130],
    [164, 170],
    [76, 90],
    [44, 58],
  ];
  const ENDINGS: BedEnding[] = ["natural", "button", "fade"];
  it("lands the drop on a beat at the second asked, inside the style's range when it can", () => {
    for (const range of RANGES) {
      for (const seconds of [6, 15, 30, 60, 90, 120, 47.3]) {
        for (const ending of ENDINGS) {
          const dropAt = seconds / 3;
          const t = bedTiming(seconds, dropAt, ending, range);
          const beat = 60 / t.tempo;
          expect(t.preBeats * beat).toBeCloseTo(dropAt, 9);
          if (ending !== "fade") {
            expect(t.endTime + t.tail).toBeCloseTo(seconds, 9);
            expect(t.endTime - dropAt).toBeCloseTo(t.postBars * 4 * beat, 9);
            expect(t.tail).toBeGreaterThan(0.2);
          }
          if (seconds >= 15) expect(t.widened).toBeLessThanOrEqual(0.04);
        }
      }
    }
  });

  it("makes a loop a whole number of bars exactly the length asked", () => {
    for (const range of RANGES) {
      const t = bedTiming(60, null, "loop", range);
      expect(t.postBars * (240 / t.tempo)).toBeCloseTo(60, 9);
    }
  });
});

describe("planBed", () => {
  it("is deterministic and puts the drop's impact exactly on the second asked", () => {
    const req = { genre: "dubtechno", style: "classic", seconds: 30, dropAt: 10, ending: "button", seed: 7 } as const;
    const a = planBed(req);
    const b = planBed(req);
    expect(JSON.stringify(a.hits, (_, v) => (typeof v === "bigint" ? v.toString() : v))).toBe(JSON.stringify(b.hits, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
    const drops = a.hits.filter((h) => h.trackDrop);
    expect(drops[0].time).toBeCloseTo(10, 9);
    expect(drops[0].step).toBe(0);
    // The button: the last hit, on the end's bar line, an impact.
    const last = a.hits.at(-1)!;
    expect(last.trackDrop).toBe(true);
    expect(last.gridTime).toBeCloseTo(a.timing.endTime, 9);
    expect(a.seconds).toBe(30);
    expect(a.timing.tempo).toBeGreaterThanOrEqual(119);
    expect(a.timing.tempo).toBeLessThanOrEqual(123);
  });

  it("keeps the voice-over arrangement free of the roll and the snare fills", () => {
    const p = planBed({ genre: "lofihouse", style: "classic", seconds: 60, dropAt: 20, ending: "natural", voiceover: true, seed: 3 });
    expect(p.formBars).not.toContain(31);
    for (const h of p.hits) {
      const snares = Number((h.state.pattern >> 16n) & 0xffffn).toString(2).replace(/0/g, "").length;
      const glitch = Number((h.state.pattern >> 48n) & 0xffffn);
      expect(snares).toBeLessThan(4);
      expect(glitch).toBe(0);
    }
  });

  it("plans loops with two bars of pre- and post-roll", () => {
    const p = planBed({ genre: "ambientidm", style: "classic", seconds: 60, ending: "loop", seed: 2 });
    expect(p.loop!.end - p.loop!.start).toBeCloseTo(60, 9);
    expect(p.layout.length).toBe(p.timing.postBars + 4);
    expect(p.hits.some((h) => h.trackDrop)).toBe(false);
  });

  it("resolves a station pack's style", () => {
    const p = planBed({ genre: "ambientdub", style: "sodium", seconds: 15, dropAt: 5, seed: 1 });
    expect(p.genre.style).toBe("sodium");
  });
});

describe("loudness and limiter", () => {
  it("reads a 997 Hz sine at -20 dBFS in both channels at about -20 LUFS", () => {
    // BS.1770: a 0 dBFS 1 kHz sine in one channel reads -3.01 LUFS; in two, about 0.
    const l = integratedLufs(sine(5, 997, 10 ** (-20 / 20)));
    expect(l).toBeGreaterThan(-20.2);
    expect(l).toBeLessThan(-19.8);
  });

  it("limits to the ceiling and masters to the target", () => {
    const loud = sine(4, 220, 1.5);
    const { pcm } = limit(loud, -1.5);
    expect(samplePeakDbfs(pcm)).toBeLessThanOrEqual(-1.5 + 1e-6);
    const m = master(sine(6, 330, 0.05));
    expect(Math.abs(m.lufs + 14)).toBeLessThan(0.1);
    expect(m.peakDbfs).toBeLessThanOrEqual(-1.5 + 1e-6);
  });

  it("dips the speech band and leaves the lows", () => {
    const db = (p: Pcm) => 20 * Math.log10(Math.max(...p.channels[0].slice(SR)));
    expect(db(peakingEq(sine(2, 2000, 0.5), 2000, 0.7, -4)) - db(sine(2, 2000, 0.5))).toBeCloseTo(-4, 1);
    expect(Math.abs(db(peakingEq(sine(2, 80, 0.5), 2000, 0.7, -4)) - db(sine(2, 80, 0.5)))).toBeLessThan(0.1);
  });
});

describe("bed form", () => {
  it("has exactly the bars the timing asks for, at every drop", () => {
    for (let dropAt = 0.5; dropAt < 100; dropAt += 3.7) {
      const p = planBed({ genre: "dubtechno", style: "classic", seconds: 120, dropAt, ending: "button", seed: 1 });
      const drop = p.hits.find((h) => h.trackDrop)!;
      expect(drop.time).toBeCloseTo(dropAt, 9);
      expect(p.hits.at(-1)!.gridTime).toBeCloseTo(p.timing.endTime, 9);
    }
  });
});

describe("bed stings", () => {
  it("fit a half-second pickup even in a narrow fast range (a 16th pickup, the range widened)", () => {
    const p = planBed({ genre: "liquid", style: "atmos", seconds: 2, dropAt: 0.5, ending: "button", seed: 1 });
    expect(p.hits.find((h) => h.trackDrop)!.time).toBeCloseTo(0.5, 9);
  });
});

describe("true peak", () => {
  it("catches the peak between samples and the limiter keeps it under the ceiling", () => {
    // A sine at fs/4 phase-shifted by 45°: every sample at 0.707 of the true peak.
    const n = 44100;
    const ch = new Float32Array(n);
    for (let i = 0; i < n; i++) ch[i] = Math.sin((Math.PI / 2) * i + Math.PI / 4);
    const pcm = { channels: [ch, ch.slice()], sampleRate: 44100 };
    expect(samplePeakDbfs(pcm)).toBeCloseTo(-3.01, 1);
    expect(truePeakDbfs(pcm)).toBeGreaterThan(-0.5);
    expect(truePeakDbfs(limit(pcm, -1.5).pcm)).toBeLessThan(-1.3);
  });
});
