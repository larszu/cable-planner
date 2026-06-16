import { describe, expect, it } from 'vitest'
import { isNewerVersion } from '../src/main/util/versionCompare'

// Update-Logik: zeigt einen Update-Hinweis nur, wenn die neueste Release-Version
// ECHT neuer ist als die laufende App. Deckt die Fallstricke des alten
// String-Vergleichs (`latest !== current`) ab.
describe('isNewerVersion', () => {
  it('erkennt eine echt neuere Version', () => {
    expect(isNewerVersion('8.2.0', '8.0.10')).toBe(true)
    expect(isNewerVersion('8.2.1', '8.2.0')).toBe(true)
    expect(isNewerVersion('9.0.0', '8.99.99')).toBe(true)
  })

  it('vergleicht numerisch statt lexikografisch (8.10.0 > 8.9.0)', () => {
    expect(isNewerVersion('8.10.0', '8.9.0')).toBe(true)
    expect(isNewerVersion('8.9.0', '8.10.0')).toBe(false)
  })

  it('ist false bei gleicher Version (führendes „v" egal)', () => {
    expect(isNewerVersion('8.2.0', '8.2.0')).toBe(false)
    expect(isNewerVersion('v8.2.0', '8.2.0')).toBe(false)
  })

  it('bietet KEIN Downgrade an (current neuer als latest)', () => {
    expect(isNewerVersion('8.0.10', '8.2.0')).toBe(false)
  })

  it('ignoriert Pre-Release-/Build-Suffixe beim Kern-Vergleich', () => {
    expect(isNewerVersion('8.2.0', '8.2.0-beta.1')).toBe(false)
    expect(isNewerVersion('8.3.0-rc.1', '8.2.0')).toBe(true)
  })

  it('ist robust gegen leere Eingaben', () => {
    expect(isNewerVersion('', '8.2.0')).toBe(false)
    expect(isNewerVersion('8.2.0', '')).toBe(false)
  })
})
