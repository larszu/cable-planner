#!/usr/bin/env node

/**
 * Handbuch-Aufnahmen für das Kapitel „Racks".
 *
 *   node scripts/handbuch/bereiche/rack.mjs de
 *   node scripts/handbuch/bereiche/rack.mjs en
 *
 * Ablauf (ein App-Start, ein Bildstrom `rack-<nn>-<name>.jpg`):
 *   A  Racks-Reiter der Bibliothek: Karte, Export, Löschen, „Fürs Lager"
 *   B  Karte auf dem Plan platzieren, Kontextmenü, Rack-Editor (Rack-Builder des Racks)
 *   F  Aufräumen: Löschen, Leerzustand, „Fürs Lager" ohne Racks
 *
 * Testdaten (Bild, STL, Projektdatei) entstehen in einem Wegwerfordner; die
 * Adressen und Namen darin sind erfunden.
 */

import { starte } from '../app.mjs'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'

let sprache = 'de'
let de = true
let BILD = ''
let STL = ''
let PROJEKT = ''

// ───────────────────────── Testdateien ─────────────────────────
const TMP = mkdtempSync(join(tmpdir(), 'cp-rack-'))

const crcTab = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTab[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (t, d) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(d.length)
  const td = Buffer.concat([Buffer.from(t), d])
  const c = Buffer.alloc(4)
  c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}
/** Ein gezeichnetes Frontblenden-Bild (kein Foto): Blende, Display, Regler, Anzeigen. */
const frontBild = () => {
  const W = 1800
  const H = 360
  const px = new Uint8Array(W * H * 3)
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const i = (y * W + x) * 3
    px[i] = c[0]
    px[i + 1] = c[1]
    px[i + 2] = c[2]
  }
  const rect = (x0, y0, x1, y1, c) => {
    for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) set(x, y, c)
  }
  const circ = (cx, cy, r, c) => {
    for (let y = cy - r; y <= cy + r; y += 1) for (let x = cx - r; x <= cx + r; x += 1) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, c)
  }
  rect(0, 0, W, H, [58, 64, 74])
  rect(90, 90, 1710, 270, [190, 196, 205])
  rect(90, 90, 1710, 96, [230, 233, 238])
  rect(90, 264, 1710, 270, [120, 126, 135])
  rect(90, 90, 150, 270, [160, 166, 175])
  rect(1650, 90, 1710, 270, [160, 166, 175])
  for (const [cx, cy] of [[120, 120], [120, 240], [1680, 120], [1680, 240]]) circ(cx, cy, 10, [90, 96, 105])
  rect(210, 120, 560, 240, [25, 30, 38])
  rect(220, 130, 550, 230, [20, 90, 60])
  for (let i = 0; i < 8; i += 1) {
    circ(650 + i * 70, 150, 22, [40, 44, 52])
    circ(650 + i * 70, 150, 17, [210, 214, 220])
    rect(648 + i * 70, 132, 652 + i * 70, 150, [40, 44, 52])
  }
  for (let i = 0; i < 16; i += 1) rect(1240 + i * 24, 205, 1240 + i * 24 + 16, 235, [40, 44, 52])
  for (let i = 0; i < 4; i += 1) circ(1250 + i * 60, 140, 9, i % 2 === 0 ? [230, 60, 50] : [60, 200, 90])
  const rows = []
  for (let y = 0; y < H; y += 1) rows.push(Buffer.from([0]), Buffer.from(px.subarray(y * W * 3, (y + 1) * W * 3)))
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
const stlBox = (x, y, z, dx, dy, dz) => {
  const v = [[x, y, z], [x + dx, y, z], [x + dx, y + dy, z], [x, y + dy, z], [x, y, z + dz], [x + dx, y, z + dz], [x + dx, y + dy, z + dz], [x, y + dy, z + dz]]
  const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [2, 3, 7], [2, 7, 6], [1, 2, 6], [1, 6, 5], [3, 0, 4], [3, 4, 7]]
  return f.map((t) => `facet normal 0 0 0\n outer loop\n${t.map((i) => `  vertex ${v[i].join(' ')}\n`).join('')} endloop\nendfacet\n`).join('')
}

/** Ein Projekt, dessen Geräte zu einer Rack-Instanz gehören (für den Rack-Editor). */
const projektMitRackInstanz = () => {
  const inst = 'rack:beispiel-instanz'
  const label = de ? 'Regie-Rack (Instanz)' : 'Control room rack (instance)'
  const port = (id, name, dir) => ({ id, name, type: 'BNC', connectorType: 'BNC', direction: dir })
  const eq = (id, name, category, start, units, ins, outs) => ({
    id,
    name,
    category,
    x: 120,
    y: 80 + start * 60,
    width: 240,
    height: 100,
    inputs: ins,
    outputs: outs,
    isRackDevice: true,
    rackUnits: units,
    rackInstanceId: inst,
    rackInstanceLabel: label,
    rackInstanceStartUnit: start,
  })
  const equipment = [
    eq('r1', 'Patch panel', 'Patch panels', 0, 1, [port('r1i1', 'In 1', 'in'), port('r1i2', 'In 2', 'in')], [port('r1o1', 'Out 1', 'out'), port('r1o2', 'Out 2', 'out')]),
    eq('r2', 'Vision mixer', 'Mixer', 2, 2, [port('r2i1', 'In 1', 'in'), port('r2i2', 'In 2', 'in')], [port('r2o1', 'PGM Out', 'out')]),
    eq('r3', 'Multiviewer', 'Monitors', 6, 1, [port('r3i1', 'SDI In', 'in')], []),
  ]
  const cable = (id, name, f1, p1, t1, p2) => ({ id, name, type: 'BNC', length: 1, color: '#3b82f6', fromEquipmentId: f1, fromPortId: p1, toEquipmentId: t1, toPortId: p2, notes: '' })
  return {
    metadata: { name: 'Rack instance demo', description: '', createdAt: '2026-09-29T00:00:00.000Z', updatedAt: '2026-09-29T00:00:00.000Z', defaultVideoFormat: '1080p50' },
    equipment,
    cables: [cable('c1', 'Patch 1', 'r1', 'r1o1', 'r2', 'r2i1'), cable('c2', 'PGM', 'r2', 'r2o1', 'r3', 'r3i1')],
    locations: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
  }
}

/** Alle Aufnahmen dieses Kapitels mit einer bereits gestarteten App. */
export async function aufnehmen(a, spr) {
  sprache = spr
  de = spr === 'de'
  BILD = join(TMP, 'frontblende.png')
  STL = join(TMP, 'gehaeuse.stl')
  PROJEKT = join(TMP, 'rack-instanz.json')
  writeFileSync(BILD, frontBild())
  writeFileSync(STL, `solid gehaeuse\n${stlBox(0, 0, 0, 440, 44, 300)}${stlBox(20, 44, 20, 120, 10, 80)}${stlBox(300, 44, 20, 120, 10, 80)}endsolid gehaeuse\n`)
  writeFileSync(PROJEKT, JSON.stringify(projektMitRackInstanz()))
  const w = a.win
  w.setDefaultTimeout(30000)
  w.on('pageerror', (e) => console.log('  [pageerror]', String(e).split('\n')[0]))
  w.on('crash', () => console.log('  [CRASH]'))
  w.on('console', (m) => { if (m.type() === 'error') console.log('  [console.error]', m.text().slice(0, 160)) })
  const f = a.folge('rack')
  const T = (k) => a.text(k)
  console.log(`\nRack-Kapitel (${sprache}) — Testdateien in ${TMP}\n`)

  let datei = null
  w.on('filechooser', async (fc) => {
    if (datei) await fc.setFiles(datei).catch(() => {})
  })

  const S = (name, tun, ziel) => f.schritt(name, tun, ziel ? { ziel } : {})
  const pause = (ms) => w.waitForTimeout(ms)

  // Bereichslocatoren
  const lib = () => w.locator('aside:has(.spaltenkopf)').first()
  const rb = () => w.locator('[role="dialog"]').filter({ hasText: T('rack.field.name') }).first()
  const wire = () => w.locator('[role="dialog"]').filter({ hasText: T('rack.wire.title') }).first()
  const rackEd = () => w.locator('[role="dialog"]').filter({ hasText: T('rackEditor.title') }).first()
  const karte = (name) => rb().locator('div.group').filter({ hasText: name }).first()
  const block = (name) => rb().locator(`div.touch-none[title^="${name}"]`).first()

  /** Ausschnitt eines Bereichs als Bild (Attrappe eines Locators). */
  const teil = (loc, fn) => ({
    count: async () => 1,
    first: () => ({
      screenshot: async (o) => {
        const b = await loc().boundingBox()
        await w.screenshot({ path: o.path, type: o.type, quality: o.quality, animations: 'disabled', clip: fn(b) })
      },
    }),
  })
  const oben = (h) => () => teil(rb, (b) => ({ x: b.x, y: b.y, width: b.width, height: Math.min(h, b.height) }))
  const rechts = (anteil, h) => () => teil(rb, (b) => ({ x: b.x + b.width * (1 - anteil), y: b.y + 60, width: b.width * anteil, height: Math.min(h, b.height - 60) }))
  const links = (anteil, h) => () => teil(rb, (b) => ({ x: b.x, y: b.y + 150, width: b.width * anteil, height: Math.min(h, b.height - 150) }))
  const mitte = (x0, x1, h) => () => teil(rb, (b) => ({ x: b.x + b.width * x0, y: b.y + 150, width: b.width * (x1 - x0), height: Math.min(h, b.height - 150) }))
  const unten = (h) => () => teil(rb, (b) => ({ x: b.x, y: b.y + b.height - h, width: b.width, height: h }))

  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const dlg = () => a.dialog()
  const menuBox = () => a.menueFeld()

  const wartenBis = async (fn, ms = 6000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      if (await fn().catch(() => false)) return true
      await pause(200)
    }
    return false
  }

  async function builderZu() {
    if (!(await rb().count())) return
    await rb().getByRole('button', { name: new RegExp(`^${esc(T('common.cancel'))}$`) }).last().click().catch(() => {})
    await pause(500)
    const dis = w.getByRole('button', { name: new RegExp(`^${esc(T('common.discard'))}$`) })
    if (await dis.count()) await dis.first().click().catch(() => {})
    await pause(700)
  }

  /** Block im 2D-Rack senkrecht um `einheiten` HE ziehen. */
  async function ziehe(name, einheiten, { alt = false, gesamt = 20 } = {}) {
    const b = await block(name).boundingBox()
    const panel = await block(name).locator('xpath=..').boundingBox()
    const px = (panel.height / gesamt) * einheiten
    const x = b.x + b.width / 2
    const y = b.y + b.height / 2
    await w.mouse.move(x, y)
    if (alt) await w.keyboard.down('Alt')
    await w.mouse.down()
    for (let i = 1; i <= 8; i += 1) await w.mouse.move(x, y + (px * i) / 8)
    await w.mouse.up()
    if (alt) await w.keyboard.up('Alt')
    await pause(400)
  }

  /** Kabel-Handle eines Ports (Mitte) im Verkabelungs-Fenster. */
  async function handleMitte(geraet, port) {
    return wire().evaluate(
      (root, [g, p]) => {
        const nodes = [...root.querySelectorAll('.react-flow__node')].filter((n) => (n.textContent || '').includes(g))
        for (const n of nodes) {
          const leaves = [...n.querySelectorAll('*')].filter((e) => e.children.length === 0 && (e.textContent || '').trim() === p)
          for (const leaf of leaves) {
            let el = leaf
            while (el && el !== n) {
              const h = el.querySelector('.react-flow__handle')
              if (h) {
                const r = h.getBoundingClientRect()
                return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
              }
              el = el.parentElement
            }
          }
        }
        return null
      },
      [geraet, port],
    )
  }

  const NAME = de ? 'Regie-Rack A' : 'Control room rack A'
  const PATCH = de ? 'Patchfeld Regie' : 'Patch panel control room'
  const SHELF = de ? 'Ablage Regie' : 'Control room shelf'
  const DEMO = 'Example rack: small OB van'
  const CS = 'Clear-Com CS-702'
  const MS = 'Clear-Com MS-702'
  const SB = 'Clear-Com SB-704'
  const ATEM = 'Blackmagic ATEM Mini'

  // ═════════════ A — Racks-Reiter der Bibliothek ═════════════
  await S('racks-reiter', async () => { await a.klick('library.tab.racks') }, lib)
  await S('karte-hover', async () => { await lib().getByText(DEMO).hover() }, lib)
  await S('karte-exportieren', async () => {
    await lib().getByText(DEMO).hover()
    await Promise.race([lib().getByRole('button', { name: T('library.tabs.racks.exportAria') }).first().click(), pause(6000)])
    await pause(1500)
  }, lib)
  await S('karte-loeschen-frage', async () => {
    await lib().getByText(DEMO).hover()
    await lib().getByRole('button', { name: T('common.delete') }).first().click()
  }, dlg)
  await a.zu()
  await S('lager-meldung', async () => {
    await Promise.race([lib().getByRole('button', { name: T('library.tabs.racks.warehouse') }).click(), pause(6000)])
    await pause(1500)
  }, lib)

  // Aus dem Canvas: Black-Box-Rack
  await S('karte-platziert', async () => {
    await a.klick('library.tab.racks')
    await lib().getByText(DEMO).click()
    await pause(1200)
  })
  const kopfPos = async () => {
    const bb = await w.locator('.react-flow__node', { hasText: 'small OB van' }).first().boundingBox()
    return { x: bb.x + 60, y: bb.y + 14 }
  }
  await S('blackbox-kontextmenue', async () => {
    const p = await kopfPos()
    await w.mouse.click(p.x, p.y, { button: 'right' })
    await pause(700)
  })
  await S('rack-editor-offen', async () => {
    await w.getByText(T('canvas.nodeMenu.openRackEditor'), { exact: false }).first().click()
    await pause(2500)
  }, rackEd)
  await S('rack-editor-ziehen', async () => {
    const n = rackEd().locator('.react-flow__node', { hasText: 'Multiviewer' }).first()
    const bb = await n.boundingBox()
    await w.mouse.move(bb.x + 30, bb.y + 10)
    await w.mouse.down()
    for (let i = 1; i <= 8; i += 1) await w.mouse.move(bb.x + 30, bb.y + 10 - i * 12)
    await w.mouse.up()
    await pause(900)
  }, rackEd)
  await a.zu()

  // ═════════════ F — Aufräumen: Löschen, Leerzustand ═════════════
  await S('racks-liste-mehrere', async () => {
    await a.klick('library.tab.racks')
    await pause(500)
  }, lib)
  for (let i = 0; i < 4; i += 1) {
    const n = await lib().getByRole('button', { name: T('common.delete') }).count()
    if (!n) break
    await lib().getByRole('button', { name: T('common.delete') }).first().click({ force: true }).catch(() => {})
    await pause(500)
    const ok = w.getByRole('button', { name: new RegExp(`^${esc(T('common.delete'))}$`) }).last()
    if (await ok.count()) await ok.click().catch(() => {})
    await pause(500)
  }
  await S('leerzustand', async () => { await pause(300) }, lib)
  await S('lager-leer', async () => {
    await Promise.race([lib().getByRole('button', { name: T('library.tabs.racks.warehouse') }).click(), pause(5000)])
    await pause(800)
  }, lib)

  f.speichern(new URL(`./rack.${sprache}.json`, import.meta.url))

}

// Direkter Aufruf: eigene App starten.
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  const spr = process.argv[2] ?? 'de'
  const app = await starte({ sprache: spr, breite: 1500, hoehe: 950, thema: 'light' })
  await aufnehmen(app, spr)
  await app.ende()
  console.log('FERTIG')
}
