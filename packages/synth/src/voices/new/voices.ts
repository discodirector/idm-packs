import type { VoiceHost, VoiceNote } from "../types.ts";
import { rng, type NoteEvent, type Params, type Rendered, type Renderer } from "./dsp/core.ts";

/** A library note as a renderer's event (`length` is the gate). */
export function eventOf(n: VoiceNote): NoteEvent {
  return { freq: n.freq, vel: n.vel, hold: Math.max(0.005, n.length), seed: n.seed | 0, pan: n.pan, bright: n.bright, from: n.from, chord: n.chord };
}

/** Renders one note of a new voice (Node or browser: the same samples). */
export function renderNote(render: Renderer, n: VoiceNote, p: Params, sr: number): Rendered {
  return render(eventOf(n), p, sr);
}

/**
 * Plays a rendered note through a library host: a mono render is panned with `out` (or centred with `center`: bass),
 * a stereo render goes out hard left and hard right (equal-power pan at -1 / +1 is unity on its side), so the voice's
 * own stereo image passes unchanged. One AudioBufferSourceNode per note; every node has at most two inputs.
 */
export function playRendered(h: VoiceHost, r: Rendered, time: number, pan: number, center: boolean) {
  const ctx = h.ctx;
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(r.R ? 2 : 1, r.L.length, sr);
  buf.getChannelData(0).set(r.L);
  if (r.R) buf.getChannelData(1).set(r.R);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  let nodes: AudioNode[];
  if (!r.R) nodes = center ? (h.center ? h.center(src) : h.out(src, 0)) : h.out(src, pan);
  else {
    const split = ctx.createChannelSplitter(2);
    const a = ctx.createGain();
    const b = ctx.createGain();
    src.connect(split);
    split.connect(a, 0);
    split.connect(b, 1);
    nodes = [split, a, b, ...h.out(a, -1), ...h.out(b, 1)];
  }
  h.play([src], nodes, time, time + r.L.length / sr);
}

/**
 * A library `play` for a renderer: renders the note on the calling thread at the host's sample rate and schedules it.
 * `p.timing` (ms) is seeded micro-timing: the note lands up to that much late (keys, plucks: the human feel).
 */
export function player(render: Renderer, center = false) {
  return (h: VoiceHost, n: VoiceNote, p: Params) => {
    const r = render(eventOf(n), p, h.ctx.sampleRate);
    const late = (p.timing ?? 0) > 0 ? (rng((n.seed | 0) ^ 0x5eed)() * p.timing) / 1000 : 0;
    playRendered(h, r, n.time + late, n.pan, center);
  };
}
