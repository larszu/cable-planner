#!/usr/bin/env node
// ---------------------------------------------------------------------------
// lz-scopes, vendort unter `src/renderer/vendor/lz-scopes/` (larszu/lz-scopes#15).
//
//   npm run scopes:sync  -- --upstream ../lz-scopes [--ref <commit>]   Dateien holen, Pin setzen
//   npm run scopes:check -- --upstream ../lz-scopes                    Abweichung vom Pin melden (Exit 1)
//
// WARUM EIN PIN STATT UPSTREAM `main` (2026-09-30). Der erste Stand verglich
// gegen `main` und war am selben Tag zweimal rot: lz-scopes bekommt mehrere PRs
// am Tag, und jeder machte jeden PR hier rot, ohne dass er etwas damit zu tun
// hatte. Der Vergleich laeuft deshalb gegen den Commit in VENDOR.md — die
// einzige Stelle, an der er steht. Gelesen wird per `git show <pin>:<pfad>`,
// der lokale Checkout darf also auf beliebigem Stand sein. Wie weit upstream
// voraus ist, meldet der Lauf als Hinweis; nachziehen ist ein eigener PR mit
// `scopes:sync`.
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
// WARUM `@ts-nocheck` IN JEDER KOPIE. `tsconfig.app.json` verlangt
// `erasableSyntaxOnly` und `noUnusedParameters`, upstream nicht, und `tsc`
// prueft importierte Dateien mit — eine Ordner-Ausnahme gibt es nicht. Die
// Kopfzeile (`NOCHECK`) wird beim Kopieren UND beim Vergleich gesetzt; alles
// andere muss Byte fuer Byte gleich bleiben. Gezielte `PATCHES` bleiben fuer
// den Fall, dass upstream etwas enthaelt, das hier nicht laeuft. Faellt ein
// Patch ins Leere, meldet der Lauf das, statt still ungepatcht zu kopieren.
// ---------------------------------------------------------------------------
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, relative, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const ZIEL = resolve('src/renderer/vendor/lz-scopes')
const EIGENE = new Set(['VENDOR.md'])

/**
 * Gezielte Ersetzungen `{ datei, alt, neu }`, angewandt nach dem Kopieren.
 * Heute leer: was frueher hier stand (Parameter-Properties, unbenutzte
 * Parameter), deckt die Kopfzeile `NOCHECK` allgemein ab. Gebraucht nur noch,
 * wenn upstream etwas enthaelt, das hier nicht LAEUFT — nicht fuer Typfragen.
 */
export const PATCHES = [
]

const IMPORT = /(?:import|export)\s[^;]*?from\s+['"](\.[^'"]+)['"]|import\s+['"](\.[^'"]+)['"]|\/\/\/\s*<reference\s+path=['"]([^'"]+)['"]/g

/** Die Import-Huelle von `src/index.ts`, relativ zur Repo-Wurzel upstream. `lies(rel)` liefert Text oder `null`. */
export function huelle(lies) {
  const gesehen = new Map()
  const offen = ['src/index.ts']
  while (offen.length) {
    const rel = offen.pop()
    if (gesehen.has(rel)) continue
    if (rel.startsWith('..')) throw new Error(`Import verlaesst das Repo: ${rel}`)
    const text = lies(rel)
    if (text === null) throw new Error(`upstream fehlt ${rel}`)
    gesehen.set(rel, text)
    // Ein Import auf `x.mjs` zieht dessen Typen `x.d.mts` mit.
    const typen = rel.replace(/\.mjs$/, '.d.mts')
    if (typen !== rel && !gesehen.has(typen) && lies(typen) !== null) offen.push(typen)
    if (!/\.(ts|mts)$/.test(rel)) continue
    for (const m of text.matchAll(IMPORT)) {
      let ziel = (m[1] ?? m[2] ?? m[3]).split('?')[0]
      if (!/\.(ts|mts|mjs|js)$/.test(ziel)) ziel += '.ts'
      offen.push(posix.normalize(posix.join(posix.dirname(rel), ziel)))
    }
  }
  return new Map([...gesehen].sort(([x], [y]) => x.localeCompare(y)))
}

/**
 * Jede vendorte TS-Datei bekommt diese Kopfzeile. upstream prueft seinen Code
 * selbst (`tsc --noEmit` im Build von lz-scopes), aber mit anderen Schaltern als
 * `tsconfig.app.json` hier (`erasableSyntaxOnly`, `noUnusedParameters`). Bis
 * 2026-10-06 glich das eine Liste einzelner Patches aus; nach 25 Commits
 * upstream brauchte der naechste Sync acht neue. Die Typen der Exporte bleiben
 * erhalten — unterdrueckt werden nur die Meldungen IN der Kopie.
 */
export const NOCHECK = '// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)\n'

export function gepatcht(datei, text) {
  let out = /\.(ts|mts)$/.test(datei) ? NOCHECK + text : text
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

const VENDOR_MD = join(ZIEL, 'VENDOR.md')
const PIN = /commit `([0-9a-f]{40})`/

export function pin() {
  const m = readFileSync(VENDOR_MD, 'utf8').match(PIN)
  if (!m) throw new Error('VENDOR.md nennt keinen Commit (commit `<40 Zeichen>`)')
  return m[1]
}

const git = (upstream, ...a) =>
  execFileSync('git', ['-C', upstream, ...a], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] })

const leser = (upstream, ref) => (rel) => {
  try {
    return git(upstream, 'show', `${ref}:${rel}`)
  } catch {
    return null
  }
}

function main() {
  const args = process.argv.slice(2)
  const wert = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
  const upstream = resolve(wert('--upstream') ?? '../lz-scopes')
  const sync = args.includes('--sync')
  let ref
  try {
    ref = git(upstream, 'rev-parse', '--verify', `${sync ? (wert('--ref') ?? 'HEAD') : pin()}^{commit}`).trim()
  } catch {
    console.error(`Kein lz-scopes-Checkout mit ${sync ? 'diesem Commit' : `dem Pin ${pin()}`} unter ${upstream} (--upstream <pfad>; volle Historie noetig).`)
    process.exit(2)
  }
  const kurz = ref.slice(0, 7)
  const erwartet = new Map([...huelle(leser(upstream, ref))].map(([rel, text]) => [rel, gepatcht(rel, text)]))

  if (sync) {
    for (const rel of vorhanden(ZIEL)) if (!EIGENE.has(rel) && !erwartet.has(rel)) rmSync(join(ZIEL, rel))
    for (const [rel, text] of erwartet) {
      mkdirSync(dirname(join(ZIEL, rel)), { recursive: true })
      writeFileSync(join(ZIEL, rel), text)
    }
    writeFileSync(VENDOR_MD, readFileSync(VENDOR_MD, 'utf8').replace(PIN, `commit \`${ref}\``))
    console.log(`${erwartet.size} Dateien von lz-scopes@${kurz} uebernommen, Pin in VENDOR.md gesetzt. PNGs in public/patterns/lz-display/ vergleichen.`)
    return
  }

  const fehler = []
  for (const [rel, text] of erwartet) {
    const hier = join(ZIEL, rel)
    if (!existsSync(hier)) fehler.push(`fehlt: ${rel}`)
    else if (readFileSync(hier, 'utf8') !== text) fehler.push(`weicht ab: ${rel}`)
  }
  for (const rel of vorhanden(ZIEL)) if (!EIGENE.has(rel) && !erwartet.has(rel.split('\\').join('/'))) fehler.push(`upstream nicht mehr gebraucht: ${rel}`)
  if (fehler.length) {
    console.error(`lz-scopes-Vendor weicht vom Pin lz-scopes@${kurz} ab:\n  ${fehler.join('\n  ')}\nNicht von Hand editieren. Abhilfe: npm run scopes:sync -- --upstream <pfad>, dann tsc/test/build.`)
    process.exit(1)
  }
  console.log(`lz-scopes-Vendor = lz-scopes@${kurz} (${erwartet.size} Dateien, ${PATCHES.length} Patches).`)
  try {
    const voraus = git(upstream, 'rev-list', '--count', `${ref}..origin/HEAD`, '--', 'src', 'server').trim()
    if (voraus !== '0') console.log(`Hinweis: upstream origin/HEAD hat ${voraus} neuere Commits unter src/ und server/ — nachziehen mit scopes:sync.`)
  } catch {
    // kein origin/HEAD im Checkout: kein Hinweis
  }
}

if (process.argv[1] && process.argv[1].endsWith('lz-scopes-vendor.mjs')) main()
