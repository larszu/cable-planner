// ───────────────────────────────────────────────────────────────────────────
// Was der Canvas gerade zeigt: ausgeblendete Raeume/Etagen (#915) und der
// hervorgehobene Signalweg (#914).
//
// Reine Ansicht (uiStore), keine Projektdaten: wer eine Etage ausblendet,
// aendert nichts am Plan, und ein Export zeigt weiter alles.
//
// REIN: kein Store.
// ───────────────────────────────────────────────────────────────────────────
import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'
import type { LocationFrame } from '../types/location'
import { locationForEquipment } from './equipmentLocation'
import { etagenSchluessel } from './etagen'

export interface AnsichtsZustand {
  /** Ids ausgeblendeter Rahmen. */
  ausgeblendeteRaeume: readonly string[]
  /** Ausgeblendete Etagen als `etagenSchluessel`. */
  ausgeblendeteEtagen: readonly string[]
  signalweg: { kabelIds: readonly string[]; geraetIds: readonly string[] } | null
}

export interface Ansicht {
  verborgeneRahmen: Set<string>
  verborgeneGeraete: Set<string>
  /** Kabel, deren BEIDE Enden verborgen sind. */
  verborgeneKabel: Set<string>
  /** Kabel mit genau einem verborgenen Ende → welches Ende sichtbar bleibt. */
  stummel: Map<string, 'from' | 'to'>
  gedimmteGeraete: Set<string>
  gedimmteKabel: Set<string>
}

export function ansicht(
  equipment: readonly EquipmentItem[],
  cables: readonly Cable[],
  locations: readonly LocationFrame[],
  zustand: AnsichtsZustand,
): Ansicht {
  const etagen = new Set(zustand.ausgeblendeteEtagen)
  const raeume = new Set(zustand.ausgeblendeteRaeume)
  const verborgeneRahmen = new Set<string>()
  for (const loc of locations) {
    if (raeume.has(loc.id) || (loc.floor?.trim() && etagen.has(etagenSchluessel(loc.floor)))) {
      verborgeneRahmen.add(loc.id)
    }
  }
  const verborgeneGeraete = new Set<string>()
  if (verborgeneRahmen.size > 0) {
    for (const e of equipment) {
      // Derselbe Rahmen, den Ziehliste und Kabelende nennen (#912) — ein
      // Geraet, das dort „Regie" heisst, verschwindet mit der Regie.
      const loc = locationForEquipment(e, locations)
      if (loc && verborgeneRahmen.has(loc.id)) verborgeneGeraete.add(e.id)
    }
  }
  const verborgeneKabel = new Set<string>()
  const stummel = new Map<string, 'from' | 'to'>()
  for (const c of cables) {
    const von = verborgeneGeraete.has(c.fromEquipmentId)
    const nach = verborgeneGeraete.has(c.toEquipmentId)
    if (von && nach) verborgeneKabel.add(c.id)
    else if (von) stummel.set(c.id, 'to')
    else if (nach) stummel.set(c.id, 'from')
  }

  const gedimmteGeraete = new Set<string>()
  const gedimmteKabel = new Set<string>()
  if (zustand.signalweg) {
    const k = new Set(zustand.signalweg.kabelIds)
    const g = new Set(zustand.signalweg.geraetIds)
    for (const e of equipment) if (!g.has(e.id)) gedimmteGeraete.add(e.id)
    for (const c of cables) if (!k.has(c.id)) gedimmteKabel.add(c.id)
  }
  return { verborgeneRahmen, verborgeneGeraete, verborgeneKabel, stummel, gedimmteGeraete, gedimmteKabel }
}
