import { describe, expect, it } from 'vitest'
import { fuellgrad, fuellgradGrenze, huellkreis, kabelFlaeche, packeKreise } from '../src/renderer/lib/kreispackung'
import { kabelAussendurchmesserMm, trassenBuendel } from '../src/renderer/lib/buendel'
import type { Cable } from '../src/renderer/types/cable'

const ueberlapp = (p: ReturnType<typeof packeKreise>) => {
  for (let i = 0; i < p.kreise.length; i++)
    for (let j = i + 1; j < p.kreise.length; j++) {
      const a = p.kreise[i], b = p.kreise[j]
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r - 1e-6) return true
    }
  return false
}

describe('#1178 Kreispackung', () => {
  it('trifft die bekannten Optima fuer gleiche Kreise', () => {
    // Huellradius in Vielfachen des Kreisradius: 1, 2, 1+2/sqrt(3), 3 (6 und 7 Kreise), 5 (19)
    const fall: [number, number][] = [[1, 1], [2, 2], [3, 1 + 2 / Math.sqrt(3)], [6, 3], [7, 3], [19, 5]]
    for (const [n, r] of fall) {
      const p = packeKreise(Array(n).fill(2))
      expect(p.huelle.r).toBeCloseTo(r, 2)
      expect(ueberlapp(p)).toBe(false)
    }
  })

  it('bleibt bei gemischten Durchmessern ueberlappungsfrei und in der Huelle', () => {
    const d = [10, 7, 7, 5, 5, 5, 3, 3, 8, 6.5]
    const p = packeKreise(d)
    expect(p.kreise).toHaveLength(d.length)
    p.kreise.forEach((k, i) => expect(k.r).toBeCloseTo(d[i] / 2, 9))
    expect(ueberlapp(p)).toBe(false)
    for (const k of p.kreise) expect(Math.hypot(k.x, k.y) + k.r).toBeLessThanOrEqual(p.huelle.r + 1e-6)
    // nie kleiner als die Flaeche erlaubt
    expect(Math.PI * p.huelle.r ** 2).toBeGreaterThanOrEqual(kabelFlaeche(d))
  })

  it('leere Liste und Huellkreis-Randfaelle', () => {
    expect(packeKreise([]).huelle.r).toBe(0)
    expect(huellkreis([{ x: 0, y: 0, r: 1 }, { x: 4, y: 0, r: 1 }]).r).toBeCloseTo(3, 3)
  })

  it('Fuellgrad nach NEC Chapter 9 Table 1', () => {
    expect(fuellgradGrenze(1)).toBe(0.53)
    expect(fuellgradGrenze(2)).toBe(0.31)
    expect(fuellgradGrenze(3)).toBe(0.4)
    const g = fuellgrad([10, 10, 10], 25)!
    expect(g.anteil).toBeCloseTo(0.48, 2)
    expect(g.passt).toBe(false)
    expect(fuellgrad([10], 0)).toBeUndefined()
  })
})

const kabel = (id: string, extra: Partial<Cable>): Cable => ({
  id, name: id, type: 'BNC', color: '#fff', fromEquipmentId: 'a', fromPortId: 'p', toEquipmentId: 'b', toPortId: 'q', notes: '', ...extra,
})

describe('#1178 Trassenbuendel', () => {
  it('Durchmesser am Kabel schlaegt den Typ, eingebaute Gattungen haben keinen', () => {
    expect(kabelAussendurchmesserMm({ outerDiameterMm: 6.9, cableSpecId: 'sdi-12g' })).toBe(6.9)
    expect(kabelAussendurchmesserMm({ cableSpecId: 'x' }, [{ id: 'x', name: 'x', connectorType: 'BNC', standards: [], color: '#000', outerDiameterMm: 5 }])).toBe(5)
    expect(kabelAussendurchmesserMm({})).toBeUndefined()
  })

  it('gruppiert nach Trasse, zaehlt Multicores einmal, nennt Kabel ohne Durchmesser', () => {
    const b = trassenBuendel(
      [
        kabel('1', { pathway: 'K1', outerDiameterMm: 10 }),
        kabel('2', { pathway: 'K1', outerDiameterMm: 10 }),
        kabel('3', { pathway: 'K1', outerDiameterMm: 10 }),
        kabel('4', { pathway: 'K1' }),
        kabel('5', { pathway: 'K1', multicoreName: 'S', outerDiameterMm: 12 }),
        kabel('6', { pathway: 'K1', multicoreName: 'S', outerDiameterMm: 12 }),
        kabel('7', { pathway: 'K2', outerDiameterMm: 5 }),
        kabel('8', {}),
      ],
      { K1: 30 },
    )
    expect(b.map((x) => x.trasse)).toEqual(['K1', 'K2'])
    expect(b[0].kabel.map((c) => c.id)).toEqual(['1', '2', '3', '5'])
    expect(b[0].ohneDurchmesser.map((c) => c.id)).toEqual(['4'])
    expect(b[0].fuellgrad?.anteil).toBeCloseTo((3 * 100 + 144) / 900, 3)
    expect(b[1].fuellgrad).toBeUndefined()
  })
})

describe('#1178 Plan-Check Rohrfuellung', async () => {
  const { runDrawingChecks } = await import('../src/renderer/lib/drawingChecks')
  it('warnt erst, wenn ein Rohr eingetragen und der Grenzwert ueberschritten ist', () => {
    const cables = [1, 2, 3].map((i) => kabel(String(i), { pathway: 'K1', outerDiameterMm: 10, length: 5 }))
    const ohne = runDrawingChecks({ equipment: [], cables })
    expect(ohne.findings.some((f) => f.category === 'Duct fill')).toBe(false)
    const eng = runDrawingChecks({ equipment: [], cables, pathwayDuctMm: { K1: 25 } })
    expect(eng.findings.filter((f) => f.category === 'Duct fill')).toHaveLength(1)
    const weit = runDrawingChecks({ equipment: [], cables, pathwayDuctMm: { K1: 40 } })
    expect(weit.findings.some((f) => f.category === 'Duct fill')).toBe(false)
  })
})
