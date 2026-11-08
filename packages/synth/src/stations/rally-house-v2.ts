import type { StationPack } from "../pack.ts";
import type { UkgV2Spec } from "../styledata.ts";
import rallyHouse from "./rally-house.ts";

/**
 * Synth v2 lab (docs/sound/SYNTH-V2.md): Rally House v1 with the same styles, figures, form and mix, and the tonal
 * voices of two styles moved to the Synth v2 voices (`ukg.v2`). The A/B demo renders this pack (B) against
 * rally-house.ts (A): the same epochs, so the same patterns and arrangement, note for note. On no station.
 *   One More Lap: the Rhodes comping -> the physical Rhodes (hammer, tine, tonebar, pickup); the finger bass -> the
 *     ladder bass; the breakdown's sine organ bed -> the analog pad; the short stab hits of the build, drop and
 *     rebuild -> the resampled chord chop.
 *   Select: the sine M1 organ stabs -> the FM organ stab; the organ bass -> a dark ladder bass; the Juno bed -> the
 *     analog pad.
 * Drums, the sub and the diva are untouched (the owner's rule for this round: tonal voices only).
 */
export const RALLY_V2: Record<string, UkgV2Spec> = {
  "rally-one-more-lap": {
    keys: { level: 1, voice: "rhodes" },
    bass: { level: 1, voice: "ladderBass", p: { cutoff: 520, fd: 0.22, res: 0.3 } },
    pad: { level: 1, voice: "analogPad", p: { cutoff: 700 } },
    chop: { level: 1, voice: "chop", max: 1.5, in: ["build", "full", "rebuild"] },
  },
  "rally-select": {
    organ: { level: 1, voice: "fmOrgan" },
    bass: { level: 1, voice: "ladderBass", p: { cutoff: 220, res: 0.25, env: 1.8, wave: 0.1 } },
    pad: { level: 1, voice: "analogPad" },
  },
};

const styles = rallyHouse.styles.futuregarage!.map((style) => {
  const v2 = RALLY_V2[style.id];
  if (!v2) return style;
  const data = style.data as { ukg: Record<string, unknown> };
  return { ...style, data: { ...data, ukg: { ...data.ukg, v2 } } };
});

export default {
  ...rallyHouse,
  key: "rally-house-v2",
  name: "Rally House (Synth v2 lab)",
  styles: { futuregarage: styles },
} as StationPack;
