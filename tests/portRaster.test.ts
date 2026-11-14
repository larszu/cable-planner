import { describe, expect, it } from 'vitest'
import { portsImRaster, rasterAusPorts, rasterFuer, standardPortPosition } from '../src/renderer/lib/portRaster'
import type { Port } from '../src/renderer/types/equipment'

// #1221 — Patchfeld: wie viele Ports nebeneinander, wie viele untereinander.

const ports = (n: number): Port[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `${i + 1}`, type: 'SDI', connectorType: 'BNC' }) as Port)

describe('portRaster', () => {
  it('ergaenzt die andere Seite so, dass alle Ports Platz haben', () => {
    expect(rasterFuer(24, { spalten: 12 })).toEqual({ spalten: 12, reihen: 2 })
    expect(rasterFuer(24, { reihen: 3 })).toEqual({ spalten: 8, reihen: 3 })
    expect(rasterFuer(5, { spalten: 2 })).toEqual({ spalten: 2, reihen: 3 })
    expect(rasterFuer(4, { spalten: 99 })).toEqual({ spalten: 4, reihen: 1 })
    expect(rasterFuer(4, { reihen: 0 })).toEqual({ spalten: 4, reihen: 1 })
  })

  it('setzt die Ports zeilenweise in die Zellmitten', () => {
    const gesetzt = portsImRaster(ports(4), { spalten: 2, reihen: 2 })
    expect(gesetzt.map((p) => [p.panelPosX, p.panelPosY])).toEqual([
      [0.25, 0.25],
      [0.75, 0.25],
      [0.25, 0.75],
      [0.75, 0.75],
    ])
  })

  it('liest das Raster aus den Positionen zurueck', () => {
    expect(rasterAusPorts(portsImRaster(ports(24), { spalten: 8, reihen: 3 }))).toEqual({ spalten: 8, reihen: 3 })
    expect(rasterAusPorts(portsImRaster(ports(24), { spalten: 24, reihen: 1 }))).toEqual({ spalten: 24, reihen: 1 })
  })

  it('nimmt ohne Positionen das Standard-Raster, in dem die Ports auch gezeichnet werden', () => {
    const r = rasterAusPorts(ports(16))
    expect(portsImRaster(ports(16), r)[5].panelPosX).toBeCloseTo(standardPortPosition(5, 16).x)
    expect(standardPortPosition(0, 1)).toEqual({ x: 0.5, y: 0.5 })
  })
})
