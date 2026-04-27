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
    while (true) {
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
    /**
     * Add a master-catalog equipment item to a Rentman project.
     * The Rentman v2 schema for /projectequipment expects `equipment`,
     * `project` and `quantity` fields. Returns the API response so the UI
     * can surface the new project-equipment id and any server-side defaults.
     */
    async addProjectEquipment(
      projectId: string,
      equipmentId: string,
      quantity: number = 1,
    ) {
      const response = await client.post('/projectequipment', {
        equipment: equipmentId,
        project: projectId,
        quantity,
      })
      return response.data
    },
    /**
     * Upload a file (e.g. an exported PDF plan) and attach it to a Rentman
     * project. Per the Rentman OpenAPI spec, files live under `/files` and
     * the link to the parent item (in our case the project) is expressed via
     * the `item` (id) and `itemtype` ("project") fields.
     *
     * `fileBytes` must be the raw bytes of the file. We send it as
     * multipart/form-data with the conventional `file` field name plus the
     * required `name`, `item` and `itemtype` metadata.
     */
    async addProjectFile(
      projectId: string,
      fileName: string,
      fileBytes: Uint8Array,
      mimeType: string = 'application/pdf',
    ) {
      // FormData is available in Node 18+ which Electron 41 ships with.
      const form = new FormData()
      const blob = new Blob([fileBytes], { type: mimeType })
      form.append('file', blob, fileName)
      form.append('name', fileName)
      form.append('item', projectId)
      form.append('itemtype', 'project')
      // IMPORTANT: do NOT set Content-Type manually — axios 1.x autogenerates
      // `multipart/form-data; boundary=...` from the FormData instance.
      // Forcing the header strips the boundary and Rentman replies with
      // "invalid key value pair missing equal sign".
      const response = await client.post('/files', form, {
        maxContentLength: 50 * 1024 * 1024,
        maxBodyLength: 50 * 1024 * 1024,
      })
      return response.data
    },
  }
}
