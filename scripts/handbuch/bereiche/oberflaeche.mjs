#!/usr/bin/env node
// Kapitel "Programmoberfläche" — Aufnahme.
//   node scripts/handbuch/bereiche/oberflaeche.mjs de
//   node scripts/handbuch/bereiche/oberflaeche.mjs en
// Schreibt Bilder nach docs/manual/bilder/<sprache>/oberflaeche-<nn>-<name>.jpg und
// oberflaeche.<sprache>.json (schritte, fehler, notizen).
//
// Zustände, die die App nur bei bestimmten Projektdaten zeigt (Komplexität,
// Plan-Check, Netz-Befunde, Fotos, Rentman), entstehen, indem die Sicherungskopie
// des Projekts im Wegwerf-Profil umgeschrieben und die App neu geladen wird.
// Nichts davon berührt Dateien des Rechners.

import { writeFileSync } from 'node:fs'
import { starte } from '../app.mjs'
import { erststartOverlayWeg } from '../../lib/erststartOverlay.mjs'

const sprache = process.argv[2] ?? 'de'
const a = await starte({ sprache })
const f = a.folge('oberflaeche')
const notizen = {}
const win = a.win

const s = async (name, tun, ziel, notiz) => {
  await f.schritt(name, tun, { ziel })
  if (notiz) {
    try {
      notizen[name] = await notiz()
    } catch (e) {
      notizen[name] = `FEHLER ${e.message}`
    }
  }
}

const AUTOSAVE = 'cable-planner:projectAutosave'
const canvas = () => win.locator('.react-flow').first()
const kopf = () => win.locator('header.cp-topbar').first()
const fuss = () => win.locator('footer.cp-statusbar').first()
const links = () => win.locator('main > aside').first()
const rechts = () => win.locator('main > aside').last()
const menuTxt = () => a.menueFeld().innerText()
const fussTxt = () => fuss().innerText()
const M = (m, i) => () => a.menue(m, i)
const menuAuf = (m) => () => a.menue(m)
const EDIT = 'app.menu.edit'
const VIEW = 'app.menu.view'
const HELP = 'app.menu.help'

const warte = (ms) => win.waitForTimeout(ms)

/** Sicherungskopie lesen / setzen und neu laden. */
const kopieLesen = () => win.evaluate((k) => localStorage.getItem(k), AUTOSAVE)
const zustandLaden = async (json) => {
  await a.zu()
  await win.evaluate(({ k, j }) => localStorage.setItem(k, j), { k: AUTOSAVE, j: json })
  await win.reload()
  await win.waitForLoadState('domcontentloaded')
  await warte(2500)
  await erststartOverlayWeg(win, { lautScheitern: false })
  await a.zu()
}
const zustandAendern = async (quelltext) => {
  const roh = await kopieLesen()
  const p = JSON.parse(roh)
  new Function('p', quelltext)(p)
  await zustandLaden(JSON.stringify(p))
}

/** Sicherstellen, dass eine Sicherungskopie existiert (Änderung erzwingen). */
let original = await kopieLesen()
if (!original) {
  await a.menue(EDIT, 'app.menu.edit.selectAll')
  await a.menue(EDIT, 'app.menu.edit.duplicate')
  await warte(1500)
  await a.menue(EDIT, 'app.menu.edit.undo')
  await warte(1500)
  original = await kopieLesen()
}
console.log('Sicherungskopie:', original ? `${original.length} Zeichen` : 'FEHLT')

const themaHell = () => win.evaluate(() => document.documentElement.dataset.theme !== 'dark')

// ═══ 1. AUFBAU ═════════════════════════════════════════════════════════════
await s('start', null, undefined)
await s('menueleiste', null, kopf, async () => kopf().innerText())
await s('bibliothek', null, links, async () => links().innerText())
await s('canvas', null, canvas)
await s('inspector-leer', null, rechts, async () => rechts().innerText())
await s('statusleiste', null, fuss, fussTxt)
await s('menue-datei', menuAuf('app.menu.file'), () => a.menueFeld(), menuTxt)
await s('menue-werkzeuge', menuAuf('app.menu.tools'), () => a.menueFeld(), menuTxt)
await s('geraet-gewaehlt', async () => {
  await a.zu()
  await win.locator('.react-flow__node').filter({ hasText: 'Camera 2' }).first().click({ position: { x: 20, y: 10 } })
  await warte(600)
}, rechts, async () => rechts().innerText())
await s('projektname-klick', async () => {
  await a.zu()
  await kopf().locator(`button[title="${a.text('app.editProjectMeta')}"]`).click()
  await warte(800)
}, () => a.dialog())
await a.zu()

// ═══ 2. FENSTER-MENÜS DER SEITENLEISTEN ════════════════════════════════════
const fensterKnopf = (seite) => seite().getByRole('button', { name: a.muster('panel.window.button', true) }).first()
await s('fenster-bibliothek-menue', async () => {
  await a.zu()
  await fensterKnopf(links).click()
  await warte(500)
}, () => a.menueFeld(), menuTxt)
await s('bibliothek-abgedockt', async () => {
  await a.klick('panel.window.undock', { rolle: 'menuitem' })
  await warte(900)
}, undefined)
await s('bibliothek-angedockt', async () => {
  await win.getByRole('button', { name: a.muster('panel.dock', true) }).first().click()
  await warte(900)
}, undefined)
await s('bibliothek-eingeklappt', async () => {
  await win.getByRole('button', { name: a.muster('library.hide', true) }).first().click()
  await warte(700)
}, undefined)
await s('bibliothek-ausgeklappt', async () => {
  await win.getByRole('button', { name: a.muster('library.show', true) }).first().click()
  await warte(700)
}, undefined)
await s('fenster-inspector-menue', async () => {
  await a.zu()
  await fensterKnopf(rechts).click()
  await warte(500)
}, () => a.menueFeld(), menuTxt)
await s('inspector-eingeklappt', async () => {
  await a.zu()
  await win.getByRole('button', { name: a.muster('inspector.collapse.hide', true) }).first().click()
  await warte(700)
}, undefined)
await s('inspector-ausgeklappt', async () => {
  await win.getByRole('button', { name: a.muster('inspector.collapse.show', true) }).first().click()
  await warte(700)
}, undefined)
await s('trennleiste-gezogen', async () => {
  const sp = win.locator(`[title="${a.text('splitter.resize')}"]`).first()
  const b = await sp.boundingBox()
  await win.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await win.mouse.down()
  await win.mouse.move(b.x + 140, b.y + b.height / 2, { steps: 8 })
  await win.mouse.up()
  await warte(600)
}, undefined)
await s('tastatur-bibliothek-weg', async () => {
  await win.locator('.react-flow__pane').first().click({ position: { x: 5, y: 5 } }).catch(() => {})
  await win.keyboard.press('Control+b')
  await warte(600)
}, undefined)
await s('tastatur-inspector-weg', async () => {
  await win.keyboard.press('Control+i')
  await warte(600)
}, undefined)
await s('tastatur-beide-zurueck', async () => {
  await win.keyboard.press('Control+b')
  await win.keyboard.press('Control+i')
  await warte(600)
}, undefined)
await s('tastatur-patchliste-p', async () => {
  await win.keyboard.press('p')
  await warte(1200)
}, () => a.dialog())
await a.zu()

// ═══ 3. MENÜ BEARBEITEN ════════════════════════════════════════════════════
await zustandLaden(original)
await s('bearbeiten-menue', menuAuf(EDIT), () => a.menueFeld(), menuTxt)
await s('bearbeiten-alles-auswaehlen', M(EDIT, 'app.menu.edit.selectAll'), canvas)
await s('bearbeiten-duplizieren', M(EDIT, 'app.menu.edit.duplicate'), canvas)
await s('bearbeiten-menue-rueckgaengig-aktiv', menuAuf(EDIT), () => a.menueFeld(), menuTxt)
await s('bearbeiten-rueckgaengig', M(EDIT, 'app.menu.edit.undo'), canvas)
await s('bearbeiten-wiederherstellen', M(EDIT, 'app.menu.edit.redo'), canvas)
await s('bearbeiten-auswahl-aufheben', M(EDIT, 'app.menu.edit.clearSelection'), canvas)
await a.menue(EDIT, 'app.menu.edit.undo')
await s('kopfleiste-rechts', null, () => kopf().getByRole('button', { name: /Undo|Rückgängig/ }).first().locator('xpath=../..'))
await s('bearbeiten-geraet-anklicken', async () => {
  await win.locator('.react-flow__node').filter({ hasText: 'Camera 2' }).first().click({ position: { x: 20, y: 10 } })
  await warte(500)
}, canvas)
await s('bearbeiten-auswahl-loeschen', M(EDIT, 'app.menu.edit.delete'), canvas)
await a.menue(EDIT, 'app.menu.edit.undo')

// ═══ 4. MENÜ ANSICHT ═══════════════════════════════════════════════════════
await zustandLaden(original)
await s('ansicht-menue', menuAuf(VIEW), () => a.menueFeld(), menuTxt)
await s('ansicht-vergroessern', M(VIEW, 'app.menu.view.zoomIn'), undefined, fussTxt)
await s('ansicht-vergroessern-2', M(VIEW, 'app.menu.view.zoomIn'), undefined, fussTxt)
await s('ansicht-verkleinern', M(VIEW, 'app.menu.view.zoomOut'), undefined, fussTxt)
await s('ansicht-zoom-100', M(VIEW, 'app.menu.view.zoom100'), undefined, fussTxt)
await s('ansicht-einpassen', M(VIEW, 'app.menu.view.fit'), undefined, fussTxt)

await s('ansicht-helles-design-aus', M(VIEW, 'app.menu.view.light'), undefined)
await s('ansicht-menue-dunkel', menuAuf(VIEW), () => a.menueFeld(), menuTxt)
await a.menue(VIEW, 'app.menu.view.light')
await a.menue(VIEW, 'app.menu.view.followSystem')
await s('ansicht-menue-system-folgen', menuAuf(VIEW), () => a.menueFeld(), menuTxt)
await a.menue(VIEW, 'app.menu.view.followSystem')
if (!(await themaHell())) await a.menue(VIEW, 'app.menu.view.light')

await a.menue(VIEW, 'app.menu.view.snap')
await s('ansicht-menue-raster-aus', menuAuf(VIEW), () => a.menueFeld(), menuTxt)
await a.menue(VIEW, 'app.menu.view.snap')

await s('ansicht-labels-vorher', null, canvas)
await s('ansicht-labels-aus', M(VIEW, 'app.menu.view.hideLabels'), canvas)
await s('ansicht-menue-labels', menuAuf(VIEW), () => a.menueFeld(), menuTxt)
await a.menue(VIEW, 'app.menu.view.hideLabels')

await a.menue(VIEW, 'app.menu.view.offPageNames')
await s('ansicht-menue-offpage', menuAuf(VIEW), () => a.menueFeld(), menuTxt)
await a.menue(VIEW, 'app.menu.view.offPageNames')

await s('ansicht-farbe-laenge', M(VIEW, 'app.menu.view.colorByLength'), canvas)
await s('ansicht-menue-farbe-laenge', menuAuf(VIEW), () => a.menueFeld(), menuTxt)
await s('ansicht-farbe-gewerk', M(VIEW, 'app.menu.view.colorByLayer'), canvas)
await s('ansicht-menue-farbe-gewerk', menuAuf(VIEW), () => a.menueFeld(), menuTxt)
await s('ansicht-farbe-manuell', M(VIEW, 'app.menu.view.colorByLayer'), canvas)

await zustandAendern(`
  const laengen = [1, 2, 3, 5]
  p.cables.forEach((c, i) => { c.length = laengen[i % laengen.length] })
`)
await s('ansicht-farbe-laenge-regel', M(VIEW, 'app.menu.view.colorByLength'), canvas)
await s('ansicht-farbe-gewerk-vergleich', M(VIEW, 'app.menu.view.colorByLayer'), canvas)
await a.menue(VIEW, 'app.menu.view.colorByLayer')
await zustandLaden(original)

await s('ansicht-suche-aus', M(VIEW, 'app.menu.view.canvasSearch'), canvas)
await s('ansicht-suche-an', M(VIEW, 'app.menu.view.canvasSearch'), canvas)
await s('ansicht-suche-strg-f', async () => {
  await a.menue(VIEW, 'app.menu.view.canvasSearch')
  await win.keyboard.press('Control+f')
  await warte(600)
}, canvas)
await s('ansicht-werkzeugleiste-aus', M(VIEW, 'app.menu.view.canvasToolbar'), canvas)
await s('ansicht-werkzeugleiste-an', M(VIEW, 'app.menu.view.canvasToolbar'), canvas)
await s('ansicht-anmerkungen-an', M(VIEW, 'app.menu.view.annotations'), undefined)
await s('ansicht-menue-anmerkungen', menuAuf(VIEW), () => a.menueFeld(), menuTxt)
await s('anmerkungen-fenster-menue', async () => {
  await a.zu()
  await win.locator('.fixed.right-0').getByRole('button', { name: a.muster('panel.window.button', true) }).first().click()
  await warte(500)
}, () => a.menueFeld(), menuTxt)
await s('anmerkungen-schliessen', async () => {
  await a.zu()
  await win.locator('.fixed.right-0').getByRole('button', { name: a.muster('common.close', true) }).first().click()
  await warte(500)
}, undefined)

// ═══ 5. STATUSLEISTE ═══════════════════════════════════════════════════════
await zustandLaden(original)
await s('status-grundzustand', null, fuss, fussTxt)
await s('status-zoom', async () => {
  await a.menue(VIEW, 'app.menu.view.zoomIn')
  await a.menue(VIEW, 'app.menu.view.zoomIn')
}, fuss, fussTxt)

await zustandAendern(`
  p.cables = []
  p.equipment = p.equipment.slice(0, 2)
`)
await s('status-komplexitaet-neu', null, fuss, fussTxt)

const vervielfachen = (n) => `
  const basis = p.equipment.map((e) => JSON.parse(JSON.stringify(e)))
  const kabel = p.cables.map((c) => JSON.parse(JSON.stringify(c)))
  for (let i = 1; i <= ${n}; i += 1) {
    for (const e of basis) {
      const k = JSON.parse(JSON.stringify(e))
      k.id = e.id + '-k' + i
      k.x = (e.x || 0) + 40 * i
      k.y = (e.y || 0) + 40 * i
      for (const l of ['inputs', 'outputs']) k[l] = (k[l] || []).map((q) => ({ ...q, id: q.id + '-k' + i }))
      p.equipment.push(k)
    }
    for (const c of kabel) {
      p.cables.push({ ...c, id: c.id + '-k' + i, fromEquipmentId: c.fromEquipmentId + '-k' + i, toEquipmentId: c.toEquipmentId + '-k' + i, fromPortId: c.fromPortId + '-k' + i, toPortId: c.toPortId + '-k' + i, cableNumber: c.cableNumber ? c.cableNumber + '-' + i : c.cableNumber })
    }
  }
`
// Beispielprojekt: 5 Geräte + 4 Kabel = 9. Klein ab 8, Mittel ab 30, Groß ab 80, XL ab 200.
await zustandLaden(original)
await s('status-komplexitaet-klein', null, fuss, fussTxt)
await zustandAendern(vervielfachen(3))
await s('status-komplexitaet-mittel', null, fuss, fussTxt)
await zustandLaden(original)
await zustandAendern(vervielfachen(9))
await s('status-komplexitaet-gross', null, fuss, fussTxt)
await zustandLaden(original)
await zustandAendern(vervielfachen(22))
await s('status-komplexitaet-xl', null, fuss, fussTxt)

await zustandLaden(original)
await zustandAendern(`
  const c = p.cables[0]
  const e = p.equipment.find((x) => x.id === c.fromEquipmentId)
  const port = (e.outputs || []).find((q) => q.id === c.fromPortId)
  const ziel = p.equipment.find((x) => x.id === c.toEquipmentId).inputs.find((q) => q.id === c.toPortId)
  port.connectorType = ziel.connectorType === 'HDMI' ? 'BNC' : 'HDMI'
`)
await s('status-plancheck-warnung', null, fuss, fussTxt)
await s('status-plancheck-klick', async () => {
  await win.locator(`button[title="${a.text('statusbar.planCheck.title')}"]`).click()
  await warte(900)
}, undefined)
await a.zu()

await zustandLaden(original)
await zustandAendern(`
  p.cables[0].cableNumber = 'K-01'
  p.cables[1].cableNumber = 'K-01'
`)
await s('status-plancheck-fehler', null, fuss, fussTxt)

await zustandLaden(original)
await zustandAendern(`
  p.equipment[0].ipAddress = '192.168.1.10'
  p.equipment[1].ipAddress = '192.168.1.10'
`)
await s('status-netz-befunde', null, fuss, fussTxt)

await zustandLaden(original)
await zustandAendern(`
  p.equipment[0].packed = true
  p.equipment[1].packed = true
`)
await s('status-gepackt-teilweise', null, fuss, fussTxt)
await zustandAendern(`
  for (const e of p.equipment) e.packed = true
`)
await s('status-gepackt-alle', null, fuss, fussTxt)

await zustandLaden(original)
await zustandAendern(`
  p.fotos = [{ id: 'foto-1', dataUri: '', breite: 1600, hoehe: 1200, bytes: 44000000, quelle: 'planer', hinzugefuegtAm: '2026-09-01T10:00:00.000Z' }]
`)
await s('status-fotos', null, fuss, fussTxt)

await zustandLaden(original)
await zustandAendern(`
  p.metadata.rentmanProjectId = '4711'
  p.metadata.rentmanProjectName = 'Beispielprojekt Stadthalle'
`)
await s('status-rentman-projekt', null, fuss, fussTxt)

await zustandLaden(original)
await s('status-keine-sicherungskopie', async () => {
  await win.evaluate(() => {
    const alt = Storage.prototype.setItem
    Storage.prototype.setItem = function (k, v) {
      if (String(k).includes('projectAutosave')) throw new Error('QuotaExceededError')
      return alt.call(this, k, v)
    }
  })
  await a.menue(EDIT, 'app.menu.edit.selectAll')
  await a.menue(EDIT, 'app.menu.edit.duplicate')
  await warte(2000)
  await a.menue(VIEW, 'app.menu.view.zoomIn')
  await warte(800)
}, fuss, fussTxt)
await win.reload()
await warte(2500)
await zustandLaden(original)

await s('status-version-klick', async () => {
  await fuss().getByRole('button', { name: /^v\d/ }).click()
  await warte(700)
}, () => a.dialog())
await a.zu()

await s('schmal-kopfleiste', async () => {
  await win.setViewportSize({ width: 900, height: 700 })
  await warte(900)
}, kopf, async () => kopf().innerText())
await s('schmal-statusleiste', null, fuss, fussTxt)
await win.setViewportSize({ width: 1400, height: 900 })
await warte(600)

// ═══ 6. HILFE-MENÜ ═════════════════════════════════════════════════════════
await s('hilfe-menue', menuAuf(HELP), () => a.menueFeld(), menuTxt)
await s('hilfe-befehlspalette', M(HELP, 'app.menu.help.commandPalette'), () => a.dialog(), async () => a.dialog().locator('ul').innerText())
await s('palette-mitte', async () => {
  await a.dialog().locator('ul').evaluate((el) => { el.scrollTop = el.scrollHeight / 2 - 100 })
  await warte(300)
}, () => a.dialog())
await s('palette-ende', async () => {
  await a.dialog().locator('ul').evaluate((el) => { el.scrollTop = el.scrollHeight })
  await warte(300)
}, () => a.dialog())
await s('palette-suche-zoom', async () => {
  await win.keyboard.type('zoom')
  await warte(400)
}, () => a.dialog(), async () => a.dialog().locator('ul').innerText())
await s('palette-suche-gruppe', async () => {
  await win.keyboard.press('Control+a')
  await win.keyboard.type(a.text(VIEW))
  await warte(400)
}, () => a.dialog(), async () => a.dialog().locator('ul').innerText())
await s('palette-keine-treffer', async () => {
  await win.keyboard.press('Control+a')
  await win.keyboard.type('qqqq')
  await warte(400)
}, () => a.dialog())
await s('palette-pfeiltasten', async () => {
  await win.keyboard.press('Control+a')
  await win.keyboard.type('zoom')
  await warte(300)
  await win.keyboard.press('ArrowDown')
  await win.keyboard.press('ArrowDown')
  await warte(300)
}, () => a.dialog())
await s('palette-befehl-ausfuehren', async () => {
  await win.keyboard.press('Enter')
  await warte(900)
}, undefined, fussTxt)
await s('palette-strg-k', async () => {
  await win.locator('.react-flow__pane').first().click({ position: { x: 5, y: 5 } }).catch(() => {})
  await win.keyboard.press('Control+k')
  await warte(700)
}, () => a.dialog())
await s('palette-dmx-befehl', async () => {
  await win.keyboard.type(a.text('palette.dmxPatch').replace(/…$/, ''))
  await warte(300)
  await win.keyboard.press('Enter')
  await warte(1200)
}, () => a.dialog())
await a.zu()

await s('hilfe-tastenkuerzel', M(HELP, 'app.menu.help.shortcuts'), () => a.dialog())
await a.zu()
await s('tastenkuerzel-fragezeichen', async () => {
  await win.locator('.react-flow__pane').first().click({ position: { x: 5, y: 5 } }).catch(() => {})
  await win.keyboard.press('?')
  await warte(700)
}, undefined)
await a.zu()

await s('hilfe-tour-1', M(HELP, 'app.menu.help.tour'), () => a.dialog())
const weiter = () => a.dialog().getByRole('button', { name: a.muster('onboarding.next', true) })
for (let i = 2; i <= 7; i += 1) {
  await s(`tour-${i}`, async () => { await weiter().click(); await warte(500) }, () => a.dialog())
}
await s('tour-ende', async () => {
  await a.dialog().getByRole('button', { name: a.muster('onboarding.start', true) }).click()
  await warte(700)
}, undefined)
await a.zu()

await s('hilfe-updates', M(HELP, 'app.menu.help.checkUpdates'), () => a.dialog())
await a.zu()
await s('hilfe-ueber', M(HELP, 'app.menu.help.about'), () => a.dialog())
await a.zu()

// ═══ 7. HANDY-ZUGRIFF ══════════════════════════════════════════════════════
await s('handy-knopf', null, () => kopf().getByRole('button', { name: a.muster('app.mobileShare.ariaLabel', true) }).first())
await s('handy-dialog', async () => {
  await a.klick('app.mobileShare.ariaLabel', { rolle: 'button' })
  await warte(900)
}, () => a.dialog())
await s('handy-mehr', async () => {
  await a.dialog().getByRole('button', { name: /^(mehr|more)$/i }).first().click()
  await warte(500)
}, () => a.dialog(), async () => a.dialogText())
await s('handy-mitschreiben', async () => {
  await a.dialog().getByRole('radio').nth(1).click({ force: true })
  await warte(500)
}, () => a.dialog(), async () => a.dialogText())
await s('handy-sicherheitshinweise', async () => {
  await a.dialog().getByRole('radio').nth(0).click({ force: true })
  await a.dialog().locator('summary').click()
  await warte(500)
}, () => a.dialog(), async () => a.dialogText())
await a.zu()

// ═══ 8. ERSTSTART ══════════════════════════════════════════════════════════
await win.evaluate(() => {
  for (const k of ['cable-planner:projectAutosave', 'cable-planner:welcomed', 'cable-planner.tour.seen.v1']) localStorage.removeItem(k)
  const st = JSON.parse(localStorage.getItem('cable-planner:settings') || '{}')
  st.onboardingDone = false
  localStorage.setItem('cable-planner:settings', JSON.stringify(st))
})
await win.reload()
await win.waitForLoadState('domcontentloaded')
await warte(3000)
await s('erststart-willkommen', null, undefined)
await s('erststart-willkommen-dialog', null, () => win.locator('[role="dialog"]').filter({ hasText: a.muster('project.welcome.newTitle') }).last())
await s('erststart-modulfrage', async () => {
  await win.locator('[role="dialog"]').filter({ hasText: a.muster('project.welcome.newTitle') }).last()
    .getByRole('button', { name: a.muster('project.welcome.later', true) }).click()
  await warte(1000)
}, () => win.locator('[role="dialog"]').filter({ hasText: a.muster('onboarding.title') }).last())
await s('erststart-modulfrage-auswahl', async () => {
  await win.locator('[role="dialog"]').filter({ hasText: a.muster('onboarding.title') }).last().locator('button[aria-pressed]').first().click()
  await warte(500)
}, () => win.locator('[role="dialog"]').filter({ hasText: a.muster('onboarding.title') }).last())
await s('erststart-tour', async () => {
  await win.locator('[role="dialog"]').filter({ hasText: a.muster('onboarding.title') }).last()
    .getByRole('button', { name: a.muster('onboarding.confirm', true) }).click()
  await warte(1500)
}, undefined)

f.speichern(new URL(`./oberflaeche.${sprache}.json`, import.meta.url))
const roh = JSON.parse((await import('node:fs')).readFileSync(new URL(`./oberflaeche.${sprache}.json`, import.meta.url), 'utf8'))
roh.notizen = notizen
writeFileSync(new URL(`./oberflaeche.${sprache}.json`, import.meta.url), JSON.stringify(roh, null, 2))
await a.ende()
console.log('FERTIG')
