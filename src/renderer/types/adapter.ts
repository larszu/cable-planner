// ───────────────────────────────────────────────────────────────────────────
// DER ADAPTER ALS EIGENES OBJEKT (B-46).
//
// Wunsch des Eigentuemers, 2026-09-08: „Ebenso fehlen Steck und Kabeladapter
// wie zum Beispiel Micro HDMI auf HDMI Adapter oder USB C auf DisplayPort."
//
// ═══════════════════════════════════════════════════════════════════════════
// WAS VORHER DA WAR — UND WAS NICHT
// ═══════════════════════════════════════════════════════════════════════════
//
// Nicht nichts, und das ist eine Berichtigung zum ersten Befund im Backlog.
// `planDemandExtras.ts` LEITET seit Bedarf 17 Adapter-Zeilen fuer die
// Kommissionierliste AB — aus `cable.needsConverter` und aus ungleichen
// LWL-Steckertypen. Der Adapter fehlte also nicht auf der Packliste.
//
// Was fehlte, ist der Adapter als DING. Und der Unterschied ist genau der,
// den ADR-002 meint: eine abgeleitete Zeile heisst „Adapter HDMI ↔ USB-C",
// weil zwei Steckertypen nicht zusammenpassen. Sie ist aus dem MANGEL
// gebaut, nicht aus einer Angabe. Sie kann deshalb nicht sagen, in welche
// Richtung der Adapter geht, was er an Bandbreite durchlaesst, ob er Strom
// braucht — und sie liegt nirgends im Signalweg.
//
// ═══════════════════════════════════════════════════════════════════════════
// WARUM EIN ADAPTER KEIN KABEL MIT ZWEI ENDEN IST
// ═══════════════════════════════════════════════════════════════════════════
//
// Er ist eine WANDLUNG und traegt drei Aussagen, die ein Kabel nicht traegt:
//
//   RICHTUNG   USB-C auf DisplayPort geht in genau eine Richtung, und nur,
//              wenn die Quelle den DisplayPort-Alternate-Mode kann. Ein
//              Adapter, den der Plan als „passt" zeichnet, obwohl der Rechner
//              es nicht kann, ist die gefaehrlichste Sorte gruener Haken.
//   GRENZE     Ein passiver Adapter kann die Bandbreite begrenzen; ein
//              aktiver braucht Strom. Beides gehoert an das Objekt.
//   ORT        Er liegt IM WEG. Der Signalweg muss ihn als Station kennen,
//              sonst rechnet die Formatpruefung an ihm vorbei.
//
// ═══════════════════════════════════════════════════════════════════════════
// ERKLAERT, NICHT GERATEN (ADR-002)
// ═══════════════════════════════════════════════════════════════════════════
//
// Keine dieser drei Aussagen wird aus den Steckertypen abgeleitet. Aus
// „USB-C auf DisplayPort" folgt NICHT, dass der Adapter einweg ist, und aus
// „HDMI auf HDMI" folgt nicht, dass er 2.1 durchlaesst — beides haengt am
// Bauteil, nicht an der Steckerpaarung. Wer es nicht eintraegt, bekommt hier
// `unbekannt`, und `unbekannt` ist NIE ein gruener Haken.
//
// Das ist der Grund fuer DREI Urteile statt zwei. „Traegt nicht" und „ist
// nicht erklaert" sehen auf dem Blatt gleich aus und bedeuten das Gegenteil:
// das eine ist ein Befund, das andere eine fehlende Angabe. Wer sie
// zusammenwirft, macht aus jeder Luecke einen Fehler oder aus jeder Luecke
// ein OK — beides ist falsch, und die zweite Richtung ist die gefaehrliche.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { ConnectorType } from './equipment'
import type { SignalStandard } from './cableSpec'

/** In welche Richtung der Adapter wandelt. */
export type AdapterRichtung =
  /** Nur von `von` nach `nach`. Umgekehrt gesteckt tut er nichts. */
  | 'einweg'
  /** Beide Richtungen — eine reine mechanische Umsetzung ohne Elektronik. */
  | 'beidseitig'
  /** Nicht eingetragen. Kein Urteil moeglich; ausdruecklich kein „passt". */
  | 'unbekannt'

export const ADAPTER_RICHTUNG_LABEL = {
  einweg: 'nur in eine Richtung',
  beidseitig: 'in beide Richtungen',
  unbekannt: 'nicht erklärt',
} satisfies Record<AdapterRichtung, string>

export const ADAPTER_RICHTUNG_HINWEIS = {
  einweg:
    'Umgekehrt gesteckt überträgt dieser Adapter nichts. Der Plan meldet es, statt einen grünen Haken zu zeigen.',
  beidseitig:
    'Eine rein mechanische Umsetzung ohne Elektronik — sie funktioniert in beide Richtungen.',
  unbekannt:
    'Ohne Richtung kann der Plan nicht sagen, ob dieser Adapter an dieser Stelle trägt. Er sagt dann „nicht erklärt" und nicht „passt".',
} satisfies Record<AdapterRichtung, string>

export const ADAPTER_RICHTUNGEN = Object.keys(ADAPTER_RICHTUNG_LABEL) as AdapterRichtung[]

/** Woher der Adapter seine Energie nimmt, wenn er welche braucht. */
export type AdapterSpeisung =
  /** Kein Strom noetig. */
  | 'passiv'
  /** Braucht eine eigene Einspeisung (USB-Buchse, Netzteil). */
  | 'aktiv-extern'
  /** Zieht seinen Strom aus der Quelle (bus-powered). */
  | 'aktiv-aus-quelle'
  /** Nicht eingetragen. */
  | 'unbekannt'

export const ADAPTER_SPEISUNG_LABEL = {
  passiv: 'passiv (kein Strom)',
  'aktiv-extern': 'aktiv, eigene Einspeisung',
  'aktiv-aus-quelle': 'aktiv, Strom aus der Quelle',
  unbekannt: 'nicht erklärt',
} satisfies Record<AdapterSpeisung, string>

export const ADAPTER_SPEISUNG_HINWEIS = {
  passiv:
    'Nichts einzupacken ausser dem Adapter selbst.',
  'aktiv-extern':
    'Braucht am Einsatzort eine Buchse oder ein Netzteil. Das gehört auf die Packliste, sonst liegt der Adapter am Aufbautag ohne Strom da.',
  'aktiv-aus-quelle':
    'Zieht seinen Strom aus dem Quellgerät. An einem Anschluss, der keinen liefert, bleibt er stumm.',
  unbekannt: 'Nicht eingetragen — im Zweifel wird ein Netzteil gebraucht.',
} satisfies Record<AdapterSpeisung, string>

export const ADAPTER_SPEISUNGEN = Object.keys(ADAPTER_SPEISUNG_LABEL) as AdapterSpeisung[]

/**
 * Die Angaben eines Adapters. Steht am Geraet unter `adapter`.
 *
 * `von` und `nach` sind die beiden Steckerseiten. Sie sind die Wandlung
 * selbst — was der Adapter IST — und deshalb Pflicht; alles andere darf
 * fehlen und heisst dann ausdruecklich „nicht erklaert".
 */
export interface AdapterSpec {
  /** Die Seite, die zur Quelle zeigt. */
  von: ConnectorType
  /** Die Seite, die zur Senke zeigt. */
  nach: ConnectorType
  richtung: AdapterRichtung
  speisung: AdapterSpeisung
  /**
   * Der hoechste Standard, den dieser Adapter durchlaesst.
   *
   * NICHT aus den Steckern ableitbar: zwei aeusserlich gleiche
   * HDMI-Adapter koennen 1.4 und 2.1 sein. Fehlt die Angabe, prueft der
   * Plan die Grenze nicht — er behauptet aber auch nicht, dass sie haelt.
   */
  hoechsterStandard?: SignalStandard
  /**
   * Was die QUELLE koennen muss, damit der Adapter ueberhaupt arbeitet.
   *
   * Der Fall aus dem Wunsch des Eigentuemers: „USB-C auf DisplayPort"
   * braucht den DisplayPort-Alternate-Mode am Rechner. Ein USB-C-Anschluss,
   * der nur Daten kann, sieht identisch aus und traegt kein Bild. Steht hier
   * ein Text, muss das Quellgeraet ihn unter `kann` fuehren — sonst lautet
   * das Urteil „nicht erklaert", nie „passt".
   */
  setztVoraus?: string
  /** Freitext fuer alles, was nicht in ein Feld gehoert. */
  notiz?: string
}

// ─── STANDARD-FAMILIEN ─────────────────────────────────────────────────────
//
// Ein Standard ist nur INNERHALB seiner Familie geordnet. HDMI 1.4 < 2.0 <
// 2.1 ist eine Tatsache der Spezifikation; „HDMI-2.0 gegen DP-1.4" ist
// keine — die beiden messen verschiedene Dinge, und eine Zahl dafuer waere
// erfunden. Der Vergleich sagt deshalb `nicht-vergleichbar` statt zu raten.

const FAMILIEN: SignalStandard[][] = [
  ['SDI-SD', 'SDI-HD', 'SDI-3G', 'SDI-6G', 'SDI-12G'],
  ['HDMI-1.4', 'HDMI-2.0', 'HDMI-2.1'],
  ['DP-1.2', 'DP-1.4', 'DP-2.0'],
  ['USB-2.0', 'USB-3.x'],
  ['Thunderbolt-3', 'Thunderbolt-4'],
  ['Eth-100', 'Eth-1G', 'Eth-10G'],
]

export type StandardVergleich = 'unterhalb' | 'gleich' | 'oberhalb' | 'nicht-vergleichbar'

/**
 * Wie sich `a` zu `b` verhaelt — innerhalb einer Familie, sonst gar nicht.
 */
export const vergleicheStandard = (
  a: SignalStandard | undefined,
  b: SignalStandard | undefined,
): StandardVergleich => {
  if (!a || !b) return 'nicht-vergleichbar'
  if (a === b) return 'gleich'
  const familie = FAMILIEN.find((f) => f.includes(a) && f.includes(b))
  if (!familie) return 'nicht-vergleichbar'
  return familie.indexOf(a) < familie.indexOf(b) ? 'unterhalb' : 'oberhalb'
}

// ─── DAS URTEIL ────────────────────────────────────────────────────────────

export type AdapterUrteilArt =
  /** Erklaert und passend. Der einzige Wert, der einen gruenen Haken traegt. */
  | 'passt'
  /** Erklaert und NICHT passend — ein Befund. */
  | 'passt-nicht'
  /** Es fehlt eine Angabe. Kein Befund, aber auch kein OK. */
  | 'offen'

export interface AdapterUrteil {
  art: AdapterUrteilArt
  /** Der Satz fuer die Anzeige. Bei 'passt' die Bestaetigung, sonst der Grund. */
  text: string
}

export interface AdapterLage {
  /** Steckertyp am Quell-Anschluss, an dem der Adapter haengt. */
  quelleSteckt?: ConnectorType
  /** Steckertyp am Senken-Anschluss. */
  senkeSteckt?: ConnectorType
  /** Der Standard, der hier tatsaechlich laufen soll. */
  verlangt?: SignalStandard
  /**
   * Was das QUELLGERAET erklaertermassen kann. Nur was hier steht, gilt —
   * aus dem Modellnamen zu schliessen waere genau der Namensabgleich, den
   * ADR-002 fuer folgenreiche Entscheidungen verbietet.
   */
  quelleKann?: string[]
}

/**
 * Passt dieser Adapter an dieser Stelle?
 *
 * Die Reihenfolge der Pruefungen ist nicht beliebig: zuerst das, was ein
 * BEFUND ist (mechanisch falsch, verkehrt herum, ueber der Grenze), dann
 * das, was nur eine fehlende ANGABE ist. Sonst verdeckte eine fehlende
 * Bandbreitenangabe einen verkehrt gesteckten Einweg-Adapter.
 */
export const beurteileAdapter = (spec: AdapterSpec, lage: AdapterLage): AdapterUrteil => {
  const { quelleSteckt, senkeSteckt, verlangt, quelleKann } = lage

  // (1) Mechanisch. Passen die Seiten ueberhaupt zu dem, woran er haengt?
  const vorwaerts =
    (!quelleSteckt || quelleSteckt === spec.von) && (!senkeSteckt || senkeSteckt === spec.nach)
  const rueckwaerts =
    (!quelleSteckt || quelleSteckt === spec.nach) && (!senkeSteckt || senkeSteckt === spec.von)

  if (!vorwaerts && !rueckwaerts) {
    return {
      art: 'passt-nicht',
      text: `Adapter ${spec.von} ↔ ${spec.nach} passt nicht zwischen ${quelleSteckt ?? '?'} und ${senkeSteckt ?? '?'}.`,
    }
  }

  // (2) Richtung. Der Fall, um den es dem Eigentuemer geht.
  if (!vorwaerts && rueckwaerts) {
    if (spec.richtung === 'einweg') {
      return {
        art: 'passt-nicht',
        text: `Dieser Adapter wandelt nur ${spec.von} nach ${spec.nach}. Hier steckt er umgekehrt und überträgt nichts.`,
      }
    }
    if (spec.richtung === 'unbekannt') {
      return {
        art: 'offen',
        text: `Hier steckt der Adapter umgekehrt (${spec.nach} nach ${spec.von}). Ob er das kann, ist nicht eingetragen — die Richtung gehört ans Gerät.`,
      }
    }
  }

  // (3) Grenze. Nur wenn beide Angaben da sind UND vergleichbar.
  if (spec.hoechsterStandard && verlangt) {
    const wie = vergleicheStandard(verlangt, spec.hoechsterStandard)
    if (wie === 'oberhalb') {
      return {
        art: 'passt-nicht',
        text: `Der Adapter lässt höchstens ${spec.hoechsterStandard} durch; hier läuft ${verlangt}.`,
      }
    }
    if (wie === 'nicht-vergleichbar') {
      return {
        art: 'offen',
        text: `Der Adapter ist mit ${spec.hoechsterStandard} angegeben, hier läuft ${verlangt} — die beiden sind nicht gegeneinander zu messen.`,
      }
    }
  }

  // (4) Voraussetzung an der Quelle. Erklaert oder gar nicht.
  if (spec.setztVoraus) {
    const erklaert = (quelleKann ?? []).some(
      (k) => k.trim().toLowerCase() === spec.setztVoraus!.trim().toLowerCase(),
    )
    if (!erklaert) {
      return {
        art: 'offen',
        text: `Dieser Adapter setzt „${spec.setztVoraus}" an der Quelle voraus. Am Quellgerät ist das nicht eingetragen — ob es das kann, weiss der Plan nicht.`,
      }
    }
  }

  // (5) Was jetzt noch fehlt, ist eine Angabe und kein Befund.
  if (spec.richtung === 'unbekannt') {
    return {
      art: 'offen',
      text: 'Die Richtung dieses Adapters ist nicht eingetragen. Der Plan sagt deshalb nicht, dass er hier trägt.',
    }
  }

  return {
    art: 'passt',
    text: `Adapter ${spec.von} nach ${spec.nach} trägt an dieser Stelle.`,
  }
}

/** Ob dieses Geraet ein Adapter ist. Ein Feld, kein Namensabgleich. */
export const istAdapter = (device: { adapter?: AdapterSpec }): boolean => !!device.adapter

/**
 * Der Name, unter dem der Adapter kommissioniert wird.
 *
 * Er steht hier und nicht in der Stueckliste, damit die Packliste und die
 * Anzeige denselben Text zeigen — zwei Fassungen desselben Namens waeren
 * `zwei-rechnungen`, und auf der Kiste stuende ein anderer als im Plan.
 */
export const adapterBezeichnung = (spec: AdapterSpec): string =>
  `Adapter ${spec.von} ${spec.richtung === 'einweg' ? 'auf' : '↔'} ${spec.nach}`

// ─── SCHEMA-HEILUNG ────────────────────────────────────────────────────────
//
// WARUM DAS HIER STEHT UND NICHT NUR IM STORE. Ein Adapter-Datensatz kann
// unvollstaendig ankommen — aus einer aelteren Datei, aus einem Import, aus
// einer fremden Bibliothek. Und der Schaden faellt in die gefaehrliche
// Richtung: fehlt `richtung`, dann ist `spec.richtung === 'unbekannt'`
// schlicht `false`, und `beurteileAdapter` faellt bis ans Ende durch — auf
// `passt`. Ein fehlendes Feld ergaebe damit einen GRUENEN HAKEN.
//
// Die Heilung setzt deshalb auf `unbekannt` und nicht auf einen plausiblen
// Wert: „nicht erklaert" ist die einzige Aussage, die stimmt, wenn nichts
// dasteht.

const istRichtung = (v: unknown): v is AdapterRichtung =>
  typeof v === 'string' && (ADAPTER_RICHTUNGEN as string[]).includes(v)

const istSpeisung = (v: unknown): v is AdapterSpeisung =>
  typeof v === 'string' && (ADAPTER_SPEISUNGEN as string[]).includes(v)

/**
 * Macht aus einem beliebigen Wert entweder eine brauchbare `AdapterSpec`
 * oder `undefined`.
 *
 * Verworfen wird, was nicht sagen kann, WAS der Adapter ist: ohne beide
 * Steckerseiten stuende auf dem Blatt „Adapter undefined ↔ undefined", und
 * das ist schlimmer als kein Eintrag. Alles andere wird auf `unbekannt`
 * heruntergesetzt statt geraten.
 */
export const normalisiereAdapter = (roh: unknown): AdapterSpec | undefined => {
  if (!roh || typeof roh !== 'object') return undefined
  const o = roh as Record<string, unknown>
  if (typeof o.von !== 'string' || !o.von) return undefined
  if (typeof o.nach !== 'string' || !o.nach) return undefined
  return {
    von: o.von as ConnectorType,
    nach: o.nach as ConnectorType,
    richtung: istRichtung(o.richtung) ? o.richtung : 'unbekannt',
    speisung: istSpeisung(o.speisung) ? o.speisung : 'unbekannt',
    ...(typeof o.hoechsterStandard === 'string'
      ? { hoechsterStandard: o.hoechsterStandard as SignalStandard }
      : {}),
    ...(typeof o.setztVoraus === 'string' && o.setztVoraus.trim()
      ? { setztVoraus: o.setztVoraus }
      : {}),
    ...(typeof o.notiz === 'string' && o.notiz.trim() ? { notiz: o.notiz } : {}),
  }
}

/**
 * Die erklaerten Merkmale eines Geraets (`kann`), aufgeraeumt.
 *
 * Leer wird zu `undefined` und nicht zu `[]`: die beiden bedeuten dasselbe
 * („nicht erklaert"), und zwei Schreibweisen fuer dieselbe Aussage lassen
 * jeden Vergleich zweimal danach fragen.
 */
export const normalisiereKann = (roh: unknown): string[] | undefined => {
  if (!Array.isArray(roh)) return undefined
  const sauber = roh
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
  return sauber.length ? sauber : undefined
}
