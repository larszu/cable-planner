// ───────────────────────────────────────────────────────────────────────────
// IS-05-Soll-Verbindungen aus dem Plan (#1240, Stufe 6).
//
// Ausgabe ist der Rumpf von `POST /x-nmos/connection/v1.2/bulk/receivers`:
// je Receiver `{ id, params }`, `params` wie `PATCH .../staged` mit
// `sender_id`, `master_enable` und `activation`. Ein Broadcast-Controller
// oder die Bridge spielt ihn ein — das ist „Job vorbereiten“ fuer IP.
//
// WOHER DER SENDER KOMMT. Vom Receiver aus rueckwaerts am Kabel entlang:
//   - Am anderen Ende ein 2110-Sender: das ist er.
//   - Eine Kreuzschiene: ueber ihren geplanten Kreuzpunkt weiter zum Eingang
//     und von dort wieder ans Kabel (mehrere Stufen moeglich).
//   - Ein Switch oder ein Ausgang ohne Kreuzpunkt: offen. Der Receiver wird
//     dann NICHT mit einem geratenen Sender ausgegeben, sondern als offen
//     gemeldet.
//
// SALVOS. Ein Salvo an einer Kreuzschiene wird ein eigenes Bulk-Paket: die
// Kreuzpunkte des Salvos, angewandt auf den Plan, ergeben die Receiver, die
// gemeinsam umschalten. Aktivierung `activate_immediate`; ein Controller,
// der gleichzeitige Umschaltung ueber mehrere Geraete braucht, setzt
// `activate_scheduled_absolute` mit seiner Zeit (IS-05, Behaviour:
// „Scheduled activations“). Die Zeit kennt nur er.
//
// MULTICAST. Hat der Multicast-Plan dem Sender Gruppen vergeben, gehen sie
// als `transport_params` mit (ein Eintrag je Bein, ST 2022-7). Sonst fehlt
// das Feld, und der Receiver nimmt die Gruppe aus dem SDP des Senders.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { CablePlannerProject } from '../../types/project'
import type { EquipmentItem } from '../../types/equipment'
import { deviceCrosspoints } from '../deviceCrosspoints'
import { flowKey } from '../multicastPlan'
import { VIDEO_LEVEL } from '../switching/matrix'
import { portDisplayLabel } from '../portLabel'
import { portKey, type Json, type NmosPlan, type NmosPortRef } from './is04'

export type ActivationMode = 'activate_immediate' | null

export interface Is05Open {
  receiverId: string
  /** „Monitor 1 · IP IN 1“. */
  label: string
  reason: 'no-cable' | 'switch' | 'no-crosspoint' | 'no-sender'
}

export interface Is05Salvo {
  id: string
  name: string
  device: string
  bulkReceivers: Json[]
}

export interface Is05Export {
  /** Rumpf fuer `POST /bulk/receivers`. */
  bulkReceivers: Json[]
  salvos: Is05Salvo[]
  open: Is05Open[]
}

type Crosspoints = ReadonlyMap<string, string>

interface Graph {
  byId: ReadonlyMap<string, EquipmentItem>
  /** Ziel-Anschluss -> Quell-Anschluss des Kabels. */
  feeding: ReadonlyMap<string, { eq: string; port: string }>
  /** Quell-Anschluss -> Ziel-Anschluesse. */
  fedTo: ReadonlyMap<string, { eq: string; port: string }[]>
}

const graphOf = (project: CablePlannerProject): Graph => {
  const feeding = new Map<string, { eq: string; port: string }>()
  const fedTo = new Map<string, { eq: string; port: string }[]>()
  for (const c of project.cables) {
    feeding.set(portKey(c.toEquipmentId, c.toPortId), { eq: c.fromEquipmentId, port: c.fromPortId })
    const k = portKey(c.fromEquipmentId, c.fromPortId)
    fedTo.set(k, [...(fedTo.get(k) ?? []), { eq: c.toEquipmentId, port: c.toPortId }])
  }
  return { byId: new Map(project.equipment.map((e) => [e.id, e])), feeding, fedTo }
}

type Resolved = { sender: NmosPortRef } | { reason: Is05Open['reason'] }

/**
 * Den Sender fuer einen Eingang suchen. `override` ersetzt die Kreuzpunkte
 * einer Kreuzschiene (fuer Salvos).
 */
const resolveSender = (
  plan: NmosPlan,
  g: Graph,
  eq: string,
  port: string,
  override?: { device: string; crosspoints: Crosspoints },
  seen = new Set<string>(),
): Resolved => {
  const from = g.feeding.get(portKey(eq, port))
  if (!from) return { reason: 'no-cable' }
  const sender = plan.senders.get(portKey(from.eq, from.port))
  if (sender) return { sender }
  const dev = g.byId.get(from.eq)
  if (!dev || !plan.transit.has(dev.id)) return { reason: 'no-sender' }
  if (seen.has(dev.id)) return { reason: 'no-crosspoint' }
  const xp = override?.device === dev.id ? override.crosspoints : deviceCrosspoints(dev)
  const input = xp.get(from.port)
  if (!input) return { reason: deviceCrosspoints(dev).size || override ? 'no-crosspoint' : 'switch' }
  return resolveSender(plan, g, dev.id, input, override, new Set([...seen, dev.id]))
}

const stageParams = (project: CablePlannerProject, sender: NmosPortRef, activation: ActivationMode): Json => {
  const legs = (project.multicast?.assignments ?? [])
    .filter((a) => a.flowKey === flowKey(sender.equipmentId, sender.portId))
    .sort((a, b) => a.leg.localeCompare(b.leg))
  return {
    sender_id: sender.id,
    master_enable: true,
    activation: { mode: activation },
    ...(legs.length
      ? {
          transport_params: legs.map((l) => ({
            multicast_ip: l.address,
            destination_port: l.port,
            interface_ip: 'auto',
            rtp_enabled: true,
          })),
        }
      : {}),
  }
}

const receiverLabel = (g: Graph, r: NmosPortRef): string => {
  const d = g.byId.get(r.equipmentId)
  const p = d?.inputs.find((x) => x.id === r.portId)
  return `${d?.name ?? r.equipmentId} · ${p ? portDisplayLabel(p) : r.portId}`
}

/** Receiver hinter einem Kreuzschienen-Ausgang (direkt am Kabel). */
const receiversBehind = (plan: NmosPlan, g: Graph, eq: string, port: string): NmosPortRef[] =>
  (g.fedTo.get(portKey(eq, port)) ?? [])
    .map((t) => plan.receivers.get(portKey(t.eq, t.port)))
    .filter((r): r is NmosPortRef => !!r)

/** Kreuzpunkte eines Salvos als `Ausgang -> Eingang` (Port-IDs). */
const salvoCrosspoints = (dev: EquipmentItem): { id: string; name: string; xp: Crosspoints }[] => {
  const out: { id: string; name: string; xp: Crosspoints }[] = []
  for (const s of dev.switching?.salvos ?? []) {
    const video = s.crosspoints[VIDEO_LEVEL] ?? {}
    out.push({ id: s.id, name: s.name, xp: new Map(Object.entries(video)) })
  }
  for (const s of dev.videohubRouting?.salvos ?? []) {
    const xp = new Map<string, string>()
    for (const [o, i] of Object.entries(s.routing)) {
      const outId = dev.outputs[Number(o)]?.id
      const inId = dev.inputs[i]?.id
      if (outId && inId) xp.set(outId, inId)
    }
    out.push({ id: s.id, name: s.name, xp })
  }
  return out
}

export const buildIs05 = (
  project: CablePlannerProject,
  plan: NmosPlan,
  activation: ActivationMode = 'activate_immediate',
): Is05Export => {
  const g = graphOf(project)
  const bulkReceivers: Json[] = []
  const open: Is05Open[] = []
  for (const r of plan.receivers.values()) {
    const res = resolveSender(plan, g, r.equipmentId, r.portId)
    if ('sender' in res) bulkReceivers.push({ id: r.id, params: stageParams(project, res.sender, activation) })
    else if (res.reason !== 'no-cable') open.push({ receiverId: r.id, label: receiverLabel(g, r), reason: res.reason })
  }

  const salvos: Is05Salvo[] = []
  for (const dev of project.equipment) {
    if (!plan.transit.has(dev.id)) continue
    for (const s of salvoCrosspoints(dev)) {
      const merged = new Map(deviceCrosspoints(dev))
      for (const [o, i] of s.xp) merged.set(o, i)
      const entries: Json[] = []
      for (const outId of s.xp.keys()) {
        for (const r of receiversBehind(plan, g, dev.id, outId)) {
          const res = resolveSender(plan, g, r.equipmentId, r.portId, { device: dev.id, crosspoints: merged })
          if ('sender' in res) entries.push({ id: r.id, params: stageParams(project, res.sender, activation) })
        }
      }
      if (entries.length) salvos.push({ id: s.id, name: s.name, device: dev.name, bulkReceivers: entries })
    }
  }
  return { bulkReceivers, salvos, open }
}
