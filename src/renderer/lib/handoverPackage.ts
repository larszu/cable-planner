/**
 * Festinstallation — Übergabe-/Closeout-Paket für den Betreiber.
 *
 * Die Branche hat eine feste Inhaltsliste für das Handover (As-built, O&M,
 * Asset-Register, Commissioning, Garantien, Reserve-/Ersatzteile). Diese
 * Funktion baut daraus ein menschenlesbares Übergabe-Dokument (Markdown) +
 * eine Datei-Liste, die der Dialog einzeln als Download anbietet.
 */
import type { CablePlannerProject } from '../types/project'
import { buildAssetRows } from './assetRegister'
import { buildCableBomRows } from './installerLists'
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

export const buildHandoverManifest = (project: CablePlannerProject): string => {
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
  lines.push(`- **Aktuelle Revision:** ${m.revision || '—'}`)
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
  return lines.join('\n')
}

/** Einzelne Datei-Bausteine des Übergabe-Pakets (der Dialog lädt sie herunter). */
export interface HandoverFile {
  name: string
  content: string
  mime: string
}
