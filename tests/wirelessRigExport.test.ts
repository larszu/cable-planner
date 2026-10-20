import { describe, expect, it } from 'vitest'
import { wirelessRigTable, channelBandStatus, RIG_LIST_HEADERS } from '../src/renderer/lib/wirelessRigExport'
import { RF_COUNTRY_TABLES, rangeForChannel, countryTable } from '../src/renderer/lib/rfCountryTables'
import { selectableBands, bandId, RF_BANDS } from '../src/renderer/lib/rfBands'
import { computeRfConflicts } from '../src/renderer/lib/rfCoordination'
import { COLUMN_GLOSSARY } from '../src/renderer/lib/dataDictionary'
import type { WirelessRigPlan } from '../src/renderer/types/wirelessRig'

const ewdS = selectableBands().find((b) => b.line === 'EW-D' && b.band === 'S1-7')!

const rig: WirelessRigPlan = {
  country: 'DE',
  channels: [
    { id: 'a', label: 'Lead', frequencyMhz: 606.5, bandId: bandId(ewdS), bandwidthKhz: 200 },
    { id: 'b', label: 'Gap', frequencyMhz: 610, bandId: bandId(ewdS) },
  ],
}

describe('#1002 Funkstrecken-Liste', () => {
  it('jede Laendertabelle und jedes waehlbare Band hat eine Quelle', () => {
    for (const t of RF_COUNTRY_TABLES) for (const r of t.ranges) expect(r.source).toMatch(/^https:\/\//)
    for (const b of selectableBands()) expect(b.source).toMatch(/^https:\/\//)
    expect(new Set(RF_BANDS.map(bandId)).size).toBe(RF_BANDS.length)
  })

  it('DE: 608–614 MHz ist nicht zugeteilt, 606,5 MHz nur prof. Produktion', () => {
    const de = countryTable('DE')
    expect(rangeForChannel(de, 610)).toBeNull()
    expect(rangeForChannel(de, 606.5, 200)?.use).toBe('professional')
    // Bandbreite ragt ueber die Grenze 608 MHz
    expect(rangeForChannel(de, 607.95, 200)).toBeNull()
  })

  it('Tabelle fuer CSV und Druck', () => {
    const t = wirelessRigTable(rig)
    expect(t.headers).toEqual([...RIG_LIST_HEADERS])
    expect(t.rows[0][4]).toBe('606.500')
    expect(t.rows[0][5]).toBe('200')
    expect(String(t.rows[1][6])).toContain('nicht in DE')
    expect(channelBandStatus(rig, 'a').inBand).toBe(true)
    expect(channelBandStatus({ ...rig, channels: [{ id: 'x', label: 'x', frequencyMhz: 700, bandId: bandId(ewdS) }] }, 'x').inBand).toBe(false)
    for (const h of RIG_LIST_HEADERS) expect(COLUMN_GLOSSARY[h]).toBeTruthy()
  })

  it('Bandbreite vergroessert den Mindestabstand', () => {
    const f = [
      { id: '1', label: 'A', mhz: 600, bandwidthMhz: 0.6 },
      { id: '2', label: 'B', mhz: 600.5, bandwidthMhz: 0.6 },
    ]
    expect(computeRfConflicts(f).some((c) => c.kind === 'spacing')).toBe(true)
    expect(computeRfConflicts(f.map(({ bandwidthMhz: _b, ...x }) => x)).some((c) => c.kind === 'spacing')).toBe(false)
  })
})
