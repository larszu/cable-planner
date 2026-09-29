// Handbuch-Aufnahmen für den Export-Bereich
// Minimale Variante: über Befehlspalette (Ctrl+K) statt Menu-Navigation

import { starte } from '../app.mjs'

const sprache = process.argv[2] ?? 'de'

async function aufnahme() {
  const a = await starte({ sprache })

  console.log('Starte Aufnahmen...')

  try {
    // Befehlspalette für Patchliste
    console.log('Aufnahme 1/5: Patchliste')
    await a.palette('app.menu.tools.patchList')
    await a.bild('export-patchliste-dialog', a.dialog())
    await a.zu()
    await a.win.waitForTimeout(800)

    // Befehlspalette für Export Dialog
    console.log('Aufnahme 2/5: Export Dialog - Plan')
    await a.palette('app.menu.file.export')
    await a.bild('export-dialog-plan', a.dialog())

    // Tabs im Export Dialog
    const tabs = await a.win.getByRole('tab').all()
    console.log(`Gefunden: ${tabs.length} Tabs`)

    if (tabs.length > 1) {
      console.log('Aufnahme 3/5: Export Dialog - Patch-Sheets')
      await tabs[1].click()
      await a.win.waitForTimeout(600)
      await a.bild('export-dialog-patch', a.dialog())
    }

    if (tabs.length > 2) {
      console.log('Aufnahme 4/5: Export Dialog - BOM')
      await tabs[2].click()
      await a.win.waitForTimeout(600)
      await a.bild('export-dialog-bom', a.dialog())
    }

    await a.zu()
    await a.win.waitForTimeout(800)

    // Cloud Dialog über Befehlspalette
    console.log('Aufnahme 5/5: Cloud Dialog')
    await a.palette('app.menu.file.cloud')
    await a.bild('export-cloud-dialog', a.dialog())
    await a.zu()

    console.log('✓ Alle Aufnahmen ('+sprache.toUpperCase()+') erfolgreich')
  } catch (e) {
    console.error('✗ Fehler:', e.message)
    process.exit(1)
  } finally {
    await a.ende()
  }
}

await aufnahme()
