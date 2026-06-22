import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { cablePlannerApi, type AtemStateSummary, type AtemInputSummary } from '../../lib/bridge'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { portDisplayLabel, shortenForAtem } from '../../lib/portLabel'
import { getEquipmentById } from '../../lib/equipmentSelectors'
import { ModalShell } from '../shared/ModalShell'
import { useTranslation, format } from '../../lib/i18n'

interface AtemDialogProps {
  onClose: () => void
  preselectedDeviceId?: string
}

interface RowDraft {
  inputId: number
  liveLong: string
  liveShort: string
  newLong: string
  newShort: string
  changed: boolean
  category: InputCategory
  /** Wenn true: read-only Zeile (Mediaplayer / Audio-Quelle / interne
   *  Quelle wie Black/Bars/Color). Beim Push wird sie uebersprungen. */
  locked: boolean
  /** Erklaerungs-Hint warum diese Zeile gesperrt ist (UI-Anzeige). */
  lockReason?: string
}

// #289 / #293 — ATEM-Source-Klassifikation. Jeder Eintrag in
// `state.inputs` ist eine Source-ID; Pre-Fill und Push muessen die nach
// Kategorie unterscheiden, sonst ueberschreiben wir die Werks-Labels
// von Mediaplayer / Talkback / interne Generatoren.
//
//  - video-input:  externer Video-Input (SDI/HDMI/Component/Composite/
//                  SVideo). Wird gegen equipment.inputs[i].name gemappt.
//  - audio-input:  externer Audio-Input (XLR/RCA/TSJack/TRSJack/MADI/
//                  AESEBU oder RJ45 mit Talkback-Hinweis). NICHT pre-
//                  fillen — ATEM hat eigene Default-Labels die der
//                  Anwender sehen will.
//  - mediaplayer:  MediaPlayerFill/Key. Hat dynamische Default-Labels
//                  basierend auf Clip-/Still-Namen — nicht ueberschreiben.
//  - me-output:    PGM/PVW (ME-Output). Wird gegen equipment.outputs[i]
//                  gemappt — falls vorhanden.
//  - aux:          AUX-Output. equipment.outputs[i].
//  - multiviewer:  MV-Output. equipment.outputs[i].
//  - internal:     Black/ColorBars/ColorGenerator/SuperSource/Mask.
//                  Default-Labels behalten.
type InputCategory =
  | 'video-input'
  | 'audio-input'
  | 'mediaplayer'
  | 'me-output'
  | 'aux'
  | 'multiviewer'
  | 'internal'

// ExternalPortType-Bitmaske (siehe bridge.ts).
const EXT_VIDEO_BITS = 1 /*SDI*/ | 2 /*HDMI*/ | 4 /*Component*/ | 8 /*Composite*/ | 16 /*SVideo*/
const EXT_AUDIO_BITS =
  32 /*XLR*/ | 64 /*AESEBU*/ | 128 /*RCA*/ | 512 /*TSJack*/ | 1024 /*MADI*/ | 2048 /*TRSJack*/
const EXT_RJ45 = 4096

// InternalPortType-Werte (siehe enums in atem-connection):
const INT_EXTERNAL = 0
const INT_MEDIAPLAYER_FILL = 4
const INT_MEDIAPLAYER_KEY = 5
const INT_ME_OUTPUT = 128
const INT_AUXILIARY = 129
const INT_MULTIVIEWER = 131

const classifyInput = (input: AtemInputSummary): InputCategory => {
  const ipt = input.portType
  if (ipt === INT_ME_OUTPUT) return 'me-output'
  if (ipt === INT_AUXILIARY) return 'aux'
  if (ipt === INT_MULTIVIEWER) return 'multiviewer'
  if (ipt === INT_MEDIAPLAYER_FILL || ipt === INT_MEDIAPLAYER_KEY) return 'mediaplayer'
  if (ipt !== INT_EXTERNAL) return 'internal'
  // External — externalPortType entscheidet ob Video oder Audio.
  const ept = input.externalPortType ?? 0
  if ((ept & EXT_AUDIO_BITS) !== 0 && (ept & EXT_VIDEO_BITS) === 0) return 'audio-input'
  // RJ45 mit Talkback-Hinweis im Label = Audio. ATEM Constellation
  // benennt diese standardmaessig "Talkback" / "TB1" / "TLBK".
  if (ept === EXT_RJ45 && /talkback|talk back|^tlbk|^tb\s*\d/i.test(`${input.longName} ${input.shortName}`)) {
    return 'audio-input'
  }
  return 'video-input'
}

/**
 * ATEM live integration. Uses the `atem-connection` UDP protocol
 * implementation in the main process (matching the protocol documented by
 * peschuster/LibAtem and the SuperFlyTV reverse-engineering work) to talk
 * to a real ATEM switcher.
 *
 * MVP scope: connect by IP, list inputs, push the project's port labels as
 * the long/short input names. Push to switcher writes to RAM only — saving to
 * the ATEM's internal startup state is the user's responsibility (Switcher
 * Software → Save Startup State).
 */
export const AtemDialog = ({ onClose, preselectedDeviceId }: AtemDialogProps) => {
  const t = useTranslation()
  const equipment = useProjectStore((state) =>
    preselectedDeviceId ? getEquipmentById(state.project.equipment, preselectedDeviceId) : undefined,
  )
  const openAtemMvLayout = useUiStore((state) => state.openAtemMvLayout)

  const [ip, setIp] = useState(equipment?.ipAddress ?? '')
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  // v7.9.53 — mDNS Auto-Discovery State
  const [discovering, setDiscovering] = useState(false)
  const [discovered, setDiscovered] = useState<
    Array<{ name: string; ip: string; port: number; model?: string }>
  >([])
  const [discoveryDone, setDiscoveryDone] = useState(false)
  const [state, setState] = useState<AtemStateSummary | null>(null)
  const [events, setEvents] = useState<string[]>([])
  const [drafts, setDrafts] = useState<Record<number, { long: string; short: string }>>({})
  const [pushing, setPushing] = useState(false)

  // Default-name suggestions derived from the project's port names.
  // #290 — equipment.outputs werden gegen ME-Outputs / AUX / MV gemappt.
  // #286 — contentLabel ("PGM", "Cam1") gewinnt gegen port.name. Der
  //  Long-/Short-Name auf dem ATEM ist eh nur 20/4 Zeichen — die kompakte
  //  inhaltliche Bezeichnung passt da besser rein als der ausgeschriebene
  //  Canvas-Port-Name ("1 SDI 3G PGM (1080p50/60)" → "PGM").
  const projectInputNames = useMemo(() => {
    if (!equipment) return [] as string[]
    return equipment.inputs.map((p) => portDisplayLabel(p))
  }, [equipment])
  const projectOutputNames = useMemo(() => {
    if (!equipment) return [] as string[]
    return equipment.outputs.map((p) => portDisplayLabel(p))
  }, [equipment])

  useEffect(() => {
    const unsubscribe = cablePlannerApi.atem.onEvent((line) =>
      setEvents((prev) => [...prev.slice(-99), line]),
    )
    void cablePlannerApi.atem.getEvents().then(setEvents)
    void cablePlannerApi.atem.getStatus().then((s) => {
      if (s.connected && s.ip) {
        setIp(s.ip)
        setStatus('connected')
        void cablePlannerApi.atem.getState().then(setState)
      }
    })
    return () => unsubscribe()
  }, [])

  // v7.9.53 — mDNS-Discovery: scannt 3s lang nach "_blackmagic._tcp"
  // Services im lokalen Netz. Ergebnis erscheint als Klick-Liste die
  // den IP-Input auto-füllt.
  const discover = async () => {
    setDiscovering(true)
    setDiscoveryDone(false)
    setDiscovered([])
    try {
      const list = await cablePlannerApi.atem.discover({ timeoutMs: 3000 })
      setDiscovered(list)
    } catch {
      setDiscovered([])
    } finally {
      setDiscovering(false)
      setDiscoveryDone(true)
    }
  }

  const connect = async () => {
    setStatus('connecting')
    setError(null)
    try {
      const result = await cablePlannerApi.atem.connect(ip.trim())
      setStatus('connected')
      setState(result.summary)
      // Pre-fill drafts from live names so the user only edits what they want to change.
      // Issue #248 comment: ATEM zeigt Labels nur sehr kurz an. Die meisten
      // Infos aus dem Canvas-Port-Namen (Stecker, Signal-Standard, Format-
      // Suffix, fuehrende Port-Nummer) sind in der ATEM-UI unnoetig. Wir
      // strippen die hier aggressiv damit der Long-Name (20 chars) nicht
      // schon nach 3 Worten abgehackt ist.
      //
      // #289 — Off-by-One Fix: vorher haben wir blind nach state.inputs-
      // Index gemappt, sodass Black (inputId=0) den Canvas-In1-Namen
      // bekommen hat und SDI 1 (inputId=1) den von Canvas-In2 usw. — alles
      // um 1 verschoben. Jetzt filtern wir nach Kategorie und mappen
      // gefiltert-Index → Canvas-Position.
      //
      // #293 — Mediaplayer-/Audio-Quellen-Fix: gefiltert wird so dass
      // Mediaplayer (z.B. "MP1 Stinger") und Audio-Inputs (XLR, RCA,
      // RJ45-Talkback) NICHT mit Canvas-Port-Namen ueberschrieben werden.
      if (result.summary) {
        const next: Record<number, { long: string; short: string }> = {}
        const videoInputs = result.summary.inputs.filter((i) => classifyInput(i) === 'video-input')
        const outputSources = result.summary.inputs.filter((i) => {
          const c = classifyInput(i)
          return c === 'me-output' || c === 'aux' || c === 'multiviewer'
        })
        const fillFrom = (
          source: AtemInputSummary,
          rawName: string | undefined,
        ) => {
          const cleaned = rawName ? shortenForAtem(rawName) : ''
          next[source.inputId] = {
            long: cleaned ? cleaned.slice(0, 20) : source.longName,
            short: cleaned
              ? cleaned.replace(/\s+/g, '').slice(0, 4).toUpperCase()
              : source.shortName,
          }
        }
        videoInputs.forEach((input, idx) => fillFrom(input, projectInputNames[idx]))
        outputSources.forEach((output, idx) => fillFrom(output, projectOutputNames[idx]))
        setDrafts(next)
      }
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const disconnect = async () => {
    await cablePlannerApi.atem.disconnect()
    setStatus('idle')
    setState(null)
  }

  const rows: RowDraft[] = useMemo(() => {
    if (!state) return []
    return state.inputs.map((input) => {
      const draft = drafts[input.inputId] ?? { long: input.longName, short: input.shortName }
      const category = classifyInput(input)
      // #293 — Mediaplayer + Audio-Inputs + interne Generatoren sind
      // gegen Bulk-Pre-Fill geschuetzt. User kann sie nicht versehentlich
      // (z.B. "rj45 talkback" → "Out 1") umbenennen.
      const locked =
        category === 'mediaplayer' ||
        category === 'audio-input' ||
        category === 'internal'
      const lockReason =
        category === 'mediaplayer'
          ? t('atem.dialog.lockReason.mediaplayer', 'Mediaplayer-Slot — Default-Label vom ATEM (zeigt Clip-/Still-Name)')
          : category === 'audio-input'
            ? t('atem.dialog.lockReason.audioInput', 'Audio-Input — wird nicht aus Canvas-Port-Namen ueberschrieben')
            : category === 'internal'
              ? t('atem.dialog.lockReason.internal', 'Interne Quelle (Black/Bars/Color/SuperSource) — Default-Label behalten')
              : undefined
      return {
        inputId: input.inputId,
        liveLong: input.longName,
        liveShort: input.shortName,
        newLong: draft.long,
        newShort: draft.short,
        changed: draft.long !== input.longName || draft.short !== input.shortName,
        category,
        locked,
        lockReason,
      }
    })
  }, [state, drafts, t])

  const dirtyCount = rows.filter((r) => r.changed && !r.locked).length

  const pushAll = async () => {
    setPushing(true)
    setError(null)
    try {
      // #293 — locked rows nie pushen, auch wenn sie versehentlich
      // einen draft haben (z.B. bei Re-Connect kommt anderer ATEM mit
      // anderem Port-Mapping rein).
      const dirty = rows.filter((r) => r.changed && !r.locked)
      const result = await cablePlannerApi.atem.bulkSetInputNames({
        entries: dirty.map((r) => ({
          inputId: r.inputId,
          longName: r.newLong,
          shortName: r.newShort,
        })),
      })
      const fresh = await cablePlannerApi.atem.getState()
      setState(fresh)
      setEvents((prev) => [...prev, `Pushed ${result.count} input names.`])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPushing(false)
    }
  }

  const setDraft = (inputId: number, patch: Partial<{ long: string; short: string }>) =>
    setDrafts((prev) => ({
      ...prev,
      [inputId]: {
        long: patch.long ?? prev[inputId]?.long ?? '',
        short: patch.short ?? prev[inputId]?.short ?? '',
      },
    }))

  return (
    <ModalShell
      open
      onClose={onClose}
      title={t('atem.dialog.title', 'ATEM Live Integration')}
      maxWidth="3xl"
      scrollBody={false}
    >
      <div className="flex max-h-[80vh] flex-col text-cp-text">
        <div className="border-b border-cp-border px-4 py-3">
          <div className="flex items-end gap-2">
            <label className="flex-1 text-cp-xs">
              <span className="mb-1 block text-cp-text-secondary">{t('atem.dialog.ipLabel', 'ATEM IP-Adresse')}</span>
              <input
                value={ip}
                onChange={(event) => setIp(event.target.value)}
                placeholder="192.168.10.240"
                disabled={status === 'connected' || status === 'connecting'}
                className="w-full rounded border border-cp-border bg-cp-surface-3 p-2 font-mono text-cp-base"
              />
            </label>
            {status !== 'connected' && (
              <button
                type="button"
                onClick={discover}
                disabled={discovering || status === 'connecting'}
                className="rounded bg-purple-700 px-3 py-2 text-cp-base hover:bg-purple-600 disabled:opacity-50"
                title={t('atem.dialog.discoverTitle', 'ATEM-Switcher per mDNS (Bonjour) im lokalen Netzwerk suchen')}
              >
                <Icon icon={Search} size="xs" className="mr-1 inline-block align-text-bottom" />
                {discovering ? t('atem.dialog.searching', 'Suche…') : t('atem.dialog.search', 'Suchen')}
              </button>
            )}
            {status !== 'connected' && (
              <button
                type="button"
                onClick={connect}
                disabled={status === 'connecting' || !ip.trim()}
                className="rounded bg-sky-700 px-3 py-2 text-cp-base hover:bg-sky-600 disabled:opacity-50"
              >
                {status === 'connecting' ? t('atem.dialog.connecting', 'Verbinde…') : t('atem.dialog.connect', 'Verbinden')}
              </button>
            )}
            {status === 'connected' && (
              <button
                type="button"
                onClick={disconnect}
                className="rounded bg-cp-surface-4 px-3 py-2 text-cp-base hover:bg-cp-surface-5"
              >
                {t('atem.dialog.disconnect', 'Trennen')}
              </button>
            )}
            {status === 'connected' && (
              <button
                type="button"
                onClick={openAtemMvLayout}
                className="rounded bg-emerald-700 px-3 py-2 text-cp-base hover:bg-emerald-600"
                title={t('atem.dialog.mvLive', 'Multiviewer-Layout live anzeigen')}
              >
                MV Layout →
              </button>
            )}
          </div>
          {/* v7.9.53 — Discovery-Result-Liste. Erscheint nach dem ersten
              "Suchen"-Klick. Klick auf eine Zeile füllt den IP-Input. */}
          {discoveryDone && status !== 'connected' && (
            <div className="mt-2">
              {discovered.length === 0 ? (
                <div className="rounded border border-dashed border-cp-border bg-cp-surface-3/40 p-2 text-[11px] text-cp-text-muted">
                  {t(
                    'atem.dialog.noneFound',
                    'Kein ATEM-Switcher per mDNS im lokalen Netzwerk gefunden. (Manche Modelle / Firewall-Setups blocken mDNS — dann IP manuell eingeben.)',
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-cp-text-muted">
                    {format(t('atem.dialog.foundCount', 'Gefunden ({n}) — Klick übernimmt die IP:'), {
                      n: discovered.length,
                    })}
                  </div>
                  {discovered.map((dev) => (
                    <button
                      key={dev.ip}
                      type="button"
                      onClick={() => setIp(dev.ip)}
                      className="flex w-full items-center justify-between gap-2 rounded border border-cp-border bg-cp-surface-3 px-2 py-1.5 text-left text-cp-xs hover:border-purple-500 hover:bg-cp-surface-1"
                    >
                      <span className="font-medium text-cp-text">
                        {dev.name}
                        {dev.model && (
                          <span className="ml-2 text-[10px] text-cp-text-muted">
                            ({dev.model})
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[11px] text-purple-300">{dev.ip}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {status === 'connected' && state && (
            <div className="mt-2 text-[11px] text-cp-text-muted">
              {state.productIdentifier}
              {state.apiVersion ? ` · API ${state.apiVersion.major}.${state.apiVersion.minor}` : ''}
              {state.mixEffects ? ` · ${state.mixEffects} M/E` : ''}
              {state.auxiliaries ? ` · ${state.auxiliaries} AUX` : ''}
            </div>
          )}
          {error && (
            <div className="mt-2 rounded bg-red-900/50 p-2 text-cp-xs text-red-100">{error}</div>
          )}
        </div>

        {status === 'connected' && state && (
          <div className="flex-1 overflow-auto px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-cp-xs font-semibold uppercase tracking-wide text-cp-text-secondary">
                {t('atem.dialog.inputNames', 'Input-Namen')} ({rows.length})
              </h3>
              <button
                type="button"
                onClick={pushAll}
                disabled={pushing || dirtyCount === 0}
                className="rounded bg-emerald-700 px-3 py-1 text-cp-xs hover:bg-emerald-600 disabled:opacity-50"
              >
                {pushing
                  ? t('atem.dialog.sending', 'Sende…')
                  : format(t('atem.dialog.sendChanges', '{n} Änderungen senden'), { n: dirtyCount })}
              </button>
            </div>
            <table className="w-full table-fixed text-cp-xs">
              <thead className="text-left text-cp-text-muted">
                <tr>
                  <th className="w-12 py-1">ID</th>
                  <th className="w-20 py-1">{t('atem.col.type', 'Typ')}</th>
                  <th className="w-1/4 py-1">{t('atem.col.live', 'Live (long / short)')}</th>
                  <th className="py-1">{t('atem.col.newLong', 'Neu Long (max 20)')}</th>
                  <th className="w-24 py-1">{t('atem.col.newShort', 'Neu Short (4)')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.inputId}
                    title={row.lockReason}
                    className={`border-t border-cp-border-muted ${
                      row.locked ? 'opacity-60' : row.changed ? 'bg-amber-950/30' : ''
                    }`}
                  >
                    <td className="py-1 font-mono text-cp-text-muted">{row.inputId}</td>
                    <td className="py-1 text-[10px] uppercase tracking-wide">
                      <span
                        className={
                          row.category === 'video-input'
                            ? 'text-emerald-300'
                            : row.category === 'me-output'
                              ? 'text-sky-300'
                              : row.category === 'aux'
                                ? 'text-cyan-300'
                                : row.category === 'multiviewer'
                                  ? 'text-violet-300'
                                  : row.category === 'audio-input'
                                    ? 'text-amber-400'
                                    : row.category === 'mediaplayer'
                                      ? 'text-pink-400'
                                      : 'text-cp-text-faint'
                        }
                      >
                        {row.category === 'video-input'
                          ? 'In'
                          : row.category === 'me-output'
                            ? 'ME-Out'
                            : row.category === 'aux'
                              ? 'AUX'
                              : row.category === 'multiviewer'
                                ? 'MV'
                                : row.category === 'audio-input'
                                  ? 'Audio'
                                  : row.category === 'mediaplayer'
                                    ? 'MP'
                                    : 'int.'}
                      </span>
                    </td>
                    <td className="py-1 text-cp-text-secondary">
                      <span className="font-mono">{row.liveLong}</span>{' '}
                      <span className="text-cp-text-faint">({row.liveShort})</span>
                    </td>
                    <td className="py-1 pr-1">
                      <input
                        value={row.newLong}
                        maxLength={20}
                        disabled={row.locked}
                        onChange={(event) => setDraft(row.inputId, { long: event.target.value })}
                        className="w-full rounded border border-cp-border bg-cp-surface-3 p-1 font-mono disabled:cursor-not-allowed disabled:bg-cp-surface-1 disabled:text-cp-text-faint"
                      />
                    </td>
                    <td className="py-1">
                      <input
                        value={row.newShort}
                        maxLength={4}
                        disabled={row.locked}
                        onChange={(event) =>
                          setDraft(row.inputId, { short: event.target.value.toUpperCase() })
                        }
                        className="w-full rounded border border-cp-border bg-cp-surface-3 p-1 font-mono uppercase disabled:cursor-not-allowed disabled:bg-cp-surface-1 disabled:text-cp-text-faint"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-cp-text-muted">
              {t(
                'atem.dialog.changesNote',
                'Hinweis: Änderungen gehen direkt an den Switcher (RAM). Damit sie einen Reboot überleben, in der Blackmagic ATEM Software „Save Startup State" auslösen. Audio-Eingaenge (XLR/RJ45-Talkback), Mediaplayer und interne Quellen sind gesperrt — der ATEM verwaltet die selbst.',
              )}
            </p>
          </div>
        )}

        <details className="border-t border-cp-border px-4 py-2 text-[11px]">
          <summary className="cursor-pointer text-cp-text-muted">{t('atem.eventLog', 'Event-Log')} ({events.length})</summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-cp-surface-3 p-2 font-mono text-[10px] text-cp-text-secondary">
            {events.join('\n') || t('atem.dialog.noEvents', '(noch keine Events)')}
          </pre>
        </details>
      </div>
    </ModalShell>
  )
}
