import { describe, expect, it } from 'vitest'
import type { CablePlannerProject } from '../src/renderer/types/project'

// ADR-003 (Bestaetigter Zustand statt gesendeter Befehl), Inkrement 1.
//
// Der Zaehler hinter der Spalte "Bereits gesendet" hiess `lastSyncedQty` und
// wurde beim Import mit der im Dialog editierbaren *Planmenge* vorbelegt. Beides
// zusammen behauptete eine Abstimmung mit Rentman, die nie stattgefunden hat.
// Getestet wird deshalb genau das, was ein Projektfile ueberlebt: dass der alte
// Schluessel uebernommen und entsorgt wird und der Wert dabei nicht kippt.

const project = (
  map: Record<string, unknown> | undefined,
): CablePlannerProject =>
  ({
    metadata: {
      name: 'T',
      description: '',
      createdAt: '',
      updatedAt: '',
      ...(map ? { rentmanCableMap: map } : {}),
    },
    equipment: [],
    cables: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
  }) as unknown as CablePlannerProject

const loadAndRead = async (map: Record<string, unknown> | undefined) => {
  const { useProjectStore } = await import('../src/renderer/store/projectStore')
  useProjectStore.getState().loadProject(project(map))
  return useProjectStore.getState().project.metadata.rentmanCableMap
}

describe('rentmanCableMap — Migration lastSyncedQty -> lastSentQty (ADR-003)', () => {
  it('uebernimmt den alten Schluessel und entsorgt ihn', async () => {
    const healed = await loadAndRead({
      'BNC|10': { rentmanEquipmentId: 'r1', lastSyncedQty: 12 },
    })
    expect(healed?.['BNC|10']).toEqual({ rentmanEquipmentId: 'r1', lastSentQty: 12 })
    expect('lastSyncedQty' in (healed?.['BNC|10'] ?? {})).toBe(false)
  })

  it('laesst einen bereits neuen Eintrag unveraendert', async () => {
    const healed = await loadAndRead({
      'BNC|10': { rentmanEquipmentId: 'r1', lastSentQty: 7 },
    })
    expect(healed?.['BNC|10']).toEqual({ rentmanEquipmentId: 'r1', lastSentQty: 7 })
  })

  it('behaelt den neuen Wert, wenn ein Projekt beide traegt', async () => {
    // Kann nur entstehen, wenn eine neuere Version geschrieben und eine
    // aeltere danach nichts mehr angefasst hat — der neue Wert ist der
    // juengere.
    const healed = await loadAndRead({
      'BNC|10': { rentmanEquipmentId: 'r1', lastSentQty: 7, lastSyncedQty: 12 },
    })
    expect(healed?.['BNC|10']).toEqual({ rentmanEquipmentId: 'r1', lastSentQty: 7 })
  })

  it('haelt eine Zuordnung ohne Menge mengenlos statt sie auf 0 zu setzen', async () => {
    // 0 hiesse "nichts gesendet" und wuerde die naechste Differenz auf die
    // volle Menge stellen. Kein Wert heisst "unbekannt" — der Export-Dialog
    // faellt selbst auf 0 zurueck, aber das Projektfile behauptet es nicht.
    const healed = await loadAndRead({ 'BNC|10': { rentmanEquipmentId: 'r1' } })
    expect(healed?.['BNC|10']).toEqual({ rentmanEquipmentId: 'r1' })
  })

  it('wirft kaputte Eintraege weg, statt am Load zu scheitern', async () => {
    const healed = await loadAndRead({
      'BNC|10': null,
      'BNC|20': { rentmanEquipmentId: 'r2', lastSyncedQty: Number.NaN },
    })
    expect(healed?.['BNC|10']).toBeUndefined()
    expect(healed?.['BNC|20']).toEqual({ rentmanEquipmentId: 'r2' })
  })

  it('laesst ein Projekt ohne Zuordnung in Ruhe', async () => {
    expect(await loadAndRead(undefined)).toBeUndefined()
  })
})
