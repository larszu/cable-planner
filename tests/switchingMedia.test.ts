import { describe, expect, it } from 'vitest'
import {
  fotosInUse,
  loadIntoPlayer,
  playerSlot,
  setMediaSlot,
  stillRef,
  stillSlotNumber,
} from '../src/renderer/lib/switching'

// #1240 — Media-Pool: Bild laden am Mediaplayer, Ersetzen, Entfernen.
describe('Media-Pool', () => {
  it('„Bild laden…“ am Mediaplayer belegt den ersten freien Platz und stellt den Player darauf', () => {
    const s0 = setMediaSlot(undefined, 1, { fotoId: 'alt' })
    expect(playerSlot(s0, { stills: 20 }, 1)).toBe(2)
    const s1 = loadIntoPlayer(s0, 1, 2, { fotoId: 'neu' })
    expect(s1.routes?.['mp:1/still']).toBe('still:2')
    expect(stillRef(s1, 2)).toEqual({ fotoId: 'neu' })
    // Ersetzen: der Player spielt Platz 2, also bleibt es Platz 2.
    expect(playerSlot(s1, { stills: 20 }, 1)).toBe(2)
  })

  it('Entfernen gibt den Platz frei; welche Fotos noch gebraucht werden, steht fest', () => {
    const s = loadIntoPlayer(setMediaSlot(undefined, 1, { fotoId: 'a' }), 1, 2, { fotoId: 'b' })
    expect([...fotosInUse(s)].sort()).toEqual(['a', 'b'])
    const leer = setMediaSlot(s, 2, undefined)
    expect(stillRef(leer, 2)).toBeUndefined()
    expect([...fotosInUse(leer)]).toEqual(['a'])
  })

  it('Anhang-Id als Zeichenkette bleibt gueltig', () => {
    expect(setMediaSlot(undefined, 3, 'anh').media).toEqual({ 'still:3': { anhangId: 'anh' } })
    expect(stillSlotNumber('still:12')).toBe(12)
    expect(stillSlotNumber('mp:1')).toBeUndefined()
  })
})
