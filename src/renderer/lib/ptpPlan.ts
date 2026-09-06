// ───────────────────────────────────────────────────────────────────────────
// Der Zeit-Plan (Bedarf 73, P2). Welche PTP-Domaenen der Aufbau hat, wer
// darin die Uhr ist, und wo sich zwei Welten denselben Takt teilen sollen,
// ohne dass es geht.
//
//   > PTP domain number, grandmaster and boundary-clock topology live
//   > nowhere. No Excel network-documentation template in the German or
//   > English source set has a column for them. ST 2059-2 defaults to domain
//   > 127 while AES67 commonly uses domain 0, so mixed 2110/AES67 rigs
//   > receive packets with wrong media clocks.
//
// ─── WARUM DAS EIN BEFUND UND KEINE EINSTELLUNG IST ────────────────────────
//
// Der Plan weiss, welche Essenz ueber welches Geraet laeuft — die Standards
// haengen seit langem an den Kabeln. Er kann daraus die FRAGE stellen. Er
// kann sie nicht beantworten: ob dieser Aufbau eine Domaene oder zwei haben
// soll, entscheidet ein Mensch mit einem Boundary-Clock-Switch. Deshalb
// nennt diese Datei Widersprueche und setzt keine Zahlen.
//
// Dieselbe Haltung wie beim IGMP-Widerspruch in `venueNetworkRequest`
// (Bedarf 23): der Konflikt gehoert VOR den Aufbau gelegt, nicht aufgeloest.
//
// ─── DIE FUENF BEFUNDE, UND WARUM JEDER EINEN EIGENEN NAMEN HAT ────────────
//
// `domain-clash`   Zwei Essenz-Familien auf EINER Domaene. Das ist der
//                  belegte Schaden. Welches Profil die Domaene auch traegt —
//                  die andere Familie haengt am falschen Medientakt.
// `profile-clash`  Eine Domaene, zwei Profile. Physikalisch dieselbe Domaene,
//                  zwei Vorstellungen davon, was darin gilt.
// `off-default`    Profil und Domaene passen nicht zur Vorgabe des Profils.
//                  KEIN Fehler — abweichende Domaenen sind ueblich und oft
//                  Absicht. Aber es ist die Zahl, die man beim Fehlersuchen
//                  als Erstes sehen will, und sie steht nirgends.
// `no-grandmaster` Eine Domaene ohne Uhr. Der Aufbau laeuft trotzdem an: das
//                  BMCA waehlt irgendein Geraet. Welches, weiss dann niemand.
// `two-grandmaster` Zwei erklaerte Uhren in einer Domaene. Auch das laeuft an,
//                  und auch hier waehlt das BMCA — nur hat diesmal jemand
//                  eine Absicht gehabt, und der Plan sagt nicht, welche.
//
// `unspecified` ist NIRGENDS ein Befund. Ein Geraet ohne PTP-Angabe ist ein
// Geraet, das niemand befragt hat; das als Fehler zu melden wuerde jeden
// bestehenden Plan mit Warnungen fluten und die fuenf echten Befunde darin
// begraben.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { EquipmentItem } from '../types/equipment'
import type { Cable } from '../types/cable'
import type { NetworkInterface, PtpProfile } from '../types/network'
import { PTP_PROFILE_DEFAULT_DOMAIN } from '../types/network'
import type { SignalStandard } from '../types/cableSpec'
import type { CsvCell, CsvTable } from './csv'
import { allDeviceInterfaces, interfaceLabel } from './networkInterfaces'
import { AUDIO_MULTICAST, VIDEO_MULTICAST } from './venueNetworkRequest'

/**
 * Die Essenz-Familie, deren Takt von PTP abhaengt.
 *
 * Genau die beiden, die der Bedarf gegeneinanderstellt. `LIGHTING_MULTICAST`
 * (sACN/Art-Net) steht bewusst nicht dabei: Licht ueber IP haengt an keinem
 * PTP-Takt, und es hier mitzuzaehlen wuerde einen Widerspruch melden, den es
 * nicht gibt.
 */
export type EssenceFamily = 'audio' | 'video'

const familyOf = (std: SignalStandard | undefined): EssenceFamily | null => {
  if (!std) return null
  if (AUDIO_MULTICAST.has(std)) return 'audio'
  if (VIDEO_MULTICAST.has(std)) return 'video'
  return null
}

export const FAMILY_LABEL: Record<EssenceFamily, string> = {
  audio: 'Audio (Dante / AES67 / ST 2110-30)',
  video: 'Video (ST 2110-20 / -40)',
}

export const PROFILE_LABEL: Record<PtpProfile, string> = {
  'st2059-2': 'SMPTE ST 2059-2',
  aes67: 'AES67',
  default: 'IEEE 1588 Default',
  unspecified: 'nicht angegeben',
}

export type PtpFindingKind =
  | 'domain-clash'
  | 'profile-clash'
  | 'off-default'
  | 'no-grandmaster'
  | 'two-grandmaster'

export interface PtpFinding {
  kind: PtpFindingKind
  /** Die betroffene Domaene. */
  domain: number
  /** Menschenlesbare Begruendung mit den Zahlen, um die es geht. */
  text: string
  /** Beteiligte Geraete, fuer den Sprung in den Plan. */
  deviceIds: string[]
}

export interface PtpMember {
  equipmentId: string
  /** „Kamera 1 · Dante Sec". */
  label: string
  profile: PtpProfile
  role: NonNullable<NetworkInterface['ptpRole']>
  /** Welche PTP-abhaengige Essenz ueber DIESES Geraet laeuft. */
  families: EssenceFamily[]
}

export interface PtpDomain {
  domain: number
  members: PtpMember[]
  /** Die Profile, die in dieser Domaene erklaert sind (ohne `unspecified`). */
  profiles: PtpProfile[]
  /** Die Essenz-Familien, die in dieser Domaene zusammenkommen. */
  families: EssenceFamily[]
  grandmasters: string[]
}

export interface PtpPlan {
  domains: PtpDomain[]
  findings: PtpFinding[]
  /**
   * Geraete, ueber die PTP-abhaengige Essenz laeuft und die KEINE Domaene
   * nennen. Kein Befund (siehe Kopf), aber die Liste, die man beim Ausfuellen
   * abarbeitet.
   */
  withoutDomain: string[]
  /** Traegt der Plan ueberhaupt PTP-abhaengige Essenz? */
  needsPtp: boolean
}

/**
 * Welche PTP-abhaengigen Familien ueber ein Geraet laufen — aus dem
 * Kabelgraph, nicht aus einem Feld.
 *
 * Abgeleitet aus demselben Grund wie ueberall: ein gespeichertes Feld waere
 * ab dem ersten umgesteckten Kabel falsch, und beim Zeit-Plan faellt das erst
 * am Showtag auf.
 */
export function familiesByDevice(
  equipment: readonly EquipmentItem[],
  cables: readonly Cable[],
): Map<string, EssenceFamily[]> {
  const out = new Map<string, Set<EssenceFamily>>()
  const add = (id: string, fam: EssenceFamily) => {
    const s = out.get(id) ?? new Set<EssenceFamily>()
    s.add(fam)
    out.set(id, s)
  }
  const known = new Set(equipment.map((e) => e.id))
  for (const c of cables) {
    const fam = familyOf(c.standard)
    if (!fam) continue
    if (known.has(c.fromEquipmentId)) add(c.fromEquipmentId, fam)
    if (known.has(c.toEquipmentId)) add(c.toEquipmentId, fam)
  }
  const m = new Map<string, EssenceFamily[]>()
  for (const [id, s] of out) m.set(id, [...s].sort())
  return m
}

/** Der ganze Zeit-Plan. */
export function buildPtpPlan(
  equipment: readonly EquipmentItem[],
  cables: readonly Cable[],
): PtpPlan {
  const families = familiesByDevice(equipment, cables)
  const needsPtp = families.size > 0

  const byDomain = new Map<number, PtpMember[]>()
  const withoutDomain: string[] = []

  for (const { equipment: e, nic } of allDeviceInterfaces([...equipment])) {
    const fam = families.get(e.id) ?? []
    if (typeof nic.ptpDomain !== 'number' || !Number.isFinite(nic.ptpDomain)) {
      // Nur melden, wenn ueber das Geraet ueberhaupt PTP-abhaengige Essenz
      // laeuft — eine Steuer-NIC im Haus-Netz braucht keine Domaene, und sie
      // hier aufzufuehren waere Rauschen.
      if (fam.length && !withoutDomain.includes(e.id)) withoutDomain.push(e.id)
      continue
    }
    const liste = byDomain.get(nic.ptpDomain) ?? []
    liste.push({
      equipmentId: e.id,
      label: interfaceLabel(e, nic),
      profile: nic.ptpProfile ?? 'unspecified',
      role: nic.ptpRole ?? 'unspecified',
      families: fam,
    })
    byDomain.set(nic.ptpDomain, liste)
  }

  const domains: PtpDomain[] = [...byDomain.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([domain, members]) => ({
      domain,
      members,
      profiles: [...new Set(members.map((m) => m.profile))]
        .filter((p) => p !== 'unspecified')
        .sort(),
      families: [...new Set(members.flatMap((m) => m.families))].sort(),
      grandmasters: members.filter((m) => m.role === 'grandmaster').map((m) => m.label),
    }))

  const findings: PtpFinding[] = []
  for (const d of domains) {
    const ids = [...new Set(d.members.map((m) => m.equipmentId))]

    if (d.families.length > 1) {
      findings.push({
        kind: 'domain-clash',
        domain: d.domain,
        text:
          `Domaene ${d.domain} traegt ${d.families.map((f) => FAMILY_LABEL[f]).join(' und ')}. ` +
          `ST 2059-2 steht per Vorgabe auf 127, AES67 in der Praxis auf 0 — auf einer ` +
          `gemeinsamen Domaene haengt eine der beiden Familien am falschen Medientakt. ` +
          `Entweder zwei Domaenen mit einer Boundary Clock dazwischen, oder ein ` +
          `erklaerter Grund, warum es hier ohne geht.`,
        deviceIds: ids,
      })
    }

    if (d.profiles.length > 1) {
      findings.push({
        kind: 'profile-clash',
        domain: d.domain,
        text:
          `Domaene ${d.domain} traegt zwei Profile: ` +
          `${d.profiles.map((p) => PROFILE_LABEL[p]).join(' und ')}. Dieselbe Domaene, ` +
          `zwei Vorstellungen davon, was darin gilt.`,
        deviceIds: ids,
      })
    }

    for (const m of d.members) {
      const vorgabe = PTP_PROFILE_DEFAULT_DOMAIN[m.profile]
      if (vorgabe !== null && vorgabe !== d.domain) {
        findings.push({
          kind: 'off-default',
          domain: d.domain,
          text:
            `${m.label}: Profil ${PROFILE_LABEL[m.profile]} auf Domaene ${d.domain}. ` +
            `Die Vorgabe dieses Profils ist ${vorgabe}. Das ist kein Fehler — aber es ` +
            `ist die Zahl, die man beim Fehlersuchen als Erstes sehen will.`,
          deviceIds: [m.equipmentId],
        })
      }
    }

    if (d.grandmasters.length === 0) {
      findings.push({
        kind: 'no-grandmaster',
        domain: d.domain,
        text:
          `Domaene ${d.domain} nennt keine Uhr. Der Aufbau laeuft trotzdem an — das ` +
          `BMCA waehlt ein Geraet aus. Welches, steht dann nirgends.`,
        deviceIds: ids,
      })
    } else if (d.grandmasters.length > 1) {
      findings.push({
        kind: 'two-grandmaster',
        domain: d.domain,
        text:
          `Domaene ${d.domain} nennt ${d.grandmasters.length} Uhren ` +
          `(${d.grandmasters.join(', ')}). Auch das laeuft an, und auch hier waehlt das ` +
          `BMCA — nur hatte diesmal jemand eine Absicht, und der Plan sagt nicht, welche.`,
        deviceIds: ids,
      })
    }
  }

  return { domains, findings, withoutDomain, needsPtp }
}

export const PTP_FINDING_LABEL: Record<PtpFindingKind, string> = {
  'domain-clash': 'Zwei Essenz-Familien auf einer Domaene',
  'profile-clash': 'Zwei Profile auf einer Domaene',
  'off-default': 'Domaene weicht von der Profil-Vorgabe ab',
  'no-grandmaster': 'Domaene ohne erklaerte Uhr',
  'two-grandmaster': 'Domaene mit mehreren erklaerten Uhren',
}

/**
 * Das Blatt: eine Zeile je Schnittstelle in einer Domaene.
 *
 * Bewusst die MITGLIEDER und nicht die Befunde. Der Bedarf sagt, dass die
 * Spalten in keiner Vorlage vorkommen — was fehlt, ist die Aufstellung, nicht
 * die Mahnung. Die Befunde stehen in der Oberflaeche daneben.
 */
export function ptpTable(plan: PtpPlan): CsvTable {
  const rows: CsvCell[][] = []
  for (const d of plan.domains) {
    for (const m of d.members) {
      rows.push([
        d.domain,
        m.label,
        PROFILE_LABEL[m.profile],
        m.role === 'unspecified' ? '' : m.role,
        m.families.map((f) => FAMILY_LABEL[f]).join(' + '),
      ])
    }
  }
  return {
    headers: ['Domaene', 'Schnittstelle', 'Profil', 'Rolle', 'Essenz'],
    rows,
  }
}
