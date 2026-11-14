import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { vorlagenPortsMitIds } from '../src/renderer/lib/vorlagenPortIds'
import type { Port } from '../src/renderer/types/equipment'

const port = (id: string, name: string): Port => ({ id, name, type: 'BNC', connectorType: 'BNC' })

describe('Vorlagen-Ports bekommen eindeutige Ids (#1224)', () => {
  it('ersetzt leere und doppelte Ids, laesst eindeutige stehen', () => {
    const aus = vorlagenPortsMitIds([port('', 'A'), port('x', 'B'), port('x', 'C'), port('', 'D')], 'Cam:in')
    expect(aus.map((p) => p.id)).toEqual(['Cam:in#0', 'x', 'Cam:in#2', 'Cam:in#3'])
    expect(new Set(aus.map((p) => p.id)).size).toBe(4)
    expect(aus.map((p) => p.name)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('zwei Vorlagen teilen sich keine Ids — React haelt keine Zeile der vorigen fest', () => {
    const a = vorlagenPortsMitIds([port('', 'SDI 1')], 'Videohub:in')
    const b = vorlagenPortsMitIds([port('', 'SDI 1')], 'Ki Pro:in')
    expect(a[0].id).not.toBe(b[0].id)
  })

  it('ist stabil: dieselbe Vorlage ergibt dieselben Ids', () => {
    const ports = [port('', 'A'), port('', 'B')]
    expect(vorlagenPortsMitIds(ports, 'T:out')).toEqual(vorlagenPortsMitIds(ports, 'T:out'))
  })

  it('weicht einer vorhandenen Id aus, die wie eine erzeugte aussieht', () => {
    const aus = vorlagenPortsMitIds([port('', 'A'), port('T:in#0', 'B')], 'T:in')
    expect(new Set(aus.map((p) => p.id)).size).toBe(2)
    expect(aus[1].id).toBe('T:in#0')
  })

  it('der Vorlagen-Inspector reicht die Ports nur so an die Port-Liste', () => {
    const src = readFileSync('src/renderer/components/Properties/TemplateProperties.tsx', 'utf8')
    expect(src).toMatch(/vorlagenPortsMitIds\(template\.inputs, /)
    expect(src).toMatch(/vorlagenPortsMitIds\(template\.outputs/)
    expect(src).not.toMatch(/ports=\{template\.(inputs|outputs)\}/)
  })
})
