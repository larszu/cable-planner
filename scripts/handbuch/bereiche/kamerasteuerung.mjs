#!/usr/bin/env node
// Abschnitt "Kamera-Steuerung (Brücke)" und Dialog "Videowand" — Aufnahme.
//   node scripts/handbuch/bereiche/kamerasteuerung.mjs de|en
// Bilder: docs/manual/bilder/<sprache>/kamerasteuerung-<nn>-<name>.jpg.
// Es wird keine Brücke verbunden; die Adresse ist ein Beispielwert, "Verbinden"
// wird nicht gedrückt.

import { starte } from '../app.mjs'

const sprache = process.argv[2] ?? 'de'
const a = await starte({ sprache })
const f = a.folge('kamerasteuerung')
const win = a.win
win.setDefaultTimeout(15000)
const warte = (ms) => win.waitForTimeout(ms)
const T = (k) => a.text(k)
const inspektor = () => win.locator('aside').last()
const abschnitt = () => inspektor().getByText(T('props.cameraControl.title'), { exact: false }).first()
const S = (name, tun, ziel) => f.schritt(name, tun, { ziel: ziel ?? inspektor })

await S('kamera-gewaehlt', async () => {
  await win.locator('.react-flow__node-equipment', { hasText: 'Camera 1' }).first().click()
  await warte(700)
})
await S('abschnitt', async () => {
  const k = abschnitt()
  await k.scrollIntoViewIfNeeded()
  await k.click()
  await warte(600)
  await k.scrollIntoViewIfNeeded()
})
await S('videowand', async () => {
  await inspektor().getByRole('button', { name: a.muster('app.menu.tools.cameraMultiview') }).first().click()
  await warte(900)
}, () => a.dialog())
await a.zu()
await warte(500)
await S('bruecke-adresse', async () => {
  await inspektor().getByPlaceholder('192.168.1.20').first().fill('127.0.0.1')
  await warte(400)
})
await S('steuerweg-liste', async () => {
  const sel = inspektor().locator('select').filter({ has: win.locator('option', { hasText: 'VISCA over IP' }) }).first()
  await sel.evaluate((el) => el.setAttribute('size', String(el.options.length)))
  await warte(400)
})
await S('steuerweg-http-cgi', async () => {
  const sel = inspektor().locator('select').filter({ has: win.locator('option', { hasText: 'VISCA over IP' }) }).first()
  await sel.evaluate((el) => el.removeAttribute('size'))
  await sel.selectOption('http-cgi')
  await warte(500)
})
f.speichern(new URL(`./kamerasteuerung.${sprache}.json`, import.meta.url))
await a.ende()
console.log('FERTIG')
