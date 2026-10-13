/**
 * ATEM-Eingangslabel folgt der Videohub-Route — welche Verbindungen es gibt.
 *
 * Wird am Videohub umgeschaltet, soll der ATEM-Eingang, an dem der Ausgang
 * hängt, den Namen der neuen Quelle tragen. WELCHER Ausgang an WELCHEM
 * Eingang hängt, sagt allein der Kabelgraph (rückwärts vom ATEM-Eingang,
 * durch Patchblenden und eindeutige Durchleiter). Geräte zählen nur mit
 * ERKLÄRTEM Steuerprotokoll — aus einem Gerätenamen auf einen Mischer zu
 * schliessen, verbietet ADR-002, und hier ginge der Fehler in die teure
 * Richtung: ein fremder Eingang bekäme einen falschen Namen auf Sendung.
 *
 * Was fehlt (IP, Quellen-Nummer), wird als Hinweis an der Zeile genannt,
 * nicht als Sperre für die übrigen.
 *
 * REIN: kein Store, kein IO.
 */
import type { Cable } from '../types/cable'
import type { EquipmentItem, Port } from '../types/equipment'
import { PROTOCOL_INFO } from '../types/switcherControl'
import { detectDeviceKind } from './deviceKind'
import { buildGraphContext, feedingInput, istBildEingang } from './labelDerivation'

/** Struktur-gleich mit `src/main/services/atemLabelFollow/core.ts`. */
export interface LabelFollowLink {
  hubHost: string
  hubPort: number
  hubOutput: number
  atemHost: string
  atemInput: number
}

/** Struktur-gleich mit `src/main/services/atemLabelFollow/follower.ts`. */
export interface FollowStatus {
  running: boolean
  hubs: { key: string; connected: boolean }[]
  log: string[]
}

/** Am Videohub gespeichert: ob seine Ausgänge die ATEM-Labels setzen dürfen. */
export interface LabelFollowConfig {
  enabled: boolean
  /** Ausgänge (Port-IDs), die ausdrücklich NICHT folgen. */
  excludedOutputs?: string[]
}

export type LabelFollowHinweis = 'hub-ip' | 'atem-ip' | 'atem-input'

export interface LabelFollowRow {
  hubId: string
  hubName: string
  hubOutputPortId: string
  hubOutputName: string
  atemId: string
  atemName: string
  atemInputName: string
  /** Quellen-Nummer am ATEM, wenn erklärt. */
  atemInput: number | null
  excluded: boolean
  hinweis: LabelFollowHinweis | null
  link: LabelFollowLink | null
}

const MAX_HOPS = 8

/** Die Quellen-Nummer: erklärt am Anschluss, nie aus der Position. */
const atemQuelle = (port: Port): number | null => {
  if (port.control?.role === 'input' && port.control.address > 0) return port.control.address
  if (typeof port.atemSourceId === 'number' && port.atemSourceId > 0) return port.atemSourceId
  return null
}

/** Rückwärts vom ATEM-Eingang bis zum ersten Gerät mit eigener Rolle. */
const hubAusgang = (
  atemInputPortId: string,
  ctx: ReturnType<typeof buildGraphContext>,
): { hub: EquipmentItem; output: Port } | null => {
  let ref = ctx.links.get(atemInputPortId)?.[0]
  const visited = new Set<string>([atemInputPortId])
  for (let hops = 0; ref && hops < MAX_HOPS; hops += 1) {
    const device = ctx.eqById.get(ref.equipmentId)
    const port = ctx.portById.get(ref.portId)
    if (!device || !port || visited.has(ref.portId)) return null
    visited.add(ref.portId)
    if (device.controlProtocol === 'videohub') {
      return device.outputs.some((p) => p.id === port.id) ? { hub: device, output: port } : null
    }
    // Ein Router ohne erklärtes Protokoll ist das Ende: hinter ihm entscheidet
    // die Laufzeit-Route, und die kennt nur ein Hub, mit dem wir sprechen.
    if (detectDeviceKind(device) !== null) return null
    const next = feedingInput(device, port)
    if (!next || visited.has(next.id)) return null
    visited.add(next.id)
    ref = ctx.links.get(next.id)?.find((r) => !visited.has(r.portId))
  }
  return null
}

export const labelFollowConfig = (hub: EquipmentItem): LabelFollowConfig =>
  hub.labelFollow ?? { enabled: false }

/** Alle Verbindungen Videohub-Ausgang -> ATEM-Eingang im Plan. */
export const labelFollowRows = (
  equipment: readonly EquipmentItem[],
  cables: readonly Cable[],
): LabelFollowRow[] => {
  const ctx = buildGraphContext([...equipment], [...cables])
  const rows: LabelFollowRow[] = []
  for (const atem of equipment) {
    if (atem.controlProtocol !== 'atem') continue
    const atemHost = atem.ipAddress?.trim() ?? ''
    for (const input of atem.inputs) {
      if (!istBildEingang(input)) continue
      const treffer = hubAusgang(input.id, ctx)
      if (!treffer) continue
      const { hub, output } = treffer
      const hubHost = hub.ipAddress?.trim() ?? ''
      const hubOutput = hub.outputs.findIndex((p) => p.id === output.id)
      const atemInput = atemQuelle(input)
      const excluded = labelFollowConfig(hub).excludedOutputs?.includes(output.id) ?? false
      const hinweis: LabelFollowHinweis | null = !hubHost
        ? 'hub-ip'
        : !atemHost
          ? 'atem-ip'
          : atemInput === null
            ? 'atem-input'
            : null
      rows.push({
        hubId: hub.id,
        hubName: hub.name,
        hubOutputPortId: output.id,
        hubOutputName: output.name,
        atemId: atem.id,
        atemName: atem.name,
        atemInputName: input.name,
        atemInput,
        excluded,
        hinweis,
        link:
          hinweis === null && atemInput !== null
            ? {
                hubHost,
                hubPort: hub.controlPort ?? PROTOCOL_INFO.videohub.defaultPort,
                hubOutput,
                atemHost,
                atemInput,
              }
            : null,
      })
    }
  }
  return rows
}

/** Was tatsächlich folgt: eingeschaltet, nicht ausgenommen, vollständig. */
export const labelFollowLinks = (
  equipment: readonly EquipmentItem[],
  cables: readonly Cable[],
): LabelFollowLink[] => {
  const enabled = new Set(
    equipment.filter((e) => e.controlProtocol === 'videohub' && labelFollowConfig(e).enabled).map((e) => e.id),
  )
  return labelFollowRows(equipment, cables)
    .filter((r) => enabled.has(r.hubId) && !r.excluded && r.link)
    .map((r) => r.link as LabelFollowLink)
}

/** Normalisiert den gespeicherten Wert; Unbrauchbares fällt weg. */
export const normaliseLabelFollow = (raw: unknown): LabelFollowConfig | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const excluded = Array.isArray(r.excludedOutputs)
    ? r.excludedOutputs.filter((v): v is string => typeof v === 'string')
    : []
  return { enabled: r.enabled === true, ...(excluded.length ? { excludedOutputs: excluded } : {}) }
}
