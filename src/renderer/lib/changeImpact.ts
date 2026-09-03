// ───────────────────────────────────────────────────────────────────────────
// Roadmap-Initiative 5 — „was macht diese Änderung ungültig?"
//
// Das Strategiepapier sagt dazu: „Change-impact analysis answers a question no
// product in the corpus answers." Der Grund, warum sie hier billig ist und
// dort nirgends existiert, steht in ADR-004: dieses Projekt kann den Stand
// eines Dokuments *ausrechnen*, statt ihn nur auf das Blatt zu stempeln.
//
// WAS HEUTE SCHON GEHT — und was nicht. `documentRegistry.DOCUMENT_STANDS`
// beantwortet je Dokument „welchen Stand hätte es JETZT". Zusammen mit dem
// Stempel auf dem Papier ergibt das `docStandStatus`: die RÜCKWÄRTS-Frage,
// gestellt mit dem Blatt in der Hand — „gilt dieser Ausdruck noch?".
//
// Die VORWÄRTS-Frage konnte niemand stellen: „ich habe gerade das geändert —
// welche Blätter sind damit hin?" Genau die ist der Schmerzpunkt: der
// Rehearsal-Day-Edit, nach dem niemand weiss, welche der zwölf ausgedruckten
// Listen noch stimmen.
//
// Dieses Inkrement PERSISTIERT NICHTS. Reine Funktion über zwei Projekt-
// Stände — dieselbe Reihenfolge, die ADR-001 gewählt hat und die dort zwei
// Fehler gefunden hat, die kein Review gefunden hätte. Erst wenn die Ableitung
// steht, weiss man, was ein Register überhaupt festhalten müsste.
//
// DIE TRAGENDE ENTSCHEIDUNG: „weiss ich nicht" ist ein eigenes Ergebnis.
//
// `DOCUMENT_STANDS` lässt `kabel-bom` bewusst aus — sein Inhalt hängt am
// Reserve-Aufschlag, der nicht im Projekt steht, also ist er aus dem Plan
// allein nicht reproduzierbar. `currentStand` gibt dafür `undefined` zurück,
// und sein Docstring sagt ausdrücklich: der Aufrufer macht daraus ein
// `unknown` statt einer Behauptung.
//
// Eine Impact-Liste, die solche Dokumente als „unberührt" führt, wäre die
// schlimmere Antwort: sie sieht aus wie eine Freigabe. Sie nennt sie deshalb
// als `unknown` — Design-Regel 1 aus der Strategie, auf Dokumente angewandt:
// niemals einen unbestätigten Wert als Tatsache zeigen.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import {
  DOCUMENT_LABELS,
  DOCUMENT_STANDS,
  UNJUDGEABLE_DOCUMENTS,
} from './documentRegistry'

export type ImpactVerdict =
  /** Der Stand hat sich geändert — ein Ausdruck von vorher ist überholt. */
  | 'invalidated'
  /** Derselbe Stand, das Blatt gilt weiter. */
  | 'unaffected'
  /** Nicht aus dem Plan allein reproduzierbar. Keine Aussage, kein Freibrief. */
  | 'unknown'

export interface DocumentImpact {
  docId: string
  label: string
  verdict: ImpactVerdict
  /** Warum nicht beurteilbar. Nur bei `unknown` gesetzt. */
  reason?: string
  /** Stand vor der Änderung. Fehlt bei `unknown`. */
  before?: string
  /** Stand nach der Änderung. Fehlt bei `unknown`. */
  after?: string
}

export interface ChangeImpact {
  /** Alle bekannten Dokumente, stabil sortiert: erst betroffen, dann unklar. */
  documents: DocumentImpact[]
  /** Kurzfassung für die Oberfläche. */
  invalidated: number
  unknown: number
  /** Ob sich am Plan selbst etwas geändert hat. */
  planChanged: boolean
}

/** Reihenfolge im Bericht: Was zu tun ist, steht oben. */
const VERDICT_ORDER: Record<ImpactVerdict, number> = {
  invalidated: 0,
  unknown: 1,
  unaffected: 2,
}

/**
 * Welche registrierten Dokumente die Änderung von `before` nach `after`
 * ungültig macht.
 *
 * Beide Stände sind vollständige Projekte — kein Diff, keine Änderungsliste.
 * Der Grund ist derselbe wie bei den Stempeln selbst: der Stand eines
 * Dokuments hängt an seiner ABLEITUNG, nicht an den angefassten Feldern. Eine
 * Änderung an einem Kabel-Typ berührt die Pull-Liste und nicht das
 * Asset-Register; welches von beiden, entscheidet die Ableitung und nicht eine
 * Heuristik über die Felder.
 */
export const changeImpact = (
  before: CablePlannerProject,
  after: CablePlannerProject,
): ChangeImpact => {
  const documents: DocumentImpact[] = []

  for (const docId of Object.keys(DOCUMENT_STANDS)) {
    const label = DOCUMENT_LABELS[docId] ?? docId
    const derive = DOCUMENT_STANDS[docId]
    let standBefore: string | undefined
    let standAfter: string | undefined
    try {
      standBefore = derive(before)
      standAfter = derive(after)
    } catch {
      // Eine Ableitung, die an einem der beiden Stände scheitert, ist keine
      // Aussage. Sie als „unberührt" zu führen waere das Gegenteil von
      // vorsichtig; `unknown` ist die ehrliche Antwort.
      documents.push({
        docId,
        label,
        verdict: 'unknown',
        reason: 'Die Ableitung dieses Dokuments ist an diesem Plan gescheitert.',
      })
      continue
    }
    documents.push({
      docId,
      label,
      verdict: standBefore === standAfter ? 'unaffected' : 'invalidated',
      before: standBefore,
      after: standAfter,
    })
  }

  // Bekannt, aber nicht beurteilbar — ausdrücklich genannt statt weggelassen.
  // Verschweigen sieht in einer Freigabe-Liste wie „unberührt" aus, und genau
  // das ist der Schaden, gegen den ADR-005 geschrieben ist.
  for (const [docId, reason] of Object.entries(UNJUDGEABLE_DOCUMENTS)) {
    if (docId in DOCUMENT_STANDS) continue // reproduzierbar geworden: der Guard meldet es
    documents.push({
      docId,
      label: DOCUMENT_LABELS[docId] ?? docId,
      verdict: 'unknown',
      reason,
    })
  }

  // Dokumente, die das Register in KEINER der beiden Listen kennt, kann diese
  // Funktion nicht beurteilen — und sie tut auch nicht so.

  documents.sort((a, b) => {
    const byVerdict = VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict]
    return byVerdict !== 0 ? byVerdict : a.docId.localeCompare(b.docId)
  })

  return {
    documents,
    invalidated: documents.filter((d) => d.verdict === 'invalidated').length,
    unknown: documents.filter((d) => d.verdict === 'unknown').length,
    planChanged:
      documents.find((d) => d.docId === 'plan')?.verdict === 'invalidated',
  }
}

/**
 * Einzeiler für eine Meldung. Bewusst ohne i18n-Abhängigkeit — diese Datei
 * bleibt eine reine Funktion; der Aufrufer übersetzt.
 */
export const changeImpactSummary = (impact: ChangeImpact): string => {
  const parts: string[] = []
  if (impact.invalidated > 0) parts.push(`${impact.invalidated} überholt`)
  if (impact.unknown > 0) parts.push(`${impact.unknown} nicht beurteilbar`)
  return parts.length > 0 ? parts.join(', ') : 'keine Auswirkung'
}
