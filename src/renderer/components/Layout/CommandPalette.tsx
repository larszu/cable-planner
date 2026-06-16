// #ux — Befehlspalette (Strg/Cmd+K).
//
// Schnellzugriff auf die wichtigsten Aktionen per Tipp-Suche — wie in VS Code.
// Öffnet mit Strg/Cmd+K und über das Hilfe-Menü (CustomEvent
// 'cp:open-command-palette'). Alle Kommandos rufen STABILE globale Aktionen
// (uiStore.getState().open*, projectHistory, canvasViewport-Bridges), daher
// muss die Palette selbst nichts aus den Stores abonnieren.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Search } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { projectHistory } from '../../store/projectHistory'
import {
  triggerCanvasFitView,
  triggerCanvasZoomIn,
  triggerCanvasZoomOut,
  triggerCanvasResetZoom,
  triggerCanvasSelectAll,
  triggerCanvasDuplicate,
} from '../../lib/canvasViewport'
import { createDemoProject } from '../../lib/demoProject'
import { useTranslation } from '../../lib/i18n'
import { Icon } from '../shared/Icon'

interface Command {
  id: string
  title: string
  group: string
  run: () => void
}

const isMac =
  typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent || '')

export const CommandPalette = () => {
  const t = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const close = () => {
    setOpen(false)
    setQuery('')
    setActive(0)
  }

  // Strg/Cmd+K öffnet/schließt; Hilfe-Menü öffnet via CustomEvent.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen((o) => !o)
        setQuery('')
        setActive(0)
      }
    }
    const onOpen = () => {
      setOpen(true)
      setQuery('')
      setActive(0)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('cp:open-command-palette', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('cp:open-command-palette', onOpen)
    }
  }, [])

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  const gEdit = t('app.menu.edit', 'Bearbeiten')
  const gView = t('app.menu.view', 'Ansicht')
  const gTools = t('app.menu.tools', 'Werkzeuge')
  const gHelp = t('app.menu.help', 'Hilfe')
  const ui = () => useUiStore.getState()

  const commands = useMemo<Command[]>(
    () => [
      { id: 'undo', group: gEdit, title: t('app.menu.edit.undo', 'Rückgängig'), run: () => projectHistory.undo() },
      { id: 'redo', group: gEdit, title: t('app.menu.edit.redo', 'Wiederherstellen'), run: () => projectHistory.redo() },
      { id: 'duplicate', group: gEdit, title: t('app.menu.edit.duplicate', 'Duplizieren'), run: () => triggerCanvasDuplicate() },
      { id: 'selectAll', group: gEdit, title: t('app.menu.edit.selectAll', 'Alles auswählen'), run: () => triggerCanvasSelectAll() },
      { id: 'fit', group: gView, title: t('app.menu.view.fit', 'Einpassen'), run: () => triggerCanvasFitView() },
      { id: 'zoomIn', group: gView, title: t('palette.zoomIn', 'Vergrößern'), run: () => triggerCanvasZoomIn() },
      { id: 'zoomOut', group: gView, title: t('palette.zoomOut', 'Verkleinern'), run: () => triggerCanvasZoomOut() },
      { id: 'zoomReset', group: gView, title: t('palette.zoomReset', 'Zoom zurücksetzen (100%)'), run: () => triggerCanvasResetZoom() },
      { id: 'planCheck', group: gTools, title: t('app.menu.tools.planCheck', 'Plan-Check…'), run: () => ui().openPlanCheck() },
      { id: 'patchList', group: gTools, title: t('app.menu.tools.patchList', 'Patch-Liste…'), run: () => ui().openPatchList() },
      { id: 'analysis', group: gTools, title: t('app.menu.tools.analysis', 'Analysen…'), run: () => ui().openAnalysis() },
      { id: 'bulkConnect', group: gTools, title: t('app.menu.tools.bulkConnect', 'Mehrere Kabel verbinden…'), run: () => ui().openBulkConnect() },
      { id: 'revisions', group: gTools, title: t('app.menu.tools.revisions', 'Revisionen & Snapshots…'), run: () => ui().openRevisions() },
      { id: 'aiPlanGen', group: gTools, title: t('app.menu.tools.aiPlanGen', 'KI-Plan generieren…'), run: () => ui().openAiPlanGen() },
      { id: 'csvImport', group: gTools, title: t('app.menu.tools.csvImport', 'Equipment aus CSV importieren…'), run: () => ui().openCsvImport() },
      { id: 'bandwidth', group: gTools, title: t('app.menu.tools.bandwidth', 'Bandbreite berechnen…'), run: () => ui().openBandwidthCalc() },
      { id: 'power', group: gTools, title: t('app.menu.tools.power', 'Stromverbrauch berechnen…'), run: () => ui().openPowerCalc() },
      { id: 'recStorage', group: gTools, title: t('app.menu.tools.recStorage', 'Recording-Speicherplatz berechnen…'), run: () => ui().openRecordingStorageCalc() },
      { id: 'projection', group: gTools, title: t('app.menu.tools.projection', 'Projektion & Display…'), run: () => ui().openProjectionCalc() },
      { id: 'installDocs', group: gTools, title: t('app.menu.tools.installDocs', 'Festinstallation: Doku & Übergabe…'), run: () => ui().openInstallDocs() },
      { id: 'loadDemo', group: gTools, title: t('canvas.empty.loadDemo', 'Beispielprojekt laden'), run: () => { useProjectStore.getState().loadProject(createDemoProject()); setTimeout(() => triggerCanvasFitView(), 80) } },
      { id: 'settings', group: gHelp, title: t('palette.settings', 'Einstellungen…'), run: () => ui().openSettings() },
      { id: 'shortcuts', group: gHelp, title: t('app.menu.help.shortcuts', 'Tastaturkürzel…'), run: () => window.dispatchEvent(new CustomEvent('cp:open-shortcuts-help')) },
      { id: 'about', group: gHelp, title: t('app.menu.help.about', 'Über Cable Planner…'), run: () => ui().openAboutDialog() },
    ],
    [t, gEdit, gView, gTools, gHelp],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => `${c.title} ${c.group}`.toLowerCase().includes(q))
  }, [query, commands])

  // aktiven Eintrag in Sicht halten
  useEffect(() => {
    const node = listRef.current?.children[active] as HTMLElement | undefined
    node?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const runCmd = (c: Command) => {
    close()
    c.run()
  }

  const onInputKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[active]) runCmd(filtered[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-cp-modal border border-cp-border bg-cp-surface-1 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-cp-border px-cp-4 py-cp-3">
          <Icon icon={Search} size="sm" className="text-cp-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onInputKey}
            placeholder={t('palette.placeholder', 'Befehl suchen…')}
            className="flex-1 bg-transparent text-cp-base text-cp-text outline-none placeholder:text-cp-text-faint"
          />
          <kbd className="shrink-0 rounded-cp-control border border-cp-border bg-cp-surface-2 px-2 py-0.5 text-cp-xs text-cp-text-muted">
            {isMac ? '⌘' : t('shortcut.mod', 'Strg')}+K
          </kbd>
        </div>
        <ul ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-cp-4 py-cp-3 text-cp-sm text-cp-text-faint">
              {t('palette.empty', 'Keine Befehle gefunden')}
            </li>
          ) : (
            filtered.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => runCmd(c)}
                  className={`flex w-full items-center justify-between gap-3 px-cp-4 py-cp-2 text-left text-cp-sm ${
                    i === active ? 'bg-cp-surface-2 text-cp-text' : 'text-cp-text-secondary'
                  }`}
                >
                  <span className="truncate">{c.title}</span>
                  <span className="shrink-0 text-cp-xs text-cp-text-faint">{c.group}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
