// v7.9.27 — Native Print-IPC.
//
// Hintergrund: printPdfBlob() im Renderer lud das PDF in ein verstecktes
// iframe und rief iframe.contentWindow.print(). Chromium's PDFium-
// Viewer rendert manche PDFs im iframe nicht zuverlässig — Folge: der
// Microsoft-Print-to-PDF Drucker bekommt einen leeren/kaputten Page-
// Stream und schreibt eine nicht öffenbare Datei.
//
// Lösung: PDF-Bytes via IPC ins Main-Process schicken, dort in eine
// neue Hidden-BrowserWindow laden und webContents.print() aufrufen.
// Electrons print() steht im Hauptprozess und nutzt Chromium's
// PrintBackend direkt — robuster als die iframe-Variante.

import { BrowserWindow, app, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

export const registerPrintIpc = (): void => {
  ipcMain.handle('print:pdf-bytes', async (_event, bytes: Uint8Array): Promise<boolean> => {
    if (!bytes || bytes.byteLength === 0) return false
    // PDF in tempfile schreiben — file:-URL ist verlaesslicher als data: in Electron
    const tmpFile = path.join(tmpdir(), `cable-planner-print-${Date.now()}.pdf`)
    await writeFile(tmpFile, Buffer.from(bytes))
    return await new Promise<boolean>((resolve) => {
      const win = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          // Plugins on damit das PDF im BrowserWindow durch PDFium gerendert wird
          plugins: true,
        },
      })
      let resolved = false
      const settle = (ok: boolean) => {
        if (resolved) return
        resolved = true
        try { win.destroy() } catch { /* ignore */ }
        resolve(ok)
      }
      // Sicherheitsnetz: wenn die print-Pipeline hängt, nach 60 s aufgeben
      const fallbackTimer = setTimeout(() => settle(false), 60_000)
      win.webContents.on('did-finish-load', () => {
        // Kurze Pause damit PDFium tatsächlich gerendert hat
        setTimeout(() => {
          win.webContents.print({ silent: false }, (success) => {
            clearTimeout(fallbackTimer)
            settle(success)
          })
        }, 250)
      })
      win.webContents.on('did-fail-load', () => {
        clearTimeout(fallbackTimer)
        settle(false)
      })
      win.loadURL(`file://${tmpFile.replace(/\\/g, '/')}`).catch(() => {
        clearTimeout(fallbackTimer)
        settle(false)
      })
    })
  })
  void app // keep app import — used by other handlers wenn der Pfad geändert wird
}
