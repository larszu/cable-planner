import { describe, expect, it } from 'vitest'
import {
  ALL_SHORTCUTS,
  KEYBOARD_LAYOUTS,
  formatCombo,
  keyLabelsFor,
  layoutForLanguage,
  shortcutsByKey,
} from '../src/renderer/lib/shortcutMap'

const ids = (m: Map<string, { id: string }[]>, code: string) => (m.get(code) ?? []).map((i) => i.id)

describe('shortcutMap (#949)', () => {
  it('picks the layout by UI language', () => {
    expect(layoutForLanguage('de')).toBe('qwertz')
    expect(layoutForLanguage('en')).toBe('qwerty')
  })

  it('every shortcut key exists on both layouts', () => {
    for (const layout of Object.values(KEYBOARD_LAYOUTS)) {
      const chars = new Set(layout.flat().flatMap((k) => k.chars))
      for (const it of ALL_SHORTCUTS)
        for (const k of it.keys) expect(chars, `${it.id}:${k}`).toContain(k)
    }
  })

  it('places layout-dependent characters on the right keycap', () => {
    const de = shortcutsByKey(KEYBOARD_LAYOUTS.qwertz)
    const en = shortcutsByKey(KEYBOARD_LAYOUTS.qwerty)
    expect(ids(de, 'ß')).toEqual(['help'])
    expect(ids(en, '/')).toEqual(['help'])
    expect(ids(de, '+')).toEqual(['quickAdd'])
    expect(ids(en, '=')).toEqual(['quickAdd'])
    expect(ids(de, 'Y')).toEqual(['redo'])
    expect(ids(de, 'Z')).toEqual(['undo'])
    expect(de.has('Q')).toBe(false)
  })

  it('formats modifiers per OS', () => {
    const t = (_k: string, f: string) => f
    expect(formatCombo(['Mod', 'Shift', 'S'], keyLabelsFor(true, t))).toBe('⌘+⇧+S')
    expect(formatCombo(['Mod', 'Shift', 'S'], keyLabelsFor(false, t))).toBe('Ctrl+Shift+S')
    expect(formatCombo(['ArrowUp', 'ArrowDown'], keyLabelsFor(false, t))).toBe('↑ ↓')
  })
})
