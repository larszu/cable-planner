#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// Keine GitHub-Action laeuft mehr auf einer abgekuendigten Node-Version.
//
// WARUM ES DAS GIBT. Am Ende jedes Release-Laufs steht seit Monaten:
//
//   Node.js 20 is deprecated. The following actions target Node.js 20 but are
//   being forced to run on Node.js 24: actions/upload-artifact@v4
//
// Eine Warnung, die in jedem Lauf steht, liest nach dem dritten Mal niemand
// mehr. Gemessen 2026-09-05 waren es hier vier Actions -- und die Kommentare
// im Workflow behaupteten dazu etwas, das nicht mehr stimmte („Three actions
// still don't have a Node-24 release as of May 2026"). Inzwischen haben ALLE
// verwendeten Actions ein node24-Major; die Repos hingen bis zu drei Majors
// zurueck.
//
// WIE ER PRUEFT. Er fragt die Action selbst, nicht eine Tabelle: fuer jedes
// `uses:` in `.github/workflows/` wird deren `action.yml` an genau dem
// gepinnten Ref gelesen und `runs.using` ausgewertet. Eine Liste im Skript
// waere genau das, was hier schon einmal veraltet ist -- ein Kommentar, der
// den Stand von Mai behauptet.
//
// Er folgt dabei EINE Ebene in Composite-Actions hinein. Das ist nicht
// Gruendlichkeit um ihrer selbst willen, sondern der einzige Weg, den
// interessantesten Fall zu sehen: `actions/upload-pages-artifact@v3` ist
// selbst ein Composite (also ohne eigene Node-Version) und ruft intern
// `actions/upload-artifact@v4` auf -- node20, unsichtbar von aussen. Wer nur
// die aeussere Zeile prueft, haelt diesen Pin fuer sauber.
//
// WAS ER NICHT PRUEFT: ob ein neueres Major sonst kompatibel ist. Welche
// `with:`-Schluessel eine Action kennt, steht in ihrer `action.yml` -- wer ein
// Major anhebt, gleicht das ab (beim Sprung von 2026-09-05 wurde jeder
// verwendete Schluessel einzeln gegen das Ziel-Major geprueft).
//
// OHNE NETZ prueft er nichts und sagt das. Das ist kein stilles Ueberspringen:
// der Grund steht in der Ausgabe, und der Lauf bleibt gruen, damit ein
// Netz-Aussetzer keinen fremden PR blockiert -- dieselbe Regel wie beim
// Drift-Guard der Suite.
// ───────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORKFLOWS = join(ROOT, '.github', 'workflows')

/** Aelter als das gilt als abgekuendigt. */
const MINDESTENS = 24

/**
 * Verschachtelte Actions, die wir NICHT selbst pinnen und deshalb auch nicht
 * anheben koennen. Der Text ist Pflicht -- er ist der ganze Zweck der Tabelle.
 * Eine Ausnahme fuer etwas, das gar nicht mehr auftaucht, faellt unten auf.
 */
const NICHT_UNSER_PIN = {}

const referenzen = () => {
  if (!existsSync(WORKFLOWS)) return []
  const treffer = new Set()
  for (const datei of readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f))) {
    for (const m of readFileSync(join(WORKFLOWS, datei), 'utf8').matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)) {
      treffer.add(m[1].replace(/['"]/g, ''))
    }
  }
  return [...treffer].sort()
}

/** `owner/repo/unterpfad@ref` -> die action.yml-URLs, die dafuer in Frage kommen. */
const urls = (referenz) => {
  const [pfad, ref] = referenz.split('@')
  const teile = pfad.split('/')
  const [owner, repo, ...unter] = teile
  const basis = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}`
  const rest = unter.length > 0 ? `/${unter.join('/')}` : ''
  return [`${basis}${rest}/action.yml`, `${basis}${rest}/action.yaml`]
}

const holen = async (referenz) => {
  for (const url of urls(referenz)) {
    const antwort = await fetch(url)
    if (antwort.ok) return await antwort.text()
    if (antwort.status !== 404) throw new Error(`${url} -> HTTP ${antwort.status}`)
  }
  return null
}

const laufzeit = (inhalt) => {
  const m = inhalt.match(/^\s*using:\s*['"]?([\w.-]+)['"]?/m)
  return m ? m[1] : null
}

const inneresUses = (inhalt) => [
  ...new Set([...inhalt.matchAll(/^\s*uses:\s*['"]?(\S+?)['"]?\s*(?:#.*)?$/gm)].map((m) => m[1])),
]

/** Lokale Pfade und Docker-Referenzen haben kein action.yml auf GitHub. */
const pruefbar = (referenz) =>
  referenz.includes('@') && !referenz.startsWith('.') && !referenz.startsWith('docker://')

const maengel = []
const gesehen = new Map()

/**
 * Erst ALLE eigenen Pins, dann das Innere der Composites. Die Reihenfolge ist
 * kein Detail: taucht dieselbe Action beides Mal auf, soll die Meldung an dem
 * Pin haengen, den man tatsaechlich anheben kann -- an unserem.
 */
const pruefe = async (referenz, ueber) => {
  if (!pruefbar(referenz) || gesehen.has(referenz)) return null
  gesehen.set(referenz, true)
  const inhalt = await holen(referenz)
  if (inhalt === null) {
    maengel.push(`${referenz}: keine action.yml an diesem Ref gefunden (Tippfehler im Pin?)`)
    return null
  }
  const art = laufzeit(inhalt)
  if (art === 'composite') return { referenz, innen: inneresUses(inhalt) }
  const version = art && art.startsWith('node') ? Number(art.slice(4)) : null
  if (version !== null && version < MINDESTENS) {
    if (ueber && referenz in NICHT_UNSER_PIN) return null
    maengel.push(
      ueber
        ? `${referenz} laeuft auf ${art} (verschachtelt in ${ueber}) -- gepinnt wird ` +
          `${ueber}, also dort das Major anheben.`
        : `${referenz} laeuft auf ${art} -- ein neueres Major anheben.`,
    )
  }
  return null
}

const alle = referenzen()
if (alle.length === 0) {
  console.error('FEHLER: keine `uses:`-Zeilen in .github/workflows/ gefunden -- greift der Suchlauf daneben?')
  process.exit(1)
}

try {
  let offen = alle.map((referenz) => ({ referenz, ueber: null }))
  while (offen.length > 0) {
    const naechste = []
    for (const { referenz, ueber } of offen) {
      const composite = await pruefe(referenz, ueber)
      if (composite) {
        for (const innen of composite.innen) naechste.push({ referenz: innen, ueber: composite.referenz })
      }
    }
    offen = naechste
  }
} catch (fehler) {
  // Kein stilles Ueberspringen: der Grund steht hier, und er steht im Log.
  console.log(`NICHT GEPRUEFT: die Actions waren nicht erreichbar (${fehler.message}).`)
  console.log('Der Lauf bleibt gruen, damit ein Netz-Aussetzer keinen PR blockiert.')
  process.exit(0)
}

for (const [referenz, grund] of Object.entries(NICHT_UNSER_PIN)) {
  if (!gesehen.has(referenz)) {
    maengel.push(`NICHT_UNSER_PIN nennt "${referenz}" -- die Action kommt gar nicht mehr vor.`)
  }
  if (!grund || grund.trim().length < 40) maengel.push(`NICHT_UNSER_PIN["${referenz}"] ohne Begruendung.`)
}

if (maengel.length === 0) {
  console.log(`OK: ${gesehen.size} Action-Referenz(en) geprueft, alle auf node${MINDESTENS} oder neuer.`)
  process.exit(0)
}

console.error(`FEHLER: ${maengel.length} Action(s) auf abgekuendigter Node-Version:\n`)
for (const m of maengel) console.error(`  ! ${m}`)
console.error(
  '\nGitHub faehrt sie derzeit noch ersatzweise auf node24 und schreibt eine Warnung\n' +
    'ans Ende jedes Laufs. Das ist eine Frist, kein Zustand.',
)
process.exit(1)
