import { describe, expect, it } from 'vitest'
import {
  CHANNEL_IDENTITY_LABEL,
  COLUMN_OWNER,
  IMPORTABLE_FIELDS,
  NO_NAME,
  NO_PORT_NOTE,
  channelIdentityFindings,
  channelName,
  channelOwnerTable,
  columnOwner,
  isBareNumber,
  limitImportPatch,
  mayImportWrite,
  venueNumber,
} from '../src/renderer/lib/channelIdentity'
import { bandView, consoleView, stageView, venueView, type ChannelRow } from '../src/renderer/lib/channelList'
import listeQuelle from '../src/renderer/lib/channelList.ts?raw'
import libQuelle from '../src/renderer/lib/channelIdentity.ts?raw'
import lexikonQuelle from '../src/renderer/lib/dataDictionary.ts?raw'
import szeneQuelle from '../src/renderer/lib/sceneImport.ts?raw'
import danteQuelle from '../src/renderer/lib/dantePatch.ts?raw'
import dialogQuelle from '../src/renderer/components/Patch/PatchListDialog.tsx?raw'

// ---------------------------------------------------------------------------
// Wem eine Spalte gehoert, und welcher Name gilt (Bedarfe 110, 111, 113; P3).
//
// Drei Belege aus zwei fremden Trackern, alle mit „minutes" beziffert — und
// alle drei kosten die Minuten dann, wenn keine mehr da sind: beim Aufbau,
// vor fremdem Publikum, mit dem Rider in der Hand.
//
//   110  > A single column headed 'Quelle / Mikrofon' conflates venue
//        > infrastructure with band equipment. Importing a WING snapshot
//        > writes stagebox inputs into the microphone column, DESTROYING
//        > manually entered mic info.  (computi71/bandregie#81)
//
//   111  > the channel number is internal to the band and meaningless to
//        > venue staff; SHOWING BOTH IMPLIES BOTH MATTER
//        (computi71/bandregie#82)
//
//   113  > Dante naming weirdness means that channel names are always 01, 02
//        > etc. […] Dante Controller shows green checkmarks but CANNOT
//        > IDENTIFY the targeted channels.
//        (chris-ritsen/network-audio-controller#11)
// ---------------------------------------------------------------------------

const row = (over: Partial<ChannelRow> = {}): ChannelRow => ({
  ch: over.ch ?? 1,
  cableId: over.cableId ?? 'c1',
  source: over.source ?? 'SM58 Lead Vox',
  sourceKind: over.sourceKind,
  sourcePort: over.sourcePort ?? 'OUT',
  destination: over.destination ?? 'Stagebox A',
  destinationPort: over.destinationPort ?? 'A1',
  connector: over.connector ?? 'XLR',
  lengthM: over.lengthM,
  x: over.x,
  y: over.y,
})

// ── 1. Bedarf 110 — zwei Eigentuemer, zwei Spalten ─────────────────────────

describe('wem eine Spalte gehoert, steht als Regel da', () => {
  it('beantwortet die Frage fuer JEDES Feld einer Kanalzeile', () => {
    // Ein neues Feld ohne Eintrag faellt hier auf — und genau das ist der
    // Zweck: die Frage „darf ein Import das ueberschreiben" muss bei jedem
    // Feld beantwortet sein, nicht bei denen, an die jemand gedacht hat.
    const felder = Object.keys(row()) as Array<keyof ChannelRow>
    for (const f of felder) {
      expect(COLUMN_OWNER[f], `kein Eigentuemer fuer ${f}`).toBeDefined()
    }
  })

  it('ordnet die Stagebox dem Haus und das Mikrofon der Band zu', () => {
    expect(columnOwner('destinationPort')).toBe('venue')
    expect(columnOwner('destination')).toBe('venue')
    expect(columnOwner('source')).toBe('band')
    expect(columnOwner('sourceKind')).toBe('band')
    expect(columnOwner('ch')).toBe('plan')
  })

  it('laesst einen Import NUR die Haus-Felder schreiben', () => {
    // Der Beleg ist ein Fehlerbericht: ein Import hat die von Hand gepflegte
    // Mikrofon-Angabe mit einem Stagebox-Eingang ueberschrieben.
    expect(mayImportWrite('destinationPort')).toBe(true)
    expect(mayImportWrite('destination')).toBe(true)
    expect(mayImportWrite('source')).toBe(false)
    expect(mayImportWrite('sourceKind')).toBe(false)
    expect(mayImportWrite('connector')).toBe(false)
  })

  it('ist eine Erlaubnis-Liste, keine Verbots-Liste', () => {
    // Was nicht drinsteht, darf nicht geschrieben werden — auch ein Feld, das
    // es heute noch gar nicht gibt.
    expect(mayImportWrite('erfundenesNeuesFeld' as keyof ChannelRow)).toBe(false)
    expect([...IMPORTABLE_FIELDS].every((f) => COLUMN_OWNER[f] === 'venue')).toBe(true)
  })

  it('haben die beiden Import-Wege heute gar keinen Schreibweg', () => {
    // Szenendatei (Bedarf 92) und Dante-Matrix (Bedarf 94) sind ausdrueckliche
    // LESER. Solange das so ist, kann `limitImportPatch` keinen Aufrufer
    // haben — und dieser Test ist der Grund, warum es trotzdem nicht egal
    // ist: er faellt in dem Moment um, in dem jemand den ersten Schreibweg
    // baut, und zwingt ihn durch die Engstelle.
    for (const quelle of [szeneQuelle, danteQuelle]) {
      expect(quelle).not.toContain('updateCable')
      expect(quelle).not.toContain('updateEquipment')
      expect(quelle).not.toContain('useProjectStore')
    }
    // Auch der Dialog, der beide anzeigt, schreibt nichts aus ihnen zurueck.
    const importBlock = dialogQuelle.slice(dialogQuelle.indexOf('parseSceneFile'))
    expect(importBlock).not.toMatch(/updateCable\([^)]*szene/i)
    expect(importBlock).not.toMatch(/updateEquipment\([^)]*szene/i)
  })

  it('beschneidet einen Import und verschweigt das Weggelassene nicht', () => {
    const { patch, refused } = limitImportPatch({
      destinationPort: 'A7',
      source: 'Kanal 7',
      sourceKind: 'aus der Pult-Datei',
    })
    expect(patch).toEqual({ destinationPort: 'A7' })
    expect(refused).toEqual(['source', 'sourceKind'])
  })

  it('nennt die Mikrofon-Spalte im Band-Blatt nicht mehr nach einem Port', () => {
    // Die Spalte hiess „Abnahme" und zeigte `sourcePort` — die XLR-Buchse am
    // Mikrofon. Infrastruktur in der Mikrofon-Spalte ist genau der Fehler.
    const t = bandView([row({ sourceKind: 'Kondensator' })])
    expect(t.headers).toEqual(['Ch', 'Name', 'Abnahme', 'Anschluss an der Quelle'])
    expect(t.rows[0][2]).toBe('Kondensator')
    expect(t.rows[0][3]).toBe('OUT')
  })
})

// ── 2. Bedarf 111 — die Nummer, die draussen etwas bedeutet ────────────────

describe('das Haus liest den Port', () => {
  it('fuehrt den Port und NICHT die interne Kanalnummer', () => {
    const t = venueView([row({ ch: 7, destinationPort: 'A7' })])
    expect(t.headers[0]).toBe('Port')
    expect(t.headers).not.toContain('Ch')
    expect(t.rows[0][0]).toBe('A7')
    // Die interne Nummer taucht auch nicht als Wert irgendwo auf.
    expect(t.rows[0]).not.toContain(7)
  })

  it('benennt die Ersatz-Nummer, statt sie als Port auszugeben', () => {
    // „7" allein waere eine Port-Nummer, die es nicht gibt — und der
    // Haustechniker sucht sie am Blech.
    expect(venueNumber(row({ ch: 7, destinationPort: '' }))).toBe(`Ch 7 (${NO_PORT_NOTE})`)
    expect(venueNumber(row({ ch: 7, destinationPort: '   ' }))).toBe(`Ch 7 (${NO_PORT_NOTE})`)
    expect(venueNumber(row({ ch: 7, destinationPort: 'A7' }))).toBe('A7')
  })

  it('traegt die Ersatz-Nummer bis ins Blatt', () => {
    const t = venueView([row({ ch: 7, destinationPort: '' })])
    expect(t.rows[0][0]).toBe(`Ch 7 (${NO_PORT_NOTE})`)
  })
})

// ── 3. Bedarf 113 — ein Name, einmal entschieden ───────────────────────────

describe('channelName — eine Nummer ist kein Name', () => {
  it('erkennt die blosse Nummer in ihren Schreibweisen', () => {
    for (const t of ['01', '1', '007', 'Ch 7', 'CH7', 'kanal 12', 'In 3', 'input 4', ' 02 ']) {
      expect(isBareNumber(t), t).toBe(true)
    }
    for (const t of ['SM58', 'Broadcast L', 'DI 2 Bass', 'A1', '', '  ', 'Kanal Rechts']) {
      expect(isBareNumber(t), t).toBe(false)
    }
  })

  it('nimmt den Namen der Quelle, wenn er einer ist', () => {
    expect(channelName(row({ source: 'Broadcast L' }))).toBe('Broadcast L')
  })

  it('faellt auf die Art zurueck, wenn die Quelle nur eine Nummer ist', () => {
    // „Kondensator" sagt mehr als „01" — und das ist der ganze Punkt des
    // Belegs: gruene Haken, und niemand weiss, welcher Kanal gemeint ist.
    expect(channelName(row({ source: '01', sourceKind: 'Kondensator' }))).toBe('Kondensator')
  })

  it('sagt „unbenannt", wenn beides nur Nummern sind', () => {
    expect(channelName(row({ source: '01', sourceKind: '02' }))).toBe(NO_NAME)
    expect(channelName(row({ source: '', sourceKind: undefined }))).toBe(NO_NAME)
  })

  it('ist die Engstelle fuer Pult, Buehne, Band und Haus', () => {
    // Vier Sichten, ein Name. Stuende der Name in einer davon roh aus der
    // Quelle, waere „01" dort wieder ein Name.
    const r = row({ source: '01', sourceKind: 'Kondensator' })
    expect(bandView([r]).rows[0][1]).toBe('Kondensator')
    expect(venueView([r]).rows[0][1]).toBe('Kondensator')
    expect(stageView([r]).rows[0][1]).toBe('Kondensator')
    expect(consoleView([r]).rows[0][1]).toBe('Kondensator')
  })

  it('haelt die Kuerzungs-Meldung am selben Namen fest', () => {
    // Die Pult-Sicht kuerzt auf das Dante-Budget. Der Hinweis muss den Namen
    // nennen, der gekuerzt wurde — nicht die rohe Quelle daneben.
    const lang = 'Kondensator Overhead Stage Left Drumkit'
    const t = consoleView([row({ source: '01', sourceKind: lang })])
    expect(t.rows[0][2]).toBe(`aus: ${lang}`)
  })

  it('nimmt keine Sicht den Namen roh aus der Quelle', () => {
    // Quellen-nah gelesen: keine der Sichten darf `r.source` direkt in eine
    // Namens-Spalte legen, sonst ist die Engstelle nur halb.
    const sichten = listeQuelle.slice(
      listeQuelle.indexOf('export function bandView'),
      listeQuelle.indexOf('/** Ein Monitor-Weg'),
    )
    expect(sichten.length).toBeGreaterThan(500)
    expect(sichten).not.toMatch(/\br\.source\b/)
  })
})

// ── 4. Befunde ─────────────────────────────────────────────────────────────

describe('channelIdentityFindings', () => {
  it('meldet Kanaele ohne Haus-Port', () => {
    const f = channelIdentityFindings([row({ ch: 1 }), row({ ch: 2, destinationPort: '' })])
    const p = f.filter((x) => x.kind === 'no-port')
    expect(p).toHaveLength(1)
    expect(p[0].channels).toEqual([2])
    expect(p[0].text).toContain(NO_PORT_NOTE)
  })

  it('meldet die Nummer, die als Name auftritt', () => {
    const f = channelIdentityFindings([row({ ch: 3, source: '01', sourceKind: 'DI' })])
    expect(f.map((x) => x.kind)).toContain('bare-name')
    expect(f.find((x) => x.kind === 'bare-name')?.channels).toEqual([3])
  })

  it('meldet den Kanal ganz ohne Namen getrennt von der blossen Nummer', () => {
    // Zwei verschiedene Zustaende: „hat einen Namen, aber es ist eine Nummer"
    // und „hat gar nichts". Der erste ist reparierbar, der zweite ist leer.
    const f = channelIdentityFindings([row({ ch: 4, source: '', sourceKind: undefined })])
    const arten = f.map((x) => x.kind)
    expect(arten).toContain('no-name')
    expect(arten).not.toContain('bare-name')
  })

  it('meldet zwei Kanaele auf demselben Port', () => {
    const f = channelIdentityFindings([
      row({ ch: 1, destinationPort: 'A1' }),
      row({ ch: 2, destinationPort: 'a1' }),
      row({ ch: 3, destinationPort: 'A2' }),
    ])
    const d = f.filter((x) => x.kind === 'port-duplicate')
    expect(d).toHaveLength(1)
    expect(d[0].channels).toEqual([1, 2])
  })

  it('zaehlt zwei Kanaele OHNE Port nicht als Doppelung', () => {
    // Sie liegen nicht auf demselben Port — sie liegen auf keinem. Das sagt
    // der `no-port`-Befund; „zwei Kanaele auf derselben Buchse" wuerde eine
    // Buchse benennen, die es nicht gibt, und jemand suchte sie am Blech.
    const f = channelIdentityFindings([
      row({ ch: 1, destination: 'Stagebox A', destinationPort: '' }),
      row({ ch: 2, destination: 'Stagebox A', destinationPort: '  ' }),
    ])
    expect(f.map((x) => x.kind)).toEqual(['no-port'])
    expect(f[0].channels).toEqual([1, 2])
  })

  it('zaehlt denselben Port an verschiedenen Stageboxen NICHT doppelt', () => {
    // „A1" an Stagebox A und „A1" an Stagebox B sind zwei Buchsen.
    const f = channelIdentityFindings([
      row({ ch: 1, destination: 'Stagebox A', destinationPort: 'A1' }),
      row({ ch: 2, destination: 'Stagebox B', destinationPort: 'A1' }),
    ])
    expect(f.filter((x) => x.kind === 'port-duplicate')).toEqual([])
  })

  it('schweigt bei einem sauberen Plan', () => {
    expect(
      channelIdentityFindings([
        row({ ch: 1, destinationPort: 'A1' }),
        row({ ch: 2, destinationPort: 'A2', source: 'DI Bass' }),
      ]),
    ).toEqual([])
  })

  it('haelt fuer jede Befundart eine lesbare Ueberschrift bereit', () => {
    for (const k of ['no-port', 'bare-name', 'port-duplicate', 'no-name'] as const) {
      expect(CHANNEL_IDENTITY_LABEL[k].length).toBeGreaterThan(10)
    }
  })
})

// ── 5. Das Blatt, das beide Haelften zeigt ─────────────────────────────────

describe('channelOwnerTable', () => {
  it('stellt Haus- und Band-Spalten benannt nebeneinander', () => {
    const t = channelOwnerTable([row({ ch: 1, sourceKind: 'Dynamisch', destinationPort: 'A1' })])
    expect(t.headers).toEqual([
      'Port (Haus)',
      'Name (Band)',
      'Abnahme (Band)',
      'Stecker (Band)',
      'Ch (bandintern)',
    ])
    expect(t.rows[0]).toEqual(['A1', 'SM58 Lead Vox', 'Dynamisch', 'XLR', 1])
  })

  it('hat fuer jede Spalte einen Lexikon-Eintrag', () => {
    const t = channelOwnerTable([row()])
    for (const h of t.headers) {
      expect(lexikonQuelle, `Lexikon-Eintrag fehlt: ${h}`).toContain(`'${h}'`)
    }
  })
})

// ── 6. Im Dialog erreichbar ────────────────────────────────────────────────

describe('die Patchlisten-Ansicht', () => {
  it('stellt die Befunde UEBER die Kabelliste', () => {
    // Jeder der drei Befunde faellt sonst erst auf, wenn das Blatt gedruckt
    // ist. Unter der Liste waere er beim Scrollen weg.
    const befunde = dialogQuelle.indexOf('identitaetsBefunde.length > 0')
    const szene = dialogQuelle.indexOf('{szeneAktuell && (')
    expect(befunde).toBeGreaterThan(0)
    expect(befunde).toBeLessThan(szene)
  })

  it('bietet das Haus/Band-Blatt als eigene Sicht an', () => {
    expect(dialogQuelle).toContain("channelList.view.owner")
    expect(dialogQuelle).toContain('channelOwnerTable(channels)')
  })

  it('leitet die Befunde aus derselben Liste ab wie die Sichten', () => {
    // Keine zweite Ableitung: was gemeldet wird, ist genau das, was auf den
    // Blaettern steht.
    expect(dialogQuelle).toContain('channelIdentityFindings(channels)')
  })
})

// ── 7. Rein ────────────────────────────────────────────────────────────────

describe('das Modul bleibt rein', () => {
  it('hat weder Uhr noch Store noch IO', () => {
    expect(libQuelle).not.toContain('Date.now')
    expect(libQuelle).not.toContain('new Date(')
    expect(libQuelle).not.toContain('useProjectStore')
    expect(libQuelle).not.toContain('window.')
  })
})
