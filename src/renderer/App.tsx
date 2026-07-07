import { useEffect, useMemo, useRef, useState } from 'react'
import { useIsNarrow } from './hooks/useBreakpoint'
import { CanvasArea } from './components/Canvas/CanvasArea'
import { CableDialog } from './components/Cable/CableDialog'
import { CUSTOM_CABLE_SPEC_ID, makeCustomCableSpec } from './components/Cable/customCableSpec'
import { getEquipmentById } from './lib/equipmentSelectors'
import { LibraryPanel } from './components/Library/LibraryPanel'
import { MenuBar } from './components/Layout/MenuBar'
import { StatusBar } from './components/Layout/StatusBar'
import { PropertiesPanel } from './components/Properties/PropertiesPanel'
import { RentmanImportDialog } from './components/Rentman/RentmanImportDialog'
import { GraphmlImportDialog } from './components/Import/GraphmlImportDialog'
import { RentmanCableExportDialog } from './components/Rentman/RentmanCableExportDialog'
import { OnboardingTour } from './components/Onboarding/OnboardingTour'
import { hasSeenTour } from './components/Onboarding/onboardingState'
import { SettingsDialog } from './components/Settings/SettingsDialog'
import { VideohubExportDialog } from './components/Export/VideohubExportDialog'
import { GreenGoExportDialog } from './components/Export/GreenGoExportDialog'
import { AtemDialog } from './components/Atem/AtemDialog'
import { MultiviewerLayoutView } from './components/Atem/MultiviewerLayoutView'
import { AtemMvConfigDialog } from './components/Atem/AtemMvConfigDialog'
import { AtemAudioRouterDialog } from './components/Atem/AtemAudioRouterDialog'
import { DrumMicingDialog } from './components/DrumMicing/DrumMicingDialog'
import { WirelessRigDialog } from './components/Wireless/WirelessRigDialog'
import { LocationBomDialog } from './components/Project/LocationBomDialog'
import { RackEditorDialog } from './components/Rack/RackEditorDialog'
import { CableContextMenu } from './components/Canvas/CableContextMenu'
import { LayerVisibilityChips } from './components/Canvas/LayerVisibilityChips'
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
import { InstallationDocsDialog } from './components/Export/InstallationDocsDialog'
import { ModuleOnboardingDialog } from './components/Onboarding/ModuleOnboardingDialog'
import { BandwidthCalculatorDialog, PowerCalculatorDialog } from './components/Calculators/CalculatorsDialog'
import { RecordingStorageCalculatorDialog } from './components/Calculators/RecordingStorageCalculatorDialog'
import { ProjectionCalculatorDialog } from './components/Calculators/ProjectionCalculatorDialog'
import { BulkConnectDialog } from './components/Canvas/BulkConnectDialog'
import { AnalysisDialog } from './components/Analysis/AnalysisDialog'
import { PlanCheckPanel } from './components/Analysis/PlanCheckPanel'
import { InventoryDialog } from './components/Inventory/InventoryDialog'
import { ShortcutsHelp } from './components/Layout/ShortcutsHelp'
import { CommandPalette } from './components/Layout/CommandPalette'
import { RevisionsDialog } from './components/Project/RevisionsDialog'
import { AiPlanGenDialog } from './components/Project/AiPlanGenDialog'
import { CsvImportDialog } from './components/Import/CsvImportDialog'
import { TemplatesDialog } from './components/Project/TemplatesDialog'
import { ProjectMetaDialog } from './components/Project/ProjectMetaDialog'
import { CableBomDialog } from './components/Project/CableBomDialog'
import { WelcomeDialog } from './components/Project/WelcomeDialog'
import { Splitter } from './components/Layout/Splitter'
import { useProject } from './hooks/useProject'
import { useRentman } from './hooks/useRentman'
import { cablePlannerApi, hasDesktopBridge } from './lib/bridge'
import { exportCanvasToPdf, exportCanvasToPdfBytes } from './lib/exportPdf'
import { exportCanvasToPdfVector } from './lib/exportPdfVector'
import { printPdfBlob } from './lib/printPdfBlob'
import { exportCanvasToImage } from './lib/exportImage'
import { exportProjectToDxf } from './lib/exportDxf'
import { downloadBlob } from './lib/downloadBlob'
import { buildExportFilename } from './lib/exportFilename'
import { connectorToCableType } from './lib/cableInheritance'
import { routeCable } from './lib/canvasViewport'
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
import { useCollabStore } from './store/collabStore'
import { useHotkeys } from './lib/hotkeys'
import type { Cable } from './types/cable'
import { ALL_CONNECTOR_TYPES } from './types/equipment'
import type { ConnectorType, EquipmentItem, Port } from './types/equipment'
import type { ProjectMetadata } from './types/project'
import {
  ALL_SIGNAL_STANDARDS,
  cableCatalog,
  pickHighestSdiStandard,
  type CableSpec,
  type SignalStandard,
} from './types/cableSpec'
import { confirmDialog } from './lib/confirmDialog'
import { consumeInviteFromUrl } from './lib/collabInvite'
import { promptDialog } from './lib/promptDialog'
import { infoDialog } from './lib/infoDialog'
import { AlertTriangle } from 'lucide-react'
import { useTranslation, format } from './lib/i18n'
import { Icon } from './components/shared/Icon'

export default function App() {
  const t = useTranslation()
  const project = useProjectStore((state) => state.project)
  const inventoryOpen = useUiStore((state) => state.inventory.open)
  const canvasTheme = useUiStore((state) => state.canvasTheme)
  const followSystemTheme = useUiStore((state) => state.followSystemTheme)
  const setCanvasTheme = useUiStore((state) => state.setCanvasTheme)
  const language = useUiStore((state) => state.language)
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
  // #294 — Port-Konflikt-Dialog.
  const portConflict = useProjectStore((state) => state.portConflict)
  const resolvePortConflictByReplace = useProjectStore((state) => state.resolvePortConflictByReplace)
  const cancelPortConflict = useProjectStore((state) => state.cancelPortConflict)
  const hasToken = useSettingsStore((state) => state.hasToken)
  const setHasToken = useSettingsStore((state) => state.setHasToken)
  const propertiesCollapsed = useUiStore((state) => state.propertiesCollapsed)
  const libraryCollapsed = useUiStore((state) => state.libraryCollapsed)
  const libraryFloating = useUiStore((state) => state.libraryFloating)
  const propertiesFloating = useUiStore((state) => state.propertiesFloating)
  // #427 — Panels in separates OS-Fenster ausgelagert → Spalte verschwindet.
  const libraryPoppedOut = useUiStore((state) => state.libraryPoppedOut)
  const propertiesPoppedOut = useUiStore((state) => state.propertiesPoppedOut)
  const libraryHidden = libraryFloating || libraryPoppedOut
  const propertiesHidden = propertiesFloating || propertiesPoppedOut
  const libraryWidth = useUiStore((state) => state.libraryWidth)
  const propertiesWidth = useUiStore((state) => state.propertiesWidth)
  const setLibraryWidth = useUiStore((state) => state.setLibraryWidth)
  const setPropertiesWidth = useUiStore((state) => state.setPropertiesWidth)
  const setLibraryCollapsed = useUiStore((state) => state.setLibraryCollapsed)
  const setPropertiesCollapsed = useUiStore((state) => state.setPropertiesCollapsed)
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
  const {
    newProject,
    openProject,
    openLaunchFile,
    applyOpenedProject,
    saveProject,
    saveProjectAs,
    refreshRecent,
  } = useProject()
  const settingsOpen = useUiStore((s) => s.settingsOpen)
  const settingsSection = useUiStore((s) => s.settingsSection)
  const setSettingsOpen = (open: boolean) =>
    open ? useUiStore.getState().openSettings() : useUiStore.getState().closeSettings()
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
  // v7.9.97 — Beta-Option: Vektor-PDF statt Raster. Aus per Default,
  // damit alle bestehenden Workflows unveraendert weiterlaufen.
  const [pdfVectorMode, setPdfVectorMode] = useState(false)
  // v7.9.0 / Issue #110 — unified export dialog
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [graphmlImportOpen, setGraphmlImportOpen] = useState(false)
  const pdfExportThemeOverride = useUiStore((state) => state.pdfExportThemeOverride)
  const setPdfExportThemeOverride = useUiStore((state) => state.setPdfExportThemeOverride)
  // v7.9.62 — Progress-State für die PDF-Export-Phasen damit der User
  // sieht dass der Export läuft (war vorher silent → wirkte "ewig hängend").
  const [pdfProgress, setPdfProgress] = useState<{
    active: boolean
    phase?: string
    detail?: string
  }>({ active: false })

  useEffect(() => {
    document.documentElement.dataset.theme = pdfExportThemeOverride ?? canvasTheme
  }, [canvasTheme, pdfExportThemeOverride])

  // #516 — Per Einladungs-Link geöffnet (…#join=…)? Raum/Modus/Signaling/
  // Passwort vorbefüllen und nach Rückfrage der Session beitreten (Host-Plan
  // übernehmen). Läuft genau einmal (consumeInviteFromUrl ist idempotent).
  useEffect(() => {
    const invite = consumeInviteFromUrl()
    if (!invite) return
    void (async () => {
      const c = useCollabStore.getState()
      c.setMode(invite.mode)
      c.setRoom(invite.room)
      if (invite.signaling !== undefined) c.setSignaling(invite.signaling)
      if (invite.password !== undefined) c.setPassword(invite.password)
      const ok = await confirmDialog(
        format(
          t(
            'collab.invite.joinConfirm',
            'Zur Live-Session „{room}" beitreten? Dein aktueller Plan wird durch den des Hosts ersetzt.',
          ),
          { room: invite.host ? `${invite.room} · ${invite.host}` : invite.room },
        ),
        { okLabel: t('collab.discover.join', 'Beitreten') },
      )
      if (!ok) return
      await useCollabStore.getState().start({ adopt: true })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // #453 — optional dem OS-Theme folgen (prefers-color-scheme). Wenn aktiv,
  // spiegelt canvasTheme die Systemeinstellung und reagiert live auf Wechsel.
  useEffect(() => {
    if (!followSystemTheme) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => setCanvasTheme(mq.matches ? 'dark' : 'light')
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [followSystemTheme, setCanvasTheme])

  // #444 — Seiten-Panels auf schmalen Fenstern (< lg / 1024px) automatisch
  // einklappen. Reagiert NUR auf das Überschreiten der Schwelle (nicht
  // laufend), damit der manuelle Ein-/Ausklapp-Button im schmalen Modus
  // weiter funktioniert. Beim Verbreitern klappen wir nur das wieder aus,
  // was wir selbst eingeklappt haben — vom User manuell Eingeklapptes
  // bleibt unangetastet. Floating-Panels sind nie betroffen.
  const isNarrow = useIsNarrow()
  const prevNarrowRef = useRef(isNarrow)
  const autoCollapsedRef = useRef({ library: false, properties: false })
  useEffect(() => {
    if (isNarrow === prevNarrowRef.current) return
    prevNarrowRef.current = isNarrow
    if (isNarrow) {
      if (!libraryCollapsed && !libraryFloating) {
        autoCollapsedRef.current.library = true
        setLibraryCollapsed(true)
      }
      if (!propertiesCollapsed && !propertiesFloating) {
        autoCollapsedRef.current.properties = true
        setPropertiesCollapsed(true)
      }
    } else {
      if (autoCollapsedRef.current.library) {
        autoCollapsedRef.current.library = false
        setLibraryCollapsed(false)
      }
      if (autoCollapsedRef.current.properties) {
        autoCollapsedRef.current.properties = false
        setPropertiesCollapsed(false)
      }
    }
  }, [
    isNarrow,
    libraryCollapsed,
    propertiesCollapsed,
    libraryFloating,
    propertiesFloating,
    setLibraryCollapsed,
    setPropertiesCollapsed,
  ])

  // Keep the <html lang> attribute in sync with the selected UI language so
  // screen readers pronounce content correctly (was hardcoded lang="en").
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

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
        const kindLabel = o.refKind === 'device'
          ? t('app.libUpdate.kindDevice', 'Gerät')
          : t('app.libUpdate.kindGroup', 'Rack/Gruppe')
        return `• ${o.equipmentName} (${kindLabel}: ${o.refName}) — v${o.storedFileVersion} → v${o.currentFileVersion}`
      })
      const more = outdated.length > lines.length
        ? '\n' + format(t('app.libUpdate.moreLines', '…und {n} weitere'), { n: outdated.length - lines.length })
        : ''
      const ok = await confirmDialog(
        format(t('app.libUpdate.title', '{n} Library-Item(s) im Projekt sind veraltet:'), {
          n: outdated.length,
        }),
        {
          body:
            `${lines.join('\n')}${more}\n\n` +
            t(
              'app.libUpdate.body',
              'Im Bibliotheks-Ordner liegt eine neuere Version. Auf die aktuellen Library-Stände aktualisieren?\n\n(Geräte-Namen + Notizen bleiben erhalten. Rack/Gruppen-Updates müssen aktuell manuell neu platziert werden.)',
            ),
          okLabel: t('app.libUpdate.okBtn', 'Aktualisieren'),
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
        await infoDialog(t('app.libUpdate.doneTitle', 'Update fertig'), {
          body:
            format(t('app.libUpdate.doneAppliedBody', '{n} device(s) updated.'), { n: applied }) +
            (skipped > 0
              ? '\n' +
                format(
                  t(
                    'app.libUpdate.doneSkippedBody',
                    '{n} rack/group item(s) skipped — please re-place manually if needed.',
                  ),
                  { n: skipped },
                )
              : ''),
          tone: 'success',
        })
      }
    })()
  }, [libraryReady, projectVersion])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- PDF-Export öffnet → Theme einmalig auf hell setzen
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

  // #pre-sale — OS-Dateiverknüpfung: beim Kaltstart die per Doppelklick
  // übergebene Datei abholen (einmalig) und auf später geöffnete Dateien
  // (zweite Instanz / macOS open-file bei laufender App) hören.
  useEffect(() => {
    void openLaunchFile()
    const off = cablePlannerApi.project.onOpenExternal((payload) => {
      void applyOpenedProject(payload)
    })
    return off
  }, [openLaunchFile, applyOpenedProject])

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

  // Feld-Rückkanal — Mobile-User hat eine Korrektur/ein Problem gemeldet.
  // ProjectStore legt es in die Review-Queue (project.pendingChanges); der
  // Planer übernimmt/verwirft es im Festinstallations-Doku-Dialog.
  const addPendingChange = useProjectStore((s) => s.addPendingChange)
  useEffect(() => {
    if (!hasDesktopBridge) return
    return cablePlannerApi.mobileShare.onPendingChange((change) => {
      addPendingChange({
        author: change.author,
        source: 'mobile',
        kind: change.kind as import('./types/lifecycle').PendingChangeKind,
        summary: change.summary,
        target: change.target,
        patch: change.patch,
      })
    })
  }, [addPendingChange])

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
      const ok = await confirmDialog(
        t('app.newProject.confirmTitle', 'Neues Projekt anlegen?'),
        {
          body: t(
            'app.newProject.confirm',
            'Aktuelles Projekt verwerfen und neues Projekt anlegen?\n\nUngespeicherte Änderungen gehen verloren.',
          ),
          okLabel: t('app.newProject.confirmOk', 'Neues Projekt'),
          destructive: true,
        },
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
      // #496 — `newProject()` ruft intern (nach seinem await) erneut `clear()`
      // auf und würde damit die unten gesetzten Metadaten (v.a. den Projekt-
      // Namen aus diesem Dialog) wieder verwerfen. Deshalb den Patch nach
      // Abschluss von newProject() erneut anwenden, damit der Name bleibt.
      void newProject()
        .catch(() => {
          /* ignore — clear() already did the local reset */
        })
        .then(() => useProjectStore.getState().updateProjectMetadata(patch))
    }
    useProjectStore.getState().updateProjectMetadata(patch)
    setMetaDialog(null)
  }

  // v7.7.1 — PNG / JPEG export (canvas only, no header / title block).
  const handleExportImage = async (imgFormat: 'png' | 'jpeg' | 'svg' | 'dxf') => {
    try {
      if (imgFormat === 'dxf') {
        // #355 — DXF wird strukturiert aus den Projektdaten erzeugt (nicht
        // aus dem DOM), daher eigener Pfad statt exportCanvasToImage.
        downloadBlob(
          buildExportFilename(project.metadata.name, 'dxf'),
          exportProjectToDxf(project),
          'application/dxf',
        )
        return
      }
      await exportCanvasToImage(project.metadata.name, imgFormat, {
        backgroundTheme: canvasTheme,
        bgVariant: exportBgVariant,
        gridSize: exportGridSize,
        bgOpacity: exportBgOpacity,
        customPalette: exportCustomPalette,
      })
    } catch (error) {
      console.error(`${imgFormat.toUpperCase()} export failed:`, error)
      await infoDialog(
        format(t('app.export.imageFailedTitle', '{fmt}-Export fehlgeschlagen'), {
          fmt: imgFormat.toUpperCase(),
        }),
        {
          body: error instanceof Error ? error.message : t('app.error.unknown', 'Unbekannter Fehler'),
          tone: 'error',
        },
      )
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
        await infoDialog(t('app.viewerExport.okTitle', 'Viewer-Datei gespeichert'), {
          body:
            `${path}\n\n` +
            t(
              'app.viewerExport.okBody',
              'Sende sie an deine Reviewer/Helfer. Beim Öffnen werden sie nach ihrem Namen gefragt — Anmerkungen sind dann automatisch attributiert.',
            ),
          tone: 'success',
        })
      }
    } catch (error) {
      console.error('Viewer export failed:', error)
      await infoDialog(t('app.viewerExport.failTitle', 'Viewer-Export fehlgeschlagen'), {
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
      await infoDialog(
        t('app.annotationsImport.needDesktop', 'Annotations-Re-Import erfordert die Desktop-App.'),
        { tone: 'warning' },
      )
      return
    }
    const result = await cablePlannerApi.project.importAnnotations()
    if (!result) return
    // #143 — Merge by id: neue Annotationen hinzufügen UND vom Reviewer
    // geänderte (Status/Text) aktualisieren. Vorher add-only — geänderte
    // Bestands-Annotationen gingen beim Re-Import verloren.
    const incoming = (result.annotations ?? []) as Array<
      import('./types/project').ProjectAnnotation
    >
    const { added, updated } = useProjectStore.getState().mergeAnnotationsFromViewerFile(incoming)
    await infoDialog(t('app.annotationsImport.okTitle', 'Annotations importiert'), {
      body:
        format(t('app.annotationsImport.okBodyImported', '{n} new annotation(s) imported.'), {
          n: added,
        }) +
        '\n' +
        format(t('app.annotationsImport.okBodyUpdated', '{n} updated from reviewer changes.'), {
          n: updated,
        }),
      tone: 'success',
    })
  }

  const handleExportPdf = async (
    theme: 'dark' | 'light' = canvasTheme,
    vector = false,
    pageSize: 'auto' | 'original' | 'a4' | 'a3' | 'a2' | 'a1' | 'a0' | 'a0plus' = 'auto',
  ) => {
    setPdfExportThemeOverride(theme)
    setPdfProgress({ active: true, phase: 'Starte…' })
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
    try {
      if (vector) {
        // v7.9.97 — Vektor-Pfad: Chromium printToPDF, Text bleibt Text.
        // v7.9.103 — pageSize: Auto = A0-Cap fuer Viewer-Kompat,
        // Original = volle Canvas-Groesse fuer Plotter.
        await exportCanvasToPdfVector(project.metadata.name, project.metadata, {
          backgroundTheme: theme,
          bgVariant: exportBgVariant,
          gridSize: exportGridSize,
          bgOpacity: exportBgOpacity,
          customPalette: exportCustomPalette,
          pageSize,
          onProgress: (phase, detail) =>
            setPdfProgress({ active: true, phase, detail }),
        })
      } else {
        await exportCanvasToPdf(project.metadata.name, project.metadata, 0.85, {
          backgroundTheme: theme,
          bgVariant: exportBgVariant,
          gridSize: exportGridSize,
          bgOpacity: exportBgOpacity,
          customPalette: exportCustomPalette,
          onProgress: (phase, detail) =>
            setPdfProgress({ active: true, phase, detail }),
        })
      }
    } catch (error) {
      console.error('PDF export failed:', error)
      await infoDialog('PDF-Export fehlgeschlagen', {
        body: error instanceof Error ? error.message : 'Unbekannter Fehler',
        tone: 'error',
      })
    } finally {
      setPdfExportThemeOverride(null)
      setPdfProgress({ active: false })
    }
  }

  /** v7.9.4 — Plan-PDF in den OS-Drucker statt File-Download.
   *  Baut die gleiche PDF wie handleExportPdf, schickt sie aber durch
   *  printPdfBlob → unsichtbares iframe → window.print() → OS-Druckdialog. */
  const handlePrintPdf = async (theme: 'dark' | 'light' = canvasTheme) => {
    setPdfExportThemeOverride(theme)
    setPdfProgress({ active: true, phase: 'Starte…' })
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
        onProgress: (phase, detail) =>
          setPdfProgress({ active: true, phase, detail }),
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
      setPdfProgress({ active: false })
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
      await infoDialog(t('app.rentman.notLinkedTitle', 'Kein Rentman-Projekt verknüpft'), {
        body: t('app.rentman.notLinkedBody', 'Bitte zuerst in den Einstellungen verknüpfen.'),
        tone: 'warning',
      })
      return
    }
    const targetName =
      meta.rentmanProjectName ??
      format(t('app.rentman.fallbackProject', 'Projekt #{id}'), { id: String(linkedId) })
    if (
      !(await confirmDialog(
        format(
          t('app.rentman.attachPdfConfirm', 'Aktuellen Plan als PDF an Rentman-Projekt "{name}" anhängen?'),
          { name: targetName },
        ),
      ))
    ) {
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
      await infoDialog(t('app.rentman.attachedTitle', 'An Rentman angehängt'), {
        body: format(
          t('app.rentman.attachedBody', '{file} wurde dem Projekt "{name}" als Anhang hinzugefügt.'),
          { file: fileName, name: targetName },
        ),
        tone: 'success',
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('PDF upload to Rentman failed:', err)
      await infoDialog(t('app.rentman.uploadFailedTitle', 'Fehler beim PDF-Upload'), { body: msg, tone: 'error' })
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
        const replace = await confirmDialog(t('app.portConflict.title', 'Port bereits belegt'), {
          body:
            t('app.portConflict.intro', 'An mindestens einem der Ports steckt bereits ein Kabel:') +
            `\n\n${list}\n\n` +
            t(
              'app.portConflict.body',
              '"Ersetzen" = bestehendes Kabel löschen und neue Verbindung anlegen.\n"Abbrechen" = neue Verbindung verwerfen, alles bleibt wie es ist.',
            ),
          okLabel: t('app.portConflict.okReplace', 'Ersetzen'),
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
    // v7.9.128 — Snapshot der Waypoints VOR createCableFromPending,
    // weil die Action pendingWaypoints sofort zurueck auf undefined
    // setzt. Wir brauchen den Vorher-Stand um zu entscheiden ob das
    // Kabel auto-A*-geroutet werden soll oder ob der User schon manuell
    // Wegpunkte gesetzt hat.
    const hadManualWaypoints =
      (stateBefore.pendingWaypoints?.length ?? 0) > 0
    createCableFromPending(draft)
    // v7.9.128 — Auto-A*-Routing fuer einfaches Cable-Erstellen
    // (Drag oder Click-Click ohne Wegpunkte) gemaess User-Request:
    // "Wenn man nur Start und Ziel anklickt, soll automatisch mit A*
    //  geroutet werden". Doppelter rAF damit ReactFlow den neuen Edge
    // gemessen hat und die Equipment-Bounding-Boxes stabil sind — sonst
    // hat A* keine validen Obstacle-Rects (Pattern aus
    // RackInternalCanvas.tsx v7.9.118).
    if (!hadManualWaypoints) {
      const newCable = useProjectStore.getState().project.cables.slice(-1)[0]
      if (newCable) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            routeCable(newCable.id)
          })
        })
      }
    }
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
    const fromDev = getEquipmentById(project.equipment, pendingConnection.source)
    const toDev = getEquipmentById(project.equipment, pendingConnection.target)
    const fromPort = fromDev?.outputs.find((p) => p.id === pendingConnection.sourceHandle)
    const toPort = toDev?.inputs.find((p) => p.id === pendingConnection.targetHandle)
    return { fromPort, toPort, fromDev, toDev }
  }, [pendingConnection, project.equipment])

  return (
    <div className="flex h-screen flex-col bg-cp-surface-1 text-cp-text">
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
        onExportViewer={() => void handleExportViewer()}
        onImportAnnotations={() => void handleImportAnnotations()}
        onOpenGraphmlImport={() => setGraphmlImportOpen(true)}
        onAttachPdfToRentman={() => void handleUploadPdfToRentman()}
        onOpenRentmanCableExport={openRentmanCableExport}
        hasRentmanLink={Boolean(project.metadata.rentmanProjectId)}
        onEditProjectMeta={() => setMetaDialog({ mode: 'edit' })}
        onOpenCableBom={() => setCableBomOpen(true)}
        onOpenTour={() => setTourOpen(true)}
        projectName={project.metadata.name}
      />

      <main
        className="grid min-h-0 flex-1 overflow-hidden"
        style={{
          // When a panel is floating, its grid column collapses to 0
          // (no chip, no splitter spacing) so the canvas reclaims the
          // space. The panel itself renders as an overlay via
          // FloatingPanelShell.
          //
          // Responsive (UX audit #2/#3): expanded panel columns are capped at
          // a viewport fraction via min(<width>px, 33vw). On normal desktop
          // widths the stored width wins (defaults 260/280px stay untouched
          // for viewports ≳850px); only on narrow windows do the panels shrink
          // so the canvas always keeps usable room. Stateless + reversible —
          // the stored preference is never mutated.
          gridTemplateColumns: `${
            libraryHidden ? '0px' : libraryCollapsed ? '32px' : `min(${libraryWidth}px, 33vw)`
          } ${libraryHidden ? '0px' : '4px'} minmax(0, 1fr) ${
            propertiesHidden ? '0px' : '4px'
          } ${
            propertiesHidden
              ? '0px'
              : propertiesCollapsed
                ? '32px'
                : `min(${propertiesWidth}px, 33vw)`
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

      <SettingsDialog
        open={settingsOpen}
        onClose={() => useUiStore.getState().closeSettings()}
        initialSection={settingsSection}
      />
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
      <DrumMicingDialog />
      <WirelessRigDialog />
      <LocationBomDialog />
      <RackEditorDialog />
      <MobileShareDialog />
      <AboutDialog />
      <PatchListDialog />
      <InstallationDocsDialog />
      <ModuleOnboardingDialog />
      <BandwidthCalculatorDialog />
      <PowerCalculatorDialog />
      <RecordingStorageCalculatorDialog />
      <ProjectionCalculatorDialog />
      <BulkConnectDialog />
      <AnalysisDialog />
      <PlanCheckPanel />
      <ShortcutsHelp />
      <CommandPalette />
      <RevisionsDialog />
      <AiPlanGenDialog />
      <CsvImportDialog />
      <TemplatesDialog />
      <CableContextMenu />
      <AnnotationsPanelHost />
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExportPdf={(theme, vector, pageSize) =>
          handleExportPdf(theme, vector ?? false, pageSize ?? 'auto')
        }
        onPrintPdf={(theme) => handlePrintPdf(theme)}
        onExportImage={(format) => handleExportImage(format)}
      />

      <InventoryDialog
        open={inventoryOpen}
        onClose={() => useUiStore.getState().closeInventory()}
      />

      <ProjectMetaDialog
        open={metaDialog !== null}
        mode={metaDialog?.mode ?? 'edit'}
        initial={project.metadata}
        onCancel={() => setMetaDialog(null)}
        onConfirm={(patch) => void handleMetaConfirm(patch)}
      />

      <CableBomDialog open={cableBomOpen} onClose={() => setCableBomOpen(false)} />

      <PdfExportDialog
        open={pdfExportOpen}
        theme={pdfTheme}
        onThemeChange={setPdfTheme}
        vector={pdfVectorMode}
        onVectorChange={setPdfVectorMode}
        onClose={() => setPdfExportOpen(false)}
        onExport={() => {
          setPdfExportOpen(false)
          void handleExportPdf(pdfTheme, pdfVectorMode)
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
      {/* #294 — Port-Konflikt-Dialog: erscheint wenn der User auf einen
          bereits belegten Ziel-Port zieht. Default-Action: Abbrechen, damit
          eine versehentliche Enter-Taste den Konflikt nicht still ersetzt. */}
      {portConflict && (() => {
        const conflictingCables = project.cables.filter((c) =>
          portConflict.conflictingCableIds.includes(c.id),
        )
        const targetEqId = portConflict.connection.target ?? ''
        const targetEq = getEquipmentById(project.equipment, targetEqId)
        const targetPort = targetEq
          ? [...targetEq.inputs, ...targetEq.outputs].find(
              (p) => p.id === portConflict.connection.targetHandle,
            )
          : undefined
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded border border-amber-700 bg-cp-surface-1 text-cp-text shadow-2xl">
              <header className="border-b border-cp-border px-4 py-2">
                <h2 className="text-cp-base font-semibold text-amber-300">
                  {t('app.portConflict.title', 'Port bereits belegt')}
                </h2>
              </header>
              <div className="px-4 py-3 text-cp-base">
                <p className="mb-2">
                  {t('app.portConflict.targetPortLabel', 'Der Ziel-Port')}{' '}
                  <span className="font-mono text-amber-200">
                    {targetEq?.name ?? '?'} · {targetPort?.name ?? '?'}
                  </span>{' '}
                  {t('app.portConflict.alreadyConnectedBy', 'ist bereits über')}{' '}
                  <strong>
                    {conflictingCables.length === 1
                      ? t('app.portConflict.oneCable', '1 Kabel')
                      : format(t('app.portConflict.nCables', '{n} Kabel'), {
                          n: conflictingCables.length,
                        })}
                  </strong>{' '}
                  {t('app.portConflict.connected', 'belegt:')}
                </p>
                <ul className="mb-3 max-h-32 space-y-1 overflow-auto rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-xs">
                  {conflictingCables.map((c) => {
                    const srcEq = getEquipmentById(project.equipment, c.fromEquipmentId)
                    const srcPort = srcEq
                      ? [...srcEq.inputs, ...srcEq.outputs].find((p) => p.id === c.fromPortId)
                      : undefined
                    return (
                      <li key={c.id} className="font-mono text-cp-text-secondary">
                        {srcEq?.name ?? '?'} · {srcPort?.name ?? '?'} →{' '}
                        {targetEq?.name ?? '?'} · {targetPort?.name ?? '?'}
                        {c.name ? (
                          <span className="ml-1 text-cp-text-faint">({c.name})</span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
                <p className="text-[12px] text-cp-text-muted">
                  {t(
                    'app.portConflict.hint',
                    '„Ersetzen" entfernt die obige(n) Verbindung(en) und legt das neue Kabel an. „Abbrechen" verwirft den Connect-Versuch.',
                  )}
                </p>
              </div>
              <footer className="flex justify-end gap-2 border-t border-cp-border px-4 py-2">
                <button
                  type="button"
                  onClick={cancelPortConflict}
                  className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
                >
                  {t('common.cancel', 'Abbrechen')}
                </button>
                <button
                  type="button"
                  onClick={resolvePortConflictByReplace}
                  className="rounded bg-amber-700 px-3 py-1 text-cp-xs font-semibold hover:bg-amber-600"
                >
                  {t('app.portConflict.okReplace', 'Ersetzen')}
                </button>
              </footer>
            </div>
          </div>
        )
      })()}
      {pdfProgress.active && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[420px] max-w-[90vw] rounded-cp-card border border-cp-border bg-cp-surface-1 p-5 text-cp-text shadow-2xl">
            <div className="mb-3 flex items-center gap-3">
              <div className="h-3 w-3 animate-pulse rounded-full bg-sky-400" />
              <h2 className="text-cp-base font-semibold">{t('app.pdfProgress.title', 'PDF wird erstellt…')}</h2>
            </div>
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded bg-cp-surface-2">
              <div className="h-full w-full origin-left animate-pulse bg-sky-500" />
            </div>
            <div className="text-cp-xs text-cp-text-secondary">{pdfProgress.phase}</div>
            {pdfProgress.detail && (
              <div className="mt-1 text-[11px] text-cp-text-muted">{pdfProgress.detail}</div>
            )}
            <div className="mt-3 text-[10px] text-cp-text-muted">
              {t('app.pdfProgress.hint', 'Bei großen Plänen können einige Sekunden vergehen. Bitte nicht abbrechen.')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface PdfExportDialogProps {
  open: boolean
  theme: 'dark' | 'light'
  onThemeChange: (theme: 'dark' | 'light') => void
  vector: boolean
  onVectorChange: (vector: boolean) => void
  onClose: () => void
  onExport: () => void
}

const PdfExportDialog = ({
  open,
  theme,
  onThemeChange,
  vector,
  onVectorChange,
  onClose,
  onExport,
}: PdfExportDialogProps) => {
  const t = useTranslation()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-cp-card border border-cp-border bg-cp-surface-1 p-4 shadow-2xl">
        <h2 className="mb-3 text-cp-base font-semibold text-cp-text">{t('pdfExport.title', 'Plan als PDF exportieren')}</h2>
        <div className="space-y-3">
          {/* Layer-Sichtbarkeit — uebernimmt die Chip-Komponente aus
              der Canvas-Toolbar. Same store, daher synchronisiert sich
              die Auswahl bidirektional mit dem Canvas. Damit kann der
              User z.B. nur die Video-Ebene drucken indem er alle
              anderen Chips deaktiviert. */}
          <fieldset className="rounded border border-cp-border p-3">
            <legend className="px-1 text-[11px] uppercase tracking-wide text-cp-text-muted">
              {t('pdfExport.layers.title', 'Ebenen (im PDF enthalten)')}
            </legend>
            <div className="-mx-1 flex flex-wrap gap-1">
              <LayerVisibilityChips />
            </div>
            <p className="mt-2 text-[10px] text-cp-text-muted">
              {t(
                'pdfExport.layers.hint',
                'Klick auf einen Chip schaltet die Ebene fuer Canvas UND PDF um. Beispiel: nur Video drucken ⇒ alle anderen Chips ausschalten.',
              )}
            </p>
          </fieldset>
          <fieldset className="rounded border border-cp-border p-3">
            <legend className="px-1 text-[11px] uppercase tracking-wide text-cp-text-muted">
              {t('pdfExport.bg.title', 'Hintergrund')}
            </legend>
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-cp-xs text-cp-text-bright">
              <input
                type="radio"
                name="pdf-bg-theme"
                checked={theme === 'light'}
                onChange={() => onThemeChange('light')}
              />
              {t('pdfExport.bg.light', 'Hell')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-cp-xs text-cp-text-bright">
              <input
                type="radio"
                name="pdf-bg-theme"
                checked={theme === 'dark'}
                onChange={() => onThemeChange('dark')}
              />
              {t('pdfExport.bg.dark', 'Dunkel')}
            </label>
          </fieldset>
          {/* v7.9.97 — Vektor-PDF Beta. Default aus, damit alle
              bestehenden Workflows die bekannte Raster-Pipeline
              nutzen. Wenn an: Text bleibt im PDF als echter Text,
              keine Pixelung beim Zoom. */}
          <fieldset className="rounded border border-cp-border p-3">
            <legend className="px-1 text-[11px] uppercase tracking-wide text-cp-text-muted">
              {t('pdfExport.render.title', 'Render-Modus')}
            </legend>
            <label className="mb-2 flex cursor-pointer items-start gap-2 text-cp-xs text-cp-text-bright">
              <input
                type="radio"
                name="pdf-render-mode"
                checked={!vector}
                onChange={() => onVectorChange(false)}
              />
              <span>
                {t('pdfExport.render.raster', 'Raster (klassisch)')}
                <span className="block text-[10px] text-cp-text-muted">
                  {t(
                    'pdfExport.render.rasterHint',
                    'JPEG-Snapshot des Canvas. Zuverlässig, aber unscharf bei großem Zoom in der PDF.',
                  )}
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-cp-xs text-cp-text-bright">
              <input
                type="radio"
                name="pdf-render-mode"
                checked={vector}
                onChange={() => onVectorChange(true)}
              />
              <span>
                {t('pdfExport.render.vector', 'Vektor')}
                <span className="block text-[10px] text-cp-text-muted">
                  {t(
                    'pdfExport.render.vectorHint',
                    'Chromium printToPDF. Text bleibt selektierbar & scharf bei jedem Zoom. Kleinere Dateigröße.',
                  )}
                </span>
              </span>
            </label>
          </fieldset>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-cp-border bg-cp-surface-2 px-3 py-1.5 text-cp-xs text-cp-text hover:bg-cp-surface-4"
          >
            {t('common.cancel', 'Abbrechen')}
          </button>
          <button
            type="button"
            onClick={onExport}
            className="rounded bg-sky-700 px-3 py-1.5 text-cp-xs font-medium text-white hover:bg-sky-600"
          >
            {t('pdfExport.exportBtn', 'PDF exportieren')}
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
  const t = useTranslation()
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
  // v7.9.68 / #182 — Bei Wireless-Links wird im UI maxRange statt length
  // angezeigt; lokaler State spiegelt das.
  const [maxRange, setMaxRange] = useState<number | undefined>(cable.maxRange)
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

  const fromDev = getEquipmentById(equipment, fromEquipmentId)
  const toDev = getEquipmentById(equipment, toEquipmentId)
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

  // v7.9.68 / #182 — Bei Wireless gibt es keine "Länge"; daher auch keine
  // Längen-Warnung anzeigen.
  const lengthWarning =
    !cable.wireless && selected.maxLengthMeters && length > selected.maxLengthMeters
      ? format(
          t(
            'cable.lengthWarning',
            'Länge überschreitet empfohlenes Maximum von {max} m für {name}.',
          ),
          { max: selected.maxLengthMeters, name: selected.name },
        )
      : null

  const submit = () => {
    onSave({
      name,
      length,
      // v7.9.68 / #182 — Bei Wireless wird maxRange anstelle von length
      // geschrieben (length bleibt erhalten falls vorhanden, hat aber im
      // UI keine Bedeutung mehr).
      ...(cable.wireless ? { maxRange } : {}),
      color,
      notes,
      cableSpecId: specId === CUSTOM_CABLE_SPEC_ID ? undefined : selected.id,
      type: connectorToCableType(specId === CUSTOM_CABLE_SPEC_ID ? customConnectorType : selected.connectorType),
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
      <div className="w-full max-w-lg rounded border border-cp-border bg-cp-surface-1 p-4 text-cp-text">
        <h3 className="mb-2 text-cp-xl font-semibold">Kabel bearbeiten</h3>

        <div className="space-y-2 text-cp-base">
          <label className="block">
            Kabeltyp
            <select
              value={specId}
              onChange={(e) => onSelectSpec(e.target.value)}
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
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
            <div className="grid grid-cols-2 gap-2 rounded border border-cp-border bg-cp-surface-3/60 p-2">
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
                  className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
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
                  className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
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
                className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
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
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            {cable.wireless ? (
              <label className="block">
                Max. Reichweite (m)
                <input
                  type="number"
                  min={0}
                  value={maxRange ?? ''}
                  placeholder={t('cable.field.maxReachPlaceholder', 'z.B. 100')}
                  onChange={(e) => {
                    const v = e.target.value
                    setMaxRange(v === '' ? undefined : Number(v))
                  }}
                  className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
                />
              </label>
            ) : (
              <label className="block">
                {t('cable.field.lengthM', 'Länge (m)')}
                <input
                  type="number"
                  min={0}
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
                />
              </label>
            )}
            <label className="block">
              {t('cable.field.color', 'Farbe')}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="mt-1 h-10 w-full rounded border border-cp-border bg-cp-surface-3 p-1"
              />
            </label>
          </div>

          {/* Endpoint editor as collapsible accordion below color. Compact
              summary always visible (current routing); expand to change
              device/port on either side. */}
          <details open className="rounded border border-cp-border bg-cp-surface-3/50">
            <summary className="cursor-pointer select-none px-2 py-1.5 text-[11px] text-cp-text-secondary hover:bg-cp-surface-2/40">
              <span className="font-semibold uppercase tracking-wide text-cp-text-muted">Verbindung</span>
              <span className="ml-2 text-cp-text-secondary">
                {fromDev?.name ?? '?'} · {fromPort?.name ?? cable.fromPortId}
                <span className="mx-1 text-cp-text-faint">→</span>
                {toDev?.name ?? '?'} · {toPort?.name ?? cable.toPortId}
              </span>
            </summary>
            <div className="border-t border-cp-border p-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-0.5 text-[10px] text-cp-text-muted">{t('cable.fromDeviceShort', 'Von Gerät')}</div>
                  <select
                    aria-label={t('cable.aria.fromDevice', 'Quell-Gerät')}
                    value={fromEquipmentId}
                    onChange={(e) => onSelectFromEquipment(e.target.value)}
                    className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
                  >
                    {sortedEquipment.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[10px] text-cp-text-muted">Port</div>
                  <select
                    aria-label={t('cable.aria.fromPort', 'Quell-Port')}
                    value={fromPortId}
                    onChange={(e) => setFromPortId(e.target.value)}
                    className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
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
                  <div className="mb-0.5 text-[10px] text-cp-text-muted">{t('cable.toDeviceShort', 'Nach Gerät')}</div>
                  <select
                    aria-label={t('cable.aria.toDevice', 'Ziel-Gerät')}
                    value={toEquipmentId}
                    onChange={(e) => onSelectToEquipment(e.target.value)}
                    className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
                  >
                    {sortedEquipment.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[10px] text-cp-text-muted">Port</div>
                  <select
                    aria-label={t('cable.aria.toPort', 'Ziel-Port')}
                    value={toPortId}
                    onChange={(e) => setToPortId(e.target.value)}
                    className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
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
                <div className="mt-2 flex items-center gap-1.5 rounded bg-amber-900/50 px-2 py-1 text-[11px] text-amber-100">
                  <Icon icon={AlertTriangle} size="xs" />
                  {format(t('cable.create.warn.fromBusy', 'Quell-Port ist bereits durch Kabel „{name}" belegt.'), { name: fromConflict.name })}
                </div>
              )}
              {toConflict && (
                <div className="mt-1 flex items-center gap-1.5 rounded bg-amber-900/50 px-2 py-1 text-[11px] text-amber-100">
                  <Icon icon={AlertTriangle} size="xs" />
                  {format(t('cable.create.warn.toBusy', 'Ziel-Port ist bereits durch Kabel „{name}" belegt.'), { name: toConflict.name })}
                </div>
              )}
              {sameEndpoints && (
                <div className="mt-1 flex items-center gap-1.5 rounded bg-red-900/50 px-2 py-1 text-[11px] text-red-100">
                  <Icon icon={AlertTriangle} size="xs" />
                  {t('cable.create.warn.samePort', 'Quelle und Ziel zeigen auf denselben Port.')}
                </div>
              )}
            </div>
          </details>

          <label className="block">
            Notizen
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
              rows={2}
            />
          </label>
        </div>

        {lengthWarning && (
          <div className="mt-3 flex items-center gap-1.5 rounded bg-amber-900/50 p-2 text-cp-xs text-amber-100">
            <Icon icon={AlertTriangle} size="sm" />
            {lengthWarning}
          </div>
        )}

        <div className="mt-3 flex justify-end gap-2 text-cp-base">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-cp-surface-4 px-3 py-1 hover:bg-cp-surface-5"
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
