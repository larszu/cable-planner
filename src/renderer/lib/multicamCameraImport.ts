// ───────────────────────────────────────────────────────────────────────────
// Import von MultiCam-Planner-Kameras als Equipment (`camera-list` v1 + v2)
//
// Der MultiCam-Planner exportiert seine platzierten Kameras als neutrale
// Kamera-Liste (Modell, Hersteller, Venue-Position, seit v2 auch Objektiv und
// Einstellung). Hier werden sie zu EquipmentItems der Kategorie "Kameras".
//
// GRUNDSATZ (kein Raten von Fakten): passt ein Modell EINDEUTIG zum
// CAMERA_CATALOG (Datenblatt-basiert), erbt es dessen echte Port-Belegung
// (SDI/HDMI/XLR…). Passt es NICHT eindeutig, erfinden wir KEINE generische
// Belegung — ein erfundener "SDI Out" waere eine plausible-aber-falsche
// Tatsache, die still in BOM/Patchliste/Verkabelung eingeht. Stattdessen bleibt
// die Kamera ohne Ports und traegt `portsUnknown: true`; der Plan-Check fordert
// die Datenblatt-Ergaenzung ein. Gegenstueck: multicam-planner
// src/utils/cameraExport.ts.
//
// #909 — ein zweiter Import ist ein ABGLEICH, kein Anhaengen. Vorher legte
// jeder Lauf die Kameras neu an: zweimal importiert hiess jede Kamera doppelt,
// in der Stueckliste doppelt, und die Kabel hingen an der alten.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentItem, KameraOptik, Port } from '../types/equipment'
import { matchCameraTemplate, matchCameraTemplateById } from './cameraCatalog'

export const CAMERA_LIST_KIND = 'camera-list' as const
export const CAMERA_LIST_VERSION = 2 as const

/** Objektiv laut Katalog des Kameraplans. */
export interface CameraListLens {
  manufacturer?: string
  model?: string
  focalMinMm?: number
  focalMaxMm?: number
  mount?: string
}

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
  /** v2: Hoehe der Kamera in Metern, wenn bekannt. */
  z?: number
  /** v2: aktiver Mount am Koerper. */
  mount?: string
  /** v2: eingestellte Brennweite in mm. */
  focalMm?: number
  /** v2: eingeschalteter Extender-Faktor; fehlt, wenn keiner. */
  extender?: number
  /** v2: Objektiv. */
  lens?: CameraListLens
}
export interface CameraListExchange {
  kind: typeof CAMERA_LIST_KIND
  formatVersion: 1 | 2
  app: string
  appVersion: string
  exportedAt: string
  /** v2: stabile Id des MultiCam-Projekts — trennt `cam-1` zweier Plaene. */
  projectId?: string
  cameras: CameraListEntry[]
}

const istText = (v: unknown): boolean => v === undefined || typeof v === 'string'
const istZahl = (v: unknown): boolean => v === undefined || (typeof v === 'number' && Number.isFinite(v))
const istPositiv = (v: unknown): boolean => v === undefined || (typeof v === 'number' && Number.isFinite(v) && v > 0)
const istObjekt = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Ein Eintrag, so wie das Format ihn meint — nicht nur, wie er heisst.
 *
 * Abgelehnt wird die DATEI, nicht der Eintrag: eine Liste, aus der
 * stillschweigend eine Kamera fehlt, ist schlimmer als eine, die gar nicht
 * erst laedt. Dieselbe Pruefung wie im Exporter (multicam-planner
 * `pruefeEintrag`); vorher nahm diese Seite jedes Array ungesehen an, und
 * `x: "links"` wurde eine Position bei NaN.
 */
function pruefeEintrag(roh: unknown, index: number): CameraListEntry {
  const wo = `Camera #${index + 1}`
  if (!istObjekt(roh)) throw new Error(`${wo}: not an object.`)
  for (const feld of ['id', 'label'] as const) {
    if (typeof roh[feld] !== 'string' || (roh[feld] as string).trim() === '') {
      throw new Error(`${wo}: field "${feld}" missing or empty.`)
    }
  }
  for (const feld of ['manufacturer', 'model', 'deviceTypeId', 'mount'] as const) {
    if (!istText(roh[feld])) throw new Error(`${wo}: field "${feld}" is not text.`)
  }
  for (const feld of ['x', 'y', 'z'] as const) {
    if (!istZahl(roh[feld])) throw new Error(`${wo}: field "${feld}" is not a finite number.`)
  }
  for (const feld of ['focalMm', 'extender'] as const) {
    if (!istPositiv(roh[feld])) throw new Error(`${wo}: field "${feld}" is not a positive number.`)
  }
  if (roh.lens !== undefined) {
    const lens = roh.lens
    if (!istObjekt(lens)) throw new Error(`${wo}: field "lens" is not an object.`)
    for (const feld of ['manufacturer', 'model', 'mount'] as const) {
      if (!istText(lens[feld])) throw new Error(`${wo}: field "lens.${feld}" is not text.`)
    }
    for (const feld of ['focalMinMm', 'focalMaxMm'] as const) {
      if (!istPositiv(lens[feld])) throw new Error(`${wo}: field "lens.${feld}" is not a positive number.`)
    }
  }
  return roh as unknown as CameraListEntry
}

/** Liest eine Kamera-Liste v1 oder v2 aus JSON-Text. */
export function parseCameraList(text: string): CameraListExchange {
  return pruefeCameraList(JSON.parse(text))
}

/** Dieselbe Pruefung fuer ein schon gelesenes Objekt (z. B. aus dem `.avplan`-Slot). */
export function pruefeCameraList(roh: unknown): CameraListExchange {
  const data = roh as Partial<CameraListExchange> | null
  if (!data || data.kind !== CAMERA_LIST_KIND) {
    throw new Error('Not a valid camera list (kind != camera-list).')
  }
  if (data.formatVersion !== 1 && data.formatVersion !== 2) {
    throw new Error(`Unsupported camera list version: ${String(data.formatVersion)}`)
  }
  if (!Array.isArray(data.cameras)) throw new Error('Camera list without cameras array.')
  for (const feld of ['app', 'appVersion', 'exportedAt'] as const) {
    if (typeof data[feld] !== 'string' || data[feld].trim() === '') {
      throw new Error(`Camera list without "${feld}".`)
    }
  }
  if (!istText(data.projectId)) throw new Error('Camera list: "projectId" is not text.')
  const cameras = data.cameras.map(pruefeEintrag)
  // Zwei Eintraege mit derselben Id waeren beim Abgleich EIN Geraet — das
  // zweite ueberschriebe das erste still.
  const ids = new Set<string>()
  for (const c of cameras) {
    if (ids.has(c.id)) throw new Error(`Camera list: id "${c.id}" appears twice.`)
    ids.add(c.id)
  }
  return { ...(data as CameraListExchange), cameras }
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

/**
 * Die Optik eines Eintrags — oder `undefined`, wenn der Kameraplan nichts
 * dazu sagt. Nur gesetzte Felder werden uebernommen: ein leeres Objekt waere
 * im Eigenschaften-Feld ein Abschnitt ohne Inhalt.
 */
export function optikAus(c: CameraListEntry): KameraOptik | undefined {
  const o: KameraOptik = {}
  if (c.lens?.manufacturer) o.objektivHersteller = c.lens.manufacturer
  if (c.lens?.model) o.objektivModell = c.lens.model
  if (c.lens?.focalMinMm !== undefined) o.brennweiteMinMm = c.lens.focalMinMm
  if (c.lens?.focalMaxMm !== undefined) o.brennweiteMaxMm = c.lens.focalMaxMm
  if (c.lens?.mount) o.objektivMount = c.lens.mount
  if (c.mount) o.kameraMount = c.mount
  if (c.focalMm !== undefined) o.brennweiteMm = c.focalMm
  // Faktor 1 ist „kein Extender" — nicht als Extender fuehren.
  if (c.extender !== undefined && c.extender !== 1) o.extender = c.extender
  if (c.z !== undefined) o.hoeheM = c.z
  return Object.keys(o).length > 0 ? o : undefined
}

/** Neutrale Kamera-Liste → neue Equipment-Nodes (Kategorie "Kameras"). */
export function cameraListToEquipment(ex: CameraListExchange): EquipmentItem[] {
  return ex.cameras.map((c, i) => {
    const tmpl = matchTemplate(c)
    const optik = optikAus(c)
    const base = {
      // Die Geraete-Id vergibt der Store. Frueher war sie die MultiCam-Id —
      // und `cam-1` aus zwei Plaenen waren dann zwei Geraete mit derselben Id.
      id: '',
      name: c.label || tmpl?.name || 'Camera',
      category: 'Cameras',
      // Stabile Geraetetyp-ID durchreichen: bevorzugt die des aufgeloesten
      // Templates, sonst die vom Exporter mitgegebene (auch wenn unser Katalog
      // sie noch nicht kennt — Identitaet bekannt, Ports evtl. nicht).
      deviceTypeId: tmpl?.deviceTypeId ?? c.deviceTypeId,
      importSource: 'multicam' as const,
      multicamId: c.id,
      ...(ex.projectId ? { multicamProjectId: ex.projectId } : {}),
      ...(optik ? { optik } : {}),
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

/** Ergebnis eines Abgleichs — was der Store anwenden soll und was der Mensch erfahren muss. */
export interface KameraAbgleich {
  /** Kameras, die es im Plan noch nicht gibt. */
  neu: EquipmentItem[]
  /** Vorhandene Geraete mit ihren Aenderungen. */
  aktualisiert: Array<{ id: string; patch: Partial<EquipmentItem> }>
  /** Geraete-Ids, deren Kamera im MultiCam-Plan nicht mehr steht (jetzt markiert). */
  verwaist: string[]
  /** Namen der Kameras, deren Modell sich geaendert hat — Ports bleiben, pruefen. */
  modellGeaendert: string[]
  /** Kameras, an denen sich nichts geaendert hat. */
  unveraendert: number
}

const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * Gehoert ein vorhandenes Geraet zu dieser Liste?
 *
 * Mit Projekt-Id (v2) nur Geraete desselben MultiCam-Plans. Ohne (v1) nur
 * Geraete, die ebenfalls keine tragen — sonst raeumte eine alte v1-Liste die
 * Kameras eines anderen Plans als „verwaist" ab.
 */
const ausDiesemPlan = (e: EquipmentItem, projectId: string | undefined): boolean =>
  e.multicamId !== undefined && (e.multicamProjectId ?? undefined) === (projectId ?? undefined)

/**
 * #909 — gleicht eine Kamera-Liste gegen die vorhandenen Geraete ab.
 *
 * Wiedererkannt wird ueber die Herkunft (`multicamId` + Projekt-Id), bei
 * Altbestand aus dem v1-Import ueber die Geraete-Id, die damals die
 * MultiCam-Id WAR. Uebernommen werden Name und Optik — das fuehrt der
 * Kameraplan. Lage, Ports und Kabel bleiben: die hat hier jemand gesetzt.
 *
 * Das MODELL wird nicht still getauscht. Ein anderer Koerper hat andere
 * Anschluesse, und die Kabel an den alten wuerden ins Leere zeigen; das
 * entscheidet ein Mensch ueber „Geraet ersetzen". Ausnahme: ein Geraet ohne
 * bekannte Ports (`portsUnknown`) — dort geht nichts verloren, und der
 * Katalog liefert jetzt, was fehlte.
 */
export function abgleichKameras(bestand: readonly EquipmentItem[], ex: CameraListExchange): KameraAbgleich {
  const ergebnis: KameraAbgleich = { neu: [], aktualisiert: [], verwaist: [], modellGeaendert: [], unveraendert: 0 }
  const kandidaten = cameraListToEquipment(ex)
  const getroffen = new Set<string>()

  ex.cameras.forEach((c, i) => {
    const kandidat = kandidaten[i]
    const vorhanden =
      bestand.find((e) => e.multicamId === c.id && ausDiesemPlan(e, ex.projectId)) ??
      bestand.find((e) => e.multicamId === undefined && e.id === c.id && /camera|kamera/i.test(e.category ?? ''))
    if (!vorhanden) {
      ergebnis.neu.push(kandidat)
      return
    }
    getroffen.add(vorhanden.id)

    const patch: Partial<EquipmentItem> = {}
    if (vorhanden.name !== kandidat.name) patch.name = kandidat.name
    if (!gleich(vorhanden.optik, kandidat.optik)) patch.optik = kandidat.optik
    if (vorhanden.multicamId !== c.id) patch.multicamId = c.id
    if (vorhanden.multicamProjectId !== kandidat.multicamProjectId) patch.multicamProjectId = kandidat.multicamProjectId
    if (vorhanden.importSource !== 'multicam') patch.importSource = 'multicam'
    if (vorhanden.multicamRemoved) patch.multicamRemoved = undefined

    if ((vorhanden.deviceTypeId ?? undefined) !== (kandidat.deviceTypeId ?? undefined)) {
      if (vorhanden.portsUnknown && !kandidat.portsUnknown) {
        patch.deviceTypeId = kandidat.deviceTypeId
        patch.inputs = kandidat.inputs
        patch.outputs = kandidat.outputs
        patch.portsUnknown = undefined
      } else if (vorhanden.portsUnknown && kandidat.portsUnknown) {
        patch.deviceTypeId = kandidat.deviceTypeId
      } else {
        ergebnis.modellGeaendert.push(kandidat.name)
      }
    }

    if (Object.keys(patch).length > 0) ergebnis.aktualisiert.push({ id: vorhanden.id, patch })
    else ergebnis.unveraendert += 1
  })

  for (const e of bestand) {
    if (getroffen.has(e.id) || e.multicamRemoved) continue
    if (ausDiesemPlan(e, ex.projectId)) {
      ergebnis.verwaist.push(e.id)
      ergebnis.aktualisiert.push({ id: e.id, patch: { multicamRemoved: true } })
    }
  }
  return ergebnis
}
