// ───────────────────────────────────────────────────────────────────────────
// Welche KISTE steht im Plan-Platz (Bedarf 78, P2).
//
//   > The rental system knows serial numbers and barcodes; the IP plan knows
//   > hostnames and addresses. A last-minute substitution of one identical
//   > stagebox for another is invisible to both the IP plan and the Dante
//   > subscription set, and only surfaces as a fault during rehearsal.
//
// ─── WARUM DER TAUSCH UNSICHTBAR IST ───────────────────────────────────────
//
// Zwei baugleiche Stageboxen sind im Plan dasselbe Kaestchen. Im Lager sind
// sie zwei Einheiten mit zwei Seriennummern. Und im NETZ sind sie zwei
// verschiedene Geraete: jede traegt ihren eigenen eingebrannten Dante-Namen
// und ihre eigene MAC.
//
// Wer am Ladetag die eine gegen die andere tauscht, tauscht damit auch:
//   - den Dante-Namen, auf den jedes Abonnement zeigt,
//   - die MAC, auf die die DHCP-Reservierung und der Switch-Port-Filter
//     ausgestellt sind,
//   - und, wenn statisch adressiert wurde, die IP, die in der Kiste steht.
//
// Nichts davon faellt beim Aufbau auf. Es faellt in der Probe auf, wenn ein
// Kanal stumm bleibt.
//
// ─── WAS DIESE DATEI TUT UND WAS SIE NICHT WEISS ───────────────────────────
//
// Sie vergleicht AUFZEICHNUNGEN: was der Plan-Platz ueber seine Netz-Identitaet
// sagt, welche Einheit ihm zugeordnet ist, was das Lager ueber diese Einheit
// weiss, und was auf dem Ausgabeschein steht. Wo diese Aufzeichnungen
// EINANDER widersprechen, sagt sie es.
//
// Sie weiss NICHT, welche Kiste tatsaechlich im Rack steht. Kein Befund
// behauptet, dass getauscht wurde — jeder sagt, dass die Aufzeichnungen
// auseinandergehen. Der Unterschied ist wichtig: eine Behauptung ueber die
// Wirklichkeit muesste jemand pruefen gehen, ein Widerspruch zwischen zwei
// Listen laesst sich am Schreibtisch aufloesen.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { EquipmentItem } from '../../types/equipment'
import type { InventoryUnit, InventoryItem } from '../types/inventory'
import type { CheckoutRecord } from '../types/checkout'
import type { CsvTable } from '../../lib/csv'
import { kanonisch, spalten } from '../../lib/kanonisch'
import { type Satz, befund, satz, undListe } from '../../lib/satz'
import { deviceInterfaces } from '../../lib/networkInterfaces'

/**
 * Woran haengt an diesem Platz eine Netz-Identitaet?
 *
 * Nur diese Plaetze sind ueberhaupt betroffen. Ein Stativ hat keinen
 * Dante-Namen, und es in die Liste zu nehmen hiesse, den halben Plan zu
 * melden.
 */
export type IdentityAnchor = 'ip' | 'mac' | 'dante' | 'ptp'

export const IDENTITY_ANCHOR_LABEL: Readonly<Record<IdentityAnchor, string>> = {
  ip: 'IP address',
  mac: 'MAC address',
  dante: 'Dante/device name',
  ptp: 'PTP domain',
}

/**
 * Welche Anker dieser Platz traegt.
 *
 * Der Dante-Name ist der GERAETE-Name: bei Dante und AES67 ist er die
 * Adresse, unter der Abonnements den Sender finden. Er zaehlt deshalb nur,
 * wenn am Platz ueberhaupt eine Netz-Schnittstelle haengt — sonst waere jedes
 * benannte Geraet im Plan ein Anker.
 */
export function identityAnchors(e: EquipmentItem): IdentityAnchor[] {
  const nics = deviceInterfaces(e)
  const out: IdentityAnchor[] = []
  if (nics.some((n) => n.ipAddress)) out.push('ip')
  if (nics.some((n) => n.macAddress)) out.push('mac')
  if (nics.length > 0 && e.name?.trim()) out.push('dante')
  if (nics.some((n) => typeof n.ptpDomain === 'number')) out.push('ptp')
  return out
}

export type AssetFindingKind =
  | 'unit-unnamed'
  | 'unit-double'
  | 'unit-missing'
  | 'serial-mismatch'
  | 'unit-not-issued'
  | 'unit-blocked'

export const ASSET_FINDING_LABEL: Readonly<Record<AssetFindingKind, string>> = {
  'unit-unnamed': 'Slot with a network identity but no named unit',
  'unit-double': 'One unit sits in two slots',
  'unit-missing': 'Named unit is not in the inventory',
  'serial-mismatch': 'Serial number at the slot and on the unit disagree',
  'unit-not-issued': 'Named unit is on no open issue slip',
  'unit-blocked': 'Named unit is not ready for use',
}

export interface AssetFinding {
  kind: AssetFindingKind
  text: string
  satz: Satz
  /** Der betroffene Plan-Platz, fuer den Sprung. */
  equipmentId: string
  /** Die betroffene Einheit, wenn eine benannt ist. */
  unitId?: string
}

export interface AssetIdentityInput {
  equipment: readonly EquipmentItem[]
  units?: readonly InventoryUnit[]
  items?: readonly InventoryItem[]
  /** Offene und geschlossene Vorgaenge — die Pruefung nimmt nur die offenen. */
  checkouts?: readonly CheckoutRecord[]
}

export interface AssetIdentityRow {
  equipmentId: string
  name: string
  anchors: IdentityAnchor[]
  unitId?: string
  /** Seriennummer der benannten Einheit. */
  unitSerial?: string
  /** Seriennummer, die am Platz steht. */
  plannedSerial?: string
}

export interface AssetIdentityAssessment {
  rows: AssetIdentityRow[]
  findings: AssetFinding[]
  /** Traegt der Plan ueberhaupt Plaetze mit Netz-Identitaet? */
  hasAnchored: boolean
}

const trimmed = (v: string | undefined): string | undefined => v?.trim() || undefined

/** Seriennummern vergleichen, wie ein Mensch sie tippt: ohne Leerraum, ohne Fall. */
const sameSerial = (a: string | undefined, b: string | undefined): boolean =>
  (a ?? '').replace(/[\s-]/g, '').toLowerCase() === (b ?? '').replace(/[\s-]/g, '').toLowerCase()

/**
 * Der Abgleich. Er liest nur — er ordnet keine Einheit zu und aendert nichts.
 */
export function assessAssetIdentity(input: AssetIdentityInput): AssetIdentityAssessment {
  const units = input.units ?? []
  const unitById = new Map(units.map((u) => [u.id, u]))
  const itemById = new Map((input.items ?? []).map((i) => [i.id, i]))
  const findings: AssetFinding[] = []

  // Nur Plaetze MIT Anker. Alles andere ist nicht betroffen.
  const anchored = input.equipment
    .map((e) => ({ e, anchors: identityAnchors(e) }))
    .filter((x) => x.anchors.length > 0)

  // Welche Einheiten stehen auf einem OFFENEN Ausgabeschein?
  const ausgegeben = new Set<string>()
  for (const r of input.checkouts ?? []) {
    if (r.in) continue
    for (const l of r.contents) if (l.kind === 'unit') ausgegeben.add(l.refId)
  }
  const hatOffene = (input.checkouts ?? []).some((r) => !r.in)

  // Doppelbelegung zuerst: sie betrifft zwei Plaetze und gehoert nicht je
  // Platz gemeldet.
  const proEinheit = new Map<string, EquipmentItem[]>()
  for (const { e } of anchored) {
    const uid = trimmed(e.inventoryUnitId)
    if (!uid) continue
    proEinheit.set(uid, [...(proEinheit.get(uid) ?? []), e])
  }
  for (const [uid, plaetze] of proEinheit) {
    if (plaetze.length < 2) continue
    const u = unitById.get(uid)
    findings.push({
      kind: 'unit-double',
      equipmentId: plaetze[0].id,
      unitId: uid,
      ...befund(u?.serial
        ? satz(
            'asset.text.twiceSerial',
            'Unit {serial} sits in {n} slots: {slots}. A case is in one place — one of the slots carries a leftover from yesterday.',
            { serial: u.serial, n: plaetze.length, slots: plaetze.map((p) => p.name).join(', ') },
          )
        : satz(
            'asset.text.twice',
            'A unit sits in {n} slots: {slots}. A case is in one place — one of the slots carries a leftover from yesterday.',
            { n: plaetze.length, slots: plaetze.map((p) => p.name).join(', ') },
          )),
    })
  }

  const rows: AssetIdentityRow[] = []
  for (const { e, anchors } of anchored) {
    const uid = trimmed(e.inventoryUnitId)
    const unit = uid ? unitById.get(uid) : undefined
    const plannedSerial = trimmed(e.serialNumber)
    rows.push({
      equipmentId: e.id,
      name: e.name,
      anchors,
      ...(uid ? { unitId: uid } : {}),
      ...(unit?.serial ? { unitSerial: unit.serial } : {}),
      ...(plannedSerial ? { plannedSerial } : {}),
    })

    if (!uid) {
      findings.push({
        kind: 'unit-unnamed',
        equipmentId: e.id,
        ...befund(satz(
          'asset.text.anchorWithoutUnit',
          '{device} carries {anchors}, but it does not say WHICH case it is. If it is swapped for an identical one on load-in day, the burned-in device name travels along — and the subscriptions point into nothing without anything turning red.',
          {
            device: e.name,
            anchors: undListe(anchors.map((a) => satz(`asset.anchor.${a}`, IDENTITY_ANCHOR_LABEL[a]))),
          },
        )),
      })
      continue
    }

    if (!unit) {
      // Nicht still leeren: ein Zeiger ins Nichts ist eine Auskunft darueber,
      // dass hier einmal eine Einheit stand.
      findings.push({
        kind: 'unit-missing',
        equipmentId: e.id,
        unitId: uid,
        ...befund(satz(
          'asset.text.unitMissing',
          '{device} names a unit that is not in stock. Either it was deleted, or the plan comes from another inventory database.',
          { device: e.name },
        )),
      })
      continue
    }

    if (plannedSerial && unit.serial && !sameSerial(plannedSerial, unit.serial)) {
      findings.push({
        kind: 'serial-mismatch',
        equipmentId: e.id,
        unitId: uid,
        ...befund(satz(
          'asset.text.serialMismatch',
          '{device}: the slot says serial {planned}, the assigned unit carries {actual}. Two records of the same case contradict each other — the plan does not say which is right, but one of them is left over from a swap.',
          { device: e.name, planned: plannedSerial, actual: unit.serial },
        )),
      })
    }

    if (unit.condition && unit.condition !== 'ok') {
      const modell = itemById.get(unit.itemId)?.model
      findings.push({
        kind: 'unit-blocked',
        equipmentId: e.id,
        unitId: uid,
        ...befund(satz(
          'asset.text.unitBlocked',
          '{device} is assigned {unit}, and the unit is set to “{condition}”. It does not go out like this.',
          {
            device: e.name,
            unit: `${modell ? `${modell} ` : ''}${unit.serial ?? uid}`,
            condition: satz(`inventory.history.cond.${unit.condition}`, unit.condition),
          },
        )),
      })
    }

    // Nur pruefen, wenn es ueberhaupt Ausgabescheine gibt: ohne Lagerbetrieb
    // waere das eine Warnung fuer jeden Platz.
    if (hatOffene && !ausgegeben.has(uid)) {
      findings.push({
        kind: 'unit-not-issued',
        equipmentId: e.id,
        unitId: uid,
        ...befund(satz(
          'asset.text.unitNotIssued',
          '{device} names unit {unit}, which is on no open issue slip. Either another case is travelling, or the slip is incomplete.',
          { device: e.name, unit: unit.serial ?? uid },
        )),
      })
    }
  }

  return { rows, findings, hasAnchored: anchored.length > 0 }
}


/**
 * Das Blatt: welcher Platz von welcher Kiste gefuellt wird.
 *
 * Es ist das Blatt, mit dem jemand vor dem Rack steht und die Seriennummer
 * abliest. Deshalb stehen BEIDE Seriennummern drauf — die geplante und die
 * der zugeordneten Einheit; steht nur eine da, kann man nicht vergleichen.
 */
export function assetIdentityTable(a: AssetIdentityAssessment): CsvTable {
  return {
    headers: spalten(['Slot', 'Anchor', 'Unit', 'Serial (unit)', 'Serial (slot)', 'Finding']),
    rows: a.rows.map((r) => [
      r.name,
      r.anchors.map((x) => kanonisch(`asset.anchor.${x}`, IDENTITY_ANCHOR_LABEL[x])).join(', '),
      r.unitId ?? kanonisch('rest.asset.unnamed', 'not named'),
      r.unitSerial ?? '',
      r.plannedSerial ?? '',
      a.findings
        .filter((f) => f.equipmentId === r.equipmentId)
        .map((f) => kanonisch(`asset.finding.${f.kind}`, ASSET_FINDING_LABEL[f.kind]))
        .join('; '),
    ]),
  }
}
