import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const lies = (pfad: string) => readFileSync(pfad, 'utf8')

/**
 * #987 / #988 / #989 — Bedienung von Bibliothek und Eigenschaften-Leiste.
 *
 * Es gibt kein Render-Geruest fuer Komponenten; diese Pruefungen halten die
 * Entscheidungen am Quelltext fest, damit sie nicht still zurueckgedreht
 * werden.
 */
describe('Bibliothek: Klick oeffnet die Eigenschaften (#987)', () => {
  const item = lies('src/renderer/components/Library/LibraryItem.tsx')
  const tab = lies('src/renderer/components/Library/tabs/LocalEquipmentTab.tsx')

  it('hat keinen eigenen Bearbeiten-Knopf mehr', () => {
    expect(item).not.toMatch(/onEdit/)
    expect(item).not.toMatch(/Pencil/)
  })

  it('waehlt die Vorlage per Klick und platziert per Doppelklick', () => {
    expect(item).toMatch(/if \(onSelect\) onSelect\(\)/)
    expect(item).toMatch(/onDoubleClick/)
    expect(tab).toMatch(/onSelect=\{\(\) => setSelectedTemplateName\(item\.name\)\}/)
  })
})

describe('Port-Einstellungen sind einklappbar (#988)', () => {
  const liste = lies('src/renderer/components/Properties/PortList.tsx')
  const sektion = lies('src/renderer/components/Properties/sections/PortsSection.tsx')

  it('PortList bekommt den Zuklapp-Zustand von aussen', () => {
    expect(liste).toMatch(/collapsed: ReadonlySet<string>/)
    expect(liste).toMatch(/onToggleCollapsed/)
  })

  it('die Sektion bedient beide Listen mit „alle ein-/ausklappen"', () => {
    expect(sektion).toMatch(/ports\.collapseAll/)
    expect(sektion).toMatch(/ports\.expandAll/)
    expect(sektion.match(/collapsed=\{zu\}/g)).toHaveLength(2)
  })

  it('Namensfelder duerfen schrumpfen statt rechts herauszuragen', () => {
    expect(liste).toMatch(/ports\.namePlaceholder[\s\S]{0,80}className="min-w-0 flex-1/)
    expect(lies('src/renderer/components/Properties/sections/IdentityBlock.tsx')).toMatch(
      /min-w-0 flex-1 border border-cp-border bg-cp-surface-1 p-2 font-mono/,
    )
  })
})

describe('Alle Accordions haben dasselbe Zeichen (#989)', () => {
  it('index.css zeichnet das Chevron fuer jedes <details>', () => {
    const css = lies('src/renderer/index.css')
    expect(css).toMatch(/details > summary::before/)
    expect(css).toMatch(/details\[open\] > summary::before/)
  })

  it('kein Abschnitt baut sich ein eigenes Chevron in die Kopfzeile', () => {
    for (const datei of [
      'CategoryPropsSection',
      'GreenGoBeltpackSection',
      'DeviceConfigsBlock',
      'DisplayPropertiesBlock',
      'TestPatternSection',
    ]) {
      expect(lies(`src/renderer/components/Properties/sections/${datei}.tsx`)).not.toMatch(/ChevronDown/)
    }
  })
})
