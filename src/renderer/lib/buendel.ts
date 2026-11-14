// ───────────────────────────────────────────────────────────────────────────
// #1178 — Buendelquerschnitt je Trasse: welche Kabel laufen zusammen, wie
// dick ist das Buendel, und passt es ins Rohr?
//
// Das Buendel ist die TRASSE (`Cable.pathway`). Ein Kabel ohne bekannten
// Aussendurchmesser wird gezaehlt und genannt, aber nicht geschaetzt: ein
// erfundener Durchmesser machte den Fuellgrad zu einer Behauptung.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { Cable } from '../types/cable'
import { cableCatalog, type CableSpec } from '../types/cableSpec'
import { fuellgrad, kabelFlaeche, packeKreise, type Fuellgrad, type Packung } from './kreispackung'

/** Aussendurchmesser eines Kabels in mm: am Kabel, sonst am Kabeltyp. */
export const kabelAussendurchmesserMm = (
  cable: Pick<Cable, 'outerDiameterMm' | 'cableSpecId'>,
  specs: readonly CableSpec[] = cableCatalog,
): number | undefined => {
  if (cable.outerDiameterMm && cable.outerDiameterMm > 0) return cable.outerDiameterMm
  const spec = cable.cableSpecId ? specs.find((s) => s.id === cable.cableSpecId) : undefined
  return spec?.outerDiameterMm && spec.outerDiameterMm > 0 ? spec.outerDiameterMm : undefined
}

export interface TrassenBuendel {
  trasse: string
  kabel: Cable[]
  /** Kabel ohne Durchmesser — gezaehlt, nicht gepackt. */
  ohneDurchmesser: Cable[]
  packung: Packung
  /** Aussendurchmesser der Huelle, mm. */
  aussendurchmesserMm: number
  /** Summe der Kabelquerschnitte, mm². */
  querschnittMm2: number
  innenDurchmesserMm?: number
  fuellgrad?: Fuellgrad
}

/**
 * Die Buendel aller Trassen. Mehrere Adern eines Multicores (gleicher
 * `multicoreName`) sind EIN physisches Kabel und zaehlen einmal.
 */
export const trassenBuendel = (
  cables: readonly Cable[],
  ductMm: Record<string, number> | undefined,
  specs: readonly CableSpec[] = cableCatalog,
): TrassenBuendel[] => {
  const nachTrasse = new Map<string, Cable[]>()
  for (const c of cables) {
    const trasse = c.pathway?.trim()
    if (!trasse || c.wireless) continue
    const liste = nachTrasse.get(trasse) ?? []
    if (c.multicoreName && liste.some((x) => x.multicoreName === c.multicoreName)) continue
    liste.push(c)
    nachTrasse.set(trasse, liste)
  }
  const out: TrassenBuendel[] = []
  for (const [trasse, kabel] of nachTrasse) {
    const mit: { c: Cable; d: number }[] = []
    const ohne: Cable[] = []
    for (const c of kabel) {
      const d = kabelAussendurchmesserMm(c, specs)
      if (d) mit.push({ c, d })
      else ohne.push(c)
    }
    const durchmesser = mit.map((m) => m.d)
    const packung = packeKreise(durchmesser)
    const innen = ductMm?.[trasse]
    const grad = innen ? fuellgrad(durchmesser, innen) : undefined
    out.push({
      trasse,
      kabel: mit.map((m) => m.c),
      ohneDurchmesser: ohne,
      packung,
      aussendurchmesserMm: Math.round(packung.huelle.r * 2 * 100) / 100,
      querschnittMm2: Math.round(kabelFlaeche(durchmesser) * 10) / 10,
      ...(innen ? { innenDurchmesserMm: innen } : {}),
      ...(grad ? { fuellgrad: grad } : {}),
    })
  }
  return out.sort((a, b) => a.trasse.localeCompare(b.trasse))
}
