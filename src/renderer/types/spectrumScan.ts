// ───────────────────────────────────────────────────────────────────────────
// Der Scan vor Ort, gegen den Plan gehalten (Bedarf 112, P3).
//
//   > Cheap analysers (tinySA, RF Explorer) are widely used for site scans,
//   > but their CSV is not readable by any coordination software, so engineers
//   > run CONVERSION SCRIPTS ON THE CRITICAL PATH OF LOAD-IN.
//
// Belegt an `erikkaashoek/tinySA#88`: dort wird um Export nach Shure WWB,
// Sennheiser WSM, Audio-Technica Wireless Manager und Professional Wireless
// IAS gebeten, weil „the supplied default .csv format is not recognized by any
// of these industry standard softwares".
//
// ─── WAS GEBAUT IST, UND WAS NICHT ─────────────────────────────────────────
//
// GEBAUT ist die LESE-Seite und der Abgleich: die Analyser-CSV einlesen und
// die geplanten Träger dagegen halten. Das ist die Frage, die im Saal
// gestellt wird — „ist meine Frequenz hier frei?" — und sie lässt sich mit
// dem beantworten, was der Plan und die Datei wissen.
//
// NICHT gebaut sind die vier Hersteller-Formate. Für keines liegt in diesem
// Korpus ein Schema vor. Das ist dieselbe Entscheidung wie beim
// Dante-Preset-XML (Bedarf 94), und sie fällt hier zum dritten Mal — was sie
// nicht schwächer macht, sondern zeigt, wo die Grenze dieses Korpus liegt:
// ein Exporter nach Vermutung sähe aus, als könnte er es, und bei einer halb
// verstandenen Frequenzliste fällt das erst auf, wenn im Saal etwas rauscht.
// Ausgegeben wird stattdessen eine Tabelle mit Spaltenlexikon — lesbar für
// den Menschen, importierbar in jedes Tabellenprogramm.
//
// ─── EIN SCAN IST KEIN SENDER ──────────────────────────────────────────────
//
// Der Scan geht bewusst NICHT als Quelle in `spectrumPlan.collectTransmitters`
// ein. Was dort steht, sind Sender mit einer Trägerfrequenz, aus denen die
// Intermodulation gerechnet wird. Eine Messung ist etwas anderes: ein
// Pegelverlauf über ein Band, dessen Spitzen fremde Sender sein können — oder
// eine Reflexion, ein Nachbarkanal, der Analyser selbst. Sie als Sender
// einzuspeisen erzeugte IM3-Produkte aus Rauschen.
// ───────────────────────────────────────────────────────────────────────────

/** Ein Messpunkt: Pegel bei einer Frequenz. */
export interface ScanPoint {
  mhz: number
  /** Pegel in dBm, wie die Datei ihn nennt. */
  dbm: number
}

/** Was gelesen wurde. */
export interface SpectrumScan {
  /** Punkte, aufsteigend nach Frequenz. */
  points: ScanPoint[]
  /**
   * Zeilen, die nicht lesbar waren.
   *
   * Als Zahl und nicht verschwiegen: eine Messung, von der die Hälfte
   * stillschweigend wegfiel, sieht aus wie ein leeres Band.
   */
  unreadable: number
  /** Dateiname, wie ihn der Nutzer gewählt hat — für den Stempel. */
  fileName?: string
}

/**
 * Ab welchem Pegel eine Frequenz als belegt gilt.
 *
 * Vorgabewert und KEINE Wahrheit: was „belegt" heisst, hängt an Antenne,
 * Vorverstärker und Abstand, und keine dieser Angaben steht in der Datei.
 * Deshalb ist die Schwelle ein Eingabefeld und der Wert hier nur der
 * Startpunkt — er liegt bewusst grob in der Mitte zwischen dem Grundrauschen
 * eines tinySA (etwa −100 dBm) und einem nahen Sender (−30 dBm).
 */
export const DEFAULT_OCCUPIED_DBM = -70

/** Was ein geplanter Träger gegenüber der Messung ist. */
export type CarrierVerdict =
  /** Gemessen und unter der Schwelle. */
  | 'clear'
  /** Gemessen und über der Schwelle — da sitzt etwas. */
  | 'occupied'
  /** Ausserhalb des gemessenen Bereichs. Kein Urteil, und das ist der Punkt. */
  | 'not-scanned'

export const VERDICT_LABEL: Readonly<Record<CarrierVerdict, string>> = {
  clear: 'frei gemessen',
  occupied: 'belegt gemessen',
  'not-scanned': 'nicht gemessen',
}
