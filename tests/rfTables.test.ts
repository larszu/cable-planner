import { describe, it, expect } from 'vitest'
import { RF_COUNTRY_TABLES, countryTable, rangeForChannel } from '../src/renderer/lib/rfCountryTables'
import { RF_BANDS, selectableBands, bandId } from '../src/renderer/lib/rfBands'

describe('#1002 Frequenztabellen', () => {
  it('jede Laenderzeile hat Quelle und gueltigen Bereich', () => {
    for (const t of RF_COUNTRY_TABLES)
      for (const r of t.ranges) {
        expect(r.source).toMatch(/^https:\/\//)
        expect(r.fromMHz).toBeLessThan(r.toMHz)
      }
  })
  it('enthaelt DE, AT, CH, NL, FR, US', () => {
    expect(RF_COUNTRY_TABLES.map((t) => t.code)).toEqual(['DE', 'AT', 'CH', 'NL', 'FR', 'US'])
  })
  it('557 MHz liegt in NL in keinem Bereich, 560 MHz schon', () => {
    const nl = countryTable('NL')
    expect(rangeForChannel(nl, 557)).toBeNull()
    expect(rangeForChannel(nl, 560)).not.toBeNull()
  })
  it('Band-IDs sind eindeutig, waehlbare Baender haben gueltige Grenzen', () => {
    const ids = RF_BANDS.map(bandId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const b of selectableBands()) expect(b.fromMHz).toBeLessThan(b.toMHz)
  })
})
