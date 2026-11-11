import { chromium } from 'playwright-core'
import { join } from 'node:path'
import { erststartOverlayWeg } from '../lib/erststartOverlay.mjs'
const aus = process.argv[3]
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, colorScheme: 'light', locale: 'de-DE' })
const fehler = []
page.on('pageerror', (e) => fehler.push(String(e)))
await page.goto('http://localhost:4181/')
await page.waitForSelector('.react-flow', { timeout: 30000 })
await page.getByRole('button', { name: /Neues Projekt|New project/ }).first().click({ timeout: 10000 }).catch(() => {})
await erststartOverlayWeg(page)
await page.getByRole('button', { name: /^Datei$|^File$/ }).first().click()
await page.getByText(/GDTF \/ MVR/).first().click()
await page.locator('input[type=file][accept=".gdtf,.mvr"]').setInputFiles(process.argv[2])
await page.getByText('Robin Spiider').first().waitFor({ timeout: 20000 })
await page.screenshot({ path: join(aus, 'r1-gdtf-dialog.png') })
const zeile = await page.locator('tbody tr').first().innerText()
await page.getByRole('button', { name: /In die Bibliothek|Add to library/ }).click()
await page.getByRole('button', { name: /^OK$|Schließen|Close/ }).first().click({ timeout: 8000 }).catch(() => {})
await page.waitForTimeout(600)
await page.locator('input[placeholder*="Suchen"], input[placeholder*="Search"]').first().fill('Spiider')
await page.waitForTimeout(500)
const treffer = await page.getByText('Robe Lighting Robin Spiider').count()
await page.screenshot({ path: join(aus, 'r2-bibliothek.png') })
console.log(JSON.stringify({ zeile, treffer, fehler }, null, 2))
await browser.close()
process.exit(treffer > 0 && fehler.length === 0 ? 0 : 1)
