// Renders the dnb-pack styles as long demos (offline, Chromium, the release renderer with its reaper) and logs every
// bass / lead / harmony note the engine schedules (prototype hooks), for the checks.
//   node dnb-render.mjs <outDir> [seconds] [styleId,...] [--null]
// Writes <outDir>/<style>.f32 (interleaved float32 stereo, 44.1 kHz) and <style>.json (meta + note log).
// --null: renders with every musical part muted (kick snare hat glitch bass pad lead), only the tex/fx buses and the
// returns left: the constant-noise null test. Writes <style>-null.f32.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const { chromium } = await import("playwright");
const { createServer } = await import("vite");

const outDir = process.argv[2];
const seconds = Number(process.argv[3] ?? 180);
const only = process.argv[4] && !process.argv[4].startsWith("--") ? process.argv[4].split(",") : null;
const nullTest = process.argv.includes("--null");
const music = process.argv.includes("--music");
const mutesEnv = process.env.MUTES ? JSON.parse(process.env.MUTES) : null;
const tag = process.env.TAG ?? "";
const packKey = process.env.PACK ?? "machine-electro";
const override = process.env.OVERRIDE ? JSON.parse(process.env.OVERRIDE) : null;
const barOffset = Number(process.env.BAR_OFFSET ?? 0);
const epochs = process.env.EPOCHS ? JSON.parse(process.env.EPOCHS) : null;
mkdirSync(outDir, { recursive: true });

// One steady market: a full grid (kick 7 hits, snare 8, hats 16, glitch 4), every bass onset, moderate heat.
const word = (steps) => steps.reduce((w, s) => w | (1n << BigInt(s)), 0n);
const pattern = word([0, 3, 6, 8, 10, 12, 14]) | (word([1, 4, 6, 9, 12, 13, 14, 15]) << 16n) | (word([...Array(16).keys()]) << 32n) | (word([3, 7, 11, 15]) << 48n);
const bass = BigInt("0x" + "1".repeat(16));
const base = {
  pattern: pattern.toString(), bass: bass.toString(), swapCount: 1200, lastTs: 1791727139, bpm: 106, root: 0, mode: 0, patternId: 0,
  lastTick: 56113, pressure: 0, intervalEma: 300, releaseCount: 0, sizeLogEma: 1000, heat: 0.5, trackNo: 0,
};

const port = Number(process.env.PORT ?? 5231);
const server = await createServer({ root: resolve(root, "web"), logLevel: "error", server: { port, strictPort: true, hmr: false, watch: null, fs: { strict: false } } });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`http://127.0.0.1:${port}/render.html?timeline=/demo-timeline.json`);
  const ids = await page.evaluate(async ({ root, packKey }) => {
    const pack = (await import(`/@fs${root}/packages/synth/src/stations/${packKey}.ts`)).default;
    return pack.styles.electro.map((s) => s.id);
  }, { root, packKey });
  for (const id of ids) {
    if (only && !only.includes(id)) continue;
    const t0 = Date.now();
    const res = await page.evaluate(
      async ({ root, id, seconds, base, nullTest, packKey, override, barOffset, music, mutesEnv, epochs }) => {
        const synth = await import(`/@fs${root}/packages/synth/src/index.ts`);
        const eng = await import(`/@fs${root}/packages/synth/src/engine.ts`);
        let pack = (await import(`/@fs${root}/packages/synth/src/stations/${packKey}.ts`)).default;
        if (override) {
          // { styleId: { "data.dnb.dropout": false, "data.reese": null, ... } }: a copy of the pack with these set.
          pack = structuredClone(pack);
          for (const [sid, sets] of Object.entries(override)) {
            const st = pack.styles.electro.find((s) => s.id === sid);
            if (!st) continue;
            for (const [path, value] of Object.entries(sets)) {
              const keys = path.split(".");
              let o = st;
              for (const k of keys.slice(0, -1)) o = o[k] ??= {};
              if (value === null) delete o[keys.at(-1)];
              else o[keys.at(-1)] = value;
            }
          }
        }
        const program = synth.programFromPack(pack);
        const era = synth.eraById("electro");
        let epoch = epochs?.[id] ?? 0;
        while (synth.styleOf(era, epoch, program).style.id !== id) epoch++;
        const log = [];
        const P = eng.VoiceEngine.prototype;
        if (!P.__hooked) {
          P.__hooked = true;
          const hook = (name, rec) => {
            const orig = P[name];
            P[name] = function (...a) {
              const r = rec(...a);
              if (r) globalThis.__log?.push(r);
              return orig.apply(this, a);
            };
          };
          const at = (c) => ({ t: c.t, g: c.hit.gridTime, bar: c.hit.bar, step: c.step, sec: c.sec.name, fbar: c.sec.bar, tonic: c.tonic });
          hook("alienLaser", (c, vel, l) => ({ k: "laser", ...at(c), from: l.from + l.color * c.color + 1200 * Math.max(0, c.press), vel, level: l.level }));
          hook("alienTom", (c, vel, step) => ({ k: "tom", ...at(c), vel }));
          hook("alienArpStep", (c, chord) => ({ k: "arpstep", ...at(c) }));
          hook("alienHoover", (c, tones, length, level, h) => ({ k: "hoover", ...at(c), tones: [...tones], bend: h.bend, len: length }));
          hook("alienVox", (c, midi, length) => ({ k: "vox", ...at(c), midi, len: length }));
          hook("alienBass", (c, midi, from, length, accent) => ({ k: "bass", ...at(c), midi, from, len: length, accent }));
          hook("clientBass", (c, midi, from, length, accent, ghost) => ({ k: "bass", ...at(c), midi, from, len: length, accent, ghost }));
          hook("sub", (c, midi, length) => ({ k: "sub", ...at(c), midi, len: length }));
          hook("motifNote", (c, midi, length, level) => ({ k: "lead", ...at(c), midi, len: length, level }));
          hook("clientPad", (c, chord) => ({ k: "pad", ...at(c), tones: [...chord.tones], cbass: chord.bass }));
          hook("electroMetalStep", (c, m) => ({ k: "metalstep", ...at(c) }));
          hook("clientBlip", (c) => ({ k: "blip", ...at(c) }));
          hook("kick", (time) => ({ k: "kick", t: time }));
        }
        globalThis.__log = log;
        // Source census: every oscillator / buffer source's [start, stop] (for simultaneous-voice counts).
        const SN = AudioScheduledSourceNode.prototype;
        if (!SN.__census) {
          SN.__census = true;
          const st = SN.start, sp = SN.stop;
          SN.start = function (when = 0, ...r) { this.__t0 = when; return st.call(this, when, ...r); };
          SN.stop = function (when = 0) { if (globalThis.__iv && this.__t0 !== undefined) globalThis.__iv.push([this.__t0, when, this instanceof OscillatorNode ? 1 : 0]); return sp.call(this, when); };
        }
        globalThis.__iv = [];
        const state = { ...base, pattern: BigInt(base.pattern), bass: BigInt(base.bass), patternId: 4 * epoch };
        const points = [{ time: 0, state }];
        let buf;
        if (nullTest) {
          buf = await synth.renderTimelineToBuffer(points, seconds, 44100, { eraId: "electro", barOffset, program, mutes: mutesEnv ?? (music ? ["kick", "snare", "hat", "glitch"] : null) ?? ["kick", "snare", "hat", "glitch", "bass", "pad", "lead"] });
        } else {
          const hits = synth.planSteps(points, seconds, "electro", barOffset, program);
          const plan = { hits, seconds, genre: { epoch, era: "electro", eraName: "Liquid DnB", style: id, styleName: id }, program, fadeAt: seconds - 2.5 };
          buf = await synth.renderReleaseToBuffer(plan, 44100);
        }
        globalThis.__log = null;
        const iv = globalThis.__iv; globalThis.__iv = null;
        const census = { n: iv.length, osc: iv.filter((x) => x[2]).length, busy: iv.reduce((a, [s, e]) => a + Math.max(0, Math.min(e, seconds) - Math.max(0, s)), 0) / seconds };
        const hits = synth.planSteps(points, Math.min(seconds, 400), "electro", barOffset, program);
        const bars = hits.filter((h) => h.step === 0).map((h) => ({ bar: h.bar, t: h.gridTime, sec: synth.sectionAt(h.bar).name, fbar: synth.sectionAt(h.bar).bar }));
        const L = buf.getChannelData(0), R = buf.getChannelData(1);
        const inter = new Float32Array(L.length * 2);
        for (let i = 0; i < L.length; i++) { inter[2 * i] = L[i]; inter[2 * i + 1] = R[i]; }
        const bytes = new Uint8Array(inter.buffer);
        let bin = "";
        const CH = 0x8000;
        const parts = [];
        for (let i = 0; i < bytes.length; i += CH) parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CH)));
        bin = parts.join("");
        const style = synth.styleOf(era, epoch, program).style;
        return {
          id, name: style.name, base: style.base, epoch, key: (await import(`/@fs${root}/packages/synth/src/eras.ts`)).genreKey(era, epoch), tempo: hits[0].tempo, bpmRange: style.bpm,
          data: btoa(bin), log, bars, census,
        };
      },
      { root, id, seconds, base, nullTest: nullTest || music || !!mutesEnv, packKey, override, barOffset, music, mutesEnv, epochs },
    );
    if (errors.length) throw new Error(errors.join("\n"));
    const suffix = tag ? `-${tag}` : music ? "-music" : nullTest ? "-null" : "";
    writeFileSync(resolve(outDir, `${id}${suffix}.f32`), Buffer.from(res.data, "base64"));
    delete res.data;
    writeFileSync(resolve(outDir, `${id}${suffix}.json`), JSON.stringify(res));
    console.log(`${id}: epoch ${res.epoch} key ${res.key} tempo ${res.tempo}, ${res.log.length} notes, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
} finally {
  await browser.close();
  await server.close();
}
