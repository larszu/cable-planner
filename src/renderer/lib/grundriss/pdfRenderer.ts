// #984 — PDF-Hallenplaene ueber das pdf.js aus `unpdf` (schon fuer
// Datenblaetter im Bundle), erst beim ersten PDF geladen.
import { pdfjsRenderer, type PdfjsModul, type PdfSeitenRenderer } from '../../avplan/floorplan/planDatei'

let renderer: Promise<PdfSeitenRenderer> | null = null

export const pdfRenderer: PdfSeitenRenderer = async (daten, seite, kante) => {
  renderer ??= import('unpdf').then(async (m) => pdfjsRenderer((await m.getResolvedPDFJS()) as unknown as PdfjsModul))
  return (await renderer)(daten, seite, kante)
}
