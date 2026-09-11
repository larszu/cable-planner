// ───────────────────────────────────────────────────────────────────────────
// Die README-Bilder aufnehmen — aus der laufenden App, nicht von Hand.
//
// ─── WARUM ES DIESES SKRIPT GIBT ───────────────────────────────────────────
//
// Weil die Bilder sonst altern, ohne dass es jemand sieht. Gemessen am
// 2026-09-10: die eingecheckten Aufnahmen stammen aus **v8.1.0-101**, die App
// stand bei **v9.0.1**. Dazwischen liegen die Sprachdrehung (E-28) und der
// Icon-Durchgang — auf `properties.png` steht deshalb eine deutsche
// Oberflaeche mit Knoepfen („Configure multiviewer layout →", „↻ auto"), die
// es so nicht mehr gibt. Das Titelbild eines Repos ist die erste Auskunft,
// die jemand ueber das Produkt bekommt; eine veraltete ist eine falsche.
//
// `docs/screenshots/README.md` sagte dazu:
//
//   > Aufnahme = manueller Schritt. Echte Screenshots/GIFs brauchen die
//   > laufende GUI und können nicht automatisch erzeugt werden.
//
// Die erste Haelfte stimmt, die zweite nicht: die GUI laeuft hier unter
// `xvfb-run`, genau wie fuer `ui:smoke` und `ui:overflow`. Ein Satz, der eine
// Arbeit fuer unmoeglich erklaert, sorgt zuverlaessig dafuer, dass sie
// liegenbleibt.
//
// ─── UND WARUM AUS DEM DEMO-PROJEKT ────────────────────────────────────────
//
// Die alten Aufnahmen zeigten einen echten Kundenplan und mussten geschwaerzt
// werden (`docs/redact-screenshots.mjs`, eine Pflicht-Checkliste im Guide).
// Das eingebaute Beispielprojekt traegt keine Kundendaten — es gibt also
// nichts zu schwaerzen und nichts zu vergessen. Die sicherste Schwaerzung ist
// die, die nicht noetig ist.
//
// Der Preis steht hier, statt verschwiegen zu werden: das Beispiel ist mit
// 5 Geraeten und 4 Kabeln kleiner als der Kundenplan von damals (9/12). Das
// Titelbild zeigt also einen kleineren Plan als vorher. Ein kleiner, aber
// aktueller Plan ist trotzdem die bessere Auskunft als ein grosser, der die
// Oberflaeche von vorgestern zeigt.
//
// ─── AUFRUF ────────────────────────────────────────────────────────────────
//
//   npm run build && xvfb-run -a node scripts/screenshots.mjs
//
// Schreibt nach `docs/screenshots/` und stempelt `aufnahme.json` mit der
// Version, gegen die aufgenommen wurde. `tests/screenshotsAktuell.test.ts`
// vergleicht diesen Stempel mit `package.json` — damit faellt das naechste
// Altern auf, statt unsichtbar zu bleiben.
// ───────────────────────────────────────────────────────────────────────────

import { _electron as electron } from 'playwright-core'
import { erststartOverlayWeg } from './lib/erststartOverlay.mjs'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const WURZEL = process.cwd()
const ZIEL = join(WURZEL, 'docs', 'screenshots')
const version = JSON.parse(readFileSync(join(WURZEL, 'package.json'), 'utf8')).version

/** Fenstergroesse aus dem Guide: die Galerie zeigt die Bilder auf 420px. */
const BREITE = 1500
const HOEHE = 950

mkdirSync(ZIEL, { recursive: true })

// ── Mit leerem Profil starten ──────────────────────────────────────────────
//
// Sonst nimmt der Lauf, was der letzte hinterlassen hat. Gemessen am
// 2026-09-10: die Aufnahme zeigte das AUTOSAVE einer frueheren Sitzung —
// „Beispiel: Kleines Studio-Setup" mit `Kamera 1` und `Bildmischer` —,
// obwohl das Beispielprojekt im Code laengst englisch war (#822). Und die
// Seitenleiste fuehrte `Patch panels` zweimal, weil eine alte Vorlage aus
// `localStorage` noch den deutschen Kategorienamen trug.
//
// Ein Bildersatz, der von der letzten Sitzung abhaengt, sagt nichts ueber das
// Produkt. Der Ordner geht deshalb weg, bevor Electron startet — dasselbe
// Argument wie beim Festnageln von Sprache und Thema weiter unten, nur eine
// Ebene tiefer.
rmSync(join(homedir(), '.config', 'cable-planner'), { recursive: true, force: true })
rmSync(join(homedir(), '.config', 'Cable Planner'), { recursive: true, force: true })

// ── WebGL statt `--disable-gpu` ────────────────────────────────────────────
//
// Der Lauf startete bis zum 2026-09-10 mit `--disable-gpu`, und das hat die
// halbe Anwendung unsichtbar gemacht: die 3D-Rack-Ansicht haengt an WebGL, und
// mit dem Schalter gibt `canvas.getContext('webgl')` schlicht `null` zurueck.
// Gemessen — mit `--disable-gpu` blieb das Canvas auf seiner Vorgabegroesse
// (300x150) und die Flaeche schwarz; mit SwiftShader meldet sich
// `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader
// driver)` und das Rack steht da.
//
// Es ist Software-Rendering; die 2D-Aufnahmen sehen unveraendert aus (die
// Oberflaeche ist DOM). Was sich aendert, ist, dass ein Bild vom groessten
// Brocken der Anwendung ueberhaupt entstehen kann.
const app = await electron.launch({
  args: [
    '.',
    '--no-sandbox',
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
  executablePath: join(WURZEL, 'node_modules', 'electron', 'dist', 'electron'),
  cwd: WURZEL,
})
const win = await app.firstWindow({ timeout: 30_000 })
await win.setViewportSize({ width: BREITE, height: HOEHE })
await win.waitForLoadState('domcontentloaded')
await win.waitForTimeout(3500)

// Onboarding und Tour wegklicken — sie liegen sonst ueber jedem Bild. Die
// Regel liegt in `lib/erststartOverlay.mjs`; sie stand bis 2026-09-11 hier
// abgeschrieben, mit einer eigenen, kuerzeren Abweisungs-Liste. Zwei
// Fassungen derselben Frage sind `zwei-rechnungen`, und diese hier war die
// aermere.
//
// `lautScheitern: false`: ein stehengebliebenes Overlay macht hier ein
// haessliches Bild, keine falsche Messung — der Lauf soll die uebrigen Bilder
// trotzdem schiessen.
const restOverlays = await erststartOverlayWeg(win, { lautScheitern: false })
if (restOverlays > 0) {
  console.warn(`Achtung: ${restOverlays} Overlay(s) stehen noch — die Bilder zeigen sie mit.`)
}

const demo = win.getByRole('button', { name: /Load example project|Beispielprojekt laden/i })
if (await demo.count()) {
  await demo.first().click()
  await win.waitForTimeout(2000)
}

const zu = async () => {
  for (let i = 0; i < 3; i += 1) {
    if ((await win.locator('[role="dialog"]').count()) === 0) return
    await win.keyboard.press('Escape').catch(() => {})
    await win.waitForTimeout(250)
  }
}

/** Einen Befehl aus der Palette ausfuehren — derselbe Weg wie ein Nutzer. */
const palette = async (text) => {
  await zu()
  await win.keyboard.press('Control+k')
  await win.waitForTimeout(450)
  await win.keyboard.type(text)
  await win.waitForTimeout(450)
  await win.keyboard.press('Enter')
  await win.waitForTimeout(1400)
}

// ── Sprache und Thema festnageln ───────────────────────────────────────────
//
// NICHT „so wie es gerade eingestellt ist": die Einstellungen ueberleben in
// diesem Container zwischen Laeufen, und ein Bildersatz, der je nach letzter
// Sitzung mal hell und mal dunkel ist, sagt nichts ueber das Produkt.
await palette('Settings')
const darstellung = win.getByText(/^Appearance$|^Darstellung$/).first()
if (await darstellung.count()) {
  await darstellung.click().catch(() => {})
  await win.waitForTimeout(600)
}
const englisch = win.getByRole('button', { name: /English/ }).first()
if (await englisch.count()) {
  await englisch.click().catch(() => {})
  await win.waitForTimeout(800)
}
const dunkel = win.getByRole('button', { name: /^Dark$|^Dunkel$/ }).first()
if (await dunkel.count()) {
  await dunkel.click().catch(() => {})
  await win.waitForTimeout(900)
}
await zu()
await win.waitForTimeout(700)

const aufnehmen = async (datei, ziel) => {
  const el = ziel ? win.locator(ziel).first() : null
  if (el && (await el.count())) await el.screenshot({ path: join(ZIEL, datei) })
  else await win.screenshot({ path: join(ZIEL, datei) })
  console.log(`  ${datei}`)
}

const gemacht = []

// ── hero.png — der Plan als Ganzes ─────────────────────────────────────────
await win.keyboard.press('Escape').catch(() => {})
await win.waitForTimeout(600)
await aufnehmen('hero.png')
gemacht.push('hero.png')

// ── properties.png — ein Geraet mit seinen Eigenschaften ───────────────────
const geraet = win.locator('.react-flow__node').first()
if (await geraet.count()) {
  await geraet.click()
  await win.waitForTimeout(900)
  await aufnehmen('properties.png')
  gemacht.push('properties.png')
}

// ── Die Dialoge ────────────────────────────────────────────────────────────
//
// Je Eintrag: der Suchtext fuer die Palette und die Zieldatei. Der Dialog
// selbst wird ausgeschnitten (`[role="dialog"]`), nicht das ganze Fenster —
// sonst zeigt ein Galeriebild auf 420px vor allem Hintergrund.
const DIALOGE = [
  ['Export', 'export.png'],
  ['Patch list', 'patch-sheets.png'],
  ['Cable bill of materials', 'bom.png'],
]
for (const [befehl, datei] of DIALOGE) {
  await palette(befehl)
  if ((await win.locator('[role="dialog"]').count()) === 0) {
    console.log(`  ${datei}: kein Dialog nach „${befehl}" — uebersprungen`)
    continue
  }
  await win.waitForTimeout(700)
  await aufnehmen(datei, '[role="dialog"]')
  gemacht.push(datei)
}
await zu()

// ── rack-3d.png — die 3D-Ansicht des Beispiel-Racks ────────────────────────
//
// Stand in `docs/ui-audit.md` als offen, woertlich: „das Beispielprojekt
// enthaelt kein Rack […] die 3D-Ansicht ist also nicht ohne vorheriges Bauen
// zu zeigen". Seit dem Beispiel-Rack (`lib/demoRack.ts`) enthaelt es eines,
// und mit WebGL oben rendert es auch.
//
// DER WEG IST DER EINES NUTZERS: Bibliothek -> Reiter „Racks" -> Stift an der
// Karte -> Reiter „3D". Kein Aufruf in den Store hinein — ein Bild, das ueber
// eine Abkuerzung entsteht, belegt nicht, dass die Bedienung dorthin fuehrt.
const rackReiter = win.getByRole('button', { name: /Racks/i })
if (await rackReiter.count()) {
  await rackReiter.first().click()
  await win.waitForTimeout(800)
  const stift = win.locator('button[title="Edit in the 2D rack builder"]')
  if (await stift.count()) {
    await stift.first().click()
    await win.waitForTimeout(2500)
    const dreiD = win.getByRole('button', { name: /^3D$/ })
    if (await dreiD.count()) {
      await dreiD.first().click()
      // Three braucht unter SwiftShader spuerbar laenger als unter einer GPU.
      await win.waitForTimeout(4000)
      await aufnehmen('rack-3d.png', '[role="dialog"]')
      gemacht.push('rack-3d.png')
    } else {
      console.log('  rack-3d.png: kein 3D-Reiter — uebersprungen')
    }
    await zu()
  } else {
    console.log('  rack-3d.png: keine Rack-Vorlage in der Bibliothek — uebersprungen')
  }
} else {
  console.log('  rack-3d.png: kein Racks-Reiter — uebersprungen')
}
await zu()

writeFileSync(
  join(ZIEL, 'aufnahme.json'),
  `${JSON.stringify(
    {
      version,
      dateien: gemacht.sort(),
      hinweis:
        'Automatisch erzeugt von scripts/screenshots.mjs aus dem eingebauten ' +
        'Beispielprojekt — keine Kundendaten, keine Schwaerzung noetig.',
    },
    null,
    2,
  )}\n`,
)
console.log(`\n${gemacht.length} Bild(er) gegen v${version} aufgenommen → docs/screenshots/`)
await app.close()
