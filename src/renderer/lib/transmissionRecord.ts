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
  deliveryDestinations: 'Ausspielziele',
  fallback: 'Sicherheitsnetz',
  archiveRecording: 'Archiv-Aufzeichnung',
  eventMetadata: 'Angaben zur Veranstaltung',
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
  'no-events': 'Kein Eintrag — der Bericht wäre leer',
  'no-as-built': 'Kein As-Built: Abweichungen sind nicht ableitbar',
  'event-orphan': 'Eintrag auf ein Ziel, das es nicht mehr gibt',
  'event-unzoned': 'Zeitpunkt ohne Zeitzone',
  'event-outside-window': 'Zeitpunkt außerhalb des Einsatzzeitraums',
  'event-unsourced': 'Herkunft der Angabe nicht genannt',
  'dropout-without-end': 'Abriss ohne Wiederkehr und ohne Sendeende',
  'switch-without-plan': 'Umschaltung auf einen Weg, den der Plan nicht kennt',
  'deviations-unrecorded': 'Ausspielung weicht vom As-Built ab, ohne Eintrag',
  'no-summary': 'Keine Zusammenfassung für den Kunden',
}

export interface TransmissionFinding {
  kind: TransmissionFindingKind
  text: string
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
        text: 'Es steht kein Eintrag im Sendebericht. Nach der Show wird der Verlauf dann aus OBS-Logs, einer Plattform-Kurve und Erinnerung rekonstruiert — genau der Zustand, gegen den dieser Bericht geschrieben ist.',
      })
    }
  }

  if (!asBuilt && events.length > 0) {
    findings.push({
      kind: 'no-as-built',
      text: 'Kein As-Built festgeschrieben. Der Bericht kann sagen, was beobachtet wurde, aber nicht, wovon die Ausspielung abgewichen ist — es gibt keinen Bauzustand, gegen den verglichen würde.',
    })
  }

  const start = (project.metadata.eventStart ?? '').trim()
  const end = (project.metadata.eventEnd ?? '').trim()

  for (const e of events) {
    if (e.destinationId && !byId.has(e.destinationId)) {
      findings.push({
        kind: 'event-orphan',
        text: `Ein Eintrag bezieht sich auf ein Ziel, das es im Plan nicht (mehr) gibt (${e.destinationId}). Er wird nicht still entfernt: ein verschwundener Eintrag über einen Abriss ist die teuerste Lücke in einem Sendebericht.`,
        eventId: e.id,
      })
    }
    if (!hasOffset(e.at)) {
      findings.push({
        kind: 'event-unzoned',
        text: `Der Zeitpunkt „${e.at}" trägt keine Zeitzone. Gegen ein OBS-Log und eine Plattform-Kurve lässt sich damit nichts abgleichen, und die Reihenfolge im Bericht ist dann die der geschriebenen Zeichenketten, nicht die der Zeitpunkte.`,
        eventId: e.id,
      })
    }
    if (e.source === 'unstated') {
      findings.push({
        kind: 'event-unsourced',
        text: `Bei „${e.text}" steht nicht, woher die Angabe stammt. Ein Bericht, der zum Kunden geht, wird wie ein Messprotokoll gelesen — dieser Planer misst nichts, und das muss an jeder Zeile stehen.`,
        eventId: e.id,
      })
    }
    const tag = dayOf(e.at)
    if (tag && ((start && tag < dayOf(start)) || (end && tag > dayOf(end)))) {
      findings.push({
        kind: 'event-outside-window',
        text: `Der Eintrag vom ${tag} liegt außerhalb des Einsatzzeitraums (${dayOf(start) || '?'} bis ${dayOf(end) || '?'}). Entweder stimmt der Zeitraum nicht oder der Eintrag gehört zu einer anderen Show.`,
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
      text: `Auf „${TRANSMISSION_EVENT_LABEL[e.kind]}" um ${e.at} folgt weder eine Wiederkehr noch ein Sendeende. So gelesen ist die Sendung nicht zurückgekommen.`,
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
      text: `Für „${name}" ist eine Umschaltung eingetragen, aber der Plan kennt für dieses Ziel weder eine Ausweich-Regel noch ein Backup-Ziel. Nächstes Jahr steht im Plan also nicht, worauf man damals ausgewichen ist.`,
      eventId: e.id,
    })
  }

  if (deviations.length > 0 && !events.some((e) => e.kind === 'config-change')) {
    findings.push({
      kind: 'deviations-unrecorded',
      text: `Die Ausspielung weicht in ${deviations.length} Bereich(en) vom As-Built ab (${deviations
        .map((d) => d.label)
        .join(', ')}), aber kein Eintrag nennt eine Änderung während der Sendung. Entweder wurde vorher geändert — dann gehört das As-Built nachgezogen — oder der Eintrag fehlt.`,
    })
  }

  if (events.length > 0 && !(record.summary ?? '').trim()) {
    findings.push({
      kind: 'no-summary',
      text: 'Der Bericht trägt keine Zusammenfassung. Sie wird bewusst nicht erzeugt: aus acht Zeilen eine Bewertung der Sendung abzuleiten wäre eine Aussage, die dem Menschen gehört, der sie verantwortet.',
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
    headers: ['Zeit', 'Ziel', 'Was', 'Herkunft', 'Beobachtet von', 'Beschreibung'],
    rows: a.events.map((e) => [
      e.at,
      e.destinationId ? (byId.get(e.destinationId) ?? GONE) : WHOLE_SHOW,
      TRANSMISSION_EVENT_LABEL[e.kind],
      TRANSMISSION_SOURCE_LABEL[e.source],
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
