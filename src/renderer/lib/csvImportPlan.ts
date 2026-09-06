// ───────────────────────────────────────────────────────────────────────────
// Der CSV-Import als PLAN, bevor er passiert (Bedarf 29, P1).
//
// WAS DER BEDARF SAGT:
//
//   > Silent data loss on import/export must be impossible — the columns the
//   > production office added are the ones that vanish. […] The lost columns
//   > are the production-office ones: notes, responsible person,
//   > client-facing description. Loss is discovered by whoever needed the
//   > column, when they needed it.
//
// Und der Weg, den er vorgibt: „Any import/export the suite ships needs a
// preview that names exactly what will be dropped, and a sync that refuses to
// overwrite non-empty values with empty ones."
//
// WAS VORHER PASSIERTE — drei stille Verluste in einem einzigen Dialog:
//
//   1. Der Kopfzeilen-Abgleich traf acht bekannte Felder. Jede andere Spalte
//      fiel weg, und die Vorschau nannte nur die ZUGEORDNETEN Spalten. Wer
//      „Verantwortlich" und „Kundennotiz" mitgeschickt hatte, sah eine
//      Erfolgsmeldung und merkte den Verlust, wenn er die Spalte brauchte.
//   2. Zeilen ohne Namen wurden uebersprungen (`if (!name) continue`) und
//      nirgends gezaehlt.
//   3. `addCustomTemplates` ueberschreibt bestehende Namen nicht — richtig so,
//      das ist die zweite Regel des Bedarfs. Die Erfolgsmeldung zaehlte aber
//      ALLE gebauten Vorlagen als „hinzugefuegt". Wer vierzig Zeilen einlas,
//      von denen zwoelf schon in der Library standen, las „40 hinzugefuegt".
//
// WAS JETZT GILT. Diese Datei rechnet den Import DURCH, bevor er ausgefuehrt
// wird, und beantwortet dabei jede der drei Fragen mit einer Zahl und einer
// Liste. Der Dialog zeigt sie; der Knopf traegt die richtige Zahl.
//
// UND: die unbekannten Spalten fallen nicht mehr weg, sie wandern nach
// `notes`, mit ihrer Ueberschrift davor. Das ist mehr, als der Bedarf
// verlangt — er will nur, dass der Verlust GENANNT wird. Der Grund fuer das
// Mehr: eine genannte Spalte ist immer noch eine verlorene, und `notes` ist
// Freitext, den jeder loeschen kann. Umgekehrt geht es nicht.
//
// REIN: keine Uhr, kein Store, kein IO, keine Uebersetzung.
// ───────────────────────────────────────────────────────────────────────────

import type { EquipmentTemplate } from '../types/equipment'

export type FieldKey =
  | 'name'
  | 'category'
  | 'watts'
  | 'weight'
  | 'serial'
  | 'ip'
  | 'rackUnits'
  | 'subtitle'

/**
 * Ueberschriften, die auf ein Feld zeigen. Exakter Vergleich in Kleinschrift —
 * ein Teilstring-Vergleich haette „Name des Kunden" auf `name` gezogen.
 */
export const ALIASES: Record<FieldKey, string[]> = {
  name: ['name', 'gerät', 'geraet', 'device', 'bezeichnung', 'artikel'],
  category: ['kategorie', 'category', 'typ', 'type', 'gruppe'],
  watts: ['watt', 'watts', 'leistung', 'power', 'w'],
  weight: ['gewicht', 'weight', 'kg'],
  serial: ['seriennummer', 'serial', 's/n', 'sn'],
  ip: ['ip', 'ip-adresse', 'ipaddress', 'ip address', 'ip adresse'],
  rackUnits: ['he', 'rackunits', 'ru', 'höheneinheiten', 'hoeheneinheiten'],
  subtitle: ['untertitel', 'subtitle', 'hersteller', 'manufacturer', 'marke', 'brand'],
}

export interface ColumnRef {
  /** Spaltenindex in der Datei, 0-basiert. */
  index: number
  /** Die Ueberschrift, wie sie in der Datei steht. Leer, wenn die Spalte keine hat. */
  header: string
}

export interface DuplicateColumn extends ColumnRef {
  /** Das Feld, das schon von einer frueheren Spalte belegt war. */
  field: FieldKey
}

export interface CsvImportPlan {
  /** Feld → Spaltenindex. */
  mapping: Partial<Record<FieldKey, number>>
  /** Spalten, die auf kein Feld zeigen. */
  unmapped: ColumnRef[]
  /** Zweite Spalte auf ein schon belegtes Feld. Die erste gewinnt — hier steht,
   *  welche dabei nicht gewonnen hat. */
  duplicates: DuplicateColumn[]
  /**
   * Die Spalten, deren Inhalt nach `notes` wandert: `unmapped` UND
   * `duplicates`, in Dateireihenfolge.
   *
   * Die zweite Haelfte ist der Punkt. Eine zweite „Name"-Spalte verliert die
   * Zuordnung, aber ihr INHALT ist trotzdem etwas, das jemand mitgeschickt
   * hat — sie wegzuwerfen waere derselbe stille Verlust, nur mit einem
   * Hinweis daneben. Und die Oberflaeche sagt genau das; sie darf es nur
   * sagen, weil es hier auch passiert.
   */
  carried: ColumnRef[]
  /** Zeilennummern (1-basiert, wie in der Tabelle) ohne Namen. */
  rowsWithoutName: number[]
  /** Vorlagen, die neu angelegt werden. */
  fresh: EquipmentTemplate[]
  /** Namen, die es schon gibt: sie werden NICHT ueberschrieben. */
  existing: string[]
}

/**
 * Kopfzeile → Feldzuordnung, plus alles, was dabei liegen bleibt.
 *
 * Die zweite Haelfte des Rueckgabewerts ist der eigentliche Punkt: bis hierher
 * gab es nur `mapping`, und was NICHT darin stand, war unsichtbar.
 */
export const mapHeader = (
  header: string[],
): {
  mapping: Partial<Record<FieldKey, number>>
  unmapped: ColumnRef[]
  duplicates: DuplicateColumn[]
} => {
  const mapping: Partial<Record<FieldKey, number>> = {}
  const unmapped: ColumnRef[] = []
  const duplicates: DuplicateColumn[] = []
  header.forEach((h, i) => {
    const key = h.trim().toLowerCase()
    let hit: FieldKey | null = null
    for (const [field, aliases] of Object.entries(ALIASES) as [FieldKey, string[]][]) {
      if (!aliases.includes(key)) continue
      hit = field
      if (mapping[field] == null) mapping[field] = i
      else duplicates.push({ index: i, header: h.trim(), field })
      break
    }
    if (!hit) unmapped.push({ index: i, header: h.trim() })
  })
  return { mapping, unmapped, duplicates }
}

const toNum = (s?: string): number | undefined => {
  const n = parseFloat((s ?? '').replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : undefined
}

/**
 * Die unbekannten Spalten einer Zeile als Notiz-Text.
 *
 * Form: `Ueberschrift: Wert`, eine je Zeile. Leere Zellen fallen weg — eine
 * Notiz „Verantwortlich:" ohne Wert ist kein bewahrter Inhalt, sondern
 * Rauschen. Eine Spalte ohne Ueberschrift bekommt ihre Nummer, damit sie
 * ueberhaupt wiederfindbar bleibt.
 */
export const carriedNotes = (row: string[], carried: ColumnRef[]): string => {
  const teile: string[] = []
  for (const c of carried) {
    const wert = (row[c.index] ?? '').trim()
    if (!wert) continue
    teile.push(`${c.header || `Spalte ${c.index + 1}`}: ${wert}`)
  }
  return teile.join('\n')
}

/**
 * Den ganzen Import durchrechnen, ohne ihn auszufuehren.
 *
 * `existingNames` kommt von aussen (die Library lebt im Store, diese Datei
 * kennt keinen Store). Ohne sie liesse sich die dritte Frage nicht
 * beantworten — und genau die stand vorher falsch in der Erfolgsmeldung.
 */
export function planCsvImport(
  rows: string[][],
  existingNames: Iterable<string>,
  fallbackCategory: string,
): CsvImportPlan {
  const [header = [], ...body] = rows
  const { mapping, unmapped, duplicates } = mapHeader(header)
  const carried: ColumnRef[] = [...unmapped, ...duplicates].sort((a, b) => a.index - b.index)
  const vorhanden = new Set(existingNames)

  const at = (r: string[], key: FieldKey): string | undefined =>
    mapping[key] != null ? r[mapping[key] as number]?.trim() : undefined

  const rowsWithoutName: number[] = []
  const fresh: EquipmentTemplate[] = []
  const existing: string[] = []
  // Namen, die INNERHALB der Datei doppelt vorkommen, duerfen nicht zweimal
  // als „neu" gezaehlt werden: `addCustomTemplates` legt sie einmal an.
  const schonGeplant = new Set<string>()

  body.forEach((r, i) => {
    const name = (mapping.name != null ? r[mapping.name] : r[0])?.trim()
    if (!name) {
      // +2: eins fuer die Kopfzeile, eins fuer die 1-basierte Zaehlung.
      rowsWithoutName.push(i + 2)
      return
    }
    if (vorhanden.has(name) || schonGeplant.has(name)) {
      if (!existing.includes(name)) existing.push(name)
      return
    }
    schonGeplant.add(name)

    const tpl: EquipmentTemplate = {
      name,
      category: at(r, 'category') || fallbackCategory,
      inputs: [],
      outputs: [],
      width: 220,
      height: 60,
    }
    const w = toNum(at(r, 'watts'))
    if (w != null) tpl.powerConsumptionWatts = w
    const kg = toNum(at(r, 'weight'))
    if (kg != null) tpl.weightKg = kg
    const sn = at(r, 'serial')
    if (sn) tpl.serialNumber = sn
    const ip = at(r, 'ip')
    if (ip) tpl.ipAddress = ip
    const ru = toNum(at(r, 'rackUnits'))
    if (ru != null) {
      tpl.rackUnits = Math.max(1, Math.round(ru))
      tpl.isRackDevice = true
    }
    const sub = at(r, 'subtitle')
    if (sub) tpl.subtitle = sub
    // Leere Zellen setzen NICHTS — das ist die zweite Regel des Bedarfs
    // („refuses to overwrite non-empty values with empty ones"), hier in ihrer
    // milderen Form: ein leeres Feld gar nicht erst anzulegen.
    const notiz = carriedNotes(r, carried)
    if (notiz) tpl.notes = notiz
    fresh.push(tpl)
  })

  return { mapping, unmapped, duplicates, carried, rowsWithoutName, fresh, existing }
}
