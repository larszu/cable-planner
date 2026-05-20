import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { guessVideohubPresetKey } from '../../lib/deviceKind'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import {
  buildVideohubLabelTxt,
  buildVideohubRoutingDump,
  buildVideohubRoutingCommand,
  buildVideohubInputLabelsCommand,
  buildVideohubOutputLabelsCommand,
  videohubPresets,
} from '../../lib/exportVideohub'
import { VideohubRoutingMatrix } from './VideohubRoutingMatrix'
import { cablePlannerApi, hasDesktopBridge, type VideohubState } from '../../lib/bridge'

interface Props {
  onClose: () => void
  preselectedDeviceId?: string
  initialShowMatrix?: boolean
}

type Format = 'labels' | 'routing'
type SendStatus = 'idle' | 'sending' | 'ok' | 'error'

const buildDefaultRouting = (totalIn: number, totalOut: number): Record<number, number> => {
  const r: Record<number, number> = {}
  for (let i = 0; i < totalOut; i++) r[i] = i < totalIn ? i : 0
  return r
}

const downloadTextFile = (filename: string, content: string) =>
  downloadBlob(filename, content, 'text/plain;charset=utf-8')

export const VideohubExportDialog = ({ onClose, preselectedDeviceId, initialShowMatrix }: Props) => {
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  const [deviceId, setDeviceId] = useState<string>(() => {
    if (preselectedDeviceId && equipment.some((e) => e.id === preselectedDeviceId)) {
      return preselectedDeviceId
    }
    // Default to the first device that looks like a Videohub
    const vh = equipment.find((e) => /videohub|crosspoint|crossbar|router/i.test(e.name))
    return vh?.id ?? equipment[0]?.id ?? ''
  })
  const [format, setFormat] = useState<Format>('routing')
  const initialDevice = equipment.find((e) => e.id === deviceId)
  const [presetKey, setPresetKey] = useState<string>(() =>
    initialDevice ? guessVideohubPresetKey(initialDevice) : 'smart-40x40-12g',
  )
  const [friendlyName, setFriendlyName] = useState<string>('')
  // v7.9.128 — Default: Matrix offen. Vorher war's default zu — User
  // musste extra klicken, deshalb hat er die Salvos/Activity-Log-
  // Sektionen die unter dem Matrix-Toggle haengen nicht gesehen.
  const [showMatrix, setShowMatrix] = useState(initialShowMatrix ?? true)
  const [routing, setRouting] = useState<Record<number, number>>(() => {
    const key = initialDevice ? guessVideohubPresetKey(initialDevice) : 'smart-40x40-12g'
    const p = videohubPresets.find((x) => x.key === key) ?? videohubPresets[0]
    return buildDefaultRouting(p.inputs, p.outputs)
  })

  // TCP send state
  const [vhHost, setVhHost] = useState('192.168.1.1')
  const [vhPort, setVhPort] = useState('9990')
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle')
  const [sendMessage, setSendMessage] = useState('')

  // v7.9.128 — VideoHubSim-inspired UI-Features:
  //
  // 1) Activity-Log: jede Sende-Aktion (Routing-Push, Salvo-Apply,
  //    Verbindungs-Versuch) wird zeit-gestempelt protokolliert.
  //    State only — wird nicht persistiert, frisch pro Dialog-Open.
  type LogEntry = { ts: number; text: string; ok: boolean }
  const [activityLog, setActivityLog] = useState<LogEntry[]>([])
  const logEvent = (text: string, ok = true) =>
    setActivityLog((prev) => [{ ts: Date.now(), text, ok }, ...prev].slice(0, 50))

  // 2) Connection-History: zuletzt benutzte IP/Port-Kombinationen.
  //    LocalStorage, max 8 Eintraege, frischeste oben.
  type ConnEntry = { host: string; port: string; lastUsed: number }
  const CONN_HISTORY_KEY = 'cable-planner.videohub.connections'
  const [connHistory, setConnHistory] = useState<ConnEntry[]>(() => {
    try {
      const raw = localStorage.getItem(CONN_HISTORY_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as ConnEntry[]
      if (!Array.isArray(parsed)) return []
      return parsed.slice(0, 8)
    } catch {
      return []
    }
  })
  const persistConnHistory = (list: ConnEntry[]) => {
    try {
      localStorage.setItem(CONN_HISTORY_KEY, JSON.stringify(list.slice(0, 8)))
    } catch {
      /* ignore quota */
    }
  }
  const recordConnection = (host: string, port: string) => {
    setConnHistory((prev) => {
      const filtered = prev.filter((c) => !(c.host === host && c.port === port))
      const next = [{ host, port, lastUsed: Date.now() }, ...filtered].slice(0, 8)
      persistConnHistory(next)
      return next
    })
  }

  // 3) Salvos: benannte Routing-Snapshots zum spaeteren Wiederherstellen.
  //    Pro Device gespeichert (key: deviceId), in localStorage.
  type Salvo = { id: string; name: string; routing: Record<number, number>; createdAt: number }
  const salvoKey = `cable-planner.videohub.salvos.${deviceId || '_'}`
  const [salvos, setSalvos] = useState<Salvo[]>([])
  useEffect(() => {
    try {
      const raw = localStorage.getItem(salvoKey)
      const parsed = raw ? (JSON.parse(raw) as Salvo[]) : []
      setSalvos(Array.isArray(parsed) ? parsed : [])
    } catch {
      setSalvos([])
    }
  }, [salvoKey])
  const persistSalvos = (list: Salvo[]) => {
    try {
      localStorage.setItem(salvoKey, JSON.stringify(list))
    } catch {
      /* ignore quota */
    }
  }
  const saveSalvo = () => {
    const name = window.prompt('Salvo-Name (= Routing-Snapshot speichern):')?.trim()
    if (!name) return
    const next: Salvo[] = [
      { id: crypto.randomUUID(), name, routing: { ...routing }, createdAt: Date.now() },
      ...salvos.filter((s) => s.name !== name),
    ]
    setSalvos(next)
    persistSalvos(next)
    logEvent(`Salvo gespeichert: "${name}" (${Object.keys(routing).length} Routen)`)
  }
  const recallSalvo = (s: Salvo) => {
    setRouting({ ...s.routing })
    logEvent(`Salvo geladen: "${s.name}"`)
  }
  const deleteSalvo = (id: string) => {
    const next = salvos.filter((s) => s.id !== id)
    setSalvos(next)
    persistSalvos(next)
  }

  // v7.9.128 — Live-State vom Hub (Labels + Routing + Locks). Wird per
  // "Status laden"-Button gefuellt. Wenn vorhanden, gewinnen die echten
  // Hub-Labels gegenueber den Canvas-Defaults.
  const [hubState, setHubState] = useState<VideohubState | null>(null)
  const [readingState, setReadingState] = useState(false)

  const handleReadState = async () => {
    if (!device) return
    const port = parseInt(vhPort, 10)
    if (!vhHost.trim() || isNaN(port)) {
      logEvent('Status-Read abgebrochen: ungueltige IP/Port', false)
      return
    }
    setReadingState(true)
    logEvent(`Status-Read von ${vhHost.trim()}:${port} …`)
    try {
      const result = await cablePlannerApi.videohub.readState({
        host: vhHost.trim(),
        port,
      })
      if (result.ok && result.state) {
        setHubState(result.state)
        // Aktuelles Routing vom Hub uebernehmen
        if (Object.keys(result.state.routing).length > 0) {
          setRouting({ ...result.state.routing })
        }
        const labels = Object.keys(result.state.inputLabels).length
        const locks = Object.values(result.state.outputLocks).filter(
          (v) => v !== 'unlocked',
        ).length
        logEvent(
          `Status geladen: ${result.state.modelName ?? 'Unbekannt'} · ` +
            `${labels} Labels · ${locks} Locks · Routing ${Object.keys(result.state.routing).length}`,
        )
        recordConnection(vhHost.trim(), String(port))
      } else {
        logEvent(`Status-Read Fehler: ${result.message}`, false)
      }
    } catch (e) {
      logEvent(
        `Exception bei Status-Read: ${e instanceof Error ? e.message : String(e)}`,
        false,
      )
    } finally {
      setReadingState(false)
    }
  }

  const device = equipment.find((e) => e.id === deviceId)
  const preset = videohubPresets.find((p) => p.key === presetKey) ?? videohubPresets[0]

  // v7.9.119 / Issue #237 — XP Smart Routing.
  // Analysiert die Canvas-Kabel des selektierten Videohub-Devices:
  //   inputConn[i]  → was haengt am Input i (Source-Device + Port)
  //   outputConn[i] → was haengt am Output i (Destination-Device + Port)
  // Wird in den Matrix-Labels angezeigt damit der User sieht 'aha
  // Output 12 versorgt Monitor Buhne' beim Routing setzen.
  const connections = useMemo(() => {
    const inputConn = new Map<number, { sourceName: string; portName: string }>()
    const outputConn = new Map<number, { destName: string; portName: string }>()
    if (!device) return { inputConn, outputConn }
    for (const c of cables) {
      // Kabel endet AN diesem Videohub-Input
      if (c.toEquipmentId === device.id) {
        const idx = device.inputs.findIndex((p) => p.id === c.toPortId)
        if (idx >= 0) {
          const sourceEq = equipment.find((e) => e.id === c.fromEquipmentId)
          const sourcePort = sourceEq?.outputs.find((p) => p.id === c.fromPortId)
          inputConn.set(idx, {
            sourceName: sourceEq?.name ?? '?',
            portName: sourcePort?.name ?? '?',
          })
        }
      }
      // Kabel startet AN diesem Videohub-Output
      if (c.fromEquipmentId === device.id) {
        const idx = device.outputs.findIndex((p) => p.id === c.fromPortId)
        if (idx >= 0) {
          const destEq = equipment.find((e) => e.id === c.toEquipmentId)
          const destPort = destEq?.inputs.find((p) => p.id === c.toPortId)
          outputConn.set(idx, {
            destName: destEq?.name ?? '?',
            portName: destPort?.name ?? '?',
          })
        }
      }
    }
    return { inputConn, outputConn }
  }, [device, cables, equipment])

  /** v7.9.119 / Issue #237 — Erzeugt einen Routing-Vorschlag basierend
   *  auf den Canvas-Verbindungen. Heuristik:
   *  1. Fuer jeden Output mit angeschlossener Destination: suche einen
   *     Input dessen Source-Geraet einen Token (≥2 Zeichen) mit dem
   *     Destination-Geraet teilt. So matched z.B. 'Monitor Buhne'
   *     mit 'Cam Buhne Hauptseite' ueber das Token 'buhne'.
   *  2. Wenn kein Match: Diagonal (Output N → Input N % totalInputs).
   *  Trifft nicht perfekt aber gibt einen sinnvollen Startpunkt — der
   *  User justiert per Matrix nach. */
  const tokensOf = (name: string): string[] =>
    name
      .toLowerCase()
      .split(/[^a-z0-9äöüß]+/)
      .filter((t) => t.length >= 2)
  const generateSmartRouting = () => {
    const next: Record<number, number> = {}
    for (let outIdx = 0; outIdx < preset.outputs; outIdx++) {
      let bestInput = outIdx < preset.inputs ? outIdx : 0
      const dest = connections.outputConn.get(outIdx)
      if (dest) {
        const destTokens = tokensOf(dest.destName + ' ' + dest.portName)
        let bestScore = 0
        for (const [inIdx, src] of connections.inputConn) {
          if (inIdx >= preset.inputs) continue
          const srcTokens = tokensOf(src.sourceName + ' ' + src.portName)
          const overlap = destTokens.filter((t) => srcTokens.includes(t)).length
          if (overlap > bestScore) {
            bestScore = overlap
            bestInput = inIdx
          }
        }
      }
      next[outIdx] = bestInput
    }
    setRouting(next)
  }

  const preview = useMemo(() => {
    if (!device) return ''
    if (format === 'labels') {
      return buildVideohubLabelTxt(device, {
        totalInputs: preset.inputs,
        totalOutputs: preset.outputs,
      })
    }
    return buildVideohubRoutingDump(device, {
      modelName: preset.model,
      friendlyName: friendlyName.trim() || device.name,
      totalInputs: preset.inputs,
      totalOutputs: preset.outputs,
      routing,
    })
  }, [device, format, preset, friendlyName, routing])

  const handleExport = () => {
    if (!device) return
    // v7.9.116 — Einheitlicher Stempel: YYYYMMDD_<device>_NNN_<preset>-<suffix>.txt
    const baseSuffix = format === 'labels' ? 'labels' : 'routing'
    const fileName = buildExportFilenameWithSuffix(
      device.name || 'Videohub',
      `${preset.key}_${baseSuffix}`,
      'txt',
    )
    downloadTextFile(fileName, preview)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(preview).catch(() => {})
  }

  // v7.9.128 — Effektive Labels die zum Hub gepusht werden. Reihenfolge:
  //   1. Hub-State-Label (wenn vom Hub geladen, dient aber NUR als Default-
  //      Anzeige; beim Send gewinnt Canvas damit der User nicht versehentlich
  //      Hub-Labels in Canvas zurueckschreibt nach Offline-Edit).
  //   2. Canvas-Port-Name + optionaler Source-Suffix (` ← SourceDevice`).
  // Wenn der User in der Matrix die Labels per Doppelklick aendern wuerde
  // (folgt in einem spaeteren Commit), wuerde der Override hier eingreifen.
  const computeEffectiveInputLabels = (): string[] =>
    Array.from({ length: preset.inputs }, (_, i) => {
      const portName = device?.inputs[i]?.name ?? `In ${i + 1}`
      const conn = connections.inputConn.get(i)
      return conn ? `${portName} <- ${conn.sourceName}` : portName
    })
  const computeEffectiveOutputLabels = (): string[] =>
    Array.from({ length: preset.outputs }, (_, i) => {
      const portName = device?.outputs[i]?.name ?? `Out ${i + 1}`
      const conn = connections.outputConn.get(i)
      return conn ? `${portName} -> ${conn.destName}` : portName
    })

  // Generischer TCP-Send mit beliebigem Block-Inhalt.
  const sendBlock = async (block: string, what: string): Promise<boolean> => {
    if (!device) return false
    const portNum = parseInt(vhPort, 10)
    if (!vhHost.trim() || isNaN(portNum)) {
      setSendStatus('error')
      setSendMessage('Bitte gueltige IP und Port angeben.')
      logEvent(`${what}: abgebrochen — ungueltige IP/Port`, false)
      return false
    }
    setSendStatus('sending')
    setSendMessage('')
    logEvent(`${what}: sende an ${vhHost.trim()}:${portNum} …`)
    try {
      const result = await cablePlannerApi.videohub.sendRouting({
        host: vhHost.trim(),
        port: portNum,
        block,
      })
      setSendStatus(result.ok ? 'ok' : 'error')
      setSendMessage(`${what}: ${result.message}`)
      logEvent(`${what}: ${result.ok ? 'OK' : 'Fehler'} — ${result.message}`, result.ok)
      if (result.ok) recordConnection(vhHost.trim(), String(portNum))
      return result.ok
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
      setSendStatus('error')
      setSendMessage(`${what}: ${msg}`)
      logEvent(`${what}: Exception — ${msg}`, false)
      return false
    }
  }

  const handleSendRouting = async () => {
    const block = buildVideohubRoutingCommand(routing, preset.outputs)
    await sendBlock(block, 'Routing-Push')
  }
  const handleSendLabels = async () => {
    const inLabels = computeEffectiveInputLabels()
    const outLabels = computeEffectiveOutputLabels()
    const block =
      buildVideohubInputLabelsCommand(inLabels, preset.inputs) +
      buildVideohubOutputLabelsCommand(outLabels, preset.outputs)
    await sendBlock(block, 'Labels-Push')
  }
  const handleSendBoth = async () => {
    const inLabels = computeEffectiveInputLabels()
    const outLabels = computeEffectiveOutputLabels()
    const block =
      buildVideohubInputLabelsCommand(inLabels, preset.inputs) +
      buildVideohubOutputLabelsCommand(outLabels, preset.outputs) +
      buildVideohubRoutingCommand(routing, preset.outputs)
    await sendBlock(block, 'Labels+Routing-Push')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded border border-slate-700 bg-slate-900 p-4 text-slate-100">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">🎚 Videohub konfigurieren · Labels + Routing</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
          <label className="block">
            Gerät auf dem Canvas
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            >
              <option value="">— Gerät wählen —</option>
              {equipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.inputs.length}/{e.outputs.length})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            Videohub-Modell
            <select
              value={presetKey}
              onChange={(e) => {
                const key = e.target.value
                setPresetKey(key)
                const p = videohubPresets.find((x) => x.key === key) ?? videohubPresets[0]
                setRouting(buildDefaultRouting(p.inputs, p.outputs))
              }}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            >
              {videohubPresets.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.model} ({p.inputs}×{p.outputs})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            Datei-Export-Format
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
              title="Bestimmt nur das Format der Vorschau-/Datei-Ausgabe unten. Der direkte TCP-Push (Labels/Routing-Buttons) ist davon unabhaengig."
            >
              <option value="routing">Voller Routing-Dump (Protokoll 2.5)</option>
              <option value="labels">Nur Labels (Input, n, Name)</option>
            </select>
          </label>

          <label className="block">
            Friendly Name {format === 'labels' && <span className="text-slate-500">(ignoriert)</span>}
            <input
              value={friendlyName}
              placeholder={device?.name ?? ''}
              onChange={(e) => setFriendlyName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            />
          </label>
        </div>

        {device && (device.inputs.length > preset.inputs || device.outputs.length > preset.outputs) && (
          <div className="mb-2 rounded bg-amber-950 p-2 text-xs text-amber-300">
            Warnung: Das Gerät hat mehr Ports ({device.inputs.length} IN / {device.outputs.length} OUT)
            als das gewählte Modell ({preset.inputs}×{preset.outputs}). Überschüssige Ports werden
            abgeschnitten.
          </div>
        )}

        {/* ── Routing Matrix ─────────────────────────────────────────── */}
        {/* v7.9.128 — Matrix immer sichtbar (kein format='routing'-Gating
            mehr). Funktioniert offline, beim TCP-Push wird Routing UND/ODER
            Labels separat verschickt — siehe unten. */}
        {true && (
          <div className="mb-3">
            <div className="mb-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMatrix((m) => !m)}
                className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
              >
                {showMatrix ? '▼' : '▶'} Routing-Matrix
              </button>
              <span className="text-xs text-slate-500">
                {preset.inputs} Eing. × {preset.outputs} Ausg.
              </span>
              {/* v7.9.119 / Issue #237 — Smart-Routing Vorschlag aus
                  Canvas-Verbindungen. Heuristik: pro Output das beste
                  Token-Match in den Input-Sources. Fallback: Diagonal. */}
              <button
                type="button"
                onClick={generateSmartRouting}
                className="ml-auto rounded bg-purple-700 px-2 py-1 text-xs text-purple-50 hover:bg-purple-600"
                title="Schlaegt ein Routing vor, basierend auf den Kabeln im Canvas. Best-Match per Geraete-Namens-Aehnlichkeit; Fallback Diagonal. Per Matrix anpassbar."
              >
                🪄 Smart-Routing
              </button>
              <button
                type="button"
                onClick={() => setRouting(buildDefaultRouting(preset.inputs, preset.outputs))}
                className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
                title="Diagonal-Routing zurücksetzen (Ausgang N → Eingang N)"
              >
                ↺ Reset
              </button>
            </div>
            {showMatrix && (
              <VideohubRoutingMatrix
                totalInputs={preset.inputs}
                totalOutputs={preset.outputs}
                inputLabels={Array.from({ length: preset.inputs }, (_, i) => {
                  // v7.9.128 — Hub-Labels gewinnen wenn vom Hub geladen
                  // ("Status laden"). Sonst Canvas-Port-Name + (wenn
                  // verkabelt) die Source aus dem Canvas (v7.9.119).
                  const hubLabel = hubState?.inputLabels?.[i]
                  if (hubLabel) return hubLabel
                  const portName = device?.inputs[i]?.name ?? `In ${i + 1}`
                  const conn = connections.inputConn.get(i)
                  return conn
                    ? `${portName} ← ${conn.sourceName}`
                    : portName
                })}
                outputLabels={Array.from({ length: preset.outputs }, (_, i) => {
                  const hubLabel = hubState?.outputLabels?.[i]
                  const lockState = hubState?.outputLocks?.[i]
                  const lockBadge =
                    lockState === 'locked-self'
                      ? ' 🔒'
                      : lockState === 'locked-other'
                        ? ' 🔒❗'
                        : ''
                  if (hubLabel) return `${hubLabel}${lockBadge}`
                  const portName = device?.outputs[i]?.name ?? `Out ${i + 1}`
                  const conn = connections.outputConn.get(i)
                  return conn
                    ? `${portName} → ${conn.destName}${lockBadge}`
                    : `${portName}${lockBadge}`
                })}
                routing={routing}
                onRoute={(output, input) => setRouting((r) => ({ ...r, [output]: input }))}
              />
            )}
          </div>
        )}

        {/* v7.9.128 — Salvos: benannte Routing-Snapshots speichern/laden.
            Inspiriert von VideoHubSim. Pro Device + Preset gespeichert in
            localStorage. Immer sichtbar (nicht mehr von showMatrix
            abhaengig). */}
        {true && (
          <div className="mb-3 rounded border border-cyan-700/40 bg-cyan-950/20 p-2">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wide text-cyan-300">
                Salvos (Routing-Snapshots)
              </div>
              <button
                type="button"
                onClick={saveSalvo}
                className="rounded bg-cyan-700 px-2 py-0.5 text-[11px] text-white hover:bg-cyan-600"
                title="Aktuelles Routing als benannten Snapshot speichern"
              >
                + Aktuelles Routing speichern
              </button>
            </div>
            {salvos.length === 0 ? (
              <div className="text-[11px] text-slate-500">
                Noch keine Salvos. Speichere die aktuelle Crosspoint-Verteilung
                und ruf sie spaeter mit einem Klick zurueck.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {salvos.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-1 rounded border border-cyan-800/60 bg-cyan-950/40 px-1.5 py-0.5 text-[11px]"
                  >
                    <button
                      type="button"
                      onClick={() => recallSalvo(s)}
                      className="text-cyan-100 hover:text-white"
                      title={`Salvo "${s.name}" laden (${Object.keys(s.routing).length} Routen, ${new Date(s.createdAt).toLocaleString('de-DE')})`}
                    >
                      📋 {s.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSalvo(s.id)}
                      className="text-slate-500 hover:text-red-400"
                      title="Salvo loeschen"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TCP Senden ─────────────────────────────────────────────── */}
        {/* v7.9.128 — Immer sichtbar. Separate Buttons fuer Labels-Push,
            Routing-Push, Beides. So baut der User offline alles auf und
            pusht das ans Hub wenn er im richtigen Netz ist — ggf. nur
            Teilmengen (z.B. nur Labels nach Re-Labelling, ohne Routing
            zu touchen). */}
        {true && (
          <div className="mb-3 rounded border border-slate-600 bg-slate-800/60 p-2">
            <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-400">
              An Videohub senden (TCP) — offline editieren, hier pushen wenn online
              {!hasDesktopBridge && (
                <span className="ml-2 text-amber-400">· nur in Desktop-App verfügbar</span>
              )}
            </div>
            <div className="flex items-end gap-2">
              <label className="block flex-1 text-xs">
                IP-Adresse
                <div className="mt-1 flex items-stretch gap-1">
                  <input
                    value={vhHost}
                    onChange={(e) => {
                      setVhHost(e.target.value)
                      setSendStatus('idle')
                    }}
                    placeholder="192.168.1.1"
                    className="flex-1 rounded border border-slate-700 bg-slate-950 p-1.5 font-mono text-xs"
                  />
                  {/* v7.9.128 — Connection-History: zuletzt benutzte
                      IP/Port-Kombinationen. Wird beim erfolgreichen Send
                      automatisch gepflegt. */}
                  {connHistory.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        const idx = parseInt(e.target.value, 10)
                        if (isNaN(idx)) return
                        const pick = connHistory[idx]
                        if (pick) {
                          setVhHost(pick.host)
                          setVhPort(pick.port)
                          setSendStatus('idle')
                        }
                      }}
                      title="Zuletzt benutzte Verbindungen"
                      className="w-10 rounded border border-slate-700 bg-slate-950 px-1 text-xs"
                    >
                      <option value="">▼</option>
                      {connHistory.map((c, i) => (
                        <option key={`${c.host}-${c.port}-${c.lastUsed}`} value={i}>
                          {c.host}:{c.port}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </label>
              <label className="block w-20 text-xs">
                Port
                <input
                  value={vhPort}
                  onChange={(e) => {
                    setVhPort(e.target.value)
                    setSendStatus('idle')
                  }}
                  placeholder="9990"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5 font-mono text-xs"
                />
              </label>
              <button
                type="button"
                onClick={() => { void handleReadState() }}
                disabled={!device || !hasDesktopBridge || readingState}
                title="Aktuellen Hub-Status holen: Labels + Routing + Locks. Routing wird in die Matrix uebernommen, Labels in den Spalten/Zeilen angezeigt."
                className="rounded bg-sky-700 px-3 py-1.5 text-xs hover:bg-sky-600 disabled:opacity-40"
              >
                {readingState ? '⏳ Laden…' : '⬇ Status laden'}
              </button>
            </div>
            {/* v7.9.128 — Drei getrennte Push-Buttons. User kann nur
                Labels oder nur Routing oder beides zusammen pushen. */}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { void handleSendLabels() }}
                disabled={!device || !hasDesktopBridge || sendStatus === 'sending'}
                title="Nur INPUT LABELS + OUTPUT LABELS senden. Routing bleibt am Hub unangetastet."
                className="rounded bg-purple-600 px-3 py-1.5 text-xs hover:bg-purple-500 disabled:opacity-40"
              >
                {sendStatus === 'sending' ? '⏳ …' : '⬆ Labels senden'}
              </button>
              <button
                type="button"
                onClick={() => { void handleSendRouting() }}
                disabled={!device || !hasDesktopBridge || sendStatus === 'sending'}
                title="Nur VIDEO OUTPUT ROUTING senden. Labels am Hub unveraendert."
                className="rounded bg-purple-600 px-3 py-1.5 text-xs hover:bg-purple-500 disabled:opacity-40"
              >
                {sendStatus === 'sending' ? '⏳ …' : '⬆ Routing senden'}
              </button>
              <button
                type="button"
                onClick={() => { void handleSendBoth() }}
                disabled={!device || !hasDesktopBridge || sendStatus === 'sending'}
                title="Labels + Routing in EINEM Push (drei Bloecke hintereinander)."
                className="rounded bg-purple-800 px-3 py-1.5 text-xs font-semibold hover:bg-purple-700 disabled:opacity-40"
              >
                {sendStatus === 'sending' ? '⏳ …' : '⬆ Labels + Routing senden'}
              </button>
            </div>
            {hubState && (
              <div className="mt-1.5 rounded border border-sky-700/40 bg-sky-950/30 p-1.5 text-[11px] text-sky-100">
                <span className="font-semibold">Hub-Status:</span>{' '}
                {hubState.modelName ?? 'Unbekannt'}{' '}
                {hubState.friendlyName && `("${hubState.friendlyName}")`}
                {hubState.videoInputs && hubState.videoOutputs && (
                  <span className="ml-1 text-sky-300">
                    {' '}· {hubState.videoInputs}×{hubState.videoOutputs}
                  </span>
                )}
                {(() => {
                  const lockedCount = Object.values(hubState.outputLocks).filter(
                    (v) => v !== 'unlocked',
                  ).length
                  return lockedCount > 0 ? (
                    <span className="ml-2 rounded bg-amber-900/40 px-1 py-0.5 text-amber-200">
                      🔒 {lockedCount} Output{lockedCount !== 1 ? 's' : ''} gesperrt
                    </span>
                  ) : null
                })()}
              </div>
            )}
            {sendStatus !== 'idle' && (
              <div
                className={`mt-1.5 rounded p-1.5 text-xs ${
                  sendStatus === 'ok'
                    ? 'bg-emerald-950 text-emerald-300'
                    : sendStatus === 'error'
                      ? 'bg-red-950 text-red-300'
                      : 'bg-slate-700 text-slate-300'
                }`}
              >
                {sendStatus === 'ok' && '✓ '}
                {sendStatus === 'error' && '✗ '}
                {sendMessage}
              </div>
            )}
            {/* v7.9.128 — Activity-Log (VideoHubSim-Style): rolling list
                der letzten 50 Events (Sende-Versuche, Salvos, Connection-
                Wechsel). Hilft beim Debuggen ("warum sagt Hub jetzt
                NAK"). Wird beim Dialog-Close vergessen. */}
            {activityLog.length > 0 && (
              <details className="mt-2 text-[11px]">
                <summary className="cursor-pointer text-slate-400 hover:text-slate-200">
                  Activity-Log ({activityLog.length})
                </summary>
                <div className="mt-1 max-h-32 space-y-0.5 overflow-auto rounded border border-slate-800 bg-slate-950/60 p-1.5 font-mono">
                  {activityLog.map((e, i) => (
                    <div
                      key={`${e.ts}-${i}`}
                      className={`whitespace-nowrap ${
                        e.ok ? 'text-slate-300' : 'text-red-300'
                      }`}
                    >
                      <span className="text-slate-500">
                        {new Date(e.ts).toLocaleTimeString('de-DE')}
                      </span>{' '}
                      {e.text}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        <div className="mb-2 text-xs text-slate-400">Vorschau</div>
        <textarea
          readOnly
          value={preview}
          className="flex-1 min-h-[150px] rounded border border-slate-700 bg-slate-950 p-2 font-mono text-[11px] text-slate-200"
        />

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!device}
            className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600 disabled:opacity-40"
          >
            In Zwischenablage
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!device}
            className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500 disabled:opacity-40"
          >
            Als Datei speichern
          </button>
        </div>
      </div>
    </div>
  )
}

