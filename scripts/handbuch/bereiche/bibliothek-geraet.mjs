#!/usr/bin/env node
// Handbuch-Aufnahmen, Kapitel „Bibliothek": der Dialog „Eigenes Gerät anlegen"
// (ein durchlaufendes Formular: Name mit Vorlagenvorschlag, Kategorie, Rack-Gerät,
// Ports aus Foto / aus dem Namen, Port-Gruppen, Speichern).
//
//   node scripts/handbuch/bereiche/bibliothek-geraet.mjs de
//   node scripts/handbuch/bereiche/bibliothek-geraet.mjs en
//
// Nichts wird gespeichert: der Dialog wird am Ende mit „Abbrechen" geschlossen.

import { starte } from '../app.mjs'

const sprache = process.argv[2] ?? 'de'
const de = sprache === 'de'
const a = await starte({ sprache })
const w = a.win
const f = a.folge('bibliothek-geraet')
const pause = (ms = 500) => w.waitForTimeout(ms)
const dlg = () => w.locator('[role="dialog"]').last()
const bib = () => w.locator('aside:has(.spaltenkopf)').first()
const s = (name, tun) => f.schritt(name, tun, { ziel: dlg })

await a.zu()
await s('dialog-offen', async () => {
  await bib().getByTitle(a.text('library.menus.plusTitle'), { exact: true }).click()
  await pause(400)
  await w.getByRole('menuitem', { name: a.muster('library.menus.newDevice') }).first().click()
  await pause(900)
})
await s('name-vorschlaege', async () => {
  await dlg().getByRole('textbox').first().fill('ATEM Mini')
  await pause(900)
})
await s('vorlage-genommen', async () => {
  await dlg().getByRole('button', { name: a.muster('library.create.preset.use') }).first().click()
  await pause(900)
})
await s('rack-geraet', async () => {
  await dlg().getByLabel(a.muster('library.create.isRack')).check()
  await pause(500)
})
await s('gruppe-ausgang', async () => {
  await dlg().getByRole('button', { name: a.muster('library.create.addOutputGroup') }).click()
  await pause(600)
  await dlg().locator('[role="dialog"], form, div').filter({ hasText: a.text('library.create.portGroups') }).first().evaluate((e) => e.scrollIntoView())
})
await s('katalog-quelle', async () => {
  await dlg().getByRole('button', { name: a.muster('library.create.fill', true) }).first().scrollIntoViewIfNeeded().catch(() => {})
  await pause(400)
})
await s('schliessen', async () => {
  await dlg().getByRole('button', { name: a.muster('common.cancel', true) }).last().click()
  await pause(500)
})
f.speichern(new URL(`./bibliothek-geraet.${sprache}.json`, import.meta.url))
await a.ende()
console.log('FERTIG')
process.exit(0)
