/**
 * Leerlauf-Last des Renderers auf einem GROSSEN Plan messen.
 *
 * WARUM ES DAS GIBT (2026-10-21): die gepackte App brauchte im Leerlauf auf
 * einem grossen Plan 25–35 % eines Kerns — ohne dass jemand etwas tat. Die
 * Ursachen lagen verteilt (Fluss-Animation auf jedem Kabel, ein Intervall je
 * Kante, Hindernisse je Kante und Rendern neu gebaut, Abfragen im verborgenen
 * Fenster). Dieser Lauf macht die Last messbar, damit sie nicht wieder
 * unbemerkt zurueckkommt.
 *
 * Er erzeugt einen Plan aus 300 Geraeten und 500 Kabeln, legt ihn als
 * Sicherungskopie ab, laedt den Renderer und liest ueber CDP
 * `Performance.getMetrics` die CPU-Zeit (TaskDuration) in einem ruhigen
 * Fenster von MESS_S Sekunden.
 *
 * Voraussetzung: Renderer laeuft (z. B. `npx vite build && npx vite preview --port 4181`).
 * Lauf: node scripts/leerlauf-messung.mjs   (CP_URL, CP_CHROME, MESS_S)
 */
import { chromium } from 'playwright-core'
import { erststartOverlayWeg } from './lib/erststartOverlay.mjs'

const URL = process.env.CP_URL || 'http://localhost:4181/'
const MESS_S = Number(process.env.MESS_S || 10)
const GERAETE = 300
const KABEL = 500

const port = (id, name) => ({ id, name, signalType: 'SDI', connectorType: 'BNC' })
const grosserPlan = () => {
  const equipment = []
  for (let i = 0; i < GERAETE; i++) {
    equipment.push({
      id: `g${i}`,
      name: `Geraet ${i}`,
      category: 'video',
      x: (i % 20) * 260,
      y: Math.floor(i / 20) * 220,
      inputs: [0, 1, 2, 3].map((p) => port(`g${i}-in${p}`, `In ${p + 1}`)),
      outputs: [0, 1, 2, 3].map((p) => port(`g${i}-out${p}`, `Out ${p + 1}`)),
    })
  }
  const cables = []
  // Jeder Ausgang und jeder Eingang hoechstens einmal: Kabel i fuehrt von
  // Geraet i zum naechsten in der Reihe (Nachbar oder eine Reihe tiefer).
  for (let i = 0; i < KABEL; i++) {
    const runde = Math.floor(i / GERAETE)
    const von = i % GERAETE
    const nach = (von + (runde === 0 ? 1 : 20)) % GERAETE
    const out = `g${von}-out${runde}`
    const inn = `g${nach}-in${runde}`
    cables.push({
      id: `k${cables.length}`,
      name: `K${cables.length}`,
      type: 'SDI',
      color: '#3b82f6',
      fromEquipmentId: `g${von}`,
      fromPortId: out,
      toEquipmentId: `g${nach}`,
      toPortId: inn,
      notes: '',
    })
  }
  const jetzt = new Date().toISOString()
  return {
    metadata: { name: 'Leerlauf-Messung', description: '', createdAt: jetzt, updatedAt: jetzt },
    equipment,
    cables,
    canvasState: { x: 0, y: 0, zoom: 0.6 },
  }
}

const browser = await chromium.launch({
  args: ['--no-sandbox'],
  ...(process.env.CP_CHROME ? { executablePath: process.env.CP_CHROME } : {}),
})
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await ctx.newPage()
const plan = JSON.stringify(grosserPlan())
await page.addInitScript((roh) => {
  try {
    if (sessionStorage.getItem('leerlauf-messung')) return
    sessionStorage.setItem('leerlauf-messung', '1')
    localStorage.setItem('cable-planner.tour.seen.v1', '1')
    localStorage.setItem('cable-planner:settings', JSON.stringify({ onboardingDone: true }))
    localStorage.setItem('cable-planner:projectAutosave', roh)
  } catch {
    /* noop */
  }
}, plan)

console.error('· Browser offen')
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120_000 })
console.error('· Seite da')
await erststartOverlayWeg(page, { lautScheitern: false })
console.error('· Overlays weg')
await page.waitForSelector('.react-flow__edge', { timeout: 60_000 })
console.error('· Kanten da')
await page.waitForTimeout(5000)

const cdp = await ctx.newCDPSession(page)
await cdp.send('Performance.enable')
const metrik = async () => {
  const { metrics } = await cdp.send('Performance.getMetrics')
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]))
}
const a = await metrik()
await page.waitForTimeout(MESS_S * 1000)
const b = await metrik()
const d = (k) => b[k] - a[k]
const knoten = await page.locator('.react-flow__node').count()
const kanten = await page.locator('.react-flow__edge').count()
const ergebnis = {
  knotenImDom: knoten,
  kantenImDom: kanten,
  cpuProzent: +((d('TaskDuration') / MESS_S) * 100).toFixed(1),
  scriptMsJeS: +((d('ScriptDuration') * 1000) / MESS_S).toFixed(1),
  layoutsJeS: +(d('LayoutCount') / MESS_S).toFixed(1),
  styleRecalcsJeS: +(d('RecalcStyleCount') / MESS_S).toFixed(1),
}
console.log(JSON.stringify(ergebnis))
await browser.close()
