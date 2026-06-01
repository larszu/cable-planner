// #355 — Vektor-Export als DXF (AutoCAD R12 ASCII) für CAD/Plotter.
//
// Anders als der SVG-Export (DOM-Snapshot via html-to-image) erzeugt der
// DXF-Export STRUKTURIERTE Geometrie direkt aus den Projektdaten:
//   - Geräte → geschlossene LWPOLYLINE-Rechtecke (Layer EQUIPMENT) + TEXT.
//   - Standort-Rahmen → Rechtecke (Layer LOCATIONS).
//   - Kabel → offene LWPOLYLINE von Geräte-Mitte über Waypoints zur Ziel-
//     Mitte, je nach Gewerk auf Layer video/audio/control/network/power/other.
//
// Layer-Trennung erfolgt über den Group-8-Namen je Entity — gängige CAD-
// Importer (AutoCAD, LibreCAD, Vectorworks) legen fehlende Layer automatisch
// an. Bewusst ENTITIES-only gehalten (robusteste minimale DXF-Form).
//
// DXF-Y zeigt nach oben, der Canvas nach unten → wir spiegeln Y, damit der
// Plan im CAD nicht kopfsteht.

import type { CablePlannerProject } from '../types/project'
import { topLayer } from './cableLayers'

/** AutoCAD-Color-Index (ACI) je Gewerk-/Struktur-Layer. */
const LAYER_ACI: Record<string, number> = {
  video: 5, // blau
  audio: 1, // rot
  control: 2, // gelb
  network: 3, // grün
  power: 6, // magenta
  other: 8, // grau
  EQUIPMENT: 7, // weiß/schwarz
  LOCATIONS: 8,
  LABELS: 7,
}

const fmt = (n: number): string => (Number.isFinite(n) ? n : 0).toFixed(3)

/**
 * Serialisiert ein Projekt als DXF-String (R12 ASCII).
 */
export const exportProjectToDxf = (project: CablePlannerProject): string => {
  const out: string[] = []
  const g = (code: number, value: string | number): void => {
    out.push(String(code))
    out.push(String(value))
  }
  // Y spiegeln (Canvas unten-positiv → CAD oben-positiv).
  const fy = (y: number): number => -y

  const lwpolyline = (layer: string, pts: { x: number; y: number }[], closed: boolean): void => {
    if (pts.length < 2) return
    g(0, 'LWPOLYLINE')
    g(8, layer)
    g(62, LAYER_ACI[layer] ?? LAYER_ACI.other)
    g(90, pts.length)
    g(70, closed ? 1 : 0)
    for (const p of pts) {
      g(10, fmt(p.x))
      g(20, fmt(fy(p.y)))
    }
  }
  const text = (layer: string, x: number, y: number, height: number, s: string): void => {
    const clean = s.replace(/[\r\n]+/g, ' ').trim()
    if (!clean) return
    g(0, 'TEXT')
    g(8, layer)
    g(62, LAYER_ACI[layer] ?? LAYER_ACI.other)
    g(10, fmt(x))
    g(20, fmt(fy(y)))
    g(40, fmt(height))
    g(1, clean)
  }
  const rect = (layer: string, x: number, y: number, w: number, h: number): void =>
    lwpolyline(
      layer,
      [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ],
      true,
    )

  g(0, 'SECTION')
  g(2, 'ENTITIES')

  // Standort-Rahmen zuerst (Hintergrund).
  for (const loc of project.locations ?? []) {
    rect('LOCATIONS', loc.x, loc.y, loc.width, loc.height)
    text('LOCATIONS', loc.x + 4, loc.y + 16, 14, loc.name)
  }

  // Geräte + Namen; Mitten für die Kabel merken.
  const centerById = new Map<string, { x: number; y: number }>()
  for (const e of project.equipment) {
    const w = e.width ?? 240
    const h = e.height ?? 80
    rect('EQUIPMENT', e.x, e.y, w, h)
    text('LABELS', e.x + 5, e.y + 18, 11, e.name)
    centerById.set(e.id, { x: e.x + w / 2, y: e.y + h / 2 })
  }

  // Kabel: Polylinie Quelle-Mitte → Waypoints → Ziel-Mitte, Layer = Gewerk.
  for (const c of project.cables) {
    const from = centerById.get(c.fromEquipmentId)
    const to = centerById.get(c.toEquipmentId)
    if (!from || !to) continue
    const layer = topLayer(c.layer) ?? 'other'
    const safeLayer = layer in LAYER_ACI ? layer : 'other'
    const pts = [from, ...(c.waypoints ?? []).map((wp) => ({ x: wp.x, y: wp.y })), to]
    lwpolyline(safeLayer, pts, false)
  }

  g(0, 'ENDSEC')
  g(0, 'EOF')
  return out.join('\n')
}
