/**
 * Festinstallation — stabile, druckbare Dokumentations-IDs.
 *
 * Verknüpft das physische Etikett (Kabel-Label, Asset-Tag, QR-Code) mit dem
 * digitalen Datensatz. Konvention an TIA-606/AVIXA F501.01 angelehnt: kurze,
 * eindeutige, stabile IDs; das volle Quelle→Ziel-Mapping lebt im Plan.
 */
import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'
import { buildQrPayload } from './qrPayload'

/** Baut eine Doc-ID `PREFIX-NNNN` (nullgepolstert). */
export const makeDocId = (prefix: string, n: number, pad = 4): string =>
  `${prefix}-${String(n).padStart(pad, '0')}`

/** Effektives Kabel-Label für Listen/Etiketten: vergebene Kabelnummer →
 *  QR-ID → Kurzform der internen UUID als letzter Fallback. */
export const cableLabelId = (c: Cable): string =>
  c.cableNumber?.trim() || c.qrId?.trim() || `C-${c.id.slice(0, 8)}`

/** Effektiver Asset-Tag eines Geräts: Asset-Nummer → QR-ID → UUID-Kurzform. */
export const equipmentAssetTag = (e: EquipmentItem): string =>
  e.assetTag?.trim() || e.qrId?.trim() || `A-${e.id.slice(0, 8)}`

/**
 * Inhalt eines QR-Codes auf einem Etikett. Bewusst eine kompakte
 * `cableplanner:`-URI, die ein Scan-Lookup (Mobile/Viewer) auf den
 * Datensatz auflösen kann — plus Klartext-Fallback für jede QR-App.
 */
export const qrPayload = buildQrPayload
