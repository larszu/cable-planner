// ───────────────────────────────────────────────────────────────────────────
// Drum-Mikrofonierung — pure Logik (Default-Zonen, Technik-Presets, Ableitungen).
//
// Grundsatz "nichts erfinden": Die Ableitungen (Phantom-Bedarf etc.) lesen die
// ECHTEN Fachdaten des zugeordneten Mikrofons aus dem Katalog. Ist keinem
// Placement ein Mic zugeordnet, wird es als "unbekannt" gezaehlt, nicht geraten.
// ───────────────────────────────────────────────────────────────────────────
import type { CsvTable } from './csv'
import type { DrumKitPlan, DrumZone, DrumMicPlacement, DrumTechnique, DrumSubsnake } from '../types/drumKit'
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
/**
 * BEDARF 96 — was ein Preset kosten wuerde, BEVOR es angewandt wird.
 *
 *   > Applying a preset must never silently replace an existing grid;
 *   > presets must append or prompt AND SHOW THE RESULTING ROW COUNT.
 *   > A wrong preset is worse than no preset.
 *
 * Beleg: Cryde/musicall#798, geschrieben nach einem Datenverlust-Fehler.
 *
 * Genau das passierte hier: `applyTechnique` gab NUR die Zonen der gewaehlten
 * Technik zurueck. Wer auf drei Toms Mikrofone gesetzt hatte — mit Modell aus
 * dem Katalog und eigener Kanal-Beschriftung — und dann auf eine kleinere
 * Technik wechselte, verlor sie. Wortlos, ohne Rueckfrage, ohne Hinweis.
 *
 * `dropped` traegt deshalb nur, was ein MENSCH eingetragen hat: ein
 * Mikrofon-Modell, ein eigener Name oder eine eigene Kanal-Beschriftung. Eine
 * leere Platzierung auf einer Zone, die die neue Technik nicht kennt, ist
 * kein Verlust — sie als solchen zu melden wuerde die Rueckfrage bei jedem
 * Wechsel stellen, und wer sie dreimal grundlos sieht, klickt sie beim
 * vierten Mal weg.
 */
export interface TechniqueChange {
  /** Die Platzierungen NACH dem Wechsel. */
  placements: DrumMicPlacement[]
  /**
   * Was dabei verlorenginge — nur Platzierungen mit eingetragenem Inhalt,
   * mit dem Zonennamen, damit die Rueckfrage sie benennen kann.
   */
  dropped: Array<{ zoneLabel: string; what: string }>
}

/** Hat ein Mensch an dieser Platzierung etwas eingetragen? */
const hatInhalt = (m: DrumMicPlacement, zone: DrumZone | undefined): boolean =>
  Boolean(m.micDeviceTypeId) ||
  Boolean(m.micName?.trim()) ||
  Boolean(m.channelLabel?.trim() && m.channelLabel !== (zone ? zoneChannelLabel(zone) : undefined))

export const applyTechnique = (
  plan: DrumKitPlan,
  technique: Exclude<DrumTechnique, 'custom'>,
  idFor: (zoneId: string) => string,
): TechniqueChange => {
  const def = DRUM_TECHNIQUES[technique]
  const byZone = new Map(plan.mics.map((m) => [m.zoneId, m]))
  const zonesById = new Map(plan.zones.map((z) => [z.id, z]))
  const stereoOf = (zoneId: string): string | undefined => {
    const pair = def.stereoPairs?.find((p) => p.includes(zoneId))
    return pair ? pair.join('-') : undefined
  }
  const behalten = new Set(def.zoneIds.filter((zid) => zonesById.has(zid)))

  const dropped: TechniqueChange['dropped'] = []
  for (const m of plan.mics) {
    if (behalten.has(m.zoneId)) continue
    const zone = zonesById.get(m.zoneId)
    if (!hatInhalt(m, zone)) continue
    dropped.push({
      zoneLabel: zone?.label ?? m.zoneId,
      what: m.micName?.trim() || m.channelLabel?.trim() || m.micDeviceTypeId || '—',
    })
  }

  const placements = [...behalten].map((zid) => {
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
  return { placements, dropped }
}

export interface DrumChannelRow {
  channel: number
  label: string
  micName: string
  /** true, wenn dieses Mic 48V-Phantom braucht (aus Katalog). */
  needsPhantom: boolean
  /** true, wenn dem Placement (noch) kein Katalog-Mic zugeordnet ist. */
  micUnknown: boolean
  /** true, wenn Max SPL des Mics für die laute Zone (Kick/Snare) grenzwertig
   *  ist — DPA: ein Snare-Schlag kann 156 dB SPL überschreiten. Nur gesetzt,
   *  wenn der Max-SPL-Wert bekannt ist (kein Raten). */
  splRisk: boolean
  stereoGroup?: string
  /** Subsnake-Eingang (#1001); undefined = passt nicht mehr auf die Subsnake. */
  subsnakeInput?: number
}

/** Zonen, an denen extreme Pegel auftreten (DPA how-to-mic-a-snare/kick). */
const LOUD_ZONE_KINDS = new Set(['kick', 'snare'])
/** Unter diesem Max SPL gilt ein Mic an einer lauten Zone als grenzwertig. */
const LOUD_ZONE_MIN_SPL = 140

export interface DrumDerivation {
  channels: DrumChannelRow[]
  /** Anzahl Kanaele gesamt. */
  channelCount: number
  /** Anzahl Mics, die 48V-Phantom brauchen. */
  phantomCount: number
  /** Anzahl Placements ohne zugeordnetes Mic (Datenblatt fehlt → nicht geraten). */
  unknownCount: number
  /** Anzahl Kanäle mit grenzwertigem Max SPL an lauter Zone. */
  splRiskCount: number
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
  let splRiskCount = 0
  const groups = new Set<string>()

  const ss = drumSubsnake(plan)
  const first = ss.firstInput ?? 1
  plan.mics.forEach((m, i) => {
    const input = first + i
    const subsnakeInput = input <= ss.inputs ? input : undefined
    const zone = zonesById.get(m.zoneId)
    const resolved = resolveDeviceType(m.micDeviceTypeId)
    const powering = resolved?.template.categoryProps?.powering
    const micUnknown = !resolved && !m.micName
    const needsPhantom = powering === 'p48'
    // Max-SPL-Risiko: nur wenn Zone laut UND der Wert bekannt ist (kein Raten).
    const maxSpl = resolved?.template.categoryProps?.maxSplDb
    const splRisk =
      !!zone &&
      LOUD_ZONE_KINDS.has(zone.kind) &&
      typeof maxSpl === 'number' &&
      maxSpl < LOUD_ZONE_MIN_SPL
    if (needsPhantom) phantomCount += 1
    if (micUnknown) unknownCount += 1
    if (splRisk) splRiskCount += 1
    if (m.stereoGroup) groups.add(m.stereoGroup)
    channels.push({
      channel: i + 1,
      label: m.channelLabel ?? (zone ? zone.label : 'Kanal'),
      micName: resolved?.template.name ?? m.micName ?? '—',
      needsPhantom,
      micUnknown,
      splRisk,
      stereoGroup: m.stereoGroup,
      subsnakeInput,
    })
  })

  return {
    channels,
    channelCount: channels.length,
    phantomCount,
    unknownCount,
    splRiskCount,
    stereoGroups: [...groups],
  }
}

export interface DrumBomRow {
  qty: number
  item: string
  kind: 'mic' | 'cable' | 'stand'
}

/**
 * Leitet eine Materialliste (BOM) aus dem Kit ab: Mikrofone nach Modell
 * gruppiert, ein XLR-Kabel je Kanal, sowie Stative/Clamps je Zonenart
 * (Clip-Mics/Grenzflächen brauchen kein Stativ). Kein Raten: unbekannte Mics
 * werden als „Mikrofon (offen)" gezählt.
 */
export const deriveDrumBom = (plan: DrumKitPlan): DrumBomRow[] => {
  const zonesById = new Map(plan.zones.map((z) => [z.id, z]))
  const micCounts = new Map<string, number>()
  let stands = 0
  let clamps = 0
  for (const m of plan.mics) {
    const resolved = resolveDeviceType(m.micDeviceTypeId)
    const name = resolved?.template.name ?? m.micName ?? 'Mikrofon (offen)'
    micCounts.set(name, (micCounts.get(name) ?? 0) + 1)
    // Stativ-Bedarf: Clip-Mics an Kessel = Clamp; Grenzfläche = keins; sonst Stativ.
    const capsule = resolved?.template.categoryProps?.capsule
    const zone = zonesById.get(m.zoneId)
    if (capsule === 'boundary') continue
    if (capsule === 'clip' || (zone && (zone.kind === 'tom' || zone.kind === 'snare'))) clamps += 1
    else stands += 1
  }
  const rows: DrumBomRow[] = []
  for (const [item, qty] of [...micCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    rows.push({ qty, item, kind: 'mic' })
  }
  if (plan.mics.length > 0) rows.push({ qty: plan.mics.length, item: 'XLR-Kabel (Mic → Stagebox)', kind: 'cable' })
  if (stands > 0) rows.push({ qty: stands, item: 'Mikrofonstativ', kind: 'stand' })
  if (clamps > 0) rows.push({ qty: clamps, item: 'Kessel-Clamp / Rim-Halter', kind: 'stand' })
  return rows
}

/** BOM als kopierbarer Text (eine Zeile je Position). */
export const drumBomToText = (plan: DrumKitPlan): string =>
  deriveDrumBom(plan)
    .map((r) => `${r.qty}x ${r.item}`)
    .join('\n')

/** Frischer, leerer Plan mit Default-Zonen. */
export const emptyDrumKit = (): DrumKitPlan => ({
  zones: defaultDrumZones(),
  mics: [],
  technique: 'custom',
})

// ── #1001 Subsnake-Patch, Patchliste, Etiketten ────────────────────────────
// Kein eigener Patch-Editor: Kanal n liegt auf Subsnake-Eingang n (ab
// firstInput). Die Kanalreihenfolge kommt aus der Technik, Stereo-Paare liegen
// dadurch nebeneinander. Wer nur die Subsnake-Groesse waehlt, ist fertig.

export const DEFAULT_SUBSNAKE: DrumSubsnake = { name: 'Drum Sub', inputs: 12, firstInput: 1 }
export const SUBSNAKE_SIZES = [8, 12, 16, 24, 32] as const

export const drumSubsnake = (plan: DrumKitPlan): DrumSubsnake => plan.subsnake ?? DEFAULT_SUBSNAKE

/** Kanaele, die nicht mehr auf die Subsnake passen. */
export const drumSubsnakeOverflow = (plan: DrumKitPlan): number =>
  deriveDrumChannels(plan).channels.filter((c) => c.subsnakeInput === undefined).length

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Patchliste als Tabelle — geht durch csvFromTable wie jede andere Liste. */
export const drumPatchTable = (plan: DrumKitPlan): CsvTable => {
  const ss = drumSubsnake(plan)
  return {
    headers: ['Ch', 'Source', 'Mic', 'Subsnake', 'Input', '48V', 'Stereo'],
    rows: deriveDrumChannels(plan).channels.map((c) => [
      c.channel,
      c.label,
      c.micUnknown ? '' : c.micName,
      ss.name,
      c.subsnakeInput ?? '',
      c.needsPhantom ? 'yes' : '',
      c.stereoGroup ?? '',
    ]),
  }
}

export interface DrumLabelRow {
  /** Grosse Zeile: Kanal + Quelle ("03 SN Top"). */
  label1: string
  /** Zweite Zeile: wohin dieses Kabelende geht. */
  label2: string
}

/**
 * Etiketten je Kanal: eines fuers Mic-Ende des Kabels, eines fuers
 * Subsnake-Ende. Gleiches Muster wie die Kabel-Etiketten der Patchliste.
 */
export const drumLabelRows = (plan: DrumKitPlan): DrumLabelRow[] => {
  const ss = drumSubsnake(plan)
  return deriveDrumChannels(plan).channels.flatMap((c) => {
    const label1 = `${pad2(c.channel)} ${c.label}`
    const port = c.subsnakeInput !== undefined ? `${ss.name} ${c.subsnakeInput}` : ss.name
    return [
      { label1, label2: `-> ${port}` },
      { label1, label2: `<- ${c.micUnknown ? c.label : c.micName}` },
    ]
  })
}
