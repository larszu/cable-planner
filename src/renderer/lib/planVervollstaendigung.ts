// KI-Plan aus Dokumenten: den offenen Plan anhand gezogener Unterlagen
// (Blockschaltbild, IP-Liste, Stückliste, Grundriss, Strangschema) ergänzen.
//
// Das Modell bekommt den Plan in Kurzform und die Dokumente und antwortet mit
// Ergänzungen — neue Räume, Gerätetypen, Geräte, Angaben an bestehenden
// Geräten und Verbindungen. Diese Datei rechnet daraus einen Änderungssatz,
// den der Store in EINEM Schritt anwendet. Rein additiv: bestehende Werte
// werden nie überschrieben, ein Widerspruch wird zur Warnung. Verschoben
// werden nur Rahmen samt Inhalt, wenn ein gewachsener Raum sonst einen
// Nachbarn überdecken würde.

import { v4 as uuid } from 'uuid'
import { completeWithAI } from './aiSuggestions'
import { ALL_CONNECTOR_TYPES } from '../types/equipment'
import type { CablePlannerProject } from '../types/project'
import type { EquipmentItem, Port, ConnectorType } from '../types/equipment'
import type { Cable, CableType } from '../types/cable'
import type { LocationFrame } from '../types/location'
import type { PlanDokument } from './planDokumente'

// ─── Kontext ─────────────────────────────────────────────────────────────

/** Kurzzeichen eines bestehenden Geräts im Gespräch mit dem Modell. */
export const geraeteRef = (e: Pick<EquipmentItem, 'id'>): string => `@${e.id.slice(0, 8)}`

const mitte = (e: Pick<EquipmentItem, 'x' | 'y' | 'width' | 'height'>) => ({
  x: e.x + (e.width ?? 0) / 2,
  y: e.y + (e.height ?? 0) / 2,
})
const enthaelt = (l: LocationFrame, e: Pick<EquipmentItem, 'x' | 'y' | 'width' | 'height'>): boolean => {
  const c = mitte(e)
  return c.x >= l.x && c.x <= l.x + l.width && c.y >= l.y && c.y <= l.y + l.height
}
const raumVon = (e: EquipmentItem, locations: readonly LocationFrame[]) => locations.find((l) => enthaelt(l, e))

/** Der Plan als kompakter Text: Räume, Geräte mit Ports, Kabel. */
export const planKontext = (project: Pick<CablePlannerProject, 'equipment' | 'cables' | 'locations'>): string => {
  const locations = project.locations ?? []
  const byId = new Map(project.equipment.map((e) => [e.id, e]))
  const portName = (e: EquipmentItem | undefined, id: string) =>
    e ? [...e.inputs, ...e.outputs].find((p) => p.id === id)?.name ?? '?' : '?'
  const raeume = locations.map(
    (l) => `- ${l.name}${l.roomNumber && !l.name.includes(l.roomNumber) ? ` (${l.roomNumber})` : ''}${l.floor ? ` [${l.floor}]` : ''}`,
  )
  const geraete = project.equipment.map((e) =>
    [
      geraeteRef(e),
      e.name,
      e.category,
      raumVon(e, locations)?.name ?? '-',
      e.ipAddress ?? '-',
      e.serialNumber ?? '-',
      `in: ${e.inputs.map((p) => p.name).join(', ') || '-'}`,
      `out: ${e.outputs.map((p) => p.name).join(', ') || '-'}`,
    ].join(' | '),
  )
  const kabel = project.cables.map((c) => {
    const a = byId.get(c.fromEquipmentId)
    const b = byId.get(c.toEquipmentId)
    return `${a ? geraeteRef(a) : '?'} ${portName(a, c.fromPortId)} -> ${b ? geraeteRef(b) : '?'} ${portName(b, c.toPortId)}`
  })
  return [
    `ROOMS (${raeume.length}):`,
    ...raeume,
    '',
    `DEVICES (${geraete.length}) — ref | name | category | room | ip | serial | ports:`,
    ...geraete,
    '',
    `CABLES (${kabel.length}):`,
    ...kabel,
  ].join('\n')
}

// ─── Prompt ──────────────────────────────────────────────────────────────

export const PLAN_ERGAENZUNG_PROMPT = (kontext: string, dokumente: readonly PlanDokument[], hinweis: string): string => {
  const texte = dokumente
    .filter((d) => d.text)
    .map((d) => `--- DOCUMENT: ${d.name} ---\n${d.text}\n--- END ${d.name} ---`)
  const angehaengt = dokumente.filter((d) => d.dataUri).map((d) => d.name)
  return `You are an AV systems engineer completing a cable plan from project documentation.

CURRENT PLAN (the plan to complete — reference its devices only by their @ref):
${kontext}

DOCUMENTS:
${angehaengt.length ? `Attached as files (in this order): ${angehaengt.join(', ')}\n` : ''}${texte.join('\n\n')}
${hinweis.trim() ? `\nNOTE FROM THE PLANNER:\n${hinweis.trim()}\n` : ''}
TASK: Compare the documents with the current plan and return ONLY what is missing. Never repeat what the
plan already contains. Respond with ONLY valid JSON, no prose, in exactly this shape:

{
  "rooms": [{ "name": "Seminar room 1", "roomNumber": "1.049", "floor": "1st floor" }],
  "types": [{ "id": "t1", "name": "Blackmagic Micro Converter BiDirectional SDI/HDMI", "category": "Video",
              "inputs": [["HDMI In 1", "HDMI"], ["LAN", "Ethernet/RJ45"]], "outputs": [["HDMI Out", "HDMI"]] }],
  "devices": [{ "id": "d1", "type": "t1", "room": "Seminar room 1", "ip": "192.168.1.60",
                "serial": "ABC123", "subtitle": "receiver, wall", "notes": "hostname CONV-1", "src": "IP list.xlsx" }],
  "updates": [{ "ref": "@1a2b3c4d", "room": "Seminar room 1", "ip": "192.168.1.40", "serial": "X1", "notes": "multicast 224.0.2.0",
                "addInputs": [["HDMI In", "HDMI"]], "addOutputs": [], "src": "IP list.xlsx" }],
  "connections": [["d1", "HDMI Out", "@1a2b3c4d", "HDMI 1", "wall box 1.049-63", "Block diagram.pdf"]],
  "warnings": ["IP 192.168.1.44 appears twice in the IP list"]
}

Rules:
- "rooms": only rooms that do not exist yet. Use the document's room names; give roomNumber/floor when known.
- "types": one entry per device model, shared by all devices of that model. Ports as [name, connector];
  connector from this list only: ${ALL_CONNECTOR_TYPES.join(', ')}.
- "devices": new devices only. "room" must be an existing room name or one from "rooms".
- "updates": facts the documents add to EXISTING devices (empty fields, missing ports, room). "room" only
  when the device is not placed in a room yet.
- "connections": [from, fromPort, to, toPort, note, source document]. from/to are new device ids or
  existing @refs. Port names must exist on the device or be added in "types"/"updates". One cable per entry.
- Do not connect anything a document does not show or clearly imply; put assumptions in "warnings".
- Every device, update and connection names the document it came from in "src" / the sixth element.
- Keep names as the documents write them (manufacturer + model). Do not invent credentials.`
}

// ─── Antwort auswerten ──────────────────────────────────────────────────

interface RohTyp {
  id?: unknown
  name?: unknown
  category?: unknown
  inputs?: unknown
  outputs?: unknown
}
interface RohGeraet {
  id?: unknown
  type?: unknown
  name?: unknown
  room?: unknown
  ip?: unknown
  serial?: unknown
  subtitle?: unknown
  notes?: unknown
  src?: unknown
}
interface RohUpdate extends RohGeraet {
  ref?: unknown
  addInputs?: unknown
  addOutputs?: unknown
}
interface RohRaum {
  name?: unknown
  roomNumber?: unknown
  floor?: unknown
}

export interface GeraeteAenderung {
  equipmentId: string
  patch: Partial<Pick<EquipmentItem, 'ipAddress' | 'serialNumber' | 'subtitle' | 'notes' | 'specSource'>>
  inputs: Port[]
  outputs: Port[]
}

export interface PlanErgaenzung {
  neueRaeume: LocationFrame[]
  neueGeraete: EquipmentItem[]
  neueKabel: Cable[]
  geraeteAenderungen: GeraeteAenderung[]
  /** Neue Lage bestehender Rahmen (gewachsen oder nachgerückt). */
  raumGeometrie: Array<Pick<LocationFrame, 'id' | 'x' | 'y' | 'width' | 'height'>>
  /** Bestehende Geräte, die mit ihrem Rahmen nachrücken oder in einen Raum einziehen. */
  geraetePosition: Array<{ equipmentId: string; x: number; y: number }>
  warnungen: string[]
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')

const extractJson = (text: string): unknown => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end < start) throw new Error('The model did not return JSON.')
  return JSON.parse(body.slice(start, end + 1))
}

export const coerceConnector = (v: unknown): ConnectorType => {
  const s = str(v).toLowerCase()
  return ALL_CONNECTOR_TYPES.find((c) => c.toLowerCase() === s) ?? 'Custom'
}

/** Signalart aus der Steckform — dieselbe grobe Einteilung wie in den Bibliotheks-Ports. */
const signalAus = (c: ConnectorType, name: string): string => {
  if (/hdbt|hdbaset/i.test(name)) return 'HDBaseT'
  if (/dante|lan|ethernet|poe|network|netz/i.test(name) || c === 'Ethernet/RJ45' || c === 'SFP' || c === 'SFP+') return 'Ethernet'
  if (/hdmi/i.test(c)) return 'HDMI'
  if (/sdi|bnc/i.test(c)) return 'SDI'
  if (/rs-?232|com|serial/i.test(name) || c === 'DB9') return 'Serial'
  if (/relay|rel |ir\b|contact/i.test(name)) return 'Control'
  if (/230|power|ac in|dc|netz|iec|schuko|powercon/i.test(`${name} ${c}`)) return 'Power'
  if (/speak|lautspr/i.test(`${name} ${c}`)) return 'Speaker'
  if (/xlr|jack|klinke|phoenix|euroblock|terminal|cinch/i.test(c)) return 'Audio'
  return c
}

const portsAus = (v: unknown): Port[] =>
  (Array.isArray(v) ? v : []).flatMap((p) => {
    const [n, c] = Array.isArray(p) ? p : [(p as { name?: unknown })?.name, (p as { connector?: unknown })?.connector]
    const name = str(n)
    if (!name) return []
    const connectorType = coerceConnector(c)
    return [{ id: uuid(), name, originalName: name, connectorType, type: signalAus(connectorType, name) }]
  })

const gleicherRaum = (a: string, b: string): boolean => {
  const x = a.toLowerCase().trim()
  const y = b.toLowerCase().trim()
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `)
}

const LUECKE = 60
const RAUMABSTAND = 100

/**
 * Rechnet die Modellantwort in einen Änderungssatz um. `quelle` ist die
 * Herkunftsangabe für `specSource`, falls das Modell keine nennt.
 */
export const baueErgaenzung = (
  project: Pick<CablePlannerProject, 'equipment' | 'cables' | 'locations'>,
  roh: unknown,
  quelle: string,
): PlanErgaenzung => {
  const r = (roh ?? {}) as Record<string, unknown>
  const warnungen = (Array.isArray(r.warnings) ? r.warnings : []).map(str).filter(Boolean)
  const herkunft = (src: unknown) => `KI aus Dokumenten — ${str(src) || quelle}`

  // Arbeitskopien der Rahmen: sie wachsen und rücken nach.
  const raeume = (project.locations ?? []).map((l) => ({ ...l }))
  const altRaeume = new Set(raeume.map((l) => l.id))
  const neueRaeume: LocationFrame[] = []
  const inhalt = new Map<string, Array<Pick<EquipmentItem, 'x' | 'y' | 'width' | 'height'> & { id: string }>>()
  for (const e of project.equipment) {
    const l = raumVon(e, raeume)
    if (l) inhalt.set(l.id, [...(inhalt.get(l.id) ?? []), { id: e.id, x: e.x, y: e.y, width: e.width, height: e.height }])
  }
  const findeRaum = (name: string) =>
    name ? raeume.find((l) => gleicherRaum(l.name, name) || (l.roomNumber && l.roomNumber === name)) : undefined

  // Rahmen für neue Räume rechts neben allem Bestehenden, untereinander.
  const rechts = Math.max(0, ...project.equipment.map((e) => e.x + e.width), ...raeume.map((l) => l.x + l.width)) + 400
  let neuY = Math.min(0, ...raeume.map((l) => l.y))
  for (const rr of (Array.isArray(r.rooms) ? r.rooms : []) as RohRaum[]) {
    const name = str(rr.name)
    if (!name || findeRaum(name)) continue
    const l: LocationFrame = {
      id: uuid(),
      name,
      x: rechts,
      y: neuY,
      width: 1400,
      height: 300,
      color: '#38bdf8',
      moveContents: true,
      ...(str(rr.roomNumber) ? { roomNumber: str(rr.roomNumber) } : {}),
      ...(str(rr.floor) ? { floor: str(rr.floor) } : {}),
    }
    neuY += l.height + RAUMABSTAND
    raeume.push(l)
    neueRaeume.push(l)
  }

  // Typen und neue Geräte.
  const typen = new Map<string, RohTyp>()
  for (const t of (Array.isArray(r.types) ? r.types : []) as RohTyp[]) if (str(t.id)) typen.set(str(t.id), t)
  const neueGeraete: EquipmentItem[] = []
  const neuNachKey = new Map<string, EquipmentItem>()
  const zuPlatzieren = new Map<string, EquipmentItem[]>() // Raum-ID ('' = ohne Raum) -> Geräte
  const platziere = (raumId: string, e: EquipmentItem) => zuPlatzieren.set(raumId, [...(zuPlatzieren.get(raumId) ?? []), e])
  for (const g of (Array.isArray(r.devices) ? r.devices : []) as RohGeraet[]) {
    const key = str(g.id)
    const typ = typen.get(str(g.type))
    const name = str(g.name) || str(typ?.name)
    if (!key || !name) {
      warnungen.push(`Device without id or name skipped (${key || name || '?'}).`)
      continue
    }
    const inputs = portsAus(typ?.inputs)
    const outputs = portsAus(typ?.outputs)
    const src = herkunft(g.src)
    const e: EquipmentItem = {
      id: uuid(),
      name,
      category: str(typ?.category) || 'Other',
      inputs,
      outputs,
      x: 0,
      y: 0,
      width: 400,
      height: 55 + 22 * Math.max(1, inputs.length, outputs.length),
      ...(str(g.ip) ? { ipAddress: str(g.ip) } : {}),
      ...(str(g.serial) ? { serialNumber: str(g.serial) } : {}),
      ...(str(g.subtitle) ? { subtitle: str(g.subtitle) } : {}),
      notes: str(g.notes),
      // Wie bei der Plangenerierung aus Text (#650/E-1): erkennbar als von
      // einem Modell abgeleitet, damit Prüfung 18 nicht schweigt.
      specSource: {
        ...(inputs.length ? { inputs: { value: `${inputs.length} In`, source: src } } : {}),
        ...(outputs.length ? { outputs: { value: `${outputs.length} Out`, source: src } } : {}),
        ...(str(g.ip) ? { ipAddress: { value: str(g.ip), source: src } } : {}),
      },
    }
    neueGeraete.push(e)
    neuNachKey.set(key, e)
    const raum = findeRaum(str(g.room))
    if (str(g.room) && !raum) warnungen.push(`${name}: room "${str(g.room)}" not found — placed outside rooms.`)
    platziere(raum?.id ?? '', e)
  }

  // Angaben an bestehenden Geräten.
  const nachRef = new Map(project.equipment.map((e) => [geraeteRef(e), e]))
  const aenderungen = new Map<string, GeraeteAenderung>()
  // Kopien bestehender Geräte, die in einen Raum einziehen -> Original-ID
  const umzug = new Map<EquipmentItem, string>()
  const aenderung = (e: EquipmentItem): GeraeteAenderung => {
    let a = aenderungen.get(e.id)
    if (!a) aenderungen.set(e.id, (a = { equipmentId: e.id, patch: {}, inputs: [], outputs: [] }))
    return a
  }
  for (const u of (Array.isArray(r.updates) ? r.updates : []) as RohUpdate[]) {
    const e = nachRef.get(str(u.ref))
    if (!e) {
      warnungen.push(`Update for unknown device ${str(u.ref) || '?'} skipped.`)
      continue
    }
    const a = aenderung(e)
    const src = herkunft(u.src)
    const feld = (key: 'ipAddress' | 'serialNumber' | 'subtitle', wert: string) => {
      if (!wert) return
      const alt = e[key]
      if (!alt) {
        a.patch[key] = wert
        if (key === 'ipAddress') a.patch.specSource = { ...e.specSource, ...a.patch.specSource, ipAddress: { value: wert, source: src } }
      } else if (alt !== wert) warnungen.push(`${e.name} (${geraeteRef(e)}): ${key} is ${alt} in the plan, ${wert} in the documents — kept ${alt}.`)
    }
    feld('ipAddress', str(u.ip))
    feld('serialNumber', str(u.serial))
    feld('subtitle', str(u.subtitle))
    const notiz = str(u.notes)
    if (notiz && !(e.notes ?? '').includes(notiz)) a.patch.notes = [e.notes, notiz].filter(Boolean).join(' · ')
    const vorhanden = new Set([...e.inputs, ...e.outputs].map((p) => p.name.toLowerCase()))
    a.inputs.push(...portsAus(u.addInputs).filter((p) => !vorhanden.has(p.name.toLowerCase())))
    a.outputs.push(...portsAus(u.addOutputs).filter((p) => !vorhanden.has(p.name.toLowerCase())))
    const raum = findeRaum(str(u.room))
    if (raum && !raumVon(e, raeume)) {
      const kopie = { ...e }
      platziere(raum.id, kopie)
      umzug.set(kopie, e.id)
    }
  }

  // Verbindungen.
  const neueKabel: Cable[] = []
  const ende = (ref: string): EquipmentItem | undefined => neuNachKey.get(ref) ?? nachRef.get(ref)
  const portVon = (e: EquipmentItem, name: string, seite: 'inputs' | 'outputs'): Port | undefined => {
    const a = aenderungen.get(e.id)
    const alle = [...e[seite], ...(a?.[seite] ?? []), ...e.inputs, ...e.outputs, ...(a ? [...a.inputs, ...a.outputs] : [])]
    const n = name.toLowerCase()
    return alle.find((p) => p.name.toLowerCase() === n) ?? alle.find((p) => p.name.toLowerCase().startsWith(n))
  }
  const istNeu = (e: EquipmentItem) => neueGeraete.includes(e)
  const legePortAn = (e: EquipmentItem, name: string, seite: 'inputs' | 'outputs', connector: ConnectorType): Port => {
    const p: Port = { id: uuid(), name, originalName: name, connectorType: connector, type: signalAus(connector, name) }
    if (istNeu(e)) {
      e[seite].push(p)
      e.height = 55 + 22 * Math.max(e.inputs.length, e.outputs.length)
    } else aenderung(e)[seite].push(p)
    return p
  }
  for (const c of Array.isArray(r.connections) ? r.connections : []) {
    const [vonRef, vonPort, nachRefStr, nachPort, notiz, src] = (Array.isArray(c) ? c : []).map(str)
    const a = ende(vonRef)
    const b = ende(nachRefStr)
    if (!a || !b) {
      warnungen.push(`Connection ${vonRef || '?'} → ${nachRefStr || '?'} skipped (device unknown).`)
      continue
    }
    const pa = portVon(a, vonPort || 'Out', 'outputs')
    const pb = portVon(b, nachPort || 'In', 'inputs')
    const fa = pa ?? legePortAn(a, vonPort || 'Out', 'outputs', pb?.connectorType ?? 'Custom')
    const fb = pb ?? legePortAn(b, nachPort || 'In', 'inputs', fa.connectorType)
    const belegt = [...project.cables, ...neueKabel].some(
      (k) => (k.fromPortId === fa.id && k.toPortId === fb.id) || (k.fromPortId === fb.id && k.toPortId === fa.id),
    )
    if (belegt) continue
    const typ: CableType =
      fa.connectorType === 'DIN' || fa.connectorType === 'DisplayPort' || fa.connectorType === 'USB'
        ? 'Custom'
        : (fa.connectorType as CableType)
    const adapter = fa.connectorType !== fb.connectorType && fa.connectorType !== 'Custom' && fb.connectorType !== 'Custom'
    neueKabel.push({
      id: uuid(),
      name: `${a.name} → ${b.name}`,
      type: typ,
      color: '#64748b',
      fromEquipmentId: a.id,
      fromPortId: fa.id,
      toEquipmentId: b.id,
      toPortId: fb.id,
      notes: [notiz, adapter ? `${fa.connectorType} → ${fb.connectorType}` : ''].filter(Boolean).join(' · '),
      ...(adapter ? { needsConverter: true } : {}),
      routing: 'orthogonal',
      arrowEnd: true,
      specSource: { connection: { value: `${a.name} ${fa.name} → ${b.name} ${fb.name}`, source: herkunft(src) } },
    })
  }

  // Einräumen: neue Geräte unter den Bestand des Raums, Rahmen wächst mit.
  for (const [raumId, geraete] of zuPlatzieren) {
    const l = raeume.find((x) => x.id === raumId)
    if (!l) {
      const unten = Math.max(0, ...project.equipment.map((e) => e.y + e.height), ...raeume.map((x) => x.y + x.height))
      geraete.forEach((e, i) => {
        e.x = rechts + (i % 4) * (e.width + LUECKE)
        e.y = unten + RAUMABSTAND + Math.floor(i / 4) * 400
      })
      continue
    }
    const bestand = inhalt.get(l.id) ?? []
    let y = bestand.length ? Math.max(...bestand.map((e) => e.y + e.height)) + LUECKE : l.y + 90
    const breite = Math.max(l.width, ...geraete.map((e) => e.width + 2 * LUECKE))
    let x = l.x + LUECKE
    let zeile = 0
    for (const e of geraete) {
      if (x + e.width > l.x + breite - LUECKE && x > l.x + LUECKE) {
        x = l.x + LUECKE
        y += zeile + LUECKE
        zeile = 0
      }
      e.x = x
      e.y = y
      x += e.width + LUECKE
      zeile = Math.max(zeile, e.height)
    }
    l.width = breite
    l.height = Math.max(l.height, y + zeile + LUECKE - l.y)
    inhalt.set(l.id, [...bestand, ...geraete])
  }

  // Gewachsene Rahmen schieben die darunter liegenden mit Inhalt nach unten.
  const ueberX = (a: LocationFrame, b: LocationFrame) => a.x < b.x + b.width + RAUMABSTAND && b.x < a.x + a.width + RAUMABSTAND
  const gesetzt: LocationFrame[] = []
  const versatz = new Map<string, number>()
  for (const l of [...raeume].sort((a, b) => a.y - b.y || a.x - b.x)) {
    let dy = 0
    for (;;) {
      const hit = gesetzt.find((p) => ueberX(p, l) && l.y + dy < p.y + p.height + RAUMABSTAND && p.y < l.y + dy + l.height + RAUMABSTAND)
      if (!hit) break
      dy = hit.y + hit.height + RAUMABSTAND - l.y
    }
    if (dy > 0) {
      l.y += dy
      versatz.set(l.id, dy)
      for (const e of inhalt.get(l.id) ?? []) e.y += dy
    }
    gesetzt.push(l)
  }

  // Bestehende Geräte: Umzug in einen Raum oder Nachrücken mit dem Rahmen.
  const posListe = new Map<string, { x: number; y: number }>()
  for (const [kopie, id] of umzug) posListe.set(id, { x: kopie.x, y: kopie.y })
  const bestandIds = new Set(project.equipment.map((e) => e.id))
  for (const raumId of versatz.keys()) {
    for (const e of inhalt.get(raumId) ?? []) if (bestandIds.has(e.id)) posListe.set(e.id, { x: e.x, y: e.y })
  }
  const geraetePosition = [...posListe].map(([equipmentId, p]) => ({ equipmentId, ...p }))

  const raumGeometrie = raeume
    .filter((l) => altRaeume.has(l.id))
    .filter((l) => {
      const alt = project.locations?.find((x) => x.id === l.id)
      return alt && (alt.x !== l.x || alt.y !== l.y || alt.width !== l.width || alt.height !== l.height)
    })
    .map(({ id, x, y, width, height }) => ({ id, x, y, width, height }))

  return {
    neueRaeume: neueRaeume.map((n) => raeume.find((l) => l.id === n.id) ?? n),
    neueGeraete,
    neueKabel,
    geraeteAenderungen: [...aenderungen.values()].filter(
      (a) => Object.keys(a.patch).length + a.inputs.length + a.outputs.length > 0,
    ),
    raumGeometrie,
    geraetePosition,
    warnungen,
  }
}

// ─── Aufruf ──────────────────────────────────────────────────────────────

/** Obergrenze der Antwort: ein ganzes Haus sind schnell einige hundert Geräte und Kabel. */
const MAX_ANTWORT_TOKEN = 64000

export const vervollstaendigePlan = async (
  project: Pick<CablePlannerProject, 'equipment' | 'cables' | 'locations'>,
  dokumente: readonly PlanDokument[],
  hinweis = '',
): Promise<PlanErgaenzung> => {
  const anhaenge = dokumente.flatMap((d) => (d.dataUri ? [d.dataUri] : []))
  const text = await completeWithAI(PLAN_ERGAENZUNG_PROMPT(planKontext(project), dokumente, hinweis), anhaenge, {
    maxTokens: MAX_ANTWORT_TOKEN,
  })
  return baueErgaenzung(project, extractJson(text), dokumente.map((d) => d.name).join(', ') || 'Beschreibung')
}
