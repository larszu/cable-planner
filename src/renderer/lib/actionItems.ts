// ───────────────────────────────────────────────────────────────────────────
// BEDARF 108 (P3) — „An action-items surface that tells them what is due,
// overdue, conflicting or over budget — instead of a daily manual sweep."
//
// Der Satz, der den Entwurf entscheidet, steht woertlich in der
// Bedarfs-Datenbank:
//
//   > Across every tracker read, these users ask to be TOLD something rather
//   > than to go and check. That makes this a NOTIFICATION-AND-DERIVATION
//   > product, not an authoring product. Cheap to build against the existing
//   > model and it is what they actually request.
//
// Die Fundstelle dazu (`Shelf-nu/shelf.nu#1956`, 2025-07-29) fragt nach einem
// „late-returns dashboard" und ausdruecklich nach einem „Action Items
// dashboard"; dasselbe Muster in `kimai/kimai#5421`.
//
// ─── DIESE DATEI LEITET NICHTS AB, SIE SAMMELT EIN ─────────────────────────
//
// Jede Zeile hier kommt aus einer Stelle, die es schon gibt:
// `overdueSubhire`, `overdueCheckouts`, `labourFindings`, `receiptChain`,
// `costComparison`, `bookingConflicts`. KEINE ZWEITE RECHNUNG. Wer hier eine
// eigene Faelligkeit oder eine eigene Abweichung bildete, haette dieselbe
// Aussage an zwei Stellen — und die beiden gingen auseinander, sobald jemand
// nur eine anfasst. Genau dieser Defekt steht im Beleg zu Bedarf 40, und er
// waere hier teurer: eine Uebersicht, die etwas anderes sagt als die Seite,
// auf die sie zeigt, macht beide unbrauchbar.
//
// Bei den TEXTEN gilt das, soweit die Quelle einen hat: `crew`, `receipt` und
// `cost` uebernehmen den Wortlaut aus `LABOUR_FINDING_LABEL`,
// `CHAIN_FINDING_LABEL` und `COST_FINDING_LABEL` unveraendert. Drei Quellen
// haben keine solche Tabelle — `subhire`, `checkout` und `booking` liefern
// Datensaetze und keine Befunde —, und nur fuer die entsteht der Satz hier.
// Welche drei das sind, steht in `EIGENER_TEXT` und wird von
// `tests/actionItems.test.ts` festgehalten: eine vierte Quelle mit eigenem
// Wortlaut faellt dort auf, statt sich einzuschleichen.
//
// ─── WAS ZUR HANDLUNGSLISTE GEHOERT UND WAS NICHT ──────────────────────────
//
// Nicht jeder Befund ist eine Aufgabe. „Keine Toleranz gesetzt" ist eine
// Auskunft ueber die Einstellungen und keine Sache, die heute jemand
// erledigt; sie steht auf ihrer eigenen Seite und nicht hier. Die
// Entscheidung faellt in den `*_ACTION`-Tabellen — und die sind VOLLSTAENDIGE
// `Record`s ueber die jeweilige Befundart. Wer upstream eine neue Befundart
// ergaenzt, bekommt hier einen Compile-Fehler und muss entscheiden, ob sie
// eine Aufgabe ist. Eine Ausnahmeliste („alles ausser diesen") waere die
// falsche Richtung: sie nimmt neue Befunde stillschweigend auf oder laesst
// sie stillschweigend fallen, je nachdem, wie herum sie geschrieben ist.
//
// ─── FAELLIGKEIT WIRD NIE ERFUNDEN ─────────────────────────────────────────
//
// `when` steht nur da, wo die Quelle ein Datum HAT — ein Rueckgabetermin, das
// Datum der Schicht, das Datum der Auslage. Was keins hat, ist `undated` und
// nicht etwa „heute faellig". Ein erfundener Termin waere auf einer Liste, die
// nach Dringlichkeit sortiert, der teuerste Fehler ueberhaupt: er verschoebe
// die echten Ueberfaelligkeiten nach unten.
// ───────────────────────────────────────────────────────────────────────────
import type { CablePlannerProject } from '../types/project'
import type { CheckoutRecord } from '../types/checkout'
import type { InventoryItem } from '../types/inventory'
import { EMPTY_CREW_PLAN } from '../types/labour'
import { LABOUR_FINDING_LABEL, labourFindings, type LabourFindingKind } from './labourCost'
import { COST_FINDING_LABEL, assessCosts, type CostFindingKind } from './costComparison'
import { CHAIN_FINDING_LABEL, receiptChain, type ChainFindingKind } from './receiptChain'
import { bookingConflicts } from './crewCalendar'
import { overdueSubhire, ownershipNote } from './ownership'
import { overdueCheckouts } from './containerCheckout'

/** Woher eine Zeile stammt — und damit, wohin der Sprung geht. */
export type ActionSource = 'subhire' | 'checkout' | 'crew' | 'receipt' | 'cost' | 'booking'

export const ACTION_SOURCE_LABEL: Readonly<Record<ActionSource, string>> = {
  subhire: 'Sub-Hire',
  checkout: 'Ausgabe',
  crew: 'Crew',
  receipt: 'Belege',
  cost: 'Kosten',
  booking: 'Buchung',
}

/**
 * Wie dringend eine Zeile ist.
 *
 * `undated` ist ein eigener Wert und kein „irgendwann": ohne Datum ist die
 * Zeile nicht weniger wichtig, sie ist nur nicht terminiert. Sie unter die
 * datierten zu mischen hiesse, ihr ein Datum zu geben.
 */
export type ActionUrgency = 'overdue' | 'today' | 'ahead' | 'undated'

export const ACTION_URGENCY_LABEL: Readonly<Record<ActionUrgency, string>> = {
  overdue: 'überfällig',
  today: 'heute',
  ahead: 'steht an',
  undated: 'ohne Termin',
}

export interface ActionItem {
  /** Stabil aus Quelle, Art und Bezug — dieselbe Lage ergibt dieselbe Id. */
  id: string
  source: ActionSource
  kind: string
  /** Der Text der Quelle. Wird hier NIE umformuliert. */
  title: string
  detail?: string
  /** ISO-Datum, nur wenn die Quelle eines hatte. */
  when?: string
  urgency: ActionUrgency
}

export interface ActionInput {
  /**
   * Der Stichtag als ISO-Datum. WIRD UEBERGEBEN und nicht hier geholt —
   * dieselbe Regel wie beim Dokument-Stempel und beim Kalender-Feed: eine
   * Funktion, die die Uhr liest, ist nicht pruefbar.
   */
  today: string
  project: CablePlannerProject
  /** Das Lager. Liegt nicht im Projekt und wird deshalb hereingereicht. */
  inventory?: InventoryItem[]
  checkouts?: CheckoutRecord[]
}

/**
 * Welche Crew-Befunde eine Aufgabe sind.
 *
 * `rate-missing` und Geschwister sind Datenfehler, die jemand geradezieht —
 * und bis dahin faellt eine geleistete Stunde aus jeder Summe. Deshalb JA.
 */
const CREW_ACTION: Readonly<Record<LabourFindingKind, boolean>> = {
  'rate-missing': true,
  'person-missing': true,
  'band-missing': true,
  overlap: true,
  'zero-length': true,
  'overtime-unapproved': true,
  'expense-without-receipt': true,
}

/**
 * Welche Kosten-Befunde eine Aufgabe sind.
 *
 * `no-tolerance`, `currency-unstated` und `no-lines` sind Auskuenfte ueber die
 * EINSTELLUNG des Kostenplans, nicht ueber einen Vorgang, der heute erledigt
 * wird. Sie stehen auf der Kostenseite und gehoeren nicht auf eine Liste, die
 * nach Dringlichkeit sortiert — sonst steht dort jeden Tag dasselbe, und die
 * Liste wird zu dem, was der Bedarf abschaffen will.
 */
const COST_ACTION: Readonly<Record<CostFindingKind, boolean>> = {
  'no-lines': false,
  'estimate-missing': false,
  'actual-missing': false,
  'actual-unsourced': true,
  'anchor-orphan': true,
  'currency-unstated': false,
  'no-tolerance': false,
  'over-tolerance': true,
}

/** Welche Beleg-Befunde eine Aufgabe sind. */
const CHAIN_ACTION: Readonly<Record<ChainFindingKind, boolean>> = {
  'expense-unlinked': true,
  'expense-without-evidence': true,
  'cost-line-missing': true,
  'actual-missing': false,
  'actual-below-documented': true,
  'actual-above-documented': true,
}

/**
 * Die Quellen, deren Zeilentext HIER gebildet wird, weil sie keine
 * Befund-Tabelle haben. Alle anderen uebernehmen den Wortlaut ihrer Quelle.
 */
export const EIGENER_TEXT: readonly ActionSource[] = ['subhire', 'checkout', 'booking']

/** Aus Stichtag und Termin die Dringlichkeit. Ohne Termin: `undated`. */
export const urgencyOf = (when: string | undefined, today: string): ActionUrgency => {
  if (!when) return 'undated'
  // ISO-Datumsvergleich als Zeichenkette, wie in `ownership.ts`: der Stichtag
  // ist ein Kalendertag und kein Zeitpunkt, eine Zeitzone hat hier nichts zu
  // suchen.
  if (when < today) return 'overdue'
  if (when === today) return 'today'
  return 'ahead'
}

const RANG: Readonly<Record<ActionUrgency, number>> = {
  overdue: 0,
  today: 1,
  ahead: 2,
  undated: 3,
}

/**
 * Die Handlungsliste eines Projekts.
 *
 * Sortiert: ueberfaellig zuerst und darin das aelteste zuerst, dann heute,
 * dann das Anstehende mit dem naechsten Termin vorn, zuletzt das Undatierte.
 * Wer von oben abarbeitet, arbeitet in der Reihenfolge ab, in der es teuer
 * wird.
 *
 * EINE LEERE LISTE IST EIN ERGEBNIS. Es entsteht keine Zeile „alles in
 * Ordnung": ein Hinweis ohne Anlass ist der Anfang davon, dass die Liste
 * ueberflogen statt gelesen wird.
 */
export const actionItems = (input: ActionInput): ActionItem[] => {
  const { today, project } = input
  const out: ActionItem[] = []
  const crew = project.crewPlan ?? EMPTY_CREW_PLAN
  const entryById = new Map(crew.entries.map((e) => [e.id, e]))
  const rateById = new Map(crew.rates.map((r) => [r.id, r]))
  const expenseById = new Map(crew.expenses.map((e) => [e.id, e]))

  // ── Fremdes Material, das zurueckmuss ──────────────────────────────────
  for (const l of overdueSubhire(input.inventory ?? [], today)) {
    out.push({
      id: `subhire:${l.status}:${l.itemId}`,
      source: 'subhire',
      kind: l.status,
      title:
        l.status === 'overdue'
          ? `${l.model} ist überfällig`
          : `${l.model} hat kein Rückgabedatum`,
      // Der Zusatz kommt aus `ownershipNote` — derselbe Satz, der auf jedem
      // Blatt neben der Position steht. Ihn hier zweitens zu formulieren
      // hiesse, zwei Fassungen derselben Auskunft zu pflegen.
      detail: ownershipNote(
        { ownership: l.ownership, supplier: l.supplier, returnDue: l.returnDue },
        today,
      ),
      ...(l.returnDue ? { when: l.returnDue } : {}),
      urgency: urgencyOf(l.returnDue || undefined, today),
    })
  }

  // ── Ausgaben, die ueberfaellig sind ────────────────────────────────────
  for (const r of overdueCheckouts(input.checkouts ?? [], today)) {
    out.push({
      id: `checkout:overdue:${r.id}`,
      source: 'checkout',
      kind: 'overdue',
      title: `Ausgabe an ${r.out.to} ist überfällig`,
      detail: r.out.projectName,
      ...(r.out.dueBack ? { when: r.out.dueBack } : {}),
      urgency: urgencyOf(r.out.dueBack, today),
    })
  }

  // ── Crew: was an den Stunden nicht aufgeht ─────────────────────────────
  for (const f of labourFindings(crew)) {
    if (!CREW_ACTION[f.kind]) continue
    // Das Datum kommt aus dem Bezug, wenn es eins gibt — Schicht, Auslage.
    // Ein Satz oder ein Band hat keins, und dann steht auch keins da.
    const datum = entryById.get(f.refId)?.date ?? expenseById.get(f.refId)?.date
    out.push({
      id: `crew:${f.kind}:${f.refId}`,
      source: 'crew',
      kind: f.kind,
      title: LABOUR_FINDING_LABEL[f.kind],
      detail: f.text,
      ...(datum ? { when: datum } : {}),
      urgency: urgencyOf(datum, today),
    })
  }

  // ── Belege: die Kette von der Quittung zur Kostenzeile ─────────────────
  for (const f of receiptChain(project.costPlan, crew).findings) {
    if (!CHAIN_ACTION[f.kind]) continue
    const datum = f.expenseId ? expenseById.get(f.expenseId)?.date : undefined
    out.push({
      id: `receipt:${f.kind}:${f.expenseId ?? f.costLineId ?? ''}`,
      source: 'receipt',
      kind: f.kind,
      title: CHAIN_FINDING_LABEL[f.kind],
      ...(f.detail ? { detail: f.detail } : {}),
      ...(datum ? { when: datum } : {}),
      urgency: urgencyOf(datum, today),
    })
  }

  // ── Kosten: was ueber der Toleranz liegt ───────────────────────────────
  if (project.costPlan) {
    for (const f of assessCosts(project).findings) {
      if (!COST_ACTION[f.kind]) continue
      out.push({
        id: `cost:${f.kind}:${f.lineId ?? ''}`,
        source: 'cost',
        kind: f.kind,
        title: COST_FINDING_LABEL[f.kind],
        detail: f.text,
        urgency: 'undated',
      })
    }
  }

  // ── Buchung: zwei Schichten derselben Person zur selben Zeit ───────────
  for (const k of bookingConflicts(crew)) {
    const datum = [k.a.date, k.b.date].sort()[0]
    out.push({
      id: `booking:conflict:${[k.a.id, k.b.id].sort().join('+')}`,
      source: 'booking',
      kind: 'conflict',
      title: 'Zwei Schichten derselben Person überschneiden sich',
      detail: [rateById.get(k.a.rateId)?.activity, rateById.get(k.b.rateId)?.activity]
        .filter(Boolean)
        .join(' / '),
      when: datum,
      urgency: urgencyOf(datum, today),
    })
  }

  return out.sort((a, b) => {
    if (RANG[a.urgency] !== RANG[b.urgency]) return RANG[a.urgency] - RANG[b.urgency]
    if (a.when && b.when && a.when !== b.when) return a.when.localeCompare(b.when)
    return a.id.localeCompare(b.id)
  })
}

/** Wie viele Zeilen je Dringlichkeit — fuer das Abzeichen an der Seite. */
export const actionCounts = (items: readonly ActionItem[]): Record<ActionUrgency, number> => {
  const z: Record<ActionUrgency, number> = { overdue: 0, today: 0, ahead: 0, undated: 0 }
  for (const i of items) z[i.urgency] += 1
  return z
}
