import { describe, expect, it } from "vitest";
import { applyReleaseCut, CUT_SECONDS, LOOP_BARS, nullTest, planReleaseCuts, releaseBarTimes, seamlessLoop, shortCut, wrapJump, type Pcm } from "../src/cuts.ts";
import { initialState, planRelease, type SequencerState } from "../src/index.ts";
import { curveShape, DEFAULT_STEMS, shareCurve } from "../src/engine.ts";
import { BUS_NAMES } from "../src/styledata.ts";

const SR = 1000;
const tone = (seconds: number, hz: number): Pcm => {
  const n = Math.round(seconds * SR);
  const ch = new Float32Array(n);
  // A ramp under the tone, so a plain cut jumps at its wrap.
  for (let i = 0; i < n; i++) ch[i] = 0.5 * Math.sin((2 * Math.PI * hz * i) / SR) + 0.3 * (i / n);
  return { channels: [ch, ch.slice()], sampleRate: SR };
};

describe("seamlessLoop", () => {
  it("is exactly the bars long and its wrap continues the track", () => {
    const pcm = tone(10, 3);
    const loop = seamlessLoop(pcm, 2, 6, 0.5);
    expect(loop.channels[0].length).toBe(4 * SR);
    // Sample 0 is the track's sample after the loop's last one.
    expect(loop.channels[0][0]).toBeCloseTo(pcm.channels[0][6 * SR], 6);
    expect(loop.channels[0][loop.channels[0].length - 1]).toBeCloseTo(pcm.channels[0][6 * SR - 1], 6);
    // From the fade on, the body untouched.
    expect(loop.channels[0][SR]).toBe(pcm.channels[0][3 * SR]);
    const { wrap, maxStep } = wrapJump(loop);
    expect(wrap).toBeLessThanOrEqual(maxStep * 1.01);
  });

  it("is linear: loops of parts sum to the loop of the whole", () => {
    const a = tone(10, 3);
    const b = tone(10, 7);
    const whole: Pcm = { channels: a.channels.map((ch, c) => ch.map((x, i) => x + b.channels[c][i])), sampleRate: SR };
    const parts = [seamlessLoop(a, 1, 5), seamlessLoop(b, 1, 5)];
    expect(nullTest(seamlessLoop(whole, 1, 5), parts).residualRmsDb).toBeLessThan(-100);
  });
});

describe("shortCut", () => {
  it("is exactly the length asked for and ends in silence", () => {
    const cut = shortCut(tone(40, 5), 2, 15, 2);
    const ch = cut.channels[0];
    expect(ch.length).toBe(15 * SR);
    expect(Math.abs(ch[0])).toBeLessThan(1e-6);
    expect(Math.abs(ch[ch.length - 1])).toBeLessThan(1e-3);
  });
});

describe("stems", () => {
  it("default stems hold every bus once", () => {
    const buses = DEFAULT_STEMS.flatMap((s) => s.buses);
    expect([...buses].sort()).toEqual([...BUS_NAMES].sort());
  });

  it("the share curve times x is the shaper", () => {
    const curve = new Float32Array(1025);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / 1024) * 2 - 1) * 1.55) / Math.tanh(1.55);
    const f = curveShape(curve);
    const share = curveShape(shareCurve(f));
    for (const x of [-3, -1, -0.37, -0.001, 0, 0.0004, 0.2, 0.9, 1.5, 6]) {
      expect(share(x / 8) * x).toBeCloseTo(f(x), 5);
    }
  });
});

describe("planReleaseCuts", () => {
  const base = (): SequencerState => ({ ...initialState(), heat: 0, trackNo: 0 });
  const track = (n: number) => {
    let pattern = base().pattern;
    const swaps = Array.from({ length: n }, (_, i) => {
      pattern |= 1n << BigInt((i * 7) % 64);
      return { state: { ...base(), pattern, swapCount: i + 1, heat: i === n - 1 ? 1 : Math.min(1, Math.max(0, (i - n + 16) / 16)) } };
    });
    return { seed: base(), swaps, next: { ...base(), patternId: 1, trackNo: 1 } };
  };

  it("plans every loop and cut of a full release on bar lines, in a fixed order", () => {
    const plan = planRelease(track(90));
    const cuts = planReleaseCuts(plan);
    expect(cuts.map((c) => c.id)).toEqual([...LOOP_BARS.map((n) => `loop-${n}bar`), ...CUT_SECONDS.map((s) => `cut-${s}s`)]);
    const times = releaseBarTimes(plan);
    for (const c of cuts) {
      expect(c.start).toBe(times[c.bar]);
      expect(c.start + c.seconds).toBeLessThanOrEqual(plan.seconds);
      if (c.kind === "loop") {
        expect(c.seconds).toBeCloseTo(times[c.bar + c.bars!] - times[c.bar], 9);
        // Never in the intro or the outro.
        expect(c.bar).toBeGreaterThanOrEqual(plan.introBars);
        expect(c.bar + c.bars!).toBeLessThanOrEqual(plan.bars - plan.outroBars);
      } else expect(c.start + c.seconds).toBeLessThanOrEqual(plan.fadeAt);
    }
    expect(planReleaseCuts(plan)).toEqual(cuts);
  });

  it("leaves out what does not fit a short release", () => {
    const plan = planRelease(track(12), { minSeconds: 0, maxSeconds: 40 });
    const cuts = planReleaseCuts(plan);
    expect(cuts.every((c) => c.start + c.seconds <= plan.seconds)).toBe(true);
    expect(cuts.some((c) => c.id === "cut-60s")).toBe(false);
  });

  it("cuts PCM to the planned lengths, loops seamless, cuts ending in silence", () => {
    const plan = planRelease(track(90));
    const sr = 2000;
    const n = Math.ceil(plan.seconds * sr);
    const ch = new Float32Array(n);
    for (let i = 0; i < n; i++) ch[i] = 0.4 * Math.sin((2 * Math.PI * 55 * i) / sr) + 0.2 * Math.sin(i / 3000);
    const pcm: Pcm = { channels: [ch, ch.slice()], sampleRate: sr };
    for (const c of planReleaseCuts(plan)) {
      const out = applyReleaseCut(pcm, c);
      expect(out.channels[0].length).toBe(c.kind === "loop" ? Math.round((c.start + c.seconds) * sr) - Math.round(c.start * sr) : Math.round(c.seconds * sr));
      if (c.kind === "cut") expect(Math.abs(out.channels[0].at(-1)!)).toBeLessThan(1e-2);
      else expect(wrapJump(out).wrap).toBeLessThanOrEqual(wrapJump(out).maxStep * 1.01);
    }
  });
});
