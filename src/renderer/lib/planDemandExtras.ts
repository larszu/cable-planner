// ───────────────────────────────────────────────────────────────────────────
// Bedarf, der nicht in `project.equipment` steht.
//
// WARUM ES DIESE DATEI GIBT (gemessen 2026-09-04, Gegenrunde zu Runde 10).
// `deriveDemand` las ausschliesslich `project.equipment`. Zwei ganze
// Planteile liegen aber daneben, als eigene Projektfelder:
//
//   `project.drumKit`     — Mikrofonierung eines Schlagzeugs
//   `project.wirelessRig` — Kanalplan fuer Funkstrecken
//
// Beide tauchten in KEINER Stueckliste auf. Der Funkstrecken-Plan plant
// Sender-Bodies und Kapseln mit echter Katalog-GUID; die Drum-Mikrofonierung
// hat stattdessen ihre EIGENE, zweite Materialliste (`deriveDrumBom`), die nur
// in die Zwischenablage geht — kein CSV, kein Lagerabgleich, kein Kontakt zum
// Deckungs-Resolver.
//
// DER UNTERSCHIED ZUM RACK-FALL. Ein Rack-Snapshot traegt nur einen Namen, und
// seine Positionen sind deshalb VORSCHLAEGE. Hier ist es besser: `drumKit.mics`
// und `wirelessRig.channels` tragen `deviceTypeId`, also Katalog-GUIDs — die
// Zeilen sind TATSACHEN und landen in der Typ-Spalte.
//
// WAS DAS SCHWIERIG MACHT — und warum diese Datei nicht nur die GUIDs
// weiterreicht: `deriveDrumBom` leitet zusaetzlich Stative, Kessel-Clamps und
// XLR-Kabel ab. Die gibt es im GERAETEkatalog nicht, sie haben also keine
// GUID. Sie wegzulassen waere derselbe stille Unterlauf noch einmal, nur eine
// Ebene tiefer: wer sechs Mikrofone kommissioniert und keine Stative, steht am
// Aufbautag genauso da. Sie kommen deshalb als NAMENS-Zeilen mit, wie alles
// andere ohne Katalog-Zuordnung, und tragen ihre Herkunft im Text.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import { resolveDeviceType } from './deviceTypeRegistry'
import { deriveDrumBom } from './drumMicing'

/**
 * Eine Bedarfsposition, die nicht von einem `EquipmentItem` kommt.
 *
 * `herkunft` wird in der Stueckliste genannt. Ohne sie sieht die Position aus
 * wie ein frei stehendes Geraet, und wer sie im Regal sucht, weiss nicht, dass
 * sie zum Drum-Set oder zum Funk-Rig gehoert.
 */
export interface ZusatzBedarf {
  /** Katalog-GUID, wo der Plan sie kennt. Dann ist die Zeile eine Tatsache. */
  deviceTypeId?: string
  label: string
  category?: string
  quantity: number
  herkunft: string
}

const DRUM = 'Drum-Mikrofonierung'
const FUNK = 'Funkstrecken-Plan'

/** Zaehlt gleiche Positionen zusammen, deterministisch sortiert. */
const zusammen = (roh: ZusatzBedarf[]): ZusatzBedarf[] => {
  const byKey = new Map<string, ZusatzBedarf>()
  for (const z of roh) {
    if (!z.label.trim()) continue
    const key = `${z.deviceTypeId ?? ''}|${z.label.trim().toLowerCase()}|${z.herkunft}`
    const hit = byKey.get(key)
    if (hit) hit.quantity += z.quantity
    else byKey.set(key, { ...z, label: z.label.trim() })
  }
  return [...byKey.values()].sort(
    (a, b) => a.herkunft.localeCompare(b.herkunft, 'de') || a.label.localeCompare(b.label, 'de'),
  )
}

/**
 * Der Bedarf aus `drumKit` und `wirelessRig`.
 *
 * Nimmt bewusst nur die beiden Felder entgegen und nicht das ganze Projekt —
 * dann kann ein Test sie einzeln stellen, und die Abhaengigkeit steht in der
 * Signatur statt im Rumpf.
 */
export const zusatzBedarf = (
  plan: Pick<CablePlannerProject, 'drumKit' | 'wirelessRig'>,
): ZusatzBedarf[] => {
  const roh: ZusatzBedarf[] = []

  // ── Drum-Set ──────────────────────────────────────────────────────────────
  // Die Mikrofone kommen mit ihrer GUID, wo sie eine haben. `deriveDrumBom`
  // liefert daneben Stative/Clamps/XLR — die haben keine, und genau deshalb
  // gehen sie hier UEBER DEN NAMEN mit, statt zu verschwinden.
  const drum = plan.drumKit
  if (drum) {
    for (const m of drum.mics ?? []) {
      const type = resolveDeviceType(m.micDeviceTypeId)
      const label = type?.template.name?.trim() || m.micName?.trim()
      if (!label) continue
      roh.push({
        ...(m.micDeviceTypeId ? { deviceTypeId: m.micDeviceTypeId } : {}),
        label,
        ...(type?.template.category ? { category: type.template.category } : {}),
        quantity: 1,
        herkunft: DRUM,
      })
    }
    for (const row of deriveDrumBom(drum)) {
      // Die Mic-Zeilen stehen oben schon — hier nur das Zubehoer, sonst
      // zaehlte jedes Mikrofon doppelt.
      if (row.kind === 'mic') continue
      roh.push({ label: row.item, quantity: row.qty, herkunft: DRUM })
    }
  }

  // ── Funkstrecken ──────────────────────────────────────────────────────────
  // Ein Kanal ist ein Sender-Body PLUS eine Kapsel/ein Headset. Beide sind
  // eigene Artikel im Lager und zaehlen einzeln.
  for (const c of plan.wirelessRig?.channels ?? []) {
    for (const id of [c.bodyDeviceTypeId, c.micDeviceTypeId]) {
      if (!id) continue
      const type = resolveDeviceType(id)
      const label = type?.template.name?.trim()
      if (!label) continue
      roh.push({
        deviceTypeId: id,
        label,
        ...(type?.template.category ? { category: type.template.category } : {}),
        quantity: 1,
        herkunft: FUNK,
      })
    }
  }

  return zusammen(roh)
}
