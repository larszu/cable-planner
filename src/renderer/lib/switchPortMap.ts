// ───────────────────────────────────────────────────────────────────────────
// Die Switch-Port-Karte (Bedarf 24, P1).
//
// DER BEFUND, AUS DEM SIE KOMMT:
//
//   > Switch port descriptions are often the only documentation physically
//   > co-located with the hardware, and they go stale first; when they do,
//   > tracing a cable becomes a physical task.
//
// Die deutsche Praxis dazu ist eine Excel-Mappe mit einem Reiter je Switch,
// Ports als Spalten und VLANs als Zeilen, von Hand gepflegt
// (lancom-forum.de, mcseboard.de, vorlagesheet.com/switch-port-belegung/).
// Genau diese Mappe ist die zweite Wahrheit neben dem Plan — und sie ist die,
// die zuerst veraltet.
//
// DIE LOESUNG DER BEDARFS-DATENBANK, woertlich: „Model switch, port, and the
// cable that occupies it as part of the same connection graph the cable
// planner already holds, then generate the port map and the port-description
// list rather than maintaining them."
//
// GENAU DAS TUT DIESE DATEI — UND NICHT MEHR. Der Satz geht weiter: „Do NOT
// push config to live switches — generating a paste-able description block is
// the defensible" Weg. Hier entsteht also Text zum Einfuegen, kein
// Konfigurationskanal. Wer die Beschriftung einspielt, ist ein Mensch mit
// einer Konsole, der vorher gelesen hat, was er einfuegt.
//
// ZWEI QUELLEN JE BELEGUNG, und die Karte sagt welche:
//   `interface` — eine Schnittstelle nennt Switch und Port ausdruecklich.
//                 Das ist die gepflegte Angabe.
//   `cable`     — ein Kabel im Plan endet an einem Port dieses Switches.
//                 Das ist die abgeleitete: der Plan weiss, was dort steckt,
//                 auch wenn niemand es in die Netz-Maske getippt hat.
// Eine Belegung ohne Herkunft waere eine Behauptung; mit ihr kann jemand
// entscheiden, welcher er glaubt, wenn beide etwas sagen.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { Cable } from '../types/cable'
import type { EquipmentItem, Port } from '../types/equipment'
import type { CsvCell, CsvTable } from './csv'
import { portDisplayLabel } from './portLabel'
import { allDeviceInterfaces } from './networkInterfaces'
import { detectNetworkDevice } from './deviceKind'

/** Woher die Belegung eines Switch-Ports stammt. */
export type PortOccupancySource = 'interface' | 'cable'

export interface SwitchPortRow {
  /** Port am Switch, wie er dort aufgedruckt ist. */
  port: string
  /** Was dort haengt — Geraetename. Leer heisst: frei. */
  device?: string
  deviceId?: string
  /** Die Schnittstelle am Gegenueber, wenn sie benannt ist. */
  nicLabel?: string
  ipAddress?: string
  vlanId?: number
  /** Woher die Belegung kommt. Fehlt bei freien Ports. */
  source?: PortOccupancySource
  /**
   * Beide Quellen sagen etwas, und sie widersprechen sich — die
   * Schnittstelle nennt einen anderen Port als das Kabel.
   * Der Text nennt den jeweils anderen, damit jemand nachsehen kann.
   */
  conflict?: string
}

export interface SwitchPortMap {
  switchId: string
  switchName: string
  rows: SwitchPortRow[]
  /** Wie viele der aufgefuehrten Ports belegt sind. */
  usedCount: number
}

/**
 * Ein Geraet gilt als Switch, wenn `detectNetworkDevice` es sagt.
 *
 * NICHT selbst geraten: der erste Entwurf hier stand auf
 * `category === 'network' || /switch/i.test(deviceTypeId)`. Beides war falsch —
 * die Kategorien sind deutsch (`Netzwerk`), und die Geraetetyp-Id ist eine
 * GUID ohne sprechenden Text. `detectNetworkDevice` loest zuerst ueber das
 * Katalog-Register auf (Datenblatt-Tatsache, ADR-002) und faellt erst danach
 * auf Namen und Port-Struktur zurueck. Eine zweite Erkennung neben dieser
 * waere genau die zweite Wahrheit, gegen die ADR-001 geschrieben ist.
 */
const isSwitch = (e: EquipmentItem): boolean => detectNetworkDevice(e) === 'switch'

/**
 * Die Ports eines Switches, in der Reihenfolge, in der sie am Geraet stehen.
 * Ein Switch fuehrt seine Ports als `inputs`/`outputs` wie jedes andere
 * Geraet; fuer die Karte zaehlt die Beschriftung, nicht die Richtung.
 */
const switchPorts = (sw: EquipmentItem): Port[] => [...(sw.inputs ?? []), ...(sw.outputs ?? [])]

/**
 * Port-Karten fuer alle Switches im Plan.
 *
 * `switches` kann von aussen eingeschraenkt werden (etwa auf ein ausgewaehltes
 * Geraet); ohne Angabe werden alle gefunden.
 */
export function buildSwitchPortMaps(
  equipment: EquipmentItem[],
  cables: Cable[],
  onlySwitchId?: string,
): SwitchPortMap[] {
  const byId = new Map(equipment.map((e) => [e.id, e]))
  const switches = equipment.filter(
    (e) => (onlySwitchId ? e.id === onlySwitchId : isSwitch(e)),
  )
  const nics = allDeviceInterfaces(equipment)

  return switches.map((sw) => {
    const ports = switchPorts(sw)
    const portNames = ports.map((p) => portDisplayLabel(p) || p.id)

    // 1. Belegungen aus den Schnittstellen — die gepflegte Angabe.
    const fromNic = new Map<string, SwitchPortRow>()
    for (const { equipment: e, nic } of nics) {
      if (nic.switchEquipmentId !== sw.id || !nic.switchPort) continue
      fromNic.set(nic.switchPort, {
        port: nic.switchPort,
        device: e.name,
        deviceId: e.id,
        ...(nic.label ? { nicLabel: nic.label } : {}),
        ...(nic.ipAddress ? { ipAddress: nic.ipAddress } : {}),
        ...(nic.vlanId !== undefined ? { vlanId: nic.vlanId } : {}),
        source: 'interface',
      })
    }

    // 2. Belegungen aus dem Kabelgraphen — was der Plan ohnehin weiss.
    const fromCable = new Map<string, SwitchPortRow>()
    for (const c of cables) {
      const ends: Array<[string, string, string, string]> = [
        [c.fromEquipmentId, c.fromPortId, c.toEquipmentId, c.toPortId],
        [c.toEquipmentId, c.toPortId, c.fromEquipmentId, c.fromPortId],
      ]
      for (const [nearEq, nearPort, farEq, farPort] of ends) {
        if (nearEq !== sw.id) continue
        const p = ports.find((x) => x.id === nearPort)
        if (!p) continue
        const far = byId.get(farEq)
        if (!far) continue
        const farPortObj = [...(far.inputs ?? []), ...(far.outputs ?? [])].find((x) => x.id === farPort)
        fromCable.set(portDisplayLabel(p) || p.id, {
          port: portDisplayLabel(p) || p.id,
          device: far.name,
          deviceId: far.id,
          ...(farPortObj ? { nicLabel: portDisplayLabel(farPortObj) } : {}),
          ...(far.ipAddress ? { ipAddress: far.ipAddress } : {}),
          source: 'cable',
        })
      }
    }

    // 3. Zusammenfuehren. Die Schnittstelle gewinnt, weil sie jemand von Hand
    //    gepflegt hat; der Widerspruch bleibt trotzdem sichtbar, statt
    //    stillschweigend weggeraeumt zu werden.
    const rows: SwitchPortRow[] = []
    const seen = new Set<string>()
    for (const name of portNames) {
      seen.add(name)
      const nicRow = fromNic.get(name)
      const cableRow = fromCable.get(name)
      if (nicRow && cableRow && nicRow.deviceId !== cableRow.deviceId) {
        rows.push({ ...nicRow, conflict: cableRow.device })
      } else {
        rows.push(nicRow ?? cableRow ?? { port: name })
      }
    }
    // Schnittstellen, die einen Port nennen, den der Switch gar nicht fuehrt.
    // Nicht wegwerfen: das ist genau der Tippfehler, den die Karte finden soll.
    for (const [name, row] of fromNic) {
      if (!seen.has(name)) rows.push(row)
    }

    return {
      switchId: sw.id,
      switchName: sw.name,
      rows,
      usedCount: rows.filter((r) => !!r.device).length,
    }
  })
}

/** Die Port-Karte eines Switches als Tabelle. Kanonisches Deutsch — sie kann
 *  gestempelt werden, und ein Fingerabdruck ueber uebersetzten Text waere
 *  sprachabhaengig. */
export function switchPortTable(map: SwitchPortMap): CsvTable {
  return {
    headers: ['Port', 'Geraet', 'Schnittstelle', 'IP', 'VLAN', 'Quelle', 'Widerspruch'],
    rows: map.rows.map((r): CsvCell[] => [
      r.port,
      r.device ?? '',
      r.nicLabel ?? '',
      r.ipAddress ?? '',
      r.vlanId ?? '',
      r.source === 'interface' ? 'Schnittstelle' : r.source === 'cable' ? 'Kabel' : '',
      r.conflict ? `Kabel sagt: ${r.conflict}` : '',
    ]),
  }
}

/**
 * Der einfuegbare Beschreibungsblock — das, was Bedarf 24 als den
 * vertretbaren Weg benennt.
 *
 * Bewusst herstellerneutral: `interface <port>` / `description <text>` ist die
 * Form, die Cisco-IOS, Aruba, FS und die meisten Web-Oberflaechen entweder
 * direkt annehmen oder in der jemand die Zeile ablesen kann. Eine Datei im
 * Format genau eines Herstellers waere fuer alle anderen unbrauchbar und
 * wuerde behaupten, geprueft zu sein.
 *
 * Freie Ports kommen NICHT vor: eine Beschreibung, die einen Port leert, den
 * jemand ausserhalb dieses Plans belegt hat, richtet Schaden an.
 */
export function switchPortDescriptionBlock(map: SwitchPortMap): string {
  const lines: string[] = [
    `! ${map.switchName} — Port-Beschreibungen aus dem Plan`,
    '! Herstellerneutral. Vor dem Einspielen lesen; freie Ports stehen bewusst nicht drin.',
  ]
  for (const r of map.rows) {
    if (!r.device) continue
    const text = [r.device, r.nicLabel, r.ipAddress].filter(Boolean).join(' ')
    lines.push(`interface ${r.port}`)
    lines.push(`  description ${text}`)
  }
  return lines.join('\n')
}
