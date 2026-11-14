import type { Port } from '../types/equipment'

/**
 * #1228 — Die Art eines Ports steht an EINER Stelle.
 *
 * Ein Port ist Eingang, Ausgang oder bidirektional. Eingang und Ausgang sagt
 * schon die Liste, in der er steht (`inputs` / `outputs`); das Feld
 * `direction` traegt nur noch `bidirectional`. Bis 2026-11 gab es daneben in
 * der Ports-Sektion ein Feld „Richtung" mit „nur Eingang" / „nur Ausgang" —
 * dieselbe Angabe ein zweites Mal, und sie konnte der Liste widersprechen
 * (ein Port unter „Eingaenge" mit „nur Ausgang").
 *
 * `ordnePortArten` raeumt alte Daten auf: die doppelte Angabe faellt weg, und
 * ein Port, dessen Feld der Liste widersprach, wandert in die Liste, die das
 * Feld meinte. Das Feld war bisher massgeblich (`portRichtung`), also aendert
 * sich am Verhalten nichts — nur der Widerspruch ist weg. Die Kabel zeigen
 * auf die Port-Id und bleiben stecken.
 */
export interface PortListen {
  inputs: Port[]
  outputs: Port[]
}

const ohneRichtung = (port: Port): Port => {
  const { direction: _weg, ...rest } = port
  void _weg
  return rest
}

export const ordnePortArten = <T extends PortListen>(listen: T): T => {
  const gerichtet = (p: Port) => p.direction === 'in' || p.direction === 'out'
  if (!listen.inputs.some(gerichtet) && !listen.outputs.some(gerichtet)) return listen
  // Gewanderte Ports haengen hinten an; die eigenen behalten ihre Reihenfolge.
  const inputs = listen.inputs.filter((p) => p.direction !== 'out').map((p) => (p.direction === 'in' ? ohneRichtung(p) : p))
  const outputs = listen.outputs.filter((p) => p.direction !== 'in').map((p) => (p.direction === 'out' ? ohneRichtung(p) : p))
  inputs.push(...listen.outputs.filter((p) => p.direction === 'in').map(ohneRichtung))
  outputs.push(...listen.inputs.filter((p) => p.direction === 'out').map(ohneRichtung))
  return { ...listen, inputs, outputs }
}
