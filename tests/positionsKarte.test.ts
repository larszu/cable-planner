import { describe, expect, it } from 'vitest'
import {
  ablaufAusText,
  aenderungen,
  normaliseRundown,
  positionsKarte,
} from '../src/renderer/lib/rundownCard'
import type { RundownPlan } from '../src/renderer/types/rundown'

// ───────────────────────────────────────────────────────────────────────────
// BEDARF 10 — der laufende Ablauf, live, an der Kameraposition.
//
// Drei Fragen entscheiden, ob so eine Karte im Saal etwas taugt, und alle
// drei sind hier zugesichert:
//
//   1. Zeigt sie die GANZE Show? Eine Karte, die nur meine Abschnitte zeigt,
//      behauptet eine kuerzere Show als die, die laeuft.
//   2. Sagt sie „kein Auftrag eingetragen" statt „frei"? Das eine ist eine
//      Beobachtung, das andere eine Freigabe, die niemand gegeben hat.
//   3. Leuchtet der Aenderungsbalken NUR bei meiner Position? Einer, der bei
//      jeder fremden Aenderung blinkt, wird nach dem dritten Mal ignoriert —
//      und dann sieht ihn niemand mehr, wenn er einmal mich meint.
// ───────────────────────────────────────────────────────────────────────────

const plan = (over: Partial<RundownPlan> = {}): RundownPlan => ({
  source: 'Regieplan.xlsx',
  revision: 'v4',
  importedAt: '2026-09-09T09:00:00.000Z',
  segments: [
    { id: 's1', number: '1', title: 'Begruessung' },
    { id: 's2', number: '2', title: 'Interview' },
    { id: 's3', number: '3', title: 'Musik' },
  ],
  coverage: [
    { segmentId: 's1', sourceId: 'cam1', shot: 'Totale Buehne' },
    { segmentId: 's3', sourceId: 'cam1', shot: 'Nah Gitarre' },
    { segmentId: 's2', sourceId: 'cam3', shot: 'Nah Gast' },
  ],
  ...over,
})

describe('Bedarf 10 — die Karte an der Kameraposition', () => {
  it('zeigt JEDEN Abschnitt, auch den ohne Auftrag', () => {
    const karte = positionsKarte(plan(), 'cam1')
    // Nicht zwei Zeilen, sondern drei: die Show hat drei Abschnitte, und die
    // Karte, die nur meine zeigte, liesse mich bei Abschnitt 3 raten, ob ich
    // Abschnitt 2 verpasst habe.
    expect(karte.zeilen).toHaveLength(3)
    expect(karte.zeilen.map((z) => z.segment.id)).toEqual(['s1', 's2', 's3'])
    expect(karte.mitAuftrag).toBe(2)
  })

  it('laesst den Auftrag fehlen, statt „frei" zu behaupten', () => {
    const karte = positionsKarte(plan(), 'cam1')
    const ohne = karte.zeilen.find((z) => z.segment.id === 's2')!
    expect(ohne.coverage).toBeUndefined()
    // Und das Feld ist gar nicht erst da — ein leeres Objekt saehe aus wie
    // ein eingetragener, aber leerer Auftrag.
    expect('coverage' in ohne).toBe(false)
  })

  it('folgt der Reihenfolge des ABLAUFS, nicht der Zuordnungsliste', () => {
    // In `coverage` steht s3 vor s2. Wer die Karte daraus baute, zeigte die
    // Reihenfolge, in der jemand Auftraege eingetragen hat.
    const karte = positionsKarte(plan(), 'cam1')
    expect(karte.zeilen.map((z) => z.position)).toEqual([1, 2, 3])
    expect(karte.zeilen[2].coverage?.shot).toBe('Nah Gitarre')
  })

  it('nimmt fremde Auftraege nicht auf die Karte', () => {
    const karte = positionsKarte(plan(), 'cam1')
    expect(karte.zeilen.find((z) => z.segment.id === 's2')?.coverage).toBeUndefined()
    const cam3 = positionsKarte(plan(), 'cam3')
    expect(cam3.mitAuftrag).toBe(1)
    expect(cam3.zeilen[1].coverage?.shot).toBe('Nah Gast')
  })

  it('traegt Herkunft und Stand mit — sonst sieht jede Karte aktuell aus', () => {
    const karte = positionsKarte(plan(), 'cam1')
    expect(karte.source).toBe('Regieplan.xlsx')
    expect(karte.revision).toBe('v4')
    expect(karte.importedAt).toBe('2026-09-09T09:00:00.000Z')
  })

  it('nimmt bei doppelter Zuordnung den ersten Eintrag', () => {
    const p = plan({
      coverage: [
        { segmentId: 's1', sourceId: 'cam1', shot: 'Totale Buehne' },
        { segmentId: 's1', sourceId: 'cam1', shot: 'Irgendwas anderes' },
      ],
    })
    // Der spaeter angehaengte Eintrag darf den urspruenglichen nicht still
    // ueberschreiben — sonst gewinnt beim Zusammenfuehren zweier Listen immer
    // die zufaellig hintere.
    expect(positionsKarte(p, 'cam1').zeilen[0].coverage?.shot).toBe('Totale Buehne')
  })
})

describe('Bedarf 10 — der Aenderungsbalken, und wann er NICHT leuchtet', () => {
  it('bleibt still, wenn sich der Auftrag einer FREMDEN Position aendert', () => {
    // Die Regel, wegen der der Bedarf „per role" sagt.
    const vorher = plan()
    const jetzt = plan({
      coverage: [
        { segmentId: 's1', sourceId: 'cam1', shot: 'Totale Buehne' },
        { segmentId: 's3', sourceId: 'cam1', shot: 'Nah Gitarre' },
        { segmentId: 's2', sourceId: 'cam3', shot: 'GANZ etwas anderes' },
      ],
    })
    const a = aenderungen(vorher, jetzt, 'cam1')
    expect(a.unveraendert).toBe(true)
    expect(a.geaendert).toBe(0)
    // Und bei der Position, die es betrifft, leuchtet er.
    expect(aenderungen(vorher, jetzt, 'cam3').geaendert).toBe(1)
  })

  it('meldet den geaenderten Abschnittstext', () => {
    const jetzt = plan({
      segments: [
        { id: 's1', number: '1', title: 'Begruessung durch den Intendanten' },
        { id: 's2', number: '2', title: 'Interview' },
        { id: 's3', number: '3', title: 'Musik' },
      ],
    })
    const a = aenderungen(plan(), jetzt, 'cam1')
    expect(a.geaendert).toBe(1)
    expect(a.zeilen.find((z) => z.segmentId === 's1')?.art).toBe('anders')
  })

  it('meldet den geaenderten EIGENEN Auftrag, auch bei gleichem Abschnitt', () => {
    const jetzt = plan({
      coverage: [
        { segmentId: 's1', sourceId: 'cam1', shot: 'Nah Intendant' },
        { segmentId: 's3', sourceId: 'cam1', shot: 'Nah Gitarre' },
        { segmentId: 's2', sourceId: 'cam3', shot: 'Nah Gast' },
      ],
    })
    const a = aenderungen(plan(), jetzt, 'cam1')
    expect(a.zeilen.find((z) => z.segmentId === 's1')?.art).toBe('anders')
    expect(a.geaendert).toBe(1)
  })

  it('meldet einen neu HINZUGEKOMMENEN eigenen Auftrag', () => {
    const jetzt = plan({
      coverage: [...plan().coverage, { segmentId: 's2', sourceId: 'cam1', shot: 'Halbtotale' }],
    })
    const a = aenderungen(plan(), jetzt, 'cam1')
    expect(a.zeilen.find((z) => z.segmentId === 's2')?.art).toBe('anders')
  })

  it('meldet einen WEGGEFALLENEN eigenen Auftrag', () => {
    const jetzt = plan({
      coverage: plan().coverage.filter((c) => c.segmentId !== 's1'),
    })
    const a = aenderungen(plan(), jetzt, 'cam1')
    expect(a.zeilen.find((z) => z.segmentId === 's1')?.art).toBe('anders')
  })

  it('behaelt entfallene Abschnitte in der Liste', () => {
    const jetzt = plan({ segments: plan().segments.filter((s) => s.id !== 's2') })
    const a = aenderungen(plan(), jetzt, 'cam1')
    // Ein Abschnitt, der aus dem Ablauf genommen wurde, ist die wichtigste
    // Nachricht fuer jemanden, der ihn auf dem Ausdruck stehen hat. Ihn
    // wegzulassen hiesse, die Aenderung durch ein Fehlen mitzuteilen.
    const weg = a.zeilen.find((z) => z.segmentId === 's2')
    expect(weg?.art).toBe('entfallen')
    expect(weg?.vorherPosition).toBe(2)
    expect(weg?.jetztPosition).toBeUndefined()
    expect(a.entfallen).toBe(1)
  })

  it('meldet neue Abschnitte', () => {
    const jetzt = plan({
      segments: [...plan().segments, { id: 's4', number: '4', title: 'Abmoderation' }],
    })
    const a = aenderungen(plan(), jetzt, 'cam1')
    expect(a.neu).toBe(1)
    expect(a.zeilen.find((z) => z.segmentId === 's4')?.jetztPosition).toBe(4)
  })

  it('haelt Verschieben und Inhaltsaenderung auseinander', () => {
    const jetzt = plan({
      segments: [
        { id: 's2', number: '2', title: 'Interview' },
        { id: 's1', number: '1', title: 'Begruessung' },
        { id: 's3', number: '3', title: 'Musik' },
      ],
    })
    const a = aenderungen(plan(), jetzt, 'cam1')
    const s1 = a.zeilen.find((z) => z.segmentId === 's1')!
    // Verschoben, aber inhaltlich derselbe. Beides in einen Wert zu pressen
    // liesse eine der beiden Tatsachen verschwinden.
    expect(s1.art).toBe('gleich')
    expect(s1.vorherPosition).toBe(1)
    expect(s1.jetztPosition).toBe(2)
    expect(a.verschoben).toBe(2)
    expect(a.geaendert).toBe(0)
    // Und der Balken leuchtet trotzdem: verschoben ist eine Aenderung.
    expect(a.unveraendert).toBe(false)
  })

  it('sagt „unveraendert", wenn wirklich nichts anders ist', () => {
    const a = aenderungen(plan(), plan(), 'cam1')
    expect(a.unveraendert).toBe(true)
    expect(a.zeilen.every((z) => z.art === 'gleich')).toBe(true)
    expect(a.zeilen.every((z) => z.vorherPosition === undefined)).toBe(true)
  })
})

describe('Bedarf 10 — einlesen, ohne die Kennung zu erfinden', () => {
  const text = ['1\tBegruessung', '2\tInterview\tGast kommt von links', '3\tMusik'].join('\n')

  it('liest Nummer, Titel und Notiz — mit Tabulator wie mit Semikolon', () => {
    const mitTab = ablaufAusText(text)
    expect(mitTab.segments).toHaveLength(3)
    expect(mitTab.segments[1]).toEqual({
      id: '2',
      number: '2',
      title: 'Interview',
      note: 'Gast kommt von links',
    })
    const mitSemikolon = ablaufAusText('1;Begruessung\n2;Interview;Gast kommt von links\n3;Musik')
    expect(mitSemikolon.segments).toEqual(mitTab.segments)
  })

  it('gibt beim zweiten Einlesen desselben Textes DIESELBEN Kennungen', () => {
    // Ohne diese Zusicherung waere nach jedem neuen Stand jeder Abschnitt
    // „neu" und jeder alte „entfallen" — der Aenderungsbalken zeigte alles
    // rot, genau in dem Augenblick, fuer den es ihn gibt.
    expect(ablaufAusText(text).segments.map((s) => s.id)).toEqual(
      ablaufAusText(text).segments.map((s) => s.id),
    )
  })

  it('haelt die Kennung an der NUMMER fest, nicht am Titel', () => {
    // Die Redaktion formuliert den Titel um. Der Auftrag der Kamera muss
    // haengen bleiben — und die Aenderung als „geaendert" erscheinen, nicht
    // als „entfallen plus neu".
    const neu = ablaufAusText('1\tBegruessung durch den Intendanten\n2\tInterview\n3\tMusik')
    expect(neu.segments[0].id).toBe('1')

    const vorher = {
      source: 'Regieplan',
      segments: ablaufAusText(text).segments,
      coverage: [{ segmentId: '1', sourceId: 'cam1', shot: 'Totale Buehne' }],
    }
    const jetzt = { ...vorher, segments: neu.segments }
    const a = aenderungen(vorher, jetzt, 'cam1')
    expect(a.zeilen.find((z) => z.segmentId === '1')?.art).toBe('anders')
    expect(a.entfallen).toBe(0)
    expect(a.neu).toBe(0)
    // Und der Auftrag ist noch da.
    expect(positionsKarte(jetzt, 'cam1').mitAuftrag).toBe(1)
  })

  it('nimmt den Titel als Kennung, wenn die Quelle keine Nummer gibt', () => {
    const ohne = ablaufAusText('Begruessung\nInterview')
    expect(ohne.segments.map((s) => s.id)).toEqual(['Begruessung', 'Interview'])
    expect(ohne.segments[0].number).toBeUndefined()
  })

  it('macht doppelte Nummern unterscheidbar — und zwar reproduzierbar', () => {
    const doppelt = ablaufAusText('3\tMusik\n3\tMusik Reprise')
    expect(doppelt.segments.map((s) => s.id)).toEqual(['3', '3#2'])
    expect(ablaufAusText('3\tMusik\n3\tMusik Reprise').segments.map((s) => s.id)).toEqual([
      '3',
      '3#2',
    ])
  })

  it('meldet eine Zeile ohne Titel, statt sie wegzulassen', () => {
    const gelesen = ablaufAusText('1\tBegruessung\n2\t\n3\tMusik')
    expect(gelesen.segments).toHaveLength(2)
    expect(gelesen.funde).toEqual([{ zeile: 2, text: '2', grund: 'ohne-titel' }])
  })
})

describe('Bedarf 10 — was beim Laden geheilt wird', () => {
  it('macht aus „gar nichts" kein leeres Objekt', () => {
    expect(normaliseRundown(undefined)).toBeUndefined()
    expect(normaliseRundown(null)).toBeUndefined()
    expect(normaliseRundown({ segments: [], coverage: [] })).toBeUndefined()
  })

  it('verwirft Zuordnungen auf Abschnitte, die es nicht gibt', () => {
    // Sie koennten nie angezeigt werden und saehen in der Datei aus wie
    // Auftraege, die jemand erteilt hat.
    const geheilt = normaliseRundown({
      source: 'Regieplan',
      segments: [{ id: 's1', title: 'Begruessung' }],
      coverage: [
        { segmentId: 's1', sourceId: 'cam1', shot: 'Totale' },
        { segmentId: 'weg', sourceId: 'cam1', shot: 'Geist' },
      ],
    })
    expect(geheilt?.coverage).toHaveLength(1)
    expect(geheilt?.coverage[0].segmentId).toBe('s1')
  })

  it('benennt eine fehlende Herkunft, statt sie leer zu lassen', () => {
    const geheilt = normaliseRundown({ segments: [{ id: 's1', title: 'A' }], coverage: [] })
    expect(geheilt?.source).toBe('Herkunft unbekannt')
  })
})
