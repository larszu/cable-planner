import type { EquipmentTemplate } from '../types/equipment'
import { STORAGE_KEYS } from '../lib/storageKeys'
import { syncDevicesToFolder } from '../lib/librarySync'

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
  'Kameras',
  'Objektive',
  'Stative',
  'Licht',
  'Audio',
  'Mikrofone',
  'Mischpult',
  'Video',
  'Monitore',
  'PC',
  'Netzwerk',
  'Kabel',
  'Strom',
  'Rigging',
  'Sonstiges',
]

export const loadCustomLibrary = (): EquipmentTemplate[] => {
  try {
    const raw = localStorage.getItem(CUSTOM_LIB_KEY)
    return raw ? (JSON.parse(raw) as EquipmentTemplate[]) : []
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
    const set_ = new Set<string>([...DEFAULT_CATEGORIES, ...stored])
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
