// v7.9.46 — Geteilte jsPDF-Helpers für PDF-Export-Pfade
// (exportPdf, exportDevicePdf, intercomMatrixXlsx, …).
//
// jsPDF default-codiert Strings nach Latin-1 — Unicode-Sonderzeichen
// (Umlaute, Box-Drawing, Emoji) werden zu "?". sanitizeForPdf macht
// daraus saubere Latin-1-Substitutionen. pdfText kapselt das plus
// optional splitTextToSize-Wrap. Vorher hatte exportDevicePdf eine
// eigene pdfText-Funktion, exportPdf hat sanitizeForPdf inline am
// jeden pdf.text-Call wiederholt.

import type jsPDF from 'jspdf'
import { sanitizeForPdf } from './sanitizeForPdf'

export interface PdfTextOptions {
  /** Maximale Zeilen-Breite in pt; bei Überschreitung wird via
   *  splitTextToSize gewrappt. */
  maxWidth?: number
  align?: 'left' | 'right' | 'center'
}

/** Wrap pdf.text so user-typed strings are auto-sanitized for Latin-1.
 *  Returns the number of rendered lines so the caller can advance Y. */
export const pdfText = (
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  options?: PdfTextOptions,
): number => {
  const safe = sanitizeForPdf(text)
  if (options?.maxWidth) {
    const lines = pdf.splitTextToSize(safe, options.maxWidth) as string[]
    pdf.text(lines, x, y, { align: options.align })
    return lines.length
  }
  pdf.text(safe, x, y, { align: options?.align })
  return 1
}
