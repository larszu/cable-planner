import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectStore } from '../src/renderer/store/projectStore'

// device-identity-concept, „Offen": eigene Vorlagen bekommen eine selbst
// geminte Geraetetyp-Id — und das Geraet, aus dem sie entstanden, dieselbe.
describe('eigene Vorlage bekommt eine Geraetetyp-Id', () => {
  beforeEach(() => {
    useProjectStore.getState().addEquipment({
      name: 'Eigenbau-Kiste 906', category: 'Other', inputs: [], outputs: [], x: 0, y: 0, width: 200, height: 100,
    })
  })

  const geraet = () => useProjectStore.getState().project.equipment.find((e) => e.name === 'Eigenbau-Kiste 906')!
  const vorlage = (name: string) => useProjectStore.getState().customLibrary.find((t) => t.name === name)

  it('mintet sie beim Speichern und schreibt sie ans Geraet', () => {
    const g = geraet()
    expect(g.deviceTypeId).toBeUndefined()
    useProjectStore.getState().saveEquipmentAsTemplate(g.id)
    const id = vorlage('Eigenbau-Kiste 906')?.deviceTypeId
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(geraet().deviceTypeId).toBe(id)
    // Ueberschreiben aendert die Identitaet nicht.
    useProjectStore.getState().saveEquipmentAsTemplate(geraet().id)
    expect(vorlage('Eigenbau-Kiste 906')?.deviceTypeId).toBe(id)
  })

  it('ein Katalog-Typ bleibt Katalog-Typ', () => {
    const g = geraet()
    useProjectStore.getState().updateEquipment(g.id, { deviceTypeId: 'dt-katalog' })
    useProjectStore.getState().saveEquipmentAsNewTemplate(g.id, 'Kiste Variante 906', 'Other')
    expect(vorlage('Kiste Variante 906')?.deviceTypeId).toBe('dt-katalog')
  })
})
