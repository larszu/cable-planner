// ───────────────────────────────────────────────────────────────────────────
// Herstellerneutrales Intercom-Austauschformat (B-8, Inkrement 1).
//
// WAS HIER GEPRUEFT WIRD UND WAS NICHT. Nicht "das Format ist gut" -- das
// zeigt erst der zweite Hersteller. Geprueft wird, dass es die drei Dinge
// tut, wegen denen es existiert:
//
//   1. Der Round-Trip verliert nichts, was die Quelle hatte.
//   2. Die Trennung talk/listen ist im Format DA -- auch wenn die heutige
//      Quelle sie nicht liefert -- und die Datei SAGT, dass sie abgeleitet
//      ist. Ein Format, das die Unterscheidung nicht kennt, kann sie auch
//      spaeter nicht bekommen, ohne alle Dateien zu brechen.
//   3. Der neutrale Teil bleibt neutral: Multicast, Abtastrate und
//      Farbindizes stehen unter `vendor`, nicht daneben.
//
// Der Vertrag ist eingefroren wie beim portablen Lager: wer ein Feld
// umbenennt, faellt hier auf, nicht beim Nutzer, der eine alte Datei oeffnet.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest'
import type { GreenGoConfig } from '../src/renderer/types/greengo'
import {
  INTERCOM_FORMAT,
  INTERCOM_FORMAT_VERSION,
} from '../src/renderer/types/intercomExchange'
import {
  fromIntercomExchange,
  parseIntercomExchange,
  serializeIntercomExchange,
  toIntercomExchange,
} from '../src/renderer/lib/intercomExchange'

const anlage = (): GreenGoConfig => ({
  systemName: 'Sendung Freitag',
  description: 'Studio 2',
  multicastAddress: '239.1.160.7',
  sampleRate: 48000,
  groups: [
    { id: 1, name: 'PGM', color: 3 },
    { id: 2, name: 'CAM' },
  ],
  users: [
    { id: 1, name: 'Regie', displayName: 'REG', color: 5, groupIds: [1, 2], equipmentId: 'eq-regie' },
    { id: 2, name: 'Kamera 1', groupIds: [2] },
  ],
})

describe('Neutrale Datei aus einer Green-GO-Konfiguration', () => {
  it('traegt Konferenzen und Sprechstellen fachlich, nicht als Anlagen-Nummern', () => {
    const f = toIntercomExchange(anlage())
    expect(f.format).toBe(INTERCOM_FORMAT)
    expect(f.version).toBe(INTERCOM_FORMAT_VERSION)
    expect(f.channels.map((c) => c.name)).toEqual(['PGM', 'CAM'])
    expect(f.stations.map((s) => s.name)).toEqual(['Regie', 'Kamera 1'])
    // Ids sind Zeichenketten -- kein Hersteller laesst sich auf dieselbe
    // Nummerierung festlegen.
    expect(f.channels.every((c) => typeof c.id === 'string')).toBe(true)
  })

  it('sagt in der Datei, dass talk/listen abgeleitet ist', () => {
    const f = toIntercomExchange(anlage())
    const regie = f.stations.find((s) => s.name === 'Regie')!
    expect(regie.memberships).toEqual([
      { channelId: 'ch-1', talk: true, listen: true },
      { channelId: 'ch-2', talk: true, listen: true },
    ])
    // Das ist der Punkt: die Flags sind beide gesetzt, WEIL die Quelle nur
    // eine Liste kennt -- und die Datei sagt es, statt Genauigkeit zu
    // behaupten. Ohne diesen Satz traegt jemand eine Sprechberechtigung in
    // ein fremdes System, die so nie geplant war.
    expect(f.derivedFrom).toMatch(/talk und listen/i)
  })

  it('haelt Hersteller-Details unter `vendor`, nicht im neutralen Teil', () => {
    const f = toIntercomExchange(anlage())
    const gg = f.vendor?.greengo as Record<string, unknown>
    expect(gg.multicastAddress).toBe('239.1.160.7')
    expect(gg.sampleRate).toBe(48000)
    expect(gg.groupColors).toEqual({ 'ch-1': 3 })
    expect(gg.userColors).toEqual({ 'st-1': 5 })
    // Gegenprobe: im neutralen Teil taucht nichts davon auf.
    const neutral = JSON.stringify({ channels: f.channels, stations: f.stations })
    expect(neutral).not.toContain('239.1.160.7')
    expect(neutral).not.toContain('48000')
  })

  it('exportiert keine Zugehoerigkeit zu einer Gruppe, die es nicht gibt', () => {
    const kaputt = anlage()
    kaputt.users[1].groupIds = [2, 99]
    const f = toIntercomExchange(kaputt)
    const cam = f.stations.find((s) => s.name === 'Kamera 1')!
    expect(cam.memberships.map((m) => m.channelId)).toEqual(['ch-2'])
  })

  it('wiederholt den Namen nicht als Kurzform', () => {
    const cfg = anlage()
    cfg.users[0].displayName = 'Regie'
    expect(toIntercomExchange(cfg).stations[0].shortName).toBeUndefined()
  })
})

describe('Round-Trip', () => {
  it('Green-GO -> neutral -> Green-GO behaelt, was die Quelle hatte', () => {
    const vorher = anlage()
    const zurueck = fromIntercomExchange(toIntercomExchange(vorher))

    expect(zurueck.systemName).toBe(vorher.systemName)
    expect(zurueck.description).toBe(vorher.description)
    expect(zurueck.multicastAddress).toBe(vorher.multicastAddress)
    expect(zurueck.sampleRate).toBe(vorher.sampleRate)
    expect(zurueck.groups).toEqual(vorher.groups)
    expect(zurueck.users).toEqual(vorher.users)
  })

  it('ueber die serialisierte Datei genauso', () => {
    const vorher = anlage()
    const text = serializeIntercomExchange(toIntercomExchange(vorher))
    const gelesen = parseIntercomExchange(text)
    expect(gelesen).not.toBeNull()
    expect(fromIntercomExchange(gelesen!)).toEqual(vorher)
  })

  it('eine Datei aus einem FREMDEN System laesst sich lesen', () => {
    // Kein `vendor`-Block, andere Id-Form, talk und listen getrennt -- so
    // saehe eine Datei aus, die nicht von hier stammt. Genau dafuer gibt es
    // das Format; wenn nur die eigenen Dateien gelesen werden, ist es keins.
    const fremd = JSON.stringify({
      format: 'avplan-intercom',
      version: 1,
      systemName: 'Fremdanlage',
      channels: [{ id: 'prod', name: 'Production' }, { id: 'cam', name: 'Cameras' }],
      stations: [
        {
          id: 'director',
          name: 'Director',
          memberships: [
            { channelId: 'prod', talk: true, listen: true },
            { channelId: 'cam', talk: false, listen: true },
          ],
        },
      ],
    })
    const cfg = fromIntercomExchange(parseIntercomExchange(fremd)!)
    expect(cfg.groups.map((g) => g.name)).toEqual(['Production', 'Cameras'])
    expect(cfg.users[0].name).toBe('Director')
    // Green-GO kennt die Trennung nicht -- eine Stelle, die NUR hoert, gehoert
    // dort trotzdem zur Gruppe. Der Verlust ist echt und am Code benannt.
    expect(cfg.users[0].groupIds).toEqual([1, 2])
    expect(cfg.multicastAddress).toBe('239.1.160.1')
    expect(cfg.sampleRate).toBe(32000)
  })
})

describe('Der Vertrag ist eingefroren', () => {
  it('die Feldnamen der Datei aendern sich nicht unbemerkt', () => {
    const f = toIntercomExchange(anlage())
    expect(Object.keys(f).sort()).toEqual([
      'channels',
      'derivedFrom',
      'description',
      'exportedAt',
      'format',
      'stations',
      'systemName',
      'vendor',
      'version',
    ])
    expect(Object.keys(f.stations[0]).sort()).toEqual([
      'equipmentId',
      'id',
      'memberships',
      'name',
      'shortName',
    ])
    expect(Object.keys(f.stations[0].memberships[0]).sort()).toEqual([
      'channelId',
      'listen',
      'talk',
    ])
  })

  it('eine zu NEUE Datei wird abgelehnt statt halb gelesen', () => {
    const zuNeu = JSON.stringify({
      format: 'avplan-intercom',
      version: INTERCOM_FORMAT_VERSION + 1,
      systemName: 'x',
      channels: [],
      stations: [],
    })
    expect(parseIntercomExchange(zuNeu)).toBeNull()
  })

  it('fremdes JSON und Muell werden abgelehnt', () => {
    expect(parseIntercomExchange('{"format":"avplan-inventory","version":2}')).toBeNull()
    expect(parseIntercomExchange('kein json')).toBeNull()
    expect(parseIntercomExchange('null')).toBeNull()
  })
})

describe('Format-Version 2 — die Tastenbelegung reist mit', () => {
  // Die Belegung ist eine Regie-Entscheidung und keine Folge der
  // Zugehoerigkeit. Sie ueberlebt den Weg ueber die Datei nur, wenn drei
  // Dinge stimmen: die Version geht mit, „nichts gesagt" und „leer" bleiben
  // unterscheidbar, und eine Taste ins Leere wird nicht erfunden.
  const mitTasten = (): GreenGoConfig => ({
    systemName: 'Show',
    description: '',
    multicastAddress: '239.1.160.1',
    sampleRate: 48000,
    groups: [
      { id: 1, name: 'PGM' },
      { id: 2, name: 'Ton' },
    ],
    users: [
      {
        id: 1,
        name: 'Regie',
        groupIds: [1, 2],
        keys: [
          { page: 1, button: 1, groupId: 1 },
          { page: 1, button: 2, groupId: 2 },
        ],
      },
      // Ausdruecklich leer: die Karte ist gesehen und geraeumt.
      { id: 2, name: 'Kamera 1', groupIds: [1], keys: [] },
      // Nie eine Karte gesehen.
      { id: 3, name: 'Ton', groupIds: [2] },
    ],
  })

  it('nennt Version 2', () => {
    expect(INTERCOM_FORMAT_VERSION).toBe(2)
    expect(toIntercomExchange(mitTasten()).version).toBe(2)
  })

  it('schreibt die Belegung mit der neutralen Kanal-Kennung', () => {
    const f = toIntercomExchange(mitTasten())
    expect(f.stations[0].keys).toEqual([
      { page: 1, button: 1, channelId: 'ch-1' },
      { page: 1, button: 2, channelId: 'ch-2' },
    ])
  })

  it('haelt „leer" und „nichts gesagt" auseinander', () => {
    const f = toIntercomExchange(mitTasten())
    // Leer bleibt leer -- sonst stuende die entfernte Belegung beim naechsten
    // Import wieder da.
    expect(f.stations[1].keys).toEqual([])
    expect(f.stations[2].keys).toBeUndefined()
    expect('keys' in f.stations[2]).toBe(false)
  })

  it('laesst eine Taste auf eine Gruppe, die es nicht gibt, weg', () => {
    const cfg = mitTasten()
    cfg.users[0].keys = [
      { page: 1, button: 1, groupId: 1 },
      { page: 1, button: 3, groupId: 99 },
    ]
    const f = toIntercomExchange(cfg)
    expect(f.stations[0].keys).toEqual([{ page: 1, button: 1, channelId: 'ch-1' }])
  })

  it('liest die Belegung zurueck, mit den neu vergebenen Nummern', () => {
    const zurueck = fromIntercomExchange(toIntercomExchange(mitTasten()))
    expect(zurueck.users[0].keys).toEqual([
      { page: 1, button: 1, groupId: 1 },
      { page: 1, button: 2, groupId: 2 },
    ])
    expect(zurueck.users[1].keys).toEqual([])
    expect(zurueck.users[2].keys).toBeUndefined()
  })

  it('verwirft beim Lesen eine unlesbare Taste, statt sie zu runden', () => {
    // Eine Seite 0 oder eine halbe Taste ist kein Platz auf einem Geraet.
    const roh = JSON.stringify({
      format: 'avplan-intercom',
      version: 2,
      systemName: 'Show',
      channels: [{ id: 'ch-1', name: 'PGM' }],
      stations: [
        {
          id: 'st-1',
          name: 'Regie',
          memberships: [{ channelId: 'ch-1', talk: true, listen: true }],
          keys: [
            { page: 1, button: 1, channelId: 'ch-1' },
            { page: 0, button: 1, channelId: 'ch-1' },
            { page: 1, button: 2.5, channelId: 'ch-1' },
            { page: 1, button: 2 },
          ],
        },
      ],
    })
    const gelesen = parseIntercomExchange(roh)
    expect(gelesen?.stations[0].keys).toEqual([{ page: 1, button: 1, channelId: 'ch-1' }])
  })

  it('nimmt eine keys-Angabe, die keine Liste ist, als „nichts gesagt"', () => {
    const roh = JSON.stringify({
      format: 'avplan-intercom',
      version: 2,
      systemName: 'Show',
      channels: [{ id: 'ch-1', name: 'PGM' }],
      stations: [{ id: 'st-1', name: 'Regie', memberships: [], keys: 'egal' }],
    })
    const gelesen = parseIntercomExchange(roh)
    expect(gelesen?.stations[0].keys).toBeUndefined()
    expect('keys' in gelesen!.stations[0]).toBe(false)
  })

  it('laesst eine Taste auf einen Kanal, den die Datei nicht fuehrt, weg', () => {
    const roh = JSON.stringify({
      format: 'avplan-intercom',
      version: 2,
      systemName: 'Show',
      channels: [{ id: 'ch-1', name: 'PGM' }],
      stations: [
        {
          id: 'st-1',
          name: 'Regie',
          memberships: [],
          keys: [
            { page: 1, button: 1, channelId: 'ch-1' },
            { page: 1, button: 2, channelId: 'ch-weg' },
          ],
        },
      ],
    })
    const cfg = fromIntercomExchange(parseIntercomExchange(roh)!)
    expect(cfg.users[0].keys).toEqual([{ page: 1, button: 1, groupId: 1 }])
  })
})
