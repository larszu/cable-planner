// Die gebaute App für die Handbuch-Aufnahmen starten und fernsteuern.
//
//   const a = await starte({ sprache: 'de' })
//   await a.menue('app.menu.tools', 'app.menu.tools.patchList')
//   await a.bild('patchliste')              // ganzes Fenster
//   await a.bild('patchliste-dialog', a.dialog())
//   console.log(await a.dialogText())
//   await a.ende()
//
// WARUM ÜBER I18N-SCHLÜSSEL: dieselbe Aufnahme läuft für die deutsche und die
// englische Fassung. Wer auf sichtbaren Text klickt, müsste jede Stelle
// zweimal schreiben; `a.text('app.menu.tools')` liefert „Werkzeuge" oder
// „Tools", je nach Lauf. Die Tabelle entsteht aus dem Code (englischer
// Fallback im `t()`-Aufruf) und `lib/i18n/de.ts` — dieselbe Quelle wie die App.
//
// WARUM DIESE VORKEHRUNGEN:
// - Eigenes Profil in einem Wegwerfordner (`--user-data-dir`): der Lauf darf
//   weder die Bibliothek noch die letzten Projekte des Rechners anfassen.
// - Native Datei-, Druck- und Browser-Aufrufe werden im Hauptprozess
//   abgefangen: ein Öffnen-Dialog des Betriebssystems hält Playwright an, ein
//   `openExternal` öffnet sonst den Browser des Nutzers.
// - Das Fenster ist durchsichtig und lässt Klicks durch: die Aufnahmen laufen
//   auf einem Rechner, an dem gleichzeitig gearbeitet wird. Playwright steuert
//   über CDP, nicht über den Fokus des Betriebssystems.

import { _electron as electron } from 'playwright-core'
import { erststartOverlayWeg } from '../lib/erststartOverlay.mjs'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const BILDER = join(WURZEL, 'docs', 'manual', 'bilder')

let tabelle = null
/** i18n-Schlüssel → { en, de }, aus dem Code gelesen. */
export function woerterbuch() {
  if (tabelle) return tabelle
  const dateien = []
  const lauf = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) lauf(p)
      else if (/\.tsx?$/.test(e)) dateien.push(p)
    }
  }
  lauf(join(WURZEL, 'src', 'renderer'))
  tabelle = new Map()
  const aufruf = /\bt(?:ranslate)?\(\s*(?:[a-zA-Z_.]+\s*,\s*)?['"]([\w.-]+)['"]\s*,\s*(['"`])((?:\\.|(?!\2).)*)\2/g
  for (const f of dateien) {
    for (const m of readFileSync(f, 'utf8').matchAll(aufruf)) {
      if (!tabelle.has(m[1])) tabelle.set(m[1], { en: m[3].replace(/\\(.)/g, '$1') })
    }
  }
  const de = readFileSync(join(WURZEL, 'src', 'renderer', 'lib', 'i18n', 'de.ts'), 'utf8')
  for (const m of de.matchAll(/^\s*['"]?([\w.-]+)['"]?\s*:\s*(['"`])((?:\\.|(?!\2).)*)\2/gm)) {
    const e = tabelle.get(m[1]) ?? {}
    e.de = m[3].replace(/\\(.)/g, '$1')
    tabelle.set(m[1], e)
  }
  return tabelle
}

/** Modul-IDs aus `lib/modules.ts` (DEFAULT_ENABLED). */
const MODULE = [...readFileSync(join(WURZEL, 'src', 'renderer', 'lib', 'modules.ts'), 'utf8')
  .match(/DEFAULT_ENABLED[^{]*\{([^}]*)\}/)[1]
  .replace(/\/\/.*$/gm, '')
  .matchAll(/(\w+)\s*:/g)].map((m) => m[1])

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export async function starte({ sprache = 'de', breite = 1500, hoehe = 950, thema = 'light', sichtbar = false } = {}) {
  const profil = mkdtempSync(join(tmpdir(), 'cp-handbuch-'))
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${profil}`, '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    cwd: WURZEL,
  })
  await app.evaluate(({ dialog, shell, BrowserWindow }) => {
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] })
    dialog.showSaveDialog = async () => ({ canceled: true, filePath: undefined })
    dialog.showOpenDialogSync = () => undefined
    dialog.showSaveDialogSync = () => undefined
    dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false })
    shell.openExternal = async () => {}
    shell.openPath = async () => ''
    shell.showItemInFolder = () => {}
    for (const w of BrowserWindow.getAllWindows()) w.webContents.print = () => {}
  })
  const win = await app.firstWindow({ timeout: 60_000 })
  if (!sichtbar) {
    await app.evaluate(({ BrowserWindow }) => {
      for (const w of BrowserWindow.getAllWindows()) {
        w.setOpacity(0)
        w.setIgnoreMouseEvents(true)
      }
    })
  }
  await win.setViewportSize({ width: breite, height: hoehe })
  await win.waitForLoadState('domcontentloaded')
  await win.waitForTimeout(3000)
  await win.evaluate(() => {
    window.print = () => {}
    window.alert = () => {}
    window.confirm = () => true
    window.prompt = () => null
  })
  await erststartOverlayWeg(win, { lautScheitern: false })

  const wb = woerterbuch()
  /** Anzeigetext eines Schlüssels in der Sprache des Laufs; kein Schlüssel → der Text selbst. */
  const text = (schluessel) => {
    const e = wb.get(schluessel)
    if (!e) return schluessel
    return (sprache === 'de' ? e.de : e.en) ?? e.en ?? schluessel
  }
  /** Platzhalter wie {n} zu „beliebig", Ellipsen tolerant. */
  const muster = (schluessel, genau = false) => {
    const s = escRe(text(schluessel).replace(/[…]$|\.\.\.$/, '').trim()).replace(/\\\{\w+\\\}/g, '.*?')
    return new RegExp(genau ? `^\\s*${s}\\s*[…]?\\s*$` : s, 'i')
  }

  // Schließen in drei Stufen: Escape, dann der Schließen-Knopf im obersten
  // Dialog, dann ein Klick in die Ecke des Hintergrunds. Manche Dialoge
  // schließen bewusst nicht auf Escape (ungesicherte Eingaben) — ein
  // stehengebliebener Hintergrund fängt sonst jeden folgenden Klick ab.
  const offen = () => win.locator('[role="dialog"], [role="menu"], .cp-modal-backdrop').count()
  const zu = async () => {
    for (let i = 0; i < 8; i += 1) {
      const vorher = await offen()
      if (vorher === 0) return
      await win.keyboard.press('Escape').catch(() => {})
      await win.waitForTimeout(250)
      if ((await offen()) < vorher) continue
      const schliessen = win
        .locator('[role="dialog"]')
        .last()
        .getByRole('button', { name: new RegExp(`^(${escRe(text('common.close'))}|Close|Schließen)$`, 'i') })
      if (await schliessen.count().catch(() => 0)) {
        await schliessen.first().click({ timeout: 2000, force: true }).catch(() => {})
        await win.waitForTimeout(250)
        if ((await offen()) < vorher) continue
      }
      await win.mouse.click(3, 3).catch(() => {})
      await win.waitForTimeout(250)
    }
  }

  /** Auf das erste sichtbare Element mit diesem Text klicken — Menüeintrag, Knopf, Reiter, sonst beliebig. */
  const klick = async (schluessel, { genau = false, rolle } = {}) => {
    const m = muster(schluessel, genau)
    const kandidaten = rolle
      ? [win.getByRole(rolle, { name: m })]
      : [
          win.getByRole('menuitem', { name: m }),
          win.getByRole('button', { name: m }),
          win.getByRole('tab', { name: m }),
          win.getByRole('menuitemcheckbox', { name: m }),
          win.getByRole('option', { name: m }),
          win.getByText(m),
        ]
    for (const k of kandidaten) {
      const n = await k.count()
      for (let i = 0; i < n; i += 1) {
        const el = k.nth(i)
        if (await el.isVisible().catch(() => false)) {
          await el.click({ timeout: 5000 }).catch(() => el.click({ timeout: 5000, force: true }))
          await win.waitForTimeout(600)
          return true
        }
      }
    }
    throw new Error(`nicht gefunden: ${schluessel} → ${m}`)
  }

  /** Menüpfad öffnen: menue('app.menu.tools', 'app.menu.tools.patchList'). Untermenüs per Hover. */
  const menue = async (...pfad) => {
    await zu()
    await klick(pfad[0], { genau: true })
    for (const [i, s] of pfad.slice(1).entries()) {
      const letzter = i === pfad.length - 2
      if (letzter) await klick(s)
      else {
        await win.getByRole('menuitem', { name: muster(s) }).first().hover()
        await win.waitForTimeout(500)
      }
    }
    await win.waitForTimeout(900)
  }

  /** Befehlspalette (Strg+K) — Text in der Sprache des Laufs. */
  const palette = async (schluessel) => {
    await zu()
    await win.keyboard.press('Control+k')
    await win.waitForTimeout(400)
    await win.keyboard.type(text(schluessel).replace(/\s*(…|\.\.\.)$/, ''))
    await win.waitForTimeout(400)
    await win.keyboard.press('Enter')
    await win.waitForTimeout(1200)
  }

  const dialog = () => win.locator('[role="dialog"]').last()
  /** Das oberste Kontext- oder Aufklappmenü. */
  const menueFeld = () => win.locator('[role="menu"]').last()
  const dialogText = async () =>
    (await dialog().count()) ? (await dialog().innerText()).replace(/\n{3,}/g, '\n\n') : ''

  /** Bild speichern: docs/manual/bilder/<sprache>/<name>.jpg — ganzes Fenster oder ein Locator. */
  const bild = async (name, ziel) => {
    const ordner = join(BILDER, sprache)
    mkdirSync(ordner, { recursive: true })
    const pfad = join(ordner, `${name}.jpg`)
    const opt = { path: pfad, type: 'jpeg', quality: 78, animations: 'disabled' }
    if (ziel && (await ziel.count().catch(() => 0))) await ziel.first().screenshot(opt)
    else await win.screenshot(opt)
    return pfad
  }

  // Sprache und Thema direkt im gespeicherten UI-Zustand setzen und neu laden —
  // über die Einstellungen zu klicken hängt an Beschriftungen, die sich ändern.
  await win.evaluate(({ sprache, thema, module }) => {
    const key = 'cable-planner:ui'
    const alt = JSON.parse(localStorage.getItem(key) || '{}')
    localStorage.setItem(key, JSON.stringify({ ...alt, language: sprache, canvasTheme: thema }))
    // Alle Module an: das Handbuch beschreibt jede Funktion, auch die abschaltbaren.
    const skey = 'cable-planner:settings'
    const st = JSON.parse(localStorage.getItem(skey) || '{}')
    const alle = Object.fromEntries(module.map((m) => [m, true]))
    localStorage.setItem(skey, JSON.stringify({ ...st, enabledModules: { ...(st.enabledModules || {}), ...alle } }))
  }, { sprache, thema, module: MODULE })
  await win.reload()
  await win.waitForLoadState('domcontentloaded')
  await win.waitForTimeout(2500)
  await win.evaluate(() => {
    window.print = () => {}
    window.alert = () => {}
    window.confirm = () => true
    window.prompt = () => null
  })
  await erststartOverlayWeg(win, { lautScheitern: false })
  const demo = win.getByRole('button', { name: /Load example project|Beispielprojekt laden/i })
  if (await demo.count()) {
    await demo.first().click().catch(() => {})
    await win.waitForTimeout(2000)
  }
  await zu()

  const ende = async () => {
    await app.close().catch(() => {})
    rmSync(profil, { recursive: true, force: true })
  }

  return { app, win, sprache, text, muster, klick, menue, palette, zu, dialog, menueFeld, dialogText, bild, ende }
}
