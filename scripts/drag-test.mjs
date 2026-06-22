/**
 * Headless Drag-/Interaktions-Test im BROWSER-Modus (Renderer via Vite).
 * Desktop-/IPC-Features sind inert, aber das Canvas-/ReactFlow-Drag-
 * Verhalten ist reine Renderer-Logik — ideal um Verschiebbarkeit zu prüfen.
 *
 * Prüft, dass Geräte-Knoten, Location-Rahmen und die Inline-Auswahl-Toolbar
 * (#118) sich verhalten wie erwartet, und meldet Renderer-Konsolenfehler.
 *
 * Voraussetzung: `npm run dev:renderer` läuft auf :5173.
 * Lauf:          npm run test:drag   (oder: node scripts/drag-test.mjs)
 *   Browser-Pfad ggf. via CP_CHROME=… überschreiben (Sandbox), Screenshots
 *   landen in CP_UI_SHOTS (Default /tmp/cp-drag-shots).
 */
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const URL = process.env.CP_URL || 'http://localhost:5173/'
const OUT = process.env.CP_UI_SHOTS || '/tmp/cp-drag-shots'
mkdirSync(OUT, { recursive: true })

// Auf einem normalen Dev-Rechner findet Playwright sein eigenes Chromium
// (nach `npx playwright install`). In einer Sandbox mit vorinstalliertem
// Browser kann der Pfad über CP_CHROME gesetzt werden.
const browser = await chromium.launch({
  args: ['--no-sandbox'],
  ...(process.env.CP_CHROME ? { executablePath: process.env.CP_CHROME } : {}),
})
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await ctx.newPage()

// Onboarding/Tour vorab als gesehen markieren (frischer Browser hat leeren
// localStorage → sonst blockiert der Welcome-Dialog den Canvas).
await page.addInitScript(() => {
  try {
    localStorage.setItem('cable-planner.tour.seen.v1', '1')
    localStorage.setItem('cable-planner:settings', JSON.stringify({ onboardingDone: true }))
  } catch {
    /* noop */
  }
})

const consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message))

const log = (...a) => console.log(...a)
const shot = async (name) => {
  await page.screenshot({ path: join(OUT, `${name}.png`) })
  log('  · screenshot', name)
}

await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)

for (const rx of [/Decide later|Später/i, /Skip|Überspringen|End tour|Beenden|Fertig|Los geht/i]) {
  const b = page.getByRole('button', { name: rx })
  if (await b.count()) await b.first().click({ timeout: 1500 }).catch(() => {})
}
await page.keyboard.press('Escape').catch(() => {})
await page.waitForTimeout(400)
await shot('01-start')

// Beispielprojekt laden.
let loaded = false
const demoBtn = page.getByText(/Beispielprojekt laden|Load demo|example project/i)
if (await demoBtn.count()) {
  await demoBtn.first().click().catch(() => {})
  loaded = true
}
if (!loaded) {
  await page.keyboard.press('Control+k').catch(() => {})
  await page.waitForTimeout(300)
  const cmd = page.getByText(/Beispielprojekt laden|Load demo/i)
  if (await cmd.count()) await cmd.first().click().catch(() => {})
  await page.keyboard.press('Escape').catch(() => {})
}
await page.waitForTimeout(1500)
await shot('02-demo-loaded')

const nodeInfo = async (sel) =>
  page.$$eval(sel, (els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return {
        id: el.getAttribute('data-id'),
        transform: el.style.transform,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      }
    }),
  )

const equip = await nodeInfo('.react-flow__node-equipment')
log(`\nGeräte-Knoten gefunden: ${equip.length}`)
if (equip.length === 0) {
  log('!! Keine Geräte — Demo nicht geladen. Konsolenfehler:', consoleErrors.slice(0, 10))
  await browser.close()
  process.exit(2)
}

const dragNode = async (selector, id, dx, dy, label, grabYOffset = 10) => {
  const before = (await nodeInfo(selector)).find((n) => n.id === id)
  if (!before) return { ok: false }
  const sx = before.rect.x + Math.min(before.rect.w / 2, 40)
  const sy = before.rect.y + grabYOffset
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(sx + (dx * i) / 12, sy + (dy * i) / 12)
    await page.waitForTimeout(14)
  }
  await page.mouse.up()
  await page.waitForTimeout(350)
  const after = (await nodeInfo(selector)).find((n) => n.id === id)
  const moved =
    !!after &&
    after.transform !== before.transform &&
    (Math.abs(after.rect.x - before.rect.x) > 4 || Math.abs(after.rect.y - before.rect.y) > 4)
  log(
    `\n[${label}] id=${id}\n  vorher : ${before.transform} @ (${before.rect.x},${before.rect.y})\n  nachher: ${after?.transform} @ (${after?.rect.x},${after?.rect.y})\n  → ${moved ? 'VERSCHOBEN ✓' : 'NICHT verschoben ✗'}`,
  )
  return { ok: moved, before, after }
}

// Test 1: Gerät anklicken (Auswahl) + Screenshot
await page.mouse.click(equip[0].rect.x + 30, equip[0].rect.y + 8)
await page.waitForTimeout(300)
await shot('03-device-selected')
// Kleiner Versatz in freie Fläche darunter (Overlap-Schutz #183 revertiert
// Drops auf belegte Flächen — daher bewusst in den freien Bereich ziehen).
const r1 = await dragNode('.react-flow__node-equipment', equip[0].id, 0, 44, 'Gerät 1', 6)
await shot('04-device-after-drag')

// Test 2: zweites Gerät, ebenfalls in freie Fläche
let r2 = { ok: true, skipped: true }
if (equip.length > 1) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  const fresh = await nodeInfo('.react-flow__node-equipment')
  r2 = await dragNode('.react-flow__node-equipment', fresh[1].id, 0, 44, 'Gerät 2', 6)
  await shot('05-device2-after-drag')
}

// Test 3: Inline-Toolbar bei Auswahl
await page.keyboard.press('Escape')
await page.waitForTimeout(150)
const freshAll = await nodeInfo('.react-flow__node-equipment')
await page.mouse.click(freshAll[0].rect.x + 30, freshAll[0].rect.y + 10)
await page.waitForTimeout(300)
const inlineCount = await page.locator('div[role="toolbar"][aria-label]').count()
log(`\nInline-Toolbar sichtbar bei Einzel-Auswahl: ${inlineCount > 0 ? 'JA' : 'NEIN'} (${inlineCount})`)
await shot('06-inline-toolbar')

// Test 4: Multi-Select + Inline-Toolbar (Ausrichten sichtbar?)
await page.keyboard.press('Escape')
await page.waitForTimeout(150)
const all = await nodeInfo('.react-flow__node-equipment')
if (all.length > 1) {
  await page.mouse.click(all[0].rect.x + 30, all[0].rect.y + 10)
  await page.keyboard.down('Shift')
  await page.mouse.click(all[1].rect.x + 30, all[1].rect.y + 10)
  await page.keyboard.up('Shift')
  await page.waitForTimeout(300)
  const toolbarButtons = await page.locator('div[role="toolbar"][aria-label] button').count()
  log(`Inline-Toolbar Buttons bei Mehrfach-Auswahl: ${toolbarButtons}`)
  await shot('07-inline-toolbar-multi')
}

// Test 5: Location-Rahmen — via Inline-Toolbar "Rahmen um Auswahl"
let frameResult = { ok: null }
const frameBtn = page.getByRole('button', { name: /Rahmen um Auswahl|Frame around/i })
if (await frameBtn.count()) {
  await frameBtn.first().click().catch(() => {})
  await page.waitForTimeout(500)
}
await shot('08-after-frame-create')
const frames = await nodeInfo('.react-flow__node-location')
log(`\nLocation-Rahmen gefunden: ${frames.length}`)
if (frames.length > 0) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  frameResult = await dragNode('.react-flow__node-location', frames[0].id, 130, 60, 'Location-Rahmen', 6)
  await shot('09-frame-after-drag')
}

log('\n--- Renderer-Konsolenfehler ---')
if (consoleErrors.length === 0) log('  (keine)')
else consoleErrors.slice(0, 20).forEach((e) => log('  ✗', e))

await browser.close()

log('\n================ ERGEBNIS ================')
log(`Gerät 1 verschiebbar     : ${r1.ok ? 'JA' : 'NEIN'}`)
log(`Gerät 2 verschiebbar     : ${r2.skipped ? 'n/a' : r2.ok ? 'JA' : 'NEIN'}`)
log(`Inline-Toolbar (1 Gerät) : ${inlineCount > 0 ? 'JA' : 'NEIN'}`)
log(`Location-Rahmen verschiebbar: ${frameResult.ok === null ? 'n/a' : frameResult.ok ? 'JA' : 'NEIN'}`)
log(`Konsolenfehler: ${consoleErrors.length}`)
log(`Screenshots → ${OUT}`)
process.exit(!r1.ok ? 1 : 0)
