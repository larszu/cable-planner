// ───────────────────────────────────────────────────────────────────────────
// Etiketten-Layouts — A4-Bögen (Avery / Zweckform) + Endlos-Rollen (Labeldrucker).
//
// Alle Maße in mm; die Print-Geometrie stammt aus den offiziellen
// Avery/Zweckform-Datenblättern. Der HTML-Builder positioniert jedes Etikett
// absolut (mm) und nutzt `@page` mit der Bogen-/Rollengröße, damit derselbe
// Druck sowohl auf A4 als auch auf einem Endlos-Labeldrucker sauber sitzt.
// Rein: der Aufrufer rendert die QR-Codes (data-URIs) vorab und reicht sie ein.
// ───────────────────────────────────────────────────────────────────────────

export interface LabelSheet {
  id: string
  /** Anzeigename inkl. Avery/Zweckform-Referenz. */
  name: string
  /** Bogen-/Seitengröße (mm). Bei Rollen = ein Etikett. */
  pageWidthMm: number
  pageHeightMm: number
  cols: number
  rows: number
  labelWidthMm: number
  labelHeightMm: number
  /** Rand oben/links bis zur ersten Etikett-Kante (mm). */
  marginTopMm: number
  marginLeftMm: number
  /** Raster-Abstand von Etikett-Kante zu Etikett-Kante (mm) = Label + Spalt. */
  pitchXMm: number
  pitchYMm: number
  /** true = Endlos-Rolle (ein Etikett je Seite, Labeldrucker). */
  roll?: boolean
}

/** A4-Bögen der gängigen Avery/Zweckform-Muster. */
export const LABEL_SHEETS: LabelSheet[] = [
  {
    id: 'zweckform-3667',
    name: 'Zweckform 3667 / Avery L7651 — 65× (38,1 × 21,2 mm)',
    pageWidthMm: 210,
    pageHeightMm: 297,
    cols: 5,
    rows: 13,
    labelWidthMm: 38.1,
    labelHeightMm: 21.2,
    marginTopMm: 10.7,
    marginLeftMm: 4.7,
    pitchXMm: 40.6, // 38,1 + 2,5 Spalt
    pitchYMm: 21.2, // kein vertikaler Spalt
  },
  {
    id: 'zweckform-3489',
    name: 'Zweckform 3489 / Avery L7160 — 21× (63,5 × 38,1 mm)',
    pageWidthMm: 210,
    pageHeightMm: 297,
    cols: 3,
    rows: 7,
    labelWidthMm: 63.5,
    labelHeightMm: 38.1,
    marginTopMm: 15.15,
    marginLeftMm: 7.2,
    pitchXMm: 66, // 63,5 + 2,5
    pitchYMm: 38.1,
  },
  {
    id: 'zweckform-3425',
    name: 'Zweckform 3425 / Avery L7159 — 24× (63,5 × 33,9 mm)',
    pageWidthMm: 210,
    pageHeightMm: 297,
    cols: 3,
    rows: 8,
    labelWidthMm: 63.5,
    labelHeightMm: 33.9,
    marginTopMm: 12.9,
    marginLeftMm: 7.2,
    pitchXMm: 66,
    pitchYMm: 33.9,
  },
  {
    id: 'zweckform-3652',
    name: 'Zweckform 3652 / Avery L7163 — 14× (99,1 × 38,1 mm)',
    pageWidthMm: 210,
    pageHeightMm: 297,
    cols: 2,
    rows: 7,
    labelWidthMm: 99.1,
    labelHeightMm: 38.1,
    marginTopMm: 15.15,
    marginLeftMm: 4.65,
    pitchXMm: 101.6, // 99,1 + 2,5
    pitchYMm: 38.1,
  },
]

/** Endlos-Rollen für Labeldrucker (ein Etikett = eine Seite). */
export const LABEL_ROLLS: LabelSheet[] = [
  roll('roll-62x29', 'Labeldrucker — Brother DK-11209 (62 × 29 mm)', 62, 29),
  roll('roll-57x32', 'Labeldrucker — 57 × 32 mm', 57, 32),
  roll('roll-89x36', 'Labeldrucker — Dymo 99012 (89 × 36 mm)', 89, 36),
  roll('roll-50x25', 'Labeldrucker — 50 × 25 mm', 50, 25),
]

function roll(id: string, name: string, w: number, h: number): LabelSheet {
  return {
    id,
    name,
    pageWidthMm: w,
    pageHeightMm: h,
    cols: 1,
    rows: 1,
    labelWidthMm: w,
    labelHeightMm: h,
    marginTopMm: 0,
    marginLeftMm: 0,
    pitchXMm: w,
    pitchYMm: h,
    roll: true,
  }
}

/** Alle Formate (Bögen + Rollen) für Dropdowns. */
export const ALL_LABEL_FORMATS: LabelSheet[] = [...LABEL_SHEETS, ...LABEL_ROLLS]

export const labelSheetById = (id: string): LabelSheet | undefined =>
  ALL_LABEL_FORMATS.find((s) => s.id === id)

export interface LabelSlot {
  /** 0-basierte Seite. */
  page: number
  /** Position der Etikett-Kante (mm) relativ zur Seite. */
  leftMm: number
  topMm: number
}

/**
 * Berechnet die Etikett-Positionen für `count` Labels auf `sheet`, wobei die
 * ersten `startOffset` Zellen (angebrochener Bogen) leer bleiben. Rein +
 * testbar. Endlos-Rollen (1×1) ergeben je Etikett eine eigene Seite.
 */
export const labelSlots = (count: number, sheet: LabelSheet, startOffset = 0): LabelSlot[] => {
  const perPage = Math.max(1, sheet.cols * sheet.rows)
  const offset = Math.max(0, Math.floor(startOffset)) % perPage
  const slots: LabelSlot[] = []
  for (let i = 0; i < count; i++) {
    const cell = i + offset
    const page = Math.floor(cell / perPage)
    const idxOnPage = cell % perPage
    const col = idxOnPage % sheet.cols
    const row = Math.floor(idxOnPage / sheet.cols)
    slots.push({
      page,
      leftMm: sheet.marginLeftMm + col * sheet.pitchXMm,
      topMm: sheet.marginTopMm + row * sheet.pitchYMm,
    })
  }
  return slots
}

/** Anzahl benötigter Seiten/Bögen für `count` Labels. */
export const labelPageCount = (count: number, sheet: LabelSheet, startOffset = 0): number => {
  if (count <= 0) return 0
  const perPage = Math.max(1, sheet.cols * sheet.rows)
  const offset = Math.max(0, Math.floor(startOffset)) % perPage
  return Math.ceil((count + offset) / perPage)
}

export interface LabelSpec {
  /** Code-Grafik als data-URI (QR oder Barcode, vom Aufrufer gerendert). */
  qrDataUrl: string
  /** Menschlich lesbarer Code (unter/neben der Grafik). */
  code: string
  /** Optionaler Titel (z. B. Modell-/Case-Name). */
  title?: string
  /** Symbologie — steuert das Zell-Layout (QR quadratisch, Barcode quer). */
  symbology?: 'qr' | 'barcode'
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Baut ein selbst-enthaltenes HTML-Dokument mit den Etiketten auf dem gewählten
 * Format. Jede Zelle: QR links, Titel + Code rechts. `@page` steuert die
 * Papier-/Rollengröße; absolute mm-Positionierung sitzt auf dem Avery-Raster.
 */
export const buildLabelSheetHtml = (
  labels: LabelSpec[],
  sheet: LabelSheet,
  startOffset = 0,
): string => {
  const slots = labelSlots(labels.length, sheet, startOffset)
  const pages = labelPageCount(labels.length, sheet, startOffset)
  // QR-Kantenlänge: Etiketthöhe minus Padding, aber nicht breiter als ~40% der
  // Etikettbreite, damit Text Platz hat.
  const qrMm = Math.max(8, Math.min(sheet.labelHeightMm - 3, sheet.labelWidthMm * 0.42))
  // Barcode: quer über die Etikettbreite, Höhe ~ halbe Etiketthöhe (Text darunter).
  const barWmm = sheet.labelWidthMm - 3
  const barHmm = Math.max(6, Math.min(sheet.labelHeightMm * 0.55, sheet.labelHeightMm - 5))
  const cell = (label: LabelSpec, slot: LabelSlot): string => {
    const box = `left:${slot.leftMm}mm;top:${slot.topMm}mm;width:${sheet.labelWidthMm}mm;height:${sheet.labelHeightMm}mm`
    const title = label.title ? `<div class="t">${esc(label.title)}</div>` : ''
    if (label.symbology === 'barcode') {
      // Gestapelt: Barcode oben (quer), Titel + Code darunter.
      return `<div class="lbl bc" style="${box}">
  <img class="bar" src="${label.qrDataUrl}" style="width:${barWmm}mm;height:${barHmm}mm" alt="" />
  <div class="txt">${title}<div class="c">${esc(label.code)}</div></div>
</div>`
    }
    // QR: quadratisch links, Text rechts.
    return `<div class="lbl" style="${box}">
  <img class="qr" src="${label.qrDataUrl}" style="width:${qrMm}mm;height:${qrMm}mm" alt="" />
  <div class="txt">${title}<div class="c">${esc(label.code)}</div></div>
</div>`
  }
  const pageDivs: string[] = []
  for (let p = 0; p < pages; p++) {
    const cells = labels
      .map((label, i) => ({ label, slot: slots[i] }))
      .filter((x) => x.slot.page === p)
      .map(({ label, slot }) => cell(label, slot))
      .join('\n')
    pageDivs.push(`<div class="page">${cells}</div>`)
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title>
<style>
  @page { size: ${sheet.pageWidthMm}mm ${sheet.pageHeightMm}mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  .page { position: relative; width: ${sheet.pageWidthMm}mm; height: ${sheet.pageHeightMm}mm; page-break-after: always; overflow: hidden; }
  .page:last-child { page-break-after: auto; }
  .lbl { position: absolute; display: flex; align-items: center; gap: 1.5mm; padding: 1.5mm; overflow: hidden; }
  .lbl.bc { flex-direction: column; align-items: stretch; justify-content: center; gap: 0.5mm; }
  .qr { flex: 0 0 auto; object-fit: contain; }
  .bar { display: block; object-fit: fill; }
  .lbl.bc .txt { text-align: center; }
  .txt { min-width: 0; font-family: Arial, sans-serif; line-height: 1.15; }
  .t { font-size: 7pt; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .c { font-size: 8pt; font-family: 'Courier New', monospace; word-break: break-all; }
</style></head><body>
${pageDivs.join('\n')}
</body></html>`
}
