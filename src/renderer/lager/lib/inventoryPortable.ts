// ───────────────────────────────────────────────────────────────────────────
// Portables Lager-Format — App-übergreifender Austausch (cable/light/multicam).
//
// Ein Lager, das in einem Planer angelegt wurde, soll in den anderen
// importierbar sein. Das Format ist bewusst schlank + versioniert und enthält
// nur die reinen Daten (items/nodes/sets/units) — keine App-Interna. Artikel
// werden per Freitext (manufacturer/model) + Label-`code` identifiziert; ein
// Katalog-GUID-Bezug ist bewusst nicht Teil des Formats.
// ───────────────────────────────────────────────────────────────────────────
import type { InventoryItem, StorageNode, InventorySet, InventoryUnit, FristArtDef } from '../types/inventory'

export const INVENTORY_FORMAT = 'avplan-inventory'
// Version 2 (ADR-002): `InventoryItem.deviceTypeId`. Die Erhoehung ist kein
// Formalismus — `inventoryStore.healItem` baut jeden Artikel Feld fuer Feld
// neu auf, ein Stand ohne dieses Feld wuerde es beim Re-Export also STILL
// verlieren. Mit der Version weigert er sich stattdessen (siehe unten:
// `f.version > INVENTORY_FORMAT_VERSION`). Aeltere Dateien lesen wir weiter.
//
// ADR-005, Inkrement 4 — der Satz oben deckt nur EINE Richtung ab: eine zu
// NEUE Datei, die dieser Stand nicht vollstaendig versteht. Die andere fehlte:
// eine zu ALTE Datei, die beim Zusammenfuehren etwas WEGNIMMT. Genau das tat
// der Import — er ersetzte den lokalen Artikel als Ganzes, eine v1-Datei
// loeschte also die bestaetigte deviceTypeId. Dafuer ist jetzt
// `lib/inventoryMerge.ts` da; die Version kann das nicht leisten, weil eine
// alte Datei zu lesen ausdruecklich erlaubt bleibt.
//
// Version 3 (Bedarf 107): `InventoryUnit.houseRef` — die haus-eigene Referenz
// neben der Hersteller-Seriennummer. Dieselbe Begruendung wie bei Version 2,
// eine Ebene tiefer: `inventoryStore.healUnit` baut jede Einheit Feld fuer
// Feld neu auf. Ein Planer, der `houseRef` nicht kennt, wuerde eine Datei mit
// Hausreferenzen still ohne sie zurueckschreiben — und die Nummer, die auf dem
// Case klebt, waere weg. Mit der erhoehten Version weigert er sich stattdessen
// zu lesen, und das ist die ehrlichere Antwort. Aeltere Dateien (v1/v2) lesen
// wir unveraendert weiter; ihre Einheiten haben schlicht keine Hausreferenz.
//
// Version 4 (Bedarf 118): `InventoryUnit.anschaffung`,
// `InventoryUnit.versicherungswert` und `InventoryItem.ursprungsland` — die
// Angaben, aus denen Versicherungsliste und Carnet-Datenblatt entstehen.
// Dieselbe Begruendung wie bei 2 und 3, und hier die teuerste: `healUnit` baut
// jede Einheit Feld fuer Feld neu auf. Ein Planer, der die Werte nicht kennt,
// schriebe eine Datei mit Versicherungswerten still ohne sie zurueck — und der
// Freiberufler haette eine Versicherungsliste, die seinen halben Bestand nicht
// mehr kennt, ohne dass ihm jemand etwas gesagt haette. Mit der erhoehten
// Version weigert sich ein aelterer Stand stattdessen zu lesen. Aeltere
// Dateien (v1-v3) lesen wir unveraendert weiter; ihre Einheiten haben schlicht
// keine Werte.
// Version 5 (B-65): `InventoryItem.mindestmenge` -- ab wann das Haus
// nachbestellt oder sub-hired. Gepflegt wird sie im Lager-Werkzeug
// (`inventory-planner`); hier steht sie, damit der Planer sie nicht
// wegwirft. Dieselbe Begruendung wie bei 2, 3 und 4: `healItem` baut JEDEN
// Artikel Feld fuer Feld neu auf, ein Stand ohne dieses Feld laese eine
// Datei mit gepflegten Mindestmengen ein und schriebe sie still ohne sie
// zurueck. Die Kachel „Unter Ziel" im Lager stuende danach auf 0 und haette
// ueber nichts recht -- die teuerste Form des Verlusts: keine Fehlermeldung,
// sondern eine gruene Zahl.
//
// Mit der erhoehten Version weigert sich ein aelterer Stand stattdessen zu
// lesen. Aeltere Dateien (v1-v4) lesen wir unveraendert weiter; ihre Artikel
// haben schlicht keine Mindestmenge, und das ist nicht 0, sondern
// UNBEWERTET.
// Version 6 (B-65): `InventoryUnit.fristen` -- was an einer Einheit
// turnusmaessig faellig ist (DGUV-V3-Pruefung, Kalibrierung, Wartung,
// Akku). Gepflegt und ausgewertet wird das im Lager-Werkzeug; hier steht
// es, damit der Planer es nicht wegwirft. `healUnit` baut JEDE Einheit
// Feld fuer Feld neu auf.
//
// Das wiegt mehr als jedes Feld davor. Eine verlorene Mindestmenge kostet
// eine Nachbestellung; eine verlorene DGUV-V3-Frist stellt ein
// ungeprueftes Geraet auf eine Veranstaltung -- und die Ampel im Lager
// wuerde dabei nicht schweigen, sondern „nichts faellig" melden.
//
// Aeltere Dateien (v1-v5) lesen wir unveraendert weiter; ihre Einheiten
// haben schlicht keine Fristen, und das ist nicht „geprueft", sondern
// UNBEWERTET.
// Version 7 (Eigentuemer-Entscheidung 2026-09-10): `fristArten` -- die
// Fristarten, die das HAUS selbst angelegt hat, und die eingebaute Art
// `haltbarkeit` fuer Verbrauchsmaterial mit Ablaufdatum.
//
// Der Verlust, den diese Version verhindert, ist ein anderer als bei 3 bis 6.
// Dort ging ein FELD verloren; hier ginge die BEDEUTUNG verloren. `Frist.art`
// war eine feste Aufzaehlung, und jeder Leser zog eine unbekannte Art auf
// `sonstige` -- gut gemeint, damit ein Termin nicht verschwindet. Sobald ein
// Haus eigene Arten fuehrt (Anschlagmittel, Leiterpruefung, Feuerloescher,
// Nebelfluid-Charge), macht dieselbe Zeile aus jeder davon „Sonstige": der
// Termin steht noch auf der Liste, aber ohne den Grund, aus dem ihn jemand
// eingetragen hat. Wer die Liste abarbeitet, weiss nicht mehr, was zu tun ist.
//
// Deshalb zwei Dinge zusammen: die Liste reist mit, UND eine unbekannte Art
// bleibt stehen, wie sie ist. Die Anzeige sagt dann, dass sie die Art nicht
// kennt -- das ist eine Auskunft, „Sonstige" waere eine Behauptung.
//
// Aeltere Dateien (v1-v6) lesen wir unveraendert weiter; ihre Fristen tragen
// eingebaute Arten, und eine Liste eigener Arten haben sie schlicht nicht.
export const INVENTORY_FORMAT_VERSION = 7

export interface InventorySnapshot {
  items: InventoryItem[]
  nodes: StorageNode[]
  sets: InventorySet[]
  units: InventoryUnit[]
  /**
   * Die selbst angelegten Fristarten des Hauses (Version 7).
   *
   * Optional heisst: die Datei stammt aus einem Haus, das keine eigenen
   * fuehrt -- nicht, dass es keine gibt. Die eingebauten Arten stehen
   * hier NIE drin; sie kennt jede App.
   */
  fristArten?: FristArtDef[]
}

interface PortableFile extends InventorySnapshot {
  format: typeof INVENTORY_FORMAT
  version: number
  /** ISO-Zeitstempel (vom Aufrufer gesetzt — hier keine Uhr). */
  exportedAt?: string
  /** Ursprungs-App (cable/light/multicam), rein informativ. */
  app?: string
}

/** Serialisiert einen Snapshot als portables JSON. */
export const serializeInventory = (snap: InventorySnapshot, meta?: { exportedAt?: string; app?: string }): string => {
  const file: PortableFile = {
    format: INVENTORY_FORMAT,
    version: INVENTORY_FORMAT_VERSION,
    exportedAt: meta?.exportedAt,
    app: meta?.app,
    items: snap.items,
    nodes: snap.nodes,
    sets: snap.sets,
    units: snap.units,
    fristArten: snap.fristArten,
  }
  return JSON.stringify(file, null, 2)
}

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/**
 * Die eigenen Fristarten heilen.
 *
 * Eine Art ohne Id oder ohne Namen ist keine: unter ihr stuende in der Liste
 * nichts, und ein Termin, dessen Art nichts sagt, ist ein Termin ohne Grund.
 * Doppelte Ids fallen weg -- die erste gilt, wie ueberall in diesem Format.
 */
const heileFristArten = (raw: unknown): FristArtDef[] | undefined => {
  if (!Array.isArray(raw)) return undefined
  const gesehen = new Set<string>()
  const aus: FristArtDef[] = []
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue
    const d = e as Partial<FristArtDef>
    const id = typeof d.id === 'string' ? d.id.trim() : ''
    const name = typeof d.name === 'string' ? d.name.trim() : ''
    if (!id || !name || gesehen.has(id)) continue
    gesehen.add(id)
    aus.push({
      id,
      name,
      ...(typeof d.standardIntervallMonate === 'number' && d.standardIntervallMonate > 0
        ? { standardIntervallMonate: Math.round(d.standardIntervallMonate) }
        : {}),
      ...(typeof d.grundlage === 'string' && d.grundlage.trim() ? { grundlage: d.grundlage.trim() } : {}),
    })
  }
  return aus.length > 0 ? aus : undefined
}

/**
 * Parst portables JSON zu einem Snapshot. Tolerant gegenüber fehlenden
 * Teil-Arrays, aber strikt beim Format-Marker — fremde/kaputte Dateien → null.
 * Heilung/Validierung der Einzel-Felder übernimmt der Store beim Import
 * (dieselbe Logik wie beim Laden aus localStorage).
 */
export const parseInventory = (json: string): InventorySnapshot | null => {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const f = data as Partial<PortableFile>
  if (f.format !== INVENTORY_FORMAT) return null
  if (typeof f.version !== 'number' || f.version > INVENTORY_FORMAT_VERSION) return null
  return {
    items: arr<InventoryItem>(f.items),
    nodes: arr<StorageNode>(f.nodes),
    sets: arr<InventorySet>(f.sets),
    units: arr<InventoryUnit>(f.units),
    ...(heileFristArten(f.fristArten) ? { fristArten: heileFristArten(f.fristArten) } : {}),
  }
}
