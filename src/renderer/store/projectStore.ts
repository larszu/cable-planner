import { v4 as uuidv4 } from 'uuid'
import { create, type StateCreator } from 'zustand'
import type { Connection } from 'reactflow'
import type { Cable } from '../types/cable'
import type { EquipmentItem, EquipmentTemplate, GroupPreset, Port } from '../types/equipment'
import type { LocationFrame } from '../types/location'
import type { CablePlannerProject } from '../types/project'
import { useUiStore } from './uiStore'
import { isProjectLocked, sanitizePort, touchProject } from './projectStoreHelpers'
import { createLocationSlice } from './slices/locationSlice'
import { createCableSlice } from './slices/cableSlice'
import { blackmagicTemplates } from '../lib/blackmagicCatalog'
import { cableTypePatchFromPorts, inheritedCableType } from '../lib/cableInheritance'
import { detectLayerForConnector } from '../lib/cableLayers'
import { cableCatalog } from '../types/cableSpec'
import { ubiquitiTemplates } from '../lib/ubiquitiCatalog'
import { monitorTemplates } from '../lib/monitorCatalog'
import { cameraTemplates } from '../lib/cameraCatalog'
import { miscTemplates } from '../lib/miscCatalog'
import { greengoTemplates } from '../lib/greengoCatalog'
import {
  upsertCachedRentmanTemplate,
  upsertCachedRentmanTemplateFromEquipment,
} from '../lib/rentmanTemplateCache'
import type { GreenGoConfig } from '../types/greengo'
import { useSettingsStore } from './settingsStore'

type CableDraft = Pick<Cable, 'name' | 'type' | 'length' | 'color' | 'notes'> &
  Partial<Pick<Cable, 'cableSpecId' | 'standard' | 'needsConverter'>>

import { STORAGE_KEYS } from '../lib/storageKeys'
import { LIMITS, VIEWPORT_DEFAULTS } from '../lib/layoutConstants'
import {
  syncDevicesToFolder,
  syncPresetsToFolder,
  seedLibrarySyncCache,
  stampGroupLibraryRef,
} from '../lib/librarySync'

const CUSTOM_LIB_KEY = STORAGE_KEYS.customLibrary
const PROJECT_AUTOSAVE_KEY = STORAGE_KEYS.projectAutosave
const KNOWN_CATEGORIES_KEY = STORAGE_KEYS.knownCategories
const GROUP_PRESETS_KEY = STORAGE_KEYS.groupPresets
const LIB_MIGRATION_KEY = STORAGE_KEYS.libMigration
const LIB_MIGRATION_VERSION = '2026-04-greengo-catalog-v2'

const DEFAULT_CATEGORIES = [
  'Kameras',
  'Objektive',
  'Stative',
  'Licht',
  'Audio',
  'Video',
  'Monitore',
  'PC',
  'Netzwerk',
  'Kabel',
  'Strom',
  'Rigging',
  'Sonstiges',
]

const runLibraryMigration = () => {
  try {
    const current = localStorage.getItem(LIB_MIGRATION_KEY)
    // Step 1 (earlier migration): the previous build auto-generated bogus
    // 1-in/1-out templates for every Rentman device. Ensure those are cleared
    // ONCE, but don't wipe libraries created by any later good migration.
    const preservedVersions = new Set(['2026-04-reset', '2026-04-blackmagic-seed', '2026-04-monitor-camera-seed', '2026-04-misc-catalog-seed', '2026-04-greengo-catalog-seed', LIB_MIGRATION_VERSION])
    if (current && !preservedVersions.has(current)) {
      localStorage.removeItem(CUSTOM_LIB_KEY)
    }
    // Step 2: always seed built-in templates (Blackmagic + Ubiquiti) so they
    // appear in the library, even for users who already passed an earlier
    // migration gate. Entries the user saved under the same name are kept.
    const raw = localStorage.getItem(CUSTOM_LIB_KEY)
    const existing: EquipmentTemplate[] = raw ? JSON.parse(raw) : []
    const byName = new Map(existing.map((t) => [t.name, t]))
    let added = false
    for (const t of [...blackmagicTemplates, ...ubiquitiTemplates, ...monitorTemplates, ...cameraTemplates, ...miscTemplates, ...greengoTemplates]) {
      if (!byName.has(t.name)) {
        byName.set(t.name, t)
        added = true
      }
    }
    if (added || !raw) {
      localStorage.setItem(CUSTOM_LIB_KEY, JSON.stringify(Array.from(byName.values())))
    }
    localStorage.setItem(LIB_MIGRATION_KEY, LIB_MIGRATION_VERSION)
  } catch {
    /* ignore */
  }
}
runLibraryMigration()

const loadCustomLibrary = (): EquipmentTemplate[] => {
  try {
    const raw = localStorage.getItem(CUSTOM_LIB_KEY)
    return raw ? (JSON.parse(raw) as EquipmentTemplate[]) : []
  } catch {
    return []
  }
}

const persistCustomLibrary = (items: EquipmentTemplate[]) => {
  try {
    localStorage.setItem(CUSTOM_LIB_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
  syncDevicesToFolder(items)
}

const loadKnownCategories = (): string[] => {
  try {
    const raw = localStorage.getItem(KNOWN_CATEGORIES_KEY)
    const stored = raw ? (JSON.parse(raw) as string[]) : []
    // Merge in defaults so dropdowns always have sensible options.
    const set_ = new Set<string>([...DEFAULT_CATEGORIES, ...stored])
    return Array.from(set_).sort((a, b) => a.localeCompare(b))
  } catch {
    return [...DEFAULT_CATEGORIES]
  }
}

const persistKnownCategories = (items: string[]) => {
  try {
    localStorage.setItem(KNOWN_CATEGORIES_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

const loadAutosavedProject = (): CablePlannerProject | null => {
  try {
    const raw = localStorage.getItem(PROJECT_AUTOSAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CablePlannerProject
    if (!parsed || !Array.isArray(parsed.equipment) || !Array.isArray(parsed.cables)) return null
    // Defensive: ensure each equipment item has valid inputs+outputs
    // arrays. A corrupt autosave (older schema, partial write, or
    // hand-edited localStorage) where `item.inputs` is null/undefined
    // crashes the renderer downstream with `cannot read .map of undefined`
    // — which surfaces as React #185 boot loops via the ErrorBoundary
    // re-mount. Repair-on-load is cheaper than a try/catch in every
    // PortList / cable-routing code path.
    let mutated = false
    parsed.equipment = parsed.equipment.map((item) => {
      const inputs = Array.isArray(item.inputs) ? item.inputs : []
      const outputs = Array.isArray(item.outputs) ? item.outputs : []
      const needsArrayRepair = inputs !== item.inputs || outputs !== item.outputs
      const fixInputs = inputs.some((p) => !p || !p.id)
      const fixOutputs = outputs.some((p) => !p || !p.id)
      if (!needsArrayRepair && !fixInputs && !fixOutputs) return item
      mutated = true
      return {
        ...item,
        inputs: inputs
          .filter((p): p is NonNullable<typeof p> => Boolean(p))
          .map((p) => (p.id ? p : { ...p, id: uuidv4() })),
        outputs: outputs
          .filter((p): p is NonNullable<typeof p> => Boolean(p))
          .map((p) => (p.id ? p : { ...p, id: uuidv4() })),
      }
    })
    if (mutated) {
      try {
        localStorage.setItem(PROJECT_AUTOSAVE_KEY, JSON.stringify(parsed))
      } catch {
        /* ignore quota */
      }
    }
    return parsed
  } catch {
    return null
  }
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null
const scheduleProjectAutosave = (project: CablePlannerProject) => {
  if (autosaveTimer) clearTimeout(autosaveTimer)
  const delay = useSettingsStore.getState().autosaveIntervalMs || 400
  autosaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(PROJECT_AUTOSAVE_KEY, JSON.stringify(project))
    } catch {
      /* quota errors are non-fatal */
    }
  }, delay)
}

// v7.9.13 — Heal-on-Load für GroupPresets. Alte Presets aus früheren
// Versionen können Ports mit `id: ''` enthalten (catalogue-Templates
// hatten leere IDs, vor dem sanitize-Fix wurde das ungeprüft persistiert).
// Beim Laden geben wir jedem Port der noch keine valide eindeutige ID
// hat einen frischen UUID, damit ReactFlow / EquipmentNode keine Key-
// Kollisionen mehr haben. Idempotent — bei bereits sauberen Presets
// passiert nichts.
const healGroupPresetPorts = (presets: GroupPreset[]): GroupPreset[] => {
  let needsRewrite = false
  const out = presets.map((preset) => {
    const items = preset.items.map((item) => {
      const sanitizePortList = <T extends { id?: string }>(ports: T[]): T[] => {
        const seen = new Set<string>()
        return ports.map((p) => {
          let id = p.id ?? ''
          if (!id || seen.has(id)) {
            needsRewrite = true
            id = typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `port-${Math.random().toString(36).slice(2, 11)}`
          }
          seen.add(id)
          return { ...p, id }
        })
      }
      return {
        ...item,
        inputs: sanitizePortList(item.inputs),
        outputs: sanitizePortList(item.outputs),
      }
    })
    return { ...preset, items }
  })
  if (needsRewrite) {
    try {
      localStorage.setItem(GROUP_PRESETS_KEY, JSON.stringify(out))
    } catch {
      /* ignore */
    }
  }
  return out
}

const loadGroupPresets = (): GroupPreset[] => {
  try {
    const raw = localStorage.getItem(GROUP_PRESETS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as GroupPreset[]
    return healGroupPresetPorts(parsed)
  } catch {
    return []
  }
}

const persistGroupPresets = (presets: GroupPreset[]) => {
  try {
    localStorage.setItem(GROUP_PRESETS_KEY, JSON.stringify(presets))
  } catch {
    /* ignore */
  }
  syncPresetsToFolder(presets)
}

export interface ProjectState {
  project: CablePlannerProject
  filePath?: string
  /** Incremented each time loadProject or clear() is called. Canvas uses this
   *  to detect a project-load event and restore the saved viewport. */
  projectVersion: number
  selectedEquipmentId?: string
  selectedCableId?: string
  selectedLocationId?: string
  selectedTemplateName?: string
  pendingConnection?: Connection
  pendingWaypoints?: { x: number; y: number }[]
  showCableDialog: boolean
  /** #294 — Port-Konflikt-Dialog. Wird gesetzt wenn queueConnection einen
   *  bereits belegten Ziel-Port erkennt; UI rendert PortConflictDialog
   *  statt direkt den CableDialog zu oeffnen. User entscheidet:
   *  - Ersetzen: conflicting cables loeschen + normaler Cable-Create-Flow.
   *  - Abbrechen: nichts machen, neuer Connect verworfen. */
  portConflict?: {
    connection: Connection
    waypoints?: { x: number; y: number }[]
    conflictingCableIds: string[]
  }
  recentProjects: string[]
  customLibrary: EquipmentTemplate[]
  setRecentProjects: (items: string[]) => void
  setFilePath: (path?: string) => void
  loadProject: (project: CablePlannerProject, filePath?: string) => void
  setProjectMeta: (name: string, description: string) => void
  updateProjectMetadata: (
    patch: Partial<import('../types/project').ProjectMetadata>,
  ) => void
  setDefaultVideoFormat: (id: string) => void
  setCanvasState: (x: number, y: number, zoom: number) => void
  addEquipment: (equipment: Omit<EquipmentItem, 'id'>) => void
  importEquipment: (equipment: EquipmentItem[]) => void
  /**
   * Insert devices and cables coming from a yEd / GraphML import. Each
   * device carries an optional `graphmlId` so a re-import (`mode:
   * 'replace'`) can correlate the previous snapshot with the new one
   * and update positions/ports in place rather than producing
   * duplicates. Cables use the port-import-key map built by the dialog
   * to look up the freshly-assigned cable-planner uuids.
   *
   * Returns the list of newly inserted equipment ids in import order
   * so the caller can select them on the canvas to draw the user's
   * attention to what changed.
   */
  importGraphml: (payload: {
    devices: Array<Omit<EquipmentItem, 'id'> & { graphmlId: string; importKey: string }>
    /** Map from ResolvedPort.importKey to the *position index within the
     *  device's inputs/outputs array*, so the store can resolve cable
     *  endpoints once it has assigned real uuids. */
    portIndex: Record<string, { deviceImportKey: string; side: 'in' | 'out'; index: number }>
    cables: Array<{
      importKey: string
      graphmlEdgeId: string
      sourceDeviceImportKey: string
      sourcePortImportKey: string
      targetDeviceImportKey: string
      targetPortImportKey: string
      type: Cable['type']
      length: number
      color: string
      name: string
      standard?: Cable['standard']
      cableSpecId?: string
      notes?: string
      waypoints?: { x: number; y: number }[]
    }>
    mode: 'append' | 'replace'
  }) => string[]
  /**
   * Paste a snapshot of equipment items + connecting cables (Ctrl+V / duplicate).
   * All ids (equipment, ports, cable) are remapped to fresh uuids; cable refs
   * to ports/equipment outside the snapshot are dropped. The new equipment is
   * placed at `(item.x + offset.dx, item.y + offset.dy)`. Returns the list of
   * new equipment ids so the caller can select them on the canvas.
   */
  pasteEquipment: (
    items: EquipmentItem[],
    cables: Cable[],
    offset: { dx: number; dy: number },
  ) => string[]
  updateEquipment: (id: string, patch: Partial<EquipmentItem>) => void
  /** v7.5.0 — activate a named DeviceMode on the given equipment.
   *  Replaces the live `inputs`/`outputs` arrays with snapshots from
   *  the mode definition so the canvas re-renders with the new port
   *  set. Cables whose ports no longer exist stay in the project but
   *  show as "orphaned" until the user re-routes them. */
  setActiveDeviceMode: (equipmentId: string, modeId: string | null) => void
  setSelection: (equipmentId?: string, cableId?: string, locationId?: string) => void
  setSelectedTemplateName: (name?: string) => void
  addLocation: (partial?: Partial<LocationFrame>) => void
  addLocationAroundEquipment: (equipmentIds: string[], partial?: Partial<LocationFrame>) => void
  updateLocation: (id: string, patch: Partial<LocationFrame>) => void
  deleteLocation: (id: string) => void
  deleteLocationWithContents: (id: string) => void
  moveLocationWithContents: (id: string, dx: number, dy: number, containedEquipmentIds: string[]) => void
  queueConnection: (connection: Connection, waypoints?: { x: number; y: number }[]) => void
  closeCableDialog: () => void
  createCableFromPending: (draft: CableDraft) => void
  /** #294 — Port-Konflikt: bestehendes Kabel(n) auf dem Ziel-Port loeschen
   *  und dann den normalen Cable-Create-Flow (CableDialog) starten. */
  resolvePortConflictByReplace: () => void
  /** #294 — Port-Konflikt verwerfen, kein neues Kabel anlegen. */
  cancelPortConflict: () => void
  updateCable: (id: string, patch: Partial<Cable>) => void
  deleteEquipment: (id: string) => void
  deleteCable: (id: string) => void
  deleteSelected: () => void
  reconnectCable: (
    cableId: string,
    endpoint: 'source' | 'target',
    equipmentId: string,
    portId: string,
  ) => void
  addOpenEndStub: (
    at: { x: number; y: number },
    connectorType: Port['connectorType'],
    side: 'input' | 'output',
  ) => string
  clear: () => void
  addCustomTemplate: (template: EquipmentTemplate) => void
  addCustomTemplates: (templates: EquipmentTemplate[]) => void
  /** v7.9.70 / #171 — Rebuild library entries for every Rentman-tagged
   *  canvas equipment whose template was lost. Returns the count of
   *  templates that were added/patched. */
  resyncRentmanLibraryFromCanvas: () => number
  removeCustomTemplate: (name: string) => void
  setCustomTemplateCategory: (name: string, category: string) => void
  renameCustomCategory: (oldCategory: string, newCategory: string) => void
  /** Update name and/or category of an existing library template. */
  updateCustomTemplate: (currentName: string, patch: { name?: string; category?: string }) => void
  /** v7.9.13 — Markiert ein Library-Template permanent als 19"-Rack-
   *  Gerät mit gegebener HE-Höhe. Nutzt der Rack-Builder wenn der User
   *  ein Nicht-Rack-Template hinzufügt und im Dialog bestätigt dass
   *  das Template global als Rack-Gerät zur Verfügung stehen soll. */
  markTemplateAsRack: (name: string, rackUnits: number) => void
  /** Overwrite a template with the current equipment item's layout. */
  saveEquipmentAsTemplate: (equipmentId: string) => void
  /** Save the current equipment item as a new library template under the given name. */
  saveEquipmentAsNewTemplate: (equipmentId: string, newName: string, category?: string) => void
  /** Toggle favorite flag on a library template. */
  toggleTemplateFavorite: (name: string) => void
  /** Toggle hidden flag on a library template. */
  toggleTemplateHidden: (name: string) => void
  /** Replace the entire custom library (e.g. after a Sync Pull). */
  setCustomLibrary: (templates: EquipmentTemplate[]) => void
  knownCategories: string[]
  addKnownCategories: (categories: string[]) => void
  /** v7.9.5 — Kategorien-Reihenfolge per Drag&Drop ändern.
   *  Übernimmt den exakten gegebenen Order ohne Re-Sortieren. */
  reorderCategories: (newOrder: string[]) => void
  groupPresets: GroupPreset[]
  addGroupPreset: (preset: GroupPreset) => void
  saveGroupPreset: (name: string, equipmentIds: string[]) => void
  deleteGroupPreset: (id: string) => void
  placeGroupPreset: (presetId: string, x: number, y: number) => void
  /** v7.9.15 — Black-Box-Einfügen eines GroupPreset/Rack-Presets:
   *  EIN Equipment-Item das das ganze Rack repräsentiert. Externe
   *  Ports = alle Ports die nicht in preset.cables vorkommen.
   *  rackInternalSnapshot trägt die internen Verbindungen mit. */
  insertBlackBoxRack: (presetId: string, x: number, y: number) => void
  /** v7.9.105 / Issue #224 — Edit-in-Place fuer ein bereits im Canvas
   *  liegendes Black-Box-Rack. Synthesiert Ports + rackInternalSnapshot
   *  aus dem übergebenen GroupPreset und ersetzt die im equipment, OHNE
   *  die Library-Preset zu touchen. Port-IDs werden wo moeglich erhalten
   *  (Match per rackOriginDeviceIndex + rackOriginPortName) damit
   *  externe Kabel ihre Verbindungen behalten. */
  replaceCanvasRackWithPreset: (equipmentId: string, preset: GroupPreset) => void
  /** Replace all group presets (e.g. after a Sync Pull). */
  setGroupPresets: (presets: GroupPreset[]) => void
  /** v7.9.6 — Drag&Drop-Reorder der groupPresets. Fehlende IDs werden
   *  angehängt, damit ein Teil-Reorder (nur Groups-Tab oder nur Racks-
   *  Tab) den jeweils anderen Subset nicht verliert. */
  reorderGroupPresets: (newOrder: string[]) => void
  /** v7.9.7 — Group-/Rack-Preset umbenennen. */
  renameGroupPreset: (id: string, newName: string) => void
  /** Save or replace the GreenGo intercom planning config in the project. */
  updateGreenGoConfig: (config: GreenGoConfig) => void
  /** v7.9.3 — Mobile-Viewer Check-State setzen (vom POST /checks-IPC).
   *  Komplettes Objekt-Replace damit gelöschte Checks (false → kein
   *  key) auch übernommen werden. */
  setCheckState: (checks: { ports: Record<string, boolean>; cables: Record<string, boolean> }) => void
  /** Einzelnen Port-Check (Mobile-Haeckchen) im Canvas entfernen.
   *  User-Request: "man muss die haken an den ports die man mobil
   *  gemacht hat im normalen canvas auch wieder loeschen koennen". */
  clearPortCheck: (deviceId: string, portId: string) => void
  /** Einzelnen Cable-Check (Mobile-Haeckchen) im Canvas entfernen. */
  clearCableCheck: (cableId: string) => void
  /** Alle Mobile-Haeckchen (Ports + Kabel) auf einmal zuruecksetzen. */
  clearAllMobileChecks: () => void
  /** v7.9.54 — Vom Mobile-Viewer hinzugefügtes Kabel ins Projekt. Wird
   *  mit addedFromMobile=true markiert (Canvas zeigt 📱-Badge). */
  addCableFromMobile: (input: {
    fromEquipmentId: string
    fromPortId: string
    toEquipmentId: string
    toPortId: string
    name?: string
    type?: string
    length?: number
    color?: string
    notes?: string
  }) => void
  /** v7.9.3 — Planungs-Status: 'editing' (default), 'finalized' (Canvas
   *  read-only, vom Plan-Eigentümer setzbar), 'viewer' (durch Import
   *  einer .cpviewer-Datei, permanent read-only). */
  setProjectMode: (mode: 'editing' | 'finalized' | 'viewer') => void
  /** v7.9.3 — Annotations-CRUD für Viewer-Modus. */
  addAnnotation: (annotation: import('../types/project').ProjectAnnotation) => void
  updateAnnotation: (id: string, patch: Partial<import('../types/project').ProjectAnnotation>) => void
  removeAnnotation: (id: string) => void
  /** v7.9.3 — Setzt Viewer-Session-Author (beim ersten Öffnen einer
   *  .cpviewer-Datei). */
  setViewerSession: (session: { author: string; startedAt: string } | undefined) => void
}

const now = () => new Date().toISOString()

const defaultProject = (): CablePlannerProject => ({
  metadata: {
    name: 'Untitled Project',
    description: '',
    createdAt: now(),
    updatedAt: now(),
    defaultVideoFormat: '1080p50',
  },
  equipment: [],
  cables: [],
  locations: [],
  canvasState: { x: 0, y: 0, zoom: 1 },
})

/**
 * Heal a project loaded from disk: round every equipment / location position
 * (and width/height where applicable) to an integer. Older project files
 * saved before the snap-on-add fix can contain sub-pixel floats from
 * `screenToFlowPosition` at non-integer zoom (e.g. `-135.333`). Without this
 * pass, opening such a file shows devices visibly shifted by individual
 * sub-pixel deltas — exactly the "verschoben beim Öffnen" symptom.
 *
 * We don't try to snap to the user's current grid here because the user's
 * grid may differ from the one used when the file was created. Plain integer
 * rounding is enough to remove the visible drift and is reversible (the
 * shift is in the order of fractions of a pixel, never more).
 */
const healProjectPositions = (project: CablePlannerProject): CablePlannerProject => {
  // v7.9.100 — Snap-to-Grid-Heal: alle Equipment-/Location-/Waypoint-
  // Koordinaten + Maße auf gridSize-Vielfache runden. Alte Projekte
  // (vor snapToGrid-Default) haben x=137, width=215 usw. → liegen
  // permanent zwischen den Dot-Reihen. Heal beim Load snappt alles auf
  // 11er-Raster damit Geräte-Kanten und Port-Handles auf den
  // Background-Dots sitzen. User kann das Raster in den Settings
  // ändern; heilen aber tun wir mit dem aktuellen gridSize, weil das
  // dem aktuell sichtbaren Background entspricht.
  // Snap deaktiviert (snapToGrid=false oder gridSize<=0) → nur runden,
  // nicht snappen.
  const ui = useUiStore.getState()
  const snap = ui.snapToGrid && ui.gridSize > 0 ? ui.gridSize : 0
  const snapVal = (v: unknown, fallback = 0): number => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
    if (snap > 0) return Math.round(v / snap) * snap
    return Math.round(v)
  }
  const r = (v: unknown): number => snapVal(v, 0)
  return {
    ...project,
    equipment: project.equipment.map((item) => ({
      ...item,
      x: r(item.x),
      y: r(item.y),
      width:
        typeof item.width === 'number'
          ? snap > 0
            ? Math.ceil(item.width / snap) * snap
            : Math.round(item.width)
          : item.width,
      height:
        typeof item.height === 'number'
          ? snap > 0
            ? Math.ceil(item.height / snap) * snap
            : Math.round(item.height)
          : item.height,
    })),
    cables: project.cables.map((c) => {
      let patched = c
      if (c.waypoints && c.waypoints.length > 0) {
        patched = { ...patched, waypoints: c.waypoints.map((w) => ({ x: r(w.x), y: r(w.y) })) }
      }
      // v7.9.93 / #123 — Layer-Auto-Heal: Kabel aus Projekten vor v7.9.85
      // haben kein layer-Feld → werden als 'other' behandelt → die
      // Layer-Toggle-Chips können sie sonst nicht filtern. Beim Load alle
      // Kabel ohne layer durch die detectLayerForConnector-Heuristik
      // jagen damit die Ebenen-Funktion nachträglich greift. User kann
      // manuell überschreiben (CableProperties → Ebene-Dropdown).
      // v7.9.95: detectLayerForConnector liefert jetzt immer einen Layer
      // (Fallback 'other'), daher der if(auto)-Check entfällt.
      if (!patched.layer) {
        patched = { ...patched, layer: detectLayerForConnector(patched.type) }
      }
      // v7.9.112 / Issue #234 — Legacy labelHidden=true wird ersetzt
      // durch labelPosition='none'. labelHidden bleibt aus Backward-
      // Compat im Schema, wird aber nicht mehr aktiv genutzt.
      if (patched.labelHidden === true && patched.labelPosition !== 'none') {
        patched = { ...patched, labelPosition: 'none', labelHidden: undefined }
      }
      return patched
    }),
    // v7.9.93 / #194 — moveContents-Default-Heal für alte Locations:
    // undefined → true (siehe addLocation Default seit v7.9.81).
    // v7.9.100 — Auch Location-Rahmen aufs Snap-Grid (width/height per
    // ceil damit der Rahmen nicht plötzlich kleiner wird und einen
    // Inhalt abschneidet).
    locations: (project.locations ?? []).map((loc) => ({
      ...loc,
      x: r(loc.x),
      y: r(loc.y),
      width: snap > 0 ? Math.ceil(loc.width / snap) * snap : Math.round(loc.width),
      height: snap > 0 ? Math.ceil(loc.height / snap) * snap : Math.round(loc.height),
      moveContents: loc.moveContents !== false,
    })),
  }
}

/**
 * v7.9.70 / #171 — Heal Rentman-Library beim Project-Load.
 *
 * Problem: Alte Projekte haben Canvas-Equipment mit `rentmanId` gesetzt,
 * aber die zugehörigen Library-Templates fehlen — entweder weil sie auf
 * einer anderen Maschine angelegt wurden, weil der User die Library
 * gelöscht hat, oder weil das Projekt aus einer Version stammt, in der
 * der Library-Sync noch nicht aktiv war. Folge: "R"-Badge zeigt auf
 * Canvas, aber die Sidebar-Liste "Importierte Rentman-Geräte" ist leer.
 *
 * Fix:
 *  1. Für jedes Equipment mit rentmanId scannen wir die customLibrary.
 *  2. Match per rentmanId zuerst (idempotent, garantiert kein Doppelter).
 *     - Wenn Template gefunden aber rentmanSource fehlt: ergänzen.
 *  3. Sonst Match per Name (Equipment-Name = Template-Name).
 *     - Wenn gefunden: rentmanId + rentmanSource ergänzen.
 *  4. Sonst: aus dem Equipment-Snapshot ein neues Template synthetisieren
 *     (Ports, Dimensions, Front/Rear-Panel-URL, Kategorie etc.).
 *
 * rentmanSource kommt aus project.metadata.rentmanProjectId (best-guess),
 * rentmanProjectName aus project.metadata.rentmanProjectName.
 *
 * Bestehende Library-Einträge ohne Rentman-Bezug bleiben unangetastet.
 */
const healRentmanLibraryFromProject = (
  project: CablePlannerProject,
  customLibrary: EquipmentTemplate[],
): EquipmentTemplate[] => {
  const projectRentmanId = project.metadata.rentmanProjectId
  const projectRentmanName = project.metadata.rentmanProjectName
  const rentmanEquipment = project.equipment.filter(
    (e) => e.rentmanId && !e.rentmanRemoved,
  )
  if (rentmanEquipment.length === 0) return customLibrary

  // Indexes für schnelles Lookup.
  const libraryByRentmanId = new Map<string, EquipmentTemplate>()
  const libraryByName = new Map<string, EquipmentTemplate>()
  for (const t of customLibrary) {
    if (t.rentmanId) libraryByRentmanId.set(t.rentmanId, t)
    libraryByName.set(t.name, t)
  }

  const updates = new Map<string, EquipmentTemplate>() // key = template name
  for (const eq of rentmanEquipment) {
    const rid = eq.rentmanId!
    const existing = libraryByRentmanId.get(rid) ?? libraryByName.get(eq.name)
    if (existing) {
      const needsHeal =
        !existing.rentmanId ||
        (projectRentmanId && existing.rentmanSource !== projectRentmanId) ||
        (projectRentmanName && existing.rentmanProjectName !== projectRentmanName)
      if (needsHeal) {
        updates.set(existing.name, {
          ...existing,
          rentmanId: existing.rentmanId || rid,
          rentmanSource: existing.rentmanSource || projectRentmanId,
          rentmanProjectName: existing.rentmanProjectName || projectRentmanName,
        })
      }
    } else {
      // Vollständig synthetisieren aus dem Equipment-Snapshot.
      const synthesized: EquipmentTemplate = {
        name: eq.name,
        category: eq.category || 'Sonstiges',
        inputs: eq.inputs,
        outputs: eq.outputs,
        width: eq.width,
        height: eq.height,
        isRackDevice: eq.isRackDevice,
        rackUnits: eq.rackUnits,
        frontPanelImageUrl: eq.frontPanelImageUrl,
        rearPanelImageUrl: eq.rearPanelImageUrl,
        frontPanelCrop: eq.frontPanelCrop,
        rearPanelCrop: eq.rearPanelCrop,
        netboxPath: eq.netboxPath,
        notes: eq.notes,
        rentmanId: rid,
        rentmanSource: projectRentmanId,
        rentmanProjectName: projectRentmanName,
      }
      updates.set(synthesized.name, synthesized)
    }
  }

  if (updates.size === 0) return customLibrary
  // Existing entries first (untouched), then overrides — Map.set in array
  // form: existing → patched. Items not in updates bleiben unverändert.
  return customLibrary
    .map((t) => updates.get(t.name) ?? t)
    .concat(
      Array.from(updates.values()).filter(
        (u) => !customLibrary.some((t) => t.name === u.name),
      ),
    )
}

const shouldSyncRentmanTemplateCache = (patch: Partial<EquipmentItem>): boolean => {
  const keys = Object.keys(patch) as Array<keyof EquipmentItem>
  // Ignore pure position updates to avoid excessive localStorage writes while dragging.
  return keys.some((key) => key !== 'x' && key !== 'y')
}

/** v7.8.4 — set-rate guard. When the store mutates more than
 *  PROJECT_RATE_THRESHOLD times within PROJECT_RATE_WINDOW_MS, throw
 *  so the React error boundary captures the stack with a real
 *  pointer to the offending caller. Without this, the silent #185
 *  loop just chews the renderer with no actionable info. */
const PROJECT_RATE_THRESHOLD = 80
const PROJECT_RATE_WINDOW_MS = 250
let projectRecentSetTs: number[] = []
const checkProjectSetRate = () => {
  const now = Date.now()
  projectRecentSetTs.push(now)
  projectRecentSetTs = projectRecentSetTs.filter((t) => now - t <= PROJECT_RATE_WINDOW_MS)
  if (projectRecentSetTs.length > PROJECT_RATE_THRESHOLD) {
    const count = projectRecentSetTs.length
    projectRecentSetTs = []
    throw new Error(
      `[CablePlanner] projectStore set-rate guard tripped: ${count} mutations in ${PROJECT_RATE_WINDOW_MS} ms. Render-loop suspected — captured stack pinpoints the offending caller.`,
    )
  }
}

/** v7.9.9 — Store-Factory. Erlaubt sowohl die Default-Instanz mit
 *  Autoload aus localStorage (Main-Canvas) als auch parallele
 *  Scratch-Instanzen für Sub-Canvas-Use-Cases wie der RackInternal-
 *  Canvas. Action-Definitionen sind in beiden Fällen identisch; nur
 *  die Init-Quelle des Projects unterscheidet sich.
 *
 *  Scratch-Instanzen bekommen weder die Autosave-Subscription noch
 *  den Rate-Guard — Autosave würde sonst den localStorage des
 *  Main-Projects überschreiben, und der Rate-Guard ist nur sinnvoll
 *  für die langlebige Default-Instanz. */
const buildProjectStore = (
  opts: { initialProject?: CablePlannerProject } = {},
): StateCreator<ProjectState> => (set, get, store) => ({
  ...createLocationSlice(set, get, store),
  ...createCableSlice(set, get, store),
  project:
    opts.initialProject ??
    (() => {
      const auto = loadAutosavedProject()
      return auto ? healProjectPositions(auto) : defaultProject()
    })(),
  projectVersion: 0,
  showCableDialog: false,
  recentProjects: [],
  customLibrary: loadCustomLibrary(),
  knownCategories: loadKnownCategories(),
  setRecentProjects: (items) => set({ recentProjects: items }),
  setFilePath: (path) => set({ filePath: path }),
  loadProject: (project, filePath) =>
    set((state) => {
      // v7.9.70 / #171 — Rentman-Sync-Heal beim Project-Load.
      // Wenn das Projekt Equipment mit rentmanId enthält, aber die zugehörigen
      // EquipmentTemplates fehlen in customLibrary (oder haben keinen
      // rentmanSource gesetzt), bauen wir sie automatisch nach. Damit
      // tauchen alte Rentman-Imports nach dem Re-Open wieder in der
      // "Importierte Rentman-Geräte"-Liste auf, ohne dass der User alles
      // neu anlegen muss.
      const healedLibrary = healRentmanLibraryFromProject(project, state.customLibrary)
      return {
        project: healProjectPositions(project),
        filePath,
        projectVersion: state.projectVersion + 1,
        selectedEquipmentId: undefined,
        selectedCableId: undefined,
        pendingConnection: undefined,
        showCableDialog: false,
        customLibrary: healedLibrary,
      }
    }),
  setProjectMeta: (name, description) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        metadata: {
          ...state.project.metadata,
          name,
          description,
        },
      }),
    })),
  updateProjectMetadata: (patch) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        metadata: {
          ...state.project.metadata,
          ...patch,
        },
      }),
    })),
  setDefaultVideoFormat: (id) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        metadata: {
          ...state.project.metadata,
          defaultVideoFormat: id as CablePlannerProject['metadata']['defaultVideoFormat'],
        },
      }),
    })),
  setCanvasState: (x, y, zoom) =>
    set((state) => ({
      project: {
        ...state.project,
        canvasState: { x, y, zoom },
      },
    })),
  addEquipment: (equipment) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      return {
      // Adding from the Library (click / drag-drop) must NOT keep any prior
      // selection live, because React Flow's internal multi-select would
      // otherwise cause the next pointer-down on the canvas to start a
      // group-drag that visibly moves the previously selected device(s).
      selectedEquipmentId: undefined,
      selectedCableId: undefined,
      selectedLocationId: undefined,
      project: touchProject({
        ...state.project,
        equipment: [
          ...state.project.equipment,
          {
            ...equipment,
            id: uuidv4(),
            // v7.9.63 / #172 — Default-Gerätefarbe aus uiStore wenn der
            // Caller selber keine nodeColor mitschickt. So kann der User
            // in Settings einmal eine Standardfarbe wählen, die für alle
            // neu hinzugefügten Geräte gilt.
            nodeColor: equipment.nodeColor ?? useUiStore.getState().defaultDeviceColor,
            // CRITICAL: Ensure x/y are valid numbers. If somehow they're undefined/NaN,
            // default to (0, 0) so equipment doesn't disappear.
            x: equipment.x !== undefined && !Number.isNaN(equipment.x) ? equipment.x : 0,
            y: equipment.y !== undefined && !Number.isNaN(equipment.y) ? equipment.y : 0,
            // Ensure every port gets a unique id. Some library helpers seed
            // templates with `id: ''` and rely on the store to assign ids on
            // placement — without this, all handles on the node would share
            // the empty string and ReactFlow would always snap new cables to
            // the first handle.
            inputs: equipment.inputs.map((p) =>
              sanitizePort(p, p.name ?? 'Input'),
            ),
            outputs: equipment.outputs.map((p) =>
              sanitizePort(p, p.name ?? 'Output'),
            ),
          },
        ],
      }),
      }
    }),
  importEquipment: (equipment) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      return {
      project: touchProject({
        ...state.project,
        equipment: [
          ...state.project.equipment,
          ...equipment.map((item) => ({
            ...item,
            id: item.id || uuidv4(),
            // CRITICAL: Ensure x/y are valid numbers. Equipment being imported
            // should have positions, but if somehow they don't, default to (0, 0)
            // to prevent disappearing equipment.
            x: item.x !== undefined && !Number.isNaN(item.x) ? item.x : 0,
            y: item.y !== undefined && !Number.isNaN(item.y) ? item.y : 0,
            inputs: item.inputs.map((p, index) => sanitizePort(p, `In ${index + 1}`)),
            outputs: item.outputs.map((p, index) => sanitizePort(p, `Out ${index + 1}`)),
          })),
        ],
      }),
      }
    }),
  importGraphml: (payload) => {
    const newIds: string[] = []
    set((state) => {
      // In 'replace' mode we throw out the existing GraphML-imported
      // equipment + cables before inserting the new snapshot, so the
      // caller never has to pre-clean. Manually-added items are kept.
      const baseEquipment = payload.mode === 'replace'
        ? state.project.equipment.filter((e) => e.importSource !== 'graphml')
        : state.project.equipment
      const baseCables = payload.mode === 'replace'
        ? state.project.cables.filter((c) => !c.graphmlEdgeId)
        : state.project.cables

      // Build the new equipment items with fresh uuids and sanitized
      // ports. We retain a deviceImportKey → fresh-id map for the
      // cable resolution pass below.
      const deviceImportKeyToId = new Map<string, string>()
      const portImportKeyToId = new Map<string, string>()
      const insertedEquipment = payload.devices.map((draft) => {
        const id = uuidv4()
        deviceImportKeyToId.set(draft.importKey, id)
        newIds.push(id)
        const inputs = draft.inputs.map((p, idx) => {
          const port = sanitizePort(p, `In ${idx + 1}`)
          const key = payload.portIndex
          // Reverse-lookup: find the importKey for (deviceImportKey, 'in', idx)
          for (const [importKey, ref] of Object.entries(key)) {
            if (ref.deviceImportKey === draft.importKey && ref.side === 'in' && ref.index === idx) {
              portImportKeyToId.set(importKey, port.id)
              break
            }
          }
          return port
        })
        const outputs = draft.outputs.map((p, idx) => {
          const port = sanitizePort(p, `Out ${idx + 1}`)
          const key = payload.portIndex
          for (const [importKey, ref] of Object.entries(key)) {
            if (ref.deviceImportKey === draft.importKey && ref.side === 'out' && ref.index === idx) {
              portImportKeyToId.set(importKey, port.id)
              break
            }
          }
          return port
        })
        return {
          ...draft,
          id,
          importSource: 'graphml' as const,
          x: Number.isFinite(draft.x) ? draft.x : 0,
          y: Number.isFinite(draft.y) ? draft.y : 0,
          inputs,
          outputs,
        }
      })

      const ui = useUiStore.getState()
      const insertedCables: Cable[] = []
      for (const draft of payload.cables) {
        const fromEquipmentId = deviceImportKeyToId.get(draft.sourceDeviceImportKey)
        const toEquipmentId = deviceImportKeyToId.get(draft.targetDeviceImportKey)
        const fromPortId = portImportKeyToId.get(draft.sourcePortImportKey)
        const toPortId = portImportKeyToId.get(draft.targetPortImportKey)
        // Cables whose endpoints didn't make it through the device/port
        // mapping are dropped silently — the dialog already surfaced
        // them as unresolved before the user clicked Import.
        if (!fromEquipmentId || !toEquipmentId || !fromPortId || !toPortId) continue
        insertedCables.push({
          id: uuidv4(),
          name: draft.name,
          type: draft.type,
          length: draft.length,
          color: draft.color,
          fromEquipmentId,
          fromPortId,
          toEquipmentId,
          toPortId,
          notes: draft.notes ?? '',
          standard: draft.standard,
          cableSpecId: draft.cableSpecId,
          // yEd-imported cables ship their original bend points so the
          // canvas matches the source diagram 1:1. If there are no
          // waypoints the auto-routing kicks in via the user's default
          // routing mode (orthogonal / straight / curved).
          routing: draft.waypoints && draft.waypoints.length > 0 ? 'straight' : ui.defaultRouting,
          waypoints: draft.waypoints && draft.waypoints.length > 0 ? draft.waypoints : undefined,
          arrowEnd: ui.defaultArrow,
          strokeWidth: 2.5,
          graphmlEdgeId: draft.graphmlEdgeId,
        })
      }

      // Compute the bounding box of the just-inserted devices and pan
      // the viewport onto it. Without this the user clicks Import and
      // sees nothing — yEd diagrams typically sit at (-1400..+2500) on
      // both axes, well outside the visible canvas. We bump
      // projectVersion so the existing setViewport effect in
      // CanvasArea picks the new canvasState up.
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const d of insertedEquipment) {
        if (d.x < minX) minX = d.x
        if (d.y < minY) minY = d.y
        const w = d.width ?? 240
        const h = d.height ?? 120
        if (d.x + w > maxX) maxX = d.x + w
        if (d.y + h > maxY) maxY = d.y + h
      }
      // Approximate the visible canvas area. The real value depends on
      // the user's library / properties panel widths, but the constants
      // below produce a sensible default for both default and collapsed
      // layouts.
      // v7.9.23 — vorher hardcoded 1200x700; jetzt aus VIEWPORT_DEFAULTS.
      // TODO: an die tatsächliche Canvas-Größe binden (ResizeObserver auf
      // dem CanvasArea-Wrapper) — derzeit ist es ein Fallback.
      const VIEWPORT_W = VIEWPORT_DEFAULTS.FALLBACK_WIDTH
      const VIEWPORT_H = VIEWPORT_DEFAULTS.FALLBACK_HEIGHT
      let canvasState = state.project.canvasState
      if (Number.isFinite(minX)) {
        const bboxW = Math.max(1, maxX - minX)
        const bboxH = Math.max(1, maxY - minY)
        // Fit-to-view zoom: pick whichever axis is more constraining,
        // cap at 1 so we never zoom in past 100%, and add 10% margin
        // on each side so labels at the edge stay readable.
        const fitZoom = Math.min(
          1,
          (VIEWPORT_W * 0.9) / bboxW,
          (VIEWPORT_H * 0.9) / bboxH,
        )
        const cx = (minX + maxX) / 2
        const cy = (minY + maxY) / 2
        canvasState = {
          x: VIEWPORT_W / 2 - cx * fitZoom,
          y: VIEWPORT_H / 2 - cy * fitZoom,
          zoom: Math.max(0.1, fitZoom),
        }
      }

      return {
        project: touchProject({
          ...state.project,
          equipment: [...baseEquipment, ...insertedEquipment],
          cables: [...baseCables, ...insertedCables],
          canvasState,
        }),
        // Triggers CanvasArea's setViewport effect so the user actually
        // sees the imported devices instead of an empty canvas.
        projectVersion: state.projectVersion + 1,
      }
    })
    return newIds
  },
  pasteEquipment: (items, cables, offset) => {
    if (items.length === 0) return []
    // Build remap tables so port refs in copied cables stay valid.
    const equipmentIdMap = new Map<string, string>()
    const portIdMap = new Map<string, string>()
    const newItems: EquipmentItem[] = items.map((item) => {
      const newId = uuidv4()
      equipmentIdMap.set(item.id, newId)
      const remapPorts = (ports: Port[], fallback: string): Port[] =>
        ports.map((p, index) => {
          const newPortId = uuidv4()
          if (p.id) portIdMap.set(p.id, newPortId)
          return {
            ...sanitizePort(p, p.name ?? `${fallback} ${index + 1}`),
            id: newPortId,
          }
        })
      return {
        ...item,
        id: newId,
        // CRITICAL: Ensure x/y remain valid after offset application.
        // Prevent equipment from disappearing if somehow x/y become NaN.
        x: !Number.isNaN(item.x + offset.dx) ? item.x + offset.dx : item.x,
        y: !Number.isNaN(item.y + offset.dy) ? item.y + offset.dy : item.y,
        inputs: remapPorts(item.inputs, 'In'),
        outputs: remapPorts(item.outputs, 'Out'),
        // Drop port-keyed VLAN map; ids are different now.
        portVlans: undefined,
        favorite: undefined,
        hidden: undefined,
      }
    })
    const newCables: Cable[] = []
    for (const cable of cables) {
      const fromEq = equipmentIdMap.get(cable.fromEquipmentId)
      const toEq = equipmentIdMap.get(cable.toEquipmentId)
      // Only clone cables whose both endpoints are in the pasted snapshot.
      if (!fromEq || !toEq) continue
      const fromPort = portIdMap.get(cable.fromPortId)
      const toPort = portIdMap.get(cable.toPortId)
      if (!fromPort || !toPort) continue
      newCables.push({
        ...cable,
        id: uuidv4(),
        fromEquipmentId: fromEq,
        toEquipmentId: toEq,
        fromPortId: fromPort,
        toPortId: toPort,
        waypoints: cable.waypoints?.map((wp) => ({
          x: wp.x + offset.dx,
          y: wp.y + offset.dy,
        })),
      })
    }
    set((state) => ({
      project: touchProject({
        ...state.project,
        equipment: [...state.project.equipment, ...newItems],
        cables: [...state.project.cables, ...newCables],
      }),
    }))
    return newItems.map((item) => item.id)
  },
  updateEquipment: (id, patch) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      const prev = state.project.equipment.find((e) => e.id === id)
      let updatedItem: EquipmentItem | undefined
      const nextEquipment = state.project.equipment.map((item) =>
        item.id === id
          ? ((updatedItem = { 
              ...item, 
              ...patch,
              // CRITICAL: Never allow position to become undefined or NaN. 
              // If patch accidentally omits x/y or sets them to undefined,
              // preserve the previous values to prevent equipment from disappearing.
              x: patch.x !== undefined && !Number.isNaN(patch.x) ? patch.x : item.x,
              y: patch.y !== undefined && !Number.isNaN(patch.y) ? patch.y : item.y,
            }), updatedItem)
          : item,
      )
      // If the equipment moved, also shift waypoints of cables attached to it
      // so the cable visually travels with the device (draw.io-style). When
      // only ONE endpoint moves, shifting *all* waypoints by the full delta
      // would break the path on the *other* (still-anchored) side and produce
      // an erratic, "spinning" orthogonal route. So we only shift the single
      // waypoint adjacent to the moving port (first for source, last for
      // target). When both endpoints sit on the same device we translate the
      // whole path.
      let nextCables = state.project.cables
      if (
        prev &&
        patch.x !== undefined &&
        patch.y !== undefined &&
        (patch.x !== prev.x || patch.y !== prev.y)
      ) {
        const dx = patch.x - prev.x
        const dy = patch.y - prev.y
        nextCables = state.project.cables.map((c) => {
          if (!c.waypoints || c.waypoints.length === 0) return c
          const touchesSource = c.fromEquipmentId === id
          const touchesTarget = c.toEquipmentId === id
          if (!touchesSource && !touchesTarget) return c
          if (touchesSource && touchesTarget) {
            return {
              ...c,
              waypoints: c.waypoints.map((w) => ({ x: w.x + dx, y: w.y + dy })),
            }
          }
          const next = c.waypoints.slice()
          if (touchesSource) {
            const w = next[0]
            next[0] = { x: w.x + dx, y: w.y + dy }
          } else {
            const lastIdx = next.length - 1
            const w = next[lastIdx]
            next[lastIdx] = { x: w.x + dx, y: w.y + dy }
          }
          return { ...c, waypoints: next }
        })
      }
      if (updatedItem?.rentmanId && shouldSyncRentmanTemplateCache(patch)) {
        upsertCachedRentmanTemplateFromEquipment(updatedItem)
      }

      // v7.9.125 — propagate port ConnectorType changes to connected
      // cables (Cable Connector Type Inheritance). Only kicks in when
      // ports actually changed connector type on THIS equipment.
      if (prev && updatedItem && useUiStore.getState().inheritCableTypeFromPort) {
        const oldPorts = new Map<string, string>(
          [...prev.inputs, ...prev.outputs].map((p) => [p.id, p.connectorType]),
        )
        const changedPortIds = new Set<string>()
        for (const p of [...updatedItem.inputs, ...updatedItem.outputs]) {
          const old = oldPorts.get(p.id)
          if (old !== undefined && old !== p.connectorType) changedPortIds.add(p.id)
        }
        if (changedPortIds.size > 0) {
          nextCables = nextCables.map((c) => {
            const touches =
              (c.fromEquipmentId === id && changedPortIds.has(c.fromPortId)) ||
              (c.toEquipmentId === id && changedPortIds.has(c.toPortId))
            if (!touches) return c
            const cableTypePatch = cableTypePatchFromPorts(c, nextEquipment)
            return cableTypePatch ? { ...c, ...cableTypePatch } : c
          })
        }
      }

      return {
        project: touchProject({
          ...state.project,
          equipment: nextEquipment,
          cables: nextCables,
        }),
      }
    }),
  setActiveDeviceMode: (equipmentId, modeId) =>
    set((state) => {
      const eq = state.project.equipment.find((e) => e.id === equipmentId)
      if (!eq || !eq.modes || eq.modes.length === 0) return {}
      const mode = modeId ? eq.modes.find((m) => m.id === modeId) : null
      if (modeId && !mode) return {}
      // Replace the live port arrays with the mode's snapshot (or
      // leave them as-is when clearing the active mode — the user can
      // still edit ports manually).
      const nextEquipment = state.project.equipment.map((item) =>
        item.id === equipmentId
          ? {
              ...item,
              activeModeId: mode?.id,
              inputs: mode ? mode.inputs.map((p) => ({ ...p })) : item.inputs,
              outputs: mode ? mode.outputs.map((p) => ({ ...p })) : item.outputs,
            }
          : item,
      )
      // v7.9.125 — mode switching replaces ports wholesale; matching
      // port-ids may now expose a different ConnectorType, so feed
      // affected cables through the inheritance helper too.
      let nextCables = state.project.cables
      if (mode && useUiStore.getState().inheritCableTypeFromPort) {
        nextCables = state.project.cables.map((c) => {
          if (c.fromEquipmentId !== equipmentId && c.toEquipmentId !== equipmentId) return c
          const cableTypePatch = cableTypePatchFromPorts(c, nextEquipment)
          return cableTypePatch ? { ...c, ...cableTypePatch } : c
        })
      }
      const updated = touchProject({
        ...state.project,
        equipment: nextEquipment,
        cables: nextCables,
      })
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  setSelection: (equipmentId, cableId, locationId) =>
    set({
      selectedEquipmentId: equipmentId,
      selectedCableId: cableId,
      selectedLocationId: locationId,
      selectedTemplateName: undefined,
    }),
  setSelectedTemplateName: (name) =>
    set({
      selectedTemplateName: name,
      selectedEquipmentId: undefined,
      selectedCableId: undefined,
      selectedLocationId: undefined,
    }),
  deleteEquipment: (id) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      return {
      project: touchProject({
        ...state.project,
        equipment: state.project.equipment.filter((item) => item.id !== id),
        cables: state.project.cables.filter(
          (cable) => cable.fromEquipmentId !== id && cable.toEquipmentId !== id,
        ),
      }),
      selectedEquipmentId:
        state.selectedEquipmentId === id ? undefined : state.selectedEquipmentId,
      }
    }),
  deleteSelected: () =>
    set((state) => {
      if (isProjectLocked(state)) return state
      if (state.selectedCableId) {
        return {
          project: touchProject({
            ...state.project,
            cables: state.project.cables.filter((item) => item.id !== state.selectedCableId),
          }),
          selectedCableId: undefined,
        }
      }
      if (state.selectedLocationId) {
        return {
          project: touchProject({
            ...state.project,
            locations: (state.project.locations ?? []).filter(
              (l) => l.id !== state.selectedLocationId,
            ),
          }),
          selectedLocationId: undefined,
        }
      }
      if (state.selectedEquipmentId) {
        return {
          project: touchProject({
            ...state.project,
            equipment: state.project.equipment.filter(
              (item) => item.id !== state.selectedEquipmentId,
            ),
            cables: state.project.cables.filter(
              (cable) =>
                cable.fromEquipmentId !== state.selectedEquipmentId &&
                cable.toEquipmentId !== state.selectedEquipmentId,
            ),
          }),
          selectedEquipmentId: undefined,
        }
      }
      return {}
    }),
  addOpenEndStub: (at, connectorType, side) => {
    const id = uuidv4()
    const portId = uuidv4()
    const stubPort: Port = {
      id: portId,
      name: 'Open End',
      type: connectorType,
      connectorType,
    }
    const stub: EquipmentItem = {
      id,
      name: `Open ${connectorType}`,
      category: 'Open End',
      inputs: side === 'input' ? [stubPort] : [],
      outputs: side === 'output' ? [stubPort] : [],
      x: at.x,
      y: at.y,
      width: 140,
      height: 60,
    }
    set((state) => ({
      project: touchProject({
        ...state.project,
        equipment: [...state.project.equipment, stub],
      }),
    }))
    // expose port id via returned stub id lookup — caller knows portId is first port
    // Actually caller needs the portId — we encode as `${id}|${portId}` for simplicity.
    return `${id}|${portId}`
  },
  clear: () => {
    // Also drop the persisted autosave copy — otherwise the old project
    // would come back on the next app launch, which is surprising when the
    // user explicitly started a fresh project.
    try {
      localStorage.removeItem(PROJECT_AUTOSAVE_KEY)
    } catch {
      /* ignore */
    }
    set((state) => ({
      project: defaultProject(),
      filePath: undefined,
      projectVersion: state.projectVersion + 1,
      selectedEquipmentId: undefined,
      selectedCableId: undefined,
    }))
  },
  addCustomTemplate: (template) =>
    set((state) => {
      const next = [...state.customLibrary.filter((t) => t.name !== template.name), template]
      persistCustomLibrary(next)
      if (template.rentmanId) upsertCachedRentmanTemplate(template)
      return { customLibrary: next }
    }),
  addCustomTemplates: (templates) =>
    set((state) => {
      const byName = new Map(state.customLibrary.map((t) => [t.name, t]))
      // Only add templates that don't already exist (don't overwrite user edits).
      templates.forEach((t) => {
        if (!byName.has(t.name)) byName.set(t.name, t)
      })
      const next = Array.from(byName.values())
      persistCustomLibrary(next)
      templates.forEach((template) => {
        if (template.rentmanId) upsertCachedRentmanTemplate(template)
      })
      return { customLibrary: next }
    }),
  resyncRentmanLibraryFromCanvas: () => {
    let addedOrPatched = 0
    set((state) => {
      const healed = healRentmanLibraryFromProject(state.project, state.customLibrary)
      // Count anything that changed (new entries OR existing entries that
      // got their rentmanSource/rentmanId patched).
      if (healed === state.customLibrary) return {}
      const byName = new Map(state.customLibrary.map((t) => [t.name, t]))
      for (const t of healed) {
        const prev = byName.get(t.name)
        if (!prev || prev !== t) addedOrPatched++
      }
      persistCustomLibrary(healed)
      // rentmanTemplateCache parallel updaten, sonst sieht die nächste
      // Re-Import-Diff den geheilten Eintrag nicht.
      for (const t of healed) {
        if (t.rentmanId) upsertCachedRentmanTemplate(t)
      }
      return { customLibrary: healed }
    })
    return addedOrPatched
  },
  removeCustomTemplate: (name) =>
    set((state) => {
      const next = state.customLibrary.filter((t) => t.name !== name)
      persistCustomLibrary(next)
      return { customLibrary: next }
    }),
  setCustomTemplateCategory: (name, category) =>
    set((state) => {
      const cat = category.trim() || 'Sonstiges'
      const next = state.customLibrary.map((t) =>
        t.name === name ? { ...t, category: cat } : t,
      )
      persistCustomLibrary(next)
      return { customLibrary: next }
    }),
  updateCustomTemplate: (currentName, patch) =>
    set((state) => {
      const newName = patch.name?.trim() || currentName
      const newCat = patch.category?.trim() || undefined
      const next = state.customLibrary.map((t) => {
        if (t.name !== currentName) return t
        return {
          ...t,
          name: newName,
          ...(newCat ? { category: newCat } : {}),
        }
      })
      persistCustomLibrary(next)
      const cats = new Set(state.knownCategories)
      if (newCat) cats.add(newCat)
      const catsSorted = Array.from(cats).sort((a, b) => a.localeCompare(b))
      persistKnownCategories(catsSorted)
      return { customLibrary: next, knownCategories: catsSorted }
    }),
  markTemplateAsRack: (name, rackUnits) =>
    set((state) => {
      const heightHE = Math.max(1, Math.min(LIMITS.MAX_RACK_HEIGHT_HE, Math.round(rackUnits)))
      const next = state.customLibrary.map((t) =>
        t.name === name
          ? { ...t, isRackDevice: true, rackUnits: heightHE }
          : t,
      )
      persistCustomLibrary(next)
      return { customLibrary: next }
    }),
  renameCustomCategory: (oldCategory, newCategory) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      const from = oldCategory.trim()
      const to = newCategory.trim()
      if (!from || !to || from === to) return {}
      // v7.9.7 — Echtes Umbenennen: Templates UND verbaute Geräte
      // migrieren, alten Kategorie-Namen aus knownCategories entfernen
      // (sonst bleibt eine leere Phantom-Kategorie in der Library
      // hängen) und manuelle Reihenfolge erhalten.
      const nextLib = state.customLibrary.map((t) =>
        t.category === from ? { ...t, category: to } : t,
      )
      persistCustomLibrary(nextLib)
      const nextEquipment = state.project.equipment.map((e) =>
        e.category === from ? { ...e, category: to } : e,
      )
      const orderedCats: string[] = []
      const seen = new Set<string>()
      for (const c of state.knownCategories) {
        const out = c === from ? to : c
        if (!seen.has(out)) {
          orderedCats.push(out)
          seen.add(out)
        }
      }
      if (!seen.has(to)) orderedCats.push(to)
      persistKnownCategories(orderedCats)
      return {
        customLibrary: nextLib,
        knownCategories: orderedCats,
        project: { ...state.project, equipment: nextEquipment },
      }
    }),
  addKnownCategories: (categories) =>
    set((state) => {
      const set_ = new Set(state.knownCategories)
      categories.forEach((c) => {
        const trimmed = c.trim()
        if (trimmed) set_.add(trimmed)
      })
      // v7.9.5 — Append NEU statt komplett zu sortieren, damit der User
      // seine manuelle Drag&Drop-Reihenfolge nicht verliert. Existing
      // categories behalten ihre Position; nur neue kommen ans Ende.
      const existing = state.knownCategories.filter((c) => set_.has(c))
      const added: string[] = []
      for (const c of set_) {
        if (!existing.includes(c)) added.push(c)
      }
      added.sort((a, b) => a.localeCompare(b))
      const next = [...existing, ...added]
      persistKnownCategories(next)
      return { knownCategories: next }
    }),
  reorderCategories: (newOrder) =>
    set((state) => {
      // Nur Kategorien akzeptieren die wir bereits kennen, in der
      // gegebenen Reihenfolge. Unbekannte werden ignoriert; ausgelassene
      // werden ans Ende gehängt um nichts zu verlieren.
      const known = new Set(state.knownCategories)
      const ordered: string[] = []
      const seen = new Set<string>()
      for (const c of newOrder) {
        if (known.has(c) && !seen.has(c)) {
          ordered.push(c)
          seen.add(c)
        }
      }
      for (const c of state.knownCategories) {
        if (!seen.has(c)) ordered.push(c)
      }
      persistKnownCategories(ordered)
      return { knownCategories: ordered }
    }),
  saveEquipmentAsTemplate: (equipmentId) =>
    set((state) => {
      const item = state.project.equipment.find((e) => e.id === equipmentId)
      if (!item) return {}
      // Build a template from the live equipment item (strip placement fields).
      const template: EquipmentTemplate = {
        name: item.name,
        category: item.category || 'Sonstiges',
        inputs: item.inputs,
        outputs: item.outputs,
        width: item.width,
        height: item.height,
        rentmanId: item.rentmanId,
        ipAddress: item.ipAddress,
        subnetMask: item.subnetMask,
        macAddress: item.macAddress,
        username: item.username,
        password: item.password,
        notes: item.notes,
        vlans: item.vlans,
        managementVlanId: item.managementVlanId,
        gateway: item.gateway,
        dnsServers: item.dnsServers,
        mgmtUrl: item.mgmtUrl,
        firmware: item.firmware,
        portVlans: item.portVlans,
        sdiCaps: item.sdiCaps,
        atemMvConfig: item.atemMvConfig,
        favorite: state.customLibrary.find((t) => t.name === item.name)?.favorite,
        hidden: state.customLibrary.find((t) => t.name === item.name)?.hidden,
      }
      const next = [
        ...state.customLibrary.filter((t) => t.name !== template.name),
        template,
      ]
      persistCustomLibrary(next)
      if (template.rentmanId) upsertCachedRentmanTemplate(template)
      return { customLibrary: next }
    }),
  saveEquipmentAsNewTemplate: (equipmentId, newName, category) =>
    set((state) => {
      const item = state.project.equipment.find((e) => e.id === equipmentId)
      if (!item) return {}
      const trimmed = newName.trim()
      if (!trimmed) return {}
      // If the target name already exists we treat the whole operation as a
      // no-op so we never accidentally overwrite a different template.
      if (state.customLibrary.some((t) => t.name === trimmed)) return {}
      const template: EquipmentTemplate = {
        name: trimmed,
        category: (category || item.category || 'Sonstiges').trim() || 'Sonstiges',
        inputs: item.inputs,
        outputs: item.outputs,
        width: item.width,
        height: item.height,
        rentmanId: item.rentmanId,
        ipAddress: item.ipAddress,
        subnetMask: item.subnetMask,
        macAddress: item.macAddress,
        username: item.username,
        password: item.password,
        notes: item.notes,
        vlans: item.vlans,
        managementVlanId: item.managementVlanId,
        gateway: item.gateway,
        dnsServers: item.dnsServers,
        mgmtUrl: item.mgmtUrl,
        firmware: item.firmware,
        portVlans: item.portVlans,
        sdiCaps: item.sdiCaps,
        atemMvConfig: item.atemMvConfig,
      }
      const next = [...state.customLibrary, template]
      persistCustomLibrary(next)
      if (template.rentmanId) upsertCachedRentmanTemplate(template)
      return { customLibrary: next }
    }),
  toggleTemplateFavorite: (name) =>
    set((state) => {
      const next = state.customLibrary.map((t) =>
        t.name === name ? { ...t, favorite: !t.favorite } : t,
      )
      persistCustomLibrary(next)
      return { customLibrary: next }
    }),
  toggleTemplateHidden: (name) =>
    set((state) => {
      const next = state.customLibrary.map((t) =>
        t.name === name ? { ...t, hidden: !t.hidden } : t,
      )
      persistCustomLibrary(next)
      return { customLibrary: next }
    }),
  setCustomLibrary: (templates) =>
    set(() => {
      persistCustomLibrary(templates)
      return { customLibrary: templates }
    }),
  groupPresets: loadGroupPresets(),
  addGroupPreset: (preset) =>
    set((state) => {
      const next = [...state.groupPresets.filter((p) => p.id !== preset.id), preset]
      persistGroupPresets(next)
      return { groupPresets: next }
    }),
  saveGroupPreset: (name, equipmentIds) =>
    set((state) => {
      const items = state.project.equipment.filter((e) => equipmentIds.includes(e.id))
      if (items.length < 2) return {}
      const minX = Math.min(...items.map((e) => e.x))
      const minY = Math.min(...items.map((e) => e.y))
      const idToIndex = new Map(items.map((e, i) => [e.id, i]))
      const idSet = new Set(equipmentIds)
      const internalCables = state.project.cables.filter(
        (c) => idSet.has(c.fromEquipmentId) && idSet.has(c.toEquipmentId),
      )
      const cableStubs = internalCables.map((c) => {
        const fromIdx = idToIndex.get(c.fromEquipmentId)!
        const toIdx = idToIndex.get(c.toEquipmentId)!
        const fromItem = items[fromIdx]
        const toItem = items[toIdx]
        const fromPort = [...fromItem.outputs, ...fromItem.inputs].find((p) => p.id === c.fromPortId)
        const toPort = [...toItem.inputs, ...toItem.outputs].find((p) => p.id === c.toPortId)
        return {
          fromItemIndex: fromIdx,
          fromPortName: fromPort?.name ?? '',
          toItemIndex: toIdx,
          toPortName: toPort?.name ?? '',
          name: c.name,
          type: c.type,
          length: c.length,
          color: c.color,
          standard: c.standard,
        }
      })
      const preset: GroupPreset = {
        id: uuidv4(),
        name,
        items: items.map((e) => ({
          name: e.name,
          category: e.category,
          inputs: e.inputs,
          outputs: e.outputs,
          width: e.width,
          height: e.height,
          notes: e.notes,
          ipAddress: e.ipAddress,
          resolution: e.resolution,
          displaySizeInch: e.displaySizeInch,
          offsetX: e.x - minX,
          offsetY: e.y - minY,
        })),
        cables: cableStubs,
      }
      const next = [...state.groupPresets, preset]
      persistGroupPresets(next)
      return { groupPresets: next }
    }),
  deleteGroupPreset: (id) =>
    set((state) => {
      const next = state.groupPresets.filter((p) => p.id !== id)
      persistGroupPresets(next)
      return { groupPresets: next }
    }),
  renameGroupPreset: (id, newName) =>
    set((state) => {
      const trimmed = newName.trim()
      if (!trimmed) return state
      const next = state.groupPresets.map((p) =>
        p.id === id ? { ...p, name: trimmed } : p,
      )
      persistGroupPresets(next)
      return { groupPresets: next }
    }),
  setGroupPresets: (presets) =>
    set(() => {
      persistGroupPresets(presets)
      return { groupPresets: presets }
    }),
  /** v7.9.6 — Reorder groupPresets. Accepts the desired ID order;
   *  anything not in the list is appended at the end so partial
   *  reorders (e.g. only racks, only non-racks) don't lose entries. */
  reorderGroupPresets: (newOrder) =>
    set((state) => {
      const idToPreset = new Map(state.groupPresets.map((p) => [p.id, p]))
      const ordered: GroupPreset[] = []
      const seen = new Set<string>()
      for (const id of newOrder) {
        const p = idToPreset.get(id)
        if (p && !seen.has(id)) {
          ordered.push(p)
          seen.add(id)
        }
      }
      for (const p of state.groupPresets) {
        if (!seen.has(p.id)) ordered.push(p)
      }
      persistGroupPresets(ordered)
      return { groupPresets: ordered }
    }),
  placeGroupPreset: (presetId, x, y) =>
    set((state) => {
      const preset = state.groupPresets.find((p) => p.id === presetId)
      if (!preset) return {}
      // Issue #61: when the preset carries `rack` metadata it represents
      // a 19" rack layout. Tag every spawned equipment item with a fresh
      // `rackInstanceId` + the preset name so the Rack-Editor can later
      // filter the canvas down to "just this rack" without us needing a
      // dedicated rack entity in the data model.
      const rackInstanceId = preset.rack ? `rack:${uuidv4()}` : undefined
      const rackInstanceLabel = preset.rack ? preset.name : undefined
      const placementByIndex = new Map<number, { startUnit: number; heightUnits: number }>()
      if (preset.rack) {
        for (const p of preset.rack.placements) {
          placementByIndex.set(p.itemIndex, { startUnit: p.startUnit, heightUnits: p.heightUnits })
        }
      }
      // v7.9.33 — Stempelt jedes platzierte Gerät mit dem aktuellen
      // Group-File-Stand damit Update-Prompt beim Projekt-Öffnen erkennt
      // wenn die Gruppe in der Library aktualisiert wurde.
      const groupRef = stampGroupLibraryRef(preset.name)
      // Create new equipment items with fresh IDs and port IDs.
      const newEquipment: EquipmentItem[] = preset.items.map((item, idx) => ({
        ...item,
        id: uuidv4(),
        x: x + item.offsetX,
        y: y + item.offsetY,
        inputs: item.inputs.map((p) => ({ ...p, id: uuidv4() })),
        outputs: item.outputs.map((p) => ({ ...p, id: uuidv4() })),
        rackInstanceId,
        rackInstanceLabel,
        rackInstanceStartUnit: placementByIndex.get(idx)?.startUnit,
        libraryRef: groupRef,
      }))
      // Build (itemIndex:portName) → new port ID lookup
      const portIdMap = new Map<string, string>()
      newEquipment.forEach((eq, idx) => {
        for (const p of [...eq.inputs, ...eq.outputs]) {
          portIdMap.set(`${idx}:${p.name}`, p.id)
        }
      })
      // Recreate cables between the newly placed items.
      const inheritType = useUiStore.getState().inheritCableTypeFromPort
      const newCables = preset.cables
        .map((stub): Cable | null => {
          const fromEqId = newEquipment[stub.fromItemIndex]?.id
          const toEqId = newEquipment[stub.toItemIndex]?.id
          const fromPortId = portIdMap.get(`${stub.fromItemIndex}:${stub.fromPortName}`)
          const toPortId = portIdMap.get(`${stub.toItemIndex}:${stub.toPortName}`)
          if (!fromEqId || !toEqId || !fromPortId || !toPortId) return null
          const cable: Cable = {
            id: uuidv4(),
            name: stub.name,
            type: stub.type as Cable['type'],
            length: stub.length,
            color: stub.color ?? '#64748b',
            fromEquipmentId: fromEqId,
            fromPortId,
            toEquipmentId: toEqId,
            toPortId,
            notes: '',
            standard: stub.standard as Cable['standard'],
          }
          // v7.9.125 — Snapshot-erzeugte Presets tragen oft type='unbekannt'
          // weil zum Snapshot-Zeitpunkt kein Typ verfuegbar war (siehe
          // LibraryPanel.tsx:786). Inheritance leitet den Typ frisch aus
          // den neuen Ports ab.
          if (inheritType) {
            const typePatch = cableTypePatchFromPorts(cable, newEquipment)
            if (typePatch) Object.assign(cable, typePatch)
          }
          return cable
        })
        .filter((c): c is Cable => c !== null)
      const updated = touchProject({
        ...state.project,
        equipment: [...state.project.equipment, ...newEquipment],
        cables: [...state.project.cables, ...newCables],
      })
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  insertBlackBoxRack: (presetId, x, y) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      const preset = state.groupPresets.find((p) => p.id === presetId)
      if (!preset) return state
      // v7.9.17 — ALLE Ports werden jetzt exponiert (vorher wurden
      // intern verkabelte Ports rausgefiltert). Internal-Ports tragen
      // rackInternallyConnected=true → EquipmentNode rendert sie
      // ausgegraut + non-connectable, damit der User sieht welche Ports
      // intern belegt sind. Die internen Kabel-Linien können dann
      // direkt zwischen den realen Port-Positionen gezeichnet werden.
      const usedPortNames = new Set<string>()
      for (const stub of preset.cables) {
        usedPortNames.add(`${stub.fromItemIndex}:${stub.fromPortName}`)
        usedPortNames.add(`${stub.toItemIndex}:${stub.toPortName}`)
      }
      const externalIns: import('../types/equipment').Port[] = []
      const externalOuts: import('../types/equipment').Port[] = []
      preset.items.forEach((item, idx) => {
        for (const p of item.inputs) {
          const isInternal = usedPortNames.has(`${idx}:${p.name}`)
          externalIns.push({
            ...p,
            id: uuidv4(),
            name: `${item.name} · ${p.name}`,
            rackOriginDeviceIndex: idx,
            rackOriginDeviceName: item.name,
            rackOriginPortName: p.name,
            rackInternallyConnected: isInternal,
          })
        }
        for (const p of item.outputs) {
          const isInternal = usedPortNames.has(`${idx}:${p.name}`)
          externalOuts.push({
            ...p,
            id: uuidv4(),
            name: `${item.name} · ${p.name}`,
            rackOriginDeviceIndex: idx,
            rackOriginDeviceName: item.name,
            rackOriginPortName: p.name,
            rackInternallyConnected: isInternal,
          })
        }
      })
      const totalUnits =
        preset.rack?.totalUnits ??
        preset.items.reduce((sum, item) => sum + (item.rackUnits ?? 1), 0)
      const newItem: EquipmentItem = {
        id: uuidv4(),
        name: `${preset.name} (Rack)`,
        category: 'Rack',
        inputs: externalIns,
        outputs: externalOuts,
        x,
        y,
        width: 280,
        height: 0,
        icon: '🗄',
        notes: `Black-Box-Rack: ${preset.items.length} Geräte, ${preset.cables.length} interne Verbindungen.`,
        rackInternalSnapshot: {
          items: preset.items.map((item, idx) => ({
            name: item.name,
            startUnit:
              preset.rack?.placements?.find((pl) => pl.itemIndex === idx)?.startUnit ??
              idx + 1,
            rackUnits:
              preset.rack?.placements?.find((pl) => pl.itemIndex === idx)?.heightUnits ??
              item.rackUnits ?? 1,
          })),
          cables: preset.cables.map((c) => ({
            fromItemIndex: c.fromItemIndex,
            fromPortName: c.fromPortName,
            toItemIndex: c.toItemIndex,
            toPortName: c.toPortName,
            color: c.color,
          })),
          totalUnits,
        },
      }
      const updated = touchProject({
        ...state.project,
        equipment: [...state.project.equipment, newItem],
      })
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // v7.9.105 / Issue #224 — Toolbar 'Rack bearbeiten' soll das im Canvas
  // selektierte Rack bearbeiten, nicht die Library-Preset. Diese Action
  // wendet die im RackBuilder editierten Aenderungen auf das konkrete
  // Equipment im Canvas an — Library bleibt unangetastet.
  replaceCanvasRackWithPreset: (equipmentId, preset) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      const target = state.project.equipment.find((e) => e.id === equipmentId)
      if (!target) return state
      // Identische Logic wie insertBlackBoxRack — Ports synthesieren aus
      // dem Preset, dann aber Port-IDs aus dem existing Equipment uebernehmen
      // wo (rackOriginDeviceIndex, rackOriginPortName) matcht, damit externe
      // Kabel ihre Verbindungen behalten.
      const portIdLookup = new Map<string, string>()
      for (const p of target.inputs) {
        if (typeof p.rackOriginDeviceIndex === 'number' && p.rackOriginPortName) {
          portIdLookup.set(`in:${p.rackOriginDeviceIndex}:${p.rackOriginPortName}`, p.id)
        }
      }
      for (const p of target.outputs) {
        if (typeof p.rackOriginDeviceIndex === 'number' && p.rackOriginPortName) {
          portIdLookup.set(`out:${p.rackOriginDeviceIndex}:${p.rackOriginPortName}`, p.id)
        }
      }
      const usedPortNames = new Set<string>()
      for (const stub of preset.cables) {
        usedPortNames.add(`${stub.fromItemIndex}:${stub.fromPortName}`)
        usedPortNames.add(`${stub.toItemIndex}:${stub.toPortName}`)
      }
      const externalIns: import('../types/equipment').Port[] = []
      const externalOuts: import('../types/equipment').Port[] = []
      preset.items.forEach((item, idx) => {
        for (const p of item.inputs) {
          const isInternal = usedPortNames.has(`${idx}:${p.name}`)
          const reusedId = portIdLookup.get(`in:${idx}:${p.name}`)
          externalIns.push({
            ...p,
            id: reusedId ?? uuidv4(),
            name: `${item.name} · ${p.name}`,
            rackOriginDeviceIndex: idx,
            rackOriginDeviceName: item.name,
            rackOriginPortName: p.name,
            rackInternallyConnected: isInternal,
          })
        }
        for (const p of item.outputs) {
          const isInternal = usedPortNames.has(`${idx}:${p.name}`)
          const reusedId = portIdLookup.get(`out:${idx}:${p.name}`)
          externalOuts.push({
            ...p,
            id: reusedId ?? uuidv4(),
            name: `${item.name} · ${p.name}`,
            rackOriginDeviceIndex: idx,
            rackOriginDeviceName: item.name,
            rackOriginPortName: p.name,
            rackInternallyConnected: isInternal,
          })
        }
      })
      const totalUnits =
        preset.rack?.totalUnits ??
        preset.items.reduce((sum, item) => sum + (item.rackUnits ?? 1), 0)
      const updatedEquipment = state.project.equipment.map((e) =>
        e.id === equipmentId
          ? {
              ...e,
              inputs: externalIns,
              outputs: externalOuts,
              rackInternalSnapshot: {
                items: preset.items.map((item, idx) => ({
                  name: item.name,
                  startUnit:
                    preset.rack?.placements?.find((pl) => pl.itemIndex === idx)?.startUnit ??
                    idx + 1,
                  rackUnits:
                    preset.rack?.placements?.find((pl) => pl.itemIndex === idx)?.heightUnits ??
                    item.rackUnits ??
                    1,
                })),
                cables: preset.cables.map((c) => ({
                  fromItemIndex: c.fromItemIndex,
                  fromPortName: c.fromPortName,
                  toItemIndex: c.toItemIndex,
                  toPortName: c.toPortName,
                  color: c.color,
                })),
                totalUnits,
              },
              notes: `Black-Box-Rack: ${preset.items.length} Geräte, ${preset.cables.length} interne Verbindungen.`,
            }
          : e,
      )
      const updated = touchProject({ ...state.project, equipment: updatedEquipment })
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  updateGreenGoConfig: (config) =>
    set((state) => {
      const updated = { ...state.project, greengoConfig: config }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  setCheckState: (checks) =>
    set((state) => {
      const updated = { ...state.project, checkState: checks }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  clearPortCheck: (deviceId, portId) =>
    set((state) => {
      const cur = state.project.checkState
      if (!cur) return state
      const key = `${deviceId}|${portId}`
      if (!cur.ports[key]) return state
      const nextPorts = { ...cur.ports }
      delete nextPorts[key]
      const updated = {
        ...state.project,
        checkState: { ports: nextPorts, cables: cur.cables },
      }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  clearCableCheck: (cableId) =>
    set((state) => {
      const cur = state.project.checkState
      if (!cur) return state
      if (!cur.cables[cableId]) return state
      const nextCables = { ...cur.cables }
      delete nextCables[cableId]
      const updated = {
        ...state.project,
        checkState: { ports: cur.ports, cables: nextCables },
      }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  clearAllMobileChecks: () =>
    set((state) => {
      const cur = state.project.checkState
      if (!cur) return state
      if (
        Object.keys(cur.ports).length === 0 &&
        Object.keys(cur.cables).length === 0
      ) {
        return state
      }
      const updated = {
        ...state.project,
        checkState: { ports: {}, cables: {} },
      }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  addCableFromMobile: (input) =>
    set((state) => {
      // #295 — Auch der Mobile-Pfad darf bei finalized/viewer-Mode keine
      // Kabel mehr einspielen. Der Mobile-Viewer sollte das eigentlich
      // bereits clientseitig unterbinden (read-only beim finalized Plan),
      // aber wir validieren server-side als Defense-in-Depth.
      if (isProjectLocked(state)) return {}
      // v7.9.54 — Kabel-Add vom Mobile-Viewer. Validiert dass beide
      // Endpoints (Equipment+Port-Pair) im aktuellen Projekt existieren;
      // sonst silently skip (Mobile zeigt eh nur das was im Projekt war).
      const fromEq = state.project.equipment.find((e) => e.id === input.fromEquipmentId)
      const toEq = state.project.equipment.find((e) => e.id === input.toEquipmentId)
      if (!fromEq || !toEq) return {}
      const fromPort =
        [...fromEq.inputs, ...fromEq.outputs].find((p) => p.id === input.fromPortId) ?? null
      const toPort =
        [...toEq.inputs, ...toEq.outputs].find((p) => p.id === input.toPortId) ?? null
      if (!fromPort || !toPort) return {}
      // Doppelte verhindern: gleiche Port-Combo schon mal verbunden? skip.
      const dupe = state.project.cables.some(
        (c) =>
          (c.fromPortId === input.fromPortId && c.toPortId === input.toPortId) ||
          (c.fromPortId === input.toPortId && c.toPortId === input.fromPortId),
      )
      if (dupe) return {}
      // v7.9.88 / #210 — Cable-Type-String → cableSpecId Lookup. Vorher
      // wurde nur `type` als Connector-String gesetzt; cableSpecId blieb
      // undefined → das Properties-Panel in der Hauptapp zeigte das
      // Kabel als "Custom" weil es keinen Spec-Eintrag gefunden hat.
      // Jetzt suchen wir im cableCatalog (+ uiStore.customCableSpecs)
      // einen Spec, dessen Name oder connectorType zum Input passt, und
      // setzen ihn. Plus Layer-Auto-Detect aus dem Connector-Typ.
      let resolvedSpecId: string | undefined
      let resolvedColor = input.color
      const typeStr = (input.type ?? '').trim()
      if (typeStr) {
        const ui = useUiStore.getState()
        const allSpecs = [
          ...cableCatalog,
          ...(ui.customCableSpecs ?? []),
        ]
        // Exakter Name-Match first, dann Substring-Fallback auf
        // connectorType, dann gar nichts.
        const exact = allSpecs.find((s) => s.name.toLowerCase() === typeStr.toLowerCase())
        const byConnector = !exact && allSpecs.find(
          (s) => String(s.connectorType).toLowerCase() === typeStr.toLowerCase(),
        )
        const match = exact ?? byConnector
        if (match) {
          resolvedSpecId = match.id
          if (!resolvedColor) resolvedColor = match.color
        }
      }
      const autoLayer = detectLayerForConnector(typeStr as Cable['type'])
      // v7.9.125 — wenn das Mobile keinen Type liefert, leiten wir
      // ihn aus den Ports ab statt 'unbekannt' zu stempeln (nur wenn
      // der Inheritance-Toggle an ist; sonst Legacy-Fallback).
      const fallbackType: Cable['type'] = useUiStore.getState().inheritCableTypeFromPort
        ? inheritedCableType(
            {
              fromEquipmentId: input.fromEquipmentId,
              fromPortId: input.fromPortId,
              toEquipmentId: input.toEquipmentId,
              toPortId: input.toPortId,
            },
            state.project.equipment,
          ) ?? ('unbekannt' as Cable['type'])
        : ('unbekannt' as Cable['type'])
      const cable: Cable = {
        id: uuidv4(),
        name: input.name?.trim() || `${fromEq.name} → ${toEq.name}`,
        type: (input.type as Cable['type']) || fallbackType,
        length: input.length ?? 0,
        color: resolvedColor ?? '#64748b',
        fromEquipmentId: input.fromEquipmentId,
        fromPortId: input.fromPortId,
        toEquipmentId: input.toEquipmentId,
        toPortId: input.toPortId,
        notes: input.notes ?? '',
        addedFromMobile: true,
        layer: autoLayer,
        ...(resolvedSpecId ? { cableSpecId: resolvedSpecId } : {}),
      }
      const updated = touchProject({
        ...state.project,
        cables: [...state.project.cables, cable],
      })
      scheduleProjectAutosave(updated)
      return { project: updated, projectVersion: state.projectVersion + 1 }
    }),
  setProjectMode: (mode) =>
    set((state) => {
      const updated = { ...state.project, mode }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  addAnnotation: (annotation) =>
    set((state) => {
      const existing = state.project.annotations ?? []
      const updated = { ...state.project, annotations: [...existing, annotation] }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  updateAnnotation: (id, patch) =>
    set((state) => {
      const existing = state.project.annotations ?? []
      const next = existing.map((a) => (a.id === id ? { ...a, ...patch } : a))
      const updated = { ...state.project, annotations: next }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  removeAnnotation: (id) =>
    set((state) => {
      const existing = state.project.annotations ?? []
      const updated = {
        ...state.project,
        annotations: existing.filter((a) => a.id !== id),
      }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  setViewerSession: (session) =>
    set((state) => {
      const updated = { ...state.project, viewerSession: session }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
})

// Default singleton — used everywhere via the existing `useProjectStore`
// import. Autoload aus localStorage, Autosave-Subscription, Rate-Guard.
export const useProjectStore = create<ProjectState>(buildProjectStore())

// v7.9.33 — Seed des Sync-Caches mit dem aus localStorage geladenen
// Stand. Damit weiß `syncDevicesToFolder` beim ersten Mutate-Call
// welche Items bereits in der zentralen Library liegen und schreibt
// nur den tatsächlichen Delta. Ohne den Seed würde die erste User-
// Aktion ALLE existierenden Items in den Folder schreiben + deren
// fileVersion bumpen — auch wenn sich am Item nichts geändert hat.
{
  const initial = useProjectStore.getState()
  seedLibrarySyncCache(initial.customLibrary, initial.groupPresets)
}

// Rate-Guard nur für die Default-Instanz (siehe Kommentar in
// buildProjectStore).
setTimeout(() => {
  useProjectStore.subscribe(() => checkProjectSetRate())
}, 0)

// Autosave the working project to localStorage whenever it changes.
useProjectStore.subscribe((state, prev) => {
  if (state.project !== prev.project) {
    scheduleProjectAutosave(state.project)
  }
})

/** v7.9.9 — Scratch-Store-Factory für Sub-Canvas-Use-Cases wie die
 *  Rack-internal-Verkabelung. Initialisiert ohne Autoload mit dem
 *  übergebenen Project. Es werden weder Autosave noch Rate-Guard
 *  registriert — der Scratch-Store ist eine kurzlebige, isolierte
 *  Mutations-Sandbox. */
export const createProjectStoreInstance = (initialProject: CablePlannerProject) =>
  create<ProjectState>(buildProjectStore({ initialProject }))

export const getProjectPayload = () => useProjectStore.getState().project
