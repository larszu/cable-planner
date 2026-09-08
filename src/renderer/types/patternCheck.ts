/**
 * Was jemand VOR DEM MONITOR gesehen hat (B-42, Inkrement 2).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DIE ANDERE HÄLFTE VON „WO KOMMT WAS AN"
 * ═══════════════════════════════════════════════════════════════════════
 *
 * `lib/patternRouting.ts` rechnet das SOLL: wo müsste das Prüfbild laut Plan
 * ankommen. Das braucht keine Anlage und behauptet nichts über die Wirklichkeit.
 *
 * Hier steht das IST — und es kann nur von einem Menschen kommen. Diese App
 * hat keinen Videoeingang; sie sieht nicht, was auf einem Monitor steht.
 * Jemand geht hin, sieht hin und tippt, was er gesehen hat.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM DER GESEHENE NAME EIN EIGENES FELD IST
 * ═══════════════════════════════════════════════════════════════════════
 *
 * „Falsches Bild" allein sagt: irgendetwas stimmt nicht. „Es steht KAMERA 3
 * drauf" sagt WAS nicht stimmt — und weil das Prüfbild den Namen seiner
 * Quelle trägt, ist diese eine Angabe der ganze Unterschied zwischen einem
 * Befund und einer Fehlersuche. `lib/patternDiagnose.ts` macht daraus die
 * Aussage „diese beiden Ausgänge sind vertauscht".
 *
 * FREITEXT und keine Auswahlliste. Auf dem Monitor steht, was draufsteht —
 * womöglich ein Name aus einem älteren Planstand, ein abgeschnittener oder
 * einer, den es im Plan gar nicht gibt. Eine Auswahlliste zwänge den
 * Prüfenden, die Wirklichkeit auf den Plan abzubilden, und genau diese
 * Abbildung ist das, was hier geprüft werden soll.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM ES IM PROJEKT LIEGT — anders als die gewählte Quelle
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Die Wahl der Quelle ist ein Vorgang (`patternStore`, nicht persistiert).
 * Eine Sichtprüfung ist ein BELEG: sie hat einen Zeitpunkt, einen Prüfer und
 * ein Ergebnis, und sie ist die Antwort auf „habt ihr das abgenommen?".
 * Dieselbe Einordnung wie bei `TallyCheck`.
 */

/** Was auf dem Monitor zu sehen war. */
export type PatternObservation =
  /** Das erwartete Bild, mit dem erwarteten Namen. */
  | 'stimmt'
  /**
   * Ein Prüfbild — aber mit einem ANDEREN Namen. Der gesehene Name gehört
   * dazu; ohne ihn ist die Meldung halb so viel wert.
   */
  | 'falsches-bild'
  /** Kein Bild: schwarz, „kein Signal", Rauschen. */
  | 'kein-bild'
  /**
   * An diesem Ort steht gar kein Monitor.
   *
   * Eigener Wert und nicht `kein-bild`, weil es ein Befund über den PLAN ist
   * und nicht über das Signal: der Plan sieht hier eine Ankunft vor, die es
   * nicht gibt. Wer das als „kein Bild" meldete, schickte jemanden auf die
   * Suche nach einem Kabelfehler, den es nicht gibt.
   */
  | 'kein-monitor'

export const PATTERN_OBSERVATION_LABEL = {
  stimmt: 'stimmt',
  'falsches-bild': 'falsches Bild',
  'kein-bild': 'kein Bild',
  'kein-monitor': 'kein Monitor an diesem Ort',
} satisfies Record<PatternObservation, string>

export const PATTERN_OBSERVATIONS = Object.keys(
  PATTERN_OBSERVATION_LABEL,
) as PatternObservation[]

export const istPatternObservation = (v: unknown): v is PatternObservation =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(PATTERN_OBSERVATION_LABEL, v)

/** Eine Sichtprüfung an einem Ankunftsort. */
export interface PatternCheck {
  /** Zeitpunkt (ISO). Kommt von der Uhr des Aufrufers, nie aus der Ableitung. */
  at: string
  /** Die Quelle, deren Bild erwartet wurde (Geräte-Id). */
  quelleId: string
  /** Der Ankunftsort. */
  equipmentId: string
  /** Der Anschluss, wo bekannt — bei einem Monitor mit acht Eingängen zählt er. */
  portId?: string
  gesehen: PatternObservation
  /**
   * Nur bei `falsches-bild`: welcher Name stand auf dem Bild.
   *
   * Ohne ihn bleibt die Meldung „irgendetwas stimmt nicht"; mit ihm wird sie
   * zu „diese beiden sind vertauscht".
   */
  gesehenerName?: string
  /** Wer geprüft hat. Optional — eine Prüfung ohne Namen ist besser als keine. */
  by?: string
  note?: string
}


/** Ein verworfener Datensatz, mit Grund — fuer den Lade-Bericht. */
export interface PatternCheckDrop {
  reason: 'missing-required' | 'dangling-ref'
  label: string
}

/**
 * Die Sichtprüfungen beim Laden normalisieren.
 *
 * ALS EIGENE FUNKTION und nicht als Filter inmitten von
 * `healProjectPositions`: dort wäre sie nur über einen Quelltext-Scan zu
 * prüfen, und ein eingeschleustes `return true` liesse die gescannten Zeilen
 * stehen — unerreichbar, aber sichtbar. Genau diese Falle hat in dieser
 * Sitzung schon zweimal einen Wächter unverdient grün gemacht. Hier ist sie
 * am Verhalten prüfbar.
 *
 * VERWORFEN WIRD, was auf ein Gerät zeigt, das es nicht (mehr) gibt — den
 * Ankunftsort oder die Quelle. Der Datensatz landet im Abnahme-Blatt und
 * stünde dort als GEPRÜFTER Ankunftsort an einem Gerät, das gelöscht wurde,
 * oder für eine Quelle, deren Bild niemand mehr zuordnen kann. Eine Zeile,
 * die aussieht wie eine Abnahme und keine ist, ist teurer als eine fehlende.
 *
 * NICHT STUMM (ADR-005, Regel 3): der Grund sagt, dass das ZIEL weg ist —
 * sonst suchte jemand nach einem fehlenden Pflichtfeld, das nie gefehlt hat.
 */
export const normalisePatternChecks = (
  roh: unknown,
  geraeteIds: ReadonlySet<string>,
  onDrop?: (drop: PatternCheckDrop) => void,
): PatternCheck[] => {
  if (!Array.isArray(roh)) return []
  const raus: PatternCheck[] = []
  for (const c of roh as PatternCheck[]) {
    if (!c || typeof c.at !== 'string' || !c.at || !istPatternObservation(c.gesehen)) {
      onDrop?.({ reason: 'missing-required', label: c?.gesehenerName || '' })
      continue
    }
    if (!geraeteIds.has(c.equipmentId) || !geraeteIds.has(c.quelleId)) {
      onDrop?.({ reason: 'dangling-ref', label: c.gesehenerName || c.at })
      continue
    }
    raus.push(c)
  }
  return raus
}
