/**
 * Parser for GreenGo .gg5 configuration files.
 *
 * A .gg5 file is a JSON document with the following top-level keys:
 *   Settings, Users, Groups, Devices, Rooms, Templates, …
 *
 * This module extracts Users and Groups and converts them into the
 * cable-planner GreenGoConfig format.
 */

import type { GreenGoConfig, GreenGoGroup, GreenGoUser } from '../types/greengo'
import { translate } from './i18n'
import { useUiStore } from '../store/uiStore'

const tr = (key: string, fallback: string) =>
  translate(useUiStore.getState().language, key, fallback)

// ── Result types ─────────────────────────────────────────────────────────────

export interface Gg5ImportResult {
  /** The parsed config, ready to be adopted or merged. */
  config: GreenGoConfig
  /**
   * Auto-detected device type hint per user ID (e.g. 'BPX', 'WBPX', …).
   * Derived from the user's Name in the .gg5 file.
   */
  userTypeHints: Map<number, string>
  /**
   * ADR-005 — Sektionen, die in der Datei stehen und die dieses Modul NICHT
   * liest (Devices, Rooms, Templates …).
   *
   * Das ist keine Kosmetik: der Exporter schreibt eine vollstaendige .gg5 und
   * fuellt genau diese Sektionen aus hartkodierten Defaults. Wer eine echte
   * Anlagen-Konfiguration importiert, etwas aendert und wieder exportiert,
   * bekommt sie leer zurueck. Bis der Round-Trip sie bewahrt, muss er wenigstens
   * sagen, was er nicht gelesen hat — schweigen ist der Schaden.
   */
  unreadSections: string[]
  /**
   * ADR-005 — was INNERHALB von Settings/Users/Groups ungelesen bleibt.
   * `unreadSections` allein sagte nur, welche Top-Level-Sektionen fehlen,
   * und liess den Nutzer glauben, der Rest sei uebernommen.
   */
  unreadFields: UnreadFieldReport[]
}

export interface Gg5ParseError {
  error: string
}

export type Gg5ParseOutcome = Gg5ImportResult | Gg5ParseError

export const isParseError = (r: Gg5ParseOutcome): r is Gg5ParseError =>
  'error' in r

// ── Device type auto-detection ───────────────────────────────────────────────

/** Guess GreenGo device type from a user/station name (e.g. "TWBPX1" → "WBPX"). */
export const detectDeviceType = (name: string): string => {
  const n = name.toLowerCase()
  if (/mcxd/.test(n)) return 'MCXD'
  if (/mcx/.test(n)) return 'MCX'
  if (/wbpx/.test(n)) return 'WBPX'
  if (/bpxsp/.test(n)) return 'BPXSP'
  if (/bpx/.test(n)) return 'BPX'
  if (/xtbd/.test(n)) return 'XTBD'
  if (/xtbb/.test(n)) return 'XTBB'
  if (/antenna/.test(n)) return 'ANT'
  return ''
}

// ── Auto-match import users to canvas equipment ───────────────────────────────

interface EquipmentItem {
  id: string
  name: string
  category?: string
}

/**
 * ADR-005, Regel 2 — was die Datei nicht sagt, darf sie nicht loeschen.
 *
 * Die Zuordnung Station → Canvas-Geraet ist cable-planner-Wissen; in der .gg5
 * steht sie NICHT. Trotzdem hat der Import sie bisher jedes Mal neu geraten
 * und die von Hand gesetzten Verknuepfungen ueberschrieben: der Intercom-
 * Techniker schickt eine korrigierte Matrix, der Nutzer importiert sie, und
 * die 24 Zuordnungen, die er vorher einzeln gesetzt hat, sind wieder Ratewerk.
 *
 * Deshalb nimmt der Abgleich jetzt den VORHANDENEN Stand mit und behaelt die
 * Verknuepfung, wo dieselbe Slot-Nummer denselben Stations-Namen traegt — das
 * ist dieselbe Station im selben Slot, also dasselbe Geraet. Aendert sich der
 * Name, ist der Slot moeglicherweise umgewidmet; dann wird geraten und das
 * gemeldet.
 *
 * Der Bericht ist Teil der Zusage (Regel 3): der Nutzer muss sehen, was
 * uebernommen und was geraten wurde, sonst ist der Unterschied unsichtbar.
 */
export interface EquipmentMatchReport {
  /** userId → equipmentId. */
  mapping: Map<number, string>
  /** Slots, deren von Hand gesetzte Verknuepfung erhalten blieb. */
  kept: number[]
  /** Slots mit vorheriger Verknuepfung, deren Name sich geaendert hat — neu geraten. */
  renamed: number[]
  /** Slots, deren vorheriges Geraet es im Plan nicht mehr gibt — neu geraten. */
  stale: number[]
}

/**
 * Given imported users and canvas equipment, try to auto-assign an equipmentId
 * to each user by fuzzy name matching.
 *
 * Matching strategy (first match wins):
 *  0. Eine vorhandene, von Hand gesetzte Verknuepfung derselben Station
 *     (gleiche Slot-Nummer, gleicher Name, Geraet existiert noch) gewinnt.
 *  1. Device type in user name matches device type in equipment name (e.g. both contain 'bpx')
 *     AND a numeric suffix matches (e.g. "BPX1" → "GreenGo BPX 1")
 *  2. Device type matches AND no numeric conflict (assign the first unassigned of that type)
 */
export const autoMatchEquipment = (
  users: GreenGoUser[],
  equipment: EquipmentItem[],
  existing: GreenGoUser[] = [],
): EquipmentMatchReport => {
  const result = new Map<number, string>()
  const usedEquipmentIds = new Set<string>()
  const kept: number[] = []
  const renamed: number[] = []
  const stale: number[] = []

  const equipmentIds = new Set(equipment.map((e) => e.id))
  const previousById = new Map(existing.map((u) => [u.id, u]))

  // Schritt 0 — vorhandene Verknuepfungen zuerst, damit sie die Geraete
  // belegen, bevor geraten wird. Sonst schnappt der Rateweg ein Geraet weg,
  // das schon von Hand vergeben war.
  for (const user of users) {
    const prev = previousById.get(user.id)
    if (!prev?.equipmentId) continue
    if (prev.name !== user.name) {
      renamed.push(user.id)
      continue
    }
    if (!equipmentIds.has(prev.equipmentId)) {
      stale.push(user.id)
      continue
    }
    result.set(user.id, prev.equipmentId)
    usedEquipmentIds.add(prev.equipmentId)
    kept.push(user.id)
  }

  for (const user of users) {
    if (result.has(user.id)) continue
    const userType = detectDeviceType(user.name).toLowerCase()
    if (!userType) continue

    // Extract trailing number from user name, e.g. "BPX1" → 1, "TWBPX2" → 2
    const numMatch = user.name.match(/(\d+)\s*$/)
    const userNum = numMatch ? parseInt(numMatch[1], 10) : null

    // Filter canvas equipment of matching type
    const candidates = equipment.filter(
      (e) =>
        e.name.toLowerCase().includes(userType) ||
        e.category?.toLowerCase().includes(userType),
    )

    // Try to match by number first
    if (userNum !== null) {
      const numbered = candidates.find((e) => {
        const eNumMatch = e.name.match(/(\d+)\s*$/)
        return eNumMatch && parseInt(eNumMatch[1], 10) === userNum && !usedEquipmentIds.has(e.id)
      })
      if (numbered) {
        result.set(user.id, numbered.id)
        usedEquipmentIds.add(numbered.id)
        continue
      }
    }

    // Fall back: first unassigned candidate of that type
    const fallback = candidates.find((e) => !usedEquipmentIds.has(e.id))
    if (fallback) {
      result.set(user.id, fallback.id)
      usedEquipmentIds.add(fallback.id)
    }
  }

  return { mapping: result, kept, renamed, stale }
}

// ── Main parser ───────────────────────────────────────────────────────────────

/**
 * Parse a .gg5 JSON string and return a GreenGoConfig (or an error).
 *
 * Groups' member lists are used to build `user.groupIds`. If a .gg5 has
 * no member data in groups, the button-function map on each user is used
 * as a fallback.
 */
export const parseGg5File = (jsonText: string): Gg5ParseOutcome => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let raw: Record<string, any>
  try {
    raw = JSON.parse(jsonText)
  } catch {
    return { error: tr('importGg5.invalidJson', 'Keine gültige JSON-Datei.') }
  }

  if (typeof raw !== 'object' || raw === null) {
    return { error: tr('importGg5.invalidFormat', 'Ungültiges .gg5-Format (kein Objekt).') }
  }

  // ── Settings ────────────────────────────────────────────────────────────────
  const settings = raw['Settings'] ?? {}
  const systemName =
    typeof settings['Name'] === 'string' && settings['Name']
      ? settings['Name']
      : 'Importiert'
  const description =
    typeof settings['Description'] === 'string' ? settings['Description'] : ''
  const multicastAddress =
    typeof settings['MulticastAddress'] === 'string'
      ? settings['MulticastAddress']
      : '239.1.160.1'
  const sampleRate: 32000 | 48000 =
    settings['SampleRate'] === 48000 ? 48000 : 32000

  // ── Groups ──────────────────────────────────────────────────────────────────
  const groupsRaw = raw['Groups'] ?? {}
  const groupKeys: string[] = Array.isArray(groupsRaw['keys'])
    ? (groupsRaw['keys'] as string[])
    : []

  const groups: GreenGoGroup[] = []
  // Map: userId → set of groupIds (built from group member lists)
  const userGroupMap = new Map<number, Set<number>>()

  for (const gKey of groupKeys) {
    const g = groupsRaw[gKey]
    if (!g || typeof g !== 'object') continue

    const id = Number(g['myId'] ?? gKey)
    if (isNaN(id)) continue

    const name =
      typeof g['Name'] === 'string' && g['Name'] ? g['Name'] : `Gruppe ${id}`
    const color = typeof g['Color'] === 'number' ? g['Color'] : undefined
    groups.push({ id, name, ...(color !== undefined ? { color } : {}) })

    // Extract members
    const members = g['members']
    if (members && typeof members === 'object') {
      for (const m of Object.values(members) as Record<string, unknown>[]) {
        const userId = Number(m['id'])
        if (!isNaN(userId)) {
          if (!userGroupMap.has(userId)) userGroupMap.set(userId, new Set())
          userGroupMap.get(userId)!.add(id)
        }
      }
    }
  }

  // ── Users ───────────────────────────────────────────────────────────────────
  const usersRaw = raw['Users'] ?? {}
  const userKeys: string[] = Array.isArray(usersRaw['keys'])
    ? (usersRaw['keys'] as string[])
    : []

  const users: GreenGoUser[] = []
  const userTypeHints = new Map<number, string>()

  for (const uKey of userKeys) {
    const u = usersRaw[uKey]
    if (!u || typeof u !== 'object') continue

    const id = Number(u['myId'] ?? uKey)
    if (isNaN(id)) continue

    const name =
      typeof u['Name'] === 'string' && u['Name'] ? u['Name'] : `Station ${id}`
    const displayName =
      typeof u['DisplayName'] === 'string' && u['DisplayName']
        ? u['DisplayName']
        : undefined
    const color = typeof u['Color'] === 'number' ? u['Color'] : undefined

    // Group IDs from the membership map (built from groups)
    let groupIds = Array.from(userGroupMap.get(id) ?? [])

    // Fallback: parse button functions if membership map empty
    if (groupIds.length === 0) {
      const bf = u['ButtonFunctions']
      if (bf && typeof bf === 'object') {
        const page1 = (bf['1'] ?? {}) as Record<string, unknown>
        for (const v of Object.values(page1)) {
          const gid = Number(v)
          if (!isNaN(gid) && gid > 0) groupIds.push(gid)
        }
        groupIds = [...new Set(groupIds)]
      }
    }

    users.push({
      id,
      name,
      ...(displayName ? { displayName } : {}),
      ...(color !== undefined ? { color } : {}),
      groupIds,
    })

    const hint = detectDeviceType(name)
    if (hint) userTypeHints.set(id, hint)
  }

  if (users.length === 0 && groups.length === 0) {
    return {
      error: tr(
        'importGg5.emptyFile',
        'Keine Benutzer oder Gruppen in der Datei gefunden. Ist es eine gültige GreenGo 5.x .gg5-Datei?',
      ),
    }
  }

  return {
    config: {
      systemName,
      description,
      multicastAddress,
      sampleRate,
      users,
      groups,
    },
    userTypeHints,
    unreadSections: unreadTopLevelSections(raw),
    unreadFields: unreadFieldsInReadSections(raw),
  }
}

/** Von diesem Modul gelesene Sektionen einer .gg5. Alles andere ist ungelesen. */
const READ_SECTIONS = new Set(['Settings', 'Users', 'Groups'])

/**
 * ADR-005, Inkrement 4 — die Felder, die dieses Modul INNERHALB der gelesenen
 * Sektionen anfasst.
 *
 * Warum das eine eigene Ebene braucht: `unreadTopLevelSections` konnte per
 * Konstruktion nie etwas melden, was unter Settings/Users/Groups liegt — die
 * drei stehen ja in READ_SECTIONS. Der Nutzer las im Hinweis „Devices, Rooms,
 * Templates" und schloss daraus, seine Stationen seien gelesen worden.
 *
 * Waren sie nicht. Pro Station liest der Parser fuenf Felder; der Exporter
 * schreibt den Rest aus Konstanten zurueck (exportGreengo.buildUser):
 * `devices: []` (die Hardware-Registrierung), `Channels`/`SpecialChannels`
 * leer (die Tastenbelegungen), `Security.Pincode` leer, `AudioProfile` auf
 * Standard-Gain. Auf einer Intercom-Anlage ist das der halbe Einmessvorgang.
 *
 * Wie oben gilt: aus dem Rohdokument ableiten, nicht aus einer zweiten
 * gepflegten Liste — sonst laeuft sie von den Lesemengen auseinander, sobald
 * der Parser ein Feld dazubekommt.
 */
const READ_SETTINGS_FIELDS = new Set(['Name', 'Description', 'MulticastAddress', 'SampleRate'])
const READ_USER_FIELDS = new Set(['myId', 'Name', 'DisplayName', 'Color', 'ButtonFunctions'])
const READ_GROUP_FIELDS = new Set(['myId', 'Name', 'Color', 'members'])

/** Ungelesene Felder einer Sektion, plus wie viele Eintraege betroffen sind. */
export interface UnreadFieldReport {
  section: 'Settings' | 'Users' | 'Groups'
  /** Feldnamen, die in der Datei stehen und hier niemand liest. */
  fields: string[]
  /** Betroffene Eintraege — bei Settings immer 1. */
  entries: number
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/** Vereinigung der ungelesenen Feldnamen ueber alle Eintraege einer Sektion. */
const unreadFieldsOf = (
  section: UnreadFieldReport['section'],
  entries: Record<string, unknown>[],
  read: Set<string>,
): UnreadFieldReport | null => {
  const fields = new Set<string>()
  let affected = 0
  for (const entry of entries) {
    const own = Object.keys(entry).filter((k) => !read.has(k))
    if (own.length === 0) continue
    affected++
    for (const k of own) fields.add(k)
  }
  if (fields.size === 0) return null
  return { section, fields: [...fields].sort(), entries: affected }
}

/** Eintraege einer keys-indizierten Sektion (Users/Groups) als Objekte. */
const keyedEntries = (raw: Record<string, unknown>): Record<string, unknown>[] => {
  const keys = Array.isArray(raw['keys']) ? (raw['keys'] as string[]) : []
  return keys.map((k) => raw[k]).filter(isRecord)
}

/**
 * Der Verlust EINE EBENE TIEFER als `unreadTopLevelSections`. Zusammen decken
 * die beiden ab, was der Import fallen laesst; einzeln taeuscht die obere.
 */
const unreadFieldsInReadSections = (raw: Record<string, unknown>): UnreadFieldReport[] => {
  const out: UnreadFieldReport[] = []
  const settings = raw['Settings']
  if (isRecord(settings)) {
    const r = unreadFieldsOf('Settings', [settings], READ_SETTINGS_FIELDS)
    if (r) out.push(r)
  }
  const users = raw['Users']
  if (isRecord(users)) {
    const r = unreadFieldsOf('Users', keyedEntries(users), READ_USER_FIELDS)
    if (r) out.push(r)
  }
  const groups = raw['Groups']
  if (isRecord(groups)) {
    const r = unreadFieldsOf('Groups', keyedEntries(groups), READ_GROUP_FIELDS)
    if (r) out.push(r)
  }
  return out
}

/**
 * ADR-005 — Welche Sektionen die Datei mitbringt, die hier niemand anfasst.
 *
 * Bewusst aus dem Rohdokument abgeleitet und nicht aus einer gepflegten Liste:
 * eine zweite Liste wuerde von READ_SECTIONS auseinanderlaufen, sobald der
 * Parser eine Sektion dazubekommt.
 */
const unreadTopLevelSections = (raw: Record<string, unknown>): string[] =>
  Object.keys(raw)
    .filter((k) => !READ_SECTIONS.has(k))
    .sort()
