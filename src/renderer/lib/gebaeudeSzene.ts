// ───────────────────────────────────────────────────────────────────────────
// #916 — das Gebaeude als 3D-Szene: Raeume auf ihrer Etage, Geraete darin,
// Kabel und Raumverbindungen dazwischen.
//
// REIN und ohne three.js: die Szene ist Daten (Meter, Farben, Ids), gezeichnet
// wird sie in `components/Rack/Gebaeude3DDialog.tsx` hinter der Lazy-Grenze.
// So ist die Rechnung ohne WebGL testbar, und das Modell kann in die Suite
// wandern (av-planner-suite#258), ohne den Renderer mitzunehmen.
//
// WAS HIER NICHT GERATEN WIRD. Die Hoehe einer Etage kommt aus der
// Etagenliste. Fehlt sie, wird mit einer einstellbaren Geschosshoehe
// gestapelt — und die Etage traegt `hoeheAngenommen`, damit die Ansicht es
// sagt. Ein Stockwerk, das auf 8 m gezeichnet ist, weil jemand 4 m pro
// Geschoss angenommen hat, darf nicht aussehen wie gemessen.
//
// Die Grundflaeche ist die des Canvas, mit dem Massstab der Laengen-
// Schaetzung (`metersPer100px`). Ein Rahmen ist ein Raum im Schaltbild, kein
// vermessener Grundriss — die Ansicht zeigt Zusammenhaenge, keine Bauplaene.
// ───────────────────────────────────────────────────────────────────────────
import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'
import type { Floor, LocationFrame } from '../types/location'
import { locationForEquipment } from './equipmentLocation'
import { etagenIndex, etageVon } from './etagen'
import { styleForLayer } from './cableLayers'

export interface Punkt3D {
  x: number
  y: number
  z: number
}

export interface SzeneEtage {
  name: string
  /** Fussbodenhoehe in m. */
  y: number
  /** true, wenn die Hoehe aus der Geschosshoehe gerechnet und nicht angegeben ist. */
  hoeheAngenommen: boolean
}

export interface SzeneRaum {
  id: string
  name: string
  etage?: string
  farbe: string
  /** Ecke links vorne am Boden, Masse in m. */
  x: number
  y: number
  z: number
  breite: number
  tiefe: number
  hoehe: number
}

export interface SzeneGeraet {
  id: string
  name: string
  raumId?: string
  pos: Punkt3D
}

export interface SzeneKabel {
  id: string
  name: string
  farbe: string
  von: Punkt3D
  nach: Punkt3D
  tieLine: boolean
  /** Laeuft zwischen zwei verschiedenen Raeumen. */
  raumuebergreifend: boolean
}

export interface SzeneVerbindung {
  vonRaumId: string
  nachRaumId: string
  kabelIds: string[]
  von: Punkt3D
  nach: Punkt3D
}

export interface GebaeudeSzene {
  etagen: SzeneEtage[]
  raeume: SzeneRaum[]
  geraete: SzeneGeraet[]
  kabel: SzeneKabel[]
  verbindungen: SzeneVerbindung[]
  /** Mittelpunkt und Ausdehnung — fuer die Kamera. */
  mitte: Punkt3D
  groesse: number
}

export interface SzenenOptionen {
  /** Meter je 100 px Canvas (Laengen-Schaetzung). */
  metersPer100px: number
  /** Geschosshoehe fuer Etagen ohne Hoehenangabe, in m. */
  geschosshoeheM: number
  /** Ids verborgener Rahmen/Geraete (lib/ansicht.ts) — sie fehlen in der Szene. */
  verborgeneRahmen?: ReadonlySet<string>
  verborgeneGeraete?: ReadonlySet<string>
  /** Kabel, deren Ebene ausgeblendet ist, fehlen ebenfalls. */
  kabelSichtbar?: (c: Cable) => boolean
}

/** Sichtbare Raumhoehe: etwas unter der Geschosshoehe, damit die Etagen getrennt bleiben. */
const raumHoehe = (geschoss: number) => Math.max(1, geschoss * 0.75)

/**
 * Hoehe jeder Etage. Eine angegebene gilt; eine fehlende wird von der
 * naechsten angegebenen darunter aus um je eine Geschosshoehe gestapelt
 * (ohne eine darunter: vom Boden aus).
 */
export function etagenHoehen(floors: readonly Floor[], geschosshoeheM: number): SzeneEtage[] {
  const aus: SzeneEtage[] = []
  let basis = 0
  let basisIndex = -1
  floors.forEach((f, i) => {
    if (f.elevationM !== undefined) {
      aus.push({ name: f.name, y: f.elevationM, hoeheAngenommen: false })
      basis = f.elevationM
      basisIndex = i
    } else {
      const y = basisIndex >= 0 ? basis + (i - basisIndex) * geschosshoeheM : i * geschosshoeheM
      aus.push({ name: f.name, y, hoeheAngenommen: true })
    }
  })
  return aus
}

export function gebaeudeSzene(
  daten: {
    equipment: readonly EquipmentItem[]
    cables: readonly Cable[]
    locations: readonly LocationFrame[]
    floors: readonly Floor[]
  },
  opt: SzenenOptionen,
): GebaeudeSzene {
  const m = opt.metersPer100px / 100
  const etagen = etagenHoehen(daten.floors, opt.geschosshoeheM)
  const hoeheVonRahmen = (loc: LocationFrame): number => {
    const i = etagenIndex(etageVon(loc, daten.floors)?.name, daten.floors)
    return i >= 0 ? etagen[i].y : 0
  }

  const raeume: SzeneRaum[] = daten.locations
    .filter((l) => !opt.verborgeneRahmen?.has(l.id))
    .map((l) => ({
      id: l.id,
      name: l.name,
      ...(etageVon(l, daten.floors) ? { etage: etageVon(l, daten.floors)!.name } : {}),
      farbe: l.color,
      x: l.x * m,
      y: hoeheVonRahmen(l),
      z: l.y * m,
      breite: l.width * m,
      tiefe: l.height * m,
      hoehe: raumHoehe(opt.geschosshoeheM),
    }))

  const geraetById = new Map<string, SzeneGeraet>()
  for (const e of daten.equipment) {
    if (opt.verborgeneGeraete?.has(e.id)) continue
    const loc = locationForEquipment(e, daten.locations)
    if (loc && opt.verborgeneRahmen?.has(loc.id)) continue
    const boden = loc ? hoeheVonRahmen(loc) : 0
    // Eine Kamera mit bekannter Hoehe (MultiCam, #910) steht auf ihr; alles
    // andere auf Tischhoehe — sichtbar ueber dem Boden, ohne etwas zu behaupten.
    const ueberBoden = e.optik?.hoeheM ?? 0.8
    geraetById.set(e.id, {
      id: e.id,
      name: e.name,
      ...(loc ? { raumId: loc.id } : {}),
      pos: {
        x: (e.x + (e.width ?? 0) / 2) * m,
        y: boden + ueberBoden,
        z: (e.y + (e.height ?? 0) / 2) * m,
      },
    })
  }

  const kabel: SzeneKabel[] = []
  const verbindungByKey = new Map<string, SzeneVerbindung>()
  const raumMitte = new Map(raeume.map((r) => [r.id, { x: r.x + r.breite / 2, y: r.y + r.hoehe, z: r.z + r.tiefe / 2 }]))
  for (const c of daten.cables) {
    if (opt.kabelSichtbar && !opt.kabelSichtbar(c)) continue
    const von = geraetById.get(c.fromEquipmentId)
    const nach = geraetById.get(c.toEquipmentId)
    if (!von || !nach) continue
    const raumuebergreifend = !!von.raumId && !!nach.raumId && von.raumId !== nach.raumId
    kabel.push({
      id: c.id,
      name: c.cableNumber || c.name,
      farbe: c.color || styleForLayer(c.layer).color,
      von: von.pos,
      nach: nach.pos,
      tieLine: !!c.isTieLine,
      raumuebergreifend,
    })
    if (raumuebergreifend) {
      // Richtungsunabhaengig: A→B und B→A sind dieselbe Verbindung zweier Raeume.
      const [a, b] = [von.raumId!, nach.raumId!].sort()
      const key = `${a}\u0000${b}`
      const v = verbindungByKey.get(key)
      if (v) v.kabelIds.push(c.id)
      else if (raumMitte.has(a) && raumMitte.has(b)) {
        verbindungByKey.set(key, { vonRaumId: a, nachRaumId: b, kabelIds: [c.id], von: raumMitte.get(a)!, nach: raumMitte.get(b)! })
      }
    }
  }

  const punkte = [
    ...raeume.flatMap((r) => [
      { x: r.x, y: r.y, z: r.z },
      { x: r.x + r.breite, y: r.y + r.hoehe, z: r.z + r.tiefe },
    ]),
    ...[...geraetById.values()].map((g) => g.pos),
  ]
  const min = { x: Infinity, y: Infinity, z: Infinity }
  const max = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (const p of punkte) {
    min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y); min.z = Math.min(min.z, p.z)
    max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y); max.z = Math.max(max.z, p.z)
  }
  const leer = punkte.length === 0
  const mitte = leer ? { x: 0, y: 0, z: 0 } : { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 }
  const groesse = leer ? 10 : Math.max(5, max.x - min.x, max.y - min.y, max.z - min.z)

  return { etagen, raeume, geraete: [...geraetById.values()], kabel, verbindungen: [...verbindungByKey.values()], mitte, groesse }
}
