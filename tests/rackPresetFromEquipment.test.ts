import { describe, expect, it } from 'vitest'
import {
  RACK_DRAFT_FIELDS_NOT_FROM_EQUIPMENT,
  presetFromBlackBoxRack,
  presetFromEquipmentSelection,
} from '../src/renderer/lib/rackPreset'
import { interfaceKeys } from './support/interfaceKeys'
import draftTypesSrc from '../src/renderer/components/Rack/rackBuilderTypes.ts?raw'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ADR-005, Inkrement 4, Regel 1 — was das Rack aus dem Plan uebernimmt.
//
// Zwei Wege bauen ein Rack-Preset aus Geraeten, die schon im Plan liegen.
// Beide standen als eigene Aufzaehlung im LibraryPanel, in je einem
// useEffect, und beide liessen liegen, was sie nicht aufzaehlten — obwohl
// der Draft und `presetFromDraft` die Felder tragen. Das ist dieselbe Klasse
// wie #626: eine zweite (hier: dritte und vierte) Aufzaehlung derselben
// Struktur, die niemand nachzieht.

const port = (id: string, name: string, deviceIndex?: number) => ({
  id,
  name,
  type: 'port',
  connectorType: 'BNC',
  ...(deviceIndex != null ? { rackOriginDeviceIndex: deviceIndex, rackOriginPortName: name } : {}),
})

const eq = (over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id: 'e1',
    name: 'ATEM 4 M/E',
    category: 'Mischer',
    inputs: [port('e1-in', 'SDI IN 1')],
    outputs: [port('e1-out', 'SDI OUT 1')],
    x: 0,
    y: 0,
    width: 240,
    height: 80,
    ...over,
  }) as unknown as EquipmentItem

describe('presetFromEquipmentSelection — Rack Builder aus Auswahl', () => {
  it('nimmt Tiefe, STL-Geometrie und die Rack-Marker mit', () => {
    // Genau die fuenf Felder, die die alte Aufzaehlung nicht kannte. Ohne sie
    // kam ein 800-mm-Geraet mit 3D-Modell als tiefenloses Kaestchen im Rack
    // an — und die 3D-Ansicht kann dann nicht mehr pruefen, ob dahinter noch
    // eine Patchblende passt (wofuer #170 die Felder eingefuehrt hat).
    const preset = presetFromEquipmentSelection(
      [
        eq({
          rackUnits: 4,
          depthMm: 800,
          stlDataUri: 'data:model/stl;base64,AAAA',
          isPatchPanel: true,
          isRackShelf: false,
          rentmanId: 'rm-4711',
        } as Partial<EquipmentItem>),
      ],
      'p1',
      'Rack A',
    )!
    const item = preset.items[0]
    expect(item.depthMm).toBe(800)
    expect(item.stlDataUri).toBe('data:model/stl;base64,AAAA')
    expect(item.isPatchPanel).toBe(true)
    expect(item.isRackShelf).toBe(false)
    expect(item.rentmanId).toBe('rm-4711')
  })

  it('stapelt nach HE-Groesse von oben nach unten', () => {
    const preset = presetFromEquipmentSelection(
      [eq({ id: 'a', rackUnits: 2 }), eq({ id: 'b', rackUnits: 1 }), eq({ id: 'c', rackUnits: 3 })],
      'p1',
      'Rack A',
    )!
    expect(preset.rack?.placements.map((p) => [p.startUnit, p.heightUnits])).toEqual([
      [1, 2],
      [3, 1],
      [4, 3],
    ])
    // Der Rahmen bekommt Luft, mindestens aber 12 HE.
    expect(preset.rack?.totalUnits).toBe(12)
  })

  it('haelt interne Kabel leer — das ist Absicht, kein Verlust', () => {
    // Die Kabel zwischen den markierten Geraeten liegen weiter im Plan; im
    // Rack verkabelt der User im Sub-Canvas. Ausdruecklich festgehalten,
    // damit es niemand fuer denselben Fehler wie #626 haelt.
    const preset = presetFromEquipmentSelection([eq()], 'p1', 'Rack A')!
    expect(preset.cables).toEqual([])
  })

  it('gibt bei leerer Auswahl null zurueck', () => {
    expect(presetFromEquipmentSelection([], 'p1', 'Rack A')).toBeNull()
  })
})

describe('presetFromBlackBoxRack — Rack bearbeiten', () => {
  const blackBox = eq({
    id: 'rack1',
    name: 'Regie 1 (Rack)',
    category: 'Rack',
    rentmanId: 'rm-kombi-1',
    inputs: [port('p1', 'SDI IN 1', 0), port('p2', 'MADI IN', 1)],
    outputs: [port('p3', 'SDI OUT 1', 0)],
    rackInternalSnapshot: {
      totalUnits: 24,
      items: [
        { name: 'ATEM', startUnit: 1, rackUnits: 4, rentmanId: 'rm-atem' },
        { name: 'DirectOut', startUnit: 5, rackUnits: 1, rentmanId: 'rm-do' },
      ],
      cables: [
        { fromItemIndex: 0, fromPortName: 'SDI OUT 2', toItemIndex: 1, toPortName: 'IN', color: '#f00' },
      ],
    },
  } as Partial<EquipmentItem>)

  it('behaelt die Rentman-Ids — die des Racks UND die je Inhalt', () => {
    // Der Snapshot traegt sie ausdruecklich („#335 — Rentman-ID des Inhalts
    // mitschnappen (fuer spaeteren Sync/Export)"), und der Typ verspricht
    // „Bleibt ueber Save/Reload erhalten". Genau der Save/Reload-Weg warf sie
    // weg: einmal bearbeiten und speichern, und die Herkunft war fort.
    const preset = presetFromBlackBoxRack(blackBox, 'p1', 'Regie 1')!
    expect(preset.rack?.rentmanId).toBe('rm-kombi-1')
    expect(preset.items.map((i) => i.rentmanId)).toEqual(['rm-atem', 'rm-do'])
  })

  it('setzt die Ports je Geraet aus den aussen liegenden Ports zusammen', () => {
    const preset = presetFromBlackBoxRack(blackBox, 'p1', 'Regie 1')!
    expect(preset.items[0].inputs.map((p) => p.name)).toEqual(['SDI IN 1'])
    expect(preset.items[0].outputs.map((p) => p.name)).toEqual(['SDI OUT 1'])
    expect(preset.items[1].inputs.map((p) => p.name)).toEqual(['MADI IN'])
    expect(preset.items[1].outputs).toEqual([])
  })

  it('nimmt die internen Kabel und die Lage mit', () => {
    const preset = presetFromBlackBoxRack(blackBox, 'p1', 'Regie 1')!
    expect(preset.rack?.totalUnits).toBe(24)
    expect(preset.rack?.placements).toEqual([
      { itemIndex: 0, startUnit: 1, heightUnits: 4 },
      { itemIndex: 1, startUnit: 5, heightUnits: 1 },
    ])
    expect(preset.cables).toHaveLength(1)
    expect(preset.cables[0].color).toBe('#f00')
  })

  it('setzt keine rentmanId, wo keine ist', () => {
    const ohne = eq({
      id: 'r2',
      rackInternalSnapshot: { totalUnits: 4, items: [{ name: 'X', startUnit: 1, rackUnits: 1 }], cables: [] },
    } as Partial<EquipmentItem>)
    const preset = presetFromBlackBoxRack(ohne, 'p1', 'R2')!
    expect('rentmanId' in (preset.rack ?? {})).toBe(false)
    expect('rentmanId' in preset.items[0]).toBe(false)
  })

  it('gibt ohne Snapshot null zurueck', () => {
    expect(presetFromBlackBoxRack(eq(), 'p1', 'X')).toBeNull()
  })
})

describe('die Ausschluss-Liste bleibt vollstaendig', () => {
  it('deckt jedes Draft-Feld ab, das nicht vom Geraet kommt', () => {
    // Subtraktion statt Aufzaehlung: alles am Draft, was NICHT in der
    // Ausschluss-Liste steht, muss ein Geraete-Feld sein und mitreisen.
    // Kommt ein Feld dazu, faellt dieser Test — und zwar an der Stelle, an
    // der jemand entscheiden MUSS, auf welche Seite es gehoert. Das ist die
    // Umkehrung des Fehlers: ein vergessenes Feld reist mit, statt still
    // liegen zu bleiben.
    const draftKeys = interfaceKeys(draftTypesSrc, 'RackPlacementDraft')
    const notFromEquipment = [...RACK_DRAFT_FIELDS_NOT_FROM_EQUIPMENT]
    const fromEquipment = draftKeys.filter((k) => !notFromEquipment.includes(k))

    // Stand bei Einfuehrung — die Zeugen dieser Aufteilung.
    expect(fromEquipment).toEqual([
      'category',
      'depthMm',
      'frontPanelCrop',
      'frontPanelImageUrl',
      'inputs',
      'isPatchPanel',
      'isRackDevice',
      'isRackShelf',
      'name',
      'outputs',
      'rackUnits',
      'rearPanelCrop',
      'rearPanelImageUrl',
      'rentmanId',
      'stlDataUri',
    ])
    // Und die Ausschluss-Liste enthaelt nichts, was es am Draft nicht gibt.
    expect(notFromEquipment.filter((k) => !draftKeys.includes(k))).toEqual([])
  })
})
