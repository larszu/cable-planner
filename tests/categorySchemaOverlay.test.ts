import { describe, expect, it, afterEach } from 'vitest'
import {
  schemaForCategory,
  builtInSchemaForCategory,
  setUserSchemaOverlay,
  canonicalCategoryKey,
  type CategoryFieldDef,
} from '../src/renderer/lib/categorySchemas'

const field = (key: string): CategoryFieldDef => ({
  key,
  label: { de: key, en: key },
  type: 'text',
})

afterEach(() => setUserSchemaOverlay({})) // Overlay zwischen Tests zuruecksetzen.

describe('categorySchemas — User-Feld-Overlay (Feld-Builder)', () => {
  it('mischt User-Felder hinter die Built-ins', () => {
    const before = builtInSchemaForCategory('Mikrofone').length
    setUserSchemaOverlay({ mikrofone: [field('pickupPattern')] })
    const after = schemaForCategory('Mikrofone')
    expect(after.length).toBe(before + 1)
    const added = after.find((f) => f.key === 'pickupPattern')
    expect(added?.userDefined).toBe(true)
  })

  it('Built-in-Key gewinnt gegen kollidierendes User-Feld (kein Ueberschreiben)', () => {
    setUserSchemaOverlay({ mikrofone: [{ ...field('polarPattern'), label: { de: 'HACK', en: 'HACK' } }] })
    const merged = schemaForCategory('Mikrofone')
    const pp = merged.filter((f) => f.key === 'polarPattern')
    expect(pp).toHaveLength(1)
    expect(pp[0].userDefined).toBeUndefined() // die Built-in-Definition
  })

  it('Overlay wirkt auch ueber den EN-Kategorie-Alias', () => {
    setUserSchemaOverlay({ mikrofone: [field('customA')] })
    // "Microphones" (EN) muss auf denselben kanonischen Key aufloesen.
    expect(canonicalCategoryKey('Microphones')).toBe('mikrofone')
    expect(schemaForCategory('Microphones').some((f) => f.key === 'customA')).toBe(true)
  })

  it('leeres Overlay laesst Built-ins unveraendert', () => {
    setUserSchemaOverlay({})
    expect(schemaForCategory('Mikrofone')).toEqual(builtInSchemaForCategory('Mikrofone'))
  })
})
