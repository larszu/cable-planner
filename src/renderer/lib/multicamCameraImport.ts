// ───────────────────────────────────────────────────────────────────────────
// Import von MultiCam-Planner-Kameras als Equipment (`camera-list` v1)
//
// Der MultiCam-Planner exportiert seine platzierten Kameras als neutrale
// Kamera-Liste (Modell, Hersteller, Venue-Position). Hier werden sie zu
// EquipmentItems der Kategorie "Kameras".
//
// GRUNDSATZ (kein Raten von Fakten): passt ein Modell EINDEUTIG zum
// CAMERA_CATALOG (Datenblatt-basiert), erbt es dessen echte Port-Belegung
// (SDI/HDMI/XLR…). Passt es NICHT eindeutig, erfinden wir KEINE generische
// Belegung — ein erfundener "SDI Out" waere eine plausible-aber-falsche
// Tatsache, die still in BOM/Patchliste/Verkabelung eingeht. Stattdessen bleibt
// die Kamera ohne Ports und traegt `portsUnknown: true`; der Plan-Check fordert
// die Datenblatt-Ergaenzung ein. Gegenstueck: multicam-planner
// src/utils/cameraExport.ts.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentItem, Port } from '../types/equipment'
import { matchCameraTemplate, matchCameraTemplateById } from './cameraCatalog'

export const CAMERA_LIST_KIND = 'camera-list' as const
export const CAMERA_LIST_VERSION = 1 as const

export interface CameraListEntry {
  id: string
  label: string
  manufacturer?: string
  model?: string
  /** Stabile Geraetetyp-Identitaet (GUID, GDTF-analog). Wenn gesetzt, wird die
   *  Kamera hier AUTORITATIV auf ihr Datenblatt aufgeloest (echte Ports), statt
   *  ueber Hersteller/Modell-Namen zu raten. Der MultiCam-Exporter setzt sie aus
   *  seiner Kamera-Bibliothek; fehlt sie (Altdaten), greift die Namens-Heuristik
   *  als Fallback. */
  deviceTypeId?: string
  x?: number // Meter im Venue
  y?: number
}
export interface CameraListExchange {
  kind: typeof CAMERA_LIST_KIND
  formatVersion: typeof CAMERA_LIST_VERSION
  app: string
  appVersion: string
  exportedAt: string
  cameras: CameraListEntry[]
}

export function parseCameraList(text: string): CameraListExchange {
  const data = JSON.parse(text) as Partial<CameraListExchange>
  if (!data || data.kind !== CAMERA_LIST_KIND) {
    throw new Error('Keine gueltige Kamera-Liste (kind != camera-list).')
  }
  if (data.formatVersion !== CAMERA_LIST_VERSION) {
    throw new Error(`Nicht unterstuetzte Kamera-Listen-Version: ${data.formatVersion}`)
  }
  if (!Array.isArray(data.cameras)) throw new Error('Kamera-Liste ohne cameras-Array.')
  return data as CameraListExchange
}

// Venue-Meter → Canvas-Pixel (grobe Platzierung; der User ordnet danach an).
const PX_PER_METER = 120

const clonePort = (p: Port): Port => ({ ...p, id: '' })

/**
 * Datenblatt-Match fuer einen Kamera-Eintrag oder null, in Vertrauens-Reihenfolge:
 *   1. Geraetetyp-ID (GUID) — autoritativ, kein Raten.
 *   2. Name (exakt, sonst Marke + ALLE Modell-Needles) — konservativer Fallback
 *      fuer Altdaten ohne ID. Ein loses Teilstring-Match ("enthaelt sony")
 *      wuerde einem unbekannten Modell fremde Ports andichten — daher nicht.
 */
function matchTemplate(entry: CameraListEntry) {
  const byId = matchCameraTemplateById(entry.deviceTypeId)
  if (byId) return byId
  const name = `${entry.manufacturer ?? ''} ${entry.model ?? ''}`.trim()
  return matchCameraTemplate(name) ?? undefined
}

/** Neutrale Kamera-Liste → Equipment-Nodes (Kategorie "Kameras"). */
export function cameraListToEquipment(ex: CameraListExchange): EquipmentItem[] {
  return ex.cameras.map((c, i) => {
    const tmpl = matchTemplate(c)
    const base = {
      id: c.id || '',
      name: c.label || tmpl?.name || 'Kamera',
      category: 'Kameras',
      // Stabile Geraetetyp-ID durchreichen: bevorzugt die des aufgeloesten
      // Templates, sonst die vom Exporter mitgegebene (auch wenn unser Katalog
      // sie noch nicht kennt — Identitaet bekannt, Ports evtl. nicht).
      deviceTypeId: tmpl?.deviceTypeId ?? c.deviceTypeId,
      x: Math.round((c.x ?? i * 2) * PX_PER_METER),
      y: Math.round((c.y ?? 0) * PX_PER_METER),
    }
    if (!tmpl) {
      // Kein Datenblatt-Match → Ports NICHT erfinden. Explizit als unbekannt
      // fuehren; der Plan-Check (drawingChecks) fordert die Ergaenzung ein.
      return {
        ...base,
        inputs: [],
        outputs: [],
        width: 240,
        height: 200,
        portsUnknown: true,
      }
    }
    return {
      ...base,
      inputs: tmpl.inputs.map(clonePort),
      outputs: tmpl.outputs.map(clonePort),
      width: tmpl.width ?? 240,
      height: tmpl.height ?? 200,
    }
  })
}
