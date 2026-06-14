// #468 — Reine Daten-/Mapping-Helfer aus RentmanImportDialog ausgelagert
// (kein React/JSX). Macht den Dialog ~360 Zeilen kleiner und die Parser
// einzeln testbar. Verhaltensneutral: identischer Code, nur verschoben.
import { v4 as uuidv4 } from 'uuid'
import { STORAGE_KEYS } from '../../lib/storageKeys'
import type { Port } from '../../types/equipment'
import type { CableType } from '../../types/cable'

export interface RentmanProject {
  id: string
  name: string
  status?: string
  number?: string | number
  periodStart?: string
  periodEnd?: string
}

export type RentmanKind = 'device' | 'virtual' | 'physical' | 'comment'

export const isTruthy = (v: unknown): boolean =>
  v === true || v === 1 || v === '1' || v === 'true' || v === 'yes'

/** Defensiv (Rentman-Feldnamen variieren je API-Version/Sprache): erkennt eine
 *  Kommentar-/Text-Zeile, die KEIN Gerät ist und nicht importiert werden soll. */
export const isRentmanCommentRow = (r: Record<string, unknown>): boolean => {
  const t = String(r.type ?? r.itemtype ?? r.linetype ?? r.line_type ?? r.rowtype ?? '').toLowerCase()
  if (/remark|comment|text|note|opmerking|spacer|header|titel|title/.test(t)) return true
  return (
    isTruthy(r.isremark) || isTruthy(r.is_remark) || isTruthy(r.iscomment) ||
    isTruthy(r.is_comment) || isTruthy(r.istext) || isTruthy(r.is_text)
  )
}

/** Defensiv: physische Kombination (eine Bestandseinheit) vs. virtuelle. */
export const isRentmanPhysicalFlag = (r: Record<string, unknown>): boolean =>
  isTruthy(r.is_physical) || isTruthy(r.isphysical) || isTruthy(r.isphysicalcombi) ||
  isTruthy(r.is_physical_combination) || isTruthy(r.physical) ||
  /physical/.test(String(r.type ?? '').toLowerCase())

export interface RentmanEquipment {
  id: string
  equipmentId: string
  name: string
  category: string
  checked: boolean
  qty: number
  isSetChild: boolean
  parentId: string | null
  /** Rentman-Art der Zeile: Einzelgerät, virtuelle/physische Kombination
   *  oder Kommentar (Text-Zeile, kein Gerät). Defensiv geparst. */
  kind: RentmanKind
  /** Anzahl Inhalte einer Kombination (nur bei virtual/physical gesetzt). */
  contentsCount?: number
  /** v7.9.70 / #167 — Engineering-Daten aus dem Rentman /equipment Endpoint.
   *  Werden beim Import auf das EquipmentTemplate gespiegelt. */
  powerWatts?: number
  weightKg?: number
  depthMm?: number
  /** #420 — Mietpreis pro Tag (aus Rentman gezogen). */
  rentPricePerDay?: number
  rentCurrency?: string
  raw: Record<string, unknown>
}

// v7.9.70 / #167 — Helper: liest einen numerischen Wert aus einem Rentman-
// Record, akzeptiert mehrere Feldnamen (Rentman API ist historisch
// inkonsistent: power_consumption / power / wattage haben dieselbe Semantik).
export const pickNumber = (record: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const k of keys) {
    const raw = record[k]
    if (raw == null || raw === '') continue
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'))
    if (Number.isFinite(n) && n > 0) return n
  }
  return undefined
}

export const mapProjects = (projects: unknown[]): RentmanProject[] =>
  projects.map((item) => {
    const record = item as Record<string, unknown>
    const periodStart =
      (record.usageperiod_start as string) ??
      (record.planperiod_start as string) ??
      (record.equipment_period_from as string) ??
      undefined
    const periodEnd =
      (record.usageperiod_end as string) ??
      (record.planperiod_end as string) ??
      (record.equipment_period_to as string) ??
      undefined
    return {
      id: String(record.id ?? record._id ?? ''),
      name: String(record.name ?? record.displayname ?? 'Unnamed project'),
      status: record.status ? String(record.status) : undefined,
      number: (record.number as string | number | undefined) ?? undefined,
      periodStart,
      periodEnd,
    }
  }).filter((project) => project.id)

export const mapPort = (name: string, type: Port['connectorType'] = 'Custom'): Port => ({
  id: uuidv4(),
  name,
  type,
  connectorType: type,
})

export const extractId = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  const raw = String(value).trim()
  if (!raw) return ''
  // Rentman sometimes returns relative URLs like "/projectequipment/1234" or "1234".
  const match = raw.match(/(\d+)(?:\/?$)/)
  return match ? match[1] : raw
}

export const mapEquipment = (
  equipment: unknown[],
  foldersById: Record<string, string>,
  equipmentNamesById: Record<string, string>,
  masterMetaById: Record<string, { physical: boolean }> = {},
): RentmanEquipment[] => {
  // Defensiv erfasste Roh-Flags pro Zeile (Art-Bestimmung in der 2. Phase).
  const flagsByRow = new Map<string, { physical: boolean; comment: boolean }>()
  // First pass: build all rows.
  const rows = equipment.map((item) => {
    const record = item as Record<string, unknown>
    const rowId = extractId(record.id ?? record._id) || uuidv4()
    const equipmentId = extractId(record.equipment) || rowId
    flagsByRow.set(rowId, {
      physical: isRentmanPhysicalFlag(record) || !!masterMetaById[equipmentId]?.physical,
      comment: isRentmanCommentRow(record),
    })
    const folderKey = String(
      record.equipmentfolder ??
        record.folder ??
        record.category ??
        record.equipment_folder ??
        '',
    )
    const category = folderKey ? foldersById[folderKey] ?? folderKey : 'Uncategorized'
    const directName = String(record.name ?? record.displayname ?? '').trim()
    const parentRaw =
      record.parent ??
      record.parent_id ??
      record.parentId ??
      record.in_combination ??
      record.combination ??
      null
    const parentId = extractId(parentRaw)
    const hasParent = parentId !== '' && parentId !== rowId
    const qtyRaw = Number(record.quantity ?? record.qty ?? 1)
    const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.round(qtyRaw) : 1

    // v7.9.70 / #167 — Engineering-Daten ableiten. Rentman API hat
    // historisch verschiedene Feldnamen für dieselbe Semantik gehabt;
    // wir akzeptieren die gängigen Aliasse damit verschiedene API-
    // Versionen funktionieren.
    const powerWatts = pickNumber(record, ['power_consumption', 'power', 'wattage', 'watt'])
    const weightKg = pickNumber(record, ['weight', 'weight_kg'])
    // Rentman nennt die Geräte-Tiefe meist "length" oder "depth" (mm).
    const depthMm = pickNumber(record, ['depth', 'length', 'depth_mm', 'length_mm'])
    // #420 — Mietpreis pro Tag. Rentman's Equipment-Endpoint nutzt
    // historisch unterschiedliche Feldnamen (price = rental rate,
    // rentprice = legacy alias, price_per_day in neueren Schemas).
    const rentPricePerDay = pickNumber(record, [
      'price',
      'rentprice',
      'rental_price',
      'price_per_day',
      'daily_price',
      'rentprice_per_day',
    ])
    const currencyRaw =
      record.currency ?? record.pricecurrency ?? record.price_currency ?? record.currency_code
    const rentCurrency =
      typeof currencyRaw === 'string' && currencyRaw.trim() ? currencyRaw.trim() : undefined

    return {
      id: rowId,
      equipmentId,
      name: directName || equipmentNamesById[equipmentId] || 'Unnamed equipment',
      category,
      checked: false,
      qty,
      isSetChild: hasParent,
      parentId: hasParent ? parentId : null,
      kind: 'device',
      powerWatts,
      weightKg,
      depthMm,
      rentPricePerDay,
      rentCurrency,
      raw: record,
    } satisfies RentmanEquipment
  })

  // Second pass: dangling parentIds bereinigen + Art (kind) bestimmen.
  const knownIds = new Set(rows.map((r) => r.id))
  // Eltern = Zeilen, die von ≥1 anderen Zeile als parent referenziert werden
  // → das sind die Kombinationen (physisch oder virtuell).
  const parentIds = new Set(
    rows.map((r) => r.parentId).filter((p): p is string => !!p && knownIds.has(p)),
  )
  return rows.map((r) => {
    const base =
      r.parentId && !knownIds.has(r.parentId)
        ? { ...r, parentId: null, isSetChild: false }
        : r
    const flags = flagsByRow.get(r.id) ?? { physical: false, comment: false }
    const isCombination = parentIds.has(r.id)
    const kind: RentmanKind = flags.comment
      ? 'comment'
      : isCombination
        ? flags.physical
          ? 'physical'
          : 'virtual'
        : 'device'
    const contentsCount = isCombination
      ? rows.filter((x) => x.parentId === r.id).length
      : undefined
    return { ...base, kind, contentsCount }
  })
}

/**
 * Best-effort detection of a cable bucket (`{ type, length }`) from a Rentman
 * equipment item. Returns `null` for items that don't look like cables so they
 * can be ignored when building the cable-plan summary.
 *
 * The heuristic is intentionally conservative: we only consider items whose
 * folder/category contains "kabel" or "cable", parse the length out of the
 * name (e.g. "BNC HD-SDI 5m"), and map common connector keywords to one of
 * the supported `CableType` values. Unknown connector keywords fall back to
 * `'Custom'` so the user can still adjust them in the cable-plan UI.
 */

export const LENGTH_REGEX = /(\d+(?:[.,]\d+)?)\s*m\b/i

export const detectCableType = (name: string): CableType => {
  const n = name.toLowerCase()
  if (/\bschuko\b/.test(n)) return 'Schuko 230V'
  if (/\bpower\s*con\b|\btrue ?1\b/.test(n)) return 'PowerCON'
  if (/\biec\b|\bc13\b|\bc14\b|\bc19\b|\bkaltgeräte?\b/.test(n)) return 'IEC 230V'
  if (/\beurostecker\b|\bc7\b/.test(n)) return 'C7 Eurostecker'
  if (/\bsfp\+|\b10g\b/.test(n)) return 'SFP+'
  if (/\bsfp\b/.test(n)) return 'SFP'
  if (/\bfiber|\blwl|\blc[-\s]|\bsc[-\s]/.test(n)) return 'Fiber'
  if (/\brj ?45|\bcat ?5|\bcat ?6|\bcat ?7|\bethernet|\bethercon\b/.test(n))
    return 'Ethernet/RJ45'
  if (/\bhdmi\b/.test(n)) return 'HDMI'
  if (/\bxlr\b/.test(n)) return 'XLR'
  if (/\bbnc\b|\bsdi\b/.test(n)) return 'BNC'
  return 'Custom'
}

export interface DetectedCableRow {
  rowId: string
  /** Underlying Rentman master-equipment id (for the cable-export mapping). */
  rentmanEquipmentId: string
  type: CableType
  length: number
  qty: number
  name: string
  category: string
}

export const isCableCategory = (category: string): boolean =>
  /(kabel|cable)/i.test(category)

/**
 * #499 — Normalisiert einen Kategorie-Namen für den Fuzzy-Vergleich:
 * lowercase, Diakritika weg, alles Nicht-Alphanumerische raus. So matchen
 * "Kabel & Adapter" ↔ "kabel-adapter" und "Audio/DI" ↔ "Audio DI".
 */
export const normalizeCat = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')

/** #499 — Tokens (≥3 Zeichen) eines Kategorie-Namens für den Wort-Vergleich. */
export const catTokens = (s: string): string[] =>
  s
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/)
    .map((w) => w.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length >= 3)

/**
 * #499 — Automatische Kategorie-Erkennung: bildet eine Rentman-Quell-
 * Kategorie auf eine vorhandene lokale Kategorie ab. In Stufen, von streng
 * nach locker:
 *   1. exakte (normalisierte) Übereinstimmung
 *   2. beidseitiger Teilstring-Treffer ("Kabel HDMI" → "Kabel")
 *   3. gemeinsames Wort ≥4 Zeichen ("Wireless Mics" → "Funk/Wireless")
 * Liefert '' wenn nichts passt. */
export const autoDetectCategory = (source: string, options: string[]): string => {
  const ns = normalizeCat(source)
  if (!ns) return ''
  for (const opt of options) {
    if (normalizeCat(opt) === ns) return opt
  }
  for (const opt of options) {
    const no = normalizeCat(opt)
    if (no.length >= 3 && (no.includes(ns) || ns.includes(no))) return opt
  }
  // Stufe 3 — gemeinsames signifikantes Wort. Bestes (längstes) gemeinsames
  // Token gewinnt, damit aussagekräftige Treffer Vorrang haben.
  const srcTokens = new Set(catTokens(source))
  let best = ''
  let bestScore = 0
  for (const opt of options) {
    let score = 0
    for (const tok of catTokens(opt)) {
      if (tok.length >= 4 && srcTokens.has(tok) && tok.length > score) score = tok.length
    }
    if (score > bestScore) {
      bestScore = score
      best = opt
    }
  }
  return best
}

/** #499 — Gelernte Quell→Ziel-Kategorie-Map aus localStorage laden. */
export const loadRentmanCatMap = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.rentmanCategoryMap)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as Record<string, string>
  } catch {
    /* ignore corrupt cache */
  }
  return {}
}

/** #499 — Gelernte Quell→Ziel-Kategorie-Map nach localStorage schreiben. */
export const saveRentmanCatMap = (map: Record<string, string>): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.rentmanCategoryMap, JSON.stringify(map))
  } catch {
    /* quota / private mode — Persistenz ist best-effort */
  }
}

export const detectCableRows = (items: RentmanEquipment[]): DetectedCableRow[] => {
  const rows: DetectedCableRow[] = []
  for (const item of items) {
    if (!isCableCategory(item.category) && !/(kabel|cable)/i.test(item.name)) continue
    const match = LENGTH_REGEX.exec(item.name)
    if (!match) continue
    const length = Number(match[1].replace(',', '.'))
    if (!Number.isFinite(length) || length <= 0) continue
    rows.push({
      rowId: item.id,
      rentmanEquipmentId: item.equipmentId,
      type: detectCableType(item.name),
      length,
      qty: item.qty,
      name: item.name,
      category: item.category,
    })
  }
  return rows
}
