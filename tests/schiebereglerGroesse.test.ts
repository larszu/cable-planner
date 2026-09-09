import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Sind die Schieberegler zu treffen?
//
// Nutzer-Meldung 2026-09-09: „Passe auch die Ui von allen slidern an sodass
// man sie gut bedienen kann."
//
// GEMESSEN VORHER: fuer `input[type="range"]` stand in `index.css` NICHTS. Es
// blieb also beim Standardaussehen des Browsers, und dessen Regler ist in
// WebKit rund 16 px hoch. WCAG 2.2, Erfolgskriterium 2.5.8 („Target Size
// (Minimum)", Stufe AA), nennt 24 px als Mindestmass fuer eine
// Trefferflaeche — eine Norm mit einer Zahl, deshalb steht sie hier und nicht
// Apples Richtlinie von 44 pt (die ist eine Herstellerempfehlung).
//
// WAS DIESE PRUEFUNG NICHT KANN, und das gehoert hierher statt in eine
// Fussnote: sie liest das Stilblatt und die Klassen an den Reglern. Das ist
// WENIGER als eine Messung am gerenderten Fenster — was `gap`, Zeilenhoehe
// und ein umgebendes `transform` daraus machen, sieht sie nicht.
// `scripts/ui-targets.mjs` misst so etwas richtig, mit einem echten Browser
// und `getBoundingClientRect()`.
//
// Warum sie trotzdem steht: die beiden Wege, auf denen ein Regler wieder
// schrumpft, sind BEIDE textlich sichtbar — jemand dreht die Zahl im
// Stilblatt zurueck, oder jemand haengt an einen einzelnen Regler eine
// Utility-Klasse wie `h-1`, die das Stilblatt ueberschreibt. Genau diese zwei
// prueft sie, und sie sagt von sich aus, dass sie nur diese zwei kennt. Eine
// Pruefung, die ihre Grenze verschweigt, ist die gefaehrlichere.
// ---------------------------------------------------------------------------

/** WCAG 2.2 SC 2.5.8, Stufe AA. */
const MINDESTHOEHE = 24
/** Der sichtbare Griff. Kleiner als das findet der Daumen die Bahn nicht. */
const MINDESTGRIFF = 18

const WURZEL = resolve(__dirname, '..')
/** Kommentare RAUS: sie erklaeren die Regeln und wuerden sonst als Regel
 *  gelesen. Ohne diesen Schritt findet die Pruefung ihre eigene Begruendung
 *  wieder und ist gruen, nachdem die Regel geloescht wurde. */
const css = readFileSync(join(WURZEL, 'src/renderer/index.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

const block = (selektor: string): string | null => {
  const i = css.indexOf(selektor)
  if (i < 0) return null
  const auf = css.indexOf('{', i)
  const zu = css.indexOf('}', auf)
  return auf < 0 || zu < 0 ? null : css.slice(auf + 1, zu)
}

const px = (rumpf: string | null, eigenschaft: string): number | null => {
  if (!rumpf) return null
  const m = new RegExp(`${eigenschaft}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`).exec(rumpf)
  return m ? Number(m[1]) : null
}

const tsxDateien = (): string[] => {
  const out: string[] = []
  const gehe = (d: string) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) {
        if (e !== 'node_modules') gehe(p)
      } else if (/\.tsx$/.test(e)) out.push(p)
    }
  }
  gehe(join(WURZEL, 'src'))
  return out
}

describe('Schieberegler-Trefferflaeche (WCAG 2.2 SC 2.5.8)', () => {
  it('das Element ist mindestens 24 px hoch — die Bahn darf schmal bleiben', () => {
    const hoehe = px(block('input[type="range"] {'), 'height')
    expect(hoehe, 'input[type="range"] hat keine Hoehe in px').not.toBeNull()
    expect(hoehe!).toBeGreaterThanOrEqual(MINDESTHOEHE)
  })

  it('der Griff ist in BEIDEN Browser-Familien mindestens 18 px', () => {
    // Ohne den Firefox-Zweig bliebe es dort beim Standardaussehen, und die
    // Messung stuende nur fuer einen Browser.
    for (const selektor of [
      'input[type="range"]::-webkit-slider-thumb {',
      'input[type="range"]::-moz-range-thumb {',
    ]) {
      const rumpf = block(selektor)
      expect(rumpf, `${selektor} fehlt`).not.toBeNull()
      const breite = px(rumpf, 'width')
      expect(breite, `${selektor} hat keine Breite in px`).not.toBeNull()
      expect(breite!).toBeGreaterThanOrEqual(MINDESTGRIFF)
    }
  })

  it('der Fokusring liegt AUSSEN, nicht unter der Bahn', () => {
    // Die allgemeine Input-Regel zeichnet ihn mit `outline-offset: -1px`. An
    // einem Element, dessen sichtbarer Teil 6 px hoch ist, verschwindet er
    // damit unter der Bahn.
    const rumpf = block('input[type="range"]:focus-visible {')
    expect(rumpf, 'kein eigener Fokusring fuer den Regler').not.toBeNull()
    expect(px(rumpf, 'outline-offset')).toBeGreaterThan(0)
  })

  it('kein einzelner Regler schrumpft sich per Inline-Stil zurueck', () => {
    // Der zweite Weg, und der leisere: das Stilblatt bleibt richtig, aber an
    // EINEM Regler haengt `style={{ height: 4 }}`. Ein Inline-Stil gewinnt
    // gegen jeden Selektor — nur faellt es niemandem auf, weil die anderen
    // stimmen.
    const treffer: string[] = []
    let gefunden = 0
    for (const datei of tsxDateien()) {
      const quelle = readFileSync(datei, 'utf8')
      for (const m of quelle.matchAll(/<input\b[^>]*type="range"[^>]*>/g)) {
        gefunden += 1
        const stil = /style=\{\{([^}]*)\}\}/.exec(m[0])?.[1] ?? ''
        const h = /height:\s*'?(\d+)/.exec(stil)
        if (h && Number(h[1]) < MINDESTHOEHE) {
          treffer.push(`${datei.replace(WURZEL + '/', '')} — ${h[0]}`)
        }
      }
    }
    // Die Gegenprobe zur Pruefung selbst: ein Lauf, der KEINEN Regler findet,
    // waere sonst gruen — und genau so sieht ein kaputtes Muster aus.
    expect(gefunden, 'kein einziger `type="range"` gefunden').toBeGreaterThan(0)
    expect(treffer).toEqual([])
  })
})
