/**
 * Vom Kreuzpunkt-Zustand des Videohubs zur Kanten-Anzeige im Canvas.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DIE GRENZE, DIE DIESE DATEI EINHÄLT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Ein Blackmagic-Videohub meldet über sein Protokoll seine KREUZPUNKTE:
 * welcher Eingang gerade auf welchen Ausgang geschaltet ist. Er meldet
 * **nicht**, ob dort Signal anliegt — kein Lock, kein Format, keine
 * Signalerkennung. Genau das steht in `videohub:read-state`: `routing`,
 * Labels, Locks, sonst nichts.
 *
 * Deshalb liefert diese Datei `routed` und niemals `carrying`. Der
 * Unterschied ist kein Wortspiel: ein Kreuzpunkt steht auch dann, wenn
 * upstream die Kamera aus ist. Wer ihn als „Signal liegt an" zeigte, machte
 * aus einer Router-Einstellung eine Aussage über die Anlage — die
 * Falschaussage, gegen die der ganze Signalfluss-Entwurf gebaut ist.
 *
 * Und sie liefert **nie** `down`. Der Hub kann Verbindungsverlust nicht
 * melden; eine Kante als tot zu zeichnen, weil sie nicht geroutet ist, wäre
 * derselbe Fehler in klein. Nicht geroutet heisst `idle` — die Strecke ist
 * da, es läuft nur nichts über sie.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WIE DIE KABEL AUF EIN- UND AUSGÄNGE ABGEBILDET WERDEN
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Über die POSITION des Ports in `inputs`/`outputs` des Hub-Geräts, 1-basiert
 * — dieselbe Zählung, mit der `labelDerivation.inputIndex` arbeitet und mit
 * der ATEM und Videohub den Eingang auf dem Draht adressieren. Eine zweite
 * Zählung daneben ginge beim nächsten Umsortieren der Ports auseinander, und
 * zwar still.
 */

import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'
import type { LiveLink } from './signalAnimation'

/** Der Ausschnitt des Hub-Zustands, den diese Datei braucht. */
export interface VideohubStateSlice {
  /** Ausgangsnummer → Eingangsnummer, beide 1-basiert wie auf dem Draht. */
  routing?: Record<number, number>
}

/**
 * Die Kanten-Meldungen zu einem Hub-Zustand.
 *
 * `at` kommt von aussen, damit die Rechnung rein bleibt — dieselbe Trennung
 * wie beim Mischer-Tally und beim Seed-Merge.
 */
export const videohubLinks = (
  hub: Pick<EquipmentItem, 'id' | 'inputs' | 'outputs'> | undefined,
  cables: readonly Cable[],
  state: VideohubStateSlice | null | undefined,
  at: number,
): LiveLink[] => {
  const routing = state?.routing
  if (!hub || !routing) return []

  // Welche Eingangsnummern werden gerade irgendwohin durchgeschaltet?
  const belegteEingaenge = new Set(Object.values(routing))
  // Welche Ausgangsnummern fuehren gerade etwas?
  const belegteAusgaenge = new Set(
    Object.entries(routing)
      .filter(([, eingang]) => typeof eingang === 'number')
      .map(([ausgang]) => Number(ausgang)),
  )

  const eingangNr = new Map(hub.inputs.map((p, i) => [p.id, i + 1]))
  const ausgangNr = new Map(hub.outputs.map((p, i) => [p.id, i + 1]))

  const out: LiveLink[] = []
  for (const cable of cables) {
    // Ein Kabel IN den Hub: sein Port ist ein Hub-Eingang.
    if (cable.toEquipmentId === hub.id) {
      const nr = eingangNr.get(cable.toPortId)
      if (nr === undefined) continue
      out.push({
        cableId: cable.id,
        state: belegteEingaenge.has(nr) ? 'routed' : 'idle',
        at,
        source: 'videohub',
      })
      continue
    }
    // Ein Kabel AUS dem Hub: sein Port ist ein Hub-Ausgang.
    if (cable.fromEquipmentId === hub.id) {
      const nr = ausgangNr.get(cable.fromPortId)
      if (nr === undefined) continue
      out.push({
        cableId: cable.id,
        state: belegteAusgaenge.has(nr) ? 'routed' : 'idle',
        at,
        source: 'videohub',
      })
    }
    // Alles andere: keine Aussage. Der Hub weiss ueber Kabel, die ihn nicht
    // beruehren, nichts — und `edgeFlow` zeigt fuer eine Kante ohne Eintrag
    // das Schema, nicht „aus".
  }
  return out
}
