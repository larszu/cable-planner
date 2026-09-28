// #909 — ein zweiter Kamera-Import ist ein Abgleich, kein Anhaengen.
import { describe, expect, it } from 'vitest'
import { abgleichKameras, cameraListToEquipment, type CameraListExchange } from '../src/renderer/lib/multicamCameraImport'
import type { EquipmentItem } from '../src/renderer/types/equipment'

const liste = (cameras: CameraListExchange['cameras'], projectId: string | undefined = 'plan-a'): CameraListExchange => ({
  kind: 'camera-list',
  formatVersion: 2,
  app: 'multicam-planner',
  appVersion: '1.0.0',
  exportedAt: '2026-09-24T00:00:00.000Z',
  ...(projectId ? { projectId } : {}),
  cameras,
})

/** Bestand, wie ihn ein erster Import angelegt haette — mit vergebenen Ids. */
const importiert = (ex: CameraListExchange): EquipmentItem[] =>
  cameraListToEquipment(ex).map((e, i) => ({ ...e, id: `geraet-${i}` }))

const zwei = liste([
  { id: 'cam-1', label: 'CAM 1', manufacturer: 'Sony', model: 'PMW-F55', x: 1, y: 1 },
  { id: 'cam-2', label: 'CAM 2', manufacturer: 'NoName', model: 'Mystery', focalMm: 50 },
])

describe('abgleichKameras', () => {
  it('legt beim ersten Mal alles neu an', () => {
    const r = abgleichKameras([], zwei)
    expect(r.neu).toHaveLength(2)
    expect(r.aktualisiert).toEqual([])
  })

  it('zweimal dieselbe Liste: keine Duplikate, nichts geaendert', () => {
    const r = abgleichKameras(importiert(zwei), zwei)
    expect(r.neu).toEqual([])
    expect(r.aktualisiert).toEqual([])
    expect(r.unveraendert).toBe(2)
  })

  it('zieht Name und Optik nach, laesst Lage und Ports stehen', () => {
    const bestand = importiert(zwei).map((e) => ({ ...e, x: 999, y: 999 }))
    const neu = liste([
      { id: 'cam-1', label: 'CAM 1 Tribuene', manufacturer: 'Sony', model: 'PMW-F55', x: 5, y: 5 },
      { id: 'cam-2', label: 'CAM 2', manufacturer: 'NoName', model: 'Mystery', focalMm: 85 },
    ])
    const r = abgleichKameras(bestand, neu)
    expect(r.neu).toEqual([])
    const p1 = r.aktualisiert.find((a) => a.id === 'geraet-0')!.patch
    expect(p1).toEqual({ name: 'CAM 1 Tribuene' })
    const p2 = r.aktualisiert.find((a) => a.id === 'geraet-1')!.patch
    expect(p2).toEqual({ optik: { brennweiteMm: 85 } })
  })

  it('markiert eine verschwundene Kamera statt sie zu loeschen', () => {
    const r = abgleichKameras(importiert(zwei), liste([zwei.cameras[0]]))
    expect(r.verwaist).toEqual(['geraet-1'])
    expect(r.aktualisiert).toContainEqual({ id: 'geraet-1', patch: { multicamRemoved: true } })
  })

  it('hebt die Markierung auf, wenn die Kamera zurueckkommt', () => {
    const bestand = importiert(zwei).map((e, i) => (i === 1 ? { ...e, multicamRemoved: true } : e))
    const r = abgleichKameras(bestand, zwei)
    expect(r.aktualisiert).toEqual([{ id: 'geraet-1', patch: { multicamRemoved: undefined } }])
  })

  it('raeumt die Kameras eines ANDEREN Plans nicht ab', () => {
    const bestand = importiert(zwei)
    const r = abgleichKameras(bestand, liste([{ id: 'cam-1', label: 'Fremd' }], 'plan-b'))
    expect(r.neu).toHaveLength(1)
    expect(r.verwaist).toEqual([])
  })

  it('tauscht das Modell nicht still, sondern meldet es', () => {
    const r = abgleichKameras(
      importiert(zwei),
      liste([{ ...zwei.cameras[0], model: 'FX9', deviceTypeId: undefined }, zwei.cameras[1]]),
    )
    // F55 hatte Ports; der neue Name trifft keinen Katalog-Eintrag → gemeldet, Ports bleiben.
    expect(r.modellGeaendert).toEqual(['CAM 1'])
    const p = r.aktualisiert.find((a) => a.id === 'geraet-0')
    expect(p?.patch.inputs).toBeUndefined()
    expect(p?.patch.outputs).toBeUndefined()
  })

  it('fuellt die Ports nach, wenn sie vorher unbekannt waren', () => {
    const vorher = liste([{ id: 'cam-1', label: 'CAM 1', manufacturer: 'NoName', model: 'Mystery' }])
    const nachher = liste([{ id: 'cam-1', label: 'CAM 1', manufacturer: 'Sony', model: 'PMW-F55' }])
    const r = abgleichKameras(importiert(vorher), nachher)
    const p = r.aktualisiert[0].patch
    expect(p.portsUnknown).toBeUndefined()
    expect('portsUnknown' in p).toBe(true)
    expect(p.outputs!.length).toBeGreaterThan(0)
    expect(r.modellGeaendert).toEqual([])
  })

  it('erkennt Altbestand aus dem v1-Import an der Geraete-Id', () => {
    // Der v1-Import uebernahm die MultiCam-Id als Geraete-Id, ohne Herkunft.
    const alt: EquipmentItem = { ...cameraListToEquipment(zwei)[0], id: 'cam-1' }
    delete alt.multicamId
    delete alt.multicamProjectId
    delete alt.importSource
    const r = abgleichKameras([alt], zwei)
    expect(r.neu).toHaveLength(1) // nur cam-2
    expect(r.aktualisiert[0]).toEqual({
      id: 'cam-1',
      patch: { multicamId: 'cam-1', multicamProjectId: 'plan-a', importSource: 'multicam' },
    })
  })
})

describe('Uebergang v1 → v2 (Review-Befund)', () => {
  it('eine Kamera aus einer v1-Liste wird von der ersten v2-Liste uebernommen, nicht verdoppelt', () => {
    // Ohne Projekt-Id — `liste(…, undefined)` fiele auf den Vorgabewert zurueck.
    const { projectId: _ohne, ...v1rest } = liste([{ id: 'cam-1', label: 'CAM 1' }])
    const v1: CameraListExchange = { ...v1rest, formatVersion: 1 }
    const bestand = importiert(v1)
    expect(bestand[0].multicamProjectId).toBeUndefined()
    const r = abgleichKameras(bestand, liste([{ id: 'cam-1', label: 'CAM 1' }], 'plan-a'))
    expect(r.neu).toEqual([])
    expect(r.aktualisiert).toEqual([{ id: 'geraet-0', patch: { multicamProjectId: 'plan-a' } }])
  })

  it('ein Geraet wird in einem Lauf nur einmal getroffen', () => {
    const { projectId: _ohne, ...v1rest } = liste([{ id: 'cam-1', label: 'CAM 1' }])
    const bestand = importiert({ ...v1rest, formatVersion: 1 })
    const r = abgleichKameras(bestand, liste([{ id: 'cam-1', label: 'A' }, { id: 'cam-2', label: 'B' }], 'plan-a'))
    expect(r.neu.map((e) => e.name)).toEqual(['B'])
  })
})
