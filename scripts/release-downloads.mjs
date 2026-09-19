#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// Die zweite Kennzahl des Nachfragetests: wie oft wurde heruntergeladen?
// Lauf: `npm run downloads:zaehlen`
//
// NUTZER-AUFTRAG (#866): „Download-Zahlen der Releases als zweite Kennzahl
// mitschreiben."
//
// ─── WARUM MITSCHREIBEN UND NICHT NACHSCHLAGEN ────────────────────────────
//
// Die GitHub-API nennt zu jedem Release-Asset einen `download_count` — aber
// nur den HEUTIGEN Stand. Es gibt keine Historie, und ein geloeschtes oder
// ersetztes Asset nimmt seine Zahl mit. Wer in drei Monaten wissen will, ob
// die Downloads gestiegen sind, muss heute anfangen zu schreiben.
//
// Deshalb schreibt dieser Lauf eine Zeile je Aufruf in eine CSV im Repo. Die
// Datei ist die Messreihe; die API ist nur die Quelle des jeweils letzten
// Punktes.
//
// ─── UND WARUM DIE ZAHL NICHT DIE ENTSCHEIDUNG TRAEGT ─────────────────────
//
// Sie sagt, wie gross der Teich ist, und nicht, ob jemand zahlt. 3.000
// Downloads ohne eine einzige Vorbestellung sind eine Antwort und keine
// Hoffnung. Die Schwelle steht in `docs/cloud/nachfragetest.md` und haengt an
// den Vorbestellungen — diese Datei liefert den Zusammenhang, nicht das
// Urteil.
// ───────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HIER = dirname(fileURLToPath(import.meta.url))
const ZIEL = resolve(HIER, '..', 'docs', 'cloud', 'downloads.csv')
const REPO = process.env.DOWNLOADS_REPO ?? 'larszu/cable-planner'

const KOPF = 'datum,release,asset,downloads'

/** Ein CSV-Feld. Kommas und Anfuehrungszeichen kommen in Asset-Namen vor. */
const feld = (s) => (/[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s))

async function hole() {
  const url = `https://api.github.com/repos/${REPO}/releases?per_page=100`
  const kopf = { Accept: 'application/vnd.github+json', 'User-Agent': 'cable-planner-downloads' }
  // Ein Token ist NICHT noetig — oeffentliche Releases gehen ohne. Es wird
  // benutzt, wenn eines dasteht, weil das Limit ohne Token bei 60 Anfragen je
  // Stunde liegt und ein Lauf in der CI sonst am Nachbarn scheitert.
  if (process.env.GITHUB_TOKEN) kopf.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const antwort = await fetch(url, { headers: kopf })
  if (!antwort.ok) {
    throw new Error(`GitHub antwortete mit ${antwort.status} ${antwort.statusText}`)
  }
  return antwort.json()
}

/** Die Zeilen fuer einen Stichtag. Reine Funktion — deshalb pruefbar. */
export function zeilenAus(releases, datum) {
  const zeilen = []
  for (const r of releases ?? []) {
    if (r.draft) continue
    for (const a of r.assets ?? []) {
      zeilen.push([datum, r.tag_name ?? '—', a.name ?? '—', a.download_count ?? 0])
    }
  }
  return zeilen
}

/** Summe ueber alle Assets — die Zahl, die im Nachfragetest steht. */
export const summe = (zeilen) => zeilen.reduce((n, z) => n + Number(z[3] ?? 0), 0)

async function main() {
  const datum = new Date().toISOString().slice(0, 10)
  const releases = await hole()
  const zeilen = zeilenAus(releases, datum)

  if (zeilen.length === 0) {
    console.log('Keine veroeffentlichten Release-Assets gefunden — nichts zu schreiben.')
    return
  }

  mkdirSync(dirname(ZIEL), { recursive: true })
  const vorher = existsSync(ZIEL) ? readFileSync(ZIEL, 'utf8').trimEnd() : KOPF
  // Ein zweiter Lauf am selben Tag ERSETZT die Zeilen des Tages, statt sie zu
  // verdoppeln: sonst zaehlte ein wiederholter Workflow denselben Stand
  // zweimal, und die Messreihe haette einen Buckel, den es nie gab.
  const behalten = vorher
    .split('\n')
    .filter((z) => z !== KOPF && z.trim() !== '' && !z.startsWith(`${datum},`))
  const neu = [KOPF, ...behalten, ...zeilen.map((z) => z.map(feld).join(','))].join('\n')
  writeFileSync(ZIEL, `${neu}\n`)

  console.log(`${datum}: ${zeilen.length} Assets, ${summe(zeilen)} Downloads gesamt.`)
  console.log(`Geschrieben nach ${ZIEL}`)
}

// Nur ausfuehren, wenn direkt gerufen — die zwei reinen Funktionen oben
// gehoeren dem Test, und der will kein Netz.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error(`FEHLER: ${e.message}`)
    process.exit(1)
  })
}
