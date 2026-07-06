// ───────────────────────────────────────────────────────────────────────────
// 1D-Barcode-Rendering (Code128) als data-URI — Pendant zu `qrcode` für QR.
//
// Code128 kann beliebige ASCII-Codes tragen und ist der De-facto-Standard für
// Lager-/Asset-Etiketten. Render läuft über ein Offscreen-Canvas (nur im
// Renderer/Browser verfügbar) → PNG-data-URI, damit es wie ein QR in die
// Etiketten-HTML eingebettet werden kann.
// ───────────────────────────────────────────────────────────────────────────
import JsBarcode from 'jsbarcode'

/**
 * Rendert `value` als Code128-Barcode und liefert eine PNG-data-URI. Leerer
 * String bei fehlendem DOM (Tests) oder Render-Fehler (nichts erfinden).
 */
export const renderBarcodeDataUrl = (value: string): string => {
  if (typeof document === 'undefined') return ''
  try {
    const canvas = document.createElement('canvas')
    JsBarcode(canvas, value, {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
      width: 2,
      height: 60,
      background: '#ffffff',
      lineColor: '#000000',
    })
    return canvas.toDataURL('image/png')
  } catch {
    return ''
  }
}
