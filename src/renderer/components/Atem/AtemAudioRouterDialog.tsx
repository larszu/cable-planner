import { useEffect, useMemo, useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import { exportDeviceConfig } from '../../lib/deviceConfigExport'
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
import { useDialogA11y } from '../../hooks/useDialogA11y'
import {
  allDeltas,
  audioMatrixAssignments,
  compareAssignments,
  hasDifference,
  type LiveComparison,
} from '../../lib/atemLiveCompare'
import {
  AlertTriangle, FolderOpen, Save, Plug, Upload, SlidersHorizontal,
  Square, SquareCheck, SquareMinus,
} from 'lucide-react'
import { format, useTranslation } from '../../lib/i18n'
import { Icon } from '../shared/Icon'
import { getEquipmentById } from '../../lib/equipmentSelectors'
import { useBackdropClose } from '../../hooks/useBackdropClose'

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
  // Initiative 10 — die Beobachtung liegt NEBEN dem Entwurf, nicht darin.
  //
  // Vorher mischte `handleReadFromAtem` den Live-Stand per
  // `live.matrix ?? draft?.matrix` in `draft`. Danach war nicht mehr
  // feststellbar, welche Kreuzung geplant und welche abgelesen war — und
  // „Im Projekt speichern" schrieb die Beobachtung als Absicht ins Projekt.
  // Der Videohub-Dialog hat dieselbe Stelle bereits geheilt und begruendet
  // sie dort ausfuehrlich.
  const [live, setLive] = useState<AtemAudioConfig | null>(null)
  const [liveReadAt, setLiveReadAt] = useState('')
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
    // Ein abgelesener Stand altert. Ihn ueber das Schliessen hinweg
    // stehenzulassen hiesse, spaeter eine Differenz gegen einen Befund von
    // vorgestern anzuzeigen — dieselbe erfundene Bestaetigung, nur langsamer.
    setLive(null)
    setLiveReadAt('')
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

  // Initiative 10 — die Differenz, nicht die Vermischung.
  const comparison: LiveComparison | null = useMemo(
    () =>
      live
        ? compareAssignments(
            audioMatrixAssignments(draft?.matrix),
            audioMatrixAssignments(live.matrix),
          )
        : null,
    [draft?.matrix, live],
  )

  /**
   * id → Name, aus beiden Seiten: das Geraet kennt oft die besseren Labels.
   *
   * `undefined` hat je nach Seite zwei verschiedene Bedeutungen und darf
   * nicht mit einem Wort abgetan werden: auf der Plan-Seite heisst es „dafuer
   * gibt es keine Absicht", auf der Geraete-Seite „dazu hat es nichts
   * gesagt". Deshalb nimmt die Funktion das fehlende Wort als Argument.
   */
  const sourceName = (id: number | undefined, missing: string): string => {
    if (id === undefined) return missing
    if (id === 0) return t('atem.audio.noAudio', 'No Audio')
    const found =
      live?.matrix?.sources.find((x) => x.id === id) ??
      draft?.matrix?.sources.find((x) => x.id === id)
    return found?.name ?? String(id)
  }

  /**
   * Die Uebernahme — das, was der Lese-Knopf frueher stillschweigend tat.
   *
   * Sie bleibt vollstaendig moeglich; sie ist nur nicht mehr die Nebenwirkung
   * des Hinschauens. `rawXml` und die uebrigen Entwurfs-Felder bleiben, damit
   * der XML-Round-Trip weiter Byte fuer Byte traegt.
   */
  const handleAdoptLive = async () => {
    if (!live) return
    const changed = comparison ? allDeltas(comparison).length : 0
    if (
      !(await confirmDialog(t('atem.audio.live.adoptConfirm', 'Adopt the reading into the plan?'), {
        body: format(
          t(
            'atem.audio.live.adoptBody',
            'The plan adopts {n} differing assignments from the switcher. Afterwards the plan states what the device is currently doing — the previous intent is replaced.',
          ),
          { n: changed },
        ),
        okLabel: t('atem.audio.live.adoptOk', 'Adopt'),
      }))
    )
      return
    setDraft({
      ...(draft ?? {}),
      matrix: live.matrix ?? draft?.matrix,
      classicMixer: live.classicMixer ?? draft?.classicMixer,
      inputLabels: live.inputLabels ?? draft?.inputLabels,
    })
    setLive(null)
    setLiveReadAt('')
  }

  // Phase 3 der UI-Pruefung. Der Haken bekommt die vorhandene Container-Ref
  // mit, damit Fokus-Falle und Zieh-Container denselben Knoten meinen. Er
  // steht VOR dem bedingten Ausstieg, weil Haken nicht bedingt aufgerufen
  // werden duerfen.
  const { panelRef, titleId, dialogProps } = useDialogA11y(open, close, {
    ref: containerRef,
  })

  // B-44 — der Hintergrund schliesst, aus derselben Quelle wie ueberall.
  const backdrop = useBackdropClose(close)

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
      reader.onerror = () => setErrorMsg(t('atem.audio.readFileError', 'Could not read file.'))
      reader.readAsText(file)
    }
    input.click()
  }

  const handleSaveXml = () => {
    if (!draft) return
    setBusy(true)
    try {
      const xml = serializeAudioConfigXml(draft)
      // BEDARF 43 — mit Herkunfts-Blatt daneben. Die Datei selbst bleibt
      // unberuehrt: was ATEM Setup an zusaetzlichem XML durchlaesst, steht
      // hier nicht fest, und eine zurueckgewiesene Datei ist beim Load-in
      // schlimmer als eine ohne Herkunft.
      exportDeviceConfig(
        equipment.name || 'ATEM',
        'Audio-Zuordnung',
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
      await infoDialog(t('atem.audio.notConnectedTitle', 'ATEM not connected'), {
        body: t(
          'atem.audio.notConnectedBody',
          'Connect to the ATEM first (main dialog "ATEM mixer").',
        ),
        tone: 'warning',
      })
      return
    }
    setBusy(true)
    setErrorMsg('')
    try {
      const reading = await cablePlannerApi.atem.readAudioConfig()
      if (!reading || (!reading.matrix && !reading.classicMixer)) {
        await infoDialog(t('atem.audio.noAudioDataTitle', 'No audio data'), {
          body: t(
            'atem.audio.noAudioDataBody',
            'The connected ATEM has neither a routing matrix nor a classic mixer in its state. Some Mini models have no editable audio routing at all.',
          ),
          tone: 'warning',
        })
        return
      }
      // Initiative 10 — hier stand `setDraft(merged)`.
      //
      // Der Befund wird abgelegt, nicht eingemischt. Was der Switcher gerade
      // tut, ist eine Beobachtung; was im Entwurf steht, eine Absicht. Die
      // Uebernahme gibt es weiter — als eigenen Klick, mit der Differenz
      // davor.
      setLive(reading)
      setLiveReadAt(new Date().toISOString())
      setActiveTab('matrix')
      await infoDialog(t('atem.audio.loadedTitle', 'Audio config read from ATEM'), {
        body: [
          reading.matrix
            ? format(
                t('atem.audio.loadedMatrix', 'Matrix: {outputs} outputs × {sources} sources'),
                { outputs: reading.matrix.outputs.length, sources: reading.matrix.sources.length },
              )
            : null,
          reading.classicMixer
            ? format(t('atem.audio.loadedClassic', 'Classic mixer: {inputs} inputs'), {
                inputs: reading.classicMixer.inputs.length,
              })
            : null,
          reading.inputLabels
            ? format(t('atem.audio.loadedLabels', 'Input labels: {count}'), {
                count: Object.keys(reading.inputLabels).length,
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
      await infoDialog(t('atem.audio.notConnectedTitle', 'ATEM not connected'), {
        body: t(
          'atem.audio.notConnectedBody',
          'Connect to the ATEM first (main dialog "ATEM mixer").',
        ),
        tone: 'warning',
      })
      return
    }
    const confirmed = await confirmDialog(
      t('atem.audio.sendConfirmTitle', 'Send audio configuration to ATEM?'),
      {
        body: t(
          'atem.audio.sendConfirmBody',
          'The loaded routing matrix / classic-mixer values are sent directly to the connected switcher. Changes take effect immediately and are NOT persisted as startup state — for that you must call "Save Startup State" in ATEM Software Control.',
        ),
        okLabel: t('atem.audio.sendOk', 'Send'),
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
      await infoDialog(t('atem.audio.sentTitle', 'Configuration sent'), {
        body: format(
          t(
            'atem.audio.sentBody',
            'Matrix: {matrix} · Classic: {classic} · Labels: {labels}\n\nDon\'t forget: trigger "Save Startup State" in ATEM Software Control to make the values persistent.',
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
    <div
      {...backdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        ref={panelRef}
        style={containerStyle}
        aria-labelledby={titleId}
        {...dialogProps}
        className="flex h-full max-h-[92vh] w-full max-w-[95vw] flex-col rounded border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
      >
        <header
          {...headerProps}
          className="flex items-center justify-between border-b border-slate-700 px-4 py-2 select-none"
        >
          <div>
            <h2 id={titleId} className="text-cp-xl font-semibold">
              {t('atem.audio.title', 'ATEM audio configuration')} — {equipment.name}
            </h2>
            <div className="text-cp-xs text-slate-400">
              {summarise(draft, t)}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded bg-slate-700 px-3 py-1 text-cp-xs hover:bg-slate-600"
          >
            {t('common.close', 'Close')}
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
              'Load ATEM Profile XML — the audio section(s) will be imported into the editor',
            )}
          >
            <Icon icon={FolderOpen} size="xs" className="mr-1 inline-block align-text-bottom" />{t('atem.audio.action.loadXml', 'Load XML')}
          </button>
          <button
            type="button"
            onClick={handleSaveXml}
            disabled={!draft || busy}
            className="rounded bg-emerald-700 px-3 py-1 hover:bg-emerald-600 disabled:opacity-50"
            title={t(
              'atem.audio.action.saveXmlTitle',
              'Download patched Profile XML (all non-audio sections stay unchanged)',
            )}
          >
            <Icon icon={Save} size="xs" className="mr-1 inline-block align-text-bottom" />{t('atem.audio.action.saveXml', 'Save XML')}
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
                    ? t('atem.audio.readLiveTitle', 'Read live state from the connected ATEM (matrix + classic mixer + labels)')
                    : t('atem.audio.readOfflineTitle', 'ATEM not connected — connect in the main "ATEM Switcher" dialog')
                }
              >
                <Icon icon={Plug} size="xs" className="mr-1 inline-block align-text-bottom" />{atemConnected ? t('atem.audio.readFromAtem', 'Read from ATEM') : t('atem.audio.readOffline', 'Read (offline)')}
              </button>
              <button
                type="button"
                onClick={handlePushToAtem}
                disabled={!atemConnected || !draft || busy}
                className="rounded bg-orange-700 px-3 py-1 hover:bg-orange-600 disabled:opacity-50"
                title={
                  atemConnected
                    ? t('atem.audio.pushLiveTitle', 'Send current configuration directly to the ATEM (no XML detour)')
                    : t('atem.audio.readOfflineTitle', 'ATEM not connected — connect in the main "ATEM Switcher" dialog')
                }
              >
                <Icon icon={Upload} size="xs" className="mr-1 inline-block align-text-bottom" />{atemConnected ? t('atem.audio.pushToAtem', 'Send to ATEM') : t('atem.audio.pushOffline', 'Send (offline)')}
              </button>
            </>
          )}
          {draft?.matrix && (
            <>
              <span className="ml-2 text-slate-500">|</span>
              <span className="rounded bg-sky-800 px-3 py-1 text-white">
                <Icon icon={SlidersHorizontal} size="xs" className="mr-1 inline-block align-text-bottom" />{t('atem.audio.tab.matrix', 'Routing matrix')} ({draft.matrix.outputs.length}×{draft.matrix.sources.length})
              </span>
              {draft.classicMixer && (
                <span
                  className="text-cp-xs text-slate-400"
                  title={t('atem.audio.classicReadOnly', 'The loaded XML also contains a classic AudioMixer section. It is round-tripped on save but is not editable here.')}
                >
                  {t('atem.audio.classicSectionBadge', '+ AudioMixer section (read-only, round-trip)')}
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

        {/* Initiative 10 — der abgelesene Stand, sichtbar getrennt vom Plan.
            Nur so ist die Frage „was tut die Maschine anders als geplant?"
            ueberhaupt stellbar; vorher war sie nach dem Lesen unbeantwortbar,
            weil beides in derselben Variable stand. */}
        {live && comparison && (
          <div className="border-b border-purple-700/50 bg-purple-950/30 px-4 py-2 text-cp-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Icon icon={Plug} size="sm" className="text-purple-300" />
              <span className="font-medium text-purple-200">
                {t('atem.audio.live.title', 'Read from the switcher')}
              </span>
              <span className="text-slate-400">
                {liveReadAt ? new Date(liveReadAt).toLocaleTimeString() : ''}
              </span>
              <span className="text-slate-400">·</span>
              <span className={hasDifference(comparison) ? 'text-amber-300' : 'text-emerald-300'}>
                {hasDifference(comparison)
                  ? format(
                      t('atem.audio.live.differs', '{n} differences from the plan'),
                      { n: allDeltas(comparison).length },
                    )
                  : t('atem.audio.live.matches', 'Plan and device agree')}
              </span>
              <span className="text-slate-500">
                {format(t('atem.audio.live.agreeing', '{n} identical'), {
                  n: comparison.agreeing,
                })}
              </span>
              <button
                type="button"
                onClick={() => void handleAdoptLive()}
                className="ml-auto rounded bg-purple-700 px-3 py-1 hover:bg-purple-600"
                title={t(
                  'atem.audio.live.adoptTitle',
                  'Adopt the reading as the new plan — this replaces the previous intent.',
                )}
              >
                {t('atem.audio.live.adopt', 'Adopt into the plan')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLive(null)
                  setLiveReadAt('')
                }}
                className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
                title={t('atem.audio.live.discardTitle', 'Discard the reading — the plan stays as it is.')}
              >
                {t('atem.audio.live.discard', 'Discard reading')}
              </button>
            </div>
            {hasDifference(comparison) && (
              <ul className="mt-1.5 max-h-24 space-y-0.5 overflow-y-auto font-mono text-cp-xs text-slate-300">
                {allDeltas(comparison).map((d) => (
                  <li key={d.key}>
                    <span className="text-slate-400">{d.label}:</span>{' '}
                    <span className="text-sky-300">
                      {sourceName(d.planned, t('atem.audio.live.notPlanned', 'not planned'))}
                    </span>
                    {' -> '}
                    <span className="text-amber-300">
                      {sourceName(d.confirmed, t('atem.audio.live.notMentioned', 'not reported'))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
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
                  'This XML only contains a classic AudioMixer section, no routing matrix. The section is written back unchanged on save (round trip), but is not editable in the editor. If needed, create a fresh crosspoint matrix via "Matrix manual" above — both sections coexist in the XML.',
                )}
              </p>
              <button
                type="button"
                onClick={handleCreateMatrix}
                className="mt-3 rounded bg-sky-700 px-3 py-1 text-cp-xs text-white hover:bg-sky-600"
              >
                <Icon icon={SlidersHorizontal} size="xs" className="mr-1 inline-block align-text-bottom" />{t('atem.audio.createMatrixManual', 'Create matrix manually')}
              </button>
            </div>
          ) : (
            <div className="m-auto text-cp-base text-slate-400">
              {format(
                t('atem.audio.noSection', 'No {section} in the loaded profile. Switch the tab or load a profile that has this section.'),
                {
                  section:
                    activeTab === 'matrix'
                      ? t('atem.audio.sectionRouting', 'routing')
                      : t('atem.audio.sectionClassicMixer', 'classic mixer'),
                },
              )}
            </div>
          )}
        </main>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-700 px-4 py-2 text-cp-xs">
          <span className="mr-auto text-slate-500">
            {t(
              'atem.audio.footer',
              'Non-destructive: only audio attributes are changed; every other profile section is preserved.',
            )}
          </span>
          <button
            type="button"
            onClick={close}
            className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleSaveToProject}
            disabled={!draft}
            className="rounded bg-emerald-700 px-3 py-1 hover:bg-emerald-600 disabled:opacity-50"
            title={t(
              'atem.audio.action.saveProjectTitle',
              'Persist routing in the project (survives reload).',
            )}
          >
            {t('atem.audio.action.saveProject', 'Save in project')}
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
      'Load an ATEM profile XML — the editor automatically detects whether it is a crosspoint matrix or a classic mixer.',
    )
  }
  const parts: string[] = []
  if (draft.matrix) {
    const routed = draft.matrix.outputs.filter((o) => o.sourceId !== 0).length
    parts.push(
      format(
        t(
          'atem.audio.summary',
          'Matrix: {sources} sources × {outputs} outputs · {routed} active routings',
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
          'Classic mixer: {count} inputs · {live} active (On / AFV)',
        ),
        { count: draft.classicMixer.inputs.length, live },
      ),
    )
  }
  return parts.join(' · ') || t('atem.audio.detected', 'Audio section detected.')
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
      {t('atem.audio.welcomeTitle', 'ATEM audio routing')}
    </div>
    <p className="mb-3">
      {t(
        'atem.audio.welcomeIntro',
        'Load an existing ATEM profile XML — or start manually with the crosspoint matrix. On save we produce a valid profile XML you can import straight into ATEM Software Control.',
      )}
    </p>
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={onLoad}
        className="rounded bg-sky-700 px-4 py-2 text-cp-base hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <Icon icon={FolderOpen} size="xs" className="mr-1 inline-block align-text-bottom" />{t('atem.audio.loadProfileXml', 'Load profile XML')}
      </button>
      <button
        type="button"
        onClick={onCreateMatrix}
        title={t('atem.audio.freshMatrix', 'Fresh crosspoint matrix with the ATEM default inputs + 8 output busses.')}
        className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-cp-base text-slate-100 hover:border-sky-600 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <Icon icon={SlidersHorizontal} size="xs" className="mr-1 inline-block align-text-bottom" />{t('atem.audio.matrixManual', 'Matrix manual')}
      </button>
    </div>
    <p className="mt-3 text-cp-xs text-slate-400">
      {format(
        t(
          'atem.audio.welcomeFooter',
          'For {name}. 24 standard sources × 8 output buses; sources + outputs + mappings can be edited freely afterwards.',
        ),
        { name: equipmentName || t('atem.audio.currentDevice', 'the current device') },
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
              '{label} show / hide — deselected entries drop from the filter, list and matrix.',
            ),
            { label },
          )}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onSetAll([])}
            className="rounded bg-slate-800 px-2 py-0.5 text-cp-xs hover:bg-slate-700"
          >
            {t('atem.audio.picker.showAll', 'Show all')}
          </button>
          <button
            type="button"
            onClick={() => onSetAll(items.map((i) => i.id))}
            className="rounded bg-slate-800 px-2 py-0.5 text-cp-xs hover:bg-slate-700"
            disabled={allExcluded}
          >
            {t('atem.audio.picker.hideAll', 'Hide all')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-800 px-2 py-0.5 text-cp-xs hover:bg-slate-700"
          >
            {t('common.close', 'Close')}
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
                className={`mb-0.5 rounded px-2 py-0.5 text-left text-cp-xs font-semibold ${
                  allHidden
                    ? 'bg-slate-800 text-slate-500'
                    : someHidden
                      ? 'bg-amber-900/40 text-amber-200'
                      : 'bg-sky-900/40 text-sky-200'
                }`}
                title={format(t('atem.audio.groupToggleTitle', '{key} — toggle whole group on/off'), { key })}
              >
                <Icon icon={allHidden ? Square : someHidden ? SquareMinus : SquareCheck} size="xs" className="mr-1 inline-block align-text-bottom" />{key}
              </button>
              {members.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-1 pl-2 text-cp-xs text-slate-300"
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
      !(await confirmDialog(t('atem.audio.resetAllConfirm', 'Reset all routings to "No Audio"?'), {
        destructive: true,
        okLabel: t('common.reset', 'Reset'),
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
          placeholder={t('atem.audio.filterSourcesPlaceholder', 'Filter sources…')}
          title={t('atem.audio.filterSourcesTitle', 'Substring filter for audio sources (rows)')}
          aria-label={t('atem.audio.filterSourcesAria', 'Filter sources')}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-cp-xs"
        />
        <input
          type="text"
          value={filterOutputs}
          onChange={(e) => setFilterOutputs(e.target.value)}
          placeholder={t('atem.audio.filterOutputsPlaceholder', 'Filter outputs…')}
          title={t('atem.audio.filterOutputsTitle', 'Substring filter for audio outputs (columns)')}
          aria-label={t('atem.audio.filterOutputsAria', 'Filter outputs')}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-cp-xs"
        />
        <button
          type="button"
          onClick={() => setShowSourcePicker((v) => !v)}
          title={t('atem.audio.sourcesCheckTitle', 'Check sources individually (e.g. MADI, Mic, Tape …)')}
          className={`rounded border px-3 py-1 ${
            excludedSourceIds.size > 0
              ? 'border-sky-600 bg-sky-900/40 text-sky-200'
              : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
        >
          {t('atem.audio.sourcePicker', 'Source picker')}
          {excludedSourceIds.size > 0 && (
            <span className="ml-1 text-cp-xs text-sky-300">
              ({excludedSourceIds.size} {t('atem.audio.hidden', 'hidden')})
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setShowOutputPicker((v) => !v)}
          title={t('atem.audio.outputsCheckTitle', 'Check outputs individually (e.g. skip Out 5/6, 7/8)')}
          className={`rounded border px-3 py-1 ${
            excludedOutputIds.size > 0
              ? 'border-sky-600 bg-sky-900/40 text-sky-200'
              : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
        >
          {t('atem.audio.outputPicker', 'Output picker')}
          {excludedOutputIds.size > 0 && (
            <span className="ml-1 text-cp-xs text-sky-300">
              ({excludedOutputIds.size} {t('atem.audio.hidden', 'hidden')})
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={clearAllOutputs}
          className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
        >
          {t('atem.audio.resetAllBtn', 'Reset all routings')}
        </button>
        <span className="ml-2 text-slate-500">
          {visibleSources.length} × {visibleOutputs.length} {t('atem.audio.visible', 'visible')}
          {cellCount.toLocaleString() !== ''
            ? ` · ${cellCount.toLocaleString()} ${t('atem.audio.crosspoints', 'crosspoints')}`
            : ''}
        </span>
      </div>

      {showSourcePicker && (
        <ChannelPicker
          label={t('atem.audio.sourcesLabel', 'Sources')}
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
                '{count} visible crosspoints may slow down the rendering. Narrow down via the source/output pickers or render anyway — the warning then stays off for this session.',
              ),
              { count: cellCount.toLocaleString() },
            )}
          </p>
          <button
            type="button"
            onClick={() => setRenderAnyway(true)}
            className="mt-3 rounded bg-amber-700 px-3 py-1 text-cp-xs text-amber-50 hover:bg-amber-600"
          >
            {t('atem.audio.renderAnyway', 'Render anyway')}
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
                      title={format(t('atem.audio.sourceRowTitle', '{name} (id {id}) — {count} output(s)'), { name: s.name, id: s.id, count: routedToCount })}
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
                              ? format(t('atem.audio.cellRoutedTitle', '{src} → {out} — click to remove'), { src: s.name, out: o.name })
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

