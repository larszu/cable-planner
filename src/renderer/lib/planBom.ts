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

import type { EquipmentItem } from '../types/equipment'
import type { InventoryItem, InventoryUnit, StorageNode } from '../types/inventory'
import { resolveCoverage, type CoverageLine, type CoverageOutcome } from './inventoryCoverage'
import { nodePathLabel } from './storageTree'
import { toCsv } from './csv'

export interface PlanBomRow {
  /** Anzahl im Plan. */
  quantity: number
  /** Modellname (Katalog, sonst Gerätename). */
  model: string
  category?: string
  outcome: CoverageOutcome
  /** Bestand der deckenden bzw. vorgeschlagenen Position. */
  available?: number
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
  const rackHinweis =
    racks.length > 0 ? `Aus dem Innenleben von: ${racks.join(', ')}.` : ''
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
    ...(line.itemId ? { itemId: line.itemId } : {}),
    ...(line.demand.deviceTypeId ? { deviceTypeId: line.demand.deviceTypeId } : {}),
  }
}

export const buildPlanBom = (
  equipment: EquipmentItem[],
  items: InventoryItem[],
  nodes: StorageNode[],
  units: InventoryUnit[] = [],
): PlanBom => {
  const coverage = resolveCoverage(equipment, items, units)
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
    ['Menge', 'Modell', 'Kategorie', 'Deckung', 'Bestand', 'Fehlmenge', 'Nicht einsatzbereit', 'Hinweis'],
    bom.rows.map((r) => [
      r.quantity,
      r.model,
      r.category ?? '',
      outcomeLabel(r.outcome),
      r.available ?? '',
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
  const zeilen: Array<[string, number, string, number, number | string]> = []
  for (const r of bom.rows) {
    if (r.outcome !== 'matched-by-type') continue
    const orte = r.locations ?? []
    let offen = r.quantity
    for (const o of orte) {
      if (offen <= 0) break
      const nehmen = Math.min(offen, o.available)
      if (nehmen <= 0) continue
      offen -= nehmen
      zeilen.push([o.location, nehmen, r.model, o.available, ''])
    }
    // Fehlmenge: eine eigene Zeile ohne Lagerort — es gibt keinen Ort, an dem
    // sie läge. Auch dann, wenn gar keine Position einen Lagerort trug.
    if (offen > 0) zeilen.push(['', 0, r.model, 0, offen])
  }
  return toCsv(
    ['Lagerort', 'Menge', 'Modell', 'Bestand', 'Fehlmenge'],
    zeilen
      .slice()
      .sort((a, b) => a[0].localeCompare(b[0], 'de') || a[2].localeCompare(b[2], 'de')),
  )
}
