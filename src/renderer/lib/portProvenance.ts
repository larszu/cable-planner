// ───────────────────────────────────────────────────────────────────────────
// Was mit dem Herkunfts-Beleg der Ports passiert, wenn ein Mensch sie anfasst.
//
// WARUM DAS EINE EIGENE DATEI IST. Die Entscheidung stand als Rumpf in
// `PortsSection.applyPorts` — also in einer React-Komponente, die kein Test
// faehrt. Der Guard in `tests/portsGuessed.test.ts` prueft deshalb bis heute
// nur, dass die Zeichenketten `delete rest.inputs` / `delete rest.outputs` im
// Quelltext STEHEN. Er kann nicht sagen, WELCHE Aenderung loeschen darf, und
// genau dort lagen zwei Fehler (gemessen 2026-09-04):
//
//   1. Jede Aenderung loeschte BEIDE Seiten. Ein Zeichen im Namensfeld eines
//      Inputs nahm auch dem Output-Beleg seine Grundlage.
//   2. Eine reine Umsortierung loeschte ebenfalls — `PortList.handleDragEnd`
//      ruft `onChange(arrayMove(ports, …))`, kein Wert aendert sich dabei.
//      Danach schweigt Pruefung 18, und der Nutzer hat weiter geratene Ports
//      im Plan, aber keine Warnung mehr. Genau das Schweigen, gegen das #650
//      geschrieben wurde.
//
// DER MASSSTAB. Der Beleg behauptet eine HERKUNFT: „diese Werte kamen aus
// einem Vorschlag". Wer sie umsortiert, aendert nicht, woher sie stammen. Wer
// einen Port hinzufuegt, entfernt oder ein Feld daran aendert, schon — fuer
// DIESE Seite.
// ───────────────────────────────────────────────────────────────────────────

import type { EquipmentItem, Port } from '../types/equipment'

/** Ports sind gleich, wenn dieselben Werte da sind — Reihenfolge egal. */
export const portsUnveraendert = (vorher: Port[], nachher: Port[]): boolean => {
  if (vorher.length !== nachher.length) return false
  const schluessel = (p: Port) =>
    JSON.stringify(Object.entries(p).sort(([a], [b]) => a.localeCompare(b)))
  const a = vorher.map(schluessel).sort()
  const b = nachher.map(schluessel).sort()
  return a.every((x, i) => x === b[i])
}

export interface PortProvenanceUpdate {
  /** Steht drin, wenn sich am Beleg etwas aendert. Sonst gar nicht patchen. */
  specSource?: EquipmentItem['specSource']
  /** Nur zur Nachvollziehbarkeit in Tests und Fehlersuche. */
  inputsWeg: boolean
  outputsWeg: boolean
}

/**
 * Der Beleg nach einer Port-Aenderung.
 *
 * Liefert `specSource: undefined` im Ergebnis-Objekt NUR dann, wenn wirklich
 * etwas abzuraeumen ist — der Aufrufer erkennt das an `inputsWeg`/`outputsWeg`
 * und patcht sonst nichts. Ein bedingungsloses `specSource: undefined` waere
 * dasselbe wie das alte Verhalten.
 */
export const portProvenanceUpdate = (
  equipment: Pick<EquipmentItem, 'inputs' | 'outputs' | 'specSource'>,
  patch: Partial<Pick<EquipmentItem, 'inputs' | 'outputs'>>,
): PortProvenanceUpdate => {
  const inputsWeg =
    Boolean(equipment.specSource?.inputs) &&
    patch.inputs !== undefined &&
    !portsUnveraendert(equipment.inputs, patch.inputs)
  const outputsWeg =
    Boolean(equipment.specSource?.outputs) &&
    patch.outputs !== undefined &&
    !portsUnveraendert(equipment.outputs, patch.outputs)
  if (!inputsWeg && !outputsWeg) return { inputsWeg: false, outputsWeg: false }
  const rest = { ...(equipment.specSource ?? {}) }
  if (inputsWeg) delete rest.inputs
  if (outputsWeg) delete rest.outputs
  return {
    inputsWeg,
    outputsWeg,
    specSource: Object.keys(rest).length > 0 ? rest : undefined,
  }
}
