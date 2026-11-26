// #1240 Stufe 3 — „Pult“ einmal im Browser bedienen, mit Pixelprobe.
//
// Voraussetzung: `npm run dev:renderer` laeuft auf :4181. Hell erzwungen.
//   node scripts/switching/pult-pruefen.mjs
// Abnahme (Beispiel aus dem Anwendergespraech): M/E 2 geht in SuperSource Box 1, auf M/E 1
// liegt USK 1 mit Mediaplayer 1 (PNG, rote Bauchbinde) als Fill. Vorschau
// von M/E 1 ist SuperSource 1. Nach „Auto“ zeigt PGM:
//   - unten die rote Bauchbinde aus dem PNG,
//   - oben links (Box 1) das Bild von M/E 2 in halber Groesse,
//   - oben rechts (Box 2 ohne Quelle) Schwarz statt Eingang 1.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { erststartOverlayWeg } from '../lib/erststartOverlay.mjs'

const URL = process.env.CP_URL || 'http://localhost:4181/'
const OUT = process.env.CP_UI_SHOTS || '/tmp/cp-pult'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  args: ['--no-sandbox'],
  ...(process.env.CP_CHROME ? { executablePath: process.env.CP_CHROME } : {}),
})
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: 'light' })
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
  // PNG: rote Bauchbinde unten, sonst durchsichtig.
  const c = document.createElement('canvas')
  c.width = 1920
  c.height = 1080
  const g = c.getContext('2d')
  g.fillStyle = '#ff0000'
  g.fillRect(0, 760, 1920, 160)
  const e = BLACKMAGIC_CATALOG.find((x) => x.template.name === 'Blackmagic ATEM 2 M/E Constellation 4K')
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
    switching: {
      routes: {
        'me:2/pgm': 'in:2',
        'ss:1/box:1': 'me:2',
        'me:1/pgm': 'in:1',
        'me:1/pvw': 'ss:1',
        'me:1/key:1/fill': 'mp:1',
        'mp:1/still': 'still:1',
      },
      keyers: { 'me:1/key:1': { onAir: true, type: 'luma' } },
      media: { 'still:1': { fotoId: 'bauchbinde' } },
      transitions: { 'me:1': { rateMs: 500 } },
    },
  }
  const foto = {
    id: 'bauchbinde',
    dataUri: c.toDataURL('image/png'),
    breite: 1920,
    hoehe: 1080,
    bytes: 1,
    zeigtAuf: { equipmentId: 'atem' },
    quelle: 'planer',
    hinzugefuegtAm: '',
    notiz: 'Bauchbinde.png',
  }
  useProjectStore.setState((s) => ({
    project: { ...s.project, equipment: [...s.project.equipment, atem], fotos: [...(s.project.fotos ?? []), foto] },
  }))
})
await page.waitForTimeout(800)
await page.locator('.react-flow__node[data-id="atem"]').first().dblclick({ timeout: 8000 })
await page.waitForTimeout(600)
await page.getByTestId('innenansicht-pult').click()
await page.waitForTimeout(800)
ok(await page.getByTestId('pult').isVisible(), 'Umschalter „Pult“ oeffnet das Pult')
for (const id of ['pult-me:1-cut', 'pult-me:1-auto', 'pult-me:1-tbar', 'pult-me:2-auto', 'pult-me:1/key:1', 'pult-dsk:1', 'pult-aux:1', 'pult-ss:1/box:1']) {
  ok((await page.getByTestId(id).count()) === 1, `Bedienelement ${id}`)
}
ok((await page.getByTestId('pult-me:1-pgm-in:1').getAttribute('aria-pressed')) === 'true', 'Programm-Reihe M/E 1 zeigt Eingang 1')
ok((await page.getByTestId('pult-me:1-pvw-ss:1').getAttribute('aria-pressed')) === 'true', 'Vorschau-Reihe M/E 1 zeigt SuperSource 1')

// Pixel des Ergebnisbilds (0…1) lesen.
const pixel = (x, y) =>
  page.evaluate(
    ([x, y]) => {
      const c = document.querySelector('[data-testid="ergebnisbild"]')
      const d = c.getContext('2d').getImageData(Math.floor(x * c.width), Math.floor(y * c.height), 1, 1).data
      return [d[0], d[1], d[2]]
    },
    [x, y],
  )
const rot = (p) => p[0] > 200 && p[1] < 60 && p[2] < 60
const schwarz = (p) => p[0] < 30 && p[1] < 30 && p[2] < 30
const nah = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 40)

await page.waitForTimeout(500)
const vorher = await pixel(0.75, 0.1)
ok(!schwarz(vorher), `Vor Auto: oben rechts Eingang 1 (${vorher})`)
ok(rot(await pixel(0.5, 0.78)), 'Vor Auto: Bauchbinde aus dem PNG liegt auf PGM')
await page.screenshot({ path: join(OUT, 'pult-vorher.png') })

await page.getByTestId('pult-me:1-auto').click()
await page.waitForTimeout(250)
const mitten = await page.evaluate(async () => {
  const { useProjectStore } = await import('/src/renderer/store/projectStore.ts')
  return useProjectStore.getState().project.equipment.find((e) => e.id === 'atem').switching.routes['me:1/pgm']
})
ok(mitten === 'in:1', 'Waehrend Auto ist der Uebergang noch nicht fertig')
await page.waitForTimeout(900)
const nach = await page.evaluate(async () => {
  const { useProjectStore } = await import('/src/renderer/store/projectStore.ts')
  return useProjectStore.getState().project.equipment.find((e) => e.id === 'atem').switching.routes
})
ok(nach['me:1/pgm'] === 'ss:1' && nach['me:1/pvw'] === 'in:1', 'Nach Auto: SuperSource 1 auf Programm, Eingang 1 auf Vorschau')
await page.waitForTimeout(300)
const box2 = await pixel(0.75, 0.1)
ok(schwarz(box2), `Nach Auto: oben rechts Schwarz (Box 2 ohne Quelle) (${box2})`)
ok(rot(await pixel(0.5, 0.78)), 'Nach Auto: Bauchbinde liegt weiter auf PGM')
const box1 = await pixel(0.05, 0.05)
await page.screenshot({ path: join(OUT, 'pult-nach-auto.png') })

// Bildvergleich: Box 1 ist das Bild von M/E 2 in halber Groesse.
await page.getByTestId('pult-ausgabe').selectOption('me:2')
await page.waitForTimeout(400)
const me2 = await pixel(0.1, 0.1)
ok(nah(box1, me2), `Box 1 oben links zeigt M/E 2 (PGM ${box1} ~ M/E 2 ${me2})`)
await page.screenshot({ path: join(OUT, 'pult-me2.png') })

// Multiviewer: Programm gross oben rechts, Vorschau oben links.
await page.getByTestId('pult-ausgabe').selectOption('mv:1')
await page.waitForTimeout(400)
ok(rot(await pixel(0.75, 0.39)), 'Multiviewer: Programmfenster zeigt die Bauchbinde')
await page.screenshot({ path: join(OUT, 'pult-multiviewer.png') })

// Cut zurueck und T-Bar.
await page.getByTestId('pult-me:1-cut').click()
await page.waitForTimeout(200)
const cut = await page.evaluate(async () => {
  const { useProjectStore } = await import('/src/renderer/store/projectStore.ts')
  return useProjectStore.getState().project.equipment.find((e) => e.id === 'atem').switching.routes['me:1/pgm']
})
ok(cut === 'in:1', 'Cut tauscht zurueck')
await page.getByTestId('pult-me:1/key:1').click()
await page.waitForTimeout(200)
const key = await page.evaluate(async () => {
  const { useProjectStore } = await import('/src/renderer/store/projectStore.ts')
  return useProjectStore.getState().project.equipment.find((e) => e.id === 'atem').switching.keyers['me:1/key:1'].onAir
})
ok(key === false, 'Keyer-Taste nimmt USK 1 vom Bild')

ok(fehler.length === 0, `keine Fehler in der Konsole${fehler.length ? ': ' + fehler.slice(0, 3).join(' | ') : ''}`)
await browser.close()
