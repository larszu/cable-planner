/**
 * #309 — Bilinguale Kategorie-Anzeige.
 *
 * Kategorien werden in `knownCategories[]` und `equipment.category` als
 * "canonical" Strings gehalten (typischerweise die Sprache in der sie
 * angelegt wurden). Dieses Modul verwaltet eine separate
 * Übersetzungs-Map die pro canonical-Key beide Anzeige-Namen kennt.
 *
 * Datenfluss:
 *   - Anlegen: User gibt z. B. DE="Kamera" und EN="Camera" ein.
 *     Canonical bleibt die DE-Eingabe (oder die erste nicht-leere),
 *     in der Map landet {de: "Kamera", en: "Camera"}.
 *   - Anzeige: `categoryDisplay(canonical, lang)` liest die Map und
 *     fällt zurück auf canonical wenn kein Eintrag existiert.
 *   - Migration: Alte Kategorien ohne Map-Eintrag werden als-ist
 *     gezeigt; User kann sie über Settings → Erweitert nachträglich
 *     mit beiden Sprachen versehen.
 */
import { STORAGE_KEYS } from './storageKeys'

const STORAGE_KEY = STORAGE_KEYS.categoryTranslations

export type Lang = 'de' | 'en'

export interface CategoryLabelPair {
  de?: string
  en?: string
}

export type CategoryTranslationsMap = Record<string, CategoryLabelPair>

export const loadCategoryTranslations = (): CategoryTranslationsMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CategoryTranslationsMap) : {}
  } catch {
    return {}
  }
}

export const persistCategoryTranslations = (map: CategoryTranslationsMap) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

/**
 * Built-in translations for the DEFAULT_CATEGORIES (DE seed list from
 * libraryPersist.ts). Wird zur Anzeige genutzt damit out-of-the-box die
 * Default-Kategorien in beiden Sprachen funktionieren, ohne dass der User
 * sie zuerst editieren muss. User-eingegebene Map-Einträge haben Vorrang.
 */
const BUILTIN_DE_TO_EN: Record<string, string> = {
  Kameras: 'Cameras',
  Objektive: 'Lenses',
  Stative: 'Tripods',
  Licht: 'Lighting',
  Audio: 'Audio',
  Mikrofone: 'Microphones',
  Mischpult: 'Mixing console',
  Video: 'Video',
  Monitore: 'Monitors',
  PC: 'PC',
  Netzwerk: 'Networking',
  Kabel: 'Cables',
  Strom: 'Power',
  Rigging: 'Rigging',
  Sonstiges: 'Other',
}
const BUILTIN_EN_TO_DE: Record<string, string> = Object.fromEntries(
  Object.entries(BUILTIN_DE_TO_EN).map(([de, en]) => [en, de]),
)

/**
 * Resolve the display label for a canonical category key in the current
 * language. Order of preference:
 *   1. User-supplied translation in the map
 *   2. Built-in DE↔EN translation for DEFAULT_CATEGORIES
 *   3. The canonical string as-is (typical for newly-added user
 *      categories that only have one language)
 */
export const categoryDisplay = (
  canonical: string,
  lang: Lang,
  map: CategoryTranslationsMap,
): string => {
  const entry = map[canonical]
  if (entry?.[lang]) return entry[lang] as string
  if (lang === 'en' && BUILTIN_DE_TO_EN[canonical]) return BUILTIN_DE_TO_EN[canonical]
  if (lang === 'de' && BUILTIN_EN_TO_DE[canonical]) return BUILTIN_EN_TO_DE[canonical]
  return canonical
}

/**
 * Build sorted display options for a dropdown. Returns
 * [{value: canonical, label: displayInCurrentLang}, ...] sorted by
 * label so the user sees a localised, alphabetised list.
 */
export const buildCategoryOptions = (
  canonicals: string[],
  lang: Lang,
  map: CategoryTranslationsMap,
): { value: string; label: string }[] => {
  const seen = new Set<string>()
  const out: { value: string; label: string }[] = []
  for (const c of canonicals) {
    if (!c || seen.has(c)) continue
    seen.add(c)
    out.push({ value: c, label: categoryDisplay(c, lang, map) })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label))
}
