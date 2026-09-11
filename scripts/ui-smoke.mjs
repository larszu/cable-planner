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
//
// ─── DER KNOPF WIRD IM OBERSTEN OVERLAY GESUCHT, NICHT IM GANZEN FENSTER ──
//
// GEMESSEN am 2026-09-11 (cable#852): der Lauf fiel mit „2 Backdrop(s)
// offen" aus, an einer Änderung, die kein Overlay anfasst. Der PR gab zwei
// schwebenden Leisten des Plans je einen Schliessen-Knopf, beschriftet
// „Close toolbar …" und „Close search …". Die Liste unten enthält `Close`.
// `getByRole` suchte im GANZEN Fenster, und `.first()` nimmt den ersten
// Treffer in DOM-Reihenfolge — das waren ab da die neuen Knöpfe. Der Lauf
// verbrauchte seine Runden damit, Leisten zuzumachen, die nicht im Weg
// standen, und rührte das Overlay nicht an.
//
// Der Fehler lag nicht in den neuen Knöpfen. Er lag hier: ein
// Abweisen-Klick, der irgendeinen Knopf mit passender Beschriftung im
// Fenster trifft, prüft nicht das Overlay, sondern den Wortschatz der
// ganzen App — und der wächst. Jede künftige Schaltfläche, die „Close" oder
// „Schliessen" heisst, hätte denselben Ausfall ausgelöst.
//
// Gesucht wird deshalb INNERHALB eines `.cp-modal-backdrop`. Jeder Dialog
// trägt seinen Abweisen-Knopf dort (`ModalShell`), der Lauf verliert also
// nichts.
//
// ─── UND ZWAR IM OBERSTEN, NACH z-index STATT NACH DOM-REIHENFOLGE ────────
//
// GEMESSEN beim Nachbessern, gleicher Tag: beim Erststart stehen DREI
// Overlays gleichzeitig, und die DOM-Reihenfolge sagt NICHT, welches oben
// liegt:
//
//   DOM 0  z=50  „Getting-started tour · step 1 / 7"
//   DOM 1  z=60  „Welcome to Cable Planner"
//   DOM 2  z=50  „Welcome — what do you use Cable Planner for?"
//
// Ein `.last()` griff damit den Segment-Dialog (z=50), dessen Knöpfe unter
// dem Welcome-Dialog (z=60) liegen: sechs Runden Klick-Timeout. Ein
// `.first()` griffe die Tour — dieselbe Lage, andere Ecke.
//
// Gewählt wird deshalb nach dem gerechneten `z-index`, bei Gleichstand das
// spätere im DOM (so malt der Browser). Das ist die einzige Ordnung, die
// hier der Wirklichkeit auf dem Schirm entspricht.
const overlayWeg = async () => {
  const abweisungen =
    /End tour|Tour beenden|Beenden|Skip|Überspringen|Fertig|Decide later|Später|Schließen|Close/i

  /** Index des obersten Backdrops, oder -1 wenn keines steht. */
  const oberstes = () =>
    win.evaluate(() =>
      [...document.querySelectorAll('.cp-modal-backdrop')]
        .map((el, i) => ({ i, z: Number.parseInt(getComputedStyle(el).zIndex, 10) || 0 }))
        .reduce((a, b) => (b.z >= a.z ? b : a), { i: -1, z: -Infinity }).i,
    )

  // Eine Runde je Overlay plus Reserve: drei Overlays beim Erststart, und
  // das Abweisen des Welcome-Dialogs startet die Tour erst.
  for (let runde = 0; runde < 8; runde++) {
    const oben = await oberstes()
    if (oben < 0) return
    const b = win.locator('.cp-modal-backdrop').nth(oben).getByRole('button', { name: abweisungen })
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
