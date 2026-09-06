// ───────────────────────────────────────────────────────────────────────────
// Das Multiviewer-Bild als Blatt (Bedarf 125, P4).
//
//   > MV window assignment is configured by hand per show; remote recall is
//   > unreliable, so THE TRUSTED STORE IS THE SWITCHER'S OWN BINARY SAVE FILE,
//   > WHICH NO OTHER DEPARTMENT CAN READ.
//
// Belegt an `bitfocus/companion-module-bmd-atem#480` (2026, offen): dort
// rufen die MV-Fenster 2 und 3 dieselbe Quelle ab, und der Melder hält fest,
// dass nur das Sichern und Zurückspielen des KOMPLETTEN Mischer-Zustands über
// ATEM Software Control zuverlässig funktioniert.
//
// ─── DER SCHADEN IST NICHT DER RECALL, SONDERN DIE LESBARKEIT ──────────────
//
// Dass ein Zustand nur als Binärdatei des Mischers existiert, heisst: die
// Kameraleute wissen nicht, in welchem Fenster sie stehen, der Regisseur hat
// keinen Plan zum Gegenlesen, und beim nächsten Aufbau tippt jemand die
// Belegung erneut ein. Der Plan kann den Recall nicht zuverlässiger machen —
// das ist Sache des Mischers. Er kann aber das BLATT liefern, das heute fehlt,
// und zwar aus denselben Rollen, aus denen Tally, UMD und die Videohub-Labels
// kommen (`labelDerivation`).
//
// ─── WAS DIESES MODUL NICHT TUT ────────────────────────────────────────────
//
// Es schreibt NICHTS an den Mischer und liest keinen Live-Zustand. Die
// Belegung kommt aus `equipment.atemMvConfig` — dem geplanten Bild, das der
// MV-Dialog führt (cable-planner#288) — und die Rollen aus dem Kabelgraph. Was der
// Mischer gerade wirklich tut, ist eine Beobachtung; sie hier einzumischen
// erzeugte genau die zweite Wahrheit, die ADR-001 überall sonst verbietet.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { AtemMvDefinition, EquipmentItem } from '../types/equipment'
import { getMvGridSpec, getMvQuadrants, mvWindowIndex } from './atemMvLayout'
import type { CsvTable } from './csv'

/** Was auf dem Blatt steht, wo nichts belegt ist. */
export const NO_SOURCE = 'nicht belegt'
/** Was dort steht, wo die Quelle keiner Rolle im Plan entspricht. */
export const NO_ROLE = 'keine Rolle im Plan'

/** Ein Fenster im Bild. */
export interface MvWindow {
  /** Fenster-Index im internen Schema (0-3 gross, 10-43 klein). */
  windowIndex: number
  /** Wo es auf dem Schirm sitzt, im Klartext („oben links", „unten rechts, Zelle 2"). */
  position: string
  /** true: eines der grossen Fenster. */
  big: boolean
  /** ATEM-Quell-Id, wie sie im Profil steht. */
  sourceId?: number
}

const QUADRANT_NAME = ['oben links', 'oben rechts', 'unten links', 'unten rechts'] as const

/**
 * Die Fenster eines Multiviewers, in Lese-Reihenfolge.
 *
 * Aus dem QUADRANTEN-Modell und nicht aus `layout`: `getMvQuadrants` ist die
 * vorhandene Engstelle dafür (sie fällt für Alt-Daten selbst auf das Layout
 * zurück). Ein zweiter Weg von `layout` zu den Fenstern liefe auseinander,
 * sobald jemand einen Quadranten umstellt.
 */
export function mvWindows(mv: AtemMvDefinition): MvWindow[] {
  const quadrants = getMvQuadrants(mv)
  const belegt = new Map(mv.windows.map((w) => [w.windowIndex, w.sourceId]))
  const out: MvWindow[] = []
  for (let q = 0; q < 4; q++) {
    const quadIdx = q as 0 | 1 | 2 | 3
    if (quadrants[quadIdx] === 'big') {
      const idx = mvWindowIndex(quadIdx)
      out.push({
        windowIndex: idx,
        position: QUADRANT_NAME[q],
        big: true,
        ...(belegt.has(idx) ? { sourceId: belegt.get(idx) } : {}),
      })
      continue
    }
    for (let c = 0; c < 4; c++) {
      const idx = mvWindowIndex(quadIdx, c as 0 | 1 | 2 | 3)
      out.push({
        windowIndex: idx,
        // Die Zelle wird 1-basiert genannt: auf dem Papier zählt niemand ab 0.
        position: `${QUADRANT_NAME[q]}, Zelle ${c + 1}`,
        big: false,
        ...(belegt.has(idx) ? { sourceId: belegt.get(idx) } : {}),
      })
    }
  }
  return out
}

/**
 * Wie viele Fenster das gewählte Layout überhaupt hat.
 *
 * Aus derselben Gitter-Tabelle, aus der die Oberfläche zeichnet — sonst
 * behauptete das Blatt eine andere Fensterzahl als der Bildschirm zeigt.
 */
export const mvWindowCount = (layout: number): number => {
  const spec = getMvGridSpec(layout)
  return spec.big.length + spec.small.length
}

/**
 * Quell-Id → Klartext.
 *
 * Kommt FERTIG herein. Die Auflösung „welche Rolle speist ATEM-Eingang N"
 * liegt in `labelDerivation`/`tallyMap` und hängt am Kabelgraph; sie hier ein
 * zweites Mal zu bauen wäre die zweite Wahrheit — und genau daran krankt der
 * Bedarf schon auf der Marktseite (drei handgeführte Kopien derselben
 * Eingangs-Karte).
 */
export type SourceNames = ReadonlyMap<number, string>

export const MV_SHEET_HEADERS = [
  'Multiviewer',
  'Fenster',
  'Position',
  'Größe',
  'Quelle (ATEM)',
  'Rolle',
] as const

const groesse = (big: boolean) => (big ? 'groß' : 'klein')

/** Das Blatt: ein Multiviewer, eine Zeile je Fenster. */
export function mvSheetTable(
  deviceName: string,
  multiViewers: ReadonlyArray<AtemMvDefinition>,
  names: SourceNames,
): CsvTable {
  const rows: CsvTable['rows'] = []
  for (const mv of [...multiViewers].sort((a, b) => a.index - b.index)) {
    for (const w of mvWindows(mv)) {
      rows.push([
        `${deviceName} · MV ${mv.index + 1}`,
        w.windowIndex,
        w.position,
        groesse(w.big),
        w.sourceId ?? NO_SOURCE,
        w.sourceId === undefined ? NO_SOURCE : (names.get(w.sourceId) ?? NO_ROLE),
      ])
    }
  }
  return { headers: [...MV_SHEET_HEADERS], rows }
}

export type MvFindingKind =
  /** Zwei Fenster zeigen dieselbe Quelle — der Fall aus dem Beleg. */
  | 'duplicate-source'
  /** Ein Fenster ist unbelegt. */
  | 'empty-window'
  /** Die Quelle entspricht keiner Rolle im Plan. */
  | 'unknown-source'

export interface MvFinding {
  kind: MvFindingKind
  severity: 'error' | 'warning'
  /** Multiviewer-Index (0-basiert) als Sortierschlüssel. */
  mvIndex: number
  message: string
}

/**
 * Befunde über die Belegung.
 *
 * `duplicate-source` ist der belegte Fall (`#480`: „MV windows 2 and 3 recall
 * the same source") — und er ist ein FEHLER und keine Warnung: zwei gleiche
 * Bilder nebeneinander heissen, dass eine Kamera auf dem Multiviewer gar nicht
 * vorkommt, und das merkt der Regisseur in dem Moment, in dem er sie braucht.
 *
 * Ein unbelegtes Fenster ist dagegen nur ein Hinweis: ein Aufbau mit weniger
 * Kameras als Fenstern ist der Normalfall, kein Mangel.
 */
export function mvFindings(
  multiViewers: ReadonlyArray<AtemMvDefinition>,
  names: SourceNames,
): MvFinding[] {
  const out: MvFinding[] = []
  for (const mv of [...multiViewers].sort((a, b) => a.index - b.index)) {
    const fenster = mvWindows(mv)
    const nachQuelle = new Map<number, MvWindow[]>()
    for (const w of fenster) {
      if (w.sourceId === undefined) {
        out.push({
          kind: 'empty-window',
          severity: 'warning',
          mvIndex: mv.index,
          message: `MV ${mv.index + 1}: Fenster ${w.position} ist ${NO_SOURCE}.`,
        })
        continue
      }
      nachQuelle.set(w.sourceId, [...(nachQuelle.get(w.sourceId) ?? []), w])
      if (!names.has(w.sourceId)) {
        out.push({
          kind: 'unknown-source',
          severity: 'warning',
          mvIndex: mv.index,
          message:
            `MV ${mv.index + 1}: Fenster ${w.position} zeigt Quelle ${w.sourceId}, ` +
            `zu der der Plan keine Rolle kennt.`,
        })
      }
    }
    for (const [sourceId, ws] of nachQuelle) {
      if (ws.length < 2) continue
      const name = names.get(sourceId) ?? `Quelle ${sourceId}`
      out.push({
        kind: 'duplicate-source',
        severity: 'error',
        mvIndex: mv.index,
        message:
          `MV ${mv.index + 1}: ${ws.length} Fenster zeigen "${name}" ` +
          `(${ws.map((w) => w.position).join(', ')}). Dann fehlt eine andere Quelle im Bild.`,
      })
    }
  }
  return out
}

/**
 * Die Quell-Namen aus einer Tally-Karte.
 *
 * Der Brückenkopf zwischen diesem Blatt und den Rollen: `buildTallyMap` löst
 * bereits „welche Rolle kommt an welchem Mischer-Eingang an" auf, und die
 * ATEM-Quell-Id eines Kamera-Eingangs IST diese Eingangsnummer. Damit hängt
 * das MV-Blatt an derselben Auflösung wie Tally und UMD — was der Bedarf
 * wörtlich verlangt („labels come from the source records").
 *
 * NUR Kamera-Eingänge: interne Quellen des Mischers (Farbflächen, Media
 * Player, SuperSource) tragen im ATEM eigene Id-Bereiche und haben im Plan
 * keine Rolle. Sie hier zu raten hiesse, dem Blatt einen Namen zu geben, den
 * niemand nachprüfen kann.
 */
export function sourceNamesFromTallyRows(
  rows: ReadonlyArray<{ name: string; switcher?: { input: number } }>,
): SourceNames {
  const out = new Map<number, string>()
  for (const r of rows) {
    if (!r.switcher) continue
    // Erster gewinnt: zwei Rollen auf demselben Eingang sind ein Befund der
    // Tally-Karte und nicht dieses Blatts.
    if (!out.has(r.switcher.input)) out.set(r.switcher.input, r.name)
  }
  return out
}

/** Alle Multiviewer eines Geräts — leer, wenn keine MV-Konfiguration da ist. */
export const multiViewersOf = (device: EquipmentItem): AtemMvDefinition[] =>
  device.atemMvConfig?.multiViewers ?? []
