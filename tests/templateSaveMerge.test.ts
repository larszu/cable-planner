import { describe, expect, it, beforeEach } from 'vitest'
import type { EquipmentItem, EquipmentTemplate } from '../src/renderer/types/equipment'

// ADR-005, Inkrement 4, Regel 2 — der aermere Nachbau darf nicht loeschen.
//
// „Als Standard-Vorlage ueberschreiben" baut den Bibliothekseintrag aus
// `templateFromEquipment` NEU — 23 Felder. Die Bibliothek traegt aber mehr:
// Rack-Hoehe und Rack-Flag, Front-/Rear-Foto samt Zuschnitt, Tiefe, Gewicht,
// Leistung, Aufloesung, NetBox-Pfad. Alles, was ein Rentman- oder
// NetBox-Import eingetragen hat.
//
// Der alte Stand hat den vorhandenen Eintrag herausgefiltert und den Nachbau
// angehaengt. Ein aus Rentman importiertes Rack-Geraet war damit nach einem
// Klick kein Rack-Geraet mehr — und konnte in kein Rack.
//
// Eine Datei weiter fuehrt `upsertCachedRentmanTemplate` genau diese Regel
// seit ADR-005 fuer den CACHE, mit derselben Begruendung. Die Bibliothek
// selbst hatte sie nie.

const item = (over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id: 'e1',
    name: 'ATEM Mini Extreme',
    category: 'Videomischer',
    inputs: [{ id: 'in1', name: 'SDI 1', type: 'port', connectorType: 'BNC' }],
    outputs: [],
    x: 10,
    y: 20,
    width: 240,
    height: 80,
    ...over,
  }) as unknown as EquipmentItem

/** Ein Eintrag, wie ihn ein Rentman-/NetBox-Import hinterlaesst. */
const richTemplate = (): EquipmentTemplate =>
  ({
    name: 'ATEM Mini Extreme',
    category: 'Videomischer',
    inputs: [],
    outputs: [],
    isRackDevice: true,
    rackUnits: 2,
    depthMm: 480,
    weightKg: 12.4,
    powerWatts: 350,
    resolution: '1080p60',
    displaySizeInch: 7,
    netboxPath: 'blackmagic/atem-mini-extreme',
    frontPanelImageUrl: 'data:image/png;base64,AAAA',
    frontPanelCrop: { x: 0, y: 0, width: 1, height: 1 },
    ipAddress: '192.168.1.10',
  }) as unknown as EquipmentTemplate

const saveOver = async (existing: EquipmentTemplate, placed: EquipmentItem) => {
  const { useProjectStore } = await import('../src/renderer/store/projectStore')
  useProjectStore.setState({ customLibrary: [existing] })
  useProjectStore.setState((s) => ({ project: { ...s.project, equipment: [placed] } }))
  useProjectStore.getState().saveEquipmentAsTemplate(placed.id)
  return useProjectStore.getState().customLibrary
}

describe('saveEquipmentAsTemplate — was der Eintrag schon wusste, bleibt', () => {
  beforeEach(() => localStorage.clear())

  it('behaelt Rack-Flag und Rack-Hoehe', async () => {
    // Der Kern: ein Rack-Geraet bleibt eines. Sonst faellt es aus jedem Rack.
    const lib = await saveOver(richTemplate(), item())
    const t = lib.find((x) => x.name === 'ATEM Mini Extreme')!
    expect(t.isRackDevice).toBe(true)
    expect(t.rackUnits).toBe(2)
  })

  it('behaelt die Engineering-Daten', async () => {
    const lib = await saveOver(richTemplate(), item())
    const t = lib.find((x) => x.name === 'ATEM Mini Extreme')!
    expect(t.depthMm).toBe(480)
    expect(t.weightKg).toBe(12.4)
    expect(t.powerWatts).toBe(350)
    expect(t.resolution).toBe('1080p60')
    expect(t.displaySizeInch).toBe(7)
  })

  it('behaelt Foto, Zuschnitt und NetBox-Herkunft', async () => {
    const lib = await saveOver(richTemplate(), item())
    const t = lib.find((x) => x.name === 'ATEM Mini Extreme')!
    expect(t.frontPanelImageUrl).toBe('data:image/png;base64,AAAA')
    expect(t.frontPanelCrop).toEqual({ x: 0, y: 0, width: 1, height: 1 })
    expect(t.netboxPath).toBe('blackmagic/atem-mini-extreme')
  })

  it('das Geraet gewinnt weiterhin, wo es etwas SAGT', async () => {
    // Der Sinn des Knopfes bleibt: was am Geraet steht, wird zur Vorlage.
    const lib = await saveOver(richTemplate(), item({ ipAddress: '10.0.0.5' }))
    const t = lib.find((x) => x.name === 'ATEM Mini Extreme')!
    expect(t.ipAddress).toBe('10.0.0.5')
    expect(t.inputs).toHaveLength(1)
  })

  it('ein geleertes Feld ist eine Aussage und loescht', async () => {
    // Die Eingabefelder schreiben `event.target.value`, ein geleertes Feld
    // ist also '' und nicht undefined — der Unterschied ist der ganze Punkt.
    const lib = await saveOver(richTemplate(), item({ ipAddress: '' }))
    expect(lib.find((x) => x.name === 'ATEM Mini Extreme')!.ipAddress).toBe('')
  })

  it('haelt den Eintrag an seiner Stelle in der Bibliothek', async () => {
    const { useProjectStore } = await import('../src/renderer/store/projectStore')
    const other = { name: 'Zzz Letzte', category: 'Sonstiges', inputs: [], outputs: [] } as unknown as EquipmentTemplate
    useProjectStore.setState({ customLibrary: [richTemplate(), other] })
    useProjectStore.setState((s) => ({ project: { ...s.project, equipment: [item()] } }))
    useProjectStore.getState().saveEquipmentAsTemplate('e1')
    expect(useProjectStore.getState().customLibrary.map((t) => t.name)).toEqual([
      'ATEM Mini Extreme',
      'Zzz Letzte',
    ])
  })

  it('legt ohne vorhandenen Eintrag weiterhin einfach an', async () => {
    const { useProjectStore } = await import('../src/renderer/store/projectStore')
    useProjectStore.setState({ customLibrary: [] })
    useProjectStore.setState((s) => ({ project: { ...s.project, equipment: [item()] } }))
    useProjectStore.getState().saveEquipmentAsTemplate('e1')
    const lib = useProjectStore.getState().customLibrary
    expect(lib).toHaveLength(1)
    expect(lib[0].name).toBe('ATEM Mini Extreme')
    expect(lib[0].isRackDevice).toBeUndefined()
  })
})
