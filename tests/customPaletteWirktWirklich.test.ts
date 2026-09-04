import { describe, expect, it } from 'vitest'
import appearanceSrc from '../src/renderer/components/Settings/tabs/AppearanceTab.tsx?raw'
import canvasSrc from '../src/renderer/components/Canvas/CanvasArea.tsx?raw'
import exportBgSrc from '../src/renderer/lib/exportBackground.ts?raw'
import { stripComments } from './support/stripComments'

// Die Karte "Custom-Palette" bot drei Farbregler an: Hintergrund, Raster-Strich
// und Akzent. Zwei davon sind vollstaendig verdrahtet -- bis in den Canvas und
// in jeden Bild-/PDF-Export. Der dritte war folgenlos: `accent` wurde
// gespeichert, beim Laden validiert (uiStore.ts:477-483) und nach einem
// Neustart im Picker wieder angezeigt -- und von KEINEM Konsumenten gelesen.
//
// Jeder Konsument tippt die Palette als genau zwei Felder:
//   CanvasArea, exportBackground, exportImage, exportPdf, exportPdfVector
//   -> `{ canvasBg: string; gridColor: string }`
//
// Das ist der Kern des Guards: solange die Konsumenten-Typen zwei Felder
// nennen, darf die Oberflaeche nicht drei versprechen. Wer `accent` (oder ein
// viertes Feld) wieder anbietet, muss es vorher irgendwo lesbar machen.

const paletteFelder = (src: string): string[] => {
  const m = /customPalette\??:\s*\{([^}]*)\}/.exec(src)
  if (!m) return []
  return [...m[1].matchAll(/(\w+):\s*string/g)].map((x) => x[1]).sort()
}

describe('Custom-Palette — angeboten heisst gelesen', () => {
  it('die Konsumenten kennen genau zwei Palette-Felder', () => {
    expect(paletteFelder(exportBgSrc)).toEqual(['canvasBg', 'gridColor'])
  })

  it('die Oberflaeche bietet genau die Felder an, die auch gelesen werden', () => {
    const angeboten = [
      ...stripComments(appearanceSrc).matchAll(/\{\s*key:\s*'(\w+)',\s*label:/g),
    ]
      .map((m) => m[1])
      .sort()
    expect(
      angeboten,
      'Regler in den Einstellungen, die kein Konsument liest (oder umgekehrt)',
    ).toEqual(paletteFelder(exportBgSrc))
  })

  it('beide Felder kommen tatsaechlich im Canvas an', () => {
    const src = stripComments(canvasSrc)
    expect(src, 'canvasBg wird im Canvas nicht gelesen').toMatch(/customPalette\?\.canvasBg/)
    expect(src, 'gridColor wird im Canvas nicht gelesen').toMatch(/customPalette\?\.gridColor/)
  })

  it('die Beschreibung der Karte verspricht keinen Akzent mehr', () => {
    // Der Text nannte "Canvas-Hintergrund, Raster und Akzent" -- das dritte
    // Wort war die eigentliche Zusage, nicht der Regler daneben.
    expect(stripComments(appearanceSrc)).not.toMatch(/Raster und Akzent/)
  })
})
