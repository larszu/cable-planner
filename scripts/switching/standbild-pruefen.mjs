// #1240 — Standbild in den Mediaplayer laden, einmal im Browser bedienen.
//
// Voraussetzung: `npm run dev:renderer` laeuft auf :4181. Hell erzwungen.
//   node scripts/switching/standbild-pruefen.mjs
// Prueft: „Bild laden…“ am Mediaplayer-Knoten, Vorschau im Knoten und im
// Media-Pool, Drag & Drop auf einen Platz, Entfernen, Speichern (Download)
// und Neuladen (Projekt oeffnen) mit erhaltenem Bild.
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { erststartOverlayWeg } from '../lib/erststartOverlay.mjs'

const URL = process.env.CP_URL || 'http://localhost:4181/'
const OUT = process.env.CP_UI_SHOTS || '/tmp/cp-standbild'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  args: ['--no-sandbox'],
  ...(process.env.CP_CHROME ? { executablePath: process.env.CP_CHROME } : {}),
})
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: 'light', acceptDownloads: true })
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

// Ein PNG mit Transparenz: links rot, rechts durchsichtig.
const pngBytes = async () =>
  page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 320
    c.height = 180
    const g = c.getContext('2d')
    g.fillStyle = '#ff0000'
    g.fillRect(0, 0, 160, 180)
    const b = await new Promise((r) => c.toBlob(r, 'image/png'))
    return Array.from(new Uint8Array(await b.arrayBuffer()))
  })

const atemZustand = () =>
  page.evaluate(async () => {
    const { useProjectStore } = await import('/src/renderer/store/projectStore.ts')
    const p = useProjectStore.getState().project
    const atem = p.equipment.find((e) => e.id === 'atem')
    return { switching: atem?.switching, fotos: (p.fotos ?? []).map((f) => ({ id: f.id, png: f.dataUri.startsWith('data:image/png') })) }
  })

await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
await erststartOverlayWeg(page)

await page.evaluate(async () => {
  const { useSettingsStore } = await import('/src/renderer/store/settingsStore.ts')
  const { useProjectStore } = await import('/src/renderer/store/projectStore.ts')
  const { BLACKMAGIC_CATALOG } = await import('/src/renderer/lib/blackmagicCatalog.ts')
  useSettingsStore.getState().setModuleEnabled('switching', true)
  const e = BLACKMAGIC_CATALOG.find((c) => c.template.name === 'Blackmagic ATEM 2 M/E Constellation 4K')
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

const iv = page.getByTestId('innenansicht')
ok(await iv.getByTestId('mp-laden-1').isVisible(), 'Mediaplayer-Knoten zeigt „Bild laden…“')
const bytes = Buffer.from(await pngBytes())
await iv.getByTestId('mp-laden-1-datei').setInputFiles({ name: 'Bauchbinde.png', mimeType: 'image/png', buffer: bytes })
await page.waitForTimeout(600)
let z = await atemZustand()
const slot = z.switching?.routes?.['mp:1/still']
ok(slot === 'still:1', `Mediaplayer 1 spielt jetzt Platz 1 (${slot})`)
ok(z.fotos.length === 1 && z.fotos[0].png, 'Bild liegt im Projekt und bleibt PNG')
ok((await iv.locator('[data-block="mp:1"] [data-testid="standbild-vorschau"]').count()) === 1, 'Vorschau im Mediaplayer-Knoten')
ok((await iv.locator('[data-testid="pool-platz-1"] [data-testid="standbild-vorschau"]').count()) === 1, 'Vorschau im Media-Pool')
await page.screenshot({ path: join(OUT, 'mediaplayer-geladen.png') })

// Drag & Drop auf Platz 2 im Media-Pool.
const dt = await page.evaluateHandle((arr) => {
  const d = new DataTransfer()
  d.items.add(new File([new Uint8Array(arr)], 'Logo.png', { type: 'image/png' }))
  return d
}, Array.from(bytes))
const ziel = iv.getByTestId('pool-platz-2')
await ziel.scrollIntoViewIfNeeded()
await ziel.dispatchEvent('dragover', { dataTransfer: dt })
await ziel.dispatchEvent('drop', { dataTransfer: dt })
await page.waitForTimeout(600)
z = await atemZustand()
ok(!!z.switching?.media?.['still:2']?.fotoId && z.fotos.length === 2, 'Drag & Drop auf Platz 2 laedt das Bild')
// Entfernen gibt Platz 2 frei und raeumt das Foto weg.
await iv.locator('[data-testid="pool-platz-2"] button[aria-label]').last().click()
await page.waitForTimeout(300)
z = await atemZustand()
ok(!z.switching?.media?.['still:2'] && z.fotos.length === 1, 'Entfernen gibt den Platz frei')

// Speichern (im Browser ein Download) und Neuladen.
await page.locator('[data-testid="innenansicht"] nav button').first().click()
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 8000 }),
  page.keyboard.press('Control+s'),
])
const datei = join(OUT, 'gespeichert.cableplan')
await download.saveAs(datei)
const gespeichert = JSON.parse(readFileSync(datei, 'utf8'))
const gAtem = gespeichert.equipment.find((e) => e.id === 'atem')
const gFoto = (gespeichert.fotos ?? []).find((f) => f.id === gAtem?.switching?.media?.['still:1']?.fotoId)
ok(!!gFoto && gFoto.dataUri.startsWith('data:image/png'), 'Gespeicherte Datei traegt das PNG')

await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
await erststartOverlayWeg(page)
await page.evaluate(async () => {
  // Die Einstellungen setzt das Init-Skript zurueck; das Modul wieder an.
  const { useSettingsStore } = await import('/src/renderer/store/settingsStore.ts')
  useSettingsStore.getState().setModuleEnabled('switching', true)
})
const [chooser] = await Promise.all([
  page.waitForEvent('filechooser', { timeout: 8000 }),
  page.keyboard.press('Control+o'),
])
await chooser.setFiles(datei)
await page.waitForTimeout(1500)
z = await atemZustand()
ok(z.switching?.media?.['still:1']?.fotoId && z.fotos.some((f) => f.png), 'Nach dem Neuladen ist das Bild da')
await page.locator('.react-flow__node[data-id="atem"]').first().dblclick({ timeout: 8000 })
await page.waitForTimeout(800)
ok(
  (await page.locator('[data-testid="innenansicht"] [data-block="mp:1"] [data-testid="standbild-vorschau"]').count()) === 1,
  'Vorschau im Knoten nach dem Neuladen',
)
await page.screenshot({ path: join(OUT, 'nach-neuladen.png') })

ok(fehler.length === 0, `keine Fehler in der Konsole${fehler.length ? ': ' + fehler.slice(0, 3).join(' | ') : ''}`)
await browser.close()
