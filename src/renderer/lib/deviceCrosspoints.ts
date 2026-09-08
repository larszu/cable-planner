/**
 * „Welcher Eingang speist diesen Ausgang?" — EINE Antwort, für jedes Gerät.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM DAS EINE FUNKTION IST UND NICHT ZWEI
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Der Plan kennt Kreuzpunkte bisher nur in EINER Bauform: `videohubRouting.
 * planned`, eine Tabelle `Ausgangs-Index -> Eingangs-Index`. Das passt zum
 * Videohub, weil dessen Protokoll selbst mit genau diesen Indizes spricht.
 *
 * Es passt zu sonst nichts. Ein Mischer schaltet ebenfalls Kreuzpunkte — was
 * auf dem Programm-Ausgang liegt, was auf einem Aux —, aber seine Nummern
 * sind andere (beim ATEM ist der Programm-Bus keine Ausgangs-Nummer, sondern
 * ein Mix-Effect, und Aux-Busse zählen getrennt). Und die nächste
 * Kreuzschiene eines anderen Herstellers zählt schon wieder anders.
 *
 * Deshalb gibt es eine zweite, HERSTELLERNEUTRALE Form: `plannedCrosspoints`,
 * eine Tabelle `Ausgangs-Anschluss-Id -> Eingangs-Anschluss-Id`. Sie kennt
 * keine Protokollnummern, sondern die Anschlüsse, die im Plan ohnehin stehen.
 *
 * Und deshalb steht die AUSWERTUNG beider Formen an genau einer Stelle: hier.
 * Zwei Leser, die je eine Form kennen, wären die Defektform
 * `zwei-rechnungen` — der Signalweg liefe über die eine Tabelle, die Anzeige
 * über die andere, und beim ersten Gerät, das beide trägt, widersprächen sie
 * sich, ohne dass es auffiele.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WELCHE FORM GEWINNT — UND WARUM DIE NEUE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Wo beide gefüllt sind, gewinnt `plannedCrosspoints`. Begründung: sie ist
 * die AUSDRÜCKLICHE Angabe über Anschlüsse, die Index-Tabelle die ältere über
 * Positionen. Wer eine Zeile in der neuen Form einträgt, hat einen bestimmten
 * Anschluss gemeint; wer die alte stehen lässt, hat womöglich nur vergessen
 * aufzuräumen. Die Umkehrung — Index schlägt Anschluss — machte eine
 * ausdrückliche Angabe durch eine ältere unwirksam, und das fiele erst am
 * falschen Monitor auf.
 *
 * Ein Vorrang ist es NUR je Ausgang, nicht je Gerät: die beiden Tabellen
 * werden zusammengeführt, und ein Ausgang, über den nur die Index-Tabelle
 * etwas sagt, behält deren Aussage. Alles andere hiesse, eine einzige neue
 * Zeile lösche die übrigen elf.
 *
 * REIN: keine Uhr, kein Store, kein IO.
 */
import type { EquipmentItem } from '../types/equipment'

/**
 * `Ausgangs-Anschluss-Id -> Eingangs-Anschluss-Id`.
 *
 * Leer heisst „nichts geplant" und ausdrücklich NICHT „nichts geschaltet":
 * was das Gerät wirklich tut, weiss der Plan nicht (ADR-001).
 */
export type CrosspointMap = ReadonlyMap<string, string>

const LEER: CrosspointMap = new Map()

/**
 * Die Kreuzpunkte eines Geräts, aus beiden Formen zusammengeführt.
 *
 * Anschluss-Ids, die es am Gerät nicht (mehr) gibt, fallen heraus — auf
 * beiden Seiten. Eine Zeile, die auf einen gelöschten Anschluss zeigt, wäre
 * im Signalweg ein Weiterweg ins Leere und im Schaltbefehl eine geratene
 * Nummer.
 */
export const deviceCrosspoints = (device: EquipmentItem): CrosspointMap => {
  const outIds = device.outputs.map((p) => p.id)
  const inIds = device.inputs.map((p) => p.id)
  if (outIds.length === 0 || inIds.length === 0) return LEER
  const outSet = new Set(outIds)
  const inSet = new Set(inIds)
  const map = new Map<string, string>()

  // Die aeltere Index-Form zuerst, damit die ausdrueckliche sie ueberschreibt.
  const geplant = device.videohubRouting?.planned
  if (geplant) {
    for (const [outStr, inIdx] of Object.entries(geplant)) {
      const outId = outIds[Number(outStr)]
      const inId = inIds[inIdx]
      if (outId && inId) map.set(outId, inId)
    }
  }

  for (const [outId, inId] of Object.entries(device.plannedCrosspoints ?? {})) {
    if (outSet.has(outId) && inSet.has(inId)) map.set(outId, inId)
  }

  return map
}

/**
 * Die Ausgänge, auf denen dieser Eingang liegt.
 *
 * Mehrere sind normal und kein Fehler: eine Kreuzschiene darf eine Quelle auf
 * beliebig viele Ausgänge legen (ein Mischer auf Programm UND einen Aux).
 * Die Gegenrichtung ist dagegen eindeutig — ein Ausgang trägt genau eine
 * Quelle, und das ist die Form der Tabelle selbst.
 */
export const outputsFedBy = (device: EquipmentItem, inputPortId: string): string[] => {
  const raus: string[] = []
  for (const [outId, inId] of deviceCrosspoints(device)) {
    if (inId === inputPortId) raus.push(outId)
  }
  return raus
}

/** Hat dieses Gerät überhaupt eine geplante Schaltung? */
export const hatKreuzpunkte = (device: EquipmentItem): boolean =>
  deviceCrosspoints(device).size > 0

/**
 * Die neue Form beim Laden säubern.
 *
 * Verworfen wird, was auf einen Anschluss zeigt, den es nicht (mehr) gibt —
 * auf beiden Seiten. Ein Weiterweg auf einen gelöschten Ausgang endete im
 * Signalweg stumm, und im Schaltbefehl (B-42 Inkrement 3) ginge daraus eine
 * geratene Nummer an eine laufende Anlage.
 *
 * ALS EIGENE FUNKTION, nicht als Filter in `healProjectPositions`: dort wäre
 * sie nur über einen Quelltext-Scan prüfbar.
 */
export interface CrosspointDrop {
  reason: 'dangling-ref'
  label: string
}

export const normalisePlannedCrosspoints = (
  roh: unknown,
  outputIds: ReadonlySet<string>,
  inputIds: ReadonlySet<string>,
  onDrop?: (drop: CrosspointDrop) => void,
): Record<string, string> | undefined => {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return undefined
  const raus: Record<string, string> = {}
  for (const [outId, inId] of Object.entries(roh as Record<string, unknown>)) {
    if (typeof inId !== 'string') {
      onDrop?.({ reason: 'dangling-ref', label: outId })
      continue
    }
    if (!outputIds.has(outId) || !inputIds.has(inId)) {
      onDrop?.({ reason: 'dangling-ref', label: outId })
      continue
    }
    raus[outId] = inId
  }
  return Object.keys(raus).length > 0 ? raus : undefined
}
