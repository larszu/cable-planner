import { describe, expect, it } from 'vitest'
import { st2110_20Mbps, st2110_21Passt } from '../src/renderer/lib/st2110'
import { bandwidthMbpsForStandard, kabelLastMbps } from '../src/renderer/types/cableSpec'
import { runDrawingChecks } from '../src/renderer/lib/drawingChecks'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'

const geraet = (id: string, profil?: Port['st2110_21']): EquipmentItem => ({
  id, name: id, category: 'Video', x: 0, y: 0, width: 200, height: 160, outputs: [],
  inputs: [{ id: `${id}-p`, name: `${id}-p`, type: 'network', connectorType: 'Ethernet/RJ45', standard: 'ST2110-20', st2110_21: profil }],
})
const kabel: Cable = {
  id: 'k', fromEquipmentId: 'tx', fromPortId: 'tx-p', toEquipmentId: 'rx', toPortId: 'rx-p',
  type: 'Ethernet/RJ45', standard: 'ST2110-20',
} as Cable
const profilBefunde = (tx: Port['st2110_21'], rx: Port['st2110_21']) =>
  runDrawingChecks({ equipment: [geraet('tx', tx), geraet('rx', rx)], cables: [kabel] })
    .findings.filter((f) => f.id.startsWith('st2110-21-profile:'))

// #1280 — ST 2110-20 aus dem Videoformat, ST 2110-21 Sendeprofil.
describe('ST 2110-20 Last (#1280)', () => {
  it('rechnet aktive Pixel × pgroup nach RFC 4175 plus Paketkoepfe', () => {
    // 1920 × 1080 × 50 × 20 bit = 2073,6 Mbps Nutzlast, × (1 + 66/1200)
    expect(st2110_20Mbps('1080p50')).toBe(2188)
    // 2160p ist das Vierfache, nicht dieselbe Zahl wie 1080p
    expect(st2110_20Mbps('2160p50')).toBe(8751)
    expect(st2110_20Mbps('720p50')).toBeLessThan(st2110_20Mbps('1080p50')!)
    // 4:4:4 12 bit: 36 bit je Pixel statt 20
    expect(st2110_20Mbps('1080p50', '4:4:4', 12)).toBe(Math.round(2188 * 36 / 20))
  })

  it('nimmt am Kabel dessen Format, sonst das des Projekts', () => {
    expect(kabelLastMbps({ standard: 'ST2110-20', videoFormat: '2160p50' }, '1080p50')).toBe(8751)
    expect(kabelLastMbps({ standard: 'ST2110-20' }, '720p50')).toBe(st2110_20Mbps('720p50'))
    expect(kabelLastMbps({ standard: 'ST2110-20' })).toBe(bandwidthMbpsForStandard('ST2110-20'))
    expect(kabelLastMbps({ standard: 'NDI' }, '2160p50')).toBe(250)
  })
})

describe('ST 2110-21 Profil (#1280)', () => {
  it('meldet nur W-Sender an schmalem Empfaenger', () => {
    expect(st2110_21Passt('W', 'N')).toBe(false)
    expect(st2110_21Passt('W', 'W')).toBe(true)
    expect(st2110_21Passt('N', 'N')).toBe(true)
    expect(st2110_21Passt('NL', 'N')).toBe(true)
    expect(st2110_21Passt(undefined, 'N')).toBe(true)
    expect(st2110_21Passt('W', undefined)).toBe(true)
  })

  it('steht als Befund in der Plan-Pruefung', () => {
    expect(profilBefunde('W', 'N')).toHaveLength(1)
    expect(profilBefunde('N', 'N')).toHaveLength(0)
    expect(profilBefunde('W', undefined)).toHaveLength(0)
  })
})
