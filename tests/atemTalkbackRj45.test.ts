import { describe, expect, it } from 'vitest'
import { BLACKMAGIC_CATALOG } from '../src/renderer/lib/blackmagicCatalog'
import { runDrawingChecks } from '../src/renderer/lib/drawingChecks'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'

// #1095 — die Talkback-RJ45 der ATEM Constellation ist analoges 4-Draht-
// Talkback, kein Ethernet. Steckt sie an einer Netzwerkbuchse, passt der
// Stecker — der Plan-Check muss es trotzdem melden.

const constellations = BLACKMAGIC_CATALOG.filter((e) => e.match.includes('constellation'))
const talkbackOf = (i: number) =>
  constellations[i].template.inputs.find((p) => p.standard === 'Talkback-4W')

describe('ATEM Constellation talkback RJ45 (#1095)', () => {
  it('every Constellation model has its own talkback port with the manual pinout', () => {
    expect(constellations.length).toBe(3)
    constellations.forEach((e, i) => {
      const tb = talkbackOf(i)
      expect(tb, e.template.name).toBeDefined()
      expect(tb!.connectorType).toBe('Ethernet/RJ45')
      expect(tb!.pinout?.map((p) => `${p.pin} ${p.signal}`)).toEqual([
        '1 Eng TX+', '2 Eng TX−', '3 Prod TX+', '4 Prod RX+',
        '5 Prod RX−', '6 Prod TX−', '7 Eng RX+', '8 Eng RX−',
      ])
      expect(tb!.pinoutSource).toContain('ATEMProductionSwitchersManual.pdf')
      expect(tb!.pinoutSource).toContain('203')
    })
  })

  const eq = (id: string, port: Port): EquipmentItem => ({
    id, name: id, category: 'Video', inputs: [port], outputs: [], x: 0, y: 0, width: 200, height: 160,
  })
  const run = (b: Port) => {
    const tb = { ...talkbackOf(0)!, id: 'tb' }
    const cable: Cable = {
      id: 'c', fromEquipmentId: 'atem', fromPortId: 'tb', toEquipmentId: 'sw', toPortId: b.id, type: 'Cat6',
    }
    return runDrawingChecks({ equipment: [eq('atem', tb), eq('sw', b)], cables: [cable] })
      .findings.filter((f) => f.category === 'Signal mismatch')
  }

  it('warns when the talkback RJ45 is cabled to an Ethernet port', () => {
    expect(run({ id: 'eth', name: 'Port 1', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' })).toHaveLength(1)
  })

  it('stays quiet talkback to talkback', () => {
    expect(
      run({ id: 'tb2', name: 'TB', type: 'Talkback-4W', connectorType: 'Ethernet/RJ45', standard: 'Talkback-4W' }),
    ).toHaveLength(0)
  })
})
