#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// Der RUECKWEG: Gemeinschaftsgeraete aus der Bibliothek in diesen Katalog.
// Lauf: `npm run library:fetch`
//
// BRAUCHT `npm ci`, anders als `library-publish.mjs`: `pruefeVorlage` haengt
// ueber `uiStore` an zustand.
//
// GESTARTET MIT `register-endungen.mjs`, wie `katalog:uebernahme`. Die
// App-Module importieren einander ohne `.ts`-Endung; bares Node findet sie
// deshalb nicht (`ERR_MODULE_NOT_FOUND` auf `lib/portLabel`). Der Loader
// dieses Repos haengt die Endung an.
//
// KEIN eigener npm-Pruef-Lauf. `--pruefen` gibt es als Flagge fuer die Hand,
// aber nicht als Skript: ein Prueflauf in `package.json`, den kein Workflow
// faehrt, ist laut `ci:complete` keine Zusicherung, sondern eine Notiz — und
// als PR-Tor taugt er nicht, denn die Datei veraltet planmaessig, sobald
// jemand ein Geraet in der Bibliothek bestaetigt. Dass sie nachgezogen wird,
// sichert `library-fetch.yml` naechtlich zu, indem es einen PR oeffnet.
//
// WARUM ES DAS GIBT. `library-publish.mjs` schickt den Katalog dieses Repos
// nach devices.zumpelars.de. Der Weg zurueck fehlte: ein Geraet, das jemand
// anders in der Bibliothek angelegt hat, bekam nur, wer in der App ANGEMELDET
// ist — der Abgleich im Programm (`deviceLibraryStore`) braucht ein Konto.
// Nutzeraufgabe war aber „das sharing von geraeten global in allen
// installationen von cableplanner verfuegbar" und „av device library soll
// auch immer alle haben und auch die community geraete verwalten und bei dem
// naechsten update dann immer mit in github ausrollen".
//
// Also wandern die bestaetigten Gemeinschaftsgeraete in eine VENDORIERTE
// Datei (`gemeinschaftsKatalog.ts`, eingecheckt) und gehen mit der naechsten
// Fassung an jede Installation — auch ohne Konto, auch offline.
//
// WELCHE. Nur `status=confirmed` oder besser: mindestens ein anderer Mensch
// hat die Angaben gegen Datenblatt oder Gerät geprueft. Unbestaetigtes
// bleibt in der Bibliothek, wo es als unbestaetigt erkennbar ist — in einer
// ausgelieferten Katalogdatei waere es das nicht.
//
// UND NICHT DIE EIGENEN. Was aus diesem Repo stammt, kommt nicht als
// „Gemeinschaftsgeraet" zurueck: sonst stuende jede Vorlage zweimal im
// Katalog, und der naechste `library:publish` lud sie als neues Geraet
// wieder hoch. Erkannt wird das an der Geraetetyp-GUID und am Namen.
//
// GEPRUEFT WIRD MIT DERSELBEN REGEL wie beim Abgleich im Programm
// (`pruefeVorlage`). Eine Vorlage, die die App selbst ablehnen wuerde, gehoert
// nicht in ihren Katalog — sie wird gezaehlt und genannt, nicht stillschweigend
// uebernommen.
//
// Umgebung:
//   DEVICE_LIBRARY_KEY   API-Schluessel (Pflicht; ohne ihn: Hinweis, Erfolg)
//   DEVICE_LIBRARY_URL   Server (Vorgabe: DEFAULT_DEVICE_LIBRARY_URL)
//   --pruefen            nichts schreiben, nur melden, ob die Datei veraltet ist
//   --status=verified    strenger: nur verifizierte Geraete
// ───────────────────────────────────────────────────────────────────────────
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const { EINGEBAUTER_KATALOG } = await import('../src/renderer/lib/eingebauterKatalog.ts')
const { pruefeVorlage } = await import('../src/renderer/lib/vorlagenEinreichung.ts')
const { ALL_CONNECTOR_TYPES } = await import('../src/renderer/types/equipment.ts')
const { heileSteckertyp } = await import('../src/renderer/lib/connectorRenames.ts')
const { DEFAULT_DEVICE_LIBRARY_URL } = await import('../src/renderer/lib/deviceLibraryClient.ts')

const HIER = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ZIEL = join(HIER, 'src', 'renderer', 'lib', 'gemeinschaftsKatalog.ts')

const NUR_PRUEFEN = process.argv.includes('--pruefen')
const status = (process.argv.find((a) => a.startsWith('--status=')) ?? '--status=confirmed').slice(9)
const key = process.env.DEVICE_LIBRARY_KEY?.trim()
const server = (process.env.DEVICE_LIBRARY_URL?.trim() || DEFAULT_DEVICE_LIBRARY_URL).replace(/\/$/, '')

const bericht = []
const sag = (zeile = '') => {
  console.log(zeile)
  bericht.push(zeile)
}
const warnung = (text) => {
  sag(`> [!WARNING]\n> ${text}`)
  if (process.env.GITHUB_ACTIONS) console.log(`::warning::${text}`)
}
const fertig = (code) => {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${bericht.join('\n')}\n`)
  process.exit(code)
}

// ─── Geraetetyp-GUID: abgeleitet, nicht gewuerfelt ─────────────────────────
//
// Derselbe Namensraum wie in `katalog-uebernahme.mjs` — eine zweite Wurzel
// hiesse neue GUIDs und damit ins Leere zeigende Verknuepfungen in jedem
// gespeicherten Plan. Quelle ist der Slug der Bibliothek: er aendert sich
// nicht, auch wenn das Geraet umbenannt wird.
const NAMESPACE = 'a7f3c1e2-5b84-5d16-9c3a-7e2f4b8d0a61'
const uuid5 = (name) => {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex')
  const b = Buffer.from(createHash('sha1').update(Buffer.concat([ns, Buffer.from(name, 'utf8')])).digest().subarray(0, 16))
  b[6] = (b[6] & 0x0f) | 0x50
  b[8] = (b[8] & 0x3f) | 0x80
  const h = b.toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const schluessel = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

const bekannteStecker = new Set(ALL_CONNECTOR_TYPES)

const eigeneIds = new Set(EINGEBAUTER_KATALOG.map((t) => t.deviceTypeId).filter(Boolean))
const eigeneNamen = new Set(EINGEBAUTER_KATALOG.map((t) => schluessel(t.name)))

// ─── Holen ─────────────────────────────────────────────────────────────────

if (!key) {
  warnung('DEVICE_LIBRARY_KEY ist nicht gesetzt — nichts geholt. Der Gemeinschaftskatalog bleibt, wie er ist. (Secret im Repo anlegen.)')
  fertig(0)
}

let antwort
try {
  const res = await fetch(`${server}/api/export?planner=cable&status=${encodeURIComponent(status)}`, {
    headers: { authorization: `Bearer ${key}`, 'x-requested-with': 'cable-planner' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  antwort = await res.json()
} catch (e) {
  sag(`## Gemeinschaftskatalog ← ${server}`)
  sag(`\nHolen gescheitert: ${e?.message ?? e}`)
  fertig(1)
}

const alle = Array.isArray(antwort?.templates) ? antwort.templates : []

const genommen = []
const eigen = []
const abgelehnt = []
for (const eintrag of alle) {
  const { verifiedBy, library, ...vorlage } = eintrag
  if (!library?.slug || typeof vorlage.name !== 'string') continue
  if ((vorlage.deviceTypeId && eigeneIds.has(vorlage.deviceTypeId)) || eigeneNamen.has(schluessel(vorlage.name))) {
    eigen.push(vorlage.name)
    continue
  }
  const befunde = pruefeVorlage(vorlage)
  if (befunde.some((b) => b.blockiert)) {
    abgelehnt.push(`${vorlage.name} — ${befunde.filter((b) => b.blockiert).map((b) => b.art).join(', ')}`)
    continue
  }
  // STECKERTYPEN, DIE DIESE APP NICHT KENNT.
  //
  // `ConnectorType` ist eine Aufzaehlung; ein unbekannter Wert laesst die
  // erzeugte Datei nicht uebersetzen (gefunden beim ersten Lauf: ein Geraet
  // trug „PowerCon True 1", die App fuehrt „powerCON TRUE1"). Ein anderer
  // Planner und das Formular im Browser kennen die Aufzaehlung nicht.
  //
  // Zugeordnet wird NICHT geraten: aus „PowerCon True 1" „powerCON TRUE1" zu
  // machen ist hier offensichtlich, bei zwei aehnlichen Normen nicht mehr,
  // und eine falsche Zuordnung wandert still in Patchliste und Verkabelung.
  // Der Eintrag wird genannt und bleibt draussen, bis ihn jemand in der
  // BIBLIOTHEK richtigstellt — dort gehoert die Korrektur hin.
  // Bekannte Schreibweisen zuerst gerade ziehen — dieselbe Tabelle, mit der
  // die App gespeicherte Plaene und Vorlagen heilt (`connectorRenames.ts`).
  for (const liste of [vorlage.inputs, vorlage.outputs]) {
    for (const port of liste ?? []) if (port?.connectorType) port.connectorType = heileSteckertyp(port.connectorType)
  }
  const fremd = [...(vorlage.inputs ?? []), ...(vorlage.outputs ?? [])]
    .map((p) => p?.connectorType)
    .filter((c) => c && !bekannteStecker.has(c))
  if (fremd.length) {
    abgelehnt.push(`${vorlage.name} — Steckertyp unbekannt: ${[...new Set(fremd)].join(', ')}`)
    continue
  }
  // `EquipmentTemplate` hat kein `id` (`Omit<EquipmentItem, 'id'…>`) — eine
  // Vorlage wird am Namen erkannt, die Instanz bekommt ihre Id beim Platzieren.
  delete vorlage.id
  genommen.push({
    ...vorlage,
    deviceTypeId: vorlage.deviceTypeId || uuid5(`avplan:library:${library.slug}`),
    gemeinschaft: { slug: library.slug, version: library.version, status: library.status, url: library.url },
  })
}

genommen.sort((a, b) => a.gemeinschaft.slug.localeCompare(b.gemeinschaft.slug))

// ─── Schreiben ─────────────────────────────────────────────────────────────

const kopf = `// ───────────────────────────────────────────────────────────────────────────
// ERZEUGT von \`scripts/library-fetch.mjs\` — nicht von Hand aendern.
// Lauf: \`npm run library:fetch\` (naechtlich in \`library-fetch.yml\`).
//
// Geraete, die die GEMEINSCHAFT in der Bibliothek angelegt und bestaetigt hat
// (Status \`${status}\` oder besser). Sie liegen hier eingecheckt, damit jede
// Installation sie bekommt — auch ohne Konto und offline. Wer angemeldet ist,
// bekommt ueber den Abgleich im Programm ausserdem den tagesaktuellen Stand.
//
// Was aus DIESEM Repo stammt, steht hier NICHT: es stuende sonst zweimal im
// Katalog. \`libraryRef\` haelt fest, woher ein Eintrag kommt.
//
// Quelle: ${server}
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentTemplate } from '../types/equipment.ts'

export const gemeinschaftsTemplates: readonly EquipmentTemplate[] = `

const inhalt = `${kopf}${JSON.stringify(genommen, null, 2)}\n`

let alt = null
try {
  alt = readFileSync(ZIEL, 'utf8')
} catch {
  /* noch nicht da */
}

sag(`## Gemeinschaftskatalog ← ${server}`)
sag(`${alle.length} Geraete mit Kabel-Ansicht im Export (Status ${status}): ${genommen.length} uebernommen, ${eigen.length} aus diesem Repo, ${abgelehnt.length} abgelehnt.`)
if (abgelehnt.length) {
  sag(`\n### Abgelehnt (${abgelehnt.length}) — die App selbst wuerde sie nicht annehmen`)
  for (const z of abgelehnt) sag(`- ${z}`)
}

if (alt === inhalt) {
  sag('\nDatei unveraendert.')
  fertig(0)
}
if (NUR_PRUEFEN) {
  warnung('`gemeinschaftsKatalog.ts` ist VERALTET — `npm run library:fetch` ausfuehren und das Ergebnis einchecken.')
  fertig(1)
}
writeFileSync(ZIEL, inhalt)
sag(`\nDatei ${alt === null ? 'neu angelegt' : 'aktualisiert'}: src/renderer/lib/gemeinschaftsKatalog.ts`)
fertig(0)
