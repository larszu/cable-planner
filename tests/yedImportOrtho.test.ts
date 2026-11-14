import { describe, expect, it } from 'vitest'
import { useProjectStore } from '../src/renderer/store/projectStore'
import { useUiStore } from '../src/renderer/store/uiStore'

/**
 * #1116 — yEd-Import legt Kabel als „Ortho" an, mit und ohne Knickpunkte,
 * unabhaengig von der Zeichen-Voreinstellung fuer neue Kabel.
 */

const geraet = (key: string) => ({
  graphmlId: key,
  importKey: key,
  name: key,
  type: 'Device',
  category: 'Video',
  x: 0,
  y: 0,
  inputs: [{ id: `${key}-in`, name: 'In', originalName: 'In', type: 'SDI' as const, connectorType: 'BNC' as const }],
  outputs: [{ id: `${key}-out`, name: 'Out', originalName: 'Out', type: 'SDI' as const, connectorType: 'BNC' as const }],
})

const kabel = (id: string, waypoints?: { x: number; y: number }[]) => ({
  importKey: id,
  graphmlEdgeId: id,
  sourceDeviceImportKey: 'a',
  sourcePortImportKey: 'a-out',
  targetDeviceImportKey: 'b',
  targetPortImportKey: 'b-in',
  type: 'SDI' as const,
  length: 5,
  color: '#ffffff',
  name: id,
  waypoints,
})

describe('yEd-Import: Kabelfuehrung', () => {
  it('legt jedes Kabel orthogonal an, auch mit Knickpunkten und anderer Voreinstellung', () => {
    useUiStore.getState().setDefaultRouting('straight')
    useProjectStore.getState().importGraphml({
      devices: [geraet('a'), geraet('b')] as never,
      portIndex: {
        'a-out': { deviceImportKey: 'a', side: 'out', index: 0 },
        'b-in': { deviceImportKey: 'b', side: 'in', index: 0 },
      },
      cables: [kabel('e1'), kabel('e2', [{ x: 10, y: 20 }])],
      mode: 'replace',
    })
    const importiert = useProjectStore.getState().project.cables.filter((c) => c.graphmlEdgeId)
    expect(importiert).toHaveLength(2)
    expect(importiert.map((c) => c.routing)).toEqual(['orthogonal', 'orthogonal'])
    expect(importiert.find((c) => c.graphmlEdgeId === 'e2')?.waypoints).toEqual([{ x: 10, y: 20 }])
  })
})
