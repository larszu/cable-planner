// ───────────────────────────────────────────────────────────────────────────
// „Wie geplant" gegen „wie gebaut" — ein Blatt statt vier Vergleiche
// (Bedarf 126, P4).
//
//   > Nothing reconciles the plan against what the devices actually hold;
//   > drift is discovered IN REHEARSAL AT BEST AND ON AIR AT WORST, and POST
//   > HAS NO RECORD of which physical source was on which input.
//
// Belegt an der Architektur von Sofie: dort ist die Unterscheidung ein
// erstklassiger Begriff — Parts werden vor der Wiedergabe instanziiert, damit
// On Air/Next von Änderungen am Ingest unberührt bleiben UND damit sich der
// „as played"-Zustand unabhängig vom „as planned"-Zustand betrachten lässt.
//
// Die Massnahme der Bedarfs-Datenbank ist wörtlich: „Read-back/verify: 'the
// rig says X, the plan says Y'. Nothing in the surveyed ecosystem offers
// this, and it also produces the AS-BUILT ARTEFACT post-production currently
// lacks."
//
// ─── WAS ES SCHON GAB, UND WARUM ES NICHT REICHTE ──────────────────────────
//
// Dieser Plan vergleicht an VIER Stellen gegen die Wirklichkeit:
//
//   `networkReconcile`    Plan gegen ARP-/Netz-Scan (Bedarf 21)
//   `atemLiveCompare`     Plan gegen den ATEM (MV, Audio-Matrix)
//   `videohubRouting`     Plan gegen die Kreuzpunkte des Hubs
//   `erpReconcile`        Plan gegen die Vermietungs-Software
//
// Jeder für sich ist richtig. Zusammen sind sie das, was der Beleg beklagt:
// vier Vergleiche in vier Dialogen, die niemand gemeinsam fährt, und danach
// kein einziges Blatt, das die Post lesen könnte. Dieses Modul rechnet
// deshalb NICHTS neu — es nimmt, was die vier schon liefern, und bringt es in
// EINE Zeilenform mit EINEM Urteil.
//
// ─── DIE REGEL, DIE DAS BLATT TRÄGT ────────────────────────────────────────
//
// OHNE ABLESUNG GIBT ES KEIN „STIMMT". Eine Zeile, zu der kein Gerät befragt
// wurde, heisst `not-verified` — nicht `match`. Das ist dieselbe Regel wie
// beim Tally-Urteil (Bedarf 105) und aus demselben Grund: „stimmt" ist eine
// Aussage über die Wirklichkeit, und wer nicht hingesehen hat, hat keine.
//
// Und: JEDE ABLESUNG TRÄGT IHREN ZEITPUNKT. Ein Verify-Lauf von gestern ist
// kein Verify-Lauf; ein Blatt ohne Zeitpunkt behauptet Gegenwart. Die Uhr
// kommt vom Aufrufer — dieses Modul nimmt keine.
//
// ─── WAS DAS BLATT NICHT TUT ───────────────────────────────────────────────
//
// Es schreibt den Befund NICHT in den Plan zurück. „Was der Hub gerade tut,
// ist eine Beobachtung, was im Plan steht, eine Absicht" (`videohubRouting`),
// und beides in dieselbe Variable zu schreiben macht die Absicht
// unauffindbar. Das Blatt stellt beide nebeneinander; entscheiden tut ein
// Mensch.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { LiveComparison } from './atemLiveCompare'
import { allDeltas } from './atemLiveCompare'
import type { ReconcileReport } from './networkReconcile'
import { salvoChanges } from './salvoSheet'
import type { VideohubCrosspoints } from '../types/equipment'
import type { CsvTable } from './csv'

/** Woher eine Ablesung stammt. */
export type ReadingSource =
  /** Netz-Scan (ARP-Tabelle, Switch-Auszug). */
  | 'network-scan'
  /** Der Mischer selbst. */
  | 'atem'
  /** Der Router. */
  | 'videohub'
  /** Die Vermietungs-Software. */
  | 'erp'
  /** Von Hand eingetragen, weil niemand das Gerät befragen kann. */
  | 'manual'

export const READING_SOURCE_LABEL: Readonly<Record<ReadingSource, string>> = {
  'network-scan': 'Netz-Scan',
  atem: 'Mischer',
  videohub: 'Router',
  erp: 'Vermietung',
  manual: 'von Hand',
}

/** Das Urteil einer Zeile. */
export type AsBuiltVerdict =
  /** Plan und Ablesung sagen dasselbe. */
  | 'match'
  /** Beide sagen etwas, und es ist verschieden. */
  | 'differs'
  /** Der Plan sieht es vor, die Ablesung kennt es nicht. */
  | 'missing'
  /** Die Ablesung meldet es, der Plan kennt es nicht. */
  | 'unexpected'
  /** Niemand hat nachgesehen. KEIN Urteil — und das ist der Punkt. */
  | 'not-verified'

export const AS_BUILT_VERDICT_LABEL: Readonly<Record<AsBuiltVerdict, string>> = {
  match: 'stimmt überein',
  differs: 'weicht ab',
  missing: 'im Plan, nicht vorgefunden',
  unexpected: 'vorgefunden, nicht im Plan',
  'not-verified': 'nicht nachgesehen',
}

/** Was auf dem Blatt steht, wo eine Seite nichts sagt. */
export const NOT_STATED = 'keine Angabe'

/** Eine Zeile: ein Gegenstand, ein Feld, zwei Seiten. */
export interface AsBuiltEntry {
  /** Worum es geht („ATEM 1 · In 3", „Kamera 1"). */
  subject: string
  /** Welches Feld verglichen wurde („Quelle", „IP-Adresse", „Kreuzpunkt"). */
  field: string
  /** Was der Plan sagt. Fehlt bei `unexpected`. */
  planned?: string
  /** Was abgelesen wurde. Fehlt bei `missing` und `not-verified`. */
  actual?: string
  source: ReadingSource
  /** Zeitpunkt der Ablesung (ISO). Fehlt bei `not-verified`. */
  at?: string
}

/**
 * Das Urteil aus den beiden Seiten — die Engstelle.
 *
 * Bewusst NICHT aus dem Vorhandensein einer Ablesung allein: eine Zeile ohne
 * Zeitpunkt ist keine Ablesung, sondern eine Behauptung. Deshalb verlangt
 * jedes Urteil ausser `not-verified`, dass ein Zeitpunkt dabeisteht.
 */
export function asBuiltVerdict(entry: AsBuiltEntry): AsBuiltVerdict {
  if (!entry.at) return 'not-verified'
  const p = entry.planned?.trim()
  const a = entry.actual?.trim()
  if (!p && !a) return 'not-verified'
  if (p && !a) return 'missing'
  if (!p && a) return 'unexpected'
  return p === a ? 'match' : 'differs'
}

export const AS_BUILT_HEADERS = [
  'Gegenstand',
  'Feld',
  'Wie geplant',
  'Wie gebaut',
  'Urteil',
  'Abgelesen von',
  'Abgelesen am',
] as const

const datum = (at: string | undefined): string => (at ? at.slice(0, 10) : NOT_STATED)

/**
 * Das As-Built-Blatt — das Artefakt, das der Post heute fehlt.
 *
 * Sortiert nach Gegenstand und Feld, damit zwei Läufe desselben Aufbaus
 * zeilenweise nebeneinander zu legen sind. Ein Blatt, dessen Reihenfolge vom
 * Bearbeitungsverlauf abhängt, lässt sich nicht vergleichen — dieselbe
 * Begründung wie bei `switcherLinkFor`.
 */
export function asBuiltTable(entries: readonly AsBuiltEntry[]): CsvTable {
  const rows = [...entries]
    .sort((a, b) => a.subject.localeCompare(b.subject) || a.field.localeCompare(b.field))
    .map((e) => [
      e.subject,
      e.field,
      e.planned?.trim() || NOT_STATED,
      e.actual?.trim() || NOT_STATED,
      AS_BUILT_VERDICT_LABEL[asBuiltVerdict(e)],
      READING_SOURCE_LABEL[e.source],
      datum(e.at),
    ])
  return { headers: [...AS_BUILT_HEADERS], rows }
}

export interface AsBuiltSummary {
  /** Je Urteil die Anzahl. */
  counts: Record<AsBuiltVerdict, number>
  /** Wie viele Zeilen überhaupt eine Ablesung haben. */
  verified: number
  total: number
  /** Der jüngste Zeitpunkt einer Ablesung, oder undefined. */
  latest?: string
}

/**
 * Die Zusammenfassung — und zwar mit `not-verified` SICHTBAR.
 *
 * Ein Deckblatt, das nur „12 stimmen überein, 2 weichen ab" sagt, verschweigt
 * die dreissig Zeilen, in die niemand gesehen hat, und liest sich wie eine
 * Freigabe. Deshalb steht hier immer auch, wie viele von wie vielen.
 */
export function asBuiltSummary(entries: readonly AsBuiltEntry[]): AsBuiltSummary {
  const counts: Record<AsBuiltVerdict, number> = {
    match: 0,
    differs: 0,
    missing: 0,
    unexpected: 0,
    'not-verified': 0,
  }
  let latest: string | undefined
  for (const e of entries) {
    counts[asBuiltVerdict(e)] += 1
    if (e.at && (!latest || e.at > latest)) latest = e.at
  }
  const verified = entries.length - counts['not-verified']
  return {
    counts,
    verified,
    total: entries.length,
    ...(latest ? { latest } : {}),
  }
}

// ─── Die vier Zubringer ────────────────────────────────────────────────────
//
// Jeder nimmt das Ergebnis eines vorhandenen Vergleichs und übersetzt es in
// die gemeinsame Zeilenform. Keiner rechnet neu: das wäre eine fünfte
// Wahrheit über dieselbe Frage, und genau die Vervielfachung beklagt der
// Bedarf.

/** Aus dem Netz-Abgleich (Bedarf 21). */
export function fromNetworkReport(report: ReconcileReport): AsBuiltEntry[] {
  return report.rows.map((r) => {
    const subject = r.planned ?? r.found ?? 'unbenannt'
    const entry: AsBuiltEntry = {
      subject,
      field: 'IP-Adresse',
      source: 'network-scan',
      at: report.takenAt,
    }
    if (r.plannedIp) entry.planned = r.plannedIp
    if (r.foundIp) entry.actual = r.foundIp
    return entry
  })
}

/** Aus dem Mischer-Vergleich. `at` kommt vom Aufrufer — das Modul hat keine Uhr. */
export function fromLiveComparison(
  comparison: LiveComparison,
  field: string,
  at: string,
): AsBuiltEntry[] {
  return allDeltas(comparison).map((d) => {
    const entry: AsBuiltEntry = { subject: d.label, field, source: 'atem', at }
    if (d.planned !== undefined) entry.planned = String(d.planned)
    if (d.confirmed !== undefined) entry.actual = String(d.confirmed)
    return entry
  })
}

/**
 * Aus dem Kreuzpunkt-Vergleich.
 *
 * Über `salvoChanges` und nicht über `routingDifferences` direkt: die
 * Umbenennung von `planned`/`live` auf `from`/`to` liegt dort schon, und die
 * Nummern werden hier — wie auf dem Umbau-Zettel — als AUFGEDRUCKTE Nummern
 * geführt (ab 1). Ein Blatt, das intern zählt, schickt jemanden zum falschen
 * Kreuzpunkt.
 */
export function fromCrosspoints(
  deviceName: string,
  planned: VideohubCrosspoints,
  live: VideohubCrosspoints,
  at: string,
): AsBuiltEntry[] {
  return salvoChanges(planned, live).map((c) => {
    const entry: AsBuiltEntry = {
      subject: `${deviceName} · Ausgang ${c.output + 1}`,
      field: 'Kreuzpunkt',
      source: 'videohub',
      at,
    }
    if (c.from !== undefined) entry.planned = String(c.from + 1)
    if (c.to !== undefined) entry.actual = String(c.to + 1)
    return entry
  })
}

/**
 * Zeilen für alles, was NICHT abgelesen wurde.
 *
 * Der wichtigste Zubringer, und der einzige, der nichts vergleicht: er macht
 * die Lücke sichtbar. Ohne ihn führte das Blatt nur die Gegenstände, an denen
 * jemand war — und läse sich wie eine vollständige Prüfung.
 */
export function unverifiedEntries(
  subjects: readonly { subject: string; field: string; planned?: string }[],
  source: ReadingSource = 'manual',
): AsBuiltEntry[] {
  return subjects.map((s) => ({
    subject: s.subject,
    field: s.field,
    source,
    ...(s.planned ? { planned: s.planned } : {}),
  }))
}

/**
 * Zusammenführen, ohne dass eine Ablesung eine andere still überschreibt.
 *
 * Gleicher Gegenstand und gleiches Feld: die JÜNGERE Ablesung gewinnt, und
 * eine Zeile ohne Ablesung verliert immer gegen eine mit. So darf der
 * `unverifiedEntries`-Zubringer grosszügig alles auflisten, ohne die echten
 * Befunde zu verdrängen.
 */
export function mergeEntries(...groups: ReadonlyArray<readonly AsBuiltEntry[]>): AsBuiltEntry[] {
  const byKey = new Map<string, AsBuiltEntry>()
  for (const group of groups) {
    for (const e of group) {
      const key = `${e.subject} ${e.field}`
      const vorhanden = byKey.get(key)
      if (!vorhanden) {
        byKey.set(key, e)
        continue
      }
      if (!e.at) continue
      if (!vorhanden.at || e.at > vorhanden.at) byKey.set(key, e)
    }
  }
  return [...byKey.values()]
}
