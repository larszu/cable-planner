/**
 * Festinstallation — Listen für Elektro-/AV-Installateure.
 *
 * Installateure arbeiten nicht am Canvas, sondern aus editierbaren Listen
 * (Excel/CSV). Diese reinen Funktionen leiten aus dem Plan die branchen-
 * üblichen Dokumente ab:
 *   - Pull-Liste / Pull-Schedule (die Feld-To-do-Liste pro Kabel)
 *   - Termination-Liste (welcher Leiter/Stecker je Ende)
 *   - Kabel-Schedule (Design-Register aller Kabel)
 *   - Kabel-BOM mit Reserve-Aufschlag
 *
 * Spaltennamen orientieren sich an TIA-568-Pull-Schedule / Cable-Schedule.
 * Alles ist seiteneffektfrei und damit headless testbar.
 */
import type { CablePlannerProject } from '../types/project'
import type { Cable } from '../types/cable'
import type { EquipmentItem, Port } from '../types/equipment'
import { INSTALL_STATUS_LABEL } from '../types/lifecycle'
import { cableLabelId } from './docIds'
import { toCsv, type CsvCell } from './csv'

const portName = (eq: EquipmentItem | undefined, portId: string): string => {
  if (!eq) return ''
  const p =
    eq.outputs.find((x) => x.id === portId) ??
    eq.inputs.find((x) => x.id === portId)
  if (!p) return portId
  return p.contentLabel?.trim() || p.name || portId
}

const portObj = (eq: EquipmentItem | undefined, portId: string): Port | undefined =>
  eq?.outputs.find((x) => x.id === portId) ?? eq?.inputs.find((x) => x.id === portId)

const statusLabel = (c: Cable): string =>
  c.installStatus ? INSTALL_STATUS_LABEL[c.installStatus] : ''

const testLabel = (c: Cable): string => {
  if (!c.testResult) return ''
  const r = c.testResult.result === 'pass' ? 'PASS' : 'FAIL'
  const m =
    typeof c.testResult.marginDb === 'number' ? ` (${c.testResult.marginDb} dB)` : ''
  return `${r}${m}`
}

/** Index Equipment-ID → Item für schnelle Endpunkt-Auflösung. */
const indexEquipment = (project: CablePlannerProject) =>
  new Map(project.equipment.map((e) => [e.id, e]))

// --- Pull-Liste -----------------------------------------------------------

export interface PullListRow {
  labelId: string
  cableNumber: string
  name: string
  fromDevice: string
  fromPort: string
  toDevice: string
  toPort: string
  type: string
  lengthM: number
  layer: string
  pathway: string
  jacket: string
  terminationFrom: string
  terminationTo: string
  status: string
  test: string
  notes: string
}

export const buildPullListRows = (project: CablePlannerProject): PullListRow[] => {
  const byId = indexEquipment(project)
  return project.cables.map((c) => {
    const from = byId.get(c.fromEquipmentId)
    const to = byId.get(c.toEquipmentId)
    return {
      labelId: cableLabelId(c),
      cableNumber: c.cableNumber ?? '',
      name: c.name ?? '',
      fromDevice: from?.name ?? '—',
      fromPort: portName(from, c.fromPortId),
      toDevice: to?.name ?? '—',
      toPort: portName(to, c.toPortId),
      type: c.type,
      lengthM: c.length ?? 0,
      layer: c.layer ?? '',
      pathway: c.pathway ?? '',
      jacket: c.jacketRating ?? '',
      terminationFrom: c.terminationFrom ?? '',
      terminationTo: c.terminationTo ?? '',
      status: statusLabel(c),
      test: testLabel(c),
      notes: c.notes ?? '',
    }
  })
}

export const pullListCsv = (project: CablePlannerProject): string => {
  const rows = buildPullListRows(project)
  const headers = [
    'Label-ID',
    'Kabel-Nr.',
    'Name',
    'Von Gerät',
    'Von Port',
    'Nach Gerät',
    'Nach Port',
    'Typ',
    'Länge (m)',
    'Ebene',
    'Trasse/Pfad',
    'Mantel/Brandklasse',
    'Term. A',
    'Term. B',
    'Status',
    'Test',
    'Notizen',
  ]
  const body: CsvCell[][] = rows.map((r) => [
    r.labelId,
    r.cableNumber,
    r.name,
    r.fromDevice,
    r.fromPort,
    r.toDevice,
    r.toPort,
    r.type,
    r.lengthM,
    r.layer,
    r.pathway,
    r.jacket,
    r.terminationFrom,
    r.terminationTo,
    r.status,
    r.test,
    r.notes,
  ])
  return toCsv(headers, body)
}

// --- Termination-Liste ----------------------------------------------------

export interface TerminationRow {
  labelId: string
  end: 'A' | 'B'
  device: string
  port: string
  connector: string
  gender: string
  termination: string
}

export const buildTerminationRows = (
  project: CablePlannerProject,
): TerminationRow[] => {
  const byId = indexEquipment(project)
  const rows: TerminationRow[] = []
  const gender = (p?: Port) => (p?.gender === 'male' ? 'm' : p?.gender === 'female' ? 'w' : '')
  for (const c of project.cables) {
    const from = byId.get(c.fromEquipmentId)
    const to = byId.get(c.toEquipmentId)
    const fromPort = portObj(from, c.fromPortId)
    const toPort = portObj(to, c.toPortId)
    rows.push({
      labelId: cableLabelId(c),
      end: 'A',
      device: from?.name ?? '—',
      port: portName(from, c.fromPortId),
      connector: fromPort?.connectorType ?? c.type,
      gender: gender(fromPort),
      termination: c.terminationFrom ?? '',
    })
    rows.push({
      labelId: cableLabelId(c),
      end: 'B',
      device: to?.name ?? '—',
      port: portName(to, c.toPortId),
      connector: toPort?.connectorType ?? c.type,
      gender: gender(toPort),
      termination: c.terminationTo ?? '',
    })
  }
  return rows
}

export const terminationListCsv = (project: CablePlannerProject): string => {
  const rows = buildTerminationRows(project)
  const headers = ['Label-ID', 'Ende', 'Gerät', 'Port', 'Steckverbinder', 'Geschlecht', 'Terminierung']
  const body: CsvCell[][] = rows.map((r) => [
    r.labelId,
    r.end,
    r.device,
    r.port,
    r.connector,
    r.gender,
    r.termination,
  ])
  return toCsv(headers, body)
}

// --- Kabel-Schedule (Design-Register) -------------------------------------

export const cableScheduleCsv = (project: CablePlannerProject): string => {
  const byId = indexEquipment(project)
  const headers = [
    'Label-ID',
    'Kabel-Nr.',
    'Name',
    'Typ',
    'Standard',
    'Länge (m)',
    'Von Gerät',
    'Von Port',
    'Nach Gerät',
    'Nach Port',
    'Ebene',
    'Tie-Line',
    'Status',
  ]
  const body: CsvCell[][] = project.cables.map((c) => {
    const from = byId.get(c.fromEquipmentId)
    const to = byId.get(c.toEquipmentId)
    return [
      cableLabelId(c),
      c.cableNumber ?? '',
      c.name ?? '',
      c.type,
      c.standard ?? '',
      c.length ?? 0,
      from?.name ?? '—',
      portName(from, c.fromPortId),
      to?.name ?? '—',
      portName(to, c.toPortId),
      c.layer ?? '',
      c.isTieLine ? 'ja' : '',
      statusLabel(c),
    ]
  })
  return toCsv(headers, body)
}

// --- Kabel-BOM mit Reserve ------------------------------------------------

export interface CableBomRow {
  type: string
  lengthM: number
  qty: number
  qtyWithReserve: number
  totalLengthM: number
  tieLine: boolean
}

/**
 * Aggregiert Kabel nach (Typ, Länge) und schlägt einen Reserve-Prozentsatz
 * auf (typisch ~10 %). Multicore-Adern mit gleichem `multicoreName` werden zu
 * einem physischen Strang gezählt. Tie-Lines (Festverbindungen) werden
 * separat ausgewiesen.
 */
export const buildCableBomRows = (
  project: CablePlannerProject,
  reservePercent = 10,
): CableBomRow[] => {
  const factor = 1 + Math.max(0, reservePercent) / 100
  const buckets = new Map<string, CableBomRow>()
  const countedBundles = new Set<string>()
  for (const c of project.cables) {
    if (c.wireless) continue
    // Multicore: pro Bündel nur einmal zählen.
    if (c.multicoreName) {
      const bundleKey = `${c.multicoreName}`
      if (countedBundles.has(bundleKey)) continue
      countedBundles.add(bundleKey)
    }
    const len = c.length ?? 0
    const key = `${c.type}|${len}|${c.isTieLine ? 'tie' : 'show'}`
    const existing = buckets.get(key)
    if (existing) {
      existing.qty += 1
      existing.qtyWithReserve = Math.ceil(existing.qty * factor)
      existing.totalLengthM = +(existing.qty * len).toFixed(2)
    } else {
      buckets.set(key, {
        type: c.type,
        lengthM: len,
        qty: 1,
        qtyWithReserve: Math.ceil(1 * factor),
        totalLengthM: len,
        tieLine: !!c.isTieLine,
      })
    }
  }
  return Array.from(buckets.values()).sort(
    (a, b) => a.type.localeCompare(b.type) || a.lengthM - b.lengthM,
  )
}

export const cableBomCsv = (
  project: CablePlannerProject,
  reservePercent = 10,
): string => {
  const rows = buildCableBomRows(project, reservePercent)
  const headers = [
    'Typ',
    'Länge (m)',
    'Menge',
    `Menge inkl. ${reservePercent}% Reserve`,
    'Gesamtlänge (m)',
    'Festverbindung',
  ]
  const body: CsvCell[][] = rows.map((r) => [
    r.type,
    r.lengthM,
    r.qty,
    r.qtyWithReserve,
    r.totalLengthM,
    r.tieLine ? 'ja' : '',
  ])
  return toCsv(headers, body)
}
