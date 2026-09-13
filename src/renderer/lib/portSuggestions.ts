// ───────────────────────────────────────────────────────────────────────────
// Port-Hinweise — die gemeinsame Form, in der jede Quelle ihre Ports liefert,
// und der Weg von dort zu einer Vorlage.
//
// HIER STAND BIS 2026-09-13 EINE HEURISTIK, und sie ist ersatzlos weg (#858).
//
// Nutzer-Meldung: „heuristik funktioniert nicht, kann also weg."
//
// `suggestPortGroups` war eine Liste aus zehn regulaeren Ausdruecken mit
// festen Port-Zahlen dahinter. Zwei Dinge daran waren nicht reparierbar:
//
//   1. Die Zahlen gehoerten keinem Geraet. Die Regel
//      `\b(switcher|atem|vision\s*mixer|bildmischer)\b` lieferte JEDEM
//      Treffer „8 SDI In, 2 Program, 1 Multiview". Ein ATEM Mini hat vier
//      HDMI-Eingaenge und keinen einzigen SDI-Eingang. Die Regel traf ihn
//      und log.
//   2. Sie sagte nie „weiss ich nicht". Ohne Treffer lieferte sie
//      `1 Custom In / 1 Custom Out`. Der Zweig in der Oberflaeche, der
//      „kein Treffer" melden sollte (`library.suggest.heuristic.noMatch`),
//      war deshalb toter Code: die Funktion gab nie eine leere Liste
//      zurueck.
//
// Was BLEIBT, ist die Form und der Weg: `PortGroupHint` ist die Sprache, in
// der Websuche und Modell ihre Antwort geben, und `buildTemplateFromHints`
// macht daraus eine Vorlage. Wer fragt, steht in `felderAusfuellen.ts`.
// ───────────────────────────────────────────────────────────────────────────
import { v4 as uuidv4 } from 'uuid'
import type { ConnectorType, EquipmentTemplate, Port } from '../types/equipment'

export interface PortGroupHint {
  direction: 'in' | 'out'
  count: number
  connectorType: ConnectorType
  label: string
}

const portsFromHints = (hints: PortGroupHint[], dir: 'in' | 'out'): Port[] =>
  hints
    .filter((h) => h.direction === dir)
    .flatMap((h) =>
      Array.from({ length: Math.max(0, h.count) }, (_item, i) => ({
        id: uuidv4(),
        name: `${h.label} ${i + 1}`,
        type: h.connectorType,
        connectorType: h.connectorType,
      })),
    )

export const buildTemplateFromHints = (
  name: string,
  category: string,
  hints: PortGroupHint[],
): EquipmentTemplate => {
  const inputs = portsFromHints(hints, 'in')
  const outputs = portsFromHints(hints, 'out')
  const maxPorts = Math.max(inputs.length, outputs.length, 3)
  return {
    name: name.trim() || 'Unnamed',
    category: category.trim() || 'Custom',
    inputs,
    outputs,
    width: 240,
    height: 80 + maxPorts * 22,
  }
}
