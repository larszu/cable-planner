#!/usr/bin/env node

/**
 * Handbuch-Aufnahmen für das Kapitel „Racks".
 *
 *   node scripts/handbuch/bereiche/rack.mjs de
 *   node scripts/handbuch/bereiche/rack.mjs en
 *
 * Ablauf (ein App-Start, ein Bildstrom `rack-<nn>-<name>.jpg`):
 *   A  Racks-Reiter der Bibliothek
 *   B  Wege ins Rack-Fenster (Werkzeuge, Reiter, Auswahl)
 *   C  Neues Rack von Grund auf: Kopf, Bibliothek, Patchblende, Shelf,
 *      Nicht-Rack-Gerät, Ansichten, Verschieben, Eigenschaften, Zuschneiden,
 *      Konflikte, Speichern
 *   D  Beispiel-Rack bearbeiten: Live-Vorschau, interne Verkabelung, 3D, Export
 *   E  Rack-Editor (Unter-Canvas) eines platzierten Racks
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

  // ═════════════ B — Wege ins Rack-Fenster ═════════════
  await S('menue-werkzeuge', async () => {
    await a.menue('app.menu.tools')
    await w.getByRole('menuitem', { name: a.muster('app.menu.tools.newRack') }).first().hover()
  }, menuBox)
  await S('rack-builder-eintrag', async () => {
    await a.menue('app.menu.tools', 'app.menu.tools.rackBuilder')
    await pause(2500)
  })
  await a.zu()
  await S('auswahl-markiert', async () => {
    await w.locator('.react-flow__node', { hasText: 'Camera 2' }).first().click({ position: { x: 20, y: 10 } })
    await w.locator('.react-flow__node', { hasText: 'Vision mixer' }).first().click({ position: { x: 20, y: 10 }, modifiers: ['Shift'] })
    await pause(600)
  })
  await S('aus-auswahl-builder', async () => {
    await w.locator(`button[title*="${de ? 'im 2D-Rack-Builder anordnen' : 'in the 2D rack builder'}"]`).first().click()
    await pause(1800)
  }, () => rb())
  await builderZu()

  // ═════════════ C — Neues Rack von Grund auf ═════════════
  await S('neues-rack-offen', async () => {
    await a.menue('app.menu.tools', 'app.menu.tools.newRack')
    await pause(2200)
  }, () => rb())
  await S('leer-speichern-fehler', async () => {
    await rb().getByRole('button', { name: T('rack.saveNewBtn') }).click()
  }, oben(260))
  await S('3d-reiter-leer', async () => {
    await rb().getByRole('button', { name: /^\s*3D\s*$/ }).click()
    await pause(600)
  }, mitte(0.25, 0.75, 300))
  await S('export-3d-warnung', async () => {
    await rb().getByRole('button', { name: T('rack.exportBtn') }).click()
    await rb().getByRole('button', { name: T('rack.export.png3d') }).click()
    await pause(600)
  }, dlg)
  await dlg().getByRole('button').last().click().catch(() => {})
  await pause(500)
  await rb().getByRole('button', { name: /^\s*2D\s*$/ }).click().catch(() => {})

  await S('name-getippt', async () => { await rb().locator('input[aria-required="true"]').fill(NAME) }, oben(190))
  await S('hoehe-getippt', async () => { await rb().locator('input[type=number]').nth(0).fill('20') }, () => rb())
  await S('tiefe-getippt', async () => { await rb().locator('input[type=number]').nth(1).fill('900') }, oben(190))
  await S('export-menue', async () => {
    await rb().getByRole('button', { name: T('rack.exportBtn') }).click()
    await pause(400)
  }, () => teil(rb, (b) => ({ x: b.x + b.width - 420, y: b.y, width: 420, height: 320 })))
  await rb().getByRole('button', { name: T('rack.exportBtn') }).click().catch(() => {})

  // Bibliothek-Spalte
  await S('bibliothek-suche', async () => {
    await rb().getByPlaceholder(T('rack.searchDevicesPlaceholder')).fill('Clear-Com')
    await pause(500)
  }, links(0.3, 520))
  await S('ins-rack-voll', async () => {
    await karte(CS).locator('button', { hasText: '+' }).first().click()
    await pause(600)
  }, () => rb())
  await S('mount-menue', async () => {
    await karte(MS).locator('button[aria-haspopup="menu"]').click()
    await pause(400)
  }, () => teil(rb, (b) => ({ x: b.x, y: b.y + 250, width: b.width * 0.34, height: 380 })))
  await S('mount-hinten', async () => {
    await w.getByRole('menuitem', { name: a.muster('rackAdd.rearOnly') }).click()
    await pause(600)
  }, () => rb())
  await S('mount-vorne', async () => {
    await karte(SB).locator('button[aria-haspopup="menu"]').click()
    await w.getByRole('menuitem', { name: a.muster('rackAdd.frontOnly') }).click()
    await pause(600)
  }, () => rb())
  await S('nicht-rack-liste', async () => {
    await rb().getByPlaceholder(T('rack.searchDevicesPlaceholder')).fill('ATEM Mini')
    await rb().getByLabel(T('rack.showNonRack')).check()
    await pause(600)
  }, links(0.3, 520))

  // Patchblende
  await rb().getByLabel(T('rack.showNonRack')).uncheck().catch(() => {})
  await rb().getByPlaceholder(T('rack.searchDevicesPlaceholder')).fill('').catch(() => {})
  await S('patch-dialog-offen', async () => {
    await rb().getByRole('button', { name: T('rack.patchPanelBtn') }).click()
    await pause(600)
  }, dlg)
  await S('patch-name', async () => { await dlg().locator('input').first().fill(PATCH) }, dlg)
  await S('patch-portzahl', async () => {
    await dlg().getByRole('button', { name: '16', exact: true }).click()
  }, dlg)
  await S('patch-montage', async () => {
    await dlg().locator('select').selectOption('rear')
  }, dlg)
  await S('patch-adapter-an', async () => {
    await dlg().getByLabel(T('rack.patchPanel.adapter'), { exact: false }).check()
    await pause(400)
  }, dlg)
  await S('patch-stecker-auswahl', async () => {
    await dlg().getByRole('button', { name: T('rack.patchPanel.rearConnector') }).click()
    await pause(500)
  }, () => w.locator('[role="dialog"]').last())
  await S('patch-stecker-gesucht', async () => {
    await w.locator('[role="dialog"]').last().getByRole('textbox').fill('RJ45')
    await pause(500)
  }, () => w.locator('[role="dialog"]').last())
  await S('patch-stecker-gewaehlt', async () => {
    await w.locator('[role="dialog"]').last().locator('button[title]').first().click()
    await pause(500)
  }, dlg)
  await S('patch-reiter-ports', async () => {
    await dlg().getByRole('button', { name: a.muster('rack.patchPanel.tab.perPort') }).click()
    await pause(500)
  }, dlg)
  await S('patch-port-beschriftet', async () => {
    await dlg().locator('tbody tr').first().locator('input').first().fill('CAM 1')
  }, dlg)
  await S('patch-erstellt', async () => {
    await dlg().getByRole('button', { name: T('rack.patchPanel.create'), exact: true }).click()
    await pause(700)
  }, () => rb())

  // Rack-Shelf
  await S('shelf-dialog-offen', async () => {
    await rb().getByRole('button', { name: T('rack.shelfBtn') }).click()
    await pause(600)
  }, dlg)
  await S('shelf-ausgefuellt', async () => {
    await dlg().locator('input').nth(0).fill(SHELF)
    await dlg().locator('input[type=number]').nth(0).fill('2')
  }, dlg)
  await S('shelf-erstellt', async () => {
    await dlg().getByRole('button', { name: T('rack.shelf.create') }).click()
    await pause(700)
  }, () => rb())

  // Nicht-Rack-Gerät
  await S('nicht-rack-karte', async () => {
    await rb().getByPlaceholder(T('rack.searchDevicesPlaceholder')).fill('ATEM Mini')
    await rb().getByLabel(T('rack.showNonRack')).check()
    await pause(600)
  }, links(0.3, 420))
  await S('nicht-rack-dialog', async () => {
    await karte(ATEM).locator('button', { hasText: '+' }).first().click()
    await pause(600)
  }, dlg)
  await S('nicht-rack-hoehe', async () => { await dlg().locator('input[type=number]').first().fill('2') }, dlg)
  await S('nicht-rack-shelf', async () => {
    await dlg().getByRole('button', { name: a.muster('rack.nonRack.option.shelf') }).click()
    await pause(400)
  }, dlg)
  await S('nicht-rack-breite-drittel', async () => {
    await dlg().getByRole('button', { name: '1/2', exact: true }).click()
  }, dlg)
  await S('nicht-rack-hinzugefuegt', async () => {
    await dlg().getByRole('button', { name: T('rack.nonRack.add'), exact: true }).click()
    await pause(900)
  }, () => rb())
  await rb().getByLabel(T('rack.showNonRack')).uncheck().catch(() => {})
  await rb().getByPlaceholder(T('rack.searchDevicesPlaceholder')).fill('').catch(() => {})

  // Ansichten
  await S('ansicht-hinten', async () => { await rb().getByRole('button', { name: T('rack.viewMode.rear'), exact: true }).click(); await pause(500) }, () => rb())
  await S('ansicht-beide', async () => { await rb().getByRole('button', { name: T('rack.viewMode.both'), exact: true }).click(); await pause(500) }, () => rb())
  await S('ansicht-seite', async () => { await rb().getByRole('button', { name: T('rack.viewMode.side'), exact: true }).click(); await pause(500) }, () => rb())
  await S('ansicht-vorne', async () => { await rb().getByRole('button', { name: T('rack.viewMode.front'), exact: true }).click(); await pause(500) }, () => rb())
  await S('zoom-plus', async () => {
    const p = rb().getByRole('button', { name: T('rack.zoomIn') })
    await p.click(); await p.click(); await p.click()
    await pause(400)
  }, () => rb())
  await S('zoom-einpassen', async () => { await rb().getByRole('button', { name: T('rack.zoomFit'), exact: true }).click(); await pause(400) }, mitte(0.25, 0.75, 120))
  await S('stecker-symbole', async () => { await rb().getByLabel(T('rack.showConnectorSymbols')).check(); await pause(500) }, () => rb())
  await rb().getByLabel(T('rack.showConnectorSymbols')).uncheck().catch(() => {})

  // Verschieben
  await S('verschieben-nachher', async () => { await ziehe(CS, 4, { gesamt: 20 }) }, () => rb())
  await S('verschieben-frei-alt', async () => { await ziehe(CS, 0.5, { alt: true, gesamt: 20 }) }, mitte(0.25, 0.75, 480))
  await ziehe(CS, -0.5, { alt: true, gesamt: 20 }).catch(() => {})
  await S('bibliothek-ziehen', async () => {
    await rb().getByPlaceholder(T('rack.searchDevicesPlaceholder')).fill('Brompton Tessera S4')
    await pause(500)
    const quelle = karte('Tessera S4')
    const ziel = rb().locator('div.relative.mx-auto.overflow-hidden').first()
    const zb = await ziel.boundingBox()
    await quelle.dragTo(ziel, { targetPosition: { x: zb.width / 2, y: zb.height * 0.85 } })
    await pause(700)
  }, () => rb())
  await rb().getByPlaceholder(T('rack.searchDevicesPlaceholder')).fill('').catch(() => {})

  // Eigenschaften eines Geräts
  await S('eig-offen', async () => {
    await block(CS).dblclick()
    await pause(700)
  }, dlg)
  await S('eig-name', async () => { await dlg().locator('input').first().fill(de ? 'Sprechstelle Regie' : 'Control room station') }, dlg)
  await S('eig-hoehe', async () => { await dlg().locator('input[type=number]').nth(0).fill('2') }, dlg)
  await S('eig-hoehe-zurueck', async () => { await dlg().locator('input[type=number]').nth(0).fill('1') }, dlg)
  await S('eig-tiefe-montage', async () => {
    await dlg().locator('input[type=number]').nth(2).fill('350')
    await dlg().locator('select').selectOption('front')
  }, dlg)
  await S('eig-stl', async () => {
    await dlg().locator('input[type=file][accept*="stl"]').setInputFiles(STL)
    await pause(1500)
    await dlg().getByText(T('rack.stl.header')).scrollIntoViewIfNeeded()
  }, dlg)
  await S('eig-stl-entfernt', async () => {
    await dlg().getByRole('button', { name: T('common.remove') }).first().click()
    await pause(500)
  }, dlg)
  await S('eig-tiefenposition', async () => {
    await dlg().getByText(a.muster('rack.depthPos.title')).first().scrollIntoViewIfNeeded()
    await dlg().locator('details').first().locator('input').fill('200')
  }, dlg)
  await S('eig-portseite', async () => {
    await dlg().getByText(a.muster('rack.portSideSection.title')).first().scrollIntoViewIfNeeded()
    await dlg().getByRole('button', { name: a.muster('rack.portsAllFrontBtn') }).click()
    await pause(400)
  }, dlg)
  await S('eig-portseite-einzeln', async () => {
    await dlg().getByRole('button', { name: a.muster('rack.portsSwapBtn') }).click()
    await pause(400)
  }, dlg)
  await S('eig-port-umbenannt', async () => {
    await dlg().getByRole('button', { name: a.muster('rack.portsAllRearBtn') }).click()
    await dlg().getByTitle(T('rack.portRename')).first().fill(de ? 'Sprechkreis 1' : 'Party line 1')
  }, dlg)
  await S('eig-bilder', async () => {
    await dlg().getByText(a.muster('rack.panelImages.header')).scrollIntoViewIfNeeded()
  }, dlg)

  // Bild importieren und zuschneiden
  datei = BILD
  await S('crop-offen', async () => {
    await dlg().getByRole('button', { name: a.muster('rack.panelImages.import') }).first().click()
    await wartenBis(() => w.locator('[role="dialog"]').filter({ hasText: T('rackCrop.zoom') }).count().then((n) => n > 0), 8000)
    await pause(800)
  }, () => w.locator('[role="dialog"]').filter({ hasText: T('rackCrop.zoom') }).last())
  const cropDlg = () => w.locator('[role="dialog"]').filter({ hasText: T('rackCrop.zoom') }).last()
  await S('crop-zoom', async () => { await cropDlg().locator('input[type=range]').fill('2'); await pause(400) }, cropDlg)
  await S('crop-aspekt-frei', async () => { await cropDlg().getByLabel(T('rackCrop.lockAspect')).uncheck(); await pause(300) }, cropDlg)
  await S('crop-vorlage', async () => { await cropDlg().getByRole('button', { name: '4HE', exact: true }).click(); await pause(400) }, cropDlg)
  await S('crop-manuell', async () => { await cropDlg().locator('input[type=number]').nth(0).fill('0.05'); await pause(300) }, cropDlg)
  await S('crop-reset', async () => { await cropDlg().getByRole('button', { name: a.muster('rackCrop.reset') }).click(); await pause(400) }, cropDlg)
  await S('crop-tastatur', async () => {
    await cropDlg().locator('img').first().focus().catch(() => {})
    await w.keyboard.press('ArrowRight')
    await w.keyboard.press('ArrowRight')
    await pause(300)
  }, cropDlg)
  await S('crop-uebernommen', async () => {
    await cropDlg().getByRole('button', { name: T('rackCrop.confirm') }).click()
    await pause(700)
  }, dlg)
  await S('eig-bild-tauschen', async () => {
    await dlg().getByRole('button', { name: a.muster('rack.swapPhotosBtn') }).click()
    await pause(400)
  }, dlg)
  await S('eig-bild-entfernt', async () => {
    await dlg().getByTitle(T('rack.removeImage')).first().click()
    await pause(400)
  }, dlg)
  await S('eig-entfernen-frage', async () => {
    await dlg().getByRole('button', { name: T('rack.props.removeFromRack') }).click()
    await pause(500)
  }, dlg)
  await a.zu()
  await dlg().getByRole('button', { name: T('common.close'), exact: true }).last().click().catch(() => {})
  await pause(500)

  // Konflikte
  await S('konflikt-ueberlappung', async () => {
    await block(SB).dblclick()
    await pause(600)
    const sb = await block(CS).getAttribute('title')
    const start = /Start HE([\d.]+)/.exec(sb ?? '')?.[1] ?? '1'
    await dlg().locator('input[type=number]').nth(1).fill(start)
    await pause(500)
    await dlg().getByRole('button', { name: T('common.close'), exact: true }).last().click()
    await pause(500)
  }, oben(320))
  await S('konflikt-passt-nicht', async () => {
    await rb().locator('input[type=number]').nth(0).fill('3')
    await pause(600)
  }, oben(360))
  await rb().locator('input[type=number]').nth(0).fill('20').catch(() => {})
  await S('konflikt-nur-hinweis', async () => {
    await pause(300)
  }, unten(90))

  // Speichern
  await S('speichern', async () => {
    await rb().getByRole('button', { name: T('rack.saveNewBtn') }).click()
    await pause(1500)
  }, lib)

  // ═════════════ D — Beispiel-Rack bearbeiten ═════════════
  await S('karte-bearbeiten', async () => {
    await lib().getByText(DEMO).hover()
    await lib().getByRole('button', { name: T('library.tabs.racks.editAria') }).last().click()
    await pause(2200)
  }, () => rb())
  await S('live-vorschau', async () => { await pause(300) }, rechts(0.26, 560))
  await S('kopf-bearbeiten', async () => { await pause(200) }, oben(120))
  await S('fuss', async () => { await pause(200) }, unten(90))
  await S('verkabeln-offen', async () => {
    await rb().getByRole('button', { name: T('rack.internalWireBtn') }).click()
    await pause(2500)
  }, wire)
  await S('verkabeln-geraet', async () => {
    await wire().locator('.react-flow__node', { hasText: 'Vision mixer' }).first().click({ position: { x: 30, y: 12 } })
    await pause(700)
  }, wire)
  await S('verkabeln-kabel', async () => {
    await wire().locator('.react-flow__edge').first().locator('path').first().click({ force: true }).catch(() => {})
    await pause(700)
  }, wire)
  await S('verkabeln-kabel-menue', async () => {
    await wire().locator('.react-flow__edge').first().locator('path').first().click({ button: 'right', force: true }).catch(() => {})
    await pause(700)
  }, wire)
  await a.zu().catch(() => {})
  await pause(300)
  await S('verkabeln-neues-kabel', async () => {
    if (!(await wire().count())) {
      await rb().getByRole('button', { name: T('rack.internalWireBtn') }).click()
      await pause(2200)
    }
    const von = await handleMitte('Vision mixer', 'PGM Out')
    const nach = await handleMitte('IEC strip', 'Feed')
    if (!von || !nach) throw new Error(`Handle nicht gefunden ${JSON.stringify([von, nach])}`)
    await w.mouse.move(von.x, von.y)
    await w.mouse.down()
    for (let i = 1; i <= 12; i += 1) await w.mouse.move(von.x + ((nach.x - von.x) * i) / 12, von.y + ((nach.y - von.y) * i) / 12)
    await w.mouse.up()
    await pause(1500)
  }, wire)
  await S('verkabeln-fertig', async () => {
    await wire().getByRole('button', { name: T('common.done') }).click()
    await pause(700)
  }, unten(100))

  // 3D
  await S('3d-reiter', async () => {
    await rb().getByRole('button', { name: /^\s*3D\s*$/ }).click()
    await pause(3500)
  }, () => rb())
  const c3 = () => rb().locator('canvas').first()
  console.log('3D-Canvas:', JSON.stringify(await c3().boundingBox().catch(() => null)))
  await S('3d-freie-ports', async () => { await rb().getByRole('button', { name: T('rack.view.free'), exact: true }).click(); await pause(1500) }, () => rb())
  await S('3d-released', async () => { await rb().getByRole('button', { name: T('rack.view.released'), exact: true }).click(); await pause(1500) }, () => rb())
  await S('3d-alle', async () => { await rb().getByRole('button', { name: T('rack.view.all'), exact: true }).click(); await pause(1500) }, () => rb())
  await S('3d-drehen', async () => {
    const b = await c3().boundingBox()
    await w.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5)
    await w.mouse.down()
    for (let i = 1; i <= 10; i += 1) await w.mouse.move(b.x + b.width * 0.5 - i * 25, b.y + b.height * 0.5 - i * 4)
    await w.mouse.up()
    await pause(1200)
  }, () => rb())
  await S('3d-zoom', async () => {
    const b = await c3().boundingBox()
    await w.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5)
    for (let i = 0; i < 6; i += 1) await w.mouse.wheel(0, -300)
    await pause(1200)
  }, () => rb())
  await S('3d-pannen', async () => {
    const b = await c3().boundingBox()
    await w.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5)
    await w.mouse.down({ button: 'right' })
    for (let i = 1; i <= 10; i += 1) await w.mouse.move(b.x + b.width * 0.5 + i * 15, b.y + b.height * 0.5 + i * 10)
    await w.mouse.up({ button: 'right' })
    await pause(1200)
  }, () => rb())
  await S('3d-hoehe-hoch', async () => {
    await w.keyboard.down('Shift')
    await pause(900)
    await w.keyboard.up('Shift')
    await pause(800)
  }, () => rb())
  await S('3d-hoehe-runter', async () => {
    await w.keyboard.down(' ')
    await pause(1500)
    await w.keyboard.up(' ')
    await pause(800)
  }, () => rb())
  await S('3d-stecker-symbole', async () => { await rb().getByLabel(T('rack.showConnectorSymbols')).check(); await pause(1500) }, () => rb())
  await rb().getByLabel(T('rack.showConnectorSymbols')).uncheck().catch(() => {})
  await S('3d-geraet-gewaehlt', async () => {
    const b = await c3().boundingBox()
    await w.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.45)
    await pause(1200)
  }, () => rb())

  // Export-Menü, jeder Eintrag
  await S('export-alle-eintraege', async () => {
    await rb().getByRole('button', { name: T('rack.exportBtn') }).click()
    await pause(400)
  }, () => teil(rb, (b) => ({ x: b.x + b.width - 420, y: b.y, width: 420, height: 320 })))
  await S('export-stl', async () => {
    await Promise.race([rb().getByRole('button', { name: T('rack.export.stl') }).click(), pause(7000)])
    await pause(1500)
  }, oben(120))
  await S('export-png-3d', async () => {
    await rb().getByRole('button', { name: T('rack.exportBtn') }).click().catch(() => {})
    await Promise.race([rb().getByRole('button', { name: T('rack.export.png3d') }).click(), pause(9000)])
    await pause(2500)
  }, oben(120))
  await S('export-cpgroup', async () => {
    await rb().getByRole('button', { name: T('rack.exportBtn') }).click().catch(() => {})
    await Promise.race([rb().getByRole('button', { name: T('rack.export.cpgroup') }).click(), pause(7000)])
    await pause(1500)
  }, oben(120))
  await S('zurueck-zu-2d', async () => {
    await rb().getByRole('button', { name: /^\s*2D\s*$/ }).click()
    await pause(600)
    await rb().getByRole('button', { name: T('rack.exportBtn') }).click().catch(() => {})
    await Promise.race([rb().getByRole('button', { name: T('rack.export.png2d') }).click(), pause(9000)])
    await pause(2000)
  }, oben(120))
  await builderZu()

  // Aus dem Canvas: Black-Box-Rack
  await S('karte-platziert', async () => {
    await a.klick('library.tab.racks')
    await lib().getByText(DEMO).click()
    await pause(1200)
  })
  await S('blackbox-kontextmenue', async () => {
    const n = w.locator('.react-flow__node', { hasText: 'OB van' }).first()
    await n.click({ button: 'right', position: { x: 40, y: 10 } })
    await pause(700)
  })
  await S('blackbox-bearbeiten', async () => {
    await w.getByText(T('canvas.nodeMenu.openRackEditor'), { exact: false }).first().click()
    await pause(2200)
  }, oben(140))
  await builderZu()

  // ═════════════ E — Rack-Editor (Unter-Canvas) ═════════════
  await S('projekt-oeffnen-vorbereiten', async () => {
    await a.app.evaluate(({ dialog }, pfad) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] })
    }, PROJEKT)
    await a.menue('app.menu.file', 'app.menu.file.open')
    await pause(3000)
    const ok = w.getByRole('button', { name: /^(OK|Discard|Verwerfen|Open anyway|Trotzdem öffnen)$/i })
    if (await ok.count()) await ok.first().click().catch(() => {})
    await pause(1500)
  })
  await S('instanz-geraet-gewaehlt', async () => {
    await w.locator('.react-flow__node', { hasText: 'Vision mixer' }).first().click({ position: { x: 30, y: 12 } })
    await pause(800)
  })
  await S('instanz-editor-offen', async () => {
    await w.getByRole('button', { name: T('rackInstance.openEditor') }).first().click()
    await pause(2000)
  }, rackEd)
  await S('instanz-editor-ziehen', async () => {
    const n = rackEd().locator('.react-flow__node', { hasText: 'Multiviewer' }).first()
    const b = await n.boundingBox()
    await w.mouse.move(b.x + 30, b.y + 10)
    await w.mouse.down()
    for (let i = 1; i <= 8; i += 1) await w.mouse.move(b.x + 30, b.y + 10 - i * 12)
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
