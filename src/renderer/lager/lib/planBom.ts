// ───────────────────────────────────────────────────────────────────────────
// ADR-002, Inkrement 4 — die Stückliste und die Kommissionier-Liste.
//
// Roadmap-Initiative 3: „das größte unbesetzte Feld der Feature-Matrix".
// Jedes Rental-ERP steht dort auf `no`; Produktionsleitung und Lager haben
// unabhängig voneinander dasselbe verlangt, von beiden Enden aus — „der
// technische Plan erzeugt die kaufmännische Stückliste, statt dass sie
// abgetippt wird" und „schließt die Lücke vom technischen Plan zur
// Kommissionier-Liste".
//
// Beides ist hier EINE Projektion über `inventoryCoverage`, keine zweite
// Wahrheit: Menge, Modell und Deckung kommen aus dem Resolver, der Lagerort
// aus dem Lager-Baum. Nichts davon wird gespeichert.
//
// DIE REGEL DER DARSTELLUNG. Ein Vorschlag muss als Vorschlag erkennbar
// bleiben — auch auf Papier, auch in der CSV. Deshalb trägt jede Zeile das
// Ergebnis im Klartext und, wo es einer ist, die Begründung. Eine Liste, die
// Vorschlag und Deckung gleich aussehen lässt, wird im Lager geglaubt statt
// gelesen, und der erste Irrtum kommt als fehlendes Gerät am Aufbautag heraus.
// ───────────────────────────────────────────────────────────────────────────

import type { EquipmentItem } from '../../types/equipment'
import type { InventoryItem, InventoryUnit, StorageNode } from '../types/inventory'
import { resolveCoverage, type CoverageLine, type CoverageOutcome } from './inventoryCoverage'
import type { CheckoutRecord } from '../types/checkout'
import type { ZusatzBedarf } from '../../lib/planDemandExtras'
import { nodePathLabel } from './storageTree'
import { toCsv } from '../../lib/csv'

export interface PlanBomRow {
  /** Anzahl im Plan. */
  quantity: number
  /** Modellname (Katalog, sonst Gerätename). */
  model: string
  category?: string
  outcome: CoverageOutcome
  /** VERFUEGBAR: Bestand abzueglich unbrauchbarer Einheiten und abzueglich
   *  offener Ausgaben (Bedarf 80). */
  available?: number
  /** Bestand IM LAGER, ohne Ruecksicht auf offene Ausgaben. */
  stock?: number
  /** Davon gerade auf einer offenen Ausgabe. */
  committed?: number
  /** Auf welchen Vorgaengen, im Klartext. */
  commitmentNote?: string
  /** Fehlmenge — nur bei einer echten Deckung aussagekräftig. */
  short?: number
  /** Serialisierte Einheiten, die nicht einsatzbereit sind (defekt, in
   *  Reparatur, ausgemustert). Bereits aus `available` herausgerechnet. */
  unusable?: number
  /** Lagerort-Pfad („Depot › Regal A3 › Case 1"). Leer, wenn unbekannt.
   *  Bei mehreren deckenden Positionen die Pfade, mit „ · " verbunden —
   *  wer nur EINEN liest, faehrt an einem der Orte vorbei. */
  location: string
  /** Die deckenden Positionen einzeln, nach Lagerort sortiert. Die
   *  Kommissionier-Liste teilt die Menge daran auf. */
  locations?: Array<{ location: string; available: number }>
  /** Begründung eines Vorschlags. Bei einer Deckung leer. */
  reason?: string
  /** true, wenn `model` nur der Instanzname eines Geräts ist. */
  modelIsDeviceName: boolean
  /** Lager-Position, die deckt bzw. vorgeschlagen ist — Ziel der Bestätigung. */
  itemId?: string
  /** Katalog-Identität des Bedarfs. Zusammen mit `itemId` ist das alles, was
   *  eine Bestätigung braucht: die Identität auf die Position schreiben. */
  deviceTypeId?: string
  /** Die Plan-Geraete dieser Zeile, denen ein Katalog-Typ zugewiesen werden
   *  darf — leer, wo es keine gibt (Rack-Innenleben, Zusatz-Bedarfe).
   *
   *  ADR-002 nannte als naechsten Schritt einen Knopf, „der einem Plan-Geraet
   *  den Katalog-Typ zuweist". Die andere Haelfte — die Bestaetigung eines
   *  Vorschlags auf der LAGER-Position — steht seit `useTypBestaetigen`; diese
   *  hier fehlte, und ohne die Ids kann die Tabelle sie nicht bauen: sie kennt
   *  bis dahin nur einen Modellnamen, nicht die Geraete dahinter.
   *
   *  Es sind ALLE Geraete der Zeile, nicht eines: Der Bedarf ist der Typ,
   *  gezaehlt („dreimal URSA Broadcast G2"). Wer die Zuweisung auf ein Geraet
   *  beschraenkte, zerlegte die Zeile beim naechsten Aufbau in eine gedeckte
   *  und zwei geratene — und genau diese Aufspaltung ist es, gegen die der
   *  Resolver drei Ausgaenge hat. */
  typeTargetIds: string[]
}

export interface PlanBom {
  rows: PlanBomRow[]
  /** Zeilen, die im Lager nicht gedeckt sind — der Einkaufs-/Subhire-Bedarf. */
  missing: PlanBomRow[]
  matched: number
  proposed: number
  unmatched: number
}

const OUTCOME_LABEL: Record<CoverageOutcome, string> = {
  'matched-by-type': 'gedeckt',
  'proposed-by-name': 'VORSCHLAG',
  unmatched: 'nicht im Lager',
}

/** Klartext für Papier und CSV — die drei Zustände bleiben unterscheidbar. */
export const outcomeLabel = (outcome: CoverageOutcome): string => OUTCOME_LABEL[outcome]

const rowOf = (
  line: CoverageLine,
  items: InventoryItem[],
  nodes: StorageNode[],
): PlanBomRow => {
  const item = line.itemId ? items.find((i) => i.id === line.itemId) : undefined
  // Alle deckenden Positionen mit ihrem Lagerort, nach Pfad sortiert — der
  // Weg durchs Depot geht einmal in eine Richtung. Positionen ohne Lagerort
  // fallen raus: ein leerer Pfad in der Kommissionier-Liste ist keine Angabe.
  const unbrauchbar = (line.sources ?? []).reduce((n, q) => n + (q.unusable ?? 0), 0)
  const racks = line.demand.fromRacks ?? []
  const planteile = line.demand.fromPlanParts ?? []
  const herkunft = [...racks, ...planteile]
  const rackHinweis =
    herkunft.length > 0 ? `Stammt (auch) aus: ${herkunft.join(', ')}.` : ''
  const orte = (line.sources ?? [])
    .filter((q) => q.locationId)
    .map((q) => ({ location: nodePathLabel(nodes, q.locationId as string), available: q.available }))
    .sort((a, b) => a.location.localeCompare(b.location, 'de'))
  return {
    quantity: line.demand.quantity,
    model: line.demand.label,
    ...(line.demand.category ? { category: line.demand.category } : {}),
    outcome: line.outcome,
    ...(line.available !== undefined ? { available: line.available } : {}),
    // Bedarf 80: die Zahl traegt ihre Qualifizierung MIT. Ein blosser Bestand
    // ohne den Hinweis, dass die Haelfte davon auf einer anderen Show steht,
    // ist genau die Zahl, an der die Produktionsleitung Technik zusagt, die
    // sie nicht hat.
    ...(line.stock !== undefined ? { stock: line.stock } : {}),
    ...(line.committed !== undefined ? { committed: line.committed } : {}),
    ...(line.commitmentNote ? { commitmentNote: line.commitmentNote } : {}),
    ...(line.short !== undefined ? { short: line.short } : {}),
    // Nicht einsatzbereite Einheiten werden BENANNT, nicht bloss abgezogen.
    // Ein stiller Abzug sieht aus wie ein zu kleiner Bestand, und der naechste
    // Mensch sucht die fehlenden Stuecke im Regal statt in der Werkstatt.
    ...(unbrauchbar > 0 ? { unusable: unbrauchbar } : {}),
    // Der Lagerort gilt nur für eine echte Deckung: Bei einem Vorschlag ist
    // noch gar nicht sicher, dass es diese Position ist, und ein Regalplatz
    // liest sich wie eine Zusage.
    location:
      line.outcome === 'matched-by-type' && item?.locationId
        ? orte.map((o) => o.location).join(' · ')
        : '',
    ...(line.outcome === 'matched-by-type' && orte.length > 0 ? { locations: orte } : {}),
    // Woher die Zeile kommt, steht dabei. Eine Position, die nur im
    // Innenleben eines Racks vorkommt, sieht auf der Liste sonst aus wie ein
    // frei stehendes Geraet — und wer sie im Regal sucht, findet sie nicht,
    // weil sie im Rack schon verbaut ist.
    ...(rackHinweis || line.reason
      ? { reason: [line.reason, rackHinweis].filter(Boolean).join(' ') }
      : {}),
    modelIsDeviceName: line.demand.labelIsDeviceName,
    typeTargetIds: line.demand.typeTargetIds,
    ...(line.itemId ? { itemId: line.itemId } : {}),
    ...(line.demand.deviceTypeId ? { deviceTypeId: line.demand.deviceTypeId } : {}),
  }
}

export const buildPlanBom = (
  equipment: EquipmentItem[],
  items: InventoryItem[],
  nodes: StorageNode[],
  units: InventoryUnit[] = [],
  zusatz: ZusatzBedarf[] = [],
  /** Offene Ausgaben (Bedarf 80). Ohne sie rechnet die Liste gegen den
   *  blossen Lagerbestand und verspricht Technik, die auf einer anderen Show
   *  steht. */
  checkouts: CheckoutRecord[] = [],
): PlanBom => {
  const coverage = resolveCoverage(equipment, items, units, zusatz, checkouts)
  const rows = coverage.lines.map((line) => rowOf(line, items, nodes))
  return {
    rows,
    // Fehlend ist beides: gar nicht im Lager, und zu wenig davon. Ein
    // Vorschlag zählt NICHT als gedeckt — solange ihn niemand bestätigt hat,
    // ist die Deckung offen.
    missing: rows.filter(
      (r) => r.outcome !== 'matched-by-type' || (r.short !== undefined && r.short > 0),
    ),
    matched: coverage.matched,
    proposed: coverage.proposed,
    unmatched: coverage.unmatched,
  }
}

/** Die kaufmännische Sicht: was der Plan braucht, mit Deckungsstand. */
export const planBomCsv = (bom: PlanBom): string =>
  toCsv(
    // Bedarf 80: „Bestand" und „Verfuegbar" stehen NEBENEINANDER, und dazu
    // die Bindung im Klartext. Eine einzige Spalte „Bestand" liest jeder als
    // „so viel kann ich einplanen" — und genau daran haengt der Befund.
    [
      'Menge',
      'Modell',
      'Kategorie',
      'Deckung',
      'Bestand',
      'Verfügbar',
      'Auf offener Ausgabe',
      'Fehlmenge',
      'Nicht einsatzbereit',
      'Hinweis',
    ],
    bom.rows.map((r) => [
      r.quantity,
      r.model,
      r.category ?? '',
      outcomeLabel(r.outcome),
      r.stock ?? '',
      r.available ?? '',
      r.commitmentNote ?? '',
      r.short ?? '',
      r.unusable ?? '',
      r.reason ?? (r.modelIsDeviceName ? 'Ohne Katalog-Typ — Modellname ist der Gerätename.' : ''),
    ]),
  )

/**
 * Die Lager-Sicht: was gedeckt ist, sortiert nach Lagerort, damit man den Weg
 * durchs Depot einmal geht statt dreimal.
 *
 * Vorschläge stehen bewusst NICHT drin: Wer kommissioniert, soll nicht
 * unterwegs entscheiden müssen, ob eine Zuordnung stimmt.
 *
 * EINE ZEILE JE LAGERORT, NICHT JE MODELL. Liegt dasselbe Modell in zwei
 * Cases, bekommt jeder Ort seine eigene Zeile mit der dort zu entnehmenden
 * Menge. Vorher stand eine Zeile mit dem ERSTEN Ort und der VOLLEN Menge da —
 * der zweite Ort kam in der Liste nicht vor.
 *
 * UND DIE FEHLMENGE STEHT DRIN. Der Docstring versprach „nur sicher
 * Gedecktes", gefiltert wurde aber allein auf `outcome === 'matched-by-type'`
 * — eine Zeile mit `short > 0` blieb mit der vollen Bedarfsmenge stehen,
 * obwohl `buildPlanBom` dieselbe Zeile 30 Zeilen weiter oben zu `missing`
 * zählt. Zwei Funktionen derselben Datei waren sich nicht einig, was
 * „gedeckt" heißt.
 *
 * Sie ganz herauszuwerfen wäre die andere falsche Antwort: die drei Stück,
 * die da sind, will der Kommissionierer trotzdem mitnehmen. Sie steht also
 * drin — mit der Menge, die wirklich da ist, und der Fehlmenge daneben. Das
 * ist dieselbe Regel wie im Modulkopf: was unsicher ist, muss als unsicher
 * lesbar bleiben, nicht verschwinden und nicht sicher aussehen.
 */
export const pickListCsv = (bom: PlanBom): string => {
  const zeilen: Array<[string, number, string, number, number | string, string]> = []
  for (const r of bom.rows) {
    if (r.outcome !== 'matched-by-type') continue
    const orte = r.locations ?? []
    let offen = r.quantity
    for (const o of orte) {
      if (offen <= 0) break
      const nehmen = Math.min(offen, o.available)
      if (nehmen <= 0) continue
      offen -= nehmen
      zeilen.push([o.location, nehmen, r.model, o.available, '', ''])
    }
    // Fehlmenge: eine eigene Zeile ohne Lagerort — es gibt keinen Ort, an dem
    // sie läge. Auch dann, wenn gar keine Position einen Lagerort trug.
    //
    // BEDARF 64: mit dem GRUND, soweit er bekannt ist. Der Bedarf verlangt
    // ausdruecklich „which job holds it" — und ohne diesen Hinweis sucht der
    // Kommissionierer das fuenfte Stueck im Regal, obwohl es auf einem Truck
    // steht. Seit Bedarf 80 weiss die Zeile das; sie hat es nur nicht gesagt.
    if (offen > 0) zeilen.push(['', 0, r.model, 0, offen, r.commitmentNote ?? ''])
  }
  return toCsv(
    // „Bestand" stand hier ueber `o.available` — also ueber der bereits um
    // offene Ausgaben und unbrauchbare Einheiten bereinigten Zahl. Genau die
    // Verwechslung, gegen die Bedarf 80 die zweite Spalte eingezogen hat: wer
    // „Bestand 3" liest, plant mit 3, auch wenn zwei davon auf einem Truck
    // stehen. Die Spalte heisst, was in ihr steht.
    ['Lagerort', 'Menge', 'Modell', 'Verfügbar', 'Fehlmenge', 'Grund'],
    zeilen
      .slice()
      .sort((a, b) => a[0].localeCompare(b[0], 'de') || a[2].localeCompare(b[2], 'de')),
  )
}
