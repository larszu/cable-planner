import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { runDrawingChecks } from '../src/renderer/lib/drawingChecks'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'
import {
  DYNAMIKEN,
  FARBRAEUME,
  FARBTIEFEN,
  beurteileBild,
  normalisiereSenkenprofil,
  type Senkenprofil,
} from '../src/renderer/types/displayCapability'
import { MODEL_FIELDS } from '../src/renderer/lib/modelFields'

// ---------------------------------------------------------------------------
// B-47 — das virtuelle EDID.
//
// Wunsch des Eigentuemers, 2026-09-08: „Auch sind Monitore noch nicht
// intelligent. Man braeuchte quasi auch ein virtuelles EDID."
//
// GEMESSEN, bevor gebaut wurde: der Begriff EDID kam im gesamten Quelltext
// NULL mal vor, und ein Monitor trug genau ein Feld zu dem, was er kann —
// `resolution?: string`, eine Zeichenkette, mit der nichts gerechnet wird.
// ---------------------------------------------------------------------------

const profil: Senkenprofil = {
  herkunft: 'Handbuch, Seite 41',
  formate: [
    {
      formatId: '1080p50',
      farbtiefen: [8, 10],
      farbraeume: ['RGB', 'YCbCr 4:2:2'],
      dynamik: ['SDR'],
    },
    { formatId: '2160p25', farbtiefen: [], farbraeume: [], dynamik: [] },
    // Eine Achse erklaert, eine nicht — genau der Fall, an dem sich die
    // Reihenfolge der Pruefungen entscheidet.
    { formatId: '720p50', farbtiefen: [8], farbraeume: [], dynamik: [] },
  ],
}

describe('Drei Urteile — und „nicht erklärt" ist keins von beiden anderen', () => {
  it('ohne Profil: offen, nicht passt und nicht passt-nicht', () => {
    const u = beurteileBild(undefined, { formatId: '1080p50' }, 'Monitor 1')
    expect(u.art).toBe('offen')
    expect(u.text).toContain('nicht erklärt')
  })

  it('Format im Profil: passt', () => {
    expect(beurteileBild(profil, { formatId: '1080p50' }, 'M').art).toBe('passt')
  })

  it('Format nicht im Profil: passt-nicht', () => {
    const u = beurteileBild(profil, { formatId: '2160p60' }, 'M')
    expect(u.art).toBe('passt-nicht')
    expect(u.text).toContain('2160p60')
  })

  it('Format da, aber die verlangte Farbtiefe nicht: passt-nicht', () => {
    const u = beurteileBild(profil, { formatId: '1080p50', farbtiefe: 12 }, 'M')
    expect(u.art).toBe('passt-nicht')
    expect(u.text).toContain('12')
  })

  it('Format da, zur Achse ist aber nichts erklärt: offen', () => {
    // Die leere Liste heisst „dazu ist nichts erklaert" — nicht „na klar".
    const u = beurteileBild(profil, { formatId: '2160p25', farbtiefe: 10 }, 'M')
    expect(u.art).toBe('offen')
  })

  it('was nicht gewünscht ist, wird nicht beurteilt', () => {
    expect(beurteileBild(profil, { formatId: '2160p25' }, 'M').art).toBe('passt')
  })

  it('ein Befund geht der fehlenden Angabe VOR', () => {
    // DER FALL, AN DEM SICH DIE REIHENFOLGE ENTSCHEIDET. Bei `720p50` ist die
    // Farbtiefe erklaert (nur 8) und der Farbraum NICHT. Gewuenscht sind 12
    // Bit und RGB: die eine Achse ist ein BEFUND, die andere eine fehlende
    // Angabe. Der Befund muss gewinnen — sonst meldet der Plan „dazu ist
    // nichts erklaert" und verschweigt, dass die Senke die Farbtiefe
    // nachweislich nicht annimmt.
    const u = beurteileBild(profil, { formatId: '720p50', farbtiefe: 12, farbraum: 'RGB' }, 'M')
    expect(u.art).toBe('passt-nicht')
    expect(u.text).toContain('Farbtiefe')

    // Und umgekehrt: ist NUR die nicht erklaerte Achse gewuenscht, bleibt es
    // bei „offen".
    const v = beurteileBild(profil, { formatId: '720p50', farbraum: 'RGB' }, 'M')
    expect(v.art).toBe('offen')
  })
})

describe('Hier wird keine EDID entziffert', () => {
  /**
   * DIE ZUSICHERUNG, UM DIE ES GEHT.
   *
   * Eine ausgelesene EDID ist eine 128-Byte-Struktur mit Erweiterungsblöcken.
   * Ihre Feldbedeutungen stehen in einer Spezifikation, die aus dieser
   * Umgebung nicht erreichbar ist — sie aus dem Gedächtnis zu entziffern wäre
   * schlimmer als bei einem Protokoll (Invariante 18): ein falsch gelesenes
   * Byte ergibt keine Fehlermeldung, sondern eine plausible Zahl. Ein Gerät
   * bekäme „nimmt 2160p60 an", weil ein Offset um eins daneben lag, und der
   * Plan zeigte einen grünen Haken auf eine schwarze Strecke.
   *
   * Diese Zusicherung steht hier, damit der nächste Durchgang keinen Parser
   * aus dem Gedächtnis nachbaut und das für eine Verbesserung hält.
   */
  const RENDERER = resolve(__dirname, '..', 'src', 'renderer')

  const dateien = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      const voll = join(dir, e)
      return statSync(voll).isDirectory() ? dateien(voll) : /\.tsx?$/.test(e) ? [voll] : []
    })

  it('kein Modul liest Bytes an festen Offsets aus einer EDID', () => {
    const verdaechtig = dateien(RENDERER)
      .map((f) => ({ f, text: readFileSync(f, 'utf8') }))
      // Wortgrenzen: `linkedId` und `assignedIds` enthalten „edid" als
      // Teilwort und sind kein EDID. Ohne die Grenzen meldete der Waechter
      // zwei Dateien, die mit der Sache nichts zu tun haben — und ein
      // Waechter, der an Unbeteiligtem rot wird, wird abgeschaltet.
      .filter(({ text }) => /\bedid\b/i.test(text))
      .filter(({ text }) =>
        // Ein Parser sieht so aus: Byte-Zugriffe, Bit-Schieberei, 128er-Blöcke.
        /(Uint8Array|charCodeAt|>>\s*\d|&\s*0x|\[\s*0x[0-9a-f]{2}\s*\])/i.test(text),
      )
      .map(({ f }) => f)
    expect(
      verdaechtig,
      'Diese Dateien nennen EDID UND greifen auf Bytes/Bits zu. Die ' +
        'Feldbedeutungen einer EDID gehören aus der Spezifikation belegt ' +
        '(Invariante 18) — bis dahin: erklärte Fähigkeiten von Hand.',
    ).toEqual([])
  })

  it('die Herkunft ist Pflicht, sonst fällt das Profil weg', () => {
    expect(normalisiereSenkenprofil({ formate: [] })).toBeUndefined()
    expect(normalisiereSenkenprofil({ herkunft: '  ', formate: [] })).toBeUndefined()
    expect(normalisiereSenkenprofil(profil)?.herkunft).toBe('Handbuch, Seite 41')
  })

  it('ein unbekanntes Format fällt weg statt namenlos dazustehen', () => {
    const geheilt = normalisiereSenkenprofil({
      herkunft: 'x',
      formate: [{ formatId: '1080p50' }, { formatId: '9999p999' }],
    })
    expect(geheilt?.formate).toHaveLength(1)
    // Und die drei Achsen sind danach leere Listen — „nichts erklaert" —
    // und nicht mit etwas Plausiblem gefuellt.
    expect(geheilt?.formate[0].farbtiefen).toEqual([])
    expect(geheilt?.formate[0].farbraeume).toEqual([])
    expect(geheilt?.formate[0].dynamik).toEqual([])
  })

  it('und unbekannte Werte in den Achsen werden nicht übernommen', () => {
    const geheilt = normalisiereSenkenprofil({
      herkunft: 'x',
      formate: [
        { formatId: '1080p50', farbtiefen: [8, 9, '10'], farbraeume: ['RGB', 'CMYK'], dynamik: ['SDR', 'HDR99'] },
      ],
    })
    expect(geheilt?.formate[0].farbtiefen).toEqual([8])
    expect(geheilt?.formate[0].farbraeume).toEqual(['RGB'])
    expect(geheilt?.formate[0].dynamik).toEqual(['SDR'])
  })

  it('die Achsen-Listen sind vollständig benannt', () => {
    expect(FARBTIEFEN).toEqual([8, 10, 12])
    expect(FARBRAEUME.length).toBeGreaterThan(0)
    expect(DYNAMIKEN).toContain('SDR')
  })

  it('das Profil ist eine Modell-Eigenschaft', () => {
    // Jedes Exemplar desselben Monitors nimmt dieselben Formate an. Im
    // Exemplar muesste man es bei jedem Herausziehen aus der Bibliothek neu
    // eintragen — und wer das vergisst, bekommt „nicht erklaert" statt der
    // Angabe, die es schon gab.
    expect(MODEL_FIELDS).toContain('senkenprofil')
  })
})

const eq = (over: Partial<EquipmentItem>): EquipmentItem => ({
  id: 'e',
  name: 'Gerät',
  category: 'Monitore',
  inputs: [],
  outputs: [],
  x: 0,
  y: 0,
  width: 200,
  height: 160,
  ...over,
})

const kabel = (over: Partial<Cable>): Cable => ({
  id: 'c1',
  name: 'K',
  type: 'HDMI',
  length: 5,
  color: '#000',
  fromEquipmentId: 'src',
  fromPortId: 'p1',
  toEquipmentId: 'mon',
  toPortId: 'p2',
  notes: '',
  ...over,
})

describe('Check 23 springt nur an, wo jemand etwas erklärt hat', () => {
  it('Senke mit Profil, Projekt-Format passt nicht: error', () => {
    const { findings } = runDrawingChecks({
      equipment: [eq({ id: 'src', name: 'Quelle' }), eq({ id: 'mon', name: 'Monitor 1', senkenprofil: profil })],
      cables: [kabel({})],
      defaultVideoFormat: '2160p60',
    })
    const f = findings.filter((x) => x.category === 'Video format')
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe('error')
    expect(f[0].equipmentId).toBe('mon')
  })

  it('Kabel nennt ein Format, Senke hat kein Profil: info', () => {
    const { findings } = runDrawingChecks({
      equipment: [eq({ id: 'src', name: 'Quelle' }), eq({ id: 'mon', name: 'Monitor 1' })],
      cables: [kabel({ videoFormat: '1080p50' })],
    })
    const f = findings.filter((x) => x.category === 'Video format')
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe('info')
  })

  it('weder Profil noch Kabel-Format: der Check schweigt', () => {
    // Der Projekt-Vorgabewert allein reicht NICHT. Er gilt fuer jede Strecke,
    // und ein „nicht erklaert" an jeder Steckdose waere Rauschen, in dem die
    // echten Befunde untergehen.
    const { findings } = runDrawingChecks({
      equipment: [eq({ id: 'src', name: 'Quelle' }), eq({ id: 'mon', name: 'Monitor 1' })],
      cables: [kabel({})],
      defaultVideoFormat: '1080p50',
    })
    expect(findings.some((x) => x.category === 'Video format')).toBe(false)
  })

  it('und die Kategorie entscheidet NICHT, ob geprüft wird', () => {
    // Ein Namensabgleich waere genau der Fehlschluss aus ADR-002: eine
    // „Regie-Monitorwand" bekaeme Befunde, ein „Display Wall Controller"
    // keine — eine Aussage ueber die Schreibweise, nicht ueber das Geraet.
    const src = readFileSync(
      resolve(__dirname, '..', 'src', 'renderer', 'lib', 'drawingChecks.ts'),
      'utf8',
    )
    const blockStart = src.indexOf('Check 23')
    const blockEnde = src.indexOf('Sortierung: error', blockStart)
    const block = src.slice(blockStart, blockEnde).replace(/\/\/[^\n]*/g, '')
    expect(block).not.toMatch(/category[^\n]*includes\(/)
  })

  it('ein passendes Format erzeugt keinen Befund', () => {
    const { findings } = runDrawingChecks({
      equipment: [eq({ id: 'src', name: 'Quelle' }), eq({ id: 'mon', name: 'Monitor 1', senkenprofil: profil })],
      cables: [kabel({ videoFormat: '1080p50' })],
    })
    expect(findings.some((x) => x.category === 'Video format')).toBe(false)
  })
})
