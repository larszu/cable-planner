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
// in FUENF Laeufen abgeschrieben, dieser war der fuenfte. Noetig ist sie wie
// eh und je: CI hat immer ein frisches Profil.
await erststartOverlayWeg(win)

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

/**
 * Messen, bis sich die Zahl nicht mehr aendert.
 *
 * ─── WARUM DAS NOETIG WURDE (2026-09-28) ───────────────────────────────────
 *
 * Bis hierher stand die Szene auf festen Wartezeiten (`waitForTimeout(1500)`
 * nach dem Beispielprojekt, 600 ms nach der Fenstergroesse). Das trug,
 * solange die Bibliothek ein paar hundert Vorlagen hatte.
 *
 * Mit 1831 Eintraegen traegt es nicht mehr. GEMESSEN an drei Laeufen
 * hintereinander, gleicher Baum, gleiche Bedingungen: Maus 110 / 108 / 108,
 * Finger 165 / 143 / 143. Die Seitenleiste war je nach Lauf verschieden weit
 * aufgebaut, und die Messung fing mal mehr, mal weniger Zeilen.
 *
 * Eine Zahl, die sich zwischen zwei Laeufen um 22 unterscheidet, ist keine
 * Messung — und ein Deckel darauf waere ein flackerndes Gate. Genau davor
 * warnt der Kopf dieser Datei: „Hier eine Zahl aus dem Quelltext zu erfinden
 * waere schlimmer als keine: sie saehe aus wie eine Messung."
 *
 * Also wird nicht laenger gewartet, sondern GEPRUEFT: dieselbe Anzahl mehrmals
 * hintereinander heisst, der Aufbau steht.
 *
 * ─── UND WARUM „ZWEIMAL DASSELBE" NICHT GENUEGT HAT (noch am 2026-09-28) ───
 *
 * Mit zwei gleichen Messungen in Folge gab derselbe Baum in einem Lauf 112 und
 * im naechsten 178 Trefferflaechen. Innerhalb eines Laufes war die Zahl also
 * ruhig, zwischen zwei Laeufen um 66 verschieden. Zwei gleiche Messungen
 * beweisen eben nicht, dass der Aufbau FERTIG ist — nur, dass er in diesen
 * 400 ms nicht gewachsen ist.
 *
 * ─── ZWEI GRUPPEN FEHLTEN, UND DIE ERSTE DIAGNOSE NANNTE NUR EINE ──────────
 *
 * Hier stand zuerst, der Unterschied seien die Port-Griffe auf den Knoten
 * gewesen. Das war zu schnell. Nachgerechnet: 178 - 112 = 66, und die
 * Knoten-Gruppe ist 73 gross — die Zahl geht gar nicht auf. Gemessen liegen
 * 60 der 66 fehlenden Flaechen in der BIBLIOTHEKS-SEITENLEISTE. Die Knoten
 * standen in beiden Laeufen.
 *
 * Beide Gruppen bauen sich nach, und beide aus demselben Grund:
 *
 *   • Ein ReactFlow-Knoten ist 0 x 0 px, bis er vermessen ist; seine Griffe
 *     fallen so lange durch den Rechteck-Test in `sichtbar()`. Sie stehen im
 *     DOM, haben aber keine Flaeche — deshalb fragt `szeneFertig` nach der
 *     FLAECHE und nicht nach dem Vorhandensein.
 *   • Die Bibliothek fuehrt 1827 Vorlagen und baut ihre Liste nach. Eine
 *     leere Leiste kommt genauso zur Ruhe wie eine volle.
 *
 * DESHALB EINE BEDINGUNG UND NICHT NUR EINE WARTESCHLEIFE: gewartet wird, bis
 * BEIDE Gruppen mit Flaeche dastehen (`szeneFertig`), und erst danach auf Ruhe
 * geprueft — und die braucht jetzt DREI gleiche Messungen. Eine Zahl, die
 * zwischen zwei Laeufen um 66 schwankt, ist keine Messung, und ein Deckel
 * darauf waere ein Gate, das wuerfelt.
 *
 * `knotenGeprueft` weist danach zurueck, was trotzdem ohne eine der beiden
 * Gruppen gemessen wurde. Warum das noetig ist, obwohl es schon einen Deckel
 * gibt: ein Deckel meldet nur „zu viele". Der blinde Lauf ergab 112 gegen
 * einen Deckel von 171 und war damit GRUEN.
 */

/**
 * Steht die Szene — Knoten UND Seitenleiste?
 *
 * Die Bedingung, an der sich „fertig aufgebaut" festmachen laesst, ohne eine
 * Zahl zu behaupten — je Gruppe ein Merkmal, das es nur im fertigen Zustand
 * gibt:
 *
 *   Knoten        `role="button"` INNERHALB eines `.react-flow__node` — die
 *                 Port-Griffe.
 *   Seitenleiste  `.cp-hover-actions` — die Bedienreihe einer Listenzeile.
 *
 * Gefragt wird nach ROLLE und KLASSE, nicht nach einem Beschriftungstext: der
 * haengt an der Sprache, und dieser Lauf soll in jeder laufen.
 */
const szeneFertig = async () =>
  win.evaluate(() => {
    // NICHT „steht im DOM", SONDERN „HAT FLAECHE". Der erste Anlauf fragte nur
    // nach `length > 0` — und das war von der ersten Millisekunde an wahr, weil
    // ReactFlow den Knoten samt Griffen sofort rendert und ERST DANACH
    // vermisst. Bis zur Vermessung ist der Knoten 0 x 0 px, seine Griffe fallen
    // durch den Rechteck-Test in `sichtbar()`, und die Bedingung war erfuellt,
    // waehrend die Messung noch um 66 Flaechen zu klein war. Gemessen: derselbe
    // Baum gab weiter 112 statt 178.
    //
    // Gefragt wird deshalb nach dem, worauf es ankommt — einer Flaeche, die man
    // treffen koennte.
    const mitFlaeche = (el) => {
      const r = el.getBoundingClientRect()
      return r.width >= 1 && r.height >= 1
    }
    const griffe = [...document.querySelectorAll('.react-flow__node [role="button"]')]
    // UND DIE SEITENLEISTE. Das ist die zweite Haelfte, und sie hat gefehlt:
    // nachgemessen sind 178 - 112 = 66 Flaechen Unterschied, davon liegen 60
    // in der Bibliotheks-Seitenleiste und nur der Rest woanders. Die Knoten
    // waren also gar nicht das Wackelnde — sie standen in beiden Faellen.
    //
    // Die Bibliothek fuehrt 1827 Vorlagen und baut ihre Liste nach; solange
    // keine einzige Zeile da ist, misst der Lauf eine leere Leiste und kommt
    // trotzdem zur Ruhe. `.cp-hover-actions` ist die Bedienreihe einer solchen
    // Zeile — gibt es sie mit Flaeche, steht die Liste.
    const eintraege = [...document.querySelectorAll('.cp-hover-actions')]
    return griffe.some(mitFlaeche) && eintraege.some(mitFlaeche)
  })

/** Wie viele der gemessenen Ziele auf einem Geraete-Knoten liegen. */
const aufKnoten = (ziele) => ziele.filter((z) => z.wo === 'auf dem Knoten').length

const messenStabil = async (was) => {
  // Erst die Bedingung, dann die Ruhe.
  for (let versuch = 0; versuch < 30; versuch += 1) {
    if (await szeneFertig()) break
    if (versuch === 29) {
      throw new Error(
        `${was}: die Szene ist nicht fertig — auf den Geraete-Knoten liegt kein ` +
          'Bedienelement mit Flaeche, oder die Bibliotheks-Seitenleiste ist leer. In ' +
          'beiden Faellen fehlt der Messung eine ganze Gruppe, ohne dass sie es sagt: ' +
          'die Knoten tragen 73 Flaechen, die Seitenleiste 60.',
      )
    }
    await win.waitForTimeout(400)
  }

  let vorher = null
  let gleich = 0
  for (let versuch = 0; versuch < 30; versuch += 1) {
    const jetzt = await messen()
    if (vorher !== null && jetzt.ziele.length === vorher.ziele.length) {
      gleich += 1
      // DREI gleiche Messungen, nicht zwei — zwei waren es bis heute, und
      // damit war die Zahl zwischen zwei Laeufen um 66 verschieden.
      if (gleich >= 2) return jetzt
    } else {
      gleich = 0
    }
    vorher = jetzt
    await win.waitForTimeout(400)
  }
  throw new Error(
    `${was}: die Anzahl der Trefferflaechen kommt nicht zur Ruhe. Entweder baut die ` +
      'Oberflaeche endlos nach, oder die Szene ist nicht mehr die gemeinte.',
  )
}

/**
 * Hat die Messung die Knoten wirklich gesehen?
 *
 * ─── WARUM EINE UNTERGRENZE UND NICHT NUR EIN DECKEL ───────────────────────
 *
 * Ein Deckel meldet nur, wenn es ZU VIELE sind. Genau darum hat dieser Lauf
 * jahrelang eine zu kleine Szene gemessen und dabei gruen gemeldet: fehlten
 * die 73 Griffe auf den Knoten, lag die Zahl WEIT unter dem Deckel — und ein
 * Gate, das bei einer halb aufgebauten Oberflaeche gruen wird, sagt nichts.
 *
 * Es ist kein Zahlen-Deckel in die andere Richtung (der waere dieselbe
 * Ratsche noch einmal), sondern eine Aussage: auf den Geraete-Knoten LIEGEN
 * Bedienelemente, also muss die Messung welche gefunden haben. Wird der
 * Knoten einmal umgebaut und traegt keine mehr, faellt diese Zeile — und dann
 * gehoert sie geaendert, nicht der Deckel.
 */
const knotenGeprueft = (was, ziele) => {
  const fehlt = []
  if (aufKnoten(ziele) === 0) fehlt.push('auf dem Knoten (gemessen 73 Flaechen)')
  if (ziele.filter((z) => z.wo === 'Seitenleiste').length === 0) {
    fehlt.push('Seitenleiste (gemessen 60 unter der Maus, 95 unter dem Finger)')
  }
  if (fehlt.length === 0) return
  throw new Error(
    `${was}: diese Gruppe fehlt in der Messung — ${fehlt.join(' und ')}. Sie ist nicht ` +
      'leer, sie war nur noch nicht aufgebaut. Ein gruenes Ergebnis waere hier eine ' +
      'Aussage ueber eine Oberflaeche, die es so nie gibt.',
  )
}

const maus = await messenStabil('Maus')
knotenGeprueft('Maus', maus.ziele)
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

const finger = await messenStabil('Finger')
knotenGeprueft('Finger', finger.ziele)
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
 * NEU GEMESSEN am 2026-09-11 (cable#852), gleiche Bedingungen:
 * 95 Trefferflaechen, davon 50 unter 24 px und 91 unter 44 px.
 *
 *   unter44  89 -> 91, und das sind genau die zwei neuen Schliessen-Knoepfe
 *            der schwebenden Leisten (Geraete-Suche, Werkzeugleiste). Der
 *            Deckel steigt hier, mit Grund: beide sitzen auf einer Leiste,
 *            die UEBER dem Plan schwebt, und beide raeumen genau diese
 *            Leiste weg. 44 px je Knopf machten aus der schmalen Zeile
 *            einen Block, der die Flaeche verdeckt, um derentwillen es den
 *            Knopf gibt — die Nutzer-Meldung lautete, dass die Leisten
 *            Platz wegnehmen.
 *
 *   unter24  54 -> 50, und DAS ist die eigentliche Nachricht dieser Runde:
 *            die drei Kopfzeilen-Knoepfe der Suche (Griff, Einklappen,
 *            Schliessen) trugen bis dahin die Groesse ihres Symbols, also
 *            14 x 14 — die kleinsten Flaechen ausserhalb der Bibliothek.
 *            Sie sind jetzt 24 x 24 bei unveraendertem Symbol. Der neue
 *            Knopf hat den alten Missstand sichtbar gemacht.
 *
 * NEU GEMESSEN am 2026-09-24 (cable#920): unter44 91 -> 93. Die zwei neuen
 * Knoepfe „Hallenplan" und „Symbole" in der Canvas-Werkzeugleiste, in
 * derselben Zeile und Hoehe wie „Anmerkungen" und „Badges". Ein 44-px-Knopf
 * machte aus der Zeile einen Block — derselbe Grund wie bei #852. unter24
 * bleibt: beide sind hoeher als 24 px.
 *
 * ZUSAMMENGEFUEHRT am 2026-09-25: #920 (Hallenplan, Symbole) und #921
 * (Umschalter Local/Shared) hoben den Deckel je um 2 von 91 auf 93 — jeder
 * gegen den alten Stand gemessen. Zusammen sind es vier neue Flaechen: 95.
 *
 * Der Deckel fuer `unter24` sinkt deshalb mit auf 50. Eine Obergrenze, die
 * ueber dem Gemessenen stehenbleibt, ist Luft, in die es still
 * zurueckwachsen kann.
 *
 * WAS DIE ZAHLEN SAGEN, ausgeschrieben, damit niemand sie fuer eine
 * Bestandsmeldung haelt: 91 von 95 Bedienflaechen sind kleiner als die
 * Apple-Marke, und 50 unterschreiten die WCAG-NORM. Die kleinste ist
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
/*
 * ANGEHOBEN am 2026-09-25 (Geraetebibliothek), unter44 91 -> 93:
 * 98 Trefferflaechen, davon 93 unter 44 px. Die zwei neuen sind der
 * Quellen-Umschalter im Equipment-Tab der Bibliothek („Local" / „Shared").
 * Er stand bisher nur bei eingeschaltetem Rentman-Modul da; die
 * Geraetebibliothek ist aber die Vorgabe-Quelle jedes Builds, also steht
 * er jetzt immer. Er sitzt in derselben 235 px schmalen Seitenleiste wie
 * die Register darueber (32 px hoch, ebenfalls unter der Marke) — 44 px je
 * Knopf machten ihn hoeher als die Register, zu denen er gehoert, und
 * schoeben die Liste darunter aus dem Blick.
 */
/*
 * ANGEHOBEN am 2026-09-27 (#878, 22 neue Katalog-Eintraege), unter44 95 -> 97,
 * gemessen im CI-Lauf von #937. Kein neues Bedienelement: die zusaetzlichen
 * Flaechen sind Zeilen-Aktionen der Bibliotheks-Seitenleiste (Kategorie-
 * Griffe, Eintrags-Knoepfe), von denen mit dem groesseren Katalog mehr im
 * 950-px-Fenster stehen. Lokal nachgezaehlt: Zuwachs nur in „Seitenleiste".
 */
/**
 * ─── DIE DECKEL, UND WARUM SIE HEUTE SPRINGEN ──────────────────────────────
 *
 * GEMESSEN am 2026-09-28, dreimal hintereinander gleich:
 *   Maus   178 Ziele — 73 unter 24 px, 171 unter 44 px
 *   Finger 213 Ziele — 73 unter 24 px, 206 unter 44 px
 *
 * Vorher stand fuer beide Durchgaenge 50 / 97. Das ist ein Sprung von 97 auf
 * 171, und er hat DREI verschiedene Ursachen, die man auseinanderhalten muss —
 * denn nur eine davon bedeutet, dass die Oberflaeche schlechter geworden ist,
 * und das ist keine von den drei.
 *
 * 1. DER DECKEL WAR BLIND FUER GANZE GRUPPEN. Das ist die wichtigste und
 *    unangenehmste. Die Messung lief, bevor die Oberflaeche fertig aufgebaut
 *    war — mal fehlten die 73 Port-Griffe auf den Geraete-Knoten („In 1 · BNC
 *    — Enter verbindet", 65 x 19 px), mal die 60 Zeilen der
 *    Bibliotheks-Seitenleiste. Sie waren also immer da und immer zu klein; gezaehlt hat
 *    sie niemand. Seit `portGriffeDa()` wartet der Lauf auf sie — und zwar
 *    darauf, dass sie FLAECHE haben und nicht bloss im DOM stehen; die erste
 *    Fassung fragte nur nach Vorhandensein und war damit von der ersten
 *    Millisekunde an erfuellt. `knotenGeprueft()` weist danach zurueck, was
 *    trotzdem ohne sie gemessen wurde: ein Deckel allein haette den zu kleinen
 *    Lauf gruen gemeldet, denn 112 ist WENIGER als 171.
 *
 *    DAVON SIND 63 UNTER 24 px, also unter der NORM (WCAG 2.2, 2.5.8 AA) und
 *    nicht bloss unter einer Hersteller-Empfehlung. Das ist ein Befund an der
 *    Oberflaeche und keiner an diesem Skript; er steht als #951 und ist nicht
 *    hier wegdefiniert. Die Zahl steht als Deckel, um
 *    sie festzunageln — sie darf nicht weiter steigen.
 *
 * 2. DIE BIBLIOTHEK IST GEWACHSEN. Der Katalog fuehrt 1827 Eintraege, und die
 *    Seitenleiste zeigt entsprechend mehr Kategorie-Gruppen; jede ist eine
 *    Zeile mit Griff. Gemessen liegen 95 der 206 Finger-Flaechen dort. Das
 *    sind keine neuen Bedienelemente, sondern mehr Zeilen derselben Art.
 *
 *    DAS MACHT DEN DECKEL SCHWAECHER, und das gehoert gesagt: er misst jetzt
 *    zum Teil, wie viele Kategorien der Katalog fuehrt, statt wie dicht die
 *    Oberflaeche ist. Wer ihn wieder scharf haben will, zaehlt die
 *    Seitenleiste getrennt — eine eigene Runde, keine Nebenbei-Aenderung.
 *
 * 3. DIE BEIDEN DURCHGAENGE BEKOMMEN VERSCHIEDENE DECKEL. Bis heute stand
 *    fuer beide dieselbe Zahl, weil sie zufaellig gleich waren. Sie sind es
 *    nicht: unter dem Finger kommen 35 Flaechen DAZU, die es unter der Maus
 *    gar nicht gibt (`.cp-coarse-only`). Ein gemeinsamer Deckel muesste den
 *    groesseren nehmen und liesse den Maus-Durchgang um 35 wachsen, ohne dass
 *    jemand es merkt.
 *
 * `unter24` steigt von 50 auf 73 — und zwar NICHT, weil 23 Flaechen
 * geschrumpft sind, sondern weil 63 von ihnen zum ersten Mal gezaehlt werden
 * (siehe 1.). Die 10, die vorher sichtbar waren, sind weiter 10.
 */
const DECKEL = {
  maus: { unter24: 73, unter44: 171 },
  finger: { unter24: 73, unter44: 206 },
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
