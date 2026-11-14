/**
 * #1184 — Schnellpatch per Kuerzel: `i1o4o7o11` heisst „Eingang 1 auf die
 * Ausgaenge 4, 7 und 11". Mehrere Bloecke duerfen hintereinander stehen
 * (`i1o4o7 i2o5`), Leerzeichen, Kommas und Semikolons trennen nur. Die
 * Nummern sind 1-basiert wie auf der Frontplatte und in der Matrix; das
 * Ergebnis ist 0-basiert wie das Videohub-Protokoll und `VideohubCrosspoints`.
 *
 * Steht derselbe Ausgang zweimal im Kuerzel, gilt der spaetere Block — so
 * liest sich die Zeile von links nach rechts wie eine Folge von Befehlen.
 * Der Doppelte wird trotzdem gemeldet, weil er fast immer ein Tippfehler ist.
 *
 * Bewusst ohne Teilergebnis bei Fehlern: Eine Zeile mit einem Fehler wird
 * nicht halb ausgefuehrt. Wer an einer laufenden Anlage `i1o4o7o1l` tippt,
 * soll nicht 4 und 7 geschaltet bekommen und den Rest suchen.
 */
import type { VideohubCrosspoints } from '../types/equipment'

export type QuickPatchError =
  | { kind: 'zeichen'; at: number; zeichen: string }
  | { kind: 'ausgangOhneEingang'; at: number }
  | { kind: 'eingangOhneAusgang'; input: number }
  | { kind: 'eingangAusserhalb'; input: number; max: number }
  | { kind: 'ausgangAusserhalb'; output: number; max: number }
  | { kind: 'leer' }

export interface QuickPatchResult {
  /** 0-basiert: Ausgang -> Eingang. Leer, sobald ein Fehler auftritt. */
  crosspoints: VideohubCrosspoints
  /** Bloecke 1-basiert, fuer die Vorschau: Eingang -> Ausgaenge. */
  bloecke: { input: number; outputs: number[] }[]
  /** 1-basierte Ausgaenge, die mehr als einmal vorkommen. */
  doppelt: number[]
  errors: QuickPatchError[]
}

const TOKEN = /([io])\s*(\d+)/iy
const TRENNER = /[\s,;]+/y

export const parseQuickPatch = (
  text: string,
  totalInputs: number,
  totalOutputs: number,
): QuickPatchResult => {
  const errors: QuickPatchError[] = []
  const bloecke: QuickPatchResult['bloecke'] = []
  let pos = 0
  while (pos < text.length) {
    TRENNER.lastIndex = pos
    if (TRENNER.exec(text)) {
      pos = TRENNER.lastIndex
      continue
    }
    TOKEN.lastIndex = pos
    const m = TOKEN.exec(text)
    if (!m) {
      errors.push({ kind: 'zeichen', at: pos, zeichen: text[pos] })
      // Rest der Zahl/des Worts ueberspringen, damit ein Fehler nicht
      // zehn Folgefehler meldet.
      pos++
      while (pos < text.length && !/[io\s,;]/i.test(text[pos])) pos++
      continue
    }
    const n = Number(m[2])
    if (m[1].toLowerCase() === 'i') {
      if (n < 1 || n > totalInputs) errors.push({ kind: 'eingangAusserhalb', input: n, max: totalInputs })
      bloecke.push({ input: n, outputs: [] })
    } else {
      const block = bloecke[bloecke.length - 1]
      if (!block) errors.push({ kind: 'ausgangOhneEingang', at: pos })
      else block.outputs.push(n)
      if (n < 1 || n > totalOutputs) errors.push({ kind: 'ausgangAusserhalb', output: n, max: totalOutputs })
    }
    pos = TOKEN.lastIndex
  }
  for (const b of bloecke) if (b.outputs.length === 0) errors.push({ kind: 'eingangOhneAusgang', input: b.input })
  if (bloecke.length === 0 && errors.length === 0 && text.trim()) errors.push({ kind: 'leer' })

  const gesehen = new Set<number>()
  const doppelt = new Set<number>()
  const crosspoints: VideohubCrosspoints = {}
  for (const b of bloecke) {
    for (const o of b.outputs) {
      if (gesehen.has(o)) doppelt.add(o)
      gesehen.add(o)
      crosspoints[o - 1] = b.input - 1
    }
  }
  return {
    crosspoints: errors.length > 0 ? {} : crosspoints,
    bloecke,
    doppelt: [...doppelt].sort((a, b) => a - b),
    errors,
  }
}

/**
 * Der Protokoll-Block nur fuer die geaenderten Kreuzpunkte. Das
 * Videohub-Protokoll nimmt Teilbloecke an; ein Schnellpatch schaltet so nur,
 * was im Kuerzel steht, und nicht nebenbei den ganzen geplanten Stand.
 */
export const quickPatchCommand = (crosspoints: VideohubCrosspoints): string => {
  const lines = ['VIDEO OUTPUT ROUTING:']
  for (const o of Object.keys(crosspoints).map(Number).sort((a, b) => a - b)) {
    lines.push(`${o} ${crosspoints[o]}`)
  }
  return lines.join('\n') + '\n\n'
}

/** Kreuzpunkte aus `soll`, die `ist` (nach dem Schalten zurueckgelesen) nicht
 *  traegt — 1-basierte Ausgaenge. Leer = bestaetigt. */
export const quickPatchUnbestaetigt = (
  soll: VideohubCrosspoints,
  ist: VideohubCrosspoints,
): number[] =>
  Object.keys(soll)
    .map(Number)
    .filter((o) => ist[o] !== soll[o])
    .sort((a, b) => a - b)
    .map((o) => o + 1)
