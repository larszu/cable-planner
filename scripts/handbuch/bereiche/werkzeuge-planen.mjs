#!/usr/bin/env node

/**
 * Handbuch-Aufnahmen für den Bereich "Werkzeuge: Planen" (Tools menu, Planen section).
 * Startet die App, navigiert durch jede Werkzeug-Dialog, und nimmt Screenshots auf.
 *
 * Lauf:
 *   node scripts/handbuch/bereiche/werkzeuge-planen.mjs de
 *   node scripts/handbuch/bereiche/werkzeuge-planen.mjs en
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
        await a.bild(`werkzeuge-planen-${name}`, sel)
        console.log(`✓ ${name}`)
      }
    } catch (e) {
      fehler.push(`${name}: ${e.message}`)
      console.error(`✗ ${name}: ${e.message}`)
    }
  }

  // Helfer: Reiterwechsel und Foto
  const fotoTab = async (baseName, tabKey) => {
    try {
      await a.klick(tabKey)
      await a.win.waitForTimeout(400)
      await a.bild(`werkzeuge-planen-${baseName}`, a.dialog())
      dialogTexte[baseName] = await a.dialogText()
      console.log(`✓ ${baseName}`)
    } catch (e) {
      fehler.push(`${baseName}: ${e.message}`)
      console.error(`✗ ${baseName}: ${e.message}`)
    }
  }

  try {
    // Gesamtes Fenster
    await a.bild('werkzeuge-planen-overview')
    console.log(`✓ overview`)

    // ─────────────────────────────────────────────────────────
    // BERECHNEN
    // ─────────────────────────────────────────────────────────

    // Recording Storage Calculator
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.recStorage')
      await fotoDialog('recording-storage-calc')
      await a.zu()
    } catch (e) {
      fehler.push(`recording-storage: ${e.message}`)
    }

    // Projection & Display Calculator
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.projection')
      await fotoDialog('projection-calc')
      await a.zu()
    } catch (e) {
      fehler.push(`projection: ${e.message}`)
    }

    // ─────────────────────────────────────────────────────────
    // PRÜFEN
    // ─────────────────────────────────────────────────────────

    // Analyses - alle 14 Reiter
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.analysis')

      // Reiter 1: Weight tab
      await fotoTab('analysis-weight', 'Gewicht & Wärme')

      // Reiter 2: Network tab
      await fotoTab('analysis-network', 'Netzwerk')

      // Reiter 3: Redundancy tab
      await fotoTab('analysis-redundancy', 'analysis.tab.redundancy')

      // Reiter 4: RF / Funk tab
      await fotoTab('analysis-rf', 'analysis.tab.rf')

      // Reiter 5: Cable Runs tab
      await fotoTab('analysis-runs', 'analysis.tab.runs')

      // Reiter 6: Signal Chain tab
      await fotoTab('analysis-chain', 'analysis.tab.chain')

      // Reiter 7: Patch List tab
      await fotoTab('analysis-patch', 'analysis.tab.patch')

      // Reiter 8: Check Sheet tab
      await fotoTab('analysis-sheet', 'analysis.tab.sheet')

      // Reiter 9: Client Summary tab
      await fotoTab('analysis-client', 'analysis.tab.client')

      // Reiter 10: Todos/Actionsn tab
      await fotoTab('analysis-todo', 'analysis.tab.todo')

      // Reiter 11: Costs tab
      await fotoTab('analysis-cost', 'analysis.tab.cost')

      // Reiter 12: Crew tab
      await fotoTab('analysis-crew', 'analysis.tab.crew')

      // Reiter 13: Naming tab
      await fotoTab('analysis-naming', 'analysis.tab.naming')

      // Reiter 14: Dante Patch tab
      await fotoTab('analysis-dante', 'analysis.tab.dante')

      await a.zu()
    } catch (e) {
      fehler.push(`analysis: ${e.message}`)
    }

    // Plan Check
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.planCheck')
      await fotoDialog('plan-check')
      await a.zu()
    } catch (e) {
      fehler.push(`plan-check: ${e.message}`)
    }

    // Plan vs. Found (Reconcile)
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.reconcile')
      await fotoDialog('reconcile')
      await a.zu()
    } catch (e) {
      fehler.push(`reconcile: ${e.message}`)
    }

    // ─────────────────────────────────────────────────────────
    // PLANEN
    // ─────────────────────────────────────────────────────────

    // Survey (Capture Existing)
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.survey')
      await fotoDialog('survey')
      await a.zu()
    } catch (e) {
      fehler.push(`survey: ${e.message}`)
    }

    // Drum Micing
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.drumMicing')
      await fotoDialog('drum-micing')
      await a.zu()
    } catch (e) {
      fehler.push(`drum-micing: ${e.message}`)
    }

    // Wireless / Vocals
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.wirelessRig')
      await fotoDialog('wireless')
      await a.zu()
    } catch (e) {
      fehler.push(`wireless: ${e.message}`)
    }

    // Rundown and Camera Assignments
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.rundown')
      await fotoDialog('rundown')
      await a.zu()
    } catch (e) {
      fehler.push(`rundown: ${e.message}`)
    }

    // Delivery (Streaming Destinations)
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.delivery')
      await fotoDialog('delivery')
      await a.zu()
    } catch (e) {
      fehler.push(`delivery: ${e.message}`)
    }

    // LED Wall
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.ledWall')
      await fotoDialog('led-wall')
      await a.zu()
    } catch (e) {
      fehler.push(`led-wall: ${e.message}`)
    }

    // Faceplate Editor
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.faceplate')
      await fotoDialog('faceplate')
      await a.zu()
    } catch (e) {
      fehler.push(`faceplate: ${e.message}`)
    }

    // Report Editor
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.bericht')
      await fotoDialog('report-editor')
      await a.zu()
    } catch (e) {
      fehler.push(`report-editor: ${e.message}`)
    }

    // Conductors and Colour Standards
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.adern')
      await fotoDialog('conductors')
      await a.zu()
    } catch (e) {
      fehler.push(`conductors: ${e.message}`)
    }

    // Received Show-Control Messages
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.osc')
      await fotoDialog('show-control')
      await a.zu()
    } catch (e) {
      fehler.push(`show-control: ${e.message}`)
    }

    // ─────────────────────────────────────────────────────────
    // ERSTELLEN & VERWALTEN
    // ─────────────────────────────────────────────────────────

    // Connect Multiple Cables
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.bulkConnect')
      await fotoDialog('bulk-connect')
      await a.zu()
    } catch (e) {
      fehler.push(`bulk-connect: ${e.message}`)
    }

    // Create New Rack
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.newRack')
      await fotoDialog('new-rack')
      await a.zu()
    } catch (e) {
      fehler.push(`new-rack: ${e.message}`)
    }

    // Rack Builder
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.rackBuilder')
      await fotoDialog('rack-builder')
      await a.zu()
    } catch (e) {
      fehler.push(`rack-builder: ${e.message}`)
    }

    // Generate AI Plan
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.aiPlanGen')
      await fotoDialog('ai-plan')
      await a.zu()
    } catch (e) {
      fehler.push(`ai-plan: ${e.message}`)
    }

    // Revisions & Snapshots
    try {
      await a.zu()
      await a.menue('app.menu.tools', 'app.menu.tools.revisions')
      await fotoDialog('revisions')
      await a.zu()
    } catch (e) {
      fehler.push(`revisions: ${e.message}`)
    }

    // ─────────────────────────────────────────────────────────
    // DEVICE CONFIGURATION (conditional)
    // ─────────────────────────────────────────────────────────

    // ATEM Multiviewer Layout
    try {
      await a.zu()
      await a.menue('app.menu.tools')
      try {
        await a.klick('app.menu.tools.atemMv')
        await a.win.waitForTimeout(600)
        await fotoDialog('atem-mv')
        await a.zu()
      } catch {
        console.log(`⊘ atem-mv (nicht im Projekt)`)
      }
    } catch (e) {
      console.log(`⊘ atem-mv: ${e.message}`)
    }

    // ATEM Audio Routing
    try {
      await a.zu()
      await a.menue('app.menu.tools')
      try {
        await a.klick('app.menu.tools.atemAudio')
        await a.win.waitForTimeout(600)
        await fotoDialog('atem-audio')
        await a.zu()
      } catch {
        console.log(`⊘ atem-audio (nicht im Projekt)`)
      }
    } catch (e) {
      console.log(`⊘ atem-audio: ${e.message}`)
    }

    // ATEM Input Labels
    try {
      await a.zu()
      await a.menue('app.menu.tools')
      try {
        await a.klick('app.menu.tools.atemLabels')
        await a.win.waitForTimeout(600)
        await fotoDialog('atem-labels')
        await a.zu()
      } catch {
        console.log(`⊘ atem-labels (nicht im Projekt)`)
      }
    } catch (e) {
      console.log(`⊘ atem-labels: ${e.message}`)
    }

    // Dialog-Texte speichern
    const textDatei = join(WURZEL, 'scripts', 'handbuch', 'bereiche', `werkzeuge-planen.${sprache}.json`)
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
