import { describe, expect, it } from 'vitest'
import { satz, satzKanonisch, satzQuelle, satzText } from '../src/renderer/lib/satz'

describe('satz — ein Befund, zwei Sprachen (#1142)', () => {
  const s = satz('x.profil', 'Profile {p} on domain {d}.', {
    p: satz('ptp.profile.unspecified', 'not stated'),
    d: 3,
  })

  it('setzt Werte ein, auch verschachtelte Saetze', () => {
    expect(satzQuelle(s)).toBe('Profile not stated on domain 3.')
  })

  it('loest das Blatt kanonisch deutsch auf', () => {
    expect(satzKanonisch(s)).toBe('Profile nicht angegeben on domain 3.')
  })

  it('nimmt fuer den Bildschirm den uebergebenen Uebersetzer', () => {
    expect(satzText(s, (k, en) => (k === 'x.profil' ? 'Profil {p} auf Domäne {d}.' : en))).toBe(
      'Profil not stated auf Domäne 3.',
    )
  })
})
