/**
 * Abgeschnittene Bedienelemente finden — der Guard aus einem echten Befund.
 *
 * WORAN ER ENTSTANDEN IST (2026-09-07). Der Nutzer schrieb: „die linke
 * Equipment-Leiste, da kann man Equipment lesen, aber Cable schon nicht mehr."
 * Nachgemessen im laufenden Fenster: die Register-Zeile der Bibliothek war
 * 235 px breit, ihr Inhalt 390 px. „Gruppen" und „Racks" lagen VOLLSTAENDIG
 * ausserhalb — nicht sichtbar, nicht anklickbar, bei jeder Fenstergroesse,
 * weil das Panel 260 px fest breit ist. Zwei von vier Registern gab es fuer
 * den Nutzer nicht.
 *
 * KEIN TEST KONNTE DAS SEHEN. `vitest` rendert nicht, misst nichts und kennt
 * keine Schriftbreiten; `ui:smoke` schiesst Screenshots und prueft, dass jedes
 * Menue Eintraege oeffnet — beide waren gruen. Ein Bedienelement, das aus
 * seinem Behaelter faellt, ist genau die Sorte Fehler, die nur eine MESSUNG im
 * echten Fenster findet.
 *
 * WAS ER PRUEFT, und warum in dieser Form:
 *
 *   1. **Abgeschnittene Reihen.** Ein Element, dessen Inhalt breiter ist als
 *      sein sichtbarer Bereich, OHNE dass es scrollen kann. Gemeldet wird nur,
 *      wenn dabei ein KIND ueber die rechte Kante hinausragt — ein zu langer
 *      Text in einer Zelle ist ein Anzeigedetail, ein herausgefallener Knopf
 *      ist ein verlorenes Feature.
 *   2. **Abgeschnittene Beschriftungen.** Ein Register, das per `truncate`
 *      auf „Grup…" schrumpft, faellt aus keiner Reihe heraus und ist trotzdem
 *      unlesbar — und genau so war die Beschwerde formuliert („Equipment kann
 *      man lesen, Cable schon nicht mehr").
 *   3. **Klappmenues der Werkzeugleiste.** Sie werden geoeffnet und
 *      einzeln vermessen — ein Menue, das ueber den Fensterrand laeuft, ist
 *      halb unlesbar, und offen sieht die Messung von aussen es nie.
 *   4. **Verdeckte Bedienelemente.** Ein schwebendes Element (`position:
 *      absolute/fixed`) liegt ueber einem Knopf und faengt dessen Klicks ab.
 *      Geprueft wird nicht die Ueberlappung an sich — die ist bei Menues,
 *      Dialogen und Tooltips gewollt —, sondern nur bei Elementen, die
 *      DAUERHAFT stehen: keine offenen Menues, keine Modals.
 *
 * Beides wird ueber `document.elementFromPoint` bestaetigt und nicht bloss aus
 * Rechtecken geschlossen: ein Knopf, der laut Geometrie verdeckt waere, aber
 * beim Antippen doch getroffen wird, ist keiner.
 *
 * Voraussetzungen wie bei `ui:smoke`: `npm run build` vorher, unter Linux
 * `xvfb-run -a npm run ui:overflow`.
 */
import { _electron as electron } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT = process.env.CP_UI_SHOTS || join(tmpdir(), 'cable-planner-ui-shots')
mkdirSync(OUT, { recursive: true })

const app = await electron.launch({ args: ['.', '--no-sandbox', '--disable-gpu'] })
const win = await app.firstWindow({ timeout: 30000 })
await win.waitForLoadState('domcontentloaded')
await win.waitForTimeout(3500)

// Erststart-Overlays wegklicken — dieselbe Schleife wie in `ui-smoke.mjs`,
// und aus demselben Grund: CI hat immer ein frisches Profil.
const abweisungen =
  /End tour|Tour beenden|Beenden|Skip|Überspringen|Fertig|Decide later|Später|Schließen|Close/i
for (let runde = 0; runde < 6; runde++) {
  if ((await win.locator('.cp-modal-backdrop').count()) === 0) break
  const b = win.getByRole('button', { name: abweisungen })
  if (await b.count()) await b.first().click({ timeout: 1500 }).catch(() => {})
  await win.keyboard.press('Escape').catch(() => {})
  await win.waitForTimeout(400)
}
if ((await win.locator('.cp-modal-backdrop').count()) > 0) {
  throw new Error('Erststart-Overlay liess sich nicht schliessen — Messung waere wertlos.')
}

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
const messen = () =>
  win.evaluate(() => {
    const sichtbar = (el) => {
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) return false
      const st = getComputedStyle(el)
      return st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) > 0.05
    }

    // ── 1. Abgeschnittene Reihen ──────────────────────────────────────────
    const abgeschnitten = []
    for (const el of document.querySelectorAll('div, nav, aside, ul, section, header, footer')) {
      const st = getComputedStyle(el)
      // Was scrollen darf, ist nicht abgeschnitten, sondern scrollbar.
      if (/(auto|scroll)/.test(st.overflowX)) continue
      // Die Zeichenflaeche selbst ist ausgenommen: dort LIEGT Inhalt
      // ausserhalb des Sichtfensters, dafuer gibt es Schwenken und Zoomen.
      // Ein Knoten rechts vom Rand ist kein verlorenes Bedienelement,
      // sondern ein Geraet, zu dem man hinfaehrt.
      if (el.closest('.react-flow__viewport, .react-flow__nodes, .react-flow__edgelabel-renderer')) continue
      if (el.classList.contains('react-flow__nodes') || el.classList.contains('react-flow__edgelabel-renderer')) continue
      if (el.clientWidth < 40) continue
      if (el.scrollWidth - el.clientWidth < 12) continue
      const r = el.getBoundingClientRect()
      const raus = [...el.children]
        .filter((c) => sichtbar(c) && c.getBoundingClientRect().left > r.right - 4)
        .map((c) => (c.textContent || '').trim().slice(0, 24) || c.tagName.toLowerCase())
      if (!raus.length) continue
      abgeschnitten.push({
        wo: (el.className || '').toString().slice(0, 60),
        breite: el.clientWidth,
        inhalt: el.scrollWidth,
        unerreichbar: raus,
      })
    }

    // ── 2. Abgeschnittene BESCHRIFTUNGEN ──────────────────────────────────
    // Der Ausloeser dieses Guards war woertlich: „da kann man Equipment
    // lesen, aber Cable schon nicht mehr." Ein Register, das per `truncate`
    // auf „Grup…" schrumpft, faellt aus KEINER Reihe heraus und ist trotzdem
    // nicht mehr lesbar. Gemeldet wird deshalb jede Beschriftung IN einem
    // Bedienelement, deren Text breiter ist als ihr sichtbarer Bereich.
    const beschnitten = []
    for (const knopf of document.querySelectorAll('button, [role="tab"], a[href]')) {
      if (!sichtbar(knopf)) continue
      for (const el of [knopf, ...knopf.querySelectorAll('span, div')]) {
        const st = getComputedStyle(el)
        if (st.textOverflow !== 'ellipsis' && st.overflow !== 'hidden') continue
        if (el.scrollWidth - el.clientWidth < 3) continue
        const text = (el.textContent || '').trim()
        if (!text) continue
        beschnitten.push({
          text: text.slice(0, 30),
          sichtbar: el.clientWidth,
          noetig: el.scrollWidth,
        })
        break
      }
    }

    // ── 3. Verdeckte Bedienelemente ───────────────────────────────────────
    // Nur DAUERHAFT stehende Overlays: ein offenes Menue oder ein Modal darf
    // decken, das ist seine Aufgabe.
    const verdeckt = []
    if (!document.querySelector('.cp-modal-backdrop, [role="menu"]')) {
      for (const knopf of document.querySelectorAll('button, [role="tab"], input, select')) {
        if (!sichtbar(knopf)) continue
        if (knopf.disabled) continue
        const r = knopf.getBoundingClientRect()
        const x = Math.round(r.left + r.width / 2)
        const y = Math.round(r.top + r.height / 2)
        const oben = document.elementFromPoint(x, y)
        if (!oben || knopf.contains(oben) || oben.contains(knopf)) continue
        // Was liegt drueber, und schwebt es?
        let p = oben
        let schweber = null
        while (p && p !== document.body) {
          const ps = getComputedStyle(p)
          if (ps.position === 'absolute' || ps.position === 'fixed') { schweber = p; break }
          p = p.parentElement
        }
        if (!schweber) continue
        verdeckt.push({
          knopf: (knopf.textContent || knopf.getAttribute('aria-label') || knopf.tagName).trim().slice(0, 30),
          durch: (schweber.className || '').toString().slice(0, 60) ||
            (schweber.textContent || '').trim().slice(0, 30),
        })
      }
    }
    return { abgeschnitten, beschnitten, verdeckt }
  })

const groessen = [
  { width: 1500, height: 950 },
  { width: 1280, height: 800 },
]

let befunde = 0
for (const g of groessen) {
  await win.setViewportSize(g)
  await win.waitForTimeout(900)
  const { abgeschnitten, beschnitten, verdeckt } = await messen()
  const name = `${g.width}x${g.height}`
  await win.screenshot({ path: join(OUT, `overflow-${name}.png`) })
  if (!abgeschnitten.length && !beschnitten.length && !verdeckt.length) {
    console.log(`OK ${name}: nichts abgeschnitten, nichts beschnitten, nichts verdeckt`)
    continue
  }
  for (const a of abgeschnitten) {
    console.error(
      `✗ ${name}: Reihe ${a.breite}px breit, Inhalt ${a.inhalt}px — ` +
        `unerreichbar: ${a.unerreichbar.join(', ')}  [${a.wo}]`,
    )
    befunde += 1
  }
  for (const b of beschnitten) {
    console.error(
      `✗ ${name}: Beschriftung „${b.text}" ist beschnitten — ` +
        `${b.sichtbar}px sichtbar, ${b.noetig}px noetig`,
    )
    befunde += 1
  }
  for (const v of verdeckt) {
    console.error(`✗ ${name}: „${v.knopf}" liegt unter einem schwebenden Element  [${v.durch}]`)
    befunde += 1
  }
}

// ── 4. Die Klappmenues der Werkzeugleiste ─────────────────────────────────
// WARUM SIE EINEN EIGENEN DURCHGANG BRAUCHEN. Die Messung oben sieht nur, was
// offen auf dem Schirm steht; ein Menue, das erst auf Klick aufgeht, ist dabei
// nicht dabei. Genau dort ist am 2026-09-07 der naechste Fehler derselben Art
// entstanden: das neue „Sperren"-Menue klappte nach RECHTS auf, lief in den
// Inspector und stand als „Keine Waypoint-Bearbeitun" da. Aufgefallen ist es
// wieder an einem Screenshot — also wird jetzt auch geklickt.
await win.setViewportSize(groessen[0])
await win.waitForTimeout(600)
// `[▾▴]`, nicht nur `▾`: der Pfeil dreht sich beim Oeffnen um. Mit nur `▾`
// faellt der gerade offene Knopf aus dem Treffersatz und alle folgenden
// Indizes verschieben sich — der zweite Durchlauf lief dann in einen Timeout.
const klappknoepfe = win.locator('[data-cp-canvas-toolbar] button', { hasText: /[▾▴]/ })
const anzahl = await klappknoepfe.count()
for (let i = 0; i < anzahl; i++) {
  const knopf = klappknoepfe.nth(i)
  const name = ((await knopf.innerText()) || `Menue ${i + 1}`).replace(/\s+/g, ' ').trim()
  await knopf.click().catch(() => {})
  await win.waitForTimeout(350)
  const menue = await win.evaluate(() => {
    const m = document.querySelector('[role="menu"]')
    if (!m) return null
    const r = m.getBoundingClientRect()
    const beschnitten = []
    for (const el of m.querySelectorAll('span, div, button')) {
      const st = getComputedStyle(el)
      if (st.textOverflow !== 'ellipsis' && st.overflow !== 'hidden') continue
      if (el.scrollWidth - el.clientWidth < 3) continue
      const txt = (el.textContent || '').trim()
      if (txt) beschnitten.push(txt.slice(0, 30))
    }
    // GEGEN WEN wird gemessen: nicht gegen das Fenster, sondern gegen den
    // ersten Vorfahren, der ueberhaupt abschneidet. Das linksbuendige
    // „Sperren"-Menue lief in den Inspector und war dort halb weg — im
    // FENSTER lag es trotzdem vollstaendig drin. Wer gegen `innerWidth`
    // prueft, sieht diesen Fall nie.
    let klammer = m.parentElement
    let kRect = null
    while (klammer && klammer !== document.body) {
      const ks = getComputedStyle(klammer)
      if (/(hidden|clip|auto|scroll)/.test(ks.overflowX) || /(hidden|clip)/.test(ks.overflow)) {
        kRect = klammer.getBoundingClientRect()
        break
      }
      klammer = klammer.parentElement
    }
    const grenze = kRect
      ? { links: Math.round(kRect.left), rechts: Math.round(kRect.right), was: (klammer.className || '').toString().slice(0, 40) || 'Vorfahre' }
      : { links: 0, rechts: window.innerWidth, was: 'Fenster' }
    return {
      links: Math.round(r.left),
      rechts: Math.round(r.right),
      grenze,
      beschnitten,
    }
  })
  await win.keyboard.press('Escape').catch(() => {})
  await win.waitForTimeout(200)
  if (!menue) continue
  // Laeuft das Menue ueber den Fensterrand hinaus? Dann ist ein Teil davon
  // nicht lesbar, ganz gleich wie der Text formatiert ist.
  if (menue.rechts > menue.grenze.rechts || menue.links < menue.grenze.links) {
    console.error(
      `✗ Menue „${name}" laeuft aus seinem Rahmen (${menue.grenze.was}): ` +
        `Menue ${menue.links}..${menue.rechts}, Rahmen ${menue.grenze.links}..${menue.grenze.rechts}`,
    )
    befunde += 1
  }
  for (const t of menue.beschnitten) {
    console.error(`✗ Menue „${name}": Text „${t}" ist beschnitten`)
    befunde += 1
  }
}
console.log(`${anzahl} Klappmenue(s) der Werkzeugleiste geprueft`)

await app.close()
console.log(`UI-Overflow fertig → ${OUT} (${befunde} Befund(e))`)
process.exit(befunde > 0 ? 1 : 0)
