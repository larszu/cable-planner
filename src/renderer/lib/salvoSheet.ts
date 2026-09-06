// ───────────────────────────────────────────────────────────────────────────
// Der Umbau-Zettel: nur was sich ändert (Bedarf 121, P4).
//
//   > A printed paper sheet of routes is RE-KEYED INTO A 40x40 VIDEOHUB
//   > BEFORE EVERY CHANGEOVER.
//
// Belegt an `bitfocus/companion-module-bmd-videohub#9` (2020-10, weiterhin
// offen), wörtlich: „I have a paper sheet of routes for our BMD 40x40 that I
// need to manually enter before each change over" — eine Halle, die zwischen
// Baseball und Softball wechselt.
//
// ─── WAS SCHON DA WAR ──────────────────────────────────────────────────────
//
// Benannte Kreuzpunkt-Sätze („Salvos") gibt es seit Initiative 10, und
// `routingDifferences` vergleicht den Plan mit dem, was das Gerät meldet.
// Was fehlte, ist genau das Blatt, das der Beleg beschreibt — und die
// Einsicht, dass es das FALSCHE Blatt ist:
//
//   Wer vor dem Umbau alle vierzig Zeilen abtippt, tippt achtunddreissig
//   davon unverändert ab. Der Zettel, der die Arbeit wirklich spart, ist
//   nicht der Zustand, sondern der UNTERSCHIED.
//
// Deshalb gibt es hier zwei Blätter und nicht eines:
//
//   `salvoTable`      der volle Zustand — für den Ordner, für die Übergabe,
//                     und für den Fall, dass jemand bei Null anfängt.
//   `changeoverTable` NUR die Kreuzpunkte, die sich ändern, mit Vorher und
//                     Nachher. Das ist der Zettel für den Umbau.
//
// ─── NUMMERN, WIE SIE AUF DEM GERÄT STEHEN ─────────────────────────────────
//
// Intern sind Ein- und Ausgänge 0-basiert (so kommen sie über das
// Videohub-Protokoll). Auf dem PAPIER steht die Nummer, die am Gerät
// aufgedruckt ist, und die fängt bei 1 an. Diese Umrechnung passiert HIER,
// einmal, und nicht in jedem Aufrufer — eine Liste, die um eins verschoben
// ist, führt beim Umbau zum falschen Kreuzpunkt, und das merkt man erst,
// wenn das Bild falsch ist.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { EquipmentItem, VideohubCrosspoints, VideohubSalvo } from '../types/equipment'
import { routingDifferences } from './videohubRouting'
import { portDisplayLabel } from './portLabel'
import type { CsvTable } from './csv'

/** Was auf dem Blatt steht, wo keine Beschriftung hinterlegt ist. */
export const NO_PORT_LABEL = 'ohne Beschriftung'
/** Was in der Vorher-/Nachher-Spalte steht, wo der Satz nichts sagt. */
export const NOT_SET = 'nicht gesetzt'

/**
 * Beschriftungen je Ein-/Ausgang, 0-basiert.
 *
 * Kommt fertig herein: die Auflösung „welcher Text gehört zu diesem Port"
 * liegt in `exportVideohub.displayFor` und hängt an Rollen und Kabelgraph.
 * Sie hier ein zweites Mal zu bauen wäre die zweite Wahrheit, die ADR-001
 * überall sonst verbietet — und sie liefe sofort auseinander, weil die
 * Rollen-Auflösung sich weiterentwickelt.
 */
export interface PortLabels {
  inputs: ReadonlyArray<string>
  outputs: ReadonlyArray<string>
}

/**
 * Beschriftungen aus einem Gerät, ohne Rollen-Auflösung.
 *
 * Der einfache Fall für Aufrufer, die den Kabelgraphen nicht haben (Druck,
 * Export). Wer ihn hat, reicht `roleLabels`-aufgelöste Texte herein und
 * bekommt dieselben Namen, die auch im Videohub landen.
 */
export const portLabelsOf = (device: Pick<EquipmentItem, 'inputs' | 'outputs'>): PortLabels => ({
  inputs: device.inputs.map((p) => portDisplayLabel(p) || ''),
  outputs: device.outputs.map((p) => portDisplayLabel(p) || ''),
})

const label = (labels: ReadonlyArray<string>, index: number | undefined): string => {
  if (index === undefined) return NOT_SET
  return labels[index]?.trim() || NO_PORT_LABEL
}

/** Die Nummer, wie sie am Gerät aufgedruckt ist (1-basiert). */
export const printedNumber = (index: number): number => index + 1

export const SALVO_HEADERS = ['Ausgang', 'Ziel (Beschriftung)', 'Eingang', 'Quelle'] as const

/**
 * Der volle Zustand eines Satzes — die Papierseite, die es heute schon gibt.
 *
 * Sortiert nach Ausgang, weil so umgesteckt wird: man geht die Ausgänge
 * durch und stellt für jeden die Quelle ein.
 */
export function salvoTable(routing: VideohubCrosspoints, labels: PortLabels): CsvTable {
  // Das `sort` ist HEUTE redundant — nicht-negative Ganzzahl-Schluessel
  // liefert `Object.keys` von sich aus aufsteigend, und der Filter darueber
  // laesst nur solche durch. Die Gegenprobe hat das aufgedeckt: die Zeile
  // wegzunehmen aendert nichts.
  //
  // Sie bleibt trotzdem, und das ist der Unterschied zu einer wirkungslosen
  // ABFRAGE (die gehoert heraus): hier haengt die Redundanz am Filter
  // darueber. Wer den Filter lockert — etwa um negative Schluessel zu melden
  // statt sie wegzuwerfen —, faellt sonst still auf Einfuegereihenfolge
  // zurueck, und eine falsch sortierte Liste fuehrt beim Umbau zum falschen
  // Kreuzpunkt. Der Test haelt die REIHENFOLGE fest, nicht diese Zeile.
  const outputs = Object.keys(routing)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0)
    .sort((a, b) => a - b)
  return {
    headers: [...SALVO_HEADERS],
    rows: outputs.map((o) => [
      printedNumber(o),
      label(labels.outputs, o),
      printedNumber(routing[o]),
      label(labels.inputs, routing[o]),
    ]),
  }
}

export interface CrosspointChange {
  /** 0-basierter Ausgang. */
  output: number
  /** Eingang im Ausgangs-Satz, oder undefined wenn dieser nichts sagt. */
  from?: number
  /** Eingang im Ziel-Satz, oder undefined wenn dieser nichts sagt. */
  to?: number
}

/**
 * Was sich zwischen zwei Sätzen ändert.
 *
 * Rechnet NICHT selbst, sondern schreibt `routingDifferences` um: dort
 * heissen die beiden Seiten `planned` und `live`, weil die Funktion für den
 * Abgleich Plan-gegen-Gerät gebaut wurde (Initiative 10). Die Rechnung ist
 * dieselbe — „was sagt Seite A, was sagt Seite B, wo sind sie ungleich" —,
 * und sie zweimal zu haben hiesse, sie zweimal zu pflegen. Umbenannt wird
 * trotzdem: `planned`/`live` auf einem Umbau-Zettel wäre schlicht falsch, es
 * ist zweimal ein Plan.
 */
export function salvoChanges(
  from: VideohubCrosspoints,
  to: VideohubCrosspoints,
): CrosspointChange[] {
  return routingDifferences(from, to).map((d) => ({
    output: d.output,
    ...(d.planned !== undefined ? { from: d.planned } : {}),
    ...(d.live !== undefined ? { to: d.live } : {}),
  }))
}

export const CHANGEOVER_HEADERS = [
  'Ausgang',
  'Ziel (Beschriftung)',
  'Vorher',
  'Nachher',
  'Neue Quelle',
] as const

/**
 * Der Umbau-Zettel: nur die Kreuzpunkte, die sich ändern.
 *
 * DAS ist die Antwort auf den Beleg. Wer zwischen Baseball und Softball
 * wechselt, steckt nicht vierzig Kreuzpunkte, sondern die vier, die anders
 * sind — und tippt die übrigen sechsunddreissig nicht ab, nur um zu sehen,
 * dass sie gleich bleiben.
 *
 * Ein leeres Blatt ist hier eine ANTWORT und kein Fehler: die beiden Sätze
 * sind gleich, es ist nichts umzustecken.
 */
export function changeoverTable(
  from: VideohubCrosspoints,
  to: VideohubCrosspoints,
  labels: PortLabels,
): CsvTable {
  return {
    headers: [...CHANGEOVER_HEADERS],
    rows: salvoChanges(from, to).map((c) => [
      printedNumber(c.output),
      label(labels.outputs, c.output),
      c.from === undefined ? NOT_SET : printedNumber(c.from),
      c.to === undefined ? NOT_SET : printedNumber(c.to),
      label(labels.inputs, c.to),
    ]),
  }
}

/** Salvo nach Id — ohne `find` beim Aufrufer, damit „gibt es nicht" EIN Fall ist. */
export const salvoById = (
  salvos: ReadonlyArray<VideohubSalvo>,
  id: string | undefined,
): VideohubSalvo | undefined => (id ? salvos.find((s) => s.id === id) : undefined)

export type SalvoFindingKind =
  /** Zwei Sätze mit demselben Namen. */
  | 'duplicate-name'
  /** Ein Satz, der zu keinem Ausgang etwas sagt. */
  | 'empty-salvo'
  /** Ein Satz sagt zu Ausgängen etwas, die ein anderer nicht kennt. */
  | 'partial-coverage'

export interface SalvoFinding {
  kind: SalvoFindingKind
  severity: 'error' | 'warning'
  subject: string
  message: string
}

/**
 * Befunde über die Satz-Sammlung.
 *
 * `partial-coverage` ist der unangenehme: zwei Sätze, die verschiedene
 * Ausgänge abdecken, ergeben einen Umbau-Zettel mit „nicht gesetzt" — und
 * beim Umbau steht dann jemand vor einem Ausgang und weiss nicht, ob er ihn
 * lassen oder ändern soll. Der Befund sagt das VOR dem Druck.
 */
export function salvoFindings(salvos: ReadonlyArray<VideohubSalvo>): SalvoFinding[] {
  const out: SalvoFinding[] = []
  const gesehen = new Map<string, number>()
  for (const s of salvos) {
    const key = s.name.trim().toLowerCase()
    if (key) gesehen.set(key, (gesehen.get(key) ?? 0) + 1)
    if (Object.keys(s.routing).length === 0) {
      out.push({
        kind: 'empty-salvo',
        severity: 'warning',
        subject: s.name,
        message: `"${s.name}" sagt zu keinem Ausgang etwas — er stellt beim Aufruf nichts um.`,
      })
    }
  }
  for (const [key, anzahl] of gesehen) {
    if (anzahl < 2) continue
    const name = salvos.find((s) => s.name.trim().toLowerCase() === key)?.name ?? key
    out.push({
      kind: 'duplicate-name',
      severity: 'error',
      subject: name,
      message:
        `${anzahl} Sätze heissen "${name}". Wer am Telefon „fahr Satz X" sagt, meint dann zwei ` +
        'verschiedene Zustände.',
    })
  }
  // Deckungslücken paarweise, aber nur EINMAL je Paar.
  for (let i = 0; i < salvos.length; i++) {
    for (let j = i + 1; j < salvos.length; j++) {
      const a = salvos[i]
      const b = salvos[j]
      const nurA = Object.keys(a.routing).filter((o) => b.routing[Number(o)] === undefined)
      const nurB = Object.keys(b.routing).filter((o) => a.routing[Number(o)] === undefined)
      if (nurA.length === 0 && nurB.length === 0) continue
      out.push({
        kind: 'partial-coverage',
        severity: 'warning',
        subject: `${a.name} / ${b.name}`,
        message:
          `"${a.name}" und "${b.name}" decken verschiedene Ausgänge ab ` +
          `(${nurA.length} nur hier, ${nurB.length} nur dort). Auf dem Umbau-Zettel steht dort ` +
          `"${NOT_SET}", und davor steht beim Umbau jemand ratlos.`,
      })
    }
  }
  return out
}
