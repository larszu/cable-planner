import { describe, expect, it } from 'vitest'
import { geraeteUmbenannt, kabelUmbenannt, kabeltypenUmbenannt } from '../src/renderer/lib/stammdaten'

const port = (connectorType: string, standard?: string) => ({ type: connectorType, connectorType, ...(standard ? { standard } : {}) })

describe('#917 — Stammdatum umbenennen zieht die Verwendungen mit', () => {
  const geraete = [
    { id: 'a', inputs: [port('LC-Duplex'), port('BNC', 'SMPTE 2110')], outputs: [port('LC-Duplex')] },
    { id: 'b', inputs: [port('BNC')], outputs: [] },
  ]

  it('Stecker: Ports mit dem alten Namen, nur die', () => {
    const { liste, n } = geraeteUmbenannt(geraete, 'stecker', 'LC-Duplex', 'LC Duplex')
    expect(n).toBe(1)
    expect(liste[0].inputs[0]).toMatchObject({ connectorType: 'LC Duplex', type: 'LC Duplex' })
    expect(liste[0].outputs[0].connectorType).toBe('LC Duplex')
    expect(liste[0].inputs[1].connectorType).toBe('BNC')
    expect(liste[1]).toBe(geraete[1])
  })

  it('Standard: am Port, nicht am Stecker', () => {
    const { liste, n } = geraeteUmbenannt(geraete, 'standard', 'SMPTE 2110', 'SMPTE 2110-20')
    expect(n).toBe(1)
    expect(liste[0].inputs[1].standard).toBe('SMPTE 2110-20')
    expect(liste[0].inputs[0].connectorType).toBe('LC-Duplex')
  })

  it('Ebene: Geraete bleiben unberuehrt, Kabel ziehen mit', () => {
    expect(geraeteUmbenannt(geraete, 'ebene', 'intercom', 'com').n).toBe(0)
    const kabel = [
      { id: '1', type: 'Custom', layer: 'intercom' },
      { id: '2', type: 'BNC', layer: 'video' },
    ]
    const { liste, n } = kabelUmbenannt(kabel, 'ebene', 'intercom', 'com')
    expect(n).toBe(1)
    expect(liste[0].layer).toBe('com')
    expect(liste[1]).toBe(kabel[1])
  })

  it('Kabel: Standard und Stecker', () => {
    const kabel = [{ id: '1', type: 'LC-Duplex', standard: 'SMPTE 2110' }]
    expect(kabelUmbenannt(kabel, 'stecker', 'LC-Duplex', 'LC').liste[0].type).toBe('LC')
    expect(kabelUmbenannt(kabel, 'standard', 'SMPTE 2110', 'ST 2110').liste[0].standard).toBe('ST 2110')
  })

  it('eigene Kabeltypen: Stecker, kompatible Stecker, Standards', () => {
    const specs = [{ id: 'x', connectorType: 'LC-Duplex', compatibleConnectors: ['LC-Duplex', 'SC'], standards: ['SMPTE 2110'] }]
    const st = kabeltypenUmbenannt(specs, 'stecker', 'LC-Duplex', 'LC')[0]
    expect(st.connectorType).toBe('LC')
    expect(st.compatibleConnectors).toEqual(['LC', 'SC'])
    expect(kabeltypenUmbenannt(specs, 'standard', 'SMPTE 2110', 'ST 2110')[0].standards).toEqual(['ST 2110'])
    expect(kabeltypenUmbenannt(specs, 'ebene', 'a', 'b')[0]).toBe(specs[0])
  })
})
