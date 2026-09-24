// #916 — die 3D-Szene des Gebaeudes, ohne WebGL gerechnet.
import { describe, expect, it } from 'vitest'
import { etagenHoehen, gebaeudeSzene } from '../src/renderer/lib/gebaeudeSzene'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { LocationFrame } from '../src/renderer/types/location'

const geraet = (id: string, x: number, y: number, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({ id, name: id, category: 'Video', inputs: [], outputs: [], x, y, width: 100, height: 100, ...over }) as EquipmentItem
const rahmen = (id: string, x: number, floor?: string): LocationFrame => ({
  id, name: id, x, y: 0, width: 400, height: 400, color: '#38bdf8', ...(floor ? { floor } : {}),
})
const kabel = (id: string, von: string, nach: string, over: Partial<Cable> = {}): Cable =>
  ({ id, name: id, type: 'SDI', length: 5, color: '#f00', notes: '', fromEquipmentId: von, fromPortId: 'p', toEquipmentId: nach, toPortId: 'q', ...over }) as Cable

describe('etagenHoehen', () => {
  it('eine angegebene Hoehe gilt, fehlende werden gestapelt und so markiert', () => {
    expect(etagenHoehen([{ name: 'UG', elevationM: -4 }, { name: 'EG' }, { name: '1.OG' }, { name: '3.OG', elevationM: 12 }], 4)).toEqual([
      { name: 'UG', y: -4, hoeheAngenommen: false },
      { name: 'EG', y: 0, hoeheAngenommen: true },
      { name: '1.OG', y: 4, hoeheAngenommen: true },
      { name: '3.OG', y: 12, hoeheAngenommen: false },
    ])
  })
  it('unter der ersten angegebenen Etage wird nach UNTEN gestapelt', () => {
    expect(etagenHoehen([{ name: 'UG' }, { name: 'EG' }, { name: '1.OG', elevationM: 3.5 }], 4).map((e) => e.y)).toEqual([-4.5, -0.5, 3.5])
    expect(etagenHoehen([{ name: 'KG' }, { name: 'EG', elevationM: 0 }], 3).map((e) => e.y)).toEqual([-3, 0])
  })

  it('ohne jede Angabe vom Boden aus', () => {
    expect(etagenHoehen([{ name: 'EG' }, { name: '1.OG' }], 3.5).map((e) => e.y)).toEqual([0, 3.5])
  })
})

describe('gebaeudeSzene', () => {
  const daten = {
    equipment: [
      geraet('kam', 50, 50, { optik: { hoeheM: 1.6 } }),
      geraet('hub', 550, 50),
      geraet('lose', 2000, 2000),
    ],
    cables: [kabel('k1', 'kam', 'hub', { isTieLine: true }), kabel('k2', 'hub', 'lose'), kabel('k3', 'kam', 'hub')],
    locations: [rahmen('halle', 0, 'EG'), rahmen('regie', 500, '3.OG')],
    floors: [{ name: 'EG', elevationM: 0 }, { name: '3.OG', elevationM: 12 }],
  }
  const opt = { metersPer100px: 1, geschosshoeheM: 4 }

  it('stellt Raeume auf ihre Etage, im Massstab der Laengen-Schaetzung', () => {
    const s = gebaeudeSzene(daten, opt)
    const regie = s.raeume.find((r) => r.id === 'regie')!
    expect(regie).toMatchObject({ x: 5, y: 12, z: 0, breite: 4, tiefe: 4, etage: '3.OG' })
  })

  it('Geraete stehen im Raum; eine Kamera mit bekannter Hoehe auf ihr', () => {
    const s = gebaeudeSzene(daten, opt)
    expect(s.geraete.find((g) => g.id === 'kam')!.pos).toEqual({ x: 1, y: 1.6, z: 1 })
    expect(s.geraete.find((g) => g.id === 'hub')!.pos.y).toBeCloseTo(12.8)
    expect(s.geraete.find((g) => g.id === 'lose')!.raumId).toBeUndefined()
  })

  it('Kabel zwischen Raeumen werden zu EINER Raumverbindung zusammengefasst', () => {
    const s = gebaeudeSzene(daten, opt)
    expect(s.kabel.find((k) => k.id === 'k1')).toMatchObject({ raumuebergreifend: true, tieLine: true })
    expect(s.kabel.find((k) => k.id === 'k2')!.raumuebergreifend).toBe(false)
    expect(s.verbindungen).toHaveLength(1)
    expect(s.verbindungen[0].kabelIds.sort()).toEqual(['k1', 'k3'])
  })

  it('verborgene Raeume fehlen samt Geraeten und Kabeln', () => {
    const s = gebaeudeSzene(daten, { ...opt, verborgeneRahmen: new Set(['regie']) })
    expect(s.raeume.map((r) => r.id)).toEqual(['halle'])
    expect(s.geraete.map((g) => g.id).sort()).toEqual(['kam', 'lose'])
    expect(s.kabel).toEqual([])
    expect(s.verbindungen).toEqual([])
  })

  it('ausgeblendete Kabel-Ebenen fehlen', () => {
    const s = gebaeudeSzene(daten, { ...opt, kabelSichtbar: (c) => c.id !== 'k3' })
    expect(s.verbindungen[0].kabelIds).toEqual(['k1'])
  })

  it('eine leere Szene hat trotzdem eine Kamera-Ausdehnung', () => {
    const s = gebaeudeSzene({ equipment: [], cables: [], locations: [], floors: [] }, opt)
    expect(s.groesse).toBeGreaterThan(0)
  })
})
