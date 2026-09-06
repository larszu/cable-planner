// ───────────────────────────────────────────────────────────────────────────
// BEDARF 91 (P2) — was von einer Show in die naechste mitgeht, und was nicht.
//
//   > SRT latency, port negotiations, which SIM worked, which uplink was real,
//   > the mix-minus arrangement and the fallback thresholds are re-derived per
//   > event and live nowhere shared; the most valuable document in the role is
//   > the one least likely to exist.
//
// Und der Weg dahin steht in derselben Zeile: „Venue and template reuse in the
// project model, with the as-built network answer and transport parameters
// attached."
//
// ─── DIE VORLAGE GAB ES SCHON. SIE TRUG DAS FALSCHE MIT ────────────────────
//
// `saveUserTemplate` strippte bisher die AUFTRAGS-Identitaet (Kunde, Logos,
// Rentman-Bezug) und liess alles andere stehen. Das war richtig, solange eine
// Vorlage nur Geraete und Kabel trug. Inzwischen traegt ein Projekt Dinge, die
// an EINEM Haus oder an EINEM Rechner haengen:
//
//   `metadata.venueAnswers` (Bedarf 85)  Was DIESES Haus genehmigt hat.
//   `metadata.siteAddress`               Welches Haus das war.
//   `multicast.assignments` (Bedarf 72)  Adressen, die fuer DIESE Show
//                                        vergeben wurden — und anderswo laufen.
//   `hasStreamKey` (Initiative 9)        Ob auf DIESEM Rechner ein Schluessel
//                                        liegt.
//   `revisions`, `pendingChanges`        Die Geschichte einer anderen Show.
//
// Eine neutrale Vorlage, die die Genehmigungen der Halle A mitbringt, ist
// schlimmer als eine ohne: die Zeilen sehen aus wie Auskunft, und niemand
// fragt nach. Genau davor warnt Bedarf 85 mit `elsewhere`.
//
// ─── ZWEI SORTEN VORLAGE, UND DIE FRAGE WIRD GESTELLT ──────────────────────
//
// `neutral`  Die Form: Raeume, Geraete, Verkabelung, das Ausspiel-Schema.
//            Alles Ortsgebundene faellt weg.
// `venue`    Das Haus: dieselbe Form PLUS die Antworten dieses Hauses und
//            seine Adresse. Die Vorlage merkt sich, WELCHES Haus — und beim
//            Verwenden sagt `templateCarryReport`, ob es dasselbe ist.
//
// Gefragt wird wie bei den Zugangsdaten (`credentialChoiceDialog`, Design-
// Frage 5): am einzelnen Vorgang, nicht pauschal — und NUR, wenn ueberhaupt
// etwas Ortsgebundenes dranhaengt. Eine Rueckfrage, die meistens „nichts
// dabei" bedeutet, wird zur Klickgewohnheit.
//
// ─── WAS IMMER FAELLT, UNABHAENGIG VON DER FRAGE ───────────────────────────
//
// Die Multicast-Vergaben und das Schluessel-Haekchen. Beide sind keine
// Ortsangabe, sondern eine Behauptung, die im neuen Projekt schlicht falsch
// ist: die Adressen laufen anderswo, und der Schluessel liegt im
// Schluesselbund eines anderen Rechners. Der POOL bleibt — das ist das
// Schema, und das ist genau das Wiederverwendbare.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import { sameVenue } from './venueAnswers'

export type TemplateScope = 'venue' | 'neutral'

export const TEMPLATE_SCOPE_LABEL: Readonly<Record<TemplateScope, string>> = {
  venue: 'Für dieses Haus',
  neutral: 'Neutral (nur die Form)',
}

/**
 * Wie viel Ortsgebundenes an diesem Projekt haengt.
 *
 * Der Aufrufer fragt nur, wenn das groesser als 0 ist — siehe Kopf.
 */
export function venueBoundCount(project: CablePlannerProject): number {
  const answers = project.metadata?.venueAnswers?.length ?? 0
  const address = project.metadata?.siteAddress?.trim() ? 1 : 0
  return answers + address
}

/** Der Ort dieses Projekts, getrimmt — oder `undefined`. */
export const projectVenue = (project: CablePlannerProject): string | undefined =>
  project.metadata?.siteAddress?.trim() || undefined

/**
 * Macht aus einem Projekt den Vorlagen-Inhalt. Die Engstelle.
 *
 * Arbeitet auf einer KOPIE und gibt eine neue zurueck; der Aufrufer haelt
 * weiter sein Projekt. Was hier nicht steht, geht mit — das ist Absicht: ein
 * neues Feld soll im Zweifel MITGEHEN und nicht still verschwinden. Wer ein
 * ortsgebundenes Feld hinzufuegt, traegt es hier ein, und `tests/templateScope
 * .test.ts` haelt die Liste fest.
 */
export function stripForTemplate(
  project: CablePlannerProject,
  scope: TemplateScope,
): CablePlannerProject {
  const clone = JSON.parse(JSON.stringify(project)) as CablePlannerProject

  // Die Geschichte einer anderen Show. Sie sagt ueber die Form nichts und
  // laesst die Vorlage mit jedem Speichern wachsen.
  delete clone.revisions
  delete clone.pendingChanges

  // Immer weg: Behauptungen, die im neuen Projekt falsch WAEREN.
  if (clone.multicast) {
    // Der Pool bleibt — das Schema ist das Wiederverwendbare. Die Vergaben
    // gehen; sie laufen in der Show, aus der die Vorlage stammt.
    clone.multicast = { ...clone.multicast, assignments: [] }
  }
  if (clone.deliveryDestinations) {
    clone.deliveryDestinations = clone.deliveryDestinations.map((d) => {
      const { hasStreamKey: _weg, ...rest } = d
      return rest
    })
  }

  if (scope === 'neutral') {
    clone.metadata = { ...clone.metadata }
    delete clone.metadata.siteAddress
    delete clone.metadata.venueAnswers
  }

  return clone
}

export type CarryState = 'carries' | 'elsewhere' | 'none'

export const CARRY_LABEL: Readonly<Record<CarryState, string>> = {
  carries: 'Gilt hier',
  elsewhere: 'Aus einem anderen Haus',
  none: 'Keine Haus-Antworten dabei',
}

export interface CarryReport {
  state: CarryState
  /** Das Haus, aus dem die Vorlage stammt. */
  from?: string
  /** Das Haus, in das sie gehen soll. */
  to?: string
  /** Wie viele Antworten betroffen sind. */
  answers: number
  text: string
}

/**
 * Was beim Verwenden einer Vorlage mit den Haus-Antworten passiert.
 *
 * Der Vergleich ist STRENG und benutzt dieselbe Funktion wie Bedarf 85:
 * „Halle A" und „Halle A, Eingang Nord" koennen dasselbe Haus sein, und sie
 * als gleich zu behandeln hiesse, eine Genehmigung zu uebertragen, die
 * vielleicht nie fuer diesen Bereich galt. Im Zweifel `elsewhere` — das
 * kostet einen Anruf, der andere Fehler kostet den Aufbau.
 *
 * Zwei Wahrheiten darueber, was „dasselbe Haus" heisst, waeren hier besonders
 * teuer: die eine entscheidet, was die Vorlage mitbringt, die andere, wie es
 * im Blatt markiert wird.
 */
export function templateCarryReport(
  templateVenue: string | undefined,
  answers: number,
  targetVenue: string | undefined,
): CarryReport {
  const from = templateVenue?.trim() || undefined
  const to = targetVenue?.trim() || undefined
  if (!answers || !from) {
    return {
      state: 'none',
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      answers,
      text: 'Die Vorlage bringt keine Antworten eines Hauses mit — nur die Form.',
    }
  }
  if (to && sameVenue(from, to)) {
    return {
      state: 'carries',
      from,
      to,
      answers,
      text: `${answers} Antwort(en) aus „${from}" gelten hier weiter — dasselbe Haus.`,
    }
  }
  return {
    state: 'elsewhere',
    from,
    ...(to ? { to } : {}),
    answers,
    text: to
      ? `${answers} Antwort(en) stammen aus „${from}", das Projekt steht in „${to}". Sie werden als „aus einem anderen Haus" geführt und gelten hier nicht.`
      : `${answers} Antwort(en) stammen aus „${from}". Solange das Projekt keinen Ort nennt, bleibt offen, ob sie hier gelten.`,
  }
}
