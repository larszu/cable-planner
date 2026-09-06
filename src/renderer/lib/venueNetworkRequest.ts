// ───────────────────────────────────────────────────────────────────────────
// Das Haus-IT-Anforderungsblatt und die Netz-Dokumente (Bedarfe 23 und 22,
// beide P1).
//
// BEDARF 23 IST EIN ORGANISATIONS-PROBLEM MIT EINER TECHNISCHEN URSACHE:
//
//   > There is no agreed document for asking a venue's IT department for
//   > VLANs, address ranges, multicast, IGMP querier behaviour, DHCP scope,
//   > port count, PoE and bandwidth.
//
// Der Rollen-Bericht sagt dasselbe mit Quellen: die AV-over-IP-Literatur
// (Crestron, Ruckus) schreibt den INHALT vor — VLANs, IP-Bereiche,
// Multicast-Unterstuetzung, Switch-Faehigkeit, QoS — und einen gemeinsamen
// Testtermin, aber KEIN Dokument. Church Productions praktische Empfehlung
// ist ein monatliches Treffen zwischen AV und IT: eine organisatorische
// Notloesung fuer ein fehlendes Blatt. Die Bedarfs-Datenbank nennt den Bau
// „low build cost, and it addresses the role's most-cited organisational
// blocker".
//
// ─── DIE REGEL, DIE DAS BLATT BRAUCHBAR MACHT ──────────────────────────────
//
// **Jede Zeile sagt, ob sie ABGELEITET oder eine FRAGE ist.** Der Plan kennt
// seine VLANs, seine Adressbereiche, seine Portzahl und seine Bandbreite — die
// stehen mit Zahlen da. Er kennt die DHCP-Reichweite des Hauses NICHT, und er
// kennt dessen IGMP-Verhalten nicht. Beides trotzdem auszufuellen hiesse, dem
// Netzwerk-Administrator eine Behauptung ueber sein eigenes Netz vorzulegen —
// und genau daran scheitert das Gespraech, das dieses Blatt eroeffnen soll.
//
// ─── DER WIDERSPRUCH, DER DRINBLEIBT ───────────────────────────────────────
//
// Der Rollen-Bericht haelt ihn ausdruecklich fest:
//
//   > Note the contradiction the engineer is standing in the middle of: the
//   > audio vendor's field advice is *turn multicast management off*, and the
//   > video/2110 side cannot work without it. On a shared event network those
//   > two pieces of advice are mutually exclusive, and resolving that per
//   > venue is unpaid design work.
//
// Belegt auf beiden Seiten: „turning on IGMP snooping on certain switches can
// disable 100 % of the Dante multicast traffic and kill it dead" und
// Audinates Empfehlung, Switches „neutral" zu lassen (kein DHCP, kein
// Multicast-Filter, kein IGMP-Snooping) — gegen ST 2110, das ohne
// Multicast-Verwaltung nicht traegt.
//
// Dieses Modul LOEST den Widerspruch nicht auf. Es erkennt ihn im Plan (beide
// Sorten vorhanden) und schreibt ihn samt beider Quellen auf das Blatt, damit
// er VOR dem Aufbau verhandelt wird statt um zwei Uhr nachts entdeckt.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'
import type { SignalStandard } from '../types/cableSpec'
import { bandwidthMbpsForStandard } from '../types/cableSpec'
import { allDeviceInterfaces } from './networkInterfaces'
import { buildAddressPlan } from './addressPlan'
import { subnetCidr } from './subnet'
import type { CsvCell, CsvTable } from './csv'

/**
 * Standards, die im Netz mit Multicast arbeiten — und damit vom IGMP-Verhalten
 * des Hauses abhaengen.
 *
 * Getrennt nach Lager, weil genau daran der Widerspruch haengt: die
 * Audio-Seite bekommt vom Hersteller den Rat, Multicast-Verwaltung
 * abzuschalten; die 2110-Seite kann ohne sie nicht arbeiten.
 */
export const AUDIO_MULTICAST: ReadonlySet<SignalStandard> = new Set<SignalStandard>([
  'Dante',
  'AES67',
  'ST2110-30',
])

export const VIDEO_MULTICAST: ReadonlySet<SignalStandard> = new Set<SignalStandard>([
  'ST2110-20',
  'ST2110-40',
])

/** Licht ueber IP — eigene Multicast-Gruppen, und im Haus-Netz derselbe Fall. */
export const LIGHTING_MULTICAST: ReadonlySet<SignalStandard> = new Set<SignalStandard>([
  'sACN',
  'Art-Net',
])

/** Woher der Inhalt einer Zeile kommt. */
export type RequestOrigin =
  /** Aus dem Plan gerechnet. Steht mit Zahl da. */
  | 'derived'
  /** Kann der Plan nicht wissen — es ist eine Frage an das Haus. */
  | 'question'

export interface RequestItem {
  /** Stabiler Schluessel; die Oberflaeche uebersetzt ihn. */
  key: string
  origin: RequestOrigin
  /** Der abgeleitete Wert im Klartext. Fehlt bei `question`. */
  value?: string
  /** Warum der Plan es nicht wissen kann — nur bei `question`. */
  why?: string
  /** Fundstelle, wo eine Zahl aus einer Quelle stammt. */
  source?: string
}

export interface VenueNetworkRequest {
  items: RequestItem[]
  /** Der belegte Widerspruch, wenn der Plan beide Sorten traegt. */
  igmpConflict?: { audio: string[]; video: string[] }
  /** VLANs im Plan, aufsteigend. */
  vlans: number[]
  /** Subnetze im Plan, in CIDR-Schreibweise. */
  subnets: string[]
  /** Netzfaehige Schnittstellen — die Portzahl, die das Haus stellen muss. */
  interfaceCount: number
  /** Summe der Medien-Bandbreite in Mbit/s. */
  mediaMbps: number
}

const nummer = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

/**
 * Das Anforderungsblatt aus dem Plan.
 *
 * `equipment` und `cables` sind alles, was gebraucht wird — das Blatt ist eine
 * Ableitung und kein zweites Datenmodell. Genau das ist die Zusage aus
 * Bedarf 22: „Export artefacts other departments actually consume, generated
 * from one model."
 */
export function buildVenueNetworkRequest(
  equipment: EquipmentItem[],
  cables: Cable[],
): VenueNetworkRequest {
  const nics = allDeviceInterfaces(equipment)
  const plan = buildAddressPlan(equipment)

  // VLANs: aus den Schnittstellen und aus den VLAN-Definitionen der Switches.
  const vlanSet = new Set<number>()
  for (const { nic } of nics) if (nic.vlanId !== undefined) vlanSet.add(nic.vlanId)
  for (const e of equipment) {
    if (e.managementVlanId !== undefined) vlanSet.add(e.managementVlanId)
    for (const v of e.vlans ?? []) {
      const id = nummer((v as { id?: unknown }).id)
      if (id !== undefined) vlanSet.add(id)
    }
  }
  const vlans = [...vlanSet].sort((a, b) => a - b)

  // Subnetze: aus dem Adressplan, also aus denselben Geraete-Datensaetzen.
  const subnetSet = new Set<string>()
  for (const r of plan.rows) {
    if (r.ip && r.mask) {
      const c = subnetCidr(r.ip, r.mask)
      if (c) subnetSet.add(c)
    }
  }
  const subnets = [...subnetSet].sort()

  // Bandbreite: nur Medien, nicht Link-Kapazitaet. Dieselbe Trennung, die der
  // Netz-Budget-Rechner nach dem Befund von 2026-09-04 einhaelt.
  let mediaMbps = 0
  const audio = new Set<string>()
  const video = new Set<string>()
  const licht = new Set<string>()
  for (const c of cables) {
    const std = (c as { standard?: SignalStandard }).standard
    const mbps = bandwidthMbpsForStandard(std)
    if (mbps) mediaMbps += mbps
    if (std && AUDIO_MULTICAST.has(std)) audio.add(std)
    if (std && VIDEO_MULTICAST.has(std)) video.add(std)
    if (std && LIGHTING_MULTICAST.has(std)) licht.add(std)
  }
  // Auch Ports zaehlen: ein Plan kann ein Geraet fuehren, dessen Kabel noch
  // fehlt, und die Multicast-Frage haengt am Geraet und nicht am Kabel.
  for (const e of equipment) {
    for (const p of [...(e.inputs ?? []), ...(e.outputs ?? [])]) {
      const std = p.standard
      if (std && AUDIO_MULTICAST.has(std)) audio.add(std)
      if (std && VIDEO_MULTICAST.has(std)) video.add(std)
      if (std && LIGHTING_MULTICAST.has(std)) licht.add(std)
    }
  }

  // PoE: nur, wo ein Geraet es ausdruecklich fuehrt. Aus der Portzahl auf PoE
  // zu schliessen waere geraten — die meisten AV-Geraete haben ein Netzteil.
  let poeBudget = 0
  const poeStandards = new Set<string>()
  for (const e of equipment) {
    const props = e.categoryProps ?? {}
    const w = nummer(props.poeBudgetW)
    if (w) poeBudget += w
    const std = props.poeStandard
    if (typeof std === 'string' && std && std !== 'none') poeStandards.add(std)
  }

  const items: RequestItem[] = [
    {
      key: 'vlans',
      origin: 'derived',
      value: vlans.length > 0 ? vlans.join(', ') : '—',
    },
    {
      key: 'subnets',
      origin: 'derived',
      value: subnets.length > 0 ? subnets.join(', ') : '—',
    },
    {
      key: 'ports',
      origin: 'derived',
      value: String(nics.length),
    },
    {
      key: 'bandwidth',
      origin: 'derived',
      value: `${mediaMbps} Mbit/s`,
      source:
        'Summe der Medien-Standards im Plan; Link-Kapazitaet zaehlt bewusst nicht mit. ' +
        'Planungsrichtwert fuer eine Konferenz mit drei Streams: mindestens 100 Mbit/s ' +
        'dedizierter Upload, getrennt vom Besuchernetz (trivisionstudios.com)',
    },
    {
      key: 'multicast',
      origin: 'derived',
      value:
        [...audio, ...video, ...licht].length > 0
          ? [...audio, ...video, ...licht].join(', ')
          : '—',
      source:
        'Shure, „Dante networks and IGMP snooping"; Arista, Multicast Addressing (ST 2110)',
    },
    poeStandards.size > 0 || poeBudget > 0
      ? {
          key: 'poe',
          origin: 'derived' as const,
          value: `${poeBudget} W${poeStandards.size > 0 ? ` (${[...poeStandards].join(', ')})` : ''}`,
        }
      : {
          key: 'poe',
          origin: 'question' as const,
          why: 'Kein Geraet im Plan fuehrt ein PoE-Budget. Aus der Portzahl darauf zu schliessen waere geraten — die meisten AV-Geraete haben ein Netzteil.',
        },
    {
      key: 'igmpQuerier',
      origin: 'question',
      why:
        'Wer im Haus ist IGMP-Querier, und ist es genau einer? Der Plan kann das nicht wissen. ' +
        'Die Praxis nennt beide Fehler: „only one IGMP querier should be turned on", und ' +
        '„turning on IGMP snooping on certain switches can disable 100 % of the Dante multicast traffic".',
      source: 'Blue Room, Dante switch performance; ControlBooth 47261',
    },
    {
      key: 'dhcp',
      origin: 'question',
      why:
        'Gibt es DHCP in diesen VLANs, und in welchem Bereich? Der Plan arbeitet mit festen ' +
        'Adressen; ein zweiter, unbekannter DHCP-Dienst im selben Netz ist ein benannter ' +
        'Ausfallgrund. Audinates Feldrat fuer AV-Switches lautet ausdruecklich: kein DHCP anbieten.',
      source: 'Blue Room, Dante switch performance',
    },
    {
      key: 'qos',
      origin: 'question',
      why:
        'Welche QoS-/DSCP-Behandlung ist im Haus gesetzt, und bleibt sie ueber alle beteiligten ' +
        'Switches gleich? Die Design-Literatur schreibt QoS als Inhalt vor, nennt aber keine Werte; ' +
        'und uneinheitliche Switches sind selbst die Gefahr: „if the network uses different types of ' +
        'switches, the configurations may not behave as intended even if set correctly".',
      source: 'Crestron, AV-over-IP Network Design; Ruckus; ControlBooth 47261',
    },
    {
      key: 'jointTest',
      origin: 'question',
      why:
        'Wann findet der gemeinsame Testtermin statt? Die Design-Literatur schreibt ihn vor und ' +
        'liefert kein Dokument dafuer; die praktische Ersatzloesung der Branche ist ein monatliches ' +
        'Treffen zwischen AV und IT — eine Organisationsform fuer ein fehlendes Blatt.',
      source: 'Crestron; Ruckus; Church Production',
    },
  ]

  const out: VenueNetworkRequest = {
    items,
    vlans,
    subnets,
    interfaceCount: nics.length,
    mediaMbps,
  }
  if (audio.size > 0 && video.size > 0) {
    out.igmpConflict = { audio: [...audio], video: [...video] }
  }
  return out
}

/** Das Anforderungsblatt als Tabelle. Kanonisches Deutsch. */
export function venueRequestTable(req: VenueNetworkRequest): CsvTable {
  const label: Record<string, string> = {
    vlans: 'VLANs',
    subnets: 'Adressbereiche',
    ports: 'Netz-Ports (Schnittstellen im Plan)',
    bandwidth: 'Medien-Bandbreite',
    multicast: 'Multicast-Standards im Plan',
    poe: 'PoE',
    igmpQuerier: 'IGMP-Querier',
    dhcp: 'DHCP',
    qos: 'QoS / DSCP',
    jointTest: 'Gemeinsamer Testtermin',
  }
  return {
    headers: ['Punkt', 'Art', 'Aus dem Plan', 'Frage an das Haus', 'Quelle'],
    rows: req.items.map((i): CsvCell[] => [
      label[i.key] ?? i.key,
      i.origin === 'derived' ? 'abgeleitet' : 'Frage',
      i.value ?? '',
      i.why ?? '',
      i.source ?? '',
    ]),
  }
}

/**
 * Das Rack-Tuer-Blatt (Bedarf 22): welches Geraet, welche Adresse, welches
 * VLAN — das Blatt, das an der Rack-Tuer haengt und die Frage „was ist die IP
 * von X?" beantwortet, ohne dass jemand auf Comms fragen muss.
 *
 * Getrennt vom Adressplan, weil es einen anderen Zweck hat: der Adressplan
 * zeigt, was FEHLT; dieses Blatt zeigt, was IST, und nur das. Befunde stehen
 * bewusst nicht drauf — an der Rack-Tuer hilft eine Warnung nicht, dort hilft
 * eine Zahl.
 */
export function rackDoorSheetTable(equipment: EquipmentItem[]): CsvTable {
  const rows: CsvCell[][] = []
  for (const { equipment: e, nic } of allDeviceInterfaces(equipment)) {
    if (!nic.ipAddress) continue
    rows.push([
      e.name,
      nic.label ?? '',
      nic.ipAddress,
      nic.subnetMask ?? '',
      nic.gateway ?? '',
      nic.vlanId ?? '',
      nic.macAddress ?? '',
    ])
  }
  return {
    headers: ['Geraet', 'Schnittstelle', 'IP', 'Maske', 'Gateway', 'VLAN', 'MAC'],
    rows,
  }
}

/** Die VLAN-Tabelle (Bedarf 22): welches VLAN traegt was. */
export function vlanTable(equipment: EquipmentItem[]): CsvTable {
  const byVlan = new Map<number, string[]>()
  for (const { equipment: e, nic } of allDeviceInterfaces(equipment)) {
    if (nic.vlanId === undefined) continue
    const name = nic.label ? `${e.name} · ${nic.label}` : e.name
    byVlan.set(nic.vlanId, [...(byVlan.get(nic.vlanId) ?? []), name])
  }
  return {
    headers: ['VLAN', 'Geraete', 'Anzahl'],
    rows: [...byVlan.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([id, names]): CsvCell[] => [id, names.join(', '), names.length]),
  }
}
