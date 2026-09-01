/**
 * QR-/Etiketten-Payload — Bauen, Parsen und Auflösen.
 *
 * Ein Etikett trägt eine kompakte `cableplanner://`-URI (siehe `docIds.qrPayload`),
 * die ein Scan-/Such-Lookup im Mobile-Viewer oder Web-Viewer wieder auf den
 * konkreten Datensatz (Kabel/Gerät) abbildet. Diese Datei ist die *eine* Quelle
 * für Format + Auflösung, damit Drucken (Erzeugen) und Scannen (Parsen) nie
 * auseinanderlaufen. Bewusst Framework-frei: Mobile, Viewer und Renderer teilen
 * sie sich.
 */
import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'

export type QrKind = 'cable' | 'equipment'

/** Referenz auf einen Datensatz, wie sie aus einem QR-Inhalt geparst wird.
 *  `kind` ist optional: bei nacktem Klartext kann die Sorte unbekannt sein. */
export interface QrRef {
  kind?: QrKind
  id: string
  label?: string
}

/**
 * Baut den QR-Inhalt: `cableplanner://<kind>/<id>?l=<label>`. Identisch zu
 * `docIds.qrPayload` (das hierher delegiert) — kompakte URI plus lesbares Label.
 */
export const buildQrPayload = (kind: QrKind, id: string, label: string): string =>
  `cableplanner://${kind}/${encodeURIComponent(id)}?l=${encodeURIComponent(label)}`

const KIND_FROM_PREFIX: Record<string, QrKind> = { C: 'cable', A: 'equipment' }

/**
 * Parst einen gescannten/eingegebenen QR-Inhalt zu einer `QrRef`. Tolerant:
 *  1. volle `cableplanner://cable/C-0001?l=…`-URI
 *  2. `#cable/C-0001` / `?lookup=cable/C-0001` aus einem Deep-Link
 *  3. nackte ID wie `C-0001` / `A-0042` → Sorte aus dem Präfix abgeleitet
 *  4. beliebiger Freitext → als ID ohne Sorte (Lookup sucht dann in beidem)
 * Liefert `null` nur bei leerer Eingabe.
 */
export const parseQrPayload = (raw: string): QrRef | null => {
  const text = raw?.trim()
  if (!text) return null

  // (1)/(2) — strukturierte Deep-Links. Wir ziehen "<kind>/<id>" aus dem
  // ersten Vorkommen heraus, egal ob als URI-Pfad, Hash oder ?lookup=.
  const m = text.match(/(?:cableplanner:\/\/|[#?](?:lookup=)?|^)(cable|equipment)\/([^?&#\s]+)/i)
  if (m) {
    const kind = m[1].toLowerCase() as QrKind
    const id = safeDecode(m[2])
    const label = extractLabel(text)
    return { kind, id, ...(label ? { label } : {}) }
  }

  // (3) — nackte Doc-ID mit bekanntem Präfix (C-0001 / A-0001).
  const prefix = text.match(/^([CA])-/i)
  if (prefix) {
    return { kind: KIND_FROM_PREFIX[prefix[1].toUpperCase()], id: text }
  }

  // ADR-004 — Eine Dokument-URI ist kein Datensatz. Ohne diesen Riegel fiele
  // sie in Fall (4) und der Lookup suchte nach der URI als Kabelnummer: er
  // faende nichts und sagte "unbekannter Code" statt "das ist ein
  // Dokument-Code". `parseDocQrPayload` ist dafuer zustaendig.
  if (DOC_URI.test(text)) return null

  // (4) — irgendein Klartext (z.B. eine vergebene Kabelnummer): als ID ohne Sorte.
  return { id: text }
}

/** Erkennt eine Dokument-URI, in voller oder Deep-Link-Form. */
const DOC_URI = /(?:cableplanner:\/\/|[#?](?:lookup=)?)doc\//i

const safeDecode = (s: string): string => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

const extractLabel = (text: string): string | undefined => {
  const lm = text.match(/[?&]l=([^&#\s]+)/)
  return lm ? safeDecode(lm[1]) : undefined
}

const norm = (s: string | undefined): string => (s ?? '').trim().toLowerCase()

/** Treffer eines Lookups: der gefundene Datensatz plus seine Sorte. */
export type QrMatch =
  | { kind: 'cable'; item: Cable }
  | { kind: 'equipment'; item: EquipmentItem }

/**
 * Löst eine `QrRef` gegen Kabel + Geräte auf. Matcht großzügig gegen alle
 * sichtbaren Kennungen (qrId / cableNumber / assetTag / interne UUID), damit
 * sowohl die stabile Etiketten-ID als auch ein abgekürzter UUID-Fallback
 * gescannt werden können. Liefert den ersten Treffer oder `null`.
 */
export const lookupQrRef = (
  ref: QrRef,
  cables: Cable[],
  equipment: EquipmentItem[],
): QrMatch | null => {
  const needle = norm(ref.id)
  if (!needle) return null

  const cableHit = (c: Cable): boolean =>
    norm(c.qrId) === needle ||
    norm(c.cableNumber) === needle ||
    norm(c.id) === needle ||
    norm(c.id).startsWith(needle.replace(/^c-/, '')) // C-<uuid8>-Fallback

  const eqHit = (e: EquipmentItem): boolean =>
    norm(e.qrId) === needle ||
    norm(e.assetTag) === needle ||
    norm(e.id) === needle ||
    norm(e.id).startsWith(needle.replace(/^a-/, ''))

  // Bei bekannter Sorte zuerst dort suchen; sonst beide Sammlungen.
  if (ref.kind !== 'equipment') {
    const c = cables.find(cableHit)
    if (c) return { kind: 'cable', item: c }
  }
  if (ref.kind !== 'cable') {
    const e = equipment.find(eqHit)
    if (e) return { kind: 'equipment', item: e }
  }
  return null
}

// ─── Dokument-Codes (ADR-004) ──────────────────────────────────────────────
//
// Ein Etikett zeigt auf einen Datensatz; ein Dokument-Code zeigt auf ein Blatt
// und seinen Stand. Beide leben hier, weil diese Datei die eine Quelle fuer das
// URI-Format ist — die *Aufloesung* ist eine andere: ein Datensatz wird gesucht,
// ein Dokument wird verglichen.

/** Was auf einem Blatt steht: welches Dokument, welcher Stand. */
export interface DocRef {
  /** Dokument-Art, wie im Dateinamen: `pull-liste`, `kabel-bom`, `plan` … */
  docId: string
  /** Fingerabdruck des Inhalts zum Druckzeitpunkt (8 Hex-Zeichen). */
  stand: string
  /** Revisions-Label zum Druckzeitpunkt, falls eines festgeschrieben war. */
  revision?: string
}

/**
 * Baut den Dokument-Code: `cableplanner://doc/<docId>?s=<stand>[&r=<revision>]`.
 *
 * Der Stand steht im Code selbst und nicht in einer Datenbank: das Blatt muss
 * ohne Netz aussagefaehig sein, sonst nimmt man ihm genau die Eigenschaft, wegen
 * der es gedruckt wurde.
 */
export const buildDocQrPayload = (docId: string, stand: string, revision?: string): string =>
  `cableplanner://doc/${encodeURIComponent(docId)}?s=${encodeURIComponent(stand)}` +
  (revision ? `&r=${encodeURIComponent(revision)}` : '')

/**
 * Parst einen Dokument-Code. Tolerant wie `parseQrPayload`: volle URI, Hash-
 * oder `?lookup=`-Deep-Link. Ohne `s=` gibt es keinen Stand und damit nichts zu
 * vergleichen — dann `null`, statt einen leeren Stand zu behaupten.
 */
export const parseDocQrPayload = (raw: string): DocRef | null => {
  const text = raw?.trim()
  if (!text) return null
  const m = text.match(/(?:cableplanner:\/\/|[#?](?:lookup=)?|^)doc\/([^?&#\s]+)/i)
  if (!m) return null
  const stand = text.match(/[?&]s=([^&#\s]+)/)
  if (!stand) return null
  const revision = text.match(/[?&]r=([^&#\s]+)/)
  return {
    docId: safeDecode(m[1]),
    stand: safeDecode(stand[1]),
    ...(revision ? { revision: safeDecode(revision[1]) } : {}),
  }
}

/** Ergebnis des Standvergleichs. */
export type DocStandStatus = 'current' | 'stale' | 'unknown'

/**
 * Vergleicht den Stand auf dem Blatt mit dem Stand, den dasselbe Dokument
 * heute haette.
 *
 * `unknown` ist kein Fehlerfall, sondern die ehrliche dritte Antwort: wer den
 * aktuellen Stand nicht berechnen kann (fremdes Projekt, anderes Dokument),
 * darf ein Blatt weder fuer aktuell noch fuer veraltet erklaeren.
 */
export const docStandStatus = (ref: DocRef, currentStand: string | undefined): DocStandStatus => {
  if (!currentStand) return 'unknown'
  return ref.stand.toLowerCase() === currentStand.toLowerCase() ? 'current' : 'stale'
}
