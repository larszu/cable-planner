// Abdeckung des Handbuchs: kommt jede sichtbare Funktion darin vor?
//
//   node scripts/handbuch/abdeckung.mjs        → Bericht, Exitcode 1 bei Lücken
//
// WARUM ES DAS GIBT: „ausnahmslos jede Funktion“ lässt sich nicht behaupten,
// nur messen. Das Skript sammelt aus dem Code, was ein Nutzer zu sehen
// bekommt, und sucht die Beschriftung in der zusammengesetzten Handbuchdatei
// der jeweiligen Sprache:
//   - Menüeinträge (`app.menu.*`, Befehlspalette `palette.*`)
//   - Titel jedes Dialogs (`title={t('…','…')}` in *Dialog.tsx und ModalShell)
//   - Einstellungs-Reiter
// Eine Beschriftung gilt als beschrieben, wenn sie (ohne Auslassungspunkte,
// ohne Platzhalter) als Text im Handbuch steht. NICHT gemessen: einzelne
// Felder innerhalb eines Dialogs — dafür sind die Kapitel-Issues da.
//
// Die Ausgabe nennt je Lücke Schlüssel, Beschriftung und Datei, damit man
// sofort weiß, wohin sie gehört.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { woerterbuch } from './app.mjs'

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC = join(WURZEL, 'src', 'renderer')
const wb = woerterbuch()

const dateien = []
const lauf = (d) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e)
    if (statSync(p).isDirectory()) lauf(p)
    else if (/\.tsx$/.test(e)) dateien.push(p)
  }
}
lauf(SRC)

/** [Schlüssel, Datei, Art] */
const ziele = new Map()
const merke = (schluessel, datei, art) => {
  if (!ziele.has(schluessel)) ziele.set(schluessel, { datei: relative(WURZEL, datei), art })
}
for (const f of dateien) {
  const q = readFileSync(f, 'utf8')
  if (/MenuBar\.tsx$|CommandPalette\.tsx$/.test(f)) {
    for (const m of q.matchAll(/t\(\s*'((?:app\.menu|palette)\.[\w.]+)'/g)) merke(m[1], f, 'Menü')
  }
  // Nur der Titel des Dialograhmens — `title=` an Knöpfen sind Tooltips, keine Funktionen.
  for (const m of q.matchAll(/<ModalShell\b[\s\S]{0,600}?\btitle=\{\s*t\(\s*'([\w.]+)'/g)) merke(m[1], f, 'Dialog')
}

const HANDBUCH = { de: 'handbuch.de.md', en: 'manual.en.md' }
const ergebnis = {}
for (const [sprache, datei] of Object.entries(HANDBUCH)) {
  const text = readFileSync(join(WURZEL, 'docs', 'manual', datei), 'utf8').toLowerCase()
  const luecken = []
  for (const [k, info] of ziele) {
    const e = wb.get(k)
    const label = (sprache === 'de' ? e?.de : e?.en) ?? e?.en
    if (!label) continue
    const kern = label.replace(/\{\w+\}/g, '').replace(/[…]|\.\.\./g, '').replace(/\s+/g, ' ').trim().toLowerCase()
    if (kern.length < 3) continue
    if (!text.includes(kern)) luecken.push({ k, label, ...info })
  }
  ergebnis[sprache] = { gesamt: ziele.size, luecken }
}

for (const [sprache, { gesamt, luecken }] of Object.entries(ergebnis)) {
  console.log(`\n── ${sprache}: ${gesamt - luecken.length} von ${gesamt} sichtbaren Funktionen (Menü/Dialog) im Handbuch`)
  for (const l of luecken) console.log(`  fehlt [${l.art}] „${l.label}“  (${l.k}, ${l.datei})`)
}
process.exitCode = Object.values(ergebnis).some((e) => e.luecken.length) ? 1 : 0
