// #1240 — Innenansicht einmal im Browser bedienen (Abnahme Stufe 2).
//
// Voraussetzung: `npm run dev:renderer` laeuft auf :4181. Hell erzwungen,
// weil Headless-Chrome sonst dunkel meldet.
//   node scripts/switching/innenansicht-pruefen.mjs
// Bilder landen in CP_UI_SHOTS (Vorgabe /tmp/cp-innenansicht).
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { erststartOverlayWeg } from '../lib/erststartOverlay.mjs'

const URL = process.env.CP_URL || 'http://localhost:4181/'
const OUT = process.env.CP_UI_SHOTS || '/tmp/cp-innenansicht'
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

// Modul an, ATEM mit dem Abnahme-Zustand und einen Videohub in den Plan.
await page.evaluate(async () => {
  const { useSettingsStore } = await import('/src/renderer/store/settingsStore.ts')
  const { useProjectStore } = await import('/src/renderer/store/projectStore.ts')
  const { BLACKMAGIC_CATALOG } = await import('/src/renderer/lib/blackmagicCatalog.ts')
  useSettingsStore.getState().setModuleEnabled('switching', true)
  const geraet = (name, id, x) => {
    const e = BLACKMAGIC_CATALOG.find((c) => c.template.name === name)
    return {
      ...e.template,
      id,
      x,
      y: 120,
      width: 220,
      height: 300,
      deviceTypeId: e.deviceTypeId,
      inputs: e.template.inputs.map((p, i) => ({ ...p, id: `${id}-in-${i}` })),
      outputs: e.template.outputs.map((p, i) => ({
        ...p,
        id: `${id}-out-${i}`,
      })),
    }
  }
  const atem = geraet('Blackmagic ATEM 2 M/E Constellation 4K', 'atem', 200)
  atem.switching = {
    routes: {
      'me:2/pgm': 'in:2',
      'ss:1/box:1': 'me:2',
      'me:1/pgm': 'ss:1',
      'me:1/key:1/fill': 'mp:1',
      'mp:1/still': 'still:1',
    },
    keyers: { 'me:1/key:1': { onAir: true, type: 'luma' } },
    media: { 'still:1': { anhangId: 'png1' } },
  }
  const vh = geraet('Blackmagic Smart Videohub 20x20', 'vh', 700)
  useProjectStore.setState((s) => ({
    project: {
      ...s.project,
      equipment: [...s.project.equipment, atem, vh],
      anhaenge: [
        ...(s.project.anhaenge ?? []),
        {
          id: 'png1',
          art: 'sonstiges',
          titel: 'Bauchbinde.png',
          datei: {
            sha256: 'x',
            fileName: 'Bauchbinde.png',
            storedAs: 'Anhaenge/Bauchbinde.png',
            mediaType: 'image/png',
            bytes: 1,
            addedAt: '',
          },
          ziel: { type: 'equipment', id: 'atem' },
        },
      ],
    },
  }))
})
await page.waitForTimeout(800)

// Doppelklick oeffnet die Innenansicht.
await page.screenshot({ path: join(OUT, 'plan.png') })
await page.locator('.react-flow__node[data-id="atem"]').first().dblclick({ timeout: 8000 })
await page.waitForTimeout(800)
ok(await page.getByTestId('innenansicht').isVisible(), 'Doppelklick oeffnet die Innenansicht')
ok((await page.locator('[data-testid="innenansicht"] nav').innerText()).includes('Plan'), 'Brotkrumen „Plan › Geraet“')
for (const id of ['r:ss:1/box:1', 'r:me:1/pgm', 'r:me:1/key:1/fill']) {
  ok((await page.locator(`[data-testid="rf__edge-${id}"]`).count()) === 1, `Kante ${id}`)
}
// M/E 2 waehlen: der Weg ueber Box 1 und M/E 1 nach PGM ist hervorgehoben.
await page.locator('[data-testid="innenansicht"] .react-flow__node[data-id="me:2"]').click()
await page.waitForTimeout(400)
const weg = await page.locator('[data-testid="innenansicht"] aside').innerText()
ok(/M\/E 2.*SuperSource 1.*M\/E 1.*PGM/s.test(weg), 'Seitenleiste nennt den Weg M/E 2 › SuperSource 1 › M/E 1 › PGM')
await page.screenshot({ path: join(OUT, 'mischer-me2.png') })
// Mediaplayer 1 waehlen: Weg ueber USK 1.
await page.locator('[data-testid="innenansicht"] .react-flow__node[data-id="mp:1"]').click()
await page.waitForTimeout(400)
const wegMp = await page.locator('[data-testid="innenansicht"] aside').innerText()
ok(/USK 1.*M\/E 1.*PGM/s.test(wegMp), 'Mediaplayer 1 laeuft ueber USK 1 nach PGM')
ok(
  wegMp.includes('Bauchbinde.png') || (await page.locator('[data-slot="1"] select').inputValue()) === 'png1',
  'Standbild 1 traegt das PNG',
)
await page.screenshot({ path: join(OUT, 'mischer-mp1.png') })

// Bedienen: Kante ziehen (Eingang 1 -> Aux 1), Keyer abschalten.
const von = page.locator('[data-testid="innenansicht"] .react-flow__node[data-id="in:1"] .react-flow__handle.source')
const nach = page.locator('[data-testid="innenansicht"] .react-flow__node[data-id="aux:1"] .react-flow__handle.target')
await page.locator('[data-testid="innenansicht"] .react-flow__pane').click({ position: { x: 5, y: 5 } })
await nach.scrollIntoViewIfNeeded().catch(() => {})
const a = await von.boundingBox()
const b = await nach.boundingBox()
if (a && b) {
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.up()
}
await page.waitForTimeout(400)
const pc = await page.evaluate(async () => {
  const { useProjectStore } = await import('/src/renderer/store/projectStore.ts')
  return useProjectStore.getState().project.equipment.find((e) => e.id === 'atem').plannedCrosspoints
})
ok(pc && pc['atem-out-0'] === 'atem-in-0', 'Kante Eingang 1 -> Aux 1 steht in plannedCrosspoints')
await page
  .locator('[data-testid="innenansicht"] .react-flow__node[data-id="me:1/key:1"] input[type="checkbox"]')
  .click()
await page.waitForTimeout(300)
const air = await page.evaluate(async () => {
  const { useProjectStore } = await import('/src/renderer/store/projectStore.ts')
  return useProjectStore.getState().project.equipment.find((e) => e.id === 'atem').switching.keyers['me:1/key:1'].onAir
})
ok(air === false, 'Keyer laesst sich abschalten')

// Zurueck in den Plan, dann die Kreuzschiene.
await page.locator('[data-testid="innenansicht"] nav button').first().click()
await page.waitForTimeout(300)
ok((await page.getByTestId('innenansicht').count()) === 0, 'Brotkrume „Plan“ fuehrt zurueck')
await page.locator('.react-flow__node[data-id="vh"]').first().click({ button: 'right' })
await page
  .getByText(/^(Inner view|Innenansicht)$/)
  .first()
  .click()
await page.waitForTimeout(500)
ok(await page.getByTestId('kreuzschiene-matrix').isVisible(), 'Kontextmenue oeffnet die Matrix der Kreuzschiene')
await page.locator('[data-testid="kreuzschiene-matrix"] tbody tr').nth(2).locator('td button').nth(5).click()
await page.waitForTimeout(300)
const vhr = await page.evaluate(async () => {
  const { useProjectStore } = await import('/src/renderer/store/projectStore.ts')
  return useProjectStore.getState().project.equipment.find((e) => e.id === 'vh').videohubRouting?.planned
})
ok(vhr && vhr[2] === 5, 'Matrix-Klick setzt den Kreuzpunkt in videohubRouting')
await page.screenshot({ path: join(OUT, 'kreuzschiene.png') })

ok(fehler.length === 0, `keine Fehler in der Konsole${fehler.length ? ': ' + fehler.slice(0, 3).join(' | ') : ''}`)
await browser.close()
