// ───────────────────────────────────────────────────────────────────────────
// #914 — der Signalweg eines Kabels als Menge von Kabeln und Geraeten.
//
// Die Kette selbst rechnet `signalChains` (lib/signalChain.ts) — hier wird
// nur gesammelt, welche Kabel und Geraete zu den Ketten gehoeren, in denen
// dieses Kabel liegt. Eine zweite Traversierung waere die Defektform
// `zwei-rechnungen`: zwei Antworten auf „wohin laeuft das Signal".
//
// REIN: kein Store.
// ───────────────────────────────────────────────────────────────────────────
import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'
import { signalChains, type SignalChain } from './signalChain'

export interface Signalweg {
  cableId: string
  kabelIds: string[]
  geraetIds: string[]
  /** Die Ketten, in denen das Kabel liegt — verzweigt ein Verteiler, mehrere. */
  ketten: SignalChain[]
}

export function signalwegFuerKabel(
  equipment: readonly EquipmentItem[],
  cables: readonly Cable[],
  cableId: string,
): Signalweg | null {
  const kabel = cables.find((c) => c.id === cableId)
  if (!kabel) return null
  const ketten = signalChains(equipment, cables, { auchDirekte: true }).filter((k) =>
    k.steps.some((s) => s.cableId === cableId),
  )
  const kabelIds = new Set<string>([cableId])
  const geraetIds = new Set<string>([kabel.fromEquipmentId, kabel.toEquipmentId])
  for (const k of ketten) {
    for (const s of k.steps) {
      kabelIds.add(s.cableId)
      geraetIds.add(s.fromEquipmentId)
      geraetIds.add(s.toEquipmentId)
    }
  }
  return { cableId, kabelIds: [...kabelIds], geraetIds: [...geraetIds], ketten }
}
