import { create } from 'zustand'
import { STORAGE_KEYS } from '../lib/storageKeys'
import type { MoveRefusal, MoveSubjectKind, StorageMove } from '../types/storageMove'
import { buildMove } from '../lib/storageMoves'

/**
 * Bedarf 106 — das Umräum-Journal. Eigener Store, eigener localStorage-Key.
 *
 *   > Re-shelving after check-in or consolidating a bay requires a FAKE
 *   > CHECK-OUT to an arbitrary user/location followed by a check-in. […] So
 *   > people skip it and THE RECORDED LOCATION GOES STALE.
 *
 * WARUM NICHT IM INVENTORY-STORE: aus demselben Grund wie beim Ausgabe-Beleg
 * (`checkoutStore`). Dessen `exportSnapshot` ist das portable Format
 * `avplan-inventory`, in allen drei Apps byte-identisch eingefroren. Ein
 * Umräum-Eintrag ist Betriebszustand EINES Lagers: `fromId`/`toId` benennen
 * Regale, die es in einer fremden Installation nicht gibt. Die Historie der
 * EINHEIT liegt dagegen im Format, weil sie am physischen Objekt hängt und
 * mitfährt — ein Regalplatz nicht.
 *
 * Der Store hält KEINE Bestandsdaten. Wer bucht, reicht Lagerbaum und Objekt
 * als Argument herein; so gibt es keine zweite Kopie des Lagers, die veralten
 * könnte.
 */

const KEY = STORAGE_KEYS.storageMoves

const istEintrag = (v: unknown): v is StorageMove => {
  if (!v || typeof v !== 'object') return false
  const m = v as Partial<StorageMove>
  return (
    typeof m.at === 'string' &&
    !!m.at &&
    (m.kind === 'node' || m.kind === 'item' || m.kind === 'unit') &&
    typeof m.subjectId === 'string' &&
    !!m.subjectId
  )
}

const load = (): StorageMove[] => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(istEintrag)
  } catch {
    return []
  }
}

const persist = (moves: StorageMove[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(moves))
  } catch {
    /* ignore */
  }
}

interface StorageMoveState {
  moves: StorageMove[]
  /**
   * Einen Umzug festhalten.
   *
   * Der Aufrufer hat ihn bereits geprüft (`moveRefusal`) und ausgeführt; hier
   * wird nur noch protokolliert. Append-only: ein Eintrag wird nicht
   * bearbeitet und nicht gelöscht — ein überschriebener Umräum-Eintrag wäre
   * genau das Vergessen, gegen das dieser Bedarf geschrieben ist.
   */
  record: (
    kind: MoveSubjectKind,
    subjectId: string,
    fromId: string | undefined,
    toId: string | undefined,
    toLabel: string | undefined,
    note?: string,
  ) => void
  /** Alles vergessen (nur für Test/Reset). */
  clear: () => void
}

export const useStorageMoveStore = create<StorageMoveState>((set) => ({
  moves: load(),
  record: (kind, subjectId, fromId, toId, toLabel, note) =>
    set((state) => {
      const moves = [
        ...state.moves,
        buildMove(new Date().toISOString(), kind, subjectId, fromId, toId, toLabel, note),
      ]
      persist(moves)
      return { moves }
    }),
  clear: () =>
    set(() => {
      persist([])
      return { moves: [] }
    }),
}))

/** Erneut exportiert, damit Aufrufer die Absage-Arten nicht doppelt importieren. */
export type { MoveRefusal }
