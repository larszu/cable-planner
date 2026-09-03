import { describe, expect, it, beforeEach } from 'vitest'
import appSrc from '../src/renderer/App.tsx?raw'
import librarySyncSrc from '../src/renderer/lib/librarySync.ts?raw'
import dictsSrc from '../src/renderer/lib/i18n/dicts.ts?raw'
import type { EquipmentItem, EquipmentTemplate } from '../src/renderer/types/equipment'

// ADR-005, Inkrement 4, Regeln 1 und 2 — der Update-Prompt beim Projekt-Start.
//
// Liegt im Bibliotheks-Ordner eine neuere Fassung eines Geraete-Templates,
// fragt der Prompt einmal und aktualisiert dann ALLE veralteten Geraete.
// Er lief dabei durch `applyDeviceTemplateUpdate` — eine zweite, aermere
// Fassung des Template-Tauschs, die das TEMPLATE als Basis unter das Geraet
// legte und nur id/x/y/name/notes rettete.
//
// Zwei Folgen, beide nachgemessen:
//
//   1. Die Template-Ports ersetzten die des Geraets MITSAMT ihren Ids, ohne
//      dass irgendwer die Kabel nachzog. Nach einem Klick zeigten alle Kabel
//      des Geraets auf Port-Ids, die es nicht mehr gab — sie blieben im
//      Projekt, ohne Anschluss.
//   2. Traegt das Template eine Netz-Identitaet — und das tut es, denn
//      `templateFromEquipment` speichert IP, Benutzer und Passwort —, dann
//      ueberschrieb sie die des platzierten Geraets. Ein TYP-Update setzte
//      damit Adresse und Zugangsdaten EINER konkreten Maschine auf die des
//      Vorlagen-Geraets.
//
// `replaceEquipmentWithTemplate` (#314) macht denselben Tausch seit jeher
// richtig. Der Prompt geht jetzt durch diese eine Aktion.

const atem = (): EquipmentItem =>
  ({
    id: 'e1', name: 'ATEM Regie', category: 'Mischer',
    inputs: [{ id: 'in-alt', name: 'SDI 1', type: 'port', connectorType: 'BNC' }],
    outputs: [{ id: 'out-alt', name: 'PGM', type: 'port', connectorType: 'BNC' }],
    x: 10, y: 20, width: 240, height: 80,
    ipAddress: '10.0.0.5', username: 'admin', password: 'geheim',
    serialNumber: 'SN-4711', notes: 'Regie links', nodeColor: '#ff0000',
  }) as unknown as EquipmentItem

const cam = (): EquipmentItem =>
  ({
    id: 'e2', name: 'Kamera 1', category: 'Kamera',
    inputs: [],
    outputs: [{ id: 'cam-out', name: 'SDI OUT', type: 'port', connectorType: 'BNC' }],
    x: 400, y: 0, width: 240, height: 80,
  }) as unknown as EquipmentItem

const cable = () =>
  ({
    id: 'c1', name: 'CAM1->ATEM', type: 'SDI', length: 20, color: '#fff',
    fromEquipmentId: 'e2', fromPortId: 'cam-out',
    toEquipmentId: 'e1', toPortId: 'in-alt', notes: '',
  })

/** Das Template, wie es der Bibliotheks-Ordner liefert: eigene Port-Ids, und
 *  eine Netz-Identitaet, weil jemand ein konfiguriertes Geraet gespeichert hat. */
const neueVorlage = (): EquipmentTemplate =>
  ({
    name: 'ATEM 4 M/E', category: 'Videomischer',
    inputs: [{ id: 'in-neu', name: 'SDI 1', type: 'port', connectorType: 'BNC' }],
    outputs: [{ id: 'out-neu', name: 'PGM', type: 'port', connectorType: 'BNC' }],
    ipAddress: '192.168.1.10', username: 'root', password: 'werks',
    rackUnits: 4, isRackDevice: true,
  }) as unknown as EquipmentTemplate

const runUpdate = async () => {
  const { useProjectStore } = await import('../src/renderer/store/projectStore')
  useProjectStore.setState((s) => ({
    project: { ...s.project, equipment: [atem(), cam()], cables: [cable()] as never },
  }))
  useProjectStore.getState().replaceEquipmentWithTemplate('e1', neueVorlage())
  return useProjectStore.getState().project
}

describe('Library-Update — das Kabel bleibt am Geraet', () => {
  beforeEach(() => localStorage.clear())

  it('zieht das Kabel auf den neuen Port nach', async () => {
    const p = await runUpdate()
    const eq = p.equipment.find((e) => e.id === 'e1')!
    const c = p.cables[0] as unknown as { toPortId: string }
    const portIds = [...eq.inputs, ...eq.outputs].map((x) => x.id)
    expect(p.cables).toHaveLength(1)
    expect(portIds).toContain(c.toPortId)
  })

  it('uebernimmt die Typ-Angaben aus der Vorlage', async () => {
    const p = await runUpdate()
    const eq = p.equipment.find((e) => e.id === 'e1')!
    expect(eq.category).toBe('Videomischer')
    expect(eq.rackUnits).toBe(4)
    expect(eq.isRackDevice).toBe(true)
  })

  it('laesst die Netz-Identitaet der konkreten Maschine in Ruhe', async () => {
    // Das ist der Kern von Regel 2: die Vorlage beschreibt den TYP, nicht
    // diese eine Maschine. Ihre Adresse und ihre Zugangsdaten sind nicht die
    // des Vorlagen-Geraets.
    const p = await runUpdate()
    const eq = p.equipment.find((e) => e.id === 'e1')! as unknown as Record<string, unknown>
    expect(eq.ipAddress).toBe('10.0.0.5')
    expect(eq.username).toBe('admin')
    expect(eq.password).toBe('geheim')
    expect(eq.serialNumber).toBe('SN-4711')
  })

  it('behaelt Name, Notiz, Position und Farbe', async () => {
    const p = await runUpdate()
    const eq = p.equipment.find((e) => e.id === 'e1')!
    expect(eq.name).toBe('ATEM Regie')
    expect(eq.notes).toBe('Regie links')
    expect([eq.x, eq.y]).toEqual([10, 20])
    expect(eq.nodeColor).toBe('#ff0000')
  })
})

describe('der Prompt geht durch die richtige Aktion und sagt, was passiert', () => {
  it('ruft replaceEquipmentWithTemplate statt der aermeren Fassung', () => {
    const src = appSrc.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '')
    expect(src).toContain('freshState.replaceEquipmentWithTemplate(')
    expect(src).not.toContain('applyDeviceTemplateUpdate(oldEq')
  })

  it('die aermere Fassung existiert nicht mehr', () => {
    expect(librarySyncSrc).not.toContain('export const applyDeviceTemplateUpdate')
  })

  it('stempelt das Template, sonst meldet der naechste Start dasselbe Geraet', () => {
    // Ohne den Stempel landet der neue fileVersion-Stand nicht am libraryRef
    // und findOutdatedEquipment fuehrt das Geraet beim naechsten Oeffnen
    // wieder als veraltet.
    expect(appSrc).toContain('stampDeviceLibraryRef(newTemplate)')
  })

  it('nennt die Kabel-Folge, bevor geklickt wird', () => {
    // Ein Kabel, das keinen passenden Port mehr findet, wird entfernt. Das
    // muss vor dem Klick dastehen, nicht danach.
    expect(appSrc).toContain('Findet ein Kabel keinen passenden Port mehr, wird es entfernt.')
    expect(dictsSrc).toContain('A cable that no longer finds a matching port is removed.')
  })

  it('behauptet nicht mehr nur „Namen + Notizen bleiben"', () => {
    expect(appSrc).not.toContain('(Geräte-Namen + Notizen bleiben erhalten.')
    expect(dictsSrc).not.toContain('(Device names + notes are kept.')
  })
})
