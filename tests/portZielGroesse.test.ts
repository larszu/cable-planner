import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PORT_ZIEL_MIN, portZielUeberstand } from '../src/renderer/lib/griffFlaeche'
import { RASTER_MAX, RASTER_MIN, rasterAus } from '../src/renderer/lib/raster'

// #951 — WCAG 2.2, 2.5.8: jede Port-Zeile muss als Ziel >= 24 px messen.
describe('Port-Zeile: Mindest-Zielgroesse (#951)', () => {
  it('ist bei jeder Rastergroesse >= 24 px hoch', () => {
    expect(PORT_ZIEL_MIN).toBeGreaterThanOrEqual(24)
    for (let g = RASTER_MIN; g <= RASTER_MAX; g++) {
      const { PORT_ROW } = rasterAus(g)
      expect(PORT_ROW + 2 * portZielUeberstand(PORT_ROW), `Raster ${g}`).toBeGreaterThanOrEqual(PORT_ZIEL_MIN)
    }
  })

  it('waechst nicht, wo die Reihe schon gross genug ist', () => {
    expect(portZielUeberstand(24)).toBe(0)
    expect(portZielUeberstand(44)).toBe(0)
    expect(portZielUeberstand(22)).toBe(1)
  })

  it('EquipmentNode setzt den Ueberstand an beiden Port-Zeilen um', () => {
    const src = readFileSync('src/renderer/components/Canvas/EquipmentNode.tsx', 'utf8')
    expect(src.match(/height: PORT_ROW \+ 2 \* portUeberstand/g)?.length).toBe(2)
    expect(src.match(/backgroundClip: 'content-box'/g)?.length).toBe(2)
  })
})
