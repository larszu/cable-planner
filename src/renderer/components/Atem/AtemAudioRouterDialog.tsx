import { useEffect, useMemo, useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { LIMITS } from '../../lib/layoutConstants'
import { cablePlannerApi, hasDesktopBridge } from '../../lib/bridge'
import { infoDialog } from '../../lib/infoDialog'
import type {
  AtemAudioConfig,
} from '../../types/equipment'
import {
  isLegacyAudioConfig,
  migrateLegacyAudioConfig,
  parseAudioConfigXml,
  serializeAudioConfigXml,
} from '../../lib/atemAudioMappingXml'
import { confirmDialog } from '../../lib/confirmDialog'
import {
  AlertTriangle, FolderOpen, Save, Plug, Upload, SlidersHorizontal,
  Square, SquareCheck, SquareMinus,
} from 'lucide-react'
import { format, useTranslation } from '../../lib/i18n'
import { Icon } from '../shared/Icon'
import { getEquipmentById } from '../../lib/equipmentSelectors'

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
    getEquipmentById(s.project.equipment, deviceId),
  )
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const { containerRef, containerStyle, headerProps } = useDraggablePosition(
    'cable-planner:modal-pos:atem-audio',
    open,
  )

  const [draft, setDraft] = useState<AtemAudioConfig | null>(null)
  // v7.5.0 — the classic-mixer view was removed. The router now
  // edits only the routing matrix (AudioMapping section). Imported
  // XMLs that also contain a classic-mixer (AudioMixer) section keep
  // that data in `draft.classicMixer` so save round-trips byte-for-
  // byte, but the user-facing UI is matrix-only.
  const [activeTab, setActiveTab] = useState<'matrix'>('matrix')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Initialise draft from equipment when opening. Discard the v0.3.0 Fairlight
  // shape (mainGain/balance/onAir per source); migrate the v0.3.1 flat
  // {sources,outputs} shape into the new {matrix:{...}} wrapper.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Draft beim Dialog-Öffnen aus equipment seeden (keyed sync)
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
    setActiveTab('matrix')
  }, [open, equipment])

  // v7.9.52 — Live-Connection-Status für die OpenSwitcher-style
  // Read/Push-Buttons. Wird beim Dialog-Open + alle 4s gepollt.
  const [atemConnected, setAtemConnected] = useState(false)
  useEffect(() => {
    if (!open) return
    let stopped = false
    const refresh = async () => {
      try {
        const st = await cablePlannerApi.atem.getStatus()
        if (!stopped) setAtemConnected(!!st?.connected)
      } catch {
        if (!stopped) setAtemConnected(false)
      }
    }
    void refresh()
    const id = window.setInterval(refresh, 4000)
    return () => {
      stopped = true
      window.clearInterval(id)
    }
  }, [open])

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
          setActiveTab('matrix')
        } catch (e) {
          setErrorMsg(e instanceof Error ? e.message : String(e))
        }
      }
      reader.onerror = () => setErrorMsg(t('atem.audio.readFileError', 'Konnte Datei nicht lesen.'))
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
        // v7.9.116 — Einheitlicher Stempel.
        buildExportFilenameWithSuffix(equipment.name, 'AudioConfig', 'xml'),
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

  // v7.9.52 — OpenSwitcher-Style: liest den aktuellen Audio-Zustand
  // direkt vom verbundenen ATEM (Matrix + Classic + Input-Labels), ohne
  // Umweg über das Profile-XML.
  const handleReadFromAtem = async () => {
    if (!atemConnected) {
      await infoDialog(t('atem.audio.notConnectedTitle', 'ATEM nicht verbunden'), {
        body: t(
          'atem.audio.notConnectedBody',
          'Verbinde dich zuerst mit dem ATEM (Hauptdialog "ATEM Mischer").',
        ),
        tone: 'warning',
      })
      return
    }
    setBusy(true)
    setErrorMsg('')
    try {
      const live = await cablePlannerApi.atem.readAudioConfig()
      if (!live || (!live.matrix && !live.classicMixer)) {
        await infoDialog(t('atem.audio.noAudioDataTitle', 'Keine Audio-Daten'), {
          body: t(
            'atem.audio.noAudioDataBody',
            'Der verbundene ATEM hat weder eine Routing-Matrix noch einen Classic-Mixer im State. Manche Mini-Modelle haben gar kein editierbares Audio-Routing.',
          ),
          tone: 'warning',
        })
        return
      }
      // raws aus Draft beibehalten (XML-Round-Trip kompatibilität), nur
      // matrix/classicMixer/inputLabels überschreiben.
      const merged: AtemAudioConfig = {
        ...(draft ?? {}),
        matrix: live.matrix ?? draft?.matrix,
        classicMixer: live.classicMixer ?? draft?.classicMixer,
        inputLabels: live.inputLabels ?? draft?.inputLabels,
      }
      setDraft(merged)
      setActiveTab('matrix')
      await infoDialog(t('atem.audio.loadedTitle', 'Audio-Config vom ATEM geladen'), {
        body: [
          live.matrix
            ? format(
                t('atem.audio.loadedMatrix', 'Matrix: {outputs} Outputs × {sources} Sources'),
                { outputs: live.matrix.outputs.length, sources: live.matrix.sources.length },
              )
            : null,
          live.classicMixer
            ? format(t('atem.audio.loadedClassic', 'Classic-Mixer: {inputs} Inputs'), {
                inputs: live.classicMixer.inputs.length,
              })
            : null,
          live.inputLabels
            ? format(t('atem.audio.loadedLabels', 'Input-Labels: {count}'), {
                count: Object.keys(live.inputLabels).length,
              })
            : null,
        ].filter(Boolean).join('\n'),
        tone: 'success',
      })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handlePushToAtem = async () => {
    if (!draft) return
    if (!atemConnected) {
      await infoDialog(t('atem.audio.notConnectedTitle', 'ATEM nicht verbunden'), {
        body: t(
          'atem.audio.notConnectedBody',
          'Verbinde dich zuerst mit dem ATEM (Hauptdialog "ATEM Mischer").',
        ),
        tone: 'warning',
      })
      return
    }
    const confirmed = await confirmDialog(
      t('atem.audio.sendConfirmTitle', 'Audio-Konfiguration an ATEM senden?'),
      {
        body: t(
          'atem.audio.sendConfirmBody',
          'Die geladene Routing-Matrix / Classic-Mixer-Werte werden direkt an den verbundenen Switcher geschickt. Änderungen sind sofort wirksam und werden NICHT als Startup-State persistiert — dazu musst du in ATEM Software Control "Save Startup State" aufrufen.',
        ),
        okLabel: t('atem.audio.sendOk', 'Senden'),
      },
    )
    if (!confirmed) return
    setBusy(true)
    setErrorMsg('')
    try {
      const result = await cablePlannerApi.atem.applyAudioConfig({
        matrix: draft.matrix
          ? { outputs: draft.matrix.outputs.map((o) => ({ id: o.id, sourceId: o.sourceId })) }
          : undefined,
        classicMixer: draft.classicMixer
          ? { inputs: draft.classicMixer.inputs }
          : undefined,
        inputLabels: draft.inputLabels
          ? Object.fromEntries(
              Object.entries(draft.inputLabels).map(([id, l]) => [
                id,
                { shortName: l.shortName, longName: l.longName },
              ]),
            )
          : undefined,
      })
      await infoDialog(t('atem.audio.sentTitle', 'Konfiguration gesendet'), {
        body: format(
          t(
            'atem.audio.sentBody',
            'Matrix: {matrix} · Classic: {classic} · Labels: {labels}\n\nNicht vergessen: in ATEM Software Control "Save Startup State" um die Werte persistent zu machen.',
          ),
          {
            matrix: result.matrixApplied,
            classic: result.classicApplied,
            labels: result.labelsApplied,
          },
        ),
        tone: 'success',
      })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={containerRef}
        style={containerStyle}
        className="flex h-full max-h-[92vh] w-full max-w-[95vw] flex-col rounded border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
      >
        <header
          {...headerProps}
          className="flex items-center justify-between border-b border-slate-700 px-4 py-2 select-none"
        >
          <div>
            <h2 className="text-cp-xl font-semibold">
              {t('atem.audio.title', 'ATEM Audio-Konfiguration')} — {equipment.name}
            </h2>
            <div className="text-[11px] text-slate-400">
              {summarise(draft, t)}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded bg-slate-700 px-3 py-1 text-cp-xs hover:bg-slate-600"
          >
            {t('common.close', 'Schließen')}
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-700 bg-slate-950/40 px-4 py-2 text-cp-xs">
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
            <Icon icon={FolderOpen} size="xs" className="mr-1 inline-block align-text-bottom" />{t('atem.audio.action.loadXml', 'XML laden')}
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
            <Icon icon={Save} size="xs" className="mr-1 inline-block align-text-bottom" />{t('atem.audio.action.saveXml', 'XML speichern')}
          </button>
          {/* v7.9.52 — OpenSwitcher-style Live-Direct-Pfad. Sichtbar nur
              wenn Desktop-Bridge verfügbar; Aktiv nur wenn ATEM gerade
              verbunden ist. Funktioniert OHNE XML-Datei — liest und
              schreibt direkt aus/in den Switcher-State. */}
          {hasDesktopBridge && (
            <>
              <span className="ml-2 text-slate-600">|</span>
              <button
                type="button"
                onClick={handleReadFromAtem}
                disabled={!atemConnected || busy}
                className="rounded bg-purple-700 px-3 py-1 hover:bg-purple-600 disabled:opacity-50"
                title={
                  atemConnected
                    ? t('atem.audio.readLiveTitle', 'Live-State vom verbundenen ATEM lesen (Matrix + Classic-Mixer + Labels)')
                    : t('atem.audio.readOfflineTitle', 'ATEM nicht verbunden — im Haupt-Dialog "ATEM Mischer" verbinden')
                }
              >
                <Icon icon={Plug} size="xs" className="mr-1 inline-block align-text-bottom" />{atemConnected ? t('atem.audio.readFromAtem', 'Vom ATEM lesen') : t('atem.audio.readOffline', 'Lesen (offline)')}
              </button>
              <button
                type="button"
                onClick={handlePushToAtem}
                disabled={!atemConnected || !draft || busy}
                className="rounded bg-orange-700 px-3 py-1 hover:bg-orange-600 disabled:opacity-50"
                title={
                  atemConnected
                    ? t('atem.audio.pushLiveTitle', 'Aktuelle Konfiguration direkt an den ATEM senden (kein XML-Umweg)')
                    : t('atem.audio.readOfflineTitle', 'ATEM nicht verbunden — im Haupt-Dialog "ATEM Mischer" verbinden')
                }
              >
                <Icon icon={Upload} size="xs" className="mr-1 inline-block align-text-bottom" />{atemConnected ? t('atem.audio.pushToAtem', 'An ATEM senden') : t('atem.audio.pushOffline', 'Senden (offline)')}
              </button>
            </>
          )}
          {draft?.matrix && (
            <>
              <span className="ml-2 text-slate-500">|</span>
              <span className="rounded bg-sky-800 px-3 py-1 text-white">
                <Icon icon={SlidersHorizontal} size="xs" className="mr-1 inline-block align-text-bottom" />{t('atem.audio.tab.matrix', 'Routing-Matrix')} ({draft.matrix.outputs.length}×{draft.matrix.sources.length})
              </span>
              {draft.classicMixer && (
                <span
                  className="text-[10px] text-slate-400"
                  title={t('atem.audio.classicReadOnly', 'Das geladene XML enthält zusätzlich eine klassische AudioMixer-Sektion. Sie wird beim Speichern unverändert mit zurück ins XML geschrieben, ist aber hier nicht editierbar.')}
                >
                  {t('atem.audio.classicSectionBadge', '+ AudioMixer-Sektion (read-only, round-trip)')}
                </span>
              )}
            </>
          )}
        </div>

        {errorMsg && (
          <div className="flex items-center gap-1.5 border-b border-red-700/50 bg-red-900/30 px-4 py-2 text-cp-xs text-red-200">
            <Icon icon={AlertTriangle} size="sm" />
            {errorMsg}
          </div>
        )}

        <main className="flex flex-1 overflow-hidden">
          {!draft ? (
            <EmptyState
              onLoad={handleLoadXml}
              onCreateMatrix={handleCreateMatrix}
              equipmentName={equipment.name}
            />
          ) : draft.matrix ? (
            <MatrixView config={draft} setConfig={setDraft} />
          ) : draft.classicMixer && !draft.matrix ? (
            <div className="m-auto max-w-md text-center text-cp-base text-slate-400">
              <p>
                {t(
                  'atem.audio.classicOnly',
                  'Dieses XML enthält nur eine klassische AudioMixer-Sektion und keine Routing-Matrix. Die Sektion wird beim Speichern unverändert zurückgeschrieben (Round-Trip), ist aber im Editor nicht editierbar. Lege bei Bedarf via "Matrix manuell" oben eine neue Crosspoint-Matrix an — beide Sektionen koexistieren dann im XML.',
                )}
              </p>
              <button
                type="button"
                onClick={handleCreateMatrix}
                className="mt-3 rounded bg-sky-700 px-3 py-1 text-cp-xs text-white hover:bg-sky-600"
              >
                <Icon icon={SlidersHorizontal} size="xs" className="mr-1 inline-block align-text-bottom" />{t('atem.audio.createMatrixManual', 'Matrix manuell anlegen')}
              </button>
            </div>
          ) : (
            <div className="m-auto text-cp-base text-slate-400">
              {format(
                t('atem.audio.noSection', 'Kein {section} im geladenen Profil. Wechsel den Tab oder lade ein Profil mit dieser Sektion.'),
                {
                  section:
                    activeTab === 'matrix'
                      ? t('atem.audio.sectionRouting', 'Routing')
                      : t('atem.audio.sectionClassicMixer', 'Klassischer Mixer'),
                },
              )}
            </div>
          )}
        </main>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-700 px-4 py-2 text-cp-xs">
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
  equipmentName,
}: {
  onLoad: () => void
  onCreateMatrix: () => void
  equipmentName: string
}) => {
  const t = useTranslation()
  return (
  <div className="m-auto max-w-md text-center text-cp-base text-slate-400">
    <div className="mb-2 flex justify-center"><Icon icon={SlidersHorizontal} size={28} /></div>
    <div className="mb-3 text-cp-lg font-semibold text-slate-200">
      {t('atem.audio.welcomeTitle', 'ATEM Audio-Routing')}
    </div>
    <p className="mb-3">
      {t(
        'atem.audio.welcomeIntro',
        'Lade ein bestehendes ATEM Profile-XML — oder fang manuell mit der Crosspoint-Matrix an. Beim Speichern erzeugen wir ein gültiges Profile-XML, das du direkt im ATEM Software Control importieren kannst.',
      )}
    </p>
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={onLoad}
        className="rounded bg-sky-700 px-4 py-2 text-cp-base hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <Icon icon={FolderOpen} size="xs" className="mr-1 inline-block align-text-bottom" />{t('atem.audio.loadProfileXml', 'Profile-XML laden')}
      </button>
      <button
        type="button"
        onClick={onCreateMatrix}
        title={t('atem.audio.freshMatrix', 'Frische Crosspoint-Matrix mit den ATEM-Standard-Eingängen + 8 Output-Bussen.')}
        className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-cp-base text-slate-100 hover:border-sky-600 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <Icon icon={SlidersHorizontal} size="xs" className="mr-1 inline-block align-text-bottom" />{t('atem.audio.matrixManual', 'Matrix manuell')}
      </button>
    </div>
    <p className="mt-3 text-[10px] text-slate-400">
      {format(
        t(
          'atem.audio.welcomeFooter',
          'Für {name}. 24 Standard-Quellen × 8 Output-Busse; Quellen + Outputs + Mappings danach frei bearbeiten.',
        ),
        { name: equipmentName || t('atem.audio.currentDevice', 'das aktuelle Gerät') },
      )}
    </p>
  </div>
  )
}

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
  const t = useTranslation()
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
    <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-2 text-cp-xs">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-slate-300">
          {format(
            t(
              'atem.audio.picker.toggleLabel',
              '{label} ein-/ausblenden — abgewählte Einträge fallen aus Filter, Liste und Matrix.',
            ),
            { label },
          )}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onSetAll([])}
            className="rounded bg-slate-800 px-2 py-0.5 text-[11px] hover:bg-slate-700"
          >
            {t('atem.audio.picker.showAll', 'Alle zeigen')}
          </button>
          <button
            type="button"
            onClick={() => onSetAll(items.map((i) => i.id))}
            className="rounded bg-slate-800 px-2 py-0.5 text-[11px] hover:bg-slate-700"
            disabled={allExcluded}
          >
            {t('atem.audio.picker.hideAll', 'Alle ausblenden')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-800 px-2 py-0.5 text-[11px] hover:bg-slate-700"
          >
            {t('common.close', 'Schließen')}
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
                title={format(t('atem.audio.groupToggleTitle', '{key} — komplette Gruppe an-/abhaken'), { key })}
              >
                <Icon icon={allHidden ? Square : someHidden ? SquareMinus : SquareCheck} size="xs" className="mr-1 inline-block align-text-bottom" />{key}
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
  const t = useTranslation()
  const matrix = config.matrix!
  // #450 — Theme-aware Matrix-Chrome. Neutrale Töne kippen mit dem Theme;
  // die gesättigten Emerald-Routing-Indikatoren bleiben in beiden gleich.
  const isLight = useUiStore((s) => s.canvasTheme) === 'light'
  const MX = isLight
    ? {
        chromeBg: '#eaeff5',
        borderSubtle: '#cbd5e1',
        borderStrong: '#94a3b8',
        text: '#334155',
        textMuted: '#64748b',
        routedBg: '#dcfce7',
        routedText: '#15803d',
        otherCell: '#dbeafe',
      }
    : {
        chromeBg: '#0f172a',
        borderSubtle: '#1e293b',
        borderStrong: '#475569',
        text: '#cbd5e1',
        textMuted: '#94a3b8',
        routedBg: '#0c2c1f',
        routedText: '#86efac',
        otherCell: '#1e3a5f',
      }
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
  const tooLarge = cellCount > LIMITS.MAX_ATEM_MATRIX_CELLS && !renderAnyway

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
      !(await confirmDialog(t('atem.audio.resetAllConfirm', 'Alle Routings auf "No Audio" zurücksetzen?'), {
        destructive: true,
        okLabel: t('common.reset', 'Zurücksetzen'),
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
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-950/30 px-4 py-2 text-cp-xs">
        <input
          type="text"
          value={filterSources}
          onChange={(e) => setFilterSources(e.target.value)}
          placeholder={t('atem.audio.filterSourcesPlaceholder', 'Quellen filtern…')}
          title={t('atem.audio.filterSourcesTitle', 'Substring-Filter für Audio-Quellen (Zeilen)')}
          aria-label={t('atem.audio.filterSourcesAria', 'Quellen filtern')}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-cp-xs"
        />
        <input
          type="text"
          value={filterOutputs}
          onChange={(e) => setFilterOutputs(e.target.value)}
          placeholder={t('atem.audio.filterOutputsPlaceholder', 'Outputs filtern…')}
          title={t('atem.audio.filterOutputsTitle', 'Substring-Filter für Audio-Outputs (Spalten)')}
          aria-label={t('atem.audio.filterOutputsAria', 'Outputs filtern')}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-cp-xs"
        />
        <button
          type="button"
          onClick={() => setShowSourcePicker((v) => !v)}
          title={t('atem.audio.sourcesCheckTitle', 'Quellen einzeln an-/abhaken (z. B. MADI, Mic, Tape …)')}
          className={`rounded border px-3 py-1 ${
            excludedSourceIds.size > 0
              ? 'border-sky-600 bg-sky-900/40 text-sky-200'
              : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
        >
          {t('atem.audio.sourcePicker', 'Quellen-Auswahl')}
          {excludedSourceIds.size > 0 && (
            <span className="ml-1 text-[10px] text-sky-300">
              ({excludedSourceIds.size} {t('atem.audio.hidden', 'versteckt')})
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setShowOutputPicker((v) => !v)}
          title={t('atem.audio.outputsCheckTitle', 'Outputs einzeln an-/abhaken (z. B. Out 5/6, 7/8 weglassen)')}
          className={`rounded border px-3 py-1 ${
            excludedOutputIds.size > 0
              ? 'border-sky-600 bg-sky-900/40 text-sky-200'
              : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
        >
          {t('atem.audio.outputPicker', 'Outputs-Auswahl')}
          {excludedOutputIds.size > 0 && (
            <span className="ml-1 text-[10px] text-sky-300">
              ({excludedOutputIds.size} {t('atem.audio.hidden', 'versteckt')})
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={clearAllOutputs}
          className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
        >
          {t('atem.audio.resetAllBtn', 'Alle Routings zurücksetzen')}
        </button>
        <span className="ml-2 text-slate-500">
          {visibleSources.length} × {visibleOutputs.length} {t('atem.audio.visible', 'sichtbar')}
          {cellCount.toLocaleString() !== ''
            ? ` · ${cellCount.toLocaleString()} ${t('atem.audio.crosspoints', 'Crosspoints')}`
            : ''}
        </span>
      </div>

      {showSourcePicker && (
        <ChannelPicker
          label={t('atem.audio.sourcesLabel', 'Quellen')}
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
          label={t('atem.audio.outputsLabel', 'Outputs')}
          items={matrix.outputs}
          excluded={excludedOutputIds}
          onToggle={(id) => toggleSetMember(setExcludedOutputIds, excludedOutputIds, id)}
          onSetAll={(ids) => setExcludedOutputIds(new Set(ids))}
          groupKey={groupKey}
          onClose={() => setShowOutputPicker(false)}
        />
      )}

      {tooLarge ? (
        <div className="m-auto max-w-md text-center text-cp-base text-amber-200">
          <div className="mb-2 flex justify-center"><Icon icon={AlertTriangle} size={28} /></div>
          <p>
            {format(
              t(
                'atem.audio.tooLargeWarn',
                '{count} sichtbare Crosspoints können das Rendering verlangsamen. Über die Quellen-/Outputs-Auswahl eingrenzen oder trotzdem anzeigen lassen — die Warnung bleibt dann für diese Sitzung aus.',
              ),
              { count: cellCount.toLocaleString() },
            )}
          </p>
          <button
            type="button"
            onClick={() => setRenderAnyway(true)}
            className="mt-3 rounded bg-amber-700 px-3 py-1 text-cp-xs text-amber-50 hover:bg-amber-600"
          >
            {t('atem.audio.renderAnyway', 'Trotzdem anzeigen')}
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table
            style={{
              borderCollapse: 'separate',
              borderSpacing: 0,
              fontSize: 10,
              color: MX.text,
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
                    background: MX.chromeBg,
                    borderRight: `1px solid ${MX.borderSubtle}`,
                    borderBottom: `2px solid ${MX.borderStrong}`,
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
                      background: o.sourceId !== 0 ? MX.routedBg : MX.chromeBg,
                      borderBottom: `2px solid ${MX.borderStrong}`,
                      borderRight: `1px solid ${MX.borderSubtle}`,
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
                        color: o.sourceId !== 0 ? MX.routedText : MX.textMuted,
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
                      title={format(t('atem.audio.sourceRowTitle', '{name} (id {id}) — {count} Output(s)'), { name: s.name, id: s.id, count: routedToCount })}
                      style={{
                        width: SIDE_WIDTH,
                        minWidth: SIDE_WIDTH,
                        height: CELL,
                        position: 'sticky',
                        left: 0,
                        zIndex: 2,
                        background: routedToCount > 0 ? MX.routedBg : MX.chromeBg,
                        borderRight: `2px solid ${MX.borderStrong}`,
                        borderBottom: `1px solid ${MX.borderSubtle}`,
                        textAlign: 'right',
                        padding: '0 6px',
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: routedToCount > 0 ? MX.routedText : MX.text,
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
                              ? format(t('atem.audio.cellRoutedTitle', '{src} → {out} — Klick zum Entfernen'), { src: s.name, out: o.name })
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
                            border: `1px solid ${MX.borderSubtle}`,
                            background: isRouted
                              ? '#10b981'
                              : outputHasOtherSource
                                ? MX.otherCell
                                : MX.chromeBg,
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
                            // #456 — Marker "Output anderweitig belegt": vorher
                            // fontSize 9 + slate-600 (#475569) → winzig und
                            // zu kontrastarm. Auf slate-400 + 12px angehoben.
                            <span style={{ color: MX.textMuted, fontSize: 12 }}>
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

