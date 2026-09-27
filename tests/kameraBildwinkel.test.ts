import { describe, expect, it } from 'vitest'
import { sensorBreiteMm } from '../src/renderer/lib/kameraSensor'
import { bildwinkel } from '../src/renderer/lib/kameraOptik'
import { optikAus } from '../src/renderer/lib/multicamCameraImport'

describe('#910 — Bildwinkel aus der Sensorbreite, nur wenn eindeutig', () => {
  it('findet die Sensorbreite ueber Hersteller + Modell (2/3" = 9,6 mm)', () => {
    expect(sensorBreiteMm({ manufacturer: 'Sony', model: 'HDC-3500', objektivMount: 'B4' })).toBe(9.6)
  })

  it('findet sie ueber die Geraetetyp-Id', () => {
    expect(sensorBreiteMm({ deviceTypeId: 'a823f2ff-3be9-4c45-af4e-bd4f6b13f7d7' })).toBe(36)
  })

  it('schweigt bei mehreren Sensor-Modi, fremdem Mount und unbekannter Kamera', () => {
    expect(sensorBreiteMm({ manufacturer: 'Sony', model: 'VENICE 2' })).toBeUndefined()
    expect(sensorBreiteMm({ manufacturer: 'Sony', model: 'PMW-F55', objektivMount: 'B4' })).toBeUndefined()
    expect(sensorBreiteMm({ manufacturer: 'Acme', model: 'Nope' })).toBeUndefined()
  })

  it('der Wert des Kameraplans geht vor', () => {
    expect(bildwinkel({ bildwinkelGrad: 40, sensorBreiteMm: 9.6, brennweiteMm: 10 })).toEqual({ grad: 40, gerechnet: false })
  })

  it('rechnet mit Extender: 9,6 mm Sensor, 12 mm x 2 → 2·atan(9,6/48) ≈ 22,6°', () => {
    const bw = bildwinkel({ sensorBreiteMm: 9.6, brennweiteMm: 12, extender: 2 })!
    expect(bw.gerechnet).toBe(true)
    expect(bw.grad).toBeCloseTo((2 * Math.atan(9.6 / 48) * 180) / Math.PI, 6)
  })

  it('ohne Brennweite kein Bildwinkel und keine Sensorbreite in der Optik', () => {
    expect(bildwinkel({ sensorBreiteMm: 9.6 })).toBeUndefined()
    expect(optikAus({ id: 'c', label: 'Cam', manufacturer: 'Sony', model: 'HDC-3500' })).toBeUndefined()
    expect(optikAus({ id: 'c', label: 'Cam', manufacturer: 'Sony', model: 'HDC-3500', focalMm: 20 })?.sensorBreiteMm).toBe(9.6)
  })
})
