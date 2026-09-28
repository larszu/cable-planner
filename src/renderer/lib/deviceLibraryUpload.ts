// ───────────────────────────────────────────────────────────────────────────
// EIGENE VORLAGEN → GERAETEBIBLIOTHEK (Hochladen, Zustand je Vorlage)
//
// „Alle Daten aus allen Plannern sollen immer auch auf devices.zumpelars.de
// sein." Hochgeladen wird, was diese Installation SELBST angelegt oder
// geaendert hat. Eine unveraenderte Vorlage des eingebauten Katalogs geht
// nicht von jedem Rechner einzeln hoch — die veroeffentlicht das Repo
// (`npm run library:publish`); hier wuerde sie tausendfach dieselbe
// Moderationsanfrage ausloesen.
//
// Gemerkt wird je Vorlage der Fingerabdruck der hochgeladenen Fassung. Nur
// was sich seitdem geaendert hat, geht erneut raus — ein Start ohne
// Aenderung schickt keine einzige Anfrage.
// ───────────────────────────────────────────────────────────────────────────

import type { UploadResult, UploadState } from './deviceLibraryClient'
import { fingerabdruck, facetAus, uploadItemAus, type Namen } from './deviceLibraryItem'
import { herstellerAusName } from './herstellerAusName'
import { pruefeVorlage } from './vorlagenEinreichung'
import { EINGEBAUTER_KATALOG } from './eingebauterKatalog'
import { STORAGE_KEYS } from './storageKeys'
import type { EquipmentTemplate } from '../types/equipment'
import type { DeviceLibraryApi, DeviceLibraryErrorCode } from '../types/deviceLibrary'

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const standardSpeicher = (): KeyValueStorage | null => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Zustand einer Vorlage. `local-blocked` = hier schon an der eigenen
 *  Pruefung gescheitert, nicht gesendet. */
export type UploadZustand = UploadState | 'local-blocked'

export interface UploadEintrag {
  /** Fingerabdruck der Fassung, fuer die `zustand` gilt. Fehlt nach `error`:
   *  dann wird beim naechsten Mal erneut gesendet. */
  hash?: string
  zustand: UploadZustand
  slug?: string
  /** Stand in der Moderation laut Server — auch bei `in-sync`. */
  moderation?: 'pending' | 'approved'
  befunde?: string[]
  fehler?: string
  am: string
}

const WARTEND: readonly UploadZustand[] = ['created', 'edit-proposed', 'pending-updated']

/** Wartet dieser Eintrag noch auf die Moderation? Aeltere Staende ohne
 *  `moderation` schliessen es aus dem Zustand. */
export const wartetAufModeration = (e: UploadEintrag | undefined): boolean =>
  !!e && (e.moderation ? e.moderation === 'pending' : WARTEND.includes(e.zustand))

/** Was der Server ueber die Moderation sagt — oder, bei einem Server ohne
 *  das Feld, was sich aus dem Zustand ergibt. */
const moderationAus = (r: UploadResult): UploadEintrag['moderation'] =>
  r.moderation ?? (r.state === 'approved' ? 'approved' : WARTEND.includes(r.state) ? 'pending' : undefined)

export interface UploadStand {
  format: 'cable-planner-device-library-uploads'
  version: 1
  server: string
  eintraege: Record<string, UploadEintrag>
  /** Vom Nutzer korrigierte Hersteller/Modell-Trennung je Vorlage. */
  namen: Record<string, Namen>
}

export const leererUploadStand = (server: string): UploadStand => ({
  format: 'cable-planner-device-library-uploads',
  version: 1,
  server,
  eintraege: {},
  namen: {},
})

export function loadUploadStand(server: string, storage = standardSpeicher()): UploadStand {
  try {
    const raw = storage?.getItem(STORAGE_KEYS.deviceLibraryUploads)
    const p = raw ? (JSON.parse(raw) as Partial<UploadStand>) : null
    if (p?.format === 'cable-planner-device-library-uploads' && p.version === 1 && p.server === server && p.eintraege && p.namen) {
      return p as UploadStand
    }
  } catch {
    // kaputt: wie keiner
  }
  return leererUploadStand(server)
}

export function saveUploadStand(stand: UploadStand, storage = standardSpeicher()): boolean {
  if (!storage) return false
  try {
    storage.setItem(STORAGE_KEYS.deviceLibraryUploads, JSON.stringify(stand))
    return true
  } catch {
    return false
  }
}

const katalogFingerabdruck = new Map<string, string>()
const ohneLokales = (t: EquipmentTemplate) => fingerabdruck(facetAus(t))

/**
 * Die Vorlagen, die diese Installation selbst angelegt oder geaendert hat:
 * ohne Rentman-Importe und ohne unveraenderte Katalog-Vorlagen. Favorit und
 * Versteckt zaehlen dabei nicht als Aenderung.
 */
export function eigeneVorlagen(
  bibliothek: readonly EquipmentTemplate[],
  katalog: readonly EquipmentTemplate[] = EINGEBAUTER_KATALOG,
): EquipmentTemplate[] {
  const ref = katalog === EINGEBAUTER_KATALOG ? katalogFingerabdruck : new Map<string, string>()
  if (ref.size === 0) for (const k of katalog) ref.set(k.name, ohneLokales(k))
  return bibliothek.filter((t) => !t.rentmanSource && ref.get(t.name) !== ohneLokales(t))
}

export const namenFuer = (stand: UploadStand, t: EquipmentTemplate): Namen =>
  stand.namen[t.name] ?? herstellerAusName(t.name)

const befundText = (f: unknown): string => {
  if (typeof f === 'string') return f
  const o = f as { kind?: unknown; message?: unknown; path?: unknown } | null
  if (o && typeof o.kind === 'string') return o.kind
  if (o && typeof o.message === 'string') return Array.isArray(o.path) && o.path.length ? `${o.path.join('.')}: ${o.message}` : o.message
  return JSON.stringify(f)
}

export const befundeAus = (findings: unknown): string[] =>
  Array.isArray(findings) ? findings.map(befundText) : findings == null ? [] : [befundText(findings)]

/**
 * Was diesmal hochgeht. Unveraendert seit dem letzten Hochladen: nichts.
 * Blockiert die App-eigene Pruefung (dieselbe wie vor dem Einreichen) oder
 * fehlt der Hersteller: lokal blockiert, mit Grund, nicht gesendet.
 */
export function planeUpload(
  vorlagen: readonly EquipmentTemplate[],
  stand: UploadStand,
  pruefe: (t: EquipmentTemplate) => string[] = (t) =>
    pruefeVorlage(t).filter((b) => b.blockiert).map((b) => b.text),
) {
  const items: ReturnType<typeof uploadItemAus>[] = []
  const hashes = new Map<string, string>()
  const lokalBlockiert = new Map<string, string[]>()
  for (const t of vorlagen) {
    const namen = namenFuer(stand, t)
    const item = uploadItemAus(t, namen)
    const hash = fingerabdruck(item)
    const bisher = stand.eintraege[t.name]
    // Unveraendert UND nicht mehr in der Moderation: nichts zu tun. Wartet es
    // noch, geht es mit — nur so erfaehrt die App, dass es inzwischen live
    // ist (der Server meldet dann `in-sync` mit `moderation: 'approved'`).
    if (bisher?.hash === hash && !wartetAufModeration(bisher)) continue
    const gruende = pruefe(t)
    if (!namen.manufacturer.trim()) gruende.push('manufacturer-missing')
    if (!namen.model.trim()) gruende.push('model-missing')
    if (gruende.length) {
      lokalBlockiert.set(t.name, gruende)
      hashes.set(t.name, hash)
      continue
    }
    items.push(item)
    hashes.set(t.name, hash)
  }
  return { items, hashes, lokalBlockiert }
}

/** Ergebnisse uebernehmen; Eintraege zu Vorlagen, die es nicht mehr gibt, fallen weg. */
export function uebernehmeErgebnisse(
  stand: UploadStand,
  vorlagen: readonly EquipmentTemplate[],
  plan: ReturnType<typeof planeUpload>,
  ergebnisse: readonly UploadResult[],
  jetzt: Date = new Date(),
): UploadStand {
  const am = jetzt.toISOString()
  const namen = new Set(vorlagen.map((t) => t.name))
  const eintraege: Record<string, UploadEintrag> = {}
  for (const [k, v] of Object.entries(stand.eintraege)) if (namen.has(k)) eintraege[k] = v
  for (const [name, gruende] of plan.lokalBlockiert) {
    eintraege[name] = { hash: plan.hashes.get(name), zustand: 'local-blocked', befunde: gruende, am }
  }
  for (const r of ergebnisse) {
    if (!namen.has(r.localId)) continue
    eintraege[r.localId] = {
      // Nach einem Fehler KEIN Fingerabdruck: das naechste Mal wird erneut gesendet.
      ...(r.state === 'error' ? {} : { hash: plan.hashes.get(r.localId) }),
      zustand: r.state,
      ...(r.slug ? { slug: r.slug } : {}),
      ...(moderationAus(r) ? { moderation: moderationAus(r) } : {}),
      ...(r.state === 'blocked' ? { befunde: befundeAus(r.findings) } : {}),
      ...(r.error ? { fehler: r.error } : {}),
      am,
    }
  }
  const namenAlt = Object.fromEntries(Object.entries(stand.namen).filter(([k]) => namen.has(k)))
  return { ...stand, eintraege, namen: namenAlt }
}

export interface UploadBilanz {
  gesendet: number
  wartet: number
  live: number
  blockiert: number
  fehler: number
}

export const bilanz = (plan: ReturnType<typeof planeUpload>, ergebnisse: readonly UploadResult[]): UploadBilanz => ({
  gesendet: plan.items.length,
  wartet: ergebnisse.filter((r) => moderationAus(r) === 'pending').length,
  live: ergebnisse.filter((r) => moderationAus(r) === 'approved').length,
  blockiert: ergebnisse.filter((r) => r.state === 'blocked').length + plan.lokalBlockiert.size,
  fehler: ergebnisse.filter((r) => r.state === 'error').length,
})

export type UploadOutcome =
  | { ok: true; stand: UploadStand; bilanz: UploadBilanz }
  | { ok: false; code: DeviceLibraryErrorCode; status?: number; message?: string }

/** Einmal hochladen, was sich geaendert hat, und den Stand speichern. */
export async function runUpload(
  api: Pick<DeviceLibraryApi, 'upload'>,
  server: string,
  bibliothek: readonly EquipmentTemplate[],
  storage = standardSpeicher(),
  jetzt: () => Date = () => new Date(),
): Promise<UploadOutcome> {
  const stand = loadUploadStand(server, storage)
  const vorlagen = eigeneVorlagen(bibliothek)
  const plan = planeUpload(vorlagen, stand)
  let ergebnisse: UploadResult[] = []
  if (plan.items.length > 0) {
    const r = await api.upload(server, plan.items)
    if (!r.ok) return r
    ergebnisse = r.value
  }
  const next = uebernehmeErgebnisse(stand, vorlagen, plan, ergebnisse, jetzt())
  saveUploadStand(next, storage)
  return { ok: true, stand: next, bilanz: bilanz(plan, ergebnisse) }
}
