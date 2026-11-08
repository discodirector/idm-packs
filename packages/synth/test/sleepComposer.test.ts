// The sleep composer (sleepComposer.ts): a slot's piece is the same for everyone (a pure score from the slot), the
// hamster's palettes rotate one per slot and never twice in a row, and a station without a composer has none.
import { describe, expect, it } from "vitest";
import { buildSleep, composeSleep, composerPalette, SLEEP_COMPOSERS, SLEEP_PALETTES } from "../src/index.ts";

/** A stand-in context: nodes that count their connections, sources that remember their onended. */
function fakeContext() {
  const nodes: { live: number; ended?: () => void; stopped: boolean; kind: string }[] = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const make = (kind: string) => () => {
    const rec = { live: 0, stopped: false, kind } as (typeof nodes)[number];
    nodes.push(rec);
    const n: Record<string, unknown> = {
      connect(to: unknown) {
        rec.live += 1;
        return to;
      },
      disconnect() {
        rec.live = 0;
      },
      start() {},
      stop() {
        rec.stopped = true;
      },
      set onended(f: () => void) {
        rec.ended = f;
      },
    };
    for (const k of ["gain", "frequency", "detune", "Q", "pan", "delayTime", "threshold", "knee", "ratio", "attack", "release"]) n[k] = param();
    return n;
  };
  const ctx = {
    sampleRate: 8000,
    currentTime: 0,
    createBuffer: (ch: number, len: number) => ({ getChannelData: () => new Float32Array(len), numberOfChannels: ch }),
    createGain: make("gain"),
    createBiquadFilter: make("filter"),
    createDynamicsCompressor: make("comp"),
    createConvolver: make("convolver"),
    createDelay: make("delay"),
    createOscillator: make("osc"),
    createBufferSource: make("src"),
    createStereoPanner: make("pan"),
  };
  return { ctx: ctx as unknown as BaseAudioContext, nodes };
}

describe("sleep composer", () => {
  it("composes the same piece for the same slot", () => {
    const p = SLEEP_PALETTES["receiver-darkwarm"];
    expect(JSON.stringify(composeSleep(p, 987654, 1800))).toBe(JSON.stringify(composeSleep(p, 987654, 1800)));
    expect(JSON.stringify(composeSleep(p, 987655, 1800))).not.toBe(JSON.stringify(composeSleep(p, 987654, 1800)));
  });

  it("rotates the hamster's palettes, never the same twice in a row, every palette used", () => {
    const seen = new Set<string>();
    let prev = "";
    for (let slot = 980_000; slot < 980_400; slot++) {
      const p = composerPalette("hamster-sleep", slot)!;
      expect(SLEEP_COMPOSERS["hamster-sleep"]).toContain(p.id);
      expect(p.id).not.toBe(prev);
      prev = p.id;
      seen.add(p.id);
    }
    expect(seen.size).toBe(SLEEP_COMPOSERS["hamster-sleep"].length);
    expect(composerPalette("credits", 980_000)).toBeNull();
  });

  it("every composer palette is a receiver with a full score", () => {
    for (const id of SLEEP_COMPOSERS["hamster-sleep"]) {
      const p = SLEEP_PALETTES[id];
      expect(p.kind).toBe("receiver");
      const s = composeSleep(p, 1234, 1800);
      expect(s.receiver!.clouds.length).toBeGreaterThan(20);
      expect(s.scenes[0].name).toBe("void");
    }
  });

  it("soft palettes keep their tonal voices low and are not on air (the owner heard ringing in the second set)", () => {
    const soft = Object.values(SLEEP_PALETTES).filter((p) => p.receiver?.soft);
    expect(soft.length).toBeGreaterThan(0);
    for (const p of soft) {
      expect(p.receiver!.glowMax).toBeLessThanOrEqual(67); // glows under G4
      expect(p.receiver!.dialSignal![1]).toBeLessThanOrEqual(72); // the found signal under C5
      expect(p.masterLp).toBeLessThanOrEqual(2500);
      expect(p.masterHp).toBeGreaterThanOrEqual(45); // no sub under the blooms
      expect(SLEEP_COMPOSERS["hamster-sleep"]).not.toContain(p.id);
    }
  });

  it("live: an event's nodes are unplugged when it ends, and dispose() tears the whole piece down", () => {
    const { ctx, nodes } = fakeContext();
    const palette = composerPalette("hamster-sleep", 5)!;
    const score = composeSleep(palette, 5, 1800);
    const out = ctx.createGain();
    const rig = buildSleep(ctx, score, palette, out, -600, 0, { live: true });
    for (let t = 600; t < 660; t += 1) rig.schedule(t, t + 1);
    const withEnd = nodes.filter((n) => n.ended);
    expect(withEnd.length).toBeGreaterThan(20);
    for (const n of withEnd) n.ended!();
    // every event has let go of its graph; only the piece's lasting graph (and the caller's out) is still plugged
    const plugged = nodes.filter((n) => n.live > 0).length;
    rig.dispose();
    expect(nodes.filter((n) => n.live > 0).length).toBe(0);
    expect(plugged).toBeLessThan(80);
    // after dispose nothing more is scheduled
    const made = nodes.length;
    rig.schedule(700, 760);
    expect(nodes.length).toBe(made);
  });

  it("offline: nothing is unplugged, the render graph is as before", () => {
    const { ctx, nodes } = fakeContext();
    const palette = composerPalette("hamster-sleep", 5)!;
    const rig = buildSleep(ctx, composeSleep(palette, 5, 1800), palette, ctx.createGain(), 0, 0);
    rig.schedule(0, 60);
    expect(nodes.some((n) => n.ended)).toBe(false);
    rig.dispose();
    expect(nodes.filter((n) => n.live > 0).length).toBeGreaterThan(100);
  });
});
