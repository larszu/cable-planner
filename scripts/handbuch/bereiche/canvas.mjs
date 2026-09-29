#!/usr/bin/env node
/**
 * Aufnahme-Skript für den Canvas-Bereich.
 * Dokumentiert: Toolbar mit allen Buttons, Dialoge, Kontextmenüs, Layer-Sichtbarkeit, Symbole, Grundrisse.
 *
 * Aufruf: node scripts/handbuch/bereiche/canvas.mjs de
 *         node scripts/handbuch/bereiche/canvas.mjs en
 */

import { starte } from '../app.mjs'

const sprache = process.argv[2] ?? 'de'
const fehler = []
const dialogTexte = {}

const a = await starte({ sprache })

const t = (schluessel, fallback) => {
  try {
    return a.text(schluessel)
  } catch (e) {
    return fallback
  }
}

console.log(`\n📸 Canvas-Bereich dokumentieren (${sprache})…\n`)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. STARTSEITE — Toolbar und Hauptansicht
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('1. Hauptansicht: Canvas mit Toolbar')
  await a.bild('canvas-01-toolbar-main')
} catch (e) {
  fehler.push(`Toolbar-Screenshot: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. DEFAULTS-MENÜ (Routing, Pfeile, Brücken, Farben)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('2. Defaults-Menü öffnen')
  await a.klick('toolbar.defaults.title')
  await new Promise(r => setTimeout(r, 300))
  await a.bild('canvas-02-defaults-menu')
  dialogTexte['canvas-02-defaults-menu'] = await a.dialogText()
  await a.zu()
} catch (e) {
  fehler.push(`Defaults-Menü: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. RAHMEN (Frame) hinzufügen — leer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('3. Rahmen hinzufügen')
  const btnText = sprache === 'de' ? 'Frame' : 'Frame'
  // Klick auf Frame-Button (nach Icon)
  await a.win.locator('[title*="location"]').first().click()
  await new Promise(r => setTimeout(r, 500))
  await a.bild('canvas-03-frame-added')
} catch (e) {
  fehler.push(`Rahmen hinzufügen: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. GERÄTE AUSWÄHLEN — für Ausrichtungs-Demo
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('4. Gerät auswählen')
  // Klick auf einen Knoten auf dem Canvas
  await a.win.locator('.react-flow__node').first().click()
  await new Promise(r => setTimeout(r, 300))
  await a.bild('canvas-04-equipment-selected')
} catch (e) {
  fehler.push(`Gerät auswählen: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. AUSRICHTUNGS-BUTTONS (Align: Links, Mitte, Rechts, etc.)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('5. Ausrichtungs-Buttons sichtbar')
  await a.bild('canvas-05-align-buttons')
} catch (e) {
  fehler.push(`Ausrichtungs-Buttons: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. ZWEI GERÄTE AUSWÄHLEN — für Mehrfach-Verkabelung
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('6. Zwei Geräte auswählen (Mehrfach-Verkabelung)')
  // Erste Auswahl bleibt, Zweite mit Ctrl+Click
  await a.win.locator('.react-flow__node').nth(1).click({ modifiers: ['Control'] })
  await new Promise(r => setTimeout(r, 300))
  await a.bild('canvas-06-two-equipment-selected')
} catch (e) {
  fehler.push(`Zwei Geräte auswählen: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. BULK CONNECT DIALOG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('7. Bulk Connect Dialog')
  // Connect cables Button (nur sichtbar bei 2 Geräten)
  await a.win.locator('[title*="cables"]').first().click()
  await new Promise(r => setTimeout(r, 500))
  await a.bild('canvas-07-bulk-connect-dialog')
  dialogTexte['canvas-07-bulk-connect-dialog'] = await a.dialogText()
  await a.zu()
} catch (e) {
  fehler.push(`Bulk Connect Dialog: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. GRUPPE SPEICHERN DIALOG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('8. Gruppe speichern')
  // Gruppe speichern Button (Auswahl muss noch aktiv sein)
  await a.win.locator('[title*="selected devices as a group"]').first().click()
  await new Promise(r => setTimeout(r, 300))
  await a.bild('canvas-08-group-save-form')
} catch (e) {
  fehler.push(`Gruppe speichern: ${e.message}`)
}

// Formular abbrechen
try {
  await a.zu()
} catch (e) {}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 9. GERÄTE-KONTEXTMENÜ (Rechtsklick)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('9. Geräte-Kontextmenü')
  // Alles deselektieren
  await a.win.locator('.react-flow').click()
  await new Promise(r => setTimeout(r, 200))

  // Rechtsklick auf Gerät
  await a.win.locator('.react-flow__node').first().click({ button: 'right' })
  await new Promise(r => setTimeout(r, 300))
  await a.bild('canvas-09-equipment-context-menu')
  dialogTexte['canvas-09-equipment-context-menu'] = await a.dialogText()
  await a.zu()
} catch (e) {
  fehler.push(`Geräte-Kontextmenü: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 10. KABEL-KONTEXTMENÜ (Rechtsklick auf Kabel)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('10. Kabel-Kontextmenü')
  // Rechtsklick auf eine Kabel-Linie
  await a.win.locator('[class*="react-flow__edge"]').first().click({ button: 'right' })
  await new Promise(r => setTimeout(r, 300))
  await a.bild('canvas-10-cable-context-menu')
  dialogTexte['canvas-10-cable-context-menu'] = await a.dialogText()
  await a.zu()
} catch (e) {
  fehler.push(`Kabel-Kontextmenü: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 11. LEEREFLÄCHEN-KONTEXTMENÜ (Rechtsklick auf Canvas)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('11. Canvas-Kontextmenü (neue Geräte)')
  // Rechtsklick auf leere Fläche
  await a.win.locator('.react-flow').click({ button: 'right', position: { x: 400, y: 400 } })
  await new Promise(r => setTimeout(r, 300))
  await a.bild('canvas-11-canvas-context-menu')
  dialogTexte['canvas-11-canvas-context-menu'] = await a.dialogText()
  await a.zu()
} catch (e) {
  fehler.push(`Canvas-Kontextmenü: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 12. LAYER-SICHTBARKEIT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('12. Layer-Sichtbarkeit (Video/Audio/Control/etc.)')
  await a.bild('canvas-12-layer-visibility')
} catch (e) {
  fehler.push(`Layer-Sichtbarkeit: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 13. FLOW MODE CHIP (Signalfluss-Darstellung)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('13. Flow Mode Chip')
  const flowBtn = await a.win.locator('[title*="flow"]').first()
  if (flowBtn) {
    await flowBtn.click()
    await new Promise(r => setTimeout(r, 300))
    await a.bild('canvas-13-flow-mode-menu')
    dialogTexte['canvas-13-flow-mode-menu'] = await a.dialogText()
    await a.zu()
  }
} catch (e) {
  fehler.push(`Flow Mode: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 14. GRUNDRISS-PANEL (Floor plan)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('14. Grundriss-Panel öffnen')
  await a.klick('toolbar.floorplan.label')
  await new Promise(r => setTimeout(r, 500))
  await a.bild('canvas-14-floorplan-panel')
} catch (e) {
  fehler.push(`Grundriss-Panel: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 15. SYMBOLE-PANEL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('15. Symbole-Panel öffnen')
  await a.klick('toolbar.symbols.label')
  await new Promise(r => setTimeout(r, 500))
  await a.bild('canvas-15-symbols-panel')
} catch (e) {
  fehler.push(`Symbole-Panel: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 16. SPERREN-MENÜ (Lock: Rahmen, Geräte, Kabel)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('16. Sperren-Menü')
  // Suche nach Lock-Button (mit "Sperren" oder Lock-Icon)
  const lockBtn = await a.win.locator('[title*="Sperren"], [title*="Lock"]').first()
  if (lockBtn) {
    await lockBtn.click()
    await new Promise(r => setTimeout(r, 300))
    await a.bild('canvas-16-lock-menu')
    dialogTexte['canvas-16-lock-menu'] = await a.dialogText()
    await a.zu()
  }
} catch (e) {
  fehler.push(`Sperren-Menü: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 17. FINALIZE-BUTTON (Plan-Lock)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('17. Finalize Button')
  await a.bild('canvas-17-finalize-button')
} catch (e) {
  fehler.push(`Finalize Button: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 18. ANMERKUNGEN (Annotations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('18. Anmerkungen-Buttons')
  await a.bild('canvas-18-annotations-buttons')
} catch (e) {
  fehler.push(`Anmerkungen: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 19. MINIMAP / ZOOM (unten links)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('19. Zoom-Buttons und Minimap')
  await a.bild('canvas-19-zoom-minimap')
} catch (e) {
  fehler.push(`Zoom-Buttons: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 20. 3D-GEBÄUDEANSICHT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('20. 3D-Gebäudeansicht-Button')
  // 3D-Button existiert normalerweise neben Rooms
  const btn3d = await a.win.locator('[title*="3D"], [aria-label*="3D"]').first()
  if (btn3d) {
    await btn3d.click()
    await new Promise(r => setTimeout(r, 800))
    await a.bild('canvas-20-3d-building-view')
    // Zurück zur 2D
    await a.zu()
  }
} catch (e) {
  fehler.push(`3D-Ansicht: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 21. SIGNALWEG ANZEIGEN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('21. Signalweg anzeigen')
  // Geräte auswählen und schauen ob Signalweg sichtbar ist
  await a.win.locator('.react-flow__node').first().click()
  await new Promise(r => setTimeout(r, 300))
  await a.bild('canvas-21-signal-path-shown')
} catch (e) {
  fehler.push(`Signalweg: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 22. GERÄTE-SUCHE (Strg+F)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('22. Geräte-Suche')
  await a.win.keyboard.press('Control+F')
  await new Promise(r => setTimeout(r, 300))
  await a.bild('canvas-22-equipment-search')
  await a.zu()
} catch (e) {
  fehler.push(`Geräte-Suche: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 23. INLINE SELECTION TOOLBAR (bei Auswahl mehrerer Geräte)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try {
  console.log('23. Inline-Auswahl-Toolbar')
  // Mehrere Geräte auswählen
  await a.win.locator('.react-flow').click()
  await new Promise(r => setTimeout(r, 200))
  await a.win.locator('.react-flow__node').first().click()
  await a.win.locator('.react-flow__node').nth(1).click({ modifiers: ['Control'] })
  await a.win.locator('.react-flow__node').nth(2).click({ modifiers: ['Control'] })
  await new Promise(r => setTimeout(r, 300))
  await a.bild('canvas-23-inline-selection-toolbar')
} catch (e) {
  fehler.push(`Inline-Toolbar: ${e.message}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ABSCHLUSS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

await a.ende()

// Dialog-Texte speichern
import fs from 'fs'
fs.writeFileSync(
  `scripts/handbuch/bereiche/canvas.${sprache}.json`,
  JSON.stringify(dialogTexte, null, 2),
)

console.log(`\n✅ Canvas-Screenshots fertig (${sprache})`)
if (fehler.length > 0) {
  console.log(`\n⚠️  Fehler bei:`)
  fehler.forEach(f => console.log(`  • ${f}`))
} else {
  console.log(`\nKeine Fehler!`)
}
