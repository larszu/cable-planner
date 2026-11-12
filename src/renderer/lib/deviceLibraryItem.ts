// ───────────────────────────────────────────────────────────────────────────
// Eine Vorlage dieser App als Eintrag fuer die Geraetebibliothek.
//
// Eine Stelle fuer Einreichen-Dialog, automatisches Hochladen und die
// Veroeffentlichung des eingebauten Katalogs (`scripts/library-publish.mjs`):
// drei Wege, die sonst jeder fuer sich entschieden, welche Felder rausgehen.
//
// Nur Typ-Importe und Importe mit `.ts`-Endung: das Skript laedt die Datei
// direkt in Node (Typen werden dort gestrichen, Endungen nicht ergaenzt).
// ───────────────────────────────────────────────────────────────────────────
import type { ProposalCore, UploadItem } from './deviceLibraryClient.ts'
import type { EquipmentTemplate } from '../types/equipment.ts'
import { herstellerAusName } from './herstellerAusName.ts'

/**
 * Felder, die Sache DIESER Installation sind. Der Server streift private
 * Felder ebenfalls ab; hier gehen sie gar nicht erst raus — und sie zaehlen
 * nicht als Aenderung: wer eine Vorlage als Favorit markiert, hat am Geraet
 * nichts geaendert.
 */
export const LOKALE_FELDER = ['rentmanSource', 'rentmanProjectName', 'favorite', 'hidden', 'libraryRef'] as const

export type Namen = { manufacturer: string; model: string }

// Typen nach av-device-library `src/shared/specs.ts`. Hier und nicht in
// `deviceLibraryClient.ts`: der Client ist in allen Plannern identisch und
// wird in der Quelle geaendert, nicht in einer Kopie. Der Server nimmt die
// Felder im Kern an (`deviceDataSchema`).
export interface Geraeteschnittstelle {
  kind: 'lens-mount' | 'head-base' | 'camera-plate' | 'rod' | 'filter-thread'
  standard: string
  role: 'provides' | 'requires'
}
export type Geraeteeigenschaften =
  | { kind: 'lens'; focalMinMm?: number; focalMaxMm?: number }
  | { kind: 'tripod'; heightMinM?: number; heightMaxM?: number; payloadMaxKg?: number }
export type Fachdaten = { specs?: Geraeteeigenschaften; interfaces?: Geraeteschnittstelle[] }

export function facetAus(template: EquipmentTemplate): Record<string, unknown> {
  const facet: Record<string, unknown> = { ...template }
  for (const k of LOKALE_FELDER) delete facet[k]
  return facet
}

/** `sourceUrl` ist der Datenblattlink der Vorlage. */
export function coreAus(template: EquipmentTemplate, namen: Namen): ProposalCore & Fachdaten {
  return {
    manufacturer: namen.manufacturer.trim(),
    model: namen.model.trim(),
    category: template.category.trim(),
    sourceUrl: (template.manufacturerUrl ?? '').trim(),
    ...(template.powerWatts != null ? { powerWatts: template.powerWatts } : {}),
    ...(template.rackUnits != null ? { rackUnits: template.rackUnits } : {}),
    ...(template.weightKg != null ? { weightKg: template.weightKg } : {}),
    ...specsAus(template),
  }
}

// ── Eigenschaften und Schnittstellen ────────────────────────────────────────
//
// Nur, was die Vorlage BELEGT: die Felder aus `categoryProps` (Formular) und
// die von `katalog:uebernahme` erzeugten Kurzangaben — Objektiv-Untertitel
// „9-720 mm · B4", Kamera-Notiz „… · B4 mount · …". Was nicht dasteht, bleibt
// leer; eine fehlende Brennweite ist keine Brennweite von 0. `estimated`
// bleibt deshalb leer: hier wird nichts geschaetzt.
//
// WARUM BIETET/BRAUCHT (av-device-library `specs.ts`): die Kamera bietet
// ihren Mount, das Objektiv braucht ihn — so passt eins aufs andere wie
// Stecker und Buchse. Ein Stativ bietet seinen Kopfsockel.
//
// NICHT ABGELEITET: die Hoehen der erzeugten Rigs (`rigCatalog.ts`) sind
// OBJEKTIVhoehen des Multicam-Plans, keine Arbeitshoehe des Stativs; und
// Stativkoepfe hat diese App keine eigene Kategorie, an der man sie erkennt.

const KATEGORIE: Record<string, 'lens' | 'camera' | 'tripod'> = {
  lenses: 'lens', objektive: 'lens',
  cameras: 'camera', kameras: 'camera',
  tripods: 'tripod', stative: 'tripod',
}

/** Mount wie im Katalog („B4", „EF-M") als Normbezeichnung („b4", „ef-m").
 *  `integrated` ist kein Anschluss: das Objektiv ist fest verbaut. */
function mountNorm(roh: unknown): string | undefined {
  if (typeof roh !== 'string') return undefined
  const m = roh.trim().toLowerCase().replace(/\s+/g, '-')
  return m && m !== 'integrated' && /^[a-z0-9-]{1,40}$/.test(m) ? m : undefined
}

const ZAHL = '(\\d+(?:[.,]\\d+)?)'
const zahl = (s: string) => Number(s.replace(',', '.'))

/** „17-120" bzw. „40" → [min, max]; alles andere → undefined. */
function bereich(roh: unknown): [number, number] | undefined {
  if (typeof roh === 'number' && Number.isFinite(roh) && roh >= 0) return [roh, roh]
  if (typeof roh !== 'string') return undefined
  const m = new RegExp(`^\\s*${ZAHL}\\s*(?:[-–]\\s*${ZAHL})?\\s*$`).exec(roh)
  if (!m) return undefined
  const a = zahl(m[1])
  const b = m[2] != null ? zahl(m[2]) : a
  return a <= b ? [a, b] : undefined
}

/** Kopfsockel aus dem Formularfeld `headType`. „fluid" sagt nichts ueber den
 *  Sockel, „flat" nicht, WELCHER Flachsockel — beide bleiben leer. Belegte
 *  Normbezeichnungen (`mitchell`, `flat-4-bolt`, `bowl-150` …) gehen durch. */
function kopfsockel(roh: unknown): string | undefined {
  if (typeof roh !== 'string') return undefined
  const v = roh.trim().toLowerCase()
  const schale = /^bowl-?(60|75|100|150|175)$/.exec(v)
  if (schale) return `bowl-${schale[1]}`
  if (v === 'mitchell' || v === 'flat-4-bolt' || v === 'screw-3/8') return v
  return undefined
}

export function specsAus(template: EquipmentTemplate): Fachdaten {
  const art = KATEGORIE[template.category.trim().toLowerCase()]
  const props = template.categoryProps ?? {}
  const interfaces: Geraeteschnittstelle[] = []
  let specs: Geraeteeigenschaften | undefined

  if (art === 'lens') {
    // Untertitel aus der Uebernahme: „9-720 mm · B4" / „40 mm · PL".
    const u = new RegExp(`^${ZAHL}(?:-${ZAHL})? mm · (\\S+)$`).exec((template.subtitle ?? '').trim())
    const brennweite = bereich(props.focalLength) ?? (u ? bereich(u[2] ? `${u[1]}-${u[2]}` : u[1]) : undefined)
    const mount = mountNorm(props.mount) ?? mountNorm(u?.[3])
    if (mount) interfaces.push({ kind: 'lens-mount', standard: mount, role: 'requires' })
    if (brennweite) specs = { kind: 'lens', focalMinMm: brennweite[0], focalMaxMm: brennweite[1] }
  } else if (art === 'camera') {
    const ausNotiz = /(?:^|·)\s*(\S+) mount\b/.exec(template.notes ?? '')?.[1]
    const mount = mountNorm(props.mount) ?? mountNorm(ausNotiz)
    if (mount) interfaces.push({ kind: 'lens-mount', standard: mount, role: 'provides' })
  } else if (art === 'tripod') {
    const sockel = kopfsockel(props.headType)
    if (sockel) interfaces.push({ kind: 'head-base', standard: sockel, role: 'provides' })
    const hoehe = bereich(props.heightRange)
    const last = typeof props.payloadKg === 'number' && props.payloadKg >= 0 ? props.payloadKg : undefined
    if (hoehe || last != null) {
      specs = {
        kind: 'tripod',
        ...(hoehe ? { heightMinM: hoehe[0], heightMaxM: hoehe[1] } : {}),
        ...(last != null ? { payloadMaxKg: last } : {}),
      }
    }
  }
  return { ...(specs ? { specs } : {}), ...(interfaces.length ? { interfaces } : {}) }
}

/** Die Vorlage als Upload-Eintrag. `localId` ist der Name — er ist in der
 *  Bibliothek dieser App eindeutig (geloescht und umbenannt wird ueber ihn). */
export function uploadItemAus(template: EquipmentTemplate, namen: Namen = herstellerAusName(template.name)): UploadItem {
  return { localId: template.name, core: coreAus(template, namen), facet: facetAus(template) }
}

/** JSON mit sortierten Schluesseln: zwei gleiche Vorlagen ergeben dieselbe Zeichenkette. */
export function stabilesJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stabilesJson).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as Record<string, unknown>)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stabilesJson((v as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v) ?? 'null'
}

/** FNV-1a, 32 Bit, hex. Kein Schutz, nur „hat sich etwas geaendert". */
export function fingerabdruck(v: unknown): string {
  const s = stabilesJson(v)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
