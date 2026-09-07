import { describe, expect, it } from 'vitest'
import {
  expenseFromProposal,
  parseBetrag,
  readReceipt,
  type ReceiptProposal,
} from '../src/renderer/lib/receiptRead'

const befunde = (p: ReceiptProposal) => p.findings.map((f) => f.kind)

describe('Zahlen von einem Beleg', () => {
  it('liest deutsche und englische Schreibweise auf denselben Betrag', () => {
    expect(parseBetrag('1.234,56')).toBe(1234.56)
    expect(parseBetrag('1,234.56')).toBe(1234.56)
  })

  it('nimmt einen einzelnen Punkt vor drei Stellen als Tausendertrenner', () => {
    // 1.234 ist auf einem deutschen Beleg tausendzweihundertvierunddreissig
    // und nicht ein Euro dreiundzwanzig.
    expect(parseBetrag('1.234')).toBe(1234)
    expect(parseBetrag('1,234')).toBe(1234)
  })

  it('nimmt einen einzelnen Trenner vor zwei Stellen als Komma', () => {
    expect(parseBetrag('12,50')).toBe(12.5)
    expect(parseBetrag('12.50')).toBe(12.5)
    expect(parseBetrag('12.5')).toBe(12.5)
  })

  it('gibt bei Unlesbarem nichts zurück statt einer Null', () => {
    expect(parseBetrag('keine Zahl')).toBeUndefined()
    expect(parseBetrag('')).toBeUndefined()
  })
})

const bon = [
  'Bäckerei Sonnenblume',
  'Hauptstr. 12, 34117 Kassel',
  '03.02.2026 08:14',
  'Brötchen 6 x 0,55        3,30',
  'Kaffee                   2,90',
  'Zwischensumme            6,20',
  'Rabatt                  -0,20',
  'SUMME EUR                6,00',
  'MwSt 7,00%               0,39',
  'Gegeben BAR             10,00',
  'Rückgeld                 4,00',
].join('\n')

describe('ein Kassenbon wird zu einem Vorschlag', () => {
  const p = readReceipt({ text: bon, fileName: 'IMG_2231.jpg' })

  it('nimmt die Endsumme und nicht die Zwischensumme', () => {
    // Ohne die Ausschlussliste stünden 6,20 und 6,00 gleichberechtigt da und
    // es käme gar kein Betrag heraus.
    expect(p.amount?.value).toBe(6)
    expect(p.amount?.source).toBe('text')
  })

  it('nimmt niemals Gegeben oder Rückgeld als Rechnungsbetrag', () => {
    expect(p.amount?.value).not.toBe(10)
    expect(p.amount?.value).not.toBe(4)
  })

  it('liest das Datum und verwechselt es nicht mit einem Betrag', () => {
    expect(p.date?.value).toBe('2026-02-03')
    expect(p.amountCandidates.map((c) => c.value)).not.toContain(3.02)
  })

  it('liest Währung und Steuersatz', () => {
    expect(p.currency?.value).toBe('EUR')
    expect(p.vatPercent?.value).toBe(7)
  })

  it('nimmt die Kopfzeile als Aussteller, nicht die Anschrift', () => {
    expect(p.merchant?.value).toBe('Bäckerei Sonnenblume')
  })

  it('schlägt die Art aus dem Wortlaut vor', () => {
    expect(p.kind?.value).toBe('per-diem')
  })

  it('nennt jeden gelesenen Wert mit seiner Fundstelle', () => {
    expect(p.amount?.evidence).toContain('SUMME')
    expect(p.date?.evidence).toContain('03.02.2026')
  })
})

describe('ein Bon ohne Summenzeile', () => {
  const taxi = ['Taxi Hamburg', '03.02.2026', 'Fahrpreis 24,50', 'Gegeben 30,00', 'Rückgeld 5,50'].join(
    '\n',
  )

  it('nimmt den einen Betrag, der übrig bleibt', () => {
    // Genau hier verdient die Ausschlussliste ihr Dasein: ohne sie stünden
    // drei Beträge da und der Vorschlag hätte keinen.
    const p = readReceipt({ text: taxi })
    expect(p.amount?.value).toBe(24.5)
    expect(p.kind?.value).toBe('travel')
  })

  it('trägt eine abgetippte Zeile vom Handy genauso', () => {
    const p = readReceipt({ text: 'Taxi Flughafen 24,50 EUR', fileDate: '2026-02-03T19:02:00Z' })
    expect(p.amount?.value).toBe(24.5)
    expect(p.currency?.value).toBe('EUR')
  })
})

describe('was nicht entschieden werden kann, wird nicht entschieden', () => {
  it('nimmt bei zwei verschiedenen Summen keine und nennt beide', () => {
    const p = readReceipt({
      text: ['Gesamtbetrag 100,00', 'Summe 120,00'].join('\n'),
    })
    expect(p.amount).toBeUndefined()
    expect(befunde(p)).toContain('several-totals')
    expect(p.amountCandidates.map((c) => c.value).sort()).toEqual([100, 120])
  })

  it('meldet einen fehlenden Betrag, statt eine Null einzutragen', () => {
    const p = readReceipt({ text: 'Parkschein Innenstadt\n03.02.2026' })
    expect(p.amount).toBeUndefined()
    expect(befunde(p)).toContain('no-amount')
  })

  it('gibt bei einem Beleg ohne alles einen einzigen Befund zurück', () => {
    const p = readReceipt({ text: '   \n  ' })
    expect(befunde(p)).toEqual(['nothing-readable'])
  })
})

describe('woher das Datum kommt, steht dabei', () => {
  it('nimmt den Aufnahmezeitpunkt aus den Bilddaten, wenn der Text keinen trägt', () => {
    const p = readReceipt({ text: 'Parkhaus Nord\nSumme 4,50', takenAt: '2026-02-03T14:22:10' })
    expect(p.date?.value).toBe('2026-02-03')
    expect(p.date?.source).toBe('exif')
  })

  it('nimmt das Dateidatum nur als letzten Ausweg — und sagt es', () => {
    const p = readReceipt({ text: 'Parkhaus Nord\nSumme 4,50', fileDate: '2026-02-05T09:00:00Z' })
    expect(p.date?.source).toBe('file-date')
    expect(befunde(p)).toContain('date-from-file')
  })

  it('zieht ein beschriftetes Datum jedem anderen vor', () => {
    const p = readReceipt({
      text: ['Hotel Adler', 'Anreise 01.02.2026', 'Rechnungsdatum: 03.02.2026', 'Summe 149,00'].join(
        '\n',
      ),
    })
    expect(p.date?.value).toBe('2026-02-03')
    expect(p.kind?.value).toBe('accommodation')
  })

  it('folgt bei Punkt und Schrägstrich der Regel aus dateStyle', () => {
    expect(readReceipt({ text: 'Beleg\n03.02.2026\nSumme 9,00' }).date?.value).toBe('2026-02-03')
    expect(readReceipt({ text: 'Beleg\n03/02/2026\nSumme 9,00' }).date?.value).toBe('2026-03-02')
  })

  it('meldet mehrere Daten, wenn keins beschriftet ist', () => {
    const p = readReceipt({ text: ['Beleg', '01.02.2026', '03.02.2026', 'Summe 9,00'].join('\n') })
    expect(befunde(p)).toContain('several-dates')
    expect(p.date?.value).toBe('2026-02-01')
  })
})

describe('aus dem Vorschlag wird erst dann eine Zeile, wenn sie eine sein kann', () => {
  it('verweigert die Zeile ohne Betrag und nennt, was fehlt', () => {
    const p = readReceipt({ text: 'Parkschein\n03.02.2026' })
    const r = expenseFromProposal(p)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.missing).toEqual(['amount'])
  })

  it('legt die Zeile mit Betrag, Datum und Art an', () => {
    const r = expenseFromProposal(readReceipt({ text: bon }), { personId: 'p1' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.expense.amount).toBe(6)
      expect(r.expense.date).toBe('2026-02-03')
      expect(r.expense.kind).toBe('per-diem')
      expect(r.expense.personId).toBe('p1')
      // Nicht abrechenbar, solange niemand es gesagt hat.
      expect(r.expense.billable).toBe(false)
    }
  })

  it('trägt den Aussteller in die Notiz, statt ihn zu verlieren', () => {
    const r = expenseFromProposal(readReceipt({ text: bon }))
    if (r.ok) expect(r.expense.note).toContain('Bäckerei Sonnenblume')
  })
})
