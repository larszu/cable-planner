import { useEffect, useMemo, useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import type { AtemAudioConfig } from '../../types/equipment'
import {
  isLegacyFairlightConfig,
  parseAudioMappingXml,
  serializeAudioMappingXml,
} from '../../lib/atemAudioMappingXml'

/**
 * Issue #45 (v2) — ATEM Audio Routing Matrix.
 *
 * Crosspoint grid à la Dante Controller: rows = AudioSources, columns =
 * AudioOutputs. Click a cell to route that source to that output (each output
 * can hold exactly ONE sourceId — clicking another cell in the same column
 * automatically replaces the previous routing). Click an already-routed cell
 * to clear it (sourceId = 0 / "No Audio").
 *
 * Workflow:
 *   1. "📂 XML laden" — pick an ATEM Profile XML file from disk (the example
 *      profile shipped by Blackmagic for the Constellation 4 M/E or any
 *      user's own exported profile).
 *   2. Edit crosspoints in the matrix.
 *   3. "💾 XML speichern" — download the patched XML. Only the sourceId
 *      attributes of <Output> elements inside <AudioMapping> are changed;
 *      every other section of the profile (MixEffectBlocks, Settings,
 *      Fairlight, ButtonMapping, …) is round-tripped byte-for-byte unchanged.
 *
 * Optional: "Im Projekt speichern" persists the routing into
 * equipment.atemAudioConfig so it survives project reload (also stores the
 * raw XML so a later "XML speichern" works without re-loading).
 */
export const AtemAudioRouterDialog = () => {
  const { open, deviceId } = useUiStore((s) => s.atemAudioConfig)
  const close = useUiStore((s) => s.closeAtemAudioConfig)
  const equipment = useProjectStore((s) =>
    s.project.equipment.find((e) => e.id === deviceId),
  )
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const drag = useDraggablePosition('cable-planner:modal-pos:atem-audio', open)

  const [draft, setDraft] = useState<AtemAudioConfig | null>(null)
  const [filterSources, setFilterSources] = useState('')
  const [filterOutputs, setFilterOutputs] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Initialise draft from equipment when opening. Legacy v0.3.0 Fairlight
  // configs (with mainGain/balance/onAir per source) are dropped — the matrix
  // is the new authoritative shape and there's no useful migration.
  useEffect(() => {
    if (!open) return
    setErrorMsg('')
    if (equipment?.atemAudioConfig && !isLegacyFairlightConfig(equipment.atemAudioConfig)) {
      setDraft(equipment.atemAudioConfig as AtemAudioConfig)
    } else {
      setDraft(null)
    }
  }, [open, equipment])

  if (!open || !equipment) return null

  const handleLoadXml = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xml,application/xml,text/xml'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const config = parseAudioMappingXml(String(reader.result ?? ''))
          setDraft(config)
          setErrorMsg('')
        } catch (e) {
          setErrorMsg(e instanceof Error ? e.message : String(e))
        }
      }
      reader.onerror = () => setErrorMsg('Konnte Datei nicht lesen.')
      reader.readAsText(file)
    }
    input.click()
  }

  const handleSaveXml = () => {
    if (!draft) return
    setBusy(true)
    try {
      const xml = serializeAudioMappingXml(draft)
      const blob = new Blob([xml], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${equipment.name.replace(/[^a-z0-9\-_. ]/gi, '_')}-AudioMapping.xml`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleSaveToProject = () => {
    if (!draft) return
    updateEquipment(equipment.id, { atemAudioConfig: draft })
    close()
  }

  const setRouting = (outputId: number, sourceId: number) => {
    if (!draft) return
    setDraft({
      ...draft,
      outputs: draft.outputs.map((o) =>
        o.id === outputId ? { ...o, sourceId } : o,
      ),
    })
  }

  const clearAllOutputs = () => {
    if (!draft) return
    if (!window.confirm('Alle Routings auf "No Audio" zurücksetzen?')) return
    setDraft({
      ...draft,
      outputs: draft.outputs.map((o) => ({ ...o, sourceId: 0 })),
    })
  }

  const visibleSources = useMemo(() => {
    if (!draft) return []
    const q = filterSources.trim().toLowerCase()
    if (!q) return draft.sources
    return draft.sources.filter((s) => s.name.toLowerCase().includes(q))
  }, [draft, filterSources])

  const visibleOutputs = useMemo(() => {
    if (!draft) return []
    const q = filterOutputs.trim().toLowerCase()
    if (!q) return draft.outputs
    return draft.outputs.filter((o) => o.name.toLowerCase().includes(q))
  }, [draft, filterOutputs])

  // Render guard: 256 × 224 = 57.3k cells is a lot of DOM. Encourage filtering
  // when the visible matrix would exceed ~12k cells (still ~120 × 100).
  const cellCount = visibleSources.length * visibleOutputs.length
  const tooLarge = cellCount > 12000

  const routedOutputCount = draft?.outputs.filter((o) => o.sourceId !== 0).length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={drag.containerRef}
        style={drag.containerStyle}
        className="flex h-full max-h-[92vh] w-full max-w-[95vw] flex-col rounded border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
      >
        <header
          {...drag.headerProps}
          className="flex items-center justify-between border-b border-slate-700 px-4 py-2 select-none"
        >
          <div>
            <h2 className="text-base font-semibold">
              ATEM Audio Routing-Matrix — {equipment.name}
            </h2>
            <div className="text-[11px] text-slate-400">
              {draft
                ? `${draft.sources.length} Quellen × ${draft.outputs.length} Outputs · ${routedOutputCount} aktive Routings`
                : 'Lade ein ATEM Profile-XML, um die AudioMapping-Sektion zu editieren.'}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
          >
            Schließen
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-700 bg-slate-950/40 px-4 py-2 text-xs">
          <button
            type="button"
            onClick={handleLoadXml}
            disabled={busy}
            className="rounded bg-sky-700 px-3 py-1 hover:bg-sky-600 disabled:opacity-50"
            title="ATEM Profile-XML laden — die <AudioMapping>-Sektion wird in die Matrix übernommen"
          >
            📂 XML laden
          </button>
          <button
            type="button"
            onClick={handleSaveXml}
            disabled={!draft || busy}
            className="rounded bg-emerald-700 px-3 py-1 hover:bg-emerald-600 disabled:opacity-50"
            title="Patched Profile-XML herunterladen (alle nicht-Audio-Sektionen bleiben unverändert)"
          >
            💾 XML speichern
          </button>
          <button
            type="button"
            onClick={clearAllOutputs}
            disabled={!draft}
            className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600 disabled:opacity-50"
          >
            Alle Routings zurücksetzen
          </button>
          <span className="ml-2 text-slate-500">|</span>
          <input
            type="text"
            value={filterSources}
            onChange={(e) => setFilterSources(e.target.value)}
            placeholder="Quellen filtern…"
            title="Substring-Filter für Audio-Quellen (Zeilen)"
            aria-label="Quellen filtern"
            disabled={!draft}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs disabled:opacity-50"
          />
          <input
            type="text"
            value={filterOutputs}
            onChange={(e) => setFilterOutputs(e.target.value)}
            placeholder="Outputs filtern…"
            title="Substring-Filter für Audio-Outputs (Spalten)"
            aria-label="Outputs filtern"
            disabled={!draft}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs disabled:opacity-50"
          />
          {draft && (
            <span className="ml-2 text-slate-500">
              {visibleSources.length} × {visibleOutputs.length} sichtbar
            </span>
          )}
        </div>

        {errorMsg && (
          <div className="border-b border-red-700/50 bg-red-900/30 px-4 py-2 text-xs text-red-200">
            ⚠ {errorMsg}
          </div>
        )}

        <main className="flex flex-1 overflow-hidden">
          {!draft ? (
            <div className="m-auto max-w-md text-center text-sm text-slate-400">
              <div className="mb-2 text-3xl">🎛</div>
              <div className="mb-3 text-base font-semibold text-slate-200">
                Audio Routing-Matrix
              </div>
              <p className="mb-3">
                Lade ein ATEM Profile-XML (z. B. exportiert aus dem ATEM
                Software Control). Die <code>&lt;AudioMapping&gt;</code>-Sektion
                wird als Crosspoint-Matrix dargestellt — jede Spalte ist ein
                Output (MADI-Track, Aux-Paar), jede Zeile eine Quelle (Input,
                Mic, MADI, Talkback, Program, Aux Mix).
              </p>
              <p className="mb-3 text-xs">
                Klick auf einen Crosspoint = Routing setzen.<br />
                Klick auf einen aktiven Crosspoint = Routing löschen.
              </p>
              <button
                type="button"
                onClick={handleLoadXml}
                className="rounded bg-sky-700 px-4 py-2 text-sm hover:bg-sky-600"
              >
                📂 ATEM Profile-XML laden
              </button>
            </div>
          ) : tooLarge ? (
            <div className="m-auto max-w-md text-center text-sm text-amber-200">
              <div className="mb-2 text-2xl">⚠</div>
              <p>
                {cellCount.toLocaleString()} sichtbare Crosspoints sind zu viel
                für eine flüssige Darstellung. Bitte über die Filter oben oder
                links eingrenzen (Ziel: unter 12.000 Zellen).
              </p>
            </div>
          ) : (
            <CrosspointMatrix
              sources={visibleSources}
              outputs={visibleOutputs}
              onSetRouting={setRouting}
            />
          )}
        </main>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-700 px-4 py-2 text-xs">
          <span className="mr-auto text-slate-500">
            Nicht-destruktiv: nur <code>sourceId</code>-Attribute werden geändert,
            alle anderen Profile-Sektionen bleiben unverändert.
          </span>
          <button
            type="button"
            onClick={close}
            className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSaveToProject}
            disabled={!draft}
            className="rounded bg-emerald-700 px-3 py-1 hover:bg-emerald-600 disabled:opacity-50"
            title="Routing im Projekt persistieren (überlebt Reload). XML kann zusätzlich exportiert werden."
          >
            Im Projekt speichern
          </button>
        </footer>
      </div>
    </div>
  )
}

const CELL = 18
const HEADER_HEIGHT = 110
const SIDE_WIDTH = 220

interface MatrixProps {
  sources: { id: number; name: string }[]
  outputs: { id: number; sourceId: number; name: string }[]
  onSetRouting: (outputId: number, sourceId: number) => void
}

const CrosspointMatrix = ({ sources, outputs, onSetRouting }: MatrixProps) => {
  return (
    <div className="flex-1 overflow-auto" style={{ position: 'relative' }}>
      <table
        style={{
          borderCollapse: 'separate',
          borderSpacing: 0,
          fontSize: 10,
          color: '#cbd5e1',
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                width: SIDE_WIDTH,
                minWidth: SIDE_WIDTH,
                height: HEADER_HEIGHT,
                position: 'sticky',
                top: 0,
                left: 0,
                zIndex: 4,
                background: '#0f172a',
                borderRight: '1px solid #1e293b',
                borderBottom: '2px solid #475569',
              }}
            />
            {outputs.map((o) => (
              <th
                key={o.id}
                title={`${o.name} (id ${o.id})`}
                style={{
                  width: CELL,
                  minWidth: CELL,
                  height: HEADER_HEIGHT,
                  position: 'sticky',
                  top: 0,
                  zIndex: 3,
                  background: o.sourceId !== 0 ? '#0c2c1f' : '#0f172a',
                  borderBottom: '2px solid #475569',
                  borderRight: '1px solid #1e293b',
                  padding: 0,
                  verticalAlign: 'bottom',
                }}
              >
                <div
                  style={{
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxHeight: HEADER_HEIGHT - 6,
                    padding: '3px 1px',
                    fontFamily: 'monospace',
                    fontSize: 9,
                    color: o.sourceId !== 0 ? '#86efac' : '#94a3b8',
                  }}
                >
                  {o.name}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => {
            const routedToCount = outputs.filter((o) => o.sourceId === s.id).length
            return (
              <tr key={s.id}>
                <th
                  title={`${s.name} (id ${s.id}) — ${routedToCount} Output(s)`}
                  style={{
                    width: SIDE_WIDTH,
                    minWidth: SIDE_WIDTH,
                    height: CELL,
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    background: routedToCount > 0 ? '#0c2c1f' : '#0f172a',
                    borderRight: '2px solid #475569',
                    borderBottom: '1px solid #1e293b',
                    textAlign: 'right',
                    padding: '0 6px',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: routedToCount > 0 ? '#86efac' : '#cbd5e1',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {s.name}
                  {routedToCount > 0 && (
                    <span
                      style={{
                        marginLeft: 4,
                        background: '#10b981',
                        color: '#0f172a',
                        borderRadius: 2,
                        padding: '0 3px',
                        fontSize: 9,
                        fontWeight: 700,
                      }}
                    >
                      ×{routedToCount}
                    </span>
                  )}
                </th>
                {outputs.map((o) => {
                  const isRouted = o.sourceId === s.id
                  // Highlight the cell of the actual routing for *every*
                  // visible source so the user can see at a glance which
                  // output is taken even when the active source is filtered
                  // out. We just dim non-active rows.
                  const outputHasOtherSource = !isRouted && o.sourceId !== 0
                  return (
                    <td
                      key={o.id}
                      title={
                        isRouted
                          ? `${s.name} → ${o.name} — Klick zum Entfernen`
                          : `${s.name} → ${o.name}`
                      }
                      onClick={() =>
                        onSetRouting(o.id, isRouted ? 0 : s.id)
                      }
                      style={{
                        width: CELL,
                        minWidth: CELL,
                        height: CELL,
                        padding: 0,
                        textAlign: 'center',
                        border: '1px solid #1e293b',
                        background: isRouted
                          ? '#10b981'
                          : outputHasOtherSource
                            ? '#1e3a5f'
                            : '#0f172a',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      {isRouted ? (
                        <span style={{ color: '#0f172a', fontWeight: 700, fontSize: 11 }}>
                          ●
                        </span>
                      ) : outputHasOtherSource ? (
                        <span style={{ color: '#475569', fontSize: 9 }}>·</span>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
