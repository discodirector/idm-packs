// bench.mjs: offline render time per audio second, pack/style pairs, 20 s from form bar 16, renderTimelineToBuffer.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const { chromium } = await import("playwright");
const { createServer } = await import("vite");
const pairs = process.argv.slice(2).map((x) => x.split(":"));
const port = 5251;
const server = await createServer({ root: resolve(root, "web"), logLevel: "error", server: { port, strictPort: true, hmr: false, watch: null, fs: { strict: false } } });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/render.html?timeline=/demo-timeline.json`);
  for (const [packKey, id, genre = "electro", drop = ""] of pairs) {
    const r = await page.evaluate(async ({ root, packKey, id, genre, drop }) => {
      const synth = await import(`/@fs${root}/packages/synth/src/index.ts`);
      let pack = (await import(`/@fs${root}/packages/synth/src/stations/${packKey}.ts`)).default;
      if (drop) {
        pack = structuredClone(pack);
        const st = pack.styles[genre].find((s) => s.id === id);
        for (const k of drop.split(",")) if (k === "all") delete st.data.machine; else delete st.data.machine[k];
      }
      const program = synth.programFromPack(pack);
      const era = synth.eraById(genre);
      let epoch = 0;
      while (!(synth.eraOf(epoch, program).id === genre && synth.styleOf(era, epoch, program).style.id === id)) epoch++;
      const word = (steps) => steps.reduce((w, s) => w | (1n << BigInt(s)), 0n);
      const pattern = word([0, 3, 6, 8, 10, 12, 14]) | (word([1, 4, 6, 9, 12, 13, 14, 15]) << 16n) | (word([...Array(16).keys()]) << 32n) | (word([3, 7, 11, 15]) << 48n);
      const state = { pattern, bass: BigInt("0x" + "1".repeat(16)), swapCount: 1200, lastTs: 1791727139, bpm: 106, root: 0, mode: 0, patternId: 4 * epoch, lastTick: 56113, pressure: 0, intervalEma: 300, releaseCount: 0, sizeLogEma: 1000, heat: 0.5, trackNo: 0 };
      const t0 = performance.now();
      await synth.renderTimelineToBuffer([{ time: 0, state }], 12, 44100, { eraId: genre, barOffset: 16, program });
      return (performance.now() - t0) / 1000 / 12;
    }, { root, packKey, id, genre, drop });
    console.log(`${packKey}/${id} -${drop}: ${r.toFixed(2)} s render per audio s`);
  }
} finally { await browser.close(); await server.close(); }
