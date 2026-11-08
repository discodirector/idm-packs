import { hash32 } from "../../hash.ts";
import { LIQUID_VOICES } from "../presets.ts";
import type { LibraryVoice, Source, VoiceCategory, VoiceHost, VoiceNote } from "../types.ts";
import { center, midiExact, notesOf } from "../util.ts";
import { renderVoice, type LiquidVoiceKind } from "./index.ts";

// Liquid DnB v7 (tag liquid-dnb-v7-approved, 6d4564b) in the library. index.ts is the pack's packages/synth/src/voices.ts
// as it is (the construction-kits branch keeps it at this path): sample-free instrument models rendered per note (or per
// chord) in plain JS into stereo buffers. The library plays them exactly as the pack's engine did (engine.ts
// liquidVoice): velocity quantised to 1/20, the length to the ms, the same seed and cache key, the buffer through one
// gain (the spec's level) and the opt-in presence bell, straight into the bus (stereo, unity).

/** A liquid voice's params: the pack's LiquidVoiceSpec without its role's octave (the caller places the notes). */
export interface LiquidParams {
  kind: LiquidVoiceKind;
  /** The voice's gain 0..2 (the spec's `level`). */
  level: number;
  /** 0..1, its brightness (filter, mallet, pick, breath; default 0.5). */
  bright?: number;
  /** A presence bell at 2.4 kHz on this voice, dB 0..6 (0: none). */
  presence?: number;
  /** The glass pad: its FM strike's level 0..1 and ratio (2.76 inharmonic by default; an integer keeps it harmonic). */
  strike?: number;
  strikeRatio?: number;
}

/** One note (or chord) of a liquid voice, as engine.ts liquidVoice played it. */
export function playLiquid(h: VoiceHost, n: VoiceNote, v: LiquidParams) {
  const ctx = h.ctx;
  const t = n.time;
  const sr = ctx.sampleRate;
  const midis = notesOf(n);
  const q = Math.round(Math.max(0.05, Math.min(1, n.vel)) * 20) / 20;
  const dur = Math.max(0.03, Math.round(n.length * 1000) / 1000);
  const prev = n.from !== undefined ? midiExact(n.from) : undefined;
  // The vibes' motor phase at the note's start, to 1/8 (engine.ts: free-running at 5.2 Hz).
  const phase = v.kind === "vibes" ? Math.floor(((((t * 5.2) % 1) + 1) % 1) * 8) / 8 : 0;
  const bright = v.bright ?? 0.5;
  const strike = v.strike;
  const sk = strike !== undefined || v.strikeRatio !== undefined ? `:${strike ?? ""}:${v.strikeRatio ?? ""}` : "";
  const key = `liquid:${v.kind}:${midis.join(",")}:${q}:${dur}:${bright}:${prev ?? ""}:${phase}:${sr}${sk}`;
  const buf = h.buffer(key, () => {
    const o = renderVoice(v.kind, {
      midi: midis, dur, vel: q, sr, seed: hash32(midis.length, ...midis, Math.round(q * 20), Math.round(dur * 1000), 0x701c), bright, prev, phase,
      ...(strike !== undefined ? { strike } : {}),
      ...(v.strikeRatio !== undefined ? { strikeRatio: v.strikeRatio } : {}),
    });
    const b = ctx.createBuffer(2, o.L.length, sr);
    b.getChannelData(0).set(o.L);
    b.getChannelData(1).set(o.R);
    return b;
  });
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = v.level;
  src.connect(g);
  const nodes: AudioNode[] = [g];
  let tail: AudioNode = g;
  if (v.presence) {
    const pk = ctx.createBiquadFilter();
    pk.type = "peaking";
    pk.frequency.value = 2400;
    pk.Q.value = 0.8;
    pk.gain.value = v.presence;
    tail.connect(pk);
    nodes.push(pk);
    tail = pk;
  }
  nodes.push(...center(h, tail));
  h.play([src as Source], nodes, t, t + buf.duration + 0.02);
}

const SPECS = LIQUID_VOICES as unknown as Readonly<Record<string, LiquidParams & { oct?: number; strikeBars?: number }>>;

/** The pack's settings for `kinds`, by `<style>.<role>` (the role's octave and the drop-phrase strike rule left out). */
function presetsOf(kinds: readonly LiquidVoiceKind[]): Record<string, Partial<LiquidParams>> {
  const out: Record<string, Partial<LiquidParams>> = {};
  for (const [name, spec] of Object.entries(SPECS)) {
    if (!kinds.includes(spec.kind)) continue;
    const { oct: _o, strikeBars: _s, ...rest } = spec;
    out[name] = rest;
  }
  return out;
}

interface Def {
  id: string;
  kinds: readonly LiquidVoiceKind[];
  category: VoiceCategory;
  register: readonly [number, number];
  doc: string;
  rules: readonly string[];
  caution?: string;
  chordal?: boolean;
}

const DEFS: readonly Def[] = [
  { id: "rhodesTine", kinds: ["rhodes"], category: "keys", register: [43, 79], chordal: true, doc: "Liquid's tine Rhodes: a cantilever tine (its fundamental + the 6.27x mode) read through a nonlinear electromagnetic pickup (harder = more bark), a damper, a stereo suitcase autopan. Rendered per chord.", rules: ["Comp with a wide velocity range: the bark is in the velocity."] },
  { id: "wurli", kinds: ["wurli"], category: "keys", register: [48, 79], chordal: true, doc: "Liquid's Wurlitzer: a decaying reed read through an asymmetric electrostatic pickup (a strong 2nd harmonic, nasal), a preamp band, an amplitude tremolo.", rules: ["Nasal by design: in soul / neo-soul comps, not in dark styles."], caution: "reedy (a nasal reed by design): not in dark styles" },
  { id: "junoStab", kinds: ["stab"], category: "keys", register: [48, 76], chordal: true, doc: "Liquid's Juno DCO stab: PWM pulse + saw + sub square through a 4-pole ladder with a fast envelope, the BBD chorus II. Short chord stabs.", rules: ["Short stabs only (a sustained pulse reads as an organ)."] },
  { id: "tonewheel", kinds: ["organ"], category: "keys", register: [48, 79], chordal: true, doc: "Liquid's tonewheel organ: drawbar sines (16', 8', 4', 2 2/3'), key click, a slow Leslie (drum and horn rotors into two mics).", rules: ["An organ by design."], caution: "organ-like by design (the owner: no organ tones); kept for completeness and fidelity" },
  { id: "vibes", kinds: ["vibes"], category: "bells", register: [53, 89], doc: "Liquid's vibraphone: three bar modes tuned 1:4:10 with their own decays (harmonic: in tune with the chord), a yarn-mallet strike, the motor's tremolo.", rules: ["Chord tones; the modes are harmonic, so it never clashes."] },
  { id: "liquidBell", kinds: ["bell"], category: "bells", register: [60, 96], doc: "Liquid's FM bell (DX7 soft bell): a 1:1 body pair and a 3.5:1 inharmonic pair whose index falls fast (a glassy strike melting into a round tone), long key-tracked decays, a lowpass so no partial rings as a ting.", rules: ["Inharmonic strike: sparse melodies only, never sustained under a chord change (use `fmBell` tuned or `v2Bell` for chord tones)."], caution: "inharmonic 3.5:1 strike: sparse melodies only, not on chord tones" },
  { id: "jazzGuitar", kinds: ["guitar"], category: "plucks", register: [40, 76], doc: "Liquid's Karplus-Strong guitar (Jaffe-Smith extended): a fractional-delay string loop, a pluck at a pick position, two hollow-body resonances, a neck-pickup lowpass.", rules: ["Warm and dark: answers and comps under the beat."] },
  { id: "harp", kinds: ["harp"], category: "plucks", register: [43, 91], doc: "Liquid's harp: a plucked string model with a soft finger and a long, dark ring.", rules: ["Arpeggios on chord tones."] },
  { id: "junoPad", kinds: ["juno"], category: "pads", register: [48, 76], chordal: true, doc: "Liquid's Juno-106 pad (a chord voice): PWM pulse + saw + sub square, a highpass, a 4-pole ladder with a slow envelope, chorus I+II (one BBD line swept by a triangle, wet + left, wet - right).", rules: ["Keep it under the keys: a slow envelope and a closed ladder."] },
  { id: "jpStrings", kinds: ["supersaw"], category: "pads", register: [48, 76], chordal: true, doc: "Liquid's JP-8000 supersaw strings (a chord voice): seven polyBLEP saws per note at Szabo's detune offsets, random phases, the pitch-tracking highpass, alternate saws left and right, a slow attack.", rules: ["A string bed, not a lead: slow attack, under the keys."] },
  { id: "glassPad", kinds: ["glass"], category: "pads", register: [48, 76], chordal: true, doc: "Liquid's glass pad (D-50 linear arithmetic, a chord voice): a short FM strike over two detuned saws through a 4-pole ladder, a breath band at 2f, the Juno chorus I for width.", rules: ["The default strike is inharmonic (2.76): set `strikeRatio` to an integer (or `strike` 0) on chords that change."] },
  { id: "stringMachine", kinds: ["ensemble"], category: "strings", register: [48, 79], chordal: true, doc: "Liquid's string machine (Solina, a chord voice): saw 8' + 4' through a formant band into a three-phase BBD ensemble (three delay lines swept by a 0.6 Hz + 6 Hz pair 120 degrees apart, fully wet).", rules: ["Highpass it under the bass; slow attack."] },
  { id: "liquidChoir", kinds: ["choir", "ooh"], category: "choirs", register: [48, 76], chordal: true, doc: "Liquid's formant choir (a chord voice): per note four singers, each a band-limited glottal wavetable with its own vibrato, jitter and aspiration, through a five-formant bank, morphing \"oo\" -> \"aah\" (`ooh`: the reverse, darker).", rules: ["`ooh` in the darker styles."] },
  { id: "soloVoice", kinds: ["voice"], category: "choirs", register: [55, 79], doc: "Liquid's solo formant singer (\"aah\" -> \"oh\") with a soft double, portamento and a delayed vibrato.", rules: ["One line, sparse: a voice, not a synth lead."] },
  { id: "altoHum", kinds: ["alto"], category: "choirs", register: [53, 74], doc: "Liquid's alto hum: a formant alto on \"ooh\" opening to \"oh\", a soft double, slow portamento, a late vibrato.", rules: ["Low and soft: the hum under a breakdown."] },
  { id: "flute", kinds: ["flute"], category: "leads", register: [60, 93], doc: "Liquid's additive flute: a near-sine with weak harmonics, breath noise in bands at f and 2f, a chiff on the attack, delayed vibrato, portamento.", rules: ["Sparse melodies; it is bright by nature: under ~2 kHz fundamentals in dark styles."] },
  { id: "panFlute", kinds: ["pan"], category: "leads", register: [60, 88], doc: "Liquid's pan flute (\"wind\"): a breathy near-sine whose noise is pitched (narrow bands at f and 2f), a soft chiff, light vibrato.", rules: ["Answers and calls, not a constant lead."] },
  { id: "sax", kinds: ["sax"], category: "leads", register: [49, 81], doc: "Liquid's waveshaped alto sax: an asymmetric tanh whose drive follows the breath envelope (louder = brighter), three body formants, breath noise, vibrato.", rules: ["A reed by design: soul and jazz styles only."], caution: "reedy by design: never in dark styles" },
  { id: "fmTrumpet", kinds: ["trumpet"], category: "brass", register: [52, 82], doc: "Liquid's Chowning FM trumpet: the index follows the amplitude envelope (brass brightens as it swells), a pitch scoop, a harmon mute.", rules: ["Muted solos and short calls."] },
  { id: "reese", kinds: ["reese"], category: "bass", register: [24, 48], doc: "Liquid's reese: three polyBLEP saws whose detune itself drifts, a driven 4-pole ladder, highpassed over the pack's sub.", rules: ["Over a separate sub: it is the mid layer."] },
  { id: "moogBass", kinds: ["moog"], category: "bass", register: [24, 48], doc: "Liquid's ladder bass: two saws and a square an octave down, a resonant 4-pole ladder with a plucked filter envelope.", rules: ["Plucked envelope for moving lines; glide from `n.from`."] },
  { id: "upright", kinds: ["upright"], category: "bass", register: [28, 52], doc: "Liquid's Karplus-Strong upright bass: a thumb pluck, a dark loop, a body resonance.", rules: ["Walking lines in the soulful styles."] },
];

export const LIQUID_VOICE_ENTRIES: readonly LibraryVoice[] = DEFS.map((d) => {
  const presets = presetsOf(d.kinds);
  const own: LiquidParams = { kind: d.kinds[0], level: 1, bright: 0.5 };
  const names = Object.keys(presets);
  // Kinds no style played yet get a neutral preset per kind.
  for (const k of d.kinds) if (!names.some((n) => presets[n].kind === k)) presets[`library.${k}`] = { kind: k, level: 1, bright: 0.5 };
  const preferred = Object.keys(presets).find((n) => presets[n].kind === d.kinds[0]) ?? Object.keys(presets)[0];
  return {
    id: d.id, category: d.category, source: ["liquid-dnb-v7"], register: d.register, doc: d.doc, rules: d.rules,
    ...(d.caution ? { caution: d.caution } : {}), ...(d.chordal ? { chordal: true } : {}),
    defaults: { ...own, ...presets[preferred] } as LiquidParams, presets, preferred,
    play: playLiquid,
  } satisfies LibraryVoice<LiquidParams>;
});
