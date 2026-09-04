// ───────────────────────────────────────────────────────────────────────────
// Green-GO <-> herstellerneutrales Austauschformat (B-8, Inkrement 1).
//
// Die Uebersetzung in beide Richtungen, als reine Funktionen: keine Uhr, kein
// Store, kein Datei-IO. Der Aufrufer setzt `exportedAt` und schreibt die
// Datei — dieselbe Aufteilung wie bei `inventoryPortable.ts`, und aus
// demselben Grund testbar.
//
// WAS DIE RUECKRICHTUNG NICHT KANN, UND WARUM SIE ES SAGT. Green-GO adressiert
// Nutzer und Gruppen ueber ZAHLEN (Slot 1-12, Gruppe 1-9); das neutrale Format
// benutzt Zeichenketten-Ids, weil kein Hersteller sich auf dieselbe Nummerierung
// festlegen laesst. Beim Zurueckwandeln werden die Nummern deshalb NEU vergeben,
// in Reihenfolge der Datei. Wer eine bestehende Anlage bespielt, will das nicht
// -- dafuer gibt es `basePreset`, das den Anlagenstand traegt. Der Import hier
// baut eine Konfiguration aus einer neutralen Datei, er repariert keine.
// ───────────────────────────────────────────────────────────────────────────
import type { GreenGoConfig, GreenGoGroup, GreenGoUser } from '../types/greengo'
import {
  INTERCOM_FORMAT,
  INTERCOM_FORMAT_VERSION,
  type IntercomChannel,
  type IntercomExchangeFile,
  type IntercomStation,
} from '../types/intercomExchange'

const channelId = (id: number): string => `ch-${id}`
const stationId = (id: number): string => `st-${id}`

/**
 * Aus einer Green-GO-Konfiguration eine neutrale Datei bauen.
 *
 * `derivedFrom` ist kein Schmuck: Green-GO fuehrt die Zugehoerigkeit als EINE
 * Liste, also sind talk und listen hier beide gesetzt. Wer die Datei liest,
 * muss wissen, dass das die Quelle ist und keine Messung -- sonst traegt er
 * eine Sprechberechtigung in ein fremdes System, die so nie geplant war.
 */
export const toIntercomExchange = (
  cfg: GreenGoConfig,
  meta?: { exportedAt?: string },
): IntercomExchangeFile => {
  const channels: IntercomChannel[] = cfg.groups.map((g) => ({
    id: channelId(g.id),
    name: g.name,
  }))
  const bekannt = new Set(cfg.groups.map((g) => g.id))

  const stations: IntercomStation[] = cfg.users.map((u) => ({
    id: stationId(u.id),
    name: u.name,
    // Nur uebernehmen, wenn er sich vom Namen unterscheidet -- ein
    // `displayName`, der den Namen wiederholt, ist keine Kurzform.
    ...(u.displayName && u.displayName !== u.name ? { shortName: u.displayName } : {}),
    memberships: u.groupIds
      // Eine Zugehoerigkeit zu einer Gruppe, die es nicht gibt, waere in der
      // Datei ein Verweis ins Leere. Lieber weglassen als exportieren.
      .filter((gid) => bekannt.has(gid))
      .map((gid) => ({ channelId: channelId(gid), talk: true, listen: true })),
    ...(u.equipmentId ? { equipmentId: u.equipmentId } : {}),
  }))

  return {
    format: INTERCOM_FORMAT,
    version: INTERCOM_FORMAT_VERSION,
    exportedAt: meta?.exportedAt,
    systemName: cfg.systemName,
    description: cfg.description,
    channels,
    stations,
    vendor: {
      greengo: {
        multicastAddress: cfg.multicastAddress,
        sampleRate: cfg.sampleRate,
        groupColors: Object.fromEntries(
          cfg.groups.filter((g) => g.color != null).map((g) => [channelId(g.id), g.color]),
        ),
        userColors: Object.fromEntries(
          cfg.users.filter((u) => u.color != null).map((u) => [stationId(u.id), u.color]),
        ),
      },
    },
    derivedFrom:
      'Green-GO-Konfiguration. Dort ist die Zugehoerigkeit EINE Liste je ' +
      'Sprechstelle; talk und listen sind deshalb beide gesetzt und nicht ' +
      'getrennt gemessen.',
  }
}

/** Ein gelesener Wert, der eine neutrale Intercom-Datei sein soll. */
export const parseIntercomExchange = (text: string): IntercomExchangeFile | null => {
  let roh: unknown
  try {
    roh = JSON.parse(text)
  } catch {
    return null
  }
  const f = roh as Partial<IntercomExchangeFile> | null
  if (!f || typeof f !== 'object') return null
  if (f.format !== INTERCOM_FORMAT) return null
  // Eine ZU NEUE Datei wird abgelehnt statt halb gelesen -- dieselbe Regel wie
  // beim portablen Lager. Aeltere Dateien bleiben lesbar.
  if (typeof f.version !== 'number' || f.version > INTERCOM_FORMAT_VERSION) return null
  if (!Array.isArray(f.channels) || !Array.isArray(f.stations)) return null
  return {
    format: INTERCOM_FORMAT,
    version: f.version,
    exportedAt: typeof f.exportedAt === 'string' ? f.exportedAt : undefined,
    systemName: typeof f.systemName === 'string' ? f.systemName : 'Intercom',
    description: typeof f.description === 'string' ? f.description : undefined,
    channels: f.channels.filter((c): c is IntercomChannel => !!c && typeof c.id === 'string'),
    stations: f.stations.filter((s): s is IntercomStation => !!s && typeof s.id === 'string'),
    vendor: (f.vendor as Record<string, unknown> | undefined) ?? undefined,
    derivedFrom: typeof f.derivedFrom === 'string' ? f.derivedFrom : undefined,
  }
}

interface GreengoVendorBlock {
  multicastAddress?: unknown
  sampleRate?: unknown
  groupColors?: Record<string, unknown>
  userColors?: Record<string, unknown>
}

/**
 * Aus einer neutralen Datei eine Green-GO-Konfiguration bauen.
 *
 * Nummern werden neu vergeben (siehe Kopfkommentar). Der `greengo`-Block unter
 * `vendor` wird gelesen, wenn er da ist -- eine Datei aus einem fremden System
 * hat ihn nicht, und dann greifen die Vorgaben.
 */
export const fromIntercomExchange = (file: IntercomExchangeFile): GreenGoConfig => {
  const v = (file.vendor?.greengo ?? {}) as GreengoVendorBlock
  const gruppenNr = new Map<string, number>()
  const groups: GreenGoGroup[] = file.channels.map((c, i) => {
    gruppenNr.set(c.id, i + 1)
    const farbe = v.groupColors?.[c.id]
    return { id: i + 1, name: c.name, ...(typeof farbe === 'number' ? { color: farbe } : {}) }
  })

  const users: GreenGoUser[] = file.stations.map((s, i) => {
    const farbe = v.userColors?.[s.id]
    return {
      id: i + 1,
      name: s.name,
      ...(s.shortName ? { displayName: s.shortName } : {}),
      ...(typeof farbe === 'number' ? { color: farbe } : {}),
      // Green-GO kennt die Trennung nicht: eine Stelle, die spricht ODER
      // hoert, gehoert zur Gruppe. Das ist Informationsverlust und keine
      // Uebersetzung -- er faellt beim Hin-und-Zurueck nur deshalb nicht auf,
      // weil die Hinrichtung beide Flags setzt.
      groupIds: s.memberships
        .filter((m) => m.talk || m.listen)
        .map((m) => gruppenNr.get(m.channelId))
        .filter((n): n is number => typeof n === 'number'),
      ...(s.equipmentId ? { equipmentId: s.equipmentId } : {}),
    }
  })

  const rate = v.sampleRate === 48000 ? 48000 : 32000
  return {
    systemName: file.systemName,
    description: file.description ?? '',
    multicastAddress:
      typeof v.multicastAddress === 'string' ? v.multicastAddress : '239.1.160.1',
    sampleRate: rate,
    users,
    groups,
  }
}

/** Serialisiert die neutrale Datei als JSON (zwei Leerzeichen, wie das Lager). */
export const serializeIntercomExchange = (file: IntercomExchangeFile): string =>
  JSON.stringify(file, null, 2)
