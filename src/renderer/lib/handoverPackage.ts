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
import { INSTALL_STATUS_LABEL, type InstallStatus } from '../types/lifecycle'
import { kanonisch } from './kanonisch'
import { satz, satzKanonisch } from './satz'

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
      ['Übergabe-Datum', m.handoverDate ?? ''],
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
    ['Geräte', String(project.equipment.length)],
    ['Kabel', String(project.cables.length)],
    ['Gesamtlänge', project.cables.reduce((s, c) => s + (c.length ?? 0), 0).toFixed(1)],
    ['Räume', String((project.locations ?? []).length)],
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

export const buildHandoverManifest = (project: CablePlannerProject, stamp?: DocumentStamp): string => {
  const m = project.metadata
  const assets = buildAssetRows(project)
  const bom = buildCableBomRows(project)
  const statusCounts = cableStatusCounts(project)
  const tested = project.cables.filter((c) => c.testResult).length
  const passed = project.cables.filter((c) => c.testResult?.result === 'pass').length
  const totalLength = project.cables.reduce((s, c) => s + (c.length ?? 0), 0)
  const asBuilt = (project.revisions ?? []).filter((r) => r.asBuilt)

  const lines: string[] = []
  lines.push(
    satzKanonisch(
      satz('handover.md.title', '# Handover documentation — {name}', {
        name: m.name || kanonisch('handover.md.system', 'System'),
      }),
    ),
  )
  lines.push('')
  lines.push(
    satzKanonisch(
      satz('handover.md.created', 'Created: {datum}', {
        datum: fmtDate(new Date().toISOString()),
      }),
    ),
  )
  lines.push('')
  lines.push(kanonisch('handover.md.s1', '## 1 · Project / system'))
  lines.push('')
  lines.push(satzKanonisch(satz('handover.md.systemLine', '- **System:** {v}', { v: m.name || '—' })))
  lines.push(satzKanonisch(satz('handover.md.site', '- **Site:** {v}', { v: m.siteAddress || '—' })))
  lines.push(satzKanonisch(satz('handover.md.client', '- **Client:** {v}', { v: m.client || '—' })))
  lines.push(
    satzKanonisch(
      satz('handover.md.contractor', '- **Installer:** {v}', {
        v: m.contractor || m.author || '—',
      }),
    ),
  )
  lines.push(
    satzKanonisch(
      satz('handover.md.projectNo', '- **Project no.:** {v}', {
        v: m.projectNumber || '—',
      }),
    ),
  )
  lines.push(
    satzKanonisch(
      satz('handover.md.handoverDate', '- **Handover date:** {v}', {
        v: fmtDate(m.handoverDate),
      }),
    ),
  )
  lines.push(
    satzKanonisch(
      satz('handover.md.service', '- **Maintenance provider:** {v}', {
        v: m.serviceProvider || '—',
      }),
    ),
  )
  lines.push(
    satzKanonisch(
      satz('handover.md.emergency', '- **Emergency/service contact:** {v}', {
        v: m.emergencyContact || '—',
      }),
    ),
  )
  // Initiative 4 — „Rev 2" alleine behauptet, dieses Dokument sei Rev 2. Der
  // Stempel wird beim Festschreiben gesetzt und bleibt stehen, waehrend der
  // Plan weiterlaeuft.
  lines.push(
    `- **Aktuelle Revision:** ${
      m.revision
        ? stamp?.drifted
          ? satzKanonisch(
              satz('rest.stamp.drifted', '{rev} + changes', {
                rev: m.revision,
              }),
            )
          : m.revision
        : '—'
    }`,
  )
  lines.push('')
  lines.push(kanonisch('handover.md.s2', '## 2 · Scope (overview)'))
  lines.push('')
  lines.push(
    satzKanonisch(
      satz('handover.md.devices', '- Devices: **{n}**', {
        n: project.equipment.length,
      }),
    ),
  )
  lines.push(
    satzKanonisch(
      satz('handover.md.cables', '- Cables/connections: **{n}**', {
        n: project.cables.length,
      }),
    ),
  )
  lines.push(
    satzKanonisch(
      satz('handover.md.length', '- Total cable length: **{n} m**', {
        n: totalLength.toFixed(1),
      }),
    ),
  )
  lines.push(
    satzKanonisch(
      satz('handover.md.rooms', '- Rooms/areas: **{n}**', {
        n: (project.locations ?? []).length,
      }),
    ),
  )
  lines.push('')
  lines.push('## 3 · Commissioning / Status')
  lines.push('')
  for (const key of Object.keys(statusCounts)) {
    const label =
      key === 'unset'
        ? kanonisch('rest.handover.noStatus', 'no status')
        : (kanonisch(`lifecycle.status.${key as InstallStatus}`, INSTALL_STATUS_LABEL[key as InstallStatus]) ?? key)
    lines.push(`- ${label}: ${statusCounts[key]}`)
  }
  lines.push(
    satzKanonisch(
      satz('handover.md.tested', '- Cables tested: **{n}** (of which PASS: **{pass}**)', { n: tested, pass: passed }),
    ),
  )
  if (asBuilt.length > 0) {
    lines.push('')
    lines.push(kanonisch('handover.md.asBuilt', '### As-built revisions'))
    for (const r of asBuilt) {
      lines.push(`- ${r.label} — ${fmtDate(r.createdAt)}${r.note ? ` — ${r.note}` : ''}`)
    }
  }
  lines.push('')
  lines.push(kanonisch('handover.md.s4', '## 4 · Cable bill of materials (with 10% reserve)'))
  lines.push('')
  lines.push(kanonisch('handover.md.bomHead', '| Type | Length (m) | Qty | incl. reserve |'))
  lines.push('|---|---|---|---|')
  for (const r of bom) {
    lines.push(`| ${r.type} | ${r.lengthM} | ${r.qty} | ${r.qtyWithReserve} |`)
  }
  lines.push('')
  lines.push(kanonisch('handover.md.s5', '## 5 · Asset register (excerpt)'))
  lines.push('')
  lines.push(kanonisch('handover.md.assetHead', '| Asset tag | Device | Location | Serial no. | Warranty until |'))
  lines.push('|---|---|---|---|---|')
  for (const a of assets) {
    lines.push(`| ${a.assetTag} | ${a.name} | ${a.location || '—'} | ${a.serial || '—'} | ${a.warrantyUntil || '—'} |`)
  }
  lines.push('')
  lines.push(kanonisch('handover.md.s6', '## 6 · Included files'))
  lines.push('')
  lines.push(kanonisch('handover.md.fPull', '- `pull-liste.csv` — pull list per cable'))
  lines.push(kanonisch('handover.md.fTerm', '- `termination-liste.csv` — termination per cable end'))
  lines.push(
    satzKanonisch(
      satz('handover.md.fSchedule', '- `{datei}` — cable register', {
        datei: 'kabel-schedule.csv',
      }),
    ),
  )
  lines.push(
    satzKanonisch(
      satz('handover.md.fBom', '- `{datei}` — bill of materials incl. reserve', { datei: 'kabel-bom.csv' }),
    ),
  )
  lines.push(kanonisch('handover.md.fAsset', '- `asset-register.csv` — device/asset register'))
  lines.push(kanonisch('handover.md.fPdf', '- Plan PDF / as-built diagram (separately from the export dialog)'))
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push(kanonisch('handover.md.footer1', '_Created with LZ Cable Planner. This documentation is vendor-neutral —'))
  lines.push(kanonisch('handover.md.footer2', 'any qualified service provider can take over the system._'))
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
