import { afterEach, describe, expect, it } from 'vitest'
import {
  builtInSchemaForCategory,
  formatCategoryProps,
  schemaForCategory,
  setHiddenFieldOverlay,
} from '../src/renderer/lib/categorySchemas'
import { useSettingsStore } from '../src/renderer/store/settingsStore'

afterEach(() => {
  useSettingsStore.getState().setHiddenSchemaFields({})
})

describe('Standardfelder abwählen und wieder hinzufügen (#1223)', () => {
  it('ein abgewähltes Standardfeld verschwindet aus dem Schema, die übrigen bleiben', () => {
    const alle = builtInSchemaForCategory('Objektive').map((f) => f.key)
    expect(alle).toContain('mount')
    useSettingsStore.getState().setHiddenSchemaFields({ objektive: ['mount'] })
    const keys = schemaForCategory('Objektive').map((f) => f.key)
    expect(keys).not.toContain('mount')
    expect(keys).toEqual(alle.filter((k) => k !== 'mount'))
  })

  it('gilt auch für EN-Namen und Unterkategorien', () => {
    setHiddenFieldOverlay({ objektive: ['mount'] })
    expect(schemaForCategory('Lenses').map((f) => f.key)).not.toContain('mount')
    expect(schemaForCategory('Objektive > Zoom').map((f) => f.key)).not.toContain('mount')
  })

  it('löscht keine Werte: nach dem Wiederhinzufügen sind sie wieder sichtbar', () => {
    const props = { mount: 'PL', focalLength: '17-120' }
    useSettingsStore.getState().setHiddenSchemaFields({ objektive: ['mount'] })
    expect(formatCategoryProps('Objektive', props, 'de')).not.toMatch(/PL/)
    useSettingsStore.getState().setHiddenSchemaFields({})
    expect(formatCategoryProps('Objektive', props, 'de')).toMatch(/Anschluss: PL/)
  })

  it('die gespeicherte Liste wird bereinigt', () => {
    useSettingsStore.getState().setHiddenSchemaFields({ a: ['x', 'x', '', 3 as never], b: [] })
    expect(useSettingsStore.getState().hiddenSchemaFields).toEqual({ a: ['x'] })
  })
})
