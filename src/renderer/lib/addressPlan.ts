// ───────────────────────────────────────────────────────────────────────────
// Der Adressplan, ABGELEITET aus den Geräte-Datensätzen (Roadmap-Initiative 8).
//
// WAS DA WAR UND WAS FEHLTE. Die Netz-Ansicht der Analyse zeigt IPs, VLANs,
// Doppel-IPs und eine Subnetz-Übersicht — aber ihre Zeilenauswahl lautet
// `e.ipAddress || e.managementVlanId != null || e.vlans?.length`. Sie zeigt
// also, was ausgefüllt ist, und kann per Konstruktion nicht zeigen, was fehlt.
// Genau das ist die Frage, mit der jemand den Netzplan aufmacht: welches Gerät
// braucht noch eine Adresse?
//
// WORAUS „BRAUCHT EINE ADRESSE" ABGELEITET WIRD. Aus dem Gerät selbst, nicht
// aus seinem Namen: ein Port, dessen Standard ein IP-Transport ist (Ethernet,
// Dante, AES67, NDI, ST 2110, SRT/RTMP/HLS, PTP), oder ein RJ45-/etherCON-
// Anschluss. Das ist ein Datenblatt-Fakt, kein Regex-Treffer — dieselbe Regel,
// die `deviceTypeRegistry` für die Geräte-Rolle aufstellt.
//
// Und der Beleg wird MITGELIEFERT (`evidence`). Wer eine Zeile für falsch
// hält, soll sehen, welcher Port sie ausgelöst hat, statt der Liste glauben zu
// müssen. Eine Forderung ohne nachvollziehbaren Grund wird weggeklickt.
//
// WAS HIER BEWUSST NICHT PASSIERT: Adressen VERGEBEN. Woher Subnetze kommen —
// abgeleitet oder aus einem projektweiten Pool — ist die offene Eigentümer-
// Frage E-5, und ein Werkzeug, das währenddessen selbst welche vergibt,
// entscheidet sie stillschweigend. Dieser Plan sagt, was fehlt und was falsch
// ist; das Vergeben bleibt beim Menschen, bis E-5 entschieden ist.
//
// JEDER BEFUND IST EINE TATSACHE, KEINE VERMUTUNG. Fünf Sorten, alle
// nachrechenbar: keine Adresse an einem netzfähigen Gerät, doppelte Adresse,
// fehlende Maske (heute still als /24 angenommen), Gateway außerhalb des
// eigenen Subnetzes, Netz- oder Broadcast-Adresse als Geräte-Adresse. Ein
// „einsames Subnetz" oder „ungewöhnlicher Bereich" steht bewusst NICHT dabei:
// das wären Vermutungen, und eine Warnung, die falsch anschlägt, wird nach dem
// zweiten Mal ignoriert — dann auch die vier richtigen daneben.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentItem, Port } from '../types/equipment'
import type { SignalStandard } from '../types/cableSpec'
import { networkAddress, parseIpv4, subnetCidr } from './subnet'

/** Standards, die über ein IP-Netz laufen. Aus `SignalStandard`, nicht geraten. */
const IP_STANDARDS: ReadonlySet<SignalStandard> = new Set<SignalStandard>([
  'Eth-100', 'Eth-1G', 'Eth-10G',
  'NDI', 'NDI-HX',
  'Dante', 'AES67',
  'ST2110-20', 'ST2110-30', 'ST2110-40',
  'SRT', 'RTMP', 'HLS',
  'PTP',
])

/** Anschlussformen, die ein Netzwerkkabel aufnehmen. */
const NETWORK_CONNECTORS = new Set(['RJ45', 'etherCON'])

/**
 * Der Port, der ein Gerät netzfähig macht — oder `null`.
 *
 * Der erste Treffer genügt und wird zurückgegeben statt bloß gezählt: er ist
 * der Beleg, den die Zeile mitführt.
 */
const networkPort = (item: EquipmentItem): Port | null => {
  const ports = [...(item.inputs ?? []), ...(item.outputs ?? [])]
  return (
    ports.find((p) => p.standard && IP_STANDARDS.has(p.standard)) ??
    ports.find((p) => NETWORK_CONNECTORS.has(p.connectorType as string)) ??
    null
  )
}

export type AddressIssueKind =
  | 'missing-address'
  | 'duplicate-address'
  | 'missing-mask'
  | 'gateway-outside-subnet'
  | 'network-or-broadcast-address'

export interface AddressIssue {
  kind: AddressIssueKind
  /** Namen anderer Geräte, die dieselbe Adresse tragen. Nur bei `duplicate-address`. */
  others?: string[]
}

export interface AddressPlanRow {
  id: string
  name: string
  ip?: string
  mask?: string
  gateway?: string
  /** Subnetz in CIDR-Schreibweise, sobald Adresse und Maske dafür reichen. */
  cidr?: string
  /**
   * Das Gerät hängt am Netz und braucht deshalb eine Adresse. Abgeleitet aus
   * seinen Ports; `evidence` sagt, aus welchem.
   */
  networked: boolean
  /** Welcher Port die Netzfähigkeit belegt, im Klartext. */
  evidence?: string
  issues: AddressIssue[]
}

export interface AddressPlan {
  rows: AddressPlanRow[]
  /** Geräte am Netz ohne Adresse — die Arbeitsliste. */
  missing: AddressPlanRow[]
  /** Alles mit mindestens einem Befund, egal welcher Sorte. */
  withIssues: AddressPlanRow[]
  /** Wie viele netzfähige Geräte der Plan kennt. Nenner für „x von y adressiert". */
  networkedCount: number
}

/** Die Broadcast-Adresse eines Subnetzes, als Zeichenkette. */
const broadcastAddress = (ip: string, mask: string): string | null => {
  const a = parseIpv4(ip)
  const m = parseIpv4(mask)
  if (!a || !m) return null
  return a.map((o, i) => (o & m[i]) | (~m[i] & 255)).join('.')
}

/**
 * Ein Präfix, das gar kein Netz aufspannt (/31 und /32), hat weder Netz- noch
 * Broadcast-Adresse im üblichen Sinn — dort ist jede Adresse benutzbar
 * (RFC 3021 für Punkt-zu-Punkt-Strecken). Diese Fälle auszunehmen ist kein
 * Sonderweg, sondern die Vermeidung eines Fehlalarms auf einer völlig
 * korrekten Konfiguration.
 */
const spansNetwork = (mask: string): boolean => {
  const m = parseIpv4(mask)
  if (!m) return false
  const bits = m.reduce((n, o) => n + o.toString(2).split('1').length - 1, 0)
  return bits <= 30
}

/**
 * Adressplan aus den Geräten ableiten.
 *
 * Rein: keine Uhr, kein Store, kein IO. Die Reihenfolge folgt der Geräteliste;
 * das Sortieren gehört der Ansicht.
 */
export function buildAddressPlan(equipment: EquipmentItem[]): AddressPlan {
  // Doppelte Adressen einmal vorab, damit jede Zeile die ANDEREN nennen kann.
  const byIp = new Map<string, string[]>()
  for (const e of equipment) {
    if (!e.ipAddress) continue
    byIp.set(e.ipAddress, [...(byIp.get(e.ipAddress) ?? []), e.name])
  }

  const rows: AddressPlanRow[] = equipment.map((e) => {
    const port = networkPort(e)
    // Eine gesetzte Adresse macht ein Gerät ebenfalls zu einem Netzgerät —
    // auch wenn seine Ports nichts davon sagen. Sonst fiele ein von Hand
    // gepflegtes Gerät aus der Doppel-IP-Prüfung heraus, und ausgerechnet die
    // ist der Befund mit den handfestesten Folgen.
    const networked = !!port || !!e.ipAddress
    const issues: AddressIssue[] = []

    if (networked && !e.ipAddress) {
      issues.push({ kind: 'missing-address' })
    }

    if (e.ipAddress) {
      const others = (byIp.get(e.ipAddress) ?? []).filter((n) => n !== e.name)
      if (others.length > 0) issues.push({ kind: 'duplicate-address', others })
      if (!e.subnetMask) {
        // Die Netz-Übersicht nimmt hier still /24 an. Angenommen ist nicht
        // gewusst: sobald jemand nach dem Subnetz fragt, hängt die Antwort an
        // einer Vorgabe, die niemand gesetzt hat.
        issues.push({ kind: 'missing-mask' })
      } else {
        if (spansNetwork(e.subnetMask)) {
          const net = networkAddress(e.ipAddress, e.subnetMask)
          const bc = broadcastAddress(e.ipAddress, e.subnetMask)
          if (e.ipAddress === net || e.ipAddress === bc) {
            issues.push({ kind: 'network-or-broadcast-address' })
          }
        }
        if (e.gateway) {
          const own = networkAddress(e.ipAddress, e.subnetMask)
          const gw = networkAddress(e.gateway, e.subnetMask)
          if (own && gw && own !== gw) issues.push({ kind: 'gateway-outside-subnet' })
        }
      }
    }

    return {
      id: e.id,
      name: e.name,
      ...(e.ipAddress ? { ip: e.ipAddress } : {}),
      ...(e.subnetMask ? { mask: e.subnetMask } : {}),
      ...(e.gateway ? { gateway: e.gateway } : {}),
      ...(e.ipAddress && e.subnetMask
        ? { cidr: subnetCidr(e.ipAddress, e.subnetMask) ?? undefined }
        : {}),
      networked,
      ...(port
        ? { evidence: port.standard ? `${port.name} (${port.standard})` : `${port.name} (${port.connectorType})` }
        : {}),
      issues,
    }
  })

  return {
    rows,
    missing: rows.filter((r) => r.issues.some((i) => i.kind === 'missing-address')),
    withIssues: rows.filter((r) => r.issues.length > 0),
    networkedCount: rows.filter((r) => r.networked).length,
  }
}

/** Zeilen für den CSV-Export des Adressplans. Kopfzeile inklusive. */
export function addressPlanTable(
  plan: AddressPlan,
  label: (issue: AddressIssue) => string,
  headers: string[],
): (string | number)[][] {
  return [
    headers,
    ...plan.rows
      .filter((r) => r.networked)
      .map((r) => [
        r.name,
        r.ip ?? '',
        r.mask ?? '',
        r.gateway ?? '',
        r.cidr ?? '',
        r.evidence ?? '',
        r.issues.map(label).join('; '),
      ]),
  ]
}
