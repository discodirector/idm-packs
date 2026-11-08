import { HOUSE_PROGRAM, IMD_ETH_PROGRAM, type Program } from "../program.ts";
import { programFromPack, validatePack, type StationPack } from "../pack.ts";
import cinematic from "./cinematic.ts";
import credits from "./credits.ts";
import creditsDubhouse from "./credits-dubhouse.ts";
import hamster from "./hamster.ts";
import hamsterElectro2 from "./hamster-electro-2.ts";
import hamsterSleep from "./hamster-sleep.ts";
import hiphopTrap from "./hiphop-trap.ts";
import imdDark from "./imd-dark.ts";
import infer from "./infer.ts";
import dnbPack from "./dnb-pack.ts";
import liquidDnb from "./liquid-dnb.ts";
import machineElectro from "./machine-electro.ts";
import popHouse from "./pop-house.ts";
import rallyHouse from "./rally-house.ts";

/**
 * Station packs on air, by the registry's `program` key (stations/registry.json). "idm" is the house program; every
 * other key names a pack here. example.ts is the swarm's reference, not a station, so it is not listed.
 * credits-dubhouse is baked but on no station yet (the Credits station's first pack, kept for later). hamster-sleep is
 * the hamster station's sleep mode (registry hamster.sleep, synth sleep.ts), never a program of its own. imd-dark is
 * baked but on no station yet (dark disco / electro, set aside for the IDM station). machine-electro (futuristic machine
 * electro: Rother / Plant43 / Client_03) and hamster-electro-2 (four more dark electro styles in the hamster electro's
 * world) are their own packs for the Style Lab and the gate; the hamster station plays their styles from its electro
 * switch (hamster.ts `next`, SQUEEKCHAIN_ELECTRO_FROM).
 * hiphop-trap is baked but on no station (five hip-hop / trap styles on the trip-hop opt-in beat; a Style Lab shelf).
 * cinematic is baked but on no station yet (five synth film-score cues on the triphop Cinematic base's opt-in score; a Style Lab shelf).
 * dnb-pack is baked but on no station yet (five drum & bass styles; the main station, the hamster or the Style Lab, undecided).
 * liquid-dnb is baked but on no station yet (five liquid drum & bass tracks toward LTJ Bukem / Good Looking, each its
 * own groove, instruments, key and tempo; a Style Lab shelf).
 * pop-house is baked but on no station (bright pop / piano / filter / deep vocal / future / disco house; the Style Lab's Pop House tab).
 * rally-house is baked but on no station (Rally House v1: acid jazz, deep, fast, hardgroove and breaks house with the PSX sampler texture; a Style Lab shelf).
 */
export const PACKS: Record<string, StationPack> = { infer, credits, "credits-dubhouse": creditsDubhouse, hamster, "hamster-sleep": hamsterSleep, "imd-dark": imdDark, "machine-electro": machineElectro, "hamster-electro-2": hamsterElectro2, "hiphop-trap": hiphopTrap, cinematic, "dnb-pack": dnbPack, "liquid-dnb": liquidDnb, "pop-house": popHouse, "rally-house": rallyHouse };

/**
 * Packs added at runtime (docs/STATIONS.md "Automatic pipeline"): the pipeline publishes a gated pack as JSON
 * (OUT_DIR/stations-data/packs/<key>.json) and the site registers it here before it builds the program. Baked packs
 * win: a runtime pack never replaces one in PACKS.
 */
const RUNTIME: Record<string, StationPack> = {};

/**
 * Registers a runtime pack after validating it again (pack.ts validatePack): returns its problems, empty when it was
 * registered (or a pack with that key is already known: the first one stays).
 */
export function registerPack(pack: unknown): string[] {
  const errors = validatePack(pack);
  if (errors.length) return errors;
  const p = pack as StationPack;
  if (!PACKS[p.key] && !RUNTIME[p.key]) RUNTIME[p.key] = p;
  return [];
}

/** The pack a program key names, baked or registered at runtime. */
export const packFor = (key: string): StationPack | undefined => PACKS[key] ?? RUNTIME[key];

/**
 * The program a registry station plays: the house schedules for "idm", IMD/ETH's own for "imd-eth", else its pack's
 * (cached by programFromPack).
 */
export function programFor(key: string): Program {
  if (key === "idm") return HOUSE_PROGRAM;
  if (key === "imd-eth") return IMD_ETH_PROGRAM;
  const pack = packFor(key);
  if (!pack) throw new Error(`no station pack "${key}" (packages/synth/src/stations/index.ts, or a runtime pack)`);
  return programFromPack(pack);
}
