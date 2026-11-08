// Machine Electro pack tooling (v4, v4.1, v4.2). Run from this folder:
//   npx tsx gen.mts                 writes ../../src/stations/machine-electro.ts (the v3 pack from git + each style's
//                                   `machine` arrangement + mixfix.json's stem calibration), a pure object literal
//   npx tsx val.mts                 validatePack + the pack-literal parser
//   ./gate.sh <log>                 the pack gate, waiting for port 5197 (other agents share it)
//   node render.mjs <dir> 180 [ids] 3-min renders (+ a source census in the .json); OVERRIDE / MUTES / TAG / BAR_OFFSET env
//   ./stems.sh <dir> 20 <ids> [port]; python3 stemana.py <dir>; python3 fix.py <dir>   solo stems, levels re the kick, calibration
//   python3 metrics.py <f32...>     sources, 200-2k / 2-6k share, side/mid, flatness, crest, LUFS; ana.py: bands
//   ./enc.sh in.f32 out.mp3; ./medley.sh out.mp3 <dir>; node audition.mjs out.f32 (every voice alone); bench.mjs (CPU)
//   ./hats.sh <dir> <ids> [port]; python3 hatmeas.py <dir> <ids> (MIXDIR=<3-min dir>)   hat bus alone: onsets/bar, level, HF
//   ./ab.sh before.f32 after.f32 <start s> <seconds> out.mp3   one segment of two renders back to back
// Generates packages/synth/src/stations/machine-electro.ts (v4): the v3 styles plus each style's `machine` arrangement,
// written as a pure object literal (packLiteral.ts). Run: npx tsx gen.mts [outPath]
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The v3 pack (commit 04911af) is the base every v4 style is built on: read from git, so the generator always starts
// from the same data whatever the working tree holds.
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const V3_REF = "04911af";
const v3dir = mkdtempSync(join(tmpdir(), "mach-v3-"));
const v3file = join(v3dir, "machine-electro-v3.ts");
writeFileSync(v3file, execFileSync("git", ["show", `${V3_REF}:packages/synth/src/stations/machine-electro.ts`], { cwd: repo, encoding: "utf8" }).replace(/^import type .*$/m, ""));
const v3 = (await import(pathToFileURL(v3file).href)).default;

const OUT = process.argv[2] ?? resolve(repo, "packages/synth/src/stations/machine-electro.ts");
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const pack: any = clone(v3);
const style = (id: string) => pack.styles.electro.find((s: any) => s.id === id);

// ---------------------------------------------------------------- helpers
/** Form mask from its sections: intro 8, build 8, full 8, breakdown 4, rebuild 4 characters. */
const form = (intro: string, build: string, full: string, bd: string, re: string) => {
  const m = intro + build + full + bd + re;
  if (intro.length !== 8 || build.length !== 8 || full.length !== 8 || bd.length !== 4 || re.length !== 4) throw new Error(`form ${m}`);
  return m;
};
/** Two-bar lane from two 16-step bars. */
const g2 = (a: string, b = a) => {
  if (a.length !== 16 || b.length !== 16) throw new Error(`lane ${a} ${b}`);
  return a + b;
};
const merge = (a: any, b: any): any => {
  if (b === undefined) return a;
  if (typeof a !== "object" || a === null || Array.isArray(a) || typeof b !== "object" || b === null || Array.isArray(b)) return b;
  const o: any = { ...a };
  for (const [k, v] of Object.entries(b)) o[k] = merge(a[k], v);
  return o;
};
const N = (s: number, len: number, n: number, x?: number) => (x ? { s, len, n, x } : { s, len, n });

const A = [730, 1090, 2440];
const E = [530, 1840, 2480];
const I = [270, 2290, 3010];
const O = [570, 840, 2410];
const U = [300, 870, 2240];
const AW = [640, 1190, 2390];

// ---------------------------------------------------------------- voice presets
const SUPERSAW = { voices: 7, detune: 22, width: 0.7, wave: "saw", sub: 0.3, cutoff: 1300, env: 2800, decay: 0.35, q: 1.4, keytrack: 0.5, attack: 0.004, dec: 0.3, sustain: 0.6, release: 0.22, drive: 1.2, level: 0.1 };
const STAB = { voices: 4, detune: 14, width: 0.6, wave: "saw", top: 0.25, cutoff: 650, env: 2600, decay: 0.14, q: 3, attack: 0.002, dec: 0.18, sustain: 0.25, release: 0.12, drive: 1.5, level: 0.05 };
const ARP = { voices: 2, detune: 8, width: 0.3, wave: "pulse25", sub: 0, cutoff: 850, env: 2200, decay: 0.09, q: 5, attack: 0.002, dec: 0.1, sustain: 0.2, release: 0.08, level: 0.09 };
const STR = { octave: 0.4, detune: 7, slow: [0.55, 10], fast: [6.1, 3], width: 0.8, cutoff: 3000, q: 0.8, hp: 180, attack: 0.6, release: 1.4, level: 0.12 };
const CHOIR = { detune: 7, width: 0.6, q: 9, breath: 0.2, attack: 0.12, release: 0.5, level: 0.15 };
const BELL = { ops: [{ ratio: 3.5, index: 2.2, decay: 0.5, floor: 0.05 }], detune: 5, width: 0.5, attack: 0.002, dec: 1.2, sustain: 0, release: 0.6, level: 0.07 };
const BLEEP = { wave: "sine", ring: 2.76, lp: 4000, decay: 0.12, level: 0.05 };

// Sections (masks).
const OFF8 = "........";
const ON8 = "99999999";

// ---------------------------------------------------------------- the seven styles
const add: Record<string, any> = {};
const notes: Record<string, string> = {};

// 1. Control Program (Rother): cold machine funk at 131.
add["mach-control"] = {
  hoover: { level: 0 },
  arp: { level: 0 },
  machine: {
    kick: { knock: { freq: 175, to: 85, decay: 0.07, level: 0.32 }, click: { freq: 4200, decay: 0.008, level: 0.35 }, boom: { freq: 50, glide: 2.2, decay: 0.32, drive: 2.2, level: 0.22 } },
    snare: { body: { freqs: [190, 335], decay: 0.11, level: 0.3 }, snap: { hp: 3200, decay: 0.09, level: 0.42 }, clap: { bp: 1250, q: 1.3, gap: 0.008, decay: 0.16, width: 0.75, level: 0.5 }, air: { hp: 7500, decay: 0.3, level: 0.1 } },
    bass: {
      sub: 1.25, osc: [{ wave: "pulse25", detune: -5, level: 0.5 }, { wave: "square", detune: 6, level: 0.35 }],
      cutoff: 150, open: [3.5, 6.5], decay: [0.07, 0.12], q: [5.5, 9], sweep: 180, drive: 2.6, hp: 75, grit: 0.35, gritHz: 1500, mid: 1, level: 0.18, glide: 0.03, knob: 8,
    },
    strings: { voice: { ...STR, cutoff: 2600, level: 0.1 }, floor: 52, every: 1, form: form(OFF8, "....5566", "77777777", "9999", "5677") },
    stab: { voice: STAB, floor: 52, bars: 2, hits: [{ s: 3, len: 1 }, { s: 6, len: 1.5 }, { s: 14, len: 0.5 }, { s: 19, len: 1 }, { s: 22, len: 1.5 }, { s: 27, len: 0.5 }], form: form(OFF8, "....6789", ON8, "....", "6789") },
    lead: {
      voice: { ...SUPERSAW, level: 0.085 }, floor: 60, bars: 4, glide: 0.05,
      notes: [N(0, 3, 4), N(3, 3, 3), N(6, 4, 2), N(12, 2, 3), N(14, 2, 4), N(16, 6, 5), N(24, 2, 4), N(26, 6, 2), N(32, 3, 4), N(35, 3, 3), N(38, 4, 2), N(44, 2, 1), N(46, 2, 2), N(48, 8, 0), N(58, 2, 1), N(60, 4, 2)],
      form: form(OFF8, OFF8, "99999999", "....", "..89"),
    },
    choir: { voice: CHOIR, floor: 52, bars: 4, hits: [{ s: 0, len: 14, vowels: [A, O] }, { s: 32, len: 14, vowels: [E, A, U] }], form: form(OFF8, "........", "....6666", "9999", "....") },
    arp: { voice: ARP, floor: 64, cell: [0, 1, 2, 3, 2, 1], rate: 1, gate: 0.8, sweep: 16, depth: 0.6, form: form(OFF8, "44556677", "88888888", "..66", "6677") },
    bleeps: { voice: BLEEP, floor: 76, bars: 4, notes: [{ s: 7, n: 4 }, { s: 23, n: 5 }, { s: 39, n: 3 }, { s: 61, n: 6 }], form: form(OFF8, "....5555", "77777777", "6666", "....") },
    perc: [
      { voice: "cowbell", grid: g2("..6.....6..5....", "..6.....6..5..6."), tune: 1, decay: 1, pan: 0.35, level: 0.55, form: form(OFF8, "....6677", "88888888", "....", "..77") },
      { voice: "clap", grid: g2("...............6", "......5........6"), tune: 1.1, decay: 1, pan: -0.2, level: 0.6, form: form(OFF8, "....5566", "77777777", "....", "..66") },
      { voice: "shaker", grid: g2("4646464646464646"), tune: 1, decay: 1, pan: -0.4, level: 0.5, form: form("....5566", "66666666", "77777777", "5555", "6666") },
      { voice: "tom", grid: g2("................"), fill: "........5.6.7.89", tune: 1, decay: 1, pan: 0.2, level: 0.8, form: form("........", "99999999", "99999999", "....", "9999") },
      { voice: "crash", grid: g2("9..............."), tune: 1, decay: 1, pan: 0.3, level: 0.6, form: form("........", "9.......", "9.......", "....", "....") },
    ],
    drive: { kick: 1.4, snare: 1.3, bass: 1.6, harm: 1.3, lead: 1.2 },
  },
};

// 2. Memory Drift (Plant43): emotive, 123, two bars a chord.
add["mach-memory"] = {
  pad: { level: 0.08 },
  kit: { kick: { decay: 0.38 } },
  machine: {
    kick: { knock: { freq: 150, to: 80, decay: 0.08, level: 0.26 }, click: { freq: 3000, decay: 0.006, level: 0.18 }, boom: { freq: 46, glide: 2, decay: 0.45, drive: 1.6, level: 0.24 } },
    snare: { body: { freqs: [180, 320], decay: 0.12, level: 0.26 }, snap: { hp: 2600, decay: 0.12, level: 0.3 }, clap: { bp: 1100, q: 1.1, gap: 0.01, decay: 0.22, width: 0.85, level: 0.45 }, air: { hp: 6800, decay: 0.4, level: 0.09 } },
    bass: {
      sub: 1.25, osc: [{ wave: "saw", detune: -4, level: 0.5 }, { wave: "pulse25", detune: 4, level: 0.3 }],
      cutoff: 140, open: [2.6, 4], decay: [0.12, 0.18], q: [2.2, 3.5], sweep: 140, drive: 1.8, hp: 70, grit: 0.12, gritHz: 1300, mid: 0.9, level: 0.18, glide: 0.04, knob: 16,
    },
    strings: { voice: { ...STR, octave: 0.55, detune: 9, width: 0.9, cutoff: 2400, attack: 1.2, release: 2.2, level: 0.13 }, floor: 50, every: 2, form: form("..557777", "88888888", "88888888", "9999", "8888") },
    lead: {
      voice: { ...SUPERSAW, voices: 5, detune: 12, wave: "saw", sub: 0, cutoff: 900, env: 1300, decay: 0.6, q: 1, attack: 0.03, dec: 0.5, sustain: 0.7, release: 0.5, vib: { rate: 5, depth: 9, delay: 0.35 }, drive: 0, level: 0.08 },
      floor: 64, bars: 8, glide: 0.09,
      notes: [N(0, 6, 3), N(6, 2, 2), N(8, 8, 1), N(20, 4, 2), N(24, 8, 3),
        N(32, 6, 4), N(38, 2, 3), N(40, 8, 2), N(52, 4, 1), N(56, 8, 0),
        N(64, 6, 3), N(70, 2, 2), N(72, 8, 1), N(84, 4, 2), N(88, 8, 4),
        N(96, 6, 5), N(102, 2, 4), N(104, 10, 3), N(116, 4, 2), N(120, 8, 1)],
      form: form(OFF8, OFF8, "99999999", "8888", "...."),
    },
    counter: {
      voice: { ...BELL, level: 0.06 }, floor: 72, bars: 4,
      notes: [N(2, 2, 2), N(6, 2, 3), N(10, 2, 1), N(14, 2, 2), N(18, 2, 3), N(22, 2, 4), N(26, 4, 2), N(34, 2, 2), N(38, 2, 1), N(42, 2, 0), N(46, 2, 1), N(50, 2, 2), N(54, 6, 3)],
      form: form(OFF8, "....5566", "77777777", "9999", "6666"),
    },
    choir: { voice: { ...CHOIR, q: 7, breath: 0.3, attack: 0.5, release: 1.2, level: 0.12 }, floor: 50, bars: 4, hits: [{ s: 0, len: 30, vowels: [U, O, U] }, { s: 32, len: 30, vowels: [O, A, O] }], form: form(OFF8, OFF8, "....5555", "9999", "....") },
    arp: { voice: { ...ARP, voices: 1, wave: "pulse25", sub: 0.5, cutoff: 700, env: 1600, q: 4, level: 0.08 }, floor: 60, cell: [0, 2, 1, 3, 2, 4, 3, 1], rate: 1, gate: 0.7, sweep: 32, depth: 0.7, form: form(OFF8, "33445566", "66666666", "....", "5566") },
    perc: [
      { voice: "conga", grid: g2("......5.....4..3", "...5......5...4."), tune: 1, decay: 1, pan: 0.4, level: 0.6, form: form(OFF8, "....5566", "77777777", "....", "6666") },
      { voice: "shaker", grid: g2("3535353535353535"), tune: 0.9, decay: 1.2, pan: -0.45, level: 0.45, form: form("....4455", "66666666", "66666666", "4444", "5555") },
      { voice: "clave", grid: g2("...5......5.....", "......5.....5..."), tune: 0.8, decay: 1, pan: 0.5, level: 0.4, form: form(OFF8, "........", "66666666", "....", "....") },
      { voice: "crash", grid: g2("7..............."), tune: 0.9, decay: 1.4, pan: -0.3, level: 0.5, form: form("........", "........", "9.......", "....", "9...") },
    ],
    drive: { kick: 1.2, snare: 1.2, bass: 1.4, harm: 1.2 },
  },
};

// 3. Orbit Roller (Client_03): bass-heavy broken beat, 135.
add["mach-roller"] = {
  pad: { level: 0.05 },
  machine: {
    kick: { knock: { freq: 180, to: 90, decay: 0.06, level: 0.3 }, click: { freq: 3600, decay: 0.007, level: 0.3 }, boom: { freq: 48, glide: 2.4, decay: 0.3, drive: 2.6, level: 0.2 } },
    snare: { body: { freqs: [215, 360], decay: 0.09, level: 0.3 }, snap: { hp: 2800, decay: 0.14, level: 0.4 }, clap: { bp: 1500, q: 1.5, gap: 0.007, decay: 0.14, width: 0.6, level: 0.45 }, air: { hp: 8000, decay: 0.22, level: 0.08 } },
    bass: {
      sub: 1.45, osc: [{ wave: "saw", detune: -6, level: 0.5 }, { wave: "square", detune: 7, level: 0.36 }],
      cutoff: 135, open: [4.5, 8], decay: [0.08, 0.13], q: [5, 8.5], sweep: 220, drive: 3, hp: 80, grit: 0.5, gritHz: 1800, mid: 1, level: 0.18, glide: 0.04, knob: 4,
    },
    strings: { voice: { ...STR, octave: 0, cutoff: 1500, q: 1.4, attack: 0.9, level: 0.09 }, floor: 48, every: 2, form: form("....5566", "66666666", "55555555", "9999", "6666") },
    stab: { voice: { ...STAB, wave: "square", voices: 3, detune: 9, cutoff: 500, env: 1800, q: 5, level: 0.05 }, floor: 50, bars: 2, hits: [{ s: 2, len: 0.5 }, { s: 7, len: 0.5 }, { s: 11, len: 1 }, { s: 18, len: 0.5 }, { s: 23, len: 1 }, { s: 29, len: 0.5 }], form: form(OFF8, "....5566", "77777777", "....", "6677") },
    counter: {
      voice: { ops: [{ ratio: 1.41, index: 3, decay: 0.08, floor: 0.1 }, { ratio: 3, index: 1.2, decay: 0.04 }], detune: 4, width: 0.5, attack: 0.002, dec: 0.18, sustain: 0.1, release: 0.1, level: 0.06 },
      floor: 62, bars: 2,
      notes: [N(1, 1, 0), N(3, 1, 2), N(6, 1, 1), N(9, 1, 3), N(12, 1, 2), N(14, 1, 0), N(17, 1, 1), N(19, 1, 2), N(22, 1, 3), N(25, 1, 4), N(28, 1, 2), N(30, 1, 1)],
      form: form(OFF8, "....4455", "66666666", "....", "5566"),
    },
    choir: { voice: { ...CHOIR, ring: 1.5, q: 11, breath: 0.1, attack: 0.02, release: 0.25, level: 0.13 }, floor: 50, bars: 4, hits: [{ s: 54, len: 6, vowels: [A, I] }], form: form(OFF8, "........", "77777777", "9999", "....") },
    bleeps: { voice: { ...BLEEP, ring: 1.41, lp: 3500, sonar: 0.3 }, floor: 74, bars: 2, notes: [{ s: 5, n: 2 }, { s: 13, n: 4 }, { s: 21, n: 3 }, { s: 27, n: 5 }], form: form(OFF8, "....5555", "66666666", "7777", "....") },
    perc: [
      { voice: "tom", grid: g2("..........5.....", "...4......5...6."), fill: "......5..6..7.89", tune: 0.9, decay: 0.9, pan: -0.3, level: 0.7, form: form(OFF8, "....6677", "88888888", "....", "7777") },
      { voice: "rim", grid: g2("...5..5....5..5.", ".5....5...5..5.."), tune: 1, decay: 1, pan: 0.45, level: 0.45, form: form("....4455", "66666666", "66666666", "....", "6666") },
      { voice: "shaker", grid: g2("3636363636363636"), tune: 1.1, decay: 0.8, pan: -0.5, level: 0.42, form: form(OFF8, "55555555", "66666666", "5555", "5555") },
      { voice: "conga", grid: g2(".......5.....4..", "....5.....5....."), tune: 1.1, decay: 1, pan: 0.3, level: 0.5, form: form(OFF8, "........", "77777777", "....", "....") },
    ],
    drive: { kick: 1.4, snare: 1.3, bass: 1.8, harm: 1.2, lead: 1.2 },
  },
};

// 4. Machine System (the mix): everything at 129.
add["mach-system"] = {
  kit: { kick: { decay: 0.34 } },
  hoover: { level: 0 },
  arp: { level: 0 },
  machine: {
    kick: { knock: { freq: 165, to: 82, decay: 0.08, level: 0.3 }, click: { freq: 3800, decay: 0.007, level: 0.3 }, boom: { freq: 48, glide: 2, decay: 0.4, drive: 2, level: 0.24 } },
    snare: { body: { freqs: [185, 330], decay: 0.11, level: 0.28 }, snap: { hp: 3000, decay: 0.1, level: 0.36 }, clap: { bp: 1150, q: 1.2, gap: 0.009, decay: 0.2, width: 0.8, level: 0.6 }, air: { hp: 7200, decay: 0.32, level: 0.1 } },
    bass: {
      sub: 1.3, osc: [{ wave: "saw", detune: -11, level: 0.36 }, { wave: "saw", detune: 10, level: 0.34 }, { wave: "pulse25", detune: 0, level: 0.26 }],
      cutoff: 150, open: [3.5, 6.5], decay: [0.09, 0.14], q: [4.5, 7], sweep: 200, drive: 2.6, hp: 75, grit: 0.3, gritHz: 1600, mid: 1, level: 0.18, glide: 0.05, knob: 8,
    },
    strings: { voice: { ...STR, octave: 0.5, level: 0.11 }, floor: 52, every: 1, form: form("....4455", "66666666", "77777777", "9999", "6777") },
    stab: { voice: { ...STAB, voices: 5, detune: 18, level: 0.045 }, floor: 52, bars: 2, hits: [{ s: 2, len: 2 }, { s: 11, len: 0.5 }, { s: 18, len: 2 }, { s: 26, len: 3 }], form: form(OFF8, "....6677", "88888888", "....", "6677") },
    lead: {
      voice: { ...SUPERSAW, voices: 9, detune: 26, top: 0.15, level: 0.08 }, floor: 60, bars: 4, glide: 0.04,
      notes: [N(0, 2, 2), N(2, 2, 3), N(4, 4, 4), N(10, 2, 3), N(12, 4, 2), N(16, 2, 2), N(18, 2, 3), N(20, 6, 5), N(28, 4, 4),
        N(32, 2, 2), N(34, 2, 3), N(36, 4, 4), N(42, 2, 5), N(44, 4, 4), N(48, 6, 3), N(56, 2, 2), N(58, 6, 1)],
      form: form(OFF8, OFF8, "99999999", "....", "..89"),
    },
    counter: { voice: { ...BELL, ops: [{ ratio: 7, index: 1.4, decay: 0.3 }], level: 0.05 }, floor: 76, bars: 2, notes: [N(6, 2, 2), N(14, 2, 1), N(22, 2, 3), N(30, 2, 2)], form: form(OFF8, "........", "........", "9999", "....") },
    choir: { voice: { ...CHOIR, ring: 0.75, level: 0.13 }, floor: 52, bars: 4, hits: [{ s: 0, len: 14, vowels: [O, A] }, { s: 16, len: 14, vowels: [A, E] }, { s: 32, len: 14, vowels: [U, O] }, { s: 48, len: 14, vowels: [E, I] }], form: form(OFF8, "........", "........", "9999", "....") },
    arp: { voice: { ...ARP, voices: 3, detune: 10, wave: "saw" }, floor: 64, cell: [0, 2, 1, 4, 3], rate: 1, gate: 0.75, sweep: 16, depth: 0.65, form: form(OFF8, "44556677", "77777777", "..55", "6677") },
    bleeps: { voice: BLEEP, floor: 76, bars: 4, notes: [{ s: 11, n: 3 }, { s: 27, n: 5 }, { s: 43, n: 4 }, { s: 59, n: 6 }], form: form(OFF8, "....5555", "66666666", "....", "....") },
    perc: [
      { voice: "cowbell", grid: g2("......6.......5.", "..5...6.......5."), tune: 1, decay: 1, pan: -0.35, level: 0.5, form: form(OFF8, "........", "88888888", "....", "..77") },
      { voice: "clap", grid: g2("..........5....6", "...............6"), tune: 1, decay: 1.2, pan: 0.25, level: 0.55, form: form(OFF8, "....5566", "77777777", "....", "6666") },
      { voice: "shaker", grid: g2("4646464646464646"), tune: 1, decay: 1, pan: 0.45, level: 0.45, form: form("....4455", "66666666", "77777777", "5555", "6666") },
      { voice: "tom", grid: g2("................"), fill: "....5...6.6.7.89", tune: 1.05, decay: 1, pan: -0.2, level: 0.8, form: form("........", "99999999", "99999999", "....", "9999") },
      { voice: "crash", grid: g2("9..............."), tune: 1, decay: 1, pan: 0.3, level: 0.6, form: form("........", "9.......", "9.......", "....", "9...") },
    ],
    drive: { kick: 1.4, snare: 1.3, bass: 1.6, harm: 1.3, lead: 1.2 },
  },
};

// 5. Iron March: heavy machine march at 119.
add["mach-march"] = {
  hoover: { level: 0.04 },
  machine: {
    kick: { knock: { freq: 160, to: 75, decay: 0.09, level: 0.34 }, click: { freq: 3200, decay: 0.008, level: 0.3 }, boom: { freq: 44, glide: 2.4, decay: 0.55, drive: 2.4, level: 0.2 } },
    snare: { body: { freqs: [165, 300], decay: 0.15, level: 0.34 }, snap: { hp: 2200, decay: 0.18, level: 0.42 }, clap: { bp: 900, q: 1, gap: 0.011, decay: 0.28, width: 0.9, level: 0.55 }, air: { hp: 6000, decay: 0.55, level: 0.12 } },
    bass: {
      sub: 1.6, subWave: "sine", osc: [{ wave: "saw", detune: -3, level: 0.45 }, { wave: "triangle", detune: 3, level: 0.5 }],
      cutoff: 120, open: [2, 3], decay: [0.2, 0.3], q: [1.4, 2], sweep: 90, drive: 3, hp: 65, grit: 0.15, gritHz: 1100, mid: 0.8, level: 0.2, glide: 0.07, knob: 16,
    },
    strings: { voice: { ...STR, octave: 0.3, detune: 8, cutoff: 1800, q: 1.2, attack: 0.9, release: 1.8, level: 0.13 }, floor: 50, every: 1, form: form("..446666", "77777777", "88888888", "9999", "7788") },
    stab: {
      voice: { ...STAB, voices: 5, detune: 12, wave: "saw", top: 0, sub: 0.3, cutoff: 600, env: 1500, decay: 0.3, q: 1.5, attack: 0.04, dec: 0.3, sustain: 0.5, release: 0.25, drive: 1.3, level: 0.05 },
      floor: 48, bars: 2, hits: [{ s: 0, len: 3 }, { s: 8, len: 2 }, { s: 12, len: 1 }, { s: 16, len: 3 }, { s: 24, len: 2 }, { s: 28, len: 1 }, { s: 30, len: 1 }],
      form: form(OFF8, "....6677", "88888888", "....", "7788"),
    },
    lead: {
      voice: { ...SUPERSAW, voices: 5, detune: 10, wave: "square", sub: 0.4, cutoff: 900, env: 1500, decay: 0.5, q: 2, attack: 0.02, dec: 0.4, sustain: 0.65, release: 0.4, vib: { rate: 5.5, depth: 12, delay: 0.4 }, level: 0.075 },
      floor: 60, bars: 4, glide: 0.06,
      notes: [N(0, 8, 2), N(8, 4, 3), N(12, 4, 2), N(16, 12, 1), N(28, 4, 2), N(32, 8, 3), N(40, 4, 4), N(44, 4, 3), N(48, 16, 2)],
      form: form(OFF8, OFF8, "....9999", "....", "...."),
    },
    choir: { voice: { ...CHOIR, q: 8, breath: 0.25, attack: 0.3, release: 0.9, level: 0.14 }, floor: 45, bars: 2, hits: [{ s: 0, len: 15, vowels: [O, U] }, { s: 16, len: 15, vowels: [A, O] }], form: form(OFF8, "........", "6666....", "9999", "....") },
    perc: [
      { voice: "tom", grid: g2("............7.56", "............7.67"), fill: "....5.5.6.6.7889", tune: 0.72, decay: 1.3, pan: 0.25, level: 0.75, form: form(OFF8, "66667777", "88888888", "....", "8888") },
      { voice: "clap", grid: g2("..............4.", "..........4...4."), tune: 0.85, decay: 1.4, pan: -0.25, level: 0.4, form: form(OFF8, "........", "77777777", "....", "6666") },
      { voice: "shaker", grid: g2("..4...4...4...4."), tune: 0.8, decay: 1.4, pan: -0.45, level: 0.45, form: form("....4455", "55555555", "66666666", "....", "5555") },
      { voice: "crash", grid: g2("9..............."), tune: 0.85, decay: 1.5, pan: 0.2, level: 0.6, form: form("........", "9.......", "9...9...", "....", "9...") },
    ],
    drive: { kick: 1.5, snare: 1.4, bass: 1.7, harm: 1.3, lead: 1.2 },
  },
};

// 6. Black Circuit (Dopplereffekt): cold, clean, relentless at 137.
add["mach-circuit"] = {
  hoover: { level: 0 },
  arp: { level: 0 },
  machine: {
    kick: { knock: { freq: 190, to: 95, decay: 0.05, level: 0.3 }, click: { freq: 4800, decay: 0.006, level: 0.32 }, boom: { freq: 52, glide: 2.2, decay: 0.26, drive: 2.4, level: 0.18 } },
    snare: { body: { freqs: [300, 520], decay: 0.06, level: 0.24 }, snap: { hp: 4000, decay: 0.06, level: 0.4 }, clap: { bp: 1700, q: 1.6, gap: 0.006, decay: 0.1, width: 0.6, level: 0.45 }, air: { hp: 9000, decay: 0.18, level: 0.08 } },
    bass: {
      sub: 1.05, osc: [{ wave: "pulse12", detune: -4, level: 0.48 }, { wave: "square", detune: 5, level: 0.34 }],
      cutoff: 190, open: [3, 5], decay: [0.05, 0.08], q: [5, 7], sweep: 160, drive: 2.4, hp: 85, grit: 0.25, gritHz: 2000, mid: 1, level: 0.17, glide: 0.03, knob: 8,
    },
    strings: { voice: { ...STR, octave: 0.25, detune: 5, slow: [0.4, 6], fast: [6.8, 2], cutoff: 2200, q: 0.7, hp: 300, attack: 0.4, release: 1, level: 0.05 }, floor: 55, every: 1, form: form(OFF8, "........", "44444444", "7777", "4444") },
    stab: { voice: { ...STAB, wave: "pulse25", voices: 3, detune: 6, width: 0.4, top: 0, cutoff: 900, env: 3200, decay: 0.07, q: 2, dec: 0.08, sustain: 0.1, release: 0.06, drive: 0, level: 0.06 }, floor: 55, bars: 2, hits: [{ s: 2, len: 1 }, { s: 6, len: 0.5 }, { s: 13, len: 0.5 }, { s: 18, len: 1 }, { s: 22, len: 0.5 }, { s: 27, len: 0.5 }], form: form(OFF8, "....6677", "88888888", "....", "6677") },
    counter: {
      // v4.1 (the owner: from 0:30 a voice builds up over everything, harsh): these bells were it. The 7:1 index 1.8
      // threw sidebands up to 5 kHz on every 16th; now a soft index that dies in 80 ms, a lower register, ~8 dB down,
      // and a flat form (no ramp through the build).
      voice: { ...BELL, ops: [{ ratio: 7, index: 0.55, decay: 0.08, floor: 0.02 }, { ratio: 1, index: 0.35, decay: 0.3 }], detune: 3, dec: 0.45, release: 0.2, level: 0.024 },
      floor: 62, bars: 2,
      notes: [N(0, 1, 0), N(3, 1, 2), N(6, 1, 1), N(8, 1, 3), N(11, 1, 2), N(14, 1, 4), N(16, 1, 0), N(19, 1, 2), N(22, 1, 1), N(24, 1, 3), N(27, 1, 4), N(30, 1, 2)],
      form: form(OFF8, "....4444", "55555555", "4444", "4444"),
    },
    choir: { voice: { ...CHOIR, ring: 0, q: 8, breath: 0.05, attack: 0.03, release: 0.3, level: 0.085 }, floor: 52, bars: 4, hits: [{ s: 8, len: 6, vowels: [O, I] }, { s: 40, len: 6, vowels: [A, E] }], form: form(OFF8, "........", "88888888", "9999", "....") },
    arp: { voice: { ...ARP, voices: 1, wave: "pulse12", sub: 0, cutoff: 800, env: 1400, decay: 0.05, q: 1.5, level: 0.04 }, floor: 67, cell: [0, 1, 2, 1, 3, 2], rate: 1, gate: 0.5, sweep: 8, depth: 0.4, form: form(OFF8, "........", "55555555", "....", "4444") },
    bleeps: { voice: { ...BLEEP, wave: "square", ring: 3.5, lp: 3000, decay: 0.06, level: 0.045 }, floor: 79, bars: 1, notes: [{ s: 5, n: 1 }, { s: 13, n: 3 }], form: form(OFF8, "........", "66666666", "6666", "....") },
    perc: [
      { voice: "rim", grid: g2("..5..5.....5..5.", "..5..5..5....5.."), tune: 1.15, decay: 0.8, pan: -0.4, level: 0.45, form: form("....5566", "66666666", "77777777", "....", "6666") },
      { voice: "clave", grid: g2("......5.......5.", "......5...5...5."), tune: 1.2, decay: 0.8, pan: 0.45, level: 0.35, form: form(OFF8, "....5566", "66666666", "....", "6666") },
      { voice: "cowbell", grid: g2("........5.......", "........5.....5."), tune: 1.25, decay: 0.7, pan: 0.3, level: 0.4, form: form(OFF8, "........", "77777777", "....", "....") },
      { voice: "shaker", grid: g2("4545454545454545"), tune: 1.2, decay: 0.7, pan: -0.3, level: 0.4, form: form(OFF8, "55555555", "66666666", "4444", "5555") },
      { voice: "tom", grid: g2("................"), fill: "..........6.7.89", tune: 1.2, decay: 0.8, pan: 0.1, level: 0.7, form: form("........", "99999999", "99999999", "....", "9999") },
    ],
    drive: { kick: 1.4, snare: 1.2, bass: 1.5, harm: 1.2, lead: 1.1 },
  },
};

// 7. Cold Engine (Drexciya): deep water at 125.
add["mach-engine"] = {
  arp: { level: 0.06 },
  machine: {
    kick: { knock: { freq: 130, to: 70, decay: 0.09, level: 0.26 }, click: { freq: 2600, decay: 0.006, level: 0.2 }, boom: { freq: 42, glide: 2, decay: 0.7, drive: 2, level: 0.2 } },
    snare: { body: { freqs: [190, 340], decay: 0.1, level: 0.26 }, snap: { hp: 2200, decay: 0.16, level: 0.42 }, clap: { bp: 1000, q: 1.1, gap: 0.01, decay: 0.24, width: 0.85, level: 0.5 }, air: { hp: 6500, decay: 0.5, level: 0.11 } },
    bass: {
      sub: 0.95, osc: [{ wave: "square", detune: -15, level: 0.38 }, { wave: "pulse12", detune: 15, level: 0.38 }, { wave: "saw", detune: 0, level: 0.2 }],
      cutoff: 200, open: [2.5, 4], decay: [0.18, 0.25], q: [2.5, 3.5], sweep: 260, drive: 2.2, hp: 80, grit: 0.3, gritHz: 1200, mid: 1, level: 0.17, glide: 0.05, knob: 16,
    },
    strings: { voice: { ...STR, octave: 0.2, detune: 10, slow: [0.35, 14], cutoff: 1600, q: 1, attack: 1.4, release: 2.4, level: 0.13 }, floor: 48, every: 2, form: form("44556677", "77777777", "77777777", "9999", "7777") },
    lead: {
      // The whale song: one saw with a square under it through a ringing lowpass, sliding between long notes.
      voice: { voices: 3, detune: 8, width: 0.5, wave: "saw", sub: 0.3, cutoff: 700, env: 900, decay: 0.8, q: 9, keytrack: 0.8, attack: 0.08, dec: 0.6, sustain: 0.75, release: 0.8, vib: { rate: 4.2, depth: 18, delay: 0.5 }, level: 0.07 },
      floor: 60, bars: 8, glide: 0.18,
      notes: [N(0, 12, 2), N(12, 4, 3), N(16, 16, 4), N(36, 8, 3), N(44, 4, 2), N(48, 16, 1), N(64, 12, 2), N(76, 4, 4), N(80, 16, 5), N(100, 8, 4), N(108, 4, 3), N(112, 16, 2)],
      form: form(OFF8, OFF8, "99999999", "9999", "...."),
    },
    choir: { voice: { ...CHOIR, q: 7, breath: 0.35, attack: 0.8, release: 1.6, level: 0.11 }, floor: 48, bars: 4, hits: [{ s: 0, len: 30, vowels: [U, O] }, { s: 32, len: 30, vowels: [O, U] }], form: form(OFF8, "....5566", "66666666", "9999", "6666") },
    bleeps: { voice: { ...BLEEP, ring: 0, wave: "sine", lp: 2500, decay: 0.15, sonar: 0.8, level: 0.06 }, floor: 69, bars: 4, notes: [{ s: 0, n: 2 }, { s: 22, n: 3 }, { s: 38, n: 1 }], form: form("....6666", "66666666", "77777777", "9999", "6666") },
    perc: [
      { voice: "conga", grid: g2("...5......4..5..", "......5...4....5"), tune: 0.85, decay: 1.2, pan: 0.4, level: 0.55, form: form(OFF8, "....5566", "77777777", "....", "6666") },
      { voice: "shaker", grid: g2("..4...4...4...45"), tune: 0.9, decay: 1.3, pan: -0.45, level: 0.45, form: form("....4455", "66666666", "66666666", "4444", "5555") },
      { voice: "tom", grid: g2("..........5.....", "...........5..6."), fill: "......6..6..7.89", tune: 0.8, decay: 1.3, pan: -0.2, level: 0.65, form: form(OFF8, "66666666", "77777777", "....", "7777") },
      { voice: "crash", grid: g2("8..............."), tune: 0.8, decay: 1.6, pan: 0.3, level: 0.5, form: form("........", "........", "9.......", "....", "9...") },
    ],
    drive: { kick: 1.3, snare: 1.3, bass: 1.6, harm: 1.2, lead: 1.2 },
  },
};

for (const [id, patch] of Object.entries(add)) {
  const s = style(id);
  s.data = merge(s.data, patch);
}
function scaleBus(m: any, bus: string, k: number) {
  const r = (x: number) => Math.round(x * 10000) / 10000;
  const parts: Record<string, string[]> = { harm: ["strings", "stab", "choir"], lead: ["lead", "counter", "arp"], perc: ["bleeps"] };
  for (const p of parts[bus] ?? []) if (m[p]) m[p].voice.level = r(m[p].voice.level * k);
  if (bus === "perc") for (const l of m.perc ?? []) if (l.voice !== "shaker" && l.voice !== "clap") l.level = Math.min(1.5, r(l.level * k));
  if (bus === "bass" && m.bass) m.bass.level = r(m.bass.level * k);
  if (bus === "kick" && m.kick) for (const l of Object.values(m.kick) as any[]) l.level = r(l.level * k);
  if (bus === "snare" && m.snare) for (const l of Object.values(m.snare) as any[]) l.level = r(l.level * k);
  console.log("scaled", bus, k.toFixed(3));
}
// Spectral balance (v4 renders: under 60 Hz ~50% of the energy, 2-6 kHz ~1.5%): less sub, more presence.
const r2 = (x: number) => Math.round(x * 1000) / 1000;
for (const s of pack.styles.electro) {
  const m = s.data.machine;
  if (!m) continue;
  if (m.bass) m.bass.sub = r2(m.bass.sub * 0.8);
  if (m.kick?.boom) m.kick.boom.level = r2(m.kick.boom.level * 0.8);
  for (const p of ["lead", "stab"]) if (m[p]) m[p].voice.cutoff = Math.round(m[p].voice.cutoff * 1.25);
  if (m.snare?.snap) m.snare.snap.level = r2(m.snare.snap.level * 1.2);
  const master = s.data.fx.master;
  if (master?.lp) master.lp = Math.min(16000, master.lp + 3000);
}
// v4.1 (the owner: every snare is wet): the snare bus sends no plate and no echo, only a little of the short room;
// the snare's air and clap layers are short, so no layer brings a tail back.
for (const s of pack.styles.electro) {
  const fx = s.data.fx;
  fx.plateSend.snare = 0;
  fx.echoSend.snare = 0;
  fx.spaceSend.snare = 0.05;
  const sn = s.data.machine?.snare;
  if (sn?.air) sn.air.decay = Math.min(sn.air.decay, 0.08);
  if (sn?.clap) sn.clap.decay = Math.min(sn.clap.decay, 0.1);
  if (sn?.snap) sn.snap.decay = Math.min(sn.snap.decay, 0.1);
  for (const l of s.data.machine?.perc ?? []) if (l.voice === "clap") l.decay = Math.min(l.decay, 0.8);
}
// ---------------------------------------------------------------- v4.2
// The owner on v4.1. Hats (Control Program, Machine System, Iron March, Black Circuit, Cold Engine; not Orbit Roller):
// "poured into my ears, so dry and so many of them". The base's hats (alienrave: a busy market row locks into straight
// 16ths of a 9 kHz highpassed tick, plus heat rolls) and the 16th shaker lanes on the hat bus made a constant carpet of
// 6-12 kHz fizz. Now each style has its own hat lanes (MachineSpec.hats): a two-bar pattern per section, mostly
// offbeat 8ths with soft ghosts and an open hat where it fits, gaps in the intro and the breakdown; the hat itself is
// the 808's six squares through a bandpass plus a little bandpassed noise, a lowpass over the fizz, a 1.5 ms attack and
// an early reflection, not a tick at the ear. The shaker carpets go.
const HAT = { metal: 0.6, tune: 1, noise: 0.45, bp: 6200, q: 1.1, hp: 3600, lp: 9500, attack: 0.0015, closed: 0.04, open: 0.2, room: 0.013, roomLevel: 0.35, level: 0.3 };
const hatLanes: Record<string, any> = {
  // Rother: offbeat 8ths with ghosts after them, the open hat ending every second bar.
  "mach-control": {
    voice: { ...HAT, level: 0.55 }, spread: 0.3,
    lanes: [
      { grid: g2("..5.......5.....", "..5.......5....."), pan: 0.15, form: form("....5566", "........", "........", "....", "....") },
      { grid: g2("..6...6...6...6.", "..6...6...6...e."), pan: 0.15, form: form(OFF8, "66667777", "........", "....", "7777") },
      { grid: g2("..7.3.7...7.3.6.", "..7.3.7...7.2.f."), fill: "..7.3.7...7.3434", pan: 0.15, form: form(OFF8, "........", "99999999", "....", "....") },
      { grid: g2("................", "..........d....."), pan: 0.15, form: form(OFF8, OFF8, OFF8, "6666", "....") },
    ],
  },
  // The mix: swung offbeats with a pickup before them, the open hat on the last offbeat of the bar.
  "mach-system": {
    voice: { ...HAT, bp: 5900, lp: 9000, closed: 0.045, level: 0.57 }, spread: 0.35,
    lanes: [
      { grid: g2("....5.......5...", "....5.......5..."), pan: -0.1, form: form("....5566", "........", "........", "....", "....") },
      { grid: g2("..6.....3.6.....", "..6...6...6...e."), pan: -0.1, form: form(OFF8, "66667777", "........", "....", "7777") },
      { grid: g2("..7..36...7..3e.", "..7..36...7.4.6."), fill: "..7..36...7.3535", pan: -0.1, form: form(OFF8, "........", "99999999", "....", "....") },
      { grid: g2("..........c.....", "................"), pan: -0.1, form: form(OFF8, OFF8, OFF8, "6666", "....") },
    ],
  },
  // The march: few hats, darker and lower, on the offbeats; the open hat closes every second bar.
  "mach-march": {
    voice: { ...HAT, tune: 0.85, bp: 5200, q: 1, hp: 3000, lp: 8000, closed: 0.05, open: 0.24, roomLevel: 0.4, level: 0.41 }, spread: 0.25,
    lanes: [
      { grid: g2("..5.......5.....", "..5.......5....."), pan: 0.1, form: form(OFF8, "55556666", "........", "....", "6666") },
      { grid: g2("..6...6...6.3.6.", "..6...6.3.6...e."), fill: "..6...6...6.3.4.", pan: 0.1, form: form(OFF8, "........", "99999999", "....", "....") },
    ],
  },
  // Dopplereffekt: straight 8ths, the offbeat accented and the downbeat a ghost, a gap every second half-bar.
  "mach-circuit": {
    voice: { ...HAT, tune: 1.12, bp: 6800, q: 1.3, lp: 10000, closed: 0.032, metal: 0.65, noise: 0.35, level: 0.8 }, spread: 0.3,
    lanes: [
      { grid: g2("..5...5...5...5.", "..5...5...5...5."), pan: -0.12, form: form("....5566", "66667777", "........", "....", "6677") },
      { grid: g2("2.7.2.7...7.2.7.", "2.7...7.2.7...f."), fill: "2.7.2.7.2.7.3434", pan: -0.12, form: form(OFF8, "........", "99999999", "....", "....") },
      { grid: g2("................", "..........d....."), pan: -0.12, form: form(OFF8, OFF8, OFF8, "5555", "....") },
    ],
  },
  // Deep water: sparse, soft, a longer open hat in a slightly bigger reflection.
  "mach-engine": {
    voice: { ...HAT, tune: 0.9, bp: 5600, q: 1, hp: 3200, lp: 8500, closed: 0.05, open: 0.3, room: 0.019, roomLevel: 0.45, level: 0.49 }, spread: 0.3,
    lanes: [
      { grid: g2("..........5.....", "..........5....."), pan: 0.15, form: form("....4455", "........", "........", "....", "....") },
      { grid: g2("..5.......5.....", "..5...4...5....."), pan: 0.15, form: form(OFF8, "55556666", "........", "....", "6666") },
      { grid: g2("..6.....3.6.....", "..6...4...6...c."), fill: "..6...4...6.3.4.", pan: 0.15, form: form(OFF8, "........", "99999999", "....", "....") },
      { grid: g2("..........c.....", "................"), pan: 0.15, form: form(OFF8, OFF8, OFF8, "5555", "....") },
    ],
  },
};
for (const [id, hats] of Object.entries(hatLanes)) {
  const m = style(id).data.machine;
  m.hats = hats;
  m.perc = m.perc.filter((l: any) => l.voice !== "shaker");
}
// Memory Drift (the owner: "remove the bell"): the FM bell counter-line (ratio 3.5, index 2.2, from the build through
// the breakdown) goes. The strings, the lead, the choir and the arp fill the same bars; nothing replaces it.
delete style("mach-memory").data.machine.counter;
// Iron March (the owner: the synth before the first mini-breakdown is "sunbeams against the gloom"): the machine lead,
// bars 20-23 of the form right before the 4-bar breakdown, a 5-voice square stack with a square sub, cutoff 1125 Hz +
// 1500 Hz envelope, a 20 ms attack and a 12-cent vibrato, an octave over the strings and 12 dB over them. Now fog: a
// 7-voice saw ensemble an octave lower (in the strings' register), wide, under a 24 dB lowpass at 480 Hz with almost no
// envelope, a 350 ms swell in and a long release, a slow shallow vibrato, about 7 dB down per bar (-23 -> -30 dB solo): it moves inside the strings.
{
  const m = style("mach-march").data.machine;
  m.lead.voice = { voices: 7, detune: 16, width: 0.95, wave: "saw", sub: 0, cutoff: 480, env: 220, decay: 1.2, q: 0.8, keytrack: 0.2, attack: 0.35, dec: 0.8, sustain: 0.85, release: 0.9, vib: { rate: 4.2, depth: 6, delay: 0.7 }, drive: 0, level: 0.05 };
  m.lead.floor = 48;
  m.lead.glide = 0.12;
}
// Machine System (the owner: "too positive a synth, like a harmonica or a bayan"). Solo stems of the full section: the
// loudest and brightest voice is the 9-voice supersaw hook with a 25% pulse an octave up (`top`), cutoff 1625 Hz +
// 2800 Hz envelope (-26 dB per bar re full scale, 4 kHz+ at -16.5 dB of its energy; the strings -28 dB and -22 dB):
// the harmonica. Under it the string machine with half its level in the 4' pulse, cutoff 3000 Hz and a 6.1 Hz
// ensemble: the bayan's reeds. Both play chord tones of Ab-major and Bb-major triads (chords 1 and 4). Now: those two
// chords minor (Fm/Ab, Gm/Bb; the bass line is the same), the hook a 5-voice saw ensemble without the pulse top, an
// octave-down square for body, cutoff 820 Hz + 900 Hz, about 3 dB down; the strings without most of the
// 4' pulse and darker.
{
  const st = style("mach-system");
  st.data.chords[1] = { bass: -4, tones: [0, 5, 8, 12] };
  st.data.chords[4] = { bass: -2, tones: [2, 7, 10] };
  const m = st.data.machine;
  m.lead.voice = { ...m.lead.voice, voices: 5, detune: 14, width: 0.8, wave: "saw", top: 0, sub: 0.25, cutoff: 820, env: 900, decay: 0.5, q: 1, attack: 0.025, sustain: 0.7, release: 0.35, level: 0.055 };
  m.strings.voice = { ...m.strings.voice, octave: 0.12, cutoff: 1900 };
  // "In the build before the drop ('the pit') a terrible bell ring": the 7:1 FM bells (index 1.4, floor 76: E5 and up)
  // that played only the breakdown, the pit before the rebuild's drop. Gone; the breakdown's choir loses its ring
  // modulator (inharmonic, bell-like sidebands) and the ring-modulated bleeps leave the build's last four bars.
  delete m.counter;
  m.choir.voice.ring = 0;
  m.bleeps.form = form(OFF8, "........", "66666666", "....", "....");
}
// Level calibration (mixfix.json: { style: { bus: dB delta, trim: factor } }), from the solo stems.
import { existsSync, readFileSync } from "node:fs";
const FIX = new URL("./mixfix.json", import.meta.url);
if (existsSync(FIX)) {
  for (const [id, d] of Object.entries(JSON.parse(readFileSync(FIX, "utf8")) as Record<string, Record<string, number>>)) {
    const s = style(id);
    for (const [bus, db] of Object.entries(d)) {
      if (bus === "trim") s.trim = Math.round(s.trim * db * 1000) / 1000;
      else {
        const want = (s.data.mix[bus] ?? 0) + db;
        const got = Math.max(-6, Math.min(6, want));
        s.data.mix[bus] = Math.round(got * 10) / 10;
        // Past the bus trim's range: the machine parts on that bus take the rest.
        if (Math.abs(want - got) > 0.05) scaleBus(s.data.machine, bus, 10 ** ((want - got) / 20));
      }
    }
  }
}

// ---------------------------------------------------------------- serialise
const ident = /^[A-Za-z_$][\w$]*$/;
const key = (k: string) => (ident.test(k) ? k : JSON.stringify(k));
const flat = (v: any): string => {
  if (Array.isArray(v)) return `[${v.map(flat).join(", ")}]`;
  if (v && typeof v === "object") return `{ ${Object.entries(v).map(([k, x]) => `${key(k)}: ${flat(x)}`).join(", ")} }`;
  return JSON.stringify(v);
};
const out = (v: any, ind: string, room: number): string => {
  const f = flat(v);
  if (f.length <= room || !(v && typeof v === "object")) return f;
  const inner = ind + "  ";
  if (Array.isArray(v)) {
    // Pack short items several to a line.
    const items = v.map((x) => out(x, inner, 118 - inner.length));
    if (items.every((x) => !x.includes("\n"))) {
      const lines: string[] = [];
      let line = "";
      for (const it of items) {
        if (line && (inner + line + ", " + it).length > 118) {
          lines.push(line + ",");
          line = it;
        } else line = line ? `${line}, ${it}` : it;
      }
      lines.push(line + ",");
      return `[\n${lines.map((l) => inner + l).join("\n")}\n${ind}]`;
    }
    return `[\n${items.map((x) => `${inner}${x},`).join("\n")}\n${ind}]`;
  }
  return `{\n${Object.entries(v).map(([k, x]) => `${inner}${key(k)}: ${out(x, inner, 118 - inner.length - key(k).length - 2)},`).join("\n")}\n${ind}}`;
};

const header = readHeader();
function readHeader() {
  return `import type { StationPack } from "../pack.ts";

// Futuristic Machine Electro: finished electro tracks as a system of interacting machines, from three axes: Anthony
// Rother (cold machine funk, hard repetitive bass, the vocoder), Plant43 (emotive sci-fi electro, melancholic
// sequences, space, slow evolution) and Client_03 (bass-heavy broken beat, rolling interlocking percussion), with the
// classic machine-funk references under all of them (Cybotron "Clear", Model 500 "No UFO's", Drexciya "Black Sea",
// Dopplereffekt, Aux 88, DJ Stingray, Kraftwerk). Control Program (Rother), Memory Drift (Plant43), Orbit Roller
// (Client_03), Machine System (the mix) and three darker ones: Iron March, Black Circuit, Cold Engine. Baked, on no
// station yet. No noise risers (riser 0).
//
// v4 (the owner on v3: still hollow; reverb sends are not the point, the sound must be FULLER and RICHER): every style
// keeps its v3 groove, bass line, chords, space and vocoder words, and gets a full arrangement on the new voice
// library (packages/synth/src/voices, the opt-in \`machine\` field):
//   * every main part in layers: the kick gets a knock (100-200 Hz punch), a click and a saturated 808 boom tail; the
//     snare a tuned two-mode body, a snap, a four-burst stereo clap and air; the bass is sub + a driven, acid-filtered
//     mid (its cutoff travelling on a slow knob) + a parallel grit band;
//   * new instruments: a string machine (three ensemble lines, Solina-style), unison saw stacks (stabs, a 5-9 voice
//     lead), a formant choir (the vocoder chords), FM operators (bells, metallic keys), a poly arp with a filter
//     sweep over 8-32 bars, ring-modulated bleeps and sonar pings, 808 toms, cowbell, congas, claves, rims, shakers,
//     extra claps, tom fills on every 8th bar and crashes on the section changes;
//   * arrangement: each part enters and leaves on its own 32-bar form mask (strings and shakers in the intro, the
//     arp, stabs and percussion through the build, the lead, counter-lines and cowbell in the full part, the choir
//     and the strings carrying the breakdown);
//   * saturation on the kick, snare, bass, pad and lead buses (tanh, unity on small signals) and the pads' sidechain.
// Where a new part does the job of a base one, the base's is off or lower (hoover, the alienrave arp, the client pad).
//
// v4.2 (the owner on v4.1: the hats "poured into the ears", too dry and too many): five styles play their own hat
// lanes (MachineSpec.hats: offbeat patterns per section, an open hat where it fits, the 808's metal through a bandpass
// with an early reflection) in place of the base's 16th hats and the shaker carpets; Memory Drift without its bells;
// Machine System's hook and strings darker and minor, no bells in the breakdown; Iron March's bright lead before the
// breakdown now a low fog in the strings. Orbit Roller unchanged.
export default `;
}

const styleNotes: Record<string, string> = {
  "mach-control": `Rother: cold dystopian machine funk at 131, straight and machine-tight. The v3 groove (hard short kick, body-noise-
      // metal snare in a small bright plate, locked 16th hats), the hollow pulse bass now a layered acid line (pulse +
      // square mid, resonant 24 dB envelope, sub, grit), Rother's JD-800 strings from the build, short saw stabs, a
      // 7-voice supersaw hook in the full part, the Orville-style choir in the breakdown, a pulse arp swept over 16
      // bars, "Clear" cowbell, off-beat claps, shakers, tom fills, and the vocoder: "SYSTEM RECEIVES HUMAN SIGNAL".`,
  "mach-memory": `Plant43: emotive electro at 123, loose on the hats and ghosts, two bars a minor seventh. A round layered
      // bass on the kicks, a wide, slow string machine from the intro's third bar, a soft 5-voice saw lead with a
      // delayed vibrato and glides in the full part, an SH-101-style single pulse arp swept over 32 bars (v4.2: no FM
      // bells), an "oo-oh" choir carrying the breakdown, congas, shakers and
      // claves, the triangle pluck sequence and "MEMORY" / "HUMAN" as before.`,
  "mach-roller": `Client_03: bass-heavy broken beat at 135, loose and robotic at once. The grimy riff bass now a layered saw-
      // square line with a hard grit band and a 4-bar cutoff knob, short dark square stabs, metallic FM keys (1.41)
      // interlocking in 16ths, a ring-modulated choir hit at the end of every 4 bars, low dark strings that carry the
      // breakdown, ring bleeps with a sonar tail, toms, rims, congas and shakers rolling over the chopped break.`,
  "mach-system": `The default mix at 129: machines interacting. The v3 groove and driven unison bass (now layered), strings
      // under everything (v4.2: darker, little 4' pulse), 7-voice saw stabs, a dark 5-voice saw hook in the full part (v4.2:
      // no pulse top, two chords minor), a 3-voice saw arp, a choir breakdown (v4.2: no FM bells), bleeps, "Clear" cowbell, claps, shakers, fills and crashes, and the vocoder.`,
  "mach-march": `Iron March: a heavy machine march at 119. The short punchy kick with a knock and a long boom tail, a big
      // four-burst snare, the 808 boom bass layered (sine sub, saw + triangle mid), menacing strings (Aux 88 "Space
      // Satellites") from the intro, brass-like slow saw stabs on the march beats, a foggy low saw ensemble (v4.2, was a bright
      // square lead) in the second half of the full part, a deep "oh-oo" choir, low march toms, sparse claps and crashes.`,
  "mach-circuit": `Black Circuit: a relentless, cold, clean system at 137 (Dopplereffekt more than Rother). The tight high pulse
      // bass layered, glassy FM bells (7:1) running a 16th figure from the build, clean short pulse stabs, a narrow
      // pulse-12 arp, a ring-modulated robot choir, thin cold strings, square ring bleeps, rims, claves, a high
      // cowbell, shakers and fills, the Circuit Voice and the vocoder: "THE GRID IS WATCHING".`,
  "mach-engine": `Cold Engine: deep water at 125 (Drexciya's "whale song", DJ Stingray's pressure). The long boom kick, a
      // noisy snare with a wide clap into the 3.2 s hall, the hollow reese bass layered, dark slow strings from the
      // first bar, the whale song (a 3-voice saw through a ringing lowpass, sliding between long notes) in the full
      // part and the breakdown, an "oo-oh" choir, sonar pings, congas, shakers, low toms and crashes.`,
};

let body = out(pack, "", 100);
// Style comments: before each style's "id" line.
for (const [id, text] of Object.entries(styleNotes)) {
  const marker = `      {\n        id: "${id}",`;
  if (!body.includes(marker)) throw new Error(`no marker for ${id}`);
  body = body.replace(marker, `      // ${text}\n${marker}`);
}
writeFileSync(OUT, header + body + " satisfies StationPack;\n");
console.log("wrote", OUT, (header + body).length, "chars");
