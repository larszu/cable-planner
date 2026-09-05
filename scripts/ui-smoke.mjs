/**
 * Headless-UI-Smoke-Test — startet die GEBAUTE Electron-App, schießt
 * Screenshots vom Hauptfenster und von jedem Top-Menü und meldet, wenn ein
 * Menü nicht öffnet. Findet Render-/Boot-Fehler + tote Menüs ohne manuelles
 * Klicken. (Mit diesem Harness wurde z. B. der Zoom-Anzeige-Bug #549 gefunden.)
 *
 * Voraussetzungen:
 *   1. `npm run build` vorher (lädt dist/renderer + dist/main).
 *   2. Native Module (keytar …) müssen für Electron gebaut sein — bei einem
 *      normalen `npm install` der Fall; auf einem nackten CI ggf. vorher
 *      `npx @electron/rebuild`.
 *   3. Linux/headless: `xvfb-run -a npm run ui:smoke`.
 *      macOS/Windows mit Display: einfach `npm run ui:smoke`.
 *
 * Output: PNGs nach $CP_UI_SHOTS (Default: <tmpdir>/cable-planner-ui-shots).
 * Menü-Erkennung ist sprach-unabhängig (über `aria-haspopup="menu"`).
 */
import { _electron as electron } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT = process.env.CP_UI_SHOTS || join(tmpdir(), 'cable-planner-ui-shots')
mkdirSync(OUT, { recursive: true })

const app = await electron.launch({ args: ['.', '--no-sandbox', '--disable-gpu'] })
const win = await app.firstWindow({ timeout: 30000 })
await win.waitForLoadState('domcontentloaded')
await win.waitForTimeout(3500)

const shot = async (name) => {
  await win.screenshot({ path: join(OUT, `${name}.png`) })
  console.log('captured', name)
}

await shot('01-launch')

// Erststart-Overlays (Welcome-Dialog / Onboarding-Tour) wegklicken, damit die
// Menüleiste frei bedienbar ist.
//
// Vorher standen hier zwei feste Klickversuche und ein Escape, Fehler
// verschluckt. Das genügte auf einem Profil, das die Tour schon gesehen hatte —
// und CI hat IMMER ein frisches Profil. Gemessen 2026-09-05: mit gelöschtem
// `~/.config/cable-planner` bleibt die Getting-Started-Tour (Schritt 1/7)
// stehen, ihr `.cp-modal-backdrop` fängt jeden Klick ab, und der erste
// Menü-Klick läuft 30 Sekunden in einen Timeout. Genau deshalb lief dieser
// Lauf nie in CI: er kann dort in der alten Form gar nicht durchkommen.
//
// Jetzt wird auf den ZUSTAND geschleift statt auf eine feste Zahl von
// Versuchen: solange ein Backdrop steht, wird weiter zugemacht. Ein Overlay,
// das später dazukommt (das Dismissen des Welcome-Dialogs startet die Tour),
// wird damit auch erwischt.
const overlayWeg = async () => {
  const abweisungen =
    /End tour|Tour beenden|Beenden|Skip|Überspringen|Fertig|Decide later|Später|Schließen|Close/i
  for (let runde = 0; runde < 6; runde++) {
    if ((await win.locator('.cp-modal-backdrop').count()) === 0) return
    const b = win.getByRole('button', { name: abweisungen })
    if (await b.count()) await b.first().click({ timeout: 1500 }).catch(() => {})
    await win.keyboard.press('Escape').catch(() => {})
    await win.waitForTimeout(400)
  }
  const rest = await win.locator('.cp-modal-backdrop').count()
  if (rest > 0) {
    // Laut scheitern statt weiterlaufen: sonst folgt ein 30-Sekunden-Timeout
    // beim ersten Menü-Klick, und der sagt nichts über die Ursache.
    throw new Error(
      `Erststart-Overlay liess sich nicht schliessen (${rest} Backdrop(s) offen). ` +
        'Screenshot 01-launch.png zeigt, was steht.',
    )
  }
}
await overlayWeg()
await shot('02-main')

// Top-Menüs öffnen — sprach-unabhängig über die Menü-Buttons.
const menus = await win.$$('header button[aria-haspopup="menu"]')
console.log('menu buttons found:', menus.length)
let failures = 0
for (let i = 0; i < menus.length; i++) {
  const label = (await menus[i].innerText()).trim().replace(/\s*▾\s*$/, '') || `menu${i + 1}`
  await menus[i].click()
  await win.waitForTimeout(400)
  const itemCount = await win.locator('[role="menuitem"]').count()
  if (itemCount === 0) {
    console.error(`  ✗ "${label}" öffnete keine Einträge`)
    failures += 1
  }
  await shot(`menu-${String(i + 1).padStart(2, '0')}-${label.replace(/[^\w]+/g, '_')}`)
  await win.keyboard.press('Escape')
  await win.waitForTimeout(200)
}

await app.close()
console.log(`UI smoke done → ${OUT} (${menus.length} Menüs, ${failures} ohne Einträge)`)
process.exit(failures > 0 ? 1 : 0)
