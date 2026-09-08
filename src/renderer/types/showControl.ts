// ───────────────────────────────────────────────────────────────────────────
// SHOW-CONTROL: OSC AUSGEHEND UND EINGEHEND (E-23).
//
// Entschieden vom Eigentuemer, 2026-09-08: „AUSGEHEND UND EINGEHEND; die
// Vokabel bleibt OSC."
//
// ═══════════════════════════════════════════════════════════════════════════
// DIE EINE BEDINGUNG, DIE DIESE ENTSCHEIDUNG TRAEGT
// ═══════════════════════════════════════════════════════════════════════════
//
// Sie steht in E-23 und hat sich vom UMFANG auf die ANZEIGE verschoben:
//
//   Was aus einer eingehenden Nachricht auf den Schirm kommt, ist eine
//   EMPFANGSMELDUNG und nie ein Anlagenzustand.
//
// Also: „Cue 12 um 14:22:07 empfangen", mit Alter und Absender — NICHT
// „Kamera 3 bereit", NICHT gruen/rot ueber der Anlage.
//
// Der Unterschied ist nicht Geschmack. Die Bedarfs-Datenbank verbietet
// ausdruecklich ein „live monitoring dashboard, which would make the suite
// responsible for a false all-clear". Empfangen und Anzeigen sind zwei
// Schritte; der Satz trifft den zweiten. Wer Zustand anzeigt, haftet fuer die
// Entwarnung — und dieses Repo hat keinen Weg, eine Entwarnung zu
// verifizieren (dieselbe Haltung wie ADR-003 und wie Invariante 21).
//
// Eine Empfangsmeldung sagt: „hier kam um 14:22:07 etwas an". Sie sagt NICHT,
// dass die Anlage in Ordnung ist, und sie sagt auch nicht, dass sie es nicht
// ist. Genau deshalb traegt jede Meldung ihr ALTER: eine Zeile von vor zwei
// Stunden sieht sonst aus wie eine von eben.
//
// ═══════════════════════════════════════════════════════════════════════════
// WAS HIER AUS DEM PAKET GELESEN WIRD — UND WAS NICHT
// ═══════════════════════════════════════════════════════════════════════════
//
// NUR DIE ADRESSE. Ein OSC-Paket traegt hinter der Adresse Typkennungen und
// Werte; die zu entziffern hiesse, aus fremden Bytes ZAHLEN zu machen — und
// eine falsch gelesene Zahl sieht aus wie eine Messung (dieselbe Ueberlegung
// wie beim EDID, Invariante 23).
//
// Die Adresse dagegen ist eine Zeichenkette, die mit `/` beginnt und mit
// Nullbytes auf vier aufgefuellt ist. Faellt das Lesen daneben, steht dort
// erkennbarer Unsinn und keine plausible Zahl — und die Anzeige ist ohnehin
// nur eine Empfangsmeldung. Die Argumente werden als LAENGE gemeldet („12
// Byte Nutzlast") und nicht als Werte.
//
// REIN: keine Uhr, kein Store, kein IO. Die Uhrzeit kommt von aussen herein.
// ───────────────────────────────────────────────────────────────────────────

/** Wohin ein Ausspielziel im Show-Control-Sinn zeigt. */
export interface ShowControlZiel {
  /**
   * Die OSC-Adresse, unter der dieses Ziel angesprochen wird
   * („/stream/start", „/cue/12/go").
   *
   * Der Plan BENENNT sie — er verschickt sie nicht. Sie steht auf dem Blatt
   * als Konfiguration, damit sie jemand am Pult eintragen kann.
   */
  oscAdresse?: string
  /** Seite und Platz auf einer Companion-Oberflaeche, wenn dort bedient wird. */
  companionSeite?: number
  companionPlatz?: number
}

/**
 * Eine EMPFANGENE Nachricht. Kein Zustand.
 *
 * Die Feldnamen sagen es mit: `empfangenAm`, nicht `stand`; `absender`, nicht
 * `geraet`. Wer hier ein Feld `zustand` ergaenzt, hat die Entscheidung
 * umgedreht — `tests/oscEmpfang.test.ts` sagt es.
 */
export interface OscEmpfang {
  /** Die gelesene OSC-Adresse. Leer, wenn das Paket keine hergab. */
  adresse: string
  /** ISO-Zeitpunkt des Empfangs, von aussen gesetzt. */
  empfangenAm: string
  /** Adresse und Port, von denen das Paket kam. */
  absender: string
  /** Wieviele Bytes hinter der Adresse standen. NICHT ihr Inhalt. */
  nutzlastBytes: number
}

/** Was der Lauscher tun soll. Aus als Vorgabe. */
export interface OscLauscherConfig {
  /**
   * Aus als Vorgabe — die erste der vier Auflagen aus E-23. Ein Port, der
   * ungefragt lauscht, ist ein offener Port auf einem fremden Rechner.
   */
  aktiv: boolean
  /**
   * Die Adresse, auf der gelauscht wird. LEER als Vorgabe, und nicht
   * `0.0.0.0`: die zweite Auflage. Der Nutzer nennt sie; eine Vorgabe, die
   * auf allen Schnittstellen lauscht, ist eine Entscheidung, die niemand
   * getroffen hat.
   */
  adresse: string
  port: number
}

export const OSC_LAUSCHER_AUS: OscLauscherConfig = { aktiv: false, adresse: '', port: 9000 }

/** Was der Lauscher ueber sich meldet. */
export type LauscherLage =
  /** Nicht eingeschaltet. */
  | 'aus'
  /** Laeuft und lauscht. */
  | 'lauscht'
  /**
   * Eingeschaltet, aber nicht gebunden — die vierte Auflage aus E-23.
   *
   * Das ist der wichtigste der vier Zustaende, und der einzige, den man
   * ueberhaupt bauen muss: ein stiller Nicht-Empfang sieht aus wie „keine
   * Cues", und das ist die Entwarnung durch die Hintertuer.
   */
  | 'nicht-gebunden'

export const LAUSCHER_LAGE_LABEL = {
  aus: 'aus',
  lauscht: 'lauscht',
  'nicht-gebunden': 'eingeschaltet, aber nicht gebunden',
} satisfies Record<LauscherLage, string>

export interface LauscherZustand {
  lage: LauscherLage
  /** Bei `nicht-gebunden`: warum. Klartext fuer die Anzeige. */
  grund?: string
  adresse?: string
  port?: number
}

// ─── WAS HIER NICHT STEHT ──────────────────────────────────────────────────
//
// Das LESEN eines OSC-Pakets. Im Renderer kommt nie eines an — der Socket
// steht in `main/services/oscListener.ts`, und dort steht auch das Lesen.
// Es hier zusaetzlich zu fuehren waere `zwei-rechnungen` mit fremden Bytes,
// und die beiden Fassungen liefen beim ersten Sonderfall auseinander.

/**
 * Wie alt eine Meldung ist, in Sekunden.
 *
 * Eigene Funktion, weil das Alter die halbe Aussage ist: eine Zeile von vor
 * zwei Stunden sieht ohne es aus wie eine von eben — und genau daraus wuerde
 * jemand einen Anlagenzustand lesen.
 */
export const alterSekunden = (empfangenAm: string, jetztIso: string): number | undefined => {
  const t = Date.parse(empfangenAm)
  const jetzt = Date.parse(jetztIso)
  if (Number.isNaN(t) || Number.isNaN(jetzt)) return undefined
  return Math.max(0, Math.round((jetzt - t) / 1000))
}

/**
 * Der Satz, der auf dem Schirm steht.
 *
 * EINE Stelle, an der aus einer Meldung Text wird — damit es nicht zwei
 * Formulierungen gibt, von denen eine irgendwann nach Zustand klingt.
 */
export const empfangsText = (e: OscEmpfang, jetztIso: string): string => {
  const alter = alterSekunden(e.empfangenAm, jetztIso)
  const uhr = e.empfangenAm.slice(11, 19)
  const alterText = alter === undefined ? '' : ` (vor ${alter} s)`
  return `${e.adresse || '(ohne Adresse)'} um ${uhr} von ${e.absender} empfangen${alterText}`
}

// ─── SCHEMA-HEILUNG ────────────────────────────────────────────────────────

/**
 * Den Lauscher aus einer Projektdatei normalisieren.
 *
 * WARUM DAS NICHT BLOSS AUFRAEUMEN IST. Eine `.avplan` kann von einem anderen
 * Rechner kommen, und dann traegt sie eine Adresse, die es HIER nicht gibt.
 * Sie zu glauben hiesse, einen Port auf eine fremde Angabe zu binden — Auflage
 * 3 aus E-23 gilt auch fuer eine fremde Datei.
 *
 * Ohne Adresse ist der Lauscher AUS. Nicht „an, aber ungebunden": aus ist die
 * ehrliche Vorgabe, und der Nutzer schaltet ihn fuer diesen Rechner ein.
 */
export const normalisiereOscLauscher = (roh: unknown): OscLauscherConfig => {
  if (!roh || typeof roh !== 'object') return { ...OSC_LAUSCHER_AUS }
  const o = roh as Record<string, unknown>
  const adresse = typeof o.adresse === 'string' ? o.adresse.trim() : ''
  const port =
    typeof o.port === 'number' && Number.isInteger(o.port) && o.port > 0 && o.port < 65536
      ? o.port
      : OSC_LAUSCHER_AUS.port
  return {
    // Aktiv NUR mit Adresse. Beides zusammen, an einer Stelle — sonst gibt es
    // einen Zustand „an ohne Adresse", den irgendwer spaeter als „an"
    // liest.
    aktiv: o.aktiv === true && adresse !== '',
    adresse,
    port,
  }
}
