// Voice audition: every new voice of packages/synth/src/voices alone, on the same 4-bar phrase (A minor, Am F Dm Em,
// 128 BPM), dry, each section RMS-matched, a beat of silence between them.
//   node audition.mjs <out.f32>  → interleaved stereo float32 44.1 kHz, and <out>.txt (the order and times)
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const { chromium } = await import("playwright");
const { createServer } = await import("vite");
const out = process.argv[2];
const port = Number(process.env.PORT ?? 5249);
const server = await createServer({ root: resolve(root, "web"), logLevel: "error", server: { port, strictPort: true, hmr: false, watch: null, fs: { strict: false } } });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/render.html?timeline=/demo-timeline.json`);
  const res = await page.evaluate(async ({ root }) => {
    const V = await import(`/@fs${root}/packages/synth/src/voices/machine/index.ts`);
    const SR = 44100, BPM = 128, S16 = 60 / BPM / 4, BAR = 16 * S16, LEN = 4 * BAR + 1.5;
    // Am F Dm Em over A3; chord tones as MIDI.
    const CH = [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 55, 59]];
    const tone = (bar, n, up = 12) => { const c = CH[bar]; const o = Math.floor(n / 3); return c[n - 3 * o] + 12 * o + up; };
    const hostOf = (ctx, dest) => {
      let noise;
      return {
        ctx,
        out(node, bus, pan) {
          if (pan === undefined) { node.connect(dest); return []; }
          const p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(dest); return [p];
        },
        sum(chain, node, rest) { if (!chain) return node; const g = ctx.createGain(); chain.connect(g); node.connect(g); rest.push(g); return g; },
        end(src, rest, when) { src.stop(when); },
        noise() {
          if (!noise) { noise = ctx.createBuffer(1, SR * 2, SR); const d = noise.getChannelData(0); let s = 12345; for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) >>> 0; d[i] = (s / 2 ** 32) * 2 - 1; } }
          return noise;
        },
      };
    };
    const MEL = [[0, 3, 2], [3, 3, 3], [6, 4, 4], [12, 2, 3], [14, 2, 2], [16, 6, 1], [24, 2, 2], [26, 6, 3], [32, 3, 4], [35, 3, 3], [38, 4, 2], [44, 2, 1], [46, 2, 2], [48, 8, 0], [58, 2, 1], [60, 4, 2]];
    const melody = (fn) => MEL.forEach(([s, len, n]) => fn(s * S16, len * S16, tone(Math.floor(s / 16), n), s));
    const BASS = [0, 3, 6, 8, 10, 12, 14];
    const sections = [
      ["unison lead: 7-voice supersaw, square sub, glide", (h) => melody((t, l, m, s) => V.unison(h, t, m, l, 1, { voices: 7, detune: 22, width: 0.7, wave: "saw", sub: 0.3, cutoff: 1300, env: 2800, decay: 0.35, q: 1.4, keytrack: 0.5, attack: 0.004, dec: 0.3, sustain: 0.6, release: 0.22, drive: 1.2, level: 0.3 }, "lead", {}))],
      ["unison stabs: 5 saws + pulse top per chord tone", (h) => { for (let b = 0; b < 4; b++) for (const s of [3, 6, 14]) CH[b].forEach((m, i) => V.unison(h, b * BAR + s * S16, m + 12, S16 * (s === 14 ? 0.5 : 1.2), 1, { voices: 5, detune: 14, width: 0.6, wave: "saw", top: 0.25, cutoff: 650, env: 2600, decay: 0.14, q: 3, attack: 0.002, dec: 0.18, sustain: 0.25, release: 0.12, drive: 1.5, level: 0.2 }, "harm", { pan: (i - 1) * 0.12 })); }],
      ["poly arp: 2 pulses + square sub, filter swept", (h) => { for (let k = 0; k < 64; k++) { const b = Math.floor(k / 16); const m = tone(b, [0, 1, 2, 3, 2, 1][k % 6], 12); V.unison(h, k * S16, m, S16 * 0.8, 1, { voices: 2, detune: 8, width: 0.3, wave: "pulse25", sub: 0.4, cutoff: 850, env: 2200, decay: 0.09, q: 5, attack: 0.002, dec: 0.1, sustain: 0.2, release: 0.08, level: 0.3 }, "lead", { pan: k % 2 ? 0.45 : -0.45, bright: 0.6 + 0.4 * Math.sin(k / 10) }); } }],
      ["string machine: three ensemble lines, 8' saw + 4' pulse", (h) => { for (let b = 0; b < 4; b++) V.strings(h, b * BAR, CH[b], BAR, 1, { octave: 0.4, detune: 7, slow: [0.55, 10], fast: [6.1, 3], width: 0.8, cutoff: 3000, q: 0.8, hp: 180, attack: 0.6, release: 1.4, level: 0.35 }, "harm"); }],
      ["formant choir: vowels ah-oh / eh-ah-oo", (h) => { const A = [730, 1090, 2440], O = [570, 840, 2410], E = [530, 1840, 2480], U = [300, 870, 2240]; for (let b = 0; b < 4; b++) V.choir(h, b * BAR, CH[b], BAR * 0.9, 1, b % 2 ? [E, A, U] : [A, O], { detune: 7, width: 0.6, q: 9, breath: 0.2, attack: 0.12, release: 0.5, level: 0.4 }, "harm"); }],
      ["FM bells: 2-op, ratio 3.5", (h) => melody((t, l, m) => V.fmTone(h, t, m + 12, l, 1, { ops: [{ ratio: 3.5, index: 2.2, decay: 0.5, floor: 0.05 }], detune: 5, width: 0.5, attack: 0.002, dec: 1.2, sustain: 0, release: 0.6, level: 0.3 }, "lead"))],
      ["FM metallic keys: 3-op, 1.41 + 3", (h) => melody((t, l, m) => V.fmTone(h, t, m, l, 1, { ops: [{ ratio: 1.41, index: 3, decay: 0.08, floor: 0.1 }, { ratio: 3, index: 1.2, decay: 0.04 }], detune: 4, width: 0.5, attack: 0.002, dec: 0.18, sustain: 0.1, release: 0.1, level: 0.3 }, "lead"))],
      ["layered bass: sub + acid mid + grit", (h) => { for (let b = 0; b < 4; b++) BASS.forEach((s, i) => V.layerBass(h, b * BAR + s * S16, CH[b][0] - 12 + (i === 3 ? 12 : 0), S16 * 1.6, { sub: 1.25, osc: [{ wave: "pulse25", detune: -5, level: 0.5 }, { wave: "square", detune: 6, level: 0.35 }], cutoff: 150, open: [3.5, 6.5], decay: [0.07, 0.12], q: [5.5, 9], sweep: 180, drive: 2.6, hp: 75, grit: 0.35, gritHz: 1500, mid: 1, level: 0.5, glide: 0.03 }, { from: null, accent: i % 3 === 0, open: b / 3, bright: 1, heat: 0 })); }],
      ["808 kick layers: knock + click + saturated boom", (h) => { for (let b = 0; b < 4; b++) for (const s of [0, 6, 10]) V.kickLayers(h, b * BAR + s * S16, 1, { knock: { freq: 175, to: 85, decay: 0.07, level: 0.5 }, click: { freq: 4200, decay: 0.008, level: 0.5 }, boom: { freq: 50, glide: 2.2, decay: 0.4, drive: 2.2, level: 0.5 } }); }],
      ["snare layers: two-mode body, snap, stereo clap, air", (h) => { for (let b = 0; b < 4; b++) for (const s of [4, 12]) V.snareLayers(h, b * BAR + s * S16, 1, { body: { freqs: [190, 335], decay: 0.11, level: 0.4 }, snap: { hp: 3200, decay: 0.09, level: 0.5 }, clap: { bp: 1250, q: 1.3, gap: 0.008, decay: 0.16, width: 0.75, level: 0.6 }, air: { hp: 7500, decay: 0.3, level: 0.15 } }); }],
      ["808 percussion: toms, conga, cowbell, clave, rim, shaker, clap, crash", (h) => {
        const P = [["crash", [0], 1], ["cowbell", [2, 8, 11, 18, 24, 27, 30], 1], ["shaker", [...Array(64).keys()].filter((k) => k % 2 === 1), 1], ["conga", [6, 22, 38, 54], 1], ["clave", [3, 19, 35, 51], 1], ["rim", [13, 29, 45, 61], 1], ["clap", [15, 47], 1], ["tom", [56, 58, 60, 62], 1]];
        for (const [voice, steps] of P) steps.forEach((s, i) => V.perc(h, s * S16, voice, 1, voice === "tom" ? 1.3 - 0.1 * i : 1, 1, 0, "perc"));
      }],
      ["bleeps: ring-modulated, sonar ping under", (h) => { for (const s of [3, 11, 19, 27, 35, 43, 51, 59]) V.bleep(h, s * S16, tone(Math.floor(s / 16), Math.floor(s / 8) % 5, 24), 1, { wave: "sine", ring: 2.76, lp: 4000, decay: 0.12, sonar: 0.6, level: 0.4 }, "perc", s % 16 < 8 ? 0.5 : -0.5); }],
    ];
    const gap = 0.6;
    const bufs = [];
    const index = [];
    let at = 0;
    for (const [name, play] of sections) {
      const ctx = new OfflineAudioContext(2, Math.ceil(SR * LEN), SR);
      const g = ctx.createGain(); g.connect(ctx.destination);
      play(hostOf(ctx, g));
      const b = await ctx.startRendering();
      const L = b.getChannelData(0), R = b.getChannelData(1);
      let e = 0; for (let i = 0; i < L.length; i++) e += L[i] * L[i] + R[i] * R[i];
      const rms = Math.sqrt(e / (2 * L.length));
      let peak = 0; for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
      const k = Math.min(0.1 / Math.max(1e-6, rms), 0.85 / Math.max(1e-6, peak));
      bufs.push([L, R, k]);
      index.push(`${at.toFixed(1)} s  ${name}`);
      at += LEN + gap;
    }
    const total = bufs.reduce((n, [L]) => n + L.length + Math.round(gap * SR), 0);
    const inter = new Float32Array(total * 2);
    let o = 0;
    for (const [L, R, k] of bufs) { for (let i = 0; i < L.length; i++) { inter[2 * (o + i)] = L[i] * k; inter[2 * (o + i) + 1] = R[i] * k; } o += L.length + Math.round(gap * SR); }
    const bytes = new Uint8Array(inter.buffer); const parts = [];
    for (let i = 0; i < bytes.length; i += 0x8000) parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)));
    return { data: btoa(parts.join("")), index };
  }, { root });
  if (errors.length) throw new Error(errors.join("\n"));
  writeFileSync(out, Buffer.from(res.data, "base64"));
  writeFileSync(out + ".txt", res.index.join("\n") + "\n");
  console.log(res.index.join("\n"));
} finally {
  await browser.close();
  await server.close();
}
