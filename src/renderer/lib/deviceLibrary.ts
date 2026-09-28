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
export { effectiveServer, guidelinesUrl, normalizeServerUrl } from './deviceLibraryUrl'
import { pruefeVorlage } from './vorlagenEinreichung'
import { coreAus, facetAus, type Namen } from './deviceLibraryItem'
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

/**
 * Die Staende ALLER Server, unter einem Schluessel.
 *
 * Frueher lag hier genau ein Stand, und ein anderer Server hiess: neu
 * anfangen — beim ersten erfolgreichen Abgleich mit ihm war der alte Stand
 * ueberschrieben. Wer auf einen Ersatzserver umstellte, weil
 * devices.zumpelars.de gerade nicht lief, und zurueckwechselte, hatte danach
 * eine leere Bibliothek. Jetzt hat jeder Server seinen Platz (Vertrag Punkt 2
 * in `syncFrom`, `deviceLibraryClient.ts`). Ein alter Einzelstand wird beim
 * Lesen als Eintrag seines Servers verstanden.
 */
interface CacheAblage {
  format: 'cable-planner-device-library-caches'
  version: 1
  byServer: Record<string, DeviceLibraryCache>
}

const leereAblage = (): CacheAblage => ({ format: 'cable-planner-device-library-caches', version: 1, byServer: {} })

function ladeAblage(storage: KeyValueStorage | null): CacheAblage {
  try {
    const raw = storage?.getItem(STORAGE_KEYS.deviceLibraryCache)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (istCache(parsed)) return { ...leereAblage(), byServer: { [parsed.server]: parsed } }
    const a = parsed as Partial<CacheAblage> | null
    if (a?.format === 'cable-planner-device-library-caches' && a.version === 1 && a.byServer && typeof a.byServer === 'object') {
      const byServer: Record<string, DeviceLibraryCache> = {}
      for (const [server, c] of Object.entries(a.byServer)) if (istCache(c) && c.server === server) byServer[server] = c
      return { ...leereAblage(), byServer }
    }
  } catch {
    // kaputter Eintrag: wie keiner
  }
  return leereAblage()
}

/** Der Stand fuer DIESEN Server; Sequenznummern zweier Server haben nichts
 *  miteinander zu tun. */
export function loadCache(server: string, storage = standardSpeicher()): DeviceLibraryCache {
  return ladeAblage(storage).byServer[server] ?? emptyCache(server)
}

/** `false`, wenn der Speicher voll ist oder fehlt — dann gilt der Stand nur
 *  bis zum Neustart, und das wird gesagt statt verschwiegen. Die Staende der
 *  anderen Server bleiben unberuehrt. */
export function saveCache(cache: DeviceLibraryCache, storage = standardSpeicher()): boolean {
  if (!storage) return false
  try {
    const ablage = ladeAblage(storage)
    ablage.byServer[cache.server] = cache
    storage.setItem(STORAGE_KEYS.deviceLibraryCache, JSON.stringify(ablage))
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
 * Ob der Server noch derselbe ist, entscheidet `syncFrom` im gemeinsamen
 * Client — dieselbe Regel in jedem Planner. Kommt `reset`, ersetzt die
 * Antwort den ganzen Stand; ein leerer neuer Server kommt gar nicht erst als
 * Antwort an, sondern als Fehler, und der Stand bleibt.
 */
export async function runSync(
  api: Pick<DeviceLibraryApi, 'sync'>,
  server: string,
  storage = standardSpeicher(),
  jetzt: () => Date = () => new Date(),
): Promise<SyncOutcome> {
  const cache = loadCache(server, storage)
  const res = await api.sync(server, cache.latestSeq)
  if (!res.ok) return res
  const { reset, response } = res.value
  const merged = mergeSync(reset ? emptyCache(server) : cache, response)
  const next = { ...merged.cache, syncedAt: jetzt().toISOString() }
  const persisted = saveCache(next, storage)
  return { ok: true, cache: next, stats: { ...merged.stats, reset }, persisted }
}

/** Vorschlag fuer Hersteller/Modell — der Nutzer korrigiert im Dialog. */
export { herstellerAusName as guessManufacturerModel } from './herstellerAusName'

/** Was an den Server geht (Einreichen-Dialog). */
export function proposalFor(
  template: EquipmentTemplate,
  names: Namen,
): { core: ProposalCore; facet: Record<string, unknown> } {
  return { core: coreAus(template, names), facet: facetAus(template) }
}

type Uebersetzen = (key: string, fallback: string) => string

/** Ein Fehlercode als Satz, den jemand ohne Serverkenntnis versteht. */
export function errorText(
  r: { code: DeviceLibraryErrorCode; status?: number; message?: string },
  t: Uebersetzen,
): string {
  switch (r.code) {
    case 'wrong-credentials':
      return t('deviceLibrary.error.wrongCredentials', 'Email/username or password is wrong.')
    case 'email-not-verified':
      return t('deviceLibrary.error.emailNotVerified', 'Your email address is not confirmed yet. Open the link in the confirmation email, then sign in again.')
    case 'guidelines-outdated':
      return t('deviceLibrary.error.guidelines', 'The community guidelines have changed. Read and accept them on the device library website, then submit again.')
    case 'exists':
      return t('deviceLibrary.error.exists', 'The library already has a device with this manufacturer and model. Look it up there and confirm or correct it instead.')
    case 'wrong-code':
      return t('deviceLibrary.error.wrongCode', 'The two-factor code is wrong or has expired.')
    case 'rate-limited':
      return t('deviceLibrary.error.rateLimited', 'Too many attempts. Please wait a few minutes and try again.')
    case 'not-signed-in':
      return t('deviceLibrary.error.notSignedIn', 'Not signed in, or the session has expired. Please sign in again.')
    case 'offline':
      return t('deviceLibrary.error.offline', 'The device library cannot be reached. The devices from the last update stay available; check the network connection and the server address.')
    case 'invalid-url':
      return t('deviceLibrary.error.invalidUrl', 'The server address is not a valid http(s) URL.')
    default:
      if (r.message === 'server-empty') {
        return t('deviceLibrary.error.serverEmpty', 'The server was set up anew and has no devices yet. Your devices from the last update were kept.')
      }
      return t('deviceLibrary.error.server', 'The device library reported an error. Please try again later.')
  }
}
