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
})

describe('Vorlagen-Inspector zeigt die vollen Eigenschaften (#987)', () => {
  const tpl = readFileSync('src/renderer/components/Properties/TemplateProperties.tsx', 'utf8')

  it('bearbeitet Kurzname, Untertitel und Notizen und listet die Ports', () => {
    for (const key of ['shortName', 'subtitle', 'notes', 'rackUnits', 'modes']) {
      expect(tpl).toMatch(new RegExp(`template\\.field\\.${key}`))
    }
    expect(tpl.match(/<TemplatePortList /g)).toHaveLength(2)
  })
})
