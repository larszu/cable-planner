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

import { befund, satz, undListe, type Satz } from './satz'
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
import { kanonisch, spalten } from './kanonisch'

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
  'no-metadata': 'Destinations set, details missing entirely',
  'no-destinations': 'Details set, but no destination',
  'title-missing': 'No title for this destination',
  'start-missing': 'No planned start',
  'start-timeless': 'Start given as a date only, without a time',
  'start-unzoned': 'Start without a time zone',
  'privacy-not-stated': 'Visibility not stated',
  'override-unexplained': 'Override without a reason',
  'override-inert': 'Override that changes nothing',
  'override-orphan': 'Override without a destination',
  'backup-differs': 'Backup path carries different details than its primary',
}

export interface EventMetadataFinding {
  kind: EventMetadataFindingKind
  text: string
  satz?: Satz
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
        ...befund(
          satz(
            'event.text.noMetadata',
            '{n} delivery destination(s) are in the plan, but no event details. Title, start and visibility are then pieced together from e-mails on show day and retyped per platform.',
            { n: dests.length },
          ),
        ),
      })
    }
  } else if (dests.length === 0) {
    findings.push({
      kind: 'no-destinations',
      ...befund(
        satz(
          'event.text.noDestinations',
          'Event details are set, but no delivery destination. The sheet has no column anyone could enter them in.',
        ),
      ),
    })
  }

  if (!start) {
    if (dests.length > 0 && !eventIsEmpty) {
      findings.push({
        kind: 'start-missing',
        ...befund(
          satz(
            'event.text.startMissing',
            'No planned start is stored. Every platform requires one, and without a shared value each shows a different time.',
          ),
        ),
      })
    }
  } else if (!hasTimePart(start)) {
    findings.push({
      kind: 'start-timeless',
      ...befund(
        satz(
          'event.text.startTimeless',
          'The start is given only as a date ("{beginn}"). The time therefore stays in the head of whoever fills in the platform forms.',
          { beginn: start },
        ),
      ),
    })
  } else if (!hasOffset(start)) {
    findings.push({
      kind: 'start-unzoned',
      ...befund(
        satz(
          'event.text.startUnzoned',
          'The start "{beginn}" carries no time zone. In YouTube Studio the time zone of the channel applies, in the CMS that of the server, in the marketing calendar that of the author — the plan cannot resolve that and deliberately does not guess.',
          { beginn: start },
        ),
      ),
    })
  }

  for (const r of resolved) {
    if (!r.title) {
      findings.push({
        kind: 'title-missing',
        ...befund(
          satz(
            'event.text.titleMissing',
            '"{ziel}" has no title — neither on the project nor as an override.',
            { ziel: r.destinationName },
          ),
        ),
        destinationId: r.destinationId,
      })
    }
    if (r.privacy === 'not-stated') {
      findings.push({
        kind: 'privacy-not-stated',
        ...befund(
          satz(
            'event.text.privacyNotStated',
            'The visibility of "{ziel}" is not stated. No default is set here on purpose: guessing "public" can put the dress rehearsal online.',
            { ziel: r.destinationName },
          ),
        ),
        destinationId: r.destinationId,
      })
    }
  }

  for (const o of plan.overrides) {
    const r = byDest.get(o.destinationId)
    if (!r) {
      findings.push({
        kind: 'override-orphan',
        ...befund(
          satz(
            'event.text.overrideOrphan',
            'An override refers to a destination that does not exist in the plan (any more) ({id}). It is not silently removed — an override title that vanished without comment is worse than a line that names it.',
            { id: o.destinationId },
          ),
        ),
        destinationId: o.destinationId,
      })
      continue
    }
    if (!overrideChangesSomething(r)) {
      findings.push({
        kind: 'override-inert',
        ...befund(
          satz(
            'event.text.overrideInert',
            '"{ziel}" carries an override that overrides nothing — all fields are empty or equal to the project value. On the sheet it looks like a deliberate special case.',
            { ziel: r.destinationName },
          ),
        ),
        destinationId: r.destinationId,
      })
      continue
    }
    if (!r.reason) {
      findings.push({
        kind: 'override-unexplained',
        ...befund(
          satz(
            'event.text.overrideUnexplained',
            '"{ziel}" deviates from the project value without a reason. Without one, nobody can later decide whether it was intended or a typo.',
            { ziel: r.destinationName },
          ),
        ),
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
    const differs: Satz[] = []
    if (rb.title !== rp.title) differs.push(satz('event.field.title', 'title'))
    if (rb.privacy !== rp.privacy) differs.push(satz('event.field.privacy', 'visibility'))
    if (differs.length === 0) continue
    findings.push({
      kind: 'backup-differs',
      ...befund(
        satz(
          'event.text.backupDiffers',
          '"{ziel}" is the fallback path for "{primaer}", but carries a different {felder}. Where the fallback path belongs to the same event (YouTube backup ingest), this means two events were created instead of one.',
          { ziel: d.name, primaer: primary.name, felder: undListe(differs) },
        ),
      ),
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
  project: 'project',
  override: 'override',
  none: 'nowhere',
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
    headers: spalten([
      'Destination',
      'Platform',
      'Title',
      'Title from',
      'Visibility',
      'Visibility from',
      'Start',
      'Announced in',
      'Thumbnail',
      'Tags',
      'Override reason',
    ]),
    rows: a.resolved.map((r) => [
      r.destinationName,
      r.platform,
      r.title || NO_TITLE,
      kanonisch(`eventMeta.origin.${r.titleFrom}`, ORIGIN_LABEL[r.titleFrom]),
      kanonisch(`eventMeta.privacy.${r.privacy}`, PRIVACY_LABEL[r.privacy]),
      kanonisch(`eventMeta.origin.${r.privacyFrom}`, ORIGIN_LABEL[r.privacyFrom]),
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
