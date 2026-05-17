// v7.9.27 — Hybrid print: native Electron print path im Desktop, iframe-
// Fallback im Browser. Hintergrund: iframe.contentWindow.print() bricht
// bei manchen jsPDF-Outputs (z.B. wenn der Microsoft-Print-to-PDF
// Drucker ausgewählt wird), weil Chromium's PDFium-Viewer im iframe
// das PDF nicht zuverlässig an die Print-Pipeline weiterreicht und
// eine leere/kaputte Datei rauskommt ("Die Datei kann nicht geöffnet
// werden. Etwas hat nicht funktioniert.").
// Lösung: In Electron schicken wir die PDF-Bytes per IPC ans Main-
// Process, das lädt sie in eine Hidden-BrowserWindow und ruft
// webContents.print() direkt — Chromium's Print-Backend bekommt das
// PDF dann sauber gerendert.

import { cablePlannerApi, hasDesktopBridge } from './bridge'

const printViaIframe = (pdfBlob: Blob): void => {
  const url = URL.createObjectURL(pdfBlob)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.src = url
  document.body.appendChild(iframe)
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch {
      /* fall back silently */
    }
    window.setTimeout(() => {
      document.body.removeChild(iframe)
      URL.revokeObjectURL(url)
    }, 60_000)
  }
}

export const printPdfBlob = async (pdfBlob: Blob): Promise<void> => {
  if (hasDesktopBridge) {
    try {
      const buffer = await pdfBlob.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      await cablePlannerApi.print.pdfBytes(bytes)
      return
    } catch {
      // Native path fehlgeschlagen — fallback auf iframe damit der User
      // wenigstens irgendwie drucken kann.
      printViaIframe(pdfBlob)
      return
    }
  }
  printViaIframe(pdfBlob)
}
