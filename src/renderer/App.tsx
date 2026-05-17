import { useEffect, useMemo, useState } from 'react'
import { CanvasArea } from './components/Canvas/CanvasArea'
import { LibraryPanel } from './components/Library/LibraryPanel'
import { MenuBar } from './components/Layout/MenuBar'
import { StatusBar } from './components/Layout/StatusBar'
import { PropertiesPanel } from './components/Properties/PropertiesPanel'
import { RentmanImportDialog } from './components/Rentman/RentmanImportDialog'
import { GraphmlImportDialog } from './components/Import/GraphmlImportDialog'
import { RentmanCableExportDialog } from './components/Rentman/RentmanCableExportDialog'
import { OnboardingTour, hasSeenTour } from './components/Onboarding/OnboardingTour'
import { SettingsDialog } from './components/Settings/SettingsDialog'
import { VideohubExportDialog } from './components/Export/VideohubExportDialog'
import { GreenGoExportDialog } from './components/Export/GreenGoExportDialog'
import { AtemDialog } from './components/Atem/AtemDialog'
import { MultiviewerLayoutView } from './components/Atem/MultiviewerLayoutView'
import { AtemMvConfigDialog } from './components/Atem/AtemMvConfigDialog'
import { AtemAudioRouterDialog } from './components/Atem/AtemAudioRouterDialog'
import { LocationBomDialog } from './components/Project/LocationBomDialog'
import { RackEditorDialog } from './components/Rack/RackEditorDialog'
import { CableContextMenu } from './components/Canvas/CableContextMenu'
import { ExportDialog } from './components/Export/ExportDialog'
import { AnnotationsPanel } from './components/Annotations/AnnotationsPanel'

// v7.9.3 — Hook-Wrapper damit das Annotations-Panel auf
// uiStore.annotationsPanelOpen reagiert. Direkt im JSX würde
// useUiStore.getState() nur beim ersten Render gelesen.
const AnnotationsPanelHost = () => {
  const open = useUiStore((s) => s.annotationsPanelOpen)
  const setOpen = useUiStore((s) => s.setAnnotationsPanelOpen)
  return <AnnotationsPanel open={open} onClose={() => setOpen(false)} />
}
import { MobileShareDialog } from './components/MobileShare/MobileShareDialog'
import { AboutDialog } from './components/About/AboutDialog'
import { PatchListDialog } from './components/Patch/PatchListDialog'
import { CalculatorsDialog } from './components/Calculators/CalculatorsDialog'
import { ProjectMetaDialog } from './components/Project/ProjectMetaDialog'
import { CableBomDialog } from './components/Project/CableBomDialog'
import { PrintDialog } from './components/Print/PrintDialog'
import { WelcomeDialog } from './components/Project/WelcomeDialog'
import { Splitter } from './components/Layout/Splitter'
import { useProject } from './hooks/useProject'
import { useRentman } from './hooks/useRentman'
import { cablePlannerApi, hasDesktopBridge } from './lib/bridge'
import { exportCanvasToPdf, exportCanvasToPdfBytes } from './lib/exportPdf'
import { printPdfBlob } from './lib/printPdfBlob'
import { exportCanvasToImage } from './lib/exportImage'
import { useProjectStore } from './store/projectStore'
import {
  scanLibraryFolder,
  markDeviceSynced,
  markGroupSynced,
  findOutdatedEquipment,
  applyDeviceTemplateUpdate,
  detectFolderDeletions,
  pushMissingItemsToFolder,
} from './lib/librarySync'
import { useUndoRedoShortcuts, projectHistory } from './store/projectHistory'
import { useSettingsStore } from './store/settingsStore'
import { useUiStore } from './store/uiStore'
import { useHotkeys } from './lib/hotkeys'
import type { Cable, CableType } from './types/cable'
import { ALL_CONNECTOR_TYPES } from './types/equipment'
import type { ConnectorType, EquipmentItem, Port } from './types/equipment'
import type { ProjectMetadata } from './types/project'
import {
  ALL_SIGNAL_STANDARDS,
  cableCatalog,
  checkCableCompatibility,
  checkSdiStandardMismatch,
  pickHighestSdiStandard,
  type CableSpec,
  type SignalStandard,
} from './types/cableSpec'
import {
  DEFAULT_VIDEO_FORMAT,
  pickCableStandardForFormat,
  videoFormatById,
  type VideoFormatId,
} from './types/videoFormat'
import { confirmDialog } from './lib/confirmDialog'
import { promptDialog } from './lib/promptDialog'
import { infoDialog } from './lib/infoDialog'

export default function App() {
  const project = useProjectStore((state) => state.project)
  const canvasTheme = useUiStore((state) => state.canvasTheme)
  // v7.7.1 — exporters now read the live canvas-background settings so the
  // exported PDF / PNG / JPEG matches what the user sees on the canvas.
  const exportBgVariant = useUiStore((state) => state.bgVariant)
  const exportBgOpacity = useUiStore((state) => state.bgOpacity)
  const exportGridSize = useUiStore((state) => state.gridSize)
  const exportCustomPalette = useUiStore((state) => state.customPalette)
  const showCableDialog = useProjectStore((state) => state.showCableDialog)
  const pendingConnection = useProjectStore((state) => state.pendingConnection)
  const createCableFromPending = useProjectStore((state) => state.createCableFromPending)
  const closeCableDialog = useProjectStore((state) => state.closeCableDialog)
  const hasToken = useSettingsStore((state) => state.hasToken)
  const setHasToken = useSettingsStore((state) => state.setHasToken)
  const propertiesCollapsed = useUiStore((state) => state.propertiesCollapsed)
  const libraryCollapsed = useUiStore((state) => state.libraryCollapsed)
  const libraryFloating = useUiStore((state) => state.libraryFloating)
  const propertiesFloating = useUiStore((state) => state.propertiesFloating)
  const libraryWidth = useUiStore((state) => state.libraryWidth)
  const propertiesWidth = useUiStore((state) => state.propertiesWidth)
  const setLibraryWidth = useUiStore((state) => state.setLibraryWidth)
  const setPropertiesWidth = useUiStore((state) => state.setPropertiesWidth)
  const videohubExport = useUiStore((state) => state.videohubExport)
  const closeVideohubExport = useUiStore((state) => state.closeVideohubExport)
  const greengoExport = useUiStore((state) => state.greengoExport)
  const closeGreenGoExport = useUiStore((state) => state.closeGreenGoExport)
  const cableEdit = useUiStore((state) => state.cableEdit)
  const closeCableEdit = useUiStore((state) => state.closeCableEdit)
  const updateCable = useProjectStore((state) => state.updateCable)
  const atemDialog = useUiStore((state) => state.atemDialog)
  const closeAtemDialog = useUiStore((state) => state.closeAtemDialog)
  const atemMvLayout = useUiStore((state) => state.atemMvLayout)
  const closeAtemMvLayout = useUiStore((state) => state.closeAtemMvLayout)
  const { newProject, openProject, saveProject, saveProjectAs, refreshRecent } = useProject()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const rentmanImport = useUiStore((state) => state.rentmanImport)
  const closeRentmanImport = useUiStore((state) => state.closeRentmanImport)
  const rentmanCableExport = useUiStore((state) => state.rentmanCableExport)
  const openRentmanCableExport = useUiStore((state) => state.openRentmanCableExport)
  const closeRentmanCableExport = useUiStore((state) => state.closeRentmanCableExport)
  const { addProjectFile } = useRentman()
  const [metaDialog, setMetaDialog] = useState<{ mode: 'new' | 'edit' } | null>(null)
  const [cableBomOpen, setCableBomOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [pdfExportOpen, setPdfExportOpen] = useState(false)
  const [pdfTheme, setPdfTheme] = useState<'dark' | 'light'>('light')
  // v7.9.0 / Issue #110 — unified export dialog
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [graphmlImportOpen, setGraphmlImportOpen] = useState(false)
  const pdfExportThemeOverride = useUiStore((state) => state.pdfExportThemeOverride)
  const setPdfExportThemeOverride = useUiStore((state) => state.setPdfExportThemeOverride)

  useEffect(() => {
    document.documentElement.dataset.theme = pdfExportThemeOverride ?? canvasTheme
  }, [canvasTheme, pdfExportThemeOverride])

  const projectVersion = useProjectStore((s) => s.projectVersion)
  const [libraryReady, setLibraryReady] = useState(false)

  // v7.9.33 — Library-Folder-Sync beim App-Start. Liest alle .cpdevice/
  // .cpgroup Dateien aus userData/library/, fügt Items hinzu die im
  // localStorage noch nicht stehen. So überlebt die Library App-
  // Reinstalls und kann zwischen Systemen per Dropbox o.ä. abgeglichen
  // werden. Bestehende localStorage-Items werden NICHT überschrieben —
  // der User behält seine lokalen Edits.
  useEffect(() => {
    void (async () => {
      if (!hasDesktopBridge) {
        setLibraryReady(true)
        return
      }
      const items = await scanLibraryFolder()
      const state = useProjectStore.getState()
      // ── ADD: neue Folder-Items, die noch nicht im Store sind
      const existingDeviceNames = new Set(state.customLibrary.map((t) => t.name))
      const existingGroupNames = new Set(state.groupPresets.map((p) => p.name))
      const newDevices = items
        .filter((i) => i.kind === 'device' && !existingDeviceNames.has(i.template.name))
        .map((i) => (i as { template: import('./types/equipment').EquipmentTemplate }).template)
      const newGroups = items
        .filter((i) => i.kind === 'group' && !existingGroupNames.has(i.preset.name))
        .map((i) => (i as { preset: import('./types/equipment').GroupPreset }).preset)
      // Marker im Sync-Cache setzen damit der folgende addCustomTemplates-
      // /addGroupPreset-Call den Diff als "schon synchron" sieht und nicht
      // sofort wieder in den Ordner zurückschreibt.
      for (const t of newDevices) markDeviceSynced(t)
      for (const p of newGroups) markGroupSynced(p)
      if (newDevices.length > 0) state.addCustomTemplates(newDevices)
      for (const preset of newGroups) state.addGroupPreset(preset)
      // ── REMOVE: Items die mal im Folder waren (folderTracked-Set), jetzt
      // aber fehlen → User hat die Datei aus dem Ordner gelöscht. Wir
      // spiegeln das im Store wider damit die UI mit dem Folder übereinstimmt.
      // Built-ins beim First-Install sind NICHT folderTracked (noch nie
      // gesynced), bleiben also erhalten.
      const { deletedDevices, deletedGroups } = detectFolderDeletions(items)
      const refreshed = useProjectStore.getState()
      for (const name of deletedDevices) {
        if (refreshed.customLibrary.some((t) => t.name === name)) {
          refreshed.removeCustomTemplate(name)
        }
      }
      for (const name of deletedGroups) {
        const preset = refreshed.groupPresets.find((p) => p.name === name)
        if (preset) refreshed.deleteGroupPreset(preset.id)
      }
      // ── PUSH: Items im Store, die NICHT im Folder sind, jetzt schreiben.
      // Damit landen Built-ins (First-Install) und alle bisher nur in
      // localStorage gespeicherten Items auch wirklich als .cpdevice/
      // .cpgroup-Dateien im userData/library/-Pfad. Vorher hat der
      // seedLibrarySyncCache sie zwar als "synchron" markiert, aber
      // weil kein User-Edit passierte, wurde nie auf die Platte
      // geschrieben.
      const afterDeletes = useProjectStore.getState()
      await pushMissingItemsToFolder(afterDeletes.customLibrary, afterDeletes.groupPresets)
      setLibraryReady(true)
    })()
  }, [])

  // v7.9.33 — Update-Prompt für Library-Items.
  // Triggered: wenn (a) der Library-Scan abgeschlossen ist UND (b) ein
  // Projekt geladen wurde (projectVersion bumpt bei Load/New). Wenn
  // platzierte Geräte einen libraryRef haben und der Folder eine neuere
  // fileVersion enthält, fragt der Dialog ob aktualisiert werden soll.
  useEffect(() => {
    if (!libraryReady) return
    void (async () => {
      const state = useProjectStore.getState()
      const outdated = findOutdatedEquipment(state.project.equipment)
      if (outdated.length === 0) return
      const lines = outdated.slice(0, 12).map((o) => {
        const kindLabel = o.refKind === 'device' ? 'Gerät' : 'Rack/Gruppe'
        return `• ${o.equipmentName} (${kindLabel}: ${o.refName}) — v${o.storedFileVersion} → v${o.currentFileVersion}`
      })
      const more = outdated.length > lines.length ? `\n…und ${outdated.length - lines.length} weitere` : ''
      const ok = await confirmDialog(
        `${outdated.length} Library-Item${outdated.length === 1 ? '' : 's'} im Projekt sind veraltet:`,
        {
          body: `${lines.join('\n')}${more}\n\nIm Bibliotheks-Ordner liegt eine neuere Version. Auf die aktuellen Library-Stände aktualisieren?\n\n(Geräte-Namen + Notizen bleiben erhalten. Rack/Gruppen-Updates müssen aktuell manuell neu platziert werden.)`,
          okLabel: 'Aktualisieren',
        },
      )
      if (!ok) return
      const freshState = useProjectStore.getState()
      let applied = 0
      for (const item of outdated) {
        if (item.refKind !== 'device') continue // Group/Rack-Update später
        const newTemplate = freshState.customLibrary.find((t) => t.name === item.refName)
        if (!newTemplate) continue
        const oldEq = freshState.project.equipment.find((e) => e.id === item.equipmentId)
        if (!oldEq) continue
        const updated = applyDeviceTemplateUpdate(oldEq, newTemplate)
        freshState.updateEquipment(item.equipmentId, updated)
        applied += 1
      }
      const skipped = outdated.length - applied
      if (applied > 0 || skipped > 0) {
        await infoDialog('Update fertig', {
          body: `${applied} Gerät${applied === 1 ? '' : 'e'} aktualisiert.${
            skipped > 0
              ? `\n${skipped} Rack/Gruppen-Item${skipped === 1 ? '' : 's'} übersprungen — bitte manuell neu platzieren wenn nötig.`
              : ''
          }`,
          tone: 'success',
        })
      }
    })()
  }, [libraryReady, projectVersion])

  useEffect(() => {
    if (pdfExportOpen) setPdfTheme('light')
  }, [pdfExportOpen])

  useEffect(() => {
    // First-launch project chooser. Show only when:
    //   - the user hasn't dismissed it before (localStorage flag), AND
    //   - the working project is genuinely empty (no autosaved canvas to
    //     restore — otherwise the welcome dialog would obstruct an
    //     existing-project session every time the user clears the canvas).
    const FLAG = 'cable-planner:welcomed'
    try {
      if (localStorage.getItem(FLAG)) return
    } catch {
      // localStorage unavailable — skip the prompt rather than blocking app start.
      return
    }
    const isEmpty =
      project.equipment.length === 0 &&
      project.cables.length === 0 &&
      (project.locations?.length ?? 0) === 0
    if (!isEmpty) {
      // Existing autosave restored — user already has a project.
      try { localStorage.setItem(FLAG, '1') } catch { /* ignore */ }
      return
    }
    const timer = window.setTimeout(() => setWelcomeOpen(true), 250)
    return () => window.clearTimeout(timer)
    // We deliberately depend only on mount; re-running on every project change
    // would re-open the dialog whenever the user clears the canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dismissWelcome = () => {
    try { localStorage.setItem('cable-planner:welcomed', '1') } catch { /* ignore */ }
    setWelcomeOpen(false)
  }

  useEffect(() => {
    // Auto-open onboarding tour on first launch only. Subsequent runs leave
    // the tour closed; the user can re-open it from the Help menu.
    if (!hasSeenTour()) {
      const timer = window.setTimeout(() => setTourOpen(true), 400)
      return () => window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    void refreshRecent()
    cablePlannerApi.credentials.getToken().then((token) => {
      setHasToken(Boolean(token))
    })
  }, [refreshRecent, setHasToken])

  useUndoRedoShortcuts()

  // v7.9.21 — Defensiver Focus-Rescue für Text-Inputs.
  //
  // Symptom: Manchmal landet ein Klick auf einem <input>/<textarea>
  // nicht auf dem Input (User tippt → nichts passiert). Ein zweiter
  // Klick funktioniert dann sofort.
  //
  // Wurzel: ReactFlow's Pane ist tabindex-fokussierbar (für Keyboard-
  // Accessibility). Nach Klick auf einen Node wandert Browser-Focus
  // dorthin. Wenn der User unmittelbar danach auf ein Input in einer
  // Sidebar/Dialog klickt, sollte Focus weiterspringen — aber durch
  // React's Render-Batching und ReactFlow's interne State-Updates
  // wird der mousedown→focus-Transfer manchmal verschluckt. Beim
  // zweiten Klick ist React stabil, Focus springt sauber.
  //
  // Indiz: CanvasToolbar hat schon einen RAF-Focus-Workaround für
  // einen einzelnen Input (Issue #59). Wir lösen das hier global.
  //
  // Strategie: globaler mousedown-Listener prüft ob das Ziel ein
  // editierbares Element ist. Wenn ja, nach requestAnimationFrame
  // explizit fokussieren (falls nicht bereits dort). Idempotent —
  // wenn der Browser den Focus selbst gesetzt hat passiert nichts.
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      const tag = target.tagName
      const editable =
        tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
      if (!editable) return
      // Disabled / readonly Inputs nicht zwangs-fokussieren.
      if ((target as HTMLInputElement).disabled) return
      if ((target as HTMLInputElement).readOnly) return
      requestAnimationFrame(() => {
        if (document.activeElement !== target && document.contains(target)) {
          target.focus({ preventScroll: true })
        }
      })
    }
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [])

  // Whenever the project changes, push it to the in-process mobile-
  // share HTTP server so the phone always sees the latest state on
  // refresh. The bridge no-ops gracefully when the server isn't
  // running, so we don't need to gate this on a UI flag. Debounced
  // 500 ms to avoid IPC churn during rapid drags.
  useEffect(() => {
    if (!hasDesktopBridge) return
    const timer = window.setTimeout(() => {
      void cablePlannerApi.mobileShare.setProject(project)
    }, 500)
    return () => window.clearTimeout(timer)
  }, [project])

  // v7.9.3 — Subscribe to mobile check-state updates. Wenn der Field-
  // Tech am Handy einen Port als "gesteckt" markiert, schickt das
  // Mobile-View POST /checks → IPC → wir landen hier und updaten den
  // Store, was die Canvas-Häkchen live rendert.
  const setCheckState = useProjectStore((s) => s.setCheckState)
  useEffect(() => {
    if (!hasDesktopBridge) return
    return cablePlannerApi.mobileShare.onChecksUpdate((checks) => {
      setCheckState(checks)
    })
  }, [setCheckState])

  // v7.9.54 — Mobile-User hat ein Kabel via Dropdown-UI hinzugefügt.
  // ProjectStore fügt es mit addedFromMobile=true ein → Canvas zeigt
  // sofort ein 📱-Badge am neuen Edge.
  const addCableFromMobile = useProjectStore((s) => s.addCableFromMobile)
  useEffect(() => {
    if (!hasDesktopBridge) return
    return cablePlannerApi.mobileShare.onCableAdded((cable) => {
      addCableFromMobile(cable)
    })
  }, [addCableFromMobile])

  // Issue #69: dispatch user-customizable hotkeys defined in
  // Settings → Hotkeys. The undo/redo entries below intentionally
  // overlap with useUndoRedoShortcuts() — only the first matching
  // handler fires, so there's no double-trigger.
  const hotkeys = useUiStore((s) => s.hotkeys)
  const hotkeyHandlers = useMemo(
    () => ({
      undo: () => projectHistory.undo(),
      redo: () => projectHistory.redo(),
      save: () => void saveProject(),
      saveAs: () => void saveProjectAs(),
      newProject: () => void handleNewProject(),
      openProject: () => void openProject(),
      deleteSelected: () => useProjectStore.getState().deleteSelected(),
      clearSelection: () =>
        useProjectStore.getState().setSelection(undefined, undefined, undefined),
      toggleLibrary: () => useUiStore.getState().toggleLibraryCollapsed(),
      toggleProperties: () => useUiStore.getState().togglePropertiesCollapsed(),
      toggleArrows: () =>
        useUiStore.getState().setDefaultArrow(!useUiStore.getState().defaultArrow),
    }),
    // We rebuild handlers only when stable refs change. Most setters
    // come from zustand; handleNewProject is recreated each render
    // but it's only invoked on key press so a stale capture is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openProject, saveProject, saveProjectAs],
  )
  useHotkeys(hotkeys, hotkeyHandlers)

  const handleNewProject = async () => {
    // Only *open* the dialog here. The actual project reset happens when the
    // user confirms the dialog (see `handleMetaConfirm`). Clearing the project
    // up-front made the canvas look blank the moment "Neues Projekt" was
    // clicked, and if the user then hit Abbrechen (or the dialog closed for any
    // other reason) they were left with an empty project and no way to get back
    // to their work — it felt like "Neues Projekt" was broken until restart.
    const hasContent =
      project.equipment.length > 0 ||
      project.cables.length > 0 ||
      (project.locations?.length ?? 0) > 0
    if (hasContent) {
      const ok = confirm(
        'Aktuelles Projekt verwerfen und neues Projekt anlegen?\n\nUngespeicherte Änderungen gehen verloren.',
      )
      if (!ok) return
    }
    setMetaDialog({ mode: 'new' })
  }

  const handleMetaConfirm = async (patch: Partial<ProjectMetadata>) => {
    if (!metaDialog) return
    if (metaDialog.mode === 'new') {
      // Reset the canvas synchronously via the store's `clear()`. We avoid
      // `await newProject()` here because that also awaits IPC + recent-list
      // refresh; if any of those hang or throw on a fresh install, the dialog
      // would never close and the user couldn't create a new project at all.
      // `clear()` is purely local state and always succeeds.
      useProjectStore.getState().clear()
      // Best-effort: also notify the main process and refresh recents, but
      // don't block the dialog on it.
      void newProject().catch(() => {
        /* ignore — clear() already did the local reset */
      })
    }
    useProjectStore.getState().updateProjectMetadata(patch)
    setMetaDialog(null)
  }

  // v7.7.1 — PNG / JPEG export (canvas only, no header / title block).
  const handleExportImage = async (format: 'png' | 'jpeg') => {
    try {
      await exportCanvasToImage(project.metadata.name, format, {
        backgroundTheme: canvasTheme,
        bgVariant: exportBgVariant,
        gridSize: exportGridSize,
        bgOpacity: exportBgOpacity,
        customPalette: exportCustomPalette,
      })
    } catch (error) {
      console.error(`${format.toUpperCase()} export failed:`, error)
      await infoDialog(`${format.toUpperCase()}-Export fehlgeschlagen`, {
        body: error instanceof Error ? error.message : 'Unbekannter Fehler',
        tone: 'error',
      })
    }
  }

  // v7.9.3 — Viewer-File-Export. Plan wird mit mode='viewer' und
  // .cpviewer-Extension exportiert. Reviewer öffnen es im Cable-
  // Planner und werden beim ersten Mal nach ihrem Namen gefragt.
  const handleExportViewer = async () => {
    if (!hasDesktopBridge) {
      await infoDialog('Viewer-Export erfordert die Desktop-App.', { tone: 'warning' })
      return
    }
    try {
      const path = await cablePlannerApi.project.exportViewer(project)
      if (path) {
        await infoDialog('Viewer-Datei gespeichert', {
          body:
            `${path}\n\n` +
            'Sende sie an deine Freelancer/Helfer. Beim Öffnen werden sie nach ' +
            'ihrem Namen gefragt — Anmerkungen sind dann automatisch attributiert.',
          tone: 'success',
        })
      }
    } catch (error) {
      console.error('Viewer export failed:', error)
      await infoDialog('Viewer-Export fehlgeschlagen', {
        body: (error as Error).message,
        tone: 'error',
      })
    }
  }

  // v7.9.3 — Annotations von Reviewern zurückmergen ins Original.
  // Liest annotations[] aus der .cpviewer und fügt sie unserer
  // project.annotations[] hinzu (ID-basierte De-Duplikation).
  const handleImportAnnotations = async () => {
    if (!hasDesktopBridge) {
      await infoDialog('Annotations-Re-Import erfordert die Desktop-App.', { tone: 'warning' })
      return
    }
    const result = await cablePlannerApi.project.importAnnotations()
    if (!result) return
    const incoming = result.annotations as Array<{ id?: string } & Record<string, unknown>>
    const current = project.annotations ?? []
    const existingIds = new Set(current.map((a) => a.id))
    const addAnnotation = useProjectStore.getState().addAnnotation
    let imported = 0
    for (const a of incoming) {
      if (!a.id || typeof a.id !== 'string') continue
      if (existingIds.has(a.id)) continue
      addAnnotation(a as import('./types/project').ProjectAnnotation)
      imported++
    }
    await infoDialog('Annotations importiert', {
      body:
        `${imported} neue Anmerkung${imported === 1 ? '' : 'en'} importiert.\n` +
        `${incoming.length - imported} bereits vorhanden — übersprungen.`,
      tone: 'success',
    })
  }

  const handleExportPdf = async (theme: 'dark' | 'light' = canvasTheme) => {
    setPdfExportThemeOverride(theme)
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
    try {
      await exportCanvasToPdf(project.metadata.name, project.metadata, 0.85, {
        backgroundTheme: theme,
        bgVariant: exportBgVariant,
        gridSize: exportGridSize,
        bgOpacity: exportBgOpacity,
        customPalette: exportCustomPalette,
      })
    } catch (error) {
      console.error('PDF export failed:', error)
      await infoDialog('PDF-Export fehlgeschlagen', {
        body: error instanceof Error ? error.message : 'Unbekannter Fehler',
        tone: 'error',
      })
    } finally {
      setPdfExportThemeOverride(null)
    }
  }

  /** v7.9.4 — Plan-PDF in den OS-Drucker statt File-Download.
   *  Baut die gleiche PDF wie handleExportPdf, schickt sie aber durch
   *  printPdfBlob → unsichtbares iframe → window.print() → OS-Druckdialog. */
  const handlePrintPdf = async (theme: 'dark' | 'light' = canvasTheme) => {
    setPdfExportThemeOverride(theme)
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
    try {
      const bytes = await exportCanvasToPdfBytes(project.metadata, 0.85, {
        backgroundTheme: theme,
        bgVariant: exportBgVariant,
        gridSize: exportGridSize,
        bgOpacity: exportBgOpacity,
        customPalette: exportCustomPalette,
      })
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
      void printPdfBlob(blob)
    } catch (error) {
      console.error('PDF print failed:', error)
      await infoDialog('PDF-Druck fehlgeschlagen', {
        body: error instanceof Error ? error.message : 'Unbekannter Fehler',
        tone: 'error',
      })
    } finally {
      setPdfExportThemeOverride(null)
    }
  }

  /**
   * Render the canvas as a PDF and attach it to the linked Rentman project.
   *
   * Lives here (not in `LibraryPanel`) so the same action is available from the
   * top-bar Export menu regardless of which left-panel tab is open. The user
   * is shown a confirmation prompt because the upload mutates the Rentman
   * project and is hard to roll back through our IPC bridge.
   */
  const handleUploadPdfToRentman = async () => {
    const meta = project.metadata
    const linkedId = meta.rentmanProjectId
    if (!linkedId) {
      await infoDialog('Kein Rentman-Projekt verknüpft', {
        body: 'Bitte zuerst in den Einstellungen verknüpfen.',
        tone: 'warning',
      })
      return
    }
    const targetName = meta.rentmanProjectName ?? `Projekt #${linkedId}`
    if (!(await confirmDialog(`Aktuellen Plan als PDF an Rentman-Projekt "${targetName}" anhängen?`))) {
      return
    }
    try {
      const bytes = await exportCanvasToPdfBytes(meta, 0.85, {
        backgroundTheme: canvasTheme,
        bgVariant: exportBgVariant,
        gridSize: exportGridSize,
        bgOpacity: exportBgOpacity,
        customPalette: exportCustomPalette,
      })
      const baseName = (meta.name || 'cable-planner').replace(/[^a-z0-9\-_. ]/gi, '_')
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      const fileName = `${baseName}_${stamp}.pdf`
      await addProjectFile(linkedId, fileName, bytes, 'application/pdf')
      await infoDialog('An Rentman angehängt', {
        body: `${fileName} wurde dem Projekt "${targetName}" als Anhang hinzugefügt.`,
        tone: 'success',
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('PDF upload to Rentman failed:', err)
      await infoDialog('Fehler beim PDF-Upload', { body: msg, tone: 'error' })
    }
  }

  /**
   * Wraps `createCableFromPending` so we can warn the user when a freshly
   * built cable causes the bucket (`type|length`) to exceed the planned
   * Rentman quantity. The plan comes from `metadata.rentmanCablePlan`, which
   * is populated by the Rentman import dialog.
   */
  const createCableWithPlanCheck: typeof createCableFromPending = async (draft) => {
    // Issue #43: warn when either endpoint already has a cable plugged in
    // and offer to delete the existing cable(s) before adding the new one.
    const stateBefore = useProjectStore.getState()
    const pending = stateBefore.pendingConnection
    if (
      pending &&
      pending.source &&
      pending.target &&
      pending.sourceHandle &&
      pending.targetHandle
    ) {
      const fromEqId = pending.source
      const fromPortId = pending.sourceHandle
      const toEqId = pending.target
      const toPortId = pending.targetHandle
      const usesPort = (cable: Cable, eqId: string, portId: string) =>
        (cable.fromEquipmentId === eqId && cable.fromPortId === portId) ||
        (cable.toEquipmentId === eqId && cable.toPortId === portId)
      const conflicts = stateBefore.project.cables.filter(
        (c) => usesPort(c, fromEqId, fromPortId) || usesPort(c, toEqId, toPortId),
      )
      if (conflicts.length > 0) {
        const list = conflicts
          .map((c) => `• ${c.name || `${c.type} ${c.length} m`}`)
          .join('\n')
        const replace = await confirmDialog('Port bereits belegt', {
          body:
            `An mindestens einem der Ports steckt bereits ein Kabel:\n\n${list}\n\n` +
            `"Ersetzen" = bestehendes Kabel löschen und neue Verbindung anlegen.\n` +
            `"Abbrechen" = neue Verbindung verwerfen, alles bleibt wie es ist.`,
          okLabel: 'Ersetzen',
          destructive: true,
        })
        if (!replace) {
          stateBefore.closeCableDialog()
          return
        }
        for (const c of conflicts) {
          useProjectStore.getState().deleteCable(c.id)
        }
      }
    }
    createCableFromPending(draft)
    const plan = useProjectStore.getState().project.metadata.rentmanCablePlan
    if (!plan) return
    const key = `${draft.type}|${draft.length}`
    const planned = plan[key] ?? 0
    if (planned <= 0) return
    const built = useProjectStore
      .getState()
      .project.cables.filter((c) => c.type === draft.type && c.length === draft.length).length
    if (built > planned) {
      await infoDialog('Ueber Rentman-Plan hinaus', {
        body:
          `Es sind jetzt ${built} x ${draft.type} ${draft.length} m verbaut, ` +
          `aber nur ${planned} laut Rentman-Plan vorhanden. ` +
          `Bitte zusaetzliche Kabel in Rentman buchen oder die Verkabelung anpassen.`,
        tone: 'warning',
      })
    }
  }

  const editCable = useMemo(
    () => (cableEdit.cableId ? project.cables.find((c) => c.id === cableEdit.cableId) : undefined),
    [cableEdit.cableId, project.cables],
  )

  const { fromPort, toPort, fromDev, toDev } = useMemo(() => {
    if (!pendingConnection)
      return { fromPort: undefined, toPort: undefined, fromDev: undefined, toDev: undefined }
    const fromDev = project.equipment.find((e) => e.id === pendingConnection.source)
    const toDev = project.equipment.find((e) => e.id === pendingConnection.target)
    const fromPort = fromDev?.outputs.find((p) => p.id === pendingConnection.sourceHandle)
    const toPort = toDev?.inputs.find((p) => p.id === pendingConnection.targetHandle)
    return { fromPort, toPort, fromDev, toDev }
  }, [pendingConnection, project.equipment])

  return (
    <div className="flex h-screen flex-col bg-slate-900 text-slate-100">
      <MenuBar
        onNewProject={handleNewProject}
        onOpenProject={() => void openProject()}
        onSaveProject={() => void saveProject()}
        onSaveProjectAs={() => void saveProjectAs()}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenExportDialog={() => setExportDialogOpen(true)}
        onExportPdf={() => setPdfExportOpen(true)}
        onExportPng={() => void handleExportImage('png')}
        onExportJpeg={() => void handleExportImage('jpeg')}
        onOpenPrintDialog={() => setPrintDialogOpen(true)}
        onExportViewer={() => void handleExportViewer()}
        onImportAnnotations={() => void handleImportAnnotations()}
        onOpenGraphmlImport={() => setGraphmlImportOpen(true)}
        onAttachPdfToRentman={() => void handleUploadPdfToRentman()}
        onOpenRentmanCableExport={openRentmanCableExport}
        hasRentmanLink={Boolean(project.metadata.rentmanProjectId)}
        onEditProjectMeta={() => setMetaDialog({ mode: 'edit' })}
        onOpenCableBom={() => setCableBomOpen(true)}
        onOpenTour={() => setTourOpen(true)}
        videoFormat={project.metadata.defaultVideoFormat ?? DEFAULT_VIDEO_FORMAT}
        onChangeVideoFormat={(id) => useProjectStore.getState().setDefaultVideoFormat(id)}
        projectName={project.metadata.name}
        rentmanProjectName={project.metadata.rentmanProjectName}
        hasToken={hasToken}
      />

      <main
        className="grid min-h-0 flex-1 overflow-hidden"
        style={{
          // When a panel is floating, its grid column collapses to 0
          // (no chip, no splitter spacing) so the canvas reclaims the
          // space. The panel itself renders as an overlay via
          // FloatingPanelShell.
          gridTemplateColumns: `${
            libraryFloating ? '0px' : libraryCollapsed ? '32px' : `${libraryWidth}px`
          } ${libraryFloating ? '0px' : '4px'} 1fr ${
            propertiesFloating ? '0px' : '4px'
          } ${
            propertiesFloating ? '0px' : propertiesCollapsed ? '32px' : `${propertiesWidth}px`
          }`,
        }}
      >
        <LibraryPanel />
        <Splitter side="left" onResize={(delta) => setLibraryWidth(libraryWidth + delta)} />
        <div className="min-h-0 h-full w-full overflow-hidden">
          <CanvasArea />
        </div>
        <Splitter side="right" onResize={(delta) => setPropertiesWidth(propertiesWidth + delta)} />
        <PropertiesPanel />
      </main>

      <StatusBar
        projectName={project.metadata.name}
        zoom={project.canvasState.zoom}
        hasToken={hasToken}
        equipmentCount={project.equipment.length}
        cableCount={project.cables.length}
        locationCount={project.locations?.length ?? 0}
        packedCount={project.equipment.filter((e) => e.packed).length}
        rentmanProjectName={project.metadata.rentmanProjectName}
      />

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <RentmanImportDialog open={rentmanImport.open} onClose={closeRentmanImport} />
      <GraphmlImportDialog open={graphmlImportOpen} onClose={() => setGraphmlImportOpen(false)} />
      <RentmanCableExportDialog
        open={rentmanCableExport.open}
        onClose={closeRentmanCableExport}
      />
      <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />
      <WelcomeDialog
        open={welcomeOpen}
        onNew={() => setMetaDialog({ mode: 'new' })}
        onOpen={() => void openProject()}
        onClose={dismissWelcome}
      />
      {videohubExport.open && (
        <VideohubExportDialog
          onClose={closeVideohubExport}
          preselectedDeviceId={videohubExport.deviceId}
          initialShowMatrix={videohubExport.initialShowMatrix}
        />
      )}
      {greengoExport.open && (
        <GreenGoExportDialog onClose={closeGreenGoExport} />
      )}
      {atemDialog.open && (
        <AtemDialog onClose={closeAtemDialog} preselectedDeviceId={atemDialog.deviceId} />
      )}
      {atemMvLayout.open && <MultiviewerLayoutView onClose={closeAtemMvLayout} />}
      <AtemMvConfigDialog />
      <AtemAudioRouterDialog />
      <LocationBomDialog />
      <RackEditorDialog />
      <MobileShareDialog />
      <AboutDialog />
      <PatchListDialog />
      <CalculatorsDialog />
      <CableContextMenu />
      <AnnotationsPanelHost />
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExportPdf={(theme) => handleExportPdf(theme)}
        onPrintPdf={(theme) => handlePrintPdf(theme)}
        onExportImage={(format) => handleExportImage(format)}
      />

      <ProjectMetaDialog
        open={metaDialog !== null}
        mode={metaDialog?.mode ?? 'edit'}
        initial={project.metadata}
        onCancel={() => setMetaDialog(null)}
        onConfirm={(patch) => void handleMetaConfirm(patch)}
      />

      <CableBomDialog open={cableBomOpen} onClose={() => setCableBomOpen(false)} />

      <PrintDialog
        open={printDialogOpen}
        onClose={() => setPrintDialogOpen(false)}
      />

      <PdfExportDialog
        open={pdfExportOpen}
        theme={pdfTheme}
        onThemeChange={setPdfTheme}
        onClose={() => setPdfExportOpen(false)}
        onExport={() => {
          setPdfExportOpen(false)
          void handleExportPdf(pdfTheme)
        }}
      />

      {cableEdit.open && editCable && (
        <CableEditDialog
          cable={editCable}
          onSave={(patch) => updateCable(editCable.id, patch)}
          onClose={closeCableEdit}
        />
      )}

      {showCableDialog && (
        <CableDialog
          fromPort={fromPort}
          toPort={toPort}
          fromDev={fromDev}
          toDev={toDev}
          defaultVideoFormat={project.metadata.defaultVideoFormat}
          onCancel={closeCableDialog}
          onCreate={createCableWithPlanCheck}
        />
      )}
    </div>
  )
}

interface PdfExportDialogProps {
  open: boolean
  theme: 'dark' | 'light'
  onThemeChange: (theme: 'dark' | 'light') => void
  onClose: () => void
  onExport: () => void
}

const PdfExportDialog = ({
  open,
  theme,
  onThemeChange,
  onClose,
  onExport,
}: PdfExportDialogProps) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-2xl">
        <h2 className="mb-3 text-sm font-semibold text-slate-100">Plan als PDF exportieren</h2>
        <div className="space-y-3">
          <fieldset className="rounded border border-slate-700 p-3">
            <legend className="px-1 text-[11px] uppercase tracking-wide text-slate-400">
              Hintergrund
            </legend>
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-slate-200">
              <input
                type="radio"
                name="pdf-bg-theme"
                checked={theme === 'light'}
                onChange={() => onThemeChange('light')}
              />
              Hell
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-200">
              <input
                type="radio"
                name="pdf-bg-theme"
                checked={theme === 'dark'}
                onChange={() => onThemeChange('dark')}
              />
              Dunkel
            </label>
          </fieldset>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-700"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onExport}
            className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
          >
            PDF exportieren
          </button>
        </div>
      </div>
    </div>
  )
}

interface CableDialogProps {
  fromPort?: Port
  toPort?: Port
  fromDev?: EquipmentItem
  toDev?: EquipmentItem
  defaultVideoFormat?: VideoFormatId
  onCancel: () => void
  onCreate: (
    draft: Pick<Cable, 'name' | 'type' | 'length' | 'color' | 'notes'> &
      Partial<Pick<Cable, 'cableSpecId' | 'standard' | 'needsConverter'>>,
  ) => void
}

const cableTypeFromConnector = (c: ConnectorType | undefined): CableType => {
  if (!c) return 'Custom'
  if (c === 'DIN' || c === 'DisplayPort' || c === 'USB') return 'Custom'
  return c as CableType
}

const CUSTOM_CABLE_SPEC_ID = '__custom__'

const makeCustomCableSpec = (connectorType: ConnectorType, color: string): CableSpec => ({
  id: CUSTOM_CABLE_SPEC_ID,
  name: 'Custom Cable',
  connectorType,
  standards: ['Generic'],
  color,
  notes: 'Benutzerdefiniertes Kabel ohne Katalog-Preset.',
})

const CableDialog = ({ fromPort, toPort, fromDev, toDev, defaultVideoFormat, onCancel, onCreate }: CableDialogProps) => {
  // Issue #70: optional global override of connector-mismatch warnings.
  // When enabled, the dialog still SHOWS the warning banner so the user
  // sees what's happening, but the submit path skips the modal confirm
  // so the cable can be created in one click.
  const overrideWarnings = useUiStore((s) => s.overrideConnectionWarnings)
  // Combined catalog = built-ins + user-defined custom cable specs (issue #64).
  // The custom specs come from uiStore.customCableSpecs and persist in
  // localStorage so the user can recall them across sessions.
  const customCableSpecs = useUiStore((s) => s.customCableSpecs)
  const cableSpecOverrides = useUiStore((s) => s.cableSpecOverrides)
  const fullCableCatalog = useMemo(
    () => [
      ...cableCatalog.map((spec) => {
        const ov = cableSpecOverrides[spec.id]
        return ov ? { ...spec, ...ov, id: spec.id } : spec
      }),
      ...customCableSpecs,
    ],
    [customCableSpecs, cableSpecOverrides],
  )
  // v7.9.6 — Inline-Anlage neuer Stecker-/Signal-Typen aus dem Kabel-
  // Dialog. Bisher waren die Dropdowns auf ALL_CONNECTOR_TYPES /
  // ALL_SIGNAL_STANDARDS festgenagelt; jetzt zeigen sie zusätzlich die
  // in uiStore.customConnectorTypes / customSignalStandards bereits
  // angelegten Custom-Werte und bieten einen "+ Neuer…"-Eintrag, der
  // den Wert via Prompt anlegt und sofort persistiert.
  const customConnectorTypes = useUiStore((s) => s.customConnectorTypes)
  const customSignalStandards = useUiStore((s) => s.customSignalStandards)
  const allConnectorOptions = useMemo(
    () =>
      [
        ...ALL_CONNECTOR_TYPES,
        ...customConnectorTypes.filter((c) => !ALL_CONNECTOR_TYPES.includes(c as ConnectorType)),
      ] as ConnectorType[],
    [customConnectorTypes],
  )
  const allStandardOptions = useMemo(
    () =>
      [
        ...ALL_SIGNAL_STANDARDS,
        ...customSignalStandards.filter((s) => !ALL_SIGNAL_STANDARDS.includes(s as SignalStandard)),
      ] as SignalStandard[],
    [customSignalStandards],
  )
  // Build list of cables ranked by compatibility with the two ports.
  const ranked = useMemo((): Array<{ cable: CableSpec; level: 'ok' | 'warn' | 'error'; message: string }> => {
    if (!fromPort || !toPort) {
      return fullCableCatalog.map((cable) => ({ cable, level: 'ok' as const, message: '' }))
    }
    return fullCableCatalog
      .map((cable) => ({
        cable,
        ...checkCableCompatibility(fromPort.connectorType, toPort.connectorType, cable),
      }))
      .sort((a, b) => {
        const order = { ok: 0, warn: 1, error: 2 }
        return order[a.level] - order[b.level]
      })
  }, [fromPort, toPort, fullCableCatalog])

  // For SDI↔SDI connections, pick the cable that matches the project's default
  // video format (or 1080p50 fallback) and the two devices' SDI capabilities.
  // When no catalog entry fits the connectors, fall back to the Custom Cable
  // preset so the resulting cable inherits the start port's connector type
  // instead of landing on the first (unrelated) cable in the catalog.
  const initialSpecId = useMemo(() => {
    const firstUsable = ranked.find((item) => item.level !== 'error')
    if (!firstUsable) return CUSTOM_CABLE_SPEC_ID
    if (!fromPort || !toPort) return firstUsable.cable.id
    const sdiConnectors = new Set<ConnectorType>(['BNC'])
    const bothSdi =
      sdiConnectors.has(fromPort.connectorType) && sdiConnectors.has(toPort.connectorType)
    if (!bothSdi) return firstUsable.cable.id
    const format = videoFormatById(defaultVideoFormat ?? DEFAULT_VIDEO_FORMAT)
    if (!format) return firstUsable.cable.id
    const target = pickCableStandardForFormat(format, fromDev?.sdiCaps, toDev?.sdiCaps)
    const match = ranked.find(
      (item) => item.level !== 'error' && item.cable.standards.includes(target),
    )
    return match?.cable.id ?? firstUsable.cable.id
  }, [ranked, fromPort, toPort, fromDev, toDev, defaultVideoFormat])

  // Default the Custom Cable's connector to the START port's type so the cable
  // type inherits from the start connector when the user keeps the Custom preset.
  const inferredConnector: ConnectorType =
    fromPort?.connectorType ?? toPort?.connectorType ?? 'Custom'

  const [specId, setSpecId] = useState<string>(initialSpecId)
  const [customConnectorType, setCustomConnectorType] = useState<ConnectorType>(inferredConnector)
  const [customStandard, setCustomStandard] = useState<SignalStandard>('Generic')
  const [customMaxLength, setCustomMaxLength] = useState<number | ''>('')
  const selectedEntry = specId === CUSTOM_CABLE_SPEC_ID
    ? { cable: makeCustomCableSpec(customConnectorType, '#64748b'), level: 'ok' as const, message: '' }
    : (ranked.find((item) => item.cable.id === specId) ?? ranked[0])
  const selected: CableSpec = selectedEntry.cable

  const defaultStandard = specId === CUSTOM_CABLE_SPEC_ID
    ? customStandard
    : pickHighestSdiStandard(selected.standards)
  const [standard, setStandard] = useState<SignalStandard | undefined>(defaultStandard)
  const [length, setLength] = useState(1)
  const [name, setName] = useState(selected.name)
  const [color, setColor] = useState(selected.color)
  const [notes, setNotes] = useState(selected.notes ?? '')

  // Keep derived fields aligned when the user changes the spec.
  const onSelectSpec = (id: string) => {
    setSpecId(id)
    if (id === CUSTOM_CABLE_SPEC_ID) {
      setColor('#64748b')
      setNotes('')
      setStandard(customStandard)
      // Do NOT reset `name` here — keep whatever the user typed (or the
      // previous spec name) so a mid-dialog spec switch doesn't wipe out
      // the user's custom name. (Bug #13)
      return
    }
    const spec = fullCableCatalog.find((c) => c.id === id)
    if (!spec) return
    setName(spec.name)
    setColor(spec.color)
    setNotes(spec.notes ?? '')
    setStandard(pickHighestSdiStandard(spec.standards))
  }

  const sdiMismatch = useMemo(() => {
    if (!fromPort || !toPort) return null
    if (!standard) return null
    // If user picked a specific SDI speed as the cable standard, check that both
    // ports' declared standards (if any) match or note a converter is needed.
    return checkSdiStandardMismatch(fromPort.standard ?? standard, toPort.standard ?? standard)
  }, [fromPort, toPort, standard])

  const connectorMismatch: 'ok' | 'warn' | 'error' =
    specId === CUSTOM_CABLE_SPEC_ID ? 'ok' : selectedEntry.level
  const connectorMessage = specId === CUSTOM_CABLE_SPEC_ID ? '' : selectedEntry.message

  const needsConverter =
    connectorMismatch === 'warn' || sdiMismatch?.level === 'warn' || connectorMismatch === 'error'

  const effectiveMaxLength = specId === CUSTOM_CABLE_SPEC_ID ? customMaxLength : selected.maxLengthMeters

  const lengthWarning =
    effectiveMaxLength && length > effectiveMaxLength
      ? `Length exceeds recommended maximum of ${effectiveMaxLength} m for ${selected.name}.`
      : null

  const submit = async () => {
    if (connectorMismatch === 'error' && !overrideWarnings) {
      const proceed = await confirmDialog('Stecker-Kompatibilität', {
        body: `${connectorMessage}\n\nVerbindung trotzdem anlegen (markiert als "braucht Konverter")?`,
        okLabel: 'Trotzdem anlegen',
        destructive: true,
      })
      if (!proceed) {
        return
      }
    }
    onCreate({
      name,
      type: cableTypeFromConnector(specId === CUSTOM_CABLE_SPEC_ID ? customConnectorType : selected.connectorType),
      length,
      color,
      notes,
      cableSpecId: specId === CUSTOM_CABLE_SPEC_ID ? undefined : selected.id,
      standard: specId === CUSTOM_CABLE_SPEC_ID ? customStandard : standard,
      // `needsConverter` already covers warn-level and error-level mismatch
      // (see definition above), so no extra fall-through check needed.
      needsConverter,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-lg rounded border border-slate-700 bg-slate-900 p-4 text-slate-100">
        <h3 className="mb-2 text-lg font-semibold">Create Cable</h3>

        {fromPort && toPort && (
          <div className="mb-3 rounded bg-slate-950 p-2 text-xs">
            <div>
              From: <span className="font-medium">{fromPort.name}</span> ({fromPort.connectorType}
              {fromPort.standard ? `, ${fromPort.standard}` : ''})
            </div>
            <div>
              To: <span className="font-medium">{toPort.name}</span> ({toPort.connectorType}
              {toPort.standard ? `, ${toPort.standard}` : ''})
            </div>
          </div>
        )}

        <div className="space-y-2 text-sm">
          <label className="block">
            Cable
            <select
              value={specId}
              onChange={(e) => onSelectSpec(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            >
              <option value={CUSTOM_CABLE_SPEC_ID}>★ Custom Cable…</option>
              {ranked.map(({ cable, level }) => {
                const icon = level === 'ok' ? '✓' : level === 'warn' ? '⚠' : '✕'
                return (
                  <option key={cable.id} value={cable.id}>
                    {icon} {cable.name} ({cable.connectorType})
                  </option>
                )
              })}
            </select>
          </label>

          {specId === CUSTOM_CABLE_SPEC_ID && (
            <div className="rounded border border-slate-700 bg-slate-950/60 p-2">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Custom Cable Definition
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  Connector Type
                  <select
                    value={customConnectorType}
                    onChange={async (e) => {
                      const v = e.target.value
                      if (v === '__new__') {
                        const name = (await promptDialog('Neuer Stecker-Typ (z.B. "Speakon NL4"):'))?.trim()
                        if (name) {
                          useUiStore.getState().addCustomConnectorType(name)
                          setCustomConnectorType(name as ConnectorType)
                        }
                        return
                      }
                      setCustomConnectorType(v as ConnectorType)
                    }}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
                  >
                    {allConnectorOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                        {customConnectorTypes.includes(type as string) ? ' (custom)' : ''}
                      </option>
                    ))}
                    <option value="__new__">+ Neuer Stecker-Typ…</option>
                  </select>
                </label>
                <label className="block">
                  Signal Standard
                  <select
                    value={customStandard}
                    onChange={async (e) => {
                      const v = e.target.value
                      if (v === '__new__') {
                        const name = (await promptDialog('Neuer Signal-Standard (z.B. "Madi 64ch"):'))?.trim()
                        if (name) {
                          useUiStore.getState().addCustomSignalStandard(name)
                          setCustomStandard(name as SignalStandard)
                          setStandard(name as SignalStandard)
                        }
                        return
                      }
                      const next = v as SignalStandard
                      setCustomStandard(next)
                      setStandard(next)
                    }}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
                  >
                    {allStandardOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                        {customSignalStandards.includes(item as string) ? ' (custom)' : ''}
                      </option>
                    ))}
                    <option value="__new__">+ Neuer Signal-Standard…</option>
                  </select>
                </label>
              </div>
              <label className="mt-2 block">
                Recommended Max Length (m)
                <input
                  type="number"
                  min={0}
                  value={customMaxLength}
                  onChange={(e) => setCustomMaxLength(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Optional"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
                />
              </label>
              <button
                type="button"
                onClick={async () => {
                  // Issue #64: persist the current Custom Cable as a
                  // reusable type. We prompt for a name (defaulting to
                  // the user's current `name`) and save the spec; the
                  // dialog then switches to the new spec so the user
                  // can see it landed in the dropdown.
                  const proposedName = name.trim() || `${customConnectorType} Custom`
                  const finalName = (await promptDialog(
                    'Name für den neuen Kabel-Typ:',
                    proposedName,
                  ))?.trim()
                  if (!finalName) return
                  const created = useUiStore.getState().addCustomCableSpec({
                    name: finalName,
                    connectorType: customConnectorType,
                    standards: [customStandard],
                    color,
                    maxLengthMeters: typeof customMaxLength === 'number' ? customMaxLength : undefined,
                    notes: notes || undefined,
                  })
                  setSpecId(created.id)
                  setName(created.name)
                }}
                className="mt-2 w-full rounded bg-sky-700 px-2 py-1 text-xs font-medium text-white hover:bg-sky-600"
                title="Speichert diese Custom-Definition als wiederverwendbaren Kabeltyp in der Bibliothek."
              >
                💾 Als Kabel-Typ speichern…
              </button>
            </div>
          )}

          {selected.standards.length > 1 && (
            <label className="block">
              Signal Standard
              <select
                value={standard ?? ''}
                onChange={(e) => setStandard(e.target.value as SignalStandard)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
              >
                {selected.standards.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              Length (m)
              <input
                type="number"
                min={0}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
              />
            </label>
            <label className="block">
              Color
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="mt-1 h-10 w-full rounded border border-slate-700 bg-slate-950 p-1"
              />
            </label>
          </div>

          <label className="block">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
              rows={2}
            />
          </label>
        </div>

        {/* Status/warning area */}
        <div className="mt-3 space-y-1 text-xs">
          {connectorMismatch === 'error' && (
            <div className="rounded bg-red-900/50 p-2 text-red-100">✕ {connectorMessage}</div>
          )}
          {connectorMismatch === 'warn' && (
            <div className="rounded bg-amber-900/50 p-2 text-amber-100">⚠ {connectorMessage}</div>
          )}
          {connectorMismatch === 'ok' && connectorMessage && (
            <div className="rounded bg-emerald-900/40 p-2 text-emerald-100">✓ {connectorMessage}</div>
          )}
          {sdiMismatch?.level === 'warn' && (
            <div className="rounded bg-amber-900/50 p-2 text-amber-100">⚠ {sdiMismatch.message}</div>
          )}
          {lengthWarning && (
            <div className="rounded bg-amber-900/50 p-2 text-amber-100">⚠ {lengthWarning}</div>
          )}
        </div>

        <div className="mt-3 flex justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded bg-emerald-600 px-3 py-1 hover:bg-emerald-500"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

interface CableEditDialogProps {
  cable: Cable
  onSave: (patch: Partial<Cable>) => void
  onClose: () => void
}

const CableEditDialog = ({ cable, onClose, onSave }: CableEditDialogProps) => {
  const equipment = useProjectStore((state) => state.project.equipment)
  const cables = useProjectStore((state) => state.project.cables)
  // Issue #64: include user-defined custom cable specs in the dropdown
  // so editing a cable that uses a custom type doesn't lose the
  // reference. Built-ins + custom share the same shape.
  const customCableSpecs = useUiStore((s) => s.customCableSpecs)
  const cableSpecOverrides = useUiStore((s) => s.cableSpecOverrides)
  const fullCableCatalog = useMemo(
    () => [
      ...cableCatalog.map((spec) => {
        const ov = cableSpecOverrides[spec.id]
        return ov ? { ...spec, ...ov, id: spec.id } : spec
      }),
      ...customCableSpecs,
    ],
    [customCableSpecs, cableSpecOverrides],
  )
  const customConnectorTypes = useUiStore((s) => s.customConnectorTypes)
  const customSignalStandards = useUiStore((s) => s.customSignalStandards)
  const allConnectorOptions = useMemo(
    () =>
      [
        ...ALL_CONNECTOR_TYPES,
        ...customConnectorTypes.filter((c) => !ALL_CONNECTOR_TYPES.includes(c as ConnectorType)),
      ] as ConnectorType[],
    [customConnectorTypes],
  )
  const allStandardOptions = useMemo(
    () =>
      [
        ...ALL_SIGNAL_STANDARDS,
        ...customSignalStandards.filter((s) => !ALL_SIGNAL_STANDARDS.includes(s as SignalStandard)),
      ] as SignalStandard[],
    [customSignalStandards],
  )

  const initialCustomConnectorType: ConnectorType =
    cable.type === 'Custom' ? 'Custom' : (cable.type as ConnectorType)
  const [specId, setSpecId] = useState<string>(cable.cableSpecId ?? CUSTOM_CABLE_SPEC_ID)
  const [customConnectorType, setCustomConnectorType] = useState<ConnectorType>(initialCustomConnectorType)
  const [customStandard, setCustomStandard] = useState<SignalStandard>(cable.standard ?? 'Generic')
  const selected: CableSpec = specId === CUSTOM_CABLE_SPEC_ID
    ? makeCustomCableSpec(customConnectorType, cable.color)
    : (fullCableCatalog.find((c) => c.id === specId) ?? fullCableCatalog[0])
  const [standard, setStandard] = useState<SignalStandard | undefined>(
    cable.standard ?? (specId === CUSTOM_CABLE_SPEC_ID ? customStandard : pickHighestSdiStandard(selected.standards)),
  )
  const [length, setLength] = useState(cable.length)
  const [name, setName] = useState(cable.name)
  const [color, setColor] = useState(cable.color)
  const [notes, setNotes] = useState(cable.notes ?? '')

  // Endpoint editing state — initialized from the cable, mutable via dropdowns.
  const [fromEquipmentId, setFromEquipmentId] = useState<string>(cable.fromEquipmentId)
  const [fromPortId, setFromPortId] = useState<string>(cable.fromPortId)
  const [toEquipmentId, setToEquipmentId] = useState<string>(cable.toEquipmentId)
  const [toPortId, setToPortId] = useState<string>(cable.toPortId)

  // Look up devices + ports. We search inputs+outputs because connectionMode
  // is Loose and a cable can attach to either side regardless of direction.
  const portsOf = (eq?: EquipmentItem): (Port & { _side: 'in' | 'out' })[] => {
    if (!eq) return []
    const ins = (eq.inputs ?? []).map((p) => ({ ...p, _side: 'in' as const }))
    const outs = (eq.outputs ?? []).map((p) => ({ ...p, _side: 'out' as const }))
    return [...outs, ...ins]
  }
  const findPort = (eqId: string, portId: string): Port | undefined => {
    const eq = equipment.find((e) => e.id === eqId)
    return eq?.outputs.find((p) => p.id === portId) ?? eq?.inputs.find((p) => p.id === portId)
  }

  const fromDev = equipment.find((e) => e.id === fromEquipmentId)
  const toDev = equipment.find((e) => e.id === toEquipmentId)
  const fromPort = findPort(fromEquipmentId, fromPortId)
  const toPort = findPort(toEquipmentId, toPortId)

  // Detect whether the chosen ports are already in use by *another* cable.
  // Each port should only be used by one cable; a cable can legitimately keep
  // its own existing endpoint, so we exclude this cable's id.
  const portConflict = (eqId: string, portId: string): Cable | undefined => {
    if (!eqId || !portId) return undefined
    return cables.find(
      (c) =>
        c.id !== cable.id &&
        ((c.fromEquipmentId === eqId && c.fromPortId === portId) ||
          (c.toEquipmentId === eqId && c.toPortId === portId)),
    )
  }
  const fromConflict = portConflict(fromEquipmentId, fromPortId)
  const toConflict = portConflict(toEquipmentId, toPortId)
  const sameEndpoints =
    fromEquipmentId &&
    toEquipmentId &&
    fromEquipmentId === toEquipmentId &&
    fromPortId === toPortId

  const onSelectSpec = (id: string) => {
    setSpecId(id)
    if (id === CUSTOM_CABLE_SPEC_ID) {
      setStandard(customStandard)
      return
    }
    const spec = fullCableCatalog.find((c) => c.id === id)
    if (!spec) return
    setStandard(pickHighestSdiStandard(spec.standards))
  }

  // When the user picks a different device, default the port to the first
  // available one so the dialog never shows an inconsistent state.
  const onSelectFromEquipment = (id: string) => {
    setFromEquipmentId(id)
    const eq = equipment.find((e) => e.id === id)
    const first = eq?.outputs[0]?.id ?? eq?.inputs[0]?.id ?? ''
    setFromPortId(first)
  }
  const onSelectToEquipment = (id: string) => {
    setToEquipmentId(id)
    const eq = equipment.find((e) => e.id === id)
    const first = eq?.inputs[0]?.id ?? eq?.outputs[0]?.id ?? ''
    setToPortId(first)
  }

  const lengthWarning =
    selected.maxLengthMeters && length > selected.maxLengthMeters
      ? `Länge überschreitet empfohlenes Maximum von ${selected.maxLengthMeters} m für ${selected.name}.`
      : null

  const submit = () => {
    onSave({
      name,
      length,
      color,
      notes,
      cableSpecId: specId === CUSTOM_CABLE_SPEC_ID ? undefined : selected.id,
      type: cableTypeFromConnector(specId === CUSTOM_CABLE_SPEC_ID ? customConnectorType : selected.connectorType),
      standard: specId === CUSTOM_CABLE_SPEC_ID ? customStandard : standard,
      fromEquipmentId,
      fromPortId,
      toEquipmentId,
      toPortId,
    })
    onClose()
  }

  const sortedEquipment = useMemo(
    () => [...equipment].sort((a, b) => a.name.localeCompare(b.name)),
    [equipment],
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded border border-slate-700 bg-slate-900 p-4 text-slate-100">
        <h3 className="mb-2 text-lg font-semibold">Kabel bearbeiten</h3>

        <div className="space-y-2 text-sm">
          <label className="block">
            Kabeltyp
            <select
              value={specId}
              onChange={(e) => onSelectSpec(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            >
              <option value={CUSTOM_CABLE_SPEC_ID}>★ Custom Cable…</option>
              {fullCableCatalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.connectorType})
                </option>
              ))}
            </select>
          </label>

          {specId === CUSTOM_CABLE_SPEC_ID && (
            <div className="grid grid-cols-2 gap-2 rounded border border-slate-700 bg-slate-950/60 p-2">
              <label className="block">
                Connector Type
                <select
                  value={customConnectorType}
                  onChange={async (e) => {
                    const v = e.target.value
                    if (v === '__new__') {
                      const name = (await promptDialog('Neuer Stecker-Typ (z.B. "Speakon NL4"):'))?.trim()
                      if (name) {
                        useUiStore.getState().addCustomConnectorType(name)
                        setCustomConnectorType(name as ConnectorType)
                      }
                      return
                    }
                    setCustomConnectorType(v as ConnectorType)
                  }}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
                >
                  {allConnectorOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                      {customConnectorTypes.includes(type as string) ? ' (custom)' : ''}
                    </option>
                  ))}
                  <option value="__new__">+ Neuer Stecker-Typ…</option>
                </select>
              </label>
              <label className="block">
                Signalstandard
                <select
                  value={customStandard}
                  onChange={async (e) => {
                    const v = e.target.value
                    if (v === '__new__') {
                      const name = (await promptDialog('Neuer Signal-Standard (z.B. "Madi 64ch"):'))?.trim()
                      if (name) {
                        useUiStore.getState().addCustomSignalStandard(name)
                        setCustomStandard(name as SignalStandard)
                        setStandard(name as SignalStandard)
                      }
                      return
                    }
                    const next = v as SignalStandard
                    setCustomStandard(next)
                    setStandard(next)
                  }}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
                >
                  {allStandardOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                      {customSignalStandards.includes(item as string) ? ' (custom)' : ''}
                    </option>
                  ))}
                  <option value="__new__">+ Neuer Signal-Standard…</option>
                </select>
              </label>
            </div>
          )}

          {selected.standards.length > 1 && (
            <label className="block">
              Signalstandard
              <select
                value={standard ?? ''}
                onChange={(e) => setStandard(e.target.value as SignalStandard)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
              >
                {selected.standards.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              Länge (m)
              <input
                type="number"
                min={0}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
              />
            </label>
            <label className="block">
              Farbe
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="mt-1 h-10 w-full rounded border border-slate-700 bg-slate-950 p-1"
              />
            </label>
          </div>

          {/* Endpoint editor as collapsible accordion below color. Compact
              summary always visible (current routing); expand to change
              device/port on either side. */}
          <details open className="rounded border border-slate-700 bg-slate-950/50">
            <summary className="cursor-pointer select-none px-2 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800/40">
              <span className="font-semibold uppercase tracking-wide text-slate-400">Verbindung</span>
              <span className="ml-2 text-slate-300">
                {fromDev?.name ?? '?'} · {fromPort?.name ?? cable.fromPortId}
                <span className="mx-1 text-slate-500">→</span>
                {toDev?.name ?? '?'} · {toPort?.name ?? cable.toPortId}
              </span>
            </summary>
            <div className="border-t border-slate-700 p-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-0.5 text-[10px] text-slate-500">Von Gerät</div>
                  <select
                    aria-label="Quell-Gerät"
                    value={fromEquipmentId}
                    onChange={(e) => onSelectFromEquipment(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-950 p-1.5 text-xs"
                  >
                    {sortedEquipment.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[10px] text-slate-500">Port</div>
                  <select
                    aria-label="Quell-Port"
                    value={fromPortId}
                    onChange={(e) => setFromPortId(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-950 p-1.5 text-xs"
                  >
                    {portsOf(fromDev).map((p) => {
                      const inUse = !!portConflict(fromEquipmentId, p.id)
                      return (
                        <option key={p.id} value={p.id}>
                          {p._side === 'out' ? '⇢ ' : '⇠ '}
                          {p.name} ({p.connectorType}){inUse ? ' • belegt' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
                <div>
                  <div className="mb-0.5 text-[10px] text-slate-500">Nach Gerät</div>
                  <select
                    aria-label="Ziel-Gerät"
                    value={toEquipmentId}
                    onChange={(e) => onSelectToEquipment(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-950 p-1.5 text-xs"
                  >
                    {sortedEquipment.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[10px] text-slate-500">Port</div>
                  <select
                    aria-label="Ziel-Port"
                    value={toPortId}
                    onChange={(e) => setToPortId(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-950 p-1.5 text-xs"
                  >
                    {portsOf(toDev).map((p) => {
                      const inUse = !!portConflict(toEquipmentId, p.id)
                      return (
                        <option key={p.id} value={p.id}>
                          {p._side === 'out' ? '⇢ ' : '⇠ '}
                          {p.name} ({p.connectorType}){inUse ? ' • belegt' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>

              {fromConflict && (
                <div className="mt-2 rounded bg-amber-900/50 px-2 py-1 text-[11px] text-amber-100">
                  ⚠ Quell-Port ist bereits durch Kabel „{fromConflict.name}" belegt.
                </div>
              )}
              {toConflict && (
                <div className="mt-1 rounded bg-amber-900/50 px-2 py-1 text-[11px] text-amber-100">
                  ⚠ Ziel-Port ist bereits durch Kabel „{toConflict.name}" belegt.
                </div>
              )}
              {sameEndpoints && (
                <div className="mt-1 rounded bg-red-900/50 px-2 py-1 text-[11px] text-red-100">
                  ⚠ Quelle und Ziel zeigen auf denselben Port.
                </div>
              )}
            </div>
          </details>

          <label className="block">
            Notizen
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
              rows={2}
            />
          </label>
        </div>

        {lengthWarning && (
          <div className="mt-3 rounded bg-amber-900/50 p-2 text-xs text-amber-100">⚠ {lengthWarning}</div>
        )}

        <div className="mt-3 flex justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!!sameEndpoints}
            className="rounded bg-emerald-600 px-3 py-1 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  )
}
