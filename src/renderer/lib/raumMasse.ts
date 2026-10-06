// Raumgroesse eines Rahmens in Metern.
//
// Ein Rahmen speichert Canvas-Pixel (`width`/`height`). Die echte Groesse
// folgt aus dem Massstab des Projekts (`metersPer100px`, vom Hallenplan oder
// aus den Projekteinstellungen) — dieselbe Zahl, mit der Kabellaengen und die
// 3D-Gebaeudeansicht rechnen. Es gibt kein zweites Feld fuer Meter oder
// Quadratmeter: die Flaeche ist Breite × Tiefe, berechnet.

/** Kleinste Rahmengroesse in Canvas-Pixeln (gilt auch fuers Ziehen am Rahmen). */
export const RAHMEN_MIN_PX = 40

const rund = (n: number, stellen = 2) => {
  const f = 10 ** stellen
  return Math.round(n * f) / f
}

/** Canvas-Pixel -> Meter. */
export const pxZuMeter = (px: number, metersPer100px: number): number => rund((px * metersPer100px) / 100)

/** Meter -> Canvas-Pixel, nicht unter dem Mindestmass. */
export const meterZuPx = (meter: number, metersPer100px: number): number => {
  if (!(metersPer100px > 0) || !Number.isFinite(meter)) return RAHMEN_MIN_PX
  return Math.max(RAHMEN_MIN_PX, Math.round((meter * 100) / metersPer100px))
}

/** Flaeche in m² aus Breite × Tiefe (Pixel). */
export const flaecheM2 = (breitePx: number, tiefePx: number, metersPer100px: number): number =>
  rund(((breitePx * metersPer100px) / 100) * ((tiefePx * metersPer100px) / 100), 1)
