#!/usr/bin/env node

/**
 * Handbuch-Aufnahmen: Eigenschaften-Inspector (rechte Seitenleiste).
 *
 * Dokumentiert:
 * - Zustand "Nichts ausgewählt"
 * - Geräteeigenschaften (verschiedene Gerätetypen)
 * - Kabeleigenschaften
 * - Rahmen-/Raum-Eigenschaften
 */

import { starte } from '../app.mjs'

const sprache = process.argv[2] ?? 'de'
const fehler = []

async function versuchen(name, aktion) {
  try {
    console.log(`  ${name}…`)
    await aktion()
  } catch (e) {
    const msg = e.message || String(e)
    fehler.push(`${name}: ${msg}`)
    console.error(`    FEHLER: ${msg}`)
  }
}

async function main() {
  const a = await starte({ sprache })
  console.log(`\n📷 Eigenschaften-Inspector (${sprache})`)

  try {
    // ─── NICHTS AUSGEWÄHLT ─────────────────────────────────────────────
    console.log('\n1. Zustand "Nichts ausgewählt"')
    await versuchen('Screenshot: Inspector leer', async () => {
      await a.bild('eigenschaften-nichts-ausgewaehlt')
    })

    // ─── GERÄTEEIGENSCHAFTEN ──────────────────────────────────────────
    console.log('\n2. Geräteeigenschaften — Vision Mixer')

    await versuchen('Vision Mixer auswählen', async () => {
      await a.win.locator('.react-flow__node').filter({ hasText: 'Vision mixer' }).first().click()
      await a.win.waitForTimeout(500)
    })

    await versuchen('Screenshot: Mixer - Überblick', async () => {
      await a.bild('eigenschaften-geraet-mixer-uebersicht')
    })

    await versuchen('Alle Sections aufklappen', async () => {
      const allDetails = await a.win.locator('details').all()
      for (const details of allDetails) {
        const isOpen = await details.evaluate(el => el.open)
        if (!isOpen) {
          await details.locator('summary').first().click()
          await a.win.waitForTimeout(80)
        }
      }
    })

    await versuchen('Screenshot: Mixer - Vollständig', async () => {
      await a.bild('eigenschaften-geraet-mixer-vollstaendig')
    })

    // Camera auswählen
    console.log('\n3. Geräteeigenschaften — Camera')

    await versuchen('Camera 1 auswählen', async () => {
      await a.win.locator('.react-flow__node').filter({ hasText: 'Camera 1' }).first().click()
      await a.win.waitForTimeout(500)
    })

    await versuchen('Screenshot: Camera - Überblick', async () => {
      await a.bild('eigenschaften-geraet-camera-uebersicht')
    })

    // Monitor
    console.log('\n4. Geräteeigenschaften — Monitor')

    await versuchen('Monitor auswählen', async () => {
      await a.win.locator('.react-flow__node').filter({ hasText: 'Control room monitor' }).first().click()
      await a.win.waitForTimeout(500)
    })

    await versuchen('Screenshot: Monitor', async () => {
      await a.bild('eigenschaften-geraet-monitor-uebersicht')
    })

    // ─── KABELEIGENSCHAFTEN ───────────────────────────────────────────
    console.log('\n5. Kabeleigenschaften')

    await versuchen('Kabel auswählen', async () => {
      // Wähle einen Edge (Kabel)
      await a.win.locator('.react-flow__edge').first().click()
      await a.win.waitForTimeout(500)
    })

    await versuchen('Screenshot: Kabel', async () => {
      await a.bild('eigenschaften-kabel-uebersicht')
    })

    // ─── ABSCHLUSS ────────────────────────────────────────────────────
    console.log('\n✓ Aufnahme abgeschlossen')

  } finally {
    await a.ende()
  }

  // Fehler ausgeben
  if (fehler.length > 0) {
    console.error('\n⚠️  Fehler:')
    for (const f of fehler) console.error(`  - ${f}`)
    process.exitCode = 1
  } else {
    console.log('\n✓ Alle Screenshots erfolgreich')
  }
}

main()
