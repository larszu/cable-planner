import type { EquipmentTemplate } from '../types/equipment'
import { STORAGE_KEYS } from '../lib/storageKeys'
import { syncDevicesToFolder } from '../lib/librarySync'
import { LEGACY_CATEGORY_RENAMES } from '../lib/categoryTranslations'
import { heileVorlagenName } from '../lib/templateRenames'
import { heileSteckertyp } from '../lib/connectorRenames'

/**
 * #308 — Persist-Helpers fuer Custom-Library + Known-Categories aus
 * projectStore.ts ausgelagert. Eigenes Modul damit Slices die
 * customLibrary mutieren (TemplateSlice, CategorySlice) sie nutzen
 * koennen ohne back-import auf projectStore.ts.
 *
 * persistCustomLibrary ruft syncDevicesToFolder mit auf — der
 * librarySync schreibt jeden Schreib-Vorgang in die Desktop-Library
 * (falls verbunden) und seedet beim Reload den Sync-Cache.
 */

const CUSTOM_LIB_KEY = STORAGE_KEYS.customLibrary
const KNOWN_CATEGORIES_KEY = STORAGE_KEYS.knownCategories

export const DEFAULT_CATEGORIES = [
  'Cameras',
  'Lenses',
  'Tripods',
  'Lighting',
  'Audio',
  'Microphones',
  'Mixing console',
  'Video',
  'Monitors',
  'PC',
  'Networking',
  'Cables',
  // ISSUE #664 — „Patchbays als Geraetekategorie erstellen". Die Kategorie ist
  // der zweite Weg, ein Geraet als Blende auszuweisen (der erste ist das Flag
  // `isPatchPanel`); `patchPanel.ts` fuehrt beide zu EINER Antwort zusammen.
  // Neu hinzugefuegte Vorgabe-Kategorien erreichen auch bestehende Nutzer:
  // `loadKnownCategories` vereinigt Vorgabe und Gespeichertes.
  'Patch panels',
  'Power',
  'Rigging',
  // ─── DIE UEBERNAHME AUS EasySchematic (2026-09-24) ───────────────────────
  //
  // 39 Bereiche, die es hier vorher nicht gab. Auf ausdrueckliche
  // Anweisung des Eigentuemers uebernommen, samt ihrer Namen.
  //
  // WARUM SIE IHRE NAMEN BEHALTEN. Sie in unsere sechzehn zu pressen haette
  // sie unsichtbar gemacht: „KVM / Extenders", „Expansion Cards" und
  // „Windowing Processors" haetten alle „Sonstiges" geheissen, und die
  // Bibliotheks-Seitenleiste haette einen Bereich mit tausend Eintraegen
  // gezeigt statt vierzig, in denen man etwas findet. Wo wir schon einen
  // Bereich fuehren, wird ABGEBILDET und nicht verdoppelt — die Tabelle steht
  // in `scripts/easyschematic-vokabular.mjs` (`Mixing Consoles` ->
  // `Mixing console`, `Displays` -> `Monitors`, `PTZ Camera` -> `Cameras`).
  //
  // Bestandsnutzer bekommen sie ueber `loadKnownCategories`, das Vorgabe und
  // Gespeichertes vereinigt.
  'Amplifiers',
  'Audio Expansion',
  'Audio I/O',
  'Cloud Services',
  'Codecs',
  'Control',
  'Controllers',
  'DMX Splitter',
  'Distribution',
  'Expansion Cards',
  'Firewalls',
  'Headphone Amplifier',
  'Infrastructure',
  'Intercom',
  'KVM / Extenders',
  'LED Video',
  'Management Platforms',
  'Media Players',
  'Media Servers',
  'Monitoring',
  'Network Switches',
  'Peripherals',
  'Power Amplifier',
  'Powered Mixers',
  'Processing',
  'Processors',
  'Projection',
  'Projector Lenses',
  'Projectors',
  'Recording',
  'Sources',
  'Speakers',
  'Storage',
  'Storage Media',
  'Switching',
  'User Interfaces',
  'Video Switchers',
  'Windowing Processors',
  'Wireless',
  'Other',
]

export const loadCustomLibrary = (): EquipmentTemplate[] => {
  try {
    const raw = localStorage.getItem(CUSTOM_LIB_KEY)
    const items = raw ? (JSON.parse(raw) as EquipmentTemplate[]) : []
    // #822 — dieselbe Umbenennung wie fuer `equipment.category` und
    // `knownCategories`. Ohne sie fuehrt die Bibliotheks-Seitenleiste die
    // Vorlagen mit altem deutschem Wert als EIGENE Gruppe, die dank
    // `categoryDisplay` denselben Namen traegt wie die neue: gemessen im
    // Aufnahme-Lauf standen `Patch panels` und `Power distribution` je
    // zweimal untereinander. Zwei Zeilen mit demselben Namen sind
    // schlimmer als eine falsche — man sucht den Unterschied.
    // #832 — dazu die Steckertypen der Ports. Eine Vorlage aus dem
    // Patchblenden-Dialog trug `TRS Jack`; nach dem Einfuegen in den Plan
    // heilt `healProjectPositions` sie, in der Bibliotheks-Seitenleiste stand
    // sie aber weiter mit dem alten Wert — also mit einer anderen Farbe als
    // dasselbe Geraet im Plan daneben.
    const heilePorts = (ports: EquipmentTemplate['inputs']) =>
      (ports ?? []).map((p) => ({
        ...p,
        connectorType: heileSteckertyp(p.connectorType),
        type: heileSteckertyp(p.type),
      }))
    return items.map((t) => ({
      ...t,
      // #837 — der Name einer ausgelieferten Vorlage IST ihre Kennung: die
      // Seed-Stufe in `projectStore` gleicht ueber `byName` ab. Ohne diese
      // Zeile stuende nach dem Umbenennen die alte deutsche Vorlage neben der
      // neuen englischen.
      name: heileVorlagenName(t.name),
      ...(t.category && LEGACY_CATEGORY_RENAMES[t.category]
        ? { category: LEGACY_CATEGORY_RENAMES[t.category] }
        : {}),
      inputs: heilePorts(t.inputs),
      outputs: heilePorts(t.outputs),
    }))
  } catch {
    return []
  }
}

/**
 * Die Namen der AUSGELIEFERTEN Vorlagen. Wird von `projectStore` gesetzt,
 * bevor irgendetwas gespeichert wird.
 *
 * Warum als veraenderliche Menge und nicht als Import: `libraryPersist` darf
 * die Katalog-Module nicht ziehen. Es haengt an `projectStore`, und
 * `projectStore` haengt an ihm — ein Import in diese Richtung waere ein Ring,
 * und der Grund, aus dem diese Datei ueberhaupt ausgelagert wurde (#308).
 */
let eingebauteNamen: ReadonlySet<string> = new Set()

export const setzeEingebauteNamen = (namen: Iterable<string>) => {
  eingebauteNamen = new Set(namen)
}

/**
 * ─── WAS HIER GESPEICHERT WIRD — UND WAS SEIT DEM 2026-09-24 NICHT MEHR ────
 *
 * NUR DIE VORLAGEN DES NUTZERS. Die ausgelieferten kommen aus ihren Modulen
 * und werden beim Start davorgelegt; sie in `localStorage` zu schreiben war
 * bis heute richtig und ist es seit der EasySchematic-Uebernahme nicht mehr.
 *
 * GEMESSEN: 5315 ausgelieferte Vorlagen sind als JSON **4,38 MB**. Das
 * Kontingent von `localStorage` liegt in den meisten Browsern bei 5 MB fuer
 * den ganzen Ursprung — geteilt mit dem Autosave des Projekts, den
 * Einstellungen, dem Offline-Zwischenspeicher. Der Schreibversuch waere also
 * an `QuotaExceededError` gescheitert, und das `catch` hier haette ihn
 * VERSCHLUCKT: die Bibliothek waere still auf dem alten Stand geblieben, ohne
 * dass irgendwo etwas steht.
 *
 * Damit faellt auch ein Umweg weg, den es nur wegen dieser Speicherung gab:
 * die Saat musste ihre `LIB_MIGRATION_VERSION` hochziehen, damit ein
 * Bestandsnutzer neue Katalog-Eintraege ueberhaupt zu sehen bekam. Was aus
 * dem Modul kommt, ist immer da.
 *
 * Eine eigene Vorlage mit dem Namen einer ausgelieferten bleibt erhalten und
 * gewinnt (siehe `mischeBibliothek`) — wer eine ausgelieferte Vorlage
 * anpasst, soll seine Fassung behalten.
 */
export const persistCustomLibrary = (items: EquipmentTemplate[]) => {
  const eigene = items.filter((t) => !eingebauteNamen.has(t.name))
  try {
    localStorage.setItem(CUSTOM_LIB_KEY, JSON.stringify(eigene))
  } catch {
    /* ignore */
  }
  // Der Ordner-Abgleich bekommt weiterhin ALLES: er ist der Weg nach aussen
  // (Desktop-Bibliothek), und dort ist eine ausgelieferte Vorlage so
  // brauchbar wie eine eigene.
  syncDevicesToFolder(items)
}

/**
 * Ausgelieferte und eigene Vorlagen zu EINER Liste — die eigene gewinnt.
 *
 * Die Reihenfolge ist die Zusicherung: wer eine ausgelieferte Vorlage unter
 * demselben Namen angepasst hat, arbeitet weiter mit seiner Fassung. Ohne
 * diese Regel haette die naechste Katalog-Lieferung stillschweigend seine
 * Portliste ersetzt.
 */
export const mischeBibliothek = (
  eingebaute: EquipmentTemplate[],
  eigene: EquipmentTemplate[],
): EquipmentTemplate[] => {
  const nachName = new Map(eingebaute.map((t) => [t.name, t]))
  for (const t of eigene) nachName.set(t.name, t)
  return [...nachName.values()]
}

export const loadKnownCategories = (): string[] => {
  try {
    const raw = localStorage.getItem(KNOWN_CATEGORIES_KEY)
    const stored = raw ? (JSON.parse(raw) as string[]) : []
    // #822 — dieselbe Umbenennung wie fuer `equipment.category`, hier fuer
    // die Liste im Auswahlfeld. Ohne sie staende die alte deutsche Kategorie
    // NEBEN der neuen englischen: der Nutzer saehe `Kameras` und `Cameras`
    // untereinander und muesste raten, welche seine Geraete tragen.
    const gewandelt = stored.map((c) => LEGACY_CATEGORY_RENAMES[c] ?? c)
    const set_ = new Set<string>([...DEFAULT_CATEGORIES, ...gewandelt])
    return Array.from(set_).sort((a, b) => a.localeCompare(b))
  } catch {
    return [...DEFAULT_CATEGORIES]
  }
}

export const persistKnownCategories = (items: string[]) => {
  try {
    localStorage.setItem(KNOWN_CATEGORIES_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}
