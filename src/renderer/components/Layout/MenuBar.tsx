import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  FileText, Clapperboard, FolderOpen, Save, SaveAll, Ruler, Upload, FileDown,
  Image as ImageIcon, Calculator, Eye, MessageSquare, Paperclip, Plug, Cable,
  Undo2, Redo2, Radio, Zap, BarChart3, Server, Monitor, SlidersHorizontal, Tag,
  Shuffle, Headphones, Import as ImportIcon, Users, Lightbulb, Info, Check,
} from 'lucide-react'
import { Icon } from '../shared/Icon'
import { SharedSyncPanel } from '../Sync/SharedSyncPanel'
import { useTranslation } from '../../lib/i18n'
import { projectHistory } from '../../store/projectHistory'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { hasDesktopBridge } from '../../lib/bridge'

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
  videoFormat?: string
  onChangeVideoFormat?: (id: string) => void
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
  videoFormat,
  onChangeVideoFormat,
  projectName,
}: MenuBarProps) => {
  const t = useTranslation()
  const rentmanEnabled = useUiStore((s) => s.rentmanEnabled)
  // #341 — View-Menü spiegelt Toolbar-Toggles; Status für Häkchen lesen.
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  const snapToGrid = useUiStore((s) => s.snapToGrid)
  const hideAllCableLabels = useUiStore((s) => s.hideAllCableLabels)
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
      <div className="flex items-center gap-2">
        <span className="select-none font-semibold tracking-wide text-slate-300">
          {t('app.title', 'Cable Planner')}
        </span>
        <span className="text-slate-700">│</span>

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
          {/* v7.9.3 — Viewer-Workflow: Plan als .cpviewer für Freelancer
              exportieren, später deren Anmerkungen zurück mergen. */}
          {(onExportViewer || onImportAnnotations) && <MenuSep />}
          {onExportViewer && (
            <MenuItem onClick={onExportViewer} icon={<Icon icon={Eye} size="sm" />}>
              {t('app.menu.file.exportViewer', 'Als Viewer-Datei für Freelancer exportieren…')}
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
            onClick={() => useProjectStore.getState().deleteSelected()}
            shortcut={t('shortcut.del', 'Entf')}
          >
            {t('app.menu.edit.delete', 'Auswahl löschen')}
          </MenuItem>
          <MenuItem
            onClick={() => useProjectStore.getState().setSelection()}
            shortcut={t('shortcut.esc', 'Esc')}
          >
            {t('app.menu.edit.clearSelection', 'Auswahl aufheben')}
          </MenuItem>
        </Menu>

        <Menu label={t('app.menu.tools', 'Werkzeuge')}>
          {/* v7.9.126 — Patchliste-Eintrag entfernt — ist jetzt unter
              Datei → Exportieren & Drucken → Patch-Sheets erreichbar
              (User-Request: passt thematisch besser zu den
              Export-/Druck-Funktionen). */}
          <MenuItem
            onClick={() => useUiStore.getState().openCalculators('bandwidth')}
            icon={<Icon icon={Radio} size="sm" />}
          >
            {t('app.menu.tools.bandwidth', 'Bandbreite berechnen…')}
          </MenuItem>
          <MenuItem
            onClick={() => useUiStore.getState().openCalculators('power')}
            icon={<Icon icon={Zap} size="sm" />}
          >
            {t('app.menu.tools.power', 'Stromverbrauch berechnen…')}
          </MenuItem>
          <MenuItem onClick={() => useUiStore.getState().openAnalysis()} icon={<Icon icon={BarChart3} size="sm" />}>
            {t('app.menu.tools.analysis', 'Analysen (Gewicht/Netzwerk/Redundanz)…')}
          </MenuItem>
          <MenuSep />
          {/* #342 — Editoren direkt aus dem Werkzeuge-Menü erreichbar machen
              (vorher nur über Toolbar bzw. verknüpftes Gerät in den
              Properties). Dialoge öffnen geräteneutral und bieten ggf.
              eigene Geräteauswahl. */}
          <MenuItem
            onClick={() => useUiStore.getState().triggerRackBuilderFromSelection([])}
            icon={<Icon icon={Server} size="sm" />}
          >
            {t('app.menu.tools.rackBuilder', 'Rack-Builder…')}
          </MenuItem>
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
          <MenuSep />
          <MenuItem onClick={() => useUiStore.getState().openPatchList()} icon={<Icon icon={Cable} size="sm" />}>
            {t('app.menu.tools.patchList', 'Patch-Liste…')}
          </MenuItem>
          <MenuItem onClick={() => useUiStore.getState().openCsvImport()} icon={<Icon icon={ImportIcon} size="sm" />}>
            {t('app.menu.tools.csvImport', 'Equipment aus CSV importieren…')}
          </MenuItem>
          {rentmanEnabled && (
            <MenuItem onClick={() => useUiStore.getState().openRentmanImport()} icon={<Icon icon={Users} size="sm" />}>
              {t('app.menu.tools.rentmanImport', 'Rentman-Import…')}
            </MenuItem>
          )}
        </Menu>

        <Menu label={t('app.menu.view', 'Ansicht')}>
          {/* #341 — View-Toggles redundant zum Toolbar-Zugang; Häkchen
              zeigt den aktuellen Zustand (beim erneuten Öffnen). */}
          <MenuItem
            onClick={() => useUiStore.getState().setCanvasTheme(canvasTheme === 'dark' ? 'light' : 'dark')}
            icon={canvasTheme === 'light' ? <Icon icon={Check} size="sm" /> : null}
          >
            {t('app.menu.view.light', 'Helles Design')}
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
          {onOpenTour && (
            <MenuItem onClick={onOpenTour} icon={<Icon icon={Lightbulb} size="sm" />}>
              {t('app.menu.help.tour', 'Erste-Schritte-Tour…')}
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
            className="group flex max-w-[42ch] items-center gap-1 truncate rounded px-2 py-0.5 text-slate-200 hover:bg-slate-800 hover:text-white disabled:cursor-default disabled:hover:bg-transparent"
            title={onEditProjectMeta ? t('app.editProjectMeta', 'Projektdaten bearbeiten') : projectName}
          >
            <span className="truncate font-medium">{projectName}</span>
            {onEditProjectMeta && (
              <span className="text-[10px] text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">
                ✎
              </span>
            )}
          </button>
        )}

      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center rounded border border-slate-700 bg-slate-900">
          <button
            type="button"
            onClick={() => projectHistory.undo()}
            disabled={!canUndo}
            title={t('app.undo', 'Rückgängig (Strg+Z)')}
            aria-label={t('app.undo', 'Rückgängig (Strg+Z)')}
            className="px-2 py-1 text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-600 disabled:hover:bg-transparent"
          >
            ⟲
          </button>
          <span className="h-4 w-px bg-slate-700" aria-hidden="true" />
          <button
            type="button"
            onClick={() => projectHistory.redo()}
            disabled={!canRedo}
            title={t('app.redo', 'Wiederherstellen (Strg+Y)')}
            aria-label={t('app.redo', 'Wiederherstellen (Strg+Y)')}
            className="px-2 py-1 text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-600 disabled:hover:bg-transparent"
          >
            ⟳
          </button>
        </div>
        <SharedSyncPanel />
        {onChangeVideoFormat && (
          <label className="flex items-center gap-1 text-cp-xs text-[var(--cp-text-muted)]">
            <span>{t('app.videoFormat', 'Format:')}</span>
            <select
              value={videoFormat ?? '1080p50'}
              onChange={(event) => onChangeVideoFormat(event.target.value)}
              className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-xs text-slate-100"
              title={t('app.videoFormatTitle', 'Projekt-Standard-Videoformat (SDI)')}
            >
              <option value="1080i50">1080i50</option>
              <option value="1080p25">1080p25</option>
              <option value="1080p50">1080p50 (3G)</option>
              <option value="1080p60">1080p60 (3G)</option>
              <option value="2160p25">2160p25 (6G)</option>
              <option value="2160p30">2160p30 (6G)</option>
              <option value="2160p50">2160p50 (12G)</option>
              <option value="2160p60">2160p60 (12G)</option>
            </select>
          </label>
        )}
        {hasDesktopBridge && (
          <button
            type="button"
            onClick={() => useUiStore.getState().openMobileShare()}
            className="rounded bg-slate-800 px-2 py-1 text-slate-100 hover:bg-slate-700"
            aria-label={t('app.mobileShare.ariaLabel', 'Handy-Zugriff')}
            title={t(
              'app.mobileShare.title',
              'Handy-Zugriff: kleiner LAN-Server + QR-Code, damit das Handy den Mobile-Viewer öffnen kann.',
            )}
          >
            📱
          </button>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded bg-slate-800 px-2 py-1 text-slate-100 hover:bg-slate-700"
          title={t('settings.title', 'Einstellungen')}
        >
          ⚙ {t('settings.title', 'Einstellungen')}
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`rounded px-2 py-1 text-slate-200 hover:bg-slate-800 ${open ? 'bg-slate-800' : ''}`}
      >
        {label}
        <span className="ml-1 text-[9px] text-slate-500" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
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
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-cp-xs text-slate-200 hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:text-[var(--cp-text-faint)] disabled:hover:bg-transparent"
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

const MenuSep = () => <div className="my-1 border-t border-slate-700" />
