// ───────────────────────────────────────────────────────────────────────────
// Die Kunden-Übersicht (Bedarf 81, P2, zweite Haelfte).
//
//   > Existing views show „a row for each project AND activity", which makes
//   > client-level analysis unclear, and reports lack „helpful graphics or
//   > added calculations like Percentage breakdowns".
//
// Beleg: kimai#5593 (2025-07-29, gelesen) — will Stunden nach Kunde/Projekt/
// Taetigkeit gebuendelt, mit Anteilen; die vorhandene Auswertung wird
// „cumbersome" genannt. Die Bedarfs-Datenbank folgert: „treat the client-facing
// summary as a PRODUCT SURFACE rather than a CSV dump".
//
// ─── DREI REGELN, UND ZWEI DAVON SIND DER GANZE UNTERSCHIED ────────────────
//
// 1. **Jeder Anteil nennt seinen Nenner.** „25 %" allein ist die Sorte Zahl,
//    die in einer Kundenbesprechung zu einer Diskussion fuehrt, die niemand
//    gewinnen kann. Die Spalte traegt deshalb „3 von 12 (25 %)".
//
// 2. **Jede Zeile nennt ihre Grundlage.** Eine Zahl aus dem Plan ist etwas
//    anderes als eine aus dem festgeschriebenen Bauzustand und etwas anderes
//    als eine, die jemand vom Feld zurueckgemeldet hat. Ohne diese Spalte
//    laese der Kunde eine Planzahl als Leistungsnachweis — und genau dafuer
//    wird so ein Blatt benutzt.
//
// 3. **„Niemand hat gemeldet" ist nicht „nichts gebaut".** Ohne
//    Rueckmeldungen aus dem Feld stuende beim Aufbaufortschritt 0 %, und
//    0 % heisst in einer Kundenbesprechung „ihr habt nichts getan". Die
//    Zeilen sagen dann `nicht gemeldet` — dieselbe Unterscheidung wie
//    `not-stated` gegen `none-by-choice` bei der Archiv-Frage (Bedarf 90).
//
// ─── WAS HIER NICHT PASSIERT ───────────────────────────────────────────────
//
// Keine Grafik. Der Bedarf nennt „bar and pie graphs", aber ein CSV traegt
// keine, und ein erfundenes Balkendiagramm aus ASCII-Zeichen waere schlechter
// als die Zahl daneben. Die Zahlen sind so gebaut, dass ein
// Tabellenprogramm in zwei Klicks ein Diagramm daraus macht — das ist die
// ehrliche Haelfte dieses Wunsches.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import { befund, satz, type Satz } from './satz'
import type { CablePlannerProject } from '../types/project'
import { assessJobHandover, JOB_BASIS_LABEL, type JobBasis } from './jobHandover'
import type { CsvTable } from './csv'
import { kanonisch, spalten } from './kanonisch'

/** Woher die Zahl einer Zeile kommt. */
export type SummaryBasis =
  /** Aus dem Plan — im Zweifel also aus dem Angebot. */
  | 'plan'
  /** Aus dem festgeschriebenen Bauzustand. */
  | 'as-built'
  /** Vom Feld zurueckgemeldet (Mobile-Companion, Haken am Port). */
  | 'reported'
  /** Niemand hat etwas gemeldet — und das ist etwas anderes als „null". */
  | 'unreported'

export const SUMMARY_BASIS_LABEL: Readonly<Record<SummaryBasis, string>> = {
  plan: 'from the plan',
  'as-built': 'from the as-built',
  reported: 'reported from the field',
  unreported: 'not reported',
}

/** Was in der Anteils-Spalte steht, wenn niemand etwas gemeldet hat. */
export const NOT_REPORTED = 'nicht gemeldet'

export interface SummaryRow {
  /** Der Themenblock, unter dem die Zeile steht. */
  gruppe: string
  kennzahl: string
  /** Der Zahlenwert, oder ein benannter Ersatz. */
  wert: string
  /** „3 von 12 (25 %)" — nie ein nackter Prozentsatz. */
  anteil: string
  basis: SummaryBasis
}

export type ClientSummaryFindingKind = 'empty-plan' | 'progress-unreported' | 'no-as-built'

export const CLIENT_SUMMARY_FINDING_LABEL: Readonly<
  Record<ClientSummaryFindingKind, string>
> = {
  'empty-plan': 'Nothing to report: the plan is empty',
  'progress-unreported': 'No build progress reported',
  'no-as-built': 'No as-built: every number is a plan figure',
}

export interface ClientSummaryFinding {
  kind: ClientSummaryFindingKind
  text: string
  satz?: Satz
}

export interface ClientSummary {
  rows: SummaryRow[]
  /** Woraus das ganze Blatt spricht (Bedarf 84). */
  basis: JobBasis
  findings: ClientSummaryFinding[]
}

/**
 * „3 von 12 (25 %)".
 *
 * Der Nenner steht IMMER dabei. Bei `gesamt === 0` wird kein Prozentsatz
 * gerechnet — 0 von 0 ist keine Null, sondern keine Aussage.
 */
export const share = (teil: number, gesamt: number): string => {
  if (gesamt <= 0) return 'keine Grundlage'
  const pct = Math.round((teil / gesamt) * 100)
  return `${teil} von ${gesamt} (${pct} %)`
}

const NO_CATEGORY = 'ohne Kategorie'
const NO_TYPE = 'ohne Typ'

/** Zaehlt nach Schluessel und gibt die Gruppen in absteigender Groesse zurueck,
 *  bei Gleichstand alphabetisch — sonst springt das Blatt zwischen Exporten. */
const grouped = (keys: string[]): Array<[string, number]> => {
  const m = new Map<string, number>()
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
}

export function clientSummary(project: CablePlannerProject): ClientSummary {
  const rows: SummaryRow[] = []
  const findings: ClientSummaryFinding[] = []
  const basis = assessJobHandover(project).basis
  // Die Grundlage der EINZELNEN Zahl: liegt ein gueltiges As-Built vor, ist
  // der Bestand der Bauzustand; sonst ist es der Plan. `drifted` zaehlt als
  // Plan — ein veraltetes As-Built als Bauzustand auszugeben waere genau die
  // Behauptung, gegen die Bedarf 84 geschrieben ist.
  const bestandsBasis: SummaryBasis = basis === 'as-built' ? 'as-built' : 'plan'

  const equip = project.equipment ?? []
  const cables = project.cables ?? []
  const dests = project.deliveryDestinations ?? []

  if (equip.length === 0 && cables.length === 0 && dests.length === 0) {
    findings.push({
      kind: 'empty-plan',
      ...befund(
        satz(
          'clientSummary.text.emptyPlan',
          'The plan holds no devices, no cables and no delivery destinations. A summary of it would be an empty sheet with a heading.',
        ),
      ),
    })
  }

  // ── Geräte ──────────────────────────────────────────────────────────────
  rows.push({
    gruppe: 'Geräte',
    kennzahl: 'Geräte gesamt',
    wert: String(equip.length),
    anteil: share(equip.length, equip.length),
    basis: bestandsBasis,
  })
  for (const [kat, n] of grouped(equip.map((e) => e.category?.trim() || NO_CATEGORY))) {
    rows.push({
      gruppe: 'Geräte',
      kennzahl: kat,
      wert: String(n),
      anteil: share(n, equip.length),
      basis: bestandsBasis,
    })
  }

  // ── Kabel ───────────────────────────────────────────────────────────────
  const meter = cables.reduce((sum, c) => sum + (c.length !== undefined && Number.isFinite(c.length) ? c.length : 0), 0)
  rows.push({
    gruppe: 'Kabel',
    kennzahl: 'Kabel gesamt',
    wert: String(cables.length),
    anteil: share(cables.length, cables.length),
    basis: bestandsBasis,
  })
  rows.push({
    gruppe: 'Kabel',
    kennzahl: 'Länge gesamt (m)',
    wert: String(Math.round(meter)),
    anteil: 'Summe',
    basis: bestandsBasis,
  })
  // Wie viele Laengen GESCHAETZT sind. Ein Kunde, der eine Meterzahl auf einem
  // Blatt sieht, liest sie als gemessen; `lengthDerivedFrom` weiss es besser.
  const geschaetzt = cables.filter((c) => c.lengthDerivedFrom).length
  rows.push({
    gruppe: 'Kabel',
    kennzahl: 'davon Länge geschätzt',
    wert: String(geschaetzt),
    anteil: share(geschaetzt, cables.length),
    basis: bestandsBasis,
  })
  for (const [typ, n] of grouped(cables.map((c) => String(c.type ?? '').trim() || NO_TYPE))) {
    rows.push({
      gruppe: 'Kabel',
      kennzahl: typ,
      wert: String(n),
      anteil: share(n, cables.length),
      basis: bestandsBasis,
    })
  }

  // ── Ausspielung ─────────────────────────────────────────────────────────
  if (dests.length > 0) {
    rows.push({
      gruppe: 'Ausspielung',
      kennzahl: 'Ziele gesamt',
      wert: String(dests.length),
      anteil: share(dests.length, dests.length),
      basis: bestandsBasis,
    })
    for (const [plat, n] of grouped(dests.map((d) => d.platform || 'custom'))) {
      rows.push({
        gruppe: 'Ausspielung',
        kennzahl: plat,
        wert: String(n),
        anteil: share(n, dests.length),
        basis: bestandsBasis,
      })
    }
    const mitBackup = dests.filter((d) => d.backupOfId).length
    rows.push({
      gruppe: 'Ausspielung',
      kennzahl: 'davon Ausweichwege',
      wert: String(mitBackup),
      anteil: share(mitBackup, dests.length),
      basis: bestandsBasis,
    })
  }

  // ── Aufbau-Fortschritt ──────────────────────────────────────────────────
  //
  // Der heikelste Block. Ohne Rueckmeldungen stuende hier 0 %, und 0 % heisst
  // in einer Kundenbesprechung „ihr habt nichts getan". Deshalb wird die
  // ABWESENHEIT von Rueckmeldungen benannt, statt sie als Null zu rechnen.
  const checks = project.checkState
  const kabelHaken = Object.values(checks?.cables ?? {}).filter(Boolean).length
  const portHaken = Object.values(checks?.ports ?? {}).filter(Boolean).length
  const nichtsGemeldet = !checks || (kabelHaken === 0 && portHaken === 0)
  if (nichtsGemeldet) {
    rows.push({
      gruppe: 'Aufbau',
      kennzahl: 'Gesteckte Kabel',
      wert: NOT_REPORTED,
      anteil: NOT_REPORTED,
      basis: 'unreported',
    })
    rows.push({
      gruppe: 'Aufbau',
      kennzahl: 'Bestätigte Ports',
      wert: NOT_REPORTED,
      anteil: NOT_REPORTED,
      basis: 'unreported',
    })
    if (cables.length > 0) {
      findings.push({
        kind: 'progress-unreported',
        ...befund(
          satz(
            'clientSummary.text.progressUnreported',
            'No build progress has been reported from the field. The sheet therefore says "not reported" and not "0 %" — the difference decides how a client reads the line.',
          ),
        ),
      })
    }
  } else {
    rows.push({
      gruppe: 'Aufbau',
      kennzahl: 'Gesteckte Kabel',
      wert: String(kabelHaken),
      anteil: share(kabelHaken, cables.length),
      basis: 'reported',
    })
    rows.push({
      gruppe: 'Aufbau',
      kennzahl: 'Bestätigte Ports',
      wert: String(portHaken),
      anteil: 'Summe',
      basis: 'reported',
    })
  }

  if (basis !== 'as-built') {
    findings.push({
      kind: 'no-as-built',
      ...befund(
        satz(
          'clientSummary.text.noAsBuilt',
          'Basis of this sheet: {basis}. Every quantity on it is therefore a planned figure and not proof of work — exactly as the "Based on" column says.',
          { basis: satz(`job.basis.${basis}`, JOB_BASIS_LABEL[basis]) },
        ),
      ),
    })
  }

  return { rows, basis, findings }
}


/**
 * Die Übersicht als Blatt.
 *
 * Die Spalte „Grundlage" steht NEBEN der Zahl und nicht am Rand: sie
 * entscheidet, was die Zahl daneben ueberhaupt behauptet.
 */
export function clientSummaryTable(project: CablePlannerProject): CsvTable {
  const s = clientSummary(project)
  return {
    headers: spalten(['Area', 'Metric', 'Value', 'Share', 'Based on']),
    rows: s.rows.map((r) => [
      r.gruppe,
      r.kennzahl,
      r.wert,
      r.anteil,
      kanonisch(`summary.basis.${r.basis}`, SUMMARY_BASIS_LABEL[r.basis]),
    ]),
  }
}
