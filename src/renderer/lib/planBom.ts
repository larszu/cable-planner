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
import type { InventoryItem, StorageNode } from '../types/inventory'
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
  /** Lagerort-Pfad („Depot › Regal A3 › Case 1"). Leer, wenn unbekannt. */
  location: string
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
  return {
    quantity: line.demand.quantity,
    model: line.demand.label,
    ...(line.demand.category ? { category: line.demand.category } : {}),
    outcome: line.outcome,
    ...(line.available !== undefined ? { available: line.available } : {}),
    ...(line.short !== undefined ? { short: line.short } : {}),
    // Der Lagerort gilt nur für eine echte Deckung: Bei einem Vorschlag ist
    // noch gar nicht sicher, dass es diese Position ist, und ein Regalplatz
    // liest sich wie eine Zusage.
    location:
      line.outcome === 'matched-by-type' && item?.locationId
        ? nodePathLabel(nodes, item.locationId)
        : '',
    ...(line.reason ? { reason: line.reason } : {}),
    modelIsDeviceName: line.demand.labelIsDeviceName,
    ...(line.itemId ? { itemId: line.itemId } : {}),
    ...(line.demand.deviceTypeId ? { deviceTypeId: line.demand.deviceTypeId } : {}),
  }
}

export const buildPlanBom = (
  equipment: EquipmentItem[],
  items: InventoryItem[],
  nodes: StorageNode[],
): PlanBom => {
  const coverage = resolveCoverage(equipment, items)
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
    ['Menge', 'Modell', 'Kategorie', 'Deckung', 'Bestand', 'Fehlmenge', 'Hinweis'],
    bom.rows.map((r) => [
      r.quantity,
      r.model,
      r.category ?? '',
      outcomeLabel(r.outcome),
      r.available ?? '',
      r.short ?? '',
      r.reason ?? (r.modelIsDeviceName ? 'Ohne Katalog-Typ — Modellname ist der Gerätename.' : ''),
    ]),
  )

/**
 * Die Lager-Sicht: nur was sicher gedeckt ist, sortiert nach Lagerort, damit
 * man den Weg durchs Depot einmal geht statt dreimal.
 *
 * Vorschläge stehen bewusst NICHT drin: Wer kommissioniert, soll nicht
 * unterwegs entscheiden müssen, ob eine Zuordnung stimmt.
 */
export const pickListCsv = (bom: PlanBom): string =>
  toCsv(
    ['Lagerort', 'Menge', 'Modell', 'Bestand'],
    bom.rows
      .filter((r) => r.outcome === 'matched-by-type')
      .slice()
      .sort(
        (a, b) =>
          a.location.localeCompare(b.location, 'de') || a.model.localeCompare(b.model, 'de'),
      )
      .map((r) => [r.location, r.quantity, r.model, r.available ?? '']),
  )
