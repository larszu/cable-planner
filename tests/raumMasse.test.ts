import { describe, expect, it } from 'vitest'
import { flaecheM2, meterZuPx, pxZuMeter, RAHMEN_MIN_PX } from '../src/renderer/lib/raumMasse'

describe('raumMasse', () => {
  it('rechnet Pixel und Meter am Projektmassstab um', () => {
    expect(pxZuMeter(400, 1)).toBe(4)
    expect(pxZuMeter(400, 2.5)).toBe(10)
    expect(meterZuPx(10, 2.5)).toBe(400)
  })
  it('geht nie unter das Mindestmass', () => {
    expect(meterZuPx(0, 1)).toBe(RAHMEN_MIN_PX)
    expect(meterZuPx(Number.NaN, 1)).toBe(RAHMEN_MIN_PX)
    expect(meterZuPx(5, 0)).toBe(RAHMEN_MIN_PX)
  })
  it('berechnet die Flaeche aus Breite mal Tiefe', () => {
    expect(flaecheM2(600, 400, 1)).toBe(24)
    expect(flaecheM2(600, 400, 2)).toBe(96)
  })
})
