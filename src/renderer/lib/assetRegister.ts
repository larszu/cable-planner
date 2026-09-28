/**
 * Festinstallation — Asset-Register für den Betreiber.
 *
 * Pro Gerät: Asset-Tag, Standort, Serien-Nr., Status, Garantie, Wartungs-
 * intervall, letzter Service. Die Grundlage für die Langzeit-Wartung und für
 * einen späteren CMMS-Import (Branchen-Praxis: Etikett/QR → Asset-Datensatz).
 */
import type { CablePlannerProject } from '../types/project'
import { INSTALL_STATUS_LABEL } from '../types/lifecycle'
import { EQUIPMENT_OWNERSHIP_LABEL } from '../types/equipment'
import { equipmentAssetTag } from './docIds'
import { standortText } from './equipmentLocation'
import type { CsvCell, CsvTable } from './csv'
import { csvFromTable, type DocumentStamp } from './documentStamp'
import { primaryVlanId } from './vlanAnzeige'

export interface AssetRow {
  assetTag: string
  name: string
  category: string
  location: string
  serial: string
  ip: string
  /** #946 — VLAN der Alt-Felder (Schnittstelle 0); leer ohne Eintrag. */
  vlan: number | ''
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

export const buildAssetRows = (project: CablePlannerProject): AssetRow[] =>
  project.equipment.map((e) => {
    const history = e.serviceHistory ?? []
    const last = history.reduce<string>((acc, r) => (r.date > acc ? r.date : acc), '')
    return {
      assetTag: equipmentAssetTag(e),
      name: e.name,
      category: e.category ?? '',
      location: standortText(e, project.locations ?? []),
      serial: e.serialNumber ?? '',
      ip: e.ipAddress ?? '',
      vlan: primaryVlanId(e) ?? '',
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

export const assetRegisterTable = (project: CablePlannerProject): CsvTable => {
  const rows = buildAssetRows(project)
  const headers = [
    'Asset-Tag',
    'Gerät',
    'Kategorie',
    'Standort',
    'Serien-Nr.',
    'IP',
    'VLAN',
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
    r.vlan,
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
  return { headers, rows: body }
}

export const assetRegisterCsv = (
  project: CablePlannerProject,
  stamp?: DocumentStamp,
): string => csvFromTable(assetRegisterTable(project), stamp, 'asset-register')
