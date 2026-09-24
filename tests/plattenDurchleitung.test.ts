// #913 — Wanddose, Wandfeld, Stagebox und Blende leiten ihrer Art nach durch.
import { describe, expect, it } from 'vitest'
import { isPatchPanelDevice } from '../src/renderer/lib/patchPanel'
import { signalChains } from '../src/renderer/lib/signalChain'
import { detectDeviceKind } from '../src/renderer/lib/deviceKind'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { FrontplattenArt } from '../src/renderer/types/frontplatte'

const port = (id: string, name: string) => ({ id, name, type: 'video', connectorType: 'BNC' }) as never

const geraet = (over: Partial<EquipmentItem> & { id: string; name: string }): EquipmentItem =>
  ({ category: 'Video', inputs: [], outputs: [], x: 0, y: 0, width: 100, height: 60, ...over }) as EquipmentItem

/** Eine Platte mit n Buchsen hinten (Eingaenge) und n vorn (Ausgaenge) — ohne Patchfeld-Kategorie. */
const platte = (id: string, art: FrontplattenArt, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  geraet({
    id,
    name: id,
    category: 'Wall plates',
    frontplatte: { art },
    inputs: Array.from({ length: 4 }, (_, i) => port(`${id}-in-${i + 1}`, `In ${i + 1}`)),
    outputs: Array.from({ length: 4 }, (_, i) => port(`${id}-out-${i + 1}`, `Out ${i + 1}`)),
    ...over,
  })

const kabel = (id: string, from: [string, string], to: [string, string], over: Partial<Cable> = {}): Cable =>
  ({
    id, name: id, type: 'SDI', length: 10, color: '#fff', cableNumber: id.toUpperCase(),
    fromEquipmentId: from[0], fromPortId: from[1], toEquipmentId: to[0], toPortId: to[1], notes: '', ...over,
  }) as Cable

const kamera = geraet({ id: 'cam', name: 'CAM 3', category: 'Cameras', outputs: [port('cam-out', 'SDI Out')] })
const regie = geraet({ id: 'atem', name: 'ATEM', inputs: [port('atem-in-1', 'In 1')] })

const plan = (halle: EquipmentItem, og3: EquipmentItem) => ({
  equipment: [kamera, halle, og3, regie],
  cables: [
    kabel('k1', ['cam', 'cam-out'], [halle.id, `${halle.id}-in-2`]),
    // Die Hausstrecke Halle → 3. OG, als feste Leitung.
    kabel('k2', [halle.id, `${halle.id}-out-2`], [og3.id, `${og3.id}-in-2`], { isTieLine: true }),
    kabel('k3', [og3.id, `${og3.id}-out-2`], ['atem', 'atem-in-1']),
  ],
})

describe('Frontplatten als Durchgang (#913)', () => {
  it('Kamera → Wandfeld Halle → Hausstrecke → Blende 3.OG → Regie ist EINE Kette', () => {
    const { equipment, cables } = plan(platte('halle', 'wandfeld'), platte('og3', 'blende'))
    const ketten = signalChains(equipment, cables)
    expect(ketten).toHaveLength(1)
    expect(ketten[0].steps.map((s) => s.cableId)).toEqual(['k1', 'k2', 'k3'])
    expect(ketten[0].levels).toBe(2)
    expect(ketten[0].end).toBe('ziel')
  })

  it('Stagebox leitet ebenso durch, "sonstige" nicht', () => {
    expect(isPatchPanelDevice(platte('sb', 'stagebox'))).toBe(true)
    expect(isPatchPanelDevice(platte('x', 'sonstige'))).toBe(false)
  })

  it('ein ausdrueckliches Nein an der Platte gilt', () => {
    const halle = platte('halle', 'wandfeld', { isPatchPanel: false })
    expect(isPatchPanelDevice(halle)).toBe(false)
    const { equipment, cables } = plan(halle, platte('og3', 'blende'))
    const ketten = signalChains(equipment, cables, { auchDirekte: true, vonEquipmentId: 'cam' })
    // Die Kette endet an der Halle — sie ist jetzt Ziel, kein Durchgang.
    expect(ketten.map((k) => k.steps.map((s) => s.cableId))).toEqual([['k1']])
  })

  it('eine Blende wird nicht als Kreuzschiene gefuehrt', () => {
    expect(detectDeviceKind(platte('b', 'blende'))).toBeNull()
  })

  it('ohne Frontplatte aendert sich nichts', () => {
    expect(isPatchPanelDevice(geraet({ id: 'g', name: 'g' }))).toBe(false)
  })
})
