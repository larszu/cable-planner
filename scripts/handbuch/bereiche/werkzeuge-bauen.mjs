#!/usr/bin/env node

/**
 * Handbuch-Aufnahmen für den Bereich "Werkzeuge" (Tools menu).
 * Startet die App, navigiert durch jedes Werkzeug-Menü, und nimmt Screenshots auf.
 *
 * Lauf:
 *   node scripts/handbuch/bereiche/werkzeuge-bauen.mjs de
 *   node scripts/handbuch/bereiche/werkzeuge-bauen.mjs en
 */

import { starte } from '../app.mjs'
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const sprache = process.argv[2] ?? 'de'
const fehler = []
const dialogTexte = {}

async function aufnahme() {
  const a = await starte({ sprache })

  // Helfer: Dialog fotografieren und Text sammeln
  const fotoDialog = async (name, dialogSelector = null) => {
    try {
      const sel = dialogSelector || a.dialog()
      if (await sel.count().catch(() => 0)) {
        dialogTexte[name] = await a.dialogText()
        await a.bild(`werkzeuge-bauen-${name}`, sel)
        console.log(`✓ ${name}`)
      }
    } catch (e) {
      fehler.push(`${name}: ${e.message}`)
      console.error(`✗ ${name}: ${e.message}`)
    }
  }

  try {
    // Gesamtes Fenster ohne Dialog
    await a.bild('werkzeuge-bauen-overview')
    console.log(`✓ overview`)

    // Patch list - via Befehlspalette
    try {
      await a.zu()
      await a.palette('app.menu.tools.patchList')
      await fotoDialog('patchlist')
      await a.zu()
    } catch (e) {
      fehler.push(`patchlist: ${e.message}`)
    }

    // LED-Wand
    try {
      await a.zu()
      await a.palette('app.menu.tools.ledWall')
      await fotoDialog('ledwand')
      await a.zu()
    } catch (e) {
      fehler.push(`ledwand: ${e.message}`)
    }

    // Frontplatten-Editor
    try {
      await a.zu()
      await a.palette('app.menu.tools.faceplate')
      await fotoDialog('frontplatten')
      await a.zu()
    } catch (e) {
      fehler.push(`frontplatten: ${e.message}`)
    }

    // Berichts-Editor
    try {
      await a.zu()
      await a.palette('app.menu.tools.bericht')
      await fotoDialog('bericht')
      await a.zu()
    } catch (e) {
      fehler.push(`bericht: ${e.message}`)
    }

    // Adern und Farbnormen
    try {
      await a.zu()
      await a.palette('app.menu.tools.adern')
      await fotoDialog('adern')
      await a.zu()
    } catch (e) {
      fehler.push(`adern: ${e.message}`)
    }

    // Empfangene Show-Control-Nachrichten
    try {
      await a.zu()
      await a.palette('app.menu.tools.osc')
      await fotoDialog('showccontrol')
      await a.zu()
    } catch (e) {
      fehler.push(`showcontrol: ${e.message}`)
    }

    // Mehrere Kabel verbinden
    try {
      await a.zu()
      await a.palette('app.menu.tools.bulkConnect')
      await fotoDialog('mehrere-kabel')
      await a.zu()
    } catch (e) {
      fehler.push(`mehrere-kabel: ${e.message}`)
    }

    // Neues Rack erstellen
    try {
      await a.zu()
      await a.palette('app.menu.tools.newRack')
      await fotoDialog('neues-rack')
      await a.zu()
    } catch (e) {
      fehler.push(`neues-rack: ${e.message}`)
    }

    // Rack-Builder
    try {
      await a.zu()
      await a.palette('app.menu.tools.rackBuilder')
      await fotoDialog('rack-builder')

      // Reiter pruefen und fotografieren
      const reiter = await a.win.locator('[role="tab"]').count()
      if (reiter > 1) {
        for (let i = 1; i < reiter && i <= 3; i++) {
          try {
            await a.win.locator('[role="tab"]').nth(i).click()
            await a.win.waitForTimeout(600)
            await fotoDialog(`rack-builder-reiter-${i}`)
          } catch (e) {
            // Reiter koennte nicht sichtbar sein
          }
        }
      }
      await a.zu()
    } catch (e) {
      fehler.push(`rack-builder: ${e.message}`)
    }

    // KI-Plan generieren
    try {
      await a.zu()
      await a.palette('app.menu.tools.aiPlanGen')
      await fotoDialog('ki-plan')
      await a.zu()
    } catch (e) {
      fehler.push(`ki-plan: ${e.message}`)
    }

    // Revisionen & Snapshots
    try {
      await a.zu()
      await a.palette('app.menu.tools.revisions')
      await fotoDialog('revisionen')

      // Reiter fotografieren
      try {
        const revReiter = await a.win.locator('[role="tab"]').count()
        for (let i = 0; i < revReiter && i <= 2; i++) {
          try {
            const tab = a.win.locator('[role="tab"]').nth(i)
            if (await tab.isVisible().catch(() => false)) {
              await tab.click()
              await a.win.waitForTimeout(400)
            }
          } catch { /* ignore */ }
        }
        await fotoDialog('revisionen-tabs')
      } catch { /* ignore */ }

      await a.zu()
    } catch (e) {
      fehler.push(`revisionen: ${e.message}`)
    }

    // Lager / Bestand - nur wenn Rental-Modul aktiv
    try {
      await a.zu()
      await a.palette('app.menu.tools.inventory')
      await fotoDialog('lager')

      // Reiter fotografieren
      try {
        const lagerReiter = await a.win.locator('[role="tab"]').count()
        for (let i = 0; i < lagerReiter && i <= 3; i++) {
          try {
            const tab = a.win.locator('[role="tab"]').nth(i)
            if (await tab.isVisible().catch(() => false)) {
              await tab.click()
              await a.win.waitForTimeout(400)
            }
          } catch { /* ignore */ }
        }
        await fotoDialog('lager-tabs')
      } catch { /* ignore */ }

      await a.zu()
    } catch (e) {
      // Inventory ist optional (Rental-Modul)
      console.log(`ⓘ lager: Nicht vorhanden (Rental-Modul erforderlich)`)
    }

    // ATEM Multiviewer-Layout - nur wenn ATEM im Plan
    try {
      await a.zu()
      await a.palette('app.menu.tools.atemMv')
      await fotoDialog('atem-multiviewer')
      await a.zu()
    } catch (e) {
      // ATEM ist optional
      console.log(`ⓘ atem-multiviewer: Nicht vorhanden (kein ATEM-Gerät im Projekt)`)
    }

    // ATEM Audio-Routing - nur wenn ATEM im Plan
    try {
      await a.zu()
      await a.palette('app.menu.tools.atemAudio')
      await fotoDialog('atem-audio')
      await a.zu()
    } catch (e) {
      console.log(`ⓘ atem-audio: Nicht vorhanden`)
    }

    // ATEM Input-Labels - nur wenn ATEM im Plan
    try {
      await a.zu()
      await a.palette('app.menu.tools.atemLabels')
      await fotoDialog('atem-labels')
      await a.zu()
    } catch (e) {
      console.log(`ⓘ atem-labels: Nicht vorhanden`)
    }

    // Videohub-Routing/Labels - nur wenn Videohub im Plan
    try {
      await a.zu()
      await a.palette('app.menu.tools.videohub')
      await fotoDialog('videohub')

      // Reiter fotografieren
      try {
        const vhReiter = await a.win.locator('[role="tab"]').count()
        for (let i = 0; i < vhReiter && i <= 2; i++) {
          try {
            const tab = a.win.locator('[role="tab"]').nth(i)
            if (await tab.isVisible().catch(() => false)) {
              await tab.click()
              await a.win.waitForTimeout(400)
            }
          } catch { /* ignore */ }
        }
        await fotoDialog('videohub-tabs')
      } catch { /* ignore */ }

      await a.zu()
    } catch (e) {
      console.log(`ⓘ videohub: Nicht vorhanden (kein Videohub im Projekt)`)
    }

    // GreenGo-Intercom - nur wenn GreenGo im Plan
    try {
      await a.zu()
      await a.palette('app.menu.tools.greengo')
      await fotoDialog('greengo')
      await a.zu()
    } catch (e) {
      console.log(`ⓘ greengo: Nicht vorhanden (kein GreenGo im Projekt)`)
    }

    // Abschliessend: Dialog-Texte speichern
    const textDatei = join(WURZEL, 'scripts', 'handbuch', 'bereiche', `werkzeuge-bauen.${sprache}.json`)
    writeFileSync(textDatei, JSON.stringify(dialogTexte, null, 2))
    console.log(`\n✓ Dialog-Texte → ${textDatei}`)

    if (fehler.length > 0) {
      console.error(`\n⚠ ${fehler.length} Fehler:`)
      for (const e of fehler) console.error(`  - ${e}`)
    } else {
      console.log(`\n✓ Alle Aufnahmen erfolgreich.`)
    }
  } finally {
    await a.ende()
  }
}

aufnahme().catch((e) => {
  console.error('Fehler:', e)
  process.exit(1)
})
