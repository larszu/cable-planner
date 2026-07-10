import { v4 as uuidv4 } from 'uuid'
import { create, type StateCreator } from 'zustand'
import type { Connection } from 'reactflow'
import type { Cable } from '../types/cable'
import type { EquipmentItem, EquipmentTemplate, GroupPreset, Port } from '../types/equipment'
import type { LocationFrame } from '../types/location'
import type { CablePlannerProject } from '../types/project'
import { useUiStore } from './uiStore'
import { defaultProject, isProjectLocked, sanitizePort, touchProject } from './projectStoreHelpers'
import { createLocationSlice } from './slices/locationSlice'
import { createCableSlice } from './slices/cableSlice'
import { createAnnotationSlice } from './slices/annotationSlice'
import { createRevisionSlice } from './slices/revisionSlice'
import { createMobileSyncSlice } from './slices/mobileSyncSlice'
import { createTemplateSlice } from './slices/templateSlice'
import { createGroupPresetSlice } from './slices/groupPresetSlice'
import { createMetaSlice } from './slices/metaSlice'
import { createCategorySlice } from './slices/categorySlice'
import { createEquipmentSlice } from './slices/equipmentSlice'
import { createGroupPresetSpawnSlice } from './slices/groupPresetSpawnSlice'
import { createSelectionLifecycleSlice } from './slices/selectionLifecycleSlice'
import { createLifecycleSlice } from './slices/lifecycleSlice'
import { createPendingChangesSlice } from './slices/pendingChangesSlice'
import {
  loadCustomLibrary,
  persistCustomLibrary,
  loadKnownCategories,
  persistKnownCategories,
} from './libraryPersist'
import {
  loadCategoryTranslations,
  persistCategoryTranslations,
} from '../lib/categoryTranslations'
import { loadGroupPresets } from './groupPresetsPersist'
import { scheduleProjectAutosave } from './projectAutosave'
import { blackmagicTemplates } from '../lib/blackmagicCatalog'
import { detectLayerForConnector } from '../lib/cableLayers'
import { ubiquitiTemplates } from '../lib/ubiquitiCatalog'
import { monitorTemplates } from '../lib/monitorCatalog'
import { cameraTemplates } from '../lib/cameraCatalog'
import { miscTemplates } from '../lib/miscCatalog'
import { greengoTemplates } from '../lib/greengoCatalog'
import { ajaTemplates } from '../lib/ajaCatalog'
import { rossTemplates } from '../lib/rossCatalog'
import { lynxTemplates } from '../lib/lynxCatalog'
import { switcherTemplates } from '../lib/switcherCatalog'
import { avNetworkTemplates } from '../lib/avNetworkCatalog'
import { broadcastToolsTemplates } from '../lib/broadcastToolsCatalog'
import { audioTemplates } from '../lib/audioCatalog'
import { wirelessAudioTemplates } from '../lib/wirelessAudioCatalog'
import { micTemplates } from '../lib/micCatalog'
import { upsertCachedRentmanTemplate } from '../lib/rentmanTemplateCache'
import type { GreenGoConfig } from '../types/greengo'

type CableDraft = Pick<Cable, 'name' | 'type' | 'length' | 'color' | 'notes'> &
  Partial<Pick<Cable, 'cableSpecId' | 'standard' | 'needsConverter'>>

import { STORAGE_KEYS } from '../lib/storageKeys'
import { VIEWPORT_DEFAULTS } from '../lib/layoutConstants'
import { seedLibrarySyncCache } from '../lib/librarySync'

const CUSTOM_LIB_KEY = STORAGE_KEYS.customLibrary
const PROJECT_AUTOSAVE_KEY = STORAGE_KEYS.projectAutosave
const LIB_MIGRATION_KEY = STORAGE_KEYS.libMigration
const LIB_MIGRATION_VERSION = '2026-04-greengo-catalog-v2'

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
    for (const t of [...blackmagicTemplates, ...ubiquitiTemplates, ...monitorTemplates, ...cameraTemplates, ...miscTemplates, ...greengoTemplates, ...ajaTemplates, ...rossTemplates, ...lynxTemplates, ...switcherTemplates, ...avNetworkTemplates, ...broadcastToolsTemplates, ...audioTemplates, ...wirelessAudioTemplates, ...micTemplates]) {
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
  /** #413 — Wendet einen remote (CRDT-)Stand von equipment/cables/locations
   *  auf das aktuelle Projekt an. Anders als loadProject: ersetzt NUR diese
   *  drei Collections (Metadaten, canvasState, Annotationen etc. bleiben),
   *  bumpt projectVersion NICHT (kein Viewport-Reset beim Mit-Editieren) und
   *  lässt die Selektion stehen. Wird ausschließlich von der CRDT-Binding-
   *  Schicht aufgerufen, nie aus der UI. */
  applyRemoteProject: (slice: {
    equipment: EquipmentItem[]
    cables: Cable[]
    locations: LocationFrame[]
  }) => void
  setProjectMeta: (name: string, description: string) => void
  updateProjectMetadata: (
    patch: Partial<import('../types/project').ProjectMetadata>,
  ) => void
  setDefaultVideoFormat: (id: string) => void
  setCanvasState: (x: number, y: number, zoom: number) => void
  addEquipment: (equipment: Omit<EquipmentItem, 'id'>) => void
  importEquipment: (equipment: EquipmentItem[]) => void
  /** #414 — Fügt KI-generierte Geräte + Kabel atomar ein, ohne IDs neu zu
   *  vergeben (die Kabel referenzieren die mitgelieferten IDs). */
  insertGeneratedPlan: (equipment: EquipmentItem[], cables: import('../types/cable').Cable[]) => void
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
  /**
   * #314 — Geraet auf dem Canvas durch ein anderes Library-Template
   * ersetzen. Ports werden anhand (connectorType, contentLabel/name,
   * dann positional) gemappt; Kabel die kein Mapping bekommen werden
   * verworfen. Position, nodeColor und Original-Name bleiben am
   * Equipment.
   */
  replaceEquipmentWithTemplate: (
    equipmentId: string,
    template: EquipmentTemplate,
  ) => void
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
  /** #378 — Bulk-Cable-Create. Fuer 'verbinde Outputs 1-N mit Inputs M-K'
   *  in einem Rutsch. Atomar: alle Kabel werden in einer touchProject-
   *  Mutation angefuegt, BOM-/Layer-Auto-Heal greift wie beim Single-Add.
   *  Endpunkt-Konflikt-Check (Port belegt) wird je Kabel uebersprungen
   *  und in result.failedPairs zurueckgeliefert — der Aufrufer kann den
   *  User dann darueber informieren. */
  addCablesBulk: (
    drafts: Array<
      CableDraft & {
        fromEquipmentId: string
        fromPortId: string
        toEquipmentId: string
        toPortId: string
      }
    >,
  ) => { created: number; skipped: number; skippedReasons: string[] }
  /** #294 — Port-Konflikt: bestehendes Kabel(n) auf dem Ziel-Port loeschen
   *  und dann den normalen Cable-Create-Flow (CableDialog) starten. */
  resolvePortConflictByReplace: () => void
  /** #294 — Port-Konflikt verwerfen, kein neues Kabel anlegen. */
  cancelPortConflict: () => void
  updateCable: (id: string, patch: Partial<Cable>) => void
  /** Vergibt allen Kabeln gemaess `metadata.cableNumbering` eine neue
   *  `cableNumber`. No-op wenn kein Schema gesetzt ist. */
  renumberCables: () => void
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
  /**
   * #309 — Bilinguale Kategorie-Anzeige. Map vom canonical
   * Kategorie-Key auf {de, en} Anzeige-Labels. Optional; ohne Eintrag
   * fällt die UI auf den canonical-String zurück (oder die built-in
   * Default-Übersetzung in categoryTranslations.ts).
   */
  categoryTranslations: import('../lib/categoryTranslations').CategoryTranslationsMap
  /** Setzt/Updated den Übersetzungs-Eintrag einer Kategorie. */
  setCategoryTranslation: (
    canonical: string,
    pair: { de?: string; en?: string },
  ) => void
  /** Entfernt einen Übersetzungs-Eintrag (z. B. nach Rename). */
  removeCategoryTranslation: (canonical: string) => void
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
  /** Drum-Mikrofonierung — den Drum-Kit-Plan setzen (undefined = entfernen). */
  setDrumKit: (plan: import('../types/drumKit').DrumKitPlan | undefined) => void
  setWirelessRig: (plan: import('../types/wirelessRig').WirelessRigPlan | undefined) => void
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
  /** #143 — Annotationen aus einer zurückgelesenen Viewer-Datei mergen
   *  (by id: neue hinzufügen, geänderte aktualisieren, vorhandene behalten).
   *  Gibt die Anzahl hinzugefügter/aktualisierter Annotationen zurück. */
  mergeAnnotationsFromViewerFile: (
    incoming: ReadonlyArray<import('../types/project').ProjectAnnotation>,
  ) => { added: number; updated: number }
  /** v7.9.3 — Setzt Viewer-Session-Author (beim ersten Öffnen einer
   *  .cpviewer-Datei). */
  setViewerSession: (session: { author: string; startedAt: string } | undefined) => void
  /** #412 — Revisionen/Snapshots. */
  commitRevision: (label: string, note: string, asBuilt: boolean) => void
  restoreRevision: (id: string) => void
  deleteRevision: (id: string) => void
  /** #350 — Schätzt die Längen aller Kabel aus der Canvas-Geometrie und
   *  schreibt sie in `cable.length`. Liefert die Anzahl aktualisierter
   *  Kabel. */
  estimateCableLengths: () => number
  /** Festinstallation — mitwachsende Doku / Lebenszyklus (siehe
   *  lifecycleSlice). */
  addChangeLogEntry: (
    kind: import('../types/lifecycle').ChangeLogKind,
    summary: string,
    target?: import('../types/lifecycle').ChangeLogEntry['target'],
  ) => void
  clearChangelog: () => void
  setCableInstallStatus: (
    id: string,
    status: import('../types/lifecycle').InstallStatus | undefined,
  ) => void
  setEquipmentInstallStatus: (
    id: string,
    status: import('../types/lifecycle').InstallStatus | undefined,
  ) => void
  setCableTestResult: (
    id: string,
    result: import('../types/lifecycle').CableTestResult | undefined,
  ) => void
  addServiceRecord: (
    equipmentId: string,
    record: Omit<import('../types/lifecycle').ServiceRecord, 'id'>,
  ) => void
  removeServiceRecord: (equipmentId: string, recordId: string) => void
  /** Vergibt allen Kabeln/Geräten ohne QR-/Asset-ID eine stabile ID.
   *  Liefert die Anzahl neu vergebener IDs je Sorte. */
  assignDocIds: () => { cables: number; equipment: number }
  /** Setzt den Kabel-Namen auf das AVIXA-F501.01-Label „Quelle → Ziel".
   *  Ohne `overwrite` werden nur leere Namen gefüllt. Liefert die Anzahl
   *  geänderter Kabel. */
  applySourceDestLabels: (opts?: { overwrite?: boolean }) => number
  /** Feld-Rückkanal — eine vom Mobile-Companion/Viewer gemeldete, noch nicht
   *  angewandte Änderung in die Review-Queue legen. */
  addPendingChange: (
    input: Omit<import('../types/lifecycle').PendingChange, 'id' | 'ts' | 'author'> &
      Partial<Pick<import('../types/lifecycle').PendingChange, 'id' | 'ts' | 'author'>>,
  ) => void
  /** Übernimmt eine Feld-Meldung: mergt den (whitelisteten) Patch aufs Ziel,
   *  schreibt einen Änderungsprotokoll-Eintrag und entfernt die Meldung.
   *  Liefert true bei Erfolg. */
  applyPendingChange: (id: string) => boolean
  /** Verwirft eine Feld-Meldung (mit Protokoll-Eintrag) und entfernt sie. */
  rejectPendingChange: (id: string) => void
}


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
    equipment: project.equipment.map((item) => {
      // #422 — Legacy-Dimensions-Migration: dimensionHmm/Wmm/Dmm waren das
      // erste Schema (v7.9.131 / #216), wurden aber spaeter durch
      // heightMm/widthMm/depthMm ersetzt. Beide Felder gleichzeitig zu
      // editieren ist verwirrend (zwei "Dimensionen"-Sektionen). Beim Load
      // kopieren wir die Legacy-Werte in die modernen Felder (wenn dort
      // noch nichts steht) und entsorgen die Legacy-Felder.
      const legacy = item as {
        dimensionHmm?: number
        dimensionWmm?: number
        dimensionDmm?: number
      }
      let migrated: Record<string, unknown> | null = null
      if (
        legacy.dimensionHmm !== undefined ||
        legacy.dimensionWmm !== undefined ||
        legacy.dimensionDmm !== undefined
      ) {
        migrated = { ...item }
        if (item.heightMm === undefined && typeof legacy.dimensionHmm === 'number') {
          migrated.heightMm = legacy.dimensionHmm
        }
        if (item.widthMm === undefined && typeof legacy.dimensionWmm === 'number') {
          migrated.widthMm = legacy.dimensionWmm
        }
        if (item.depthMm === undefined && typeof legacy.dimensionDmm === 'number') {
          migrated.depthMm = legacy.dimensionDmm
        }
        delete migrated.dimensionHmm
        delete migrated.dimensionWmm
        delete migrated.dimensionDmm
      }
      const base = (migrated ?? item) as EquipmentItem
      return {
        ...base,
        x: r(base.x),
        y: r(base.y),
        width:
          typeof base.width === 'number'
            ? snap > 0
              ? Math.ceil(base.width / snap) * snap
              : Math.round(base.width)
            : base.width,
        height:
          typeof base.height === 'number'
            ? snap > 0
              ? Math.ceil(base.height / snap) * snap
              : Math.round(base.height)
            : base.height,
      }
    }),
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
    // #412 — Revisionen sind optional; alte Projekte heilen zu [].
    revisions: project.revisions ?? [],
    // Festinstallation — Änderungsprotokoll ist optional; alte Projekte
    // heilen zu [].
    changelog: project.changelog ?? [],
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
  ...createAnnotationSlice(set, get, store),
  ...createRevisionSlice(set, get, store),
  ...createMobileSyncSlice(set, get, store),
  ...createTemplateSlice(set, get, store),
  ...createGroupPresetSlice(set, get, store),
  ...createMetaSlice(set, get, store),
  ...createCategorySlice(set, get, store),
  ...createEquipmentSlice(set, get, store),
  ...createGroupPresetSpawnSlice(set, get, store),
  ...createSelectionLifecycleSlice(set, get, store),
  ...createLifecycleSlice(set, get, store),
  ...createPendingChangesSlice(set, get, store),
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
  categoryTranslations: loadCategoryTranslations(),
  setCategoryTranslation: (canonical, pair) =>
    set((state) => {
      const trimmed = canonical.trim()
      if (!trimmed) return {}
      const existing = state.categoryTranslations[trimmed] ?? {}
      const merged = {
        ...existing,
        ...(pair.de !== undefined ? { de: pair.de.trim() || undefined } : {}),
        ...(pair.en !== undefined ? { en: pair.en.trim() || undefined } : {}),
      }
      const next = { ...state.categoryTranslations, [trimmed]: merged }
      // Wenn beide Sprachen leer sind, Eintrag wieder löschen.
      if (!merged.de && !merged.en) {
        delete next[trimmed]
      }
      persistCategoryTranslations(next)
      return { categoryTranslations: next }
    }),
  removeCategoryTranslation: (canonical) =>
    set((state) => {
      if (!(canonical in state.categoryTranslations)) return {}
      const next = { ...state.categoryTranslations }
      delete next[canonical]
      persistCategoryTranslations(next)
      return { categoryTranslations: next }
    }),
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
  applyRemoteProject: (slice) =>
    set((state) => ({
      // Nur die drei kollaborativen Collections ersetzen; alles andere am
      // Projekt (Metadaten, canvasState, Annotationen, Revisionen …) bleibt
      // unangetastet. KEIN touchProject (updatedAt würde sonst bei jedem
      // empfangenen Remote-Update springen) und KEIN projectVersion-Bump
      // (sonst würde der Canvas-Viewport beim Mit-Editieren zurückgesetzt).
      project: {
        ...state.project,
        equipment: slice.equipment,
        cables: slice.cables,
        locations: slice.locations,
      },
    })),
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
      // #309 — Übersetzungs-Map mit-migrieren: alten Key umbenennen damit
      // der neue Name (= to) den gleichen Eintrag behält. Falls schon
      // ein Eintrag unter `to` existiert, gewinnt der bestehende.
      const nextTranslations = { ...state.categoryTranslations }
      if (from in nextTranslations) {
        const oldEntry = nextTranslations[from]
        delete nextTranslations[from]
        if (!(to in nextTranslations)) {
          nextTranslations[to] = oldEntry
        }
        persistCategoryTranslations(nextTranslations)
      }
      return {
        customLibrary: nextLib,
        knownCategories: orderedCats,
        categoryTranslations: nextTranslations,
        project: { ...state.project, equipment: nextEquipment },
      }
    }),
  groupPresets: loadGroupPresets(),
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
