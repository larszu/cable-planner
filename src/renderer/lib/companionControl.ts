/**
 * Bitfocus Companion als Treiber für ALLE Hersteller (S-4).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM COMPANION UND NICHT FÜNFHUNDERT EIGENE TREIBER
 * ═══════════════════════════════════════════════════════════════════════
 *
 * S-3 hat die Frage offen gelassen: die verbindliche Beschreibung der
 * Hersteller-Protokolle liegt im Handbuch des jeweiligen Geräts, und ein aus
 * dem Gedächtnis nachgebauter Treiber ist eine ungeprüfte Zusicherung, die
 * als Befehl an eine laufende Anlage geht (Invariante 18).
 *
 * Companion löst genau dieses Problem — und zwar besser, als dieses Projekt
 * es je könnte: rund fünfhundert Module, jedes von Leuten gepflegt, die das
 * Gerät auf dem Tisch haben. Es ist MIT-lizenziert, kostenlos, läuft auf
 * Windows, macOS und Linux, und viele Häuser haben es ohnehin im Einsatz.
 *
 * Also wird das Protokoll nicht nachgebaut, sondern DELEGIERT. Der Plan
 * bleibt die Wahrheit über die Anlage; Companion bleibt die Wahrheit über
 * das Protokoll. Dazwischen liegen drei HTTP-Aufrufe.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM ES EINE SCHALTFLÄCHE UND ZWEI VARIABLEN SIND
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Companions HTTP-API kann Schaltflächen drücken und Custom-Variablen
 * setzen. Sie kann NICHT „führe Aktion X des Moduls Y mit diesen Argumenten
 * aus" — nachgesehen in `companion/lib/Service/HttpApi.ts` (main, 2026-09-08):
 * die Routen sind `location/:page/:row/:column/press|down|up|rotate-*|step|
 * style`, `custom-variable/:name/value`, `variable/:label/:name/value`,
 * `surfaces/rescan` und `connections`. Keine Aktions-Route.
 *
 * Eine Schaltfläche je Kreuzpunkt wäre bei einer 40×40-Kreuzschiene
 * sechzehnhundert Schaltflächen — unbrauchbar. Deshalb der Weg, den die
 * Companion-Welt selbst benutzt: EINE Schaltfläche, deren Route-Aktion ihre
 * Argumente aus zwei Custom-Variablen zieht (`$(internal:custom_…)`). Der
 * Plan setzt die beiden Variablen und drückt dann.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DIE REIHENFOLGE IST DIE ZUSICHERUNG
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Erst beide Variablen, dann der Druck. Und: **schlägt eine Variable fehl,
 * darf der Druck nicht passieren.** Sonst feuert die Schaltfläche mit den
 * Werten von vorhin und schaltet den VORIGEN Kreuzpunkt — auf einer
 * laufenden Anlage, ohne dass es jemandem auffällt, weil der Befehl ja
 * „durchging".
 *
 * Das ist der einzige wirklich gefährliche Fehler dieses Treibers, und
 * deshalb steht die Reihenfolge hier als Datenstruktur und nicht als
 * Ablauf im Treiber: eine Liste von Schritten, die der Reihe nach gehen und
 * beim ersten Fehlschlag abbrechen.
 *
 * REIN: keine Uhr, kein Store, kein IO.
 */

/** Wo die Schaltfläche in Companion liegt. Alles 1-basiert, wie in der Oberfläche. */
export interface CompanionKnopf {
  page: number
  row: number
  column: number
}

export interface CompanionConfig {
  /** Die Schaltfläche, deren Aktion den Kreuzpunkt setzt. */
  knopf: CompanionKnopf
  /** Name der Custom-Variablen für den AUSGANG (ohne `custom_`-Präfix). */
  varOut: string
  /** Name der Custom-Variablen für den EINGANG. */
  varIn: string
  /** Woher die Nummern kommen — dieselbe Frage wie beim Text-Protokoll. */
  nummern: 'position' | 'declared'
  /** Zählt das Gerät seine Anschlüsse ab 0 oder ab 1? */
  basis: 0 | 1
  /**
   * Die Companion-Verbindung, für die diese Schaltfläche gebaut ist.
   *
   * Rein zur ANZEIGE: der Dialog kann damit sagen „geht an die Verbindung
   * „Videohub Halle" (bmd-videohub)" statt nur „Seite 1, Zeile 2, Spalte 3".
   * Companion prüft das nicht — wer die Schaltfläche umbaut, ändert damit,
   * was passiert, und diese Angabe wird dann falsch. Sie ist deshalb eine
   * Notiz und keine Zusicherung, und die Oberfläche sagt das.
   */
  connectionLabel?: string
  connectionModule?: string
}

export const LEERE_COMPANION_KONFIG: CompanionConfig = {
  knopf: { page: 1, row: 0, column: 0 },
  varOut: '',
  varIn: '',
  nummern: 'position',
  basis: 1,
}

/** Ein einzelner HTTP-Aufruf an Companion, in der Reihenfolge des Ablaufs. */
export interface CompanionSchritt {
  method: 'POST'
  /** Pfad ab dem Host, mit Abfrage. */
  pfad: string
  /** Was dieser Schritt bewirkt — für die Vorschau und den Beleg. */
  zweck: string
  /**
   * Darf der nächste Schritt laufen, wenn dieser scheitert?
   *
   * Für die Variablen: NEIN. Ein Druck mit alten Werten schaltet den vorigen
   * Kreuzpunkt, und das sieht aus wie ein gelungener Befehl.
   */
  abbruchBeiFehler: true
}

export class CompanionFehler extends Error {}

/**
 * Prüft die Konfiguration, statt eine halbe Folge zu senden.
 *
 * Ein leerer Variablenname ergäbe `POST /api/custom-variable//value` — das
 * trifft keine Route, der Aufruf scheitert, und ohne diese Prüfung sähe der
 * Nutzer einen Netzfehler statt der fehlenden Angabe.
 */
export const pruefeCompanion = (config: CompanionConfig): void => {
  if (!config.varOut.trim()) throw new CompanionFehler('Die Variable für den Ausgang fehlt.')
  if (!config.varIn.trim()) throw new CompanionFehler('Die Variable für den Eingang fehlt.')
  if (config.varOut.trim() === config.varIn.trim()) {
    // Beide auf dieselbe Variable zu legen heisst, dass der zweite Wert den
    // ersten ueberschreibt — die Schaltflaeche bekaeme zweimal denselben.
    throw new CompanionFehler('Ausgang und Eingang zeigen auf dieselbe Variable.')
  }
  for (const [feld, wert] of Object.entries(config.knopf)) {
    if (!Number.isInteger(wert) || wert < 0) {
      throw new CompanionFehler(`Die Schaltflächen-Angabe „${feld}" ist keine Zahl ab 0.`)
    }
  }
  if (config.knopf.page < 1) {
    throw new CompanionFehler('Companion zählt Seiten ab 1.')
  }
  const erlaubt = /^[A-Za-z0-9_-]+$/
  for (const name of [config.varOut.trim(), config.varIn.trim()]) {
    if (!erlaubt.test(name)) {
      throw new CompanionFehler(
        `„${name}" ist kein gültiger Variablenname (Buchstaben, Ziffern, _ und -).`,
      )
    }
  }
}

export interface CompanionKreuzpunkt {
  outputIndex: number
  inputIndex: number
  outputAddress?: number
  inputAddress?: number
}

const zahl = (
  index: number,
  config: CompanionConfig,
  declared: number | undefined,
): number => (config.nummern === 'declared' ? (declared ?? 0) : index + config.basis)

/**
 * Die Schrittfolge für EINEN Kreuzpunkt.
 *
 * Genau einer je Aufruf, und das ist Absicht: die Schaltfläche in Companion
 * führt EINE Route aus. Mehrere Kreuzpunkte hintereinander bedeuten mehrere
 * Durchläufe dieser Folge — und weil dazwischen jedes Mal die Variablen neu
 * gesetzt werden, ist die Reihenfolge auch dann eindeutig.
 *
 * Die Werte sind URL-kodiert. Ohne das würde eine Nummer mit `&` (die es
 * nicht geben sollte, aber ein `declared`-Feld nimmt jede Zahl) die Abfrage
 * zerlegen.
 */
export const companionSchritte = (
  config: CompanionConfig,
  punkte: readonly CompanionKreuzpunkt[],
): CompanionSchritt[] => {
  pruefeCompanion(config)
  const schritte: CompanionSchritt[] = []
  for (const p of punkte) {
    const out = zahl(p.outputIndex, config, p.outputAddress)
    const inn = zahl(p.inputIndex, config, p.inputAddress)
    const { page, row, column } = config.knopf
    schritte.push({
      method: 'POST',
      pfad: `/api/custom-variable/${encodeURIComponent(config.varOut.trim())}/value?value=${encodeURIComponent(String(out))}`,
      zweck: `Ausgang ${out} in die Variable „${config.varOut.trim()}"`,
      abbruchBeiFehler: true,
    })
    schritte.push({
      method: 'POST',
      pfad: `/api/custom-variable/${encodeURIComponent(config.varIn.trim())}/value?value=${encodeURIComponent(String(inn))}`,
      zweck: `Eingang ${inn} in die Variable „${config.varIn.trim()}"`,
      abbruchBeiFehler: true,
    })
    schritte.push({
      method: 'POST',
      pfad: `/api/location/${page}/${row}/${column}/press`,
      zweck: `Schaltfläche ${page}/${row}/${column} drücken`,
      abbruchBeiFehler: true,
    })
  }
  return schritte
}

/** Die Schrittfolge als lesbarer Block für den Bestätigungs-Dialog. */
export const companionVorschau = (schritte: readonly CompanionSchritt[]): string =>
  schritte.map((s) => `${s.method} ${s.pfad}\n    ${s.zweck}`).join('\n')

/**
 * Eine Companion-Verbindung, wie `GET /api/connections` sie meldet.
 *
 * Sie ist das, was dem Nutzer beim Einrichten fehlt: er sieht in seiner
 * eigenen Companion-Instanz, welche Geräte dort schon eingerichtet sind, und
 * muss den Modulnamen nicht abtippen.
 */
export interface CompanionVerbindung {
  id: string
  label: string
  moduleId: string
  enabled: boolean
  status: string
}

/**
 * Die Antwort von `GET /api/connections` einlesen.
 *
 * TOLERANT gegen Felder, die eine andere Companion-Fassung anders nennt:
 * was fehlt, wird leer, und was kein Objekt ist, fällt weg. Eine Liste von
 * Verbindungen ist eine Bequemlichkeit beim Einrichten — sie darf beim
 * kleinsten Formatunterschied nicht den ganzen Dialog kippen.
 */
export const leseVerbindungen = (roh: unknown): CompanionVerbindung[] => {
  if (!Array.isArray(roh)) return []
  const raus: CompanionVerbindung[] = []
  for (const e of roh) {
    if (!e || typeof e !== 'object') continue
    const o = e as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    if (!id) continue
    raus.push({
      id,
      label: typeof o.label === 'string' ? o.label : id,
      moduleId: typeof o.moduleId === 'string' ? o.moduleId : '',
      enabled: o.enabled !== false,
      status:
        typeof o.status === 'string'
          ? o.status
          : o.status && typeof o.status === 'object'
            ? String((o.status as Record<string, unknown>).category ?? '')
            : '',
    })
  }
  return raus
}
