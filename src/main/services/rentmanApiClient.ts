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
    timeout: 15000,
  })

  return {
    async getProjects() {
      const response = await client.get('/projects')
      return normalize<unknown[]>(response.data)
    },
    async getProjectEquipment(projectId: string) {
      const response = await client.get(`/projects/${encodeURIComponent(projectId)}/projectequipment`)
      return normalize<unknown[]>(response.data)
    },
    async getEquipment() {
      const response = await client.get('/equipment')
      return normalize<unknown[]>(response.data)
    },
    async getEquipmentFolders() {
      try {
        const response = await client.get('/equipmentfolders')
        return normalize<unknown[]>(response.data)
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
