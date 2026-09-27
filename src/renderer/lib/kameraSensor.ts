// ───────────────────────────────────────────────────────────────────────────
// #910 — Sensorbreite einer Kamera aus dem Kamera-Katalog in `optics/`.
//
// `optics/` kam aus dem multicam-planner herueber (Sensoren, Bildwinkel,
// Belege je Kamera) und hatte hier keinen einzigen Importer. Gebraucht wird
// daraus genau eines: die Sensorbreite, damit der Bildwinkel einer Kamera
// auch dann dasteht, wenn der Kameraplan ihn nicht mitgeschickt hat.
//
// NUR WENN ES EINDEUTIG IST. Eine Kamera mit umschaltbaren Sensor-Modi
// (VENICE 2, FX9 …) hat mehrere Breiten, und welche aktiv ist, sagt die
// camera-list nicht. Ein Objektiv an einem fremden Mount laeuft ueber einen
// Adapter, der den Bildkreis aendern kann. In beiden Faellen bleibt die
// Angabe weg — „fehlt eine Angabe, fehlt sie" (#910), statt einer Zahl, die
// wie eine Messung aussieht.
// ───────────────────────────────────────────────────────────────────────────
import { CAMERAS } from '../optics/cameras'
import type { Camera } from '../optics/types'

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase()

function finde(k: { deviceTypeId?: string; manufacturer?: string; model?: string }): Camera | undefined {
  if (k.deviceTypeId) {
    const byId = CAMERAS.find((c) => c.deviceTypeId === k.deviceTypeId)
    if (byId) return byId
  }
  const hersteller = norm(k.manufacturer)
  const modell = norm(k.model)
  if (!hersteller || !modell) return undefined
  const treffer = CAMERAS.filter((c) => norm(c.manufacturer) === hersteller && norm(c.model) === modell)
  return treffer.length === 1 ? treffer[0] : undefined
}

/**
 * Sensorbreite in mm, oder undefined, wenn die Kamera unbekannt ist, mehrere
 * Sensor-Modi hat oder das Objektiv nicht am nativen Mount sitzt.
 */
export function sensorBreiteMm(k: {
  deviceTypeId?: string
  manufacturer?: string
  model?: string
  objektivMount?: string
}): number | undefined {
  const cam = finde(k)
  if (!cam) return undefined
  if (cam.sensorModes && cam.sensorModes.length > 1) return undefined
  if (k.objektivMount && norm(k.objektivMount) !== norm(cam.mount)) return undefined
  return cam.sensor.widthMm
}
