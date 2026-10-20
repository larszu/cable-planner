// ───────────────────────────────────────────────────────────────────────────
// Was der MCP-Server AENDERN darf (#873, Stufe 2; #1052 Aufbau).
//
// ═══════════════════════════════════════════════════════════════════════════
// DIESELBEN AKTIONEN WIE DIE OBERFLAECHE — UND ZWAR WIRKLICH
// ═══════════════════════════════════════════════════════════════════════════
//
// #873 sagt es als Ziel: „ueber dieselben Store-Aktionen wie die
// Oberflaeche". Das ist keine Stilfrage. `addCablesBulk` prueft die
// Port-Belegung und setzt die Ebene; `deleteCable` raeumt die Verweise auf.
// Eine eigene Schreibroutine haette all das nachzubauen — und waere ab dem
// ersten Sonderfall eine zweite Vorstellung davon, was ein Kabel ist.
//
// #1052 haelt sich an dieselbe Regel: Geraete kommen ueber `addEquipment`
// (wie der Doppelklick in der Bibliothek), eigene Geraete ueber
// `templateFromGroups` (wie der Dialog „Eigenes Gerät anlegen"), die Richtung
// ueber `richteVerbindungAus` (#1029), der Kabeltyp ueber
// `defaultCableSpecId` (die Vorbelegung des Kabeldialogs, #1036), das Rack
// ueber `presetFromEquipmentSelection` und `addGroupPreset` (wie „Im
// Rack-Builder anordnen", interne Kabel seit #1037).
//
// Dieses Modul bekommt die Aktionen deshalb HEREINGEREICHT (`Aktionen`).
// Das hat zwei Wirkungen: es kann nichts anderes anfassen als das, was hier
// steht, und ein Test kann es ohne Store stellen.
//
// ═══════════════════════════════════════════════════════════════════════════
// WAS NICHT GEHT, UND WARUM NICHT
// ═══════════════════════════════════════════════════════════════════════════
//
// KEIN SCHALTBEFEHL. Keine Kreuzpunkte, kein Mischer. #873 sagt den Grund in
// einem Satz: „ein Modell, das waehrend der Sendung Routing schaltet, ist ein
// Risiko ohne Gegenwert". Lesen ja (Stufe 1), schalten nie.
//
// KEIN LOESCHEN VON GERAETEN. Ein Geraet zu loeschen nimmt seine Kabel mit,
// und was daran haengt — Rack-Platzierung, Checks, Fotos — steht an
// Dutzenden Stellen. Diese Stufe trennt Verbindungen; ein Geraet entfernt
// der Mensch.
//
// KEIN STILLES ERSETZEN. Ein belegter Eingang ist ein Fehler; nur
// `replace: true` nimmt das alte Kabel heraus (#1052).
//
// KEINE ERFUNDENEN ANGABEN. Wer ein Kabel anlegt, ohne eine Laenge zu
// nennen, bekommt kein „0 m": das Feld bleibt, wie die Aktion es setzt, und
// die Antwort sagt, was fehlt.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import { v4 as uuidv4 } from 'uuid'
import { cableCatalog, checkCableCompatibility, pickHighestSdiStandard } from '../types/cableSpec'
import { ALL_CONNECTOR_TYPES } from '../types/equipment'
import type { CablePlannerProject } from '../types/project'
import type { Cable } from '../types/cable'
import type { ConnectorType, EquipmentItem, EquipmentTemplate, GroupPreset } from '../types/equipment'
import { findeGeraet, findePort } from './mcpAufloesen'
import { richteVerbindungAus } from './connectionDirection'
import { cableChoiceKey, defaultCableSpecId, rankCablesForPorts, type LastCableChoice } from './lastCableChoice'
import { connectorToCableType } from './cableInheritance'
import { cablesEndingAt, targetKey } from './portOccupancy'
import { presetFromEquipmentSelection } from './rackPreset'
import { canArrangeInRack } from './rackArrange'
import { maskToBits, parseIpv4 } from './subnet'
import { locationForEquipment } from './equipmentLocation'
import { etagenSchluessel } from './etagen'
import type { Floor, LocationFrame } from '../types/location'
import { templateFromGroups, type PortGroupDraft } from '../components/Library/libraryPanelHelpers'

/** Die Namen der schreibenden Werkzeuge. */
export const MCP_SCHREIBWERKZEUGE = [
  'connect_ports',
  'disconnect_cable',
  'set_cable',
  'rename_device',
  'add_device',
  'create_device',
  'connect_many',
  'set_rack_units',
  'arrange_rack',
  'set_device',
  'set_devices',
  'create_location',
  'set_location',
  'delete_location',
  'place_in_location',
  'create_floor',
  'set_floor',
] as const

export type McpSchreibwerkzeug = (typeof MCP_SCHREIBWERKZEUGE)[number]

/** Welche davon etwas WEGNEHMEN — sie tragen `destructiveHint`. */
export const MCP_ZERSTOEREND: ReadonlySet<string> = new Set(['disconnect_cable', 'delete_location'])

/** Hoechstens so viele Kabel je `connect_many`. */
export const MCP_KABEL_MAX = 200
/** Groesste Rackhoehe, die ein Werkzeug setzt (HE). */
export const MCP_HE_MAX = 60
/** Hoechstens so viele Geraete je `set_devices` / `place_in_location`. */
export const MCP_GERAETE_MAX = 200

type KabelEntwurf = {
  fromEquipmentId: string
  fromPortId: string
  toEquipmentId: string
  toPortId: string
  name: string
  type: Cable['type']
  length?: number
  color: string
  notes: string
} & Partial<Pick<Cable, 'cableSpecId' | 'standard' | 'needsConverter'>>

/**
 * Die Store-Aktionen, die dieses Modul benutzen darf. Mehr gibt es nicht —
 * und genau das ist der Zweck der Schnittstelle.
 */
export interface Aktionen {
  /**
   * Dieselbe Signatur wie im Store — absichtlich. Die Pflichtfelder des
   * Entwurfs sind die des Stores; sie hier optional zu machen hiesse, dass
   * dieses Modul einen zweiten, weicheren Kabelbegriff hat.
   */
  addCablesBulk: (drafts: KabelEntwurf[]) => { created: number; skipped: number; skippedReasons: string[] }
  deleteCable: (id: string) => void
  updateCable: (id: string, patch: Partial<Cable>) => void
  updateEquipment: (id: string, patch: Partial<EquipmentItem>) => void
  // ─── #1052 ───
  addEquipment: (item: Omit<EquipmentItem, 'id'>) => void
  addCustomTemplate: (template: EquipmentTemplate) => void
  addKnownCategories: (categories: string[]) => void
  addGroupPreset: (preset: GroupPreset) => void
  // ─── #1066 ───
  addLocation: (partial?: Partial<LocationFrame>) => void
  updateLocation: (id: string, patch: Partial<LocationFrame>) => void
  deleteLocation: (id: string) => void
  moveLocationWithContents: (id: string, dx: number, dy: number, containedEquipmentIds: string[]) => void
  setFloors: (floors: Floor[]) => void
  renameFloor: (alt: string, neu: string) => void
  /** Der Plan NACH den Aktionen dieses Aufrufs — `addEquipment` vergibt die
   *  Id im Store und gibt sie nicht zurueck. */
  aktuell: () => Readonly<CablePlannerProject>
  /** Die Geraete-Bibliothek, wie die Seitenleiste sie zeigt. */
  bibliothek: () => readonly EquipmentTemplate[]
  /** #1036 — der zuletzt gewaehlte Kabeltyp je Steckerpaar. */
  letzteKabelwahl: () => Readonly<Record<string, LastCableChoice>>
  /** Wohin ein neues Geraet kommt, wenn keine Position genannt ist. */
  naechsterPlatz: () => { x: number; y: number }
}

export interface SchreibAntwort {
  daten: Record<string, unknown>
  text: string
  /** Fuer den MCP-Aufrufer: hat es geklappt? */
  ok: boolean
}

const nein = (text: string, daten: Record<string, unknown> = {}): SchreibAntwort => ({
  ok: false,
  text,
  daten: { ok: false, ...daten },
})

const ja = (text: string, daten: Record<string, unknown> = {}): SchreibAntwort => ({
  ok: true,
  text,
  daten: { ok: true, ...daten },
})

/**
 * Was statt dessen ginge.
 *
 * #873 verlangt genau das: „Fehlermeldung sagt, was stattdessen geht (z. B.
 * ‚SDI-Ausgang auf HDMI-Eingang: Konverter noetig')". Eine Ablehnung ohne
 * Ausweg schickt das Modell in eine Schleife — es versucht dasselbe noch
 * einmal, weil es nichts Besseres weiss.
 */
const rat = (von: ConnectorType, nach: ConnectorType): string => {
  if (von === nach) return ''
  const passend = cableCatalog.find((spec) => {
    const r = checkCableCompatibility(von, nach, spec)
    return r.level !== 'error'
  })
  return passend
    ? `A "${passend.name}" cable fits both ends.`
    : `No cable in the catalogue connects ${von} to ${nach} directly - this needs a converter, and the planner names converters instead of inserting them.`
}

const portZeile = (p: EquipmentItem['inputs'][number], direction: 'in' | 'out') => ({
  id: p.id,
  name: p.name,
  direction: p.direction === 'bidirectional' ? 'bidirectional' : direction,
  connectorType: p.connectorType,
})

const geraetAntwort = (e: EquipmentItem) => ({
  deviceId: e.id,
  name: e.name,
  category: e.category ?? null,
  rackUnits: e.isRackDevice || e.rackUnits ? Math.max(1, e.rackUnits ?? 1) : null,
  ports: [...e.inputs.map((p) => portZeile(p, 'in')), ...e.outputs.map((p) => portZeile(p, 'out'))],
})

const zahl = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

const heOderFehler = (v: unknown): number | string => {
  const n = zahl(v)
  if (n === undefined || !Number.isInteger(n) || n < 1 || n > MCP_HE_MAX) {
    return `Rack units must be a whole number from 1 to ${MCP_HE_MAX} (19" height units, 1 RU = 44.45 mm).`
  }
  return n
}

/** Das neue Geraet ist das letzte der Liste (siehe `Aktionen.aktuell`). */
const platziere = (aktionen: Aktionen, vorlage: EquipmentTemplate, args: Record<string, unknown>, name?: string) => {
  const x = zahl(args.x)
  const y = zahl(args.y)
  const platz = x !== undefined && y !== undefined ? { x, y } : aktionen.naechsterPlatz()
  aktionen.addEquipment({ ...vorlage, ...(name ? { name } : {}), ...platz })
  return aktionen.aktuell().equipment.at(-1)
}

// ─── Kabel ─────────────────────────────────────────────────────────────────

interface KabelWunsch {
  fromDeviceId?: unknown
  fromPortId?: unknown
  toDeviceId?: unknown
  toPortId?: unknown
  name?: unknown
  type?: unknown
  length?: unknown
  notes?: unknown
  color?: unknown
  replace?: unknown
}

type KabelErgebnis =
  | { ok: true; entwurf: KabelEntwurf; ersetzt: string[]; umgedreht: boolean; hinweis: string; laengeGenannt: boolean; zeile: string }
  | { ok: false; fehler: string }

/**
 * Ein Kabelwunsch → ein Entwurf fuer `addCablesBulk`, oder ein Satz, warum
 * nicht. `belegt` sind die Ziel-Ports, die frueher im selben Aufruf vergeben
 * wurden: zwei Kabel auf denselben Eingang sind auch im Stapel ein Fehler.
 */
const planeKabel = (
  project: Readonly<CablePlannerProject>,
  aktionen: Aktionen,
  w: KabelWunsch,
  belegt: ReadonlyMap<string, number>,
): KabelErgebnis => {
  const vonGeraet = findeGeraet(project, w.fromDeviceId)
  if (!vonGeraet.ok) return { ok: false, fehler: vonGeraet.fehler }
  const nachGeraet = findeGeraet(project, w.toDeviceId)
  if (!nachGeraet.ok) return { ok: false, fehler: nachGeraet.fehler }
  const vonPort = findePort(vonGeraet.wert, w.fromPortId, 'from')
  if (!vonPort.ok) return { ok: false, fehler: vonPort.fehler }
  const nachPort = findePort(nachGeraet.wert, w.toPortId, 'to')
  if (!nachPort.ok) return { ok: false, fehler: nachPort.fehler }

  const ausrichtung = richteVerbindungAus(project.equipment, {
    source: vonGeraet.wert.id,
    sourceHandle: vonPort.wert.port.id,
    target: nachGeraet.wert.id,
    targetHandle: nachPort.wert.port.id,
  })
  const benannt = `${vonGeraet.wert.name} · ${vonPort.wert.port.name} → ${nachGeraet.wert.name} · ${nachPort.wert.port.name}`
  if (!ausrichtung.ok) {
    return {
      ok: false,
      fehler:
        ausrichtung.grund === 'inputToInput'
          ? `Both ends are inputs (${benannt}). A cable runs from an output to an input.`
          : `Both ends are outputs (${benannt}). A cable runs from an output to an input.`,
    }
  }
  const umgedreht = ausrichtung.umgedreht
  const [quelle, qPort, ziel, zPort] = umgedreht
    ? [nachGeraet.wert, nachPort.wert.port, vonGeraet.wert, vonPort.wert.port]
    : [vonGeraet.wert, vonPort.wert.port, nachGeraet.wert, nachPort.wert.port]
  const zeile = `${quelle.name} · ${qPort.name} → ${ziel.name} · ${zPort.name}`

  const schluessel = targetKey({ toEquipmentId: ziel.id, toPortId: zPort.id })
  const imStapel = belegt.get(schluessel)
  if (imStapel !== undefined) {
    return { ok: false, fehler: `${ziel.name} · ${zPort.name} already gets cable ${imStapel + 1} of this call.` }
  }
  const vorhanden = cablesEndingAt(project.cables as Cable[], { equipmentId: ziel.id, portId: zPort.id })
  if (vorhanden.length > 0 && w.replace !== true) {
    const wer = vorhanden.map((c) => c.cableNumber || c.name || c.id).join(', ')
    return {
      ok: false,
      fehler: `${ziel.name} · ${zPort.name} is already connected (cable ${wer}). Pass replace: true to swap it, or pick a free input.`,
    }
  }

  const hinweis = rat(qPort.connectorType, zPort.connectorType)
  const laenge = zahl(w.length)
  const basis = {
    fromEquipmentId: quelle.id,
    fromPortId: qPort.id,
    toEquipmentId: ziel.id,
    toPortId: zPort.id,
    name: typeof w.name === 'string' ? w.name : '',
    // #1057 — ohne genannte Laenge bleibt das Feld leer, nicht 0: list_cables
    // meldet dann null, und Stuecklisten zaehlen kein 0-m-Kabel.
    ...(laenge !== undefined ? { length: laenge } : {}),
    notes: typeof w.notes === 'string' ? w.notes : '',
  }

  let entwurf: KabelEntwurf
  if (typeof w.type === 'string' && w.type) {
    entwurf = { ...basis, type: w.type as Cable['type'], color: typeof w.color === 'string' ? w.color : '' }
  } else {
    // #1036 — dieselbe Vorbelegung wie der Kabeldialog.
    const rangliste = rankCablesForPorts(cableCatalog, qPort.connectorType, zPort.connectorType)
    const wahl = cableChoiceKey(qPort.connectorType, zPort.connectorType)
    const specId = defaultCableSpecId(rangliste, wahl ? aktionen.letzteKabelwahl()[wahl] : undefined, {
      from: qPort.connectorType,
      to: zPort.connectorType,
      fromCaps: quelle.sdiCaps,
      toCaps: ziel.sdiCaps,
      videoFormat: project.metadata?.defaultVideoFormat,
    })
    const treffer = rangliste.find((r) => r.cable.id === specId)
    entwurf = treffer
      ? {
          ...basis,
          type: connectorToCableType(treffer.cable.connectorType),
          color: typeof w.color === 'string' ? w.color : treffer.cable.color,
          cableSpecId: treffer.cable.id,
          standard: pickHighestSdiStandard(treffer.cable.standards),
          ...(treffer.level !== 'ok' ? { needsConverter: true } : {}),
        }
      : {
          // Wie der Kabeldialog ohne passenden Katalogeintrag: der Typ erbt
          // den Stecker am sendenden Ende.
          ...basis,
          type: connectorToCableType(qPort.connectorType),
          color: typeof w.color === 'string' ? w.color : '',
          needsConverter: true,
        }
  }
  return {
    ok: true,
    entwurf,
    ersetzt: w.replace === true ? vorhanden.map((c) => c.id) : [],
    umgedreht,
    hinweis,
    laengeGenannt: laenge !== undefined,
    zeile,
  }
}

const LUECKE = 'No length was given, so it stays empty - that is a gap, not a measurement.'

const verbinde = (
  project: Readonly<CablePlannerProject>,
  aktionen: Aktionen,
  wuensche: readonly KabelWunsch[],
): { ergebnisse: Array<Record<string, unknown>>; angelegt: number; abgelehnt: number; gruende: string[]; hinweise: string[] } => {
  const belegt = new Map<string, number>()
  const geplant: Array<{ index: number; plan: Extract<KabelErgebnis, { ok: true }> }> = []
  const ergebnisse: Array<Record<string, unknown>> = wuensche.map((w, index) => {
    const plan = planeKabel(project, aktionen, w ?? {}, belegt)
    if (!plan.ok) return { index, ok: false, error: plan.fehler }
    belegt.set(targetKey(plan.entwurf), index)
    geplant.push({ index, plan })
    return { index, ok: true, cable: plan.zeile, flipped: plan.umgedreht, type: plan.entwurf.type, advice: plan.hinweis || null }
  })
  for (const { plan } of geplant) for (const id of plan.ersetzt) aktionen.deleteCable(id)
  const bulk = geplant.length > 0 ? aktionen.addCablesBulk(geplant.map((g) => g.plan.entwurf)) : { created: 0, skipped: 0, skippedReasons: [] }
  if (bulk.created === 0) {
    // Nach der Vorpruefung selten (gesperrter Plan); den Grund sagt dann der
    // Store und nicht diese Schicht.
    for (const g of geplant) ergebnisse[g.index] = { ...ergebnisse[g.index], ok: false, error: bulk.skippedReasons.join(' ') || 'the planner refused it.' }
  }
  const angelegt = bulk.created
  return {
    ergebnisse,
    angelegt,
    abgelehnt: wuensche.length - angelegt,
    gruende: bulk.skippedReasons,
    hinweise: geplant.map((g) => g.plan.hinweis).filter(Boolean),
  }
}

// ─── Eigenes Geraet ────────────────────────────────────────────────────────

const RICHTUNGEN = new Set(['in', 'out', 'bidirectional'])

const gruppenAus = (roh: unknown): PortGroupDraft[] | string => {
  if (roh === undefined) return []
  if (!Array.isArray(roh)) return 'portGroups must be a list.'
  const gruppen: PortGroupDraft[] = []
  for (const [i, g] of roh.entries()) {
    const o = (g ?? {}) as Record<string, unknown>
    const richtung = String(o.direction ?? '')
    if (!RICHTUNGEN.has(richtung)) return `portGroups[${i}].direction must be in, out or bidirectional.`
    const anzahl = zahl(o.count)
    if (anzahl === undefined || !Number.isInteger(anzahl) || anzahl < 1 || anzahl > 256) {
      return `portGroups[${i}].count must be a whole number from 1 to 256.`
    }
    const stecker = String(o.connector ?? '')
    if (!(ALL_CONNECTOR_TYPES as readonly string[]).includes(stecker)) {
      const klein = stecker.toLowerCase()
      const aehnlich = ALL_CONNECTOR_TYPES.filter((c) => klein && (c.toLowerCase().includes(klein) || klein.includes(c.toLowerCase())))
      return `portGroups[${i}].connector "${stecker}" is not a connector type.${aehnlich.length ? ` Similar: ${aehnlich.slice(0, 12).join(', ')}.` : ' Examples: BNC, HDMI, Ethernet/RJ45, XLR, Jack 6.35 mm TRS.'}`
    }
    const label = typeof o.labelPrefix === 'string' && o.labelPrefix.trim() ? o.labelPrefix.trim() : richtung === 'out' ? 'Output' : 'Input'
    gruppen.push({
      id: `mcp-${i}`,
      // Zweiwege-Ports stehen bei den Eingaengen, wie im Dialog.
      direction: richtung === 'out' ? 'out' : 'in',
      count: anzahl,
      connectorType: stecker as ConnectorType,
      label,
      ...(richtung === 'bidirectional' ? { bidirectional: true } : {}),
    })
  }
  return gruppen
}

// ─── Geraetefelder (#1065) ─────────────────────────────────────────────────

/**
 * Ein Feldwunsch → ein Patch fuer `updateEquipment`, oder ein Satz, warum
 * nicht. Leerer Text loescht ein Feld (ausser dem Namen).
 *
 * ZUGANGSDATEN NICHT. `username`/`password` werden abgelehnt statt
 * uebergangen: „Claude darf meinen Plan aendern" heisst nicht „Claude
 * schreibt Kennwoerter in den Plan" (#1065). Die traegt der Mensch in der
 * Oberflaeche ein.
 */
const geraetePatch = (args: Record<string, unknown>): Partial<EquipmentItem> | string => {
  if (args.username !== undefined || args.password !== undefined) {
    return 'Credentials (username, password) are not written over MCP - enter them in the device inspector.'
  }
  const patch: Partial<EquipmentItem> = {}
  const text = (k: string): string | undefined | null => {
    const v = args[k]
    if (v === undefined) return undefined
    return typeof v === 'string' ? v.trim() : null
  }
  if (args.name !== undefined) {
    const n = text('name')
    if (!n) return 'A device needs a name - an empty one would hide it in every list.'
    patch.name = n
  }
  for (const k of ['notes', 'serialNumber', 'category'] as const) {
    const v = text(k)
    if (v === null) return `${k} must be text.`
    if (v !== undefined) patch[k] = v || undefined
  }
  const ip = text('ipAddress')
  if (ip === null) return 'ipAddress must be text.'
  if (ip !== undefined) {
    if (ip && !parseIpv4(ip)) return `"${ip}" is not an IPv4 address (four numbers 0-255, e.g. 192.168.1.20).`
    patch.ipAddress = ip || undefined
  }
  const maske = text('subnetMask')
  if (maske === null) return 'subnetMask must be text.'
  if (maske !== undefined) {
    if (maske && (!/^\d{1,3}(\.\d{1,3}){3}$/.test(maske) || maskToBits(maske) === null)) {
      return `"${maske}" is not a subnet mask; write it dotted with contiguous ones, e.g. 255.255.255.0.`
    }
    patch.subnetMask = maske || undefined
  }
  if (args.managementVlanId !== undefined) {
    const v = args.managementVlanId
    if (v === null) patch.managementVlanId = undefined
    else if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 4094) {
      return 'managementVlanId must be a whole number from 1 to 4094, or null to clear it.'
    } else patch.managementVlanId = v
  }
  for (const k of ['x', 'y'] as const) {
    if (args[k] === undefined) continue
    const n = zahl(args[k])
    if (n === undefined) return `${k} must be a number.`
    patch[k] = n
  }
  if (Object.keys(patch).length === 0) {
    return 'Nothing to change - pass at least one of name, notes, ipAddress, subnetMask, managementVlanId, serialNumber, category, x, y.'
  }
  return patch
}

const setzeGeraet = (
  project: Readonly<CablePlannerProject>,
  aktionen: Aktionen,
  args: Record<string, unknown>,
): { ok: true; deviceId: string; name: string; changed: string[] } | { ok: false; fehler: string } => {
  const g = findeGeraet(project, args.deviceId)
  if (!g.ok) return { ok: false, fehler: g.fehler }
  const patch = geraetePatch(args)
  if (typeof patch === 'string') return { ok: false, fehler: `${g.wert.name}: ${patch}` }
  aktionen.updateEquipment(g.wert.id, patch)
  if (patch.category) aktionen.addKnownCategories([patch.category])
  return { ok: true, deviceId: g.wert.id, name: g.wert.name, changed: Object.keys(patch) }
}

// ─── Raeume und Etagen (#1066) ─────────────────────────────────────────────

const klein = (s: string) => s.trim().toLowerCase()

/** Raum per Id oder Name. Ein doppelter Name wird abgelehnt, nicht geraten. */
export const findeRaum = (
  project: Readonly<CablePlannerProject>,
  ref: unknown,
): { ok: true; wert: LocationFrame } | { ok: false; fehler: string } => {
  const r = typeof ref === 'string' ? ref.trim() : ''
  const alle = project.locations ?? []
  if (!r) return { ok: false, fehler: 'Pass locationId: a room id or name (see list_locations).' }
  const perId = alle.find((l) => l.id === r)
  if (perId) return { ok: true, wert: perId }
  const treffer = alle.filter((l) => klein(l.name) === klein(r))
  if (treffer.length === 1) return { ok: true, wert: treffer[0] }
  if (treffer.length > 1) {
    return {
      ok: false,
      fehler: `"${r}" names ${treffer.length} rooms (${treffer.map((l) => `${l.id}${l.floor ? ` on ${l.floor}` : ''}`).join(', ')}); pass the id.`,
    }
  }
  return { ok: false, fehler: `No room "${r}". Rooms: ${alle.map((l) => `"${l.name}"`).slice(0, 20).join(', ') || 'none'}.` }
}

const findeEtage = (project: Readonly<CablePlannerProject>, ref: unknown): Floor | undefined => {
  const r = typeof ref === 'string' ? klein(ref) : ''
  return r ? (project.floors ?? []).find((f) => etagenSchluessel(f.name) === r) : undefined
}

/** Eine genannte Etage muss es geben — ein Tippfehler ist keine neue Etage (#911). */
const etageOderFehler = (project: Readonly<CablePlannerProject>, roh: unknown): string | { name: string } | undefined => {
  if (roh === undefined) return undefined
  if (typeof roh !== 'string') return 'floor must be text.'
  if (!roh.trim()) return { name: '' }
  const f = findeEtage(project, roh)
  if (!f) return `No floor "${roh}". Floors: ${(project.floors ?? []).map((x) => `"${x.name}"`).join(', ') || 'none'} - create_floor first.`
  return { name: f.name }
}

const masse = (args: Record<string, unknown>): Partial<LocationFrame> | string => {
  const patch: Partial<LocationFrame> = {}
  for (const k of ['x', 'y'] as const) {
    if (args[k] === undefined) continue
    const n = zahl(args[k])
    if (n === undefined) return `${k} must be a number.`
    patch[k] = n
  }
  for (const k of ['width', 'height'] as const) {
    if (args[k] === undefined) continue
    const n = zahl(args[k])
    if (n === undefined || n < 40) return `${k} must be a number of at least 40.`
    patch[k] = n
  }
  return patch
}

const GERAET_B = 220
const GERAET_H = 140
const ABSTAND = 40
const TITEL = 40

/**
 * Ordnet Geraete zeilenweise im Rahmen an; reicht der Platz nicht, waechst
 * der Rahmen. Kein Aufrufer soll Koordinaten rechnen (#1066).
 */
export const ordneImRaum = (raum: LocationFrame, geraete: readonly EquipmentItem[]) => {
  const zelleB = Math.max(...geraete.map((e) => e.width ?? GERAET_B)) + ABSTAND
  const zelleH = Math.max(...geraete.map((e) => e.height ?? GERAET_H)) + ABSTAND
  const spalten = Math.max(1, Math.floor((raum.width - ABSTAND) / zelleB))
  const plaetze = geraete.map((e, i) => ({
    id: e.id,
    x: raum.x + ABSTAND + (i % spalten) * zelleB,
    y: raum.y + TITEL + Math.floor(i / spalten) * zelleH,
  }))
  const zeilen = Math.ceil(geraete.length / spalten)
  return {
    plaetze,
    hoehe: Math.max(raum.height, TITEL + zeilen * zelleH),
    breite: Math.max(raum.width, ABSTAND + Math.min(spalten, geraete.length) * zelleB),
  }
}

export const fuehreSchreibwerkzeugAus = (
  project: Readonly<CablePlannerProject>,
  aktionen: Aktionen,
  werkzeug: string,
  args: Record<string, unknown> = {},
): SchreibAntwort => {
  switch (werkzeug) {
    case 'connect_ports': {
      const r = verbinde(project, aktionen, [args])
      const e = r.ergebnisse[0]
      if (r.angelegt === 0) {
        const hinweis = r.hinweise[0] ?? ''
        const grund = typeof e.error === 'string' ? e.error : ''
        return nein(`Not connected: ${grund} ${hinweis}`.replace(/\s+/g, ' ').trim(), { reasons: r.gruende.length ? r.gruende : [grund] })
      }
      const laengeGenannt = zahl(args.length) !== undefined
      return ja(
        `Connected ${String(e.cable)}${e.flipped ? ' (direction flipped: output to input)' : ''}.${e.advice ? ` ${String(e.advice)}` : ''}${laengeGenannt ? '' : ` ${LUECKE}`}`,
        { created: 1, cable: e.cable, flipped: e.flipped, type: e.type, advice: e.advice, lengthStated: laengeGenannt },
      )
    }

    case 'connect_many': {
      const kabel = Array.isArray(args.cables) ? (args.cables as KabelWunsch[]) : []
      if (kabel.length === 0) return nein('Pass cables: a list of {fromDeviceId, fromPortId, toDeviceId, toPortId}.')
      if (kabel.length > MCP_KABEL_MAX) return nein(`At most ${MCP_KABEL_MAX} cables per call; split the list.`)
      const r = verbinde(project, aktionen, kabel)
      const ohneLaenge = kabel.filter((k, i) => r.ergebnisse[i].ok && zahl(k?.length) === undefined).length
      const satz = `${r.angelegt} of ${kabel.length} cables connected${r.abgelehnt ? `, ${r.abgelehnt} refused (see results)` : ''}.${ohneLaenge ? ` ${ohneLaenge} without length stay empty - gaps, not measurements.` : ''}`
      const daten = { created: r.angelegt, refused: r.abgelehnt, results: r.ergebnisse }
      // Teilerfolg ist Erfolg: die angelegten Kabel stehen im Plan (und im
      // Undo-Schritt), die abgelehnten stehen einzeln in `results`.
      return r.angelegt > 0 ? ja(satz, daten) : nein(satz, daten)
    }

    case 'add_device': {
      const ref = typeof args.template === 'string' ? args.template.trim() : ''
      if (!ref) return nein('Pass template: the exact library name (see search_library).')
      const bib = aktionen.bibliothek()
      const klein = ref.toLowerCase()
      const exakt = bib.filter((t) => t.name === ref)
      const treffer = exakt.length ? exakt : bib.filter((t) => t.name.toLowerCase() === klein)
      if (treffer.length !== 1) {
        const aehnlich = bib.filter((t) => t.name.toLowerCase().includes(klein)).map((t) => `"${t.name}"`)
        return nein(
          treffer.length > 1
            ? `"${ref}" names ${treffer.length} library templates.`
            : `No library template "${ref}".${aehnlich.length ? ` Similar: ${aehnlich.slice(0, 12).join(', ')}.` : ' Use search_library.'}`,
        )
      }
      const name = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : undefined
      const neu = platziere(aktionen, treffer[0], args, name)
      if (!neu) return nein('The planner did not add the device.')
      return ja(`Added "${neu.name}" from the library.`, geraetAntwort(neu))
    }

    case 'create_device': {
      const name = typeof args.name === 'string' ? args.name.trim() : ''
      if (!name) return nein('A device needs a name.')
      const gruppen = gruppenAus(args.portGroups)
      if (typeof gruppen === 'string') return nein(gruppen)
      let he: number | undefined
      if (args.rackUnits !== undefined) {
        const h = heOderFehler(args.rackUnits)
        if (typeof h === 'string') return nein(h)
        he = h
      }
      const kategorie = typeof args.category === 'string' && args.category.trim() ? args.category.trim() : 'Other'
      const vorlage = templateFromGroups({ name, category: kategorie, groups: gruppen, rackUnits: he })
      aktionen.addKnownCategories([kategorie])
      if (args.saveToLibrary === true) aktionen.addCustomTemplate(vorlage)
      const neu = platziere(aktionen, vorlage, args)
      if (!neu) return nein('The planner did not add the device.')
      return ja(
        `Created "${neu.name}" with ${neu.inputs.length} inputs and ${neu.outputs.length} outputs${args.saveToLibrary === true ? ', saved to the library' : ''}.`,
        { ...geraetAntwort(neu), savedToLibrary: args.saveToLibrary === true },
      )
    }

    case 'set_rack_units': {
      const geraet = findeGeraet(project, args.deviceId)
      if (!geraet.ok) return nein(geraet.fehler)
      const he = heOderFehler(args.rackUnits)
      if (typeof he === 'string') return nein(he)
      aktionen.updateEquipment(geraet.wert.id, { isRackDevice: true, rackUnits: he })
      return ja(`"${geraet.wert.name}" is a 19" rack device of ${he} RU.`, { deviceId: geraet.wert.id, rackUnits: he })
    }

    case 'arrange_rack': {
      const refs = Array.isArray(args.deviceIds) ? args.deviceIds : []
      if (refs.length === 0) return nein('Pass deviceIds: the devices to stack, top to bottom.')
      const geraete: EquipmentItem[] = []
      for (const ref of refs) {
        const g = findeGeraet(project, ref)
        if (!g.ok) return nein(g.fehler)
        if (geraete.some((e) => e.id === g.wert.id)) return nein(`"${g.wert.name}" is listed twice.`)
        geraete.push(g.wert)
      }
      if (!canArrangeInRack(geraete.map((e) => e.id), project.equipment)) {
        return nein('A placed rack cannot go into another rack - pass the devices, not the rack.')
      }
      const name = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : 'Rack'
      const preset = presetFromEquipmentSelection(geraete, uuidv4(), name, project.cables)
      if (!preset?.rack) return nein('The planner did not build the rack.')
      const belegt = preset.rack.placements.reduce((s, p) => s + p.heightUnits, 0)
      if (args.totalUnits !== undefined) {
        const he = heOderFehler(args.totalUnits)
        if (typeof he === 'string') return nein(he)
        if (he < belegt) return nein(`The devices need ${belegt} RU; a ${he} RU rack is too small.`)
        preset.rack.totalUnits = he
      }
      const nichtRack = geraete.filter((e) => !e.isRackDevice && !e.rackUnits).map((e) => e.name)
      aktionen.addGroupPreset(preset)
      return ja(
        `Saved rack "${name}" to the library: ${geraete.length} devices in ${preset.rack.totalUnits} RU, ${preset.cables.length} internal cables.${nichtRack.length ? ` Counted as 1 RU because no height was set: ${nichtRack.join(', ')} (set_rack_units).` : ''}`,
        {
          presetId: preset.id,
          totalUnits: preset.rack.totalUnits,
          usedUnits: belegt,
          internalCables: preset.cables.length,
          placements: preset.rack.placements.map((p) => ({ device: geraete[p.itemIndex].name, startUnit: p.startUnit, heightUnits: p.heightUnits })),
        },
      )
    }

    case 'disconnect_cable': {
      const id = String(args.cableId ?? '')
      const kabel = project.cables.find((c) => c.id === id || c.cableNumber === id || c.name === id)
      if (!kabel) return nein(`No cable with id, number or name "${id}".`)
      aktionen.deleteCable(kabel.id)
      return ja(`Removed the cable "${kabel.cableNumber || kabel.name || kabel.id}". One undo step takes it back.`, { removed: kabel.id })
    }

    case 'set_cable': {
      const id = String(args.cableId ?? '')
      const kabel = project.cables.find((c) => c.id === id || c.cableNumber === id || c.name === id)
      if (!kabel) return nein(`No cable with id, number or name "${id}".`)
      const patch: Partial<Cable> = {}
      if (typeof args.name === 'string') patch.name = args.name
      if (typeof args.length === 'number') patch.length = args.length
      if (typeof args.notes === 'string') patch.notes = args.notes
      if (typeof args.color === 'string') patch.color = args.color
      if (typeof args.layer === 'string') patch.layer = args.layer
      if (Object.keys(patch).length === 0) {
        // Kein stiller Erfolg fuer einen Aufruf, der nichts tut: das Modell
        // haette sonst „erledigt" gemeldet und nichts geaendert.
        return nein('Nothing to change - pass at least one of name, length, notes, color, layer.')
      }
      aktionen.updateCable(kabel.id, patch)
      return ja(`Updated ${Object.keys(patch).join(', ')} on "${kabel.cableNumber || kabel.name || kabel.id}".`, {
        cableId: kabel.id,
        changed: Object.keys(patch),
      })
    }

    case 'rename_device': {
      const id = String(args.deviceId ?? '')
      const name = typeof args.name === 'string' ? args.name.trim() : ''
      const geraet = project.equipment.find((e) => e.id === id || e.name === id)
      if (!geraet) return nein(`No device with id or name "${id}".`)
      if (!name) return nein('A device needs a name - an empty one would hide it in every list.')
      aktionen.updateEquipment(geraet.id, { name })
      return ja(`Renamed "${geraet.name}" to "${name}".`, { deviceId: geraet.id, name })
    }

    case 'set_device': {
      const r = setzeGeraet(project, aktionen, args)
      if (!r.ok) return nein(r.fehler)
      return ja(`Updated ${r.changed.join(', ')} on "${r.name}".`, { deviceId: r.deviceId, changed: r.changed })
    }

    case 'set_devices': {
      const liste = Array.isArray(args.devices) ? (args.devices as Array<Record<string, unknown>>) : []
      if (liste.length === 0) return nein('Pass devices: a list of {deviceId, ...fields}.')
      if (liste.length > MCP_GERAETE_MAX) return nein(`At most ${MCP_GERAETE_MAX} devices per call; split the list.`)
      const results = liste.map((zeile, index) => {
        const r = setzeGeraet(project, aktionen, zeile ?? {})
        return r.ok ? { index, ok: true, deviceId: r.deviceId, changed: r.changed } : { index, ok: false, error: r.fehler }
      })
      const geaendert = results.filter((r) => r.ok).length
      const satz = `${geaendert} of ${liste.length} devices updated${geaendert < liste.length ? `, ${liste.length - geaendert} refused (see results)` : ''}.`
      const daten = { updated: geaendert, refused: liste.length - geaendert, results }
      return geaendert > 0 ? ja(satz, daten) : nein(satz, daten)
    }

    case 'create_location': {
      const name = typeof args.name === 'string' ? args.name.trim() : ''
      if (!name) return nein('A room needs a name.')
      if ((project.locations ?? []).some((l) => klein(l.name) === klein(name))) {
        return nein(`A room "${name}" already exists - a second one would make the name ambiguous. Use set_location or another name.`)
      }
      const etage = etageOderFehler(project, args.floor)
      if (typeof etage === 'string') return nein(etage)
      const m = masse(args)
      if (typeof m === 'string') return nein(m)
      const rechts = [
        ...project.equipment.map((e) => e.x + (e.width ?? GERAET_B)),
        ...(project.locations ?? []).map((l) => l.x + l.width),
      ]
      aktionen.addLocation({
        name,
        width: 600,
        height: 400,
        x: (rechts.length ? Math.max(...rechts) : 0) + 100,
        y: 100,
        ...m,
        ...(etage?.name ? { floor: etage.name } : {}),
        ...(typeof args.color === 'string' && args.color ? { color: args.color } : {}),
        ...(typeof args.notes === 'string' && args.notes ? { notes: args.notes } : {}),
      })
      const neu = aktionen.aktuell().locations?.at(-1)
      if (!neu || neu.name !== name) return nein('The planner did not add the room.')
      return ja(`Created room "${name}"${neu.floor ? ` on ${neu.floor}` : ''}.`, {
        locationId: neu.id,
        name: neu.name,
        floor: neu.floor ?? null,
        x: neu.x,
        y: neu.y,
        width: neu.width,
        height: neu.height,
      })
    }

    case 'set_location': {
      const raum = findeRaum(project, args.locationId)
      if (!raum.ok) return nein(raum.fehler)
      const l = raum.wert
      const patch: Partial<LocationFrame> = {}
      if (args.name !== undefined) {
        const n = typeof args.name === 'string' ? args.name.trim() : ''
        if (!n) return nein('A room needs a name.')
        if ((project.locations ?? []).some((o) => o.id !== l.id && klein(o.name) === klein(n))) return nein(`Another room is already called "${n}".`)
        patch.name = n
      }
      const etage = etageOderFehler(project, args.floor)
      if (typeof etage === 'string') return nein(etage)
      if (etage) patch.floor = etage.name || undefined
      const m = masse(args)
      if (typeof m === 'string') return nein(m)
      if (typeof args.color === 'string' && args.color) patch.color = args.color
      if (typeof args.notes === 'string') patch.notes = args.notes || undefined
      if (m.width !== undefined) patch.width = m.width
      if (m.height !== undefined) patch.height = m.height
      const dx = m.x !== undefined ? m.x - l.x : 0
      const dy = m.y !== undefined ? m.y - l.y : 0
      const geaendert = [...Object.keys(patch), ...(dx || dy ? ['position'] : [])]
      if (geaendert.length === 0) return nein('Nothing to change - pass at least one of name, floor, x, y, width, height, color, notes.')
      if (dx || dy) {
        // Dieselbe Semantik wie das Ziehen in der Oberflaeche: mit
        // `moveContents` zieht der Inhalt mit.
        if (l.moveContents !== false) {
          const drin = project.equipment.filter((e) => locationForEquipment(e, [l])).map((e) => e.id)
          aktionen.moveLocationWithContents(l.id, dx, dy, drin)
        } else {
          aktionen.updateLocation(l.id, { x: l.x + dx, y: l.y + dy })
        }
      }
      if (Object.keys(patch).length) aktionen.updateLocation(l.id, patch)
      return ja(`Updated ${geaendert.join(', ')} of room "${patch.name ?? l.name}".`, { locationId: l.id, changed: geaendert })
    }

    case 'delete_location': {
      const raum = findeRaum(project, args.locationId)
      if (!raum.ok) return nein(raum.fehler)
      aktionen.deleteLocation(raum.wert.id)
      return ja(`Removed the room frame "${raum.wert.name}"; its devices stay where they are. One undo step takes it back.`, {
        removed: raum.wert.id,
      })
    }

    case 'place_in_location': {
      const raum = findeRaum(project, args.locationId)
      if (!raum.ok) return nein(raum.fehler)
      const refs = Array.isArray(args.deviceIds) ? args.deviceIds : []
      if (refs.length === 0) return nein('Pass deviceIds: the devices to put into the room.')
      if (refs.length > MCP_GERAETE_MAX) return nein(`At most ${MCP_GERAETE_MAX} devices per call; split the list.`)
      const geraete: EquipmentItem[] = []
      for (const ref of refs) {
        const g = findeGeraet(project, ref)
        if (!g.ok) return nein(g.fehler)
        if (geraete.some((e) => e.id === g.wert.id)) return nein(`"${g.wert.name}" is listed twice.`)
        geraete.push(g.wert)
      }
      const { plaetze, hoehe, breite } = ordneImRaum(raum.wert, geraete)
      const gewachsen = hoehe !== raum.wert.height || breite !== raum.wert.width
      if (gewachsen) aktionen.updateLocation(raum.wert.id, { height: hoehe, width: breite })
      for (const p of plaetze) aktionen.updateEquipment(p.id, { x: p.x, y: p.y })
      return ja(`Placed ${geraete.length} devices in room "${raum.wert.name}"${gewachsen ? ' (the frame grew to fit them)' : ''}.`, {
        locationId: raum.wert.id,
        placed: geraete.map((e) => e.name),
        width: breite,
        height: hoehe,
      })
    }

    case 'create_floor': {
      const name = typeof args.name === 'string' ? args.name.trim() : ''
      if (!name) return nein('A floor needs a name.')
      if (findeEtage(project, name)) return nein(`A floor "${name}" already exists.`)
      const hoehe = args.elevationM === undefined ? undefined : zahl(args.elevationM)
      if (args.elevationM !== undefined && hoehe === undefined) return nein('elevationM must be a number (metres).')
      // Die Liste laeuft von unten nach oben: eine neue Etage kommt oben an.
      aktionen.setFloors([...(project.floors ?? []), { name, ...(hoehe !== undefined ? { elevationM: hoehe } : {}) }])
      return ja(`Created floor "${name}".`, { name, elevationM: hoehe ?? null })
    }

    case 'set_floor': {
      const etage = findeEtage(project, args.floor)
      if (!etage) {
        return nein(`No floor "${String(args.floor ?? '')}". Floors: ${(project.floors ?? []).map((f) => `"${f.name}"`).join(', ') || 'none'}.`)
      }
      const geaendert: string[] = []
      let name = etage.name
      if (args.name !== undefined) {
        const neu = typeof args.name === 'string' ? args.name.trim() : ''
        if (!neu) return nein('A floor needs a name.')
        const andere = findeEtage(project, neu)
        if (andere && andere !== etage) return nein(`A floor "${andere.name}" already exists - renaming would merge two floors.`)
        if (neu !== etage.name) {
          aktionen.renameFloor(etage.name, neu)
          name = neu
          geaendert.push('name')
        }
      }
      if (args.elevationM !== undefined) {
        const h = args.elevationM === null ? null : zahl(args.elevationM)
        if (h === undefined) return nein('elevationM must be a number (metres), or null to clear it.')
        const floors = (aktionen.aktuell().floors ?? []).map((f) => {
          if (f.name !== name) return f
          if (h === null) return { name: f.name }
          return { ...f, elevationM: h }
        })
        aktionen.setFloors(floors)
        geaendert.push('elevationM')
      }
      if (geaendert.length === 0) return nein('Nothing to change - pass name or elevationM.')
      return ja(`Updated ${geaendert.join(', ')} of floor "${name}".`, { name, changed: geaendert })
    }

    default:
      return nein(`Unknown write tool "${werkzeug}".`, { known: MCP_SCHREIBWERKZEUGE })
  }
}
