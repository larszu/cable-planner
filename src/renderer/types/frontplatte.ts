// ───────────────────────────────────────────────────────────────────────────
// DIE FRONTPLATTE (#879).
//
// Anschlussfeld, Wandanschlussdose, Stagebox: eine Platte mit Loechern, und
// in jedem Loch sitzt ein Stecker, der im Plan ein PORT ist.
//
// ═══════════════════════════════════════════════════════════════════════════
// WAS HIER NICHT NEU ERFUNDEN WIRD
// ═══════════════════════════════════════════════════════════════════════════
//
// Gemessen, bevor gebaut wurde:
//
//   `equipment.widthMm` / `heightMm`   gibt es (v7.9.80, fuer Nicht-19"-
//                                      Geraete im Rack) — das IST das Mass
//                                      der Platte.
//   `port.panelPosX` / `panelPosY`     gibt es (#170) — normiert 0..1 ueber
//                                      die Blende, gezogen im Rack-Bauer.
//   `ConnectorSymbol` + Katalog        gibt es (#472) — die gezeichneten
//                                      Steckverbinder.
//
// Diese Datei legt deshalb KEIN zweites Positionsfeld an. Wer in der
// Frontplatte zieht, schreibt `panelPosX/Y` — dieselbe Zahl, die die
// Rack-Ansicht liest. Das vierte Kriterium aus #879 („Uebernahme in
// Rack-Ansicht") ist damit nichts, was jemand synchronisieren muss.
//
// Neu ist nur, was es wirklich noch nicht gab: die AUSSAGE, dass dieses
// Geraet eine Frontplatte ist, und die Masse in Millimetern dazu.
//
// ═══════════════════════════════════════════════════════════════════════════
// DER AUSSCHNITT WIRD NICHT GERATEN
// ═══════════════════════════════════════════════════════════════════════════
//
// Ein D-Loch fuer Neutrik misst 24 mm, eine BNC-Durchfuehrung je nach
// Bauform 10 bis 12,7 mm, eine Kabelverschraubung was das Datenblatt sagt.
// Diese Zahlen stehen NICHT in diesem Programm: sie haengen am Hersteller
// und an der Bauform, und eine eingebaute Tabelle saehe aus wie eine
// Angabe des Datenblatts.
//
// Folge: `ausschnittMm` ist optional und wird eingetragen. Ohne ihn wird
// nicht auf Ueberschneidung geprueft — und das wird GESAGT, statt zu
// schweigen. Eine Platte ohne Ausschnittmasse ist nicht kollisionsfrei,
// sie ist ungeprueft.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import { einsetzen, type Platzhalterwerte } from '../lib/platzhalter'
import type { Port } from './equipment'

/** Was fuer eine Platte es ist. Kein Freitext: die Liste im Plan gruppiert danach. */
export type FrontplattenArt = 'wandfeld' | 'stagebox' | 'blende' | 'sonstige'

export const FRONTPLATTEN_ARTEN: FrontplattenArt[] = ['wandfeld', 'stagebox', 'blende', 'sonstige']

export const istFrontplattenArt = (v: unknown): v is FrontplattenArt =>
  typeof v === 'string' && (FRONTPLATTEN_ARTEN as string[]).includes(v)

export interface Frontplatte {
  art: FrontplattenArt
  /**
   * Raster, auf das ein gezogener Stecker faellt, in Millimetern. 0 = frei.
   *
   * Es ist eine Hilfe beim Setzen und KEINE Aussage ueber die Platte: wer
   * eine gekaufte Blende abbildet, deren Loecher schon gebohrt sind, stellt
   * es auf 0 und setzt die Stecker dorthin, wo sie sitzen.
   */
  rasterMm?: number
  /**
   * Hoehe des Beschriftungsstreifens in Millimetern.
   *
   * Der Streifen wird 1:1 gedruckt und unter die Platte geklebt; seine Hoehe
   * ist die des Streifenhalters, nicht der Platte.
   */
  streifenHoeheMm?: number
  /**
   * Welche Portliste auf der Platte sitzt, wenn das Geraet durchleitet.
   *
   * Ein Wandfeld hat vorne die Buchsen und hinten die Hausstrecke; beide
   * Seiten stehen als `inputs` und `outputs` am Geraet (Position n vorne ist
   * Position n hinten, `patchPanelCounterpart`). Auf die Platte gehoert nur
   * eine davon. Fehlt die Angabe, gilt die Seite, deren Stecker schon eine
   * Lage haben — siehe `plattenPorts` in `lib/patchPanel.ts`.
   */
  seite?: 'inputs' | 'outputs'
  notiz?: string
}

export const normalisiereFrontplatte = (roh: unknown): Frontplatte | undefined => {
  if (!roh || typeof roh !== 'object') return undefined
  const o = roh as Record<string, unknown>
  if (!istFrontplattenArt(o.art)) return undefined
  const zahl = (v: unknown): number | undefined => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : undefined
  }
  return {
    art: o.art,
    rasterMm: zahl(o.rasterMm),
    streifenHoeheMm: zahl(o.streifenHoeheMm),
    seite: o.seite === 'inputs' || o.seite === 'outputs' ? o.seite : undefined,
    notiz: typeof o.notiz === 'string' ? o.notiz : undefined,
  }
}

// ─── RECHNEN IN MILLIMETERN ────────────────────────────────────────────────

export interface PlattenMass {
  breiteMm: number
  hoeheMm: number
}

/**
 * Wo ein Stecker auf der Platte sitzt, in Millimetern von links oben.
 *
 * `undefined`, wenn der Port keine Position traegt. NICHT (0,0): eine
 * Vorgabe-Ecke sieht auf der Zeichnung aus wie eine gesetzte Lage, und
 * jemand bohrt danach.
 */
export const mmPosition = (port: Port, platte: PlattenMass): { xMm: number; yMm: number } | undefined => {
  if (port.panelPosX === undefined || port.panelPosY === undefined) return undefined
  return { xMm: port.panelPosX * platte.breiteMm, yMm: port.panelPosY * platte.hoeheMm }
}

/** Eine Millimeter-Lage zurueck in die normierte Form — auf Wunsch aufs Raster. */
export const ausMm = (
  xMm: number,
  yMm: number,
  platte: PlattenMass,
  rasterMm = 0,
): { panelPosX: number; panelPosY: number } => {
  const fang = (w: number) => (rasterMm > 0 ? Math.round(w / rasterMm) * rasterMm : w)
  const x = Math.min(platte.breiteMm, Math.max(0, fang(xMm)))
  const y = Math.min(platte.hoeheMm, Math.max(0, fang(yMm)))
  return {
    panelPosX: platte.breiteMm > 0 ? x / platte.breiteMm : 0,
    panelPosY: platte.hoeheMm > 0 ? y / platte.hoeheMm : 0,
  }
}

// ─── DIE PRUEFUNG ──────────────────────────────────────────────────────────

export type PlattenBefundArt =
  /** Der Stecker sitzt ganz oder halb ausserhalb der Platte. */
  | 'ausserhalb'
  /** Zwei Ausschnitte ueberschneiden sich. */
  | 'ueberschneidung'
  /** Ein Stecker hat keine Lage — er ist im Plan, aber nicht auf der Platte. */
  | 'ohne-lage'
  /** Es fehlen Ausschnittmasse; auf Ueberschneidung wurde NICHT geprueft. */
  | 'ausschnitt-offen'

export interface PlattenBefund {
  art: PlattenBefundArt
  portIds: string[]
  schluessel: string
  werte: Platzhalterwerte
  text: string
}

/**
 * Was an dieser Platte nicht stimmt.
 *
 * Die Reihenfolge ist die der Schwere: zwei Loecher, die sich schneiden,
 * sind eine Platte, die man nicht bohren kann; ein Stecker ohne Lage ist
 * eine Angabe, die jemand noch machen muss.
 */
export const plattenBefunde = (ports: readonly Port[], platte: PlattenMass): PlattenBefund[] => {
  const befunde: PlattenBefund[] = []
  const gesetzt = ports.filter((p) => p.panelPosX !== undefined && p.panelPosY !== undefined)

  // (1) Ausserhalb. Gerechnet wird mit dem Ausschnitt, wo einer angegeben
  //     ist — ein Stecker, dessen MITTE gerade noch auf der Platte liegt,
  //     dessen Loch aber nicht, passt trotzdem nicht.
  for (const p of gesetzt) {
    const pos = mmPosition(p, platte)
    if (!pos) continue
    const r = (p.ausschnittMm ?? 0) / 2
    if (pos.xMm - r < 0 || pos.yMm - r < 0 || pos.xMm + r > platte.breiteMm || pos.yMm + r > platte.hoeheMm) {
      befunde.push({
        art: 'ausserhalb',
        portIds: [p.id],
        schluessel: 'faceplate.outside',
        werte: { port: p.name },
        text: einsetzen('{port} sits outside the plate - it cannot be drilled there.', {
          port: p.name,
        }),
      })
    }
  }

  // (2) Ueberschneidung — NUR zwischen Steckern, die beide ein Ausschnittmass
  //     tragen. Ohne Mass gibt es keinen Kreis, und ein angenommener waere
  //     genau die Zahl, nach der jemand bohrt.
  const mitMass = gesetzt.filter((p) => (p.ausschnittMm ?? 0) > 0)
  for (let i = 0; i < mitMass.length; i += 1) {
    for (let j = i + 1; j < mitMass.length; j += 1) {
      const a = mmPosition(mitMass[i], platte)
      const b = mmPosition(mitMass[j], platte)
      if (!a || !b) continue
      const abstand = Math.hypot(a.xMm - b.xMm, a.yMm - b.yMm)
      const noetig = (mitMass[i].ausschnittMm ?? 0) / 2 + (mitMass[j].ausschnittMm ?? 0) / 2
      if (abstand < noetig) {
        befunde.push({
          art: 'ueberschneidung',
          portIds: [mitMass[i].id, mitMass[j].id],
          schluessel: 'faceplate.overlap',
          werte: {
            a: mitMass[i].name,
            b: mitMass[j].name,
            mm: Math.round((noetig - abstand) * 10) / 10,
          },
          text: einsetzen('{a} and {b} overlap by {mm} mm - the two holes run into each other.', {
            a: mitMass[i].name,
            b: mitMass[j].name,
            mm: Math.round((noetig - abstand) * 10) / 10,
          }),
        })
      }
    }
  }

  // (3) Ohne Lage.
  const ohne = ports.filter((p) => p.panelPosX === undefined || p.panelPosY === undefined)
  if (ohne.length > 0) {
    befunde.push({
      art: 'ohne-lage',
      portIds: ohne.map((p) => p.id),
      schluessel: 'faceplate.unplaced',
      werte: { n: ohne.length, ports: ohne.map((p) => p.name).join(', ') },
      text: einsetzen('{n} connectors have no position on the plate yet: {ports}.', {
        n: ohne.length,
        ports: ohne.map((p) => p.name).join(', '),
      }),
    })
  }

  // (4) Was NICHT geprueft wurde. Es steht da, statt zu schweigen: eine
  //     Platte ohne Ausschnittmasse ist nicht kollisionsfrei, sie ist
  //     ungeprueft — und das ist ein Unterschied, an dem eine Bohrung haengt.
  const ohneMass = gesetzt.filter((p) => !((p.ausschnittMm ?? 0) > 0))
  if (ohneMass.length > 0) {
    befunde.push({
      art: 'ausschnitt-offen',
      portIds: ohneMass.map((p) => p.id),
      schluessel: 'faceplate.cutoutUnknown',
      werte: { n: ohneMass.length },
      text: einsetzen(
        '{n} connectors carry no cutout size - they were NOT checked against each other. The size is in the manufacturer document; this program does not guess it.',
        { n: ohneMass.length },
      ),
    })
  }

  return befunde
}

// ─── DER BESCHRIFTUNGSSTREIFEN ─────────────────────────────────────────────

export interface StreifenFeld {
  portId: string
  text: string
  /** Mitte des Feldes in Millimetern von links. */
  xMm: number
  /** Mitte des Steckers in Millimetern von oben — sagt, zu welcher Reihe er gehoert. */
  yMm: number
}

/**
 * Die Felder des Streifens, in der Reihenfolge, in der sie auf der Platte
 * sitzen (links nach rechts).
 *
 * Stecker OHNE Lage stehen nicht drauf: ein Streifenfeld ohne Loch darueber
 * verschiebt beim Kleben alles, was danach kommt.
 */
export const streifenFelder = (
  ports: readonly Port[],
  platte: PlattenMass,
  beschriftung: (p: Port) => string,
): StreifenFeld[] =>
  ports
    .map((p) => {
      const pos = mmPosition(p, platte)
      return pos ? { portId: p.id, text: beschriftung(p), xMm: pos.xMm, yMm: pos.yMm } : undefined
    })
    .filter((f): f is StreifenFeld => !!f)
    .sort((a, b) => a.xMm - b.xMm)

/** Stecker, deren Mitten weniger als so viel auseinanderliegen, bilden eine Reihe. */
const REIHEN_TOLERANZ_MM = 3

/**
 * Die Streifen einer Platte, ein Streifen je Steckerreihe, von oben nach unten.
 *
 * Ein einziger Streifen fuer eine zweireihige Platte (BNC oben, RJ45
 * darunter) druckte die Namen uebereinander, weil beide Reihen dieselben
 * x-Lagen haben. Wandfelder mit mehreren Reihen haben je Reihe einen
 * Streifenhalter — also gibt es je Reihe einen Streifen.
 */
export const streifenReihen = (
  ports: readonly Port[],
  platte: PlattenMass,
  beschriftung: (p: Port) => string,
): StreifenFeld[][] => {
  const reihen: StreifenFeld[][] = []
  const felder = [...streifenFelder(ports, platte, beschriftung)].sort((a, b) => a.yMm - b.yMm)
  for (const f of felder) {
    const reihe = reihen.find((r) => Math.abs(r[0].yMm - f.yMm) < REIHEN_TOLERANZ_MM)
    if (reihe) reihe.push(f)
    else reihen.push([f])
  }
  return reihen.map((r) => r.sort((a, b) => a.xMm - b.xMm))
}
