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
  /** Hoehe der Kabeltrasse ueber dem Geraet: knapp unter der Decke seines Raums. */
  trasseY: number
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
  /**
   * Der gezeichnete Weg. Zwei Punkte (Luftlinie), solange nichts ueber den
   * Kabelweg bekannt ist; ueber einen Steigschacht sechs: hoch zur Trasse,
   * waagrecht zum Schacht, senkrecht auf die andere Etage, waagrecht zum
   * Ziel, hinunter.
   */
  punkte: Punkt3D[]
  /** Id des Schachts, durch den der Weg laeuft. */
  schachtId?: string
  /** Die Enden liegen auf verschiedenen Etagen. */
  etagenwechsel: boolean
}

/**
 * Ein Steigschacht: ein Rahmen, der als senkrechte Trasse durch alle Etagen
 * gezeichnet wird. Kabel zwischen Etagen laufen durch den naechstgelegenen.
 */
export interface SzeneSchacht {
  id: string
  name: string
  farbe: string
  x: number
  z: number
  breite: number
  tiefe: number
  yUnten: number
  yOben: number
}

export interface SzeneVerbindung {
  vonRaumId: string
  nachRaumId: string
  kabelIds: string[]
  von: Punkt3D
  nach: Punkt3D
  /** Wie `SzeneKabel.punkte`: zwei Punkte oder der Weg ueber den Schacht. */
  punkte: Punkt3D[]
}

export interface GebaeudeSzene {
  etagen: SzeneEtage[]
  raeume: SzeneRaum[]
  geraete: SzeneGeraet[]
  kabel: SzeneKabel[]
  verbindungen: SzeneVerbindung[]
  schaechte: SzeneSchacht[]
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
 * Hoehe jeder Etage. Eine angegebene gilt. Eine fehlende wird von der
 * naechsten angegebenen aus um je eine Geschosshoehe gestapelt: UNTER der
 * ersten angegebenen nach unten (ein Keller liegt unter dem Erdgeschoss, nicht
 * auf seiner Hoehe), darueber nach oben. Ohne jede Angabe vom Boden aus.
 */
export function etagenHoehen(floors: readonly Floor[], geschosshoeheM: number): SzeneEtage[] {
  const bekannt = floors.map((f, i) => (f.elevationM !== undefined ? i : -1)).filter((i) => i >= 0)
  return floors.map((f, i) => {
    if (f.elevationM !== undefined) return { name: f.name, y: f.elevationM, hoeheAngenommen: false }
    const darunter = [...bekannt].reverse().find((k) => k < i)
    if (darunter !== undefined) {
      return { name: f.name, y: floors[darunter].elevationM! + (i - darunter) * geschosshoeheM, hoeheAngenommen: true }
    }
    const darueber = bekannt.find((k) => k > i)
    if (darueber !== undefined) {
      return { name: f.name, y: floors[darueber].elevationM! - (darueber - i) * geschosshoeheM, hoeheAngenommen: true }
    }
    return { name: f.name, y: i * geschosshoeheM, hoeheAngenommen: true }
  })
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

  const sichtbar = daten.locations.filter((l) => !opt.verborgeneRahmen?.has(l.id))
  // Schaechte stehen nicht als Raum auf einer Etage, sondern gehen durch alle:
  // vom tiefsten Boden bis unter die hoechste Decke.
  const tiefste = etagen.length > 0 ? Math.min(...etagen.map((e) => e.y)) : 0
  const hoechste = etagen.length > 0 ? Math.max(...etagen.map((e) => e.y)) : 0
  const schaechte: SzeneSchacht[] = sichtbar
    .filter((l) => l.steigschacht)
    .map((l) => ({
      id: l.id,
      name: l.name,
      farbe: l.color,
      x: (l.x + l.width / 2) * m,
      z: (l.y + l.height / 2) * m,
      breite: Math.max(0.3, l.width * m),
      tiefe: Math.max(0.3, l.height * m),
      yUnten: tiefste,
      yOben: hoechste + raumHoehe(opt.geschosshoeheM),
    }))

  const raeume: SzeneRaum[] = sichtbar
    .filter((l) => !l.steigschacht)
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
      trasseY: boden + raumHoehe(opt.geschosshoeheM) * 0.95,
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
    const weg = wegUeberSchacht(von.pos, von.trasseY, nach.pos, nach.trasseY, schaechte)
    kabel.push({
      id: c.id,
      name: c.cableNumber || c.name,
      farbe: c.color || styleForLayer(c.layer).color,
      von: von.pos,
      nach: nach.pos,
      tieLine: !!c.isTieLine,
      raumuebergreifend,
      punkte: weg.punkte,
      ...(weg.schachtId ? { schachtId: weg.schachtId } : {}),
      etagenwechsel: Math.abs(von.trasseY - nach.trasseY) >= 0.01,
    })
    if (raumuebergreifend) {
      // Richtungsunabhaengig: A→B und B→A sind dieselbe Verbindung zweier Raeume.
      const [a, b] = [von.raumId!, nach.raumId!].sort()
      const key = `${a}\u0000${b}`
      const v = verbindungByKey.get(key)
      if (v) v.kabelIds.push(c.id)
      else if (raumMitte.has(a) && raumMitte.has(b)) {
        const va = raumMitte.get(a)!
        const vb = raumMitte.get(b)!
        verbindungByKey.set(key, {
          vonRaumId: a,
          nachRaumId: b,
          kabelIds: [c.id],
          von: va,
          nach: vb,
          punkte: wegUeberSchacht(va, va.y, vb, vb.y, schaechte).punkte,
        })
      }
    }
  }

  const punkte = [
    ...raeume.flatMap((r) => [
      { x: r.x, y: r.y, z: r.z },
      { x: r.x + r.breite, y: r.y + r.hoehe, z: r.z + r.tiefe },
    ]),
    ...[...geraetById.values()].map((g) => g.pos),
    ...schaechte.flatMap((sch) => [
      { x: sch.x, y: sch.yUnten, z: sch.z },
      { x: sch.x, y: sch.yOben, z: sch.z },
    ]),
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

  return { etagen, raeume, geraete: [...geraetById.values()], kabel, verbindungen: [...verbindungByKey.values()], schaechte, mitte, groesse }
}

/**
 * Der Weg zwischen zwei Punkten auf VERSCHIEDENEN Etagen, wenn es einen
 * Steigschacht gibt: hoch zur Trasse, waagrecht zum Schacht, senkrecht
 * hinauf oder hinab, waagrecht zum Ziel, hinunter.
 *
 * Gewaehlt wird der Schacht mit dem kuerzesten waagrechten Umweg. Auf
 * derselben Etage oder ohne Schacht bleibt es die Luftlinie — was der Plan
 * nicht weiss, zeichnet die Ansicht nicht als Trasse.
 */
export function wegUeberSchacht(
  von: Punkt3D,
  vonTrasseY: number,
  nach: Punkt3D,
  nachTrasseY: number,
  schaechte: readonly SzeneSchacht[],
): { punkte: Punkt3D[]; schachtId?: string } {
  const luftlinie = { punkte: [von, nach] }
  if (schaechte.length === 0 || Math.abs(vonTrasseY - nachTrasseY) < 0.01) return luftlinie
  const flach = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)
  const schacht = [...schaechte].sort(
    (a, b) => flach(von, a) + flach(a, nach) - (flach(von, b) + flach(b, nach)) || a.id.localeCompare(b.id),
  )[0]
  return {
    schachtId: schacht.id,
    punkte: [
      von,
      { x: von.x, y: vonTrasseY, z: von.z },
      { x: schacht.x, y: vonTrasseY, z: schacht.z },
      { x: schacht.x, y: nachTrasseY, z: schacht.z },
      { x: nach.x, y: nachTrasseY, z: nach.z },
      nach,
    ].filter((p, i, alle) => i === 0 || flach(p, alle[i - 1]) > 1e-6 || Math.abs(p.y - alle[i - 1].y) > 1e-6),
  }
}
