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

export const persistCustomLibrary = (items: EquipmentTemplate[]) => {
  try {
    localStorage.setItem(CUSTOM_LIB_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
  syncDevicesToFolder(items)
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
