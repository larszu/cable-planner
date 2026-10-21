// ───────────────────────────────────────────────────────────────────────────
// Woraus naechstes Jahr geplant wird (Bedarf 84, P2).
//
//   > Show files on USB sticks, photos in WhatsApp, marked-up plans in a skip.
//   > Next year the same event is re-planned from the QUOTE, not from what was
//   > actually built, and every on-site fix is rediscovered. For freelance PMs
//   > the whole job lives in one head.
//
// ─── DIE DATEI GAB ES SCHON. IHR STAND WAR DIE FRAGE ───────────────────────
//
// Der Planer hat die Uebergabe-Datei laengst: die `.avplan` ist verlustfrei
// (ADR-005), und `handoverPackage.ts` baut daraus ein Closeout-Paket fuer den
// Betreiber einer Festinstallation. Was fehlte, ist der Satz, den der Bedarf
// woertlich sagt: das Naechste-Jahr-Problem ist nicht, dass keine Datei da
// waere — es ist, dass die Datei den ANGEBOTSSTAND traegt und aussieht wie der
// Bauzustand.
//
// Der Planer kennt beide: `ProjectRevision.asBuilt` ist die Festschreibung
// „so wurde es gebaut", und `planDiff` sagt, was sich seither geaendert hat.
// Aus beidem folgt ein Zustand mit drei Namen, und der ist die ganze Auskunft.
//
// ─── DIE DREI ZUSTAENDE ────────────────────────────────────────────────────
//
// `as-quoted`  Kein As-Built festgeschrieben. Was hier steht, ist der Plan --
//              also im Zweifel das Angebot. Genau der Ausgangspunkt, den der
//              Bedarf beklagt.
// `drifted`    Ein As-Built liegt vor, aber der Plan ist seither
//              SUBSTANTIELL weitergezogen. Das ist der teuerste Zustand: das
//              Blatt traegt das Wort „As-Built" und stimmt nicht mehr.
// `as-built`   Ein As-Built liegt vor, und seither hat sich nichts
//              Substantielles geaendert.
//
// „Substantiell" ist nicht selbst gerechnet, sondern kommt aus `planDiff`
// (ADR-005, Design-Frage 2): eine verschobene Position ist kein Bauzustand,
// ein umgestecktes Kabel schon. Zwei Vorstellungen davon, was zaehlt, waeren
// hier besonders teuer — die eine faerbte das Blatt, die andere den Diff.
//
// ─── WAS DIESE DATEI NICHT TUT ─────────────────────────────────────────────
//
// Sie schreibt kein As-Built fest. Das ist eine Aussage ueber die Wirklichkeit
// und gehoert einem Menschen, der vor dem Aufbau gestanden hat. Sie sagt nur,
// ob eine da ist und ob sie noch gilt.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import { befund, satz, type Satz } from './satz'
import type { CablePlannerProject, ProjectRevision } from '../types/project'
import type { CsvTable } from './csv'
import { planDiff } from './planDiff'
import { kanonisch, spalten } from './kanonisch'

export type JobBasis = 'as-built' | 'drifted' | 'as-quoted'

export const JOB_BASIS_LABEL: Readonly<Record<JobBasis, string>> = {
  'as-built': 'As built',
  drifted: 'As-built outdated',
  'as-quoted': 'As planned (no as-built)',
}

export type JobHandoverFindingKind =
  | 'no-as-built'
  | 'as-built-stale'
  | 'open-questions'
  | 'unbuilt-notes'
  | 'no-venue'

export const JOB_FINDING_LABEL: Readonly<Record<JobHandoverFindingKind, string>> = {
  'no-as-built': 'No as-built recorded',
  'as-built-stale': 'The as-built is outdated',
  'open-questions': 'Questions to the venue are open',
  'unbuilt-notes': 'Open notes in the plan',
  'no-venue': 'No venue named',
}

export interface JobHandoverFinding {
  kind: JobHandoverFindingKind
  text: string
  satz?: Satz
}

export interface JobHandover {
  basis: JobBasis
  /** Die juengste As-Built-Revision, wenn es eine gibt. */
  asBuilt?: ProjectRevision
  /** Wie viele substantielle Aenderungen seit dem As-Built. 0 bei `as-built`. */
  changedSince: number
  findings: JobHandoverFinding[]
}

/** Die juengste As-Built-Revision — nach `createdAt`, sonst nach Reihenfolge. */
export function latestAsBuilt(project: CablePlannerProject): ProjectRevision | undefined {
  const alle = (project.revisions ?? []).filter((r) => r.asBuilt)
  if (alle.length === 0) return undefined
  return [...alle].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')).at(-1)
}

/**
 * Woraus naechstes Jahr geplant wuerde, wenn jemand DIESE Datei aufmacht.
 */
export function assessJobHandover(project: CablePlannerProject): JobHandover {
  const asBuilt = latestAsBuilt(project)
  const findings: JobHandoverFinding[] = []

  let basis: JobBasis = 'as-quoted'
  let changedSince = 0
  if (asBuilt) {
    // Die Revision haelt den Plan OHNE `revisions`. Beide Seiten werden auf
    // dieselbe Form gebracht, damit der Vergleich nicht an der Liste selbst
    // haengt -- sie ist kein Bauzustand.
    //
    // EHRLICH GESAGT ist das heute wirkungslos, und die Gegenprobe hat es
    // gezeigt: `planDiff.substantive` zaehlt nur Entitaets-Aenderungen und
    // Zu-/Abgaenge, nicht die `sections`, in denen ein abweichendes
    // `revisions` landen wuerde. Die Zeile bleibt trotzdem stehen: sie kostet
    // nichts und haelt die Absicht fest, falls `substantive` je die Sektionen
    // mitzaehlt. Was sie NICHT tut, ist ein Test behaupten.
    const vorher = { ...asBuilt.snapshot, revisions: [] } as CablePlannerProject
    const nachher = { ...project, revisions: [] } as CablePlannerProject
    changedSince = planDiff(vorher, nachher).substantive
    basis = changedSince > 0 ? 'drifted' : 'as-built'
  }

  if (!asBuilt) {
    findings.push({
      kind: 'no-as-built',
      ...befund(
        satz(
          'job.text.noAsBuilt',
          'Nothing has been frozen as "as built". Whoever opens this file next year plans from the state before the build — that is, from the quote, and every on-site change gets found a second time.',
        ),
      ),
    })
  } else if (changedSince > 0) {
    findings.push({
      kind: 'as-built-stale',
      ...befund(
        satz(
          'job.text.asBuiltStale',
          'Since "{revision}", {n} things have changed substantially. The sheet carries the word "as-built" and is no longer right — that is costlier than none at all, because nobody asks.',
          { revision: asBuilt.label, n: changedSince },
        ),
      ),
    })
  }

  const offen = (project.metadata?.venueAnswers ?? []).filter((a) => a.status === 'pending')
  if (offen.length > 0) {
    findings.push({
      kind: 'open-questions',
      ...befund(
        satz(
          'job.text.openQuestions',
          '{n} question(s) to the venue remained unanswered. Exactly those will be asked a second time next year — to the same IT department.',
          { n: offen.length },
        ),
      ),
    })
  }

  const notizen = (project.annotations ?? []).filter((a) => a.status === 'open')
  if (notizen.length > 0) {
    findings.push({
      kind: 'unbuilt-notes',
      ...befund(
        satz(
          'job.text.unbuiltNotes',
          '{n} annotation(s) are still "open". As long as they are, it is unclear whether the point was built, dropped or forgotten.',
          { n: notizen.length },
        ),
      ),
    })
  }

  if (!project.metadata?.siteAddress?.trim()) {
    findings.push({
      kind: 'no-venue',
      ...befund(
        satz(
          'job.text.noVenue',
          'The plan names no venue. Without it this file cannot be matched to the venue next year, and the answers of the house IT apply nowhere (needs 85, 91).',
        ),
      ),
    })
  }

  return { basis, ...(asBuilt ? { asBuilt } : {}), changedSince, findings }
}

/** Das Blatt: der Zustand in einer Zeile, die Befunde darunter. */
export function jobHandoverTable(project: CablePlannerProject): CsvTable {
  const a = assessJobHandover(project)
  return {
    headers: spalten(['Basis', 'As-Built', 'Changes since', 'Finding']),
    rows: [
      [
        kanonisch(`job.basis.${a.basis}`, JOB_BASIS_LABEL[a.basis]),
        a.asBuilt ? `${a.asBuilt.label} (${a.asBuilt.createdAt})` : 'keins',
        a.changedSince,
        a.findings.map((f) => kanonisch(`job.finding.${f.kind}`, JOB_FINDING_LABEL[f.kind])).join('; '),
      ],
    ],
  }
}
