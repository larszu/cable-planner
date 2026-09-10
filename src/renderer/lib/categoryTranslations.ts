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
 * Built-in translations for the shipped categories.
 *
 * ─── RICHTUNG GEDREHT (2026-09-10, #822) ─────────────────────────────────
 *
 * Bis dahin stand hier eine DE→EN-Tabelle, weil die ausgelieferten
 * Kategorien deutsch benannt waren: `Kameras`, `Konverter`, `Patchblende`,
 * `Stromverteilung`, `Funkstrecke`, `Sync/Referenz`. Seit E-28 ist Englisch
 * die Quellsprache der ganzen Suite — und ausgelieferte Daten sind davon
 * nicht ausgenommen, sonst steht in der Bibliotheks-Seitenleiste die eine
 * Haelfte englisch (`Video`, `Networking`, `IP/NDI`) und die andere deutsch.
 *
 * Der kanonische Wert ist jetzt ENGLISCH, die Tabelle uebersetzt ihn ins
 * Deutsche. Sie deckt nicht mehr nur `DEFAULT_CATEGORIES` ab, sondern auch
 * die Kategorien aus den Geraete-Katalogen: wer ein Blackmagic-Geraet
 * einfuegt, bekam vorher `Konverter` in eine sonst englische Liste.
 */
const BUILTIN_EN_TO_DE: Record<string, string> = {
  Cameras: 'Kameras',
  Lenses: 'Objektive',
  Tripods: 'Stative',
  Lighting: 'Licht',
  Audio: 'Audio',
  Microphones: 'Mikrofone',
  'Mixing console': 'Mischpult',
  Video: 'Video',
  Monitors: 'Monitore',
  PC: 'PC',
  Networking: 'Netzwerk',
  Cables: 'Kabel',
  'Patch panels': 'Patchfelder',
  'Patch panels (adapter)': 'Patchfelder (Adapter)',
  Power: 'Strom',
  Rigging: 'Rigging',
  Other: 'Sonstiges',
  // ── aus den Geraete-Katalogen, vorher gar nicht uebersetzbar ──────────
  Converter: 'Konverter',
  'Sync/Reference': 'Sync/Referenz',
  'Power distribution': 'Stromverteilung',
  Wireless: 'Funkstrecke',
  Mixer: 'Mischer',
  'Video Converter': 'Video-Konverter',
  'Video Mixer': 'Bildmischer',
  'Video Router': 'Kreuzschiene',
  'IT/Server': 'IT/Server',
  'IP/NDI': 'IP/NDI',
}
const BUILTIN_DE_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(BUILTIN_EN_TO_DE).map(([en, de]) => [de, en]),
)

/**
 * Die Umbenennung von 2026-09-10 als Migrationstabelle: alter (deutscher)
 * kanonischer Wert -> neuer (englischer).
 *
 * WARUM SIE HIER STEHT UND NICHT NUR IN DER MIGRATION. Weil sie zwei
 * Aufgaben hat, die auseinanderlaufen wuerden, wenn es sie zweimal gaebe:
 * `healProjectPositions` schreibt bestehende Projekte um, und `categoryDisplay`
 * unten faellt darauf zurueck, falls doch einmal ein alter Wert
 * durchkommt (ein Template aus einer alten `.cpdevice`-Datei, eine
 * Zwischenablage aus einer aelteren Version).
 *
 * Sie ist NICHT die Umkehrung von `BUILTIN_EN_TO_DE`: `Patchblende` und
 * `Patchfelder` waren zwei Namen fuer dieselbe Sache und werden beide auf
 * `Patch panels` gefuehrt, `Monitor` und `Monitore` beide auf `Monitors`.
 */
export const LEGACY_CATEGORY_RENAMES: Record<string, string> = {
  Kameras: 'Cameras',
  Objektive: 'Lenses',
  Stative: 'Tripods',
  Licht: 'Lighting',
  Mikrofone: 'Microphones',
  Mischpult: 'Mixing console',
  Monitore: 'Monitors',
  Monitor: 'Monitors',
  Netzwerk: 'Networking',
  Kabel: 'Cables',
  Strom: 'Power',
  Sonstiges: 'Other',
  Patchfelder: 'Patch panels',
  Patchblende: 'Patch panels',
  'Patchblende (Adapter)': 'Patch panels (adapter)',
  Konverter: 'Converter',
  'Sync/Referenz': 'Sync/Reference',
  Stromverteilung: 'Power distribution',
  Funkstrecke: 'Wireless',
  Mischer: 'Mixer',
}

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
  if (lang === 'de' && BUILTIN_EN_TO_DE[canonical]) return BUILTIN_EN_TO_DE[canonical]
  if (lang === 'en' && BUILTIN_DE_TO_EN[canonical]) return BUILTIN_DE_TO_EN[canonical]
  // Ein alter deutscher Wert, den die Migration nicht erwischt hat (Template
  // aus einer alten `.cpdevice`-Datei, Zwischenablage aus einer aelteren
  // Version). Er wird angezeigt wie der neue — umgeschrieben wird er erst,
  // wenn das Projekt durch `healProjectPositions` laeuft.
  const neu = LEGACY_CATEGORY_RENAMES[canonical]
  if (neu) return lang === 'de' ? (BUILTIN_EN_TO_DE[neu] ?? neu) : neu
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
