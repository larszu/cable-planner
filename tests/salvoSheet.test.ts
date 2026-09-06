import { describe, expect, it } from 'vitest'
import {
  CHANGEOVER_HEADERS,
  NOT_SET,
  NO_PORT_LABEL,
  SALVO_HEADERS,
  changeoverTable,
  portLabelsOf,
  printedNumber,
  salvoById,
  salvoChanges,
  salvoFindings,
  salvoTable,
  type PortLabels,
} from '../src/renderer/lib/salvoSheet'
import type { Port, VideohubCrosspoints, VideohubSalvo } from '../src/renderer/types/equipment'
import libQuelle from '../src/renderer/lib/salvoSheet.ts?raw'
import dialogQuelle from '../src/renderer/components/Export/VideohubExportDialog.tsx?raw'

// ---------------------------------------------------------------------------
// Der Umbau-Zettel: nur was sich aendert (Bedarf 121, P4).
//
//   > A printed paper sheet of routes is RE-KEYED INTO A 40x40 VIDEOHUB
//   > BEFORE EVERY CHANGEOVER.
//
// Belegt an `bitfocus/companion-module-bmd-videohub#9` (2020-10, weiterhin
// offen), woertlich: „I have a paper sheet of routes for our BMD 40x40 that I
// need to manually enter before each change over" — eine Halle, die zwischen
// Baseball und Softball wechselt.
//
// Die Einsicht dieses Inkrements: der Zettel, den es heute gibt, ist der
// FALSCHE. Wer vierzig Zeilen abtippt, tippt achtunddreissig davon
// unveraendert ab.
// ---------------------------------------------------------------------------

const labels: PortLabels = {
  inputs: ['Kamera 1', 'Kamera 2', 'Kamera 3', ''],
  outputs: ['Regie', 'Anzeigetafel', 'Aufzeichnung', ''],
}

const salvo = (id: string, name: string, routing: VideohubCrosspoints): VideohubSalvo => ({
  id,
  name,
  routing,
  createdAt: '2026-09-06T10:00:00.000Z',
})

// ── 1. Die Nummer auf dem Papier ───────────────────────────────────────────

describe('die aufgedruckte Nummer', () => {
  it('faengt bei 1 an, nicht bei 0', () => {
    // Intern sind Ein- und Ausgaenge 0-basiert (so kommen sie ueber das
    // Videohub-Protokoll). Eine Liste, die um eins verschoben ist, fuehrt beim
    // Umbau zum falschen Kreuzpunkt — und das merkt man erst, wenn das Bild
    // falsch ist.
    expect(printedNumber(0)).toBe(1)
    expect(printedNumber(39)).toBe(40)
  })

  it('rechnet die Nummer im BLATT um, nicht erst im Aufrufer', () => {
    const [zeile] = salvoTable({ 0: 2 }, labels).rows
    expect(zeile[0]).toBe(1)
    expect(zeile[2]).toBe(3)
  })
})

// ── 2. Der volle Satz ──────────────────────────────────────────────────────

describe('salvoTable — der Zettel, den es heute gibt', () => {
  it('haelt den Spaltenkopf fest', () => {
    expect(salvoTable({}, labels).headers).toEqual([...SALVO_HEADERS])
  })

  it('sortiert nach Ausgang — so wird umgesteckt', () => {
    const rows = salvoTable({ 2: 0, 0: 1, 1: 2 }, labels).rows
    expect(rows.map((r) => r[0])).toEqual([1, 2, 3])
  })

  it('setzt die Beschriftungen beider Seiten ein', () => {
    const [zeile] = salvoTable({ 1: 0 }, labels).rows
    expect(zeile[1]).toBe('Anzeigetafel')
    expect(zeile[3]).toBe('Kamera 1')
  })

  it('nennt den unbeschrifteten Port beim Namen', () => {
    const [zeile] = salvoTable({ 3: 3 }, labels).rows
    expect(zeile[1]).toBe(NO_PORT_LABEL)
    expect(zeile[3]).toBe(NO_PORT_LABEL)
  })

  it('ignoriert kaputte Ausgangs-Schluessel', () => {
    expect(salvoTable({ '-1': 0, x: 1 } as unknown as VideohubCrosspoints, labels).rows).toEqual([])
  })
})

// ── 3. Der Umbau-Zettel ────────────────────────────────────────────────────

describe('changeoverTable — der Zettel, um den es geht', () => {
  const baseball = { 0: 0, 1: 1, 2: 2 }
  const softball = { 0: 0, 1: 2, 2: 2 }

  it('haelt den Spaltenkopf fest', () => {
    expect(changeoverTable({}, {}, labels).headers).toEqual([...CHANGEOVER_HEADERS])
  })

  it('fuehrt NUR die Kreuzpunkte, die sich aendern', () => {
    // DAS ist die Antwort auf den Beleg: nicht vierzig Zeilen abtippen,
    // sondern die vier, die anders sind.
    const rows = changeoverTable(baseball, softball, labels).rows
    expect(rows).toHaveLength(1)
    expect(rows[0][0]).toBe(2)
  })

  it('schreibt Vorher UND Nachher, damit man es gegenlesen kann', () => {
    const [zeile] = changeoverTable(baseball, softball, labels).rows
    expect(zeile[2]).toBe(2)
    expect(zeile[3]).toBe(3)
    expect(zeile[4]).toBe('Kamera 3')
  })

  it('ist bei gleichen Saetzen LEER — und das ist eine Antwort', () => {
    expect(changeoverTable(baseball, baseball, labels).rows).toEqual([])
  })

  it('nennt einen Ausgang, den nur EINE Seite kennt, statt ihn zu verschweigen', () => {
    // Fehlen ist ein Unterschied, kein Gleichstand: wer vor dem Ausgang steht
    // und nicht weiss, ob er ihn lassen soll, hat ein Problem.
    const nur_a = changeoverTable({ 0: 0, 1: 1 }, { 0: 0 }, labels).rows
    expect(nur_a).toHaveLength(1)
    expect(nur_a[0][2]).toBe(2)
    expect(nur_a[0][3]).toBe(NOT_SET)
    expect(nur_a[0][4]).toBe(NOT_SET)

    const nur_b = changeoverTable({ 0: 0 }, { 0: 0, 1: 1 }, labels).rows
    expect(nur_b[0][2]).toBe(NOT_SET)
    expect(nur_b[0][3]).toBe(2)
  })
})

describe('salvoChanges', () => {
  it('benennt die beiden Seiten „from" und „to", nicht „planned" und „live"', () => {
    // Dieselbe Rechnung wie `routingDifferences`, aber ein Umbau vergleicht
    // zweimal einen PLAN. „planned"/„live" waere auf diesem Blatt schlicht
    // falsch.
    const [c] = salvoChanges({ 0: 1 }, { 0: 2 })
    expect(c).toEqual({ output: 0, from: 1, to: 2 })
  })

  it('laesst die fehlende Seite weg, statt sie als undefined zu fuehren', () => {
    const [c] = salvoChanges({ 0: 1 }, {})
    expect('to' in c).toBe(false)
    expect(c.from).toBe(1)
  })
})

// ── 4. Die Befunde ueber die Sammlung ──────────────────────────────────────

describe('salvoFindings', () => {
  it('meldet zwei Saetze mit demselben Namen als FEHLER', () => {
    // Wer am Telefon „fahr Satz A" sagt, meint dann zwei verschiedene
    // Zustaende.
    const f = salvoFindings([salvo('1', 'Show A', { 0: 0 }), salvo('2', 'show a', { 0: 1 })])
    const doppelt = f.find((x) => x.kind === 'duplicate-name')
    expect(doppelt?.severity).toBe('error')
  })

  it('meldet den leeren Satz', () => {
    const f = salvoFindings([salvo('1', 'Leer', {})])
    expect(f.find((x) => x.kind === 'empty-salvo')?.severity).toBe('warning')
  })

  it('meldet die Deckungsluecke zwischen zwei Saetzen', () => {
    // Auf dem Umbau-Zettel stuende dort „nicht gesetzt", und davor steht beim
    // Umbau jemand ratlos.
    const f = salvoFindings([
      salvo('1', 'Baseball', { 0: 0, 1: 1 }),
      salvo('2', 'Softball', { 0: 0, 2: 2 }),
    ])
    const luecke = f.find((x) => x.kind === 'partial-coverage')
    expect(luecke).toBeDefined()
    expect(luecke?.message).toContain(NOT_SET)
  })

  it('meldet dieselbe Luecke nur EINMAL je Paar', () => {
    const f = salvoFindings([
      salvo('1', 'A', { 0: 0, 1: 1 }),
      salvo('2', 'B', { 0: 0, 2: 2 }),
    ])
    expect(f.filter((x) => x.kind === 'partial-coverage')).toHaveLength(1)
  })

  it('meldet nichts bei zwei sauberen, deckungsgleichen Saetzen', () => {
    expect(
      salvoFindings([salvo('1', 'Baseball', { 0: 0, 1: 1 }), salvo('2', 'Softball', { 0: 1, 1: 0 })]),
    ).toEqual([])
  })
})

// ── 5. Kleinkram, der trotzdem beisst ──────────────────────────────────────

describe('salvoById', () => {
  const liste = [salvo('a', 'A', {}), salvo('b', 'B', {})]

  it('findet den Satz', () => {
    expect(salvoById(liste, 'b')?.name).toBe('B')
  })

  it('macht „keine Auswahl" und „gibt es nicht" zu EINEM Fall', () => {
    expect(salvoById(liste, '')).toBeUndefined()
    expect(salvoById(liste, undefined)).toBeUndefined()
    expect(salvoById(liste, 'weg')).toBeUndefined()
  })
})

describe('portLabelsOf', () => {
  const port = (id: string, name: string): Port =>
    ({ id, name, type: 'BNC', connectorType: 'BNC' }) as Port

  it('nimmt die vorhandene Port-Vokabel', () => {
    const l = portLabelsOf({ inputs: [port('i1', 'CAM 1')], outputs: [port('o1', 'PGM')] })
    expect(l.inputs[0]).toBe('CAM 1')
    expect(l.outputs[0]).toBe('PGM')
  })
})

// ── 6. Reinheit und Erreichbarkeit ─────────────────────────────────────────

describe('das Modul und die Oberflaeche', () => {
  it('nimmt keine Uhr und keinen Store', () => {
    expect(libQuelle).not.toContain('new Date(')
    expect(libQuelle).not.toContain('useProjectStore')
  })

  it('rechnet den Unterschied NICHT ein zweites Mal', () => {
    // `routingDifferences` macht dieselbe Rechnung fuer Plan-gegen-Geraet.
    // Sie zweimal zu haben hiesse, sie zweimal zu pflegen.
    expect(libQuelle).toContain('routingDifferences(from, to)')
    expect(libQuelle).not.toMatch(/for \(const output of \[\.\.\.outputs\]/)
  })

  it('baut die Beschriftungen NICHT selbst aus Rollen und Kabeln', () => {
    // Die Aufloesung liegt in `exportVideohub.displayFor` und haengt am
    // Kabelgraphen. Sie hier ein zweites Mal zu bauen waere die zweite
    // Wahrheit — und sie liefe sofort auseinander.
    expect(libQuelle).not.toContain('roleLabelsByPort')
    expect(libQuelle).toContain('Kommt fertig herein')
  })

  it('ist im Videohub-Dialog erreichbar', () => {
    // Auf die FORM und nicht auf den blossen Namen: `{false && <Changeover…}`
    // enthielte den Namen auch und zeigte nichts. Die Gegenprobe hat genau
    // das durchgelassen.
    expect(dialogQuelle).toMatch(
      /\{salvos\.length > 0 && \(\s*<ChangeoverSheet\b/,
    )
    expect(dialogQuelle).toContain('deviceName={device?.name')
    expect(dialogQuelle).toContain('labels={portLabels}')
  })

  it('nimmt im Dialog DIESELBE Beschriftung wie die uebrigen Ausgabewege', () => {
    // Vier Wege standen dort vorher mit eigenem `portDisplayLabel`; genau so
    // entsteht einer, der die Rolle nicht kennt.
    const block = dialogQuelle.slice(
      dialogQuelle.indexOf('const portLabels: PortLabels'),
      dialogQuelle.indexOf('// Kein Raten: Geraetetyp-ID'),
    )
    expect(block).toContain('labelOf(p, ')
    expect(block).not.toContain('portDisplayLabel')
  })
})
