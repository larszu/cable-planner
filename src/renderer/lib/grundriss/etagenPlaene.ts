// #984 — ein Hallenplan je Etage.
//
// `project.grundriss` bleibt der allgemeine Plan (ohne Etage); er traegt den
// Massstab fuer die Kabellaengen. Etagenplaene liegen daneben unter dem
// Etagenschluessel, damit ein Umbenennen in Gross-/Kleinschreibung den Plan
// nicht verwaist. Alle liegen auf demselben Canvas; eine ausgeblendete Etage
// blendet ihren Plan mit aus.

import type { CablePlannerProject } from '../../types/project'
import type { Grundriss } from '../../types/grundriss'
import { etagenSchluessel } from '../etagen'

type MitPlaenen = Pick<CablePlannerProject, 'grundriss' | 'etagenGrundrisse'>

export const GRUNDRISS_KNOTEN = 'grundriss'
const PRAEFIX = 'grundriss:'

/** Knoten-ID auf dem Canvas: `grundriss` fuer den allgemeinen Plan. */
export const grundrissKnotenId = (etage: string | null): string =>
  etage == null ? GRUNDRISS_KNOTEN : PRAEFIX + etagenSchluessel(etage)

/** Umkehrung von `grundrissKnotenId`; `undefined`, wenn kein Plan-Knoten. */
export const etageAusKnotenId = (id: string): string | null | undefined =>
  id === GRUNDRISS_KNOTEN ? null : id.startsWith(PRAEFIX) ? id.slice(PRAEFIX.length) : undefined

export const grundrissVon = (p: MitPlaenen, etage: string | null): Grundriss | undefined =>
  etage == null ? p.grundriss : p.etagenGrundrisse?.[etagenSchluessel(etage)]

/** Projekt mit gesetztem oder (bei `null`) entferntem Plan. */
export function mitGrundriss<P extends MitPlaenen>(p: P, etage: string | null, g: Grundriss | null): P {
  const neu = { ...p }
  if (etage == null) {
    if (g) neu.grundriss = g
    else delete neu.grundriss
    return neu
  }
  const plaene = { ...(p.etagenGrundrisse ?? {}) }
  if (g) plaene[etagenSchluessel(etage)] = g
  else delete plaene[etagenSchluessel(etage)]
  if (Object.keys(plaene).length > 0) neu.etagenGrundrisse = plaene
  else delete neu.etagenGrundrisse
  return neu
}

/** Alle Plaene, allgemeiner zuerst. `etage` ist der Schluessel. */
export const alleGrundrisse = (p: MitPlaenen): Array<{ etage: string | null; g: Grundriss }> => [
  ...(p.grundriss ? [{ etage: null, g: p.grundriss }] : []),
  ...Object.entries(p.etagenGrundrisse ?? {}).map(([etage, g]) => ({ etage, g })),
]
