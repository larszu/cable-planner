import { describe, expect, it, vi } from 'vitest'
import { adresseAufloesen, geoGiltFuer, osmEinbettung, osmSuchLink } from '../src/renderer/lib/standortKarte'

// #952 — OSM-Karte zur Raumadresse.

describe('standortKarte', () => {
  it('baut Suchlink und Einbettung mit Marker', () => {
    expect(osmSuchLink(' Hauptstr. 1, Berlin ')).toBe('https://www.openstreetmap.org/search?query=Hauptstr.%201%2C%20Berlin')
    const u = osmEinbettung(52.5, 13.4)
    expect(u.startsWith('https://www.openstreetmap.org/export/embed.html?bbox=13.396000,52.498000,13.404000,52.502000')).toBe(true)
    expect(u).toContain('marker=52.500000,13.400000')
  })

  it('verwirft Koordinaten einer anderen Adresse', () => {
    expect(geoGiltFuer({ lat: 1, lon: 2, for: 'A' }, 'A ')).toBe(true)
    expect(geoGiltFuer({ lat: 1, lon: 2, for: 'A' }, 'B')).toBe(false)
    expect(geoGiltFuer(undefined, 'A')).toBe(false)
  })

  it('loest auf und faellt bei Fehlern still auf null zurueck', async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify([{ lat: '52.5', lon: '13.4' }]))) as unknown as typeof fetch
    expect(await adresseAufloesen('Berlin', ok)).toEqual({ lat: 52.5, lon: 13.4, for: 'Berlin' })
    const leer = vi.fn(async () => new Response('[]')) as unknown as typeof fetch
    expect(await adresseAufloesen('Nirgendwo', leer)).toBeNull()
    const netz = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    expect(await adresseAufloesen('Berlin', netz)).toBeNull()
  })
})
