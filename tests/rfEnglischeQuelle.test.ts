import { describe, expect, it } from 'vitest'
import { RF_COUNTRY_TABLES } from '../src/renderer/lib/rfCountryTables'
import { computeRfConflicts, DEFAULT_RF_OPTIONS, rfConflictText } from '../src/renderer/lib/rfCoordination'
import { SPECTRUM_SOURCE_LABEL } from '../src/renderer/lib/spectrumPlan'
import { de } from '../src/renderer/lib/i18n/de'

// Englische Quelle (E-28) fuer Funk: Laendernamen, Herkunft und RF-Befunde
// standen deutsch im Quelltext und erschienen so in der englischen Oberflaeche.

describe('RF texts have an English source', () => {
  it('country names are English, German in de.ts', () => {
    expect(RF_COUNTRY_TABLES.map((c) => c.name)).toEqual(
      expect.arrayContaining(['Germany', 'Austria', 'Switzerland', 'Netherlands', 'France']),
    )
    expect(de['wireless.country.AT']).toBe('Österreich')
  })

  it('spectrum source labels are English', () => {
    expect(SPECTRUM_SOURCE_LABEL.rig).toBe('Wireless mic rig')
  })

  it('spacing finding: English on screen, canonical German message', () => {
    const [c] = computeRfConflicts(
      [
        { id: 'a', label: 'A', mhz: 600 },
        { id: 'b', label: 'B', mhz: 600.1 },
      ],
      DEFAULT_RF_OPTIONS,
    )
    expect(rfConflictText(c, (_k, en) => en)).toContain('spacing')
    expect(c.message).toContain('Abstand')
  })
})
