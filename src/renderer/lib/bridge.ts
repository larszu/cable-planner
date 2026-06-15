import type { CablePlannerProject } from '../types/project'
import { downloadBlob } from './downloadBlob'

type OpenProjectResponse = {
  filePath: string
  data: CablePlannerProject
}

export interface AtemInputSummary {
  inputId: number
  longName: string
  shortName: string
  /** InternalPortType: External=0, Black=1, ColorBars=2, ColorGenerator=3,
   *  MediaPlayerFill=4, MediaPlayerKey=5, SuperSource=6, ExternalDirect=7,
   *  MEOutput=128, Auxiliary=129, Mask=130, MultiViewer=131. */
  portType?: number
  /** ExternalPortType bitmask: SDI=1, HDMI=2, Component=4, Composite=8,
   *  SVideo=16, XLR=32, AESEBU=64, RCA=128, Internal=256, TSJack=512,
   *  MADI=1024, TRSJack=2048, RJ45=4096. */
  externalPortType?: number
  /** true wenn der ATEM noch seine Werks-Default-Labels traegt. Wir
   *  pre-fillen aus dem Canvas nur wenn entweder default oder leer,
   *  damit eine bestehende User-Beschriftung nicht ueberschrieben wird. */
  areNamesDefault?: boolean
  sourceAvailability?: number
}

/** v7.9.128 — Vollstaendiger State-Dump eines Videohubs (parsed). */
export interface VideohubState {
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
}

export interface AtemMultiviewerWindow {
  windowIndex: number
  sourceId: number
  longName: string
  shortName: string
  portType?: number
  safeTitle?: boolean
  audioMeter?: boolean
}

export interface AtemMultiviewer {
  index: number
  layout: number
  programPreviewSwapped: boolean
  windows: AtemMultiviewerWindow[]
}

export interface AtemStateSummary {
  productIdentifier: string
  model?: number
  apiVersion?: { major: number; minor: number }
  mixEffects?: number
  auxiliaries?: number
  inputs: AtemInputSummary[]
  multiViewers?: (AtemMultiviewer | null)[]
}

export interface AtemConnectResult {
  ip: string
  summary: AtemStateSummary | null
}

/** #413/#471 — eine im LAN per mDNS gefundene, offene Live-Session. */
export interface DiscoveredCollabSession {
  name: string
  room: string
  project: string
  host: string
  signaling: string
  address: string
}

type CablePlannerApi = {
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
    /** v7.9.110 — Batch-Export in eine 'CablePlanner'-Group im Rentman-
     *  Projekt. Gruppe wird angelegt falls nicht vorhanden. */
    exportToCablePlannerGroup: (
      projectId: string,
      items: Array<{ equipmentId: string; quantity: number }>,
    ) => Promise<{
      added: number
      failed: Array<{ equipmentId: string; quantity: number; error: string }>
      groupId: string | null
      groupCreated: boolean
      subprojectId: string | null
    }>
    addProjectFile: (
      projectId: string,
      fileName: string,
      fileBytes: Uint8Array,
      mimeType?: string,
    ) => Promise<unknown>
  }
  project: {
    newProject: () => Promise<void>
    openProject: () => Promise<OpenProjectResponse | null>
    saveProject: (project: CablePlannerProject, currentPath?: string) => Promise<string | null>
    saveProjectAs: (project: CablePlannerProject) => Promise<string | null>
    getRecentProjects: () => Promise<string[]>
    /** v7.9.3 — Viewer-File-Export (.cpviewer Extension). */
    exportViewer: (project: CablePlannerProject) => Promise<string | null>
    /** v7.9.3 — Annotations aus einer Viewer-Datei zurück-importieren. */
    importAnnotations: () => Promise<{ filePath: string; annotations: unknown[] } | null>
    /** #pre-sale — beim Kaltstart per OS-Doppelklick übergebene Datei abholen. */
    getLaunchFile: () => Promise<OpenProjectResponse | null>
    /** #pre-sale — bei laufender App geöffnete Datei (second-instance/open-file). */
    onOpenExternal: (cb: (payload: OpenProjectResponse) => void) => () => void
  }
  graphml: {
    openFile: () => Promise<{ filePath: string; fileName: string; xml: string } | null>
  }
  atem: {
    connect: (ip: string) => Promise<AtemConnectResult>
    disconnect: () => Promise<{ ok: boolean }>
    getState: () => Promise<AtemStateSummary | null>
    setInputName: (payload: {
      inputId: number
      longName: string
      shortName: string
    }) => Promise<{ ok: boolean }>
    bulkSetInputNames: (payload: {
      entries: { inputId: number; longName: string; shortName: string }[]
    }) => Promise<{ count: number }>
    getEvents: () => Promise<string[]>
    getStatus: () => Promise<{ connected: boolean; ip: string | null }>
    applyMvConfig: (config: {
      multiViewers: {
        index: number
        layout: number
        programPreviewSwapped?: boolean
        windows: { windowIndex: number; sourceId: number }[]
      }[]
    }) => Promise<{ applied: number }>
    /** #288 — Live-MV-Setup vom verbundenen ATEM auslesen. Liefert die
     *  Konfiguration im CP-Quadranten-Schema (windowIndex 0..3 + 10..43),
     *  passt also direkt in AtemMvConfig.multiViewers. */
    readMvConfig: () => Promise<{
      multiViewers: Array<{
        index: number
        layout: number
        programPreviewSwapped: boolean
        windows: Array<{ windowIndex: number; sourceId: number }>
      }>
    }>
    /** v7.9.52 — OpenSwitcher-style Live-Audio-State lesen. */
    readAudioConfig: () => Promise<{
      matrix?: {
        sources: Array<{ id: number; name: string }>
        outputs: Array<{ id: number; sourceId: number; name: string }>
      }
      classicMixer?: {
        programOutGain: number
        programOutBalance: number
        programOutFollowFadeToBlack: boolean
        audioFollowVideoCrossfadeTransition: boolean
        inputs: Array<{
          id: number
          mixOption: 'Off' | 'On' | 'AudioFollowVideo'
          gain: number | null
          balance: number
        }>
      }
      inputLabels?: Record<number, { shortName: string; longName: string; externalPortType?: string }>
    } | null>
    /** v7.9.52 — OpenSwitcher-style: Push einer kompletten oder partiellen
     *  AtemAudioConfig direkt an den verbundenen Switcher. Umgeht den
     *  XML-Import-Schritt von ATEM Software Control. */
    applyAudioConfig: (config: {
      matrix?: { outputs: Array<{ id: number; sourceId: number }> }
      classicMixer?: {
        inputs: Array<{
          id: number
          mixOption: 'Off' | 'On' | 'AudioFollowVideo'
          gain: number | null
          balance: number
        }>
      }
      inputLabels?: Record<number, { shortName: string; longName: string }>
    }) => Promise<{ matrixApplied: number; classicApplied: number; labelsApplied: number }>
    onEvent: (cb: (line: string) => void) => () => void
    /** v7.9.53 — mDNS-Auto-Discovery für ATEM-Switcher im lokalen Netz.
     *  Sucht für timeoutMs (Default 3000) nach "_blackmagic._tcp"-Services. */
    discover: (params?: { timeoutMs?: number }) => Promise<
      Array<{ name: string; ip: string; port: number; model?: string }>
    >
  }
  videohub: {
    sendRouting: (params: { host: string; port: number; block: string }) => Promise<{ ok: boolean; message: string }>
    readState: (params: { host: string; port: number }) => Promise<{
      ok: boolean
      message: string
      state: VideohubState | null
    }>
    /** Issue #248 — mDNS-Auto-Discovery fuer Videohubs (Bonjour). */
    discover: (params?: { timeoutMs?: number }) => Promise<
      Array<{ name: string; ip: string; port: number; model?: string }>
    >
  }
  /** #413/#471 — LAN-Auffindbarkeit offener Live-Kollaborations-Sessions. */
  collabDiscovery: {
    /** Bewirbt die laufende Session per mDNS, damit andere sie finden. */
    advertise: (info: {
      room: string
      project: string
      host: string
      signaling: string
    }) => Promise<{ ok: boolean }>
    /** Nimmt die Bewerbung zurück (Session beendet/Raum gewechselt). */
    unadvertise: () => Promise<{ ok: boolean }>
    /** Durchsucht das LAN für `timeoutMs` nach offenen Sessions. */
    browse: (params?: { timeoutMs?: number }) => Promise<DiscoveredCollabSession[]>
  }
  /** #413 — Lokaler LAN-Signaling-Server für WebRTC-Hosts (siehe
   *  signalingServer.ts). Liefert die `ws://<lan-ip>:<port>`-Adresse, die der
   *  Host via mDNS bewirbt und Beitretende automatisch übernehmen. */
  signaling: {
    start: () => Promise<{ url: string; port: number }>
    stop: () => Promise<{ ok: boolean }>
  }
  logs: {
    rendererError: (payload: { message: string; stack?: string; source?: string }) => void
  }
  updater: {
    check: () => Promise<{ ok: boolean; current: string; latest?: string; available?: boolean; message?: string }>
    quitAndInstall: () => Promise<boolean>
    onStatus: (
      cb: (s: { state: string; version?: string; percent?: number; message?: string }) => void,
    ) => () => void
  }
  sync: {
    readFile: (filePath: string) => Promise<string>
    writeFile: (filePath: string, data: string) => Promise<void>
    exists: (filePath: string) => Promise<boolean>
    acquireLock: (dirPath: string, owner: string) => Promise<{ ok: boolean; lockedBy?: string }>
    releaseLock: (dirPath: string, owner: string) => Promise<void>
  }
  print: {
    /** v7.9.27 — PDF nativ über Electron-Hauptprozess drucken statt
     *  iframe.contentWindow.print(). Liefert true wenn der Print-
     *  Dialog erfolgreich abgeschlossen wurde, false bei Cancel
     *  oder Fehler. */
    pdfBytes: (bytes: Uint8Array) => Promise<boolean>
  }
  library: {
    /** v7.9.33 — Zentraler Library-Ordner (userData/library/). */
    getFolderPath: () => Promise<string>
    revealFolder: () => Promise<string>
    scan: () => Promise<
      Array<{
        kind: 'device' | 'group'
        fileName: string
        fileVersion: number
        modifiedAt: string
        payload: unknown
      }>
    >
    write: (params: {
      kind: 'device' | 'group'
      name: string
      payload: unknown
    }) => Promise<{ fileName: string; fileVersion: number; modifiedAt: string }>
    deleteItem: (params: { kind: 'device' | 'group'; name: string }) => Promise<boolean>
  }
  mobileShare: {
    start: () => Promise<{ port: number; urls: string[]; hasProject: boolean }>
    stop: () => Promise<{ ok: boolean }>
    status: () => Promise<{ running: boolean; port: number; urls: string[]; hasProject: boolean }>
    setProject: (project: unknown) => Promise<{ ok: boolean }>
    /** v7.9.3 — Listener für CheckState-Updates vom Mobile-Viewer.
     *  Wird vom Renderer registriert; der Main-Prozess schickt
     *  'mobileShare:checksUpdate' Events sobald POST /checks
     *  reinkommt. Gibt eine Unsubscribe-Funktion zurück. */
    onChecksUpdate: (
      cb: (checks: { ports: Record<string, boolean>; cables: Record<string, boolean> }) => void,
    ) => () => void
    /** v7.9.54 — Listener für Mobile-Cable-Add-Events. */
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
    ) => () => void
    /** Feld-Rückkanal — Listener für Mobile-Pending-Change-Meldungen. */
    onPendingChange: (
      cb: (change: {
        author?: string
        kind: string
        target?: { type: 'cable' | 'equipment'; id?: string; name?: string }
        summary: string
        patch?: Record<string, unknown>
      }) => void,
    ) => () => void
  }
}

import { STORAGE_KEYS } from './storageKeys'

const TOKEN_KEY = STORAGE_KEYS.webToken
const RECENTS_KEY = STORAGE_KEYS.webRecents

export const hasDesktopBridge = Boolean(window.cablePlanner)

const loadRecents = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

const saveRecents = (items: string[]) => {
  localStorage.setItem(RECENTS_KEY, JSON.stringify(items.slice(0, 10)))
}

const pushRecent = (item: string) => {
  const next = [item, ...loadRecents().filter((entry) => entry !== item)]
  saveRecents(next)
}

const downloadJson = (project: CablePlannerProject, suggestedFileName: string) =>
  downloadBlob(suggestedFileName, JSON.stringify(project, null, 2), 'application/json')

/**
 * Normalise whatever the user pasted into the Rentman token field.
 * JWTs consist strictly of [A-Za-z0-9._-] so we can aggressively strip
 * whitespace, newlines, zero-width/BOM characters, surrounding quotes and
 * a leading "Bearer " / "bearer " prefix that users sometimes include
 * when copying from Rentman's UI.
 */
const normalizeToken = (raw: string | null | undefined): string => {
  if (!raw) return ''
  let t = String(raw)
  // Strip BOM, zero-width and non-breaking spaces that commonly sneak in on paste.
  // eslint-disable-next-line no-control-regex
  t = t.replace(/[\u0000-\u001f\u007f-\u00a0\u2000-\u200f\u2028-\u202f\u205f-\u206f\ufeff]/g, '')
  t = t.trim()
  // Repeatedly strip surrounding quotes and "Bearer " prefixes until stable.
  for (let i = 0; i < 3; i++) {
    const before = t
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      t = t.slice(1, -1).trim()
    }
    if (/^bearer\s+/i.test(t)) {
      t = t.replace(/^bearer\s+/i, '').trim()
    }
    if (t === before) break
  }
  // JWT charset only — discard anything else.
  t = t.replace(/[^A-Za-z0-9._-]/g, '')
  return t
}

const isLikelyJwt = (t: string): boolean => /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t)

const getWebToken = async () => {
  const token = normalizeToken(localStorage.getItem(TOKEN_KEY))
  if (!token) {
    throw new Error('No Rentman token configured. Open Settings and save your token.')
  }
  return token
}

const extractArray = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (Array.isArray(record.data)) return record.data
    if (Array.isArray(record.results)) return record.results
    if (Array.isArray(record.items)) return record.items
    if (record.response && typeof record.response === 'object') {
      const nested = record.response as Record<string, unknown>
      if (Array.isArray(nested.data)) return nested.data
    }
  }
  return []
}

const fetchRentmanJson = async (path: string): Promise<unknown> => {
  const token = await getWebToken()
  if (!isLikelyJwt(token)) {
    throw new Error(
      `Token does not look like a Rentman JWT (expected three dot-separated base64url segments). Length=${token.length}. Open Settings and paste the token again.`,
    )
  }
  const authHeader = `Bearer ${token}`
  const response = await fetch(`/api/rentman${path}`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'follow',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  })

  const text = await response.text()
  if (!response.ok) {
    const preview = `${authHeader.slice(0, 14)}...${authHeader.slice(-6)} (len=${authHeader.length})`
    // Surface what was actually sent so 400/403 become actionable.
    throw new Error(
      `Rentman request failed (${response.status}) on ${path}. Sent: ${preview}. Server said: ${text.slice(0, 500)}`,
    )
  }
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error(`Rentman returned non-JSON response: ${text.slice(0, 200)}`)
  }
}

/**
 * Rentman defaults to a small page size (usually 25). We paginate using
 * `limit` + `offset` until fewer than `limit` rows come back.
 */
const fetchRentmanPaginated = async (basePath: string): Promise<unknown[]> => {
  const limit = 300
  const joiner = basePath.includes('?') ? '&' : '?'
  const all: unknown[] = []
  let offset = 0

  while (true) {
    const body = await fetchRentmanJson(`${basePath}${joiner}limit=${limit}&offset=${offset}`)
    const page = extractArray(body)
    all.push(...page)
    if (page.length < limit) break
    offset += limit
  }

  return all
}

const isForbiddenForPath = (error: unknown, path: string): boolean => {
  if (!(error instanceof Error)) return false
  return error.message.includes('Rentman request failed (403)') && error.message.includes(`on ${path}`)
}

const webFallbackApi: CablePlannerApi = {
  credentials: {
    getToken: async () => {
      const stored = localStorage.getItem(TOKEN_KEY)
      return stored ? normalizeToken(stored) : null
    },
    saveToken: async (token: string) => {
      const clean = normalizeToken(token)
      if (!clean) {
        localStorage.removeItem(TOKEN_KEY)
        return true
      }
      localStorage.setItem(TOKEN_KEY, clean)
      return true
    },
    deleteToken: async () => {
      localStorage.removeItem(TOKEN_KEY)
      return true
    },
    testToken: async () => {
      try {
        const body = await fetchRentmanJson('/projects?limit=1')
        const arr = extractArray(body)
        return {
          ok: true,
          message: `Rentman token works. Example result count in first page: ${arr.length}.`,
        }
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : 'Token test failed.',
        }
      }
    },
  },
  rentman: {
    getProjects: () => fetchRentmanPaginated('/projects'),
    getProjectEquipment: (projectId: string) =>
      fetchRentmanPaginated(`/projects/${encodeURIComponent(projectId)}/projectequipment`),
    getEquipment: () => fetchRentmanPaginated('/equipment'),
    getEquipmentFolders: async () => {
      try {
        return await fetchRentmanPaginated('/equipmentfolders')
      } catch (error) {
        // Some Rentman API keys can read equipment but not equipmentfolders.
        // Degrade gracefully so import still works with uncategorized fallback.
        if (isForbiddenForPath(error, '/equipmentfolders')) {
          return []
        }
        throw error
      }
    },
    addProjectEquipment: async (
      projectId: string,
      equipmentId: string,
      quantity: number = 1,
    ) => {
      const token = await getWebToken()
      if (!isLikelyJwt(token)) {
        throw new Error('Rentman token missing or malformed.')
      }
      const response = await fetch('/api/rentman/projectequipment', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          equipment: equipmentId,
          project: projectId,
          quantity,
        }),
      })
      const text = await response.text()
      if (!response.ok) {
        throw new Error(
          `Rentman POST /projectequipment failed (${response.status}): ${text.slice(0, 500)}`,
        )
      }
      try {
        return text ? (JSON.parse(text) as unknown) : null
      } catch {
        return text
      }
    },
    /** v7.9.110 — Web-Fallback: nicht verfuegbar in Browser-only-Builds
     *  (Mobile-Share / Web-Viewer). Der Export braucht subproject- und
     *  equipmentgroup-Lookups die mehrere API-Calls benoetigen — wenig
     *  Mehrwert ohne Token-Management via Electron-Credentials-Store. */
    exportToCablePlannerGroup: async () => {
      throw new Error(
        'Rentman-Export ist nur in der Electron-Desktop-App verfuegbar, nicht im Web-/Mobile-Build.',
      )
    },
    addProjectFile: async (
      projectId: string,
      fileName: string,
      fileBytes: Uint8Array,
      mimeType: string = 'application/pdf',
    ) => {
      const token = await getWebToken()
      if (!isLikelyJwt(token)) {
        throw new Error('Rentman token missing or malformed.')
      }
      const form = new FormData()
      // Cast to BlobPart — Uint8Array<ArrayBufferLike> is structurally a
      // BlobPart but TS 6 narrows the buffer type to disallow shared.
      const blob = new Blob([fileBytes as unknown as BlobPart], { type: mimeType })
      form.append('file', blob, fileName)
      form.append('name', fileName)
      form.append('item', projectId)
      form.append('itemtype', 'project')
      const response = await fetch('/api/rentman/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: form,
      })
      const text = await response.text()
      if (!response.ok) {
        throw new Error(
          `Rentman POST /files failed (${response.status}): ${text.slice(0, 500)}`,
        )
      }
      try {
        return text ? (JSON.parse(text) as unknown) : null
      } catch {
        return text
      }
    },
  },
  project: {
    newProject: async () => {},
    openProject: async () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.cableplan,.json,application/json'

      return await new Promise<OpenProjectResponse | null>((resolve) => {
        input.onchange = async () => {
          const file = input.files?.[0]
          if (!file) {
            resolve(null)
            return
          }

          try {
            const text = await file.text()
            const data = JSON.parse(text) as CablePlannerProject
            pushRecent(file.name)
            resolve({ filePath: file.name, data })
          } catch {
            resolve(null)
          }
        }
        input.click()
      })
    },
    saveProject: async (project: CablePlannerProject, currentPath?: string) => {
      const fileName = currentPath || `${project.metadata.name || 'project'}.cableplan`
      downloadJson(project, fileName)
      pushRecent(fileName)
      return fileName
    },
    saveProjectAs: async (project: CablePlannerProject) => {
      const fileName = `${project.metadata.name || 'project'}.cableplan`
      downloadJson(project, fileName)
      pushRecent(fileName)
      return fileName
    },
    getRecentProjects: async () => loadRecents(),
    exportViewer: async (project: CablePlannerProject) => {
      // Browser-Fallback: trigger Download mit .cpviewer-Extension.
      const fileName = `${project.metadata.name || 'project'}.cpviewer`
      const safe = { ...project, mode: 'viewer' as const, viewerSession: undefined }
      downloadJson(safe, fileName)
      return fileName
    },
    importAnnotations: async () => null,
    // #pre-sale — Datei-Verknüpfung ist Desktop-only; im Browser gibt es
    // keine OS-Übergabe → kein Launch-File, kein External-Open.
    getLaunchFile: async () => null,
    onOpenExternal: () => () => {},
  },
  graphml: {
    // Browser fallback for dev / non-Electron contexts: use a hidden
    // <input type="file"> instead of Electron's native dialog.
    openFile: async () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.graphml,application/xml,text/xml'
      return await new Promise<{ filePath: string; fileName: string; xml: string } | null>((resolve) => {
        input.onchange = async () => {
          const file = input.files?.[0]
          if (!file) return resolve(null)
          try {
            const xml = await file.text()
            resolve({ filePath: file.name, fileName: file.name, xml })
          } catch {
            resolve(null)
          }
        }
        input.click()
      })
    },
  },
  atem: {
    connect: async () => {
      throw new Error('ATEM control requires the desktop app (UDP socket needed).')
    },
    disconnect: async () => ({ ok: true }),
    getState: async () => null,
    setInputName: async () => {
      throw new Error('ATEM control requires the desktop app.')
    },
    bulkSetInputNames: async () => {
      throw new Error('ATEM control requires the desktop app.')
    },
    getEvents: async () => [],
    getStatus: async () => ({ connected: false, ip: null }),
    applyMvConfig: async () => {
      throw new Error('ATEM control requires the desktop app.')
    },
    readMvConfig: async () => {
      throw new Error('ATEM control requires the desktop app.')
    },
    readAudioConfig: async () => null,
    applyAudioConfig: async () => {
      throw new Error('ATEM control requires the desktop app.')
    },
    onEvent: () => () => {},
    discover: async () => [],
  },
  videohub: {
    sendRouting: async () => ({
      ok: false,
      message: 'TCP-Übertragung erfordert die Desktop-App.',
    }),
    readState: async () => ({
      ok: false,
      message: 'TCP-Lese-Zugriff erfordert die Desktop-App.',
      state: null,
    }),
    discover: async () => [],
  },
  collabDiscovery: {
    // Web-Fallback: mDNS braucht den Main-Prozess (UDP-Multicast).
    advertise: async () => ({ ok: false }),
    unadvertise: async () => ({ ok: false }),
    browse: async () => [],
  },
  signaling: {
    // Web-Fallback: ein Signaling-Server braucht den Main-Prozess (TCP-Listen).
    start: async () => {
      throw new Error('Lokaler Signaling-Server erfordert die Desktop-App.')
    },
    stop: async () => ({ ok: true }),
  },
  logs: {
    rendererError: () => {},
  },
  updater: {
    check: async () => ({ ok: false, current: '', message: 'Updates erfordern die Desktop-App.' }),
    quitAndInstall: async () => false,
    onStatus: () => () => {},
  },
  sync: {
    readFile: async () => {
      throw new Error('Netzwerk-Sync erfordert die Desktop-App.')
    },
    writeFile: async () => {
      throw new Error('Netzwerk-Sync erfordert die Desktop-App.')
    },
    exists: async () => false,
    acquireLock: async () => ({ ok: false, lockedBy: undefined }),
    releaseLock: async () => {},
  },
  print: {
    pdfBytes: async () => false,
  },
  library: {
    // Web-Fallback: kein zentraler Folder verfügbar, alle ops no-op.
    getFolderPath: async () => '',
    revealFolder: async () => '',
    scan: async () => [],
    write: async () => ({
      fileName: '',
      fileVersion: 0,
      modifiedAt: new Date().toISOString(),
    }),
    deleteItem: async () => false,
  },
  mobileShare: {
    start: async () => {
      throw new Error('Handy-Zugriff erfordert die Desktop-App.')
    },
    stop: async () => ({ ok: true }),
    status: async () => ({ running: false, port: 0, urls: [], hasProject: false }),
    setProject: async () => ({ ok: true }),
    onChecksUpdate: () => () => {},
    onCableAdded: () => () => {},
    onPendingChange: () => () => {},
  },
}

export const cablePlannerApi: CablePlannerApi =
  (window.cablePlanner as CablePlannerApi | undefined) ?? webFallbackApi

// Migration: if the app previously ran without a working desktop bridge and
// stored the token in localStorage (the webFallbackApi path), move it to the
// secure keytar store and delete the localStorage copy immediately.
;(async () => {
  if (!hasDesktopBridge) return
  const legacy = localStorage.getItem(TOKEN_KEY)
  if (!legacy) return
  try {
    await cablePlannerApi.credentials.saveToken(legacy)
  } finally {
    localStorage.removeItem(TOKEN_KEY)
  }
})()
