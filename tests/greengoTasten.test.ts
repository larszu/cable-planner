import { describe, expect, it } from 'vitest'
import { buildGg5File } from '../src/renderer/lib/exportGreengo'
import { parseGg5File, isParseError } from '../src/renderer/lib/importGreengo'
import { withGroupIds } from '../src/renderer/lib/greengoKeys'
import type { GreenGoConfig, GreenGoKey } from '../src/renderer/types/greengo'

// ───────────────────────────────────────────────────────────────────────────
// DIE TASTENBELEGUNG IM MODELL (E-2, Schritt 2 + 3)
//
// Vorher kannte der Plan die Tastenpositionen nicht. `GreenGoUser` fuehrte nur
// `groupIds` — eine MENGE —, der Import las `ButtonFunctions` bloss als
// Rueckfallweg, um diese Menge zu fuellen, und warf die Positionen dabei weg.
// Der Export erfand sie neu, positionsweise aus der Array-Reihenfolge.
//
// Aufgefangen wurde das in `mergeButtonFunctions`, indem die Positionen aus
// dem Roh-Preset NIE angefasst wurden. Richtig, solange der Plan sie nicht
// kennt — aber es hiess auch: wer im Plan etwas an der Karte aendert, sieht es
// auf dem Beltpack nie.
//
// Jetzt kennt der Plan sie, und der Schutz wandert vom Roh-Dokument ins
// Modell. Diese Datei haelt beide Haelften fest — was jetzt geschrieben werden
// DARF, und was auch jetzt nicht angefasst wird.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Eine Anlage mit einer ECHTEN Tastenkarte.
 *
 * Seite 1 ist absichtlich NICHT aufsteigend belegt und hat Luecken — auf einer
 * lueckenlos aufsteigenden Karte waere die alte „aus der Array-Reihenfolge
 * erfundene" Belegung zufaellig richtig gewesen und nichts zu sehen.
 * Taste 6 traegt einen Wert, den dieses Modell nicht als Gruppen-Nummer lesen
 * kann. Seite 2 traegt eine Gruppe.
 */
const anlage = () => ({
  Settings: {
    Name: 'Halle A',
    Description: 'Bestand',
    SampleRate: 48000,
    MulticastAddress: '239.9.9.9',
    AdminPassword: 'geheim-admin',
    savedAtTimestamp: 1,
  },
  Users: {
    keys: ['1'],
    badge: 0,
    '1': {
      myId: 1,
      Name: 'BPX Regie',
      DisplayName: 'Regie',
      Color: 3,
      ButtonFunctions: {
        '1': { '1': 9, '2': 0, '3': 4, '4': 0, '5': 7, '6': '--' },
        '2': { '1': 2, '2': 0, '3': 0 },
      },
      Security: { Pincode: '1234' },
    },
  },
  Groups: {
    keys: ['9', '4', '7', '2'],
    badge: 0,
    '9': { myId: 9, Name: 'PGM', members: { a: { id: '1' } } },
    '4': { myId: 4, Name: 'CAM', members: { a: { id: '1' } } },
    '7': { myId: 7, Name: 'TON', members: { a: { id: '1' } } },
    '2': { myId: 2, Name: 'LICHT', members: { a: { id: '1' } } },
  },
})

/** Kommentarzeilen weg — sonst liest ein Waechter die Prosa, die die Regel
 *  erklaert, statt des Codes, der sie befolgt. */
const ohneKommentare = (src: string): string =>
  src
    .split('\n')
    .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
    .join('\n')

const dialogQuelle = ohneKommentare(
  (await import('../src/renderer/components/Export/GreenGoExportDialog.tsx?raw')).default,
)

const parsed = (raw: unknown) => {
  const r = parseGg5File(JSON.stringify(raw))
  if (isParseError(r)) throw new Error(r.error)
  return r
}

const configFrom = (raw: unknown): GreenGoConfig => {
  const r = parsed(raw)
  return { ...r.config, basePreset: r.raw }
}

/** Die Tastenkarte der Station 1, wie sie exportiert wird. */
const karte = (config: GreenGoConfig): Record<string, Record<string, unknown>> =>
  (JSON.parse(buildGg5File(config)) as Record<string, any>).Users['1'].ButtonFunctions

/** Dieselbe Station, aber mit ausgetauschten Tasten. */
const mitTasten = (config: GreenGoConfig, keys: GreenGoKey[]): GreenGoConfig => ({
  ...config,
  users: config.users.map((u) => (u.id === 1 ? { ...u, keys } : u)),
})

describe('der Import hebt die Karte ins Modell', () => {
  it('liest Seite, Position und Gruppe — ueber alle Seiten', () => {
    // Nicht nur Seite 1: der alte Rueckfall las genau die und liess Seite 2
    // liegen.
    expect(parsed(anlage()).config.users[0].keys).toEqual([
      { page: 1, button: 1, groupId: 9 },
      { page: 1, button: 3, groupId: 4 },
      { page: 1, button: 5, groupId: 7 },
      { page: 2, button: 1, groupId: 2 },
    ])
  })

  it('haelt eine unbelegte Taste nicht fuer eine Belegung', () => {
    // `0` heisst „keine Gruppe". Eine Null als Belegung zu fuehren, hiesse
    // beim Export eine Gruppe 0 zu schreiben, die es nicht gibt.
    const keys = parsed(anlage()).config.users[0].keys ?? []
    expect(keys.some((k) => k.groupId === 0)).toBe(false)
    expect(keys.some((k) => k.button === 2 || k.button === 4)).toBe(false)
  })

  it('laesst einen Wert liegen, den es nicht als Gruppe lesen kann', () => {
    // Taste 6 traegt `'--'`. Sie darf weder als Gruppe noch als 0 im Modell
    // landen — sonst schriebe der Export sie beim naechsten Mal platt.
    const keys = parsed(anlage()).config.users[0].keys ?? []
    expect(keys.some((k) => k.button === 6)).toBe(false)
  })

  it('macht aus jeder Gruppe auf einer Taste eine Zugehoerigkeit', () => {
    // Die eine Richtung der Zusage aus `types/greengo.ts`. Hier widerspricht
    // sich die Datei: Gruppe 2 liegt auf Seite 2, aber ihre Mitgliederliste
    // kennt die Station nicht. Die Taste ist die handfestere Angabe.
    const roh = anlage()
    roh.Groups['2'] = { myId: 2, Name: 'LICHT', members: {} }
    expect(parsed(roh).config.users[0].groupIds).toContain(2)
  })

  it('macht aus einer Zugehoerigkeit KEINE Taste', () => {
    // Die andere Richtung — sie gilt nicht. Gruppe 11 hat die Station als
    // Mitglied, liegt aber auf keiner Taste. Das ist ein realer Zustand
    // („Karte voll"), kein zu heilender Fehler.
    const roh = anlage()
    roh.Groups.keys.push('11')
    ;(roh.Groups as Record<string, unknown>)['11'] = {
      myId: 11,
      Name: 'ASSI',
      members: { a: { id: '1' } },
    }
    const user = parsed(roh).config.users[0]
    expect(user.groupIds).toContain(11)
    expect((user.keys ?? []).some((k) => k.groupId === 11)).toBe(false)
  })
})

describe('kennt der Plan die Positionen, schreibt er sie', () => {
  it('liefert die unveraenderte Karte unveraendert zurueck', () => {
    const out = karte(configFrom(anlage()))
    expect(out['1']).toEqual({ '1': 9, '2': 0, '3': 4, '4': 0, '5': 7, '6': '--' })
    expect(out['2']).toEqual({ '1': 2, '2': 0, '3': 0 })
  })

  it('verschiebt eine Taste, die im Plan verschoben wurde', () => {
    // DIE UMKEHRUNG. Vorher gewann hier das Preset und die Aenderung kam nie
    // an der Anlage an.
    const config = configFrom(anlage())
    const out = karte(
      mitTasten(config, [
        { page: 1, button: 4, groupId: 9 },
        { page: 1, button: 3, groupId: 4 },
        { page: 1, button: 5, groupId: 7 },
        { page: 2, button: 1, groupId: 2 },
      ]),
    )
    expect(out['1']).toEqual({ '1': 0, '2': 0, '3': 4, '4': 9, '5': 7, '6': '--' })
  })

  it('fasst auch Seite 2 an — sie ist dem Plan nicht mehr fremd', () => {
    const config = configFrom(anlage())
    const out = karte(
      mitTasten(config, [
        { page: 1, button: 1, groupId: 9 },
        { page: 1, button: 3, groupId: 4 },
        { page: 1, button: 5, groupId: 7 },
        { page: 2, button: 3, groupId: 2 },
      ]),
    )
    expect(out['2']).toEqual({ '1': 0, '2': 0, '3': 2 })
  })

  it('raeumt eine Taste, deren Gruppe der Plan nicht mehr kennt', () => {
    const config = configFrom(anlage())
    const ohne4: GreenGoConfig = {
      ...mitTasten(config, [
        { page: 1, button: 1, groupId: 9 },
        { page: 1, button: 5, groupId: 7 },
        { page: 2, button: 1, groupId: 2 },
      ]),
    }
    ohne4.users = ohne4.users.map((u) =>
      u.id === 1 ? { ...u, groupIds: u.groupIds.filter((g) => g !== 4) } : u,
    )
    expect(karte(ohne4)['1']).toEqual({ '1': 9, '2': 0, '3': 0, '4': 0, '5': 7, '6': '--' })
  })

  it('laesst einen Wert stehen, den es nicht als Gruppe lesen kann', () => {
    // Taste 6 traegt `'--'` und ueberlebt jede der Bewegungen oben. Was der
    // Import nie gesehen hat, darf der Export nicht ueberschreiben — der Rest
    // von ADR-005 Regel 2, der weiter gilt.
    const config = configFrom(anlage())
    expect(karte(mitTasten(config, [{ page: 1, button: 2, groupId: 9 }]))['1']['6']).toBe('--')
  })

  it('gibt einer Gruppe ohne Taste die erste freie — und keine belegte', () => {
    const config = configFrom(anlage())
    const mitElf: GreenGoConfig = {
      ...config,
      users: config.users.map((u) => (u.id === 1 ? { ...u, groupIds: [...u.groupIds, 11] } : u)),
    }
    // Frei sind 2 und 4; 6 traegt `'--'` und gilt nicht als frei.
    expect(karte(mitElf)['1']).toEqual({ '1': 9, '2': 11, '3': 4, '4': 0, '5': 7, '6': '--' })
  })

  it('laesst eine Gruppe ohne Taste, wenn keine mehr frei ist', () => {
    // Auch im Editor-Weg wird nichts verdraengt. Frei sind auf Seite 1 genau
    // die Tasten 2 und 4; die dritte neue Gruppe bekommt keine — statt einer
    // belegten die Belegung zu nehmen.
    const config = configFrom(anlage())
    const voll: GreenGoConfig = {
      ...config,
      users: config.users.map((u) =>
        u.id === 1 ? { ...u, groupIds: [...u.groupIds, 11, 12, 13] } : u,
      ),
    }
    const out = karte(voll)
    expect(out['1']).toEqual({ '1': 9, '2': 11, '3': 4, '4': 12, '5': 7, '6': '--' })
    expect([...Object.values(out['1']), ...Object.values(out['2'])]).not.toContain(13)
  })

  it('gibt einer Gruppe auf Seite 2 keine zweite Taste auf Seite 1', () => {
    // Gruppe 2 liegt auf Seite 2 und steht in `groupIds`. Wer beim Platzieren
    // nur Seite 1 nach „schon vorhanden" absucht, legt sie ein zweites Mal.
    const out = karte(configFrom(anlage()))
    const alle = [...Object.values(out['1']), ...Object.values(out['2'])]
    expect(alle.filter((v) => v === 2)).toHaveLength(1)
  })
})

describe('kennt der Plan sie nicht, bleibt alles beim Alten', () => {
  // Ein Projekt aus der Zeit vor E-2 hat keine `keys`. Fuer dessen Stationen
  // gilt die alte Regel unveraendert — sonst waere die Umkehrung oben genau
  // der Datenverlust, gegen den sie einmal gebaut wurde.

  const ohneKeys = (): GreenGoConfig => {
    const config = configFrom(anlage())
    return {
      ...config,
      users: config.users.map((u) => {
        const { keys: _keys, ...rest } = u
        return rest
      }),
    }
  }

  it('laesst die Positionen im Preset stehen', () => {
    expect(karte(ohneKeys())['1']).toEqual({ '1': 9, '2': 0, '3': 4, '4': 0, '5': 7, '6': '--' })
  })

  it('fasst Seite 2 nicht an', () => {
    expect(karte(ohneKeys())['2']).toEqual({ '1': 2, '2': 0, '3': 0 })
  })

  it('legt eine neue Gruppe trotzdem auf die erste freie Taste', () => {
    const basis = ohneKeys()
    const config: GreenGoConfig = {
      ...basis,
      users: basis.users.map((u) => (u.id === 1 ? { ...u, groupIds: [...u.groupIds, 11] } : u)),
    }
    expect(karte(config)['1']).toEqual({ '1': 9, '2': 11, '3': 4, '4': 0, '5': 7, '6': '--' })
  })
})

describe('der Generator-Weg erfindet keine Positionen mehr', () => {
  const neu = (users: GreenGoConfig['users']): Record<string, Record<string, number>> =>
    (
      JSON.parse(
        buildGg5File({
          systemName: 'Neu',
          description: '',
          multicastAddress: '239.1.160.1',
          sampleRate: 32000,
          users,
          groups: [],
        }),
      ) as Record<string, any>
    ).Users['1'].ButtonFunctions

  it('nimmt die Positionen aus dem Plan, wenn er welche hat', () => {
    const out = neu([
      {
        id: 1,
        name: 'BPX',
        groupIds: [9, 4],
        keys: [
          { page: 1, button: 5, groupId: 9 },
          { page: 2, button: 2, groupId: 4 },
        ],
      },
    ])
    expect(out['1']['5']).toBe(9)
    expect(out['1']['1']).toBe(0)
    expect(out['2']['2']).toBe(4)
  })

  it('fuellt ohne Positionen weiter der Reihe nach auf', () => {
    // Der Entartungsfall derselben Rechnung, nicht ein zweiter Weg: ohne
    // `keys` ist jede Taste frei, also fuellt die Zuweisung von Taste 1 an.
    const out = neu([{ id: 1, name: 'BPX', groupIds: [9, 4, 7] }])
    expect(out['1']['1']).toBe(9)
    expect(out['1']['2']).toBe(4)
    expect(out['1']['3']).toBe(7)
    expect(Object.keys(out['1'])).toHaveLength(18)
  })

  it('laesst eine Gruppe ohne Taste, wenn die Karte voll ist', () => {
    // 18 Tasten sind belegt, die 19. Gruppe bekommt keine — und verdraengt
    // auch keine. Derselbe Zustand, den `groupIds` ohne `keys` beschreibt.
    //
    // GEZAEHLT WIRD NICHT, WIEVIELE TASTEN BELEGT SIND. Die erste Fassung tat
    // das und blieb gruen, als die Gegenprobe die 19. Gruppe auf Taste 1
    // schrieb: 18 belegte Tasten waren es danach immer noch, nur eine andere
    // Gruppe war weg.
    const viele = Array.from({ length: 19 }, (_, i) => i + 1)
    const out = neu([{ id: 1, name: 'BPX', groupIds: viele }])
    expect(Object.values(out['1'])).toEqual(Array.from({ length: 18 }, (_, i) => i + 1))
    expect(Object.values(out['2']).every((v) => v === 0)).toBe(true)
  })
})

describe('Zugehoerigkeit und Taste gehen gemeinsam', () => {
  // Seit es `keys` gibt, fuehrt eine Station zwei Angaben ueber dieselbe
  // Gruppe. Wer nur `groupIds` kuerzt, laesst ihre Taste stehen — und der
  // Export schreibt sie wieder auf die Anlage. In der Oberflaeche weg, auf dem
  // Beltpack noch da.

  const bpx = () => ({
    id: 1,
    name: 'BPX',
    groupIds: [9, 4],
    keys: [
      { page: 1, button: 1, groupId: 9 },
      { page: 1, button: 3, groupId: 4 },
    ],
  })

  it('nimmt die Taste mit, wenn die Gruppe wegfaellt', () => {
    expect(withGroupIds(bpx(), [9]).keys).toEqual([{ page: 1, button: 1, groupId: 9 }])
  })

  it('erfindet keine Karte, wo der Plan nie eine gelesen hat', () => {
    // Eine leere Karte hier zu erfinden hiesse dem Export zu sagen, er duerfe
    // schreiben — und er schriebe Positionen platt, die er nie gesehen hat.
    const ohne = { id: 1, name: 'BPX', groupIds: [9, 4] }
    expect(withGroupIds(ohne, [9]).keys).toBeUndefined()
  })

  it('behaelt die leere Karte als eine gelesene', () => {
    expect(withGroupIds(bpx(), []).keys).toEqual([])
  })

  it('aendert der Dialog Zugehoerigkeiten nur ueber withGroupIds', () => {
    // DER DIALOG IST DER EINZIGE ORT, an dem ein Mensch Zugehoerigkeiten
    // aendert — und damit der einzige, an dem eine Taste verwaisen kann. Eine
    // Verhaltensprobe waere ein Render; gemessen wird deshalb die Quelle, aber
    // die REGEL und kein Vorkommen: im Dialog darf `groupIds` als
    // Objekt-Eigenschaft NIRGENDS gesetzt werden ausser bei der frisch
    // angelegten Station, die noch keine Karte hat. Jede andere Zuweisung —
    // ausgeschrieben oder als Kurzform — ginge an `withGroupIds` vorbei.
    const gesetzt = [
      // `(?<![A-Za-z.])` schliesst `user.groupIds` aus — das ist ein LESEN.
      // Gesucht sind Schreibstellen: `groupIds: …` und die Kurzform.
      ...dialogQuelle.matchAll(/(?<![A-Za-z.])groupIds\s*(:[^\n,]*|[,}])/g),
    ].map((m) => m[1].trim())
    expect(gesetzt).toEqual([': []'])
  })

  it('raeumt die Anlage, wenn die letzte Taste entfernt wurde', () => {
    // Der Fall, an dem `keys?.length > 0` als Wissensfrage scheitert: die
    // Karte ist jetzt leer, und leer ist nicht „unbekannt". Seite 2 zeigt es —
    // unter der alten Regel bliebe die Gruppe dort stehen.
    const config = configFrom(anlage())
    const leer: GreenGoConfig = {
      ...config,
      users: config.users.map((u) => (u.id === 1 ? withGroupIds(u, []) : u)),
    }
    const out = karte(leer)
    expect(out['1']).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': '--' })
    expect(out['2']).toEqual({ '1': 0, '2': 0, '3': 0 })
  })
})
