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
    addProjectEquipment: (projectId: string, equipmentId: string, quantity?: number) =>
      ipcRenderer.invoke('rentman:add-project-equipment', projectId, equipmentId, quantity) as Promise<unknown>,
    addProjectFile: (
      projectId: string,
      fileName: string,
      fileBytes: Uint8Array,
      mimeType?: string,
    ) =>
      ipcRenderer.invoke(
        'rentman:add-project-file',
        projectId,
        fileName,
        fileBytes,
        mimeType,
      ) as Promise<unknown>,
  },
  graphml: {
    openFile: () =>
      ipcRenderer.invoke('graphml:open-file') as Promise<{
        filePath: string
        fileName: string
        xml: string
      } | null>,
  },
  project: {
    newProject: () => ipcRenderer.invoke('project:new') as Promise<void>,
    openProject: () => ipcRenderer.invoke('project:open') as Promise<unknown | null>,
    saveProject: (project: unknown, currentPath?: string) =>
      ipcRenderer.invoke('project:save', project, currentPath) as Promise<string | null>,
    saveProjectAs: (project: unknown) => ipcRenderer.invoke('project:save-as', project) as Promise<string | null>,
    getRecentProjects: () => ipcRenderer.invoke('project:get-recent') as Promise<string[]>,
    // v7.9.3 — Viewer-File Export + Annotations-Re-Import.
    exportViewer: (project: unknown) =>
      ipcRenderer.invoke('project:export-viewer', project) as Promise<string | null>,
    importAnnotations: () =>
      ipcRenderer.invoke('project:import-annotations') as Promise<
        { filePath: string; annotations: unknown[] } | null
      >,
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
    /** v7.9.52 — Liest Live-Audio-State (Fairlight Matrix + Classic Mixer
     *  + Input-Labels) als AtemAudioConfig vom verbundenen ATEM. */
    readAudioConfig: () =>
      ipcRenderer.invoke('atem:read-audio-config') as Promise<{
        matrix?: { sources: Array<{ id: number; name: string }>; outputs: Array<{ id: number; sourceId: number; name: string }> }
        classicMixer?: unknown
        inputLabels?: Record<number, { shortName: string; longName: string; externalPortType?: string }>
      } | null>,
    /** v7.9.52 — Push einer kompletten oder partiellen AtemAudioConfig
     *  zurück an den verbundenen ATEM. Zählt erfolgreich gesendete
     *  Commands pro Sektion. */
    applyAudioConfig: (config: unknown) =>
      ipcRenderer.invoke('atem:apply-audio-config', config) as Promise<{
        matrixApplied: number
        classicApplied: number
        labelsApplied: number
      }>,
    onEvent: (cb: (line: string) => void) => {
      const listener = (_event: unknown, line: string) => cb(line)
      ipcRenderer.on('atem:event', listener)
      return () => ipcRenderer.removeListener('atem:event', listener)
    },
    /** v7.9.53 — mDNS-Auto-Discovery für ATEM-Switcher. Liefert nach
     *  timeoutMs (Default 3000) eine Liste aller _blackmagic._tcp-Services
     *  im lokalen Netzwerk. */
    discover: (params?: { timeoutMs?: number }) =>
      ipcRenderer.invoke('atem:discover', params) as Promise<
        Array<{ name: string; ip: string; port: number; model?: string }>
      >,
  },
  videohub: {
    sendRouting: (params: { host: string; port: number; block: string }) =>
      ipcRenderer.invoke('videohub:send', params) as Promise<{ ok: boolean; message: string }>,
  },
  logs: {
    rendererError: (payload: { message: string; stack?: string; source?: string }) =>
      ipcRenderer.send('logs:renderer-error', payload),
  },
  sync: {
    readFile: (filePath: string) =>
      ipcRenderer.invoke('sync:read-file', filePath) as Promise<string>,
    writeFile: (filePath: string, data: string) =>
      ipcRenderer.invoke('sync:write-file', filePath, data) as Promise<void>,
    exists: (filePath: string) =>
      ipcRenderer.invoke('sync:exists', filePath) as Promise<boolean>,
    acquireLock: (dirPath: string, owner: string) =>
      ipcRenderer.invoke('sync:acquire-lock', dirPath, owner) as Promise<{
        ok: boolean
        lockedBy?: string
      }>,
    releaseLock: (dirPath: string, owner: string) =>
      ipcRenderer.invoke('sync:release-lock', dirPath, owner) as Promise<void>,
  },
  print: {
    /** v7.9.27 — PDF-Bytes ans Main schicken, das öffnet die in einer
     *  Hidden-BrowserWindow und ruft webContents.print(). Robuster als
     *  iframe.contentWindow.print() das Microsoft-Print-to-PDF in
     *  manchen Fällen kaputte Dateien schreiben lässt. */
    pdfBytes: (bytes: Uint8Array) =>
      ipcRenderer.invoke('print:pdf-bytes', bytes) as Promise<boolean>,
  },
  library: {
    /** v7.9.33 — Zentraler Library-Ordner (userData/library/). Jedes
     *  Gerät/Gruppe liegt als eigene Datei (.cpdevice/.cpgroup); damit
     *  überleben sie App-Reinstalls und können per Dropbox o.ä. synchron
     *  zwischen Systemen gehalten werden. */
    getFolderPath: () =>
      ipcRenderer.invoke('library:get-folder-path') as Promise<string>,
    revealFolder: () =>
      ipcRenderer.invoke('library:reveal-folder') as Promise<string>,
    scan: () =>
      ipcRenderer.invoke('library:scan') as Promise<
        Array<{
          kind: 'device' | 'group'
          fileName: string
          fileVersion: number
          modifiedAt: string
          payload: unknown
        }>
      >,
    write: (params: { kind: 'device' | 'group'; name: string; payload: unknown }) =>
      ipcRenderer.invoke('library:write', params) as Promise<{
        fileName: string
        fileVersion: number
        modifiedAt: string
      }>,
    deleteItem: (params: { kind: 'device' | 'group'; name: string }) =>
      ipcRenderer.invoke('library:delete', params) as Promise<boolean>,
  },
  mobileShare: {
    start: () =>
      ipcRenderer.invoke('mobileShare:start') as Promise<{
        port: number
        urls: string[]
        hasProject: boolean
      }>,
    stop: () => ipcRenderer.invoke('mobileShare:stop') as Promise<{ ok: boolean }>,
    status: () =>
      ipcRenderer.invoke('mobileShare:status') as Promise<{
        running: boolean
        port: number
        urls: string[]
        hasProject: boolean
      }>,
    setProject: (project: unknown) =>
      ipcRenderer.invoke('mobileShare:setProject', project) as Promise<{ ok: boolean }>,
    // v7.9.3 — Subscriber für Mobile-Check-State-Updates. Main schickt
    // 'mobileShare:checksUpdate' wenn POST /checks reinkommt; Renderer
    // updated daraufhin project.checkState im Store.
    onChecksUpdate: (
      cb: (checks: { ports: Record<string, boolean>; cables: Record<string, boolean> }) => void,
    ) => {
      const listener = (
        _event: unknown,
        checks: { ports: Record<string, boolean>; cables: Record<string, boolean> },
      ) => cb(checks)
      ipcRenderer.on('mobileShare:checksUpdate', listener)
      return () => ipcRenderer.removeListener('mobileShare:checksUpdate', listener)
    },
  },
})
