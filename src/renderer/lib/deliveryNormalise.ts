// Lade-Normalisierung der Ausspielziele (Initiative 9).
//
// Liegt neben `sourceIdentity.ts` und folgt derselben Bauform: eine Liste
// normalisieren, Verworfenes MELDEN (ADR-005 Regel 3 — „wer nicht bewahren
// kann, sagt es an der Stelle, an der es passiert"), und die gueltigen Ids
// zurueckgeben, damit die Backup-Zeiger danach aufgeraeumt werden koennen.
//
// Ein Fehlzeiger auf ein geloeschtes Ziel ist hier schlimmer als kein Zeiger:
// die Paritaetspruefung meldet dann `backup-orphan` statt der echten Frage
// „wo ist mein Ausweichweg?".
import type { LoadDrop } from '../types/loadReport'
import { normaliseDeliveryDestination, type DeliveryDestination } from '../types/delivery'

const rawLabel = (raw: unknown): string => {
  if (!raw || typeof raw !== 'object') return ''
  const r = raw as Record<string, unknown>
  for (const key of ['name', 'id']) {
    const v = r[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

export const normaliseDeliveryDestinations = (
  raw: unknown,
  onDrop?: (drop: LoadDrop) => void,
): DeliveryDestination[] => {
  if (!Array.isArray(raw)) return []
  const out: DeliveryDestination[] = []
  const seen = new Set<string>()
  raw.forEach((entry, idx) => {
    const dest = normaliseDeliveryDestination(entry, `delivery-${idx + 1}`)
    if (!dest) {
      onDrop?.({ kind: 'delivery-destination', reason: 'missing-required', label: rawLabel(entry) })
      return
    }
    if (seen.has(dest.id)) {
      onDrop?.({ kind: 'delivery-destination', reason: 'duplicate-id', label: dest.name })
      return
    }
    seen.add(dest.id)
    out.push(dest)
  })
  // Backup-Zeiger auf Ziele, die die Normalisierung nicht ueberlebt haben,
  // fallen weg. Nicht gemeldet: das Ziel selbst wurde schon gemeldet, und
  // zwei Meldungen fuer einen Vorgang lesen sich wie zwei Fehler.
  return out.map((d) => (d.backupOfId && !seen.has(d.backupOfId) ? { ...d, backupOfId: undefined } : d))
}
