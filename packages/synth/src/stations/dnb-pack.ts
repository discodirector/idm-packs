import type { StationPack } from "../pack.ts";

// Drum & Bass pack (on no station yet: the main $IDM station, the hamster or the Style Lab, undecided). Five drum &
// bass styles on the liquid renderers, each with one idea, written to the owner's DnB brief after a code-made DnB
// was turned down as "spitting drums at the listener, awful melodies, the bass out of key". Musicality first:
//   Golden Hour      bright liquid (soulful): Fm9 - Dbmaj7 - Abmaj7 - Ebadd9 (i VI III VII) two bars a chord on a
//                    soft electric piano over sine strings, a four-note piano answer in bars 5-8 of every eight.
//   Old Photographs  nostalgic liquid (soulful): Dbmaj7 - Cm7 - Fm9 - Fm9 on keys and strings, a breathy "ah"
//                    formant voice singing three-note phrases down to the tonic.
//   Tunnel Roller    roller / minimal (classic): one chord (Fm7), a long sub on a four-bar question and answer (two
//                    bars F, a bar on Bb, back), a light even reese, dense hats and shaker, one stab into a dotted echo.
//   Dub Jungle       jungle (soulful): a chopped, crushed synth break up front (still under the snare), a clean sine sub
//                    of long notes gliding root - fifth, dub chord stabs into the echo; Gm7 - Gm7 - Cm7 - F.
//   Cold Steel       dark techstep leaning neuro (soulful): E Phrygian, Em - F - Em - Dm, a dry hard two-step, a darker
//                    reese a fixed 0.8 Hz wide, a single muted stab every two bars; the form's half-time intro.
// Every key puts the sub's tonic at 41..52 Hz (style `keys`): F (43.7), G (49.0), E (41.2).
// The strings sit in octaves 3-4 (dnb.stringsOct -1): an octave higher they were held sines at 700-830 Hz.
// The brief, in the engine's opt-in fields (styledata.ts LiquidDnbSpec, SubSpec.sat/glide, LiquidReeseSpec hp/beat/lp2,
// LiquidKit hatSwing/ghost, fills roll): the kick on 1 and 3& (step 10), the snare on 5 and 13, both strictly on the
// grid (swing 0.5, microScale 0) while the shaker alone swings (hatSwing); ghosts far under the snare in their own
// highpassed voice; variations only on bars 4 and 8, a 16th-into-32nd snare roll only at the end of 8 bars; no heat
// rolls (dnb). The bass: a mono sine sub under 100 Hz (a gentle 2nd harmonic into a 120 Hz lowpass for laptops) and a
// highpassed mid layer on the same notes, the kick ducking it -8 dB for 120 ms, a 16th's rest before each backbeat
// (gap), only roots, fifths, octaves and the IV of the key. The harmony: open voicings in octaves 3-4 (no third at the
// bottom, a fifth between the two lowest tones), a chord change on beat 1 every two bars, the bus highpassed at 220 Hz
// and ducked by the kick and the snare, quieter than the bass. The form: nothing under ~60 Hz in the breakdown
// (breakSub 0), a half bar of silence but the tails before the drop (dropout), the next break / walk / motif every
// eight bars (rotate). The owner's rules: no noise risers (riser 0) or crash wash (crash 0), no saw pads, a smooth
// top (hats highpassed under 7.5 kHz, drum lowpass, master lowpass 11-12 kHz), no echo or room on the drums, no birds.
export default {
  key: "dnb-pack",
  name: "Drum & Bass Pack",
  genres: ["liquid"],
  styles: {
    liquid: [
      // Bright liquid (High Contrast / Hybrid Minds school). Fm9 - Dbmaj7 - Abmaj7 - Ebadd9, two bars a chord. The
      // piano comps on the downbeats and the "and" of 3; sine strings swell in the same octaves (stringsOct -1); in bars 5-8 of every eight
      // the piano answers: C - Eb - C - G over Ab, G - F - Eb - Bb over Eb (back to F). The sub runs root, fifth,
      // octave on a two-bar roll and rests a 16th before every snare.
      {
        id: "dnb-golden",
        name: "Golden Hour",
        base: "soulful",
        bpm: [172, 175],
        swing: 0.5,
        microScale: 0,
        trim: 1,
        riser: 0,
        heat: 0.3,
        keys: [5],
        breakdown: { kick: 0, snare: 0, hat: 0.3, bass: 0.6, pad: 0.85, lead: 0.85, filter: 0.8 },
        intro: { kick: 0.85, snare: 0.6, hat: 0.6, bass: 1, filter: 0.85 },
        leads: ["dnbp-ep"],
        data: {
          progressions: [
            [{ pad: [14, 0, 7, 10, 15], root: 0 }, { pad: [-4, 3, 7, 12], root: -4 }, { pad: [19, 3, 10, 14], root: 3 }, { pad: [-2, 5, 12, 14], root: -2 }],
          ],
          walks: [
            [
              { s: 0, len: 4, oct: 0, core: true }, { s: 6, len: 3, oct: 0, core: true }, { s: 10, len: 2, oct: 0, core: true },
              { s: 14, len: 2, oct: 0, semi: 7, core: true }, { s: 16, len: 4, oct: 0, core: true }, { s: 22, len: 2, oct: 1, core: true },
              { s: 26, len: 2, oct: 0, core: true }, { s: 30, len: 2, oct: 0, semi: 7, core: true },
            ],
            [
              { s: 0, len: 4, oct: 0, core: true }, { s: 7, len: 3, oct: 0, core: true }, { s: 10, len: 2, oct: 0, semi: 7, core: true },
              { s: 14, len: 2, oct: 0, core: true }, { s: 16, len: 4, oct: 0, core: true }, { s: 22, len: 4, oct: 0, semi: 7, core: true },
              { s: 26, len: 2, oct: 0, core: true }, { s: 30, len: 2, oct: 1, core: true },
            ],
          ],
          comps: [
            [{ s: 0, len: 7, core: true }, { s: 10, len: 3, core: true }, { s: 16, len: 6, core: true }, { s: 26, len: 4, core: true }],
            [{ s: 0, len: 9, core: true }, { s: 10, len: 2, core: true }, { s: 16, len: 4, core: true }, { s: 22, len: 2, core: true }, { s: 26, len: 4, core: true }],
          ],
          sub: 1,
          bass: { wave: "sine", attack: 0.004, hold: 0.95, drive: 0, octave: 0.12, sat: 0.45, satLp: 120 },
          reese: { level: 0.3, beat: 0.6, detune: 0, drive: 1.2, cutoff: 320, q: 0.7, depth: 0, rate: 0.25, hp: 130, lp2: 4500 },
          strings: {
            osc: [{ type: "sine", detune: -6, level: 0.5 }, { type: "triangle", detune: 6, level: 0.3 }],
            cutoff: 1300, q: 0.6, attack: 5, release: 2.2, level: 0.12, vib: 3,
          },
          kit: {
            kick: { start: 165, end: 48, sweep: 0.035, decay: 0.24, click: 0.32, clickHp: 2400, body: 1.15, drive: 1.15 },
            kickLevel: 1.15,
            snare: [
              { tone: "triangle", freq: 212, to: 180, sweep: 0.035, decay: 0.1, level: 0.5 },
              { noise: "bandpass", freq: 3200, q: 1.1, decay: 0.02, level: 0.32 },
              { noise: "bandpass", freq: 1850, q: 0.65, decay: 0.18, level: 0.85, tail: true },
            ],
            snareLevel: 1.4,
            ghostLevel: 0.6,
            ghost: [
              { noise: "bandpass", freq: 2100, q: 0.8, decay: 0.05, level: 0.8 },
              { noise: "highpass", freq: 420, q: 0.7, decay: 0.025, level: 0.3 },
            ],
            hat: { hp: 7000, decay: 0.028, metal: 0, q: 1, pan: 0.22, level: 0.34 },
            shaker: { hp: 7400, decay: 0.02, metal: 0, pan: -0.25, level: 0.22 },
            open: { hp: 6400, decay: 0.07, metal: 0.3, q: 1.1, pan: 0.3, level: 0.16 },
            crash: 0,
            hatSwing: 0.04,
            breaks: [
              { kick: "9.........8.....9.........8.....", snare: "....9.......9.......9.......9...", ghost: ".......3.2....3........3.2....3.", hat: "53535353535353535353535353535353", open: "" },
              { kick: "9.........8.....9.........8...4.", snare: "....9.......9.......9.......9...", ghost: "..2....3.....2.3...2...3.....2..", hat: "53535353535353535353535353535353", open: "" },
            ],
          },
          fills: [
            { kick: "..8.....", snare: "..4.9.56", roll: "......45" },
            { kick: "..8.....", snare: "4.5.9.67", roll: ".......5" },
          ],
          ornament: { voices: ["amen"], smart: ["amen"] },
          dnb: {
            gap: 1, rotate: true, dropout: true, breakSub: 0, snareDuck: 0.8, harmHp: 220, leadHp: 200, stringsOct: -1,
            motif: {
              patch: {
                name: "Glass Piano",
                osc: [
                  { type: "sine", detune: 0, oct: 0, level: 0.85 },
                  { type: "sine", detune: 0, oct: 1, level: 0.12 },
                ],
                fm: { ratio: 1, index: 1.2, decay: 0.18, floor: 0.06 },
                filter: { type: "lowpass", cutoff: 2600, env: 900, decay: 0.25, q: 0.5 },
                amp: { a: 0.006, d: 1.1, s: 0.35, r: 0.5 },
                gain: 0.8,
              },
              level: 0.55,
              figures: [
                [
                  { s: 64, len: 6, tone: 3, oct: 0 }, { s: 72, len: 2, tone: 1, oct: 1 }, { s: 74, len: 4, tone: 3, oct: 0 }, { s: 80, len: 10, tone: 2, oct: 0 },
                  { s: 96, len: 6, tone: 3, oct: 0 }, { s: 104, len: 2, tone: 2, oct: 0 }, { s: 106, len: 4, tone: 0, oct: 1 }, { s: 112, len: 10, tone: 1, oct: 0 },
                ],
                [
                  { s: 64, len: 4, tone: 2, oct: 0 }, { s: 68, len: 4, tone: 3, oct: 0 }, { s: 72, len: 8, tone: 1, oct: 1 },
                  { s: 96, len: 4, tone: 1, oct: 1 }, { s: 100, len: 4, tone: 3, oct: 0 }, { s: 104, len: 12, tone: 2, oct: 0 },
                ],
              ],
            },
          },
          fx: {
            echo: { steps: 3, taps: 3, fb: 0.38, lp: 2200, hp: 500 },
            echoSend: { lead: 0.2, snare: 0, perc: 0 },
            space: { size: 0.9, fb: 0.5, lp: 3000 },
            spaceSend: { harm: 0.25, lead: 0.22, snare: 0.03, hat: 0, perc: 0, fx: 0 },
            drumLp: 9000,
            drive: 1.25,
            duck: { bass: 0.4, harm: 0.75 },
            duckTime: { bass: 0.12, harm: 0.2 },
            master: { lp: 11000 },
          },
          mix: { harm: -2.5, lead: -1.5 },
        },
      },
      // Nostalgic liquid (Calibre / Lenzman, late-night). Dbmaj7 - Cm7 - Fm9 - Fm9: the question on VI and v, the
      // answer at home for four bars. Warm keys comp gently, sine-triangle strings carry it, and a breathy "ah" voice
      // sings three-note phrases in its middle register: C - Ab - F, G - Bb - G, Ab - G - F (always to the tonic).
      {
        id: "dnb-photos",
        name: "Old Photographs",
        base: "soulful",
        bpm: [170, 173],
        swing: 0.5,
        microScale: 0,
        trim: 1.05,
        riser: 0,
        heat: 0.3,
        keys: [5],
        breakdown: { kick: 0, snare: 0, hat: 0.3, bass: 0.6, pad: 0.85, lead: 0.85, filter: 0.8 },
        intro: { kick: 0.85, snare: 0.6, hat: 0.6, bass: 1, filter: 0.85 },
        leads: ["dnbp-keys"],
        data: {
          progressions: [
            [{ pad: [-4, 3, 7, 12], root: -4 }, { pad: [-5, 2, 5, 10], root: 7 }, { pad: [14, 0, 7, 10, 15], root: 0 }, { pad: [14, 0, 7, 10, 15], root: 0 }],
          ],
          walks: [
            [
              { s: 0, len: 4, oct: 0, core: true }, { s: 6, len: 4, oct: 0, core: true }, { s: 10, len: 2, oct: 0, core: true },
              { s: 14, len: 2, oct: 0, semi: 7, core: true }, { s: 16, len: 4, oct: 0, core: true }, { s: 22, len: 4, oct: 0, core: true },
              { s: 26, len: 2, oct: 0, core: true }, { s: 30, len: 2, oct: 1, core: true },
            ],
            [
              { s: 0, len: 4, oct: 0, core: true }, { s: 6, len: 2, oct: 0, semi: 7, core: true }, { s: 10, len: 4, oct: 0, core: true },
              { s: 16, len: 4, oct: 0, core: true }, { s: 22, len: 2, oct: 1, core: true }, { s: 26, len: 6, oct: 0, core: true },
            ],
          ],
          comps: [
            [{ s: 0, len: 10, core: true }, { s: 14, len: 2, core: true }, { s: 16, len: 8, core: true }, { s: 26, len: 4, core: true }],
            [{ s: 0, len: 8, core: true }, { s: 10, len: 4, core: true }, { s: 16, len: 10, core: true }],
          ],
          sub: 0.8,
          bass: { wave: "sine", attack: 0.004, hold: 0.95, drive: 0, octave: 0.12, sat: 0.45, satLp: 120 },
          reese: { level: 0.28, beat: 0.5, detune: 0, drive: 1.1, cutoff: 380, q: 0.7, depth: 0, rate: 0.25, hp: 130, lp2: 4500 },
          strings: {
            osc: [{ type: "sine", detune: -8, level: 0.5 }, { type: "triangle", detune: 7, level: 0.35 }],
            cutoff: 1100, q: 0.6, attack: 4, release: 2.5, level: 0.15, vib: 4,
          },
          kit: {
            kick: { start: 150, end: 47, sweep: 0.04, decay: 0.26, click: 0.25, clickHp: 2000, body: 1.15, drive: 1.1 },
            kickLevel: 1.12,
            snare: [
              { tone: "triangle", freq: 204, to: 174, sweep: 0.04, decay: 0.11, level: 0.5 },
              { noise: "bandpass", freq: 3000, q: 1.1, decay: 0.02, level: 0.28 },
              { noise: "bandpass", freq: 1700, q: 0.65, decay: 0.2, level: 0.85, tail: true },
            ],
            snareLevel: 1.35,
            ghostLevel: 0.95,
            ghost: [
              { noise: "bandpass", freq: 1900, q: 0.8, decay: 0.055, level: 0.8 },
              { noise: "highpass", freq: 400, q: 0.7, decay: 0.025, level: 0.25 },
            ],
            hat: { hp: 6800, decay: 0.03, metal: 0, q: 1, pan: 0.22, level: 0.42 },
            shaker: { hp: 7200, decay: 0.022, metal: 0, pan: -0.25, level: 0.28 },
            open: { hp: 6200, decay: 0.08, metal: 0.3, q: 1.1, pan: 0.3, level: 0.14 },
            crash: 0,
            hatSwing: 0.05,
            breaks: [
              { kick: "9.........8.....9.........8.....", snare: "....9.......9.......9.......9...", ghost: ".......3.2.....3.......3.2....2.", hat: "52525252525252525252525252525252", open: "" },
              { kick: "9.........8.....9.....4...8.....", snare: "....9.......9.......9.......9...", ghost: "..2....3.......3..2....3.......3", hat: "52525252525252525252525252525252", open: "" },
            ],
          },
          fills: [
            { kick: "..8.....", snare: "..4.9.56", roll: "......45" },
            { kick: "..8.....", snare: "....9.67", roll: "......56" },
          ],
          ornament: { voices: ["amen"], smart: ["amen"] },
          dnb: {
            gap: 1, rotate: true, dropout: true, breakSub: 0, snareDuck: 0.8, harmHp: 220, leadHp: 200, stringsOct: -1,
            motif: {
              patch: {
                name: "Ah Voice",
                osc: [
                  { type: "sawtooth", detune: -4, oct: 0, level: 0.4 },
                  { type: "triangle", detune: 4, oct: 0, level: 0.6 },
                ],
                filter: { type: "lowpass", cutoff: 2000, env: 0, decay: 0.2, q: 0.5 },
                formants: [720, 1150],
                amp: { a: 0.06, d: 0.4, s: 0.75, r: 0.35 },
                vib: { rate: 5, depth: 10, delay: 0.25 },
                gain: 0.9,
              },
              level: 0.5,
              figures: [
                [
                  { s: 8, len: 6, tone: 2, oct: 1 }, { s: 14, len: 2, tone: 1, oct: 1 }, { s: 16, len: 12, tone: 3, oct: 0 },
                  { s: 40, len: 4, tone: 1, oct: 1 }, { s: 44, len: 4, tone: 2, oct: 1 }, { s: 48, len: 12, tone: 1, oct: 1 },
                  { s: 72, len: 4, tone: 4, oct: 0 }, { s: 76, len: 4, tone: 3, oct: 0 }, { s: 80, len: 16, tone: 0, oct: 1 },
                ],
                [
                  { s: 8, len: 4, tone: 3, oct: 0 }, { s: 12, len: 4, tone: 2, oct: 1 }, { s: 16, len: 12, tone: 1, oct: 1 },
                  { s: 40, len: 4, tone: 3, oct: 0 }, { s: 44, len: 4, tone: 1, oct: 1 }, { s: 48, len: 12, tone: 2, oct: 1 },
                  { s: 72, len: 4, tone: 3, oct: 0 }, { s: 76, len: 4, tone: 4, oct: 0 }, { s: 80, len: 16, tone: 0, oct: 1 },
                ],
              ],
            },
          },
          fx: {
            echo: { steps: 3, taps: 3, fb: 0.4, lp: 2000, hp: 500 },
            echoSend: { lead: 0.22, snare: 0, perc: 0 },
            space: { size: 1, fb: 0.55, lp: 2800 },
            spaceSend: { harm: 0.3, lead: 0.28, snare: 0.03, hat: 0, perc: 0, fx: 0 },
            drumLp: 9500,
            drive: 1.22,
            duck: { bass: 0.4, harm: 0.75 },
            duckTime: { bass: 0.12, harm: 0.2 },
            master: { lp: 11500 },
          },
          mix: { harm: -1 },
        },
      },
      // Roller / minimal (Alix Perez / Halogenix school). One chord, Fm7, as a dark sine-triangle pad; the bass is the
      // tune: a four-bar question and answer (two bars on F, a bar on Bb, home with the fifth), a sine sub and an even
      // reese a fixed Hz wide on the same notes. Every 16th of hats with a swung shaker; one muted stab on an offbeat into
      // a dotted echo, a three-note answer in bar 7.
      {
        id: "dnb-roller",
        name: "Tunnel Roller",
        base: "classic",
        bpm: [173, 175],
        swing: 0.5,
        microScale: 0,
        trim: 1.19,
        riser: 0,
        heat: 0.3,
        keys: [5],
        breakdown: { kick: 0, snare: 0, hat: 0.3, bass: 0.6, pad: 0.85, lead: 0.85, filter: 0.8 },
        intro: { kick: 0.85, snare: 0.6, hat: 0.6, bass: 1, filter: 0.85 },
        leads: ["dnbp-stab"],
        data: {
          vamps: [{ a: { pad: [0, 7, 10, 15], root: 0 }, b: { pad: [0, 7, 10, 15], root: 0 } }],
          stabs: [
            [{ s: 6, len: 1, core: true }, { s: 38, len: 1, core: true }],
            [{ s: 11, len: 1, core: true }, { s: 43, len: 1, core: true }],
          ],
          answers: [
            [{ s: 2, len: 2 }, { s: 6, len: 2 }, { s: 10, len: 4 }],
            [{ s: 3, len: 1 }, { s: 6, len: 2 }, { s: 8, len: 6 }],
          ],
          contours: [[2, 1, 0, 1], [0, 1, 2, 1]],
          walks: [
            [
              { s: 0, len: 4, oct: 0, core: true }, { s: 6, len: 3, oct: 0, core: true }, { s: 10, len: 2, oct: 0, core: true },
              { s: 14, len: 2, oct: 0, semi: 7, core: true }, { s: 16, len: 4, oct: 0, core: true }, { s: 22, len: 2, oct: 1, core: true },
              { s: 26, len: 2, oct: 0, core: true }, { s: 30, len: 2, oct: 0, semi: 3, core: true },
              { s: 32, len: 4, oct: 0, semi: 5, core: true }, { s: 38, len: 3, oct: 0, semi: 5, core: true }, { s: 42, len: 2, oct: 0, semi: 5, core: true },
              { s: 46, len: 2, oct: 0, semi: 3, core: true }, { s: 48, len: 4, oct: 0, core: true }, { s: 54, len: 2, oct: 0, semi: 7, core: true },
              { s: 58, len: 2, oct: 0, core: true }, { s: 62, len: 2, oct: 0, semi: 7, core: true },
            ],
            [
              { s: 0, len: 6, oct: 0, core: true }, { s: 7, len: 2, oct: 0, core: true }, { s: 10, len: 4, oct: 0, core: true },
              { s: 16, len: 4, oct: 0, core: true }, { s: 22, len: 2, oct: 0, semi: 7, core: true }, { s: 26, len: 4, oct: 0, core: true },
              { s: 32, len: 6, oct: 0, semi: 5, core: true }, { s: 39, len: 2, oct: 0, semi: 5, core: true }, { s: 42, len: 4, oct: 0, semi: 5, core: true },
              { s: 48, len: 4, oct: 0, core: true }, { s: 54, len: 2, oct: 1, core: true }, { s: 58, len: 4, oct: 0, core: true }, { s: 62, len: 2, oct: 0, semi: 3, core: true },
            ],
          ],
          sub: 0.8,
          bass: { wave: "sine", attack: 0.004, hold: 0.95, drive: 0, octave: 0.1, sat: 0.5, satLp: 120 },
          reese: { level: 0.6, beat: 1, detune: 0, drive: 1.6, cutoff: 320, q: 0.8, depth: 0.15, rate: 0.125, hp: 130, lp2: 4500 },
          pad: {
            osc: [{ type: "sine", detune: -6, level: 0.55 }, { type: "triangle", detune: 5, level: 0.4 }],
            cutoff: 700, q: 0.6, attack: 1.5, release: 2.5, level: 0.05, vib: 3,
          },
          kit: {
            kick: { start: 170, end: 49, sweep: 0.03, decay: 0.23, click: 0.32, clickHp: 2400, body: 1.15, drive: 1.3 },
            kickLevel: 1.15,
            snare: [
              { tone: "triangle", freq: 216, to: 182, sweep: 0.03, decay: 0.09, level: 0.52 },
              { noise: "bandpass", freq: 2600, q: 1.1, decay: 0.025, level: 0.4 },
              { noise: "bandpass", freq: 1600, q: 0.75, decay: 0.15, level: 0.8, tail: true },
            ],
            snareLevel: 1.4,
            ghostLevel: 0.8,
            ghost: [
              { noise: "bandpass", freq: 2200, q: 0.9, decay: 0.04, level: 0.8 },
              { noise: "highpass", freq: 450, q: 0.7, decay: 0.02, level: 0.25 },
            ],
            hat: { hp: 7200, decay: 0.024, metal: 0.15, q: 1, pan: 0.2, level: 0.36 },
            shaker: { hp: 7400, decay: 0.018, metal: 0, pan: -0.3, level: 0.26 },
            open: { hp: 6200, decay: 0.06, metal: 0.3, q: 1.1, pan: 0.3, level: 0.14 },
            crash: 0,
            hatSwing: 0.06,
            breaks: [
              { kick: "9.........8.....9.........8.....", snare: "....9.......9.......9.......9...", ghost: "...........2...........2.....2..", hat: "63536353635363536353635363536353", open: "" },
              { kick: "9.........8.....9.....4...8.....", snare: "....9.......9.......9.......9...", ghost: "..2........2...........2........", hat: "63536353635363536353635363536353", open: "" },
            ],
          },
          fills: [
            { kick: "..8.....", snare: "....9.56", roll: "......45" },
            { kick: "..8.....", snare: "..4.9.67", roll: ".......5" },
          ],
          ornament: { voices: ["amen"], smart: ["amen"] },
          dnb: { gap: 1, walkBars: 4, rotate: true, dropout: true, breakSub: 0, snareDuck: 0.8, harmHp: 220, leadHp: 200 },
          fx: {
            echo: { steps: 3, taps: 4, fb: 0.45, lp: 2000, hp: 500 },
            echoSend: { lead: 0.42, snare: 0, perc: 0 },
            space: { size: 0.8, fb: 0.5, lp: 2600 },
            spaceSend: { harm: 0.25, lead: 0.15, snare: 0.03, hat: 0, perc: 0, fx: 0 },
            drumLp: 9500,
            drive: 1.25,
            duck: { bass: 0.4, harm: 0.75 },
            duckTime: { bass: 0.12, harm: 0.2 },
            master: { lp: 11500 },
          },
        },
      },
      // Jungle (mid-90s school, synthesized). The chopped break leads the drums: a crushed, highpassed ghost roll on
      // most 16ths around a strict two-step kick and backbeat. Under it a clean sine sub of long notes that glide
      // root - fifth; Gm7 - Gm7 - Cm7 - F, two bars a chord, as dub stabs thrown into a dotted echo, a low sine drone.
      {
        id: "dnb-jungle",
        name: "Dub Jungle",
        base: "soulful",
        bpm: [166, 169],
        swing: 0.5,
        microScale: 0,
        trim: 1,
        riser: 0,
        heat: 0.3,
        keys: [7],
        breakdown: { kick: 0, snare: 0, hat: 0, bass: 0.35, pad: 0.4, lead: 0.45, filter: 0.7 },
        intro: { kick: 0.85, snare: 0.6, hat: 0.6, bass: 1, filter: 0.85 },
        leads: ["dnbp-dub"],
        data: {
          progressions: [
            [{ pad: [0, 7, 10, 15], root: 0 }, { pad: [0, 7, 10, 15], root: 0 }, { pad: [-7, 0, 3, 8], root: 5 }, { pad: [-2, 5, 10, 14], root: -2 }],
          ],
          walks: [
            [
              { s: 0, len: 10, oct: 0, core: true }, { s: 10, len: 6, oct: 0, core: true },
              { s: 16, len: 10, oct: 0, core: true }, { s: 26, len: 6, oct: 0, semi: 7, core: true },
            ],
            [
              { s: 0, len: 14, oct: 0, core: true }, { s: 14, len: 2, oct: 0, semi: 7, core: true },
              { s: 16, len: 10, oct: 0, core: true }, { s: 26, len: 6, oct: 0, core: true },
            ],
          ],
          comps: [
            [{ s: 6, len: 1, core: true }, { s: 22, len: 1, core: true }],
            [{ s: 3, len: 1, core: true }, { s: 19, len: 1, core: true }, { s: 27, len: 1, core: true }],
          ],
          sub: 0.62,
          bass: { wave: "sine", attack: 0.005, hold: 0.97, drive: 0, octave: 0.12, sat: 0.4, satLp: 120, glide: 0.07 },
          strings: {
            osc: [{ type: "sine", detune: -10, level: 0.5 }, { type: "sine", detune: 9, level: 0.5 }],
            cutoff: 700, q: 0.6, attack: 5, release: 2.5, level: 0.12, vib: 2,
          },
          kit: {
            kick: { start: 140, end: 46, sweep: 0.045, decay: 0.28, click: 0.25, clickHp: 1800, body: 1.15, drive: 1.2 },
            kickLevel: 1.08,
            snare: [
              { tone: "triangle", freq: 198, to: 168, sweep: 0.04, decay: 0.1, level: 0.5 },
              { crush: 7, filter: "bandpass", freq: 1700, q: 0.9, decay: 0.12, level: 0.5, lp: 6000, tail: true },
              { noise: "bandpass", freq: 1300, q: 0.7, decay: 0.16, level: 0.5, tail: true },
            ],
            snareLevel: 1.35,
            ghostLevel: 0.5,
            ghost: [
              { crush: 6, filter: "highpass", freq: 450, decay: 0.07, level: 0.7, lp: 5500 },
              { noise: "bandpass", freq: 1500, q: 0.8, decay: 0.05, level: 0.4 },
            ],
            hat: { hp: 6600, decay: 0.026, metal: 0.15, q: 1, pan: 0.2, level: 0.32 },
            shaker: { hp: 7200, decay: 0.02, metal: 0, pan: -0.3, level: 0.23 },
            open: { hp: 5800, decay: 0.1, metal: 0.4, q: 1.1, pan: 0.35, level: 0.16 },
            crash: 0,
            hatSwing: 0.03,
            breaks: [
              { kick: "9.........9.....9.........9.....", snare: "....9.......9.......9.......9...", ghost: "..4.3..5.3.4..3..4.3..5..4.3.4.3", hat: "43434343434343434343434343434343", open: ".......5...............5........" },
              { kick: "9.........9.....9.........9...4.", snare: "....9.......9.......9.......9...", ghost: ".3.4..3.5.4..3.4.3..4.35.4..3.4.", hat: "43434343434343434343434343434343", open: "..............5...............5." },
            ],
          },
          fills: [
            { kick: "..8.....", snare: "3.4.9.67", roll: "......56" },
            { kick: "..8.....", snare: "4.5.9576", roll: ".....456" },
          ],
          ornament: { voices: ["amen"], smart: ["amen"] },
          dnb: { gap: 0, rotate: true, dropout: true, breakSub: 0, snareDuck: 0.8, harmHp: 220, leadHp: 200, stringsOct: -1 },
          fx: {
            echo: { steps: 3, taps: 4, fb: 0.5, lp: 1800, hp: 450 },
            echoSend: { lead: 0.45, snare: 0, perc: 0 },
            space: { size: 1, fb: 0.55, lp: 2600 },
            spaceSend: { harm: 0.25, lead: 0.2, snare: 0.03, hat: 0, perc: 0, fx: 0 },
            drumLp: 9500,
            drive: 1.25,
            duck: { bass: 0.42, harm: 0.75 },
            duckTime: { bass: 0.12, harm: 0.2 },
            master: { lp: 11000 },
          },
        },
      },
      // Dark techstep leaning neuro (Ed Rush & Optical / Noisia, softened). E Phrygian: Em - F - Em - Dm, two bars a
      // chord as bare open voicings (root, fifth, a high third), one muted metallic stab every two bars. A dry, hard
      // two-step with a tight crack and no room; a darker reese (the saws 0.8 Hz apart, a slow filter breath once a bar,
      // highpassed and lowpassed) an octave over a clean sub; the form's intro and rebuild run half-time.
      {
        id: "dnb-steel",
        name: "Cold Steel",
        base: "soulful",
        bpm: [174, 176],
        swing: 0.5,
        microScale: 0,
        trim: 1.07,
        riser: 0,
        heat: 0.3,
        keys: [4],
        breakdown: { kick: 0, snare: 0, hat: 0.3, bass: 0.6, pad: 0.85, lead: 0.85, filter: 0.8 },
        intro: { kick: 0.85, snare: 0.6, hat: 0.6, bass: 1, filter: 0.85 },
        leads: ["dnbp-steel"],
        data: {
          progressions: [
            [{ pad: [0, 7, 15], root: 0 }, { pad: [1, 8, 17], root: 1 }, { pad: [0, 7, 15], root: 0 }, { pad: [-2, 5, 10, 13], root: -2 }],
          ],
          walks: [
            [
              { s: 0, len: 4, oct: 0, core: true }, { s: 6, len: 2, oct: 0, core: true }, { s: 10, len: 2, oct: 0, core: true },
              { s: 13, len: 1, oct: 1, core: true }, { s: 16, len: 4, oct: 0, core: true }, { s: 22, len: 4, oct: 0, core: true },
              { s: 26, len: 2, oct: 0, core: true }, { s: 30, len: 2, oct: 0, semi: 7, core: true },
            ],
            [
              { s: 0, len: 6, oct: 0, core: true }, { s: 7, len: 2, oct: 0, core: true }, { s: 10, len: 2, oct: 0, core: true },
              { s: 14, len: 2, oct: 0, semi: 7, core: true }, { s: 16, len: 4, oct: 0, core: true }, { s: 22, len: 2, oct: 1, core: true },
              { s: 26, len: 4, oct: 0, core: true },
            ],
          ],
          comps: [
            [{ s: 6, len: 1, core: true }],
            [{ s: 22, len: 1, core: true }],
          ],
          sub: 0.78,
          bass: { wave: "sine", attack: 0.004, hold: 0.94, drive: 0, octave: 0, sat: 0.5, satLp: 120 },
          reese: { level: 0.9, beat: 0.8, detune: 0, drive: 2.2, cutoff: 260, q: 0.9, depth: 0.25, rate: 0.25, hp: 120, lp2: 4000 },
          strings: {
            osc: [{ type: "sine", detune: -9, level: 0.5 }, { type: "triangle", detune: 8, level: 0.3 }],
            cutoff: 600, q: 0.6, attack: 4, release: 2, level: 0.1, vib: 2,
          },
          kit: {
            kick: { start: 185, end: 50, sweep: 0.026, decay: 0.22, click: 0.38, clickHp: 2600, body: 1.15, drive: 1.6 },
            kickLevel: 1.18,
            snare: [
              { tone: "triangle", freq: 224, to: 186, sweep: 0.022, decay: 0.08, level: 0.56 },
              { noise: "bandpass", freq: 2400, q: 1.1, decay: 0.03, level: 0.5 },
              { noise: "bandpass", freq: 1500, q: 0.8, decay: 0.12, level: 0.75, tail: true },
            ],
            snareLevel: 1.45,
            ghostLevel: 1,
            ghost: [
              { noise: "bandpass", freq: 2000, q: 0.9, decay: 0.035, level: 1.5 },
              { noise: "highpass", freq: 480, q: 0.7, decay: 0.02, level: 0.25 },
            ],
            hat: { hp: 7000, decay: 0.02, metal: 0.3, q: 1, pan: 0.2, level: 0.34 },
            shaker: { hp: 7400, decay: 0.014, metal: 0, pan: -0.3, level: 0.13 },
            open: { hp: 6000, decay: 0.05, metal: 0.4, q: 1.1, pan: 0.3, level: 0.12 },
            crash: 0,
            hatSwing: 0.02,
            breaks: [
              { kick: "9.........9.....9.........9.....", snare: "....9.......9.......9.......9...", ghost: "...........2...........2........", hat: "..6...6...6...6...6...6...6...6.", open: "" },
              { kick: "9.........9.....9.........9..4..", snare: "....9.......9.......9.......9...", ghost: ".......2...........2.......2....", hat: "..6...6...6...6...6...6...6...6.", open: "" },
            ],
          },
          fills: [
            { kick: "..8.....", snare: "....9.56", roll: "......45" },
            { kick: "..8...6.", snare: "..4.9..6", roll: ".......5" },
          ],
          ornament: { voices: ["amen"], smart: ["amen"] },
          dnb: { gap: 1, rotate: true, dropout: true, breakSub: 0, snareDuck: 0.8, harmHp: 220, leadHp: 200, stringsOct: -1 },
          fx: {
            echo: { steps: 3, taps: 3, fb: 0.4, lp: 1800, hp: 500 },
            echoSend: { lead: 0.35, snare: 0, perc: 0 },
            space: { size: 0.7, fb: 0.45, lp: 2400 },
            spaceSend: { harm: 0.2, lead: 0.15, snare: 0, hat: 0, perc: 0, fx: 0 },
            drumLp: 10000,
            drive: 1.3,
            duck: { bass: 0.4, harm: 0.75 },
            duckTime: { bass: 0.12, harm: 0.2 },
            master: { lp: 11000 },
          },
          mix: { hat: -1, lead: -1 },
        },
      },
    ],
  },
  patches: {
    // Golden Hour's electric piano: a soft tine bark into a clean sine, the octave in tune, a warm lowpass.
    "dnbp-ep": {
      name: "Golden EP",
      osc: [
        { type: "sine", detune: 0, oct: 0, level: 0.9 },
        { type: "sine", detune: 0, oct: 1, level: 0.1 },
        { type: "triangle", detune: -3, oct: 0, level: 0.1 },
      ],
      fm: { ratio: 1, index: 1.5, decay: 0.25, floor: 0.06 },
      filter: { type: "lowpass", cutoff: 2000, env: 1000, decay: 0.3, q: 0.5 },
      amp: { a: 0.004, d: 1.4, s: 0.3, r: 0.5 },
      gain: 0.75,
    },
    // Old Photographs' keys: rounder, slower to bark, a little longer.
    "dnbp-keys": {
      name: "Faded Keys",
      osc: [
        { type: "sine", detune: 0, oct: 0, level: 0.9 },
        { type: "triangle", detune: 3, oct: 0, level: 0.12 },
      ],
      fm: { ratio: 1, index: 1.1, decay: 0.3, floor: 0.05 },
      filter: { type: "lowpass", cutoff: 1700, env: 700, decay: 0.35, q: 0.5 },
      amp: { a: 0.006, d: 1.8, s: 0.35, r: 0.7 },
      gain: 0.72,
    },
    // Tunnel Roller's stab: a muted chord hit, a sine with a short FM knock and a quiet square an octave down.
    "dnbp-stab": {
      name: "Tunnel Stab",
      osc: [
        { type: "sine", detune: 0, oct: 0, level: 0.8 },
        { type: "square", detune: 4, oct: -1, level: 0.16 },
      ],
      fm: { ratio: 2, index: 1.2, decay: 0.06, floor: 0.04 },
      filter: { type: "lowpass", cutoff: 900, env: 800, decay: 0.08, q: 0.8 },
      amp: { a: 0.003, d: 0.2, s: 0, r: 0.14 },
      gain: 0.7,
    },
    // Dub Jungle's stab: a soft saw pair through a warm lowpass, a quick knock and a short tail for the echo.
    "dnbp-dub": {
      name: "Jungle Dub Stab",
      osc: [
        { type: "sawtooth", detune: -6, oct: 0, level: 0.45 },
        { type: "sawtooth", detune: 6, oct: 0, level: 0.45 },
        { type: "sine", detune: 0, oct: 0, level: 0.4 },
      ],
      filter: { type: "lowpass", cutoff: 750, env: 900, decay: 0.12, q: 0.9 },
      amp: { a: 0.004, d: 0.28, s: 0.06, r: 0.2 },
      gain: 0.5,
    },
    // Cold Steel's stab: dark and short, a sine with an FM bark and a low square, closed down.
    "dnbp-steel": {
      name: "Cold Steel Stab",
      osc: [
        { type: "sine", detune: 0, oct: 0, level: 0.8 },
        { type: "square", detune: 5, oct: -1, level: 0.18 },
      ],
      fm: { ratio: 2, index: 1.3, decay: 0.07, floor: 0.05 },
      filter: { type: "lowpass", cutoff: 800, env: 800, decay: 0.09, q: 0.9 },
      amp: { a: 0.003, d: 0.22, s: 0, r: 0.15 },
      gain: 0.7,
    },
  },
} satisfies StationPack;
