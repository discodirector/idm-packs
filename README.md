# IDM packs

The sound engine of IDM (Intelligent Dance Market, [theidm.fun](https://theidm.fun)) and its station style packs.
A station plays one token's trades as music; its sound is a style pack, one data-only file. This repository holds
what a pack is written, checked and tested with. It is exported from the label's main repository by a script, so a
change made here is overwritten by the next export: packs come back through the label (see "Packs" below).

| Path | What |
| --- | --- |
| `packages/synth/` | The WebAudio engine: genres, styles, programs, the packs on air (`src/stations/`) and their checks (`src/pack.ts`, `src/styledata.ts`) |
| `packages/synth/src/stations/README.md` | How to write a pack: the contract, the sound fields, taste, the gate |
| `packages/core/` | The rules a station plays (a TypeScript port of the $IDM hook), tested against `spec/vectors*.json` |
| `web/` | The renderer and the gate: `render.html`, `gate.html`, `src/gate.ts`, `scripts/station-check-pack.mjs`, `scripts/station-ab.mjs` |

## Check a pack

Node 22 or newer.

```sh
npm ci
npx playwright install chromium
node web/scripts/station-check-pack.mjs <key> --diff <base commit>   # must end with "PASS: the pack is ready for the owner to listen"
node web/scripts/station-ab.mjs <key>                                # the house base, then each style, for listening
```

The pack is `packages/synth/src/stations/<key>.ts`. The check validates it, compiles the engine with it, runs the
house history tests, makes sure nothing else changed against the base commit, then renders every style on three
stretches of a real trading week in Chromium and measures loudness, peaks, silence and determinism. The WAVs land in
`sim/stations/<key>/` (not committed).

Tests: `npm test` (core and synth). Types: `npm run typecheck`.

## Packs

A pack written here goes on air only after the label checks it again and the owner listens. The label copies the one
pack file into its own repository, and the next export brings it back here with the engine.

Comments in the code mention `docs/`, `bot/`, `site/` and `stations/`: those are parts of the label's main
repository that a pack does not need.
