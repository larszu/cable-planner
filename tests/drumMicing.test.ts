import { describe, expect, it } from 'vitest'
import {
  emptyDrumKit,
  applyTechnique,
  deriveDrumChannels,
  DRUM_TECHNIQUES,
} from '../src/renderer/lib/drumMicing'
import { matchMicTemplate } from '../src/renderer/lib/micCatalog'
import drumDialogQuelle from '../src/renderer/components/DrumMicing/DrumMicingDialog.tsx?raw'

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
    // BEDARF 96: `applyTechnique` gibt seit 2026-09-06 einen BERICHT zurueck
    // und nicht mehr nur die Liste — ein Preset, das still ueberschreibt, ist
    // genau der Fehler, den der Bedarf benennt.
    const { placements: mics } = applyTechnique(emptyDrumKit(), 'glynJohns', id)
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
    const { placements: mics } = applyTechnique(kit, 'glynJohns', id)
    const ohL = mics.find((m) => m.zoneId === 'ohL')
    expect(ohL?.micDeviceTypeId).toBe(km184.deviceTypeId) // Zuordnung erhalten
  })

  it('warnt bei grenzwertigem Max SPL an lauter Zone — nur mit bekanntem Wert', () => {
    // Kondensator KM 184 (138 dB) an der Snare → grenzwertig (<140).
    const km184 = matchMicTemplate('Neumann KM 184')!
    const beta52 = matchMicTemplate('Shure Beta 52A')! // 174 dB an Kick → ok
    const kit = emptyDrumKit()
    kit.mics = [
      { id: 'a', zoneId: 'snareTop', micDeviceTypeId: km184.deviceTypeId },
      { id: 'b', zoneId: 'kick', micDeviceTypeId: beta52.deviceTypeId },
    ]
    const d = deriveDrumChannels(kit)
    expect(d.splRiskCount).toBe(1)
    expect(d.channels.find((c) => c.label.includes('SN'))?.splRisk).toBe(true)
    // Mic ohne bekannten Max SPL → kein Risiko-Flag (kein Raten).
    const sm7b = matchMicTemplate('Shure SM7B')! // maxSpl nicht gesetzt
    kit.mics = [{ id: 'c', zoneId: 'snareTop', micDeviceTypeId: sm7b.deviceTypeId }]
    expect(deriveDrumChannels(kit).splRiskCount).toBe(0)
  })

  it('alle Presets referenzieren nur existierende Zonen', () => {
    const kit = emptyDrumKit()
    const zoneIds = new Set(kit.zones.map((z) => z.id))
    for (const def of Object.values(DRUM_TECHNIQUES)) {
      for (const zid of def.zoneIds) expect(zoneIds.has(zid), zid).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Bedarf 96 — ein Preset darf nie still ueberschreiben.
//
//   > Applying a preset must never silently replace an existing grid; presets
//   > must append or prompt AND SHOW THE RESULTING ROW COUNT.
//   > A wrong preset is worse than no preset.
//
// Beleg: Cryde/musicall#798, geschrieben nach einem Datenverlust-Fehler.
//
// Genau das passierte hier: `applyTechnique` gab NUR die Zonen der gewaehlten
// Technik zurueck. Wer auf drei Toms Mikrofone gesetzt hatte und dann auf eine
// kleinere Technik wechselte, verlor sie — wortlos.
// ---------------------------------------------------------------------------

describe('Bedarf 96 — das Preset sagt, was es kostet', () => {
  const km184 = matchMicTemplate('Neumann KM 184')!

  it('meldet ein gesetztes Mikrofon, das die neue Technik nicht kennt', () => {
    const kit = emptyDrumKit()
    kit.mics = [{ id: 'tom', zoneId: 'tom1', micDeviceTypeId: km184.deviceTypeId }]
    const { placements, dropped } = applyTechnique(kit, 'minimal', id)
    expect(placements.some((m) => m.zoneId === 'tom1')).toBe(false)
    expect(dropped).toHaveLength(1)
    expect(dropped[0].zoneLabel).toBe('Tom 1')
  })

  it('nennt den Namen, nicht nur die Zone — sonst weiss niemand, was faellt', () => {
    const kit = emptyDrumKit()
    kit.mics = [{ id: 'tom', zoneId: 'tom1', micName: 'Sennheiser MD 421' }]
    expect(applyTechnique(kit, 'minimal', id).dropped[0].what).toBe('Sennheiser MD 421')
  })

  it('meldet auch eine EIGENE Kanal-Beschriftung als Verlust', () => {
    const kit = emptyDrumKit()
    kit.mics = [{ id: 'tom', zoneId: 'tom1', channelLabel: 'Tom Floor Sub' }]
    expect(applyTechnique(kit, 'minimal', id).dropped).toHaveLength(1)
  })

  it('meldet eine LEERE Platzierung NICHT', () => {
    // Eine Rueckfrage bei jedem Wechsel klickt man beim vierten Mal weg.
    const kit = emptyDrumKit()
    kit.mics = [{ id: 'tom', zoneId: 'tom1' }]
    expect(applyTechnique(kit, 'minimal', id).dropped).toHaveLength(0)
  })

  it('meldet eine ABGELEITETE Kanal-Beschriftung NICHT als Eingabe', () => {
    // Sie stammt von der Zone, nicht von einem Menschen. Der voranstehende
    // Technik-Wechsel hat sie selbst gesetzt.
    const kit = emptyDrumKit()
    const erst = applyTechnique(kit, 'glynJohns', id)
    const zwischen = { ...kit, mics: erst.placements }
    expect(applyTechnique(zwischen, 'minimal', id).dropped).toHaveLength(0)
  })

  it('meldet nichts, wenn die neue Technik alles behaelt', () => {
    const kit = emptyDrumKit()
    kit.mics = [{ id: 'k', zoneId: 'kick', micDeviceTypeId: km184.deviceTypeId }]
    expect(applyTechnique(kit, 'minimal', id).dropped).toHaveLength(0)
  })

  it('behaelt die Zuordnung auf Zonen, die beide Techniken kennen', () => {
    const kit = emptyDrumKit()
    kit.mics = [
      { id: 'k', zoneId: 'kick', micDeviceTypeId: km184.deviceTypeId },
      { id: 't', zoneId: 'tom1', micDeviceTypeId: km184.deviceTypeId },
    ]
    const { placements, dropped } = applyTechnique(kit, 'minimal', id)
    expect(placements.find((m) => m.zoneId === 'kick')?.micDeviceTypeId).toBe(km184.deviceTypeId)
    expect(dropped.map((d) => d.zoneLabel)).toEqual(['Tom 1'])
  })
})

describe('Bedarf 96 — die Oberflaeche fragt, bevor sie verwirft', () => {
  it('der Dialog ruft confirmDialog und wendet bei Abbruch nichts an', () => {
    expect(drumDialogQuelle).toMatch(/if \(dropped\.length\) \{/)
    expect(drumDialogQuelle).toMatch(/await confirmDialog\(/)
    expect(drumDialogQuelle).toMatch(/if \(!ok\) return/)
  })

  it('die Rueckfrage nennt die Zahl DANACH', () => {
    // „show the resulting row count" steht woertlich im Bedarf.
    expect(drumDialogQuelle).toContain('rows: String(placements.length)')
  })

  it('sie ist als zerstoerend markiert', () => {
    expect(drumDialogQuelle).toContain('destructive: true')
  })
})
