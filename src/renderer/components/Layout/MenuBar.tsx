import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react'
import {
  FileText, Clapperboard, FolderOpen, Save, SaveAll, Ruler, Upload, FileDown,
  Image as ImageIcon, Calculator, Eye, MessageSquare, Paperclip, Plug, Cable,
  Undo2, Redo2, Radio, Zap, BarChart3, Server, Monitor, MonitorPlay, SlidersHorizontal, Tag,
  Shuffle, Headphones, Import as ImportIcon, Users, Lightbulb, Info, Check,
  Pencil, Smartphone, Settings, HardDrive, Copy, ClipboardCheck, History, Sparkles, Drum,
  Maximize, Maximize2, ZoomIn, ZoomOut, Scan, BoxSelect, RefreshCw, PackageCheck,
  Keyboard, Command, Boxes,
} from 'lucide-react'
import { Icon } from '../shared/Icon'
import {
  triggerCanvasDuplicate,
  triggerCanvasSelectAll,
  triggerCanvasFitView,
  triggerCanvasZoomIn,
  triggerCanvasZoomOut,
  triggerCanvasResetZoom,
} from '../../lib/canvasViewport'
import { SharedSyncPanel } from '../Sync/SharedSyncPanel'
import { useTranslation, format } from '../../lib/i18n'
import { projectHistory } from '../../store/projectHistory'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useModule } from '../../store/settingsStore'
import { exportStagePlotSvg } from '../../lib/exportStagePlot'
import { downloadBlob } from '../../lib/downloadBlob'
import { parseCameraList, cameraListToEquipment } from '../../lib/multicamCameraImport'
import { cableToAvPlan, parseAvPlan } from '../../lib/avplan'
import { summarizeForeign, hasForeign } from '../../lib/foreignView'
import type { CablePlannerProject } from '../../types/project'
import { buildExportFilename } from '../../lib/exportFilename'
import { hasDesktopBridge, cablePlannerApi } from '../../lib/bridge'
import { infoDialog } from '../../lib/infoDialog'
import { confirmDialog } from '../../lib/confirmDialog'

interface MenuBarProps {
  onNewProject: () => void
  onOpenProject: () => void
  onSaveProject: () => void
  onSaveProjectAs: () => void
  onOpenSettings: () => void
  /** v7.9.0 / Issue #110 — unified Export-Dialog opener. Replaces the
   *  former three separate menu entries (PDF / PNG / JPEG) with a
   *  single "Exportieren…" item that opens a dialog where the user
   *  picks the format. */
  onOpenExportDialog?: () => void
  /** Legacy direct triggers — kept for backwards compatibility with
   *  callers that still want individual menu items. When
   *  onOpenExportDialog is provided we hide these. */
  onExportPdf: () => void
  onExportPng?: () => void
  onExportJpeg?: () => void
  /** Open the GraphML / yEd import dialog. */
  onOpenGraphmlImport?: () => void
  onEditProjectMeta?: () => void
  onOpenCableBom?: () => void
  /** v7.9.3 — Plan als .cpviewer-Datei exportieren (read-only für Reviewer). */
  onExportViewer?: () => void
  /** v7.9.3 — Annotations aus einer .cpviewer-Datei zurück importieren. */
  onImportAnnotations?: () => void
  /** Attach the current plan as a PDF to the linked Rentman project. */
  onAttachPdfToRentman?: () => void
  /** Open the Rentman cable export dialog. */
  onOpenRentmanCableExport?: () => void
  /** Whether a Rentman project is currently linked (controls Rentman menu items). */
  hasRentmanLink?: boolean
  /** Open the onboarding tour (also reachable from a help icon). */
  onOpenTour?: () => void
  projectName?: string
}

/**
 * Top application menu bar.
 *
 * Replaces the previous flat row of mini-buttons (Neu / Öffnen / Speichern /
 * Speichern unter / Projektdaten / PDF / Kabel-BOM / …) with two compact
 * dropdown menus ("Datei ▾", "Export ▾") plus inline project name + format
 * + a settings icon. This matches how desktop apps usually expose these
 * actions and gives plenty of room for new entries without crowding the bar.
 */
export const MenuBar = ({
  onNewProject,
  onOpenProject,
  onSaveProject,
  onSaveProjectAs,
  onOpenSettings,
  onOpenExportDialog,
  onExportViewer,
  onImportAnnotations,
  onExportPdf,
  onExportPng,
  onExportJpeg,
  onOpenGraphmlImport,
  onEditProjectMeta,
  onOpenCableBom,
  onAttachPdfToRentman,
  onOpenRentmanCableExport,
  hasRentmanLink = false,
  onOpenTour,
  projectName,
}: MenuBarProps) => {
  const t = useTranslation()

  // MultiCam-Planner-Kameras (.cameras.json) als Equipment-Nodes importieren.
  const cameraImportRef = useRef<HTMLInputElement | null>(null)
  const handleImportCameras = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const items = cameraListToEquipment(parseCameraList(await file.text()))
        useProjectStore.getState().importEquipment(items)
        await infoDialog(
          `${items.length} ${t('app.menu.file.importCamerasDone', 'MultiCam-Kamera(s) als Equipment importiert.')}`,
        )
      } catch {
        await infoDialog(
          t('app.menu.file.importCamerasError', 'Kamera-Import fehlgeschlagen — keine gültige MultiCam-Kameraliste.'),
          { tone: 'error' },
        )
      }
    }
    if (cameraImportRef.current) cameraImportRef.current.value = ''
  }

  // ── Gesamtprojekt (.avplan): verlustfrei. Cable bearbeitet den cabling-Slot
  // nativ und bewahrt geteilten Raum + Kamera-/Licht-Domaenen 1:1 (in der
  // .avplan UND im eigenen Projektfile via project.avForeign).
  const avplanImportRef = useRef<HTMLInputElement | null>(null)
  const handleExportAvplan = () => {
    const project = useProjectStore.getState().project
    const avplan = cableToAvPlan(project, { appVersion: __APP_VERSION__, exportedAt: new Date().toISOString() })
    const safe = (project.metadata?.name || 'projekt').replace(/[^a-zA-Z0-9_-]+/g, '_')
    downloadBlob(`${safe}.avplan`, JSON.stringify(avplan, null, 2), 'application/json')
  }
  const handleImportAvplan = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const avplan = parseAvPlan(await file.text())
        const base = (avplan.domains.cabling as CablePlannerProject | undefined) ?? useProjectStore.getState().project
        useProjectStore.getState().loadProject({
          ...base,
          avForeign: { venue: avplan.venue, cameras: avplan.domains.cameras, lighting: avplan.domains.lighting },
        })
      } catch {
        await infoDialog(
          t('app.menu.file.importAvplanError', 'Import fehlgeschlagen — keine gültige .avplan-Datei.'),
          { tone: 'error' },
        )
      }
    }
    if (avplanImportRef.current) avplanImportRef.current.value = ''
  }
  const avForeign = useProjectStore((s) => s.project.avForeign)
  const handleViewForeign = async () => {
    const sum = summarizeForeign(avForeign)
    await infoDialog(t('app.menu.file.viewForeignTitle', 'Verknüpfte Venue-Planung (nur Ansicht)'), {
      bodyNode: (
        <div className="flex flex-col gap-2 text-cp-xs text-cp-text-secondary">
          <div>
            {t('app.menu.file.viewForeignRoom', 'Raum')}:{' '}
            <b className="text-cp-text">{sum.venueName || '—'}</b> · {sum.counts.walls} Wände ·{' '}
            {sum.counts.persons} Personen · {sum.counts.stage} Bühne
          </div>
          <div>
            <div className="font-semibold text-cp-text">Kameras ({sum.cameras.length})</div>
            {sum.cameras.length ? (
              <ul className="list-disc pl-4">{sum.cameras.map((c) => <li key={c.id}>{c.label}</li>)}</ul>
            ) : <div>—</div>}
          </div>
          <div>
            <div className="font-semibold text-cp-text">Lampen ({sum.fixtures.length})</div>
            {sum.fixtures.length ? (
              <ul className="list-disc pl-4">{sum.fixtures.map((f) => (
                <li key={f.id}>
                  {f.name || 'Fixture'}
                  {f.purpose ? ` · ${f.purpose}` : ''}
                  {f.colorTemp ? ` · ${f.colorTemp}K` : ''}
                  {f.dimming != null ? ` · ${Math.round(f.dimming * 100)}%` : ''}
                </li>
              ))}</ul>
            ) : <div>—</div>}
          </div>
        </div>
      ),
    })
  }

  // #pre-sale — Manueller "Auf Updates prüfen…"-Flow (Auto-Update beim Quit
  // läuft separat). Zeigt Resultat als Dialog; bei verfügbarem Update bietet
  // es nach Download-Abschluss "Jetzt neu starten" an (electron-updater).
  const handleCheckUpdates = async () => {
    try {
      const r = await cablePlannerApi.updater.check()
      if (!r.ok) {
        await infoDialog(t('app.menu.help.updateUnavailable', 'Update-Prüfung nicht möglich'), {
          tone: 'warning',
          body: t(
            'app.menu.help.updateUnavailableBody',
            'Updates sind nur in der installierten Desktop-Version verfügbar.',
          ),
        })
        return
      }
      if (r.available) {
        await infoDialog(t('app.menu.help.updateAvailable', 'Update verfügbar'), {
          tone: 'success',
          body: format(
            t(
              'app.menu.help.updateAvailableBody',
              'Version {latest} wird im Hintergrund geladen und beim Beenden installiert. Sobald der Download fertig ist, fragt die App nach einem Neustart.',
            ),
            { latest: r.latest ?? '' },
          ),
        })
      } else {
        await infoDialog(t('app.menu.help.updateCurrent', 'Aktuelle Version'), {
          tone: 'info',
          body: format(
            t('app.menu.help.updateCurrentBody', 'Du verwendest bereits die neueste Version ({current}).'),
            { current: r.current },
          ),
        })
      }
    } catch {
      await infoDialog(t('app.menu.help.updateError', 'Update-Prüfung fehlgeschlagen'), { tone: 'error' })
    }
  }

  // #pre-sale — Download-fertig → Neustart anbieten (gilt für Auto- UND
  // manuellen Check). Auto-Install beim Quit greift sonst trotzdem.
  useEffect(() => {
    if (!hasDesktopBridge) return
    return cablePlannerApi.updater.onStatus((s) => {
      if (s.state === 'downloaded') {
        void confirmDialog(t('app.menu.help.updateReady', 'Update bereit'), {
          body: format(
            t('app.menu.help.updateReadyBody', 'Version {version} ist geladen. Jetzt neu starten und aktualisieren?'),
            { version: s.version ?? '' },
          ),
          okLabel: t('app.menu.help.updateRestart', 'Jetzt neu starten'),
          cancelLabel: t('common.later', 'Später'),
        }).then((yes) => {
          if (yes) void cablePlannerApi.updater.quitAndInstall()
        })
      }
    })
  }, [t])
  const rentmanEnabled = useModule('rentman')
  // Modulares UI — Festinstallations-Doku nur zeigen, wenn das Modul an ist.
  const festinstallationModule = useModule('festinstallation')
  // Modulares UI — Handy-Zugriff nur zeigen, wenn das Mobile-Modul an ist.
  const mobileModule = useModule('mobile')
  const rentalModule = useModule('rental')
  // #341 — View-Menü spiegelt Toolbar-Toggles; Status für Häkchen lesen.
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  const followSystemTheme = useUiStore((s) => s.followSystemTheme)
  const snapToGrid = useUiStore((s) => s.snapToGrid)
  const hideAllCableLabels = useUiStore((s) => s.hideAllCableLabels)
  const offPageShowNames = useUiStore((s) => s.offPageShowNames)
  const cableColorMode = useUiStore((s) => s.cableColorMode)
  const annotationsPanelOpen = useUiStore((s) => s.annotationsPanelOpen)
  // Re-render whenever the projectHistory store changes so the undo/redo
  // buttons reflect the current canUndo/canRedo state. Keyboard shortcuts
  // (Strg+Z / Strg+Umsch+Z / Strg+Y) live in useUndoRedoShortcuts; these
  // buttons exist because users couldn't tell that history was working
  // (issue #72). Use stable method references for getSnapshot — inline
  // arrows would create fresh function objects every render and have
  // occasionally been the trigger for React #185 boot loops.
  const canUndo = useSyncExternalStore(
    projectHistory.subscribe,
    projectHistory.canUndo,
    projectHistory.canUndo,
  )
  const canRedo = useSyncExternalStore(
    projectHistory.subscribe,
    projectHistory.canRedo,
    projectHistory.canRedo,
  )
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--cp-border)] bg-[var(--cp-surface-3)] px-3 py-1.5 text-cp-xs shadow-sm">
      <input ref={cameraImportRef} type="file" accept=".cameras.json,.json" className="hidden" onChange={handleImportCameras} />
      <input ref={avplanImportRef} type="file" accept=".avplan,.json" className="hidden" onChange={handleImportAvplan} />
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden select-none font-semibold tracking-wide text-cp-text-secondary lg:inline">
          {t('app.title', 'Cable Planner')}
        </span>
        <span className="hidden text-cp-text-dimmer lg:inline">│</span>

        <Menu label={t('app.menu.file', 'Datei')}>
          <MenuItem onClick={onNewProject} icon={<Icon icon={FileText} size="sm" />} shortcut={t('shortcut.ctrlN', 'Strg+N')}>
            {t('app.menu.file.new', 'Neues Projekt')}
          </MenuItem>
          <MenuItem onClick={() => useUiStore.getState().openTemplates()} icon={<Icon icon={Clapperboard} size="sm" />}>
            {t('app.menu.file.newFromTemplate', 'Neu aus Vorlage…')}
          </MenuItem>
          <MenuItem onClick={onOpenProject} icon={<Icon icon={FolderOpen} size="sm" />} shortcut={t('shortcut.ctrlO', 'Strg+O')}>
            {t('app.menu.file.open', 'Öffnen…')}
          </MenuItem>
          <MenuSep />
          <MenuItem onClick={onSaveProject} icon={<Icon icon={Save} size="sm" />} shortcut={t('shortcut.ctrlS', 'Strg+S')}>
            {t('app.menu.file.save', 'Speichern')}
          </MenuItem>
          <MenuItem onClick={onSaveProjectAs} icon={<Icon icon={SaveAll} size="sm" />} shortcut={t('shortcut.ctrlShiftS', 'Strg+Umsch+S')}>
            {t('app.menu.file.saveAs', 'Speichern unter…')}
          </MenuItem>
          {onOpenGraphmlImport && (
            <>
              <MenuSep />
              <MenuItem onClick={onOpenGraphmlImport} icon={<Icon icon={Ruler} size="sm" />}>
                {t('app.menu.file.importGraphml', 'yEd / GraphML importieren…')}
              </MenuItem>
            </>
          )}
          <MenuItem onClick={() => cameraImportRef.current?.click()} icon={<Icon icon={ImportIcon} size="sm" />}>
            {t('app.menu.file.importCameras', 'MultiCam-Kameras importieren…')}
          </MenuItem>
          <MenuSep />
          <MenuItem onClick={handleExportAvplan} icon={<Icon icon={Upload} size="sm" />}>
            {t('app.menu.file.exportAvplan', 'Gesamtprojekt exportieren (.avplan)…')}
          </MenuItem>
          <MenuItem onClick={() => avplanImportRef.current?.click()} icon={<Icon icon={ImportIcon} size="sm" />}>
            {t('app.menu.file.importAvplan', 'Gesamtprojekt importieren (.avplan)…')}
          </MenuItem>
          {hasForeign(avForeign) && (
            <MenuItem onClick={handleViewForeign} icon={<Icon icon={Eye} size="sm" />}>
              {t('app.menu.file.viewForeign', 'Verknüpfte Venue-Planung ansehen…')}
            </MenuItem>
          )}
          <MenuSep />
          {/* v7.9.2 — Vereinheitlichter Export-Hub. Statt 5 separater
              Menü-Einträge (Plan PDF/PNG/JPEG, Kabel-BOM, Drucken)
              führt jetzt ein einziger "Exportieren & Drucken…"-
              Eintrag zum Hub-Dialog mit allen Sektionen.
              User-Request: "Vereinheitliche zu einer Großen funktion".
              Strg+P bleibt als direkter Shortcut für den OS-Druckdialog. */}
          {onOpenExportDialog ? (
            <MenuItem onClick={onOpenExportDialog} icon={<Icon icon={Upload} size="sm" />}>
              {t('app.menu.file.export', 'Exportieren & Drucken…')}
            </MenuItem>
          ) : (
            <>
              <MenuItem onClick={onExportPdf} icon={<Icon icon={FileDown} size="sm" />}>
                {t('app.menu.file.exportPdf', 'Plan als PDF exportieren…')}
              </MenuItem>
              {onExportPng && (
                <MenuItem onClick={onExportPng} icon={<Icon icon={ImageIcon} size="sm" />}>
                  {t('app.menu.file.exportPng', 'Plan als PNG exportieren…')}
                </MenuItem>
              )}
              {onExportJpeg && (
                <MenuItem onClick={onExportJpeg} icon={<Icon icon={ImageIcon} size="sm" />}>
                  {t('app.menu.file.exportJpeg', 'Plan als JPEG exportieren…')}
                </MenuItem>
              )}
              {onOpenCableBom && (
                <MenuItem onClick={onOpenCableBom} icon={<Icon icon={Calculator} size="sm" />}>
                  {t('app.menu.file.cableBom', 'Kabel-Stückliste (BOM) exportieren…')}
                </MenuItem>
              )}
            </>
          )}
          {/* v7.9.4 — Eigenständiger "Drucken (OS-Dialog)…"-Eintrag
              entfernt — war doppelt zur "Drucken"-Sektion im
              Exportieren-&-Drucken-Hub (User-Bug: "Datei → Drucken
              ist doppelt"). */}
          {/* v7.9.3 — Viewer-Workflow: Plan als .cpviewer für externe
              Reviewer exportieren, später deren Anmerkungen zurück
              mergen. v8.x: Wort "Freelancer" entfernt (#405/#406 —
              Workflow ist nicht freelancer-spezifisch). */}
          {(onExportViewer || onImportAnnotations) && <MenuSep />}
          {onExportViewer && (
            <MenuItem onClick={onExportViewer} icon={<Icon icon={Eye} size="sm" />}>
              {t('app.menu.file.exportViewer', 'Als Viewer-Datei exportieren…')}
            </MenuItem>
          )}
          {onImportAnnotations && (
            <MenuItem onClick={onImportAnnotations} icon={<Icon icon={MessageSquare} size="sm" />}>
              {t('app.menu.file.importAnnotations', 'Anmerkungen aus Viewer-Datei importieren…')}
            </MenuItem>
          )}
          {/* v7.9.4 — Rentman-Menü-Einträge nur wenn die Integration
              in den Einstellungen aktiviert ist. */}
          {rentmanEnabled && (onAttachPdfToRentman || onOpenRentmanCableExport) && <MenuSep />}
          {rentmanEnabled && onAttachPdfToRentman && (
            <MenuItem
              onClick={hasRentmanLink ? onAttachPdfToRentman : undefined}
              icon={<Icon icon={Paperclip} size="sm" />}
            >
              {hasRentmanLink
                ? t('app.menu.file.attachRentman', 'Plan an Rentman anhängen…')
                : t(
                    'app.menu.file.attachRentmanDisabled',
                    'Plan an Rentman anhängen (kein Projekt verknüpft)',
                  )}
            </MenuItem>
          )}
          {rentmanEnabled && onOpenRentmanCableExport && (
            <MenuItem
              onClick={hasRentmanLink ? onOpenRentmanCableExport : undefined}
              icon={<Icon icon={Plug} size="sm" />}
            >
              {hasRentmanLink
                ? t('app.menu.file.cablesRentman', 'Kabel an Rentman senden…')
                : t(
                    'app.menu.file.cablesRentmanDisabled',
                    'Kabel an Rentman senden (kein Projekt verknüpft)',
                  )}
            </MenuItem>
          )}
        </Menu>

        <Menu label={t('app.menu.edit', 'Bearbeiten')}>
          {/* #340 — Standard-Edit-Aktionen auch im Menü (vorher nur Icon-
              Buttons/Shortcuts). Undo/Redo über projectHistory, Löschen/
              Auswahl-aufheben über die (globale) Projekt-Store-Selection. */}
          <MenuItem
            onClick={() => projectHistory.undo()}
            disabled={!canUndo}
            icon={<Icon icon={Undo2} size="sm" />}
            shortcut={t('shortcut.ctrlZ', 'Strg+Z')}
          >
            {t('app.menu.edit.undo', 'Rückgängig')}
          </MenuItem>
          <MenuItem
            onClick={() => projectHistory.redo()}
            disabled={!canRedo}
            icon={<Icon icon={Redo2} size="sm" />}
            shortcut={t('shortcut.ctrlY', 'Strg+Y')}
          >
            {t('app.menu.edit.redo', 'Wiederherstellen')}
          </MenuItem>
          <MenuSep />
          <MenuItem
            onClick={() => triggerCanvasDuplicate()}
            icon={<Icon icon={Copy} size="sm" />}
            shortcut={t('shortcut.ctrlD', 'Strg+D')}
          >
            {t('app.menu.edit.duplicate', 'Duplizieren')}
          </MenuItem>
          <MenuItem
            onClick={() => useProjectStore.getState().deleteSelected()}
            shortcut={t('shortcut.del', 'Entf')}
          >
            {t('app.menu.edit.delete', 'Auswahl löschen')}
          </MenuItem>
          <MenuItem
            onClick={() => triggerCanvasSelectAll()}
            icon={<Icon icon={BoxSelect} size="sm" />}
            shortcut={t('shortcut.ctrlA', 'Strg+A')}
          >
            {t('app.menu.edit.selectAll', 'Alles auswählen')}
          </MenuItem>
          <MenuItem
            onClick={() => useProjectStore.getState().setSelection()}
            shortcut={t('shortcut.esc', 'Esc')}
          >
            {t('app.menu.edit.clearSelection', 'Auswahl aufheben')}
          </MenuItem>
        </Menu>

        <Menu label={t('app.menu.tools', 'Werkzeuge')}>
          {/* Gruppiert in vier thematische Abschnitte (Findbarkeit bei ~18
              Einträgen). Patchliste-Export liegt zusätzlich unter Datei →
              Exportieren & Drucken. */}
          <MenuSectionHeader>{t('app.menu.tools.group.calc', 'Berechnen & analysieren')}</MenuSectionHeader>
          <MenuItem
            onClick={() => useUiStore.getState().openBandwidthCalc()}
            icon={<Icon icon={Radio} size="sm" />}
          >
            {t('app.menu.tools.bandwidth', 'Bandbreite berechnen…')}
          </MenuItem>
          <MenuItem
            onClick={() => useUiStore.getState().openPowerCalc()}
            icon={<Icon icon={Zap} size="sm" />}
          >
            {t('app.menu.tools.power', 'Stromverbrauch berechnen…')}
          </MenuItem>
          <MenuItem
            onClick={() => useUiStore.getState().openRecordingStorageCalc()}
            icon={<Icon icon={HardDrive} size="sm" />}
          >
            {t('app.menu.tools.recStorage', 'Recording-Speicherplatz berechnen…')}
          </MenuItem>
          <MenuItem
            onClick={() => useUiStore.getState().openProjectionCalc()}
            icon={<Icon icon={MonitorPlay} size="sm" />}
          >
            {t('app.menu.tools.projection', 'Projektion & Display…')}
          </MenuItem>
          <MenuItem onClick={() => useUiStore.getState().openAnalysis()} icon={<Icon icon={BarChart3} size="sm" />}>
            {t('app.menu.tools.analysis', 'Analysen (Gewicht/Netzwerk/Redundanz)…')}
          </MenuItem>
          <MenuItem onClick={() => useUiStore.getState().openPlanCheck()} icon={<Icon icon={ClipboardCheck} size="sm" />}>
            {t('app.menu.tools.planCheck', 'Plan-Check…')}
          </MenuItem>
          <MenuItem onClick={() => useUiStore.getState().setDrumMicingOpen(true)} icon={<Icon icon={Drum} size="sm" />}>
            {t('app.menu.tools.drumMicing', 'Drum-Mikrofonierung…')}
          </MenuItem>
          <MenuItem onClick={() => useUiStore.getState().setWirelessRigOpen(true)} icon={<Icon icon={Radio} size="sm" />}>
            {t('app.menu.tools.wirelessRig', 'Funkstrecken / Gesang…')}
          </MenuItem>

          <MenuSectionHeader>{t('app.menu.tools.group.build', 'Erstellen & verwalten')}</MenuSectionHeader>
          <MenuItem
            onClick={() => useUiStore.getState().openBulkConnect()}
            icon={<Icon icon={Cable} size="sm" />}
          >
            {t('app.menu.tools.bulkConnect', 'Mehrere Kabel verbinden…')}
          </MenuItem>
          <MenuItem
            onClick={() => useUiStore.getState().triggerNewRackBuilder()}
            icon={<Icon icon={Server} size="sm" />}
          >
            {t('app.menu.tools.newRack', 'Neues Rack erstellen…')}
          </MenuItem>
          <MenuItem
            onClick={() => useUiStore.getState().triggerRackBuilderFromSelection([])}
            icon={<Icon icon={Server} size="sm" />}
          >
            {t('app.menu.tools.rackBuilder', 'Rack-Builder…')}
          </MenuItem>
          <MenuItem onClick={() => useUiStore.getState().openAiPlanGen()} icon={<Icon icon={Sparkles} size="sm" />}>
            {t('app.menu.tools.aiPlanGen', 'KI-Plan generieren…')}
          </MenuItem>
          <MenuItem onClick={() => useUiStore.getState().openRevisions()} icon={<Icon icon={History} size="sm" />}>
            {t('app.menu.tools.revisions', 'Revisionen & Snapshots…')}
          </MenuItem>
          {rentalModule && (
            <MenuItem onClick={() => useUiStore.getState().openInventory()} icon={<Icon icon={Boxes} size="sm" />}>
              {t('app.menu.tools.inventory', 'Lager / Bestand…')}
            </MenuItem>
          )}

          <MenuSectionHeader>{t('app.menu.tools.group.deviceConfig', 'Geräte-Konfiguration')}</MenuSectionHeader>
          <MenuItem onClick={() => useUiStore.getState().openAtemMvConfig()} icon={<Icon icon={Monitor} size="sm" />}>
            {t('app.menu.tools.atemMv', 'ATEM Multiviewer-Layout…')}
          </MenuItem>
          <MenuItem onClick={() => useUiStore.getState().openAtemAudioConfig()} icon={<Icon icon={SlidersHorizontal} size="sm" />}>
            {t('app.menu.tools.atemAudio', 'ATEM Audio-Routing…')}
          </MenuItem>
          <MenuItem onClick={() => useUiStore.getState().openAtemDialog()} icon={<Icon icon={Tag} size="sm" />}>
            {t('app.menu.tools.atemLabels', 'ATEM Input-Labels…')}
          </MenuItem>
          <MenuItem onClick={() => useUiStore.getState().openVideohubExport()} icon={<Icon icon={Shuffle} size="sm" />}>
            {t('app.menu.tools.videohub', 'Videohub-Routing/Labels…')}
          </MenuItem>
          <MenuItem onClick={() => useUiStore.getState().openGreenGoExport()} icon={<Icon icon={Headphones} size="sm" />}>
            {t('app.menu.tools.greengo', 'GreenGo-Intercom…')}
          </MenuItem>

          <MenuSectionHeader>{t('app.menu.tools.group.io', 'Import & Export')}</MenuSectionHeader>
          <MenuItem onClick={() => useUiStore.getState().openPatchList()} icon={<Icon icon={Cable} size="sm" />}>
            {t('app.menu.tools.patchList', 'Patch-Liste…')}
          </MenuItem>
          {festinstallationModule && (
            <MenuItem onClick={() => useUiStore.getState().openInstallDocs()} icon={<Icon icon={PackageCheck} size="sm" />}>
              {t('app.menu.tools.installDocs', 'Festinstallation: Doku & Übergabe…')}
            </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              const p = useProjectStore.getState().project
              downloadBlob(
                buildExportFilename(p.metadata.name, 'stageplot.svg'),
                exportStagePlotSvg(p),
                'image/svg+xml',
              )
            }}
            icon={<Icon icon={ImageIcon} size="sm" />}
          >
            {t('app.menu.tools.stagePlot', 'Stage-Plot (SVG)…')}
          </MenuItem>
          <MenuItem onClick={() => useUiStore.getState().openCsvImport()} icon={<Icon icon={ImportIcon} size="sm" />}>
            {t('app.menu.tools.csvImport', 'Equipment aus CSV importieren…')}
          </MenuItem>
          {/* Rentman-Import nur wenn die Integration aktiv ist (standardmäßig
              aus; Aktivierung in den Einstellungen → Integrationen). */}
          {rentmanEnabled && (
            <MenuItem onClick={() => useUiStore.getState().openRentmanImport()} icon={<Icon icon={Users} size="sm" />}>
              {t('app.menu.tools.rentmanImport', 'Rentman-Import…')}
            </MenuItem>
          )}
        </Menu>

        <Menu label={t('app.menu.view', 'Ansicht')}>
          {/* #341 — Zoom-Aktionen + View-Toggles (Toolbar-redundant);
              Häkchen zeigt den aktuellen Zustand beim erneuten Öffnen. */}
          <MenuItem onClick={() => triggerCanvasFitView()} icon={<Icon icon={Maximize} size="sm" />}>
            {t('app.menu.view.fit', 'Einpassen')}
          </MenuItem>
          <MenuItem onClick={() => triggerCanvasResetZoom()} icon={<Icon icon={Scan} size="sm" />}>
            {t('app.menu.view.zoom100', 'Zoom 100 %')}
          </MenuItem>
          <MenuItem onClick={() => triggerCanvasZoomIn()} icon={<Icon icon={ZoomIn} size="sm" />}>
            {t('app.menu.view.zoomIn', 'Vergrößern')}
          </MenuItem>
          <MenuItem onClick={() => triggerCanvasZoomOut()} icon={<Icon icon={ZoomOut} size="sm" />}>
            {t('app.menu.view.zoomOut', 'Verkleinern')}
          </MenuItem>
          {/* #427 — Vollbild: Canvas ueber den ganzen Monitor (per OS-Maximize
              auch ueber mehrere Monitore strecken). Fullscreen-API. */}
          <MenuItem
            onClick={() => {
              try {
                if (document.fullscreenElement) void document.exitFullscreen?.()
                else void document.documentElement.requestFullscreen?.()
              } catch { /* ignore */ }
            }}
            icon={<Icon icon={Maximize2} size="sm" />}
          >
            {t('app.menu.view.fullscreen', 'Vollbild')}
          </MenuItem>
          <MenuSep />
          <MenuItem
            onClick={() => {
              // #453 — manuelle Theme-Wahl beendet das OS-Folgen.
              useUiStore.getState().setFollowSystemTheme(false)
              useUiStore.getState().setCanvasTheme(canvasTheme === 'dark' ? 'light' : 'dark')
            }}
            icon={canvasTheme === 'light' ? <Icon icon={Check} size="sm" /> : null}
          >
            {t('app.menu.view.light', 'Helles Design')}
          </MenuItem>
          <MenuItem
            onClick={() => useUiStore.getState().setFollowSystemTheme(!followSystemTheme)}
            icon={followSystemTheme ? <Icon icon={Check} size="sm" /> : null}
          >
            {t('app.menu.view.followSystem', 'System-Theme folgen')}
          </MenuItem>
          <MenuItem
            onClick={() => useUiStore.getState().setSnapToGrid(!snapToGrid)}
            icon={snapToGrid ? <Icon icon={Check} size="sm" /> : null}
          >
            {t('app.menu.view.snap', 'Am Raster ausrichten')}
          </MenuItem>
          <MenuItem
            onClick={() => useUiStore.getState().setHideAllCableLabels(!hideAllCableLabels)}
            icon={hideAllCableLabels ? <Icon icon={Check} size="sm" /> : null}
          >
            {t('app.menu.view.hideLabels', 'Kabel-Labels ausblenden')}
          </MenuItem>
          <MenuItem
            onClick={() => useUiStore.getState().setOffPageShowNames(!offPageShowNames)}
            icon={offPageShowNames ? <Icon icon={Check} size="sm" /> : null}
          >
            {t('app.menu.view.offPageNames', 'Off-Page-Namen anzeigen')}
          </MenuItem>
          <MenuItem
            onClick={() =>
              useUiStore.getState().setCableColorMode(cableColorMode === 'byLength' ? 'manual' : 'byLength')
            }
            icon={cableColorMode === 'byLength' ? <Icon icon={Check} size="sm" /> : null}
          >
            {t('app.menu.view.colorByLength', 'Kabelfarbe nach Länge')}
          </MenuItem>
          <MenuSep />
          <MenuItem
            onClick={() => useUiStore.getState().setAnnotationsPanelOpen(!annotationsPanelOpen)}
            icon={annotationsPanelOpen ? <Icon icon={Check} size="sm" /> : null}
          >
            {t('app.menu.view.annotations', 'Anmerkungen-Panel')}
          </MenuItem>
        </Menu>

        <Menu label={t('app.menu.help', 'Hilfe')}>
          <MenuItem
            onClick={() => window.dispatchEvent(new CustomEvent('cp:open-command-palette'))}
            icon={<Icon icon={Command} size="sm" />}
            shortcut={t('shortcut.ctrlK', 'Strg+K')}
          >
            {t('app.menu.help.commandPalette', 'Befehlspalette…')}
          </MenuItem>
          <MenuItem
            onClick={() => window.dispatchEvent(new CustomEvent('cp:open-shortcuts-help'))}
            icon={<Icon icon={Keyboard} size="sm" />}
            shortcut="?"
          >
            {t('app.menu.help.shortcuts', 'Tastaturkürzel…')}
          </MenuItem>
          {onOpenTour && (
            <MenuItem onClick={onOpenTour} icon={<Icon icon={Lightbulb} size="sm" />}>
              {t('app.menu.help.tour', 'Erste-Schritte-Tour…')}
            </MenuItem>
          )}
          {hasDesktopBridge && (
            <MenuItem onClick={handleCheckUpdates} icon={<Icon icon={RefreshCw} size="sm" />}>
              {t('app.menu.help.checkUpdates', 'Auf Updates prüfen…')}
            </MenuItem>
          )}
          <MenuItem
            onClick={() => useUiStore.getState().openAboutDialog()}
            icon={<Icon icon={Info} size="sm" />}
          >
            {t('app.menu.help.about', 'Über Cable Planner…')}
          </MenuItem>
        </Menu>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        {projectName && (
          <button
            type="button"
            onClick={onEditProjectMeta}
            disabled={!onEditProjectMeta}
            className="group flex max-w-[42ch] items-center gap-1 truncate rounded px-2 py-0.5 text-cp-text-bright hover:bg-cp-surface-2 hover:text-white disabled:cursor-default disabled:hover:bg-transparent"
            title={onEditProjectMeta ? t('app.editProjectMeta', 'Projektdaten bearbeiten') : projectName}
          >
            <span className="truncate font-medium">{projectName}</span>
            {onEditProjectMeta && (
              <span className="text-cp-text-faint opacity-0 transition-opacity group-hover:opacity-100">
                <Icon icon={Pencil} size="xs" />
              </span>
            )}
          </button>
        )}

      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center rounded border border-cp-border bg-cp-surface-1">
          <button
            type="button"
            onClick={() => projectHistory.undo()}
            disabled={!canUndo}
            title={t('app.undo', 'Rückgängig (Strg+Z)')}
            aria-label={t('app.undo', 'Rückgängig (Strg+Z)')}
            className="px-2 py-1 text-cp-text-bright hover:bg-cp-surface-2 disabled:cursor-not-allowed disabled:text-cp-text-dim disabled:hover:bg-transparent"
          >
            <Icon icon={Undo2} size="sm" />
          </button>
          <span className="h-4 w-px bg-cp-surface-4" aria-hidden="true" />
          <button
            type="button"
            onClick={() => projectHistory.redo()}
            disabled={!canRedo}
            title={t('app.redo', 'Wiederherstellen (Strg+Y)')}
            aria-label={t('app.redo', 'Wiederherstellen (Strg+Y)')}
            className="px-2 py-1 text-cp-text-bright hover:bg-cp-surface-2 disabled:cursor-not-allowed disabled:text-cp-text-dim disabled:hover:bg-transparent"
          >
            <Icon icon={Redo2} size="sm" />
          </button>
        </div>
        <SharedSyncPanel />
        {hasDesktopBridge && mobileModule && (
          <button
            type="button"
            onClick={() => useUiStore.getState().openMobileShare()}
            className="rounded bg-cp-surface-2 px-2 py-1 text-cp-text hover:bg-cp-surface-4"
            aria-label={t('app.mobileShare.ariaLabel', 'Handy-Zugriff')}
            title={t(
              'app.mobileShare.title',
              'Handy-Zugriff: kleiner LAN-Server + QR-Code, damit das Handy den Mobile-Viewer öffnen kann.',
            )}
          >
            <Icon icon={Smartphone} size="sm" />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex items-center gap-1 rounded bg-cp-surface-2 px-2 py-1 text-cp-text hover:bg-cp-surface-4"
          title={t('settings.title', 'Einstellungen')}
        >
          <Icon icon={Settings} size="sm" />
          <span className="hidden lg:inline">{t('settings.title', 'Einstellungen')}</span>
        </button>
      </div>
    </header>
  )
}

/* -------------------------------------------------------------------------- */
/*                            Tiny dropdown menu                              */
/* -------------------------------------------------------------------------- */

interface MenuProps {
  label: string
  children: React.ReactNode
}

const Menu = ({ label, children }: MenuProps) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // #461 — Tastatur-Navigation im offenen Menue: beim Oeffnen ersten Eintrag
  // fokussieren, Pfeile/Home/End bewegen den Fokus zwischen den menuitems.
  useEffect(() => {
    if (!open || !ref.current) return
    ref.current.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')?.focus()
  }, [open])

  const moveFocus = (dir: 1 | -1 | 'first' | 'last'): void => {
    const items = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [],
    )
    if (items.length === 0) return
    const cur = items.findIndex((el) => el === document.activeElement)
    const next =
      dir === 'first'
        ? 0
        : dir === 'last'
          ? items.length - 1
          : cur < 0
            ? dir === 1
              ? 0
              : items.length - 1
            : (cur + dir + items.length) % items.length
    items[next]?.focus()
  }
  const onMenuKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveFocus(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      moveFocus('first')
    } else if (event.key === 'End') {
      event.preventDefault()
      moveFocus('last')
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`rounded px-2 py-1 text-cp-text-bright hover:bg-cp-surface-2 ${open ? 'bg-cp-surface-2' : ''}`}
      >
        {label}
        <span className="ml-1 text-[11px] text-cp-text-muted" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          onKeyDown={onMenuKeyDown}
          className="absolute left-0 top-full z-50 mt-1 min-w-[14rem] rounded border border-[var(--cp-border)] bg-[var(--cp-surface-1)] py-1 shadow-2xl"
          role="menu"
        >
          {children}
        </div>
      )}
    </div>
  )
}

interface MenuItemProps {
  onClick?: () => void
  icon?: React.ReactNode
  shortcut?: string
  disabled?: boolean
  children: React.ReactNode
}

const MenuItem = ({ onClick, icon, shortcut, disabled, children }: MenuItemProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-cp-xs text-cp-text-bright hover:bg-cp-surface-4/70 disabled:cursor-not-allowed disabled:text-[var(--cp-text-faint)] disabled:hover:bg-transparent"
      role="menuitem"
    >
      <span className="inline-flex w-4 shrink-0 items-center justify-center text-[var(--cp-text-muted)]">{icon}</span>
      <span className="flex-1 truncate">{children}</span>
      {shortcut && (
        <span className="ml-3 shrink-0 text-cp-xs tracking-wide text-[var(--cp-text-faint)]">
          {shortcut}
        </span>
      )}
    </button>
  )
}

const MenuSep = () => <div className="my-1 border-t border-cp-border" />

/** Kleiner, nicht-interaktiver Gruppen-Titel innerhalb eines Menüs. Gliedert
 *  lange Menüs (z. B. Werkzeuge) optisch, ohne echte Flyout-Submenüs. */
const MenuSectionHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="px-3 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cp-text-faint)] select-none">
    {children}
  </div>
)
