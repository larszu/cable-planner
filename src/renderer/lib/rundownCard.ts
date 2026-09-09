// ───────────────────────────────────────────────────────────────────────────
// BEDARF 10 — die Karte fuer EINE Position, und was sich seit dem letzten
// Blick daran geaendert hat.
//
// Zwei Funktionen, zwei Fragen, und sie werden ausdruecklich nicht vermischt:
//
//   `positionsKarte`  — was steht jetzt an meinem Platz?
//   `aenderungen`     — was ist daran anders als bei meinem letzten Blick?
//
// Der Bedarf verlangt beides („the current rundown … with changes VISIBLY
// MARKED"), aber die zweite Frage braucht einen zweiten Stand, und den hat
// nicht jeder Aufrufer. Wer sie in eine Funktion zwaenge, muesste beim ersten
// Oeffnen einen Vergleichsstand erfinden — und „alles neu" ist beim ersten
// Oeffnen eine Falschmeldung, kein Hinweis.
//
// ═══════════════════════════════════════════════════════════════════════════
// JEDER ABSCHNITT STEHT AUF DER KARTE, AUCH DER OHNE AUFTRAG
// ═══════════════════════════════════════════════════════════════════════════
//
// Der naheliegende Schnitt waere, nur die Abschnitte zu zeigen, in denen diese
// Kamera etwas macht. Er ist falsch, und zwar auf die gefaehrliche Art: die
// Karte zeigte dann eine kuerzere Show als die, die laeuft. Wer bei Abschnitt 7
// nachsieht und 5, 6, 7 nicht findet, weiss nicht, ob er sie verpasst hat.
//
// Ein Abschnitt ohne Eintrag heisst deshalb „kein Auftrag eingetragen" — und
// ausdruecklich NICHT „frei". Das ist derselbe Unterschied wie `unknown` gegen
// `unaffected` in `changeImpact`: die eine Auskunft ist eine Beobachtung, die
// andere waere eine Freigabe, die niemand gegeben hat.
//
// ═══════════════════════════════════════════════════════════════════════════
// EINE FREMDE AENDERUNG IST KEINE AENDERUNG AN MEINER KARTE
// ═══════════════════════════════════════════════════════════════════════════
//
// Das ist die Regel, wegen der der Bedarf „PER-ROLE" sagt. Wenn die Regie den
// Auftrag von Kamera 3 aendert, darf an der Karte von Kamera 1 nichts
// aufleuchten. Ein Aenderungsbalken, der bei jeder fremden Aenderung blinkt,
// wird nach dem dritten Mal ignoriert — und dann sieht ihn niemand mehr, wenn
// er einmal die eigene Position meint.
//
// KEINE UHR. Beide Funktionen sind rein: sie bekommen die Staende und geben
// eine Ableitung zurueck.
// ───────────────────────────────────────────────────────────────────────────

import type { RundownPlan, RundownSegment, SegmentCoverage } from '../types/rundown'

/** Eine Zeile der Karte: ein Abschnitt und mein Auftrag darin. */
export interface KartenZeile {
  segment: RundownSegment
  /** Position im Ablauf, ab 1. Gerechnet, nicht gespeichert. */
  position: number
  /** Mein Auftrag. Fehlt er, ist keiner eingetragen — nicht „frei". */
  coverage?: SegmentCoverage
}

export interface PositionsKarte {
  sourceId: string
  zeilen: KartenZeile[]
  /** Wie viele Abschnitte einen Auftrag fuer diese Position tragen. */
  mitAuftrag: number
  /** Woher der Ablauf stammt und mit welchem Stand — gehoert auf die Karte. */
  source: string
  revision?: string
  importedAt?: string
}

/**
 * Die Karte fuer eine Position.
 *
 * Die Reihenfolge ist die des ABLAUFS und nicht die der Zuordnungsliste. Wer
 * sie aus `coverage` naehme, bekaeme die Reihenfolge, in der jemand die
 * Auftraege eingetragen hat — und die hat mit der Show nichts zu tun.
 */
export const positionsKarte = (plan: RundownPlan, sourceId: string): PositionsKarte => {
  const meine = new Map<string, SegmentCoverage>()
  for (const c of plan.coverage) {
    // Ein zweiter Eintrag fuer dieselbe Position im selben Abschnitt ist ein
    // Widerspruch in der Eingabe. Der erste gewinnt, weil ein spaeter
    // angehaengter Eintrag den urspruenglichen sonst still ueberschreibt.
    if (c.sourceId === sourceId && !meine.has(c.segmentId)) meine.set(c.segmentId, c)
  }

  const zeilen = plan.segments.map((segment, i) => {
    const coverage = meine.get(segment.id)
    return { segment, position: i + 1, ...(coverage ? { coverage } : {}) }
  })

  return {
    sourceId,
    zeilen,
    mitAuftrag: zeilen.filter((z) => z.coverage !== undefined).length,
    source: plan.source,
    ...(plan.revision !== undefined ? { revision: plan.revision } : {}),
    ...(plan.importedAt !== undefined ? { importedAt: plan.importedAt } : {}),
  }
}

/**
 * Was mit einem Abschnitt seit dem letzten Blick passiert ist.
 *
 * WARUM `anders`/`gleich` UND NICHT `geaendert`/`unveraendert`: der
 * ASCII-Drift-Waechter (`tests/asciiDrift.test.ts`) sieht String-Literale und
 * kann einem Unterscheidungswert nicht ansehen, dass er Code ist und keine
 * Anzeige. Die Woerter in seine Ausnahmeliste zu schreiben waere die teurere
 * Loesung: sie machte ihn genau fuer die Woerter blind, bei denen er in einer
 * Oberflaechen-Zeichenkette recht haette — und „geaendert" steht in dieser
 * Oberflaeche an mehreren Stellen als Text. Ein interner Wert kostet beim
 * Umbenennen nichts.
 */
export type AenderungsArt =
  /** Neu im Ablauf. */
  | 'neu'
  /** Nicht mehr im Ablauf — steht trotzdem in der Liste, siehe unten. */
  | 'entfallen'
  /** Abschnittstext ODER mein Auftrag ist anders. */
  | 'anders'
  | 'gleich'

export interface AenderungsZeile {
  segmentId: string
  art: AenderungsArt
  /**
   * Die Position von FRUEHER, wenn der Abschnitt verschoben wurde.
   *
   * Bewusst NEBEN `art` und nicht darin: Verschieben und Inhaltsaenderung
   * sind zwei Tatsachen. In einen Wert gepresst ginge eine von beiden
   * verloren, und welche, entschiede eine Vorrangregel, die niemand
   * nachlesen kann.
   */
  vorherPosition?: number
  /** Die Position jetzt. Fehlt bei `entfallen`. */
  jetztPosition?: number
}

export interface Aenderungen {
  zeilen: AenderungsZeile[]
  neu: number
  entfallen: number
  geaendert: number
  verschoben: number
  /** Nichts davon: die Karte ist dieselbe wie beim letzten Blick. */
  unveraendert: boolean
}

const segmentGleich = (a: RundownSegment, b: RundownSegment): boolean =>
  a.title === b.title && (a.number ?? '') === (b.number ?? '') && (a.note ?? '') === (b.note ?? '')

const auftragGleich = (
  a: SegmentCoverage | undefined,
  b: SegmentCoverage | undefined,
): boolean => {
  // Beide fehlen: gleich. Genau einer fehlt: der Auftrag ist neu oder weg,
  // und beides ist eine Aenderung an MEINER Karte.
  if (!a || !b) return !a && !b
  return a.shot === b.shot && (a.note ?? '') === (b.note ?? '')
}

/**
 * Was sich an MEINER Karte geaendert hat.
 *
 * `vorher` ist der Stand, den diese Position zuletzt gesehen hat — nicht
 * irgendein aelterer. Der Aufrufer haelt ihn fest; hier steht keine Uhr und
 * kein Gedaechtnis.
 *
 * ENTFALLENE ABSCHNITTE BLEIBEN IN DER LISTE. Ein Abschnitt, der aus dem
 * Ablauf genommen wurde, ist die wichtigste Nachricht ueberhaupt fuer jemanden,
 * der ihn auf seinem Ausdruck stehen hat. Ihn wegzulassen hiesse, die Aenderung
 * dadurch mitzuteilen, dass etwas fehlt.
 */
export const aenderungen = (
  vorher: RundownPlan,
  jetzt: RundownPlan,
  sourceId: string,
): Aenderungen => {
  const alt = positionsKarte(vorher, sourceId)
  const neuKarte = positionsKarte(jetzt, sourceId)

  const altNach = new Map(alt.zeilen.map((z) => [z.segment.id, z]))
  const jetztNach = new Map(neuKarte.zeilen.map((z) => [z.segment.id, z]))

  const zeilen: AenderungsZeile[] = []

  for (const z of neuKarte.zeilen) {
    const vorherZeile = altNach.get(z.segment.id)
    if (!vorherZeile) {
      zeilen.push({ segmentId: z.segment.id, art: 'neu', jetztPosition: z.position })
      continue
    }
    const inhaltGleich =
      segmentGleich(vorherZeile.segment, z.segment) &&
      // Und HIER steht die Regel, wegen der der Bedarf „per role" sagt: es
      // wird nur MEIN Auftrag verglichen. Was die Regie an Kamera 3 aendert,
      // laesst diese Karte kalt.
      auftragGleich(vorherZeile.coverage, z.coverage)
    zeilen.push({
      segmentId: z.segment.id,
      art: inhaltGleich ? 'gleich' : 'anders',
      jetztPosition: z.position,
      ...(vorherZeile.position !== z.position ? { vorherPosition: vorherZeile.position } : {}),
    })
  }

  for (const z of alt.zeilen) {
    if (jetztNach.has(z.segment.id)) continue
    zeilen.push({ segmentId: z.segment.id, art: 'entfallen', vorherPosition: z.position })
  }

  const zaehle = (art: AenderungsArt) => zeilen.filter((z) => z.art === art).length
  const verschoben = zeilen.filter((z) => z.art !== 'entfallen' && z.vorherPosition !== undefined).length

  return {
    zeilen,
    neu: zaehle('neu'),
    entfallen: zaehle('entfallen'),
    geaendert: zaehle('anders'),
    verschoben,
    unveraendert:
      zaehle('neu') === 0 && zaehle('entfallen') === 0 && zaehle('anders') === 0 && verschoben === 0,
  }
}

/**
 * Einen geladenen Ablauf normalisieren (Schema-Migration beim Laden).
 *
 * `null` heisst „kein Ablauf eingelesen" — und das ist etwas anderes als ein
 * eingelesener Ablauf ohne Abschnitte. Ein leeres Objekt statt `undefined`
 * zurueckzugeben hiesse, jedem Projekt ab jetzt einen leeren Ablauf
 * anzuhaengen, und der Datei-Vergleich zweier unveraenderter Projekte zeigte
 * einen Unterschied.
 *
 * ZUORDNUNGEN INS LEERE WERDEN VERWORFEN. Ein `coverage`-Eintrag auf einen
 * Abschnitt, den es nicht (mehr) gibt, kann nie angezeigt werden — er saehe
 * in der Datei aus wie ein Auftrag, den jemand erteilt hat. Verworfen wird
 * er, nicht heimlich umgehaengt.
 */
export const normaliseRundown = (raw: unknown): RundownPlan | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Partial<RundownPlan>
  const segments = Array.isArray(r.segments)
    ? r.segments.filter(
        (s): s is RundownSegment =>
          !!s && typeof s.id === 'string' && typeof s.title === 'string',
      )
    : []
  const bekannt = new Set(segments.map((s) => s.id))
  const coverage = Array.isArray(r.coverage)
    ? r.coverage.filter(
        (c): c is SegmentCoverage =>
          !!c &&
          typeof c.segmentId === 'string' &&
          typeof c.sourceId === 'string' &&
          typeof c.shot === 'string' &&
          bekannt.has(c.segmentId),
      )
    : []
  if (segments.length === 0 && coverage.length === 0) return undefined
  return {
    // Eine Herkunft, die niemand genannt hat, wird nicht erfunden — sie wird
    // benannt. „Unbekannt" auf der Karte ist eine Auskunft; ein leerer Platz
    // sieht aus, als sei die Frage nicht gestellt worden.
    source: typeof r.source === 'string' && r.source.trim() ? r.source : 'Herkunft unbekannt',
    ...(typeof r.revision === 'string' ? { revision: r.revision } : {}),
    ...(typeof r.importedAt === 'string' ? { importedAt: r.importedAt } : {}),
    segments,
    coverage,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// EINLESEN — und warum die Kennung eines Abschnitts NICHT erfunden wird
// ───────────────────────────────────────────────────────────────────────────
//
// Der Ablauf kommt als Text: aus einer Tabellenkalkulation kopiert, aus einer
// Mail, aus einem Sendeablauf-Auszug. Drei Spalten, mit Tabulator oder
// Semikolon getrennt: Nummer, Titel, Notiz.
//
// DIE TRAGENDE ENTSCHEIDUNG STEHT IN DER KENNUNG. Vergaebe dieses Einlesen
// frische Ids, dann waere nach jedem neuen Stand JEDER Abschnitt „neu" und
// jeder alte „entfallen" — der Aenderungsbalken zeigte alles rot, und zwar
// genau in dem Augenblick, fuer den es ihn gibt. Und schlimmer: die
// Zuordnungen zeigten ins Leere, `normaliseRundown` verwuerfe sie, und die
// Auftraege aller Kameras waeren weg. Still.
//
// Die Kennung wird deshalb aus dem Inhalt ABGELEITET, in dieser Reihenfolge:
//
//   1. Die NUMMER, wenn die Quelle eine gibt. Sie ist das, was in der Regie
//      gesagt wird („wir sind in 4"), und sie ueberlebt eine Umformulierung
//      des Titels — genau deshalb bleibt der Auftrag haengen, wenn die
//      Redaktion den Titel aendert.
//   2. Sonst der TITEL. Schwaecher, aber besser als eine Zufallszahl.
//   3. Bei Dopplung ein Zusatz `#2`, `#3` — deterministisch aus der
//      Reihenfolge, damit zweimaliges Einlesen desselben Textes dieselben
//      Kennungen ergibt.
//
// Was diese Regel NICHT kann, und das steht hier, damit es niemand fuer einen
// Fehler haelt: wenn die Redaktion die Nummern neu vergibt, reisst die
// Zuordnung. Das ist kein Versehen der Ableitung, sondern die Tatsache
// dahinter — dann IST es ein anderer Ablauf, und die Zuordnung neu zu
// erfinden waere schlimmer als sie zu verlieren.

/** Ein Fund beim Einlesen — gemeldet, nicht stillschweigend geheilt. */
export interface AblaufFund {
  zeile: number
  text: string
  grund: 'leer' | 'ohne-titel'
}

export interface AblaufLesung {
  segments: RundownSegment[]
  funde: AblaufFund[]
}

const trenner = (zeile: string): string[] =>
  (zeile.includes('\t') ? zeile.split('\t') : zeile.split(';')).map((f) => f.trim())

/**
 * Abschnitte aus eingefuegtem Text lesen.
 *
 * Rein: kein Datei-IO, keine Uhr, keine Kennungs-Erfindung. Der Aufrufer
 * setzt `source`, `revision` und `importedAt` — was diese Funktion nicht
 * weiss, erfindet sie nicht.
 */
export const ablaufAusText = (text: string): AblaufLesung => {
  const segments: RundownSegment[] = []
  const funde: AblaufFund[] = []
  const vergeben = new Map<string, number>()

  text.split(/\r?\n/).forEach((roh, i) => {
    const zeile = i + 1
    if (roh.trim() === '') return
    const felder = trenner(roh)
    // Eine Spalte: das ist der Titel. Zwei oder mehr: Nummer, Titel, Notiz.
    const nummer = felder.length > 1 ? felder[0] : ''
    const titel = felder.length > 1 ? felder[1] : felder[0]
    const notiz = felder.length > 2 ? felder.slice(2).join(' ').trim() : ''

    if (!titel) {
      // Eine Zeile mit Nummer und ohne Titel ist keine Zeile, die man
      // stillschweigend weglassen darf: sie stand im Ablauf.
      funde.push({ zeile, text: roh.trim(), grund: nummer ? 'ohne-titel' : 'leer' })
      return
    }

    const basis = nummer || titel
    const schonDa = vergeben.get(basis) ?? 0
    vergeben.set(basis, schonDa + 1)
    const id = schonDa === 0 ? basis : `${basis}#${schonDa + 1}`

    segments.push({
      id,
      ...(nummer ? { number: nummer } : {}),
      title: titel,
      ...(notiz ? { note: notiz } : {}),
    })
  })

  return { segments, funde }
}
