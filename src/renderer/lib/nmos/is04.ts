// ───────────────────────────────────────────────────────────────────────────
// IS-04 aus dem Plan (#1240, Stufe 6). Konzept: docs/konzept-mischer-
// kreuzschienen-simulation.md §6.
//
// Der Plan beschreibt eine 2110-Anlage als Ressourcen-Inventar nach AMWA
// IS-04 v1.3 (Node -> Device -> Source -> Flow -> Sender, Receiver). Jedes
// Geraet mit mindestens einem ST-2110-Anschluss wird Node und Device; jeder
// 2110-Ausgang Source, Flow und Sender, jeder 2110-Eingang Receiver.
//
// WAS NICHT NMOS-GERAET WIRD:
//   - Netzwerk-Switches. Sie leiten Multicast weiter, sind aber kein Sender
//     und kein Empfaenger.
//   - Kreuzschienen mit 2110-Anschluessen. In einer IP-Anlage ist die
//     Kreuzschiene das Netz: „Ausgang 3 <- Eingang 7“ heisst „der Receiver am
//     Kabel von Ausgang 3 abonniert den Sender am Kabel in Eingang 7“. Der
//     Kreuzpunkt wird deshalb zur IS-05-Verbindung (`is05.ts`), die
//     Kreuzschiene selbst taucht im Inventar nicht auf.
//
// WAS DER PLAN NICHT WEISS UND DESHALB NICHT BEHAUPTET:
//   - Die Node-API-Adresse: `href` ist Pflicht, kennt der Plan die IP nicht,
//     steht `http://0.0.0.0/` und `api.endpoints` bleibt leer.
//   - PTP-Grandmaster: der Node meldet eine interne Uhr. Die Domaene steht im
//     PTP-Plan, die gmid kennt erst das laufende Netz.
//   - Kanalzahl eines Audio-Flows: ANNAHME zwei Kanaele (Stereo), solange der
//     Anschluss nichts anderes sagt.
//   - Bildrate: die Nennrate des Formats (59,94 als 60/1), wie in `st2110.ts`.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { CablePlannerProject } from '../../types/project'
import type { EquipmentItem, Port } from '../../types/equipment'
import type { SignalStandard } from '../../types/cableSpec'
import { DEFAULT_VIDEO_FORMAT, type VideoFormatId } from '../../types/videoFormat'
import { detectNetworkDevice } from '../deviceKind'
import { deviceCrosspoints } from '../deviceCrosspoints'
import { deviceInterfaces } from '../networkInterfaces'
import { portDisplayLabel } from '../portLabel'
import { st2110Raster } from '../st2110'
import { switchingProfileFor } from '../switching/state'
import { nmosId, taiVersion } from './ids'

export type Json = Record<string, unknown>

export type Nmos2110Standard = 'ST2110-20' | 'ST2110-22' | 'ST2110-30' | 'ST2110-31' | 'ST2110-40'

export const isNmosStandard = (s: SignalStandard | undefined): s is Nmos2110Standard =>
  s === 'ST2110-20' || s === 'ST2110-22' || s === 'ST2110-30' || s === 'ST2110-31' || s === 'ST2110-40'

export interface Is04Resources {
  nodes: Json[]
  devices: Json[]
  sources: Json[]
  flows: Json[]
  senders: Json[]
  receivers: Json[]
}

/** Ein 2110-Anschluss im Plan und seine NMOS-Kennung. */
export interface NmosPortRef {
  equipmentId: string
  portId: string
  standard: Nmos2110Standard
  /** Sender- bzw. Receiver-UUID. */
  id: string
}

export interface NmosPlan {
  projectKey: string
  resources: Is04Resources
  /** `<equipmentId>:<portId>` des Ausgangs -> Sender. */
  senders: ReadonlyMap<string, NmosPortRef>
  /** `<equipmentId>:<portId>` des Eingangs -> Receiver. */
  receivers: ReadonlyMap<string, NmosPortRef>
  /** Geraete, die als Netz gelten (Switch, Kreuzschiene) — nicht im Inventar. */
  transit: ReadonlySet<string>
}

export const portKey = (equipmentId: string, portId: string) => `${equipmentId}:${portId}`

export const projectKeyOf = (project: Pick<CablePlannerProject, 'metadata'>): string =>
  project.metadata.projectId || project.metadata.name || 'project'

/** Gilt das Geraet als Kreuzschiene? Profil sagt es, sonst geplante Kreuzpunkte an einem Nicht-Mischer. */
export const isRouterDevice = (d: EquipmentItem): boolean => {
  const role = switchingProfileFor(d)?.role
  if (role) return role === 'router'
  return deviceCrosspoints(d).size > 0 && !d.atemAudioConfig
}

const FORMAT_URN = {
  video: 'urn:x-nmos:format:video',
  audio: 'urn:x-nmos:format:audio',
  data: 'urn:x-nmos:format:data',
} as const

const formatOf = (s: Nmos2110Standard): keyof typeof FORMAT_URN =>
  s === 'ST2110-20' || s === 'ST2110-22' ? 'video' : s === 'ST2110-40' ? 'data' : 'audio'

/** Medientyp nach NMOS-Parameter-Register. */
export const MEDIA_TYPE: Readonly<Record<Nmos2110Standard, string>> = {
  'ST2110-20': 'video/raw',
  'ST2110-22': 'video/jxsv',
  'ST2110-30': 'audio/L24',
  'ST2110-31': 'audio/AM824',
  'ST2110-40': 'video/smpte291',
}

const TRANSPORT = 'urn:x-nmos:transport:rtp.mcast'
const CLOCK = 'clk0'
const AUDIO_CHANNELS = 2

/** MAC im IS-04-Format `aa-bb-cc-dd-ee-ff`, sonst `null`. */
const nmosMac = (mac: string | undefined): string | null => {
  const hex = (mac ?? '').toLowerCase().replace(/[^0-9a-f]/g, '')
  return hex.length === 12 ? hex.match(/../g)!.join('-') : null
}

/** Standard eines Anschlusses: am Port deklariert, sonst vom ersten Kabel daran. */
const portStandards = (project: CablePlannerProject) => {
  const fromCable = new Map<string, SignalStandard>()
  for (const c of project.cables) {
    if (!c.standard) continue
    for (const k of [portKey(c.fromEquipmentId, c.fromPortId), portKey(c.toEquipmentId, c.toPortId)])
      if (!fromCable.has(k)) fromCable.set(k, c.standard)
  }
  return (d: EquipmentItem, p: Port): Nmos2110Standard | null => {
    const s = p.standard ?? fromCable.get(portKey(d.id, p.id))
    return isNmosStandard(s) ? s : null
  }
}

const core = (id: string, version: string, label: string, description = ''): Json => ({
  id,
  version,
  label,
  description,
  tags: {},
})

const videoFlowFields = (format: VideoFormatId, s: Nmos2110Standard): Json => {
  const [w, h, fps] = st2110Raster(format) ?? st2110Raster(DEFAULT_VIDEO_FORMAT)!
  const base: Json = {
    format: FORMAT_URN.video,
    frame_width: w,
    frame_height: h,
    colorspace: h >= 2160 ? 'BT2020' : 'BT709',
    interlace_mode: format.includes('i') && !format.includes('x') ? 'interlaced_tff' : 'progressive',
    grain_rate: { numerator: fps, denominator: 1 },
    media_type: MEDIA_TYPE[s],
  }
  if (s === 'ST2110-20') {
    base.components = [
      { name: 'Y', width: w, height: h, bit_depth: 10 },
      { name: 'Cb', width: w / 2, height: h, bit_depth: 10 },
      { name: 'Cr', width: w / 2, height: h, bit_depth: 10 },
    ]
  }
  return base
}

/** Das IS-04-Inventar und die Zuordnung Anschluss -> Sender/Receiver. */
export const buildNmosPlan = (project: CablePlannerProject, at: Date): NmosPlan => {
  const key = projectKeyOf(project)
  const version = taiVersion(at)
  const stdOf = portStandards(project)
  const format = project.metadata.defaultVideoFormat ?? DEFAULT_VIDEO_FORMAT
  const res: Is04Resources = { nodes: [], devices: [], sources: [], flows: [], senders: [], receivers: [] }
  const senders = new Map<string, NmosPortRef>()
  const receivers = new Map<string, NmosPortRef>()
  const transit = new Set<string>()

  for (const d of project.equipment) {
    const outs = d.outputs.map((p) => [p, stdOf(d, p)] as const).filter((x): x is [Port, Nmos2110Standard] => !!x[1])
    const ins = d.inputs.map((p) => [p, stdOf(d, p)] as const).filter((x): x is [Port, Nmos2110Standard] => !!x[1])
    if (outs.length + ins.length === 0) continue
    if (detectNetworkDevice(d) === 'switch' || isRouterDevice(d)) {
      transit.add(d.id)
      continue
    }

    const nodeId = nmosId(key, 'node', d.id)
    const deviceId = nmosId(key, 'device', d.id)
    const nics = deviceInterfaces(d)
    const interfaces = nics
      .map((n, i) => ({ n, mac: nmosMac(n.macAddress), name: n.label || (i === 0 ? 'eth0' : `eth${i}`) }))
      .filter((x) => x.mac)
      .map((x) => ({ name: x.name, chassis_id: x.mac, port_id: x.mac, role: x.n.role }))
    const media = interfaces.filter((i) => i.role === 'media-primary' || i.role === 'media-secondary')
    const bindings = (media.length ? media : interfaces.slice(0, 1)).map((i) => i.name)
    const ip = d.ipAddress?.trim()

    res.nodes.push({
      ...core(nodeId, version, d.name),
      href: `http://${ip || '0.0.0.0'}/`,
      caps: {},
      api: { versions: ['v1.3'], endpoints: ip ? [{ host: ip, port: 80, protocol: 'http' }] : [] },
      services: [],
      clocks: [{ name: CLOCK, ref_type: 'internal' }],
      interfaces: interfaces.map(({ name, chassis_id, port_id }) => ({ name, chassis_id, port_id })),
    })

    const deviceSenders: string[] = []
    const deviceReceivers: string[] = []

    for (const [p, s] of outs) {
      const label = portDisplayLabel(p)
      const sourceId = nmosId(key, 'source', d.id, p.id)
      const flowId = nmosId(key, 'flow', d.id, p.id)
      const senderId = nmosId(key, 'sender', d.id, p.id)
      const fmt = formatOf(s)
      const source: Json = { ...core(sourceId, version, label), caps: {}, device_id: deviceId, parents: [], clock_name: CLOCK, format: FORMAT_URN[fmt] }
      if (fmt === 'audio')
        source.channels = Array.from({ length: AUDIO_CHANNELS }, (_, i) => ({ label: `Channel ${i + 1}` }))
      res.sources.push(source)

      const flowBase = { ...core(flowId, version, label), source_id: sourceId, device_id: deviceId, parents: [] }
      if (fmt === 'video') res.flows.push({ ...flowBase, ...videoFlowFields(format, s) })
      else if (fmt === 'audio')
        res.flows.push({
          ...flowBase,
          format: FORMAT_URN.audio,
          sample_rate: { numerator: 48000, denominator: 1 },
          media_type: MEDIA_TYPE[s],
          ...(s === 'ST2110-30' ? { bit_depth: 24 } : {}),
        })
      else res.flows.push({ ...flowBase, format: FORMAT_URN.data, media_type: MEDIA_TYPE[s] })

      res.senders.push({
        ...core(senderId, version, label),
        flow_id: flowId,
        transport: TRANSPORT,
        device_id: deviceId,
        manifest_href: null,
        interface_bindings: bindings,
        subscription: { receiver_id: null, active: false },
      })
      deviceSenders.push(senderId)
      senders.set(portKey(d.id, p.id), { equipmentId: d.id, portId: p.id, standard: s, id: senderId })
    }

    for (const [p, s] of ins) {
      const receiverId = nmosId(key, 'receiver', d.id, p.id)
      res.receivers.push({
        ...core(receiverId, version, portDisplayLabel(p)),
        device_id: deviceId,
        transport: TRANSPORT,
        interface_bindings: bindings,
        subscription: { sender_id: null, active: false },
        format: FORMAT_URN[formatOf(s)],
        caps: { media_types: [MEDIA_TYPE[s]] },
      })
      deviceReceivers.push(receiverId)
      receivers.set(portKey(d.id, p.id), { equipmentId: d.id, portId: p.id, standard: s, id: receiverId })
    }

    res.devices.push({
      ...core(deviceId, version, d.name, d.subtitle ?? ''),
      type: 'urn:x-nmos:device:generic',
      node_id: nodeId,
      senders: deviceSenders,
      receivers: deviceReceivers,
      controls: [],
    })
  }

  return { projectKey: key, resources: res, senders, receivers, transit }
}
