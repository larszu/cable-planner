// ADR-001, Inkrement 2 — reine Helfer fuer die Signalquellen-Rollen.
//
// Kein Store, kein React: Normalisierung beim Laden, Validierung der
// UMD-Adresse und die Kollisionspruefung sind Funktionen ueber Daten und
// damit vollstaendig testbar. Die Normalisierung ist bewusst streng — eine
// halb gueltige Adresse ist schlimmer als keine: Sie sieht auf dem Papier
// aus wie eine Zusage, und das Display bleibt trotzdem leer.

import type { SourceIdentity } from '../types/sourceIdentity'

/**
 * TSL UMD v3.1 adressiert Displays ueber das erste Byte, 0x80 + Adresse.
 * 0x80–0xFE sind die Displays 0–126; 0xFF ist reserviert.
 */
export const UMD_ADDRESS_MIN = 0
export const UMD_ADDRESS_MAX = 126

export const isValidUmdAddress = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= UMD_ADDRESS_MIN &&
  value <= UMD_ADDRESS_MAX

/** Nimmt Zahl oder Ziffern-String; alles andere wird zu undefined. */
export const parseUmdAddress = (raw: unknown): number | undefined => {
  const value =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw)
        : NaN
  return isValidUmdAddress(value) ? value : undefined
}

/**
 * Haert einen Datensatz aus einer Projektdatei ab. Liefert null, wenn kein
 * Name da ist — eine namenlose Rolle kann niemand zuweisen, und sie stumm
 * mit „Unbenannt" zu fuellen wuerde eine Entscheidung erfinden.
 */
export const normaliseSourceIdentity = (
  raw: unknown,
  fallbackId: string,
): SourceIdentity | null => {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const name = typeof r.name === 'string' ? r.name.trim() : ''
  if (!name) return null
  const id = typeof r.id === 'string' && r.id.trim() !== '' ? r.id : fallbackId
  const numberRaw =
    typeof r.number === 'number'
      ? r.number
      : typeof r.number === 'string' && r.number.trim() !== ''
        ? Number(r.number)
        : NaN
  const identity: SourceIdentity = { id, name }
  if (Number.isInteger(numberRaw) && numberRaw >= 0) identity.number = numberRaw
  const umd = parseUmdAddress(r.umdAddress)
  if (umd !== undefined) identity.umdAddress = umd
  return identity
}

/** Normalisiert die Liste und wirft Duplikat-Ids weg (erste gewinnt). */
export const normaliseSourceIdentities = (raw: unknown): SourceIdentity[] => {
  if (!Array.isArray(raw)) return []
  const out: SourceIdentity[] = []
  const seen = new Set<string>()
  raw.forEach((entry, idx) => {
    const identity = normaliseSourceIdentity(entry, `source-${idx + 1}`)
    if (!identity || seen.has(identity.id)) return
    seen.add(identity.id)
    out.push(identity)
  })
  return out
}

/** Ids der gueltigen Rollen — Eingabe fuer `clearDanglingIdentity`. */
export const sourceIdentityIdSet = (identities: SourceIdentity[]): ReadonlySet<string> =>
  new Set(identities.map((s) => s.id))

/**
 * Entfernt eine Bindung, deren Rolle es nicht (mehr) gibt.
 *
 * Ein Fehlzeiger ist schlimmer als gar keine Bindung: Im Plan sieht er aus wie
 * eine zugewiesene Tally-Adresse, im Betrieb bleibt das Display leer. Der
 * Datensatz selbst bleibt unangetastet, wenn nichts zu tun ist — so muss der
 * Aufrufer nicht jedes Objekt neu anlegen.
 */
export const clearDanglingIdentity = <T extends { sourceIdentityId?: string }>(
  item: T,
  identityIds: ReadonlySet<string>,
): T =>
  item.sourceIdentityId !== undefined && !identityIds.has(item.sourceIdentityId)
    ? { ...item, sourceIdentityId: undefined }
    : item

export interface UmdAddressClash {
  address: number
  identities: SourceIdentity[]
}

/**
 * Zwei Rollen auf derselben UMD-Adresse: Beide Displays zeigen denselben
 * Text, und welcher gewinnt, entscheidet die Reihenfolge der Pakete. Das ist
 * kein Schoenheitsfehler, sondern ein falsches Tally auf Sendung.
 */
export const umdAddressClashes = (identities: SourceIdentity[]): UmdAddressClash[] => {
  const byAddress = new Map<number, SourceIdentity[]>()
  for (const identity of identities) {
    if (identity.umdAddress === undefined) continue
    const list = byAddress.get(identity.umdAddress)
    if (list) list.push(identity)
    else byAddress.set(identity.umdAddress, [identity])
  }
  return [...byAddress.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([address, list]) => ({ address, identities: list }))
    .sort((a, b) => a.address - b.address)
}
