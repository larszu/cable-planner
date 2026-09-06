/**
 * Festinstallation — Übergabe-/Closeout-Paket für den Betreiber.
 *
 * Die Branche hat eine feste Inhaltsliste für das Handover (As-built, O&M,
 * Asset-Register, Commissioning, Garantien, Reserve-/Ersatzteile). Diese
 * Funktion baut daraus ein menschenlesbares Übergabe-Dokument (Markdown) +
 * eine Datei-Liste, die der Dialog einzeln als Download anbietet.
 */
import type { CablePlannerProject } from '../types/project'
import type { CsvTable } from './csv'
import { buildAssetRows, assetRegisterTable } from './assetRegister'
import { buildCableBomRows, cableBomTable } from './installerLists'
import { stampLine, type DocumentStamp } from './documentStamp'
import { buildDocQrPayload } from './qrPayload'
import { INSTALL_STATUS_LABEL, type InstallStatus } from './../types/lifecycle'

const fmtDate = (iso?: string): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('de-DE')
}

/** Zählt Kabel je Status für die Commissioning-Übersicht. */
const cableStatusCounts = (project: CablePlannerProject): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const c of project.cables) {
    const key = c.installStatus ?? 'unset'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

/**
 * Der Inhalt, den das Uebergabe-Dokument zeigt — als Tabelle, damit
 * `stampForRows` denselben Aufbau auf den Revisions-Snapshot anwenden kann.
 *
 * WAS HIER FEHLTE (gemessen 2026-09-04, Gegenrunde). Der Fingerabdruck lief
 * ueber Asset-Register und Kabel-Stueckliste, und der Kommentar begruendete
 * das damit, der Rest des Blattes aendere sich zwischen Revisionen nicht. Das
 * stimmt nicht: Abschnitt 2 zaehlt `project.locations`, Abschnitt 3 liest
 * `c.installStatus`, `c.testResult` und die As-Built-Revisionen — und keine
 * dieser Groessen kommt in einer der beiden Tabellen vor. `assetRegisterTable`
 * laeuft ueber `project.equipment` (Kabel stehen dort gar nicht),
 * `cableBomTable` bucketiert nach `Typ|Laenge|Festverbindung` und hat keine
 * Status-Spalte.
 *
 * Der Fehlgang, beide Enden ueber die Oberflaeche erreichbar: Uebergabe
 * drucken, dann in den Kabel-Eigenschaften den Installations-Status setzen
 * oder ein Testergebnis eintragen. Abschnitt 3 des ausgeteilten Blattes ist
 * dann nachweislich falsch — und der Stand bleibt gleich, der Rueckweg meldet
 * gruen „aktueller Stand".
 *
 * Das ist woertlich die Fehlerform, gegen die ADR-004 geschrieben wurde
 * („Ein Blatt, das den Aufbaustand von gestern zeigt, meldete sich im
 * Dokument-Register als aktueller Stand") — und ausgerechnet auf dem Blatt,
 * das die ADR selbst als das schwerste bezeichnet: es geht an den Betreiber
 * und liegt dort jahrelang.
 *
 * DIE REGEL, die daraus folgt und die hier gilt: **was auf dem Blatt steht,
 * geht in den Fingerabdruck.** Nicht „was sich vermutlich aendert" — diese
 * Vermutung war der Fehler. Deshalb sind jetzt auch die Kopf-Felder dabei,
 * die veraenderlich UND gedruckt sind (Uebergabe-Datum, wartender
 * Dienstleister, Notfallkontakt, Revision); der Standort- und Kundenblock
 * ebenfalls, weil ein geaendertes Kundenfeld dasselbe Blatt falsch macht.
 */
export const handoverTable = (project: CablePlannerProject): CsvTable => {
  const assets = assetRegisterTable(project)
  const bom = cableBomTable(project)
  const kopf = kopfTable(project)
  const stand = commissioningTable(project)
  return {
    headers: [...kopf.headers, ...assets.headers, ...bom.headers, ...stand.headers],
    rows: [...kopf.rows, ...assets.rows, ...bom.rows, ...stand.rows],
  }
}

/** Abschnitt 1 — die veraenderlichen, gedruckten Kopf-Felder. */
const kopfTable = (project: CablePlannerProject): CsvTable => {
  const m = project.metadata
  return {
    headers: ['Feld', 'Wert'],
    rows: [
      ['Anlage', m.name ?? ''],
      ['Standort', m.siteAddress ?? ''],
      ['Kunde', m.client ?? ''],
      ['Errichter', m.contractor ?? m.author ?? ''],
      ['Projekt-Nr.', m.projectNumber ?? ''],
      ['Uebergabe-Datum', m.handoverDate ?? ''],
      ['Wartender Dienstleister', m.serviceProvider ?? ''],
      ['Notfallkontakt', m.emergencyContact ?? ''],
      // `m.revision` steht bewusst NICHT drin, obwohl es gedruckt wird: die
      // Revisions-Zeile des Dokuments zeigt die Abweichung selbst an („Rev 1 +
      // Aenderungen"). Das Etikett in den Fingerabdruck zu nehmen machte die
      // Anzeige zirkulaer und liesse ein frisch festgeschriebenes Blatt
      // abweichen, nur weil das Etikett nach dem Snapshot vergeben wurde.
    ],
  }
}

/**
 * Abschnitt 2 und 3 — Umfang und Commissioning.
 *
 * Die Status-Schluessel werden sortiert, damit der Fingerabdruck nicht davon
 * abhaengt, in welcher Reihenfolge jemand die Kabel angelegt hat: derselbe
 * Plan muss denselben Stand ergeben. Genau diese Sorte Reihenfolge-Abhaengigkeit
 * hat in derselben Gegenrunde die Tally-Karte getroffen.
 */
const commissioningTable = (project: CablePlannerProject): CsvTable => {
  const counts = cableStatusCounts(project)
  const rows: string[][] = [
    ['Geraete', String(project.equipment.length)],
    ['Kabel', String(project.cables.length)],
    ['Gesamtlaenge', project.cables.reduce((s, c) => s + (c.length ?? 0), 0).toFixed(1)],
    ['Raeume', String((project.locations ?? []).length)],
    ['Getestet', String(project.cables.filter((c) => c.testResult).length)],
    ['PASS', String(project.cables.filter((c) => c.testResult?.result === 'pass').length)],
  ]
  for (const key of Object.keys(counts).sort()) rows.push([`Status ${key}`, String(counts[key])])
  // Die As-Built-Zeilen des Dokuments stehen hier NICHT, obwohl sie gedruckt
  // werden. `tests/changeImpact.test.ts` haelt fest, warum: der
  // Revisions-Vergleich spannt einen Snapshot mit `revisions: []` auf — der
  // Typ fuehrt das Feld nicht. Eine Ableitung, die die Revisionsliste liest,
  // meldete danach JEDES Uebergabe-Blatt als ueberholt, allein weil die Liste
  // leer ist. Eine erfundene Abweichung ist derselbe Schaden wie ein
  // erfundener Zustand (ADR-003), und dieser hier waere sogar der haeufigere.
  //
  // Ich habe das beim ersten Anlauf falsch gemacht und der bestehende Guard hat
  // es gefangen. Er stand vor dieser Aenderung da und hat genau den Fall
  // vorhergesagt — deshalb bleibt die Begruendung hier stehen und nicht nur
  // dort.
  return { headers: ['Kennzahl', 'Wert'], rows }
}

export const buildHandoverManifest = (
  project: CablePlannerProject,
  stamp?: DocumentStamp,
): string => {
  const m = project.metadata
  const assets = buildAssetRows(project)
  const bom = buildCableBomRows(project)
  const statusCounts = cableStatusCounts(project)
  const tested = project.cables.filter((c) => c.testResult).length
  const passed = project.cables.filter((c) => c.testResult?.result === 'pass').length
  const totalLength = project.cables.reduce((s, c) => s + (c.length ?? 0), 0)
  const asBuilt = (project.revisions ?? []).filter((r) => r.asBuilt)

  const lines: string[] = []
  lines.push(`# Übergabe-Dokumentation — ${m.name || 'Anlage'}`)
  lines.push('')
  lines.push(`Erstellt: ${fmtDate(new Date().toISOString())}`)
  lines.push('')
  lines.push('## 1 · Projekt / Anlage')
  lines.push('')
  lines.push(`- **Anlage:** ${m.name || '—'}`)
  lines.push(`- **Standort:** ${m.siteAddress || '—'}`)
  lines.push(`- **Kunde:** ${m.client || '—'}`)
  lines.push(`- **Errichter:** ${m.contractor || m.author || '—'}`)
  lines.push(`- **Projekt-Nr.:** ${m.projectNumber || '—'}`)
  lines.push(`- **Übergabe-Datum:** ${fmtDate(m.handoverDate)}`)
  lines.push(`- **Wartender Dienstleister:** ${m.serviceProvider || '—'}`)
  lines.push(`- **Notfall-/Servicekontakt:** ${m.emergencyContact || '—'}`)
  // Initiative 4 — „Rev 2" alleine behauptet, dieses Dokument sei Rev 2. Der
  // Stempel wird beim Festschreiben gesetzt und bleibt stehen, waehrend der
  // Plan weiterlaeuft.
  lines.push(
    `- **Aktuelle Revision:** ${
      m.revision ? (stamp?.drifted ? `${m.revision} + Änderungen` : m.revision) : '—'
    }`,
  )
  lines.push('')
  lines.push('## 2 · Umfang (Überblick)')
  lines.push('')
  lines.push(`- Geräte: **${project.equipment.length}**`)
  lines.push(`- Kabel/Verbindungen: **${project.cables.length}**`)
  lines.push(`- Gesamt-Kabellänge: **${totalLength.toFixed(1)} m**`)
  lines.push(`- Räume/Bereiche: **${(project.locations ?? []).length}**`)
  lines.push('')
  lines.push('## 3 · Commissioning / Status')
  lines.push('')
  for (const key of Object.keys(statusCounts)) {
    const label =
      key === 'unset' ? 'ohne Status' : INSTALL_STATUS_LABEL[key as InstallStatus] ?? key
    lines.push(`- ${label}: ${statusCounts[key]}`)
  }
  lines.push(`- Kabel getestet: **${tested}** (davon PASS: **${passed}**)`)
  if (asBuilt.length > 0) {
    lines.push('')
    lines.push('### As-Built-Revisionen')
    for (const r of asBuilt) {
      lines.push(`- ${r.label} — ${fmtDate(r.createdAt)}${r.note ? ` — ${r.note}` : ''}`)
    }
  }
  lines.push('')
  lines.push('## 4 · Kabel-Stückliste (mit 10% Reserve)')
  lines.push('')
  lines.push('| Typ | Länge (m) | Menge | inkl. Reserve |')
  lines.push('|---|---|---|---|')
  for (const r of bom) {
    lines.push(`| ${r.type} | ${r.lengthM} | ${r.qty} | ${r.qtyWithReserve} |`)
  }
  lines.push('')
  lines.push('## 5 · Asset-Register (Auszug)')
  lines.push('')
  lines.push('| Asset-Tag | Gerät | Standort | Serien-Nr. | Garantie bis |')
  lines.push('|---|---|---|---|---|')
  for (const a of assets) {
    lines.push(`| ${a.assetTag} | ${a.name} | ${a.location || '—'} | ${a.serial || '—'} | ${a.warrantyUntil || '—'} |`)
  }
  lines.push('')
  lines.push('## 6 · Enthaltene Dateien')
  lines.push('')
  lines.push('- `pull-liste.csv` — Pull-/Verlege-Liste je Kabel')
  lines.push('- `termination-liste.csv` — Terminierung je Kabelende')
  lines.push('- `kabel-schedule.csv` — Kabel-Register')
  lines.push('- `kabel-bom.csv` — Stückliste inkl. Reserve')
  lines.push('- `asset-register.csv` — Geräte-/Asset-Register')
  lines.push('- Plan-PDF / As-built-Schema (separat aus dem Export-Dialog)')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('_Erzeugt mit Cable-Planner. Diese Doku ist vendor-neutral —')
  lines.push('jeder qualifizierte Dienstleister kann die Anlage übernehmen._')
  if (stamp) {
    lines.push('')
    lines.push(`_${stampLine(stamp)}_`)
    // ADR-004 Inkrement 3 — der Dokument-Code auch auf diesem Blatt. Die acht
    // Zeichen darueber sagen im Mobile-Viewer "aktuell" oder "gehoert zu
    // keinem aktuellen Blatt"; der Code nennt zusaetzlich das Dokument und
    // macht daraus "Uebergabe: VERALTET, aktueller Stand #xyz".
    lines.push('')
    lines.push(`\`${buildDocQrPayload('uebergabe', stamp.fingerprint, stamp.revision)}\``)
  }
  return lines.join('\n')
}

/** Einzelne Datei-Bausteine des Übergabe-Pakets (der Dialog lädt sie herunter). */
export interface HandoverFile {
  name: string
  content: string
  mime: string
}
