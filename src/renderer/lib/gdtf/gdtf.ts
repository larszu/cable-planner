// #1206 — GDTF-Geraetebeschreibung lesen (DIN SPEC 15800, GDTF 1.0–1.2).
//
// Gelesen wird nur, was ein Kabelplan braucht: Name, Hersteller, Typ-Id, die
// DMX-Modi mit ihrem Fussabdruck, Gewicht, Leistung und die Anschluesse. Was
// Kanal 7 tut, ist Sache des Pults (siehe `lib/dmx/types.ts`).
//
// Quelle: github.com/mvrdevelopment/spec, gdtf-spec.md (GDTF 1.2).

import { alleKinder, alsText, attr, datei, entpacke, kind, kinder, parseXml, zahl, type XmlKnoten } from './xml'

export interface GdtfModus {
  name: string
  /** Fussabdruck im ersten DMX-Break — die Zahl, die das Universe belegt. */
  kanaele: number
  /** Fussabdruck je weiterem Break (Mehrzellen-Geraete mit zweitem Eingang). */
  weitereBreaks: number[]
}

/** Ein Anschluss, wie die Datei ihn nennt (`ConnectorType` aus Anhang D). */
export interface GdtfAnschluss {
  name: string
  connectorType: string
  /** GDTF 1.2 `ComponentType`; bei Altdateien aus dem Namen erraten. */
  rolle: 'in' | 'out' | 'inout'
  signal?: string
}

export interface GdtfTyp {
  name: string
  shortName?: string
  longName?: string
  manufacturer: string
  description?: string
  fixtureTypeId?: string
  modi: GdtfModus[]
  weightKg?: number
  powerW?: number
  anschluesse: GdtfAnschluss[]
  thumbnailPng?: Uint8Array
}

const offsets = (s: string | undefined): number[] => {
  if (!s || s.trim() === '' || s.trim().toLowerCase() === 'none') return []
  return s
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
}

interface Referenz {
  geometrie: string
  breaks: Array<{ dmxOffset: number; dmxBreak: number }>
}

interface GeometrieIndex {
  /** Name → Namen aller Geometrien darunter (inkl. sich selbst). */
  unterbaum: Map<string, Set<string>>
  referenzen: Referenz[]
  wiring: XmlKnoten[]
  /** Summe der `Beam@PowerConsumption`, wo sie gesetzt ist (Lampenleistung). */
  beamWatt: number
}

const indexiere = (geometries: XmlKnoten | undefined): GeometrieIndex => {
  const idx: GeometrieIndex = { unterbaum: new Map(), referenzen: [], wiring: [], beamWatt: 0 }
  const besuche = (tag: string, k: XmlKnoten, vorfahren: string[]) => {
    const name = attr(k, 'Name')
    if (tag === 'GeometryReference') {
      const ziel = attr(k, 'Geometry')
      if (ziel) {
        idx.referenzen.push({
          geometrie: ziel,
          breaks: kinder(k, 'Break').map((b) => ({
            dmxOffset: zahl(attr(b, 'DMXOffset')) ?? 1,
            dmxBreak: zahl(attr(b, 'DMXBreak')) ?? 1,
          })),
        })
      }
    }
    if (tag === 'WiringObject') idx.wiring.push(k)
    if (tag === 'Beam') idx.beamWatt += zahl(attr(k, 'PowerConsumption')) ?? 0
    const kette = name ? [...vorfahren, name] : vorfahren
    for (const n of kette) {
      let s = idx.unterbaum.get(n)
      if (!s) idx.unterbaum.set(n, (s = new Set()))
      if (name) s.add(name)
    }
    for (const [t, c] of alleKinder(k)) besuche(t, c, kette)
  }
  if (geometries) for (const [t, c] of alleKinder(geometries)) besuche(t, c, [])
  return idx
}

/**
 * Fussabdruck eines Modus. `DMXMode` traegt keine Kanalzahl; sie ist die
 * hoechste belegte Adresse. Kanaele einer Geometrie, die per
 * `GeometryReference` mehrfach eingesetzt wird (Pixel-Zellen), gelten einmal je
 * Referenz, versetzt um deren `Break@DMXOffset`.
 */
const fussabdruck = (modus: XmlKnoten, idx: GeometrieIndex): Map<number, number> => {
  const jeBreak = new Map<number, number>()
  const merke = (br: number, adr: number) => jeBreak.set(br, Math.max(jeBreak.get(br) ?? 0, adr))
  for (const kanal of kinder(kind(modus, 'DMXChannels'), 'DMXChannel')) {
    const offs = offsets(attr(kanal, 'Offset'))
    if (offs.length === 0) continue
    const geo = attr(kanal, 'Geometry')
    const brAttr = attr(kanal, 'DMXBreak') ?? '1'
    const refs = geo ? idx.referenzen.filter((r) => idx.unterbaum.get(r.geometrie)?.has(geo)) : []
    if (refs.length === 0) {
      merke(zahl(brAttr) ?? 1, Math.max(...offs))
      continue
    }
    for (const r of refs) {
      const passend =
        brAttr.toLowerCase() === 'overwrite'
          ? r.breaks.slice(-1)
          : r.breaks.filter((b) => b.dmxBreak === (zahl(brAttr) ?? 1))
      for (const b of passend.length ? passend : [{ dmxOffset: 1, dmxBreak: zahl(brAttr) ?? 1 }]) {
        merke(b.dmxBreak, Math.max(...offs) + b.dmxOffset - 1)
      }
    }
  }
  return jeBreak
}

const ROLLE: Record<string, GdtfAnschluss['rolle']> = {
  input: 'in',
  consumer: 'in',
  networkinput: 'in',
  output: 'out',
  powersource: 'out',
  networkoutput: 'out',
  networkprovider: 'out',
  networkinout: 'inout',
}

const rolleAusName = (name: string): GdtfAnschluss['rolle'] =>
  /out|thru|through|link/i.test(name) ? 'out' : /in\b|input|power|mains/i.test(name) ? 'in' : 'inout'

export const parseGdtfXml = (xml: string): GdtfTyp => {
  const root = kind(parseXml(xml), 'GDTF')
  const ft = kind(root, 'FixtureType')
  if (!ft) throw new Error('GDTF: no <FixtureType> element')
  const idx = indexiere(kind(ft, 'Geometries'))
  const modi: GdtfModus[] = kinder(kind(ft, 'DMXModes'), 'DMXMode').map((m) => {
    const fb = fussabdruck(m, idx)
    const breaks = [...fb.keys()].sort((a, b) => a - b)
    return {
      name: attr(m, 'Name') ?? 'Default',
      kanaele: breaks.length ? fb.get(breaks[0])! : 0,
      weitereBreaks: breaks.slice(1).map((b) => fb.get(b)!),
    }
  })
  const phys = kind(ft, 'PhysicalDescriptions')
  const props = kind(phys, 'Properties')
  const anschluesse: GdtfAnschluss[] = []
  let verbrauch = 0
  for (const w of idx.wiring) {
    const comp = (attr(w, 'ComponentType') ?? '').toLowerCase()
    if (comp === 'consumer') verbrauch += zahl(attr(w, 'ElectricalPayLoad')) ?? 0
    const typ = attr(w, 'ConnectorType')
    // Sicherungen und interne Verbindungen sind keine Buchsen am Gehaeuse.
    if (!typ || comp === 'fuse') continue
    anschluesse.push({
      name: attr(w, 'Name') ?? typ,
      connectorType: typ,
      rolle: ROLLE[comp] ?? rolleAusName(attr(w, 'Name') ?? ''),
      signal: attr(w, 'SignalType'),
    })
  }
  // GDTF 1.0/1.1: `<Connectors>` (in 1.2 als veraltet gefuehrt).
  if (anschluesse.length === 0) {
    for (const c of kinder(kind(phys, 'Connectors'), 'Connector')) {
      const typ = attr(c, 'Type')
      if (!typ) continue
      const name = attr(c, 'Name') ?? typ
      anschluesse.push({ name, connectorType: typ, rolle: rolleAusName(name) })
    }
  }
  const altVerbrauch = zahl(attr(kind(props, 'PowerConsumption'), 'Value'))
  const powerW = verbrauch || altVerbrauch || idx.beamWatt || undefined
  return {
    name: attr(ft, 'Name') ?? 'Fixture',
    shortName: attr(ft, 'ShortName') || undefined,
    longName: attr(ft, 'LongName') || undefined,
    manufacturer: attr(ft, 'Manufacturer') ?? '',
    description: attr(ft, 'Description') || undefined,
    fixtureTypeId: attr(ft, 'FixtureTypeID') || undefined,
    modi: modi.filter((m) => m.kanaele > 0),
    weightKg: zahl(attr(kind(props, 'Weight'), 'Value')),
    powerW,
    anschluesse,
  }
}

/** `.gdtf`-Archiv lesen. Das Vorschaubild liegt als `<Thumbnail>.png` im Wurzelordner. */
export const parseGdtf = (bytes: Uint8Array): GdtfTyp => {
  const zip = entpacke(bytes)
  const desc = datei(zip, 'description.xml')
  if (!desc) throw new Error('GDTF: description.xml missing')
  const typ = parseGdtfXml(alsText(desc))
  const thumbName = /Thumbnail="([^"]+)"/.exec(alsText(desc))?.[1]
  const png = thumbName ? datei(zip, `${thumbName}.png`) : undefined
  return png ? { ...typ, thumbnailPng: png } : typ
}
