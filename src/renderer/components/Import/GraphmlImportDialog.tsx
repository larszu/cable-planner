// yEd / GraphML import dialog. Three-stage flow:
//
//   1. EMPTY → click "Datei auswählen" (calls main-process IPC, or
//      falls back to a hidden <input type="file"> in the browser).
//   2. PARSING → spinner shown while parseGraphmlText + resolveGraphml
//      do their work. ~250 ms parse + ~15 ms resolve on the
//      2.4 MB reference files; well below the threshold that would need
//      a worker. Wrapped in setTimeout so the spinner actually paints.
//   3. PREVIEW → tab interface showing the resolved devices, cables,
//      and skipped nodes. User can:
//        • toggle individual rows in/out of the import
//        • rename a device or override its category
//        • bulk-assign a category to the selection
//        • switch between append vs. replace mode
//      Then click "Importieren" to commit.

import { useMemo, useState } from 'react'
import { AlertTriangle, X, Ruler, Map, Library } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { cablePlannerApi } from '../../lib/bridge'
import { parseGraphmlText } from '../../lib/graphml/parser'
import {
  buildImportPayload,
  resolveGraphml,
  type ImportPreview,
  type ResolvedCable,
  type ResolvedDevice,
} from '../../lib/graphml/semantics'
import { useProjectStore } from '../../store/projectStore'
import { projectHistory } from '../../store/projectHistory'
import { useTranslation, format } from '../../lib/i18n'

export interface GraphmlImportDialogProps {
  open: boolean
  onClose: () => void
}

import type { GraphmlDocument } from '../../lib/graphml/types'
import { GraphmlViewer } from './GraphmlViewer'

type Stage =
  | { kind: 'empty' }
  | { kind: 'parsing'; fileName: string }
  | { kind: 'error'; fileName: string | null; message: string }
  | {
      kind: 'preview'
      fileName: string
      /** Kept around for the yEd visual preview tab — rendering needs
       *  the raw geometry, not the resolved cable-planner shapes. */
      document: GraphmlDocument
      preview: ImportPreview
      warningsCount: number
    }

const confidenceBadge = (conf: ResolvedDevice['confidence']) => {
  const colors = {
    high: { bg: '#065f46', fg: '#bbf7d0', label: 'HIGH' },
    medium: { bg: '#854d0e', fg: '#fef3c7', label: 'MED' },
    low: { bg: '#7f1d1d', fg: '#fecaca', label: 'LOW' },
  } as const
  const c = colors[conf]
  return (
    <span
      className="rounded px-1 text-[10px] font-bold"
      style={{ background: c.bg, color: c.fg }}
    >
      {c.label}
    </span>
  )
}

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export const GraphmlImportDialog = ({ open, onClose }: GraphmlImportDialogProps) => {
  const t = useTranslation()
  const [stage, setStage] = useState<Stage>({ kind: 'empty' })
  const [tab, setTab] = useState<'preview' | 'devices' | 'cables' | 'skipped'>('preview')
  const [mode, setMode] = useState<'append' | 'replace'>('append')
  // v7.7.0 — Canvas vs Library destination. Canvas: places imported
  // devices on the canvas and creates cables (legacy behaviour).
  // Library: only adds device templates to the custom library (no
  // canvas placement, no cables) — useful when the user has a yEd file
  // they want to harvest as a reusable equipment library.
  const [destination, setDestination] = useState<'canvas' | 'library'>('canvas')
  const [skipDevices, setSkipDevices] = useState<Set<string>>(new Set())
  const [skipCables, setSkipCables] = useState<Set<string>>(new Set())
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({})
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({})
  const [filterText, setFilterText] = useState('')
  const [busy, setBusy] = useState(false)

  const importGraphml = useProjectStore((s) => s.importGraphml)
  const addCustomTemplates = useProjectStore((s) => s.addCustomTemplates)
  const setSelection = useProjectStore((s) => s.setSelection)

  // CRITICAL: every hook must run on every render — never gate them behind
  // the `if (!open) return null` below. Otherwise React #310 fires the
  // moment the dialog mounts/unmounts (the bundled prod build crashed
  // the renderer on startup in v0.4.0 because useMemo lived after the
  // early-return). Both memos are cheap when `stage.kind !== 'preview'`.
  const filteredDevices = useMemo(() => {
    if (stage.kind !== 'preview') return [] as ResolvedDevice[]
    if (!filterText.trim()) return stage.preview.devices
    const needle = filterText.toLowerCase()
    return stage.preview.devices.filter(
      (d) =>
        d.name.toLowerCase().includes(needle) ||
        d.category.toLowerCase().includes(needle) ||
        (d.ipAddress ?? '').toLowerCase().includes(needle),
    )
  }, [stage, filterText])

  const filteredCables = useMemo(() => {
    if (stage.kind !== 'preview') return [] as ResolvedCable[]
    if (!filterText.trim()) return stage.preview.cables
    const needle = filterText.toLowerCase()
    const deviceName = (importKey: string) =>
      stage.preview.devices.find((d) => d.importKey === importKey)?.name ?? ''
    return stage.preview.cables.filter(
      (c) =>
        deviceName(c.sourceDeviceImportKey).toLowerCase().includes(needle) ||
        deviceName(c.targetDeviceImportKey).toLowerCase().includes(needle) ||
        (c.signalName ?? '').toLowerCase().includes(needle) ||
        c.inferredCableType.toLowerCase().includes(needle),
    )
  }, [stage, filterText])

  if (!open) return null

  const reset = () => {
    setStage({ kind: 'empty' })
    setSkipDevices(new Set())
    setSkipCables(new Set())
    setNameOverrides({})
    setCategoryOverrides({})
    setFilterText('')
    setTab('devices')
  }

  const handlePickFile = async () => {
    setBusy(true)
    try {
      const result = await cablePlannerApi.graphml.openFile()
      if (!result) {
        setBusy(false)
        return
      }
      setStage({ kind: 'parsing', fileName: result.fileName })
      // Give React a frame to paint the parsing UI before we block on
      // the parser. parseGraphmlText finishes in ~250 ms on a 2.4 MB
      // file which is too fast to need a worker but slow enough that
      // an unspinnered click feels frozen.
      setTimeout(() => {
        try {
          const { document: doc, warnings } = parseGraphmlText(result.xml)
          const preview = resolveGraphml(doc)
          setStage({
            kind: 'preview',
            fileName: result.fileName,
            document: doc,
            preview,
            warningsCount: warnings.length,
          })
          // Default: skip nothing (everything imported).
          setSkipDevices(new Set())
          setSkipCables(new Set())
        } catch (err) {
          setStage({
            kind: 'error',
            fileName: result.fileName,
            message: err instanceof Error ? err.message : String(err),
          })
        } finally {
          setBusy(false)
        }
      }, 0)
    } catch (err) {
      setStage({
        kind: 'error',
        fileName: null,
        message: err instanceof Error ? err.message : String(err),
      })
      setBusy(false)
    }
  }

  const toggleDevice = (key: string) => {
    setSkipDevices((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleCable = (key: string) => {
    setSkipCables((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleImport = () => {
    if (stage.kind !== 'preview') return
    const payload = buildImportPayload(stage.preview, {
      skipDeviceKeys: skipDevices,
      skipCableKeys: skipCables,
      categoryOverrides,
      nameOverrides,
    })
    if (destination === 'library') {
      // Library-only path: strip canvas-specific fields and push each
      // device as an EquipmentTemplate. Existing templates with the
      // same name are kept (addCustomTemplates already guards against
      // overwriting). Cables are intentionally dropped — templates
      // don't carry cabling.
      const templates = payload.devices.map((d) => {
        const {
          id: _id,
          x: _x,
          y: _y,
          importKey: _ik,
          graphmlId: _gid,
          ...rest
        } = d as typeof d & { id?: string }
        void _id
        void _x
        void _y
        void _ik
        void _gid
        return rest
      })
      addCustomTemplates(templates)
      reset()
      onClose()
      return
    }
    // #382 — In eine Transaction wrappen damit der ganze Import (Equipment +
    // Cables + Viewport-Pan) als EIN Undo-Step zaehlt. Vorher: jede einzelne
    // Mutation der importGraphml-Action war ein separater Coalesce-Step, was
    // dazu fuehrte dass Strg+Z nach einem yEd-Import nichts (oder Teile)
    // rueckgaengig machte.
    const newIds = projectHistory.transact(() => importGraphml({ ...payload, mode }))
    // Select the first imported device on the canvas to draw attention.
    // The store action also pans + zooms the viewport onto the imported
    // bounding box so the user actually sees them — yEd diagrams sit
    // far from (0,0) and the previous viewport stayed unchanged.
    if (newIds[0]) setSelection(newIds[0])
    reset()
    onClose()
  }

  const renderEmpty = () => (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center text-cp-text-secondary">
      <Icon icon={Ruler} size={40} className="text-cp-text-muted" />
      <div className="max-w-md text-cp-base">
        <p className="mb-2 font-semibold text-cp-text">{t('graphml.dialog.importerTitle', 'yEd / GraphML Importer')}</p>
        <p>
          {t('graphml.dialog.empty.intro1', 'Wähle eine')} <code className="text-cp-text-bright">.graphml</code> {t('graphml.dialog.empty.intro2', 'Datei. Cable Planner erkennt Geräte, Ports und Kabel automatisch — du bekommst eine Vorschau und kannst einzelne Einträge ein- oder ausschließen, bevor sie ins Projekt übernommen werden.')}
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={handlePickFile}
        className="rounded bg-emerald-600 px-4 py-2 text-cp-base font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {t('graphml.dialog.pickFile', 'Datei auswählen…')}
      </button>
    </div>
  )

  const renderParsing = (fileName: string) => (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center text-cp-text-secondary">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-cp-surface-5 border-t-sky-400" />
      <div className="text-cp-base">
        <p className="font-medium">{fileName}</p>
        <p className="text-cp-text-faint">{t('graphml.dialog.parsing', 'Parser läuft (~ 250 ms pro MB)…')}</p>
      </div>
    </div>
  )

  const renderError = (fileName: string | null, message: string) => (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
      <div className="flex justify-center text-red-300"><Icon icon={AlertTriangle} size={32} /></div>
      <p className="text-cp-base font-medium text-red-300">{t('graphml.dialog.importFailed', 'Import fehlgeschlagen')}</p>
      {fileName && <p className="text-cp-xs text-cp-text-muted">{fileName}</p>}
      <pre className="max-w-full whitespace-pre-wrap rounded bg-cp-surface-3 p-3 text-cp-xs text-red-200">
        {message}
      </pre>
      <button
        type="button"
        onClick={reset}
        className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
      >
        {t('graphml.dialog.pickOther', 'Andere Datei wählen')}
      </button>
    </div>
  )

  const renderPreview = (s: Extract<Stage, { kind: 'preview' }>) => {
    const { preview } = s
    const totalDevices = preview.devices.length
    const includedDevices = totalDevices - skipDevices.size
    const totalCables = preview.cables.length
    const includedCables = totalCables - skipCables.size
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Header summary */}
        <div className="border-b border-cp-border px-4 py-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <span className="text-cp-xs uppercase tracking-wide text-cp-text-muted">{t('graphml.dialog.file', 'Datei')}</span>{' '}
              <span className="font-medium text-cp-text">{s.fileName}</span>
              <span className="ml-2 text-cp-xs text-cp-text-faint">
                {formatBytes(preview.meta.fileSize)} • {preview.meta.nodeCount} {t('graphml.dialog.nodes', 'Nodes')} •{' '}
                {preview.meta.edgeCount} {t('graphml.dialog.edges', 'Edges')}
              </span>
            </div>
            <button
              type="button"
              onClick={reset}
              className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
              title={t('graphml.dialog.pickOther', 'Andere Datei wählen')}
            >
              {t('graphml.dialog.otherFile', '↻ Andere Datei')}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-cp-xs text-cp-text-secondary">
            <span>
              {t('graphml.dialog.devices', 'Geräte')}: <strong>{includedDevices}/{totalDevices}</strong>
            </span>
            <span>
              {t('graphml.dialog.cables', 'Kabel')}: <strong>{includedCables}/{totalCables}</strong>
            </span>
            {preview.skippedNodes.length > 0 && (
              <span className="text-cp-text-faint">
                {t('graphml.dialog.skipped', 'Übersprungen')}: {preview.skippedNodes.length}
              </span>
            )}
            {preview.unresolvedEdges.length > 0 && (
              <span className="text-amber-400">
                {t('graphml.dialog.edgesNoTarget', 'Edges ohne Ziel')}: {preview.unresolvedEdges.length}
              </span>
            )}
            {s.warningsCount > 0 && (
              <span className="text-amber-400">{t('graphml.dialog.parserWarnings', 'Parser-Warnungen')}: {s.warningsCount}</span>
            )}
          </div>
        </div>

        {/* Destination + Mode + filter row */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cp-border-muted bg-cp-surface-3/70 px-4 py-2 text-cp-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-cp-text-muted">{t('graphml.dialog.target', 'Ziel:')}</span>
              <button
                type="button"
                onClick={() => setDestination('canvas')}
                className={`rounded px-2 py-0.5 ${destination === 'canvas' ? 'bg-emerald-700 text-white' : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'}`}
                title={t('graphml.dialog.canvasTitle', 'Geräte direkt auf dem Canvas platzieren (inkl. Kabel).')}
              >
                <Icon icon={Map} size="xs" className="mr-1 inline-block align-text-bottom" />{t('graphml.dialog.canvas', 'Canvas')}
              </button>
              <button
                type="button"
                onClick={() => setDestination('library')}
                className={`rounded px-2 py-0.5 ${destination === 'library' ? 'bg-violet-700 text-white' : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'}`}
                title={t('graphml.dialog.libraryTitle', 'Nur als wiederverwendbare Geräte-Vorlagen in die Library übernehmen (ohne Kabel, ohne Canvas-Platzierung).')}
              >
                <Icon icon={Library} size="xs" className="mr-1 inline-block align-text-bottom" />{t('graphml.dialog.library', 'Library')}
              </button>
            </div>
            {destination === 'canvas' && (
              <div className="flex items-center gap-1">
                <span className="text-cp-text-muted">{t('graphml.dialog.mode', 'Modus:')}</span>
                <button
                  type="button"
                  onClick={() => setMode('append')}
                  className={`rounded px-2 py-0.5 ${mode === 'append' ? 'bg-sky-700 text-white' : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'}`}
                >
                  {t('graphml.dialog.appendProject', 'An Projekt anhängen')}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('replace')}
                  className={`rounded px-2 py-0.5 ${mode === 'replace' ? 'bg-amber-700 text-white' : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'}`}
                  title={t('graphml.dialog.replaceTitle', 'Ersetzt nur GraphML-importierte Geräte; manuell hinzugefügte bleiben unangetastet.')}
                >
                  {t('graphml.dialog.replaceImport', 'GraphML-Import ersetzen')}
                </button>
              </div>
            )}
          </div>
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={t('graphml.dialog.filterPlaceholder', 'Filter: Name / IP / Kategorie / Kabeltyp')}
            className="w-64 rounded border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-xs text-cp-text"
          />
        </div>

        {/* Library-mode hint: cables are dropped (templates carry no cabling). */}
        {destination === 'library' && (
          <div className="border-b border-violet-800/60 bg-violet-950/40 px-4 py-2 text-[11px] text-violet-200">
            {t('graphml.dialog.libraryHint', 'Library-Modus: Geräte werden als wiederverwendbare Vorlagen in die lokale Library gespeichert. Kabel werden nicht mit übernommen (Templates enthalten keine Verkabelung).')}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-cp-border-muted text-cp-xs">
          {([
            ['preview', t('graphml.dialog.tab.preview', 'yEd-Vorschau')],
            ['devices', `${t('graphml.dialog.tab.devices', 'Geräte')} (${totalDevices})`],
            ['cables', `${t('graphml.dialog.tab.cables', 'Kabel')} (${totalCables})`],
            ['skipped', `${t('graphml.dialog.tab.skipped', 'Übersprungen')} (${preview.skippedNodes.length + preview.unresolvedEdges.length})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-2 ${
                tab === key
                  ? 'border-b-2 border-sky-500 bg-cp-surface-1 text-cp-text'
                  : 'text-cp-text-muted hover:text-cp-text-bright'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab body */}
        <div className="min-h-0 flex-1 overflow-auto">
          {tab === 'preview' && (
            // Live render of the parsed yEd document at original
            // coordinates so the user can visually confirm cable-planner
            // is reading the file correctly before committing the
            // import. Highlights the nodes the resolver picked as
            // import-worthy devices (faded ones are decorative / port
            // shapes that won't become Equipment items).
            <div className="h-full min-h-0">
              <GraphmlViewer
                document={s.document}
                highlightNodes={new Set(preview.devices.map((d) => d.graphmlId))}
                className="relative h-full w-full"
              />
            </div>
          )}
          {tab === 'devices' && (
            <table className="w-full text-cp-xs">
              <thead className="sticky top-0 bg-cp-surface-1 text-cp-text-muted">
                <tr>
                  <th className="px-3 py-2 text-left w-6"></th>
                  <th className="px-3 py-2 text-left">{t('graphml.dialog.col.name', 'Name')}</th>
                  <th className="px-3 py-2 text-left">{t('graphml.dialog.col.category', 'Kategorie')}</th>
                  <th className="px-3 py-2 text-left">{t('graphml.dialog.col.ip', 'IP')}</th>
                  <th className="px-3 py-2 text-right">{t('graphml.dialog.col.inOut', 'In/Out')}</th>
                  <th className="px-3 py-2 text-left">{t('graphml.dialog.col.status', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map((dev) => {
                  const skipped = skipDevices.has(dev.importKey)
                  return (
                    <tr
                      key={dev.importKey}
                      className={`border-t border-cp-border-muted ${skipped ? 'opacity-40' : ''}`}
                    >
                      <td className="px-3 py-1">
                        <input
                          type="checkbox"
                          checked={!skipped}
                          onChange={() => toggleDevice(dev.importKey)}
                          aria-label={format(t('graphml.dialog.toggleDeviceAria', 'Gerät {name} umschalten'), { name: dev.name })}
                        />
                      </td>
                      <td className="px-3 py-1">
                        <input
                          type="text"
                          defaultValue={nameOverrides[dev.importKey] ?? dev.name}
                          onChange={(e) =>
                            setNameOverrides((p) => ({ ...p, [dev.importKey]: e.target.value }))
                          }
                          className="w-full rounded border border-cp-border bg-cp-surface-3 px-1.5 py-0.5 text-cp-text"
                        />
                        {dev.subtitle && (
                          <div className="px-1.5 text-[10px] text-cp-text-muted">{dev.subtitle}</div>
                        )}
                      </td>
                      <td className="px-3 py-1">
                        <input
                          type="text"
                          defaultValue={categoryOverrides[dev.importKey] ?? dev.category}
                          onChange={(e) =>
                            setCategoryOverrides((p) => ({ ...p, [dev.importKey]: e.target.value }))
                          }
                          className="w-32 rounded border border-cp-border bg-cp-surface-3 px-1.5 py-0.5 text-cp-text"
                        />
                      </td>
                      <td className="px-3 py-1 text-cp-text-muted">{dev.ipAddress ?? '—'}</td>
                      <td className="px-3 py-1 text-right text-cp-text-secondary">
                        {dev.inputs.length}/{dev.outputs.length}
                      </td>
                      <td className="px-3 py-1">
                        {confidenceBadge(dev.confidence)}
                        {dev.notes[0] && (
                          <span className="ml-1 text-[10px] text-cp-text-muted" title={dev.notes.join('\n')}>
                            {dev.notes[0].length > 50 ? `${dev.notes[0].slice(0, 47)}…` : dev.notes[0]}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {tab === 'cables' && (
            <table className="w-full text-cp-xs">
              <thead className="sticky top-0 bg-cp-surface-1 text-cp-text-muted">
                <tr>
                  <th className="px-3 py-2 text-left w-6"></th>
                  <th className="px-3 py-2 text-left">{t('graphml.dialog.col.source', 'Quelle')}</th>
                  <th className="px-3 py-2 text-left">{t('graphml.dialog.col.target', 'Ziel')}</th>
                  <th className="px-3 py-2 text-left">{t('graphml.dialog.col.type', 'Typ')}</th>
                  <th className="px-3 py-2 text-left">{t('graphml.dialog.col.standard', 'Standard')}</th>
                  <th className="px-3 py-2 text-right">{t('graphml.dialog.col.length', 'Länge')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCables.map((c) => {
                  const skipped = skipCables.has(c.importKey)
                  const src = stage.kind === 'preview'
                    ? stage.preview.devices.find((d) => d.importKey === c.sourceDeviceImportKey)
                    : undefined
                  const tgt = stage.kind === 'preview'
                    ? stage.preview.devices.find((d) => d.importKey === c.targetDeviceImportKey)
                    : undefined
                  return (
                    <tr
                      key={c.importKey}
                      className={`border-t border-cp-border-muted ${skipped ? 'opacity-40' : ''}`}
                    >
                      <td className="px-3 py-1">
                        <input
                          type="checkbox"
                          checked={!skipped}
                          onChange={() => toggleCable(c.importKey)}
                          aria-label={t('graphml.dialog.toggleCableAria', 'Toggle cable')}
                        />
                      </td>
                      <td className="px-3 py-1 text-cp-text-secondary">{src?.name ?? c.sourceDeviceImportKey}</td>
                      <td className="px-3 py-1 text-cp-text-secondary">{tgt?.name ?? c.targetDeviceImportKey}</td>
                      <td className="px-3 py-1 text-cp-text">{c.inferredCableType}</td>
                      <td className="px-3 py-1 text-cp-text-muted">{c.videoStandard ?? '—'}</td>
                      <td className="px-3 py-1 text-right text-cp-text-muted">
                        {c.cableLengthMeters != null ? `${c.cableLengthMeters} m` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {tab === 'skipped' && (
            <div className="space-y-4 p-3 text-cp-xs">
              <div>
                <h4 className="mb-1 font-semibold text-cp-text-secondary">
                  {t('graphml.dialog.nodesSkipped', 'Nodes übersprungen')} ({preview.skippedNodes.length})
                </h4>
                <ul className="space-y-0.5 text-cp-text-muted">
                  {preview.skippedNodes.slice(0, 50).map((s) => (
                    <li key={s.id}>
                      <code className="text-cp-text-faint">{s.id}</code> — {s.reason}
                    </li>
                  ))}
                  {preview.skippedNodes.length > 50 && (
                    <li className="text-cp-text-faint">{t('graphml.dialog.moreEllipsis', '… ({count} weitere)').replace('{count}', String(preview.skippedNodes.length - 50))}</li>
                  )}
                </ul>
              </div>
              <div>
                <h4 className="mb-1 font-semibold text-cp-text-secondary">
                  {t('graphml.dialog.unresolvedEdges', 'Edges ohne aufgelöste Ports')} ({preview.unresolvedEdges.length})
                </h4>
                <ul className="space-y-0.5 text-cp-text-muted">
                  {preview.unresolvedEdges.slice(0, 50).map((e) => (
                    <li key={e.id}>
                      <code className="text-cp-text-faint">{e.id}</code>: {e.sourceId} → {e.targetId}
                      {Object.keys(e.data).length > 0 && (
                        <span className="ml-1 text-cp-text-dim">
                          [{Object.entries(e.data).map(([k, v]) => `${k}=${v}`).join(', ')}]
                        </span>
                      )}
                    </li>
                  ))}
                  {preview.unresolvedEdges.length > 50 && (
                    <li className="text-cp-text-faint">{t('graphml.dialog.moreEllipsis', '… ({count} weitere)').replace('{count}', String(preview.unresolvedEdges.length - 50))}</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 border-t border-cp-border px-4 py-3">
          <button
            type="button"
            onClick={() => {
              reset()
              onClose()
            }}
            className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
          >
            {t('graphml.dialog.cancel', 'Abbrechen')}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={includedDevices === 0}
            className={`rounded px-4 py-1.5 text-cp-xs font-medium text-white disabled:opacity-50 ${destination === 'library' ? 'bg-violet-600 hover:bg-violet-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
          >
            {destination === 'library'
              ? `${includedDevices} ${includedDevices === 1 ? t('graphml.dialog.deviceSingular', 'Gerät') : t('graphml.dialog.devicePlural', 'Geräte')} ${t('graphml.dialog.toLibrary', 'in Library übernehmen')}`
              : `${includedDevices} ${includedDevices === 1 ? t('graphml.dialog.deviceSingular', 'Gerät') : t('graphml.dialog.devicePlural', 'Geräte')} & ${includedCables} ${includedCables === 1 ? t('graphml.dialog.cableSingular', 'Kabel') : t('graphml.dialog.cablePlural', 'Kabel')} ${t('graphml.dialog.toCanvas', 'auf Canvas importieren')}`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="flex h-[80vh] w-[min(1100px,95vw)] flex-col overflow-hidden rounded border border-cp-border bg-cp-surface-1 text-cp-text">
        <div className="flex items-center justify-between border-b border-cp-border px-4 py-2">
          <h3 className="text-cp-base font-semibold">{t('graphml.dialog.heading', 'yEd / GraphML importieren')}</h3>
          <button
            type="button"
            onClick={() => {
              reset()
              onClose()
            }}
            className="text-cp-text-faint hover:text-cp-text-bright"
            aria-label={t('graphml.dialog.closeAria', 'Schließen')}
          >
            <Icon icon={X} size="sm" />
          </button>
        </div>
        {stage.kind === 'empty' && renderEmpty()}
        {stage.kind === 'parsing' && renderParsing(stage.fileName)}
        {stage.kind === 'error' && renderError(stage.fileName, stage.message)}
        {stage.kind === 'preview' && renderPreview(stage)}
      </div>
    </div>
  )
}
