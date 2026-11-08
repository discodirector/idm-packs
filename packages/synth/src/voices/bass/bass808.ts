import type { Source, VoiceHost, VoiceNote } from "../types.ts";
import { center, tanhCurve } from "../util.ts";

/**
 * The hip-hop bass (Hip-Hop & Trap v3, engine.ts hipHopBass on sound/hiphop-trap, tag hiphop-trap-v3-approved), ported
 * value for value. "808": a sine or triangle with a pitch punch (or a glide from `n.from`), driven and lowpassed,
 * falling over `decay` and cut at the note's end. "synth": a saw and a square through an enveloped resonant lowpass
 * over a sine, all gliding together (the G-funk bass). Mono by composition: each note ends where the next begins.
 * The shape is the pack's `HipHopBassSpec`.
 */
export interface Bass808Params {
  mode: "808" | "synth";
  wave: "sine" | "triangle";
  level: number;
  decay: number;
  punch: number;
  punchTime: number;
  glide: number;
  drive: number;
  lp: number;
  cutoff: number;
  env: number;
  envTime: number;
  q: number;
  sub: number;
}

export function playBass808(h: VoiceHost, n: VoiceNote, b: Bass808Params) {
  const ctx = h.ctx;
  const time = n.time;
  const freq = n.freq;
  const vel = n.vel;
  const glided = n.from !== undefined;
  const end = time + Math.max(0.06, n.length);
  const pitch = (f: AudioParam, mult: number) => {
    if (glided) {
      f.setValueAtTime(n.from! * mult, time);
      f.exponentialRampToValueAtTime(freq * mult, time + b.glide);
    } else if (b.punch > 1) {
      f.setValueAtTime(freq * mult * b.punch, time);
      f.exponentialRampToValueAtTime(freq * mult, time + b.punchTime);
    } else f.setValueAtTime(freq * mult, time);
  };
  const amp = ctx.createGain();
  const peak = 0.22 * b.level * vel * (glided ? 0.9 : 1);
  const attack = glided ? 0.012 : 0.003;
  const cut = Math.max(time + attack + 0.005, end - 0.025);
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.linearRampToValueAtTime(peak, time + attack);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * Math.exp(-(cut - time - attack) / b.decay)), cut);
  amp.gain.linearRampToValueAtTime(0, end);
  const rest: AudioNode[] = [amp];
  const sources: Source[] = [];
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  rest.push(lp);
  if (b.mode === "synth") {
    lp.Q.value = b.q;
    const open = b.cutoff + b.env;
    lp.frequency.setValueAtTime(open, time);
    lp.frequency.exponentialRampToValueAtTime(b.cutoff, time + b.envTime);
    const mix = ctx.createGain();
    rest.push(mix);
    for (const [type, detune, level] of [["sawtooth", -6, 0.5], ["square", 6, 0.35]] as const) {
      const osc = ctx.createOscillator();
      osc.type = type;
      pitch(osc.frequency, 1);
      osc.detune.setValueAtTime(detune, time);
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g);
      g.connect(mix);
      rest.push(g);
      sources.push(osc);
    }
    mix.connect(lp);
    lp.connect(amp);
    if (b.sub > 0) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      pitch(osc.frequency, 1);
      const g = ctx.createGain();
      g.gain.value = b.sub;
      osc.connect(g);
      g.connect(amp);
      rest.push(g);
      sources.push(osc);
    }
  } else {
    lp.Q.value = 0.5;
    lp.frequency.value = b.lp;
    const osc = ctx.createOscillator();
    osc.type = b.wave;
    pitch(osc.frequency, 1);
    sources.push(osc);
    if (b.drive > 0) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = new Float32Array(tanhCurve(b.drive));
      shaper.oversample = "none";
      osc.connect(shaper);
      shaper.connect(lp);
      rest.push(shaper);
    } else osc.connect(lp);
    lp.connect(amp);
  }
  rest.push(...(n.pan === 0 ? center(h, amp) : h.out(amp, n.pan)));
  h.play(sources, rest, time, end + 0.03);
}
