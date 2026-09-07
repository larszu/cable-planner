// ───────────────────────────────────────────────────────────────────────────
// Umräumen ist ein Vorgang, keine Nebenwirkung (Bedarf 106, P3).
//
// Die Begründung steht vollständig in `types/storageMove.ts`. Hier stehen die
// beiden Regeln, die dabei entstehen, und beide sind rein:
//
//   1. `moveRefusal` — WARUM ein Umzug nicht geht, statt dass er still nicht
//      passiert. Der Zyklus-Schutz in `moveNode` gab bisher `{}` zurück: die
//      Kiste blieb stehen, und niemand erfuhr, warum. Ein Vorgang, der ohne
//      Grund nichts tut, ist für den Bedienenden ununterscheidbar von einem
//      kaputten Programm — und beim nächsten Mal räumt er wieder von Hand um
//      und trägt es nirgends ein. Genau das ist die stale location aus dem
//      Beleg.
//
//   2. `lastKnownPlace` — wo etwas zuletzt HINGEBUCHT wurde, aus dem Journal
//      und nicht aus dem aktuellen Feld. Die beiden können auseinandergehen
//      (jemand hat den Lagerort gelöscht), und dann ist die Journal-Antwort
//      die brauchbarere: sie nennt den Klartext-Pfad von damals.
//
// REIN: keine Uhr, kein Store, kein IO. Die Zeitstempel kommen von aussen —
// dieselbe Regel wie bei `faultHistory` und `documentLog`.
// ───────────────────────────────────────────────────────────────────────────

import type { StorageNode, InventoryItem, InventoryUnit } from '../types/inventory'
import type { MoveRefusal, MoveSubjectKind, StorageMove } from '../types/storageMove'
import { MOVE_SUBJECT_LABEL } from '../types/storageMove'
import { nodePathLabel, wouldCreateCycle } from './storageTree'
import type { CsvCell, CsvTable } from '../../lib/csv'

/** Was dasteht, wo ein Lagerort nicht (mehr) auflösbar ist. */
export const UNKNOWN_PLACE = 'nicht mehr im Lager'
/** Was dasteht, wo etwas nie eingeräumt wurde. */
export const NEVER_PLACED = 'nie eingeräumt'

/**
 * Prüft einen geplanten Umzug und benennt, was ihn verhindert.
 *
 * `null` heisst: er geht. Jeder andere Wert ist ein Grund, den der Aufrufer
 * ANZEIGEN soll — nicht verschlucken.
 *
 * `same-place` ist bewusst eine Ablehnung und kein stiller Erfolg: ein
 * Journal-Eintrag „von Regal A nach Regal A" wäre eine Bewegung, die es nie
 * gab, und wer das Journal später liest, zählt sie mit.
 */
export function moveRefusal(
  nodes: readonly StorageNode[],
  kind: MoveSubjectKind,
  subject: { id: string; currentPlaceId?: string } | undefined,
  targetId: string | undefined,
): MoveRefusal | null {
  if (!subject) return 'unknown-subject'
  if (targetId !== undefined && !nodes.some((n) => n.id === targetId)) return 'unknown-target'
  if (subject.currentPlaceId === targetId) return 'same-place'
  // Nur ein Knoten kann in sich selbst landen; ein Artikel oder eine Einheit
  // ist kein Container und hat keine Nachfahren.
  if (kind === 'node' && wouldCreateCycle([...nodes], subject.id, targetId)) return 'cycle'
  return null
}

/**
 * Ein Journal-Eintrag, fertig zum Anhängen.
 *
 * Der Zeitstempel und der Klartext-Pfad werden ÜBERGEBEN und nicht hier
 * berechnet: die Uhr gehört dem Store, und der Pfad gehört dem Moment des
 * Vorgangs — später umbenannt sagt er etwas anderes.
 */
export function buildMove(
  at: string,
  kind: MoveSubjectKind,
  subjectId: string,
  fromId: string | undefined,
  toId: string | undefined,
  toLabel: string | undefined,
  note?: string,
): StorageMove {
  return {
    at,
    kind,
    subjectId,
    ...(fromId ? { fromId } : {}),
    ...(toId ? { toId } : {}),
    ...(toLabel ? { toLabel } : {}),
    ...(note ? { note } : {}),
  }
}

/** Die Einträge zu einem Objekt, jüngster zuerst. */
export function movesOf(
  moves: readonly StorageMove[],
  kind: MoveSubjectKind,
  subjectId: string,
): StorageMove[] {
  return moves
    .filter((m) => m.kind === kind && m.subjectId === subjectId)
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))
}

/**
 * Wo etwas zuletzt hingebucht wurde — aus dem Journal.
 *
 * Liefert den Klartext, wie er beim Vorgang galt. Ohne Eintrag steht
 * `nie eingeräumt` da; wurde zuletzt herausgenommen (`toId` fehlt), steht
 * `nicht mehr im Lager`. Beides sind benannte Antworten, keine leeren Zellen.
 */
export function lastKnownPlace(
  moves: readonly StorageMove[],
  kind: MoveSubjectKind,
  subjectId: string,
): string {
  const letzte = movesOf(moves, kind, subjectId)[0]
  if (!letzte) return NEVER_PLACED
  if (!letzte.toId) return UNKNOWN_PLACE
  return letzte.toLabel || letzte.toId
}

/**
 * Das Journal als Blatt.
 *
 * Der Ziel-Pfad kommt aus dem Eintrag und wird NICHT aus dem heutigen Baum
 * neu berechnet: das Journal soll sagen, wo etwas damals hingebucht wurde,
 * auch wenn der Lagerort inzwischen anders heisst oder gelöscht ist.
 */
export function moveTable(
  moves: readonly StorageMove[],
  nodes: readonly StorageNode[],
  nameOf: (kind: MoveSubjectKind, id: string) => string,
): CsvTable {
  const pfad = (id: string | undefined): string => {
    if (!id) return UNKNOWN_PLACE
    return nodes.some((n) => n.id === id) ? nodePathLabel([...nodes], id) : UNKNOWN_PLACE
  }
  return {
    headers: ['Zeitpunkt', 'Art', 'Objekt', 'Von', 'Nach', 'Notiz'],
    rows: moves
      .slice()
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((m): CsvCell[] => [
        m.at,
        MOVE_SUBJECT_LABEL[m.kind],
        nameOf(m.kind, m.subjectId),
        pfad(m.fromId),
        m.toLabel || pfad(m.toId),
        m.note ?? '',
      ]),
  }
}

/**
 * Objekte, deren erfasster Lagerort nie durch einen Vorgang entstanden ist.
 *
 * Der Beleg beschreibt genau diesen Zustand: Leute überspringen die
 * Umbuchung, weil sie zu teuer ist, und der erfasste Ort veraltet. Wo ein
 * Lagerort steht, aber kein Eintrag ihn erklärt, ist er entweder von Hand
 * gesetzt worden oder älter als das Journal — beides ist eine Auskunft, die
 * niemand belegen kann.
 */
export interface UnjournalledPlace {
  kind: MoveSubjectKind
  id: string
  placeId: string
}

export function unjournalledPlaces(
  moves: readonly StorageMove[],
  items: readonly InventoryItem[],
  units: readonly InventoryUnit[],
): UnjournalledPlace[] {
  const hatEintrag = (kind: MoveSubjectKind, id: string): boolean =>
    moves.some((m) => m.kind === kind && m.subjectId === id)
  const out: UnjournalledPlace[] = []
  for (const it of items) {
    if (it.locationId && !hatEintrag('item', it.id)) {
      out.push({ kind: 'item', id: it.id, placeId: it.locationId })
    }
  }
  for (const u of units) {
    if (u.locationId && !hatEintrag('unit', u.id)) {
      out.push({ kind: 'unit', id: u.id, placeId: u.locationId })
    }
  }
  return out
}
