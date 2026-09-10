#!/usr/bin/env node
/**
 * Bleibt die App im Fenster? — Lauf: `npm run mobil:check`
 *
 * ─── DIE MELDUNG ─────────────────────────────────────────────────────────
 *
 * Nutzer-Meldung 2026-09-10, mit einem Schirmbild der GitHub-Seite auf einem
 * iPhone: „Man kann das gesamte Fenster aus Versehen verschieben." Auf dem
 * Bild war der Inhalt nach links geschoben, rechts stand ein schwarzer
 * Streifen, die Reihe der Ebenen-Chips endete mitten im Wort „Control", und
 * die Statuszeile war unten abgeschnitten.
 *
 * ─── WAS GEMESSEN WAR (390x844, Fingerbedienung) ─────────────────────────
 *
 *   · 18 Elemente ragten ueber den rechten Rand hinaus, der Chip-Streifen
 *     bis Pixel 726 auf einer 390 Pixel breiten Anzeige.
 *   · Das Haupt-Raster stand auf 129 | 125 | 129 Pixel: der PLAN war der
 *     schmalste Teil der Planungs-App. Die Einklappung fuer schmale Fenster
 *     gab es laengst (#444) — sie sprang nur beim UEBERSCHREITEN der
 *     Schwelle an, und wer die Seite auf einem Telefon oeffnet, ueberschreitet
 *     nichts.
 *   · `html`/`body` trugen weder `overflow` noch `overscroll-behavior`.
 *   · Ein Kneifen mitten auf dem Plan vergroesserte die SEITE
 *     (`visualViewport.scale` 1 -> 2, Versatz 98/250 Pixel) statt des Plans.
 *
 * ─── WAS DIESER LAUF MISST UND WAS NICHT ─────────────────────────────────
 *
 * Er misst im echten Browser, in einem 390x844 grossen Fenster mit
 * Fingerbedienung, an der GEBAUTEN Seite (`dist/renderer`):
 *
 *   1. kein Element ragt ueber den sichtbaren Bereich hinaus,
 *   2. das Dokument selbst hat nichts zu scrollen,
 *   3. `overflow: hidden` und `overscroll-behavior: none` stehen wirklich
 *      im berechneten Stil von `html`/`body`,
 *   4. `.react-flow__renderer` traegt `touch-action: none`,
 *   5. die Statuszeile steht vollstaendig im Bild,
 *   6. die Seiten-Panels sind beim LADEN eingeklappt, der Plan bekommt den
 *      Platz.
 *
 * Er misst NICHT, ob eine echte Kneif-Geste am Ende die Seite in Ruhe
 * laesst. Das wurde versucht und verworfen: der Kneif-Ersatz der
 * Fernsteuerung (CDP `Input.synthesizePinchGesture` wie auch
 * `Input.dispatchTouchEvent`) vergroessert die Seite unter headless-Chromium
 * AUCH DANN, wenn `touch-action: none` gesetzt ist — die Gegenprobe mit und
 * ohne die Regel lieferte denselben Wert. Eine Messung, die den Unterschied
 * nicht sieht, waere ein Waechter, der immer gruen ist. Punkt 4 prueft
 * deshalb die VORAUSSETZUNG, ohne die es sicher falsch ist, und sagt genau
 * das. Die zweite Haelfte — Safaris `gesture*`-Ereignisse — steht in
 * `CanvasArea.tsx` und wird hier im Quelltext nachgesehen (Punkt 7).
 *
 * Voraussetzung: `npm run build:renderer` lief vorher.
 */
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFile, access } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..')
const SEITE = join(WURZEL, 'dist/renderer')
const BREITE = 390
const HOEHE = 844

try {
  await access(join(SEITE, 'index.html'))
} catch {
  console.error(
    'FEHLER: dist/renderer/index.html fehlt. Erst `npm run build:renderer`, dann dieser Lauf.',
  )
  process.exit(1)
}

const TYPEN = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
}
const server = createServer(async (req, res) => {
  const pfad = decodeURIComponent((req.url || '/').split('?')[0])
  const datei = pfad === '/' ? '/index.html' : pfad
  try {
    const inhalt = await readFile(join(SEITE, datei))
    res.writeHead(200, { 'content-type': TYPEN[extname(datei)] ?? 'application/octet-stream' })
    res.end(inhalt)
  } catch {
    res.writeHead(404).end('nicht da')
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

/**
 * Einen Browser finden, ohne einen mitzuliefern.
 *
 * `playwright-core` laedt bewusst keinen herunter (deshalb heisst es `-core`).
 * Gesucht wird deshalb der Reihe nach: was der Aufrufer vorgibt, was
 * Playwright selbst abgelegt hat (`PLAYWRIGHT_BROWSERS_PATH`), und zuletzt
 * die ueblichen Systempfade — auf den GitHub-Laeufern liegt dort Chrome.
 * Findet sich keiner, sagt der Lauf WELCHE Pfade er abgesucht hat; ein
 * blosses „Browser nicht gefunden" schickt den naechsten auf die Suche.
 */
const browserPfad = async () => {
  const kandidaten = []
  if (process.env.CP_CHROMIUM) kandidaten.push(process.env.CP_CHROMIUM)
  try {
    const eigen = await chromium.executablePath()
    if (eigen) kandidaten.push(eigen)
  } catch {
    /* playwright-core ohne abgelegten Browser — dann eben die Systempfade */
  }
  kandidaten.push(
    '/opt/pw-browsers/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  )
  for (const k of kandidaten) {
    try {
      await access(k)
      return k
    } catch {
      /* weiter */
    }
  }
  console.error(
    'FEHLER: kein Chromium gefunden. Abgesucht:\n' +
      kandidaten.map((k) => `  · ${k}`).join('\n') +
      '\nEinen Pfad in CP_CHROMIUM setzen oder einen Browser installieren.',
  )
  server.close()
  process.exit(1)
}

const browser = await chromium.launch({
  executablePath: await browserPfad(),
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})

/** Eine frische Seite im Telefon-Format, Erststart-Dialoge weggeraeumt. */
const oeffnen = async (einstieg = '/', sprache = 'en') => {
  const ctx = await browser.newContext({
    viewport: { width: BREITE, height: HOEHE },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
      '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  // Die Erststart-Dialoge legen sich sonst ueber die Messung. Sie werden
  // NICHT weggeklickt, sondern vorher als „schon gesehen" hinterlegt: ein
  // Klick misst die Dialoge, und gemessen werden soll die App.
  await ctx.addInitScript((s) => {
    try {
      localStorage.setItem('cable-planner:welcomed', '1')
      localStorage.setItem('cable-planner.tour.seen.v1', '1')
      localStorage.setItem(
        'cable-planner:settings',
        JSON.stringify({ onboardingDone: true }),
      )
      localStorage.setItem('cable-planner:ui', JSON.stringify({ language: s }))
    } catch {
      /* ein Browser ohne Speicher zeigt die Dialoge — dann misst der Lauf sie mit */
    }
  }, sprache)
  const seite = await ctx.newPage()
  await seite.goto(`http://127.0.0.1:${port}${einstieg}`, { waitUntil: 'domcontentloaded' })
  await seite.waitForTimeout(4000)
  for (let i = 0; i < 6; i++) {
    if (!(await seite.$('.cp-modal-backdrop'))) break
    await seite.keyboard.press('Escape').catch(() => {})
    await seite.waitForTimeout(300)
  }
  return { ctx, seite }
}

const messen = (seite) =>
  seite.evaluate(() => {
    const de = document.documentElement
    const raus = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.right > window.innerWidth + 1 || r.left < -1) {
        raus.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 70),
          links: Math.round(r.left),
          rechts: Math.round(r.right),
        })
      }
    }
    const renderer = document.querySelector('.react-flow__renderer')
    const statusbar = document.querySelector('.cp-statusbar')
    const haupt = document.querySelector('main')
    const spalten = haupt ? getComputedStyle(haupt).gridTemplateColumns : ''
    const planBreite = spalten
      ? Math.round(parseFloat(spalten.split(' ')[2] ?? '0'))
      : 0
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      docScrollWidth: de.scrollWidth,
      docScrollHeight: de.scrollHeight,
      htmlOverflowX: getComputedStyle(de).overflowX,
      htmlOverflowY: getComputedStyle(de).overflowY,
      bodyOverflowX: getComputedStyle(document.body).overflowX,
      htmlOverscroll: getComputedStyle(de).overscrollBehavior,
      rendererTouchAction: renderer ? getComputedStyle(renderer).touchAction : null,
      statusUnten: statusbar ? Math.round(statusbar.getBoundingClientRect().bottom) : null,
      planBreite,
      raus,
    }
  })

// Die Regeln 1 bis 6 gelten je Sprache — sie messen die gerenderte
// Oberflaeche, und die haengt an der Laenge der Beschriftungen.
const pruefe = (m, sprache) => {
  const inSprache = (t) => `[${sprache}] ${t}`
  // ── 1. Nichts ragt hinaus ────────────────────────────────────────────────
  if (m.raus.length > 0) {
    fehler.push(
        inSprache(
        `${m.raus.length} Element(e) ragen ueber die ${m.innerWidth} Pixel breite Anzeige hinaus:\n` +
          m.raus
            .slice(0, 8)
            .map((r) => `      <${r.tag} class="${r.cls}"> ${r.links}..${r.rechts}`)
            .join('\n'),
      )
    )
  }

  // ── 2. Das Dokument hat nichts zu scrollen ───────────────────────────────
  if (m.docScrollWidth > m.innerWidth) {
    fehler.push(
        inSprache(
        `Das Dokument ist ${m.docScrollWidth} Pixel breit bei ${m.innerWidth} Pixel Anzeige — ` +
          'die Seite laesst sich waagerecht schieben.',
      )
    )
  }
  if (m.docScrollHeight > m.innerHeight) {
    fehler.push(
        inSprache(
        `Das Dokument ist ${m.docScrollHeight} Pixel hoch bei ${m.innerHeight} Pixel Anzeige — ` +
          'die Seite laesst sich senkrecht schieben, und die Statuszeile rutscht darunter.',
      )
    )
  }

  // ── 3. Die Sperre steht wirklich im berechneten Stil ─────────────────────
  if (m.htmlOverflowX !== 'hidden' || m.bodyOverflowX !== 'hidden') {
    fehler.push(
        inSprache(
        `\`overflow\` fehlt: html=${m.htmlOverflowX}, body=${m.bodyOverflowX}. ` +
          'Ein Pixel Ueberhang genuegt dann, damit die ganze Seite wandert.',
      )
    )
  }
  if (m.htmlOverscroll !== 'none') {
    fehler.push(
        inSprache(
        `\`overscroll-behavior\` steht auf "${m.htmlOverscroll}" statt "none" — ` +
          'ein Zug, den kein Scrollbereich aufnimmt, verschiebt die Seite gummibandartig.',
      )
    )
  }

  // ── 4. Die Kneif-Geste gehoert dem Plan ──────────────────────────────────
  if (m.rendererTouchAction === null) {
    fehler.push(inSprache('`.react-flow__renderer` steht nicht im Dokument — dann misst Regel 4 nichts.'))
  } else if (m.rendererTouchAction !== 'none') {
    fehler.push(
        inSprache(
        `\`.react-flow__renderer\` hat \`touch-action: ${m.rendererTouchAction}\` statt \`none\`. ` +
          'Der Browser nimmt die Zwei-Finger-Geste dann vorweg und vergroessert die SEITE; ' +
          'ReactFlows eigener Zoom kommt gar nicht erst dran.',
      )
    )
  }

  // ── 5. Die Statuszeile steht im Bild ─────────────────────────────────────
  if (m.statusUnten === null) {
    fehler.push(inSprache('`.cp-statusbar` steht nicht im Dokument — dann misst Regel 5 nichts.'))
  } else if (m.statusUnten > m.innerHeight + 1) {
    fehler.push(
        inSprache(
        `Die Statuszeile endet bei ${m.statusUnten} Pixel, das Fenster bei ${m.innerHeight} — ` +
          'sie ist abgeschnitten.',
      )
    )
  }

  // ── 6. Der Plan bekommt den Platz ────────────────────────────────────────
  //
  // Die Zahl ist kein Schoenheitswert: bei 129 Pixel Plan zwischen zwei
  // gleich breiten Panels ist die Planungs-App auf dem Telefon unbenutzbar,
  // und genau so lag sie vor dem 2026-09-10. Die Haelfte der Anzeige ist die
  // unterste Schwelle, die noch etwas anderes heisst als „drei gleich breite
  // Spalten".
  const MINDEST_PLAN = Math.round(BREITE / 2)
  if (m.planBreite < MINDEST_PLAN) {
    fehler.push(
        inSprache(
        `Der Plan bekommt nur ${m.planBreite} von ${m.innerWidth} Pixel (Mindestmass ` +
          `${MINDEST_PLAN}). Die Seiten-Panels klappen beim LADEN nicht ein — die ` +
          'Einklappung reagiert dann nur auf das Ueberschreiten der Schwelle, und wer ' +
          'die Seite auf einem Telefon oeffnet, ueberschreitet nichts.',
      )
    )
  }
}

const fehler = []

// ─── WARUM IN JEDER SPRACHE GEMESSEN WIRD ────────────────────────────────
//
// Die Kopfzeile ist 40 Pixel hoch und bricht nicht um. Ob ihr Inhalt
// hineinpasst, haengt an der LAENGE der Beschriftungen — und die gehoert der
// Sprache. Gemessen am 2026-09-10: auf Englisch endete die rechte Gruppe bei
// Pixel 378 (passt), auf Deutsch bei 425 (passt nicht). Ein Lauf, der nur die
// Quellsprache misst, haette „OK" gesagt und den Einstellungen-Knopf jedem
// deutschsprachigen Nutzer trotzdem aus dem Bild geschoben.
//
// Der Umfang ist keine Liste: die Sprachen kommen aus der Registry in
// `src/renderer/lib/i18n.ts`. Wer eine vierte Sprache eintraegt, wird hier
// gemessen, ohne dass jemand diese Datei anfasst.
const sprachen = (() => {
  const quelle = readFileSync(join(WURZEL, 'src/renderer/lib/i18n.ts'), 'utf8')
  const block = /const\s+translations[^=]*=\s*\{([\s\S]*?)\n\}/.exec(quelle)
  // Eintraege stehen als Kurzform (`de,`) oder als Paar (`de: dict,`).
  const gefunden = block
    ? [...block[1].matchAll(/^\s*([a-z]{2})\s*[,:]/gm)].map((m) => m[1])
    : []
  // 'en' ist die Quellsprache und steht als Fallback im JSX, nicht im
  // Woerterbuch — sie gehoert immer dazu.
  return [...new Set(['en', ...gefunden])]
})()
if (sprachen.length < 2) {
  fehler.push(
    `Nur ${sprachen.length} Sprache(n) gefunden (${sprachen.join(', ')}) — dann misst ` +
      'die Sprach-Schleife nichts. Steht die Registry noch in ' +
      '`src/renderer/lib/i18n.ts`?',
  )
}

// Gemessen wird in jeder Sprache; die letzte Messung traegt die Zahlen der
// Abschlussmeldung.
let m = null
let ctx = null
let seite = null
for (const sprache of sprachen) {
  if (ctx) await ctx.close()
  const auf = await oeffnen('/', sprache)
  ctx = auf.ctx
  seite = auf.seite
  m = await messen(seite)
  for (const r of m.raus) r.sprache = sprache
  pruefe(m, sprache)
}

// ── 7. Safaris `gesture*` (Quelltext, nicht Messung) ─────────────────────
//
// Ausdruecklich gelesen und nicht gemessen: diese Ereignisse gibt es nur in
// Safari, und Safari laeuft hier nicht. Ohne sie vergroessert Safari auf dem
// Trackpad weiter die Seite, auch mit `touch-action`.
const canvasArea = readFileSync(join(WURZEL, 'src/renderer/components/Canvas/CanvasArea.tsx'), 'utf8')
for (const g of ['gesturestart', 'gesturechange', 'gestureend']) {
  if (!canvasArea.includes(`'${g}'`)) {
    fehler.push(`src/renderer/components/Canvas/CanvasArea.tsx faengt \`${g}\` nicht ab (Safari).`)
  }
}

// ── 8. Die anderen beiden Einstiege scrollen weiterhin ───────────────────
//
// `mobile.html` und `viewer.html` laden DASSELBE Stilblatt wie die
// Vollbild-Anwendung, sind aber scrollende Seiten. Beim ersten Anlauf am
// 2026-09-10 stand die Sperre aus Regel 3 global — und die Mobil-Liste blieb
// bei 3000 Pixel Inhalt auf `scrollY = 0` stehen: die Seite war nach dem
// ersten Bild zu Ende, lautlos. Deshalb haengt die Sperre an der Marke
// `data-cp-shell="app"` in `index.html`, und deshalb steht diese Regel hier:
// sie misst die Kehrseite derselben Entscheidung.
for (const einstieg of ['/mobile.html', '/viewer.html']) {
  const auf = await oeffnen(einstieg)
  const gescrollt = await auf.seite.evaluate(() => {
    const ziel = document.querySelector('#root > div') ?? document.body
    const lang = document.createElement('div')
    lang.style.height = '3000px'
    ziel.appendChild(lang)
    window.scrollTo(0, 1500)
    return { y: window.scrollY, hoehe: document.documentElement.scrollHeight }
  })
  await auf.ctx.close()
  if (gescrollt.y <= 0) {
    fehler.push(
      `${einstieg} laesst sich mit 3000 Pixel Inhalt nicht scrollen ` +
        `(Dokument ${gescrollt.hoehe} Pixel hoch, scrollY bleibt ${gescrollt.y}). ` +
        'Die Sperre aus Regel 3 gilt fuer die Vollbild-Anwendung, nicht fuer die ' +
        'scrollenden Seiten — sie gehoert hinter `html[data-cp-shell="app"]`.',
    )
  }
}

// ── Die Gegenprobe zum Lauf selbst ───────────────────────────────────────
//
// Eine Pruefung, die nicht fehlschlagen KANN, ist keine. Zwei der Regeln
// werden an einem absichtlich kaputten Zustand vorgefuehrt; erkennt eine
// davon ihren eigenen Defekt nicht mehr, faellt der Lauf hier — nicht erst
// beim naechsten Nutzer.
await seite.addStyleTag({
  content:
    '#cp-gegenprobe{position:fixed;top:0;left:0;width:900px;height:10px;background:red}' +
    '.react-flow__renderer{touch-action:auto !important}',
})
await seite.evaluate(() => {
  const d = document.createElement('div')
  d.id = 'cp-gegenprobe'
  document.body.appendChild(d)
})
await seite.waitForTimeout(200)
const probe = await messen(seite)
if (!probe.raus.some((r) => r.cls === '' && r.rechts >= 900)) {
  fehler.push('Gegenprobe: ein 900 Pixel breites Element wird von Regel 1 nicht mehr gemeldet.')
}
if (probe.rendererTouchAction === 'none') {
  fehler.push('Gegenprobe: `touch-action` wird nicht wirklich am Element gelesen (Regel 4).')
}
await ctx.close()
await browser.close()
server.close()

if (fehler.length > 0) {
  console.error(
    `FEHLER: die App bleibt auf ${BREITE}x${HOEHE} nicht im Fenster:\n` +
      fehler.map((f) => `  · ${f}`).join('\n'),
  )
  process.exit(1)
}

console.log(
  `OK (${BREITE}x${HOEHE}, Fingerbedienung, Sprache(n): ${sprachen.join(', ')}): kein Ueberhang, Dokument ` +
    `${m.docScrollWidth}x${m.docScrollHeight} = Fenster, \`overflow: hidden\` + ` +
    '`overscroll-behavior: none` gesetzt, `touch-action: none` am Plan-Renderer, ' +
    `Statuszeile bei ${m.statusUnten}, Plan ${m.planBreite} Pixel breit; ` +
    'mobile.html und viewer.html scrollen weiterhin.',
)
console.log(
  'NICHT gemessen: ob eine echte Kneif-Geste die Seite in Ruhe laesst. Der ' +
    'Kneif-Ersatz der Fernsteuerung vergroessert die Seite auch mit ' +
    '`touch-action: none` — geprueft ist die Voraussetzung, nicht die Wirkung. ' +
    'Safaris `gesture*` sind gelesen, nicht gemessen.',
)
