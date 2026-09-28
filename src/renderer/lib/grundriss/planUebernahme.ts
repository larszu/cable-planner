// Hallenplan aus einer Datei uebernehmen — gemeinsam fuer die Dateiauswahl
// im Grundriss-Panel und das Ablegen per Drag & Drop (Panel UND Canvas).
//
// Laden, Verkleinern und die Ablage-Handler kommen aus @avplan/floorplan
// (ADR-015). Hier steht nur, was cable-planner daraus macht: welcher
// Grundriss entsteht, wann vorher gefragt wird und welche Meldung eine
// abgelehnte Datei bekommt.
//
// PDF: cable-planner hat (noch) kein pdf.js. Ohne Renderer lehnt der Lader
// PDFs mit 'pdf-nicht-verfuegbar' ab; die Meldung sagt, wie man trotzdem
// zum Plan kommt (Seite als PNG/JPG exportieren), statt still zu scheitern.

import {
  istPdfDatei,
  PlanDateiFehler,
  planAccept,
  type GeladenerPlan,
  type PlanDateiFehlerCode,
} from '../../avplan/floorplan/planDatei'
import type { Grundriss, PlanPunkt } from '../../types/grundriss'

/** Kann cable-planner PDFs rendern? Solange kein pdf.js im Bundle ist: nein. */
export const PLAN_PDF = false
/** Laengste Bildkante, die in die Projektdatei geht (wie vor ADR-015). */
export const PLAN_MAX_KANTE_CABLE = 3000
export const PLAN_ACCEPT = planAccept({ pdf: PLAN_PDF })

type Uebersetzer = (key: string, fallback: string) => string

/** Neuer Grundriss aus einem geladenen Plan, linke obere Ecke bei `ursprung`. */
export const grundrissAusPlan = (plan: GeladenerPlan, ursprung: PlanPunkt): Grundriss => ({
  src: plan.src,
  name: plan.name,
  naturalWidth: plan.naturalWidth,
  naturalHeight: plan.naturalHeight,
  x: Math.round(ursprung.x),
  y: Math.round(ursprung.y),
  width: plan.naturalWidth,
  height: plan.naturalHeight,
  deckkraft: 0.6,
})

/** Ursprung, damit der Plan mittig auf `punkt` liegt (Drop auf den Canvas). */
export const ursprungUm = (punkt: PlanPunkt, plan: Pick<GeladenerPlan, 'naturalWidth' | 'naturalHeight'>): PlanPunkt => ({
  x: Math.round(punkt.x - plan.naturalWidth / 2),
  y: Math.round(punkt.y - plan.naturalHeight / 2),
})

/** Ersetzen verwirft die Kalibrierung — dann wird vorher gefragt. */
export const ersetzenBrauchtBestaetigung = (g: Grundriss | null | undefined): boolean => !!g?.kalibrierung

/** Fehlercode fuer einen Drop ohne brauchbare Datei. */
export const ungeeignetCode = (dateien: readonly Pick<File, 'name' | 'type'>[]): PlanDateiFehlerCode =>
  !PLAN_PDF && dateien.some((f) => istPdfDatei(f)) ? 'pdf-nicht-verfuegbar' : 'typ'

export const planFehlerCode = (e: unknown): PlanDateiFehlerCode => (e instanceof PlanDateiFehler ? e.code : 'lesen')

export const planFehlerText = (code: PlanDateiFehlerCode, t: Uebersetzer): string => {
  switch (code) {
    case 'pdf-nicht-verfuegbar':
      return t(
        'floorplan.drop.pdfUnsupported',
        'PDF floor plans are not supported yet. Export the page as PNG or JPG and drop that instead.',
      )
    case 'typ':
      return t('floorplan.drop.wrongType', 'This file is not a floor plan image. Use PNG, JPG, WebP, GIF, BMP or AVIF.')
    case 'zu-gross':
      return t('floorplan.drop.tooLarge', 'The file is too large for a floor plan (images up to 40 MB).')
    default:
      return t('floorplan.loadFailed', 'The file could not be read as an image.')
  }
}
