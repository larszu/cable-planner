import { describe, expect, it } from 'vitest'
import { endenAusKabeltyp, kabeltypStecker } from '../src/renderer/lib/kabelEnden'
import { checkCableCompatibility } from '../src/renderer/types/cableSpec'
import type { CableSpec } from '../src/renderer/types/cableSpec'

// #1278 — ein Kabeltyp mit zwei verschiedenen Steckern.
const adapter: CableSpec = {
  id: 'x', name: 'TRUE1 auf Schuko', connectorType: 'powerCON TRUE1', connectorTypeTo: 'Schuko 230V',
  standards: ['Generic'], color: '#000',
}

describe('Kabeltyp mit zwei Steckern (#1278)', () => {
  it('passt in beiden Richtungen, ohne Adapter-Hinweis', () => {
    expect(checkCableCompatibility('powerCON TRUE1', 'Schuko 230V', adapter).level).toBe('ok')
    expect(checkCableCompatibility('Schuko 230V', 'powerCON TRUE1', adapter).level).toBe('ok')
  })

  it('passt nicht zwischen zwei gleichen Ports', () => {
    expect(checkCableCompatibility('powerCON TRUE1', 'powerCON TRUE1', adapter).level).toBe('error')
    expect(checkCableCompatibility('Schuko 230V', 'Schuko 230V', adapter).level).toBe('error')
  })

  it('gibt dem neuen Kabel die Stecker so herum, wie sie an den Ports liegen', () => {
    expect(endenAusKabeltyp(adapter, 'powerCON TRUE1')).toEqual({ terminationFrom: 'powerCON TRUE1', terminationTo: 'Schuko 230V' })
    expect(endenAusKabeltyp(adapter, 'Schuko 230V')).toEqual({ terminationFrom: 'Schuko 230V', terminationTo: 'powerCON TRUE1' })
  })

  it('laesst Kabeltypen mit einem Stecker wie bisher', () => {
    const bnc = { connectorType: 'BNC', connectorTypeTo: 'BNC' } as const
    expect(endenAusKabeltyp(bnc, 'BNC')).toEqual({})
    expect(endenAusKabeltyp({ connectorType: 'BNC' }, 'BNC')).toEqual({})
    expect(kabeltypStecker(bnc)).toBe('BNC')
    expect(kabeltypStecker(adapter)).toBe('powerCON TRUE1 ↔ Schuko 230V')
  })
})
