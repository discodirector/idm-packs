import type { StationPack } from "../pack.ts";
import acid from "./hamster-acid.ts";
import breaks from "./hamster-breaks.ts";
import dnb from "./hamster-dnb.ts";
import darkElectro from "./hamster-electro.ts";
import hamsterElectro2 from "./hamster-electro-2.ts";
import lofi from "./hamster-lofi.ts";
import ukg from "./hamster-ukg.ts";
import machineElectro from "./machine-electro.ts";

// The Squeekchain station (docs/STATIONS.md "Hamster station"): a real hamster's wheel through the $IDM rules, one
// note per 30 m of wheel. Awake, one genre per epoch: acid (hamster-acid.ts), breakbeat and dark electro on electro
// (hamster-breaks.ts, hamster-electro.ts), late-90s UK garage on future garage (hamster-ukg.ts), drum & bass on liquid
// (hamster-dnb.ts) and lo-fi house (hamster-lofi.ts); asleep, hamster-sleep.ts (synth sleep.ts). One file per genre so
// each can be reworked alone; this one only puts them together (owner's picks of 2026-10-27: Wheelie out; Hull
// Breach, Hypnagogue and Zero Kelvin in; the late-90s UK garage in place of the first garage set; DnB and lo-fi
// house added). From page 96 on (2026-10-30), a new genre and style every page (~64 notes, ~30 min of running) instead
// of every 4: a night is only ~4 pages, and one style held for an hour sounded like one style all night.
//
// From epoch SQUEEKCHAIN_ELECTRO_FROM on (owner, 2026-11-04: "fully replace the music on the hamster with Machine
// Electro and Hamster Electro"), electro only: the seven Machine Electro v4.2 styles (machine-electro.ts), the four
// Hamster Dark Electro II v2 styles (hamster-electro-2.ts) and the three hamster dark electro styles already on air
// (Zero Kelvin, Hull Breach, Hypnagogue: the same definitions as above), fourteen styles walked in order, one an
// epoch (one genre: the program's eachEpoch builds a new engine every epoch). The first cycle interleaves the packs,
// Zero Kelvin first (the owner's favourite reference); later cycles repeat the order (styles walk, only genres
// shuffle). An appended entry (`next`): every epoch before it keeps its genre and style (track posts and releases
// name them). Sleep mode (hamster-sleep.ts) is unchanged.

/**
 * The first epoch of the electro program (pages: 96 + (epoch - 24), eras.ts epochOf with epochPages { from: 96,
 * every: 1 }; epoch 84 is page 156). It must lie ahead of the epoch playing when the change goes on air: on
 * 2026-11-03 21:12 UTC the hamster slept since 03:50 on page 155 (epoch 83), so the switch is the next page (owner:
 * new music from the hamster's next run; deployed that evening before the run). Recompute right before deploying: `npx tsx packages/synth/scripts/squeekchain-switch.ts` prints the
 * epoch playing now (from the public checkpoint) and a safe value; set it here, rebuild, deploy. Once on air, frozen.
 */
export const SQUEEKCHAIN_ELECTRO_FROM = 84;

const kelvin = (id: string) => darkElectro.styles.electro.find((s) => s.id === id)!;
const me = (id: string) => machineElectro.styles.electro.find((s) => s.id === id)!;
const he2 = (id: string) => hamsterElectro2.styles.electro.find((s) => s.id === id)!;

export default {
  key: "hamster",
  name: "Squeekchain",
  genres: ["acid", "electro", "futuregarage", "liquid", "lofihouse"],
  epochPages: { from: 96, every: 1 },
  styles: {
    acid: acid.styles.acid,
    electro: [
      ...breaks.styles.electro.filter((s) => s.id !== "hamster-wheelie"),
      ...darkElectro.styles.electro.filter((s) => s.id === "hamster-delectro-breach" || s.id === "hamster-delectro-hypno" || s.id === "hamster-delectro-kelvin"),
    ],
    futuregarage: ukg.styles.futuregarage.filter((s) => s.id.startsWith("hamster-ukg90-")),
    liquid: dnb.styles.liquid,
    lofihouse: lofi.styles.lofihouse,
  },
  patches: { ...darkElectro.patches, ...dnb.patches, ...lofi.patches },
  next: [
    {
      fromEpoch: SQUEEKCHAIN_ELECTRO_FROM,
      genres: ["electro"],
      styles: {
        electro: [
          kelvin("hamster-delectro-kelvin"), // Zero Kelvin
          me("mach-control"), // Control Program
          he2("hamster-e2-blackice"), // Black Ice
          me("mach-memory"), // Memory Drift
          kelvin("hamster-delectro-breach"), // Hull Breach
          me("mach-roller"), // Orbit Roller
          he2("hamster-e2-fault"), // Fault Line
          me("mach-system"), // Machine System
          kelvin("hamster-delectro-hypno"), // Hypnagogue
          me("mach-march"), // Iron March
          he2("hamster-e2-longwave"), // Long Wave
          me("mach-circuit"), // Black Circuit
          he2("hamster-e2-servo"), // Servo Funk
          me("mach-engine"), // Cold Engine
        ],
      },
      patches: { ...machineElectro.patches, ...hamsterElectro2.patches },
    },
  ],
} satisfies StationPack;
