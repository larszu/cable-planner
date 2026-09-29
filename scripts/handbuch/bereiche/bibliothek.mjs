#!/usr/bin/env node

/**
 * Handbuch-Aufnahmen für Bereich Bibliothek.
 * Dokumentiert ALLE Funktionen: 4 Reiter, Dialoge, Menüs, Kontextmenüs, Filter, Suche.
 *
 *   node scripts/handbuch/bereiche/bibliothek.mjs de
 *   node scripts/handbuch/bereiche/bibliothek.mjs en
 */

import { starte } from '../app.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const sprache = process.argv[2] ?? 'de'
const fehler = []
const dialoge = {}

async function versuchen(name, fn, retries = 0) {
  try {
    await fn()
    console.log(`✓ ${name}`)
  } catch (e) {
    if (retries < 2) {
      console.warn(`⟲ ${name} (retry ${retries + 1}/2)`)
      await new Promise(r => setTimeout(r, 1000))
      await versuchen(name, fn, retries + 1)
    } else {
      fehler.push(name)
      console.error(`✗ ${name}: ${e.message}`)
    }
  }
}

const a = await starte({ sprache, breite: 1500, hoehe: 950, thema: 'light' })
console.log(`\n📸 Bibliothek (${sprache})…\n`)

// ─────────────────────────────────────────────────────────────────────────────
// HAUPT-REITER ÜBERSICHTEN
// ─────────────────────────────────────────────────────────────────────────────

await versuchen('01 Geräte — Lokal (Übersicht)', async () => {
  await a.zu()
  await a.klick('library.tab.equipment')
  await a.win.waitForTimeout(800)
  await a.bild('bibliothek-01-geraete-lokal')
})

await versuchen('02 Kabel — Übersicht', async () => {
  await a.zu()
  await a.klick('library.tab.cables')
  await a.win.waitForTimeout(800)
  await a.bild('bibliothek-02-kabel')
})

await versuchen('03 Gruppen — Übersicht', async () => {
  await a.zu()
  await a.klick('library.tab.groups')
  await a.win.waitForTimeout(800)
  await a.bild('bibliothek-03-gruppen')
})

await versuchen('04 Racks — Übersicht', async () => {
  await a.zu()
  await a.klick('library.tab.racks')
  await a.win.waitForTimeout(800)
  await a.bild('bibliothek-04-racks')
})

// ─────────────────────────────────────────────────────────────────────────────
// KATEGORIE & SUCHE
// ─────────────────────────────────────────────────────────────────────────────

await versuchen('05 Geräte — Kategorie aufgeklappt', async () => {
  await a.zu()
  await a.klick('library.tab.equipment')
  await a.win.waitForTimeout(500)
  // Chevron für erste Kategorie klicken (expand)
  const chevron = a.win.locator('button').filter({ has: a.win.locator('svg') }).first()
  await chevron.click()
  await a.win.waitForTimeout(400)
  await a.bild('bibliothek-05-kategorie-aufgeklappt')
})

await versuchen('06 Geräte — Suche', async () => {
  await a.zu()
  // Suchfeld anklicken
  const suchfeld = a.win.locator('input[type="text"]').first()
  await suchfeld.click()
  await a.win.keyboard.type('mix', { delay: 50 })
  await a.win.waitForTimeout(600)
  await a.bild('bibliothek-06-geraete-suche')
})

// ─────────────────────────────────────────────────────────────────────────────
// FILTER-MENÜ
// ─────────────────────────────────────────────────────────────────────────────

await versuchen('07 Geräte — Filter-Menü', async () => {
  await a.zu()
  await a.klick('library.tab.equipment')
  await a.win.waitForTimeout(500)
  // Filter-Icon (Trichter) anklicken
  const filterBtn = a.win.locator('button[title*="filter"], button[aria-label*="filter"]').first()
  if (await filterBtn.count() > 0) {
    await filterBtn.click()
  } else {
    // Fallback: irgendein Icon-Button
    const buttons = a.win.locator('button').filter({ has: a.win.locator('svg') })
    await buttons.nth(buttons.count() - 2).click()
  }
  await a.win.waitForTimeout(500)
  await a.bild('bibliothek-07-filter-menu')
})

// ─────────────────────────────────────────────────────────────────────────────
// KONTEXTMENÜS
// ─────────────────────────────────────────────────────────────────────────────

await versuchen('08 Kontextmenü — Vorlageneintrag', async () => {
  await a.zu()
  await a.klick('library.tab.equipment')
  await a.win.waitForTimeout(600)
  // Einen Bibliotheks-Eintrag Rechtsklick
  const eintrag = a.win.locator('[role="option"], .library-item, li').first()
  await eintrag.click({ button: 'right' })
  await a.win.waitForTimeout(500)
  await a.bild('bibliothek-08-kontextmenu-geraet')
  await a.zu()
})

await versuchen('09 Kontextmenü — Kategorie', async () => {
  await a.zu()
  await a.klick('library.tab.equipment')
  await a.win.waitForTimeout(600)
  // Kategorie-Header
  const kategorie = a.win.locator('h3, [role="heading"], .category-header').first()
  await kategorie.click({ button: 'right' })
  await a.win.waitForTimeout(400)
  await a.bild('bibliothek-09-kontextmenu-kategorie')
  await a.zu()
})

await versuchen('10 Kontextmenü — Gruppe', async () => {
  await a.zu()
  await a.klick('library.tab.groups')
  await a.win.waitForTimeout(600)
  // Eine Gruppen-Karte
  const gruppe = a.win.locator('[role="article"], .group-preset, .preset-card').first()
  if (await gruppe.count() > 0) {
    await gruppe.click({ button: 'right' })
    await a.win.waitForTimeout(400)
    await a.bild('bibliothek-10-kontextmenu-gruppe')
  }
  await a.zu()
})

// ─────────────────────────────────────────────────────────────────────────────
// DIALOGE: GERÄT ANLEGEN
// ─────────────────────────────────────────────────────────────────────────────

await versuchen('11 Dialog — Gerät anlegen (Allgemein)', async () => {
  await a.zu()
  await a.klick('library.tab.equipment')
  await a.win.waitForTimeout(500)
  // Plus-Button suchen
  const plusBtn = a.win.locator('button').filter({ has: a.win.locator('svg') }).first()
  await plusBtn.click()
  await a.win.waitForTimeout(800)
  await a.bild('bibliothek-11-dialog-geraet-allgemein')
  dialoge['create_general'] = await a.dialogText()
})

await versuchen('12 Dialog — Gerät anlegen (Anschlüsse)', async () => {
  if ((await a.dialog().count()) > 0) {
    try {
      await a.klick('library.create.tab.ports', { rolle: 'tab' })
      await a.win.waitForTimeout(600)
      await a.bild('bibliothek-12-dialog-geraet-ports')
      dialoge['create_ports'] = await a.dialogText()
    } catch (e) {
      console.log('  (Ports-Tab nicht gefunden)')
    }
  }
})

await versuchen('13 Dialog — Gerät anlegen (Foto)', async () => {
  if ((await a.dialog().count()) > 0) {
    try {
      await a.klick('library.create.tab.foto', { rolle: 'tab' })
      await a.win.waitForTimeout(600)
      await a.bild('bibliothek-13-dialog-geraet-foto')
      dialoge['create_photo'] = await a.dialogText()
    } catch (e) {
      console.log('  (Foto-Tab nicht gefunden)')
    }
  }
})

await versuchen('14 Dialog schließen', async () => {
  await a.zu()
  await a.win.waitForTimeout(300)
})

// ─────────────────────────────────────────────────────────────────────────────
// WEITERE DIALOGE
// ─────────────────────────────────────────────────────────────────────────────

await versuchen('15 Dialog — Vorlagen einreichen', async () => {
  await a.zu()
  await a.klick('library.tab.equipment')
  await a.win.waitForTimeout(500)
  // Plus-Menü öffnen und "Einreichen" / "Submit" anklicken
  const submitBtn = a.win.locator('button, [role="menuitem"]').filter({ has: a.win.locator('text=/[Ee]inreich|[Ss]ubmit/') }).first()
  if (await submitBtn.count() > 0) {
    await submitBtn.click()
    await a.win.waitForTimeout(800)
    await a.bild('bibliothek-15-dialog-vorlagen-einreichen')
    dialoge['submit_templates'] = await a.dialogText()
  }
  await a.zu()
})

await versuchen('16 Dialog — Kabeltypen verwalten', async () => {
  await a.zu()
  await a.klick('library.tab.cables')
  await a.win.waitForTimeout(500)
  // "Manage" / "Verwalten" Button
  const manageBtn = a.win.locator('button').filter({ has: a.win.locator('text=/[Mm]anage|[Vv]erwalt/') }).first()
  if (await manageBtn.count() > 0) {
    await manageBtn.click()
    await a.win.waitForTimeout(800)
    await a.bild('bibliothek-16-dialog-kabeltypen')
    dialoge['cables_manage'] = await a.dialogText()
  }
  await a.zu()
})

await versuchen('17 Dialog — Rack Builder', async () => {
  await a.zu()
  await a.klick('library.tab.racks')
  await a.win.waitForTimeout(500)
  // Plus-Button für neues Rack
  const rackBtn = a.win.locator('button').filter({ has: a.win.locator('svg') }).first()
  await rackBtn.click()
  await a.win.waitForTimeout(800)
  await a.bild('bibliothek-17-dialog-rack-builder')
  dialoge['rack_builder'] = await a.dialogText()
  await a.zu()
})

// ─────────────────────────────────────────────────────────────────────────────
// ZUSATZ-REITER
// ─────────────────────────────────────────────────────────────────────────────

await versuchen('18 Geräte — Gerätebibliothek', async () => {
  await a.zu()
  await a.klick('library.tab.equipment')
  await a.win.waitForTimeout(500)
  // Sub-Tab "Gerätebibliothek" oder "Device Library"
  const dlTab = a.win.locator('button, [role="tab"]').filter({ has: a.win.locator('text=/[Gg]erät|[Ll]ibrary/') }).nth(1)
  if (await dlTab.count() > 0) {
    await dlTab.click()
    await a.win.waitForTimeout(600)
    await a.bild('bibliothek-18-geraete-geraetebibliothek')
  }
})

await versuchen('19 Geräte — Rentman', async () => {
  await a.zu()
  await a.klick('library.tab.equipment')
  await a.win.waitForTimeout(500)
  // Sub-Tab "Rentman"
  const rentTab = a.win.locator('button, [role="tab"]').filter({ has: a.win.locator('text=/Rentman/') }).first()
  if (await rentTab.count() > 0) {
    await rentTab.click()
    await a.win.waitForTimeout(600)
    await a.bild('bibliothek-19-geraete-rentman')
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// BEENDIGUNG
// ─────────────────────────────────────────────────────────────────────────────

await a.ende()

console.log(`\n`)
if (fehler.length > 0) {
  console.error(`⚠ ${fehler.length} Fehler (nicht kritisch):`)
  for (const f of fehler.slice(0, 5)) console.error(`  - ${f}`)
  if (fehler.length > 5) console.error(`  … und ${fehler.length - 5} mehr`)
}

// Dialog-Texte speichern
const scriptDir = dirname(fileURLToPath(import.meta.url))
const jsonPath = join(scriptDir, `bibliothek.${sprache}.json`)
mkdirSync(dirname(jsonPath), { recursive: true })
writeFileSync(jsonPath, JSON.stringify(dialoge, null, 2) + '\n')
console.log(`✓ Fertig (${Object.keys(dialoge).length} Dialog-Texte)`)
console.log(`  Bilder: docs/manual/bilder/${sprache}/bibliothek-*.jpg`)
console.log(`  Texte: ${jsonPath}\n`)
