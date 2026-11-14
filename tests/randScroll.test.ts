import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { randScrollSchritt } from '../src/renderer/lib/randScroll'

describe('Bibliothek laeuft beim Ziehen am Rand mit (#1227)', () => {
  it('steht in der Mitte still', () => {
    expect(randScrollSchritt(500, 0, 1000)).toBe(0)
  })
  it('laeuft am oberen Rand nach oben, am unteren nach unten', () => {
    expect(randScrollSchritt(10, 0, 1000)).toBeLessThan(0)
    expect(randScrollSchritt(990, 0, 1000)).toBeGreaterThan(0)
  })
  it('wird zum Rand hin schneller und bleibt begrenzt', () => {
    expect(randScrollSchritt(995, 0, 1000)).toBeGreaterThan(randScrollSchritt(960, 0, 1000))
    expect(randScrollSchritt(2000, 0, 1000)).toBe(18)
    expect(randScrollSchritt(-50, 0, 1000)).toBe(-18)
  })
  it('eine sehr kurze Liste hat keine Zone, die alles verdeckt', () => {
    expect(randScrollSchritt(30, 0, 60)).toBe(0)
  })
})

describe('Ziehen in eine (Unter-)Kategorie (#1227)', () => {
  it('die Bibliothek erlaubt Verschieben, nicht nur Kopieren', () => {
    // Mit effectAllowed 'copy' verwirft der Browser jeden Abwurf, dessen
    // dropEffect 'move' ist — die Kategorien setzen genau den.
    const item = readFileSync('src/renderer/components/Library/LibraryItem.tsx', 'utf8')
    expect(item).toMatch(/effectAllowed = 'copyMove'/)
    const tab = readFileSync('src/renderer/components/Library/tabs/LocalEquipmentTab.tsx', 'utf8')
    expect(tab).toMatch(/dropEffect = 'move'/)
    expect(tab).toMatch(/randScrollSchritt\(/)
  })
  it('die Kategorie im Vorlagen-Inspector gilt sofort, nicht erst nach Speichern', () => {
    const src = readFileSync('src/renderer/components/Properties/TemplateProperties.tsx', 'utf8')
    expect(src).toMatch(/setCustomTemplateCategory\(template\.name/)
  })
})
