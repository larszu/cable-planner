// ───────────────────────────────────────────────────────────────────────────
// Wem der Name eines Ports gehoert (#175, #838).
//
// ─── DIE REGEL AUS #175, UNVERAENDERT ──────────────────────────────────────
//
// Wechselt am Port der Steckertyp oder der Standard und traegt er noch einen
// VORGABENAMEN (`Input 1`, `In 3`, `Out 4`), dann wird er mit umbenannt: aus
// `Input 1` wird `SDI 1`. Das erspart das Umbenennen bei jedem Typwechsel und
// ist ausdruecklich gewollt.
//
// ─── WAS #838 DARAN AENDERT, UND WARUM ES NICHT DIE REGEL IST ──────────────
//
// Ihr Preis faellt an genau einer Stelle an: WER EINEN PORT BEWUSST `In 5`
// NENNT, IST VON EINEM VORGABENAMEN NICHT ZU UNTERSCHEIDEN — der Name passt
// auf das Muster, und beim naechsten Steckertyp-Wechsel ist er weg.
//
// Die Loesung ist nicht „Regel weg" (dann kaeme das Umbenennen bei jedem
// Typwechsel zurueck, und das war die Beschwerde, aus der #175 entstand),
// sondern die fehlende Angabe: `port.nameFromUser`. Gesetzt, sobald jemand
// das Namensfeld anfasst; hier wird es gefragt, bevor zugegriffen wird.
//
// ─── WARUM DAS EIN MODUL IST UND KEINE ZWEI ZEILEN IN DER KOMPONENTE ───────
//
// Weil es genau dort stand — als Closure in `PortList.tsx`, unerreichbar fuer
// jeden Test. Eine Entscheidung, die einem Nutzer seine Eingabe nehmen kann,
// gehoert an eine Stelle, an der man sie befragen kann.
// ───────────────────────────────────────────────────────────────────────────
import type { Port } from '../types/equipment'

/**
 * Namen, die von uns stammen koennten: `Input`, `Output`, `In`, `Out`,
 * wahlweise mit Nummer.
 *
 * KOENNTEN — das Muster sagt nicht, wer sie geschrieben hat. Genau diese
 * Luecke schliesst `nameFromUser`.
 */
const VORGABE_MUSTER = /^(input|output|in|out)\s*\d*$/i

export const istVorgabename = (name: string): boolean =>
  VORGABE_MUSTER.test(name.trim())

/**
 * Der Name, auf den dieser Port beim Typwechsel gehen soll — oder `null`,
 * wenn er seinen behalten muss.
 *
 * `null` in drei Faellen, und die Reihenfolge ist der Punkt:
 *   1. den Port gibt es nicht
 *   2. sein Name kommt vom Nutzer  (#838)
 *   3. sein Name ist kein Vorgabename
 */
export const vorschlagBeiVorgabename = (
  ports: readonly Port[],
  portId: string,
  praefix: string,
): string | null => {
  const port = ports.find((p) => p.id === portId)
  if (!port) return null
  if (port.nameFromUser) return null
  if (!istVorgabename(port.name)) return null
  // Nummer aus dem heutigen Vorgabenamen ziehen, sonst die Position in der
  // Liste. `Input 3` wird zu `SDI 3` und nicht zu `SDI 1`, nur weil der Port
  // vorne steht.
  const nummer = port.name.match(/\d+/)
  const idx = nummer ? nummer[0] : String(ports.indexOf(port) + 1)
  return `${praefix} ${idx}`.trim()
}
