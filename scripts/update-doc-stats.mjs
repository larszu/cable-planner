// Hält die maschinell zählbaren Doku-Kennzahlen automatisch aktuell.
//
// Aktualisiert in CLAUDE.md, docs/architecture.md, docs/app-structure.html und
// docs/comparison.html die abgeleiteten Zahlen:
//   - Version (aus package.json)
//   - Anzahl TS/TSX-Module in src/
//   - Gesamt-LOC (~Nk)
//   - Anzahl Store-Slices (src/renderer/store/slices/)
//   - Anzahl Komponenten-Subdomänen (src/renderer/components/)
//   - src/-Größe in MB (nur comparison.html)
//
// Lauf:  node scripts/update-doc-stats.mjs          (schreibt Änderungen)
//        node scripts/update-doc-stats.mjs --check   (Exit 1 wenn veraltet)
//
// Wird von .github/workflows/docs-stats.yml bei jedem Merge auf main
// ausgeführt; bei Differenzen committet der Workflow das Ergebnis zurück.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const CHECK = process.argv.includes('--check')

// ---- Kennzahlen aus dem Code berechnen ------------------------------------
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
const version = pkg.version

const walk = (dir, exts) => {
  let files = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) files = files.concat(walk(p, exts))
    else if (exts.some((x) => e.name.endsWith(x))) files.push(p)
  }
  return files
}

const srcFiles = walk(join(ROOT, 'src'), ['.ts', '.tsx'])
const moduleCount = srcFiles.length
let loc = 0
let bytes = 0
for (const f of srcFiles) {
  const txt = readFileSync(f, 'utf-8')
  // wie `wc -l`: Anzahl Zeilenumbrüche (idempotent, env-unabhängig)
  loc += txt.split('\n').length - 1
  bytes += Buffer.byteLength(txt, 'utf-8')
}
// LOC inkl. aller src-Dateien (nicht nur ts/tsx) für die MB-Angabe konsistent:
const allSrc = walk(join(ROOT, 'src'), [''])
let srcBytes = 0
for (const f of allSrc) {
  try {
    srcBytes += statSync(f).size
  } catch {
    /* ignore */
  }
}

const sliceCount = readdirSync(join(ROOT, 'src/renderer/store/slices')).filter((f) =>
  f.endsWith('.ts'),
).length
const componentDirCount = readdirSync(join(ROOT, 'src/renderer/components'), {
  withFileTypes: true,
}).filter((e) => e.isDirectory()).length

const locK = `${(loc / 1000).toFixed(1)}k`
const srcMB = `${(srcBytes / (1024 * 1024)).toFixed(1)} MB`

const stats = { version, moduleCount, locK, sliceCount, componentDirCount, srcMB }

// ---- Doku-Dateien aktualisieren -------------------------------------------
// Jede Regel ersetzt eine stabil formatierte Phrase. Bewusst eng gefasst,
// damit nur die Kennzahlen angefasst werden, nicht beliebiger Fließtext.
const rules = [
  // Version direkt vor "· ~N TS/TSX-Module" (nur die Stat-Zeilen, keine Issue-Refs)
  [/v\d+\.\d+\.\d+(?=[^\n]*TS\/TSX-Module)/g, `v${version}`],
  // Modul-Anzahl
  [/~\d+ TS\/TSX-Module/g, `~${moduleCount} TS/TSX-Module`],
  // Gesamt-LOC (~Nk)
  [/~[\d.]+k LOC/g, `~${locK} LOC`],
  // Store-Slices
  [/\b\d+ Slices\b/g, `${sliceCount} Slices`],
  // Komponenten-Subdomänen
  [/\b\d+ Subdomänen\b/g, `${componentDirCount} Subdomänen`],
  // src/-Größe (nur comparison.html-Format)
  [/~[\d.]+ MB src\//g, `~${srcMB} src/`],
  // comparison.html Stat-Grid-Karten (eigenes <div class="num">…</div>-Format)
  [
    /(<div class="num">)\d+(<\/div><div class="label">TS\/TSX-Module<\/div>)/g,
    `$1${moduleCount}$2`,
  ],
  [
    /(<div class="num">)[\d.]+k(<\/div><div class="label">Lines of Code<\/div>)/g,
    `$1${locK}$2`,
  ],
]

const targets = [
  'CLAUDE.md',
  'docs/architecture.md',
  'docs/app-structure.html',
  'docs/comparison.html',
]

let changedFiles = []
for (const rel of targets) {
  const path = join(ROOT, rel)
  let txt
  try {
    txt = readFileSync(path, 'utf-8')
  } catch {
    continue
  }
  let next = txt
  for (const [re, repl] of rules) next = next.replace(re, repl)
  if (next !== txt) {
    changedFiles.push(rel)
    if (!CHECK) writeFileSync(path, next)
  }
}

console.log('Doku-Kennzahlen:', JSON.stringify(stats))
if (changedFiles.length === 0) {
  console.log('Doku ist aktuell — keine Änderungen.')
  process.exit(0)
}
if (CHECK) {
  console.error('Veraltete Doku-Kennzahlen in:', changedFiles.join(', '))
  console.error('→ `node scripts/update-doc-stats.mjs` ausführen und committen.')
  process.exit(1)
}
console.log('Aktualisiert:', changedFiles.join(', '))
