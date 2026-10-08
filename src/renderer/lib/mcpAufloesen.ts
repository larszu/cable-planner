// ───────────────────────────────────────────────────────────────────────────
// #1052 — Geraet und Port aus dem, was ein MCP-Client schreibt.
//
// Ein Agent nennt Geraete und Ports beim NAMEN („Kamera 1", „12G-SDI Out"),
// nicht bei der uuid. Wer dabei rät, verbindet den falschen Port, und ein
// falsches Kabel im Plan ist teurer als eine Ablehnung. Also: exakt zuerst,
// Gross/Klein nur, wenn es danach genau EINEN Treffer gibt, und sonst ein
// Fehler, der die Kandidaten nennt — damit der naechste Versuch trifft.
//
// Lesende (verify_cabling) und schreibende Werkzeuge (connect_*) loesen
// hierueber auf; zwei Aufloesungen waeren zwei Meinungen darueber, welcher
// Port „SDI In 1" ist.
//
// REIN: kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import { portDisplayLabel } from './portLabel'
import type { CablePlannerProject } from '../types/project'
import type { EquipmentItem, Port } from '../types/equipment'

export type Aufgeloest<T> = { ok: true; wert: T } | { ok: false; fehler: string }

const KANDIDATEN_MAX = 12

const liste = (namen: readonly string[]): string => {
  const kopf = namen.slice(0, KANDIDATEN_MAX).map((n) => `"${n}"`).join(', ')
  return namen.length > KANDIDATEN_MAX ? `${kopf} … (${namen.length} in all)` : kopf
}

/** Stufen von streng nach weich; die erste mit Treffern entscheidet. */
const stufenweise = <T>(
  alle: readonly T[],
  stufen: ReadonlyArray<(x: T) => boolean>,
): T[] => {
  for (const passt of stufen) {
    const treffer = alle.filter(passt)
    if (treffer.length > 0) return treffer
  }
  return []
}

export const findeGeraet = (
  project: Readonly<CablePlannerProject>,
  ref: unknown,
): Aufgeloest<EquipmentItem> => {
  const r = typeof ref === 'string' ? ref.trim() : ''
  if (!r) return { ok: false, fehler: 'No device given.' }
  const klein = r.toLowerCase()
  const treffer = stufenweise(project.equipment, [
    (e) => e.id === r,
    (e) => e.name === r,
    (e) => e.name.toLowerCase() === klein,
  ])
  if (treffer.length === 1) return { ok: true, wert: treffer[0] }
  if (treffer.length > 1) {
    return {
      ok: false,
      fehler: `"${r}" names ${treffer.length} devices - pass the id instead: ${liste(treffer.map((e) => `${e.name} (${e.id})`))}.`,
    }
  }
  const aehnlich = project.equipment.filter((e) => e.name.toLowerCase().includes(klein)).map((e) => e.name)
  return {
    ok: false,
    fehler: aehnlich.length
      ? `No device "${r}". Similar: ${liste(aehnlich)}.`
      : `No device "${r}" in this plan.`,
  }
}

export interface PortTreffer {
  port: Port
  richtung: 'in' | 'out'
}

/**
 * `rolle` loest einen Namen auf, der an Ein- UND Ausgang vorkommt: das
 * Kabel beginnt an einem Ausgang und endet an einem Eingang. Mehr als das
 * wird nicht geraten.
 */
export const findePort = (
  geraet: EquipmentItem,
  ref: unknown,
  rolle?: 'from' | 'to',
): Aufgeloest<PortTreffer> => {
  const r = typeof ref === 'string' ? ref.trim() : ''
  if (!r) return { ok: false, fehler: `No port given for ${geraet.name}.` }
  const klein = r.toLowerCase()
  const alle: PortTreffer[] = [
    ...geraet.inputs.map((port) => ({ port, richtung: 'in' as const })),
    ...geraet.outputs.map((port) => ({ port, richtung: 'out' as const })),
  ]
  let treffer = stufenweise(alle, [
    (t) => t.port.id === r,
    (t) => t.port.name === r,
    (t) => portDisplayLabel(t.port) === r,
    (t) => t.port.name.toLowerCase() === klein,
  ])
  if (treffer.length > 1 && rolle) {
    const seite = treffer.filter((t) => t.richtung === (rolle === 'from' ? 'out' : 'in'))
    if (seite.length > 0) treffer = seite
  }
  if (treffer.length === 1) return { ok: true, wert: treffer[0] }
  if (treffer.length > 1) {
    return {
      ok: false,
      fehler: `"${r}" names ${treffer.length} ports on ${geraet.name} - pass the port id: ${liste(treffer.map((t) => `${t.port.name} (${t.richtung}, ${t.port.id})`))}.`,
    }
  }
  const aehnlich = alle.filter((t) => t.port.name.toLowerCase().includes(klein))
  const zeigen = (aehnlich.length ? aehnlich : alle).map((t) => `${t.port.name} (${t.richtung})`)
  return {
    ok: false,
    fehler: `${geraet.name} has no port "${r}". ${aehnlich.length ? 'Similar' : 'Its ports'}: ${liste(zeigen)}.`,
  }
}
