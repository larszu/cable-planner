// ───────────────────────────────────────────────────────────────────────────
// Bedarf 13 (P1) — die Kabellänge als ABGELEITETE Grösse, mit Grenzen.
//
// DER BEFUND nennt drei Dinge in einem Satz:
//
//   > Run lengths are assumed, drums are picked by hand, and a moved position
//   > SILENTLY invalidates the cable call; one wrong SMPTE run kills video,
//   > return, comms, tally and power at once.
//
// Und die Bedarfs-Datenbank sagt, was daraus folgt: „recompute run length /
// drum / path / patch when a camera position moves, warn on run-length …
// limits, and FLAG THAT A SINGLE RUN FAILURE IS A FIVE-SERVICE FAILURE."
//
// ─── DAS STILLE VERALTEN ───────────────────────────────────────────────────
//
// `estimateCableLengths` schrieb bis hierher eine Zahl nach `length` und
// hinterliess keine Spur. Danach sah eine geschaetzte Laenge aus wie eine
// gemessene — und ein verschobenes Geraet machte sie falsch, ohne dass es
// jemand erfuhr. Genau das Wort „silently" aus dem Befund.
//
// Mit `lengthDerivedFrom` laesst sich beides trennen: eine Laenge OHNE die
// Angabe ist von Hand eingetragen und geht dieses Modul nichts an; eine MIT
// ihr ist abgeleitet und kann veralten. Dieselbe Unterscheidung wie beim
// PTZ-Preset im MultiCam-Planer.
//
// ─── WAS BEWUSST NICHT GEMELDET WIRD ───────────────────────────────────────
//
// Dass eine VON HAND eingetragene Laenge nicht zur Canvas-Geometrie passt.
// Das ist der Normalfall: ein echter Kabelweg wird verlegt und nicht
// gespannt, er laeuft an der Wand entlang und durch die Kabelrinne. Die
// Schaetzung ist eine Luftlinie mit Zuschlag; sie gegen eine gemessene Laenge
// zu halten meldete auf jedem gepflegten Plan jede Zeile.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'
import { cableCatalog, type CableSpec } from '../types/cableSpec'
import { centerOf } from './cableLengthEstimate'
import type { CsvCell, CsvTable } from './csv'

/**
 * Ab wie vielen Canvas-Pixeln Versatz eine abgeleitete Laenge als ueberholt
 * gilt.
 *
 * 20 px. Der Massstab ist per Vorgabe 1 m je 100 px, also rund 20 cm — unter
 * der Genauigkeit, mit der ueberhaupt jemand ein Geraet auf dem Canvas
 * platziert. Eine kleinere Schwelle meldete das Nachziehen eines Knotens als
 * Befund. Das ist eine Aussage ueber den PLAN, keine ueber das Kabel.
 */
export const MOVE_TOLERANCE_PX = 20

/**
 * Dienste, die auf EINEM Strang liegen.
 *
 * Nur wo die Recherche es belegt. Ein Hybrid-Kamerakabel nach SMPTE 304M/311M
 * fuehrt Bild, Rueckbild, Intercom, Tally und Strom in einem Stecker — der
 * Befund sagt es woertlich: „one wrong SMPTE run kills video, return, comms,
 * tally and power at once". Triax traegt dieselbe Buendelung in der aelteren,
 * koaxialen Form.
 *
 * KEIN EINTRAG FUER SDI, CAT ODER XLR. Die tragen genau einen Dienst; ihnen
 * eine Liste anzuhaengen machte aus einem Befund eine Floskel.
 */
export const BUNDLED_SERVICES: Readonly<Record<string, readonly string[]>> = {
  'SMPTE-304M': ['Bild', 'Rueckbild', 'Intercom', 'Tally', 'Strom'],
  'SMPTE-311M': ['Bild', 'Rueckbild', 'Intercom', 'Tally', 'Strom'],
}

/** Traegt dieses Kabel mehrere Dienste? Liefert die Liste oder `null`. */
export const bundledServices = (spec: CableSpec | undefined): readonly string[] | null => {
  if (!spec) return null
  for (const std of spec.standards) {
    const dienste = BUNDLED_SERVICES[std]
    if (dienste) return dienste
  }
  return null
}

export type RunFindingKind =
  /** Die abgeleitete Laenge stammt aus einer Geometrie, die es nicht mehr gibt. */
  | 'derived-length-stale'
  /** Die Laenge liegt ueber der Reichweite des Kabeltyps. */
  | 'over-max-length'
  /** Ein abgeleitetes Kabel, dessen Endgeraet es nicht mehr gibt. */
  | 'endpoint-missing'

export interface RunFinding {
  kind: RunFindingKind
  cableId: string
  cableLabel: string
  /** Werte im Klartext, in fester Reihenfolge je `kind`. */
  values: string[]
  /** Die Dienste auf diesem Strang, wenn es mehrere sind. Ein Ausfall trifft
   *  sie alle — der Befund nennt das ausdruecklich. */
  services?: readonly string[]
  /** Fundstelle der Grenze, wo es eine gibt. */
  source?: string
}

const specOf = (c: Cable): CableSpec | undefined =>
  c.cableSpecId ? cableCatalog.find((s) => s.id === c.cableSpecId) : undefined

const labelOf = (c: Cable): string => c.name || c.id

/**
 * Alle Befunde zu den Kabelwegen.
 *
 * Sortiert nach Kabelbezeichnung, damit dieselbe Liste zweimal dieselbe Datei
 * ergibt — sie wandert als CSV.
 */
export const cableRunFindings = (cables: Cable[], equipment: EquipmentItem[]): RunFinding[] => {
  const eqById = new Map(equipment.map((e) => [e.id, e]))
  const out: RunFinding[] = []

  for (const c of cables) {
    if (c.wireless) continue
    const spec = specOf(c)
    const dienste = bundledServices(spec)

    // ── Reichweite ──
    // Gilt fuer JEDE Laenge, ob geschaetzt oder gemessen: die Grenze ist eine
    // Eigenschaft des Kabels und nicht der Herkunft der Zahl.
    if (spec?.maxLengthMeters && typeof c.length === 'number' && c.length > spec.maxLengthMeters) {
      out.push({
        kind: 'over-max-length',
        cableId: c.id,
        cableLabel: labelOf(c),
        values: [String(c.length), String(spec.maxLengthMeters), spec.name],
        ...(dienste ? { services: dienste } : {}),
        source: 'Kabelkatalog (`cableSpec.ts`)',
      })
    }

    // ── Stilles Veralten ──
    const herkunft = c.lengthDerivedFrom
    if (!herkunft) continue

    const from = eqById.get(c.fromEquipmentId)
    const to = eqById.get(c.toEquipmentId)
    if (!from || !to) {
      out.push({
        kind: 'endpoint-missing',
        cableId: c.id,
        cableLabel: labelOf(c),
        values: [],
        ...(dienste ? { services: dienste } : {}),
      })
      continue
    }

    // Verglichen werden die GERAETE-URSPRUENGE, nicht die Mittelpunkte: nur
    // sie ueberleben die Raster-Heilung beim Laden unveraendert, und nur sie
    // beantworten die Frage des Bedarfs — „a moved position". Ein Knoten,
    // dessen Breite sich aendert, wurde nicht verschoben.
    const versatz = Math.max(
      Math.hypot(from.x - herkunft.fromX, from.y - herkunft.fromY),
      Math.hypot(to.x - herkunft.toX, to.y - herkunft.toY),
    )
    if (versatz <= MOVE_TOLERANCE_PX) continue

    // Was die Schaetzung HEUTE ergaebe, mit dem Massstab von damals: sonst
    // vermischte die Meldung zwei Aenderungen und benennt keine.
    const a = centerOf(from)
    const b = centerOf(to)
    const px = Math.hypot(b.x - a.x, b.y - a.y)
    const jetzt = (px / 100) * herkunft.metersPer100px * (1 + herkunft.slackPercent / 100)

    out.push({
      kind: 'derived-length-stale',
      cableId: c.id,
      cableLabel: labelOf(c),
      values: [
        String(c.length ?? ''),
        String(Math.max(1, Math.ceil(jetzt))),
        String(Math.round(versatz)),
      ],
      ...(dienste ? { services: dienste } : {}),
    })
  }

  return out.sort(
    (a, b) => a.cableLabel.localeCompare(b.cableLabel, 'de') || a.cableId.localeCompare(b.cableId),
  )
}

/** Kanonisches Deutsch — die Befunde landen auf einem Blatt. */
export const runFindingText = (f: RunFinding): string => {
  const kern = (() => {
    switch (f.kind) {
      case 'derived-length-stale':
        return `Laenge ${f.values[0]} m wurde geschaetzt; seither um ${f.values[2]} px verschoben, die Schaetzung ergaebe jetzt ${f.values[1]} m`
      case 'over-max-length':
        return `Laenge ${f.values[0]} m ueber der Reichweite von ${f.values[1]} m (${f.values[2]})`
      case 'endpoint-missing':
        return 'Abgeleitete Laenge, aber ein Endgeraet fehlt — sie laesst sich nicht mehr nachrechnen'
    }
  })()
  // Der Zusatz, den der Bedarf ausdruecklich verlangt: ein Strang, fuenf
  // Dienste. Wer die Zeile liest, soll nicht erst nachschlagen muessen, was
  // ausser dem Bild noch ausfaellt.
  return f.services ? `${kern} — ein Strang, ${f.services.length} Dienste: ${f.services.join(', ')}` : kern
}

const ART: Record<RunFindingKind, string> = {
  'derived-length-stale': 'Schaetzung ueberholt',
  'over-max-length': 'Ueber Reichweite',
  'endpoint-missing': 'Endgeraet fehlt',
}

/** Die Befunde als Blatt. */
export const cableRunTable = (cables: Cable[], equipment: EquipmentItem[]): CsvTable => ({
  headers: ['Kabel', 'Befund', 'Beschreibung', 'Dienste auf dem Strang'],
  rows: cableRunFindings(cables, equipment).map((f): CsvCell[] => [
    f.cableLabel,
    ART[f.kind],
    runFindingText(f),
    f.services ? f.services.join(', ') : '',
  ]),
})

/** Fuer den Stempel: dieselbe Tabelle aus einem Projekt. */
export const cableRunTableForProject = (project: {
  cables?: Cable[]
  equipment?: EquipmentItem[]
}): CsvTable => cableRunTable(project.cables ?? [], project.equipment ?? [])
