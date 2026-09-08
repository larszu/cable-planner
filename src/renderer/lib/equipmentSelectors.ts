import { useMemo } from 'react'
import type { Cable } from '../types/cable'
import type { EquipmentItem, Port } from '../types/equipment'
import { useProjectStore } from '../store/projectStore'

/**
 * #304 — Zentrale Equipment-Lookup-Helper.
 *
 * Vor diesem Modul lagen 50+ inline `equipment.find(e => e.id === x)`-Calls
 * im Renderer verstreut. Bei groesseren Plaenen ist das O(N) pro Lookup,
 * schlimmer aber: jeder Lookup ist ein eigener Render-Subscription-Pfad mit
 * eigenem ad-hoc-Code. Die Helper hier konsolidieren das in eine Stelle.
 *
 * Pattern:
 *   - `getEquipmentById(equipment, id)` — pure helper fuer Stellen die schon
 *     ein Equipment-Array haben (z.B. innerhalb einer set()-Action im Store).
 *   - `useEquipmentById(id)` — Renderer-Hook der den Store subscribed und
 *     bei Project-Changes neu auswertet.
 *   - `useEquipmentMap()` — gibt eine memoized Map<id, item> zurueck.
 *     Sinnvoll fuer Stellen die mehrere Lookups pro Render-Frame machen
 *     (z.B. Kabel-Listen iterieren).
 */

export const getEquipmentById = (
  equipment: readonly EquipmentItem[],
  id: string | null | undefined,
): EquipmentItem | undefined => {
  if (!id) return undefined
  return equipment.find((e) => e.id === id)
}

export const getCableById = (
  cables: readonly Cable[],
  id: string | null | undefined,
): Cable | undefined => {
  if (!id) return undefined
  return cables.find((c) => c.id === id)
}

export const useEquipmentById = (id: string | undefined): EquipmentItem | undefined =>
  useProjectStore((s) => getEquipmentById(s.project.equipment, id))

export const useEquipmentMap = (): Map<string, EquipmentItem> => {
  const equipment = useProjectStore((s) => s.project.equipment)
  return useMemo(() => new Map(equipment.map((e) => [e.id, e])), [equipment])
}

/**
 * #124 — Loest die effektiven Ressourcen-Werte eines Geraets unter
 * Beruecksichtigung des aktiven Betriebsmodus auf. Ein Modus kann
 * `powerWatts`/`weightKg` ueberschreiben (z. B. hoehere Leistung im
 * 4K-Modus); ist der Modus-Wert `undefined`, gilt der Geraete-Wert.
 *
 * Bewusst nicht-destruktiv: der Geraete-Wert bleibt die Basis, sodass
 * ein Moduswechsel den Originalwert nie verliert.
 */
export const effectiveDeviceResources = (
  item: EquipmentItem,
): { powerWatts?: number; weightKg?: number } => {
  const mode = item.activeModeId
    ? item.modes?.find((m) => m.id === item.activeModeId)
    : undefined
  return {
    powerWatts: mode?.powerWatts ?? item.powerWatts,
    weightKg: mode?.weightKg ?? item.weightKg,
  }
}

/**
 * Die effektive Leistungsaufnahme eines Geraets in Watt.
 *
 * WARUM DAS HIER LIEGT. Diese Kette stand in VIER Kopien im Renderer, und
 * zwei davon liefen auseinander (gemessen 2026-09-04):
 *
 *   Analyse -> Gewicht/Waerme      beruecksichtigte den aktiven Modus
 *   Location-BOM                   beruecksichtigte den aktiven Modus
 *   Werkzeuge -> Stromverbrauch    NICHT
 *   Plan-Check (drawingChecks)     NICHT
 *
 * Derselbe Plan zeigte damit je nach Ansicht eine andere Zahl, sobald ein
 * Geraet einen aktiven Betriebsmodus mit eigener Leistung hatte. Und die
 * Ansicht, die zu NIEDRIG rechnete, war ausgerechnet der Stromrechner --
 * aus dessen Summe kommen Phasenverteilung, Neutralleiterstrom,
 * Generator-kVA, USV-Laufzeit und die Ueberlast-Warnung. Die
 * sicherheitsrelevante Ansicht war die optimistischere.
 *
 * `drawingChecks.ts` behauptete im Kopf sogar ausdruecklich, seine Helfer
 * seien "bewusst die GLEICHEN wie im AnalysisDialog" -- sie waren es nicht.
 *
 * REIHENFOLGE. Modus vor Geraete-Wert vor Import vor V x A. Der Modus-Wert
 * gewinnt, weil das Feld im Editor "Leistung (W) in diesem Modus" heisst: wer
 * ihn setzt, erwartet ihn in der Stromrechnung.
 *
 * `item.powerWatts` IST SEIT E-8 (2026-09-08) IN DER KETTE. Hier stand, das
 * sei eine Eigentuemer-Entscheidung, weil die Aufnahme "die Zahlen bestehender
 * Projekte veraendern" wuerde. Die Entscheidung ist gefallen, und mit ihr die
 * Einsicht, die den Einwand aufloest: Eine Lastrechnung, die eine BEKANNTE
 * Zahl ignoriert, ist nicht vorsichtig, sondern falsch — sie meldet 0 W fuer
 * ein Geraet, dessen Leistung im Projekt steht, und ein Geraet mit 0 W faellt
 * aus Summe, Phasenverteilung und Ueberlast-Warnung heraus. Die Aenderung ist
 * eine BERICHTIGUNG, kein Schaden.
 *
 * ZWEI BEDINGUNGEN GEHOEREN ZUR ENTSCHEIDUNG, und sie sind hier gebaut:
 *
 *  1. `powerConsumptionWatts` behaelt den Vorrang vor `powerWatts`. Das eine
 *     ist die geplante Angabe, das andere die importierte; wer geplant hat,
 *     hat entschieden.
 *  2. Die Zahl kommt nie ohne ihre HERKUNFT heraus (`wattsWithSource`). Eine
 *     Summe aus zwei Quellen ohne Herkunft ist genau die Zahl, an der jemand
 *     eine Verteilung zusagt.
 *
 * V x A steht NACH dem Import: der Import ist eine genannte Zahl, V x A eine
 * Rechnung aus zwei anderen Feldern, die oft Typenschild-Nennwerte sind.
 */

/** Woher die Leistung eines Geraets stammt. `none` = keine Angabe, 0 W. */
export type WattsSource = 'mode' | 'planned' | 'imported' | 'derived' | 'none'

export interface WattsReading {
  watts: number
  source: WattsSource
}

/** Die Leistung MIT ihrer Herkunft — die Engstelle, aus der `effectiveWatts` fliesst. */
export const wattsWithSource = (item: EquipmentItem): WattsReading => {
  const modePower = item.activeModeId
    ? item.modes?.find((m) => m.id === item.activeModeId)?.powerWatts
    : undefined
  if (modePower != null) return { watts: modePower, source: 'mode' }
  if (item.powerConsumptionWatts != null) {
    return { watts: item.powerConsumptionWatts, source: 'planned' }
  }
  if (item.powerWatts != null) return { watts: item.powerWatts, source: 'imported' }
  if (item.voltage && item.currentAmps) {
    return { watts: item.voltage * item.currentAmps, source: 'derived' }
  }
  return { watts: 0, source: 'none' }
}

export const effectiveWatts = (item: EquipmentItem): number => wattsWithSource(item).watts

/**
 * Helper fuer den haeufigen Pattern "Port aus dem Equipment ueber Port-ID
 * suchen", der sonst zweimal `find()` braucht.
 */
export const findPortInEquipment = (
  eq: EquipmentItem | undefined,
  portId: string | undefined,
): Port | undefined => {
  if (!eq || !portId) return undefined
  return (
    eq.inputs.find((p) => p.id === portId) ??
    eq.outputs.find((p) => p.id === portId)
  )
}
