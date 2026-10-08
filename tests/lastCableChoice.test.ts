import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  cableChoiceKey,
  cableLabelName,
  rememberedLength,
  rememberedSpecId,
} from '../src/renderer/lib/lastCableChoice'
import { useUiStore } from '../src/renderer/store/uiStore'

// #1036 — 21 SDI-Kabel hiessen 21-mal den Dialog neu einstellen: Name gleich
// Kabeltyp, Laenge immer 1 m.

describe('cableChoiceKey', () => {
  it('treats both directions as the same plug pair', () => {
    expect(cableChoiceKey('BNC', 'XLR')).toBe(cableChoiceKey('XLR', 'BNC'))
  })
  it('has no key without any port', () => {
    expect(cableChoiceKey(undefined, undefined)).toBeUndefined()
  })
})

describe('remembered choice', () => {
  const ranked = [
    { cable: { id: 'sdi-3g' }, level: 'ok' },
    { cable: { id: 'hdmi' }, level: 'error' },
  ]
  it('reuses the spec only while it is offered and not a hard mismatch', () => {
    expect(rememberedSpecId({ specId: 'sdi-3g', length: 5 }, ranked)).toBe('sdi-3g')
    expect(rememberedSpecId({ specId: 'hdmi', length: 5 }, ranked)).toBeUndefined()
    expect(rememberedSpecId({ specId: 'gone', length: 5 }, ranked)).toBeUndefined()
    expect(rememberedSpecId(undefined, ranked)).toBeUndefined()
  })
  it('falls back to 1 m', () => {
    expect(rememberedLength({ specId: 'x', length: 15 })).toBe(15)
    expect(rememberedLength(undefined)).toBe(1)
    expect(rememberedLength({ specId: 'x', length: Number.NaN })).toBe(1)
  })
})

describe('cableLabelName', () => {
  const specs = [{ id: 'sdi-3g', name: 'SDI 3G (1080p50/60)' }]
  it('keeps a typed name', () => {
    expect(cableLabelName({ name: 'Cam 1', cableSpecId: 'sdi-3g', type: 'SDI' }, specs)).toBe('Cam 1')
  })
  it('shows the type name for an unnamed cable instead of an empty label', () => {
    expect(cableLabelName({ name: '', cableSpecId: 'sdi-3g', type: 'SDI' }, specs)).toBe('SDI 3G (1080p50/60)')
    expect(cableLabelName({ name: ' ', type: 'SDI' }, specs)).toBe('SDI')
  })
})

describe('uiStore.rememberCableChoice', () => {
  it('stores per key and persists', () => {
    useUiStore.getState().rememberCableChoice('BNC|BNC', { specId: 'sdi-3g', length: 10 })
    useUiStore.getState().rememberCableChoice('XLR|XLR', { specId: 'xlr', length: 3 })
    const map = useUiStore.getState().lastCableByConnector
    expect(map['BNC|BNC']).toEqual({ specId: 'sdi-3g', length: 10 })
    expect(map['XLR|XLR']).toEqual({ specId: 'xlr', length: 3 })
  })
})

describe('CableDialog wiring', () => {
  const src = readFileSync('src/renderer/components/Cable/CableDialog.tsx', 'utf8')
  it('starts with an empty name and shows the type as placeholder', () => {
    expect(src).toContain("useState('')")
    expect(src).toContain('placeholder={selected.name}')
    expect(src).not.toContain('useState(selected.name)')
  })
  it('remembers the choice on create', () => {
    expect(src).toMatch(/rememberCableChoice\(choiceKey, \{ specId, length \}\)/)
  })
})
