// #1206 — GDTF/MVR-Import, Rahmen-Kopie und Alt-Aufziehen einmal in der echten
// Oberflaeche bedienen (Browser, `npm run dev:renderer` muss laufen).
//
//   node scripts/gdtf-mvr/ui-pruefung.mjs [http://localhost:4181] [ausgabeordner]
//
// Die MVR-Datei baut das Skript selbst (fflate), damit keine Kundendatei im
// Repo liegt.
import { chromium } from 'playwright-core'
import { strToU8, zipSync } from 'fflate'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { erststartOverlayWeg } from '../lib/erststartOverlay.mjs'

const url = process.argv[2] ?? 'http://localhost:4181/'
const aus = process.argv[3] ?? join(tmpdir(), 'cable-1206-ui')
mkdirSync(aus, { recursive: true })

const gdtf = `<?xml version="1.0"?><GDTF DataVersion="1.2"><FixtureType Name="Wash 7" Manufacturer="Testwerk" FixtureTypeID="11111111-2222-4333-8444-555555555555">
<PhysicalDescriptions><Properties><Weight Value="9"/></Properties></PhysicalDescriptions>
<Geometries><Geometry Name="Body">
<WiringObject Name="Power In" ConnectorType="PowerconTRUE1" ComponentType="Consumer" SignalType="Power" ElectricalPayLoad="320"/>
<WiringObject Name="DMX In" ConnectorType="XLR5" ComponentType="Input" SignalType="DMX512"/>
<WiringObject Name="DMX Out" ConnectorType="XLR5" ComponentType="Output" SignalType="DMX512"/>
</Geometry></Geometries>
<DMXModes><DMXMode Name="Extended" Geometry="Body"><DMXChannels><DMXChannel Offset="1,2" Geometry="Body"/><DMXChannel Offset="24" Geometry="Body"/></DMXChannels></DMXMode></DMXModes>
</FixtureType></GDTF>`
const fixture = (n, x, adr) => `<Fixture uuid="u${n}" name="Wash ${n}"><Matrix>{1,0,0}{0,1,0}{0,0,1}{${x},0,5000}</Matrix><GDTFSpec>Testwerk@Wash 7.gdtf</GDTFSpec><GDTFMode>Extended</GDTFMode><FixtureID>${n}</FixtureID><Addresses><Address break="0">${adr}</Address></Addresses></Fixture>`
const mvr = `<?xml version="1.0"?><GeneralSceneDescription verMajor="1" verMinor="6"><Scene><Layers><Layer name="Rig" uuid="L"><ChildList>
${[1, 2, 3, 4].map((n) => fixture(n, n * 2000, `1.${(n - 1) * 24 + 1}`)).join('\n')}
<Truss uuid="t" name="Truss"/></ChildList></Layer></Layers></Scene></GeneralSceneDescription>`
const mvrPfad = join(aus, 'test.mvr')
writeFileSync(mvrPfad, zipSync({ 'GeneralSceneDescription.xml': strToU8(mvr), 'Testwerk@Wash 7.gdtf': zipSync({ 'description.xml': strToU8(gdtf) }) }))

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, colorScheme: 'light', locale: 'de-DE' })
const fehler = []
page.on('pageerror', (e) => fehler.push(String(e)))
await page.goto(url)
await page.waitForSelector('.react-flow', { timeout: 30000 })
await erststartOverlayWeg(page)
// Der Willkommensdialog: leeres Projekt, damit nur die importierten Geraete zaehlen.
// Er erscheint verzoegert, deshalb warten statt zaehlen.
await page
  .getByRole('button', { name: /Neues Projekt|New project/ })
  .first()
  .click({ timeout: 10000 })
  .catch(() => {})
await erststartOverlayWeg(page)
await page.screenshot({ path: join(aus, '0-start.png') })

const vorher = await page.locator('.react-flow__node-equipment').count()
await page.getByRole('button', { name: /^Datei$|^File$/ }).first().click()
await page.getByText(/GDTF \/ MVR/).first().click()
await page.locator('input[type=file][accept=".gdtf,.mvr"]').setInputFiles(mvrPfad)
await page.getByText('Testwerk@Wash 7.gdtf').waitFor()
await page.screenshot({ path: join(aus, '1-mvr-dialog.png') })
await page.getByRole('button', { name: /Geräte platzieren|Place devices/ }).click()
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
const nachher = await page.locator('.react-flow__node-equipment').count()
await page.screenshot({ path: join(aus, '2-platziert.png') })

// Alt + Ziehen ueber die vier neuen Geraete — erst alles ins Bild holen.
await page.locator('.react-flow__controls button').nth(2).click()
await page.waitForTimeout(400)
const boxen = await page.locator('.react-flow__node-equipment').evaluateAll((els) =>
  els.slice(-4).map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom] }),
)
const [x0, y0] = [Math.min(...boxen.map((b) => b[0])) - 30, Math.min(...boxen.map((b) => b[1])) - 30]
const [x1, y1] = [Math.max(...boxen.map((b) => b[2])) + 30, Math.max(...boxen.map((b) => b[3])) + 30]
await page.mouse.click(10, 500)
await page.keyboard.down('Alt')
await page.mouse.move(x0, y0)
await page.mouse.down()
await page.mouse.move(x1, y1, { steps: 10 })
await page.mouse.up()
await page.keyboard.up('Alt')
const markiert = await page.locator('.react-flow__node-equipment.selected').count()

// Kopieren + Einfuegen: die Kopien sind danach gemeinsam markiert.
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
await page.keyboard.press(`${mod}+c`)
await page.keyboard.press(`${mod}+v`)
await page.waitForTimeout(400)
const nachEinfuegen = await page.locator('.react-flow__node-equipment').count()
const markiertNachEinfuegen = await page.locator('.react-flow__node-equipment.selected').count()
await page.screenshot({ path: join(aus, '3-eingefuegt.png') })

// Rahmen um die Auswahl, dann per Rechtsklick mit Inhalt duplizieren.
await page.locator('button', { hasText: /^\s*(Rahmen|Frame)\s*$/ }).first().click()
await page.waitForTimeout(300)
const rahmenVorher = await page.locator('.react-flow__node-location').count()
await page.locator('.react-flow__node-location').first().click({ button: 'right', position: { x: 8, y: 8 } })
await page.getByText(/Rahmen mit Inhalt duplizieren|Duplicate frame with contents/).click()
await page.waitForTimeout(400)
const rahmenNachher = await page.locator('.react-flow__node-location').count()
const geraeteNachRahmen = await page.locator('.react-flow__node-equipment').count()
await page.screenshot({ path: join(aus, '4-rahmen.png') })

// Unterkategorie in der Bibliothek.
const audio = page.locator('.group\\/cat', { hasText: /^Audio/ }).first()
await audio.hover()
await audio.getByRole('button', { name: /Neue Unterkategorie|New subcategory/ }).click()
await page.locator('input:focus').fill('Lautsprecher')
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
const unterkategorie = await page.locator('.group\\/cat', { hasText: /^Lautsprecher/ }).count()
await page.screenshot({ path: join(aus, '5-unterkategorie.png') })

const ergebnis = { vorher, nachher, markiert, nachEinfuegen, markiertNachEinfuegen, rahmenVorher, rahmenNachher, geraeteNachRahmen, unterkategorie, fehler }
console.log(JSON.stringify(ergebnis, null, 2))
await browser.close()
const ok =
  nachher - vorher === 4 && markiert === 4 && nachEinfuegen === nachher + 4 && markiertNachEinfuegen === 4 &&
  rahmenNachher === rahmenVorher + 1 && geraeteNachRahmen > nachEinfuegen && unterkategorie === 1 && fehler.length === 0
process.exit(ok ? 0 : 1)
