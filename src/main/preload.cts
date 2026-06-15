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
    /** v7.9.110 — Batch-Export in eine 'CablePlanner'-EquipmentGroup im
     *  Rentman-Projekt. Gruppe wird angelegt falls nicht vorhanden,
     *  sonst wiederverwendet. */
    exportToCablePlannerGroup: (
      projectId: string,
      items: Array<{ equipmentId: string; quantity: number }>,
    ) =>
      ipcRenderer.invoke('rentman:export-to-cableplanner-group', projectId, items) as Promise<{
        added: number
        failed: Array<{ equipmentId: string; quantity: number; error: string }>
        groupId: string | null
        groupCreated: boolean
        subprojectId: string | null
      }>,
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
    // #pre-sale — Datei-Verknüpfung: beim Kaltstart per OS-Doppelklick
    // übergebene Datei abholen (null wenn ohne Datei gestartet).
    getLaunchFile: () =>
      ipcRenderer.invoke('project:get-launch-file') as Promise<
        { filePath: string; data: unknown } | null
      >,
    // #pre-sale — bei laufender App geöffnete Datei (second-instance/open-file).
    onOpenExternal: (cb: (payload: { filePath: string; data: unknown }) => void) => {
      const listener = (_e: unknown, payload: { filePath: string; data: unknown }) => cb(payload)
      ipcRenderer.on('project:open-external', listener)
      return () => ipcRenderer.removeListener('project:open-external', listener)
    },
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
    /** #288 — Live-MV-Setup vom verbundenen ATEM lesen. */
    readMvConfig: () =>
      ipcRenderer.invoke('atem:read-mv-config') as Promise<{
        multiViewers: Array<{
          index: number
          layout: number
          programPreviewSwapped: boolean
          windows: Array<{ windowIndex: number; sourceId: number }>
        }>
      }>,
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
    readState: (params: { host: string; port: number }) =>
      ipcRenderer.invoke('videohub:read-state', params) as Promise<{
        ok: boolean
        message: string
        state: {
          protocolVersion?: string
          modelName?: string
          friendlyName?: string
          uniqueId?: string
          videoInputs?: number
          videoOutputs?: number
          inputLabels: Record<number, string>
          outputLabels: Record<number, string>
          outputLocks: Record<number, 'unlocked' | 'locked-other' | 'locked-self'>
          routing: Record<number, number>
          takeMode?: boolean
        } | null
      }>,
    discover: (params?: { timeoutMs?: number }) =>
      ipcRenderer.invoke('videohub:discover', params) as Promise<
        Array<{ name: string; ip: string; port: number; model?: string }>
      >,
  },
  // #413/#471 — mDNS-Auffindbarkeit offener Live-Kollaborations-Sessions im LAN.
  collabDiscovery: {
    advertise: (info: { room: string; project: string; host: string; signaling: string }) =>
      ipcRenderer.invoke('collabDiscovery:advertise', info) as Promise<{ ok: boolean }>,
    unadvertise: () =>
      ipcRenderer.invoke('collabDiscovery:unadvertise') as Promise<{ ok: boolean }>,
    browse: (params?: { timeoutMs?: number }) =>
      ipcRenderer.invoke('collabDiscovery:browse', params) as Promise<
        Array<{
          name: string
          room: string
          project: string
          host: string
          signaling: string
          address: string
        }>
      >,
  },
  // #413 — Lokaler LAN-Signaling-Server: der WebRTC-Host startet ihn, wenn
  // kein eigener Signaling-Server konfiguriert ist, und bewirbt die Adresse.
  signaling: {
    start: () =>
      ipcRenderer.invoke('signaling:start') as Promise<{ url: string; port: number }>,
    stop: () => ipcRenderer.invoke('signaling:stop') as Promise<{ ok: boolean }>,
  },
  logs: {
    rendererError: (payload: { message: string; stack?: string; source?: string }) =>
      ipcRenderer.send('logs:renderer-error', payload),
  },
  updater: {
    check: () =>
      ipcRenderer.invoke('updater:check') as Promise<{
        ok: boolean
        current: string
        latest?: string
        available?: boolean
        message?: string
      }>,
    quitAndInstall: () => ipcRenderer.invoke('updater:quit-and-install') as Promise<boolean>,
    onStatus: (
      cb: (s: { state: string; version?: string; percent?: number; message?: string }) => void,
    ) => {
      const listener = (_e: unknown, s: { state: string; version?: string; percent?: number; message?: string }) => cb(s)
      ipcRenderer.on('updater:status', listener)
      return () => ipcRenderer.removeListener('updater:status', listener)
    },
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
    /** v7.9.97 — Vektor-PDF: Renderer schickt fertiges HTML mit
     *  foreignObject-SVG-Canvas + Page-Size in microns, Main rendert
     *  via Chromium printToPDF. Liefert die PDF-Bytes zurück. Text
     *  bleibt vektoriell und durchsuchbar.
     *  v7.9.104 — optional `scale` 0..1 fuer Paper-Fit. */
    canvasPdfVector: (params: {
      html: string
      widthMicrons: number
      heightMicrons: number
      scale?: number
    }) =>
      ipcRenderer.invoke('canvas:export-pdf-vector', params) as Promise<Uint8Array>,
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
    // v7.9.54 — Mobile-User hat ein Kabel via Dropdown-UI im Phone
    // hinzugefügt. Renderer fügt es ins Projekt ein mit addedFromMobile=true.
    onCableAdded: (
      cb: (cable: {
        fromEquipmentId: string
        fromPortId: string
        toEquipmentId: string
        toPortId: string
        name?: string
        type?: string
        length?: number
        color?: string
        notes?: string
      }) => void,
    ) => {
      const listener = (
        _event: unknown,
        cable: {
          fromEquipmentId: string
          fromPortId: string
          toEquipmentId: string
          toPortId: string
          name?: string
          type?: string
          length?: number
          color?: string
          notes?: string
        },
      ) => cb(cable)
      ipcRenderer.on('mobileShare:cableAdded', listener)
      return () => ipcRenderer.removeListener('mobileShare:cableAdded', listener)
    },
    // Feld-Rückkanal — Mobile-User hat eine Korrektur/ein Problem gemeldet.
    // Renderer legt sie in die Review-Queue (project.pendingChanges).
    onPendingChange: (
      cb: (change: {
        author?: string
        kind: string
        target?: { type: 'cable' | 'equipment'; id?: string; name?: string }
        summary: string
        patch?: Record<string, unknown>
      }) => void,
    ) => {
      const listener = (
        _event: unknown,
        change: {
          author?: string
          kind: string
          target?: { type: 'cable' | 'equipment'; id?: string; name?: string }
          summary: string
          patch?: Record<string, unknown>
        },
      ) => cb(change)
      ipcRenderer.on('mobileShare:pendingChange', listener)
      return () => ipcRenderer.removeListener('mobileShare:pendingChange', listener)
    },
  },
})
