// ───────────────────────────────────────────────────────────────────────────
// Ein HTML-Blatt als PDF-Datei — über den Hauptprozess (Chromium printToPDF).
//
// Derselbe Kanal wie der Vektor-Export des Canvas (`canvas:export-pdf-vector`):
// das Blatt trägt seine `@page`-Grösse selbst, der Hauptprozess liefert die
// Bytes zurück. `null` in der Browser-Ausgabe, wo es keinen Hauptprozess gibt —
// dort bleibt der Druckdialog mit „Als PDF speichern".
// ───────────────────────────────────────────────────────────────────────────

interface VektorDruck {
  canvasPdfVector?: (params: { html: string; widthMicrons: number; heightMicrons: number }) => Promise<Uint8Array>
}

const A4_MICRONS = { widthMicrons: 210_000, heightMicrons: 297_000 }

export const datenblattPdf = async (html: string): Promise<Uint8Array | null> => {
  const druck = (window as unknown as { cablePlanner?: { print?: VektorDruck } }).cablePlanner?.print
  if (!druck?.canvasPdfVector) return null
  return druck.canvasPdfVector({ html, ...A4_MICRONS })
}
