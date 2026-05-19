/**
 * v7.9.85 / #123 — Cable-Layer-System.
 *
 * Top-Level-Layer aus dem AV/Broadcast-Industrie-Standard (recherchiert
 * über D-Tools SI, Stardraw Design, Visio AV-ECAV, AVNetwork-Best-Practices):
 *
 *   video    — SDI, HDMI, optical Fiber-Video, NDI/2110-Signal-Pfade
 *   audio    — XLR, TRS, AES/EBU, Dante/MADI
 *   control  — RS-422, GPI, LAN-Control (Tally, Routing-Steuerung)
 *   network  — IT/Office-LAN, WiFi, Management-VLAN, DHCP/DNS
 *   power    — IEC, PowerCON, Schuko, USV-Strecken
 *
 * Sub-Layer-Patterns (User kann frei erweitern):
 *   - Primary vs Backup (z.B. video.primary, video.backup)
 *   - FOH vs Monitor (audio.foh, audio.monitor)
 *   - Front-of-House vs Stage
 *
 * Auto-Detect:
 *   - Cable connectorType → wahrscheinlichster Layer
 *   - Wird beim Cable-Anlegen als Vorschlag genutzt, User kann überschreiben
 */
import type { Cable, CableType } from '../types/cable'
import type { ConnectorType } from '../types/equipment'

export const STANDARD_LAYERS = ['video', 'audio', 'control', 'network', 'power'] as const
export type StandardLayer = (typeof STANDARD_LAYERS)[number]

export interface LayerStyle {
  label: string
  color: string
  icon: string
}

export const LAYER_STYLES: Record<StandardLayer, LayerStyle> = {
  video: { label: 'Video', color: '#3b82f6', icon: '📹' },
  audio: { label: 'Audio', color: '#ef4444', icon: '🎙' },
  control: { label: 'Control', color: '#f59e0b', icon: '🎛' },
  network: { label: 'Network', color: '#10b981', icon: '🌐' },
  power: { label: 'Power', color: '#a855f7', icon: '⚡' },
}

/** Heuristik: weise einem Cable anhand seines Connector-Typs oder
 *  CableType einen Top-Level-Layer zu. Wird als Default-Vorschlag
 *  beim Anlegen genutzt. Liefert null wenn unsicher (User soll dann
 *  selber wählen). */
export const detectLayerForConnector = (
  connectorType: ConnectorType | CableType | undefined,
): StandardLayer | null => {
  if (!connectorType) return null
  const ct = String(connectorType).toLowerCase()
  if (ct === 'bnc' || ct === 'hdmi' || ct === 'displayport' || ct === 'triax') return 'video'
  if (ct === 'xlr' || ct === 'din') return 'audio'
  if (ct === 'ethernet/rj45') return 'network'
  // Fiber kann Video ODER Network sein — ohne weiteren Kontext: Video
  // (für 2110/SDI-Fiber häufiger als reines IT-LAN-Fiber).
  if (ct === 'fiber' || ct === 'sfp' || ct === 'sfp+') return 'video'
  if (ct === 'usb' || ct === 'usb-c') return 'control'
  if (
    ct === 'iec 230v' ||
    ct === 'powercon' ||
    ct === 'schuko 230v' ||
    ct === 'c7 eurostecker'
  )
    return 'power'
  if (ct === 'wireless/rf') return 'control'
  return null
}

/** Liefert die effektive Layer-Bezeichnung für Filter-Zwecke.
 *  Splittet sub-layer-Notation 'video.primary' auf nur 'video'. */
export const topLayer = (layer: string | undefined): string | undefined => {
  if (!layer) return undefined
  const dot = layer.indexOf('.')
  return dot >= 0 ? layer.slice(0, dot) : layer
}

/** Style-Lookup mit Fallback für Custom-Layer (graue Defaults). */
export const styleForLayer = (layer: string | undefined): LayerStyle => {
  if (!layer) return { label: 'Ungrouped', color: '#64748b', icon: '∅' }
  const top = topLayer(layer)
  if (top && top in LAYER_STYLES) return LAYER_STYLES[top as StandardLayer]
  return { label: layer, color: '#64748b', icon: '◆' }
}

/** Test: ist dieses Cable bei den aktuellen Layer-Visibility-Settings sichtbar? */
export const isCableVisibleByLayer = (
  cable: Pick<Cable, 'layer'>,
  layerVisibility: Record<string, boolean>,
): boolean => {
  if (!cable.layer) return true // ungrouped immer sichtbar
  const top = topLayer(cable.layer) ?? cable.layer
  // Wenn der Layer nicht im Map ist (z.B. erstmaliges Sehen eines Custom-
  // Layers), ist er per Default sichtbar.
  if (!(top in layerVisibility)) return true
  return layerVisibility[top]
}
