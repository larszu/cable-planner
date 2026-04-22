import type { CablePlannerProject } from '../types/project'

type OpenProjectResponse = {
  filePath: string
  data: CablePlannerProject
}

type CablePlannerApi = {
  credentials: {
    getToken: () => Promise<string | null>
    saveToken: (token: string) => Promise<boolean>
    deleteToken: () => Promise<boolean>
    testToken: () => Promise<{ ok: boolean; message: string }>
  }
  rentman: {
    getProjects: () => Promise<unknown[]>
    getProjectEquipment: (projectId: string) => Promise<unknown[]>
    getEquipment: () => Promise<unknown[]>
    getEquipmentFolders: () => Promise<unknown[]>
  }
  project: {
    newProject: () => Promise<void>
    openProject: () => Promise<OpenProjectResponse | null>
    saveProject: (project: CablePlannerProject, currentPath?: string) => Promise<string | null>
    saveProjectAs: (project: CablePlannerProject) => Promise<string | null>
    getRecentProjects: () => Promise<string[]>
  }
}

const TOKEN_KEY = 'cable-planner:web:token'
const RECENTS_KEY = 'cable-planner:web:recents'

export const hasDesktopBridge = Boolean(window.cablePlanner)

const loadRecents = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

const saveRecents = (items: string[]) => {
  localStorage.setItem(RECENTS_KEY, JSON.stringify(items.slice(0, 10)))
}

const pushRecent = (item: string) => {
  const next = [item, ...loadRecents().filter((entry) => entry !== item)]
  saveRecents(next)
}

const downloadJson = (project: CablePlannerProject, suggestedFileName: string) => {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedFileName
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Normalise whatever the user pasted into the Rentman token field.
 * JWTs consist strictly of [A-Za-z0-9._-] so we can aggressively strip
 * whitespace, newlines, zero-width/BOM characters, surrounding quotes and
 * a leading "Bearer " / "bearer " prefix that users sometimes include
 * when copying from Rentman's UI.
 */
const normalizeToken = (raw: string | null | undefined): string => {
  if (!raw) return ''
  let t = String(raw)
  // Strip BOM, zero-width and non-breaking spaces that commonly sneak in on paste.
  // eslint-disable-next-line no-control-regex
  t = t.replace(/[\u0000-\u001f\u007f-\u00a0\u2000-\u200f\u2028-\u202f\u205f-\u206f\ufeff]/g, '')
  t = t.trim()
  // Repeatedly strip surrounding quotes and "Bearer " prefixes until stable.
  for (let i = 0; i < 3; i++) {
    const before = t
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      t = t.slice(1, -1).trim()
    }
    if (/^bearer\s+/i.test(t)) {
      t = t.replace(/^bearer\s+/i, '').trim()
    }
    if (t === before) break
  }
  // JWT charset only — discard anything else.
  t = t.replace(/[^A-Za-z0-9._-]/g, '')
  return t
}

const isLikelyJwt = (t: string): boolean => /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t)

const getWebToken = async () => {
  const token = normalizeToken(localStorage.getItem(TOKEN_KEY))
  if (!token) {
    throw new Error('No Rentman token configured. Open Settings and save your token.')
  }
  return token
}

const extractArray = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (Array.isArray(record.data)) return record.data
    if (Array.isArray(record.results)) return record.results
    if (Array.isArray(record.items)) return record.items
    if (record.response && typeof record.response === 'object') {
      const nested = record.response as Record<string, unknown>
      if (Array.isArray(nested.data)) return nested.data
    }
  }
  return []
}

const fetchRentmanJson = async (path: string): Promise<unknown> => {
  const token = await getWebToken()
  if (!isLikelyJwt(token)) {
    throw new Error(
      `Token does not look like a Rentman JWT (expected three dot-separated base64url segments). Length=${token.length}. Open Settings and paste the token again.`,
    )
  }
  const authHeader = `Bearer ${token}`
  const response = await fetch(`/api/rentman${path}`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'follow',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  })

  const text = await response.text()
  if (!response.ok) {
    const preview = `${authHeader.slice(0, 14)}...${authHeader.slice(-6)} (len=${authHeader.length})`
    // Surface what was actually sent so 400/403 become actionable.
    throw new Error(
      `Rentman request failed (${response.status}) on ${path}. Sent: ${preview}. Server said: ${text.slice(0, 500)}`,
    )
  }
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error(`Rentman returned non-JSON response: ${text.slice(0, 200)}`)
  }
}

/**
 * Rentman defaults to a small page size (usually 25). We paginate using
 * `limit` + `offset` until fewer than `limit` rows come back or the hard cap hits.
 */
const fetchRentmanPaginated = async (basePath: string): Promise<unknown[]> => {
  const limit = 300
  const maxTotal = 10_000
  const joiner = basePath.includes('?') ? '&' : '?'
  const all: unknown[] = []
  let offset = 0

  while (all.length < maxTotal) {
    const body = await fetchRentmanJson(`${basePath}${joiner}limit=${limit}&offset=${offset}`)
    const page = extractArray(body)
    all.push(...page)
    if (page.length < limit) break
    offset += limit
  }

  return all
}

const isForbiddenForPath = (error: unknown, path: string): boolean => {
  if (!(error instanceof Error)) return false
  return error.message.includes('Rentman request failed (403)') && error.message.includes(`on ${path}`)
}

const webFallbackApi: CablePlannerApi = {
  credentials: {
    getToken: async () => {
      const stored = localStorage.getItem(TOKEN_KEY)
      return stored ? normalizeToken(stored) : null
    },
    saveToken: async (token: string) => {
      const clean = normalizeToken(token)
      if (!clean) {
        localStorage.removeItem(TOKEN_KEY)
        return true
      }
      localStorage.setItem(TOKEN_KEY, clean)
      return true
    },
    deleteToken: async () => {
      localStorage.removeItem(TOKEN_KEY)
      return true
    },
    testToken: async () => {
      try {
        const body = await fetchRentmanJson('/projects?limit=1')
        const arr = extractArray(body)
        return {
          ok: true,
          message: `Rentman token works. Example result count in first page: ${arr.length}.`,
        }
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : 'Token test failed.',
        }
      }
    },
  },
  rentman: {
    getProjects: () => fetchRentmanPaginated('/projects'),
    getProjectEquipment: (projectId: string) =>
      fetchRentmanPaginated(`/projects/${encodeURIComponent(projectId)}/projectequipment`),
    getEquipment: () => fetchRentmanPaginated('/equipment'),
    getEquipmentFolders: async () => {
      try {
        return await fetchRentmanPaginated('/equipmentfolders')
      } catch (error) {
        // Some Rentman API keys can read equipment but not equipmentfolders.
        // Degrade gracefully so import still works with uncategorized fallback.
        if (isForbiddenForPath(error, '/equipmentfolders')) {
          return []
        }
        throw error
      }
    },
  },
  project: {
    newProject: async () => {},
    openProject: async () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json,application/json'

      return await new Promise<OpenProjectResponse | null>((resolve) => {
        input.onchange = async () => {
          const file = input.files?.[0]
          if (!file) {
            resolve(null)
            return
          }

          try {
            const text = await file.text()
            const data = JSON.parse(text) as CablePlannerProject
            pushRecent(file.name)
            resolve({ filePath: file.name, data })
          } catch {
            resolve(null)
          }
        }
        input.click()
      })
    },
    saveProject: async (project: CablePlannerProject, currentPath?: string) => {
      const fileName = currentPath || `${project.metadata.name || 'project'}.json`
      downloadJson(project, fileName)
      pushRecent(fileName)
      return fileName
    },
    saveProjectAs: async (project: CablePlannerProject) => {
      const fileName = `${project.metadata.name || 'project'}.json`
      downloadJson(project, fileName)
      pushRecent(fileName)
      return fileName
    },
    getRecentProjects: async () => loadRecents(),
  },
}

export const cablePlannerApi: CablePlannerApi =
  (window.cablePlanner as CablePlannerApi | undefined) ?? webFallbackApi
