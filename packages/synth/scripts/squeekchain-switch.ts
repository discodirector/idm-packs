// Where the Squeekchain station is now, for its electro switch (stations/hamster.ts SQUEEKCHAIN_ELECTRO_FROM):
//   npx tsx packages/synth/scripts/squeekchain-switch.ts [checkpoint URL or file]
// Reads the bot's public checkpoint (default https://theidm.fun/stations-data/squeekchain.checkpoint.json: the
// state the site and the track posts start from), decodes its page (patternId) and epoch in the hamster program,
// and prints the switch epoch in the pack with its margin. Read-only.
// Rule: the switch must lie after the epoch playing when the deploy goes live (that epoch, and every one before it,
// keeps its genre and style). An awake hamster plays a page (an epoch) every ~30 min of running, ~15 a night; the
// checkpoint may trail the live station by a few minutes. So deploying now, `current + 2` is safe; deploying later,
// add the pages he may run before then.
import { readFileSync } from "node:fs";
import { decode, V2_SLOTS } from "@swarm-sequencer/core";
import { epochOf, patternIdOf, programFor } from "../src/index.ts";
import { SQUEEKCHAIN_ELECTRO_FROM } from "../src/stations/hamster.ts";

const src = process.argv[2] ?? "https://theidm.fun/stations-data/squeekchain.checkpoint.json";
const cp = src.startsWith("http") ? await (await fetch(`${src}?t=${Date.now()}`)).json() : JSON.parse(readFileSync(src, "utf8"));
const state = decode(cp.slot0, cp.slot1, V2_SLOTS);
const program = programFor("hamster");
const epoch = epochOf(state, program);
const last = cp.recent?.at(-1)?.ts;
console.log(`checkpoint ${cp.generatedAt}: page ${state.patternId}, epoch ${epoch}, track #${state.trackNo}${last ? `, last note ${new Date(last * 1000).toISOString()}` : ""}`);
console.log(`switch in the pack: epoch ${SQUEEKCHAIN_ELECTRO_FROM} (page ${patternIdOf(SQUEEKCHAIN_ELECTRO_FROM, program)}), ${SQUEEKCHAIN_ELECTRO_FROM - epoch} epochs ahead`);
if (SQUEEKCHAIN_ELECTRO_FROM <= epoch + 1) console.log("NOT SAFE: the switch is at or next to the epoch playing; set it later");
console.log(`deploying right now: set SQUEEKCHAIN_ELECTRO_FROM = ${epoch + 2} (page ${patternIdOf(epoch + 2, program)}) or later`);
