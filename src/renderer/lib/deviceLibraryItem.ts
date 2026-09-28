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

export function facetAus(template: EquipmentTemplate): Record<string, unknown> {
  const facet: Record<string, unknown> = { ...template }
  for (const k of LOKALE_FELDER) delete facet[k]
  return facet
}

/** `sourceUrl` ist der Datenblattlink der Vorlage. */
export function coreAus(template: EquipmentTemplate, namen: Namen): ProposalCore {
  return {
    manufacturer: namen.manufacturer.trim(),
    model: namen.model.trim(),
    category: template.category.trim(),
    sourceUrl: (template.manufacturerUrl ?? '').trim(),
    ...(template.powerWatts != null ? { powerWatts: template.powerWatts } : {}),
    ...(template.rackUnits != null ? { rackUnits: template.rackUnits } : {}),
    ...(template.weightKg != null ? { weightKg: template.weightKg } : {}),
  }
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
