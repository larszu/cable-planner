import { describe, expect, it } from 'vitest'
import {
  emptyDrumKit,
  applyTechnique,
  deriveDrumChannels,
  DRUM_TECHNIQUES,
} from '../src/renderer/lib/drumMicing'
import { matchMicTemplate } from '../src/renderer/lib/micCatalog'

let n = 0
const id = () => `t-${n++}`

describe('drumMicing — Technik-Presets + Ableitungen', () => {
  it('emptyDrumKit hat Standard-Zonen, keine Mics', () => {
    const k = emptyDrumKit()
    expect(k.zones.length).toBeGreaterThan(6)
    expect(k.mics).toHaveLength(0)
    expect(k.zones.find((z) => z.id === 'kick')).toBeTruthy()
  })

  it('Glyn Johns belegt 4 Zonen inkl. Overhead-Stereo-Paar', () => {
    const mics = applyTechnique(emptyDrumKit(), 'glynJohns', id)
    expect(mics).toHaveLength(4)
    const oh = mics.filter((m) => m.stereoGroup)
    expect(oh).toHaveLength(2)
    expect(oh[0].stereoGroup).toBe(oh[1].stereoGroup) // gleiches L/R-Paar
  })

  it('Phantom-Bedarf kommt aus echten Katalog-Daten, nicht geraten', () => {
    const kit = emptyDrumKit()
    // Kondensator KM 184 auf OH (braucht 48V), Dynamiker SM57 auf Snare (nicht).
    const km184 = matchMicTemplate('Neumann KM 184')!
    const sm57 = matchMicTemplate('Shure SM57')!
    kit.mics = [
      { id: 'a', zoneId: 'ohL', micDeviceTypeId: km184.deviceTypeId, stereoGroup: 'ohL-ohR' },
      { id: 'b', zoneId: 'snareTop', micDeviceTypeId: sm57.deviceTypeId },
    ]
    const d = deriveDrumChannels(kit)
    expect(d.channelCount).toBe(2)
    expect(d.phantomCount).toBe(1) // nur das KM 184
    expect(d.unknownCount).toBe(0)
    expect(d.stereoGroups).toContain('ohL-ohR')
  })

  it('Placement ohne zugeordnetes Mic zählt als unbekannt (kein Raten)', () => {
    const kit = emptyDrumKit()
    kit.mics = [{ id: 'x', zoneId: 'kick' }]
    const d = deriveDrumChannels(kit)
    expect(d.unknownCount).toBe(1)
    expect(d.phantomCount).toBe(0)
    expect(d.channels[0].micUnknown).toBe(true)
  })

  it('applyTechnique bewahrt bereits zugeordnete Mics bei erneuter Belegung', () => {
    const km184 = matchMicTemplate('Neumann KM 184')!
    const kit = emptyDrumKit()
    kit.mics = [{ id: 'keep', zoneId: 'ohL', micDeviceTypeId: km184.deviceTypeId }]
    const mics = applyTechnique(kit, 'glynJohns', id)
    const ohL = mics.find((m) => m.zoneId === 'ohL')
    expect(ohL?.micDeviceTypeId).toBe(km184.deviceTypeId) // Zuordnung erhalten
  })

  it('alle Presets referenzieren nur existierende Zonen', () => {
    const kit = emptyDrumKit()
    const zoneIds = new Set(kit.zones.map((z) => z.id))
    for (const def of Object.values(DRUM_TECHNIQUES)) {
      for (const zid of def.zoneIds) expect(zoneIds.has(zid), zid).toBe(true)
    }
  })
})
