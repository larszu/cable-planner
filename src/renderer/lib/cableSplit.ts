// #875 — Kabelläufe auf verfügbare Lagerlängen aufteilen.
//
// Ein Lauf von 137 m wird nicht als „137 m Kabel" gepackt, sondern als die
// Stücke, die es wirklich gibt. Wer mit 100er- und 50er-Trommeln arbeitet,
// packt 100 + 50 und kuppelt einmal — die Packliste muss das so ausweisen,
// sonst steht am Ladedock eine Zahl, zu der kein Kabel gehört.
//
// ─── WAS ZUERST ZÄHLT ──────────────────────────────────────────────────────
//
// Erst die Zahl der KUPPLUNGEN, dann die Überlänge. In dieser Reihenfolge und
// nicht umgekehrt: jede Kupplung ist eine Steckverbindung mehr, die sich
// lösen, verschmutzen oder Pegel kosten kann. Zehn Meter Überlänge kosten
// nichts ausser Aufrollen.
//
// Deshalb ist 137 m aus [100, 50, 25] nicht 100+25+25 (150 m, zwei Kupplungen),
// sondern 100+50 (150 m, EINE Kupplung) — bei gleicher Überlänge die bessere
// Antwort, und der Vergleich fällt aus der Reihenfolge der Kriterien heraus,
// nicht aus einer Sonderregel.
//
// ─── DAS LAGER LIEGT NICHT HIER ────────────────────────────────────────────
//
// ADR-006 hat den Bestand in ein eigenes Werkzeug ausgelagert; der
// cable-planner kennt kein Lager-Modell und soll keins bekommen. Die
// verfügbaren Längen sind deshalb eine ANGABE AM PROJEKT (`CableStockEntry`),
// die von Hand gepflegt oder später aus dem Lager übernommen wird.
//
// Der `count` ist dabei eine WARNUNG und keine Schranke: die Rechnung sucht
// die beste Stückelung aus den verfügbaren LÄNGEN, und danach wird geprüft,
// ob der Bestand sie hergibt. Wer zu wenig hat, will wissen, was ihm fehlt —
// nicht eine schlechtere Stückelung vorgesetzt bekommen, weil eine Trommel
// gerade draussen ist.

// Der Typ liegt seit der Anbindung ans Projekt (#875) in `types/cable.ts` —
// dort, wo die anderen Projekt-Angaben stehen, und nicht in dem Modul, das
// mit ihm rechnet. Er wird hier RE-EXPORTIERT, damit Aufrufer weiter eine
// Stelle haben: die Rechnung und ihre Eingabe gehören zusammen gelesen.
import type { CableStockEntry, CableType } from '../types/cable'

export type { CableStockEntry }

/** Ein Stück in der Stückelung. */
export interface SplitPiece {
  lengthM: number
  quantity: number
}

export interface SplitResult {
  pieces: SplitPiece[]
  /** Anzahl Kupplungen = Stücke − 1. */
  couplers: number
  /** Summe der Stücke in Metern. */
  totalM: number
  /** Überlänge gegenüber dem Lauf, in Metern. */
  excessM: number
}

/** Warum eine Stückelung nicht möglich war. */
export type SplitFailure =
  | { reason: 'no-stock' }
  | { reason: 'unreachable'; shortestOverM: number | null }

export type SplitOutcome = { ok: true; split: SplitResult } | { ok: false; failure: SplitFailure }

/**
 * Auflösung der Rechnung.
 *
 * Gerechnet wird in ganzen Zentimetern. Fliesskomma-Meter wären hier eine
 * stille Fehlerquelle: 0.1 + 0.2 ist nicht 0.3, und eine Stückelung, die um
 * einen Zentimeter zu kurz ist, ist am Dock genauso unbrauchbar wie eine, die
 * um zehn Meter zu kurz ist.
 */
const CM = 100

const zuCm = (m: number): number => Math.round(m * CM)
const zuM = (cm: number): number => cm / CM

/**
 * Teilt einen Lauf in verfügbare Längen auf.
 *
 * Kriterien in dieser Reihenfolge: möglichst wenige Stücke (= Kupplungen),
 * dann möglichst wenig Überlänge.
 *
 * Die Rechnung ist exakt, nicht gierig. Gierig von der grössten Länge abwärts
 * liefert bei [100, 60] und einem Lauf von 120 m die Antwort 100+60 (eine
 * Kupplung, 40 m über) — richtig ist hier 60+60, ebenfalls eine Kupplung,
 * aber NULL Überlänge. Ein gieriger Lauf sieht das nicht.
 */
export function splitRun(runM: number, verfuegbar: readonly number[]): SplitOutcome {
  const laengen = [...new Set(verfuegbar.filter((l) => Number.isFinite(l) && l > 0).map(zuCm))].sort(
    (a, b) => a - b,
  )
  if (laengen.length === 0) return { ok: false, failure: { reason: 'no-stock' } }

  const ziel = zuCm(runM)
  if (ziel <= 0) {
    return { ok: true, split: { pieces: [], couplers: 0, totalM: 0, excessM: 0 } }
  }

  const groesste = laengen[laengen.length - 1]!
  // Mehr als ein volles Stück über dem Ziel zu landen, kann nie besser sein:
  // dann liesse sich das letzte Stück streichen und wir wären immer noch drüber.
  const deckel = ziel + groesste

  // stuecke[s] = kleinste Anzahl Stuecke, die GENAU s ergibt.
  const stuecke = new Array<number>(deckel + 1).fill(Infinity)
  const letzte = new Array<number>(deckel + 1).fill(0)
  stuecke[0] = 0

  for (let s = 1; s <= deckel; s += 1) {
    for (const l of laengen) {
      if (l > s) break // laengen ist aufsteigend
      const kandidat = stuecke[s - l]!
      if (kandidat + 1 < stuecke[s]!) {
        stuecke[s] = kandidat + 1
        letzte[s] = l
      }
    }
  }

  // Unter allen erreichbaren Summen >= Ziel: erst wenigste Stuecke, dann
  // kleinste Summe. Die Reihenfolge der Kriterien IST die Entscheidung.
  let besteSumme = -1
  let besteStuecke = Infinity
  for (let s = ziel; s <= deckel; s += 1) {
    const n = stuecke[s]!
    if (n === Infinity) continue
    if (n < besteStuecke || (n === besteStuecke && s < besteSumme)) {
      besteStuecke = n
      besteSumme = s
    }
  }

  if (besteSumme < 0) {
    // Keine Kombination erreicht das Ziel. Das passiert nur, wenn die Laengen
    // keine Summe >= Ziel bilden koennen — bei ganzzahligen Zentimetern und
    // beliebiger Wiederholung praktisch nie, aber ein Deckel ist ein Deckel.
    let kuerzeste: number | null = null
    for (let s = deckel; s >= 0; s -= 1) {
      if (stuecke[s]! !== Infinity) {
        kuerzeste = s
        break
      }
    }
    return {
      ok: false,
      failure: { reason: 'unreachable', shortestOverM: kuerzeste === null ? null : zuM(kuerzeste) },
    }
  }

  // Stueckelung zurueckverfolgen.
  const zaehler = new Map<number, number>()
  let rest = besteSumme
  while (rest > 0) {
    const l = letzte[rest]!
    zaehler.set(l, (zaehler.get(l) ?? 0) + 1)
    rest -= l
  }

  const pieces = [...zaehler.entries()]
    .map(([cm, quantity]) => ({ lengthM: zuM(cm), quantity }))
    .sort((a, b) => b.lengthM - a.lengthM)

  return {
    ok: true,
    split: {
      pieces,
      couplers: Math.max(0, besteStuecke - 1),
      totalM: zuM(besteSumme),
      excessM: zuM(besteSumme - ziel),
    },
  }
}

/** Was der Bestand nicht hergibt. */
export interface StockShortfall {
  lengthM: number
  /** Wie viele gebraucht werden. */
  needed: number
  /** Wie viele da sind. */
  available: number
}

/**
 * Reicht der Bestand für diese Stückelung?
 *
 * Nur Einträge MIT `count` werden geprüft. Ein Eintrag ohne Zählung erzeugt
 * keine Warnung — er sagt nichts über den Bestand aus, und eine Warnung „0
 * vorhanden" wäre eine Behauptung über etwas, das niemand gezählt hat.
 */
export function stockShortfall(
  split: SplitResult,
  bestand: readonly CableStockEntry[],
): StockShortfall[] {
  const gezaehlt = new Map<number, number>()
  for (const e of bestand) {
    if (e.count === undefined) continue
    const cm = zuCm(e.lengthM)
    gezaehlt.set(cm, (gezaehlt.get(cm) ?? 0) + e.count)
  }

  const out: StockShortfall[] = []
  for (const p of split.pieces) {
    const cm = zuCm(p.lengthM)
    const da = gezaehlt.get(cm)
    if (da === undefined) continue // nicht gezaehlt, also keine Aussage
    if (p.quantity > da) out.push({ lengthM: p.lengthM, needed: p.quantity, available: da })
  }
  return out
}

/** Die verfügbaren Längen eines Kabeltyps aus der Projekt-Angabe. */
export function lengthsForType(bestand: readonly CableStockEntry[], type: CableType): number[] {
  return bestand.filter((e) => e.type === type).map((e) => e.lengthM)
}

// ───────────────────────────────────────────────────────────────────────────
// Die Anbindung: eine Zeile einer Kabel-Stückliste stückeln.
//
// WARUM DAS HIER STEHT UND NICHT IN DER LISTE. Es gibt DREI Stücklisten in
// diesem Repo — die gedruckte (`installerLists`), den Kabel-BOM-Dialog und
// den BOM-Abschnitt im Export-Fenster. Jede rechnete den Aufruf sonst selbst,
// und drei Fassungen derselben Rechnung sind genau die Defektform, die dieses
// Repo `zwei-rechnungen` nennt — nur mit dreien.
// ───────────────────────────────────────────────────────────────────────────

/** Was eine Stücklisten-Zeile über ihre Stückelung weiss. */
export interface RowSplit {
  split?: SplitResult
  shortfall?: StockShortfall[]
}

/**
 * Die Stückelung einer Zeile, plus der Fehlbestand für ALLE ihre Läufe.
 *
 * `runs` ist die Stückzahl der Zeile: wer fünfmal denselben Lauf zieht,
 * braucht fünfmal die Stücke. Eine Warnung, die nur einen Lauf prüft,
 * meldete Entwarnung für ein Lager, das beim zweiten leer ist.
 *
 * Ohne Lagerlängen für diesen Typ kommt ein leeres Ergebnis zurück — und
 * ausdrücklich keine erfundene Stückelung.
 */
export function rowSplit(
  bestand: readonly CableStockEntry[],
  type: string | undefined,
  lengthM: number,
  runs: number,
): RowSplit {
  if (!type || !(lengthM > 0)) return {}
  const laengen = lengthsForType(bestand, type as CableStockEntry['type'])
  if (laengen.length === 0) return {}
  const outcome = splitRun(lengthM, laengen)
  if (!outcome.ok) return {}
  const split = outcome.split
  if (runs <= 0) return { split }
  const fehlt = stockShortfall(
    { ...split, pieces: split.pieces.map((p) => ({ ...p, quantity: p.quantity * runs })) },
    bestand.filter((e) => e.type === type),
  )
  return fehlt.length > 0 ? { split, shortfall: fehlt } : { split }
}

/** Die Stückelung als Text: „2 × 100 m + 1 × 50 m". */
export const splitLabel = (split: SplitResult): string =>
  split.pieces.map((p) => `${p.quantity} × ${p.lengthM} m`).join(' + ')

/** Der Fehlbestand als Text: „100 m: 5 gebraucht / 3 da". */
export const shortfallLabel = (fehlt: readonly StockShortfall[]): string =>
  fehlt.map((f) => `${f.lengthM} m: ${f.needed}/${f.available}`).join(' · ')
