/**
 * v7.9.85 / #123 — Cable-Layer-System.
 * v7.9.95 — 'other'-Layer für Custom/Undefined-Kabel hinzugefügt.
 *
 * Top-Level-Layer aus dem AV/Broadcast-Industrie-Standard (recherchiert
 * über D-Tools SI, Stardraw Design, Visio AV-ECAV, AVNetwork-Best-Practices):
 *
 *   video    — SDI, HDMI, optical Fiber-Video, NDI/2110-Signal-Pfade
 *   audio    — XLR, TRS, AES/EBU, Dante/MADI
 *   control  — RS-422, GPI, LAN-Control (Tally, Routing-Steuerung)
 *   network  — IT/Office-LAN, WiFi, Management-VLAN, DHCP/DNS
 *   power    — IEC, PowerCON, Schuko, USV-Strecken
 *   other    — Custom/Undefined: Kabel die in keine der obigen Kategorien
 *              fallen oder vom Auto-Detect nicht klassifiziert werden konnten
 *
 * Sub-Layer-Patterns (User kann frei erweitern):
 *   - Primary vs Backup (z.B. video.primary, video.backup)
 *   - FOH vs Monitor (audio.foh, audio.monitor)
 *   - Front-of-House vs Stage
 *
 * Auto-Detect:
 *   - Cable connectorType → wahrscheinlichster Layer (Fallback 'other')
 *   - Wird beim Cable-Anlegen als Vorschlag genutzt, User kann überschreiben
 */
import type { Cable, CableType } from '../types/cable'
import type { ConnectorType } from '../types/equipment'

export const STANDARD_LAYERS = ['video', 'audio', 'control', 'network', 'power', 'other'] as const
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
  other: { label: 'Other', color: '#64748b', icon: '◆' },
}

/** Heuristik: weise einem Cable anhand seines Connector-Typs oder
 *  CableType einen Top-Level-Layer zu. Wird als Default-Vorschlag
 *  beim Anlegen genutzt. Fällt auf 'other' zurück wenn keine
 *  Detection greift — damit hat jedes Kabel garantiert einen Layer. */
export const detectLayerForConnector = (
  connectorType: ConnectorType | CableType | undefined,
): StandardLayer => {
  if (!connectorType) return 'other'
  const ct = String(connectorType).toLowerCase()
  if (ct === 'bnc' || ct === 'hdmi' || ct === 'displayport' || ct === 'triax' || ct === 'vga' || ct === 'dvi' || ct === 'hd-bnc' || ct === 'mini-hdmi' || ct === 'f-connector' || ct === 'cinch/rca' || ct === 'scart' || ct === 's-video' || ct === 'mini-bnc' || ct === 'micro-bnc') return 'video'
  if (ct === 'xlr' || ct === 'din' || ct === 'db25' || ct === 'klinke' || ct === 'mini-xlr' || ct === 'tt/bantam') return 'audio'
  if (ct === 'ethernet/rj45' || ct === 'gg45') return 'network'
  // Fiber kann Video ODER Network sein — ohne weiteren Kontext: Video
  // (für 2110/SDI-Fiber häufiger als reines IT-LAN-Fiber).
  if (ct === 'fiber' || ct === 'sfp' || ct === 'sfp+') return 'video'
  if (ct === 'usb' || ct === 'usb-c' || ct === 'db9' || ct === 'dmx 5-pol (xlr)' || ct === 'dmx 3-pol (xlr)') return 'control'
  if (
    ct === 'iec 230v' ||
    ct === 'powercon' ||
    ct === 'schuko 230v' ||
    ct === 'c7 eurostecker' ||
    ct === 'cee16' ||
    ct === 'cee32' ||
    ct === 'cee63' ||
    ct === 'powerlock' ||
    ct === 'socapex' ||
    ct === 'harting' ||
    ct === 'kleeblatt'
  )
    return 'power'
  if (ct === 'wireless/rf') return 'control'
  return 'other'
}

/** Liefert die effektive Layer-Bezeichnung für Filter-Zwecke.
 *  Splittet sub-layer-Notation 'video.primary' auf nur 'video'. */
export const topLayer = (layer: string | undefined): string | undefined => {
  if (!layer) return undefined
  const dot = layer.indexOf('.')
  return dot >= 0 ? layer.slice(0, dot) : layer
}

/** Style-Lookup mit Fallback für Custom-Layer (graue Defaults).
 *  Kabel ohne layer-Feld (legacy, vor Heal) werden wie 'other' behandelt. */
export const styleForLayer = (layer: string | undefined): LayerStyle => {
  if (!layer) return LAYER_STYLES.other
  const top = topLayer(layer)
  if (top && top in LAYER_STYLES) return LAYER_STYLES[top as StandardLayer]
  return { label: layer, color: '#64748b', icon: '◆' }
}

/** Test: ist dieses Cable bei den aktuellen Layer-Visibility-Settings sichtbar?
 *  Kabel ohne layer-Feld (legacy, vor Heal) werden wie 'other' behandelt. */
export const isCableVisibleByLayer = (
  cable: Pick<Cable, 'layer'>,
  layerVisibility: Record<string, boolean>,
): boolean => {
  const top = topLayer(cable.layer) ?? cable.layer ?? 'other'
  // Wenn der Layer nicht im Map ist (z.B. erstmaliges Sehen eines Custom-
  // Layers), ist er per Default sichtbar.
  if (!(top in layerVisibility)) return true
  return layerVisibility[top]
}
