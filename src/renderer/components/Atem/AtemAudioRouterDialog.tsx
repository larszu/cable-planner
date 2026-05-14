import { useEffect, useMemo, useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import { downloadBlob } from '../../lib/downloadBlob'
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
import { format, useTranslation } from '../../lib/i18n'

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
  const t = useTranslation()
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
      downloadBlob(
        `${equipment.name}-AudioConfig.xml`,
        xml,
        'application/xml',
      )
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

  /** Build a fresh AtemAudioConfig with the ATEM-default Crosspoint
   *  Matrix layout — 24 sources × 8 output buses. Source IDs use the
   *  conventional ATEM input numbering so any saved XML can be
   *  imported into the real software without a re-map. */
  const handleCreateMatrix = () => {
    const sources = [
      // Camera inputs 1..8 (ATEM convention)
      ...Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        name: `Cam ${i + 1}`,
      })),
      // Aux + MP + Color sources match ATEM's internal IDs
      { id: 1101, name: 'MP 1' },
      { id: 1102, name: 'MP 2' },
      { id: 2001, name: 'Color 1' },
      { id: 2002, name: 'Color 2' },
      // Aux 1..6
      ...Array.from({ length: 6 }, (_, i) => ({
        id: 8001 + i,
        name: `Aux ${i + 1}`,
      })),
      { id: 10010, name: 'Program' },
      { id: 10011, name: 'Preview' },
      { id: 10012, name: 'Clean Feed 1' },
      { id: 10013, name: 'Clean Feed 2' },
      { id: 16000, name: 'No Audio' }, // sentinel; ATEM treats sourceId 0 as "no audio"
    ]
    const outputs = [
      { id: 1, sourceId: 10010, name: 'Out 1 (Program)' },
      ...Array.from({ length: 7 }, (_, i) => ({
        id: i + 2,
        sourceId: 0,
        name: `Out ${i + 2}`,
      })),
    ]
    setDraft({ matrix: { sources, outputs } })
    setActiveTab('matrix')
    setErrorMsg('')
  }

  /** Build a fresh AtemAudioConfig with the classic-mixer defaults —
   *  8 channel strips, all On, 0 dB, centred. Matches the ATEM 2 M/E
   *  Production Studio out-of-the-box state. */
  const handleCreateClassic = () => {
    setDraft({
      classicMixer: {
        programOutGain: 0,
        programOutBalance: 0,
        programOutFollowFadeToBlack: false,
        audioFollowVideoCrossfadeTransition: false,
        inputs: Array.from({ length: 8 }, (_, i) => ({
          id: i + 1,
          mixOption: 'On' as const,
          gain: 0,
          balance: 0,
        })),
      },
    })
    setActiveTab('classic')
    setErrorMsg('')
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
              {t('atem.audio.title', 'ATEM Audio-Konfiguration')} — {equipment.name}
            </h2>
            <div className="text-[11px] text-slate-400">
              {summarise(draft, t)}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
          >
            {t('common.close', 'Schließen')}
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-700 bg-slate-950/40 px-4 py-2 text-xs">
          <button
            type="button"
            onClick={handleLoadXml}
            disabled={busy}
            className="rounded bg-sky-700 px-3 py-1 hover:bg-sky-600 disabled:opacity-50"
            title={t(
              'atem.audio.action.loadXmlTitle',
              'ATEM Profile-XML laden — die Audio-Sektion(en) werden in den Editor übernommen',
            )}
          >
            {t('atem.audio.action.loadXml', '📂 XML laden')}
          </button>
          <button
            type="button"
            onClick={handleSaveXml}
            disabled={!draft || busy}
            className="rounded bg-emerald-700 px-3 py-1 hover:bg-emerald-600 disabled:opacity-50"
            title={t(
              'atem.audio.action.saveXmlTitle',
              'Patched Profile-XML herunterladen (alle Nicht-Audio-Sektionen bleiben unverändert)',
            )}
          >
            {t('atem.audio.action.saveXml', '💾 XML speichern')}
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
                  {t('atem.audio.tab.matrix', '🎚 Routing-Matrix')} ({draft.matrix.outputs.length}×{draft.matrix.sources.length})
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
                  {t('atem.audio.tab.classic', '🎛 Klassischer Mixer')} ({draft.classicMixer.inputs.length} Inputs)
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
            <EmptyState
              onLoad={handleLoadXml}
              onCreateMatrix={handleCreateMatrix}
              onCreateClassic={handleCreateClassic}
              equipmentName={equipment.name}
            />
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
            {t(
              'atem.audio.footer',
              'Nicht-destruktiv: nur Audio-Attribute werden geändert, alle anderen Profile-Sektionen bleiben erhalten.',
            )}
          </span>
          <button
            type="button"
            onClick={close}
            className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
          >
            {t('common.cancel', 'Abbrechen')}
          </button>
          <button
            type="button"
            onClick={handleSaveToProject}
            disabled={!draft}
            className="rounded bg-emerald-700 px-3 py-1 hover:bg-emerald-600 disabled:opacity-50"
            title={t(
              'atem.audio.action.saveProjectTitle',
              'Konfiguration im Projekt persistieren (überlebt Reload).',
            )}
          >
            {t('atem.audio.action.saveProject', 'Im Projekt speichern')}
          </button>
        </footer>
      </div>
    </div>
  )
}

const summarise = (
  draft: AtemAudioConfig | null,
  t: (key: string, fallback?: string) => string,
): string => {
  if (!draft) {
    return t(
      'atem.audio.empty.summary',
      'Lade ein ATEM Profile-XML — Editor erkennt automatisch ob Crosspoint-Matrix oder Klassischer Mixer.',
    )
  }
  const parts: string[] = []
  if (draft.matrix) {
    const routed = draft.matrix.outputs.filter((o) => o.sourceId !== 0).length
    parts.push(
      format(
        t(
          'atem.audio.summary',
          'Matrix: {sources} Quellen × {outputs} Outputs · {routed} aktive Routings',
        ),
        { sources: draft.matrix.sources.length, outputs: draft.matrix.outputs.length, routed },
      ),
    )
  }
  if (draft.classicMixer) {
    const live = draft.classicMixer.inputs.filter(
      (i) => i.mixOption !== 'Off',
    ).length
    parts.push(
      format(
        t(
          'atem.audio.summaryClassic',
          'Classic Mixer: {count} Inputs · {live} aktiv (On / AFV)',
        ),
        { count: draft.classicMixer.inputs.length, live },
      ),
    )
  }
  return parts.join(' · ') || t('atem.audio.detected', 'Audio-Sektion erkannt.')
}

const EmptyState = ({
  onLoad,
  onCreateMatrix,
  onCreateClassic,
  equipmentName,
}: {
  onLoad: () => void
  onCreateMatrix: () => void
  onCreateClassic: () => void
  equipmentName: string
}) => (
  <div className="m-auto max-w-md text-center text-sm text-slate-400">
    <div className="mb-2 text-3xl">🎛</div>
    <div className="mb-3 text-base font-semibold text-slate-200">
      ATEM Audio-Konfiguration
    </div>
    <p className="mb-3">
      Lade ein bestehendes ATEM Profile-XML — oder fang manuell mit den Standard-Defaults
      für deinen Mischer an. Beim Speichern erzeugen wir ein gültiges Profile-XML, das du
      direkt im ATEM Software Control importieren kannst.
    </p>
    <ul className="mb-4 list-inside list-disc text-left text-xs text-slate-400">
      <li>
        Neuere Modelle (Constellation / 4 M/E) nutzen die{' '}
        <strong>Crosspoint-Matrix</strong>.
      </li>
      <li>
        Production Studio / Television Studio öffnen mit{' '}
        <strong>klassischem Channel-Strip</strong> (Off/On/AFV + Gain).
      </li>
    </ul>
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={onLoad}
        className="rounded bg-sky-700 px-4 py-2 text-sm hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        📂 Profile-XML laden
      </button>
      <button
        type="button"
        onClick={onCreateMatrix}
        title="Frische Crosspoint-Matrix mit den ATEM-Standard-Eingängen + 8 Output-Bussen (für Constellation / 4 M/E)."
        className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 hover:border-sky-600 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        🎚 Matrix manuell
      </button>
      <button
        type="button"
        onClick={onCreateClassic}
        title="Frischer klassischer Mixer (8 Channel-Strips, alle On, 0 dB, mittig)."
        className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 hover:border-sky-600 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        🎛 Klassischer Mixer
      </button>
    </div>
    <p className="mt-3 text-[10px] text-slate-500">
      Für {equipmentName || 'das aktuelle Gerät'}. Die Defaults richten sich nach den
      üblichen ATEM-Audio-Bus-Layouts; du kannst Quellen, Outputs + Mappings danach frei
      bearbeiten.
    </p>
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

/** Issue #63: shared checkbox-list overlay for excluding sources or
 *  outputs from the matrix. Items are grouped by `groupKey` so the
 *  user can tick a whole device (e.g. "MADI", "Out 5/6") in one
 *  click. Used by both source and output filter buttons. */
interface ChannelPickerProps {
  label: string
  items: { id: number; name: string }[]
  excluded: Set<number>
  onToggle: (id: number) => void
  onSetAll: (excludedIds: number[]) => void
  groupKey: (name: string) => string
  onClose: () => void
}

const ChannelPicker = ({
  label,
  items,
  excluded,
  onToggle,
  onSetAll,
  groupKey,
  onClose,
}: ChannelPickerProps) => {
  const groups = useMemo(() => {
    const map = new Map<string, { id: number; name: string }[]>()
    for (const it of items) {
      const k = groupKey(it.name)
      const list = map.get(k) ?? []
      list.push(it)
      map.set(k, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [items, groupKey])

  const allExcluded = items.length > 0 && items.every((it) => excluded.has(it.id))
  return (
    <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-2 text-xs">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-slate-300">
          {label} ein-/ausblenden — abgewählte Einträge fallen aus Filter, Liste und Matrix.
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onSetAll([])}
            className="rounded bg-slate-800 px-2 py-0.5 text-[11px] hover:bg-slate-700"
          >
            Alle zeigen
          </button>
          <button
            type="button"
            onClick={() => onSetAll(items.map((i) => i.id))}
            className="rounded bg-slate-800 px-2 py-0.5 text-[11px] hover:bg-slate-700"
            disabled={allExcluded}
          >
            Alle ausblenden
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-800 px-2 py-0.5 text-[11px] hover:bg-slate-700"
          >
            Schließen
          </button>
        </div>
      </div>
      <div className="flex max-h-32 flex-wrap gap-x-3 gap-y-1 overflow-auto">
        {groups.map(([key, members]) => {
          const allHidden = members.every((m) => excluded.has(m.id))
          const someHidden = members.some((m) => excluded.has(m.id))
          return (
            <div key={key} className="flex flex-col">
              <button
                type="button"
                onClick={() => {
                  const next = new Set(excluded)
                  if (allHidden) {
                    for (const m of members) next.delete(m.id)
                  } else {
                    for (const m of members) next.add(m.id)
                  }
                  onSetAll(Array.from(next))
                }}
                className={`mb-0.5 rounded px-2 py-0.5 text-left text-[11px] font-semibold ${
                  allHidden
                    ? 'bg-slate-800 text-slate-500'
                    : someHidden
                      ? 'bg-amber-900/40 text-amber-200'
                      : 'bg-sky-900/40 text-sky-200'
                }`}
                title={`${key} — komplette Gruppe an-/abhaken`}
              >
                {allHidden ? '☐' : someHidden ? '◐' : '☑'} {key}
              </button>
              {members.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-1 pl-2 text-[10px] text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={!excluded.has(m.id)}
                    onChange={() => onToggle(m.id)}
                  />
                  <span className="truncate" title={m.name}>
                    {m.name}
                  </span>
                </label>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const MatrixView = ({ config, setConfig }: ViewProps) => {
  const matrix = config.matrix!
  const [filterSources, setFilterSources] = useState('')
  const [filterOutputs, setFilterOutputs] = useState('')
  // Issue #63: per-id exclude lists so the user can hide groups of
  // sources/outputs they never patch (e.g. MADI block, output pairs
  // 5/6, 7/8 …). Stored in this component's state because it's a
  // pure UI concern; persisting would only help across sessions and
  // adds store surface for little gain.
  const [excludedSourceIds, setExcludedSourceIds] = useState<Set<number>>(new Set())
  const [excludedOutputIds, setExcludedOutputIds] = useState<Set<number>>(new Set())
  const [showSourcePicker, setShowSourcePicker] = useState(false)
  const [showOutputPicker, setShowOutputPicker] = useState(false)
  // Override the "too many crosspoints" guard — the user wants to be
  // able to scroll through a big matrix anyway. We start with the
  // guard armed (so the warning still flashes once for a fresh
  // session) and remember the override across re-renders.
  const [renderAnyway, setRenderAnyway] = useState(false)

  const visibleSources = useMemo(() => {
    const q = filterSources.trim().toLowerCase()
    return matrix.sources.filter((s) => {
      if (excludedSourceIds.has(s.id)) return false
      if (q && !s.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [matrix.sources, filterSources, excludedSourceIds])

  const visibleOutputs = useMemo(() => {
    const q = filterOutputs.trim().toLowerCase()
    return matrix.outputs.filter((o) => {
      if (excludedOutputIds.has(o.id)) return false
      if (q && !o.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [matrix.outputs, filterOutputs, excludedOutputIds])

  const cellCount = visibleSources.length * visibleOutputs.length
  const tooLarge = cellCount > 12000 && !renderAnyway

  /** Heuristic group key for the checkbox list: take the part before the
   *  trailing number. "MADI 1" → "MADI", "Out 5" → "Out", "AES 4" → "AES".
   *  Lets the user toggle whole device-classes with one click via the
   *  "alle gleichnamigen" link. */
  const groupKey = (name: string): string =>
    name.replace(/\s*\d+(?:[/-]\d+)?\s*$/, '').trim() || name

  const toggleSetMember = (
    setter: (next: Set<number>) => void,
    current: Set<number>,
    id: number,
  ) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setter(next)
  }

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
          onClick={() => setShowSourcePicker((v) => !v)}
          title="Quellen einzeln an-/abhaken (z. B. MADI, Mic, Tape …)"
          className={`rounded border px-3 py-1 ${
            excludedSourceIds.size > 0
              ? 'border-sky-600 bg-sky-900/40 text-sky-200'
              : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
        >
          Quellen-Auswahl
          {excludedSourceIds.size > 0 && (
            <span className="ml-1 text-[10px] text-sky-300">
              ({excludedSourceIds.size} versteckt)
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setShowOutputPicker((v) => !v)}
          title="Outputs einzeln an-/abhaken (z. B. Out 5/6, 7/8 weglassen)"
          className={`rounded border px-3 py-1 ${
            excludedOutputIds.size > 0
              ? 'border-sky-600 bg-sky-900/40 text-sky-200'
              : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
        >
          Outputs-Auswahl
          {excludedOutputIds.size > 0 && (
            <span className="ml-1 text-[10px] text-sky-300">
              ({excludedOutputIds.size} versteckt)
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={clearAllOutputs}
          className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
        >
          Alle Routings zurücksetzen
        </button>
        <span className="ml-2 text-slate-500">
          {visibleSources.length} × {visibleOutputs.length} sichtbar
          {cellCount.toLocaleString() !== ''
            ? ` · ${cellCount.toLocaleString()} Crosspoints`
            : ''}
        </span>
      </div>

      {showSourcePicker && (
        <ChannelPicker
          label="Quellen"
          items={matrix.sources}
          excluded={excludedSourceIds}
          onToggle={(id) => toggleSetMember(setExcludedSourceIds, excludedSourceIds, id)}
          onSetAll={(ids) => setExcludedSourceIds(new Set(ids))}
          groupKey={groupKey}
          onClose={() => setShowSourcePicker(false)}
        />
      )}
      {showOutputPicker && (
        <ChannelPicker
          label="Outputs"
          items={matrix.outputs}
          excluded={excludedOutputIds}
          onToggle={(id) => toggleSetMember(setExcludedOutputIds, excludedOutputIds, id)}
          onSetAll={(ids) => setExcludedOutputIds(new Set(ids))}
          groupKey={groupKey}
          onClose={() => setShowOutputPicker(false)}
        />
      )}

      {tooLarge ? (
        <div className="m-auto max-w-md text-center text-sm text-amber-200">
          <div className="mb-2 text-2xl">⚠</div>
          <p>
            {cellCount.toLocaleString()} sichtbare Crosspoints können das Rendering
            verlangsamen. Über die Quellen-/Outputs-Auswahl eingrenzen oder trotzdem
            anzeigen lassen — die Warnung bleibt dann für diese Sitzung aus.
          </p>
          <button
            type="button"
            onClick={() => setRenderAnyway(true)}
            className="mt-3 rounded bg-amber-700 px-3 py-1 text-xs text-amber-50 hover:bg-amber-600"
          >
            Trotzdem anzeigen
          </button>
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
