// ───────────────────────────────────────────────────────────────────────────
// Nachweise einer Person: Qualifikationen, Versicherungen, Unterweisungen
// (Bedarf 120, P4).
//
//   > A personal, portable credential pack - certificates, insurance,
//   > qualifications - that can be handed to a new client in one file …
//   > The person who owns the certificate has no system and re-supplies it per
//   > client, per renewal, from a folder of scans.
//
// Die Bedarfs-Datenbank verzeichnet dazu ausdrücklich einen NULL-BEFUND:
// Ablauf-Verfolgung gibt es (CrewBrain), aber nur firmenseitig; freiberuflich
// wurde in keinem durchsuchten Tracker ein Gegenstück gefunden.
//
// ═══════════════════════════════════════════════════════════════════════════
// DIE EINE GEFÄHRLICHE STELLE: EIN ABGELAUFENER NACHWEIS, DER GÜLTIG AUSSIEHT
// ═══════════════════════════════════════════════════════════════════════════
//
// Wer diese Liste einem Kunden gibt, sagt damit „das ist mein Stand". Ein
// Eintrag ohne Ablaufdatum darf deshalb NICHT als unbefristet gelten. Das sind
// zwei verschiedene Aussagen:
//
//   * „gilt bis 2027-04-30"     — eine Frist, die jemand angegeben hat.
//   * „keine Frist angegeben"   — es weiss niemand.
//
// Die zweite als die erste zu zeigen wäre die Entwarnung durch die Hintertür
// (Invariante 21: eine fehlende Angabe ist kein grüner Haken). `NachweisLage`
// hat deshalb DREI Werte und nicht zwei.
//
// ═══════════════════════════════════════════════════════════════════════════
// WAS HIER NICHT LIEGT
// ═══════════════════════════════════════════════════════════════════════════
//
// DIE SCANS. Ein Nachweis trägt höchstens den DATEINAMEN dessen, was daneben
// liegt. Die PDFs in die Anwendung zu kopieren hiesse, fremde Personendaten in
// einen Speicher zu legen, den der Nutzer nicht als Aktenschrank angelegt hat
// — und im Browser-Zweig wäre es der localStorage mit seinen fünf Megabyte.
// Das Deckblatt sagt darum bei jedem Eintrag, OB eine Datei benannt ist.
//
// UND SIE GEHÖREN NICHT INS PROJEKT. Ein Nachweis gilt für die PERSON, nicht
// für den Plan; in einer `.avplan`, die an einen Kunden geht, hätte die
// Versicherungsnummer des Freiberuflers nichts zu suchen. Sie liegen deshalb
// im eigenen, projektübergreifenden Store — `tests/nachweisPack.test.ts` hält
// fest, dass der Projekt-Typ sie nicht kennt.
// ───────────────────────────────────────────────────────────────────────────

/** Was für ein Nachweis das ist. */
export type NachweisArt =
  /** Sachkunde, Befähigung, Schein (SKS, PSAgA, Höhenrettung, Führerschein). */
  | 'qualifikation'
  /** Betriebshaftpflicht, Geräteversicherung, Unfallversicherung. */
  | 'versicherung'
  /** Jährliche Unterweisung, Sicherheitseinweisung. */
  | 'unterweisung'
  /** Ausweis, Mitgliedschaft, Zulassung. */
  | 'ausweis'
  /** Alles Übrige — mit eigener Beschriftung, statt es in eine falsche zu pressen. */
  | 'sonstiges'

export const NACHWEIS_ART_LABEL = {
  qualifikation: 'Qualifikation',
  versicherung: 'Versicherung',
  unterweisung: 'Unterweisung',
  ausweis: 'Ausweis',
  sonstiges: 'Sonstiges',
} satisfies Record<NachweisArt, string>

export const NACHWEIS_ARTEN = Object.keys(NACHWEIS_ART_LABEL) as NachweisArt[]

export interface Nachweis {
  id: string
  art: NachweisArt
  /** Wie das Papier heisst („Sachkundenachweis PSAgA"). Pflicht. */
  bezeichnung: string
  /** Wer es ausgestellt hat. */
  aussteller?: string
  /** Nummer/Zeichen auf dem Papier. */
  nummer?: string
  /** Ausstellungsdatum (ISO). */
  ausgestelltAm?: string
  /**
   * Gültig bis (ISO) — ODER NICHTS.
   *
   * Fehlt es, ist das KEIN „unbefristet". Es ist „keine Frist angegeben", und
   * die Anzeige sagt genau das. Wer hier eine Vorgabe einträgt (etwa ein Datum
   * weit in der Zukunft), macht aus einer fehlenden Angabe eine Zusage.
   */
  gueltigBis?: string
  /**
   * Der Dateiname des Scans, der daneben liegt. NICHT die Datei.
   *
   * Ein Name ohne Datei ist trotzdem eine Auskunft („so heisst sie bei mir"),
   * und das Deckblatt schreibt sie hin. Was es NICHT tut, ist behaupten, die
   * Datei liege bei.
   */
  dateiName?: string
  notiz?: string
}

/** Wie es um einen Nachweis steht — an einem bestimmten Tag. */
export type NachweisLage =
  /** Frist angegeben und noch nicht erreicht. */
  | 'in-frist'
  /** Frist angegeben und überschritten. */
  | 'abgelaufen'
  /**
   * KEINE Frist angegeben.
   *
   * Der wichtigste der drei, und der einzige, den man überhaupt bauen muss:
   * ohne ihn fiele ein Nachweis ohne Datum in einen der beiden anderen Töpfe —
   * und „gültig" wäre dann eine Zusage, die niemand gegeben hat.
   */
  | 'ohne-frist'

export const NACHWEIS_LAGE_LABEL = {
  'in-frist': 'gültig',
  abgelaufen: 'abgelaufen',
  'ohne-frist': 'keine Frist angegeben',
} satisfies Record<NachweisLage, string>
