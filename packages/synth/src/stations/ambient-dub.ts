import type { StationPack } from "../pack.ts";

// Ambient Dub: Credits Techno's dub, slowed and submerged, after Thurlow Joyce's "Orange Ultra" (B-Line Tape, 2020:
// samples and field recordings along Hastings Street, Vancouver). The dub DNA is Credits' (credits.ts): a resonant saw
// stab (q 2.4..2.8) under a dark lowpass on a low minor voicing (the fifth under the root), played rarely so a narrow,
// long echo (~450..1300 Hz, 12 repeats at 0.74) and a big dark room carry the space; Void's deep sub (150 Hz lowpass,
// a soft 70 ms attack, ducked by the kick) on the root; a dark saw drone an octave under where it fits; the kick's
// rumble room. Slower (112..118), the kick soft and sparse or absent (`kicks`), the sub sliding between its notes and
// warmed by its second harmonic (subTone glide / warmth). In place of the field recording, the city air (`air`): a
// few layers per style (traffic, rain, drops, a hum, wind) silent between events (floor 0, no constant vinyl), and
// only now and then one swell (about once or twice in three minutes) rises over a few bars and falls within a bar,
// each style with its own character. No noise risers (riser 0). Ten styles: the first four (Sodium, Night Bus, Wet
// Pavement, First Light), then six more around the same world (Warehouse Tape, Harbour Fog, Overpass, Last Ferry,
// Tram Lights, Under the Bridge).
export default {
  key: "ambient-dub",
  name: "Ambient Dub",
  genres: ["dubtechno"],
  styles: {
    dubtechno: [
      // Sodium (the orange street light): the reference. A minor-seventh stab with the fifth under it (Void's stab, the
      // flat seventh on top), three bars in eight into a wobbling dotted-quarter echo; on some phrases the fifth rubs
      // up to the b6. A soft round kick on every beat, a melodic sub (the root held, sliding to the flat seventh, the
      // fifth and the octave), a soft shaker on the "a" of the beat, Void's drone low; far triangle tones over it.
      // Air: traffic under 160 Hz most of the time, rain and drops coming and going, one swell in about 24 bars of 60.
      {
        id: "ambient-dub-sodium",
        name: "Sodium",
        base: "ixtlan",
        bpm: [116, 116],
        swing: 0.5,
        microScale: 0.08,
        trim: 1.06,
        riser: 0,
        heat: 0.6,
        data: {
          chords: {
            i: { root: 0, upper: [-5, 0, 3, 10] },
            turn: { root: 0, upper: [-4, 0, 3, 10] },
          },
          progressions: [
            { bars: 8, seq: ["i", "i", "turn", "i"] },
            { bars: 8, seq: ["i", "i", "i", "turn"] },
          ],
          figures: [[6, 14], [3, 11], [10, 14]],
          accents: [0.9, 0.55],
          stabBars: [1, 0, 0.6, 0, 0.85, 0, 0, 0],
          bassline: [[0, 7, 1], [8, 2.5, 0.8, 10], [11, 2.5, 0.75, 7], [14, 1.5, 0.6, 12]],
          hats: [[7, 0.6, 0.03], [15, 0.4, 0.03], [23, 0.6, 0.03], [31, 0.4, 0.03]],
          kit: {
            kick: { center: 48, rise: 2.2, sweep: 0.05, hold: 0.11, decay: 0.48, drive: 1.6, lp: 300, click: 0.15, clickHz: 1100, level: 0.3 },
            clap: { level: 0 },
            hat: { off: 0.3, decay: 0.03, hp: 7000, metal: 0, shaker: 0.1, shakerDecay: 0.035, shuffle: [0, 0.3, 0.2, 1] },
            perc: { level: 0 },
          },
          subTone: { level: 0.64, octave: 0.03, lp: 150, attack: 0.07, release: 0.3, drive: 1, glide: 0.09, warmth: 0.45 },
          stabTone: { wave: "sawtooth", detune: 6, lp: 480, env: 1.8, envTime: 0.25, q: 2.5, hp: 200, attack: 0.015, release: 0.6, gain: 0.72, pan: -0.06, move: 0.12, octave: 0 },
          padTone: { level: 0.55, wave: "sawtooth", detune: 7, octave: -12, lp: 280, attack: 7, release: 6, hp: 150 },
          bellTone: { level: 0 },
          melody: {
            level: 1.2, wave: "triangle", detune: 5, octave: 12, notes: [-2, 0, 3, 7, 10], every: 8, count: 2, chance: 0.5,
            attack: 0.8, hold: 2, release: 4, lp: 1500, echo: 0.6, space: 0.65,
          },
          sweep: { stab: 32, echo: 32, send: 0.3, fb: 0.2, breath: 24 },
          field: { level: 0 },
          air: {
            layers: [
              { filter: "lowpass", hz: 160, q: 0.7, level: 0.175, drift: 0.3, pan: -0.2 },
              { filter: "bandpass", hz: 650, q: 0.7, level: 0.06, drift: 0.8, pan: 0.35 },
              { filter: "crackle", hz: 2200, q: 0.9, level: 0.06, drift: 0.2, pan: 0.5, swell: 0.6 },
            ],
            swell: { every: 32, chance: 0.6, gain: 8, rise: 5, fall: 1 },
            floor: 0,
          },
          rumble: { level: 0.55, lp: 140, decay: 2.2, duck: 0.85 },
          echoTone: { width: 0.8, alt: 0, wobble: 0.5, rate: 0.22 },
          vinyl: 0,
          hiss: { hz: 1600, q: 0.6, lp: 3200 },
          mix: { lead: -3, tex: 0, hat: -2, fx: -6 },
          fx: {
            echo: { steps: 6, taps: 12, fb: 0.74, lp: 1300, hp: 440 },
            echoSend: { harm: 0.95, snare: 0.4, perc: 0.4, lead: 0.6, hat: 0.1, fx: 1 },
            space: { size: 2.5, fb: 0.84, lp: 1600 },
            spaceSend: { harm: 0.6, tex: 0.6, lead: 0.6, snare: 0.3, hat: 0.15, perc: 0.2, kick: 0.03, fx: 0.5 },
            drumLp: 6500,
            duck: { bass: 0.2 },
            duckTime: { bass: 0.3 },
            master: { lp: 6000 },
          },
        },
      },
      // Night Bus: the most submerged. Null's empty phrase slowed to 112: the low minor triad (a sus fourth for eight
      // bars), one dark resonant stab a phrase and a softer one six bars on, the longest dotted-quarter echo, Void's sub
      // in one long note a bar sliding up to the fifth at the end; the kick only on the one of every bar, its rumble room
      // long under it like an engine through the floor; no hats but one shaker. Air: the bus's engine hum and its low
      // rumble, traffic passing in a band, a little wind; one long swell in about 32 bars of 40.
      {
        id: "ambient-dub-nightbus",
        name: "Night Bus",
        base: "ixtlan",
        bpm: [112, 112],
        swing: 0.5,
        microScale: 0.08,
        trim: 1.03,
        riser: 0,
        heat: 0.5,
        data: {
          chords: {
            i: { root: 0, upper: [-5, 0, 3] },
            sus: { root: 0, upper: [-5, 0, 5] },
          },
          progressions: [
            { bars: 8, seq: ["i", "i", "sus", "i"] },
            { bars: 8, seq: ["i", "i", "i", "sus"] },
          ],
          figures: [[6], [3], [11]],
          accents: [0.9],
          stabBars: [1, 0, 0, 0, 0, 0, 0.6, 0],
          bassline: [[0, 13, 1], [13, 3, 0.65, 7]],
          kicks: [[0, 16]],
          hats: [[14, 0.5, 0.04], [30, 0.4, 0.04]],
          kit: {
            kick: { center: 46, rise: 2, sweep: 0.06, hold: 0.13, decay: 0.6, drive: 1.4, lp: 240, click: 0.1, clickHz: 1000, level: 0.32 },
            clap: { level: 0 },
            hat: { off: 0.25, decay: 0.04, hp: 6500, metal: 0, shaker: 0 },
            perc: { level: 0 },
          },
          subTone: { level: 0.64, octave: 0.03, lp: 150, attack: 0.07, release: 0.4, drive: 1, glide: 0.18, warmth: 0.35 },
          stabTone: { wave: "sawtooth", detune: 5, lp: 400, env: 1.7, envTime: 0.3, q: 2.6, hp: 200, attack: 0.02, release: 0.8, gain: 0.7, pan: 0.08, move: 0.1, octave: 0 },
          padTone: { level: 0.6, wave: "sawtooth", detune: 7, octave: -12, lp: 250, attack: 8, release: 6, hp: 150 },
          bellTone: { level: 0 },
          sweep: { stab: 48, echo: 32, send: 0.35, fb: 0.25, breath: 32 },
          field: { level: 0 },
          air: {
            layers: [
              { filter: "hum", hz: 55, level: 0.08, pan: 0 },
              { filter: "lowpass", hz: 130, q: 0.9, level: 0.088, drift: 0.3, pan: -0.15 },
              { filter: "bandpass", hz: 420, q: 0.6, level: 0.05, drift: 0.6, pan: 0.4 },
            ],
            swell: { every: 40, chance: 0.65, gain: 4.5, rise: 6, fall: 1 },
            floor: 0,
          },
          rumble: { level: 0.75, lp: 130, decay: 2.8, duck: 0.8 },
          echoTone: { width: 0.75, alt: 0, wobble: 0.6, rate: 0.12 },
          vinyl: 0,
          hiss: { hz: 1200, q: 0.6, lp: 2600 },
          mix: { lead: -4, tex: 0, fx: -6 },
          fx: {
            echo: { steps: 6, taps: 12, fb: 0.75, lp: 1100, hp: 450 },
            echoSend: { harm: 1, snare: 0.4, perc: 0.4, lead: 0.7, hat: 0.15, fx: 1 },
            space: { size: 2.5, fb: 0.85, lp: 1400 },
            spaceSend: { harm: 0.65, tex: 0.65, lead: 0.6, snare: 0.3, hat: 0.2, perc: 0.2, kick: 0.03, fx: 0.5 },
            drumLp: 6000,
            duck: { bass: 0.2 },
            duckTime: { bass: 0.35 },
            master: { lp: 5500 },
          },
        },
      },
      // Wet Pavement: no kick at all (`kicks: [[]]`), only the sub, the struck chord and the rain. Letterpress's struck
      // chord (a soft mallet on a bar's two modes, the fundamental ringing) on a low minor voicing, thrown into a wide
      // ping-pong (a quarter left, a dotted eighth right) with a slow wobble; tuned drips (the perc on the tonic and the
      // fifth) in its gaps; a soft offbeat tick; a rolling sub that slides to the fifth and back. Air: rain on a window
      // and drops on the sill coming and going, traffic far under; a swell (a heavier shower) in about 24 bars of 50.
      {
        id: "ambient-dub-pavement",
        name: "Wet Pavement",
        base: "ixtlan",
        bpm: [114, 114],
        swing: 0.5,
        microScale: 0.08,
        trim: 1.31,
        riser: 0,
        heat: 0.6,
        breakdown: { bass: 0.8 },
        data: {
          chords: {
            i: { root: 0, upper: [-5, 0, 3, 7] },
            turn: { root: 0, upper: [-5, 0, 3, 8] },
          },
          progressions: [
            { bars: 8, seq: ["i", "i", "turn", "i"] },
            { bars: 8, seq: ["i", "turn", "i", "i"] },
          ],
          figures: [[3, 10], [6, 13], [2, 11]],
          accents: [1, 0.65],
          stabBars: [1, 0, 0, 0.7, 0, 0, 0.85, 0],
          bassline: [[2, 4, 1], [8, 2, 0.75, 7], [11, 4, 0.9]],
          kicks: [[]],
          percs: [[5, 2, 0.5], [19, 1.5, 0.4], [27, 1, 0.35]],
          hats: [[2, 0.45, 0.025], [10, 0.6, 0.025], [18, 0.45, 0.025], [26, 0.6, 0.03]],
          kit: {
            kick: { level: 0 },
            clap: { level: 0 },
            hat: { off: 0.3, decay: 0.025, hp: 7000, metal: 0, shaker: 0 },
            perc: { level: 0.22, decay: 0.1 },
          },
          subTone: { level: 0.64, octave: 0.03, lp: 160, attack: 0.05, release: 0.3, drive: 1, glide: 0.07, warmth: 0.3 },
          stabTone: {
            engine: "pluck", wave: "sine", detune: 0, lp: 1400, env: 1.2, envTime: 0.1, q: 0.8, hp: 110, attack: 0.002, release: 1.3, gain: 0.45,
            pan: 0.06, move: 0.15, octave: 0, velLp: 0.3,
            pluck: { modes: [1, 4], decay: 1.6, damp: 1.2, tone: 1500, burst: 0.002, vel: 0.5 },
          },
          padTone: { level: 0 },
          bellTone: { level: 0 },
          sweep: { stab: 32, echo: 24 },
          field: { level: 0 },
          air: {
            layers: [
              { filter: "bandpass", hz: 850, q: 0.7, level: 0.07, drift: 0.4, pan: 0.25 },
              { filter: "crackle", hz: 1700, q: 0.8, level: 0.112, drift: 0.3, pan: -0.4 },
              { filter: "lowpass", hz: 190, q: 0.7, level: 0.05, drift: 0.2, pan: 0, swell: 0.5 },
            ],
            swell: { every: 24, chance: 0.45, gain: 7, rise: 3, fall: 1 },
            floor: 0,
          },
          rumble: { level: 0 },
          echoTone: { width: 0.9, alt: 3, wobble: 0.45, rate: 0.25 },
          vinyl: 0,
          hiss: { hz: 1400, q: 0.6, lp: 3000 },
          mix: { lead: -3, tex: 0, hat: -2, fx: -6 },
          fx: {
            echo: { steps: 4, taps: 12, fb: 0.73, lp: 1300, hp: 430 },
            echoSend: { harm: 0.95, snare: 0.4, perc: 0.6, lead: 0.6, hat: 0.15, fx: 1 },
            space: { size: 2.4, fb: 0.84, lp: 1600 },
            spaceSend: { harm: 0.55, tex: 0.6, lead: 0.55, snare: 0.3, hat: 0.2, perc: 0.35, kick: 0.03, fx: 0.5 },
            drumLp: 6500,
            duck: { bass: 0.3 },
            duckTime: { bass: 0.3 },
            master: { lp: 6000 },
          },
        },
      },
      // First Light: the one that travels and drives a little. Signature's Prophet-ish stab (a saw pair and a narrow
      // pulse, the accents opening the filter) on the minor seventh with the fifth under it, moving i -> iv -> i ->
      // bVII over eight bars each, into a dotted-eighth echo that breathes over 16 bars; a half-time kick (1 and 3, a
      // ghost before the second bar's 3 on some nights) with its rumble; the sub on the offbeats sliding to the
      // octave; a soft 16th shaker and a far rim on the 4. Air: a low city bed, a band wandering, wind now and then.
      {
        id: "ambient-dub-firstlight",
        name: "First Light",
        base: "ixtlan",
        bpm: [118, 118],
        swing: 0.5,
        microScale: 0.06,
        trim: 1.07,
        riser: 0,
        heat: 0.6,
        data: {
          chords: {
            i: { root: 0, upper: [-5, 0, 3, 10] },
            iv: { root: 5, upper: [-4, 0, 3, 5] },
            seven: { root: -2, upper: [-2, 2, 5, 10] },
          },
          progressions: [
            { bars: 8, seq: ["i", "iv", "i", "seven"] },
            { bars: 8, seq: ["i", "i", "iv", "seven"] },
          ],
          figures: [[3, 10, 14], [2, 7, 11], [3, 11, 14]],
          accents: [1, 0.5, 0.75],
          stabBars: [1, 0, 0, 0.6, 0, 0, 0.85, 0],
          bassline: [[2, 3, 1], [6, 1.5, 0.8], [10, 3, 1], [14, 1.5, 0.7, 12]],
          kicks: [[0, 8, 16, 24], [0, 8, 16, 22, 24]],
          claps: [[28, 0.8]],
          kit: {
            kick: { center: 50, rise: 2.4, sweep: 0.04, hold: 0.1, decay: 0.45, drive: 1.8, lp: 340, click: 0.25, clickHz: 1300, level: 0.32 },
            clap: { level: 0.2, hz: 1300, decay: 0.04, rim: true },
            hat: { off: 0, decay: 0.03, hp: 7000, metal: 0, shaker: 0.12, shakerDecay: 0.03, shuffle: [0.2, 0.5, 0.35, 0.8] },
            perc: { level: 0 },
          },
          subTone: { level: 0.64, octave: 0.03, lp: 150, attack: 0.07, release: 0.2, drive: 1, glide: 0.05, warmth: 0.4 },
          stabTone: {
            wave: "sawtooth", detune: 7, lp: 560, env: 2.2, envTime: 0.15, q: 2.4, hp: 210, attack: 0.008, release: 0.45, gain: 0.66, pan: -0.06, move: 0.15, octave: 0,
            wave2: "pulse", width: 0.2, mix2: 0.7, octave2: 0, velLp: 0.8,
          },
          padTone: { level: 0.55, wave: "sawtooth", detune: 7, octave: -12, lp: 320, attack: 6, release: 6, hp: 170 },
          bellTone: { level: 0 },
          sweep: { stab: 32, echo: 24, send: 0.45, fb: 0.3, breath: 16 },
          field: { level: 0 },
          air: {
            layers: [
              { filter: "lowpass", hz: 210, q: 0.7, level: 0.1, drift: 0.2, pan: 0.15 },
              { filter: "bandpass", hz: 700, q: 1, level: 0.06, drift: 0.9, pan: -0.35 },
              { filter: "highpass", hz: 2000, q: 0.5, level: 0.025, drift: 0.4, pan: 0.5 },
            ],
            swell: { every: 32, chance: 0.5, gain: 8, rise: 4, fall: 1 },
            floor: 0,
          },
          rumble: { level: 0.6, lp: 150, decay: 1.8, duck: 0.85 },
          echoTone: { width: 0.75, alt: 0, wobble: 0.25, rate: 0.3 },
          vinyl: 0,
          hiss: { hz: 1800, q: 0.6, lp: 3500 },
          mix: { lead: -4, tex: 0, fx: -6 },
          fx: {
            echo: { steps: 3, taps: 12, fb: 0.73, lp: 1400, hp: 470 },
            echoSend: { harm: 0.95, snare: 0.5, perc: 0.4, lead: 0.6, hat: 0.1, fx: 1 },
            space: { size: 2.3, fb: 0.83, lp: 1700 },
            spaceSend: { harm: 0.5, tex: 0.6, lead: 0.5, snare: 0.3, hat: 0.1, perc: 0.15, kick: 0.03, fx: 0.45 },
            drumLp: 7000,
            duck: { bass: 0.15 },
            duckTime: { bass: 0.28 },
            master: { lp: 6500 },
          },
        },
      },
      // Warehouse Tape: the driving one, on a tape machine in an empty warehouse. Watermark's short resonant square stab
      // on the low triad, turning phrygian (up a half step to bII minor) for eight bars, into a dotted-eighth echo that
      // wobbles like worn tape; the sub rolling every offbeat 16th with its ghost, warmed hard (warmth 0.8) and the
      // master tanh pushed (drive 1.35) for the tape's thickness; a solid kick on every beat with its rumble room,
      // closed offbeat hats. Air: the building itself, a mains hum, a low rumble, wind through a broken pane.
      {
        id: "ambient-dub-warehouse",
        name: "Warehouse Tape",
        base: "moment",
        bpm: [122, 122],
        swing: 0.5,
        microScale: 0.05,
        trim: 0.86,
        riser: 0,
        heat: 0.6,
        data: {
          chords: {
            i: { root: 0, upper: [-5, 0, 3] },
            turn: { root: 0, upper: [-4, 1, 4] },
          },
          progressions: [
            { bars: 8, seq: ["i", "i", "turn", "i"] },
            { bars: 8, seq: ["i", "i", "i", "turn"] },
          ],
          figures: [[2, 10], [3, 11], [2, 11]],
          accents: [1, 0.6],
          stabBars: [1, 0, 0.7, 0, 0, 0, 0.85, 0],
          bassline: [[2, 1, 1], [3, 0.8, 0.6], [6, 1, 1], [7, 0.8, 0.6], [10, 1, 1], [11, 0.8, 0.6], [14, 1, 1], [15, 0.8, 0.6]],
          kit: {
            kick: { center: 50, rise: 2.6, sweep: 0.035, hold: 0.09, decay: 0.42, drive: 2.2, lp: 420, click: 0.45, clickHz: 1400, level: 0.33 },
            clap: { level: 0 },
            hat: { off: 0.4, decay: 0.03, hp: 8400, metal: 0.12, shaker: 0 },
            perc: { level: 0 },
          },
          subTone: { level: 0.5, octave: 0.04, lp: 170, attack: 0.03, release: 0.05, drive: 1.2, warmth: 0.8 },
          stabTone: { wave: "square", detune: 4, lp: 600, env: 2.2, envTime: 0.1, q: 3, hp: 240, attack: 0.004, release: 0.25, gain: 0.7, pan: 0.06, move: 0.3, octave: 0 },
          padTone: { level: 0 },
          bellTone: { level: 0 },
          sweep: { stab: 24, echo: 16 },
          field: { level: 0 },
          air: {
            layers: [
              { filter: "hum", hz: 50, level: 0.06, pan: 0 },
              { filter: "lowpass", hz: 90, q: 0.9, level: 0.1, drift: 0.3, pan: -0.2 },
              { filter: "highpass", hz: 1800, q: 0.6, level: 0.025, drift: 0.6, pan: 0.5 },
            ],
            swell: { every: 32, chance: 0.55, gain: 6.5, rise: 4, fall: 1 },
            floor: 0,
          },
          rumble: { level: 0.8, lp: 170, decay: 1.6, duck: 0.9 },
          echoTone: { width: 0.7, alt: 0, wobble: 0.7, rate: 0.35 },
          vinyl: 0,
          mix: { lead: -4, tex: 0, fx: -6 },
          fx: {
            echo: { steps: 3, taps: 12, fb: 0.73, lp: 1500, hp: 520 },
            echoSend: { harm: 0.9, snare: 0.4, perc: 0.4, lead: 0.5, hat: 0.08, fx: 1 },
            space: { size: 2, fb: 0.8, lp: 1700 },
            spaceSend: { harm: 0.4, tex: 0.5, lead: 0.4, snare: 0.25, hat: 0.06, perc: 0.15, kick: 0.03, fx: 0.35 },
            drumLp: 7000,
            drive: 1.35,
            duck: { bass: 0.2 },
            duckTime: { bass: 0.16 },
            master: { lp: 6000 },
          },
        },
      },
      // Harbour Fog: the sparsest, a chord in the fog. One minor-ninth chord (the flat seventh under the third) that
      // swells in slowly (a 120 ms attack, a long release) once in eight bars into a half-note echo and the darkest
      // room; a sus2 colour for eight bars; one long sub note a bar sliding between root and fifth; the kick only once
      // in two bars, its rumble long; no hats; a far bell now and then. Air: a foghorn hum and the water's low wash.
      {
        id: "ambient-dub-fog",
        name: "Harbour Fog",
        base: "ixtlan",
        bpm: [112, 112],
        swing: 0.5,
        microScale: 0.1,
        trim: 1,
        riser: 0,
        heat: 0.4,
        data: {
          chords: {
            i: { root: 0, upper: [-2, 3, 7, 14] },
            sus: { root: 0, upper: [-2, 2, 7, 14] },
          },
          progressions: [
            { bars: 8, seq: ["i", "i", "sus", "i"] },
            { bars: 8, seq: ["i", "sus", "i", "i"] },
          ],
          figures: [[0], [8], [4]],
          accents: [0.9],
          stabBars: [1, 0, 0, 0, 0, 0, 0, 0],
          bassline: [[0, 8, 1], [8, 7, 0.85, 7]],
          kicks: [[0]],
          bells: [[[22, 0, 1]], [[38, 1, 0.9]]],
          kit: {
            kick: { center: 44, rise: 1.8, sweep: 0.08, hold: 0.15, decay: 0.7, drive: 1.2, lp: 200, click: 0, clickHz: 900, level: 0.34 },
            clap: { level: 0 },
            hat: { off: 0, shaker: 0 },
            perc: { level: 0 },
          },
          subTone: { level: 0.64, octave: 0.03, lp: 140, attack: 0.12, release: 0.5, drive: 1, glide: 0.2, warmth: 0.4 },
          stabTone: { wave: "sawtooth", detune: 8, lp: 340, env: 1.3, envTime: 0.6, q: 2.2, hp: 180, attack: 0.12, release: 1.6, gain: 0.7, pan: -0.08, move: 0.08, octave: 0 },
          padTone: { level: 0.5, wave: "sawtooth", detune: 7, octave: -12, lp: 240, attack: 8, release: 6, hp: 150 },
          bellTone: { level: 0.5, every: 4, ratio: 2, index: 0.4, decay: 2.5 },
          sweep: { stab: 64, echo: 32, send: 0.3, fb: 0.2, breath: 32 },
          field: { level: 0 },
          air: {
            layers: [
              { filter: "hum", hz: 73, level: 0.07, pan: -0.2 },
              { filter: "lowpass", hz: 150, q: 0.8, level: 0.1, drift: 0.4, pan: 0.2 },
              { filter: "bandpass", hz: 320, q: 0.7, level: 0.05, drift: 0.5, pan: 0.4 },
            ],
            swell: { every: 40, chance: 0.6, gain: 4.5, rise: 6, fall: 1 },
            floor: 0,
          },
          rumble: { level: 0.6, lp: 120, decay: 2.8, duck: 0.7 },
          echoTone: { width: 0.9, alt: 0, wobble: 0.4, rate: 0.1 },
          vinyl: 0,
          mix: { lead: -4, tex: 0, fx: -6 },
          fx: {
            echo: { steps: 8, taps: 12, fb: 0.75, lp: 1000, hp: 420 },
            echoSend: { harm: 1, snare: 0.4, perc: 0.4, lead: 0.7, hat: 0.1, fx: 1 },
            space: { size: 2.5, fb: 0.85, lp: 1300 },
            spaceSend: { harm: 0.75, tex: 0.65, lead: 0.7, snare: 0.3, hat: 0.15, perc: 0.2, kick: 0.03, fx: 0.5 },
            drumLp: 5500,
            duck: { bass: 0.25 },
            duckTime: { bass: 0.4 },
            master: { lp: 5500 },
          },
        },
      },
      // Overpass: the rolling half-time sub dub. A broken half-time kick (the one, a late "and" of 3, again), the sub
      // rolling under it in a syncopated line that slides to the fifth and the flat seventh; a soft hollow FM stab (a
      // 2:1 pair, low index) on the triad and its sus fourth, into a ping-pong of a quarter and an eighth; two tuned
      // knocks, a tick on 2 and 4. Air: traffic washing overhead, a whoosh and the deck's low drone.
      {
        id: "ambient-dub-overpass",
        name: "Overpass",
        base: "ixtlan",
        bpm: [120, 120],
        swing: 0.5,
        microScale: 0.06,
        trim: 1.25,
        riser: 0,
        heat: 0.5,
        data: {
          chords: {
            i: { root: 0, upper: [-5, 0, 3] },
            sus: { root: 0, upper: [-5, 0, 5] },
          },
          progressions: [
            { bars: 8, seq: ["i", "i", "sus", "i"] },
            { bars: 8, seq: ["i", "sus", "i", "sus"] },
          ],
          figures: [[3, 11], [6, 14], [3, 14]],
          accents: [0.9, 0.6],
          stabBars: [1, 0, 0, 0.6, 0, 0, 0.8, 0],
          bassline: [[0, 2.5, 1], [3, 1, 0.6], [6, 1.5, 0.85, 7], [8, 2.5, 0.95], [11, 1, 0.6], [14, 1.5, 0.8, 10]],
          kicks: [[0, 10, 16, 26], [0, 10, 16, 24, 26]],
          percs: [[7, 1, 0.6], [23, 1.5, 0.5]],
          hats: [[4, 0.5, 0.03], [12, 0.6, 0.03], [20, 0.5, 0.03], [28, 0.6, 0.03]],
          kit: {
            kick: { center: 48, rise: 2.2, sweep: 0.05, hold: 0.11, decay: 0.5, drive: 1.6, lp: 300, click: 0.2, clickHz: 1200, level: 0.28 },
            clap: { level: 0 },
            hat: { off: 0.3, decay: 0.03, hp: 8000, metal: 0.05, shaker: 0 },
            perc: { level: 0.25, decay: 0.08 },
          },
          subTone: { level: 0.8, octave: 0.03, lp: 160, attack: 0.04, release: 0.15, drive: 1, glide: 0.05, warmth: 0.6 },
          stabTone: {
            engine: "fm", wave: "sine", detune: 4, lp: 800, env: 1.5, envTime: 0.12, q: 1.4, hp: 200, attack: 0.004, release: 0.35, gain: 0.6,
            pan: 0.05, move: 0.2, octave: 0, velLp: 0.4,
            fm: { ratio: 2, index: 1, floor: 0.2, decay: 0.15, index2: 0, vel: 0.5 },
          },
          padTone: { level: 0 },
          bellTone: { level: 0 },
          sweep: { stab: 32, echo: 24 },
          field: { level: 0 },
          air: {
            layers: [
              { filter: "bandpass", hz: 350, q: 0.7, level: 0.08, drift: 0.9, pan: -0.3 },
              { filter: "highpass", hz: 1500, q: 0.5, level: 0.025, drift: 0.7, pan: 0.4 },
              { filter: "lowpass", hz: 100, q: 0.8, level: 0.1, drift: 0.3, pan: 0 },
            ],
            swell: { every: 24, chance: 0.4, gain: 6, rise: 3, fall: 1 },
            floor: 0,
          },
          rumble: { level: 0.7, lp: 160, decay: 1.6, duck: 0.9 },
          echoTone: { width: 0.85, alt: 2, wobble: 0.3, rate: 0.3 },
          vinyl: 0,
          mix: { lead: -4, tex: 0, fx: -6 },
          fx: {
            echo: { steps: 4, taps: 12, fb: 0.73, lp: 1400, hp: 460 },
            echoSend: { harm: 0.95, snare: 0.4, perc: 0.6, lead: 0.6, hat: 0.1, fx: 1 },
            space: { size: 2.2, fb: 0.82, lp: 1600 },
            spaceSend: { harm: 0.5, tex: 0.55, lead: 0.5, snare: 0.3, hat: 0.1, perc: 0.3, kick: 0.03, fx: 0.45 },
            drumLp: 6500,
            duck: { bass: 0.2 },
            duckTime: { bass: 0.25 },
            master: { lp: 6000 },
          },
        },
      },
      // Last Ferry: a melodica-like phrase answered by the echo. A reedy square lead (two detuned squares under a 1.3
      // kHz lowpass, quick to speak) plays two or three notes of the minor pentatonic in most two-bar cells, thrown into
      // a dotted-quarter echo that answers it; the stab rests to once in eight bars, the minor seventh and iv; the sub
      // walks root, fifth, root, octave; a soft kick that skips the last beat of every second bar; a shaker. Air: water
      // at the pier, a ship's low hum far off.
      {
        id: "ambient-dub-ferry",
        name: "Last Ferry",
        base: "ixtlan",
        bpm: [115, 115],
        swing: 0.5,
        microScale: 0.08,
        trim: 1.08,
        riser: 0,
        heat: 0.5,
        data: {
          chords: {
            i: { root: 0, upper: [-5, 0, 3, 10] },
            iv: { root: 5, upper: [-4, 0, 3, 5] },
          },
          progressions: [
            { bars: 8, seq: ["i", "i", "iv", "i"] },
            { bars: 8, seq: ["i", "iv", "i", "i"] },
          ],
          figures: [[6], [3], [10]],
          accents: [0.85],
          stabBars: [1, 0, 0, 0, 0, 0, 0, 0],
          bassline: [[0, 4, 1], [6, 2, 0.8, 7], [10, 4, 0.9], [14, 2, 0.7, 12]],
          kicks: [[0, 4, 8, 12, 16, 20, 24]],
          hats: [[7, 0.4, 0.03], [23, 0.4, 0.03]],
          kit: {
            kick: { center: 46, rise: 2, sweep: 0.06, hold: 0.12, decay: 0.5, drive: 1.4, lp: 260, click: 0.1, clickHz: 1000, level: 0.3 },
            clap: { level: 0 },
            hat: { off: 0.3, decay: 0.03, hp: 7500, metal: 0, shaker: 0.1, shakerDecay: 0.03, shuffle: [0, 0.4, 0.2, 0.9] },
            perc: { level: 0 },
          },
          subTone: { level: 0.64, octave: 0.03, lp: 150, attack: 0.07, release: 0.25, drive: 1, glide: 0.08, warmth: 0.5 },
          stabTone: { wave: "sawtooth", detune: 6, lp: 420, env: 1.8, envTime: 0.25, q: 2.4, hp: 200, attack: 0.015, release: 0.6, gain: 0.65, pan: -0.06, move: 0.1, octave: 0 },
          padTone: { level: 0.6, wave: "sawtooth", detune: 7, octave: -12, lp: 280, attack: 7, release: 6, hp: 150 },
          bellTone: { level: 0 },
          melody: {
            level: 1.6, wave: "square", detune: 10, octave: 12, notes: [0, 3, 5, 7, 10, 12], every: 2, count: 3, chance: 0.75,
            attack: 0.04, hold: 2, release: 1.2, lp: 1300, echo: 0.75, space: 0.5,
          },
          sweep: { stab: 32, echo: 32 },
          field: { level: 0 },
          air: {
            layers: [
              { filter: "crackle", hz: 900, q: 0.8, level: 0.08, drift: 0.3, pan: -0.4 },
              { filter: "bandpass", hz: 500, q: 0.8, level: 0.06, drift: 0.5, pan: 0.3 },
              { filter: "hum", hz: 41, level: 0.06, pan: 0 },
            ],
            swell: { every: 32, chance: 0.6, gain: 6, rise: 4, fall: 1 },
            floor: 0,
          },
          rumble: { level: 0.4, lp: 140, decay: 2, duck: 0.85 },
          echoTone: { width: 0.8, alt: 0, wobble: 0.4, rate: 0.2 },
          vinyl: 0,
          mix: { lead: -1, tex: 0, hat: -2, fx: -6 },
          fx: {
            echo: { steps: 6, taps: 12, fb: 0.74, lp: 1300, hp: 450 },
            echoSend: { harm: 0.95, snare: 0.4, perc: 0.4, lead: 0.7, hat: 0.1, fx: 1 },
            space: { size: 2.5, fb: 0.84, lp: 1600 },
            spaceSend: { harm: 0.6, tex: 0.6, lead: 0.55, snare: 0.3, hat: 0.15, perc: 0.2, kick: 0.03, fx: 0.5 },
            drumLp: 6500,
            duck: { bass: 0.2 },
            duckTime: { bass: 0.3 },
            master: { lp: 6000 },
          },
        },
      },
      // Tram Lights: the brightest, first light on the rails. The only major colour in the pack: bVI maj9 and bVII add9
      // before the i minor ninth (the house chords), a saw stab with a glassy pulse an octave up and the accents
      // opening it, three bars in eight into a ping-pong of a dotted eighth and a dotted quarter; a bell fragment every
      // second phrase; a broken 3+3+2 kick pulse; the sub bouncing to the fifth and octave. Air: the city waking, a
      // band of street, a far rattle of the rails.
      {
        id: "ambient-dub-tram",
        name: "Tram Lights",
        base: "ixtlan",
        bpm: [124, 124],
        swing: 0.5,
        microScale: 0.06,
        trim: 1.12,
        riser: 0,
        heat: 0.6,
        data: {
          progressions: [
            { bars: 8, seq: ["VI9", "VII9", "i9", "i9"] },
            { bars: 8, seq: ["i9", "VI9", "VII9", "VI9"] },
          ],
          figures: [[2, 7, 10], [3, 6, 11], [2, 10, 14]],
          accents: [1, 0.55, 0.75],
          stabBars: [1, 0, 0.7, 0, 0.9, 0, 0, 0],
          bassline: [[2, 2, 1], [6, 1.5, 0.8], [10, 2, 1], [13, 1, 0.6, 7], [14, 1.5, 0.8, 12]],
          kicks: [[0, 6, 12, 16, 22, 28]],
          hats: [[2, 0.6, 0.03], [10, 0.6, 0.03], [18, 0.6, 0.03], [26, 0.6, 0.03], [30, 0.4, 0.12]],
          kit: {
            kick: { center: 50, rise: 2.4, sweep: 0.04, hold: 0.1, decay: 0.45, drive: 1.6, lp: 340, click: 0.25, clickHz: 1300, level: 0.32 },
            clap: { level: 0 },
            hat: { off: 0.35, decay: 0.03, hp: 8200, metal: 0.05, shaker: 0.08, shakerDecay: 0.03, shuffle: [0, 0.4, 0.3, 0.8] },
            perc: { level: 0 },
          },
          subTone: { level: 0.7, octave: 0.03, lp: 160, attack: 0.05, release: 0.2, drive: 1, glide: 0.04, warmth: 0.4 },
          stabTone: {
            wave: "sawtooth", detune: 7, lp: 700, env: 2, envTime: 0.12, q: 2, hp: 220, attack: 0.008, release: 0.45, gain: 0.6, pan: 0.05, move: 0.15, octave: 0,
            wave2: "pulse", width: 0.3, mix2: 0.4, octave2: 12, velLp: 0.6,
          },
          padTone: { level: 0.6, wave: "sawtooth", detune: 7, octave: -12, lp: 360, attack: 6, release: 6, hp: 170 },
          bellTone: { level: 0.7, every: 2, ratio: 2, index: 0.5, decay: 1.6 },
          sweep: { stab: 32, echo: 16, send: 0.3, fb: 0.2, breath: 16 },
          field: { level: 0 },
          air: {
            layers: [
              { filter: "bandpass", hz: 1200, q: 0.8, level: 0.05, drift: 0.4, pan: 0.3 },
              { filter: "lowpass", hz: 200, q: 0.7, level: 0.1, drift: 0.2, pan: -0.2 },
              { filter: "crackle", hz: 2600, q: 1, level: 0.035, drift: 0.3, pan: -0.5 },
            ],
            swell: { every: 32, chance: 0.6, gain: 7, rise: 3, fall: 1 },
            floor: 0,
          },
          rumble: { level: 0.5, lp: 160, decay: 1.5, duck: 0.9 },
          echoTone: { width: 0.8, alt: 6, wobble: 0.2, rate: 0.3 },
          vinyl: 0,
          mix: { lead: -4, tex: 0, hat: -2, fx: -6 },
          fx: {
            echo: { steps: 3, taps: 12, fb: 0.72, lp: 1600, hp: 480 },
            echoSend: { harm: 0.9, snare: 0.4, perc: 0.4, lead: 0.6, hat: 0.1, fx: 1 },
            space: { size: 2.2, fb: 0.82, lp: 1900 },
            spaceSend: { harm: 0.5, tex: 0.55, lead: 0.55, snare: 0.3, hat: 0.1, perc: 0.15, kick: 0.03, fx: 0.45 },
            drumLp: 7500,
            duck: { bass: 0.2 },
            duckTime: { bass: 0.25 },
            master: { lp: 7000 },
          },
        },
      },
      // Under the Bridge: the deepest register. The minor seventh an octave down (the stab in the sub's next octave,
      // highpassed at 90 Hz) under a 320 Hz resonant lowpass, into a low, dark echo (260..800 Hz, a dotted quarter
      // against a quarter) and a concrete room; the sub in two long notes a bar sliding slowly to the fifth; the kick
      // on the one and the "a" of 2 in the second bar; water dripping (tuned knocks, two open ticks). Air: traffic
      // overhead like distant thunder, the drips.
      {
        id: "ambient-dub-bridge",
        name: "Under the Bridge",
        base: "ixtlan",
        bpm: [113, 113],
        swing: 0.5,
        microScale: 0.1,
        trim: 1.02,
        riser: 0,
        heat: 0.4,
        data: {
          chords: {
            i: { root: 0, upper: [-2, 3, 7, 10] },
            low: { root: 0, upper: [-2, 3, 5, 10] },
          },
          progressions: [
            { bars: 8, seq: ["i", "i", "low", "i"] },
            { bars: 8, seq: ["i", "low"] },
          ],
          figures: [[6], [11], [3]],
          accents: [0.9],
          stabBars: [1, 0, 0, 0, 0.7, 0, 0, 0],
          bassline: [[0, 6, 1], [8, 6, 0.9, 7]],
          kicks: [[0, 22]],
          percs: [[5, 2, 0.4], [21, 3, 0.3]],
          hats: [[14, 0.4, 0.06], [30, 0.5, 0.09]],
          kit: {
            kick: { center: 44, rise: 1.8, sweep: 0.07, hold: 0.14, decay: 0.65, drive: 1.3, lp: 220, click: 0, clickHz: 900, level: 0.28 },
            clap: { level: 0 },
            hat: { off: 0.3, decay: 0.05, hp: 6000, metal: 0, shaker: 0 },
            perc: { level: 0.2, decay: 0.15 },
          },
          subTone: { level: 0.7, octave: 0.03, lp: 140, attack: 0.08, release: 0.4, drive: 1, glide: 0.25, warmth: 0.5 },
          stabTone: { wave: "sawtooth", detune: 6, lp: 320, env: 1.6, envTime: 0.3, q: 2.8, hp: 90, attack: 0.02, release: 0.9, gain: 0.5, pan: 0, move: 0.1, octave: -12 },
          padTone: { level: 0.62, wave: "sawtooth", detune: 7, octave: -12, lp: 230, attack: 8, release: 6, hp: 130 },
          bellTone: { level: 0 },
          sweep: { stab: 48, echo: 32 },
          field: { level: 0 },
          air: {
            layers: [
              { filter: "lowpass", hz: 80, q: 0.9, level: 0.12, drift: 0.3, pan: 0 },
              { filter: "bandpass", hz: 200, q: 0.7, level: 0.08, drift: 0.5, pan: -0.3 },
              { filter: "crackle", hz: 1200, q: 0.8, level: 0.05, drift: 0.3, pan: 0.4 },
            ],
            swell: { every: 40, chance: 0.6, gain: 10, rise: 5, fall: 1 },
            floor: 0,
          },
          rumble: { level: 0.6, lp: 110, decay: 2.6, duck: 0.8 },
          echoTone: { width: 0.75, alt: 4, wobble: 0.5, rate: 0.15 },
          vinyl: 0,
          mix: { lead: -4, tex: 0, fx: -6 },
          fx: {
            echo: { steps: 6, taps: 12, fb: 0.75, lp: 800, hp: 260 },
            echoSend: { harm: 1, snare: 0.4, perc: 0.6, lead: 0.6, hat: 0.2, fx: 1 },
            space: { size: 2.5, fb: 0.85, lp: 1000 },
            spaceSend: { harm: 0.65, tex: 0.6, lead: 0.6, snare: 0.3, hat: 0.3, perc: 0.4, kick: 0.03, fx: 0.5 },
            drumLp: 5500,
            duck: { bass: 0.25 },
            duckTime: { bass: 0.35 },
            master: { lp: 5500 },
          },
        },
      },
    ],
  },
} satisfies StationPack;
