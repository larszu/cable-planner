import { describe, expect, it } from 'vitest'
import {
  ANSWER_STATE_LABEL,
  mergeVenueAnswers,
  normaliseVenueAnswers,
  openQuestions,
  recordAnswer,
  upsertAnswer,
  venueAnswerTable,
} from '../src/renderer/lib/venueAnswers'
import type { VenueAnswer } from '../src/renderer/types/venueAnswer'
import type { VenueNetworkRequest } from '../src/renderer/lib/venueNetworkRequest'
import analyseQuelle from '../src/renderer/components/Analysis/AnalysisDialog.tsx?raw'
import appQuelle from '../src/renderer/App.tsx?raw'

// ---------------------------------------------------------------------------
// Was das Haus geantwortet hat (Bedarf 85, zweite Haelfte).
//
//   > The network ask is hand-written per event, reads as unreasonable to a
//   > security team, and THE OUTCOME (what was opened, what was refused, what
//   > the workaround was) IS NEVER RECORDED, so the next show at the same
//   > venue starts from zero.
//
//   > store the granted/refused answer against the venue so it becomes the
//   > 'what we did last time here' artefact that currently does not exist
//
// Die Frage steht seit Bedarf 23. Diese Datei prueft die Antwort — und die
// drei Faelle, die beim naechsten Mal Schaden anrichten, wenn sie keinen
// eigenen Namen haben.
// ---------------------------------------------------------------------------

const jetzt = '2026-09-06T12:00:00.000Z'

const anfrage = (keys: string[]): VenueNetworkRequest => ({
  items: keys.map((key) => ({
    key,
    origin: key === 'vlans' ? 'derived' : 'question',
    ...(key === 'vlans' ? { value: '10, 20' } : { why: 'kann der Plan nicht wissen' }),
  })),
  vlans: [10, 20],
  subnets: [],
  interfaceCount: 4,
  mediaMbps: 300,
})

const antwort = (over: Partial<VenueAnswer> & { key: string }): VenueAnswer => ({
  status: 'granted',
  ...over,
})

describe('Bedarf 85 — die Antwort ist kein Ja/Nein', () => {
  it('kennt „mit Auflage" als eigenen Ausgang', () => {
    // Der haeufigste Ausgang. Beide Kreuze waeren beim naechsten Mal falsch:
    // „genehmigt" laesst ohne Rueckfrage aufbauen, „abgelehnt" laesst den
    // Umweg bauen, den niemand braucht.
    const rows = mergeVenueAnswers({
      request: anfrage(['dhcp']),
      answers: [antwort({ key: 'dhcp', status: 'partial', note: 'nur im Veranstaltungsfenster' })],
    })
    expect(rows[0].state).toBe('partial')
    expect(rows[0].note).toBe('nur im Veranstaltungsfenster')
  })

  it('traegt bei einer Absage den Umweg mit', () => {
    const rows = mergeVenueAnswers({
      request: anfrage(['multicast']),
      answers: [antwort({ key: 'multicast', status: 'refused', note: 'eigener Switch mitgebracht' })],
    })
    expect(rows[0].state).toBe('refused')
    expect(rows[0].note).toBe('eigener Switch mitgebracht')
  })

  it('nennt „keine Antwort" statt die Zeile wegzulassen', () => {
    const rows = mergeVenueAnswers({ request: anfrage(['qos']), answers: [] })
    expect(rows).toHaveLength(1)
    expect(rows[0].state).toBe('pending')
  })
})

describe('Bedarf 85 — eine Antwort aus einem anderen Haus sagt das', () => {
  it('markiert die fremde Antwort und nennt BEIDE Haeuser', () => {
    const rows = mergeVenueAnswers({
      request: anfrage(['dhcp']),
      answers: [antwort({ key: 'dhcp', status: 'granted', venue: 'Halle A' })],
      venue: 'Halle B',
    })
    expect(rows[0].state).toBe('elsewhere')
    expect(rows[0].venue).toBe('Halle A')
    expect(rows[0].hier).toBe('Halle B')
    // Der Ausgang bleibt lesbar — die Antwort ist nicht falsch, nur woanders
    // gegeben.
    expect(rows[0].answered).toBe('granted')
  })

  it('laesst dieselbe Adresse durch, egal wie sie geschrieben ist', () => {
    const rows = mergeVenueAnswers({
      request: anfrage(['dhcp']),
      answers: [antwort({ key: 'dhcp', venue: '  Halle A ' })],
      venue: 'halle a',
    })
    expect(rows[0].state).toBe('granted')
  })

  it('warnt NICHT, wenn die Antwort gar keinen Ort nennt', () => {
    // Eine alte Antwort ohne Ortsangabe als fremd zu markieren waere eine
    // Warnung ohne Grund — und Warnungen ohne Grund liest beim dritten Mal
    // niemand mehr.
    const rows = mergeVenueAnswers({
      request: anfrage(['dhcp']),
      answers: [antwort({ key: 'dhcp' })],
      venue: 'Halle B',
    })
    expect(rows[0].state).toBe('granted')
  })

  it('warnt NICHT, wenn das Projekt selbst keinen Ort nennt', () => {
    const rows = mergeVenueAnswers({
      request: anfrage(['dhcp']),
      answers: [antwort({ key: 'dhcp', venue: 'Halle A' })],
    })
    expect(rows[0].state).toBe('granted')
  })

  it('haelt „Halle A" und „Halle A, Eingang Nord" auseinander', () => {
    // Im Zweifel fremd: das kostet einen Anruf, der andere Fehler den Aufbau.
    const rows = mergeVenueAnswers({
      request: anfrage(['dhcp']),
      answers: [antwort({ key: 'dhcp', venue: 'Halle A' })],
      venue: 'Halle A, Eingang Nord',
    })
    expect(rows[0].state).toBe('elsewhere')
  })
})

describe('Bedarf 85 — eine Antwort ohne Frage verschwindet nicht', () => {
  it('haengt sie als `stale` unten an', () => {
    const rows = mergeVenueAnswers({
      request: anfrage(['dhcp']),
      answers: [
        antwort({ key: 'dhcp' }),
        antwort({ key: 'multicast', status: 'refused', note: 'nie erlaubt in diesem Haus' }),
      ],
    })
    expect(rows).toHaveLength(2)
    const alt = rows.find((r) => r.key === 'multicast')
    expect(alt?.state).toBe('stale')
    expect(alt?.note).toBe('nie erlaubt in diesem Haus')
    expect(alt?.answered).toBe('refused')
  })

  it('haelt die Reihenfolge der Anfrage ein und haengt Fremdes hinten an', () => {
    const rows = mergeVenueAnswers({
      request: anfrage(['vlans', 'dhcp', 'qos']),
      answers: [antwort({ key: 'weg' })],
    })
    expect(rows.map((r) => r.key)).toEqual(['vlans', 'dhcp', 'qos', 'weg'])
  })
})

describe('Bedarf 85 — wegen welcher Punkte man noch einmal anruft', () => {
  it('nennt Unbeantwortetes und Fremdes', () => {
    const rows = mergeVenueAnswers({
      request: anfrage(['a', 'b']),
      answers: [antwort({ key: 'b', venue: 'Halle A' })],
      venue: 'Halle B',
    })
    expect(openQuestions(rows).map((r) => r.key).sort()).toEqual(['a', 'b'])
  })

  it('laesst eine notierte Auflage in Ruhe — eine Auflage ist eine Antwort', () => {
    const rows = mergeVenueAnswers({
      request: anfrage(['a']),
      answers: [antwort({ key: 'a', status: 'partial', note: 'nur 80/443' })],
    })
    expect(openQuestions(rows)).toHaveLength(0)
  })

  it('nennt eine Auflage OHNE Notiz — dann kennt sie niemand', () => {
    const rows = mergeVenueAnswers({
      request: anfrage(['a']),
      answers: [antwort({ key: 'a', status: 'partial' })],
    })
    expect(openQuestions(rows).map((r) => r.key)).toEqual(['a'])
  })

  it('nennt eine Absage ohne Umweg, aber nicht eine mit', () => {
    const ohne = mergeVenueAnswers({
      request: anfrage(['a']),
      answers: [antwort({ key: 'a', status: 'refused' })],
    })
    const mit = mergeVenueAnswers({
      request: anfrage(['a']),
      answers: [antwort({ key: 'a', status: 'refused', note: 'LTE-Router' })],
    })
    expect(openQuestions(ohne)).toHaveLength(1)
    expect(openQuestions(mit)).toHaveLength(0)
  })

  it('nennt eine Genehmigung nicht', () => {
    const rows = mergeVenueAnswers({ request: anfrage(['a']), answers: [antwort({ key: 'a' })] })
    expect(openQuestions(rows)).toHaveLength(0)
  })
})

describe('Bedarf 85 — der Ort wird beim SCHREIBEN eingefroren', () => {
  it('schreibt den Ort in die Antwort', () => {
    const a = recordAnswer('dhcp', 'granted', jetzt, { venue: 'Halle A', by: 'Haus-IT' })
    expect(a).toMatchObject({ key: 'dhcp', status: 'granted', at: jetzt, venue: 'Halle A', by: 'Haus-IT' })
  })

  it('laesst leere Angaben weg, statt leere Felder zu schreiben', () => {
    const a = recordAnswer('dhcp', 'pending', jetzt, { note: '   ', by: '', venue: undefined })
    expect('note' in a).toBe(false)
    expect('by' in a).toBe(false)
    expect('venue' in a).toBe(false)
  })

  it('ersetzt eine vorhandene Antwort zum selben Punkt, statt sie zu doppeln', () => {
    const erst = [recordAnswer('dhcp', 'pending', jetzt)]
    const dann = upsertAnswer(erst, recordAnswer('dhcp', 'granted', jetzt))
    expect(dann).toHaveLength(1)
    expect(dann[0].status).toBe('granted')
  })
})

describe('Bedarf 85 — was beim Laden keine Antwort ist, wird gemeldet', () => {
  it('verwirft eine Antwort ohne Punkt und meldet sie', () => {
    const drops: { reason: string; label: string }[] = []
    const out = normaliseVenueAnswers([{ status: 'granted' }, antwort({ key: 'ok' })], (d) =>
      drops.push(d),
    )
    expect(out?.map((a) => a.key)).toEqual(['ok'])
    expect(drops).toHaveLength(1)
  })

  it('verwirft einen Ausgang, den es nicht gibt', () => {
    const drops: { reason: string; label: string }[] = []
    const out = normaliseVenueAnswers([{ key: 'dhcp', status: 'vielleicht' }], (d) => drops.push(d))
    expect(out).toEqual([])
    expect(drops[0].label).toBe('dhcp')
  })

  it('faellt bei doppeltem Punkt auf die LETZTE zusammen und meldet es', () => {
    const drops: { reason: string; label: string }[] = []
    const out = normaliseVenueAnswers(
      [antwort({ key: 'dhcp', status: 'pending' }), antwort({ key: 'dhcp', status: 'granted' })],
      (d) => drops.push(d),
    )
    expect(out).toHaveLength(1)
    expect(out?.[0].status).toBe('granted')
    expect(drops[0]).toMatchObject({ reason: 'duplicate-id', label: 'dhcp' })
  })

  it('laesst ein Projekt ohne das Feld unangetastet', () => {
    expect(normaliseVenueAnswers(undefined)).toBeUndefined()
  })

  it('meldet, wenn dort ueberhaupt keine Liste steht', () => {
    const drops: { reason: string; label: string }[] = []
    expect(normaliseVenueAnswers({ dhcp: 'granted' }, (d) => drops.push(d))).toBeUndefined()
    expect(drops).toHaveLength(1)
  })
})

describe('Bedarf 85 — das Blatt, das mitfaehrt', () => {
  it('nennt das Haus in einer eigenen Spalte', () => {
    const rows = mergeVenueAnswers({
      request: anfrage(['dhcp']),
      answers: [antwort({ key: 'dhcp', venue: 'Halle A', by: 'IT-Leitung', at: jetzt })],
      venue: 'Halle A',
    })
    const tab = venueAnswerTable(rows, (k) => k)
    expect(tab.headers).toContain('Haus')
    expect(tab.rows[0]).toContain('Halle A')
    expect(tab.rows[0]).toContain(ANSWER_STATE_LABEL.granted)
  })

  it('schreibt keinen Platzhalter, wo nichts steht', () => {
    const rows = mergeVenueAnswers({ request: anfrage(['dhcp']), answers: [] })
    const tab = venueAnswerTable(rows, (k) => k)
    expect(tab.rows[0].every((c) => String(c) !== 'undefined')).toBe(true)
  })
})

describe('Bedarf 85 — die Oberflaeche ist verdrahtet', () => {
  it('der Netz-Tab setzt Antworten und rechnet die Zeilen zusammen', () => {
    expect(analyseQuelle).toMatch(/mergeVenueAnswers\(\{/)
    expect(analyseQuelle).toMatch(/recordAnswer\(/)
    expect(analyseQuelle).toMatch(/venueAnswerTable\(/)
  })

  it('der Ort dieses Projekts geht in jede geschriebene Antwort', () => {
    // Ohne das ist die mitgereiste Antwort eine Behauptung ueber ein Haus,
    // in dem sie nie gegeben wurde.
    //
    // Auf den SCHREIB-Pfad pruefen, nicht auf das Textstueck: eine erste
    // Fassung suchte nur `...(siteAddress ? { venue: siteAddress } : {})` im
    // Quelltext und blieb gruen, als genau diese Zeile aus `recordAnswer`
    // entfernt wurde — dieselbe Zeile steht naemlich auch im Aufruf von
    // `mergeVenueAnswers`, und die hat die Zusicherung erfuellt.
    expect(analyseQuelle).toMatch(/recordAnswer\([\s\S]{0,400}?venue: siteAddress/)
  })

  it('der Lade-Bericht beschriftet jede Art einzeln', () => {
    // Bis hierher stand fuer JEDEN Fall „Signalquelle" — auch fuer ein
    // verworfenes Ausspielziel aus Initiative 9.
    expect(appQuelle).toContain("d.kind === 'delivery-destination'")
    expect(appQuelle).toContain("d.kind === 'venue-answer'")
  })
})
