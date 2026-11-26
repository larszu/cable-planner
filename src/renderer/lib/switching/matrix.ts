// ───────────────────────────────────────────────────────────────────────────
// Kreuzschiene mit Ebenen (#1240, Stufe 1).
//
// Bisher kannte der Plan nur `Ziel -> Quelle` auf EINER Ebene. Eine echte
// Kreuzschiene fuehrt Video, Audio, Daten getrennt; ein Kreuzpunkt auf allen
// Ebenen ist der Normalfall, einer auf nur einer Ebene ein Breakaway.
// Dazu Salvo (benannte Menge, ein Ausloeser), Take-Modus (vormerken, dann
// gemeinsam schalten) und Sperren (lock: niemand; protect: nur mit Absicht).
//
// Die Ebene `video` liegt am Geraet in `plannedCrosspoints`/`videohubRouting`
// (dort liest sie der Signalweg); die uebrigen Ebenen in `switching.levels`.
// Diese Datei rechnet nur mit `MatrixState` und weiss davon nichts — die
// Abbildung macht `routerMatrixOf` / `routerPatch`.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentItem } from '../../types/equipment'
import { deviceCrosspoints } from '../deviceCrosspoints'
import type { LockKind, SwitchingProfile, SwitchingSalvo } from './types'

export const VIDEO_LEVEL = 'video'

export interface MatrixState {
  /** `level -> ziel -> quelle` */
  levels: Record<string, Record<string, string>>
  pending: Record<string, Record<string, string>>
  locks: Record<string, LockKind>
}

export interface CrosspointRequest {
  dest: string
  /** Leer = Kreuzpunkt loesen. */
  source?: string
  /** Eine Ebene (Breakaway) oder alle Ebenen des Profils. */
  level: string | 'all'
  /** Im Take-Modus nur vormerken. */
  preset?: boolean
  /** Ein geschuetztes Ziel absichtlich schalten. */
  override?: boolean
}

export type CrosspointRefusal = 'locked' | 'protected'

export interface CrosspointResult {
  state: MatrixState
  refused?: CrosspointRefusal
}

const levelIds = (profile: SwitchingProfile | null | undefined): string[] =>
  profile?.levels?.length ? profile.levels.map((l) => l.id) : [VIDEO_LEVEL]

const withEntry = (table: Record<string, string> | undefined, dest: string, source: string | undefined) => {
  const t = { ...(table ?? {}) }
  if (source) t[dest] = source
  else delete t[dest]
  return t
}

export const setCrosspoint = (
  state: MatrixState,
  profile: SwitchingProfile | null | undefined,
  req: CrosspointRequest,
): CrosspointResult => {
  const lock = state.locks[req.dest]
  if (lock === 'lock') return { state, refused: 'locked' }
  if (lock === 'protect' && !req.override) return { state, refused: 'protected' }
  const levels = req.level === 'all' ? levelIds(profile) : [req.level]
  const key = req.preset ? 'pending' : 'levels'
  const next = { ...state[key] }
  for (const l of levels) next[l] = withEntry(next[l], req.dest, req.source)
  return { state: { ...state, [key]: next } }
}

/** Alle vorgemerkten Kreuzpunkte gemeinsam schalten. Gesperrte Ziele bleiben stehen. */
export const take = (state: MatrixState): { state: MatrixState; refused: string[] } => {
  const levels = { ...state.levels }
  const refused: string[] = []
  for (const [level, table] of Object.entries(state.pending)) {
    for (const [dest, src] of Object.entries(table)) {
      if (state.locks[dest]) {
        refused.push(dest)
        continue
      }
      levels[level] = withEntry(levels[level], dest, src)
    }
  }
  return { state: { ...state, levels, pending: {} }, refused }
}

/** Einen Salvo ausloesen: sofort oder (Take-Modus) vorgemerkt. */
export const applySalvo = (state: MatrixState, salvo: SwitchingSalvo, preset = false) => {
  const key = preset ? 'pending' : 'levels'
  const next = { ...state[key] }
  const refused: string[] = []
  for (const [level, table] of Object.entries(salvo.crosspoints)) {
    for (const [dest, src] of Object.entries(table)) {
      if (state.locks[dest]) {
        refused.push(dest)
        continue
      }
      next[level] = withEntry(next[level], dest, src)
    }
  }
  return { state: { ...state, [key]: next }, refused }
}

/** Den aktuellen Stand als Salvo festhalten. */
export const salvoFromState = (state: MatrixState, id: string, name: string): SwitchingSalvo => ({
  id,
  name,
  crosspoints: Object.fromEntries(Object.entries(state.levels).map(([l, t]) => [l, { ...t }])),
})

/** Liegen auf diesem Ziel je Ebene verschiedene Quellen? */
export const isBreakaway = (state: MatrixState, dest: string): boolean => {
  const srcs = new Set(Object.values(state.levels).map((t) => t[dest] ?? ''))
  return srcs.size > 1
}

// ─── Abbildung auf das Geraet ───────────────────────────────────────────

/** Matrix-Zustand einer Kreuzschiene, Port-IDs als Ziel und Quelle. */
export const routerMatrixOf = (device: EquipmentItem): MatrixState => {
  const s = device.switching ?? {}
  const video: Record<string, string> = {}
  for (const [out, inp] of deviceCrosspoints(device)) video[out] = inp
  return {
    levels: { ...(s.levels ?? {}), [VIDEO_LEVEL]: video },
    pending: s.pending ?? {},
    locks: s.locks ?? {},
  }
}

/**
 * Den Patch fuer einen neuen Matrix-Zustand. Video geht in die Index-Tabelle
 * `videohubRouting.planned` — die liest der Videohub-Export, die Salvo-Liste
 * und der Signalweg schon. Weil der ganze Video-Stand dort steht, faellt
 * `plannedCrosspoints` weg: es gewaenne sonst je Ausgang und braechte einen
 * geloesten Kreuzpunkt zurueck. Die anderen Ebenen gehen nach
 * `switching.levels`.
 */
export const routerPatch = (
  device: EquipmentItem,
  state: MatrixState,
): Pick<EquipmentItem, 'switching' | 'plannedCrosspoints' | 'videohubRouting'> => {
  const { [VIDEO_LEVEL]: video = {}, ...rest } = state.levels
  const outIdx = new Map(device.outputs.map((p, i) => [p.id, i]))
  const inIdx = new Map(device.inputs.map((p, i) => [p.id, i]))
  const planned: Record<number, number> = {}
  for (const [out, inp] of Object.entries(video)) {
    const o = outIdx.get(out)
    const i = inIdx.get(inp)
    if (o !== undefined && i !== undefined) planned[o] = i
  }
  const switching = { ...(device.switching ?? {}) }
  if (Object.keys(rest).length) switching.levels = rest
  else delete switching.levels
  if (Object.keys(state.pending).length) switching.pending = state.pending
  else delete switching.pending
  if (Object.keys(state.locks).length) switching.locks = state.locks
  else delete switching.locks
  return {
    switching,
    plannedCrosspoints: undefined,
    videohubRouting: { planned, salvos: device.videohubRouting?.salvos ?? [] },
  }
}
