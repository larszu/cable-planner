#!/usr/bin/env node
// Handbuch-Aufnahmen für das Kapitel „Geräte anlegen".
//
//   node scripts/handbuch/bereiche/geraet-anlegen.mjs de            (alles)
//   node scripts/handbuch/bereiche/geraet-anlegen.mjs en
//   node scripts/handbuch/bereiche/geraet-anlegen.mjs de C ga-test  (nur Teil C, Bilder mit Präfix ga-test)
//
// Drei Wege (A von Hand, B mit KI, C mit Rentman) plus D (aus der Bibliothek
// ziehen, duplizieren, ersetzen). Teile, die nicht gewählt sind, laufen
// stumm mit (ohne Bilder), damit der Zustand für die späteren Teile stimmt.
//
// SICHERHEIT / BEISPIELDATEN
// - Rentman: der Zugriff läuft im Hauptprozess (axios → https://api.rentman.net).
//   Die Basis-URL ist nicht einstellbar. Der Lauf lenkt deshalb `https.request`
//   im Hauptprozess für genau diesen Host auf einen Scheinserver auf 127.0.0.1
//   um und ersetzt `keytar` durch einen Speicher im Arbeitsspeicher: der echte
//   Schlüsselbund des Rechners wird weder gelesen noch beschrieben. Alle
//   Rentman-Daten sind erfunden („Beispiel …"), der Token ist `demo-token`.
// - KI: die Anbieter-Adressen sind fest. Im Fenster wird `fetch` für die drei
//   Anbieter-Hosts durch eine feste Beispielantwort ersetzt; es geht nichts
//   ins Netz. Der Schlüssel ist erfunden.
// - Kein Absenden an Rentman (Kabel/PDF): die Dialoge werden nur geöffnet.

import { starte } from '../app.mjs'
import http from 'node:http'
import { readFileSync, writeFileSync } from 'node:fs'

const sprache = process.argv[2] ?? 'de'
const TEIL = process.argv[3] ?? 'ABCD'
const PRAEFIX = process.argv[4] ?? 'geraet-anlegen'
const DE = sprache === 'de'
const werte = {}
const a = await starte({ sprache, breite: 1500, hoehe: 950, thema: 'light' })
const win = a.win
const f = a.folge(PRAEFIX)
const T = (k) => a.text(k)
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const nv = async (ms = 400) => win.waitForTimeout(ms)
const still = async (fn) => { try { return await fn() } catch (e) { console.log('  (still) ' + String(e.message).split('\n')[0]); return undefined } }

let aktiv = true
/** Schritt mit Bild – oder, wenn der Teil nicht gewählt ist, nur die Handlung. */
const texte = {}
const S = async (name, tun, opt = {}) => {
  if (aktiv) {
    await f.schritt(name, tun, opt)
    // Sichtbarer Text des fotografierten Bereichs, als Beleg für die Beschriftungen im Kapitel.
    await still(async () => {
      const z = typeof opt.ziel === 'function' ? opt.ziel() : opt.ziel
      if (z && typeof z.first === 'function' && z.first().innerText) texte[name] = (await z.first().innerText({ timeout: 2500 })).slice(0, 6000)
    })
    return
  }
  await still(async () => { if (tun) await tun(); await nv(300) })
}

// ─────────────────────────────────────────────────────────────────────────
// Scheinserver für Rentman (Beispieldaten)
// ─────────────────────────────────────────────────────────────────────────
const ordner = DE
  ? { video: 'Video', kabel: 'Kabel', zubehoer: 'Zubehör', audio: 'Audio' }
  : { video: 'Video', kabel: 'Cables', zubehoer: 'Accessories', audio: 'Audio' }
const PROJEKTE = [
  { id: 101, number: 2401, name: 'Beispiel Sommerfest', status: 'Confirmed', usageperiod_start: '2026-07-10T08:00:00', usageperiod_end: '2026-07-12T23:00:00' },
  { id: 102, number: 2402, name: 'Beispiel Firmenevent', status: 'Requested', usageperiod_start: '2026-09-20T08:00:00', usageperiod_end: '2026-09-21T23:00:00' },
  { id: 103, number: 2403, name: 'Beispiel Konferenz', status: 'Confirmed', usageperiod_start: '2026-11-05T08:00:00', usageperiod_end: '2026-11-06T23:00:00' },
]
const ORDNER = [
  { id: 1, name: ordner.video }, { id: 2, name: ordner.kabel }, { id: 3, name: ordner.zubehoer }, { id: 4, name: ordner.audio },
]
const F = (n) => `/equipmentfolders/${n}`
const STAMM = [
  { id: 9001, name: DE ? 'ATEM Mini Pro (Streaming-Mischer)' : 'ATEM Mini Pro (streaming switcher)', equipmentfolder: F(1), weight: 1.4, power_consumption: 20, price: 60 },
  { id: 9002, name: 'Beispiel Funkstrecke XY-100', equipmentfolder: F(4), weight: 0.8, price: 35 },
  { id: 9003, name: 'Beispiel Kamerapaket', equipmentfolder: F(1), is_physical: true },
  { id: 9004, name: 'Beispiel Kamera Body', equipmentfolder: F(1), weight: 2.1, power_consumption: 30 },
  { id: 9005, name: 'Beispiel Stativ', equipmentfolder: F(3), weight: 3.5 },
  { id: 9006, name: 'Beispiel Akku', equipmentfolder: F(3) },
  { id: 9007, name: 'BNC Kabel 5m', equipmentfolder: F(2) },
  { id: 9008, name: 'HDMI Kabel 10m', equipmentfolder: F(2) },
  { id: 9009, name: 'Beispielgerät Alpha', equipmentfolder: F(1) },
  { id: 9011, name: 'Beispiel Lichtset', equipmentfolder: F(3) },
  { id: 9012, name: 'Beispiel Scheinwerfer', equipmentfolder: F(3) },
  { id: 9013, name: 'Beispiel Netzteil', equipmentfolder: F(3) },
  { id: 9014, name: 'Beispielgerät Gamma', equipmentfolder: F(1) },
]
const ZEILEN = (id) => {
  const e = (nr, equipment, quantity, extra = {}) => ({ id: nr, equipment: `/equipment/${equipment}`, quantity, ...extra })
  if (id === '101') {
    return [
      e(5001, 9001, 1),
      e(5002, 9002, 2),
      e(5003, 9003, 1, { name: 'Beispiel Kamerapaket' }),
      e(5004, 9004, 1, { parent: '/projectequipment/5003' }),
      e(5005, 9005, 1, { parent: '/projectequipment/5003' }),
      e(5006, 9006, 2, { parent: '/projectequipment/5003' }),
      e(5007, 9007, 6),
      e(5008, 9007, 4),
      e(5009, 9008, 3),
      e(5010, 9009, 1),
      e(5015, 9014, 1),
      { id: 5011, name: DE ? 'Hinweis: Aufbau ab 8 Uhr' : 'Note: setup from 8 am', type: 'remark', quantity: 1 },
      e(5012, 9011, 1),
      e(5013, 9012, 2, { parent: '/projectequipment/5012' }),
      e(5014, 9013, 2, { parent: '/projectequipment/5012' }),
    ]
  }
  if (id === '102') return [e(5101, 9001, 1), e(5102, 9008, 2)]
  return [e(5201, 9002, 1)]
}
const anfragen = []
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  anfragen.push(`${req.method} ${url.pathname}`)
  res.setHeader('content-type', 'application/json')
  if (req.headers.authorization !== 'Bearer demo-token') {
    res.statusCode = 401
    return res.end(JSON.stringify({ error: 'Unauthorized (Beispielserver)' }))
  }
  if (req.method !== 'GET') {
    res.statusCode = 422
    return res.end(JSON.stringify({ error: 'Validation failed (Beispielserver)' }))
  }
  const offset = Number(url.searchParams.get('offset') ?? 0)
  const liste = (x) => res.end(JSON.stringify({ data: offset > 0 ? [] : x }))
  const p = url.pathname
  if (p === '/projects') return liste(PROJEKTE)
  let m
  if ((m = /^\/projects\/(\d+)\/projectequipment$/.exec(p))) return liste(ZEILEN(m[1]))
  if ((m = /^\/projects\/(\d+)\/subprojects$/.exec(p))) return liste([{ id: 1, name: 'Initial' }])
  if (p === '/equipment') return liste(STAMM)
  if (p === '/equipmentfolders') return liste(ORDNER)
  return liste([])
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const PORT = server.address().port

// Hauptprozess: Schlüsselbund im Speicher, Rentman-Host auf den Scheinserver.
await a.app.evaluate(async (_e, port) => {
  const gm = process.getBuiltinModule
  const req = gm('module').createRequire(process.cwd() + '/x.js')
  const k = req('keytar')
  const speicher = new Map()
  k.getPassword = async (s, n) => speicher.get(s + n) ?? null
  k.setPassword = async (s, n, p) => { speicher.set(s + n, p) }
  k.deletePassword = async (s, n) => speicher.delete(s + n)
  const https = gm('https')
  const http = gm('http')
  const orig = https.request
  https.request = function (o, ...rest) {
    const host = (o && (o.hostname || o.host)) || ''
    if (String(host).includes('api.rentman.net')) {
      return http.request({ ...o, protocol: 'http:', hostname: '127.0.0.1', host: '127.0.0.1', port, agent: undefined, agents: undefined }, ...rest)
    }
    return orig.call(this, o, ...rest)
  }
}, PORT)

// Fenster: Beispielantworten der KI-Anbieter.
await win.evaluate(() => {
  const FOTO = {
    manufacturer: 'Blackmagic Design', model: 'ATEM Mini Pro', modelSure: true,
    ports: [
      { direction: 'in', label: 'HDMI IN', count: 4, connector: 'HDMI', sure: true },
      { direction: 'out', label: 'HDMI OUT', count: 1, connector: 'HDMI', sure: true },
      { direction: 'bidirectional', label: 'ETHERNET', count: 1, connector: 'RJ45', sure: true },
      { direction: 'in', label: 'USB', count: 1, connector: 'USB-C', sure: false },
      { direction: 'unknown', label: 'AUX', count: 2, connector: 'Speakon NL4', sure: true },
      { direction: 'in', label: 'DC 12V', count: 1, connector: 'DC-Hohlstecker', sure: true },
    ],
  }
  const FILL = {
    ports: [
      { direction: 'in', label: 'HDMI In', count: 4, connector: 'HDMI' },
      { direction: 'out', label: 'HDMI Out', count: 1, connector: 'HDMI' },
      { direction: 'in', label: 'USB', count: 1, connector: 'USB' },
      { direction: 'in', label: 'Ethernet', count: 1, connector: 'Ethernet/RJ45' },
    ],
  }
  window.__ki = { verzoegerung: 0, status: 200, leer: false, aufrufe: [] }
  const echt = window.fetch.bind(window)
  window.fetch = async (url, opts = {}) => {
    const u = String(url)
    const anbieter = /anthropic/.test(u) ? 'claude' : /openai/.test(u) ? 'openai' : /generativelanguage/.test(u) ? 'gemini' : null
    if (!anbieter) return echt(url, opts)
    const body = String(opts.body ?? '')
    const foto = /"type":"image"|image_url|inline_data|inlineData/.test(body)
    window.__ki.aufrufe.push({ anbieter, foto })
    await new Promise((r) => setTimeout(r, window.__ki.verzoegerung))
    if (window.__ki.status !== 200) {
      return new Response(JSON.stringify({ error: { message: 'invalid x-api-key (Beispielantwort)' } }), { status: window.__ki.status })
    }
    const inhalt = foto ? (window.__ki.leer ? { manufacturer: null, model: null, modelSure: false, ports: [] } : FOTO) : FILL
    const text = JSON.stringify(inhalt)
    const antwort = anbieter === 'claude' ? { content: [{ type: 'text', text }] }
      : anbieter === 'openai' ? { choices: [{ message: { content: text } }] }
        : { candidates: [{ content: { parts: [{ text }] } }] }
    return new Response(JSON.stringify(antwort), { status: 200, headers: { 'content-type': 'application/json' } })
  }
})
// Beispielbild: Rückseite eines Geräts, mit Beschriftung gezeichnet.
const bildBase64 = await win.evaluate(() => {
  const c = document.createElement('canvas')
  c.width = 900; c.height = 300
  const g = c.getContext('2d')
  g.fillStyle = '#d9dde3'; g.fillRect(0, 0, 900, 300)
  g.fillStyle = '#2b3038'; g.fillRect(20, 20, 860, 260)
  g.fillStyle = '#e8ecf1'; g.font = 'bold 20px sans-serif'
  g.fillText('ATEM MINI PRO  (Beispielbild / sample image)', 40, 52)
  g.font = 'bold 14px sans-serif'
  const box = (x, y, w, h, label) => { g.strokeStyle = '#9aa4b2'; g.lineWidth = 3; g.strokeRect(x, y, w, h); g.fillStyle = '#e8ecf1'; g.fillText(label, x - 2, y + h + 22) }
  ;['1', '2', '3', '4'].forEach((n, i) => box(50 + i * 80, 100, 56, 30, 'HDMI IN ' + n))
  box(400, 100, 56, 30, 'HDMI OUT')
  box(500, 96, 40, 40, 'ETHERNET')
  box(590, 104, 44, 22, 'USB')
  ;[0, 1].forEach((i) => { g.beginPath(); g.arc(700 + i * 60, 116, 20, 0, 6.3); g.stroke(); g.fillText('AUX ' + (i + 1), 680 + i * 60, 160) })
  g.beginPath(); g.arc(820, 116, 14, 0, 6.3); g.stroke(); g.fillText('DC 12V', 796, 160)
  return c.toDataURL('image/png').split(',')[1]
})
const bildPuffer = Buffer.from(bildBase64, 'base64')

// ─────────────────────────────────────────────────────────────────────────
// Helfer
// ─────────────────────────────────────────────────────────────────────────
const bibliothek = () => win.locator('aside').first()
const inspektor = () => win.locator('aside').last()
const plusKnopf = () => win.locator(`button[title="${T('library.menus.plusTitle')}"]`)
const knoten = (name) => win.locator('.react-flow__node-equipment', { hasText: name }).first()
const kanvas = () => win.locator('.react-flow').first()
const suchfeld = () => bibliothek().getByPlaceholder(T('library.search.placeholder')).first()
const anlegenOeffnen = async () => {
  await a.zu()
  await still(() => a.klick('library.tab.equipment'))
  await plusKnopf().click()
  await nv(300)
  await a.klick('library.menus.newDevice')
  await nv(400)
}
const nameFeld = () => a.dialog().getByRole('textbox').first()
const knopf = (key) => a.dialog().getByRole('button', { name: new RegExp('^\\s*' + esc(T(key)).replace(/…$/, '') + '\\s*…?$') }).first()
/** Native Auswahllisten zeigt ein Screenshot nicht aufgeklappt; das Bild zeigt die Liste als Listenfeld mit allen Werten. */
const auswahlListe = async (name, sel, ziel, max = 40) => {
  const opts = await still(() => sel.evaluate((el) => [...el.options].map((o) => o.textContent.trim())))
  if (opts) werte[name] = opts
  await S(name, async () => {
    await sel.evaluate((el, m) => { el.setAttribute('size', String(Math.min(el.options.length, m))) }, max)
  }, { ziel })
  await still(() => sel.evaluate((el) => el.removeAttribute('size')))
}
const SLOT = { a: { x: 300, y: 470 }, t: { x: 640, y: 480 }, e: { x: 900, y: 520 } }
const verschiebe = async (name, slot) => {
  const b = await knoten(name).boundingBox()
  await win.mouse.move(b.x + 30, b.y + 14)
  await win.mouse.down()
  await win.mouse.move(slot.x + 30, slot.y + 14, { steps: 14 })
  await win.mouse.up()
  await nv(400)
}
const entfernen = async (name) => {
  await still(async () => {
    await knoten(name).click({ position: { x: 30, y: 14 } })
    await win.keyboard.press('Delete')
    await nv(500)
    if (await win.locator('[role="dialog"]').count()) {
      await a.dialog().getByRole('button', { name: new RegExp('^(' + esc(T('confirm.delete')) + '|Delete|Löschen)$') }).first().click()
      await nv(400)
    }
  })
}
const abschnitt = async (key) => {
  const s = inspektor().locator('summary', { hasText: T(key) }).first()
  await s.scrollIntoViewIfNeeded()
  const offen = await s.evaluate((el) => el.parentElement.open)
  if (!offen) await s.click()
  await nv(300)
}
/** Bild nur vom oberen Teil eines hohen Bereichs (Bibliotheksleiste): Ersatz für einen Locator, der das Ausschneiden übernimmt. */
const bereich = (loc, hoehe) => ({
  count: async () => 1,
  first: () => ({
    screenshot: async (opt) => {
      const b = await loc().boundingBox()
      return win.screenshot({ ...opt, clip: { x: b.x, y: b.y, width: b.width, height: Math.min(hoehe, b.height) } })
    },
  }),
})
const karte = (key) => a.dialog().getByText(T(key), { exact: true }).locator('xpath=..')
const rb = () => win.locator('[role="dialog"]').first().locator(':scope > div').first()
const foKopf = () => a.dialog().getByText(T('library.photo.heading'), { exact: true }).locator('xpath=..')
const dateiFeld = () => a.dialog().locator('input[type=file]').first()
const einstellungenOeffnen = async () => {
  await a.palette('palette.settings')
  await still(() => a.dialog().getByRole('button', { name: /^\s*(Integrationen|Integrations)\s*$/ }).first().click())
  await nv(700)
}

console.log(`\nGeräte anlegen (${sprache}, Teile ${TEIL}) – Scheinserver auf Port ${PORT}\n`)

// ═════════════════════════════════════════════════════════════════════════
// A — von Hand
// ═════════════════════════════════════════════════════════════════════════
aktiv = TEIL.includes('A')
await a.zu()
await S('a-bibliothek-geraete', () => a.klick('library.tab.equipment'), { ziel: () => bibliothek() })
await S('a-plus-menue', () => plusKnopf().click(), { ziel: () => a.menueFeld() })
await S('a-dialog-offen', () => a.klick('library.menus.newDevice'), { ziel: () => a.dialog() })
await S('a-name-treffer', () => nameFeld().fill('ATEM Mini'), { ziel: () => a.dialog() })
await S('a-als-vorlage', () => a.klick('library.create.preset.use'), { ziel: () => a.dialog() })
werte.vorlageText = await a.dialogText()
await still(() => knopf('common.cancel').click())
await nv(400)

await anlegenOeffnen()
await S('a-eigener-name', () => nameFeld().fill('Beispielgerät Alpha'), { ziel: () => a.dialog() })
const katSel = () => a.dialog().locator('select').first()
await auswahlListe('a-kategorie-liste', katSel(), () => a.dialog(), 60)
await S('a-kategorie-neu', () => katSel().selectOption('__new__'), { ziel: () => a.dialog() })
await still(async () => { await nv(500); await win.keyboard.press('Escape') })
await nv(400)
await S('a-kategorie-gewaehlt', async () => {
  const opts = await katSel().evaluate((el) => [...el.options].map((o) => ({ v: o.value, t: o.textContent.trim() })))
  const ziel = opts.find((o) => /audio/i.test(o.t)) ?? opts.find((o) => o.v && o.v !== '__new__' && o.v !== 'Cameras')
  werte.gewaehlteKategorie = ziel
  if (ziel) await katSel().selectOption(ziel.v)
}, { ziel: () => a.dialog() })
await S('a-rack-haken', async () => { await a.dialog().locator('input[type=checkbox]').first().check() }, { ziel: () => a.dialog() })
await S('a-rack-he', async () => { await a.dialog().locator('input[type=number]').first().fill('2') }, { ziel: () => a.dialog() })
await S('a-eingangsgruppe', () => a.klick('library.create.addInputGroup'), { ziel: () => a.dialog() })
const richtung = () => a.dialog().locator('select:has(option[value="in"]):has(option[value="out"])').first()
const stecker = () => a.dialog().locator('select:has(option[value="BNC"])').first()
await auswahlListe('a-richtung-liste', richtung(), () => a.dialog())
await auswahlListe('a-stecker-liste', stecker(), () => a.dialog(), 60)
await S('a-gruppe-ausgefuellt', async () => {
  await a.dialog().locator('input[type=number]').nth(1).fill('8')
  await stecker().selectOption('BNC')
  await a.dialog().getByPlaceholder(T('library.create.groupLabelPrefix')).first().fill('SDI In')
}, { ziel: () => a.dialog() })
await S('a-ausgangsgruppe', async () => {
  await a.klick('library.create.addOutputGroup')
  const zeile = a.dialog().locator('select:has(option[value="BNC"])').nth(1)
  await zeile.selectOption('HDMI')
  await a.dialog().locator('input[type=number]').nth(2).fill('2')
  await a.dialog().getByPlaceholder(T('library.create.groupLabelPrefix')).nth(1).fill('HDMI Out')
}, { ziel: () => a.dialog() })
await S('a-anzahl-leer', async () => { await a.dialog().locator('input[type=number]').nth(2).fill('') }, { ziel: () => a.dialog() })
await S('a-gruppe-entfernt', async () => {
  await a.dialog().locator('input[type=number]').nth(2).fill('2')
  await a.klick('library.create.addInputGroup')
  await nv(300)
  await a.dialog().locator(`button[title="${T('library.create.removeGroup')}"]`).last().click()
}, { ziel: () => a.dialog() })
await S('a-ausfuellen-web', async () => { await a.klick('library.create.fill'); await nv(2500) }, { ziel: () => a.dialog() })
werte.ausfuellenWebText = await a.dialogText()
await S('a-speichern-platzieren', async () => {
  await a.klick('library.create.savePlace')
  await nv(700)
  await verschiebe('Beispielgerät Alpha', SLOT.a)
}, {})
await S('a-bibliothek-suche', async () => { await suchfeld().fill('Beispielgerät Alpha') }, { ziel: () => bibliothek() })
await still(() => suchfeld().fill(''))

// Nur im Projekt platzieren
await anlegenOeffnen()
await nameFeld().fill('Beispielgerät Beta (Leihgerät)')
await S('a-nur-projekt-vorbereitet', () => a.klick('library.create.addInputGroup'), { ziel: () => a.dialog() })
await S('a-nur-projekt-platziert', async () => {
  await a.klick('library.create.placeOnly')
  await nv(700)
  await verschiebe('Beispielgerät Beta', SLOT.t)
}, {})
await S('a-nur-projekt-bibliothek', async () => { await suchfeld().fill('Beta') }, { ziel: () => bibliothek() })
await still(() => suchfeld().fill(''))
await entfernen('Beispielgerät Beta')

// Nur in Bibliothek speichern
await anlegenOeffnen()
await nameFeld().fill('Beispielgerät Gamma')
await S('a-nur-bibliothek', () => a.klick('library.create.save'), {})
await S('a-nur-bibliothek-suche', async () => { await suchfeld().fill('Gamma') }, { ziel: () => bibliothek() })
// Ein Gerät ohne Anschlüsse aus der Bibliothek auf den Canvas ziehen: der Anlegen-Dialog öffnet sich mit Name und Kategorie
await S('a-portlos-ziehen', async () => {
  await bibliothek().locator('[role=button][draggable=true]').last().dragTo(kanvas(), { targetPosition: { x: SLOT.t.x - 260, y: SLOT.t.y - 40 } })
  await nv(800)
}, { ziel: () => a.dialog() })
await S('a-portlos-platziert', async () => {
  await a.klick('library.create.savePlace')
  await nv(700)
}, {})
await entfernen('Beispielgerät Gamma')
await still(() => suchfeld().fill(''))

// Start nur mit Namen
await anlegenOeffnen()
await nameFeld().fill('Nur Name')
await S('a-nur-name', async () => {
  await a.klick('library.create.savePlace')
  await nv(700)
  await verschiebe('Nur Name', SLOT.t)
}, {})
await still(() => knoten('Nur Name').click({ position: { x: 30, y: 14 } }))
await S('a-nur-name-inspektor', () => nv(600), { ziel: () => inspektor() })

// Anschlüsse nachträglich im Inspektor ergänzen (am Gerät „Nur Name")
const portSel = (key) => inspektor().locator(`[aria-label="${T(key)}"]`)
await S('a-port-plus', async () => {
  await inspektor().getByRole('button', { name: T('ports.add') }).first().click()
  await nv(300)
  await inspektor().getByPlaceholder(T('ports.namePlaceholder')).last().fill('Videoeingang')
}, { ziel: () => inspektor() })
await auswahlListe('a-port-stecker-liste', portSel('ports.aria.connector').last(), () => inspektor(), 80)
await auswahlListe('a-port-signal-liste', portSel('ports.aria.signal').last(), () => inspektor(), 80)
await auswahlListe('a-port-richtung-liste', portSel('ports.aria.direction').last(), () => inspektor())
await auswahlListe('a-port-seite-liste', portSel('ports.aria.side').last(), () => inspektor())
await auswahlListe('a-port-gender-liste', portSel('ports.aria.gender').last(), () => inspektor())
await S('a-port-ausgefuellt', async () => {
  await portSel('ports.aria.connector').last().selectOption('BNC')
  await portSel('ports.aria.contentLabel').last().fill('PGM')
  await portSel('ports.aria.gender').last().selectOption('female')
  await nv(300)
}, { ziel: () => inspektor() })
await S('a-port-sdi', async () => {
  await inspektor().getByText(T('ports.sdi.caps')).first().click()
  await nv(300)
}, { ziel: () => inspektor() })
await S('a-port-gruppe-neu', async () => {
  await portSel('ports.group.aria').last().selectOption('__new__')
  await nv(300)
}, { ziel: () => inspektor() })
await auswahlListe('a-port-gruppe-art-liste', portSel('ports.group.kindAria').last(), () => inspektor())
await auswahlListe('a-port-gruppe-rolle-liste', portSel('ports.group.roleAria').last(), () => inspektor())
await S('a-port-zweiter', async () => {
  await inspektor().getByRole('button', { name: T('ports.add') }).first().click()
  await nv(300)
  await portSel('ports.aria.connector').last().selectOption('SFP+')
  await nv(300)
}, { ziel: () => inspektor() })
await S('a-port-ausgang', async () => {
  await inspektor().getByRole('button', { name: T('ports.add') }).last().click()
  await nv(300)
}, { ziel: () => inspektor() })
await S('a-port-entfernt', async () => {
  await inspektor().getByRole('button', { name: T('ports.remove') }).last().click()
  await nv(300)
}, { ziel: () => inspektor() })

// Weitere Angaben am platzierten Gerät (Abschnitte des Inspektors)
for (const [name, key] of [
  ['a-abschnitt-optional', 'opt.title'],
  ['a-abschnitt-strom', 'power.title'],
  ['a-abschnitt-masse', 'dims.title'],
  ['a-abschnitt-darstellung', 'flags.title'],
]) {
  await S(name, () => abschnitt(key), {
    ziel: () => inspektor().locator('details', { has: win.locator('summary', { hasText: T(key) }) }).first(),
  })
}
await entfernen('Nur Name')

// Rechtsklick auf freie Fläche
await a.zu()
await S('a-rechtsklick', async () => {
  await win.mouse.click(SLOT.t.x, SLOT.t.y, { button: 'right' })
}, { ziel: () => win.locator('div.fixed', { hasText: T('canvas.paneMenu.newDevice') }).last() })
await S('a-neues-geraet-hier', () => a.klick('canvas.paneMenu.newDevice'), { ziel: () => a.dialog() })
await nameFeld().fill('Beispielgerät Delta')
await S('a-hier-platziert', () => a.klick('library.create.savePlace'), {})
await entfernen('Beispielgerät Delta')

// Strg+= (Schnellanlage nur mit Namen)
await S('a-strg-gleich', async () => {
  await win.mouse.move(SLOT.e.x, SLOT.e.y)
  await win.keyboard.press('Control+=')
  await nv(600)
}, { ziel: () => a.dialog() })
await still(async () => {
  await a.dialog().getByRole('textbox').first().fill('Beispielgerät Epsilon')
  await win.keyboard.press('Enter')
  await nv(700)
})
await S('a-strg-gleich-ergebnis', () => nv(300), {})

// Kabelende auf ein Gerät fallenlassen
await a.zu()
await S('a-kabel-fallen', async () => {
  const quelle = knoten('Camera 2').locator('.react-flow__handle.source').first()
  const ziel = knoten('Beispielgerät Epsilon')
  const q = await quelle.boundingBox()
  const z = await ziel.boundingBox()
  await win.mouse.move(q.x + q.width / 2, q.y + q.height / 2)
  await win.mouse.down()
  await win.mouse.move(q.x + 60, q.y + 30, { steps: 6 })
  await win.mouse.move(z.x + z.width / 2, z.y + z.height / 2, { steps: 16 })
  await win.mouse.up()
  await nv(800)
}, { ziel: () => a.dialog() })
werte.kabelDialogText = await a.dialogText()
await still(async () => {
  const knoepfe = a.dialog().getByRole('button')
  const namen = await knoepfe.allInnerTexts()
  werte.kabelDialogKnoepfe = namen
  const cancel = new RegExp('^(' + esc(T('common.cancel')) + '|Cancel|Abbrechen)$', 'i')
  const ok = namen.map((n, i) => ({ n: n.trim(), i })).filter((x) => x.n && !cancel.test(x.n))
  if (ok.length) await knoepfe.nth(ok[ok.length - 1].i).click()
  await nv(700)
})
await S('a-kabel-ergebnis', () => nv(300), {})
await still(() => knoten('Beispielgerät Epsilon').click({ position: { x: 30, y: 14 } }))
await S('a-kabel-inspektor', () => nv(500), { ziel: () => inspektor() })

// Der Inspektor am Gerät nach dem Kabel-Drop
// ═════════════════════════════════════════════════════════════════════════
// D — Bibliothek → Canvas, duplizieren, ersetzen
// ═════════════════════════════════════════════════════════════════════════
aktiv = TEIL.includes('D')
await a.zu()
await S('d-bibliothek-suche', async () => { await suchfeld().fill('ATEM Mini Pro'); await nv(500) }, { ziel: () => bereich(bibliothek, 360) })
const eintrag = () => bibliothek().locator('[role=button][draggable=true]').filter({ hasText: /Blackmagic ATEM Mini Pro(?! ISO)/ }).first()
await S('d-klick-platziert', async () => {
  await eintrag().click()
  await nv(700)
  await verschiebe('Blackmagic ATEM Mini Pro', SLOT.t)
}, {})
await entfernen('Blackmagic ATEM Mini Pro')
await S('d-ziehen', async () => {
  await eintrag().dragTo(kanvas(), { targetPosition: { x: SLOT.t.x - 260, y: SLOT.t.y - 40 } })
  await nv(700)
}, {})
await entfernen('Blackmagic ATEM Mini Pro')
await still(() => suchfeld().fill(''))
await S('d-geteilt', () => win.getByRole('button', { name: new RegExp(esc(T('library.section.deviceLibrary'))) }).first().click(), { ziel: () => bereich(bibliothek, 420) })
await still(() => win.getByRole('button', { name: new RegExp('^\\s*L?\\s*' + esc(T('library.section.local'))) }).first().click())

await a.zu()
await still(() => knoten('Beispielgerät Alpha').click({ position: { x: 30, y: 14 } }))
await S('d-inline-werkzeugleiste', () => nv(400), {})
await S('d-bearbeiten-menue', () => a.menue('app.menu.edit'), { ziel: () => a.menueFeld() })
await S('d-duplizieren', async () => { await a.klick('app.menu.edit.duplicate'); await nv(700) }, {})
werte.duplikatKnoten = await win.locator('.react-flow__node-equipment').allInnerTexts().catch(() => [])
await still(async () => { await win.keyboard.press('Delete'); await nv(500) })

await a.zu()
await still(() => knoten('Beispielgerät Epsilon').click({ position: { x: 30, y: 14 } }))
await S('d-ersetzen-abschnitt', () => abschnitt('replaceDevice.title'), { ziel: () => inspektor() })
await S('d-ersetzen-liste', async () => {
  await inspektor().getByRole('button', { name: new RegExp(esc(T('replaceDevice.btn')).replace(/…$/, '')) }).first().click()
  await nv(400)
}, { ziel: () => inspektor() })
await S('d-ersetzen-suche', async () => {
  await inspektor().getByPlaceholder(T('replaceDevice.searchPlaceholder')).first().fill('ATEM Mini Pro')
  await nv(400)
}, { ziel: () => inspektor() })
await S('d-ersetzen-bestaetigen', async () => {
  await inspektor().getByRole('button', { name: /Blackmagic ATEM Mini Pro/ }).first().click()
  await nv(500)
}, { ziel: () => a.dialog() })
werte.ersetzenText = await a.dialogText()
await S('d-ersetzen-ergebnis', async () => {
  await a.dialog().getByRole('button', { name: T('replaceDevice.confirm.ok') }).first().click()
  await nv(700)
}, {})

// ═════════════════════════════════════════════════════════════════════════
// B — mit KI
// ═════════════════════════════════════════════════════════════════════════
aktiv = TEIL.includes('B')
await anlegenOeffnen()
await S('b-ohne-schluessel', () => nv(300), { ziel: () => a.dialog() })
await S('b-einstellungen-oeffnen', () => a.klick('library.photo.openSettings'), {})
await nv(700)
await S('b-quelle-karte', () => nv(300), { ziel: () => karte('settings.integrations.fill') })
await S('b-quelle-ki', async () => { await a.dialog().locator('input[name="ausfuell-quelle"]').nth(1).check() }, { ziel: () => karte('settings.integrations.fill') })
await S('b-anbieter-karte', () => nv(300), { ziel: () => karte('settings.integrations.ai') })
await S('b-anbieter-claude', async () => { await a.dialog().locator('input[name="ai-provider"]').nth(1).check() }, { ziel: () => karte('settings.integrations.ai') })
await still(async () => {
  await a.dialog().getByRole('button', { name: new RegExp('^(' + esc(T('common.close')) + '|Close|Schließen)$', 'i') }).first().click()
  await nv(500)
})
werte.dialogeNachSettings = await win.locator('[role="dialog"]').count()

await S('b-ausfuellen-ohne-schluessel', async () => {
  await nameFeld().fill('Beispielgerät Kappa')
  await a.klick('library.create.fill')
  await nv(600)
}, { ziel: () => a.dialog() })
await S('b-schluessel-eingetippt', async () => {
  await a.dialog().locator('input[type=password]').first().fill('sk-ant-DEMO-nicht-echt')
}, { ziel: () => a.dialog() })
await S('b-schluessel-gespeichert', async () => {
  const feld = a.dialog().locator('input[type=password]').first()
  await feld.locator('xpath=following-sibling::button[1]').click()
  await nv(500)
}, { ziel: () => a.dialog() })
await S('b-ausfuellen-ki', async () => { await a.klick('library.create.fill'); await nv(900) }, { ziel: () => a.dialog() })
await S('b-foto-feld', () => nv(300), { ziel: () => foKopf() })
await S('b-foto-gewaehlt', async () => {
  await dateiFeld().setInputFiles({ name: 'rueckseite.png', mimeType: 'image/png', buffer: bildPuffer })
  await nv(900)
}, { ziel: () => foKopf() })
await S('b-foto-einfuegen', async () => {
  await win.evaluate((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const dt = new DataTransfer(); dt.items.add(new File([bytes], 'zwischenablage.png', { type: 'image/png' }))
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, bildBase64)
  await nv(900)
}, { ziel: () => foKopf() })
const ereignisAmFeld = (art, b64, txt) => win.evaluate(([b64, txt, art]) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const dt = new DataTransfer(); dt.items.add(new File([bytes], 'ziehen.png', { type: 'image/png' }))
  const h = [...document.querySelectorAll('div')].find((d) => d.textContent === txt)
  h.parentElement.dispatchEvent(new DragEvent(art, { dataTransfer: dt, bubbles: true, cancelable: true }))
}, [b64, txt, art])
await S('b-foto-ziehen', async () => { await ereignisAmFeld('dragover', bildBase64, T('library.photo.heading')); await nv(300) }, { ziel: () => foKopf() })
await S('b-foto-abgelegt', async () => { await ereignisAmFeld('drop', bildBase64, T('library.photo.heading')); await nv(1000) }, { ziel: () => foKopf() })
await S('b-foto-entfernt', async () => {
  await a.dialog().getByRole('button', { name: T('library.photo.remove') }).last().click()
  await nv(300)
}, { ziel: () => foKopf() })
await S('b-foto-behalten', async () => { await a.dialog().getByLabel(T('library.photo.keep')).check() }, { ziel: () => foKopf() })
await win.evaluate(() => { window.__ki.verzoegerung = 1500 })
await S('b-erkennen-laeuft', async () => {
  await a.dialog().getByRole('button', { name: T('library.photo.run') }).first().click()
  await nv(300)
}, { ziel: () => foKopf() })
await nv(2200)
await win.evaluate(() => { window.__ki.verzoegerung = 0 })
await S('b-vorschlag', () => nv(300), { ziel: () => foKopf() })
werte.vorschlagText = await foKopf().innerText().catch(() => '')
await auswahlListe('b-richtung-liste', foKopf().locator(`select[aria-label="${T('library.photo.direction')}"]`).first(), () => foKopf())
await auswahlListe('b-stecker-liste', foKopf().locator(`select[aria-label="${T('library.photo.connector')}"]`).first(), () => foKopf(), 60)
await S('b-zeile-abgewaehlt', async () => {
  await foKopf().getByRole('checkbox', { name: T('library.photo.include') }).nth(1).uncheck()
  await foKopf().locator(`input[aria-label="${T('library.photo.count')}"]`).first().fill('3')
}, { ziel: () => foKopf() })
await S('b-zeile-unsichere-anhaken', async () => {
  await foKopf().getByRole('checkbox', { name: T('library.photo.include') }).nth(3).check()
}, { ziel: () => foKopf() })
await S('b-uebernehmen', async () => {
  await foKopf().getByRole('button', { name: new RegExp('^' + esc(T('library.photo.apply')).replace('\\{n\\}', '\\d+')) }).first().click()
  await nv(500)
}, { ziel: () => a.dialog() })
await S('b-speichern-mit-fotos', async () => {
  await a.klick('library.create.savePlace')
  await nv(700)
}, {})
await still(() => knoten('Beispielgerät Kappa').click({ position: { x: 30, y: 14 } }))
await S('b-inspektor-fotos', () => abschnitt('foto.section'), { ziel: () => inspektor() })
await entfernen('Beispielgerät Kappa')

await anlegenOeffnen()
await still(async () => {
  await dateiFeld().setInputFiles({ name: 'rueckseite.png', mimeType: 'image/png', buffer: bildPuffer })
  await nv(700)
  await a.dialog().getByRole('button', { name: T('library.photo.run') }).first().click()
  await nv(1200)
})
await S('b-katalogtreffer', () => nv(300), { ziel: () => foKopf() })
await S('b-katalog-platziert', async () => {
  await a.dialog().getByRole('button', { name: T('library.photo.useCatalogue') }).first().click()
  await nv(700)
}, {})
await entfernen('Blackmagic ATEM Mini Pro')

// Ports vorschlagen am platzierten Gerät (Inspektor)
await anlegenOeffnen()
await nameFeld().fill('Beispielgerät Eta')
await still(() => a.klick('library.create.placeOnly'))
await nv(700)
await verschiebe('Beispielgerät Eta', SLOT.t).catch(() => {})
await still(() => knoten('Beispielgerät Eta').click({ position: { x: 30, y: 14 } }))
await S('b-inspektor-vorschlag-knopf', () => nv(500), { ziel: () => inspektor() })
await S('b-inspektor-vorschlag', async () => {
  await inspektor().getByRole('button', { name: T('props.aiPorts.suggest') }).first().click()
  await nv(1200)
}, { ziel: () => inspektor() })
await S('b-inspektor-uebernommen', async () => {
  await inspektor().getByRole('button', { name: T('props.aiPorts.adopt') }).first().click()
  await nv(500)
}, { ziel: () => inspektor() })
await entfernen('Beispielgerät Eta')

await anlegenOeffnen()
await still(async () => {
  await dateiFeld().setInputFiles({ name: 'rueckseite.png', mimeType: 'image/png', buffer: bildPuffer })
  await nv(700)
  await win.evaluate(() => { window.__ki.leer = true })
  await a.dialog().getByRole('button', { name: T('library.photo.run') }).first().click()
  await nv(900)
})
await S('b-nichts-erkannt', () => nv(200), { ziel: () => foKopf() })
await still(async () => {
  await win.evaluate(() => { window.__ki.leer = false; window.__ki.status = 401 })
  await a.dialog().getByRole('button', { name: T('library.photo.run') }).first().click()
  await nv(900)
})
await S('b-fehler-anbieter', () => nv(200), { ziel: () => foKopf() })
await win.evaluate(() => { window.__ki.status = 200 })
await a.zu()

// ═════════════════════════════════════════════════════════════════════════
// C — Rentman
// ═════════════════════════════════════════════════════════════════════════
aktiv = TEIL.includes('C')
await einstellungenOeffnen()
await S('c-integrationen-rentman-schalter', () => nv(200), { ziel: () => karte('settings.integrations.rentmanToggle.title') })
await S('c-token-karte', () => nv(200), { ziel: () => karte('settings.integrations.rentman') })
await S('c-token-eingetippt', async () => {
  await karte('settings.integrations.rentman').locator('input[type=password]').first().fill('demo-token')
}, { ziel: () => karte('settings.integrations.rentman') })
await S('c-token-gespeichert', async () => {
  await karte('settings.integrations.rentman').getByRole('button', { name: T('settings.integrations.rentman.save') }).click()
  await nv(700)
}, { ziel: () => karte('settings.integrations.rentman') })
await S('c-verbindung-getestet', async () => {
  await karte('settings.integrations.rentman').getByRole('button', { name: T('settings.integrations.rentman.test') }).click()
  await nv(2500)
}, { ziel: () => karte('settings.integrations.rentman') })
await S('c-projekt-verknuepfen-karte', () => nv(200), { ziel: () => karte('settings.integrations.linkedRentman') })
await a.zu()

await S('c-menue-datei', () => a.menue('app.menu.file'), { ziel: () => a.menueFeld() })
await S('c-import-offen', async () => {
  await a.klick('app.menu.tools.rentmanImport')
  await nv(2500)
}, { ziel: () => rb() })
await S('c-sortieren-datum', async () => { await rb().getByRole('button', { name: /Date ↓|Datum ↓/ }).first().click() }, { ziel: () => rb() })
await S('c-suche', async () => { await rb().getByPlaceholder(T('rentman.import.searchPlaceholder')).fill('Sommer') }, { ziel: () => rb() })
await S('c-suche-leeren', async () => { await rb().getByRole('button', { name: T('rentman.import.clearSearch') }).click() }, { ziel: () => rb() })
await S('c-projekt-gewaehlt', async () => {
  await rb().getByRole('option', { name: /Sommerfest/ }).first().click()
  await nv(2500)
}, { ziel: () => rb() })
await S('c-lager-abgleich', () => nv(200), { ziel: () => rb() })
await S('c-kategorien-filter', async () => {
  await rb().getByRole('button', { name: ordner.video, exact: true }).first().click()
}, { ziel: () => rb() })
await S('c-kategorien-alle', async () => { await rb().getByRole('button', { name: T('rentman.import.categoriesAll'), exact: true }).click() }, { ziel: () => rb() })
await S('c-alle-auswaehlen', async () => { await rb().getByRole('button', { name: T('rentman.checklist.selectAll'), exact: true }).click() }, { ziel: () => rb() })
await S('c-sets-aufklappen', async () => { await rb().getByRole('button', { name: T('rentman.checklist.expandAll'), exact: true }).click() }, { ziel: () => rb() })
await S('c-nur-hauptgeraet', async () => { await rb().getByRole('button', { name: T('rentman.checklist.mainOnly') }).first().click() }, { ziel: () => rb() })
await S('c-als-rack', async () => { await rb().getByRole('button', { name: T('rentman.checklist.asRackOff') }).first().click() }, { ziel: () => rb() })
await S('c-lokal-verknuepfen', async () => {
  const s = rb().locator('label', { hasText: 'ATEM Mini Pro' }).first().locator('xpath=..').locator('select')
  await s.selectOption({ label: 'Vision mixer' })
}, { ziel: () => rb() })
await S('c-kabelmengen', async () => {
  await rb().getByRole('button', { name: new RegExp(esc(T('rentman.import.cablePlan.headingN')).replace('\\{count\\}', '\\d+')) }).first().click()
  await nv(300)
}, { ziel: () => rb() })
await S('c-kabel-gewaehlt', async () => {
  await rb().getByRole('button', { name: T('rentman.import.cablePlan.selectAll'), exact: true }).click()
}, { ziel: () => rb() })
await S('c-kabel-uebernommen', async () => {
  await rb().getByRole('button', { name: T('rentman.import.cablePlan.apply'), exact: true }).click()
  await nv(400)
}, { ziel: () => rb() })
await S('c-alle-abwaehlen', async () => { await rb().getByRole('button', { name: T('rentman.checklist.deselectAll'), exact: true }).click() }, { ziel: () => rb() })
await S('c-auswahl-fuer-import', async () => {
  for (const n of [DE ? 'ATEM Mini Pro (Streaming-Mischer)' : 'ATEM Mini Pro (streaming switcher)', 'Beispielgerät Alpha', 'Beispielgerät Gamma', 'Beispiel Funkstrecke XY-100', 'Beispiel Kamerapaket', 'Beispiel Kamera Body', 'Beispiel Stativ', 'Beispiel Akku']) {
    await rb().locator('label', { hasText: n }).first().locator('input[type=checkbox]').first().check()
  }
}, { ziel: () => rb() })
await S('c-zur-bibliothek', async () => {
  await rb().getByRole('button', { name: new RegExp('^(' + esc(T('rentman.import.addToLibraryN')).replace('\\{count\\}', '\\d+') + ')') }).first().click()
  await nv(700)
}, { ziel: () => rb() })
await S('c-kategorie-neu', async () => {
  await rb().getByRole('button', { name: T('rentman.import.catMap.newCategoryShort') }).first().click()
  await nv(500)
}, { ziel: () => a.dialog() })
await still(async () => { await win.keyboard.press('Escape'); await nv(400) })
await S('c-kategorien-weiter', async () => {
  await rb().getByRole('button', { name: T('rentman.import.next'), exact: true }).click()
  await nv(800)
}, { ziel: () => rb() })
werte.konfliktText = await a.dialogText()
await S('c-konflikt-verknuepfen', async () => {
  await rb().getByLabel(T('rentman.import.action.link')).last().check()
  await nv(300)
}, { ziel: () => rb() })
await S('c-konflikt-verknuepfen-gewaehlt', async () => {
  const sel = rb().locator('select').last()
  const wert = await sel.evaluate((el) => [...el.options].find((o) => /^Blackmagic ATEM Mini Pro \(/.test(o.textContent.trim()))?.value)
  if (wert) await sel.selectOption(wert)
}, { ziel: () => rb() })
await S('c-konflikt-alle-rentman', async () => { await rb().getByRole('button', { name: T('rentman.import.bulk.overwrite'), exact: true }).click() }, { ziel: () => rb() })
await S('c-konflikt-alle-lokal', async () => { await rb().getByRole('button', { name: T('rentman.import.bulk.keep'), exact: true }).click() }, { ziel: () => rb() })
await S('c-konflikt-alle-ueberspringen', async () => { await rb().getByRole('button', { name: T('rentman.import.bulk.skip'), exact: true }).click() }, { ziel: () => rb() })
await S('c-konflikt-zusammenfuehren', async () => {
  await rb().getByLabel(T('rentman.import.action.merge')).first().check()
  await rb().getByLabel(T('rentman.import.action.link')).last().check()
  const sel = rb().locator('select').last()
  const wert = await sel.evaluate((el) => [...el.options].find((o) => /^Blackmagic ATEM Mini Pro \(/.test(o.textContent.trim()))?.value)
  if (wert) await sel.selectOption(wert)
}, { ziel: () => rb() })
await S('c-konflikt-weiter', async () => {
  await rb().getByRole('button', { name: T('rentman.import.next'), exact: true }).click()
  await nv(900)
}, { ziel: () => a.dialog() })
werte.nachKonfliktText = await a.dialogText()

// Zusammenführen (Merge-Dialog), dann der Assistent für unbekannte Geräte
await S('c-zusammenfuehren', () => nv(300), { ziel: () => a.dialog() })
await S('c-zusammenfuehren-gespeichert', async () => {
  await a.dialog().getByRole('button', { name: T('templateMerge.save'), exact: true }).click()
  await nv(900)
}, { ziel: () => a.dialog() })
werte.assistentText = await a.dialogText()
const wizardOffen = () => win.getByText(T('rentman.wizard.cancelImport'), { exact: true }).count()
await S('c-assistent-auf', () => nv(200), { ziel: () => a.dialog() })
await S('c-assistent-ausfuellen', async () => { await a.klick('rentman.wizard.fill'); await nv(2500) }, { ziel: () => a.dialog() })
await S('c-assistent-ki-einstellungen', async () => { await a.klick('rentman.wizard.aiSettings'); await nv(400) }, { ziel: () => a.dialog() })
await S('c-assistent-gruppen', async () => {
  await a.dialog().getByRole('button', { name: T('common.cancel'), exact: true }).first().click()
  await a.klick('rentman.wizard.addInputGroup')
  await a.klick('rentman.wizard.addOutputGroup')
  await a.dialog().locator('select:has(option[value="BNC"])').first().selectOption('XLR')
  await a.dialog().getByPlaceholder(T('rentman.wizard.labelPrefixPlaceholder')).first().fill('Audio In')
  await a.dialog().getByPlaceholder(T('rentman.wizard.labelPrefixPlaceholder')).nth(1).fill('Audio Out')
}, { ziel: () => a.dialog() })
await S('c-assistent-speichern', async () => { await a.klick('rentman.wizard.saveNext'); await nv(500) }, { ziel: () => a.dialog() })
await S('c-assistent-generisch', async () => { await a.klick('rentman.wizard.skip'); await nv(500) }, { ziel: () => a.dialog() })
await S('c-assistent-nicht-importieren', async () => { await a.klick('rentman.wizard.exclude'); await nv(500) }, { ziel: () => a.dialog() })
for (let i = 0; i < 8 && (await wizardOffen()) > 0; i += 1) {
  await still(async () => {
    const letzte = await win.getByRole('button', { name: T('rentman.wizard.saveFinish') }).count()
    await a.klick(letzte ? 'rentman.wizard.saveFinish' : 'rentman.wizard.skip')
    await nv(400)
  })
}
await S('c-ergebnis', () => nv(100), { ziel: () => rb() })
await nv(2500)

// Bibliothek → Rentman
await a.zu()
await S('c-bibliothek-rentman', async () => {
  await win.locator(`button[title="${T('library.section.rentmanTitle')}"]`).first().click()
  await nv(500)
}, { ziel: () => bereich(bibliothek, 700) })
await S('c-bibliothek-projekt-aufklappen', async () => {
  const kopf = bibliothek().getByRole('button', { name: /Sommerfest/ }).first()
  if (await kopf.count()) { /* schon offen oder zu: nichts */ }
  await nv(200)
}, { ziel: () => bereich(bibliothek, 700) })
await S('c-bibliothek-katalog', async () => {
  await bibliothek().getByRole('button', { name: T('library.rentman.view.catalog'), exact: true }).click()
  await nv(400)
}, { ziel: () => bereich(bibliothek, 500) })
await S('c-bibliothek-katalog-laden', async () => {
  await bibliothek().getByRole('button', { name: new RegExp(esc(T('library.rentman.catalogLoad'))) }).first().click()
  await nv(2200)
}, { ziel: () => bereich(bibliothek, 700) })
await S('c-bibliothek-abgleich', async () => {
  await bibliothek().getByRole('button', { name: T('library.rentman.view.sync'), exact: true }).click()
  await nv(400)
}, { ziel: () => bereich(bibliothek, 700) })
await still(() => win.locator(`button[title="${T('library.section.localTitle')}"]`).first().click())

// Projektwechsel (Rückfrage), Kabel an Rentman (nur Dialog), Plan anhängen (nur beschreiben)
await S('c-menue-datei-verknuepft', () => a.menue('app.menu.file'), { ziel: () => a.menueFeld() })
await S('c-kabel-export-dialog', async () => {
  await a.klick('app.menu.file.cablesRentman')
  await nv(1500)
}, { ziel: () => a.dialog() })
werte.kabelExportText = await a.dialogText()
await a.zu()
await S('c-erneut-oeffnen', async () => {
  await a.menue('app.menu.file', 'app.menu.tools.rentmanImport')
  await nv(3000)
}, { ziel: () => rb() })
await S('c-projekt-aendern', async () => { await rb().getByRole('button', { name: T('rentman.import.changeProject'), exact: true }).click(); await nv(300) }, { ziel: () => rb() })
await S('c-projekt-wechsel-rueckfrage', async () => {
  await rb().getByRole('option', { name: /Firmenevent/ }).first().click()
  await nv(600)
}, { ziel: () => rb() })
await S('c-projekt-gewechselt', async () => {
  await rb().getByRole('button', { name: T('rentman.import.switch.confirm') }).click()
  await nv(2500)
}, { ziel: () => rb() })
await a.zu()

// ─── Abschluss
f.speichern(new URL(`./${PRAEFIX}.${sprache}.json`, import.meta.url))
const json = JSON.parse(readFileSync(new URL(`./${PRAEFIX}.${sprache}.json`, import.meta.url), 'utf8'))
json.werte = werte
json.texte = texte
json.rentmanAnfragen = [...new Set(anfragen)]
writeFileSync(new URL(`./${PRAEFIX}.${sprache}.json`, import.meta.url), JSON.stringify(json, null, 2))
await a.ende()
server.close()
console.log('FERTIG')
