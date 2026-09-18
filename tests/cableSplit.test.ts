import { describe, expect, it } from 'vitest'
import { lengthsForType, splitRun, stockShortfall, type CableStockEntry } from '../src/renderer/lib/cableSplit'

// ───────────────────────────────────────────────────────────────────────────
// #875 — Kabelläufe auf Lagerlängen aufteilen.
//
// Die Reihenfolge der Kriterien IST die Entscheidung: erst wenige Kupplungen,
// dann wenig Überlänge. Jede Kupplung ist eine Steckverbindung, die sich lösen
// oder Pegel kosten kann; zehn Meter Überlänge kosten Aufrollen.
//
// Der zweite Punkt, den die Tests festhalten: die Rechnung ist EXAKT und nicht
// gierig. Gierig von der grössten Länge abwärts ist bei [100, 60] und 120 m
// falsch — es findet 100+60 statt 60+60.
// ───────────────────────────────────────────────────────────────────────────

const ok = (r: ReturnType<typeof splitRun>) => {
  expect(r.ok).toBe(true)
  if (!r.ok) throw new Error('erwartete eine Stückelung')
  return r.split
}

describe('Stückelung', () => {
  it('nimmt ein einziges Stück, wenn eines reicht', () => {
    const s = ok(splitRun(80, [100, 50, 25]))

    expect(s.pieces).toEqual([{ lengthM: 100, quantity: 1 }])
    expect(s.couplers).toBe(0)
    expect(s.excessM).toBe(20)
  })

  it('löst den Fall aus dem Nutzerwunsch: 450 ft aus 100ern', () => {
    // Der Wunsch aus EasySchematic#100, in Metern nachgestellt: 450 aus
    // [100, 50] wird vier 100er und ein 50er.
    const s = ok(splitRun(450, [100, 50]))

    expect(s.pieces).toEqual([
      { lengthM: 100, quantity: 4 },
      { lengthM: 50, quantity: 1 },
    ])
    expect(s.couplers).toBe(4)
    expect(s.excessM).toBe(0)
  })

  it('zählt Kupplungen als Stücke minus eins', () => {
    expect(ok(splitRun(100, [100])).couplers).toBe(0)
    expect(ok(splitRun(200, [100])).couplers).toBe(1)
    expect(ok(splitRun(300, [100])).couplers).toBe(2)
  })

  it('bevorzugt WENIGE KUPPLUNGEN vor wenig Überlänge', () => {
    // 137 aus [100, 50, 25]:
    //   100+50     = 150, eine Kupplung,  13 über
    //   100+25+25  = 150, ZWEI Kupplungen, 13 über
    // Gleiche Überlänge, also entscheidet die Kupplung.
    const s = ok(splitRun(137, [100, 50, 25]))

    expect(s.couplers).toBe(1)
    expect(s.totalM).toBe(150)
  })

  it('ist nicht gierig — 120 aus [100, 60] ergibt 60+60, nicht 100+60', () => {
    // Beide brauchen eine Kupplung. Gierig von oben nimmt die 100 und landet
    // bei 40 m Überlänge; richtig sind zwei 60er mit null Überlänge.
    const s = ok(splitRun(120, [100, 60]))

    expect(s.couplers).toBe(1)
    expect(s.excessM).toBe(0)
    expect(s.pieces).toEqual([{ lengthM: 60, quantity: 2 }])
  })

  it('minimiert bei gleicher Stückzahl die Überlänge', () => {
    // 90 aus [50, 100]: ein 100er (0 Kupplungen) schlaegt zwei 50er.
    expect(ok(splitRun(90, [50, 100])).pieces).toEqual([{ lengthM: 100, quantity: 1 }])

    // 90 aus [50, 60]: beides zwei Stuecke; 50+50 = 100 schlaegt 50+60 = 110.
    const s = ok(splitRun(90, [50, 60]))
    expect(s.totalM).toBe(100)
  })

  it('rechnet mit krummen Längen ohne Fliesskomma-Rest', () => {
    // 0.1 + 0.2 ist in Fliesskomma nicht 0.3. Gerechnet wird in Zentimetern.
    const s = ok(splitRun(0.3, [0.1, 0.2]))

    expect(s.totalM).toBeCloseTo(0.3, 10)
    expect(s.excessM).toBe(0)
  })

  it('trifft eine Länge exakt, ohne ein Stück zu viel', () => {
    const s = ok(splitRun(150, [100, 50]))

    expect(s.totalM).toBe(150)
    expect(s.excessM).toBe(0)
    expect(s.couplers).toBe(1)
  })

  it('gibt für einen Lauf ohne Länge nichts zurück', () => {
    const s = ok(splitRun(0, [100]))

    expect(s.pieces).toEqual([])
    expect(s.couplers).toBe(0)
  })

  it('meldet fehlende Längen statt eine zu erfinden', () => {
    const r = splitRun(100, [])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.failure.reason).toBe('no-stock')
  })

  it('ignoriert unbrauchbare Längen', () => {
    const s = ok(splitRun(100, [0, -50, Number.NaN, 100]))
    expect(s.pieces).toEqual([{ lengthM: 100, quantity: 1 }])
  })

  it('kommt mit doppelt eingetragenen Längen klar', () => {
    expect(ok(splitRun(200, [100, 100, 100])).pieces).toEqual([{ lengthM: 100, quantity: 2 }])
  })

  it('bleibt bei einem langen Lauf beherrschbar', () => {
    const s = ok(splitRun(400, [100, 50, 25, 10, 5]))

    expect(s.totalM).toBe(400)
    expect(s.couplers).toBe(3)
  })
})

describe('Bestandswarnung', () => {
  const bestand: CableStockEntry[] = [
    { type: 'SDI', lengthM: 100, count: 2 },
    { type: 'SDI', lengthM: 50, count: 5 },
  ]

  it('meldet, was fehlt', () => {
    const s = ok(splitRun(450, [100, 50]))
    const fehlt = stockShortfall(s, bestand)

    expect(fehlt).toEqual([{ lengthM: 100, needed: 4, available: 2 }])
  })

  it('schweigt, wenn der Bestand reicht', () => {
    expect(stockShortfall(ok(splitRun(150, [100, 50])), bestand)).toEqual([])
  })

  it('warnt NICHT über eine Länge, die niemand gezählt hat', () => {
    // Ein Eintrag ohne `count` sagt nichts über den Bestand aus. „0 vorhanden"
    // wäre eine Behauptung über etwas, das niemand nachgesehen hat.
    const ungezaehlt: CableStockEntry[] = [{ type: 'SDI', lengthM: 100 }]

    expect(stockShortfall(ok(splitRun(300, [100])), ungezaehlt)).toEqual([])
  })

  it('addiert mehrere Einträge derselben Länge', () => {
    const geteilt: CableStockEntry[] = [
      { type: 'SDI', lengthM: 100, count: 2 },
      { type: 'SDI', lengthM: 100, count: 3 },
    ]

    expect(stockShortfall(ok(splitRun(500, [100])), geteilt)).toEqual([])
  })
})

describe('Längen je Kabeltyp', () => {
  it('liefert nur die Längen des gefragten Typs', () => {
    const bestand: CableStockEntry[] = [
      { type: 'SDI', lengthM: 100 },
      { type: 'SDI', lengthM: 50 },
      { type: 'XLR', lengthM: 20 },
    ]

    expect(lengthsForType(bestand, 'SDI')).toEqual([100, 50])
    expect(lengthsForType(bestand, 'XLR')).toEqual([20])
    expect(lengthsForType(bestand, 'HDMI')).toEqual([])
  })
})
