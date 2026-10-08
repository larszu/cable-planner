/**
 * #1031 — Trefferflaeche eines Port-Griffs bei kleinem Zoom.
 *
 * Der Griff ist 16 Flow-Pixel gross (`HANDLE_SIZE`) und schrumpft mit dem
 * Zoom: bei 40 % sind es 6,4 Bildschirm-Pixel, daneben liegt sofort die
 * Kabellinie, und der Klick waehlt das Kabel statt ein neues zu ziehen.
 *
 * Gerechnet wird, wie weit das unsichtbare `::after` des Griffs (index.css)
 * ueber den Griff hinausragen muss, damit er auf dem Bildschirm mindestens
 * `MIN_SCREEN_PX` misst. Die Werte sind Flow-Pixel, weil das Pseudo-Element
 * im skalierten Viewport liegt.
 *
 *   NACH AUSSEN darf er frei wachsen — dort ist leere Leinwand.
 *   NACH OBEN UND UNTEN hoechstens bis kurz vor die Nachbar-Reihe: ein
 *   Griff, der den Port darueber ueberdeckt, ist schlimmer als ein
 *   verfehlter (siehe index.css, `pointer: coarse`). Bei 40 % sind Reihen
 *   ~9 px auseinander, mehr als das gibt die Geometrie nicht her.
 */
export const MIN_SCREEN_PX = 12

export const griffAusdehnung = (
  zoom: number,
  portRow: number,
  handleSize: number,
): { aussen: number; vertikal: number } => {
  if (!Number.isFinite(zoom) || zoom <= 0) return { aussen: 0, vertikal: 0 }
  const fehlt = Math.max(0, MIN_SCREEN_PX / zoom - handleSize)
  const vertikalMax = Math.max(0, (portRow - handleSize) / 2 - 1)
  return {
    aussen: Math.round(fehlt * 10) / 10,
    vertikal: Math.round(Math.min(fehlt / 2, vertikalMax) * 10) / 10,
  }
}
