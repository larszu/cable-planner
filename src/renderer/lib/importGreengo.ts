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
 * Given imported users and canvas equipment, try to auto-assign an equipmentId
 * to each user by fuzzy name matching.
 *
 * Matching strategy (first match wins):
 *  1. Device type in user name matches device type in equipment name (e.g. both contain 'bpx')
 *     AND a numeric suffix matches (e.g. "BPX1" → "GreenGo BPX 1")
 *  2. Device type matches AND no numeric conflict (assign the first unassigned of that type)
 */
export const autoMatchEquipment = (
  users: GreenGoUser[],
  equipment: EquipmentItem[],
): Map<number, string> => {
  const result = new Map<number, string>()
  const usedEquipmentIds = new Set<string>()

  for (const user of users) {
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

  return result
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
  }
}
