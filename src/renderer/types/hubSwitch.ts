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
  /** Die Kreuzschiene (Geräte-Id). */
  equipmentId: string
  /** 0-basiert wie im Protokoll. */
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

/** Eine Zeile für das Eingriffs-Protokoll auf Papier. */
export const hubSwitchZeilen = (
  switches: readonly HubSwitch[],
  geraeteName: (id: string) => string,
): { zeitpunkt: string; geraet: string; ausgang: string; eingang: string; wer: string; ergebnis: string }[] =>
  switches.map((s) => ({
    zeitpunkt: s.at,
    geraet: geraeteName(s.equipmentId),
    ausgang: s.outputName.trim() ? `${s.output + 1} (${s.outputName.trim()})` : String(s.output + 1),
    eingang: s.inputName.trim() ? `${s.input + 1} (${s.inputName.trim()})` : String(s.input + 1),
    wer: s.by ?? '',
    ergebnis: s.ok ? 'angenommen' : `abgelehnt: ${s.message ?? ''}`.trim(),
  }))
