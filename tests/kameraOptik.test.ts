import { describe, expect, it } from 'vitest'
import { optikKurz, zoombereich, objektivName } from '../src/renderer/lib/kameraOptik'
import { optikAus } from '../src/renderer/lib/multicamCameraImport'

describe('kameraOptik (#910)', () => {
  it('Zoom mit eingestellter Brennweite und Extender', () => {
    expect(optikKurz({ brennweiteMinMm: 7.8, brennweiteMaxMm: 187, brennweiteMm: 50, extender: 2 })).toBe(
      '7.8–187 mm @ 50 mm 2x',
    )
  })

  it('Festbrennweite zeigt eine Zahl', () => {
    expect(zoombereich({ brennweiteMinMm: 50, brennweiteMaxMm: 50 })).toBe('50 mm')
  })

  it('ohne Zoombereich steht das Objektiv-Modell', () => {
    expect(optikKurz({ objektivHersteller: 'Canon', objektivModell: 'CJ45' })).toBe('Canon CJ45')
    expect(objektivName({})).toBeUndefined()
  })

  it('nichts gesagt heisst keine Zeile — keine 0 mm', () => {
    expect(optikKurz(undefined)).toBeUndefined()
    expect(optikKurz({})).toBeUndefined()
    expect(optikAus({ id: 'a', label: 'A' })).toBeUndefined()
  })

  it('Extender 1 ist kein Extender', () => {
    expect(optikAus({ id: 'a', label: 'A', extender: 1 })).toBeUndefined()
  })
})
