import { describe, expect, it } from 'vitest'
import { alleGrundrisse, etageAusKnotenId, grundrissKnotenId, grundrissVon, mitGrundriss } from '../src/renderer/lib/grundriss/etagenPlaene'
import { zuschnittAus, zuschnittGeometrie, zuschnittGueltig } from '../src/renderer/lib/grundriss/zuschnitt'
import type { Grundriss } from '../src/renderer/types/grundriss'

const g: Grundriss = { src: 'data:image/png;base64,', naturalWidth: 1000, naturalHeight: 500, x: 100, y: 50, width: 2000, height: 1000, deckkraft: 0.6 }

describe('Hallenplan je Etage (#984)', () => {
  it('legt Etagenplaene unter dem Etagenschluessel neben den allgemeinen', () => {
    let p = mitGrundriss({}, null, g)
    p = mitGrundriss(p, ' 1.OG ', { ...g, x: 0 })
    expect(grundrissVon(p, null)).toBe(g)
    expect(grundrissVon(p, '1.og')?.x).toBe(0)
    expect(alleGrundrisse(p).map((e) => e.etage)).toEqual([null, '1.og'])
    p = mitGrundriss(p, '1.OG', null)
    expect(p.etagenGrundrisse).toBeUndefined()
    expect(p.grundriss).toBe(g)
  })

  it('Knoten-IDs lassen sich umkehren', () => {
    expect(etageAusKnotenId(grundrissKnotenId(null))).toBeNull()
    expect(etageAusKnotenId(grundrissKnotenId('EG'))).toBe('eg')
    expect(etageAusKnotenId('geraet-1')).toBeUndefined()
  })
})

describe('Zuschnitt (#984)', () => {
  it('Rechteck aus zwei Punkten, auf das Bild begrenzt', () => {
    expect(zuschnittAus({ x: 0.8, y: 1.2 }, { x: 0.2, y: 0.5 })).toEqual({ x: 0.2, y: 0.5, w: 0.6000000000000001, h: 0.5 })
    expect(zuschnittGueltig({ x: 0, y: 0, w: 0.001, h: 0.5 }, g)).toBe(false)
  })

  it('der Ausschnitt bleibt auf dem Canvas, wo er war', () => {
    const { quelle, lage } = zuschnittGeometrie(g, { x: 0.5, y: 0.2, w: 0.25, h: 0.5 })
    expect(quelle).toEqual({ sx: 500, sy: 100, sw: 250, sh: 250 })
    expect(lage).toEqual({ x: 1100, y: 250, width: 500, height: 500 })
  })
})
