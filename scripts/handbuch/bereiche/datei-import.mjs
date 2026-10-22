// Kapitel datei-import: Datei-Menü, erster Teil.
//
// Menü, Neues Projekt, Vorlagen, Öffnen/Speichern, yEd/GraphML, MultiCam-
// Kameras, CSV, NetBox, .avplan, Identitäts-Karte, verknüpfte Venue-Planung,
// Plan-Stände vergleichen, Revisionen, Sicherungskopie in der Statusleiste.
//
// Aufruf: node scripts/handbuch/bereiche/datei-import.mjs de|en
//
// Vorkehrungen (nur für die Aufnahme, kein App-Code wird geändert):
// - Betriebssystem-Dateidialoge liefern feste Wegwerf-Pfade in einem
//   Temp-Ordner (Öffnen/Speichern/GraphML/Vergleich).
// - Downloads der App (.avplan, .avsourcemap, CSV) werden im Fenster
//   abgefangen und als Datei abgelegt.
// - NetBox: die drei Abruf-Kanäle im Hauptprozess liefern Beispieldaten. Es
//   gibt keine Verbindung und keinen Schlüsselbund-Zugriff.
// - Alle Dateien (GraphML, Kamera-Listen, .avplan, .avsourcemap, CSV) sind
//   erfundene Beispieldaten.

import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import http from 'node:http'
import { join } from 'node:path'
import { starte } from '../app.mjs'
import { erststartOverlayWeg } from '../../lib/erststartOverlay.mjs'

const sprache = process.argv[2] ?? 'de'
const a = await starte({ sprache, hoehe: 1200 })
// Alte Bilder dieses Kapitels weg: verschobene Nummern lassen sonst Waisen liegen.
{
  const dir = new URL('../../../docs/manual/bilder/' + sprache + '/', import.meta.url)
  if (!process.env.NUR) for (const d of readdirSync(dir)) if (d.startsWith('datei-import-')) rmSync(new URL(d, dir))
}
const f = a.folge('datei-import')
const W = mkdtempSync(join(tmpdir(), 'cp-handbuch-di-'))
const fakten = { sprache, dateien: {}, gelesen: {} }
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const T = (k) => a.text(k)
const pause = (ms) => a.win.waitForTimeout(ms)
a.win.setDefaultTimeout(10_000)
const abschnitt = async (name, fn) => {
  if (process.env.NUR && !name.startsWith(process.env.NUR + ' ')) return
  try { await fn() } catch (e) { console.log(`!! Abschnitt ${name}: ${e.message.split('\n')[0]} @ ${(e.stack.match(/datei-import\.mjs:\d+/) ?? [''])[0]}`); await a.win.screenshot({ path: '/private/tmp/claude-501/-Users-larszumpe/ceacdd93-efce-4876-ad48-3f9bc7cb94a7/scratchpad/di-fehler.png' }).catch(() => {}); (fakten.abschnittFehler ??= []).push(`${name}: ${e.message.split('\n')[0]}`) }
  await a.zu().catch(() => {})
}

// ── Vorkehrungen ───────────────────────────────────────────────────────────
await a.win.evaluate(() => {
  window.__dl = []
  const blobs = new Map()
  const erzeugen = URL.createObjectURL
  URL.createObjectURL = (b) => { const u = erzeugen.call(URL, b); blobs.set(u, b); return u }
  const orig = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (this.download && blobs.has(this.href)) {
      const name = this.download
      blobs.get(this.href).text().then((t) => window.__dl.push({ name, text: t }))
      return
    }
    return orig.call(this)
  }
})
const downloads = async () => {
  const dl = await a.win.evaluate(() => { const x = window.__dl; window.__dl = []; return x })
  for (const d of dl) { writeFileSync(join(W, d.name), d.text); fakten.dateien[d.name] = d.text.length }
  return dl
}
const oeffnenMit = (pfad) =>
  a.app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = async () => (p ? { canceled: false, filePaths: [p] } : { canceled: true, filePaths: [] })
  }, pfad ?? null)
const speichernMit = (pfad) =>
  a.app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = async () => (p ? { canceled: false, filePath: p } : { canceled: true, filePath: undefined })
  }, pfad ?? null)
const schreibe = (name, inhalt) => {
  const p = join(W, name)
  writeFileSync(p, typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt, null, 2))
  return p
}

// ── Kleine Helfer ──────────────────────────────────────────────────────────
const knopf = (schl, genau = true) => a.dialog().getByRole('button', { name: a.muster(schl, genau) }).first()
const klickKnopf = (schl, genau = true) => knopf(schl, genau).click()
const ok = () => klickKnopf('common.ok')
const okS = () => ok().catch(() => {})
const menuEintrag = (schl) => a.win.getByRole('menuitem', { name: a.muster(schl) }).first()
const hover = async (schl) => { await a.menue('app.menu.file'); await menuEintrag(schl).hover(); await pause(300) }
const canvas = () => a.win.locator('.react-flow').first()
const fussleiste = () => a.win.locator('footer').first()
const datei = (name) => (path) => a.win.locator(`input[type=file][accept="${name}"]`).setInputFiles(path)
const kameraDatei = datei('.cameras.json,.json')
const avplanDatei = datei('.avplan,.json')
const sourceMapDatei = datei('.avsourcemap,.json')
const einpassen = async () => { await a.menue('app.menu.view', 'app.menu.view.fit'); await pause(700) }
// Schritte, die das Kapitel nicht abbildet: sie laufen ohne Bild, weil spätere Schritte auf ihrem Ergebnis aufbauen.
const KEIN_BILD = new Set(["speichern-unter", "speichern-erneut", "speichern-unter-zweiter-name", "oeffnen-geladen", "oeffnen-ladebericht", "graphml-andere-datei", "graphml-erneut-gewaehlt", "graphml-import-knopf", "graphml-ersetzen-ergebnis", "graphml-bibliothek-hinweis", "csv-abbrechen", "multicam-canvas", "netbox-zurueck", "netbox-hinzufuegen", "netbox-dritter-lauf-nichts-mehr", "avplan-import-kameras-uebernommen", "karte-export", "statusleiste-wieder-normal", "vorlagen-as-built-name", "vorlagen-as-built-gespeichert", "vorlage-ob-van", "vorlage-tv-studio", "vorlage-live-buehne", "vorlage-konferenz", "vorlage-gottesdienst", "neu-projekt-angelegt", "rentman-menue-verknuepft"])
const schritt = (name, tun, opt) => (KEIN_BILD.has(name) ? Promise.resolve(tun()).catch(() => {}) : f.schritt(name, tun, opt))
const dlg = () => a.dialog()
const nurTitel = (key) => a.win.getByRole('dialog').filter({ hasText: T(key) }).last()

const planA = join(W, 'beispielplan.cableplan')
const planB = join(W, 'beispielplan-kopie.cableplan')
let planZ = null

// ── Beispieldaten ──────────────────────────────────────────────────────────
const graphml = () => {
  const node = (id, x, y, w, h, text) =>
    `<node id="${id}"><data key="d0"><y:ShapeNode><y:Geometry height="${h}" width="${w}" x="${x}" y="${y}"/>` +
    (text ? `<y:NodeLabel>${text}</y:NodeLabel>` : '') + `</y:ShapeNode></data></node>`
  const edge = (id, s, t, typ, laenge, signal) =>
    `<edge id="${id}" source="${s}" target="${t}"><data key="d1"><y:PolyLineEdge><y:Path sx="0" sy="0" tx="0" ty="0"/></y:PolyLineEdge></data>` +
    (typ ? `<data key="d3">${typ}</data>` : '') + (laenge ? `<data key="d4">${laenge}</data>` : '') +
    (signal ? `<data key="d5">${signal}</data>` : '') + `</edge>`
  return `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:y="http://www.yworks.com/xml/graphml">
<key id="d0" for="node" yfiles.type="nodegraphics"/>
<key id="d1" for="edge" yfiles.type="edgegraphics"/>
<key id="d3" for="edge" attr.name="CableType" attr.type="string"/>
<key id="d4" for="edge" attr.name="CableLength" attr.type="string"/>
<key id="d5" for="edge" attr.name="SignalName" attr.type="string"/>
<graph id="G" edgedefault="directed">
${node('cam', 0, 0, 200, 100, 'Kamera 1')}
${node('camIp', 10, 60, 120, 30, 'IP: 10.0.0.11')}
${node('camOut', 200, 20, 90, 20, '12G-SDI Out')}
${node('mix', 500, 0, 300, 140, 'Bildmischer')}
${node('mixIp', 510, 100, 140, 30, 'IP: 10.0.0.20')}
${node('mixIn1', 410, 20, 90, 20, '3G/SDI In 1')}
${node('mixIn2', 410, 40, 90, 20, '3G/SDI In 2')}
${node('mixOut', 800, 20, 100, 20, '3G/SDI Out 1')}
${node('mon', 1100, 0, 200, 80, 'Monitor Regie')}
${node('monIn', 1010, 20, 90, 20, 'HDMI In')}
${node('legende', 0, 300, 200, 100, 'Legende')}
${edge('e1', 'camOut', 'mixIn1', 'SDI', '25 m', 'CAM1')}
${edge('e2', 'mixOut', 'monIn', 'HDMI', '5 m', 'PGM')}
${edge('e3', 'legende', 'camOut', '', '', '')}
</graph></graphml>`
}
const csvText = [
  'Name;Kategorie;Leistung;Gewicht;Seriennummer;IP;HE;Hersteller;Verantwortlich;Kundennotiz;Name',
  'ATEM Mini Pro;Mischer;30;1,1;SN123;192.168.1.50;1;Blackmagic;Meyer;Vorne links;X1',
  'Monitor 24;Monitore;45;3,2;;;;Eizo;;;',
  ';Kabel;;;;;;;;;',
  'Monitor 24;Monitore;;;;;;;;;',
].join('\n')
const kameras = (arr) => ({
  kind: 'camera-list', formatVersion: 3, app: 'multicam-planner', appVersion: '1.0.0',
  exportedAt: '2026-09-01T10:00:00.000Z', projectId: 'beispielplan', cameras: arr,
})
const kam1 = { id: 'c1', label: 'Kamera Buehne', manufacturer: 'Sony', model: 'PMW-F55', x: 5, y: 7 }
const kam2 = { id: 'c2', label: 'Kamera Saal', manufacturer: 'Unbekannt', model: 'Mystery 9000', x: 2, y: 3 }
const kam3 = { id: 'c3', label: 'Kamera Galerie', manufacturer: 'Unbekannt', model: 'Mystery 9000', x: 9, y: 3 }

const gmlDatei = schreibe('beispiel.graphml', graphml())
const kaputt = schreibe('kaputt.graphml', 'das ist kein xml <<<')

const nb = {
  sites: [
    { id: 1, name: 'Studio A', display: 'Studio A', device_count: 3, rack_count: 1 },
    { id: 2, name: 'OB-Van', display: 'OB-Van', device_count: 0, rack_count: 0 },
  ],
  racks: [{ id: 10, name: 'Rack A1', display: 'Rack A1', site: { id: 1, name: 'Studio A' }, u_height: 42, device_count: 3 }],
  devices: [
    { id: 100, name: 'core-sw-01', device_type: { model: 'GS724T', manufacturer: { name: 'Netgear' }, u_height: 1 }, role: { name: 'Switch', slug: 'switch' }, site: { id: 1, name: 'Studio A' }, rack: { id: 10, name: 'Rack A1' }, position: 20, face: { value: 'front' }, primary_ip4: { address: '10.10.0.2/24' }, serial: 'NG-4711', asset_tag: 'A-001' },
    { id: 101, name: 'enc-01', device_type: { model: 'Encoder X', manufacturer: { name: 'Beispiel' }, u_height: 1 }, role: { name: 'Video encoder', slug: 'video-encoder' }, site: { id: 1, name: 'Studio A' }, rack: { id: 10, name: 'Rack A1' }, position: 21 },
    { id: 102, name: 'regie-pc', device_type: { model: 'Workstation', manufacturer: { name: 'Beispiel' }, u_height: 2 }, role: { name: 'Workstation', slug: 'workstation' }, site: { id: 1, name: 'Studio A' }, rack: { id: 10, name: 'Rack A1' }, position: 22 },
  ],
  components: {
    interface: [
      { id: 1001, name: 'ge1', device: { id: 100 }, type: { value: '1000base-t' }, cable: { id: 500 } },
      { id: 1002, name: 'ge2', device: { id: 100 }, type: { value: '1000base-t' }, cable: { id: 501 } },
      { id: 1003, name: 'ge3', device: { id: 100 }, type: { value: '1000base-t' }, cable: { id: 502 } },
      { id: 1004, name: 'ge4', device: { id: 100 }, type: { value: '1000base-t' }, cable: null },
      { id: 1011, name: 'eth0', device: { id: 101 }, type: { value: '1000base-t' }, cable: { id: 500 } },
      { id: 1021, name: 'eth0', device: { id: 102 }, type: { value: '1000base-t' }, cable: { id: 501 } },
    ],
  },
  cables: [
    { id: 500, label: 'K-500', type: 'cat6', color: '2196f3', length: 3, length_unit: { value: 'm' }, a_terminations: [{ object_type: 'dcim.interface', object_id: 1001, object: { id: 1001, device: { id: 100 } } }], b_terminations: [{ object_type: 'dcim.interface', object_id: 1011, object: { id: 1011, device: { id: 101 } } }] },
    { id: 501, label: 'K-501', type: 'cat6', color: 'f44336', length: 5, length_unit: { value: 'm' }, a_terminations: [{ object_type: 'dcim.interface', object_id: 1002, object: { id: 1002, device: { id: 100 } } }], b_terminations: [{ object_type: 'dcim.interface', object_id: 1021, object: { id: 1021, device: { id: 102 } } }] },
    { id: 502, label: 'K-502', type: 'cat6', a_terminations: [{ object_type: 'dcim.interface', object_id: 1003, object: { id: 1003, device: { id: 100 } } }], b_terminations: [{ object_type: 'dcim.interface', object_id: 9999, object: { id: 9999, device: { id: 999 } } }] },
  ],
}
await a.app.evaluate(({ ipcMain }, d) => {
  globalThis.__nb = d
  for (const ch of ['netbox:get-sites', 'netbox:get-racks', 'netbox:fetch-snapshot']) {
    try { ipcMain.removeHandler(ch) } catch { /* nichts registriert */ }
  }
  ipcMain.handle('netbox:get-sites', async () => globalThis.__nb.sites)
  ipcMain.handle('netbox:get-racks', async (_e, _u, siteId) => globalThis.__nb.racks.filter((r) => r.site.id === siteId))
  ipcMain.handle('netbox:fetch-snapshot', async (_e, _u, scope, id) => {
    const n = globalThis.__nb
    const rack = n.racks.find((r) => r.id === id)
    const devices = scope === 'rack' ? n.devices.filter((x) => x.rack && x.rack.id === id) : n.devices.filter((x) => x.site && x.site.id === id)
    const ids = new Set(devices.map((x) => x.id))
    const components = {}
    for (const [k, v] of Object.entries(n.components)) components[k] = v.filter((c) => ids.has(c.device.id))
    const site = scope === 'rack' ? n.sites.find((s) => s.id === (rack && rack.site.id)) : n.sites.find((s) => s.id === id)
    return {
      scope, scopeId: id,
      scopeName: scope === 'rack' ? (rack && rack.name) : (site && site.name),
      siteName: site ? site.name : '',
      racks: scope === 'rack' ? [rack] : n.racks.filter((r) => r.site.id === id),
      devices, components, cables: n.cables, netboxVersion: '4.1.0',
    }
  })
}, nb)


// ── Rentman: Beispieldaten über einen Scheinserver auf 127.0.0.1 (nichts geht ins Netz) ──
const DE = sprache === 'de'
const win = a.win
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
// ════════════════════════════════════════════════════════════════════════
// 1  Das Datei-Menü
// ════════════════════════════════════════════════════════════════════════
await abschnitt('1  Das Datei-Menü', async () => {
await schritt('menue-datei-offen', () => a.menue('app.menu.file'), { ziel: () => a.menueFeld() })
fakten.gelesen.menueDatei = (await a.menueFeld().innerText()).split('\n').filter(Boolean)

})
// ════════════════════════════════════════════════════════════════════════
// 1b  Vorlagen-Dialog vorab (ohne As-Built, ohne eigene Vorlagen)
// ════════════════════════════════════════════════════════════════════════
await abschnitt('1b  Vorlagen vorab', async () => {
const oberster = () => a.win.getByRole('dialog').last()
await schritt('vorlagen-dialog', () => a.menue('app.menu.file', 'app.menu.file.newFromTemplate'), { ziel: () => dlg() })
await schritt('vorlagen-as-built-frage', async () => { await klickKnopf('templates.promote', false); await pause(500) }, { ziel: () => oberster() })
await oberster().getByRole('textbox').fill('Test')
await schritt('vorlagen-as-built-abgelehnt', async () => { await oberster().getByRole('button', { name: a.muster('common.ok', true) }).click(); await pause(900) }, { ziel: () => oberster() })
})
// ════════════════════════════════════════════════════════════════════════
// 2  Projektdatei: Speichern, Speichern unter, Sicherungskopie, Öffnen
// ════════════════════════════════════════════════════════════════════════
await abschnitt('2  Projektdatei: Speichern, Speichern unter, Sicherungskopie, Öffnen', async () => {
await speichernMit(planA)
await schritt('speichern-unter', async () => { await a.menue('app.menu.file', 'app.menu.file.saveAs'); await pause(1200) }, { ziel: () => a.win.locator('header').first() })
await schritt('speichern-erneut', async () => { await a.menue('app.menu.file', 'app.menu.file.save'); await pause(1200) }, { ziel: () => a.win.locator('header').first() })
fakten.dateien['nach-speichern'] = readdirSync(W).sort()
fakten.gelesen.projektSchluessel = Object.keys(JSON.parse(readFileSync(planA, 'utf8')))
fakten.gelesen.metadata = JSON.parse(readFileSync(planA, 'utf8')).metadata
await speichernMit(planB)
await schritt('speichern-unter-zweiter-name', async () => { await a.menue('app.menu.file', 'app.menu.file.saveAs'); await pause(1200) }, { ziel: () => a.win.locator('header').first() })
fakten.dateien['nach-speichern-unter'] = readdirSync(W).sort()

// Öffnen: Beispieldatei mit Zugangsdaten an einem Gerät (für den .avplan-Export)
const mitZugang = JSON.parse(readFileSync(planA, 'utf8'))
mitZugang.equipment[0].username = 'admin'
mitZugang.equipment[0].password = 'beispiel'
mitZugang.metadata.siteAddress = 'Beispielstrasse 1, 12345 Beispielstadt'
planZ = schreibe('mit-zugangsdaten.cableplan', mitZugang)
await oeffnenMit(planZ)
await schritt('oeffnen-geladen', async () => { await a.menue('app.menu.file', 'app.menu.file.open'); await pause(1500) }, { ziel: () => canvas() })
await oeffnenMit(schreibe('kein-plan.cableplan', { hallo: 'welt' }))
await schritt('oeffnen-kein-plan', async () => { await a.menue('app.menu.file', 'app.menu.file.open'); await pause(1200) }, { ziel: () => dlg() })
await okS()
const viewerDatei = JSON.parse(readFileSync(planA, 'utf8'))
viewerDatei.mode = 'viewer'
await oeffnenMit(schreibe('pruefung.cpviewer', viewerDatei))
await schritt('oeffnen-viewer-name', async () => { await a.menue('app.menu.file', 'app.menu.file.open'); await pause(1200) }, { ziel: () => dlg() })
await schritt('oeffnen-viewer-name-leer', async () => { await dlg().getByRole('button', { name: a.muster('common.ok', true) }).click(); await pause(800) }, { ziel: () => dlg() })
await a.zu()
const luecken = JSON.parse(readFileSync(planA, 'utf8'))
luecken.sourceIdentities = [{ id: 'r1' }, { id: 'r2', name: 'Kamera 1' }]
await oeffnenMit(schreibe('mit-luecken.cableplan', luecken))
await schritt('oeffnen-ladebericht', async () => { await a.menue('app.menu.file', 'app.menu.file.open'); await pause(1500) }, { ziel: () => a.win.getByRole('status').first() })
fakten.gelesen.ladebericht = await a.win.getByRole('status').first().innerText().catch(() => '')
await a.win.getByRole('status').first().getByRole('button').first().click().catch(() => {})
await oeffnenMit(planZ)
await a.menue('app.menu.file', 'app.menu.file.open')
await pause(1500)
await a.zu()

})
// ════════════════════════════════════════════════════════════════════════
// 3  yEd / GraphML
// ════════════════════════════════════════════════════════════════════════
await abschnitt('3  yEd / GraphML', async () => {
await oeffnenMit(gmlDatei)
await schritt('graphml-dialog-leer', () => a.menue('app.menu.file', 'app.menu.file.importGraphml'), { ziel: () => dlg() })
await schritt('graphml-vorschau-yed', () => klickKnopf('graphml.dialog.pickFile', false), { ziel: () => dlg() })
const tab = (schl) => dlg().getByRole('button', { name: new RegExp('^\\s*' + esc(T(schl))) }).first()
await schritt('graphml-reiter-geraete', () => tab('graphml.dialog.tab.devices').click(), { ziel: () => dlg() })
await schritt('graphml-geraet-abgewaehlt', () => dlg().getByRole('checkbox', { name: /Monitor/ }).first().uncheck(), { ziel: () => dlg() })
await schritt('graphml-geraet-umbenannt', async () => {
  const zeile = dlg().locator('tr', { hasText: '10.0.0.11' }).first()
  await zeile.locator('input[type=text]').nth(0).fill('Kamera 1 (Buehne)')
  await zeile.locator('input[type=text]').nth(1).fill('Kameras')
}, { ziel: () => dlg() })
await schritt('graphml-reiter-kabel', () => tab('graphml.dialog.tab.cables').click(), { ziel: () => dlg() })
await schritt('graphml-kabel-abgewaehlt', () => dlg().locator('tbody input[type=checkbox]').nth(1).uncheck(), { ziel: () => dlg() })
await schritt('graphml-filter', () => dlg().getByPlaceholder(a.muster('graphml.dialog.filterPlaceholder')).fill('HDMI'), { ziel: () => dlg() })
await schritt('graphml-reiter-uebersprungen', async () => {
  await dlg().getByPlaceholder(a.muster('graphml.dialog.filterPlaceholder')).fill('')
  await tab('graphml.dialog.tab.skipped').click()
}, { ziel: () => dlg() })
await schritt('graphml-ziel-bibliothek', async () => {
  await tab('graphml.dialog.tab.devices').click()
  await dlg().getByRole('button', { name: a.muster('graphml.dialog.library', true) }).first().click()
}, { ziel: () => dlg() })
await schritt('graphml-ziel-canvas-ersetzen', async () => {
  await dlg().getByRole('button', { name: a.muster('graphml.dialog.canvas', true) }).first().click()
  await dlg().getByRole('button', { name: a.muster('graphml.dialog.replaceImport', true) }).first().click()
}, { ziel: () => dlg() })
await schritt('graphml-andere-datei', async () => {
  await dlg().getByRole('button', { name: a.muster('graphml.dialog.otherFile', true) }).first().click()
}, { ziel: () => dlg() })
await schritt('graphml-erneut-gewaehlt', async () => {
  await klickKnopf('graphml.dialog.pickFile', false)
  await pause(800)
  await dlg().getByRole('button', { name: a.muster('graphml.dialog.appendProject', true) }).first().click()
}, { ziel: () => dlg() })
const pickFileNeu = async () => {
  // Ein per Esc oder Hintergrund geschlossener Import-Dialog behält seine Vorschau; „Andere Datei“ setzt zurück.
  const anderes = dlg().getByRole('button', { name: a.muster('graphml.dialog.otherFile', true) })
  if (await anderes.count()) { await anderes.first().click(); await pause(300) }
  await klickKnopf('graphml.dialog.pickFile', false)
}
await schritt('graphml-hintergrund-rueckfrage', async () => { await a.win.mouse.click(5, 5); await pause(600) }, { ziel: () => dlg() })
await a.win.getByRole('button', { name: /^(Verwerfen|Discard)$/ }).last().click()
await pause(600)
await a.zu()
// Import ausführen: Canvas, anhängen
await a.menue('app.menu.file', 'app.menu.file.importGraphml')
await pickFileNeu()
await pause(800)
await schritt('graphml-import-knopf', async () => { /* nur Bild */ }, { ziel: () => dlg() })
await schritt('graphml-import-ergebnis', async () => { await dlg().locator('button').last().click(); await pause(1200) }, { ziel: () => canvas() })
// Ersetzen
await a.menue('app.menu.file', 'app.menu.file.importGraphml')
await pickFileNeu()
await pause(800)
await dlg().getByRole('button', { name: a.muster('graphml.dialog.replaceImport', true) }).first().click()
await schritt('graphml-ersetzen-ergebnis', async () => { await dlg().locator('button').last().click(); await pause(1200) }, { ziel: () => canvas() })
// Bibliothek
await a.menue('app.menu.file', 'app.menu.file.importGraphml')
await pickFileNeu()
await pause(800)
await dlg().getByRole('button', { name: a.muster('graphml.dialog.library', true) }).first().click()
await schritt('graphml-bibliothek-hinweis', async () => { /* nur Bild */ }, { ziel: () => dlg() })
await schritt('graphml-bibliothek-ergebnis', async () => { await dlg().locator('button').last().click(); await pause(1200) }, { ziel: () => dlg() })
await okS()
await a.zu()
// Bibliothek ein zweites Mal: Namen bestehen schon
await a.menue('app.menu.file', 'app.menu.file.importGraphml')
await pickFileNeu()
await pause(800)
await dlg().getByRole('button', { name: a.muster('graphml.dialog.library', true) }).first().click()
await schritt('graphml-bibliothek-zweites-mal', async () => { await dlg().locator('button').last().click(); await pause(1200) }, { ziel: () => dlg() })
await okS()
await a.zu()
// Fehlerfall
await oeffnenMit(kaputt)
await a.menue('app.menu.file', 'app.menu.file.importGraphml')
await schritt('graphml-datei-ohne-inhalt', () => klickKnopf('graphml.dialog.pickFile', false), { ziel: () => dlg() })
await a.zu()
await oeffnenMit(planZ)

})
// ════════════════════════════════════════════════════════════════════════
// 4  Equipment aus CSV
// ════════════════════════════════════════════════════════════════════════
await abschnitt('4  Equipment aus CSV', async () => {
await schritt('csv-dialog-leer', () => a.menue('app.menu.file', 'app.menu.tools.csvImport'), { ziel: () => dlg() })
await schritt('csv-eingefuegt', () => dlg().getByRole('textbox').first().fill(csvText), { ziel: () => dlg() })
await schritt('csv-import-ergebnis', async () => { await dlg().locator('button').last().click(); await pause(1000) }, { ziel: () => dlg() })
await okS()
await schritt('csv-in-bibliothek', async () => {
  const bibl = a.win.locator('aside:has(.spaltenkopf)').first()
  await bibl.getByRole('textbox').first().fill('ATEM Mini Pro')
  await pause(800)
}, { ziel: () => a.win.locator('aside:has(.spaltenkopf)').first() })
await a.win.locator('aside:has(.spaltenkopf)').first().getByRole('textbox').first().fill('').catch(() => {})
await a.menue('app.menu.file', 'app.menu.tools.csvImport')
await dlg().getByRole('textbox').first().fill(csvText)
await pause(500)
await schritt('csv-zweiter-import-vorhanden', async () => { /* nur Bild */ }, { ziel: () => dlg() })
await a.zu()
await a.menue('app.menu.file', 'app.menu.tools.csvImport')
const csvDatei = schreibe('geraete.csv', 'Bezeichnung,Typ,W,kg\nVideohub 12x12,Router,20,1.5\n')
await schritt('csv-datei-gewaehlt', async () => { await dlg().locator('input[type=file]').setInputFiles(csvDatei); await pause(800) }, { ziel: () => dlg() })
await schritt('csv-abbrechen', () => klickKnopf('common.cancel'), { ziel: () => canvas() })
await a.zu()

})
// ════════════════════════════════════════════════════════════════════════
// 5  MultiCam-Kameras
// ════════════════════════════════════════════════════════════════════════
await abschnitt('5  MultiCam-Kameras', async () => {
await schritt('multicam-erster-import', async () => { await kameraDatei(schreibe('kameras.cameras.json', kameras([kam1, kam2]))); await pause(1200) }, { ziel: () => dlg() })
await okS()
await einpassen()
await schritt('multicam-canvas', async () => { /* nur Bild */ }, { ziel: () => canvas() })
await schritt('multicam-zweiter-import', async () => {
  await kameraDatei(schreibe('kameras-2.cameras.json', kameras([{ ...kam1, label: 'Kamera Buehne links' }, kam3])))
  await pause(1200)
}, { ziel: () => dlg() })
await okS()
await schritt('multicam-fehler', async () => { await kameraDatei(schreibe('falsch.cameras.json', { foo: 1 })); await pause(1200) }, { ziel: () => dlg() })
await okS()
await a.zu()

})
// ════════════════════════════════════════════════════════════════════════
// 6  Rentman (nur der Menüeintrag) und NetBox
// ════════════════════════════════════════════════════════════════════════
await abschnitt('6  Rentman (nur der Menüeintrag) und NetBox', async () => {
await schritt('netbox-ohne-url', () => a.menue('app.menu.file', 'app.menu.tools.netboxImport'), { ziel: () => dlg() })
await a.zu()
// URL in den Einstellungen hinterlegen (Beispieladresse, wird nie aufgerufen)
await a.klick('settings.title')
await pause(600)
await a.klickText(/Integrationen|Integrations/)
await pause(600)
const urlFeld = dlg().locator('input[placeholder="https://netbox.firma.de"]')
await urlFeld.fill('https://netbox.example.test')
await dlg().locator('input[placeholder="https://netbox.firma.de"] ~ button').click()
await pause(900)
await a.zu()
await schritt('netbox-dialog-auswahl', () => a.menue('app.menu.file', 'app.menu.tools.netboxImport'), { ziel: () => dlg() })
await schritt('netbox-standort-gewaehlt', async () => { await dlg().locator('select').first().selectOption({ index: 1 }); await pause(800) }, { ziel: () => dlg() })
await schritt('netbox-rack-gewaehlt', async () => { await dlg().locator('select').nth(1).selectOption({ index: 1 }); await pause(500) }, { ziel: () => dlg() })
await schritt('netbox-optionen-aus', async () => {
  const boxen = dlg().locator('fieldset input[type=checkbox]')
  for (let i = 0; i < 3; i += 1) await boxen.nth(i).uncheck()
}, { ziel: () => dlg() })
await schritt('netbox-optionen-ein', async () => {
  const boxen = dlg().locator('fieldset input[type=checkbox]')
  for (let i = 0; i < 3; i += 1) await boxen.nth(i).check()
  await dlg().locator('select').nth(1).selectOption({ index: 0 })
}, { ziel: () => dlg() })
await schritt('netbox-vorschau', async () => { await dlg().locator('button').last().click(); await pause(1500) }, { ziel: () => dlg() })
await schritt('netbox-vorschau-uebersprungen', async () => { await dlg().locator('summary').first().click() }, { ziel: () => dlg() })
await schritt('netbox-zurueck', () => klickKnopf('common.back'), { ziel: () => dlg() })
await schritt('netbox-hinzufuegen', async () => {
  await dlg().locator('button').last().click(); await pause(1500)
  await dlg().locator('button').last().click(); await pause(1500)
  await einpassen()
}, { ziel: () => canvas() })
// Zweiter Lauf: Quelle verknüpft, ein neues Gerät in NetBox
await a.app.evaluate(({}, extra) => { globalThis.__nb.devices.push(extra.dev); globalThis.__nb.components.interface.push(extra.ifc) }, {
  dev: { id: 103, name: 'ptz-01', device_type: { model: 'PTZ', manufacturer: { name: 'Beispiel' }, u_height: 0 }, role: { name: 'Camera', slug: 'camera' }, site: { id: 1, name: 'Studio A' }, rack: { id: 10, name: 'Rack A1' } },
  ifc: { id: 1031, name: 'eth0', device: { id: 103 }, type: { value: '1000base-t' }, cable: { id: 503 } },
})
await a.app.evaluate(({}, k) => { globalThis.__nb.cables.push(k) }, {
  id: 503, label: 'K-503', type: 'cat6', a_terminations: [{ object_type: 'dcim.interface', object_id: 1031, object: { id: 1031, device: { id: 103 } } }], b_terminations: [{ object_type: 'dcim.interface', object_id: 1004, object: { id: 1004, device: { id: 100 } } }],
})
await schritt('netbox-zweiter-lauf-verknuepft', () => a.menue('app.menu.file', 'app.menu.tools.netboxImport'), { ziel: () => dlg() })
await schritt('netbox-zweiter-lauf-delta', async () => { await dlg().locator('button').last().click(); await pause(1500) }, { ziel: () => dlg() })
await a.zu()
await a.app.evaluate(({}, k) => { globalThis.__nb.devices.pop(); globalThis.__nb.components.interface.pop(); globalThis.__nb.cables.pop() }, 0)
await a.menue('app.menu.file', 'app.menu.tools.netboxImport')
await dlg().locator('button').last().click()
await pause(1500)
await schritt('netbox-dritter-lauf-nichts-mehr', async () => { /* nur Bild */ }, { ziel: () => dlg() })
await a.zu()

})
// ════════════════════════════════════════════════════════════════════════
// 7  Gesamtprojekt (.avplan)
// ════════════════════════════════════════════════════════════════════════
await abschnitt('7  Gesamtprojekt (.avplan)', async () => {
await schritt('avplan-export-zugangsdaten-frage', async () => { await a.menue('app.menu.file', 'app.menu.file.exportAvplan'); await pause(800) }, { ziel: () => dlg() })
await klickKnopf('cred.strip')
await pause(1200)
const dl1 = await downloads()
const ap = JSON.parse((dl1.find((d) => d.name.endsWith('.avplan')) ?? { text: '{}' }).text)
fakten.gelesen.avplanSchluessel = Object.keys(ap)
fakten.gelesen.avplanDomains = Object.keys(ap.domains ?? {})
fakten.gelesen.avplanDateiname = (dl1.find((d) => d.name.endsWith('.avplan')) ?? {}).name
fakten.gelesen.avplanMetaKeys = { kind: ap.kind, formatVersion: ap.formatVersion, app: ap.app }
const apMit = JSON.parse(JSON.stringify(ap))
apMit.venue = { name: 'Stadthalle Nord', widthM: 30, heightM: 20, persons: [{}, {}, {}], walls: [{}, {}, {}, {}], stageObjects: [{}] }
apMit.domains.cameras = { cameras: [{ id: 'c1', label: 'Kamera Buehne' }, { id: 'c2', label: 'Kamera Saal' }], cameraList: kameras([kam1, kam2]) }
delete apMit.domains.lighting
apMit.domains.audio = { hinweis: 'Beispiel einer Domaene, die diese App nicht kennt' }
const avplanDatei1 = schreibe('halle.avplan', apMit)
await schritt('avplan-import-unbekannte-abschnitte', async () => { await avplanDatei(avplanDatei1); await pause(1200) }, { ziel: () => dlg() })
await schritt('avplan-import-uebernehmen-als', async () => { await dlg().locator('input[type=radio]').nth(1).check(); await pause(400) }, { ziel: () => dlg() })
await schritt('avplan-import-kameras-frage', async () => { await klickKnopf('common.ok'); await pause(1200) }, { ziel: () => dlg() })
await schritt('avplan-import-kameras-uebernommen', async () => { await klickKnopf('common.ok'); await pause(1200) }, { ziel: () => canvas() })
await a.zu()
await schritt('avplan-import-fehler', async () => { await avplanDatei(schreibe('falsch.avplan', { kind: 'nein' })); await pause(1200) }, { ziel: () => dlg() })
await okS()
await a.zu()

})
// ════════════════════════════════════════════════════════════════════════
// 8  Verknüpfte Venue-Planung
// ════════════════════════════════════════════════════════════════════════
await abschnitt('8  Verknüpfte Venue-Planung', async () => {
await schritt('venue-dialog', () => a.menue('app.menu.file', 'app.menu.file.viewForeign'), { ziel: () => dlg() })
await a.zu()

})
// ════════════════════════════════════════════════════════════════════════
// 9  Identitäts-Karte (.avsourcemap)
// ════════════════════════════════════════════════════════════════════════
await abschnitt('9  Identitäts-Karte (.avsourcemap)', async () => {
const karte = (quellen) => ({
  kind: 'av-source-map', formatVersion: 1, app: 'tally-beispiel', appVersion: '1.0.0', exportedAt: '2026-09-01T10:00:00.000Z',
  sources: quellen, unresolved: [],
})
const q1 = { id: 'src-1', name: 'Kamera 1', number: 1, umdAddress: 3, provenance: { name: 'planned', umdAddress: 'confirmed' }, bindings: [], labels: {}, notiz: 'Beispiel' }
const q2 = { id: 'src-2', name: 'Kamera 2', number: 2, umdAddress: 200, provenance: {}, bindings: [], labels: {} }
await schritt('karte-import-neu', async () => { await sourceMapDatei(schreibe('karte.avsourcemap', karte([q1, q2]))); await pause(1200) }, { ziel: () => dlg() })
await okS()
await schritt('karte-import-konflikt', async () => {
  await sourceMapDatei(schreibe('karte-2.avsourcemap', karte([{ ...q1, umdAddress: 5, notiz: undefined, provenance: {} }])))
  await pause(1200)
}, { ziel: () => dlg() })
await okS()
await schritt('karte-import-nichts', async () => { await sourceMapDatei(schreibe('karte-leer.avsourcemap', karte([]))); await pause(1200) }, { ziel: () => dlg() })
await okS()
await schritt('karte-import-fehler', async () => { await sourceMapDatei(schreibe('falsch.avsourcemap', { kind: 'nein' })); await pause(1200) }, { ziel: () => dlg() })
await okS()
await schritt('karte-export', async () => { await a.menue('app.menu.file', 'app.menu.file.exportSourceMap'); await pause(1200) })
const dl2 = await downloads()
const sm = dl2.find((d) => d.name.endsWith('.avsourcemap'))
if (sm) { const m = JSON.parse(sm.text); fakten.gelesen.karteSchluessel = Object.keys(m); fakten.gelesen.karteName = sm.name; fakten.gelesen.karteQuellen = (m.sources ?? []).map((s) => s.name) }
await a.zu()

})
// ════════════════════════════════════════════════════════════════════════
// 12  Sicherungskopie in der Statusleiste
// ════════════════════════════════════════════════════════════════════════
await abschnitt('12  Sicherungskopie in der Statusleiste', async () => {
await schritt('statusleiste-normal', async () => { /* nur Bild */ }, { ziel: () => fussleiste() })
await a.win.evaluate(() => {
  const fuellen = (n, len) => { try { for (let i = 0; i < n; i += 1) localStorage.setItem(`zz-fuell-${len}-${i}`, 'x'.repeat(len)) } catch { /* voll */ } }
  fuellen(200, 1_000_000)
  fuellen(200, 100_000)
  fuellen(200, 1_000)
  fuellen(200, 10)
})
await a.menue('app.menu.tools', 'app.menu.tools.revisions')
await dlg().getByPlaceholder(a.muster('revisions.labelPlaceholder')).fill('B')
await klickKnopf('revisions.commit')
await a.zu()
await pause(1200)
await schritt('statusleiste-ohne-sicherungskopie', async () => { await pause(600) }, { ziel: () => fussleiste() })
fakten.gelesen.badgeText = await fussleiste().innerText()
await a.win.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('zz-fuell-')) localStorage.removeItem(k) })
await a.menue('app.menu.tools', 'app.menu.tools.revisions')
await dlg().getByPlaceholder(a.muster('revisions.labelPlaceholder')).fill('C')
await klickKnopf('revisions.commit')
await a.zu()
await pause(1200)
await schritt('statusleiste-wieder-normal', async () => { await pause(400) }, { ziel: () => fussleiste() })
await schritt('einstellungen-autosave', async () => {
  await a.klick('settings.title')
  await pause(600)
  await a.klickText(/^\s*(Erweitert|Advanced)\s*$/)
  await pause(600)
}, { ziel: () => dlg() })
await a.zu()
fakten.gelesen.autosaveKey = await a.win.evaluate(() => Object.keys(localStorage).filter((k) => /autosave|projectAutosave/i.test(k)))

})
// ════════════════════════════════════════════════════════════════════════
// 13  Vorlagen
// ════════════════════════════════════════════════════════════════════════
await abschnitt('13  Vorlagen', async () => {
const oberster = () => a.win.getByRole('dialog').last()
const okImObersten = () => oberster().getByRole('button', { name: a.muster('common.ok', true) }).click()
await a.menue('app.menu.file', 'app.menu.file.newFromTemplate')
await schritt('vorlagen-as-built-name', async () => { await klickKnopf('templates.promote', false); await pause(500) }, { ziel: () => oberster() })
await oberster().getByRole('textbox').fill('Aufbau-Vorlage')
await schritt('vorlagen-haus-frage', async () => { await okImObersten(); await pause(900) }, { ziel: () => oberster() })
await schritt('vorlagen-as-built-gespeichert', async () => { await oberster().getByRole('button', { name: a.muster('tplScope.neutral', true) }).click(); await pause(900) }, { ziel: () => oberster() })
await okS()
await schritt('vorlagen-eigene-speichern-name', async () => { await klickKnopf('templates.saveCurrent', false); await pause(500) }, { ziel: () => oberster() })
await oberster().getByRole('textbox').fill('Meine Vorlage')
await okImObersten()
await pause(900)
await schritt('vorlagen-eigene-gespeichert', async () => { await oberster().getByRole('button', { name: a.muster('tplScope.venue', true) }).click(); await pause(900) }, { ziel: () => oberster() })
await okS()
await schritt('vorlagen-eigene-liste', async () => { await pause(300) }, { ziel: () => dlg() })
await schritt('vorlagen-eigene-loeschen-frage', async () => { await dlg().getByRole('button', { name: a.muster('common.delete', true) }).first().click(); await pause(600) }, { ziel: () => oberster() })
await oberster().getByRole('button', { name: a.muster('common.cancel', true) }).click()
await pause(400)
await a.zu()
// Jede mitgelieferte Vorlage anwenden
for (const [i, name] of ['ob-van', 'tv-studio', 'live-buehne', 'konferenz', 'gottesdienst'].entries()) {
  await a.menue('app.menu.file', 'app.menu.file.newFromTemplate')
  await dlg().getByRole('button', { name: a.muster('templates.use', true) }).nth(i).click()
  await pause(600)
  if (i === 0) await schritt('vorlagen-verwenden-rueckfrage', async () => { /* nur Bild */ }, { ziel: () => oberster() })
  await oberster().getByRole('button').last().click()
  await pause(600)
  if (i === 0) await schritt('vorlagen-verwenden-name', async () => { /* nur Bild */ }, { ziel: () => oberster() })
  await okImObersten()
  await pause(900)
  if (i === 0) await schritt('vorlagen-verwenden-geladen', async () => { /* nur Bild */ }, { ziel: () => oberster() })
  await ok()
  await a.zu()
  await einpassen()
  await schritt(`vorlage-${name}`, async () => { await pause(400) }, { ziel: () => canvas() })
}

})
// ════════════════════════════════════════════════════════════════════════
// 14  Neues Projekt
// ════════════════════════════════════════════════════════════════════════
await abschnitt('14  Neues Projekt', async () => {
await schritt('neu-dialog-mit-warnung', () => a.menue('app.menu.file', 'app.menu.file.new'), { ziel: () => dlg() })
await schritt('neu-dialog-ausgefuellt', async () => {
  const d = dlg()
  await d.locator('input').nth(0).fill('Sommerfest Halle 2')
  await d.locator('input').nth(1).fill('Beispiel Medientechnik GmbH')
  await d.locator('input').nth(2).fill('Beispiel Kunde')
  await d.locator('input').nth(3).fill('Vorname Nachname')
  await d.locator('input').nth(4).fill('2026-042')
  await d.locator('textarea').first().fill('Bühne, Saal und Regie')
}, { ziel: () => dlg() })
await schritt('neu-projekt-angelegt', async () => { await dlg().getByRole('button', { name: a.muster('project.meta.create', true) }).click(); await pause(1500) })
await schritt('neu-dialog-ohne-warnung', () => a.menue('app.menu.file', 'app.menu.file.new'), { ziel: () => dlg() })
await a.zu()

})
// ════════════════════════════════════════════════════════════════════════
// 16  Rentman-Import (Beispieldaten, Scheinserver)
// ════════════════════════════════════════════════════════════════════════
await abschnitt('16  Rentman-Import', async () => {
  const nv = (ms = 400) => a.win.waitForTimeout(ms)
  const still = async (fn) => { try { return await fn() } catch (e) { console.log('  (still) ' + String(e.message).split('\n')[0]) } }
  const rb = () => a.win.locator('[role="dialog"]').first().locator(':scope > div').first()
  const karte = (key) => a.dialog().getByText(T(key), { exact: true }).locator('xpath=..')
  const rbBtn = (key, exact = true) => rb().getByRole('button', { name: T(key), exact })
  // Token (erfunden) in den Einstellungen hinterlegen; der Schlüsselbund ist im Hauptprozess ersetzt.
  await a.palette('palette.settings')
  await still(() => a.dialog().getByRole('button', { name: /^\s*(Integrationen|Integrations)\s*$/ }).first().click())
  await nv(700)
  await karte('settings.integrations.rentman').locator('input[type=password]').first().fill('demo-token')
  await karte('settings.integrations.rentman').getByRole('button', { name: T('settings.integrations.rentman.save') }).click()
  await nv(700)
  await a.zu()
  await schritt('rentman-import-offen', async () => { await a.menue('app.menu.file', 'app.menu.tools.rentmanImport'); await nv(2500) }, { ziel: () => rb() })
  await schritt('rentman-suche', async () => { await rb().getByPlaceholder(T('rentman.import.searchPlaceholder')).fill('Sommer') }, { ziel: () => rb() })
  await schritt('rentman-projekt-gewaehlt', async () => {
    await rb().getByPlaceholder(T('rentman.import.searchPlaceholder')).fill('')
    await rb().getByRole('option', { name: /Sommerfest/ }).first().click()
    await nv(2500)
  }, { ziel: () => rb() })
  await schritt('rentman-alle-auswaehlen', async () => {
    await rbBtn('rentman.checklist.selectAll').first().click()
  }, { ziel: () => rb() })
  await schritt('rentman-sets-aufgeklappt', async () => { await rbBtn('rentman.checklist.expandAll').click() }, { ziel: () => rb() })
  await schritt('rentman-kabelmengen', async () => {
    await rb().getByRole('button', { name: new RegExp(T('rentman.import.cablePlan.headingN').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\{count\\}', '\\d+')) }).first().click()
    await nv(300)
    await rbBtn('rentman.import.cablePlan.selectAll').last().click()
  }, { ziel: () => rb() })
  await schritt('rentman-kabel-uebernommen', async () => { await rbBtn('rentman.import.cablePlan.apply').click(); await nv(400) }, { ziel: () => rb() })
  await schritt('rentman-auswahl', async () => {
    await rbBtn('rentman.checklist.deselectAll').first().click()
    for (const n of [DE ? 'ATEM Mini Pro (Streaming-Mischer)' : 'ATEM Mini Pro (streaming switcher)', 'Beispielgerät Alpha', 'Beispiel Funkstrecke XY-100']) {
      await rb().locator('label', { hasText: n }).first().locator('input[type=checkbox]').first().check()
    }
  }, { ziel: () => rb() })
  await schritt('rentman-kategorie-zuordnung', async () => {
    await rb().getByRole('button', { name: new RegExp('^(' + T('rentman.import.addToLibraryN').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\{count\\}', '\\d+') + ')') }).first().click()
    await nv(700)
  }, { ziel: () => rb() })
  await schritt('rentman-weiter', async () => { await rbBtn('rentman.import.next').click(); await nv(900) }, { ziel: () => a.dialog() })
  await a.zu()
  await schritt('rentman-menue-verknuepft', () => a.menue('app.menu.file'), { ziel: () => a.menueFeld() })
  await a.zu()
})

f.speichern(new URL(`./datei-import.${sprache}.json`, import.meta.url))
writeFileSync(new URL(`./datei-import.${sprache}.fakten.json`, import.meta.url), JSON.stringify(fakten, null, 2))
await a.ende()
server.close()
console.log('FERTIG')
process.exit(0)
