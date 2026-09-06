// ───────────────────────────────────────────────────────────────────────────
// Segmente: welche VLAN wofür da ist, und wer darin nichts zu suchen hat
// (Bedarf 116, P3).
//
//   > A systems tech must reach VuNET, the mixer app, Dante Controller, Lake
//   > Controller and Shure WWB ON SEPARATE VLANs FROM ONE MACHINE, while
//   > keeping amp control off Dante PTP and stopping Waves SoundGrid
//   > attaching to the wrong segment.
//
// Belegt an `misnow1/vunet-dante-combiner-2000` (2026-08-13, sieben offene
// Punkte): ein tragbares Mgmt-VLAN-Gateway, gebaut, damit EIN Steuer-Rechner
// alle fünf Anwendungen erreicht — ohne zweite Netzkarte, mit dokumentiertem
// „break-glass"-Rückfall.
//
// ─── DIE FRAGE, DIE DER PLAN BEANTWORTEN KANN ──────────────────────────────
//
// Nicht: „läuft das Netz?" Der Plan misst nichts. Sondern: STEHT DER ENTWURF
// DA, BEVOR DER LAPTOP VOR ORT IST — welche Segmente gibt es, wofür sind sie,
// welche Zeit läuft darin, und kommt man hinein. Genau das ist die Massnahme
// aus der Bedarfs-Datenbank: „so the network design is documented before the
// laptop is on site."
//
// ─── DIE VIER BEFUNDE, UND WOHER SIE KOMMEN ────────────────────────────────
//
//   1. `unnamed-segment`   — eine VLAN-Id ist in Gebrauch, aber niemand hat
//      gesagt, wofür. „VLAN 30" ist keine Auskunft.
//   2. `mixed-segment`     — Medien UND Steuerung im selben Segment. Das ist
//      der Satz „on separate VLANs" aus dem Beleg, verneint.
//   3. `role-mismatch`     — die Rolle der Schnittstelle passt nicht zum Zweck
//      des Segments. Das sind die beiden übrigen Sätze: „amp control off
//      Dante PTP" und „SoundGrid attaching to the wrong segment".
//   4. `ptp-mismatch`      — das Segment plant Domäne X, ein Gerät darin sagt
//      Y. `ptpPlan.ts` kann das NICHT sehen: es kennt Domänen und Profile,
//      aber keine Segmente. Der Widerspruch zwischen Entwurf und Gerät
//      entsteht erst hier.
//
// Ein leeres Segment ist KEIN Befund: die Planung fängt oft mit den Segmenten
// an und füllt die Geräte später. Ein Befund darauf meckerte bei jedem
// halbfertigen Plan, und ein Check, der immer meckert, wird weggeklickt.
// Gemeldet wird nur der Datensatz, dessen VLAN NIEMAND benutzt und der auch
// keinen Namen trägt — der ist ein Rest, kein Entwurf.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { EquipmentItem } from '../types/equipment'
import type { NetworkInterface, NetworkInterfaceRole } from '../types/network'
import {
  NO_GATEWAY,
  NO_PTP_IN_SEGMENT,
  NO_SEGMENT_NAME,
  type NetworkSegment,
} from '../types/networkSegment'
import { allDeviceInterfaces, interfaceLabel } from './networkInterfaces'
import type { CsvTable } from './csv'

/**
 * Rollen-Namen in kanonischem Deutsch.
 *
 * Kanonisch und nicht übersetzt, weil sie in EXPORTIERTE Tabellen gehen:
 * ein Blatt, dessen Inhalt sich mit dem Sprachschalter ändert, meldet jedes
 * gedruckte Exemplar als veraltet (dieselbe Regel wie bei `deliveryIssueText`).
 */
export const ROLE_TEXT: Readonly<Record<NetworkInterfaceRole, string>> = {
  'media-primary': 'Medien primär',
  'media-secondary': 'Medien sekundär',
  control: 'Steuerung',
  management: 'Management',
  unspecified: 'nicht angegeben',
}

const isMedia = (r: NetworkInterfaceRole): boolean =>
  r === 'media-primary' || r === 'media-secondary'

/**
 * Passt eine Rolle in ein Segment dieses Zwecks?
 *
 * Grosszügig, wo der Plan nichts weiss, und streng nur dort, wo der Beleg
 * einen Schaden nennt:
 *
 *   * `unspecified` auf einer der beiden Seiten passt IMMER. Wer nichts
 *     gesagt hat, hat nichts Falsches gesagt.
 *   * Medien primär und sekundär dürfen sich NICHT mischen — ein
 *     2022-7-Aufbau, dessen beide Beine im selben VLAN liegen, ist kein
 *     redundanter Aufbau mehr, sondern ein doppelter.
 *   * `management` in einem Steuer-Segment ist erlaubt: das Mgmt-VLAN aus
 *     dem Beleg IST der Weg, über den die Steuerung hineinkommt.
 */
export function roleFitsPurpose(
  role: NetworkInterfaceRole,
  purpose: NetworkInterfaceRole,
): boolean {
  if (role === 'unspecified' || purpose === 'unspecified') return true
  if (role === purpose) return true
  if (isMedia(role) && isMedia(purpose)) return false
  if (role === 'management' && purpose === 'control') return true
  if (role === 'control' && purpose === 'management') return true
  return false
}

export interface SegmentMember {
  equipmentId: string
  /** „Kamera 1 · Dante Sec" — die vorhandene Vokabel, nicht eine zweite. */
  where: string
  role: NetworkInterfaceRole
  ptpDomain?: number
}

export interface SegmentView {
  vlanId: number
  /** Der hinterlegte Datensatz. Fehlt er, ist das Segment unbenannt. */
  segment?: NetworkSegment
  members: SegmentMember[]
}

/** Welche VLAN-Ids im Plan wirklich vorkommen, aufsteigend. */
export function vlansInUse(equipment: readonly EquipmentItem[]): number[] {
  const s = new Set<number>()
  for (const { nic } of allDeviceInterfaces([...equipment])) {
    if (typeof nic.vlanId === 'number' && Number.isFinite(nic.vlanId)) s.add(nic.vlanId)
  }
  return [...s].sort((a, b) => a - b)
}

/**
 * Segmente mit ihren Mitgliedern.
 *
 * Führt die Vereinigung aus BEIDEN Richtungen: jede benutzte VLAN-Id und
 * jeden hinterlegten Datensatz. Nur die eine Richtung zu nehmen verlöre
 * entweder den Entwurf, den noch niemand bestückt hat, oder das VLAN, in dem
 * jemand ohne Entwurf ein Gerät angemeldet hat — und das zweite ist genau der
 * Zustand, den der Beleg beschreibt.
 */
export function segmentViews(
  equipment: readonly EquipmentItem[],
  segments: readonly NetworkSegment[],
): SegmentView[] {
  const byVlan = new Map<number, SegmentView>()
  const nimm = (vlanId: number): SegmentView => {
    let v = byVlan.get(vlanId)
    if (!v) {
      v = { vlanId, members: [] }
      byVlan.set(vlanId, v)
    }
    return v
  }
  for (const s of segments) nimm(s.vlanId).segment = s
  for (const { equipment: e, nic } of allDeviceInterfaces([...equipment])) {
    if (typeof nic.vlanId !== 'number' || !Number.isFinite(nic.vlanId)) continue
    const eintrag: SegmentMember = {
      equipmentId: e.id,
      where: interfaceLabel(e, nic as NetworkInterface),
      role: nic.role,
    }
    if (typeof nic.ptpDomain === 'number') eintrag.ptpDomain = nic.ptpDomain
    nimm(nic.vlanId).members.push(eintrag)
  }
  return [...byVlan.values()].sort((a, b) => a.vlanId - b.vlanId)
}

export type SegmentFindingKind =
  | 'unnamed-segment'
  | 'mixed-segment'
  | 'role-mismatch'
  | 'ptp-mismatch'
  | 'orphan-segment'

export interface SegmentFinding {
  kind: SegmentFindingKind
  severity: 'error' | 'warning'
  /** VLAN-Id als Klick-/Sortierschlüssel. */
  vlanId: number
  message: string
}

const segmentName = (v: SegmentView): string =>
  v.segment?.name?.trim() || `VLAN ${v.vlanId}`

export function segmentFindings(
  equipment: readonly EquipmentItem[],
  segments: readonly NetworkSegment[],
): SegmentFinding[] {
  const views = segmentViews(equipment, segments)
  const out: SegmentFinding[] = []

  for (const v of views) {
    const name = segmentName(v)

    if (!v.segment || !v.segment.name?.trim()) {
      if (v.members.length > 0) {
        out.push({
          kind: 'unnamed-segment',
          severity: 'warning',
          vlanId: v.vlanId,
          message:
            `VLAN ${v.vlanId} trägt ${v.members.length} Schnittstelle(n), aber keinen Namen — ` +
            'eine Zahl allein sagt niemandem, ob Dante dort hin darf.',
        })
      } else if (v.segment) {
        // Ein Datensatz ohne Namen UND ohne Mitglieder ist ein Rest.
        out.push({
          kind: 'orphan-segment',
          severity: 'warning',
          vlanId: v.vlanId,
          message: `VLAN ${v.vlanId} ist hinterlegt, aber weder benannt noch benutzt.`,
        })
      }
    }

    // „on separate VLANs": Medien und Steuerung im selben Segment.
    const hatMedien = v.members.some((m) => isMedia(m.role))
    const hatSteuerung = v.members.some((m) => m.role === 'control')
    if (hatMedien && hatSteuerung) {
      out.push({
        kind: 'mixed-segment',
        severity: 'error',
        vlanId: v.vlanId,
        message:
          `${name} führt Medien UND Steuerung. Der Beleg verlangt getrennte Segmente: ` +
          'Steuerverkehr im Medien-VLAN sitzt auf demselben PTP wie die Audio-Uhr.',
      })
    }

    // „attaching to the wrong segment": Rolle gegen Zweck.
    const zweck = v.segment?.purpose ?? 'unspecified'
    for (const m of v.members) {
      if (roleFitsPurpose(m.role, zweck)) continue
      out.push({
        kind: 'role-mismatch',
        severity: 'error',
        vlanId: v.vlanId,
        message:
          `${m.where} ist "${ROLE_TEXT[m.role]}", liegt aber in ${name} ` +
          `("${ROLE_TEXT[zweck]}").`,
      })
    }

    // Entwurf gegen Gerät — das, was `ptpPlan.ts` nicht sehen kann.
    const geplant = v.segment?.ptpDomain
    if (typeof geplant === 'number') {
      for (const m of v.members) {
        if (m.ptpDomain === undefined || m.ptpDomain === geplant) continue
        out.push({
          kind: 'ptp-mismatch',
          severity: 'error',
          vlanId: v.vlanId,
          message:
            `${name} ist auf PTP-Domäne ${geplant} geplant, ${m.where} steht auf ` +
            `${m.ptpDomain}.`,
        })
      }
    }
  }
  return out
}

export const SEGMENT_HEADERS = [
  'VLAN',
  'Segment',
  'Zweck',
  'PTP-Domäne (geplant)',
  'Weg hinein',
  'Schnittstellen',
] as const

/** Der Entwurf als Blatt — das Dokument, das der Bedarf verlangt. */
export function segmentTable(
  equipment: readonly EquipmentItem[],
  segments: readonly NetworkSegment[],
): CsvTable {
  const namen = new Map(equipment.map((e) => [e.id, e.name]))
  return {
    headers: [...SEGMENT_HEADERS],
    rows: segmentViews(equipment, segments).map((v) => [
      v.vlanId,
      v.segment?.name?.trim() || NO_SEGMENT_NAME,
      ROLE_TEXT[v.segment?.purpose ?? 'unspecified'],
      v.segment?.ptpDomain ?? NO_PTP_IN_SEGMENT,
      v.segment?.gatewayEquipmentId
        ? (namen.get(v.segment.gatewayEquipmentId) ?? NO_GATEWAY)
        : NO_GATEWAY,
      v.members.length,
    ]),
  }
}

export const REACH_HEADERS = ['Gerät', 'Segment', 'VLAN', 'Rolle', 'Schnittstelle'] as const

/**
 * Welches Gerät in welchen Segmenten steht.
 *
 * Die Antwort auf „from one machine": ein Steuer-Rechner, der fünf
 * Anwendungen erreichen soll, steht hier mit fünf Zeilen — oder eben mit
 * einer, und dann weiss man es VOR dem Aufbau statt währenddessen.
 *
 * Der Plan behauptet dabei NICHT, dass die Verbindung steht. Er sagt, was
 * geplant ist; ob das Paket ankommt, entscheidet der Switch.
 */
export function segmentReachTable(
  equipment: readonly EquipmentItem[],
  segments: readonly NetworkSegment[],
): CsvTable {
  const nameOf = new Map(segments.map((s) => [s.vlanId, s.name?.trim() || NO_SEGMENT_NAME]))
  const rows: CsvTable['rows'] = []
  for (const { equipment: e, nic } of allDeviceInterfaces([...equipment])) {
    if (typeof nic.vlanId !== 'number' || !Number.isFinite(nic.vlanId)) continue
    rows.push([
      e.name,
      nameOf.get(nic.vlanId) ?? NO_SEGMENT_NAME,
      nic.vlanId,
      ROLE_TEXT[nic.role],
      nic.label?.trim() || 'ohne Beschriftung',
    ])
  }
  rows.sort(
    (a, b) => String(a[0]).localeCompare(String(b[0])) || Number(a[2]) - Number(b[2]),
  )
  return { headers: [...REACH_HEADERS], rows }
}

/** Normalisiert geladene Segmente — die Schema-Migrationsschicht. */
export function normaliseNetworkSegments(raw: unknown): NetworkSegment[] {
  if (!Array.isArray(raw)) return []
  const rollen: readonly NetworkInterfaceRole[] = [
    'media-primary',
    'media-secondary',
    'control',
    'management',
    'unspecified',
  ]
  const out: NetworkSegment[] = []
  const gesehen = new Set<number>()
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const r = entry as Record<string, unknown>
    const vlanId = typeof r.vlanId === 'number' ? r.vlanId : NaN
    // 1..4094 ist der nutzbare Bereich; 0 und 4095 sind reserviert. Ein
    // Datensatz ausserhalb zeigt auf kein VLAN, das jemand einrichten kann.
    //
    // GANZZAHLIG, und nicht abgeschnitten: `1.5` auf `1` zu runden erfaende
    // eine Antwort auf eine kaputte Eingabe. Eine gebrochene VLAN-Id heisst,
    // dass die Quelle falsch war — und dann ist der Datensatz weg besser als
    // im falschen Segment.
    if (!Number.isInteger(vlanId) || vlanId < 1 || vlanId > 4094) continue
    if (gesehen.has(vlanId)) continue
    gesehen.add(vlanId)
    const seg: NetworkSegment = {
      vlanId,
      name: typeof r.name === 'string' ? r.name.trim() : '',
      purpose: rollen.includes(r.purpose as NetworkInterfaceRole)
        ? (r.purpose as NetworkInterfaceRole)
        : 'unspecified',
    }
    if (typeof r.ptpDomain === 'number' && Number.isInteger(r.ptpDomain) &&
        r.ptpDomain >= 0 && r.ptpDomain <= 127) {
      seg.ptpDomain = r.ptpDomain
    }
    if (typeof r.gatewayEquipmentId === 'string' && r.gatewayEquipmentId.trim()) {
      seg.gatewayEquipmentId = r.gatewayEquipmentId.trim()
    }
    if (typeof r.note === 'string' && r.note.trim()) seg.note = r.note.trim()
    out.push(seg)
  }
  return out.sort((a, b) => a.vlanId - b.vlanId)
}
