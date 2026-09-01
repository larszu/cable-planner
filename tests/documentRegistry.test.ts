import { describe, expect, it } from 'vitest'
import {
  DOCUMENT_STANDS,
  DOCUMENT_LABELS,
  currentStand,
  findByStand,
} from '../src/renderer/lib/documentRegistry'
import { docStandStatus, parseDocQrPayload, buildDocQrPayload } from '../src/renderer/lib/qrPayload'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ADR-004, Inkrement 2 — die andere Haelfte des Stempels: denselben Stand heute
// ausrechnen koennen. Ohne sie ist der Code auf dem Blatt ein Bild.

const eq = (id: string, name: string, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id,
    name,
    category: 'Sonstiges',
    inputs: [{ id: `${id}-in`, name: 'IN 1', type: 'port', connectorType: 'BNC' }],
    outputs: [{ id: `${id}-out`, name: 'OUT 1', type: 'port', connectorType: 'BNC' }],
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    ...over,
  }) as unknown as EquipmentItem

const cable = (id: string, over: Partial<Cable> = {}): Cable =>
  ({
    id,
    name: `Kabel ${id}`,
    type: 'SDI',
    length: 10,
    color: '#fff',
    fromEquipmentId: 'A',
    fromPortId: 'A-out',
    toEquipmentId: 'B',
    toPortId: 'B-in',
    notes: '',
    ...over,
  }) as Cable

const project = (over: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Testanlage', description: '', createdAt: '', updatedAt: '' },
    equipment: [eq('A', 'Kamera 1'), eq('B', 'Switcher')],
    cables: [cable('c1')],
    canvasState: { x: 0, y: 0, zoom: 1 },
    ...over,
  }) as CablePlannerProject

describe('DOCUMENT_STANDS', () => {
  it('deckt jeden Bezeichner mit einem lesbaren Namen ab', () => {
    for (const id of Object.keys(DOCUMENT_STANDS)) {
      expect(DOCUMENT_LABELS[id], `Label fehlt fuer ${id}`).toBeTruthy()
    }
  })

  it('liefert je Dokument acht Hex-Zeichen', () => {
    const p = project()
    for (const id of Object.keys(DOCUMENT_STANDS)) {
      expect(currentStand(id, p)).toMatch(/^[0-9a-f]{8}$/)
    }
  })

  it('fuehrt kabel-bom bewusst NICHT', () => {
    // Der Inhalt haengt vom Reserve-Aufschlag ab, den der Stempel nicht traegt.
    // Ein Vergleich gegen einen anders gerechneten Wert wuerde jedes Blatt als
    // veraltet ausweisen — „nicht pruefbar" ist die ehrlichere Antwort.
    expect(currentStand('kabel-bom', project())).toBeUndefined()
    expect(docStandStatus({ docId: 'kabel-bom', stand: 'aaaaaaaa' }, undefined)).toBe('unknown')
  })

  it('kennt ein unbekanntes Dokument nicht, statt zu raten', () => {
    expect(currentStand('gibt-es-nicht', project())).toBeUndefined()
  })
})

describe('Der ganze Weg: drucken, scannen, vergleichen', () => {
  it('erkennt das eigene Blatt als aktuell', () => {
    const p = project()
    const uri = buildDocQrPayload('pull-liste', currentStand('pull-liste', p)!)
    const ref = parseDocQrPayload(uri)!
    expect(docStandStatus(ref, currentStand('pull-liste', p))).toBe('current')
  })

  it('erkennt das Blatt nach einer Aenderung als veraltet', () => {
    const before = project()
    const uri = buildDocQrPayload('pull-liste', currentStand('pull-liste', before)!)
    const after = project({ cables: [cable('c1', { length: 25 })] })
    expect(docStandStatus(parseDocQrPayload(uri)!, currentStand('pull-liste', after))).toBe('stale')
  })

  it('haelt das Blatt aktuell, wenn sich nur etwas ausserhalb des Dokuments aenderte', () => {
    const before = project()
    const uri = buildDocQrPayload('pull-liste', currentStand('pull-liste', before)!)
    const moved = project({ equipment: [eq('A', 'Kamera 1', { x: 700 }), eq('B', 'Switcher')] })
    expect(currentStand('plan', moved)).not.toBe(currentStand('plan', before))
    expect(docStandStatus(parseDocQrPayload(uri)!, currentStand('pull-liste', moved))).toBe(
      'current',
    )
  })
})

describe('findByStand — der Rueckweg ohne Kamera', () => {
  it('findet das Dokument zu acht abgetippten Zeichen', () => {
    const p = project()
    const stand = currentStand('asset-register', p)!
    expect(findByStand(stand, p)?.docId).toBe('asset-register')
    expect(findByStand(`#${stand.toUpperCase()}`, p)?.label).toBe('Asset-Register')
  })

  it('findet nichts, wenn der Stand zu keinem aktuellen Blatt gehoert', () => {
    expect(findByStand('00000000', project())).toBeNull()
  })

  it('nimmt nur echte Fingerabdruecke, nicht jeden Text', () => {
    // Sonst wuerde eine Kabelnummer wie "C-0001" hier landen statt im
    // Datensatz-Lookup.
    expect(findByStand('C-0001', project())).toBeNull()
    expect(findByStand('', project())).toBeNull()
    expect(findByStand('zzzzzzzz', project())).toBeNull()
  })
})
