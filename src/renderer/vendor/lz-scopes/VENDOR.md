# LZ Scopes (vendored)

Source: [larszu/lz-scopes](https://github.com/larszu/lz-scopes), commit `1b62536dac6a932ebc71670b718849e7ec9c8caf` on `main` — the pin: `scopes:check` compares against exactly this commit, `scopes:sync` rewrites it.
Licence: proprietary, free to use in Lars Zumpe's own projects (see `LICENSE` upstream).

The folder mirrors the upstream repo root (`src/`, `server/`), because the closure leaves `src/`: `src/clock/tai.ts` imports `../../server/leap.mjs` (with `leap.d.mts`). Relative imports stay untouched that way. Hosts import from `vendor/lz-scopes/src`.

| What | State |
|---|---|
| The import closure of `src/index.ts` upstream (70 files, incl. `audio/`, `calib/`, `clock/`, `led/`, `server/*.mjs`) | byte-identical, plus one first line in every `.ts`/`.mts`: `// @ts-nocheck -- vendort …` |
| `public/patterns/lz-display/*.png` (repo `public/`) | the 20 LZ display test images (1080p, ~500 KB), copied from upstream `public/patterns/lz-display/`; `patterns.ts` loads them by relative URL |

Why `@ts-nocheck`: `tsconfig.app.json` requires `erasableSyntaxOnly` and `noUnusedParameters`, upstream does not, and `tsc` checks imported files too — there is no per-folder exception. Upstream type-checks its own code in its build. Until 2026-10-06 single patches bridged the gap; after 25 upstream commits the next sync needed eight new ones. The exported types stay intact; only diagnostics inside the copy are suppressed. The header is applied by `scripts/lz-scopes-vendor.mjs` on sync and on check. `PATCHES` there is empty and meant only for code that would not *run* here.

Not vendored: the standalone app (`main.ts`, `dock.ts`, `output*.ts`, `face.ts`, …) and the rest of `server/`. The main-process side (ffmpeg, probe, frame splitting) lives in `src/main/services/streamScopeService.ts` and speaks the frame format of `docs/frame-protocol.md` upstream over a `MessagePort` instead of a WebSocket.

## Local rules

- Do not edit these files. German labels of upstream are replaced at runtime (`components/Scopes/ScopeMonitor.tsx`: `SCOPE_LABELS`; `lib/testPatternNames.ts`: pattern names), the 3 px panel radius and the panel chrome are overridden in `index.css`.
- `eslint.config.js` ignores this folder; `lang:check` does not flag it.
- Only `components/Scopes/` imports from here, behind `lazy()` (`tests/scopesLazyGrenze.test.ts`).

## Sync

```bash
npm run scopes:sync -- --upstream ../lz-scopes    # closure of upstream HEAD (or --ref <commit>), applies PATCHES, removes stale files, sets the pin
npm run scopes:check -- --upstream ../lz-scopes   # what CI runs (job `scopes`): copy == pinned commit; notes how far upstream is ahead
npx tsc -p tsconfig.app.json --noEmit && npm test && npm run build
```

Why a pin and not upstream `main`: upstream gets several PRs a day, and a check against `main` turned every PR here red. Updating is a deliberate PR. The daily workflow `scopes-sync.yml` does the sync on the branch `chore/lz-scopes-sync`, runs the gates there and keeps one open issue „lz-scopes: Vendor nachziehen" with the result and a link that opens the PR; it closes the issue once the copy is current again. If a patch no longer applies, the script says which one — adjust `PATCHES`, do not edit the copy by hand. A new pattern upstream needs an English name in `lib/testPatternNames.ts` (the test says so). Copy the PNGs again if upstream changed them.
