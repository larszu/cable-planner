#!/usr/bin/env node
// Handbuch-Aufnahmen, Kapitel „Bibliothek": die Bibliothek links mit den Reitern
// Geräte (Lokal / Geteilt / Rentman), Kabel, Gruppen und Racks.
//
//   node scripts/handbuch/bereiche/bibliothek.mjs de
//   node scripts/handbuch/bereiche/bibliothek.mjs en
//
// Beispieldaten (nur in dieser Aufnahme, nie in der App):
// - Geteilte Gerätebibliothek: vier Einträge mit je einem Status im lokalen Speicher.
// - Rentman: die Antworten des Hauptprozesses sind durch feste Beispielantworten
//   ersetzt, es geht keine Verbindung nach außen. Das verknüpfte Projekt, die
//   importierten Vorlagen und ein eigener Kabeltyp stehen im lokalen Speicher.
// Nicht angeklickt, weil sie Dateien schreiben oder senden: Export-Knöpfe, „Fürs Lager"
// (solange ein Rack da ist), „An die Gerätebibliothek senden", „Einreichungsdatei speichern".

import { starte } from '../app.mjs'
import { erststartOverlayWeg } from '../../lib/erststartOverlay.mjs'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const sprache = process.argv[2] ?? 'de'
const de = sprache === 'de'
const a = await starte({ sprache })
const w = a.win
const f = a.folge('bibliothek')
const scratch = mkdtempSync(join(tmpdir(), 'cp-bib-'))
const nachrichten = []

// ── Hilfen ────────────────────────────────────────────────────────────────
const bib = () => w.locator('aside:has(.spaltenkopf)').first()
const insp = () => w.locator('aside:has(.spaltenkopf)').nth(1)
const pause = (ms = 500) => w.waitForTimeout(ms)
const rolle = (r, key, genau = false) => bib().getByRole(r, { name: a.muster(key, genau) }).first()
const tab = (key) => rolle('button', key)
const klickL = async (loc) => { await loc.click({ timeout: 8000 }); await pause(600) }
const eintrag = (text) => bib().locator('[draggable="true"][role="button"]', { hasText: text }).first()
const karte = (text) => bib().locator('div[draggable="true"]', { hasText: text }).first()
const dialogAus = async (name) => { const t = await a.dialogText(); if (t) nachrichten.push({ name, text: t }) }

/** Schritt mit Bild der Bibliothek (oder eines anderen Ziels) und dem Text der Bibliothek. */
const s = async (name, tun, opt = {}) => {
  const ziel = opt.ziel ?? bib
  await f.schritt(name, tun, { ...opt, ziel })
  const letzter = f.schritte.at(-1)
  if (letzter && letzter.name === name && !letzter.text) {
    try {
      const loc = typeof ziel === 'function' ? ziel() : ziel
      letzter.text = ((await loc.first().innerText()) || '').slice(0, 1500)
    } catch { /* kein Text */ }
  }
}
const fenster = () => w.locator('body')
const plus = () => bib().getByTitle(a.text('library.menus.plusTitle'), { exact: true })
const filt = () => bib().getByTitle(a.text('library.menus.filterTitle'), { exact: true })
const menueZu = async () => { await bib().locator('.spaltenkopf span').last().click(); await pause(300) }

const schreibe = (name, inhalt) => { const p = join(scratch, name); writeFileSync(p, inhalt); return p }
const demoGeraet = schreibe('demo-encoder.cpdevice', JSON.stringify({
  type: 'cable-planner-device', version: 1, exportedAt: '2026-09-29T00:00:00.000Z',
  template: {
    name: 'Demo Encoder E1', category: 'Video', manufacturerUrl: 'https://example.com/datasheets/encoder-e1.pdf',
    width: 220, height: 124,
    inputs: [
      { id: 'in-1', name: 'SDI In 1', connectorType: 'BNC', type: 'SDI' },
      { id: 'in-2', name: 'SDI In 2', connectorType: 'BNC', type: 'SDI' },
    ],
    outputs: [{ id: 'out-1', name: 'LAN Out', connectorType: 'Ethernet/RJ45', type: 'Ethernet' }],
  },
}))
const kaputt = schreibe('kaputt.cpdevice', JSON.stringify({ irgendwas: 1 }))
let naechsteDatei = demoGeraet
w.on('filechooser', async (fc) => { await fc.setFiles(naechsteDatei) })

// ── Beispielantworten statt Rentman (kein Netz) ───────────────────────────
await a.app.evaluate(({ ipcMain }) => {
  const antworten = {
    'rentman:get-projects': [
      { id: '1001', name: 'Demo Fair Stand', status: 'Confirmed', number: 2601 },
      { id: '1002', name: 'Demo Concert Hall', status: 'Concept', number: 2602 },
    ],
    'rentman:get-project-equipment': [],
    'rentman:get-equipment': [
      { id: '101', name: 'Demo Camera A', equipmentfolder: '/equipmentfolders/2' },
      { id: '102', name: 'Demo Mixer B', equipmentfolder: '/equipmentfolders/1' },
      { id: '103', name: 'Demo Wireless C', equipmentfolder: '/equipmentfolders/3' },
      { id: '104', name: 'Demo Cable D' },
      { id: '201', name: 'Demo Camera E', equipmentfolder: '/equipmentfolders/2' },
      { id: '202', name: 'Demo Mixer F', equipmentfolder: '/equipmentfolders/1' },
      { id: '203', name: 'Demo Wireless G', equipmentfolder: '/equipmentfolders/3' },
      { id: '204', name: 'Demo Cable H' },
    ],
    'rentman:get-equipment-folders': [
      { id: '1', name: 'Video' },
      { id: '2', name: 'Cameras', parent: '/equipmentfolders/1' },
      { id: '3', name: 'Audio' },
    ],
  }
  for (const [kanal, wert] of Object.entries(antworten)) {
    try { ipcMain.removeHandler(kanal) } catch { /* nichts registriert */ }
    ipcMain.handle(kanal, async () => wert)
  }
})

// ── Beispieldaten im lokalen Speicher (Gerätebibliothek, Kabeltyp) ────────
const geraet = (name, category, ein, aus) => ({
  name, category, width: 220, height: 124,
  inputs: ein.map((n, i) => ({ id: `${name}-in-${i}`, name: n, connectorType: 'BNC', type: 'SDI' })),
  outputs: aus.map((n, i) => ({ id: `${name}-out-${i}`, name: n, connectorType: 'BNC', type: 'SDI' })),
})
const eintraege = [
  ['demo-switcher-verified', 'verified', 12, 'Demo Switcher V1', 'Video', ['In 1', 'In 2'], ['PGM Out']],
  ['demo-monitor-confirmed', 'confirmed', 3, 'Demo Monitor M2', 'Monitors', ['SDI In'], []],
  ['demo-camera-unconfirmed', 'unconfirmed', 0, 'Demo Camera K3', 'Cameras', [], ['SDI Out']],
  ['demo-mic-disputed', 'disputed', 1, 'Demo Wireless W4', 'Audio', [], ['Audio Out']],
].map(([slug, status, confirmations, name, cat, ein, aus], i) => ({
  slug, version: 1, seq: i + 1, status, confirmations, manufacturer: 'Demo', model: name.replace('Demo ', ''),
  template: geraet(name, cat, ein, aus),
}))
await w.evaluate(({ eintraege }) => {
  const server = 'https://devices.zumpelars.de'
  localStorage.setItem('cable-planner:deviceLibrary:cache:v1', JSON.stringify({
    format: 'cable-planner-device-library-caches', version: 1,
    byServer: { [server]: { format: 'cable-planner-device-library-cache', version: 1, server, latestSeq: 4, syncedAt: '2026-09-29T08:00:00.000Z', entries: eintraege } },
  }))
  const ui = JSON.parse(localStorage.getItem('cable-planner:ui') || '{}')
  ui.customCableSpecs = [{ id: 'custom-cable:demo-xlr', name: 'Demo cable XLR 10 m', connectorType: 'XLR', standards: ['Generic'], color: '#7c3aed', maxLengthMeters: 10, notes: 'Sample entry' }]
  localStorage.setItem('cable-planner:ui', JSON.stringify(ui))
}, { eintraege })

const neuLaden = async () => {
  await w.reload()
  await w.waitForLoadState('domcontentloaded')
  await pause(3000)
  await w.evaluate(() => { window.print = () => {}; window.alert = () => {}; window.confirm = () => true; window.prompt = () => null })
  await erststartOverlayWeg(w, { lautScheitern: false })
  const demo = w.getByRole('button', { name: /Load example project|Beispielprojekt laden/i })
  if (await demo.count()) { await demo.first().click().catch(() => {}); await pause(2000) }
  await a.zu()
}
await neuLaden()

// ═════════════════════════════════════════════════════════════════════════
// 1  Überblick und Spaltenkopf
// ═════════════════════════════════════════════════════════════════════════
await s('fenster-ueberblick', null, { ziel: fenster })
await s('spalte-einklappen', () => klickL(bib().getByRole('button', { name: a.muster('library.hide', true) })), { ziel: fenster })
await s('spalte-einblenden', () => klickL(w.getByRole('button', { name: a.muster('library.show', true) }).first()), { ziel: bib })
await s('fenster-menue', () => klickL(bib().getByRole('button', { name: a.muster('panel.window.button') }).first()))
await s('abgedockt', () => klickL(bib().getByRole('menuitem', { name: a.muster('panel.window.undock') })), { ziel: fenster })
await s('wieder-angedockt', () => klickL(w.getByRole('button', { name: a.muster('panel.dock', true) }).first()), { ziel: fenster })
await s('spalte-verbreitern', async () => {
  const sp = w.getByTitle(a.text('splitter.resize')).first()
  const b = await sp.boundingBox()
  await w.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await w.mouse.down()
  await w.mouse.move(b.x + 100, b.y + b.height / 2, { steps: 12 })
  await w.mouse.up()
  await pause(600)
}, { ziel: fenster })

// ── Gruppen speichern (vor allem anderen, solange der Canvas unberührt ist) ──
const grpKnopf = () => w.getByRole('button', { name: de ? /als Gruppe speichern/ : /as a group/ }).first()
const grpName1 = de ? 'Kamera 2 und Mischer' : 'Camera 2 and mixer'
const grpName2 = de ? 'Kamera 1 und Multiviewer' : 'Camera 1 and multiviewer'
const bilingual = () => w.locator('form:has(input[placeholder="e.g. Camera"])')
const knoten = (n) => w.locator('.react-flow__node', { hasText: n }).first()
await s('gruppe-zwei-geraete-markiert', async () => {
  await knoten('Camera 2').click({ position: { x: 20, y: 10 } })
  await knoten('Vision mixer').click({ position: { x: 20, y: 10 }, modifiers: ['Shift'] })
  await pause(600)
}, { ziel: fenster })
await s('gruppe-name-eingeben', async () => {
  await grpKnopf().click()
  await pause(500)
  await w.getByPlaceholder(a.muster('toolbar.groupName.placeholder')).fill(grpName1)
}, { ziel: fenster })
await s('gruppe-gespeichert', async () => {
  await w.getByTitle(a.text('toolbar.groupName.save')).first().click()
  await pause(700)
  await klickL(tab('library.tab.groups'))
})
// zweite Gruppe, ohne Bild: sie dient der Reihenfolge
await knoten('Camera 1').click({ position: { x: 20, y: 10 } }).catch(() => {})
await knoten('Multiviewer').click({ position: { x: 20, y: 10 }, modifiers: ['Shift'] }).catch(() => {})
await pause(500)
await grpKnopf().click().catch(() => {})
await pause(400)
await w.getByPlaceholder(a.muster('toolbar.groupName.placeholder')).fill(grpName2).catch(() => {})
await w.getByTitle(a.text('toolbar.groupName.save')).first().click().catch(() => {})
await pause(700)

// ═════════════════════════════════════════════════════════════════════════
// 2  Geräte → Lokal
// ═════════════════════════════════════════════════════════════════════════
await s('geraete-lokal', () => klickL(tab('library.tab.equipment')))
await s('kategorie-aufklappen', () => klickL(bib().getByRole('button', { name: /Audio/ }).first()))
await s('eintrag-hover', () => eintrag('Allen & Heath Avantis').hover())
await s('eintrag-rechtsklick', async () => { await eintrag('Allen & Heath Avantis').click({ button: 'right' }); await pause(600) })
await s('eintrag-favorit', () => klickL(eintrag('Allen & Heath Avantis').getByRole('button', { name: a.muster('library.item.favorite') })))
await s('eintrag-verstecken', async () => {
  await eintrag('Allen & Heath Avantis').hover()
  await klickL(eintrag('Allen & Heath Avantis').getByRole('button', { name: a.muster('library.item.hide', true) }))
})
await s('filter-menue', () => klickL(filt()))
await s('filter-versteckte-zeigen', () => klickL(rolle('menuitemcheckbox', 'library.menus.showHidden')))
await s('versteckter-eintrag-sichtbar', () => menueZu())
await s('eintrag-wieder-zeigen', async () => {
  await eintrag('Allen & Heath Avantis').hover()
  await klickL(eintrag('Allen & Heath Avantis').getByRole('button', { name: a.muster('library.item.show', true) }))
})
await klickL(filt())
await klickL(rolle('menuitemcheckbox', 'library.menus.showHidden'))
await menueZu()
// Filtermenü: jede Option
await s('filter-alle-einklappen', async () => {
  await klickL(filt())
  await klickL(rolle('menuitemcheckbox', 'library.menus.collapseAll'))
})
await s('filter-sortierung-z-a', () => klickL(rolle('menuitemradio', 'library.menus.sortDesc')))
await s('filter-sortierung-a-z', () => klickL(rolle('menuitemradio', 'library.menus.sortAsc')))
await s('filter-sortierung-manuell', () => klickL(rolle('menuitemradio', 'library.menus.sortManual')))
await s('filter-nur-eigenes-material', () => rolle('menuitemcheckbox', 'inventory.onlyOwned').hover({ force: true }))
await s('filter-alle-ausklappen', () => klickL(rolle('menuitemcheckbox', 'library.menus.expandAll')))
await klickL(rolle('menuitemcheckbox', 'library.menus.collapseAll')).catch(() => {})
await menueZu()

// Suche
await s('suche-strg-f', async () => {
  await w.keyboard.press('Control+f')
  await pause(700)
}, { ziel: fenster })
await w.keyboard.press('Escape')
await pause(300)
await s('suche-tippen', async () => {
  await bib().getByRole('textbox').first().click()
  await w.keyboard.type('Avantis', { delay: 40 })
  await pause(700)
})
await s('suche-ohne-treffer', async () => {
  await w.keyboard.press('Control+a')
  await w.keyboard.type('zzzzqq', { delay: 40 })
  await pause(700)
})
await s('suche-treffer-loeschen', () => klickL(bib().getByRole('button', { name: a.muster('library.empty.clearSearch', true) }).first()))
await s('suche-x-knopf', async () => { await bib().getByRole('textbox').first().fill('Behringer'); await pause(500) })
await klickL(bib().getByRole('button', { name: a.muster('library.search.clear', true) }).first())

// Kategorien: Auf-/Einklappen, Umbenennen, Umsortieren
await s('kategorie-einklappen', () => klickL(bib().getByRole('button', { name: /Audio/ }).first()))
await s('kategorie-hover-stift', () => bib().getByRole('button', { name: /Audio/ }).first().hover())
await s('kategorie-umbenennen-dialog', async () => {
  await bib().getByRole('button', { name: a.muster('library.renameCategory', true) }).first().click({ force: true })
  await pause(800)
}, { ziel: bilingual })
await dialogAus('kategorie-umbenennen')
await w.getByRole('button', { name: a.muster('common.cancel', true) }).last().click()
await pause(500)
await s('kategorie-ziehen-griff', async () => {
  const griff = bib().locator('[data-cp-drag-handle]').nth(1)
  const b = await griff.boundingBox()
  await w.mouse.move(b.x + 3, b.y + 6)
  await w.mouse.down()
  await w.mouse.move(b.x + 3, b.y + 130, { steps: 14 })
  await pause(300)
})
await s('kategorie-losgelassen', async () => { await w.mouse.up(); await pause(600) })

// ── + -Menü ──────────────────────────────────────────────────────────────
await s('plus-menue', () => klickL(plus()))
await s('plus-neues-geraet', async () => { await klickL(rolle('menuitem', 'library.menus.newDevice')) }, { ziel: () => a.dialog() })
await dialogAus('neues-geraet')
await a.zu()
await s('plus-neue-kategorie', async () => {
  await klickL(plus())
  await klickL(rolle('menuitem', 'library.menus.newCategory'))
})
const katName = de ? 'Beispielkategorie' : 'Sample category'
await s('kategorie-name-getippt', async () => { await bib().getByPlaceholder(a.muster('library.newCategoryPlaceholder')).fill(katName) })
await s('kategorie-angelegt', async () => { await bib().getByRole('button', { name: /^OK$/ }).click(); await pause(700) })
await s('plus-datei-importieren', async () => {
  naechsteDatei = demoGeraet
  await klickL(plus())
  await klickL(rolle('menuitem', 'library.menus.importFile'))
  await pause(900)
}, { ziel: () => a.dialog() })
await dialogAus('import-geraet')
await a.zu()
await s('import-gleicher-name', async () => {
  await klickL(plus())
  await klickL(rolle('menuitem', 'library.menus.importFile'))
  await pause(900)
}, { ziel: () => a.dialog() })
await dialogAus('import-gleicher-name')
await a.zu()
await s('import-unbekannte-datei', async () => {
  naechsteDatei = kaputt
  await klickL(plus())
  await klickL(rolle('menuitem', 'library.menus.importFile'))
  await pause(900)
}, { ziel: () => a.dialog() })
await dialogAus('import-unbekannt')
await a.zu()
await s('plus-vorlagen-einreichen', async () => {
  await klickL(plus())
  await klickL(rolle('menuitem', 'library.menus.submit'))
  await pause(1000)
}, { ziel: () => a.dialog() })
await dialogAus('vorlagen-einreichen')
await a.zu()

// ── Einträge: das importierte Gerät, Aktionen ────────────────────────────
await s('eintrag-gefunden', async () => {
  await bib().getByRole('textbox').first().fill('Demo Encoder')
  await pause(700)
})
await s('eintrag-bearbeiten-inspector', async () => {
  await eintrag('Demo Encoder E1').hover()
  await klickL(eintrag('Demo Encoder E1').getByRole('button', { name: a.muster('library.template.editTitle') }))
}, { ziel: insp })
await s('eintrag-entfernen-abfrage', async () => {
  await eintrag('Demo Encoder E1').hover()
  await klickL(eintrag('Demo Encoder E1').getByRole('button', { name: a.muster('library.item.removeTitle', true) }))
}, { ziel: () => a.dialog() })
await dialogAus('eintrag-entfernen')
await a.zu()
await s('eintrag-export-tooltip', async () => {
  await eintrag('Demo Encoder E1').hover()
  await eintrag('Demo Encoder E1').getByRole('button', { name: a.muster('library.item.exportAria', true) }).hover()
  await pause(1000)
}, { ziel: fenster })
await s('eintrag-klick-platziert', async () => {
  await eintrag('Demo Encoder E1').click({ position: { x: 60, y: 20 } })
  await pause(800)
}, { ziel: fenster })
await s('eintrag-auf-canvas-ziehen', async () => {
  const b = await eintrag('Demo Encoder E1').boundingBox()
  await w.mouse.move(b.x + 40, b.y + 15)
  await w.mouse.down()
  await w.mouse.move(800, 620, { steps: 18 })
  await w.mouse.up()
  await pause(900)
}, { ziel: fenster })
// in eine andere Kategorie ziehen: Z→A, damit „Video" oben steht und eine Zielkategorie darunter
await klickL(filt())
await klickL(rolle('menuitemradio', 'library.menus.sortDesc'))
await menueZu()
await s('eintrag-in-kategorie-ziehen', async () => {
  const e = eintrag('Demo Encoder E1')
  const b = await e.boundingBox()
  const abschnitte = bib().locator('section')
  const ziel = await abschnitte.nth(1).boundingBox()
  await w.mouse.move(b.x + 40, b.y + 15)
  await w.mouse.down()
  await w.mouse.move(ziel.x + 80, ziel.y + 12, { steps: 20 })
  await pause(300)
})
await s('eintrag-in-kategorie-abgelegt', async () => { await w.mouse.up(); await pause(900) })
await klickL(filt())
await klickL(rolle('menuitemradio', 'library.menus.sortManual'))
await menueZu()
await bib().getByRole('textbox').first().fill('')
await pause(500)
await s('kategorie-umbenennen-ausgefuellt', async () => {
  const abschnitt = bib().locator('section', { hasText: katName }).first()
  await abschnitt.scrollIntoViewIfNeeded()
  await abschnitt.hover()
  await abschnitt.getByRole('button', { name: a.muster('library.renameCategory', true) }).click({ force: true })
  await pause(700)
  await w.locator('input[placeholder="z. B. Kamera"]').fill(de ? 'Beispiel-Kategorie' : 'Demo-Kategorie')
  await w.locator('input[placeholder="e.g. Camera"]').fill(de ? 'Sample category' : 'Demo category')
}, { ziel: bilingual })
await s('kategorie-umbenannt', async () => {
  await w.getByRole('button', { name: /^OK$/ }).last().click()
  await pause(700)
  await bib().locator('section', { hasText: /Beispiel-Kategorie|Demo-Kategorie|Demo category|Sample category/ }).first().scrollIntoViewIfNeeded()
})
await s('filter-leere-kategorien-aus', async () => {
  await klickL(filt())
  await klickL(rolle('menuitemcheckbox', 'library.menus.showEmpty'))
})
await s('filter-leere-kategorien-an', async () => {
  await klickL(rolle('menuitemcheckbox', 'library.menus.showEmpty'))
  await menueZu()
})

// ═════════════════════════════════════════════════════════════════════════
// 3  Geräte → Geteilt
// ═════════════════════════════════════════════════════════════════════════
await s('geteilt-uebersicht', () => klickL(bib().getByRole('button', { name: a.muster('library.section.deviceLibrary') }).first()))
await s('geteilt-suche', async () => { await bib().getByRole('textbox').first().fill('Monitor'); await pause(500) })
await bib().getByRole('textbox').first().fill('')
await s('geteilt-platzieren', async () => {
  await klickL(bib().locator('[draggable="true"][role="button"]', { hasText: 'Demo Switcher V1' }).first())
}, { ziel: fenster })
await s('geteilt-anmelden', async () => {
  await klickL(bib().getByRole('button', { name: a.muster('deviceLibrary.openSettings') }).first())
  await pause(1200)
}, { ziel: fenster })
await a.zu()

// ═════════════════════════════════════════════════════════════════════════
// 4  Kabel
// ═════════════════════════════════════════════════════════════════════════
await s('kabel-uebersicht', () => klickL(tab('library.tab.cables')))
await s('kabel-gruppe-aufklappen', () => klickL(bib().getByRole('button', { name: /^SDI/ }).first()))
await s('kabel-eintrag-bearbeiten', () => klickL(bib().getByRole('button', { name: a.muster('cableLib.editOverride') }).first()), { ziel: () => a.dialog() })
await dialogAus('kabeltyp-editor')
await s('kabel-eintrag-notiz', async () => {
  await a.dialog().getByPlaceholder(a.muster('cableLib.notePlaceholder')).fill(de ? 'Beispielnotiz' : 'Sample note')
}, { ziel: () => a.dialog() })
await s('kabel-eintrag-gespeichert', async () => {
  await a.dialog().getByRole('button', { name: a.muster('common.save', true) }).click()
  await pause(700)
})
await s('kabel-eintrag-zuruecksetzen', () => klickL(bib().getByTitle(a.text('cableLib.removeOverride')).first()), { ziel: () => a.dialog() })
await dialogAus('kabel-zuruecksetzen')
await s('kabel-eintrag-zurueckgesetzt', async () => {
  await w.getByRole('button', { name: a.muster('cableLib.resetOverride.ok', true) }).last().click()
  await pause(700)
})
await klickL(bib().getByRole('button', { name: /^SDI/ }).first())
await s('kabel-eigener-typ', async () => {
  await klickL(bib().getByRole('button', { name: /XLR/ }).first())
  await bib().getByTitle(a.text('cableLib.deleteSpec')).first().scrollIntoViewIfNeeded()
})
await s('kabel-eigener-typ-loeschen', () => klickL(bib().getByTitle(a.text('cableLib.deleteSpec')).first()), { ziel: () => a.dialog() })
await dialogAus('kabel-eigener-typ-loeschen')
await a.zu()
await klickL(bib().getByRole('button', { name: /XLR/ }).first())
await s('kabel-gruppe-verschieben', async () => {
  const griff = bib().locator('[aria-label="' + a.text('cableLib.groupReorder') + '"]').nth(1)
  const b = await griff.boundingBox()
  await w.mouse.move(b.x + 3, b.y + 6)
  await w.mouse.down()
  await w.mouse.move(b.x + 3, b.y + 90, { steps: 14 })
  await pause(300)
})
await s('kabel-gruppe-losgelassen', async () => { await w.mouse.up(); await pause(600) })
await s('kabel-typen-verwalten', () => klickL(bib().getByRole('button', { name: a.muster('cableLib.manage') }).first()), { ziel: fenster })
await a.zu()

// ═════════════════════════════════════════════════════════════════════════
// 5  Gruppen
// ═════════════════════════════════════════════════════════════════════════
const gk = (n) => karte(n)
await s('gruppen-uebersicht', () => klickL(tab('library.tab.groups')))
await s('gruppe-karte-hover', () => gk(grpName1).hover())
await s('gruppe-klick-platzieren', () => gk(grpName1).click({ position: { x: 80, y: 20 } }), { ziel: fenster })
await s('gruppe-auf-canvas-ziehen', async () => {
  const b = await gk(grpName1).boundingBox()
  await w.mouse.move(b.x + 60, b.y + 20)
  await w.mouse.down()
  await w.mouse.move(820, 300, { steps: 18 })
  await w.mouse.up()
  await pause(900)
}, { ziel: fenster })
await s('gruppe-umbenennen-dialog', async () => {
  await gk(grpName1).hover()
  await klickL(gk(grpName1).getByRole('button', { name: a.muster('library.tabs.groups.renameAria', true) }))
}, { ziel: () => a.dialog() })
await dialogAus('gruppe-umbenennen')
const grpNeu = de ? 'Kamera und Mischer' : 'Camera and mixer'
await s('gruppe-umbenennen-eingetippt', async () => { await a.dialog().getByRole('textbox').first().fill(grpNeu) }, { ziel: () => a.dialog() })
await s('gruppe-umbenannt', async () => { await a.dialog().getByRole('button', { name: /^OK$/ }).click(); await pause(700) })
await s('gruppe-loeschen-abfrage', async () => {
  await gk(grpNeu).hover()
  await klickL(gk(grpNeu).getByRole('button', { name: a.muster('common.delete', true) }))
}, { ziel: () => a.dialog() })
await dialogAus('gruppe-loeschen')
await a.zu()
await s('gruppe-reihenfolge-ziehen', async () => {
  const griff = bib().locator('[aria-label="' + a.text('library.sortables.moveAria') + '"]').nth(1)
  const b = await griff.boundingBox()
  await w.mouse.move(b.x + 3, b.y + 6)
  await w.mouse.down()
  await w.mouse.move(b.x + 3, b.y - 90, { steps: 14 })
  await pause(300)
})
await s('gruppe-reihenfolge-losgelassen', async () => { await w.mouse.up(); await pause(600) })
// Gruppendatei importieren (Datei aus der eigenen Gruppe gebaut)
const gruppenDatei = await w.evaluate(() => {
  const alle = JSON.parse(localStorage.getItem('cable-planner:groupPresets') || '[]')
  const g = alle.find((p) => !p.rack)
  return g ? JSON.stringify({ type: 'cable-planner-group', version: 1, exportedAt: '2026-09-29T00:00:00.000Z', preset: g }) : null
})
if (gruppenDatei) {
  const p = schreibe('demo.cpgroup', gruppenDatei)
  await s('gruppe-import-gleicher-name', async () => {
    naechsteDatei = p
    await klickL(tab('library.tab.equipment'))
    await klickL(plus())
    await klickL(rolle('menuitem', 'library.menus.importFile'))
    await pause(900)
  }, { ziel: () => a.dialog() })
  await dialogAus('gruppe-import-gleicher-name')
  await s('gruppe-import-ueberschrieben', async () => {
    await w.getByRole('button', { name: a.muster('common.overwrite', true) }).last().click()
    await pause(900)
  }, { ziel: () => a.dialog() })
  await dialogAus('gruppe-import-ok')
  await a.zu()
}

// ═════════════════════════════════════════════════════════════════════════
// 6  Racks
// ═════════════════════════════════════════════════════════════════════════
await s('racks-uebersicht', () => klickL(tab('library.tab.racks')))
await s('racks-karte-hover', () => karte('Example rack').hover())
await s('racks-neues-rack', async () => {
  await klickL(bib().getByRole('button', { name: a.muster('library.tabs.racks.new') }))
  await pause(3000)
}, { ziel: fenster })
await dialogAus('rack-builder-neu')
await a.zu()
await s('racks-bearbeiten', async () => {
  await karte('Example rack').hover()
  await klickL(karte('Example rack').getByRole('button', { name: a.muster('library.tabs.racks.editAria', true) }))
  await pause(3000)
}, { ziel: fenster })
await a.zu()
await s('racks-klick-platziert', () => karte('Example rack').click({ position: { x: 80, y: 20 } }), { ziel: fenster })
await s('racks-loeschen-abfrage', async () => {
  await karte('Example rack').hover()
  await klickL(karte('Example rack').getByRole('button', { name: a.muster('common.delete', true) }))
}, { ziel: () => a.dialog() })
await dialogAus('rack-loeschen')
await w.getByRole('button', { name: a.muster('common.delete', true) }).last().click()
await pause(700)
await s('racks-leer', null)
await s('racks-fuers-lager-leer', () => klickL(bib().getByRole('button', { name: a.muster('library.tabs.racks.warehouse', true) })))
// Leerzustand der Gruppen: alle Gruppen löschen
await klickL(tab('library.tab.groups'))
for (let i = 0; i < 6; i += 1) {
  const k = bib().locator('div[draggable="true"]').first()
  if (!(await k.count())) break
  await k.hover()
  await k.getByRole('button', { name: a.muster('common.delete', true) }).click().catch(() => {})
  await pause(500)
  await w.getByRole('button', { name: a.muster('common.delete', true) }).last().click().catch(() => {})
  await pause(500)
}
await s('gruppen-leer', null)

// ═════════════════════════════════════════════════════════════════════════
// 7  Rentman
// ═════════════════════════════════════════════════════════════════════════
await s('rentman-nicht-verknuepft', async () => {
  await klickL(tab('library.tab.equipment'))
  await klickL(bib().getByRole('button', { name: /Rentman/ }).first())
})
await s('rentman-projekt-verknuepfen-dialog', async () => {
  await klickL(bib().getByRole('button', { name: a.muster('library.rentman.linkProject') }))
  await pause(1500)
}, { ziel: fenster })
await dialogAus('rentman-verknuepfen')
await s('rentman-projekte-geladen', async () => {
  await w.getByRole('button', { name: a.muster('rentman.import.loadProjects', true) }).first().click()
  await pause(1200)
}, { ziel: fenster })
await a.zu()
await s('rentman-katalog-ohne-verknuepfung', () => klickL(bib().getByRole('button', { name: a.muster('library.rentman.view.catalog', true) })))
await s('rentman-abgleich-ohne-verknuepfung', () => klickL(bib().getByRole('button', { name: a.muster('library.rentman.view.sync', true) })))

// Beispieldaten: verknüpftes Projekt, importierte Vorlagen, Kennungen am Plan
await pause(3500)
const ok = await w.evaluate(() => {
  const key = 'cable-planner:projectAutosave'
  const raw = localStorage.getItem(key)
  if (!raw) return 'kein Autosave'
  const p = JSON.parse(raw)
  p.metadata = { ...(p.metadata || {}), rentmanProjectId: '1001', rentmanProjectName: 'Demo Fair Stand' }
  const setze = (name, patch) => { const e = (p.equipment || []).find((x) => x.name === name); if (e) Object.assign(e, patch) }
  setze('Camera 1', { rentmanId: '101' })
  setze('Camera 2', { rentmanId: '999' })
  setze('Vision mixer', { rentmanId: '102' })
  setze('Multiviewer', { rentmanId: '555', rentmanRemoved: true })
  localStorage.setItem(key, JSON.stringify(p))
  const lib = JSON.parse(localStorage.getItem('cable-planner:customLibrary') || '[]')
  const port = (id, name) => ({ id, name, connectorType: 'BNC', type: 'SDI' })
  lib.push(
    { name: 'Demo Camera A', category: 'Cameras', rentmanSource: '1001', rentmanProjectName: 'Demo Fair Stand', rentmanId: '101', width: 220, height: 124, inputs: [], outputs: [port('r1', 'SDI Out')] },
    { name: 'Demo Mixer B', category: 'Mixer', rentmanSource: '1001', rentmanProjectName: 'Demo Fair Stand', rentmanId: '102', width: 220, height: 124, inputs: [], outputs: [] },
    { name: 'Demo Wireless C', category: 'Audio', rentmanSource: '0999', rentmanProjectName: 'Demo Concert Hall', rentmanId: '103', width: 220, height: 124, inputs: [], outputs: [] },
    { name: 'demo mixer b', category: 'Mixer', width: 220, height: 124, inputs: [port('l1', 'In 1'), port('l2', 'In 2')], outputs: [port('l3', 'PGM Out')] },
  )
  localStorage.setItem('cable-planner:customLibrary', JSON.stringify(lib))
  return 'ok'
})
console.log('Rentman-Beispieldaten:', ok)
await neuLaden()
await s('rentman-verknuepft-importiert', async () => {
  await klickL(tab('library.tab.equipment'))
  await klickL(bib().getByRole('button', { name: /Rentman/ }).first())
})
await s('rentman-projekt-einklappen', () => klickL(bib().getByRole('button', { name: /Demo Concert Hall/ }).first()))
await s('rentman-kategorie-aufklappen', () => klickL(bib().getByRole('button', { name: /Mixer/ }).first()))
await s('rentman-eintrag-hover', () => bib().locator('[draggable="true"][role="button"]', { hasText: 'Demo Mixer B' }).first().hover())
await s('rentman-ports-verknuepft', async () => {
  await klickL(bib().locator('[draggable="true"][role="button"]', { hasText: 'Demo Mixer B' }).first().getByRole('button', { name: a.muster('library.item.linkAria', true) }))
})
await s('rentman-suche', async () => { await bib().getByPlaceholder(a.muster('library.rentmanSearchPlaceholder')).fill('camera'); await pause(500) })
await s('rentman-suche-ohne-treffer', async () => { await bib().getByPlaceholder(a.muster('library.rentmanSearchPlaceholder')).fill('qqqq'); await pause(500) })
await bib().getByPlaceholder(a.muster('library.rentmanSearchPlaceholder')).fill('')
await s('rentman-alle-einklappen', () => klickL(bib().getByRole('button', { name: a.muster('library.rentman.collapseAll', true) })))
await s('rentman-aktualisieren-dialog', () => klickL(bib().getByRole('button', { name: a.muster('library.rentman.refreshAction') }).first()), { ziel: fenster })
await dialogAus('rentman-aktualisieren')
await a.zu()
await s('rentman-katalog-leer', () => klickL(bib().getByRole('button', { name: a.muster('library.rentman.view.catalog', true) })))
await s('rentman-katalog-geladen', async () => {
  await klickL(bib().getByRole('button', { name: a.muster('library.rentman.catalogLoad', true) }))
  await pause(900)
  await klickL(bib().getByRole('button', { name: a.muster('library.rentman.accountAll') }).first())
})
await s('rentman-katalog-ordner', () => klickL(bib().getByRole('button', { name: /^Video/ }).first()))
await s('rentman-katalog-suche', async () => { await bib().getByPlaceholder(a.muster('common.search')).fill('Wireless'); await pause(500) })
await s('rentman-katalog-zum-projekt', () => klickL(bib().getByRole('button', { name: a.muster('library.rentman.addToProject') }).first()), { ziel: () => a.dialog() })
await dialogAus('rentman-katalog-zum-projekt')
await a.zu()
await s('rentman-abgleich', () => klickL(bib().getByRole('button', { name: a.muster('library.rentman.view.sync', true) })))
await s('rentman-fehlende-nachbauen', () => klickL(bib().getByRole('button', { name: a.muster('library.rentman.resyncAction') }).first()), { ziel: () => a.dialog() })
await dialogAus('rentman-nachbauen')
await a.zu()

// ── Abschluss ────────────────────────────────────────────────────────────
f.speichern(new URL(`./bibliothek.${sprache}.json`, import.meta.url))
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), `bibliothek.${sprache}.dialoge.json`), JSON.stringify(nachrichten, null, 2))
await a.ende()
console.log('FERTIG')
