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

import type { CablePlannerProject, ProjectRevision } from '../types/project'
import type { CsvTable } from './csv'
import { planDiff } from './planDiff'

export type JobBasis = 'as-built' | 'drifted' | 'as-quoted'

export const JOB_BASIS_LABEL: Readonly<Record<JobBasis, string>> = {
  'as-built': 'Wie gebaut',
  drifted: 'As-Built veraltet',
  'as-quoted': 'Wie geplant (kein As-Built)',
}

export type JobHandoverFindingKind =
  | 'no-as-built'
  | 'as-built-stale'
  | 'open-questions'
  | 'unbuilt-notes'
  | 'no-venue'

export const JOB_FINDING_LABEL: Readonly<Record<JobHandoverFindingKind, string>> = {
  'no-as-built': 'Kein As-Built festgeschrieben',
  'as-built-stale': 'Das As-Built ist überholt',
  'open-questions': 'Fragen ans Haus stehen offen',
  'unbuilt-notes': 'Offene Anmerkungen im Plan',
  'no-venue': 'Kein Ort genannt',
}

export interface JobHandoverFinding {
  kind: JobHandoverFindingKind
  text: string
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
      text: 'Es ist nichts als „wie gebaut" festgeschrieben. Wer diese Datei nächstes Jahr öffnet, plant aus dem Stand, der vor dem Aufbau da war — also aus dem Angebot, und jede Änderung vor Ort wird ein zweites Mal gefunden.',
    })
  } else if (changedSince > 0) {
    findings.push({
      kind: 'as-built-stale',
      text: `Seit „${asBuilt.label}" haben sich ${changedSince} Dinge substantiell geändert. Das Blatt trägt das Wort „As-Built" und stimmt nicht mehr — das ist teurer als gar keines, weil niemand nachfragt.`,
    })
  }

  const offen = (project.metadata?.venueAnswers ?? []).filter((a) => a.status === 'pending')
  if (offen.length > 0) {
    findings.push({
      kind: 'open-questions',
      text: `${offen.length} Frage(n) ans Haus sind ohne Antwort geblieben. Genau die werden nächstes Jahr ein zweites Mal gestellt — an dieselbe IT-Abteilung.`,
    })
  }

  const notizen = (project.annotations ?? []).filter((a) => a.status === 'open')
  if (notizen.length > 0) {
    findings.push({
      kind: 'unbuilt-notes',
      text: `${notizen.length} Anmerkung(en) stehen noch auf „offen". Solange sie das tun, ist unklar, ob der Punkt gebaut, verworfen oder vergessen wurde.`,
    })
  }

  if (!project.metadata?.siteAddress?.trim()) {
    findings.push({
      kind: 'no-venue',
      text: 'Der Plan nennt keinen Ort. Ohne ihn lässt sich diese Datei nächstes Jahr nicht dem Haus zuordnen, und die Antworten der Haus-IT gelten nirgends (Bedarf 85, 91).',
    })
  }

  return { basis, ...(asBuilt ? { asBuilt } : {}), changedSince, findings }
}

/** Das Blatt: der Zustand in einer Zeile, die Befunde darunter. */
export function jobHandoverTable(project: CablePlannerProject): CsvTable {
  const a = assessJobHandover(project)
  return {
    headers: ['Grundlage', 'As-Built', 'Änderungen seither', 'Befund'],
    rows: [
      [
        JOB_BASIS_LABEL[a.basis],
        a.asBuilt ? `${a.asBuilt.label} (${a.asBuilt.createdAt})` : 'keins',
        a.changedSince,
        a.findings.map((f) => JOB_FINDING_LABEL[f.kind]).join('; '),
      ],
    ],
  }
}
