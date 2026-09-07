// ───────────────────────────────────────────────────────────────────────────
// BEDARF 97, zweite Haelfte — „hang the line on the project so it can become
// a BillingDoc line".
//
// Der Satz aus dem Beleg, an dem diese Datei haengt:
//
//   > Trips produce NO ACCOUNTING CONSEQUENCE AT ALL.
//
// Eine angehaengte Quittung, die nirgendwohin zeigt, ist ein Foto in einem
// Ordner. Erst der Bezug auf eine Kostenzeile macht aus der Auslage eine
// Folge: die Position „Anfahrt" im Kostenplan weiss dann, was tatsaechlich
// ausgelegt wurde, und WOMIT das belegt ist.
//
// ─── DIE GRENZE, DIE HIER NICHT UEBERSCHRITTEN WIRD ────────────────────────
//
// `CostLine.actual` wird von dieser Datei NIE geschrieben. Der Kopf von
// `types/costLines.ts` sagt: „Der Ist-Wert wird nie gerechnet und nie
// geraten", und der Grund steht daneben — eine gerechnete Zahl in einer
// Spalte, in der sonst gepflegte Zahlen stehen, ist von einer gepflegten
// nicht zu unterscheiden. Was hier entsteht, ist ein VORSCHLAG
// (`proposedActual`) plus die Befunde, warum er vom eingetragenen Wert
// abweicht. Uebernehmen tut ihn ein Mensch, und dann steht
// `actualSource: 'from-invoice'` daran.
//
// ─── EINE WAEHRUNG, EINMAL AM PROJEKT ──────────────────────────────────────
//
// Auslagen tragen keine eigene Waehrung, Kostenzeilen auch nicht — sie steht
// einmal am `CostPlan`. Diese Datei summiert deshalb blank und rechnet
// nichts um; ein Umrechnungskurs waere ein Wert ohne Fundstelle. Wer eine
// Auslage in fremder Waehrung eintraegt, traegt den umgerechneten Betrag ein
// und schreibt den Originalbetrag in die Notiz — genau das macht auch
// `expenseFromProposal`.
// ───────────────────────────────────────────────────────────────────────────
import type { CostLine, CostPlan } from '../types/costLines'
import type { CrewExpense, CrewPlan } from '../types/labour'

export type ChainFindingKind =
  | 'expense-unlinked'
  | 'expense-without-evidence'
  | 'cost-line-missing'
  | 'actual-missing'
  | 'actual-below-documented'
  | 'actual-above-documented'

export const CHAIN_FINDING_LABEL: Readonly<Record<ChainFindingKind, string>> = {
  'expense-unlinked': 'Auslage zeigt auf keine Kostenzeile',
  'expense-without-evidence': 'Auslage ohne Beleg — weder Datei noch Belegnummer',
  'cost-line-missing': 'Auslage zeigt auf eine Kostenzeile, die es nicht mehr gibt',
  'actual-missing': 'Kostenzeile hat keinen Ist-Wert, obwohl Auslagen belegt sind',
  'actual-below-documented': 'Ist-Wert liegt unter der belegten Summe',
  'actual-above-documented': 'Ist-Wert liegt über der belegten Summe',
}

export interface ChainFinding {
  kind: ChainFindingKind
  /** Die betroffene Auslage, wenn der Befund an einer haengt. */
  expenseId?: string
  /** Die betroffene Kostenzeile, wenn der Befund an einer haengt. */
  costLineId?: string
  detail?: string
}

export interface ReceiptCoverageRow {
  line: CostLine
  expenses: CrewExpense[]
  /** Summe der zugeordneten Auslagen. */
  documented: number
  /** Der Teil davon, der eine Belegdatei traegt. */
  withFile: number
  /**
   * Der Ist-Wert, den die belegten Auslagen ergeben.
   *
   * IST NICHT `line.actual` und wird nie dorthin geschrieben. Er steht
   * daneben, damit ein Mensch die Differenz sieht und entscheidet.
   */
  proposedActual: number
  findings: ChainFinding[]
}

export interface ReceiptChain {
  rows: ReceiptCoverageRow[]
  /** Auslagen, die auf keine Kostenzeile zeigen — der Zustand aus dem Beleg. */
  unlinked: CrewExpense[]
  /** Alle Befunde, auch die der Zeilen — eine Liste fuer die Oberflaeche. */
  findings: ChainFinding[]
}

const rund = (n: number): number => Math.round(n * 100) / 100

/** Traegt die Auslage ueberhaupt einen Beleg — Datei oder Nummer? */
export const hasEvidence = (e: CrewExpense): boolean =>
  Boolean(e.receipt) || Boolean(e.receiptRef && e.receiptRef.trim())

/**
 * Die Kette von der Quittung zur Kostenzeile.
 *
 * `tolerancePercent` aus dem Kostenplan entscheidet, ab wann eine Abweichung
 * zwischen Ist-Wert und belegter Summe gemeldet wird. Fehlt er, wird JEDE
 * Abweichung gemeldet — anders als bei `costTotals`, wo ein fehlender Wert
 * gar keine Meldung ergibt. Der Unterschied ist Absicht: dort geht es um
 * „ist die Abweichung auffaellig", hier um „stimmen zwei Zahlen ueberein, die
 * dasselbe meinen". Zwei Zahlen, die dasselbe meinen und es nicht tun, sind
 * immer eine Meldung wert.
 */
export const receiptChain = (costPlan: CostPlan | undefined, crew: CrewPlan | undefined): ReceiptChain => {
  const lines = costPlan?.lines ?? []
  const expenses = crew?.expenses ?? []
  const bekannt = new Set(lines.map((l) => l.id))
  const findings: ChainFinding[] = []

  const unlinked: CrewExpense[] = []
  for (const e of expenses) {
    if (!e.costLineId) {
      unlinked.push(e)
      findings.push({ kind: 'expense-unlinked', expenseId: e.id })
    } else if (!bekannt.has(e.costLineId)) {
      // Der Zeiger geht ins Leere — die Kostenzeile wurde geloescht. Die
      // Auslage bleibt eine Auslage, aber sie taucht in keiner Zeilensumme
      // auf, und genau das muss sichtbar sein.
      unlinked.push(e)
      findings.push({ kind: 'cost-line-missing', expenseId: e.id, detail: e.costLineId })
    }
    if (!hasEvidence(e)) findings.push({ kind: 'expense-without-evidence', expenseId: e.id })
  }

  const rows: ReceiptCoverageRow[] = lines.map((line) => {
    const eigene = expenses.filter((e) => e.costLineId === line.id)
    const documented = rund(eigene.reduce((s, e) => s + e.amount, 0))
    const withFile = rund(eigene.filter((e) => e.receipt).reduce((s, e) => s + e.amount, 0))
    const zeile: ChainFinding[] = []
    if (eigene.length > 0) {
      if (line.actual === undefined) {
        zeile.push({ kind: 'actual-missing', costLineId: line.id, detail: documented.toFixed(2) })
      } else {
        const abw = rund(line.actual - documented)
        const grenze = costPlan?.tolerancePercent
        const auffaellig =
          grenze === undefined || documented === 0
            ? abw !== 0
            : Math.abs(abw) > (Math.abs(documented) * grenze) / 100
        if (abw < 0 && auffaellig) {
          zeile.push({
            kind: 'actual-below-documented',
            costLineId: line.id,
            detail: `${line.actual.toFixed(2)} gegen ${documented.toFixed(2)}`,
          })
        } else if (abw > 0 && auffaellig) {
          zeile.push({
            kind: 'actual-above-documented',
            costLineId: line.id,
            detail: `${line.actual.toFixed(2)} gegen ${documented.toFixed(2)}`,
          })
        }
      }
    }
    findings.push(...zeile)
    return { line, expenses: eigene, documented, withFile, proposedActual: documented, findings: zeile }
  })

  return { rows, unlinked, findings }
}

/**
 * Was die belegten Auslagen zum Ist-Wert einer Zeile beitragen wuerden.
 *
 * Die Oberflaeche ruft das beim Uebernehmen auf. `actualSource` ist Teil des
 * Rueckgabewerts und nicht optional: eine uebernommene Zahl OHNE Herkunft
 * saehe wie eine von Hand gepflegte aus, und der Kopf von `costLines.ts` haelt
 * fest, warum genau dieser Unterschied zaehlt.
 */
export const actualFromReceipts = (
  row: ReceiptCoverageRow,
): { actual: number; actualSource: 'from-invoice' } => ({
  actual: row.proposedActual,
  actualSource: 'from-invoice',
})
