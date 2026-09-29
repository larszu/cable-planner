/**
 * Der Raum als Anlagendatei fuer die LZ Camera Bridge.
 *
 * Der Cable-Planner kennt die Kameras (Kategorie, IP, Steuerweg, Stream), ihre
 * geplante Ausrichtung und ihre Shots (aus MultiCam, `optik` und
 * `kameraPresets`). Die Bruecke kennt Koepfe an Adressen. Diese Datei ist der
 * Uebergang: ein `lz-site` v1 (siehe lz-camera-bridge, packages/bridge/src/site),
 * das die Bruecke unter *Site → Import* oder ueber `importSite` einliest und
 * dann alles selbst verbindet. Je Kamera reist der Plan mit (`plan`), damit
 * die Bruecke die Shots anfahren, speichern und vor Ort kalibrieren kann.
 *
 * Slot-Nummern: eine Kamera behaelt ihre `bridgeCameraNumber`; wer keine hat,
 * bekommt die naechste freie. Die Vergabe kommt als Patch zurueck, damit der
 * Aufrufer sie ans Geraet schreibt — diese Datei schreibt nichts.
 *
 * Reine Funktionen: kein Netz, keine Uhr, kein Store.
 */
import type { EquipmentItem, KameraPreset } from '../types/equipment'
import type { ControlPath } from '../optics/types'

export interface SitePreset {
  number: number
  name: string
  segment?: string
  pan: number
  tilt: number
  focalMm?: number
  focusM?: number
  savedAt?: string
}

export interface SiteCamera {
  cameraNumber: number
  config: Record<string, unknown>
  autoConnect: boolean
  plan?: {
    id: string
    label: string
    manufacturer?: string
    model?: string
    deviceTypeId?: string
    pan?: number
    tilt?: number
    focalMm?: number
    lens?: { manufacturer?: string; model?: string; focalMinMm?: number; focalMaxMm?: number }
    presets?: SitePreset[]
  }
  planMatchedBy?: 'manual'
}

export interface SiteFile {
  kind: 'lz-site'
  formatVersion: 1
  name: string
  cameras: SiteCamera[]
  switchers: unknown[]
}

export const isCameraDevice = (d: EquipmentItem): boolean => /kamera|camera/i.test(d.category ?? '')

/** Der Steuerweg, den die Bruecke fuer dieses Geraet bekommt; `null` heisst: nicht fernsteuerbar. */
export function controlModeOf(d: EquipmentItem): ControlPath | null {
  const path = d.cameraControlPath
  if (!path || path === 'none') return null
  return path
}

/** Erste Stream-Adresse, die die Bruecke zeigen kann (RTSP, SRT, RTMP). */
export function streamUrlOf(d: EquipmentItem): string | undefined {
  for (const s of d.streams ?? []) {
    const url = s.url?.trim()
    if (url && /^(rtsps?|srt|rtmps?):\/\//i.test(url)) return url
  }
  return undefined
}

/** Die Bridge-Konfiguration eines Geraets, ohne Slot-Nummer. */
export function cameraConfigOf(d: EquipmentItem): Record<string, unknown> | null {
  const mode = controlModeOf(d)
  if (!mode) return null
  const host = d.ipAddress?.trim()
  const cfg: Record<string, unknown> = { connectionMode: mode, label: d.name }
  const port = d.cameraControlPort
  // Die Bruecke fuehrt je Weg eigene Feldnamen; hier werden sie belegt, nicht erfunden.
  switch (mode) {
    case 'tcp':
      if (host) cfg.tcpHost = host
      if (port) cfg.tcpPort = port
      break
    case 'lumix-http':
      if (host) cfg.lumixHost = host
      if (port) cfg.lumixPort = port
      break
    case 'blackmagic':
      if (host) cfg.bmHost = host
      break
    case 'sony-mnc':
      if (host) cfg.mncHost = host
      if (port) cfg.mncPort = port
      break
    case 'canon-ccapi':
      if (host) cfg.canonHost = host
      if (port) cfg.canonPort = port
      break
    case 'serial': case 'visca-serial': case 'sony-usb': case 'dji-osmo': case 'dji-ronin':
      // Kabel- und USB-Wege haben keine Adresse im Plan; die Bruecke fragt nach dem Port.
      break
    default:
      // zcam, panasonic-ptz, visca, jvc, birddog, http-cgi
      if (host) cfg.camHost = host
      if (port) cfg.camPort = port
      if (d.username) cfg.camUser = d.username
      if (d.password) cfg.camPass = d.password
  }
  const family = d.cameraControlFamily
  if (family && (mode as string) === 'http-cgi') cfg.cgiFamily = family
  const stream = streamUrlOf(d)
  if (stream) cfg.streamUrl = stream
  return cfg
}

function presetOf(p: KameraPreset): SitePreset {
  const out: SitePreset = { number: p.nummer, name: p.name, pan: p.panGrad, tilt: p.neigungGrad }
  if (p.segment) out.segment = p.segment
  if (Number.isFinite(p.brennweiteMm)) out.focalMm = p.brennweiteMm
  if (Number.isFinite(p.fokusM)) out.focusM = p.fokusM
  if (p.gespeichertAm) out.savedAt = p.gespeichertAm
  return out
}

/** Der Plan-Teil einer Kamera: Ausrichtung, Optik, Shots. Fehlt alles, fehlt er. */
export function planOf(d: EquipmentItem): SiteCamera['plan'] | undefined {
  const o = d.optik
  const presets = (d.kameraPresets ?? []).map(presetOf).sort((a, b) => a.number - b.number)
  const plan: NonNullable<SiteCamera['plan']> = { id: d.multicamId ?? d.id, label: d.name }
  if (d.deviceTypeId) plan.deviceTypeId = d.deviceTypeId
  if (o?.panGrad !== undefined) plan.pan = o.panGrad
  if (o?.neigungGrad !== undefined) plan.tilt = o.neigungGrad
  if (o?.brennweiteMm !== undefined) plan.focalMm = o.brennweiteMm
  if (o && (o.objektivModell || o.brennweiteMinMm !== undefined || o.brennweiteMaxMm !== undefined)) {
    plan.lens = {}
    if (o.objektivHersteller) plan.lens.manufacturer = o.objektivHersteller
    if (o.objektivModell) plan.lens.model = o.objektivModell
    if (o.brennweiteMinMm !== undefined) plan.lens.focalMinMm = o.brennweiteMinMm
    if (o.brennweiteMaxMm !== undefined) plan.lens.focalMaxMm = o.brennweiteMaxMm
  }
  if (presets.length) plan.presets = presets
  const hasSomething = plan.pan !== undefined || plan.tilt !== undefined || plan.lens || plan.presets
  return hasSomething ? plan : undefined
}

export interface SiteBuild {
  site: SiteFile
  /** Geraete-Id → vergebene Slot-Nummer, fuer die, die noch keine hatten. */
  assigned: Record<string, number>
  /** Kameras, die nicht mitkommen, mit Grund. */
  skipped: { id: string; name: string; reason: 'no-control-path' | 'no-address' }[]
}

/** Alle fernsteuerbaren Kameras des Projekts als Anlagendatei. */
export function buildSite(equipment: EquipmentItem[], siteName: string): SiteBuild {
  const cameras = equipment.filter(isCameraDevice)
  const used = new Set<number>()
  for (const c of cameras) if (c.bridgeCameraNumber && c.bridgeCameraNumber > 0) used.add(c.bridgeCameraNumber)
  let next = 1
  const nextFree = () => {
    while (used.has(next)) next += 1
    used.add(next)
    return next
  }
  const assigned: Record<string, number> = {}
  const skipped: SiteBuild['skipped'] = []
  const out: SiteCamera[] = []
  for (const c of cameras) {
    const config = cameraConfigOf(c)
    if (!config) {
      skipped.push({ id: c.id, name: c.name, reason: 'no-control-path' })
      continue
    }
    const mode = config.connectionMode as string
    const needsAddress = !['serial', 'visca-serial', 'sony-usb', 'dji-osmo', 'dji-ronin'].includes(mode)
    if (needsAddress && !c.ipAddress?.trim()) {
      skipped.push({ id: c.id, name: c.name, reason: 'no-address' })
      continue
    }
    let num = c.bridgeCameraNumber && c.bridgeCameraNumber > 0 ? c.bridgeCameraNumber : 0
    if (!num) {
      num = nextFree()
      assigned[c.id] = num
    }
    const plan = planOf(c)
    out.push({
      cameraNumber: num,
      config: { ...config, ccuId: num },
      autoConnect: true,
      ...(plan ? { plan, planMatchedBy: 'manual' as const } : {}),
    })
  }
  out.sort((a, b) => a.cameraNumber - b.cameraNumber)
  return { site: { kind: 'lz-site', formatVersion: 1, name: siteName, cameras: out, switchers: [] }, assigned, skipped }
}

/** Das Livebild eines Slots auf der Bruecke. */
export const bridgeVideoUrl = (bridge: { host: string; port: number }, cameraNumber: number): string =>
  `http://${bridge.host}:${bridge.port}/video/${cameraNumber}.mjpeg`

export const bridgeWsUrl = (bridge: { host: string; port: number }): string => `ws://${bridge.host}:${bridge.port}`
