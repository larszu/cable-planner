import { useEffect, useMemo, useState } from 'react'
import { Settings, Ruler, Globe, Sparkles, ExternalLink } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { Icon } from '../shared/Icon'
import { Spinner } from '../shared/Spinner'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { useModule } from '../../store/settingsStore'
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
import type { ConnectorType, EquipmentTemplate } from '../../types/equipment'
import { nextPlacementPosition } from '../../lib/library'
import {
  clearNetBoxIndexCache,
  importNetBoxDeviceType,
  searchNetBoxDeviceTypes,
  type NetBoxDeviceTypeSearchResult,
} from '../../lib/netboxImport'
import { RackBuilderDialog } from '../Rack/RackBuilderDialog'
import { TemplateMergeDialog } from './TemplateMergeDialog'
import { FloatingPanelShell } from '../Layout/FloatingPanelShell'
import { triggerCanvasFitView } from '../../lib/canvasViewport'
import { openPanelPopout, isPopout } from '../../lib/panelPopout'
import { usePanelTearOff } from '../../lib/usePanelTearOff'
import { TabButton } from './TabButton'
import { GroupsTab } from './tabs/GroupsTab'
import { RacksTab } from './tabs/RacksTab'
import { LocalEquipmentTab } from './tabs/LocalEquipmentTab'
import { RentmanTab } from './tabs/RentmanTab'
import { parseLibraryItemFile } from '../../lib/itemExport'
import { pickTextFile } from '../../lib/pickFile'
import { CableLibraryPanel } from './CableLibraryPanel'

const connectorOptions = ALL_CONNECTOR_TYPES

import { defaultGroup, buildPorts } from './libraryPanelHelpers'
import type { PortGroupDraft } from './libraryPanelHelpers'




// v7.9.5 — Tab-Button-Helper. SVG-Icon links, Label rechts, optionaler
// count-Badge. Aktiv-Style: sky-700-bg, weiße Schrift, kein Hover.

export const LibraryPanel = () => {
  const t = useTranslation()
  const addEquipment = useProjectStore((state) => state.addEquipment)
  const equipmentCount = useProjectStore((state) => state.project.equipment.length)
  const equipmentItems = useProjectStore((state) => state.project.equipment)
  const customLibrary = useProjectStore((state) => state.customLibrary)
  const knownCategories = useProjectStore((state) => state.knownCategories)
  const addCustomTemplate = useProjectStore((state) => state.addCustomTemplate)
  const collapsed = useUiStore((state) => state.libraryCollapsed)
  // v7.9.4 — Rentman-Tabs ausblenden wenn die Integration deaktiviert ist.
  const rentmanEnabled = useModule('rentman')
  const toggleCollapsed = useUiStore((state) => state.toggleLibraryCollapsed)
  // #427 — In separates OS-Fenster ausgelagert (Hauptfenster blendet aus);
  //  inPopout = wir SIND dieses Fenster (dann keine Ab-/Andock-Controls).
  const poppedOut = useUiStore((state) => state.libraryPoppedOut)
  const inPopout = isPopout()
  // #427 — Library wie die anderen Panels frei abdockbar (FloatingPanelShell).
  const floating = useUiStore((state) => state.libraryFloating)
  const setFloating = useUiStore((state) => state.setLibraryFloating)
  const floatingPos = useUiStore((state) => state.libraryFloatingPos)
  const setFloatingPos = useUiStore((state) => state.setLibraryFloatingPos)
  const libraryWidth = useUiStore((state) => state.libraryWidth)
  const setLibraryWidth = useUiStore((state) => state.setLibraryWidth)
  // #427 — Header herausziehen = abdocken; folgt danach dem Cursor.
  const tearOff = usePanelTearOff({
    onUndock: (p) => {
      setFloatingPos(p)
      setFloating(true)
    },
    onDragMove: setFloatingPos,
    onDrop: () => window.setTimeout(triggerCanvasFitView, 60),
  })
  const addKnownCategories = useProjectStore((state) => state.addKnownCategories)
  const groupPresets = useProjectStore((state) => state.groupPresets)
  const addGroupPreset = useProjectStore((state) => state.addGroupPreset)
  // v7.9.105 / Issue #224 — In-Place-Edit fuer Canvas-Racks.
  const replaceCanvasRackWithPreset = useProjectStore(
    (state) => state.replaceCanvasRackWithPreset,
  )
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
  // Hochgezogen über die Drop-/Seed-Effekte, damit der React-Compiler die
  // Setter vor ihrem Gebrauch im useEffect sieht (react-hooks/immutability).
  const [name, setName] = useState('Custom Device')
  const [category, setCategory] = useState('Kameras')
  const [tab, setTab] = useState<'equipment' | 'cables' | 'groups' | 'racks'>('equipment')
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
  // #401 — Werkzeuge → Rack Builder oeffnet einen leeren RackBuilder.
  const newRackBuilderTrigger = useUiStore((s) => s.newRackBuilderTrigger)
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- One-shot Store-Trigger (Rack-Builder seeden), danach Trigger clearen
    setSeedPreset(synthesized)
    setEditingRackPresetId(null)
    setShowRackBuilderDialog(true)
    setTab('racks')
    clearRackBuilderSeedTrigger()
  }, [rackBuilderSeedTrigger, equipmentItems, clearRackBuilderSeedTrigger])

  // #401 — Werkzeuge → Rack Builder: leerer Builder, Racks-Tab im Focus.
  // Counter-Pattern (Date.now), damit jeder Klick einen neuen Trigger
  // feuert auch wenn der vorherige schon abgewickelt ist.
  useEffect(() => {
    if (!newRackBuilderTrigger) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- One-shot Store-Trigger (leeren Rack-Builder öffnen), danach clearen
    setSeedPreset(null)
    setEditingRackPresetId(null)
    setEditingCanvasRackEquipmentId(null)
    setShowRackBuilderDialog(true)
    setTab('racks')
  }, [newRackBuilderTrigger])

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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- One-shot Store-Trigger (Rack aus Black-Box editieren), danach clearen
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- One-shot Store-Trigger (Empty-Device-Drop), danach clearen
    setName(pendingEmptyDeviceDrop.name || t('library.create.defaultName', 'Neues Gerät'))
    if (pendingEmptyDeviceDrop.category) setCategory(pendingEmptyDeviceDrop.category)
    setPendingDropOnSave({ x: pendingEmptyDeviceDrop.x, y: pendingEmptyDeviceDrop.y })
    setShowCreateDialog(true)
    clearEmptyDeviceDrop()
  }, [pendingEmptyDeviceDrop, clearEmptyDeviceDrop])

  const [isRackDeviceDraft, setIsRackDeviceDraft] = useState(false)
  const [rackUnitsDraft, setRackUnitsDraft] = useState<number | ''>('')
  const [groups, setGroups] = useState<PortGroupDraft[]>([
    defaultGroup('in'),
    defaultGroup('out'),
  ])
  // Equipment sub-section: separates local templates from Rentman-imported ones
  // inside one shared tab, so the user always lives in "Equipment" and just
  // toggles the source.
  // #427/UX — Standardmäßig die lokale Bibliothek (Katalog mit Inhalt) zeigen,
  // nicht die meist leere Rentman-Import-Ansicht. Sonst landet ein neuer Nutzer
  // auf „Keine Rentman-Geräte importiert" statt auf den 150+ Vorlagen.
  const [equipmentSection, setEquipmentSection] = useState<'local' | 'rentman'>('local')
  // Local-device-create dialog: same Gemini-AI / Web-search auto-fill the
  // Rentman wizard already offers (user request, parallels NewRentmanDeviceWizard).
  const [aiLoading, setAiLoading] = useState(false)
  const [webLoading, setWebLoading] = useState(false)
  const [suggestError, setSuggestError] = useState('')
  const [suggestInfo, setSuggestInfo] = useState('')
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  const [aiKeyDraft, setAiKeyDraft] = useState('')
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
      setSuggestError(t('library.suggest.heuristic.noMatch', 'Keine Heuristik-Treffer für diesen Namen.'))
      return
    }
    setGroups(hintsToLocalDrafts(hints))
    setSuggestInfo(
      format(t('library.suggest.heuristic.ok', '{n} Port-Gruppe(n) per Heuristik vorgeschlagen.'), {
        n: hints.length,
      }),
    )
  }

  const handleAiSuggest = async () => {
    setSuggestError('')
    setSuggestInfo('')
    if (!getGeminiApiKey()) {
      setAiKeyDraft('')
      setAiSettingsOpen(true)
      setSuggestError(t('library.suggest.ai.noKey', 'Kein Gemini-API-Key. Trage einen ein oder nutze Web/Heuristik.'))
      return
    }
    setAiLoading(true)
    try {
      const hints = await suggestFromAI(name, category)
      if (hints.length === 0) {
        setSuggestError(t('library.suggest.ai.noPorts', 'Gemini lieferte keine Ports zurück.'))
        return
      }
      setGroups(hintsToLocalDrafts(hints))
      setSuggestInfo(
        format(t('library.suggest.ai.ok', '{n} Port-Gruppe(n) von Gemini übernommen.'), {
          n: hints.length,
        }),
      )
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : t('library.suggest.ai.error', 'Gemini-Aufruf fehlgeschlagen'))
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
            ? format(
                t(
                  'library.suggest.web.noPlugs',
                  'Keine Stecker im {source}-Snippet erkannt. Hersteller + Modell präzisieren.',
                ),
                { source },
              )
            : t('library.suggest.web.noHit', 'Kein Treffer im Web. Hersteller + Modell präzisieren.'),
        )
        return
      }
      setGroups(hintsToLocalDrafts(hints))
      setSuggestInfo(
        format(t('library.suggest.web.ok', '{n} Port-Gruppe(n) aus {source} übernommen.'), {
          n: hints.length,
          source,
        }),
      )
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
      await infoDialog(t('library.import.unknownFileTitle', 'Datei nicht erkannt'), {
        body: t(
          'library.import.unknownFileBody',
          'Diese Datei ist kein gültiger .cpdevice- oder .cpgroup-Export.',
        ),
        tone: 'error',
      })
      return
    }
    if (parsed.kind === 'device') {
      const template = parsed.template
      const conflict = customLibrary.some((tpl) => tpl.name === template.name)
      if (conflict) {
        const overwrite = await confirmDialog(
          format(
            t('library.import.deviceExists', 'Ein Gerät mit dem Namen "{name}" existiert bereits.\n\nÜberschreiben?'),
            { name: template.name },
          ),
          { okLabel: t('common.overwrite', 'Überschreiben'), destructive: true },
        )
        if (!overwrite) return
      }
      addCustomTemplate(template)
      await infoDialog(t('library.import.deviceOkTitle', 'Gerät importiert'), {
        body: format(t('library.import.deviceOkBody', '"{name}" wurde der Library hinzugefügt.'), {
          name: template.name,
        }),
        tone: 'success',
      })
      return
    }
    // group
    const preset = parsed.preset
    const nameConflict = groupPresets.find((p) => p.name === preset.name)
    if (nameConflict) {
      const overwrite = await confirmDialog(
        format(
          t('library.import.groupExists', 'Eine Gruppe mit dem Namen "{name}" existiert bereits.\n\nÜberschreiben?'),
          { name: preset.name },
        ),
        { okLabel: t('common.overwrite', 'Überschreiben'), destructive: true },
      )
      if (!overwrite) return
      addGroupPreset({ ...preset, id: nameConflict.id })
    } else {
      // Frische UUID damit ein evtl. ID-Clash mit einer bestehenden
      // Preset-ID (Re-Import nach Rename) nicht stillschweigend
      // überschreibt.
      addGroupPreset({ ...preset, id: uuidv4() })
    }
    const kindLabel = preset.rack
      ? t('library.import.kindRack', 'Rack')
      : t('library.import.kindGroup', 'Gruppe')
    await infoDialog(format(t('library.import.kindOkTitle', '{kind} importiert'), { kind: kindLabel }), {
      body: format(
        t(
          'library.import.kindOkBody',
          '"{name}" wurde der Library hinzugefügt ({devices} Geräte, {cables} interne Kabel).',
        ),
        {
          name: preset.name,
          devices: String(preset.items.length),
          cables: String(preset.cables.length),
        },
      ),
      tone: 'success',
    })
  }

  const handleImportNetBox = async (item: NetBoxDeviceTypeSearchResult) => {
    const selectedCategory = (netBoxCategoryByPath[item.path] ?? '').trim()
    if (!selectedCategory) {
      setNetBoxError(
        t(
          'library.netbox.pickCategoryError',
          'Bitte eine bestehende Kategorie für diesen Import auswählen.',
        ),
      )
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
      await infoDialog(
        format(t('library.netbox.importedTitle', '{name} importiert'), { name: template.name }),
        {
          body: t('library.netbox.importedBody', 'Aus NetBox in die Library übernommen.'),
          tone: 'success',
        },
      )
    } catch (error) {
      setNetBoxError(error instanceof Error ? error.message : String(error))
    } finally {
      setNetBoxImportBusy(null)
    }
  }

  // #427 — In separates OS-Fenster ausgelagert: im Hauptfenster NICHT rendern
  // (sonst doppelt offen). In-flow Platzhalter besetzt die (0px) Grid-Spalte,
  // damit die nachfolgenden Grid-Kinder nicht verrutschen.
  if (poppedOut && !inPopout) {
    return <div aria-hidden className="min-h-0" />
  }

  if (collapsed && !floating) {
    return (
      <aside className="flex h-full w-8 flex-col items-center border-r border-cp-border bg-cp-surface-3 transition-colors hover:bg-cp-surface-1">
        <button
          type="button"
          onClick={toggleCollapsed}
          title={t('library.show', 'Library einblenden')}
          aria-label={t('library.show', 'Library einblenden')}
          className="mt-2 flex h-7 w-7 items-center justify-center rounded-full border border-cp-border bg-cp-surface-1 text-cp-text-secondary shadow-sm transition-all hover:border-sky-500 hover:bg-cp-surface-2 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <span className="text-cp-lg leading-none">›</span>
        </button>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={t('library.show', 'Library einblenden')}
          className="mt-3 flex-1 self-stretch text-[10px] font-semibold uppercase tracking-[0.18em] text-cp-text-muted transition-colors hover:text-cp-text-secondary focus-visible:outline-none focus-visible:text-sky-300"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {t('library.title', 'Library')}
        </button>
      </aside>
    )
  }
  const inner = (
    <aside className={`flex h-full min-h-0 flex-col ${floating ? 'bg-transparent p-3' : 'border-r border-cp-border bg-cp-surface-3 p-3'} text-cp-text`}>
      {/* v7.9.5 — Kompakte Tab-Strip mit SVG-Icons (keine Emojis) und
          konsistent deutschen Labels (Geräte/Kabel/Gruppen/Racks).
          Counts NUR an der kleinsten Granularität — der R-Badge am
          Equipment-Tab ist raus, weil die Lokal/Rentman-Untertoggle
          die gleiche Info zeigt. Tab-Zeile in EINE Zeile gepackt. */}
      <div className="mb-2 flex items-center gap-1 text-cp-xs">
        {!floating && !inPopout && (
          <button
            type="button"
            onClick={toggleCollapsed}
            title={t('library.hide', 'Library ausblenden')}
            aria-label={t('library.hide', 'Library ausblenden')}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cp-border bg-cp-surface-1 text-cp-text-secondary transition-all hover:border-sky-500 hover:bg-cp-surface-2 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <span className="text-cp-lg leading-none">‹</span>
          </button>
        )}
        {!floating && !inPopout && (
          <button
            type="button"
            data-tearoff="handle"
            onPointerDown={tearOff.onPointerDown}
            onClick={() => {
              // Reiner Klick = an Ort und Stelle abdocken; ein Tear-off-Drag
              // hat das bereits erledigt und unterdrückt hier das Doppel-Float.
              if (tearOff.draggedRef.current) return
              setFloating(true)
              window.setTimeout(triggerCanvasFitView, 60)
            }}
            title={t('library.float.title', 'Library abdocken (klicken oder herausziehen)')}
            aria-label={t('library.float.aria', 'Library abdocken')}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cp-border bg-cp-surface-1 text-cp-text-secondary transition-all hover:border-sky-500 hover:bg-cp-surface-2 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            style={{ touchAction: 'none' }}
          >
            <span className="pointer-events-none text-[11px] leading-none">⤢</span>
          </button>
        )}
        {!floating && !inPopout && (
          <button
            type="button"
            onClick={() => openPanelPopout('library')}
            title={t('panel.popoutTitle', 'In separates Fenster auslagern (weiterer Monitor)')}
            aria-label={t('panel.popout', 'Auslagern')}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cp-border bg-cp-surface-1 text-cp-text-secondary transition-all hover:border-sky-500 hover:bg-cp-surface-2 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Icon icon={ExternalLink} size="xs" />
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
          <div className="mb-2 flex gap-1 rounded bg-cp-surface-3/40 p-1">
            <button
              type="button"
              onClick={() => setEquipmentSection('local')}
              className={`flex-1 rounded px-2 py-1 text-cp-xs ${
                equipmentSection === 'local'
                  ? 'bg-sky-700 text-white'
                  : 'text-cp-text-secondary hover:bg-cp-surface-2'
              }`}
              title={t('library.section.localTitle', 'Eigene und importierte Vorlagen, lokal in dieser Installation')}
            >
              <span className="mr-1 rounded bg-sky-900/80 px-1 text-[11px] font-bold text-sky-100">L</span>
              {t('library.section.local', 'Lokal')}
              <span className="ml-1 text-[10px] text-cp-text-muted">
                ({customLibrary.filter((t) => !t.rentmanSource).length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setEquipmentSection('rentman')}
              className={`flex-1 rounded px-2 py-1 text-cp-xs ${
                equipmentSection === 'rentman'
                  ? 'bg-orange-600 text-white'
                  : 'text-cp-text-secondary hover:bg-cp-surface-2'
              }`}
              title={t('library.section.rentmanTitle', 'Aus Rentman importierte Geräte und Account-Katalog')}
            >
              <span className="mr-1 rounded bg-orange-900/80 px-1 text-[11px] font-bold text-orange-100">R</span>
              Rentman
              <span className="ml-1 text-[10px] text-cp-text-muted">
                ({customLibrary.filter((t) => t.rentmanSource).length})
              </span>
            </button>
          </div>
        </>
      )}
      {tab === 'equipment' && (equipmentSection === 'local' || !rentmanEnabled) && (
        <LocalEquipmentTab
          onOpenCreateDialog={() => setShowCreateDialog(true)}
          onImportLibraryFile={handleImportLibraryFile}
        />
      )}

      {tab === 'cables' && <CableLibraryPanel />}

      {tab === 'equipment' && equipmentSection === 'rentman' && rentmanEnabled && (
        <RentmanTab />
      )}

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
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded border border-cp-border bg-cp-surface-1 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-cp-xl font-semibold">{t('library.netbox.title', 'NetBox Import')}</h3>
                <p className="mt-1 text-cp-xs text-cp-text-muted">
                  {t(
                    'library.netbox.intro',
                    'Importiert Geräte aus der NetBox device-type-library in die lokale Library. Nicht-destruktiv: bestehende Geräte auf dem Canvas bleiben unverändert.',
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNetBoxDialog(false)}
                className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
              >
                {t('common.close', 'Schließen')}
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
                aria-label={t('library.netbox.searchPlaceholder', 'z.B. blackmagic atem, cisco catalyst, yamaha ql5')}
                className="flex-1 rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
              />
              <button
                type="button"
                onClick={() => void handleSearchNetBox()}
                disabled={netBoxBusy || netBoxQuery.trim().length < 2}
                className="rounded bg-cyan-700 px-3 py-2 text-cp-base font-semibold hover:bg-cyan-600 disabled:opacity-50"
              >
                {netBoxBusy ? t('library.netbox.searching', 'Suche…') : t('library.netbox.search', 'Suchen')}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearNetBoxIndexCache()
                  setNetBoxResults([])
                }}
                className="rounded bg-cp-surface-4 px-3 py-2 text-cp-base hover:bg-cp-surface-5"
                title={t('library.netbox.refreshTitle', 'GitHub-Index neu laden')}
              >
                {t('library.netbox.clearCache', 'Cache leeren')}
              </button>
            </div>

            {netBoxError && (
              <div className="mb-3 rounded border border-red-700/60 bg-red-900/30 px-3 py-2 text-cp-xs text-red-100">
                {netBoxError}
              </div>
            )}

            <div className="mb-2 text-[11px] uppercase tracking-wide text-cp-text-muted">
              {t('library.netbox.hits', 'Treffer')} {netBoxResults.length > 0 ? `(${netBoxResults.length})` : ''}
            </div>
            <div className="space-y-2">
              {netBoxResults.length === 0 ? (
                <div className="rounded border border-cp-border bg-cp-surface-3/50 p-3 text-cp-xs text-cp-text-muted">
                  {t('library.netbox.emptyHint', 'Hersteller + Modell suchen. Beispiel: „blackmagic atem", „yamaha ql5", „cisco catalyst 9300".')}
                </div>
              ) : (
                netBoxResults.map((item) => {
                  const busy = netBoxImportBusy === item.path
                  return (
                    <div
                      key={item.path}
                      className="flex items-center justify-between gap-3 rounded border border-cp-border bg-cp-surface-3/50 p-3 text-cp-base"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-cp-text">
                          {item.manufacturer} {item.model}
                        </div>
                        <div className="truncate text-[11px] text-cp-text-muted">{item.path}</div>
                        <div className="mt-2 flex max-w-[340px] items-center gap-2">
                          <span className="text-[11px] text-cp-text-muted">{t('library.netbox.categoryLabel', 'Kategorie:')}</span>
                          <select
                            value={netBoxCategoryByPath[item.path] ?? ''}
                            onChange={(event) =>
                              setNetBoxCategoryByPath((current) => ({
                                ...current,
                                [item.path]: event.target.value,
                              }))
                            }
                            className="min-w-0 flex-1 rounded border border-cp-border bg-cp-surface-1 px-2 py-1 text-cp-xs"
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
                        className="rounded bg-emerald-700 px-3 py-1.5 text-cp-xs font-semibold hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {busy ? t('library.netbox.importing', 'Import…') : t('library.netbox.import', 'Importieren')}
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
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded border border-cp-border bg-cp-surface-1 p-4">
            <h3 className="mb-3 text-cp-xl font-semibold">
              {t('library.create.title', 'Eigenes Gerät anlegen')}
            </h3>
            <div className="mb-3 grid grid-cols-3 gap-2 text-cp-base">
              <label className="block">
                {t('common.name', 'Name')}
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
                />
              </label>
              <label className="block">
                {t('library.create.category', 'Kategorie')}
                <CategorySelect
                  value={category}
                  onChange={setCategory}
                  className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
                />
              </label>
              <label className="block">
                {t('library.create.rackDevice', '19" Rack-Gerät')}
                <label className="mt-2 flex items-center gap-2 text-cp-xs">
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
                    className="mt-2 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
                  />
                )}
              </label>
            </div>

            <div className="mb-2 rounded border border-violet-800/60 bg-violet-950/30 p-2 text-cp-xs">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-y-1 gap-x-2">
                <span className="font-semibold text-violet-200">
                  {t('library.suggest.heading', 'Auto-Vorschlag aus Geräte-Name')}
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
                  <Icon icon={Settings} size="xs" className="mr-1 inline-block align-text-bottom" />{t('library.create.aiSettingsLabel', 'AI-Settings')}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={handleHeuristicSuggest}
                  className="rounded bg-cp-surface-4 px-2 py-1 hover:bg-cp-surface-5"
                  title={t('library.create.suggest.heuristicTitle', 'Aus eingebauten Heuristik-Mustern (Camera, ATEM, Konverter, ...)')}
                >
                  <Icon icon={Ruler} size="xs" className="mr-1 inline-block align-text-bottom" />{t('library.create.suggest.heuristic', 'Heuristik')}
                </button>
                <button
                  type="button"
                  disabled={webLoading}
                  onClick={handleWebSuggest}
                  className="rounded bg-emerald-700 px-2 py-1 hover:bg-emerald-600 disabled:opacity-50"
                  title={t('library.create.suggest.webTitle', 'Wikipedia + DuckDuckGo Snippet (kein API-Key nötig)')}
                >
                  {webLoading ? <span className="inline-flex items-center gap-1"><Spinner size="xs" /> {t('library.netbox.searching', 'Suche…')}</span> : <span className="inline-flex items-center gap-1"><Icon icon={Globe} size="xs" /> {t('library.create.suggest.web', 'Web')}</span>}
                </button>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={handleAiSuggest}
                  className="rounded bg-violet-700 px-2 py-1 hover:bg-violet-600 disabled:opacity-50"
                  title={t('library.create.suggest.geminiTitle', 'Gemini AI — braucht einen API-Key')}
                >
                  {aiLoading ? <span className="inline-flex items-center gap-1"><Spinner size="xs" /> {t('library.create.suggest.asking', 'Frage…')}</span> : <span className="inline-flex items-center gap-1"><Icon icon={Sparkles} size="xs" /> {t('library.create.suggest.gemini', 'Gemini')}</span>}
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
              <div className="mb-2 rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-xs">
                <div className="mb-1 font-semibold text-cp-text-bright">{t('library.create.aiKey.label', 'Gemini API-Key')}</div>
                <div className="flex gap-1">
                  <input
                    type="password"
                    value={aiKeyDraft}
                    onChange={(e) => setAiKeyDraft(e.target.value)}
                    placeholder={t('library.create.aiKey.placeholder', 'AIza…')}
                    className="flex-1 rounded border border-cp-border bg-cp-surface-1 px-2 py-1 font-mono"
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
                    {t('common.save', 'Speichern')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiSettingsOpen(false)}
                    className="rounded bg-cp-surface-4 px-2 py-1 hover:bg-cp-surface-5"
                  >
                    {t('common.cancel', 'Abbrechen')}
                  </button>
                </div>
                <div className="mt-1 text-[10px] text-cp-text-muted">
                  {t('library.create.aiKey.hintPrefix', 'Gespeichert nur lokal in localStorage. Key bei')}{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    aistudio.google.com
                  </a>{' '}
                  {t('library.create.aiKey.hintSuffix', 'erstellen.')}
                </div>
              </div>
            )}

            <div className="mb-2 flex flex-wrap items-center justify-between gap-y-1 gap-x-2">
              <div className="text-cp-base font-semibold">
                {t('library.create.portGroups', 'Port-Gruppen')}
              </div>
              <div className="flex flex-wrap gap-2 text-cp-xs">
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
                  className="grid grid-cols-[80px_70px_1fr_1fr_40px] items-center gap-2 rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-xs"
                >
                  <select
                    value={group.direction}
                    onChange={(event) =>
                      updateGroup(group.id, { direction: event.target.value as 'in' | 'out' })
                    }
                    className="rounded border border-cp-border bg-cp-surface-1 p-1"
                  >
                    <option value="in">{t('library.create.directionInput', 'Input')}</option>
                    <option value="out">{t('library.create.directionOutput', 'Output')}</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={group.count}
                    onChange={(event) =>
                      updateGroup(group.id, { count: Number(event.target.value) })
                    }
                    className="rounded border border-cp-border bg-cp-surface-1 p-1"
                  />
                  <select
                    value={group.connectorType}
                    onChange={(event) =>
                      updateGroup(group.id, {
                        connectorType: event.target.value as ConnectorType,
                      })
                    }
                    className="rounded border border-cp-border bg-cp-surface-1 p-1"
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
                    className="rounded border border-cp-border bg-cp-surface-1 p-1"
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
                <div className="text-cp-xs text-cp-text-muted">{t('library.create.noPortGroups', 'Noch keine Port-Gruppen. Oben eine hinzufügen.')}</div>
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
                className="rounded bg-cp-surface-4 px-3 py-1 text-cp-base hover:bg-cp-surface-5"
              >
                {t('common.cancel', 'Abbrechen')}
              </button>
              <button
                type="button"
                onClick={saveCustomToLibrary}
                className="rounded bg-sky-600 px-3 py-1 text-cp-base hover:bg-sky-500"
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
                className="rounded bg-emerald-600 px-3 py-1 text-cp-base hover:bg-emerald-500"
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
          <div className="w-full max-w-xl rounded border border-amber-600 bg-cp-surface-1 p-4 text-cp-text">
            <h3 className="mb-2 text-cp-xl font-semibold text-amber-300">{t('library.duplicate.title', 'Gerät existiert bereits')}</h3>
            <p className="mb-3 text-cp-base text-cp-text-secondary">
              {format(
                t('library.netbox.duplicateIntro', '{name} ist bereits in der lokalen Library. Wahlen, wie importiert werden soll.'),
                { name: netBoxConflict.incoming.name },
              )}
            </p>
            <div className="mb-3 rounded border border-cp-border bg-cp-surface-3/40 p-2 text-cp-xs text-cp-text-muted">
              {t('library.netbox.localCount', 'Lokal')}: {netBoxConflict.existing.inputs.length} In / {netBoxConflict.existing.outputs.length} Out
              <br />
              NetBox: {netBoxConflict.incoming.inputs.length} In / {netBoxConflict.incoming.outputs.length} Out
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNetBoxConflict(null)}
                className="rounded bg-cp-surface-4 px-3 py-1 text-cp-base hover:bg-cp-surface-5"
              >
                {t('common.cancel', 'Abbrechen')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setNetBoxConflict(null)
                  await infoDialog(t('library.netbox.keepLocalTitle', 'Lokale Version beibehalten'), {
                    body: t('library.netbox.keepLocalBody', 'Die bestehende Library-Version bleibt unverändert.'),
                    tone: 'info',
                  })
                }}
                className="rounded bg-cp-surface-4 px-3 py-1 text-cp-base hover:bg-cp-surface-5"
              >
                {t('library.netbox.keepLocalBtn', 'Lokal behalten')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  addCustomTemplate(netBoxConflict.incoming)
                  setNetBoxConflict(null)
                  await infoDialog(t('library.netbox.replacedTitle', 'NetBox-Version übernommen'), {
                    body: t('library.netbox.replacedBody', 'Die lokale Version wurde durch die NetBox-Version ersetzt.'),
                    tone: 'success',
                  })
                }}
                className="rounded bg-amber-700 px-3 py-1 text-cp-base hover:bg-amber-600"
              >
                {t('common.overwrite', 'Überschreiben')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNetBoxMergePair(netBoxConflict)
                  setNetBoxConflict(null)
                }}
                className="rounded bg-emerald-700 px-3 py-1 text-cp-base hover:bg-emerald-600"
              >
                {t('library.netbox.mergePortsBtn', 'Merge Ports')}
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
          await infoDialog(t('library.netbox.mergeSavedTitle', 'Merge gespeichert'), {
            body: t(
              'library.netbox.mergeSavedBody',
              'Die zusammengeführte Version wurde in der Library gespeichert.',
            ),
            tone: 'success',
          })
        }}
      />
    </aside>
  )

  // v7.9.2 — Floating-Modus entfernt. Library ist fest gedockt.
  if (floating) {
    // #427 — Die Library ist das ERSTE Grid-Kind in App.tsx. Würde sie beim
    // Floaten ganz aus dem Fluss verschwinden (FloatingPanelShell = fixed),
    // rutschten alle nachfolgenden Grid-Kinder eine Spalte nach links und das
    // Canvas landete in der 0px-Splitter-Spalte (Breite 0). Darum hier ein
    // in-flow Platzhalter, der die (auf 0px gesetzte) Library-Spalte besetzt,
    // während das eigentliche Panel als Overlay schwebt.
    return (
      <>
        <div aria-hidden className="min-h-0" />
        <FloatingPanelShell
          title={
            <span className="text-cp-base font-semibold text-cp-text">
              {t('library.title', 'Library')}
            </span>
          }
          position={floatingPos}
          onMove={setFloatingPos}
          onDock={() => {
            setFloating(false)
            window.setTimeout(triggerCanvasFitView, 60)
          }}
          onPopout={() => openPanelPopout('library')}
          dockEdge="left"
          onResize={setLibraryWidth}
          width={libraryWidth}
        >
          {inner}
        </FloatingPanelShell>
      </>
    )
  }
  return inner
}

