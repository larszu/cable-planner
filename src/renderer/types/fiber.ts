// ───────────────────────────────────────────────────────────────────────────
// EINE BUCHSE, MEHRERE FASERN (#885).
//
// Aus der Pruefung in #882: laesst sich ein opticalCON QUAD abbilden — aussen
// eine Buchse, innen vier Fasern, an der Breakout-Peitsche zwei LC-Duplex?
// Gemessen: nein. Das Modell war an dieser Stelle flach.
//
// ═══════════════════════════════════════════════════════════════════════════
// WARUM EINE UNTER-TERMINIERUNG AM PORT UND NICHT VIER KABEL
// ═══════════════════════════════════════════════════════════════════════════
//
// Vier Kabel mit gemeinsamem `multicoreName` sind der Notbehelf, den heute
// jeder baut, und #885 nennt genau seinen Preis: **der aeussere
// Steckverbinder kommt darin nicht vor.** Der Plan zeigt vier LC-Strippen und
// verschweigt, dass sie durch EINE Buchse gehen — also genau die Angabe, an
// der haengt, ob das Kabel ueberhaupt passt und wieviele Stecker man braucht.
//
// Der Breakout ist eine Eigenschaft der BUCHSE. Eine opticalCON QUAD fuehrt
// vier Fasern, ob jemand sie patcht oder nicht; ein Kabel belegt davon eine
// oder mehrere. Deshalb steht die Faser-Liste am `Port` und die
// Faser-NUMMER am Kabelende — neben `terminationFrom`/`terminationTo`, wo
// die uebrige Terminierung schon steht.
//
// Das ist die zweite der beiden Formen aus #885 Punkt 3. Die erste (Unter-
// Kabel ueber `multicoreName`) haette bedeutet, dass die Zahl der Kabel im
// Plan von der Zahl der Fasern abhaengt: eine QUAD, an der nur ein Duplex
// gepatcht ist, waere dann zwei Kabel und ein Loch, und niemand koennte
// sagen, ob das Loch geplant ist oder vergessen.
//
// ═══════════════════════════════════════════════════════════════════════════
// „NICHT GESAGT" IST KEIN GRUENER HAKEN
// ═══════════════════════════════════════════════════════════════════════════
//
// `FaserRolle` hat drei Werte und nicht zwei. `unbestimmt` ist der Zustand
// eines Datenblatts, das die Richtung nicht nennt — und der haeufigste. Ihn
// als `tx` zu fuehren hiesse, eine Polaritaetspruefung gegen eine erfundene
// Angabe laufen zu lassen; ihn als Fehler zu fuehren hiesse, jeden zweiten
// Port rot zu faerben. Er ist ein eigener Zustand, die Pruefung sagt es, und
// gruen wird davon nichts.
//
// ═══════════════════════════════════════════════════════════════════════════
// UND DESHALB IST HIER KEINE POLARITAETS-METHODE EINGEBAUT
// ═══════════════════════════════════════════════════════════════════════════
//
// `EINGEBAUTE_POLARITAETSNORMEN` ist LEER — dieselbe Entscheidung wie bei
// `EINGEBAUTE_FARBNORMEN` in `conductor.ts`, aus demselben Grund und mit
// demselben Gewicht.
//
// TIA-568 kennt die Methoden A, B und C, und sie unterscheiden sich darin,
// WO die Fasern gekreuzt werden: im Trunk, im Patchkabel oder an beiden
// Enden unterschiedlich. Welche fuer eine Anlage gilt, steht im
// Installations-Dokument dieser Anlage und nicht im Programm. Eine
// eingebaute Vorgabe saehe aus wie eine geprueft Angabe, faerbte jede Faser,
// und die Pruefung bestaetigte sie anschliessend gegen sich selbst — bei
// einer Anlage, die danach kein Licht fuehrt.
//
// Eine Methode wird deshalb GEWAEHLT und traegt ihre `herkunft` im Klartext.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import { einsetzen, type Platzhalterwerte } from '../lib/platzhalter'

/**
 * Was eine Faser fuehrt.
 *
 * `unbestimmt` ist die Vorgabe und kein Notausgang — siehe Kopf.
 */
export type FaserRolle = 'tx' | 'rx' | 'unbestimmt'

export const FASER_ROLLE_LABEL = {
  tx: 'TX (sendend)',
  rx: 'RX (empfangend)',
  unbestimmt: 'nicht angegeben',
} satisfies Record<FaserRolle, string>

export const FASER_ROLLEN = Object.keys(FASER_ROLLE_LABEL) as FaserRolle[]

export const istFaserRolle = (v: unknown): v is FaserRolle =>
  typeof v === 'string' && (FASER_ROLLEN as string[]).includes(v)

/**
 * Eine Faser hinter einer Buchse.
 *
 * `position` ist 1-basiert und steht AM Datensatz, nicht in der Reihenfolge
 * der Liste. Dieselbe Lehre wie bei `portGroupRole` und den Port-Nummern:
 * wer sie aus dem Index ableitet, vertauscht Faser 2 und 3, sobald jemand
 * sortiert — und merkt es, wenn das Bild schwarz bleibt.
 */
export interface Faser {
  id: string
  /** 1-basierte Lage in der Buchse. */
  position: number
  rolle: FaserRolle
  /**
   * Der Steckverbinder DIESER Faser am Breakout (LC, SC, MPO-Pin …).
   *
   * Leer heisst „nicht gesagt". Er steht hier und nicht nur am Port, weil
   * ein Breakout genau die Stelle ist, an der sich beides unterscheidet:
   * aussen opticalCON, innen LC.
   */
  connector?: string
  /** Faserklasse dieser Faser, falls sie von der des Ports abweicht. */
  faserklasse?: string
  notiz?: string
}

/**
 * Wie die Fasern zwischen zwei Enden gekreuzt werden.
 *
 * `kreuzt` ist die ganze Aussage: bei einer kreuzenden Methode liegt TX des
 * einen Endes auf RX des anderen, bei einer geraden nicht (dann kreuzt
 * stattdessen das Patchkabel — und zwar irgendwo, wo diese Anlage es
 * festgelegt hat).
 */
export interface Polaritaetsnorm {
  id: string
  name: string
  /** Woher diese Methode stammt. Klartext, kein Verweis. */
  herkunft: string
  kreuzt: boolean
}

/**
 * EINGEBAUTE METHODEN: KEINE. Siehe den Kopf dieser Datei.
 *
 * Wer hier eine eintraegt, traegt die Behauptung ein, sie gelte — und sie
 * beurteilt danach jede Faser jeder Anlage. `tests/fasern.test.ts` haelt die
 * Liste leer und nennt den Grund.
 */
export const EINGEBAUTE_POLARITAETSNORMEN: Polaritaetsnorm[] = []

// ─── DIE PRUEFUNG ──────────────────────────────────────────────────────────

export type FaserBefundArt =
  /** Die Buchse fuehrt mehr Fasern, als gepatcht sind. */
  | 'faser-unbelegt'
  /** Ein Kabelende nennt eine Faser, die es in der Buchse nicht gibt. */
  | 'faser-unbekannt'
  /** Zwei Kabel liegen auf derselben Faser derselben Buchse. */
  | 'faser-doppelt'
  /** Beide Enden senden (oder beide empfangen) — Polaritaet verdreht. */
  | 'polaritaet-verdreht'
  /** Mindestens ein Ende sagt nicht, was es fuehrt. */
  | 'rolle-offen'
  /** Keine Methode gewaehlt — die Polaritaet ist ungeprueft. */
  | 'norm-offen'

export interface FaserBefund {
  art: FaserBefundArt
  portId?: string
  cableId?: string
  /** i18n-Schluessel; `text` ist die englische Quelle und der Rueckfall. */
  schluessel: string
  werte: Platzhalterwerte
  text: string
}

/** Ein Kabelende, wie die Pruefung es sieht. */
export interface FaserBelegung {
  cableId: string
  bezeichnung: string
  /** Die belegte Faser in DIESER Buchse, 1-basiert. Fehlt sie, ist nichts gesagt. */
  position?: number
}

/**
 * Die Befunde EINER Buchse: was liegt darauf, was bleibt frei, was doppelt.
 *
 * Bewusst getrennt von der Polaritaet unten: die eine Frage stellt sich je
 * Buchse, die andere je Kabel. Sie in einen Durchlauf zu legen hiesse, dass
 * eine Buchse ohne Kabel keine Antwort bekommt.
 */
export const breakoutBefunde = (
  port: { id: string; name: string; fasern?: Faser[] },
  belegungen: readonly FaserBelegung[],
): FaserBefund[] => {
  const fasern = port.fasern ?? []
  if (fasern.length === 0) return []
  const befunde: FaserBefund[] = []

  const belegt = new Map<number, string[]>()
  for (const b of belegungen) {
    if (b.position === undefined) continue
    belegt.set(b.position, [...(belegt.get(b.position) ?? []), b.bezeichnung])
  }

  // (1) Doppelt belegt. Der schwerste Befund: zwei Kabel auf einer Faser
  //     sind im Plan zwei Verbindungen und in der Anlage eine.
  for (const [position, namen] of belegt) {
    if (namen.length > 1) {
      befunde.push({
        art: 'faser-doppelt',
        portId: port.id,
        schluessel: 'fibre.strandDuplicate',
        werte: { port: port.name, n: position, cables: namen.join(', ') },
        text: einsetzen(
          '{port}: fibre {n} carries more than one cable ({cables}). In the rack it carries one.',
          { port: port.name, n: position, cables: namen.join(', ') },
        ),
      })
    }
  }

  // (2) Eine Faser, die es nicht gibt.
  const vorhanden = new Set(fasern.map((f) => f.position))
  for (const [position, namen] of belegt) {
    if (!vorhanden.has(position)) {
      befunde.push({
        art: 'faser-unbekannt',
        portId: port.id,
        schluessel: 'fibre.strandUnknown',
        werte: { port: port.name, n: position, cables: namen.join(', ') },
        text: einsetzen(
          '{port}: "{cables}" is on fibre {n}, which this socket does not have.',
          { port: port.name, n: position, cables: namen.join(', ') },
        ),
      })
    }
  }

  // (3) Angefangen und nicht fertig. Das ist der strukturelle Nachbar von
  //     Pruefung 16b: gesteckt, aber nicht vollstaendig. Eine Buchse, an der
  //     NICHTS haengt, ist dagegen kein Befund — sie ist frei.
  const frei = fasern.filter((f) => !belegt.has(f.position))
  if (belegt.size > 0 && frei.length > 0) {
    befunde.push({
      art: 'faser-unbelegt',
      portId: port.id,
      schluessel: 'fibre.strandsUnused',
      werte: {
        port: port.name,
        belegt: fasern.length - frei.length,
        total: fasern.length,
        frei: frei.map((f) => f.position).join(', '),
      },
      text: einsetzen(
        '{port}: {belegt} of {total} fibres are patched - {frei} are not. Planned or forgotten?',
        {
          port: port.name,
          belegt: fasern.length - frei.length,
          total: fasern.length,
          frei: frei.map((f) => f.position).join(', '),
        },
      ),
    })
  }

  return befunde
}

/**
 * Die Polaritaet EINER Verbindung.
 *
 * Ohne gewaehlte Methode gibt es genau einen Befund — `norm-offen` — und
 * ausdruecklich kein Urteil. Schweigen saehe auf dem Blatt aus wie „geprueft
 * und in Ordnung", und das ist es nicht: es ist ungeprueft.
 */
export const polaritaetsBefunde = (
  kabel: { id: string; bezeichnung: string },
  von: { rolle?: FaserRolle } | undefined,
  nach: { rolle?: FaserRolle } | undefined,
  norm: Polaritaetsnorm | undefined,
): FaserBefund[] => {
  if (!von && !nach) return []
  if (!norm) {
    return [
      {
        art: 'norm-offen',
        cableId: kabel.id,
        schluessel: 'fibre.noPolarityMethod',
        werte: { cable: kabel.bezeichnung },
        text: einsetzen(
          '{cable}: no polarity method chosen - the fibre direction is unchecked. Which method applies to this installation is not in the program.',
          { cable: kabel.bezeichnung },
        ),
      },
    ]
  }

  const a = von?.rolle ?? 'unbestimmt'
  const b = nach?.rolle ?? 'unbestimmt'
  if (a === 'unbestimmt' || b === 'unbestimmt') {
    return [
      {
        art: 'rolle-offen',
        cableId: kabel.id,
        schluessel: 'fibre.roleUnstated',
        werte: { cable: kabel.bezeichnung },
        text: einsetzen(
          '{cable}: at least one end does not state whether it sends or receives - the polarity cannot be checked.',
          { cable: kabel.bezeichnung },
        ),
      },
    ]
  }

  // Eine kreuzende Methode verlangt TX gegen RX, eine gerade TX gegen TX:
  // dort kreuzt das Patchkabel, und zwar an einer Stelle, die diese Anlage
  // festgelegt hat und nicht dieses Programm.
  const gekreuzt = a !== b
  if (gekreuzt === norm.kreuzt) return []
  return [
    {
      art: 'polaritaet-verdreht',
      cableId: kabel.id,
      schluessel: 'fibre.polarityTwisted',
      werte: { cable: kabel.bezeichnung, a, b, norm: norm.name },
      text: einsetzen(
        '{cable}: {a} meets {b}, the method "{norm}" expects the other way round. No light will pass.',
        { cable: kabel.bezeichnung, a, b, norm: norm.name },
      ),
    },
  ]
}

// ─── SCHEMA-HEILUNG ────────────────────────────────────────────────────────

export const normalisiereFaser = (roh: unknown, index: number): Faser | undefined => {
  if (!roh || typeof roh !== 'object') return undefined
  const o = roh as Record<string, unknown>
  const position = Number(o.position)
  // Ohne Lage ist die Faser nicht adressierbar — und eine geratene Lage
  // waere genau die Zahl, die spaeter jemand als Angabe liest.
  if (!Number.isInteger(position) || position < 1) return undefined
  return {
    id: typeof o.id === 'string' && o.id ? o.id : `faser-${index}`,
    position,
    rolle: istFaserRolle(o.rolle) ? o.rolle : 'unbestimmt',
    connector: typeof o.connector === 'string' ? o.connector : undefined,
    faserklasse: typeof o.faserklasse === 'string' ? o.faserklasse : undefined,
    notiz: typeof o.notiz === 'string' ? o.notiz : undefined,
  }
}

export const normalisierePolaritaetsnorm = (roh: unknown): Polaritaetsnorm | undefined => {
  if (!roh || typeof roh !== 'object') return undefined
  const o = roh as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  const herkunft = typeof o.herkunft === 'string' ? o.herkunft.trim() : ''
  // Ohne Herkunft ist es keine Norm, sondern eine Behauptung — siehe Kopf.
  if (!id || !name || !herkunft) return undefined
  return { id, name, herkunft, kreuzt: o.kreuzt === true }
}
