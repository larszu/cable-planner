// ───────────────────────────────────────────────────────────────────────────
// Plan gegen Vorgefundenes (Bedarf 21, P1).
//
// Die Bedarfs-Datenbank nennt ihn „the highest-value item in the dossier and
// nothing in the AV planning market does it", und sie beschreibt die Arbeit,
// die er heute ersetzt:
//
//   > Nobody schedules the load-in reconciliation pass, but everybody does it:
//   > what came off the truck, under which names, with which addresses, versus
//   > what the plan says. Kit returns from the previous job with the previous
//   > job's names — Dante silently auto-renames collisions to 'Fred(2)'.
//
// ─── DREI REGELN, ALLE AUS DER RECHERCHE ───────────────────────────────────
//
// 1. **KEIN LIVE-FEED.** Der Bedarf schreibt es vor: „Deliberate, timestamped,
//    user-initiated — never a live feed." Und die Dossiers sagen, warum das
//    nicht Bequemlichkeit ist: Dantes API ist lizenz-gebunden („requires access
//    to the Dante Managed API … through a Dante Cloud Beta account or Dante
//    Domain Manager"), die offene Alternative erklaert sich selbst fuer
//    untauglich („not ready for anything other than a test environment … could
//    make the devices behave unexpectedly"), und die offene ST-2110-Analyse ist
//    eingestellt („Use at Your Own Risk"). Dieses Modul liest deshalb eine
//    DATEI, die ein Mensch abgelegt hat, und beruehrt kein Geraet.
//
// 2. **EINDEUTIG ODER GAR NICHT.** Aus `netboxlabs/orb-agent#558`: eine
//    Verbindung nur anlegen, wenn „both endpoints can be identified uniquely".
//    Hier heisst das: zwei Plan-Schnittstellen mit derselben MAC ergeben keine
//    Zuordnung, sondern einen Befund. Eine geratene Zuordnung waere schlimmer
//    als keine — sie erklaerte ein fehlendes Geraet fuer anwesend.
//
// 3. **DIE UMBENENNUNG IST EIN EIGENER BEFUND.** Dante haengt bei einer
//    Namenskollision still „(2)" an. Wer das nicht kennt, sieht in der Liste
//    ein FEHLENDES „Stagebox" und ein UNERWARTETES „Stagebox (2)" — zwei
//    Befunde fuer einen Vorgang, und beide fuehren in die Irre. `renamed` sagt,
//    was wirklich passiert ist.
//
// ─── WORAUF ZUGEORDNET WIRD, IN DIESER REIHENFOLGE ─────────────────────────
//
//   MAC  — eine Messung. Ein Geraet traegt sie, egal wie es heisst.
//   IP   — eine Messung des Augenblicks. Adressen wandern, aber wenn eine
//          passt, passt sie.
//   Name — eine Konvention. Zuletzt, und mit der Dante-Regel darin.
//
// Jede Zuordnung traegt mit, WORAUF sie beruht (`matchedBy`) — dieselbe Regel
// wie beim Kamera-Abgleich in `sony-camera-bridge#14`: wer eine Zeile fuer
// falsch haelt, soll sehen, warum sie dasteht.
//
// REIN: keine Uhr, kein Store, kein IO. Der Zeitstempel kommt von aussen,
// damit dieselbe Datei zweimal dasselbe Ergebnis gibt.
// ───────────────────────────────────────────────────────────────────────────

import type { EquipmentItem } from '../types/equipment'
import { allDeviceInterfaces, interfaceLabel } from './networkInterfaces'
import { parseCsv } from './csvParse'
import type { CsvCell, CsvTable } from './csv'

/** Ein Geraet, wie es die Abtastung vorgefunden hat. */
export interface ScanEntry {
  name?: string
  ipAddress?: string
  macAddress?: string
  switchName?: string
  switchPort?: string
}

/** Eine abgelegte Abtastung: was gefunden wurde, wann, und woraus gelesen. */
export interface NetworkScan {
  /** ISO-Zeitpunkt. Kommt von aussen — dieses Modul kennt keine Uhr. */
  takenAt: string
  /** Dateiname oder Quelle im Klartext, fuer den Bericht. */
  source: string
  entries: ScanEntry[]
}

export type MatchBasis = 'mac' | 'ip' | 'name'

export type ReconcileVerdict =
  /** Plan und Fund stimmen ueberein. */
  | 'match'
  /** Zugeordnet, aber die Adresse weicht ab. */
  | 'address-mismatch'
  /** Zugeordnet, aber der Name weicht ab. */
  | 'name-mismatch'
  /** Zugeordnet, und der Name ist die Dante-Kollisionsform des geplanten. */
  | 'renamed'
  /** Im Plan, nicht gefunden. */
  | 'missing'
  /** Gefunden, nicht im Plan. */
  | 'unexpected'
  /** Mehr als eine Zuordnung moeglich — bewusst KEINE getroffen. */
  | 'ambiguous'

export interface ReconcileRow {
  verdict: ReconcileVerdict
  /** Wie die Zeile im Plan heisst. Fehlt bei `unexpected`. */
  planned?: string
  plannedIp?: string
  plannedMac?: string
  /** Wie sie vorgefunden wurde. Fehlt bei `missing`. */
  found?: string
  foundIp?: string
  foundMac?: string
  /** Worauf die Zuordnung beruht. Fehlt, wo keine getroffen wurde. */
  matchedBy?: MatchBasis
}

export interface ReconcileReport {
  takenAt: string
  source: string
  rows: ReconcileRow[]
  counts: Record<ReconcileVerdict, number>
}

/** MAC auf Vergleichsform: nur Hex, klein. Deckt `aa:bb:..`, `AA-BB-..` und
 *  Ciscos `aabb.ccdd.eeff` in einem ab. */
export const normaliseMac = (mac: string): string => mac.toLowerCase().replace(/[^0-9a-f]/g, '')

/**
 * Dantes Kollisionsform: „Stagebox (2)" oder „Stagebox(2)" → „Stagebox".
 *
 * Die Klammer-Zahl am ENDE, nichts anderes: „Cam (Backup)" bleibt, wie es ist,
 * und „Stagebox 2" auch — das ist eine Nummer im Namen und keine Umbenennung.
 */
export const stripDanteCollisionSuffix = (name: string): string =>
  name.replace(/\s*\((\d+)\)\s*$/, '').trim()

const norm = (s?: string): string => (s ?? '').trim().toLowerCase()

/**
 * Eine ARP-/Neighbour-Tabelle lesen.
 *
 * Zwei Formen, beide woertlich so, wie die Werkzeuge sie ausgeben:
 *   `arp -a`   → `? (10.0.0.5) at aa:bb:cc:dd:ee:ff [ether] on eth0`
 *   `ip neigh` → `10.0.0.5 dev eth0 lladdr aa:bb:cc:dd:ee:ff REACHABLE`
 *
 * Ein Name steht in keiner von beiden, wenn er nicht aufloest — dann bleibt
 * er leer, statt aus der Adresse einen zu basteln.
 */
export function parseArpTable(text: string): ScanEntry[] {
  const out: ScanEntry[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    // Drei Schreibweisen, weil drei Werkzeuge sie so ausgeben: Doppelpunkt
    // (Linux/macOS), Bindestrich (Windows `arp -a`) und Ciscos Vierergruppen.
    // Nur den Doppelpunkt zu nehmen hiesse, die Windows-Ausgabe halb zu lesen
    // — Adresse ja, MAC nein — und ausgerechnet die MAC ist die Messung, auf
    // die der Abgleich zuerst zugreift.
    const mac =
      line.match(/\b([0-9a-fA-F]{2}(?:[:-][0-9a-fA-F]{2}){5})\b/)?.[1] ??
      line.match(/\b([0-9a-fA-F]{4}(?:\.[0-9a-fA-F]{4}){2})\b/)?.[1]
    // `arp -a`: Adresse in Klammern; `ip neigh`: Adresse am Zeilenanfang.
    const ip =
      line.match(/\((\d{1,3}(?:\.\d{1,3}){3})\)/)?.[1] ??
      line.match(/^(\d{1,3}(?:\.\d{1,3}){3})\b/)?.[1]
    if (!mac && !ip) continue
    // Der Hostname vor der Klammer bei `arp -a`. `?` heisst „nicht aufgeloest".
    const host = line.match(/^([^\s(]+)\s+\(/)?.[1]
    const entry: ScanEntry = {}
    if (host && host !== '?') entry.name = host
    if (ip) entry.ipAddress = ip
    if (mac) entry.macAddress = mac
    out.push(entry)
  }
  return out
}

const SCAN_ALIASES: Record<keyof ScanEntry, string[]> = {
  name: ['name', 'gerät', 'geraet', 'device', 'hostname', 'host', 'bezeichnung'],
  ipAddress: ['ip', 'ip-adresse', 'ipaddress', 'ip address', 'ip adresse', 'address', 'adresse'],
  macAddress: ['mac', 'mac-adresse', 'macaddress', 'mac address', 'hardware address', 'lladdr'],
  switchName: ['switch', 'switchname', 'neighbor', 'nachbar'],
  switchPort: ['port', 'switchport', 'switch port', 'interface', 'schnittstelle'],
}

/**
 * Eine Abtastung aus einer CSV lesen — mit Spalten-Zuordnung ueber die
 * Kopfzeile.
 *
 * Warum eine CSV mit Aliasen und kein Parser fuer ein bestimmtes Werkzeug:
 * Bedarf 6 verlangt fuer fremde Tabellen ausdruecklich „arbitrary column
 * names, arbitrary sheet, with user-defined column mapping". Und fuer die
 * Dante-Controller-Ausgabe gilt derselbe Grund noch einmal: ihr genaues Format
 * liegt in dieser Recherche nicht vor. Einen Parser dafuer zu schreiben hiesse,
 * Spaltennamen zu erfinden und ihn „Dante-Import" zu nennen — er saehe geprueft
 * aus und waere geraten. Die Alias-Liste nimmt an, was dasteht.
 */
export function parseScanCsv(text: string): ScanEntry[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const map: Partial<Record<keyof ScanEntry, number>> = {}
  header.forEach((h, i) => {
    for (const [field, aliases] of Object.entries(SCAN_ALIASES) as [keyof ScanEntry, string[]][]) {
      if (map[field] == null && aliases.includes(h)) map[field] = i
    }
  })
  const at = (r: string[], k: keyof ScanEntry): string | undefined => {
    const i = map[k]
    const v = i == null ? undefined : r[i]?.trim()
    return v || undefined
  }
  const out: ScanEntry[] = []
  for (const r of rows.slice(1)) {
    const e: ScanEntry = {}
    for (const k of Object.keys(SCAN_ALIASES) as (keyof ScanEntry)[]) {
      const v = at(r, k)
      if (v) e[k] = v
    }
    // Eine Zeile ohne einen einzigen Griff ist kein Fund.
    if (e.name || e.ipAddress || e.macAddress) out.push(e)
  }
  return out
}

interface PlanEntry {
  label: string
  ip?: string
  mac?: string
}

/**
 * Plan gegen Abtastung.
 *
 * Der Plan kommt als Geraeteliste; gelesen werden seine SCHNITTSTELLEN
 * (Bedarf 19), damit die zweite Karte eines redundanten Aufbaus nicht als
 * „unerwartet" auftaucht.
 */
export function reconcileNetwork(equipment: EquipmentItem[], scan: NetworkScan): ReconcileReport {
  const planned: PlanEntry[] = allDeviceInterfaces(equipment).map(({ equipment: e, nic }) => ({
    label: interfaceLabel(e, nic),
    ...(nic.ipAddress ? { ip: nic.ipAddress } : {}),
    ...(nic.macAddress ? { mac: normaliseMac(nic.macAddress) } : {}),
  }))

  const rows: ReconcileRow[] = []
  const usedPlan = new Set<number>()

  const candidates = (e: ScanEntry): { idx: number[]; basis: MatchBasis } | null => {
    const mac = e.macAddress ? normaliseMac(e.macAddress) : undefined
    if (mac) {
      const hit = planned.flatMap((p, i) => (p.mac === mac ? [i] : []))
      if (hit.length > 0) return { idx: hit, basis: 'mac' }
    }
    if (e.ipAddress) {
      const hit = planned.flatMap((p, i) => (p.ip === e.ipAddress ? [i] : []))
      if (hit.length > 0) return { idx: hit, basis: 'ip' }
    }
    if (e.name) {
      const wanted = norm(stripDanteCollisionSuffix(e.name))
      const hit = planned.flatMap((p, i) =>
        norm(stripDanteCollisionSuffix(p.label)) === wanted ? [i] : [],
      )
      if (hit.length > 0) return { idx: hit, basis: 'name' }
    }
    return null
  }

  for (const found of scan.entries) {
    const c = candidates(found)
    if (!c) {
      rows.push({
        verdict: 'unexpected',
        ...(found.name ? { found: found.name } : {}),
        ...(found.ipAddress ? { foundIp: found.ipAddress } : {}),
        ...(found.macAddress ? { foundMac: found.macAddress } : {}),
      })
      continue
    }
    // Eindeutig oder gar nicht (orb-agent#558). Eine geratene Zuordnung
    // erklaerte ein fehlendes Geraet fuer anwesend.
    const fresh = c.idx.filter((i) => !usedPlan.has(i))
    if (fresh.length !== 1) {
      rows.push({
        verdict: 'ambiguous',
        ...(found.name ? { found: found.name } : {}),
        ...(found.ipAddress ? { foundIp: found.ipAddress } : {}),
        ...(found.macAddress ? { foundMac: found.macAddress } : {}),
        matchedBy: c.basis,
      })
      continue
    }
    const i = fresh[0]
    usedPlan.add(i)
    const p = planned[i]

    let verdict: ReconcileVerdict = 'match'
    if (found.ipAddress && p.ip && found.ipAddress !== p.ip) {
      verdict = 'address-mismatch'
    } else if (found.name && norm(found.name) !== norm(p.label)) {
      // Die Dante-Kollisionsform ist ein eigener Befund und keine Abweichung:
      // „Stagebox (2)" IST die geplante Stagebox, nur unter dem Namen, den ihr
      // die Anlage gegeben hat.
      verdict =
        norm(stripDanteCollisionSuffix(found.name)) === norm(stripDanteCollisionSuffix(p.label)) &&
        norm(found.name) !== norm(p.label)
          ? 'renamed'
          : 'name-mismatch'
    }

    rows.push({
      verdict,
      planned: p.label,
      ...(p.ip ? { plannedIp: p.ip } : {}),
      ...(p.mac ? { plannedMac: p.mac } : {}),
      ...(found.name ? { found: found.name } : {}),
      ...(found.ipAddress ? { foundIp: found.ipAddress } : {}),
      ...(found.macAddress ? { foundMac: found.macAddress } : {}),
      matchedBy: c.basis,
    })
  }

  // Was der Plan kennt und die Abtastung nicht gefunden hat.
  planned.forEach((p, i) => {
    if (usedPlan.has(i)) return
    rows.push({
      verdict: 'missing',
      planned: p.label,
      ...(p.ip ? { plannedIp: p.ip } : {}),
      ...(p.mac ? { plannedMac: p.mac } : {}),
    })
  })

  const counts = {
    match: 0,
    'address-mismatch': 0,
    'name-mismatch': 0,
    renamed: 0,
    missing: 0,
    unexpected: 0,
    ambiguous: 0,
  } as Record<ReconcileVerdict, number>
  for (const r of rows) counts[r.verdict]++

  return { takenAt: scan.takenAt, source: scan.source, rows, counts }
}

/** Der Bericht als Tabelle. Kanonisches Deutsch — sie kann gestempelt werden. */
export function reconcileTable(report: ReconcileReport): CsvTable {
  const label: Record<ReconcileVerdict, string> = {
    match: 'stimmt',
    'address-mismatch': 'Adresse weicht ab',
    'name-mismatch': 'Name weicht ab',
    renamed: 'umbenannt (Kollisionsform)',
    missing: 'nicht gefunden',
    unexpected: 'nicht im Plan',
    ambiguous: 'nicht eindeutig — keine Zuordnung',
  }
  const basis: Record<MatchBasis, string> = { mac: 'MAC', ip: 'IP', name: 'Name' }
  return {
    headers: ['Befund', 'Im Plan', 'Plan-IP', 'Vorgefunden', 'Gefundene IP', 'MAC', 'Zugeordnet ueber'],
    rows: report.rows.map((r): CsvCell[] => [
      label[r.verdict],
      r.planned ?? '',
      r.plannedIp ?? '',
      r.found ?? '',
      r.foundIp ?? '',
      r.foundMac ?? '',
      r.matchedBy ? basis[r.matchedBy] : '',
    ]),
  }
}
