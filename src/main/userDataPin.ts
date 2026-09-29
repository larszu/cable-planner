import { app } from 'electron'
import path from 'node:path'

// Electron leitet userData aus dem productName ab. Seit der Umbenennung in
// "LZ Cable Planner" läge er in einem leeren Ordner — Bibliothek, zuletzt
// geöffnete Projekte und Einstellungen blieben im alten zurück. Muss vor
// jedem Modul laufen, das getPath('userData') beim Import auswertet
// (projectIpc.ts), deshalb erster Import in index.ts. Im Dev-Lauf gilt der
// npm-Name, dort war nie etwas verschoben.
export const LEGACY_USER_DATA_DIR = 'Cable Planner'

if (app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), LEGACY_USER_DATA_DIR))
}

// Ein frisches, eigenes Profil fuer automatische Laeufe (`scripts/screenshots.mjs`):
// sie sollen weder das Autosave eines frueheren Laufs sehen noch einen
// Ordner loeschen muessen, in dem jemand arbeitet. Nur ausserhalb des Pakets.
if (!app.isPackaged && process.env.CP_USER_DATA_DIR) {
  app.setPath('userData', process.env.CP_USER_DATA_DIR)
}
