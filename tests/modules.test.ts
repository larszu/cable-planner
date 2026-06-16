import { describe, it, expect } from 'vitest'
import {
  MODULE_IDS,
  DEFAULT_ENABLED,
  enabledFromPresets,
  healEnabledModules,
} from '../src/renderer/lib/modules'

describe('enabledFromPresets', () => {
  it('aktiviert die Module der gewählten Presets (Vereinigung)', () => {
    const e = enabledFromPresets(['festinstallation'])
    expect(e.festinstallation).toBe(true)
    expect(e.mobile).toBe(true)
    expect(e.rental).toBe(false)
  })

  it('vereinigt mehrere Presets', () => {
    const e = enabledFromPresets(['show', 'rental'])
    expect(e.mobile).toBe(true)
    expect(e.rentman).toBe(true)
    expect(e.rental).toBe(true)
    expect(e.festinstallation).toBe(false)
  })

  it('leere Auswahl → alle aus (nur Kern bleibt, der kein Modul ist)', () => {
    const e = enabledFromPresets([])
    expect(Object.values(e).every((v) => v === false)).toBe(true)
  })
})

describe('healEnabledModules', () => {
  it('füllt fehlende Schlüssel mit Defaults', () => {
    const e = healEnabledModules({ rental: true })
    expect(e.rental).toBe(true)
    expect(e.festinstallation).toBe(DEFAULT_ENABLED.festinstallation)
    expect(Object.keys(e).sort()).toEqual([...MODULE_IDS].sort())
  })

  it('undefined → komplette Defaults', () => {
    expect(healEnabledModules(undefined)).toEqual(DEFAULT_ENABLED)
  })

  it('ignoriert Nicht-Boolean-Werte', () => {
    const e = healEnabledModules({ mobile: 'yes' as unknown as boolean })
    expect(e.mobile).toBe(DEFAULT_ENABLED.mobile)
  })
})
