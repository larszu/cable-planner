// #502 — Druckbare Beschriftungs-Labels für Videohub / Smart Control.
//
// Reproduziert Blackmagics „Smart Control / Smart Videohub Label Template"
// (US-Letter, Raster aus kleinen Tasten-Labels mit Schnittmarken) und füllt
// die Zellen mit den Port-/Quell-Namen aus dem Plan — statt die PDF-Vorlage
// von Hand auszufüllen. Die Zellengröße entspricht der Original-Vorlage
// (28,11 × 27,53 pt, aus der Vorlage gemessen), damit ausgeschnittene Labels
// physisch auf die Tasten passen. 11 Spalten × 13 Zeilen pro Seite.

import jsPDF from 'jspdf'
import { pdfText } from './pdfHelpers'

export interface VideohubLabelSection {
  /** Überschrift (z.B. „Eingänge / Quellen", „Ausgänge"). */
  heading: string
  /** Label-Texte in Reihenfolge (ein Label je Taste). */
  labels: string[]
}

// Aus der Original-Vorlage gemessen (Form-XObject-BBox): Tastengröße.
const CELL_W = 28.11
const CELL_H = 27.53
const COLS = 11
const ROWS = 13
const PER_PAGE = COLS * ROWS
// Rasterabstand (Schnittstreifen zwischen den Tasten). Größe der Taste selbst
// bleibt exakt, der Pitch ist nur das Layout auf dem Bogen.
const COL_PITCH = 48
const ROW_PITCH = 48
const CORNER_R = 3
const TICK = 4 // Länge der Schnittmarken
const GRID_TOP = 92

const drawCropTicks = (pdf: jsPDF, x: number, y: number): void => {
  pdf.setDrawColor(150)
  pdf.setLineWidth(0.3)
  const x2 = x + CELL_W
  const y2 = y + CELL_H
  // Je Ecke ein waagrechter + senkrechter Strich nach außen.
  pdf.line(x - TICK, y, x, y); pdf.line(x, y - TICK, x, y) // TL
  pdf.line(x2, y, x2 + TICK, y); pdf.line(x2, y - TICK, x2, y) // TR
  pdf.line(x - TICK, y2, x, y2); pdf.line(x, y2, x, y2 + TICK) // BL
  pdf.line(x2, y2, x2 + TICK, y2); pdf.line(x2, y2, x2, y2 + TICK) // BR
}

const drawCell = (pdf: jsPDF, x: number, y: number, label: string): void => {
  drawCropTicks(pdf, x, y)
  // Tasten-Umriss (helles Grau, abgerundet) wie in der Vorlage.
  pdf.setDrawColor(120)
  pdf.setLineWidth(0.5)
  pdf.roundedRect(x, y, CELL_W, CELL_H, CORNER_R, CORNER_R, 'S')
  const text = (label ?? '').trim()
  if (!text) return
  pdf.setTextColor(20)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6.5)
  const lines = (pdf.splitTextToSize(text, CELL_W - 4) as string[]).slice(0, 3)
  const lineH = 7.5
  const blockH = lines.length * lineH
  const cx = x + CELL_W / 2
  let ty = y + (CELL_H - blockH) / 2 + lineH - 1.5
  for (const line of lines) {
    pdfText(pdf, line, cx, ty, { align: 'center' })
    ty += lineH
  }
}

const drawHeader = (pdf: jsPDF, deviceName: string, heading: string, pageTag: string): void => {
  const pageW = pdf.internal.pageSize.getWidth()
  pdf.setTextColor(15)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdfText(pdf, `${deviceName} — ${heading}`, 40, 44)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(110)
  const right = pageTag ? `Videohub Control Labels · ${pageTag}` : 'Videohub Control Labels'
  pdfText(pdf, right, pageW - 40, 44, { align: 'right' })
  pdfText(pdf, new Date().toLocaleDateString(), pageW - 40, 56, { align: 'right' })
  pdf.setDrawColor(200)
  pdf.setLineWidth(0.5)
  pdf.line(40, 62, pageW - 40, 62)
}

/**
 * Baut das Label-PDF: pro Sektion so viele Seiten wie nötig (max. 143
 * Labels/Seite). Leere Sektionen werden übersprungen.
 */
export function buildVideohubControlLabelsPdf(
  deviceName: string,
  sections: VideohubLabelSection[],
): jsPDF {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' }) // 612 × 792 pt
  const pageW = pdf.internal.pageSize.getWidth()
  const gridW = (COLS - 1) * COL_PITCH + CELL_W
  const left = (pageW - gridW) / 2
  const name = deviceName || 'Videohub'
  let first = true

  for (const section of sections) {
    const labels = section.labels.filter((l) => (l ?? '').trim().length > 0)
    if (labels.length === 0) continue
    const pages = Math.ceil(labels.length / PER_PAGE)
    for (let pg = 0; pg < pages; pg++) {
      if (!first) pdf.addPage()
      first = false
      drawHeader(pdf, name, section.heading, pages > 1 ? `${pg + 1}/${pages}` : '')
      const count = Math.min(PER_PAGE, labels.length - pg * PER_PAGE)
      for (let i = 0; i < count; i++) {
        const col = i % COLS
        const row = Math.floor(i / COLS)
        drawCell(pdf, left + col * COL_PITCH, GRID_TOP + row * ROW_PITCH, labels[pg * PER_PAGE + i])
      }
    }
  }

  if (first) {
    // Keine Labels — leeren Bogen ausgeben, damit der Export nie „nichts" tut.
    drawHeader(pdf, name, sections[0]?.heading ?? 'Labels', '')
  }
  return pdf
}
