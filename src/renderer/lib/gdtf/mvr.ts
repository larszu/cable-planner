// #1206 — MVR-Szene lesen (DIN SPEC 15801, MVR 1.4–1.6).
//
// Ein Kabelplan braucht aus der Szene je Objekt: welcher Typ (GDTFSpec +
// Modus), wo es steht (in der Draufsicht) und auf welcher DMX-Adresse. Die
// Szene selbst (Geometrie, Truss-Modelle) bleibt im Lichtplan.
//
// Quelle: github.com/mvrdevelopment/spec, mvr-spec.md (MVR 1.6).

import { alleKinder, alsText, attr, datei, entpacke, kind, kindText, kinder, parseXml, text, type XmlKnoten } from './xml'

export type MvrArt = 'Fixture' | 'VideoScreen' | 'Projector' | 'Support' | 'Truss' | 'SceneObject'

const ARTEN: readonly MvrArt[] = ['Fixture', 'VideoScreen', 'Projector', 'Support', 'Truss', 'SceneObject']

export interface MvrObjekt {
  uuid: string
  name: string
  art: MvrArt
  gdtfSpec?: string
  gdtfMode?: string
  fixtureId?: string
  /** Weltlage in Millimetern (MVR: rechtshaendig, Z nach oben). */
  x: number
  y: number
  z: number
  universe?: number
  adresse?: number
  layer: string
}

export interface MvrSzene {
  objekte: MvrObjekt[]
  /** Eingebettete `.gdtf`-Dateien, Schluessel = Dateiname im Archiv. */
  gdtf: Map<string, Uint8Array>
  version?: string
}

type V3 = [number, number, number]
interface Matrix { u: V3; v: V3; w: V3; o: V3 }

const EINHEIT: Matrix = { u: [1, 0, 0], v: [0, 1, 0], w: [0, 0, 1], o: [0, 0, 0] }

/** `{u1,u2,u3}{v1,v2,v3}{w1,w2,w3}{o1,o2,o3}` */
export const parseMatrix = (s: string | undefined): Matrix => {
  if (!s) return EINHEIT
  const gruppen = [...s.matchAll(/\{([^}]*)\}/g)].map((m) => m[1].split(',').map((x) => Number(x.trim())))
  if (gruppen.length !== 4 || gruppen.some((g) => g.length !== 3 || g.some((n) => !Number.isFinite(n)))) return EINHEIT
  return { u: gruppen[0] as V3, v: gruppen[1] as V3, w: gruppen[2] as V3, o: gruppen[3] as V3 }
}

const drehe = (m: Matrix, p: V3): V3 => [
  p[0] * m.u[0] + p[1] * m.v[0] + p[2] * m.w[0],
  p[0] * m.u[1] + p[1] * m.v[1] + p[2] * m.w[1],
  p[0] * m.u[2] + p[1] * m.v[2] + p[2] * m.w[2],
]

const plus = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

/** Eltern ∘ Kind: jede Objekt-Matrix steht im Koordinatensystem ihres Elternteils. */
export const verkette = (eltern: Matrix, kindM: Matrix): Matrix => ({
  u: drehe(eltern, kindM.u),
  v: drehe(eltern, kindM.v),
  w: drehe(eltern, kindM.w),
  o: plus(drehe(eltern, kindM.o), eltern.o),
})

/** `45` (absolut) oder `2.1` (Universe.Adresse), Universe ab 1. */
export const parseAdresse = (s: string | undefined): { universe: number; adresse: number } | undefined => {
  if (!s) return undefined
  const t = s.trim()
  const punkt = /^(\d+)\.(\d+)$/.exec(t)
  if (punkt) return { universe: Number(punkt[1]), adresse: Number(punkt[2]) }
  const n = Number(t)
  if (!Number.isInteger(n) || n < 1) return undefined
  return { universe: Math.floor((n - 1) / 512) + 1, adresse: ((n - 1) % 512) + 1 }
}

const adresseVon = (k: XmlKnoten): { universe: number; adresse: number } | undefined => {
  const liste = kinder(kind(k, 'Addresses'), 'Address')
  // Break 0 ist der erste Eingang (MVR zaehlt ab 0, GDTF ab 1).
  const erster = liste.find((a) => (attr(a, 'break') ?? '0') === '0') ?? liste[0]
  return parseAdresse(text(erster))
}

export const parseMvrXml = (xml: string): Omit<MvrSzene, 'gdtf'> => {
  const root = kind(parseXml(xml), 'GeneralSceneDescription')
  if (!root) throw new Error('MVR: no <GeneralSceneDescription> element')
  const objekte: MvrObjekt[] = []
  const besuche = (liste: XmlKnoten | undefined, eltern: Matrix, layer: string) => {
    if (!liste) return
    for (const [tag, k] of alleKinder(liste)) {
      const m = verkette(eltern, parseMatrix(kindText(k, 'Matrix')))
      if ((ARTEN as readonly string[]).includes(tag)) {
        const adr = adresseVon(k)
        objekte.push({
          uuid: attr(k, 'uuid') ?? '',
          name: attr(k, 'name') ?? '',
          art: tag as MvrArt,
          gdtfSpec: kindText(k, 'GDTFSpec') || undefined,
          gdtfMode: kindText(k, 'GDTFMode') || undefined,
          fixtureId: kindText(k, 'FixtureID') || undefined,
          x: m.o[0],
          y: m.o[1],
          z: m.o[2],
          ...(adr ?? {}),
          layer,
        })
      }
      // GroupObject und verschachtelte Objekte (Fixture auf Truss) tragen
      // ihre Kinder in einer eigenen ChildList.
      besuche(kind(k, 'ChildList'), m, layer)
    }
  }
  for (const layer of kinder(kind(kind(root, 'Scene'), 'Layers'), 'Layer')) {
    const m = parseMatrix(kindText(layer, 'Matrix'))
    besuche(kind(layer, 'ChildList'), m, attr(layer, 'name') ?? '')
  }
  const major = attr(root, 'verMajor')
  const minor = attr(root, 'verMinor')
  return { objekte, version: major ? `${major}.${minor ?? '0'}` : undefined }
}

export const parseMvr = (bytes: Uint8Array): MvrSzene => {
  const zip = entpacke(bytes)
  const xml = datei(zip, 'GeneralSceneDescription.xml')
  if (!xml) throw new Error('MVR: GeneralSceneDescription.xml missing')
  const gdtf = new Map<string, Uint8Array>()
  for (const [n, b] of zip) if (n.toLowerCase().endsWith('.gdtf')) gdtf.set(n, b)
  return { ...parseMvrXml(alsText(xml)), gdtf }
}

/**
 * Die `.gdtf`-Datei zu einem `GDTFSpec`. Das Beispiel der Norm selbst laesst
 * die Endung weg, also erst der Name wie geschrieben, dann mit `.gdtf`.
 */
export const gdtfZuSpec = (szene: MvrSzene, spec: string): Uint8Array | undefined => {
  const zip = szene.gdtf
  return datei(zip, spec) ?? datei(zip, `${spec}.gdtf`)
}

