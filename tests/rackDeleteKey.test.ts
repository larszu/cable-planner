import { describe, expect, it } from 'vitest'
import { istLoeschTaste } from '../src/renderer/components/Rack/useRackDeleteKey'

// #1221 — Geraete im Rack per Taste entfernen.
const ziel = (tagName: string, isContentEditable = false) => ({ tagName, isContentEditable }) as unknown as EventTarget

describe('Entf im Rack-Builder', () => {
  it('Entf und Backspace loesen aus, wenn nur der Builder offen ist', () => {
    expect(istLoeschTaste({ key: 'Delete', target: ziel('DIV') }, 1)).toBe(true)
    expect(istLoeschTaste({ key: 'Backspace', target: ziel('DIV') }, 1)).toBe(true)
  })
  it('andere Tasten nicht', () => {
    expect(istLoeschTaste({ key: 'a', target: ziel('DIV') }, 1)).toBe(false)
  })
  it('nicht in Eingabefeldern', () => {
    expect(istLoeschTaste({ key: 'Backspace', target: ziel('INPUT') }, 1)).toBe(false)
    expect(istLoeschTaste({ key: 'Delete', target: ziel('DIV', true) }, 1)).toBe(false)
  })
  it('nicht, solange ein weiterer Dialog offen ist', () => {
    expect(istLoeschTaste({ key: 'Delete', target: ziel('DIV') }, 2)).toBe(false)
  })
})
