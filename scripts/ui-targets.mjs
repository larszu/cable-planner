/**
 * Wie gross sind die Trefferflaechen wirklich? — gemessen am gerenderten
 * Fenster, einmal mit Maus und einmal mit Finger.
 *
 * WARUM ES DAS GIBT. B-44 Teil 2 hat gemessen, welche Funktionen auf einem
 * Tablet gar nicht vorhanden sind, und sie erreichbar gemacht. Der zweite
 * Teil derselben Frage — sind sie auch TREFFBAR? — blieb ausdruecklich offen,
 * und der Grund steht im Backlog: „Eine Trefferflaeche misst man am
 * gerenderten Element, nicht an Klassennamen — `px-1 py-0.5` sagt nichts
 * ueber die Flaeche, solange Zeilenhoehe, Icon-Groesse und `gap` mitreden.
 * Hier eine Zahl aus dem Quelltext zu erfinden waere schlimmer als keine: sie
 * saehe aus wie eine Messung."
 *
 * Genau das loest dieser Lauf: er fragt den Renderer nach
 * `getBoundingClientRect()` und rechnet mit Pixeln, die es wirklich gibt.
 *
 * ZWEI DURCHGAENGE, UND DER ZWEITE IST DER EIGENTLICHE. Unter der Maus sind
 * die Elemente mit `.cp-coarse-only` ausgeblendet (`display: none`) — also
 * ausgerechnet die Griffe, die es NUR fuer den Finger gibt, darunter der
 * Loeschgriff am Kabel-Wegpunkt. Ein Lauf ohne Finger-Durchgang haette sie
 * nie gesehen. Umgekehrt verschwinden unter dem Finger keine, sondern es
 * kommen welche dazu; deshalb sind die beiden Zahlen verschieden und beide
 * gemeint.
 *
 * Der Finger wird ueber CDP eingeschaltet (`Emulation.setTouchEmulationEnabled`
 * plus `setDeviceMetricsOverride{mobile:true}`) — nachgemessen kippt das
 * `(pointer: coarse)` auf `true` und `(hover: hover)` auf `false`.
 * `Emulation.setEmulatedMedia` mit `features:[{name:'pointer'}]` tut es NICHT;
 * das war der erste Versuch und blieb wirkungslos.
 *
 * ZWEI MARKEN, UND SIE SIND NICHT DASSELBE:
 *   • 24 px — WCAG 2.2, Erfolgskriterium 2.5.8 „Target Size (Minimum)",
 *     Konformitaetsstufe AA. Eine NORM mit einer Zahl.
 *   • 44 px — Apple Human Interface Guidelines, 44 pt. Eine
 *     Hersteller-Empfehlung, keine Norm. Das ist die Marke, nach der im
 *     Backlog gefragt wurde, und sie wird hier so genannt, wie sie ist.
 * Beide werden gezaehlt, keine wird als die andere ausgegeben.
 *
 * GEMESSEN WIRD DIE KLEINERE SEITE. Ein Knopf von 200 x 12 px ist mit dem
 * Finger nicht zu treffen, obwohl seine Flaeche gross ist; die Fingerkuppe
 * braucht in BEIDEN Richtungen Platz.
 *
 * WAS ALS EIN ZIEL ZAEHLT:
 *   • nur BLATT-Elemente — ein `<button>`, der einen anderen enthaelt, ist
 *     ein Behaelter und kein Ziel. Sonst zaehlte eine Werkzeugleiste als ein
 *     grosser, bequemer Knopf.
 *   • ein Ankreuzfeld ZUSAMMEN mit seiner Beschriftung: wer auf das Wort
 *     tippt, trifft das Feld. Die Flaeche ist die Vereinigung beider.
 *
 * WAS NICHT MITZAEHLT: `aria-hidden="true"` und alles Unsichtbare. Sonst
 * nichts — insbesondere sind Zieh-Griffe und die Zoom-Knoepfe von ReactFlow
 * hier NICHT ausgenommen, anders als in `ui-labels.mjs`. Dort geht es um
 * Namen, und ein Lupensymbol braucht keinen; hier geht es um Flaeche, und
 * ein Finger unterscheidet nicht, woher ein Knopf stammt.
 *
 * Aufruf: `xvfb-run -a npm run ui:targets` (Linux/headless).
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

// Erststart-Overlays wegklicken — dieselbe Schleife wie in `ui-smoke.mjs` und
// `ui-labels.mjs`, und aus demselben Grund: CI hat immer ein frisches Profil.
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

// EIN LEERER PLAN MISST NICHTS — derselbe Grund wie in `ui-labels.mjs`: die
// schwebenden Bedienelemente entstehen erst, wenn Geraete da sind.
const demo = win.getByRole('button', { name: /Beispielprojekt laden|Load example project/i })
if (await demo.count()) {
  await demo.first().click()
  await win.waitForTimeout(1500)
}
const geraete = await win.locator('.react-flow__node').count()
if (geraete === 0) {
  throw new Error(
    'Kein Geraet auf der Flaeche — die schwebenden Bedienelemente werden dann gar ' +
      'nicht gerendert und die Messung waere wertlos.',
  )
}

await win.setViewportSize({ width: 1500, height: 950 })
await win.waitForTimeout(600)

/** Die Messung laeuft IM Fenster; hier steht nur, was sie zurueckgibt. */
const messen = async () =>
  win.evaluate(() => {
    const AUSWAHL =
      'button, a[href], [role="button"], [role="menuitem"], [role="tab"], [role="switch"],' +
      ' [role="checkbox"], summary, input:not([type="hidden"]), select, textarea'

    /**
     * Sichtbar — und zwar EINSCHLIESSLICH der Vorfahren.
     *
     * Die erste Fassung fragte nur das Element selbst nach `opacity`,
     * `display` und `visibility` — dieselbe Pruefung wie in
     * `ui-labels.mjs`. Sie ist falsch: eine Bedienreihe mit
     * `.cp-hover-actions` steht auf `opacity: 0` am BEHAELTER, ihre Knoepfe
     * haben selbst `opacity: 1`. Wer nur das Element fragt, zaehlt sie mit,
     * obwohl niemand sie sieht.
     *
     * WAS DIE KORREKTUR HIER GEMESSEN GEAENDERT HAT, und nicht mehr: die
     * Zahl `nurGrob` (0 unter der Maus, 1 unter dem Finger). Die drei
     * Ziel-Zahlen blieben gleich — die eine Reihe, die der Finger aufdeckt,
     * traegt auf diesem Bild kein Bedienelement als Blatt. Das ist kein
     * Beweis, dass die Korrektur folgenlos ist; es ist der Stand dieses
     * einen Bildes.
     *
     * `checkVisibility` schaut die Kette hinauf; der Rechteck-Test bleibt
     * daneben, weil ein Element mit 0 px Hoehe sichtbar heisst und trotzdem
     * nicht zu treffen ist.
     */
    const sichtbar = (el) => {
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return false
      return el.checkVisibility({
        opacityProperty: true,
        visibilityProperty: true,
        contentVisibilityAuto: true,
      })
    }

    // Ein Behaelter ist kein Ziel: wer einen anderen Bedienknopf enthaelt,
    // wird nicht als eigene Flaeche gezaehlt.
    const istBlatt = (el) => el.querySelector(AUSWAHL) === null

    /**
     * Die Flaeche, die man wirklich treffen kann.
     *
     * Ein Ankreuzfeld ist 13 x 13 px und waere damit ein Befund — obwohl
     * niemand auf das Kaestchen zielt, sondern auf das Wort daneben. Wo eine
     * Beschriftung dazugehoert, ist das Ziel die Vereinigung von beidem.
     */
    const zielFlaeche = (el) => {
      let { x, y, width, height } = el.getBoundingClientRect()
      let links = x
      let oben = y
      let rechts = x + width
      let unten = y + height
      const dazu = (l) => {
        if (!l || !sichtbar(l)) return
        const r = l.getBoundingClientRect()
        links = Math.min(links, r.x)
        oben = Math.min(oben, r.y)
        rechts = Math.max(rechts, r.x + r.width)
        unten = Math.max(unten, r.y + r.height)
      }
      dazu(el.closest('label'))
      if (el.id) for (const l of document.querySelectorAll(`label[for="${CSS.escape(el.id)}"]`)) dazu(l)
      return { breite: rechts - links, hoehe: unten - oben }
    }

    const ort = (el) =>
      el.closest('header')
        ? 'Kopfleiste'
        : el.closest('footer')
          ? 'Statusleiste'
          : el.closest('[data-cp-canvas-toolbar]')
            ? 'Werkzeugleiste'
            : el.closest('.react-flow__controls')
              ? 'ReactFlow-Zoom'
              : el.closest('.react-flow__node, .react-flow__edge')
                ? 'auf dem Knoten'
                : el.closest('aside, [data-cp-panel]')
                  ? 'Seitenleiste'
                  : 'sonstwo'

    const ziele = []
    for (const el of document.querySelectorAll(AUSWAHL)) {
      if (el.getAttribute('aria-hidden') === 'true') continue
      if (el.closest('[aria-hidden="true"]')) continue
      if (!sichtbar(el) || !istBlatt(el)) continue
      const { breite, hoehe } = zielFlaeche(el)
      ziele.push({
        klein: Math.round(Math.min(breite, hoehe)),
        breite: Math.round(breite),
        hoehe: Math.round(hoehe),
        wo: ort(el),
        tag: el.tagName.toLowerCase(),
        name: (
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          (el.innerText || '').replace(/\s+/g, ' ').trim()
        ).slice(0, 34),
      })
    }
    // Was NUR fuer den groben Zeiger da ist. Ohne diese Zahl waere der
    // zweite Durchgang eine Behauptung: „er sieht mehr" liesse sich nicht
    // nachrechnen, und genau das ist beim ersten Anlauf passiert.
    const nurGrob = [...document.querySelectorAll('.cp-coarse-only, .cp-hover-actions')].filter(
      sichtbar,
    ).length

    return { ziele, nurGrob, coarse: matchMedia('(pointer: coarse)').matches }
  })

/** Zaehlt und gruppiert; gibt aus, was gefunden wurde. */
const auswerten = (name, ziele) => {
  const unter24 = ziele.filter((z) => z.klein < 24)
  const unter44 = ziele.filter((z) => z.klein < 44)
  console.log(`\n── ${name} ──`)
  console.log(
    `${ziele.length} Trefferflaechen · ${unter24.length} unter 24 px (WCAG 2.2 AA) · ` +
      `${unter44.length} unter 44 px (Apple HIG)`,
  )
  const proOrt = new Map()
  for (const z of unter44) proOrt.set(z.wo, (proOrt.get(z.wo) ?? 0) + 1)
  for (const [wo, n] of [...proOrt].sort((a, b) => b[1] - a[1])) {
    const kleinste = unter44
      .filter((z) => z.wo === wo)
      .sort((a, b) => a.klein - b.klein)
      .slice(0, 3)
      .map((z) => `${z.breite}x${z.hoehe}${z.name ? ` „${z.name}"` : ''}`)
    console.log(`  ${wo}: ${n} unter 44 px — kleinste: ${kleinste.join(' · ')}`)
  }
  return { gesamt: ziele.length, unter24: unter24.length, unter44: unter44.length }
}

const maus = await messen()
if (maus.coarse) throw new Error('Der erste Durchgang sollte ein feiner Zeiger sein, ist aber grob.')
const mitMaus = auswerten('Maus (pointer: fine)', maus.ziele)
console.log(`  davon nur fuer groben Zeiger sichtbar: ${maus.nurGrob}`)

// Finger einschalten. Die Fenstergroesse bleibt dieselbe wie oben — sonst
// misst der zweite Durchgang ein anderes Layout und die beiden Zahlen sind
// nicht vergleichbar.
const cdp = await app.context().newCDPSession(win)
await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1500,
  height: 950,
  deviceScaleFactor: 1,
  mobile: true,
})
await win.waitForTimeout(800)

const finger = await messen()
if (!finger.coarse) {
  throw new Error(
    'Die Finger-Nachbildung hat nicht gegriffen — `(pointer: coarse)` ist weiter false. ' +
      'Ohne sie misst dieser Lauf zweimal dasselbe und behauptet trotzdem zwei Antworten.',
  )
}
const mitFinger = auswerten('Finger (pointer: coarse)', finger.ziele)
console.log(`  davon nur fuer groben Zeiger sichtbar: ${finger.nurGrob}`)

// Der Durchgang muss etwas AUFDECKEN, sonst misst er zweimal dasselbe und
// die zweite Zahl behauptet eine Aussage, die sie nicht hat. Genau das war
// beim ersten Anlauf der Fall — der Fehler sass in `sichtbar()`, das die
// Vorfahren nicht mitlas.
if (finger.nurGrob <= maus.nurGrob) {
  throw new Error(
    `Der Finger-Durchgang deckt nichts auf (${maus.nurGrob} -> ${finger.nurGrob}). ` +
      'Entweder greift die Nachbildung nicht, oder die Sichtbarkeits-Pruefung liest ' +
      'die Vorfahren nicht mit. Zwei gleiche Zahlen sind hier kein Ergebnis.',
  )
}

await win.screenshot({ path: join(OUT, 'targets-coarse.png') })
await app.close()

/**
 * DIE ZAHLEN SIND OBERGRENZEN, KEINE ZIELMARKEN.
 *
 * Gemessen am 2026-09-09 auf dem Beispielprojekt, Fenster 1500 x 950:
 * 93 Trefferflaechen, davon 54 unter 24 px und 89 unter 44 px — in BEIDEN
 * Durchgaengen dieselbe Zahl. Sie duerfen sinken, nicht steigen — genau wie
 * das Symbol-Budget in `ui-labels.mjs` und der Sprachmix-Deckel im
 * `sony-camera-bridge`. Ohne Deckel waechst so eine Zahl still zurueck; MIT
 * Deckel muss jeder, der eine neue kleine Flaeche anlegt, sie hier eintragen
 * und begruenden.
 *
 * WAS DIE ZAHLEN SAGEN, ausgeschrieben, damit niemand sie fuer eine
 * Bestandsmeldung haelt: 89 von 93 Bedienflaechen sind kleiner als die
 * Apple-Marke, und 54 unterschreiten die WCAG-NORM. Die kleinste ist
 * 12 x 20 px („Move category" in der Bibliothek). Diese Anwendung ist mit
 * dem Finger heute nicht bequem zu bedienen, und das steht ab jetzt als
 * Zahl da statt als Vermutung — das war der ganze Zweck von B-44s offenem
 * Rest.
 *
 * Warum hier NICHT auf null geprueft wird: eine Anwendung, die auf 1500 px
 * Breite einen Signalfluss, eine Bibliothek und eine Eigenschaftsleiste
 * nebeneinander zeigt, kann nicht jede Zeile 44 px hoch machen — dann passt
 * die Liste nicht mehr aufs Blatt. Der Deckel haelt fest, was ist; welche
 * dieser Flaechen wirklich wachsen SOLLEN, ist eine Gestaltungsfrage und
 * gehoert in eine eigene Runde.
 */
const DECKEL = {
  maus: { unter24: 54, unter44: 89 },
  finger: { unter24: 54, unter44: 89 },
}

let befunde = 0
const pruefe = (name, ist, soll) => {
  for (const marke of ['unter24', 'unter44']) {
    if (ist[marke] > soll[marke]) {
      console.error(
        `✗ ${name}: ${ist[marke]} Flaechen ${marke.replace('unter', 'unter ')} px, ` +
          `erlaubt sind ${soll[marke]}. Entweder die Flaeche vergroessern oder den ` +
          'Deckel in `scripts/ui-targets.mjs` anheben und begruenden.',
      )
      befunde += 1
    }
  }
}
pruefe('Maus', mitMaus, DECKEL.maus)
pruefe('Finger', mitFinger, DECKEL.finger)

console.log(`\nUI-Trefferflaechen fertig (${befunde} Befund(e))`)
process.exit(befunde > 0 ? 1 : 0)
