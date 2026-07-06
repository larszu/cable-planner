import { describe, expect, it } from 'vitest'
import {
  LABEL_SHEETS,
  LABEL_ROLLS,
  labelSheetById,
  labelSlots,
  labelPageCount,
  buildLabelSheetHtml,
  type LabelSpec,
} from '../src/renderer/lib/labelSheets'
import { buildPackListHtml } from '../src/renderer/lib/inventoryPrint'
import type { PackListNode } from '../src/renderer/lib/packList'
import type { StorageNode } from '../src/renderer/types/inventory'

const sheet3667 = labelSheetById('zweckform-3667')!

describe('labelSheets — Geometrie', () => {
  it('Zweckform 3667: 65 Etiketten (5×13) passen auf eine A4-Seite', () => {
    expect(sheet3667.cols * sheet3667.rows).toBe(65)
    expect(labelPageCount(65, sheet3667)).toBe(1)
    expect(labelPageCount(66, sheet3667)).toBe(2)
  })

  it('labelSlots positioniert korrekt auf dem Raster', () => {
    const slots = labelSlots(7, sheet3667)
    // Erstes Etikett = Rand oben/links.
    expect(slots[0]).toEqual({ page: 0, leftMm: 4.7, topMm: 10.7 })
    // 6. Etikett (Index 5) → nächste Zeile, erste Spalte.
    expect(slots[5]).toEqual({ page: 0, leftMm: 4.7, topMm: 10.7 + sheet3667.pitchYMm })
    // 2. Etikett → zweite Spalte.
    expect(slots[1]).toEqual({ page: 0, leftMm: 4.7 + sheet3667.pitchXMm, topMm: 10.7 })
  })

  it('startOffset lässt angebrochene Bögen an der richtigen Zelle weiterdrucken', () => {
    const slots = labelSlots(1, sheet3667, 3)
    // Offset 3 → 4. Zelle (Spalte 3, Zeile 0).
    expect(slots[0]).toEqual({ page: 0, leftMm: 4.7 + 3 * sheet3667.pitchXMm, topMm: 10.7 })
  })

  it('Endlos-Rollen ergeben je Etikett eine eigene Seite', () => {
    const roll = LABEL_ROLLS[0]
    expect(roll.roll).toBe(true)
    expect(labelPageCount(3, roll)).toBe(3)
    expect(labelSlots(3, roll).map((s) => s.page)).toEqual([0, 1, 2])
  })

  it('buildLabelSheetHtml erzeugt @page-Größe + je Etikett QR + Code', () => {
    const labels: LabelSpec[] = [
      { qrDataUrl: 'data:image/png;base64,AAA', code: 'INV-1', title: 'SM58' },
      { qrDataUrl: 'data:image/png;base64,BBB', code: 'INV-2' },
    ]
    const html = buildLabelSheetHtml(labels, sheet3667)
    expect(html).toContain('size: 210mm 297mm')
    expect(html).toContain('INV-1')
    expect(html).toContain('data:image/png;base64,BBB')
    expect(html).toContain('SM58')
  })

  it('alle A4-Formate haben plausible Bogenmaße (A4)', () => {
    for (const s of LABEL_SHEETS) {
      expect(s.pageWidthMm).toBe(210)
      expect(s.pageHeightMm).toBe(297)
      // Etiketten dürfen die Seite nicht überlaufen.
      expect(s.marginLeftMm + s.cols * s.pitchXMm).toBeLessThanOrEqual(210.01)
      expect(s.marginTopMm + s.rows * s.pitchYMm).toBeLessThanOrEqual(297.01)
    }
  })
})

describe('inventoryPrint — Packlisten-HTML', () => {
  const node = (id: string, kind: StorageNode['kind']): StorageNode => ({
    id,
    name: id,
    kind,
    createdAt: '',
    updatedAt: '',
  })
  const list: PackListNode[] = [
    { node: { ...node('TC', 'transportCase'), code: 'C-1' }, depth: 0, items: [{ model: 'XLR', qty: 5 }], units: [] },
    { node: node('Case', 'case'), depth: 1, items: [], units: [{ label: 'Cam · SN1', condition: 'defect' }] },
  ]

  it('rendert Baum, Codes, Mengen und Zustand', () => {
    const html = buildPackListHtml('TC', 'C-1', list, '2026-07-06')
    expect(html).toContain('Packliste — TC')
    expect(html).toContain('C-1')
    expect(html).toContain('5×')
    expect(html).toContain('XLR')
    expect(html).toContain('[defect]')
    expect(html).toContain('6 Positionen') // 5 Bulk + 1 Unit
  })
})
