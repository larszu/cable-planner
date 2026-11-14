/**
 * Wie die Stecker auf einer Frontplatte im Rack stehen: Spalten nebeneinander,
 * Reihen untereinander (#1221).
 *
 * Gespeichert wird weiterhin nur `panelPosX/Y` je Port (normiert 0..1, #170) —
 * das Raster ist keine zweite Wahrheit, sondern eine Art, diese Zahlen zu
 * setzen. Zurueckgelesen wird es aus den Positionen selbst.
 *
 * Die Standard-Verteilung stand vorher zweimal (`PortDots2D`, `Rack3DView`)
 * als gleicher Dreizeiler. Sie liegt jetzt hier, damit 2D, 3D und die
 * Einstellung dasselbe Raster meinen.
 */
import type { Port } from '../types/equipment'

export interface PortRaster {
  spalten: number
  reihen: number
}

/** Das Raster ohne Angabe: mehr Spalten als Reihen, weil die Platte breit ist. */
export const standardRaster = (anzahl: number): PortRaster => {
  if (anzahl <= 1) return { spalten: 1, reihen: 1 }
  const spalten = Math.ceil(Math.sqrt(anzahl * 2.5))
  return { spalten, reihen: Math.ceil(anzahl / spalten) }
}

/** Mitte der Zelle `index` (zeilenweise, links oben beginnend). */
export const rasterPosition = (index: number, raster: PortRaster): { x: number; y: number } => ({
  x: ((index % raster.spalten) + 0.5) / raster.spalten,
  y: (Math.floor(index / raster.spalten) + 0.5) / raster.reihen,
})

/** Die Position eines Ports ohne eigene Angabe. */
export const standardPortPosition = (index: number, anzahl: number): { x: number; y: number } =>
  rasterPosition(index, standardRaster(anzahl))

/**
 * Ein Raster, das alle Ports fasst. Wer eine Seite vorgibt, bekommt die
 * andere passend dazu — vier Spalten fuer 24 Ports sind sechs Reihen, nicht
 * zwei und achtzehn Ports ohne Platz.
 */
export const rasterFuer = (anzahl: number, vorgabe: { spalten?: number; reihen?: number }): PortRaster => {
  const n = Math.max(1, anzahl)
  if (vorgabe.spalten !== undefined) {
    const spalten = Math.min(n, Math.max(1, Math.round(vorgabe.spalten)))
    return { spalten, reihen: Math.ceil(n / spalten) }
  }
  if (vorgabe.reihen !== undefined) {
    const reihen = Math.min(n, Math.max(1, Math.round(vorgabe.reihen)))
    return { spalten: Math.ceil(n / reihen), reihen }
  }
  return standardRaster(n)
}

/**
 * Das Raster, in dem die Ports gerade stehen: so viele Reihen, wie es
 * verschiedene Hoehen gibt. Hat ein Port keine Position, gilt das
 * Standard-Raster — dann steht er ja auch dort.
 */
export const rasterAusPorts = (ports: readonly Port[]): PortRaster => {
  if (ports.length === 0) return { spalten: 1, reihen: 1 }
  if (ports.some((p) => p.panelPosX === undefined || p.panelPosY === undefined)) {
    return standardRaster(ports.length)
  }
  const hoehen = new Set(ports.map((p) => Math.round((p.panelPosY ?? 0) * 1000)))
  return rasterFuer(ports.length, { reihen: hoehen.size })
}

/** Die Ports in Reihenfolge ins Raster setzen. Neue Objekte, Rest unveraendert. */
export const portsImRaster = <P extends Port>(ports: readonly P[], raster: PortRaster): P[] =>
  ports.map((p, i) => {
    const { x, y } = rasterPosition(i, raster)
    return { ...p, panelPosX: x, panelPosY: y }
  })
