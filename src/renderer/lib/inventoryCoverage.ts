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
import type { InventoryItem, InventoryUnit } from '../types/inventory'
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
  /** Namen der Racks, aus deren Innenleben diese Zeile (auch) stammt.
   *  Leer/fehlend bei Geraeten, die selbst auf dem Canvas liegen. */
  fromRacks?: string[]
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
  /**
   * ALLE deckenden Positionen, nicht nur die erste.
   *
   * WARUM DAS FELD EXISTIERT. Bis 2026-09-04 gewann hier die erste gefundene
   * Position und die zweite wurde verworfen — nichts wurde addiert. Ein Lager
   * fuehrt dasselbe Modell aber regelmaessig an mehreren Orten: ein Artikel
   * traegt genau EINE `locationId` (types/inventory.ts), gleiches Modell in
   * zwei Cases erzwingt also zwei Positionen, und `addItem` dedupliziert
   * nichts. Gemessen: Plan braucht 5, Lager hat 3 in Case 1 und 3 in Case 2 —
   * die Liste meldete "Bestand 3, Fehlmenge 2" und schickte den
   * Kommissionierer mit "Menge 5" nach Case 1. Es waren sechs da.
   *
   * `packList.ts` summiert an der begrifflich gleichen Stelle korrekt ueber
   * Positionen (`counts.get(it.model) + it.quantity`). Der Resolver tat es
   * nicht — dieselbe Wahrheit, zwei Rechnungen, eine davon falsch.
   *
   * Reihenfolge ist deterministisch (Modell, dann Id), damit eine erneut
   * erzeugte Liste dieselbe bleibt.
   */
  sources?: CoverageSource[]
}

/** Eine einzelne Lager-Position, die zu einer Bedarfszeile beitraegt. */
export interface CoverageSource {
  itemId: string
  /** Nutzbarer Bestand: Menge abzueglich bekannt unbrauchbarer Einheiten. */
  available: number
  model: string
  /** Lagerort-Id der Position — der Aufrufer loest den Pfad auf. */
  locationId?: string
  /** Wie viele serialisierte Einheiten dieser Position nicht einsatzbereit
   *  sind (defekt, in Reparatur, ausgemustert). 0 wird weggelassen. */
  unusable?: number
}

/**
 * Zustaende, die eine serialisierte Einheit aus dem nutzbaren Bestand nehmen.
 *
 * WARUM DAS HIER STEHT (gemessen 2026-09-04, Gegenrunde). `resolveCoverage`
 * nahm `units` gar nicht entgegen. Vier Geraete im Bestand, zwei davon in
 * Reparatur — die Stueckliste sagte „gedeckt, Bestand 4", und die
 * Kommissionier-Liste schickte jemanden nach vier.
 *
 * Dass der Zustand Lager-Information ist, weiss der Code an anderer Stelle
 * sehr wohl: `packList.ts` traegt `condition` in die Packliste,
 * `inventoryReport.ts` zaehlt nach Zustand. Nur die Liste, die INS LAGER
 * GEHT, tat es nicht.
 *
 * `ok` ist der einzige einsatzbereite Zustand — die uebrigen drei sind es
 * ausdruecklich nicht (`types/inventory.ts`). Die Liste steht als Menge da
 * und nicht als Negativ-Pruefung, damit ein spaeter ergaenzter Zustand hier
 * auffaellt statt still als brauchbar durchzulaufen.
 */
const UNBRAUCHBAR: ReadonlySet<string> = new Set(['defect', 'inRepair', 'retired'])

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

  const zaehle = (
    key: string,
    zeile: Omit<DemandLine, 'key' | 'quantity'>,
    ausRack?: string,
  ) => {
    const existing = byKey.get(key)
    if (existing) {
      existing.quantity += 1
      existing.equipmentIds.push(...zeile.equipmentIds)
      if (ausRack && !existing.fromRacks?.includes(ausRack)) {
        existing.fromRacks = [...(existing.fromRacks ?? []), ausRack]
      }
      return
    }
    byKey.set(key, {
      key,
      quantity: 1,
      ...zeile,
      ...(ausRack ? { fromRacks: [ausRack] } : {}),
    })
  }

  // Erste Phase: die Geraete, die selbst auf dem Canvas liegen.
  for (const eq of equipment) {
    const type = resolveDeviceType(eq.deviceTypeId)
    const label = type?.template.name?.trim() || eq.name.trim()
    if (!label) continue
    const key =
      eq.deviceTypeId ?? `name:${normaliseName(label)}|${normaliseName(eq.category ?? '')}`
    zaehle(key, {
      ...(eq.deviceTypeId ? { deviceTypeId: eq.deviceTypeId } : {}),
      label,
      ...(eq.category ? { category: eq.category } : {}),
      equipmentIds: [eq.id],
      labelIsDeviceName: !type,
    })
  }

  // ZWEITE PHASE — DAS INNENLEBEN EINES BLACK-BOX-RACKS.
  //
  // Gemessen 2026-09-04 (Gegenrunde): `groupPresetSpawnSlice` legt fuer ein
  // eingefuegtes Rack GENAU EIN EquipmentItem an; die enthaltenen Geraete
  // leben nur im `rackInternalSnapshot`. `deriveDemand` las ausschliesslich
  // `equipment` — ein Rack mit zwoelf Geraeten erschien damit als „1x FOH Rack
  // (Rack) — nicht im Lager", ohne jeden Hinweis, dass zwoelf Positionen
  // darunter verschwinden. Stiller Unterlauf des Bedarfs, in genau der Liste,
  // mit der jemand ins Lager geht.
  //
  // WARUM ZWEITE PHASE UND NICHT IN DERSELBEN SCHLEIFE. Der Schluessel einer
  // Namenszeile enthaelt die Kategorie; ein Snapshot-Eintrag hat keine. In
  // einem Durchgang haetten „Yamaha CL5" auf dem Canvas und „Yamaha CL5" im
  // Rack zwei Zeilen a 1 ergeben statt einer mit 2 — und welche zuerst
  // entsteht, haengt an der Array-Reihenfolge. Erst alle echten Geraete, dann
  // die Rack-Inhalte gegen die vorhandenen Zeilen: das Ergebnis haengt am
  // Plan, nicht am Bearbeitungsverlauf.
  //
  // Die Snapshot-Eintraege tragen NUR einen Namen (plus Hoehe und optional
  // eine Rentman-Id) — keine Katalog-Guid. Sie koennen deshalb nur ueber den
  // Namen zugeordnet werden und landen im Vorschlags-Pfad, nicht in der
  // Tatsachen-Spalte. Mehr weiss der Snapshot nicht.
  const nachLabel = new Map<string, string>()
  for (const [k, v] of byKey) nachLabel.set(normaliseName(v.label), k)

  for (const eq of equipment) {
    for (const inhalt of eq.rackInternalSnapshot?.items ?? []) {
      const name = inhalt.name?.trim()
      if (!name) continue
      const vorhanden = nachLabel.get(normaliseName(name))
      const key = vorhanden ?? `name:${normaliseName(name)}|`
      if (!vorhanden) nachLabel.set(normaliseName(name), key)
      zaehle(
        key,
        {
          label: name,
          equipmentIds: [eq.id],
          labelIsDeviceName: true,
        },
        eq.name.trim() || eq.id,
      )
    }
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
  units: InventoryUnit[] = [],
): CoverageResult => {
  const demands = deriveDemand(equipment)

  // Je Artikel: wie viele serialisierte Einheiten sind nicht einsatzbereit.
  const unbrauchbarProItem = new Map<string, number>()
  for (const u of units) {
    if (!UNBRAUCHBAR.has(u.condition)) continue
    unbrauchbarProItem.set(u.itemId, (unbrauchbarProItem.get(u.itemId) ?? 0) + 1)
  }

  // Deterministische Reihenfolge, bevor gruppiert wird: die erzeugte Liste
  // soll nicht davon abhaengen, in welcher Reihenfolge jemand die Positionen
  // angelegt hat.
  const sortiert = items
    .slice()
    .sort((a, b) => a.model.localeCompare(b.model, 'de') || a.id.localeCompare(b.id))

  const quelle = (item: InventoryItem): CoverageSource => {
    // Nicht unter null: mehr unbrauchbare Einheiten als Bestand waere ein
    // widerspruechlicher Datenstand, und eine negative Menge in einer
    // Kommissionier-Liste ist schlimmer als eine zu kleine.
    const unusable = Math.min(item.quantity, unbrauchbarProItem.get(item.id) ?? 0)
    return {
      itemId: item.id,
      model: item.model,
      available: item.quantity - unusable,
      ...(item.locationId ? { locationId: item.locationId } : {}),
      ...(unusable > 0 ? { unusable } : {}),
    }
  }
  const summe = (q: CoverageSource[]): number => q.reduce((n, x) => n + x.available, 0)

  // ALLE Positionen je Typ, nicht die erste. Siehe CoverageLine.sources.
  const byType = new Map<string, CoverageSource[]>()
  for (const item of sortiert) {
    if (!item.deviceTypeId) continue
    const liste = byType.get(item.deviceTypeId)
    if (liste) liste.push(quelle(item))
    else byType.set(item.deviceTypeId, [quelle(item)])
  }
  const untyped = sortiert.filter((i) => !i.deviceTypeId)
  const byModel = new Map<string, CoverageSource[]>()
  for (const item of untyped) {
    const key = normaliseName(item.model)
    if (!key) continue
    const liste = byModel.get(key)
    if (liste) liste.push(quelle(item))
    else byModel.set(key, [quelle(item)])
  }

  const lines: CoverageLine[] = demands.map((demand) => {
    const exactType = demand.deviceTypeId ? byType.get(demand.deviceTypeId) : undefined
    if (exactType && exactType.length > 0) {
      const bestand = summe(exactType)
      const short = Math.max(0, demand.quantity - bestand)
      return {
        demand,
        outcome: 'matched-by-type',
        itemId: exactType[0].itemId,
        itemModel: exactType[0].model,
        available: bestand,
        sources: exactType,
        ...(short > 0 ? { short } : {}),
      }
    }

    const wanted = normaliseName(demand.label)
    const exactName = wanted ? byModel.get(wanted) : undefined
    if (exactName && exactName.length > 0) {
      return {
        demand,
        outcome: 'proposed-by-name',
        itemId: exactName[0].itemId,
        itemModel: exactName[0].model,
        available: summe(exactName),
        sources: exactName,
        reason: `Modellname stimmt ueberein ("${exactName[0].model}"), aber die Lager-Position traegt keine Typ-Identitaet.`,
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
        // Auch hier alle Positionen desselben Modells, nicht nur die gefundene.
        const gleiche = byModel.get(normaliseName(near.model)) ?? [quelle(near)]
        return {
          demand,
          outcome: 'proposed-by-name',
          itemId: gleiche[0].itemId,
          itemModel: gleiche[0].model,
          available: summe(gleiche),
          sources: gleiche,
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
