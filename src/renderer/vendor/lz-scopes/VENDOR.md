# LZ Scopes (vendored)

Source: [larszu/lz-scopes](https://github.com/larszu/lz-scopes), `src/`, commit `19e159a` on `main`.
Licence: proprietary, free to use in Lars Zumpe's own projects (see `LICENSE` upstream).

| What | State |
|---|---|
| The import closure of `src/index.ts` upstream (24 files incl. `audio/`) | byte-identical, except the patches below |
| `renderer.ts`, `audio/dsp/signals.ts` | **patched**: one constructor parameter property each written out as a field. `tsconfig.app.json` requires `erasableSyntaxOnly`, and `tsc` checks imported files too — there is no per-folder exception. The patches live in `scripts/lz-scopes-vendor.mjs` (`PATCHES`) and are applied to upstream before comparing. |
| `public/patterns/lz-display/*.png` | the 20 LZ display test images (1080p, ~500 KB), copied from `public/patterns/lz-display/` upstream; `patterns.ts` loads them by relative URL |

Not vendored: the standalone app (`main.ts`, `dock.ts`, `output*.ts`, `face.ts`, …) and `server/`. The main-process side (ffmpeg, probe, frame splitting) lives in `src/main/services/streamScopeService.ts` and speaks the frame format of `docs/frame-protocol.md` upstream over a `MessagePort` instead of a WebSocket.

## Local rules

- Do not edit these files. German labels of upstream are replaced at runtime (`components/Scopes/ScopeMonitor.tsx`: `SCOPE_LABELS`; `lib/testPatternNames.ts`: pattern names), the 3 px panel radius and the panel chrome are overridden in `index.css`.
- `eslint.config.js` ignores this folder; `lang:check` does not flag it.
- Only `components/Scopes/` imports from here, behind `lazy()` (`tests/scopesLazyGrenze.test.ts`).

## Sync

```bash
npm run scopes:sync -- --upstream ../lz-scopes    # copies the closure, applies PATCHES, removes files no longer needed
npm run scopes:check -- --upstream ../lz-scopes   # what CI runs (job `scopes`) against larszu/lz-scopes@main
npx tsc -p tsconfig.app.json --noEmit && npm test && npm run build
```

Then enter the new commit above. If a patch no longer applies, the script says which one — adjust `PATCHES`, do not edit the copy by hand. Copy the PNGs again if upstream changed them.
