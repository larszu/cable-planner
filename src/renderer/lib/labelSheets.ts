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
  /**
   * Fremdes Material, im Klartext (Bedarf 67) — „Sub-Hire · Videohaus Meier ·
   * zurueck 2026-09-12". Leer bei eigenem.
   *
   * Das Etikett ist die einzige der drei vom Bedarf genannten Stellen, die AM
   * OBJEKT klebt: wer im Lager ein Case in die Hand nimmt, sieht sonst
   * nirgends, dass es fremdes ist. Genau daran haengt der Schaden, den der
   * Bedarf nennt — nicht der Verlust, sondern die zusaetzliche Mietwoche.
   */
  note?: string
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
    // Bedarf 67: die Herkunft AUF dem Etikett. Nur wenn es eine gibt — ein
    // „Eigen" auf jedem Etikett macht den Hinweis unsichtbar, auf den es
    // ankommt.
    const note = label.note ? `<div class="o">${esc(label.note)}</div>` : ''
    if (label.symbology === 'barcode') {
      // Gestapelt: Barcode oben (quer), Titel + Code darunter.
      return `<div class="lbl bc" style="${box}">
  <img class="bar" src="${label.qrDataUrl}" style="width:${barWmm}mm;height:${barHmm}mm" alt="" />
  <div class="txt">${title}<div class="c">${esc(label.code)}</div>${note}</div>
</div>`
    }
    // QR: quadratisch links, Text rechts.
    return `<div class="lbl" style="${box}">
  <img class="qr" src="${label.qrDataUrl}" style="width:${qrMm}mm;height:${qrMm}mm" alt="" />
  <div class="txt">${title}<div class="c">${esc(label.code)}</div>${note}</div>
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
  /* Herkunft (Bedarf 67): kleiner als der Code, aber FETT — auf einem Case im
     Regal muss „Sub-Hire" ins Auge fallen, ohne den Code zu verdraengen. */
  .o { font-size: 6.5pt; font-weight: 700; margin-top: 0.3mm; }
</style></head><body>
${pageDivs.join('\n')}
</body></html>`
}

// ───────────────────────────────────────────────────────────────────────────
// BEDARF 70 (P2) — passt das ueberhaupt drauf?
//
//   > manually cut parts of it so that it fits, sometimes trimming very close
//   > to the QR code
//   (grokability/snipe-it#19541, 2026-08-24, offen)
//
//   > wants the code as text for „visual confirmation" and „manual entry"
//   (grokability/snipe-it#18280, 2025-12, offen)
//
// Die Massnahme der Bedarfs-Datenbank: „Any label/QR output from the suite
// must print the code as text, offer at least three geometries, and treat
// manual entry of the code as a first-class path rather than a punishment."
//
// ─── ZWEI DAVON STEHEN SCHON ───────────────────────────────────────────────
//
// Der Klartext-Code steht unter der Grafik (`.c`), und Geometrien gibt es
// mehr als drei (`ALL_LABEL_FORMATS`). Was fehlte, ist die dritte, unsichtbare
// Haelfte des zweiten Belegs: der Klartext-Code NUETZT NUR, WENN ER DRAUFPASST.
// `.lbl` schneidet mit `overflow: hidden` ab — ein zu langer Code wird also
// still gekuerzt, und genau der Rueckfallweg, um den der Melder bittet, ist
// dann weg. Auf dem Bogen sieht das aus wie ein Etikett.
//
// ─── DAS IST EINE SCHAETZUNG, KEINE MESSUNG ────────────────────────────────
//
// Gerechnet wird aus Schriftgroesse und Zeichenbreite, nicht aus einem
// gerenderten Layout — diese Anwendung hat keinen Zugriff auf die
// Textmetriken des Druckertreibers. Die Funktion heisst deshalb
// `estimateLabelFit`, und der Befund sagt es. Eine als Messung ausgegebene
// Schaetzung waere hier besonders teuer: sie gaebe gruenes Licht fuer einen
// Bogen, der dann doch abschneidet.
//
// Zwei Vorsichtsmassnahmen, damit die Schaetzung eher zu frueh warnt als zu
// spaet: die Zeichenbreite ist die von Courier (0,6 em, monospace — genau die
// Schrift, in der `.c` gesetzt ist), und angebrochene Zeilen zaehlen nicht mit.
// ───────────────────────────────────────────────────────────────────────────

/** mm je Punkt. 1 pt = 1/72 Zoll, 1 Zoll = 25,4 mm. */
const MM_PER_PT = 25.4 / 72

/** Schriftgroessen aus dem Stylesheet oben, in Punkt. Sie stehen hier als
 *  Konstanten, damit Layout und Pruefung nicht auseinanderlaufen koennen. */
const CODE_PT = 8
const TITLE_PT = 7
const NOTE_PT = 6.5
const LINE_HEIGHT = 1.15
/** Zeichenbreite einer Monospace-Schrift in em. Courier: 0,6. */
const MONO_ADVANCE_EM = 0.6

export interface LabelFit {
  /** Wie viele Zeichen des Codes je Zeile Platz haben. */
  charsPerLine: number
  /** Wie viele volle Zeilen fuer den Code bleiben. */
  linesForCode: number
  /** Wie viele Zeichen des Codes insgesamt Platz haben. */
  codeCapacity: number
  /** Passt der laengste uebergebene Code? */
  fits: boolean
  /** Der laengste Code, der geprueft wurde. Leer, wenn keiner uebergeben war. */
  longestCode: string
}

/**
 * Schaetzt, wie viel Klartext-Code auf ein Etikett dieses Formats passt.
 *
 * Rechnet dieselbe Geometrie nach, die `buildLabelSheetHtml` setzt: bei QR
 * steht die Grafik links und der Text daneben, bei Barcode darueber und der
 * Text darunter ueber die volle Breite.
 */
export const estimateLabelFit = (
  sheet: LabelSheet,
  labels: Pick<LabelSpec, 'code' | 'title' | 'note' | 'symbology'>[],
): LabelFit => {
  const longest = labels.reduce(
    (a, b) => ((b.code ?? '').length > a.length ? (b.code ?? '') : a),
    '',
  )
  const hatTitel = labels.some((l) => (l.title ?? '').trim() !== '')
  const hatNotiz = labels.some((l) => (l.note ?? '').trim() !== '')
  const barcode = labels.some((l) => l.symbology === 'barcode')

  // Dieselben Zahlen wie im Builder oben.
  const qrMm = Math.max(8, Math.min(sheet.labelHeightMm - 3, sheet.labelWidthMm * 0.42))
  const barHmm = Math.max(6, Math.min(sheet.labelHeightMm * 0.55, sheet.labelHeightMm - 5))

  // `.lbl` hat 1,5 mm Padding rundum; bei QR zusaetzlich 1,5 mm Spalt.
  const textWidthMm = barcode
    ? sheet.labelWidthMm - 3
    : sheet.labelWidthMm - 3 - 1.5 - qrMm
  const textHeightMm = barcode ? sheet.labelHeightMm - 3 - barHmm - 0.5 : sheet.labelHeightMm - 3

  const charWidthMm = CODE_PT * MONO_ADVANCE_EM * MM_PER_PT
  const charsPerLine = Math.max(0, Math.floor(textWidthMm / charWidthMm))

  const titleMm = hatTitel ? TITLE_PT * LINE_HEIGHT * MM_PER_PT : 0
  const noteMm = hatNotiz ? NOTE_PT * LINE_HEIGHT * MM_PER_PT + 0.3 : 0
  const codeLineMm = CODE_PT * LINE_HEIGHT * MM_PER_PT
  // Angebrochene Zeilen zaehlen NICHT mit: eine halb sichtbare Zeile ist kein
  // lesbarer Code, sondern genau der Fall aus dem Beleg.
  const linesForCode = Math.max(0, Math.floor((textHeightMm - titleMm - noteMm) / codeLineMm))

  const codeCapacity = charsPerLine * linesForCode
  return {
    charsPerLine,
    linesForCode,
    codeCapacity,
    fits: longest.length <= codeCapacity,
    longestCode: longest,
  }
}

/**
 * Die Formate, auf denen der laengste Code noch vollstaendig steht.
 *
 * Eine Empfehlung und keine Automatik: welches Etikett physisch auf die Kiste
 * passt, weiss nur jemand, der die Kiste sieht. Der Beleg beschreibt genau den
 * umgekehrten Fehler — ein Werkzeug, das eine Groesse vorgibt, und einen
 * Menschen mit der Schere.
 */
export const formatsThatFit = (
  labels: Pick<LabelSpec, 'code' | 'title' | 'note' | 'symbology'>[],
): LabelSheet[] => ALL_LABEL_FORMATS.filter((s) => estimateLabelFit(s, labels).fits)
