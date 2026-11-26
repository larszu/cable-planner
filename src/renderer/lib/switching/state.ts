// ───────────────────────────────────────────────────────────────────────────
// Zustand am Geraet: Grenzen, Snapshot, Makro, Heilung (#1240, Stufe 1).
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentItem } from '../../types/equipment'
import { resolveDeviceType } from '../deviceTypeRegistry'
import { buildInnerMatrix, type InnerMatrix } from './internalMatrix'
import { EASE_DIRECTIONS, EASE_FAMILIES, type EaseDirection, type EaseFamily } from './easing'
import type {
  AtemProfileState,
  BoxState,
  KeyerState,
  MediaSlotState,
  SwitchingBlockCountKey,
  SwitchingBlockCounts,
  SwitchingMacro,
  SwitchingProfile,
  SwitchingSnapshot,
  SwitchingState,
  TransitionSettings,
  WipePattern,
} from './types'
import { WIPE_PATTERNS } from './types'

/** Das Profil eines Geraets aus dem Katalog — `null`, wenn es keines gibt. */
export const switchingProfileFor = (device: Pick<EquipmentItem, 'deviceTypeId'>): SwitchingProfile | null =>
  resolveDeviceType(device.deviceTypeId)?.switchingProfile ?? null

/** Ein Ueberschreiten einer Grenze der gewaehlten Betriebsart. Hinweis, keine Sperre. */
export interface LimitNote {
  key: SwitchingBlockCountKey
  limit: number
  used: number
}

/** Wie viele Bausteine der Plan tatsaechlich belegt. */
export const usedCounts = (matrix: InnerMatrix, state: SwitchingState | undefined): SwitchingBlockCounts => {
  const routes = state?.routes ?? {}
  const usedBlock = (prefix: string) =>
    new Set(Object.keys(routes).filter((d) => d.startsWith(prefix)).map((d) => d.split('/')[0])).size
  const inputs = new Set(Object.values(routes).filter((s) => s.startsWith('in:'))).size
  return {
    inputs,
    mixEffects: usedBlock('me:'),
    upstreamKeyers: Object.entries(state?.keyers ?? {}).filter(([id, k]) => id.includes('/key:') && k.onAir).length,
    downstreamKeyers: Object.entries(state?.keyers ?? {}).filter(([id, k]) => id.startsWith('dsk:') && k.onAir).length,
    superSources: usedBlock('ss:'),
    mediaPlayers: usedBlock('mp:'),
    stills: Object.keys(state?.media ?? {}).length,
    aux: matrix.blocks.filter((b) => b.kind === 'aux' && routes[b.id] !== undefined).length,
  }
}

/** Was in der gewaehlten Betriebsart ueber der Grenze liegt. Nur belegte Grenzen zaehlen. */
export const limitNotes = (
  profile: SwitchingProfile | null | undefined,
  matrix: InnerMatrix,
  state: SwitchingState | undefined,
): LimitNote[] => {
  const mode = profile?.modes?.find((m) => m.id === state?.mode)
  if (!mode) return []
  const used = usedCounts(matrix, state)
  const out: LimitNote[] = []
  for (const [k, limit] of Object.entries(mode.limits) as [SwitchingBlockCountKey, number][]) {
    const u = used[k]
    if (typeof u === 'number' && u > limit) out.push({ key: k, limit, used: u })
  }
  return out
}

export const setKeyer = (state: SwitchingState | undefined, id: string, patch: KeyerState): SwitchingState => {
  const s = state ?? {}
  return { ...s, keyers: { ...(s.keyers ?? {}), [id]: { ...(s.keyers?.[id] ?? {}), ...patch } } }
}

/**
 * Einen Media-Pool-Platz belegen (leer = freigeben). Eine Zeichenkette ist
 * eine Anhang-Id, ein Objekt nennt Foto oder Anhang.
 */
export const setMediaSlot = (
  state: SwitchingState | undefined,
  slot: number,
  ref: string | MediaSlotState | undefined,
): SwitchingState => {
  const s = state ?? {}
  const media = { ...(s.media ?? {}) }
  const r: MediaSlotState = typeof ref === 'string' ? { anhangId: ref } : (ref ?? {})
  const clean: MediaSlotState = {}
  if (r.fotoId) clean.fotoId = r.fotoId
  if (r.anhangId) clean.anhangId = r.anhangId
  if (clean.fotoId || clean.anhangId) media[`still:${slot}`] = clean
  else delete media[`still:${slot}`]
  return { ...s, media }
}

export const takeSnapshot = (state: SwitchingState | undefined, id: string, name: string): SwitchingState => {
  const s = state ?? {}
  const snap: SwitchingSnapshot = { id, name, routes: { ...(s.routes ?? {}) }, keyers: { ...(s.keyers ?? {}) } }
  return { ...s, snapshots: [...(s.snapshots ?? []), snap] }
}

export const recallSnapshot = (state: SwitchingState | undefined, id: string): SwitchingState => {
  const s = state ?? {}
  const snap = s.snapshots?.find((x) => x.id === id)
  if (!snap) return s
  return { ...s, routes: { ...snap.routes }, keyers: { ...(snap.keyers ?? {}) } }
}

/** Ein Makro ohne Uhr ausfuehren: die Schritte der Reihe nach auf den Zustand. */
export const runMacro = (state: SwitchingState | undefined, macro: SwitchingMacro): SwitchingState => {
  let s = state ?? {}
  for (const step of macro.steps) {
    if (step.route) s = { ...s, routes: { ...(s.routes ?? {}), [step.route.dest]: step.route.source } }
    if (step.keyer) s = setKeyer(s, step.keyer.id, { onAir: step.keyer.onAir })
  }
  return s
}

// ─── Heilung beim Laden (healProjectPositions) ──────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const strMap = (v: unknown): Record<string, string> => {
  if (!isObj(v)) return {}
  return Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== ''))
}
const levelMap = (v: unknown): Record<string, Record<string, string>> => {
  if (!isObj(v)) return {}
  const out: Record<string, Record<string, string>> = {}
  for (const [k, t] of Object.entries(v)) {
    const m = strMap(t)
    if (Object.keys(m).length) out[k] = m
  }
  return out
}
const list = <T>(v: unknown, ok: (x: Record<string, unknown>) => boolean): T[] =>
  Array.isArray(v) ? (v.filter((x) => isObj(x) && ok(x)) as T[]) : []
const named = (x: Record<string, unknown>) => typeof x.id === 'string' && typeof x.name === 'string'

/**
 * `switching` aus einer Datei lesen: unbekannte oder kaputte Teile fallen
 * weg, Kreuzpunkte auf Bausteine, die es am Geraet nicht (mehr) gibt,
 * ebenfalls. Bleibt nichts uebrig, faellt das Feld ganz weg (`undefined`).
 */
export const normaliseSwitching = (
  device: EquipmentItem,
  raw: unknown,
): SwitchingState | undefined => {
  if (!isObj(raw)) return undefined
  const s: SwitchingState = {}
  if (typeof raw.mode === 'string') s.mode = raw.mode
  if (isObj(raw.blocks)) {
    const b: SwitchingBlockCounts = {}
    for (const [k, v] of Object.entries(raw.blocks)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1000) b[k as SwitchingBlockCountKey] = Math.floor(v)
    }
    if (Object.keys(b).length) s.blocks = b
  }
  const keyers: Record<string, KeyerState> = {}
  if (isObj(raw.keyers)) {
    for (const [id, k] of Object.entries(raw.keyers)) {
      if (!isObj(k)) continue
      const ks: KeyerState = {}
      if (typeof k.onAir === 'boolean') ks.onAir = k.onAir
      if (k.type === 'luma' || k.type === 'chroma' || k.type === 'pattern' || k.type === 'dve') ks.type = k.type
      keyers[id] = ks
    }
  }
  if (Object.keys(keyers).length) s.keyers = keyers
  const media: SwitchingState['media'] = {}
  if (isObj(raw.media)) {
    for (const [slot, m] of Object.entries(raw.media)) {
      if (!/^still:\d+$/.test(slot) || !isObj(m)) continue
      const ms: MediaSlotState = {}
      if (typeof m.fotoId === 'string' && m.fotoId) ms.fotoId = m.fotoId
      if (typeof m.anhangId === 'string' && m.anhangId) ms.anhangId = m.anhangId
      if (ms.fotoId || ms.anhangId) media[slot] = ms
    }
  }
  if (Object.keys(media).length) s.media = media

  // Interne Kreuzpunkte gegen die Bausteine pruefen, die das Geraet hat.
  const matrix = buildInnerMatrix(device, switchingProfileFor(device), s)
  const routes: Record<string, string> = {}
  for (const [dest, src] of Object.entries(strMap(raw.routes))) {
    if (!matrix.destOwner.has(dest)) continue
    if (dest.endsWith('/still') ? /^still:\d+$/.test(src) : matrix.byId.get(src)?.source) routes[dest] = src
  }
  if (Object.keys(routes).length) s.routes = routes

  const levels = levelMap(raw.levels)
  if (Object.keys(levels).length) s.levels = levels
  const pending = levelMap(raw.pending)
  if (Object.keys(pending).length) s.pending = pending
  if (isObj(raw.locks)) {
    const locks = Object.fromEntries(Object.entries(raw.locks).filter(([, v]) => v === 'lock' || v === 'protect')) as SwitchingState['locks']
    if (locks && Object.keys(locks).length) s.locks = locks
  }
  const salvos = list<NonNullable<SwitchingState['salvos']>[number]>(raw.salvos, (x) => named(x) && isObj(x.crosspoints)).map(
    (x) => ({ ...x, crosspoints: levelMap(x.crosspoints) }),
  )
  if (salvos.length) s.salvos = salvos
  const macros = list<SwitchingMacro>(raw.macros, (x) => named(x) && Array.isArray(x.steps))
  if (macros.length) s.macros = macros
  const snapshots = list<SwitchingSnapshot>(raw.snapshots, (x) => named(x) && isObj(x.routes)).map((x) => ({
    ...x,
    routes: strMap(x.routes),
  }))
  if (snapshots.length) s.snapshots = snapshots
  if (isObj(raw.atemProfile) && typeof raw.atemProfile.rawXml === 'string') s.atemProfile = raw.atemProfile as unknown as AtemProfileState

  // Stufe 3: Uebergaenge je M/E und Lage der SuperSource-Boxen.
  if (isObj(raw.transitions)) {
    const tr: Record<string, TransitionSettings> = {}
    for (const [me, v] of Object.entries(raw.transitions)) {
      if (!/^me:\d+$/.test(me) || !isObj(v)) continue
      const t: TransitionSettings = {}
      if (v.style === 'mix' || v.style === 'dip' || v.style === 'wipe') t.style = v.style
      if (typeof v.rateMs === 'number' && v.rateMs > 0 && v.rateMs <= 60_000) t.rateMs = v.rateMs
      if (typeof v.wipe === 'string' && (WIPE_PATTERNS as readonly string[]).includes(v.wipe)) t.wipe = v.wipe as WipePattern
      if (typeof v.dipSource === 'string' && matrix.byId.get(v.dipSource)?.source) t.dipSource = v.dipSource
      const e = v.easing
      if (
        isObj(e) &&
        (EASE_FAMILIES as string[]).includes(String(e.family)) &&
        (EASE_DIRECTIONS as string[]).includes(String(e.direction))
      ) {
        t.easing = { family: e.family as EaseFamily, direction: e.direction as EaseDirection }
      }
      if (Object.keys(t).length) tr[me] = t
    }
    if (Object.keys(tr).length) s.transitions = tr
  }
  if (isObj(raw.boxes)) {
    const bx: Record<string, BoxState> = {}
    for (const [id, v] of Object.entries(raw.boxes)) {
      if (!/^ss:\d+\/box:\d+$/.test(id) || !isObj(v)) continue
      const b: BoxState = {}
      if (typeof v.enabled === 'boolean') b.enabled = v.enabled
      if (typeof v.cropped === 'boolean') b.cropped = v.cropped
      for (const k of ['x', 'y', 'size', 'cropTop', 'cropBottom', 'cropLeft', 'cropRight'] as const) {
        const n = v[k]
        if (typeof n === 'number' && Number.isFinite(n)) b[k] = n
      }
      if (Object.keys(b).length) bx[id] = b
    }
    if (Object.keys(bx).length) s.boxes = bx
  }
  return Object.keys(s).length ? s : undefined
}

