// ───────────────────────────────────────────────────────────────────────────
// ADR-002, Inkrement 2 — der Bedarfs-Resolver.
//
// Beantwortet aus Plan und Lager allein: welche Lager-Position deckt diesen
// Bedarf? Reine Funktionen ueber Daten — kein Store, kein React, kein IO.
//
// DREI AUSGAENGE, NIE ZWEI. Das ist die tragende Regel dieses Moduls:
//
//   matched-by-type   Tatsache. Beide Seiten tragen dieselbe Katalog-GUID.
//   proposed-by-name  VORSCHLAG. Die Namen passen, die Identitaet fehlt.
//                     Wartet auf eine menschliche Bestaetigung und darf
//                     nirgends wie eine Deckung aussehen.
//   unmatched         Im Lager nicht gefunden.
//
// Ein Fuzzy-Match ueber Modellnamen waere schnell gebaut und meistens
// richtig. Genau das ist das Problem: Eine Kommissionier-Liste, die in neun
// von zehn Faellen stimmt, ist im Lager schlimmer als gar keine — sie wird
// nicht mehr gelesen, sondern geglaubt, und der zehnte Fall kommt als
// fehlendes Geraet am Aufbautag heraus. Deshalb wird ein Namenstreffer nie
// zur Deckung befoerdert, sondern bleibt Vorschlag mit Begruendung.
//
// WAS DER BEDARF IST. Nicht „Kamera 1" — das ist der Instanzname eines
// Geraets. Der Bedarf ist der TYP, gezaehlt: dreimal „Blackmagic URSA
// Broadcast G2". Wo der Plan eine `deviceTypeId` traegt, kommt der
// Modellname aus dem Katalog; wo nicht, bleibt nur der Geraetename, und
// dann ist `unmatched` meist die ehrliche Antwort. Der Ausweg ist, dem
// Geraet einen Katalog-Typ zu geben — nicht, den Namen besser zu raten.
// ───────────────────────────────────────────────────────────────────────────

import type { EquipmentItem } from '../types/equipment'
import type { InventoryItem } from '../types/inventory'
import { resolveDeviceType } from './deviceTypeRegistry'
import { isWithinDistance } from './levenshtein'

export type CoverageOutcome = 'matched-by-type' | 'proposed-by-name' | 'unmatched'

export interface DemandLine {
  /** Stabiler Schluessel der Zeile — Typ-Id, sonst der normalisierte Name. */
  key: string
  /** Katalog-GUID, wenn der Plan sie kennt. */
  deviceTypeId?: string
  /** Modellname aus dem Katalog, sonst der Geraetename. */
  label: string
  category?: string
  quantity: number
  /** Die Plan-Geraete, die diese Zeile ausmachen. */
  equipmentIds: string[]
  /** true, wenn `label` nur der Instanzname ist — dann ist er als
   *  Modellbezeichnung wenig wert, und die UI soll das zeigen koennen. */
  labelIsDeviceName: boolean
}

export interface CoverageLine {
  demand: DemandLine
  outcome: CoverageOutcome
  /** Deckende bzw. VORGESCHLAGENE Lager-Position. */
  itemId?: string
  itemModel?: string
  /** Bestand dieser Position. */
  available?: number
  /** Fehlmenge, wenn der Bestand nicht reicht. Nur bei matched aussagekraeftig:
   *  bei einem Vorschlag ist noch gar nicht sicher, dass es die Position ist. */
  short?: number
  /** Warum der Vorschlag zustande kam — damit ein Mensch ihn pruefen kann. */
  reason?: string
}

export interface CoverageResult {
  lines: CoverageLine[]
  matched: number
  proposed: number
  unmatched: number
}

/** Vergleichsform fuer Namen: Kleinschreibung, Whitespace zusammengefasst. */
export const normaliseName = (raw: string): string =>
  raw.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Ab welcher Laenge ein Namensvergleich ueberhaupt etwas aussagt, und wie
 * viele Zeichen Abstand noch als „derselbe Artikel, anders getippt" durchgehen.
 * Bewusst streng: ein Vorschlag, der oft danebenliegt, macht die Liste
 * unbrauchbarer als gar keine Vorschlaege.
 */
const MIN_NAME_LENGTH = 4
const MAX_EDIT_DISTANCE = 2

/**
 * Zaehlt den Plan zu Bedarfszeilen zusammen.
 *
 * Gruppiert wird ueber die `deviceTypeId`, wo sie da ist — genau das behebt
 * den Fehler, den `seedFromEquipment` heute macht: „Kamera 1" und „Kamera 2"
 * sind dort zwei Schluessel und werden zu zwei Positionen a 1 Stueck, obwohl
 * es ein Modell mit Menge 2 ist.
 */
export const deriveDemand = (equipment: EquipmentItem[]): DemandLine[] => {
  const byKey = new Map<string, DemandLine>()
  for (const eq of equipment) {
    const type = resolveDeviceType(eq.deviceTypeId)
    const label = type?.template.name?.trim() || eq.name.trim()
    if (!label) continue
    const key = eq.deviceTypeId ?? `name:${normaliseName(label)}|${normaliseName(eq.category ?? '')}`
    const existing = byKey.get(key)
    if (existing) {
      existing.quantity += 1
      existing.equipmentIds.push(eq.id)
      continue
    }
    byKey.set(key, {
      key,
      ...(eq.deviceTypeId ? { deviceTypeId: eq.deviceTypeId } : {}),
      label,
      ...(eq.category ? { category: eq.category } : {}),
      quantity: 1,
      equipmentIds: [eq.id],
      labelIsDeviceName: !type,
    })
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label, 'de'))
}

/**
 * Deckt jede Bedarfszeile gegen den Lagerbestand ab.
 *
 * Reihenfolge der Versuche — und die Reihenfolge ist die Aussage:
 *   1. gleiche Katalog-GUID   -> Tatsache
 *   2. gleicher Modellname    -> Vorschlag
 *   3. Modellname fast gleich -> Vorschlag, mit dem Abstand als Begruendung
 *   4. sonst                  -> unmatched
 *
 * Schritt 2 und 3 laufen nur gegen Positionen OHNE eigene Typ-Identitaet:
 * Traegt eine Position bereits eine andere GUID, ist sie ein anderer Typ, und
 * ein Namenstreffer waere dann keine Information, sondern ein Widerspruch.
 */
export const resolveCoverage = (
  equipment: EquipmentItem[],
  items: InventoryItem[],
): CoverageResult => {
  const demands = deriveDemand(equipment)
  const byType = new Map<string, InventoryItem>()
  for (const item of items) {
    if (item.deviceTypeId && !byType.has(item.deviceTypeId)) byType.set(item.deviceTypeId, item)
  }
  const untyped = items.filter((i) => !i.deviceTypeId)
  const byModel = new Map<string, InventoryItem>()
  for (const item of untyped) {
    const key = normaliseName(item.model)
    if (key && !byModel.has(key)) byModel.set(key, item)
  }

  const lines: CoverageLine[] = demands.map((demand) => {
    const exactType = demand.deviceTypeId ? byType.get(demand.deviceTypeId) : undefined
    if (exactType) {
      const short = Math.max(0, demand.quantity - exactType.quantity)
      return {
        demand,
        outcome: 'matched-by-type',
        itemId: exactType.id,
        itemModel: exactType.model,
        available: exactType.quantity,
        ...(short > 0 ? { short } : {}),
      }
    }

    const wanted = normaliseName(demand.label)
    const exactName = wanted ? byModel.get(wanted) : undefined
    if (exactName) {
      return {
        demand,
        outcome: 'proposed-by-name',
        itemId: exactName.id,
        itemModel: exactName.model,
        available: exactName.quantity,
        reason: `Modellname stimmt ueberein ("${exactName.model}"), aber die Lager-Position traegt keine Typ-Identitaet.`,
      }
    }

    if (wanted.length >= MIN_NAME_LENGTH) {
      const near = untyped.find((item) => {
        const model = normaliseName(item.model)
        return (
          model.length >= MIN_NAME_LENGTH &&
          model !== wanted &&
          isWithinDistance(model, wanted, MAX_EDIT_DISTANCE)
        )
      })
      if (near) {
        return {
          demand,
          outcome: 'proposed-by-name',
          itemId: near.id,
          itemModel: near.model,
          available: near.quantity,
          reason: `Modellname weicht um hoechstens ${MAX_EDIT_DISTANCE} Zeichen ab ("${near.model}") — bitte pruefen.`,
        }
      }
    }

    return { demand, outcome: 'unmatched' }
  })

  return {
    lines,
    matched: lines.filter((l) => l.outcome === 'matched-by-type').length,
    proposed: lines.filter((l) => l.outcome === 'proposed-by-name').length,
    unmatched: lines.filter((l) => l.outcome === 'unmatched').length,
  }
}
