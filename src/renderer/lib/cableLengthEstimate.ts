// #350 — Geometrische Kabellängen-Schätzung.
//
// Gerechnet wird der Weg, den das Kabel auf dem Canvas NIMMT: von Buchse zu
// Buchse über seine Knickpunkte (A*-Routing oder von Hand gesetzt). Ohne
// Knickpunkte zeichnet der Canvas ein rechtwinkliges Z; gerechnet wird
// dasselbe Z, nicht die Luftlinie — die war bis v9.0 die Zahl und lag bei
// jedem Kabel, das um eine Ecke laeuft, zu kurz.
//
// Der Massstab kommt aus dem Hallenplan, wenn einer kalibriert ist
// (`lib/grundriss/massstab.ts`, auch perspektivisch), sonst aus „Meter pro
// 100 px". Danach Zuschlag in Prozent und Aufrunden. Die Aufteilung auf die
// vorhandenen Trommellaengen macht die Stueckliste (`stockSplit`), nicht
// diese Datei.

import type { Cable, DerivedLengthOrigin } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'
import type { LengthEstimationScheme } from '../types/project'
import type { Grundriss, PlanKalibrierung, PlanPunkt } from '../types/grundriss'
import { meterAbbildung, wegLaengeM } from './grundriss/massstab'

/** Was die Rechnung ausser Kabel und Geraeten braucht. Beides optional: ohne
 *  Buchsen-Aufloesung gilt der Geraete-Mittelpunkt, ohne Plan der Massstab
 *  „Meter pro 100 px". Die Buchsen kommen als Funktion herein, damit diese
 *  Datei rein bleibt — die Geraete-Geometrie haengt am eingestellten Raster. */
export interface LaengenKontext {
  grundriss?: Grundriss
  buchse?: (eq: EquipmentItem, portId: string, richtung: 'source' | 'target') => PlanPunkt | null
}

export const DEFAULT_LENGTH_ESTIMATION: LengthEstimationScheme = {
  metersPer100px: 1,
  slackPercent: 15,
  roundUp: true,
}

/** Canvas-Mittelpunkt eines Geraets. EXPORTIERT, weil die Veraltungs-Pruefung
 *  denselben Punkt braucht: zwei Rechnungen mit zwei Mittelpunkt-Begriffen
 *  meldeten einen Versatz, den es nicht gibt. */
export const centerOf = (e: EquipmentItem): { x: number; y: number } => ({
  x: e.x + (e.width ?? 220) / 2,
  y: e.y + (e.height ?? 60) / 2,
})

/** Der Streckenzug des Kabels in Canvas-Pixeln. */
export const kabelWeg = (
  cable: Cable,
  from: EquipmentItem,
  to: EquipmentItem,
  ctx: LaengenKontext = {},
): PlanPunkt[] => {
  const a = ctx.buchse?.(from, cable.fromPortId, 'source') ?? centerOf(from)
  const b = ctx.buchse?.(to, cable.toPortId, 'target') ?? centerOf(to)
  if (cable.waypoints && cable.waypoints.length > 0) return [a, ...cable.waypoints, b]
  const mitte = (a.x + b.x) / 2
  return [a, { x: mitte, y: a.y }, { x: mitte, y: b.y }, b]
}

/** Die Kalibrierung, mit der gerechnet wird, als Text — fuer die
 *  Veraltungs-Pruefung: aendert sie sich, ist die Laenge ueberholt. */
export const massstabSchluessel = (k: PlanKalibrierung | undefined): string | undefined =>
  k ? JSON.stringify(k) : undefined

/** Schätzt die Länge EINES Kabels (in Metern) aus der Canvas-Geometrie.
 *  Liefert null, wenn ein Endpunkt-Gerät fehlt, das Kabel wireless ist oder
 *  ein Punkt des Wegs ausserhalb der perspektivischen Kalibrierung liegt. */
export const estimateCableLength = (
  cable: Cable,
  eqById: Map<string, EquipmentItem>,
  scheme: LengthEstimationScheme,
  ctx: LaengenKontext = {},
): number | null => {
  if (cable.wireless) return null
  const from = eqById.get(cable.fromEquipmentId)
  const to = eqById.get(cable.toEquipmentId)
  if (!from || !to) return null
  const weg = kabelWeg(cable, from, to, ctx)
  const kal = ctx.grundriss?.kalibrierung
  const abbildung = kal ? meterAbbildung(kal) : null
  const roh = abbildung
    ? wegLaengeM(abbildung, weg)
    : wegLaengeM((p) => ({ x: (p.x / 100) * scheme.metersPer100px, y: (p.y / 100) * scheme.metersPer100px }), weg)
  if (roh == null) return null
  const meters = roh * (1 + scheme.slackPercent / 100)
  if (scheme.roundUp) return Math.max(1, Math.ceil(meters))
  return Math.max(0.1, Math.round(meters * 10) / 10)
}

export interface EstimateResult {
  /** id → neue Länge für alle Kabel, die geschätzt werden konnten. */
  updates: Map<string, number>
  /** id → Geometrie und Maßstab, aus denen sie entstand (Bedarf 13).
   *  Ohne diese Spur sieht eine geschätzte Länge aus wie eine gemessene. */
  origins: Map<string, DerivedLengthOrigin>
  estimated: number
  skipped: number
}

/** Schätzt die Längen aller (nicht-wireless) Kabel. */
export const estimateAllCableLengths = (
  cables: Cable[],
  equipment: EquipmentItem[],
  scheme: LengthEstimationScheme,
  ctx: LaengenKontext = {},
): EstimateResult => {
  const eqById = new Map(equipment.map((e) => [e.id, e]))
  const updates = new Map<string, number>()
  const origins = new Map<string, DerivedLengthOrigin>()
  let skipped = 0
  for (const c of cables) {
    const len = estimateCableLength(c, eqById, scheme, ctx)
    if (len == null) {
      skipped += 1
      continue
    }
    updates.set(c.id, len)
    const from = eqById.get(c.fromEquipmentId)!
    const to = eqById.get(c.toEquipmentId)!
    // Der URSPRUNG, nicht der Mittelpunkt — siehe `DerivedLengthOrigin`:
    // nur er ueberlebt die Raster-Heilung beim Laden unveraendert.
    origins.set(c.id, {
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      metersPer100px: scheme.metersPer100px,
      slackPercent: scheme.slackPercent,
      weg: (c.waypoints ?? []).map((p) => ({ x: p.x, y: p.y })),
      ...(ctx.grundriss?.kalibrierung ? { massstabSchluessel: massstabSchluessel(ctx.grundriss.kalibrierung) } : {}),
    })
  }
  return { updates, origins, estimated: updates.size, skipped }
}
