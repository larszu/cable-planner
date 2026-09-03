import type {
  AtemAudioMatrix,
  AtemMvConfig,
  AtemMvDefinition,
} from '../types/equipment'

// ---------------------------------------------------------------------------
// Initiative 10 — Confirmed-State-Disziplin, die zweite und dritte Stelle.
//
// DER BEFUND. Der Renderer liest an drei Stellen einen echten Geraete-Zustand
// zurueck. Eine davon war bereits geheilt und sagt in `VideohubExportDialog`
// selbst, woran:
//
//   „Vorher stand hier `setRouting({ ...result.state.routing })`. Da das
//    geplante Routing ins Projekt persistiert wird, hat ein Klick auf
//    ‚Status lesen' die geplante Kreuzschiene still durch das ersetzt, was
//    der Hub im Moment gerade tut — und mitgespeichert. Was der Hub tut, ist
//    eine Beobachtung; was im Plan steht, eine Absicht."
//
// Die beiden ATEM-Dialoge taten genau das weiter:
//   - `AtemAudioRouterDialog` mischte `live.matrix ?? draft?.matrix` in den
//     Entwurf. Ohne Rueckfrage, ohne Kennzeichnung — danach war nicht mehr
//     feststellbar, welche Kreuzung geplant und welche abgelesen war.
//   - `AtemMvConfigDialog` ersetzte die geplante Fensteraufteilung per
//     `setConfig(...)`. Es fragte immerhin nach — aber nur, wenn irgendein
//     Fenster `sourceId !== 0` trug: ein bewusst schwarz geplanter
//     Multiviewer ging still verloren.
//
// In beiden Faellen schreibt der Speichern-Knopf danach die Beobachtung als
// Absicht ins Projekt.
//
// WAS DIESE DATEI TUT. Sie macht aus den beiden Geraete-Formen dieselbe
// Liste — „Ziel bekommt Quelle" — und vergleicht sie. Die Dialoge halten die
// Beobachtung daraufhin getrennt vom Entwurf und zeigen die Differenz; die
// Uebernahme bleibt moeglich, aber sie ist ein eigener Klick.
//
// WARUM EINE GEMEINSAME DATEI UND NICHT ZWEIMAL VOR ORT. Weil es nach dem
// Videohub die zweite und dritte Stelle ist — der zweite Anwendungsfall, auf
// den ADR-003 die Verallgemeinerung ausdruecklich vertagt hatte („eine
// Abstraktion auf Verdacht" waere sie vorher gewesen). Jetzt ist er da, und
// zwar doppelt.
// ---------------------------------------------------------------------------

/** Eine Zuweisung „Ziel bekommt Quelle", aus Plan oder von der Maschine. */
export interface Assignment {
  /** Maschinenlesbarer Schluessel des Ziels. */
  key: string
  /** Wie das Ziel in der Oberflaeche heisst. */
  label: string
  sourceId: number
}

/**
 * Ein Unterschied zwischen Plan und Geraet.
 *
 * `planned` und `confirmed` sind absichtlich beide optional: „im Plan, aber
 * das Geraet sagt nichts dazu" ist etwas anderes als „im Plan auf 0". Das
 * erste ist Unkenntnis, das zweite eine Aussage.
 */
export interface LiveDelta {
  key: string
  label: string
  planned?: number
  confirmed?: number
}

export interface LiveComparison {
  /** Beide Seiten kennen das Ziel und meinen etwas anderes. */
  deltas: LiveDelta[]
  /** Der Plan sieht das Ziel vor, das Geraet hat es nicht gemeldet. */
  onlyPlanned: LiveDelta[]
  /** Das Geraet meldet ein Ziel, das der Plan nicht kennt. */
  onlyConfirmed: LiveDelta[]
  /** Wie viele Ziele uebereinstimmen. */
  agreeing: number
}

/** Ist ueberhaupt etwas anders? */
export const hasDifference = (c: LiveComparison): boolean =>
  c.deltas.length > 0 || c.onlyPlanned.length > 0 || c.onlyConfirmed.length > 0

/** Alle Unterschiede in einer Liste — fuer Anzeigen, die nicht dreiteilen. */
export const allDeltas = (c: LiveComparison): LiveDelta[] => [
  ...c.deltas,
  ...c.onlyPlanned,
  ...c.onlyConfirmed,
]

/**
 * Plan gegen Geraet.
 *
 * Die Reihenfolge der Argumente ist nicht beliebig: `planned` zuerst, weil
 * der Plan die Absicht ist und das Geraet der Befund. Wer sie vertauscht,
 * bekommt die Vorzeichen der Deltas gedreht — deshalb heissen die Felder im
 * Ergebnis, wie sie heissen, und nicht `a`/`b`.
 */
export const compareAssignments = (
  planned: readonly Assignment[],
  confirmed: readonly Assignment[],
): LiveComparison => {
  const byKeyPlanned = new Map(planned.map((a) => [a.key, a]))
  const byKeyConfirmed = new Map(confirmed.map((a) => [a.key, a]))
  const deltas: LiveDelta[] = []
  const onlyPlanned: LiveDelta[] = []
  const onlyConfirmed: LiveDelta[] = []
  let agreeing = 0

  for (const a of planned) {
    const other = byKeyConfirmed.get(a.key)
    if (!other) {
      onlyPlanned.push({ key: a.key, label: a.label, planned: a.sourceId })
      continue
    }
    if (other.sourceId === a.sourceId) {
      agreeing += 1
      continue
    }
    deltas.push({
      key: a.key,
      // Das Geraet kennt oft die besseren Namen (echte Labels statt
      // „Out 3"), deshalb gewinnt seines, wenn es eins hat.
      label: other.label || a.label,
      planned: a.sourceId,
      confirmed: other.sourceId,
    })
  }

  for (const b of confirmed) {
    if (byKeyPlanned.has(b.key)) continue
    onlyConfirmed.push({ key: b.key, label: b.label, confirmed: b.sourceId })
  }

  return { deltas, onlyPlanned, onlyConfirmed, agreeing }
}

/** Die Audio-Matrix als Zuweisungsliste: ein Output bekommt eine Quelle. */
export const audioMatrixAssignments = (
  matrix: AtemAudioMatrix | undefined,
): Assignment[] =>
  (matrix?.outputs ?? []).map((o) => ({
    key: `out:${o.id}`,
    label: o.name || `Out ${o.id}`,
    sourceId: o.sourceId,
  }))

/**
 * Die Multiviewer-Fenster als Zuweisungsliste.
 *
 * Der Schluessel traegt den MV-Index mit: Fenster 3 auf MV 1 und Fenster 3
 * auf MV 2 sind verschiedene Ziele, und ohne den Index verglichen wuerde das
 * eine still das andere ueberschreiben.
 */
export const mvAssignments = (
  multiViewers: readonly AtemMvDefinition[] | undefined,
): Assignment[] =>
  (multiViewers ?? []).flatMap((mv) =>
    (mv.windows ?? []).map((w) => ({
      key: `mv:${mv.index}:win:${w.windowIndex}`,
      label: `MV ${mv.index + 1} · Fenster ${w.windowIndex}`,
      sourceId: w.sourceId,
    })),
  )

/** Bequemer Einstieg fuer den MV-Dialog, der eine ganze Konfig in der Hand hat. */
export const mvConfigAssignments = (config: AtemMvConfig | undefined): Assignment[] =>
  mvAssignments(config?.multiViewers)
