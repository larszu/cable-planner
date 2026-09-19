// ───────────────────────────────────────────────────────────────────────────
// Wo ist der Katalog duenn — dort, wo die Zielkunden arbeiten? (#878, AK 1)
//
// #878 nennt fuenf Bereiche und eine Beobachtung („knapp 1.000 Eintraege,
// davon ueber ein Drittel Mikrofone"). Beides stand als Prosa im Issue und
// nirgends im Baum. Diese Datei haelt die NACHGEMESSENEN Zahlen fest:
//
//   1. Die Beobachtung, gegengerechnet — die Schieflage stimmt, die
//      Groessenordnung nicht.
//   2. Ein Bereich steht bei NULL, und das ist eine andere Auskunft als
//      „wenig".
//   3. Die Ratsche: die heutigen Staende, damit ein Auffuellen sichtbar wird.
//   4. Die Bereiche zaehlen woertlich, nicht per Teilzeichenkette.
//   5. Luecken- und Beleg-Messung lesen dieselbe Katalog-Liste.
//   6. Derselbe Baum ergibt denselben Bericht.
// ───────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { katalogLuecken, ZIELBEREICHE } from '../src/renderer/lib/katalogLuecken'
import { CATALOGUES, evidenceReport } from '../src/renderer/lib/catalogueEvidence'

const stand = (id: string) => katalogLuecken().proBereich.find((b) => b.id === id)!

describe('#878 — Katalog-Luecken in den Zielbereichen', () => {
  it('1. die Beobachtung aus dem Issue, gegengerechnet', () => {
    const b = katalogLuecken()
    // „knapp 1.000 Eintraege" — es sind 467. Die Zahl im Issue war geschaetzt;
    // diese ist gezaehlt, und sie ist die, gegen die geplant wird.
    expect(b.eintraegeGesamt).toBe(467)
    expect(b.eintraegeGesamt).toBe(evidenceReport().entries)

    // „ueber ein Drittel Mikrofone" — das stimmt, und zwar deutlich.
    expect(b.groessteKategorie.kategorie).toBe('Microphones')
    expect(b.groessteKategorie.eintraege).toBe(184)
    expect(b.groessteKategorie.anteil).toBeGreaterThan(1 / 3)
  })

  it('2. „gar nicht" ist eine andere Auskunft als „wenig"', () => {
    const b = katalogLuecken()
    // LED-Prozessoren (Novastar, Brompton, Megapixel) haben keine duenne
    // Kategorie — sie haben KEINE. Faellt nur auf, wer gegen eine Soll-Liste
    // zaehlt statt die vorhandenen Kataloge aufzuzaehlen.
    expect(b.leereBereiche).toEqual(['led-prozessoren'])
    expect(stand('led-prozessoren').eintraege).toBe(0)
  })

  it('3. die Ratsche: die Staende von heute', () => {
    // Wer einen Bereich auffuellt, macht diese Zeilen rot und zieht die Zahl
    // nach. Ein Ziel, das niemand nachrechnet, ist ein Vorsatz.
    expect(stand('kameras').eintraege).toBe(20)
    expect(stand('konverter').eintraege).toBe(30)
    expect(stand('netzwerk').eintraege).toBe(81)
    expect(stand('intercom').eintraege).toBe(8)
    expect(katalogLuecken().eintraegeInBereichen).toBe(139)

    // Und die Breite, nicht nur die Menge: Kameras und Intercom haengen an je
    // EINEM Katalog. Ein Bereich mit einem Hersteller ist kein bestueckter
    // Bereich, sondern ein bestuecktes Haus.
    expect(stand('kameras').kataloge).toEqual(['camera'])
    expect(stand('intercom').kataloge).toEqual(['greengo'])
    expect(stand('konverter').kataloge.length).toBeGreaterThan(2)

    // Was dazukommt, kommt mit Datenblatt (#878: „Lieber
    // Herstellerdatenblaetter als Quelle"). Die Konverter sind heute
    // vollstaendig belegt — das bleibt so.
    expect(stand('konverter').belegt).toBe(stand('konverter').eintraege)
  })

  it('4. die Bereiche zaehlen woertlich', () => {
    // Ein `includes` auf der Kategorie haette „Video Converter" auch unter
    // „Video" gezaehlt und die Konverter-Luecke mit Mischern zugedeckt.
    const probe = [{
      name: 'test',
      entries: [
        { deviceTypeId: 'a', template: { name: 'A', category: 'Video', manufacturerUrl: 'x' } },
        { deviceTypeId: 'b', template: { name: 'B', category: 'Converter', manufacturerUrl: '' } },
      ],
    }]
    const b = katalogLuecken(probe)
    expect(b.proBereich.find((x) => x.id === 'konverter')!.eintraege).toBe(1)
    expect(b.proBereich.find((x) => x.id === 'konverter')!.belegt).toBe(0)
    expect(b.eintraegeGesamt).toBe(2)
  })

  it('5. Luecken- und Beleg-Messung lesen dieselbe Liste', () => {
    // Vorgabe-Argument beider Funktionen ist dasselbe `CATALOGUES`. Zwei
    // Listen koennten abweichen, und beide Berichte saehen richtig aus.
    expect(katalogLuecken().eintraegeGesamt)
      .toBe(CATALOGUES.reduce((s, k) => s + k.entries.length, 0))
    // Die fuenf Bereiche sind eine Abschrift des Akzeptanzkriteriums.
    expect(ZIELBEREICHE.map((z) => z.id)).toEqual([
      'kameras', 'konverter', 'netzwerk', 'led-prozessoren', 'intercom',
    ])
  })

  it('6. derselbe Baum ergibt denselben Bericht', () => {
    expect(katalogLuecken()).toEqual(katalogLuecken())
    // Die Katalog-Namen je Bereich stehen sortiert, auch bei unsortierter
    // Eingabe — dieselbe Regel wie bei `evidenceReport` (ADR-004).
    const durcheinander = [
      { name: 'zeta', entries: [{ deviceTypeId: 'z', template: { name: 'Z', category: 'Intercom', manufacturerUrl: '' } }] },
      { name: 'alpha', entries: [{ deviceTypeId: 'a', template: { name: 'A', category: 'Intercom', manufacturerUrl: '' } }] },
    ]
    expect(katalogLuecken(durcheinander).proBereich.find((b) => b.id === 'intercom')!.kataloge)
      .toEqual(['alpha', 'zeta'])
  })
})
