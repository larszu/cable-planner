// ───────────────────────────────────────────────────────────────────────────
// Den Emulator mit dem Plan abgleichen (#1240, Stufe 5).
//
// In beide Richtungen, aber nur mit dem, was sich geaendert hat:
//  - Plan -> Emulator: nach jeder Aenderung am Geraet die geaenderten
//    Schluessel (Vergleich mit dem zuletzt Gesendeten).
//  - Emulator -> Plan: was ein Pult (ATEM Software Control, Companion, die
//    Bridge) geschaltet hat, wird zum Patch am Geraet. Das ist eine Eingabe
//    am virtuellen Pult, kein Befund einer echten Anlage: hinter dem
//    Emulator steht nur der Plan selbst.
// Das Modul lebt unabhaengig von der Innenansicht weiter, solange ein
// Emulator laeuft.
// ───────────────────────────────────────────────────────────────────────────
import { useProjectStore } from '../store/projectStore'
import type { EquipmentItem } from '../types/equipment'
import type { EmuKind, EmuStatus, EmuValues } from '../types/emulator'
import { cablePlannerApi } from './bridge'
import {
  atemEmuTopology,
  atemEmuValues,
  atemPatchFromEmu,
  videohubEmuTopology,
  videohubEmuValues,
  videohubPatchFromEmu,
} from './emulatorState'

interface Lauf {
  equipmentId: string
  sent: EmuValues
}

const laeufe = new Map<EmuKind, Lauf>()
let abo: (() => void) | null = null
let pultAbo: (() => void) | null = null
let uebernehme = false

const geraet = (id: string): EquipmentItem | undefined =>
  useProjectStore.getState().project.equipment.find((e) => e.id === id)
const valuesOf = (kind: EmuKind, d: EquipmentItem) => (kind === 'atem' ? atemEmuValues(d) : videohubEmuValues(d))

const diff = (alt: EmuValues, neu: EmuValues): EmuValues => {
  const out: EmuValues = {}
  for (const [k, v] of Object.entries(neu)) if (alt[k] !== v) out[k] = v
  return out
}

const planGeaendert = () => {
  if (uebernehme) return
  for (const [kind, lauf] of laeufe) {
    const d = geraet(lauf.equipmentId)
    if (!d) continue
    const neu = valuesOf(kind, d)
    const ch = diff(lauf.sent, neu)
    lauf.sent = neu
    if (Object.keys(ch).length) void cablePlannerApi.emulator.update(kind, lauf.equipmentId, ch)
  }
}

const abonnieren = () => {
  abo ??= useProjectStore.subscribe(planGeaendert)
  pultAbo ??= cablePlannerApi.emulator.onChanged((c) => {
    const lauf = laeufe.get(c.kind)
    const d = lauf && lauf.equipmentId === c.equipmentId ? geraet(c.equipmentId) : undefined
    if (!lauf || !d) return
    const patch = c.kind === 'atem' ? atemPatchFromEmu(d, c.values) : videohubPatchFromEmu(d, c.values)
    uebernehme = true
    try {
      if (Object.keys(patch).length) useProjectStore.getState().updateEquipment(d.id, patch)
    } finally {
      uebernehme = false
    }
    // Was der Plan nicht abbilden kann (z. B. Clean Feed), bleibt im
    // Emulator stehen: als gesendet gilt deshalb der Stand nach der
    // Uebernahme, nicht der vorherige — sonst schickte die naechste
    // Planaenderung den alten Wert zurueck.
    const nach = geraet(d.id)
    if (nach) lauf.sent = valuesOf(c.kind, nach)
  })
}

const abbestellen = () => {
  if (laeufe.size) return
  abo?.()
  pultAbo?.()
  abo = null
  pultAbo = null
}

export const emulatorStarten = async (kind: EmuKind, device: EquipmentItem, lan: boolean): Promise<EmuStatus> => {
  const values = valuesOf(kind, device)
  const st = await cablePlannerApi.emulator.start({
    kind,
    equipmentId: device.id,
    lan,
    topology: kind === 'atem' ? atemEmuTopology(device) : videohubEmuTopology(device),
    values,
  })
  if (st.running) {
    laeufe.set(kind, { equipmentId: device.id, sent: values })
    abonnieren()
  }
  return st
}

export const emulatorStoppen = async (kind: EmuKind): Promise<EmuStatus> => {
  laeufe.delete(kind)
  abbestellen()
  return cablePlannerApi.emulator.stop(kind)
}
