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

// Kabel zwischen Etagen liefen als Luftlinie quer durch das Haus. Ein Rahmen
// kann jetzt Steigschacht sein; dann laeuft der Weg hoch zur Trasse, zum
// Schacht, senkrecht, und auf der anderen Etage zum Ziel.
describe('Steigschacht', () => {
  const mitSchacht = {
    equipment: [geraet('kam', 50, 50), geraet('hub', 550, 50)],
    cables: [kabel('k1', 'kam', 'hub')],
    locations: [
      rahmen('halle', 0, 'EG'),
      rahmen('regie', 500, '3.OG'),
      { id: 'schacht', name: 'S1', x: 1000, y: 0, width: 100, height: 100, color: '#999', floor: 'EG', steigschacht: true },
      { id: 'schacht2', name: 'S2', x: 5000, y: 0, width: 100, height: 100, color: '#999', floor: 'EG', steigschacht: true },
    ] as LocationFrame[],
    floors: [{ name: 'EG', elevationM: 0 }, { name: '3.OG', elevationM: 12 }],
  }
  const opt = { metersPer100px: 1, geschosshoeheM: 4 }

  it('zeichnet den Schacht durch alle Etagen und nicht als Raum', () => {
    const s = gebaeudeSzene(mitSchacht, opt)
    expect(s.raeume.map((r) => r.id)).toEqual(['halle', 'regie'])
    expect(s.schaechte.find((x) => x.id === 'schacht')).toMatchObject({ x: 10.5, z: 0.5, yUnten: 0, yOben: 15 })
  })

  it('fuehrt ein Kabel zwischen Etagen ueber den naechsten Schacht', () => {
    const k = gebaeudeSzene(mitSchacht, opt).kabel[0]
    expect(k.schachtId).toBe('schacht')
    expect(k.etagenwechsel).toBe(true)
    expect(k.punkte.map((p) => [p.x, p.y, p.z].map((w) => Math.round(w * 100) / 100))).toEqual([
      [1, 0.8, 1],
      [1, 2.85, 1],
      [10.5, 2.85, 0.5],
      [10.5, 14.85, 0.5],
      [6, 14.85, 1],
      [6, 12.8, 1],
    ])
  })

  it('fuehrt auch die Raumverbindung ueber den Schacht', () => {
    const v = gebaeudeSzene(mitSchacht, opt).verbindungen[0]
    expect(v.punkte).toHaveLength(4)
    expect(v.punkte[1]).toMatchObject({ x: 10.5, z: 0.5 })
  })

  it('bleibt ohne Schacht und auf derselben Etage die Luftlinie', () => {
    const ohne = { ...mitSchacht, locations: mitSchacht.locations.filter((l) => !l.steigschacht) }
    const k = gebaeudeSzene(ohne, opt).kabel[0]
    expect(k.punkte).toHaveLength(2)
    expect(k.schachtId).toBeUndefined()
    const gleicheEtage = { ...mitSchacht, locations: mitSchacht.locations.map((l) => (l.id === 'regie' ? { ...l, floor: 'EG' } : l)) }
    expect(gebaeudeSzene(gleicheEtage, opt).kabel[0].punkte).toHaveLength(2)
  })

  it('laesst einen ausgeblendeten Schacht aus', () => {
    const s = gebaeudeSzene(mitSchacht, { ...opt, verborgeneRahmen: new Set(['schacht']) })
    expect(s.kabel[0].schachtId).toBe('schacht2')
  })
})
