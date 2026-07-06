import { useEffect, useMemo, useRef, useState } from 'react'
import { X, SlidersHorizontal, List, Link, Wand2, ClipboardList, Search, Lock, Download, Loader2, Upload } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation } from '../../lib/i18n'
import { videohubPresetForDevice } from '../../lib/deviceKind'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { buildVideohubControlLabelsPdf } from '../../lib/exportVideohubLabels'
import {
  buildVideohubLabelTxt,
  buildVideohubRoutingDump,
  buildVideohubRoutingCommand,
  buildVideohubInputLabelsCommand,
  buildVideohubOutputLabelsCommand,
  parseVideohubLabelsTxt,
  videohubPresets,
} from '../../lib/exportVideohub'
import { pickTextFile } from '../../lib/pickFile'
import { infoDialog } from '../../lib/infoDialog'
import { VideohubRoutingMatrix } from './VideohubRoutingMatrix'
import { VideohubRoutingList } from './VideohubRoutingList'
import { cablePlannerApi, hasDesktopBridge, type VideohubState } from '../../lib/bridge'
import { portDisplayLabel } from '../../lib/portLabel'
import { isWithinDistance } from '../../lib/levenshtein'
import { promptDialog } from '../../lib/promptDialog'

// #237 — Stop-Words die im Smart-Routing nicht zum Score beitragen.
// "out"/"in" matched sonst auf praktisch jeden Port-Namen weil beide
// Seiten so heissen; "pgm"/"pvw" matchen ATEM-Outputs faelschlich
// gegen alles was den String enthaelt (z.B. "Program Monitor").
// Hardware-Standard-Token kommen weg weil die nichts ueber das
// _Routing_ aussagen — z.B. ein SDI-Cam-Output und ein SDI-Hub-Output
// haben "sdi" gemeinsam ohne dass sie verbunden sein muessen.
const SMART_ROUTING_STOP_WORDS = new Set<string>([
  'out',
  'output',
  'in',
  'input',
  'video',
  'audio',
  'signal',
  'port',
  'sdi',
  'hdmi',
  'bnc',
  'rj45',
  'xlr',
  'fiber',
  'pgm',
  'pvw',
  'program',
  'preview',
])

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
  const t = useTranslation()
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
  // Kein Raten: Geraetetyp-ID → expliziter Katalog-Preset-Key; sonst 'custom'
  // mit den echten BNC-Port-Zahlen des Geraets (siehe videohubPresetForDevice).
  const initialPreset = initialDevice
    ? videohubPresetForDevice(initialDevice)
    : { key: 'custom', customInputs: 16, customOutputs: 16 }
  const [presetKey, setPresetKey] = useState<string>(initialPreset.key)
  // #387 — Wenn presetKey === 'custom', steuern customInputs/customOutputs
  // die Routing-Matrix-Groesse statt den Preset-Werten.
  const [customInputs, setCustomInputs] = useState<number>(initialPreset.customInputs)
  const [customOutputs, setCustomOutputs] = useState<number>(initialPreset.customOutputs)
  const [friendlyName, setFriendlyName] = useState<string>('')
  // v7.9.128 — Default: Matrix offen. Vorher war's default zu — User
  // musste extra klicken, deshalb hat er die Salvos/Activity-Log-
  // Sektionen die unter dem Matrix-Toggle haengen nicht gesehen.
  const [showMatrix, setShowMatrix] = useState(initialShowMatrix ?? true)
  // v7.9.129 — Routing-View-Modus: Crosspoint-Matrix oder Listen-
  // Ansicht mit Dropdowns. User-Wunsch: "ergaenze zusaetzlich auch
  // diese dropdown moeglichkeit". Default = Matrix, persistiert in
  // sessionStorage damit Tab-Wechsel die Auswahl behaelt.
  // v7.9.131 — Achsen-Orientierung: wer ist links/oben?
  // 'outputs-rows' (Default): Outputs auf der vertikalen Achse, Inputs
  //                            auf der horizontalen — wie heute.
  // 'inputs-rows':            Inputs auf der vertikalen Achse, Outputs
  //                            auf der horizontalen.
  // Persistiert in sessionStorage; gilt fuer Matrix UND List.
  // ROUTING-DATEN bleiben gleich: routing[outputIdx] = inputIdx.
  // Wir aendern nur die visuelle Darstellung.
  const [axisOrientation, setAxisOrientation] = useState<'outputs-rows' | 'inputs-rows'>(() => {
    try {
      return sessionStorage.getItem('cable-planner.videohub.axis') === 'inputs-rows'
        ? 'inputs-rows'
        : 'outputs-rows'
    } catch {
      return 'outputs-rows'
    }
  })
  const toggleAxis = () => {
    const next = axisOrientation === 'outputs-rows' ? 'inputs-rows' : 'outputs-rows'
    setAxisOrientation(next)
    try {
      sessionStorage.setItem('cable-planner.videohub.axis', next)
    } catch {
      /* ignore */
    }
  }
  const [routingView, setRoutingView] = useState<'matrix' | 'list'>(() => {
    try {
      const raw = sessionStorage.getItem('cable-planner.videohub.routing-view')
      return raw === 'list' ? 'list' : 'matrix'
    } catch {
      return 'matrix'
    }
  })
  // v7.9.130 — Toggle "Verkabelung anzeigen". Wenn an (Default), wird
  // an jedes Input/Output-Label das angeschlossene Geraet aus den
  // Canvas-Kabeln angehaengt (z.B. "1 SDI In ← Sony PMW-F5").
  // Wenn aus, sieht der User nur die nackten Port-Namen — sinnvoll
  // wenn die Connection-Info schon redundant ist (Hub-Labels eh
  // gleich beschriftet) oder die Spalten zu voll werden.
  const [showConnections, setShowConnections] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('cable-planner.videohub.show-connections') !== 'off'
    } catch {
      return true
    }
  })
  const toggleShowConnections = () => {
    const next = !showConnections
    setShowConnections(next)
    try {
      sessionStorage.setItem(
        'cable-planner.videohub.show-connections',
        next ? 'on' : 'off',
      )
    } catch {
      /* ignore */
    }
  }
  // v7.9.130 — Zusatztoggle "Input-Label" (nur wirksam wenn Verkabelung
  // an). Wenn an: zeigt zusaetzlich den Port-Namen am angeschlossenen
  // Geraet, also "PortName ← DeviceName · DeviceInPort" statt nur
  // "PortName ← DeviceName". Hilft bei Geraeten mit vielen
  // gleichartigen Ports (z.B. ATEM-Outputs) das richtige zu finden.
  const [showConnectionPorts, setShowConnectionPorts] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('cable-planner.videohub.show-connection-ports') === 'on'
    } catch {
      return false
    }
  })
  const toggleShowConnectionPorts = () => {
    const next = !showConnectionPorts
    setShowConnectionPorts(next)
    try {
      sessionStorage.setItem(
        'cable-planner.videohub.show-connection-ports',
        next ? 'on' : 'off',
      )
    } catch {
      /* ignore */
    }
  }
  const setAndPersistRoutingView = (v: 'matrix' | 'list') => {
    setRoutingView(v)
    try {
      sessionStorage.setItem('cable-planner.videohub.routing-view', v)
    } catch {
      /* ignore */
    }
  }
  const [routing, setRouting] = useState<Record<number, number>>(() => {
    if (initialPreset.key === 'custom') {
      return buildDefaultRouting(initialPreset.customInputs, initialPreset.customOutputs)
    }
    const p = videohubPresets.find((x) => x.key === initialPreset.key) ?? videohubPresets[0]
    return buildDefaultRouting(p.inputs, p.outputs)
  })

  // TCP send state
  // #250 Comment: Wenn das Geraet in den Eigenschaften eine IP hat,
  // soll das IP-Feld hier vorausgefuellt sein.
  const [vhHost, setVhHost] = useState(() => initialDevice?.ipAddress?.trim() || '192.168.1.1')
  const [vhPort, setVhPort] = useState('9990')
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle')
  const [sendMessage, setSendMessage] = useState('')

  // Issue #248 — mDNS-Auto-Discovery (Bonjour). User klickt "Suchen",
  // wir scannen 3 s lang auf _blackmagic._tcp und filtern auf Videohubs.
  type DiscoveredVh = { name: string; ip: string; port: number; model?: string }
  const [discovering, setDiscovering] = useState(false)
  const [discovered, setDiscovered] = useState<DiscoveredVh[] | null>(null)
  const handleDiscover = async () => {
    if (!hasDesktopBridge) return
    setDiscovering(true)
    setDiscovered(null)
    try {
      const list = await cablePlannerApi.videohub.discover({ timeoutMs: 3000 })
      setDiscovered(list)
      logEvent(`Discovery: ${list.length} Videohub(s) gefunden`, list.length > 0)
    } catch (err) {
      logEvent(`Discovery: Fehler — ${err instanceof Error ? err.message : String(err)}`, false)
      setDiscovered([])
    } finally {
      setDiscovering(false)
    }
  }

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
  const loadSalvos = (key: string): Salvo[] => {
    try {
      const raw = localStorage.getItem(key)
      const parsed = raw ? (JSON.parse(raw) as Salvo[]) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  // Lazy-Init + Render-Adjust statt Hydrations-Effect: lädt die Salvos direkt
  // und neu, sobald sich salvoKey (= Device) ändert — kein setState im Effect,
  // keine Kaskaden-Renders. (React-Doku: "storing info from previous renders".)
  const [salvos, setSalvos] = useState<Salvo[]>(() => loadSalvos(salvoKey))
  const [loadedSalvoKey, setLoadedSalvoKey] = useState(salvoKey)
  if (loadedSalvoKey !== salvoKey) {
    setLoadedSalvoKey(salvoKey)
    setSalvos(loadSalvos(salvoKey))
  }
  const persistSalvos = (list: Salvo[]) => {
    try {
      localStorage.setItem(salvoKey, JSON.stringify(list))
    } catch {
      /* ignore quota */
    }
  }
  const saveSalvo = async () => {
    const name = (await promptDialog(t('export.salvoNamePrompt', 'Salvo-Name (= Routing-Snapshot speichern):')))?.trim()
    if (!name) return
    const next: Salvo[] = [
      // Läuft im saveSalvo-Click-Handler, nicht im Render — randomUUID/now sind hier korrekt.
      // eslint-disable-next-line react-hooks/purity
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
  const rawPreset = videohubPresets.find((p) => p.key === presetKey) ?? videohubPresets[0]
  // #387 — Custom-Mode: User-spezifische Inputs/Outputs Anzahl ueberschreibt
  // die Preset-Defaults; das spaeter abgeleitete preset-Objekt wird so
  // dimensioniert.
  const preset = presetKey === 'custom'
    ? { ...rawPreset, inputs: customInputs, outputs: customOutputs }
    : rawPreset

  // #250 Comment: Bei Geraete-Wechsel die IP aus den Geraete-Eigenschaften
  // ins TCP-Host-Feld uebernehmen. Nur wenn der User noch nicht selbst
  // editiert hat (= das Feld auf einem Default oder einer vorigen
  // Geraete-IP steht) und das neue Geraet eine IP hat. Wir lassen also
  // dem User die Moeglichkeit, manuell zu uebersteuern und dann nicht
  // beim Geraete-Switch wieder ueberschrieben zu werden.
  const lastDeviceIpRef = useRef<string | null>(initialDevice?.ipAddress?.trim() || null)
  useEffect(() => {
    const newIp = device?.ipAddress?.trim()
    if (!newIp) return
    if (vhHost === '192.168.1.1' || vhHost === lastDeviceIpRef.current) {
      setVhHost(newIp)
    }
    lastDeviceIpRef.current = newIp
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId])

  // v7.9.119 / Issue #237 — XP Smart Routing.
  // Analysiert die Canvas-Kabel des selektierten Videohub-Devices:
  //   inputConn[i]  → was haengt am Input i (Source-Device + Port)
  //   outputConn[i] → was haengt am Output i (Destination-Device + Port)
  // Wird in den Matrix-Labels angezeigt damit der User sieht 'aha
  // Output 12 versorgt Monitor Buhne' beim Routing setzen.
  // Korrekte, aber vom React-Compiler nicht statisch preservierbare
  // Memoisierung (komplexer Body, abgeleitete `device`-Dependency).
  /* eslint-disable react-hooks/preserve-manual-memoization */
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
            // User-Request: volle Geraete-Namen in Videohub-Labels,
            // nicht die Short-Form-Variante. ShortName ist
            // weiterhin fuer Endpoint-Labels (Cable-Edge) reserviert.
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
  /* eslint-enable react-hooks/preserve-manual-memoization */

  /** v7.9.119 / Issue #237 — Erzeugt einen Routing-Vorschlag basierend
   *  auf den Canvas-Verbindungen. Heuristik:
   *  1. Fuer jeden Output mit angeschlossener Destination: suche einen
   *     Input dessen Source-Geraet einen Token (≥2 Zeichen) mit dem
   *     Destination-Geraet teilt. So matched z.B. 'Monitor Buhne'
   *     mit 'Cam Buhne Hauptseite' ueber das Token 'buhne'.
   *  2. Wenn kein Match: Diagonal (Output N → Input N % totalInputs).
   *  Trifft nicht perfekt aber gibt einen sinnvollen Startpunkt — der
   *  User justiert per Matrix nach. */
  // #237 — Token-Extraction. Wir splitten zusaetzlich an Letter/Digit-
  // Grenzen damit "DSM1, DSM2, DSM3" alle das Token "dsm" + "1/2/3"
  // produzieren — dann matched ATEM-Input "DSM" auf alle drei Outputs.
  // Sonst waeren "dsm1" und "dsm" gar nicht als Treffer erkannt.
  // Stop-Words (out/in/sdi/pgm/...) werden hier rausgefiltert, sodass
  // sie weder im Source- noch im Dest-Token-Set landen — sonst matchen
  // sie jeden Port faelschlich gegen jeden.
  const tokensOf = (name: string): string[] => {
    const raw = name
      .toLowerCase()
      .split(/[^a-z0-9äöüß]+/)
      .filter((t) => t.length >= 1)
    const out = new Set<string>()
    for (const t of raw) {
      if (t.length >= 2 && !SMART_ROUTING_STOP_WORDS.has(t)) out.add(t)
      // Letter-Cluster trennen ("dsm1" -> "dsm" + "1").
      const parts = t.match(/[a-zäöüß]+|\d+/gi) ?? []
      for (const p of parts) {
        const pLow = p.toLowerCase()
        if (p.length >= 2 && !SMART_ROUTING_STOP_WORDS.has(pLow)) out.add(pLow)
      }
    }
    return [...out]
  }
  // #237 — Fuzzy-Token-Overlap: ein dest-Token zaehlt als Treffer wenn
  // exakt in srcTokens vorhanden ODER ein srcToken mit Edit-Distanz <= 1
  // existiert (1 Tippfehler erlaubt). Edit-Distanz nur auf Tokens >= 4
  // Zeichen anwenden — sonst matched "in" auf "im"/"an" und das ist
  // nicht hilfreich. Exact-Matches wiegen 1.0, Fuzzy-Matches 0.7 damit
  // ein exakter Treffer einen 1-Char-Tippfehler-Treffer immer schlaegt.
  const fuzzyOverlapScore = (destTokens: string[], srcTokens: string[]): number => {
    let score = 0
    const srcSet = new Set(srcTokens)
    for (const d of destTokens) {
      if (srcSet.has(d)) {
        score += 1
        continue
      }
      if (d.length >= 4) {
        for (const s of srcTokens) {
          if (s.length >= 4 && isWithinDistance(d, s, 1)) {
            score += 0.7
            break
          }
        }
      }
    }
    return score
  }
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
          const overlap = fuzzyOverlapScore(destTokens, srcTokens)
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

  /* eslint-disable react-hooks/preserve-manual-memoization */
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
  /* eslint-enable react-hooks/preserve-manual-memoization */

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

  // #502 — Druckbare Beschriftungs-Labels (Smart-Control-Raster) als PDF,
  // gefüllt mit den effektiven Eingangs-/Ausgangs-Namen des Geräts.
  const handleExportLabelsPdf = () => {
    if (!device) return
    const pdf = buildVideohubControlLabelsPdf(device.name || 'Videohub', [
      { heading: t('videohub.labelsPdf.inputs', 'Eingänge / Quellen'), labels: computeEffectiveInputLabels() },
      { heading: t('videohub.labelsPdf.outputs', 'Ausgänge'), labels: computeEffectiveOutputLabels() },
    ])
    const fileName = buildExportFilenameWithSuffix(
      device.name || 'Videohub',
      `${preset.key}_control-labels`,
      'pdf',
    )
    downloadBlob(fileName, pdf.output('blob') as Blob, 'application/pdf')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(preview).catch(() => {})
  }

  /**
   * #389 — Labels.txt re-import. Liest eine Standard-Videohub-Labels-
   * Datei und schreibt die Port-Namen zurueck auf das aktuelle Canvas-
   * Geraet. Existierende Port-Definitionen (connectorType, contentLabel,
   * etc.) bleiben erhalten — nur `name` wird ueberschrieben.
   */
  const handleImportLabels = async () => {
    if (!device) return
    const picked = await pickTextFile('.txt,text/plain')
    if (!picked) return
    const parsed = parseVideohubLabelsTxt(picked.content)
    const setEquipment = useProjectStore.getState().updateEquipment
    const nextInputs = device.inputs.map((p, idx) => {
      const lbl = parsed.inputs[idx]
      return lbl ? { ...p, name: lbl } : p
    })
    const nextOutputs = device.outputs.map((p, idx) => {
      const lbl = parsed.outputs[idx]
      return lbl ? { ...p, name: lbl } : p
    })
    setEquipment(device.id, { inputs: nextInputs, outputs: nextOutputs })
    const updatedIn = parsed.inputs.filter((x) => x).length
    const updatedOut = parsed.outputs.filter((x) => x).length
    const warningSummary =
      parsed.warnings.length > 0
        ? `\n\n⚠ ${parsed.warnings.length} Zeilen nicht erkannt:\n${parsed.warnings.slice(0, 5).join('\n')}`
        : ''
    await infoDialog(t('export.labelsImported', 'Labels.txt importiert'), {
      body: `${updatedIn} Inputs · ${updatedOut} Outputs neu beschriftet.${warningSummary}`,
      tone: 'success',
    })
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
      // #286 — contentLabel (PGM/PVW/Cam1) gewinnt vor port.name.
      const port = device?.inputs[i]
      const portName = port ? portDisplayLabel(port) || `In ${i + 1}` : `In ${i + 1}`
      const conn = connections.inputConn.get(i)
      return conn ? `${portName} <- ${conn.sourceName}` : portName
    })
  const computeEffectiveOutputLabels = (): string[] =>
    Array.from({ length: preset.outputs }, (_, i) => {
      const port = device?.outputs[i]
      const portName = port ? portDisplayLabel(port) || `Out ${i + 1}` : `Out ${i + 1}`
      const conn = connections.outputConn.get(i)
      return conn ? `${portName} -> ${conn.destName}` : portName
    })

  // Generischer TCP-Send mit beliebigem Block-Inhalt.
  const sendBlock = async (block: string, what: string): Promise<boolean> => {
    if (!device) return false
    const portNum = parseInt(vhPort, 10)
    if (!vhHost.trim() || isNaN(portNum)) {
      setSendStatus('error')
      setSendMessage(t('export.invalidIpPort', 'Bitte gueltige IP und Port angeben.'))
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
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded border border-cp-border bg-cp-surface-1 p-4 text-cp-text">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-cp-xl font-semibold"><Icon icon={SlidersHorizontal} size="sm" /> {t('export.dialogTitle', 'Videohub konfigurieren · Labels + Routing')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
            aria-label={t('common.close', 'Schließen')}
          >
            <Icon icon={X} size="sm" />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3 text-cp-base">
          <label className="block">
            {t('videohub.deviceOnCanvas', 'Gerät auf dem Canvas')}
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
            >
              <option value="">— {t('videohub.pickDevice', 'Gerät wählen')} —</option>
              {equipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.inputs.length}/{e.outputs.length})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            {t('export.videohubModel', 'Videohub-Modell')}
            <select
              value={presetKey}
              onChange={(e) => {
                const key = e.target.value
                setPresetKey(key)
                const p = videohubPresets.find((x) => x.key === key) ?? videohubPresets[0]
                if (key === 'custom') {
                  setRouting(buildDefaultRouting(customInputs, customOutputs))
                } else {
                  setRouting(buildDefaultRouting(p.inputs, p.outputs))
                }
              }}
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
            >
              {videohubPresets.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.model}{p.key === 'custom' ? '' : ` (${p.inputs}×${p.outputs})`}
                </option>
              ))}
            </select>
          </label>

          {/* #387 — Custom-Mode: User-spezifische Inputs/Outputs Anzahl. */}
          {presetKey === 'custom' && (
            <div className="col-span-2 grid grid-cols-2 gap-2 rounded border border-sky-700/40 bg-sky-950/20 p-2">
              <label className="block text-cp-xs text-cp-text-secondary">
                {t('export.customInputs', 'Inputs')}
                <input
                  type="number"
                  min={1}
                  max={1024}
                  value={customInputs}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(1024, Number(e.target.value) || 1))
                    setCustomInputs(v)
                    setRouting(buildDefaultRouting(v, customOutputs))
                  }}
                  className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
                />
              </label>
              <label className="block text-cp-xs text-cp-text-secondary">
                {t('export.customOutputs', 'Outputs')}
                <input
                  type="number"
                  min={1}
                  max={1024}
                  value={customOutputs}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(1024, Number(e.target.value) || 1))
                    setCustomOutputs(v)
                    setRouting(buildDefaultRouting(customInputs, v))
                  }}
                  className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
                />
              </label>
            </div>
          )}

          <label className="block">
            {t('export.fileExportFormat', 'Datei-Export-Format')}
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
              title={t('videohub.formatTitle', 'Bestimmt nur das Format der Vorschau-/Datei-Ausgabe unten. Der direkte TCP-Push (Labels/Routing-Buttons) ist davon unabhängig.')}
            >
              <option value="routing">{t('videohub.optFullRouting', 'Voller Routing-Dump (Protokoll 2.5)')}</option>
              <option value="labels">{t('videohub.optLabelsOnly', 'Nur Labels (Input, n, Name)')}</option>
            </select>
          </label>

          <label className="block">
            Friendly Name {format === 'labels' && <span className="text-cp-text-faint">{t('export.ignored', '(ignoriert)')}</span>}
            <input
              value={friendlyName}
              placeholder={device?.name ?? ''}
              onChange={(e) => setFriendlyName(e.target.value)}
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
            />
          </label>
        </div>

        {device && (device.inputs.length > preset.inputs || device.outputs.length > preset.outputs) && (
          <div className="mb-2 rounded bg-amber-950 p-2 text-cp-xs text-amber-300">
            {t('export.portOverflowWarnPre', 'Warnung: Das Gerät hat mehr Ports')} ({device.inputs.length} IN / {device.outputs.length} OUT){' '}
            {t('export.portOverflowWarnMid', 'als das gewählte Modell')} ({preset.inputs}×{preset.outputs}).{' '}
            {t('export.portOverflowWarnPost', 'Überschüssige Ports werden abgeschnitten.')}
          </div>
        )}

        {/* ── Routing Matrix ─────────────────────────────────────────── */}
        {/* v7.9.128 — Matrix immer sichtbar (kein format='routing'-Gating
            mehr). Funktioniert offline, beim TCP-Push wird Routing UND/ODER
            Labels separat verschickt — siehe unten. */}
        <div className="mb-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMatrix((m) => !m)}
              className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
            >
              {showMatrix ? '▼' : '▶'} {t('export.routingView', 'Routing-Ansicht')}
            </button>
            {/* v7.9.129 — View-Mode-Switch: Matrix oder Liste */}
            {showMatrix && (
              <div className="flex overflow-hidden rounded border border-cp-border text-cp-xs">
                <button
                  type="button"
                  onClick={() => setAndPersistRoutingView('matrix')}
                  className={`px-2 py-1 ${
                    routingView === 'matrix'
                      ? 'bg-sky-700 text-white'
                      : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
                  }`}
                  title={t('videohub.matrixView', 'Crosspoint-Matrix')}
                >
                  ▦ {t('export.matrixToggle', 'Matrix')}
                </button>
                <button
                  type="button"
                  onClick={() => setAndPersistRoutingView('list')}
                  className={`px-2 py-1 ${
                    routingView === 'list'
                      ? 'bg-sky-700 text-white'
                      : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
                  }`}
                  title={t('videohub.listView', 'Listen-Ansicht mit Dropdown pro Output')}
                >
                  <Icon icon={List} size="xs" className="mr-1 inline-block align-text-bottom" />{t('export.listToggle', 'Liste')}
                </button>
              </div>
            )}
            <span className="text-cp-xs text-cp-text-faint">
              {preset.inputs} {t('export.inputsAbbr', 'Eing.')} × {preset.outputs} {t('export.outputsAbbr', 'Ausg.')}
            </span>
            {/* v7.9.131 — Achsen-Swap. Toggle zwischen "Outputs links/
                Inputs oben" und "Inputs links/Outputs oben". Wirkt
                fuer Matrix UND List. */}
            <button
              type="button"
              onClick={toggleAxis}
              title={
                axisOrientation === 'outputs-rows'
                  ? t('export.axisSwapTitleToInputs', 'Achsen tauschen: Inputs links, Outputs oben/als Picker')
                  : t('export.axisSwapTitleToOutputs', 'Achsen tauschen: Outputs links, Inputs oben/als Picker')
              }
              className="rounded border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-xs text-cp-text-bright hover:bg-cp-surface-4"
            >
              {axisOrientation === 'outputs-rows'
                ? `⇅ ${t('export.axisSwapOutIn', 'Out·In tauschen')}`
                : `⇅ ${t('export.axisSwapInOut', 'In·Out tauschen')}`}
            </button>
            {/* v7.9.130 — Verkabelung-Toggle. Zeigt/versteckt das
                "← Verbundenes Geraet"-Suffix in den Labels. */}
            <button
              type="button"
              onClick={toggleShowConnections}
              title={
                showConnections
                  ? t('export.hideConnInfo', 'Connection-Info ausblenden (nur Port-Name)')
                  : t('export.showConnInfo', 'Connection-Info einblenden (← angeschlossenes Geraet)')
              }
              className={`rounded border px-2 py-1 text-cp-xs ${
                showConnections
                  ? 'border-sky-700 bg-sky-900/40 text-sky-200'
                  : 'border-cp-border bg-cp-surface-1 text-cp-text-muted hover:bg-cp-surface-2'
              }`}
            >
              <Icon icon={Link} size="xs" className="mr-1 inline-block align-text-bottom" />{showConnections ? t('export.cablingOn', 'Verkabelung an') : t('export.cablingOff', 'Verkabelung aus')}
            </button>
            {/* v7.9.130 — Zusatztoggle "Input-Label" (Port-Name am
                angeschlossenen Geraet). Andere Farb-Palette als
                Verkabelung-Toggle damit User auf einen Blick sieht
                dass das zwei unabhaengige Toggles sind: Verkabelung
                -> sky, Input-Label -> emerald. */}
            {showConnections && (
              <button
                type="button"
                onClick={toggleShowConnectionPorts}
                title={
                  showConnectionPorts
                    ? t('export.hideConnPorts', 'Port-Namen der angeschlossenen Geraete ausblenden')
                    : t('export.showConnPorts', 'Port-Namen der angeschlossenen Geraete einblenden')
                }
                className={`rounded border px-2 py-1 text-cp-xs ${
                  showConnectionPorts
                    ? 'border-emerald-700 bg-emerald-900/40 text-emerald-200'
                    : 'border-cp-border bg-cp-surface-1 text-cp-text-muted hover:bg-cp-surface-2'
                }`}
              >
                {showConnectionPorts ? `· ${t('export.inputLabelOn', 'Input-Label an')}` : `· ${t('export.inputLabelOff', 'Input-Label aus')}`}
              </button>
            )}
            {/* v7.9.119 / Issue #237 — Smart-Routing Vorschlag aus
                Canvas-Verbindungen. Heuristik: pro Output das beste
                Token-Match in den Input-Sources. Fallback: Diagonal. */}
            <button
              type="button"
              onClick={generateSmartRouting}
              className="ml-auto rounded bg-purple-700 px-2 py-1 text-cp-xs text-purple-50 hover:bg-purple-600"
              title={t('videohub.suggestTitle', 'Schlägt ein Routing vor, basierend auf den Kabeln im Canvas. Best-Match per Geräte-Namens-Ähnlichkeit; Fallback Diagonal. Per Matrix anpassbar.')}
            >
              <Icon icon={Wand2} size="xs" className="mr-1 inline-block align-text-bottom" />{t('export.smartRouting', 'Smart-Routing')}
            </button>
            <button
              type="button"
              onClick={() => setRouting(buildDefaultRouting(preset.inputs, preset.outputs))}
              className="rounded bg-cp-surface-2 px-2 py-1 text-cp-xs hover:bg-cp-surface-4"
              title={t('videohub.resetDiag', 'Diagonal-Routing zurücksetzen (Ausgang N → Eingang N)')}
            >
              ↺ {t('export.reset', 'Reset')}
            </button>
          </div>
          {showMatrix && (() => {
            // v7.9.128/129 — Labels einmal berechnen, an Matrix ODER
            // Liste durchreichen. Hub-Labels gewinnen wenn vom Hub
            // geladen ("Status laden"). Sonst Canvas-Port-Name +
            // (wenn verkabelt) die Source/Dest aus dem Canvas.
            // v7.9.130 — Connection-Suffix-Builder + parallel
            // strukturierte Parts fuer farb-kodierte Anzeige.
            const inputLabelParts = Array.from({ length: preset.inputs }, (_, i) => {
              const hubLabel = hubState?.inputLabels?.[i]
              if (hubLabel) return { port: hubLabel }
              // #286 — Canvas-Port: contentLabel bevorzugt vor port.name.
              const p = device?.inputs[i]
              const portName = p ? portDisplayLabel(p) || `In ${i + 1}` : `In ${i + 1}`
              const conn = connections.inputConn.get(i)
              if (!conn || !showConnections) return { port: portName }
              return {
                port: portName,
                connDevice: conn.sourceName,
                connPort:
                  showConnectionPorts && conn.portName && conn.portName !== '?'
                    ? conn.portName
                    : undefined,
              }
            })
            const outputLabelParts = Array.from({ length: preset.outputs }, (_, i) => {
              const hubLabel = hubState?.outputLabels?.[i]
              const lockState = hubState?.outputLocks?.[i]
              const lockBadge =
                lockState === 'locked-self'
                  ? ' 🔒'
                  : lockState === 'locked-other'
                    ? ' 🔒❗'
                    : ''
              if (hubLabel) return { port: hubLabel, lockBadge }
              const p = device?.outputs[i]
              const portName = p ? portDisplayLabel(p) || `Out ${i + 1}` : `Out ${i + 1}`
              const conn = connections.outputConn.get(i)
              if (!conn || !showConnections) return { port: portName, lockBadge }
              return {
                port: portName,
                connDevice: conn.destName,
                connPort:
                  showConnectionPorts && conn.portName && conn.portName !== '?'
                    ? conn.portName
                    : undefined,
                lockBadge,
              }
            })
            // Plain-Text-Variante fuer Tooltips / List-Mode-Fallback /
            // Export-Filenamen.
            const inputLabelArr = inputLabelParts.map((p) =>
              p.connPort
                ? `${p.port} ← ${p.connDevice} · ${p.connPort}`
                : p.connDevice
                  ? `${p.port} ← ${p.connDevice}`
                  : p.port,
            )
            const outputLabelArr = outputLabelParts.map((p) =>
              (p.connPort
                ? `${p.port} → ${p.connDevice} · ${p.connPort}`
                : p.connDevice
                  ? `${p.port} → ${p.connDevice}`
                  : p.port) + (p.lockBadge ?? ''),
            )
            const onRoute = (output: number, input: number) =>
              setRouting((r) => ({ ...r, [output]: input }))
            // v7.9.131 — Bei isSwapped tauschen wir die Label-/
            // Parts-Arrays + transponieren die Routing-Map damit das
            // Visual transpose ohne Matrix-Refactor funktioniert.
            // Multicast-Verlust: routing[output]=input ist one-to-one
            // pro Output, aber many-Outputs-pro-Input. In "inputs-rows"
            // bilden wir input->erstesOutput ab (verliert weitere
            // Outputs die auf den gleichen Input gehen — siehe Plan
            // fuer Multicast-Anzeige im Folge-Commit).
            const isSwap = axisOrientation === 'inputs-rows'
            const matrixInputLabels = isSwap ? outputLabelArr : inputLabelArr
            const matrixOutputLabels = isSwap ? inputLabelArr : outputLabelArr
            const matrixInputParts = isSwap ? outputLabelParts : inputLabelParts
            const matrixOutputParts = isSwap ? inputLabelParts : outputLabelParts
            const matrixRouting = isSwap
              ? (() => {
                  const r: Record<number, number> = {}
                  for (const [outStr, inIdx] of Object.entries(routing)) {
                    const inputIdx = inIdx as number
                    if (r[inputIdx] === undefined) {
                      r[inputIdx] = parseInt(outStr, 10)
                    }
                  }
                  return r
                })()
              : routing
            const matrixOnRoute = isSwap
              ? (rowIdx: number, colIdx: number) => onRoute(colIdx, rowIdx)
              : onRoute
            const matrixTotalIn = isSwap ? preset.outputs : preset.inputs
            const matrixTotalOut = isSwap ? preset.inputs : preset.outputs
            if (routingView === 'list') {
              return (
                <VideohubRoutingList
                  totalInputs={matrixTotalIn}
                  totalOutputs={matrixTotalOut}
                  inputLabels={matrixInputLabels}
                  outputLabels={matrixOutputLabels}
                  routing={matrixRouting}
                  onRoute={matrixOnRoute}
                />
              )
            }
            return (
              <VideohubRoutingMatrix
                totalInputs={matrixTotalIn}
                totalOutputs={matrixTotalOut}
                inputLabels={matrixInputLabels}
                outputLabels={matrixOutputLabels}
                inputLabelParts={matrixInputParts}
                outputLabelParts={matrixOutputParts}
                routing={matrixRouting}
                onRoute={matrixOnRoute}
                axisOrientation={axisOrientation}
              />
            )
          })()}
        </div>

        {/* v7.9.128 — Salvos: benannte Routing-Snapshots speichern/laden.
            Inspiriert von VideoHubSim. Pro Device + Preset gespeichert in
            localStorage. Immer sichtbar (nicht mehr von showMatrix
            abhaengig). */}
        <div className="mb-3 rounded border border-cyan-700/40 bg-cyan-950/20 p-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wide text-cyan-300">
              {t('export.salvosHeader', 'Salvos (Routing-Snapshots)')}
            </div>
            <button
              type="button"
              onClick={() => void saveSalvo()}
              className="rounded bg-cyan-700 px-2 py-0.5 text-[11px] text-white hover:bg-cyan-600"
              title={t('videohub.saveSalvo', 'Aktuelles Routing als benannten Snapshot speichern')}
            >
              + {t('export.saveCurrentRouting', 'Aktuelles Routing speichern')}
            </button>
          </div>
          {salvos.length === 0 ? (
            <div className="text-[11px] text-cp-text-muted">
              {t('export.noSalvos', 'Noch keine Salvos. Speichere die aktuelle Crosspoint-Verteilung und ruf sie spaeter mit einem Klick zurueck.')}
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
                    <Icon icon={ClipboardList} size="xs" className="mr-1 inline-block align-text-bottom" />{s.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSalvo(s.id)}
                    className="text-cp-text-faint hover:text-red-400"
                    title={t('videohub.deleteSalvo', 'Salvo löschen')}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── TCP Senden ─────────────────────────────────────────────── */}
        {/* v7.9.128 — Immer sichtbar. Separate Buttons fuer Labels-Push,
            Routing-Push, Beides. So baut der User offline alles auf und
            pusht das ans Hub wenn er im richtigen Netz ist — ggf. nur
            Teilmengen (z.B. nur Labels nach Re-Labelling, ohne Routing
            zu touchen). */}
        <div className="mb-3 rounded border border-cp-surface-5 bg-cp-surface-2/60 p-2">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-cp-text-muted">
            An Videohub senden (TCP) — offline editieren, hier pushen wenn online
            {!hasDesktopBridge && (
              <span className="ml-2 text-amber-400">· nur in Desktop-App verfügbar</span>
            )}
          </div>
          <div className="flex items-end gap-2">
            <label className="block flex-1 text-cp-xs">
              IP-Adresse
              <div className="mt-1 flex items-stretch gap-1">
                <input
                  value={vhHost}
                  onChange={(e) => {
                    setVhHost(e.target.value)
                    setSendStatus('idle')
                  }}
                  placeholder="192.168.1.1"
                  className="flex-1 rounded border border-cp-border bg-cp-surface-3 p-1.5 font-mono text-cp-xs"
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
                    title={t('videohub.recentConns', 'Zuletzt benutzte Verbindungen')}
                    className="w-10 rounded border border-cp-border bg-cp-surface-3 px-1 text-cp-xs"
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
            <label className="block w-20 text-cp-xs">
              Port
              <input
                value={vhPort}
                onChange={(e) => {
                  setVhPort(e.target.value)
                  setSendStatus('idle')
                }}
                placeholder="9990"
                className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 font-mono text-cp-xs"
              />
            </label>
            <button
              type="button"
              onClick={() => { void handleDiscover() }}
              disabled={!hasDesktopBridge || discovering}
              title={t('videohub.mdnsTitle', 'Videohubs im lokalen Netz via mDNS/Bonjour suchen (3 s Scan).')}
              className="rounded bg-teal-700 px-3 py-1.5 text-cp-xs hover:bg-teal-600 disabled:opacity-50"
            >
              <Icon icon={Search} size="xs" className="mr-1 inline-block align-text-bottom" />{discovering ? t('export.searching', 'Suche…') : t('export.search', 'Suchen')}
            </button>
            <button
              type="button"
              onClick={() => { void handleReadState() }}
              disabled={!device || !hasDesktopBridge || readingState}
              title={t('videohub.loadStatus', 'Aktuellen Hub-Status holen: Labels + Routing + Locks. Routing wird in die Matrix übernommen, Labels in den Spalten/Zeilen angezeigt.')}
              className="rounded bg-sky-700 px-3 py-1.5 text-cp-xs hover:bg-sky-600 disabled:opacity-50"
            >
              <Icon icon={readingState ? Loader2 : Download} size="xs" className={`mr-1 inline-block align-text-bottom ${readingState ? 'animate-spin' : ''}`} />{readingState ? t('export.loading', 'Laden…') : t('export.loadStatusBtn', 'Status laden')}
            </button>
          </div>
          {/* Issue #248 — Ergebnisliste der Discovery. Klick auf einen
              Eintrag uebernimmt IP+Port in die Eingabefelder. */}
          {discovered !== null && (
            <div className="mt-2 rounded border border-teal-800 bg-teal-950/30 p-2 text-cp-xs">
              {discovered.length === 0 ? (
                <div className="text-cp-text-muted">
                  Kein Videohub per mDNS gefunden. (Firewalls oder andere Subnetze
                  blocken Bonjour — dann IP manuell eintragen.)
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-teal-300">
                    Gefunden ({discovered.length}) — Klick uebernimmt IP/Port
                  </div>
                  {discovered.map((d) => (
                    <button
                      key={`${d.ip}:${d.port}`}
                      type="button"
                      onClick={() => {
                        setVhHost(d.ip)
                        setVhPort(String(d.port))
                        setSendStatus('idle')
                      }}
                      className="flex items-center justify-between gap-2 rounded border border-cp-border bg-cp-surface-1 px-2 py-1 text-left hover:border-teal-500 hover:bg-cp-surface-2"
                    >
                      <span className="truncate font-semibold text-cp-text">
                        {d.name}
                        {d.model && (
                          <span className="ml-1 text-[10px] font-normal text-cp-text-muted">
                            · {d.model}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-mono text-cp-text-secondary">
                        {d.ip}:{d.port}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* v7.9.128 — Drei getrennte Push-Buttons. User kann nur
              Labels oder nur Routing oder beides zusammen pushen. */}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { void handleSendLabels() }}
              disabled={!device || !hasDesktopBridge || sendStatus === 'sending'}
              title={t('videohub.sendLabelsTitle', 'Nur INPUT LABELS + OUTPUT LABELS senden. Routing bleibt am Hub unangetastet.')}
              className="rounded bg-purple-600 px-3 py-1.5 text-cp-xs hover:bg-purple-500 disabled:opacity-50"
            >
              <Icon icon={sendStatus === 'sending' ? Loader2 : Upload} size="xs" className={`mr-1 inline-block align-text-bottom ${sendStatus === 'sending' ? 'animate-spin' : ''}`} />{sendStatus === 'sending' ? '…' : t('export.sendLabels', 'Labels senden')}
            </button>
            <button
              type="button"
              onClick={() => { void handleSendRouting() }}
              disabled={!device || !hasDesktopBridge || sendStatus === 'sending'}
              title={t('videohub.sendRoutingTitle', 'Nur VIDEO OUTPUT ROUTING senden. Labels am Hub unverändert.')}
              className="rounded bg-purple-600 px-3 py-1.5 text-cp-xs hover:bg-purple-500 disabled:opacity-50"
            >
              <Icon icon={sendStatus === 'sending' ? Loader2 : Upload} size="xs" className={`mr-1 inline-block align-text-bottom ${sendStatus === 'sending' ? 'animate-spin' : ''}`} />{sendStatus === 'sending' ? '…' : t('export.sendRouting', 'Routing senden')}
            </button>
            <button
              type="button"
              onClick={() => { void handleSendBoth() }}
              disabled={!device || !hasDesktopBridge || sendStatus === 'sending'}
              title={t('videohub.sendBothTitle', 'Labels + Routing in EINEM Push (drei Blöcke hintereinander).')}
              className="rounded bg-purple-800 px-3 py-1.5 text-cp-xs font-semibold hover:bg-purple-700 disabled:opacity-50"
            >
              <Icon icon={sendStatus === 'sending' ? Loader2 : Upload} size="xs" className={`mr-1 inline-block align-text-bottom ${sendStatus === 'sending' ? 'animate-spin' : ''}`} />{sendStatus === 'sending' ? '…' : t('export.sendBoth', 'Labels + Routing senden')}
            </button>
          </div>
          {hubState && (
            <div className="mt-1.5 rounded border border-sky-700/40 bg-sky-950/30 p-1.5 text-[11px] text-sky-100">
              <span className="font-semibold">{t('videohub.hubStatus', 'Hub-Status:')}</span>{' '}
              {hubState.modelName ?? t('export.unknown', 'Unbekannt')}{' '}
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
                    <Icon icon={Lock} size="xs" className="mr-1 inline-block align-text-bottom" />{lockedCount} Output{lockedCount !== 1 ? 's' : ''} {t('export.locked', 'gesperrt')}
                  </span>
                ) : null
              })()}
            </div>
          )}
          {sendStatus !== 'idle' && (
            <div
              className={`mt-1.5 rounded p-1.5 text-cp-xs ${
                sendStatus === 'ok'
                  ? 'bg-emerald-950 text-emerald-300'
                  : sendStatus === 'error'
                    ? 'bg-red-950 text-red-300'
                    : 'bg-cp-surface-4 text-cp-text-secondary'
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
              <summary className="cursor-pointer text-cp-text-muted hover:text-cp-text-bright">
                Activity-Log ({activityLog.length})
              </summary>
              <div className="mt-1 max-h-32 space-y-0.5 overflow-auto rounded border border-cp-border-muted bg-cp-surface-3/60 p-1.5 font-mono">
                {activityLog.map((e, i) => (
                  <div
                    key={`${e.ts}-${i}`}
                    className={`whitespace-nowrap ${
                      e.ok ? 'text-cp-text-secondary' : 'text-red-300'
                    }`}
                  >
                    <span className="text-cp-text-faint">
                      {new Date(e.ts).toLocaleTimeString('de-DE')}
                    </span>{' '}
                    {e.text}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        <div className="mb-2 text-cp-xs text-cp-text-muted">{t('videohub.preview', 'Vorschau')}</div>
        <textarea
          readOnly
          value={preview}
          className="flex-1 min-h-[150px] rounded border border-cp-border bg-cp-surface-3 p-2 font-mono text-[11px] text-cp-text-bright"
        />

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!device}
            className="rounded bg-cp-surface-4 px-3 py-1 text-cp-base hover:bg-cp-surface-5 disabled:opacity-50"
          >
            {t('export.toClipboard', 'In Zwischenablage')}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!device}
            className="rounded bg-emerald-600 px-3 py-1 text-cp-base hover:bg-emerald-500 disabled:opacity-50"
          >
            {t('export.saveAsFile', 'Als Datei speichern')}
          </button>
          {/* #389 — Labels.txt re-import: liest die Standard-Labels.txt
              (wie Videohub Setup sie exportiert) und schreibt die Port-
              Namen zurueck auf das aktuelle Canvas-Geraet. */}
          {format === 'labels' && device && (
            <button
              type="button"
              onClick={() => void handleImportLabels()}
              className="rounded bg-sky-700 px-3 py-1 text-cp-base hover:bg-sky-600"
              title={t('export.importLabelsTitle', 'Labels.txt importieren — Port-Namen aus einer Datei (z.B. von Videohub Setup) auf dieses Gerät schreiben.')}
            >
              ⬆ {t('export.importLabels', 'Labels.txt importieren')}
            </button>
          )}
          {/* #502 — Druckbare Beschriftungs-Labels (Smart-Control-Raster) als
              PDF, gefüllt mit den Quell-/Output-Namen. */}
          {device && (
            <button
              type="button"
              onClick={handleExportLabelsPdf}
              className="rounded bg-indigo-700 px-3 py-1 text-cp-base hover:bg-indigo-600"
              title={t('videohub.labelsPdfTitle', 'Beschriftungs-Labels als PDF generieren (Smart-Control-Raster, zum Ausdrucken und Ausschneiden).')}
            >
              {t('videohub.labelsPdf', '🏷 Labels-PDF')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

