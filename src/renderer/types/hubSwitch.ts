/**
 * Was an der Anlage GESCHALTET wurde (B-42, Inkrement 3).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DIE DRITTE SORTE AUSSAGE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Der Prüfbild-Rundgang kennt bisher zwei:
 *
 *   SOLL — was der Plan vorsieht (`lib/patternRouting.ts`). Rechnung.
 *   IST  — was jemand vor dem Monitor gesehen hat (`PatternCheck`). Beobachtung.
 *
 * Hier kommt die dritte dazu: ein EINGRIFF. Nicht gerechnet und nicht
 * beobachtet, sondern getan — die App hat einer laufenden Kreuzschiene einen
 * Befehl geschickt, und danach war die Anlage eine andere.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM ER IM PROJEKT LIEGT UND NICHT IM EREIGNIS-PROTOKOLL
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Das Ereignis-Protokoll (`logs:*`) ist an die Sitzung gebunden und
 * verschwindet mit ihr. Die Frage, die diesen Datensatz braucht, kommt aber
 * später und von jemand anderem: „wer hat den Ausgang umgeschaltet, und
 * wann?" — nach einer Sendung, in der etwas Falsches im Bild war. Ein
 * Eingriff mit Zeitpunkt und Verursacher ist ein BELEG, dieselbe Einordnung
 * wie `TallyCheck` und `PatternCheck`, und Belege stehen im Projekt.
 *
 * NICHT ins Dokument-Register (`documentLog:*`). Das war der erste Gedanke
 * und war falsch: dort steht, welches BLATT mit welchem Planstand ausgegeben
 * wurde, und jeder Eintrag trägt einen `stand`, an dem später hängt, ob er
 * noch gilt. Ein Kreuzpunkt-Befehl ist kein ausgegebenes Dokument; er dort
 * einzutragen hiesse, das Register mit einer zweiten Bedeutung zu belegen,
 * und die Frage „welches meiner ausgeteilten Blätter ist hin?" bekäme
 * Antworten, die keine Blätter sind.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM DER DATENSATZ DEN PLAN NICHT ANFASST (ADR-001)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * `videohubRouting.planned` bleibt beim Schalten unverändert — auch dann,
 * wenn gerade genau der geplante Kreuzpunkt gesetzt wurde. Der Plan ist die
 * Absicht; was an der Anlage steht, ist ein Zustand. Sie beim Senden
 * gleichzuziehen wäre bequem und würde die eine Frage unbeantwortbar machen,
 * für die es den Plan gibt: weicht die Anlage von ihm ab?
 *
 * Aus demselben Grund trägt der Datensatz auch KEIN „vorher" aus dem Plan.
 * Was vor dem Befehl an diesem Ausgang stand, weiss die App nur, wenn sie
 * den Hub gelesen hat; hat sie nicht gelesen, bleibt `vorher` leer, und das
 * ist die richtige Auskunft. Ein aus dem Plan erfundener Vorher-Wert stünde
 * hinterher im Beleg wie eine Messung.
 */

/** Ein gesendeter Kreuzpunkt-Befehl. */
export interface HubSwitch {
  /** Zeitpunkt (ISO). Kommt von der Uhr des Aufrufers, nie aus der Ableitung. */
  at: string
  /** Die Kreuzschiene oder der Mischer (Geräte-Id). */
  equipmentId: string
  /**
   * Welches Protokoll gesprochen wurde (S-2).
   *
   * Fehlt bei Einträgen aus der Zeit, als es nur den Videohub gab — und
   * genau das waren sie. `videohubSwitch` liest das Fehlen deshalb als
   * „Videohub" und nicht als „unbekannt": eine Migration, die den Wert
   * nachträgt, behauptete etwas über Dateien, die sie nicht kennt, während
   * die Auslassung selbst die Tatsache ist.
   *
   * Warum es überhaupt zählt: die Anzeige zählt beim Videohub ab 1 (Ausgang
   * 0 im Protokoll heisst „Ausgang 1" am Gerät), beim ATEM nicht — dort ist
   * Eingang 1 schon die Quelle 1. Ohne diese Angabe stünde im Protokoll
   * irgendwann „Quelle 2", wo der Mischer 1 bekommen hat.
   */
  protocol?: import('./switcherControl').ControlProtocol
  /**
   * WOHIN der Befehl ging: an die Anlage oder an einen Pruefstand (S-5).
   *
   * Fehlt bei Eintraegen aus der Zeit vor dem Feld — und das waren
   * ausnahmslos Eingriffe an der Anlage, weil es einen Pruefstand nicht gab.
   * Gelesen wird das Fehlen deshalb als `'device'`; eine Migration, die den
   * Wert nachtruege, behauptete etwas ueber Dateien, die sie nicht kennt,
   * waehrend die Auslassung selbst die Tatsache ist. Dieselbe Ueberlegung
   * wie bei `protocol` darueber.
   *
   * WARUM ER UEBERHAUPT IM BELEG STEHT. Die Frage, die diesen Datensatz
   * braucht, kommt spaeter und von jemand anderem: „wer hat den Ausgang
   * umgeschaltet?" Eine Probe am Emulator saehe dort sonst aus wie ein
   * Eingriff an der laufenden Anlage — gleiche Uhrzeit, gleicher
   * Geraetename, gleiche Nummern —, und wer den liest, sucht die Ursache an
   * einer Stelle, an der nie jemand war.
   */
  target?: import('./switcherControl').ControlTarget
  /**
   * Was gesendet wurde, in einer Zeile — der Block-Inhalt beim Videohub, der
   * Aufruf mit Argumenten beim ATEM. Das ist die Angabe, die den Eintrag
   * nach einem Gerätetausch noch lesbar macht: Nummern allein sagen nichts
   * mehr, wenn die Anschlüsse anders zählen.
   */
  befehl?: string
  /** 0-basiert wie im jeweiligen Protokoll. Beim ATEM: Bus und Quellen-Nummer. */
  output: number
  input: number
  /** Die Namen, wie sie beim Bestätigen auf dem Schirm standen. */
  outputName: string
  inputName: string
  /**
   * Der gelesene Ist-Zustand dieses Ausgangs VOR dem Befehl, wenn er gelesen
   * wurde. Fehlt, wenn nicht gelesen — und wird dann nicht aus dem Plan
   * ersetzt.
   */
  vorher?: number
  /** Die Quelle, um deren Prüfbild-Weg es ging. Optional. */
  quelleId?: string
  /** Wer geschaltet hat. Optional — ein Eintrag ohne Namen ist besser als keiner. */
  by?: string
  /** Hat die Kreuzschiene den Befehl angenommen? */
  ok: boolean
  /** Was sie geantwortet hat, oder warum es scheiterte. */
  message?: string
}

/** Ein verworfener Datensatz, mit Grund — fuer den Lade-Bericht. */
export interface HubSwitchDrop {
  reason: 'missing-required' | 'dangling-ref'
  label: string
}

/**
 * Die Schaltvorgänge beim Laden normalisieren.
 *
 * ALS EIGENE FUNKTION und nicht als Filter inmitten von
 * `healProjectPositions` — aus demselben Grund wie bei
 * `normalisePatternChecks`: ein Filter dort wäre nur über einen
 * Quelltext-Scan prüfbar, und ein eingeschleustes frühes `return` liesse die
 * gescannten Zeilen stehen, ohne dass sie noch liefen.
 *
 * VERWORFEN WIRD, was auf eine Kreuzschiene zeigt, die es nicht mehr gibt.
 * Anders als bei der Sichtprüfung ist das hier nicht bloss unschön: der
 * Eintrag ist die Antwort auf „wer hat geschaltet?", und eine Antwort, die
 * auf ein gelöschtes Gerät zeigt, schickt die Suche in die Irre.
 *
 * `ok` wird geprüft, weil ein Eintrag ohne Ergebnis nicht sagt, ob der
 * Befehl überhaupt angekommen ist — und dann als Eingriff gelesen würde, den
 * es womöglich nie gab.
 */
export const normaliseHubSwitches = (
  roh: unknown,
  geraeteIds: ReadonlySet<string>,
  onDrop?: (drop: HubSwitchDrop) => void,
): HubSwitch[] => {
  if (!Array.isArray(roh)) return []
  const raus: HubSwitch[] = []
  for (const s of roh as HubSwitch[]) {
    const zahlenOk =
      Number.isInteger(s?.output) && s.output >= 0 && Number.isInteger(s?.input) && s.input >= 0
    if (!s || typeof s.at !== 'string' || !s.at || typeof s.ok !== 'boolean' || !zahlenOk) {
      onDrop?.({ reason: 'missing-required', label: s?.outputName || '' })
      continue
    }
    if (!geraeteIds.has(s.equipmentId)) {
      onDrop?.({ reason: 'dangling-ref', label: s.outputName || s.at })
      continue
    }
    raus.push(s)
  }
  return raus
}

/**
 * Wie eine Protokoll-Nummer auf dem Blatt steht.
 *
 * Beim Videohub zählt die Anzeige ab 1: Ausgang 0 im Protokoll ist der, auf
 * dem am Gerät „1" steht. Beim ATEM NICHT — dort ist Eingang 1 bereits die
 * Quelle 1, und ein aufaddiertes Eins machte aus Kamera 1 die Kamera 2.
 *
 * Ein fehlendes `protocol` heisst „Videohub": so waren alle Einträge, die
 * geschrieben wurden, bevor es ein zweites Protokoll gab.
 */
const nummer = (wert: number, protocol: HubSwitch['protocol']): string =>
  protocol === undefined || protocol === 'videohub' ? String(wert + 1) : String(wert)

const feld = (wert: number, name: string, protocol: HubSwitch['protocol']): string => {
  const n = nummer(wert, protocol)
  return name.trim() ? `${n} (${name.trim()})` : n
}

/** Eine Zeile für das Eingriffs-Protokoll auf Papier. */
export const hubSwitchZeilen = (
  switches: readonly HubSwitch[],
  geraeteName: (id: string) => string,
): {
  zeitpunkt: string
  geraet: string
  ausgang: string
  eingang: string
  befehl: string
  wer: string
  ergebnis: string
  /** „Anlage" oder „Prüfstand" — siehe `HubSwitch.target`. */
  ziel: string
}[] =>
  switches.map((s) => ({
    zeitpunkt: s.at,
    geraet: geraeteName(s.equipmentId),
    ausgang: feld(s.output, s.outputName, s.protocol),
    eingang: feld(s.input, s.inputName, s.protocol),
    befehl: s.befehl ?? '',
    wer: s.by ?? '',
    ergebnis: s.ok ? 'angenommen' : `abgelehnt: ${s.message ?? ''}`.trim(),
    // Auf dem BLATT, nicht nur im Datensatz. Ein Eingriffs-Protokoll, das
    // eine Probe am Pruefstand nicht als solche ausweist, ist genau die
    // falsche Auskunft, wegen der jemand an der Anlage sucht.
    ziel: s.target === 'simulator' ? 'Prüfstand' : 'Anlage',
  }))
