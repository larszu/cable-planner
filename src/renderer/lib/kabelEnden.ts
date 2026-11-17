// ───────────────────────────────────────────────────────────────────────────
// #1222 — Kabel mit verschiedenen Steckern an den beiden Enden (RJ45 ↔ M8,
// LC ↔ SC).
//
// Das Modell konnte das schon: `terminationFrom` / `terminationTo` stehen je
// Ende am Kabel, gehen in die Pull-Liste und die Terminierungsliste. Sie
// waren aber unter „Festinstallation" versteckt, und die Stueckliste kannte
// sie nicht — ein RJ45↔M8-Kabel stand dort als „Ethernet/RJ45" mitten unter
// den Patchkabeln. Ein zweites Feldpaar daneben waere dieselbe Angabe ein
// zweites Mal; also gilt dieses eine, und die Stueckliste liest es.
//
// Die Stueckliste gruppiert nach Typ, Laenge UND Enden: wer zehn RJ45↔M8 und
// zwanzig RJ45↔RJ45 braucht, bestellt zwei verschiedene Kabel.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { Cable } from '../types/cable'
import type { CableSpec } from '../types/cableSpec'

type MitEnden = Pick<Cable, 'type' | 'terminationFrom' | 'terminationTo'>

// Der Stuecklisten-Schluessel trennt mit `|` — im Freitext darf es nicht stehen.
const sauber = (s: string | undefined): string => (s ?? '').trim().replace(/\|/g, '/')

/** „RJ45 ↔ M8", oder `undefined`, wenn an keinem Ende etwas eingetragen ist.
 *  Ein leeres Ende traegt den Kabeltyp. */
export const kabelEnden = (c: MitEnden): string | undefined => {
  const von = sauber(c.terminationFrom)
  const nach = sauber(c.terminationTo)
  if (!von && !nach) return undefined
  return `${von || c.type} ↔ ${nach || c.type}`
}

/** Der Typ, wie die Stueckliste ihn zeigt: „Ethernet/RJ45 (RJ45 ↔ M8)". */
export const bomTyp = (c: MitEnden): string => {
  const enden = kabelEnden(c)
  return enden ? `${c.type} (${enden})` : c.type
}

/** Gruppier-Schluessel der Stuecklisten: Typ samt Enden und Laenge.
 *  Ohne Enden derselbe wie bisher (`Typ|Laenge`) — gespeicherte Rentman-
 *  Planmengen und -Zuordnungen bleiben gueltig. */
export const bomSchluessel = (c: MitEnden & Pick<Cable, 'length'>): string => `${bomTyp(c)}|${c.length}`

/** #1278 — Die Stecker eines Kabeltyps mit zwei verschiedenen Enden als
 *  `terminationFrom/To` fuer ein neues Kabel. Liegt das zweite Ende des Typs
 *  am Quell-Port, wird das Kabel umgedreht. Ein Typ mit gleichen Enden gibt
 *  nichts vor — dann bleibt es beim Stecker des Ports. */
export const endenAusKabeltyp = (
  spec: Pick<CableSpec, 'connectorType' | 'connectorTypeTo'> | undefined,
  quellStecker?: string,
): Pick<Cable, 'terminationFrom' | 'terminationTo'> => {
  const a = spec?.connectorType
  const b = spec?.connectorTypeTo
  if (!a || !b || a === b) return {}
  return quellStecker === b ? { terminationFrom: b, terminationTo: a } : { terminationFrom: a, terminationTo: b }
}

/** „powerCON TRUE1 ↔ Schuko 230V" bzw. der eine Stecker — fuer Listen von Kabeltypen. */
export const kabeltypStecker = (spec: Pick<CableSpec, 'connectorType' | 'connectorTypeTo'>): string =>
  spec.connectorTypeTo && spec.connectorTypeTo !== spec.connectorType
    ? `${spec.connectorType} ↔ ${spec.connectorTypeTo}`
    : spec.connectorType
