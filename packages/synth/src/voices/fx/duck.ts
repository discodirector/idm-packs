/**
 * A kick sidechain on a bus (engine.ts duck): the gain dips to `depth` on each kick and ramps back to 1 over `release`
 * s. Hamster Dark Electro II v2 ducked its pads (0.6, 0.32 s) and bass (0.7) under the kick: the pads breathe with the
 * groove instead of sitting as a constant wash.
 */
export function sidechain(ctx: BaseAudioContext, depth: number, release: number): { node: GainNode; hit(time: number): void } {
  const node = ctx.createGain();
  return {
    node,
    hit(time: number) {
      if (depth >= 1) return;
      const g = node.gain;
      g.cancelScheduledValues(time);
      g.setValueAtTime(depth, time);
      g.linearRampToValueAtTime(1, time + release);
    },
  };
}
