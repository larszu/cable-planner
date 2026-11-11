// #1206 — GDTF-Typen auf Vorlagen der Bibliothek abbilden und eine MVR-Szene
// in Geraete fuer den Plan uebersetzen.
//
// Reihenfolge der Zuordnung: gleiche Typ-Id (FixtureTypeID), dann gleicher
// Name (mit oder ohne Hersteller), sonst eine neue Vorlage aus der GDTF-Datei.
// Ohne eingebettete GDTF-Datei bleibt nur der Name aus dem `GDTFSpec`.

import { v4 as uuidv4 } from 'uuid'
import type { ConnectorType, EquipmentItem, EquipmentTemplate, Port } from '../../types/equipment'
import type { DmxProfil } from '../dmx/types'
import type { GdtfAnschluss, GdtfTyp } from './gdtf'
import { parseGdtf } from './gdtf'
import { gdtfZuSpec, type MvrArt, type MvrObjekt, type MvrSzene } from './mvr'

export const LICHT_KATEGORIE = 'Lighting'

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

// GDTF Anhang D → Steckernamen dieses Planers. Unbekannte Namen bleiben wie
// in der Datei: ein eigener Stecker ist ehrlicher als ein falsch geratener.
const STECKER: Array<[RegExp, ConnectorType]> = [
  [/^powercon ?true ?1|^powercontrue1/i, 'powerCON TRUE1'],
  [/^nac3fc[ab]$|^powercon/i, 'PowerCON'],
  [/^ethercon/i, 'etherCON'],
  [/^rj45$/i, 'Ethernet/RJ45'],
  [/^rj11$/i, 'RJ11'],
  [/^iec 60320-c1[34]/i, 'IEC 230V'],
  [/^iec 60320-c[78]/i, 'C7 Eurostecker'],
  [/^cee 7\/7|^schuko/i, 'Schuko 230V'],
  [/^16a-cee/i, 'CEE16'],
  [/^32a-cee/i, 'CEE32'],
  [/^63a-cee/i, 'CEE63'],
  [/^powerlock/i, 'Powerlock'],
  [/^socapex/i, 'Socapex'],
  [/^han-/i, 'Harting'],
  [/^edison$/i, 'NEMA 5-15 (Edison)'],
  [/^l6-20$/i, 'NEMA L6-20'],
  [/^camlock/i, 'Cam-Lok'],
  [/^nl4$|^speakon/i, 'speakON 4 Pole'],
  [/^bnc$/i, 'BNC'],
  [/^hdmi$/i, 'HDMI'],
  [/^dvi$/i, 'DVI'],
  [/^displayport$/i, 'DisplayPort'],
  [/^usb$/i, 'USB'],
  [/^db9$/i, 'DB9'],
  [/^(db15|hd15)$/i, 'DB15'],
  [/^db25$/i, 'DB25'],
  [/^db37$/i, 'DB37'],
  [/^rca$/i, 'Cinch/RCA'],
  [/^svideo$/i, 'S-Video'],
  [/^din5$/i, 'DIN 5-pol'],
  [/^mdin4$/i, 'Mini-DIN 4'],
  [/^lcdup$/i, 'Fiber Optic LC'],
  [/^sc(dup)?$/i, 'Fiber Optic SC'],
  [/^st$/i, 'Fiber Optic ST'],
  [/^opticalcon/i, 'opticalCON DUO'],
]

const istDmx = (a: GdtfAnschluss): boolean =>
  /dmx/i.test(a.signal ?? '') || /dmx/i.test(a.name)

const istStrom = (a: GdtfAnschluss, stecker: ConnectorType): boolean =>
  /power/i.test(a.signal ?? '') ||
  ['PowerCON', 'powerCON TRUE1', 'IEC 230V', 'C7 Eurostecker', 'Schuko 230V', 'CEE16', 'CEE32', 'CEE63', 'Powerlock', 'Socapex', 'Harting', 'NEMA 5-15 (Edison)', 'NEMA L6-20', 'Cam-Lok'].includes(stecker)

export const steckerAusGdtf = (a: GdtfAnschluss): ConnectorType => {
  const t = a.connectorType.trim()
  // XLR5 ist an Lichtgeraeten praktisch immer DMX.
  if (/^xlr5$/i.test(t)) return 'DMX 5-pol (XLR)'
  if (/^xlr3$/i.test(t)) return istDmx(a) ? 'DMX 3-pol (XLR)' : 'XLR'
  if (/^xlr4$/i.test(t)) return 'XLR 4 Female'
  for (const [re, ziel] of STECKER) if (re.test(t)) return ziel
  return t as ConnectorType
}

const portAus = (a: GdtfAnschluss, richtung?: Port['direction']): Port => {
  const stecker = steckerAusGdtf(a)
  const typ = istStrom(a, stecker) ? 'Power' : istDmx(a) || stecker.startsWith('DMX') ? 'DMX' : /ethernet|etherCON|RJ45/i.test(stecker) ? 'Ethernet' : stecker
  return { id: uuidv4(), name: a.name, originalName: a.name, type: typ, connectorType: stecker, ...(richtung ? { direction: richtung } : {}) }
}

/** Der Anzeigename: Hersteller vorn, ausser der Typname traegt ihn schon. */
export const vorlagenName = (typ: Pick<GdtfTyp, 'manufacturer' | 'name' | 'longName'>): string => {
  const name = typ.longName && typ.longName.length > typ.name.length ? typ.longName : typ.name
  if (!typ.manufacturer || norm(name).startsWith(norm(typ.manufacturer))) return name
  return `${typ.manufacturer} ${name}`
}

export const modusId = (name: string): string => `gdtf:${name}`

export const dmxProfilAus = (typ: GdtfTyp, beleg: string): DmxProfil => ({
  hersteller: typ.manufacturer,
  modell: typ.name,
  modi: typ.modi.map((m) => ({
    id: modusId(m.name),
    name: m.name,
    kanaele: m.kanaele,
    herkunft: 'gdtf' as const,
    beleg: m.weitereBreaks.length ? `${beleg} (+ Break: ${m.weitereBreaks.join(', ')} ch)` : beleg,
  })),
})

/** Eine Bibliotheks-Vorlage aus einer GDTF-Datei. */
export const vorlageAusGdtf = (typ: GdtfTyp, dateiname: string): EquipmentTemplate => {
  const inputs: Port[] = []
  const outputs: Port[] = []
  for (const a of typ.anschluesse) {
    if (a.rolle === 'out') outputs.push(portAus(a))
    else if (a.rolle === 'inout') inputs.push(portAus(a, 'bidirectional'))
    else inputs.push(portAus(a))
  }
  // Nennt die Datei keine Anschluesse (GDTF 1.0/1.1 oft), hat ein Geraet mit
  // DMX-Modi trotzdem einen DMX-Eingang; 5-polig ist die Norm (ANSI E1.11).
  const angenommen = typ.anschluesse.length === 0 && typ.modi.length > 0
  if (angenommen) {
    inputs.push({ id: uuidv4(), name: 'DMX In', originalName: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' })
    outputs.push({ id: uuidv4(), name: 'DMX Thru', originalName: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' })
  }
  const notiz = [
    typ.description,
    `GDTF: ${dateiname}`,
    angenommen ? 'Connectors not listed in the GDTF file — DMX in/thru assumed, power connector missing.' : undefined,
  ].filter(Boolean).join('\n')
  return {
    name: vorlagenName(typ),
    category: LICHT_KATEGORIE,
    ...(typ.shortName ? { shortName: typ.shortName } : {}),
    ...(typ.fixtureTypeId ? { deviceTypeId: typ.fixtureTypeId } : {}),
    ...(typ.powerW ? { powerWatts: typ.powerW } : {}),
    ...(typ.weightKg ? { weightKg: typ.weightKg } : {}),
    ...(typ.modi.length ? { dmxProfil: dmxProfilAus(typ, dateiname) } : {}),
    notes: notiz,
    width: 200,
    height: 140,
    inputs,
    outputs,
  }
}

/** `Hersteller@Typ@Kommentar.gdtf` → Hersteller und Typ (Namensregel der Norm). */
export const ausSpecName = (spec: string): { manufacturer: string; name: string } => {
  const ohne = spec.replace(/\.gdtf$/i, '')
  const teile = ohne.split('@')
  return teile.length >= 2 ? { manufacturer: teile[0], name: teile[1] } : { manufacturer: '', name: ohne }
}

/** Eine vorhandene Vorlage fuer diesen Typ — oder undefined. */
export const findeVorlage = (
  typ: { manufacturer: string; name: string; longName?: string; fixtureTypeId?: string },
  bibliothek: readonly EquipmentTemplate[],
): EquipmentTemplate | undefined => {
  if (typ.fixtureTypeId) {
    const id = typ.fixtureTypeId.toLowerCase()
    const treffer = bibliothek.find((t) => t.deviceTypeId?.toLowerCase() === id)
    if (treffer) return treffer
  }
  const namen = new Set(
    [vorlagenName(typ), typ.name, typ.longName ?? '', `${typ.manufacturer} ${typ.name}`]
      .map(norm)
      .filter((n) => n.length >= 4),
  )
  const nachName = bibliothek.find((t) => namen.has(norm(t.name)))
  if (nachName) return nachName
  const m = norm(typ.manufacturer)
  const n = norm(typ.name)
  return bibliothek.find(
    (t) => !!t.dmxProfil && norm(t.dmxProfil.modell) === n && (!m || norm(t.dmxProfil.hersteller) === m),
  )
}

export interface MvrTypZeile {
  /** `GDTFSpec` wie in der Szene; leer fuer Objekte ohne Typ. */
  spec: string
  anzahl: number
  gdtf?: GdtfTyp
  /** Gefundene Vorlage der Bibliothek. */
  vorhanden?: EquipmentTemplate
  /** Neue Vorlage, falls keine passt. */
  neu: EquipmentTemplate
  fehler?: string
}

/** Objekte, die als Geraete in den Kabelplan gehoeren. Truss und Deko nicht. */
export const KABEL_ARTEN: readonly MvrArt[] = ['Fixture', 'VideoScreen', 'Projector', 'Support']

export const mvrTypen = (szene: MvrSzene, bibliothek: readonly EquipmentTemplate[]): MvrTypZeile[] => {
  const zaehler = new Map<string, number>()
  for (const o of szene.objekte) {
    if (!KABEL_ARTEN.includes(o.art)) continue
    const spec = o.gdtfSpec ?? ''
    zaehler.set(spec, (zaehler.get(spec) ?? 0) + 1)
  }
  return [...zaehler].map(([spec, anzahl]) => {
    const bytes = spec ? gdtfZuSpec(szene, spec) : undefined
    let gdtf: GdtfTyp | undefined
    let fehler: string | undefined
    if (bytes) {
      try {
        gdtf = parseGdtf(bytes)
      } catch (e) {
        fehler = e instanceof Error ? e.message : String(e)
      }
    }
    const ausName = ausSpecName(spec || 'Fixture')
    const kennung = gdtf ?? { ...ausName, modi: [], anschluesse: [] }
    const vorhanden = findeVorlage(kennung, bibliothek)
    const neu: EquipmentTemplate = gdtf
      ? vorlageAusGdtf(gdtf, spec)
      : {
          name: vorlagenName(ausName),
          category: LICHT_KATEGORIE,
          notes: spec ? `GDTF: ${spec} (not embedded in the MVR file)` : 'MVR object without GDTF type',
          width: 200,
          height: 140,
          inputs: [],
          outputs: [],
          portsUnknown: true,
        }
    return { spec, anzahl, ...(gdtf ? { gdtf } : {}), ...(vorhanden ? { vorhanden } : {}), neu, ...(fehler ? { fehler } : {}) }
  })
}

export interface MvrPlatzierung {
  /** Canvas-Pixel je Meter. */
  pxProMeter: number
  /** Canvas-Punkt, auf den die linke obere Ecke der Szene faellt. */
  ursprung: { x: number; y: number }
}

const neuePorts = (ports: Port[]): Port[] => ports.map((p) => ({ ...p, id: uuidv4() }))

/**
 * Geraete fuer den Plan. Draufsicht: MVR-X nach rechts, MVR-Y nach oben —
 * auf dem Canvas waechst y nach unten, also gespiegelt.
 */
export const mvrGeraete = (
  szene: MvrSzene,
  wahl: ReadonlyMap<string, EquipmentTemplate>,
  platz: MvrPlatzierung,
): EquipmentItem[] => {
  const objekte = szene.objekte.filter((o) => KABEL_ARTEN.includes(o.art))
  if (objekte.length === 0) return []
  const minX = Math.min(...objekte.map((o) => o.x))
  const maxY = Math.max(...objekte.map((o) => o.y))
  const s = platz.pxProMeter / 1000
  const out: EquipmentItem[] = []
  for (const o of objekte) {
    const vorlage = wahl.get(o.gdtfSpec ?? '')
    if (!vorlage) continue
    out.push(geraetAus(o, vorlage, {
      x: Math.round(platz.ursprung.x + (o.x - minX) * s),
      y: Math.round(platz.ursprung.y + (maxY - o.y) * s),
    }))
  }
  return out
}

const geraetAus = (o: MvrObjekt, vorlage: EquipmentTemplate, pos: { x: number; y: number }): EquipmentItem => {
  const modus = o.gdtfMode
    ? vorlage.dmxProfil?.modi.find((m) => m.id === modusId(o.gdtfMode!) || m.name.toLowerCase() === o.gdtfMode!.toLowerCase())
    : undefined
  const anzeige = o.name || vorlage.name
  return {
    ...vorlage,
    id: uuidv4(),
    name: anzeige,
    ...(o.fixtureId ? { subtitle: `#${o.fixtureId}` } : {}),
    x: pos.x,
    y: pos.y,
    inputs: neuePorts(vorlage.inputs),
    outputs: neuePorts(vorlage.outputs),
    ...(modus ? { dmxModusId: modus.id } : {}),
    // Die Adresse kommt aus dem Lichtplan — die Automatik darf sie nicht verschieben.
    ...(o.universe && o.adresse ? { dmxUniverse: o.universe, dmxAdresse: o.adresse, dmxAdresseFestgesetzt: true } : {}),
  }
}
