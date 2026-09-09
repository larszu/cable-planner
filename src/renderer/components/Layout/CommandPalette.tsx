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
import { useDialogA11y } from '../../hooks/useDialogA11y'
import { useBackdropClose } from '../../hooks/useBackdropClose'

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

  const gEdit = t('app.menu.edit', 'Edit')
  const gView = t('app.menu.view', 'View')
  const gTools = t('app.menu.tools', 'Tools')
  const gHelp = t('app.menu.help', 'Help')
  const ui = () => useUiStore.getState()

  const commands = useMemo<Command[]>(
    () => [
      { id: 'undo', group: gEdit, title: t('app.menu.edit.undo', 'Undo'), run: () => projectHistory.undo() },
      { id: 'redo', group: gEdit, title: t('app.menu.edit.redo', 'Redo'), run: () => projectHistory.redo() },
      { id: 'duplicate', group: gEdit, title: t('app.menu.edit.duplicate', 'Duplicate'), run: () => triggerCanvasDuplicate() },
      { id: 'selectAll', group: gEdit, title: t('app.menu.edit.selectAll', 'Select all'), run: () => triggerCanvasSelectAll() },
      { id: 'fit', group: gView, title: t('app.menu.view.fit', 'Fit to view'), run: () => triggerCanvasFitView() },
      { id: 'zoomIn', group: gView, title: t('palette.zoomIn', 'Zoom in'), run: () => triggerCanvasZoomIn() },
      { id: 'zoomOut', group: gView, title: t('palette.zoomOut', 'Zoom out'), run: () => triggerCanvasZoomOut() },
      { id: 'zoomReset', group: gView, title: t('palette.zoomReset', 'Reset zoom (100%)'), run: () => triggerCanvasResetZoom() },
      { id: 'planCheck', group: gTools, title: t('app.menu.tools.planCheck', 'Plan check…'), run: () => ui().openPlanCheck() },
      { id: 'patchList', group: gTools, title: t('app.menu.tools.patchList', 'Patch list…'), run: () => ui().openPatchList() },
      { id: 'analysis', group: gTools, title: t('app.menu.tools.analysis', 'Analyses (weight/network/redundancy)…'), run: () => ui().openAnalysis() },
      { id: 'bulkConnect', group: gTools, title: t('app.menu.tools.bulkConnect', 'Connect multiple cables…'), run: () => ui().openBulkConnect() },
      { id: 'revisions', group: gTools, title: t('app.menu.tools.revisions', 'Revisions & snapshots…'), run: () => ui().openRevisions() },
      { id: 'aiPlanGen', group: gTools, title: t('app.menu.tools.aiPlanGen', 'Generate AI plan…'), run: () => ui().openAiPlanGen() },
      { id: 'csvImport', group: gTools, title: t('app.menu.tools.csvImport', 'Import equipment from CSV…'), run: () => ui().openCsvImport() },
      { id: 'bandwidth', group: gTools, title: t('app.menu.tools.bandwidth', 'Calculate bandwidth…'), run: () => ui().openBandwidthCalc() },
      { id: 'power', group: gTools, title: t('app.menu.tools.power', 'Calculate power consumption…'), run: () => ui().openPowerCalc() },
      { id: 'recStorage', group: gTools, title: t('app.menu.tools.recStorage', 'Calculate recording storage…'), run: () => ui().openRecordingStorageCalc() },
      { id: 'projection', group: gTools, title: t('app.menu.tools.projection', 'Projection & display…'), run: () => ui().openProjectionCalc() },
      { id: 'installDocs', group: gTools, title: t('app.menu.tools.installDocs', 'Fixed install: docs & handover…'), run: () => ui().openInstallDocs() },
      { id: 'loadDemo', group: gTools, title: t('canvas.empty.loadDemo', 'Load example project'), run: () => { useProjectStore.getState().loadProject(createDemoProject()); setTimeout(() => triggerCanvasFitView(), 80) } },
      { id: 'settings', group: gHelp, title: t('palette.settings', 'Settings…'), run: () => ui().openSettings() },
      { id: 'shortcuts', group: gHelp, title: t('app.menu.help.shortcuts', 'Keyboard shortcuts…'), run: () => window.dispatchEvent(new CustomEvent('cp:open-shortcuts-help')) },
      { id: 'about', group: gHelp, title: t('app.menu.help.about', 'About Cable Planner…'), run: () => ui().openAboutDialog() },
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

  // Phase 3 der UI-Pruefung — hier mit `closeOnEscape: false`. Die Palette
  // hat ihre eigene Tastensteuerung (Pfeile, Enter, Escape) am Eingabefeld;
  // ein zweites Escape darueber waere doppelt. Was ihr fehlte und was der
  // Haken beitraegt, sind Fokus-Falle und Fokus-Rueckgabe.
  const { panelRef, dialogProps } = useDialogA11y(open, close, {
    closeOnEscape: false,
  })

  // B-44 — der Hintergrund schliesst. Eine Palette haelt nichts fest;
  // die Eingabe ist die Suche und nicht der Inhalt.
  const backdrop = useBackdropClose(() => setOpen(false))

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
      {...backdrop}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        ref={panelRef}
        aria-label={t('palette.placeholder', 'Search command…')}
        {...dialogProps}
        className="w-full max-w-xl overflow-hidden rounded-cp-modal border border-cp-border bg-cp-surface-1 shadow-2xl"
      >
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
            placeholder={t('palette.placeholder', 'Search command…')}
            className="flex-1 bg-transparent text-cp-base text-cp-text outline-none placeholder:text-cp-text-faint"
          />
          <kbd className="shrink-0 rounded-cp-control border border-cp-border bg-cp-surface-2 px-2 py-0.5 text-cp-xs text-cp-text-muted">
            {isMac ? '⌘' : t('shortcut.mod', 'Ctrl')}+K
          </kbd>
        </div>
        <ul ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-cp-4 py-cp-3 text-cp-sm text-cp-text-faint">
              {t('palette.empty', 'No commands found')}
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
