/// <reference types="vite/client" />

declare global {
  interface Window {
    cablePlanner?: {
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
        addProjectEquipment: (
          projectId: string,
          equipmentId: string,
          quantity?: number,
        ) => Promise<unknown>
        addProjectFile: (
          projectId: string,
          fileName: string,
          fileBytes: Uint8Array,
          mimeType?: string,
        ) => Promise<unknown>
      }
      project: {
        newProject: () => Promise<void>
        openProject: () => Promise<unknown | null>
        saveProject: (project: unknown, currentPath?: string) => Promise<string | null>
        saveProjectAs: (project: unknown) => Promise<string | null>
        getRecentProjects: () => Promise<string[]>
      }
      videohub: {
        sendRouting: (params: { host: string; port: number; block: string }) => Promise<{ ok: boolean; message: string }>
      }
      sync: {
        readFile: (filePath: string) => Promise<string>
        writeFile: (filePath: string, data: string) => Promise<void>
        exists: (filePath: string) => Promise<boolean>
        acquireLock: (dirPath: string, owner: string) => Promise<{ ok: boolean; lockedBy?: string }>
        releaseLock: (dirPath: string, owner: string) => Promise<void>
      }
    }
  }
}

export {}
