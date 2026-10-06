import { starte } from '../app.mjs'
const S = '/private/tmp/claude-501/-Users-larszumpe/12f0f693-b544-4eb3-a60a-27e5d3a1fe46/scratchpad/x'
const a = await starte({ sprache: 'de', breite: 1800, hoehe: 1000 })
const w = a.win
const shot = (n) => w.screenshot({ path: `${S}/${n}.png` })
const log = (...x) => console.log(...x)
const kabelPunkt = (i, anteil = 0.5) => w.evaluate(([i, anteil]) => {
  const p = document.querySelectorAll('.react-flow__edge-path')[i]
  const L = p.getTotalLength(); const pt = p.getPointAtLength(L * anteil); const m = p.getScreenCTM()
  return { x: pt.x * m.a + pt.y * m.c + m.e, y: pt.x * m.b + pt.y * m.d + m.f }
}, [i, anteil])
const leer = async () => { await w.keyboard.press('Escape'); await w.mouse.click(900, 700); await w.waitForTimeout(300) }
const step = async (name, fn) => { try { await fn(); log('ok', name) } catch (e) { log('ERR', name, e.message.split('\n')[0]) } }

await step('neu', async () => {
  await a.menue('app.menu.file', 'app.menu.file.new')
  log('DLG', await a.dialogText())
  await shot('q1-nach-neu')
})
await step('demo', async () => {
  const b = w.getByRole('button', { name: /Beispielprojekt laden/ })
  log('demo-button', await b.count())
  if (await b.count()) await b.first().click()
  await w.waitForTimeout(1500)
  await shot('q2-demo')
})
// Pan
await step('pan', async () => {
  await w.mouse.move(900, 700); await w.mouse.down(); await w.mouse.move(900, 850, { steps: 8 }); await w.mouse.up()
  await w.waitForTimeout(500); await shot('q3-pan')
})
await step('defaults', async () => {
  await a.klick('toolbar.defaults.title')
  log('DEFAULTS', await a.menueFeld().innerText())
  await shot('q4-defaults')
  await a.klick('toolbar.defaults.cableColor.byLength')
  await shot('q4b-bylength')
  await a.klick('toolbar.defaults.cableColor.legend')
  await shot('q4c-legend')
})
await step('lock', async () => {
  await leer()
  await a.klick('toolbar.lock.title')
  log('LOCK', await a.menueFeld().innerText())
  await shot('q5-lock')
})
await step('ebenen', async () => {
  await leer()
  await a.klick('canvas.layerChips.menuTitle')
  log('EBENEN', await a.menueFeld().innerText())
  await shot('q6-ebenen')
  await a.klick('canvas.layerChips.addCustom')
  log('PROMPT', await a.dialogText())
  await shot('q6b-prompt')
})
await step('kabel-select', async () => {
  await leer()
  const kp = await kabelPunkt(0, 0.3)
  await w.mouse.click(kp.x, kp.y)
  await w.waitForTimeout(600); await shot('q7-cable-selected')
  log('INSP', (await w.locator('text=Signalweg').count()))
  await a.klickText(/Signalweg (anzeigen|zeigen)/)
  await w.waitForTimeout(600); await shot('q7b-signalweg')
})
await step('sel', async () => {
  await w.keyboard.press('Escape'); await leer()
  const nodes = w.locator('.react-flow__node-equipment')
  log('NODES', await nodes.count())
  await nodes.nth(0).click({ position: { x: 60, y: 10 } })
  await w.waitForTimeout(400); await shot('q8-sel1')
  await nodes.nth(1).click({ position: { x: 60, y: 10 }, modifiers: ['Shift'] })
  await w.waitForTimeout(400); await shot('q8b-sel2')
  await nodes.nth(2).click({ position: { x: 60, y: 10 }, modifiers: ['Shift'] })
  await w.waitForTimeout(400); await shot('q8c-sel3')
  log('TOOLBAR', (await w.locator('[data-cp-canvas-toolbar]').innerText()).replace(/\n+/g, ' | '))
})
await a.ende()
console.log('FERTIG')
