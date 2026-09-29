#!/usr/bin/env node
// Oberflaeche (UI Frame) — Screenshots des Rahmens der App.
// Menus: Edit, View, Help
// Komponenten: Command Palette, Status Bar, Mobile Share, Collaboration Panel, About, Onboarding, Panel Menus

import { starte } from '../app.mjs'

const sprache = process.argv[2] ?? 'de'
const fehler = []
const a = await starte({ sprache })

const sammle = async (fehlertext, fn) => {
  try {
    await fn()
  } catch (e) {
    fehler.push(`${fehlertext}: ${e.message}`)
    console.error(`✗ ${fehlertext}:`, e.message)
  }
}

console.log(`\n📸 Oberflaeche (${sprache})…\n`)

// 1. Full window overview (starting state)
await sammle('Übersicht', async () => {
  await a.bild('oberflaeche-start')
  console.log('✓ Übersicht')
})

// 2. Edit Menu — alle Einträge
await sammle('Menü Bearbeiten', async () => {
  await a.menue('app.menu.edit')
  await a.bild('oberflaeche-menu-edit')
  await a.zu()
  console.log('✓ Menü Bearbeiten')
})

// 3. View Menu — alle Einträge
await sammle('Menü Ansicht', async () => {
  await a.menue('app.menu.view')
  await a.bild('oberflaeche-menu-view')
  await a.zu()
  console.log('✓ Menü Ansicht')
})

// 4. Help Menu — alle Einträge
await sammle('Menü Hilfe', async () => {
  await a.menue('app.menu.help')
  await a.bild('oberflaeche-menu-help')
  await a.zu()
  console.log('✓ Menü Hilfe')
})

// 5. Command Palette (Ctrl+K)
await sammle('Befehlspalette', async () => {
  await a.zu()
  await a.palette('app.menu.tools.patchList')
  await a.bild('oberflaeche-command-palette')
  await a.zu()
  console.log('✓ Befehlspalette')
})

// 6. Mobile Share Dialog (if available — click Phone Access button)
await sammle('Handy-Zugriff Dialog', async () => {
  await a.zu()
  // Try to find and click the mobile share button (should be in top-right area)
  // Look for "app.menu.phone" or text containing "Handy" or "Phone"
  try {
    await a.klick('app.menu.phone', { rolle: 'button' })
    await a.bild('oberflaeche-mobile-share')
    await a.zu()
    console.log('✓ Handy-Zugriff Dialog')
  } catch {
    console.log('⚠ Handy-Zugriff Button nicht gefunden (optional)')
  }
})

// 7. Collaboration/Sync Panel — accessible through Settings
await sammle('Zusammenarbeit Panel', async () => {
  await a.zu()
  // Open Settings -> Sync tab
  try {
    await a.menue('app.menu.file', 'settings.action.open')
    // Wait for settings dialog
    await a.win.waitForTimeout(800)
    // Look for Sync tab
    await a.klick('settings.tab.sync')
    await a.bild('oberflaeche-sync-panel')
    await a.zu()
    console.log('✓ Zusammenarbeit Panel')
  } catch (e) {
    console.log('⚠ Sync Panel nicht erreichbar:', e.message)
  }
})

// 8. About Dialog
await sammle('Über Dialog', async () => {
  await a.zu()
  try {
    await a.menue('app.menu.help', 'app.menu.help.about')
    await a.bild('oberflaeche-about')
    await a.zu()
    console.log('✓ Über Dialog')
  } catch {
    console.log('⚠ Über Dialog nicht erreichbar (optional)')
  }
})

// 9. Keyboard Shortcuts Dialog
await sammle('Tastaturkürzel Dialog', async () => {
  await a.zu()
  try {
    await a.menue('app.menu.help', 'app.menu.help.shortcuts')
    await a.bild('oberflaeche-shortcuts')
    await a.zu()
    console.log('✓ Tastaturkürzel Dialog')
  } catch {
    console.log('⚠ Tastaturkürzel Dialog nicht erreichbar (optional)')
  }
})

// 10. Status Bar details (take close-up of status bar at bottom)
await sammle('Statusleiste', async () => {
  await a.zu()
  // Get the status bar locator (should be at the bottom)
  const statusbar = a.win.locator('[class*="status"], footer, [role="status"]').last()
  if (await statusbar.count()) {
    await a.bild('oberflaeche-statusbar', statusbar)
    console.log('✓ Statusleiste')
  } else {
    console.log('⚠ Statusleiste Locator nicht gefunden')
  }
})

// 11. View Menu items with toggles — Light Theme
await sammle('Ansicht Light Theme', async () => {
  await a.zu()
  try {
    await a.menue('app.menu.view', 'app.menu.view.light')
    await a.bild('oberflaeche-theme-light')
    // Switch back to light theme to continue
    await a.zu()
    console.log('✓ Light Theme Toggle')
  } catch {
    console.log('⚠ Light Theme nicht erreichbar')
  }
})

// 12. Snap to Grid toggle
await sammle('Ansicht Einrasten', async () => {
  await a.zu()
  try {
    await a.menue('app.menu.view', 'app.menu.view.snap')
    await a.bild('oberflaeche-snap-to-grid')
    await a.zu()
    console.log('✓ Snap to Grid')
  } catch {
    console.log('⚠ Snap to Grid nicht erreichbar')
  }
})

// 13. Hide Cable Labels toggle
await sammle('Ansicht Kabel-Labels ausblenden', async () => {
  await a.zu()
  try {
    await a.menue('app.menu.view', 'app.menu.view.hideLabels')
    await a.bild('oberflaeche-hide-labels')
    await a.zu()
    console.log('✓ Hide Cable Labels')
  } catch {
    console.log('⚠ Hide Cable Labels nicht erreichbar')
  }
})

// 14. Color cables by length
await sammle('Ansicht Kabelfarbe nach Länge', async () => {
  await a.zu()
  try {
    await a.menue('app.menu.view', 'app.menu.view.colorByLength')
    await a.bild('oberflaeche-color-by-length')
    await a.zu()
    console.log('✓ Color by Length')
  } catch {
    console.log('⚠ Color by Length nicht erreichbar')
  }
})

// 15. Color cables by layer/discipline
await sammle('Ansicht Kabelfarbe nach Gewerk', async () => {
  await a.zu()
  try {
    await a.menue('app.menu.view', 'app.menu.view.colorByLayer')
    await a.bild('oberflaeche-color-by-layer')
    await a.zu()
    console.log('✓ Color by Layer')
  } catch {
    console.log('⚠ Color by Layer nicht erreichbar')
  }
})

// End
await a.ende()

// Summary
console.log(`\n✓ ${sprache} abgeschlossen`)
if (fehler.length > 0) {
  console.log(`\n⚠ ${fehler.length} Fehler:`)
  fehler.forEach(e => console.log(`  - ${e}`))
}

process.exit(fehler.length > 0 ? 1 : 0)
