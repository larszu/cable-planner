import { renderToStaticMarkup } from 'react-dom/server'
import { ConnectorSymbol } from '../components/shared/ConnectorSymbol'
import { findConnectorEntry, connectorGender } from './connectorCatalog'

/** Nur die Felder, die das Symbol-Bild braucht — funktioniert für volle
 *  Ports (Port) UND die schlanke Rack3D-Port-Form. */
export interface PanelSymbolPort {
  id: string
  connectorType: string
  panelPosX?: number
  panelPosY?: number
}

/**
 * #472 — Rendert die Steckverbinder-Symbole einer Panel-Seite als SVG-Bild
 * (Data-URI). Im 3D-Rack wird dieses Bild genau wie ein Panel-Foto als
 * Front-/Rear-Textur auf die Geräte-Face geklebt (Frontblende mit
 * Stecker-Symbolen). Positionen aus panelPosX/Y — dieselben Werte wie die
 * 2D- und 3D-Port-Dots, sodass Symbole und Dots deckungsgleich sitzen.
 *
 * Gibt undefined zurück, wenn keine Ports oder kein Connector im Katalog
 * bekannt ist (dann greift im 3D weiter das Panel-Foto bzw. das Basis-
 * Material).
 */
const computeDefault = (idx: number, total: number): { x: number; y: number } => {
  if (total <= 1) return { x: 0.5, y: 0.5 }
  const cols = Math.ceil(Math.sqrt(total * 2.5))
  const rows = Math.ceil(total / cols)
  return { x: ((idx % cols) + 0.5) / cols, y: (Math.floor(idx / cols) + 0.5) / rows }
}

export const buildPanelSymbolDataUri = (
  ports: ReadonlyArray<PanelSymbolPort>,
  aspect: number,
): string | undefined => {
  if (!ports || ports.length === 0) return undefined
  const W = 600
  const H = Math.max(120, Math.round(W / Math.max(0.25, aspect || 1)))
  const symPx = Math.min(80, Math.max(32, H * 0.5))
  const parts: string[] = []
  ports.forEach((port, idx) => {
    const entry = findConnectorEntry(port.connectorType)
    if (!entry) return
    const cx = (port.panelPosX ?? computeDefault(idx, ports.length).x) * W
    const cy = (port.panelPosY ?? computeDefault(idx, ports.length).y) * H
    const markup = renderToStaticMarkup(
      <ConnectorSymbol
        symbol={entry.symbol}
        gender={connectorGender(port.connectorType)}
        size={symPx}
      />,
    )
    parts.push(
      `<g transform="translate(${(cx - symPx / 2).toFixed(1)} ${(cy - symPx / 2).toFixed(1)})">${markup}</g>`,
    )
  })
  if (parts.length === 0) return undefined
  const doc =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#0b1220"/>${parts.join('')}</svg>`
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(doc)))}`
}

/** Stabiler Memo-Key: nur Position/Typ der Ports — verhindert teures
 *  Neu-Rastern bei sonst identischen Panels. */
export const panelSymbolKey = (ports: ReadonlyArray<PanelSymbolPort>): string =>
  ports.map((p) => `${p.id}:${p.connectorType}:${p.panelPosX ?? ''}:${p.panelPosY ?? ''}`).join('|')
