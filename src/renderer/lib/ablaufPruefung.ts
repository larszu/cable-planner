// ───────────────────────────────────────────────────────────────────────────
// #1182 — der Ablauf am Kabelplan: steht, was ein Abschnitt braucht?
//
// Ein Punkt im Ablauf („18:40 Band 2, Kamera 3 auf Kran") ist mit Geraeten
// und Wegen verknuepft (`RundownPlan.links`). Vor jedem Punkt die Frage:
// sind sie alle im Plan, haben die Wege beide Enden, und meldet der
// Plan-Check an keinem davon einen Fehler oder eine Warnung? Ein Abschnitt
// ohne Verknuepfung wird NICHT geprueft und auch nicht als „in Ordnung"
// gemeldet — er sagt nichts, und das steht so da.
//
// Der Plan-Check wird nicht noch einmal gerechnet: der Aufrufer reicht die
// Befunde herein, die er ohnehin hat (Fussleiste, Dialog). Zwei Rechnungen
// koennten auseinanderlaufen, und dann widerspraeche der Ablauf dem Check.
//
// REIN: kein Store, keine Uhr.
// ───────────────────────────────────────────────────────────────────────────
import type { Cable } from '../types/cable'
import type { CheckFinding } from '../types/checkFinding'
import type { EquipmentItem } from '../types/equipment'
import type { RundownPlan, RundownSegment, SegmentLink } from '../types/rundown'
import type { CsvTable } from './csv'
import { spalten } from './kanonisch'

export type AblaufBefundArt = 'geraet-fehlt' | 'weg-fehlt' | 'weg-ohne-ende' | 'check'

export interface AblaufBefund {
  art: AblaufBefundArt
  /** Die Kennung des fehlenden oder betroffenen Elements. */
  id: string
  /** Bei `check`: der Text des Plan-Check-Befunds. */
  text?: string
  equipmentId?: string
  cableId?: string
}

export interface AblaufPunkt {
  segment: RundownSegment
  link?: SegmentLink
  geraete: string[]
  wege: string[]
  befunde: AblaufBefund[]
  /** `undefined` = nichts verknuepft, also nichts geprueft. */
  ok?: boolean
}

export interface AblaufEingabe {
  rundown: RundownPlan | undefined
  equipment: readonly EquipmentItem[]
  cables: readonly Cable[]
  /** Die Befunde des Plan-Checks (`runDrawingChecks`). */
  befunde: readonly CheckFinding[]
}

const wegName = (c: Cable): string => c.cableNumber || c.name || c.id

export const ablaufPruefung = ({ rundown, equipment, cables, befunde }: AblaufEingabe): AblaufPunkt[] => {
  if (!rundown) return []
  const geraete = new Map(equipment.map((e) => [e.id, e]))
  const kabel = new Map(cables.map((c) => [c.id, c]))
  const links = new Map((rundown.links ?? []).map((l) => [l.segmentId, l]))
  return rundown.segments.map((segment) => {
    const link = links.get(segment.id)
    if (!link) return { segment, geraete: [], wege: [], befunde: [] }
    const out: AblaufBefund[] = []
    const namen: string[] = []
    const wege: string[] = []
    for (const id of link.equipmentIds) {
      const e = geraete.get(id)
      if (e) namen.push(e.name)
      else out.push({ art: 'geraet-fehlt', id })
    }
    for (const id of link.cableIds) {
      const c = kabel.get(id)
      if (!c) {
        out.push({ art: 'weg-fehlt', id })
        continue
      }
      wege.push(wegName(c))
      if (!geraete.has(c.fromEquipmentId) || !geraete.has(c.toEquipmentId)) {
        out.push({ art: 'weg-ohne-ende', id: wegName(c), cableId: c.id })
      }
    }
    const eq = new Set(link.equipmentIds)
    const ca = new Set(link.cableIds)
    for (const f of befunde) {
      if (f.severity === 'info') continue
      if ((f.equipmentId && eq.has(f.equipmentId)) || (f.cableId && ca.has(f.cableId))) {
        out.push({
          art: 'check',
          id: f.id,
          text: f.message,
          ...(f.equipmentId ? { equipmentId: f.equipmentId } : {}),
          ...(f.cableId ? { cableId: f.cableId } : {}),
        })
      }
    }
    return { segment, link, geraete: namen, wege, befunde: out, ok: out.length === 0 }
  })
}

/** Die Zahl fuer den Kopf: Befunde ueber alle Abschnitte. */
export const ablaufWarnungen = (punkte: readonly AblaufPunkt[]): number =>
  punkte.reduce((n, p) => n + p.befunde.length, 0)

/**
 * Das Blatt fuer die Regie: Punkt, Abschnitt, Geraete, Wege, Stand der
 * Pruefung. Kanonisch, damit der Stand nicht an der App-Sprache haengt.
 */
export const regieBlattTable = (punkte: readonly AblaufPunkt[]): CsvTable => ({
  headers: spalten(['No.', 'Segment', 'Note', 'Devices', 'Paths', 'Check']),
  rows: punkte.map((p) => [
    p.segment.number ?? '',
    p.segment.title,
    p.segment.note ?? '',
    p.geraete.join(', '),
    p.wege.join(', '),
    p.ok === undefined ? '' : p.ok ? 'OK' : String(p.befunde.length),
  ]),
})

/**
 * Fuer das Dokument-Register: der Stand aus dem Projekt allein, OHNE
 * Plan-Check. Der zoege `drawingChecks` und damit das Desktop-Woerterbuch in
 * jeden Eintrittspunkt, der das Register liest (Mobil-Ansicht). Der Stand
 * folgt so Abschnitten, Verknuepfungen und fehlenden Enden; die Check-Befunde
 * stehen auf dem Blatt (`ablaufRegie.ts`), aber nicht im Fingerabdruck.
 */
export const regieBlattForProject = (project: {
  rundown?: RundownPlan
  equipment: EquipmentItem[]
  cables: Cable[]
}): CsvTable =>
  regieBlattTable(ablaufPruefung({ rundown: project.rundown, equipment: project.equipment, cables: project.cables, befunde: [] }))
