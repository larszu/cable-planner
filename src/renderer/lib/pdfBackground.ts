// v7.9.24 — Vektor-basiertes Canvas-Hintergrund-Rendering für PDF-Export.
//
// v7.9.25 — Komplett auf GState-Plugin verzichten und Dot-Density
// begrenzen. Die GState-Calls produzierten in manchen jsPDF-Builds
// PDFs die zwar valide aussahen aber von Chrome's PDF-Viewer im iframe
// (printPdfBlob → window.print()) nicht mehr gerendert wurden — Folge
// war das Print-to-PDF-Pipeline schrieb eine kaputte/leere Datei.
// Plus: die naive "ein Kreis pro Grid-Punkt"-Implementierung erzeugt
// bei größeren Canvases zehntausende Vektor-Operationen, was die PDF
// auf mehrere MB aufbläst und Print-Spool-Probleme verursachen kann.
//
// Jetzt:
//   - Opacity über RGB-Blending zwischen Pattern-Farbe und BG-Farbe
//     (kein GState-Plugin nötig, funktioniert in jedem PDF-Viewer)
//   - Effektive Grid-Density wird in PT umgerechnet und an einen
//     Minimum-Spacing gebunden, damit auch große Drawing-Flächen
//     unter ~6000 Punkte bleiben (PDF-Output bleibt klein + schnell)

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
   *  Wird intern via px→pt umgerechnet und ggf. hochgesetzt um zu
   *  viele Operationen zu vermeiden. */
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

/** Obergrenze für die Anzahl Pattern-Operationen (Dots/Linien/Kreuze).
 *  6000 ist großzügig: typischer A4-Drawing 800×1100 pt = 880,000 pt²
 *  geteilt durch 12-px-Grid-Cell-Area (9×9 pt) ≈ 10,800 → wir wuerden
 *  reduzieren. Bei normalen Workflows ist das nicht spuerbar weil die
 *  Dots eh klein sind. Verhindert die "PDF zu groß / wird nicht
 *  geöffnet" Klasse von Bugs. */
const MAX_PATTERN_OPS = 6000

/** Zeichnet den vollständigen Vektor-Hintergrund (Solid + Pattern) in
 *  das übergebene jsPDF-Dokument. */
export const drawVectorBackground = (pdf: jsPDF, opts: VectorBackgroundOptions): void => {
  const { x, y, width, height, variant, bgFillHex, patternHex, opacity, gridSizePx } = opts

  // 1) Solid-Background als Rechteck — füllt die gesamte Drawing-Fläche,
  //    sodass der weiße PDF-Default nicht durchscheint (auch nicht am Rand).
  const bg = hexToRgb(bgFillHex)
  pdf.setFillColor(bg.r, bg.g, bg.b)
  pdf.rect(x, y, width, height, 'F')

  if (variant === 'none' || opacity <= 0) return

  // 2) Effektives Pattern-Grid in PT. Falls die Dot-Count die
  //    Obergrenze überschreitet, vergrößern wir den effektiven
  //    Grid-Step (sparseres Pattern), damit der PDF-Output klein bleibt.
  let gridPt = Math.max(2, gridSizePx * PX_TO_PT)
  const cellsX = Math.ceil(width / gridPt)
  const cellsY = Math.ceil(height / gridPt)
  const opsForVariant = variant === 'lines' ? cellsX + cellsY : cellsX * cellsY
  if (opsForVariant > MAX_PATTERN_OPS) {
    const scale = Math.sqrt(opsForVariant / MAX_PATTERN_OPS)
    gridPt *= scale
  }

  // 3) Opacity via RGB-Blending statt GState. Mischt Pattern-Farbe
  //    anteilig in die Background-Farbe — visuell äquivalent zu Alpha
  //    auf opaquem BG. Sicher in jedem PDF-Viewer / Drucker.
  const a = Math.max(0, Math.min(1, opacity))
  const patternRaw = hexToRgb(patternHex)
  const mix = (c: number, base: number) => Math.round(c * a + base * (1 - a))
  const pattern = {
    r: mix(patternRaw.r, bg.r),
    g: mix(patternRaw.g, bg.g),
    b: mix(patternRaw.b, bg.b),
  }
  pdf.setFillColor(pattern.r, pattern.g, pattern.b)
  pdf.setDrawColor(pattern.r, pattern.g, pattern.b)
  pdf.setLineWidth(0.4)

  const startX = x + gridPt / 2
  const startY = y + gridPt / 2
  const endX = x + width
  const endY = y + height

  if (variant === 'dots') {
    const dotRadius = Math.max(0.5, Math.min(1.5, gridPt * 0.06))
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
}
