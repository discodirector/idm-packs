import { describe, expect, it } from "vitest";
import { playVoice, VOICE_KINDS, VOICES, waveCoefficients, type VoiceHost, type VoiceKind } from "../src/voices/hiphop/index.ts";

// The synth voice library (src/voices): every module's defaults sit inside its ranges, and every note it plays keeps
// the engine's bit-exact rules (no node or parameter with more than two audio inputs, the same calls every time,
// every source started and stopped).

/** A stand-in context that records the graph: nodes, connections (with the parameter they land on) and param writes. */
function graphContext() {
  let next = 0;
  const calls: string[] = [];
  const inputs = new Map<string, Set<string>>();
  const starts: string[] = [];
  const stops: string[] = [];
  const lastWrite = new Map<string, number>();
  const node = (id: string): any => {
    const params = new Map<string, any>();
    const param = (name: string) => {
      if (!params.has(name)) {
        const pid = `${id}.${name}`;
        const p: any = { __id: pid, value: 0 };
        for (const m of ["setValueAtTime", "linearRampToValueAtTime", "exponentialRampToValueAtTime", "setTargetAtTime", "cancelScheduledValues"]) {
          p[m] = (v: number, t: number) => {
            calls.push(`${pid}.${m}(${v},${t})`);
            if (m !== "cancelScheduledValues" && m !== "setTargetAtTime") lastWrite.set(pid, v);
            return p;
          };
        }
        params.set(name, p);
      }
      return params.get(name);
    };
    return new Proxy(
      { __id: id },
      {
        get(target: any, prop) {
          if (prop === "__id") return id;
          if (prop in target) return target[prop];
          if (["gain", "frequency", "detune", "Q", "playbackRate"].includes(String(prop))) return param(String(prop));
          if (prop === "connect")
            return (dest: any) => {
              const to = dest.__id;
              if (!inputs.has(to)) inputs.set(to, new Set());
              inputs.get(to)!.add(id);
              calls.push(`${id}->${to}`);
              return dest;
            };
          if (prop === "start") return (t: number) => starts.push(`${id}@${t}`);
          if (prop === "stop") return (t: number) => stops.push(`${id}@${t}`);
          if (prop === "setPeriodicWave") return () => calls.push(`${id}.wave`);
          return undefined;
        },
        set(target: any, prop, value) {
          target[prop] = value;
          calls.push(`${id}.${String(prop)}=${ArrayBuffer.isView(value) ? "curve" : typeof value === "object" ? "obj" : value}`);
          return true;
        },
      },
    );
  };
  const make = (kind: string) => () => {
    const id = `${kind}${next++}`;
    calls.push(`new ${id}`);
    return node(id);
  };
  const ctx: any = {
    sampleRate: 44100,
    createOscillator: make("osc"),
    createGain: make("gain"),
    createBiquadFilter: make("biquad"),
    createWaveShaper: make("shaper"),
    createBufferSource: make("src"),
    createChannelMerger: make("merger"),
    createPeriodicWave: () => ({}),
    createBuffer: (channels: number, length: number, rate: number) => {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { length, sampleRate: rate, duration: length / rate, numberOfChannels: channels, getChannelData: (i: number) => data[i] };
    },
  };
  return { ctx, calls, inputs, starts, stops, lastWrite };
}

function host(ctx: any, outs: string[]): VoiceHost {
  const bufs = new Map<string, AudioBuffer>();
  let noise: AudioBuffer | null = null;
  return {
    ctx,
    noise: () => (noise ??= ctx.createBuffer(1, 88200, 44100)),
    buffer: (key, make) => {
      if (!bufs.has(key)) bufs.set(key, make());
      return bufs.get(key)!;
    },
    wave: (kind, k, duty) => {
      waveCoefficients(kind, k, duty);
      return ctx.createPeriodicWave();
    },
    out: (node) => {
      outs.push((node as any).__id);
      return [];
    },
    play: (sources, _nodes, time, end) => {
      for (const s of sources) {
        s.start(time);
        s.stop(end);
      }
    },
  };
}

const note = (from?: number) => ({ time: 1, freq: 220, length: 0.6, vel: 0.8, pan: 0.1, bright: 0.6, seed: 5, from });

describe("the synth voice library", () => {
  it("every module documents itself and its defaults sit inside its ranges", () => {
    expect(VOICE_KINDS.length).toBeGreaterThanOrEqual(10);
    for (const kind of VOICE_KINDS) {
      const m = VOICES[kind] as { doc: string; defaults: Record<string, number>; ranges: Record<string, readonly [number, number]> };
      expect(m.doc.length).toBeGreaterThan(20);
      expect(Object.keys(m.ranges).sort()).toEqual(Object.keys(m.defaults).sort());
      for (const [k, v] of Object.entries(m.defaults)) {
        const [lo, hi] = m.ranges[k];
        expect(v, `${kind}.${k}`).toBeGreaterThanOrEqual(lo);
        expect(v, `${kind}.${k}`).toBeLessThanOrEqual(hi);
      }
      expect(m.defaults.gain).toBeDefined();
    }
  });

  for (const kind of VOICE_KINDS) {
    it(`${kind}: no node or parameter takes more than two inputs, every source starts and stops, the same every time`, () => {
      const run = (from?: number) => {
        const g = graphContext();
        const outs: string[] = [];
        playVoice(kind as VoiceKind, host(g.ctx, outs), note(from));
        return { ...g, outs };
      };
      const a = run();
      expect(a.outs.length).toBeGreaterThan(0);
      for (const [to, from] of a.inputs) expect(from.size, `${kind}: ${to} has ${[...from].join(", ")}`).toBeLessThanOrEqual(2);
      expect(a.starts.length).toBeGreaterThan(0);
      expect(a.stops.length).toBe(a.starts.length);
      expect(run().calls).toEqual(a.calls);
      // A glide from another pitch changes the schedule only for voices that glide.
      const glided = run(110).calls.join("\n") !== a.calls.join("\n");
      if (["moogLead", "bassStack", "supersaw", "brass", "vox"].includes(kind)) expect(glided).toBe(true);
    });
  }

  it("parameters change what a voice plays", () => {
    const g1 = graphContext();
    const g2 = graphContext();
    playVoice("fmKeys", host(g1.ctx, []), note(), { index: 1 });
    playVoice("fmKeys", host(g2.ctx, []), note(), { index: 3 });
    expect(g1.calls).not.toEqual(g2.calls);
  });

  it("wave coefficients: a saw's partials fall as 1/n, a pulse's follow its duty, the phase rotates them", () => {
    const saw = waveCoefficients("saw", 0);
    expect(Math.abs(saw.imag[1])).toBeCloseTo(2 / Math.PI, 5);
    expect(Math.abs(saw.imag[2])).toBeCloseTo(1 / Math.PI, 5);
    const sq = waveCoefficients("pulse", 0, 0.5);
    expect(sq.real[2]).toBeCloseTo(0, 6);
    const turned = waveCoefficients("saw", 4);
    const mag = (w: { real: Float32Array; imag: Float32Array }, n: number) => Math.hypot(w.real[n], w.imag[n]);
    for (const n of [1, 2, 3, 7]) expect(mag(turned, n)).toBeCloseTo(mag(saw, n), 5);
    expect(turned.real[1]).not.toBeCloseTo(saw.real[1], 3);
  });
});
