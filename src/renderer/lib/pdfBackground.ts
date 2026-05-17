// v7.9.24 — Vektor-basiertes Canvas-Hintergrund-Rendering für PDF-Export.
//
// Vorher: der Hintergrund (Dots / Lines / Cross) wurde als CSS-Background
// auf dem ReactFlow-Viewport gerendert und zusammen mit dem Canvas als
// JPEG gerastert. Folge:
//   - Punkte erschienen nur im Bereich des sichtbaren ReactFlow-Panes
//     statt über die volle Drawing-Fläche
//   - Ein weißer Rand entstand am Rand der JPEG-Capture
//   - Beim Zoomen ins PDF wurden die Punkte pixelig (Raster)
//
// Jetzt: Hintergrund wird direkt in jsPDF als Vektor-Primitiven gezeichnet
// (Rechteck + Kreise/Linien für das Pattern). Vorteile:
//   - Skaliert unendlich beim Zoomen
//   - Deckt die komplette Drawing-Fläche ab
//   - Saubere Trennung: Capture liefert nur Equipment+Kabel (PNG mit
//     transparentem Hintergrund), PDF rendert das Background-Layer dahinter

import type jsPDF from 'jspdf'
import type { ExportBgVariant } from './exportBackground'

export interface VectorBackgroundOptions {
  /** Drawing-Rechteck in Punkt (PDF-Units). */
  x: number
  y: number
  width: number
  height: number
  /** Hintergrund-Variante. */
  variant: ExportBgVariant
  /** Solider Fallback hinter dem Pattern. */
  bgFillHex: string
  /** Pattern-Farbe als Hex. */
  patternHex: string
  /** Opacity 0..1 für das Pattern. */
  opacity: number
  /** Grid-Step in CSS-Pixel (entspricht der Live-Canvas-Einstellung).
   *  Wird intern via px→pt umgerechnet. */
  gridSizePx: number
}

/** Konvertiert CSS-Hex (#rrggbb / #rgb / mit Alpha) in RGB-Komponenten. */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const m = /^#([0-9a-f]{3,8})$/i.exec(hex)
  if (!m) return { r: 0, g: 0, b: 0 }
  const h = m[1]
  if (h.length === 3 || h.length === 4) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    }
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

// Pixel → Punkt-Umrechnung (96 DPI Annahme, identisch zum Rest des Exports).
const PX_TO_PT = 0.75

/** Zeichnet den vollständigen Vektor-Hintergrund (Solid + Pattern) in
 *  das übergebene jsPDF-Dokument. Aufrufer muss VOR dem addImage()-Call
 *  des Content-PNGs aufgerufen werden, damit das Pattern als unterste
 *  Layer landet. */
export const drawVectorBackground = (pdf: jsPDF, opts: VectorBackgroundOptions): void => {
  const { x, y, width, height, variant, bgFillHex, patternHex, opacity, gridSizePx } = opts
  // 1) Solid-Background als Rechteck — füllt die gesamte Drawing-Fläche,
  //    sodass der weiße PDF-Default nicht durchscheint (auch nicht am Rand).
  const bg = hexToRgb(bgFillHex)
  pdf.setFillColor(bg.r, bg.g, bg.b)
  pdf.rect(x, y, width, height, 'F')

  if (variant === 'none' || opacity <= 0) return

  const gridPt = Math.max(1, gridSizePx * PX_TO_PT)
  const pattern = hexToRgb(patternHex)

  // Opacity via GState (jsPDF >= 2.x unterstützt das).
  const prevGState = (pdf as unknown as { internal?: { getCurrentPageInfo?: () => unknown } })
  void prevGState
  type WithGState = jsPDF & {
    setGState: (g: unknown) => void
    GState: new (opts: { opacity: number }) => unknown
  }
  const pdfWithGState = pdf as WithGState
  try {
    pdfWithGState.setGState(new pdfWithGState.GState({ opacity: Math.max(0, Math.min(1, opacity)) }))
  } catch {
    /* jsPDF ohne GState-Plugin — wir simulieren via gemischter Farbe.
     * Mische die Pattern-Farbe mit dem Solid-BG anteilig. */
    const mix = (c: number, base: number, a: number) =>
      Math.round(c * a + base * (1 - a))
    pattern.r = mix(pattern.r, bg.r, opacity)
    pattern.g = mix(pattern.g, bg.g, opacity)
    pattern.b = mix(pattern.b, bg.b, opacity)
  }
  pdf.setFillColor(pattern.r, pattern.g, pattern.b)
  pdf.setDrawColor(pattern.r, pattern.g, pattern.b)
  pdf.setLineWidth(0.4)

  // Zeichne Pattern. Wir starten am ersten Grid-Punkt INNERHALB des
  // Rechtecks, sodass das Pattern unabhängig von der Drawing-Position
  // an Punkten ankert die der Canvas-Grid entsprechen.
  const startX = x + (gridPt / 2)
  const startY = y + (gridPt / 2)
  const endX = x + width
  const endY = y + height

  if (variant === 'dots') {
    const dotRadius = Math.max(0.5, gridPt * 0.06) // dezent, skaliert mit gridSize
    for (let py = startY; py <= endY; py += gridPt) {
      for (let px = startX; px <= endX; px += gridPt) {
        pdf.circle(px, py, dotRadius, 'F')
      }
    }
  } else if (variant === 'lines') {
    for (let px = x; px <= endX; px += gridPt) {
      pdf.line(px, y, px, endY)
    }
    for (let py = y; py <= endY; py += gridPt) {
      pdf.line(x, py, endX, py)
    }
  } else if (variant === 'cross') {
    const arm = Math.max(1.5, gridPt * 0.15)
    for (let py = startY; py <= endY; py += gridPt) {
      for (let px = startX; px <= endX; px += gridPt) {
        pdf.line(px - arm, py, px + arm, py)
        pdf.line(px, py - arm, px, py + arm)
      }
    }
  }

  // GState zurücksetzen damit nachfolgende Renderings (Title, addImage)
  // nicht weiter mit der Pattern-Opacity zeichnen.
  try {
    pdfWithGState.setGState(new pdfWithGState.GState({ opacity: 1 }))
  } catch {
    /* ignore */
  }
}
