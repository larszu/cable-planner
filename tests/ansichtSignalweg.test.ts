// #914 Signalweg hervorheben, #915 Raeume/Etagen ausblenden — reine Ansicht.
import { describe, expect, it } from 'vitest'
import { ansicht } from '../src/renderer/lib/ansicht'
import { signalwegFuerKabel } from '../src/renderer/lib/signalweg'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { LocationFrame } from '../src/renderer/types/location'

const port = (id: string) => ({ id, name: id, type: 'video', connectorType: 'BNC' }) as never
const geraet = (id: string, x: number, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({ id, name: id, category: 'Video', inputs: [], outputs: [], x, y: 50, width: 100, height: 60, ...over }) as EquipmentItem
const kabel = (id: string, von: [string, string], nach: [string, string]): Cable =>
  ({ id, name: id, type: 'SDI', length: 5, color: '#fff', notes: '', fromEquipmentId: von[0], fromPortId: von[1], toEquipmentId: nach[0], toPortId: nach[1] }) as Cable
const rahmen = (id: string, x: number, floor?: string): LocationFrame => ({
  id, name: id, x, y: 0, width: 300, height: 300, color: '#fff', ...(floor ? { floor } : {}),
})

// Kamera (Halle) → Blende (Halle) → Hausstrecke → Blende (3.OG) → Mischer (3.OG); Monitor abseits.
const kam = geraet('kam', 0, { outputs: [port('kam-o')] })
const blendeHalle = geraet('bh', 150, {
  frontplatte: { art: 'blende' },
  inputs: [port('bh-i1')],
  outputs: [port('bh-o1')],
})
const blendeOg = geraet('bo', 400, { frontplatte: { art: 'blende' }, inputs: [port('bo-i1')], outputs: [port('bo-o1')] })
const mischer = geraet('mix', 550, { inputs: [port('mix-i1'), port('mix-i2')] })
const monitor = geraet('mon', 2000, { inputs: [port('mon-i')] })
const zuspieler = geraet('zsp', 2200, { outputs: [port('zsp-o')] })
const equipment = [kam, blendeHalle, blendeOg, mischer, monitor, zuspieler]
const cables = [
  kabel('k1', ['kam', 'kam-o'], ['bh', 'bh-i1']),
  kabel('k2', ['bh', 'bh-o1'], ['bo', 'bo-i1']),
  kabel('k3', ['bo', 'bo-o1'], ['mix', 'mix-i1']),
  kabel('k9', ['zsp', 'zsp-o'], ['mon', 'mon-i']),
]
const locations = [rahmen('halle', 0, 'EG'), rahmen('regie', 350, '3.OG')]

describe('signalwegFuerKabel (#914)', () => {
  it('sammelt die ganze Kette, egal welches Kabel man anklickt', () => {
    for (const id of ['k1', 'k2', 'k3']) {
      const weg = signalwegFuerKabel(equipment, cables, id)!
      expect(weg.kabelIds.sort()).toEqual(['k1', 'k2', 'k3'])
      expect(weg.geraetIds.sort()).toEqual(['bh', 'bo', 'kam', 'mix'])
    }
  })
  it('ein unbekanntes Kabel hat keinen Weg', () => {
    expect(signalwegFuerKabel(equipment, cables, 'gibtsnicht')).toBeNull()
  })
})

describe('ansicht (#914/#915)', () => {
  const leer = { ausgeblendeteRaeume: [], ausgeblendeteEtagen: [], signalweg: null }

  it('ohne Filter ist nichts verborgen oder gedimmt', () => {
    const a = ansicht(equipment, cables, locations, leer)
    expect(a.verborgeneGeraete.size + a.verborgeneKabel.size + a.stummel.size + a.gedimmteKabel.size).toBe(0)
  })

  it('Signalweg dimmt alles andere', () => {
    const weg = signalwegFuerKabel(equipment, cables, 'k2')!
    const a = ansicht(equipment, cables, locations, { ...leer, signalweg: weg })
    expect([...a.gedimmteKabel]).toEqual(['k9'])
    expect([...a.gedimmteGeraete].sort()).toEqual(['mon', 'zsp'])
  })

  it('eine ausgeblendete Etage nimmt Raum und Geraete mit; das Kabel hinueber wird ein Stummel', () => {
    const a = ansicht(equipment, cables, locations, { ...leer, ausgeblendeteEtagen: ['3.og'] })
    expect([...a.verborgeneRahmen]).toEqual(['regie'])
    expect([...a.verborgeneGeraete].sort()).toEqual(['bo', 'mix'])
    // k2 laeuft von der Halle (sichtbar) in die Regie (verborgen).
    expect(a.stummel.get('k2')).toBe('from')
    // k3 liegt ganz in der Regie.
    expect(a.verborgeneKabel.has('k3')).toBe(true)
    // Ein Geraet ohne Rahmen verschwindet nie.
    expect(a.verborgeneGeraete.has('mon')).toBe(false)
  })

  it('ein einzelner Raum laesst sich ausblenden', () => {
    const a = ansicht(equipment, cables, locations, { ...leer, ausgeblendeteRaeume: ['halle'] })
    expect(a.stummel.get('k2')).toBe('to')
    expect(a.verborgeneKabel.has('k1')).toBe(true)
  })
})
