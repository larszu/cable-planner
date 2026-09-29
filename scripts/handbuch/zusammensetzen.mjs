// Das Handbuch aus den Kapiteln zusammensetzen.
//
//   node scripts/handbuch/zusammensetzen.mjs   → docs/manual/handbuch.de.md, manual.en.md
//
// Bearbeitet werden die Dateien unter `docs/manual/kapitel/`; die beiden
// Gesamtdateien sind Ergebnis, damit GitHub und das PDF (`npm run manual:pdf`)
// dasselbe zeigen. Nummern und Inhaltsverzeichnis entstehen hier — von Hand
// gezählte Kapitelnummern verrutschen beim ersten eingeschobenen Kapitel.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { slug } from './slug.mjs'

const DIR = join(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'), 'docs', 'manual')

/** Reihenfolge = Weg eines neuen Nutzers: ankommen, Oberfläche, planen, prüfen, ausgeben, einstellen. */
export const KAPITEL = [
  'grundlagen',
  'oberflaeche',
  'canvas',
  'bibliothek',
  'eigenschaften',
  'datei-import',
  'werkzeuge-planen',
  'werkzeuge-bauen',
  'export',
  'einstellungen',
  'claude',
  'web-tablet',
  'daten',
]

const AUSGABE = { de: ['handbuch.de.md', 'Inhalt'], en: ['manual.en.md', 'Contents'] }

for (const [sprache, [datei, inhalt]] of Object.entries(AUSGABE)) {
  // Der Kopf liegt in `kapitel/` und verlinkt deshalb mit `../` (sonst waere
  // der Link in der Quelle tot, tests/dokuErreichbar.test.ts); das fertige
  // Handbuch liegt eine Ebene hoeher, dort faellt das `../` weg.
  const kopf = readFileSync(join(DIR, 'kapitel', `_kopf.${sprache}.md`), 'utf8').trim().replace(/\]\(\.\.\//g, '](')
  const titel = []
  const unter = []
  const teile = KAPITEL.map((k, i) => {
    const text = readFileSync(join(DIR, 'kapitel', `${k}.${sprache}.md`), 'utf8').trim()
    let nummeriert = false
    const mitNummer = text.replace(/^## +(.*)$/m, (_, t) => {
      nummeriert = true
      titel.push(t.trim())
      return `## ${i + 1}. ${t.trim()}`
    })
    if (!nummeriert) throw new Error(`kapitel/${k}.${sprache}.md beginnt nicht mit „## Titel"`)
    unter.push([...mitNummer.matchAll(/^### +(.*)$/gm)].map((m) => m[1].trim()))
    return mitNummer
  })
  const verzeichnis = `## ${inhalt}\n\n${titel
    .map((t, i) => {
      const kopf = `${i + 1}. ${t}`
      const zeilen = unter[i].map((u) => `   - [${u}](#${slug(u)})`)
      return [`${i + 1}. [${t}](#${slug(kopf)})`, ...zeilen].join('\n')
    })
    .join('\n')}`
  writeFileSync(join(DIR, datei), [kopf, verzeichnis, ...teile].join('\n\n---\n\n') + '\n')
  console.log(`docs/manual/${datei}: ${titel.length} Kapitel`)
}

// Index der Quelldateien — jedes Dokument unter docs/ muss verlinkt sein
// (tests/dokuErreichbar.test.ts).
// Nur Sprachen, deren Datei es gibt: ein Kapitel, dessen Uebersetzung noch
// fehlt, bekommt keinen toten Link (tests/dokuErreichbar.test.ts).
const zeile = (k) =>
  `- ${k}: ${['de', 'en']
    .filter((l) => existsSync(join(DIR, 'kapitel', `${k}.${l}.md`)))
    .map((l) => `[${l}](${k}.${l}.md)`)
    .join(' · ')}`
writeFileSync(
  join(DIR, 'kapitel', 'README.md'),
  `# Handbuch-Kapitel\n\nQuelle des Benutzerhandbuchs. Hier bearbeiten, dann \`npm run manual:pdf\`.\n\n${[
    zeile('_kopf'),
    ...KAPITEL.map(zeile),
  ].join('\n')}\n`,
)
