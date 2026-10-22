#!/usr/bin/env node
/**
 * Handbuch-Aufnahmen, Kapitel „Werkzeuge: Bauen“.
 *
 *   node scripts/handbuch/bereiche/werkzeuge-bauen.mjs de
 *   node scripts/handbuch/bereiche/werkzeuge-bauen.mjs en
 *   ABSCHNITTE=led,bulk node scripts/handbuch/bereiche/werkzeuge-bauen.mjs de   (nur diese Abschnitte)
 *
 * Jeder Abschnitt beginnt mit dem frischen Beispielprojekt und schreibt seine
 * Bilder unter docs/manual/bilder/<sprache>/werkzeuge-bauen-<abschnitt>-<nn>-<name>.jpg.
 * Schritte, Dialogtexte und Fehler stehen in werkzeuge-bauen.<sprache>.json.
 *
 * Beispieldaten und was nicht angefasst wird:
 * - KI-Plan: der Schlüssel ist erfunden (`sk-beispiel`), und `fetch` zu den
 *   Anbieter-Adressen wird im Fenster durch feste Beispielantworten ersetzt.
 *   Es geht nichts ins Netz.
 * - Show-Control-Lauscher: bindet nur 127.0.0.1; die Beispielnachricht kommt
 *   aus diesem Skript über UDP an dieselbe Adresse.
 * - ATEM, Videohub, GreenGo: Dialoge werden geöffnet und gefüllt, aber nichts
 *   verbunden, gesucht oder gesendet (kein „Suchen“, „Verbinden“, „Senden“).
 * - Ausgaben (CSV, PNG, XML, TXT, PDF) werden im Fenster abgefangen und nicht
 *   auf die Platte geschrieben.
 */

import { starte } from '../app.mjs'
import { erststartOverlayWeg } from '../../lib/erststartOverlay.mjs'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import dgram from 'node:dgram'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const sprache = process.argv[2] ?? 'de'
const nur = process.env.ABSCHNITTE ? process.env.ABSCHNITTE.split(',') : null
const HIER = dirname(fileURLToPath(import.meta.url))
const TMP = mkdtempSync(join(tmpdir(), 'cp-bauen-'))

const a = await starte({ sprache, breite: 1600, hoehe: 1100 })
const w = a.win
w.setDefaultTimeout(8000)
const de = sprache === 'de'
const zw = (deText, enText) => (de ? deText : enText)
const pause = (ms) => w.waitForTimeout(ms)
const M = (k, genau = false) => a.muster(k, genau)
const T = (k) => a.text(k)
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const grundzustand = await w.evaluate(() => ({
  ui: localStorage.getItem('cable-planner:ui'),
  settings: localStorage.getItem('cable-planner:settings'),
}))

const folgen = {}
const extra = { texte: {}, fehler: [] }
const seiten = () =>
  w.evaluate(() => {
    window.print = () => {}
    window.alert = () => {}
    window.confirm = () => true
    window.prompt = () => null
  })

// ─── Abfang für Downloads (nur Name und Größe, nichts wird geschrieben) ──────
async function downloadsAbfangen() {
  await w.evaluate(() => {
    if (window.__dl) return
    window.__dl = []
    const blobs = new Map()
    const orig = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (b) => {
      const u = orig(b)
      blobs.set(u, b)
      return u
    }
    const grab = (el) => {
      const href = el.href || ''
      if (!blobs.has(href)) return false
      const b = blobs.get(href)
      b.text().then((t) => window.__dl.push({ name: el.download, type: b.type, size: b.size, text: b.type.startsWith('text') || /xml|json/.test(b.type) ? t.slice(0, 4000) : '' }))
      return true
    }
    const oc = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () {
      if (this.hasAttribute('download') && grab(this)) return
      return oc.call(this)
    }
    const od = HTMLAnchorElement.prototype.dispatchEvent
    HTMLAnchorElement.prototype.dispatchEvent = function (e) {
      if (e && e.type === 'click' && this.hasAttribute('download') && grab(this)) return true
      return od.call(this, e)
    }
  })
}
const downloads = () => w.evaluate(() => window.__dl ?? [])

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
  await downloadsAbfangen()
  if (!leer) {
    const demo = w.getByRole('button', { name: /Load example project|Beispielprojekt laden/i })
    if (await demo.count()) {
      await demo.first().click().catch(() => {})
      await pause(1800)
    }
  }
  await a.zu()
}

// ─── Hilfen ──────────────────────────────────────────────────────────────────
const D = () => w.locator('[role="dialog"]').last()
const FENSTER = () => w.locator('body')
/** Ein festes Rechteck des Fensters als Aufnahmeziel. */
const rechteck = (r) => () => ({
  count: async () => 1,
  first: () => ({ innerText: async () => '', screenshot: async (opt) => w.screenshot({ ...opt, clip: r }) }),
})
const STATUS = rechteck({ x: 0, y: 1072, width: 680, height: 28 })
const bib = () => w.locator('aside:has(.spaltenkopf)').first()
const insp = () => w.locator('aside:has(.spaltenkopf)').nth(1)
/** Eingabefeld über die Beschriftung (exakter Text), im obersten Dialog. */
const feld = (key, i = 0, bereich = D) => bereich().getByLabel(T(key), { exact: true }).nth(i)
const knopfD = (key, opt = {}) => D().getByRole('button', { name: M(key, opt.genau ?? false) }).first()
async function tippe(loc, text) {
  await loc.click({ timeout: 8000 })
  await loc.fill(String(text))
  await loc.press('Tab')
  await pause(250)
}
async function klickLoc(loc, opt = {}) {
  await loc.first().click({ timeout: 8000, ...opt })
  await pause(500)
}
/** Eintrag einer <select> nach Textmuster wählen (selectOption kennt nur genaue Texte). */
async function waehle(sel, re) {
  const i = await sel.evaluate((el, src) => [...el.options].findIndex((o) => new RegExp(src, 'i').test(o.text)), re.source)
  if (i < 0) throw new Error(`Eintrag nicht gefunden: ${re}`)
  await sel.selectOption({ index: i })
  await pause(300)
}
const menue = (...pfad) => a.menue('app.menu.tools', ...pfad)
const werkzeug = (name) => menue(`app.menu.tools.${name}`)

function neueFolge(name) {
  // Alte Bilder dieses Abschnitts weg: verschobene Nummern lassen sonst Waisen liegen.
  const bilderDir = join(HIER, '..', '..', '..', 'docs', 'manual', 'bilder', sprache)
  for (const d of readdirSync(bilderDir)) if (d.startsWith(`werkzeuge-bauen-${name}-`)) rmSync(join(bilderDir, d))
  const f = a.folge(`werkzeuge-bauen-${name}`)
  const roh = f.schritt.bind(f)
  f.S = async (n, tun, opt = {}) => {
    await roh(n, tun, { ziel: D, ...opt })
    const letzter = f.schritte.at(-1)
    if (letzter?.name === n) {
      try {
        const z = typeof (opt.ziel ?? D) === 'function' ? (opt.ziel ?? D)() : opt.ziel
        const t = ((await z.first().innerText({ timeout: 2000 })) || '').replace(/\n{3,}/g, '\n\n')
        if (t) extra.texte[`${name}:${n}`] = t.slice(0, 6000)
      } catch {
        /* kein Text */
      }
    }
  }
  /** Eine Handlung ohne Bild: sie stellt nur den Zustand für die nächsten Schritte her. */
  f.still = async (n, tun) => {
    try {
      if (tun) await tun()
      await pause(300)
    } catch (e) {
      f.fehler.push(`${n}: ${String(e.message).split('\n')[0]}`)
      console.log(`✗ ${name} (still) ${n}: ${String(e.message).split('\n')[0]}`)
    }
  }
  folgen[name] = f
  return f
}

/** Ein Gerät aus der Bibliothek auf den Plan setzen (Doppelklick auf den Eintrag). */
async function lege(suche, name) {
  const feldSuche = bib().getByRole('textbox').first()
  await feldSuche.fill(suche)
  await pause(700)
  await bib().locator('[draggable="true"][role="button"]', { hasText: name }).first().dblclick()
  await pause(900)
  await feldSuche.fill('')
  await pause(300)
}
const knoten = (n) => w.locator('.react-flow__node-equipment').filter({ hasText: n }).first()

const abschnitte = []
const abschnitt = (name, fn) => abschnitte.push([name, fn])

// ═══════════════════════════════════════════════════════════════════════════
// MENÜ — untere Hälfte des Werkzeuge-Menüs
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('menue', async () => {
  const f = neueFolge('menue')
  await lege('ATEM', 'Constellation HD')
  await lege('Videohub', 'Smart Videohub 12x12')
  await lege('GreenGo', 'GreenGo MCX')
  await f.S(
    'unten',
    async () => {
      await a.menue('app.menu.tools')
      await a.menueFeld().evaluate((el) => {
        const s = el.querySelector('[class*="overflow"]') ?? el
        s.scrollTop = s.scrollHeight
        el.scrollTop = el.scrollHeight
      })
      await pause(300)
    },
    { ziel: () => a.menueFeld() },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// LED-WAND
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('led', async () => {
  const f = neueFolge('led')
  await f.S('leer', () => werkzeug('ledWall'))
  await f.S('typ-neu', () => a.klick('led.types.add'))
  const typ = D().locator('div.border-cp-border-muted').first()
  await f.S('typ-ausgefuellt', async () => {
    await tippe(feld('led.panel.name'), zw('Beispiel-Panel 2,6', 'Sample panel 2.6'))
    await tippe(feld('led.panel.pitch'), '2.6')
    await tippe(feld('led.panel.px'), '192')
    await tippe(feld('led.panel.py'), '192')
    await tippe(feld('led.panel.w'), '500')
    await tippe(feld('led.panel.h'), '500')
    await tippe(feld('led.panel.weight'), '7.5')
    await tippe(feld('led.panel.avg'), '90')
    await tippe(feld('led.panel.max'), '180')
    await tippe(feld('led.panel.source'), 'https://example.com/datenblatt-beispiel.pdf')
  })
  await f.S('wand-neu', () => a.klick('led.walls.add'))
  await f.S('raster', async () => {
    await tippe(feld('led.wall.columns'), '8')
    await tippe(feld('led.wall.rows'), '4')
    await D().locator('dl').first().scrollIntoViewIfNeeded()
  })
  await f.S('oeffnung', async () => {
    await tippe(feld('led.opening.w'), '3300')
    await tippe(feld('led.opening.h'), '1700')
    await pause(300)
  })
  await f.S('oeffnung-eingepasst', () => a.klick('led.opening.apply'))
  const zuschnittBereich = () => D().locator('h4', { hasText: T('led.crop.title') }).locator('xpath=..')
  await f.still('zuschnitt', async () => {
    await zuschnittBereich().scrollIntoViewIfNeeded()
    await pause(300)
  }, { ziel: zuschnittBereich })
  await f.S('zuschnitt-quelle', async () => {
    await tippe(feld('led.crop.sourceW'), '3840')
    await tippe(feld('led.crop.sourceH'), '2160')
  }, { ziel: zuschnittBereich })
  await f.S('zuschnitt-kopiert', async () => {
    await zuschnittBereich().getByTitle(T('led.crop.copy')).first().click()
    await pause(500)
  }, { ziel: zuschnittBereich })
  await f.S('sending-card', async () => {
    await tippe(feld('led.ports.count'), '4')
    await tippe(feld('led.ports.capacity'), '650000')
  })
  await f.S('sending-card-knapp', async () => {
    await tippe(feld('led.ports.count'), '1')
  })
  await f.S('ohne-gewicht', async () => {
    await tippe(feld('led.panel.weight'), '')
    await D().locator('dl').first().scrollIntoViewIfNeeded()
  })
  await f.still('pixelmap', async () => {
    const n0 = (await downloads()).length
    await klickLoc(knopfD('led.pixelmap'))
    await pause(1500)
    const neu = (await downloads()).slice(n0)
    extra.texte['led:pixelmap-download'] = JSON.stringify(neu.map((d) => ({ name: d.name, type: d.type, size: d.size })))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// FRONTPLATTEN-EDITOR
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('frontplatte', async () => {
  const f = neueFolge('frontplatte')
  await f.S('offen', () => werkzeug('faceplate'))
  const auswahl = (i) => D().locator('select').nth(i)
  await f.S('geraet-gewaehlt', async () => {
    await waehle(auswahl(0), /Vision mixer/)
    await pause(500)
  })
  await f.S('art-wandfeld', async () => {
    await auswahl(1).selectOption({ index: 1 })
    await pause(400)
  })
  await f.S('masse', async () => {
    await tippe(feld('faceplate.width'), '240')
    await tippe(feld('faceplate.height'), '120')
  })
  await f.S('platziert', async () => {
    const setzen = () => D().getByRole('button', { name: M('faceplate.place', true) })
    for (let i = 0; i < 12 && (await setzen().count()); i += 1) {
      await setzen().first().click()
      await pause(250)
    }
    await pause(300)
  })
  await f.S('verschoben', async () => {
    const platte = D().locator('div.relative.shrink-0').first()
    const pb = await platte.boundingBox()
    const marker = D().locator('div.cursor-move')
    const n = await marker.count()
    for (let i = n - 1; i >= 0; i -= 1) {
      const b = await marker.nth(i).boundingBox()
      const zx = pb.x + (pb.width * (i + 1)) / (n + 1)
      const zy = pb.y + pb.height * (i % 2 === 0 ? 0.35 : 0.65)
      await w.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
      await w.mouse.down()
      await w.mouse.move(zx, zy, { steps: 10 })
      await w.mouse.up()
      await pause(250)
    }
  })
  await f.S('ausschnitt', async () => {
    const zellen = D().locator('input[type="number"][step="0.1"]')
    const n = await zellen.count()
    for (let i = 0; i < n; i += 1) await tippe(zellen.nth(i), '24')
  })
  await f.S('raster-streifen', async () => {
    await tippe(feld('faceplate.grid'), '5')
    await tippe(feld('faceplate.strip'), '12')
  })
  await f.S('art-bodentank', async () => {
    await auswahl(1).selectOption({ index: 2 })
    await pause(400)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// BERICHTS-EDITOR
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('bericht', async () => {
  const f = neueFolge('bericht')
  const zeile = (re) => D().locator('table').first().locator('tbody tr').filter({ hasText: re }).first()
  await f.S('offen', () => werkzeug('bericht'))
  await f.S('liste-gewaehlt', async () => {
    await D().locator('select').first().selectOption({ label: zw('Kabel-Schedule', 'Cable schedule') })
    await pause(500)
  })
  await f.S('spalte-aus', async () => {
    await zeile(/Standard/).locator('input[type="checkbox"]').uncheck()
    await pause(400)
  })
  await f.S('spalte-verschoben', async () => {
    await zeile(/Länge|Length/).getByTitle(T('bericht.up')).click()
    await pause(300)
    await zeile(/Länge|Length/).getByTitle(T('bericht.up')).click()
    await pause(400)
  })
  await f.S('sortiert', async () => {
    await zeile(/Länge|Length/).locator('button', { hasText: T('bericht.sortOff') }).click()
    await pause(300)
    await zeile(/Länge|Length/).locator('button', { hasText: T('bericht.asc') }).click()
    await pause(400)
  })
  await f.S('gefiltert', async () => {
    await zeile(/Von Gerät|From device/).getByPlaceholder(T('bericht.filterPlaceholder')).fill('Camera')
    await pause(500)
  })
  await f.S('gruppiert', async () => {
    const gruppe = D().locator('select').nth(1)
    const idx = await gruppe.evaluate((el) => [...el.options].findIndex((o) => /^(Typ|Type)$/.test(o.text)))
    await gruppe.selectOption({ index: idx })
    await pause(500)
  })
  await f.S('vorlage-name', async () => {
    await D().getByPlaceholder(T('bericht.templatePlaceholder')).fill(zw('Ziehliste ohne Raum', 'Pull list without room'))
    await pause(300)
  })
  await f.S('vorlage-gespeichert', async () => {
    await knopfD('bericht.saveProject').click()
    await pause(500)
  })
  await f.S('csv', async () => {
    const n0 = (await downloads()).length
    await knopfD('bericht.csv', { genau: true }).click()
    await pause(1200)
    const neu = (await downloads()).slice(n0)
    extra.texte['bericht:csv-download'] = JSON.stringify(neu.map((d) => ({ name: d.name, type: d.type, size: d.size, kopf: d.text.split('\n').slice(0, 3) })))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ADERN UND FARBNORMEN
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('adern', async () => {
  const f = neueFolge('adern')
  await f.S('normen-leer', () => werkzeug('adern'))
  await f.S('norm-neu', () => a.klick('adern.norm.add'))
  await f.S('norm-ausgefuellt', async () => {
    await D().getByLabel(T('adern.norm.name'), { exact: true }).fill(zw('Hausnorm Beispiel', 'Sample house standard'))
    await D().getByPlaceholder(M('adern.norm.herkunftPlaceholder')).fill(zw('Beispiel: Hausstandard, festgelegt von Lars', 'Example: house standard, set by Lars'))
    const farben = D().getByPlaceholder(T('adern.norm.colourPlaceholder'))
    const werte = zw(['braun', 'schwarz', 'grau', 'blau', 'grün-gelb'], ['brown', 'black', 'grey', 'blue', 'green-yellow'])
    for (let i = 0; i < werte.length; i += 1) await farben.nth(i).fill(werte[i])
    await pause(300)
  })
  await f.S('anschluss-leer', () => klickLoc(D().getByRole('button', { name: M('adern.tab.anschluss') })))
  await f.S('anschluss-neu', () => a.klick('adern.anschluss.add'))
  await f.S('anschluss-ausgefuellt', async () => {
    await D().getByLabel(T('adern.anschluss.name'), { exact: true }).fill(zw('Zuleitung 400 A', 'Feeder 400 A'))
    for (const r of ['L1', 'L2', 'L3', 'N', 'PE']) await D().locator('label', { hasText: new RegExp(`^${r}$`) }).first().locator('input').check()
    await D().locator('select').first().selectOption({ index: 1 })
    await pause(300)
  })
  await f.S('polaritaet-leer', () => klickLoc(D().getByRole('button', { name: M('adern.tab.polaritaet') })))
  await f.S('polaritaet-neu', () => a.klick('fibre.method.add'))
  await f.S('polaritaet-ausgefuellt', async () => {
    await D().getByLabel(T('fibre.method.name'), { exact: true }).fill(zw('Methode B (Beispiel)', 'Method B (example)'))
    await D().getByPlaceholder(M('fibre.method.herkuntPlaceholder')).fill(zw('Beispiel: Anlagendokument, festgelegt von Lars', 'Example: site document, set by Lars'))
    await D().locator('input[type="checkbox"]').first().check()
    await D().locator('input[type="radio"]').first().check()
    await pause(300)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// EMPFANGENE SHOW-CONTROL-NACHRICHTEN
// ═══════════════════════════════════════════════════════════════════════════
const oscPaket = (adresse, ...ints) => {
  const pad = (b) => Buffer.concat([b, Buffer.alloc(4 - (b.length % 4))])
  const parts = [pad(Buffer.from(adresse)), pad(Buffer.from(',' + 'i'.repeat(ints.length)))]
  for (const n of ints) {
    const b = Buffer.alloc(4)
    b.writeInt32BE(n)
    parts.push(b)
  }
  return Buffer.concat(parts)
}
abschnitt('osc', async () => {
  const f = neueFolge('osc')
  await f.S('offen', () => werkzeug('osc'))
  await f.S('adresse', async () => {
    await D().getByPlaceholder(M('osc.addressPlaceholder')).fill('127.0.0.1')
    await D().locator('input[type="number"]').first().fill('49581')
    await D().locator('input[type="number"]').first().press('Tab')
    await pause(400)
  })
  await f.S('lauscht', async () => {
    await D().getByLabel(T('osc.enable'), { exact: false }).check()
    await pause(1200)
  })
  await f.S('nachricht', async () => {
    const s = dgram.createSocket('udp4')
    await new Promise((r) => s.send(oscPaket('/cue/12/go', 1), 49581, '127.0.0.1', r))
    s.close()
    await pause(1500)
  })
  await f.S('geleert', () => klickLoc(D().getByRole('button', { name: M('osc.clear', true) })))
  await f.still('aus', async () => {
    await D().getByLabel(T('osc.enable'), { exact: false }).uncheck()
    await pause(800)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// MEHRERE KABEL VERBINDEN
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('bulk', async () => {
  const f = neueFolge('bulk')
  await lege('ATEM', 'Constellation HD')
  await lege('Videohub', 'Smart Videohub 12x12')
  await f.S('offen', () => werkzeug('bulkConnect'))
  const sel = (i) => D().locator('select').nth(i)
  await f.S('quelle', async () => {
    await waehle(sel(0), /Constellation HD/)
    await pause(300)
  })
  await f.S('ziel', async () => {
    await waehle(sel(2), /Smart Videohub 12x12/)
    await pause(300)
  })
  await f.S('bereich', async () => {
    await tippe(feld('bulk.count'), '8')
    await pause(300)
  })
  await f.S('kabeltyp', async () => {
    await waehle(sel(4), /SDI 12G/)
    await tippe(feld('bulk.length'), '3')
    await pause(300)
  })
  await f.S('angelegt', async () => {
    await knopfD('bulk.create').click()
    await pause(1500)
  }, { ziel: STATUS })
})

// ═══════════════════════════════════════════════════════════════════════════
// NEUES RACK ERSTELLEN / RACK-BUILDER
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('rack', async () => {
  const f = neueFolge('rack')
  const suche = () => D().getByPlaceholder(T('rack.searchDevicesPlaceholder')).first()
  const ins = () => D().getByRole('button', { name: M('rack.addToRack') })
  await f.S('offen', () => werkzeug('newRack'))
  await f.S('kopf', async () => {
    await D().getByPlaceholder(M('rack.field.namePlaceholder')).fill(zw('Hauptrack Video', 'Main video rack'))
    await pause(200)
    const zahlen = D().locator('input[type="number"]')
    await tippe(zahlen.nth(0), '12')
    await tippe(zahlen.nth(1), '800')
  })
  await f.S('suchen', async () => {
    await suche().fill('GigaCore 12')
    await pause(600)
  })
  await f.S('im-rack', async () => {
    await ins().first().click()
    await pause(900)
  })
  await f.S('zweites-geraet', async () => {
    await suche().fill('Smart Videohub 12x12')
    await pause(600)
    await ins().first().click()
    await pause(900)
  })
  await f.S('hinten', () => klickLoc(D().getByRole('button', { name: M('rack.viewMode.rear', true) })))
  await f.S('beide', () => klickLoc(D().getByRole('button', { name: M('rack.viewMode.both', true) })))
  await f.S('seite', () => klickLoc(D().getByRole('button', { name: M('rack.viewMode.side', true) })))
  await f.still('vorne', () => klickLoc(D().getByRole('button', { name: M('rack.viewMode.front', true) })))
  await f.S('patchblende-dialog', () => klickLoc(D().getByRole('button', { name: M('rack.patchPanelBtn') })), { ziel: () => w.locator('[role="dialog"]').last() })
  await f.S('patchblende-ports', () => klickLoc(D().getByRole('button', { name: M('rack.patchPanel.tab.perPort') })))
  await f.S('patchblende-angelegt', async () => {
    await D().getByRole('button', { name: M('rack.patchPanel.create') }).first().click()
    await pause(900)
  }, { ziel: () => w.locator('[role="dialog"]').last() })
  await f.S('shelf-dialog', () => klickLoc(D().getByRole('button', { name: M('rack.shelfBtn') })))
  await f.S('shelf-angelegt', async () => {
    await D().getByRole('button', { name: M('rack.shelf.create') }).first().click()
    await pause(900)
  })
  await f.S('nicht-rack', async () => {
    await D().getByLabel(T('rack.showNonRack'), { exact: false }).first().check()
    await suche().fill('Camera')
    await pause(700)
  })
  await f.S('nicht-rack-dialog', async () => {
    await ins().first().click()
    await pause(700)
  }, { ziel: () => w.locator('[role="dialog"]').last() })
  await f.S('nicht-rack-hinzugefuegt', async () => {
    await D().getByRole('button', { name: M('rack.nonRack.add', true) }).first().click()
    await pause(900)
    await suche().fill('')
    await D().getByLabel(T('rack.showNonRack'), { exact: false }).first().uncheck()
  })
  const BUILDER = () => w.locator('[role="dialog"]').first()
  await f.S('eigenschaften', async () => {
    await D().locator('[title^="Blackmagic Smart Videohub 12x12"]').first().dblclick()
    await pause(900)
  })
  await f.S('eigenschaften-stl', async () => {
    await D().locator('details, summary').first().scrollIntoViewIfNeeded().catch(() => {})
    await D().evaluate((el) => { const s = el.querySelector('.overflow-auto, .overflow-y-auto'); if (s) s.scrollTop = s.scrollHeight })
    await pause(500)
  })
  await f.S('konflikt', async () => {
    await D().evaluate((el) => { const s = el.querySelector('.overflow-auto, .overflow-y-auto'); if (s) s.scrollTop = 0 })
    await tippe(D().getByLabel(T('rack.props.startHe'), { exact: false }).first(), '1')
    await klickLoc(D().getByRole('button', { name: M('common.close', true) }).first())
    await pause(600)
  }, { ziel: BUILDER })
  await f.S('konflikt-behoben', async () => {
    await D().locator('[title^="Blackmagic Smart Videohub 12x12"]').first().dblclick()
    await pause(700)
    await tippe(D().getByLabel(T('rack.props.startHe'), { exact: false }).first(), '2')
    await klickLoc(D().getByRole('button', { name: M('common.close', true) }).first())
    await pause(600)
  }, { ziel: BUILDER })
  await f.S('3d', async () => {
    await klickLoc(D().getByRole('button', { name: /^\s*3D\s*$/ }))
    await pause(3500)
  })
  await f.S('2d', () => klickLoc(D().getByRole('button', { name: /^\s*2D\s*$/ })))
  await f.S('export', () => klickLoc(D().getByRole('button', { name: M('rack.exportBtn') })))
  await f.S('intern', async () => {
    await klickLoc(D().getByRole('button', { name: M('rack.exportBtn') }))
    await klickLoc(D().getByRole('button', { name: M('rack.internalWireBtn') }))
    await pause(2000)
  })
  await f.S('gespeichert', async () => {
    await klickLoc(D().getByRole('button', { name: M('common.done', true) }))
    await pause(500)
    await klickLoc(D().getByRole('button', { name: M('rack.saveNewBtn') }))
    await pause(1200)
  }, { ziel: rechteck({ x: 0, y: 40, width: 262, height: 330 }) })
})

// ═══════════════════════════════════════════════════════════════════════════
// KI-PLAN GENERIEREN
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('ki', async () => {
  const f = neueFolge('ki')
  const TEXT_ANTWORT = {
    devices: [
      { name: zw('Kamera A', 'Camera A'), category: zw('Kameras', 'Cameras'), inputs: [], outputs: ['SDI Out'] },
      { name: zw('Bildmischer', 'Switcher'), category: 'Video', inputs: ['SDI In 1', 'SDI In 2'], outputs: ['PGM Out'] },
      { name: zw('Recorder', 'Recorder'), category: 'Video', inputs: ['SDI In'], outputs: [] },
    ],
    connections: [
      { from: zw('Kamera A', 'Camera A'), fromPort: 'SDI Out', to: zw('Bildmischer', 'Switcher'), toPort: 'SDI In 1', connector: 'BNC' },
      { from: zw('Bildmischer', 'Switcher'), fromPort: 'PGM Out', to: zw('Recorder', 'Recorder'), toPort: 'SDI In', connector: 'BNC' },
    ],
  }
  const DOK_ANTWORT = {
    rooms: [{ name: zw('Seminarraum 1', 'Seminar room 1'), roomNumber: '1.049', floor: zw('1. Etage', '1st floor') }],
    types: [{ id: 't1', name: zw('Beispiel-Konverter', 'Sample converter'), category: 'Video', inputs: [['HDMI In', 'HDMI']], outputs: [['SDI Out', 'BNC']] }],
    devices: [{ id: 'd1', type: 't1', room: zw('Seminarraum 1', 'Seminar room 1'), ip: '192.168.1.60', src: 'ip-liste-beispiel.csv' }],
    updates: [],
    connections: [],
    warnings: [zw('Beispiel: IP 192.168.1.44 steht zweimal in der Liste', 'Example: IP 192.168.1.44 appears twice in the list')],
  }
  await f.S('ohne-schluessel', () => werkzeug('aiPlanGen'))
  // Erfundener Schlüssel und feste Beispielantworten; es geht nichts ins Netz.
  await w.evaluate(({ t, d }) => {
    localStorage.setItem('cable-planner:ai-provider', 'openai')
    localStorage.setItem('cable-planner:openai-api-key', 'sk-beispiel')
    const echt = window.fetch.bind(window)
    window.fetch = async (url, opts = {}) => {
      if (!/api\.openai\.com/.test(String(url))) return echt(url, opts)
      const body = String(opts.body ?? '')
      const antwort = /completing a cable plan/.test(body) ? d : t
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(antwort) } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
  }, { t: TEXT_ANTWORT, d: DOK_ANTWORT })
  await a.zu()
  await werkzeug('aiPlanGen')
  await f.S('beschreibung', async () => {
    await D().locator('textarea').fill(zw('Eine Kamera über SDI in einen Bildmischer, Programmbild auf einen Recorder', 'One camera over SDI into a switcher, programme out to a recorder'))
    await pause(300)
  })
  await f.S('vorschau', async () => {
    await klickLoc(D().getByRole('button', { name: M('aiPlan.generate', true) }))
    await pause(1500)
  })
  await f.S('eingefuegt', async () => {
    await klickLoc(D().getByRole('button', { name: M('aiPlan.insert', true) }))
    await pause(1500)
  }, { ziel: STATUS })
  const csv = join(TMP, 'ip-liste-beispiel.csv')
  writeFileSync(csv, 'Name;IP;Raum\nBeispiel-Konverter;192.168.1.60;Seminarraum 1\nBeispiel-Konverter;192.168.1.44;Seminarraum 2\n')
  await werkzeug('aiPlanGen')
  await f.S('dokument', async () => {
    await D().locator('input[type="file"]').setInputFiles(csv)
    await pause(800)
  })
  await f.S('ergaenzung-vorschau', async () => {
    await klickLoc(D().getByRole('button', { name: M('aiPlan.complete', true) }))
    await pause(1800)
  })
  await f.S('ergaenzung-eingefuegt', async () => {
    await klickLoc(D().getByRole('button', { name: M('aiPlan.insert', true) }))
    await pause(1500)
  }, { ziel: STATUS })
})

// ═══════════════════════════════════════════════════════════════════════════
// REVISIONEN & SNAPSHOTS
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('revisionen', async () => {
  const f = neueFolge('revisionen')
  await f.S('leer', () => werkzeug('revisions'))
  await f.S('festgeschrieben', async () => {
    await D().getByPlaceholder(M('revisions.labelPlaceholder')).fill('A')
    await D().getByPlaceholder(M('revisions.notePlaceholder')).fill(zw('Erster Stand', 'First state'))
    await klickLoc(D().getByRole('button', { name: M('revisions.commit', true) }))
    await pause(600)
  })
  await f.S('as-built', async () => {
    await D().getByPlaceholder(M('revisions.labelPlaceholder')).fill('B')
    await D().getByPlaceholder(M('revisions.notePlaceholder')).fill(zw('Nach dem Aufbau', 'After load-in'))
    await D().getByLabel(T('revisions.asBuilt'), { exact: false }).first().check()
    await klickLoc(D().getByRole('button', { name: M('revisions.commit', true) }))
    await pause(600)
  })
  await f.S('wiederherstellen', async () => {
    await D().getByTitle(T('revisions.restore')).last().click()
    await pause(700)
  }, { ziel: () => w.locator('[role="dialog"], [role="alertdialog"]').last() })
  await f.S('loeschen', async () => {
    await a.zu()
    await werkzeug('revisions')
    await D().getByTitle(T('revisions.delete')).last().click()
    await pause(700)
  }, { ziel: () => w.locator('[role="dialog"], [role="alertdialog"]').last() })
})

// ═══════════════════════════════════════════════════════════════════════════
// LAGER / BESTAND
// ═══════════════════════════════════════════════════════════════════════════
abschnitt('lager', async () => {
  const f = neueFolge('lager')
  const reiter = (key) => klickLoc(D().getByRole('button', { name: M(key) }).first())
  const lab = (key, bereich = D) => bereich().locator('label', { hasText: T(key) }).first()
  const tabNeu = (key) => D().getByRole('button', { name: M(key, true) }).first()
  await f.still('artikel-leer', () => menue('app.menu.tools.inventory'))
  await f.S('aus-plan', async () => {
    await klickLoc(D().getByRole('button', { name: M('inventory.seed') }))
    await pause(500)
    await a.klickText(/^(OK|Schließen|Close)$/).catch(() => {})
    await pause(500)
  })
  await f.S('artikel-formular', async () => {
    await klickLoc(D().getByRole('button', { name: M('inventory.add', true) }).last())
    await pause(400)
  })
  await f.S('artikel-ausgefuellt', async () => {
    await lab('inventory.model').locator('input').fill(zw('Beispiel-Kamerakoffer', 'Sample camera case'))
    await lab('inventory.manufacturer').locator('input').fill('Beispiel')
    await lab('inventory.category').locator('input').fill(zw('Zubehör', 'Accessories'))
    await lab('inventory.quantity').locator('input').fill('3')
    await lab('inventory.rentPrice').locator('input').fill('12')
    await lab('inventory.code').locator('input').fill('INV-00123')
    await pause(400)
  })
  await f.S('artikel-gespeichert', async () => {
    await klickLoc(D().getByRole('button', { name: M('common.save', true) }).last())
    await pause(600)
  })
  await f.still('lagerorte', () => reiter('inventory.tabLocations'))
  await f.S('lagerort-formular', async () => {
    await klickLoc(D().getByRole('button', { name: M('inventory.addNode', true) }))
    await lab('inventory.nodeName').locator('input').fill(zw('Depot Nord', 'North depot'))
    await pause(300)
  })
  await f.S('lagerort-gespeichert', async () => {
    await klickLoc(D().getByRole('button', { name: M('common.save', true) }).last())
    await klickLoc(D().getByRole('button', { name: M('inventory.addNode', true) }))
    await lab('inventory.nodeName').locator('input').fill(zw('Case 1', 'Case 1'))
    await waehle(lab('inventory.nodeKind').locator('select'), /Case$/)
    await waehle(lab('inventory.nodeParent').locator('select'), /Depot/)
    await klickLoc(D().getByRole('button', { name: M('common.save', true) }).last())
    await pause(500)
  })
  await f.still('einheiten', () => reiter('inventory.tabUnits'))
  await f.S('einheit-formular', async () => {
    await klickLoc(D().getByRole('button', { name: M('inventory.addUnit', true) }))
    await pause(400)
  })
  await f.S('einheit-ausgefuellt', async () => {
    await lab('inventory.serial').locator('input').fill('SN-0001')
    await lab('inventory.houseRef').locator('input').fill('AV-0421')
    await lab('inventory.purchase').locator('input').fill('1890')
    await lab('inventory.insuredValue').locator('input').fill('1500')
    await pause(300)
  })
  await f.S('einheit-gespeichert', async () => {
    await klickLoc(D().getByRole('button', { name: M('common.save', true) }).last())
    await pause(600)
  })
  await f.still('sets', () => reiter('inventory.tabSets'))
  await f.S('set-formular', async () => {
    await klickLoc(D().getByRole('button', { name: M('inventory.addSet', true) }))
    await lab('inventory.setName').locator('input').fill(zw('Kamera-Kit', 'Camera kit'))
    await pause(300)
  })
  await f.still('ausgabe', () => reiter('inventory.tabCheckout'))
  await f.S('ausgabe-container', async () => {
    await waehle(D().locator('select').first(), /Case 1/)
    await D().getByPlaceholder(M('inventory.checkout.to')).fill(zw('LKW 1', 'Truck 1')).catch(() => {})
    await pause(500)
  })
  await f.S('labels', () => reiter('inventory.tabLabels'))
  await f.S('auswertung', () => reiter('inventory.tabReports'))
})

// ═══════════════════════════════════════════════════════════════════════════
// GERÄTE-KONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
const waehleKnoten = async (name) => {
  await knoten(name).click({ position: { x: 24, y: 10 } })
  await pause(800)
}
const inspKarte = (key) => insp().getByRole('button', { name: M(key) }).first()

abschnitt('atem-mv', async () => {
  const f = neueFolge('atem-mv')
  await f.S('ohne-atem', () => werkzeug('atemMv'))
  await a.zu()
  await lege('ATEM', 'Constellation HD')
  await f.S('auswahl', () => werkzeug('atemMv'))
  await f.S('editor', () => klickLoc(D().getByRole('button', { name: /Constellation HD/ })))
  await f.S('quelle-waehlen', async () => {
    await D().locator('button[title*="klicken zum Ändern"]').first().click().catch(() => {})
    await pause(600)
  }, { ziel: FENSTER })
  await f.S('quelle-gesetzt', async () => {
    await w.locator('div.fixed.z-\\[60\\] button', { hasText: /Media Player 1/ }).first().click()
    await pause(600)
  })
  await f.S('viertel', async () => {
    await D().getByLabel(M('atem.mv.quadToggleAria').source.replace(/.*Toggle quadrant.*/, ''), { exact: false }).first().click().catch(() => {})
    await D().locator('button[aria-label]').filter({ hasText: /→/ }).nth(2).click()
    await pause(600)
  })
  await f.still('zweiter-mv', async () => {
    await klickLoc(D().getByTitle(T('atem.mv.addMv')))
  })
  await f.S('faehigkeiten', async () => {
    await klickLoc(D().getByRole('button', { name: M('atem.mv.capabilities') }))
  })
  await f.S('entwurf-gespeichert', async () => {
    await klickLoc(D().getByRole('button', { name: M('atem.mv.saveDraft', true) }))
    await pause(300)
  })
})

abschnitt('atem-audio', async () => {
  const f = neueFolge('atem-audio')
  await lege('ATEM', 'Constellation HD')
  await waehleKnoten('Constellation HD')
  const karte = () => insp().getByText(T('props.deviceKind.atem'), { exact: true }).locator('xpath=..')
  const werkzeuge = () => insp().getByText(T('props.deviceTools.title'), { exact: true }).locator('xpath=..')
  await f.S('karte', async () => {
    await karte().scrollIntoViewIfNeeded()
  }, { ziel: karte })
  await f.S('werkzeuge', async () => {
    await werkzeuge().scrollIntoViewIfNeeded()
  }, { ziel: werkzeuge })
  await f.S('leer', async () => {
    await klickLoc(inspKarte('props.deviceKind.atemAudio'))
    await pause(500)
  })
  await f.S('matrix', async () => {
    await klickLoc(D().getByRole('button', { name: M('atem.audio.matrixManual', true) }))
    await pause(700)
  })
  await f.S('kreuzung', async () => {
    await D().locator('td[title*="→"]').nth(30).click()
    await D().locator('td[title*="→"]').nth(95).click()
    await pause(400)
  })
  await f.S('filter', async () => {
    await D().getByPlaceholder(T('atem.audio.filterSourcesPlaceholder')).fill('Aux')
    await pause(500)
  })
  await f.S('quellen-auswahl', async () => {
    await D().getByPlaceholder(T('atem.audio.filterSourcesPlaceholder')).fill('')
    await klickLoc(D().getByRole('button', { name: M('atem.audio.sourcePicker') }))
    await pause(500)
  })
  await f.S('zuruecksetzen', async () => {
    await klickLoc(D().getByRole('button', { name: M('atem.audio.sourcePicker') }))
    await klickLoc(D().getByRole('button', { name: M('atem.audio.resetAllBtn', true) }))
    await pause(600)
  }, { ziel: () => w.locator('[role="dialog"], [role="alertdialog"]').last() })
})

abschnitt('atem-labels', async () => {
  const f = neueFolge('atem-labels')
  await lege('ATEM', 'Constellation HD')
  await waehleKnoten('Constellation HD')
  await f.S('offen', () => werkzeug('atemLabels'))
})

abschnitt('videohub', async () => {
  const f = neueFolge('videohub')
  await lege('Videohub', 'Smart Videohub 12x12')
  // Der Dialog ist höher als das Standardfenster; ohne Platz bleibt sein unterer Teil abgeschnitten.
  await w.setViewportSize({ width: 1600, height: 1500 })
  await pause(600)
  await f.S('offen', () => werkzeug('videohub'))
  await f.S('modell', async () => {
    const sel = D().locator('select').nth(1)
    await waehle(sel, /Smart Videohub 12G 12x12/)
  })
  await f.S('liste', async () => {
    await klickLoc(D().getByRole('button', { name: M('export.listToggle', true) }))
  })
  await f.S('matrix', async () => {
    await klickLoc(D().getByRole('button', { name: M('export.matrixToggle', true) }))
    await klickLoc(D().getByRole('button', { name: M('export.axisSwapOutIn') }))
  })
  await f.S('smart-routing', async () => {
    await klickLoc(D().getByRole('button', { name: M('export.smartRouting', true) }))
  })
  await f.S('salvo', async () => {
    await klickLoc(D().getByRole('button', { name: M('export.saveCurrentRouting') }))
    await pause(600)
  }, { ziel: () => w.locator('[role="dialog"], [role="alertdialog"]').last() })
  await f.S('salvo-gespeichert', async () => {
    await w.locator('[role="dialog"], [role="alertdialog"]').last().locator('input').fill(zw('Aufbau Tag 1', 'Setup day 1'))
    await klickLoc(w.locator('[role="dialog"], [role="alertdialog"]').last().getByRole('button', { name: /^OK$/ }))
    await pause(600)
  }, { ziel: () => w.locator('[role="dialog"]').first() })
  await f.S('nur-labels', async () => {
    await w.mouse.move(600, 12)
    await D().locator('select').nth(2).selectOption({ index: 1 })
    await pause(500)
  }, { ziel: () => w.locator('[role="dialog"]').first() })
  await f.still('datei', async () => {
    const n0 = (await downloads()).length
    await klickLoc(D().getByRole('button', { name: M('export.saveAsFile', true) }))
    await pause(1200)
    const neu = (await downloads()).slice(n0)
    extra.texte['videohub:datei-download'] = JSON.stringify(neu.map((d) => ({ name: d.name, type: d.type, size: d.size, text: d.text.slice(0, 800) })))
  })
  await w.setViewportSize({ width: 1600, height: 1100 })
})

abschnitt('greengo', async () => {
  const f = neueFolge('greengo')
  const GG = () => D().locator('xpath=./div').first()
  await lege('GreenGo', 'GreenGo MCX')
  const S = (n, tun) => f.S(n, tun, { ziel: GG })
  await S('uebersicht-leer', () => werkzeug('greengo'))
  await S('stationen', async () => {
    await klickLoc(D().getByRole('button', { name: M('greengo.tab.users') }))
    await klickLoc(D().getByRole('button', { name: M('greengo.addStation', true) }))
    await klickLoc(D().getByRole('button', { name: M('greengo.addStation', true) }))
  })
  await S('stationen-benannt', async () => {
    const felder = D().getByPlaceholder(T('greengo.users.namePlaceholder'))
    await felder.nth(0).fill(zw('Regie', 'Control room'))
    await felder.nth(1).fill(zw('Kamera 1', 'Camera 1'))
    await waehle(D().locator('select').first(), /GreenGo MCX/)
  })
  await S('gruppen', async () => {
    await klickLoc(D().getByRole('button', { name: M('greengo.tab.groups') }))
    await klickLoc(D().getByRole('button', { name: M('greengo.addGroup', true) }))
    await D().getByPlaceholder(T('greengo.groups.namePlaceholder')).first().fill('CAM')
  })
  await S('uebersicht', async () => {
    await klickLoc(D().getByRole('button', { name: M('greengo.tab.matrix') }))
    await D().locator('td button, button[title]').filter({ hasNot: w.locator('x-none') }).nth(0).hover().catch(() => {})
    const kreise = D().locator('table button')
    if (await kreise.count()) await kreise.first().click().catch(() => {})
    await pause(400)
  })
  await S('system', () => klickLoc(D().getByRole('button', { name: M('greengo.tab.system') })))
  await S('export', async () => {
    const n0 = (await downloads()).length
    await klickLoc(D().getByRole('button', { name: M('greengo.export.gg5', true) }))
    await pause(1200)
    await klickLoc(D().getByRole('button', { name: M('intercom.export.button', true) }))
    await pause(1200)
    const neu = (await downloads()).slice(n0)
    extra.texte['greengo:export-download'] = JSON.stringify(neu.map((d) => ({ name: d.name, type: d.type, size: d.size, text: d.text.slice(0, 500) })))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Lauf
// ═══════════════════════════════════════════════════════════════════════════
const ergebnisDatei = join(HIER, `werkzeuge-bauen.${sprache}.json`)
let bisher = { folgen: {}, extra: {} }
try {
  bisher = JSON.parse(readFileSync(ergebnisDatei, 'utf8'))
} catch {}
const speichern = () => {
  const out = { folgen: { ...(bisher.folgen ?? {}) }, extra: { ...(bisher.extra ?? {}) } }
  for (const [n, f] of Object.entries(folgen)) out.folgen[n] = { schritte: f.schritte, fehler: f.fehler }
  out.extra.texte = { ...(out.extra.texte ?? {}), ...extra.texte }
  out.extra.fehler = [...(out.extra.fehler ?? []).filter((x) => !nur || !nur.includes(x.split(':')[0])), ...extra.fehler]
  writeFileSync(ergebnisDatei, JSON.stringify(out, null, 2))
}
for (const [name, fn] of abschnitte) {
  if (nur && !nur.includes(name)) continue
  console.log(`── Abschnitt ${name}`)
  try {
    await frisch()
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
