import { describe, expect, it, beforeEach } from 'vitest'
import { itemFromEquipment } from '../src/renderer/lib/rackPreset'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ADR-005, Inkrement 4, Regel 1 — die fuenfte Aufzaehlung derselben
// Umwandlung, und sie war die aermste.
//
// „N markierte Geraete als Gruppe speichern" nannte zwoelf Felder von rund
// neunzig. `placeGroupPreset` spreizt den Eintrag spaeter direkt auf das neue
// EquipmentItem — was beim Speichern nicht aufgezaehlt war, ist beim
// Platzieren endgueltig weg.
//
// Zwei Verluste stechen heraus:
//   - `deviceTypeId`: die Katalog-Identitaet aus ADR-002. Ohne sie faellt der
//     naechste Import auf Namens-Heuristiken zurueck — aus einer
//     Datenblatt-Tatsache wird wieder ein Regex-Treffer. `templateFromEquipment`
//     traegt sie mit genau diesem Hinweis; beide Preset-Wege taten es nicht.
//   - Die Rack-Daten: ein 4-HE-Geraet mit STL-Modell kam als Gruppe gespeichert
//     ohne Rack-Flag, ohne Hoehe, ohne Tiefe und ohne Geometrie zurueck.

const eq = (over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id: 'e1',
    name: 'ATEM 4 M/E',
    category: 'Mischer',
    inputs: [{ id: 'i1', name: 'SDI 1', type: 'port', connectorType: 'BNC' }],
    outputs: [],
    x: 100,
    y: 200,
    width: 240,
    height: 80,
    ...over,
  }) as unknown as EquipmentItem

describe('itemFromEquipment — die gemeinsame Feldliste', () => {
  it('traegt die Katalog-Identitaet (ADR-002)', () => {
    expect(itemFromEquipment(eq({ deviceTypeId: 'dt-atem-4me' })).deviceTypeId).toBe('dt-atem-4me')
  })

  it('traegt die Rack-Daten — der Gruppen-Weg verlor sie', () => {
    const item = itemFromEquipment(
      eq({
        isRackDevice: true,
        rackUnits: 4,
        depthMm: 800,
        stlDataUri: 'data:model/stl;base64,AAAA',
        isPatchPanel: true,
      } as Partial<EquipmentItem>),
    )
    expect(item.isRackDevice).toBe(true)
    expect(item.rackUnits).toBe(4)
    expect(item.depthMm).toBe(800)
    expect(item.stlDataUri).toBe('data:model/stl;base64,AAAA')
    expect(item.isPatchPanel).toBe(true)
  })

  it('traegt Notiz, IP, Aufloesung und Display-Groesse — der Rack-Weg verlor sie', () => {
    const item = itemFromEquipment(
      eq({
        notes: 'Regie links',
        ipAddress: '192.168.1.10',
        resolution: '1080p60',
        displaySizeInch: 24,
      } as Partial<EquipmentItem>),
    )
    expect(item.notes).toBe('Regie links')
    expect(item.ipAddress).toBe('192.168.1.10')
    expect(item.resolution).toBe('1080p60')
    expect(item.displaySizeInch).toBe(24)
  })

  it('traegt die Handels-Felder ausdruecklich NICHT', () => {
    // Keine der bisherigen Aufzaehlungen trug sie. Ob sie reisen sollen, ist
    // die offene Modell-/Instanz-Frage — hier wird sie nicht nebenbei
    // beantwortet.
    const item = itemFromEquipment(
      eq({ priceEUR: 12000, rentPricePerDay: 250, supplier: 'AV GmbH' } as Partial<EquipmentItem>),
    ) as Record<string, unknown>
    expect(item.priceEUR).toBeUndefined()
    expect(item.rentPricePerDay).toBeUndefined()
    expect(item.supplier).toBeUndefined()
  })
})

describe('saveGroupPreset — der Weg, auf dem es wirklich passiert', () => {
  beforeEach(() => localStorage.clear())

  const save = async (items: EquipmentItem[]) => {
    const { useProjectStore } = await import('../src/renderer/store/projectStore')
    useProjectStore.setState({ groupPresets: [] })
    useProjectStore.setState((s) => ({ project: { ...s.project, equipment: items, cables: [] } }))
    useProjectStore.getState().saveGroupPreset('Regie-Block', items.map((i) => i.id))
    return useProjectStore.getState().groupPresets.find((p) => p.name === 'Regie-Block')
  }

  it('die gespeicherte Gruppe behaelt Katalog-Identitaet und Rack-Daten', async () => {
    const preset = await save([
      eq({ id: 'a', deviceTypeId: 'dt-atem', isRackDevice: true, rackUnits: 4, depthMm: 800 } as Partial<EquipmentItem>),
      eq({ id: 'b', name: 'Router', x: 400, deviceTypeId: 'dt-vhub' } as Partial<EquipmentItem>),
    ])
    expect(preset).toBeDefined()
    expect(preset!.items.map((i) => i.deviceTypeId)).toEqual(['dt-atem', 'dt-vhub'])
    expect(preset!.items[0].rackUnits).toBe(4)
    expect(preset!.items[0].depthMm).toBe(800)
  })

  it('die Anordnung auf dem Canvas bleibt — dafuer sind die Versaetze da', async () => {
    const preset = await save([
      eq({ id: 'a', x: 100, y: 200 }),
      eq({ id: 'b', name: 'Router', x: 400, y: 260 }),
    ])
    expect(preset!.items.map((i) => [i.offsetX, i.offsetY])).toEqual([
      [0, 0],
      [300, 60],
    ])
  })

  it('speichert weiterhin nichts bei weniger als zwei Geraeten', async () => {
    expect(await save([eq()])).toBeUndefined()
  })
})
