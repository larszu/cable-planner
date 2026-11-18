import { beforeEach, describe, expect, it } from 'vitest'
import type { EquipmentTemplate } from '../src/renderer/types/equipment'

// #1273 — Kategorien im Geraete-Pool loeschen.
const vorlage = (name: string, category: string): EquipmentTemplate =>
  ({ name, category, inputs: [], outputs: [] }) as unknown as EquipmentTemplate

const aufbau = async () => {
  const { useProjectStore } = await import('../src/renderer/store/projectStore')
  useProjectStore.setState({
    customLibrary: [vorlage('Cam', 'Video'), vorlage('Monitor', 'Video > Monitore'), vorlage('Mic', 'Audio')],
    knownCategories: ['Video', 'Video > Monitore', 'Audio', 'Leer'],
    categoryTranslations: { Video: { de: 'Video', en: 'Video' } },
  })
  return useProjectStore
}

describe('Kategorie loeschen (#1273)', () => {
  beforeEach(() => localStorage.clear())

  it('behaelt die Geraete ohne Kategorie und nimmt Unterkategorien mit', async () => {
    const store = await aufbau()
    store.getState().removeCustomCategory('Video', 'behalten')
    const s = store.getState()
    expect(s.knownCategories).toEqual(['Audio', 'Leer'])
    expect(s.customLibrary.map((t) => [t.name, t.category])).toEqual([['Cam', ''], ['Monitor', ''], ['Mic', 'Audio']])
    expect(s.categoryTranslations).toEqual({})
  })

  it('loescht die Geraete auf Wunsch mit', async () => {
    const store = await aufbau()
    store.getState().removeCustomCategory('Video', 'mitloeschen')
    expect(store.getState().customLibrary.map((t) => t.name)).toEqual(['Mic'])
  })

  it('loescht eine leere Kategorie', async () => {
    const store = await aufbau()
    store.getState().removeCustomCategory('Leer', 'behalten')
    expect(store.getState().knownCategories).toEqual(['Video', 'Video > Monitore', 'Audio'])
    expect(store.getState().customLibrary).toHaveLength(3)
  })
})
