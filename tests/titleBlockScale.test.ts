import { describe, expect, it } from 'vitest'
import { titleBlockScale } from '../src/renderer/lib/titleBlockScale'

describe('titleBlockScale', () => {
  it('bleibt auf A3 und kleiner bei 1', () => {
    expect(titleBlockScale(1191, 842, 300)).toBe(1)
    expect(titleBlockScale(842, 595, 300)).toBe(1)
  })
  it('waechst mit der Blattflaeche (A0 = 4x A3-Kante)', () => {
    expect(titleBlockScale(3370, 2384, 300)).toBeCloseTo(2.83, 1)
  })
  it('wird nie breiter als knapp die halbe Blattbreite', () => {
    const k = titleBlockScale(1500, 20000, 300)
    expect(300 * k).toBeLessThanOrEqual(1500 * 0.45 + 1e-9)
  })
  it('rechnet CSS-px um', () => {
    expect(titleBlockScale(3370 * (4 / 3), 2384 * (4 / 3), 300, 4 / 3)).toBeCloseTo(2.83, 1)
  })
})
