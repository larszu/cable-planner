// ───────────────────────────────────────────────────────────────────────────
// Bedarf 76 — Nachschlagen mitten in der Show. EINE Engstelle.
//
// DER BEFUND nennt die Fragen woertlich und nennt sie „widespread":
//
//   > Mid-show the questions are always 'what's the IP of X, which switch
//   > port, which VLAN, is it flowing'. The answer is scrolling a spreadsheet
//   > on one laptop, or the engineer's memory. Cloud IPAM is unreachable
//   > exactly when needed — venue internet is a survey item precisely because
//   > it cannot be assumed.
//
// Und er nennt die Antwort ebenso woertlich: „type a partial name or address,
// get device, IP, VLAN, switch, port, rack, and what depends on it."
//
// ─── WAS ES SCHON GAB UND WARUM ES NICHT REICHTE ───────────────────────────
//
// `CanvasSearch` sucht seit langem — aber nur ueber fuenf Felder: Name,
// Kurzname, Kategorie, Untertitel, Notiz. Wer mitten in der Show „10.20.0.14"
// eintippt, bekommt NICHTS, obwohl der Plan diese Adresse kennt: sie steht in
// `networkInterfaces`, und danach hat nie jemand gesucht. Und der Treffer, den
// man bekommt, ist ein Sprung auf die Canvas — kein Datenblatt. Die Frage
// „welcher Switch-Port" beantwortet ein Sprung nicht.
//
// Beide Haelften der Antwort lagen fertig da und wurden von der Suche nicht
// erreicht: `deviceInterfaces` (Bedarf 19) kennt jede Adresse jedes Geraets,
// `buildSwitchPortMaps` (Bedarf 24) kennt jeden belegten Switch-Port mit
// seiner Herkunft. Wieder derselbe Befund wie bei `sheetLookup` und
// `getPresets`: gebaut, getestet, richtig — und von nichts erreicht.
//
// ─── WAS DIESE DATEI IST ───────────────────────────────────────────────────
//
// Die eine Funktion, die alles annimmt, was jemand mitten in der Show
// eintippen kann, und die ganze Antwort zurueckgibt. Sie ist bewusst die
// Engstelle und nicht ein zweiter Filter neben dem in `CanvasSearch`: eine
// zweite Trefferliste waere die zweite Wahrheit, und sie wuerde exakt so
// auseinanderlaufen wie es hier gerade gemessen wurde.
//
// ─── DREI ENTSCHEIDUNGEN ───────────────────────────────────────────────────
//
// 1. JEDER TREFFER SAGT, WORAUF ER TRAF. Ein Fund auf „10.20.0.14" kann aus
//    einer Schnittstelle kommen oder aus einer Notiz, in der jemand die alte
//    Adresse notiert hat. Das ist NICHT dasselbe, und die Verwechslung ist
//    genau der Fehler, der mitten in der Show teuer wird — jemand patcht das
//    Geraet, dessen Notiz die Adresse nennt, statt das, das sie traegt.
//    Deshalb traegt jeder Treffer `matched`: Feld und Wert, im Klartext.
//
// 2. WAS DRANHAENGT, WIRD ABGELEITET. Aus dem Kabelgraph, eine Ebene tief,
//    nicht gespeichert. Ein gespeichertes Abhaengigkeitsfeld waere ab dem
//    ersten umgesteckten Kabel falsch — und mitten in der Show wird
//    umgesteckt, das ist der ganze Anlass fuer diese Funktion.
//
// 3. „IS IT FLOWING" WIRD NICHT BEANTWORTET. Der Befund stellt die Frage,
//    die Empfehlung darunter nennt sie nicht mehr — und mit gutem Grund: ein
//    offline-Planer weiss nicht, ob Pakete fliessen. Eine geratene Antwort
//    darauf waere die schaedlichste von allen, weil sie wie eine Messung
//    aussieht. Was der Plan weiss, ist, ob ein Weg GEPLANT ist und ob der
//    Aufbau ihn abgehakt hat; beides steht in der Antwort und heisst nicht
//    „fliesst".
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { EquipmentItem } from '../types/equipment'
import type { Cable } from '../types/cable'
import type { LocationFrame } from '../types/location'
import { deviceInterfaces } from './networkInterfaces'
import { buildSwitchPortMaps } from './switchPortMap'
import { locationNameForEquipment } from './equipmentLocation'
import { portDisplayLabel } from './portLabel'

/**
 * Worauf ein Treffer traf. Die Reihenfolge ist die Rangfolge: eine Identitaet
 * (Name, Adresse, Etiketten-Code) waehlt das Geraet aus, Prosa nennt es nur.
 */
export type LookupField =
  | 'name'
  | 'shortName'
  | 'ip'
  | 'mac'
  | 'vlan'
  | 'assetTag'
  | 'serial'
  | 'qrId'
  | 'switchPort'
  | 'category'
  | 'subtitle'
  | 'notes'

/** Felder, die das Geraet BENENNEN. Alles andere erwaehnt es nur. */
const IDENTITY_FIELDS: ReadonlySet<LookupField> = new Set<LookupField>([
  'name',
  'shortName',
  'ip',
  'mac',
  'vlan',
  'assetTag',
  'serial',
  'qrId',
  'switchPort',
])

export interface LookupMatch {
  field: LookupField
  /** Der gefundene Wert im Klartext — nicht die Suchanfrage. */
  value: string
  /** true, wenn der Wert die Anfrage GANZ ist und nicht nur enthaelt. */
  exact: boolean
}

export interface LookupInterface {
  /** Beschriftung am Geraet („NET 1"), soweit gepflegt. */
  label?: string
  ipAddress?: string
  macAddress?: string
  vlanId?: number
  /** Der Switch, an dem die Schnittstelle haengt — Name, nicht Id. */
  switchName?: string
  switchPort?: string
}

/** Ein Geraet, das an diesem haengt — eine Kabel-Ebene weit. */
export interface LookupDependent {
  id: string
  name: string
  /** Ueber welchen Port hier — die Frage „welches Kabel ziehe ich". */
  viaPort: string
  /** Richtung aus Sicht des gesuchten Geraets. */
  direction: 'downstream' | 'upstream'
  /** Hat der Aufbau dieses Kabel abgehakt? `undefined` = nie beantwortet. */
  checked?: boolean
}

export interface LookupAnswer {
  id: string
  name: string
  shortName?: string
  category?: string
  /** Worauf getroffen wurde, staerkster Treffer zuerst. */
  matched: LookupMatch[]
  interfaces: LookupInterface[]
  /** Ort aus den Location-Rahmen; `undefined` heisst „in keinem Rahmen". */
  location?: string
  /** Rack-Beschriftung und Hoehe (HE), soweit das Geraet in einem Rack sitzt. */
  rack?: { label: string; startUnit?: number }
  dependents: LookupDependent[]
}

const norm = (v: unknown): string => String(v ?? '').trim().toLowerCase()

/**
 * Ein Treffer, wenn `hay` die Anfrage enthaelt. Gibt `exact` mit zurueck,
 * damit die Rangfolge zwischen „ist die Adresse" und „enthaelt sie" trennen
 * kann: `10.20.0.1` steckt in `10.20.0.14`, und die beiden zu vermischen ist
 * genau der Fehler, den man mitten in der Show nicht merkt.
 */
const hit = (
  field: LookupField,
  hay: string | number | undefined,
  q: string,
): LookupMatch | null => {
  const value = String(hay ?? '').trim()
  if (!value) return null
  const low = value.toLowerCase()
  if (!low.includes(q)) return null
  return { field, value, exact: low === q }
}

/**
 * Rangfolge eines Treffers: exakte Identitaet vor teilweiser Identitaet vor
 * Prosa. Kleiner ist besser, damit `sort` ohne Vorzeichen-Dreher auskommt.
 */
const rank = (m: LookupMatch): number => {
  const identitaet = IDENTITY_FIELDS.has(m.field)
  if (identitaet && m.exact) return 0
  if (identitaet) return 1
  return m.exact ? 2 : 3
}

export interface LookupInput {
  equipment: readonly EquipmentItem[]
  cables: readonly Cable[]
  locations?: readonly LocationFrame[]
  /** Aufbau-Status aus dem Projekt — `checkState.cables`. */
  checkedCables?: Record<string, boolean>
}

export interface LookupOptions {
  /** Wie viele Antworten hoechstens. 0 oder weniger heisst: alle. */
  limit?: number
  /** Wie viele Abhaengige je Antwort hoechstens. */
  dependentLimit?: number
}

/**
 * Alles, was mitten in der Show eingetippt werden kann, gegen den ganzen Plan.
 *
 * Leere Anfrage heisst leere Liste und NICHT „alle": eine Nachschlage-Funktion,
 * die bei leerem Feld den ganzen Plan ausschuettet, ist im Zweifel die Liste,
 * die jemand fuer einen Treffer haelt.
 */
export function lookupInPlan(
  input: LookupInput,
  query: string,
  options: LookupOptions = {},
): LookupAnswer[] {
  const q = norm(query)
  if (!q) return []

  const { equipment, cables, locations = [], checkedCables = {} } = input
  const byId = new Map(equipment.map((e) => [e.id, e]))
  const limit = options.limit ?? 12
  const dependentLimit = options.dependentLimit ?? 8

  // Die Port-Karten einmal fuer den ganzen Plan — sie ist die Quelle fuer
  // „welcher Switch-Port", und sie zweimal zu bauen waere teuer und wuerde
  // sich am Ende widersprechen koennen.
  const portMaps = buildSwitchPortMaps([...equipment], [...cables])
  /** deviceId -> { switchName, port } je Belegung. */
  const uplinks = new Map<string, { switchName: string; port: string }[]>()
  for (const map of portMaps) {
    for (const row of map.rows) {
      if (!row.deviceId) continue
      const liste = uplinks.get(row.deviceId) ?? []
      liste.push({ switchName: map.switchName, port: row.port })
      uplinks.set(row.deviceId, liste)
    }
  }

  const portLabelOf = (deviceId: string, portId: string): string => {
    const dev = byId.get(deviceId)
    const port = [...(dev?.inputs ?? []), ...(dev?.outputs ?? [])].find((p) => p.id === portId)
    return port ? portDisplayLabel(port) : portId
  }

  const answers: { antwort: LookupAnswer; rang: number }[] = []

  for (const e of equipment) {
    const matches: LookupMatch[] = []
    const push = (m: LookupMatch | null) => {
      if (m) matches.push(m)
    }

    push(hit('name', e.name, q))
    push(hit('shortName', e.shortName, q))
    push(hit('assetTag', e.assetTag, q))
    push(hit('serial', e.serialNumber, q))
    push(hit('qrId', e.qrId, q))
    push(hit('category', e.category, q))
    push(hit('subtitle', e.subtitle, q))
    push(hit('notes', e.notes, q))

    const nics = deviceInterfaces(e)
    for (const nic of nics) {
      push(hit('ip', nic.ipAddress, q))
      push(hit('mac', nic.macAddress, q))
      push(hit('vlan', nic.vlanId, q))
      push(hit('switchPort', nic.switchPort, q))
    }

    if (!matches.length) continue

    matches.sort((a, b) => rank(a) - rank(b))

    const switchNameOf = (id?: string): string | undefined =>
      id ? byId.get(id)?.name : undefined

    const interfaces: LookupInterface[] = nics.map((nic) => ({
      ...(nic.label ? { label: nic.label } : {}),
      ...(nic.ipAddress ? { ipAddress: nic.ipAddress } : {}),
      ...(nic.macAddress ? { macAddress: nic.macAddress } : {}),
      ...(nic.vlanId !== undefined ? { vlanId: nic.vlanId } : {}),
      ...(switchNameOf(nic.switchEquipmentId)
        ? { switchName: switchNameOf(nic.switchEquipmentId) }
        : {}),
      ...(nic.switchPort ? { switchPort: nic.switchPort } : {}),
    }))

    // Belegungen aus der Port-Karte, die die Schnittstelle selbst nicht nennt:
    // ein Kabel zum Switch ist eine ebenso gueltige Antwort auf „welcher Port"
    // wie ein gepflegtes Feld, und mitten in der Show ist es oft die einzige.
    for (const up of uplinks.get(e.id) ?? []) {
      const schon = interfaces.some(
        (i) => i.switchName === up.switchName && i.switchPort === up.port,
      )
      if (!schon) interfaces.push({ switchName: up.switchName, switchPort: up.port })
    }

    const dependents: LookupDependent[] = []
    for (const c of cables) {
      const istVon = c.fromEquipmentId === e.id
      const istZu = c.toEquipmentId === e.id
      if (!istVon && !istZu) continue
      const anderesId = istVon ? c.toEquipmentId : c.fromEquipmentId
      const anderes = byId.get(anderesId)
      if (!anderes) continue
      dependents.push({
        id: anderesId,
        name: anderes.name,
        viaPort: portLabelOf(e.id, istVon ? c.fromPortId : c.toPortId),
        direction: istVon ? 'downstream' : 'upstream',
        ...(c.id in checkedCables ? { checked: checkedCables[c.id] } : {}),
      })
    }

    const rackLabel = e.rackInstanceLabel
    const antwort: LookupAnswer = {
      id: e.id,
      name: e.name,
      ...(e.shortName ? { shortName: e.shortName } : {}),
      ...(e.category ? { category: e.category } : {}),
      matched: matches,
      interfaces,
      ...(locationNameForEquipment(e, locations)
        ? { location: locationNameForEquipment(e, locations) }
        : {}),
      ...(rackLabel
        ? {
            rack: {
              label: rackLabel,
              ...(e.rackInstanceStartUnit !== undefined
                ? { startUnit: e.rackInstanceStartUnit }
                : {}),
            },
          }
        : {}),
      dependents:
        dependentLimit > 0 ? dependents.slice(0, dependentLimit) : dependents,
    }
    answers.push({ antwort, rang: rank(matches[0]) })
  }

  answers.sort((a, b) => a.rang - b.rang || a.antwort.name.localeCompare(b.antwort.name))
  const sortiert = answers.map((a) => a.antwort)
  return limit > 0 ? sortiert.slice(0, limit) : sortiert
}

/**
 * Die Ein-Zeilen-Zusammenfassung fuer die Trefferliste: die Adressen, die das
 * Geraet traegt, und der Switch-Port. Genau die drei Angaben, nach denen der
 * Befund fragt — ohne dass jemand den Treffer erst aufklappen muss.
 */
export function answerSummary(a: LookupAnswer): string {
  const teile: string[] = []
  const ips = a.interfaces.map((i) => i.ipAddress).filter(Boolean) as string[]
  if (ips.length) teile.push(ips.join(', '))
  const vlans = [...new Set(a.interfaces.map((i) => i.vlanId).filter((v) => v !== undefined))]
  if (vlans.length) teile.push(`VLAN ${vlans.join('/')}`)
  const ports = a.interfaces
    .filter((i) => i.switchPort)
    .map((i) => (i.switchName ? `${i.switchName} ${i.switchPort}` : String(i.switchPort)))
  if (ports.length) teile.push(ports.join(', '))
  if (a.rack) {
    teile.push(a.rack.startUnit !== undefined ? `${a.rack.label} HE ${a.rack.startUnit}` : a.rack.label)
  }
  if (a.location) teile.push(a.location)
  return teile.join(' · ')
}

/**
 * Warum dieser Treffer in der Liste steht — im Klartext, und NUR, wenn er
 * nicht auf den Namen traf. Beim Namenstreffer sieht man es ohnehin; bei einem
 * Treffer in einer Notiz sieht man es nicht, und genau dort entsteht der
 * Irrtum, den Entscheidung 1 oben meint.
 */
export function matchNote(a: LookupAnswer, label: (f: LookupField) => string): string | undefined {
  const m = a.matched[0]
  if (!m || m.field === 'name' || m.field === 'shortName') return undefined
  return `${label(m.field)}: ${m.value}`
}
