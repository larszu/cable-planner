// ───────────────────────────────────────────────────────────────────────────
// BEDARF 79 (P2) — Plan gegen Ist, ohne ein zweites Buchhaltungssystem.
//
// Woertlich aus dem Beleg (frappe/erpnext#34127, seit 2023-02-19 offen):
//
//   > I have to go to excel, maintain an task sheet with cost estimate and
//   > enter the total estimate in erpnext
//   > I have to copy the actual cost incurred from erpnext to Excel for a side
//   > by side comparison of which task has the most delta
//
// Zwei Wege in dieselbe Tabellenkalkulation und wieder heraus. Was fehlt, ist
// nicht die Ablage — die hat jedes ERP — sondern der VERGLEICH.
//
// ─── DER SATZ, DER DEN ENTWURF ENTSCHEIDET ─────────────────────────────────
//
//   > Project estimate is different from a budget. Project estimate is a
//   > DERIVED QUANTITY based on what the task estimate is.
//
// Deshalb gibt es in dieser Datei kein Feld fuer die Projektsumme. Sie wird
// gerechnet (`costTotals`), nicht gespeichert. Eine gespeicherte Summe ist
// genau der Defekt aus dem Beleg: sie wird einmal eingetippt, die Positionen
// wandern weiter, und ab da widersprechen sich zwei Zahlen im selben System —
// weshalb der Melder ueberhaupt nach Excel ausweicht.
//
// ─── WAS HIER NICHT GEBAUT WIRD ────────────────────────────────────────────
//
// Ein ERP. Die Bedarfs-Datenbank sagt es ausdruecklich: „Do not build an ERP.
// Do build the COMPARISON layer — ERPs store, spreadsheets compare." Also
// keine Buchungen, keine Konten, keine Steuer, keine Rechnungen. Nur zwei
// Zahlen je Position und die Differenz.
//
// Und: KEIN ERFUNDENER IST-WERT. Ein fehlender Ist-Wert macht die Abweichung
// nicht zu null, sondern zu unbekannt. Eine Null waere hier die teuerste
// Luege des ganzen Blatts — sie liest sich als „im Rahmen".
// ───────────────────────────────────────────────────────────────────────────

/**
 * Woran eine Kostenposition im Plan haengt.
 *
 * `free` ist ein eigener Fall und kein fehlender Anker: Fahrt, Personal und
 * Uebernachtung haben keinen Gegenstand im Signalplan, gehoeren aber in den
 * Vergleich. Ein `undefined` koennte „gehoert nirgendwohin" und „Anker
 * verloren" bedeuten, und der Unterschied ist der zwischen einer gueltigen
 * Zeile und einem Datenfehler.
 */
export type CostAnchor =
  | { kind: 'equipment'; equipmentId: string }
  | { kind: 'delivery'; destinationId: string }
  | { kind: 'free' }

/**
 * ES GIBT KEINEN ANKER AUF EINEN LAGER-ARTIKEL, UND DAS IST ABSICHT.
 *
 * Das Lager liegt in `inventoryStore` und NICHT im Projektfile. Ein Zeiger
 * darauf waere in jeder `.avplan`, die per Mail geht, nicht aufloesbar — die
 * Zeile zeigte beim Empfaenger auf nichts und saehe aus wie ein Datenfehler.
 * Sub-Hire-Kosten haengen deshalb entweder am Geraet im Plan oder stehen als
 * freie Position da, mit dem Lieferanten im Text.
 */

/**
 * Woher der Ist-Wert stammt.
 *
 * PFLICHTFELD, aus demselben Grund wie `TransmissionSource` im Sendebericht
 * (Bedarf 87): eine Zahl aus dem ERP und eine aus dem Bauch sehen in einer
 * Spalte gleich aus, und der Unterschied entscheidet, ob jemand danach
 * handelt. `unstated` ist ein Wert und keine Luecke.
 */
export type ActualSource = 'from-erp' | 'from-invoice' | 'estimated-by-hand' | 'unstated'

export const ACTUAL_SOURCE_LABEL: Readonly<Record<ActualSource, string>> = {
  'from-erp': 'aus dem ERP',
  'from-invoice': 'von der Rechnung',
  'estimated-by-hand': 'von Hand geschätzt',
  unstated: 'Herkunft nicht angegeben',
}

export interface CostLine {
  id: string
  /** Wie die Position heisst („Kamerazug", „Anfahrt", „Sub-Hire Funkstrecken"). */
  label: string
  anchor: CostAnchor
  /**
   * Die Schaetzung. Optional, weil eine Position drei Wochen vor der Show
   * noch keine hat — der Befund `estimate-missing` sagt es, statt eine Null
   * hinzuschreiben, die dann in der Projektsumme steckt.
   */
  estimate?: number
  /** Der Ist-Wert. Wird nie gerechnet und nie geraten. */
  actual?: number
  actualSource: ActualSource
  note?: string
}

export interface CostPlan {
  /**
   * Das Waehrungskuerzel, EINMAL am Projekt.
   *
   * Nicht je Position: zwei Waehrungen in einer Summe waeren eine Zahl, die
   * nichts bedeutet, und ein Umrechnungskurs waere ein Wert ohne Fundstelle
   * (siehe die Quellenregel in `types/delivery.ts`). Fehlt es, sagt der
   * Befund `currency-unstated` das — geraten wird nichts, auch nicht „EUR".
   */
  currency?: string
  /**
   * Ab welcher prozentualen Abweichung eine Position auffallen soll.
   *
   * Ohne diesen Wert wird KEINE Zeile als auffaellig gemeldet. Eine
   * voreingestellte Toleranz waere eine Meinung darueber, was in diesem
   * Geschaeft normal ist — und diese Anwendung hat dazu keine.
   */
  tolerancePercent?: number
  lines: CostLine[]
}

/**
 * ES GIBT HIER KEIN FELD FUER DIE PROJEKTSUMME, UND DAS IST ABSICHT.
 *
 * Siehe den Kopf dieser Datei: „Project estimate is a DERIVED quantity."
 * `tests/costComparison.test.ts` haelt das fest — wer eine Summe speichert,
 * baut den Defekt nach, gegen den dieser Bedarf geschrieben ist.
 */
export const EMPTY_COST_PLAN: CostPlan = { lines: [] }
