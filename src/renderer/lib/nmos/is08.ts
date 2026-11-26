// ───────────────────────────────────────────────────────────────────────────
// IS-08-Kanalzuordnung aus dem Plan (#1240, Stufe 6).
//
// Zwei Quellen im Plan tragen Audio-Shuffling:
//   - Die Audio-Matrix eines ATEM (`atemAudioConfig.matrix`): jede Quelle ein
//     IS-08-Input, jeder Ausgang ein Output, die Belegung die Map.
//   - Die Audio-Ebenen einer Kreuzschiene (`switching.levels` ausser Video):
//     jeder Anschluss ein Input bzw. Output mit einem Kanal je Ebene. Ein
//     Breakaway ist dann genau das, was IS-08 ausdrueckt: Kanal n des
//     Ausgangs kommt von Kanal n eines anderen Eingangs.
//
// Ausgabe je Geraet: die `io`-Sicht (`GET /x-nmos/channelmapping/v1.0/io`)
// und der Rumpf fuer `POST /map/activations` mit `activate_immediate`.
// Inputs und Outputs sind in IS-08 geraete-lokal, ihre IDs frei
// (`^[a-zA-Z0-9-_]+$`); hier aus ATEM-Quellen-ID bzw. Anschlussnummer.
//
// ANNAHME ATEM: ein Eintrag der Matrix ist EIN Kanal. Das Profil-XML fuehrt
// Paare als eine Quelle; eine Zuordnung verschiebt sie gemeinsam, also ist
// die Einheit dieselbe.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { CablePlannerProject } from '../../types/project'
import type { EquipmentItem } from '../../types/equipment'
import { portDisplayLabel } from '../portLabel'
import { VIDEO_LEVEL } from '../switching/matrix'
import { switchingProfileFor } from '../switching/state'
import type { Json } from './is04'

export interface Is08Device {
  /** Plan-ID des Geraets. */
  equipmentId: string
  device: string
  kind: 'atem-audio' | 'router-levels'
  /** `GET /io` */
  io: Json
  /** `POST /map/activations` */
  activation: Json
}

type MapEntry = { input: string | null; channel_index: number | null }

const UNROUTED: MapEntry = { input: null, channel_index: null }

const props = (name: string, description = '') => ({ name, description })

const atemAudio = (d: EquipmentItem): Is08Device | null => {
  const m = d.atemAudioConfig?.matrix
  if (!m || (!m.sources.length && !m.outputs.length)) return null
  const inputs: Json = {}
  for (const s of m.sources) {
    inputs[`src-${s.id}`] = {
      properties: props(s.name || `Source ${s.id}`),
      parent: { id: null, type: null },
      channels: [{ label: s.name || `Source ${s.id}` }],
      caps: { reordering: false, block_size: 1 },
    }
  }
  const outputs: Json = {}
  const map: Record<string, Record<string, MapEntry>> = {}
  for (const o of m.outputs) {
    const id = `out-${o.id}`
    outputs[id] = {
      properties: props(o.name || `Output ${o.id}`),
      source_id: null,
      channels: [{ label: o.name || `Output ${o.id}` }],
      caps: { routable_inputs: null },
    }
    const src = m.sources.find((s) => s.id === o.sourceId)
    map[id] = { '0': src ? { input: `src-${src.id}`, channel_index: 0 } : UNROUTED }
  }
  return {
    equipmentId: d.id,
    device: d.name,
    kind: 'atem-audio',
    io: { inputs, outputs },
    activation: { activation: { mode: 'activate_immediate' }, action: map },
  }
}

const routerLevels = (d: EquipmentItem): Is08Device | null => {
  const tables = d.switching?.levels ?? {}
  const defined = (switchingProfileFor(d)?.levels ?? []).filter((l) => l.id !== VIDEO_LEVEL)
  const ids = [...new Set([...defined.map((l) => l.id), ...Object.keys(tables).filter((l) => l !== VIDEO_LEVEL)])]
  if (!ids.length || !Object.values(tables).some((t) => Object.keys(t).length)) return null
  const labelOf = (id: string) => defined.find((l) => l.id === id)?.label ?? id
  const inIdx = new Map(d.inputs.map((p, i) => [p.id, i + 1]))
  const channels = ids.map((l) => ({ label: labelOf(l) }))

  const inputs: Json = {}
  d.inputs.forEach((p, i) => {
    inputs[`in-${i + 1}`] = {
      properties: props(portDisplayLabel(p)),
      parent: { id: null, type: null },
      channels,
      caps: { reordering: true, block_size: 1 },
    }
  })
  const outputs: Json = {}
  const map: Record<string, Record<string, MapEntry>> = {}
  d.outputs.forEach((p, i) => {
    const id = `out-${i + 1}`
    outputs[id] = { properties: props(portDisplayLabel(p)), source_id: null, channels, caps: { routable_inputs: null } }
    const row: Record<string, MapEntry> = {}
    ids.forEach((l, ch) => {
      const src = tables[l]?.[p.id]
      const n = src ? inIdx.get(src) : undefined
      row[String(ch)] = n ? { input: `in-${n}`, channel_index: ch } : UNROUTED
    })
    map[id] = row
  })
  return {
    equipmentId: d.id,
    device: d.name,
    kind: 'router-levels',
    io: { inputs, outputs },
    activation: { activation: { mode: 'activate_immediate' }, action: map },
  }
}

export const buildIs08 = (project: Pick<CablePlannerProject, 'equipment'>): Is08Device[] => {
  const out: Is08Device[] = []
  for (const d of project.equipment) {
    const a = atemAudio(d)
    if (a) out.push(a)
    const r = routerLevels(d)
    if (r) out.push(r)
  }
  return out
}
