import { describe, expect, it } from 'vitest'
import {
  UNIVERSE_GROESSE,
  fussabdruck,
  geraetBefunde,
  lesereihenfolge,
  pruefeAdressen,
  vergibAdressen,
  type DmxGeraet,
  type DmxModus,
} from '../src/renderer/lib/dmx'

// ---------------------------------------------------------------------------
// Was diese Pruefungen halten — und warum jede einzelne.
//
// Der teure Fehler bei DMX ist nicht der falsche Wert an EINER Stelle. Es ist
// der Versatz: eine Kanalzahl daneben, und ab dem naechsten Geraet stimmt
// jede Adresse nicht mehr. Am Pult sieht das aus wie ein defektes Geraet.
//
// Die Tests fragen deshalb nicht „kommt eine Zahl heraus", sondern die vier
// Zusagen, an denen das haengt: der Modus entscheidet, unbekannt bleibt
// unbekannt, die Universe-Grenze wird nicht ueberschritten, und nichts wird
// still verschoben.
// ---------------------------------------------------------------------------

const modus = (teil: Partial<DmxModus> & { id: string; kanaele: number }): DmxModus => ({
  name: teil.id,
  herkunft: 'handbuch',
  ...teil,
})

const geraet = (teil: Partial<DmxGeraet> & { id: string }): DmxGeraet => ({
  name: teil.id,
  ...teil,
})

/** Ein Moving Head mit zwei Modi — der Fall, um den es geht. */
const mitModi = (id: string, gewaehlt: string | undefined, x = 0, y = 0): DmxGeraet =>
  geraet({
    id,
    x,
    y,
    modusId: gewaehlt,
    profil: {
      hersteller: 'Robe',
      modell: 'Robin MegaPointe',
      modi: [modus({ id: 'm1', name: 'Mode 1', kanaele: 25 }), modus({ id: 'm2', name: 'Mode 2', kanaele: 39 })],
    },
  })

describe('Der Modus entscheidet den Fussabdruck', () => {
  it('zwei Modi desselben Geraets ergeben zwei verschiedene Zahlen', () => {
    expect(fussabdruck(mitModi('a', 'm1'))).toBe(25)
    expect(fussabdruck(mitModi('a', 'm2'))).toBe(39)
  })

  it('ohne Modus ist der Fussabdruck NICHT BEKANNT — und nicht 0 oder 1', () => {
    // Der Kern des ganzen Pakets. Wer „unbekannt" zu einer Zahl macht,
    // vergibt jede Folgeadresse auf einer Annahme.
    expect(fussabdruck(mitModi('a', undefined))).toBeNull()
    expect(fussabdruck(geraet({ id: 'b' }))).toBeNull()
  })

  it('das Geraet ohne Modus bekommt KEINE Adresse, sondern einen Befund', () => {
    const e = vergibAdressen([mitModi('a', undefined)], { startUniverse: 1, startAdresse: 1 })
    expect(e.vergeben.has('a')).toBe(false)
    expect(e.befunde.map((b) => b.art)).toContain('modus-fehlt')
  })

  it('ein Modus, den das Profil nicht mehr kennt, ist ein Fehler und kein Schweigen', () => {
    const g = mitModi('a', 'm9')
    const b = geraetBefunde(g)
    expect(b.map((x) => x.art)).toContain('modus-unbekannt')
    expect(b.find((x) => x.art === 'modus-unbekannt')?.schwere).toBe('fehler')
  })

  it('eine geschaetzte Kanalzahl wird gemeldet, nicht geglaubt', () => {
    const g = geraet({
      id: 'a',
      modusId: 'm1',
      profil: { hersteller: 'X', modell: 'Y', modi: [modus({ id: 'm1', kanaele: 12, herkunft: 'geschaetzt' })] },
    })
    expect(geraetBefunde(g).map((x) => x.art)).toContain('herkunft-geschaetzt')
  })
})

describe('Dicht packen, in Lesereihenfolge', () => {
  it('jedes Geraet sitzt direkt hinter dem vorigen', () => {
    const e = vergibAdressen(
      [mitModi('a', 'm1', 0, 0), mitModi('b', 'm1', 1, 0), mitModi('c', 'm2', 2, 0)],
      { startUniverse: 1, startAdresse: 1 },
    )
    expect(e.vergeben.get('a')).toEqual({ universe: 1, adresse: 1 })
    expect(e.vergeben.get('b')).toEqual({ universe: 1, adresse: 26 })
    expect(e.vergeben.get('c')).toEqual({ universe: 1, adresse: 51 })
  })

  it('oben vor unten, links vor rechts', () => {
    const ids = lesereihenfolge([
      geraet({ id: 'unten-links', x: 0, y: 5 }),
      geraet({ id: 'oben-rechts', x: 9, y: 0 }),
      geraet({ id: 'oben-links', x: 0, y: 0 }),
    ]).map((g) => g.id)
    expect(ids).toEqual(['oben-links', 'oben-rechts', 'unten-links'])
  })

  it('Geraete ohne Position stehen hinten statt an einer erfundenen Stelle', () => {
    const ids = lesereihenfolge([
      geraet({ id: 'ohne' }),
      geraet({ id: 'mit', x: 3, y: 3 }),
    ]).map((g) => g.id)
    expect(ids).toEqual(['mit', 'ohne'])
  })
})

describe('Die Universe-Grenze ist Protokoll, keine Vorliebe', () => {
  it('ein Geraet liegt nie ueber der Grenze — es faengt im naechsten Universe an', () => {
    const e = vergibAdressen([mitModi('a', 'm1', 0, 0)], {
      startUniverse: 1,
      startAdresse: UNIVERSE_GROESSE - 10, // 25 Kanaele passen nicht mehr
    })
    expect(e.vergeben.get('a')).toEqual({ universe: 2, adresse: 1 })
    expect(e.befunde.map((b) => b.art)).toContain('universe-voll')
  })

  it('ein Modus groesser als ein Universe bekommt keine Adresse', () => {
    // Gemessen im light-planner (Defektformen-Sweep 2026-09-08): dort stand
    // fuer solche Profile `universe = n, adresse = 1` auf dem Zettel, und das
    // Geraet belegte rechnerisch 513…fp eines Universes, das dort aufhoert.
    const g = geraet({
      id: 'wand',
      modusId: 'm1',
      profil: { hersteller: 'X', modell: 'LED-Wand', modi: [modus({ id: 'm1', kanaele: 700 })] },
    })
    const e = vergibAdressen([g], { startUniverse: 1, startAdresse: 1 })
    expect(e.vergeben.has('wand')).toBe(false)
    expect(e.befunde.map((b) => b.art)).toContain('modus-zu-gross')
  })

  it('eine Adresse, die im Plan ueber das Universe-Ende laeuft, faellt beim Pruefen auf', () => {
    const g = mitModi('a', 'm2')
    g.universe = 1
    g.adresse = UNIVERSE_GROESSE - 5
    expect(pruefeAdressen([g]).map((b) => b.art)).toContain('universe-voll')
  })
})

describe('Nichts wird still verschoben', () => {
  it('eine festgesetzte Adresse bleibt, wo sie ist', () => {
    const fest = mitModi('fest', 'm1', 1, 0)
    fest.universe = 1
    fest.adresse = 100
    fest.adresseFestgesetzt = true
    const e = vergibAdressen([mitModi('a', 'm1', 0, 0), fest], { startUniverse: 1, startAdresse: 1 })
    expect(e.vergeben.get('fest')).toEqual({ universe: 1, adresse: 100 })
  })

  it('die Automatik weicht einer Kollision NICHT aus — sie meldet sie', () => {
    // Genau die Entscheidung des Eigentuemers. Ein Werkzeug, das ausweicht,
    // liefert einen konfliktfreien Zettel, der nicht mehr zu dem passt, was
    // jemand von Hand gesetzt hat.
    const fest = mitModi('fest', 'm1', 9, 9)
    fest.universe = 1
    fest.adresse = 1 // genau dort, wo die Automatik anfaengt
    fest.adresseFestgesetzt = true
    const e = vergibAdressen([mitModi('a', 'm1', 0, 0), fest], { startUniverse: 1, startAdresse: 1 })
    expect(e.vergeben.get('a')).toEqual({ universe: 1, adresse: 1 })
    const kollision = e.befunde.find((b) => b.art === 'ueberschneidung')
    expect(kollision).toBeDefined()
    expect(kollision?.schwere).toBe('fehler')
    // Beide Geraete stehen im Befund — sonst sucht jemand das andere.
    expect([kollision?.geraetId, kollision?.anderesGeraetId].sort()).toEqual(['a', 'fest'])
  })

  it('die Meldung nennt die Bereiche, nicht nur die Tatsache', () => {
    const a = mitModi('a', 'm1')
    a.universe = 1
    a.adresse = 1
    const b = mitModi('b', 'm1')
    b.universe = 1
    b.adresse = 10
    const k = pruefeAdressen([a, b]).find((x) => x.art === 'ueberschneidung')
    expect(k?.werte).toMatchObject({ aFrom: 1, aTo: 25, bFrom: 10, bTo: 34, u: 1 })
  })

  it('zwei Geraete im selben Bereich, aber verschiedenen Universes, kollidieren nicht', () => {
    // Die Gegenprobe: ohne sie waere ein Test gruen, der jede zweite Adresse
    // meldet, und der Plan-Check waere nach dem dritten Fehlalarm abgeschaltet.
    const a = mitModi('a', 'm1')
    a.universe = 1
    a.adresse = 1
    const b = mitModi('b', 'm1')
    b.universe = 2
    b.adresse = 1
    expect(pruefeAdressen([a, b]).filter((x) => x.art === 'ueberschneidung')).toEqual([])
  })
})

describe('Die Befunde sind sprachfrei', () => {
  it('jeder Befund traegt Schluessel, Werte und den englischen Satz', () => {
    const e = vergibAdressen([mitModi('a', undefined)], { startUniverse: 1, startAdresse: 1 })
    for (const b of e.befunde) {
      expect(b.schluessel).toMatch(/^dmx\./)
      expect(b.text.length).toBeGreaterThan(10)
      expect(b.werte).toBeTypeOf('object')
    }
  })

  it('die Werte sind im Text eingesetzt, nicht als Platzhalter stehengeblieben', () => {
    const e = vergibAdressen([mitModi('Spot 1', undefined)], { startUniverse: 1, startAdresse: 1 })
    const b = e.befunde.find((x) => x.art === 'modus-fehlt')
    expect(b?.text).toContain('Spot 1')
    expect(b?.text).not.toMatch(/\{\w+\}/)
  })
})

describe('Pruefen aendert nichts', () => {
  it('`pruefeAdressen` laesst die uebergebenen Geraete unangetastet', () => {
    const g = mitModi('a', 'm1')
    g.universe = 1
    g.adresse = 7
    const vorher = JSON.stringify(g)
    pruefeAdressen([g])
    expect(JSON.stringify(g)).toBe(vorher)
  })

  it('`vergibAdressen` schreibt ebenfalls nicht in die Eingabe zurueck', () => {
    // Das Ergebnis kommt als Map heraus; wer sie anwendet, entscheidet die
    // App. Ein Rechenmodul, das seine Eingabe veraendert, ist im Undo-Stapel
    // nicht mehr zu fassen.
    const g = mitModi('a', 'm1', 0, 0)
    const vorher = JSON.stringify(g)
    vergibAdressen([g], { startUniverse: 3, startAdresse: 5 })
    expect(JSON.stringify(g)).toBe(vorher)
  })
})
