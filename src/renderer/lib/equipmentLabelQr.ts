/**
 * Geraete-Etikett: was der QR-Code traegt und welche Zeilen daneben stehen (#993).
 *
 * Vorher trug jedes Geraete-Etikett nur `cableplanner://equipment/<id>` — ein
 * Handy ohne App zeigt damit nichts an, und das Etikett selbst nannte nur den
 * Geraetenamen. Jetzt gilt eine feste Reihenfolge fuer das Ziel:
 *
 *  1. Das Geraet ist in der Geraetebibliothek bekannt → deren Geraeteseite
 *     (`<server>/d/<slug>`). Dort stehen Hersteller, Modell und Datenblatt
 *     fuer alle Planner gleich.
 *  2. Sonst eine hinterlegte Hersteller-/Datenblatt-URL (`manufacturerUrl`).
 *  3. Sonst Klartext: Name, Hersteller + Modell, Asset-Tag. Den liest jedes
 *     Handy ohne Netz.
 *
 * In allen drei Faellen bleibt der Datensatz fuer den eigenen Scan-Lookup
 * auffindbar: bei URLs als Fragment `#equipment/<id>`, im Klartext als
 * angehaengte `cableplanner://`-URI. `parseQrPayload` erkennt beides.
 */
import type { EquipmentItem } from '../types/equipment'
import type { DeviceLibraryEntry } from '../types/deviceLibrary'
import { deviceUrl } from './deviceLibraryClient'
import { herstellerAusName } from './herstellerAusName'
import { buildQrPayload } from './qrPayload'

export type EquipmentQrTarget = 'library' | 'manufacturer' | 'text'

export interface EquipmentLabelQr {
  target: EquipmentQrTarget
  /** Inhalt des QR-Codes. */
  payload: string
  manufacturer: string
  model: string
  /** Zeilen fuer das Etikett neben dem Code (Name, Hersteller/Modell, Ziel). */
  lines: string[]
}

const norm = (s: string | undefined): string => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

/** Bibliothekseintrag zu einem Geraet — ueber den Vorlagennamen oder
 *  „Hersteller Modell". `null`, wenn nichts eindeutig passt. */
export function findLibraryEntry(
  e: Pick<EquipmentItem, 'name' | 'libraryRef'>,
  entries: readonly DeviceLibraryEntry[],
): DeviceLibraryEntry | null {
  const keys = new Set([norm(e.name), norm(e.libraryRef?.name)].filter(Boolean))
  if (keys.size === 0) return null
  return (
    entries.find(
      (x) => keys.has(norm(x.template.name)) || keys.has(norm(`${x.manufacturer} ${x.model}`)),
    ) ?? null
  )
}

const httpUrl = (u: string | undefined): string | null => {
  const s = u?.trim()
  if (!s) return null
  try {
    const url = new URL(s)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

const host = (u: string): string => {
  try {
    return new URL(u).host
  } catch {
    return u
  }
}

const mitFragment = (url: string, id: string): string =>
  url.includes('#') ? url : `${url}#equipment/${encodeURIComponent(id)}`

export function equipmentLabelQr(
  e: Pick<EquipmentItem, 'name' | 'libraryRef' | 'manufacturerUrl'>,
  id: string,
  entries: readonly DeviceLibraryEntry[],
  server: string,
): EquipmentLabelQr {
  const entry = findLibraryEntry(e, entries)
  const guess = herstellerAusName(e.libraryRef?.name || e.name)
  const manufacturer = entry?.manufacturer || guess.manufacturer
  const model = entry?.model || guess.model
  const mm = [manufacturer, model].filter(Boolean).join(' ')
  const lines = [e.name]
  if (mm && norm(mm) !== norm(e.name)) lines.push(mm)

  if (entry) {
    const url = deviceUrl(server, entry.slug)
    return { target: 'library', payload: mitFragment(url, id), manufacturer, model, lines: [...lines, host(url)] }
  }
  const datenblatt = httpUrl(e.manufacturerUrl)
  if (datenblatt) {
    return {
      target: 'manufacturer',
      payload: mitFragment(datenblatt, id),
      manufacturer,
      model,
      lines: [...lines, host(datenblatt)],
    }
  }
  const text = [e.name, ...(mm && norm(mm) !== norm(e.name) ? [mm] : []), id, buildQrPayload('equipment', id, id)]
  return { target: 'text', payload: text.join('\n'), manufacturer, model, lines }
}
