import { describe, expect, it } from 'vitest'
import {
  DEVICE_TOOL_IDS,
  TOOLS_BY_KIND,
  toolsForDevice,
  toolsInPlan,
  type DeviceToolId,
} from '../src/renderer/lib/deviceTools'
import quelle from '../src/renderer/lib/deviceTools.ts?raw'
import menuQuelle from '../src/renderer/components/Layout/MenuBar.tsx?raw'
import type { EquipmentItem } from '../src/renderer/types/equipment'

const geraet = (name: string, extra: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id: name.toLowerCase().replace(/\W+/g, '-'),
    name,
    category: 'Video',
    type: 'device',
    inputs: [],
    outputs: [],
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    ...extra,
  }) as EquipmentItem

describe('Geraete-Werkzeuge haengen am Geraet', () => {
  it('gibt dem ATEM seine drei, dem Videohub seinen einen', () => {
    expect(toolsForDevice(geraet('ATEM Constellation 8K'))).toEqual([
      'atem-mv',
      'atem-audio',
      'atem-labels',
    ])
    expect(toolsForDevice(geraet('Videohub 40x40'))).toEqual(['videohub'])
  })

  it('gibt einem gewoehnlichen Geraet keine', () => {
    // Der Normalfall. Eine leere Liste ist hier eine Aussage und keine Luecke.
    expect(toolsForDevice(geraet('Kamera 1'))).toEqual([])
    expect(toolsForDevice(geraet('Regie-Monitor'))).toEqual([])
  })

  it('gibt dem reinen Multiviewer NUR das Layout', () => {
    // Audio-Routing und Eingangs-Labels gehoeren zum Mischer. Sie an einem
    // Multiviewer anzubieten hiesse, einen Dialog zu oeffnen, der ueber
    // dieses Geraet nichts sagt.
    expect(TOOLS_BY_KIND.multiviewer).toEqual(['atem-mv'])
    expect(TOOLS_BY_KIND.multiviewer).not.toContain('atem-audio')
  })

  it('deckt jede Rolle ab und erfindet keine Werkzeug-Id', () => {
    // Berechnet, nicht aufgezaehlt: waechst `DeviceKind` um eine Rolle,
    // faellt das hier auf, statt still eine Rolle ohne Werkzeuge zu lassen.
    const rollen = Object.keys(TOOLS_BY_KIND)
    expect(rollen.sort()).toEqual(['atem', 'greengo', 'multiviewer', 'videohub'])
    const benutzt = new Set(Object.values(TOOLS_BY_KIND).flat())
    for (const t of benutzt) expect(DEVICE_TOOL_IDS).toContain(t as DeviceToolId)
    // Und umgekehrt: keine Id, die an keiner Rolle haengt.
    for (const id of DEVICE_TOOL_IDS) expect([...benutzt]).toContain(id)
  })

  it('sammelt fuer den Plan ohne Doppel und in fester Reihenfolge', () => {
    const plan = [
      geraet('Videohub 40x40'),
      geraet('ATEM Constellation 8K'),
      geraet('ATEM Mini Pro'),
      geraet('Kamera 1'),
    ]
    expect(toolsInPlan(plan)).toEqual(['atem-mv', 'atem-audio', 'atem-labels', 'videohub'])
    // Reihenfolge folgt DEVICE_TOOL_IDS, nicht der Geraeteliste: das Menue
    // soll sich nicht umsortieren, weil jemand ein Geraet verschoben hat.
    expect(toolsInPlan([...plan].reverse())).toEqual(toolsInPlan(plan))
  })

  it('meldet fuer einen Plan ohne solche Geraete gar nichts', () => {
    expect(toolsInPlan([geraet('Kamera 1'), geraet('Regie-Monitor')])).toEqual([])
    expect(toolsInPlan([])).toEqual([])
  })

  it('erfindet keine zweite Geraete-Erkennung', () => {
    // Die Rolle kommt aus `detectDeviceKind` — Datenblatt zuerst,
    // Namens-Heuristik nur als Rueckfall. Eine eigene Regex hier waere die
    // dritte Wahrheit ueber dasselbe Geraet.
    expect(quelle).toContain("from './deviceKind'")
    expect(quelle, 'keine eigene Namens-Erkennung').not.toMatch(/\/.*atem.*\/i|test\(.*name/i)
  })

  it('das Menue zeigt Geraete-Werkzeuge nur, wenn der Plan sie braucht', () => {
    // Sonst waere die Tabelle gebaut und das Menue truege die fuenf Zeilen
    // weiter — genau die Aenderung, die in der Zusammenfassung gut klingt
    // und im Fenster nichts tut.
    //
    // BERICHTIGT: hier stand `toContain('toolsInPlan')`. Das war blind — der
    // Name steht schon in der Import-Zeile, und eine Gegensonde, die den
    // AUFRUF entfernte, kam damit gruen durch. Geprueft wird jetzt, dass
    // JEDE der fuenf Zeilen an ihrer eigenen Id haengt; die Liste kommt aus
    // `DEVICE_TOOL_IDS`, wird also nicht hier aufgezaehlt.
    expect(menuQuelle).toMatch(/toolsInPlan\(\s*useProjectStore/)
    for (const id of DEVICE_TOOL_IDS) {
      expect(menuQuelle, `Menue-Zeile fuer ${id} haengt an ihrer Id`).toContain(
        `geraeteWerkzeuge.includes('${id}')`,
      )
    }
  })
})
