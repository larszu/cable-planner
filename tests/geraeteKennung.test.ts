import { describe, expect, it } from 'vitest'
import { kennungsKuerzel, vergibKennungen } from '../src/renderer/lib/geraeteKennung'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { LocationFrame } from '../src/renderer/types/location'

// #1188 — Kennungen nach Gattung und Raum.
const geraet = (id: string, category: string, x: number, y: number, extra: Partial<EquipmentItem> = {}) =>
  ({ id, name: id, category, x, y, width: 10, height: 10, ports: [], ...extra }) as unknown as EquipmentItem
const raum = (id: string, x: number): LocationFrame => ({ id, name: id, x, y: 0, width: 100, height: 100, color: '#000' })

describe('kennungsKuerzel', () => {
  it('kennt die Gattungen, auch alte deutsche Kategorien, und faellt sonst auf drei Buchstaben', () => {
    expect(kennungsKuerzel('Cameras')).toBe('CAM')
    expect(kennungsKuerzel('Kameras')).toBe('CAM')
    expect(kennungsKuerzel('Teleprompter')).toBe('TEL')
    expect(kennungsKuerzel('')).toBe('DEV')
  })
})

describe('vergibKennungen', () => {
  const raeume = [raum('R1', 0), raum('R2', 200)]

  it('Hunderterblock je Raum, laufend nach Lage, ausserhalb ohne Block', () => {
    const alle = [
      geraet('a', 'Cameras', 10, 50),
      geraet('b', 'Cameras', 10, 10),
      geraet('c', 'Cameras', 210, 10),
      geraet('d', 'Mixer', 20, 20),
      geraet('e', 'Cameras', 500, 500),
    ]
    const { aenderungen } = vergibKennungen(alle, alle, raeume)
    const k = Object.fromEntries(aenderungen.map((a) => [a.id, a.shortName]))
    expect(k).toEqual({ b: 'CAM 101', a: 'CAM 102', d: 'MIX 101', c: 'CAM 201', e: 'CAM 1' })
  })

  it('laesst von Hand gesetzte Kennungen stehen und haelt ihre Nummer frei', () => {
    const alle = [
      geraet('a', 'Cameras', 10, 10, { shortName: 'CAM 101' }),
      geraet('b', 'Cameras', 10, 30, { shortName: 'CAM 105', shortNameAuto: true }),
      geraet('c', 'Cameras', 10, 50),
    ]
    const r = vergibKennungen(alle, alle, raeume)
    expect(r.vonHand).toBe(1)
    expect(r.aenderungen.find((a) => a.id === 'a')).toBeUndefined()
    expect(Object.fromEntries(r.aenderungen.map((a) => [a.id, a.shortName]))).toEqual({ b: 'CAM 102', c: 'CAM 103' })
  })

  it('ein einzelnes neues Geraet fuellt die erste Luecke', () => {
    const alle = [
      geraet('a', 'Cameras', 10, 10, { shortName: 'CAM 101', shortNameAuto: true }),
      geraet('b', 'Cameras', 10, 30, { shortName: 'CAM 103', shortNameAuto: true }),
      geraet('neu', 'Cameras', 10, 50),
    ]
    const r = vergibKennungen([alle[2]], alle, raeume)
    expect(r.aenderungen).toEqual([{ id: 'neu', shortName: 'CAM 102' }])
  })
})
