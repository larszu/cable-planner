import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { useProjectStore } from '../src/renderer/store/projectStore'

describe('updateCustomTemplate (#987)', () => {
  beforeEach(() => {
    useProjectStore.setState({
      customLibrary: [
        { name: 'Cam', category: 'Video', inputs: [], outputs: [], width: 100, height: 60, subtitle: 'alt' },
      ],
    } as never)
  })

  it('setzt Kurzname/Notizen, leert Untertitel und laesst Fehlendes stehen', () => {
    useProjectStore.getState().updateCustomTemplate('Cam', { shortName: ' C1 ', subtitle: '', notes: 'n' })
    const tpl = useProjectStore.getState().customLibrary[0]
    expect(tpl.shortName).toBe('C1')
    expect(tpl.subtitle).toBeUndefined()
    expect(tpl.notes).toBe('n')
    expect(tpl.category).toBe('Video')
  })

  it('#1206 — Ports der Vorlage lassen sich direkt aendern', () => {
    const port = { id: 'p1', name: 'SDI 1', type: 'SDI', connectorType: 'BNC' as const }
    useProjectStore.getState().updateCustomTemplate('Cam', { outputs: [port] })
    const tpl = useProjectStore.getState().customLibrary[0]
    expect(tpl.outputs).toEqual([port])
    expect(tpl.inputs).toEqual([])
    expect(tpl.subtitle).toBe('alt')
  })
})

describe('Vorlagen-Inspector zeigt die vollen Eigenschaften (#987)', () => {
  const tpl = readFileSync('src/renderer/components/Properties/TemplateProperties.tsx', 'utf8')

  it('bearbeitet Kurzname, Untertitel, Notizen und die Ports', () => {
    for (const key of ['shortName', 'subtitle', 'notes', 'rackUnits', 'modes']) {
      expect(tpl).toMatch(new RegExp(`template\\.field\\.${key}`))
    }
    // #1206 — bearbeitbar statt nur gelistet, und zwar an der Vorlage.
    expect(tpl.match(/<PortList\b/g)).toHaveLength(2)
    expect(tpl).toMatch(/updateCustomTemplate\(template\.name, \{ inputs \}\)/)
    expect(tpl).toMatch(/updateCustomTemplate\(template\.name, \{ outputs \}\)/)
  })
})
