import type { StationPack } from "../pack.ts";

// Hamster Dark Electro II: four more styles in the world of hamster-electro.ts (Zero Kelvin, Hull Breach, Hypnagogue),
// after the owner's "у Хомяка крутое электро получилось" (2026-11-01). The same house rules: a syncopated 808 break
// (never four-on-the-floor, the snare on 2 and 4), a cold analog bass as the hook, few elements, minor keys with the
// Phrygian b2, minor seconds and tritones, no noise risers (riser 0), no lasers and no bright arp (they read as mouse
// squeaks on small speakers). Each style takes another corner of the sound:
//   Black Ice   (Client_03, ~121) a slow heavy roller: a long 808 boom, a legato bass rolling on slides, a low
//               foghorn answer falling a minor second, a dark pad.
//   Fault Line  (Client_03, ~125) broken electro-bass: kicks on the e and the a, dense dragged ghosts, a short stabby
//               bass with octave pops, a 5-step machine pluck phasing against the bar.
//   Long Wave   (Alien Rave, ~131) hypnotic minimal: a tonic pedal, a sparse 12/14-step bass into a long dub echo, a
//               sonar ping, a 7-step metal tick, a slow "oo" call; dry tight drums.
//   Servo Funk  (Alien Rave, ~139) fast, sharp machine funk: a hollow FM funk bass with octave pops, offbeat chord
//               chicks, a talkbox line on dotted 8ths and vocoder call-outs every four bars.
// v2 (the owner on v1: no depth, no bass, hollow, cheap synths): every style keeps its groove and gets a fat, wide,
// deep sound. The bass is three or four detuned oscillators with analog drift through a 24 dB filter opened from
// 115-160 Hz to 290-340 Hz, a parallel drive (`body`: 90 Hz - 1 kHz harmonics, heard on any speaker) and a louder
// mono sub; the kick has a punch layer, the snares a body, a ring and a noise tail; pads are slow detuned saws (no
// triangle drones), the leads stacked saws with drive; an ensemble chorus widens the bass's upper part (above
// ~260 Hz, the sub stays mono), the pads and the leads; a convolution plate / hall (`hall`) replaces most of the
// metallic tap room; pads duck under the kick.
// Baked, on no station (index.ts PACKS; the Style Lab's "Hamster II" shelf). The chain tempo lands at the top of each
// `bpm` range.
export default {
  key: "hamster-electro-2",
  name: "Hamster Dark Electro II",
  genres: ["electro"],
  styles: {
    electro: [
      // A slow, heavy roller on Client_03. A deep 808 with a long boom on sparse limping figures (the kick on the "and"
      // of 2, the second bar late), a deep snare, few dragged ghosts and dark, low break slices. The bass rolls legato:
      // long tied notes sliding down to the b7 and the fifth below and up into the b2, dead notes between, little
      // resonance and more grit. The lead is a low foghorn answering in the riff's gaps: a fifth falling to the tritone,
      // a b6 falling to the fifth, long notes into a dotted-quarter echo and a big dark room. A low pad (voiced under
      // 400 Hz) turns i, the bII triad and i with the tritone over the tonic pedal, then iv, two bars a chord; a slow
      // crushed voice every eight bars.
      {
        id: "hamster-e2-blackice",
        name: "Black Ice",
        base: "client03",
        bpm: [117, 121],
        swing: 0.56,
        microScale: 0.08,
        trim: 0.484,
        riser: 0,
        leads: ["he2-foghorn"],
        data: {
          chords: [
            { bass: 0, third: 3, seventh: 10, tones: [0, 3, 7] },
            { bass: 0, third: 3, seventh: 10, tones: [1, 5, 8] },
            { bass: 0, third: 3, seventh: 10, tones: [0, 3, 6] },
            { bass: 5, third: 3, seventh: 10, tones: [5, 8, 12] },
          ],
          progressions: [[0, 1, 0, 2], [0, 0, 3, 1], [0, 2, 0, 1]],
          kicks: {
            half: [[0, 16], [0, 10, 16]],
            lo: [[0, 10, 16, 26], [0, 11, 16, 27]],
            mid: [[0, 7, 10, 16, 26, 29], [0, 10, 14, 16, 23, 26]],
            hi: [[0, 6, 10, 16, 22, 26, 29], [0, 3, 10, 16, 19, 23, 26]],
          },
          ghosts: [
            [{ s: 7, vel: 0.22, core: true }, { s: 15, vel: 0.3, core: true }, { s: 23, vel: 0.24, core: true }, { s: 30, vel: 0.2, core: false }, { s: 31, vel: 0.28, core: true }],
            [{ s: 9, vel: 0.22, core: true }, { s: 14, vel: 0.18, core: false }, { s: 25, vel: 0.26, core: true }, { s: 31, vel: 0.28, core: true }],
          ],
          warps: [
            [0.85, 0.8, 0.9, 0.78, 0.85, 0.8, 0.95, 0.8, 0.85, 0.78, 0.9, 0.8, 0.88, 0.8, 1, 0.82],
            [0.9, 0.78, 0.85, 0.8, 0.92, 0.76, 0.86, 0.8, 0.9, 0.8, 0.84, 0.76, 0.95, 0.8, 0.88, 0.8],
          ],
          chops: [{ open: 14, steps: [15] }, { open: 6, steps: [7] }],
          // Flags: 1 accent (a quiet chain plays only these), 2 slide in, 4 ornament (busy chain), 8 dead note.
          riffs: [
            [
              { s: 0, semi: 0, len: 3, f: 1 }, { s: 3, semi: 0, len: 1, f: 8 }, { s: 4, semi: -2, len: 2, f: 2 }, { s: 6, semi: 0, len: 3, f: 3 },
              { s: 10, semi: 1, len: 2, f: 3 }, { s: 12, semi: 0, len: 3, f: 2 }, { s: 15, semi: 0, len: 1, f: 8 },
              { s: 16, semi: 0, len: 3, f: 1 }, { s: 19, semi: 12, len: 1, f: 4 }, { s: 20, semi: 0, len: 2, f: 0 }, { s: 22, semi: -5, len: 2, f: 3 },
              { s: 24, semi: -2, len: 2, f: 2 }, { s: 26, semi: 0, len: 3, f: 3 }, { s: 29, semi: 13, len: 1, f: 4 }, { s: 30, semi: 1, len: 2, f: 2 },
            ],
            [
              { s: 0, semi: 0, len: 4, f: 1 }, { s: 4, semi: 0, len: 1, f: 8 }, { s: 6, semi: 12, len: 1, f: 4 }, { s: 7, semi: 0, len: 3, f: 3 },
              { s: 10, semi: 3, len: 2, f: 2 }, { s: 12, semi: 1, len: 2, f: 2 }, { s: 14, semi: 0, len: 2, f: 1 },
              { s: 16, semi: 0, len: 2, f: 1 }, { s: 18, semi: 0, len: 1, f: 8 }, { s: 19, semi: -2, len: 3, f: 3 }, { s: 22, semi: 0, len: 2, f: 2 },
              { s: 24, semi: 0, len: 1, f: 8 }, { s: 26, semi: -5, len: 2, f: 1 }, { s: 28, semi: -4, len: 2, f: 2 }, { s: 30, semi: -2, len: 2, f: 6 },
            ],
          ],
          answers: [
            [{ s: 12, semi: 1, len: 2, core: false }, { s: 20, semi: 7, len: 4, core: true }, { s: 24, semi: 6, len: 6, core: true }],
            [{ s: 8, semi: 8, len: 3, core: true }, { s: 11, semi: 7, len: 5, core: true }, { s: 27, semi: 1, len: 3, core: false }],
          ],
          // "BLACK ICE", "DEEP FREEZE", "NO SIG-NAL".
          words: [
            { s: 2, syl: [[700, 1150, "p"], [650, 1100, "s"]] },
            { s: 2, syl: [[300, 2300, "t"], [300, 2300, "s"]] },
            { s: 4, syl: [[450, 800, null], [400, 2000, "s"], [500, 1700, null]] },
          ],
          kit: {
            kick: { start: 150, end: 42, sweep: 0.05, decay: 0.55, click: 0.16, clickHp: 2600, drive: 1.7, body: 1.15, punch: { freq: 140, decay: 0.045, level: 0.45 } },
            snare: [
              { tone: "triangle", freq: 196, to: 160, sweep: 0.035, decay: 0.12, level: 0.6 },
              { tone: "sine", freq: 330, to: 280, sweep: 0.02, decay: 0.05, level: 0.2 },
              { noise: "bandpass", freq: 1400, q: 0.8, decay: 0.2, level: 0.5 },
              { noise: "highpass", freq: 4200, q: 0.7, decay: 0.09, level: 0.18 },
              { clap: 0.22, at: 0.006 },
            ],
            ghost: [
              { noise: "bandpass", freq: 1700, q: 1, decay: 0.05, level: 0.36 },
              { tone: "triangle", freq: 205, to: 170, sweep: 0.02, decay: 0.03, level: 0.12 },
            ],
            hat: { hp: 6800, decay: 0.026, metal: 0.35, q: 1.1 },
            open: { hp: 5400, decay: 0.12, metal: 0.3, q: 1, level: 0.38 },
            accents: [0.3, 0.18, 0.44, 0.2],
          },
          // Fat: three detuned saws and a square, the 24 dB filter floor at 260 Hz (v1: 115, a bare fundamental), a
          // parallel drive for the 150 Hz - 1.5 kHz body, analog drift, the clean sub an octave down.
          bassTone: {
            osc: [{ type: "sawtooth", detune: -12, level: 0.42 }, { type: "sawtooth", detune: 9, level: 0.42 }, { type: "square", detune: 0, level: 0.3 }, { type: "sawtooth", detune: 3, level: 0.2 }],
            cutoff: 310, color: 160, q: [2.2, 3.2], open: [2.6, 3.8], decay: [0.16, 0.24], drive: 2.6, level: [0.15, 0.18], sub: [1.9, 2], glide: 0.09,
            body: { level: 0.85, drive: 3, lp: 720, hp: 90 }, drift: 5,
          },
          // A warm, slow string-machine pad (saws through a dark lowpass, wide in the ensemble), not a triangle drone.
          pad: { osc: [{ type: "sawtooth", detune: -10, level: 0.4 }, { type: "sawtooth", detune: 9, level: 0.4 }, { type: "triangle", detune: 0, level: 0.3 }], cutoff: 520, q: 0.9, attack: 1.6, release: 1.2, level: 0.1 },
          voice: { pitch: 80, bits: 5, hp: 240, lp: 2800, level: 0.1, every: 8 },
          ornament: { vowels: [[330, 650], [700, 1150]], wave: "triangle", steps: 4, octave: -12, syllable: 3, ring: 0, lowpass: 1400, echo: { steps: 6, feedback: 0.4 }, level: 0.06, slots: [2, 10] },
          fx: {
            echo: { steps: 6, taps: 3, fb: 0.4, lp: 1800, hp: 350 },
            echoSend: { lead: 0.5, snare: 0.06, harm: 0.12 },
            space: { size: 1.6, fb: 0.6, lp: 2400 },
            spaceSend: { lead: 0.18, harm: 0.15, snare: 0.06 },
            hall: { decay: 3.4, predelay: 30, lp: 5200, hp: 300, level: 1 },
            hallSend: { lead: 0.4, harm: 0.45, snare: 0.22, perc: 0.15 },
            ensemble: { bass: { mix: 0.3, hp: 260, rate: 0.35 }, harm: { mix: 0.55, rate: 0.45, depth: 3 }, lead: { mix: 0.4, rate: 0.5 } },
            duck: { bass: 0.7, harm: 0.6 },
            duckTime: { harm: 0.32 },
            drumLp: 11000,
            drive: 1.2,
            master: { lp: 11000 },
          },
          mix: { kick: 1, bass: 2, hat: -4, lead: -2 },
        },
      },
      // Broken electro-bass on Client_03. The kick lands on the e and the a (step 17 opens the second bar a 16th
      // late), dense ghost snares dragged behind the grid, hard-warped break slices stuttering on three chops, loose
      // hats. The bass is short and stabby: root, an octave pop, the b7 and the fifth below, the b2 slid into, dead
      // notes in every gap, accents off the beat. No answer: a 5-step pluck sequence on 8ths (10 16ths a cycle, the
      // tonic, the b3 and the b2) phases against the bar and turns a step every eight bars. Chords i, the bII triad over
      // the tonic, iv, two bars each.
      {
        id: "hamster-e2-fault",
        name: "Fault Line",
        base: "client03",
        bpm: [121, 125],
        swing: 0.53,
        microScale: 0.06,
        trim: 0.754,
        riser: 0,
        leads: ["he2-pluck"],
        data: {
          chords: [
            { bass: 0, third: 3, seventh: 10, tones: [0, 3, 7] },
            { bass: 0, third: 3, seventh: 10, tones: [1, 5, 8] },
            { bass: 5, third: 3, seventh: 10, tones: [5, 8, 12] },
          ],
          progressions: [[0, 1, 0, 2], [0, 0, 1, 2], [0, 2, 0, 1]],
          kicks: {
            half: [[0, 6, 16, 25]],
            lo: [[0, 6, 11, 16, 25], [0, 7, 16, 22, 27]],
            mid: [[0, 3, 6, 11, 16, 18, 22, 25], [0, 6, 9, 14, 17, 22, 27]],
            hi: [[0, 3, 6, 11, 14, 17, 22, 25, 30], [0, 3, 9, 11, 16, 19, 22, 27, 29]],
          },
          ghosts: [
            [
              { s: 2, vel: 0.2, core: false }, { s: 7, vel: 0.32, core: true }, { s: 10, vel: 0.24, core: true }, { s: 13, vel: 0.3, core: false },
              { s: 15, vel: 0.36, core: true }, { s: 21, vel: 0.26, core: true }, { s: 24, vel: 0.2, core: false }, { s: 26, vel: 0.32, core: true },
              { s: 29, vel: 0.26, core: false }, { s: 31, vel: 0.34, core: true },
            ],
            [
              { s: 5, vel: 0.26, core: true }, { s: 9, vel: 0.3, core: true }, { s: 14, vel: 0.22, core: false }, { s: 18, vel: 0.28, core: true },
              { s: 23, vel: 0.3, core: true }, { s: 27, vel: 0.22, core: false }, { s: 30, vel: 0.3, core: true },
            ],
          ],
          warps: [
            [1.1, 0.8, 1.2, 0.75, 1.1, 0.7, 1.25, 0.85, 0.95, 0.75, 1.15, 0.8, 1.2, 0.7, 1.3, 0.9],
            [0.9, 1.2, 0.75, 1.1, 0.8, 1.25, 0.7, 1.15, 0.9, 1.2, 0.8, 1.05, 0.75, 1.3, 0.85, 1.1],
          ],
          chops: [{ open: 10, steps: [3, 7, 13] }, { open: 2, steps: [11, 15] }],
          riffs: [
            [
              { s: 0, semi: 0, len: 1, f: 1 }, { s: 2, semi: 12, len: 0.5, f: 0 }, { s: 3, semi: 0, len: 1, f: 1 }, { s: 5, semi: 0, len: 0.5, f: 8 },
              { s: 6, semi: -2, len: 1, f: 1 }, { s: 9, semi: 0, len: 1, f: 3 }, { s: 11, semi: 13, len: 0.5, f: 4 }, { s: 12, semi: 12, len: 1, f: 2 },
              { s: 14, semi: 3, len: 1, f: 1 },
              { s: 17, semi: 0, len: 1, f: 1 }, { s: 19, semi: 0, len: 0.5, f: 8 }, { s: 20, semi: 7, len: 1, f: 0 }, { s: 22, semi: -5, len: 1, f: 1 },
              { s: 25, semi: 0, len: 1, f: 3 }, { s: 27, semi: 1, len: 1, f: 1 }, { s: 28, semi: 0, len: 0.5, f: 8 }, { s: 30, semi: 12, len: 1, f: 5 },
              { s: 31, semi: 10, len: 0.5, f: 2 },
            ],
            [
              { s: 0, semi: 0, len: 0.5, f: 1 }, { s: 1, semi: 0, len: 0.5, f: 8 }, { s: 3, semi: 12, len: 1, f: 1 }, { s: 6, semi: 0, len: 1, f: 1 },
              { s: 7, semi: 1, len: 1, f: 2 }, { s: 10, semi: -2, len: 1, f: 1 }, { s: 11, semi: 0, len: 0.5, f: 8 }, { s: 13, semi: 0, len: 1, f: 3 },
              { s: 15, semi: 12, len: 0.5, f: 4 },
              { s: 16, semi: 3, len: 1, f: 1 }, { s: 18, semi: 0, len: 0.5, f: 8 }, { s: 19, semi: 0, len: 1, f: 1 }, { s: 22, semi: 12, len: 1, f: 1 },
              { s: 23, semi: 13, len: 0.5, f: 6 }, { s: 25, semi: 0, len: 1, f: 1 }, { s: 28, semi: -5, len: 1, f: 3 }, { s: 29, semi: -2, len: 0.5, f: 2 },
              { s: 30, semi: 0, len: 1, f: 0 },
            ],
            [
              { s: 0, semi: 0, len: 2, f: 1 }, { s: 3, semi: 0, len: 0.5, f: 8 }, { s: 4, semi: 12, len: 0.5, f: 1 }, { s: 6, semi: 10, len: 1, f: 2 },
              { s: 9, semi: 0, len: 1, f: 1 }, { s: 10, semi: 0, len: 0.5, f: 8 }, { s: 12, semi: 7, len: 1, f: 1 }, { s: 14, semi: 1, len: 1, f: 3 },
              { s: 17, semi: 0, len: 1, f: 1 }, { s: 20, semi: 0, len: 0.5, f: 8 }, { s: 21, semi: 12, len: 1, f: 1 }, { s: 23, semi: 0, len: 1, f: 0 },
              { s: 26, semi: 3, len: 1, f: 1 }, { s: 27, semi: 1, len: 1, f: 2 }, { s: 29, semi: 0, len: 1, f: 1 }, { s: 31, semi: -2, len: 0.5, f: 4 },
            ],
          ],
          seq: { notes: [0, 3, null, 1, null], rate: 2, octave: -12, follow: false, gate: 0.6, level: 0.45, accent: 0.3, evolve: 8 },
          // "FAULT LINE", "PLATE SHIFT", "SEIS-MIC".
          words: [
            { s: 2, syl: [[600, 1000, "s"], [700, 1200, "t"]] },
            { s: 2, syl: [[500, 1800, "p"], [400, 2000, "s"]] },
            { s: 4, syl: [[700, 1200, "s"], [400, 2000, "k"]] },
          ],
          jitter: { hat: 5, ghost: 7 },
          kit: {
            kick: { start: 170, end: 48, sweep: 0.03, decay: 0.34, click: 0.3, clickHp: 3000, drive: 1.7, body: 1.1, punch: { freq: 165, decay: 0.035, level: 0.5 } },
            snare: [
              { tone: "triangle", freq: 232, to: 188, sweep: 0.025, decay: 0.09, level: 0.55 },
              { tone: "sine", freq: 400, to: 330, sweep: 0.02, decay: 0.04, level: 0.18 },
              { noise: "bandpass", freq: 1800, q: 0.8, decay: 0.15, level: 0.4 },
              { noise: "highpass", freq: 3200, q: 0.8, decay: 0.1, level: 0.3 },
              { clap: 0.3, at: 0.005 },
            ],
            ghost: [
              { noise: "bandpass", freq: 2400, q: 1.3, decay: 0.035, level: 0.42 },
              { tone: "triangle", freq: 250, to: 205, sweep: 0.015, decay: 0.02, level: 0.14 },
            ],
            hat: { hp: 7600, decay: 0.016, metal: 0.55, q: 1.4 },
            open: { hp: 6000, decay: 0.07, metal: 0.6, q: 1.2, level: 0.36 },
            accents: [0.34, 0.22, 0.5, 0.28],
          },
          // Fat and stabby: a pulse and two detuned saws, the filter floor at 300 Hz with a snappy envelope, the body's
          // parallel drive (the grit you hear on a phone), drift, a triangle sub for a rounder low end.
          bassTone: {
            osc: [{ type: "pulse25", detune: -6, level: 0.36 }, { type: "sawtooth", detune: 8, level: 0.38 }, { type: "sawtooth", detune: -14, level: 0.28 }],
            cutoff: 330, color: 240, q: [3, 4.2], open: [3.4, 5.5], decay: [0.06, 0.1], drive: 2.6, level: [0.15, 0.18], sub: [1.5, 1.7], glide: 0.035,
            body: { level: 0.8, drive: 3.2, lp: 900, hp: 90 }, drift: 4, subWave: "triangle",
          },
          pad: { osc: [{ type: "sawtooth", detune: -9, level: 0.4 }, { type: "sawtooth", detune: 8, level: 0.4 }], cutoff: 650, q: 0.9, attack: 0.6, release: 0.6, level: 0.06 },
          voice: { pitch: 104, bits: 4, hp: 300, lp: 3200, level: 0.09, every: 8 },
          ornament: { vowels: [[600, 1000], [400, 2000]], wave: "square", steps: 3, octave: -12, syllable: 1, ring: 0, lowpass: 1800, echo: null, level: 0.06, slots: [3, 11] },
          fx: {
            echo: { steps: 2, taps: 2, fb: 0.3, lp: 2200, hp: 500 },
            echoSend: { lead: 0.35, perc: 0.08 },
            space: { size: 0.8, fb: 0.45, lp: 3200 },
            spaceSend: { lead: 0.12, snare: 0.05, harm: 0.1 },
            hall: { decay: 1.7, predelay: 12, lp: 6500, hp: 320, level: 1 },
            hallSend: { lead: 0.35, harm: 0.4, snare: 0.2, perc: 0.2 },
            ensemble: { bass: { mix: 0.28, hp: 280, rate: 0.5 }, harm: { mix: 0.5, rate: 0.6 }, lead: { mix: 0.45, rate: 0.7, depth: 2 } },
            duck: { harm: 0.6 },
            drumLp: 13000,
            drive: 1.2,
            master: { lp: 12000 },
          },
          mix: { kick: 1, bass: 2, hat: -3, lead: -2 },
        },
      },
      // Hypnotic minimal on Alien Rave: a tonic pedal under every bar (i, i with the b2, i with the tritone, the bvii
      // triad over the root). The bass is the whole song: a sparse 12- or 14-step line (it comes round on another 16th
      // every bar) or a 3-3-4 figure, into a long dotted-8th dub echo that darkens tap by tap, so each note rolls on in
      // the rests. Dry, tight drums with a hard short kick (the kick on the 2-and and the 4-and), a 7-step metal tick
      // against the bar, a single dark sonar ping a bar or two into the same echo, a slow "oo" call every four bars.
      // No drone, no arp: the opposite of Hypnagogue's held chords and phase arp.
      {
        id: "hamster-e2-longwave",
        name: "Long Wave",
        base: "alienrave",
        bpm: [126, 131],
        swing: 0.5,
        microScale: 0.02,
        trim: 0.706,
        riser: 0,
        data: {
          chords: [
            { bass: 0, tones: [0, 7, 12] },
            { bass: 0, tones: [1, 7, 13] },
            { bass: 0, tones: [0, 6, 12] },
            { bass: 0, tones: [-2, 3, 10] },
          ],
          progressions: [[0, 0, 0, 1], [0, 0, 2, 0], [0, 1, 0, 3]],
          kicks: {
            half: [[0, 11, 16]],
            lo: [[0, 11, 16, 27]],
            mid: [[0, 3, 11, 16, 27], [0, 11, 16, 19, 27]],
            hi: [[0, 3, 11, 16, 19, 27, 30], [0, 6, 11, 16, 22, 27]],
          },
          opens: [[14], [6]],
          lines: [
            [[0, 1], null, null, [0, 0], null, null, [12, 2], [10, 1], null, [0, 0], null, null],
            [[0, 1], null, null, [7, 0], null, [0, 1], null, null, [1, 2], [0, 0], null, null, [12, 4], null],
            [[0, 1], null, null, [0, 0], null, null, [0, 1], null, null, null, [13, 2], [12, 0], null, null, [7, 4], null],
          ],
          stabs: [
            [{ s: 14, len: 1, core: true }],
            [{ s: 6, len: 1, core: true }, { s: 22, len: 0.5, core: false }],
          ],
          calls: [{ s: 0, len: 12, vowels: [[300, 870], [330, 650]] }, { s: 8, len: 8, vowels: [[330, 650], [450, 800]] }],
          metal: { steps: [1, 0, 0, 0.5, 0, 0, 0.7], freq: 1250, ratio: 1.41, index: 2, decay: 0.035, level: 0.06, pan: 0.6 },
          kit: {
            kick: { start: 160, end: 44, sweep: 0.032, decay: 0.42, click: 0.3, clickHp: 2800, drive: 1.6, body: 1.12, punch: { freq: 150, decay: 0.035, level: 0.4 } },
            snare: [
              { tone: "triangle", freq: 205, to: 168, sweep: 0.03, decay: 0.09, level: 0.55 },
              { noise: "bandpass", freq: 1300, q: 1, decay: 0.11, level: 0.45 },
              { noise: "highpass", freq: 3800, q: 0.7, decay: 0.07, level: 0.2 },
              { clap: 0.2, at: 0.004 },
            ],
            hat: { hp: 8600, decay: 0.012, metal: 0.5, q: 1.4 },
            open: { hp: 6400, decay: 0.07, metal: 0.5, q: 1, level: 0.28 },
            accents: [0.26, 0.14, 0.4, 0.16],
          },
          // Deep and round: two detuned saws and a square, the floor at 240 Hz, a soft woody FM, the body's drive, a
          // long legato sub: the bass that rolls into the dub echo now has a body to echo.
          bassTone: {
            osc: [{ type: "sawtooth", detune: -10, level: 0.4 }, { type: "sawtooth", detune: 8, level: 0.38 }, { type: "square", detune: 0, level: 0.28 }],
            cutoff: 290, color: 200, q: [2.6, 3.6], open: [2.6, 4], decay: [0.14, 0.22], drive: 2, level: [0.15, 0.18], sub: [1.85, 2], glide: 0.12, fm: [0.25, 0.5], ratio: 1,
            body: { level: 0.85, drive: 2.6, lp: 700, hp: 90 }, drift: 5,
          },
          hoover: { cutoff: 520, color: 300, q: 1, hp: 240, bend: 0, detune: [-9, 0, 9], level: 0.2 },
          vox: { ring: 0.5, level: 0.3 },
          laser: { level: 0 },
          arp: { level: 0 },
          ornament: { vowels: [[300, 870], [330, 650]], wave: "triangle", steps: 6, octave: -12, syllable: 3, ring: 0, lowpass: 1500, echo: { steps: 3, feedback: 0.5 }, level: 0.05 },
          fx: {
            echo: { steps: 3, taps: 7, fb: 0.62, lp: 1100, hp: 220 },
            echoSend: { bass: 0.3, harm: 0.4, perc: 0.15 },
            space: { size: 1.2, fb: 0.5, lp: 2600 },
            spaceSend: { harm: 0.12, snare: 0.03 },
            hall: { decay: 2.8, predelay: 24, lp: 5000, hp: 320, level: 1 },
            hallSend: { harm: 0.45, lead: 0.35, snare: 0.14, perc: 0.25 },
            ensemble: { bass: { mix: 0.3, hp: 260, rate: 0.3 }, harm: { mix: 0.55, rate: 0.4, depth: 3 }, lead: { mix: 0.4 } },
            duck: { bass: 0.7, harm: 0.65 },
            drumLp: 12500,
            drive: 1.15,
            master: { lp: 11000 },
          },
          mix: { kick: 1, bass: 2, hat: -4, perc: -4, fx: -3 },
        },
      },
      // Fast, sharp machine funk on Alien Rave. A short hard kick on funk figures (the 2-and-a, the 4-and), a dry
      // crack of a snare, clipped hats locking into 16ths with a short "chick" open. The bass is a hollow FM funk line
      // (ratio 1, a narrow pulse): root, octave pops, the b7 and the b2 as push notes, rests on the beat. Offbeat
      // chord chicks (short, unbent, low cutoff) instead of hoovers; a talkbox line on dotted 8ths (7 steps on the
      // tonic, b3 and b2, phasing) and vocoder call-outs: the robot call every four bars and a crushed word every
      // eight. The chicks voice i m7, i dim, the bII and bvii triads over the tonic, and iv; one bar each.
      {
        id: "hamster-e2-servo",
        name: "Servo Funk",
        base: "alienrave",
        bpm: [134, 139],
        swing: 0.54,
        microScale: 0.03,
        trim: 0.624,
        riser: 0,
        leads: ["he2-talkbox"],
        data: {
          chords: [
            { bass: 0, tones: [0, 3, 10] },
            { bass: 0, tones: [0, 3, 6] },
            { bass: 0, tones: [1, 5, 8] },
            { bass: 0, tones: [-2, 1, 5] },
            { bass: 5, tones: [5, 8, 12] },
          ],
          progressions: [[0, 0, 2, 0], [0, 3, 0, 2], [1, 0, 4, 2], [0, 0, 3, 2]],
          kicks: {
            half: [[0, 11, 16, 27]],
            lo: [[0, 6, 11, 16, 22, 27]],
            mid: [[0, 3, 6, 11, 16, 19, 22, 27], [0, 6, 9, 14, 16, 22, 25, 30]],
            hi: [[0, 3, 6, 11, 14, 16, 19, 22, 27, 30], [0, 2, 6, 11, 14, 16, 18, 22, 27, 30]],
          },
          opens: [[2, 10], [7, 15], [2, 14]],
          lines: [
            [[0, 1], null, [12, 0], [0, 0], null, [0, 1], [12, 2], [10, 0], [0, 1], null, [13, 4], [12, 0], null, [7, 1], [8, 2], [0, 0]],
            [[0, 1], [0, 0], null, [12, 1], null, [0, 0], [0, 1], null, [10, 2], [12, 0], null, [0, 1], [1, 4], null, [12, 1], [0, 0]],
            [[0, 1], null, [0, 0], [12, 1], [0, 0], null, [3, 2], [5, 0], [0, 1], null, [12, 0], [0, 4], [13, 1], [12, 0], null, [7, 0]],
          ],
          stabs: [
            [{ s: 2, len: 0.5, core: true }, { s: 7, len: 0.5, core: false }, { s: 10, len: 0.5, core: true }, { s: 18, len: 0.5, core: true }, { s: 23, len: 0.5, core: false }, { s: 26, len: 1, core: true }],
            [{ s: 3, len: 0.5, core: true }, { s: 6, len: 0.5, core: true }, { s: 14, len: 0.5, core: false }, { s: 19, len: 0.5, core: true }, { s: 22, len: 0.5, core: false }, { s: 30, len: 0.5, core: true }],
          ],
          calls: [
            { s: 2, len: 6, vowels: [[700, 1200], [400, 2200], [300, 870]] },
            { s: 10, len: 4, vowels: [[450, 800], [650, 1100]] },
            { s: 6, len: 5, vowels: [[330, 650], [700, 1200], [400, 2200]] },
          ],
          // "SER-VO FUNK", "MA-CHINE SOUL", "RE-BOOT".
          words: [
            { s: 4, syl: [[500, 1700, "s"], [450, 800, null], [600, 1000, "s"]] },
            { s: 4, syl: [[650, 1100, "p"], [300, 2300, "s"], [450, 800, "s"]] },
            { s: 6, syl: [[400, 2000, null], [330, 870, "p"]] },
          ],
          seq: { notes: [0, null, 3, 0, null, 1, null], rate: 3, octave: -12, gate: 1.2, level: 0.55, accent: 0.3 },
          kit: {
            kick: { start: 180, end: 50, sweep: 0.024, decay: 0.3, click: 0.45, clickHp: 3400, drive: 2, body: 1.05, punch: { freq: 185, decay: 0.03, level: 0.5 } },
            snare: [
              { tone: "triangle", freq: 240, to: 196, sweep: 0.02, decay: 0.07, level: 0.5 },
              { noise: "bandpass", freq: 2000, q: 1, decay: 0.11, level: 0.45 },
              { noise: "highpass", freq: 4500, q: 0.7, decay: 0.06, level: 0.2 },
              { clap: 0.4, at: 0.002 },
            ],
            hat: { hp: 9800, decay: 0.008, metal: 0.4, q: 1.6 },
            open: { hp: 7800, decay: 0.04, metal: 0.4, q: 1.3, level: 0.26 },
            accents: [0.3, 0.22, 0.48, 0.3],
          },
          // Thick funk: a pulse and two saws, the floor at 320 Hz with a quick pluck, a hollow FM, the body's drive and a
          // triangle sub, drift: rubbery and heard on any speaker.
          bassTone: {
            osc: [{ type: "pulse25", detune: -5, level: 0.4 }, { type: "sawtooth", detune: 7, level: 0.34 }, { type: "sawtooth", detune: -12, level: 0.24 }],
            cutoff: 340, color: 280, q: [3, 4.2], open: [3, 4.8], decay: [0.06, 0.09], drive: 2.3, level: [0.145, 0.175], sub: [1.8, 1.95], glide: 0.025, fm: [0.35, 0.6], ratio: 1,
            body: { level: 0.8, drive: 3, lp: 950, hp: 90 }, drift: 4, subWave: "triangle",
          },
          hoover: { cutoff: 700, color: 500, q: 1.2, hp: 240, bend: 0, detune: [-12, 0, 11], level: 0.2 },
          vox: { ring: 1, level: 0.5 },
          laser: { level: 0 },
          arp: { level: 0 },
          ornament: { vowels: [[700, 1200], [400, 2200]], wave: "square", steps: 4, octave: -12, syllable: 1, ring: 1, lowpass: 2000, echo: null, level: 0.06 },
          fx: {
            echo: { steps: 3, taps: 2, fb: 0.3, lp: 2600, hp: 500 },
            echoSend: { lead: 0.3, harm: 0.15, perc: 0.1 },
            space: { size: 0.5, fb: 0.35, lp: 4200 },
            spaceSend: { snare: 0.04, lead: 0.1, harm: 0.06 },
            hall: { decay: 1.3, predelay: 10, lp: 7000, hp: 350, level: 1 },
            hallSend: { snare: 0.2, lead: 0.3, harm: 0.35, perc: 0.15 },
            ensemble: { bass: { mix: 0.25, hp: 300, rate: 0.6 }, harm: { mix: 0.5, rate: 0.7 }, lead: { mix: 0.4, rate: 0.8, depth: 2 } },
            duck: { bass: 0.7, harm: 0.65 },
            drumLp: 14000,
            drive: 1.2,
            master: { lp: 12500 },
          },
          mix: { kick: 1, bass: 2, hat: -3, lead: -2, perc: -4, fx: -3 },
        },
      },
    ],
  },
  patches: {
    // A low foghorn: two saws and a triangle an octave down through a closed lowpass, a slow swell, no vibrato.
    "he2-foghorn": {
      name: "Foghorn",
      osc: [
        { type: "sawtooth", detune: -11, oct: 0, level: 0.45 },
        { type: "sawtooth", detune: 9, oct: 0, level: 0.45 },
        { type: "sawtooth", detune: 2, oct: -1, level: 0.35 },
        { type: "triangle", detune: 0, oct: -1, level: 0.4 },
      ],
      filter: { type: "lowpass", cutoff: 700, env: 500, decay: 0.45, q: 1.1 },
      amp: { a: 0.05, d: 0.5, s: 0.65, r: 0.6 },
      vib: { rate: 4.6, depth: 5, delay: 0.35 },
      drive: 1.6,
      gain: 0.5,
    },
    // A cold machine pluck: a square and a triangle an octave down, a short filter blip, no sustain.
    "he2-pluck": {
      name: "Cold Pluck",
      osc: [
        { type: "square", detune: -7, oct: 0, level: 0.42 },
        { type: "sawtooth", detune: 8, oct: 0, level: 0.4 },
        { type: "triangle", detune: 0, oct: -1, level: 0.45 },
      ],
      filter: { type: "lowpass", cutoff: 620, env: 1300, decay: 0.09, q: 1.6 },
      amp: { a: 0.002, d: 0.16, s: 0.08, r: 0.14 },
      drive: 1.4,
      gain: 0.55,
    },
    // A talkbox: saw and a narrow pulse through two formants ("aw"), short, a little sustain.
    "he2-talkbox": {
      name: "Talkbox",
      osc: [
        { type: "sawtooth", detune: -9, oct: 0, level: 0.55 },
        { type: "sawtooth", detune: 8, oct: 0, level: 0.5 },
        { type: "pulse25", detune: 0, oct: 0, level: 0.4 },
        { type: "sawtooth", detune: 0, oct: -1, level: 0.3 },
      ],
      filter: { type: "lowpass", cutoff: 1500, env: 500, decay: 0.12, q: 0.8 },
      formants: [600, 1000],
      amp: { a: 0.005, d: 0.14, s: 0.4, r: 0.14 },
      drive: 1.5,
      gain: 0.55,
    },
  },
} satisfies StationPack;
