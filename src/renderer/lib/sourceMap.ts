// ───────────────────────────────────────────────────────────────────────────
// ADR-001, Inkrement 3 — `.avsourcemap`, das Austauschformat der Identitaet.
//
// WOFUER. Der `.avplan` traegt das ganze Projekt und ist fuer die Planungs-
// Apps gedacht. Der Konsument der Identitaet ist aber eine RUNTIME — ein
// Tally-Rechner, ein UMD-Sender, ein Aufnahme-Controller —, und die soll
// nicht ein komplettes Kabelprojekt parsen muessen, um zu erfahren, dass
// „Kamera 1" auf ATEM-Eingang 3 liegt und ihr Display die UMD-Adresse 3 hat.
// Deshalb ein eigenes, flaches, kleines Format.
//
// WAS DRINSTEHT. Die Rollen (`SourceIdentity`) mit ihren Ankern, dazu je
// Rolle die ABGELEITETE Bindung: welches Geraet sie realisiert, welchen
// Mischer es auf welchem Eingang speist, und was die Zielsysteme nach ihren
// Zeichenbudgets tatsaechlich anzeigen. Die Ableitung wird mitgeschrieben,
// nicht die Quelle der Ableitung: Der Empfaenger soll nicht den Kabelgraph
// nachbauen muessen.
//
// ZWEI REGELN AUS DER STRATEGIE, hier woertlich umgesetzt:
//
// 1. PROVENIENZ PRO WERT. Jeder Anker sagt, woher er kommt: `planned` (aus
//    der Planung), `commanded` (an ein Geraet geschickt), `confirmed` (vom
//    Geraet zurueckgemeldet). Der Cable-Planner schreibt ausschliesslich
//    `planned` — er plant, er misst nicht. Eine Runtime, die zurueckschreibt,
//    setzt `confirmed`. Damit kann keine Oberflaeche einen unbestaetigten
//    Wert als Tatsache zeigen.
//
// 2. VERWEIGERUNG STATT STILLEN VERLUSTS. Was der Plan nicht beantwortet,
//    steht in `unresolved` — es wird nicht weggelassen. Und was eine fremde
//    Datei mitbringt und wir nicht kennen, bleibt beim Lesen als `extra`
//    erhalten, statt beim naechsten Schreiben zu verschwinden.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import type { SourceIdentity } from '../types/sourceIdentity'
import { deriveLabels, type UnansweredAnchor } from './labelDerivation'
import type { LabelTargetId } from './labelTargets'
import { LABEL_TARGETS, fitToTarget } from './labelTargets'
import { UMD_ADDRESS_MAX, UMD_ADDRESS_MIN, isValidUmdAddress } from './sourceIdentity'

export const SOURCE_MAP_KIND = 'av-source-map' as const
export const SOURCE_MAP_VERSION = 1 as const

/** Woher ein Wert stammt — nie raten, nie als Tatsache zeigen, was geplant ist. */
export type ValueProvenance = 'planned' | 'commanded' | 'confirmed'

export interface SourceMapBinding {
  /** Geraet, das die Rolle realisiert. */
  equipmentId: string
  equipmentName: string
  /** Mischer/Router, den es speist — fehlt, wenn nichts verkabelt ist. */
  sinkEquipmentId?: string
  sinkName?: string
  /** 1-basierte Eingangsnummer: damit adressiert der Mischer auf dem Draht. */
  input?: number
  /** Zwischengeraete auf dem Weg (0 = direkt verkabelt). */
  hops?: number
}

export interface SourceMapEntry {
  id: string
  name: string
  number?: number
  umdAddress?: number
  /** Provenienz je Feldname. Fehlt ein Eintrag, gilt der Wert als ungeprueft. */
  provenance: Partial<Record<'name' | 'number' | 'umdAddress', ValueProvenance>>
  bindings: SourceMapBinding[]
  /** Was das jeweilige Zielsystem nach seinem Zeichenbudget wirklich zeigt. */
  labels: Partial<Record<LabelTargetId, string>>
  /** Felder einer fremden Datei, die wir nicht kennen — bleiben erhalten. */
  extra?: Record<string, unknown>
}

export interface SourceMapUnresolved {
  field: string
  equipmentId: string
  where: string
  reason: string
}

export interface SourceMap {
  kind: typeof SOURCE_MAP_KIND
  formatVersion: typeof SOURCE_MAP_VERSION
  app: string
  appVersion: string
  exportedAt: string
  sources: SourceMapEntry[]
  /** Was der Plan nicht beantwortet. Steht ausdruecklich drin. */
  unresolved: SourceMapUnresolved[]
  extra?: Record<string, unknown>
}

const KNOWN_ENTRY_KEYS = new Set([
  'id',
  'name',
  'number',
  'umdAddress',
  'provenance',
  'bindings',
  'labels',
  'extra',
])

const KNOWN_ROOT_KEYS = new Set([
  'kind',
  'formatVersion',
  'app',
  'appVersion',
  'exportedAt',
  'sources',
  'unresolved',
  'extra',
])

const collectExtra = (
  raw: Record<string, unknown>,
  known: ReadonlySet<string>,
): Record<string, unknown> | undefined => {
  const extra: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!known.has(key)) extra[key] = value
  }
  return Object.keys(extra).length > 0 ? extra : undefined
}

/**
 * Baut die Karte aus dem Projekt.
 *
 * `sources` sind die ROLLEN, nicht die Geraete. Ein Plan ohne Rollen liefert
 * eine leere Liste — und das ist die richtige Antwort, nicht ein Fehler: Das
 * Format transportiert Identitaet, und ohne Rolle gibt es keine. Was dabei
 * offen bleibt, steht dann umso deutlicher in `unresolved`.
 */
/**
 * ADR-005, Inkrement 4 — was beim Schreiben nicht abgebildet werden konnte.
 *
 * Die Import-Seite hat so einen Kanal laengst (`SourceMapMergeResult`), die
 * Export-Seite hatte keinen: `buildSourceMap` gab nur die Datei zurueck, und
 * was dabei flach fiel, fiel still.
 */
export interface SourceMapBuildResult {
  map: SourceMap
  /**
   * Rollen mit MEHR ALS EINEM Geraet. `labels` steht einmal je Rolle, wird
   * aber in der Schleife ueber die Geraete beschrieben — es ueberlebt also
   * nur das zuletzt gelesene, und welches das ist, entscheidet die
   * Reihenfolge in `project.equipment`.
   *
   * Der Typ verspricht „was das jeweilige Zielsystem nach seinem
   * Zeichenbudget wirklich zeigt". Bei einer Rolle mit Haupt- und
   * Backup-Kamera auf zwei ATEM-Eingaengen zeigt es zwei verschiedene
   * Beschriftungen — in der Datei steht eine davon, ohne Hinweis darauf,
   * welche. Beim Namen genannt, statt still das letzte zu behaupten.
   *
   * Die Datei RICHTIG zu machen hiesse, `labels` in die `bindings` zu ziehen
   * (dort steht die Geraete-Id ohnehin) — das aendert das Draht-Format und
   * ist deshalb eine Entscheidung, die nicht hierher gehoert.
   */
  ambiguousLabels: Array<{ name: string; devices: string[] }>
}

export const buildSourceMap = (
  project: Pick<CablePlannerProject, 'equipment' | 'cables' | 'sourceIdentities'>,
  meta: { app?: string; appVersion: string; exportedAt: string },
): SourceMapBuildResult => {
  const identities: SourceIdentity[] = project.sourceIdentities ?? []
  const { candidates, sources, unanswered } = deriveLabels({
    equipment: project.equipment,
    cables: project.cables,
    sourceIdentities: identities,
  })
  const eqById = new Map(project.equipment.map((e) => [e.id, e]))
  const candidateByKey = new Map(candidates.map((c) => [c.key, c]))

  /** Was beim Ziel wirklich ankommt — inklusive Zuschnitt aufs Budget. */
  const fitted = (key: string, target: LabelTargetId): string | undefined => {
    const candidate = candidateByKey.get(key)
    if (!candidate) return undefined
    const value = fitToTarget(candidate.raw, LABEL_TARGETS[target]).value
    return value || undefined
  }

  const ambiguousLabels: SourceMapBuildResult['ambiguousLabels'] = []

  const entries: SourceMapEntry[] = identities.map((identity) => {
    const devices = project.equipment.filter((e) => e.sourceIdentityId === identity.id)
    // ADR-005 — `labels` unten ist EIN Objekt je Rolle, beschrieben in der
    // Schleife ueber die Geraete. Bei mehreren Geraeten ueberlebt nur das
    // letzte. Melden statt behaupten.
    if (devices.length > 1) {
      ambiguousLabels.push({ name: identity.name, devices: devices.map((d) => d.name) })
    }
    const labels: Partial<Record<LabelTargetId, string>> = {}
    const bindings: SourceMapBinding[] = devices.map((device) => {
      const link = sources.find((s) => s.sourceEquipmentId === device.id)
      if (link) {
        const long = fitted(`atem-long:${link.sinkPortId}`, 'atem-input-long')
        const short = fitted(`atem-short:${link.sinkPortId}`, 'atem-input-short')
        if (long) labels['atem-input-long'] = long
        if (short) labels['atem-input-short'] = short
      }
      const umd = fitted(`umd:${device.id}`, 'tsl-umd-v31')
      if (umd) labels['tsl-umd-v31'] = umd
      const sink = link ? eqById.get(link.sinkEquipmentId) : undefined
      return {
        equipmentId: device.id,
        equipmentName: device.name,
        ...(sink ? { sinkEquipmentId: sink.id, sinkName: sink.name } : {}),
        ...(link ? { input: link.inputIndex, hops: link.hops } : {}),
      }
    })

    const provenance: SourceMapEntry['provenance'] = { name: 'planned' }
    if (identity.number !== undefined) provenance.number = 'planned'
    if (identity.umdAddress !== undefined) provenance.umdAddress = 'planned'

    return {
      id: identity.id,
      name: identity.name,
      ...(identity.number !== undefined ? { number: identity.number } : {}),
      ...(identity.umdAddress !== undefined ? { umdAddress: identity.umdAddress } : {}),
      provenance,
      bindings,
      labels,
    }
  })

  const map: SourceMap = {
    kind: SOURCE_MAP_KIND,
    formatVersion: SOURCE_MAP_VERSION,
    app: meta.app ?? 'cable-planner',
    appVersion: meta.appVersion,
    exportedAt: meta.exportedAt,
    sources: entries,
    unresolved: unanswered.map((u: UnansweredAnchor) => ({
      field: u.field,
      equipmentId: u.equipmentId,
      where: u.where,
      reason: u.reason,
    })),
  }
  return { map, ambiguousLabels }
}

// ── Lesen ────────────────────────────────────────────────────────────────────

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined

const asProvenance = (value: unknown): ValueProvenance | undefined =>
  value === 'planned' || value === 'commanded' || value === 'confirmed' ? value : undefined

/**
 * Liest eine `.avsourcemap`. Wirft nur, wenn die Datei gar keine ist — ein
 * einzelner kaputter Eintrag laesst den Rest stehen, weil ein halber Import
 * immer noch besser ist als gar keiner, solange klar bleibt, was fehlt.
 *
 * Unbekannte Felder werden NICHT weggeworfen, sondern in `extra` gehoben.
 * Wer die Datei weiterreicht, verliert nichts; wer sie importiert, bekommt
 * ueber `mergeSourceMap` gesagt, was hier keinen Platz hat.
 */
export const parseSourceMap = (text: string): SourceMap => {
  const data = asRecord(JSON.parse(text))
  if (!data || data.kind !== SOURCE_MAP_KIND) {
    throw new Error('Keine gueltige .avsourcemap-Datei (kind != av-source-map).')
  }
  const version = data.formatVersion
  if (typeof version !== 'number' || version > SOURCE_MAP_VERSION) {
    throw new Error(
      `.avsourcemap-Version ${String(version)} ist neuer als unterstuetzt (${SOURCE_MAP_VERSION}).`,
    )
  }

  const rawSources = Array.isArray(data.sources) ? data.sources : []
  const sources: SourceMapEntry[] = []
  rawSources.forEach((raw, idx) => {
    const r = asRecord(raw)
    if (!r) return
    const name = asString(r.name)
    if (!name) return
    const rawProv = asRecord(r.provenance) ?? {}
    const provenance: SourceMapEntry['provenance'] = {}
    for (const field of ['name', 'number', 'umdAddress'] as const) {
      const p = asProvenance(rawProv[field])
      if (p) provenance[field] = p
    }
    const entry: SourceMapEntry = {
      id: asString(r.id) ?? `source-${idx + 1}`,
      name,
      provenance,
      bindings: Array.isArray(r.bindings) ? (r.bindings as SourceMapBinding[]) : [],
      labels: (asRecord(r.labels) ?? {}) as SourceMapEntry['labels'],
    }
    if (typeof r.number === 'number' && Number.isInteger(r.number) && r.number >= 0) {
      entry.number = r.number
    }
    if (typeof r.umdAddress === 'number') entry.umdAddress = r.umdAddress
    const extra = collectExtra(r, KNOWN_ENTRY_KEYS)
    if (extra) entry.extra = extra
    sources.push(entry)
  })

  const map: SourceMap = {
    kind: SOURCE_MAP_KIND,
    formatVersion: SOURCE_MAP_VERSION,
    app: asString(data.app) ?? 'unbekannt',
    appVersion: asString(data.appVersion) ?? '',
    exportedAt: asString(data.exportedAt) ?? '',
    sources,
    unresolved: Array.isArray(data.unresolved)
      ? (data.unresolved as SourceMapUnresolved[])
      : [],
  }
  const rootExtra = collectExtra(data, KNOWN_ROOT_KEYS)
  if (rootExtra) map.extra = rootExtra
  return map
}

// ── Zusammenfuehren ──────────────────────────────────────────────────────────

export interface SourceMapConflict {
  name: string
  field: string
  mine: string
  theirs: string
}

export interface SourceMapRejection {
  name: string
  field: string
  value: string
  reason: string
}

export interface SourceMapMergeResult {
  identities: SourceIdentity[]
  /** Rollen, die es hier noch nicht gab. */
  added: string[]
  /** Felder, die eine Luecke geschlossen haben — „Rolle · Feld". */
  filled: string[]
  /** Wo beide Seiten etwas ANDERES sagen. Wird NICHT ueberschrieben. */
  conflicts: SourceMapConflict[]
  /** Werte, die das Protokoll gar nicht kennt — nicht uebernommen, aber
   *  benannt. Eine Adresse ausserhalb 0–126 laesst das Display leer. */
  rejected: SourceMapRejection[]
  /** Felder der Datei, fuer die es hier kein Feld gibt — beim Namen genannt,
   *  statt still verschluckt. */
  unrepresented: string[]
}

/**
 * Fuehrt eine gelesene Karte mit den vorhandenen Rollen zusammen.
 *
 * REGEL: Der Import FUELLT nur Luecken. Wo hier schon ein anderer Wert steht,
 * wird nichts ueberschrieben — er landet in `conflicts` und der Mensch
 * entscheidet. Ein Import, der stillschweigend die Tally-Adresse aendert, ist
 * genau die Sorte Automatik, die im Betrieb niemand zurueckverfolgen kann.
 *
 * Was die Datei mitbringt und wofuer es hier kein Feld gibt, steht in
 * `unrepresented`. Gespeichert werden kann es nicht — aber verschwiegen wird
 * es auch nicht.
 */
export const mergeSourceMap = (
  existing: SourceIdentity[],
  map: SourceMap,
): SourceMapMergeResult => {
  const byId = new Map(existing.map((s) => [s.id, s]))
  const identities = existing.map((s) => ({ ...s }))
  const indexById = new Map(identities.map((s, i) => [s.id, i]))
  const added: string[] = []
  const filled: string[] = []
  const conflicts: SourceMapConflict[] = []
  const rejected: SourceMapRejection[] = []
  const unrepresented: string[] = []

  /** Uebernommen wird nur, was das Zielprotokoll auch senden kann. */
  const acceptedUmd = (entry: SourceMapEntry): number | undefined => {
    if (entry.umdAddress === undefined) return undefined
    if (isValidUmdAddress(entry.umdAddress)) return entry.umdAddress
    rejected.push({
      name: entry.name,
      field: 'umdAddress',
      value: String(entry.umdAddress),
      reason: `TSL UMD v3.1 kennt nur ganze Adressen ${UMD_ADDRESS_MIN}–${UMD_ADDRESS_MAX}`,
    })
    return undefined
  }

  if (map.extra) {
    for (const key of Object.keys(map.extra)) unrepresented.push(key)
  }

  for (const entry of map.sources) {
    if (entry.extra) {
      for (const key of Object.keys(entry.extra)) unrepresented.push(`${entry.name}.${key}`)
    }
    // ADR-005 — Blindstelle des extra-Fachs: `provenance` ist ein BEKANNTER
    // Schluessel, also hebt `collectExtra` ihn nicht auf, und der Plan hat kein
    // Feld dafuer (SourceIdentity ist bewusst minimal, siehe ADR-001). Ein von
    // einer Runtime als `confirmed` gemeldeter Wert kommt damit als `planned`
    // wieder heraus. Ein Schluessel, dessen Namen wir kennen und den wir
    // trotzdem nicht halten koennen, ist schlimmer als ein unbekannter — der
    // Mechanismus geht ueber ihn hinweg, statt ihn aufzufangen. Also melden.
    for (const [field, prov] of Object.entries(entry.provenance ?? {})) {
      if (prov && prov !== 'planned') {
        unrepresented.push(`${entry.name}.provenance.${field} (${prov})`)
      }
    }
    const mine = byId.get(entry.id)
    if (!mine) {
      const next: SourceIdentity = { id: entry.id, name: entry.name }
      if (entry.number !== undefined) next.number = entry.number
      const umd = acceptedUmd(entry)
      if (umd !== undefined) next.umdAddress = umd
      identities.push(next)
      indexById.set(next.id, identities.length - 1)
      byId.set(next.id, next)
      added.push(entry.name)
      continue
    }

    const idx = indexById.get(entry.id)
    if (idx === undefined) continue
    const target = identities[idx]

    const reconcile = (
      field: 'name' | 'number' | 'umdAddress',
      theirs: string | number | undefined,
    ) => {
      if (theirs === undefined) return
      const current = target[field]
      if (current === undefined) {
        // Zuweisung ueber den Feldnamen, damit die drei Faelle nicht
        // dreimal denselben Rumpf brauchen.
        ;(target as Record<string, unknown>)[field] = theirs
        filled.push(`${entry.name} · ${field}`)
        return
      }
      if (current !== theirs) {
        conflicts.push({
          name: entry.name,
          field,
          mine: String(current),
          theirs: String(theirs),
        })
      }
    }

    reconcile('name', entry.name)
    reconcile('number', entry.number)
    reconcile('umdAddress', acceptedUmd(entry))
  }

  return { identities, added, filled, conflicts, rejected, unrepresented }
}
