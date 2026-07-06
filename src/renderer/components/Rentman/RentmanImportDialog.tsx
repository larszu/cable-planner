import { useEffect, useMemo, useRef, useState } from 'react'
import { Zap, Check, AlertTriangle } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { format, useTranslation } from '../../lib/i18n'
import { infoDialog } from '../../lib/infoDialog'
import { bilingualCategoryDialog } from '../../lib/bilingualCategoryDialog'
import { useRentman } from '../../hooks/useRentman'
import { useProjectStore } from '../../store/projectStore'
import { matchBlackmagicTemplate } from '../../lib/blackmagicCatalog'
import { matchUbiquitiTemplate } from '../../lib/ubiquitiCatalog'
import { matchMonitorTemplate } from '../../lib/monitorCatalog'
import { matchCameraTemplate } from '../../lib/cameraCatalog'
import { matchMiscTemplate } from '../../lib/miscCatalog'
import { matchGreenGoTemplate } from '../../lib/greengoCatalog'
import { matchAjaTemplate } from '../../lib/ajaCatalog'
import { matchRossTemplate } from '../../lib/rossCatalog'
import { matchLynxTemplate } from '../../lib/lynxCatalog'
import { matchSwitcherTemplate } from '../../lib/switcherCatalog'
import { matchAvNetworkTemplate } from '../../lib/avNetworkCatalog'
import { matchBroadcastToolsTemplate } from '../../lib/broadcastToolsCatalog'
import { matchAudioTemplate } from '../../lib/audioCatalog'
import { matchWirelessAudioTemplate } from '../../lib/wirelessAudioCatalog'
import { matchMicTemplate } from '../../lib/micCatalog'
import { getCachedRentmanTemplate } from '../../lib/rentmanTemplateCache'
import type { EquipmentTemplate } from '../../types/equipment'
import type { CableType } from '../../types/cable'
import { buildRackPresetFromCombination } from '../../lib/rentmanRack'
import { EquipmentChecklist } from './EquipmentChecklist'
import { NewRentmanDeviceWizard, type UnknownCandidate } from './NewRentmanDeviceWizard'
import { ProjectSelector } from './ProjectSelector'
import { TemplateMergeDialog } from '../Library/TemplateMergeDialog'

import {
  mapProjects, mapEquipment, isRentmanPhysicalFlag,
  autoDetectCategory, loadRentmanCatMap, saveRentmanCatMap, detectCableRows,
} from './rentmanImportHelpers'
import type {
  RentmanProject, RentmanEquipment, DetectedCableRow,
} from './rentmanImportHelpers'

interface RentmanImportDialogProps {
  open: boolean
  onClose: () => void
}

export const RentmanImportDialog = ({ open, onClose }: RentmanImportDialogProps) => {
  const t = useTranslation()
  const { loadProjects, loadProjectEquipment, loadFolders, loadEquipment } = useRentman()
  const customLibrary = useProjectStore((state) => state.customLibrary)
  const projectEquipment = useProjectStore((state) => state.project.equipment)
  
  // Safe close handler that prevents closing during active import operations
  // (fixes race condition when user clicks back/close before import completes)
  const safeClose = () => {
    if (loading || wizardQueue !== null || mergeQueue.length > 0 || categoryAssignments !== null || conflictItems !== null) {
      void infoDialog(t('rentman.import.busyTitle', 'Importvorgänge laufen noch'), {
        body: t('rentman.import.busyBody', 'Bitte warten Sie auf den Abschluss.'),
        tone: 'info',
      })
      return
    }
    onClose()
  }
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const addCustomTemplate = useProjectStore((state) => state.addCustomTemplate)
  const addGroupPreset = useProjectStore((state) => state.addGroupPreset)
  const addKnownCategories = useProjectStore((state) => state.addKnownCategories)
  const setCategoryTranslation = useProjectStore((state) => state.setCategoryTranslation)
  const knownCategories = useProjectStore((state) => state.knownCategories)
  const updateProjectMetadata = useProjectStore((state) => state.updateProjectMetadata)
  const linkedProjectId = useProjectStore((state) => state.project.metadata.rentmanProjectId)
  const linkedProjectName = useProjectStore((state) => state.project.metadata.rentmanProjectName)
  const [projects, setProjects] = useState<RentmanProject[]>([])
  const [projectSort, setProjectSort] = useState<'number-asc' | 'number-desc' | 'date-asc' | 'date-desc'>('number-desc')
  const [projectQuery, setProjectQuery] = useState('')
  // Entschlackung: nach Projektwahl kollabiert die Projekt-Auswahl auf eine
  // Zeile (Projekt + verknüpft + "ändern"), damit die lange Liste die UI nicht
  // mehr dominiert. "ändern" klappt sie wieder auf.
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [items, setItems] = useState<RentmanEquipment[]>([])
  // #335 — Kombinationen (Sets), die als Rack importiert werden sollen.
  const [rackSetIds, setRackSetIds] = useState<Set<string>>(new Set())
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [loading, setLoading] = useState(false)
  const [wizardQueue, setWizardQueue] = useState<UnknownCandidate[] | null>(null)
  const [wizardTemplates, setWizardTemplates] = useState<Record<string, EquipmentTemplate>>({})
  const [wizardSkipped, setWizardSkipped] = useState<Set<string>>(new Set())
  const [wizardExcluded, setWizardExcluded] = useState<Set<string>>(new Set())
  const [importResult, setImportResult] = useState<number | null>(null)
  // Issue #33: per-row "link to existing local device" mapping. Keyed by the
  // Rentman item id (RentmanEquipment.id, not equipmentId). Linked items are
  // skipped during import and instead the local device gets `rentmanId` set
  // so future re-fetches recognise it as the canonical entry.
  const [linkedExistingMap, setLinkedExistingMap] = useState<Record<string, string>>({})
  const [pendingProjectSwitch, setPendingProjectSwitch] = useState<{ id: string; name: string } | null>(null)
  // Conflict resolution: when an imported device name already exists in the
  // local custom library we ask the user whether to keep the local entry
  // (default), overwrite it with the Rentman version, or skip the import
  // entirely. Without this prompt, every Rentman import would silently
  // overwrite hand-edited templates, which is what the user complained about.
  type ConflictDecision = 'keep' | 'overwrite' | 'merge' | 'skip' | 'link'
  interface CategoryAssignment {
    name: string
    sourceCategory: string
    targetCategory: string
  }
  interface ConflictItem {
    name: string
    category: string
    rentmanId: string
    decision: ConflictDecision
    linkedToLocalName?: string
  }
  interface MergeQueueItem {
    equipmentId: string
    name: string
    localTemplate: EquipmentTemplate
    incomingTemplate: EquipmentTemplate
  }
  const [categoryAssignments, setCategoryAssignments] = useState<CategoryAssignment[] | null>(null)
  // #499 — Gelernte Quell→Ziel-Kategorie-Map (persistiert) + in-Session
  // gemerkte Zielkategorie je Geräte-Name. Beides sorgt dafür, dass man im
  // Kategorie-Mapping „zurück“ kann ohne die Auswahl zu verlieren, und dass
  // bekannte Zuordnungen beim nächsten Import automatisch vorbelegt werden.
  const rentmanCatMapRef = useRef<Record<string, string>>(loadRentmanCatMap())
  const prevTargetByNameRef = useRef<Record<string, string>>({})
  const [pendingCategoryByName, setPendingCategoryByName] = useState<Record<string, string>>({})
  const [conflictItems, setConflictItems] = useState<ConflictItem[] | null>(null)
  const [pendingDecisions, setPendingDecisions] = useState<Record<string, ConflictDecision>>({})
  const [pendingMergeTemplates, setPendingMergeTemplates] = useState<Record<string, EquipmentTemplate>>({})
  const [pendingLinks, setPendingLinks] = useState<Record<string, string>>({})
  const [mergeQueue, setMergeQueue] = useState<MergeQueueItem[]>([])
  const [mergeIndex, setMergeIndex] = useState(0)
  // Cable-plan import: detected cables grouped by `${type}|${length}`. The
  // user can review/adjust quantities before pushing them into
  // `metadata.rentmanCablePlan` (used by the canvas overage warning) and
  // `metadata.rentmanCableMap` (used by the export-to-Rentman dialog).
  const [cablePlanSelected, setCablePlanSelected] = useState<Set<string>>(new Set())
  const [cablePlanQty, setCablePlanQty] = useState<Record<string, number>>({})
  const [cablePlanResult, setCablePlanResult] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null)
  // Entschlackung: Kabelmengen-Sektion standardmäßig eingeklappt (eigener
  // Schritt), damit sie nicht unter der Geräteliste mit aufquillt.
  const [cablePlanOpen, setCablePlanOpen] = useState(false)

  const allCategories = useMemo(() => {
    const set = new Set<string>()
    items.forEach((item) => set.add(item.category || 'Uncategorized'))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [items])

  const importCategoryOptions = useMemo(
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

  const visibleItems = useMemo(() => {
    if (selectedCategories.size === 0) return items
    // Keep an item if its own category matches OR one of its ancestors' does.
    const byId = new Map(items.map((i) => [i.id, i]))
    const categoryFor = (item: RentmanEquipment): string => {
      let cur: RentmanEquipment | undefined = item
      const seen = new Set<string>()
      while (cur && !seen.has(cur.id)) {
        if (cur.category && selectedCategories.has(cur.category)) return cur.category
        seen.add(cur.id)
        cur = cur.parentId ? byId.get(cur.parentId) : undefined
      }
      return ''
    }
    return items.filter((item) => !!categoryFor(item))
  }, [items, selectedCategories])
  const sortedProjects = useMemo(() => {
    const numeric = (p: RentmanProject) => {
      const n = Number(p.number)
      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
    }
    const dateValue = (p: RentmanProject): number => {
      const iso = p.periodStart ?? p.periodEnd
      if (!iso) return Number.NEGATIVE_INFINITY
      const t = new Date(iso).getTime()
      return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY
    }
    const q = projectQuery.trim().toLowerCase()
    const filtered = q
      ? projects.filter((p) => {
          if (p.name.toLowerCase().includes(q)) return true
          if (p.number !== undefined && String(p.number).toLowerCase().includes(q)) return true
          if (p.status && p.status.toLowerCase().includes(q)) return true
          return false
        })
      : projects
    const copy = [...filtered]
    copy.sort((a, b) => {
      switch (projectSort) {
        case 'number-asc':
          return numeric(a) - numeric(b) || a.name.localeCompare(b.name)
        case 'number-desc':
          return numeric(b) - numeric(a) || a.name.localeCompare(b.name)
        case 'date-asc':
          return dateValue(a) - dateValue(b) || a.name.localeCompare(b.name)
        case 'date-desc':
          return dateValue(b) - dateValue(a) || a.name.localeCompare(b.name)
      }
    })
    return copy
  }, [projects, projectSort, projectQuery])
  const checkedCount = useMemo(
    () => visibleItems.filter((item) => item.checked).length,
    [visibleItems],
  )
  const setChildCount = useMemo(() => items.filter((item) => item.isSetChild).length, [items])

  /**
   * Detected cable rows derived from the currently loaded project equipment.
   * Always uses the *project* item quantity as the suggested plan quantity.
   */
  const detectedCableRows = useMemo(() => detectCableRows(items), [items])

  /**
   * Cable rows aggregated by `${type}|${length}`. Multiple Rentman line items
   * with the same connector type and length are merged into one bucket so the
   * canvas overage warning compares against the total available count.
   */
  const cableBuckets = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string
        type: CableType
        length: number
        totalQty: number
        rows: DetectedCableRow[]
      }
    >()
    for (const row of detectedCableRows) {
      const key = `${row.type}|${row.length}`
      const entry = map.get(key)
      if (entry) {
        entry.totalQty += row.qty
        entry.rows.push(row)
      } else {
        map.set(key, {
          key,
          type: row.type,
          length: row.length,
          totalQty: row.qty,
          rows: [row],
        })
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.type === b.type ? a.length - b.length : a.type.localeCompare(b.type),
    )
  }, [detectedCableRows])

  // v7.9.128 — Auto-Load wenn der Dialog mit einem bereits verknuepften
  // Rentman-Projekt geoeffnet wird. Bisher musste der User "Projekte
  // laden" klicken, das Projekt finden und auswaehlen — viel Klick-Arbeit
  // fuer einen simplen Re-Sync. Jetzt: Dialog auf -> Projekte werden
  // automatisch geladen, das verknuepfte Projekt vorausgewaehlt, dessen
  // Equipment direkt gefetched. User sieht sofort den aktuellen Stand
  // und kann importieren / neue Geraete uebernehmen.
  useEffect(() => {
    if (!open) return
    if (loading) return
    // Projekte noch nicht geladen? -> laden, dann auto-select.
    if (projects.length === 0) {
      void (async () => {
        // fetchProjects ist unten deklariert; der Effect-Callback läuft erst nach
        // Mount, wenn sie existiert — Compiler kann das nicht statisch sehen.
        // eslint-disable-next-line react-hooks/immutability
        await fetchProjects()
      })()
      return
    }
    // Projekte da, aber noch nichts ausgewaehlt: das verknuepfte Projekt
    // direkt auswaehlen und Equipment fetchen.
    if (!selectedProjectId) {
      const linked = projects.find((p) => p.id === linkedProjectId)
      if (linked) {
        // eslint-disable-next-line react-hooks/immutability -- s.o., fetchEquipment unten deklariert
        void fetchEquipment(linked.id, linked.name)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, linkedProjectId, projects.length, selectedProjectId])

  if (!open) {
    return null
  }

  const fetchProjects = async () => {
    setError('')
    setWarning('')
    setLoading(true)
    try {
      const projectData = await loadProjects()
      if (!projectData.length) {
        setError(t('rentman.import.error.noProjects', 'Keine Projekte für dieses Token/Konto gefunden.'))
      }
      setProjects(mapProjects(projectData))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rentman.import.error.loadProjectsFailed', 'Laden der Rentman-Projekte fehlgeschlagen'))
    } finally {
      setLoading(false)
    }
  }

  const fetchEquipment = async (projectId: string, projectName?: string) => {
    // If a different Rentman project is already linked and there are rentman items on canvas,
    // ask for confirmation before switching.
    const hasLinkedItems = projectEquipment.some((e) => e.rentmanId)
    if (
      linkedProjectId &&
      linkedProjectId !== projectId &&
      hasLinkedItems &&
      !pendingProjectSwitch
    ) {
      const name = projectName ?? projects.find((p) => p.id === projectId)?.name ?? projectId
      setPendingProjectSwitch({ id: projectId, name })
      return
    }
    setSelectedProjectId(projectId)
    setError('')
    setWarning('')
    setLoading(true)
    try {
      const [equipmentData, folderData, equipmentMasterData] = await Promise.all([
        loadProjectEquipment(projectId),
        loadFolders(),
        loadEquipment(),
      ])
      const folders = (folderData as Record<string, unknown>[]).reduce<Record<string, string>>((acc, folder) => {
        const key = String(folder.id ?? folder._id ?? '')
        if (!key) {
          return acc
        }
        acc[key] = String(folder.name ?? folder.displayname ?? folder.id)
        return acc
      }, {})

      const equipmentNamesById = (equipmentMasterData as Record<string, unknown>[]).reduce<Record<string, string>>(
        (acc, equipment) => {
          const key = String(equipment.id ?? equipment._id ?? '')
          if (!key) {
            return acc
          }
          acc[key] = String(equipment.name ?? equipment.displayname ?? key)
          return acc
        },
        {},
      )

      const masterMetaById = (equipmentMasterData as Record<string, unknown>[]).reduce<
        Record<string, { physical: boolean }>
      >((acc, equipment) => {
        const key = String(equipment.id ?? equipment._id ?? '')
        if (key) acc[key] = { physical: isRentmanPhysicalFlag(equipment) }
        return acc
      }, {})

      const mapped = mapEquipment(equipmentData, folders, equipmentNamesById, masterMetaById)
      setItems(mapped)

      // Compare against canvas equipment: flag items no longer in the project.
      const fetchedEquipmentIds = new Set(mapped.map((i) => i.equipmentId).filter(Boolean))
      for (const item of projectEquipment) {
        if (!item.rentmanId) continue
        const stillPresent = fetchedEquipmentIds.has(item.rentmanId)
        updateEquipment(item.id, { rentmanRemoved: !stillPresent })
      }

      // Publish Rentman folder names as known categories for dropdowns everywhere.
      const folderNames = Object.values(folders).filter(Boolean)
      if (folderNames.length) addKnownCategories(folderNames)

      // Some Rentman API keys lack permission to read /equipmentfolders.
      // That's fine — mapEquipment falls back to names embedded in the
      // equipment records, so the import still works. We just log it to
      // avoid confusing the user with a scary "No access" warning while
      // everything actually loaded successfully.
      if (!folderData.length) {
        console.info(
          '[rentman] /equipmentfolders returned no data (token lacks permission or no folders); using fallback category names.',
        )
      }
      if (!mapped.length) {
        setError(t('rentman.import.error.noEquipment', 'Kein Equipment in diesem Projekt gefunden.'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rentman.import.error.loadEquipmentFailed', 'Laden des Projekt-Equipments fehlgeschlagen'))
    } finally {
      setLoading(false)
    }
  }

  const toggleItem = (id: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)))
  }

  const setQty = (id: string, qty: number) => {
    const clean = Math.max(1, Math.min(999, Math.round(qty) || 1))
    setItems((current) => current.map((item) => (item.id === id ? { ...item, qty: clean } : item)))
  }

  const toggleCategory = (cat: string) => {
    setSelectedCategories((current) => {
      const next = new Set(current)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const setAllVisible = (checked: boolean) => {
    const visibleIds = new Set(visibleItems.map((i) => i.id))
    setItems((current) =>
      current.map((item) =>
        visibleIds.has(item.id) && item.kind !== 'comment' ? { ...item, checked } : item,
      ),
    )
  }



  // Stufe 3 — "Nur Hauptgerät": meist ist in einer Kombination nur EIN Teil
  // signal-relevant (Kamera/Switcher), Zubehör (Kabel/Akku/Stativ/Case) ist
  // auf dem Canvas Rauschen. Setzt die Auswahl so, dass nur das Hauptgerät
  // importiert wird (Parent + restliche Kinder abgewählt; nutzt die bestehende
  // checked-Import-Pipeline, keine neue Logik). Heuristik: erstes Kind, das
  // kein Zubehör ist; sonst das erste.
  const setMainDeviceOnly = (parentId: string) => {
    const children = items.filter((i) => i.parentId === parentId)
    if (children.length === 0) return
    const accessory = /kabel|cable|case|flightcase|stativ|tripod|akku|battery|netzteil|psu|tasche|bag|zubeh|adapter|clamp|halter|strap|riemen/i
    const main =
      children.find((c) => !accessory.test(c.name) && !accessory.test(c.category)) ?? children[0]
    setItems((cur) =>
      cur.map((it) => {
        if (it.id === parentId) return { ...it, checked: false }
        if (it.parentId === parentId) return { ...it, checked: it.id === main.id }
        return it
      }),
    )
    setRackSetIds((prev) => {
      if (!prev.has(parentId)) return prev
      const n = new Set(prev)
      n.delete(parentId)
      return n
    })
  }

  const toggleCableBucket = (key: string) => {
    setCablePlanSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const setCableBucketQty = (key: string, qty: number) => {
    const clean = Math.max(0, Math.min(9999, Math.round(qty) || 0))
    setCablePlanQty((current) => ({ ...current, [key]: clean }))
  }

  /**
   * Persist the selected cable buckets into project metadata. Writes both the
   * planned quantity (`rentmanCablePlan`) and the Rentman master-equipment id
   * mapping (`rentmanCableMap`) so the cable-export dialog can later push
   * deltas back to Rentman without asking the user to re-pick equipment.
   *
   * Also ensures the project link itself is saved — the user is allowed to
   * use this dialog purely for linking + cable plan, without importing any
   * equipment.
   */
  const handleImportCablePlan = () => {
    if (cableBuckets.length === 0) return
    const selectedRows = cableBuckets.filter((bucket) => cablePlanSelected.has(bucket.key))
    if (selectedRows.length === 0) {
      setCablePlanResult({ kind: 'warn', text: t('rentman.import.cablePlan.pickAtLeastOne', 'Bitte mindestens einen Kabeltyp auswählen.') })
      return
    }
    const project = useProjectStore.getState().project
    const planPatch: Record<string, number> = { ...(project.metadata.rentmanCablePlan ?? {}) }
    const mapPatch = { ...(project.metadata.rentmanCableMap ?? {}) }
    for (const bucket of selectedRows) {
      const qty = cablePlanQty[bucket.key] ?? bucket.totalQty
      planPatch[bucket.key] = qty
      // Map to the Rentman master-equipment id of the first row in this
      // bucket. If the user has multiple Rentman line items for the same
      // bucket they'll all be aggregated under one mapping; the export dialog
      // lets them re-pick if needed.
      const firstRow = bucket.rows[0]
      const existingMap = mapPatch[bucket.key]
      mapPatch[bucket.key] = {
        rentmanEquipmentId:
          existingMap?.rentmanEquipmentId ?? firstRow.rentmanEquipmentId,
        lastSyncedQty: existingMap?.lastSyncedQty ?? qty,
      }
    }
    const projectName =
      projects.find((p) => p.id === selectedProjectId)?.name ??
      project.metadata.rentmanProjectName
    updateProjectMetadata({
      rentmanProjectId: selectedProjectId,
      rentmanProjectName: projectName,
      rentmanCablePlan: planPatch,
      rentmanCableMap: mapPatch,
    })
    setCablePlanResult({
      kind: 'ok',
      text: format(t('rentman.import.cablePlan.planSaved', '{count} Kabeltyp(en) als Plan übernommen.'), { count: selectedRows.length }),
    })
  }

  const buildImportedBaseTemplate = (
    item: RentmanEquipment,
    templatesByEquipmentId: Record<string, EquipmentTemplate>,
    categoryByName: Record<string, string>,
  ): EquipmentTemplate => {
    const existingByName = customLibrary.find((t) => t.name === item.name)
    const cachedByRentmanId = item.equipmentId ? getCachedRentmanTemplate(item.equipmentId) : undefined
    const assignedCategory = categoryByName[item.name] || item.category || 'Sonstiges'
    const base =
      templatesByEquipmentId[item.equipmentId] ||
      cachedByRentmanId ||
      existingByName ||
      matchBlackmagicTemplate(item.name) ||
      matchUbiquitiTemplate(item.name) ||
      matchMonitorTemplate(item.name) ||
      matchCameraTemplate(item.name) ||
      matchMiscTemplate(item.name) ||
      matchGreenGoTemplate(item.name) ||
      matchAjaTemplate(item.name) ||
      matchRossTemplate(item.name) ||
      matchLynxTemplate(item.name) ||
      matchSwitcherTemplate(item.name) ||
      matchAvNetworkTemplate(item.name) ||
      matchBroadcastToolsTemplate(item.name) ||
      matchAudioTemplate(item.name) ||
      matchWirelessAudioTemplate(item.name) ||
      matchMicTemplate(item.name) || {
        // Kein Katalog-Match → KEINE erfundenen Ports ("Input 1"/"Output 1"
        // waren erfundene Belegung). Explizit als unbekannt fuehren; die
        // PortsSection bietet dafuer den Port-Vorschlag-Flow an und der
        // Plan-Check fordert die Datenblatt-Ergaenzung ein.
        name: item.name,
        category: assignedCategory,
        inputs: [],
        outputs: [],
        portsUnknown: true,
        width: 220,
        height: 140,
      }
    return {
      ...base,
      name: base.name || item.name,
      category: assignedCategory,
      // v7.9.70 / #167 — Engineering-Daten aus Rentman übernehmen (falls
      // vorhanden und das Base-Template noch keinen Wert hat — local edits
      // gewinnen). Power/Weight für die Properties-Anzeige, Tiefe für den
      // späteren 3D-Rack-Builder.
      powerWatts: base.powerWatts ?? item.powerWatts,
      weightKg: base.weightKg ?? item.weightKg,
      depthMm: base.depthMm ?? item.depthMm,
      // #420 — Mietpreis aus Rentman uebernehmen (lokale Edits gewinnen).
      rentPricePerDay: base.rentPricePerDay ?? item.rentPricePerDay,
      rentCurrency: base.rentCurrency ?? item.rentCurrency,
    }
  }

  const saveToLibrary = (
    selected: RentmanEquipment[],
    templatesByEquipmentId: Record<string, EquipmentTemplate>,
    decisionsByName: Record<string, ConflictDecision> = {},
    categoryByName: Record<string, string> = {},
    linksByName: Record<string, string> = {},
  ): number => {
    // One library template per unique device name — quantity is irrelevant for the template.
    const seen = new Set<string>()
    let addedCount = 0

    // #335 — Sets, die als Rack markiert sind, werden zu einem GroupPreset
    // (Rack) statt zu einzelnen Templates. Das Rack trägt die Kombi-ID, die
    // Inhalte behalten ihre eigenen Rentman-IDs. Konsumierte Rows (Parent +
    // Children) werden unten in der Template-Schleife übersprungen.
    const rackConsumedIds = new Set<string>()
    if (rackSetIds.size > 0) {
      for (const parent of selected) {
        if (!rackSetIds.has(parent.id)) continue
        const children = selected.filter((c) => c.parentId === parent.id)
        if (children.length === 0) continue
        const rackChildren = children.map((child) => ({
          template: buildImportedBaseTemplate(child, templatesByEquipmentId, categoryByName),
          rentmanId: child.equipmentId,
        }))
        addGroupPreset(buildRackPresetFromCombination(parent.name, parent.equipmentId, rackChildren))
        rackConsumedIds.add(parent.id)
        for (const c of children) rackConsumedIds.add(c.id)
        addedCount++
      }
    }

    selected.forEach((item) => {
      // #335 — Rows, die schon in einem Rack-GroupPreset gelandet sind, nicht
      // zusätzlich als Einzel-Template importieren.
      if (rackConsumedIds.has(item.id)) return
      if (seen.has(item.name)) return
      seen.add(item.name)

      const decision = decisionsByName[item.name]
      // Match strategy: prefer rentmanId (re-import of the *same* Rentman
      // master equipment) over name (might be a manually-renamed local
      // template). This makes re-imports idempotent — they refresh metadata
      // on the existing template instead of creating duplicates.
      const byRentmanId = item.equipmentId
        ? customLibrary.find((t) => t.rentmanId === item.equipmentId)
        : undefined
      const existing = byRentmanId ?? customLibrary.find((t) => t.name === item.name)
      const assignedCategory = categoryByName[item.name] || item.category || existing?.category || 'Sonstiges'

      // Skip: user chose not to import this device at all.
      if (decision === 'skip') return

      // Link to local: user chose to link this imported device to a different local device
      if (decision === 'link' && linksByName[item.name]) {
        const linkedLocalName = linksByName[item.name]
        const linkedTemplate = customLibrary.find((t) => t.name === linkedLocalName)
        if (linkedTemplate) {
          const projectName = projects.find((p) => p.id === selectedProjectId)?.name
          addCustomTemplate({
            ...linkedTemplate,
            category: assignedCategory,
            rentmanId: item.equipmentId,
            rentmanSource: selectedProjectId,
            rentmanProjectName: projectName,
          })
          addedCount++
        }
        return
      }

      // Silent re-import: same rentmanId already in library. Refresh
      // project link metadata, keep ports/dimensions intact.
      if (byRentmanId && !decision) {
        const projectName = projects.find((p) => p.id === selectedProjectId)?.name
        const needsRefresh =
          byRentmanId.rentmanSource !== selectedProjectId ||
          byRentmanId.rentmanProjectName !== projectName ||
          byRentmanId.category !== assignedCategory
        if (needsRefresh) {
          addCustomTemplate({
            ...byRentmanId,
            category: assignedCategory,
            rentmanId: item.equipmentId,
            rentmanSource: selectedProjectId,
            rentmanProjectName: projectName,
          })
        }
        addedCount++
        return
      }

      // Keep local: don't replace the user's template, just attach the
      // Rentman id/source if they're missing so future imports recognize it.
      if (decision === 'keep' && existing) {
        const needsLink =
          !existing.rentmanId || existing.rentmanSource !== selectedProjectId || existing.category !== assignedCategory
        if (needsLink) {
          addCustomTemplate({
            ...existing,
            category: assignedCategory,
            rentmanId: existing.rentmanId || item.equipmentId,
            rentmanSource: selectedProjectId,
            rentmanProjectName: projects.find((p) => p.id === selectedProjectId)?.name,
          })
        }
        addedCount++
        return
      }

      if (decision === 'merge' && templatesByEquipmentId[item.equipmentId]) {
        const merged = templatesByEquipmentId[item.equipmentId]
        addCustomTemplate({
          ...merged,
          category: assignedCategory,
          rentmanId: item.equipmentId,
          rentmanSource: selectedProjectId,
          rentmanProjectName: projects.find((p) => p.id === selectedProjectId)?.name,
        })
        addedCount++
        return
      }

      // Default / overwrite path — either no conflict, or user explicitly
      // chose to replace the local template with the Rentman version.
      const base = buildImportedBaseTemplate(item, templatesByEquipmentId, categoryByName)
      addCustomTemplate({
        ...base,
        name: base.name || item.name,
        category: assignedCategory,
        rentmanId: item.equipmentId,
        rentmanSource: selectedProjectId,
        rentmanProjectName: projects.find((p) => p.id === selectedProjectId)?.name,
      })
      addedCount++
    })
    // Link this Rentman project to the cable planner project.
    const linkedProject = projects.find((p) => p.id === selectedProjectId)
    updateProjectMetadata({
      rentmanProjectId: selectedProjectId,
      rentmanProjectName: linkedProject?.name,
    })
    return addedCount
  }

  const handleImport = () => {
    const selected = visibleItems.filter((item) => item.checked)
    if (selected.length === 0) return

    // #499 — Kein Hard-Stop mehr bei 0 Kategorien: im Mapping-Schritt kann
    // der User jetzt direkt neue Kategorien anlegen, statt erst woanders.

    // Issue #33: apply linked-existing mappings *before* the normal import
    // pipeline. For each linked Rentman item, stamp its rentmanId onto the
    // existing local equipment so future re-fetches treat them as the same
    // device, then drop it from the to-be-imported list.
    const linkEntries = Object.entries(linkedExistingMap)
    if (linkEntries.length > 0) {
      const visibleSelectedById = new Map(selected.map((s) => [s.id, s]))
      for (const [rentmanItemId, localEqId] of linkEntries) {
        const rItem = visibleSelectedById.get(rentmanItemId)
        if (!rItem) continue
        updateEquipment(localEqId, {
          rentmanId: rItem.equipmentId,
          rentmanRemoved: false,
        })
      }
    }

    const uniqueByName = new Map<string, RentmanEquipment>()
    for (const item of selected) {
      if (!uniqueByName.has(item.name)) uniqueByName.set(item.name, item)
    }
    const assignments = Array.from(uniqueByName.values()).map((item) => ({
      name: item.name,
      sourceCategory: item.category,
      targetCategory: resolveInitialTarget(item),
    }))
    setCategoryAssignments(assignments)
  }

  /**
   * #499 — Zielkategorie für eine Zeile vorbelegen. Reihenfolge:
   *   1. in dieser Session schon getroffene Wahl (Name) — „zurück“ ohne Verlust
   *   2. gelernte Quell→Ziel-Map (persistiert, „Zwischenspeichern“)
   *   3. exakte Übereinstimmung Quell-Kategorie ↔ lokale Kategorie
   *   4. automatische (Fuzzy-)Erkennung
   */
  const resolveInitialTarget = (item: RentmanEquipment): string => {
    const byName = prevTargetByNameRef.current[item.name]
    if (byName && importCategoryOptions.includes(byName)) return byName
    const remembered = rentmanCatMapRef.current[item.category]
    if (remembered && importCategoryOptions.includes(remembered)) return remembered
    if (importCategoryOptions.includes(item.category)) return item.category
    return autoDetectCategory(item.category, importCategoryOptions)
  }

  /**
   * #499 — Aktuelle Zuordnung „zwischenspeichern“: je Name (Session) und je
   * Quell-Kategorie (persistiert). Wird beim „Zurück“ wie beim „Weiter“
   * aufgerufen, damit nichts verloren geht.
   */
  const persistAssignments = (assignments: CategoryAssignment[]): void => {
    const byName = { ...prevTargetByNameRef.current }
    const remembered = { ...rentmanCatMapRef.current }
    for (const row of assignments) {
      const target = row.targetCategory.trim()
      if (!target) continue
      byName[row.name] = target
      if (row.sourceCategory) remembered[row.sourceCategory] = target
    }
    prevTargetByNameRef.current = byName
    rentmanCatMapRef.current = remembered
    saveRentmanCatMap(remembered)
  }

  /**
   * #499 — Im Mapping-Schritt eine neue lokale Kategorie anlegen und der Zeile
   * (sowie noch leeren Zeilen gleicher Quell-Kategorie) zuweisen.
   */
  const handleCreateCategory = async (rowIndex: number): Promise<void> => {
    const sourceCat = categoryAssignments?.[rowIndex]?.sourceCategory ?? ''
    const result = await bilingualCategoryDialog(
      t('rentman.import.catMap.newCategory', 'Neue Kategorie anlegen'),
    )
    if (!result || !result.canonical) return
    addKnownCategories([result.canonical])
    if (result.de || result.en) {
      setCategoryTranslation(result.canonical, { de: result.de, en: result.en })
    }
    setCategoryAssignments((prev) =>
      prev
        ? prev.map((it, i) => {
            if (i === rowIndex) return { ...it, targetCategory: result.canonical }
            // Komfort: leere Zeilen derselben Quell-Kategorie gleich mit-belegen.
            if (sourceCat && it.sourceCategory === sourceCat && !it.targetCategory.trim()) {
              return { ...it, targetCategory: result.canonical }
            }
            return it
          })
        : prev,
    )
  }

  const startConflictResolution = (categoryByName: Record<string, string>) => {
    const selected = visibleItems.filter((item) => item.checked)
    if (selected.length === 0) return
    setPendingCategoryByName(categoryByName)

    // Step 1 — detect conflicts with the local custom library.
    // Re-imports (same Rentman master-equipment id is already in the local
    // library) are matched by `rentmanId` and silently merged: metadata like
    // `rentmanProjectName` and `rentmanSource` is refreshed but the user's
    // hand-edited port layout is preserved. Only items whose *name* collides
    // with an unrelated local template (no rentmanId match) trigger the
    // keep/overwrite/skip prompt.
    const seenNames = new Set<string>()
    const conflicts: ConflictItem[] = []
    selected.forEach((item) => {
      if (seenNames.has(item.name)) return
      seenNames.add(item.name)
      const byRentmanId = item.equipmentId
        ? customLibrary.find((t) => t.rentmanId === item.equipmentId)
        : undefined
      if (byRentmanId) return // re-import: not a conflict, update silently
      const existing = customLibrary.find((t) => t.name === item.name)
      if (existing) {
        conflicts.push({
          name: item.name,
          category: item.category,
          rentmanId: item.equipmentId,
          decision: 'keep',
        })
      }
    })

    if (conflicts.length > 0) {
      setConflictItems(conflicts)
      return
    }

    proceedAfterConflicts({}, categoryByName, {})
  }

  const proceedAfterConflicts = (
    decisionsByName: Record<string, ConflictDecision>,
    categoryByName: Record<string, string> = pendingCategoryByName,
    mergeTemplatesByEquipmentId: Record<string, EquipmentTemplate> = pendingMergeTemplates,
    linksByName: Record<string, string> = {},
  ) => {
    const selected = visibleItems.filter((item) => item.checked)
    if (selected.length === 0) return

    // Items the user chose to keep / skip locally don't need wizard prompts:
    // we already know what to do with them.
    const knownNames = new Set(customLibrary.map((t) => t.name))
    const unknownMap = new Map<string, UnknownCandidate>()
    selected.forEach((item) => {
      if (knownNames.has(item.name)) return
      if (decisionsByName[item.name] === 'skip') return
      if (decisionsByName[item.name] === 'link') return
      if (matchBlackmagicTemplate(item.name)) return
      if (matchUbiquitiTemplate(item.name)) return
      if (matchMonitorTemplate(item.name)) return
      if (matchCameraTemplate(item.name)) return
      if (matchMiscTemplate(item.name)) return
      if (matchGreenGoTemplate(item.name)) return
      if (matchAjaTemplate(item.name)) return
      if (matchRossTemplate(item.name)) return
      if (matchLynxTemplate(item.name)) return
      if (matchSwitcherTemplate(item.name)) return
      if (matchAvNetworkTemplate(item.name)) return
      if (matchBroadcastToolsTemplate(item.name)) return
      if (matchAudioTemplate(item.name)) return
      if (matchWirelessAudioTemplate(item.name)) return
      if (matchMicTemplate(item.name)) return
      if (unknownMap.has(item.equipmentId)) return
      unknownMap.set(item.equipmentId, {
        rentmanId: item.equipmentId,
        name: item.name,
        category: categoryByName[item.name] || item.category,
      })
    })

    if (unknownMap.size === 0) {
      const count = saveToLibrary(selected, mergeTemplatesByEquipmentId, decisionsByName, categoryByName, linksByName)
      setImportResult(count)
      setTimeout(() => { setImportResult(null); safeClose() }, 2000)
      return
    }

    // Stash decisions on the wizard state so completeImportAfterWizard can use them.
    setPendingDecisions(decisionsByName)
    setPendingCategoryByName(categoryByName)
    setPendingMergeTemplates(mergeTemplatesByEquipmentId)
    setPendingLinks(linksByName)
    setWizardQueue(Array.from(unknownMap.values()))
    setWizardTemplates({})
    setWizardSkipped(new Set())
    setWizardExcluded(new Set())
  }

  const completeImportAfterWizard = (
    templates: Record<string, EquipmentTemplate>,
    skipped: Set<string>,
    excluded: Set<string>,
  ) => {
    const selected = visibleItems.filter((item) => item.checked && !excluded.has(item.equipmentId))
    void skipped
    const count = saveToLibrary(
      selected,
      { ...templates, ...pendingMergeTemplates },
      pendingDecisions,
      pendingCategoryByName,
      pendingLinks,
    )
    setWizardQueue(null)
    setWizardTemplates({})
    setWizardSkipped(new Set())
    setWizardExcluded(new Set())
    setPendingDecisions({})
    setPendingCategoryByName({})
    setPendingMergeTemplates({})
    setPendingLinks({})
    setImportResult(count)
    setTimeout(() => { setImportResult(null); safeClose() }, 2000)
  }

  const handleWizardSave = (candidate: UnknownCandidate, template: EquipmentTemplate) => {
    const withSource: EquipmentTemplate = { ...template, rentmanSource: selectedProjectId }
    addCustomTemplate(withSource)
    const nextTemplates = { ...wizardTemplates, [candidate.rentmanId]: withSource }
    setWizardTemplates(nextTemplates)
    if (wizardQueue && candidate === wizardQueue[wizardQueue.length - 1]) {
      completeImportAfterWizard(nextTemplates, wizardSkipped, wizardExcluded)
    }
  }

  const handleWizardSkip = (candidate: UnknownCandidate) => {
    const nextSkipped = new Set(wizardSkipped)
    nextSkipped.add(candidate.rentmanId)
    setWizardSkipped(nextSkipped)
    if (wizardQueue && candidate === wizardQueue[wizardQueue.length - 1]) {
      completeImportAfterWizard(wizardTemplates, nextSkipped, wizardExcluded)
    }
  }

  const handleWizardExclude = (candidate: UnknownCandidate) => {
    const nextExcluded = new Set(wizardExcluded)
    nextExcluded.add(candidate.rentmanId)
    setWizardExcluded(nextExcluded)
    if (wizardQueue && candidate === wizardQueue[wizardQueue.length - 1]) {
      completeImportAfterWizard(wizardTemplates, wizardSkipped, nextExcluded)
    }
  }

  const handleWizardCancel = () => {
    setWizardQueue(null)
    setWizardTemplates({})
    setWizardSkipped(new Set())
    setWizardExcluded(new Set())
    setPendingMergeTemplates({})
    setPendingCategoryByName({})
    // Safe to close after cancelling wizard
    safeClose()
  }

  const activeMergeItem = mergeQueue[mergeIndex] ?? null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      {/* ── Confirmation: switch linked Rentman project ── */}
      {pendingProjectSwitch && (
        <div className="w-full max-w-md rounded border border-amber-600 bg-cp-surface-1 p-5 text-cp-text shadow-xl">
          <h3 className="mb-2 text-cp-xl font-semibold text-amber-400">{t('rentman.import.switch.title', 'Rentman-Projekt wechseln?')}</h3>
          <p className="mb-1 text-cp-base text-cp-text-secondary">
            {t('rentman.import.switch.alreadyLinkedPre', 'Dieses Projekt ist bereits mit dem Rentman-Projekt')}
            {linkedProjectName ? (
              <> <span className="font-medium text-white">„{linkedProjectName}"</span></>
            ) : (
              <> <span className="font-mono text-cp-xs text-cp-text-muted">{linkedProjectId}</span></>
            )} {t('rentman.import.switch.alreadyLinkedPost', 'verknüpft.')}
          </p>
          <p className="mb-4 text-cp-base text-cp-text-secondary">
            {t('rentman.import.switch.askLoadInsteadPre', 'Soll stattdessen')} <span className="font-medium text-white">„{pendingProjectSwitch.name}"</span> {t('rentman.import.switch.askLoadInsteadPost', 'geladen werden? Bereits importierte Geräte auf der Canvas behalten ihre Verknüpfung.')}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingProjectSwitch(null)}
              className="rounded bg-cp-surface-4 px-3 py-1.5 text-cp-base hover:bg-cp-surface-5"
            >
              {t('common.cancel', 'Abbrechen')}
            </button>
            <button
              type="button"
              onClick={() => {
                const { id, name } = pendingProjectSwitch
                setPendingProjectSwitch(null)
                void fetchEquipment(id, name)
              }}
              className="rounded bg-amber-600 px-3 py-1.5 text-cp-base font-medium hover:bg-amber-500"
            >
              {t('rentman.import.switch.confirm', 'Ja, Projekt wechseln')}
            </button>
          </div>
        </div>
      )}

      {!pendingProjectSwitch && conflictItems && (
        <div className="w-full max-w-2xl rounded border border-amber-600 bg-cp-surface-1 p-5 text-cp-text shadow-xl">
          <h3 className="mb-2 text-cp-xl font-semibold text-amber-400">
            {conflictItems.length === 1
              ? t('rentman.import.conflict.titleOne', 'Gerät bereits in lokaler Bibliothek')
              : format(t('rentman.import.conflict.titleMany', '{count} Geräte bereits in lokaler Bibliothek'), { count: conflictItems.length })}
          </h3>
          <p className="mb-3 text-cp-base text-cp-text-secondary">
            {t('rentman.import.conflict.intro', 'Folgende aus Rentman ausgewählte Geräte gibt es schon in deiner lokalen Bibliothek. Standardmäßig wird die lokale Definition beibehalten – damit gehen deine eigenen Port-Konfigurationen nicht verloren. Du kannst pro Gerät entscheiden:')}
          </p>
          <div className="mb-3 max-h-[55vh] overflow-auto rounded border border-cp-border-muted">
            <table className="w-full text-cp-xs">
              <thead className="sticky top-0 bg-cp-surface-3 text-left text-[11px] uppercase tracking-wide text-cp-text-muted">
                <tr>
                  <th className="px-2 py-1">{t('rentman.import.col.device', 'Gerät')}</th>
                  <th className="px-2 py-1">{t('rentman.import.col.action', 'Aktion')}</th>
                </tr>
              </thead>
              <tbody>
                {conflictItems.map((c, idx) => (
                  <tr key={c.name} className="border-t border-cp-border-muted align-top">
                    <td className="px-2 py-1.5">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-[11px] text-cp-text-muted">{c.category}</div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-col gap-0.5">
                        {(
                          [
                            ['keep', t('rentman.import.action.keep', 'Lokale Version beibehalten (empfohlen)')],
                            ['link', t('rentman.import.action.link', 'Mit anderem lokalem Gerät verknüpfen')],
                            ['overwrite', t('rentman.import.action.overwrite', 'Mit Rentman-Version überschreiben')],
                            ['merge', t('rentman.import.action.merge', 'Ports mergen')],
                            ['skip', t('rentman.import.action.skip', 'Überspringen (nicht importieren)')],
                          ] as const
                        ).map(([value, label]) => (
                          <div key={value}>
                            <label className="flex items-center gap-1.5">
                              <input
                                type="radio"
                                name={`conflict-${idx}`}
                                checked={c.decision === value}
                                onChange={() => {
                                  setConflictItems((prev) =>
                                    prev
                                      ? prev.map((item, i) =>
                                          i === idx ? { ...item, decision: value } : item,
                                        )
                                      : prev,
                                  )
                                  setPendingLinks((prev) => {
                                    const next = { ...prev }
                                    if (value !== 'link') delete next[c.name]
                                    return next
                                  })
                                }}
                              />
                              <span>{label}</span>
                            </label>
                            {value === 'link' && c.decision === 'link' && (
                              <div className="ml-6 mt-1">
                                <select
                                  value={pendingLinks[c.name] || ''}
                                  onChange={(e) => {
                                    setPendingLinks((prev) => ({
                                      ...prev,
                                      [c.name]: e.target.value,
                                    }))
                                  }}
                                  className="rounded bg-cp-surface-2 px-2 py-1 text-cp-xs text-cp-text"
                                >
                                  <option value="">{t('rentman.import.link.placeholder', '-- Gerät wählen --')}</option>
                                  {customLibrary
                                    .filter((tpl) => tpl.name !== c.name)
                                    .map((tpl) => (
                                      <option key={tpl.name} value={tpl.name}>
                                        {tpl.name} ({tpl.category || 'Sonstiges'})
                                      </option>
                                    ))}
                                </select>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mb-3 flex items-center gap-2 text-[11px] text-cp-text-muted">
            <span>{t('rentman.import.setAll', 'Alle setzen:')}</span>
            {(
              [
                ['keep', t('rentman.import.bulk.keep', 'Lokal beibehalten')],
                ['overwrite', t('rentman.import.bulk.overwrite', 'Rentman übernehmen')],
                ['skip', t('rentman.import.bulk.skip', 'Überspringen')],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setConflictItems((prev) =>
                    prev ? prev.map((item) => ({ ...item, decision: value })) : prev,
                  )
                }
                className="rounded bg-cp-surface-4 px-2 py-0.5 hover:bg-cp-surface-5"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConflictItems(null)}
              className="rounded bg-cp-surface-4 px-3 py-1.5 text-cp-base hover:bg-cp-surface-5"
            >
              {t('common.cancel', 'Abbrechen')}
            </button>
            <button
              type="button"
              onClick={() => {
                const decisions: Record<string, ConflictDecision> = {}
                conflictItems.forEach((c) => {
                  decisions[c.name] = c.decision
                })
                setConflictItems(null)

                const selectedByName = new Map(
                  visibleItems
                    .filter((item) => item.checked)
                    .map((item) => [item.name, item] as const),
                )
                const mergeItems = conflictItems
                  .filter((entry) => entry.decision === 'merge')
                  .map((entry) => {
                    const selected = selectedByName.get(entry.name)
                    const localTemplate =
                      customLibrary.find((template) => template.name === entry.name) ?? null
                    if (!selected || !localTemplate) return null
                    const incomingTemplate = buildImportedBaseTemplate(
                      selected,
                      {},
                      pendingCategoryByName,
                    )
                    return {
                      equipmentId: selected.equipmentId,
                      name: entry.name,
                      localTemplate,
                      incomingTemplate,
                    }
                  })
                  .filter((item): item is MergeQueueItem => item !== null)

                if (mergeItems.length > 0) {
                  setPendingDecisions(decisions)
                  setPendingMergeTemplates({})
                  setMergeQueue(mergeItems)
                  setMergeIndex(0)
                  return
                }

                proceedAfterConflicts(decisions, pendingCategoryByName, {}, pendingLinks)
                setPendingLinks({})
              }}
              className="rounded bg-emerald-600 px-3 py-1.5 text-cp-base font-medium hover:bg-emerald-500"
            >
              {t('rentman.import.next', 'Weiter')}
            </button>
          </div>
        </div>
      )}

      {!pendingProjectSwitch && !conflictItems && categoryAssignments && (
        <div className="w-full max-w-2xl rounded border border-cyan-700 bg-cp-surface-1 p-5 text-cp-text shadow-xl">
          <h3 className="mb-2 text-cp-xl font-semibold text-cyan-300">{t('rentman.import.catMap.title', 'Kategorie-Zuordnung vor Import')}</h3>
          <p className="mb-3 text-cp-base text-cp-text-secondary">
            {t(
              'rentman.import.catMap.intro',
              'Jedes Gerät einer lokalen Kategorie zuordnen. Passende werden automatisch erkannt und gemerkt — fehlende kannst du mit „+ Neu“ direkt anlegen. „Zurück“ behält deine Auswahl.',
            )}
          </p>
          <div className="mb-3 max-h-[55vh] overflow-auto rounded border border-cp-border-muted">
            <table className="w-full text-cp-xs">
              <thead className="sticky top-0 bg-cp-surface-3 text-left text-[11px] uppercase tracking-wide text-cp-text-muted">
                <tr>
                  <th className="px-2 py-1">{t('rentman.import.col.device', 'Gerät')}</th>
                  <th className="px-2 py-1">{t('rentman.import.col.rentman', 'Rentman')}</th>
                  <th className="px-2 py-1">{t('rentman.import.col.targetCategory', 'Zielkategorie')}</th>
                </tr>
              </thead>
              <tbody>
                {categoryAssignments.map((row, index) => (
                  <tr key={`${row.name}-${index}`} className="border-t border-cp-border-muted">
                    <td className="px-2 py-1.5 font-medium text-cp-text">{row.name}</td>
                    <td className="px-2 py-1.5 text-cp-text-faint">{row.sourceCategory}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={row.targetCategory}
                          onChange={(event) =>
                            setCategoryAssignments((prev) =>
                              prev
                                ? prev.map((item, i) =>
                                    i === index ? { ...item, targetCategory: event.target.value } : item,
                                  )
                                : prev,
                            )
                          }
                          className="w-full rounded border border-cp-border bg-cp-surface-3 px-2 py-1"
                        >
                          <option value="">{t('rentman.import.catMap.pickPlaceholder', 'Bitte auswählen...')}</option>
                          {importCategoryOptions.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleCreateCategory(index)}
                          title={t('rentman.import.catMap.newCategory', 'Neue Kategorie anlegen')}
                          className="shrink-0 rounded border border-emerald-700 bg-emerald-800/40 px-2 py-1 text-cp-xs font-medium text-emerald-200 hover:bg-emerald-700/50"
                        >
                          {t('rentman.import.catMap.newCategoryShort', '+ Neu')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                // #499 — „Zurück“ speichert die bisherige Auswahl zwischen
                // (Session + persistiert), damit beim erneuten Öffnen nichts
                // verloren geht.
                persistAssignments(categoryAssignments)
                setCategoryAssignments(null)
              }}
              className="rounded bg-cp-surface-4 px-3 py-1.5 text-cp-base hover:bg-cp-surface-5"
            >
              {t('rentman.import.catMap.back', 'Zurück')}
            </button>
            <button
              type="button"
              onClick={() => {
                const hasMissing = categoryAssignments.some((row) => !row.targetCategory.trim())
                if (hasMissing) {
                  void infoDialog(t('rentman.import.catMap.missingTitle', 'Kategorie fehlt'), {
                    body: t('rentman.import.catMap.missingBody', 'Bitte für jedes Gerät eine Kategorie wählen oder mit „+ Neu“ anlegen.'),
                    tone: 'warning',
                  })
                  return
                }
                // #499 — Zuordnung merken, bevor es weitergeht.
                persistAssignments(categoryAssignments)
                const categoryByName: Record<string, string> = {}
                for (const row of categoryAssignments) {
                  categoryByName[row.name] = row.targetCategory
                }
                setCategoryAssignments(null)
                startConflictResolution(categoryByName)
              }}
              className="rounded bg-cyan-700 px-3 py-1.5 text-cp-base font-medium hover:bg-cyan-600"
            >
              {t('rentman.import.next', 'Weiter')}
            </button>
          </div>
        </div>
      )}

      {!pendingProjectSwitch && !conflictItems && !categoryAssignments && (
        <>
      <div className="w-full max-w-3xl rounded border border-cp-border bg-cp-surface-1 p-4 text-cp-text">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-cp-xl font-semibold">
            {t('rentman.import.title', 'Aus Rentman importieren')}
          </h3>
          <button type="button" onClick={onClose} className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5">
            {t('common.close', 'Schließen')}
          </button>
        </div>

        {selectedProjectId && items.length > 0 && !pickerOpen && (() => {
          const sel = projects.find((p) => p.id === selectedProjectId)
          const label = sel
            ? [
                sel.number !== undefined && sel.number !== '' ? `#${sel.number}` : '',
                sel.name,
                sel.status ? `(${sel.status})` : '',
              ].filter(Boolean).join(' · ')
            : selectedProjectId
          return (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-cp-border-muted bg-cp-surface-3/40 px-2 py-1.5 text-cp-xs">
              <span className="text-cp-text-muted">{t('rentman.import.projectLabel', 'Projekt:')}</span>
              <span className="font-medium text-cp-text">{label}</span>
              {selectedProjectId === linkedProjectId && (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                  <Icon icon={Check} size="xs" /> {t('rentman.import.linkedShort', 'verknüpft')}
                </span>
              )}
              <span className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void fetchEquipment(selectedProjectId)}
                  disabled={loading}
                  className="rounded px-2 py-0.5 text-cp-text-secondary hover:bg-cp-surface-2 disabled:opacity-50"
                >
                  {loading ? t('rentman.import.loadingShort', 'Lädt…') : t('rentman.import.reloadSync', '↻ Neu laden & Abgleichen')}
                </button>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="rounded px-2 py-0.5 font-medium text-sky-300 hover:bg-cp-surface-2"
                >
                  {t('rentman.import.changeProject', 'ändern')}
                </button>
              </span>
            </div>
          )
        })()}
        {(!selectedProjectId || items.length === 0 || pickerOpen) && (
        <div className="mb-3 space-y-2 rounded border border-cp-border-muted bg-cp-surface-3/40 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchProjects}
              className="rounded bg-sky-600 px-3 py-1 text-cp-base font-medium hover:bg-sky-500"
            >
              {t('rentman.import.loadProjects', 'Projekte laden')}
            </button>
            {linkedProjectId && (
              <button
                type="button"
                onClick={() => fetchEquipment(linkedProjectId)}
                disabled={loading}
                className="rounded bg-emerald-700 px-3 py-1 text-cp-base font-medium hover:bg-emerald-600 disabled:opacity-50"
                title={format(t('rentman.import.refreshTitle', 'Stückzahlen und Geräte für "{name}" neu laden'), { name: linkedProjectName ?? linkedProjectId })}
              >
                {t('rentman.import.refresh', '↺ Rentman aktualisieren')}
              </button>
            )}
            <span className="text-cp-xs text-cp-text-faint">
              {projects.length > 0
                ? format(t('rentman.import.projectsCount', '{visible} / {total} Projekte'), { visible: sortedProjects.length, total: projects.length })
                : t('rentman.import.noneLoaded', 'Noch keine Projekte geladen')}
            </span>
            <div className="ml-auto flex items-center gap-1 text-cp-xs">
              <span className="text-cp-text-muted">{t('rentman.import.sort', 'Sortierung:')}</span>
              {(
                [
                  ['number-desc', '# ↓'],
                  ['number-asc', '# ↑'],
                  ['date-desc', t('rentman.import.sortDateDesc', 'Datum ↓')],
                  ['date-asc', t('rentman.import.sortDateAsc', 'Datum ↑')],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setProjectSort(value)}
                  className={`rounded px-2 py-0.5 ${
                    projectSort === value
                      ? 'bg-sky-600 text-white'
                      : 'bg-cp-surface-4 hover:bg-cp-surface-5'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={projectQuery}
              onChange={(e) => setProjectQuery(e.target.value)}
              placeholder={t('rentman.import.searchPlaceholder', 'Suche nach Name, Nummer oder Status…')}
              aria-label={t('rentman.import.searchPlaceholder', 'Suche nach Name, Nummer oder Status…')}
              className="flex-1 rounded border border-cp-border bg-cp-surface-1 px-2 py-1 text-cp-base"
            />
            {projectQuery && (
              <button
                type="button"
                onClick={() => setProjectQuery('')}
                className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
              >
                {t('rentman.import.clearSearch', 'Leeren')}
              </button>
            )}
          </div>
          <ProjectSelector
            projects={sortedProjects}
            selectedProjectId={selectedProjectId}
            onSelect={(id) => {
              setPickerOpen(false)
              void fetchEquipment(id)
            }}
          />
          {selectedProjectId && selectedProjectId === linkedProjectId && (
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
              <Icon icon={Check} size="xs" /> {t('rentman.import.linkedBadge', 'Mit diesem Plan verknüpft')}
            </div>
          )}
          {items.length > 0 && selectedProjectId && (
            <button
              type="button"
              onClick={() => void fetchEquipment(selectedProjectId)}
              disabled={loading}
              className="mt-1 w-full rounded bg-cp-surface-4 px-2 py-1 text-cp-xs text-cp-text-bright hover:bg-cp-surface-5 disabled:opacity-50"
            >
              {loading ? t('rentman.import.loadingShort', 'Lädt…') : t('rentman.import.reloadSync', '↻ Neu laden & Abgleichen')}
            </button>
          )}
        </div>
        )}

        {loading && <div className="mb-2 text-cp-base text-cp-text-secondary">{t('rentman.import.loading', 'Loading…')}</div>}
        {error && <div className="mb-2 rounded bg-red-900/50 p-2 text-cp-base text-red-100">{error}</div>}
        {warning && <div className="mb-2 rounded bg-amber-900/40 p-2 text-cp-base text-amber-100">{warning}</div>}

        {items.length > 0 && (
          <>
            {allCategories.length > 1 && (
              <div className="mb-2 flex flex-wrap items-center gap-1 text-cp-xs">
                <span className="mr-1 text-cp-text-muted">{t('rentman.import.categories', 'Categories:')}</span>
                <button
                  type="button"
                  onClick={() => setSelectedCategories(new Set())}
                  className={`rounded px-2 py-0.5 ${
                    selectedCategories.size === 0
                      ? 'bg-sky-600 text-white'
                      : 'bg-cp-surface-4 hover:bg-cp-surface-5'
                  }`}
                >
                  {t('rentman.import.categoriesAll', 'Alle')}
                </button>
                {allCategories.map((cat) => {
                  const active = selectedCategories.has(cat)
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`rounded px-2 py-0.5 ${
                        active ? 'bg-sky-600 text-white' : 'bg-cp-surface-4 hover:bg-cp-surface-5'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="mb-2 flex items-center justify-between text-cp-xs text-cp-text-muted">
              <span>
                {format(t('rentman.import.shown', '{visible} of {total} shown'), { visible: visibleItems.length, total: items.length })}
                {setChildCount > 0 && ` ${format(t('rentman.import.inSets', '· {count} in sets (expand to view)'), { count: setChildCount })}`}
              </span>
              <span>{format(t('rentman.import.selected', '{count} selected'), { count: checkedCount })}</span>
            </div>
            {/* v7.9.128 — Status-Zeile: zeigt vor Import schon wie
                viele Items unsichtbar merged werden (rentmanId-Match,
                kein Dialog) vs. wie viele eine User-Entscheidung
                triggern (gleicher Name aber keine ID-Verknuepfung,
                Konflikt-Dialog faellt) vs. komplett neu sind.
                Macht den Re-Import-Workflow vorhersehbar. */}
            {(() => {
              let linked = 0
              let conflicts = 0
              let fresh = 0
              const seen = new Set<string>()
              for (const item of visibleItems) {
                if (seen.has(item.name)) continue
                seen.add(item.name)
                const byRentmanId = item.equipmentId
                  ? customLibrary.find((t) => t.rentmanId === item.equipmentId)
                  : undefined
                if (byRentmanId) {
                  linked++
                  continue
                }
                const byName = customLibrary.find(
                  (t) => t.name === item.name && t.rentmanId !== item.equipmentId,
                )
                if (byName) {
                  conflicts++
                  continue
                }
                fresh++
              }
              if (linked + conflicts === 0) return null
              return (
                <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                  {linked > 0 && (
                    <span
                      className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-emerald-200"
                      title={t('rentman.import.status.linkedTitle', 'Items mit identischem Rentman-Equipment-ID in der lokalen Library — silent re-import, Ports + Custom-Daten bleiben erhalten.')}
                    >
                      {format(t('rentman.import.status.linked', '✓ {count} bereits verknuepft'), { count: linked })}
                    </span>
                  )}
                  {conflicts > 0 && (
                    <span
                      className="rounded bg-amber-900/40 px-1.5 py-0.5 text-amber-100"
                      title={t('rentman.import.status.conflictsTitle', 'Items mit gleichem Namen wie ein lokales Template, aber ohne Rentman-ID. Beim Import faellt pro Item der Konflikt-Dialog (Default: lokale Version behalten + Rentman-ID anhaengen).')}
                    >
                      <><Icon icon={Zap} size="xs" className="mr-1 inline-block align-text-bottom" />{format(t('rentman.import.status.conflicts', '{count}× schon in Bibliothek (gleicher Name)'), { count: conflicts })}</>
                    </span>
                  )}
                  {fresh > 0 && (
                    <span
                      className="rounded bg-cp-surface-2/60 px-1.5 py-0.5 text-cp-text-muted"
                      title={t('rentman.import.status.freshTitle', 'Items ohne Match in der lokalen Library — werden frisch als Template importiert.')}
                    >
                      {format(t('rentman.import.status.fresh', '+ {count} neu'), { count: fresh })}
                    </span>
                  )}
                </div>
              )
            })()}
            <EquipmentChecklist
              items={visibleItems.map((item) => {
                // v7.9.128 — Reihenfolge der Match-Suche:
                // 1. Per rentmanId: existiert ein Lokales mit
                //    EXAKT diesem Rentman-Equipment-ID? -> "schon
                //    verknuepft" (gruener Badge, Re-Import ist
                //    silent merge, keine Ports verloren).
                // 2. Per Name in customLibrary (ohne ID-Match):
                //    der Konflikt-Dialog wird beim Import triggern
                //    -> amber Badge "Lokal vorhanden — Entscheidung
                //    noetig". User waehlt dort default 'keep' und
                //    behaelt die lokalen Ports.
                // 3. Built-in Catalog (Blackmagic, etc.).
                const byRentmanId = item.equipmentId
                  ? customLibrary.find((t) => t.rentmanId === item.equipmentId)
                  : undefined
                if (byRentmanId) {
                  return {
                    ...item,
                    templateMatch: byRentmanId.name,
                    templateMatchKind: 'rentmanId' as const,
                  }
                }
                const byName = customLibrary.find(
                  (t) => t.name === item.name && t.rentmanId !== item.equipmentId,
                )
                if (byName) {
                  return {
                    ...item,
                    templateMatch: byName.name,
                    templateMatchKind: 'nameOnly' as const,
                  }
                }
                const catalogMatch =
                  matchBlackmagicTemplate(item.name) ||
                  matchUbiquitiTemplate(item.name) ||
                  matchMonitorTemplate(item.name) ||
                  matchCameraTemplate(item.name) ||
                  matchMiscTemplate(item.name) ||
                  matchGreenGoTemplate(item.name) ||
                  matchAjaTemplate(item.name) ||
                  matchRossTemplate(item.name) ||
                  matchLynxTemplate(item.name) ||
                  matchSwitcherTemplate(item.name) ||
                  matchAvNetworkTemplate(item.name) ||
                  matchBroadcastToolsTemplate(item.name) ||
                  matchAudioTemplate(item.name) ||
                  matchWirelessAudioTemplate(item.name) ||
                  matchMicTemplate(item.name)
                if (catalogMatch) {
                  return {
                    ...item,
                    templateMatch: catalogMatch.name,
                    templateMatchKind: 'catalog' as const,
                  }
                }
                return item
              })}
              onToggle={toggleItem}
              onSetAll={setAllVisible}
              onQtyChange={setQty}
              onSetAllChildren={(parentId, checked) => {
                const children = items.filter((i) => i.parentId === parentId)
                children.forEach((child) => {
                  if (child.checked !== checked) toggleItem(child.id)
                })
              }}
              rackSetIds={rackSetIds}
              onSetMainOnly={setMainDeviceOnly}
              onSetAsRack={(parentId, asRack) => {
                setRackSetIds((prev) => {
                  const next = new Set(prev)
                  if (asRack) next.add(parentId)
                  else next.delete(parentId)
                  return next
                })
                // #335 — Beim Markieren als Rack die Kinder gleich mitselektieren,
                // damit der Rack-Inhalt vollständig importiert wird.
                if (asRack) {
                  const children = items.filter((i) => i.parentId === parentId)
                  children.forEach((child) => {
                    if (!child.checked) toggleItem(child.id)
                  })
                }
              }}
              linkableEquipment={projectEquipment
                .filter((e) => !e.rentmanId)
                .map((e) => ({ id: e.id, name: e.name }))}
              linkedMap={linkedExistingMap}
              onLinkExisting={(rentmanItemId, localEquipmentId) => {
                setLinkedExistingMap((prev) => ({ ...prev, [rentmanItemId]: localEquipmentId }))
              }}
            />

            {cableBuckets.length > 0 && (
              <div className="mt-4 rounded border border-orange-800/60 bg-orange-950/20 p-3">
                <button
                  type="button"
                  onClick={() => setCablePlanOpen((o) => !o)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-cp-base font-semibold text-orange-200">
                    {cablePlanOpen ? '▾ ' : '▸ '}
                    {format(t('rentman.import.cablePlan.headingN', 'Kabelmengen aus Rentman ({count})'), { count: cableBuckets.length })}
                  </span>
                  <span className="text-[11px] text-orange-300/70">
                    {cablePlanOpen ? t('rentman.import.cablePlan.collapse', 'einklappen') : t('rentman.import.cablePlan.expand', 'öffnen')}
                  </span>
                </button>
                {cablePlanOpen && (<>
                <div className="mb-2 mt-2 flex items-center justify-end">
                  <div className="flex gap-1 text-[11px]">
                    {(() => {
                      const allSelected =
                        cableBuckets.length > 0 &&
                        cableBuckets.every((bucket) => cablePlanSelected.has(bucket.key))
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (allSelected) setCablePlanSelected(new Set())
                            else setCablePlanSelected(new Set(cableBuckets.map((b) => b.key)))
                          }}
                          className="rounded bg-cp-surface-4 px-2 py-0.5 hover:bg-cp-surface-5"
                        >
                          {allSelected ? t('rentman.import.cablePlan.deselectAll', 'Alle abwählen') : t('rentman.import.cablePlan.selectAll', 'Alle auswählen')}
                        </button>
                      )
                    })()}
                  </div>
                </div>
                <div className="max-h-48 space-y-0.5 overflow-auto rounded border border-orange-900/40 bg-cp-surface-3/40 p-1">
                  {cableBuckets.map((bucket) => {
                    const checked = cablePlanSelected.has(bucket.key)
                    const qty = cablePlanQty[bucket.key] ?? bucket.totalQty
                    return (
                      <label
                        key={bucket.key}
                        className="flex items-center gap-2 rounded px-1.5 py-0.5 text-cp-xs hover:bg-cp-surface-1"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCableBucket(bucket.key)}
                        />
                        <span className="w-32 truncate font-medium text-cp-text">
                          {bucket.type}
                        </span>
                        <span className="w-16 text-cp-text-secondary">{bucket.length} m</span>
                        <input
                          type="number"
                          min={0}
                          value={qty}
                          onChange={(event) =>
                            setCableBucketQty(bucket.key, Number(event.target.value))
                          }
                          className="w-16 rounded border border-cp-border bg-cp-surface-1 px-1 py-0.5 text-right"
                        />
                        <span className="text-[10px] text-cp-text-muted">
                          {bucket.rows.length === 1
                            ? bucket.rows[0].name
                            : format(t('rentman.import.cablePlan.entryCount', '{count} Einträge'), { count: bucket.rows.length })}
                        </span>
                      </label>
                    )
                  })}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span
                    className={`inline-flex items-center gap-1 ${
                      cablePlanResult?.kind === 'ok'
                        ? 'text-emerald-400'
                        : cablePlanResult
                          ? 'text-amber-300'
                          : 'text-cp-text-faint'
                    }`}
                  >
                    {cablePlanResult && (
                      <Icon icon={cablePlanResult.kind === 'ok' ? Check : AlertTriangle} size="xs" />
                    )}
                    {cablePlanResult?.text ?? format(t('rentman.import.cablePlan.detected', '{count} Kabeltyp(en) erkannt'), { count: cableBuckets.length })}
                  </span>
                  <button
                    type="button"
                    onClick={handleImportCablePlan}
                    disabled={cablePlanSelected.size === 0}
                    className="rounded bg-orange-600 px-3 py-1 text-cp-xs font-semibold text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('rentman.import.cablePlan.apply', 'Kabelmengen übernehmen')}
                  </button>
                </div>
                </>)}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between text-cp-base">
              {importResult !== null ? (
                <span className="font-semibold text-emerald-400">
                  {format(importResult === 1 ? t('rentman.import.resultOne', '✓ {count} Gerät zur Library hinzugefügt') : t('rentman.import.resultMany', '✓ {count} Geräte zur Library hinzugefügt'), { count: importResult })}
                </span>
              ) : (
                <span className="text-cp-xs text-cp-text-muted">
                  {t('rentman.import.resultHint', 'Geräte werden zur Equipment Library hinzugefügt, nicht direkt auf die Canvas platziert.')}
                </span>
              )}
              <button
                type="button"
                onClick={handleImport}
                disabled={importResult !== null || checkedCount === 0}
                title={checkedCount === 0 ? t('rentman.import.addNoneTitle', 'Erst Geräte in der Liste auswählen') : undefined}
                className="rounded bg-emerald-600 px-3 py-1 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checkedCount > 0
                  ? format(t('rentman.import.addToLibraryN', 'Zur Library hinzufügen ({count})'), { count: checkedCount })
                  : t('rentman.import.addToLibrary', 'Zur Library hinzufügen')}
              </button>
            </div>
          </>
        )}
      </div>
      <NewRentmanDeviceWizard
        open={wizardQueue !== null}
        items={wizardQueue ?? []}
        onSave={handleWizardSave}
        onSkip={handleWizardSkip}
        onExclude={handleWizardExclude}
        onCancel={handleWizardCancel}
      />

      <TemplateMergeDialog
        open={!!activeMergeItem}
        localTemplate={activeMergeItem?.localTemplate ?? null}
        incomingTemplate={activeMergeItem?.incomingTemplate ?? null}
        incomingLabel="Rentman"
        categoryOptions={importCategoryOptions}
        initialCategory={pendingCategoryByName[activeMergeItem?.name ?? '']}
        onCancel={() => {
          setMergeQueue([])
          setMergeIndex(0)
          setPendingMergeTemplates({})
          setPendingDecisions({})
          setPendingCategoryByName({})
        }}
        onConfirm={(merged) => {
          if (!activeMergeItem) return
          const nextTemplates = {
            ...pendingMergeTemplates,
            [activeMergeItem.equipmentId]: merged,
          }
          setPendingMergeTemplates(nextTemplates)
          if (mergeIndex + 1 >= mergeQueue.length) {
            const decisions = pendingDecisions
            setMergeQueue([])
            setMergeIndex(0)
            proceedAfterConflicts(decisions, pendingCategoryByName, nextTemplates, pendingLinks)
            return
          }
          setMergeIndex((value) => value + 1)
        }}
      />
        </>
      )}
    </div>
  )
}
