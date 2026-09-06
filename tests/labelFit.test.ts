import { describe, expect, it } from 'vitest'
import {
  ALL_LABEL_FORMATS,
  LABEL_SHEETS,
  estimateLabelFit,
  formatsThatFit,
  labelSheetById,
  buildLabelSheetHtml,
} from '../src/renderer/lib/labelSheets'
import libQuelle from '../src/renderer/lib/labelSheets.ts?raw'
import dialogQuelle from '../src/renderer/components/Inventory/InventoryDialog.tsx?raw'

// ---------------------------------------------------------------------------
// Passt der Klartext-Code drauf? (Bedarf 70, P2)
//
//   > manually cut parts of it so that it fits, sometimes trimming very close
//   > to the QR code                      (snipe-it#19541, 2026-08-24, offen)
//   > wants the code as text for „visual confirmation" and „manual entry"
//                                         (snipe-it#18280, 2025-12, offen)
//
// Zwei der drei Forderungen standen schon: der Code als Text unter der Grafik
// und mehr als drei Geometrien. Was fehlte, ist die unsichtbare Haelfte — der
// Klartext-Code nuetzt nur, wenn er draufpasst. `.lbl` schneidet mit
// `overflow: hidden` ab, und auf dem Bogen sieht das aus wie ein Etikett.
// ---------------------------------------------------------------------------

const label = (code: string, over: Record<string, unknown> = {}) => ({
  code,
  ...over,
})

describe('die drei Forderungen des Bedarfs', () => {
  it('druckt den Code als Text unter der Grafik', () => {
    const html = buildLabelSheetHtml(
      [{ qrDataUrl: '', code: 'AB-1234', title: 'Case 1' }],
      LABEL_SHEETS[0],
    )
    expect(html).toContain('AB-1234')
    expect(html).toMatch(/\.c \{[^}]*font-family: 'Courier New'/)
  })

  it('bietet mindestens drei Geometrien', () => {
    expect(ALL_LABEL_FORMATS.length).toBeGreaterThanOrEqual(3)
  })

  it('führt Bögen UND Endlos-Rollen', () => {
    expect(ALL_LABEL_FORMATS.some((s) => s.roll)).toBe(true)
    expect(ALL_LABEL_FORMATS.some((s) => !s.roll)).toBe(true)
  })
})

describe('estimateLabelFit', () => {
  it('nennt sich Schätzung und behauptet keine Messung', () => {
    // Gerechnet wird aus Schriftgroesse und Zeichenbreite, nicht aus einem
    // gerenderten Layout. Eine als Messung ausgegebene Schaetzung gaebe
    // gruenes Licht fuer einen Bogen, der dann doch abschneidet.
    expect(libQuelle).toMatch(/DAS IST EINE SCHAETZUNG, KEINE MESSUNG/)
    expect(dialogQuelle).toMatch(/labelFitBody/)
  })

  it('lässt einen kurzen Code auf das kleinste Format passen', () => {
    const klein = labelSheetById('zweckform-3667')!
    expect(estimateLabelFit(klein, [label('AB12')]).fits).toBe(true)
  })

  it('meldet einen sehr langen Code als nicht passend', () => {
    const klein = labelSheetById('zweckform-3667')!
    expect(estimateLabelFit(klein, [label('X'.repeat(400))]).fits).toBe(false)
  })

  it('nimmt den LÄNGSTEN Code, nicht den ersten', () => {
    const klein = labelSheetById('zweckform-3667')!
    const f = estimateLabelFit(klein, [label('AB'), label('X'.repeat(400))])
    expect(f.longestCode).toHaveLength(400)
    expect(f.fits).toBe(false)
  })

  it('rechnet mit weniger Platz, sobald Titel und Notiz dazukommen', () => {
    const bogen = labelSheetById('zweckform-3489')!
    const nackt = estimateLabelFit(bogen, [label('AB')])
    const voll = estimateLabelFit(bogen, [label('AB', { title: 'Case 1', note: 'Sub-Hire' })])
    expect(voll.linesForCode).toBeLessThan(nackt.linesForCode)
  })

  it('rechnet beim Barcode über die volle Breite statt neben der Grafik', () => {
    const bogen = labelSheetById('zweckform-3489')!
    const qr = estimateLabelFit(bogen, [label('AB')])
    const bc = estimateLabelFit(bogen, [label('AB', { symbology: 'barcode' })])
    expect(bc.charsPerLine).toBeGreaterThan(qr.charsPerLine)
  })

  it('zählt angebrochene Zeilen NICHT mit', () => {
    // Eine halb sichtbare Zeile ist kein lesbarer Code, sondern genau der Fall
    // aus dem Beleg. Erste Fassung prüfte nur, dass die Zeilenzahl eine ganze
    // Zahl ist — das ist beim Aufrunden genauso wahr und der Test wäre grün
    // geblieben. Geprüft wird deshalb der Wert selbst, an einem Format, dessen
    // Texthöhe kein ganzes Vielfaches der Zeilenhöhe ist.
    const klein = labelSheetById('zweckform-3667')!
    const f = estimateLabelFit(klein, [label('AB')])
    // 21,2 mm hoch minus 3 mm Rand ergibt 5 volle Zeilen à 8 pt · 1,15;
    // aufgerundet wären es 6, und dann stünde die sechste halb im Schnitt.
    expect(f.linesForCode).toBe(5)
    expect(f.charsPerLine).toBe(10)
    expect(f.codeCapacity).toBe(50)
    // Und die Grenze wirkt: 50 Zeichen passen, 51 nicht.
    expect(estimateLabelFit(klein, [label('X'.repeat(50))]).fits).toBe(true)
    expect(estimateLabelFit(klein, [label('X'.repeat(51))]).fits).toBe(false)
  })

  it('gibt bei leerer Liste keinen Code aus und meldet „passt"', () => {
    const f = estimateLabelFit(LABEL_SHEETS[0], [])
    expect(f.longestCode).toBe('')
    expect(f.fits).toBe(true)
  })

  it('bleibt mit der Geometrie des Bauers im Gleichschritt', () => {
    // Die Schaetzung rechnet dieselben Zahlen nach, die `buildLabelSheetHtml`
    // setzt. Stehen sie doppelt und laufen auseinander, prueft die Schaetzung
    // ein Layout, das es nicht gibt.
    expect(libQuelle).toMatch(
      /const qrMm = Math\.max\(8, Math\.min\(sheet\.labelHeightMm - 3, sheet\.labelWidthMm \* 0\.42\)\)[\s\S]*const qrMm = Math\.max\(8, Math\.min\(sheet\.labelHeightMm - 3, sheet\.labelWidthMm \* 0\.42\)\)/,
    )
  })
})

describe('formatsThatFit — eine Empfehlung, keine Automatik', () => {
  it('nennt die Formate, auf denen der Code vollständig steht', () => {
    const passend = formatsThatFit([label('AB-1234')])
    expect(passend.length).toBeGreaterThan(0)
    for (const s of passend) expect(estimateLabelFit(s, [label('AB-1234')]).fits).toBe(true)
  })

  it('gibt bei einem absurd langen Code eine leere Liste statt eines Vorschlags', () => {
    // Welches Etikett physisch auf die Kiste passt, weiss nur jemand, der die
    // Kiste sieht. Der Beleg beschreibt genau den umgekehrten Fehler.
    expect(formatsThatFit([label('X'.repeat(5000))])).toEqual([])
  })

  it('wählt NICHT selbst aus', () => {
    expect(libQuelle).not.toMatch(/setFormatId|autoSelect/)
  })
})

describe('die Oberfläche', () => {
  it('warnt VOR dem Druck, nicht danach', () => {
    expect(dialogQuelle).toMatch(/\{!fit\.fits && specsCount > 0 && \(/)
  })

  it('nennt die passenden Formate, wenn es welche gibt', () => {
    expect(dialogQuelle).toMatch(/passende\.length > 0/)
    expect(dialogQuelle).toMatch(/inventory\.labelFitNone/)
  })
})
