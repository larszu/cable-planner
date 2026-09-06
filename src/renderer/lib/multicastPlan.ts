// ───────────────────────────────────────────────────────────────────────────
// Der Multicast-Adressplan (Bedarf 72, P2). Welche Gruppe welcher Sender
// belegt, unter welchem UDP-Port, auf welcher L2-Adresse — und welche zwei
// Zeilen sich dabei ins Gehege kommen, ohne dass man es ihnen ansieht.
//
//   > Every essence (2110-20/-30/-40) is its own multicast group, doubled for
//   > 2022-7. A mid-size truck is several hundred rows allocated by hand in
//   > Excel. Two invisible rules get violated: (address, UDP port) must be
//   > unique per sender, and 32 L3 multicast addresses alias onto one L2 MAC,
//   > so a naive scheme collides.
//
// Belege: Arista, „M&E Multicast Addressing" (der 2^5-Kollaps); Dataton
// WATCHOUT, ST-2110-Netzwerkeinrichtung (Adresse und Port zusammen eindeutig).
//
// ─── DIE ZWEITE REGEL, UND WARUM SIE UNSICHTBAR IST ────────────────────────
//
// Eine IPv4-Multicast-Adresse wird auf die MAC `01:00:5e:` + die UNTEREN 23
// BITS der Adresse abgebildet. Die Adresse hat unterhalb von 224.0.0.0/4
// achtundzwanzig freie Bits. 28 - 23 = 5, also fallen 2^5 = 32 verschiedene
// Gruppen auf DIESELBE MAC.
//
// Was daran teuer ist: die beiden Adressen sehen im Plan verschieden aus, und
// sie SIND verschieden — der Switch trennt sie sauber, wenn er IGMP-Snooping
// auf L3 macht. Die Netzwerkkarte des Empfaengers filtert aber auf L2. Sie
// nimmt beide Stroeme an, das Betriebssystem verwirft den falschen, und der
// Empfaenger traegt die doppelte Last. Bei einem unkomprimierten 1080p59.94-
// Fluss nach 2110-20 sind das rund 1,5 Gbit/s, die niemand eingeplant hat.
//
// Ob es tatsaechlich weh tut, haengt an der Karte und am Switch. Deshalb sagt
// der Befund, WAS aliasiert und was es kostet — nicht, dass es ausfaellt. Der
// Plan misst nicht (dieselbe Haltung wie bei „is it flowing", Bedarf 76, und
// beim Encoder-Ueberlauf, Bedarf 90).
//
// ─── WELCHER POOL MIT SICH SELBST KOLLIDIEREN KANN ─────────────────────────
//
// Die fuenf verlorenen Bits sind Bit 23 (das oberste Bit im zweiten Oktett)
// und die Bits 24..27 (das untere Halbbyte des ersten Oktetts). Ein Pool mit
// Praefix /9 oder enger haelt alle fuenf fest — er kann mit sich selbst gar
// nicht aliasieren. Erst ein Pool ueber /8 laesst Bit 23 los.
//
// Genau das ist das „naive scheme" aus dem Beleg: `239.<dienst>.<x>.<y>` mit
// dem Dienst im zweiten Oktett. 239.1.1.1 (Video) und 239.129.1.1 (Audio)
// tragen dieselbe MAC — Paar fuer Paar, ueber den ganzen Plan.
//
// Der Alias-Test bleibt trotzdem drin, auch bei einem /16-Pool: eine von Hand
// gepflegte Vergabe kann AUSSERHALB des Pools liegen, und genau die ist der
// haeufige Fall — ein halb gefuellter Plan, in den jemand aus dem Gedaechtnis
// nachgetragen hat.
//
// ─── WAS DIESE DATEI NICHT TUT ─────────────────────────────────────────────
//
// Sie verschiebt keine bestehende Vergabe und loescht keine. `allocateMulticast`
// VERGIBT NUR NACH — eine verteilte Adresse umzunummerieren waere genau der
// stille Datenverlust, den Bedarf 96 verbietet (Cryde/musicall#798). Vergaben
// zu Fluessen, die es nicht mehr gibt, werden als `stale` GEMELDET; sie
// wegzuraeumen ist eine eigene, sichtbare Handlung.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { EquipmentItem, Port } from '../types/equipment'
import type { Cable } from '../types/cable'
import type { CablePlannerProject } from '../types/project'
import type { SignalStandard } from '../types/cableSpec'
import type { MulticastAssignment, MulticastConfig, MulticastLeg } from '../types/multicast'
import { MULTICAST_LEG_LABEL } from '../types/multicast'
import type { CsvTable } from './csv'
import { deviceInterfaces } from './networkInterfaces'
import { portDisplayLabel } from './portLabel'

// ───────────────────────────────────────────────────────────────────────────
// Essenz
// ───────────────────────────────────────────────────────────────────────────

/**
 * Die Essenz, die ueber eine Gruppe laeuft.
 *
 * Bewusst FEINER als `EssenceFamily` in `ptpPlan.ts`. Dort geht es um den
 * Medientakt, und dafuer stehen -20 und -40 auf derselben Seite. Hier geht es
 * um Gruppen, und der Bedarf sagt ausdruecklich „every essence (2110-20/-30/
 * -40) is its own multicast group": ANC ist eine eigene Gruppe, kein Anhaengsel
 * des Videos. Licht ueber IP kommt dazu — sACN und Art-Net sind Multicast und
 * belegen denselben Adressraum, auch wenn PTP sie nicht interessiert.
 */
export type MulticastEssence = 'video' | 'audio' | 'anc' | 'lighting'

export const MULTICAST_ESSENCE_LABEL: Readonly<Record<MulticastEssence, string>> = {
  video: 'Video',
  audio: 'Audio',
  anc: 'ANC / Daten',
  lighting: 'Licht',
}

/**
 * Welcher Standard welche Essenz ist.
 *
 * Diese Zuordnung ist die einzige Stelle, die es weiss. `tests/multicastPlan
 * .test.ts` prueft, dass jeder Standard aus den drei Multicast-Mengen in
 * `venueNetworkRequest` hier einen Eintrag hat — sonst faellt ein spaeter
 * hinzugefuegter Standard still aus dem Adressplan heraus, und der Plan
 * meldete eine vollstaendige Vergabe fuer eine Gruppe, die er nie gesehen hat.
 */
export const MULTICAST_ESSENCE: Readonly<Partial<Record<SignalStandard, MulticastEssence>>> = {
  'ST2110-20': 'video',
  'ST2110-30': 'audio',
  'ST2110-40': 'anc',
  AES67: 'audio',
  Dante: 'audio',
  sACN: 'lighting',
  'Art-Net': 'lighting',
}

export const essenceOf = (std: SignalStandard | undefined): MulticastEssence | null =>
  (std && MULTICAST_ESSENCE[std]) || null

// ───────────────────────────────────────────────────────────────────────────
// Adress-Arithmetik
// ───────────────────────────────────────────────────────────────────────────

/** Punktierte IPv4 als vorzeichenlose Zahl, oder `null` bei Unsinn. */
export function ipToInt(addr: string): number | null {
  const parts = addr.trim().split('.')
  if (parts.length !== 4) return null
  let out = 0
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const n = Number(p)
    if (n > 255) return null
    out = out * 256 + n
  }
  return out
}

export const intToIp = (n: number): string =>
  [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')

/** Liegt die Adresse in 224.0.0.0/4? */
export const isMulticastAddress = (addr: string): boolean => {
  const n = ipToInt(addr)
  return n !== null && n >= 0xe0000000 && n <= 0xefffffff
}

/**
 * Die L2-Adresse, auf die eine Gruppe abgebildet wird.
 *
 * `01:00:5e:` plus die unteren 23 Bit — das oberste Bit des vierten Bytes wird
 * dabei zwangsweise 0. Genau dieses eine Bit ist der Grund fuer den Kollaps.
 */
export function multicastMac(addr: string): string | null {
  const n = ipToInt(addr)
  if (n === null) return null
  const b2 = (n >>> 16) & 0x7f
  const b3 = (n >>> 8) & 0xff
  const b4 = n & 0xff
  const hex = (v: number) => v.toString(16).padStart(2, '0')
  return `01:00:5e:${hex(b2)}:${hex(b3)}:${hex(b4)}`
}

/** Die unteren 23 Bit. Zwei Adressen mit gleichem Wert teilen sich eine MAC. */
export function aliasKey(addr: string): number | null {
  const n = ipToInt(addr)
  return n === null ? null : n & 0x007fffff
}

/** Bereiche, die keine Medien tragen duerfen — mit dem Grund im Klartext. */
export const RESERVED_RANGES: ReadonlyArray<{
  cidr: string
  from: number
  to: number
  reason: string
}> = [
  {
    cidr: '224.0.0.0/24',
    from: 0xe0000000,
    to: 0xe00000ff,
    reason: 'Local Network Control Block — TTL 1, wird von keinem Router weitergegeben',
  },
  {
    cidr: '224.0.1.0/24',
    from: 0xe0000100,
    to: 0xe00001ff,
    reason: 'Internetwork Control Block — hier liegen NTP und PTP selbst (224.0.1.129 ff.)',
  },
  {
    cidr: '232.0.0.0/8',
    from: 0xe8000000,
    to: 0xe8ffffff,
    reason: 'Source-Specific Multicast — verlangt (S,G)-Joins, ein ASM-Plan greift hier ins Leere',
  },
  {
    cidr: '239.255.255.250/32',
    from: 0xeffffffa,
    to: 0xeffffffa,
    reason: 'SSDP/UPnP — jede Windows-Maschine im Netz spricht diese Gruppe an',
  },
]

export const reservedReason = (addr: string): string | null => {
  const n = ipToInt(addr)
  if (n === null) return null
  for (const r of RESERVED_RANGES) if (n >= r.from && n <= r.to) return `${r.cidr}: ${r.reason}`
  return null
}

export interface ParsedPool {
  base: number
  count: number
  prefix: number
}

/**
 * `239.100.0.0/16` → Basis und Groesse. `null`, wenn es kein brauchbarer
 * Multicast-Pool ist — kein Wegwerfen des Fehlers: `buildMulticastPlan`
 * traegt ihn als `poolError` weiter, damit die Oberflaeche sagen kann, WAS
 * an der Eingabe nicht stimmt.
 */
export function parsePool(cidr: string): ParsedPool | null {
  const m = /^\s*(\d{1,3}(?:\.\d{1,3}){3})\s*\/\s*(\d{1,2})\s*$/.exec(cidr)
  if (!m) return null
  const base = ipToInt(m[1])
  const prefix = Number(m[2])
  if (base === null || prefix < 4 || prefix > 32) return null
  const size = 2 ** (32 - prefix)
  // Auf die eigene Groesse ausgerichtet — sonst meint „239.100.0.5/16" etwas
  // anderes, als der Leser sieht.
  const aligned = base - (base % size)
  if (aligned < 0xe0000000 || aligned + size - 1 > 0xefffffff) return null
  return { base: aligned, count: size, prefix }
}

// ───────────────────────────────────────────────────────────────────────────
// Die Fluesse — abgeleitet
// ───────────────────────────────────────────────────────────────────────────

export const flowKey = (equipmentId: string, portId: string): string =>
  `${equipmentId}:${portId}`

export interface MulticastFlow {
  key: string
  equipmentId: string
  portId: string
  /** „Kamera 1 · SDI OUT 1". */
  label: string
  standard: SignalStandard
  essence: MulticastEssence
  /** Geraete-Namen der Empfaenger — der Grund, warum es EINE Gruppe ist. */
  receivers: string[]
  /**
   * Die Beine, die dieser Fluss braucht. Aus den Medien-Schnittstellen des
   * SENDERS abgeleitet: wer `media-primary` UND `media-secondary` fuehrt,
   * sendet nach 2022-7 doppelt. Abgeleitet und nicht gespeichert, damit ein
   * nachgetragenes Sekundaernetz das Bein B sofort als offen zeigt.
   */
  legs: MulticastLeg[]
}

/**
 * Die Fluss-Tabelle aus dem gezeichneten Signalfluss — die Engstelle.
 *
 * Ein Fluss je SENDE-PORT, nicht je Kabel: fuenf Empfaenger an einer Kamera
 * sind eine Gruppe. Der Standard kommt vom Kabel, sonst vom Port; ein Kabel
 * ohne Standard an einem Port mit Standard ist der Normalfall im Bestand.
 */
export function collectFlows(
  equipment: readonly EquipmentItem[],
  cables: readonly Cable[],
): MulticastFlow[] {
  const byId = new Map(equipment.map((e) => [e.id, e]))
  const portOf = (e: EquipmentItem, portId: string): Port | undefined =>
    [...(e.outputs ?? []), ...(e.inputs ?? [])].find((p) => p.id === portId)

  const flows = new Map<string, MulticastFlow>()
  for (const c of cables) {
    const sender = byId.get(c.fromEquipmentId)
    if (!sender) continue
    const port = portOf(sender, c.fromPortId)
    const std = c.standard ?? port?.standard
    const essence = essenceOf(std)
    if (!std || !essence) continue

    const key = flowKey(sender.id, c.fromPortId)
    const existing = flows.get(key)
    const receiver = byId.get(c.toEquipmentId)?.name
    if (existing) {
      if (receiver && !existing.receivers.includes(receiver)) existing.receivers.push(receiver)
      continue
    }
    const nics = deviceInterfaces(sender)
    const doppelt =
      nics.some((n) => n.role === 'media-primary') && nics.some((n) => n.role === 'media-secondary')
    flows.set(key, {
      key,
      equipmentId: sender.id,
      portId: c.fromPortId,
      label: `${sender.name} · ${port ? portDisplayLabel(port) : c.fromPortId}`,
      standard: std,
      essence,
      receivers: receiver ? [receiver] : [],
      legs: doppelt ? ['a', 'b'] : ['a'],
    })
  }
  for (const f of flows.values()) f.receivers.sort((a, b) => a.localeCompare(b, 'de'))
  return [...flows.values()].sort((a, b) => a.label.localeCompare(b.label, 'de'))
}

// ───────────────────────────────────────────────────────────────────────────
// Die Befunde
// ───────────────────────────────────────────────────────────────────────────

export type MulticastFindingKind =
  | 'pair-collision'
  | 'mac-alias'
  | 'leg-shared'
  | 'reserved-range'
  | 'outside-pool'

export const MULTICAST_FINDING_LABEL: Readonly<Record<MulticastFindingKind, string>> = {
  'pair-collision': 'Adresse und Port doppelt vergeben',
  'mac-alias': 'Zwei Gruppen auf einer L2-Adresse',
  'leg-shared': 'Beide Beine auf derselben Gruppe',
  'reserved-range': 'Adresse aus einem gesperrten Bereich',
  'outside-pool': 'Vergabe außerhalb des Pools',
}

export interface MulticastFinding {
  kind: MulticastFindingKind
  text: string
  /** Die betroffenen Fluss-Schluessel, fuer den Sprung in den Plan. */
  flowKeys: string[]
}

/** Ein offenes Bein: ein Fluss, dem fuer dieses Bein die Adresse fehlt. */
export interface MulticastOpenLeg {
  flowKey: string
  label: string
  leg: MulticastLeg
}

export interface MulticastPlan {
  flows: MulticastFlow[]
  assignments: MulticastAssignment[]
  findings: MulticastFinding[]
  /** Beine ohne Adresse — die Liste, die man abarbeitet. Kein Befund. */
  open: MulticastOpenLeg[]
  /** Vergaben zu Fluessen, die es im Plan nicht mehr gibt. Nur gemeldet. */
  stale: MulticastAssignment[]
  /** Der geparste Pool — `null`, wenn keiner erklaert ist oder er unbrauchbar ist. */
  pool: ParsedPool | null
  /** Was an der Pool-Eingabe nicht stimmt, im Klartext. */
  poolError: string | null
  /** Traegt der Plan ueberhaupt Multicast-Essenz? */
  needsMulticast: boolean
}

const legLabel = (leg: MulticastLeg) => MULTICAST_LEG_LABEL[leg]

/**
 * Die Pruefung. Sie liest nur — sie repariert nichts und vergibt nichts.
 *
 * `open` ist absichtlich KEIN Befund: ein Plan, in dem noch nie vergeben
 * wurde, haette sonst je Fluss eine Warnung und begrübe die vier echten
 * darunter. Dieselbe Entscheidung wie bei `withoutDomain` im Zeit-Plan.
 */
export function assessMulticast(
  flows: readonly MulticastFlow[],
  assignments: readonly MulticastAssignment[],
  pool: ParsedPool | null,
): { findings: MulticastFinding[]; open: MulticastOpenLeg[]; stale: MulticastAssignment[] } {
  const byKey = new Map(flows.map((f) => [f.key, f]))
  const nameOf = (key: string) => byKey.get(key)?.label ?? key
  const findings: MulticastFinding[] = []

  const lebendig = assignments.filter((a) => byKey.has(a.flowKey))
  const stale = assignments.filter((a) => !byKey.has(a.flowKey))

  // 1) Adresse + Port doppelt. Die WATCHOUT-Regel.
  const paare = new Map<string, MulticastAssignment[]>()
  for (const a of lebendig) {
    const k = `${a.address}:${a.port}`
    paare.set(k, [...(paare.get(k) ?? []), a])
  }
  for (const [k, liste] of paare) {
    if (liste.length < 2) continue
    findings.push({
      kind: 'pair-collision',
      text: `${k} ist ${liste.length}-mal vergeben: ${liste
        .map((a) => `${nameOf(a.flowKey)} (Bein ${legLabel(a.leg)})`)
        .join(', ')}. Adresse und Port zusammen müssen je Sender eindeutig sein.`,
      flowKeys: [...new Set(liste.map((a) => a.flowKey))],
    })
  }

  // 2) Der L2-Alias. Verschiedene Adressen, eine MAC.
  const macs = new Map<number, MulticastAssignment[]>()
  for (const a of lebendig) {
    const k = aliasKey(a.address)
    if (k === null) continue
    macs.set(k, [...(macs.get(k) ?? []), a])
  }
  for (const liste of macs.values()) {
    const adressen = [...new Set(liste.map((a) => a.address))]
    if (adressen.length < 2) continue
    findings.push({
      kind: 'mac-alias',
      text: `${adressen.join(' und ')} tragen dieselbe L2-Adresse ${multicastMac(
        adressen[0],
      )} — 32 Gruppen fallen auf eine MAC. Die Karte des Empfängers filtert auf L2 und nimmt beide Ströme an; verworfen wird erst im Betriebssystem, die Last liegt vorher an. Betroffen: ${[
        ...new Set(liste.map((a) => nameOf(a.flowKey))),
      ].join(', ')}.`,
      flowKeys: [...new Set(liste.map((a) => a.flowKey))],
    })
  }

  // 3) Beide Beine auf einer Gruppe — Redundanz, die keine ist.
  const proFluss = new Map<string, MulticastAssignment[]>()
  for (const a of lebendig) proFluss.set(a.flowKey, [...(proFluss.get(a.flowKey) ?? []), a])
  for (const [key, liste] of proFluss) {
    if (liste.length < 2) continue
    const adressen = new Set(liste.map((a) => a.address))
    if (adressen.size > 1) continue
    findings.push({
      kind: 'leg-shared',
      text: `${nameOf(key)} führt beide Beine auf ${
        liste[0].address
      }. Ein 2022-7-Paar auf einer Gruppe überlebt keinen Ausfall des Netzes, in dem die Gruppe liegt — es kostet die doppelte Bandbreite und liefert keine Redundanz.`,
      flowKeys: [key],
    })
  }

  // 4) Gesperrte Bereiche.
  for (const a of lebendig) {
    if (!isMulticastAddress(a.address)) {
      findings.push({
        kind: 'reserved-range',
        text: `${nameOf(a.flowKey)} (Bein ${legLabel(a.leg)}) trägt ${
          a.address
        } — das ist keine Multicast-Adresse (224.0.0.0/4).`,
        flowKeys: [a.flowKey],
      })
      continue
    }
    const grund = reservedReason(a.address)
    if (grund) {
      findings.push({
        kind: 'reserved-range',
        text: `${nameOf(a.flowKey)} (Bein ${legLabel(a.leg)}) trägt ${a.address} aus ${grund}.`,
        flowKeys: [a.flowKey],
      })
    }
  }

  // 5) Ausserhalb des erklaerten Pools. KEIN Fehler — aber der Grund, warum
  //    die naechste Vergabe jemanden ueberrascht.
  if (pool) {
    const draussen = lebendig.filter((a) => {
      const n = ipToInt(a.address)
      return n === null || n < pool.base || n > pool.base + pool.count - 1
    })
    if (draussen.length) {
      findings.push({
        kind: 'outside-pool',
        text: `${draussen.length} Vergabe(n) liegen außerhalb von ${intToIp(pool.base)}/${
          pool.prefix
        }: ${draussen.map((a) => `${nameOf(a.flowKey)} → ${a.address}`).join(', ')}.`,
        flowKeys: [...new Set(draussen.map((a) => a.flowKey))],
      })
    }
  }

  const belegt = new Set(lebendig.map((a) => `${a.flowKey}|${a.leg}`))
  const open: MulticastOpenLeg[] = []
  for (const f of flows) {
    for (const leg of f.legs) {
      if (!belegt.has(`${f.key}|${leg}`)) open.push({ flowKey: f.key, label: f.label, leg })
    }
  }

  return { findings, open, stale }
}

// ───────────────────────────────────────────────────────────────────────────
// Die Vergabe
// ───────────────────────────────────────────────────────────────────────────

export interface AllocationResult {
  /** Die bestehenden Vergaben PLUS die neuen. Keine bestehende ist bewegt. */
  assignments: MulticastAssignment[]
  /** Was neu dazugekommen ist. */
  issued: MulticastAssignment[]
  /** Beine, fuer die im Pool nichts mehr frei war — benannt statt still. */
  exhausted: MulticastOpenLeg[]
}

/**
 * Vergibt Adressen fuer alle offenen Beine — und nur fuer die.
 *
 * Bestehende Vergaben bleiben unangetastet, auch wenn sie ausserhalb des
 * Pools liegen oder gegen eine Regel verstossen: eine verteilte Adresse
 * umzunummerieren waere der stille Verlust, den Bedarf 96 verbietet. Was an
 * ihnen falsch ist, sagt `assessMulticast`; korrigieren tut es ein Mensch.
 *
 * Ueberspringt beim Suchen jede Adresse, die gesperrt ist, deren (Adresse,
 * Port) schon vergeben ist ODER die mit einer bereits vergebenen dieselbe
 * L2-Adresse traegt. Der letzte Punkt ist der ganze Sinn der Uebung.
 */
export function allocateMulticast(
  flows: readonly MulticastFlow[],
  config: MulticastConfig,
): AllocationResult {
  const pool = parsePool(config.pool)
  const bestehend = config.assignments.filter((a) => flows.some((f) => f.key === a.flowKey))
  const { open } = assessMulticast(flows, config.assignments, pool)
  if (!pool) return { assignments: [...config.assignments], issued: [], exhausted: [...open] }

  const port = config.basePort
  const paare = new Set(config.assignments.map((a) => `${a.address}:${a.port}`))
  const aliase = new Set(
    config.assignments.map((a) => aliasKey(a.address)).filter((k): k is number => k !== null),
  )

  const issued: MulticastAssignment[] = []
  const exhausted: MulticastOpenLeg[] = []
  let cursor = 0

  for (const bein of open) {
    let gefunden: string | null = null
    while (cursor < pool.count) {
      const kandidat = intToIp(pool.base + cursor)
      cursor += 1
      if (reservedReason(kandidat)) continue
      if (paare.has(`${kandidat}:${port}`)) continue
      const alias = aliasKey(kandidat)
      if (alias !== null && aliase.has(alias)) continue
      gefunden = kandidat
      break
    }
    if (!gefunden) {
      exhausted.push(bein)
      continue
    }
    paare.add(`${gefunden}:${port}`)
    const alias = aliasKey(gefunden)
    if (alias !== null) aliase.add(alias)
    issued.push({ flowKey: bein.flowKey, leg: bein.leg, address: gefunden, port })
  }

  // Verwaiste Vergaben bleiben in der Liste. Sie zu entfernen ist eine eigene
  // Handlung mit einem eigenen Knopf; hier weggeraeumt waeren sie weg, sobald
  // jemand versehentlich ein Kabel loescht und neu vergibt.
  const verwaist = config.assignments.filter((a) => !bestehend.includes(a))
  return { assignments: [...bestehend, ...issued, ...verwaist], issued, exhausted }
}

// ───────────────────────────────────────────────────────────────────────────
// Plan und Blatt
// ───────────────────────────────────────────────────────────────────────────

export function buildMulticastPlan(project: {
  equipment: readonly EquipmentItem[]
  cables: readonly Cable[]
  multicast?: MulticastConfig
}): MulticastPlan {
  const flows = collectFlows(project.equipment, project.cables)
  const cfg = project.multicast
  const roh = cfg?.pool?.trim() ?? ''
  const pool = roh ? parsePool(roh) : null
  const poolError = !roh
    ? null
    : pool
      ? null
      : `„${roh}" ist kein brauchbarer Pool. Erwartet wird ein CIDR innerhalb von 224.0.0.0/4, z. B. 239.100.0.0/16.`
  const assignments = cfg?.assignments ?? []
  const { findings, open, stale } = assessMulticast(flows, assignments, pool)
  return {
    flows,
    assignments: [...assignments],
    findings,
    open,
    stale,
    pool,
    poolError,
    needsMulticast: flows.length > 0,
  }
}

/**
 * Das Blatt. Die MAC-Spalte steht mit Absicht drauf: die Regel, gegen die man
 * blind verstoesst, wird erst sichtbar, wenn zwei Zeilen dieselbe MAC tragen.
 */
export function multicastTable(plan: MulticastPlan): CsvTable {
  const byKey = new Map(plan.flows.map((f) => [f.key, f]))
  const rows: (string | number)[][] = []
  for (const f of plan.flows) {
    for (const leg of f.legs) {
      const a = plan.assignments.find((x) => x.flowKey === f.key && x.leg === leg)
      rows.push([
        f.label,
        MULTICAST_ESSENCE_LABEL[f.essence],
        f.standard,
        MULTICAST_LEG_LABEL[leg],
        a?.address ?? 'offen',
        a ? a.port : '',
        a ? (multicastMac(a.address) ?? '') : '',
        f.receivers.join(', '),
      ])
    }
  }
  for (const s of plan.stale) {
    rows.push([
      byKey.get(s.flowKey)?.label ?? s.flowKey,
      'verwaist',
      '',
      MULTICAST_LEG_LABEL[s.leg],
      s.address,
      s.port,
      multicastMac(s.address) ?? '',
      '',
    ])
  }
  return {
    headers: [
      'Fluss',
      'Essenz',
      'Standard',
      'Bein',
      'Gruppe',
      'UDP-Port',
      'L2-MAC',
      'Empfänger',
    ],
    rows,
  }
}

export const multicastTableForProject = (project: CablePlannerProject): CsvTable =>
  multicastTable(buildMulticastPlan(project))

// ───────────────────────────────────────────────────────────────────────────
// Lade-Pfad
// ───────────────────────────────────────────────────────────────────────────

/**
 * Normalisiert die gespeicherte Konfiguration beim Laden.
 *
 * Diese Funktion gibt es, weil bei Bedarf 73 genau hier zwei Fehler lagen:
 * `interfaceIsEmpty` kannte die neuen Felder nicht und `normaliseNetworkInterface`
 * uebernahm sie nicht — eine Schnittstelle mit NUR einer PTP-Domaene wurde beim
 * Laden still weggeworfen. Eine Vergabe, die dasselbe Schicksal traefe, faellt
 * noch spaeter auf: sie steht im ausgedruckten Blatt und im Geraet, nur nicht
 * mehr im Plan.
 *
 * Verworfen wird deshalb NUR, was unlesbar ist — und das wird gemeldet.
 * Eine Adresse ausserhalb des Pools, in einem gesperrten Bereich oder mit
 * einem Alias bleibt: sie ist LESBAR und falsch, und dafuer gibt es Befunde.
 */
export function normaliseMulticastConfig(
  raw: unknown,
  onDrop?: (d: { reason: 'missing-required' | 'duplicate-id'; label: string }) => void,
): MulticastConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Partial<MulticastConfig>
  const pool = typeof o.pool === 'string' ? o.pool.trim() : ''
  const basePort =
    typeof o.basePort === 'number' && Number.isInteger(o.basePort) && o.basePort > 0 && o.basePort <= 65535
      ? o.basePort
      : 20000
  const seen = new Set<string>()
  const assignments: MulticastAssignment[] = []
  for (const a of Array.isArray(o.assignments) ? o.assignments : []) {
    const x = a as Partial<MulticastAssignment>
    const key = typeof x.flowKey === 'string' ? x.flowKey.trim() : ''
    const leg: MulticastLeg | null = x.leg === 'a' || x.leg === 'b' ? x.leg : null
    const address = typeof x.address === 'string' ? x.address.trim() : ''
    if (!key || !leg || !address || ipToInt(address) === null) {
      onDrop?.({ reason: 'missing-required', label: address || key })
      continue
    }
    const id = `${key}|${leg}`
    if (seen.has(id)) {
      onDrop?.({ reason: 'duplicate-id', label: `${address} (${key})` })
      continue
    }
    seen.add(id)
    const port =
      typeof x.port === 'number' && Number.isInteger(x.port) && x.port > 0 && x.port <= 65535
        ? x.port
        : basePort
    assignments.push({ flowKey: key, leg, address, port })
  }
  // Ein Objekt ohne Pool UND ohne Vergabe traegt nichts — es waere Ballast in
  // jedem Projektfile, das den Dialog einmal geoeffnet hat.
  if (!pool && assignments.length === 0) return undefined
  return { pool, basePort, assignments }
}
