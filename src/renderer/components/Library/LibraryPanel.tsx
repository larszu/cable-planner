import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { useRentman } from '../../hooks/useRentman'
import { promptDialog } from '../../lib/promptDialog'
import { CategorySelect } from '../shared/CategorySelect'
import { confirmDialog } from '../../lib/confirmDialog'
import { infoDialog } from '../../lib/infoDialog'
import { format, useTranslation } from '../../lib/i18n'
import { suggestPortGroups, type PortGroupHint } from '../../lib/portSuggestions'
import {
  getGeminiApiKey,
  setGeminiApiKey,
  suggestFromAI,
} from '../../lib/aiSuggestions'
import { suggestFromWeb } from '../../lib/webPortSuggestions'
import { ALL_CONNECTOR_TYPES } from '../../types/equipment'
import type { ConnectorType, EquipmentTemplate, Port } from '../../types/equipment'
import { nextPlacementPosition } from '../../lib/library'
import {
  clearNetBoxIndexCache,
  importNetBoxDeviceType,
  searchNetBoxDeviceTypes,
  type NetBoxDeviceTypeSearchResult,
} from '../../lib/netboxImport'
import { RackBuilderDialog } from '../Rack/RackBuilderDialog'
import { TemplateMergeDialog } from './TemplateMergeDialog'
import { TabButton } from './TabButton'
import { CategoryDndWrapper } from './LibraryDndWrappers'
import { SortableCategorySection } from './LibrarySortables'
import { PlusMenu, LibraryFiltersMenu } from './LibraryMenus'
import { GroupsTab } from './tabs/GroupsTab'
import { RacksTab } from './tabs/RacksTab'
import { LibraryItem } from './LibraryItem'
import {
  exportTemplateToFile,
  parseLibraryItemFile,
} from '../../lib/itemExport'
import { openLibraryFolder, stampDeviceLibraryRef } from '../../lib/librarySync'
import { hasDesktopBridge } from '../../lib/bridge'
import { MIME_EQUIPMENT } from '../../lib/dragDropMimes'
import { pickTextFile } from '../../lib/pickFile'
import { CableLibraryPanel } from './CableLibraryPanel'

const connectorOptions = ALL_CONNECTOR_TYPES

interface PortGroupDraft {
  id: string
  direction: 'in' | 'out'
  count: number
  connectorType: ConnectorType
  label: string
}

const defaultGroup = (direction: 'in' | 'out'): PortGroupDraft => ({
  id: uuidv4(),
  direction,
  count: 1,
  connectorType: 'Custom',
  label: direction === 'in' ? 'Input' : 'Output',
})

const buildPorts = (groups: PortGroupDraft[], direction: 'in' | 'out'): Port[] => {
  const filtered = groups.filter((group) => group.direction === direction)
  return filtered.flatMap((group) =>
    Array.from({ length: Math.max(0, group.count) }, (_item, index) => ({
      id: uuidv4(),
      name: `${group.label} ${index + 1}`,
      type: group.connectorType,
      connectorType: group.connectorType,
    })),
  )
}




// v7.9.5 — Tab-Button-Helper. SVG-Icon links, Label rechts, optionaler
// count-Badge. Aktiv-Style: sky-700-bg, weiße Schrift, kein Hover.

export const LibraryPanel = () => {
  const t = useTranslation()
  const addEquipment = useProjectStore((state) => state.addEquipment)
  const equipmentCount = useProjectStore((state) => state.project.equipment.length)
  const equipmentItems = useProjectStore((state) => state.project.equipment)
  const customLibrary = useProjectStore((state) => state.customLibrary)
  const setCustomLibrary = useProjectStore((state) => state.setCustomLibrary)
  const addCustomTemplate = useProjectStore((state) => state.addCustomTemplate)
  const removeCustomTemplate = useProjectStore((state) => state.removeCustomTemplate)
  const resyncRentmanLibraryFromCanvas = useProjectStore((state) => state.resyncRentmanLibraryFromCanvas)
  const toggleTemplateFavorite = useProjectStore((state) => state.toggleTemplateFavorite)
  const collapsed = useUiStore((state) => state.libraryCollapsed)
  // v7.9.4 — Rentman-Tabs ausblenden wenn die Integration deaktiviert ist.
  const rentmanEnabled = useUiStore((state) => state.rentmanEnabled)
  // v7.9.5 — Kategorien-Sortierung: manual (Drag&Drop), asc, desc
  const librarySortMode = useUiStore((state) => state.librarySortMode)
  const setLibrarySortMode = useUiStore((state) => state.setLibrarySortMode)
  const reorderCategories = useProjectStore((state) => state.reorderCategories)
  const toggleCollapsed = useUiStore((state) => state.toggleLibraryCollapsed)
  // v7.9.2 — Library nicht mehr abdockbar. Falls ein User-Zustand
  // noch `floating: true` aus alten Versionen mitbringt, wird er hier
  // einmalig hart auf false gezwungen, damit das Canvas nicht verschwindet.
  const floatingRaw = useUiStore((state) => state.libraryFloating)
  const setFloating = useUiStore((state) => state.setLibraryFloating)
  useEffect(() => {
    if (floatingRaw) setFloating(false)
  }, [floatingRaw, setFloating])
  const floating = false
  const openRentmanImport = useUiStore((state) => state.openRentmanImport)
  const toggleTemplateHidden = useProjectStore((state) => state.toggleTemplateHidden)
  const setCustomTemplateCategory = useProjectStore((state) => state.setCustomTemplateCategory)
  const setSelectedTemplateName = useProjectStore((state) => state.setSelectedTemplateName)
  const knownCategories = useProjectStore((state) => state.knownCategories)
  const addKnownCategories = useProjectStore((state) => state.addKnownCategories)
  const customLibraryForInit = useProjectStore((state) => state.customLibrary)
  // v7.9.5 — Beim ersten Mount alle aktuell vorhandenen Kategorien
  // einklappen (Default-collapsed). Läuft nur einmal, danach wird
  // collapsedCats vom User selbst gesteuert.
  useEffect(() => {
    if (collapsedInitRef.current) return
    const usedCats = new Set(customLibraryForInit.map((t) => t.category || 'Sonstiges'))
    const allCats = new Set([...knownCategories, ...usedCats])
    if (allCats.size === 0) return
    collapsedInitRef.current = true
    setCollapsedCats(allCats)
  }, [customLibraryForInit, knownCategories])
  const groupPresets = useProjectStore((state) => state.groupPresets)
  const addGroupPreset = useProjectStore((state) => state.addGroupPreset)
  // v7.9.105 / Issue #224 — In-Place-Edit fuer Canvas-Racks.
  const replaceCanvasRackWithPreset = useProjectStore(
    (state) => state.replaceCanvasRackWithPreset,
  )
  const renameCustomCategory = useProjectStore((state) => state.renameCustomCategory)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  // v7.9.108 / Issue #225 — Wenn der User ein Equipment OHNE Ports auf
  // den Canvas zieht, kommt es hier rein. Beim Speichern legen wir das
  // Geraet an dieser Position auf dem Canvas an, nicht auf
  // nextPlacementPosition. Wird beim Dialog-Close geleert.
  const [pendingDropOnSave, setPendingDropOnSave] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [showNetBoxDialog, setShowNetBoxDialog] = useState(false)
  const [showRackBuilderDialog, setShowRackBuilderDialog] = useState(false)
  // When set, the rack builder opens in edit mode and seeds from this preset.
  // null = creating a new rack.
  const [editingRackPresetId, setEditingRackPresetId] = useState<string | null>(null)
  // v7.9.0 / Issue #120 — synthesized preset from canvas-selection
  // "Als Rack speichern". Lives in component state because it's
  // ephemeral (only valid while the dialog is open).
  const [seedPreset, setSeedPreset] = useState<import('../../types/equipment').GroupPreset | null>(null)
  // v7.9.105 / Issue #224 — Wenn der RackBuilder aus dem Canvas-Toolbar-
  // 'Rack bearbeiten'-Button geoeffnet wurde, merken wir uns die
  // Equipment-ID damit Save in-place ins Canvas zurueckgeht statt in
  // die Library-Preset.
  const [editingCanvasRackEquipmentId, setEditingCanvasRackEquipmentId] = useState<
    string | null
  >(null)
  // Watch the global trigger fired by the CanvasToolbar button.
  const rackBuilderSeedTrigger = useUiStore((s) => s.rackBuilderSeedTrigger)
  const clearRackBuilderSeedTrigger = useUiStore((s) => s.clearRackBuilderSeedTrigger)
  const rackBuilderEditFromBlackBoxTrigger = useUiStore(
    (s) => s.rackBuilderEditFromBlackBoxTrigger,
  )
  const clearRackBuilderEditFromBlackBoxTrigger = useUiStore(
    (s) => s.clearRackBuilderEditFromBlackBoxTrigger,
  )
  useEffect(() => {
    if (!rackBuilderSeedTrigger || rackBuilderSeedTrigger.length === 0) return
    // Resolve the selected equipment to a synthesized GroupPreset
    // shape. Stack them top-to-bottom by HE size; non-rack devices
    // default to 1 HE. Cables connecting selected devices are NOT
    // included (the user can wire them later in the sub-canvas).
    const items = rackBuilderSeedTrigger
      .map((id) => equipmentItems.find((e) => e.id === id))
      .filter((e): e is NonNullable<typeof e> => e != null)
    if (items.length === 0) {
      clearRackBuilderSeedTrigger()
      return
    }
    let cursorUnit = 1
    const placements = items.map((eq, index) => {
      const heightUnits = Math.max(1, eq.rackUnits ?? 1)
      const placement = { itemIndex: index, startUnit: cursorUnit, heightUnits }
      cursorUnit += heightUnits
      return placement
    })
    const synthesized: import('../../types/equipment').GroupPreset = {
      id: `__seed-${Date.now().toString(36)}`,
      name: 'Neues Rack aus Auswahl',
      rack: {
        totalUnits: Math.max(cursorUnit + 3, 12),
        placements,
      },
      items: items.map((eq) => ({
        name: eq.name,
        category: eq.category ?? 'Sonstiges',
        inputs: eq.inputs,
        outputs: eq.outputs,
        isRackDevice: eq.isRackDevice ?? !!eq.rackUnits,
        rackUnits: Math.max(1, eq.rackUnits ?? 1),
        frontPanelImageUrl: eq.frontPanelImageUrl,
        rearPanelImageUrl: eq.rearPanelImageUrl,
        frontPanelCrop: eq.frontPanelCrop,
        rearPanelCrop: eq.rearPanelCrop,
        width: eq.width ?? 240,
        height: eq.height ?? 80,
        offsetX: 0,
        offsetY: 0,
      })),
      cables: [],
    }
    setSeedPreset(synthesized)
    setEditingRackPresetId(null)
    setShowRackBuilderDialog(true)
    setTab('racks')
    clearRackBuilderSeedTrigger()
  }, [rackBuilderSeedTrigger, equipmentItems, clearRackBuilderSeedTrigger])

  // v7.9.51 — Edit-Trigger vom Canvas-Toolbar-Button für ein bereits
  // platziertes Black-Box-Rack.
  // v7.9.105 / Issue #224 — Wir loaden IMMER aus rackInternalSnapshot
  // (= Canvas-Instance-State), NICHT mehr aus der Library-Preset.
  // editingCanvasRackEquipmentId wird gesetzt, damit der Save-Handler
  // unten die Aenderungen ins Canvas-Equipment zurueckschreibt statt
  // in die Library-Preset. Toolbar 'Rack bearbeiten' bearbeitet
  // jetzt also tatsaechlich das Rack im Plan, nicht das in der Library.
  useEffect(() => {
    if (!rackBuilderEditFromBlackBoxTrigger) return
    const eq = equipmentItems.find((e) => e.id === rackBuilderEditFromBlackBoxTrigger)
    if (!eq) {
      clearRackBuilderEditFromBlackBoxTrigger()
      return
    }
    const candidateName = eq.name.replace(/\s*\(Rack\)\s*$/, '').trim()
    if (eq.rackInternalSnapshot) {
      // Wir bauen aus dem Snapshot + equipment.inputs/outputs ein
      // temporaeres Preset zum Bearbeiten. Ports rekonstruieren wir aus
      // equipment.inputs/outputs (via rackOriginDeviceIndex), damit
      // sie im Dialog editierbar erscheinen.
      const snap = eq.rackInternalSnapshot
      const itemsByIndex = snap.items
      const inputsByItem = new Map<number, import('../../types/equipment').Port[]>()
      const outputsByItem = new Map<number, import('../../types/equipment').Port[]>()
      for (const p of eq.inputs) {
        if (typeof p.rackOriginDeviceIndex !== 'number') continue
        const list = inputsByItem.get(p.rackOriginDeviceIndex) ?? []
        list.push({ ...p, name: p.rackOriginPortName ?? p.name })
        inputsByItem.set(p.rackOriginDeviceIndex, list)
      }
      for (const p of eq.outputs) {
        if (typeof p.rackOriginDeviceIndex !== 'number') continue
        const list = outputsByItem.get(p.rackOriginDeviceIndex) ?? []
        list.push({ ...p, name: p.rackOriginPortName ?? p.name })
        outputsByItem.set(p.rackOriginDeviceIndex, list)
      }
      const synth: import('../../types/equipment').GroupPreset = {
        id: `__edit-blackbox-${Date.now().toString(36)}`,
        name: candidateName,
        rack: {
          totalUnits: snap.totalUnits,
          placements: itemsByIndex.map((it, idx) => ({
            itemIndex: idx,
            startUnit: it.startUnit,
            heightUnits: it.rackUnits,
          })),
        },
        items: itemsByIndex.map((it, idx) => ({
          name: it.name,
          category: 'Sonstiges',
          inputs: inputsByItem.get(idx) ?? [],
          outputs: outputsByItem.get(idx) ?? [],
          isRackDevice: true,
          rackUnits: it.rackUnits,
          width: 240,
          height: 80,
          offsetX: 0,
          offsetY: 0,
        })),
        cables: snap.cables.map((c) => ({
          fromItemIndex: c.fromItemIndex,
          fromPortName: c.fromPortName,
          toItemIndex: c.toItemIndex,
          toPortName: c.toPortName,
          name: '',
          type: 'unbekannt',
          length: 0,
          color: c.color,
          standard: 'unbekannt',
        })),
      }
      setSeedPreset(synth)
      setEditingRackPresetId(null)
      // Merken: Save geht in dieses Canvas-Equipment zurueck, nicht in
      // die Library-Preset.
      setEditingCanvasRackEquipmentId(eq.id)
      setShowRackBuilderDialog(true)
      setTab('racks')
    }
    clearRackBuilderEditFromBlackBoxTrigger()
  }, [
    rackBuilderEditFromBlackBoxTrigger,
    equipmentItems,
    clearRackBuilderEditFromBlackBoxTrigger,
  ])

  // v7.9.108 / Issue #225 — Empty-Port-Drag-Drop vom Canvas. Wenn der
  // User ein Equipment OHNE Ports auf den Canvas zieht, oeffnen wir den
  // 'Eigenes Geraet anlegen'-Dialog vorbefuellt mit Name + Kategorie
  // aus dem gedragten Item. Beim Speichern wird das Geraet an der
  // Drop-Position platziert (siehe saveCustomAndPlace).
  const pendingEmptyDeviceDrop = useUiStore((s) => s.pendingEmptyDeviceDrop)
  const clearEmptyDeviceDrop = useUiStore((s) => s.clearEmptyDeviceDrop)
  useEffect(() => {
    if (!pendingEmptyDeviceDrop) return
    setName(pendingEmptyDeviceDrop.name || 'Neues Gerät')
    if (pendingEmptyDeviceDrop.category) setCategory(pendingEmptyDeviceDrop.category)
    setPendingDropOnSave({ x: pendingEmptyDeviceDrop.x, y: pendingEmptyDeviceDrop.y })
    setShowCreateDialog(true)
    clearEmptyDeviceDrop()
  }, [pendingEmptyDeviceDrop, clearEmptyDeviceDrop])

  const [name, setName] = useState('Custom Device')
  const [category, setCategory] = useState('Kameras')
  const [isRackDeviceDraft, setIsRackDeviceDraft] = useState(false)
  const [rackUnitsDraft, setRackUnitsDraft] = useState<number | ''>('')
  const [groups, setGroups] = useState<PortGroupDraft[]>([
    defaultGroup('in'),
    defaultGroup('out'),
  ])
  const [tab, setTab] = useState<'equipment' | 'cables' | 'groups' | 'racks'>('equipment')
  // Equipment sub-section: separates local templates from Rentman-imported ones
  // inside one shared tab, so the user always lives in "Equipment" and just
  // toggles the source.
  const [equipmentSection, setEquipmentSection] = useState<'local' | 'rentman'>('rentman')
  const [rentmanView, setRentmanView] = useState<'imported' | 'catalog' | 'sync'>('imported')
  // Category management state
  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroup, setShowNewGroup] = useState(false)
  // v7.9.5 — Standard: ALLES eingeklappt (User-Request). Initial-Set
  // wird beim ersten Mount mit den aktuellen Kategorien gefüllt; danach
  // verwaltet der User selber per Klick was offen oder zu ist (Component-
  // State, kein persist).
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())
  const collapsedInitRef = useRef(false)
  const [collapsedRentmanProjects, setCollapsedRentmanProjects] = useState<Set<string>>(new Set())
  const [collapsedRentmanCats, setCollapsedRentmanCats] = useState<Set<string>>(new Set())
  // v7.9.106 / Issue #226 — Suchfeld in der Rentman-Projekt-Liste.
  const [rentmanSearch, setRentmanSearch] = useState('')
  const [showEmpty, setShowEmpty] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  // Global library search (Strg+F). Filters customLibrary by name/category
  // across all categories. When non-empty, all categories are auto-expanded.
  const [librarySearch, setLibrarySearch] = useState('')
  // Local-device-create dialog: same Gemini-AI / Web-search auto-fill the
  // Rentman wizard already offers (user request, parallels NewRentmanDeviceWizard).
  const [aiLoading, setAiLoading] = useState(false)
  const [webLoading, setWebLoading] = useState(false)
  const [suggestError, setSuggestError] = useState('')
  const [suggestInfo, setSuggestInfo] = useState('')
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  const [aiKeyDraft, setAiKeyDraft] = useState('')
  const newGroupInputRef = useRef<HTMLInputElement>(null)
  const librarySearchRef = useRef<HTMLInputElement>(null)

  // Strg+F focuses the library search box, matching the shortcut common in
  // editors and browsers. Listen on window so the shortcut works regardless
  // of which canvas/dialog has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        // Don't hijack if the user is in a textarea/contenteditable — that
        // would make in-app text editing surprising.
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        if (tag === 'TEXTAREA' || target?.isContentEditable) return
        e.preventDefault()
        librarySearchRef.current?.focus()
        librarySearchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Currently linked Rentman project (from project metadata).
  const linkedRentmanProjectId = useProjectStore(
    (state) => state.project.metadata.rentmanProjectId,
  )
  const linkedRentmanProjectName = useProjectStore(
    (state) => state.project.metadata.rentmanProjectName,
  )

  // Rentman master catalog: every device available in the user's Rentman
  // account (not just the ones already in the active project). Loaded on
  // demand so we don't blow the API budget on every panel render.
  const {
    loadEquipment: loadRentmanEquipment,
    loadFolders: loadRentmanFolders,
    exportToCablePlannerGroup,
  } = useRentman()
  const [rentmanCatalog, setRentmanCatalog] = useState<
    { id: string; name: string; category: string; folderId: string | null }[]
  >([])
  const [rentmanFolderTree, setRentmanFolderTree] = useState<
    Record<string, { id: string; name: string; parentId: string | null }>
  >({})
  const [collapsedCatalogFolders, setCollapsedCatalogFolders] = useState<Set<string>>(new Set())
  const [rentmanCatalogError, setRentmanCatalogError] = useState<string | null>(null)
  const [rentmanCatalogLoading, setRentmanCatalogLoading] = useState(false)
  const [rentmanCatalogLoaded, setRentmanCatalogLoaded] = useState(false)
  const [rentmanCatalogQuery, setRentmanCatalogQuery] = useState('')
  const [rentmanCatalogCollapsed, setRentmanCatalogCollapsed] = useState(true)
  const [rentmanCatalogAddBusy, setRentmanCatalogAddBusy] = useState<string | null>(null)
  const [netBoxQuery, setNetBoxQuery] = useState('')
  const [netBoxResults, setNetBoxResults] = useState<NetBoxDeviceTypeSearchResult[]>([])
  const [netBoxBusy, setNetBoxBusy] = useState(false)
  const [netBoxError, setNetBoxError] = useState<string | null>(null)
  const [netBoxImportBusy, setNetBoxImportBusy] = useState<string | null>(null)
  const [netBoxCategoryByPath, setNetBoxCategoryByPath] = useState<Record<string, string>>({})
  const [netBoxConflict, setNetBoxConflict] = useState<
    { existing: EquipmentTemplate; incoming: EquipmentTemplate } | null
  >(null)
  const [netBoxMergePair, setNetBoxMergePair] = useState<
    { existing: EquipmentTemplate; incoming: EquipmentTemplate } | null
  >(null)

  const existingCategoryOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...knownCategories,
          ...customLibrary.map((template) => template.category).filter(Boolean),
        ]),
      )
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [knownCategories, customLibrary],
  )

  const fetchRentmanCatalog = async () => {
    setRentmanCatalogLoading(true)
    setRentmanCatalogError(null)
    try {
      const [equipmentData, folderData] = await Promise.all([
        loadRentmanEquipment(),
        loadRentmanFolders(),
      ])
      const folderRecords = folderData as Record<string, unknown>[]
      const folderTree: Record<string, { id: string; name: string; parentId: string | null }> = {}
      const folders = folderRecords.reduce<Record<string, string>>((acc, folder) => {
        const key = String(folder.id ?? folder._id ?? '')
        if (!key) return acc
        const name = String(folder.name ?? folder.displayname ?? key)
        acc[key] = name
        const rawParent = (folder.parent ?? folder.equipmentfolder ?? folder.parent_id ?? null) as unknown
        let parentId: string | null = null
        if (rawParent !== null && rawParent !== undefined && rawParent !== '') {
          const s = String(rawParent)
          const match = s.match(/(\d+)\s*$/)
          parentId = match ? match[1] : null
        }
        folderTree[key] = { id: key, name, parentId }
        return acc
      }, {})
      setRentmanFolderTree(folderTree)
      const mapped = (equipmentData as Record<string, unknown>[])
        .map((rec) => {
          const id = String(rec.id ?? rec._id ?? '')
          if (!id) return null
          const name = String(rec.name ?? rec.displayname ?? `Equipment ${id}`)
          const rawFolder = (rec.equipmentfolder ?? rec.folder ?? rec.category ?? '') as unknown
          let folderId: string | null = null
          if (rawFolder !== null && rawFolder !== undefined && rawFolder !== '') {
            const s = String(rawFolder)
            const match = s.match(/(\d+)\s*$/)
            folderId = match ? match[1] : s || null
          }
          const category = folderId && folders[folderId] ? folders[folderId] : 'Uncategorized'
          return { id, name, category, folderId }
        })
        .filter((row): row is { id: string; name: string; category: string; folderId: string | null } => row !== null)
      mapped.sort((a, b) => a.name.localeCompare(b.name))
      setRentmanCatalog(mapped)
      setRentmanCatalogLoaded(true)
    } catch (err) {
      setRentmanCatalogError(err instanceof Error ? err.message : 'Laden fehlgeschlagen')
    } finally {
      setRentmanCatalogLoading(false)
    }
  }

  // Per-Geraete-AI-Button im Rentman-Katalog entfernt (User-Request).
  // Die AI-Port-Vorschlaege laufen jetzt nur noch ueber den Drop-auf-
  // Canvas-Wizard (NewRentmanDeviceWizard) und den AI-Vorschlag-Button
  // in der Equipment-Properties-Sidebar.


  const handleAddCatalogItemToProject = async (item: {
    id: string
    name: string
    category: string
  }) => {
    if (!linkedRentmanProjectId) return
    const projectName = linkedRentmanProjectName ?? 'aktivem Rentman-Projekt'
    if (
      !(await confirmDialog(`"${item.name}" zu Rentman hinzufügen?`, {
        body: `Das ändert dein ${projectName} und ist nicht automatisch reversibel.`,
        okLabel: 'Hinzufügen',
      }))
    ) {
      return
    }
    setRentmanCatalogAddBusy(item.id)
    try {
      // v7.9.110 — Nutze die neue Batch-Export-Action. Sie legt eine
      // 'CablePlanner'-Group im Subproject an (oder verwendet die
      // bestehende) und packt das item rein. Voraussetzung dass Rentman
      // die Schreib-Anfrage akzeptiert: project + subproject + group +
      // equipment + quantity — die alte addProjectEquipment-Variante hat
      // subproject/group weggelassen und scheiterte deshalb oft mit 422.
      const result = await exportToCablePlannerGroup(linkedRentmanProjectId, [
        { equipmentId: item.id, quantity: 1 },
      ])
      if (result.failed.length > 0) {
        const msg = result.failed.map((f) => `- ${f.error}`).join('\n')
        await infoDialog('Hinzufuegen teilweise fehlgeschlagen', {
          body: `${result.added} OK, ${result.failed.length} Fehler:\n${msg}`,
          tone: 'warning',
        })
      } else {
        // v7.9.117 — Drei Faelle:
        //   groupCreated=true  → neue 'CablePlanner'-Group angelegt
        //   groupId set + !groupCreated → bestehende Group wiederverwendet
        //   groupId=null       → Plan erlaubt keine Groups → ohne Gruppe geadded
        const groupNote = result.groupCreated
          ? ' ' + t('library.rentman.groupCreated', '(neue Gruppe "CablePlanner" angelegt)')
          : result.groupId
            ? ' ' + t('library.rentman.groupReused', '(zur bestehenden Gruppe "CablePlanner" hinzugefügt)')
            : ' ' + t('library.rentman.noGroups', '(ohne Gruppe — dein Rentman-Plan erlaubt keine API-Gruppen)')
        await infoDialog(format(t('library.rentman.addedTitle', '"{name}" hinzugefügt'), { name: item.name }), {
          body: format(t('library.rentman.addedBody', 'Wurde dem Rentman-Projekt "{project}" hinzugefügt{note}.'), {
            project: projectName,
            note: groupNote,
          }),
          tone: 'success',
        })
      }
    } catch (err) {
      await infoDialog(t('library.rentman.addError', 'Fehler beim Hinzufügen zu Rentman'), {
        body: err instanceof Error ? err.message : String(err),
        tone: 'error',
      })
    } finally {
      setRentmanCatalogAddBusy(null)
    }
  }

  const nextPosition = useMemo(
    () => nextPlacementPosition(equipmentCount, equipmentItems),
    [equipmentCount, equipmentItems],
  )

  const rackBuilderTemplates = useMemo<EquipmentTemplate[]>(() => {
    const byName = new Map<string, EquipmentTemplate>()
    for (const template of customLibrary) {
      byName.set(template.name, template)
    }
    // Include current canvas devices as ad-hoc templates so enabling
    // "Ist ein 19\" Rack-Gerät" in properties makes them immediately
    // available in the rack builder without a separate library save step.
    for (const item of equipmentItems) {
      if (!item.isRackDevice && !item.rackUnits) continue
      const { id, x, y, ...template } = item
      void id
      void x
      void y
      byName.set(template.name, template)
    }
    return Array.from(byName.values())
  }, [customLibrary, equipmentItems])

  /**
   * Convert a list of PortGroupHints (from heuristics, Gemini, or Web search)
   * into the local PortGroupDraft shape. The heuristic returns one hint per
   * port-direction × connector-type group, which is exactly what the local
   * dialog stores — only the field names differ.
   */
  const hintsToLocalDrafts = (hints: PortGroupHint[]): PortGroupDraft[] =>
    hints.map((h) => ({
      id: uuidv4(),
      direction: h.direction,
      count: h.count,
      connectorType: h.connectorType,
      label: h.label,
    }))

  const handleHeuristicSuggest = () => {
    setSuggestError('')
    setSuggestInfo('')
    const hints = suggestPortGroups(name, category)
    if (hints.length === 0) {
      setSuggestError('Keine Heuristik-Treffer für diesen Namen.')
      return
    }
    setGroups(hintsToLocalDrafts(hints))
    setSuggestInfo(`${hints.length} Port-Gruppe(n) per Heuristik vorgeschlagen.`)
  }

  const handleAiSuggest = async () => {
    setSuggestError('')
    setSuggestInfo('')
    if (!getGeminiApiKey()) {
      setAiKeyDraft('')
      setAiSettingsOpen(true)
      setSuggestError('Kein Gemini-API-Key. Trage einen ein oder nutze Web/Heuristik.')
      return
    }
    setAiLoading(true)
    try {
      const hints = await suggestFromAI(name, category)
      if (hints.length === 0) {
        setSuggestError('Gemini lieferte keine Ports zurück.')
        return
      }
      setGroups(hintsToLocalDrafts(hints))
      setSuggestInfo(`${hints.length} Port-Gruppe(n) von Gemini übernommen.`)
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : 'Gemini-Aufruf fehlgeschlagen')
    } finally {
      setAiLoading(false)
    }
  }

  const handleWebSuggest = async () => {
    setSuggestError('')
    setSuggestInfo('')
    setWebLoading(true)
    try {
      const { hints, source, snippet } = await suggestFromWeb(name, category)
      if (hints.length === 0) {
        setSuggestInfo(
          snippet
            ? `Keine Stecker im ${source}-Snippet erkannt. Hersteller + Modell präzisieren.`
            : 'Kein Treffer im Web. Hersteller + Modell präzisieren.',
        )
        return
      }
      setGroups(hintsToLocalDrafts(hints))
      setSuggestInfo(`${hints.length} Port-Gruppe(n) aus ${source} übernommen.`)
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : 'Web-Suche fehlgeschlagen')
    } finally {
      setWebLoading(false)
    }
  }

  const updateGroup = (id: string, patch: Partial<PortGroupDraft>) => {
    setGroups((current) => current.map((group) => (group.id === id ? { ...group, ...patch } : group)))
  }

  const addGroup = (direction: 'in' | 'out') => {
    setGroups((current) => [...current, defaultGroup(direction)])
  }

  const removeGroup = (id: string) => {
    setGroups((current) => current.filter((group) => group.id !== id))
  }

  const resetDialog = () => {
    setName('Custom Device')
    setCategory('Kameras')
    setIsRackDeviceDraft(false)
    setRackUnitsDraft('')
    setGroups([defaultGroup('in'), defaultGroup('out')])
  }

  const buildTemplate = (): EquipmentTemplate => {
    const inputs = buildPorts(groups, 'in')
    const outputs = buildPorts(groups, 'out')
    const maxPorts = Math.max(inputs.length, outputs.length, 3)
    return {
      name: name.trim() || 'Custom Device',
      category: category.trim() || 'Sonstiges',
      inputs,
      outputs,
      isRackDevice: isRackDeviceDraft,
      rackUnits: isRackDeviceDraft ? (rackUnitsDraft === '' ? 1 : rackUnitsDraft) : undefined,
      width: 240,
      height: 80 + maxPorts * 22,
    }
  }

  const persistCategory = (template: EquipmentTemplate) => {
    const cat = template.category.trim()
    if (cat) addKnownCategories([cat])
  }

  const saveCustomToLibrary = () => {
    const template = buildTemplate()
    persistCategory(template)
    addCustomTemplate(template)
    setShowCreateDialog(false)
    setPendingDropOnSave(null)
    resetDialog()
  }

  const saveCustomAndPlace = () => {
    const template = buildTemplate()
    persistCategory(template)
    addCustomTemplate(template)
    // v7.9.108 / Issue #225 — Wenn der Dialog wegen eines Empty-Port-
    // Drops geoeffnet wurde, platziere das Geraet an der Drop-Position
    // statt auf nextPlacementPosition. Sonst springt es weg.
    if (pendingDropOnSave) {
      addEquipment({ ...template, x: pendingDropOnSave.x, y: pendingDropOnSave.y })
    } else {
      addEquipment({ ...template, ...nextPosition })
    }
    setShowCreateDialog(false)
    setPendingDropOnSave(null)
    resetDialog()
  }

  const handleSearchNetBox = async () => {
    setNetBoxBusy(true)
    setNetBoxError(null)
    try {
      const results = await searchNetBoxDeviceTypes(netBoxQuery)
      setNetBoxResults(results)
      setNetBoxCategoryByPath((current) => {
        const next = { ...current }
        for (const item of results) {
          if (!next[item.path]) next[item.path] = ''
        }
        return next
      })
    } catch (error) {
      setNetBoxError(error instanceof Error ? error.message : String(error))
    } finally {
      setNetBoxBusy(false)
    }
  }

  /** v7.9.31 — Single-item-Import (.cpdevice / .cpgroup) via Hidden-
   *  File-Input. Konflikte (gleicher Name → bei Geräten / gleicher Name
   *  ODER gleiche ID → bei Gruppen) lassen den User entscheiden:
   *  überschreiben oder abbrechen. Importierte Gruppen kriegen optional
   *  eine frische UUID damit beim Re-Import ohne Konflikt zwei
   *  Kopien entstehen statt überschrieben zu werden. */
  const handleImportLibraryFile = async () => {
    const picked = await pickTextFile('.cpdevice,.cpgroup,application/json')
    if (!picked) return
    const parsed = parseLibraryItemFile(picked.content)
    if (!parsed) {
      await infoDialog('Datei nicht erkannt', {
        body: 'Diese Datei ist kein gültiger .cpdevice- oder .cpgroup-Export.',
        tone: 'error',
      })
      return
    }
    if (parsed.kind === 'device') {
      const template = parsed.template
      const conflict = customLibrary.some((t) => t.name === template.name)
      if (conflict) {
        const overwrite = await confirmDialog(
          `Ein Gerät mit dem Namen "${template.name}" existiert bereits.\n\nÜberschreiben?`,
          { okLabel: 'Überschreiben', destructive: true },
        )
        if (!overwrite) return
      }
      addCustomTemplate(template)
      await infoDialog('Gerät importiert', {
        body: `"${template.name}" wurde der Library hinzugefügt.`,
        tone: 'success',
      })
      return
    }
    // group
    const preset = parsed.preset
    const nameConflict = groupPresets.find((p) => p.name === preset.name)
    if (nameConflict) {
      const overwrite = await confirmDialog(
        `Eine Gruppe mit dem Namen "${preset.name}" existiert bereits.\n\nÜberschreiben?`,
        { okLabel: 'Überschreiben', destructive: true },
      )
      if (!overwrite) return
      addGroupPreset({ ...preset, id: nameConflict.id })
    } else {
      // Frische UUID damit ein evtl. ID-Clash mit einer bestehenden
      // Preset-ID (Re-Import nach Rename) nicht stillschweigend
      // überschreibt.
      addGroupPreset({ ...preset, id: uuidv4() })
    }
    const kind = preset.rack ? 'Rack' : 'Gruppe'
    await infoDialog(`${kind} importiert`, {
      body: `"${preset.name}" wurde der Library hinzugefügt (${preset.items.length} Geräte, ${preset.cables.length} interne Kabel).`,
      tone: 'success',
    })
  }

  const handleImportNetBox = async (item: NetBoxDeviceTypeSearchResult) => {
    const selectedCategory = (netBoxCategoryByPath[item.path] ?? '').trim()
    if (!selectedCategory) {
      setNetBoxError('Bitte eine bestehende Kategorie für diesen Import auswählen.')
      return
    }
    setNetBoxImportBusy(item.path)
    setNetBoxError(null)
    try {
      const template = { ...(await importNetBoxDeviceType(item)), category: selectedCategory }
      const existing = customLibrary.find((entry) => entry.name === template.name)
      if (existing) {
        setNetBoxConflict({ existing, incoming: template })
        return
      }
      persistCategory(template)
      addCustomTemplate(template)
      setNetBoxResults((current) => current.filter((entry) => entry.path !== item.path))
      await infoDialog(`${template.name} importiert`, {
        body: 'Aus NetBox in die Library übernommen.',
        tone: 'success',
      })
    } catch (error) {
      setNetBoxError(error instanceof Error ? error.message : String(error))
    } finally {
      setNetBoxImportBusy(null)
    }
  }

  if (collapsed) {
    return (
      <aside className="flex h-full w-8 flex-col items-center border-r border-slate-700 bg-slate-950 transition-colors hover:bg-slate-900">
        <button
          type="button"
          onClick={toggleCollapsed}
          title={t('library.show', 'Library einblenden')}
          aria-label={t('library.show', 'Library einblenden')}
          className="mt-2 flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 shadow-sm transition-all hover:border-sky-500 hover:bg-slate-800 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <span className="text-base leading-none">›</span>
        </button>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={t('library.show', 'Library einblenden')}
          className="mt-3 flex-1 self-stretch text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition-colors hover:text-slate-300 focus-visible:outline-none focus-visible:text-sky-300"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {t('library.title', 'Library')}
        </button>
      </aside>
    )
  }
  const inner = (
    <aside className={`flex h-full min-h-0 flex-col ${floating ? 'bg-transparent p-3' : 'border-r border-slate-700 bg-slate-950 p-3'} text-slate-100`}>
      {/* v7.9.5 — Kompakte Tab-Strip mit SVG-Icons (keine Emojis) und
          konsistent deutschen Labels (Geräte/Kabel/Gruppen/Racks).
          Counts NUR an der kleinsten Granularität — der R-Badge am
          Equipment-Tab ist raus, weil die Lokal/Rentman-Untertoggle
          die gleiche Info zeigt. Tab-Zeile in EINE Zeile gepackt. */}
      <div className="mb-2 flex items-center gap-1 text-xs">
        {!floating && (
          <button
            type="button"
            onClick={toggleCollapsed}
            title={t('library.hide', 'Library ausblenden')}
            aria-label={t('library.hide', 'Library ausblenden')}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition-all hover:border-sky-500 hover:bg-slate-800 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <span className="text-base leading-none">‹</span>
          </button>
        )}
        <TabButton
          active={tab === 'equipment'}
          onClick={() => setTab('equipment')}
          label={t('library.tab.equipment', 'Geräte')}
          icon={
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="12" height="10" rx="1.5" />
              <circle cx="5" cy="7" r="0.8" fill="currentColor" />
              <circle cx="11" cy="7" r="0.8" fill="currentColor" />
              <line x1="4" y1="11" x2="12" y2="11" />
            </svg>
          }
        />
        <TabButton
          active={tab === 'cables'}
          onClick={() => setTab('cables')}
          label={t('library.tab.cables', 'Kabel')}
          icon={
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 11 Q 5 5, 8 8 T 14 5" strokeLinecap="round" />
              <circle cx="2.5" cy="11" r="1.2" />
              <circle cx="13.5" cy="5" r="1.2" />
            </svg>
          }
        />
        <TabButton
          active={tab === 'groups'}
          onClick={() => setTab('groups')}
          label={t('library.tab.groups', 'Gruppen')}
          count={groupPresets.length}
          title={t('library.tab.groupsTitle', 'Gespeicherte Gerätegruppen (mehrere Geräte + Kabel als Vorlage)')}
          icon={
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="6" height="5" rx="0.8" />
              <rect x="8" y="2" width="6" height="5" rx="0.8" />
              <rect x="5" y="9" width="6" height="5" rx="0.8" />
            </svg>
          }
        />
        <TabButton
          active={tab === 'racks'}
          onClick={() => setTab('racks')}
          label={t('library.tab.racks', 'Racks')}
          count={groupPresets.filter((preset) => !!preset.rack).length}
          title={t('library.tab.racksTitle', '2D Rack Builder und gespeicherte Rack-Layouts')}
          icon={
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="2" width="10" height="12" rx="0.8" />
              <line x1="3" y1="5" x2="13" y2="5" />
              <line x1="3" y1="8" x2="13" y2="8" />
              <line x1="3" y1="11" x2="13" y2="11" />
            </svg>
          }
        />
      </div>

      {tab === 'equipment' && rentmanEnabled && (
        <>
          {/* Sub-section toggle: Lokal vs. Rentman, both inside the Equipment tab.
              v7.9.4: nur sichtbar wenn rentmanEnabled — sonst gibt's nur Lokal. */}
          <div className="mb-2 flex gap-1 rounded bg-slate-950/40 p-1">
            <button
              type="button"
              onClick={() => setEquipmentSection('local')}
              className={`flex-1 rounded px-2 py-1 text-xs ${
                equipmentSection === 'local'
                  ? 'bg-sky-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
              title={t('library.section.localTitle', 'Eigene und importierte Vorlagen, lokal in dieser Installation')}
            >
              <span className="mr-1 rounded bg-sky-900/80 px-1 text-[9px] font-bold text-sky-100">L</span>
              Lokal
              <span className="ml-1 text-[10px] text-slate-400">
                ({customLibrary.filter((t) => !t.rentmanSource).length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setEquipmentSection('rentman')}
              className={`flex-1 rounded px-2 py-1 text-xs ${
                equipmentSection === 'rentman'
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
              title={t('library.section.rentmanTitle', 'Aus Rentman importierte Geräte und Account-Katalog')}
            >
              <span className="mr-1 rounded bg-orange-900/80 px-1 text-[9px] font-bold text-orange-100">R</span>
              Rentman
              <span className="ml-1 text-[10px] text-slate-400">
                ({customLibrary.filter((t) => t.rentmanSource).length})
              </span>
            </button>
          </div>
        </>
      )}
      {tab === 'equipment' && (equipmentSection === 'local' || !rentmanEnabled) && (
        <>
          {/* v7.9.5 — Such-Zeile mit "+"-Dropdown rechts (statt zwei
              getrennten "+ Kategorie" / "+ Gerät" Buttons) und View-Mode-
              Toggle. Strg+F-Hint bleibt als grauer Suffix sichtbar auch
              nach Eingabe. Der redundante "Lokale Library / Lokal"-Header
              ist raus — der Sub-Toggle oberhalb sagt schon was Sache ist. */}
          <div className="mb-2 flex items-center gap-1">
            <div className="relative flex-1">
              <svg
                width="11"
                height="11"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-500"
              >
                <circle cx="7" cy="7" r="4.5" />
                <line x1="10.3" y1="10.3" x2="13" y2="13" strokeLinecap="round" />
              </svg>
              <input
                ref={librarySearchRef}
                type="text"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setLibrarySearch('')
                }}
                placeholder={t('library.search.placeholder', 'Suchen…')}
                className="w-full rounded border border-slate-700 bg-slate-900 py-1 pl-7 pr-12 text-xs text-slate-100 placeholder-slate-500"
              />
              {librarySearch ? (
                <button
                  type="button"
                  onClick={() => setLibrarySearch('')}
                  title={t('library.search.clear', 'Suche löschen')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-1 py-0.5 text-xs text-slate-500 hover:bg-slate-700 hover:text-slate-200"
                >
                  ✕
                </button>
              ) : (
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] uppercase tracking-wider text-slate-600">
                  Strg+F
                </span>
              )}
            </div>
            {/* Einziger "+"-Button als Menu */}
            <PlusMenu
              onNewDevice={() => setShowCreateDialog(true)}
              onNewCategory={() => {
                setShowNewGroup((v) => !v)
                setTimeout(() => newGroupInputRef.current?.focus(), 50)
              }}
              onImportFile={handleImportLibraryFile}
              onOpenFolder={() => void openLibraryFolder()}
              hasFolder={hasDesktopBridge}
            />
            {/* Overflow-Menü für selten genutzte Filter (Leere/Versteckte/Alle ein-aus) */}
            <LibraryFiltersMenu
              showHidden={showHidden}
              setShowHidden={setShowHidden}
              showEmpty={showEmpty}
              setShowEmpty={setShowEmpty}
              hiddenCount={customLibrary.filter((t) => t.hidden).length}
              sortMode={librarySortMode}
              setSortMode={setLibrarySortMode}
              onToggleAllCats={(allCollapsed) => {
                if (allCollapsed) {
                  setCollapsedCats(new Set())
                } else {
                  const usedCats = new Set(customLibrary.map((t) => t.category || 'Sonstiges'))
                  const allCats = Array.from(new Set([...knownCategories, ...usedCats])).filter(Boolean)
                  setCollapsedCats(new Set(allCats))
                }
              }}
              allCollapsed={(() => {
                const usedCats = new Set(customLibrary.map((t) => t.category || 'Sonstiges'))
                const allCats = Array.from(new Set([...knownCategories, ...usedCats])).filter(Boolean)
                return allCats.length > 0 && allCats.every((cat) => collapsedCats.has(cat))
              })()}
            />
          </div>

          {showNewGroup && (
            <form
              className="mb-2 flex gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                const cat = newGroupName.trim()
                if (cat) {
                  addKnownCategories([cat])
                  setShowEmpty(true)
                  setCollapsedCats((prev) => {
                    if (!prev.has(cat)) return prev
                    const next = new Set(prev)
                    next.delete(cat)
                    return next
                  })
                  setNewGroupName('')
                  setShowNewGroup(false)
                }
              }}
            >
              <input
                ref={newGroupInputRef}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder={t('library.newCategoryPlaceholder', 'Kategoriename…')}
                className="flex-1 rounded border border-slate-600 bg-slate-900 p-1.5 text-xs"
              />
              <button
                type="submit"
                className="rounded bg-emerald-700 px-2 text-xs hover:bg-emerald-600"
              >
                OK
              </button>
              <button
                type="button"
                onClick={() => setShowNewGroup(false)}
                className="rounded bg-slate-700 px-2 text-xs hover:bg-slate-600"
              >
                ✕
              </button>
            </form>
          )}

          <div className="flex-1 min-h-0 space-y-1 overflow-auto">
            {(() => {
              const usedCats = new Set(customLibrary.map((t) => t.category || 'Sonstiges'))
              // v7.9.5 — Kategorien-Order respektiert jetzt den User-
              // gewählten Sort-Modus. 'manual' = knownCategories-Order
              // (Drag&Drop-Reihenfolge), 'asc' / 'desc' = alphabetisch.
              const baseCats = Array.from(new Set([...knownCategories, ...usedCats])).filter(Boolean)
              const allCats =
                librarySortMode === 'asc'
                  ? [...baseCats].sort((a, b) => a.localeCompare(b))
                  : librarySortMode === 'desc'
                    ? [...baseCats].sort((a, b) => b.localeCompare(a))
                    : // manual: knownCategories-Order zuerst, dann genutzte
                      // Kategorien die nicht in knownCategories sind ans Ende
                      (() => {
                        const knownSet = new Set(knownCategories)
                        const head = knownCategories.filter((c) => baseCats.includes(c))
                        const tail = baseCats
                          .filter((c) => !knownSet.has(c))
                          .sort((a, b) => a.localeCompare(b))
                        return [...head, ...tail]
                      })()
              if (allCats.length === 0) allCats.push('Sonstiges')
              const searchQuery = librarySearch.trim().toLowerCase()
              // v7.9.5 — Globaler Empty-State wenn Suche projektweit nichts trifft.
              if (searchQuery) {
                const anyMatch = customLibrary.some((t) =>
                  t.name.toLowerCase().includes(searchQuery),
                )
                if (!anyMatch) {
                  return (
                    <div className="mt-4 rounded border border-slate-800 bg-slate-950/60 p-4 text-center text-xs text-slate-400">
                      <div className="mb-2 font-semibold text-slate-300">
                        Keine Geräte gefunden
                      </div>
                      <div className="mb-3 text-[11px] text-slate-500">
                        Kein Treffer für „{librarySearch}". Versuche einen anderen Suchbegriff
                        oder lösche das Suchfeld.
                      </div>
                      <button
                        type="button"
                        onClick={() => setLibrarySearch('')}
                        className="rounded bg-slate-700 px-3 py-1 text-[11px] text-slate-100 hover:bg-slate-600"
                      >
                        Suche zurücksetzen
                      </button>
                    </div>
                  )
                }
              }
              // v7.9.5 — Im 'manual' Sort-Modus wrappen wir die Sections
              // in DndContext+SortableContext so dass jeder Header per
              // Drag&Drop sortierbar ist. Im 'asc'/'desc' Modus ist die
              // Reihenfolge fest alphabetisch → kein DnD nötig.
              const sectionsList = allCats.map((cat) => {
                const items = customLibrary.filter(
                  (t) => (t.category || 'Sonstiges') === cat,
                )
                const visibleItems = items
                  .filter((t) => showHidden || !t.hidden)
                  .filter((t) =>
                    !searchQuery
                      ? true
                      : t.name.toLowerCase().includes(searchQuery) ||
                        (t.category ?? '').toLowerCase().includes(searchQuery),
                  )
                if (!showEmpty && visibleItems.length === 0) return null
                // Force-expand categories during a search so matches are
                // visible immediately without manual category clicks.
                const collapsed = !searchQuery && collapsedCats.has(cat)
                return (
                  <SortableCategorySection
                    key={cat}
                    cat={cat}
                    manualSort={librarySortMode === 'manual'}
                    onDragOverTemplate={(event) => {
                      if (event.dataTransfer.types.includes(MIME_EQUIPMENT)) {
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                      }
                    }}
                    onDropTemplate={(event) => {
                      const raw = event.dataTransfer.getData(MIME_EQUIPMENT)
                      if (!raw) return
                      try {
                        const tpl = JSON.parse(raw) as EquipmentTemplate
                        if (tpl.name) { event.preventDefault(); setCustomTemplateCategory(tpl.name, cat) }
                      } catch { /* ignore */ }
                    }}
                  >
                    {/* v7.9.7 — Header-Zeile als flex-Container damit
                        der ✎-Rename-Button neben Collapse-Button platz
                        bekommt. Klick auf Caret/Name togglet, Klick auf
                        ✎ ruft promptDialog für Umbenennung. */}
                    <div className="group/cat flex items-center gap-1.5 rounded-t bg-slate-900/60 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-300 hover:bg-slate-800/80 hover:text-slate-100">
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedCats((prev) => {
                            const next = new Set(prev)
                            collapsed ? next.delete(cat) : next.add(cat)
                            return next
                          })
                        }
                        className="flex flex-1 min-w-0 items-center gap-1.5 text-left"
                      >
                        <span className="inline-block w-3 text-center text-slate-500">
                          {collapsed ? '▸' : '▾'}
                        </span>
                        <span className="flex-1 truncate normal-case tracking-normal">{cat}</span>
                      </button>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation()
                          const next = await promptDialog(`Kategorie umbenennen:`, cat)
                          if (next && next.trim() && next.trim() !== cat) {
                            renameCustomCategory(cat, next.trim())
                          }
                        }}
                        className="hidden rounded bg-slate-700/80 px-1.5 py-0.5 text-[10px] font-normal normal-case text-slate-200 hover:bg-slate-600 group-hover/cat:block"
                        title={t('library.renameCategory', 'Kategorie umbenennen')}
                      >
                        ✎
                      </button>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-normal text-slate-400">
                        {items.length}
                      </span>
                    </div>

                    {/* Items */}
                    {!collapsed && (
                      <div className="space-y-1 px-1 pb-1">
                        {visibleItems.length === 0 ? (
                          <div className="px-1 py-1 text-[11px] italic text-slate-600">
                            {searchQuery
                              ? format(t('library.empty.search', 'Keine Treffer für "{query}"'), { query: librarySearch })
                              : t('library.empty.dragHere', 'Gerät hierher ziehen zum Verschieben')}
                          </div>
                        ) : (
                          visibleItems
                            .slice()
                            .sort((a, b) => {
                              const af = a.favorite ? 0 : 1
                              const bf = b.favorite ? 0 : 1
                              if (af !== bf) return af - bf
                              return a.name.localeCompare(b.name)
                            })
                            .map((item) => (
                            <div key={item.name} className="group/item relative">
                              <LibraryItem
                                item={item}
                                onAdd={() => addEquipment({ ...stampDeviceLibraryRef(item), ...nextPosition })}
                                onRemove={() => removeCustomTemplate(item.name)}
                                onToggleFavorite={() => toggleTemplateFavorite(item.name)}
                                onToggleHidden={() => toggleTemplateHidden(item.name)}
                                onExport={() => exportTemplateToFile(item)}
                              />
                              {/* Edit button — appears on hover */}
                              <button
                                type="button"
                                onClick={() => setSelectedTemplateName(item.name)}
                                className="absolute right-7 top-1 hidden rounded bg-slate-600 px-1 py-0.5 text-[10px] hover:bg-slate-500 group-hover/item:block"
                                title={t('library.template.editTitle', 'Vorlage bearbeiten (Name, Kategorie)')}
                              >
                                ✎
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </SortableCategorySection>
                )
              }).filter(Boolean) as ReactNode[]
              // v7.9.5 — Manuelle Sortierung: DnD-Wrapper drumherum.
              // Sonst direkt rendern.
              if (librarySortMode === 'manual') {
                return (
                  <CategoryDndWrapper
                    cats={allCats}
                    onReorder={(newOrder) => reorderCategories(newOrder)}
                  >
                    {sectionsList}
                  </CategoryDndWrapper>
                )
              }
              return sectionsList
            })()}
          </div>
        </>
      )}

      {tab === 'cables' && <CableLibraryPanel />}

      {tab === 'equipment' && equipmentSection === 'rentman' && rentmanEnabled && (() => {
        const rentmanItems = customLibrary.filter((template) => template.rentmanSource)
        const projectMap = new Map<
          string,
          { id: string; name: string; items: typeof rentmanItems }
        >()
        for (const template of rentmanItems) {
          const id = template.rentmanSource ?? '__unknown__'
          const name = template.rentmanProjectName ?? `Projekt #${id}`
          if (!projectMap.has(id)) projectMap.set(id, { id, name, items: [] })
          projectMap.get(id)!.items.push(template)
        }
        if (linkedRentmanProjectId && !projectMap.has(linkedRentmanProjectId)) {
          projectMap.set(linkedRentmanProjectId, {
            id: linkedRentmanProjectId,
            name: linkedRentmanProjectName ?? `Projekt #${linkedRentmanProjectId}`,
            items: [],
          })
        }
        const projectGroups = Array.from(projectMap.values()).sort((a, b) => {
          if (a.id === linkedRentmanProjectId) return -1
          if (b.id === linkedRentmanProjectId) return 1
          return a.name.localeCompare(b.name)
        })
        const untracked = equipmentItems.filter((equipment) => !equipment.rentmanId)
        const removed = equipmentItems.filter((equipment) => equipment.rentmanRemoved)
        const linkedImportedCount = linkedRentmanProjectId
          ? projectGroups.find((group) => group.id === linkedRentmanProjectId)?.items.length ?? 0
          : 0

        const toggleProject = (id: string) =>
          setCollapsedRentmanProjects((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })
        const toggleRentmanCat = (key: string) =>
          setCollapsedRentmanCats((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
          })

        return (
          <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-auto">
            {linkedRentmanProjectId ? (
              <div className="rounded border border-orange-600/60 bg-orange-900/20 p-2">
                <div className="text-[10px] uppercase tracking-wider text-orange-300/80">
                  Aktuell verknüpftes Rentman-Projekt
                </div>
                <div className="mt-0.5 truncate text-sm font-semibold text-orange-200">
                  {linkedRentmanProjectName ?? `Projekt #${linkedRentmanProjectId}`}
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-orange-100/80">
                  <span className="rounded bg-orange-950/50 px-1.5 py-0.5">{linkedImportedCount} importiert</span>
                  <span className="rounded bg-orange-950/50 px-1.5 py-0.5">{untracked.length} ohne Rentman-ID</span>
                  {removed.length > 0 && (
                    <span className="rounded bg-red-950/50 px-1.5 py-0.5 text-red-200">{removed.length} entfernt</span>
                  )}
                </div>
                {/* v7.9.128 — Prominente "Aus Rentman aktualisieren"-Action.
                    Oeffnet den RentmanImportDialog, der dank Auto-Load das
                    verknuepfte Projekt direkt vorausgewaehlt + dessen
                    Equipment direkt gefetched zeigt. So sieht der User
                    in einem Klick was neu in Rentman ist. */}
                <button
                  type="button"
                  onClick={openRentmanImport}
                  className="mt-2 w-full rounded bg-orange-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-orange-500"
                  title={t('library.rentman.refreshTitle', 'Aktuelle Equipment-Liste aus dem verknüpften Rentman-Projekt holen — neue oder geänderte Items werden im Dialog angezeigt.')}
                >
                  🔄 Aus Rentman aktualisieren / neue Items importieren
                </button>
                {(() => {
                  // v7.9.70 / #171 — Re-Sync Button: zeige nur wenn Canvas
                  // Equipment mit rentmanId hat, die im aktuellen Library-Set
                  // keinen passenden Template-Eintrag finden (durch Vergleich
                  // gegen die bereits berechneten linkedImportedCount + ohne-
                  // Rentman-ID Buckets). Wenn alle synct: Hint ausblenden.
                  const rentmanTaggedOnCanvas = equipmentItems.filter(
                    (e) => e.rentmanId && !e.rentmanRemoved,
                  ).length
                  const missing = Math.max(0, rentmanTaggedOnCanvas - linkedImportedCount)
                  if (missing === 0) return null
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        const n = resyncRentmanLibraryFromCanvas()
                        if (n > 0) {
                          void confirmDialog(
                            `${n} Library-Eintrag${n === 1 ? '' : 'e'} aus Canvas wiederhergestellt.`,
                            { okLabel: 'OK' },
                          )
                        }
                      }}
                      className="mt-2 w-full rounded bg-orange-700/60 px-2 py-1 text-[11px] text-orange-100 hover:bg-orange-700"
                      title={`${missing} Rentman-Geräte auf dem Canvas sind nicht mit Library-Templates verknüpft. Klick rekonstruiert die fehlenden Templates aus den Canvas-Daten.`}
                    >
                      🔄 {missing} fehlende Library-Einträge nachbauen
                    </button>
                  )
                })()}
              </div>
            ) : (
              <div className="rounded border border-slate-700 bg-slate-900/50 p-2 text-xs text-slate-400">
                <div className="mb-2">{t('library.rentman.noProjectLinked', 'Kein Rentman-Projekt verknüpft.')}</div>
                <button
                  type="button"
                  onClick={openRentmanImport}
                  className="w-full rounded bg-orange-700 px-2 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
                  title={t('library.rentman.linkTitle', 'Rentman-Projekt auswählen und mit dieser Plan-Datei verknüpfen')}
                >
                  Rentman-Projekt verknüpfen…
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 rounded border border-slate-800 bg-slate-900 p-0.5 text-[11px]">
              {([
                ['imported', 'Importiert'],
                ['catalog', 'Katalog'],
                ['sync', 'Abgleich'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRentmanView(id)}
                  className={`rounded px-2 py-1 font-medium ${
                    rentmanView === id
                      ? 'bg-orange-700 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {rentmanView === 'imported' && (
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
                  <h2 className="text-sm font-semibold">{t('library.rentman.imported', 'Importierte Rentman-Geräte')}</h2>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    {(() => {
                      const projectIds = new Set(projectGroups.map((group) => group.id))
                      const categoryKeys = new Set<string>()
                      for (const group of projectGroups) {
                        const categories = new Set(group.items.map((template) => template.category || 'Sonstiges'))
                        for (const category of categories) categoryKeys.add(`${group.id}::${category}`)
                      }
                      const allCollapsed =
                        Array.from(projectIds).every((id) => collapsedRentmanProjects.has(id)) &&
                        Array.from(categoryKeys).every((key) => collapsedRentmanCats.has(key))
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (allCollapsed) {
                              setCollapsedRentmanProjects(new Set())
                              setCollapsedRentmanCats(new Set())
                            } else {
                              setCollapsedRentmanProjects(projectIds)
                              setCollapsedRentmanCats(categoryKeys)
                            }
                          }}
                          className="underline hover:text-slate-300"
                        >
                          {allCollapsed ? 'Alle ausklappen' : 'Alle einklappen'}
                        </button>
                      )
                    })()}
                    <span>{rentmanItems.length} Geräte</span>
                  </div>
                </div>
                {/* v7.9.106 / Issue #226 — Suchfeld fuer die Rentman-Liste,
                    analog zum Katalog-Suchfeld weiter oben. Filtert Items
                    nach Name oder Kategorie. */}
                {projectGroups.length > 0 && (
                  <div className="relative">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500"
                    >
                      <circle cx="7" cy="7" r="4" />
                      <line x1="10.3" y1="10.3" x2="13" y2="13" strokeLinecap="round" />
                    </svg>
                    <input
                      type="text"
                      value={rentmanSearch}
                      onChange={(e) => setRentmanSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setRentmanSearch('')
                      }}
                      placeholder={t('library.rentmanSearchPlaceholder', 'In Rentman-Geraeten suchen…')}
                      className="w-full rounded border border-slate-700 bg-slate-900 py-1 pl-7 pr-7 text-xs text-slate-100 placeholder-slate-500"
                    />
                    {rentmanSearch && (
                      <button
                        type="button"
                        onClick={() => setRentmanSearch('')}
                        title={t('library.search.clear', 'Suche löschen')}
                        className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-1 py-0.5 text-xs text-slate-500 hover:bg-slate-700 hover:text-slate-200"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
                {(() => {
                  const trimmed = rentmanSearch.trim().toLowerCase()
                  const visibleProjectGroups =
                    trimmed === ''
                      ? projectGroups
                      : projectGroups
                          .map((g) => ({
                            ...g,
                            items: g.items.filter(
                              (t) =>
                                (t.name || '').toLowerCase().includes(trimmed) ||
                                (t.category || '').toLowerCase().includes(trimmed),
                            ),
                          }))
                          .filter((g) => g.items.length > 0)
                  if (projectGroups.length === 0) {
                    return (
                      <div className="flex flex-col items-center gap-2 p-3 text-center text-xs text-slate-500">
                        <span className="text-2xl">📦</span>
                        <span>{t('library.rentman.noneImported', 'Noch keine Rentman-Geräte importiert.')}</span>
                      </div>
                    )
                  }
                  if (visibleProjectGroups.length === 0) {
                    return (
                      <div className="flex flex-col items-center gap-2 p-3 text-center text-xs text-slate-500">
                        <span className="text-2xl">🔍</span>
                        <span>{format(t('library.rentman.noMatches', 'Keine Treffer für "{query}".'), { query: rentmanSearch })}</span>
                      </div>
                    )
                  }
                  return (
                  <div className="space-y-2">
                    {visibleProjectGroups.map((group) => {
                      const isLinked = group.id === linkedRentmanProjectId
                      const projectCollapsed = collapsedRentmanProjects.has(group.id)
                      const categories = Array.from(
                        new Set(group.items.map((template) => template.category || 'Sonstiges')),
                      ).sort()
                      return (
                        <section
                          key={group.id}
                          className={`rounded border ${
                            isLinked
                              ? 'border-orange-600/60 bg-orange-900/10'
                              : 'border-slate-700 bg-slate-900/40'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleProject(group.id)}
                            className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left ${
                              isLinked
                                ? 'text-orange-200 hover:bg-orange-900/20'
                                : 'text-slate-300 hover:bg-slate-800/40'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="text-xs">{projectCollapsed ? '▶' : '▼'}</span>
                              {isLinked && (
                                <span className="rounded bg-orange-700 px-1 text-[9px] font-bold text-white">AKTIV</span>
                              )}
                              <span className="truncate text-xs font-semibold">{group.name}</span>
                            </span>
                            <span className="text-[10px] text-slate-500">{group.items.length} Geräte</span>
                          </button>
                          {!projectCollapsed && (
                            <div className="space-y-1 border-t border-slate-800 px-1 py-1">
                              {categories.length === 0 ? (
                                <div className="px-2 py-1 text-[11px] italic text-slate-500">{t('library.rentman.noneInCategory', 'Keine Geräte importiert.')}</div>
                              ) : (
                                categories.map((category) => {
                                  const categoryKey = `${group.id}::${category}`
                                  const categoryCollapsed = collapsedRentmanCats.has(categoryKey)
                                  const categoryItems = group.items.filter((template) => (template.category || 'Sonstiges') === category)
                                  return (
                                    <div key={categoryKey} className="rounded border border-slate-800/80">
                                      <button
                                        type="button"
                                        onClick={() => toggleRentmanCat(categoryKey)}
                                        className="flex w-full items-center justify-between gap-1 px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
                                      >
                                        <span className="flex items-center gap-1">
                                          <span>{categoryCollapsed ? '▶' : '▼'}</span>
                                          <span>{category}</span>
                                        </span>
                                        <span className="font-normal text-slate-600">({categoryItems.length})</span>
                                      </button>
                                      {!categoryCollapsed && (
                                        <div className="space-y-1 px-1 pb-1">
                                          {categoryItems
                                            .slice()
                                            .sort((a, b) => a.name.localeCompare(b.name))
                                            .map((item) => {
                                              // v7.9.106 / Issue #227 — Wenn Rentman-Item KEINE Ports
                                              // hat aber ein gleichnamiges lokales Template MIT Ports
                                              // existiert, biete 'Verknuepfen' an. Klick uebernimmt die
                                              // Ports vom lokalen Template ins Rentman-Library-Item.
                                              const itemHasNoPorts =
                                                item.inputs.length === 0 && item.outputs.length === 0
                                              const localMatch = itemHasNoPorts
                                                ? customLibrary.find(
                                                    (t) =>
                                                      !t.rentmanSource &&
                                                      t.name.toLowerCase() === item.name.toLowerCase() &&
                                                      (t.inputs.length > 0 || t.outputs.length > 0),
                                                  )
                                                : undefined
                                              return (
                                              <LibraryItem
                                                key={item.name}
                                                item={item}
                                                onAdd={() => {
                                                  addEquipment({
                                                    ...stampDeviceLibraryRef(item),
                                                    ...nextPlacementPosition(equipmentCount, equipmentItems),
                                                  })
                                                }}
                                                onExport={() => exportTemplateToFile(item)}
                                                onLinkPorts={
                                                  localMatch
                                                    ? () => {
                                                        const updated = customLibrary.map((t) =>
                                                          t.name === item.name &&
                                                          t.rentmanSource === item.rentmanSource
                                                            ? {
                                                                ...t,
                                                                inputs: localMatch.inputs.map((p) => ({ ...p })),
                                                                outputs: localMatch.outputs.map((p) => ({ ...p })),
                                                              }
                                                            : t,
                                                        )
                                                        setCustomLibrary(updated)
                                                      }
                                                    : undefined
                                                }
                                                linkTargetName={localMatch?.name}
                                              />
                                              )
                                            })}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })
                              )}
                            </div>
                          )}
                        </section>
                      )
                    })}
                  </div>
                  )
                })()}
              </div>
            )}

            {rentmanView === 'catalog' && (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setRentmanCatalogCollapsed((value) => !value)}
                    className="flex flex-1 items-center gap-1 text-left text-sm font-semibold text-slate-200 hover:text-white"
                    title={t('library.rentman.accountTitle', 'Alle in deinem Rentman-Account angelegten Equipments (Account-Katalog), gegliedert nach der Rentman-Ordnerstruktur')}
                  >
                    <span className="text-xs">{rentmanCatalogCollapsed ? '▶' : '▼'}</span>
                    <span>{t('library.rentman.accountAll', 'Alle Rentman-Equipments (Account-Katalog)')}</span>
                    {rentmanCatalogLoaded && (
                      <span className="ml-1 rounded-full bg-slate-800 px-1.5 text-[10px] text-slate-400">{rentmanCatalog.length}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={fetchRentmanCatalog}
                    disabled={rentmanCatalogLoading}
                    className="rounded bg-orange-700 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    {rentmanCatalogLoading ? '…' : rentmanCatalogLoaded ? 'Aktualisieren' : 'Katalog laden'}
                  </button>
                </div>

                {!rentmanCatalogCollapsed && (
                  <>
                    {rentmanCatalogError && (
                      <div className="mb-2 rounded border border-red-700/60 bg-red-900/30 px-2 py-1 text-[11px] text-red-200">{rentmanCatalogError}</div>
                    )}
                    {!rentmanCatalogLoaded && !rentmanCatalogLoading && !rentmanCatalogError && (
                      <div className="rounded border border-slate-700/60 bg-slate-900/40 p-2 text-center text-[11px] text-slate-500">
                        Noch nicht geladen. Klick „Katalog laden", um den gesamten Rentman-Katalog deines Accounts anzuzeigen.
                      </div>
                    )}
                    {rentmanCatalogLoaded && (
                      <>
                        <input
                          type="text"
                          value={rentmanCatalogQuery}
                          onChange={(event) => setRentmanCatalogQuery(event.target.value)}
                          placeholder={t('common.search', 'Suchen…')}
                          className="mb-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 placeholder-slate-500"
                        />
                        {(() => {
                          const importedIds = new Set(
                            customLibrary.filter((template) => !!template.rentmanId).map((template) => String(template.rentmanId)),
                          )
                          const query = rentmanCatalogQuery.trim().toLowerCase()
                          const filtered = rentmanCatalog
                            .filter((item) => !importedIds.has(item.id))
                            .filter((item) =>
                              !query
                                ? true
                                : item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query),
                            )
                          if (filtered.length === 0) {
                            return (
                              <div className="rounded border border-emerald-700/40 bg-emerald-900/10 p-2 text-center text-[11px] text-emerald-300">
                                ✓ Alle verfügbaren Rentman-Geräte sind bereits importiert.
                              </div>
                            )
                          }

                          const renderItem = (item: { id: string; name: string; category: string }) => {
                            const busy = rentmanCatalogAddBusy === item.id
                            const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
                              const template = {
                                name: item.name,
                                category: item.category || 'Sonstiges',
                                rentmanId: item.id,
                                inputs: [],
                                outputs: [],
                              }
                              event.dataTransfer.setData(MIME_EQUIPMENT, JSON.stringify(template))
                              event.dataTransfer.effectAllowed = 'copy'
                            }
                            return (
                              <div
                                key={item.id}
                                draggable
                                onDragStart={handleDragStart}
                                className="flex cursor-grab items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/40 px-2 py-1.5 text-xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-medium text-slate-200">{item.name}</div>
                                  <div className="truncate text-[10px] text-slate-500">{format(t('library.rentman.idLine', 'Rentman-ID {id}'), { id: item.id })}</div>
                                </div>
                                {/* Pro User-Request: per-Geraete AI-Button im
                                    Rentman-Katalog entfernt. AI-Port-Vorschlag
                                    laeuft jetzt nur noch ueber den Drop-auf-
                                    Canvas-Wizard (NewRentmanDeviceWizard) und
                                    den Properties-Sidebar-Button. */}
                                {linkedRentmanProjectId && (
                                  <button
                                    type="button"
                                    onClick={() => handleAddCatalogItemToProject(item)}
                                    disabled={busy}
                                    className="rounded bg-orange-700 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                                  >
                                    {busy ? '…' : '+ Projekt'}
                                  </button>
                                )}
                              </div>
                            )
                          }

                          // While searching, show a flat result list (no tree noise).
                          if (query) {
                            return <div className="space-y-1">{filtered.map(renderItem)}</div>
                          }

                          // Build folder tree from the loaded folder records.
                          const folders = rentmanFolderTree
                          const folderIds = Object.keys(folders)
                          const childMap = new Map<string | null, string[]>()
                          for (const fid of folderIds) {
                            const parentId = folders[fid].parentId
                            const parentKey = parentId && folders[parentId] ? parentId : null
                            const list = childMap.get(parentKey) ?? []
                            list.push(fid)
                            childMap.set(parentKey, list)
                          }
                          for (const list of childMap.values()) {
                            list.sort((a, b) => folders[a].name.localeCompare(folders[b].name))
                          }

                          // Group catalog items by their folderId.
                          const itemsByFolder = new Map<string | null, typeof filtered>()
                          for (const item of filtered) {
                            const key = item.folderId && folders[item.folderId] ? item.folderId : null
                            const list = itemsByFolder.get(key) ?? []
                            list.push(item)
                            itemsByFolder.set(key, list)
                          }

                          // Count items recursively (folder + all descendants).
                          const countCache = new Map<string, number>()
                          const countItems = (folderId: string): number => {
                            const cached = countCache.get(folderId)
                            if (cached !== undefined) return cached
                            let total = itemsByFolder.get(folderId)?.length ?? 0
                            for (const child of childMap.get(folderId) ?? []) total += countItems(child)
                            countCache.set(folderId, total)
                            return total
                          }

                          const toggleFolder = (id: string) =>
                            setCollapsedCatalogFolders((prev) => {
                              const next = new Set(prev)
                              if (next.has(id)) next.delete(id)
                              else next.add(id)
                              return next
                            })

                          const renderFolder = (folderId: string, depth: number): ReactNode => {
                            const folder = folders[folderId]
                            const collapsed = collapsedCatalogFolders.has(folderId)
                            const total = countItems(folderId)
                            if (total === 0) return null
                            const folderItems = (itemsByFolder.get(folderId) ?? [])
                              .slice()
                              .sort((a, b) => a.name.localeCompare(b.name))
                            const childIds = childMap.get(folderId) ?? []
                            return (
                              <div key={folderId} className="rounded border border-slate-800/80">
                                <button
                                  type="button"
                                  onClick={() => toggleFolder(folderId)}
                                  className="flex w-full items-center justify-between gap-1 px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-300 hover:text-slate-100"
                                  style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
                                >
                                  <span className="flex items-center gap-1">
                                    <span>{collapsed ? '▶' : '▼'}</span>
                                    <span>📁</span>
                                    <span>{folder.name}</span>
                                  </span>
                                  <span className="font-normal text-slate-500">({total})</span>
                                </button>
                                {!collapsed && (
                                  <div className="space-y-1 px-1 pb-1">
                                    {folderItems.length > 0 && (
                                      <div className="space-y-1" style={{ paddingLeft: `${(depth + 1) * 0.75}rem` }}>
                                        {folderItems.map(renderItem)}
                                      </div>
                                    )}
                                    {childIds.map((child) => renderFolder(child, depth + 1))}
                                  </div>
                                )}
                              </div>
                            )
                          }

                          const rootFolderIds = childMap.get(null) ?? []
                          const orphans = (itemsByFolder.get(null) ?? [])
                            .slice()
                            .sort((a, b) => a.name.localeCompare(b.name))

                          return (
                            <div className="space-y-2">
                              {rootFolderIds.map((id) => renderFolder(id, 0))}
                              {orphans.length > 0 && (
                                <div className="rounded border border-slate-800/80">
                                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    Ohne Ordner <span className="font-normal text-slate-600">({orphans.length})</span>
                                  </div>
                                  <div className="space-y-1 px-2 pb-1">{orphans.map(renderItem)}</div>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {rentmanView === 'sync' && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-amber-300">{t('library.rentman.reconcile', 'Abgleich Canvas ↔ Rentman')}</h2>
                  <span className="text-[10px] text-slate-500">{untracked.length} nicht erfasst</span>
                </div>
                {/* v7.9.128 — Auch im Sync-View ein prominenter Fetch-Knopf.
                    Der User landet hier wenn er pruefen will, was neu in
                    Rentman ist — ohne diesen Knopf musste er zurueck zu
                    Importiert und den orangenen Sync-Button suchen. */}
                {linkedRentmanProjectId && (
                  <button
                    type="button"
                    onClick={openRentmanImport}
                    className="mb-3 w-full rounded bg-orange-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-orange-500"
                    title={t('library.rentman.loadProjectTitle', 'Equipment-Liste aus dem verknüpften Rentman-Projekt jetzt laden. Neue Items können direkt importiert werden.')}
                  >
                    🔄 Aus Rentman aktualisieren / neue Items importieren
                  </button>
                )}
                {removed.length > 0 && (
                  <div className="mb-2 space-y-1">
                    <div className="mb-1 text-[10px] text-red-400">{t('library.rentman.removed', 'Nicht mehr in Rentman vorhanden:')}</div>
                    {removed.map((equipment) => (
                      <div key={equipment.id} className="flex items-center justify-between rounded border border-red-700/50 bg-red-900/20 px-2 py-1 text-xs">
                        <div>
                          <span className="font-medium text-slate-100">{equipment.name}</span>
                          <span className="ml-1 text-[10px] text-slate-500">{equipment.category}</span>
                        </div>
                        <span className="text-[10px] text-red-400">entfernt</span>
                      </div>
                    ))}
                  </div>
                )}
                {untracked.length === 0 ? (
                  <div className="rounded border border-emerald-700/40 bg-emerald-900/10 p-2 text-center text-xs text-emerald-400">
                    ✓ Alle Canvas-Geräte haben eine Rentman-ID.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {untracked.map((equipment) => (
                      <div key={equipment.id} className="flex items-center justify-between rounded border border-amber-700/30 bg-amber-900/10 px-2 py-1 text-xs">
                        <div>
                          <span className="font-medium text-slate-100">{equipment.name}</span>
                          <span className="ml-1 text-[10px] text-slate-500">{equipment.category}</span>
                        </div>
                        <span className="text-[10px] text-amber-500">kein Rentman-ID</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {tab === 'groups' && <GroupsTab />}

      {tab === 'racks' && (
        <RacksTab
          onCreateRack={() => setShowRackBuilderDialog(true)}
          onEditRack={(presetId) => {
            setEditingRackPresetId(presetId)
            setShowRackBuilderDialog(true)
          }}
        />
      )}

      {showNetBoxDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded border border-slate-700 bg-slate-900 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">{t('library.netbox.title', 'NetBox Import')}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Importiert Geräte aus der NetBox device-type-library in die lokale Library. Nicht-destruktiv: bestehende Geräte auf dem Canvas bleiben unverändert.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNetBoxDialog(false)}
                className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
              >
                Schließen
              </button>
            </div>

            <div className="mb-3 flex gap-2">
              <input
                value={netBoxQuery}
                onChange={(event) => setNetBoxQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleSearchNetBox()
                  }
                }}
                placeholder={t('library.netbox.searchPlaceholder', 'z.B. blackmagic atem, cisco catalyst, yamaha ql5')}
                className="flex-1 rounded border border-slate-700 bg-slate-950 p-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleSearchNetBox()}
                disabled={netBoxBusy || netBoxQuery.trim().length < 2}
                className="rounded bg-cyan-700 px-3 py-2 text-sm font-semibold hover:bg-cyan-600 disabled:opacity-50"
              >
                {netBoxBusy ? 'Suche…' : 'Suchen'}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearNetBoxIndexCache()
                  setNetBoxResults([])
                }}
                className="rounded bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"
                title={t('library.netbox.refreshTitle', 'GitHub-Index neu laden')}
              >
                Cache leeren
              </button>
            </div>

            {netBoxError && (
              <div className="mb-3 rounded border border-red-700/60 bg-red-900/30 px-3 py-2 text-xs text-red-100">
                {netBoxError}
              </div>
            )}

            <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
              Treffer {netBoxResults.length > 0 ? `(${netBoxResults.length})` : ''}
            </div>
            <div className="space-y-2">
              {netBoxResults.length === 0 ? (
                <div className="rounded border border-slate-700 bg-slate-950/50 p-3 text-xs text-slate-400">
                  Hersteller + Modell suchen. Beispiel: „blackmagic atem", „yamaha ql5", „cisco catalyst 9300".
                </div>
              ) : (
                netBoxResults.map((item) => {
                  const busy = netBoxImportBusy === item.path
                  return (
                    <div
                      key={item.path}
                      className="flex items-center justify-between gap-3 rounded border border-slate-700 bg-slate-950/50 p-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-slate-100">
                          {item.manufacturer} {item.model}
                        </div>
                        <div className="truncate text-[11px] text-slate-500">{item.path}</div>
                        <div className="mt-2 flex max-w-[340px] items-center gap-2">
                          <span className="text-[11px] text-slate-400">{t('library.netbox.categoryLabel', 'Kategorie:')}</span>
                          <select
                            value={netBoxCategoryByPath[item.path] ?? ''}
                            onChange={(event) =>
                              setNetBoxCategoryByPath((current) => ({
                                ...current,
                                [item.path]: event.target.value,
                              }))
                            }
                            className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                          >
                            <option value="">{t('library.netbox.pickCategory', 'Bitte auswählen...')}</option>
                            {existingCategoryOptions.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleImportNetBox(item)}
                        disabled={busy || !(netBoxCategoryByPath[item.path] ?? '').trim()}
                        className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {busy ? 'Import…' : 'Importieren'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded border border-slate-700 bg-slate-900 p-4">
            <h3 className="mb-3 text-base font-semibold">
              {t('library.create.title', 'Eigenes Gerät anlegen')}
            </h3>
            <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
              <label className="block">
                Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
                />
              </label>
              <label className="block">
                Kategorie
                <CategorySelect
                  value={category}
                  onChange={setCategory}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
                />
              </label>
              <label className="block">
                19" Rack-Gerät
                <label className="mt-2 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={isRackDeviceDraft}
                    onChange={(event) => setIsRackDeviceDraft(event.target.checked)}
                  />
                  <span>{t('library.create.isRack', 'Ist Rack-Gerät')}</span>
                </label>
                {isRackDeviceDraft && (
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={rackUnitsDraft}
                    onChange={(event) => setRackUnitsDraft(event.target.value ? Number(event.target.value) : '')}
                    placeholder={t('library.create.hePlaceholder', 'HE')}
                    className="mt-2 w-full rounded border border-slate-700 bg-slate-950 p-2"
                  />
                )}
              </label>
            </div>

            <div className="mb-2 rounded border border-violet-800/60 bg-violet-950/30 p-2 text-xs">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-y-1 gap-x-2">
                <span className="font-semibold text-violet-200">
                  Auto-Vorschlag aus Geräte-Name
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAiKeyDraft(getGeminiApiKey())
                    setAiSettingsOpen(true)
                  }}
                  className="text-[10px] text-violet-300 hover:underline"
                  title={t('library.create.aiSettings', 'Gemini-API-Key konfigurieren')}
                >
                  ⚙ AI-Settings
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={handleHeuristicSuggest}
                  className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
                  title={t('library.create.suggest.heuristicTitle', 'Aus eingebauten Heuristik-Mustern (Camera, ATEM, Konverter, ...)')}
                >
                  📐 Heuristik
                </button>
                <button
                  type="button"
                  disabled={webLoading}
                  onClick={handleWebSuggest}
                  className="rounded bg-emerald-700 px-2 py-1 hover:bg-emerald-600 disabled:opacity-50"
                  title={t('library.create.suggest.webTitle', 'Wikipedia + DuckDuckGo Snippet (kein API-Key nötig)')}
                >
                  {webLoading ? 'Suche…' : '🌐 Web'}
                </button>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={handleAiSuggest}
                  className="rounded bg-violet-700 px-2 py-1 hover:bg-violet-600 disabled:opacity-50"
                  title={t('library.create.suggest.geminiTitle', 'Gemini AI — braucht einen API-Key')}
                >
                  {aiLoading ? 'Frage…' : '✨ Gemini'}
                </button>
              </div>
              {suggestError && (
                <div className="mt-1 text-amber-300">{suggestError}</div>
              )}
              {suggestInfo && (
                <div className="mt-1 text-emerald-300">{suggestInfo}</div>
              )}
            </div>

            {aiSettingsOpen && (
              <div className="mb-2 rounded border border-slate-700 bg-slate-950 p-2 text-xs">
                <div className="mb-1 font-semibold text-slate-200">{t('library.create.aiKey.label', 'Gemini API-Key')}</div>
                <div className="flex gap-1">
                  <input
                    type="password"
                    value={aiKeyDraft}
                    onChange={(e) => setAiKeyDraft(e.target.value)}
                    placeholder={t('library.create.aiKey.placeholder', 'AIza…')}
                    className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setGeminiApiKey(aiKeyDraft.trim())
                      setAiSettingsOpen(false)
                      setSuggestError('')
                    }}
                    className="rounded bg-emerald-700 px-2 py-1 hover:bg-emerald-600"
                  >
                    Speichern
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiSettingsOpen(false)}
                    className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
                  >
                    Abbrechen
                  </button>
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  Gespeichert nur lokal in localStorage. Key bei{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    aistudio.google.com
                  </a>{' '}
                  erstellen.
                </div>
              </div>
            )}

            <div className="mb-2 flex flex-wrap items-center justify-between gap-y-1 gap-x-2">
              <div className="text-sm font-semibold">
                {t('library.create.portGroups', 'Port-Gruppen')}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => addGroup('in')}
                  className="rounded bg-sky-700 px-2 py-1 hover:bg-sky-600"
                >
                  {t('library.create.addInputGroup', '+ Input-Gruppe')}
                </button>
                <button
                  type="button"
                  onClick={() => addGroup('out')}
                  className="rounded bg-green-700 px-2 py-1 hover:bg-green-600"
                >
                  {t('library.create.addOutputGroup', '+ Output-Gruppe')}
                </button>
              </div>
            </div>

            <div className="mb-3 space-y-2">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="grid grid-cols-[80px_70px_1fr_1fr_40px] items-center gap-2 rounded border border-slate-700 bg-slate-950 p-2 text-xs"
                >
                  <select
                    value={group.direction}
                    onChange={(event) =>
                      updateGroup(group.id, { direction: event.target.value as 'in' | 'out' })
                    }
                    className="rounded border border-slate-700 bg-slate-900 p-1"
                  >
                    <option value="in">Input</option>
                    <option value="out">Output</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={group.count}
                    onChange={(event) =>
                      updateGroup(group.id, { count: Number(event.target.value) })
                    }
                    className="rounded border border-slate-700 bg-slate-900 p-1"
                  />
                  <select
                    value={group.connectorType}
                    onChange={(event) =>
                      updateGroup(group.id, {
                        connectorType: event.target.value as ConnectorType,
                      })
                    }
                    className="rounded border border-slate-700 bg-slate-900 p-1"
                  >
                    {connectorOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <input
                    value={group.label}
                    onChange={(event) => updateGroup(group.id, { label: event.target.value })}
                    placeholder={t('library.create.groupLabelPrefix', 'Label prefix')}
                    className="rounded border border-slate-700 bg-slate-900 p-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeGroup(group.id)}
                    className="rounded bg-red-700 px-2 py-1 hover:bg-red-600"
                    title={t('library.create.removeGroup', 'Gruppe entfernen')}
                  >
                    ×
                  </button>
                </div>
              ))}
              {groups.length === 0 && (
                <div className="text-xs text-slate-400">No port groups yet. Add one above.</div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateDialog(false)
                  // v7.9.108 — Cancel raeumt auch den Empty-Drop-Trigger
                  // weg, damit der naechste Drop nicht aus Versehen das
                  // alte Save-Target verwendet.
                  setPendingDropOnSave(null)
                  resetDialog()
                }}
                className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
              >
                {t('common.cancel', 'Abbrechen')}
              </button>
              <button
                type="button"
                onClick={saveCustomToLibrary}
                className="rounded bg-sky-600 px-3 py-1 text-sm hover:bg-sky-500"
                title={t(
                  'library.create.saveTitle',
                  'In die Bibliothek speichern (zur Wiederverwendung)',
                )}
              >
                {t('library.create.save', 'In Bibliothek speichern')}
              </button>
              <button
                type="button"
                onClick={saveCustomAndPlace}
                className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500"
                title={t(
                  'library.create.savePlaceTitle',
                  'Speichern und gleich auf dem Canvas platzieren',
                )}
              >
                {t('library.create.savePlace', 'Speichern + Platzieren')}
              </button>
            </div>
          </div>
        </div>
      )}

      <RackBuilderDialog
        open={showRackBuilderDialog}
        templates={rackBuilderTemplates}
        initialPreset={
          editingRackPresetId
            ? groupPresets.find((p) => p.id === editingRackPresetId) ?? null
            : // v7.9.0 / Issue #120 — wenn der RackBuilder via Toolbar-Seed
              // geöffnet wurde, übergeben wir die synthetisierte Preset
              // als initialPreset. Beim Speichern wird id durch addGroupPreset
              // ggf. überschrieben (Upsert).
              seedPreset
        }
        onClose={() => {
          setShowRackBuilderDialog(false)
          setEditingRackPresetId(null)
          setSeedPreset(null)
          setEditingCanvasRackEquipmentId(null)
        }}
        onSave={(preset) => {
          // v7.9.105 / Issue #224 — Wenn der Dialog aus dem Canvas-
          // Toolbar-'Rack bearbeiten'-Button geoeffnet wurde, schreiben
          // wir die Aenderungen ins Canvas-Equipment zurueck (Ports +
          // Snapshot), nicht in die Library-Preset.
          if (editingCanvasRackEquipmentId) {
            replaceCanvasRackWithPreset(editingCanvasRackEquipmentId, preset)
          } else {
            // addGroupPreset upserts by id, so edit-mode reuses the same
            // id and simply overwrites the existing entry. For seed-mode
            // the synthetic __seed- id is replaced by a fresh uuid in
            // saveRack already.
            addGroupPreset(preset)
          }
          setShowRackBuilderDialog(false)
          setEditingRackPresetId(null)
          setSeedPreset(null)
          setEditingCanvasRackEquipmentId(null)
          setTab('racks')
        }}
      />

      {netBoxConflict && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-xl rounded border border-amber-600 bg-slate-900 p-4 text-slate-100">
            <h3 className="mb-2 text-base font-semibold text-amber-300">{t('library.duplicate.title', 'Gerät existiert bereits')}</h3>
            <p className="mb-3 text-sm text-slate-300">
              {netBoxConflict.incoming.name} ist bereits in der lokalen Library. Wahlen, wie importiert werden soll.
            </p>
            <div className="mb-3 rounded border border-slate-700 bg-slate-950/40 p-2 text-xs text-slate-400">
              Lokal: {netBoxConflict.existing.inputs.length} In / {netBoxConflict.existing.outputs.length} Out
              <br />
              NetBox: {netBoxConflict.incoming.inputs.length} In / {netBoxConflict.incoming.outputs.length} Out
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNetBoxConflict(null)}
                className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={async () => {
                  setNetBoxConflict(null)
                  await infoDialog('Lokale Version beibehalten', {
                    body: 'Die bestehende Library-Version bleibt unverändert.',
                    tone: 'info',
                  })
                }}
                className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
              >
                Lokal behalten
              </button>
              <button
                type="button"
                onClick={async () => {
                  addCustomTemplate(netBoxConflict.incoming)
                  setNetBoxConflict(null)
                  await infoDialog('NetBox-Version übernommen', {
                    body: 'Die lokale Version wurde durch die NetBox-Version ersetzt.',
                    tone: 'success',
                  })
                }}
                className="rounded bg-amber-700 px-3 py-1 text-sm hover:bg-amber-600"
              >
                Uberschreiben
              </button>
              <button
                type="button"
                onClick={() => {
                  setNetBoxMergePair(netBoxConflict)
                  setNetBoxConflict(null)
                }}
                className="rounded bg-emerald-700 px-3 py-1 text-sm hover:bg-emerald-600"
              >
                Merge Ports
              </button>
            </div>
          </div>
        </div>
      )}

      <TemplateMergeDialog
        open={!!netBoxMergePair}
        localTemplate={netBoxMergePair?.existing ?? null}
        incomingTemplate={netBoxMergePair?.incoming ?? null}
        incomingLabel="NetBox"
        categoryOptions={existingCategoryOptions}
        initialCategory={netBoxMergePair?.incoming.category}
        onCancel={() => setNetBoxMergePair(null)}
        onConfirm={async (merged) => {
          addCustomTemplate(merged)
          setNetBoxMergePair(null)
          await infoDialog('Merge gespeichert', {
            body: 'Die zusammengeführte Version wurde in der Library gespeichert.',
            tone: 'success',
          })
        }}
      />
    </aside>
  )

  // v7.9.2 — Floating-Modus entfernt. Library ist fest gedockt.
  return inner
}
