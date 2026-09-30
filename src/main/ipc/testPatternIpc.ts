import { BrowserWindow, ipcMain, screen } from 'electron'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/**
 * IPC-Domaene `testPattern:*` — larszu/lz-scopes#15: ein Testbild randlos und
 * im Vollbild auf einem Bildschirm DIESES Rechners, gewaehlt am Display im
 * Plan („Testbild zeigen").
 *
 * DAS BILD MALT DER RENDERER (`renderPattern` aus lz-scopes, pixelgenau ohne
 * Dithering) und schickt es als PNG. Das Ausgabefenster fuehrt deshalb kein
 * Skript aus (`javascript: false`) und hat keinen Preload: es zeigt eine
 * Datei aus dem Temp-Ordner und sonst nichts.
 *
 * DATEI STATT `data:`-URL: Chromium begrenzt Adressen beim Navigieren auf
 * 2 MB, und ein 4K-Verlauf als PNG ist groesser.
 *
 * Esc schliesst das Fenster — ohne Skript, ueber `before-input-event`.
 */

export interface ScreenInfo {
  id: number
  label: string
  /** Pixel des Panels (Bounds × Skalierung) — die Groesse, die das Testbild haben muss. */
  width: number
  height: number
  primary: boolean
}

const MAX_PNG_BYTES = 64 * 1024 * 1024
const fenster = new Map<number, { win: BrowserWindow; dir: string }>()

const bildschirme = (): ScreenInfo[] => {
  const primary = screen.getPrimaryDisplay().id
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: d.label || `Display ${i + 1}`,
    width: Math.round(d.bounds.width * d.scaleFactor),
    height: Math.round(d.bounds.height * d.scaleFactor),
    primary: d.id === primary,
  }))
}

async function schliessen(displayId: number) {
  const f = fenster.get(displayId)
  if (!f) return
  fenster.delete(displayId)
  if (!f.win.isDestroyed()) f.win.destroy()
  await rm(f.dir, { recursive: true, force: true }).catch(() => undefined)
}

async function zeigen(displayId: unknown, png: unknown): Promise<{ ok: boolean }> {
  if (typeof displayId !== 'number' || !(png instanceof Uint8Array) || png.byteLength > MAX_PNG_BYTES) return { ok: false }
  // PNG-Signatur: der Renderer schickt ein Bild und nichts, was sich als Seite lesen liesse.
  if (png.byteLength < 8 || png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) return { ok: false }
  const display = screen.getAllDisplays().find((d) => d.id === displayId)
  if (!display) return { ok: false }
  await schliessen(displayId)

  const dir = await mkdtemp(path.join(os.tmpdir(), 'cable-planner-testbild-'))
  await writeFile(path.join(dir, 'bild.png'), png)
  await writeFile(
    path.join(dir, 'index.html'),
    '<!doctype html><meta charset="utf-8"><title>Test pattern</title>' +
      '<style>html,body{margin:0;height:100%;background:#000;overflow:hidden;cursor:none}' +
      'img{display:block;width:100vw;height:100vh;object-fit:contain;image-rendering:pixelated}</style>' +
      '<img src="bild.png" alt="">',
  )
  const b = display.bounds
  const win = new BrowserWindow({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    frame: false,
    fullscreen: true,
    backgroundColor: '#000000',
    show: false,
    webPreferences: { javascript: false, sandbox: true, contextIsolation: true, nodeIntegration: false },
  })
  fenster.set(displayId, { win, dir })
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      e.preventDefault()
      void schliessen(displayId)
    }
  })
  win.on('closed', () => {
    if (fenster.get(displayId)?.win === win) void schliessen(displayId)
  })
  win.once('ready-to-show', () => win.show())
  await win.loadFile(path.join(dir, 'index.html'))
  return { ok: true }
}

export const closeAllTestPatterns = async () => {
  for (const id of [...fenster.keys()]) await schliessen(id)
}

export const registerTestPatternIpc = () => {
  ipcMain.handle('testPattern:screens', () => bildschirme())
  ipcMain.handle('testPattern:show', (_e, displayId: unknown, png: unknown) => zeigen(displayId, png))
  ipcMain.handle('testPattern:close', (_e, displayId: unknown) =>
    typeof displayId === 'number' ? schliessen(displayId) : closeAllTestPatterns(),
  )
}
