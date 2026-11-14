/**
 * #1188 — Geraetekennungen nach Gattung und Raum: „CAM 101", „MIX 201".
 *
 * Kuerzel der Gattung, Hunderterblock des Raums, laufende Nummer. Raum 1
 * vergibt 101, 102 …, Raum 2 201 …; ein Geraet ausserhalb jedes Raums
 * zaehlt ohne Block (CAM 1, CAM 2). Der Raum ist der Rahmen, in dem die
 * Mitte des Geraets liegt (`locationForEquipment`), seine Nummer die Stelle
 * in der Rahmenliste des Projekts; Steigschaechte zaehlen nicht als Raum.
 *
 * DIE KENNUNG IST DER KURZNAME (`shortName`). Er steht schon heute auf dem
 * Kabeletikett, an den Kabelenden und im Patchblatt — ein zweites Feld
 * daneben haette dieselbe Aufgabe und wuerde nie gleich gepflegt. Damit
 * eine von Hand gesetzte Kennung beim naechsten Durchlauf nicht ueberschrieben
 * wird, traegt eine vergebene Kennung `shortNameAuto: true`. Wer das Feld im
 * Inspector aendert, nimmt die Marke weg; ab dann gehoert die Kennung ihm.
 *
 * Vergeben wird nur auf Zuruf (Rechtsklick → „Kennungen neu vergeben"),
 * nie beim Anlegen: ohne Zuruf bleibt der Kurzname, was er war.
 */
import type { EquipmentItem } from '../types/equipment'
import type { LocationFrame } from '../types/location'
import { locationForEquipment } from './equipmentLocation'
import { LEGACY_CATEGORY_RENAMES } from './categoryTranslations'

/** Kuerzel je Gattung, Schluessel ist die kanonische (englische) Kategorie. */
const KUERZEL: Record<string, string> = {
  Cameras: 'CAM',
  Lenses: 'LNS',
  Tripods: 'TRI',
  Lighting: 'LX',
  Audio: 'AUD',
  Microphones: 'MIC',
  'Mixing console': 'MIX',
  Mixer: 'MIX',
  Video: 'VID',
  'Video Mixer': 'VMX',
  'Video Router': 'RTR',
  'Video Converter': 'CNV',
  Converter: 'CNV',
  Monitors: 'MON',
  PC: 'PC',
  'IT/Server': 'SRV',
  Networking: 'NET',
  'IP/NDI': 'NDI',
  'Patch panels': 'PP',
  'Patch panels (adapter)': 'PP',
  Projectors: 'PRJ',
  'Media Server': 'MS',
  Power: 'PWR',
  'Power distribution': 'PD',
  'Floor boxes': 'FB',
  Wireless: 'RF',
  'Sync/Reference': 'SYN',
  Rigging: 'RIG',
}

/** Kuerzel einer Kategorie. Unbekannte Kategorien: die ersten drei
 *  Buchstaben in Grossschrift, ohne Kategorie „DEV". */
export const kennungsKuerzel = (category: string | undefined): string => {
  const roh = (category ?? '').trim()
  const kanonisch = LEGACY_CATEGORY_RENAMES[roh] ?? roh
  const bekannt = KUERZEL[kanonisch]
  if (bekannt) return bekannt
  const buchstaben = kanonisch.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
  return buchstaben || 'DEV'
}

/** Ist die Kennung dieses Geraets von Hand gesetzt? Dann bleibt sie. */
export const kennungVonHand = (eq: Pick<EquipmentItem, 'shortName' | 'shortNameAuto'>): boolean =>
  !!eq.shortName?.trim() && !eq.shortNameAuto

const KENNUNG = /^([A-Z0-9]+) (\d+)$/

export interface KennungsVergabe {
  /** Neue Kennungen je Geraete-ID (nur die, die sich aendern). */
  aenderungen: { id: string; shortName: string }[]
  /** Geraete der Auswahl mit von Hand gesetzter Kennung — nicht angefasst. */
  vonHand: number
}

/**
 * Vergibt die Kennungen fuer `ziel` neu. Nummern, die ein anderes Geraet
 * (ausserhalb der Neuvergabe oder von Hand gesetzt) schon traegt, bleiben
 * belegt; die neu zu nummerierenden Geraete fuellen die Luecken von unten,
 * geordnet nach Raum und Lage im Plan (oben nach unten, links nach rechts).
 * Ein ganzer Raum wird so in einem Zug lueckenlos, ein einzelnes neues
 * Geraet bekommt die erste freie Nummer.
 */
export const vergibKennungen = (
  ziel: readonly EquipmentItem[],
  alle: readonly EquipmentItem[],
  locations: readonly LocationFrame[],
): KennungsVergabe => {
  const raeume = locations.filter((l) => !l.steigschacht)
  const block = (eq: EquipmentItem): number => {
    const raum = locationForEquipment(eq, raeume)
    return raum ? (raeume.indexOf(raum) + 1) * 100 : 0
  }
  const neu = ziel.filter((eq) => !kennungVonHand(eq))
  const neuIds = new Set(neu.map((eq) => eq.id))

  const belegt = new Map<string, Set<number>>()
  for (const eq of alle) {
    if (neuIds.has(eq.id)) continue
    const m = KENNUNG.exec(eq.shortName?.trim() ?? '')
    if (!m) continue
    const set = belegt.get(m[1]) ?? new Set<number>()
    set.add(Number(m[2]))
    belegt.set(m[1], set)
  }

  const geordnet = neu
    .map((eq) => ({ eq, block: block(eq) }))
    .sort((a, b) => a.block - b.block || a.eq.y - b.eq.y || a.eq.x - b.eq.x)

  const aenderungen: KennungsVergabe['aenderungen'] = []
  for (const { eq, block: b } of geordnet) {
    const kuerzel = kennungsKuerzel(eq.category)
    const set = belegt.get(kuerzel) ?? new Set<number>()
    belegt.set(kuerzel, set)
    let n = b + 1
    while (set.has(n)) n++
    set.add(n)
    const kennung = `${kuerzel} ${n}`
    if (eq.shortName !== kennung || !eq.shortNameAuto) aenderungen.push({ id: eq.id, shortName: kennung })
  }
  return { aenderungen, vonHand: ziel.length - neu.length }
}
