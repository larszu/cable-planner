// ───────────────────────────────────────────────────────────────────────────
// Die Anschlussliste — „welches Gerät haengt auf welchem Kabel an welchem
// Patchfeld und von dort auf welchem Port welches Switches".
//
// NUTZER-FRAGE 2026-09-23, woertlich:
//
//   > es waere sinnvoll wenn ich herausfinden kann welches geraet auf welchem
//   > kabel an welchem patchfeld und welchem port vom patchfeld auf welchen
//   > port von welchem switch gesteckt ist. das muss ich als uebersicht sehen
//   > und auch als tabelle exportieren koennen. inkl ip adressen etc von dem
//   > geraeten
//
// ─── WARUM DAS NICHT SCHON DA WAR ──────────────────────────────────────────
//
// Alle drei Haelften der Antwort lagen im Plan, nur nie in einer Zeile:
//
//   `switchPortMap.ts`  sieht den Switch-Port und sein DIREKTES Gegenueber.
//                       Steht ein Patchfeld dazwischen — der Normalfall in
//                       jeder Festinstallation —, steht dort das Patchfeld
//                       als „Geraet am Port" und die Kamera kommt nicht vor.
//   `signalChain.ts`    laeuft ueber Patchfelder hinweg, aber GERICHTET
//                       (`fromPort` → `toPort`) und ohne eine einzige
//                       Netz-Angabe. Ein Netzkabel hat keine Richtung: wer es
//                       im Plan vom Switch zur Kamera gezogen hat, findet von
//                       der Kamera aus nichts.
//   `networkInterfaces` kennt IP, Maske, VLAN, MAC — und ein Feld
//                       `switchPort`, das jemand VON HAND pflegt.
//
// Diese Datei setzt die drei zusammen: sie laeuft den Kabelgraphen
// UNGERICHTET von der Schnittstelle eines Geraets bis zum ersten Switch,
// sammelt jede Zwischenstation mit beiden Anschlussnummern und haengt die
// Netz-Angaben der Schnittstelle daneben.
//
// ─── ZWEI QUELLEN, UND DIE LISTE SAGT WELCHE ───────────────────────────────
//
// Dieselbe Bauform wie in `switchPortMap.ts`, und aus demselben Grund:
//   `kabel`         — der Plan weiss, was wo steckt, weil die Kabel liegen.
//   `schnittstelle` — jemand hat Switch und Port in die Netz-Maske getippt.
//   `beide`         — beide sagen dasselbe. Das ist die starke Zeile.
// Widersprechen sie sich, bleibt der Widerspruch stehen (`conflict`) statt
// still weggeraeumt zu werden. Der gelaufene Weg gewinnt in der Anzeige, weil
// er aus den Kabeln folgt und nicht aus einem Gedaechtnis — aber die Hand-
// Angabe bleibt lesbar daneben.
//
// ─── WAS DURCHGELEITET WIRD, UND WAS NICHT ─────────────────────────────────
//
// Patchfeld   Position n hinten auf Position n vorn (`patchPanel.ts`).
//             Bauart, kein Betriebszustand — darum ableitbar.
// Wandler     Medienwandler Kupfer/Glas, Extender: genau EIN weiteres Kabel
//             am Geraet. Zwei: mehrdeutig, Ende.
// Adapter     dieselbe Regel, eigener Name — wer den Weg abgeht, sucht sonst
//             ein Geraet mit Netzteil und findet ein Teil in Daumengroesse.
//
// Alles andere ist ein Ziel und kein Durchgang. Ein Verteiler kommt hier
// bewusst NICHT vor: im Netz gibt es keinen passiven Verteiler, und ein
// Geraet, das ein Signal vervielfacht, ist ein Switch oder ein Hub — beide
// enden die Liste, weil ab dort der naechste Abschnitt beginnt.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { Cable } from '../types/cable'
import type { EquipmentItem, Port } from '../types/equipment'
import type { NetworkInterface, NetworkInterfaceRole } from '../types/network'
import type { NetworkSegment } from '../types/networkSegment'
import type { CsvCell, CsvTable } from './csv'
import { detectNetworkDevice } from './deviceKind'
import { allDeviceInterfaces } from './networkInterfaces'
import { isPatchPanelDevice, patchPanelCounterpart } from './patchPanel'
import { portDisplayLabel } from './portLabel'
import { subnetCidr } from './subnet'

/** Welche Bauform eine Zwischenstation hat. */
export type StageKind = 'patch-panel' | 'converter' | 'adapter'

export const STAGE_LABEL: Readonly<Record<StageKind, string>> = {
  'patch-panel': 'Patchfeld',
  converter: 'Wandler',
  adapter: 'Adapter',
}

/** Eine Zwischenstation auf dem Weg zum Switch. */
export interface TraceStage {
  /** Das Kabel, auf dem der Weg HIER ankam. */
  cableId: string
  cableLabel: string
  cableType?: string
  deviceId: string
  deviceName: string
  kind: StageKind
  /** Der Anschluss, an dem der Weg ankam. */
  inPort: string
  /** Der Anschluss, auf dem er weiterging. */
  outPort: string
  /** Rack-Beschriftung des Patchfelds, wenn es in einem steht. */
  rack?: string
}

/** Warum die Verfolgung aufhoert. Nie „einfach so". */
export type TraceEnd =
  /** Ein Switch (oder Router) ist erreicht — die Zeile ist vollstaendig. */
  | 'switch'
  /** Der Weiterweg ist bestimmt, aber es haengt kein Kabel dran. */
  | 'nicht-verkabelt'
  /** Der Weg endet an einem Geraet, das nicht durchleitet und kein Switch ist. */
  | 'anderes-gerät'
  /** Der Weiterweg ist nicht ableitbar (Patchfeld ungleich bestueckt, Wandler
   *  mit mehreren Kabeln, mehrere Kabel an einem Anschluss). */
  | 'mehrdeutig'
  /** Mehr als `MAX_STAGES` Zwischenstationen — abgeschnitten, nicht zu Ende. */
  | 'zu-lang'
  /** Der Weg lief in sich zurueck. */
  | 'schleife'
  /** Es gibt gar keinen Weg: an dieser Schnittstelle haengt kein Kabel. Nur
   *  die Hand-Angabe sagt etwas — oder auch die nicht. */
  | 'ohne-kabel'

/** Woher die Zeile ihre Switch-Angabe hat. */
export type TraceSource = 'kabel' | 'schnittstelle' | 'beide'

export interface PortTraceRow {
  /** Stabil aus Geraet, Schnittstelle und Startanschluss — taugt als React-Key. */
  key: string
  deviceId: string
  deviceName: string
  deviceCategory: string
  /** Rack-Beschriftung, wenn das Geraet in einem steht. */
  rack?: string
  serialNumber?: string

  /** Die Schnittstelle, zu der die Netz-Angaben gehoeren. Fehlt, wenn ein
   *  Kabelweg zu keiner gepflegten Schnittstelle passt — die Zeile zeigt dann
   *  den Weg ohne Adresse, statt eine zu erfinden. */
  nicId?: string
  nicLabel?: string
  role?: NetworkInterfaceRole
  ipAddress?: string
  subnetMask?: string
  /** Netz in CIDR-Schreibweise, wenn IP und Maske beide da sind. */
  cidr?: string
  gateway?: string
  macAddress?: string
  vlanId?: number
  /** Name des Segments zu dieser VLAN-Id, wenn eines gepflegt ist. */
  segmentName?: string

  /** Der Anschluss am Geraet selbst, an dem der Weg beginnt. */
  devicePort?: string
  /** Das erste Kabel — das, was am Geraet steckt. */
  firstCableLabel?: string
  firstCableType?: string
  /** Die Zwischenstationen in der Reihenfolge des Weges. */
  stages: TraceStage[]
  /** Das letzte Kabel — das, was im Switch steckt. Bei einem Weg ohne
   *  Zwischenstation ist es dasselbe wie `firstCableLabel`. */
  lastCableLabel?: string

  switchId?: string
  switchName?: string
  switchPort?: string
  /** Ein Router statt eines Switches. Die Zeile ist trotzdem fertig — nur
   *  steht dort kein Switch, und das soll man sehen. */
  switchIsRouter?: boolean

  end: TraceEnd
  /** Klartext fuer die Anzeige; leer bei 'switch'. */
  endNote: string
  source: TraceSource
  /** Beide Quellen sagen etwas, und sie widersprechen sich. */
  conflict?: string
}

/** Mehr Zwischenstationen hat auch eine grosse Festinstallation nicht. */
const MAX_STAGES = 12

const cableText = (c: Cable): string =>
  c.cableNumber?.trim() || c.name?.trim() || c.type || c.id

const portText = (p: Port | undefined, fallback: string): string =>
  p ? portDisplayLabel(p) || p.name || fallback : fallback

const allPorts = (e: EquipmentItem): Port[] => [...(e.inputs ?? []), ...(e.outputs ?? [])]

interface Link {
  cable: Cable
  /** Das Geraet und der Anschluss am ANDEREN Ende. */
  farEquipmentId: string
  farPortId: string
}

interface Walk {
  /** Der Anschluss am Startgeraet, von dem aus gelaufen wurde. */
  startPortId: string
  startPortName: string
  firstCable?: Cable
  lastCable?: Cable
  stages: TraceStage[]
  end: TraceEnd
  endNote: string
  switchDevice?: EquipmentItem
  switchPort?: string
  switchIsRouter?: boolean
}

/**
 * Der Weg von einem Anschluss aus, ungerichtet, bis zum ersten Switch.
 *
 * UNGERICHTET ist hier keine Bequemlichkeit, sondern die Sache: ein Netzkabel
 * hat keine Richtung. `signalChain.ts` laeuft `fromPort` → `toPort`, weil ein
 * SDI-Signal eine Richtung hat; wer dort eine Kamera sucht, deren Kabel im
 * Plan vom Switch aus gezogen wurde, findet nichts.
 */
const walkFrom = (
  startEquipmentId: string,
  startPort: Port,
  byId: Map<string, EquipmentItem>,
  portById: Map<string, Port>,
  linksByPort: Map<string, Link[]>,
  cablesAtEquipment: Map<string, Cable[]>,
): Walk => {
  const walk: Walk = {
    startPortId: startPort.id,
    startPortName: portText(startPort, startPort.id),
    stages: [],
    end: 'ohne-kabel',
    endNote: '',
  }

  const used = new Set<string>()
  // Jedes Geraet hoechstens einmal. Der Satz `used` allein reicht nicht: ein
  // Ring aus zwei Blenden liefe sich dort zwar tot, meldete aber
  // „Weiterweg nicht verkabelt" — und schickte jemanden ein Kabel suchen,
  // das es gar nicht geben soll.
  const besucht = new Set<string>([startEquipmentId])
  let exitPortId = startPort.id

  const stop = (end: TraceEnd, note: string): Walk => {
    walk.end = end
    walk.endNote = note
    return walk
  }

  for (let schritt = 0; schritt <= MAX_STAGES; schritt += 1) {
    const links = (linksByPort.get(exitPortId) ?? []).filter((l) => !used.has(l.cable.id))
    if (links.length === 0) {
      return stop(
        walk.stages.length === 0 ? 'ohne-kabel' : 'nicht-verkabelt',
        walk.stages.length === 0
          ? 'An diesem Anschluss hängt kein Kabel'
          : 'Der Weiterweg ist im Plan nicht verkabelt',
      )
    }
    if (links.length > 1) {
      return stop(
        'mehrdeutig',
        `${links.length} Kabel an einem Anschluss — welches gilt, sagt der Plan nicht`,
      )
    }

    const { cable, farEquipmentId, farPortId } = links[0]
    used.add(cable.id)
    if (!walk.firstCable) walk.firstCable = cable
    walk.lastCable = cable

    const device = byId.get(farEquipmentId)
    if (!device) return stop('mehrdeutig', 'Das Gerät am anderen Ende steht nicht mehr im Plan')
    if (besucht.has(device.id)) return stop('schleife', 'Der Weg läuft in sich zurück')

    const arrival = portById.get(farPortId)
    const arrivalName = portText(arrival, farPortId)

    // Der Switch zuerst: ein Patchfeld ist nie ein Switch, aber ein Switch
    // kann in der Bibliothek in einer Kategorie liegen, die nach Blende
    // aussieht. Die Reihenfolge entscheidet dann, und das Ziel gewinnt.
    const netz = detectNetworkDevice(device)
    if (!isPatchPanelDevice(device) && netz) {
      walk.switchDevice = device
      walk.switchPort = arrivalName
      walk.switchIsRouter = netz === 'router'
      return stop('switch', '')
    }

    if (isPatchPanelDevice(device)) {
      const other = patchPanelCounterpart(device, { id: farPortId })
      if (!other) {
        return stop(
          'mehrdeutig',
          device.inputs.length === device.outputs.length
            ? `Patchfeld ${device.name}: der Anschluss gehört nicht zur Durchleitung`
            : `Patchfeld ${device.name} ungleich bestückt (${device.inputs.length} hinten, ${device.outputs.length} vorn) — die Position sagt hier nichts`,
        )
      }
      walk.stages.push({
        cableId: cable.id,
        cableLabel: cableText(cable),
        ...(cable.type ? { cableType: cable.type } : {}),
        deviceId: device.id,
        deviceName: device.name,
        kind: 'patch-panel',
        inPort: arrivalName,
        outPort: portText(other, other.id),
        ...(device.rackInstanceLabel ? { rack: device.rackInstanceLabel } : {}),
      })
      exitPortId = other.id
    } else if (device.adapter || device.isConverter) {
      // Der Adapter kommt VOR dem Wandler, wie in `signalChain.ts`: ein
      // aktiver Adapter ist ein winziger Wandler, und die genauere Aussage
      // gewinnt.
      const kind: StageKind = device.adapter ? 'adapter' : 'converter'
      const weiter = (cablesAtEquipment.get(device.id) ?? []).filter((c) => !used.has(c.id))
      if (weiter.length === 0) {
        return stop('nicht-verkabelt', `${STAGE_LABEL[kind]} ${device.name}: kein weiteres Kabel`)
      }
      if (weiter.length > 1) {
        return stop(
          'mehrdeutig',
          `${STAGE_LABEL[kind]} ${device.name} mit ${weiter.length} weiteren Kabeln — kein eindeutiger Weiterweg`,
        )
      }
      const naechste = weiter[0]
      const nahPortId =
        naechste.fromEquipmentId === device.id ? naechste.fromPortId : naechste.toPortId
      walk.stages.push({
        cableId: cable.id,
        cableLabel: cableText(cable),
        ...(cable.type ? { cableType: cable.type } : {}),
        deviceId: device.id,
        deviceName: device.name,
        kind,
        inPort: arrivalName,
        outPort: portText(portById.get(nahPortId), nahPortId),
        ...(device.rackInstanceLabel ? { rack: device.rackInstanceLabel } : {}),
      })
      exitPortId = nahPortId
    } else {
      return stop('anderes-gerät', `Der Weg endet an ${device.name} — das ist kein Switch`)
    }

    besucht.add(device.id)
  }

  return stop('zu-lang', `Mehr als ${MAX_STAGES} Zwischenstationen — hier abgeschnitten`)
}

/** Wonach die Liste geschnitten wird. Ohne Angabe: alles. */
export interface PortTraceOptions {
  /** Nur Zeilen dieses Geraets. */
  onlyEquipmentId?: string
  /** Nur Zeilen, die an diesem Switch ankommen. */
  onlySwitchId?: string
}

/**
 * Die Anschlussliste des Plans.
 *
 * Eine Zeile je Schnittstelle mit Netz-Angaben, PLUS eine Zeile je Kabelweg,
 * der zu keiner Schnittstelle passt. Der zweite Fall ist keine Schwaeche: ein
 * Patchfeld-Weg zu einem Geraet, in dem niemand eine IP gepflegt hat, ist
 * genau die Zeile, die fehlt, wenn man vor dem Rack steht.
 */
export function buildPortTrace(
  equipment: readonly EquipmentItem[],
  cables: readonly Cable[],
  segments: readonly NetworkSegment[] = [],
  opts: PortTraceOptions = {},
): PortTraceRow[] {
  const byId = new Map(equipment.map((e) => [e.id, e]))
  const portById = new Map<string, Port>()
  for (const e of equipment) for (const p of allPorts(e)) portById.set(p.id, p)

  const linksByPort = new Map<string, Link[]>()
  const cablesAtEquipment = new Map<string, Cable[]>()
  const push = <T,>(m: Map<string, T[]>, k: string, v: T) => {
    const vorhanden = m.get(k)
    if (vorhanden) vorhanden.push(v)
    else m.set(k, [v])
  }
  for (const c of cables) {
    push(linksByPort, c.fromPortId, {
      cable: c,
      farEquipmentId: c.toEquipmentId,
      farPortId: c.toPortId,
    })
    push(linksByPort, c.toPortId, {
      cable: c,
      farEquipmentId: c.fromEquipmentId,
      farPortId: c.fromPortId,
    })
    push(cablesAtEquipment, c.fromEquipmentId, c)
    if (c.toEquipmentId !== c.fromEquipmentId) push(cablesAtEquipment, c.toEquipmentId, c)
  }

  const segmentByVlan = new Map(segments.map((s) => [s.vlanId, s]))

  // Startgeraete: alles, was kein Switch und kein Patchfeld ist. Ein Switch
  // steht als ZIEL in den Zeilen der anderen; seine eigenen Uplinks sind der
  // naechste Abschnitt und gehoeren nicht in diese Liste.
  const starter = equipment.filter(
    (e) =>
      !isPatchPanelDevice(e) &&
      !detectNetworkDevice(e) &&
      (opts.onlyEquipmentId ? e.id === opts.onlyEquipmentId : true),
  )

  const nics = new Map<string, NetworkInterface[]>()
  for (const { equipment: e, nic } of allDeviceInterfaces([...equipment])) {
    push(nics, e.id, nic)
  }

  const rows: PortTraceRow[] = []

  for (const device of starter) {
    const deviceNics = nics.get(device.id) ?? []

    // Alle Wege, die dieses Geraet ueberhaupt hat — einer je Anschluss mit
    // Kabel. Wege, die an einem Nicht-Switch enden, bleiben drin: sie sind die
    // Antwort auf „warum steht diese Kamera in keiner Switch-Liste".
    const wege = allPorts(device)
      .map((p) =>
        walkFrom(device.id, p, byId, portById, linksByPort, cablesAtEquipment),
      )
      .filter((w) => w.end !== 'ohne-kabel')

    const vergeben = new Set<string>()

    const zeileAus = (nic: NetworkInterface | undefined, walk: Walk | undefined): PortTraceRow => {
      const declaredSwitch = nic?.switchEquipmentId ? byId.get(nic.switchEquipmentId) : undefined
      const gelaufen = walk?.end === 'switch' ? walk.switchDevice : undefined

      // Welche Quelle die Switch-Angabe traegt. Der gelaufene Weg gewinnt in
      // der Anzeige — er folgt aus den Kabeln und nicht aus einem Gedaechtnis.
      let source: TraceSource = gelaufen ? 'kabel' : 'schnittstelle'
      let conflict: string | undefined
      if (gelaufen && declaredSwitch) {
        const gleich =
          declaredSwitch.id === gelaufen.id &&
          (nic?.switchPort ?? '') === (walk?.switchPort ?? '')
        if (gleich) source = 'beide'
        else conflict = `Schnittstelle sagt: ${declaredSwitch.name} ${nic?.switchPort ?? ''}`.trim()
      }

      const switchDevice = gelaufen ?? declaredSwitch
      const switchPort = gelaufen ? walk?.switchPort : nic?.switchPort
      const cidr = subnetCidr(nic?.ipAddress, nic?.subnetMask)
      const segment = nic?.vlanId !== undefined ? segmentByVlan.get(nic.vlanId) : undefined

      const end: TraceEnd = walk ? walk.end : declaredSwitch ? 'switch' : 'ohne-kabel'
      const endNote = walk
        ? walk.endNote
        : declaredSwitch
          ? 'Nur von Hand eingetragen — im Plan liegt kein Kabel dorthin'
          : 'An dieser Schnittstelle hängt kein Kabel'

      return {
        key: `${device.id}|${nic?.id ?? '-'}|${walk?.startPortId ?? '-'}`,
        deviceId: device.id,
        deviceName: device.name,
        deviceCategory: device.category,
        ...(device.rackInstanceLabel ? { rack: device.rackInstanceLabel } : {}),
        ...(device.serialNumber ? { serialNumber: device.serialNumber } : {}),
        ...(nic
          ? {
              nicId: nic.id,
              ...(nic.label ? { nicLabel: nic.label } : {}),
              role: nic.role,
              ...(nic.ipAddress ? { ipAddress: nic.ipAddress } : {}),
              ...(nic.subnetMask ? { subnetMask: nic.subnetMask } : {}),
              ...(cidr ? { cidr } : {}),
              ...(nic.gateway ? { gateway: nic.gateway } : {}),
              ...(nic.macAddress ? { macAddress: nic.macAddress } : {}),
              ...(nic.vlanId !== undefined ? { vlanId: nic.vlanId } : {}),
              ...(segment ? { segmentName: segment.name } : {}),
            }
          : {}),
        ...(walk
          ? {
              devicePort: walk.startPortName,
              ...(walk.firstCable ? { firstCableLabel: cableText(walk.firstCable) } : {}),
              ...(walk.firstCable?.type ? { firstCableType: walk.firstCable.type } : {}),
              ...(walk.lastCable ? { lastCableLabel: cableText(walk.lastCable) } : {}),
            }
          : {}),
        stages: walk?.stages ?? [],
        ...(switchDevice
          ? {
              switchId: switchDevice.id,
              switchName: switchDevice.name,
              ...(switchPort ? { switchPort } : {}),
              ...(walk?.switchIsRouter ? { switchIsRouter: true } : {}),
            }
          : {}),
        end,
        endNote: end === 'switch' ? '' : endNote,
        source,
        ...(conflict ? { conflict } : {}),
      }
    }

    // ZUORDNUNG SCHNITTSTELLE → WEG. Drei Regeln, und keine davon raet:
    //
    //   1. Die Schnittstelle nennt ihren eigenen Anschluss (`portId`) — dann
    //      ist der Weg von dort ihrer. Das ist die gepflegte Angabe.
    //   2. Genau eine Schnittstelle und genau ein Weg — dann gehoeren sie
    //      zusammen, weil es nichts anderes geben kann.
    //   3. Sonst bleiben beide getrennt: die Schnittstelle bekommt eine Zeile
    //      ohne Weg, der Weg eine Zeile ohne Adresse. Eine Zuordnung nach
    //      Reihenfolge waere geraten — und auf dem Blatt saehe sie aus wie
    //      eine Messung.
    const offeneNics: NetworkInterface[] = []
    for (const nic of deviceNics) {
      const passend = nic.portId ? wege.find((w) => w.startPortId === nic.portId) : undefined
      if (passend) {
        vergeben.add(passend.startPortId)
        rows.push(zeileAus(nic, passend))
      } else {
        offeneNics.push(nic)
      }
    }
    const offeneWege = wege.filter((w) => !vergeben.has(w.startPortId))

    if (offeneNics.length === 1 && offeneWege.length === 1) {
      rows.push(zeileAus(offeneNics[0], offeneWege[0]))
    } else {
      for (const nic of offeneNics) rows.push(zeileAus(nic, undefined))
      for (const w of offeneWege) rows.push(zeileAus(undefined, w))
    }
  }

  const gefiltert = opts.onlySwitchId
    ? rows.filter((r) => r.switchId === opts.onlySwitchId)
    : rows

  // Sortiert nach Switch, dann Port, dann Geraet — das ist die Reihenfolge, in
  // der jemand vor dem Rack steht. Zeilen ohne Switch stehen hinten: sie sind
  // die offenen Punkte, nicht der Anfang der Liste.
  return gefiltert.sort((a, b) => {
    if (!!a.switchName !== !!b.switchName) return a.switchName ? -1 : 1
    const sw = (a.switchName ?? '').localeCompare(b.switchName ?? '', 'de')
    if (sw !== 0) return sw
    const port = (a.switchPort ?? '').localeCompare(b.switchPort ?? '', 'de', { numeric: true })
    if (port !== 0) return port
    return a.deviceName.localeCompare(b.deviceName, 'de')
  })
}

/** Der ganze Weg als ein Satz — fuer Tooltip, Ausdruck und die CSV-Spalte,
 *  die ihn auch dann traegt, wenn mehr als ein Patchfeld dazwischenliegt. */
export const traceOneLine = (row: PortTraceRow): string => {
  const teile: string[] = [`${row.deviceName} · ${row.devicePort ?? '?'}`]
  for (const s of row.stages) {
    teile.push(`—[${s.cableLabel}]→ ${s.deviceName} ${s.inPort}/${s.outPort}`)
  }
  if (row.switchName) {
    const letztes = row.stages.length > 0 ? row.lastCableLabel : row.firstCableLabel
    teile.push(`—[${letztes ?? '?'}]→ ${row.switchName} · ${row.switchPort ?? '?'}`)
  }
  return teile.join(' ')
}

export const TRACE_SOURCE_LABEL: Readonly<Record<TraceSource, string>> = {
  kabel: 'Kabel',
  schnittstelle: 'Schnittstelle',
  beide: 'Kabel + Schnittstelle',
}

export const TRACE_END_LABEL: Readonly<Record<TraceEnd, string>> = {
  switch: 'am Switch',
  'nicht-verkabelt': 'Weiterweg nicht verkabelt',
  'anderes-gerät': 'endet an einem anderen Gerät',
  mehrdeutig: 'nicht eindeutig',
  'zu-lang': 'abgeschnitten',
  schleife: 'Schleife',
  'ohne-kabel': 'kein Kabel',
}

/**
 * Die Anschlussliste als Tabelle.
 *
 * Kanonisches Deutsch — sie kann gestempelt werden, und ein Fingerabdruck
 * ueber uebersetzten Text waere sprachabhaengig. Dieselbe Regel wie in
 * `switchPortTable`.
 *
 * DAS ERSTE PATCHFELD HAT EIGENE SPALTEN, und das ist Absicht: der Normalfall
 * ist genau eine Blende zwischen Geraet und Switch, und wer danach filtert
 * oder sortiert, braucht sie als Spalte und nicht in einem Satz. Liegen mehr
 * dazwischen, stehen sie vollstaendig in `Weg` — die Spalte `Stationen` sagt
 * wie viele, damit niemand die Kurzspalten fuer den ganzen Weg haelt.
 */
export function portTraceTable(rows: PortTraceRow[]): CsvTable {
  return {
    headers: [
      'Gerät',
      'Kategorie',
      'Rack',
      'Seriennummer',
      'Schnittstelle',
      'Rolle',
      'IP',
      'Maske',
      'Netz (CIDR)',
      'Gateway',
      'MAC',
      'VLAN',
      'Segment',
      'Anschluss am Gerät',
      'Kabel',
      'Kabeltyp',
      'Patchfeld',
      'Patchfeld-Rack',
      'Port hinten',
      'Port vorn',
      'Stationen',
      'Kabel zum Switch',
      'Switch',
      'Switch-Port',
      'Weg',
      'Quelle',
      'Status',
      'Hinweis',
      'Widerspruch',
    ],
    rows: rows.map((r): CsvCell[] => {
      const erste = r.stages[0]
      return [
        r.deviceName,
        r.deviceCategory,
        r.rack ?? '',
        r.serialNumber ?? '',
        r.nicLabel ?? '',
        r.role ?? '',
        r.ipAddress ?? '',
        r.subnetMask ?? '',
        r.cidr ?? '',
        r.gateway ?? '',
        r.macAddress ?? '',
        r.vlanId ?? '',
        r.segmentName ?? '',
        r.devicePort ?? '',
        r.firstCableLabel ?? '',
        r.firstCableType ?? '',
        erste ? erste.deviceName : '',
        erste?.rack ?? '',
        erste ? erste.inPort : '',
        erste ? erste.outPort : '',
        r.stages.length,
        r.stages.length > 0 ? (r.lastCableLabel ?? '') : (r.firstCableLabel ?? ''),
        r.switchName ?? '',
        r.switchPort ?? '',
        traceOneLine(r),
        TRACE_SOURCE_LABEL[r.source],
        TRACE_END_LABEL[r.end],
        r.endNote,
        r.conflict ?? '',
      ]
    }),
  }
}
