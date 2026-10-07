#!/usr/bin/env node
/**
 * Handbuch-Aufnahmen, Kapitel Canvas.
 *
 *   node scripts/handbuch/bereiche/canvas.mjs de
 *   node scripts/handbuch/bereiche/canvas.mjs en
 *   ABSCHNITTE=leiste,kabel node scripts/handbuch/bereiche/canvas.mjs de   (nur diese Abschnitte)
 *
 * Jeder Abschnitt beginnt mit dem frischen Beispielprojekt und schreibt seine
 * Bilder unter docs/manual/bilder/<sprache>/canvas-<abschnitt>-<nn>-<name>.jpg.
 * Das Ergebnis (Schritte, Dialogtexte, Tooltips, Fehler) steht in
 * canvas.<sprache>.json neben diesem Skript.
 *
 * Nichts wird abgesendet: keine Verbindung zu Anlagen, kein Umschalten, keine
 * echten Zugangsdaten. Der Scheinserver (Standbild, KI-Antwort) lauscht nur
 * auf 127.0.0.1.
 */

import { starte } from '../app.mjs'
import { erststartOverlayWeg } from '../../lib/erststartOverlay.mjs'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const sprache = process.argv[2] ?? 'de'
const nur = process.env.ABSCHNITTE ? process.env.ABSCHNITTE.split(',') : null
const HIER = dirname(fileURLToPath(import.meta.url))
const TMP = mkdtempSync(join(tmpdir(), 'cp-canvas-'))

const a = await starte({ sprache, breite: 1800, hoehe: 1000 })
const w = a.win
w.setDefaultTimeout(7000)
const de = sprache === 'de'
/** Text in der Sprache des Laufs, wenn es keinen Wörterbuch-Schlüssel gibt. */
const zw = (deText, enText) => (de ? deText : enText)
const pause = (ms) => w.waitForTimeout(ms)
const M = (k) => a.muster(k)
const T = (k) => a.text(k)

// ─── Zustand, der vor jedem Abschnitt wiederhergestellt wird ──────────────────
const grundzustand = await w.evaluate(() => ({
  ui: localStorage.getItem('cable-planner:ui'),
  settings: localStorage.getItem('cable-planner:settings'),
}))

const folgen = {}
const extra = { tooltips: {}, listen: {}, texte: {}, fehler: [] }
const seiten = () => w.evaluate(() => {
  window.print = () => {}
  window.alert = () => {}
  window.confirm = () => true
  window.prompt = () => null
})

async function frisch({ leer = false } = {}) {
  await w.evaluate((g) => {
    localStorage.clear()
    if (g.ui) localStorage.setItem('cable-planner:ui', g.ui)
    if (g.settings) localStorage.setItem('cable-planner:settings', g.settings)
  }, grundzustand)
  await w.reload()
  await w.waitForLoadState('domcontentloaded')
  await pause(2500)
  await seiten()
  await erststartOverlayWeg(w, { lautScheitern: false })
  if (leer) {
    await a.zu()
    return
  }
  const demo = w.getByRole('button', { name: M('canvas.empty.loadDemo') })
  if (await demo.count()) {
    await demo.first().click().catch(() => {})
    await pause(1800)
  }
  await a.zu()
  await verschiebeAnsicht()
}

/**
 * Ansicht so verschieben, dass die Oberkante von „Camera 1" bei y = 270 (Fenster)
 * liegt: darüber ist Platz für die dreizeilige Werkzeugleiste und die Suche.
 */
async function verschiebeAnsicht(zielY = 270) {
  await pause(600)
  const b = await knoten('Camera 1').boundingBox()
  if (!b) return
  const dy = Math.round(zielY - b.y)
  if (Math.abs(dy) < 4) return
  await w.mouse.move(900, 860)
  await w.mouse.down()
  await w.mouse.move(900, 860 + dy, { steps: 8 })
  await w.mouse.up()
  await pause(400)
}

// ─── Bildausschnitte ──────────────────────────────────────────────────────────
const FENSTER = { width: 1800, height: 1000 }
const leiste = () => w.locator('[data-cp-canvas-toolbar]')
const flaeche = () => w.locator('#cable-planner-canvas')

const istRechteck = (v) => v && typeof v === 'object' && typeof v.width === 'number' && typeof v.x === 'number'
const alsRechteck = async (x) => {
  let v = x
  if (typeof v === 'function') v = await v()
  if (istRechteck(v)) return { x: v.x, y: v.y, width: v.width, height: v.height }
  if (v && typeof v.first === 'function') {
    const el = v.first()
    if (!(await el.count())) return null
    return await el.boundingBox()
  }
  return null
}

/** Vereinigung mehrerer Locator/Rechtecke, mit Rand, auf das Fenster begrenzt. */
async function vereine(teile, rand = 8) {
  const boxen = []
  for (const t of teile) {
    const b = await alsRechteck(t)
    if (b) boxen.push(b)
  }
  if (boxen.length === 0) return { x: 0, y: 0, ...FENSTER }
  const x1 = Math.max(0, Math.min(...boxen.map((b) => b.x)) - rand)
  const y1 = Math.max(0, Math.min(...boxen.map((b) => b.y)) - rand)
  const x2 = Math.min(FENSTER.width, Math.max(...boxen.map((b) => b.x + b.width)) + rand)
  const y2 = Math.min(FENSTER.height, Math.max(...boxen.map((b) => b.y + b.height)) + rand)
  return { x: Math.round(x1), y: Math.round(y1), width: Math.round(x2 - x1), height: Math.round(y2 - y1) }
}

/** `ziel:` für folge.schritt — schneidet das Vereinigungsrechteck aus dem Fenster. */
const ausschnitt = (...teile) => () => ({
  count: async () => 1,
  first: () => ({
    screenshot: async (opt) => w.screenshot({ ...opt, clip: await vereine(teile, 0) }),
  }),
})
/** Ein festes Rechteck als Aufnahmeziel (und, für ausschnitt(), als Teil). */
const festesZiel = (r) =>
  Object.assign(
    { ...r },
    {
      count: async () => 1,
      first: () => ({ screenshot: async (opt) => w.screenshot({ ...opt, clip: r }) }),
    },
  )
/** Rechteck um einen Punkt (Kontextmenüs ohne Rolle). */
const umPunkt = (x, y, breite = 300, hoehe = 420) => ({
  x: Math.max(0, x - 10),
  y: Math.max(0, y - 10),
  width: Math.min(breite, FENSTER.width - x + 10),
  height: Math.min(hoehe, FENSTER.height - y + 10),
})
/** Die Zeichenfläche bis y = 720 (dort endet das Beispiel), ganz mit R_VOLL. */
const flaecheOben = async () => {
  const b = await flaeche().boundingBox()
  return { x: b.x, y: b.y, width: b.width, height: Math.min(b.height, 722 - b.y) }
}
const R_FLAECHE = ausschnitt(flaecheOben)
const R_VOLL = () => flaeche()
const R_LEISTE = () => leiste()
const R_MENUE = () => w.locator('[role="menu"]').last()
const R_DIALOG = () => w.locator('[role="dialog"]').last()
const B_INSPECTOR = { x: 1518, y: 40, width: 282, height: 935 }
const B_BIBLIOTHEK = { x: 0, y: 40, width: 262, height: 935 }
const B_FENSTER = { x: 0, y: 0, ...FENSTER }
const B_STATUS = { x: 0, y: 975, width: 1800, height: 25 }
const B_PANEL = { x: 1416, y: 0, width: 384, height: 1000 }
const R_INSPECTOR = festesZiel(B_INSPECTOR)
const R_BIBLIOTHEK = festesZiel(B_BIBLIOTHEK)
const R_FENSTER = festesZiel(B_FENSTER)
const R_STATUS = festesZiel(B_STATUS)
const R_PANEL = festesZiel(B_PANEL)

// ─── Hilfen zum Bedienen ──────────────────────────────────────────────────────
const knoten = (name) => w.locator('.react-flow__node-equipment').filter({ hasText: name }).first()
const alleKnoten = () => w.locator('.react-flow__node-equipment')
const rahmenKnoten = () => w.locator('.react-flow__node-location')
const KOPF = { x: 70, y: 12 }
const kabelPunkt = (i, anteil = 0.5) =>
  w.evaluate(([i, anteil]) => {
    const p = document.querySelectorAll('.react-flow__edge-path')[i]
    if (!p) return null
    const L = p.getTotalLength()
    const pt = p.getPointAtLength(L * anteil)
    const m = p.getScreenCTM()
    return { x: pt.x * m.a + pt.y * m.c + m.e, y: pt.x * m.b + pt.y * m.d + m.f }
  }, [i, anteil])
const kabelAnzahl = () => w.locator('.react-flow__edge-path').count()

/**
 * Menüs und Popups schließen: Escape, dann ein Klick auf die Statuszeile. Ein
 * Klick auf die Zeichenfläche schließt sie nicht (die Fläche verbraucht das
 * Ereignis), ein Klick auf die übrige Oberfläche schon.
 */
async function leerklick() {
  await w.keyboard.press('Escape')
  await pause(150)
  await w.mouse.click(1000, 988)
  await pause(300)
}
/** Auswahl aufheben: Klick auf freie Zeichenfläche. */
async function abwaehlen() {
  await w.mouse.click(820, 905)
  await pause(300)
}
async function alleZu() {
  await a.zu()
  await leerklick()
}
const knopf = (bereich, key, opt = {}) => bereich.getByRole('button', { name: M(key), ...opt }).first()
const leistenKnopf = (key) => knopf(leiste(), key)
async function klickMitte(loc, opt = {}) {
  await loc.first().click({ timeout: 8000, ...opt })
  await pause(500)
}
async function eintippen(loc, text) {
  const el = loc.first()
  await el.click({ timeout: 8000 })
  await el.fill(text)
  await pause(250)
}
/** Ein Ziehen von A nach B in Bildschirmkoordinaten. */
async function ziehe(von, nach, { schritte = 12, halten = 0 } = {}) {
  await w.mouse.move(von.x, von.y)
  await w.mouse.down()
  await w.mouse.move(von.x + (nach.x - von.x) / 2, von.y + (nach.y - von.y) / 2, { steps: schritte })
  if (halten) await pause(halten)
  await w.mouse.move(nach.x, nach.y, { steps: schritte })
  await w.mouse.up()
  await pause(400)
}
const mitte = async (loc) => {
  const b = await loc.first().boundingBox()
  return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null
}
/** Bestätigungsdialog (confirmDialog) mit dem Text der Bestätigen-Schaltfläche beantworten. */
async function bestaetige(muster) {
  const d = R_DIALOG()
  await d.getByRole('button', { name: muster }).first().click({ timeout: 8000 })
  await pause(600)
}
const OK = () => M('common.ok')
const ABBRUCH = () => M('common.cancel')

/** Tooltip (title/aria-label) eines Elements für die Dokumentation festhalten. */
async function merkeTitel(name, loc) {
  try {
    const t = await loc.first().evaluate((el) => el.getAttribute('title') || el.getAttribute('aria-label') || '')
    if (t) extra.tooltips[name] = t
  } catch {}
}

/** Ein Abschnitt = eine Folge mit eigenem Bildpräfix. */
const abschnitte = []
function abschnitt(name, fn) {
  abschnitte.push([name, fn])
}
/** Jedes `ziel:` (Locator, Rechteck, Funktion) so vereinheitlichen, dass es `count()`/`first()` kann. */
const normZiel = (z) => {
  if (z === undefined || z === null) return z
  if (typeof z === 'function') {
    return async () => {
      const v = await z()
      return typeof v?.count === 'function' ? v : rechteckZiel(v)
    }
  }
  return typeof z.count === 'function' ? z : rechteckZiel(z)
}
const rechteckZiel = (r) =>
  r && typeof r.width === 'number'
    ? { count: async () => 1, first: () => ({ screenshot: async (opt) => w.screenshot({ ...opt, clip: { x: r.x, y: r.y, width: r.width, height: r.height } }) }) }
    : { count: async () => 0 }
const neueFolge = (name) => {
  const f = a.folge(`canvas-${name}`)
  const roh = f.schritt.bind(f)
  f.schritt = async (n, tun, opt = {}) => {
    const z = normZiel(opt.ziel)
    // folge() ruft ziel() ohne await auf: hier vorher auflösen.
    let aufgeloest = z
    return roh(n, async () => {
      if (tun) await tun()
      if (typeof z === 'function') aufgeloest = await z()
    }, { ...opt, ziel: () => aufgeloest ?? z })
  }
  folgen[name] = f
  return f
}

// ═══════════════════════════════════════════════════════════════════════════
// START — leerer Plan, Beispielprojekt, Aufbau des Fensters
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('start', async () => {
  const f = neueFolge('start')
  await frisch({ leer: true })
  await f.schritt('leerer-plan', null, { ziel: R_FLAECHE })
  await f.schritt(
    'beispiel-geladen',
    async () => {
      await klickMitte(w.getByRole('button', { name: M('canvas.empty.loadDemo') }))
      await pause(1500)
      await verschiebeAnsicht()
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt('fenster', null, { ziel: () => ({ count: async () => 0 }) })
})

// ═══════════════════════════════════════════════════════════════════════════
// LEISTE — die schwebende Werkzeugleiste: Griff, Schließen, Wiederöffnen
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('leiste', async () => {
  const f = neueFolge('leiste')
  await f.schritt('leiste-ganz', null, { ziel: R_LEISTE })
  await f.schritt(
    'griff-ziehen',
    async () => {
      const griff = leiste().getByTitle(T('toolbar.dragHandle'))
      const p = await mitte(griff)
      await ziehe(p, { x: p.x + 220, y: p.y + 330 })
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'schliessen-knopf',
    async () => {
      const griff = leiste().getByTitle(T('toolbar.dragHandle'))
      const p = await mitte(griff)
      await ziehe(p, { x: p.x - 220, y: p.y - 330 })
      await merkeTitel('leiste-schliessen', leiste().getByRole('button', { name: M('toolbar.close') }))
    },
    { ziel: R_LEISTE },
  )
  await f.schritt(
    'leiste-zu',
    async () => {
      await klickMitte(leiste().getByRole('button', { name: M('toolbar.close') }))
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'ansicht-menue',
    async () => {
      await a.menue('app.menu.view')
    },
    { ziel: ausschnitt(R_MENUE, { x: 470, y: 0, width: 80, height: 40 }) },
  )
  await f.schritt(
    'leiste-wieder-da',
    async () => {
      await a.klick('app.menu.view.canvasToolbar')
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULTS — Menü mit Routing, Kabelfarbe, Sonstiges
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('defaults', async () => {
  const f = neueFolge('defaults')
  const menueOffen = async () => {
    if (!(await R_MENUE().count())) await klickMitte(leistenKnopf('toolbar.defaults.button'))
  }
  const menueZu = async () => {
    await leerklick()
  }
  const menueBild = ausschnitt(R_LEISTE, R_MENUE)
  const schalter = (key) => R_MENUE().getByLabel(M(key)).first()

  await f.schritt(
    'menue-offen',
    async () => {
      await menueOffen()
      extra.texte['defaults-menue'] = await R_MENUE().innerText()
      await merkeTitel('defaults-knopf', leistenKnopf('toolbar.defaults.button'))
    },
    { ziel: menueBild },
  )
  for (const [name, key] of [
    ['routing-direkt', 'toolbar.defaults.routing.straight'],
    ['routing-kurve', 'toolbar.defaults.routing.curved'],
    ['routing-ortho', 'toolbar.defaults.routing.ortho'],
  ]) {
    await f.schritt(
      name,
      async () => {
        await menueOffen()
        await klickMitte(R_MENUE().getByRole('button', { name: M(key), exact: false }).first())
      },
      { ziel: menueBild },
    )
  }
  await f.schritt(
    'farbe-laenge',
    async () => {
      await menueOffen()
      await klickMitte(R_MENUE().getByRole('button', { name: M('toolbar.defaults.cableColor.byLength') }).first())
    },
    { ziel: menueBild },
  )
  await f.schritt(
    'farbe-laenge-flaeche',
    async () => {
      await menueZu()
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'farbe-legende',
    async () => {
      await menueOffen()
      await klickMitte(R_MENUE().getByTitle(T('toolbar.defaults.cableColor.legend')))
      await leerklick() // schließt das Menü, die Legende bleibt
      const lb = await leiste().boundingBox()
      extra.texte['laengen-legende'] = await leiste().innerText()
      void lb
    },
    { ziel: ausschnitt(R_LEISTE, () => ({ x: 270, y: 50, width: 420, height: 420 })) },
  )
  await f.schritt(
    'farbe-typ',
    async () => {
      // Legende zu, Menü auf, "Nach Typ"
      const zu = leiste().getByRole('button', { name: M('toolbar.lengthLegend.close') })
      if (await zu.count()) await zu.first().click().catch(() => {})
      await menueOffen()
      await klickMitte(R_MENUE().getByRole('button', { name: M('toolbar.defaults.cableColor.byType') }).first())
    },
    { ziel: menueBild },
  )
  for (const [name, key, mitFlaeche] of [
    ['pfeil-am-ende', 'toolbar.defaults.arrowEnd', false],
    ['bruecken', 'toolbar.defaults.bumps', true],
    ['labels-aus', 'toolbar.defaults.hideLabels', true],
    ['kurzform', 'toolbar.defaults.shortLabel', false],
    ['ports-nach-typ', 'toolbar.defaults.portsByType', true],
  ]) {
    await f.schritt(
      name,
      async () => {
        await menueOffen()
        await schalter(key).check()
        await merkeTitel(`defaults-${name}`, R_MENUE().locator('label').filter({ hasText: M(key) }))
        await pause(300)
      },
      { ziel: menueBild },
    )
    if (mitFlaeche) {
      await f.schritt(
        `${name}-flaeche`,
        async () => {
          await menueZu()
        },
        { ziel: R_FLAECHE },
      )
    }
  }
  // Zurücksetzen, damit die Folgeabschnitte den Grundzustand sehen
  await menueOffen()
  for (const key of ['toolbar.defaults.arrowEnd', 'toolbar.defaults.bumps', 'toolbar.defaults.hideLabels', 'toolbar.defaults.shortLabel', 'toolbar.defaults.portsByType']) {
    await schalter(key).uncheck().catch(() => {})
  }
  await menueZu()
  await f.schritt(
    'gewerk-farbe',
    async () => {
      await a.menue('app.menu.view', 'app.menu.view.colorByLayer')
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await a.menue('app.menu.view', 'app.menu.view.colorByLayer') // wieder aus
})

// ═══════════════════════════════════════════════════════════════════════════
// AUSWAHL — Einzel-, Mehrfachauswahl, Ausrichten, Gruppe, Rack, Kabel verbinden
// ═══════════════════════════════════════════════════════════════════════════
const kopfKlick = (name, mod) => knoten(name).click({ position: KOPF, modifiers: mod ? [mod] : [], timeout: 8000 })
const rueckgaengig = async () => {
  await w.getByRole('button', { name: M('app.undo') }).first().click({ timeout: 5000 })
  await pause(500)
}
const R_FLAECHE_INSPECTOR = ausschnitt(flaecheOben, { x: 1518, y: 40, width: 282, height: 680 })

abschnitt('auswahl', async () => {
  const f = neueFolge('auswahl')
  await f.schritt('ein-geraet', async () => kopfKlick('Camera 2'), { ziel: R_FLAECHE_INSPECTOR })
  for (const [name, key] of [
    ['links', 'toolbar.align.leftViewport'],
    ['unten', 'toolbar.align.bottomViewport'],
  ]) {
    await f.schritt(
      `einzeln-${name}`,
      async () => {
        await merkeTitel(`ausrichten-einzeln-${name}`, leiste().getByRole('button', { name: M(key) }))
        await klickMitte(leiste().getByRole('button', { name: M(key) }))
      },
      { ziel: R_FLAECHE },
    )
    await rueckgaengig().catch(() => {})
  }
  await f.schritt('zwei-geraete', async () => kopfKlick('Vision mixer', 'Shift'), { ziel: R_FLAECHE })
  await f.schritt('drei-geraete', async () => kopfKlick('Multiviewer', 'Shift'), { ziel: R_FLAECHE })
  await f.schritt(
    'auswahl-aufgehoben',
    async () => {
      await abwaehlen()
      await pause(400)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'rechteck',
    async () => {
      await w.keyboard.down('Shift')
      await ziehe({ x: 300, y: 475 }, { x: 1450, y: 630 })
      await w.keyboard.up('Shift')
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'alles-auswaehlen',
    async () => {
      await abwaehlen()
      await a.menue('app.menu.edit', 'app.menu.edit.selectAll')
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )

  // Ausrichten mit der Werkzeugleiste (3 Geräte: Camera 2, Vision mixer, Multiviewer)
  const dreiWaehlen = async () => {
    await abwaehlen()
    await kopfKlick('Camera 2')
    await kopfKlick('Vision mixer', 'Shift')
    await kopfKlick('Multiviewer', 'Shift')
    await pause(300)
  }
  await dreiWaehlen()
  for (const [name, key] of [
    ['links', 'toolbar.align.left'],
    ['mitte-waagerecht', 'toolbar.align.centerH'],
    ['rechts', 'toolbar.align.right'],
    ['oben', 'toolbar.align.top'],
    ['mitte-senkrecht', 'toolbar.align.centerV'],
    ['unten', 'toolbar.align.bottom'],
    ['verteilen-waagerecht', 'toolbar.align.distH'],
    ['verteilen-senkrecht', 'toolbar.align.distV'],
  ]) {
    await f.schritt(
      `ausrichten-${name}`,
      async () => {
        await dreiWaehlen()
        await merkeTitel(`ausrichten-${name}`, leiste().getByRole('button', { name: M(key) }))
        await klickMitte(leiste().getByRole('button', { name: M(key) }))
      },
      { ziel: () => festesZiel({ x: 230, y: 230, width: 1260, height: 500 }) },
    )
    await rueckgaengig().catch(() => {})
  }

  // Gruppe speichern
  await f.schritt(
    'gruppe-name',
    async () => {
      await dreiWaehlen()
      await klickMitte(leiste().getByRole('button', { name: M('toolbar.group.save') }))
    },
    { ziel: ausschnitt(R_LEISTE) },
  )
  await f.schritt(
    'gruppe-gespeichert',
    async () => {
      await eintippen(leiste().getByPlaceholder(T('toolbar.groupName.placeholder')), zw('Studio-Kern', 'Studio core'))
      await klickMitte(leiste().getByRole('button', { name: M('toolbar.groupName.save') }))
      await a.klick('library.tab.groups')
      await pause(600)
    },
    { ziel: R_BIBLIOTHEK },
  )
  await f.schritt(
    'gruppe-ueberschreiben',
    async () => {
      await dreiWaehlen()
      await klickMitte(leiste().getByRole('button', { name: M('toolbar.group.save') }))
      await eintippen(leiste().getByPlaceholder(T('toolbar.groupName.placeholder')), zw('Studio-Kern', 'Studio core'))
      await klickMitte(leiste().getByRole('button', { name: M('toolbar.groupName.save') }))
    },
    { ziel: R_DIALOG },
  )
  await bestaetige(M('toolbar.group.overwrite')).catch(() => {})
  await a.klick('library.tab.equipment').catch(() => {})

  // 2D-Rack-Builder aus der Auswahl
  await f.schritt(
    'rack-aus-auswahl',
    async () => {
      await dreiWaehlen()
      await merkeTitel('rack-anordnen', leiste().getByRole('button', { name: M('toolbar.rack.arrange') }))
      await klickMitte(leiste().getByRole('button', { name: M('toolbar.rack.arrange') }))
      await pause(1500)
      extra.texte['rack-aus-auswahl'] = await a.dialogText()
    },
    { ziel: R_FENSTER },
  )
  await a.zu()
  await w.getByRole('button', { name: M('common.close') }).last().click({ timeout: 2000 }).catch(() => {})
  await a.zu()

  // Kabel verbinden (genau zwei Geräte)
  await f.schritt(
    'kabel-verbinden-knopf',
    async () => {
      await abwaehlen()
      await kopfKlick('Camera 2')
      await kopfKlick('Vision mixer', 'Shift')
      await merkeTitel('kabel-verbinden', leiste().getByRole('button', { name: M('toolbar.bulkConnect.label') }))
    },
    { ziel: R_LEISTE },
  )
  await f.schritt(
    'kabel-verbinden-dialog',
    async () => {
      await klickMitte(leiste().getByRole('button', { name: M('toolbar.bulkConnect.label') }))
      await pause(500)
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'kabel-verbinden-werte',
    async () => {
      const d = R_DIALOG()
      const zahlen = d.locator('input[type="number"]')
      await zahlen.nth(1).fill('3') // Ziel ab Anschluss 3
      await zahlen.nth(2).fill('4') // Anzahl 4 (mehr als Anschlüsse da sind)
      await pause(400)
      extra.texte['kabel-verbinden-vorschau'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'kabel-verbinden-erstellt',
    async () => {
      const d = R_DIALOG()
      await d.getByRole('button', { name: /^(Create|Erstelle)/ }).first().click({ timeout: 6000 })
      await pause(900)
    },
    { ziel: R_FLAECHE },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// KÜRZEL — Tastatur auf dem Canvas
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('kuerzel', async () => {
  const f = neueFolge('kuerzel')
  const auf = (loc) => loc.first().boundingBox()
  await f.schritt('auswahl', async () => kopfKlick('Camera 2'), { ziel: R_FLAECHE })
  await f.schritt(
    'pfeil-rechts',
    async () => {
      await w.keyboard.press('ArrowRight')
      await w.keyboard.press('ArrowRight')
      await w.keyboard.press('ArrowRight')
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'umschalt-pfeil',
    async () => {
      await w.keyboard.press('Shift+ArrowDown')
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'strg-d',
    async () => {
      await w.keyboard.press('Control+d')
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'strg-c-v',
    async () => {
      await abwaehlen()
      await kopfKlick('Control room monitor')
      await w.keyboard.press('Control+c')
      await w.keyboard.press('Control+v')
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'strg-plus',
    async () => {
      await w.mouse.move(700, 800)
      await w.mouse.move(720, 810)
      await w.keyboard.press('Control+=')
      await pause(600)
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'strg-plus-ergebnis',
    async () => {
      const d = R_DIALOG()
      await d.getByRole('textbox').fill(zw('Reserve-Monitor', 'Spare monitor'))
      await d.getByRole('button', { name: OK() }).click()
      await pause(700)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'entf',
    async () => {
      await w.keyboard.press('Delete')
      await pause(700)
      extra.texte['entf-dialog'] = await a.dialogText()
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'escape-kabel',
    async () => {
      await a.zu()
      await abwaehlen()
    },
    { ziel: R_FLAECHE },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// RAHMEN — Location-Rahmen anlegen, benennen, ändern, sperren, löschen
// ═══════════════════════════════════════════════════════════════════════════
const rahmenNeu = () => leiste().getByRole('button', { name: M('toolbar.location.add') })
const rahmenUmAuswahl = () => leiste().getByRole('button', { name: M('toolbar.location.addAround') })
const rahmenName = (n = 0) => rahmenKnoten().nth(n).locator('span').last()
async function rahmenUmbenennen(n, name) {
  const b = await rahmenKnoten().nth(n).boundingBox()
  await w.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2)
  await pause(500)
  const d = R_DIALOG()
  await d.getByRole('textbox').fill(name)
  await d.getByRole('button', { name: OK() }).click()
  await pause(500)
}
const gewaehlt = { x: 0, y: 0 }

abschnitt('rahmen', async () => {
  const f = neueFolge('rahmen')
  await f.schritt(
    'rahmen-leer',
    async () => {
      await merkeTitel('rahmen-ohne-auswahl', rahmenNeu())
      await klickMitte(rahmenNeu())
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'rahmen-umbenennen',
    async () => {
      const b = await rahmenKnoten().first().boundingBox()
      await w.mouse.dblclick(b.x + b.width / 2, b.y + b.height - 30)
      await pause(500)
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'rahmen-benannt',
    async () => {
      const d = R_DIALOG()
      await d.getByRole('textbox').fill(zw('Studio', 'Studio'))
      await d.getByRole('button', { name: OK() }).click()
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'rahmen-inspector',
    async () => {
      await rahmenName(0).click({ timeout: 6000 })
      await pause(500)
    },
    { ziel: R_FLAECHE_INSPECTOR },
  )
  await f.schritt(
    'rahmen-groesse',
    async () => {
      const g = w.locator('.react-flow__resize-control.handle.bottom.right').first()
      const p = await mitte(g)
      await ziehe(p, { x: p.x + 140, y: p.y + 90 })
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'rahmen-verschieben',
    async () => {
      const b = await rahmenKnoten().first().boundingBox()
      await ziehe({ x: b.x + b.width / 2, y: b.y + b.height - 12 }, { x: b.x + b.width / 2 + 60, y: b.y + b.height - 12 + 320 })
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'rahmen-sperren',
    async () => {
      await klickMitte(rahmenKnoten().first().getByTitle(T('locationFrame.lock')))
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'rahmen-entsperren',
    async () => {
      await klickMitte(rahmenKnoten().first().getByTitle(T('locationFrame.unlock')))
    },
    { ziel: R_FLAECHE },
  )
  // Rahmen um die Auswahl
  await f.schritt(
    'rahmen-kontext',
    async () => {
      const b = await rahmenKnoten().first().boundingBox()
      await w.mouse.click(b.x + b.width / 2, b.y + b.height - 12, { button: 'right' })
      await pause(400)
      gewaehlt.x = b.x + b.width / 2
      gewaehlt.y = b.y + b.height - 12
    },
    { ziel: () => ({ count: async () => 1, first: () => ({ screenshot: async (o) => w.screenshot({ ...o, clip: umPunkt(gewaehlt.x, gewaehlt.y, 240, 130) }) }) }) },
  )
  await f.schritt(
    'rahmen-loeschen-frage',
    async () => {
      await w.getByText(M('canvas.nodeMenu.deleteLocation')).first().click({ timeout: 5000 })
      await pause(500)
      extra.texte['rahmen-loeschen'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'rahmen-geloescht',
    async () => {
      await bestaetige(M('confirm.delete'))
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'rahmen-um-auswahl',
    async () => {
      await kopfKlick('Camera 1')
      await kopfKlick('Camera 2', 'Shift')
      await merkeTitel('rahmen-um-auswahl', rahmenUmAuswahl())
    },
    { ziel: R_LEISTE },
  )
  await f.schritt(
    'rahmen-um-auswahl-fertig',
    async () => {
      await klickMitte(rahmenUmAuswahl())
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'rahmen-nimmt-mit',
    async () => {
      await abwaehlen()
      const b = await rahmenKnoten().first().boundingBox()
      await ziehe({ x: b.x + b.width / 2, y: b.y + 4 }, { x: b.x + b.width / 2 + 120, y: b.y + 4 + 60 })
    },
    { ziel: R_FLAECHE },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// RÄUME — Etagen, Raumsichtbarkeit, Steigschacht, Gebäude-3D
// ═══════════════════════════════════════════════════════════════════════════
const raumButton = () => leiste().locator('button[aria-haspopup="menu"]').filter({ hasText: /^\s*(Rooms|Räume)/ }).first()
const dreiD = () => leiste().getByRole('button', { name: M('gebaeude3d.button') }).first()
async function etageSetzen(name) {
  const sel = w.locator('select').filter({ hasText: M('floors.add') }).first()
  const vorhanden = await sel.locator('option').allInnerTexts()
  if (vorhanden.some((o) => o.startsWith(name))) {
    await sel.selectOption({ label: vorhanden.find((o) => o.startsWith(name)) })
  } else {
    await sel.selectOption({ label: T('floors.add') })
    await pause(500)
    const d = R_DIALOG()
    await d.getByRole('textbox').fill(name)
    await d.getByRole('button', { name: OK() }).click()
  }
  await pause(500)
}

abschnitt('raeume', async () => {
  const f = neueFolge('raeume')
  const nEG = zw('Erdgeschoss', 'Ground floor')
  const nOG = zw('1. Obergeschoss', '1st floor')
  await f.schritt(
    'rahmen-kameras',
    async () => {
      await kopfKlick('Camera 1')
      await kopfKlick('Camera 2', 'Shift')
      await klickMitte(rahmenUmAuswahl())
      await abwaehlen()
      await rahmenUmbenennen(0, zw('Studio', 'Studio'))
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'rahmen-monitore',
    async () => {
      await kopfKlick('Multiviewer')
      await kopfKlick('Control room monitor', 'Shift')
      await klickMitte(rahmenUmAuswahl())
      await abwaehlen()
      await rahmenUmbenennen(1, zw('Regie', 'Control room'))
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'rahmen-mischer',
    async () => {
      await kopfKlick('Vision mixer')
      await klickMitte(rahmenUmAuswahl())
      await abwaehlen()
      await rahmenUmbenennen(2, zw('Technik', 'Machine room'))
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'raeume-knopf',
    async () => {
      await merkeTitel('raeume-knopf', raumButton())
      await merkeTitel('drei-d-knopf', dreiD())
    },
    { ziel: R_LEISTE },
  )
  await f.schritt(
    'etage-neu',
    async () => {
      await rahmenName(0).click({ timeout: 6000 })
      await pause(400)
      const sel = w.locator('select').filter({ hasText: M('floors.add') }).first()
      await sel.selectOption({ label: T('floors.add') })
      await pause(500)
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'etage-benannt',
    async () => {
      const d = R_DIALOG()
      await d.getByRole('textbox').fill(nEG)
      await d.getByRole('button', { name: OK() }).click()
      await pause(600)
    },
    { ziel: R_FLAECHE_INSPECTOR },
  )
  await f.schritt(
    'etage-zweite',
    async () => {
      await rahmenName(1).click({ timeout: 6000 })
      await pause(400)
      await etageSetzen(nOG)
    },
    { ziel: R_FLAECHE_INSPECTOR },
  )
  await f.schritt(
    'etage-hoehen',
    async () => {
      const felder = w.locator('input[placeholder="m"]')
      const n = await felder.count()
      if (n >= 2) {
        await felder.nth(0).fill('0')
        await felder.nth(1).fill('4')
      }
      await pause(400)
      extra.texte['etagen-inspector'] = await w.locator('text=' + T('floors.hint').slice(0, 20)).first().innerText().catch(() => '')
    },
    { ziel: R_INSPECTOR },
  )
  await f.schritt('etage-dritter-raum', async () => {
    await rahmenName(2).click({ timeout: 6000 })
    await pause(400)
    await etageSetzen(nOG)
  }, { ziel: R_FLAECHE_INSPECTOR })
  await f.schritt(
    'steigschacht',
    async () => {
      await w.getByLabel(M('location.field.riser')).first().check()
      await pause(400)
    },
    { ziel: R_INSPECTOR },
  )
  await f.schritt(
    'raeume-menue',
    async () => {
      await abwaehlen()
      await klickMitte(raumButton())
      extra.texte['raeume-menue'] = await R_MENUE().innerText()
    },
    { ziel: ausschnitt(R_LEISTE, R_MENUE) },
  )
  await f.schritt(
    'raum-aus',
    async () => {
      await R_MENUE().locator('label').filter({ hasText: zw('Regie', 'Control room') }).locator('input').first().uncheck()
      await pause(500)
    },
    { ziel: ausschnitt(R_LEISTE, R_MENUE) },
  )
  await f.schritt('raum-aus-flaeche', async () => leerklick(), { ziel: R_FLAECHE })
  await f.schritt(
    'etage-aus',
    async () => {
      await klickMitte(raumButton())
      await R_MENUE().locator('label').filter({ hasText: nOG }).locator('input').first().uncheck()
      await pause(500)
    },
    { ziel: ausschnitt(R_LEISTE, R_MENUE) },
  )
  await f.schritt('etage-aus-flaeche', async () => leerklick(), { ziel: R_FLAECHE })
  await f.schritt(
    'alle-zeigen',
    async () => {
      await klickMitte(raumButton())
      await R_MENUE().getByRole('menuitem', { name: M('canvas.rooms.showAll') }).click()
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  // Gebäude 3D
  await f.schritt(
    'drei-d-raeume',
    async () => {
      await klickMitte(dreiD())
      await pause(3500)
    },
    { ziel: R_FENSTER },
  )
  await f.schritt(
    'drei-d-kabel',
    async () => {
      await R_DIALOG().getByRole('button', { name: M('gebaeude3d.modeCables') }).first().click()
      await pause(2500)
    },
    { ziel: R_FENSTER },
  )
  await f.schritt(
    'drei-d-ohne-beschriftung',
    async () => {
      await R_DIALOG().getByLabel(M('gebaeude3d.labels')).uncheck()
      await pause(1500)
    },
    { ziel: R_FENSTER },
  )
  await f.schritt(
    'drei-d-geschosshoehe',
    async () => {
      await R_DIALOG().getByLabel(M('gebaeude3d.labels')).check()
      const eingabe = R_DIALOG().getByLabel(M('gebaeude3d.storey')).first()
      await eingabe.fill('6')
      await eingabe.press('Enter')
      await pause(2000)
      await merkeTitel('drei-d-geschosshoehe', R_DIALOG().locator('label').filter({ hasText: M('gebaeude3d.storey') }))
    },
    { ziel: R_FENSTER },
  )
  await f.schritt(
    'drei-d-raeume-menue',
    async () => {
      await R_DIALOG().locator('button[aria-haspopup="menu"]').first().click()
      await pause(500)
    },
    { ziel: R_FENSTER },
  )
  await f.schritt(
    'drei-d-zu',
    async () => {
      await w.keyboard.press('Escape')
      await R_DIALOG().getByRole('button', { name: M('common.close') }).first().click({ timeout: 3000 }).catch(() => {})
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// EBENEN — Kabel-Ebenen: Chips, Menü, eigene Ebenen
// ═══════════════════════════════════════════════════════════════════════════
const ebenenChip = (name) => leiste().locator(`button[title^="${name}"]`).first()
const ebenenMenueKnopf = () =>
  leiste().locator('button[aria-haspopup="menu"]').filter({ hasText: T('canvas.layerChips.menuButton') }).first()

abschnitt('ebenen', async () => {
  const f = neueFolge('ebenen')
  await f.schritt(
    'chips',
    async () => {
      await merkeTitel('ebene-video', ebenenChip('Video'))
      await merkeTitel('ebenen-menue-knopf', ebenenMenueKnopf())
    },
    { ziel: R_LEISTE },
  )
  await f.schritt('video-aus', async () => klickMitte(ebenenChip('Video')), { ziel: R_FLAECHE })
  await f.schritt(
    'menue',
    async () => {
      await klickMitte(ebenenMenueKnopf())
      extra.texte['ebenen-menue'] = await R_MENUE().innerText()
    },
    { ziel: ausschnitt(R_LEISTE, R_MENUE) },
  )
  await f.schritt(
    'alle-wieder',
    async () => {
      await R_MENUE().getByRole('menuitem', { name: M('canvas.layerChips.resetAll') }).click()
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'eigene-anlegen',
    async () => {
      await klickMitte(ebenenMenueKnopf())
      await R_MENUE().getByRole('menuitem', { name: M('canvas.layerChips.addCustom') }).click()
      await pause(500)
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'eigene-chip',
    async () => {
      const d = R_DIALOG()
      await d.getByRole('textbox').fill('intercom')
      await d.getByRole('button', { name: OK() }).click()
      await pause(600)
      await merkeTitel('ebene-eigene', ebenenChip('intercom'))
    },
    { ziel: R_LEISTE },
  )
  await f.schritt('eigene-aus', async () => klickMitte(ebenenChip('intercom')), { ziel: R_LEISTE })
  await f.schritt(
    'eigene-entfernen-frage',
    async () => {
      await ebenenChip('intercom').click({ button: 'right' })
      await pause(500)
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'eigene-entfernt',
    async () => {
      await bestaetige(M('common.delete'))
    },
    { ziel: R_LEISTE },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// SIGNALWEG — Kette hervorheben
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('signalweg', async () => {
  const f = neueFolge('signalweg')
  await f.schritt(
    'kabel-gewaehlt',
    async () => {
      const p = await kabelPunkt(0, 0.35)
      await w.mouse.click(p.x, p.y)
      await pause(600)
    },
    { ziel: R_FLAECHE_INSPECTOR },
  )
  await f.schritt(
    'signalweg-zeigen',
    async () => {
      await klickMitte(w.getByRole('button', { name: M('signalweg.show') }))
      await pause(600)
      extra.tooltips['signalweg-knopf'] = await w.getByRole('button', { name: M('signalweg.hide') }).first().getAttribute('title')
    },
    { ziel: R_FLAECHE_INSPECTOR },
  )
  await f.schritt(
    'signalweg-esc',
    async () => {
      await w.keyboard.press('Escape')
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'signalweg-chip-klick',
    async () => {
      await klickMitte(w.getByRole('button', { name: M('signalweg.show') }))
      await pause(500)
      await klickMitte(leiste().locator('button').filter({ hasText: M('canvas.signalweg.chip') }))
    },
    { ziel: R_FLAECHE },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// MODI — Schema/Live, Schaltbild, Prüfbild, Weg schalten
// ═══════════════════════════════════════════════════════════════════════════
const flowChip = () => leiste().getByRole('button', { name: M('canvas.flow.schema') }).first()
const schaltbildChip = () => leiste().getByRole('button', { name: M('canvas.circuit.label') }).first()
const pruefbildSelect = () => leiste().locator('select').first()

abschnitt('modi', async () => {
  const f = neueFolge('modi')
  await f.schritt(
    'schema-chip',
    async () => {
      await merkeTitel('flow-chip', flowChip())
      extra.tooltips['flow-chip-voll'] = await flowChip().getAttribute('title')
    },
    { ziel: R_LEISTE },
  )
  await f.schritt(
    'schema-ruhig',
    async () => {
      await klickMitte(flowChip())
      extra.tooltips['flow-chip-ruhig'] = await flowChip().getAttribute('title')
    },
    { ziel: R_LEISTE },
  )
  await f.schritt('schema-bewegt', async () => klickMitte(flowChip()), { ziel: R_LEISTE })
  await f.schritt(
    'schaltbild-an',
    async () => {
      extra.tooltips['schaltbild-aus'] = await schaltbildChip().getAttribute('title')
      await klickMitte(schaltbildChip())
      extra.tooltips['schaltbild-an'] = await schaltbildChip().getAttribute('title')
    },
    { ziel: R_LEISTE },
  )
  await f.schritt('schaltbild-aus', async () => klickMitte(schaltbildChip()), { ziel: R_LEISTE })
  await f.schritt(
    'pruefbild-quellen',
    async () => {
      extra.listen['pruefbild-quellen'] = await pruefbildSelect().locator('option').allInnerTexts()
      extra.tooltips['pruefbild-auswahl'] = await pruefbildSelect().getAttribute('title')
    },
    { ziel: R_LEISTE },
  )
  await f.schritt(
    'pruefbild-gewaehlt',
    async () => {
      await pruefbildSelect().selectOption({ label: 'Camera 1' })
      await pause(800)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'pruefbild-leiste',
    async () => {
      for (const key of ['canvas.pattern.saveImage', 'canvas.pattern.saveSheet', 'canvas.pattern.saveAcceptance', 'canvas.pattern.switch']) {
        const b = leiste().getByRole('button', { name: M(key) })
        if (await b.count()) extra.tooltips[key] = await b.first().getAttribute('title')
      }
    },
    { ziel: R_LEISTE },
  )
  await f.schritt(
    'pruefbild-falsches-bild',
    async () => {
      const k = knoten('Control room monitor')
      await k.getByRole('button', { name: M('canvas.pattern.check.wrong') }).first().click({ timeout: 6000 })
      await pause(400)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'pruefbild-vertauscht',
    async () => {
      const k = knoten('Control room monitor')
      await k.locator('input').first().fill('Camera 2')
      await k.getByRole('button', { name: M('canvas.pattern.check.save') }).first().click()
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'pruefbild-stimmt',
    async () => {
      const k = knoten('Multiviewer')
      await k.getByRole('button', { name: M('canvas.pattern.check.ok') }).first().click({ timeout: 6000 })
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'weg-schalten-dialog',
    async () => {
      const b = leiste().getByRole('button', { name: M('canvas.pattern.switch') })
      if (!(await b.count())) throw new Error('Weg schalten: Schaltfläche nicht vorhanden')
      await klickMitte(b)
      await pause(600)
      extra.texte['weg-schalten-leer'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'weg-schalten-wahl',
    async () => {
      const d = R_DIALOG()
      const s = d.locator('select').first()
      const opts = await s.locator('option').allInnerTexts()
      extra.listen['weg-schalten-ziele'] = opts
      if (opts.length > 1) await s.selectOption({ index: 1 })
      await pause(700)
      extra.texte['weg-schalten-plan'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'weg-schalten-bestaetigung',
    async () => {
      const d = R_DIALOG()
      await d.getByRole('checkbox').first().check()
      await pause(500)
      extra.tooltips['weg-schalten-knopf-aktiv'] = String(await d.getByRole('button', { name: M('canvas.hubSwitch.send') }).first().isEnabled())
    },
    { ziel: R_DIALOG },
  )
  await a.zu()
  await w.getByRole('button', { name: M('canvas.hubSwitch.close') }).first().click({ timeout: 2000 }).catch(() => {})
  await f.schritt(
    'pruefbild-ohne',
    async () => {
      await pruefbildSelect().selectOption({ label: T('canvas.pattern.none') })
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// SPERREN — drei Schalter: Rahmen, Geräte, Kabel
// ═══════════════════════════════════════════════════════════════════════════
const sperrKnopf = () => leiste().getByRole('button', { name: M('toolbar.lock.button') }).first()

abschnitt('sperren', async () => {
  const f = neueFolge('sperren')
  const menuePlusLeiste = ausschnitt(R_LEISTE, R_MENUE)
  const zeile = (key) => R_MENUE().getByRole('button', { name: M(key) }).first()
  await f.schritt(
    'menue',
    async () => {
      await merkeTitel('sperren-knopf', sperrKnopf())
      await klickMitte(sperrKnopf())
      extra.texte['sperren-menue'] = await R_MENUE().innerText()
    },
    { ziel: menuePlusLeiste },
  )
  await f.schritt('geraete', async () => klickMitte(zeile('toolbar.lock.equipment.label')), { ziel: menuePlusLeiste })
  await f.schritt(
    'geraet-bleibt',
    async () => {
      await leerklick()
      const vor = await knoten('Camera 2').boundingBox()
      const p = { x: vor.x + 70, y: vor.y + 12 }
      await ziehe(p, { x: p.x + 160, y: p.y + 90 })
      const nach = await knoten('Camera 2').boundingBox()
      extra.texte['sperren-geraet-verschoben'] = String(Math.round(vor.x) !== Math.round(nach.x) || Math.round(vor.y) !== Math.round(nach.y))
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'kabel',
    async () => {
      await klickMitte(sperrKnopf())
      await klickMitte(zeile('toolbar.lock.cables.label'))
    },
    { ziel: menuePlusLeiste },
  )
  await f.schritt(
    'kabel-ohne-griffe',
    async () => {
      await leerklick()
      const p = await kabelPunkt(0, 0.35)
      await w.mouse.click(p.x, p.y)
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'rahmen',
    async () => {
      await klickMitte(sperrKnopf())
      await klickMitte(zeile('toolbar.lock.frames.label'))
    },
    { ziel: menuePlusLeiste },
  )
  await f.schritt(
    'alle-aus',
    async () => {
      for (const k of ['toolbar.lock.frames.label', 'toolbar.lock.equipment.label', 'toolbar.lock.cables.label']) {
        await klickMitte(zeile(k))
      }
    },
    { ziel: menuePlusLeiste },
  )
  await f.schritt(
    'kabel-mit-griffen',
    async () => {
      await leerklick()
      const p = await kabelPunkt(0, 0.35)
      await w.mouse.click(p.x, p.y)
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// ABSCHLIESSEN — Plan sperren und freigeben
// ═══════════════════════════════════════════════════════════════════════════
const abschliessenKnopf = () =>
  leiste().getByRole('button', { name: new RegExp(`${T('toolbar.planLock.label.editing')}|${T('toolbar.planLock.label.finalized')}`) }).first()

abschnitt('abschliessen', async () => {
  const f = neueFolge('abschliessen')
  await f.schritt(
    'knopf',
    async () => {
      await merkeTitel('abschliessen-knopf', abschliessenKnopf())
    },
    { ziel: R_LEISTE },
  )
  await f.schritt(
    'frage',
    async () => {
      await klickMitte(abschliessenKnopf())
      extra.texte['abschliessen-frage'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'abgeschlossen',
    async () => {
      await bestaetige(M('toolbar.planLock.finalize.ok'))
      await pause(600)
      await merkeTitel('abgeschlossen-knopf', abschliessenKnopf())
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'verschieben-geht-nicht',
    async () => {
      const vor = await knoten('Camera 2').boundingBox()
      const p = { x: vor.x + 70, y: vor.y + 12 }
      await ziehe(p, { x: p.x + 160, y: p.y + 90 })
      const nach = await knoten('Camera 2').boundingBox()
      extra.texte['abgeschlossen-geraet-verschoben'] = String(Math.round(vor.x) !== Math.round(nach.x) || Math.round(vor.y) !== Math.round(nach.y))
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'freigeben-frage',
    async () => {
      await klickMitte(w.getByRole('button', { name: M('canvas.area.releaseBtn') }))
      extra.texte['freigeben-frage'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'freigegeben',
    async () => {
      await bestaetige(M('canvas.area.release'))
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'ueber-die-leiste-frage',
    async () => {
      await klickMitte(abschliessenKnopf())
      await bestaetige(M('toolbar.planLock.finalize.ok'))
      await pause(500)
      await klickMitte(abschliessenKnopf())
      extra.texte['leiste-freigeben-frage'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'ueber-die-leiste-frei',
    async () => {
      await bestaetige(M('toolbar.planLock.unlock.ok'))
      await pause(500)
    },
    { ziel: R_LEISTE },
  )
  // Betrachter-Datei (Beispiel): nur lesen
  await f.schritt(
    'betrachter',
    async () => {
      const p = projektGeruest('Viewer', [
        GE('a1', 'Camera 1', 'Cameras', 80, 140, [], [PT('a1_o', 'SDI Out', 'BNC', 'out')]),
        GE('a2', 'Vision mixer', 'Mixer', 480, 140, [PT('a2_i', 'In 1', 'BNC', 'in')], []),
      ], [KB('v1', 'CAM 1', 'a1', 'a1_o', 'a2', 'a2_i', 'BNC', { layer: 'video' })])
      p.mode = 'viewer'
      await projektLaden(p, 'betrachter.json')
      extra.tooltips['betrachter-knopf'] = await w.getByRole('button', { name: /^(Viewer|Betrachter)/ }).first().getAttribute('title').catch(() => '')
    },
    { ziel: ausschnitt(R_LEISTE, R_FLAECHE) },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// ANMERKUNGEN — Panel, Badges auf dem Canvas
// ═══════════════════════════════════════════════════════════════════════════
const anmerkungenKnopf = () => leiste().getByRole('button', { name: M('toolbar.annotations.label') }).first()
const badgesKnopf = () => leiste().getByRole('button', { name: M('toolbar.annotations.badgeLabel') }).first()

abschnitt('anmerkungen', async () => {
  const f = neueFolge('anmerkungen')
  await f.schritt(
    'knoepfe',
    async () => {
      await merkeTitel('badges-knopf', badgesKnopf())
      await merkeTitel('anmerkungen-knopf', anmerkungenKnopf())
    },
    { ziel: R_LEISTE },
  )
  await f.schritt('panel-offen', async () => klickMitte(anmerkungenKnopf()), { ziel: R_FENSTER })
  await f.schritt(
    'neu-name',
    async () => {
      await klickMitte(w.getByRole('button', { name: M('annotations.new') }).first())
      await pause(500)
      extra.texte['anmerkung-name-frage'] = await a.dialogText()
    },
    { ziel: R_FENSTER },
  )
  await f.schritt(
    'neu-text',
    async () => {
      const d = w.locator('[role="dialog"]')
      if (await d.count()) {
        await d.last().getByRole('textbox').fill(zw('Lars', 'Lars'))
        await d.last().getByRole('button', { name: OK() }).click()
        await pause(600)
      }
      await w.getByRole('textbox').last().fill(zw('Kabel zur Regie länger legen', 'Run the cable to the control room longer'))
      await pause(300)
    },
    { ziel: R_FENSTER },
  )
  await f.schritt(
    'hinzugefuegt',
    async () => {
      await klickMitte(w.getByRole('button', { name: M('annotations.add') }).first())
      await pause(600)
    },
    { ziel: R_FENSTER },
  )
  // zwei weitere
  for (const text of [zw('Kamera 2 braucht Stativ', 'Camera 2 needs a tripod'), zw('Mischer im Rack', 'Mixer goes in the rack')]) {
    await klickMitte(w.getByRole('button', { name: M('annotations.new') }).first())
    await w.getByRole('textbox').last().fill(text)
    await klickMitte(w.getByRole('button', { name: M('annotations.add') }).first())
  }
  await f.schritt(
    'status-gebaut',
    async () => {
      const sel = w.locator('select').filter({ has: w.locator('option[value="built"]') })
      await sel.nth(0).selectOption('built')
      await sel.nth(1).selectOption('resolved')
      await pause(500)
    },
    { ziel: R_FENSTER },
  )
  for (const [name, key] of [
    ['filter-offen', 'annotations.status.open'],
    ['filter-gebaut', 'annotations.status.built'],
    ['filter-erledigt', 'annotations.status.resolved'],
    ['filter-alle', 'annotations.status.all'],
  ]) {
    await f.schritt(
      name,
      async () => {
        await klickMitte(w.getByRole('button', { name: new RegExp(`^\\s*${T(key)}`, 'i') }).first())
      },
      { ziel: R_FENSTER },
    )
  }
  await f.schritt(
    'in-die-mitte',
    async () => {
      const b = w.getByRole('button', { name: M('annotations.placeCenter') }).first()
      await klickMitte(b)
      await pause(600)
    },
    { ziel: R_FENSTER },
  )
  await f.schritt(
    'an-geraet',
    async () => {
      const griffe = w.locator('[draggable="true"]').filter({ hasText: /./ })
      const n = await griffe.count()
      extra.texte['anmerkungen-griffe'] = String(n)
      const quelle = griffe.nth(Math.max(0, n - 1))
      const ziel = knoten('Camera 2')
      await quelle.dragTo(ziel, { targetPosition: { x: 100, y: 30 }, timeout: 8000 })
      await pause(700)
    },
    { ziel: R_FENSTER },
  )
  await f.schritt(
    'badge-karte',
    async () => {
      const badge = w.locator('[title="' + T('annotations.overlay.titleAnchored') + '"], [title="' + T('annotations.overlay.titleFree') + '"]').first()
      await badge.click({ timeout: 6000 })
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'badges-aus',
    async () => {
      await klickMitte(badgesKnopf())
      extra.tooltips['badges-aus'] = await badgesKnopf().getAttribute('title')
    },
    { ziel: ausschnitt(R_LEISTE, flaecheOben) },
  )
  await f.schritt('badges-an', async () => klickMitte(badgesKnopf()), { ziel: R_LEISTE })
  await f.schritt(
    'loeschen-frage',
    async () => {
      await klickMitte(w.getByRole('button', { name: M('annotations.delete') }).first())
      extra.texte['anmerkung-loeschen'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'geloescht',
    async () => {
      await bestaetige(M('common.delete'))
    },
    { ziel: R_FENSTER },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// HALLENPLAN — Bild laden, Maßstab (zwei Punkte, vier Ecken), Venue-Austausch
// ═══════════════════════════════════════════════════════════════════════════
async function planBild(pfad, { breite = 900, hoehe = 600 } = {}) {
  const b64 = await w.evaluate(
    ([bw, bh, beschr]) => {
      const c = document.createElement('canvas')
      c.width = bw
      c.height = bh
      const g = c.getContext('2d')
      g.fillStyle = '#f8fafc'
      g.fillRect(0, 0, bw, bh)
      g.strokeStyle = '#334155'
      g.lineWidth = 6
      g.strokeRect(30, 30, bw - 60, bh - 60)
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(bw * 0.55, 30)
      g.lineTo(bw * 0.55, bh * 0.62)
      g.moveTo(30, bh * 0.62)
      g.lineTo(bw - 30, bh * 0.62)
      g.stroke()
      g.fillStyle = '#334155'
      g.font = '24px sans-serif'
      g.fillText(beschr[0], 60, 80)
      g.fillText(beschr[1], bw * 0.55 + 30, 80)
      g.fillText(beschr[2], 60, bh * 0.62 + 50)
      return c.toDataURL('image/png').split(',')[1]
    },
    [breite, hoehe, [zw('Studio', 'Studio'), zw('Regie', 'Control room'), zw('Halle', 'Hall')]],
  )
  writeFileSync(pfad, Buffer.from(b64, 'base64'))
  return `data:image/png;base64,${b64}`
}
const R_GRUNDRISS = () => w.locator('[data-testid="grundriss-panel"]')
const grundrissKnoten = () => w.locator('.react-flow__node-grundriss').first()
/** Bildpunkt (in Bildpixeln) auf den Bildschirm umrechnen. */
async function planPunkt(px, py, breite = 900) {
  const b = await grundrissKnoten().boundingBox()
  const s = b.width / breite
  return { x: b.x + px * s, y: b.y + py * s }
}
/**
 * Datei über den (echten) Dateiwahl-Knopf setzen. Ein dauerhafter Zuhörer fängt
 * den Dateiwähler ab, damit nie ein Betriebssystem-Dialog aufgeht; kam kein
 * Ereignis, geht die Datei direkt ins versteckte Feld.
 */
let dateiFuerDialog = null
w.on('filechooser', async (fc) => {
  try {
    if (dateiFuerDialog) await fc.setFiles(dateiFuerDialog)
  } catch {}
  dateiFuerDialog = null
})
async function dateiWaehlen(knopfLoc, feldLoc, pfad) {
  dateiFuerDialog = pfad
  await knopfLoc.first().click()
  await pause(1200)
  if (dateiFuerDialog) {
    dateiFuerDialog = null
    await feldLoc.first().setInputFiles(pfad)
  }
  await pause(900)
}

abschnitt('hallenplan', async () => {
  const f = neueFolge('hallenplan')
  const png = join(TMP, 'hallenplan.png')
  const dataUrl = await planBild(png)
  const feld = () => R_GRUNDRISS().locator('input[type="file"]')
  const ladeKnopf = () => R_GRUNDRISS().getByRole('button', { name: /Load floor plan image|Replace image|Hallenplan-Bild laden|Bild ersetzen/i }).first()
  const panelUndFlaeche = ausschnitt(flaecheOben, R_PANEL)
  await f.schritt('knopf', async () => merkeTitel('hallenplan-knopf', leiste().getByRole('button', { name: M('toolbar.floorplan.label') })), { ziel: R_LEISTE })
  await f.schritt(
    'panel-leer',
    async () => {
      await klickMitte(leiste().getByRole('button', { name: M('toolbar.floorplan.label') }))
      extra.texte['hallenplan-leer'] = await R_GRUNDRISS().innerText()
    },
    { ziel: panelUndFlaeche },
  )
  await f.schritt(
    'bild-geladen',
    async () => {
      await dateiWaehlen(ladeKnopf(), feld().first(), png)
    },
    { ziel: panelUndFlaeche },
  )
  await f.schritt(
    'deckkraft',
    async () => {
      const r = R_GRUNDRISS().locator('input[type="range"]').first()
      await r.evaluate((el) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        set.call(el, '0.25')
        el.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await pause(500)
    },
    { ziel: panelUndFlaeche },
  )
  await f.schritt(
    'deckkraft-fest',
    async () => {
      const r = R_GRUNDRISS().locator('input[type="range"]').first()
      await r.evaluate((el) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        set.call(el, '0.7')
        el.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await pause(500)
    },
    { ziel: panelUndFlaeche },
  )
  await f.schritt(
    'plan-gewaehlt',
    async () => {
      const b = await grundrissKnoten().boundingBox()
      await w.mouse.click(b.x + 20, b.y + b.height - 20)
      await pause(500)
    },
    { ziel: panelUndFlaeche },
  )
  // Zwei-Punkt-Kalibrierung
  await f.schritt(
    'zwei-punkte-start',
    async () => {
      await klickMitte(R_GRUNDRISS().getByRole('button', { name: M('floorplan.scale.twoPointButton') }))
      await pause(400)
    },
    { ziel: panelUndFlaeche },
  )
  await f.schritt(
    'zwei-punkte-erster',
    async () => {
      const p = await planPunkt(30, 320)
      await w.mouse.click(p.x, p.y)
      await pause(400)
    },
    { ziel: panelUndFlaeche },
  )
  await f.schritt(
    'zwei-punkte-fertig',
    async () => {
      const p = await planPunkt(870, 320)
      await w.mouse.click(p.x, p.y)
      await pause(700)
    },
    { ziel: panelUndFlaeche },
  )
  // Vier Ecken — zuerst in falscher Reihenfolge
  await f.schritt(
    'vier-ecken-start',
    async () => {
      const zahlen = R_GRUNDRISS().locator('input[type="number"]')
      await zahlen.nth(1).fill('24')
      await zahlen.nth(2).fill('16')
      await klickMitte(R_GRUNDRISS().getByRole('button', { name: M('floorplan.scale.rectButton') }))
      await pause(300)
    },
    { ziel: panelUndFlaeche },
  )
  await f.schritt(
    'vier-ecken-falsch',
    async () => {
      for (const [x, y] of [[30, 30], [870, 570], [870, 30], [30, 570]]) {
        const p = await planPunkt(x, y)
        await w.mouse.click(p.x, p.y)
        await pause(250)
      }
      await pause(500)
    },
    { ziel: panelUndFlaeche },
  )
  await f.schritt(
    'vier-ecken-fertig',
    async () => {
      for (const [x, y] of [[30, 30], [870, 30], [870, 570], [30, 570]]) {
        const p = await planPunkt(x, y)
        await w.mouse.click(p.x, p.y)
        await pause(250)
      }
      await pause(700)
    },
    { ziel: panelUndFlaeche },
  )
  await f.schritt(
    'export-gesperrt',
    async () => {
      const b = R_GRUNDRISS().getByRole('button', { name: M('floorplan.exportVenue') }).first()
      extra.tooltips['hallenplan-export-vier-ecken'] = (await b.getAttribute('title')) + ' | enabled=' + (await b.isEnabled())
    },
    { ziel: R_PANEL },
  )
  await f.schritt(
    'laengen-neu',
    async () => {
      await klickMitte(R_GRUNDRISS().getByRole('button', { name: M('floorplan.recalc') }))
      await pause(600)
    },
    { ziel: R_PANEL },
  )
  await f.schritt(
    'sperre',
    async () => {
      await R_GRUNDRISS().getByLabel(M('floorplan.lock')).check()
      await pause(400)
    },
    { ziel: R_PANEL },
  )
  await f.schritt(
    'sperre-aus',
    async () => {
      await R_GRUNDRISS().getByLabel(M('floorplan.lock')).uncheck()
      await pause(300)
    },
    { ziel: R_PANEL },
  )
  await f.schritt(
    'ersetzen-frage',
    async () => {
      await dateiWaehlen(ladeKnopf(), feld().first(), png)
      extra.texte['hallenplan-ersetzen'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'ersetzt',
    async () => {
      await bestaetige(M('floorplan.replace'))
      await pause(600)
    },
    { ziel: panelUndFlaeche },
  )
  await f.schritt(
    'kein-bild',
    async () => {
      const txt = join(TMP, 'notiz.txt')
      writeFileSync(txt, 'kein Bild')
      await feld().first().setInputFiles(txt)
      await pause(800)
    },
    { ziel: R_PANEL },
  )
  await f.schritt(
    'pdf-nicht-moeglich',
    async () => {
      const pdf = join(TMP, 'plan.pdf')
      writeFileSync(pdf, '%PDF-1.4\n%%EOF\n')
      await feld().first().setInputFiles(pdf)
      await pause(800)
    },
    { ziel: R_PANEL },
  )
  // Venue-Austausch
  const venue = (extraDef = {}) => ({
    kind: 'venue-exchange',
    formatVersion: 1,
    app: 'multicam-planner',
    appVersion: '1.0.0',
    exportedAt: '2026-09-29T10:00:00.000Z',
    venue: {
      name: zw('Beispielhalle', 'Sample hall'),
      persons: [],
      walls: [],
      stageObjects: [],
      floorPlan: {
        src: dataUrl,
        name: 'hallenplan.png',
        naturalWidth: 900,
        naturalHeight: 600,
        widthMeters: 30,
        heightMeters: 20,
        offsetX: 0,
        offsetY: 0,
        opacity: 0.6,
        ...extraDef,
      },
    },
  })
  const venueDatei = join(TMP, 'halle.venue.json')
  writeFileSync(venueDatei, JSON.stringify(venue(), null, 2))
  const venueKnopf = () => R_GRUNDRISS().getByRole('button', { name: M('floorplan.importVenue') }).first()
  const venueFeld = () => R_GRUNDRISS().locator('input[type="file"]').nth(1)
  await f.schritt(
    'venue-import',
    async () => {
      await dateiWaehlen(venueKnopf(), venueFeld(), venueDatei)
      const b = await bestaetigungFallsDa()
      void b
      await pause(600)
    },
    { ziel: panelUndFlaeche },
  )
  await f.schritt(
    'venue-export-moeglich',
    async () => {
      const b = R_GRUNDRISS().getByRole('button', { name: M('floorplan.exportVenue') }).first()
      extra.tooltips['hallenplan-export-zwei-punkte'] = 'enabled=' + (await b.isEnabled())
    },
    { ziel: R_PANEL },
  )
  await f.schritt(
    'venue-ungueltig',
    async () => {
      const kaputt = join(TMP, 'kaputt.json')
      writeFileSync(kaputt, JSON.stringify({ hallo: 'welt' }))
      await venueFeld().setInputFiles(kaputt)
      await pause(700)
    },
    { ziel: R_PANEL },
  )
  await f.schritt(
    'venue-ohne-plan',
    async () => {
      const ohne = join(TMP, 'ohne.venue.json')
      const v = venue()
      delete v.venue.floorPlan
      writeFileSync(ohne, JSON.stringify(v))
      await venueFeld().setInputFiles(ohne)
      await pause(700)
    },
    { ziel: R_PANEL },
  )
  await f.schritt(
    'venue-ohne-masse',
    async () => {
      const ohne = join(TMP, 'ohne-masse.venue.json')
      writeFileSync(ohne, JSON.stringify(venue({ widthMeters: 0 })))
      await venueFeld().setInputFiles(ohne)
      await pause(700)
    },
    { ziel: R_PANEL },
  )
  await f.schritt(
    'plan-entfernen',
    async () => {
      await klickMitte(R_GRUNDRISS().getByRole('button', { name: M('floorplan.remove') }))
      await pause(600)
    },
    { ziel: panelUndFlaeche },
  )
  await f.schritt(
    'panel-zu',
    async () => {
      await klickMitte(R_GRUNDRISS().getByRole('button', { name: M('common.close') }))
    },
    { ziel: R_FLAECHE },
  )
})
async function bestaetigungFallsDa() {
  const d = w.locator('[role="dialog"]')
  if (await d.count()) {
    const b = d.last().getByRole('button', { name: M('floorplan.replace') })
    if (await b.count()) {
      await b.first().click()
      return true
    }
  }
  return false
}

// ═══════════════════════════════════════════════════════════════════════════
// SYMBOLE — Planzeichen: Kategorien, Platzieren, Import, KI, Liste
// ═══════════════════════════════════════════════════════════════════════════
const R_SYMBOLE = () => w.locator('div.fixed.right-0.top-0').filter({ hasText: M('symbols.import.button') }).first()
const symbolKnopf = () => leiste().getByRole('button', { name: M('toolbar.symbols.label') }).first()
async function panelScroll(loc, ganzUnten = true) {
  await loc.locator('.overflow-y-auto').first().evaluate((el, unten) => { el.scrollTop = unten ? el.scrollHeight : 0 }, ganzUnten)
  await pause(300)
}

abschnitt('symbole', async () => {
  const f = neueFolge('symbole')
  const panelUndFlaeche = ausschnitt(flaecheOben, R_PANEL)
  const kat = (key) => R_SYMBOLE().getByRole('button', { name: M(key) }).first()
  await f.schritt('knopf', async () => merkeTitel('symbole-knopf', symbolKnopf()), { ziel: R_LEISTE })
  await f.schritt(
    'panel-offen',
    async () => {
      await klickMitte(symbolKnopf())
      extra.texte['symbole-panel'] = await R_SYMBOLE().innerText()
    },
    { ziel: panelUndFlaeche },
  )
  for (const [name, key] of [
    ['elektro', 'symbols.cat.electrical'],
    ['ema', 'symbols.cat.intrusion'],
    ['bma', 'symbols.cat.fire'],
    ['saa', 'symbols.cat.voice'],
    ['it', 'symbols.cat.it'],
    ['automation', 'symbols.cat.automation'],
    ['av', 'symbols.cat.av'],
    ['eigene', 'symbols.cat.custom'],
  ]) {
    await f.schritt(
      `kategorie-${name}`,
      async () => {
        await klickMitte(kat(key))
        extra.texte[`symbole-${name}`] = (await R_SYMBOLE().locator('button[title]').allInnerTexts()).join(' | ')
      },
      { ziel: R_PANEL },
    )
  }
  await f.schritt(
    'suche',
    async () => {
      await R_SYMBOLE().getByPlaceholder(T('symbols.search')).fill(zw('Melder', 'detector'))
      await pause(500)
    },
    { ziel: R_PANEL },
  )
  await f.schritt(
    'platziert',
    async () => {
      await R_SYMBOLE().getByPlaceholder(T('symbols.search')).fill('')
      await klickMitte(kat('symbols.cat.electrical'))
      await klickMitte(R_SYMBOLE().getByTitle(T('symbols.place')).first())
      await pause(600)
    },
    { ziel: panelUndFlaeche },
  )
  await f.schritt(
    'beschriftung',
    async () => {
      const sec = R_SYMBOLE().locator('section').first()
      await sec.locator('input[type="text"], input:not([type])').first().fill(zw('Steckdose Regie', 'Control room socket'))
      await pause(500)
    },
    { ziel: panelUndFlaeche },
  )
  await f.schritt(
    'groesse',
    async () => {
      const sec = R_SYMBOLE().locator('section').first()
      await sec.locator('input[type="number"]').first().fill('96')
      await pause(500)
    },
    { ziel: panelUndFlaeche },
  )
  await f.schritt(
    'drehung',
    async () => {
      const sec = R_SYMBOLE().locator('section').first()
      await sec.locator('select').first().selectOption('90')
      extra.listen['symbole-drehung'] = await sec.locator('select option').allInnerTexts()
      await pause(500)
    },
    { ziel: panelUndFlaeche },
  )
  await f.schritt(
    'gesperrt',
    async () => {
      const sec = R_SYMBOLE().locator('section').first()
      await sec.getByLabel(M('symbols.sel.lock')).check()
      await pause(400)
    },
    { ziel: panelUndFlaeche },
  )
  await f.schritt(
    'weitere',
    async () => {
      // zweites und drittes Zeichen an anderer Stelle
      const sec = R_SYMBOLE().locator('section').first()
      await sec.getByLabel(M('symbols.sel.lock')).uncheck()
      const p = await mitte(w.locator('.react-flow__node-symbol').first())
      await ziehe(p, { x: p.x - 320, y: p.y - 150 })
      await klickMitte(kat('symbols.cat.it'))
      await klickMitte(R_SYMBOLE().getByTitle(T('symbols.place')).nth(1))
      await pause(400)
    },
    { ziel: panelUndFlaeche },
  )
  await f.schritt(
    'loeschen',
    async () => {
      const sec = R_SYMBOLE().locator('section').first()
      await klickMitte(sec.getByRole('button', { name: M('symbols.sel.delete') }))
      await pause(400)
    },
    { ziel: panelUndFlaeche },
  )
  // Import
  const svgDatei = join(TMP, 'not-aus.svg')
  writeFileSync(
    svgDatei,
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#111" stroke-width="2"><circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="6" fill="#c00"/></svg>',
  )
  const pngDatei = join(TMP, 'logo.png')
  const b64 = await w.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const g = c.getContext('2d')
    g.fillStyle = '#0284c7'
    g.fillRect(4, 4, 56, 56)
    g.fillStyle = '#fff'
    g.font = 'bold 28px sans-serif'
    g.fillText('LZ', 12, 44)
    return c.toDataURL('image/png').split(',')[1]
  })
  writeFileSync(pngDatei, Buffer.from(b64, 'base64'))
  const importFeld = () => R_SYMBOLE().locator('input[type="file"]').first()
  await f.schritt(
    'import-knopf',
    async () => {
      await panelScroll(R_SYMBOLE(), true)
    },
    { ziel: R_PANEL },
  )
  await f.schritt(
    'import-svg',
    async () => {
      await dateiWaehlen(R_SYMBOLE().getByRole('button', { name: M('symbols.import.button') }), importFeld(), svgDatei)
      await panelScroll(R_SYMBOLE(), false)
    },
    { ziel: R_PANEL },
  )
  await f.schritt(
    'import-png',
    async () => {
      await importFeld().setInputFiles(pngDatei)
      await pause(700)
    },
    { ziel: R_PANEL },
  )
  await f.schritt(
    'import-zu-gross',
    async () => {
      const gross = join(TMP, 'gross.png')
      writeFileSync(gross, Buffer.alloc(600 * 1024, 1))
      await importFeld().setInputFiles(gross)
      await pause(700)
      await panelScroll(R_SYMBOLE(), true)
    },
    { ziel: R_PANEL },
  )
  await f.schritt(
    'import-kaputt',
    async () => {
      const kaputt = join(TMP, 'kaputt.svg')
      writeFileSync(kaputt, 'das ist kein svg')
      await importFeld().setInputFiles(kaputt)
      await pause(700)
    },
    { ziel: R_PANEL },
  )
  await f.schritt(
    'import-entfernen',
    async () => {
      await panelScroll(R_SYMBOLE(), false)
      await klickMitte(R_SYMBOLE().getByTitle(T('symbols.removeDef')).first())
      await pause(400)
    },
    { ziel: R_PANEL },
  )
  // KI-Erzeugung (Beispielantwort, kein Netzzugriff)
  await f.schritt(
    'ki-ohne-schluessel',
    async () => {
      await panelScroll(R_SYMBOLE(), true)
      extra.texte['symbole-ki-sichtbar'] = String(await R_SYMBOLE().getByRole('button', { name: M('symbols.ai.button') }).count())
    },
    { ziel: R_PANEL },
  )
  await w.evaluate(() => {
    localStorage.setItem('cable-planner:ai-provider', 'openai')
    localStorage.setItem('cable-planner:openai-api-key', 'demo-schluessel')
    const orig = window.fetch.bind(window)
    window.fetch = async (u, o) => {
      if (String(u).includes('api.openai.com')) {
        const svg =
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#111" stroke-width="2"><circle cx="24" cy="24" r="16"/><path d="M16 16 32 32M32 16 16 32"/></svg>'
        return new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify({ name: 'Emergency stop button', svg }) } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return orig(u, o)
    }
  })
  await klickMitte(symbolKnopf()) // zu
  await klickMitte(symbolKnopf()) // auf, damit der Schlüssel gelesen wird
  await f.schritt(
    'ki-bereich',
    async () => {
      await panelScroll(R_SYMBOLE(), true)
    },
    { ziel: R_PANEL },
  )
  await f.schritt(
    'ki-beschreibung',
    async () => {
      await R_SYMBOLE().getByPlaceholder(T('symbols.ai.placeholder')).fill(zw('Not-Aus-Taster', 'emergency stop button'))
      await pause(300)
    },
    { ziel: R_PANEL },
  )
  await f.schritt(
    'ki-ergebnis',
    async () => {
      await klickMitte(R_SYMBOLE().getByRole('button', { name: M('symbols.ai.button') }))
      await pause(1200)
      await panelScroll(R_SYMBOLE(), true)
    },
    { ziel: R_PANEL },
  )
  await f.schritt(
    'liste-csv',
    async () => {
      await panelScroll(R_SYMBOLE(), true)
      extra.texte['symbole-csv-knopf'] = await R_SYMBOLE().getByRole('button', { name: /CSV/ }).first().innerText()
    },
    { ziel: R_PANEL },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// SUCHE — Gerät finden, Leiste bewegen, einklappen, schließen
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('suche', async () => {
  const f = neueFolge('suche')
  const feld = () => w.getByPlaceholder(T('canvas.search.placeholder')).first()
  await f.schritt('pille', null, { ziel: R_FLAECHE })
  await f.schritt(
    'strg-f',
    async () => {
      await abwaehlen()
      await w.keyboard.press('Control+f')
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'treffer',
    async () => {
      await feld().fill('cam')
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'treffer-grund',
    async () => {
      await feld().fill('sdi')
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'kein-treffer',
    async () => {
      await feld().fill('zzz-gibt-es-nicht')
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'springen',
    async () => {
      await feld().fill('mixer')
      await pause(400)
      await feld().press('Enter')
      await pause(1200)
    },
    { ziel: R_FLAECHE_INSPECTOR },
  )
  await f.schritt(
    'einklappen',
    async () => {
      await w.keyboard.press('Control+f')
      await pause(400)
      await klickMitte(w.getByRole('button', { name: M('canvas.search.collapse') }))
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'verschieben',
    async () => {
      const griff = w.getByRole('button', { name: M('canvas.search.move') }).first()
      const p = await mitte(griff)
      await ziehe(p, { x: p.x + 300, y: p.y + 500 })
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'schliessen',
    async () => {
      await klickMitte(w.getByRole('button', { name: M('canvas.search.close') }))
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'ansicht-menue-suche',
    async () => {
      await a.menue('app.menu.view', 'app.menu.view.canvasSearch')
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  // Felder, die die Suche außer dem Namen durchsucht (Beispieldaten)
  const netz = projektGeruest('Netz', [
    GE('sw', 'Switch A', 'Networking', 80, 140, [PT('sw_i', 'Port 1', 'RJ45', 'in')], [], {
      ipAddress: '10.0.1.20', macAddress: 'aa:bb:cc:00:00:01', vlanId: 30, serialNumber: 'SN-4711', assetTag: 'INV-0815',
      shortName: 'SWA', notes: zw('hängt im Rack 2', 'sits in rack 2'),
    }),
    GE('pc', zw('Regie-PC', 'Control PC'), 'IT/Server', 480, 140, [PT('pc_i', 'LAN', 'RJ45', 'in')], [], {
      ipAddress: '10.0.1.30', macAddress: 'aa:bb:cc:00:00:04', subtitle: zw('Streaming', 'Streaming'),
    }),
  ], [])
  await f.schritt(
    'felder-ip',
    async () => {
      await projektLaden(netz, 'netz.json')
      await w.keyboard.press('Control+f')
      await pause(400)
      await feld().fill('10.0.1')
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
  for (const [name, text] of [
    ['felder-seriennummer', 'SN-4711'],
    ['felder-mac', 'cc:00:00:04'],
    ['felder-notiz', zw('rack 2', 'rack 2')],
    ['felder-vlan', '30'],
  ]) {
    await f.schritt(
      name,
      async () => {
        await feld().fill(text)
        await pause(600)
      },
      { ziel: R_FLAECHE },
    )
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ZOOM — Regler, Minikarte, Mausrad, Statuszeile
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('zoom', async () => {
  const f = neueFolge('zoom')
  const regler = () => w.locator('.react-flow__controls')
  const minikarte = () => w.locator('.react-flow__minimap')
  await f.schritt('regler-minikarte', null, { ziel: R_FLAECHE })
  await f.schritt(
    'regler-aufschriften',
    async () => {
      extra.tooltips['zoom-regler'] = (await regler().locator('button').evaluateAll((els) => els.map((e) => e.getAttribute('title') || e.getAttribute('aria-label') || ''))).join(' | ')
    },
    { ziel: () => regler() },
  )
  await f.schritt('vergroessern', async () => klickMitte(regler().locator('button').nth(0)), { ziel: R_FLAECHE })
  await f.schritt('vergroessern-2', async () => klickMitte(regler().locator('button').nth(0)), { ziel: R_FLAECHE })
  await f.schritt('verkleinern', async () => klickMitte(regler().locator('button').nth(1)), { ziel: R_FLAECHE })
  await f.schritt('einpassen', async () => klickMitte(regler().locator('button').nth(2)), { ziel: R_FLAECHE })
  await f.schritt(
    'sperren-knopf',
    async () => {
      await klickMitte(regler().locator('button').nth(3))
      const p = await mitte(w.locator('.react-flow__pane'))
      await w.mouse.move(p.x, p.y)
      await w.mouse.wheel(0, -500)
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt('sperren-aus', async () => klickMitte(regler().locator('button').nth(3)), { ziel: R_FLAECHE })
  await f.schritt(
    'mausrad',
    async () => {
      await w.mouse.move(900, 500)
      await w.keyboard.down('Control')
      await w.mouse.wheel(0, -400)
      await w.keyboard.up('Control')
      await pause(600)
    },
    { ziel: ausschnitt(flaecheOben, R_STATUS) },
  )
  await f.schritt(
    'minikarte-ziehen',
    async () => {
      const b = await minikarte().boundingBox()
      await ziehe({ x: b.x + b.width / 2, y: b.y + b.height / 2 }, { x: b.x + 20, y: b.y + 20 })
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'ansicht-zoom-menue',
    async () => {
      await a.menue('app.menu.view')
    },
    { ziel: ausschnitt(R_MENUE, { x: 470, y: 0, width: 80, height: 40 }) },
  )
  await f.schritt(
    'zoom-100',
    async () => {
      await a.klick('app.menu.view.zoom100')
      await pause(600)
    },
    { ziel: ausschnitt(flaecheOben, R_STATUS) },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// KABEL — Kabel ziehen, Klick-Verbindung, offenes Ende, Kabel am Körper
// ═══════════════════════════════════════════════════════════════════════════
const griff = async (name, art, i = 0) => mitte(knoten(name).locator(`.react-flow__handle.${art}`).nth(i))
const portZeile = (name, muster) => knoten(name).getByRole('button', { name: muster }).first()

async function kabelHalten(vonName, vonI, nachPunkt) {
  const von = await griff(vonName, 'source', vonI)
  await w.mouse.move(von.x, von.y)
  await w.mouse.down()
  await w.mouse.move((von.x + nachPunkt.x) / 2, (von.y + nachPunkt.y) / 2, { steps: 10 })
  await w.mouse.move(nachPunkt.x, nachPunkt.y, { steps: 10 })
  await pause(300)
}
/** Im Dialog „Neues Kabel“ Namen und Länge setzen, Typ wählen, anlegen. */
async function kabelAnlegen({ name, laenge = 5, typIndex = 1 } = {}) {
  const d = R_DIALOG()
  await d.locator('select').first().selectOption({ index: typIndex }).catch(() => {})
  if (name) await d.locator('input').filter({ hasNot: d.locator('[type=number]') }).first().fill(name).catch(() => {})
  await d.locator('input[type="number"]').first().fill(String(laenge)).catch(() => {})
  await pause(300)
  await d.getByRole('button', { name: M('cable.dialog.create') }).first().click({ timeout: 6000 })
  await pause(800)
}

abschnitt('kabel', async () => {
  const f = neueFolge('kabel')
  await f.schritt(
    'ziehen',
    async () => {
      const ziel = await griff('Vision mixer', 'target', 2)
      await kabelHalten('Camera 2', 0, ziel)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'dialog',
    async () => {
      await w.mouse.up()
      await pause(700)
      extra.texte['kabel-dialog'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'dialog-eigenes-kabel',
    async () => {
      const d = R_DIALOG()
      const sel = d.locator('select').first()
      extra.listen['kabel-dialog-typen'] = await sel.locator('option').allInnerTexts()
      await sel.selectOption({ index: 0 })
      await pause(500)
      extra.texte['kabel-dialog-eigenes'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'kabel-angelegt',
    async () => {
      await kabelAnlegen({ name: 'CAM 2 → In 3', laenge: 12 })
    },
    { ziel: R_FLAECHE },
  )
  // Besetzter Zielanschluss
  await f.schritt(
    'besetzt',
    async () => {
      const ziel = await griff('Vision mixer', 'target', 1)
      await kabelHalten('Camera 1', 0, ziel)
      await w.mouse.up()
      await pause(800)
      extra.texte['kabel-besetzt'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'besetzt-abbruch',
    async () => {
      await R_DIALOG().getByRole('button', { name: ABBRUCH() }).first().click()
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  // Offenes Ende: ins Leere loslassen
  await f.schritt(
    'offenes-ende',
    async () => {
      await kabelHalten('Camera 1', 0, { x: 700, y: 800 })
      await w.mouse.up()
      await pause(800)
    },
    { ziel: R_FENSTER },
  )
  await f.schritt(
    'offenes-ende-abbruch',
    async () => {
      const d = w.locator('[role="dialog"]')
      if (await d.count()) await d.last().getByRole('button', { name: ABBRUCH() }).first().click().catch(() => {})
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  // Auf den Körper eines Geräts
  await f.schritt(
    'auf-den-koerper',
    async () => {
      const b = await knoten('Control room monitor').boundingBox()
      await kabelHalten('Camera 2', 0, { x: b.x + b.width / 2, y: b.y + b.height / 2 })
      await w.mouse.up()
      await pause(800)
    },
    { ziel: R_FENSTER },
  )
  await f.schritt(
    'auf-den-koerper-fertig',
    async () => {
      await kabelAnlegen({ name: 'CAM 2 → Monitor', laenge: 20 })
    },
    { ziel: R_FLAECHE },
  )
  // Klick-Verbindung mit Knicken
  await f.schritt(
    'klick-start',
    async () => {
      await portZeile('Camera 1', /SDI Out|SDI-Aus/).click({ timeout: 6000 })
      await w.mouse.move(700, 820, { steps: 6 })
      await pause(400)
    },
    { ziel: R_FENSTER },
  )
  await f.schritt(
    'klick-knick',
    async () => {
      await w.mouse.click(640, 830)
      await w.mouse.click(700, 830)
      await w.mouse.move(760, 700, { steps: 6 })
      await pause(400)
    },
    { ziel: R_FENSTER },
  )
  await f.schritt(
    'klick-knick-zurueck',
    async () => {
      await klickMitte(w.getByRole('button', { name: M('pendingCable.undoBend') }))
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'klick-abbrechen',
    async () => {
      await klickMitte(w.getByRole('button', { name: M('pendingCable.cancel') }))
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'klick-fertig',
    async () => {
      await portZeile('Camera 1', /SDI Out|SDI-Aus/).click({ timeout: 6000 })
      await w.mouse.click(640, 830)
      await w.mouse.click(700, 830)
      await portZeile('Vision mixer', /In 4/).click({ timeout: 6000 })
      await pause(700)
      extra.texte['kabel-klick-dialog'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'klick-angelegt',
    async () => {
      await kabelAnlegen({ name: 'CAM 1 → In 4', laenge: 15 })
    },
    { ziel: R_FLAECHE },
  )
  // Routing-Vorgabe wirkt auf neue Kabel
  await f.schritt(
    'routing-direkt-neues-kabel',
    async () => {
      await klickMitte(leistenKnopf('toolbar.defaults.button'))
      await klickMitte(R_MENUE().getByRole('button', { name: M('toolbar.defaults.routing.straight') }).first())
      await leerklick()
      const b = await knoten('Multiviewer').boundingBox()
      await kabelHalten('Camera 2', 0, { x: b.x + b.width / 2, y: b.y + b.height / 2 })
      await w.mouse.up()
      await pause(700)
      await kabelAnlegen({ name: 'direkt', laenge: 8 })
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'routing-kurve-neues-kabel',
    async () => {
      await klickMitte(leistenKnopf('toolbar.defaults.button'))
      await klickMitte(R_MENUE().getByRole('button', { name: M('toolbar.defaults.routing.curved') }).first())
      await leerklick()
      const b = await knoten('Multiviewer').boundingBox()
      await kabelHalten('Camera 1', 0, { x: b.x + b.width / 2 + 40, y: b.y + b.height / 2 })
      await w.mouse.up()
      await pause(700)
      await kabelAnlegen({ name: 'Kurve', laenge: 9 })
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'pfeil-vorgabe',
    async () => {
      await klickMitte(leistenKnopf('toolbar.defaults.button'))
      await klickMitte(R_MENUE().getByRole('button', { name: M('toolbar.defaults.routing.ortho') }).first())
      await R_MENUE().getByLabel(M('toolbar.defaults.arrowEnd')).check()
      await leerklick()
      const b = await knoten('Control room monitor').boundingBox()
      await kabelHalten('Camera 2', 0, { x: b.x + b.width / 2 + 30, y: b.y + b.height / 2 + 10 })
      await w.mouse.up()
      await pause(700)
      await kabelAnlegen({ name: 'mit Pfeil', laenge: 6 })
    },
    { ziel: R_FLAECHE },
  )
  // Ein Kabelende umstecken
  await f.schritt(
    'umstecken',
    async () => {
      const p = await kabelPunkt(4, 0.5)
      await w.mouse.click(p.x, p.y)
      await pause(400)
    },
    { ziel: R_FLAECHE },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// KABELEDITOR — Kabel wählen, Knickpunkte, Kontextmenü, Doppelklick, Löschen
// ═══════════════════════════════════════════════════════════════════════════
const kabelMenue = () => w.locator('div.fixed').filter({ hasText: M('canvas.cableMenu.addWaypoint') }).last()
async function kabelRechtsklick(i, anteil = 0.35) {
  const p = await kabelPunkt(i, anteil)
  await w.mouse.click(p.x, p.y, { button: 'right' })
  await pause(500)
  return p
}
const kabelMenueBild = (getP) => () => ({
  count: async () => 1,
  first: () => ({ screenshot: async (o) => w.screenshot({ ...o, clip: umPunkt(getP().x, getP().y, 260, 400) }) }),
})

abschnitt('kabeleditor', async () => {
  const f = neueFolge('kabeleditor')
  let pos = { x: 0, y: 0 }
  await f.schritt(
    'gewaehlt',
    async () => {
      const p = await kabelPunkt(0, 0.35)
      await w.mouse.click(p.x, p.y)
      await pause(600)
    },
    { ziel: R_FLAECHE_INSPECTOR },
  )
  await f.schritt(
    'segment-ziehen',
    async () => {
      const linien = await w.evaluate(() => {
        const out = []
        for (const g of document.querySelectorAll('.cp-kabelgriff')) {
          for (const l of g.querySelectorAll('line[stroke="transparent"]')) {
            const r = l.getBoundingClientRect()
            out.push({ x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height })
          }
        }
        return out
      })
      const senkrecht = linien.filter((l) => l.h > l.w && l.h > 20)
      extra.texte['segmente'] = JSON.stringify(linien)
      const s = senkrecht[0] ?? linien[0]
      if (!s) throw new Error('keine Greifzone gefunden')
      await ziehe({ x: s.x, y: s.y }, { x: s.x + 70, y: s.y }, { halten: 200 })
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'ecke-ziehen',
    async () => {
      const ecken = w.locator('.cp-kabelgriff circle[fill="#38bdf8"]')
      const n = await ecken.count()
      extra.texte['ecken'] = String(n)
      const p = await mitte(ecken.first())
      await ziehe(p, { x: p.x - 40, y: p.y + 60 })
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'ecke-alt-klick',
    async () => {
      const ecken = w.locator('.cp-kabelgriff circle[fill="#38bdf8"]')
      await ecken.first().click({ modifiers: ['Alt'], force: true })
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'menue',
    async () => {
      pos = await kabelRechtsklick(0, 0.3)
      extra.texte['kabel-menue'] = await kabelMenue().innerText().catch(() => '')
    },
    { ziel: kabelMenueBild(() => pos) },
  )
  await f.schritt(
    'wegpunkt-hier',
    async () => {
      await w.getByText(M('canvas.cableMenu.addWaypoint')).first().click()
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'routing-untermenue',
    async () => {
      pos = await kabelRechtsklick(0, 0.3)
      await w.getByText(M('canvas.cableMenu.routing')).first().click()
      await pause(400)
    },
    { ziel: kabelMenueBild(() => pos) },
  )
  await f.schritt(
    'routing-kurve',
    async () => {
      await w.getByText(M('canvas.cableMenu.routingCurved')).first().click()
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'routing-direkt',
    async () => {
      pos = await kabelRechtsklick(0, 0.3)
      await w.getByText(M('canvas.cableMenu.routing')).first().click()
      await w.getByText(M('canvas.cableMenu.routingStraight')).first().click()
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'routing-orthogonal',
    async () => {
      pos = await kabelRechtsklick(0, 0.3)
      await w.getByText(M('canvas.cableMenu.routing')).first().click()
      await w.getByText(M('canvas.cableMenu.routingOrth')).first().click()
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'neu-routen',
    async () => {
      pos = await kabelRechtsklick(0, 0.3)
      await w.getByText(M('canvas.cableMenu.reroute')).first().click()
      await pause(700)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'alle-wegpunkte-loeschen',
    async () => {
      pos = await kabelRechtsklick(0, 0.3)
      await w.getByText(M('canvas.cableMenu.clearWaypoints')).first().click()
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'pfeil-ende-aus',
    async () => {
      pos = await kabelRechtsklick(3, 0.2)
      await w.getByText(M('canvas.cableMenu.arrowEnd')).first().click()
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'pfeil-anfang-an',
    async () => {
      pos = await kabelRechtsklick(3, 0.2)
      await w.getByText(M('canvas.cableMenu.arrowStart')).first().click()
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'beidseitig',
    async () => {
      pos = await kabelRechtsklick(3, 0.2)
      await w.getByText(M('canvas.cableMenu.bidi')).first().click()
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'bruecken-menue',
    async () => {
      pos = await kabelRechtsklick(3, 0.2)
    },
    { ziel: kabelMenueBild(() => pos) },
  )
  await f.schritt(
    'bruecken-kabel',
    async () => {
      await w.getByText(M('canvas.cableMenu.bumps')).first().click()
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'bezeichnung',
    async () => {
      pos = await kabelRechtsklick(0, 0.3)
      await w.getByText(M('canvas.cableMenu.rename')).first().click()
      await pause(500)
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'bezeichnung-neu',
    async () => {
      const d = R_DIALOG()
      await d.getByRole('textbox').fill(zw('CAM 1 zum Mischer', 'CAM 1 to mixer'))
      await d.getByRole('button', { name: OK() }).click()
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'doppelklick',
    async () => {
      const p = await kabelPunkt(1, 0.3)
      await w.mouse.dblclick(p.x, p.y)
      await pause(800)
      extra.texte['kabel-bearbeiten'] = await a.dialogText()
    },
    { ziel: R_FENSTER },
  )
  await a.zu()
  await f.schritt(
    'loeschen-frage',
    async () => {
      pos = await kabelRechtsklick(2, 0.4)
      await w.getByText(M('canvas.cableMenu.delete')).first().click()
      await pause(500)
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'geloescht',
    async () => {
      await bestaetige(M('common.delete'))
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'label-kreuz',
    async () => {
      const p = await kabelPunkt(0, 0.5)
      await w.mouse.click(p.x, p.y)
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'rueckgaengig',
    async () => {
      await rueckgaengig()
    },
    { ziel: R_FLAECHE },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// SEITENVERBINDER — Off-Page-Verbindung
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('seitenverbinder', async () => {
  const f = neueFolge('seitenverbinder')
  let pos = { x: 0, y: 0 }
  await f.schritt(
    'erstellen-frage',
    async () => {
      pos = await kabelRechtsklick(0, 0.3)
      await w.getByText(M('canvas.cableMenu.makeOffPage')).first().click()
      await pause(500)
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'erstellt',
    async () => {
      const d = R_DIALOG()
      await d.getByRole('textbox').fill('CAM1-MIX')
      await d.getByRole('button', { name: OK() }).click()
      await pause(900)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'namen-anzeigen',
    async () => {
      await a.menue('app.menu.view', 'app.menu.view.offPageNames')
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'netz-info',
    async () => {
      const s = w.locator('[title*="CAM1-MIX"]').first()
      const p = await mitte(s)
      await w.mouse.click(p.x, p.y, { button: 'right' })
      await pause(600)
      extra.texte['seitenverbinder-netz'] = await w.locator('div.fixed').last().innerText().catch(() => '')
    },
    { ziel: R_FENSTER },
  )
  await f.schritt(
    'weg-griffe',
    async () => {
      await leerklick()
      const s = w.locator('[title*="CAM1-MIX"]').first()
      const p = await mitte(s)
      await w.mouse.click(p.x + 20, p.y, { delay: 60 })
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'wegpunkt-plus',
    async () => {
      const plus = w.locator('[title="' + T('offPage.waypoint.add') + '"]').first()
      await plus.click({ timeout: 5000 })
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'wegpunkt-ziehen',
    async () => {
      const wp = w.locator('[title="' + T('offPage.waypoint.hint') + '"]').first()
      const p = await mitte(wp)
      await ziehe(p, { x: p.x + 40, y: p.y - 50 })
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'wegpunkt-loeschen',
    async () => {
      const wp = w.locator('[title="' + T('offPage.waypoint.hint') + '"]').first()
      await wp.dblclick({ timeout: 5000 })
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'aufloesen',
    async () => {
      const s = w.locator('[title*="CAM1-MIX"]').first()
      const p = await mitte(s)
      await w.mouse.click(p.x, p.y, { button: 'right' })
      await pause(500)
      await w.getByText(M('offPage.resolve')).first().click({ timeout: 5000 })
      await pause(700)
    },
    { ziel: R_FLAECHE },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// KONTEXT — Geräte-, Rahmen-, Flächenmenü
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('kontext', async () => {
  const f = neueFolge('kontext')
  let pos = { x: 0, y: 0 }
  const bildUm = (breite = 240, hoehe = 170) => () => ({
    count: async () => 1,
    first: () => ({ screenshot: async (o) => w.screenshot({ ...o, clip: umPunkt(pos.x, pos.y, breite, hoehe) }) }),
  })
  const geraetMenue = async (name) => {
    const b = await knoten(name).boundingBox()
    pos = { x: b.x + 70, y: b.y + 12 }
    await w.mouse.click(pos.x, pos.y, { button: 'right' })
    await pause(500)
  }
  await f.schritt('geraet', async () => geraetMenue('Camera 2'), { ziel: bildUm(240, 150) })
  await f.schritt(
    'geraet-datenblatt',
    async () => {
      await w.getByText(M('canvas.nodeMenu.datasheet')).first().click({ timeout: 5000 })
      await pause(1200)
      extra.texte['datenblatt'] = await a.dialogText()
    },
    { ziel: R_FENSTER },
  )
  await a.zu()
  await f.schritt(
    'geraet-sperren',
    async () => {
      await leerklick()
      await geraetMenue('Camera 2')
      await w.getByText(M('canvas.area.lockPosition')).first().click({ timeout: 5000 })
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'geraet-entsperren-menue',
    async () => {
      await geraetMenue('Camera 2')
    },
    { ziel: bildUm(240, 150) },
  )
  await f.schritt(
    'geraet-entsperrt',
    async () => {
      await w.getByText(M('canvas.area.unlockPosition')).first().click({ timeout: 5000 })
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'geraet-loeschen-frage',
    async () => {
      await geraetMenue('Camera 2')
      await w.getByText(M('canvas.nodeMenu.deleteEquipment')).first().click({ timeout: 5000 })
      await pause(500)
      extra.texte['geraet-loeschen'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'geraet-loeschen-abbruch',
    async () => {
      await R_DIALOG().getByRole('button', { name: ABBRUCH() }).first().click()
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'flaeche',
    async () => {
      pos = { x: 760, y: 860 }
      await w.mouse.click(pos.x, pos.y, { button: 'right' })
      await pause(500)
    },
    { ziel: bildUm(240, 90) },
  )
  await f.schritt(
    'flaeche-neues-geraet',
    async () => {
      await w.getByText(M('canvas.paneMenu.newDevice')).first().click({ timeout: 5000 })
      await pause(1200)
      extra.texte['neues-geraet-hier'] = await a.dialogText()
    },
    { ziel: R_FENSTER },
  )
  await a.zu()
})

// ═══════════════════════════════════════════════════════════════════════════
// STREAM — Standbild-Kachel unter dem Gerät (lokaler Scheinserver)
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('stream', async () => {
  const f = neueFolge('stream')
  const b64 = await w.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 320
    c.height = 180
    const g = c.getContext('2d')
    const v = g.createLinearGradient(0, 0, 320, 180)
    v.addColorStop(0, '#0f766e')
    v.addColorStop(1, '#1e3a8a')
    g.fillStyle = v
    g.fillRect(0, 0, 320, 180)
    g.fillStyle = '#fff'
    g.font = 'bold 26px sans-serif'
    g.fillText('CAM 1', 20, 60)
    g.font = '16px sans-serif'
    g.fillText('sample still', 20, 90)
    return c.toDataURL('image/png').split(',')[1]
  })
  const png = Buffer.from(b64, 'base64')
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length })
    res.end(png)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  try {
    await f.schritt(
      'geraet-gewaehlt',
      async () => {
        await kopfKlick('Camera 1')
        await pause(500)
      },
      { ziel: R_FLAECHE_INSPECTOR },
    )
    await f.schritt(
      'abschnitt-streams',
      async () => {
        const kopf = w.getByText(T('streams.title'), { exact: true }).first()
        await kopf.scrollIntoViewIfNeeded()
        const add = w.getByRole('button', { name: M('streams.add') }).first()
        if (!(await add.count()) || !(await add.isVisible().catch(() => false))) await kopf.click()
        await pause(400)
        await w.getByRole('button', { name: M('streams.add') }).first().scrollIntoViewIfNeeded()
      },
      { ziel: R_INSPECTOR },
    )
    await f.schritt(
      'stream-angelegt',
      async () => {
        await klickMitte(w.getByRole('button', { name: M('streams.add') }).first())
        await w.getByLabel(M('streams.previewUrl')).first().scrollIntoViewIfNeeded()
      },
      { ziel: R_INSPECTOR },
    )
    await f.schritt(
      'vorschau-adresse',
      async () => {
        await w.getByLabel(M('streams.previewUrl')).first().fill(`http://127.0.0.1:${port}/standbild.png`)
        await w.getByLabel(M('streams.protocol')).first().selectOption('mjpeg').catch(() => {})
        await pause(400)
      },
      { ziel: R_INSPECTOR },
    )
    await f.schritt(
      'vorschau-an',
      async () => {
        await w.getByLabel(M('streams.showPreview')).first().check()
        await pause(700)
      },
      { ziel: R_FLAECHE_INSPECTOR },
    )
    await f.schritt(
      'kachel-start',
      async () => {
        extra.tooltips['stream-kachel-start'] = await w.getByRole('button', { name: M('canvas.stream.start') }).first().getAttribute('title')
        await klickMitte(w.getByRole('button', { name: M('canvas.stream.start') }).first())
        await pause(2500)
      },
      { ziel: R_FLAECHE },
    )
    await f.schritt(
      'kachel-fehler',
      async () => {
        await w.getByLabel(M('streams.previewUrl')).first().fill('http://127.0.0.1:9/nichts.png')
        await pause(2500)
      },
      { ziel: R_FLAECHE },
    )
    await f.schritt(
      'kachel-nicht-lokal',
      async () => {
        await w.getByLabel(M('streams.previewUrl')).first().fill('http://192.0.2.10/standbild.jpg')
        await pause(2500)
      },
      { ziel: R_FLAECHE },
    )
  } finally {
    server.close()
  }
})


// ═══════════════════════════════════════════════════════════════════════════
// Eigene Beispielprojekte für Szenen, die das Beispielprojekt nicht enthält
// ═══════════════════════════════════════════════════════════════════════════
const PT = (id, name, ct, direction, extra = {}) => ({ id, name, type: ct, connectorType: ct, direction, ...extra })
const GE = (id, name, category, x, y, inputs, outputs, extra = {}) => ({
  id, name, category, x, y, width: 220, height: 40 + 24 * Math.max(inputs.length, outputs.length), inputs, outputs, ...extra,
})
const KB = (id, name, fe, fp, te, tp, type, extra = {}) => ({
  id, name, type, length: 5, color: '#3b82f6', fromEquipmentId: fe, fromPortId: fp, toEquipmentId: te, toPortId: tp,
  notes: '', routing: 'orthogonal', arrowEnd: true, ...extra,
})
const projektGeruest = (name, equipment, cables, extra = {}) => ({
  metadata: { name, description: '', createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z', defaultVideoFormat: '1080p50' },
  equipment, cables, locations: [], canvasState: { x: 0, y: 0, zoom: 1 }, ...extra,
})
/** Ein Projekt über Datei → Öffnen laden (der Dateidialog des Systems ist ersetzt). */
async function projektLaden(projekt, dateiName) {
  const pfad = join(TMP, dateiName)
  writeFileSync(pfad, JSON.stringify(projekt))
  await a.app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] })
  }, pfad)
  await a.menue('app.menu.file', 'app.menu.file.open')
  await pause(3500)
  const ok = w.getByRole('button', { name: /^(OK|Discard|Verwerfen|Open anyway|Trotzdem öffnen)$/i })
  if (await ok.count()) await ok.first().click().catch(() => {})
  await pause(2000)
  await a.zu()
  await seiten()
  // einpassen
  await w.locator('.react-flow__controls button').nth(2).click({ timeout: 4000 }).catch(() => {})
  await pause(800)
}

// ═══════════════════════════════════════════════════════════════════════════
// AUSWAHLLEISTE — die schwebende Leiste an der Auswahl (Inline-Auswahl-Toolbar)
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('inline', async () => {
  const f = neueFolge('inline')
  const inl = () => w.locator('[role="toolbar"]').last()
  const umLeiste = ausschnitt(flaecheOben)
  await f.schritt(
    'ein-geraet',
    async () => {
      await kopfKlick('Camera 2')
      await pause(500)
      extra.tooltips['inline-ein-geraet'] = (await inl().locator('button').evaluateAll((els) => els.map((e) => e.getAttribute('title')))).join(' | ')
    },
    { ziel: umLeiste },
  )
  await f.schritt(
    'ein-geraet-nah',
    null,
    { ziel: ausschnitt(inl, () => knoten('Camera 2').boundingBox().then((b) => ({ x: b.x - 40, y: b.y - 70, width: b.width + 80, height: b.height + 90 }))) },
  )
  await f.schritt(
    'zwei-geraete',
    async () => {
      await kopfKlick('Vision mixer', 'Shift')
      await pause(500)
      extra.tooltips['inline-zwei-geraete'] = (await inl().locator('button').evaluateAll((els) => els.map((e) => e.getAttribute('title')))).join(' | ')
    },
    { ziel: umLeiste },
  )
  await f.schritt(
    'drei-geraete',
    async () => {
      await kopfKlick('Multiviewer', 'Shift')
      await pause(500)
      extra.tooltips['inline-drei-geraete'] = (await inl().locator('button').evaluateAll((els) => els.map((e) => e.getAttribute('title')))).join(' | ')
    },
    { ziel: umLeiste },
  )
  await f.schritt(
    'ausrichten-links',
    async () => {
      await inl().getByRole('button', { name: M('inlineToolbar.alignLeft') }).click()
      await pause(500)
    },
    { ziel: umLeiste },
  )
  await f.schritt(
    'verteilen',
    async () => {
      await inl().getByRole('button', { name: M('inlineToolbar.distributeV') }).click()
      await pause(500)
    },
    { ziel: umLeiste },
  )
  await f.schritt(
    'duplizieren',
    async () => {
      await abwaehlen()
      await kopfKlick('Control room monitor')
      await pause(400)
      await inl().getByRole('button', { name: M('inlineToolbar.duplicate') }).click()
      await pause(700)
    },
    { ziel: umLeiste },
  )
  await f.schritt(
    'rahmen',
    async () => {
      await inl().getByRole('button', { name: M('inlineToolbar.frame') }).click()
      await pause(700)
    },
    { ziel: umLeiste },
  )
  await f.schritt(
    'datenblatt',
    async () => {
      await abwaehlen()
      await kopfKlick('Camera 1')
      await pause(400)
      await inl().getByRole('button', { name: M('inlineToolbar.datasheet') }).click()
      await pause(1500)
      extra.texte['inline-datenblatt'] = await a.dialogText()
    },
    { ziel: R_FENSTER },
  )
  await a.zu()
  await f.schritt(
    'loeschen',
    async () => {
      await abwaehlen()
      await kopfKlick('Camera 1')
      await pause(400)
      await inl().getByRole('button', { name: M('inlineToolbar.delete') }).click()
      await pause(700)
      extra.texte['inline-loeschen'] = await a.dialogText()
    },
    { ziel: umLeiste },
  )
  await f.schritt(
    'rahmen-gewaehlt',
    async () => {
      await a.zu()
      await abwaehlen()
      const r = rahmenKnoten().first()
      const b = await r.boundingBox()
      await w.mouse.click(b.x + b.width / 2, b.y + b.height - 10)
      await pause(500)
    },
    { ziel: umLeiste },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTER — was zwischen zwei nicht passende Anschlüsse gehört
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('adapter', async () => {
  const f = neueFolge('adapter')
  const mx = GE('mx', zw('Audiomischer', 'Audio mixer'), 'Mixer', 80, 120,
    [],
    [PT('mx_o1', 'Line Out', 'Jack 6.35 mm TS', 'out'), PT('mx_o2', 'Mic Out', 'XLR', 'out', { gender: 'male' }), PT('mx_o3', 'SDI Out', 'BNC', 'out')])
  const rc = GE('rc', zw('Rekorder', 'Recorder'), 'Recorder', 760, 120,
    [PT('rc_i1', 'Line In', 'Jack 3.5 mm TRS', 'in'), PT('rc_i2', 'Mic In', 'XLR', 'in', { gender: 'male' }), PT('rc_i3', 'HDMI In', 'HDMI', 'in'),
      PT('rc_i4', 'Line In 2', 'Jack 3.5 mm TRS', 'in'), PT('rc_i5', 'Mic In 2', 'XLR', 'in', { gender: 'male' })],
    [])
  const projekt = projektGeruest('Adapter', [mx, rc], [
    KB('k1', 'Line', 'mx', 'mx_o1', 'rc', 'rc_i1', 'Jack 6.35 mm TS', { layer: 'audio', color: '#22c55e' }),
    KB('k2', 'Mic', 'mx', 'mx_o2', 'rc', 'rc_i2', 'XLR', { layer: 'audio', color: '#22c55e' }),
    KB('k3', 'SDI', 'mx', 'mx_o3', 'rc', 'rc_i3', 'BNC', { layer: 'video' }),
  ])
  await projektLaden(projekt, 'adapter.json')
  const wahl = async (i) => {
    await abwaehlen()
    const p = await kabelPunkt(i, 0.5)
    await w.mouse.click(p.x, p.y)
    await pause(600)
  }
  await f.schritt('szene', null, { ziel: R_FLAECHE })
  await f.schritt('adapter-hinweis', async () => wahl(0), { ziel: R_FLAECHE_INSPECTOR })
  await f.schritt(
    'adapter-eingesetzt',
    async () => {
      extra.tooltips['adapter-einsetzen'] = await w.getByRole('button', { name: M('adapter.insert') }).first().getAttribute('title')
      await w.getByRole('button', { name: M('adapter.insert') }).first().click({ timeout: 6000 })
      await pause(900)
      await w.locator('.react-flow__controls button').nth(2).click().catch(() => {})
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'adapter-rueckgaengig',
    async () => {
      await rueckgaengig()
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt('geschlecht-hinweis', async () => wahl(1), { ziel: R_FLAECHE_INSPECTOR })
  await f.schritt(
    'geschlecht-eingesetzt',
    async () => {
      await w.getByRole('button', { name: M('adapter.insert') }).first().click({ timeout: 6000 })
      await pause(900)
      await w.locator('.react-flow__controls button').nth(2).click().catch(() => {})
      await pause(600)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'geschlecht-rueckgaengig',
    async () => {
      await rueckgaengig()
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt('wandler-hinweis', async () => wahl(2), { ziel: R_FLAECHE_INSPECTOR })
  // beim Anlegen: Dialog mit Hinweis
  await f.schritt(
    'dialog-adapter',
    async () => {
      await abwaehlen()
      const von = await griff(zw('Audiomischer', 'Audio mixer'), 'source', 0)
      const ziel = await griff(zw('Rekorder', 'Recorder'), 'target', 3)
      await w.mouse.move(von.x, von.y)
      await w.mouse.down()
      await w.mouse.move((von.x + ziel.x) / 2, (von.y + ziel.y) / 2, { steps: 10 })
      await w.mouse.move(ziel.x, ziel.y, { steps: 10 })
      await w.mouse.up()
      await pause(800)
      extra.texte['dialog-adapter'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await a.zu()
  await f.schritt(
    'dialog-geschlecht',
    async () => {
      const von = await griff(zw('Audiomischer', 'Audio mixer'), 'source', 1)
      const ziel = await griff(zw('Rekorder', 'Recorder'), 'target', 4)
      await w.mouse.move(von.x, von.y)
      await w.mouse.down()
      await w.mouse.move((von.x + ziel.x) / 2, (von.y + ziel.y) / 2, { steps: 10 })
      await w.mouse.move(ziel.x, ziel.y, { steps: 10 })
      await w.mouse.up()
      await pause(800)
      extra.texte['dialog-geschlecht'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await a.zu()
})

// ═══════════════════════════════════════════════════════════════════════════
// SCHALTBILD — Stromkreis rechnen (Wechselschaltung), Schalter umlegen, Vorschläge
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('schaltbild', async () => {
  const f = neueFolge('schaltbild')
  const strom = (id, name, fe, fp, te, tp) => KB(id, name, fe, fp, te, tp, 'IEC 230V', { layer: 'power', color: '#f59e0b' })
  const baue = (mitZweiterAder) => {
    const en = zw('Einspeisung', 'Supply')
    const eq = [
      GE('fd', en, 'Power', 60, 240, [], [PT('fd_o', 'L', 'IEC 230V', 'out', { circuitTerminal: 0 })], { circuitKind: 'feed' }),
      GE('wa', zw('Wechselschalter A', 'Two-way switch A'), 'Power', 380, 100,
        [PT('wa_i', 'L', 'IEC 230V', 'in', { circuitTerminal: 0 })],
        [PT('wa_o1', 'Terminal 1', 'IEC 230V', 'out', { circuitTerminal: 1 }), PT('wa_o2', 'Terminal 2', 'IEC 230V', 'out', { circuitTerminal: 2 })],
        { circuitKind: 'changeover' }),
      GE('wb', zw('Wechselschalter B', 'Two-way switch B'), 'Power', 380, 380,
        [PT('wb_i1', 'Terminal 1', 'IEC 230V', 'in', { circuitTerminal: 1 }), PT('wb_i2', 'Terminal 2', 'IEC 230V', 'in', { circuitTerminal: 2 })],
        [PT('wb_o', 'L', 'IEC 230V', 'out', { circuitTerminal: 0 })],
        { circuitKind: 'changeover' }),
      GE('lp', zw('Leuchte', 'Luminaire'), 'Lighting', 760, 240, [PT('lp_i', 'L', 'IEC 230V', 'in', { circuitTerminal: 0 })], [], { circuitKind: 'lamp' }),
    ]
    const kb = [
      strom('s1', 'L1', 'fd', 'fd_o', 'wa', 'wa_i'),
      strom('s2', 'L2', 'wa', 'wa_o1', 'wb', 'wb_i1'),
      ...(mitZweiterAder ? [strom('s3', 'L3', 'wa', 'wa_o2', 'wb', 'wb_i2')] : []),
      strom('s4', 'L4', 'wb', 'wb_o', 'lp', 'lp_i'),
    ]
    return projektGeruest('Schaltbild', eq, kb)
  }
  await projektLaden(baue(true), 'schaltbild.json')
  const chip = () => leiste().getByRole('button', { name: M('canvas.circuit.label') }).first()
  const marke = (name) => knoten(name).locator('span[title*="—"]').first()
  await f.schritt('szene-aus', async () => merkeTitel('schaltbild-aus', chip()), { ziel: R_FLAECHE })
  await f.schritt(
    'an',
    async () => {
      await klickMitte(chip())
      extra.tooltips['schaltbild-an'] = await chip().getAttribute('title')
      extra.texte['schaltbild-chip'] = await leiste().innerText()
    },
    { ziel: ausschnitt(R_LEISTE, R_FLAECHE) },
  )
  await f.schritt(
    'schalter-a',
    async () => {
      await marke(zw('Wechselschalter A', 'Two-way switch A')).click({ timeout: 5000 })
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'schalter-b',
    async () => {
      await marke(zw('Wechselschalter B', 'Two-way switch B')).click({ timeout: 5000 })
      await pause(500)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'zuruecksetzen',
    async () => {
      await klickMitte(leiste().getByRole('button', { name: M('canvas.circuit.reset') }))
      await pause(400)
    },
    { ziel: R_FLAECHE },
  )
  await f.schritt(
    'vorschlaege-ohne-ader',
    async () => {
      await projektLaden(baue(false), 'schaltbild-luecke.json')
      await klickMitte(chip())
      await klickMitte(leiste().getByRole('button', { name: M('canvas.circuit.suggest'), exact: true }))
      await pause(900)
      extra.texte['schaltbild-vorschlaege'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'vorschlaege-tafel',
    async () => {
      await R_DIALOG().getByRole('button', { name: M('canvas.circuit.suggest.showTable') }).first().click({ timeout: 5000 })
      await pause(500)
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'vorschlag-eingetragen',
    async () => {
      await R_DIALOG().getByRole('button', { name: M('canvas.circuit.suggest.apply') }).first().click({ timeout: 5000 })
      await pause(700)
    },
    { ziel: R_DIALOG },
  )
  await a.zu()
  await f.schritt('nach-vorschlag', null, { ziel: R_FLAECHE })
})

// ═══════════════════════════════════════════════════════════════════════════
// WEG SCHALTEN — Prüfbild über eine Kreuzschiene (nur Dialog, nichts wird gesendet)
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('schalten', async () => {
  const f = neueFolge('schalten')
  const cam = GE('cm', 'Camera 1', 'Cameras', 60, 160, [], [PT('cm_o', 'SDI Out', 'BNC', 'out')], { nodeColor: '#0f4c81' })
  const hub = GE('hb', 'Videohub 12x12', 'Router', 420, 100,
    [PT('hb_i1', 'In 1', 'BNC', 'in'), PT('hb_i2', 'In 2', 'BNC', 'in')],
    [PT('hb_o1', 'Out 1', 'BNC', 'out'), PT('hb_o2', 'Out 2', 'BNC', 'out')],
    { ipAddress: '192.0.2.10', videohubRouting: { planned: { 0: 0 }, salvos: [] } })
  const mon = GE('mo', 'Control room monitor', 'Monitors', 800, 160, [PT('mo_i', 'SDI In', 'BNC', 'in')], [])
  await projektLaden(projektGeruest('Weg', [cam, hub, mon], [
    KB('w1', 'CAM 1', 'cm', 'cm_o', 'hb', 'hb_i1', 'BNC', { layer: 'video' }),
    KB('w2', 'PGM', 'hb', 'hb_o1', 'mo', 'mo_i', 'BNC', { layer: 'video', color: '#ef4444' }),
  ]), 'weg.json')
  const auswahl = () => leiste().locator('select').first()
  await f.schritt('szene', null, { ziel: R_FLAECHE })
  await f.schritt(
    'quelle-gewaehlt',
    async () => {
      await auswahl().selectOption({ label: 'Camera 1' })
      await pause(800)
      extra.texte['schalten-leiste'] = await leiste().innerText()
    },
    { ziel: ausschnitt(R_LEISTE, R_FLAECHE) },
  )
  await f.schritt(
    'dialog',
    async () => {
      await klickMitte(leiste().getByRole('button', { name: M('canvas.pattern.switch') }))
      await pause(700)
      extra.texte['schalten-dialog'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'ziel-gewaehlt',
    async () => {
      const s = R_DIALOG().locator('select').first()
      extra.listen['schalten-ziele'] = await s.locator('option').allInnerTexts()
      await s.selectOption({ index: 1 })
      await pause(700)
      extra.texte['schalten-plan'] = await a.dialogText()
    },
    { ziel: R_DIALOG },
  )
  await f.schritt(
    'name-haken',
    async () => {
      await R_DIALOG().getByPlaceholder(T('canvas.hubSwitch.byPlaceholder')).fill(zw('Beispiel-Techniker', 'Example technician'))
      await R_DIALOG().getByRole('checkbox').first().check()
      await pause(500)
      extra.texte['schalten-knopf-aktiv'] = String(await R_DIALOG().getByRole('button', { name: M('canvas.hubSwitch.send') }).first().isEnabled())
    },
    { ziel: R_DIALOG },
  )
  // Der Knopf zum Senden wird nicht gedrückt: die Adresse ist ein Beispiel (192.0.2.10).
  await a.zu()
  await w.getByRole('button', { name: M('canvas.hubSwitch.close') }).first().click({ timeout: 2000 }).catch(() => {})
})

// ═══════════════════════════════════════════════════════════════════════════
// Lauf
// ═══════════════════════════════════════════════════════════════════════════
const ergebnisDatei = join(HIER, `canvas.${sprache}.json`)
let bisher = { folgen: {}, extra: {} }
try {
  bisher = JSON.parse(readFileSync(ergebnisDatei, 'utf8'))
} catch {}
const speichern = () => {
  const out = { folgen: { ...(bisher.folgen ?? {}) }, extra: { ...(bisher.extra ?? {}) } }
  for (const [n, f] of Object.entries(folgen)) out.folgen[n] = { schritte: f.schritte, fehler: f.fehler }
  for (const k of ['tooltips', 'listen', 'texte']) out.extra[k] = { ...(out.extra[k] ?? {}), ...extra[k] }
  out.extra.fehler = [...(out.extra.fehler ?? []).filter((x) => !nur || !nur.includes(x.split(':')[0])), ...extra.fehler]
  writeFileSync(ergebnisDatei, JSON.stringify(out, null, 2))
}
for (const [name, fn] of abschnitte) {
  if (nur && !nur.includes(name)) continue
  console.log(`── Abschnitt ${name}`)
  try {
    if (name !== 'start') await frisch()
    await fn()
  } catch (e) {
    extra.fehler.push(`${name}: ${String(e.message).split('\n')[0]}`)
    console.log(`!! Abschnitt ${name}: ${String(e.message).split('\n')[0]}`)
  }
  await a.zu().catch(() => {})
  speichern()
}
speichern()
await a.ende()
console.log('FERTIG')
process.exit(0)
