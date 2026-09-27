import { describe, expect, it } from 'vitest'
import { LEGACY_TEMPLATE_RENAMES } from '../src/renderer/lib/templateRenames'
import { EINGEBAUTER_KATALOG } from '../src/renderer/lib/eingebauterKatalog'
import { DEVICE_TYPE_ALIASES } from '../src/renderer/lib/deviceTypeAliases'
import { resolveDeviceType } from '../src/renderer/lib/deviceTypeRegistry'

// 2026-09-27 — Katalognamen, die es beim Hersteller so nicht gab, stehen jetzt
// auf dem belegten Modell. Der Name ist in der Bibliothek die Kennung
// (templateRenames.ts): ohne Eintrag stuende die alte Vorlage neben der neuen.
describe('umgestellte Katalognamen', () => {
  const namen = new Set(EINGEBAUTER_KATALOG.map((t) => t.name))

  it('jeder neue Name steht im Katalog, kein alter mehr', () => {
    for (const [alt, neu] of Object.entries(LEGACY_TEMPLATE_RENAMES)) {
      expect(namen.has(neu), neu).toBe(true)
      expect(namen.has(alt), alt).toBe(false)
    }
  })

  it('die umgestellten Eintraege tragen einen Beleg', () => {
    for (const neu of Object.values(LEGACY_TEMPLATE_RENAMES).filter((n) => !/strip/i.test(n))) {
      const t = EINGEBAUTER_KATALOG.find((x) => x.name === neu)!
      expect(t.manufacturerUrl, neu).toMatch(/^https:\/\//)
    }
  })

  it('eine aufgegangene Geraetetyp-Id loest weiter auf', () => {
    for (const [alt, neu] of Object.entries(DEVICE_TYPE_ALIASES)) {
      expect(resolveDeviceType(alt)?.template.deviceTypeId).toBe(neu)
    }
    expect(resolveDeviceType('a6c64b89-60ff-40f6-9049-3d6faa4beeca')?.template.name).toBe('UniFi Switch 16 PoE (USW-16-PoE)')
  })
})
