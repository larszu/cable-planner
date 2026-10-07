// Handbuch-Aufnahmen für das Kapitel „Ausgeben & Dokumentieren“ (export).
//
//   node scripts/handbuch/bereiche/export.mjs de
//   node scripts/handbuch/bereiche/export.mjs en
//   NUR=phase1,patch node … de        (nur einzelne Abschnitte, zum Reparieren)
//
// WAS HIER PASSIERT
// - Phase 1 läuft auf dem Beispielprojekt der App (Camera 1, Camera 2 …).
// - Phase 2 lädt eine Datei mit ERFUNDENEN BEISPIELDATEN (Konzert-Aufbau mit
//   Mikrofonen, Stagebox, Pult, Wedges plus die Videokette). Die Datei wird
//   hier erzeugt und über den abgefangenen Öffnen-Dialog geladen. Grund: die
//   Kanalliste, der Stage-Plot mit Eingangsliste, die Tally-Karte und die
//   Multiviewer-Belegung brauchen Audio-Kabel, Rollen und Fenster, die das
//   Beispielprojekt nicht hat.
// - Ausgaben (Downloads, Druckaufträge) werden im Fenster abgefangen und als
//   Vorschau fotografiert: CSV als Tabelle, HTML als Blatt, PDF als erste
//   Seite, Bilder als Bild. Es wird nichts auf die Platte des Nutzers
//   geschrieben und nichts gedruckt.
// - Nicht angefasst: Anmeldung, Cloud, Rentman, Netzwerk.

import { starte } from '../app.mjs'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const sprache = process.argv[2] ?? 'de'
const NUR = process.env.NUR ? new Set(process.env.NUR.split(',')) : null
const laeuft = (n) => !NUR || NUR.has(n)

const ARB = join(
  '/private/tmp/claude-501/-Users-larszumpe/12f0f693-b544-4eb3-a60a-27e5d3a1fe46/scratchpad',
  'export-lauf',
  sprache,
)
mkdirSync(ARB, { recursive: true })

// ─────────────────────────────────────────────────────────────── Beispieldaten
const port = (id, name, type, direction, extra = {}) => ({ id, name, type, connectorType: type, direction, ...extra })

function baueBeispiel() {
  const now = new Date().toISOString()
  const eq = (id, name, category, inputs, outputs, x, y, extra = {}) => ({
    id, name, category, inputs, outputs, x, y, width: 220, height: 120, ...extra,
  })
  const equipment = [
    eq('cam1', 'Camera 1', 'Cameras', [], [port('cam1-o', 'SDI Out', 'BNC', 'out')], 80, 80, { nodeColor: '#0f4c81', sourceIdentityId: 'rolle-k1' }),
    eq('cam2', 'Camera 2', 'Cameras', [], [port('cam2-o', 'SDI Out', 'BNC', 'out')], 80, 320, { nodeColor: '#0f4c81', sourceIdentityId: 'rolle-k2' }),
    eq('mix', 'Vision mixer', 'Mixer',
      [port('mix-i1', 'In 1', 'BNC', 'in'), port('mix-i2', 'In 2', 'BNC', 'in'), port('mix-i3', 'In 3', 'BNC', 'in'), port('mix-i4', 'In 4', 'BNC', 'in')],
      [port('mix-pgm', 'PGM Out', 'BNC', 'out'), port('mix-mv', 'Multiview Out', 'BNC', 'out')],
      460, 170, {
        nodeColor: '#7c3aed', height: 210,
        atemMvConfig: { multiViewers: [{ index: 0, layout: 0, windows: [{ windowIndex: 0, sourceId: 1 }, { windowIndex: 1, sourceId: 2 }] }] },
      }),
    eq('mv', 'Multiviewer', 'Monitors', [port('mv-i', 'SDI In', 'BNC', 'in')], [], 880, 80),
    eq('mon', 'Control room monitor', 'Monitors', [port('mon-i', 'SDI In', 'BNC', 'in')], [], 880, 320),
    // Audio
    eq('m1', 'Lead vocal', 'Microphones', [], [port('m1-o', 'Out', 'XLR', 'out')], 80, 560, { subtitle: 'SM58' }),
    eq('m2', 'Kick', 'Microphones', [], [port('m2-o', 'Out', 'XLR', 'out')], 80, 700, { subtitle: 'Beta 52' }),
    eq('m3', 'Bass DI', 'Microphones', [], [port('m3-o', 'Out', 'XLR', 'out')], 80, 840, { subtitle: 'DI box' }),
    eq('m4', 'Snare', 'Microphones', [], [port('m4-o', 'Out', 'XLR', 'out')], 80, 980, { subtitle: 'SM57' }),
    eq('m5', '4', 'Microphones', [], [port('m5-o', 'Out', 'XLR', 'out')], 80, 1120),
    eq('box', 'Stagebox A', 'Audio',
      [port('box-1', '1', 'XLR', 'in'), port('box-2', '2', 'XLR', 'in'), port('box-3', '3', 'XLR', 'in'), port('box-x', '', 'XLR', 'in')],
      [port('box-net', 'Network', 'RJ45', 'out')], 460, 700),
    eq('foh', 'FOH console', 'Mixer',
      [port('foh-in', 'Stagebox In', 'RJ45', 'in')],
      [port('foh-a1', 'Aux 1', 'XLR', 'out'), port('foh-a2', 'Aux 2', 'XLR', 'out')], 820, 700),
    eq('w1', 'Wedge 1', 'Monitors', [port('w1-i', 'In', 'XLR', 'in')], [], 1160, 640),
    eq('w2', 'Wedge 2', 'Monitors', [port('w2-i', 'In', 'XLR', 'in')], [], 1160, 800),
  ]
  const kabel = (id, name, type, length, color, von, vonPort, nach, nachPort, layer, extra = {}) => ({
    id, name, type, length, color, fromEquipmentId: von, fromPortId: vonPort, toEquipmentId: nach, toPortId: nachPort,
    notes: '', routing: 'orthogonal', arrowEnd: true, layer, ...extra,
  })
  const cables = [
    kabel('c1', 'CAM 1 → mixer', 'BNC', 12, '#3b82f6', 'cam1', 'cam1-o', 'mix', 'mix-i1', 'video', { cableNumber: 'V-01' }),
    kabel('c2', 'CAM 2 → mixer', 'BNC', 18, '#3b82f6', 'cam2', 'cam2-o', 'mix', 'mix-i2', 'video', { cableNumber: 'V-02' }),
    kabel('c3', 'PGM → control room monitor', 'BNC', 6, '#ef4444', 'mix', 'mix-pgm', 'mon', 'mon-i', 'video', { cableNumber: 'V-03' }),
    kabel('c4', 'Multiview → Multiviewer', 'BNC', 6, '#22c55e', 'mix', 'mix-mv', 'mv', 'mv-i', 'video', { cableNumber: 'V-04' }),
    kabel('a1', 'Lead vocal → Stagebox', 'XLR', 15, '#f59e0b', 'm1', 'm1-o', 'box', 'box-1', 'audio', { cableNumber: 'A-01' }),
    kabel('a2', 'Kick → Stagebox', 'XLR', 15, '#f59e0b', 'm2', 'm2-o', 'box', 'box-2', 'audio', { cableNumber: 'A-02' }),
    kabel('a3', 'Bass DI → Stagebox', 'XLR', 10, '#f59e0b', 'm3', 'm3-o', 'box', 'box-3', 'audio', { cableNumber: 'A-03' }),
    kabel('a4', 'Snare → Stagebox', 'XLR', 10, '#f59e0b', 'm4', 'm4-o', 'box', 'box-3', 'audio', { cableNumber: 'A-04' }),
    kabel('a5', 'Kanal 4 → Stagebox', 'XLR', 10, '#f59e0b', 'm5', 'm5-o', 'box', 'box-x', 'audio', { cableNumber: 'A-05' }),
    kabel('n1', 'Stagebox → FOH', 'RJ45', 40, '#22c55e', 'box', 'box-net', 'foh', 'foh-in', 'network', { cableNumber: 'N-01' }),
    kabel('a6', 'Aux 1 → Wedge 1', 'XLR', 20, '#f59e0b', 'foh', 'foh-a1', 'w1', 'w1-i', 'audio', { cableNumber: 'A-06' }),
    kabel('a7', 'Aux 2 → Wedge 2', 'XLR', 20, '#f59e0b', 'foh', 'foh-a2', 'w2', 'w2-i', 'audio', { cableNumber: 'A-07' }),
  ]
  const projekt = {
    metadata: {
      name: 'Beispieldaten: Konzert und Regie',
      description: 'Erfundene Beispieldaten für das Handbuch.',
      createdAt: now,
      updatedAt: now,
      defaultVideoFormat: '1080p50',
      defaultPowerStandard: 'eu-230-1ph',
      defaultLightingControl: 'dmx512',
    },
    equipment,
    cables,
    locations: [],
    canvasState: { x: 0, y: 0, zoom: 0.6 },
    sourceIdentities: [
      { id: 'rolle-k1', name: 'Kamera 1', number: 1, umdAddress: 1 },
      { id: 'rolle-k2', name: 'Kamera 2', number: 2, umdAddress: 2 },
      { id: 'rolle-k3', name: 'Kamera 3', number: 3 },
    ],
    cableStock: [
      { type: 'BNC', lengthM: 10, count: 2 },
      { type: 'BNC', lengthM: 50 },
      { type: 'XLR', lengthM: 15, count: 4 },
    ],
    pendingChanges: [
      {
        id: 'pc1', ts: now, author: 'Jana (Bühne)', source: 'mobile', kind: 'cable-edit',
        target: { type: 'cable', id: 'a1', name: 'Lead vocal → Stagebox' },
        summary: 'Länge 15 m → 20 m', patch: { length: 20 },
      },
      {
        id: 'pc2', ts: now, author: 'Jana (Bühne)', source: 'mobile', kind: 'note',
        target: { type: 'equipment', id: 'w2', name: 'Wedge 2' },
        summary: 'Wedge 2 steht 1 m weiter links',
      },
    ],
  }
  // Ein früherer Stand für den Plan-Vergleich: ein Kabel weniger, ein Gerät
  // anders benannt, eine Länge anders.
  const alt = JSON.parse(JSON.stringify(projekt))
  alt.cables = alt.cables.filter((c) => c.id !== 'a7')
  alt.cables.find((c) => c.id === 'c1').length = 10
  alt.equipment.find((e) => e.id === 'm2').name = 'Kick drum'
  alt.metadata.name = 'Beispieldaten: Konzert und Regie'
  // Eine Rückmeldung eines Prüfers (Viewer-Datei) mit Anmerkungen.
  const viewer = JSON.parse(JSON.stringify(projekt))
  viewer.mode = 'viewer'
  viewer.annotations = [
    { id: 'an1', author: 'Prüfer Meyer', createdAt: now, text: 'Länge prüfen: 12 m reichen nicht bis zum Pult.', status: 'open', anchor: { type: 'cable', cableId: 'c1' } },
    { id: 'an2', author: 'Prüfer Meyer', createdAt: now, text: 'Wedge 1 braucht einen zweiten Eingang.', status: 'open', anchor: { type: 'device', deviceId: 'w1' } },
    { id: 'an3', author: 'Prüfer Meyer', createdAt: now, text: 'Hier kommt die Traverse hin.', status: 'resolved', anchor: { type: 'free', x: 300, y: 600 } },
  ]
  return { projekt, alt, viewer }
}

const SCN1 = [
  '#4.0# "X32 Beispiel" "" %000000000 1 X32-Beispiel',
  '/ch/01/config "Lead vocal" 1 RD 1',
  '/ch/02/config "Kick" 2 YE 2',
  '/ch/03/config "Bass DI" 3 GN 3',
  '/ch/04/config "Snare" 4 YE 4',
  '/ch/05/config "" 1 OFF 5',
].join('\n')
const SCN2 = [
  '#4.0# "X32 Beispiel" "" %000000000 1 X32-Beispiel',
  '/ch/01/config "Lead Vox" 1 RD 1',
  '/ch/02/config "Kick" 2 YE 2',
  '/ch/03/config "Bass DI" 3 BL 3',
  '/ch/04/config "" 4 YE 4',
  '/ch/05/config "Gitarre" 1 GN 5',
].join('\n')

const dateien = {} // Schrittname → Kopf der abgefangenen Ausgabe
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function lauf() {
  const a = await starte({ sprache, hoehe: 1150 })
  const win = a.win
  const f = a.folge('export')
  const bsp = baueBeispiel()
  const pfadBeispiel = join(ARB, 'beispieldaten.cableplan')
  const pfadAlt = join(ARB, 'beispieldaten-frueher.cableplan')
  const pfadViewer = join(ARB, 'rueckmeldung.cpviewer')
  const pfadScn1 = join(ARB, 'probe-1.scn')
  const pfadScn2 = join(ARB, 'probe-2.scn')
  writeFileSync(pfadBeispiel, JSON.stringify(bsp.projekt, null, 2))
  writeFileSync(pfadAlt, JSON.stringify(bsp.alt, null, 2))
  writeFileSync(pfadViewer, JSON.stringify(bsp.viewer, null, 2))
  writeFileSync(pfadScn1, SCN1)
  writeFileSync(pfadScn2, SCN2)

  // ── Abfang: Downloads, Druck-IPC, iframe-srcdoc ─────────────────────────
  await win.evaluate(() => {
    window.__dl = []
    window.__srcdocs = []
    const blobs = new Map()
    const orig = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (b) => {
      const u = orig(b)
      blobs.set(u, b)
      return u
    }
    const grab = (el) => {
      const href = el.href || ''
      if (!blobs.has(href) && !href.startsWith('data:')) return false
      const p = blobs.has(href) ? Promise.resolve(blobs.get(href)) : fetch(href).then((r) => r.blob())
      void p.then((b) => b.arrayBuffer().then((buf) => {
        const u8 = new Uint8Array(buf)
        let s = ''
        for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000))
        window.__dl.push({ name: el.download, type: b.type, b64: btoa(s) })
      }))
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
    const d = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'srcdoc')
    Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', {
      configurable: true,
      get() { return d.get.call(this) },
      set(v) { window.__srcdocs.push(String(v)) },
    })
  })
  await a.app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('print:pdf-bytes')
    ipcMain.handle('print:pdf-bytes', (_e, bytes) => {
      globalThis.__druck = globalThis.__druck ?? []
      globalThis.__druck.push(Buffer.from(bytes).toString('base64'))
      return true
    })
  })

  const dlZahl = () => win.evaluate(() => window.__dl.length)
  const wartDownload = async (n0, ms = 60000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      if ((await dlZahl()) > n0) return win.evaluate((i) => window.__dl[i], n0)
      await win.waitForTimeout(250)
    }
    throw new Error('kein Download angekommen')
  }
  const druckZahl = () => a.app.evaluate(() => (globalThis.__druck ?? []).length)
  const wartDruck = async (n0, ms = 60000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      if ((await druckZahl()) > n0) return a.app.evaluate((_x, i) => globalThis.__druck[i], n0)
      await win.waitForTimeout(250)
    }
    throw new Error('kein Druckauftrag angekommen')
  }
  const srcdocZahl = () => win.evaluate(() => window.__srcdocs.length)
  const wartSrcdoc = async (n0, ms = 20000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      if ((await srcdocZahl()) > n0) return win.evaluate((i) => window.__srcdocs[i], n0)
      await win.waitForTimeout(250)
    }
    throw new Error('kein Druckdokument angekommen')
  }

  // ── Vorschau der Ausgabe ────────────────────────────────────────────────
  const overlayWeg = () => win.evaluate(() => document.getElementById('hb-overlay')?.remove())
  const overlay = (titel, koerper, { iframeHtml, breite = 900, hoehe = 0 } = {}) =>
    win.evaluate(
      ({ titel, koerper, iframeHtml, breite, hoehe }) => {
        document.getElementById('hb-overlay')?.remove()
        const o = document.createElement('div')
        o.id = 'hb-overlay'
        o.style.cssText = `position:fixed;left:50%;top:30px;transform:translateX(-50%);width:${breite}px;${hoehe ? `height:${hoehe}px;` : 'max-height:1000px;'}overflow:hidden;z-index:2147483647;background:#fff;color:#111;border:1px solid #888;font:12px/1.35 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35)`
        const kopf = document.createElement('div')
        kopf.style.cssText = 'background:#e8eaee;padding:5px 10px;font-weight:600;border-bottom:1px solid #bbb'
        kopf.textContent = titel
        o.appendChild(kopf)
        const body = document.createElement('div')
        body.style.cssText = 'padding:8px;background:#fff'
        if (iframeHtml !== undefined) {
          const fr = document.createElement('iframe')
          fr.style.cssText = `width:100%;height:${(hoehe || 700) - 60}px;border:0;background:#fff`
          body.appendChild(fr)
          o.appendChild(body)
          document.body.appendChild(o)
          fr.contentDocument.open()
          fr.contentDocument.write(iframeHtml)
          fr.contentDocument.close()
          return
        }
        body.innerHTML = koerper
        o.appendChild(body)
        document.body.appendChild(o)
      },
      { titel, koerper, iframeHtml, breite, hoehe },
    )
  const ueberlagerung = () => win.locator('#hb-overlay')

  const csvZeilen = (text) => {
    const t = text.replace(/^﻿/, '')
    const erste = t.split(/\r?\n/)[0] ?? ''
    const sep = [';', '\t', ','].map((s) => [s, erste.split(s).length]).sort((x, y) => y[1] - x[1])[0][0]
    const zeilen = []
    let zeile = []
    let feld = ''
    let q = false
    for (let i = 0; i < t.length; i += 1) {
      const c = t[i]
      if (q) {
        if (c === '"' && t[i + 1] === '"') { feld += '"'; i += 1 } else if (c === '"') q = false
        else feld += c
      } else if (c === '"') q = true
      else if (c === sep) { zeile.push(feld); feld = '' }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && t[i + 1] === '\n') i += 1
        zeile.push(feld); feld = ''; zeilen.push(zeile); zeile = []
      } else feld += c
    }
    if (feld !== '' || zeile.length) { zeile.push(feld); zeilen.push(zeile) }
    return zeilen
  }

  /** Eine abgefangene Ausgabe als Vorschau ins Fenster legen; liefert den Kopf für die JSON-Datei. */
  const zeigeDatei = async (schritt, d, { seite = 1, zeilenMax = 9 } = {}) => {
    const bytes = Buffer.from(d.b64, 'base64')
    const name = d.name || 'datei'
    const ext = (name.split('.').pop() || '').toLowerCase()
    const info = { datei: name, bytes: bytes.length }
    if (ext === 'csv' || ext === 'txt') {
      const text = bytes.toString('utf8')
      const zeilen = csvZeilen(text).filter((z) => z.some((c) => c !== ''))
      info.kopf = zeilen.slice(0, 4)
      info.zeilen = zeilen.length
      const spalten = Math.max(...zeilen.slice(0, zeilenMax).map((z) => z.length))
      const fs = spalten > 12 ? 9 : spalten > 8 ? 10 : 11
      const tab = `<table style="border-collapse:collapse;font-size:${fs}px;width:100%">${zeilen
        .slice(0, zeilenMax)
        .map((z, i) => `<tr>${z.map((c) => `<${i === 0 ? 'th' : 'td'} style="border:1px solid #ccc;padding:2px 5px;text-align:left;${i === 0 ? 'background:#f0f0f0;' : ''}vertical-align:top">${esc(c)}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`)
        .join('')}</table>`
      await overlay(name, tab)
    } else if (ext === 'html') {
      const text = bytes.toString('utf8')
      info.kopf = text.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400)
      await overlay(name, '', { iframeHtml: text, hoehe: 760 })
    } else if (ext === 'md' || ext === 'json' || ext === 'dxf') {
      const text = bytes.toString('utf8')
      info.kopf = text.split(/\r?\n/).slice(0, 12)
      await overlay(name, `<pre style="margin:0;font:11px/1.35 ui-monospace,monospace;white-space:pre-wrap">${esc(text.split(/\r?\n/).slice(0, 34).join('\n'))}</pre>`)
    } else if (ext === 'pdf') {
      const pdf = join(ARB, `${schritt}.pdf`)
      writeFileSync(pdf, bytes)
      const praefix = join(ARB, `${schritt}-seite`)
      execFileSync('pdftoppm', ['-jpeg', '-jpegopt', 'quality=72', '-r', '80', '-f', String(seite), '-l', String(seite), pdf, praefix])
      const jpg = readdirSync(ARB).find((x) => x.startsWith(`${schritt}-seite`) && x.endsWith('.jpg'))
      const b64 = readFileSync(join(ARB, jpg)).toString('base64')
      info.seiten = Number((execFileSync('pdfinfo', [pdf]).toString().match(/Pages:\s+(\d+)/) ?? [])[1] ?? 0)
      await overlay(`${name} (Seite ${seite}${info.seiten ? ` von ${info.seiten}` : ''})`, `<img style="display:block;max-width:100%;max-height:900px;margin:auto" src="data:image/jpeg;base64,${b64}">`)
    } else if (['png', 'jpg', 'jpeg', 'svg'].includes(ext)) {
      const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'png' ? 'image/png' : 'image/jpeg'
      await overlay(name, `<img style="display:block;max-width:100%;max-height:900px;margin:auto;background:#fff" src="data:${mime};base64,${d.b64}">`)
    } else {
      await overlay(name, `<p>${esc(name)}: ${bytes.length} Bytes</p>`)
    }
    dateien[schritt] = info
  }
  const zeigePdfBytes = async (schritt, b64, opt = {}) =>
    zeigeDatei(schritt, { name: `${schritt}.pdf`, b64 }, opt)

  // ── Kleine Helfer ───────────────────────────────────────────────────────
  const S = async (name, tun, opt) => {
    await overlayWeg()
    await f.schritt(name, tun, opt)
  }
  const D = () => a.dialog()
  const dlgZiel = () => a.dialog()
  const klickIn = async (loc, regex, opt = {}) => {
    const el = loc.getByRole('button', { name: regex })
    await el.first().click({ timeout: 8000, ...opt })
    await win.waitForTimeout(500)
  }
  /** Auswahlliste „aufgeklappt“ zeigen: das native Popup ist nicht fotografierbar, die Liste als Kasten schon. */
  const listeAuf = (sel) =>
    sel.evaluate((s) => {
      s.dataset.hbVorher = String(s.size || 0)
      s.scrollIntoView({ block: 'center' })
      s.size = Math.min(s.options.length, 12)
      s.style.height = 'auto'
    })
  const listeZu = (sel) =>
    sel.evaluate((s) => {
      s.size = Number(s.dataset.hbVorher || 0)
      s.style.height = ''
    })
  const abschnitt = async (name) => {
    await overlayWeg()
    await a.zu()
    console.log(`── ${name}`)
  }
  const alsHtml = (s) => s
  const standardAbfang = () =>
    a.app.evaluate(({ dialog }) => {
      dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] })
      dialog.showSaveDialog = async () => ({ canceled: true, filePath: undefined })
    })
  const oeffnenMit = (pfad) =>
    a.app.evaluate(({ dialog }, p) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] })
    }, pfad)
  const speichernMit = (pfad) =>
    a.app.evaluate(({ dialog }, p) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: p })
    }, pfad)
  const bestaetigen = async () => {
    for (let i = 0; i < 3; i += 1) {
      await win.waitForTimeout(700)
      const d = a.dialog()
      if (!(await d.count())) return
      const b = d.getByRole('button', { name: /Verwerfen|Discard|Öffnen|Open|OK|Ja|Yes|Weiter|Continue|Laden|Load/i })
      if (await b.count()) await b.first().click().catch(() => {})
    }
  }
  const exportOeffnen = async (index) => {
    await a.menue('app.menu.file', 'app.menu.file.export')
    await win.waitForTimeout(400)
    if (index > 0) {
      await D().locator('aside button').nth(index).click()
      await win.waitForTimeout(500)
    }
  }
  const projektLaden = async (pfad) => {
    await oeffnenMit(pfad)
    await a.menue('app.menu.file', 'app.menu.file.open')
    await bestaetigen()
    await standardAbfang()
    await a.zu()
    await win.waitForTimeout(1500)
  }
  const Fname = (fmt) => new RegExp(`(Als\\s+${fmt}\\s+herunterladen|Download as\\s+${fmt})`, 'i')

  // ═══════════════════════════════════════════════════════════════ PHASE 1
  if (laeuft('phase1')) {
    await abschnitt('Menü')
    await S('datei-menue', () => a.menue('app.menu.file'), { ziel: () => a.menueFeld() })
    await S('palette-suche', async () => {
      await a.zu()
      await win.keyboard.press('Control+k')
      await win.waitForTimeout(400)
      await win.keyboard.type(sprache === 'de' ? 'Patch' : 'Patch')
      await win.waitForTimeout(500)
    }, { ziel: () => win.locator('[role="dialog"], [role="listbox"]').last() })
    await a.zu()

    // Register leer — VOR jeder Ausgabe
    await abschnitt('Register leer')
    await S('register-leer', () => a.menue('app.menu.file', 'app.menu.file.documentLog'), { ziel: dlgZiel })
    await a.zu()

    await abschnitt('Vergleich leer')
    await S('vergleich-leer', () => a.menue('app.menu.file', 'app.menu.file.planCompare'), { ziel: dlgZiel })
    await a.zu()

    await abschnitt('Cloud')
    await S('cloud-dialog', () => a.menue('app.menu.file', 'app.menu.file.cloud'), { ziel: dlgZiel })
    await a.zu()

    await abschnitt('Viewer-Datei')
    await speichernMit(join(ARB, 'plan.cpviewer'))
    await S('viewer-exportiert', () => a.menue('app.menu.file', 'app.menu.file.exportViewer'), { ziel: dlgZiel })
    await a.zu()
    await standardAbfang()
    await a.zu()

    await abschnitt('Export-Zentrale: Plan')
    await S('export-plan-pdf', () => exportOeffnen(0), { ziel: dlgZiel })
    await S('export-seitenleiste', async () => {}, { ziel: () => D().locator('aside').first() })
    await S('plan-thema-dunkel', () => D().locator('input[name="pdf-theme"]').nth(0).check(), { ziel: dlgZiel })
    await S('plan-thema-hell', () => D().locator('input[name="pdf-theme"]').nth(1).check(), { ziel: dlgZiel })
    await S('plan-monochrom', () => a.klick('export.monochrome'), { ziel: dlgZiel })
    await S('plan-vektor', () => D().locator('input[name="pdf-render-mode"]').nth(1).check(), { ziel: dlgZiel })
    await S('plan-seitenformat', async () => {
      await listeAuf(D().locator('select').first())
    }, { ziel: dlgZiel })
    await listeZu(D().locator('select').first()).catch(() => {})
    await S('plan-ebenen', async () => {
      await D().locator('input[name="pdf-render-mode"]').nth(0).check()
      await klickIn(D(), /Video/).catch(() => a.klickText(/Video/))
    }, { ziel: dlgZiel })
    await S('plan-ebenen-zurueck', () => klickIn(D(), /Video/).catch(() => a.klickText(/Video/)), { ziel: dlgZiel })
    await S('plan-format-png', () => D().locator('input[name="export-format"]').nth(1).check(), { ziel: dlgZiel })
    await S('plan-format-jpeg', () => D().locator('input[name="export-format"]').nth(2).check(), { ziel: dlgZiel })
    await S('plan-format-svg', () => D().locator('input[name="export-format"]').nth(3).check(), { ziel: dlgZiel })
    await S('plan-format-dxf', () => D().locator('input[name="export-format"]').nth(4).check(), { ziel: dlgZiel })
    await S('plan-drucken-gesperrt', () => D().locator('input[name="export-format"]').nth(1).check(), { ziel: () => D().locator('div.justify-end.shrink-0').last() })
    await a.zu()

    // Ergebnisse der Plan-Ausgabe
    for (const [idx, fmt, name] of [[1, 'PNG', 'png'], [2, 'JPEG', 'jpeg'], [3, 'SVG', 'svg'], [4, 'DXF', 'dxf']]) {
      await S(`ergebnis-plan-${name}`, async () => {
        await exportOeffnen(0)
        await D().locator('input[name="export-format"]').nth(idx).check()
        const n0 = await dlZahl()
        await klickIn(D(), Fname(fmt))
        const d = await wartDownload(n0)
        await zeigeDatei(`plan-${name}`, d)
      }, { ziel: ueberlagerung })
      await a.zu()
    }
    await S('ergebnis-plan-pdf', async () => {
      await exportOeffnen(0)
      await D().locator('input[name="export-format"]').nth(0).check()
      await D().locator('input[name="pdf-theme"]').nth(1).check()
      const n0 = await dlZahl()
      await klickIn(D(), Fname('PDF'))
      const d = await wartDownload(n0, 90000)
      await zeigeDatei('plan-pdf', d)
    }, { ziel: ueberlagerung })
    await a.zu()
    await S('ergebnis-plan-pdf-vektor', async () => {
      await exportOeffnen(0)
      await D().locator('input[name="pdf-theme"]').nth(1).check()
      await D().locator('input[name="pdf-render-mode"]').nth(1).check()
      const n0 = await dlZahl()
      await klickIn(D(), Fname('PDF'))
      const d = await wartDownload(n0, 120000)
      await zeigeDatei('plan-pdf-vektor', d)
    }, { ziel: ueberlagerung })
    await a.zu()
    await S('ergebnis-plan-drucken', async () => {
      await exportOeffnen(0)
      await D().locator('input[name="pdf-theme"]').nth(1).check()
      const n0 = await druckZahl()
      await klickIn(D(), /^\s*(Drucken|Print)\s*$/i)
      const b64 = await wartDruck(n0, 90000)
      await zeigePdfBytes('plan-druck', b64)
    }, { ziel: ueberlagerung })
    await a.zu()

    // ── Patch-Sheets
    await abschnitt('Patch-Sheets')
    await S('patchsheets-oeffnen', () => exportOeffnen(1), { ziel: dlgZiel })
    await S('patchsheets-filter', () => D().getByRole('textbox').first().fill('Camera'), { ziel: dlgZiel })
    await S('patchsheets-alle', () => klickIn(D(), /Alle wählen|Select all/i), { ziel: dlgZiel })
    await S('patchsheets-keine', () => klickIn(D(), /Alle abwählen|Deselect all/i), { ziel: dlgZiel })
    await D().getByRole('textbox').first().fill('')
    await S('patchsheets-auswahl', async () => {
      await D().locator('input[type="checkbox"]').nth(0).check()
      await D().locator('input[type="checkbox"]').nth(2).check()
    }, { ziel: dlgZiel })
    await S('patchsheets-papier', () => klickIn(D(), /Einzel-PDF|Individual PDF/i), { ziel: dlgZiel })
    await S('patchsheets-abbrechen', () => klickIn(D(), /Abbrechen|Cancel/i), { ziel: dlgZiel })
    await S('patchsheets-sammel-papier', () => klickIn(D(), /Sammel-PDF|Combined PDF/i), { ziel: dlgZiel })
    await a.zu()
    await S('ergebnis-patchsheet-sammel', async () => {
      await exportOeffnen(1)
      await D().locator('input[type="checkbox"]').nth(0).check()
      await D().locator('input[type="checkbox"]').nth(2).check()
      await klickIn(D(), /Sammel-PDF|Combined PDF/i)
      const n0 = await dlZahl()
      await klickIn(D(), /^A4$/)
      const d = await wartDownload(n0)
      await zeigeDatei('patchsheet-sammel', d)
    }, { ziel: ueberlagerung })
    await a.zu()
    await S('ergebnis-patchsheet-einzel-a3', async () => {
      await exportOeffnen(1)
      await D().locator('input[type="checkbox"]').nth(0).check()
      await klickIn(D(), /Einzel-PDF|Individual PDF/i)
      const n0 = await dlZahl()
      await klickIn(D(), /^A3$/)
      const d = await wartDownload(n0)
      await zeigeDatei('patchsheet-einzel', d)
    }, { ziel: ueberlagerung })
    await a.zu()
    await S('ergebnis-patchsheet-drucken', async () => {
      await exportOeffnen(1)
      await D().locator('input[type="checkbox"]').nth(0).check()
      await klickIn(D(), /^\s*(Drucken|Print)\s*$/i)
      const n0 = await druckZahl()
      await klickIn(D(), /^A4$/)
      const b64 = await wartDruck(n0)
      await zeigePdfBytes('patchsheet-druck', b64)
    }, { ziel: ueberlagerung })
    await a.zu()

    // Datenblatt
    await abschnitt('Datenblätter')
    await S('datenblatt-oeffnen', async () => {
      await exportOeffnen(1)
      await D().locator('input[type="checkbox"]').nth(0).check()
      await klickIn(D(), /Datenbl(a|ä)tter|Datasheets/i)
      await win.waitForTimeout(600)
    }, { ziel: dlgZiel })
    await S('datenblatt-keine', () => klickIn(D(), /^(Keine|None)$/i), { ziel: dlgZiel })
    await S('datenblatt-alle', () => klickIn(D(), /^(Alle|All)$/i), { ziel: dlgZiel })
    await S('datenblatt-ausgefuellte', () => klickIn(D(), /Ausgef(ü|u)llte|Filled ones/i), { ziel: dlgZiel })
    await S('datenblatt-druck', async () => {
      const n0 = await srcdocZahl()
      await klickIn(D(), /^\s*(Drucken|Print)\s*$/i)
      const html = await wartSrcdoc(n0)
      dateien['datenblatt-druck'] = { kopf: html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) }
      await overlay('Datenblatt (Druckvorschau)', '', { iframeHtml: html, hoehe: 760 })
    }, { ziel: ueberlagerung })
    await S('datenblatt-pdf', async () => {
      const n0 = await dlZahl()
      await klickIn(D(), /PDF speichern|Save PDF/i)
      const d = await wartDownload(n0, 60000)
      await zeigeDatei('datenblatt-pdf', d)
    }, { ziel: ueberlagerung })
    await a.zu()

    // Kabel-Stückliste
    await abschnitt('Kabel-Stückliste')
    await S('bom-oeffnen', () => exportOeffnen(2), { ziel: dlgZiel })
    await S('bom-rentman-eingabe', async () => {
      await D().locator('input[type="number"]').first().fill('2')
    }, { ziel: dlgZiel })
    await S('bom-rentman-verwerfen', () => klickIn(D(), /Verwerfen|Discard/i), { ziel: dlgZiel })
    await S('bom-csv', async () => {
      const n0 = await dlZahl()
      await klickIn(D(), /CSV/i)
      await zeigeDatei('bom-csv', await wartDownload(n0))
    }, { ziel: ueberlagerung })
    await S('bom-pdf', async () => {
      const n0 = await dlZahl()
      await klickIn(D(), /Als PDF herunterladen|Download as PDF/i)
      await zeigeDatei('bom-pdf', await wartDownload(n0))
    }, { ziel: ueberlagerung })
    await S('bom-drucken', async () => {
      const n0 = await druckZahl()
      await klickIn(D(), /^\s*(Drucken|Print)\s*$/i)
      await zeigePdfBytes('bom-druck', await wartDruck(n0))
    }, { ziel: ueberlagerung })
    await a.zu()

    // Geräte-Stückliste
    await abschnitt('Geräte-Stückliste')
    await S('geraete-bom-oeffnen', () => exportOeffnen(3), { ziel: dlgZiel })
    await S('geraete-bom-csv', async () => {
      const n0 = await dlZahl()
      await klickIn(D(), /St(ü|u)ckliste als CSV|Device BOM as CSV/i)
      await zeigeDatei('geraete-bom-csv', await wartDownload(n0))
    }, { ziel: ueberlagerung })
    await S('geraete-bom-typ-liste', async () => {
      await listeAuf(D().locator('select').first())
    }, { ziel: dlgZiel })
    await listeZu(D().locator('select').first()).catch(() => {})
    await a.zu()

    // Racks & Gruppen
    await abschnitt('Racks & Gruppen')
    await S('racks-oeffnen', () => exportOeffnen(4), { ziel: dlgZiel })
    await S('racks-papier', async () => {
      await listeAuf(D().locator('select').first())
    }, { ziel: dlgZiel })
    await listeZu(D().locator('select').first()).catch(() => {})
    await S('racks-filter-leer', () => D().getByRole('textbox').first().fill('zzz'), { ziel: dlgZiel })
    await D().getByRole('textbox').first().fill('')
    await S('racks-pdf', async () => {
      const n0 = await dlZahl()
      await D().getByRole('button', { name: /^PDF$/ }).first().click()
      await zeigeDatei('racks-pdf', await wartDownload(n0))
    }, { ziel: ueberlagerung })
    await a.zu()
    await S('racks-drucken', async () => {
      await exportOeffnen(4)
      const n0 = await druckZahl()
      await D().getByRole('button', { name: /Drucken|Print/i }).first().click()
      await zeigePdfBytes('racks-druck', await wartDruck(n0))
    }, { ziel: ueberlagerung })
    await a.zu()

    // Tally leer
    await abschnitt('Tally leer')
    await S('tally-leer', () => exportOeffnen(5), { ziel: dlgZiel })
    await a.zu()

    // Unterlagen-Stapel
    await abschnitt('Unterlagen-Stapel')
    await S('stapel-oeffnen', () => exportOeffnen(6), { ziel: dlgZiel })
    await S('stapel-blaetter', async () => {
      const boxen = D().locator('input[type="checkbox"]')
      await boxen.nth(1).check()
      await boxen.nth(7).check()
    }, { ziel: dlgZiel })
    await S('stapel-papier', async () => {
      await listeAuf(D().locator('select').nth(0))
    }, { ziel: dlgZiel })
    await listeZu(D().locator('select').nth(0)).catch(() => {})
    await S('stapel-farbe', async () => {
      await listeAuf(D().locator('select').nth(1))
    }, { ziel: dlgZiel })
    await listeZu(D().locator('select').nth(1)).catch(() => {})
    await S('stapel-glossar', async () => {
      const n = await D().locator('input[type="checkbox"]').count()
      await D().locator('input[type="checkbox"]').nth(n - 1).uncheck()
    }, { ziel: dlgZiel })
    await S('stapel-drucken', async () => {
      const n = await D().locator('input[type="checkbox"]').count()
      await D().locator('input[type="checkbox"]').nth(n - 1).check()
      const n0 = await srcdocZahl()
      await klickIn(D(), /Stapel drucken|Print packet/i)
      const html = await wartSrcdoc(n0)
      dateien['stapel-druck'] = { kopf: html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) }
      await overlay('Unterlagen-Stapel (Druckvorschau)', '', { iframeHtml: html, hoehe: 820 })
    }, { ziel: ueberlagerung })
    await a.zu()

    // Stage-Plot ohne Audio
    await abschnitt('Stage-Plot ohne Audio')
    await S('stageplot-ohne-audio', async () => {
      const n0 = await dlZahl()
      await a.menue('app.menu.file', 'app.menu.tools.stagePlot')
      await zeigeDatei('stageplot-ohne-audio', await wartDownload(n0))
    }, { ziel: ueberlagerung })
    await a.zu()
  }

  // ═══════════════════════════════════════════════════════════════ PHASE 2
  if (laeuft('phase2')) {
    await abschnitt('Beispieldaten laden')
    await projektLaden(pfadBeispiel)

    // ── Patchliste
    await abschnitt('Patchliste')
    await S('patch-oeffnen', () => a.menue('app.menu.file', 'app.menu.tools.patchList'), { ziel: dlgZiel })
    await S('patch-suche', () => D().getByRole('textbox').first().fill('XLR'), { ziel: dlgZiel })
    await D().getByRole('textbox').first().fill('')
    await S('patch-ebene', async () => {
      await listeAuf(D().locator('select').nth(0))
    }, { ziel: dlgZiel })
    await listeZu(D().locator('select').nth(0)).catch(() => {})
    await S('patch-ebene-audio', async () => {
      await D().locator('select').nth(0).selectOption({ label: 'audio' })
    }, { ziel: dlgZiel })
    await S('patch-sortierung', () => D().locator('th').nth(6).click(), { ziel: dlgZiel })
    await S('patch-leer', async () => {
      await D().getByRole('textbox').first().fill('qqqq')
    }, { ziel: dlgZiel })
    await D().getByRole('textbox').first().fill('')
    await D().locator('select').nth(0).selectOption({ value: '' })
    await S('patch-fussleiste', async () => {}, { ziel: () => D().locator('footer') })
    await S('patch-csv', async () => {
      const n0 = await dlZahl()
      await klickIn(D(), /Export CSV|CSV exportieren/i)
      await zeigeDatei('patch-csv', await wartDownload(n0))
    }, { ziel: ueberlagerung })
    await S('patch-xlsx', async () => {
      const n0 = await dlZahl()
      await klickIn(D(), /Export XLSX|XLSX exportieren/i)
      const d = await wartDownload(n0)
      dateien['patch-xlsx'] = { datei: d.name, bytes: Buffer.from(d.b64, 'base64').length }
      await overlay(d.name, `<p style="font-size:13px;margin:8px">${esc(d.name)} — ${Buffer.from(d.b64, 'base64').length} Bytes</p>`, { breite: 520 })
    }, { ziel: ueberlagerung })
    await S('patch-etiketten-pdf', async () => {
      const n0 = await dlZahl()
      await klickIn(D(), /Etiketten \+ QR|Labels \+ QR/i)
      await zeigeDatei('patch-etiketten', await wartDownload(n0))
    }, { ziel: ueberlagerung })
    for (const [i, w] of ['generic', 'brother', 'dymo'].entries()) {
      await S(`patch-etikett-csv-${w}`, async () => {
        const sel = D().locator('select').filter({ has: win.locator('option[value="brother"]') })
        await sel.selectOption(w)
        const n0 = await dlZahl()
        await klickIn(D(), /Etiketten-CSV|Label CSV/i)
        await zeigeDatei(`patch-etikett-${w}`, await wartDownload(n0))
      }, { ziel: ueberlagerung })
    }

    // Kanalliste
    await S('kanal-sichten', async () => {
      const sel = D().locator('select').filter({ has: win.locator('option[value="venue"]') })
      await listeAuf(sel)
    }, { ziel: dlgZiel })
    await listeZu(D().locator('select').filter({ has: win.locator('option[value="venue"]') })).catch(() => {})
    for (const w of ['band', 'venue', 'stage', 'console', 'monitor', 'owner']) {
      await S(`kanal-${w}`, async () => {
        const sel = D().locator('select').filter({ has: win.locator('option[value="venue"]') })
        await sel.selectOption(w)
        const n0 = await dlZahl()
        await klickIn(D(), /Kanalliste|Channel list/i)
        await zeigeDatei(`kanal-${w}`, await wartDownload(n0))
      }, { ziel: ueberlagerung })
    }

    // Szenendatei
    await S('szene-lesen-1', async () => {
      await D().locator('input[type="file"]').setInputFiles(pfadScn1)
      await win.waitForTimeout(700)
    }, { ziel: dlgZiel })
    await S('szene-zuordnung', async () => {
      const sel = D().locator('select').filter({ has: win.locator('option[value="by-number"]') })
      await listeAuf(sel)
    }, { ziel: dlgZiel })
    await listeZu(D().locator('select').filter({ has: win.locator('option[value="by-number"]') })).catch(() => {})
    await S('szene-nach-nummer', async () => {
      const sel = D().locator('select').filter({ has: win.locator('option[value="by-number"]') })
      await sel.selectOption('by-number')
    }, { ziel: dlgZiel })
    await S('szene-kanaele-csv', async () => {
      const n0 = await dlZahl()
      await klickIn(D(), /^(Kan(ä|a)le|Channels)$/i)
      await zeigeDatei('szene-kanaele', await wartDownload(n0))
    }, { ziel: ueberlagerung })
    await S('szene-zuordnung-csv', async () => {
      const n0 = await dlZahl()
      await klickIn(D(), /^(Zuordnung|Match)$/i)
      await zeigeDatei('szene-zuordnung', await wartDownload(n0))
    }, { ziel: ueberlagerung })
    await S('szene-lesen-2', async () => {
      await D().locator('input[type="file"]').setInputFiles(pfadScn2)
      await win.waitForTimeout(700)
    }, { ziel: dlgZiel })
    await S('szene-aenderungen-csv', async () => {
      const n0 = await dlZahl()
      await klickIn(D(), /^(.nderungen|Changes)$/i)
      await zeigeDatei('szene-aenderungen', await wartDownload(n0))
    }, { ziel: ueberlagerung })
    await a.zu()

    // Stage-Plot mit Audio
    await abschnitt('Stage-Plot')
    await S('stageplot-mit-audio', async () => {
      const n0 = await dlZahl()
      await a.menue('app.menu.file', 'app.menu.tools.stagePlot')
      const d = await wartDownload(n0)
      dateien['stageplot'] = { datei: d.name }
      const svg = Buffer.from(d.b64, 'base64').toString('utf8')
      dateien['stageplot'].kopf = svg.match(/<text[^>]*>[^<]*<\/text>/g)?.slice(0, 40).map((t) => t.replace(/<[^>]+>/g, ''))
      await overlay(d.name, `<img style="display:block;max-width:100%;max-height:900px;margin:auto" src="data:image/svg+xml;base64,${d.b64}">`, { breite: 1100 })
    }, { ziel: ueberlagerung })
    await a.zu()

    // Tally mit Daten
    await abschnitt('Tally')
    await S('tally-karte', () => exportOeffnen(5), { ziel: dlgZiel })
    await S('tally-csv', async () => {
      const n0 = await dlZahl()
      await klickIn(D(), /Tally-Karte als CSV|Tally map as CSV/i)
      await zeigeDatei('tally-csv', await wartDownload(n0))
    }, { ziel: ueberlagerung })
    await S('tally-pi-json', async () => {
      const n0 = await dlZahl()
      await klickIn(D(), /tally-pi/i)
      await zeigeDatei('tally-pi', await wartDownload(n0))
    }, { ziel: ueberlagerung })
    await S('tally-mv-csv', async () => {
      const n0 = await dlZahl()
      await D().getByRole('button', { name: /Vision mixer/ }).first().click()
      await zeigeDatei('tally-mv', await wartDownload(n0))
    }, { ziel: ueberlagerung })
    await S('tally-vorshow-csv', async () => {
      const n0 = await dlZahl()
      await klickIn(D(), /Vor-Show-Liste|Pre-show list/i)
      await zeigeDatei('tally-vorshow', await wartDownload(n0))
    }, { ziel: ueberlagerung })
    await S('tally-pfad-liste', async () => {
      const s = D().locator('select').first()
      await listeAuf(s)
    }, { ziel: dlgZiel })
    await listeZu(D().locator('select').first()).catch(() => {})
    await S('tally-gesehen', async () => {
      const sels = D().locator('select')
      const n = await sels.count()
      // Programm-Beobachtung der ersten Rolle wählen
      await sels.nth(1).selectOption({ index: 1 })
    }, { ziel: dlgZiel })
    await S('tally-gesehen-festhalten', () => klickIn(D(), /^(gesehen|seen)$/i), { ziel: dlgZiel })
    await a.zu()

    // Kabel-Stückliste mit Lagerlängen
    await abschnitt('BOM mit Lagerlängen')
    await S('bom-lagerlaengen', () => exportOeffnen(2), { ziel: dlgZiel })
    await S('bom-rentman-geplant', async () => {
      await D().locator('input[type="number"]').first().fill('3')
    }, { ziel: dlgZiel })
    await S('bom-rentman-speichern', () => klickIn(D(), /Rentman-Planung speichern|Save Rentman plan/i), { ziel: dlgZiel })
    await S('bom-csv-lager', async () => {
      const n0 = await dlZahl()
      await klickIn(D(), /CSV/i)
      await zeigeDatei('bom-csv-lager', await wartDownload(n0))
    }, { ziel: ueberlagerung })
    await S('bom-pdf-lager', async () => {
      const n0 = await dlZahl()
      await klickIn(D(), /Als PDF herunterladen|Download as PDF/i)
      await zeigeDatei('bom-pdf-lager', await wartDownload(n0))
    }, { ziel: ueberlagerung })
    await a.zu()
    await S('bom-einstellungen-lager', async () => {
      await win.getByRole('button', { name: /Einstellungen|Settings/i }).first().click()
      await win.waitForTimeout(800)
      await win.waitForTimeout(600)
      await D().getByText(/Verf(ü|u)gbare Lagerl(ä|a)ngen|Available stock lengths/i).first().scrollIntoViewIfNeeded()
    }, { ziel: dlgZiel })
    await a.zu()

    // ── Festinstallation
    await abschnitt('Festinstallation')
    await S('doku-oeffnen', () => a.menue('app.menu.file', 'app.menu.tools.installDocs'), { ziel: dlgZiel })
    await S('doku-bearbeiter', () => D().getByRole('textbox').first().fill('Lars Z.'), { ziel: dlgZiel })
    await S('doku-empfaenger', () => D().getByRole('textbox').nth(1).fill('Kamera'), { ziel: dlgZiel })
    await S('doku-reserve', async () => { await D().locator('input[type="number"]').first().fill('15') }, { ziel: dlgZiel })
    const dokus = [
      ['pull', /Pull|Zieh/i], ['term', /Termination|Abschluss/i], ['sched', /Cable schedule|Kabel-Schedule|Kabelliste|Kabel-Register/i],
      ['bom', /Cable BOM|Kabel-St/i], ['asset', /Asset register|Asset-Register|Anlagen/i], ['handover', /Handover|.bergabe/i],
      ['abnahme', /Acceptance|Abnahme/i], ['maengel', /Defects|M.ngel/i], ['wartung', /Maintenance|Wartung/i],
      ['konfig', /Configuration|Konfig/i], ['steckbrief', /Device cards|Steckbrief|Ger.te-Steckbrief/i],
      ['bedien', /Operator|Bedien/i], ['kamerapos', /Camera positions|Kamera-Pos/i], ['anhaenge', /Attachment index|Anh.nge-Index|Anh.nge/i],
      ['signalwege', /Signal paths|Signalwege/i], ['trassenplan', /Route plan|Trassenplan/i], ['durchgaenge', /Crossings|Durchg.nge/i],
    ]
    // Die Knöpfe stehen in einem Raster; ihre Reihenfolge ist die des Codes.
    const raster = () => D().locator('div.grid > button')
    const anzahl = await raster().count()
    console.log('Dokument-Knöpfe:', anzahl)
    for (let i = 0; i < anzahl; i += 1) {
      const key = dokus[i]?.[0] ?? `dok${i}`
      await S(`doku-${String(i + 1).padStart(2, '0')}-${key}`, async () => {
        const knopf = raster().nth(i)
        await knopf.scrollIntoViewIfNeeded()
        const beschriftung = (await knopf.innerText()).split('\n')[0]
        const n0 = await dlZahl()
        await knopf.click()
        const d = await wartDownload(n0, 30000)
        await zeigeDatei(`doku-${key}`, d)
        dateien[`doku-${key}`].knopf = beschriftung
      }, { ziel: ueberlagerung })
    }
    await overlayWeg()
    await S('doku-qr-abschnitt', async () => {
      await D().getByText(/QR-\/Asset-IDs|QR\/asset IDs/i).first().scrollIntoViewIfNeeded()
    }, { ziel: dlgZiel })
    await S('doku-ids-vergeben', () => klickIn(D(), /QR-\/Asset-IDs vergeben|Assign QR\/asset IDs/i), { ziel: dlgZiel })
    await S('doku-qr-pdf', async () => {
      const n0 = await dlZahl()
      await klickIn(D(), /QR-Etiketten \(PDF\)|QR labels \(PDF\)/i)
      await zeigeDatei('doku-qr', await wartDownload(n0))
    }, { ziel: ueberlagerung })
    await S('doku-beschriftung-quelle-ziel', () => klickIn(D(), /AVIXA/i), { ziel: dlgZiel })
    await S('doku-ueberschreiben', async () => {
      await D().getByText(/vorhandene Namen .berschreiben|overwrite existing names/i).first().click()
      await klickIn(D(), /AVIXA/i)
    }, { ziel: dlgZiel })
    await S('doku-anhaenge', async () => {
      await D().getByText(/^(Anh(ä|a)nge|Attachments)/).first().scrollIntoViewIfNeeded()
    }, { ziel: dlgZiel })
    await S('doku-rueckkanal', async () => {
      await D().getByText(/Feld-R(ü|u)ckmeldungen|Field feedback/i).first().scrollIntoViewIfNeeded()
    }, { ziel: dlgZiel })
    await S('doku-rueckkanal-uebernehmen', async () => {
      await D().locator('button[title*="Apply"], button[title*="bernehmen"], button[title*="Anwenden"]').first().click()
    }, { ziel: dlgZiel })
    await S('doku-rueckkanal-verwerfen', async () => {
      await D().locator('button[title*="Discard"], button[title*="Verwerfen"]').first().click()
    }, { ziel: dlgZiel })
    await S('doku-protokoll', async () => {
      await D().getByText(/Changelog|.nderungsprotokoll/i).first().scrollIntoViewIfNeeded()
    }, { ziel: dlgZiel })
    await S('doku-protokoll-leeren', async () => {
      await D().getByRole('button', { name: /Leeren|Clear/i }).first().click()
    }, { ziel: dlgZiel })
    await a.zu()

    // ── Register nach Ausgaben und Änderung
    await abschnitt('Register')
    await S('register-gefuellt', () => a.menue('app.menu.file', 'app.menu.file.documentLog'), { ziel: dlgZiel })
    await a.zu()

    // ── Vergleich: Datei
    await abschnitt('Vergleich')
    await oeffnenMit(pfadAlt)
    await S('vergleich-datei-gewaehlt', async () => {
      await a.menue('app.menu.file', 'app.menu.file.planCompare')
      await klickIn(D(), /Vergleichs-Datei|comparison file/i)
      await win.waitForTimeout(600)
    }, { ziel: dlgZiel })
    await S('vergleich-csv', async () => {
      const n0 = await dlZahl()
      await klickIn(D(), /Als CSV exportieren|Export as CSV/i)
      await zeigeDatei('vergleich-csv', await wartDownload(n0))
    }, { ziel: ueberlagerung })
    await standardAbfang()
    await a.zu()
    // Revision festschreiben, Plan ändern, mit Revision vergleichen
    await S('revision-festschreiben', async () => {
      await a.menue('app.menu.tools', 'app.menu.tools.revisions')
      await D().getByPlaceholder(/Label|Bezeichnung/i).fill('Probe 1')
      await D().getByPlaceholder(/Note|Notiz/i).fill('Stand nach der Probe')
      await klickIn(D(), /Festschreiben|Commit/i)
    }, { ziel: dlgZiel })
    await a.zu()
    await S('plan-aendern', async () => {
      await a.menue('app.menu.file', 'app.menu.tools.installDocs')
      await klickIn(D(), /AVIXA/i)
    }, { ziel: dlgZiel })
    await a.zu()
    await S('vergleich-revision-auswahl', async () => {
      await a.menue('app.menu.file', 'app.menu.file.planCompare')
      await listeAuf(D().locator('select').first())
    }, { ziel: dlgZiel })
    await listeZu(D().locator('select').first()).catch(() => {})
    await S('vergleich-revision', async () => {
      await D().locator('select').first().selectOption({ index: 1 })
      await win.waitForTimeout(600)
    }, { ziel: dlgZiel })
    await a.zu()

    // ── Anmerkungen importieren
    await abschnitt('Anmerkungen')
    await oeffnenMit(pfadViewer)
    await S('anmerkungen-import', () => a.menue('app.menu.file', 'app.menu.file.importAnnotations'), { ziel: dlgZiel })
    await a.zu()
    await S('anmerkungen-import-zweites-mal', () => a.menue('app.menu.file', 'app.menu.file.importAnnotations'), { ziel: dlgZiel })
    await a.zu()
    await standardAbfang()
    await S('viewer-exportiert-daten', async () => {
      await speichernMit(join(ARB, 'daten.cpviewer'))
      await a.menue('app.menu.file', 'app.menu.file.exportViewer')
    }, { ziel: dlgZiel })
    await standardAbfang()
    await a.zu()
  }

  f.speichern(new URL(`./export.${sprache}.json`, import.meta.url))
  const pfadJson = new URL(`./export.${sprache}.json`, import.meta.url)
  const roh = JSON.parse(readFileSync(pfadJson, 'utf8'))
  roh.dateien = dateien
  writeFileSync(pfadJson, JSON.stringify(roh, null, 2))
  await a.ende()
  console.log('FERTIG')
}

await lauf()
