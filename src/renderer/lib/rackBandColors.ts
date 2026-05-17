// v7.9.39 — Shared rack band colors. Werden sowohl beim Canvas-Black-Box
// (EquipmentNode) als auch in der Live-Preview im Rack Builder benutzt,
// damit beide IDENTISCH aussehen. Vorher waren die Farben nur in
// EquipmentNode definiert und die Preview hatte eigene grüne/blaue Dots.

const RACK_BAND_PALETTE = [
  '#0ea5e9', // sky
  '#a855f7', // violet
  '#22c55e', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#e11d48', // rose
  '#eab308', // yellow
] as const

/** Deterministische Farbzuweisung pro Gerätename, damit dasselbe Gerät
 *  immer dieselbe Band-Farbe bekommt — egal ob im Canvas oder in der
 *  Preview. */
export const rackBandColor = (name: string): string => {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return RACK_BAND_PALETTE[Math.abs(hash) % RACK_BAND_PALETTE.length]
}
