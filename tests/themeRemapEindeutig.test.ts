import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Der Light-Theme-Remap in `index.css` sagt jede Regel genau einmal — und nur
// fuer Klassen, die es wirklich gibt (UI-Pruefung, Phase 2).
//
// ─── DER BEFUND ────────────────────────────────────────────────────────────
//
// Vier Regeln standen ZWEIMAL da, mit unterschiedlichen Werten:
//
//   Zeile 333: .bg-slate-950\/30 { background-color: rgba(240,244,248,0.7); }
//   Zeile 480: .bg-slate-950\/30 { background-color: rgba(240,244,248,0.3); }
//
// dazu `/40`, `/50` und `/60` in derselben Form. Gleiche Spezifitaet, also
// gewann die spaetere; der Minifier hat die fruehere aus dem Build sogar ganz
// entfernt (nachgesehen in `dist/renderer/assets/*.css`) und im Fenster
// gemessen rendert `bg-slate-950/50` `rgba(240,244,248,0.5)`.
//
// DIE SCHLIMMERE HAELFTE WAR NICHT DER WERT, SONDERN WO DIE TOTE FASSUNG
// STAND: genau unter dem Kommentar, der erklaert, warum es diese Regeln
// ueberhaupt gibt („damit die Context-Menues, Modal-Overlays und Sub-Karten
// im Light-Mode nicht dunkel bleiben"). Wer eine Glasflaeche nachjustieren
// wollte, las dort die Begruendung, aenderte die Zeile darunter — und sah
// nichts passieren. Eine Datei, die ihre eigene Begruendung von ihrer
// Wirkung trennt, kostet jeden, der sie liest, denselben Nachmittag.
//
// ─── DAZU: REGELN FUER KLASSEN, DIE NIEMAND BENUTZT ────────────────────────
//
// Drei Eintraege deckten Klassen ab, die im ganzen Baum nicht vorkommen
// (`bg-sky-950/50`, `border-amber-400`, `border-orange-700/60`) — jeweils
// eine Ziffer neben einer, die es gibt. Das ist die Bewegung, die diese
// Liste auf ueber 200 Eintraege gebracht hat, und das Audit nennt als Ziel
// ausdruecklich, sie schrumpfen zu lassen.
//
// Ein Eintrag ohne Nutzer ist nicht bloss ungenutzt: er sieht beim Lesen aus
// wie eine Deckung, die es nicht gibt. Wer prueft, ob `border-amber-400` im
// Light-Theme behandelt ist, findet eine Zeile und hoert auf zu suchen.
// ---------------------------------------------------------------------------

const WURZEL = process.cwd()
const CSS_PFAD = join(WURZEL, 'src', 'renderer', 'index.css')
const css = readFileSync(CSS_PFAD, 'utf8')

/**
 * Eine einzeilige Regel `[data-theme="light"] … { … }`.
 *
 * Nur einzeilige: die mehrzeiligen Bloecke in dieser Datei sind der
 * Token-Satz und ein paar ReactFlow-Regeln, die kein Klassen-Remap sind.
 */
const REGEL = /^\s*(\[data-theme="light"\][^{]*?)\s*\{\s*([^}]*?)\s*\}\s*$/

interface Regel {
  selektor: string
  wert: string
  zeile: number
}

const regeln = (): Regel[] =>
  css.split('\n').flatMap((z, i) => {
    const m = REGEL.exec(z)
    return m ? [{ selektor: m[1].trim(), wert: m[2].trim(), zeile: i + 1 }] : []
  })

/**
 * Der Klassenname, wie er im JSX steht.
 *
 * Im CSS ist er maskiert (`.hover\:bg-slate-700:hover`, `.bg-slate-950\/50`);
 * gesucht wird bis zum ersten NICHT maskierten `:` — das ist die Pseudoklasse
 * und gehoert nicht mehr zum Namen.
 */
const klasseAus = (selektor: string): string | null => {
  const m = /\[data-theme="light"\]\s*\.((?:[^\s{:,\\]|\\.)+)/.exec(selektor)
  return m ? m[1].replace(/\\/g, '') : null
}

const quelltext = (): string => {
  const sammeln = (dir: string): string[] =>
    readdirSync(dir).flatMap((eintrag) => {
      const pfad = join(dir, eintrag)
      if (statSync(pfad).isDirectory()) return sammeln(pfad)
      if (!/\.(tsx|ts|html)$/.test(pfad)) return []
      return [readFileSync(pfad, 'utf8')]
    })
  return sammeln(join(WURZEL, 'src')).join('\n')
}

describe('Light-Theme-Remap', () => {
  it('findet ueberhaupt Regeln — sonst prueft der Test nichts', () => {
    // Ohne diese Zusicherung waeren beide Regeln unten erfuellt, wenn das
    // Muster nicht mehr passt: eine leere Liste hat keine Doppelten und keine
    // toten Eintraege. Ein Waechter, der bei kaputtem Muster gruen wird,
    // behauptet eine Deckung, die es nicht gibt.
    expect(regeln().length).toBeGreaterThan(150)
  })

  it('sagt jede Regel genau einmal', () => {
    const nachSelektor = new Map<string, Regel[]>()
    for (const r of regeln()) {
      const bisher = nachSelektor.get(r.selektor) ?? []
      bisher.push(r)
      nachSelektor.set(r.selektor, bisher)
    }
    const doppelt = [...nachSelektor.entries()]
      .filter(([, v]) => v.length > 1)
      .map(([selektor, v]) => {
        const werte = new Set(v.map((r) => r.wert))
        const art = werte.size > 1 ? 'WIDERSPRUCH' : 'doppelt'
        return `${art}: ${selektor} in Zeile ${v.map((r) => r.zeile).join(' und ')}`
      })
    expect(
      doppelt,
      `Doppelt deklariert — die spaetere gewinnt, die fruehere ist tot ` +
        `und trotzdem lesbar:\n  ${doppelt.join('\n  ')}`,
    ).toEqual([])
  })

  it('remappt nur Klassen, die es im Baum wirklich gibt', () => {
    const text = quelltext()
    const ohneNutzer = [
      ...new Set(
        regeln()
          .map((r) => klasseAus(r.selektor))
          .filter((k): k is string => k !== null)
          .filter((k) => !text.includes(k)),
      ),
    ].sort()
    expect(
      ohneNutzer,
      `Regeln fuer Klassen, die niemand benutzt — sie sehen beim Lesen aus ` +
        `wie eine Deckung, die es nicht gibt: ${ohneNutzer.join(', ')}`,
    ).toEqual([])
  })

  it('das Klassen-Lesen kommt mit Maskierung zurecht', () => {
    // GEGENPROBE GEGEN DIE EIGENE LESART. Faellt eine dieser Zeilen, zaehlt
    // die Pruefung oben Klassen, die es so nie gab — und meldet dann entweder
    // Unsinn oder gar nichts. Beide Formen kommen in dieser Datei vor.
    expect(klasseAus('[data-theme="light"] .bg-slate-950\\/50')).toBe('bg-slate-950/50')
    expect(klasseAus('[data-theme="light"] .hover\\:bg-slate-700:hover')).toBe('hover:bg-slate-700')
    expect(klasseAus('[data-theme="light"] .text-slate-100')).toBe('text-slate-100')
  })
})
