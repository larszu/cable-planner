/**
 * Was der Canvas an einer Kante ZEIGEN DARF — Signalfluss, Tally,
 * Verbindungszustand (Eigentümer-Entscheidung vom 2026-09-08).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DIE EINE REGEL, aus der alles andere folgt
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Eine Animation, die aussieht wie fließendes Signal, IST eine Aussage über
 * die Anlage. Läuft sie ohne Beleg, ist sie die teuerste Sorte Falschaussage:
 * niemand liest daneben eine Zahl, niemand klickt auf ein Warndreieck, man
 * sieht nur, dass es fließt — und glaubt es. Genau das verbietet ADR-003 für
 * unbestätigten Zustand, und genau das ist die Bedingung, unter der E-23 den
 * eingehenden Weg zulässt.
 *
 * Deshalb kennt diese Datei **zwei Betriebsarten und keine dritte**:
 *
 *   SCHEMA — der geplante Weg. Sie sagt aus, was gesteckt sein SOLL, und
 *            behauptet nichts über die Anlage. Sie ist die Vorgabe und der
 *            Rückfall (Eigentümer: „auf Schema zurückfallen").
 *
 *   LIVE   — eine BEOBACHTUNG mit Zeitpunkt und Quelle, aus derselben Spur,
 *            die `asBuilt.ts` führt (`ReadingSource`). Kein zweites Modell
 *            neben dem, das E-4 schon entschieden hat.
 *
 * Der Wechsel zwischen beiden ist nie stillschweigend: `liveFreshness` sagt,
 * ob Live gilt, und wie alt die letzte Meldung ist. Wer diese Funktion
 * umgeht, hat die Regel umgangen.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM DER ZUSTAND NICHT DIE FARBE ÄNDERT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Die Farbe gehört dem LAYER (Video blau, Audio rot, Control gelb, Netz
 * grün, Strom violett) — das ist die Legende, nach der der Plan gelesen und
 * gedruckt wird. Würde der Zustand sie überschreiben, hieße dieselbe Farbe
 * an zwei Kanten zweierlei, und die gedruckte Legende wäre falsch.
 *
 * Der Zustand trägt deshalb die BEWEGUNG: es fließt oder es fließt nicht.
 * Die einzige Ausnahme ist `down` — eine Strecke, die beobachtet AUS ist,
 * wird gedämpft und gestrichelt gezeichnet, weil „vorhanden, aber tot" sich
 * von „vorhanden" unterscheiden muss und Stillstand allein dafür zu leise
 * ist. `down` gibt es nur mit Beleg; im Schema kommt es nie vor.
 */

import type { Cable } from '../types/cable'
import type { ReadingSource } from './asBuilt'

/**
 * Wie frisch eine Beobachtung sein muss, um noch als „jetzt" zu gelten.
 *
 * Fünf Sekunden, weil das die Größenordnung ist, in der sich ein
 * Mischer-Zustand ändert (ein Schnitt dauert Bruchteile davon). Länger
 * hieße, einen alten Zustand als aktuellen zu zeigen; kürzer hieße, bei
 * jedem Netz-Schluckauf ins Schema zu fallen und wieder zurück — ein
 * flackernder Canvas ist unbrauchbarer als ein ehrlich veralteter.
 */
export const LIVE_STALE_AFTER_MS = 5000

/**
 * Beobachteter Zustand einer Strecke. Nur mit Beleg.
 *
 * `carrying` und `routed` sind ausdrücklich ZWEI Aussagen und keine Nuance
 * derselben. Ein Videohub meldet seine Kreuzpunkte — er sagt, dass er diesen
 * Eingang auf diesen Ausgang durchschaltet, und NICHTS darüber, ob dort
 * Signal anliegt. Das als `carrying` zu melden wäre die Falschaussage, gegen
 * die diese ganze Datei gebaut ist: der Kreuzpunkt steht auch dann, wenn
 * upstream die Kamera aus ist.
 */
export type LinkState =
  /** Signal liegt an — von einer Quelle, die Signal wirklich erkennt. */
  | 'carrying'
  /** Der Router führt diese Strecke. Über anliegendes Signal sagt er nichts. */
  | 'routed'
  /** Verbindung steht, es läuft nichts darüber. */
  | 'idle'
  /** Keine Verbindung. */
  | 'down'

export interface LiveLink {
  cableId: string
  state: LinkState
  /** Wann beobachtet (Epoch-Millisekunden). */
  at: number
  source: ReadingSource
}

/** Der Zustand, den jeder auf der Fläche sucht. */
export type TallyState = 'program' | 'preview' | 'off'

export interface LiveTally {
  equipmentId: string
  state: TallyState
  at: number
  source: ReadingSource
}

/**
 * Was gerade an Beobachtungen vorliegt.
 *
 * `lastContactAt` ist bewusst getrennt von den Einträgen: eine Anlage, die
 * verbunden ist und nichts zu melden hat, unterscheidet sich von einer, zu
 * der die Verbindung abgerissen ist. Ohne dieses Feld sähen beide gleich
 * aus — und der Canvas zeigte den letzten Stand als den jetzigen.
 */
export interface LiveSnapshot {
  links: readonly LiveLink[]
  tally: readonly LiveTally[]
  lastContactAt?: number
}

export const EMPTY_LIVE: LiveSnapshot = { links: [], tally: [] }

export interface Freshness {
  /** Gilt Live gerade? */
  live: boolean
  /** Alter der letzten Meldung in Millisekunden. `null` = nie Kontakt. */
  ageMs: number | null
}

/**
 * Gilt Live, und wie alt ist die letzte Meldung?
 *
 * DIE EINZIGE STELLE, an der über den Betriebsart-Wechsel entschieden wird.
 * Ein zweiter Ort mit eigener Frist wäre eine zweite Wahrheit über
 * „gerade" — und die eine, die am längsten wartet, gewönne still.
 */
export const liveFreshness = (
  snapshot: LiveSnapshot | null | undefined,
  now: number,
  staleAfterMs: number = LIVE_STALE_AFTER_MS,
): Freshness => {
  const at = snapshot?.lastContactAt
  if (typeof at !== 'number') return { live: false, ageMs: null }
  const ageMs = Math.max(0, now - at)
  return { live: ageMs <= staleAfterMs, ageMs }
}

/** Woher die Darstellung einer Kante stammt. */
export type FlowKind =
  /** Der geplante Weg. Keine Aussage über die Anlage. */
  | 'schema'
  /** Beobachtet: Signal liegt an. */
  | 'live-carrying'
  /** Beobachtet: der Router führt die Strecke — über Signal ist nichts bekannt. */
  | 'live-routed'
  /** Beobachtet: Verbindung steht, kein Signal. */
  | 'live-idle'
  /** Beobachtet: keine Verbindung. */
  | 'live-down'

export interface EdgeFlow {
  kind: FlowKind
  /** Fließt die Animation? */
  animate: boolean
  /** `1` = Quelle → Ziel, `-1` = umgekehrt. */
  direction: 1 | -1
  /** Gedämpft und gestrichelt zeichnen (nur `live-down`). */
  dimmed: boolean
  /** Alter der Beobachtung in ms. `null` im Schema. */
  ageMs: number | null
  /** Woher die Beobachtung kam. Fehlt im Schema. */
  source?: ReadingSource
}

export interface FlowOptions {
  /** Bewegung überhaupt zeigen? Kommt aus Einstellung + `prefers-reduced-motion`. */
  motion: boolean
  /** Frist, ab der eine Beobachtung nicht mehr „jetzt" ist. */
  staleAfterMs?: number
}

/**
 * Wie diese Kante zu zeichnen ist.
 *
 * SCHEMA ANIMIERT AUCH — aber es behauptet damit nichts: dort bedeutet die
 * Bewegung „hier ist ein Weg vorgesehen, und er läuft in diese Richtung".
 * Das ist derselbe Inhalt, den der Pfeil an der Kante schon trägt, nur
 * lesbarer. Die Unterscheidung zur Live-Aussage macht nicht die Bewegung,
 * sondern die Betriebsart-Anzeige am Canvas — und die ist Pflicht, nicht
 * Zierde.
 */
export const edgeFlow = (
  cable: Pick<Cable, 'id' | 'bidirectional'>,
  snapshot: LiveSnapshot | null | undefined,
  now: number,
  opts: FlowOptions,
): EdgeFlow => {
  const staleAfterMs = opts.staleAfterMs ?? LIVE_STALE_AFTER_MS
  // Bidirektionale Strecken haben keine „eine" Richtung; sie laufen in der
  // Zeichenrichtung, weil eine erfundene Gegenrichtung eine Aussage waere.
  const direction: 1 | -1 = 1

  const { live } = liveFreshness(snapshot, now, staleAfterMs)
  if (!live) {
    return { kind: 'schema', animate: opts.motion, direction, dimmed: false, ageMs: null }
  }

  const eintrag = snapshot?.links.find((l) => l.cableId === cable.id)
  if (!eintrag) {
    // Live gilt, aber ueber DIESE Strecke ist nichts bekannt. Das ist kein
    // „aus" — es ist keine Aussage, und die richtige Darstellung dafuer ist
    // das Schema. Sie hier als tot zu zeichnen waere eine Behauptung ueber
    // ein Kabel, das niemand gemessen hat.
    return { kind: 'schema', animate: opts.motion, direction, dimmed: false, ageMs: null }
  }

  const ageMs = Math.max(0, now - eintrag.at)
  if (ageMs > staleAfterMs) {
    // Der Gesamtkontakt ist frisch, diese eine Meldung nicht. Auch hier:
    // Schema, nicht der alte Wert.
    return { kind: 'schema', animate: opts.motion, direction, dimmed: false, ageMs: null }
  }

  switch (eintrag.state) {
    case 'carrying':
      return {
        kind: 'live-carrying',
        animate: opts.motion,
        direction,
        dimmed: false,
        ageMs,
        source: eintrag.source,
      }
    case 'routed':
      // Bewegt sich wie `carrying`: der Router SCHALTET diese Strecke durch,
      // das ist ein Weg und kein Stillstand. Der Unterschied steckt in `kind`
      // und wird dort gelesen, wo er etwas aendert — nicht in der Bewegung,
      // die sonst dreierlei bedeutete.
      return {
        kind: 'live-routed',
        animate: opts.motion,
        direction,
        dimmed: false,
        ageMs,
        source: eintrag.source,
      }
    case 'idle':
      // Steht, fliesst nicht. Bewegung waere hier die Falschaussage.
      return {
        kind: 'live-idle',
        animate: false,
        direction,
        dimmed: false,
        ageMs,
        source: eintrag.source,
      }
    case 'down':
      return {
        kind: 'live-down',
        animate: false,
        direction,
        dimmed: true,
        ageMs,
        source: eintrag.source,
      }
  }
}

/**
 * Tally eines Geräts. `null` heißt „keine Aussage" und ist ausdrücklich
 * NICHT dasselbe wie „aus": eine Kamera ohne Meldung darf nicht wie eine
 * aussehen, von der bekannt ist, dass sie nicht auf Sendung ist.
 */
export const tallyOf = (
  equipmentId: string,
  snapshot: LiveSnapshot | null | undefined,
  now: number,
  staleAfterMs: number = LIVE_STALE_AFTER_MS,
): { state: TallyState; ageMs: number } | null => {
  const { live } = liveFreshness(snapshot, now, staleAfterMs)
  if (!live) return null
  const eintrag = snapshot?.tally.find((t) => t.equipmentId === equipmentId)
  if (!eintrag) return null
  const ageMs = Math.max(0, now - eintrag.at)
  if (ageMs > staleAfterMs) return null
  return { state: eintrag.state, ageMs }
}

/**
 * Die Kette vom Tally-Gerät zum Mischer einfärben (Eigentümer-Wunsch:
 * „Rot/Grün an Kamera-Knoten UND an der Kette bis zum Mischer").
 *
 * Nur ÜBER BEKANNTE KABEL, und nur vorwärts: die Kette folgt den Kabeln
 * ab dem Gerät, dessen Tally gemeldet ist. Ein Weg, den der Plan nicht
 * kennt, wird nicht erfunden — dann endet die Kette dort, und das ist die
 * wahrheitsgemäße Darstellung.
 *
 * Der Zyklus-Schutz ist kein Luxus: ein Rückweg im Plan (Mischer → Monitor
 * → Mischer) ist eine gewöhnliche Verkabelung, und ohne `gesehen` liefe das
 * Einfärben endlos.
 */
export const tallyChain = (
  startEquipmentId: string,
  cables: readonly Pick<Cable, 'id' | 'fromEquipmentId' | 'toEquipmentId'>[],
  maxHops = 8,
): Set<string> => {
  const kanten = new Set<string>()
  const gesehen = new Set<string>([startEquipmentId])
  let front = [startEquipmentId]
  for (let hop = 0; hop < maxHops && front.length; hop++) {
    const naechste: string[] = []
    for (const eq of front) {
      for (const c of cables) {
        if (c.fromEquipmentId !== eq) continue
        kanten.add(c.id)
        if (!gesehen.has(c.toEquipmentId)) {
          gesehen.add(c.toEquipmentId)
          naechste.push(c.toEquipmentId)
        }
      }
    }
    front = naechste
  }
  return kanten
}
