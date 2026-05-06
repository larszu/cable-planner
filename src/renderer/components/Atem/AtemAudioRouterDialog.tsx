import { useEffect, useMemo, useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import type {
  AtemAudioConfig,
  AtemClassicAudioInput,
} from '../../types/equipment'
import {
  isLegacyAudioConfig,
  migrateLegacyAudioConfig,
  parseAudioConfigXml,
  serializeAudioConfigXml,
} from '../../lib/atemAudioMappingXml'
import { confirmDialog } from '../../lib/confirmDialog'

/**
 * Issue #45 — ATEM Audio editor.
 *
 * The audio section in an ATEM Profile XML differs by switcher model:
 *  - Fairlight-capable models (Constellation, 4 M/E) ship <AudioMapping>
 *    with a 224×256 routing matrix. UI: Dante-style crosspoint grid.
 *  - Older Production Studio / Television Studio models ship <AudioMixer>
 *    with per-input mixOption (Off/On/AFV) + gain + balance. No routing.
 *    UI: classic channel-strip list.
 *  - Some models ship both; the dialog shows tabs and lets the user edit
 *    either or both before saving the patched profile XML back out.
 *
 * "Save XML" only changes the audio attributes — every other section of the
 * Profile (MixEffectBlocks, Settings, Multiviewers, ButtonMapping, Macros…)
 * is round-tripped byte-for-byte unchanged.
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
  const [activeTab, setActiveTab] = useState<'matrix' | 'classic'>('matrix')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Initialise draft from equipment when opening. Discard the v0.3.0 Fairlight
  // shape (mainGain/balance/onAir per source); migrate the v0.3.1 flat
  // {sources,outputs} shape into the new {matrix:{...}} wrapper.
  useEffect(() => {
    if (!open) return
    setErrorMsg('')
    const stored = equipment?.atemAudioConfig
    if (!stored) {
      setDraft(null)
      return
    }
    if (isLegacyAudioConfig(stored)) {
      const migrated = migrateLegacyAudioConfig(stored)
      setDraft(migrated)
      if (migrated?.matrix) setActiveTab('matrix')
      return
    }
    const value = stored as AtemAudioConfig
    setDraft(value)
    if (value.matrix) setActiveTab('matrix')
    else if (value.classicMixer) setActiveTab('classic')
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
          const config = parseAudioConfigXml(String(reader.result ?? ''))
          setDraft(config)
          setErrorMsg('')
          // Auto-pick a sensible default tab
          if (config.matrix) setActiveTab('matrix')
          else if (config.classicMixer) setActiveTab('classic')
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
      const xml = serializeAudioConfigXml(draft)
      const blob = new Blob([xml], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${equipment.name.replace(/[^a-z0-9\-_. ]/gi, '_')}-AudioConfig.xml`
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
              ATEM Audio-Konfiguration — {equipment.name}
            </h2>
            <div className="text-[11px] text-slate-400">
              {summarise(draft)}
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
            title="ATEM Profile-XML laden — die Audio-Sektion(en) werden in den Editor übernommen"
          >
            📂 XML laden
          </button>
          <button
            type="button"
            onClick={handleSaveXml}
            disabled={!draft || busy}
            className="rounded bg-emerald-700 px-3 py-1 hover:bg-emerald-600 disabled:opacity-50"
            title="Patched Profile-XML herunterladen (alle Nicht-Audio-Sektionen bleiben unverändert)"
          >
            💾 XML speichern
          </button>
          {draft && (draft.matrix || draft.classicMixer) && (
            <>
              <span className="ml-2 text-slate-500">|</span>
              {draft.matrix && (
                <button
                  type="button"
                  onClick={() => setActiveTab('matrix')}
                  className={`rounded px-3 py-1 ${
                    activeTab === 'matrix'
                      ? 'bg-sky-800 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  🎚 Routing-Matrix ({draft.matrix.outputs.length}×{draft.matrix.sources.length})
                </button>
              )}
              {draft.classicMixer && (
                <button
                  type="button"
                  onClick={() => setActiveTab('classic')}
                  className={`rounded px-3 py-1 ${
                    activeTab === 'classic'
                      ? 'bg-sky-800 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  🎛 Klassischer Mixer ({draft.classicMixer.inputs.length} Inputs)
                </button>
              )}
            </>
          )}
        </div>

        {errorMsg && (
          <div className="border-b border-red-700/50 bg-red-900/30 px-4 py-2 text-xs text-red-200">
            ⚠ {errorMsg}
          </div>
        )}

        <main className="flex flex-1 overflow-hidden">
          {!draft ? (
            <EmptyState onLoad={handleLoadXml} />
          ) : activeTab === 'matrix' && draft.matrix ? (
            <MatrixView config={draft} setConfig={setDraft} />
          ) : activeTab === 'classic' && draft.classicMixer ? (
            <ClassicMixerView config={draft} setConfig={setDraft} />
          ) : (
            <div className="m-auto text-sm text-slate-400">
              Kein {activeTab === 'matrix' ? 'Routing' : 'Klassischer Mixer'} im
              geladenen Profil. Wechsel den Tab oder lade ein Profil mit dieser
              Sektion.
            </div>
          )}
        </main>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-700 px-4 py-2 text-xs">
          <span className="mr-auto text-slate-500">
            Nicht-destruktiv: nur Audio-Attribute werden geändert, alle anderen
            Profile-Sektionen bleiben erhalten.
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
            title="Konfiguration im Projekt persistieren (überlebt Reload)."
          >
            Im Projekt speichern
          </button>
        </footer>
      </div>
    </div>
  )
}

const summarise = (draft: AtemAudioConfig | null): string => {
  if (!draft) {
    return 'Lade ein ATEM Profile-XML — Editor erkennt automatisch ob Crosspoint-Matrix oder Klassischer Mixer.'
  }
  const parts: string[] = []
  if (draft.matrix) {
    const routed = draft.matrix.outputs.filter((o) => o.sourceId !== 0).length
    parts.push(
      `Matrix: ${draft.matrix.sources.length} Quellen × ${draft.matrix.outputs.length} Outputs · ${routed} aktive Routings`,
    )
  }
  if (draft.classicMixer) {
    const live = draft.classicMixer.inputs.filter(
      (i) => i.mixOption !== 'Off',
    ).length
    parts.push(
      `Classic Mixer: ${draft.classicMixer.inputs.length} Inputs · ${live} aktiv (On / AFV)`,
    )
  }
  return parts.join(' · ') || 'Audio-Sektion erkannt.'
}

const EmptyState = ({ onLoad }: { onLoad: () => void }) => (
  <div className="m-auto max-w-md text-center text-sm text-slate-400">
    <div className="mb-2 text-3xl">🎛</div>
    <div className="mb-3 text-base font-semibold text-slate-200">
      ATEM Audio-Konfiguration
    </div>
    <p className="mb-3">
      Lade ein ATEM Profile-XML (z. B. exportiert aus dem ATEM Software Control).
    </p>
    <ul className="mb-4 list-inside list-disc text-left text-xs text-slate-400">
      <li>
        Fairlight-fähige Modelle (Constellation / 4 M/E) öffnen mit{' '}
        <strong>Crosspoint-Matrix</strong>.
      </li>
      <li>
        Production Studio / Television Studio öffnen mit{' '}
        <strong>klassischem Channel-Strip</strong> (Off/On/AFV + Gain).
      </li>
      <li>Geräte mit beiden Sektionen erhalten beide Tabs.</li>
    </ul>
    <button
      type="button"
      onClick={onLoad}
      className="rounded bg-sky-700 px-4 py-2 text-sm hover:bg-sky-600"
    >
      📂 ATEM Profile-XML laden
    </button>
  </div>
)

// --- Matrix view --------------------------------------------------------

interface ViewProps {
  config: AtemAudioConfig
  setConfig: (c: AtemAudioConfig) => void
}

const CELL = 18
const HEADER_HEIGHT = 110
const SIDE_WIDTH = 220

const MatrixView = ({ config, setConfig }: ViewProps) => {
  const matrix = config.matrix!
  const [filterSources, setFilterSources] = useState('')
  const [filterOutputs, setFilterOutputs] = useState('')

  const visibleSources = useMemo(() => {
    const q = filterSources.trim().toLowerCase()
    if (!q) return matrix.sources
    return matrix.sources.filter((s) => s.name.toLowerCase().includes(q))
  }, [matrix.sources, filterSources])

  const visibleOutputs = useMemo(() => {
    const q = filterOutputs.trim().toLowerCase()
    if (!q) return matrix.outputs
    return matrix.outputs.filter((o) => o.name.toLowerCase().includes(q))
  }, [matrix.outputs, filterOutputs])

  const cellCount = visibleSources.length * visibleOutputs.length
  const tooLarge = cellCount > 12000

  const setRouting = (outputId: number, sourceId: number) => {
    setConfig({
      ...config,
      matrix: {
        ...matrix,
        outputs: matrix.outputs.map((o) =>
          o.id === outputId ? { ...o, sourceId } : o,
        ),
      },
    })
  }

  const clearAllOutputs = async () => {
    if (
      !(await confirmDialog('Alle Routings auf "No Audio" zurücksetzen?', {
        destructive: true,
        okLabel: 'Zurücksetzen',
      }))
    )
      return
    setConfig({
      ...config,
      matrix: {
        ...matrix,
        outputs: matrix.outputs.map((o) => ({ ...o, sourceId: 0 })),
      },
    })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-950/30 px-4 py-2 text-xs">
        <input
          type="text"
          value={filterSources}
          onChange={(e) => setFilterSources(e.target.value)}
          placeholder="Quellen filtern…"
          title="Substring-Filter für Audio-Quellen (Zeilen)"
          aria-label="Quellen filtern"
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
        />
        <input
          type="text"
          value={filterOutputs}
          onChange={(e) => setFilterOutputs(e.target.value)}
          placeholder="Outputs filtern…"
          title="Substring-Filter für Audio-Outputs (Spalten)"
          aria-label="Outputs filtern"
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
        />
        <button
          type="button"
          onClick={clearAllOutputs}
          className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
        >
          Alle Routings zurücksetzen
        </button>
        <span className="ml-2 text-slate-500">
          {visibleSources.length} × {visibleOutputs.length} sichtbar
        </span>
      </div>

      {tooLarge ? (
        <div className="m-auto max-w-md text-center text-sm text-amber-200">
          <div className="mb-2 text-2xl">⚠</div>
          <p>
            {cellCount.toLocaleString()} sichtbare Crosspoints sind zu viel
            für eine flüssige Darstellung. Bitte über die Filter eingrenzen
            (Ziel: unter 12.000 Zellen).
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
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
                {visibleOutputs.map((o) => (
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
              {visibleSources.map((s) => {
                const routedToCount = visibleOutputs.filter(
                  (o) => o.sourceId === s.id,
                ).length
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
                    {visibleOutputs.map((o) => {
                      const isRouted = o.sourceId === s.id
                      const outputHasOtherSource =
                        !isRouted && o.sourceId !== 0
                      return (
                        <td
                          key={o.id}
                          title={
                            isRouted
                              ? `${s.name} → ${o.name} — Klick zum Entfernen`
                              : `${s.name} → ${o.name}`
                          }
                          onClick={() =>
                            setRouting(o.id, isRouted ? 0 : s.id)
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
                            <span
                              style={{
                                color: '#0f172a',
                                fontWeight: 700,
                                fontSize: 11,
                              }}
                            >
                              ●
                            </span>
                          ) : outputHasOtherSource ? (
                            <span style={{ color: '#475569', fontSize: 9 }}>
                              ·
                            </span>
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
      )}
    </div>
  )
}

// --- Classic mixer view -------------------------------------------------

const ClassicMixerView = ({ config, setConfig }: ViewProps) => {
  const mixer = config.classicMixer!
  const [filter, setFilter] = useState('')

  const labelFor = (id: number): string => {
    const lbl = config.inputLabels?.[id]
    if (lbl?.longName) return lbl.longName
    if (lbl?.shortName) return lbl.shortName
    // Special audio-only ids for older mixers
    if (id === 1001) return 'Mic 1'
    if (id === 1101) return 'Mic 2'
    if (id === 1201) return 'RCA'
    if (id === 1301) return 'XLR'
    if (id >= 2001 && id <= 2099) return `Color ${id - 2000}`
    if (id >= 3010 && id < 3050) return `Media Player ${Math.floor((id - 3010) / 10) + 1}`
    return `Input ${id}`
  }

  const filteredInputs = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return mixer.inputs
    return mixer.inputs.filter((inp) => {
      if (String(inp.id).includes(q)) return true
      return labelFor(inp.id).toLowerCase().includes(q)
    })
  }, [mixer.inputs, filter, config.inputLabels])

  const setInput = (id: number, patch: Partial<AtemClassicAudioInput>) => {
    setConfig({
      ...config,
      classicMixer: {
        ...mixer,
        inputs: mixer.inputs.map((i) =>
          i.id === id ? { ...i, ...patch } : i,
        ),
      },
    })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-950/30 px-4 py-2 text-xs">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Inputs filtern (Name oder ID)…"
          title="Substring-Filter für Audio-Inputs"
          aria-label="Inputs filtern"
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
        />
        <span className="text-slate-500">
          {filteredInputs.length} / {mixer.inputs.length} sichtbar
        </span>
        <span className="ml-auto text-slate-400">
          Master: gain{' '}
          <input
            type="number"
            step={0.1}
            value={mixer.programOutGain}
            onChange={(e) =>
              setConfig({
                ...config,
                classicMixer: {
                  ...mixer,
                  programOutGain: Number(e.target.value),
                },
              })
            }
            className="w-16 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-right font-mono"
            title="programOutGain (dB)"
            aria-label="Master Gain (dB)"
          />{' '}
          dB · balance{' '}
          <input
            type="number"
            step={1}
            min={-100}
            max={100}
            value={mixer.programOutBalance}
            onChange={(e) =>
              setConfig({
                ...config,
                classicMixer: {
                  ...mixer,
                  programOutBalance: Number(e.target.value),
                },
              })
            }
            className="w-14 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-right font-mono"
            title="programOutBalance (-100..+100)"
            aria-label="Master Balance"
          />
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-950 text-slate-300">
            <tr className="border-b border-slate-700">
              <th className="px-2 py-1 text-left">ID</th>
              <th className="px-2 py-1 text-left">Bezeichnung</th>
              <th className="px-2 py-1 text-left">Mix</th>
              <th className="px-2 py-1 text-right">Gain (dB)</th>
              <th className="px-2 py-1 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {filteredInputs.map((inp) => {
              const lbl = config.inputLabels?.[inp.id]
              const port = lbl?.externalPortType
              return (
                <tr
                  key={inp.id}
                  className={`border-b border-slate-800 ${
                    inp.mixOption !== 'Off' ? 'bg-emerald-950/20' : ''
                  }`}
                >
                  <td className="px-2 py-1 font-mono text-slate-500">
                    {inp.id}
                  </td>
                  <td className="px-2 py-1">
                    <span className="text-slate-100">{labelFor(inp.id)}</span>
                    {lbl?.shortName && (
                      <span className="ml-2 text-[10px] text-slate-500">
                        ({lbl.shortName})
                      </span>
                    )}
                    {port && (
                      <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                        {port}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <div className="inline-flex overflow-hidden rounded border border-slate-700">
                      {(['Off', 'On', 'AudioFollowVideo'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setInput(inp.id, { mixOption: m })}
                          className={`px-2 py-0.5 text-[10px] ${
                            inp.mixOption === m
                              ? m === 'Off'
                                ? 'bg-slate-600 text-white'
                                : m === 'On'
                                  ? 'bg-emerald-700 text-white'
                                  : 'bg-amber-700 text-white'
                              : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                          }`}
                          title={
                            m === 'Off'
                              ? 'Stumm'
                              : m === 'On'
                                ? 'Immer aktiv (im Programm-Mix)'
                                : 'Audio-Follow-Video'
                          }
                        >
                          {m === 'AudioFollowVideo' ? 'AFV' : m}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-1 text-right">
                    <input
                      type="number"
                      step={0.1}
                      max={6}
                      value={inp.gain ?? ''}
                      placeholder="-inf"
                      onChange={(e) => {
                        const v = e.target.value
                        setInput(inp.id, {
                          gain: v === '' ? null : Number(v),
                        })
                      }}
                      className="w-20 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-right font-mono"
                      title={`Gain für Input ${inp.id} in dB. Leer = -inf (stumm).`}
                      aria-label={`Gain Input ${inp.id}`}
                    />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <input
                      type="number"
                      step={1}
                      min={-100}
                      max={100}
                      value={inp.balance}
                      onChange={(e) =>
                        setInput(inp.id, { balance: Number(e.target.value) })
                      }
                      className="w-16 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-right font-mono"
                      title={`Balance für Input ${inp.id} (-100..+100)`}
                      aria-label={`Balance Input ${inp.id}`}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
