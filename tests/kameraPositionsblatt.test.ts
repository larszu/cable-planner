import { describe, expect, it } from 'vitest'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { EquipmentItem, KameraPreset, Port } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'
import {
  kameraPositionen,
  kameraPositionsblattHtml,
  kameraPositionsblattStandTable,
} from '../src/renderer/lib/kameraPositionsblatt'
import { abgleichKameras, type CameraListExchange } from '../src/renderer/lib/multicamCameraImport'
import { DOCUMENT_LABELS, DOCUMENT_STANDS } from '../src/renderer/lib/documentRegistry'

// ---------------------------------------------------------------------------
// Kamera-Positionsblatt: Höhe, Ausrichtung, Optik und PTZ-Presets aus dem
// Kameraplan (camera-list v3), dazu Raum und Mischer-Eingang aus diesem Plan.
// ---------------------------------------------------------------------------

const port = (id: string, name: string): Port => ({ id, name, type: 'port', connectorType: 'BNC' }) as Port

const preset = (nummer: number, over: Partial<KameraPreset> = {}): KameraPreset => ({
  nummer,
  name: `Shot ${nummer}`,
  panGrad: 10,
  neigungGrad: -5,
  brennweiteMm: 50,
  fokusM: 8,
  gespeichertAm: '2026-09-06T10:00:00Z',
  ...over,
})

const plan = (): CablePlannerProject => {
  const ptz = {
    id: 'ptz',
    name: 'PTZ 1',
    category: 'Cameras',
    inputs: [],
    outputs: [port('p-sdi', 'SDI Out')],
    x: 20,
    y: 20,
    width: 40,
    height: 40,
    multicamId: 'vc1',
    sourceIdentityId: 'r1',
    optik: { objektivModell: 'Zoom 20x', brennweiteMinMm: 4.4, brennweiteMaxMm: 88, brennweiteMm: 35, hoeheM: 3.2, panGrad: 90, neigungGrad: -8 },
    kameraPresets: [preset(7, { name: 'Publikum' }), preset(3, { name: 'Pult', segment: 'Begrüßung' })],
  } as unknown as EquipmentItem
  const atem = {
    id: 'atem',
    name: 'ATEM Mini',
    category: 'Video',
    inputs: [port('a1', 'In 1'), port('a2', 'In 2')],
    outputs: [],
    x: 420,
    y: 20,
    width: 40,
    height: 40,
  } as unknown as EquipmentItem
  const monitor = { id: 'mon', name: 'Monitor', category: 'Video', inputs: [], outputs: [], x: 0, y: 0, width: 1, height: 1 } as unknown as EquipmentItem
  return {
    metadata: { name: 'Haus', createdAt: '', updatedAt: '' },
    equipment: [ptz, atem, monitor],
    cables: [{ id: 'V-1', cableNumber: 'V-1', fromEquipmentId: 'ptz', fromPortId: 'p-sdi', toEquipmentId: 'atem', toPortId: 'a2' } as Cable],
    locations: [{ id: 's', name: 'Saal', x: 0, y: 0, width: 300, height: 300, color: '#000', floor: 'EG' }],
    sourceIdentities: [{ id: 'r1', name: 'Kamera 1' }],
    canvasState: { x: 0, y: 0, zoom: 1 },
  } as unknown as CablePlannerProject
}

describe('kameraPositionen', () => {
  it('führt nur Kameras aus dem Kameraplan, mit Raum, Rolle, Mischer-Eingang und Presets nach Nummer', () => {
    const [k, ...rest] = kameraPositionen(plan())
    expect(rest).toHaveLength(0)
    expect(k).toMatchObject({
      name: 'PTZ 1',
      rolle: 'Kamera 1',
      standort: 'Saal (EG)',
      hoeheM: 3.2,
      panGrad: 90,
      neigungGrad: -8,
      brennweiteMm: 35,
      mischerEingaenge: [{ mischer: 'ATEM Mini', eingang: 2 }],
    })
    expect(k.presets.map((p) => p.nummer)).toEqual([3, 7])
  })
})

describe('das Blatt', () => {
  it('druckt die Presets mit ihrem Stand und sagt, dass kein Abgleich stattfand', () => {
    const html = kameraPositionsblattHtml(plan(), { titel: 'T', stempel: 'Haus · #1' })
    expect(html).toContain('<td>3</td><td>Pult</td><td>Begrüßung</td><td>10°</td><td>-5°</td><td>50 mm</td><td>8 m</td><td>2026-09-06</td>')
    expect(html).toContain('this program speaks no camera protocol')
    expect(html).toContain('ATEM Mini, input 2')
    expect(html).toContain('pan 90°, tilt -8°')
    expect(html).toContain('Haus · #1')
  })

  it('ein geändertes Preset veraltet das Blatt', () => {
    const a = plan()
    const b = plan()
    b.equipment[0] = { ...b.equipment[0], kameraPresets: [preset(3, { panGrad: 11 })] }
    expect(DOCUMENT_STANDS['kamera-positionen'](b)).not.toBe(DOCUMENT_STANDS['kamera-positionen'](a))
    expect(DOCUMENT_LABELS['kamera-positionen']).toBe('Kamera-Positionsblatt')
    expect(kameraPositionsblattStandTable(a).headers).toEqual(['Gerät', 'Feld', 'Wert'])
  })
})

describe('Abgleich mit dem Kameraplan', () => {
  const liste = (formatVersion: 2 | 3, presets?: unknown[]): CameraListExchange =>
    ({
      kind: 'camera-list',
      formatVersion,
      app: 'multicam-planner',
      appVersion: '1',
      exportedAt: 't',
      cameras: [
        {
          id: 'vc1',
          label: 'PTZ 1',
          ...(presets ? { presets } : {}),
        },
      ],
    }) as CameraListExchange

  const bestand = () => [{ ...plan().equipment[0], optik: undefined }] as EquipmentItem[]

  it('eine v2-Liste lässt vorhandene Presets stehen — sie sagt zu ihnen nichts', () => {
    const r = abgleichKameras(bestand(), liste(2))
    const patch = r.aktualisiert.find((x) => x.id === 'ptz')?.patch ?? {}
    expect(patch).not.toHaveProperty('kameraPresets')
  })

  it('eine v3-Liste führt die Presets nach, auch wenn sie keine mehr hat', () => {
    const neu = abgleichKameras(bestand(), liste(3, [
      { number: 1, name: 'Weit', pan: 0, tilt: 0, focalMm: 4.4, focusM: 20, savedAt: '2026-09-27T09:00:00Z' },
    ]))
    expect(neu.aktualisiert.find((x) => x.id === 'ptz')!.patch.kameraPresets).toEqual([
      { nummer: 1, name: 'Weit', panGrad: 0, neigungGrad: 0, brennweiteMm: 4.4, fokusM: 20, gespeichertAm: '2026-09-27T09:00:00Z' },
    ])
    const leer = abgleichKameras(bestand(), liste(3))
    const patch = leer.aktualisiert.find((x) => x.id === 'ptz')!.patch
    expect('kameraPresets' in patch && patch.kameraPresets === undefined).toBe(true)
  })
})
