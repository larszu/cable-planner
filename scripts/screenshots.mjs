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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const WURZEL = process.cwd()
const ZIEL = join(WURZEL, 'docs', 'screenshots')
const version = JSON.parse(readFileSync(join(WURZEL, 'package.json'), 'utf8')).version

/** Fenstergroesse aus dem Guide: die Galerie zeigt die Bilder auf 420px. */
const BREITE = 1500
const HOEHE = 950

mkdirSync(ZIEL, { recursive: true })

const app = await electron.launch({
  args: ['.', '--no-sandbox', '--disable-gpu'],
  executablePath: join(WURZEL, 'node_modules', 'electron', 'dist', 'electron'),
  cwd: WURZEL,
})
const win = await app.firstWindow({ timeout: 30_000 })
await win.setViewportSize({ width: BREITE, height: HOEHE })
await win.waitForLoadState('domcontentloaded')
await win.waitForTimeout(3500)

/** Onboarding und Tour wegklicken — sie liegen sonst ueber jedem Bild. */
const freiraeumen = async () => {
  for (let r = 0; r < 6; r += 1) {
    if ((await win.locator('.cp-modal-backdrop').count()) === 0) break
    const b = win.getByRole('button', { name: /End tour|Skip|Close|Später|Decide later/i })
    if (await b.count()) await b.first().click({ timeout: 1500 }).catch(() => {})
    await win.keyboard.press('Escape').catch(() => {})
    await win.waitForTimeout(400)
  }
}
await freiraeumen()

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
