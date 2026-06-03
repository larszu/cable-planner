// #221 — Off-Page-/Pfeil-Connector: Netz-Logik.
//
// Ein "Netz" ist die Menge aller Off-Page-Kabel mit demselben Netznamen.
// Im einfachsten Fall ("ein Plan-Ende mit dem anderen verbinden") besteht
// ein Netz aus genau 1 Kabel = 2 Endpunkte/Symbole. Mehrere Kabel mit
// gleichem Namen (z.B. ein Strom-/Signalbus) werden automatisch als ein
// gemeinsames Netz behandelt — exakt wie Net-Labels in EAGLE/ECAD.
//
// Die Verbindung bleibt rein logisch: jedes Kabel hat weiterhin echte
// from/to-Ports. Diese Helfer leiten nur die Netz-Sicht daraus ab.

import type { Cable } from '../types/cable'

/** Netz-Schlüssel eines Kabels. Nur Off-Page-Kabel gehören zu einem Netz.
 *  Schlüssel = getrimmter `netName`, Fallback auf den Kabel-`name`.
 *  Gibt `null` zurück wenn das Kabel nicht Off-Page ist oder kein
 *  brauchbarer Name vorliegt. */
export const netKeyOf = (
  cable: Pick<Cable, 'offPage' | 'netName' | 'name'> | null | undefined,
): string | null => {
  if (!cable || !cable.offPage) return null
  const raw = (cable.netName ?? '').trim() || (cable.name ?? '').trim()
  return raw || null
}

/** Alle Off-Page-Kabel, die denselben Netz-Schlüssel teilen. */
export const netMembers = (cables: Cable[], key: string | null): Cable[] => {
  if (!key) return []
  return cables.filter((c) => netKeyOf(c) === key)
}

/** Ein konkreter Endpunkt innerhalb eines Netzes (jedes Kabel hat zwei). */
export interface NetEndpoint {
  cableId: string
  end: 'from' | 'to'
  equipmentId: string
  portId: string
}

/** Flacht ein Netz in seine Endpunkte auf (2 pro Kabel: from + to). */
export const netEndpoints = (cables: Cable[], key: string | null): NetEndpoint[] => {
  const eps: NetEndpoint[] = []
  for (const c of netMembers(cables, key)) {
    eps.push({ cableId: c.id, end: 'from', equipmentId: c.fromEquipmentId, portId: c.fromPortId })
    eps.push({ cableId: c.id, end: 'to', equipmentId: c.toEquipmentId, portId: c.toPortId })
  }
  return eps
}

/** Anzahl ANDERER Off-Page-Kabel, die denselben Netznamen nutzen — für die
 *  „Doppelte-Namen"-Anzeige (gewollt = Netz, aber der User soll sehen
 *  dass er an ein bestehendes Netz andockt bzw. eine Tippfehler-Kollision
 *  vermeiden). */
export const netPeerCount = (cables: Cable[], cable: Cable): number => {
  const key = netKeyOf(cable)
  if (!key) return 0
  return cables.filter((c) => c.id !== cable.id && netKeyOf(c) === key).length
}
