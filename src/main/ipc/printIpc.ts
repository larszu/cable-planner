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
import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

export const registerPrintIpc = (): void => {
  // v7.9.97 — Vektor-PDF-Export via Chromium printToPDF.
  //
  // Renderer schickt ein selbst-enthaltenes HTML-Dokument (mit dem
  // Canvas als foreignObject-SVG) zusammen mit der gewünschten Page-
  // Size in Mikrometern. Wir laden das HTML in eine Hidden-BrowserWindow
  // und rufen webContents.printToPDF — Chromium emittiert das PDF mit
  // echtem Text + Vektor-Pfaden statt JPEG-Embedding.
  //
  // 'preferCSSPageSize: true' damit @page in den Print-Styles die
  // Papier-Größe bestimmt. 'printBackground: true' damit Hintergrund-
  // Farben mitkommen (Chromium-Default fuer Print ist sonst aus).
  ipcMain.handle(
    'canvas:export-pdf-vector',
    async (
      _event,
      params: {
        html: string
        widthMicrons: number
        heightMicrons: number
        /** v7.9.104 hatte hier scale 0..1 mit printToPDF.scale gehandhabt
         *  → 'Printing failed' bei grossen Canvases (body natural → OOM
         *  bevor scale greift). v7.9.109 macht das Scaling jetzt via
         *  CSS `zoom` im HTML, body bleibt klein, scale-Parameter wird
         *  nicht mehr genutzt. Field bleibt aus Kompatibilitaet im
         *  Type — wir ignorieren ihn. */
        scale?: number
      },
    ): Promise<Uint8Array> => {
      const { html, widthMicrons, heightMicrons } = params
      if (!html) throw new Error('printToPDF: leeres HTML')
      const tmpFile = path.join(tmpdir(), `cable-planner-pdf-vec-${Date.now()}.html`)
      await writeFile(tmpFile, html, 'utf-8')
      const win = new BrowserWindow({
        show: false,
        // 1 px = 264.583 microns @ 96 DPI. Cap auf 2000 damit das
        // Hidden-Window nicht riesig wird — printToPDF nimmt eh die
        // @page-Size aus dem HTML, das Viewport-Format ist nur fuer
        // Layout-Pass relevant.
        width: Math.min(2000, Math.ceil(widthMicrons / 264.583)),
        height: Math.min(2000, Math.ceil(heightMicrons / 264.583)),
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          offscreen: false,
        },
      })
      // v7.9.99 — Debug-Pfad merken damit wir bei Fehlern das HTML
      // inspizieren können. Bei Erfolg loeschen wir das Tempfile.
      const debugPath = path.join(tmpdir(), 'cable-planner-last-vector-print.html')
      try {
        await writeFile(debugPath, html, 'utf-8')
      } catch {
        // best-effort, nicht blockierend
      }
      try {
        await win.loadFile(tmpFile)
        // Auf Font-Loading warten — sonst werden Glyphs fallback-gerendert.
        await win.webContents
          .executeJavaScript(
            'document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true',
          )
          .catch(() => null)
        // v7.9.99 — Layout-Stabilisierung 600ms statt 250ms. Bei sehr
        // grossen Canvases braucht der erste Paint mehr Zeit, sonst
        // produziert printToPDF eine leere Seite.
        await new Promise<void>((r) => setTimeout(r, 600))
        // v7.9.110 — Setup matched v7.9.103 (das nachweislich funktioniert
        // hat) — preferCSSPageSize: true, landscape-Flag basierend auf
        // pageSize-Dimensionen. Kein scale-Param (Vektoriz. via CSS zoom
        // im HTML). Diese Konfig hatte v7.9.109 falsch geaendert.
        const isLandscape = widthMicrons > heightMicrons
        const printOptions = {
          pageSize: { width: widthMicrons, height: heightMicrons },
          printBackground: true,
          preferCSSPageSize: true,
          margins: { marginType: 'none' as const },
          displayHeaderFooter: false,
          landscape: isLandscape,
        }
        let buffer: Buffer
        try {
          buffer = await win.webContents.printToPDF(printOptions)
        } catch (printErr) {
          const printMsg = printErr instanceof Error ? printErr.message : String(printErr)
          throw new Error(
            `Chromium printToPDF failed: ${printMsg}.\n\n` +
              `Page: ${widthMicrons}×${heightMicrons} microns (` +
              `${(widthMicrons / 1000).toFixed(0)}×${(heightMicrons / 1000).toFixed(0)} mm, ` +
              `${isLandscape ? 'landscape' : 'portrait'}).\n` +
              `Debug-HTML: ${debugPath}\n` +
              `Tipp: HTML im Browser oeffnen — wenn sauber aussieht, ist der Bug in printToPDF; wenn leer, im HTML-Build.`,
            { cause: printErr },
          )
        }
        if (!buffer || buffer.byteLength < 1000) {
          throw new Error(
            `printToPDF gab nur ${buffer?.byteLength ?? 0} Bytes zurueck — Render fehlgeschlagen. Debug-HTML liegt unter ${debugPath}.`,
          )
        }
        return new Uint8Array(buffer)
      } finally {
        try {
          win.destroy()
        } catch {
          // ignore
        }
        try {
          await unlink(tmpFile)
        } catch {
          // ignore
        }
      }
    },
  )

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
