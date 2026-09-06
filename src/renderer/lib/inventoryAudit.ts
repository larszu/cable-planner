// ───────────────────────────────────────────────────────────────────────────
// Inventur: „ist das hier, wo es hingehoert?" (Bedarf 66, P2 — und die
// Restreibung aus Bedarf 69).
//
// WAS BEDARF 66 SAGT:
//
//   > Bulk audit by scanning shows only green (in database) / red (not in
//   > database). No model, no location, no wrong-place flag — so the audit
//   > finds nothing actionable, and IN AN AV WAREHOUSE WRONG-PLACE IS THE
//   > NORMAL OUTCOME OF EVERY LOAD-OUT.
//
//   > If the suite ever offers a stock-taking or 'verify this rack' mode, the
//   > result row must carry EXPECTED-VS-ACTUAL LOCATION and RECORD THE ACTUAL
//   > ONE. This is also the cheapest path to keeping the plan's as-built
//   > container tree honest.
//
// Beleg: grokability/snipe-it#8095 (2020-05, offen, zuletzt 2025-06,
// 9 Kommentare) — verlangt Modell und Lagerort in der Ergebniszeile, eine
// DRITTE Farbe fuer den falschen Ort, und dass solche Objekte trotzdem als
// „am gepruefen Ort gefunden" verbucht werden.
//
// ─── ZWEI FARBEN SIND EINE ZU WENIG ────────────────────────────────────────
//
// „Im Bestand / nicht im Bestand" beantwortet die Frage nicht, die im Lager
// gestellt wird. Fast alles ist im Bestand; die Frage ist, ob es DA ist, wo
// der Datensatz es vermutet. Deshalb gibt es hier vier benannte Ergebnisse,
// und `wrong-place` ist das haeufigste — nicht das Ausnahmefall.
//
// ─── DIE REIBUNG AUS BEDARF 69, DIE HIER IHR ZUHAUSE FINDET ────────────────
//
//   > the scan resolves to the company default warehouse rather than where the
//   > stock is […] location-context-first
//
// `auditScan` verlangt den Ort ALS ERSTES ARGUMENT. Ohne ihn gibt es kein
// Ergebnis — nicht weil das streng waere, sondern weil „gefunden" ohne „wo"
// keine Auskunft ist. Das ist derselbe Grund, aus dem der Befund den
// Standard-Lagerort beklagt.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { InventoryItem, StorageNode, InventoryUnit } from '../types/inventory'
import { unitLabel } from './unitIdentity'
import { resolveInventoryCode, type ScanSources } from './inventoryScan'
import { descendantNodeIds, nodePathLabel } from './storageTree'
import type { CsvCell, CsvTable } from './csv'

export type AuditOutcome =
  /** Der Datensatz sagt: liegt hier (oder in einem Behaelter hier drin). */
  | 'expected-here'
  /** Es gibt das Objekt, aber der Datensatz verortet es woanders. */
  | 'wrong-place'
  /** Der Datensatz kennt keinen Lagerort dafuer. Nicht dasselbe wie „falscher
   *  Ort": hier gibt es nichts zu widerlegen, nur etwas nachzutragen. */
  | 'no-location'
  /** Der Code gehoert zu keinem Objekt im Bestand. */
  | 'not-in-inventory'
  /** Der Code gehoert zu einem LAGERORT. Beim Inventieren ist das fast immer
   *  ein Griff daneben — jemand scannt das Case-Etikett statt des Inhalts —,
   *  und es als „nicht im Bestand" zu melden waere schlicht falsch. */
  | 'is-a-location'

export interface AuditHit {
  outcome: AuditOutcome
  /** Der gescannte Code, wie er eingegeben wurde. */
  code: string
  /** Menschenlesbare Bezeichnung des Getroffenen. Leer bei `not-in-inventory`. */
  label: string
  /** Modell — der Bedarf verlangt es ausdruecklich in der Ergebniszeile. */
  model?: string
  /** Wo der Datensatz es vermutet, als Pfad. Leer bei `no-location`. */
  expected?: string
  /** Was verschoben wuerde, wenn jemand den Ort uebernimmt. */
  itemId?: string
  unitId?: string
}

/**
 * Einen gescannten Code am geprueften Ort einordnen.
 *
 * `atNodeId` ist der Ort, an dem der Mensch STEHT — nicht der, an dem der
 * Datensatz das Objekt vermutet. Genau diese Unterscheidung fehlt in dem
 * Befund, den Bedarf 66 zitiert.
 *
 * „Hier" schliesst Behaelter ein: wer vor Regal A3 steht und ein Objekt aus
 * Case 1 in Regal A3 scannt, hat es am richtigen Ort. Eine Inventur, die den
 * Teilbaum nicht mitzaehlt, meldete jedes eingepackte Objekt als verstellt.
 */
export function auditScan(
  code: string,
  atNodeId: string,
  sources: ScanSources,
): AuditHit {
  const roh = code.trim()
  const treffer = resolveInventoryCode(roh, sources)
  if (!treffer) return { outcome: 'not-in-inventory', code: roh, label: '' }

  if (treffer.kind === 'node') {
    return { outcome: 'is-a-location', code: roh, label: treffer.node.name }
  }

  const hier = new Set([atNodeId, ...descendantNodeIds(sources.nodes, atNodeId)])

  if (treffer.kind === 'unit') {
    const u: InventoryUnit = treffer.unit
    const model = sources.items.find((i) => i.id === u.itemId)?.model
    // Bedarf 107 — die Inventur zaehlt im eigenen Haus.
    const label = unitLabel(u, 'house')
    if (!u.locationId) {
      return { outcome: 'no-location', code: roh, label, ...(model ? { model } : {}), unitId: u.id }
    }
    return {
      outcome: hier.has(u.locationId) ? 'expected-here' : 'wrong-place',
      code: roh,
      label,
      ...(model ? { model } : {}),
      expected: nodePathLabel(sources.nodes, u.locationId),
      unitId: u.id,
    }
  }

  const it: InventoryItem = treffer.item
  if (!it.locationId) {
    return { outcome: 'no-location', code: roh, label: it.model, model: it.model, itemId: it.id }
  }
  return {
    outcome: hier.has(it.locationId) ? 'expected-here' : 'wrong-place',
    code: roh,
    label: it.model,
    model: it.model,
    expected: nodePathLabel(sources.nodes, it.locationId),
    itemId: it.id,
  }
}

/**
 * Das Inventur-Blatt.
 *
 * Modell UND Ort in jeder Zeile — beides verlangt der Beleg ausdruecklich,
 * und ohne beides „finds nothing actionable". Der geprueften Ort steht als
 * eigene Spalte daneben: erst der Vergleich der beiden macht die Zeile
 * verwertbar.
 */
export function auditTable(hits: AuditHit[], nodes: StorageNode[], atNodeId: string): CsvTable {
  const geprueft = nodePathLabel(nodes, atNodeId)
  return {
    headers: ['Ergebnis', 'Code', 'Objekt', 'Modell', 'Erwartet in', 'Geprueft an'],
    rows: hits.map((h): CsvCell[] => [
      AUDIT_LABEL[h.outcome],
      h.code,
      h.label,
      h.model ?? '',
      // Leer heisst hier „kein Lagerort im Datensatz" und ist selbst die
      // Aussage — nicht dasselbe wie ein falscher Ort.
      h.expected ?? '',
      geprueft,
    ]),
  }
}

/** Kanonisches Deutsch fuer das Blatt — der Stand haengt am Inhalt. */
export const AUDIT_LABEL: Record<AuditOutcome, string> = {
  'expected-here': 'Am erwarteten Ort',
  'wrong-place': 'Am falschen Ort',
  'no-location': 'Ohne Lagerort im Datensatz',
  'not-in-inventory': 'Nicht im Bestand',
  'is-a-location': 'Das ist ein Lagerort, kein Objekt',
}

/**
 * Was eine Uebernahme des tatsaechlichen Ortes aendern wuerde.
 *
 * Der Beleg verlangt, dass ein am falschen Ort gefundenes Objekt trotzdem
 * „als am gepruefen Ort gefunden" verbucht wird. Das ist eine SCHREIBENDE
 * Handlung, und sie gehoert dem Menschen: diese Funktion sagt nur, was
 * passieren wuerde, und aendert nichts.
 */
export const auditRelocations = (hits: AuditHit[]): Array<{ itemId?: string; unitId?: string }> =>
  hits
    .filter((h) => h.outcome === 'wrong-place' || h.outcome === 'no-location')
    .map((h) => ({ ...(h.itemId ? { itemId: h.itemId } : {}), ...(h.unitId ? { unitId: h.unitId } : {}) }))
