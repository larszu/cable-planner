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
import { LED_PROCESSOR_CATALOG } from '../src/renderer/lib/ledProcessorCatalog'

const stand = (id: string) => katalogLuecken().proBereich.find((b) => b.id === id)!

describe('#878 — Katalog-Luecken in den Zielbereichen', () => {
  it('1. die Beobachtung aus dem Issue, gegengerechnet', () => {
    const b = katalogLuecken()
    // „knapp 1.000 Eintraege" — es waren 469 (467 am 2026-09-19, +2 LED-
    // Prozessoren am 2026-09-23). Die Zahl im Issue war geschaetzt; diese ist
    // gezaehlt, und sie ist die, gegen die geplant wird.
    //
    // 2026-09-24: 1802. Die Schaetzung des Issues ist damit UEBERHOLT, und
    // zwar nicht durch Recherche, sondern durch die Uebernahme aus den
    // Schwester-Planern — 365 Kamerabodies, 835 Objektive, 49 Rigs, 84
    // Lichtgeraete, alle mit `portsUnknown`. Der Unterschied zaehlt: die 469
    // von vorher waren Eintraege MIT Portliste. Wer gegen 1802 plant, darf
    // die beiden Sorten nicht verwechseln — `belegt` je Bereich sagt, wie
    // viele ein Datenblatt haben, und der Plan-Check zeigt am Geraet, ob die
    // Anschluesse noch fehlen.
    expect(b.eintraegeGesamt).toBe(1810)
    expect(b.eintraegeGesamt).toBe(evidenceReport().entries)

    // „ueber ein Drittel Mikrofone" — das stimmt, und zwar deutlich.
    // 2026-09-24: die groesste Kategorie sind nicht mehr die Mikrofone,
    // sondern die Objektive. Die Schieflage des Issues („ueber ein Drittel
    // Mikrofone") ist damit GEHEILT und gleichzeitig durch eine neue ersetzt
    // — 835 von 1802 sind Objektive, und keines von ihnen hat eine Buchse im
    // Plan. Das hier festzuhalten heisst: die naechste Schieflage ist schon
    // gemessen, bevor jemand sie fuer normal haelt.
    expect(b.groessteKategorie.kategorie).toBe('Lenses')
    expect(b.groessteKategorie.eintraege).toBe(835)
    expect(b.groessteKategorie.anteil).toBeGreaterThan(1 / 3)
  })

  it('2. „gar nicht" ist eine andere Auskunft als „wenig"', () => {
    const b = katalogLuecken()
    // LED-Prozessoren (Novastar, Brompton, Megapixel) haben keine duenne
    // Kategorie — sie haben KEINE. Faellt nur auf, wer gegen eine Soll-Liste
    // zaehlt statt die vorhandenen Kataloge aufzuzaehlen.
    // 2026-09-23: nicht mehr leer. Die Kategorie hatte keine Eintraege, weil
    // die Herstellerdatenblaetter von hier aus nicht erreichbar waren — nicht,
    // weil niemand daran gedacht haette. Seit sie es sind, stehen zwei
    // belegte Eintraege da (#878).
    expect(b.leereBereiche).toEqual([])
    expect(stand('led-prozessoren').eintraege).toBe(2)
    expect(stand('led-prozessoren').belegt).toBe(2)
  })

  it('3. die Ratsche: die Staende von heute', () => {
    // Wer einen Bereich auffuellt, macht diese Zeilen rot und zieht die Zahl
    // nach. Ein Ziel, das niemand nachrechnet, ist ein Vorsatz.
    // 20 -> 385 am 2026-09-24 (Uebernahme aus dem multicam-planner). 377
    // davon mit Datenblatt-Link, aber nur 20 mit Portliste.
    expect(stand('kameras').eintraege).toBe(385)
    // 30 -> 34 am 2026-09-24: Decimator. #878 nennt die Marke ausdruecklich,
    // und `docs/katalog-luecken.md` hielt fest, dass sie vollstaendig fehlte —
    // weil die Datenblaetter „nicht erreichbar" schienen. Erreichbar waren
    // sie; nur der Abruf-Dienst scheiterte an der Zertifikatskette.
    expect(stand('konverter').eintraege).toBe(34)
    expect(stand('netzwerk').eintraege).toBe(81)
    expect(stand('intercom').eintraege).toBe(8)
    expect(stand('led-prozessoren').eintraege).toBe(2)
    expect(katalogLuecken().eintraegeInBereichen).toBe(510)

    // Und die Breite, nicht nur die Menge: Kameras und Intercom haengen an je
    // EINEM Katalog. Ein Bereich mit einem Hersteller ist kein bestueckter
    // Bereich, sondern ein bestuecktes Haus.
    // Kameras haengen nicht mehr an EINEM Katalog — der zweite ist allerdings
    // derselbe Hersteller-Kreis, nur ohne Ports. Die Breite des Bereichs hat
    // sich also nicht geaendert, nur seine Laenge.
    expect(stand('kameras').kataloge).toEqual(['camera', 'cameraBody'])
    expect(stand('intercom').kataloge).toEqual(['greengo'])
    expect(stand('konverter').kataloge.length).toBeGreaterThan(2)

    // Was dazukommt, kommt mit Datenblatt (#878: „Lieber
    // Herstellerdatenblaetter als Quelle"). Die Konverter sind heute
    // vollstaendig belegt — das bleibt so.
    expect(stand('konverter').belegt).toBe(stand('konverter').eintraege)
    // Dasselbe fuer die neue Kategorie: sie faengt belegt an und bleibt es.
    expect(stand('led-prozessoren').belegt).toBe(stand('led-prozessoren').eintraege)
    // Und sie haengt an ZWEI Herstellern. Ein Bereich mit einem Hersteller
    // ist kein bestueckter Bereich, sondern ein bestuecktes Haus — die Zeilen
    // darueber sagen das ueber Kameras und Intercom, und es gilt hier auch.
    const hersteller = LED_PROCESSOR_CATALOG.map((e) => e.template.name.split(' ')[0])
    expect(new Set(hersteller).size).toBe(2)
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
