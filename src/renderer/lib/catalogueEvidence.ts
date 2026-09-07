// ───────────────────────────────────────────────────────────────────────────
// Welche Katalog-Zeile trägt ein Datenblatt — und welche nicht?
// (Initiative 11, Schritt 2/3)
//
// ─── WAS BEIM NACHMESSEN HERAUSKAM ─────────────────────────────────────────
//
// `INITIATIVE-11-SCOPING.md` nennt als nächsten Schritt: „Lift the 253
// existing `// Quelle:` comments into a field. Mechanical, reversible, loses
// nothing." Nachgemessen am 2026-09-07: **das ist bereits geschehen.** Alle
// 253 Kommentare stehen als `template.manufacturerUrl` im selben Eintrag —
// nachgeprüft URL für URL, keine einzige Abweichung —, das Feld wandert über
// `equipmentSlice` an das Gerät, die Eigenschaften-Leiste zeigt es mit
// genannter Herkunft an, und `exportDevicePdf` druckt es.
//
// Das Papier stimmte, als es geschrieben wurde („No `provenance`, `source`,
// or `verifiedAt` field exists"), und es stimmt bis heute — nur heißt das
// Feld eben `manufacturerUrl`, und danach hatte niemand gesucht.
//
// ─── WAS DAMIT WIRKLICH OFFEN IST ──────────────────────────────────────────
//
// Zwei Dinge, und beide sind hier gebaut:
//
//  1. DIE ABDECKUNG WIRD NICHT GERECHNET. 253 von 412 Einträgen tragen ein
//     Datenblatt; die übrigen 159 liegen in sechs Katalogen. Diese Zahlen
//     standen als Prosa im Backlog (B-11) und nirgends im Code. Wer morgen
//     dreißig Einträge ohne Beleg dazulegt, ändert die Zahl — und niemand
//     merkt es. Ein Beleg-Anspruch, den nichts nachrechnet, ist eine
//     Behauptung; genau die Sorte, gegen die dieses Repo sonst anschreibt.
//
//  2. „KEIN BELEG" IST UNSICHTBAR. Die Eigenschaften-Leiste zeigt den
//     geerbten Link, wenn es einen gibt — und sonst nichts. Ein ATEM (32
//     Einträge, kein einziger Beleg) sieht damit aus wie ein Gerät, bei dem
//     nur gerade niemand nachgesehen hat. Das ist derselbe Unterschied wie
//     zwischen einer leeren Zelle und einem Strich auf einem Blatt.
//
// REIN: keine Datei, kein Netz, keine Uhr.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentTemplate } from '../types/equipment'
import { AJA_CATALOG } from './ajaCatalog'
import { AUDIO_CATALOG } from './audioCatalog'
import { AVNETWORK_CATALOG } from './avNetworkCatalog'
import { BLACKMAGIC_CATALOG } from './blackmagicCatalog'
import { BROADCAST_TOOLS_CATALOG } from './broadcastToolsCatalog'
import { CAMERA_CATALOG } from './cameraCatalog'
import { GREENGO_CATALOG } from './greengoCatalog'
import { LYNX_CATALOG } from './lynxCatalog'
import { MIC_CATALOG } from './micCatalog'
import { MISC_CATALOG } from './miscCatalog'
import { MONITOR_CATALOG } from './monitorCatalog'
import { ROSS_CATALOG } from './rossCatalog'
import { SWITCHER_CATALOG } from './switcherCatalog'
import { UBIQUITI_CATALOG } from './ubiquitiCatalog'
import { WIRELESS_AUDIO_CATALOG } from './wirelessAudioCatalog'

/** Das Wenige, das diese Rechnung von einem Katalog-Eintrag braucht. */
interface EvidenceEntry {
  deviceTypeId: string
  template: Pick<EquipmentTemplate, 'name' | 'manufacturerUrl'>
}

/**
 * Die Kataloge, ueber die gerechnet wird.
 *
 * DIESELBEN, die `deviceTypeRegistry` aufloest — und `tests/catalogueEvidence
 * .test.ts` haelt das fest, indem es die Import-Zeilen beider Dateien
 * vergleicht. Ohne diese Pruefung waere ein sechzehnter Katalog im Register
 * eine Zeile, die hier fehlt: die Abdeckung saehe dann besser aus, als sie
 * ist, und zwar unbemerkt.
 *
 * `connectorCatalog` und `wirelessCatalog` stehen hier so wenig wie dort:
 * sie fuehren keine `EquipmentTemplate`s (Steckertypen bzw.
 * `WirelessDevice`), und das Feld sitzt am Template. Das ist keine Luecke,
 * sondern eine andere Datenklasse — B-11 haelt denselben Unterschied fest.
 */
export const CATALOGUES: ReadonlyArray<{ name: string; entries: readonly EvidenceEntry[] }> = [
  { name: 'aja', entries: AJA_CATALOG },
  { name: 'audio', entries: AUDIO_CATALOG },
  { name: 'avNetwork', entries: AVNETWORK_CATALOG },
  { name: 'blackmagic', entries: BLACKMAGIC_CATALOG },
  { name: 'broadcastTools', entries: BROADCAST_TOOLS_CATALOG },
  { name: 'camera', entries: CAMERA_CATALOG },
  { name: 'greengo', entries: GREENGO_CATALOG },
  { name: 'lynx', entries: LYNX_CATALOG },
  { name: 'mic', entries: MIC_CATALOG },
  { name: 'misc', entries: MISC_CATALOG },
  { name: 'monitor', entries: MONITOR_CATALOG },
  { name: 'ross', entries: ROSS_CATALOG },
  { name: 'switcher', entries: SWITCHER_CATALOG },
  { name: 'ubiquiti', entries: UBIQUITI_CATALOG },
  { name: 'wirelessAudio', entries: WIRELESS_AUDIO_CATALOG },
]

export interface CatalogueCoverage {
  name: string
  entries: number
  /** Eintraege mit Datenblatt-Link. */
  sourced: number
  /** Eintraege ohne — die Zahl, um die es geht. */
  unsourced: number
}

export interface EvidenceReport {
  perCatalogue: CatalogueCoverage[]
  entries: number
  sourced: number
  unsourced: number
}

const hatBeleg = (e: EvidenceEntry): boolean =>
  (e.template.manufacturerUrl ?? '').trim().length > 0

/**
 * Die Abdeckung, gerechnet.
 *
 * DIE ENGSTELLE. Anzeige, Pruefung und jede kuenftige Auswertung lesen DIESE
 * Zahlen; zwei Rechnungen ueber dieselben Kataloge koennten sich
 * unterscheiden, und dann stuende im Bericht etwas anderes als im Waechter.
 *
 * Feste Reihenfolge (nach Katalog-Name), damit derselbe Baum zweimal denselben
 * Bericht ergibt — dieselbe Regel wie bei den Blaettern (ADR-004).
 */
export function evidenceReport(
  catalogues: ReadonlyArray<{ name: string; entries: readonly EvidenceEntry[] }> = CATALOGUES,
): EvidenceReport {
  const perCatalogue = [...catalogues]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name, entries }) => {
      const sourced = entries.filter(hatBeleg).length
      return { name, entries: entries.length, sourced, unsourced: entries.length - sourced }
    })
  return {
    perCatalogue,
    entries: perCatalogue.reduce((s, c) => s + c.entries, 0),
    sourced: perCatalogue.reduce((s, c) => s + c.sourced, 0),
    unsourced: perCatalogue.reduce((s, c) => s + c.unsourced, 0),
  }
}

/** Was ueber den Beleg eines Katalog-Typs bekannt ist. */
export type TypeEvidence =
  /** Der Typ traegt ein Datenblatt. */
  | { kind: 'sourced'; url: string; catalogue: string }
  /** Den Typ gibt es, aber er traegt keines — eine AUSSAGE, kein Schweigen. */
  | { kind: 'unsourced'; catalogue: string }
  /** Die Kennung gehoert zu keinem Katalog-Typ (von Hand angelegt, Import). */
  | { kind: 'no-type' }

/**
 * Traegt DIESER Geraetetyp ein Datenblatt?
 *
 * Der Unterschied zwischen `unsourced` und `no-type` ist der ganze Punkt: das
 * eine heisst „dieser Katalog-Eintrag hat keinen Beleg", das andere „dieses
 * Geraet kommt aus keinem Katalog". Beides als leeres Feld anzuzeigen — so
 * war es bis hierher — macht aus zwei verschiedenen Auskuenften dieselbe
 * Nicht-Auskunft.
 */
export function evidenceForType(
  deviceTypeId: string | undefined,
  catalogues: ReadonlyArray<{ name: string; entries: readonly EvidenceEntry[] }> = CATALOGUES,
): TypeEvidence {
  if (!deviceTypeId) return { kind: 'no-type' }
  for (const { name, entries } of catalogues) {
    const treffer = entries.find((e) => e.deviceTypeId === deviceTypeId)
    if (!treffer) continue
    const url = (treffer.template.manufacturerUrl ?? '').trim()
    return url ? { kind: 'sourced', url, catalogue: name } : { kind: 'unsourced', catalogue: name }
  }
  return { kind: 'no-type' }
}
