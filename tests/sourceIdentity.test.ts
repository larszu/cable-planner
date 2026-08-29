import { describe, expect, it } from 'vitest'
import {
  UMD_ADDRESS_MAX,
  isValidUmdAddress,
  normaliseSourceIdentities,
  normaliseSourceIdentity,
  parseUmdAddress,
  umdAddressClashes,
  clearDanglingIdentity,
  sourceIdentityIdSet,
} from '../src/renderer/lib/sourceIdentity'

describe('parseUmdAddress', () => {
  it('nimmt Zahl und Ziffern-String', () => {
    expect(parseUmdAddress(0)).toBe(0)
    expect(parseUmdAddress('12')).toBe(12)
    expect(parseUmdAddress(UMD_ADDRESS_MAX)).toBe(UMD_ADDRESS_MAX)
  })

  it('verwirft alles ausserhalb des Protokoll-Bereichs', () => {
    // Eine halb gueltige Adresse ist schlimmer als keine: sie sieht im Plan
    // aus wie eine Zusage, und das Display bleibt trotzdem leer.
    for (const bad of [-1, 127, 1.5, '', '  ', 'x', null, undefined, {}, []]) {
      expect(parseUmdAddress(bad)).toBeUndefined()
    }
  })

  it('macht aus dem leeren String kein 0', () => {
    // Number('') === 0 — der klassische Fallstrick. Ein geloeschtes Feld darf
    // nicht als Adresse 0 durchgehen.
    expect(parseUmdAddress('')).toBeUndefined()
    expect(isValidUmdAddress(Number(''))).toBe(true)
  })
})

describe('normaliseSourceIdentity', () => {
  it('behaelt Name, Nummer und Adresse', () => {
    expect(
      normaliseSourceIdentity({ id: 'r1', name: ' Kamera 1 ', number: 1, umdAddress: 3 }, 'fb'),
    ).toEqual({ id: 'r1', name: 'Kamera 1', number: 1, umdAddress: 3 })
  })

  it('verwirft eine Rolle ohne Namen — die kann niemand zuweisen', () => {
    expect(normaliseSourceIdentity({ id: 'r1', name: '   ' }, 'fb')).toBeNull()
    expect(normaliseSourceIdentity({ id: 'r1' }, 'fb')).toBeNull()
  })

  it('vergibt eine Ersatz-Id, wenn keine da ist', () => {
    expect(normaliseSourceIdentity({ name: 'Kamera 1' }, 'fallback-7')?.id).toBe('fallback-7')
  })

  it('laesst eine ungueltige Adresse weg, statt die Rolle zu verwerfen', () => {
    const r = normaliseSourceIdentity({ name: 'Kamera 1', umdAddress: 999 }, 'fb')
    expect(r).toEqual({ id: 'fb', name: 'Kamera 1' })
  })

  it('behandelt Unsinn als leer statt zu werfen', () => {
    for (const bad of [null, undefined, 42, 'nope', [1, 2]]) {
      expect(normaliseSourceIdentity(bad, 'fb')).toBeNull()
    }
  })
})

describe('normaliseSourceIdentities', () => {
  it('wirft Duplikat-Ids weg — die erste gewinnt', () => {
    const out = normaliseSourceIdentities([
      { id: 'r1', name: 'Kamera 1' },
      { id: 'r1', name: 'Kamera 2' },
    ])
    expect(out).toEqual([{ id: 'r1', name: 'Kamera 1' }])
  })

  it('macht aus fehlender Liste eine leere', () => {
    expect(normaliseSourceIdentities(undefined)).toEqual([])
    expect(normaliseSourceIdentities('nope')).toEqual([])
  })
})

describe('umdAddressClashes', () => {
  it('meldet zwei Rollen auf derselben Adresse', () => {
    const clashes = umdAddressClashes([
      { id: 'a', name: 'Kamera 1', umdAddress: 3 },
      { id: 'b', name: 'Kamera 2', umdAddress: 3 },
      { id: 'c', name: 'Kamera 3', umdAddress: 4 },
    ])
    expect(clashes).toHaveLength(1)
    expect(clashes[0].address).toBe(3)
    expect(clashes[0].identities.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('ignoriert Rollen ohne Adresse — die kollidieren mit nichts', () => {
    expect(
      umdAddressClashes([
        { id: 'a', name: 'Kamera 1' },
        { id: 'b', name: 'Kamera 2' },
      ]),
    ).toEqual([])
  })

  it('behandelt Adresse 0 wie jede andere', () => {
    const clashes = umdAddressClashes([
      { id: 'a', name: 'Kamera 1', umdAddress: 0 },
      { id: 'b', name: 'Kamera 2', umdAddress: 0 },
    ])
    expect(clashes.map((c) => c.address)).toEqual([0])
  })
})

describe('clearDanglingIdentity', () => {
  const ids = sourceIdentityIdSet([{ id: 'r1', name: 'Kamera 1' }])

  it('entfernt eine Bindung auf eine geloeschte Rolle', () => {
    expect(clearDanglingIdentity({ id: 'e1', sourceIdentityId: 'weg' }, ids)).toEqual({
      id: 'e1',
      sourceIdentityId: undefined,
    })
  })

  it('laesst eine gueltige Bindung in Ruhe — und zwar dasselbe Objekt', () => {
    const item = { id: 'e1', sourceIdentityId: 'r1' }
    expect(clearDanglingIdentity(item, ids)).toBe(item)
  })

  it('laesst ein Geraet ohne Bindung unangetastet', () => {
    const item = { id: 'e1' }
    expect(clearDanglingIdentity(item, ids)).toBe(item)
  })
})
