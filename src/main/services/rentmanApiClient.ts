import axios from 'axios'

const BASE_URL = 'https://api.rentman.net'

const normalize = <T>(value: unknown): T => {
  if (Array.isArray(value)) {
    return value as T
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>

    if (Array.isArray(record.data)) {
      return record.data as T
    }

    if (Array.isArray(record.results)) {
      return record.results as T
    }

    if (Array.isArray(record.items)) {
      return record.items as T
    }

    if (record.response && typeof record.response === 'object') {
      const nested = record.response as Record<string, unknown>
      if (Array.isArray(nested.data)) {
        return nested.data as T
      }
    }
  }

  return value as T
}

export const createRentmanApiClient = (token: string) => {
  const client = axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    timeout: 30000,
  })

  /** Fetch all pages of a paginated Rentman endpoint. */
  const fetchAll = async (path: string): Promise<unknown[]> => {
    const PAGE_SIZE = 300
    const all: unknown[] = []
    let offset = 0
    // Safety cap to avoid runaway loops (10 000 items is far more than any
    // real Rentman account will have).
    const MAX = 10_000
    while (all.length < MAX) {
      const sep = path.includes('?') ? '&' : '?'
      const response = await client.get(`${path}${sep}limit=${PAGE_SIZE}&offset=${offset}`)
      const page = normalize<unknown[]>(response.data)
      all.push(...page)
      if (page.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }
    return all
  }

  return {
    async getProjects() {
      return fetchAll('/projects')
    },
    async getProjectEquipment(projectId: string) {
      return fetchAll(`/projects/${encodeURIComponent(projectId)}/projectequipment`)
    },
    async getEquipment() {
      return fetchAll('/equipment')
    },
    async getEquipmentFolders() {
      try {
        return await fetchAll('/equipmentfolders')
      } catch (error) {
        // Token may lack permission for equipmentfolders; degrade gracefully.
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          return [] as unknown[]
        }
        throw error
      }
    },
  }
}
