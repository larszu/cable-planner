// ───────────────────────────────────────────────────────────────────────────
// Die Angaben zur Veranstaltung, aufgeloest je Ziel (Bedarf 88, P2).
//
// Die Begruendung, warum es dieses Objekt gibt und was es ausdruecklich NICHT
// tut, steht in `types/eventMetadata.ts` — hier steht, wie aufgeloest wird.
//
// ─── EINE ENGSTELLE ────────────────────────────────────────────────────────
//
// `resolveEventMetadata` ist die einzige Stelle, an der aus „das Projekt sagt
// X, das Ziel sagt Y" ein Wert wird. Blatt, Befunde und Oberflaeche gehen
// alle durch sie. Zwei Aufloesungen nebeneinander waeren genau das Problem,
// gegen das dieser Bedarf geschrieben ist: derselbe Titel, an zwei Stellen
// unterschiedlich hergeleitet.
//
// ─── JEDER WERT TRAEGT SEINE HERKUNFT ──────────────────────────────────────
//
// Nicht nur der Titel, sondern auch woher er kommt (`project` / `override` /
// `none`). Auf dem Blatt steht die Herkunft in einer eigenen Spalte, damit
// jemand, der abtippt, sieht, ob er gerade eine bewusste Abweichung eingibt
// oder den Projektwert — sonst korrigiert er sie „zurecht".
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import type { DeliveryDestination } from '../types/delivery'
import {
  EMPTY_EVENT_METADATA,
  PRIVACY_LABEL,
  type DestinationMetadataOverride,
  type EventMetadata,
  type EventMetadataPlan,
  type EventPrivacy,
} from '../types/eventMetadata'
import type { CsvTable } from './csv'

export type EventMetadataFindingKind =
  | 'no-metadata'
  | 'no-destinations'
  | 'title-missing'
  | 'start-missing'
  | 'start-timeless'
  | 'start-unzoned'
  | 'privacy-not-stated'
  | 'override-unexplained'
  | 'override-inert'
  | 'override-orphan'
  | 'backup-differs'

export const EVENT_METADATA_FINDING_LABEL: Readonly<
  Record<EventMetadataFindingKind, string>
> = {
  'no-metadata': 'Ziele stehen, Angaben fehlen ganz',
  'no-destinations': 'Angaben stehen, aber kein Ziel',
  'title-missing': 'Kein Titel für dieses Ziel',
  'start-missing': 'Kein geplanter Beginn',
  'start-timeless': 'Beginn nur als Datum, ohne Uhrzeit',
  'start-unzoned': 'Beginn ohne Zeitzone',
  'privacy-not-stated': 'Sichtbarkeit nicht angegeben',
  'override-unexplained': 'Abweichung ohne Begründung',
  'override-inert': 'Abweichung, die nichts abweicht',
  'override-orphan': 'Abweichung ohne Ziel',
  'backup-differs': 'Ausweichweg trägt andere Angaben als sein Primärweg',
}

export interface EventMetadataFinding {
  kind: EventMetadataFindingKind
  text: string
  /** Das betroffene Ziel, fuer den Sprung. Leer bei planweiten Befunden. */
  destinationId?: string
}

/** Woher ein aufgeloester Wert stammt. */
export type MetadataOrigin = 'project' | 'override' | 'none'

export interface ResolvedDestinationMetadata {
  destinationId: string
  destinationName: string
  platform: string
  title: string
  titleFrom: MetadataOrigin
  description: string
  descriptionFrom: MetadataOrigin
  privacy: EventPrivacy
  privacyFrom: MetadataOrigin
  /** Die Begruendung der Abweichung, falls eine hinterlegt ist. */
  reason?: string
}

export interface EventMetadataAssessment {
  plan: EventMetadataPlan
  resolved: ResolvedDestinationMetadata[]
  findings: EventMetadataFinding[]
}

const trimmed = (v: string | undefined): string => (typeof v === 'string' ? v.trim() : '')

/**
 * Traegt der Beginn eine Uhrzeit?
 *
 * `2026-09-12` nicht, `2026-09-12T19:00` schon. Der Unterschied ist keine
 * Formalie: ein Blatt, auf dem nur ein Datum steht, laesst die Uhrzeit im
 * Kopf desjenigen, der es abtippt.
 */
const hasTimePart = (iso: string): boolean => /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(iso)

/**
 * Traegt der Beginn einen Zonen-Offset?
 *
 * `Z` oder `+02:00` / `+0200` am Ende. Ohne ihn ist der Zeitpunkt mehrdeutig,
 * und genau diese Mehrdeutigkeit ist der teure Fehler aus dem Bedarf.
 */
const hasOffset = (iso: string): boolean => /(Z|[+-]\d{2}:?\d{2})$/.test(iso.trim())

/**
 * Die eine Aufloesung. Ein Ueberschreiben gewinnt NUR mit einem nicht-leeren
 * Wert: ein leer gelassenes Feld im Ueberschreiber heisst „hier nichts
 * anderes", nicht „hier nichts".
 */
export function resolveEventMetadata(
  event: EventMetadata,
  dest: DeliveryDestination,
  override: DestinationMetadataOverride | undefined,
): ResolvedDestinationMetadata {
  const pick = (
    fromOverride: string | undefined,
    fromProject: string | undefined,
  ): [string, MetadataOrigin] => {
    const o = trimmed(fromOverride)
    if (o) return [o, 'override']
    const p = trimmed(fromProject)
    if (p) return [p, 'project']
    return ['', 'none']
  }
  const [title, titleFrom] = pick(override?.title, event.title)
  const [description, descriptionFrom] = pick(override?.description, event.description)
  let privacy: EventPrivacy = event.privacy
  let privacyFrom: MetadataOrigin = event.privacy === 'not-stated' ? 'none' : 'project'
  if (override?.privacy && override.privacy !== 'not-stated') {
    privacy = override.privacy
    privacyFrom = 'override'
  }
  const reason = trimmed(override?.reason)
  return {
    destinationId: dest.id,
    destinationName: dest.name,
    platform: dest.platform,
    title,
    titleFrom,
    description,
    descriptionFrom,
    privacy,
    privacyFrom,
    ...(reason ? { reason } : {}),
  }
}

/** Aendert dieser Ueberschreiber ueberhaupt etwas am aufgeloesten Wert? */
const overrideChangesSomething = (r: ResolvedDestinationMetadata): boolean =>
  r.titleFrom === 'override' || r.descriptionFrom === 'override' || r.privacyFrom === 'override'

export function assessEventMetadata(project: CablePlannerProject): EventMetadataAssessment {
  const plan: EventMetadataPlan = project.eventMetadata ?? EMPTY_EVENT_METADATA
  const dests = project.deliveryDestinations ?? []
  const byId = new Map(dests.map((d) => [d.id, d]))
  const overrideFor = new Map(plan.overrides.map((o) => [o.destinationId, o]))
  const findings: EventMetadataFinding[] = []

  const resolved = dests.map((d) => resolveEventMetadata(plan.event, d, overrideFor.get(d.id)))
  const byDest = new Map(resolved.map((r) => [r.destinationId, r]))

  const start = trimmed(plan.event.scheduledStart)
  const eventIsEmpty =
    !trimmed(plan.event.title) &&
    !trimmed(plan.event.description) &&
    !start &&
    plan.event.privacy === 'not-stated' &&
    !trimmed(plan.event.thumbnailRef) &&
    (plan.event.tags ?? []).length === 0

  if (eventIsEmpty && plan.overrides.length === 0) {
    // Nur melden, wenn es ueberhaupt etwas zu betiteln gibt. Ein Projekt ohne
    // Ausspielung braucht keine Veranstaltungsangaben, und ein Befund waere
    // dort blosses Rauschen — der Grund, warum diese Bedingung nicht
    // umgedreht werden darf.
    if (dests.length > 0) {
      findings.push({
        kind: 'no-metadata',
        text: `${dests.length} Ausspielziel(e) stehen im Plan, aber keine Angaben zur Veranstaltung. Titel, Beginn und Sichtbarkeit werden dann am Showtag aus Mails zusammengesucht und je Plattform neu getippt.`,
      })
    }
  } else if (dests.length === 0) {
    findings.push({
      kind: 'no-destinations',
      text: 'Angaben zur Veranstaltung stehen, aber kein Ausspielziel. Das Blatt hat keine Spalte, in die jemand sie eintragen könnte.',
    })
  }

  if (!start) {
    if (dests.length > 0 && !eventIsEmpty) {
      findings.push({
        kind: 'start-missing',
        text: 'Kein geplanter Beginn hinterlegt. Jede Plattform verlangt einen, und ohne gemeinsame Angabe steht auf jeder eine andere Uhrzeit.',
      })
    }
  } else if (!hasTimePart(start)) {
    findings.push({
      kind: 'start-timeless',
      text: `Der Beginn ist nur als Datum angegeben („${start}"). Die Uhrzeit bleibt damit im Kopf dessen, der die Plattform-Formulare ausfüllt.`,
    })
  } else if (!hasOffset(start)) {
    findings.push({
      kind: 'start-unzoned',
      text: `Der Beginn „${start}" trägt keine Zeitzone. In YouTube Studio gilt die Zeitzone des Kanals, im CMS die des Servers, im Marketing-Kalender die des Verfassers — der Plan kann das nicht auflösen und rät hier bewusst nicht.`,
    })
  }

  for (const r of resolved) {
    if (!r.title) {
      findings.push({
        kind: 'title-missing',
        text: `„${r.destinationName}" hat keinen Titel — weder am Projekt noch als Abweichung.`,
        destinationId: r.destinationId,
      })
    }
    if (r.privacy === 'not-stated') {
      findings.push({
        kind: 'privacy-not-stated',
        text: `Die Sichtbarkeit von „${r.destinationName}" ist nicht angegeben. Ein Vorgabewert wird hier bewusst nicht gesetzt: „öffentlich" zu raten schaltet im Zweifel die Generalprobe ins Netz.`,
        destinationId: r.destinationId,
      })
    }
  }

  for (const o of plan.overrides) {
    const r = byDest.get(o.destinationId)
    if (!r) {
      findings.push({
        kind: 'override-orphan',
        text: `Eine Abweichung verweist auf ein Ziel, das es im Plan nicht (mehr) gibt (${o.destinationId}). Sie wird nicht still entfernt — ein kommentarlos verschwundener abweichender Titel ist schlimmer als eine Zeile, die ihn benennt.`,
        destinationId: o.destinationId,
      })
      continue
    }
    if (!overrideChangesSomething(r)) {
      findings.push({
        kind: 'override-inert',
        text: `„${r.destinationName}" trägt eine Abweichung, die nichts abweicht — alle Felder sind leer oder gleich dem Projektwert. Auf dem Blatt sieht das aus wie eine bewusste Sonderbehandlung.`,
        destinationId: r.destinationId,
      })
      continue
    }
    if (!r.reason) {
      findings.push({
        kind: 'override-unexplained',
        text: `„${r.destinationName}" weicht vom Projektwert ab, ohne Begründung. Ohne sie kann niemand später entscheiden, ob das Absicht war oder ein Tippfehler.`,
        destinationId: r.destinationId,
      })
    }
  }

  // Der Ausweichweg gegen seinen Primaerweg. Bei YouTube ist der Backup-Ingest
  // DIESELBE Veranstaltung — ein abweichender Titel heisst dort, dass jemand
  // versehentlich ein zweites Event angelegt hat.
  for (const d of dests) {
    if (!d.backupOfId) continue
    const primary = byId.get(d.backupOfId)
    const rb = byDest.get(d.id)
    const rp = primary ? byDest.get(primary.id) : undefined
    if (!primary || !rb || !rp) continue
    const differs: string[] = []
    if (rb.title !== rp.title) differs.push('Titel')
    if (rb.privacy !== rp.privacy) differs.push('Sichtbarkeit')
    if (differs.length === 0) continue
    findings.push({
      kind: 'backup-differs',
      text: `„${d.name}" ist der Ausweichweg für „${primary.name}", trägt aber ${differs.join(' und ')} anders. Wo der Ausweichweg derselben Veranstaltung gilt (YouTube-Backup-Ingest), heißt das, dass zwei Veranstaltungen entstanden sind statt einer.`,
      destinationId: d.id,
    })
  }

  return { plan, resolved, findings }
}

// Kanonische deutsche Ersatztexte. Sie stehen HIER und nicht in der
// Oberflaeche: das Blatt traegt einen Stand, und ein Text, der mit der
// eingestellten Sprache wechselt, meldete jedes gedruckte Exemplar als
// veraltet.
const NO_TITLE = 'kein Titel'
const NO_START = 'kein Beginn'
const NO_ZONE = 'ohne Zeitzone'
const NO_THUMB = 'nicht benannt'
const NO_TAGS = 'keine'
const NO_REASON = 'ohne Begründung'
const NOT_DEVIATING = '—'

const ORIGIN_LABEL: Readonly<Record<MetadataOrigin, string>> = {
  project: 'Projekt',
  override: 'Abweichung',
  none: 'nirgends',
}

/**
 * Das Blatt zum Abtippen — eine Zeile je Ziel.
 *
 * Jede leere Zelle traegt einen NAMEN. Eine leere Zelle auf einem gedruckten
 * Blatt liest sich als „nichts einzutragen"; „kein Titel" liest sich als
 * Auftrag.
 */
export function eventMetadataTable(project: CablePlannerProject): CsvTable {
  const a = assessEventMetadata(project)
  const ev = a.plan.event
  const start = trimmed(ev.scheduledStart)
  const zone = trimmed(ev.timezone)
  const thumb = trimmed(ev.thumbnailRef) || NO_THUMB
  const tags = (ev.tags ?? []).join(', ') || NO_TAGS
  const startCell = start || NO_START
  const zoneCell = zone || (start && hasOffset(start) ? 'Offset im Zeitpunkt' : NO_ZONE)
  return {
    headers: [
      'Ziel',
      'Plattform',
      'Titel',
      'Titel aus',
      'Sichtbarkeit',
      'Sichtbarkeit aus',
      'Beginn',
      'Angesagt in',
      'Thumbnail',
      'Schlagworte',
      'Abweichung begründet',
    ],
    rows: a.resolved.map((r) => [
      r.destinationName,
      r.platform,
      r.title || NO_TITLE,
      ORIGIN_LABEL[r.titleFrom],
      PRIVACY_LABEL[r.privacy],
      ORIGIN_LABEL[r.privacyFrom],
      startCell,
      zoneCell,
      thumb,
      tags,
      overrideChangesSomething(r) ? (r.reason ?? NO_REASON) : NOT_DEVIATING,
    ]),
  }
}

/**
 * Normalisiert die gespeicherten Angaben beim Laden.
 *
 * Verworfen wird nur, was unlesbar ist: eine Abweichung ohne Ziel-Id kann
 * nichts ueberschreiben. Eine Abweichung auf ein GELOESCHTES Ziel bleibt —
 * dafuer gibt es `override-orphan`, und sie hier wegzuwerfen hiesse, einen
 * abweichenden Titel spurlos verschwinden zu lassen. Dieselbe Regel wie bei
 * `encoderEquipmentId` in Bedarf 32.
 */
export function normaliseEventMetadata(
  raw: unknown,
  onDrop?: (d: { reason: 'missing-required' | 'duplicate-id'; label: string }) => void,
): EventMetadataPlan | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined
  const privacyOf = (v: unknown): EventPrivacy | undefined =>
    v === 'public' || v === 'unlisted' || v === 'private' || v === 'not-stated' ? v : undefined

  const rawEvent = (o.event ?? {}) as Record<string, unknown>
  const event: EventMetadata = { privacy: privacyOf(rawEvent.privacy) ?? 'not-stated' }
  const title = str(rawEvent.title)
  if (title) event.title = title
  const description = str(rawEvent.description)
  if (description) event.description = description
  const scheduledStart = str(rawEvent.scheduledStart)
  if (scheduledStart) event.scheduledStart = scheduledStart
  const timezone = str(rawEvent.timezone)
  if (timezone) event.timezone = timezone
  const thumbnailRef = str(rawEvent.thumbnailRef)
  if (thumbnailRef) event.thumbnailRef = thumbnailRef
  const tags = (Array.isArray(rawEvent.tags) ? rawEvent.tags : [])
    .map((t) => str(t))
    .filter((t): t is string => !!t)
  if (tags.length > 0) event.tags = [...new Set(tags)]

  const seen = new Set<string>()
  const overrides: DestinationMetadataOverride[] = []
  for (const rawO of Array.isArray(o.overrides) ? o.overrides : []) {
    const r = (rawO ?? {}) as Record<string, unknown>
    const destinationId = str(r.destinationId)
    if (!destinationId) {
      onDrop?.({ reason: 'missing-required', label: str(r.title) ?? '' })
      continue
    }
    if (seen.has(destinationId)) {
      onDrop?.({ reason: 'duplicate-id', label: destinationId })
      continue
    }
    seen.add(destinationId)
    const out: DestinationMetadataOverride = { destinationId }
    const oTitle = str(r.title)
    if (oTitle) out.title = oTitle
    const oDesc = str(r.description)
    if (oDesc) out.description = oDesc
    const oPrivacy = privacyOf(r.privacy)
    if (oPrivacy && oPrivacy !== 'not-stated') out.privacy = oPrivacy
    const oReason = str(r.reason)
    if (oReason) out.reason = oReason
    overrides.push(out)
  }

  // Ein Objekt ohne alles traegt nichts — Ballast in jedem Projektfile, das
  // den Dialog einmal geoeffnet hat.
  const empty =
    !event.title &&
    !event.description &&
    !event.scheduledStart &&
    !event.timezone &&
    !event.thumbnailRef &&
    !event.tags &&
    event.privacy === 'not-stated' &&
    overrides.length === 0
  if (empty) return undefined
  return { event, overrides }
}
