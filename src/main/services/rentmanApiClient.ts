import axios from 'axios'

const BASE_URL = 'https://api.rentman.net'

const normalize = <T>(value: unknown): T => {
  if (Array.isArray(value)) {
    return value as T
  }

  if (value && typeof value === 'object' && 'data' in value) {
    return (value as { data: T }).data
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
      const response = await client.get('/projectequipment', {
        params: {
          project: `/projects/${projectId}`,
        },
      })
      return normalize<unknown[]>(response.data)
    },
    async getEquipment() {
      const response = await client.get('/equipment')
      return normalize<unknown[]>(response.data)
    },
    async getEquipmentFolders() {
      const response = await client.get('/equipmentfolders')
      return normalize<unknown[]>(response.data)
    },
  }
}
