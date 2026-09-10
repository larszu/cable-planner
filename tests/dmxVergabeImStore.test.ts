import { describe, expect, it, beforeEach } from 'vitest'
import { useProjectStore } from '../src/renderer/store/projectStore'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { DmxModus } from '../src/renderer/lib/dmx'

// ---------------------------------------------------------------------------
// Die Automatik im Store — was sie schreibt und was sie in Ruhe laesst.
//
// Der Rechenkern steht in `lib/dmx/` und hat eigene Tests. Hier geht es um die
// Naht: greift die Aktion auf die richtigen Geraete zu, schreibt sie ins
// Projekt zurueck, und haelt sie sich an die Entscheidung des Eigentuemers
// („vergeben und melden, nichts still verschieben")?
//
// WARUM DAS EIN EIGENER TEST IST: der Kern kann richtig rechnen und die Naht
// trotzdem falsch sein — sie koennte die festgesetzten Adressen ueberschreiben,
// Geraete ohne Profil einbeziehen oder das Ergebnis gar nicht anwenden. Genau
// solche Nahtstellen sind es, an denen in diesem Repo mehrfach etwas verloren
// ging (zuletzt der Rueckweg des Rack-Builders, #833).
// ---------------------------------------------------------------------------

const modus = (id: string, kanaele: number): DmxModus => ({
  id,
  name: id,
  kanaele,
  herkunft: 'handbuch',
})

const lampe = (
  id: string,
  x: number,
  y: number,
  teil: Partial<EquipmentItem> = {},
): EquipmentItem =>
  ({
    id,
    name: id,
    category: 'Lighting',
    inputs: [],
    outputs: [],
    x,
    y,
    width: 100,
    height: 100,
    dmxProfil: { hersteller: 'Robe', modell: 'Robin MegaPointe', modi: [modus('m1', 25), modus('m2', 39)] },
    dmxModusId: 'm1',
    ...teil,
  }) as EquipmentItem

const setzeGeraete = (equipment: EquipmentItem[]) => {
  const s = useProjectStore.getState()
  useProjectStore.setState({ project: { ...s.project, equipment, cables: [], locations: [] } })
}

const geraet = (id: string) =>
  useProjectStore.getState().project.equipment.find((e) => e.id === id)

describe('DMX-Adressen vergeben (Store-Aktion)', () => {
  beforeEach(() => {
    setzeGeraete([])
  })

  it('vergibt dicht gepackt in Lesereihenfolge und schreibt es ins Projekt', () => {
    setzeGeraete([lampe('b', 5, 0), lampe('a', 0, 0)])
    const bericht = useProjectStore.getState().vergibDmxAdressen()
    expect(bericht).toEqual({ vergeben: 2, uebersprungen: 0 })
    expect(geraet('a')).toMatchObject({ dmxUniverse: 1, dmxAdresse: 1 })
    expect(geraet('b')).toMatchObject({ dmxUniverse: 1, dmxAdresse: 26 })
  })

  it('der gewaehlte Modus bestimmt den Abstand — nicht eine feste Zahl', () => {
    setzeGeraete([lampe('a', 0, 0, { dmxModusId: 'm2' }), lampe('b', 5, 0)])
    useProjectStore.getState().vergibDmxAdressen()
    // m2 = 39 Kanaele, also faengt b bei 40 an. Mit einer festen Zahl (wie
    // vorher `dmxChannels`) stuende hier 26 — und ab dem zweiten Geraet waere
    // jede Adresse falsch.
    expect(geraet('b')).toMatchObject({ dmxAdresse: 40 })
  })

  it('laesst eine festgesetzte Adresse unangetastet', () => {
    setzeGeraete([
      lampe('a', 0, 0),
      lampe('fest', 5, 0, { dmxUniverse: 7, dmxAdresse: 100, dmxAdresseFestgesetzt: true }),
    ])
    useProjectStore.getState().vergibDmxAdressen()
    expect(geraet('fest')).toMatchObject({ dmxUniverse: 7, dmxAdresse: 100 })
  })

  it('weicht einer Kollision NICHT aus — die Adresse steht, der Plan-Check meldet', () => {
    setzeGeraete([
      lampe('a', 0, 0),
      lampe('fest', 5, 0, { dmxUniverse: 1, dmxAdresse: 1, dmxAdresseFestgesetzt: true }),
    ])
    useProjectStore.getState().vergibDmxAdressen()
    expect(geraet('a')).toMatchObject({ dmxUniverse: 1, dmxAdresse: 1 })
    expect(geraet('fest')).toMatchObject({ dmxUniverse: 1, dmxAdresse: 1 })
  })

  it('ueberspringt Geraete ohne Modus und sagt wie viele', () => {
    setzeGeraete([lampe('a', 0, 0), lampe('ohne', 5, 0, { dmxModusId: undefined })])
    const bericht = useProjectStore.getState().vergibDmxAdressen()
    expect(bericht).toEqual({ vergeben: 1, uebersprungen: 1 })
    expect(geraet('ohne')?.dmxAdresse).toBeUndefined()
  })

  it('fasst Geraete ohne DMX-Profil gar nicht erst an', () => {
    // Aus der Kategorie zu schliessen waere der Namensabgleich (ADR-002): eine
    // konventionelle Stufenlinse am Dimmer bekaeme eine Adresse, die es an ihr
    // nicht gibt.
    const stufenlinse = lampe('dimmer', 0, 0, { dmxProfil: undefined, dmxModusId: undefined })
    setzeGeraete([stufenlinse, lampe('a', 5, 0)])
    const bericht = useProjectStore.getState().vergibDmxAdressen()
    expect(bericht.vergeben).toBe(1)
    expect(geraet('dimmer')?.dmxAdresse).toBeUndefined()
  })

  it('respektiert Start-Universe und Startadresse', () => {
    setzeGeraete([lampe('a', 0, 0)])
    useProjectStore.getState().vergibDmxAdressen(3, 50)
    expect(geraet('a')).toMatchObject({ dmxUniverse: 3, dmxAdresse: 50 })
  })
})
