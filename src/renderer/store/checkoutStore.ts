import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { STORAGE_KEYS } from '../lib/storageKeys'
import type { CheckoutLine, CheckoutRecord } from '../types/checkout'
import {
  buildCheckout,
  closeCheckout,
  containerContents,
  type CheckoutRefusal,
  type InventorySnapshotIn,
} from '../lib/containerCheckout'

/**
 * Bedarf 15 — die Ausgabe-Belege. Eigener Store, eigener localStorage-Key.
 *
 * WARUM NICHT IM INVENTORY-STORE: dessen `exportSnapshot` ist das portable
 * Format `avplan-inventory`, dessen Envelope in allen drei Apps
 * byte-identisch eingefroren ist (`tests/inventoryContract.test.ts`). Der
 * Bestand ist ein KATALOG und wandert zwischen den Apps; ein Ausgabe-Beleg
 * ist Betriebszustand EINES Lagers. Ihn dort einzuhaengen hiesse, das Format
 * in drei Repos zu brechen, damit multicam und light ein Feld durchreichen,
 * das sie nie fuellen.
 *
 * Der Store haelt KEINE Bestandsdaten. Wer eine Ausgabe baut, reicht den
 * Bestand als Argument herein — so gibt es keine zweite Kopie des Lagers,
 * die veralten koennte, und die Ableitung bleibt pruefbar ohne Store.
 */

const KEY = STORAGE_KEYS.checkouts

const istZeile = (v: unknown): v is CheckoutLine => {
  if (!v || typeof v !== 'object') return false
  const l = v as Partial<CheckoutLine>
  return (
    (l.kind === 'item' || l.kind === 'unit' || l.kind === 'node') &&
    typeof l.refId === 'string' &&
    typeof l.label === 'string' &&
    typeof l.quantity === 'number' &&
    Number.isFinite(l.quantity)
  )
}

/** Heilt einen geladenen Beleg. Ein Beleg ohne Container, ohne Empfaenger
 *  oder ohne Zeitpunkt ist keiner — er wird abgewiesen statt ergaenzt. */
const healRecord = (raw: unknown): CheckoutRecord | null => {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<CheckoutRecord>
  if (typeof r.id !== 'string' || typeof r.nodeId !== 'string') return null
  if (!r.out || typeof r.out.at !== 'string' || typeof r.out.to !== 'string') return null
  const contents = Array.isArray(r.contents) ? r.contents.filter(istZeile) : []
  const rec: CheckoutRecord = {
    id: r.id,
    nodeId: r.nodeId,
    nodeLabel: typeof r.nodeLabel === 'string' ? r.nodeLabel : r.nodeId,
    out: {
      at: r.out.at,
      to: r.out.to,
      ...(typeof r.out.projectName === 'string' ? { projectName: r.out.projectName } : {}),
      ...(typeof r.out.dueBack === 'string' ? { dueBack: r.out.dueBack } : {}),
      ...(typeof r.out.note === 'string' ? { note: r.out.note } : {}),
    },
    contents,
  }
  if (r.in && typeof r.in.at === 'string') {
    rec.in = {
      at: r.in.at,
      missing: Array.isArray(r.in.missing) ? r.in.missing.filter(istZeile) : [],
      extra: Array.isArray(r.in.extra) ? r.in.extra.filter(istZeile) : [],
      ...(typeof r.in.note === 'string' ? { note: r.in.note } : {}),
    }
  }
  return rec
}

const load = (): CheckoutRecord[] => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(healRecord).filter((r): r is CheckoutRecord => r !== null)
  } catch {
    return []
  }
}

const persist = (records: CheckoutRecord[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(records))
  } catch {
    /* ignore */
  }
}

interface CheckoutState {
  records: CheckoutRecord[]
  /**
   * Container ausgeben. Liefert die Absage, wenn er nicht raus darf —
   * „darf nicht" ist hier eine normale Antwort und keine Ausnahme.
   */
  checkOut: (
    snap: InventorySnapshotIn,
    nodeId: string,
    out: Omit<CheckoutRecord['out'], 'at'>,
  ) => CheckoutRefusal | undefined
  /**
   * Container zurueckbuchen. Der aktuelle Inhalt wird aus dem Bestand
   * ABGELEITET und gegen die Ausgabeliste gehalten; der Unterschied landet im
   * Beleg, statt still verrechnet zu werden.
   */
  checkIn: (snap: InventorySnapshotIn, recordId: string, note?: string) => void
  /** Einen Beleg loeschen (Fehleingabe). Die Historie hat sonst kein Ventil. */
  removeRecord: (recordId: string) => void
}

export const useCheckoutStore = create<CheckoutState>((set, get) => ({
  records: load(),

  checkOut: (snap, nodeId, out) => {
    const gebaut = buildCheckout(
      snap,
      get().records,
      nodeId,
      { ...out, at: new Date().toISOString() },
      uuidv4(),
    )
    if ('refusal' in gebaut) return gebaut.refusal
    set((state) => {
      const records = [...state.records, gebaut.record]
      persist(records)
      return { records }
    })
    return undefined
  },

  checkIn: (snap, recordId, note) =>
    set((state) => {
      const at = new Date().toISOString()
      const records = state.records.map((r) =>
        r.id === recordId && !r.in ? closeCheckout(r, containerContents(snap, r.nodeId), at, note) : r,
      )
      persist(records)
      return { records }
    }),

  removeRecord: (recordId) =>
    set((state) => {
      const records = state.records.filter((r) => r.id !== recordId)
      persist(records)
      return { records }
    }),
}))
