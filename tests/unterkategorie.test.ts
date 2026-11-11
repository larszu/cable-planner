import { describe, expect, it } from 'vitest'
import {
  kategorieBlatt,
  kategorieTiefe,
  liegtIn,
  oberkategorie,
  ordneKategorienBaum,
  unterkategorieVon,
} from '../src/renderer/lib/unterkategorie'
import { builtInSchemaForCategory } from '../src/renderer/lib/categorySchemas'

describe('Unterkategorien (#1206)', () => {
  it('zerlegt den Pfad', () => {
    expect(oberkategorie('Audio/Lautsprecher')).toBe('Audio')
    expect(kategorieBlatt('Audio/Lautsprecher')).toBe('Lautsprecher')
    expect(kategorieTiefe('Audio/Lautsprecher/Sub')).toBe(2)
    expect(kategorieTiefe('Audio')).toBe(0)
    expect(unterkategorieVon('Audio', ' Lautsprecher ')).toBe('Audio/Lautsprecher')
  })

  it('ordnet Kinder unter die Eltern und ergaenzt fehlende Eltern', () => {
    expect(ordneKategorienBaum(['Video', 'Audio/Lautsprecher', 'Audio', 'Licht/Spot/LED', 'Audio/Mikrofon'])).toEqual([
      'Video',
      'Audio',
      'Audio/Lautsprecher',
      'Audio/Mikrofon',
      'Licht',
      'Licht/Spot',
      'Licht/Spot/LED',
    ])
  })

  it('liegtIn trennt "Audio" von "Audiotechnik"', () => {
    expect(liegtIn('Audio/Lautsprecher', 'Audio')).toBe(true)
    expect(liegtIn('Audiotechnik', 'Audio')).toBe(false)
  })

  it('eine Unterkategorie erbt die Fachfelder der Oberkategorie', () => {
    const audio = builtInSchemaForCategory('Audio')
    expect(audio.length).toBeGreaterThan(0)
    expect(builtInSchemaForCategory('Audio/Lautsprecher')).toEqual(audio)
  })
})
