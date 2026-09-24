// #917 — eigene Stammdaten: Abgleich ueber die geteilte Bibliothek.
import { describe, expect, it } from 'vitest'
import { fehlendeStammdaten, schonVorhanden, vereinigteStammdaten } from '../src/renderer/lib/stammdaten'

const eingebaut = { connectorTypes: ['BNC', 'XLR'], signalStandards: ['SDI-12G'], cableLayers: ['video'] }
const lokal = { connectorTypes: ['LC-Duplex'], signalStandards: [], cableLayers: ['intercom'] }

describe('fehlendeStammdaten', () => {
  it('holt nur, was lokal fehlt — ohne Eingebautes und ohne Schreibvarianten', () => {
    expect(
      fehlendeStammdaten(lokal, {
        connectorTypes: ['lc-duplex', 'opticalCON DUO', 'bnc', '  ', 42],
        signalStandards: ['SMPTE 2110-20', 'smpte 2110-20'],
        cableLayers: 'kaputt',
      }, eingebaut),
    ).toEqual({ connectorTypes: ['opticalCON DUO'], signalStandards: ['SMPTE 2110-20'], cableLayers: [] })
  })

  it('eine alte Datei ohne Stammdaten bringt nichts und bricht nichts', () => {
    expect(fehlendeStammdaten(lokal, {}, eingebaut)).toEqual({ connectorTypes: [], signalStandards: [], cableLayers: [] })
  })
})

describe('vereinigteStammdaten', () => {
  it('lokal zuerst, geteilt dahinter, ohne Doppelte', () => {
    expect(vereinigteStammdaten(lokal, { connectorTypes: ['lc-duplex', 'MPO-12'], cableLayers: ['Intercom', 'lighting'] })).toEqual({
      connectorTypes: ['LC-Duplex', 'MPO-12'],
      signalStandards: [],
      cableLayers: ['intercom', 'lighting'],
    })
  })
})

it('schonVorhanden prueft ohne Gross/Klein ueber alle Listen', () => {
  expect(schonVorhanden(' xlr ', eingebaut.connectorTypes, lokal.connectorTypes)).toBe(true)
  expect(schonVorhanden('Neu', eingebaut.connectorTypes, lokal.connectorTypes)).toBe(false)
})
