// ───────────────────────────────────────────────────────────────────────────
// Touch- und Stift-Bedienung auf dem iPad (#877) — die Zusagen, die man nicht
// am Bildschirm sieht.
//
// Drei Dinge werden hier gehalten, und alle drei sind Zusagen, die still
// verfallen wuerden:
//
//  1. DER EDITOR IST INSTALLIERBAR. Nicht „es gibt ein Manifest" — der
//     EDITOR-Einstieg muss auf SEIN Manifest zeigen. Vorher hing eines an
//     Viewer und Handy-Ansicht, und wer den Editor auf den Homescreen legte,
//     bekam den Viewer.
//  2. DIE LISTE „geht nur am Desktop" IST VOLLSTAENDIG. Sie wird gegen
//     `bridge.ts` geprueft: jede Domaene, deren Web-Rueckfall die Desktop-App
//     verlangt, steht darin. Sonst waere sie der Kenntnisstand ihres Autors
//     am Tag des Hinschreibens.
//  3. DIE TREFFERFLAECHE DER PORTS WAECHST NACH AUSSEN UND NICHT NACH OBEN.
//     Der falsche Port getroffen ist schlimmer als der Port verfehlt.
// ───────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { nurDesktop } from '../src/renderer/lib/nurDesktop'

const WURZEL = resolve(__dirname, '..')
const lies = (rel: string) => readFileSync(resolve(WURZEL, rel), 'utf8')
const t = (_key: string, fallback?: string) => fallback ?? _key

describe('Der Editor ist installierbar (#877)', () => {
  it('index.html zeigt auf sein EIGENES Manifest', () => {
    const html = lies('index.html')
    expect(html).toContain('editor.webmanifest')
    // Nicht das des Handy-Viewers: das beschreibt eine andere App.
    expect(html).not.toContain('href="manifest.webmanifest"')
  })

  it('der Editor registriert den Service-Worker', () => {
    expect(lies('index.html')).toContain("serviceWorker.register('sw.js')")
  })

  it('das Editor-Manifest startet im Editor und nicht im Viewer', () => {
    const m = JSON.parse(lies('public/editor.webmanifest')) as Record<string, string>
    expect(m.start_url).toBe('index.html')
    expect(m.display).toBe('standalone')
    expect(m.name).toBe('Cable Planner')
  })

  it('der Handy-Viewer behaelt sein eigenes', () => {
    const m = JSON.parse(lies('public/manifest.webmanifest')) as Record<string, string>
    expect(m.name).not.toBe('Cable Planner')
    expect(lies('mobile.html')).toContain('href="manifest.webmanifest"')
  })
})

describe('Was im Browser nicht geht, steht vollstaendig da (#877)', () => {
  // Die Domaenen, deren Web-Rueckfall in `bridge.ts` ausdruecklich die
  // Desktop-App verlangt. Gelesen, nicht gepflegt: wer eine siebte anlegt,
  // wird hier rot, ohne diese Datei zu kennen.
  const bridge = lies('src/renderer/lib/bridge.ts')
  const rueckfall = bridge.slice(bridge.indexOf('const webFallbackApi'))

  const verlangtDesktop = (domaene: string): boolean => {
    // Der Block einer Domaene reicht bis zur naechsten Domaenen-Zeile.
    const start = rueckfall.indexOf(`\n  ${domaene}: {`)
    if (start < 0) return false
    const rest = rueckfall.slice(start + 1)
    const ende = rest.search(/\n {2}[a-zA-Z]+: \{/)
    const block = ende < 0 ? rest : rest.slice(0, ende)
    return /Desktop-App|desktop app/i.test(block)
  }

  it('jede genannte Domaene verlangt dort wirklich den Desktop', () => {
    for (const w of nurDesktop(t)) {
      expect(verlangtDesktop(w.domaene), `${w.domaene} steht in der Liste, verlangt aber keinen Desktop`).toBe(true)
    }
  })

  it('jede Domaene, die den Desktop verlangt, steht in der Liste', () => {
    const genannt = new Set(nurDesktop(t).map((w) => w.domaene))
    const domaenen = [...rueckfall.matchAll(/\n {2}([a-zA-Z]+): \{/g)].map((m) => m[1]!)
    const fehlend = domaenen.filter((d) => verlangtDesktop(d) && !genannt.has(d))
    expect(fehlend, `nicht in lib/nurDesktop.ts: ${fehlend.join(', ')}`).toEqual([])
  })

  it('jeder Eintrag nennt einen Grund und nicht nur ein Nein', () => {
    // „Geht nur am Desktop" saehe aus wie eine Lizenzgrenze, und jemand
    // suchte nach einem Schalter, den es nicht gibt.
    for (const w of nurDesktop(t)) {
      expect(w.grund.length, `${w.domaene} ohne Grund`).toBeGreaterThan(20)
    }
  })

  it('der Scan hat wirklich etwas gesehen', () => {
    // Ein Test, der nichts findet, besteht auch — und sieht dabei gruen aus.
    expect(nurDesktop(t).length).toBeGreaterThanOrEqual(6)
  })
})

describe('Port-Trefferflaechen auf grobem Zeiger (#877)', () => {
  const css = lies('src/renderer/index.css')
  const block = css.slice(css.indexOf('.react-flow__handle::after'))

  it('waechst seitlich um mehr als nach oben', () => {
    // Oben und unten sitzen die Nachbarports. Der falsche Port getroffen ist
    // schlimmer als der Port verfehlt.
    expect(block).toMatch(/top: -2px/)
    expect(block).toMatch(/left: -14px/)
  })

  it('gilt nur fuer grobe Zeiger', () => {
    const vor = css.slice(0, css.indexOf('.react-flow__handle::after'))
    expect(vor.lastIndexOf('@media (pointer: coarse)')).toBeGreaterThan(vor.lastIndexOf('}\n\n.cp-hover-actions'))
  })
})
