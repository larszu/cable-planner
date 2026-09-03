import { describe, expect, it } from 'vitest'
import { buildGg5File } from '../src/renderer/lib/exportGreengo'
import { isParseError, parseGg5File } from '../src/renderer/lib/importGreengo'
import dialogSrc from '../src/renderer/components/Export/GreenGoExportDialog.tsx?raw'
import dictsSrc from '../src/renderer/lib/i18n/dicts.ts?raw'
import type { GreenGoConfig } from '../src/renderer/types/greengo'

// ADR-005, Inkrement 4, Regel 4 — eine Zusage muss pruefbar sein.
//
// Der Kopf von exportGreengo.ts verspricht seit jeher:
//
//   „Generates a minimal but valid GreenGo .gg5 JSON configuration file …
//    The output can be loaded directly into the GreenGo Manager software
//    (v5.x)."
//
// 290 Zeilen Erzeuger, und dazu stand KEINE einzige Zeile Test. Ob das
// Ergebnis ueberhaupt wieder lesbar ist, wusste niemand.
//
// Der GreenGo Manager steht hier nicht zur Verfuegung; der schaerfste
// verfuegbare Massstab ist der EIGENE Importer. Was der Cable-Planner
// schreibt und selbst nicht mehr einlesen kann, ist auch fuer den Manager
// kein guter Kandidat — und andersherum faengt dieser Test jede Aenderung am
// Erzeuger, die das Format bricht.

const parseBack = (config: GreenGoConfig) => {
  const result = parseGg5File(buildGg5File(config))
  if (isParseError(result)) throw new Error(`.gg5 nicht lesbar: ${result.error}`)
  return result
}

const config: GreenGoConfig = {
  systemName: 'Halle 7',
  description: 'Zweite Regie, Ebene 3',
  multicastAddress: '239.1.160.7',
  sampleRate: 48000,
  users: [
    { id: 1, name: 'BPX1', displayName: 'Regie', color: 2, groupIds: [1, 2] },
    { id: 2, name: 'WBPX2', groupIds: [2] },
  ],
  groups: [
    { id: 1, name: 'PGM', color: 1 },
    { id: 2, name: 'CAM' },
  ],
}

describe('buildGg5File — was rausgeht, kommt wieder rein', () => {
  it('der eigene Importer liest die erzeugte Datei', () => {
    expect(() => parseBack(config)).not.toThrow()
  })

  it('System-Angaben ueberstehen die Runde', () => {
    const back = parseBack(config).config
    expect(back.systemName).toBe('Halle 7')
    expect(back.description).toBe('Zweite Regie, Ebene 3')
    expect(back.multicastAddress).toBe('239.1.160.7')
    expect(back.sampleRate).toBe(48000)
  })

  it('Stationen behalten Name, Anzeigename, Farbe und Gruppen', () => {
    const back = parseBack(config).config
    expect(back.users).toHaveLength(2)
    expect(back.users[0]).toMatchObject({
      id: 1, name: 'BPX1', displayName: 'Regie', color: 2, groupIds: [1, 2],
    })
    expect(back.users[1]).toMatchObject({ id: 2, name: 'WBPX2', groupIds: [2] })
  })

  it('Gruppen behalten Nummer, Name und Farbe', () => {
    const back = parseBack(config).config
    expect(back.groups).toEqual([
      { id: 1, name: 'PGM', color: 1 },
      { id: 2, name: 'CAM', color: 0 },
    ])
  })

  it('Umlaute ueberleben die JSON-Runde', () => {
    const back = parseBack({ ...config, groups: [{ id: 1, name: 'Bühne Süd' }] }).config
    expect(back.groups[0].name).toBe('Bühne Süd')
  })

  it('das volle 12-Stationen-/9-Gruppen-System geht durch', () => {
    // MAX_USERS / MAX_GROUPS im Dialog. Die obere Grenze ist die
    // interessante: dort haengen die Tastenbelegungen der Beltpacks.
    const voll: GreenGoConfig = {
      ...config,
      users: Array.from({ length: 12 }, (_, i) => ({
        id: i + 1, name: `BPX${i + 1}`, groupIds: [1, 2, 3],
      })),
      groups: Array.from({ length: 9 }, (_, i) => ({ id: i + 1, name: `G${i + 1}` })),
    }
    const back = parseBack(voll).config
    expect(back.users).toHaveLength(12)
    expect(back.groups).toHaveLength(9)
    expect(back.users[11].groupIds).toEqual([1, 2, 3])
  })

  it('eine Station ODER eine Gruppe reicht — das ist das echte Minimum', () => {
    const nurGruppe = { ...config, users: [], groups: [{ id: 1, name: 'PGM' }] }
    const nurStation = { ...config, users: [{ id: 1, name: 'BPX1', groupIds: [] }], groups: [] }
    expect(() => parseBack(nurGruppe)).not.toThrow()
    expect(() => parseBack(nurStation)).not.toThrow()
  })

  it('bei BEIDEM leer entsteht eine Datei, die der eigene Importer ablehnt', () => {
    // Das ist der Punkt, an dem „minimal but valid" nicht mehr stimmt.
    // Deshalb steht im Dialog jetzt eine Sperre davor — hier festgehalten,
    // damit klar bleibt, WARUM die Sperre da ist.
    expect(() => parseBack({ ...config, users: [], groups: [] })).toThrow(/No users or groups/)
  })
})

describe('der Dialog exportiert die leere Konfiguration gar nicht erst', () => {
  it('sperrt den Knopf genau an dieser Grenze', () => {
    const src = dialogSrc.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '')
    expect(src).toContain('config.users.length === 0 && config.groups.length === 0')
    expect(src).toContain('disabled={exportBlocked}')
  })

  it('sagt statt zu schweigen, was fehlt', () => {
    expect(dialogSrc).toContain('greengo.export.blocked')
    expect(dictsSrc).toContain('Without at least one station or group')
  })
})
