#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// `dist/main/` bekommt eine eigene `package.json` mit `type: module`.
//
// WARUM ES DAS GIBT. Der Main-Prozess ist ESM (`tsconfig.main.json`, node16):
// `.js`-Dateien mit `import`/`export`. Node entscheidet das an der
// NAECHSTGELEGENEN `package.json` -- bisher war das die des Repos, und die
// sagt `type: module`.
//
// Im PAKET gilt das nicht mehr: dort steht `type: commonjs` (siehe
// `extraMetadata` in `electron-builder.js`), weil der Einsprung-Shim des
// macOS-Universal-Builds sonst als ESM geparst wird und die App beim Start
// stirbt -- gemessen an der ausgelieferten Suite-App `v0.1.1`:
//
//   ReferenceError: exports is not defined in ES module scope
//   ... app.asar/package.json contains "type": "module"
//
// Ohne diese Datei waere der Main-Prozess im Installer CommonJS und die App
// startete gar nicht mehr ("Cannot use import statement outside a module").
// Sie kostet nichts und steht deshalb bei JEDEM Build, nicht nur beim mac-Build:
// eine Datei, die nur manchmal entsteht, ist die naechste Fehlerquelle.
// ───────────────────────────────────────────────────────────────────────────
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ZIEL = join(ROOT, 'dist', 'main')

if (!existsSync(ZIEL)) {
  console.error(`FEHLER: ${ZIEL} gibt es nicht -- lief \`tsc -p tsconfig.main.json\` vorher?`)
  process.exit(1)
}

writeFileSync(join(ZIEL, 'package.json'), `${JSON.stringify({ type: 'module' }, null, 2)}\n`)
console.log('[mark-main-esm] dist/main/package.json geschrieben (type: module)')
