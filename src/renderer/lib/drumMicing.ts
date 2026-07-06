// ───────────────────────────────────────────────────────────────────────────
// Drum-Mikrofonierung — pure Logik (Default-Zonen, Technik-Presets, Ableitungen).
//
// Grundsatz "nichts erfinden": Die Ableitungen (Phantom-Bedarf etc.) lesen die
// ECHTEN Fachdaten des zugeordneten Mikrofons aus dem Katalog. Ist keinem
// Placement ein Mic zugeordnet, wird es als "unbekannt" gezaehlt, nicht geraten.
// ───────────────────────────────────────────────────────────────────────────
import type { DrumKitPlan, DrumZone, DrumMicPlacement, DrumTechnique } from '../types/drumKit'
import { resolveDeviceType } from './deviceTypeRegistry'

/** Standard-Zonen eines typischen 5-teiligen Kits (Positionen 0..1 Draufsicht). */
export const defaultDrumZones = (): DrumZone[] => [
  { id: 'kick', label: 'Kick', kind: 'kick', x: 0.5, y: 0.72 },
  { id: 'snareTop', label: 'SN Top', kind: 'snare', x: 0.38, y: 0.58 },
  { id: 'snareBot', label: 'SN Bot', kind: 'snare', x: 0.38, y: 0.66 },
  { id: 'hihat', label: 'HiHat', kind: 'hihat', x: 0.24, y: 0.52 },
  { id: 'tom1', label: 'Tom 1', kind: 'tom', x: 0.44, y: 0.42 },
  { id: 'tom2', label: 'Tom 2', kind: 'tom', x: 0.56, y: 0.42 },
  { id: 'floorTom', label: 'Floor Tom', kind: 'tom', x: 0.72, y: 0.58 },
  { id: 'ride', label: 'Ride', kind: 'ride', x: 0.74, y: 0.4 },
  { id: 'ohL', label: 'OH L', kind: 'overhead', x: 0.3, y: 0.24 },
  { id: 'ohR', label: 'OH R', kind: 'overhead', x: 0.7, y: 0.24 },
  { id: 'roomL', label: 'Room L', kind: 'room', x: 0.12, y: 0.12 },
  { id: 'roomR', label: 'Room R', kind: 'room', x: 0.88, y: 0.12 },
]

/** Technik-Preset: welche Zonen belegt werden + optional Stereo-Paare. */
interface TechniqueDef {
  label: { de: string; en: string }
  zoneIds: string[]
  /** Zonen-Paare, die als L/R-Stereo-Gruppe markiert werden. */
  stereoPairs?: [string, string][]
}

export const DRUM_TECHNIQUES: Record<Exclude<DrumTechnique, 'custom'>, TechniqueDef> = {
  minimal: {
    label: { de: 'Minimal (Kick + Overheads)', en: 'Minimal (kick + overheads)' },
    zoneIds: ['kick', 'ohL', 'ohR'],
    stereoPairs: [['ohL', 'ohR']],
  },
  glynJohns: {
    label: { de: 'Glyn Johns (4 Mics)', en: 'Glyn Johns (4 mics)' },
    // Kick, Snare + zwei Overheads (einer ueber der Snare, einer rechts tief).
    zoneIds: ['kick', 'snareTop', 'ohL', 'ohR'],
    stereoPairs: [['ohL', 'ohR']],
  },
  recorderman: {
    label: { de: 'Recorderman (Kick, Snare, 2 OH)', en: 'Recorderman (kick, snare, 2 OH)' },
    zoneIds: ['kick', 'snareTop', 'ohL', 'ohR'],
    stereoPairs: [['ohL', 'ohR']],
  },
  closeFull: {
    label: { de: 'Full Close (alle Kessel + OH + Room)', en: 'Full close micing (all shells + OH + room)' },
    zoneIds: ['kick', 'snareTop', 'snareBot', 'hihat', 'tom1', 'tom2', 'floorTom', 'ride', 'ohL', 'ohR', 'roomL', 'roomR'],
    stereoPairs: [['ohL', 'ohR'], ['roomL', 'roomR']],
  },
}

const zoneChannelLabel = (z: DrumZone): string => {
  switch (z.kind) {
    case 'kick': return 'Kick In'
    case 'snare': return z.label
    case 'overhead': return z.label
    case 'room': return z.label
    default: return z.label
  }
}

/**
 * Wendet eine Technik auf den vorhandenen Zonen-Satz an und erzeugt die
 * Placements (ohne konkretes Mic — der User waehlt Modelle). Behaelt bereits
 * gesetzte Mic-Zuordnungen, wenn die Zone erneut belegt wird.
 */
export const applyTechnique = (
  plan: DrumKitPlan,
  technique: Exclude<DrumTechnique, 'custom'>,
  idFor: (zoneId: string) => string,
): DrumMicPlacement[] => {
  const def = DRUM_TECHNIQUES[technique]
  const byZone = new Map(plan.mics.map((m) => [m.zoneId, m]))
  const zonesById = new Map(plan.zones.map((z) => [z.id, z]))
  const stereoOf = (zoneId: string): string | undefined => {
    const pair = def.stereoPairs?.find((p) => p.includes(zoneId))
    return pair ? pair.join('-') : undefined
  }
  return def.zoneIds
    .filter((zid) => zonesById.has(zid))
    .map((zid) => {
      const existing = byZone.get(zid)
      const zone = zonesById.get(zid)!
      return {
        id: existing?.id ?? idFor(zid),
        zoneId: zid,
        micDeviceTypeId: existing?.micDeviceTypeId,
        micName: existing?.micName,
        channelLabel: existing?.channelLabel ?? zoneChannelLabel(zone),
        stereoGroup: stereoOf(zid),
      }
    })
}

export interface DrumChannelRow {
  channel: number
  label: string
  micName: string
  /** true, wenn dieses Mic 48V-Phantom braucht (aus Katalog). */
  needsPhantom: boolean
  /** true, wenn dem Placement (noch) kein Katalog-Mic zugeordnet ist. */
  micUnknown: boolean
  stereoGroup?: string
}

export interface DrumDerivation {
  channels: DrumChannelRow[]
  /** Anzahl Kanaele gesamt. */
  channelCount: number
  /** Anzahl Mics, die 48V-Phantom brauchen. */
  phantomCount: number
  /** Anzahl Placements ohne zugeordnetes Mic (Datenblatt fehlt → nicht geraten). */
  unknownCount: number
  /** Stereo-Paare (Gruppen-Ids). */
  stereoGroups: string[]
}

/**
 * Leitet Kanalliste + Phantom-Bedarf aus dem Plan ab. Liest die echten
 * Mic-Fachdaten (powering) aus dem Geraetetyp-Register — kein Raten.
 */
export const deriveDrumChannels = (plan: DrumKitPlan): DrumDerivation => {
  const zonesById = new Map(plan.zones.map((z) => [z.id, z]))
  const channels: DrumChannelRow[] = []
  let phantomCount = 0
  let unknownCount = 0
  const groups = new Set<string>()

  plan.mics.forEach((m, i) => {
    const zone = zonesById.get(m.zoneId)
    const resolved = resolveDeviceType(m.micDeviceTypeId)
    const powering = resolved?.template.categoryProps?.powering
    const micUnknown = !resolved && !m.micName
    const needsPhantom = powering === 'p48'
    if (needsPhantom) phantomCount += 1
    if (micUnknown) unknownCount += 1
    if (m.stereoGroup) groups.add(m.stereoGroup)
    channels.push({
      channel: i + 1,
      label: m.channelLabel ?? (zone ? zone.label : 'Kanal'),
      micName: resolved?.template.name ?? m.micName ?? '—',
      needsPhantom,
      micUnknown,
      stereoGroup: m.stereoGroup,
    })
  })

  return {
    channels,
    channelCount: channels.length,
    phantomCount,
    unknownCount,
    stereoGroups: [...groups],
  }
}

/** Frischer, leerer Plan mit Default-Zonen. */
export const emptyDrumKit = (): DrumKitPlan => ({
  zones: defaultDrumZones(),
  mics: [],
  technique: 'custom',
})
