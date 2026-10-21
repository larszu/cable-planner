#!/usr/bin/env node
// Kapitel "Einstellungen" — Aufnahme.
//   node scripts/handbuch/bereiche/einstellungen.mjs de
//   node scripts/handbuch/bereiche/einstellungen.mjs en
// Schreibt Bilder nach docs/manual/bilder/<sprache>/einstellungen-<nn>-<name>.jpg und
// einstellungen.<sprache>.json (schritte, fehler, notizen). `notizen` enthält den
// vollständigen Text jedes Reiters mit aufgeklappten „mehr"-Hinweisen — auch den
// Teil, der erst nach dem Scrollen sichtbar ist.
//
// Alles läuft im Wegwerf-Profil von app.mjs: der MCP-Server hört nur auf
// 127.0.0.1 und wird am Ende wieder gestoppt, das Sync-Verzeichnis ist ein
// leerer Ordner im Temp-Verzeichnis.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { starte } from '../app.mjs'

const sprache = process.argv[2] ?? 'de'
const a = await starte({ sprache })
const f = a.folge('einstellungen')
const notizen = {}
const win = a.win
win.setDefaultTimeout(15000)
const warte = (ms) => win.waitForTimeout(ms)
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Der Einstellungsdialog (Seitenleiste + Inhalt), nicht ein Rückfragefenster darüber. */
const dlg = () => win.locator('[role="dialog"]').filter({ has: win.locator('aside') }).last()
const inhalt = () => dlg().locator('main > div.overflow-y-auto').first()
const oben = () => win.locator('[role="dialog"]').last()

const s = async (name, tun, ziel, notiz) => {
  await f.schritt(name, tun, { ziel: ziel ?? dlg })
  if (notiz) {
    try {
      notizen[name] = await notiz()
    } catch (e) {
      notizen[name] = `FEHLER ${e.message}`
    }
  }
}

const reiter = async (id) => {
  const name = a.text(`settings.tab.${id}`)
  await dlg().locator('aside').getByRole('button', { name: new RegExp(`^\\s*${esc(name)}\\s*$`) }).first().click()
  await warte(700)
  await inhalt().evaluate((e) => { e.scrollTop = 0 })
}
/** Den Inhalt so scrollen, dass der Text dieses Schlüssels oben steht. */
const zu = async (schluessel) => {
  const el = inhalt().getByText(a.muster(schluessel)).first()
  await el.evaluate((e) => {
    const box = e.closest('main > div.overflow-y-auto')
    box.scrollTop += e.getBoundingClientRect().top - box.getBoundingClientRect().top - 12
  })
  await warte(400)
}
const nachUnten = async () => {
  await inhalt().evaluate((e) => { e.scrollTop = e.scrollHeight })
  await warte(400)
}
/** Alle „mehr"-Hinweise aufklappen und den ganzen Reitertext lesen. */
const volltext = async () => {
  const mehr = inhalt().getByRole('button', { name: a.muster('common.more', true) })
  for (let i = await mehr.count(); i > 0; i -= 1) await mehr.first().click().catch(() => {})
  await warte(200)
  return inhalt().innerText()
}
const knopf = (schluessel, wo = inhalt) => wo().getByRole('button', { name: a.muster(schluessel) }).first()
const klickK = (schluessel, wo) => async () => {
  await knopf(schluessel, wo).click()
  await warte(700)
}
const kopf = () => win.locator('header.cp-topbar').first()

// ═══ ÖFFNEN ════════════════════════════════════════════════════════════════
await s('kopfleiste', null, kopf)
await s('dialog', async () => {
  await kopf().getByRole('button', { name: a.muster('settings.title') }).first().click()
  await warte(900)
})

// ═══ PROJEKT ═══════════════════════════════════════════════════════════════
await s('projekt-standards', () => zu('settings.project.defaults.title'))
await s('projekt-logos-rentman', () => zu('settings.project.logos'))
await s('projekt-nummerierung', () => zu('settings.project.numbering.title'))
await s('projekt-laenge-hinzugefuegt', async () => {
  await knopf('settings.project.stock.add').click()
  await warte(500)
  await zu('settings.project.stock.title')
})
await s('projekt-library', nachUnten, undefined, volltext)

// ═══ MODULE ════════════════════════════════════════════════════════════════
await s('module', () => reiter('modules'), undefined, volltext)

// ═══ DARSTELLUNG ═══════════════════════════════════════════════════════════
await s('darstellung', () => reiter('appearance'))
await s('darstellung-portschrift', () => zu('settings.appearance.portLabelSize'))
await s('darstellung-kennung-raster', () => zu('settings.kennung.title'))
await s('darstellung-bild-palette', () => zu('settings.canvasBg.imageTitle'))
await s('darstellung-steckerfarben', () => zu('settings.connectorColors.title'))
await s('darstellung-kategoriefarben', nachUnten, undefined, volltext)

// ═══ BEARBEITEN ════════════════════════════════════════════════════════════
await s('bearbeiten', () => reiter('editing'))
await s('bearbeiten-unten', nachUnten, undefined, volltext)

// ═══ TASTENKÜRZEL ══════════════════════════════════════════════════════════
await s('hotkeys', () => reiter('hotkeys'), undefined, volltext)
await s('hotkeys-aufnahme', async () => {
  await inhalt().locator('li button').first().click()
  await warte(500)
})
// Nicht Escape: im Aufnahmezustand würde die Taste selbst als Kürzel belegt.
await dlg().locator('main > header h2').click()
await warte(300)

// ═══ INTEGRATIONEN ═════════════════════════════════════════════════════════
await s('integrationen', () => reiter('integrations'))
await s('integrationen-netbox', () => zu('settings.integrations.netboxToggle.title'))
await s('integrationen-tallypi', async () => {
  await inhalt().getByText(a.muster('settings.integrations.tallyPi.enable')).first().click()
  await warte(500)
  await zu('settings.integrations.tallyPi.title')
})
await s('integrationen-ki', () => zu('settings.integrations.ai'))
await s('integrationen-greengo', nachUnten, undefined, volltext)

// ═══ GERÄTEBIBLIOTHEK ══════════════════════════════════════════════════════
await s('geraetebibliothek', () => reiter('deviceLibrary'))
await s('geraetebibliothek-eigene', async () => {
  await inhalt().getByText(a.muster('deviceLibrary.up.list')).first().click()
  await warte(500)
  await nachUnten()
}, undefined, volltext)

// ═══ MCP ═══════════════════════════════════════════════════════════════════
// Das Paarungs-Token liegt im Schlüsselbund des Rechners, nicht im
// Wegwerf-Profil — es ist also das echte Token dieses Rechners. Vor jedem Bild
// wird es im angezeigten Text durch einen Platzhalter ersetzt; React ändert die
// Textknoten nicht zurück, solange sich der Wert nicht ändert.
const PLATZHALTER = '0123456789abcdef0123456789abcdef0123456789abcdef'
const maskieren = () => inhalt().evaluate((wurzel, ersatz) => {
  const gang = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT)
  for (let n = gang.nextNode(); n; n = gang.nextNode()) n.nodeValue = n.nodeValue.replace(/[0-9a-f]{32,}/g, ersatz)
}, PLATZHALTER)
const maskiert = async () => (await volltext()).replace(/[0-9a-f]{32,}/g, PLATZHALTER)
await s('mcp', () => reiter('mcp'))
await s('mcp-laeuft', async () => {
  await knopf('mcp.start').click()
  await warte(2000)
  await maskieren()
})
await s('mcp-token', async () => {
  await knopf('mcp.showToken').click()
  await warte(800)
  await maskieren()
})
await s('mcp-befehle', async () => {
  await nachUnten()
  await maskieren()
}, undefined, maskiert)
await knopf('mcp.stop').click().catch(() => {})
await warte(800)

// ═══ KONFIGURATIONEN ═══════════════════════════════════════════════════════
await s('konfigurationen', () => reiter('configs'))
await s('konfigurationen-hochgeladen', async () => {
  const [fc] = await Promise.all([
    win.waitForEvent('filechooser', { timeout: 8000 }),
    knopf('settings.configs.pickFile').click(),
  ])
  await fc.setFiles({ name: 'Videohub-labels.txt', mimeType: 'text/plain', buffer: Buffer.from('0 Camera 1\n1 Camera 2\n') })
  await warte(900)
  await zu('settings.configs.library.title')
}, undefined, volltext)

// ═══ KABELTYPEN ════════════════════════════════════════════════════════════
await s('kabeltypen', () => reiter('cableTypes'), undefined, volltext)
await s('kabeltypen-neu', klickK('settings.cableTypes.new'), oben, () => a.dialogText())
await win.keyboard.press('Escape').catch(() => {})
await warte(500)
if ((await win.locator('[role="dialog"]').count()) > 1) {
  await oben().getByRole('button', { name: a.muster('common.cancel', true) }).first().click().catch(() => {})
  await warte(500)
}

// ═══ STAMMDATEN ════════════════════════════════════════════════════════════
await s('stammdaten', () => reiter('stammdaten'))
await s('stammdaten-standard-angelegt', async () => {
  const feld = inhalt().getByPlaceholder(a.muster('stammdaten.standardPlaceholder')).first()
  await feld.fill('SMPTE 2110-20')
  await feld.locator('xpath=following::button[1]').click()
  await warte(600)
})
await s('stammdaten-eingebaut', async () => {
  await inhalt().getByText(a.muster('stammdaten.builtIn')).nth(2).click()
  await warte(600)
  await nachUnten()
}, undefined, volltext)

// ═══ KATEGORIEN & FELDER ═══════════════════════════════════════════════════
await s('schema', () => reiter('schema'))
await s('schema-unten', nachUnten, undefined, volltext)
await s('schema-neues-feld', async () => {
  await knopf('schemaBuilder.addField').click()
  await warte(600)
  await nachUnten()
}, undefined, () => inhalt().innerText())

// ═══ NETZWERK-SYNC ═════════════════════════════════════════════════════════
await s('sync', () => reiter('sync'))
await s('sync-netzwerk', async () => {
  await inhalt().locator('select').first().selectOption('webrtc')
  await warte(600)
}, undefined, volltext)
await s('sync-session-aktiv', async () => {
  await inhalt().locator('select').first().selectOption('broadcast')
  await warte(400)
  await knopf('collab.start').click()
  await warte(1500)
}, undefined, () => inhalt().innerText())
await knopf('collab.stop').click().catch(() => {})
await warte(800)
const syncOrdner = mkdtempSync(join(tmpdir(), 'cp-sync-'))
await s('sync-verzeichnis', async () => {
  await inhalt().getByPlaceholder(a.muster('settings.sync.pathPlaceholder')).first().fill(join(tmpdir(), 'cable-planner-sync'))
  await inhalt().getByPlaceholder(a.muster('settings.sync.userPlaceholder')).first().fill('Lars')
  await zu('settings.sync.path')
})
await s('sync-gespeichert', async () => {
  await inhalt().getByPlaceholder(a.muster('settings.sync.pathPlaceholder')).first().fill(syncOrdner)
  await knopf('common.save').click()
  await warte(800)
  await nachUnten()
}, undefined, () => inhalt().innerText())
await s('sync-kopfleiste', async () => {
  await a.zu()
  await warte(600)
}, kopf, () => kopf().innerText())

// ═══ NACHWEISE ═════════════════════════════════════════════════════════════
await kopf().getByRole('button', { name: a.muster('settings.title') }).first().click()
await warte(900)
await s('nachweise', () => reiter('nachweise'))
await s('nachweise-formular', klickK('nachweis.add'), undefined, () => inhalt().innerText())
await s('nachweise-eingetragen', async () => {
  await inhalt().getByPlaceholder(a.muster('nachweis.bezeichnungPh')).first().fill(sprache === 'de' ? 'Höhenarbeit-Schein' : 'Working-at-height certificate')
  await inhalt().locator('input[type="date"]').last().fill('2026-11-15')
  await knopf('common.save').click()
  await warte(600)
  await inhalt().locator('input[type="number"]').last().fill('30')
  await warte(600)
}, undefined, volltext)

// ═══ ERWEITERT ═════════════════════════════════════════════════════════════
await s('erweitert', () => reiter('advanced'))
await s('erweitert-umbenennen', klickK('common.rename'), oben, () => a.dialogText())
await win.keyboard.press('Escape').catch(() => {})
await warte(500)
await s('erweitert-unten', nachUnten, undefined, volltext)

// ═══ AUSLAGERN ═════════════════════════════════════════════════════════════
await s('kopf-auslagern', null, () => dlg().locator('main > header').first())

f.speichern(new URL(`./einstellungen.${sprache}.json`, import.meta.url))
const datei = new URL(`./einstellungen.${sprache}.json`, import.meta.url)
const roh = JSON.parse(readFileSync(datei, 'utf8'))
roh.notizen = notizen
writeFileSync(datei, JSON.stringify(roh, null, 2))
rmSync(syncOrdner, { recursive: true, force: true })
await a.ende()
console.log('FERTIG')
