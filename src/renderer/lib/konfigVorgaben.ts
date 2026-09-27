// ───────────────────────────────────────────────────────────────────────────
// Konfigurationsvorgaben — was an jedem Gerät einzustellen ist, damit es in
// dieses Netz passt.
//
// Die Angaben liegen heute auf drei Blättern verteilt: die Adressen im
// Netz-Anforderungsblatt (`venueNetworkRequest.ts`), die Switch-Ports in der
// Port-Karte (`switchPortMap.ts`), die Web-Oberfläche nur in den
// Eigenschaften. Wer ein Gerät austauscht, braucht alles zusammen und für
// genau dieses Gerät: Adresse, Maske, Gateway, VLAN, an welchem Port es
// hängt und über welche Blende. Dieses Blatt legt die drei nebeneinander —
// es rechnet nichts neu, es liest dieselben Engstellen.
//
// ─── WOHER DER PORT KOMMT ──────────────────────────────────────────────────
//
// Zwei Quellen, und die Spalte „Quelle" sagt, welche galt:
//
//   Schnittstelle   an der Schnittstelle eingetragen (Switch + Port) — die
//                   gepflegte Angabe, sie gewinnt
//   Kabel           aus dem Kabelgraphen, durch Blenden hindurch
//
// Ein Port aus dem Kabel wird der ersten Schnittstelle nur zugeordnet, wenn
// es genau einer ist. Hängt ein Gerät mit zwei Kabeln am Switch, weiss der
// Plan nicht, welche Buchse welche Adresse trägt — dann steht jeder Port in
// einer eigenen Zeile, statt dass einer geraten wird.
//
// Nennt eine Schnittstelle einen Port, an dem laut Kabel ein ANDERES Gerät
// hängt, steht der Widerspruch im Befund — mit dem Gerät, zu dem das Kabel
// führt. Die Port-Karte zeigt ihn schon; hier fiele er sonst weg, und das
// andere Gerät gleich mit: die Karte führt je Port nur eine Belegung.
//
// Ein Gerät am Switch ohne Adresse ist eine Lücke und kein Nebenbefund: an
// genau diesem Gerät muss vor der Inbetriebnahme noch etwas eingestellt
// werden, und niemand hat gesagt, was.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import type { NetworkInterface } from '../types/network'
import type { CsvCell, CsvTable } from './csv'
import { deviceInterfaces } from './networkInterfaces'
import { buildSwitchPortMaps } from './switchPortMap'
import { vergleich } from './druckblatt'

export interface KonfigZeile {
  geraetId: string
  geraet: string
  schnittstelle: string
  ip: string
  maske: string
  gateway: string
  vlan?: number
  mac: string
  switchName: string
  port: string
  via: string[]
  quelle?: 'schnittstelle' | 'kabel'
  web: string
  befund?: 'widerspruch' | 'keine-ip' | 'keine-maske'
  /** Bei `widerspruch`: das Gerät, zu dem das Kabel an diesem Port führt. */
  widerspruch?: string
}

interface KabelPort {
  switchName: string
  port: string
  via: string[]
}

export function konfigVorgaben(project: CablePlannerProject): KonfigZeile[] {
  const byId = new Map(project.equipment.map((e) => [e.id, e]))
  const kabelPorts = new Map<string, KabelPort[]>()
  /** Was die Karte zu einem gepflegten Port aus dem Kabel weiss: Blenden davor, Widerspruch. */
  const ausKabel = new Map<string, { via?: string[]; widerspruch?: string }>()
  for (const karte of buildSwitchPortMaps(project.equipment, project.cables)) {
    for (const r of karte.rows) {
      if (r.source === 'interface' && r.deviceId && (r.via || r.conflict)) {
        ausKabel.set(`${r.deviceId}\0${karte.switchId}\0${r.port}`, {
          ...(r.via ? { via: r.via } : {}),
          ...(r.conflict ? { widerspruch: r.conflict } : {}),
        })
      }
      if (r.source !== 'cable' || !r.deviceId) continue
      const liste = kabelPorts.get(r.deviceId) ?? []
      liste.push({ switchName: karte.switchName, port: r.port, via: r.via ?? [] })
      kabelPorts.set(r.deviceId, liste)
    }
  }

  const geraete = [...project.equipment].sort((a, b) => vergleich(a.name, b.name) || vergleich(a.id, b.id))
  const zeilen: KonfigZeile[] = []
  for (const e of geraete) {
    const nics = deviceInterfaces(e)
    const deklariert = new Set(
      nics
        .filter((n) => n.switchEquipmentId && n.switchPort)
        .map((n) => `${byId.get(n.switchEquipmentId!)?.name ?? ''}\0${n.switchPort}`),
    )
    const offen = (kabelPorts.get(e.id) ?? [])
      .filter((k) => !deklariert.has(`${k.switchName}\0${k.port}`))
      .sort((a, b) => vergleich(a.switchName, b.switchName) || vergleich(a.port, b.port))
    if (nics.length === 0 && offen.length === 0 && !e.mgmtUrl) continue

    const leer = (): KonfigZeile => ({
      geraetId: e.id,
      geraet: e.name,
      schnittstelle: '',
      ip: '',
      maske: '',
      gateway: '',
      mac: '',
      switchName: '',
      port: '',
      via: [],
      web: '',
    })
    const ausNic = (n: NetworkInterface): KonfigZeile => {
      const kabelSagt = n.switchEquipmentId ? ausKabel.get(`${e.id}\0${n.switchEquipmentId}\0${n.switchPort ?? ''}`) : undefined
      return {
        ...leer(),
        schnittstelle: n.label ?? '',
        ip: n.ipAddress ?? '',
        maske: n.subnetMask ?? '',
        gateway: n.gateway ?? '',
        ...(n.vlanId !== undefined ? { vlan: n.vlanId } : {}),
        mac: n.macAddress ?? '',
        ...(n.switchEquipmentId
          ? {
              switchName: byId.get(n.switchEquipmentId)?.name ?? '',
              port: n.switchPort ?? '',
              via: kabelSagt?.via ?? [],
              quelle: 'schnittstelle' as const,
            }
          : {}),
        ...(kabelSagt?.widerspruch ? { widerspruch: kabelSagt.widerspruch } : {}),
      }
    }

    const eigene: KonfigZeile[] = nics.map(ausNic)
    // Genau ein Port aus dem Kabel und eine erste Schnittstelle ohne eigenen
    // Switch: dann gehören sie zusammen. Sonst nicht — siehe Kopf.
    const erste = eigene[0]
    if (offen.length === 1 && erste && !erste.switchName) {
      Object.assign(erste, { switchName: offen[0].switchName, port: offen[0].port, via: offen[0].via, quelle: 'kabel' })
    } else {
      for (const k of offen) eigene.push({ ...leer(), switchName: k.switchName, port: k.port, via: k.via, quelle: 'kabel' })
    }
    if (eigene.length === 0) eigene.push(leer())
    if (e.mgmtUrl) eigene[0].web = e.mgmtUrl
    for (const z of eigene) {
      // Der Widerspruch zuerst: solange nicht klar ist, WELCHES Gerät an dem
      // Port hängt, ist jede weitere Angabe zu dieser Zeile eine Vermutung.
      if (z.widerspruch) z.befund = 'widerspruch'
      else if (!z.ip) z.befund = 'keine-ip'
      else if (!z.maske) z.befund = 'keine-maske'
    }
    zeilen.push(...eigene)
  }
  return zeilen
}

const befundText = (z: KonfigZeile): string =>
  z.befund === 'widerspruch'
    ? `Kabel an diesem Port führt zu ${z.widerspruch ?? ''}`
    : z.befund === 'keine-ip'
      ? 'keine IP-Adresse im Plan'
      : z.befund === 'keine-maske'
        ? 'Subnetzmaske fehlt'
        : ''

/** Kanonisch deutsch — gestempelt, der Stand darf nicht an der Sprache hängen. */
export const konfigVorgabenTable = (project: CablePlannerProject): CsvTable => ({
  headers: ['Gerät', 'Schnittstelle', 'IP', 'Maske', 'Gateway', 'VLAN', 'MAC', 'Switch', 'Port', 'Über', 'Quelle', 'Web-Oberfläche', 'Befund'],
  rows: konfigVorgaben(project).map((z): CsvCell[] => [
    z.geraet,
    z.schnittstelle,
    z.ip,
    z.maske,
    z.gateway,
    z.vlan ?? '',
    z.mac,
    z.switchName,
    z.port,
    z.via.join(' → '),
    z.quelle === 'schnittstelle' ? 'Schnittstelle' : z.quelle === 'kabel' ? 'Kabel' : '',
    z.web,
    befundText(z),
  ]),
})
