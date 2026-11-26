// ───────────────────────────────────────────────────────────────────────────
// IS-04 einlesen: Registry-Antwort -> Bestandsaufnahme (#1240, Stufe 6).
//
// Angenommen werden
//   - die Antworten der Query API (`/nodes`, `/devices`, `/senders`,
//     `/receivers`, `/flows`) als ein Objekt mit diesen Schluesseln — so
//     liefert sie der Desktop-Abruf (`nmos:fetch-registry`),
//   - der NMOS-Export dieses Programms (Schluessel `is04`),
//   - eine einzelne Liste gemischter Ressourcen; die Art wird an den
//     Pflichtfeldern erkannt (IS-04-Schemas: ein Sender hat `flow_id` und
//     `transport`, ein Receiver `subscription.sender_id` …).
//
// Ergebnis ist ein Plan fuer die Vorschau: je IS-04-Device ein Geraet, je
// Sender ein Ausgang, je Receiver ein Eingang. Kabel entstehen NICHT: eine
// Registry weiss, wer wen abonniert hat, aber nicht, welches Kabel liegt.
// Geraete, deren UUID schon im Plan steht, werden gemeldet und nicht doppelt
// angelegt.
//
// REIN: keine Uhr, kein Store, kein IO. UUIDs fuer neue Geraete kommen von
// aussen (`newId`), damit der Test sie festhalten kann.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentItem, Port } from '../../types/equipment'
import type { SignalStandard } from '../../types/cableSpec'
import { MEDIA_TYPE, type Json, type Nmos2110Standard } from './is04'

export interface RegistryResources {
  nodes: Json[]
  devices: Json[]
  senders: Json[]
  receivers: Json[]
  flows: Json[]
}

const KEYS = ['nodes', 'devices', 'senders', 'receivers', 'flows'] as const

const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const arr = (v: unknown): Json[] => (Array.isArray(v) ? v.filter(isObj) : [])

/** Ressourcenart aus den Pflichtfeldern (IS-04 v1.3). */
const kindOf = (r: Json): (typeof KEYS)[number] | null => {
  if ('flow_id' in r && 'transport' in r) return 'senders'
  if (isObj(r.subscription) && 'sender_id' in r.subscription) return 'receivers'
  if ('node_id' in r && 'type' in r) return 'devices'
  if ('source_id' in r) return 'flows'
  if ('api' in r && 'href' in r) return 'nodes'
  return null
}

export class RegistryFormatError extends Error {}

/** Eine Registry-Antwort lesen. Wirft `RegistryFormatError`, wenn nichts davon passt. */
export const parseRegistry = (input: unknown): RegistryResources => {
  const out: RegistryResources = { nodes: [], devices: [], senders: [], receivers: [], flows: [] }
  const body = isObj(input) && isObj(input.is04) ? input.is04 : input
  if (Array.isArray(body)) {
    for (const r of arr(body)) {
      const k = kindOf(r)
      if (k) out[k].push(r)
    }
  } else if (isObj(body)) {
    for (const k of KEYS) out[k] = arr(body[k])
  }
  if (!out.devices.length) throw new RegistryFormatError('no-devices')
  return out
}

const STANDARD_BY_MEDIA: Record<string, Nmos2110Standard> = Object.fromEntries(
  Object.entries(MEDIA_TYPE).map(([std, mt]) => [mt, std as Nmos2110Standard]),
)

/** 2110-Standard aus dem Medientyp; L16/L20 sind ebenfalls 2110-30. */
export const standardForMediaType = (mt: string | undefined): SignalStandard | undefined => {
  if (!mt) return undefined
  if (/^audio\/L\d+$/.test(mt)) return 'ST2110-30'
  return STANDARD_BY_MEDIA[mt]
}

export interface ImportDevice {
  nmosId: string
  name: string
  nodeLabel?: string
  ipAddress?: string
  senders: { id: string; label: string; standard?: SignalStandard }[]
  receivers: { id: string; label: string; standard?: SignalStandard }[]
  /** Steht schon im Plan (gleiche UUID). */
  existing: boolean
}

export interface Is04ImportPreview {
  devices: ImportDevice[]
  /** Sender/Receiver ohne bekanntes Device. */
  orphans: number
}

const IPV4 = /^(\d{1,3})(\.\d{1,3}){3}$/

export const previewRegistry = (reg: RegistryResources, existing: readonly Pick<EquipmentItem, 'nmosId'>[]): Is04ImportPreview => {
  const known = new Set(existing.map((e) => e.nmosId).filter(Boolean))
  const nodes = new Map(reg.nodes.map((n) => [str(n.id), n]))
  const flows = new Map(reg.flows.map((f) => [str(f.id), f]))
  const ids = new Set(reg.devices.map((d) => str(d.id)))
  const devices: ImportDevice[] = reg.devices
    .filter((d) => str(d.id))
    .map((d) => {
      const id = str(d.id)
      const node = nodes.get(str(d.node_id))
      const api = isObj(node?.api) ? node.api : undefined
      const host = str(arr(api?.endpoints)[0]?.host)
      return {
        nmosId: id,
        name: str(d.label) || str(node?.label) || id,
        ...(node && str(node.label) ? { nodeLabel: str(node.label) } : {}),
        ...(IPV4.test(host) ? { ipAddress: host } : {}),
        senders: reg.senders
          .filter((s) => str(s.device_id) === id)
          .map((s) => ({
            id: str(s.id),
            label: str(s.label) || str(s.id),
            standard: standardForMediaType(str(flows.get(str(s.flow_id))?.media_type)),
          })),
        receivers: reg.receivers
          .filter((r) => str(r.device_id) === id)
          .map((r) => ({
            id: str(r.id),
            label: str(r.label) || str(r.id),
            standard: standardForMediaType(
              isObj(r.caps) && Array.isArray(r.caps.media_types) ? str(r.caps.media_types[0]) : undefined,
            ),
          })),
        existing: known.has(id),
      }
    })
  const orphans = [...reg.senders, ...reg.receivers].filter((r) => !ids.has(str(r.device_id))).length
  return { devices, orphans }
}

const NODE_WIDTH = 260
const nodeHeight = (n: number) => 80 + Math.max(n, 3) * 22

/** Neue Geraete aus der Vorschau, in einem Raster ab `origin`. Vorhandene bleiben unberuehrt. */
export const equipmentFromPreview = (
  preview: Is04ImportPreview,
  selected: ReadonlySet<string>,
  origin: { x: number; y: number },
  newId: () => string,
): EquipmentItem[] => {
  const port = (p: { id: string; label: string; standard?: SignalStandard }, direction: 'in' | 'out'): Port => ({
    id: newId(),
    name: p.label,
    originalName: p.label,
    type: 'SFP',
    connectorType: 'SFP',
    direction,
    ...(p.standard ? { standard: p.standard } : {}),
    nmosId: p.id,
  })
  return preview.devices
    .filter((d) => !d.existing && selected.has(d.nmosId))
    .map((d, i) => {
      const inputs = d.receivers.map((r) => port(r, 'in'))
      const outputs = d.senders.map((s) => port(s, 'out'))
      return {
        id: newId(),
        name: d.name,
        ...(d.nodeLabel && d.nodeLabel !== d.name ? { subtitle: d.nodeLabel } : {}),
        category: 'Other',
        inputs,
        outputs,
        x: origin.x + (i % 4) * (NODE_WIDTH + 60),
        y: origin.y + Math.floor(i / 4) * 320,
        width: NODE_WIDTH,
        height: nodeHeight(Math.max(inputs.length, outputs.length)),
        ...(d.ipAddress ? { ipAddress: d.ipAddress } : {}),
        importSource: 'nmos' as const,
        nmosId: d.nmosId,
      }
    })
}
