/**
 * Das ERKLÄRTE Text-Protokoll (S-3).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM ES DAS GIBT — UND WARUM ES NICHT ZWANZIG HERSTELLER-TREIBER SIND
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Der Auftrag lautete, „alle am Markt üblichen Mischer und Kreuzschienen"
 * schaltbar zu machen. Der naheliegende Weg wäre ein Treiber je Hersteller —
 * Ross, Panasonic, Roland, Sony, Evertz, Grass Valley, und so weiter.
 *
 * Der Weg wurde nicht genommen, und zwar aus einem Grund, der schwerer wiegt
 * als Aufwand: **ein Befehl, dessen Syntax geraten ist, geht an eine laufende
 * Anlage.** Für die meisten dieser Protokolle liegt die verbindliche
 * Beschreibung im Handbuch des Geräts. Wer sie aus dem Gedächtnis oder aus
 * einer fremden Umsetzung abschreibt, baut eine Zusicherung, die niemand
 * geprüft hat — genau die Sorte Fehler, gegen die Invariante 17 geschrieben
 * ist. (Beim Nachsehen fand sich dafür sofort ein Beispiel: eine verbreitete
 * Umsetzung für einen Bildmischer hängt an ihre Befehle ein Semikolon an,
 * das im Befehl schon steht. Wer sie abschreibt, schreibt den Fehler mit ab.)
 *
 * Die gute Nachricht: fast alle diese Protokolle sind ZEILENORIENTIERTER TEXT
 * über TCP. Sie unterscheiden sich in der Form der Zeile, im Zeilenende, in
 * einem Vorzeichen und darin, ob ab 0 oder ab 1 gezählt wird. Das sind vier
 * Angaben — und die stehen im Handbuch, das der Nutzer neben dem Gerät liegen
 * hat.
 *
 * Also trägt er sie ein. Die App rät nichts, zeigt vor dem Senden den
 * wortwörtlichen Text und schickt genau ihn. Damit ist jedes textgesteuerte
 * Gerät bedienbar — auch eines, das es noch nicht gibt —, ohne dass ein
 * einziges Byte erfunden wird.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WAS DAS NICHT IST
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Kein Ersatz für einen richtigen Treiber, wo einer möglich ist. Der ATEM
 * spricht kein Text-Protokoll, der Videohub braucht seine ACK-Zählung — beide
 * haben deshalb ihren eigenen. Wo eine verbindliche Beschreibung vorliegt,
 * gehört ein eigener Treiber hierher und nicht eine Vorlage.
 *
 * REIN: keine Uhr, kein Store, kein IO.
 */

/** Was am Ende einer Befehlszeile steht. */
export type ZeilenEnde = 'cr' | 'crlf' | 'lf'

export const ZEILEN_ENDE = {
  cr: { label: 'CR', text: '\r' },
  crlf: { label: 'CR LF', text: '\r\n' },
  lf: { label: 'LF', text: '\n' },
} satisfies Record<ZeilenEnde, { label: string; text: string }>

/** Was VOR einer Befehlszeile steht. */
export type ZeilenAnfang = 'none' | 'stx'

export const ZEILEN_ANFANG = {
  none: { label: 'nichts', text: '' },
  stx: { label: 'STX (0x02)', text: '\u0002' },
} satisfies Record<ZeilenAnfang, { label: string; text: string }>

/** Woher die Nummern eines Anschlusses kommen. */
export type NummernHerkunft =
  /**
   * Die Position in der Anschlussliste, plus `basis`.
   *
   * Das ist KEIN Raten: der Nutzer erklärt damit die Regel „mein Gerät zählt
   * seine Anschlüsse in derselben Reihenfolge wie der Plan". Für eine
   * Kreuzschiene trifft das fast immer zu, und die Alternative wäre, vierzig
   * Nummern von Hand einzutragen — eine Zumutung, die dazu führt, dass es
   * niemand tut.
   */
  | 'position'
  /** Je Anschluss eingetragen (`Port.control.address`). */
  | 'declared'

export interface TextProtocolConfig {
  /**
   * Die Zeile, mit Platzhaltern. Pflicht sind `{out}` und `{in}`.
   *
   * Beispiel (Quartz/Evertz): `.S{level}{out},{in}`
   */
  vorlage: string
  anfang: ZeilenAnfang
  ende: ZeilenEnde
  /** Zählt das Gerät seine Anschlüsse ab 0 oder ab 1? */
  basis: 0 | 1
  nummern: NummernHerkunft
  /** Der Wert für `{level}`, wo das Protokoll eine Ebene kennt. */
  level?: string
  /**
   * Teilzeichenkette, die als Bestätigung gilt (z. B. `ACK`).
   *
   * Leer heisst: das Gerät antwortet nicht, und der Treiber wartet nicht auf
   * eine Antwort. Das ist eine ANGABE und keine Vermutung — wer hier nichts
   * einträgt, bekommt „gesendet" als Ergebnis und nicht „bestätigt", und
   * dieser Unterschied steht so auf dem Beleg.
   */
  quittung?: string
}

export const LEERE_TEXT_KONFIG: TextProtocolConfig = {
  vorlage: '',
  anfang: 'none',
  ende: 'cr',
  basis: 1,
  nummern: 'position',
}

/**
 * Eine mitgelieferte Vorlage — mit ihrer HERKUNFT.
 *
 * Die Herkunft steht dabei, weil sie den Unterschied macht: eine Vorlage aus
 * einer verbreiteten Umsetzung ist ein guter Startpunkt und KEINE Zusicherung.
 * Wer sie nimmt, prüft sie gegen sein Handbuch — die Oberfläche sagt das, und
 * der Dialog zeigt vor dem Senden den wortwörtlichen Text.
 *
 * Hier steht bewusst nur, wofür es einen nachprüfbaren Beleg gab. Eine
 * Vorlage aus dem Gedächtnis wäre schlimmer als keine: sie sieht aus wie
 * geprüftes Wissen und ist eine Vermutung, die als Befehl rausgeht.
 */
export interface TextVorlage {
  id: string
  label: string
  config: TextProtocolConfig
  port: number
  /** Woher die Form stammt. Nie „vom Hersteller", wenn sie es nicht ist. */
  herkunft: string
}

export const TEXT_VORLAGEN: TextVorlage[] = [
  {
    id: 'quartz',
    label: 'Quartz / Evertz — Kreuzpunkt setzen',
    config: {
      vorlage: '.S{level}{out},{in}',
      anfang: 'none',
      ende: 'cr',
      basis: 1,
      nummern: 'position',
      level: 'V',
    },
    port: 5000,
    herkunft:
      'Form nach der Protokoll-Umsetzung im Companion-Modul „evertz-quartz" (src/quartz.js, nachgesehen 2026-09-08): `.SV1,5`, abgeschlossen mit CR. Das ist eine verbreitete Umsetzung und NICHT das Herstellerdokument — Ebene, Zählweise und Port stehen im Handbuch des Geräts und gehören dagegen geprüft.',
  },
]

const zahl = (index: number, config: TextProtocolConfig, declared: number | undefined): number =>
  config.nummern === 'declared' ? (declared ?? 0) : index + config.basis

export class TextVorlagenFehler extends Error {}

/**
 * Prüft die Vorlage, statt eine halbe Zeile zu senden.
 *
 * Warum werfen und nicht stillschweigend ersetzen: eine Vorlage ohne `{out}`
 * schaltet denselben Ausgang für jeden Kreuzpunkt, und das fällt erst am
 * Gerät auf — dann aber auf allen Ausgängen gleichzeitig.
 */
export const pruefeVorlage = (config: TextProtocolConfig): void => {
  if (!config.vorlage.trim()) throw new TextVorlagenFehler('Die Befehlszeile ist leer.')
  if (!config.vorlage.includes('{out}')) {
    throw new TextVorlagenFehler('In der Befehlszeile fehlt der Platzhalter {out}.')
  }
  if (!config.vorlage.includes('{in}')) {
    throw new TextVorlagenFehler('In der Befehlszeile fehlt der Platzhalter {in}.')
  }
  if (config.vorlage.includes('{level}') && !config.level?.trim()) {
    throw new TextVorlagenFehler(
      'Die Befehlszeile nennt {level}, aber es ist keine Ebene eingetragen.',
    )
  }
  const unbekannt = [...config.vorlage.matchAll(/\{([a-zA-Z]+)\}/g)]
    .map((m) => m[1])
    .filter((n) => n !== 'out' && n !== 'in' && n !== 'level')
  if (unbekannt.length > 0) {
    throw new TextVorlagenFehler(`Unbekannte Platzhalter: ${[...new Set(unbekannt)].join(', ')}.`)
  }
}

export interface TextKreuzpunkt {
  /** Position des Ausgangs in der Anschlussliste. */
  outputIndex: number
  /** Position des Eingangs in der Anschlussliste. */
  inputIndex: number
  /** Die am Anschluss eingetragene Nummer, wo es eine gibt. */
  outputAddress?: number
  inputAddress?: number
}

/**
 * Der zu sendende Text — GENAU eine Zeile je Kreuzpunkt.
 *
 * Kein Auffüllen, kein Default für nicht genannte Ausgänge. Dieselbe Regel
 * wie beim Videohub (Invariante 17), und hier umso mehr: was in der Zeile
 * steht, hat der Nutzer erklärt, und was nicht darin steht, hat er nicht
 * gemeint.
 */
export const renderTextCommand = (
  config: TextProtocolConfig,
  punkte: readonly TextKreuzpunkt[],
): string => {
  pruefeVorlage(config)
  if (punkte.length === 0) return ''
  const anfang = ZEILEN_ANFANG[config.anfang].text
  const ende = ZEILEN_ENDE[config.ende].text
  return punkte
    .map((p) => {
      const zeile = config.vorlage
        .replaceAll('{level}', config.level ?? '')
        .replaceAll('{out}', String(zahl(p.outputIndex, config, p.outputAddress)))
        .replaceAll('{in}', String(zahl(p.inputIndex, config, p.inputAddress)))
      return `${anfang}${zeile}${ende}`
    })
    .join('')
}

/**
 * Der Text so, wie ein Mensch ihn LESEN kann.
 *
 * Steuerzeichen sind unsichtbar, und ein unsichtbares STX vor der Zeile ist
 * genau der Unterschied zwischen „das Gerät versteht es" und „das Gerät
 * antwortet nicht". Die Vorschau im Dialog zeigt sie deshalb benannt — sie
 * ist damit nicht mehr wortwörtlich der Bytestrom, sondern seine lesbare
 * Form, und die Überschrift im Dialog sagt das.
 */
export const lesbar = (text: string): string =>
  text
    .replaceAll('\u0002', '<STX>')
    .replaceAll('\r\n', '<CR><LF>\n')
    .replaceAll('\r', '<CR>\n')
    .replaceAll('\n', '<LF>\n')
