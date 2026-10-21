// #984 — Hallenplan zuschneiden. Der Zuschnitt wird ins Bild gerechnet, statt
// als Rechteck mitzureisen: so muessen Canvas-Knoten, Exporte und Venue-
// Austausch nichts davon wissen. Der verbliebene Ausschnitt bleibt auf dem
// Canvas, wo er war — damit gilt eine Kalibrierung (Canvas-Koordinaten)
// unveraendert weiter.

import type { Grundriss } from '../../types/grundriss'

/** Rechteck relativ zum Bild, 0–1. */
export interface Zuschnitt {
  x: number
  y: number
  w: number
  h: number
}

const klemme = (v: number) => Math.min(1, Math.max(0, v))

/** Rechteck aus zwei Zeigerpunkten (relativ), auf das Bild begrenzt. */
export const zuschnittAus = (a: { x: number; y: number }, b: { x: number; y: number }): Zuschnitt => {
  const x1 = klemme(Math.min(a.x, b.x))
  const y1 = klemme(Math.min(a.y, b.y))
  return { x: x1, y: y1, w: klemme(Math.max(a.x, b.x)) - x1, h: klemme(Math.max(a.y, b.y)) - y1 }
}

/** Zu klein zum Uebernehmen (versehentlicher Klick statt Ziehen). */
export const zuschnittGueltig = (z: Zuschnitt, g: Pick<Grundriss, 'naturalWidth' | 'naturalHeight'>): boolean =>
  z.w * g.naturalWidth >= 8 && z.h * g.naturalHeight >= 8

/** Quellrechteck im Bild und neue Lage auf dem Canvas. */
export function zuschnittGeometrie(g: Grundriss, z: Zuschnitt) {
  const sx = Math.round(z.x * g.naturalWidth)
  const sy = Math.round(z.y * g.naturalHeight)
  const sw = Math.max(1, Math.round(z.w * g.naturalWidth))
  const sh = Math.max(1, Math.round(z.h * g.naturalHeight))
  const fx = g.width / g.naturalWidth
  const fy = g.height / g.naturalHeight
  return {
    quelle: { sx, sy, sw, sh },
    lage: { x: g.x + sx * fx, y: g.y + sy * fy, width: sw * fx, height: sh * fy },
  }
}

/** Schneidet das Bild zu (Browser-Canvas). PNG bleibt PNG, sonst JPEG. */
export async function grundrissZuschneiden(g: Grundriss, z: Zuschnitt): Promise<Partial<Grundriss>> {
  const { quelle, lage } = zuschnittGeometrie(g, z)
  const img = new Image()
  await new Promise<void>((ok, fehler) => {
    img.onload = () => ok()
    img.onerror = () => fehler(new Error('bild'))
    img.src = g.src
  })
  const c = document.createElement('canvas')
  c.width = quelle.sw
  c.height = quelle.sh
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('bild')
  ctx.drawImage(img, quelle.sx, quelle.sy, quelle.sw, quelle.sh, 0, 0, quelle.sw, quelle.sh)
  const png = g.src.startsWith('data:image/png')
  return {
    src: png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9),
    naturalWidth: quelle.sw,
    naturalHeight: quelle.sh,
    ...lage,
  }
}
