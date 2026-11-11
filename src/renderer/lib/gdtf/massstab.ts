import type { PlanKalibrierung } from '../../avplan/floorplan/typen'
import { meterJePixel } from '../../avplan/floorplan/massstab'

/** Canvas-Pixel je Meter aus der Kalibrierung des Hallenplans, sonst null. */
export const pxProMeterAusKalibrierung = (k: PlanKalibrierung): number | null => {
  if (k.art === 'zweiPunkt') {
    const m = meterJePixel(k)
    return m ? 1 / m : null
  }
  const [a, b] = k.ecken
  const px = Math.hypot(b.x - a.x, b.y - a.y)
  return px >= 1 && k.breiteM > 0 ? px / k.breiteM : null
}
