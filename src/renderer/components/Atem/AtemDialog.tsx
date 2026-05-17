import { useEffect, useMemo, useState } from 'react'
import { cablePlannerApi, type AtemStateSummary } from '../../lib/bridge'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'

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
  const equipment = useProjectStore((state) =>
    preselectedDeviceId ? state.project.equipment.find((e) => e.id === preselectedDeviceId) : undefined,
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
  const projectInputNames = useMemo(() => {
    if (!equipment) return [] as string[]
    return equipment.inputs.map((p) => p.name)
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
      if (result.summary) {
        const next: Record<number, { long: string; short: string }> = {}
        result.summary.inputs.forEach((input, index) => {
          const suggestion = projectInputNames[index]
          next[input.inputId] = {
            long: suggestion ? suggestion.slice(0, 20) : input.longName,
            short: suggestion ? suggestion.replace(/\s+/g, '').slice(0, 4).toUpperCase() : input.shortName,
          }
        })
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
      return {
        inputId: input.inputId,
        liveLong: input.longName,
        liveShort: input.shortName,
        newLong: draft.long,
        newShort: draft.short,
        changed: draft.long !== input.longName || draft.short !== input.shortName,
      }
    })
  }, [state, drafts])

  const dirtyCount = rows.filter((r) => r.changed).length

  const pushAll = async () => {
    setPushing(true)
    setError(null)
    try {
      const dirty = rows.filter((r) => r.changed)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded border border-sky-700 bg-slate-900 text-slate-100">
        <header className="flex items-center justify-between border-b border-slate-700 px-4 py-2">
          <h2 className="text-base font-semibold text-sky-300">ATEM Live Integration</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-700 px-2 py-0.5 text-xs hover:bg-slate-600"
          >
            ✕ Schließen
          </button>
        </header>

        <div className="border-b border-slate-700 px-4 py-3">
          <div className="flex items-end gap-2">
            <label className="flex-1 text-xs">
              <span className="mb-1 block text-slate-300">ATEM IP-Adresse</span>
              <input
                value={ip}
                onChange={(event) => setIp(event.target.value)}
                placeholder="192.168.10.240"
                disabled={status === 'connected' || status === 'connecting'}
                className="w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-sm"
              />
            </label>
            {status !== 'connected' && (
              <button
                type="button"
                onClick={discover}
                disabled={discovering || status === 'connecting'}
                className="rounded bg-purple-700 px-3 py-2 text-sm hover:bg-purple-600 disabled:opacity-50"
                title="ATEM-Switcher per mDNS (Bonjour) im lokalen Netzwerk suchen"
              >
                {discovering ? '🔍 Suche…' : '🔍 Suchen'}
              </button>
            )}
            {status !== 'connected' && (
              <button
                type="button"
                onClick={connect}
                disabled={status === 'connecting' || !ip.trim()}
                className="rounded bg-sky-700 px-3 py-2 text-sm hover:bg-sky-600 disabled:opacity-50"
              >
                {status === 'connecting' ? 'Verbinde…' : 'Verbinden'}
              </button>
            )}
            {status === 'connected' && (
              <button
                type="button"
                onClick={disconnect}
                className="rounded bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"
              >
                Trennen
              </button>
            )}
            {status === 'connected' && (
              <button
                type="button"
                onClick={openAtemMvLayout}
                className="rounded bg-emerald-700 px-3 py-2 text-sm hover:bg-emerald-600"
                title="Multiviewer-Layout live anzeigen"
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
                <div className="rounded border border-dashed border-slate-700 bg-slate-950/40 p-2 text-[11px] text-slate-500">
                  Kein ATEM-Switcher per mDNS im lokalen Netzwerk gefunden. (Manche
                  Modelle / Firewall-Setups blocken mDNS — dann IP manuell eingeben.)
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">
                    Gefunden ({discovered.length}) — Klick übernimmt die IP:
                  </div>
                  {discovered.map((dev) => (
                    <button
                      key={dev.ip}
                      type="button"
                      onClick={() => setIp(dev.ip)}
                      className="flex w-full items-center justify-between gap-2 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-left text-xs hover:border-purple-500 hover:bg-slate-900"
                    >
                      <span className="font-medium text-slate-100">
                        {dev.name}
                        {dev.model && (
                          <span className="ml-2 text-[10px] text-slate-400">
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
            <div className="mt-2 text-[11px] text-slate-400">
              {state.productIdentifier}
              {state.apiVersion ? ` · API ${state.apiVersion.major}.${state.apiVersion.minor}` : ''}
              {state.mixEffects ? ` · ${state.mixEffects} M/E` : ''}
              {state.auxiliaries ? ` · ${state.auxiliaries} AUX` : ''}
            </div>
          )}
          {error && (
            <div className="mt-2 rounded bg-red-900/50 p-2 text-xs text-red-100">{error}</div>
          )}
        </div>

        {status === 'connected' && state && (
          <div className="flex-1 overflow-auto px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Input-Namen ({rows.length})
              </h3>
              <button
                type="button"
                onClick={pushAll}
                disabled={pushing || dirtyCount === 0}
                className="rounded bg-emerald-700 px-3 py-1 text-xs hover:bg-emerald-600 disabled:opacity-50"
              >
                {pushing ? 'Sende…' : `${dirtyCount} Änderungen senden`}
              </button>
            </div>
            <table className="w-full table-fixed text-xs">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="w-12 py-1">ID</th>
                  <th className="w-1/3 py-1">Live (long / short)</th>
                  <th className="w-1/3 py-1">Neu Long (max 20)</th>
                  <th className="w-24 py-1">Neu Short (4)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.inputId}
                    className={`border-t border-slate-800 ${row.changed ? 'bg-amber-950/30' : ''}`}
                  >
                    <td className="py-1 font-mono text-slate-400">{row.inputId}</td>
                    <td className="py-1 text-slate-300">
                      <span className="font-mono">{row.liveLong}</span>{' '}
                      <span className="text-slate-500">({row.liveShort})</span>
                    </td>
                    <td className="py-1 pr-1">
                      <input
                        value={row.newLong}
                        maxLength={20}
                        onChange={(event) => setDraft(row.inputId, { long: event.target.value })}
                        className="w-full rounded border border-slate-700 bg-slate-950 p-1 font-mono"
                      />
                    </td>
                    <td className="py-1">
                      <input
                        value={row.newShort}
                        maxLength={4}
                        onChange={(event) =>
                          setDraft(row.inputId, { short: event.target.value.toUpperCase() })
                        }
                        className="w-full rounded border border-slate-700 bg-slate-950 p-1 font-mono uppercase"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-slate-500">
              Hinweis: Änderungen gehen direkt an den Switcher (RAM). Damit sie einen Reboot
              überleben, in der Blackmagic ATEM Software „Save Startup State" auslösen.
            </p>
          </div>
        )}

        <details className="border-t border-slate-700 px-4 py-2 text-[11px]">
          <summary className="cursor-pointer text-slate-400">Event-Log ({events.length})</summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-950 p-2 font-mono text-[10px] text-slate-300">
            {events.join('\n') || '(noch keine Events)'}
          </pre>
        </details>
      </div>
    </div>
  )
}
