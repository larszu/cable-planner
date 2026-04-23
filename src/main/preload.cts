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
  atem: {
    connect: (ip: string) => ipcRenderer.invoke('atem:connect', ip) as Promise<unknown>,
    disconnect: () => ipcRenderer.invoke('atem:disconnect') as Promise<{ ok: boolean }>,
    getState: () => ipcRenderer.invoke('atem:state') as Promise<unknown | null>,
    setInputName: (payload: { inputId: number; longName: string; shortName: string }) =>
      ipcRenderer.invoke('atem:set-input-name', payload) as Promise<{ ok: boolean }>,
    bulkSetInputNames: (payload: {
      entries: { inputId: number; longName: string; shortName: string }[]
    }) => ipcRenderer.invoke('atem:bulk-set-input-names', payload) as Promise<{ count: number }>,
    getEvents: () => ipcRenderer.invoke('atem:get-events') as Promise<string[]>,
    getStatus: () =>
      ipcRenderer.invoke('atem:get-status') as Promise<{ connected: boolean; ip: string | null }>,
    applyMvConfig: (config: unknown) =>
      ipcRenderer.invoke('atem:apply-mv-config', config) as Promise<{ applied: number }>,
    onEvent: (cb: (line: string) => void) => {
      const listener = (_event: unknown, line: string) => cb(line)
      ipcRenderer.on('atem:event', listener)
      return () => ipcRenderer.removeListener('atem:event', listener)
    },
  },
})
