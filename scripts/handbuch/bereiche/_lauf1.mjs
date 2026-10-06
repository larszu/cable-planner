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
import { mkdtempSync, writeFileSync } from 'node:fs'
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

/** Ansicht nach unten schieben, damit die Werkzeugleiste kein Gerät verdeckt. */
async function verschiebeAnsicht(dy = 150) {
  await w.mouse.move(900, 720)
  await w.mouse.down()
  await w.mouse.move(900, 720 + dy, { steps: 8 })
  await w.mouse.up()
  await pause(400)
}

// ─── Bildausschnitte ──────────────────────────────────────────────────────────
const FENSTER = { width: 1800, height: 1000 }
const leiste = () => w.locator('[data-cp-canvas-toolbar]')
const flaeche = () => w.locator('#cable-planner-canvas')

const alsRechteck = async (x) => {
  const v = typeof x === 'function' ? await x() : x
  if (v && typeof v.first === 'function') {
    const el = v.first()
    if (!(await el.count())) return null
    return await el.boundingBox()
  }
  return v
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
    screenshot: async (opt) => w.screenshot({ ...opt, clip: await vereine(teile) }),
  }),
})
/** Rechteck um einen Punkt (Kontextmenüs ohne Rolle). */
const umPunkt = (x, y, breite = 300, hoehe = 420) => ({
  x: Math.max(0, x - 10),
  y: Math.max(0, y - 10),
  width: Math.min(breite, FENSTER.width - x + 10),
  height: Math.min(hoehe, FENSTER.height - y + 10),
})
const R_FLAECHE = () => flaeche()
const R_LEISTE = () => leiste()
const R_MENUE = () => w.locator('[role="menu"]').last()
const R_DIALOG = () => w.locator('[role="dialog"]').last()
const R_INSPECTOR = { x: 1518, y: 40, width: 282, height: 935 }
const R_BIBLIOTHEK = { x: 0, y: 40, width: 262, height: 935 }
const R_FENSTER = { x: 0, y: 0, ...FENSTER }
const R_STATUS = { x: 0, y: 975, width: 1800, height: 25 }

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

/** Menüs und Popups ohne Rolle schließen: Escape, dann ein Klick auf freie Fläche. */
async function leerklick() {
  await w.keyboard.press('Escape')
  await pause(150)
  await w.mouse.click(820, 900)
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
const neueFolge = (name) => {
  const f = a.folge(`canvas-${name}`)
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
// ABLAUF
// ═══════════════════════════════════════════════════════════════════════════
for (const [name, fn] of abschnitte) {
  if (nur && !nur.includes(name)) continue
  console.log(`\n== ${name}`)
  try {
    if (name !== 'start') await frisch()
    await fn()
  } catch (e) {
    const m = `${name}: ${e.message.split('\n')[0]}`
    extra.fehler.push(m)
    console.log('✗ Abschnitt', m)
  }
  await a.zu().catch(() => {})
}

const datei = join(HIER, `canvas.${sprache}.json`)
let alt = { folgen: {}, tooltips: {}, listen: {}, texte: {}, fehler: [] }
if (nur) {
  try {
    alt = JSON.parse((await import('node:fs')).readFileSync(datei, 'utf8'))
  } catch {}
}
const neu = {
  folgen: { ...alt.folgen, ...Object.fromEntries(Object.entries(folgen).map(([k, f]) => [k, { schritte: f.schritte, fehler: f.fehler }])) },
  tooltips: { ...alt.tooltips, ...extra.tooltips },
  listen: { ...alt.listen, ...extra.listen },
  texte: { ...alt.texte, ...extra.texte },
  fehler: nur ? [...(alt.fehler ?? []).filter((x) => !nur.some((n) => x.startsWith(n + ':'))), ...extra.fehler] : extra.fehler,
}
writeFileSync(datei, JSON.stringify(neu, null, 2))
const offen = Object.entries(neu.folgen).flatMap(([k, f]) => f.fehler.map((x) => `${k}: ${x}`))
if (offen.length || neu.fehler.length) console.log('FEHLER:\n' + [...offen, ...neu.fehler].join('\n'))
await a.ende()
console.log('FERTIG')
