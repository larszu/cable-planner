import { describe, expect, it } from 'vitest'
import {
  cameraListToEquipment,
  parseCameraList,
  type CameraListExchange,
} from '../src/renderer/lib/multicamCameraImport'

const sample: CameraListExchange = {
  kind: 'camera-list',
  formatVersion: 1,
  app: 'multicam-planner',
  appVersion: '0.4.0',
  exportedAt: '2026-06-30T00:00:00.000Z',
  cameras: [
    { id: 'c1', label: 'CAM 1', manufacturer: 'Sony', model: 'PMW-F55', x: 5, y: 7 },
    { id: 'c2', label: 'CAM 2', manufacturer: 'NoName', model: 'Mystery 9000', x: 2, y: 3 },
  ],
}

describe('multicamCameraImport (Cable ← MultiCam)', () => {
  it('mappt Kameras auf Equipment der Kategorie "Kameras"', () => {
    const items = cameraListToEquipment(sample)
    expect(items).toHaveLength(2)
    expect(items.every((e) => e.category === 'Kameras')).toBe(true)
    expect(items[0].name).toBe('CAM 1')
    // Venue-Meter → Canvas-Pixel.
    expect(items[0].x).toBe(5 * 120)
    expect(items[0].y).toBe(7 * 120)
  })

  it('erbt echte Ports aus dem CAMERA_CATALOG bei bekanntem Modell', () => {
    const [f55] = cameraListToEquipment(sample)
    // Sony PMW-F55 hat im Katalog mehrere SDI-/HDMI-Ausgaenge.
    expect(f55.outputs.length).toBeGreaterThan(1)
    expect(f55.outputs.some((p) => p.connectorType === 'BNC')).toBe(true)
  })

  it('erfindet unbekannten Modellen KEINE Ports, sondern markiert sie explizit', () => {
    const mystery = cameraListToEquipment(sample)[1]
    // Kein Datenblatt-Match → keine erfundene Belegung.
    expect(mystery.inputs).toHaveLength(0)
    expect(mystery.outputs).toHaveLength(0)
    // Stattdessen explizit als unbekannt geführt (Plan-Check fordert Ergänzung).
    expect(mystery.portsUnknown).toBe(true)
  })

  it('matcht konservativ: ein bloßer Hersteller-Treffer erbt keine fremde Belegung', () => {
    // "Sony PXW-Z750" ist unbekannt; ein loses "enthält sony"-Match hätte ihm
    // früher die Ports der Sony FX6 angedichtet. Jetzt: unbekannt.
    const [z750] = cameraListToEquipment({
      ...sample,
      cameras: [{ id: 'z', label: 'Z750', manufacturer: 'Sony', model: 'PXW-Z750' }],
    })
    expect(z750.portsUnknown).toBe(true)
    expect(z750.outputs).toHaveLength(0)
  })

  it('parseCameraList lehnt fremde Dateien ab', () => {
    expect(() => parseCameraList('{"kind":"venue-exchange"}')).toThrow()
    expect(() => parseCameraList(JSON.stringify(sample))).not.toThrow()
  })
})
