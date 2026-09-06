import { describe, expect, it } from 'vitest'
import {
  bandView,
  buildChannelList,
  CHANNEL_VIEWS,
  consoleView,
  monitorPaths,
  monitorView,
  stageView,
  venueView,
} from '../src/renderer/lib/channelList'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'

// ---------------------------------------------------------------------------
// Eine Kanalliste, fuenf Sichten (Bedarf 37, P1).
//
// Der Befund ist eine Kette aus Abschriften: „Band's rider in Word/Pages ->
// e-mail -> house input list in Excel -> console scene -> stage box labels."
// Belegt an `SoundDocs/sounddocs#111`: jemand fuellt dieselbe Patch-Liste
// zweimal aus und bittet darum, dass die eine die andere referenziert.
//
// Die Anweisung der Bedarfs-Datenbank ist woertlich und scharf:
//
//   > Next step is PROJECTIONS of one dataset, NOT MORE FIELDS.
//
// Geprueft wird deshalb genau das: dass alle fuenf Sichten aus DERSELBEN
// Zeile schneiden, dass jede nur ihre eigenen Spalten zeigt, und dass die
// Monitor-Sicht WEGE zeigt statt Mix-Inhalte -- die kennt der Plan nicht, und
// ein Feld dafuer waeren genau die ausgeschlossenen „more fields".
// ---------------------------------------------------------------------------

const port = (id: string, name: string): Port =>
  ({ id, name, type: 'port', connectorType: 'XLR' }) as Port

const geraet = (name: string, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id: `id-${name}`,
    name,
    category: 'Audio',
    inputs: [],
    outputs: [],
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    ...over,
  }) as unknown as EquipmentItem

const kabel = (
  from: [string, string],
  to: [string, string],
  over: Partial<Cable> = {},
): Cable =>
  ({
    id: `c-${from[1]}-${to[1]}`,
    name: '',
    type: 'XLR',
    length: 10,
    color: '#fff',
    fromEquipmentId: from[0],
    fromPortId: from[1],
    toEquipmentId: to[0],
    toPortId: to[1],
    notes: '',
    layer: 'audio',
    ...over,
  }) as unknown as Cable

const aufbau = () => {
  const mic = geraet('SM58 Lead Vox', { subtitle: 'Shure', outputs: [port('m1', 'OUT')], x: 300, y: 120 })
  const di = geraet('DI Bass', { subtitle: 'Radial', outputs: [port('d1', 'OUT')], x: 500, y: 200 })
  const box = geraet('Stagebox A', { inputs: [port('s1', '1'), port('s2', '2')] })
  return {
    equipment: [mic, di, box],
    cables: [kabel([di.id, 'd1'], [box.id, 's2']), kabel([mic.id, 'm1'], [box.id, 's1'])],
  }
}

describe('die eine Liste', () => {
  it('nimmt die Audio-Ebene und nummeriert in Absteck-Reihenfolge', () => {
    // Sortiert nach Ziel-Port, nicht nach Anlege-Reihenfolge: das ist die
    // Reihenfolge, in der jemand die Stagebox absteckt. Die Anlege-Reihenfolge
    // waere fuer jeden der fuenf Leser die falsche.
    const { equipment, cables } = aufbau()
    const rows = buildChannelList(equipment, cables)
    expect(rows.map((r) => r.ch)).toEqual([1, 2])
    expect(rows.map((r) => r.source)).toEqual(['SM58 Lead Vox', 'DI Bass'])
    expect(rows.map((r) => r.destinationPort)).toEqual(['1', '2'])
  })

  it('leitet die Ebene ab, wenn sie nicht gepflegt ist', () => {
    // Ein XLR-Kabel ohne gepflegte Ebene ist trotzdem Audio. Sonst faellt es
    // aus der Liste, obwohl sein Stecker eindeutig ist.
    const { equipment, cables } = aufbau()
    const ohneLayer = cables.map((c) => ({ ...c, layer: undefined }) as Cable)
    expect(buildChannelList(equipment, ohneLayer)).toHaveLength(2)
  })

  it('laesst Kabel anderer Ebenen draussen', () => {
    const { equipment, cables } = aufbau()
    const mitVideo = [...cables, kabel(['x', 'p'], ['y', 'q'], { type: 'BNC', layer: 'video' })]
    expect(buildChannelList(equipment, mitVideo)).toHaveLength(2)
  })

  it('traegt das Kabel als Beleg mit', () => {
    // Wer eine Zeile fuer falsch haelt, soll das Kabel finden, aus dem sie
    // stammt -- dieselbe Belegpflicht wie im Adressplan.
    const { equipment, cables } = aufbau()
    for (const r of buildChannelList(equipment, cables)) {
      expect(cables.some((c) => c.id === r.cableId)).toBe(true)
    }
  })
})

describe('fuenf Sichten, ein Datensatz', () => {
  const rows = () => buildChannelList(aufbau().equipment, aufbau().cables)

  it('die Band sieht ihre Spalten und nicht die des Hauses', () => {
    const t = bandView(rows())
    // BEDARF 110 — die Spalte hiess „Abnahme" und zeigte den Port der Quelle,
    // also die XLR-Buchse am Mikrofon. Das ist Infrastruktur in der
    // Mikrofon-Spalte, und genau diese Verwechslung ist der gemeldete Fehler.
    expect(t.headers).toEqual(['Ch', 'Name', 'Abnahme', 'Anschluss an der Quelle'])
    // Kein Stagebox-Port, keine Laenge: eine Spalte, die niemand liest, macht
    // das Blatt unlesbar.
    expect(t.headers).not.toContain('Port')
    expect(t.headers).not.toContain('Laenge (m)')
    expect(t.rows[0]).toEqual([1, 'SM58 Lead Vox', 'Shure', 'OUT'])
  })

  it('das Haus sieht den Port und NICHT die interne Kanalnummer', () => {
    // BEDARF 111 — „the channel number is internal to the band and
    // meaningless to venue staff; showing both implies both matter". Zwei
    // Nummern nebeneinander sind eine Aufforderung zum Abgleich, und
    // abgeglichen wuerde eine Nummer, die auf dem Blech nirgends steht.
    const t = venueView(rows())
    expect(t.headers).toEqual(['Port', 'Name', 'Ziel', 'Stecker', 'Laenge (m)'])
    expect(t.headers).not.toContain('Ch')
    expect(t.rows[0]).toEqual(['1', 'SM58 Lead Vox', 'Stagebox A', 'XLR', 10])
  })

  it('die Buehne sieht Positionen — und behauptet keine, wo keine ist', () => {
    // (0|0) waere die Buehnenmitte. Eine leere Spalte ist ehrlicher.
    const t = stageView([
      ...rows(),
      { ch: 3, cableId: 'c3', source: 'Ohne Platz', sourcePort: '', destination: '', destinationPort: '', connector: '' },
    ])
    expect(t.rows[0]).toEqual([1, 'SM58 Lead Vox', 300, 120])
    expect(t.rows[2]).toEqual([3, 'Ohne Platz', '', ''])
  })

  it('das Pult sieht Namen im belegten Zeichenbudget', () => {
    // 31 Zeichen, DNS-SD-konform (Audinate) -- das einzige in dieser Recherche
    // BELEGTE Budget in dieser Kette. Ein erfundenes Pult-Limit waere ein
    // Anker ohne Ziel-Spec, und genau das verbietet `labelTargets.ts`.
    const lang = 'Ein sehr langer Kanalname der ueber einunddreissig Zeichen geht'
    const t = consoleView([
      { ch: 1, cableId: 'c1', source: lang, sourcePort: '', destination: '', destinationPort: '', connector: '' },
    ])
    expect(String(t.rows[0][1]).length).toBeLessThanOrEqual(31)
    // Und die Kuerzung wird GENANNT: eine stillschweigend abgeschnittene
    // Beschriftung faellt erst am Pult auf.
    expect(String(t.rows[0][2])).toContain('aus:')
  })

  it('das Pult meldet nichts, wo nichts zu melden ist', () => {
    const t = consoleView([
      { ch: 1, cableId: 'c1', source: 'Lead-Vox', sourcePort: '', destination: '', destinationPort: '', connector: '' },
    ])
    expect(t.rows[0][2]).toBe('')
  })

  it('alle Sichten haben gleich viele Zeilen wie die Liste', () => {
    // Der eigentliche Test der Zusage: EIN Datensatz, fuenf Schnitte. Verliert
    // eine Sicht Zeilen, ist sie eine eigene Liste geworden.
    const r = rows()
    for (const t of [bandView(r), venueView(r), stageView(r), consoleView(r)]) {
      expect(t.rows).toHaveLength(r.length)
    }
  })

  it('fuehrt die fuenf Sichten an einer Stelle', () => {
    expect([...CHANNEL_VIEWS].sort()).toEqual(['band', 'console', 'monitor', 'stage', 'venue'])
  })
})

describe('die Monitor-Sicht zeigt WEGE', () => {
  const monitorAufbau = () => {
    const pult = geraet('Monitorpult', { outputs: [port('o1', 'Aux 1'), port('o2', 'Aux 2')] })
    const wedge = geraet('Wedge SL', { inputs: [port('w1', 'IN')] })
    const iem = geraet('IEM Sender Gitarre', { inputs: [port('i1', 'IN')] })
    const box = geraet('Stagebox A', { inputs: [port('s1', '1')] })
    return {
      equipment: [pult, wedge, iem, box],
      cables: [
        kabel([pult.id, 'o1'], [wedge.id, 'w1']),
        kabel([pult.id, 'o2'], [iem.id, 'i1']),
        // Kein Monitor-Weg: ein Mikro auf die Stagebox.
        kabel([box.id, 's1'], [box.id, 's1']),
      ],
    }
  }

  it('findet Wedge und IEM als Monitor-Ziele', () => {
    const { equipment, cables } = monitorAufbau()
    const wege = monitorPaths(equipment, cables)
    expect(wege.map((w) => w.sink)).toEqual(['Wedge SL', 'IEM Sender Gitarre'])
    expect(wege[0].outputPort).toBe('Aux 1')
  })

  it('nimmt eine gewoehnliche Audio-Strecke NICHT als Monitor-Weg', () => {
    const { equipment, cables } = monitorAufbau()
    expect(monitorPaths(equipment, cables)).toHaveLength(2)
  })

  it('behauptet keine Mix-Inhalte', () => {
    // Was in einem Mix liegt, entscheidet der Monitormann am Pult. Ein Feld
    // dafuer waeren genau die „more fields", die der Bedarf ausschliesst --
    // und es waere geraten.
    const { equipment, cables } = monitorAufbau()
    const t = monitorView(monitorPaths(equipment, cables))
    expect(t.headers).toEqual(['Pult', 'Ausgang', 'Ziel', 'Eingang'])
    for (const kopf of ['Mix', 'Kanal', 'Pegel', 'Send']) {
      expect(t.headers, `behauptet Mix-Inhalt: ${kopf}`).not.toContain(kopf)
    }
  })
})
