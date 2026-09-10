import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// ---------------------------------------------------------------------------
// #836 — „Neue kabeltypen anlegen muss eigentlich in den Einstellungen sein
// und nicht links in der Geräte seitenleiste." (Eigentümer, 2026-09-10)
//
// ─── WARUM DAS EIN WÄCHTER BRAUCHT ─────────────────────────────────────────
//
// Weil ein verschobener Knopf zurückwandert. Die Kabel-Bibliothek ist die
// Stelle, an der jemand über Kabeltypen nachdenkt; „dann kann der Knopf ja
// auch gleich hier stehen" ist der naheliegende nächste Schritt, und danach
// gäbe es das Anlegen an ZWEI Orten. Zwei Wege zum selben Ziel laufen
// auseinander, sobald einer eine Prüfung dazubekommt.
//
// Geprüft wird die STRUKTUR, nicht der Text: dass die Seitenleiste den Editor
// nicht mehr ohne Vorlage öffnet, und dass die Einstellungen es tun.
// ---------------------------------------------------------------------------

const RENDERER = resolve(__dirname, '..', 'src', 'renderer')
const lies = (...pfad: string[]) =>
  readFileSync(join(RENDERER, ...pfad), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')

describe('Anlegen sitzt in den Einstellungen', () => {
  it('der Tab öffnet den Editor OHNE Vorlage', () => {
    // `setEditing(undefined)` ist genau das: offen, aber ohne Vorlage — also
    // „neu". `null` hiesse zu, ein Spec hiesse bearbeiten.
    const src = lies('components', 'Settings', 'tabs', 'CableTypesTab.tsx')
    expect(src).toMatch(/onClick=\{\(\) => setEditing\(undefined\)\}/)
    expect(src).toMatch(/addCustomCableSpec\(spec\)/)
  })

  it('und ist als eigener Abschnitt erreichbar', () => {
    // Ohne die Zeile im Body gäbe es den Tab, aber keinen Weg dorthin.
    const body = lies('components', 'Settings', 'SettingsBody.tsx')
    expect(body).toMatch(/\|\s*'cableTypes'/)
    expect(body).toMatch(/section === 'cableTypes' && <CableTypesTab \/>/)
  })
})

describe('Die Seitenleiste legt nichts mehr an', () => {
  const src = lies('components', 'Library', 'CableLibraryPanel.tsx')

  it('öffnet den Editor nicht mehr ohne Vorlage', () => {
    expect(
      src,
      'Die Seitenleiste oeffnet den Kabeltyp-Editor wieder als „neu". ' +
        'Anlegen gehoert seit #836 in die Einstellungen.',
    ).not.toMatch(/setEditing\(undefined\)/)
  })

  it('bearbeitet aber weiter, was schon dasteht', () => {
    // Die GEGENPROBE. Der Punkt von #836 war nicht, die Bibliothek stumm zu
    // schalten: einen Typ dort zu ändern, wo man ihn sieht, bleibt richtig.
    expect(src).toMatch(/setEditing\(/)
    expect(src).toMatch(/updateCustomCableSpec\(/)
  })

  it('führt statt dessen an die richtige Stelle — und öffnet sie', () => {
    // Ein Verweis, der den Leser suchen lässt, ist kaum besser als keiner.
    expect(src).toMatch(/openSettings\('cableTypes'\)/)
  })
})

describe('Der Editor gehört keiner der beiden Seiten', () => {
  it('liegt in einer eigenen Datei und wird exportiert', () => {
    const src = lies('components', 'Cable', 'CableTypeEditor.tsx')
    expect(src).toMatch(/export const CableTypeEditor/)
  })

  it('greift auf KEINEN Kabel-Speicher zu', () => {
    // Er bekommt den Anfangswert und gibt das Ergebnis zurück — deshalb kann
    // dieselbe Maske einen eigenen Typ anlegen und einen eingebauten
    // überschreiben, ohne den Unterschied zu kennen. Ein Store-Zugriff hier
    // würde diese Entscheidung in die Maske ziehen.
    const src = lies('components', 'Cable', 'CableTypeEditor.tsx')
    for (const verboten of [
      'addCustomCableSpec',
      'updateCustomCableSpec',
      'removeCustomCableSpec',
      'setCableSpecOverride',
      'customCableSpecs',
    ]) {
      expect(src, `${verboten} gehoert nicht in die Maske`).not.toContain(verboten)
    }
  })

  it('beide Seiten benutzen dieselbe Maske', () => {
    // Sonst gäbe es zwei Formulare für denselben Datensatz, und das zweite
    // vergisst beim nächsten Feld etwas.
    expect(lies('components', 'Library', 'CableLibraryPanel.tsx')).toMatch(
      /import \{ CableTypeEditor \} from '\.\.\/Cable\/CableTypeEditor'/,
    )
    expect(lies('components', 'Settings', 'tabs', 'CableTypesTab.tsx')).toMatch(
      /import \{ CableTypeEditor \} from '\.\.\/\.\.\/Cable\/CableTypeEditor'/,
    )
  })
})
