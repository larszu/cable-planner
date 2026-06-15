import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildExportFilename,
  buildExportFilenameWithSuffix,
} from '../src/renderer/lib/exportFilename'

// v7.9.116 — Einheitlicher Export-Dateiname YYYYMMDD_<Name>_NNN.<ext>.
// localStorage (Tages-Counter) wird von happy-dom bereitgestellt.

const DATE = /^\d{8}_/ // führendes YYYYMMDD_

describe('buildExportFilename', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('baut das Format YYYYMMDD_<Name>_NNN.<ext>', () => {
    const name = buildExportFilename('Demo-Show', 'pdf')
    expect(name).toMatch(/^\d{8}_Demo-Show_001\.pdf$/)
  })

  it('zählt den Tages-Counter hoch (001 → 002 → 003)', () => {
    expect(buildExportFilename('X', 'pdf')).toMatch(/_001\.pdf$/)
    expect(buildExportFilename('X', 'pdf')).toMatch(/_002\.pdf$/)
    expect(buildExportFilename('X', 'pdf')).toMatch(/_003\.pdf$/)
  })

  it('sanitisiert dateisystem-unsichere Zeichen, behält Umlaute', () => {
    const name = buildExportFilename('A/B:C*?"<>|D', 'csv')
    expect(name).toMatch(DATE)
    expect(name.endsWith('.csv')).toBe(true)
    expect(name).not.toMatch(/[/:*?"<>|]/) // Slash etc. ersetzt
    expect(buildExportFilename('Tonü Ärör', 'pdf')).toContain('Tonü Ärör')
  })

  it('normalisiert die Endung (führende Punkte weg, lowercase) + Fallback', () => {
    expect(buildExportFilename('X', '.PDF')).toMatch(/\.pdf$/)
    expect(buildExportFilename('X', '')).toMatch(/\.bin$/) // leere Endung → bin
  })

  it('fällt bei leerem Namen auf "cable-planner" zurück', () => {
    expect(buildExportFilename('   ', 'pdf')).toMatch(/^\d{8}_cable-planner_\d{3}\.pdf$/)
  })
})

describe('buildExportFilenameWithSuffix', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('hängt das Suffix mit Bindestrich vor der Endung an', () => {
    const name = buildExportFilenameWithSuffix('Demo', 'kabel bom', 'pdf')
    expect(name).toMatch(/^\d{8}_Demo_001_kabel-bom\.pdf$/) // Leerzeichen → Bindestrich
  })
})
