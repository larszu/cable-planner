import type { ControlAction, ControlResult, SwitcherDriver } from './types.js'
import { videohubDriver } from './videohubDriver.js'
import { atemDriver } from './atemDriver.js'
import { textDriver } from './textDriver.js'
import { companionDriver } from './companionDriver.js'

export type { ControlAction, ControlResult, SwitcherDriver } from './types.js'
export { companionConnections } from './companionDriver.js'

/**
 * Die Treiber-Tabelle.
 *
 * `satisfies Record<…>` und keine Liste mit Suche: ein Protokoll, das im Typ
 * steht und keinen Treiber hat, ist damit ein Typfehler statt eines
 * Laufzeit-„nicht unterstuetzt". Genau dieser Fall — ein Protokoll ist
 * auswaehlbar, aber niemand spricht es — faellt sonst erst dem Nutzer auf,
 * vor dem Geraet, unter Zeitdruck.
 */
const TREIBER = {
  videohub: videohubDriver,
  atem: atemDriver,
  text: textDriver,
  companion: companionDriver,
} satisfies Record<ControlAction['protocol'], SwitcherDriver>

export const sendControlAction = async (action: ControlAction): Promise<ControlResult> => {
  const treiber = TREIBER[action.protocol]
  if (!treiber) {
    return { ok: false, message: `Kein Treiber für das Protokoll „${action.protocol}".` }
  }
  return treiber.send(action)
}
