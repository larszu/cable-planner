/**
 * Was ein Gerät auf Befehl tut — herstellerneutral gedacht, hersteller-genau
 * ausgeführt (S-2).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DIE DREI SCHICHTEN, UND WARUM ES DREI SIND
 * ═══════════════════════════════════════════════════════════════════════
 *
 *   1. DER PLAN sagt, welcher EINGANGS-ANSCHLUSS auf welchem AUSGANGS-
 *      ANSCHLUSS liegen soll (`plannedCrosspoints`, S-1). Er kennt keine
 *      Protokollnummern und soll auch keine kennen: er überlebt einen
 *      Gerätetausch.
 *   2. DIESE DATEI übersetzt einen Anschluss in die ADRESSE, unter der das
 *      jeweilige Protokoll ihn kennt. Beim Videohub ist das die Position in
 *      der Anschlussliste — das sagt das Protokoll selbst. Beim ATEM ist es
 *      eine Quellen-Nummer, die man dem Gerät abfragen und im Plan festhalten
 *      muss; sie aus der Position zu erraten wäre falsch (Aux-Ausgänge und
 *      Mediaplayer liegen dort in einem ganz anderen Zahlenraum).
 *   3. DER TREIBER im Hauptprozess spricht das Protokoll.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM DAS PROTOKOLL DEKLARIERT WIRD UND NICHT ERKANNT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * `detectDeviceKind` rät die Geräteart aus dem Namen. Für eine Beschriftung
 * ist das in Ordnung; für einen BEFEHL nicht. Ein Gerät namens „Videohub
 * Ersatz" bekäme sonst einen Videohub-Befehl auf Port 9990 geschickt, und
 * was dort in Wahrheit horcht, weiss niemand. ADR-002 verbietet den
 * Namensabgleich genau für diese Richtung.
 *
 * Ohne Erklärung passiert deshalb nichts, und die Oberfläche sagt, dass die
 * Angabe fehlt — statt einen Befehl an ein geratenes Protokoll zu schicken.
 */

/** Die Protokolle, die diese App sprechen kann. */
export type ControlProtocol = 'videohub' | 'atem' | 'text' | 'companion'

/**
 * WOHIN der Befehl geht: an die Anlage oder an einen Prüfstand (S-5).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM DAS EIN EIGENES FELD IST UND NICHT AUS DER ADRESSE FOLGT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Ein Emulator hört auf einer IP wie jedes andere Gerät. Von aussen ist
 * `10.0.0.5` nicht von `127.0.0.1` zu unterscheiden — jedenfalls nicht
 * verlässlich: ein Prüfstand kann im selben Netz stehen, und ein echter
 * Mischer kann über einen Tunnel auf `localhost` liegen. Aus der Adresse zu
 * schliessen, was am anderen Ende hängt, wäre derselbe Fehler wie der
 * Namensabgleich, den ADR-002 verbietet. Also wird es ERKLÄRT.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WAS DARAN HÄNGT: DER BELEG
 * ═══════════════════════════════════════════════════════════════════════
 *
 * `project.hubSwitches` beantwortet „wer hat geschaltet?" — nach einer
 * Sendung, in der etwas Falsches im Bild war, von jemandem, der nicht dabei
 * war. Ein Eintrag aus einer Probe am Emulator sieht dort heute aus wie ein
 * Eingriff an der laufenden Anlage: gleiche Uhrzeit, gleicher Gerätename,
 * gleiche Nummern. Wer den später liest, sucht die Ursache an einer Stelle,
 * an der nie jemand war.
 *
 * Deshalb fährt das Ziel bis auf das Blatt mit. Es ist dieselbe Trennung,
 * die ADR-003 zwischen Beobachtung und Absicht zieht — hier zwischen einem
 * Eingriff und einer Probe.
 */
export type ControlTarget =
  /** Die laufende Anlage. Vorgabe, wenn nichts erklärt ist. */
  | 'device'
  /** Ein Emulator/Prüfstand, der das Protokoll spricht. Kein Signal dahinter. */
  | 'simulator'

export const CONTROL_TARGET_LABEL = {
  device: 'Anlage',
  simulator: 'Prüfstand (Emulator)',
} satisfies Record<ControlTarget, string>

/**
 * Der Satz, der VOR dem Senden dabeisteht.
 *
 * Beim Prüfstand ist er die eigentliche Auskunft: was dort quittiert, ist
 * ein Programm und kein Mischer, und hinter dem geschalteten Ausgang liegt
 * kein Bild. Wer das verwechselt, hält eine gelungene Probe für eine
 * geprüfte Anlage.
 */
export const CONTROL_TARGET_HINWEIS = {
  device: 'Der Befehl geht an das Gerät im Netz. Was danach anders ist, ist die Anlage.',
  simulator:
    'Der Befehl geht an einen Emulator. Er quittiert wie ein Mischer, aber hinter dem geschalteten Ausgang liegt kein Signal — die Probe zeigt, dass der Befehl richtig gebaut ist, und nichts darüber hinaus.',
} satisfies Record<ControlTarget, string>

export const CONTROL_TARGETS = Object.keys(CONTROL_TARGET_LABEL) as ControlTarget[]

export const istControlTarget = (v: unknown): v is ControlTarget =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(CONTROL_TARGET_LABEL, v)

/**
 * Was ein ANSCHLUSS im Protokoll ist.
 *
 * Ein Videohub kennt nur „Eingang" und „Ausgang". Ein Mischer nicht: sein
 * Programm-Ausgang wird über den Mix-Effect angesprochen, ein Aux über eine
 * eigene Bus-Nummer, und ein Preview-Ausgang ist wieder etwas anderes. Diese
 * Unterscheidung steht am ANSCHLUSS, weil sie eine Eigenschaft des
 * Anschlusses ist und nicht des Geräts.
 */
export type ControlRole =
  /** Eine Quelle. `address` ist die Quellen-Nummer des Protokolls. */
  | 'input'
  /** Ein Ausgang einer Kreuzschiene. `address` ist die Ausgangs-Nummer. */
  | 'crosspoint-output'
  /** Der Programm-Bus eines Mischers. `address` ist der Mix-Effect (0-basiert). */
  | 'program'
  /** Der Preview-Bus eines Mischers. `address` ist der Mix-Effect (0-basiert). */
  | 'preview'
  /** Ein Aux-Ausgang eines Mischers. `address` ist die Bus-Nummer (0-basiert). */
  | 'aux'

export const CONTROL_ROLE_LABEL = {
  input: 'Eingang',
  'crosspoint-output': 'Ausgang',
  program: 'Programm',
  preview: 'Vorschau',
  aux: 'Aux',
} satisfies Record<ControlRole, string>

export const CONTROL_ROLES = Object.keys(CONTROL_ROLE_LABEL) as ControlRole[]

export const istControlRole = (v: unknown): v is ControlRole =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(CONTROL_ROLE_LABEL, v)

/** Die Protokoll-Adresse EINES Anschlusses. */
export interface PortControl {
  role: ControlRole
  /** 0-basiert, wie in allen hier unterstützten Protokollen. */
  address: number
}

export interface ProtocolInfo {
  label: string
  /**
   * Der TCP-Port der Steuerung. Fehlt, wo das Protokoll ihn selbst festlegt
   * und die Bibliothek ihn kennt (ATEM: UDP 9910, von `atem-connection`
   * gesetzt) — dann gibt es nichts einzustellen und deshalb auch kein Feld.
   */
  defaultPort?: number
  /**
   * Woher die Adresse eines Anschlusses kommt.
   *
   * `index`  — die Position in der Anschlussliste IST die Nummer. Das ist
   *            keine Bequemlichkeit, sondern die Definition des Protokolls
   *            (Videohub: „VIDEO OUTPUT ROUTING: <output> <input>", beide
   *            0-basiert über die Anschlüsse des Geräts).
   * `declared` — die Nummer steht nirgends im Plan und muss am Anschluss
   *            eingetragen werden. Sie zu erraten wäre der Fehler, den
   *            ADR-002 benennt.
   */
  adressen: 'index' | 'declared'
  /** Welche Anschluss-Rollen dieses Protokoll überhaupt kennt. */
  rollen: ControlRole[]
  /** Was ein Mensch wissen muss, bevor er das Protokoll auswählt. */
  hinweis: string
}

export const PROTOCOL_INFO = {
  videohub: {
    label: 'Blackmagic Videohub',
    defaultPort: 9990,
    adressen: 'index',
    rollen: ['input', 'crosspoint-output'],
    hinweis:
      'Text-Protokoll über TCP. Die Nummern sind die Positionen in der Anschlussliste — das legt das Protokoll selbst so fest, es ist nichts einzutragen.',
  },
  atem: {
    label: 'Blackmagic ATEM',
    adressen: 'declared',
    rollen: ['input', 'program', 'preview', 'aux'],
    hinweis:
      'Der Mischer spricht kein Text-Protokoll; gesendet wird über die ATEM-Bibliothek. Jeder Anschluss braucht seine Nummer am Mischer — die Position in der Liste sagt sie NICHT, weil Aux-Ausgänge und Mediaplayer dort in einem anderen Zahlenraum liegen.',
  },
  companion: {
    label: 'Bitfocus Companion (alle Hersteller, ~500 Module)',
    defaultPort: 8000,
    // Woher die Nummern kommen, entscheidet die Companion-Konfiguration
    // selbst (`nummern: 'position' | 'declared'`) — wie beim Text-Protokoll.
    adressen: 'declared',
    rollen: ['input', 'crosspoint-output'],
    hinweis:
      'Companion spricht das Protokoll, der Plan sagt WAS geschaltet wird. Voraussetzung: eine laufende Companion-Instanz mit dem Modul des Geräts und EINER Schaltfläche, deren Route-Aktion ihre Argumente aus zwei Custom-Variablen zieht. Damit ist jedes Gerät bedienbar, für das es ein Companion-Modul gibt — ohne dass hier ein Protokoll nachgebaut wird.',
  },
  text: {
    label: 'Erklärtes Text-Protokoll (Ross, Panasonic, Roland, Quartz …)',
    defaultPort: 0,
    // Woher die Nummern kommen, entscheidet die Konfiguration selbst
    // (`nummern: 'position' | 'declared'`) — deshalb steht hier weder das
    // eine noch das andere fest. `declared` ist die vorsichtigere Angabe:
    // sie verlangt nichts, was nicht eingetragen ist.
    adressen: 'declared',
    rollen: ['input', 'crosspoint-output'],
    hinweis:
      'Für jedes Gerät, das zeilenorientierten Text über TCP versteht. Die Form der Zeile, das Zeilenende und die Zählweise stehen im Handbuch des Geräts und werden hier eingetragen — geraten wird nichts, und vor dem Senden steht der Text wortwörtlich im Dialog.',
  },
} satisfies Record<ControlProtocol, ProtocolInfo>

export const CONTROL_PROTOCOLS = Object.keys(PROTOCOL_INFO) as ControlProtocol[]

export const istControlProtocol = (v: unknown): v is ControlProtocol =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(PROTOCOL_INFO, v)

/**
 * Ein fertiger Befehl an EIN Gerät.
 *
 * `vorschau` ist das, was der Mensch vor dem Bestätigen liest — beim
 * Videohub der wortwörtlich gesendete Text, beim ATEM der Aufruf mit seinen
 * Argumenten. Die beiden sind NICHT dasselbe, und die Oberfläche sagt das:
 * ein „gesendeter Text" für ein Binärprotokoll wäre eine Erfindung.
 */
export type ControlActionBody =
  | {
      protocol: 'companion'
      equipmentId: string
      equipmentName: string
      host: string
      port: number
      vorschau: string
      art: 'companion'
      /** Die Aufrufe in der Reihenfolge, in der sie gehen MÜSSEN. */
      schritte: {
        method: 'POST'
        pfad: string
        zweck: string
        abbruchBeiFehler: true
      }[]
    }
  | {
      protocol: 'text'
      equipmentId: string
      equipmentName: string
      host: string
      port: number
      /** Die LESBARE Form — Steuerzeichen benannt. Siehe `lesbar`. */
      vorschau: string
      art: 'text-vorlage'
      /** Was wirklich über die Leitung geht. */
      rohtext: string
      /** Teilzeichenkette, die als Bestätigung gilt. Leer = keine erwartet. */
      quittung?: string
    }
  | {
      protocol: 'videohub'
      equipmentId: string
      equipmentName: string
      host: string
      port: number
      /** Der wortwörtlich gesendete Block. */
      vorschau: string
      art: 'text'
      punkte: { output: number; input: number }[]
    }
  | {
      protocol: 'atem'
      equipmentId: string
      equipmentName: string
      host: string
      vorschau: string
      art: 'aufruf'
      befehle: AtemBefehl[]
    }

/**
 * Ein fertiger Befehl MIT seinem Ziel (S-5).
 *
 * Das Ziel steht nicht in den einzelnen Bauteilen oben, sondern wird an
 * EINER Stelle angeheftet: in `controlActions`, aus `device.controlTarget`.
 * Das ist Absicht. Bei fünfzehn Bauplätzen — vier Protokolle, jedes mit
 * mehreren Rückgabepunkten — wäre ein vergessener still auf „Anlage"
 * gefallen, und genau das ist die Verwechslung, gegen die dieses Feld
 * gebaut ist. So gibt es nur einen Ort, an dem es vergessen werden kann,
 * und dort ist es ein Übersetzungsfehler.
 */
export type ControlAction = ControlActionBody & { target: ControlTarget }

/** Ein einzelner ATEM-Befehl, so wie ihn die Bibliothek kennt. */
export type AtemBefehl =
  | { kind: 'program'; me: number; source: number }
  | { kind: 'preview'; me: number; source: number }
  | { kind: 'aux'; bus: number; source: number }
  | { kind: 'cut'; me: number }

export const ATEM_BEFEHL_LABEL = {
  program: 'Programm',
  preview: 'Vorschau',
  aux: 'Aux',
  cut: 'Schnitt',
} satisfies Record<AtemBefehl['kind'], string>
