// ───────────────────────────────────────────────────────────────────────────
// DIE ENGSTELLE fuer Netzwerk-Schnittstellen (Bedarf 19).
//
// Wer wissen will, welche Adressen ein Geraet hat, fragt hier — nicht
// `item.ipAddress`. Die Alt-Felder sind Schnittstelle 0 und bleiben gueltig;
// diese Funktion setzt sie mit `networkInterfaces` zu der einen Liste
// zusammen, die es fachlich gibt.
//
// WARUM EINE ENGSTELLE UND KEIN UMZUG. Dieselbe Bauform wie
// `resolvePortLabel` in ADR-001 Inkrement 2, und aus demselben Grund: dort
// stand die Aufloesung als private Funktion an einer Stelle, die kein Exporter
// erreichen konnte, und wurde hochgezogen statt neu geschrieben. Hier ist es
// umgekehrt herum dieselbe Lage — 95 Aufrufer lesen ein Feld, das kuenftig nur
// noch die halbe Antwort ist. Eine Engstelle macht aus 95 Umbauten einen und
// laesst die uebrigen 94 richtig bleiben, bis sie drankommen.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { EquipmentItem } from '../types/equipment'
import type { NetworkInterface, NetworkInterfaceRole } from '../types/network'
import { interfaceIsEmpty, NETWORK_INTERFACE_ROLES } from '../types/network'

/** Die Id, unter der Schnittstelle 0 erscheint. Abgeleitet und nie
 *  gespeichert — sonst koennte sie von den Alt-Feldern abweichen. */
export const primaryInterfaceId = (equipmentId: string): string => `${equipmentId}#nic0`

/**
 * Alle Netzwerk-Schnittstellen eines Geraets, Schnittstelle 0 zuerst.
 *
 * Schnittstelle 0 entsteht aus den Alt-Feldern und faellt weg, wenn dort
 * nichts steht: ein Geraet, das nur eine zweite Karte gepflegt hat, soll
 * keine leere erste vorgesetzt bekommen.
 *
 * Die Rolle von Schnittstelle 0 ist `unspecified`, solange niemand etwas
 * anderes gesagt hat. Sie zu raten waere billig und falsch: ob die eine IP
 * einer Kamera ihre Steuerung oder ihr Medienweg ist, weiss der Plan nicht.
 */
export function deviceInterfaces(item: EquipmentItem): NetworkInterface[] {
  const out: NetworkInterface[] = []
  const primary: NetworkInterface = {
    id: primaryInterfaceId(item.id),
    role: item.primaryInterfaceRole ?? 'unspecified',
    ...(item.ipAddress ? { ipAddress: item.ipAddress } : {}),
    ...(item.subnetMask ? { subnetMask: item.subnetMask } : {}),
    ...(item.gateway ? { gateway: item.gateway } : {}),
    ...(item.macAddress ? { macAddress: item.macAddress } : {}),
    ...(item.managementVlanId !== undefined ? { vlanId: item.managementVlanId } : {}),
  }
  if (!interfaceIsEmpty(primary)) out.push(primary)
  for (const n of item.networkInterfaces ?? []) {
    if (!interfaceIsEmpty(n)) out.push(n)
  }
  return out
}

/**
 * Wie `deviceInterfaces`, aber auch die leeren — fuer die Oberflaeche, die ein
 * frisch angelegtes Formular anzeigen muss.
 */
export function deviceInterfacesIncludingEmpty(item: EquipmentItem): NetworkInterface[] {
  return [
    {
      id: primaryInterfaceId(item.id),
      role: item.primaryInterfaceRole ?? 'unspecified',
      ...(item.ipAddress ? { ipAddress: item.ipAddress } : {}),
      ...(item.subnetMask ? { subnetMask: item.subnetMask } : {}),
      ...(item.gateway ? { gateway: item.gateway } : {}),
      ...(item.macAddress ? { macAddress: item.macAddress } : {}),
      ...(item.managementVlanId !== undefined ? { vlanId: item.managementVlanId } : {}),
    },
    ...(item.networkInterfaces ?? []),
  ]
}

/** Ist das Schnittstelle 0 (also die Alt-Felder) dieses Geraets? Die
 *  Oberflaeche muss sie anders schreiben als die uebrigen. */
export const isPrimaryInterface = (item: EquipmentItem, nicId: string): boolean =>
  nicId === primaryInterfaceId(item.id)

/** Alle Schnittstellen im Projekt, mit ihrem Geraet daneben. */
export interface DeviceInterface {
  equipment: EquipmentItem
  nic: NetworkInterface
  /** Schnittstelle 0? Dann liegen ihre Werte in den Alt-Feldern. */
  primary: boolean
}

export function allDeviceInterfaces(equipment: EquipmentItem[]): DeviceInterface[] {
  const out: DeviceInterface[] = []
  for (const e of equipment) {
    for (const nic of deviceInterfaces(e)) {
      out.push({ equipment: e, nic, primary: isPrimaryInterface(e, nic.id) })
    }
  }
  return out
}

/** Lesbarer Name einer Schnittstelle fuer Listen: „Kamera 1 · Dante Sec". */
export const interfaceLabel = (e: EquipmentItem, nic: NetworkInterface): string =>
  nic.label?.trim() ? `${e.name} · ${nic.label.trim()}` : e.name

/**
 * Rohsatz aus einer Projektdatei zu einer gueltigen Schnittstelle — oder
 * `null`. Eine Schnittstelle ohne Id und ohne einen einzigen gefuellten Wert
 * ist kein Datensatz, sondern Ballast in jedem Projektfile.
 */
export function normaliseNetworkInterface(
  raw: unknown,
  fallbackId: string,
  roleOk: (r: unknown) => r is NetworkInterfaceRole,
): NetworkInterface | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined
  const nic: NetworkInterface = {
    id: str(r.id) ?? fallbackId,
    role: roleOk(r.role) ? r.role : 'unspecified',
  }
  const label = str(r.label)
  if (label) nic.label = label
  for (const k of ['ipAddress', 'subnetMask', 'gateway', 'macAddress', 'switchPort', 'portId'] as const) {
    const v = str(r[k])
    if (v) nic[k] = v
  }
  const sw = str(r.switchEquipmentId)
  if (sw) nic.switchEquipmentId = sw
  if (typeof r.vlanId === 'number' && Number.isInteger(r.vlanId) && r.vlanId >= 0 && r.vlanId <= 4094) {
    nic.vlanId = r.vlanId
  }
  return interfaceIsEmpty(nic) && !nic.label ? null : nic
}

/** Typwaechter fuer die Rolle — an einer Stelle, damit Store und Test dieselbe
 *  Liste benutzen und nicht zwei. */
export const isNetworkInterfaceRole = (r: unknown): r is NetworkInterfaceRole =>
  (NETWORK_INTERFACE_ROLES as readonly unknown[]).includes(r)
