/**
 * Festinstallation — Asset-Register für den Betreiber.
 *
 * Pro Gerät: Asset-Tag, Standort, Serien-Nr., Status, Garantie, Wartungs-
 * intervall, letzter Service. Die Grundlage für die Langzeit-Wartung und für
 * einen späteren CMMS-Import (Branchen-Praxis: Etikett/QR → Asset-Datensatz).
 */
import type { CablePlannerProject } from '../types/project'
import type { EquipmentItem } from '../types/equipment'
import { INSTALL_STATUS_LABEL } from '../types/lifecycle'
import { EQUIPMENT_OWNERSHIP_LABEL } from '../types/equipment'
import { equipmentAssetTag } from './docIds'
import { toCsv, type CsvCell } from './csv'

export interface AssetRow {
  assetTag: string
  name: string
  category: string
  location: string
  serial: string
  ip: string
  firmware: string
  status: string
  ownership: string
  stockLocation: string
  supplier: string
  purchaseDate: string
  warrantyUntil: string
  maintenanceIntervalDays: string
  lastService: string
  serviceCount: number
}

/** Standort aus der umschließenden Location (Raum + Etage), wenn vorhanden. */
const locationOf = (project: CablePlannerProject, eq: EquipmentItem): string => {
  const loc = (project.locations ?? []).find(
    (l) =>
      eq.x >= l.x &&
      eq.y >= l.y &&
      eq.x <= l.x + l.width &&
      eq.y <= l.y + l.height,
  )
  if (!loc) return ''
  return loc.floor ? `${loc.name} (${loc.floor})` : loc.name
}

export const buildAssetRows = (project: CablePlannerProject): AssetRow[] =>
  project.equipment.map((e) => {
    const history = e.serviceHistory ?? []
    const last = history.reduce<string>((acc, r) => (r.date > acc ? r.date : acc), '')
    return {
      assetTag: equipmentAssetTag(e),
      name: e.name,
      category: e.category ?? '',
      location: locationOf(project, e),
      serial: e.serialNumber ?? '',
      ip: e.ipAddress ?? '',
      firmware: e.firmware ?? '',
      status: e.installStatus ? INSTALL_STATUS_LABEL[e.installStatus] : '',
      ownership: e.ownership ? EQUIPMENT_OWNERSHIP_LABEL[e.ownership] : '',
      stockLocation: e.stockLocation ?? '',
      supplier: e.supplier ?? '',
      purchaseDate: e.purchaseDate ?? '',
      warrantyUntil: e.warrantyUntil ?? '',
      maintenanceIntervalDays:
        typeof e.maintenanceIntervalDays === 'number'
          ? String(e.maintenanceIntervalDays)
          : '',
      lastService: last,
      serviceCount: history.length,
    }
  })

export const assetRegisterCsv = (project: CablePlannerProject): string => {
  const rows = buildAssetRows(project)
  const headers = [
    'Asset-Tag',
    'Gerät',
    'Kategorie',
    'Standort',
    'Serien-Nr.',
    'IP',
    'Firmware',
    'Status',
    'Eigentum',
    'Lagerort',
    'Lieferant',
    'Anschaffung',
    'Garantie bis',
    'Wartungsintervall (Tage)',
    'Letzter Service',
    'Service-Einträge',
  ]
  const body: CsvCell[][] = rows.map((r) => [
    r.assetTag,
    r.name,
    r.category,
    r.location,
    r.serial,
    r.ip,
    r.firmware,
    r.status,
    r.ownership,
    r.stockLocation,
    r.supplier,
    r.purchaseDate,
    r.warrantyUntil,
    r.maintenanceIntervalDays,
    r.lastService,
    r.serviceCount,
  ])
  return toCsv(headers, body)
}
