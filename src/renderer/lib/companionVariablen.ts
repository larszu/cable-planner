// ───────────────────────────────────────────────────────────────────────────
// DER COMPANION-VARIABLENSTAND ALS ZWEITE QUELLE (E-23, letzter offener Punkt)
//
// E-23 hat den eingehenden Show-Control-Weg entschieden und gebaut: der
// OSC-Lauscher (`main/services/oscListener.ts`) schreibt EMPFANGSMELDUNGEN
// mit, nie Anlagenzustand. Was der Eintrag ausdrücklich offen gelassen hat,
// steht hier:
//
//   > Offen bleibt der Import eines Companion-Variablenstands als zweite
//   > Quelle.
//
// ═══════════════════════════════════════════════════════════════════════════
// WARUM DAS EIN IMPORT IST UND KEIN ZWEITER SOCKET
// ═══════════════════════════════════════════════════════════════════════════
//
// Ein Poller, der Companion im Sekundentakt nach seinen Variablen fragt und
// das Ergebnis anzeigt, ist genau das, was die Bedarfs-Datenbank verbietet:
// „a live monitoring dashboard, which would make the suite responsible for a
// false all-clear". Der Unterschied zwischen Mitschrift und Monitor liegt
// nicht in der Technik, sondern darin, ob die Anzeige behauptet, JETZT zu
// gelten.
//
// Deshalb dieselbe Bauform wie beim Rest dieses Plans: **der Plan benennt den
// Weg, er geht ihn nicht.** Er schreibt die Befehlszeilen auf, die jemand in
// eine Companion-Sitzung tippt, und liest die Antwort zurück, die derjenige
// zurückbringt. Was dabei herauskommt, ist eine ABLESUNG mit Zeitpunkt —
// dieselbe Spur wie beim As-built (`lib/asBuilt.ts`), die ausdrücklich nichts
// in den Plan zurückschreibt: „was der Hub gerade tut, ist eine Beobachtung,
// was im Plan steht, eine Absicht."
//
// Das ist zugleich der Grund, warum das hier eine ReadingSource bekommt und
// keinen eigenen Anzeige-Begriff: eine sechste Quelle für ein vorhandenes
// Blatt ist billiger und ehrlicher als ein sechstes Blatt.
//
// ═══════════════════════════════════════════════════════════════════════════
// DIE PROTOKOLL-ANGABEN — NACHGESEHEN, NICHT ERINNERT
// ═══════════════════════════════════════════════════════════════════════════
//
// Gelesen am 2026-09-09 in `bitfocus/companion@main`. Jede Zeile unten steht
// so im Quelltext; wo etwas NICHT nachgesehen ist, sagt der Kommentar es.
//
//   `companion/lib/Service/TcpUdpApi.ts`
//     • Route:   `custom-variable :name get-value`      (Zeile 266)
//     • Handler: wirft `Variable not found`, sonst `JSON.stringify(result)`
//     • Der Befehl wird nur getrimmt, sonst nicht angefasst (Zeile 521)
//
//   `companion/lib/Service/Tcp.ts`
//     • Zeilentrenner ist `\n`; die Zeile wird getrimmt
//     • Erfolg: `+OK`, bei Rückgabewert `+OK <wert>` — dann `\n`
//     • Fehler: `-ERR <meldung>` — dann `\n`
//     • Vorgabe-Port: 16759
//
//   `companion/lib/Data/UserConfig.ts`
//     • Neuinstallation: `tcp_enabled: false`, `udp_enabled: false`,
//       `osc_enabled: false` — aber `http_api_enabled: true`
//     • Bestehende Installation (`#populateMissingForExistingDb`): TCP, UDP
//       und OSC werden EINGESCHALTET, auf den alten Ports 51234 / 51235 /
//       12321
//
// ─── WAS DIESE MESSUNG AN EINER VORHANDENEN ZEILE SCHÄRFT ──────────────────
//
// Das Ausspiel-Blatt schreibt heute an jede Companion-Position „Schnittstelle
// dort einschalten — sie ist ab Werk aus" (`lib/deliveryParity.ts`). Das ist
// für den LESE-Weg richtig und für den SCHALT-Weg falsch: S-4 schaltet über
// die HTTP-API, und die ist ab Werk AN. Und „ab Werk aus" gilt nur für eine
// Neuinstallation — eine hochgezogene Installation hat TCP an, nur auf einem
// anderen Port. Beides steht jetzt an der Zeile, statt dass es jemand vor Ort
// herausfindet.
//
// ─── EINE ANGABE, DIE HIER AUSDRÜCKLICH NICHT BEHAUPTET WIRD ───────────────
//
// Ob der Router Gross- und Kleinschreibung unterscheidet. `RegexRouter.addPath`
// baut das Muster mit `pathToRegexp(path)` ohne Optionen; welche Vorgabe diese
// Fassung für `sensitive` hat, ist NICHT nachgesehen worden. Deshalb schreibt
// dieser Baustein die Befehlszeilen klein — so, wie die Route sie deklariert.
// Klein passt unter beiden Auslegungen; gross nur unter einer.
//
// REIN: keine Uhr, kein Store, kein IO. Der Zeitpunkt kommt von aussen.
// ───────────────────────────────────────────────────────────────────────────

import type { AsBuiltEntry } from './asBuilt'

/** Die nachgesehenen Vorgaben, an einer Stelle statt in drei Kommentaren. */
export const COMPANION_API = {
  /** Vorgabe-Port der TCP-Steuerung bei einer NEUINSTALLATION. */
  tcpPortNeu: 16759,
  /** Derselbe Port bei einer hochgezogenen Installation. */
  tcpPortAlt: 51234,
  /** Quelle und Stand der Angaben oben. */
  gelesen: 'bitfocus/companion@main, 2026-09-09',
} as const

/**
 * Der Satz, der an einer Companion-Position auf dem Blatt steht.
 *
 * EINE Stelle, damit die Auflage aus E-23 nicht in zwei Formulierungen
 * auseinanderläuft — dieselbe Überlegung wie bei `empfangsText`.
 */
export const COMPANION_SCHNITTSTELLE_HINWEIS =
  'Companion: der SCHALT-Weg läuft über die HTTP-API (ab Werk an), das ' +
  'ZURÜCKLESEN über die TCP-Steuerung (bei einer Neuinstallation ab Werk aus, ' +
  `Port ${COMPANION_API.tcpPortNeu}; eine hochgezogene Installation hat sie an, ` +
  `auf Port ${COMPANION_API.tcpPortAlt}). Vor Ort nachsehen, nicht annehmen.`

/**
 * Die Befehlszeilen, die jemand in die Companion-Sitzung tippt.
 *
 * Klein geschrieben, siehe Kopf. Leere und doppelte Namen fallen weg: ein
 * doppelter Name brächte zwei Antwortzeilen für einen Eintrag und verschöbe
 * die Zuordnung unten um eins.
 */
export const companionAbfrage = (namen: readonly string[]): string[] => {
  const gesehen = new Set<string>()
  const raus: string[] = []
  for (const roh of namen) {
    const name = roh.trim()
    if (!name || gesehen.has(name)) continue
    gesehen.add(name)
    raus.push(`custom-variable ${name} get-value`)
  }
  return raus
}

/** Eine gelesene Antwortzeile. */
export interface CompanionAntwort {
  /** Die Zeile, wie sie ankam — ungedeutet, für die Anzeige im Zweifel. */
  roh: string
  /** Der Wert, wenn die Zeile ein `+OK` mit Inhalt war. */
  wert?: string
  /** Die Fehlermeldung, wenn die Zeile ein `-ERR` war. */
  fehler?: string
}

/**
 * Eine einzelne Antwortzeile deuten.
 *
 * `+OK` ohne Inhalt ist KEIN leerer Wert, sondern gar keiner: Companion
 * hängt den Wert nur an, wenn der Handler einen zurückgibt. Ein `+OK` allein
 * kommt von den Befehlen ohne Rückgabe (`press`, `style`) — wer es als
 * leeren Variablenwert läse, machte aus einem Tastendruck eine Ablesung.
 *
 * Der Wert kommt als `JSON.stringify(result)` zurück. Ist er lesbar, wird er
 * ausgepackt (`"12"` -> `12`); ist er es nicht, bleibt die Rohform stehen.
 * Raten wird hier nichts: eine unlesbare Antwort ist eine unlesbare Antwort.
 */
export const leseCompanionZeile = (zeile: string): CompanionAntwort | undefined => {
  const z = zeile.trim()
  if (!z) return undefined
  if (z.startsWith('-ERR')) {
    return { roh: z, fehler: z.slice(4).trim() || 'ohne Meldung' }
  }
  if (z === '+OK') return { roh: z }
  if (z.startsWith('+OK ')) {
    const rest = z.slice(4).trim()
    let wert = rest
    try {
      const geparst: unknown = JSON.parse(rest)
      if (typeof geparst === 'string' || typeof geparst === 'number' || typeof geparst === 'boolean') {
        wert = String(geparst)
      }
    } catch {
      // Rohform behalten — siehe oben.
    }
    return { roh: z, wert }
  }
  return undefined
}

/** Eine Ablesung: ein Variablenname, eine Antwort, ein Zeitpunkt. */
export interface CompanionAblesung {
  variable: string
  antwort: CompanionAntwort
  /** ISO-Zeitpunkt, von aussen gesetzt. */
  gelesenAm: string
}

export interface CompanionStandErgebnis {
  ablesungen: CompanionAblesung[]
  /**
   * Warum GAR NICHTS zugeordnet wurde. Gesetzt heisst: `ablesungen` ist leer.
   *
   * Kein Feld für Randfälle, sondern die Engstelle dieses Bausteins — siehe
   * `leseCompanionStand`.
   */
  problem?: string
}

/**
 * Den zurückgebrachten Antwortblock den abgefragten Namen zuordnen.
 *
 * ═══ DIE ENGSTELLE, UND WARUM SIE LIEBER NICHTS LIEFERT ═══════════════════
 *
 * Die Antwort trägt den Variablennamen NICHT — `+OK "12"` sagt nicht, wozu
 * die 12 gehört. Zugeordnet werden kann also nur über die REIHENFOLGE, und
 * die stimmt genau so lange, wie keine Zeile fehlt.
 *
 * Fehlt eine, verschiebt sich alles danach um eins: der Wert der einen
 * Variablen erscheint unter dem Namen der nächsten. Das Ergebnis sieht
 * vollständig aus, ist plausibel und ist falsch — und es ginge als Ablesung
 * in ein As-built-Blatt, aus dem später jemand einen Kreuzpunkt liest.
 *
 * Deshalb ordnet dieser Baustein NUR bei exakter Übereinstimmung zu und
 * liefert sonst nichts ausser dem Grund. Eine halbe Zuordnung wäre hier
 * schlimmer als keine — dieselbe Haltung wie bei Invariante 23 (eine falsch
 * gelesene Zahl sieht aus wie eine Messung).
 *
 * Nicht deutbare Zeilen (die getippten Befehle selbst, Begrüssungen, leere
 * Zeilen) fallen vorher weg — sonst müsste jeder eine saubere Zwischenablage
 * liefern, und das tut niemand.
 */
export const leseCompanionStand = (
  text: string,
  namen: readonly string[],
  gelesenAm: string,
): CompanionStandErgebnis => {
  const gefragt = [...new Set(namen.map((n) => n.trim()).filter(Boolean))]
  if (gefragt.length === 0) {
    return { ablesungen: [], problem: 'Keine Variablennamen im Plan — es gibt nichts abzufragen.' }
  }
  const antworten = text
    .split('\n')
    .map(leseCompanionZeile)
    .filter((a): a is CompanionAntwort => a !== undefined)

  if (antworten.length === 0) {
    return {
      ablesungen: [],
      problem:
        'Keine Antwortzeile erkannt. Companion antwortet je Befehl mit einer Zeile, ' +
        'die mit „+OK" oder „-ERR" beginnt — der eingefügte Text enthält keine solche.',
    }
  }
  if (antworten.length !== gefragt.length) {
    return {
      ablesungen: [],
      problem:
        `${gefragt.length} Variable(n) abgefragt, ${antworten.length} Antwortzeile(n) erkannt. ` +
        'Die Antwort trägt den Namen nicht mit — zugeordnet wird über die Reihenfolge, und ' +
        'die stimmt nur bei gleicher Anzahl. Bei einer fehlenden Zeile stünde jeder Wert ' +
        'unter dem falschen Namen. Alle Antworten vollständig einfügen, dann erneut.',
    }
  }
  return {
    ablesungen: gefragt.map((variable, i) => ({ variable, antwort: antworten[i], gelesenAm })),
  }
}

/**
 * Aus Ablesungen As-built-Zeilen machen.
 *
 * `planned` ist, was der Plan zuletzt über diese Variable gesetzt HÄTTE —
 * übergeben wird es, nicht geraten: dieser Baustein kennt die Kreuzpunkte
 * nicht. Wer nichts übergibt, bekommt eine Zeile ohne Plan-Seite, und
 * `asBuiltVerdict` nennt sie `unexpected` — „vorgefunden, nicht im Plan".
 *
 * Eine `-ERR`-Antwort liefert AUSDRÜCKLICH KEINE Ablesung (`actual` bleibt
 * leer). „Variable not found" heisst nicht „der Wert ist leer", sondern „es
 * wurde nichts abgelesen" — und das Urteil dafür heisst `missing` und nicht
 * `differs`. Der Fehlertext steht im Gegenstand, damit er nicht verlorengeht.
 */
export const companionAsBuilt = (
  ablesungen: readonly CompanionAblesung[],
  geplant: Readonly<Record<string, string>> = {},
): AsBuiltEntry[] =>
  ablesungen.map((a) => ({
    subject: a.antwort.fehler
      ? `Companion · ${a.variable} (${a.antwort.fehler})`
      : `Companion · ${a.variable}`,
    field: 'Custom-Variable',
    planned: geplant[a.variable],
    actual: a.antwort.fehler ? undefined : a.antwort.wert,
    source: 'companion' as const,
    at: a.gelesenAm,
  }))
