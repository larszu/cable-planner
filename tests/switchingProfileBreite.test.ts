import { describe, expect, it } from 'vitest'
import { listDeviceTypes, resolveDeviceType } from '../src/renderer/lib/deviceTypeRegistry'
import { SWITCHING_PROFILES_BY_TYPE, type SwitchingBlockCountKey } from '../src/renderer/lib/switching'

// #1240 Stufe 7: Profile in der Breite. Jede Zahl braucht eine Adresse, und
// das Profil passt zur Kategorie des Katalog-Eintrags.
const ROLLE: Record<string, 'mixer' | 'router'> = { 'Video Mixer': 'mixer', 'Video Router': 'router' }
const url = /^https:\/\/[^\s]+$/

describe('Profile in der Breite', () => {
  it('jede Geraetetyp-ID im Profil-Verzeichnis liegt im Katalog und passt zur Kategorie', () => {
    for (const [id, p] of Object.entries(SWITCHING_PROFILES_BY_TYPE)) {
      const info = resolveDeviceType(id)
      expect(info, id).toBeTruthy()
      expect(info?.switchingProfile).toBe(p)
      expect(ROLLE[info?.template.category ?? ''], info?.template.name).toBe(p.role)
    }
  })

  it('jedes Profil im Katalog belegt jeden Wert mit einer Adresse', () => {
    const mitProfil = listDeviceTypes()
      .map((t) => resolveDeviceType(t.id))
      .filter((i) => i?.switchingProfile)
    expect(mitProfil.length).toBeGreaterThanOrEqual(20)
    for (const i of mitProfil) {
      const p = i!.switchingProfile!
      expect(p.manufacturerUrl, i!.template.name).toMatch(url)
      for (const k of Object.keys(p.blocks) as SwitchingBlockCountKey[]) {
        expect(Number.isInteger(p.blocks[k]) && (p.blocks[k] as number) > 0, `${i!.template.name} ${k}`).toBe(true)
        expect(p.sources?.[k] ?? p.manufacturerUrl).toMatch(url)
      }
      if (p.levels) expect(p.sources?.levels ?? p.manufacturerUrl).toMatch(url)
      if (p.features) expect(p.sources?.features ?? p.manufacturerUrl).toMatch(url)
      if (p.role === 'router') expect(p.levels?.length ?? 0, i!.template.name).toBeGreaterThan(0)
    }
  })
})
