// ───────────────────────────────────────────────────────────────────────────
// DIE EINZELADER (B-45).
//
// Wunsch des Eigentuemers, 2026-09-08: „Zudem fehlen noch die Moeglichkeiten
// fuer ordentliche Stromplanung. Powerlock Kabel zieht man einzeln. Die
// muessen auch die Adern Farben bekommen."
//
// ═══════════════════════════════════════════════════════════════════════════
// WARUM DAS NICHT „EIN KABEL MIT MEHR FELDERN" IST
// ═══════════════════════════════════════════════════════════════════════════
//
// Im Plan ist ein Kabel EINE Verbindung von Anschluss zu Anschluss. Powerlock
// ist genau das nicht: man zieht JE LEITER EINE EIGENE LEITUNG. Ein
// 400-A-Anschluss sind fuenf Leitungen — L1, L2, L3, N, PE —, jede mit
// eigener Laenge, eigenem Weg und eigenem Steckerpaar.
//
// Wer das als „ein Kabel" plant, hat weder die richtige Stueckliste noch das
// richtige Gewicht noch die richtige Ziehliste; und auf der Baustelle liegen
// fuenf Leitungen, von denen der Plan eine kennt.
//
// Deshalb ZWEI Bauteile, und sie beantworten verschiedene Fragen:
//
//   ADER      Was fuehrt DIESES Kabel? Ein mehradriges Kabel fuehrt mehrere;
//             eine Powerlock-Leitung fuehrt genau eine.
//   ANSCHLUSS   Welche Leitungen bilden ZUSAMMEN einen Anschluss — und welche
//             Leiter muss er haben? Das `soll` ist der Kern: ohne es kann
//             keine Pruefung merken, dass vier gezogen wurden, wo fuenf
//             geplant waren. Genau dieser Fehler muss auffallen.
//
// ═══════════════════════════════════════════════════════════════════════════
// DIE FARBE IST KEINE KOSMETIK
// ═══════════════════════════════════════════════════════════════════════════
//
// Sie ist die einzige Angabe, an der auf der Baustelle haengt, welcher Leiter
// wohin gehoert. Ein vertauschter Aussenleiter dreht ein Drehfeld; ein als N
// gezogener Aussenleiter ist eine Gefahr. Die Farbe gehoert deshalb an die
// ADER — nicht an eine Beschriftung, nicht an das Kabel als Ganzes.
//
// ═══════════════════════════════════════════════════════════════════════════
// UND DESHALB IST HIER KEINE FARBNORM EINGEBAUT
// ═══════════════════════════════════════════════════════════════════════════
//
// `EINGEBAUTE_FARBNORMEN` ist LEER, und das ist eine Entscheidung und kein
// Versaeumnis. Die deutsche Neuinstallation, die aeltere Farbgebung mit
// anderen Aussenleiter-Farben und die nordamerikanische Zuordnung sind drei
// verschiedene Saetze. Welcher fuer eine Anlage gilt, steht nicht im Code.
//
// Eine geratene Vorgabe waere hier schlimmer als keine: sie saehe aus wie
// eine gepruefte Angabe, sie faerbte jede Ader ein, und die Pruefung
// bestaetigte sie anschliessend gegen sich selbst. Ein falsch voreingestellter
// Satz kostet mehr, als er spart — und er kostet es an einer Stelle, an der
// jemand mit Strom arbeitet.
//
// Eine Norm wird deshalb GEWAEHLT, und sie traegt ihre `herkunft` im
// Klartext: dieselbe Regel wie bei den Text-Protokoll-Vorlagen (Invariante
// 18) und dieselbe Haltung wie bei Invariante 21 — was nicht erklaert ist,
// bekommt keinen gruenen Haken.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

/** Welchen Leiter eine Ader fuehrt. */
import { einsetzen, type Platzhalterwerte } from '../lib/platzhalter'

export type LeiterRolle = 'L1' | 'L2' | 'L3' | 'N' | 'PE' | 'frei'

export const LEITER_ROLLE_LABEL = {
  L1: 'L1 (Aussenleiter 1)',
  L2: 'L2 (Aussenleiter 2)',
  L3: 'L3 (Aussenleiter 3)',
  N: 'N (Neutralleiter)',
  PE: 'PE (Schutzleiter)',
  frei: 'frei benannt',
} satisfies Record<LeiterRolle, string>

export const LEITER_ROLLEN = Object.keys(LEITER_ROLLE_LABEL) as LeiterRolle[]

export const istLeiterRolle = (v: unknown): v is LeiterRolle =>
  typeof v === 'string' && (LEITER_ROLLEN as string[]).includes(v)

/**
 * Eine Farbzuordnung, wie sie fuer diese Anlage gilt.
 *
 * `herkunft` ist PFLICHT und Klartext. Ohne sie waere die Norm eine Zahl
 * ohne Urheber, und die naechste Person kann nicht nachsehen, ob sie fuer
 * ihre Anlage stimmt.
 */
export interface Farbnorm {
  id: string
  name: string
  /** Woher diese Zuordnung stammt. Klartext, kein Verweis. */
  herkunft: string
  /** Rolle → Farbe. Nur was hier steht, gilt. */
  farben: Partial<Record<LeiterRolle, string>>
}

/**
 * EINGEBAUTE NORMEN: KEINE. Siehe den Kopf dieser Datei.
 *
 * Wer hier eine eintraegt, traegt damit die Behauptung ein, sie gelte —
 * und sie faerbt danach jede Ader jeder Anlage. `tests/adern.test.ts`
 * haelt die Liste leer und nennt den Grund.
 */
export const EINGEBAUTE_FARBNORMEN: Farbnorm[] = []

/** Eine Ader in einem Kabel. */
export interface Ader {
  id: string
  rolle: LeiterRolle
  /** Bezeichnung, wenn `rolle === 'frei'`. */
  bezeichnung?: string
  /**
   * Die Farbe DIESER Ader.
   *
   * Leer heisst „nicht gesetzt" — dann gilt die Farbe aus der Norm des
   * Anschlusss, sofern eine gewaehlt ist. Steht hier etwas, das der Norm
   * widerspricht, ist das ein Befund, ausser `abweichungsgrund` sagt warum.
   */
  farbe?: string
  /** Warum diese Ader von der Norm abweicht. Ohne Grund ist die Abweichung ein Befund. */
  abweichungsgrund?: string
  /**
   * Die Kodierung des Steckverbinders (Farbring, mechanische Kodierung).
   *
   * FREITEXT, und das mit Absicht: die Kodierung der Powerlock-Verbinder
   * steht im Herstellerdokument. Sie aus dem Gedaechtnis in eine Tabelle zu
   * schreiben waere genau der Fehler, den Invariante 18 benennt — bis ein
   * Dokument vorliegt, traegt der Nutzer sie ein.
   */
  kodierung?: string
}

/**
 * Mehrere Leitungen, die zusammen einen Anschluss bilden.
 *
 * `soll` ist der Grund, warum es dieses Bauteil ueberhaupt gibt: es ist der
 * SOLL-Stand. Ohne ihn koennte die Pruefung nur zaehlen, was da ist, und
 * nie merken, was fehlt.
 */
export interface Anschluss {
  id: string
  name: string
  /** Welche Leiter dieser Anschluss haben MUSS. */
  soll: LeiterRolle[]
  /** Die gewaehlte Farbnorm. Ohne sie ist keine Aderfarbe gepruefte Angabe. */
  farbnormId?: string
  notiz?: string
}

// ─── DIE PRUEFUNG ──────────────────────────────────────────────────────────

export type AnschlussBefundArt =
  /** Ein geplanter Leiter ist in keiner Leitung des Anschlusss zu finden. */
  | 'ader-fehlt'
  /** Derselbe Leiter kommt zweimal vor — welcher gilt? */
  | 'ader-doppelt'
  /** Eine Leitung haengt im Anschluss, sagt aber nicht, was sie fuehrt. */
  | 'leitung-stumm'
  /** Eine Aderfarbe widerspricht der gewaehlten Norm, ohne Grund. */
  | 'farbe-widerspricht'
  /** Es ist keine Norm gewaehlt — die Farben sind nicht gepruefte Angaben. */
  | 'norm-offen'

export const ANSCHLUSS_BEFUND_ART_LABEL = {
  'ader-fehlt': 'Ader fehlt',
  'ader-doppelt': 'Ader doppelt',
  'leitung-stumm': 'Leitung ohne Ader-Angabe',
  'farbe-widerspricht': 'Farbe widerspricht der Norm',
  'norm-offen': 'keine Farbnorm gewählt',
} satisfies Record<AnschlussBefundArt, string>

export interface AnschlussBefund {
  art: AnschlussBefundArt
  anschlussId: string
  /** Die betroffene Leitung, wo es eine gibt. */
  cableId?: string
  text: string
  /**
   * Schluessel und Werte dieses Satzes — uebersetzt wird beim Anzeigen, nicht
   * hier (siehe Kopf von `types/adapter.ts`): `format(tr(b.schluessel, b.text), b.werte)`.
   */
  schluessel: string
  werte: Platzhalterwerte
}

/** Was eine Leitung an das Anschluss meldet. */
export interface AnschlussLeitung {
  cableId: string
  /** Anzeige-Name der Leitung, fuer den Befundtext. */
  bezeichnung: string
  adern: Ader[]
}

/** Die Farbe, die fuer eine Ader GILT — gesetzte vor Norm, sonst keine. */
export const farbeDerAder = (ader: Ader, norm: Farbnorm | undefined): string | undefined =>
  ader.farbe ?? norm?.farben[ader.rolle]

/**
 * Alle Befunde eines Anschlusss.
 *
 * Die Reihenfolge ist die der Schwere, und das ist keine Kosmetik: eine
 * fehlende Ader ist eine Leitung, die auf der Baustelle nicht liegt; eine
 * fehlende Norm ist eine Angabe, die niemand eingetragen hat. Wer beide
 * gleich zeigt, laesst die erste in der zweiten untergehen.
 */
export const anschlussBefunde = (
  anschluss: Anschluss,
  leitungen: AnschlussLeitung[],
  norm: Farbnorm | undefined,
): AnschlussBefund[] => {
  const befunde: AnschlussBefund[] = []

  // Welche Rolle wie oft im Anschluss liegt.
  const zaehlung = new Map<LeiterRolle, number>()
  for (const l of leitungen) {
    for (const a of l.adern) zaehlung.set(a.rolle, (zaehlung.get(a.rolle) ?? 0) + 1)
  }

  // (1) Fehlt etwas aus dem Soll? Der Fehler, den ein Plan finden MUSS.
  for (const rolle of anschluss.soll) {
    if (!zaehlung.get(rolle)) {
      befunde.push({
        art: 'ader-fehlt',
        anschlussId: anschluss.id,
        schluessel: 'bundle.wireMissing',
        werte: { name: anschluss.name, role: rolle },
        text: einsetzen(
            '{name}: {role} is planned but recorded in no wire of this bundle.',
            { name: anschluss.name, role: rolle },
          ),
      })
    }
  }

  // (2) Doppelt — ausser bei `frei`, das ist ausdruecklich kein Leiter mit
  //     genau einer Stelle.
  for (const [rolle, anzahl] of zaehlung) {
    if (rolle !== 'frei' && anzahl > 1) {
      befunde.push({
        art: 'ader-doppelt',
        anschlussId: anschluss.id,
        schluessel: 'bundle.wireDuplicate',
        werte: { name: anschluss.name, role: rolle, n: anzahl },
        text: einsetzen(
            '{name}: {role} is in the bundle {n} times. Which wire applies?',
            { name: anschluss.name, role: rolle, n: anzahl },
          ),
      })
    }
  }

  // (3) Eine Leitung ohne Angabe. Sie zaehlt im Anschluss mit und sagt nichts.
  for (const l of leitungen) {
    if (l.adern.length === 0) {
      befunde.push({
        art: 'leitung-stumm',
        anschlussId: anschluss.id,
        cableId: l.cableId,
        schluessel: 'bundle.wireMute',
        werte: { name: anschluss.name, cable: l.bezeichnung },
        text: einsetzen(
            '{name}: "{cable}" belongs to the bundle but carries no conductor entry.',
            { name: anschluss.name, cable: l.bezeichnung },
          ),
      })
    }
  }

  // (4) Farbe gegen Norm — nur wo eine Norm gewaehlt IST.
  if (norm) {
    for (const l of leitungen) {
      for (const a of l.adern) {
        const ausNorm = norm.farben[a.rolle]
        if (!a.farbe || !ausNorm || a.abweichungsgrund) continue
        if (a.farbe.trim().toLowerCase() !== ausNorm.trim().toLowerCase()) {
          befunde.push({
            art: 'farbe-widerspricht',
            anschlussId: anschluss.id,
            cableId: l.cableId,
            schluessel: 'bundle.colourContradiction',
            werte: {
                name: anschluss.name,
                cable: l.bezeichnung,
                role: a.rolle,
                colour: a.farbe,
                norm: norm.name,
                expected: ausNorm,
              },
            text: einsetzen(
                '{name} · "{cable}": {role} is {colour}, the standard "{norm}" says {expected}. Without a reason that is a contradiction, not a special case.',
                {
                name: anschluss.name,
                cable: l.bezeichnung,
                role: a.rolle,
                colour: a.farbe,
                norm: norm.name,
                expected: ausNorm,
              },
              ),
          })
        }
      }
    }
  } else {
    // (5) Keine Norm. KEIN Fehler — aber auch kein Schweigen: ohne Norm ist
    //     keine Aderfarbe eine geprüfte Angabe, und Schweigen sähe auf dem
    //     Blatt aus wie „geprüft und in Ordnung".
    befunde.push({
      art: 'norm-offen',
      anschlussId: anschluss.id,
      schluessel: 'bundle.noColourStandard',
      werte: { name: anschluss.name },
      text: einsetzen(
          '{name}: no colour standard chosen - the conductor colours are unchecked. Which mapping applies to this installation is not in the program.',
          { name: anschluss.name },
        ),
    })
  }

  return befunde
}

// ─── SCHEMA-HEILUNG ────────────────────────────────────────────────────────

export const normalisiereAder = (roh: unknown, index: number): Ader | undefined => {
  if (!roh || typeof roh !== 'object') return undefined
  const o = roh as Record<string, unknown>
  if (!istLeiterRolle(o.rolle)) return undefined
  const id = typeof o.id === 'string' && o.id ? o.id : `ader-${index}`
  return {
    id,
    rolle: o.rolle,
    ...(typeof o.bezeichnung === 'string' && o.bezeichnung.trim()
      ? { bezeichnung: o.bezeichnung.trim() }
      : {}),
    ...(typeof o.farbe === 'string' && o.farbe.trim() ? { farbe: o.farbe.trim() } : {}),
    ...(typeof o.abweichungsgrund === 'string' && o.abweichungsgrund.trim()
      ? { abweichungsgrund: o.abweichungsgrund.trim() }
      : {}),
    ...(typeof o.kodierung === 'string' && o.kodierung.trim()
      ? { kodierung: o.kodierung.trim() }
      : {}),
  }
}

export const normalisiereAdern = (roh: unknown): Ader[] | undefined => {
  if (!Array.isArray(roh)) return undefined
  const sauber = roh
    .map((x, i) => normalisiereAder(x, i))
    .filter((x): x is Ader => !!x)
  return sauber.length ? sauber : undefined
}

/**
 * Eine Norm ohne `herkunft` wird VERWORFEN, nicht mit leerem Feld behalten.
 *
 * Sonst stuende in der Auswahl eine Norm, deren Urheber niemand nachlesen
 * kann — und sie faerbte trotzdem jede Ader. Das ist der Zustand, den der
 * Kopf dieser Datei ausschliesst.
 */
export const normalisiereFarbnorm = (roh: unknown): Farbnorm | undefined => {
  if (!roh || typeof roh !== 'object') return undefined
  const o = roh as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id) return undefined
  if (typeof o.name !== 'string' || !o.name.trim()) return undefined
  if (typeof o.herkunft !== 'string' || !o.herkunft.trim()) return undefined
  const farben: Partial<Record<LeiterRolle, string>> = {}
  const rohFarben = (o.farben ?? {}) as Record<string, unknown>
  for (const rolle of LEITER_ROLLEN) {
    const wert = rohFarben[rolle]
    if (typeof wert === 'string' && wert.trim()) farben[rolle] = wert.trim()
  }
  return { id: o.id, name: o.name.trim(), herkunft: o.herkunft.trim(), farben }
}

export const normalisiereAnschluss = (
  roh: unknown,
  bekannteNormen: Set<string>,
): Anschluss | undefined => {
  if (!roh || typeof roh !== 'object') return undefined
  const o = roh as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id) return undefined
  if (typeof o.name !== 'string' || !o.name.trim()) return undefined
  const soll = Array.isArray(o.soll) ? o.soll.filter(istLeiterRolle) : []
  return {
    id: o.id,
    name: o.name.trim(),
    soll,
    // Ein Zeiger auf eine geloeschte Norm faellt WEG. Er saehe in der Anzeige
    // aus wie eine gewaehlte Norm und faerbte nichts — schlimmer als das
    // ehrliche „keine gewaehlt".
    ...(typeof o.farbnormId === 'string' && bekannteNormen.has(o.farbnormId)
      ? { farbnormId: o.farbnormId }
      : {}),
    ...(typeof o.notiz === 'string' && o.notiz.trim() ? { notiz: o.notiz.trim() } : {}),
  }
}

/** Kurzform einer Ader fuer Ziehliste und Etikett: „L1 (braun)". */
export const aderKurz = (ader: Ader, norm: Farbnorm | undefined): string => {
  const name = ader.rolle === 'frei' ? (ader.bezeichnung || 'frei') : ader.rolle
  const farbe = farbeDerAder(ader, norm)
  return farbe ? `${name} (${farbe})` : name
}
