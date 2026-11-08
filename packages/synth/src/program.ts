import { ERA_SCHEDULE, IMD_ETH_ERA_SCHEDULE, type EpochPages, type EraScheduleEntry } from "./eras.ts";
import { IMD_ETH_STYLE_SCHEDULE, STYLE_SCHEDULE, type StyleScheduleEntry } from "./styles.ts";

/**
 * A program: what a station plays (docs/STATIONS.md "Program"). Both halves of the musical history in one value:
 *   - `eras`: which genres, in which order (ERA_SCHEDULE shape; a station names a subset of the genres);
 *   - `styles`: which styles per genre (STYLE_SCHEDULE shape; a station's lists, covering at least its genres).
 * eraOf / styleOf / stylesAt and everything that renders (clock, player, engine, release) take an optional program,
 * default HOUSE_PROGRAM, and one render passes the same program all the way down.
 *
 * Frozen like the house schedules once a station is on air: append-only. Caches key on the schedule arrays, so
 * build a program once and reuse the object (fresh copies of the arrays recompute the genre walk from epoch 0).
 *
 * eras.ts and styles.ts import only the type: they default to their own schedules when no program is passed, which
 * is the same thing as HOUSE_PROGRAM, and this module (which needs both schedules) stays out of an import cycle.
 */
export interface Program {
  /** "idm" (house), "imd-eth", "<station>". A label: nothing is cached by it. */
  key: string;
  eras: readonly EraScheduleEntry[];
  styles: readonly StyleScheduleEntry[];
  /** A station whose epochs are not 4 pages long from some page on (eras.ts epochOf). Absent: 4 pages, as ever. */
  epochPages?: EpochPages;
  /**
   * A new engine every epoch, whatever the genre (Era.eachEpoch for a whole program): a station's genre can last
   * many epochs (one genre and ten styles), and its listeners must still hear each epoch's style without a reload.
   * Absent (the house programs): an engine lives while its genre lasts.
   */
  eachEpoch?: boolean;
}

/** The $IDM station's schedules (FROZEN_SHA256 unchanged for the launch walk). IMD/ETH played them until its epoch 11. */
export const HOUSE_PROGRAM: Program = { key: "idm", eras: ERA_SCHEDULE, styles: STYLE_SCHEDULE };

/**
 * The IMD/ETH station (registry program "imd-eth"): the house walk until its epoch 11, then Ambient Dub alone. Its pool
 * writes about a page a day, so from page 44 (epoch 11, playing on 2026-11-02) an epoch, and with it a style, is one
 * page instead of four (owner): page 45 is epoch 12. Pages before 44 keep their epochs.
 */
export const IMD_ETH_PROGRAM: Program = {
  key: "imd-eth",
  eras: IMD_ETH_ERA_SCHEDULE,
  styles: IMD_ETH_STYLE_SCHEDULE,
  epochPages: { from: 44, every: 1 },
};
