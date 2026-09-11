/**
 * Bedienelemente ohne Namen finden — der Guard aus der zweiten Beschwerde.
 *
 * NUTZER, 2026-09-07: „Nicht alle Elemente sind beschriftet und man erkennt
 * nicht auf den ersten Blick was jedes Element das man anklickt verursacht."
 *
 * Ein Knopf, der nur ein Symbol traegt, ist fuer den Nutzer stumm, sobald das
 * Symbol nicht selbsterklaerend ist — und stumm fuer jede Vorlesehilfe ist er
 * ohnehin. Was ihn erklaert, ist ein NAME: sichtbarer Text, `aria-label`,
 * `title` oder `aria-labelledby`. Fehlt alles davon, gibt es fuer diesen Knopf
 * keine Auskunft, die man nachschlagen koennte.
 *
 * WAS GEZAEHLT WIRD, und was nicht:
 *
 *   * Gezaehlt wird, was klickbar ist und SICHTBAR: `button`, `a[href]`,
 *     `[role=button]`, `summary`, dazu Formularfelder ohne Beschriftung.
 *   * NICHT gezaehlt werden Griffe zum Ziehen (`[data-cp-drag-handle]`),
 *     die ReactFlow-Flaeche und alles, was `aria-hidden` traegt: ein
 *     Zieh-Griff ist kein Knopf, er loest keine Aktion aus, und ein Name
 *     dafuer waere eine Erfindung.
 *   * Ein Formularfeld gilt als benannt, wenn ein `label` darauf zeigt —
 *     ueber `for` oder weil es das Feld umschliesst.
 *
 * Der Guard laeuft gegen die GEBAUTE App mit geladenem Beispielprojekt, aus
 * demselben Grund wie `ui:overflow`: auf einem leeren Plan existiert die
 * Haelfte der Oberflaeche nicht, und die Messung waere wertlos.
 *
 * Voraussetzungen: `npm run build` vorher, unter Linux
 * `xvfb-run -a npm run ui:labels`.
 */
import { _electron as electron } from 'playwright-core'
import { erststartOverlayWeg } from './lib/erststartOverlay.mjs'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT = process.env.CP_UI_SHOTS || join(tmpdir(), 'cable-planner-ui-shots')
mkdirSync(OUT, { recursive: true })

const app = await electron.launch({ args: ['.', '--no-sandbox', '--disable-gpu'] })
const win = await app.firstWindow({ timeout: 30000 })
await win.waitForLoadState('domcontentloaded')
await win.waitForTimeout(3500)

// Erststart-Overlays wegklicken. Die Regel liegt in `lib/erststartOverlay.mjs`
// und nicht mehr hier: sie stand bis 2026-09-11 in vier Laeufen abgeschrieben,
// und ein Fehler darin ueberlebte in drei davon, nachdem der vierte repariert
// war. Aus demselben Grund wie eh und je noetig: CI hat immer ein frisches
// Profil, und ueber einem Overlay misst dieser Lauf nichts Brauchbares.
await erststartOverlayWeg(win)

// EIN LEERER PLAN MISST NICHTS. Mehrere schwebende Elemente — allen voran die
// Geraete-Suche — werden erst gerendert, wenn Geraete existieren
// (`project.equipment.length > 0` in `CanvasArea`). Auf dem frischen
// CI-Profil ist der Plan leer, und der Guard waere gruen, weil die Haelfte der
// Oberflaeche gar nicht da ist. Deshalb wird das Beispielprojekt geladen —
// ueber den Knopf im Empty-State, also auf demselben Weg wie ein Nutzer.
const demo = win.getByRole('button', { name: /Beispielprojekt laden|Load example project/i })
if (await demo.count()) {
  await demo.first().click()
  await win.waitForTimeout(1500)
}
const geraete = await win.locator('.react-flow__node').count()
if (geraete === 0) {
  throw new Error(
    'Kein Geraet auf der Flaeche — die schwebenden Elemente (Suche, Inline-Toolbar) ' +
      'werden dann gar nicht gerendert und die Messung waere wertlos.',
  )
}
console.log(`Messgrundlage: ${geraete} Geraet(e) auf der Flaeche`)

/** Die Messung laeuft IM Fenster; hier steht nur, was sie zurueckgibt. */
const namenlose = async () =>
  win.evaluate(() => {
    // Sichtbar EINSCHLIESSLICH der Vorfahren. Die erste Fassung fragte nur
    // das Element selbst — und uebersah damit genau den Fall, den es hier
    // gibt: eine Bedienreihe mit `.cp-hover-actions` steht auf `opacity: 0`
    // am BEHAELTER, ihre Knoepfe haben selbst `opacity: 1`. Sie galten als
    // sichtbar, obwohl unter der Maus niemand sie sieht. Gefunden beim Bau
    // von `ui-targets.mjs`, wo derselbe Fehler den zweiten Messdurchgang
    // wertlos gemacht haette.
    const sichtbar = (el) => {
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return false
      return el.checkVisibility({
        opacityProperty: true,
        visibilityProperty: true,
        contentVisibilityAuto: true,
      })
    }
    const beschriftet = (el) => {
      if (el.getAttribute('aria-hidden') === 'true') return true
      const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
      // Ein reines Symbolzeichen ist kein Name: „⤢" sagt niemandem etwas.
      const echterText = text.replace(/[^\p{L}\p{N}]/gu, '').length > 0
      if (echterText) return true
      if ((el.getAttribute('aria-label') || '').trim()) return true
      if ((el.getAttribute('title') || '').trim()) return true
      const beschreibt = el.getAttribute('aria-labelledby')
      if (beschreibt && beschreibt.split(/\s+/).some((id) => document.getElementById(id))) return true
      // Ein Bild mit Alternativtext benennt den Knopf, der es enthaelt.
      for (const bild of el.querySelectorAll('img[alt], svg title')) {
        if ((bild.getAttribute('alt') || bild.textContent || '').trim()) return true
      }
      if (el.id) {
        for (const l of document.querySelectorAll(`label[for="${CSS.escape(el.id)}"]`)) {
          if ((l.innerText || '').trim()) return true
        }
      }
      if (el.closest('label') && (el.closest('label').innerText || '').trim()) return true
      return false
    }
    // Was NICHT als stummer Knopf zaehlt:
    //  * Zieh-Griffe (`data-cp-drag-handle`) — sie loesen nichts aus.
    //  * Die Zoom-Knoepfe von ReactFlow (`.react-flow__controls`) — sie
    //    stammen nicht aus diesem Quelltext, und Lupe-Plus, Lupe-Minus und
    //    Rahmen-anpassen sind in jedem Zeichenprogramm dieselben.
    const wegLassen = (el) =>
      !!el.closest(
        '[data-cp-drag-handle], .react-flow__renderer, .react-flow__controls, [aria-hidden="true"]',
      )

    const auswahl = 'button, a[href], [role="button"], summary, input:not([type="hidden"]), select, textarea'
    const funde = []
    for (const el of document.querySelectorAll(auswahl)) {
      if (!sichtbar(el) || wegLassen(el) || beschriftet(el)) continue
      const pfad = []
      for (let n = el; n && n !== document.body && pfad.length < 4; n = n.parentElement) {
        const marke = n.getAttribute?.('data-cp-panel') || n.getAttribute?.('data-testid')
        pfad.unshift(marke || n.tagName.toLowerCase() + (n.className && typeof n.className === 'string' ? '.' + n.className.split(/\s+/).slice(0, 2).join('.') : ''))
      }
      const r = el.getBoundingClientRect()
      funde.push({
        tag: el.tagName.toLowerCase(),
        typ: el.getAttribute('type') || '',
        wo: pfad.join(' > ').slice(0, 140),
        text: (el.innerText || '').trim().slice(0, 20),
        x: Math.round(r.x),
        y: Math.round(r.y),
      })
    }
    // ZWEITE ZAEHLUNG, und sie ist die eigentliche Antwort auf die
    // Beschwerde: ein Knopf KANN einen Namen haben und trotzdem stumm
    // aussehen, wenn der Name nur im `title` steht und erst beim Verweilen
    // erscheint. „Man erkennt nicht auf den ersten Blick, was jedes Element
    // verursacht" beschreibt genau das.
    const nurSymbol = []
    for (const el of document.querySelectorAll('button, [role="button"]')) {
      if (!sichtbar(el) || wegLassen(el)) continue
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim()
      if (text.replace(/[^\p{L}\p{N}]/gu, '').length > 0) continue
      const behaelter =
        el.closest('header')
          ? 'Kopfleiste'
          : el.closest('footer')
            ? 'Statusleiste'
            : el.closest('[data-cp-canvas-toolbar]')
              ? 'Werkzeugleiste'
              : el.closest('aside, [data-cp-panel]')
                ? 'Seitenleiste'
                : 'sonstwo'
      nurSymbol.push({
        wo: behaelter,
        name: (el.getAttribute('aria-label') || el.getAttribute('title') || '').slice(0, 40),
      })
    }
    return {
      funde,
      nurSymbol,
      gesamt: document.querySelectorAll(auswahl).length,
    }
  })

await win.setViewportSize({ width: 1500, height: 950 })
await win.waitForTimeout(600)
const { funde, nurSymbol, gesamt } = await namenlose()
console.log(`${gesamt} Bedienelemente im Fenster, ${funde.length} ohne Namen`)
const proOrt = new Map()
for (const s of nurSymbol) proOrt.set(s.wo, [...(proOrt.get(s.wo) ?? []), s.name])
console.log(`${nurSymbol.length} davon tragen NUR ein Symbol (Name erst beim Verweilen):`)
for (const [ort, namen] of [...proOrt].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${ort}: ${namen.length} — ${namen.join(' · ')}`)
}
for (const f of funde) {
  console.error(`✗ <${f.tag}${f.typ ? ` type=${f.typ}` : ''}> ohne Namen bei ${f.x},${f.y} — ${f.wo}`)
}

/**
 * WAS UEBRIG BLEIBT, und warum es bleiben darf. Acht Knoepfe tragen nur ein
 * Symbol, und alle acht sind Zeichen, die ueberall dasselbe heissen:
 *
 *   ‹  Bibliothek einklappen        ‹  Eigenschaften einklappen
 *   +  Neues Geraet / Kategorie     ⏷  Filter und Ansicht
 *   ↶  Rueckgaengig (Ctrl+Z)        ↷  Wiederholen (Ctrl+Y)
 *   ×  Geraete-Suche schliessen     ×  Werkzeugleiste schliessen
 *
 * DIE BEIDEN LETZTEN KAMEN AM 2026-09-11 DAZU (cable#852), und dieser Lauf
 * hat sie gemeldet, wie er soll — 8 statt 6. Sie bleiben ohne Wort, und das
 * ist hier die Begruendung, die die Regel oben verlangt:
 *
 *   Beide sitzen auf einer Leiste, die UEBER dem Plan schwebt, und beide
 *   raeumen genau diese Leiste weg. Ein danebengeschriebenes „Schliessen"
 *   verbraucht von der Flaeche, um die es bei der Aenderung ueberhaupt geht
 *   — die Nutzer-Meldung lautete, dass die Leisten Platz wegnehmen. Ein
 *   Wort gegen eben diesen Platz einzutauschen waere die Aenderung
 *   rueckwaerts.
 *
 *   Sie sind trotzdem nicht stumm: beide tragen einen `title`, der nicht nur
 *   „Schliessen" sagt, sondern den Weg zurueck nennt („Ansicht-Menue oder
 *   Strg+F holt sie zurueck"). Das ist bei einer Sache, die nach dem Klick
 *   unsichtbar ist, die eigentlich wichtige Auskunft, und die passt in kein
 *   Knopf-Label.
 *
 *   Und der Weg zurueck steht ausgeschrieben im Ansicht-Menue, mit Haken.
 *   Wer das Symbol nicht deutet, findet die Leiste dort in Worten wieder —
 *   `tests/leistenSchliessen.test.ts` haelt das Paar fest.
 *
 * Die Zahl ist eine OBERGRENZE und keine Zielmarke: wer einen neunten
 * symbolgleichen Knopf anlegt, traegt ihn hier ein und sagt, warum er ohne
 * Wort auskommt. Ohne diese Grenze waechst die Zahl wieder still — sie war
 * schon einmal bei 32.
 */
const BUDGET = 8
let befunde = funde.length
if (nurSymbol.length > BUDGET) {
  console.error(
    `✗ ${nurSymbol.length} Knoepfe tragen nur ein Symbol, erlaubt sind ${BUDGET}. ` +
      'Entweder ein Wort danebenschreiben oder die Grenze im Skript begruenden.',
  )
  befunde += 1
}

await app.close()
console.log(`UI-Labels fertig (${befunde} Befund(e))`)
process.exit(befunde > 0 ? 1 : 0)
