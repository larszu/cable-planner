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
import type { CsvCell, CsvTable } from '../../lib/csv'

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

/**
 * Wie ein Objekt in die Inventur kam (Bedarf 150).
 *
 * EIN SCAN UND EIN KLICK SIND NICHT DASSELBE. Wer scannt, hat das Etikett am
 * Objekt gelesen; wer aus der Liste tippt, hat eine Zeile angeklickt und
 * behauptet, das Ding liege hier. Beides ist zulaessig — das eine ist der
 * schnelle Weg, das andere der, der bleibt, wenn der Scanner leer ist oder
 * das Etikett fehlt. Beides in einen Topf zu werfen waere die stille Form
 * derselben Luege, gegen die dieses Repo an mehreren Stellen anschreibt:
 * Ablesung und Behauptung muessen unterscheidbar bleiben.
 */
export type AuditVia = 'scan' | 'pick'

export const AUDIT_VIA_LABEL: Record<AuditVia, string> = {
  scan: 'gescannt',
  pick: 'aus der Liste',
}

/** Was in der Code-Spalte steht, wo es keinen Code gab. */
export const NO_CODE = 'ohne Code'

export interface AuditHit {
  outcome: AuditOutcome
  /** Der gescannte Code, wie er eingegeben wurde. Leer bei einem Listen-Haken. */
  code: string
  /** Womit die Zeile belegt ist. Steht auf dem Blatt. */
  via: AuditVia
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
  if (!treffer) return { outcome: 'not-in-inventory', code: roh, via: 'scan', label: '' }

  if (treffer.kind === 'node') {
    return { outcome: 'is-a-location', code: roh, via: 'scan', label: treffer.node.name }
  }

  if (treffer.kind === 'unit') {
    return einordnen({ unit: treffer.unit }, atNodeId, sources, roh, 'scan')
  }
  return einordnen({ item: treffer.item }, atNodeId, sources, roh, 'scan')
}

/**
 * Die Einordnung — die eine Stelle, die entscheidet, was ein Objekt am
 * gepruefen Ort bedeutet.
 *
 * Sie ist herausgezogen, damit der Listen-Weg (Bedarf 150) durch DIESELBE
 * Regel geht wie der Scan. Ein zweiter Weg mit einer nachgebauten Einordnung
 * driftet still von seinem Vorbild weg, und dann faellt derselbe Karton am
 * Scanner als „am falschen Ort" und in der Liste als „am erwarteten Ort" auf.
 *
 * „Hier" schliesst Behaelter ein: wer vor Regal A3 steht und ein Objekt aus
 * Case 1 in Regal A3 erfasst, hat es am richtigen Ort. Eine Inventur, die den
 * Teilbaum nicht mitzaehlt, meldete jedes eingepackte Objekt als verstellt.
 */
function einordnen(
  ziel: { unit: InventoryUnit } | { item: InventoryItem },
  atNodeId: string,
  sources: ScanSources,
  code: string,
  via: AuditVia,
): AuditHit {
  const hier = new Set([atNodeId, ...descendantNodeIds(sources.nodes, atNodeId)])

  if ('unit' in ziel) {
    const u = ziel.unit
    const model = sources.items.find((i) => i.id === u.itemId)?.model
    // Bedarf 107 — die Inventur zaehlt im eigenen Haus.
    const label = unitLabel(u, 'house')
    if (!u.locationId) {
      return { outcome: 'no-location', code, via, label, ...(model ? { model } : {}), unitId: u.id }
    }
    return {
      outcome: hier.has(u.locationId) ? 'expected-here' : 'wrong-place',
      code,
      via,
      label,
      ...(model ? { model } : {}),
      expected: nodePathLabel(sources.nodes, u.locationId),
      unitId: u.id,
    }
  }

  const it = ziel.item
  if (!it.locationId) {
    return { outcome: 'no-location', code, via, label: it.model, model: it.model, itemId: it.id }
  }
  return {
    outcome: hier.has(it.locationId) ? 'expected-here' : 'wrong-place',
    code,
    via,
    label: it.model,
    model: it.model,
    expected: nodePathLabel(sources.nodes, it.locationId),
    itemId: it.id,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// BEDARF 150 — der Scanner ist der schnelle Weg, nie der einzige.
//
//   > A model-based reservation 'can only be turned into a concrete asset by
//   > scanning. There is no way to fulfil one by SELECTING AN ASSET FROM A
//   > LIST', and since model requests must all be fulfilled before checkout,
//   > a coordinator without a working scanner is BLOCKED OUTRIGHT.
//
// Beleg: `Shelf-nu/shelf.nu#2831` (2026-08-10). Der Melder haelt fest, dass
// jeder andere Weg im selben Programm eine Auswahl-Liste anbietet — nur
// dieser eine nicht.
//
// WAS HIER VORHER SCHON GING UND WARUM ES NICHT REICHTE. Die Inventur nahm
// getippte Codes an, nicht nur gescannte — das rettet den leeren Akku. Es
// rettet NICHT den Fall, den das Lager haeufiger hat: das Etikett ist ab,
// unlesbar, oder steckt in einem Case, das schon auf dem Lkw steht. Wer den
// Code nicht lesen kann, kann ihn auch nicht tippen. Der Weg, der dann
// bleibt, ist die Liste dessen, was hier liegen SOLL.
//
// UND DIE ZWEITE HAELFTE DERSELBEN SACHE: erst mit dieser Liste kann eine
// Inventur ueberhaupt sagen, was FEHLT. Vorher war sie rein additiv — sie
// zaehlte, was jemand erfasst hat, und ein Case, das niemand mehr findet,
// hinterliess keine Zeile. Genau das ist aber das Ergebnis, wegen dem
// inventiert wird.
// ───────────────────────────────────────────────────────────────────────────

/** Ein Eintrag der Liste dessen, was hier liegen soll. */
export interface AuditCandidate {
  /** Stabiler Schluessel fuer Liste und Abgleich. */
  key: string
  label: string
  model?: string
  /** Wo genau der Datensatz es vermutet (dieser Ort oder ein Behaelter darin). */
  expected: string
  itemId?: string
  unitId?: string
}

const candidateKey = (h: { itemId?: string; unitId?: string }): string =>
  h.unitId ? `u:${h.unitId}` : h.itemId ? `i:${h.itemId}` : ''

/**
 * Was der Datensatz an diesem Ort vermutet — die Liste zum Abhaken.
 *
 * Einheiten UND Artikel, denn beides traegt einen Lagerort. Der Teilbaum
 * zaehlt mit: wer vor Regal A3 steht, sieht auch, was in Case 1 in Regal A3
 * liegen soll — sonst waere die Liste bei jedem eingepackten Objekt leer,
 * und das ist im Lager der Normalfall.
 */
export function expectedAt(atNodeId: string, sources: ScanSources): AuditCandidate[] {
  const hier = new Set([atNodeId, ...descendantNodeIds(sources.nodes, atNodeId)])
  const out: AuditCandidate[] = []

  for (const u of sources.units) {
    if (!u.locationId || !hier.has(u.locationId)) continue
    const model = sources.items.find((i) => i.id === u.itemId)?.model
    out.push({
      key: `u:${u.id}`,
      label: unitLabel(u, 'house'),
      ...(model ? { model } : {}),
      expected: nodePathLabel(sources.nodes, u.locationId),
      unitId: u.id,
    })
  }
  for (const it of sources.items) {
    if (!it.locationId || !hier.has(it.locationId)) continue
    out.push({
      key: `i:${it.id}`,
      label: it.model,
      model: it.model,
      expected: nodePathLabel(sources.nodes, it.locationId),
      itemId: it.id,
    })
  }

  // Feste Reihenfolge: das Blatt soll bei gleichem Bestand gleich aussehen.
  return out.sort((a, b) => a.label.localeCompare(b.label, 'de') || a.key.localeCompare(b.key))
}

/**
 * Einen Eintrag der Liste als „liegt hier" verbuchen — OHNE Code.
 *
 * Geht durch dieselbe Einordnung wie ein Scan (`einordnen`), traegt aber
 * `via: 'pick'`: das Blatt soll spaeter unterscheiden koennen, ob jemand das
 * Etikett gelesen oder eine Zeile angeklickt hat.
 *
 * Ein Eintrag, den `expectedAt` nicht kennt, ergibt `not-in-inventory` —
 * dieselbe Auskunft wie ein unbekannter Code, statt eines erfundenen Objekts.
 */
export function auditPick(
  candidate: AuditCandidate,
  atNodeId: string,
  sources: ScanSources,
): AuditHit {
  if (candidate.unitId) {
    const u = sources.units.find((x) => x.id === candidate.unitId)
    if (u) return einordnen({ unit: u }, atNodeId, sources, '', 'pick')
  }
  if (candidate.itemId) {
    const it = sources.items.find((x) => x.id === candidate.itemId)
    if (it) return einordnen({ item: it }, atNodeId, sources, '', 'pick')
  }
  return { outcome: 'not-in-inventory', code: '', via: 'pick', label: candidate.label }
}

/**
 * Was hier liegen soll und niemand erfasst hat.
 *
 * Das ist das eigentliche Ergebnis einer Inventur, und bis Bedarf 150 gab es
 * dafuer keine Zeile: die Liste zaehlte nur, was jemand vorgezeigt hat. Ein
 * Case, das niemand mehr findet, verschwand damit auch aus dem Blatt.
 */
export function missingAt(
  atNodeId: string,
  sources: ScanSources,
  hits: readonly AuditHit[],
): AuditCandidate[] {
  // NUR `expected-here` schliesst eine Luecke. Ein Objekt, das am falschen
  // Ort auftaucht, ist damit nicht dort gefunden, wo der Datensatz es
  // vermutet — dort fehlt es weiterhin. Wuerde hier jeder Treffer abgezogen,
  // meldete das Blatt eine Luecke als geschlossen, die es nicht ist, und
  // zwar ausgerechnet bei dem Fall, der im Lager der haeufigste ist.
  const erfasst = new Set(
    hits.filter((h) => h.outcome === 'expected-here').map(candidateKey).filter(Boolean),
  )
  return expectedAt(atNodeId, sources).filter((c) => !erfasst.has(c.key))
}

/** Was auf dem Blatt steht, wo etwas erwartet, aber nicht erfasst wurde. */
export const NOT_FOUND = 'Nicht gefunden'

/**
 * Das Inventur-Blatt.
 *
 * Modell UND Ort in jeder Zeile — beides verlangt der Beleg ausdruecklich,
 * und ohne beides „finds nothing actionable". Der geprueften Ort steht als
 * eigene Spalte daneben: erst der Vergleich der beiden macht die Zeile
 * verwertbar.
 */
export function auditTable(
  hits: AuditHit[],
  nodes: StorageNode[],
  atNodeId: string,
  /**
   * Was hier erwartet wurde und niemand erfasst hat (Bedarf 150). Optional,
   * damit ein Aufrufer ohne Bestandsquelle das Blatt weiterhin bekommt —
   * ohne die Liste steht dann aber auch keine Fehlt-Zeile darauf, und das ist
   * der ehrliche Zustand: nicht „nichts fehlt", sondern „nicht nachgesehen".
   */
  missing: readonly AuditCandidate[] = [],
): CsvTable {
  const geprueft = nodePathLabel(nodes, atNodeId)
  return {
    headers: ['Ergebnis', 'Wie erfasst', 'Code', 'Objekt', 'Modell', 'Erwartet in', 'Geprüft an'],
    rows: [
      ...hits.map((h): CsvCell[] => [
        AUDIT_LABEL[h.outcome],
        AUDIT_VIA_LABEL[h.via],
        // Ein Listen-Haken hat keinen Code. Die Zelle bleibt nicht leer: eine
        // leere Zelle liest sich, als sei der Code vergessen worden.
        h.via === 'pick' ? NO_CODE : h.code,
        h.label,
        h.model ?? '',
        // Leer heisst hier „kein Lagerort im Datensatz" und ist selbst die
        // Aussage — nicht dasselbe wie ein falscher Ort.
        h.expected ?? '',
        geprueft,
      ]),
      ...missing.map((c): CsvCell[] => [
        NOT_FOUND,
        // Weder gescannt noch angehakt — deshalb steht hier keines von
        // beiden. Der Strich ist die Aussage.
        '—',
        NO_CODE,
        c.label,
        c.model ?? '',
        c.expected,
        geprueft,
      ]),
    ],
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
