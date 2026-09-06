// ───────────────────────────────────────────────────────────────────────────
// Eine Unterschrift für den ganzen Container — und eine für den Rückweg
// (Bedarf 136, P4).
//
//   > Each asset in a bulk handover has to be signed for separately;
//   > CHECK-IN HAS NO SIGNATURE AT ALL, so the return leg has no
//   > counter-signed evidence when a dispute arises weeks later.
//
// Belegt an `grokability/snipe-it#19070` (2026-05-26, offen: „they have to
// sign for each one separately… possible to have multiple assets on one sign
// out document?") und `#19114` (2026-05-29, offen, zwei Zustimmungen): die
// Unterschrift existiert bei der Abholung und fehlt bei der Rückgabe.
//
// ─── DIE ERSTE HÄLFTE WAR SCHON DA ─────────────────────────────────────────
//
// „One signature for a whole batch" ist in diesem Lager seit Bedarf 15
// erfüllt, ohne dass es jemand so genannt hätte: ein `CheckoutRecord` ist EIN
// Container mit eingefrorenem Inhalt. Wer ihn quittiert, quittiert alles
// darin. Der Container IST die unterschreibbare Einheit.
//
// Was fehlte, ist die zweite Hälfte, und sie ist die teurere: der RÜCKWEG.
// Ohne Gegenzeichnung steht drei Wochen später Aussage gegen Aussage — und
// genau dieser Moment ist der, für den der Beleg überhaupt geschrieben wurde.
//
// ─── WAS HIER NICHT GEBAUT WIRD ────────────────────────────────────────────
//
// KEINE Bild-Unterschrift. Der Beleg verlangt eine gegengezeichnete Spur,
// keine Grafik; ein gemaltes Feld auf einem Tablet, dessen Echtheit niemand
// prüfen kann, wäre eine Zusage über Beweiskraft, die diese Anwendung nicht
// halten kann. Festgehalten wird, WER unterschrieben hat und WANN — das
// Papier daneben trägt den Stift.
//
// ─── APPEND-ONLY, WIE DER VORGANG SELBST ───────────────────────────────────
//
// Eine gesetzte Unterschrift wird NICHT überschrieben. `CheckoutRecord` ist
// append-only, „weil ein Beleg nicht nachträglich anders lauten darf"
// (`types/checkout.ts`) — eine Unterschrift, die sich stillschweigend
// austauschen lässt, ist keine. Wer sich vertan hat, bekommt eine Absage mit
// Namen und nicht ein wortloses Nichts.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type {
  CheckoutRecord,
  CheckoutSignature,
} from '../types/checkout'
import type { CsvTable } from './csv'

/** Welches Bein des Vorgangs unterschrieben wird. */
export type HandoverLeg = 'out' | 'in'

export const LEG_LABEL: Readonly<Record<HandoverLeg, string>> = {
  out: 'Ausgabe',
  in: 'Rückgabe',
}

/** Warum eine Unterschrift nicht angenommen wird. */
export type SignatureRefusal =
  /** Kein Name — ohne Namen keine Unterschrift. */
  | 'no-name'
  /** Auf diesem Bein steht schon eine, und sie wird nicht überschrieben. */
  | 'already-signed'
  /** Die Rückgabe ist noch nicht erfolgt; es gibt nichts gegenzuzeichnen. */
  | 'not-returned'

export const SIGNATURE_REFUSAL_LABEL: Readonly<Record<SignatureRefusal, string>> = {
  'no-name': 'Ohne Namen ist es keine Unterschrift.',
  'already-signed':
    'Hier steht schon eine Unterschrift. Ein Beleg, der sich austauschen lässt, ist keiner — ' +
    'eine Korrektur gehört als Notiz daneben.',
  'not-returned':
    'Der Container ist noch nicht zurück. Gegengezeichnet wird, was zurückgekommen ist.',
}

/**
 * Die Engstelle: darf hier unterschrieben werden?
 *
 * Getrennt vom Setzen, weil der Store die Absage braucht und der Aufrufer
 * den Grund — „schon unterschrieben" und „noch nicht zurück" verlangen
 * verschiedene Antworten des Bedienenden.
 */
export function signatureRefusal(
  record: CheckoutRecord,
  leg: HandoverLeg,
  name: string,
): SignatureRefusal | null {
  if (!name.trim()) return 'no-name'
  if (leg === 'in' && !record.in) return 'not-returned'
  const vorhanden = leg === 'out' ? record.out.signature : record.in?.signature
  if (vorhanden) return 'already-signed'
  return null
}

/**
 * Setzt die Unterschrift und liefert einen NEUEN Datensatz.
 *
 * Der alte bleibt unberührt — dieselbe Regel wie bei `closeCheckout`. Bei
 * einer Absage kommt der Datensatz unverändert zurück, zusammen mit dem
 * Grund: ein Aufrufer, der nur den Datensatz bekäme, könnte „nichts passiert"
 * nicht von „passiert" unterscheiden.
 */
export function signHandover(
  record: CheckoutRecord,
  leg: HandoverLeg,
  signature: CheckoutSignature,
): { record: CheckoutRecord } | { refusal: SignatureRefusal } {
  const refusal = signatureRefusal(record, leg, signature.name)
  if (refusal) return { refusal }
  const sauber: CheckoutSignature = {
    name: signature.name.trim(),
    at: signature.at,
    ...(signature.note?.trim() ? { note: signature.note.trim() } : {}),
  }
  if (leg === 'out') {
    return { record: { ...record, out: { ...record.out, signature: sauber } } }
  }
  // `record.in` ist hier gesetzt: `signatureRefusal` hat das geprüft.
  return { record: { ...record, in: { ...record.in!, signature: sauber } } }
}

/** Wie weit der Vorgang gegengezeichnet ist. */
export type SignatureState =
  /** Beide Beine unterschrieben. */
  | 'both'
  /** Nur die Ausgabe — der Fall aus dem Beleg. */
  | 'out-only'
  /** Nur die Rückgabe (kommt vor: nachgetragene Altdaten). */
  | 'in-only'
  /** Keine Unterschrift. */
  | 'none'

export const SIGNATURE_STATE_LABEL: Readonly<Record<SignatureState, string>> = {
  both: 'beidseitig quittiert',
  'out-only': 'nur Ausgabe quittiert',
  'in-only': 'nur Rückgabe quittiert',
  none: 'nicht quittiert',
}

export function signatureState(record: CheckoutRecord): SignatureState {
  const aus = Boolean(record.out.signature)
  const ein = Boolean(record.in?.signature)
  if (aus && ein) return 'both'
  if (aus) return 'out-only'
  if (ein) return 'in-only'
  return 'none'
}

export type HandoverFindingKind =
  /** Container ist draussen und niemand hat die Ausgabe quittiert. */
  | 'unsigned-out'
  /** Container ist zurück und niemand hat die Rückgabe gegengezeichnet. */
  | 'unsigned-in'

export interface HandoverFinding {
  kind: HandoverFindingKind
  severity: 'error' | 'warning'
  /** Vorgangs-Id als Klick-/Sortierschlüssel. */
  recordId: string
  message: string
}

/**
 * Befunde über die Quittierung.
 *
 * `unsigned-in` ist ein FEHLER und nicht nur ein Hinweis: der Beleg beschreibt
 * genau diesen Zustand als den, der wochenlang folgenlos aussieht und dann
 * den Streit entscheidet. `unsigned-out` bleibt ein Hinweis — der Container
 * ist noch unterwegs, die Unterschrift kann nachkommen, und ein Fehler auf
 * jedem laufenden Vorgang wäre Lärm.
 */
export function handoverFindings(records: readonly CheckoutRecord[]): HandoverFinding[] {
  const out: HandoverFinding[] = []
  for (const r of records) {
    if (!r.out.signature) {
      out.push({
        kind: 'unsigned-out',
        severity: 'warning',
        recordId: r.id,
        message: `"${r.nodeLabel}" ist ausgegeben, aber die Ausgabe ist nicht quittiert.`,
      })
    }
    if (r.in && !r.in.signature) {
      out.push({
        kind: 'unsigned-in',
        severity: 'error',
        recordId: r.id,
        message:
          `"${r.nodeLabel}" ist zurück, aber die Rückgabe ist NICHT gegengezeichnet. ` +
          'Bei einer Nachfrage in drei Wochen steht Aussage gegen Aussage.',
      })
    }
  }
  return out
}

/** Was auf dem Blatt steht, wo niemand unterschrieben hat. */
export const NOT_SIGNED = 'nicht unterschrieben'
/** Die Zeile, auf der jemand mit dem Stift unterschreibt. */
export const SIGNATURE_RULE = '____________________'

export const HANDOVER_SIGNATURE_HEADERS = [
  'Container',
  'Vorgang',
  'Name',
  'Datum',
  'Bemerkung',
  'Unterschrift',
] as const

const datum = (at: string | undefined): string => (at ? at.slice(0, 10) : '')

/**
 * Der Quittungs-Block unter der Ausgabeliste.
 *
 * IMMER BEIDE ZEILEN, auch die für ein Bein, das es noch nicht gibt: das
 * Blatt fährt mit dem Case mit, und die Rückgabe-Zeile muss schon darauf
 * stehen, wenn das Case zurückkommt. Ein Blatt, das die zweite Zeile erst
 * druckt, wenn die Rückgabe eingetragen ist, kommt genau einen Vorgang zu
 * spät — und dann unterschreibt wieder niemand.
 *
 * Wo niemand unterschrieben hat, steht die STRICHLINIE für den Stift und
 * nicht eine leere Zelle: eine leere Zelle liest sich, als sei nichts
 * vorgesehen.
 */
export function handoverSignatureTable(record: CheckoutRecord): CsvTable {
  const zeile = (leg: HandoverLeg): (string | number)[] => {
    const sig = leg === 'out' ? record.out.signature : record.in?.signature
    return [
      record.nodeLabel,
      LEG_LABEL[leg],
      sig?.name ?? NOT_SIGNED,
      sig ? datum(sig.at) : datum(leg === 'out' ? record.out.at : record.in?.at),
      sig?.note ?? '',
      sig ? '' : SIGNATURE_RULE,
    ]
  }
  return { headers: [...HANDOVER_SIGNATURE_HEADERS], rows: [zeile('out'), zeile('in')] }
}
