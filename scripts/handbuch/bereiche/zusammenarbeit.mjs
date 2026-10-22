#!/usr/bin/env node
// Kapitel "Zusammenarbeit" — Aufnahme.
//   node scripts/handbuch/bereiche/zusammenarbeit.mjs de
//   node scripts/handbuch/bereiche/zusammenarbeit.mjs en
// Bilder: docs/manual/bilder/<sprache>/zusammenarbeit-<nn>-<name>.jpg,
// Texte: zusammenarbeit.<sprache>.json. Es startet nur eine Sitzung im Modus
// "Dieses Gerät"; es wird nichts ins Netz gesendet, das Sync-Verzeichnis ist
// ein leerer Ordner im Temp-Verzeichnis.

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { starte } from '../app.mjs'

const sprache = process.argv[2] ?? 'de'
const a = await starte({ sprache })
const f = a.folge('zusammenarbeit')
const win = a.win
win.setDefaultTimeout(15000)
const warte = (ms) => win.waitForTimeout(ms)
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const dlg = () => win.locator('[role="dialog"]').filter({ has: win.locator('aside') }).last()
const inhalt = () => dlg().locator('main > div.overflow-y-auto').first()
const kopf = () => win.locator('header.cp-topbar').first()
const fuss = () => win.locator('footer.cp-statusbar').first()
const knopf = (schluessel, wo = inhalt) => wo().getByRole('button', { name: a.muster(schluessel) }).first()
const s = (name, tun, ziel) => f.schritt(name, tun, { ziel: ziel ?? dlg })

const reiter = async (id) => {
  const name = a.text(`settings.tab.${id}`)
  await dlg().locator('aside').getByRole('button', { name: new RegExp(`^\\s*${esc(name)}\\s*$`) }).first().click()
  await warte(700)
  await inhalt().evaluate((e) => { e.scrollTop = 0 })
}
const zu = async (schluessel) => {
  const el = inhalt().getByText(a.muster(schluessel)).first()
  await el.evaluate((e) => {
    const box = e.closest('main > div.overflow-y-auto')
    box.scrollTop += e.getBoundingClientRect().top - box.getBoundingClientRect().top - 12
  })
  await warte(400)
}

await s('einstellungen-offen', async () => {
  await kopf().getByRole('button', { name: a.muster('settings.title') }).first().click()
  await warte(900)
  await reiter('sync')
})
await s('name-und-raum', async () => {
  await inhalt().getByPlaceholder(a.muster('collab.name.placeholder')).first().fill(sprache === 'de' ? 'Anna' : 'Anna')
  await inhalt().getByPlaceholder(a.muster('collab.room.placeholder')).first().fill('show-2026')
  await warte(400)
})
await s('suche-im-netz', async () => {
  await knopf('collab.discover.search').click()
  await warte(2500)
})
await s('modus-netzwerk', async () => {
  await inhalt().locator('select').first().selectOption('webrtc')
  await warte(600)
})
await s('modus-dieses-geraet', async () => {
  await inhalt().locator('select').first().selectOption('broadcast')
  await warte(500)
})
await s('sitzung-laeuft', async () => {
  await knopf('collab.start').click()
  await warte(1800)
})
await s('einladung-kopiert', async () => {
  await knopf('collab.invite.copy').click()
  await warte(500)
})
await s('statusleiste-live', async () => {
  await a.zu()
  await warte(700)
}, fuss)
await s('statusleiste-klick', async () => {
  await fuss().getByRole('button', { name: a.muster('statusbar.collab.live') }).first().click()
  await warte(900)
})
await s('verlassen', async () => {
  await knopf('collab.stop').click()
  await warte(900)
})
const syncOrdner = mkdtempSync(join(tmpdir(), 'cp-sync-'))
await s('sync-verzeichnis', async () => {
  await inhalt().getByPlaceholder(a.muster('settings.sync.pathPlaceholder')).first().fill(syncOrdner)
  await inhalt().getByPlaceholder(a.muster('settings.sync.userPlaceholder')).first().fill('Anna')
  await knopf('common.save').click()
  await warte(800)
  await zu('settings.sync.path')
})
await s('push-pull-kopfleiste', async () => {
  await a.zu()
  await warte(700)
}, kopf)

f.speichern(new URL(`./zusammenarbeit.${sprache}.json`, import.meta.url))
await a.ende()
console.log('FERTIG')
