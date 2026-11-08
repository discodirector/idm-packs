/**
 * Synth v2 DSP core (docs/sound/SYNTH-V2.md): sample-by-sample voices for the AudioWorklet, where the stock Web Audio
 * blocks cannot go (filters with saturation inside the feedback loop, oscillators that drift, modal resonators,
 * waveguides, a sampler that resamples).
 *
 * The whole core is ONE self-contained factory, `makeV2Dsp`: no imports and no references to anything outside its
 * body, because worklet.ts turns its source text into the AudioWorklet module (Function.prototype.toString). Tests
 * call the factory directly in Node.
 *
 * Deterministic: every random number comes from a PRNG seeded by the event (`ev.seed`); no Math.random, no clock, no
 * state shared between events except caches that are pure functions of their keys (the morph tables, the chop
 * sources). The same event renders the same samples, run to run, offline and in the worklet.
 *
 * One event = one note or one chord, from its start to the end of its release (the worklet processor runs it and
 * then returns false). Voices write (not add) into the output block.
 */

/** The voice families (the four of the brief, plus the sampler). */
export type V2Kind = "analog" | "fm" | "modal" | "pluck" | "morph" | "chop";

/** The "alive" layer, all seeded per event (docs/sound/SYNTH-V2.md "Alive"). */
export interface V2Alive {
  /** Slow pitch drift per oscillator, cents (peak). */
  drift: number;
  /** Drift speed, Hz (each oscillator gets 0.7..1.3 x this). */
  driftRate: number;
  /** Slow random modulation of the timbre (filter cutoff, FM index, morph position), 0..1. */
  wander: number;
  /** Per-note envelope variance, 0..1 (attack, decay and release times move by up to +-30% x this). */
  envVar: number;
  /** How much velocity opens the timbre and sharpens the attack, 0..1. */
  velBright: number;
}

/** One event as the engine hands it to the worklet (processorOptions). Plain data only (structured clone). */
export interface V2Event {
  kind: V2Kind;
  /** MIDI notes (fractional allowed). */
  notes: number[];
  /** Velocity 0..1.2. */
  vel: number;
  /** Gate length, s (the release starts here). */
  hold: number;
  /** All randomness of the event. */
  seed: number;
  /** Output gain. */
  gain: number;
  /** Event pan -1..1 and how far the notes spread around it, 0..1. */
  pan: number;
  width: number;
  /** Glide into the first note from this frequency (Hz; 0 none) over `glide` s. */
  from: number;
  glide: number;
  alive: V2Alive;
  /** The family's parameters (resolved with their defaults by voices.ts). */
  p: Record<string, any>;
}

export interface V2Voice {
  /** Writes `n` samples at `off` into L and R; false once the event has finished (and its output is exactly 0). */
  render(L: Float32Array, R: Float32Array, off: number, n: number): boolean;
}

export interface V2Dsp {
  createVoice(ev: V2Event, sr: number): V2Voice;
  /** Renders a whole event offline (tests, chop sources): stereo, at most `maxSec`. */
  renderEvent(ev: V2Event, sr: number, maxSec?: number): { L: Float32Array; R: Float32Array };
  /**
   * The chop event's sampled chord (cached by its key). The engine computes it on the main thread and hands it to
   * the worklet in the event (`p.src`), so the audio thread never renders a source (~70 ms per chord quality).
   */
  chopSource(ev: V2Event, sr: number): V2ChopSource;
}

/** A sampled chord: stereo at the sampler's own rate. */
export interface V2ChopSource {
  L: Float32Array;
  R: Float32Array;
  rate: number;
}

export function makeV2Dsp(): V2Dsp {
  const TAU = 2 * Math.PI;
  /** The longest event, s: every voice ends by then whatever its envelope. */
  const MAX_SEC = 16;

  // ---- helpers ------------------------------------------------------------------------------------------------

  /** mulberry32: a small seeded PRNG, 0..1. */
  function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
  /** A rational tanh: exact enough for saturation, and the same everywhere. */
  function sat(x: number): number {
    if (x > 3) return 1;
    if (x < -3) return -1;
    const x2 = x * x;
    return (x * (27 + x2)) / (27 + 9 * x2);
  }
  /** polyBLEP residual for a discontinuity at phase 0 (phase t in 0..1, increment dt). */
  function blep(t: number, dt: number): number {
    if (t < dt) {
      t /= dt;
      return t + t - t * t - 1;
    }
    if (t > 1 - dt) {
      t = (t - 1) / dt;
      return t * t + t + t + 1;
    }
    return 0;
  }
  /** Slow value noise in -1..1: a new seeded target every 1/rate s, smoothstep between targets. */
  function wanderer(rand: () => number, rate: number, sr: number) {
    let a = rand() * 2 - 1;
    let b = rand() * 2 - 1;
    let ph = rand();
    const inc = Math.max(1e-6, rate) / sr;
    return () => {
      ph += inc;
      if (ph >= 1) {
        ph -= 1;
        a = b;
        b = rand() * 2 - 1;
      }
      const s = ph * ph * (3 - 2 * ph);
      return a + (b - a) * s;
    };
  }
  /** Equal-power pan gains. */
  function panGains(p: number): [number, number] {
    const a = ((clamp(p, -1, 1) + 1) * Math.PI) / 4;
    return [Math.cos(a), Math.sin(a)];
  }
  /** Where note i of n sits: the event's pan, spread by `width`. */
  function notePan(ev: V2Event, i: number, n: number): number {
    if (n < 2) return ev.pan;
    return clamp(ev.pan + ev.width * (i / (n - 1) - 0.5) * 1.2, -1, 1);
  }
  /** Envelope-time variance for one note: 1 +- 30% x envVar. */
  function vary(rand: () => number, ev: V2Event): number {
    return 1 + (rand() - 0.5) * 0.6 * clamp(ev.alive.envVar, 0, 1);
  }

  /**
   * ADSR, sample by sample: a linear attack, exponential decay to the sustain, held until the gate (`hold` s), an
   * exponential release that falls to 1% in `r` s and then lands on exactly 0 over 64 samples.
   */
  function adsr(sr: number, a: number, d: number, s: number, r: number, hold: number) {
    const aN = Math.max(1, Math.round(a * sr));
    const gate = Math.max(1, Math.round(hold * sr));
    const dCo = Math.exp(-4.6 / Math.max(1, d * sr));
    const rCo = Math.exp(-4.6 / Math.max(1, r * sr));
    const sus = clamp(s, 0, 1);
    let n = 0;
    let lvl = 0;
    let stage = 0; // 0 attack, 1 decay/sustain, 2 release, 3 fade to 0, 4 done
    let fade = 0;
    let fadeStep = 0;
    const env = {
      done: false,
      /** True from the gate on. */
      released: false,
      next(): number {
        if (stage < 2 && n >= gate) {
          stage = 2;
          env.released = true;
        }
        if (stage === 0) {
          lvl += 1 / aN;
          if (lvl >= 1) {
            lvl = 1;
            stage = 1;
          }
        } else if (stage === 1) lvl = sus + (lvl - sus) * dCo;
        else if (stage === 2) {
          lvl *= rCo;
          if (lvl < 0.004) {
            stage = 3;
            fade = 64;
            fadeStep = lvl / 64;
          }
        } else if (stage === 3) {
          lvl -= fadeStep;
          if (--fade <= 0) {
            lvl = 0;
            stage = 4;
            env.done = true;
          }
        }
        n++;
        return lvl;
      },
    };
    return env;
  }

  /** A one-pole lowpass state (TPT), cutoff set per call through its g = tan(pi fc / sr) coefficient G = g / (1 + g). */
  function gOf(fc: number, sr: number): number {
    const g = Math.tan((Math.PI * clamp(fc, 10, sr * 0.49)) / sr);
    return g / (1 + g);
  }

  /**
   * The ladder filters, run at twice the sample rate (each input sample twice: the midpoint, then the sample; the two
   * outputs averaged). `k` 0..4 resonance; the saturation sits inside the feedback loop.
   *   "ladder": Moog-style. A zero-delay-feedback (TPT) 4-pole: the feedback is solved for the current sample, then
   *             the loop input goes through tanh, so a loud or resonant note compresses and thickens instead of
   *             whistling.
   *   "diode":  303-style. The same solved loop with the feedback's lows taken out (the bass stays when the
   *             resonance is up: the squelch of a diode ladder), an asymmetric drive into the loop and the output a
   *             blend of the third and fourth poles (its softer slope). An approximation, not a circuit model.
   */
  function ladder(kind: string) {
    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    let s4 = 0;
    let y4 = 0;
    let hpS = 0;
    let prev = 0;
    const diode = kind === "diode";
    function step(x: number, G: number, k: number): number {
      if (!diode) {
        const G2 = G * G;
        const b = 1 - G;
        const sigma = G2 * G * b * s1 + G2 * b * s2 + G * b * s3 + b * s4;
        let u = (x - k * sigma) / (1 + k * G2 * G2);
        u = sat(u);
        let v = (u - s1) * G;
        let y = v + s1;
        s1 = y + v;
        v = (y - s2) * G;
        y = v + s2;
        s2 = y + v;
        v = (y - s3) * G;
        y = v + s3;
        s3 = y + v;
        v = (y - s4) * G;
        y = v + s4;
        s4 = y + v;
        return y;
      }
      // Diode-style: the same solved loop, the feedback's lows taken out (a 1-pole tracker of the output, ~150 Hz at
      // 2x: the bass stays when the resonance is up), an asymmetric drive into the loop (even harmonics), the output a
      // blend of the third and fourth poles (a softer slope). (Soft-clipping the stage states killed the resonance.)
      const G2 = G * G;
      const b = 1 - G;
      hpS += 0.0107 * (y4 - hpS);
      const sigma = G2 * G * b * s1 + G2 * b * s2 + G * b * s3 + b * s4;
      let u = (x - k * (sigma - hpS)) / (1 + k * G2 * G2);
      u = sat(1.2 * u + 0.12) - 0.1194;
      let v = (u - s1) * G;
      let y = v + s1;
      s1 = y + v;
      v = (y - s2) * G;
      y = v + s2;
      s2 = y + v;
      v = (y - s3) * G;
      y = v + s3;
      s3 = y + v;
      const y3 = y;
      v = (y - s4) * G;
      y = v + s4;
      s4 = y + v;
      y4 = y;
      return 0.35 * y3 + 0.65 * y;
    }
    return {
      /** One input sample at the base rate; G for the doubled rate. */
      run(x: number, G: number, k: number): number {
        const a = step(0.5 * (prev + x), G, k);
        const b = step(x, G, k);
        prev = x;
        return 0.5 * (a + b);
      },
    };
  }

  /** A zero-delay state-variable lowpass (2-pole), for the morph voice and the samplers. */
  function svf() {
    let ic1 = 0;
    let ic2 = 0;
    return {
      run(x: number, g: number, k: number): number {
        const a1 = 1 / (1 + g * (g + k));
        const a2 = g * a1;
        const a3 = g * a2;
        const v3 = x - ic2;
        const v1 = a1 * ic1 + a2 * v3;
        const v2 = ic2 + a2 * ic1 + a3 * v3;
        ic1 = 2 * v1 - ic1;
        ic2 = 2 * v2 - ic2;
        return v2;
      },
    };
  }

  /** Runs per-note renderers until they all finish, then reports done (after MAX_SEC at the latest). */
  function voiceOf(sr: number, notes: { L: number; R: number; tick(): number; done(): boolean }[], gain: number): V2Voice {
    const maxN = Math.round(MAX_SEC * sr);
    let n = 0;
    let finished = false;
    return {
      render(L, R, off, count) {
        for (let i = 0; i < off; i++) {
          L[i] = 0;
          R[i] = 0;
        }
        if (finished) {
          for (let i = off; i < off + count; i++) {
            L[i] = 0;
            R[i] = 0;
          }
          return false;
        }
        for (let i = off; i < off + count; i++) {
          let l = 0;
          let r = 0;
          for (let k = 0; k < notes.length; k++) {
            const m = notes[k].tick();
            l += m * notes[k].L;
            r += m * notes[k].R;
          }
          // The hard stop at MAX_SEC fades over the last 256 samples, so it lands on 0 too.
          const tail = maxN - n;
          const g = tail < 256 ? (gain * Math.max(0, tail)) / 256 : gain;
          L[i] = l * g;
          R[i] = r * g;
          n++;
        }
        let all = true;
        for (const x of notes) if (!x.done()) all = false;
        if (all || n >= maxN) finished = true;
        return !finished;
      },
    };
  }

  /** Glide: the frequency ratio at sample n for a glide from `from` Hz into `f` over `glide` s. */
  function glider(ev: V2Event, f: number, sr: number, first: boolean) {
    if (!first || !(ev.from > 0) || ev.from === f || !(ev.glide > 0)) return () => 1;
    const ratio = ev.from / f;
    const N = Math.max(1, Math.round(ev.glide * sr));
    let n = 0;
    return () => {
      if (n >= N) return 1;
      const x = n++ / N;
      return Math.pow(ratio, 1 - x * (2 - x));
    };
  }

  // ---- analog -------------------------------------------------------------------------------------------------

  /**
   * Analog voice (bass and pads): per note `unison` copies of a polyBLEP saw / pulse blend (the pulse width swung
   * slowly), each from its own seeded phase and detuned across `detune` cents, each drifting on its own; a sine sub
   * an octave down; into a ladder or diode filter (2x oversampled, saturating) with its own envelope; an amp ADSR.
   * `stereo` 1: the copies alternate left and right through two filters (pads); 0: one filter, mono (bass).
   */
  function analog(ev: V2Event, sr: number): V2Voice {
    const p = ev.p;
    const rand = rng(ev.seed);
    const v = clamp(ev.vel, 0, 1.2);
    const vb = clamp(ev.alive.velBright, 0, 1);
    const uni = clamp(Math.round(p.unison ?? 2), 1, 4);
    const stereo = (p.stereo ?? 0) > 0;
    const k = clamp((p.res ?? 0.2) * 4, 0, 3.95);
    const comp = 1 + 0.55 * k;
    const notes = ev.notes.map((midi, ni) => {
      const f = mtof(midi);
      const glide = glider(ev, f, sr, ni === 0);
      const va = vary(rand, ev);
      const amp = adsr(sr, (p.a ?? 0.005) * va * (1.25 - 0.45 * vb * Math.min(1, v)), (p.d ?? 0.3) * vary(rand, ev), p.s ?? 0.6, (p.r ?? 0.2) * vary(rand, ev), ev.hold);
      const fenv = adsr(sr, (p.fa ?? 0.003) * va, (p.fd ?? 0.25) * vary(rand, ev), p.fs ?? 0, (p.r ?? 0.2) * 1.2, ev.hold);
      const oscs = Array.from({ length: uni }, (_, u) => ({
        ph: rand(),
        pw: rand(),
        cents: uni > 1 ? (p.detune ?? 12) * (u / (uni - 1) - 0.5) : 0,
        drift: wanderer(rand, ev.alive.driftRate * (0.7 + 0.6 * rand()), sr),
        side: stereo ? u % 2 : 0,
      }));
      let subPh = rand();
      const wander = wanderer(rand, 0.12 + 0.1 * rand(), sr);
      const fl = [ladder(p.filter ?? "ladder"), ladder(p.filter ?? "ladder")];
      // Cutoff: key tracking, velocity (brighter and a deeper envelope when hit hard), the envelope in octaves.
      const track = Math.pow(f / 261.63, clamp(p.track ?? 0.3, 0, 1));
      const velOct = vb * (v - 0.7) * 1.6;
      const base = (p.cutoff ?? 800) * track * Math.pow(2, velOct);
      const envOct = (p.env ?? 2) * (0.6 + 0.4 * Math.min(1, v) * (0.5 + vb));
      const drive = 1 + (p.drive ?? 0.5);
      const wave = clamp(p.wave ?? 0, 0, 1);
      const sub = p.sub ?? 0;
      const pwm = clamp(p.pwm ?? 0.15, 0, 0.45);
      const [pl, pr] = panGains(notePan(ev, ni, ev.notes.length));
      let G = gOf(base, 2 * sr);
      let c = 0;
      const note = {
        L: pl,
        R: pr,
        right: 0,
        tick(): number {
          const gl = glide();
          let a = 0;
          let b = 0;
          for (const o of oscs) {
            const fr = f * gl * Math.pow(2, (o.cents + ev.alive.drift * o.drift()) / 1200);
            const dt = fr / sr;
            o.ph += dt;
            if (o.ph >= 1) o.ph -= 1;
            let s = 2 * o.ph - 1 - blep(o.ph, dt);
            if (wave > 0) {
              o.pw += 0.25 / sr;
              if (o.pw >= 1) o.pw -= 1;
              const w = 0.5 + pwm * Math.sin(TAU * o.pw);
              let q = o.ph < w ? 1 : -1;
              q += blep(o.ph, dt);
              const t2 = o.ph - w + (o.ph < w ? 1 : 0);
              q -= blep(t2, dt);
              s = (1 - wave) * s + wave * q;
            }
            if (o.side) b += s;
            else a += s;
          }
          if (sub > 0) {
            subPh += (f * gl) / (2 * sr);
            if (subPh >= 1) subPh -= 1;
            const ss = sub * Math.sin(TAU * subPh) * uni * 0.5;
            a += ss;
            if (stereo) b += ss;
          }
          const scale = (stereo ? 2 : 1) / uni;
          // The cutoff moves every 16 samples (the envelope, the slow random wander).
          const fe = fenv.next();
          const wn = wander();
          if ((c++ & 15) === 0) G = gOf(base * Math.pow(2, envOct * fe + 0.6 * ev.alive.wander * wn), 2 * sr);
          const e = amp.next();
          const outL = fl[0].run(a * scale * drive * comp * 0.5, G, k) / drive;
          // Stereo (pads): the right copies through their own filter; mono (bass): one filter, both sides.
          const outR = stereo ? fl[1].run(b * scale * drive * comp * 0.5, G, k) / drive : outL;
          note.right = outR * e;
          return outL * e;
        },
        done: () => amp.done,
      };
      return note;
    });
    return stereoVoice(sr, notes, ev.gain * 0.5 * (p.level ?? 1));
  }

  /** Like voiceOf, for notes that return their left sample from tick() and their right from `right`. */
  function stereoVoice(sr: number, notes: { L: number; R: number; tick(): number; right: number; done(): boolean }[], gain: number): V2Voice {
    const maxN = Math.round(MAX_SEC * sr);
    let n = 0;
    let finished = false;
    return {
      render(L, R, off, count) {
        for (let i = 0; i < off; i++) {
          L[i] = 0;
          R[i] = 0;
        }
        if (finished) {
          for (let i = off; i < off + count; i++) {
            L[i] = 0;
            R[i] = 0;
          }
          return false;
        }
        for (let i = off; i < off + count; i++) {
          let l = 0;
          let r = 0;
          for (let k = 0; k < notes.length; k++) {
            const x = notes[k];
            const ml = x.tick();
            l += ml * x.L;
            r += x.right * x.R;
          }
          const tail = maxN - n;
          const g = tail < 256 ? (gain * Math.max(0, tail)) / 256 : gain;
          L[i] = l * g;
          R[i] = r * g;
          n++;
        }
        let all = true;
        for (const x of notes) if (!x.done()) all = false;
        if (all || n >= maxN) finished = true;
        return !finished;
      },
    };
  }

  // ---- fm -----------------------------------------------------------------------------------------------------

  /**
   * 4-operator FM (phase modulation, DX7-style). Algorithms: "pairs" (4>3, 2>1; carriers 1 and 3: the E.PIANO
   * shape), "stack" (4>3>2>1: basses, brass), "fan" (2, 3, 4 > 1: organ-ish stabs, bells). Operator 4 feeds back
   * on itself (`fb`). Each operator: ratio, detune (cents), level (a carrier's amplitude, a modulator's index in
   * radians), its own ADSR, velocity sensitivity and key scaling (the index falls for high notes). The alive layer
   * drifts each note's pitch (all operators together, so integer ratios stay in tune) and wanders the indices.
   * `chorus` (cents): the carriers again for the right side, detuned down by that much.
   */
  function fm(ev: V2Event, sr: number): V2Voice {
    const p = ev.p;
    const rand = rng(ev.seed);
    const v = clamp(ev.vel, 0, 1.2);
    const vb = clamp(ev.alive.velBright, 0, 1);
    const algo: string = p.algo ?? "pairs";
    const ops: any[] = p.ops ?? [];
    const fbAmt = clamp(p.fb ?? 0, 0, 1) * 1.6;
    const chorus = p.chorus ?? 0;
    const notes = ev.notes.map((midi, ni) => {
      const f = mtof(midi);
      const glide = glider(ev, f, sr, ni === 0);
      const va = vary(rand, ev);
      const vd = vary(rand, ev);
      const O = [0, 1, 2, 3].map((i) => {
        const o = ops[i] ?? { ratio: 1, level: 0 };
        const vs = clamp(o.vel ?? 0.5, 0, 1);
        const velScale = 1 - vs + vs * Math.pow(Math.min(1, v), 1.4) * (0.7 + 0.6 * vb);
        const keyScale = Math.pow(261.63 / f, clamp(o.key ?? 0, 0, 1));
        return {
          ratio: (o.ratio ?? 1) * Math.pow(2, (o.detune ?? 0) / 1200),
          level: (o.level ?? 0) * velScale * keyScale,
          env: adsr(sr, (o.a ?? 0.002) * va, (o.d ?? 0.5) * vd, o.s ?? 0.5, (o.r ?? 0.2) * vd, ev.hold),
          ph: 0,
          ph2: 0,
          out: 0,
          out2: 0,
        };
      });
      const drift = wanderer(rand, ev.alive.driftRate * (0.7 + 0.6 * rand()), sr);
      const wander = wanderer(rand, 0.15 + 0.1 * rand(), sr);
      const [pl, pr] = panGains(notePan(ev, ni, ev.notes.length));
      const cD = Math.pow(2, -chorus / 1200);
      let fbPrev = 0;
      let fbPrev2 = 0;
      let right = 0;
      let c = 0;
      let wnd = 1;
      const carriers = algo === "pairs" ? [0, 2] : [0];
      const note = {
        L: pl,
        R: pr,
        right: 0,
        tick(): number {
          const fr = f * glide() * Math.pow(2, (ev.alive.drift * drift()) / 1200);
          if ((c++ & 15) === 0) wnd = Math.pow(2, 0.8 * ev.alive.wander * wander());
          else wander();
          const e0 = O[0].env.next();
          const e1 = O[1].env.next();
          const e2 = O[2].env.next();
          const e3 = O[3].env.next();
          // Phases.
          for (let i = 0; i < 4; i++) {
            const o = O[i];
            o.ph += (fr * o.ratio) / sr;
            if (o.ph >= 1) o.ph -= 1;
          }
          // Operator 4 with feedback (the mean of its last two outputs, as the DX7 does).
          const o3 = O[3];
          const m3 = Math.sin(TAU * o3.ph + fbAmt * 0.5 * (fbPrev + fbPrev2)) * o3.level * e3 * wnd;
          fbPrev2 = fbPrev;
          fbPrev = m3;
          let out = 0;
          if (algo === "stack") {
            const m2 = Math.sin(TAU * O[2].ph + m3) * O[2].level * e2 * wnd;
            const m1 = Math.sin(TAU * O[1].ph + m2) * O[1].level * e1 * wnd;
            out = Math.sin(TAU * O[0].ph + m1) * O[0].level * e0;
            right = out;
            if (chorus > 0) {
              O[0].ph2 += (fr * O[0].ratio * cD) / sr;
              if (O[0].ph2 >= 1) O[0].ph2 -= 1;
              right = Math.sin(TAU * O[0].ph2 + m1) * O[0].level * e0;
            }
          } else if (algo === "fan") {
            const m1 = Math.sin(TAU * O[1].ph) * O[1].level * e1 * wnd;
            const m2 = Math.sin(TAU * O[2].ph) * O[2].level * e2 * wnd;
            out = Math.sin(TAU * O[0].ph + m1 + m2 + m3) * O[0].level * e0;
            right = out;
            if (chorus > 0) {
              O[0].ph2 += (fr * O[0].ratio * cD) / sr;
              if (O[0].ph2 >= 1) O[0].ph2 -= 1;
              right = Math.sin(TAU * O[0].ph2 + m1 + m2 + m3) * O[0].level * e0;
            }
          } else {
            // pairs: 2 > 1 (the body), 4 > 3 (the tine / bark).
            const m1 = Math.sin(TAU * O[1].ph) * O[1].level * e1 * wnd;
            const a = Math.sin(TAU * O[0].ph + m1) * O[0].level * e0;
            const b = Math.sin(TAU * O[2].ph + m3) * O[2].level * e2;
            out = a + b;
            right = out;
            if (chorus > 0) {
              O[0].ph2 += (fr * O[0].ratio * cD) / sr;
              if (O[0].ph2 >= 1) O[0].ph2 -= 1;
              O[2].ph2 += (fr * O[2].ratio * cD) / sr;
              if (O[2].ph2 >= 1) O[2].ph2 -= 1;
              right = Math.sin(TAU * O[0].ph2 + m1) * O[0].level * e0 + Math.sin(TAU * O[2].ph2 + m3) * O[2].level * e2;
            }
          }
          note.right = right;
          return out;
        },
        done: () => carriers.every((i) => O[i].env.done),
      };
      return note;
    });
    return stereoVoice(sr, notes, ev.gain * 0.35 * (p.level ?? 1));
  }

  // ---- modal (Rhodes, mallets) --------------------------------------------------------------------------------

  /**
   * Modal voice: a hammer (a half-sine force, shorter and stronger with velocity, so a hard hit excites the high
   * modes) drives a bank of resonators (each mode a decaying complex rotation: exact frequency, its own T60).
   *   Rhodes: the tine's fundamental, the tonebar a few cents off it (the slow beating of the tuning fork), the
   *   tine's inharmonic cantilever modes (x 6.27, x 17.55) gone in tens of ms (the "ding" of the attack, never a
   *   ring), and the pickup: the tine moves in the pickup's field and the output is the field's change, a nonlinear
   *   function of the displacement (offset = the voicing; the louder the note the more harmonics: the bark).
   *   Mallet: tuned bar modes (x 1, 4, 10 for a marimba: in tune with the chord), no pickup, a wooden thump.
   * The damper: at the gate every mode's decay drops to `damp` s.
   */
  function modal(ev: V2Event, sr: number): V2Voice {
    const p = ev.p;
    const rand = rng(ev.seed);
    const v = clamp(ev.vel, 0, 1.2);
    const vb = clamp(ev.alive.velBright, 0, 1);
    const modes: number[][] = p.modes ?? [[1, 1, 3]];
    const pickup = clamp(p.pickup ?? 0, 0, 1);
    const offset = p.offset ?? 0.4;
    const nyq = sr * 0.45;
    const notes = ev.notes.map((midi, ni) => {
      const f = mtof(midi);
      const drift = wanderer(rand, ev.alive.driftRate * (0.7 + 0.6 * rand()), sr);
      const decayVar = vary(rand, ev);
      // Hammer: contact time 2.6 ms (soft) .. 0.5 ms (hard), seeded +-8%.
      const hard = clamp((p.hammer ?? 0.5) * (0.4 + 0.6 * Math.min(1, v) * (0.6 + 0.8 * vb)), 0, 1);
      const contact = Math.max(4, Math.round((0.0026 - 0.0021 * hard) * sr * (0.92 + 0.16 * rand())));
      const force = Math.pow(Math.min(1.2, v), 1.3);
      const pitchScale = Math.pow(261.63 / f, 0.5);
      const bank = modes
        .filter((m) => f * m[0] < nyq)
        .map((m) => {
          const fr = f * m[0] * Math.pow(2, ((m[3] ?? 0) + (rand() - 0.5) * 0.6) / 1200);
          const t60 = Math.max(0.005, m[2] * (m[0] < 1.5 ? pitchScale * decayVar : 1));
          return { w: (TAU * fr) / sr, r: Math.exp(-6.9 / (t60 * sr)), amp: m[1], re: 0, im: 0, c: Math.cos((TAU * fr) / sr), s: Math.sin((TAU * fr) / sr) };
        });
      const dampR = Math.exp(-6.9 / (Math.max(0.02, p.damp ?? 0.25) * sr));
      const gate = Math.max(1, Math.round(ev.hold * sr));
      const [pl, pr] = panGains(notePan(ev, ni, ev.notes.length));
      // Tone: a one-pole lowpass opening with velocity.
      const bright = (p.bright ?? 4000) * Math.pow(2, vb * (Math.min(1, v) - 0.7) * 1.8);
      const lpA = 1 - Math.exp((-TAU * clamp(bright, 200, nyq)) / sr);
      const thump = (p.thump ?? 0) * force;
      const thumpLen = Math.round(0.012 * sr);
      const thumpLp = 1 - Math.exp((-TAU * 900) / sr);
      const phi0 = 1 / (offset * offset + 1);
      const drivePU = 0.8 + 6 * pickup;
      let n = 0;
      let lp = 0;
      let th = 0;
      let dc = 0;
      let dcIn = 0;
      let silent = 0;
      let rel = false;
      const note = {
        L: pl,
        R: pr,
        right: 0,
        tick(): number {
          // Drift: a few cents, applied as a tiny rotation change every 32 samples.
          if ((n & 31) === 0) {
            const d = Math.pow(2, (ev.alive.drift * drift()) / 1200);
            for (const m of bank) {
              m.c = Math.cos(m.w * d);
              m.s = Math.sin(m.w * d);
            }
          } else drift();
          if (!rel && n >= gate) {
            rel = true;
            for (const m of bank) m.r = Math.min(m.r, dampR);
          }
          const x = n < contact ? force * Math.sin((Math.PI * n) / contact) * 0.02 : 0;
          let disp = 0;
          for (const m of bank) {
            const re = m.r * (m.c * m.re - m.s * m.im) + x * m.amp;
            const im = m.r * (m.s * m.re + m.c * m.im);
            m.re = re;
            m.im = im;
            disp += im;
          }
          disp *= 6 / Math.max(1, contact * 0.12);
          let y: number;
          if (pickup > 0) {
            // Pickup: the field ~ 1 / ((x + offset)^2 + 1); the output its deviation from rest (DC removed below).
            const z = disp * drivePU + offset;
            const phi = 1 / (z * z + 1);
            y = ((phi0 - phi) / drivePU) * 1.4;
          } else y = disp;
          // DC blocker (the pickup's offset).
          dc = y - dcIn + 0.9995 * dc;
          dcIn = y;
          y = dc;
          if (thump > 0 && n < thumpLen) {
            const env = 1 - n / thumpLen;
            th += thumpLp * ((rand() * 2 - 1) * env * env - th);
            y += th * thump * 0.6;
          }
          lp += lpA * (y - lp);
          n++;
          // Done when released and quiet for 2048 samples (the resonators decay exponentially; the last bit is
          // faded below the hard floor so the event ends on 0).
          if (rel && Math.abs(lp) < 1e-5) silent++;
          else silent = 0;
          const out = silent > 0 ? lp * Math.max(0, 1 - silent / 2048) : lp;
          note.right = out;
          return out;
        },
        done: () => rel && silent >= 2048,
      };
      return note;
    });
    return stereoVoice(sr, notes, ev.gain * (p.level ?? 1));
  }

  // ---- pluck (Karplus-Strong waveguide) -----------------------------------------------------------------------

  /**
   * Karplus-Strong / waveguide pluck: a delay line one period long (a first-order allpass for the fraction, the
   * loop filter's half-sample counted), a seeded noise burst shaped by the pick (a lowpass that opens with velocity,
   * a comb at the pick position), a loop filter blending brightness and a loss for the decay; at the gate the
   * string is damped. A small body resonance under it.
   */
  function pluck(ev: V2Event, sr: number): V2Voice {
    const p = ev.p;
    const rand = rng(ev.seed);
    const v = clamp(ev.vel, 0, 1.2);
    const vb = clamp(ev.alive.velBright, 0, 1);
    const notes = ev.notes.map((midi, ni) => {
      const f = mtof(midi) * Math.pow(2, (ev.alive.drift * (rand() - 0.5)) / 1200);
      const period = sr / f;
      const loopDelay = period - 0.5;
      const N = Math.floor(loopDelay) - 1;
      const frac = loopDelay - N;
      const C = (1 - frac) / (1 + frac);
      const size = N + 4;
      const buf = new Float32Array(size);
      // Excitation: noise through the pick's lowpass, minus itself delayed by the pick position.
      const bright = clamp((p.bright ?? 0.5) + vb * (Math.min(1, v) - 0.7) * 0.6, 0.05, 1);
      const a = 1 - Math.exp((-TAU * (300 + 9000 * bright * bright)) / sr);
      const exc = new Float32Array(N);
      let s = 0;
      for (let i = 0; i < N; i++) {
        s += a * (rand() * 2 - 1 - s);
        exc[i] = s;
      }
      const pos = Math.max(1, Math.round(clamp(p.position ?? 0.2, 0.02, 0.5) * N));
      for (let i = N - 1; i >= pos; i--) exc[i] -= exc[i - pos];
      let peak = 1e-6;
      for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(exc[i]));
      for (let i = 0; i < N; i++) buf[i] = (exc[i] / peak) * Math.min(1.1, v);
      const t60 = (p.decay ?? 2) * vary(rand, ev) * Math.pow(220 / f, 0.35);
      let loss = Math.pow(10, -3 / (t60 * f));
      const dampLoss = Math.pow(10, -3 / (Math.max(0.03, p.damp ?? 0.12) * f));
      const blend = clamp(p.tone ?? 0.5, 0, 1);
      const gate = Math.max(1, Math.round(ev.hold * sr));
      const [pl, pr] = panGains(notePan(ev, ni, ev.notes.length));
      const bodyW = (TAU * (p.body ?? 180)) / sr;
      const bodyR = Math.exp(-6.9 / (0.05 * sr));
      const bc = Math.cos(bodyW);
      const bs = Math.sin(bodyW);
      let bre = 0;
      let bim = 0;
      let w = 0;
      let last = 0;
      let x1 = 0;
      let y1 = 0;
      let n = 0;
      let silent = 0;
      const note = {
        L: pl,
        R: pr,
        right: 0,
        tick(): number {
          if (n === gate) loss = Math.min(loss, dampLoss);
          const r = (w + 1) % size;
          const cur = buf[r];
          // Loop filter: blend of the sample and the two-point mean (the tone), times the loss.
          const filt = loss * (blend * cur + (1 - blend) * 0.5 * (cur + last));
          last = cur;
          // Fractional delay: first-order allpass.
          const ap = C * filt + x1 - C * y1;
          x1 = filt;
          y1 = ap;
          buf[(w + N) % size] = ap;
          w = r;
          const re = bodyR * (bc * bre - bs * bim) + cur * 0.02;
          const im = bodyR * (bs * bre + bc * bim);
          bre = re;
          bim = im;
          let out = cur + im * (p.bodyLevel ?? 0.5);
          n++;
          if (n > gate && Math.abs(cur) < 1e-5) silent++;
          else silent = 0;
          if (silent > 0) out *= Math.max(0, 1 - silent / 1024);
          note.right = out;
          return out;
        },
        done: () => silent >= 1024,
      };
      return note;
    });
    return stereoVoice(sr, notes, ev.gain * 0.5 * (p.level ?? 1));
  }

  // ---- morph (wavetable) --------------------------------------------------------------------------------------

  const TABLE = 1024;
  const FRAMES = 8;
  const LEVELS = 9;
  let bank: Float32Array[][] | null = null;
  /**
   * The morph bank: 8 frames from a dark, nearly sine "flute" (frame 0) through a hollow reed-free "vowel" (a soft
   * formant peak walking up the harmonics) to a full, warm saw-like spectrum (frame 7); each frame band-limited at 9
   * octave levels (256 .. 1 harmonics). Built once per worklet scope (a pure function: same tables every time).
   */
  function morphBank(): Float32Array[][] {
    if (bank) return bank;
    bank = [];
    for (let fr = 0; fr < FRAMES; fr++) {
      const pos = fr / (FRAMES - 1);
      const levels: Float32Array[] = [];
      for (let lv = 0; lv < LEVELS; lv++) {
        const H = 256 >> lv;
        const t = new Float32Array(TABLE + 1);
        for (let h = 1; h <= H; h++) {
          const tilt = Math.pow(h, -(1 + 1.6 * (1 - pos)));
          const peakAt = 2 + 9 * pos;
          const width = 1.2 + 2.5 * pos;
          const formant = 1 + 2.2 * pos * Math.exp(-((h - peakAt) * (h - peakAt)) / (2 * width * width));
          // Even harmonics a little weaker in the middle frames (hollow), never zero (no square, no reed).
          const even = h % 2 === 0 ? 1 - 0.35 * Math.sin(Math.PI * pos) : 1;
          const amp = tilt * formant * even;
          if (amp < 1e-5) continue;
          const c = Math.cos((TAU * h) / TABLE);
          const s = Math.sin((TAU * h) / TABLE);
          let re = 1;
          let im = 0;
          for (let i = 0; i < TABLE; i++) {
            t[i] += amp * im;
            const nr = re * c - im * s;
            im = re * s + im * c;
            re = nr;
          }
        }
        let peak = 1e-9;
        for (let i = 0; i < TABLE; i++) peak = Math.max(peak, Math.abs(t[i]));
        for (let i = 0; i < TABLE; i++) t[i] /= peak;
        t[TABLE] = t[0];
        levels.push(t);
      }
      bank.push(levels);
    }
    return bank;
  }

  /**
   * Morph (wavetable) voice: two detuned copies per note reading the morph bank, the frame position moving inside
   * the note (its own envelope from `pos` by `posEnv`, a slow LFO, the seeded wander, velocity), into a 2-pole
   * zero-delay lowpass; copies left and right.
   */
  function morph(ev: V2Event, sr: number): V2Voice {
    const p = ev.p;
    const B = morphBank();
    const rand = rng(ev.seed);
    const v = clamp(ev.vel, 0, 1.2);
    const vb = clamp(ev.alive.velBright, 0, 1);
    const notes = ev.notes.map((midi, ni) => {
      const f = mtof(midi);
      const glide = glider(ev, f, sr, ni === 0);
      const hmax = (sr * 0.45) / f;
      let lv = 0;
      while (lv < LEVELS - 1 && 256 >> lv > hmax) lv++;
      const va = vary(rand, ev);
      const amp = adsr(sr, (p.a ?? 0.3) * va, (p.d ?? 1) * vary(rand, ev), p.s ?? 0.8, (p.r ?? 0.6) * vary(rand, ev), ev.hold);
      const penv = adsr(sr, (p.pa ?? 0.6) * va, (p.pd ?? 1.5), p.ps ?? 0.4, (p.r ?? 0.6), ev.hold);
      const cps = [0, 1].map((side) => ({
        ph: rand(),
        cents: (side ? 1 : -1) * (p.detune ?? 8) * 0.5,
        drift: wanderer(rand, ev.alive.driftRate * (0.7 + 0.6 * rand()), sr),
      }));
      const wander = wanderer(rand, 0.1 + 0.1 * rand(), sr);
      let lfoPh = rand();
      const lfoInc = (p.lfo ?? 0.15) / sr;
      const pos0 = clamp((p.pos ?? 0.2) + vb * (Math.min(1, v) - 0.7) * 0.4, 0, 1);
      const posEnv = p.posEnv ?? 0.5;
      const filt = [svf(), svf()];
      const cutoff = (p.cutoff ?? 3000) * Math.pow(2, vb * (Math.min(1, v) - 0.7));
      const kq = 2 - 2 * clamp(p.res ?? 0.2, 0, 0.9);
      const g = Math.tan((Math.PI * clamp(cutoff, 40, sr * 0.45)) / sr);
      const [pl, pr] = panGains(notePan(ev, ni, ev.notes.length));
      const note = {
        L: pl,
        R: pr,
        right: 0,
        tick(): number {
          const pe = penv.next();
          lfoPh += lfoInc;
          if (lfoPh >= 1) lfoPh -= 1;
          const pos = clamp(pos0 + posEnv * pe + (p.lfoDepth ?? 0.15) * Math.sin(TAU * lfoPh) + 0.25 * ev.alive.wander * wander(), 0, 1);
          const fi = pos * (FRAMES - 1);
          const i0 = Math.min(FRAMES - 2, Math.floor(fi));
          const fx = fi - i0;
          const t0 = B[i0][lv];
          const t1 = B[i0 + 1][lv];
          const gl = glide();
          const e = amp.next();
          const outs = [0, 0];
          for (let s = 0; s < 2; s++) {
            const cp = cps[s];
            cp.ph += (f * gl * Math.pow(2, (cp.cents + ev.alive.drift * cp.drift()) / 1200)) / sr;
            if (cp.ph >= 1) cp.ph -= 1;
            const x = cp.ph * TABLE;
            const j = x | 0;
            const jf = x - j;
            const a = t0[j] + (t0[j + 1] - t0[j]) * jf;
            const b = t1[j] + (t1[j + 1] - t1[j]) * jf;
            outs[s] = filt[s].run(a + (b - a) * fx, g, kq) * e;
          }
          note.right = outs[1];
          return outs[0];
        },
        done: () => amp.done,
      };
      return note;
    });
    return stereoVoice(sr, notes, ev.gain * 0.4 * (p.level ?? 1));
  }

  // ---- chop (the resampling sampler) --------------------------------------------------------------------------

  const sources = new Map<string, { L: Float32Array; R: Float32Array; rate: number }>();
  /**
   * The chop source: the chord rendered once, offline, from the v2 voices (an FM e-piano with its bark, a warm
   * analog saw layer through the ladder, a quiet morph pad), then "sampled": an anti-alias lowpass, the sampler's
   * own rate (`rate` Hz, held: a real rate reduction) and its bits. Cached by its key (a pure function of it).
   */
  function chopSource(ev: V2Event, sr: number) {
    const p = ev.p;
    const rate = clamp(p.rate ?? 26040, 8000, sr);
    const bits = clamp(Math.round(p.bits ?? 12), 6, 16);
    const notes = (p.chord as number[]).map((x) => x + (p.root ?? 57));
    const key = [notes.join(","), rate, bits, sr, p.source ?? "keys"].join("|");
    const hit = sources.get(key);
    if (hit) return hit;
    const base = { notes, vel: 0.95, hold: 0.9, seed: 0x5eed1 + notes.reduce((a, b) => a * 31 + b, 7), gain: 1, pan: 0, width: 0.7, from: 0, glide: 0 };
    const still = { drift: 2, driftRate: 0.3, wander: 0, envVar: 0, velBright: 0.6 };
    const parts: V2Event[] = [
      { ...base, kind: "fm", alive: still, p: { level: 1, algo: "pairs", chorus: 5, ops: [
        { ratio: 1, level: 1, a: 0.002, d: 1.2, s: 0.35, r: 0.3 },
        { ratio: 1, level: 1.6, a: 0.001, d: 0.5, s: 0.15, r: 0.3, vel: 0.8 },
        { ratio: 1, level: 0.35, a: 0.001, d: 0.25, s: 0, r: 0.2 },
        { ratio: 14, level: 2.2, a: 0.001, d: 0.04, s: 0, r: 0.05, vel: 0.9 },
      ] } },
      { ...base, kind: "analog", alive: still, p: { level: 0.9, unison: 2, detune: 14, wave: 0, sub: 0, filter: "ladder", cutoff: 900, res: 0.25, env: 1.6, fa: 0.003, fd: 0.35, fs: 0.2, track: 0.3, drive: 0.8, a: 0.003, d: 0.6, s: 0.5, r: 0.25, stereo: 1 } },
    ];
    const len = Math.round(1.4 * sr);
    const L = new Float32Array(len);
    const R = new Float32Array(len);
    for (const part of parts) {
      const out = renderEvent(part, sr, 1.4);
      for (let i = 0; i < Math.min(len, out.L.length); i++) {
        L[i] += out.L[i];
        R[i] += out.R[i];
      }
    }
    // Sample it: lowpass at 0.42 x rate (2 x 2-pole), hold at the sampler's rate, quantise.
    const sLen = Math.floor((len * rate) / sr);
    const outL = new Float32Array(sLen + 2);
    const outR = new Float32Array(sLen + 2);
    const g = Math.tan((Math.PI * Math.min(0.42 * rate, 0.45 * sr)) / sr);
    const q = Math.pow(2, bits - 1);
    let peak = 1e-9;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    const norm = 0.8 / peak;
    for (const [src, dst] of [[L, outL], [R, outR]] as const) {
      const f1 = svf();
      const f2 = svf();
      const tmp = new Float32Array(len);
      for (let i = 0; i < len; i++) tmp[i] = f2.run(f1.run(src[i] * norm, g, 1.85), g, 0.77);
      for (let j = 0; j < sLen; j++) {
        const x = tmp[Math.floor((j * sr) / rate)];
        dst[j] = Math.round(x * q) / q;
      }
    }
    const made = { L: outL, R: outR, rate };
    sources.set(key, made);
    return made;
  }

  /**
   * Chop voice: plays the sampled chord from `start` s, repitched by `semi` semitones the sampler way (faster
   * playback: shorter and brighter, the pitch and time move together), with drop-sample (`interp` 0: the gritty
   * S950 / SP-1200 read) or linear reading, a short gate envelope and a reconstruction lowpass that closes with
   * lower velocity.
   */
  function chop(ev: V2Event, sr: number): V2Voice {
    const p = ev.p;
    const src: V2ChopSource = p.src ?? chopSource(ev, sr);
    const rand = rng(ev.seed);
    const v = clamp(ev.vel, 0, 1.2);
    const vb = clamp(ev.alive.velBright, 0, 1);
    const inc = (src.rate / sr) * Math.pow(2, (p.semi ?? 0) / 12);
    // A seeded nudge of the chop point (a hand-cut sample is never cut at the same place twice).
    let pos = Math.max(0, ((p.start ?? 0) + (rand() - 0.5) * 0.004 * ev.alive.envVar) * src.rate);
    const end = src.L.length - 2;
    const amp = adsr(sr, p.a ?? 0.0015, p.d ?? 0.4, p.s ?? 0.85, (p.r ?? 0.05) * vary(rand, ev), ev.hold);
    const lpHz = (p.lp ?? 9000) * Math.pow(2, vb * (Math.min(1, v) - 0.8) * 1.5);
    const g = Math.tan((Math.PI * clamp(lpHz, 200, sr * 0.45)) / sr);
    const fl = svf();
    const fr = svf();
    const interp = (p.interp ?? 0) > 0;
    const [pl, pr] = panGains(ev.pan);
    const level = Math.pow(Math.min(1.2, v), 0.8);
    let over = 0;
    const note = {
      L: pl,
      R: pr,
      right: 0,
      tick(): number {
        const e = amp.next();
        let l = 0;
        let r = 0;
        if (pos < end) {
          const j = pos | 0;
          if (interp) {
            const x = pos - j;
            l = src.L[j] + (src.L[j + 1] - src.L[j]) * x;
            r = src.R[j] + (src.R[j + 1] - src.R[j]) * x;
          } else {
            l = src.L[j];
            r = src.R[j];
          }
          pos += inc;
        }
        // Past the end of the sample: a 64-sample fade to exactly 0, then done (a sampler voice ends with its sample).
        const tail = pos < end ? 1 : Math.max(0, 1 - over++ / 64);
        const ol = fl.run(l, g, 1.4) * e * level * tail;
        note.right = fr.run(r, g, 1.4) * e * level * tail;
        return ol;
      },
      done: () => amp.done || over >= 64,
    };
    return stereoVoice(sr, [note], ev.gain * (p.level ?? 1));
  }

  // ---- entry points -------------------------------------------------------------------------------------------

  function createVoice(ev: V2Event, sr: number): V2Voice {
    switch (ev.kind) {
      case "analog":
        return analog(ev, sr);
      case "fm":
        return fm(ev, sr);
      case "modal":
        return modal(ev, sr);
      case "pluck":
        return pluck(ev, sr);
      case "morph":
        return morph(ev, sr);
      case "chop":
        return chop(ev, sr);
      default:
        return voiceOf(sr, [], 0);
    }
  }

  function renderEvent(ev: V2Event, sr: number, maxSec = MAX_SEC): { L: Float32Array; R: Float32Array } {
    const voice = createVoice(ev, sr);
    const total = Math.round(Math.min(maxSec, MAX_SEC) * sr);
    const L = new Float32Array(total);
    const R = new Float32Array(total);
    const bl = new Float32Array(128);
    const br = new Float32Array(128);
    let at = 0;
    while (at < total) {
      const n = Math.min(128, total - at);
      const alive = voice.render(bl, br, 0, n);
      L.set(bl.subarray(0, n), at);
      R.set(br.subarray(0, n), at);
      at += n;
      if (!alive) return { L: L.slice(0, at), R: R.slice(0, at) };
    }
    return { L, R };
  }

  return { createVoice, renderEvent, chopSource };
}
