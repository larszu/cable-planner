import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('cablePlanner', {
  credentials: {
    getToken: () => ipcRenderer.invoke('credentials:get-token') as Promise<string | null>,
    saveToken: (token: string) => ipcRenderer.invoke('credentials:save-token', token) as Promise<boolean>,
    deleteToken: () => ipcRenderer.invoke('credentials:delete-token') as Promise<boolean>,
    testToken: () =>
      ipcRenderer.invoke('credentials:test-token') as Promise<{
        ok: boolean
        message: string
      }>,
  },
  rentman: {
    getProjects: () => ipcRenderer.invoke('rentman:get-projects') as Promise<unknown[]>,
    getProjectEquipment: (projectId: string) =>
      ipcRenderer.invoke('rentman:get-project-equipment', projectId) as Promise<unknown[]>,
    getEquipment: () => ipcRenderer.invoke('rentman:get-equipment') as Promise<unknown[]>,
    getEquipmentFolders: () => ipcRenderer.invoke('rentman:get-equipment-folders') as Promise<unknown[]>,
  },
  project: {
    newProject: () => ipcRenderer.invoke('project:new') as Promise<void>,
    openProject: () => ipcRenderer.invoke('project:open') as Promise<unknown | null>,
    saveProject: (project: unknown, currentPath?: string) =>
      ipcRenderer.invoke('project:save', project, currentPath) as Promise<string | null>,
    saveProjectAs: (project: unknown) => ipcRenderer.invoke('project:save-as', project) as Promise<string | null>,
    getRecentProjects: () => ipcRenderer.invoke('project:get-recent') as Promise<string[]>,
  },
})
