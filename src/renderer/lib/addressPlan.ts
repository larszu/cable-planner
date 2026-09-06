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
import type { ConnectorType, EquipmentItem, Port } from '../types/equipment'
import type { SignalStandard } from '../types/cableSpec'
import type { NetworkInterfaceRole } from '../types/network'
import { networkAddress, parseIpv4, subnetCidr } from './subnet'
import { allDeviceInterfaces, deviceInterfaces, interfaceLabel, primaryInterfaceId } from './networkInterfaces'

/** Standards, die über ein IP-Netz laufen. Aus `SignalStandard`, nicht geraten. */
const IP_STANDARDS: ReadonlySet<SignalStandard> = new Set<SignalStandard>([
  'Eth-100', 'Eth-1G', 'Eth-10G',
  'NDI', 'NDI-HX',
  'Dante', 'AES67',
  'ST2110-20', 'ST2110-30', 'ST2110-40',
  'SRT', 'RTMP', 'HLS',
  'PTP',
])

/**
 * Anschlussformen, die ein Netzwerkkabel aufnehmen.
 *
 * BERICHTIGT: hier standen `'RJ45'` und `'etherCON'` — **beide gibt es in
 * `ConnectorType` nicht.** Die Union kennt `'Ethernet/RJ45'` und `'GG45'`; der
 * Anschluss-Rueckfall traf damit kein einziges echtes Geraet, und der Test, der
 * ihn belegte, trug ein Fixture mit `connectorType: 'RJ45'` — einen Wert, den
 * kein Katalog-Geraet je haben kann. Verglichen worden war der Feldname, nicht
 * der Wertebereich; genau derselbe Fehler wie bei der Rollen-Id gegen
 * `guide_server.py` (`cable#674`).
 *
 * Der Typ ist deshalb jetzt `ConnectorType` und nicht `string`: ein Tippfehler
 * faellt beim Uebersetzen auf, nicht beim Kunden. `tests/addressPlan.test.ts`
 * prueft zusaetzlich, dass jeder Eintrag in `ALL_CONNECTOR_TYPES` vorkommt —
 * ein Typ allein haette den alten Wert auch abgefangen, aber nur, wenn jemand
 * ihn ueberhaupt annotiert.
 *
 * SFP, SFP+ und Fiber stehen bewusst NICHT dabei: ueber sie laeuft genauso oft
 * SDI. Fuer sie greift die erste Regel (ein IP-Standard am Port), und die ist
 * ein Beleg statt einer Bauform-Vermutung.
 */
export const NETWORK_CONNECTORS: ReadonlySet<ConnectorType> = new Set<ConnectorType>([
  'Ethernet/RJ45',
  'GG45',
])

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
    ports.find((p) => NETWORK_CONNECTORS.has(p.connectorType)) ??
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
  /** Geraete-Id. Mehrere Zeilen desselben Geraets teilen sie sich. */
  id: string
  name: string
  /**
   * Welche Schnittstelle diese Zeile ist (Bedarf 19). Zeilen sind **je
   * Schnittstelle** und nicht je Geraet: ein Geraet mit Dante primaer und
   * sekundaer hat zwei Adressen, und eine Doppel-IP-Pruefung, die nur die
   * erste sieht, uebersieht genau die Haelfte eines redundanten Aufbaus.
   */
  nicId: string
  /** Beschriftung der Schnittstelle („Dante Sec"). Fehlt bei Schnittstelle 0. */
  nicLabel?: string
  /** Wofuer die Schnittstelle da ist. `unspecified`, wenn niemand es sagte. */
  role: NetworkInterfaceRole
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
  // Bedarf 19 — ueber SCHNITTSTELLEN, nicht ueber Geraete. Ein Geraet mit
  // Dante primaer und sekundaer traegt zwei Adressen; die alte Fassung sah nur
  // `item.ipAddress` und uebersah damit genau die Haelfte eines redundanten
  // Aufbaus — ausgerechnet in der Pruefung, die vor Doppel-IPs warnt.
  const nics = allDeviceInterfaces(equipment)

  // Doppelte Adressen einmal vorab, damit jede Zeile die ANDEREN nennen kann.
  // Der Schluessel ist die SCHNITTSTELLE und nicht das Geraet: sonst meldete
  // ein Geraet mit zwei Karten sich selbst.
  const byIp = new Map<string, Array<{ nicId: string; label: string }>>()
  for (const { equipment: e, nic } of nics) {
    if (!nic.ipAddress) continue
    byIp.set(nic.ipAddress, [
      ...(byIp.get(nic.ipAddress) ?? []),
      { nicId: nic.id, label: interfaceLabel(e, nic) },
    ])
  }

  const rows: AddressPlanRow[] = []

  for (const e of equipment) {
    const own = deviceInterfaces(e)
    const port = networkPort(e)
    // Netzfaehig, wenn ein Port es sagt ODER irgendeine Schnittstelle eine
    // Adresse traegt. Sonst fiele ein von Hand gepflegtes Geraet aus der
    // Doppel-IP-Pruefung heraus — der Befund mit den handfestesten Folgen.
    const networked = !!port || own.length > 0
    const evidence = port
      ? port.standard
        ? `${port.name} (${port.standard})`
        : `${port.name} (${port.connectorType})`
      : undefined

    if (own.length === 0) {
      // Nichts eingetragen, an keiner Schnittstelle. EINE Zeile, damit die
      // Arbeitsliste das Geraet nennt statt zu schweigen.
      rows.push({
        id: e.id,
        name: e.name,
        nicId: primaryInterfaceId(e.id),
        role: e.primaryInterfaceRole ?? 'unspecified',
        networked,
        ...(evidence ? { evidence } : {}),
        issues: networked ? [{ kind: 'missing-address' as const }] : [],
      })
      continue
    }

    for (const nic of own) {
      const issues: AddressIssue[] = []
      if (!nic.ipAddress) {
        issues.push({ kind: 'missing-address' })
      } else {
        const others = (byIp.get(nic.ipAddress) ?? [])
          .filter((o) => o.nicId !== nic.id)
          .map((o) => o.label)
        if (others.length > 0) issues.push({ kind: 'duplicate-address', others })
        if (!nic.subnetMask) {
          // Die Netz-Uebersicht nimmt hier still /24 an. Angenommen ist nicht
          // gewusst: sobald jemand nach dem Subnetz fragt, haengt die Antwort
          // an einer Vorgabe, die niemand gesetzt hat.
          issues.push({ kind: 'missing-mask' })
        } else {
          if (spansNetwork(nic.subnetMask)) {
            const net = networkAddress(nic.ipAddress, nic.subnetMask)
            const bc = broadcastAddress(nic.ipAddress, nic.subnetMask)
            if (nic.ipAddress === net || nic.ipAddress === bc) {
              issues.push({ kind: 'network-or-broadcast-address' })
            }
          }
          if (nic.gateway) {
            const ownNet = networkAddress(nic.ipAddress, nic.subnetMask)
            const gw = networkAddress(nic.gateway, nic.subnetMask)
            if (ownNet && gw && ownNet !== gw) issues.push({ kind: 'gateway-outside-subnet' })
          }
        }
      }

      rows.push({
        id: e.id,
        name: e.name,
        nicId: nic.id,
        ...(nic.label ? { nicLabel: nic.label } : {}),
        role: nic.role,
        ...(nic.ipAddress ? { ip: nic.ipAddress } : {}),
        ...(nic.subnetMask ? { mask: nic.subnetMask } : {}),
        ...(nic.gateway ? { gateway: nic.gateway } : {}),
        ...(nic.ipAddress && nic.subnetMask
          ? { cidr: subnetCidr(nic.ipAddress, nic.subnetMask) ?? undefined }
          : {}),
        networked: true,
        ...(evidence ? { evidence } : {}),
        issues,
      })
    }
  }

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
        r.nicLabel ? `${r.name} · ${r.nicLabel}` : r.name,
        r.ip ?? '',
        r.mask ?? '',
        r.gateway ?? '',
        r.cidr ?? '',
        r.evidence ?? '',
        r.issues.map(label).join('; '),
      ]),
  ]
}
