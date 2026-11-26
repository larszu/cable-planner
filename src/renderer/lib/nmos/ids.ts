// ───────────────────────────────────────────────────────────────────────────
// NMOS-Kennungen aus dem Plan (#1240, Stufe 6).
//
// Jede NMOS-Ressource traegt eine UUID (IS-04, resource_core.json). Ein
// Controller merkt sich Verbindungen und Zuordnungen ueber genau diese UUID;
// wechselt sie bei jedem Export, sieht er bei jedem Export eine neue Anlage.
// Deshalb ist sie ABGELEITET und nicht zufaellig: UUID v5 (RFC 9562, 5.5,
// SHA-1) ueber Projekt-Kennung, Ressourcenart und die Plan-IDs. Derselbe Plan
// gibt immer dieselben UUIDs; zwei Projekte geben nie dieselben.
//
// `version` ist ein TAI-Zeitstempel `<sekunden>:<nanosekunden>` (IS-04,
// „Data Model: Identifier Mapping“/resource_core.json). TAI liegt seit dem
// 1.1.2017 37 Sekunden vor UTC (IERS Bulletin C); die Uhr kommt von aussen,
// damit der Export rein und pruefbar bleibt.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import { v5 as uuidv5 } from 'uuid'

/** Fester Namensraum des cable-planner fuer NMOS-Kennungen. Nie aendern. */
export const NMOS_NAMESPACE = 'dc0c7075-0831-4e39-bf51-838b653f7596'

export type NmosResourceKind =
  | 'node'
  | 'device'
  | 'source'
  | 'flow'
  | 'sender'
  | 'receiver'

/** Stabile UUID fuer eine Ressource: gleiche Eingabe, gleiche UUID. */
export const nmosId = (projectKey: string, kind: NmosResourceKind, ...parts: string[]): string =>
  uuidv5([projectKey, kind, ...parts].join('\u001f'), NMOS_NAMESPACE)

/** TAI − UTC seit 2017-01-01 (IERS Bulletin C). */
export const TAI_OFFSET_S = 37

/** IS-04-Version als TAI-Zeitstempel. */
export const taiVersion = (at: Date): string => {
  const ms = at.getTime()
  const s = Math.floor(ms / 1000) + TAI_OFFSET_S
  const ns = (ms % 1000) * 1_000_000
  return `${s}:${ns}`
}
