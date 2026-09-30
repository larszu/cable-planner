#!/usr/bin/env node
// ---------------------------------------------------------------------------
// lz-scopes, vendort unter `src/renderer/vendor/lz-scopes/` (larszu/lz-scopes#15).
//
//   npm run scopes:sync  -- --upstream ../lz-scopes    Dateien holen
//   npm run scopes:check -- --upstream ../lz-scopes    Abweichung melden (Exit 1)
//
// WARUM VENDORT UND KEIN PAKET. lz-scopes ist kein npm-Paket, und eine
// Git-Abhaengigkeit liesse `npm ci` von GitHub abhaengen. lz-camera-bridge
// vendort denselben Kern genauso. Die Richtung bleibt: lz-scopes ist die
// Quelle, hier wird nicht editiert — ausser den PATCHES unten.
//
// WARUM DIE DATEILISTE ERRECHNET WIRD. Sie ist die Import-Huelle von
// `src/index.ts` upstream. Zieht upstream eine neue Datei hinzu, fehlt sie hier
// und dieser Lauf wird rot, statt dass der Build erst beim naechsten Sync
// bricht.
//
// WARUM DER ORDNER DIE REPO-WURZEL SPIEGELT (`src/`, `server/`). Die Huelle
// reicht ueber `src/` hinaus — `src/clock/tai.ts` importiert
// `../../server/leap.mjs` (samt `leap.d.mts`). Mit derselben Ordnerform wie
// upstream bleiben alle relativen Importe unveraendert.
//
// WARUM ES PATCHES GIBT. `tsconfig.app.json` verlangt `erasableSyntaxOnly`, und
// `tsc` prueft importierte Dateien mit — eine Ordner-Ausnahme gibt es dafuer
// nicht. Upstream nutzt an zwei Stellen Parameter-Properties (und einen
// unbenutzten Parameter, den `noUnusedParameters` hier anmahnt). Die Patches
// schreiben genau diese Stellen aus; sie werden beim Vergleich auf
// upstream angewandt, damit alles andere Byte fuer Byte gleich bleiben muss.
// Faellt ein Patch ins Leere (upstream hat die Stelle geaendert), meldet der
// Lauf das, statt still ungepatcht zu kopieren.
// ---------------------------------------------------------------------------
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const ZIEL = resolve('src/renderer/vendor/lz-scopes')
const EIGENE = new Set(['VENDOR.md'])

export const PATCHES = [
  {
    datei: 'src/renderer.ts',
    alt: '  constructor(readonly canvas: HTMLCanvasElement) {\n',
    neu: '  readonly canvas: HTMLCanvasElement;\n  constructor(canvas: HTMLCanvasElement) {\n    this.canvas = canvas;\n',
  },
  {
    datei: 'src/audio/dsp/signals.ts',
    alt: "  constructor(seed: number, private kind: 'white' | 'pink' | 'pink-band', fs: number, calibrate = true) {\n",
    neu: "  private kind: 'white' | 'pink' | 'pink-band';\n  constructor(seed: number, kind: 'white' | 'pink' | 'pink-band', fs: number, calibrate = true) {\n    this.kind = kind;\n",
  },
  {
    // `noUnusedParameters` gilt hier, upstream nicht. `_` ist die Ausnahme von tsc.
    datei: 'src/led/wall.ts',
    alt: 'export const cabinetLabel = (w: WallConfig, c: number, r: number)',
    neu: 'export const cabinetLabel = (_w: WallConfig, c: number, r: number)',
  },
]

const IMPORT = /(?:import|export)\s[^;]*?from\s+['"](\.[^'"]+)['"]|import\s+['"](\.[^'"]+)['"]|\/\/\/\s*<reference\s+path=['"]([^'"]+)['"]/g

/** Die Import-Huelle von `src/index.ts`, relativ zur Repo-Wurzel upstream. */
export function huelle(wurzel) {
  const gesehen = new Set()
  const offen = ['src/index.ts']
  while (offen.length) {
    const rel = offen.pop()
    if (gesehen.has(rel)) continue
    const pfad = join(wurzel, rel)
    if (!existsSync(pfad)) throw new Error(`upstream fehlt ${rel}`)
    if (rel.startsWith('..')) throw new Error(`Import verlaesst das Repo: ${rel}`)
    gesehen.add(rel)
    // Ein Import auf `x.mjs` zieht dessen Typen `x.d.mts` mit.
    const typen = rel.replace(/\.mjs$/, '.d.mts')
    if (typen !== rel && existsSync(join(wurzel, typen))) offen.push(typen)
    if (!/\.(ts|mts)$/.test(rel)) continue
    const text = readFileSync(pfad, 'utf8')
    for (const m of text.matchAll(IMPORT)) {
      let ziel = (m[1] ?? m[2] ?? m[3]).split('?')[0]
      if (!/\.(ts|mts|mjs|js)$/.test(ziel)) ziel += '.ts'
      offen.push(relative(wurzel, resolve(dirname(pfad), ziel)))
    }
  }
  return [...gesehen].sort()
}

export function gepatcht(datei, text) {
  let out = text
  for (const p of PATCHES.filter((x) => x.datei === datei)) {
    if (!out.includes(p.alt)) throw new Error(`Patch passt nicht mehr: ${datei} — upstream hat die Stelle geaendert, PATCHES anpassen`)
    out = out.replace(p.alt, p.neu)
  }
  return out
}

const vorhanden = (dir, basis = dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((e) => {
        const p = join(dir, e)
        return statSync(p).isDirectory() ? vorhanden(p, basis) : [relative(basis, p)]
      })
    : []

function commitVon(upstream) {
  try {
    return execFileSync('git', ['-C', upstream, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return 'unbekannt'
  }
}

function main() {
  const args = process.argv.slice(2)
  const i = args.indexOf('--upstream')
  const upstream = resolve(i >= 0 ? args[i + 1] : '../lz-scopes')
  const sync = args.includes('--sync')
  if (!existsSync(join(upstream, 'src', 'index.ts'))) {
    console.error(`Kein lz-scopes-Checkout unter ${upstream} (--upstream <pfad>).`)
    process.exit(2)
  }
  const liste = huelle(upstream)
  const erwartet = new Map(liste.map((rel) => [rel, gepatcht(rel, readFileSync(join(upstream, rel), 'utf8'))]))

  if (sync) {
    for (const rel of vorhanden(ZIEL)) if (!EIGENE.has(rel) && !erwartet.has(rel)) rmSync(join(ZIEL, rel))
    for (const [rel, text] of erwartet) {
      mkdirSync(dirname(join(ZIEL, rel)), { recursive: true })
      writeFileSync(join(ZIEL, rel), text)
    }
    console.log(`${erwartet.size} Dateien von lz-scopes@${commitVon(upstream)} uebernommen. Commit in VENDOR.md eintragen.`)
    return
  }

  const fehler = []
  for (const [rel, text] of erwartet) {
    const hier = join(ZIEL, rel)
    if (!existsSync(hier)) fehler.push(`fehlt: ${rel}`)
    else if (readFileSync(hier, 'utf8') !== text) fehler.push(`weicht ab: ${rel}`)
  }
  for (const rel of vorhanden(ZIEL)) if (!EIGENE.has(rel) && !erwartet.has(rel)) fehler.push(`upstream nicht mehr gebraucht: ${rel}`)
  if (fehler.length) {
    console.error(`lz-scopes-Vendor weicht von ${upstream} (${commitVon(upstream)}) ab:\n  ${fehler.join('\n  ')}\nAbhilfe: npm run scopes:sync -- --upstream <pfad>, dann tsc/test/build.`)
    process.exit(1)
  }
  console.log(`lz-scopes-Vendor = lz-scopes@${commitVon(upstream)} (${erwartet.size} Dateien, ${PATCHES.length} Patches).`)
}

if (process.argv[1] && process.argv[1].endsWith('lz-scopes-vendor.mjs')) main()
