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
 *   4. **Menues der Kopfleiste.** Bei der kleinsten geprueften Groesse: was
 *      nicht hineinpasst, muss scrollen koennen. Ein Menue, das weder passt
 *      noch scrollt, hat unerreichbare Eintraege.
 *   5. **Verdeckte Bedienelemente.** Ein schwebendes Element (`position:
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
// und nicht mehr hier — siehe den Kopf jener Datei: sie stand bis 2026-09-11
// in vier Laeufen abgeschrieben. Noetig ist sie wie eh und je: CI hat immer
// ein frisches Profil, und ueber einem Overlay misst dieser Lauf nichts.
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

// ── 5. Die Menues der Kopfleiste ──────────────────────────────────────────
// WARUM AUCH DIE. Gemessen 2026-09-07: das Werkzeuge-Menue war 823 px hoch
// und blieb 823 px hoch auch in einem 800 px hohen Fenster — die letzten
// Eintraege standen unter dem Fensterrand und waren nicht anklickbar. Wieder
// dieselbe Sorte Fehler wie die zwei Register, die aus der Bibliothek fielen.
//
// Geprueft wird deshalb bei der KLEINSTEN Groesse: passt das Menue nicht,
// muss es scrollen koennen. Ein Menue, das weder passt noch scrollt, hat
// unerreichbare Eintraege.
await win.setViewportSize(groessen[groessen.length - 1])
await win.waitForTimeout(600)
const kopfMenues = win.locator('header button[aria-haspopup="menu"]')
const kopfAnzahl = await kopfMenues.count()
for (let i = 0; i < kopfAnzahl; i++) {
  const knopf = kopfMenues.nth(i)
  const name = ((await knopf.innerText()) || `Menue ${i + 1}`).replace(/[\s▾▴]+/g, ' ').trim()
  await knopf.click().catch(() => {})
  await win.waitForTimeout(350)
  const m = await win.evaluate(() => {
    const el = document.querySelector('header [role="menu"], [role="menu"]')
    if (!el) return null
    const r = el.getBoundingClientRect()
    const st = getComputedStyle(el)
    const beschnitten = []
    for (const k of el.querySelectorAll('span')) {
      if (getComputedStyle(k).textOverflow !== 'ellipsis') continue
      if (k.scrollWidth - k.clientWidth < 3) continue
      const t = (k.textContent || '').trim()
      if (t) beschnitten.push(t.slice(0, 30))
    }
    return {
      unten: Math.round(r.bottom),
      fensterHoehe: window.innerHeight,
      inhalt: el.scrollHeight,
      sichtbar: el.clientHeight,
      scrollt: /(auto|scroll)/.test(st.overflowY),
      eintraege: el.querySelectorAll('[role="menuitem"]').length,
      beschnitten,
    }
  })
  await win.keyboard.press('Escape').catch(() => {})
  await win.waitForTimeout(200)
  if (!m) continue
  if (m.inhalt - m.sichtbar > 4 && !m.scrollt) {
    console.error(
      `✗ Menue „${name}" ist ${m.inhalt}px hoch, zeigt ${m.sichtbar}px und scrollt nicht — ` +
        'die unteren Eintraege sind nicht erreichbar',
    )
    befunde += 1
  }
  if (m.unten > m.fensterHoehe + 2) {
    console.error(
      `✗ Menue „${name}" endet bei ${m.unten}px, das Fenster ist ${m.fensterHoehe}px hoch`,
    )
    befunde += 1
  }
  for (const t of m.beschnitten) {
    console.error(`✗ Menue „${name}": Eintrag „${t}" ist beschnitten`)
    befunde += 1
  }
}
console.log(`${kopfAnzahl} Menue(s) der Kopfleiste geprueft`)

// ── 6. Die Dialoge ────────────────────────────────────────────────────────
// WARUM ERST JETZT, UND WAS DAS GEKOSTET HAT. Die Punkte 1 bis 5 messen die
// stehende Oberflaeche und die Menues. Ein Dialog ist beides nicht: er ist zu,
// bis jemand ihn oeffnet, und deshalb hat dieser Guard ihn nie gesehen.
//
// Nachgemessen 2026-09-10: der Analysen-Dialog legt DREIZEHN Reiter in eine
// flex-Zeile, die nicht umbricht. Die letzten drei — „Kabelwege",
// „Signalwege", „Blatt pruefen" — lagen 164 px, 98 px und 5 px ueber der
// rechten Kante, bei 1280x800 wie bei 1500x950. Nicht sichtbar, nicht
// anklickbar. Genau der Befund, aus dem dieser Guard entstanden ist, nur eine
// Ebene tiefer: er war seit Monaten da und niemand hat ihn gesehen, weil die
// Messung an der Tuer stehen blieb.
//
// DIE LISTE DER DIALOGE FUEHRT DIE APP, NICHT DER WAECHTER. Durchgegangen
// wird die Befehlspalette, Eintrag fuer Eintrag ueber die Pfeiltaste — sie
// ist die Registratur, die ohnehin gepflegt wird. Wer morgen einen Dialog
// anlegt und in die Palette haengt, wird hier gemessen, ohne dass jemand eine
// zweite Liste nachzieht. (Dieselbe Lehre wie bei den Dialog-Tests in
// `tests/dialogTastaturbedienung.test.ts`: die Domaene ist die Registratur,
// nicht eine Aufzaehlung im Pruefer.)
//
// Eintraege, die keinen Dialog oeffnen — rueckgaengig, Zoom, Auswahl — fallen
// von selbst heraus: dann steht danach kein zweiter Dialog offen. Die Palette
// selbst wird markiert und ausgenommen; sie traegt `role="dialog"` und waere
// sonst das, was gemessen wird.
await win.setViewportSize(groessen[groessen.length - 1])
await win.waitForTimeout(400)

const paletteAuf = async () => {
  await win.keyboard.press('Control+k')
  await win.waitForTimeout(450)
  return win.evaluate(() => {
    const p = document.querySelector('[role="dialog"]')
    if (!p) return 0
    p.setAttribute('data-cp-palette', '1')
    return p.querySelectorAll('ul > li > button').length
  })
}

const zu = async () => {
  for (let i = 0; i < 3; i++) {
    if ((await win.locator('[role="dialog"]').count()) === 0) return
    await win.keyboard.press('Escape').catch(() => {})
    await win.waitForTimeout(250)
  }
}

await zu()
const befehle = await paletteAuf()
await zu()
if (befehle === 0) {
  throw new Error(
    'Befehlspalette liefert keine Eintraege — die Dialog-Messung waere leer und ' +
      'damit gruen, ohne einen einzigen Dialog angesehen zu haben.',
  )
}

let dialoge = 0
for (let i = 0; i < befehle; i++) {
  const gefunden = await paletteAuf()
  if (gefunden === 0) { await zu(); continue }
  for (let k = 0; k < i; k++) await win.keyboard.press('ArrowDown')
  await win.waitForTimeout(120)
  const name = await win.evaluate((idx) => {
    const p = document.querySelector('[data-cp-palette]')
    const b = p?.querySelectorAll('ul > li > button')[idx]
    return b ? (b.textContent || '').trim().slice(0, 44) : `Eintrag ${idx + 1}`
  }, i)
  await win.keyboard.press('Enter')
  await win.waitForTimeout(1100)

  const d = await win.evaluate(() => {
    const el = document.querySelector('[role="dialog"]:not([data-cp-palette])')
    if (!el) return null
    const kannScrollen = (x) => {
      const st = getComputedStyle(x)
      return /(auto|scroll)/.test(st.overflowX) || /(auto|scroll)/.test(st.overflowY)
    }
    const raus = []
    let sichtbar = 0
    for (const x of el.querySelectorAll('*')) {
      const r = x.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) continue
      sichtbar += 1
      const p = x.parentElement
      if (!p || kannScrollen(p)) continue
      const pr = p.getBoundingClientRect()
      if (pr.width < 40) continue
      const ueber = Math.round(Math.max(r.right - pr.right, pr.left - r.left))
      if (ueber > 2) {
        raus.push({ ueber, text: (x.textContent || '').trim().slice(0, 24) || x.tagName.toLowerCase() })
      }
    }
    return { sichtbar, raus: raus.sort((a, b) => b.ueber - a.ueber).slice(0, 5) }
  })
  await zu()
  if (!d) continue
  dialoge += 1
  // Ein Dialog mit einer Handvoll Elementen ist eine Bestaetigungsfrage und
  // kein Formular; dort ist nichts zu messen, und ihn mitzuzaehlen wuerde die
  // Zahl unten aufblaehen.
  if (d.sichtbar < 12) continue
  for (const x of d.raus) {
    console.error(
      `✗ Dialog „${name}": „${x.text}" ragt ${x.ueber}px aus seinem Rahmen — ` +
        'nicht sichtbar und nicht anklickbar',
    )
    befunde += 1
  }
}
console.log(`${dialoge} Dialog(e) aus der Befehlspalette geprueft`)

await app.close()
console.log(`UI-Overflow fertig → ${OUT} (${befunde} Befund(e))`)
process.exit(befunde > 0 ? 1 : 0)
