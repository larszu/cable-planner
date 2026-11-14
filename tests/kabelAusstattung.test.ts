import { describe, expect, it } from 'vitest'
import { abschnittDash, abschnittLaenge, abschnittMeter, ausstattungsStueckliste } from '../src/renderer/lib/kabelAusstattung'

describe('#1180 Kabelausstattung', () => {
  it('Abschnitt: offen bis B, begrenzt auf das Kabel', () => {
    expect(abschnittMeter({ art: 'braid' }, 10)).toEqual({ vonM: 0, bisM: 10 })
    expect(abschnittMeter({ art: 'braid', vonM: 2, laengeM: 3 }, 10)).toEqual({ vonM: 2, bisM: 5 })
    expect(abschnittMeter({ art: 'braid', vonM: 8, laengeM: 5 }, 10)).toEqual({ vonM: 8, bisM: 10 })
    expect(abschnittMeter({ art: 'braid', vonM: 12 }, 10)).toEqual({ vonM: 10, bisM: 10 })
    expect(abschnittLaenge({ art: 'shrink', laengeM: 0.05 }, undefined)).toBe(0.05)
    expect(abschnittLaenge({ art: 'braid', vonM: 1 }, undefined)).toBeUndefined()
  })

  it('Stueckliste summiert je Art und Material, zaehlt Unbestimmbares getrennt', () => {
    const z = ausstattungsStueckliste([
      { length: 10, ausstattung: [{ art: 'braid', material: 'PET 10 mm' }, { art: 'shrink', laengeM: 0.05 }, { art: 'shrink', vonM: 9.95 }] },
      { length: 5, ausstattung: [{ art: 'braid', material: 'PET 10 mm', vonM: 1, laengeM: 2 }] },
      { ausstattung: [{ art: 'braid', material: 'PET 10 mm', vonM: 1 }] },
      {},
    ])
    expect(z.map((r) => r.art)).toEqual(['braid', 'shrink'])
    expect(z[0]).toMatchObject({ material: 'PET 10 mm', stueck: 3, laengeM: 12, ohneLaenge: 1 })
    expect(z[1]).toMatchObject({ stueck: 2, laengeM: 0.1, ohneLaenge: 0 })
  })

  it('Strichmuster zeigt genau den Abschnitt als Anteil des Pfads', () => {
    const d = abschnittDash({ art: 'conduit', vonM: 2, laengeM: 3 }, 10)
    expect(d.offset).toBeCloseTo(-0.2, 6)
    expect(Number(d.dasharray.split(' ')[0])).toBeCloseTo(0.3, 4)
    expect(abschnittDash({ art: 'conduit' }, undefined)).toEqual({ dasharray: '1 0', offset: 0 })
  })
})
