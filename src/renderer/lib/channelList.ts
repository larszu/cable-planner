// ───────────────────────────────────────────────────────────────────────────
// Eine Kanalliste, fuenf Sichten (Bedarf 37, P1).
//
// DER BEFUND, und er ist eine Kette aus Abschriften:
//
//   > Band's rider in Word/Pages -> e-mail -> house input list in Excel ->
//   > console scene -> stage box labels. A working engineer reports having to
//   > fill out a standalone patch list AND a second one inside the tech rider
//   > section of the same tool.
//
// Belegt an `SoundDocs/sounddocs#111` (2025-10-10): jemand muss dieselbe
// Patch-Liste zweimal ausfuellen und bittet darum, dass die eine die andere
// referenziert, damit Aenderungen durchschlagen.
//
// ─── DIE ANWEISUNG DER BEDARFS-DATENBANK IST WOERTLICH UND SCHARF ──────────
//
//   > cable-planner #353 already ships the input-list deliverable with the
//   > right fields. Next step is PROJECTIONS of one dataset, NOT MORE FIELDS:
//   > band view, venue view (port), monitor-mix view, stage view, console view.
//
// Also: kein neues Datenmodell, keine neuen Felder. Was hier entsteht, ist die
// Zusammenstellung dessen, was der Plan schon weiss — einmal berechnet, fuenf
// Mal anders geschnitten. Wer eine Sicht liest, sieht seine Spalten und nicht
// die der anderen; wer die Quelle aendert, aendert alle fuenf.
//
// ─── DIE MONITOR-SICHT ZEIGT WEGE, NICHT MIX-INHALTE ───────────────────────
//
// Was in einem Monitor-Mix liegt, entscheidet der Monitormann am Pult; der
// Plan kann es nicht wissen, und ein Feld dafuer waeren genau die „more
// fields", die der Bedarf ausschliesst. Was der Plan WEISS, ist der Weg:
// welcher Mischer-Ausgang auf welchen Wedge oder welche IEM-Strecke geht. Das
// steht im Kabelgraphen und ist nachpruefbar. Die Sicht heisst deshalb
// „Monitor-Wege" und nicht „Monitor-Mixe" — der Unterschied ist der zwischen
// einer Ableitung und einer Behauptung.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { Cable } from '../types/cable'
import type { EquipmentItem, Port } from '../types/equipment'
import type { CsvCell, CsvTable } from './csv'
import { topLayer, detectLayerForConnector } from './cableLayers'
import { portDisplayLabel } from './portLabel'
import { fitToTarget, LABEL_TARGETS } from './labelTargets'

/** Eine Zeile der EINEN Kanalliste. Alle fuenf Sichten schneiden hieraus. */
export interface ChannelRow {
  /** Kanalnummer, 1-basiert, in der Reihenfolge der Liste. */
  ch: number
  /** Das Kabel, aus dem die Zeile stammt — der Beleg. */
  cableId: string
  /** Quelle: das Geraet am anderen Ende (Mikro, DI, Playback …). */
  source: string
  /** Was die Quelle ist, soweit der Katalog es sagt (Untertitel/Kategorie). */
  sourceKind?: string
  /** Port an der Quelle. */
  sourcePort: string
  /** Ziel: Stagebox, Pult, Interface. */
  destination: string
  /** Port am Ziel — die Patch-Nummer, die auf dem Blech steht. */
  destinationPort: string
  /** Steckverbinder. */
  connector: string
  /** Kabellaenge in Metern, wenn gepflegt. */
  lengthM?: number
  /** Position der Quelle auf der Buehne, in Plan-Einheiten. */
  x?: number
  y?: number
}

/**
 * Die Kanalliste aus dem Plan.
 *
 * Grundlage sind die Kabel der Audio-Ebene — dieselbe Auswahl, die die
 * Eingangsliste aus `#353` trifft, nur an einer Stelle statt im Dialog. Die
 * Ebene wird abgeleitet, wenn sie nicht gepflegt ist: `detectLayerForConnector`
 * ist die Regel, die der Planer beim Anlegen ohnehin anwendet. Ein Kabel ohne
 * gepflegte Ebene faellt sonst aus der Liste, obwohl sein XLR-Stecker
 * eindeutig ist.
 */
export function buildChannelList(equipment: EquipmentItem[], cables: Cable[]): ChannelRow[] {
  const byId = new Map(equipment.map((e) => [e.id, e]))
  const portOf = (e: EquipmentItem | undefined, id: string): Port | undefined =>
    e ? [...(e.inputs ?? []), ...(e.outputs ?? [])].find((p) => p.id === id) : undefined

  const audio = cables.filter((c) => {
    const gepflegt = topLayer(c.layer)
    if (gepflegt) return gepflegt === 'audio'
    return detectLayerForConnector(c.type) === 'audio'
  })

  // Sortiert nach Ziel-Port, dann Quelle: das ist die Reihenfolge, in der
  // jemand die Stagebox absteckt. Eine Liste in Anlege-Reihenfolge waere fuer
  // jeden der fuenf Leser die falsche.
  const rows = audio
    .map((c) => {
      const from = byId.get(c.fromEquipmentId)
      const to = byId.get(c.toEquipmentId)
      const fromPort = portOf(from, c.fromPortId)
      const toPort = portOf(to, c.toPortId)
      return {
        cableId: c.id,
        source: from?.name ?? '',
        sourceKind: from?.subtitle || from?.category || undefined,
        sourcePort: fromPort ? portDisplayLabel(fromPort) : '',
        destination: to?.name ?? '',
        destinationPort: toPort ? portDisplayLabel(toPort) : '',
        connector: String(c.type ?? ''),
        lengthM: c.length || undefined,
        x: from?.x,
        y: from?.y,
      }
    })
    .sort((a, b) =>
      a.destination === b.destination
        ? a.destinationPort.localeCompare(b.destinationPort, 'de', { numeric: true })
        : a.destination.localeCompare(b.destination, 'de'),
    )

  return rows.map((r, i) => ({ ch: i + 1, ...r }))
}

/**
 * SICHT 1 — die Band.
 *
 * Was im Rider steht: Kanal, was gespielt wird, womit abgenommen. Kein
 * Stagebox-Port, keine Kabellaenge — das interessiert dort niemanden, und eine
 * Spalte, die niemand liest, macht das Blatt unlesbar.
 */
export function bandView(rows: ChannelRow[]): CsvTable {
  return {
    headers: ['Ch', 'Quelle', 'Art', 'Abnahme'],
    rows: rows.map((r): CsvCell[] => [r.ch, r.source, r.sourceKind ?? '', r.sourcePort]),
  }
}

/**
 * SICHT 2 — das Haus.
 *
 * Die Patch-Sicht: welcher Kanal auf welchen Port, mit welchem Stecker und
 * welcher Laenge. Das ist die Liste, die beim Abstecken in der Hand liegt.
 */
export function venueView(rows: ChannelRow[]): CsvTable {
  return {
    headers: ['Ch', 'Quelle', 'Ziel', 'Port', 'Stecker', 'Laenge (m)'],
    rows: rows.map((r): CsvCell[] => [
      r.ch,
      r.source,
      r.destination,
      r.destinationPort,
      r.connector,
      r.lengthM ?? '',
    ]),
  }
}

/**
 * SICHT 3 — die Buehne.
 *
 * Kanal und Position. Die Koordinaten stehen im Plan; sie hier auszugeben ist
 * eine Projektion und keine neue Angabe. Wo eine Quelle nicht platziert ist,
 * bleibt die Spalte leer statt (0|0) zu behaupten — das waere die Buehnenmitte.
 */
export function stageView(rows: ChannelRow[]): CsvTable {
  return {
    headers: ['Ch', 'Quelle', 'X', 'Y'],
    rows: rows.map((r): CsvCell[] => [
      r.ch,
      r.source,
      r.x === undefined ? '' : Math.round(r.x),
      r.y === undefined ? '' : Math.round(r.y),
    ]),
  }
}

/**
 * SICHT 4 — das Pult.
 *
 * Kanal und Name, zugeschnitten auf das Zeichenbudget, das an Dante-Namen
 * haengt (1–31 Zeichen, DNS-SD-konform; `labelTargets.ts#dante-device`).
 *
 * WARUM AUSGERECHNET DIESES BUDGET und nicht ein erfundenes Pult-Limit: die
 * Regel in `labelTargets.ts` lautet *kein Anker ohne Ziel-Spec*, und fuer
 * Mischpult-Kanalnamen liegt in dieser Recherche KEIN belegtes Limit vor. Das
 * Dante-Budget dagegen ist belegt (Audinate) und in derselben Kette wirksam:
 * der Kanalname wandert ueber die Stagebox, und dort gilt er.
 *
 * `fitToTarget` liefert mit, OB gekuerzt wurde — eine stillschweigend
 * abgeschnittene Beschriftung ist genau die Sorte Fehler, die erst am Pult
 * auffaellt.
 */
export function consoleView(rows: ChannelRow[]): CsvTable {
  return {
    headers: ['Ch', 'Name', 'Gekuerzt'],
    rows: rows.map((r): CsvCell[] => {
      const fitted = fitToTarget(r.source, LABEL_TARGETS['dante-device'])
      // `truncated` UND die nicht transportierbaren Zeichen: ein Name, der nur
      // seine Umlaute verliert, ist nicht gekuerzt und trotzdem ein anderer.
      const hinweis =
        fitted.truncated || fitted.value !== fitted.raw ? `aus: ${r.source}` : ''
      return [r.ch, fitted.value, hinweis]
    }),
  }
}

/** Ein Monitor-Weg: welcher Ausgang speist welches Geraet. */
export interface MonitorPath {
  /** Der Mischer/das Pult. */
  console: string
  /** Ausgang am Pult. */
  outputPort: string
  /** Wedge, IEM-Sender, Kopfhoerer-Amp. */
  sink: string
  sinkPort: string
  cableId: string
}

/**
 * SICHT 5 — die Monitor-WEGE.
 *
 * Nicht die Mix-Inhalte: was in einem Mix liegt, entscheidet der Monitormann
 * am Pult, und ein Feld dafuer waeren genau die „more fields", die der Bedarf
 * ausschliesst. Der Weg dagegen steht im Kabelgraphen.
 *
 * Erkannt wird er an der Senke: ein Geraet, dessen Kategorie oder Name es als
 * Wedge, IEM-Strecke oder Kopfhoererverstaerker ausweist, und das ueber ein
 * Audio-Kabel von einem Ausgang gespeist wird. `monitorSinks` ist die Liste
 * dieser Kennungen und steht als Daten da, damit sie erweiterbar ist, ohne die
 * Ableitung anzufassen.
 */
export const MONITOR_SINK_PATTERNS: ReadonlyArray<RegExp> = [
  /\bwedge\b/i,
  /\bmonitor\b/i,
  /\biem\b/i,
  /in[- ]?ear/i,
  /\bsidefill\b/i,
  /kopfh(oe|ö)rer/i,
  /\bheadphone/i,
]

export function monitorPaths(equipment: EquipmentItem[], cables: Cable[]): MonitorPath[] {
  const byId = new Map(equipment.map((e) => [e.id, e]))
  const isMonitorSink = (e: EquipmentItem): boolean =>
    MONITOR_SINK_PATTERNS.some((re) => re.test(e.name) || re.test(e.category ?? ''))

  const out: MonitorPath[] = []
  for (const c of cables) {
    const layer = topLayer(c.layer) ?? detectLayerForConnector(c.type)
    if (layer !== 'audio') continue
    const from = byId.get(c.fromEquipmentId)
    const to = byId.get(c.toEquipmentId)
    if (!from || !to || !isMonitorSink(to)) continue
    const fromPort = [...(from.inputs ?? []), ...(from.outputs ?? [])].find((p) => p.id === c.fromPortId)
    const toPort = [...(to.inputs ?? []), ...(to.outputs ?? [])].find((p) => p.id === c.toPortId)
    out.push({
      console: from.name,
      outputPort: fromPort ? portDisplayLabel(fromPort) : '',
      sink: to.name,
      sinkPort: toPort ? portDisplayLabel(toPort) : '',
      cableId: c.id,
    })
  }
  return out.sort((a, b) =>
    a.console === b.console
      ? a.outputPort.localeCompare(b.outputPort, 'de', { numeric: true })
      : a.console.localeCompare(b.console, 'de'),
  )
}

export function monitorView(paths: MonitorPath[]): CsvTable {
  return {
    headers: ['Pult', 'Ausgang', 'Ziel', 'Eingang'],
    rows: paths.map((p): CsvCell[] => [p.console, p.outputPort, p.sink, p.sinkPort]),
  }
}

/** Die fuenf Sichten mit ihrem Schluessel — damit die Oberflaeche sie
 *  aufzaehlen kann, ohne die Liste ein zweites Mal zu fuehren. */
export type ChannelViewId = 'band' | 'venue' | 'stage' | 'console' | 'monitor'

export const CHANNEL_VIEWS: ReadonlyArray<ChannelViewId> = [
  'band',
  'venue',
  'stage',
  'console',
  'monitor',
]
