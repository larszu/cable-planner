// ───────────────────────────────────────────────────────────────────────────
// Der Sendebericht (Bedarf 87, P2). Was die Sendung getan hat — soweit ein
// Mensch es aufgeschrieben hat, und ausdruecklich nicht weiter.
//
// Die Begruendung, warum dieses Objekt existiert und was es NICHT tut, steht
// in `types/transmissionRecord.ts`. Hier steht, was daraus abgeleitet wird.
//
// ─── DIE ZWEITE HAELFTE DES BEDARFS ────────────────────────────────────────
//
//   > a record of THE INTENDED DELIVERY CONFIGURATION and its AS-BUILT
//   > DEVIATIONS
//
// Beides liegt bereits im Projekt: der As-Built-Stand als Revision
// (`latestAsBuilt`, Bedarf 84) und der Vergleich als `planDiff`. Der
// Sendebericht rechnet daraus NICHTS Neues — er liest, welcher Teil der
// Ausspielung sich seit dem As-Built bewegt hat. Eine zweite Vorstellung
// davon, was „geaendert" heisst, waere hier besonders teuer: die eine faerbte
// den Bericht, die andere den Diff.
//
// ─── DIE LISTE DER BEOBACHTETEN BEREICHE IST BENANNT ───────────────────────
//
// `DELIVERY_SECTIONS` zaehlt auf, welche Projekt-Teile in einem KUNDEN-Bericht
// als Abweichung der Ausspielung gelten. Nicht „alles, was sich geaendert
// hat": ein verschobener Rack-Knoten gehoert nicht in einen Sendebericht, und
// eine kuenftige Domaene soll dort nicht still auftauchen. Waechst die Liste,
// faellt das beim Eintragen auf.
//
// ─── DIE REIHENFOLGE IST DIE GESCHRIEBENE, NICHT DIE ECHTE ─────────────────
//
// Sortiert wird nach der Zeichenkette in `at`. Bei gemischten Offsets ist das
// nicht dieselbe Reihenfolge wie die der Zeitpunkte — und genau deshalb
// bekommt jede Zeile ohne Offset den Befund `event-unzoned`, statt dass hier
// eine Zone angenommen wird, um „richtig" sortieren zu koennen.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import { befund, kommaListe, satz, type Satz } from './satz'
import type { CablePlannerProject } from '../types/project'
import {
  TRANSMISSION_EVENT_LABEL,
  TRANSMISSION_SOURCE_LABEL,
  type TransmissionEvent,
  type TransmissionEventKind,
  type TransmissionRecord,
  type TransmissionSource,
} from '../types/transmissionRecord'
import { latestAsBuilt, type JobBasis } from './jobHandover'
import { planDiff } from './planDiff'
import type { CsvTable } from './csv'
import { kanonisch, spalten } from './kanonisch'

/**
 * Die Projekt-Teile, deren Aenderung in einem Sendebericht als Abweichung der
 * Ausspielung zaehlt. Benannt und nicht „alles" — siehe Kopf.
 */
export const DELIVERY_SECTIONS = [
  'deliveryDestinations',
  'fallback',
  'archiveRecording',
  'eventMetadata',
] as const

export const DELIVERY_SECTION_LABEL: Readonly<Record<string, string>> = {
  deliveryDestinations: 'Delivery destinations',
  fallback: 'Safety net',
  archiveRecording: 'Archive recording',
  eventMetadata: 'Event details',
}

export type TransmissionFindingKind =
  | 'no-events'
  | 'no-as-built'
  | 'event-orphan'
  | 'event-unzoned'
  | 'event-outside-window'
  | 'event-unsourced'
  | 'dropout-without-end'
  | 'switch-without-plan'
  | 'deviations-unrecorded'
  | 'no-summary'

export const TRANSMISSION_FINDING_LABEL: Readonly<Record<TransmissionFindingKind, string>> = {
  'no-events': 'No entry — the report would be empty',
  'no-as-built': 'No as-built: deviations cannot be derived',
  'event-orphan': 'Entry for a destination that no longer exists',
  'event-unzoned': 'Time without a time zone',
  'event-outside-window': 'Time outside the job window',
  'event-unsourced': 'Source of the entry not named',
  'dropout-without-end': 'Dropout without recovery and without end of transmission',
  'switch-without-plan': 'Switch to a path the plan does not know',
  'deviations-unrecorded': 'Delivery differs from the as-built, without an entry',
  'no-summary': 'No summary for the client',
}

export interface TransmissionFinding {
  kind: TransmissionFindingKind
  text: string
  satz?: Satz
  /** Der betroffene Eintrag, fuer den Sprung. Leer bei berichtsweiten Befunden. */
  eventId?: string
}

/** Ein Teil der Ausspielung, der sich seit dem As-Built bewegt hat. */
export interface DeliveryDeviation {
  section: string
  label: string
  detail: string
}

export interface TransmissionAssessment {
  record: TransmissionRecord
  /** Die Eintraege in der Reihenfolge ihrer geschriebenen Zeitpunkte. */
  events: TransmissionEvent[]
  /**
   * Woraus der Bericht spricht — derselbe Zustand wie bei der Uebergabe
   * (Bedarf 84). `as-quoted` heisst: es gibt keinen Bauzustand, gegen den
   * abgewichen werden koennte.
   */
  basis: JobBasis
  deviations: DeliveryDeviation[]
  findings: TransmissionFinding[]
}

const EMPTY_RECORD: TransmissionRecord = { events: [] }

const hasOffset = (iso: string): boolean => /(Z|[+-]\d{2}:?\d{2})$/.test(iso.trim())

/** Der Tagesanteil eines ISO-Zeitpunkts, fuer den Vergleich mit dem
 *  Einsatzzeitraum. Der steht als Datum im Projekt, nicht als Zeitpunkt. */
const dayOf = (iso: string): string => iso.trim().slice(0, 10)

/**
 * Die Abweichungen der AUSSPIELUNG gegenueber dem As-Built.
 *
 * Nur die benannten Bereiche (siehe `DELIVERY_SECTIONS`). Ein verschobener
 * Knoten im Rack ist keine Abweichung der Sendung, und ein Kundenbericht, der
 * ihn nennte, laese sich als Ausrede.
 */
export function deliveryDeviations(project: CablePlannerProject): DeliveryDeviation[] {
  const asBuilt = latestAsBuilt(project)
  if (!asBuilt) return []
  const diff = planDiff(asBuilt.snapshot as CablePlannerProject, project)
  const wanted = new Set<string>(DELIVERY_SECTIONS)
  return diff.sections
    .filter((s) => wanted.has(s.section))
    .map((s) => ({
      section: s.section,
      label: DELIVERY_SECTION_LABEL[s.section] ?? s.section,
      detail: s.detail,
    }))
}

export function assessTransmission(project: CablePlannerProject): TransmissionAssessment {
  const record: TransmissionRecord = project.transmissionRecord ?? EMPTY_RECORD
  const dests = project.deliveryDestinations ?? []
  const byId = new Map(dests.map((d) => [d.id, d]))
  const findings: TransmissionFinding[] = []

  const events = [...record.events].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))

  const asBuilt = latestAsBuilt(project)
  const deviations = deliveryDeviations(project)
  const basis: JobBasis = !asBuilt
    ? 'as-quoted'
    : planDiff(asBuilt.snapshot as CablePlannerProject, project).substantive > 0
      ? 'drifted'
      : 'as-built'

  if (events.length === 0) {
    // Nur melden, wenn es ueberhaupt eine Ausspielung gab. Ein Projekt ohne
    // Ziel hat nichts gesendet, und ein Befund waere dort blosses Rauschen.
    if (dests.length > 0) {
      findings.push({
        kind: 'no-events',
        ...befund(
          satz(
            'transmission.text.noEvents',
            'There is no entry in the transmission report. After the show the course is then reconstructed from OBS logs, a platform graph and memory — exactly the state this report is written against.',
          ),
        ),
      })
    }
  }

  if (!asBuilt && events.length > 0) {
    findings.push({
      kind: 'no-as-built',
      ...befund(
        satz(
          'transmission.text.noAsBuilt',
          'No as-built has been frozen. The report can say what was observed, but not what the delivery deviated from — there is no built state to compare against.',
        ),
      ),
    })
  }

  const start = (project.metadata.eventStart ?? '').trim()
  const end = (project.metadata.eventEnd ?? '').trim()

  for (const e of events) {
    if (e.destinationId && !byId.has(e.destinationId)) {
      findings.push({
        kind: 'event-orphan',
        ...befund(
          satz(
            'transmission.text.eventOrphan',
            'An entry refers to a destination that does not exist in the plan (any more) ({id}). It is not silently removed: a vanished entry about a dropout is the costliest gap in a transmission report.',
            { id: String(e.destinationId) },
          ),
        ),
        eventId: e.id,
      })
    }
    if (!hasOffset(e.at)) {
      findings.push({
        kind: 'event-unzoned',
        ...befund(
          satz(
            'transmission.text.eventUnzoned',
            'The time "{zeit}" carries no time zone. It cannot be matched against an OBS log or a platform graph, and the order in the report is then that of the written strings, not of the points in time.',
            { zeit: e.at },
          ),
        ),
        eventId: e.id,
      })
    }
    if (e.source === 'unstated') {
      findings.push({
        kind: 'event-unsourced',
        ...befund(
          satz(
            'transmission.text.eventUnsourced',
            'For "{eintrag}" it is not stated where the information comes from. A report that goes to the client is read like a measurement log — this planner measures nothing, and that must be on every line.',
            { eintrag: e.text },
          ),
        ),
        eventId: e.id,
      })
    }
    const tag = dayOf(e.at)
    if (tag && ((start && tag < dayOf(start)) || (end && tag > dayOf(end)))) {
      findings.push({
        kind: 'event-outside-window',
        ...befund(
          satz(
            'transmission.text.eventOutsideWindow',
            'The entry of {tag} lies outside the engagement period ({von} to {bis}). Either the period is wrong or the entry belongs to another show.',
            { tag, von: dayOf(start) || '?', bis: dayOf(end) || '?' },
          ),
        ),
        eventId: e.id,
      })
    }
  }

  // Ein Abriss, der nie zurueckkommt und auf den kein Sendeende folgt: der
  // Bericht sagt dann, die Sendung sei nie wiedergekehrt. Meist fehlt nur der
  // Eintrag — und genau das ist die Luecke, die dem Kunden auffaellt.
  const endend = new Set<TransmissionEventKind>(['recovered', 'stop'])
  const abrisse = events.filter((e) => e.kind === 'dropout' || e.kind === 'switch')
  for (const e of abrisse) {
    const spaeter = events.filter(
      (x) =>
        x.at > e.at &&
        endend.has(x.kind) &&
        // Ein Sendeende der ganzen Sendung beendet auch den Abriss eines
        // einzelnen Ziels; eine Wiederkehr muss dasselbe Ziel betreffen.
        (x.kind === 'stop' ? !x.destinationId || x.destinationId === e.destinationId : x.destinationId === e.destinationId),
    )
    if (spaeter.length > 0) continue
    findings.push({
      kind: 'dropout-without-end',
      ...befund(
        satz(
          'transmission.text.dropoutWithoutEnd',
          '"{ereignis}" at {zeit} is followed by neither a recovery nor an end of transmission. Read that way, the transmission did not come back.',
          {
          ereignis: satz(`transmission.event.${e.kind}`, TRANSMISSION_EVENT_LABEL[e.kind]),
          zeit: e.at,
        },
        ),
      ),
      eventId: e.id,
    })
  }

  // Eine Umschaltung setzt einen Weg voraus, auf den geschaltet wird. Kennt
  // der Plan weder eine Ausweich-Regel (Bedarf 89) noch ein Backup-Ziel, dann
  // wurde auf etwas geschaltet, das nirgends steht.
  const regelZiele = new Set((project.fallback?.rules ?? []).map((r) => r.destinationId))
  const hatBackup = new Set(dests.filter((d) => d.backupOfId).map((d) => d.backupOfId as string))
  for (const e of events.filter((x) => x.kind === 'switch')) {
    if (!e.destinationId) continue
    if (regelZiele.has(e.destinationId) || hatBackup.has(e.destinationId)) continue
    const name = byId.get(e.destinationId)?.name ?? e.destinationId
    findings.push({
      kind: 'switch-without-plan',
      ...befund(
        satz(
          'transmission.text.switchWithoutPlan',
          'A switch is recorded for "{ziel}", but the plan knows neither a fallback rule nor a backup destination for it. So next year the plan will not say what was fallen back to.',
          { ziel: name },
        ),
      ),
      eventId: e.id,
    })
  }

  if (deviations.length > 0 && !events.some((e) => e.kind === 'config-change')) {
    findings.push({
      kind: 'deviations-unrecorded',
      ...befund(
        satz(
          'transmission.text.deviationsUnrecorded',
          'The delivery deviates from the as-built in {n} area(s) ({bereiche}), but no entry names a change during the transmission. Either it was changed beforehand — then the as-built needs updating — or the entry is missing.',
          {
          n: deviations.length,
          bereiche: kommaListe(deviations.map((d) => satz(`transmission.section.${d.section}`, d.label))),
        },
        ),
      ),
    })
  }

  if (events.length > 0 && !(record.summary ?? '').trim()) {
    findings.push({
      kind: 'no-summary',
      ...befund(
        satz(
          'transmission.text.noSummary',
          'The report carries no summary. It is deliberately not generated: deriving an assessment of the transmission from eight lines would be a statement that belongs to the person responsible for it.',
        ),
      ),
    })
  }

  return { record, events, basis, deviations, findings }
}

// Kanonische deutsche Ersatztexte — dieselbe Regel wie bei den anderen
// Blaettern: ein Text, der mit der eingestellten Sprache wechselt, aendert den
// Stand des Dokuments und meldete jedes gedruckte Exemplar als veraltet.
const WHOLE_SHOW = 'ganze Sendung'
const GONE = 'Ziel entfernt'
const NO_OBSERVER = 'nicht genannt'
const NO_TEXT = 'ohne Text'

/**
 * Der Bericht als Blatt — eine Zeile je Eintrag.
 *
 * Jede leere Zelle traegt einen NAMEN. Und die Spalte „Herkunft" steht neben
 * „Was", nicht am Rand: sie entscheidet, wie belastbar die Zeile ist.
 */
export function transmissionRecordTable(project: CablePlannerProject): CsvTable {
  const a = assessTransmission(project)
  const byId = new Map((project.deliveryDestinations ?? []).map((d) => [d.id, d.name]))
  return {
    headers: spalten(['At', 'Destination', 'What', 'Origin', 'Observed by', 'Description']),
    rows: a.events.map((e) => [
      e.at,
      e.destinationId ? (byId.get(e.destinationId) ?? GONE) : WHOLE_SHOW,
      kanonisch(`transmission.event.${e.kind}`, TRANSMISSION_EVENT_LABEL[e.kind]),
      kanonisch(`transmission.source.${e.source}`, TRANSMISSION_SOURCE_LABEL[e.source]),
      e.observedBy?.trim() || NO_OBSERVER,
      e.text.trim() || NO_TEXT,
    ]),
  }
}

/**
 * Normalisiert den gespeicherten Bericht beim Laden.
 *
 * Verworfen wird nur, was unlesbar ist: ein Eintrag ohne Zeitpunkt ist in
 * einem Bericht ueber einen Verlauf keine Zeile. Ein Eintrag auf ein
 * GELOESCHTES Ziel bleibt — dafuer gibt es `event-orphan`, und ein
 * verschwundener Eintrag ueber einen Abriss ist die teuerste Luecke, die
 * dieser Bericht haben kann.
 *
 * `source` faellt auf `unstated` zurueck und nicht auf `observed`: eine
 * fehlende Angabe zu „gesehen" zu machen hiesse, dem Bericht eine Gewissheit
 * unterzuschieben, die niemand ausgesprochen hat.
 */
export function normaliseTransmissionRecord(
  raw: unknown,
  onDrop?: (d: { reason: 'missing-required' | 'duplicate-id'; label: string }) => void,
): TransmissionRecord | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined
  const kindOf = (v: unknown): TransmissionEventKind | undefined =>
    typeof v === 'string' && v in TRANSMISSION_EVENT_LABEL ? (v as TransmissionEventKind) : undefined
  const sourceOf = (v: unknown): TransmissionSource =>
    typeof v === 'string' && v in TRANSMISSION_SOURCE_LABEL
      ? (v as TransmissionSource)
      : 'unstated'

  const seen = new Set<string>()
  const events: TransmissionEvent[] = []
  for (const rawE of Array.isArray(o.events) ? o.events : []) {
    const r = (rawE ?? {}) as Record<string, unknown>
    const id = str(r.id)
    const at = str(r.at)
    const kind = kindOf(r.kind)
    if (!id || !at || !kind) {
      onDrop?.({ reason: 'missing-required', label: at ?? str(r.text) ?? '' })
      continue
    }
    if (seen.has(id)) {
      onDrop?.({ reason: 'duplicate-id', label: at })
      continue
    }
    seen.add(id)
    const out: TransmissionEvent = { id, at, kind, text: str(r.text) ?? '', source: sourceOf(r.source) }
    const destinationId = str(r.destinationId)
    if (destinationId) out.destinationId = destinationId
    const observedBy = str(r.observedBy)
    if (observedBy) out.observedBy = observedBy
    events.push(out)
  }

  const summary = str(o.summary)
  // Ein Objekt ohne alles traegt nichts — Ballast in jedem Projektfile, das
  // den Dialog einmal geoeffnet hat.
  if (events.length === 0 && !summary) return undefined
  return { events, ...(summary ? { summary } : {}) }
}
