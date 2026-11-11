import { XMLParser } from 'fast-xml-parser'
import { strFromU8, unzipSync } from 'fflate'

/** Ein XML-Element: Attribute unter `@_Name`, Kinder je Tagname als Liste. */
export type XmlKnoten = Record<string, unknown>

// Jedes Element als Liste: GDTF und MVR wiederholen fast jedes Element, und
// ein Parser, der ein einzelnes Kind als Objekt und zwei als Liste liefert,
// laesst den Leser bei der ersten Datei mit nur einem Kanal stolpern.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  isArray: (_name, _pfad, _blatt, istAttribut) => !istAttribut,
})

export const parseXml = (xml: string): XmlKnoten => parser.parse(xml) as XmlKnoten

export const kinder = (k: XmlKnoten | undefined, name: string): XmlKnoten[] => {
  const v = k?.[name]
  return Array.isArray(v) ? (v as unknown[]).map((x) => (typeof x === 'object' && x ? (x as XmlKnoten) : { '#text': String(x) })) : []
}

export const kind = (k: XmlKnoten | undefined, name: string): XmlKnoten | undefined => kinder(k, name)[0]

/** Attribut ohne Ruecksicht auf Gross-/Kleinschreibung (MVR 1.5 schrieb `Break`, 1.6 `break`). */
export const attr = (k: XmlKnoten | undefined, name: string): string | undefined => {
  if (!k) return undefined
  const direkt = k[`@_${name}`]
  if (typeof direkt === 'string') return direkt
  const lc = `@_${name.toLowerCase()}`
  for (const [schluessel, wert] of Object.entries(k)) {
    if (schluessel.toLowerCase() === lc && typeof wert === 'string') return wert
  }
  return undefined
}

export const text = (k: XmlKnoten | undefined): string | undefined => {
  if (!k) return undefined
  const t = k['#text']
  return typeof t === 'string' ? t.trim() : typeof t === 'number' ? String(t) : undefined
}

/** Text des ersten Kindelements `name`. */
export const kindText = (k: XmlKnoten | undefined, name: string): string | undefined => text(kind(k, name))

/** Alle Kind-Elemente in Dateireihenfolge je Tag (Attribute und Text ausgenommen). */
export const alleKinder = (k: XmlKnoten): Array<[string, XmlKnoten]> => {
  const out: Array<[string, XmlKnoten]> = []
  for (const [name, wert] of Object.entries(k)) {
    if (name.startsWith('@_') || name === '#text' || !Array.isArray(wert)) continue
    for (const x of wert) if (x && typeof x === 'object') out.push([name, x as XmlKnoten])
  }
  return out
}

export const zahl = (s: string | undefined): number | undefined => {
  if (s === undefined || s.trim() === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

/** Zip-Inhalt mit Dateinamen als Schluessel. Wirft bei kaputtem Archiv. */
export const entpacke = (bytes: Uint8Array): Map<string, Uint8Array> => new Map(Object.entries(unzipSync(bytes)))

/** Datei im Archiv ohne Ruecksicht auf Gross-/Kleinschreibung. */
export const datei = (zip: Map<string, Uint8Array>, name: string): Uint8Array | undefined => {
  const direkt = zip.get(name)
  if (direkt) return direkt
  const lc = name.toLowerCase()
  for (const [n, b] of zip) if (n.toLowerCase() === lc) return b
  return undefined
}

export const alsText = (b: Uint8Array): string => strFromU8(b)
