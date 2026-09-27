#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// Den eingebauten Katalog in der Geraetebibliothek veroeffentlichen.
// Lauf: `npm run library:publish` (lokal) bzw. `library-publish.yml` (CI).
//
// WARUM ES DAS GIBT. „Alle Daten aus allen Plannern sollen immer auch auf
// devices.zumpelars.de sein." Die eigenen Vorlagen eines Nutzers laedt die
// App hoch; der eingebaute Katalog ist aber keine Vorlage eines Nutzers,
// sondern Teil dieses Repos — er geht deshalb von hier aus hoch, einmal je
// Aenderung, und nicht von jedem Rechner einzeln.
//
// WIE. Der Katalog und die Abbildung auf Upload-Eintraege kommen aus
// denselben Dateien wie in der App (`eingebauterKatalog.ts`,
// `deviceLibraryItem.ts`) — Node laedt sie direkt, Typen werden gestrichen.
// Hochgeladen wird mit einem API-Schluessel (`dlk_…`) eines Admin-Kontos:
// der darf nur lesen und hochladen, und Admin-Uploads gehen direkt live.
// Unveraenderte Eintraege meldet der Server als `in-sync`; ein zweiter Lauf
// ohne Aenderung aendert dort nichts.
//
// WAS NICHT HOCHGEHT, UND WARUM ES GENANNT WIRD. Eintraege ohne
// Datenblattlink und ohne erkennbaren Hersteller werden AUFGELISTET, nicht
// geraten: ein erfundener Link oder Hersteller stuende danach in der
// Bibliothek wie ein belegter.
//
// Umgebung:
//   DEVICE_LIBRARY_KEY   API-Schluessel (Pflicht; ohne ihn: Hinweis, Erfolg)
//   DEVICE_LIBRARY_URL   Server (Vorgabe: DEFAULT_DEVICE_LIBRARY_URL)
//   --dry-run            nur abbilden und berichten, nichts senden
// ───────────────────────────────────────────────────────────────────────────
import { appendFileSync } from 'node:fs'

const { EINGEBAUTER_KATALOG } = await import('../src/renderer/lib/eingebauterKatalog.ts')
const { uploadItemAus } = await import('../src/renderer/lib/deviceLibraryItem.ts')
const { DEFAULT_DEVICE_LIBRARY_URL, upload } = await import('../src/renderer/lib/deviceLibraryClient.ts')

const trocken = process.argv.includes('--dry-run')
const key = process.env.DEVICE_LIBRARY_KEY?.trim()
const server = process.env.DEVICE_LIBRARY_URL?.trim() || DEFAULT_DEVICE_LIBRARY_URL

const bericht = []
const sag = (zeile = '') => {
  console.log(zeile)
  bericht.push(zeile)
}
const zusammenfassung = () => {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${bericht.join('\n')}\n`)
}

const items = []
const ohneQuelle = []
const ohneHersteller = []
for (const t of EINGEBAUTER_KATALOG) {
  const item = uploadItemAus(t)
  if (!item.core.manufacturer) ohneHersteller.push(t.name)
  else if (!/^https?:\/\//i.test(item.core.sourceUrl)) ohneQuelle.push(t.name)
  else items.push(item)
}

sag(`## Katalog → ${server}`)
sag(`${EINGEBAUTER_KATALOG.length} Vorlagen im Katalog, ${items.length} hochladbar.`)
if (ohneQuelle.length) {
  sag(`\n### Ohne Datenblattlink (${ohneQuelle.length}) — nicht hochgeladen`)
  for (const n of ohneQuelle) sag(`- ${n}`)
}
if (ohneHersteller.length) {
  sag(`\n### Ohne erkennbaren Hersteller (${ohneHersteller.length}) — nicht hochgeladen`)
  for (const n of ohneHersteller) sag(`- ${n}`)
}

if (trocken) {
  sag('\n--dry-run: nichts gesendet.')
  zusammenfassung()
  process.exit(0)
}
if (!key) {
  sag('\nDEVICE_LIBRARY_KEY ist nicht gesetzt — nichts gesendet. (Secret im Repo anlegen, um zu veroeffentlichen.)')
  zusammenfassung()
  process.exit(0)
}

let ergebnisse
try {
  ergebnisse = await upload(server, key, 'cable', items)
} catch (e) {
  sag(`\nHochladen gescheitert: ${e?.code ?? ''} ${e?.status ?? ''} ${e?.message ?? e}`)
  zusammenfassung()
  process.exit(1)
}

const je = {}
for (const r of ergebnisse) (je[r.state] ??= []).push(r)
sag('\n### Ergebnis')
for (const [state, liste] of Object.entries(je)) sag(`- ${state}: ${liste.length}`)
for (const r of [...(je.blocked ?? []), ...(je.error ?? [])]) {
  const warum = r.error ?? JSON.stringify(r.findings ?? '')
  sag(`  - ${r.state} · ${r.localId}: ${warum}`)
}
zusammenfassung()
// Blockierte Eintraege sind ein Befund am Katalog, kein kaputter Lauf; ein
// Fehler beim Server dagegen schon.
process.exit(je.error?.length ? 1 : 0)
