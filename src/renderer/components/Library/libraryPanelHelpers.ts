// #468 — Port-Gruppen-Helfer aus LibraryPanel ausgelagert (rein, kein React).
import { v4 as uuidv4 } from 'uuid'
import type { ConnectorType, Port } from '../../types/equipment'

export interface PortGroupDraft {
  id: string
  direction: 'in' | 'out'
  /**
   * #832 — Anzahl der Ports. `''` heisst „das Feld ist gerade leer".
   *
   * ─── WARUM NICHT EINFACH `number` ────────────────────────────────────────
   *
   * Weil `Number('')` gleich `0` ist. Wer die 1 im Feld weglöschte, um eine 12
   * zu tippen, sah nach dem ersten Tastendruck eine `0` — die Zahl kam aus dem
   * Feld zurück, die er gerade geleert hatte. Danach stand `012` da, und die
   * Gruppe war zwischenzeitlich leer. Genau das ist die Meldung „die Input
   * Output Auswahl spinnt manchmal".
   *
   * Der leere Zustand ist deshalb ein eigener Wert und keine 0. `buildPorts`
   * baut daraus keine Ports, und der Dialog sagt es (statt die Gruppe
   * lautlos verschwinden zu lassen).
   */
  count: number | ''
  connectorType: ConnectorType
  label: string
}

/** Die Vorgabe-Beschriftung einer Richtung. Eine Stelle, zwei Leser. */
export const vorgabeBeschriftung = (direction: 'in' | 'out'): string =>
  direction === 'in' ? 'Input' : 'Output'

export const defaultGroup = (direction: 'in' | 'out'): PortGroupDraft => ({
  id: uuidv4(),
  direction,
  count: 1,
  connectorType: 'Custom',
  label: vorgabeBeschriftung(direction),
})

/**
 * Die Richtung wechseln — und die Beschriftung mitnehmen, solange sie noch
 * die Vorgabe ist (#832).
 *
 * ─── DER FEHLER, DEN DAS BEHEBT ──────────────────────────────────────────
 *
 * Eine neue Gruppe hiess `Input`. Wer sie danach auf „Output" umstellte,
 * bekam Ausgänge mit den Namen `Input 1`, `Input 2` — die Richtung war
 * gewechselt, die Beschriftung nicht. Auf dem Blatt stand danach ein Ausgang
 * namens „Input", und im Aufbau sucht jemand den passenden Eingang dazu.
 *
 * ─── UND WAS ES AUSDRUECKLICH NICHT TUT ──────────────────────────────────
 *
 * Eine SELBST vergebene Beschriftung bleibt stehen. Wer seine Gruppe „Aux"
 * genannt hat, will sie nach dem Richtungswechsel nicht „Output" heissen
 * sehen — dieselbe Regel wie bei `renameIfDefault` in der
 * Eigenschaften-Leiste (#175).
 */
export const richtungWechseln = (
  group: PortGroupDraft,
  direction: 'in' | 'out',
): Partial<PortGroupDraft> =>
  group.label.trim() === vorgabeBeschriftung(group.direction)
    ? { direction, label: vorgabeBeschriftung(direction) }
    : { direction }

export const buildPorts = (groups: PortGroupDraft[], direction: 'in' | 'out'): Port[] => {
  const filtered = groups.filter((group) => group.direction === direction)
  return filtered.flatMap((group) =>
    Array.from({ length: Math.max(0, group.count === '' ? 0 : group.count) }, (_item, index) => ({
      id: uuidv4(),
      name: `${group.label} ${index + 1}`,
      type: group.connectorType,
      connectorType: group.connectorType,
    })),
  )
}
