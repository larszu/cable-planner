import { describe, expect, it } from 'vitest'
import jsPDF from 'jspdf'
import { strFromU8, unzipSync, zipSync } from 'fflate'
import * as XLSX from 'xlsx-js-style'
import { readFileSync } from 'node:fs'
import { buildTablePdf, buildWorkbook, columnWidths, workbookBytes, pdfSafe, sheetName } from '../src/renderer/lib/tableDocExport'

const table = {
  headers: ['Nr', 'Von', 'Nach'],
  rows: Array.from({ length: 120 }, (_, i) => [i, `Gerät ${i}`, 'Kamera → Mischer']),
}

describe('tableDocExport (#992)', () => {
  it('keeps sheet names valid and unique', () => {
    const used = new Set<string>()
    expect(sheetName('a/b:c', used)).toBe('a b c')
    expect(sheetName('A B C', used)).toBe('A B C (2)')
    expect(sheetName('x'.repeat(40), used).length).toBe(31)
  })
  it('sizes columns from content', () => {
    expect(columnWidths(table)[2]).toBe('Kamera → Mischer'.length + 2)
  })
  it('replaces non-Latin-1 characters for the PDF font', () => {
    expect(pdfSafe('A → B – „c“')).toBe('A -> B - "c"')
  })
  it('workbook: styled header, filter, widths, one sheet per table', () => {
    const { wb } = buildWorkbook(XLSX, [{ title: 'Pull', table, stamp: 'Stand 1' }, { title: 'Pull', table }])
    expect(wb.SheetNames).toEqual(['Pull', 'Pull (2)'])
    const ws = wb.Sheets['Pull']
    expect(ws['A4'].v).toBe('Nr')
    expect(ws['A4'].s.fill.fgColor.rgb).toBe('1D324F')
    expect(ws['!autofilter']?.ref).toBe('A4:C124')
    expect(ws['!cols']).toHaveLength(3)
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    expect(buf.byteLength).toBeGreaterThan(1000)
    const files = unzipSync(workbookBytes(XLSX, [{ title: 'Pull', table, stamp: 'Stand 1' }]))
    const xml = strFromU8(files['xl/worksheets/sheet1.xml'])
    expect(xml).toContain('<pane ySplit="4" topLeftCell="A5"')
    expect(XLSX.read(zipSync(files)).SheetNames).toEqual(['Pull'])
  })
  it('pdf: cover, bookmarks, links, multiple pages', () => {
    const doc = buildTablePdf(jsPDF, [{ title: 'Pull', table }, { title: 'BOM', table }], {
      title: 'Projekt',
      tocLabel: 'Inhalt',
      pageLabel: 'Seite {n} von {total}',
      cover: true,
    })
    expect(doc.getNumberOfPages()).toBeGreaterThan(3)
    const out = doc.output()
    expect(out).toContain('/Outlines')
    expect(out).toContain('/Link')
  })
  it('pdf embeds Public Sans and keeps arrows and quotes', () => {
    const font = (w: string) => readFileSync(`src/renderer/assets/fonts/PublicSans-${w}.ttf`).toString('base64')
    const doc = buildTablePdf(jsPDF, [{ title: 'Pull „A“', table }], {
      title: 'Projekt → Halle',
      tocLabel: 'Inhalt',
      pageLabel: 'Seite {n} von {total}',
      cover: false,
      fonts: { regular: font('Regular'), bold: font('Bold') },
    })
    const out = doc.output()
    expect(out).toContain('/FontFile2')
    expect(out).toContain('PublicSans')
  })
})
