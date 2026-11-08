/**
 * Layered house drums. Every hit is 2-3 layers with their own roles (body / attack / air); the noisy and metallic
 * ones are rendered once in plain JS (seeded) and replayed, the tonal ones are oscillators.
 *   kick     body: a sine falling 165 -> 48 Hz (the sub thump, ~350 ms); knock: a 2nd sine falling 260 -> 120 Hz
 *            through a tanh (the punch a laptop speaker hears, ~70 ms); click: a 4 ms rendered transient (filtered noise
 *            and a 3 kHz blip). Mono.
 *   clap     a rendered clap (four noise bursts 8-11 ms apart through a 1.1 kHz bandpass, the last with a 180 ms
 *            tail, a different seed per channel: wide) over a snare body (two drum modes, 185 and 330 Hz, ~70 ms) and
 *            the snare wires (highpassed noise ~150 ms): the layered house clap+snare.
 *   shaker   a rendered shaker (bandpassed noise at 6.5 kHz with a soft 8 ms attack, two grains "ch-k"), 16ths.
 *   ride     a rendered ride (eight inharmonic partials 380..5200 Hz decaying ~1.4 s over a noise wash), bell-ish.
 *   crash    a rendered crash (dense inharmonic partials and highpassed noise, ~2.6 s), wide.
 *   conga    an FM-free tom: a sine falling a fifth in 30 ms, ~160 ms, plus a slap of bandpassed noise; high/low.
 *   tom      a disco tom: a sine settling down ~5 semitones over its 250 ms (the 70s disco fill, short of a zap).
 */
import { clamp, type BusIn, type VoiceHost } from "./host.ts";
import { Biquad, cached, finish, mulberry32 } from "./render.ts";

function renderClick(sr: number): Float32Array[] {
  const n = Math.round(0.012 * sr);
  const out = new Float32Array(n);
  const rnd = mulberry32(0xc11c);
  const bp = new Biquad(sr, "bp", 4500, 0.8);
  for (let i = 0; i < n; i++) {
    const e = Math.exp(-i / (0.0018 * sr));
    out[i] = bp.run(rnd() * 2 - 1) * e * 1.5 + Math.sin((2 * Math.PI * 3000 * i) / sr) * Math.exp(-i / (0.001 * sr));
  }
  return finish([out], sr, 0.9, 2);
}

function renderClap(sr: number, tail: number): Float32Array[] {
  const n = Math.round((0.05 + tail * 1.4) * sr);
  const chans: Float32Array[] = [];
  for (let ch = 0; ch < 2; ch++) {
    const out = new Float32Array(n);
    const rnd = mulberry32(0xc1a9 + ch * 77);
    const bp = new Biquad(sr, "bp", 1100 + ch * 90, 1.4);
    const hp = new Biquad(sr, "hp", 600, 0.7);
    const starts = [0, 0.009 + ch * 0.001, 0.019, 0.03 + ch * 0.0015].map((s) => Math.round(s * sr));
    for (let i = 0; i < n; i++) {
      let e = 0;
      starts.forEach((s, k) => {
        if (i < s) return;
        const d = (i - s) / sr;
        e += k === 3 ? Math.exp(-d / tail) : Math.exp(-d / 0.0045) * (0.8 + 0.1 * k);
      });
      out[i] = hp.run(bp.run(rnd() * 2 - 1)) * e;
    }
    chans.push(out);
  }
  return finish(chans, sr, 0.9, 6);
}

function renderShaker(sr: number, accent: boolean): Float32Array[] {
  const n = Math.round(0.09 * sr);
  const out = new Float32Array(n);
  const rnd = mulberry32(accent ? 0x5a4 : 0x5a5);
  const bp = new Biquad(sr, "bp", 6500, 1.1);
  const hp = new Biquad(sr, "hp", 3500, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // Two grains: the beads hitting the front, then the back.
    const g1 = Math.min(1, t / 0.008) * Math.exp(-Math.max(0, t - 0.008) / 0.02);
    const g2 = t > 0.028 ? 0.45 * Math.min(1, (t - 0.028) / 0.004) * Math.exp(-(t - 0.032) / 0.015) : 0;
    out[i] = hp.run(bp.run(rnd() * 2 - 1)) * (g1 + (accent ? g2 : g2 * 0.5));
  }
  return finish([out], sr, 0.9, 5);
}

function renderMetal(sr: number, kind: "ride" | "crash"): Float32Array[] {
  // A cymbal: dozens of inharmonic partials spread log-uniformly over the 2.5..12 kHz shimmer band (each its own
  // decay, the higher ones shorter), a few low "bell" modes (the ride's ping), and a highpassed noise wash; through a
  // soft tanh. Seeded, a different set per channel: wide.
  const dur = kind === "ride" ? 1.6 : 2.8;
  const n = Math.round(dur * sr);
  const chans: Float32Array[] = [];
  const P = kind === "ride" ? 28 : 40;
  for (let ch = 0; ch < 2; ch++) {
    const out = new Float32Array(n);
    const rnd = mulberry32((kind === "ride" ? 0x51de : 0xc4a5) + ch * 31);
    const parts: [number, number, number, number][] = [];
    for (let k = 0; k < P; k++) {
      const f = 2500 * (12000 / 2500) ** rnd();
      parts.push([f, rnd() * Math.PI * 2, 0.5 + 0.5 * rnd(), dur * (0.18 + 0.3 * rnd()) * (4000 / f) ** 0.4]);
    }
    if (kind === "ride") for (const f of [610, 1480, 2290]) parts.push([f * (1 + (rnd() - 0.5) * 0.01), rnd() * 6, 1.6, dur * 0.35]);
    const hp = new Biquad(sr, "hp", kind === "ride" ? 5000 : 3000, 0.6);
    const lp = new Biquad(sr, "lp", 13000, 0.6);
    for (const [f, ph, a, tau] of parts) {
      const w = (2 * Math.PI * f) / sr;
      const c = Math.cos(w);
      const si = Math.sin(w);
      let re = Math.cos(ph);
      let im = Math.sin(ph);
      let e = a / P;
      const d = Math.exp(-1 / (tau * sr));
      for (let i = 0; i < n && e > 1e-6; i++) {
        out[i] += im * e;
        const r2 = re * c - im * si;
        im = re * si + im * c;
        re = r2;
        e *= d;
      }
    }
    const washTau = dur * (kind === "ride" ? 0.25 : 0.32);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const wash = lp.run(hp.run(rnd() * 2 - 1)) * (kind === "ride" ? 0.12 : 0.3) * Math.exp(-t / washTau) * Math.min(1, t / 0.002);
      out[i] = Math.tanh(1.5 * (out[i] * (kind === "ride" ? 3 : 2.5) + wash));
    }
    chans.push(out);
  }
  return finish(chans, sr, 0.9, 30);
}

function oneShot(h: VoiceHost, buffer: AudioBuffer, t: number, peak: number, pan: number | null, bus: BusIn, rate = 1) {
  const src = h.ctx.createBufferSource();
  src.buffer = buffer;
  if (rate !== 1) src.playbackRate.value = rate;
  const amp = h.ctx.createGain();
  amp.gain.value = peak;
  src.connect(amp);
  const end = t + buffer.duration / rate;
  if (pan === null) {
    bus.add(amp);
    src.start(t);
    h.end(src, [amp], end + 0.02);
  } else {
    const p = h.pan(pan, bus);
    p.add(amp);
    src.start(t);
    h.end(src, [amp, p.dest], end + 0.02);
  }
}

/** A falling sine at `t`: `f0` -> `f1` Hz over `sweep` s, peak `peak`, decay `decay` s, through a tanh at `drive`. */
function sweptSine(h: VoiceHost, t: number, f0: number, f1: number, sweep: number, decay: number, peak: number, drive: number, pan: number, bus: BusIn) {
  const ctx = h.ctx;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + sweep);
  const rest: AudioNode[] = [];
  const node = h.drive(osc, drive, rest);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(peak, t + 0.0015);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  amp.gain.setValueAtTime(0, t + decay);
  node.connect(amp);
  const p = h.pan(pan, bus);
  p.add(amp);
  rest.push(amp, p.dest);
  osc.start(t);
  h.end(osc, rest, t + decay + 0.03);
}

export interface KickOptions {
  /** Body (sub thump), knock (punch), click (attack) levels 0..1.5. */
  body: number;
  knock: number;
  click: number;
  /** Body length s. */
  decay: number;
}

/** The layered house kick at `t`, `vel` 0..1, into `bus`. */
export function layeredKick(h: VoiceHost, t: number, vel: number, o: KickOptions, bus: BusIn) {
  const v = clamp(vel, 0, 1.2);
  if (o.body > 0) sweptSine(h, t, 165, 48, 0.045, o.decay, 0.55 * o.body * v, 0.6, 0, bus);
  if (o.knock > 0) sweptSine(h, t, 260, 120, 0.03, 0.075, 0.3 * o.knock * v, 2.2, 0, bus);
  if (o.click > 0) oneShot(h, cached(h.ctx, "dr:click", renderClick), t, 0.12 * o.click * v, 0, bus);
}

/** The layered clap + snare at `t`: rendered clap (`clap`), snare body (`body`), snare wires (`wires`), `tail` s. */
export function layeredClap(h: VoiceHost, t: number, vel: number, clap: number, body: number, wires: number, tail: number, bus: BusIn) {
  const v = clamp(vel, 0, 1.2);
  const tq = Math.round(clamp(tail, 0.06, 0.5) * 50) / 50;
  if (clap > 0) oneShot(h, cached(h.ctx, `dr:clap:${tq}`, (sr) => renderClap(sr, tq)), t, 0.32 * clap * v, null, bus);
  if (body > 0) {
    sweptSine(h, t, 210, 185, 0.02, 0.08, 0.16 * body * v, 0.8, 0, bus);
    sweptSine(h, t, 345, 330, 0.02, 0.05, 0.08 * body * v, 0.5, 0, bus);
  }
  if (wires > 0) {
    const ctx = h.ctx;
    const n = ctx.createBufferSource();
    n.buffer = h.noise();
    n.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3200;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.09 * wires * v, t + 0.002);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    amp.gain.setValueAtTime(0, t + 0.16);
    n.connect(hp);
    hp.connect(amp);
    const p = h.pan(0.1, bus);
    p.add(amp);
    n.start(t);
    h.end(n, [hp, amp, p.dest], t + 0.2);
  }
}

export function shaker(h: VoiceHost, t: number, vel: number, accent: boolean, pan: number, bus: BusIn) {
  oneShot(h, cached(h.ctx, `dr:shk:${accent}`, (sr) => renderShaker(sr, accent)), t, 0.11 * clamp(vel, 0, 1.2), pan, bus);
}

/**
 * A noise ride: no fixed partials at all (a metal ride re-struck every off-8th holds its partials as a ringing chord),
 * a band of seeded noise (highpass 4.5 kHz, a broad peak at 8 kHz) with a 2 ms stick tick, decaying ~250 ms into a
 * quiet wash; four seeds, so consecutive hits never repeat the same grain. Stereo, a seed per channel.
 */
function renderNoiseRide(sr: number, variant: number): Float32Array[] {
  const n = Math.round(0.9 * sr);
  const chans: Float32Array[] = [];
  for (let ch = 0; ch < 2; ch++) {
    const out = new Float32Array(n);
    const rnd = mulberry32(0x41de + variant * 97 + ch * 13);
    const hp = new Biquad(sr, "hp", 4500, 0.6);
    const hp2 = new Biquad(sr, "hp", 4500, 0.6);
    const pk = new Biquad(sr, "peak", 8000, 0.5, 4);
    const lp = new Biquad(sr, "lp", 14000, 0.6);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = Math.min(1, t / 0.0008) * (0.8 * Math.exp(-t / 0.09) + 0.2 * Math.exp(-t / 0.3));
      const tick = t < 0.002 ? 1.5 * (1 - t / 0.002) : 0;
      out[i] = lp.run(pk.run(hp2.run(hp.run(rnd() * 2 - 1)))) * (env + tick);
    }
    chans.push(out);
  }
  return finish(chans, sr, 0.9, 30);
}

/** The noise ride at `t` (`variant` 0..3 picks the grain). */
export function noiseRide(h: VoiceHost, t: number, vel: number, variant: number, bus: BusIn) {
  const v = ((variant % 4) + 4) % 4;
  oneShot(h, cached(h.ctx, `dr:nride:${v}`, (sr) => renderNoiseRide(sr, v)), t, 0.07 * clamp(vel, 0, 1.2), null, bus);
}

export function ride(h: VoiceHost, t: number, vel: number, bus: BusIn) {
  oneShot(h, cached(h.ctx, "dr:ride", (sr) => renderMetal(sr, "ride")), t, 0.06 * clamp(vel, 0, 1.2), null, bus);
}

export function crash(h: VoiceHost, t: number, vel: number, bus: BusIn) {
  oneShot(h, cached(h.ctx, "dr:crash", (sr) => renderMetal(sr, "crash")), t, 0.1 * clamp(vel, 0, 1.2), null, bus);
}

/** A conga (`high` the quinto) at `t`; `slap` 0..1 adds the open slap. */
export function conga(h: VoiceHost, t: number, vel: number, high: boolean, slap: number, pan: number, bus: BusIn) {
  const f = high ? 330 : 220;
  sweptSine(h, t, f * 1.5, f, 0.03, 0.17, 0.2 * clamp(vel, 0, 1.2), 0.4, pan, bus);
  if (slap > 0) {
    const ctx = h.ctx;
    const n = ctx.createBufferSource();
    n.buffer = h.noise();
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = high ? 2400 : 1800;
    bp.Q.value = 1.5;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.12 * slap * vel, t + 0.001);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    amp.gain.setValueAtTime(0, t + 0.03);
    n.connect(bp);
    bp.connect(amp);
    const p = h.pan(pan, bus);
    p.add(amp);
    n.start(t);
    h.end(n, [bp, amp, p.dest], t + 0.05);
  }
}

/** A disco tom at `f` Hz: falling a fourth-ish (x 0.74) over 250 ms (a tom, not a zap). */
export function discoTom(h: VoiceHost, t: number, vel: number, f: number, pan: number, bus: BusIn) {
  sweptSine(h, t, f, f / 1.35, 0.25, 0.28, 0.22 * clamp(vel, 0, 1.2), 0.9, pan, bus);
}
