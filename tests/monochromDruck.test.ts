import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LAYER_STYLES, STANDARD_LAYERS } from '../src/renderer/lib/cableLayers'
import {
  MONO_TINTE,
  engsteEbenen,
  grauwert,
  monochromLabel,
  relativeHelligkeit,
} from '../src/renderer/lib/monochromeSheet'

/**
 * Bedarf 128 — der Ausdruck fuer den Tisch, monochrom sicher.
 *
 * Die erste Messung war die falsche: „es gibt keine `@media print`-Regel."
 * Stimmt, ist aber bedeutungslos — der Plan wird als PDF aus einer Aufnahme
 * des Canvas gedruckt, Druck-CSS beruehrt ihn nicht. Die richtige Frage:
 * ueberlebt die Unterscheidung zweier Kabel den Graustufen-Druck?
 */

const lies = (p: string): string => readFileSync(join(__dirname, '..', p), 'utf8')

describe('Der Befund: die Farbe traegt es nicht', () => {
  it('rechnet Helligkeit so, wie ein Graustufen-Druck sie hinterlaesst', () => {
    // Zwei Festpunkte, an denen die Formel haengt.
    expect(relativeHelligkeit('#000000')).toBeCloseTo(0, 6)
    expect(relativeHelligkeit('#ffffff')).toBeCloseTo(1, 6)
    expect(grauwert('#ffffff')).toBe(255)
  })

  it('zeigt, dass zwei Ebenen auf Papier nicht zu trennen sind', () => {
    const { abstand } = engsteEbenen()
    // Die Kennzahl des Befundes. Sie steht hier als Zusicherung und nicht als
    // Kommentar: wer die Ebenenfarben aendert, sieht am Waechter, ob der Fall
    // noch besteht — und wenn nicht, gehoert der Befund umgeschrieben statt
    // der Test gelockert.
    expect(abstand).toBeLessThan(10)
    expect(grauwert(LAYER_STYLES.audio.color)).toBe(130)
    expect(grauwert(LAYER_STYLES.video.color)).toBe(132)
  })
})

describe('Der zweite Kanal ist Text, nicht Strichmuster', () => {
  it('haengt die Ebene an, statt etwas zu ersetzen', () => {
    expect(monochromLabel('SDI 3G (12m)', 'video')).toBe('SDI 3G (12m) · Video')
    // Auch ohne Ebene bleibt die Beschriftung vollstaendig — die unbekannte
    // Ebene heisst „Other" und wird nicht verschwiegen.
    expect(monochromLabel('Kabel', undefined)).toContain('Kabel')
  })

  it('nimmt dem Nutzer sein Strichmuster nicht weg', () => {
    // Das Muster gehoert `cable.dashed` und dem Laengen-Modus. Es fuer die
    // Ebene zu benutzen hiesse, eine Angabe des Nutzers zu ueberschreiben, um
    // eine abgeleitete zu zeigen — genau das, was der Kommentar ueber
    // `byLayer` in CanvasArea ausschliesst.
    const code = lies('src/renderer/lib/monochromeSheet.ts')
    expect(code).not.toMatch(/strokeDasharray|dashArray|dash:/)
    const canvas = lies('src/renderer/components/Canvas/CanvasArea.tsx')
    const stelle = canvas.slice(canvas.indexOf('const dashArray'))
    expect(stelle.slice(0, 400)).not.toContain('pdfExportMonochrome')
  })

  it('gibt allen Strichen dieselbe Tinte statt sechs Grautoene', () => {
    // Ein Grauton, der fast wie der daneben aussieht, laedt zum Deuten ein.
    expect(Object.keys(MONO_TINTE).sort()).toEqual(['dark', 'light'])
    const canvas = lies('src/renderer/components/Canvas/CanvasArea.tsx')
    // Gefragt ist die STRICHFARBE, nicht die blosse Erwaehnung: die
    // Beschriftung nennt `pdfExportMonochrome` ohnehin, und ein Test, der nur
    // im ganzen Modul danach sucht, bleibt gruen, wenn die Farbe bunt bleibt.
    // Die erste Fassung tat genau das.
    const stelle = canvas.slice(canvas.indexOf('const strokeColor'))
    expect(stelle.slice(0, 300)).toContain('pdfExportMonochrome')
    expect(stelle.slice(0, 300)).toContain('monoTinte')
  })
})

describe('Es ist eine Eigenschaft der Ausgabe, keine Einstellung', () => {
  it('wird nach dem Export zurueckgenommen', () => {
    const app = lies('src/renderer/App.tsx')
    // Sonst bliebe der Canvas nach einem Ausdruck einfarbig, und der Nutzer
    // haette eine Einstellung, die er nie gewaehlt hat.
    expect(app).toContain('setPdfExportMonochrome(monochrom)')
    expect(app.match(/setPdfExportMonochrome\(false\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('ist im Export-Dialog erreichbar', () => {
    expect(lies('src/renderer/components/Export/ExportDialog.tsx')).toContain('export.monochrome')
  })

  it('deckt jede Ebene mit einer Beschriftung ab', () => {
    // Ohne das traegt eine Ebene im Ausdruck gar nichts — schlimmer als eine
    // Farbe, die man nicht unterscheiden kann.
    for (const l of STANDARD_LAYERS) expect(LAYER_STYLES[l].label.length).toBeGreaterThan(0)
  })
})
