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
import { format, useTranslation } from '../../lib/i18n'
import { infoDialog } from '../../lib/infoDialog'
import { Icon } from '../shared/Icon'
import { searchCommands } from '../../lib/commandSearch'
import { useSettingsStore } from '../../store/settingsStore'
import type { ModuleId } from '../../lib/modules'
import { useDialogA11y } from '../../hooks/useDialogA11y'
import { useBackdropClose } from '../../hooks/useBackdropClose'

interface Command {
  id: string
  title: string
  group: string
  /** Ein Satz, was die Funktion tut — steht unter dem Titel und wird mitgesucht. */
  note?: string
  /** Synonyme, zweisprachig, nur fuer die Suche. */
  keywords?: string
  /** Nur zeigen, wenn dieses Modul eingeschaltet ist (wie im Menue). */
  module?: ModuleId
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

  const enabledModules = useSettingsStore((st) => st.enabledModules)
  const gFile = t('app.menu.file', 'File')

  const commands = useMemo<Command[]>(
    () => [
      { id: 'undo', group: gEdit, title: t('app.menu.edit.undo', 'Undo'), keywords: 'rueckgaengig', run: () => projectHistory.undo() },
      { id: 'redo', group: gEdit, title: t('app.menu.edit.redo', 'Redo'), keywords: 'wiederholen', run: () => projectHistory.redo() },
      { id: 'duplicate', group: gEdit, title: t('app.menu.edit.duplicate', 'Duplicate'), keywords: 'copy kopieren', run: () => triggerCanvasDuplicate() },
      { id: 'selectAll', group: gEdit, title: t('app.menu.edit.selectAll', 'Select all'), run: () => triggerCanvasSelectAll() },
      { id: 'fit', group: gView, title: t('app.menu.view.fit', 'Fit to view'), keywords: 'einpassen zoom', run: () => triggerCanvasFitView() },
      { id: 'zoomIn', group: gView, title: t('palette.zoomIn', 'Zoom in'), run: () => triggerCanvasZoomIn() },
      { id: 'zoomOut', group: gView, title: t('palette.zoomOut', 'Zoom out'), run: () => triggerCanvasZoomOut() },
      { id: 'zoomReset', group: gView, title: t('palette.zoomReset', 'Reset zoom (100%)'), run: () => triggerCanvasResetZoom() },
      { id: 'templates', group: gFile, title: t('palette.templates', 'New project from template…'), keywords: 'vorlage template', run: () => ui().openTemplates() },
      { id: 'csvImport', group: gFile, title: t('app.menu.tools.csvImport', 'Import equipment from CSV…'), keywords: 'excel tabelle spreadsheet', run: () => ui().openCsvImport() },
      { id: 'rentmanImport', group: gFile, module: 'rentman', title: t('palette.rentmanImport', 'Import from Rentman…'), run: () => ui().openRentmanImport() },
      { id: 'netboxImport', group: gFile, module: 'netbox', title: t('palette.netboxImport', 'Import from NetBox…'), keywords: 'site rack', run: () => ui().openNetboxImport() },
      { id: 'cloud', group: gFile, title: t('app.menu.file.cloud', 'Cloud & share link…'), keywords: 'teilen share link freigeben', run: () => ui().openCloudDialog() },
      { id: 'mobileShare', group: gFile, module: 'mobile', title: t('palette.mobileShare', 'Share to phone…'), note: t('palette.mobileShare.note', 'Patch list and plug check on a phone in the same network'), keywords: 'handy smartphone qr mobil', run: () => ui().openMobileShare() },
      { id: 'planCheck', group: gTools, title: t('app.menu.tools.planCheck', 'Plan check…'), note: t('app.menu.tools.planCheck.note', 'Finds gaps and contradictions in the plan'), keywords: 'pruefen fehler validate errors', run: () => ui().openPlanCheck() },
      { id: 'patchList', group: gTools, title: t('app.menu.tools.patchList', 'Patch list…'), note: t('app.menu.tools.patchList.note', 'Who sits on which input and output'), keywords: 'belegung inputs outputs', run: () => ui().openPatchList() },
      { id: 'analysis', group: gTools, title: t('app.menu.tools.analysis', 'Analyses (weight/network/redundancy)…'), note: t('app.menu.tools.analysis.note', 'Weight, network, redundancy, cable runs'), keywords: 'gewicht netzwerk kabelwege', run: () => ui().openAnalysis() },
      { id: 'reconcile', group: gTools, title: t('app.menu.tools.reconcile', 'Plan vs. found…'), note: t('app.menu.tools.reconcile.note', 'Compares the plan with what is on site'), keywords: 'abgleich vergleich', run: () => ui().setReconcileOpen(true) },
      { id: 'survey', group: gTools, title: t('app.menu.tools.survey', 'Survey (capture existing)…'), note: t('app.menu.tools.survey.note', 'Capture existing equipment on site: name, room, assumed connection, photo'), keywords: 'bestand aufnahme foto', run: () => ui().setSurveyOpen(true) },
      { id: 'drumMicing', group: gTools, title: t('app.menu.tools.drumMicing', 'Drum micing…'), note: t('app.menu.tools.drumMicing.note', 'Place and name microphones on the kit'), keywords: 'schlagzeug mikrofon', run: () => ui().setDrumMicingOpen(true) },
      { id: 'wirelessRig', group: gTools, title: t('app.menu.tools.wirelessRig', 'Wireless / vocals…'), note: t('app.menu.tools.wirelessRig.note', 'Frequencies, transmitters, receivers in the spectrum'), keywords: 'funk frequenz funkstrecke', run: () => ui().setWirelessRigOpen(true) },
      { id: 'rundown', group: gTools, title: t('app.menu.tools.rundown', 'Rundown and camera assignments…'), note: t('app.menu.tools.rundown.note', 'Read in segments, assign a shot per camera position'), keywords: 'ablauf kamera shot', run: () => ui().setRundownOpen(true) },
      { id: 'delivery', group: gTools, title: t('app.menu.tools.delivery', 'Delivery (streaming destinations)…'), note: t('app.menu.tools.delivery.note', 'Where it goes out, with which parameters'), keywords: 'stream rtmp youtube ausspielung', run: () => ui().setDeliveryOpen(true) },
      { id: 'ledWall', group: gTools, title: t('app.menu.tools.ledWall', 'LED wall…'), keywords: 'led wand panel', run: () => ui().setLedWallOpen(true) },
      { id: 'faceplate', group: gTools, title: t('app.menu.tools.faceplate', 'Faceplate editor…'), keywords: 'frontplatte anschlussfeld', run: () => ui().setFrontplatteOpen(true) },
      { id: 'bericht', group: gTools, title: t('app.menu.tools.bericht', 'Report editor…'), keywords: 'bericht dokument', run: () => ui().setBerichtEditorOpen(true) },
      { id: 'adern', group: gTools, title: t('app.menu.tools.adern', 'Conductors and colour standards…'), note: t('app.menu.tools.adern.note', 'Colour standards and connections pulled one conductor at a time'), keywords: 'adern farbcode pinout', run: () => ui().setAdernOpen(true) },
      { id: 'osc', group: gTools, title: t('app.menu.tools.osc', 'Received show-control messages…'), note: t('app.menu.tools.osc.note', 'What came in — a transcript, not a system state'), keywords: 'osc show control', run: () => ui().setOscOpen(true) },
      { id: 'bulkConnect', group: gTools, title: t('app.menu.tools.bulkConnect', 'Connect multiple cables…'), note: t('app.menu.tools.bulkConnect.note', 'Cable many ports in one go'), keywords: 'verkabeln mehrere', run: () => ui().openBulkConnect() },
      { id: 'newRack', group: gTools, title: t('app.menu.tools.newRack', 'Create new rack…'), keywords: 'rack schrank', run: () => ui().triggerNewRackBuilder() },
      { id: 'rackBuilder', group: gTools, title: t('app.menu.tools.rackBuilder', 'Rack builder…'), note: t('app.menu.tools.rackBuilder.note', 'Populate and edit existing racks'), keywords: 'rack schrank', run: () => ui().triggerRackBuilderFromSelection([]) },
      { id: 'revisions', group: gTools, title: t('app.menu.tools.revisions', 'Revisions & snapshots…'), note: t('app.menu.tools.revisions.note', 'Save and compare states'), keywords: 'version stand snapshot', run: () => ui().openRevisions() },
      { id: 'aiPlanGen', group: gTools, title: t('app.menu.tools.aiPlanGen', 'Generate AI plan…'), note: t('app.menu.tools.aiPlanGen.note', 'Generates a draft from a description'), keywords: 'ki ai entwurf', run: () => ui().openAiPlanGen() },
      { id: 'inventory', group: gTools, module: 'rental', title: t('app.menu.tools.inventory', 'Inventory / stock…'), keywords: 'lager bestand', run: () => ui().openInventory() },
      { id: 'bandwidth', group: gTools, title: t('app.menu.tools.bandwidth', 'Calculate bandwidth…'), keywords: 'bandbreite netzwerk rechner', run: () => ui().openBandwidthCalc() },
      { id: 'power', group: gTools, title: t('app.menu.tools.power', 'Calculate power consumption…'), keywords: 'strom leistung watt rechner', run: () => ui().openPowerCalc() },
      { id: 'recStorage', group: gTools, title: t('app.menu.tools.recStorage', 'Calculate recording storage…'), keywords: 'speicher aufnahme rechner', run: () => ui().openRecordingStorageCalc() },
      { id: 'projection', group: gTools, title: t('app.menu.tools.projection', 'Projection & display…'), keywords: 'beamer projektor leinwand rechner', run: () => ui().openProjectionCalc() },
      { id: 'installDocs', group: gTools, module: 'festinstallation', title: t('app.menu.tools.installDocs', 'Fixed install: docs & handover…'), note: t('palette.installDocs.note', 'Asset register, QR labels and handover documents'), keywords: 'qr label etikett uebergabe asset', run: () => ui().openInstallDocs() },
      { id: 'atemMv', group: gTools, title: t('app.menu.tools.atemMv', 'ATEM multiviewer layout…'), keywords: 'multiview', run: () => ui().openAtemMvConfig() },
      { id: 'atemAudio', group: gTools, title: t('app.menu.tools.atemAudio', 'ATEM audio routing…'), run: () => ui().openAtemAudioConfig() },
      { id: 'atemLabels', group: gTools, title: t('app.menu.tools.atemLabels', 'ATEM input labels…'), keywords: 'beschriftung namen', run: () => ui().openAtemDialog() },
      { id: 'videohub', group: gTools, title: t('app.menu.tools.videohub', 'Videohub routing / labels…'), keywords: 'kreuzschiene router', run: () => ui().openVideohubExport() },
      { id: 'greengo', group: gTools, title: t('app.menu.tools.greengo', 'GreenGo intercom…'), keywords: 'intercom kommando', run: () => ui().openGreenGoExport() },
      {
        id: 'dmxPatch',
        group: gTools,
        title: t('palette.dmxPatch', 'Assign DMX addresses…'),
        keywords: 'licht light universe',
        run: () => {
          const { vergeben, uebersprungen } = useProjectStore.getState().vergibDmxAdressen()
          // Die Aktion sagt, was sie getan hat. Eine Automatik, die stumm
          // laeuft, laesst den Nutzer raten, ob sie gegriffen hat — und
          // „uebersprungen" ist hier die wichtigere Zahl: das sind die
          // Geraete ohne Modus, deren Fussabdruck niemand kennt.
          void infoDialog(t('palette.dmxPatchDone', 'DMX addresses assigned'), {
            body: format(
              t(
                'palette.dmxPatchSummary',
                '{n} devices got an address, {skipped} were skipped because no mode is set. The plan check lists every collision.',
              ),
              { n: vergeben, skipped: uebersprungen },
            ),
            tone: 'info',
          })
        },
      },
      { id: 'loadDemo', group: gTools, title: t('canvas.empty.loadDemo', 'Load example project'), keywords: 'demo beispiel', run: () => { useProjectStore.getState().loadDemoProject(); setTimeout(() => triggerCanvasFitView(), 80) } },
      { id: 'settings', group: gHelp, title: t('palette.settings', 'Settings…'), keywords: 'einstellungen optionen preferences', run: () => ui().openSettings() },
      { id: 'modules', group: gHelp, title: t('palette.modules', 'Switch modules on or off…'), keywords: 'module festinstallation rentman netbox rental', run: () => ui().openSettings('modules') },
      { id: 'tour', group: gHelp, title: t('app.menu.help.tour', 'Getting-started tour…'), keywords: 'hilfe help onboarding', run: () => window.dispatchEvent(new CustomEvent('cp:open-tour')) },
      { id: 'shortcuts', group: gHelp, title: t('app.menu.help.shortcuts', 'Keyboard shortcuts…'), keywords: 'tastenkuerzel keys', run: () => window.dispatchEvent(new CustomEvent('cp:open-shortcuts-help')) },
      { id: 'about', group: gHelp, title: t('app.menu.help.about', 'About LZ Cable Planner…'), keywords: 'version', run: () => ui().openAboutDialog() },
    ],
    [t, gEdit, gView, gTools, gHelp, gFile],
  )

  const filtered = useMemo(
    () =>
      searchCommands(
        commands.filter((c) => !c.module || enabledModules[c.module]),
        query,
      ),
    [query, commands, enabledModules],
  )

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
      className="fixed inset-0 z-[60] flex items-start justify-center cp-scrim p-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        ref={panelRef}
        aria-label={t('palette.placeholder', 'Search command…')}
        {...dialogProps}
        className="w-full max-w-xl overflow-hidden rounded-cp-modal border border-cp-border bg-cp-surface-1"
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
                  <span className="min-w-0">
                    <span className="block truncate">{c.title}</span>
                    {c.note && (
                      <span className="block truncate text-cp-xs text-cp-text-faint">{c.note}</span>
                    )}
                  </span>
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
