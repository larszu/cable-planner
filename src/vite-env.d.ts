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
      }
      project: {
        newProject: () => Promise<void>
        openProject: () => Promise<unknown | null>
        saveProject: (project: unknown, currentPath?: string) => Promise<string | null>
        saveProjectAs: (project: unknown) => Promise<string | null>
        getRecentProjects: () => Promise<string[]>
      }
    }
  }
}

export {}
