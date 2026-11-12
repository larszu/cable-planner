import type { EquipmentItem, Port } from '../types/equipment'
import { useUiStore } from '../store/uiStore'

/**
 * #1029 — Signalrichtung einer neuen Verbindung.
 *
 * Jeder Port traegt auf dem Canvas einen `source`- UND einen `target`-Handle,
 * und ReactFlow laeuft in `ConnectionMode.Loose`: ein Ziehen darf an jedem
 * Griff beginnen und an jedem enden. Ohne Pruefung entstand dadurch
 * Eingang→Eingang (beobachtet: „ATEM SDI In 3 → Kamera 12G-SDI In (Return)").
 *
 * Regel: ein Kabel laeuft von einem Ausgang zu einem Eingang. Ein Port mit
 * `direction: 'bidirectional'` (RJ45, Intercom …) passt an beide Enden.
 * Eingang→Eingang und Ausgang→Ausgang werden abgelehnt; alles andere wird so
 * gedreht, dass `source` sendet und `target` empfaengt.
 *
 * Ein Endpunkt, der kein bekannter Geraete-Port ist (Stummel, Fremd-Knoten),
 * bleibt unbewertet — die Verbindung geht dann unveraendert durch, wie bisher.
 */

export type PortRichtung = 'in' | 'out' | 'bidirectional'

/**
 * #1219 — Netzwerk- und Glasfaser-Stecker haben keine Signalrichtung: ein
 * Switch-Port auf eine Patchblende ist weder Ein- noch Ausgang, sondern
 * beides. Steht die Richtung eines solchen Ports auf "auto" (kein
 * `direction`-Feld), gilt er deshalb als bidirektional statt als das, was
 * die Liste vorgibt, in der er zufaellig angelegt wurde. Eine ausdrueckliche
 * Richtung am Port gewinnt immer.
 */
const RICHTUNGSLOS = /rj ?45|ethercon|cat ?[5-8]|fiber|fibre|opticalcon|sfp|\blc\b|\bsc\b|dante|avb|\bnetwork\b|ethernet/i

const autoRichtung = (port: Port, liste: 'in' | 'out'): PortRichtung =>
  port.direction ?? (RICHTUNGSLOS.test(port.connectorType ?? '') ? 'bidirectional' : liste)

export const portRichtung = (
  equipment: readonly EquipmentItem[],
  equipmentId: string | null | undefined,
  portId: string | null | undefined,
): PortRichtung | undefined => {
  if (!equipmentId || !portId) return undefined
  const eq = equipment.find((e) => e.id === equipmentId)
  if (!eq) return undefined
  const input = eq.inputs.find((p) => p.id === portId)
  if (input) return autoRichtung(input, 'in')
  const output = eq.outputs.find((p) => p.id === portId)
  if (output) return autoRichtung(output, 'out')
  return undefined
}

export interface Endpunkte {
  source: string | null
  sourceHandle?: string | null
  target: string | null
  targetHandle?: string | null
}

export type Ausrichtung<T extends Endpunkte> =
  | { ok: true; connection: T; umgedreht: boolean }
  | { ok: false; grund: 'inputToInput' | 'outputToOutput' }

export const richteVerbindungAus = <T extends Endpunkte>(
  equipment: readonly EquipmentItem[],
  connection: T,
): Ausrichtung<T> => {
  const von = portRichtung(equipment, connection.source, connection.sourceHandle)
  const nach = portRichtung(equipment, connection.target, connection.targetHandle)
  if (!von || !nach) return { ok: true, connection, umgedreht: false }
  // #1219 — "Verbindungswarnungen uebergehen" (Einstellungen) gilt auch fuer
  // die Richtung: wer es eingeschaltet hat, entscheidet selbst und kann
  // Eingang→Eingang bzw. Ausgang→Ausgang trotzdem anlegen. Die Verbindung
  // bleibt dann so, wie sie gezogen wurde.
  if ((von === nach && von !== 'bidirectional') && useUiStore.getState().overrideConnectionWarnings) {
    return { ok: true, connection, umgedreht: false }
  }
  if (von === 'in' && nach === 'in') return { ok: false, grund: 'inputToInput' }
  if (von === 'out' && nach === 'out') return { ok: false, grund: 'outputToOutput' }
  if (von === 'in' || nach === 'out') {
    return {
      ok: true,
      umgedreht: true,
      connection: {
        ...connection,
        source: connection.target,
        sourceHandle: connection.targetHandle,
        target: connection.source,
        targetHandle: connection.sourceHandle,
      },
    }
  }
  return { ok: true, connection, umgedreht: false }
}
