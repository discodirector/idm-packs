// The new voices (src/voices/new) in Node, no browser: their audition phrases rendered straight from the DSP, with
// level, band shares and the CPU cost of each voice.
//   npx tsx packages/synth/scripts/voice-library-new.ts metrics [outDir]   phrase metrics (+ f32 stereo files if outDir)
//   npx tsx packages/synth/scripts/voice-library-new.ts cpu                 render time / audio time per voice (best of 3)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LibraryVoice, VoiceHost, VoiceNote } from "../src/voices/types.ts";
import { ENTRIES, entry, playPhrase, SECONDS } from "../src/voices/new/audition.ts";
import { NEW_RENDERERS } from "../src/voices/new/catalog.ts";
import { panGains, type Params, type Renderer } from "../src/voices/new/dsp/core.ts";
import { eventOf } from "../src/voices/new/voices.ts";

const SR = 44100;
const CENTER = new Set(["uprightBass", "rubberSub"]);

/** A mixing host for Node: the voice's `play` is swapped for a direct render + mix (same pan law as the library host). */
function nodeRender(id: string, run: (h: VoiceHost, v: LibraryVoice<any>) => void, v: LibraryVoice<any>, seconds = SECONDS) {
  const n = Math.ceil(seconds * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const render = (NEW_RENDERERS as Record<string, Renderer>)[id];
  const clone: LibraryVoice<any> = {
    ...v,
    play: (_h: VoiceHost, note: VoiceNote, p: Params) => {
      const r = render(eventOf(note), p, SR);
      const at = Math.round(note.time * SR);
      if (r.R) {
        for (let i = 0; i < r.L.length && at + i < n; i++) {
          L[at + i] += r.L[i];
          R[at + i] += r.R[i];
        }
      } else {
        const [gl, gr] = CENTER.has(id) ? [1, 1] : panGains(note.pan);
        for (let i = 0; i < r.L.length && at + i < n; i++) {
          L[at + i] += r.L[i] * gl;
          R[at + i] += r.L[i] * gr;
        }
      }
    },
  };
  run({} as VoiceHost, clone);
  return { L, R };
}

/** Radix-2 FFT power spectrum of a frame. */
function power(x: Float32Array): Float64Array {
  const N = x.length;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < N; i += len)
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
  }
  const p = new Float64Array(N / 2);
  for (let i = 0; i < N / 2; i++) p[i] = re[i] * re[i] + im[i] * im[i];
  return p;
}

function metrics(L: Float32Array, R: Float32Array) {
  let ss = 0;
  let pk = 0;
  for (let i = 0; i < L.length; i++) {
    ss += L[i] * L[i] + R[i] * R[i];
    pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  }
  const N = 4096;
  const bands = [0, 0, 0, 0, 0];
  const edges = [200, 2000, 6000, 10000];
  const mono = new Float32Array(N);
  for (let o = 0; o + N <= L.length; o += N / 2) {
    for (let i = 0; i < N; i++) mono[i] = 0.5 * (L[o + i] + R[o + i]);
    const p = power(mono);
    for (let k = 1; k < p.length; k++) {
      const f = (k * SR) / N;
      const b = f < edges[0] ? 0 : f < edges[1] ? 1 : f < edges[2] ? 2 : f < edges[3] ? 3 : 4;
      bands[b] += p[k];
    }
  }
  const tot = bands.reduce((a, b) => a + b, 0) || 1;
  // Side / mid energy (width).
  let mid = 0;
  let side = 0;
  for (let i = 0; i < L.length; i++) {
    mid += (L[i] + R[i]) ** 2;
    side += (L[i] - R[i]) ** 2;
  }
  return {
    rmsDb: 10 * Math.log10(ss / (2 * L.length) + 1e-20),
    peakDb: 20 * Math.log10(pk + 1e-20),
    bands: bands.map((b) => (100 * b) / tot),
    width: side / (mid + 1e-20),
  };
}

const mode = process.argv[2] ?? "metrics";
if (mode === "metrics") {
  const out = process.argv[3];
  if (out) mkdirSync(out, { recursive: true });
  console.log("entry".padEnd(34), "rms dB  peak dB   <200   .2-2k  2-6k   6-10k  >10k   side/mid");
  ENTRIES.forEach((_, i) => {
    const e = entry(i);
    const { L, R } = nodeRender(e.id, (h, v) => playPhrase(h, v, e.params, e.kind, undefined, e.presetOf), e.v);
    const m = metrics(L, R);
    console.log(`${e.id}:${e.preset}`.padEnd(34), m.rmsDb.toFixed(1).padStart(6), m.peakDb.toFixed(1).padStart(7), ...m.bands.map((b) => b.toFixed(1).padStart(6)), m.width.toFixed(3).padStart(8));
    if (out) {
      const inter = new Float32Array(L.length * 2);
      for (let k = 0; k < L.length; k++) {
        inter[2 * k] = L[k];
        inter[2 * k + 1] = R[k];
      }
      writeFileSync(join(out, `${String(i).padStart(2, "0")}-${e.id}-${e.preset.replace(/\W+/g, "_")}.f32`), Buffer.from(inter.buffer));
    }
  });
} else if (mode === "cpu") {
  // House density, 20 s per voice: keys / plucks / strings / brass / choirs: a 4-note chord or 4 notes a beat-ish as
  // the audition phrase repeated; the cost is render time over audio time (one core).
  const seen = new Set<string>();
  console.log("voice".padEnd(16), "preset".padEnd(12), "phrase", "  realtime fraction (render s / audio s, best of 3)");
  ENTRIES.forEach((_, i) => {
    const e = entry(i);
    if (seen.has(e.id)) return;
    seen.add(e.id);
    const reps = 5;
    const audio = reps * (SECONDS - 1.4);
    let best = Infinity;
    for (let t = 0; t < 3; t++) {
      const t0 = performance.now();
      nodeRender(e.id, (h, v) => {
        for (let r = 0; r < reps; r++) playPhrase(h, v, e.params, e.kind, 0.05 + r * (SECONDS - 1.4), e.presetOf);
      }, e.v, audio + 2);
      best = Math.min(best, (performance.now() - t0) / 1000);
    }
    console.log(e.id.padEnd(16), e.preset.padEnd(12), e.kind.padEnd(7), (best / audio).toFixed(4));
  });
}
