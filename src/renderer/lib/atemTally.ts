/**
 * Vom Mischer-Zustand zur Tally-Anzeige im Canvas.
 *
 * WAS HIER ÜBERSETZT WIRD. Der Mischer kennt EINGANGSNUMMERN, der Plan kennt
 * GERÄTE. Die Brücke dazwischen gibt es seit Initiative 2 und wird hier nicht
 * neu gebaut: `buildTallyMap` leitet aus dem Kabelgraph ab, welche Kamera an
 * welchem Eingang hängt. Eine zweite Zuordnung daneben wäre die zweite
 * Wahrheit, gegen die ADR-001 geschrieben ist — und die beiden gingen genau
 * dann auseinander, wenn jemand umpatcht.
 *
 * WAS EIN GERÄT OHNE EINTRAG BEKOMMT: nichts. Kein `off`, kein Eintrag.
 * `tallyOf` gibt dafür `null` zurück, und die Anzeige lässt es in Ruhe. Eine
 * Kamera, die der Mischer nicht kennt, darf nicht aussehen wie eine, von der
 * bekannt ist, dass sie nicht auf Sendung ist — das ist der gefährlichste
 * Irrtum an einer Tally-Anzeige, weil er in die falsche Richtung beruhigt.
 *
 * PROGRAM SCHLÄGT PREVIEW. Steht dieselbe Quelle auf beidem (üblich beim
 * Vorbereiten eines Schnitts auf sich selbst), gilt Program: rot ist die
 * Aussage, auf die es ankommt, und ein grüner Ring darüber wäre die
 * gefährlichere Hälfte der Wahrheit.
 *
 * NUR MIX-EFFECT 0, und das ausdrücklich. Ein Mischer mit zwei ME hat zwei
 * Programme; welches „das" Programm ist, entscheidet die Regie und nicht
 * diese Datei. Solange der Plan das nicht führt, ist ME 1 die einzige
 * belegbare Annahme — die Alternative wäre, beide zu verodern und damit eine
 * Kamera rot zu zeigen, die auf keinem Ausspielweg liegt.
 */

import type { LiveTally } from './signalAnimation'
import type { TallyMapRow } from './tallyMap'

/** Der Ausschnitt des Mischer-Zustands, den diese Datei braucht. */
export interface AtemMixEffectState {
  index: number
  programInput?: number
  previewInput?: number
  inTransition?: boolean
}

export interface AtemStateSlice {
  mixEffectStates?: readonly AtemMixEffectState[]
}

/**
 * Die Tally-Meldungen zu einem Mischer-Zustand.
 *
 * `at` kommt von aussen, damit die Rechnung rein bleibt — dieselbe Trennung
 * wie beim Ablauf-Import und beim Seed-Merge.
 */
export const atemTally = (
  state: AtemStateSlice | null | undefined,
  rows: readonly TallyMapRow[],
  at: number,
): LiveTally[] => {
  const me = state?.mixEffectStates?.find((m) => m.index === 0)
  if (!me) return []

  const out: LiveTally[] = []
  const gesehen = new Set<string>()

  const nimm = (input: number | undefined, zustand: 'program' | 'preview') => {
    if (typeof input !== 'number') return
    for (const row of rows) {
      if (row.switcher?.input !== input) continue
      // ALLE Geraete der Rolle, nicht nur das erste: ein Haupt-/Backup-Paar
      // haengt an demselben Eingang, und beide sind auf Sendung. Nur eines
      // rot zu zeigen liesse das andere aussehen, als sei es frei.
      for (const geraet of row.devices) {
        // Program zuerst eingesammelt: wer schon drin ist, bleibt.
        if (gesehen.has(geraet.id)) continue
        gesehen.add(geraet.id)
        out.push({ equipmentId: geraet.id, state: zustand, at, source: 'atem' })
      }
    }
  }

  nimm(me.programInput, 'program')
  nimm(me.previewInput, 'preview')
  return out
}
