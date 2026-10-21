// ───────────────────────────────────────────────────────────────────────────
// #992 — Dieselbe Tabelle als gestaltetes PDF und als gestaltete Excel-Datei.
//
// Quelle ist immer die `CsvTable`, aus der auch die CSV entsteht. Es gibt
// keine zweite Zusammenstellung der Zeilen: CSV bleibt das Backup, PDF und
// XLSX sind nur andere Ausgaben desselben Inhalts.
//
//  - PDF: Deckblatt mit verlinktem Inhaltsverzeichnis, Lesezeichen je Blatt,
//    wiederholter Tabellenkopf auf jeder Seite, Stempel und Seitenzahl.
//  - XLSX: ein Arbeitsblatt je Tabelle, Kopf in Navy, Spaltenbreiten aus dem
//    Inhalt, fixierte Kopfzeile, Autofilter.
//
// Farben aus der LZM-CI (Brand Guide 2.0): Navy, Eisblau, Stahlblau, Schiefer.
// ───────────────────────────────────────────────────────────────────────────

import type jsPDF from 'jspdf'
import type * as XLSXNs from 'xlsx-js-style'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { CsvCell, CsvTable } from './csv'

export interface DocSheet {
  title: string
  table: CsvTable
  /** Stand-Zeile (Stempel), steht unter dem Titel und in der Fusszeile. */
  stamp?: string
}

export const LZM = {
  navy: '1D324F',
  ice: 'E1ECEF',
  steel: '8C9CB3',
  slate: '5C6B85',
  offWhite: 'F6F5F0',
} as const

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(0, 2), 16),
  parseInt(hex.slice(2, 4), 16),
  parseInt(hex.slice(4, 6), 16),
]

const cellText = (c: CsvCell): string => (c === null || c === undefined ? '' : String(c))

/** Excel erlaubt 31 Zeichen und kein : \ / ? * [ ] im Blattnamen; Namen müssen eindeutig sein. */
export function sheetName(title: string, used: Set<string>): string {
  const base = title.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet'
  let name = base
  for (let i = 2; used.has(name.toLowerCase()); i++) {
    const suffix = ` (${i})`
    name = base.slice(0, 31 - suffix.length) + suffix
  }
  used.add(name.toLowerCase())
  return name
}

/** Spaltenbreite in Zeichen: längster Wert, begrenzt auf 8…60. */
export function columnWidths(table: CsvTable): number[] {
  return table.headers.map((h, i) => {
    let max = h.length
    for (const r of table.rows) {
      for (const line of cellText(r[i]).split('\n')) max = Math.max(max, line.length)
    }
    return Math.min(60, Math.max(8, max + 2))
  })
}

/** Arbeitsmappe mit einem gestalteten Blatt je Tabelle. */
export function buildWorkbook(
  XLSX: typeof XLSXNs,
  sheets: readonly DocSheet[],
): { wb: XLSXNs.WorkBook; freezeRows: number[] } {
  const wb = XLSX.utils.book_new()
  const used = new Set<string>()
  const freezeRows: number[] = []
  const border = { bottom: { style: 'thin', color: { rgb: LZM.steel } } }
  for (const s of sheets) {
    const top = s.stamp ? [[s.title], [s.stamp], []] : [[s.title], []]
    const headRow = top.length
    const aoa: CsvCell[][] = [...top, s.table.headers, ...s.table.rows]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const cols = Math.max(1, s.table.headers.length)
    const titleCell = ws[XLSX.utils.encode_cell({ r: 0, c: 0 })]
    if (titleCell) titleCell.s = { font: { bold: true, sz: 14, color: { rgb: LZM.navy } } }
    if (s.stamp) {
      const st = ws[XLSX.utils.encode_cell({ r: 1, c: 0 })]
      if (st) st.s = { font: { sz: 9, color: { rgb: LZM.slate } } }
    }
    for (let c = 0; c < cols; c++) {
      const h = ws[XLSX.utils.encode_cell({ r: headRow, c })]
      if (h)
        h.s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { patternType: 'solid', fgColor: { rgb: LZM.navy } },
          alignment: { vertical: 'center', wrapText: true },
        }
      s.table.rows.forEach((_, ri) => {
        const cell = ws[XLSX.utils.encode_cell({ r: headRow + 1 + ri, c })]
        if (!cell) return
        cell.s = {
          alignment: { vertical: 'top', wrapText: true },
          border,
          ...(ri % 2 === 1 ? { fill: { patternType: 'solid', fgColor: { rgb: LZM.ice } } } : {}),
        }
      })
    }
    ws['!cols'] = columnWidths(s.table).map((wch) => ({ wch }))
    const lastRow = headRow + s.table.rows.length
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({ s: { r: headRow, c: 0 }, e: { r: lastRow, c: cols - 1 } }),
    }
    freezeRows.push(headRow + 1)
    XLSX.utils.book_append_sheet(wb, ws, sheetName(s.title, used))
  }
  return { wb, freezeRows }
}

/**
 * Kopfzeile fixieren. xlsx-js-style schreibt keine Fensterteilung, also
 * wird sie nach dem Schreiben in jedes Blatt-XML gesetzt.
 */
export function freezeHeaderRows(xlsx: Uint8Array, freezeRows: readonly number[]): Uint8Array {
  const files = unzipSync(xlsx)
  freezeRows.forEach((rows, i) => {
    const path = `xl/worksheets/sheet${i + 1}.xml`
    const xml = files[path]
    if (!xml || rows < 1) return
    const cell = `A${rows + 1}`
    const pane =
      `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${rows}" topLeftCell="${cell}" activePane="bottomLeft" state="frozen"/>` +
      `<selection pane="bottomLeft" activeCell="${cell}" sqref="${cell}"/></sheetView></sheetViews>`
    let text = strFromU8(xml).replace(/<sheetViews>[\s\S]*?<\/sheetViews>|<sheetViews\/>/, '')
    text = text.replace(/(<dimension[^>]*\/>)/, `$1${pane}`)
    files[path] = strToU8(text)
  })
  return zipSync(files)
}

/** Fertige .xlsx-Bytes: Mappe schreiben, Kopfzeilen fixieren. */
export function workbookBytes(XLSX: typeof XLSXNs, sheets: readonly DocSheet[]): Uint8Array {
  const { wb, freezeRows } = buildWorkbook(XLSX, sheets)
  const raw = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
  return freezeHeaderRows(raw, freezeRows)
}

/** Helvetica in jsPDF kennt nur Latin-1; Pfeile und Typografie ersetzen. */
export function pdfSafe(s: string): string {
  return s
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/[–—]/g, '-')
    .replace(/[„“”]/g, '"')
    .replace(/[‚‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/[^\n\t -ÿ]/g, '?')
}

export interface PdfOptions {
  /** Titel des Deckblatts (Projektname). */
  title: string
  /** Überschrift des Inhaltsverzeichnisses. */
  tocLabel: string
  /** Seitenzahl-Vorlage, z. B. "Page {n} of {total}". */
  pageLabel: string
  /** Deckblatt mit Inhaltsverzeichnis — bei einem einzelnen Blatt weglassbar. */
  cover: boolean
  /**
   * Public Sans (OFL) als Base64-TTF, Regular und Bold. Mit ihr steht der
   * Text in der Hausschrift und mit allen Zeichen; ohne sie fällt die
   * Ausgabe auf Helvetica zurück und ersetzt, was Latin-1 nicht kennt.
   */
  fonts?: { regular: string; bold: string }
}

const FACE = 'PublicSans'

/** Public Sans lazy laden (eigener Chunk, nur beim PDF-Export). */
export async function loadPublicSans(): Promise<{ regular: string; bold: string }> {
  const [r, b] = await Promise.all([
    import('../assets/fonts/PublicSans-Regular.ttf?url'),
    import('../assets/fonts/PublicSans-Bold.ttf?url'),
  ])
  const b64 = async (url: string) => {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer())
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    }
    return btoa(bin)
  }
  const [regular, bold] = await Promise.all([b64(r.default), b64(b.default)])
  return { regular, bold }
}

/**
 * Tabellen als PDF: Querformat A4, wiederholter Kopf, Lesezeichen,
 * verlinktes Inhaltsverzeichnis. Liefert das jsPDF-Dokument.
 */
export function buildTablePdf(
  JsPdf: typeof jsPDF,
  sheets: readonly DocSheet[],
  opts: PdfOptions,
): jsPDF {
  const doc = new JsPdf({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const W = 297
  const H = 210
  const M = 18
  const usable = W - 2 * M
  const navy = rgb(LZM.navy)
  const steel = rgb(LZM.steel)
  const slate = rgb(LZM.slate)
  const ice = rgb(LZM.ice)
  const starts: number[] = []
  let face = 'helvetica'
  let clean: (s: string) => string = pdfSafe
  if (opts.fonts) {
    doc.addFileToVFS('PublicSans-Regular.ttf', opts.fonts.regular)
    doc.addFont('PublicSans-Regular.ttf', FACE, 'normal')
    doc.addFileToVFS('PublicSans-Bold.ttf', opts.fonts.bold)
    doc.addFont('PublicSans-Bold.ttf', FACE, 'bold')
    face = FACE
    // Public Sans hat Anführungszeichen, Striche und Auslassung, aber keine Pfeile.
    clean = (x) => x.replace(/→/g, '->').replace(/←/g, '<-')
  }

  const kicker = (text: string, y: number) => {
    doc.setFont(face, 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...slate)
    doc.text(clean(text.toUpperCase()), M, y)
    doc.setDrawColor(...steel)
    doc.setLineWidth(0.3)
    doc.line(M, y + 2, W - M, y + 2)
  }

  if (opts.cover) {
    kicker(opts.tocLabel, M)
    doc.setFont(face, 'bold')
    doc.setFontSize(24)
    doc.setTextColor(...navy)
    doc.text(clean(opts.title), M, M + 16)
  }

  sheets.forEach((s, si) => {
    if (opts.cover || si > 0) doc.addPage()
    starts.push(doc.getNumberOfPages())
    doc.outline.add(null, pdfSafe(s.title), { pageNumber: doc.getNumberOfPages() })

    const headers = s.table.headers.map(clean)
    const raw = columnWidths(s.table)
    const sum = raw.reduce((a, b) => a + b, 0) || 1
    const widths = raw.map((w) => (w / sum) * usable)
    const fs = headers.length > 10 ? 6.5 : 8
    const lh = fs * 0.42
    let y = M

    const drawTitle = (cont: boolean) => {
      kicker(opts.title, y)
      doc.setFont(face, 'bold')
      doc.setFontSize(14)
      doc.setTextColor(...navy)
      doc.text(clean(s.title + (cont ? ' (…)' : '')), M, y + 10)
      y += 12
      if (s.stamp && !cont) {
        doc.setFont(face, 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...slate)
        doc.text(clean(s.stamp), M, y + 3)
        y += 5
      }
      y += 3
    }
    const drawHead = () => {
      doc.setFont(face, 'bold')
      doc.setFontSize(fs)
      const lines = headers.map((h, i) => doc.splitTextToSize(h, widths[i] - 2) as string[])
      const rh = Math.max(...lines.map((l) => l.length), 1) * lh + 2.5
      doc.setFillColor(...navy)
      doc.rect(M, y, usable, rh, 'F')
      doc.setTextColor(255, 255, 255)
      let x = M
      lines.forEach((l, i) => {
        doc.text(l, x + 1, y + 1.2 + lh * 0.8)
        x += widths[i]
      })
      y += rh
    }

    drawTitle(false)
    drawHead()
    doc.setFont(face, 'normal')
    s.table.rows.forEach((r, ri) => {
      doc.setFont(face, 'normal')
      doc.setFontSize(fs)
      const lines = widths.map((w, i) => doc.splitTextToSize(clean(cellText(r[i])), w - 2) as string[])
      const rh = Math.max(...lines.map((l) => l.length), 1) * lh + 2
      if (y + rh > H - M) {
        doc.addPage()
        y = M
        drawTitle(true)
        drawHead()
        doc.setFont(face, 'normal')
        doc.setFontSize(fs)
      }
      if (ri % 2 === 1) {
        doc.setFillColor(...ice)
        doc.rect(M, y, usable, rh, 'F')
      }
      doc.setTextColor(...navy)
      let x = M
      lines.forEach((l, i) => {
        doc.text(l, x + 1, y + 1 + lh * 0.8)
        x += widths[i]
      })
      doc.setDrawColor(...steel)
      doc.setLineWidth(0.1)
      doc.line(M, y + rh, W - M, y + rh)
      y += rh
    })
  })

  if (opts.cover) {
    doc.setPage(1)
    let y = M + 30
    doc.setFont(face, 'normal')
    doc.setFontSize(11)
    sheets.forEach((s, i) => {
      doc.setTextColor(...navy)
      doc.textWithLink(clean(s.title), M, y, { pageNumber: starts[i] })
      doc.setTextColor(...slate)
      doc.text(String(starts[i]), W - M, y, { align: 'right' })
      doc.setDrawColor(...steel)
      doc.setLineWidth(0.1)
      doc.line(M, y + 2, W - M, y + 2)
      y += 8
      if (y > H - M) {
        doc.addPage()
        y = M
      }
    })
  }

  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFont(face, 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...slate)
    doc.text('Lars Zumpe Medienproduktion', M, H - 8)
    doc.text(
      opts.pageLabel.replace('{n}', String(p)).replace('{total}', String(total)),
      W - M,
      H - 8,
      { align: 'right' },
    )
  }
  return doc
}
