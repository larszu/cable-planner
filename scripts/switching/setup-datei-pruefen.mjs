// #1240 Stufe 4/5 — ATEM-Setup-Datei in der Innenansicht einmal laden und speichern;
// Emulator-Schalter sichtbar.
//
// Voraussetzung: `npm run dev:renderer` laeuft auf :4181. Hell erzwungen,
// weil Headless-Chrome sonst dunkel meldet.
//   node scripts/switching/setup-datei-pruefen.mjs
// Bilder landen in CP_UI_SHOTS (Vorgabe /tmp/cp-innenansicht).
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { erststartOverlayWeg } from '../lib/erststartOverlay.mjs'

const URL = process.env.CP_URL || 'http://localhost:4181/'
const OUT = process.env.CP_UI_SHOTS || '/tmp/cp-setup-datei'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  args: ['--no-sandbox'],
  ...(process.env.CP_CHROME ? { executablePath: process.env.CP_CHROME } : {}),
})
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  colorScheme: 'light',
})
const page = await ctx.newPage()
await page.addInitScript(() => {
  try {
    localStorage.setItem('cable-planner.tour.seen.v1', '1')
    localStorage.setItem('cable-planner:settings', JSON.stringify({ onboardingDone: true }))
  } catch {
    /* noop */
  }
})
const fehler = []
page.on('pageerror', (e) => fehler.push(e.message))
page.on('console', (m) => m.type() === 'error' && fehler.push(m.text()))
const ok = (bed, text) => {
  console.log(`${bed ? 'OK  ' : 'FAIL'} ${text}`)
  if (!bed) process.exitCode = 1
}

await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
await erststartOverlayWeg(page)
await page.evaluate(async () => {
  const { useSettingsStore } = await import('/src/renderer/store/settingsStore.ts')
  const { useProjectStore } = await import('/src/renderer/store/projectStore.ts')
  const { BLACKMAGIC_CATALOG } = await import('/src/renderer/lib/blackmagicCatalog.ts')
  useSettingsStore.getState().setModuleEnabled('switching', true)
  const e = BLACKMAGIC_CATALOG.find((c) => c.template.name === 'Blackmagic ATEM 2 M/E Constellation HD')
  const atem = {
    ...e.template,
    id: 'atem',
    x: 200,
    y: 120,
    width: 220,
    height: 300,
    deviceTypeId: e.deviceTypeId,
    inputs: e.template.inputs.map((p, i) => ({ ...p, id: `atem-in-${i}` })),
    outputs: e.template.outputs.map((p, i) => ({ ...p, id: `atem-out-${i}` })),
  }
  useProjectStore.setState((s) => ({ project: { ...s.project, equipment: [...s.project.equipment, atem] } }))
})
await page.waitForTimeout(800)
await page.locator('.react-flow__node[data-id="atem"]').first().dblclick({ timeout: 8000 })
await page.waitForTimeout(800)
ok(await page.getByTestId('atem-setup-datei').isVisible(), 'Abschnitt „ATEM-Setup-Datei“ steht in der Seitenleiste')

// Stufe 5: im Browser steht der Schalter da, ist aber aus (kein UDP/TCP-Server).
ok(await page.getByTestId('emulator-schalter').isVisible(), 'Schalter „Als Geraet im Netz anbieten“ steht da')
ok(await page.locator('[data-testid="emulator-schalter"] input').first().isDisabled(), 'im Browser ist er gesperrt')

const XML = readFileSync(new globalThis.URL('../../tests/fixtures/atem/setup-2me.xml', import.meta.url), 'utf8')
const [chooser] = await Promise.all([
  page.waitForEvent('filechooser'),
  page.getByRole('button', { name: /Load setup file|Setup-Datei laden/ }).click(),
])
await chooser.setFiles({ name: 'setup-2me.xml', mimeType: 'application/xml', buffer: Buffer.from(XML) })
await page.waitForTimeout(600)
const geladen = await page.evaluate(async () => {
  const { useProjectStore } = await import('/src/renderer/store/projectStore.ts')
  return useProjectStore.getState().project.equipment.find((e) => e.id === 'atem').switching
})
ok(geladen?.routes?.['me:2/pgm'] === 'ss:1', 'Laden setzt M/E 2 auf SuperSource 1')
ok((await page.locator('[data-testid="innenansicht"] [data-testid="rf__edge-r:me:2/pgm"]').count()) === 1, 'Kante SuperSource 1 -> M/E 2 erscheint')
await page.screenshot({ path: join(OUT, 'geladen.png') })

// Es kommen zwei Downloads: das Herkunftsblatt und die Datei selbst.
const xmlDownload = new Promise((resolve) => {
  page.on('download', (d) => d.suggestedFilename().endsWith('.xml') && resolve(d))
})
await page.getByRole('button', { name: /Save setup file|Setup-Datei speichern/ }).click()
const dl = await xmlDownload
const pfad = await dl.path()
const raus = pfad ? readFileSync(pfad, 'utf8') : ''
ok(raus === XML, 'Speichern ohne Aenderung gibt die Datei byte-gleich zurueck')

ok(fehler.length === 0, `keine Fehler in der Konsole${fehler.length ? ': ' + fehler.slice(0, 3).join(' | ') : ''}`)
await browser.close()
