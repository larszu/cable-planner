// ───────────────────────────────────────────────────────────────────────────
// GERAETEBIBLIOTHEK (devices.zumpelars.de) — Abgleich, Cache, Einreichen
//
// Die Bibliothek ist eine eigene, schreibgeschuetzte Quelle neben den eigenen
// Vorlagen und Rentman. Sie landet NICHT in `customLibrary`: dort waere sie
// editierbar, wanderte beim naechsten „Vorlagen einreichen" als „eigene"
// zurueck an den Server und liesse sich von einer lokalen Aenderung nicht
// mehr unterscheiden.
//
// Der Abgleich ist inkrementell: gemerkt wird `latestSeq`, gefragt wird nach
// allem danach. Der Stand liegt persistent im Browser-Speicher der App und
// bleibt offline nutzbar. Das Token liegt woanders (Schluesselbund bzw. ein
// eigener Schluessel im Web-Build) — hier steht nichts Geheimes.
// ───────────────────────────────────────────────────────────────────────────

import type { ProposalCore, SyncResponse } from './deviceLibraryClient'
export { effectiveServer, normalizeServerUrl } from './deviceLibraryUrl'
import { pruefeVorlage } from './vorlagenEinreichung'
import { STORAGE_KEYS } from './storageKeys'
import type { EquipmentTemplate } from '../types/equipment'
import type {
  DeviceLibraryApi,
  DeviceLibraryCache,
  DeviceLibraryEntry,
  DeviceLibraryErrorCode,
  DeviceLibrarySyncStats,
} from '../types/deviceLibrary'

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const standardSpeicher = (): KeyValueStorage | null => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export const emptyCache = (server: string): DeviceLibraryCache => ({
  format: 'cable-planner-device-library-cache',
  version: 1,
  server,
  latestSeq: 0,
  entries: [],
})

const istCache = (v: unknown): v is DeviceLibraryCache => {
  const c = v as Partial<DeviceLibraryCache> | null
  return (
    !!c &&
    c.format === 'cable-planner-device-library-cache' &&
    c.version === 1 &&
    typeof c.server === 'string' &&
    typeof c.latestSeq === 'number' &&
    Array.isArray(c.entries)
  )
}

/** Der Stand fuer DIESEN Server. Gehoert der gespeicherte einem anderen,
 *  faengt der Abgleich bei 0 an — Sequenznummern zweier Server haben nichts
 *  miteinander zu tun. */
export function loadCache(server: string, storage = standardSpeicher()): DeviceLibraryCache {
  try {
    const raw = storage?.getItem(STORAGE_KEYS.deviceLibraryCache)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (istCache(parsed) && parsed.server === server) return parsed
  } catch {
    // kaputter Eintrag: wie keiner
  }
  return emptyCache(server)
}

/** `false`, wenn der Speicher voll ist oder fehlt — dann gilt der Stand nur
 *  bis zum Neustart, und das wird gesagt statt verschwiegen. */
export function saveCache(cache: DeviceLibraryCache, storage = standardSpeicher()): boolean {
  if (!storage) return false
  try {
    storage.setItem(STORAGE_KEYS.deviceLibraryCache, JSON.stringify(cache))
    return true
  } catch {
    return false
  }
}

const vorlageAus = (facet: Record<string, unknown>): EquipmentTemplate =>
  // Die cable-Facette IST das `EquipmentTemplate` dieser App (Server:
  // `cableTemplate`). Geprueft wird sie trotzdem, bevor sie gilt — siehe unten.
  ({ ...(facet as unknown as EquipmentTemplate) })

/**
 * Eine Sync-Antwort in den lokalen Stand einarbeiten. Rein, ohne Speicher.
 *
 * `removed` entfernt. Ein Eintrag, der die App-eigene Vorlagenpruefung
 * (`pruefeVorlage`, dieselbe wie vor dem Einreichen) nicht besteht, wird
 * uebersprungen und gezaehlt — und eine aeltere, lokal liegende Fassung
 * desselben Geraets faellt dabei mit heraus: sie stuende sonst als aktueller
 * Stand da, obwohl die Bibliothek laengst einen anderen fuehrt.
 */
export function mergeSync(
  cache: DeviceLibraryCache,
  res: Pick<SyncResponse, 'latestSeq' | 'devices'>,
  check: (v: EquipmentTemplate) => boolean = (v) => !pruefeVorlage(v).some((b) => b.blockiert),
): { cache: DeviceLibraryCache; stats: Omit<DeviceLibrarySyncStats, 'reset'> } {
  const bySlug = new Map(cache.entries.map((e) => [e.slug, e]))
  const stats = { added: 0, updated: 0, removed: 0, invalid: 0, invalidNames: [] as string[] }

  for (const d of [...res.devices].sort((a, b) => a.seq - b.seq)) {
    if (d.removed || !d.facet) {
      if (bySlug.delete(d.slug)) stats.removed += 1
      continue
    }
    const template = vorlageAus(d.facet)
    if (typeof template.name !== 'string' || !check(template)) {
      stats.invalid += 1
      stats.invalidNames.push(
        (typeof template.name === 'string' && template.name.trim()) || `${d.core.manufacturer} ${d.core.model}`.trim() || d.slug,
      )
      bySlug.delete(d.slug)
      continue
    }
    const entry: DeviceLibraryEntry = {
      slug: d.slug,
      version: d.version,
      seq: d.seq,
      status: d.status,
      confirmations: d.confirmations,
      manufacturer: d.core.manufacturer,
      model: d.core.model,
      template,
    }
    if (bySlug.has(d.slug)) stats.updated += 1
    else stats.added += 1
    bySlug.set(d.slug, entry)
  }

  return {
    cache: {
      ...cache,
      latestSeq: Math.max(cache.latestSeq, res.latestSeq),
      entries: [...bySlug.values()].sort(
        (a, b) => a.template.category.localeCompare(b.template.category) || a.template.name.localeCompare(b.template.name),
      ),
    },
    stats,
  }
}

export type SyncOutcome =
  | { ok: true; cache: DeviceLibraryCache; stats: DeviceLibrarySyncStats; persisted: boolean }
  | { ok: false; code: DeviceLibraryErrorCode; status?: number; message?: string }

/**
 * Einmal abgleichen: ab dem gemerkten `latestSeq`, gespeichert danach.
 *
 * Meldet der Server einen KLEINEREN `latestSeq` als den gemerkten, ist er
 * nicht mehr derselbe (neu aufgesetzt, Sicherung eingespielt). Dann wird der
 * ganze Stand neu geholt — sonst fragte die App fuer immer nach Nummern, die
 * es dort nicht gibt, und saehe nie wieder etwas Neues.
 */
export async function runSync(
  api: Pick<DeviceLibraryApi, 'sync'>,
  server: string,
  storage = standardSpeicher(),
  jetzt: () => Date = () => new Date(),
): Promise<SyncOutcome> {
  let cache = loadCache(server, storage)
  let res = await api.sync(server, cache.latestSeq)
  if (!res.ok) return res
  let reset = false
  if (res.value.latestSeq < cache.latestSeq) {
    reset = true
    cache = emptyCache(server)
    res = await api.sync(server, 0)
    if (!res.ok) return res
  }
  const merged = mergeSync(cache, res.value)
  const next = { ...merged.cache, syncedAt: jetzt().toISOString() }
  const persisted = saveCache(next, storage)
  return { ok: true, cache: next, stats: { ...merged.stats, reset }, persisted }
}

/**
 * Hersteller und Modell aus dem Vorlagennamen raten — nur als Vorschlag im
 * Einreichen-Dialog. Die Vorlagen dieser App kennen kein eigenes
 * Herstellerfeld; die Bibliothek verlangt beides. Der Nutzer korrigiert.
 */
export function guessManufacturerModel(name: string): { manufacturer: string; model: string } {
  const s = name.trim().replace(/\s+/g, ' ')
  const i = s.indexOf(' ')
  if (i < 0) return { manufacturer: '', model: s }
  return { manufacturer: s.slice(0, i), model: s.slice(i + 1) }
}

/** Was an den Server geht. `sourceUrl` ist der Datenblattlink der Vorlage —
 *  ohne ihn laesst `pruefeVorlage` sie gar nicht erst bis hierher. */
export function proposalFor(
  template: EquipmentTemplate,
  names: { manufacturer: string; model: string },
): { core: ProposalCore; facet: Record<string, unknown> } {
  const core: ProposalCore = {
    manufacturer: names.manufacturer.trim(),
    model: names.model.trim(),
    category: template.category.trim(),
    sourceUrl: (template.manufacturerUrl ?? '').trim(),
    ...(template.powerWatts != null ? { powerWatts: template.powerWatts } : {}),
    ...(template.rackUnits != null ? { rackUnits: template.rackUnits } : {}),
    ...(template.weightKg != null ? { weightKg: template.weightKg } : {}),
  }
  // Rentman-Herkunft und Favoriten-/Versteckt-Schalter sind Sache dieser
  // Installation. Der Server streift private Felder ebenfalls ab; hier gehen
  // sie gar nicht erst raus.
  const facet: Record<string, unknown> = { ...template }
  for (const k of ['rentmanSource', 'rentmanProjectName', 'favorite', 'hidden']) delete facet[k]
  return { core, facet }
}

type Uebersetzen = (key: string, fallback: string) => string

/** Ein Fehlercode als Satz, den jemand ohne Serverkenntnis versteht. */
export function errorText(
  r: { code: DeviceLibraryErrorCode; status?: number; message?: string },
  t: Uebersetzen,
): string {
  // Beim Einreichen meldet der Server fehlende Berechtigungen mit 403 und
  // einem eigenen Code; der Client fasst 403 als `wrong-credentials` zusammen.
  if (r.message === 'email-not-verified') return errorText({ code: 'email-not-verified' }, t)
  if (r.message === 'guidelines-outdated') {
    return t('deviceLibrary.error.guidelines', 'Please accept the current contribution guidelines on the device library website first.')
  }
  if (r.message === 'exists') {
    return t('deviceLibrary.error.exists', 'The library already has a device with this manufacturer and model.')
  }
  switch (r.code) {
    case 'wrong-credentials':
      return t('deviceLibrary.error.wrongCredentials', 'Email/username or password is wrong.')
    case 'email-not-verified':
      return t('deviceLibrary.error.emailNotVerified', 'Your email address is not confirmed yet. Open the link in the confirmation email, then sign in again.')
    case 'wrong-code':
      return t('deviceLibrary.error.wrongCode', 'The two-factor code is wrong or has expired.')
    case 'rate-limited':
      return t('deviceLibrary.error.rateLimited', 'Too many attempts. Please wait a few minutes and try again.')
    case 'not-signed-in':
      return t('deviceLibrary.error.notSignedIn', 'Not signed in, or the session has expired. Please sign in again.')
    case 'offline':
      return t('deviceLibrary.error.offline', 'The device library cannot be reached. Check the network connection and the server address.')
    case 'invalid-url':
      return t('deviceLibrary.error.invalidUrl', 'The server address is not a valid http(s) URL.')
    default:
      return t('deviceLibrary.error.server', 'The device library reported an error. Please try again later.')
  }
}
