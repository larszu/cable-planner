import { describe, expect, it } from 'vitest'
import {
  DELIVERY_SECTIONS,
  TRANSMISSION_FINDING_LABEL,
  assessTransmission,
  deliveryDeviations,
  normaliseTransmissionRecord,
  transmissionRecordTable,
} from '../src/renderer/lib/transmissionRecord'
import {
  TRANSMISSION_EVENT_LABEL,
  TRANSMISSION_SOURCE_LABEL,
  type TransmissionEvent,
  type TransmissionRecord,
} from '../src/renderer/types/transmissionRecord'
import type { CablePlannerProject, ProjectRevision } from '../src/renderer/types/project'
import type { DeliveryDestination } from '../src/renderer/types/delivery'
import { DOCUMENT_LABELS, DOCUMENT_STANDS } from '../src/renderer/lib/documentRegistry'
import dialogQuelle from '../src/renderer/components/Delivery/DeliveryDialog.tsx?raw'
import libQuelle from '../src/renderer/lib/transmissionRecord.ts?raw'
import typenQuelle from '../src/renderer/types/transmissionRecord.ts?raw'
import storeQuelle from '../src/renderer/store/projectStore.ts?raw'

// ---------------------------------------------------------------------------
// Der Sendebericht (Bedarf 87, P2).
//
//   > There is no show-shaped record of what the transport did; post-mortems
//   > are reconstructed from OBS log files, a platform health graph and memory.
//
// Der Bedarf zieht die Grenze selbst: „Plan-side: a record of the intended
// delivery configuration and its as-built deviations, exportable as the
// client-facing artefact; NOT LIVE TELEMETRY CAPTURE."
//
// Alles in dieser Datei prueft eine von zwei Sachen: dass der Bericht sagt,
// was jemand aufgeschrieben hat — und dass er nirgends so tut, als haette er
// selbst hingesehen.
// ---------------------------------------------------------------------------

const ziel = (id: string, name: string, over: Partial<DeliveryDestination> = {}): DeliveryDestination =>
  ({
    id,
    name,
    platform: 'youtube',
    transport: 'RTMP',
    encoding: {
      width: 1920,
      height: 1080,
      fps: 25,
      videoCodec: 'H.264',
      videoBitrateKbps: 6000,
      keyframeSec: 2,
      audioCodec: 'AAC',
      audioSampleRate: 48000,
      audioBitrateKbps: 128,
    },
    ...over,
  }) as DeliveryDestination

const eintrag = (over: Partial<TransmissionEvent> = {}): TransmissionEvent => ({
  id: over.id ?? 'e1',
  at: over.at ?? '2026-09-12T19:00+02:00',
  kind: over.kind ?? 'note',
  text: over.text ?? 'Alles ruhig',
  source: over.source ?? 'observed',
  ...(over.destinationId ? { destinationId: over.destinationId } : {}),
  ...(over.observedBy ? { observedBy: over.observedBy } : {}),
})

const projekt = (
  dests: DeliveryDestination[],
  record?: TransmissionRecord,
  over: Partial<CablePlannerProject> = {},
): CablePlannerProject =>
  ({
    metadata: { name: 'Show', description: '', createdAt: '', updatedAt: '' },
    equipment: [],
    cables: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
    deliveryDestinations: dests,
    ...(record ? { transmissionRecord: record } : {}),
    ...over,
  }) as CablePlannerProject

const arten = (p: CablePlannerProject): string[] =>
  assessTransmission(p).findings.map((f) => f.kind)

const revision = (snapshot: Partial<CablePlannerProject>): ProjectRevision =>
  ({
    id: 'r1',
    label: 'As-Built',
    createdAt: '2026-09-12T10:00+02:00',
    asBuilt: true,
    snapshot: {
      metadata: { name: 'Show', description: '', createdAt: '', updatedAt: '' },
      equipment: [],
      cables: [],
      canvasState: { x: 0, y: 0, zoom: 1 },
      ...snapshot,
    },
  }) as unknown as ProjectRevision

// ── 1. Was der Bericht NICHT tut ───────────────────────────────────────────

describe('die Grenze aus dem Bedarf: keine Telemetrie', () => {
  it('misst nichts — keine Bitrate, keine Rundlaufzeit, kein Paketverlust', () => {
    expect(libQuelle).not.toMatch(/bitrate|rtt|packetLoss|jitter/i)
    expect(typenQuelle).not.toMatch(/bitrateKbps|measured|rttMs|packetLoss/i)
  })

  it('hat keine Uhr — der Zeitpunkt kommt vom Menschen', () => {
    // Ein Bericht, dessen Zeiten die Anwendung vergibt, saehe aus, als haette
    // sie zugesehen.
    expect(libQuelle).not.toMatch(/Date\.now\(\)|new Date\(/)
    expect(libQuelle).not.toMatch(/toISOString/)
  })

  it('legt die Anwendung im Dialog auch keinen Zeitpunkt an', () => {
    const abschnitt = renderAbschnitt()
    expect(abschnitt).not.toMatch(/new Date\(|Date\.now\(\)|toISOString/)
    // Der neue Eintrag entsteht mit LEEREM Zeitpunkt.
    expect(dialogQuelle).toMatch(/at: '',\s*kind: 'note'/)
  })

  it('macht die Herkunft zum Pflichtfeld, nicht zur Option', () => {
    // Ein fehlendes Feld haette „gemessen" bedeuten koennen.
    expect(typenQuelle).toMatch(/\n {2}source: TransmissionSource\n/)
    expect(typenQuelle).not.toMatch(/source\?: TransmissionSource/)
  })

  it('faellt beim Laden auf `unstated` zurueck, nicht auf `observed`', () => {
    const out = normaliseTransmissionRecord({
      events: [{ id: 'e1', at: '2026-09-12T19:00Z', kind: 'note', text: 'x' }],
    })
    expect(out?.events[0].source).toBe('unstated')
  })
})

// ── 2. Die Befunde ─────────────────────────────────────────────────────────

describe('assessTransmission — die Befunde', () => {
  it('meldet einen leeren Bericht, sobald es ein Ziel gibt', () => {
    expect(arten(projekt([ziel('a', 'YouTube')]))).toContain('no-events')
  })

  it('schweigt ohne Ziel — es gab nichts zu senden', () => {
    expect(arten(projekt([]))).not.toContain('no-events')
  })

  it('meldet einen Zeitpunkt ohne Zeitzone und erfindet keine', () => {
    const p = projekt([ziel('a', 'YouTube')], { events: [eintrag({ at: '2026-09-12T19:00' })] })
    expect(arten(p)).toContain('event-unzoned')
    expect(assessTransmission(p).events[0].at).toBe('2026-09-12T19:00')
  })

  it('nimmt einen Zeitpunkt MIT Offset an', () => {
    const p = projekt([ziel('a', 'YouTube')], { events: [eintrag({ at: '2026-09-12T19:00Z' })] })
    expect(arten(p)).not.toContain('event-unzoned')
  })

  it('meldet einen Eintrag ohne genannte Herkunft', () => {
    const p = projekt([ziel('a', 'YouTube')], { events: [eintrag({ source: 'unstated' })] })
    expect(arten(p)).toContain('event-unsourced')
  })

  it('meldet einen Eintrag auf ein geloeschtes Ziel und behaelt ihn', () => {
    const p = projekt([ziel('a', 'YouTube')], {
      events: [eintrag({ destinationId: 'laengst-weg' })],
    })
    expect(arten(p)).toContain('event-orphan')
    expect(assessTransmission(p).events).toHaveLength(1)
  })

  it('meldet einen Eintrag ausserhalb des Einsatzzeitraums', () => {
    const p = projekt([ziel('a', 'YouTube')], { events: [eintrag({ at: '2026-10-01T19:00Z' })] }, {
      metadata: {
        name: 'Show',
        description: '',
        createdAt: '',
        updatedAt: '',
        eventStart: '2026-09-11',
        eventEnd: '2026-09-13',
      },
    } as Partial<CablePlannerProject>)
    expect(arten(p)).toContain('event-outside-window')
  })

  it('meldet einen Abriss, auf den nichts folgt', () => {
    const p = projekt([ziel('a', 'YouTube')], {
      events: [eintrag({ id: 'e1', kind: 'dropout', destinationId: 'a' })],
    })
    expect(arten(p)).toContain('dropout-without-end')
  })

  it('schweigt, wenn die Wiederkehr desselben Ziels folgt', () => {
    const p = projekt([ziel('a', 'YouTube')], {
      events: [
        eintrag({ id: 'e1', at: '2026-09-12T19:00Z', kind: 'dropout', destinationId: 'a' }),
        eintrag({ id: 'e2', at: '2026-09-12T19:05Z', kind: 'recovered', destinationId: 'a' }),
      ],
    })
    expect(arten(p)).not.toContain('dropout-without-end')
  })

  it('laesst die Wiederkehr eines ANDEREN Ziels nicht zaehlen', () => {
    // Sonst genuegte irgendein spaeteres „wieder normal" irgendwo, um jeden
    // offenen Abriss zuzudecken.
    const p = projekt([ziel('a', 'A'), ziel('b', 'B')], {
      events: [
        eintrag({ id: 'e1', at: '2026-09-12T19:00Z', kind: 'dropout', destinationId: 'a' }),
        eintrag({ id: 'e2', at: '2026-09-12T19:05Z', kind: 'recovered', destinationId: 'b' }),
      ],
    })
    expect(arten(p)).toContain('dropout-without-end')
  })

  it('laesst ein Sendeende der GANZEN Sendung den Abriss beenden', () => {
    const p = projekt([ziel('a', 'YouTube')], {
      events: [
        eintrag({ id: 'e1', at: '2026-09-12T19:00Z', kind: 'dropout', destinationId: 'a' }),
        eintrag({ id: 'e2', at: '2026-09-12T21:00Z', kind: 'stop' }),
      ],
    })
    expect(arten(p)).not.toContain('dropout-without-end')
  })

  it('meldet eine Umschaltung auf einen Weg, den der Plan nicht kennt', () => {
    const p = projekt([ziel('a', 'YouTube')], {
      events: [eintrag({ id: 'e1', kind: 'switch', destinationId: 'a' })],
    })
    expect(arten(p)).toContain('switch-without-plan')
  })

  it('schweigt, wenn es fuer das Ziel ein Backup-Ziel gibt', () => {
    const p = projekt([ziel('a', 'Haupt'), ziel('b', 'Backup', { backupOfId: 'a' })], {
      events: [
        eintrag({ id: 'e1', at: '2026-09-12T19:00Z', kind: 'switch', destinationId: 'a' }),
        eintrag({ id: 'e2', at: '2026-09-12T19:05Z', kind: 'recovered', destinationId: 'a' }),
      ],
    })
    expect(arten(p)).not.toContain('switch-without-plan')
  })

  it('meldet eine fehlende Zusammenfassung, aber erzeugt keine', () => {
    const p = projekt([ziel('a', 'YouTube')], { events: [eintrag()] })
    expect(arten(p)).toContain('no-summary')
    expect(assessTransmission(p).record.summary).toBeUndefined()
    // Eine erzeugte Zusammenfassung waere eine Bewertung der Sendung.
    expect(libQuelle).not.toMatch(/summary\s*=\s*[`'"]/)
  })

  it('gibt jeder Befundart eine Beschriftung', () => {
    for (const kind of Object.keys(TRANSMISSION_FINDING_LABEL)) {
      expect(TRANSMISSION_FINDING_LABEL[kind as never]).toBeTruthy()
    }
  })
})

// ── 3. Die zweite Haelfte: die Abweichungen vom As-Built ───────────────────

describe('deliveryDeviations — was sich seit dem Bauzustand bewegt hat', () => {
  it('sagt „kein As-Built" statt eine Abweichung zu behaupten', () => {
    const p = projekt([ziel('a', 'YouTube')], { events: [eintrag()] })
    expect(deliveryDeviations(p)).toEqual([])
    expect(arten(p)).toContain('no-as-built')
    expect(assessTransmission(p).basis).toBe('as-quoted')
  })

  it('nennt den bewegten Bereich, wenn ein As-Built vorliegt', () => {
    const p = projekt([ziel('a', 'YouTube')], { events: [eintrag()] }, {
      revisions: [revision({ deliveryDestinations: [] })],
    } as Partial<CablePlannerProject>)
    const abw = deliveryDeviations(p)
    expect(abw.map((d) => d.section)).toContain('deliveryDestinations')
    expect(abw[0].label).toBe('Ausspielziele')
  })

  it('meldet bewegte Bereiche ohne Eintrag als Luecke', () => {
    const p = projekt([ziel('a', 'YouTube')], { events: [eintrag()] }, {
      revisions: [revision({ deliveryDestinations: [] })],
    } as Partial<CablePlannerProject>)
    expect(arten(p)).toContain('deviations-unrecorded')
  })

  it('schweigt, wenn eine Aenderung waehrend der Sendung eingetragen ist', () => {
    const p = projekt([ziel('a', 'YouTube')], {
      events: [eintrag({ kind: 'config-change', text: 'Bitrate runter' })],
    }, { revisions: [revision({ deliveryDestinations: [] })] } as Partial<CablePlannerProject>)
    expect(arten(p)).not.toContain('deviations-unrecorded')
  })

  it('nimmt NUR die benannten Bereiche in einen Kundenbericht', () => {
    // Ein verschobener Rack-Knoten ist keine Abweichung der Sendung, und ein
    // Kundenbericht, der ihn naennte, laese sich als Ausrede.
    const p = projekt([ziel('a', 'YouTube')], { events: [eintrag()] }, {
      canvasState: { x: 500, y: 500, zoom: 2 },
      revisions: [revision({ deliveryDestinations: [ziel('a', 'YouTube')] })],
    } as Partial<CablePlannerProject>)
    expect(deliveryDeviations(p).map((d) => d.section)).not.toContain('canvasState')
  })

  it('haelt die Liste der beobachteten Bereiche benannt und klein', () => {
    // Waechst sie, faellt das beim Eintragen auf statt still.
    expect([...DELIVERY_SECTIONS]).toEqual([
      'deliveryDestinations',
      'fallback',
      'archiveRecording',
      'eventMetadata',
    ])
  })
})

// ── 4. Das Blatt ───────────────────────────────────────────────────────────

describe('transmissionRecordTable — das Blatt fuer den Kunden', () => {
  it('gibt jeder leeren Zelle einen NAMEN', () => {
    const t = transmissionRecordTable(
      projekt([ziel('a', 'YouTube')], { events: [eintrag({ text: '', source: 'unstated' })] }),
    )
    const zeile = t.rows[0].map(String)
    expect(zeile).toContain('ganze Sendung')
    expect(zeile).toContain('nicht genannt')
    expect(zeile).toContain('ohne Text')
    expect(zeile.every((z) => z.trim() !== '')).toBe(true)
  })

  it('nennt ein entferntes Ziel beim Namen statt die Zelle zu leeren', () => {
    const t = transmissionRecordTable(
      projekt([ziel('a', 'YouTube')], { events: [eintrag({ destinationId: 'weg' })] }),
    )
    expect(t.rows[0].map(String)).toContain('Ziel entfernt')
  })

  it('haelt die Spalten benannt und klein', () => {
    // Ohne diese Zusicherung faellt eine neue Spalte niemandem auf — und
    // gerade in einem Blatt, das zum Kunden geht, ist jede Spalte eine
    // Behauptung mehr.
    const t = transmissionRecordTable(projekt([ziel('a', 'YouTube')], { events: [eintrag()] }))
    expect(t.headers).toEqual([
      'Zeit',
      'Ziel',
      'Was',
      'Herkunft',
      'Beobachtet von',
      'Beschreibung',
    ])
    expect(t.rows[0]).toHaveLength(t.headers.length)
  })

  it('traegt die Herkunft als eigene Spalte', () => {
    const t = transmissionRecordTable(
      projekt([ziel('a', 'YouTube')], { events: [eintrag({ source: 'from-log' })] }),
    )
    expect(t.headers).toContain('Herkunft')
    expect(t.rows[0].map(String)).toContain('aus Log abgetippt')
  })

  it('sortiert nach dem geschriebenen Zeitpunkt', () => {
    const t = transmissionRecordTable(
      projekt([ziel('a', 'YouTube')], {
        events: [
          eintrag({ id: 'spaet', at: '2026-09-12T21:00Z', text: 'zweitens' }),
          eintrag({ id: 'frueh', at: '2026-09-12T19:00Z', text: 'erstens' }),
        ],
      }),
    )
    expect(t.rows.map((r) => String(r[5]))).toEqual(['erstens', 'zweitens'])
  })

  it('traegt kanonisches Deutsch — der Stand haengt nicht an der Sprache', () => {
    expect(libQuelle).not.toContain("t('")
    expect(TRANSMISSION_EVENT_LABEL.dropout).toBe('Abriss')
    expect(TRANSMISSION_SOURCE_LABEL.observed).toBe('gesehen')
  })

  it('traegt die Zusammenfassung NICHT — sie ist Fliesstext eines Menschen', () => {
    const t = transmissionRecordTable(
      projekt([ziel('a', 'YouTube')], {
        events: [eintrag()],
        summary: 'Die Sendung lief bis auf eine Unterbrechung sauber.',
      }),
    )
    expect(JSON.stringify(t)).not.toContain('bis auf eine Unterbrechung')
  })

  it('ist als Dokument mit Stand und lesbarem Namen registriert', () => {
    expect(DOCUMENT_STANDS['sendebericht']).toBeTruthy()
    expect(DOCUMENT_LABELS['sendebericht']).toBeTruthy()
  })
})

// ── 5. Das Laden ───────────────────────────────────────────────────────────

describe('normaliseTransmissionRecord', () => {
  it('verwirft einen Eintrag ohne Zeitpunkt und meldet ihn', () => {
    const drops: string[] = []
    const out = normaliseTransmissionRecord(
      { events: [{ id: 'e1', kind: 'note', text: 'x' }] },
      (d) => drops.push(d.reason),
    )
    expect(out).toBeUndefined()
    expect(drops).toEqual(['missing-required'])
  })

  it('verwirft einen Eintrag mit unbekannter Art', () => {
    const drops: string[] = []
    normaliseTransmissionRecord(
      { events: [{ id: 'e1', at: '2026-09-12T19:00Z', kind: 'explodiert', text: 'x' }] },
      (d) => drops.push(d.reason),
    )
    expect(drops).toEqual(['missing-required'])
  })

  it('verwirft den zweiten Eintrag mit derselben Id', () => {
    const drops: string[] = []
    const out = normaliseTransmissionRecord(
      {
        events: [
          { id: 'e1', at: '2026-09-12T19:00Z', kind: 'note', text: 'erst' },
          { id: 'e1', at: '2026-09-12T20:00Z', kind: 'note', text: 'dann' },
        ],
      },
      (d) => drops.push(d.reason),
    )
    expect(out?.events).toHaveLength(1)
    expect(out?.events[0].text).toBe('erst')
    expect(drops).toEqual(['duplicate-id'])
  })

  it('BEHAELT einen Eintrag auf ein Ziel, das es nicht mehr gibt', () => {
    const out = normaliseTransmissionRecord({
      events: [
        { id: 'e1', at: '2026-09-12T19:00Z', kind: 'dropout', text: 'weg', destinationId: 'x' },
      ],
    })
    expect(out?.events).toHaveLength(1)
    expect(out?.events[0].destinationId).toBe('x')
  })

  it('verwirft ein Objekt, das nichts traegt', () => {
    expect(normaliseTransmissionRecord({ events: [] })).toBeUndefined()
    expect(normaliseTransmissionRecord(null)).toBeUndefined()
  })

  it('behaelt eine Zusammenfassung auch ohne Eintraege', () => {
    // Sie ist die Aussage, die der Mensch verantwortet — sie zu verwerfen,
    // weil noch keine Zeile darunter steht, waere die falsche Reihenfolge.
    expect(normaliseTransmissionRecord({ events: [], summary: 'Lief.' })?.summary).toBe('Lief.')
  })

  it('laeuft auf dem Lade-Pfad und landet im geheilten Projekt', () => {
    expect(storeQuelle).toMatch(
      /normaliseTransmissionRecord\(project\.transmissionRecord, \(d\) =>/,
    )
    expect(storeQuelle).toMatch(/kind: 'transmission-event'/)
    expect(storeQuelle).toMatch(/\n {4}transmissionRecord,\n/)
  })
})

// ── 6. Die Oberflaeche ─────────────────────────────────────────────────────

const renderAbschnitt = (): string => {
  const von = dialogQuelle.indexOf('{/* BEDARF 87')
  const bis = dialogQuelle.indexOf('{/* BEDARF 89')
  expect(von).toBeGreaterThan(-1)
  expect(bis).toBeGreaterThan(von)
  return dialogQuelle.slice(von, bis)
}

describe('der Dialog', () => {
  it('zeigt den Abschnitt nur, wenn es ein Ziel gibt', () => {
    expect(renderAbschnitt()).toContain('{list.length > 0 && (')
  })

  it('nennt sichtbar, woraus der Bericht spricht', () => {
    expect(renderAbschnitt()).toContain('JOB_BASIS_LABEL[sendung.basis]')
  })

  it('zeigt jeden Befund mit seiner Beschriftung', () => {
    expect(renderAbschnitt()).toMatch(
      /sendung\.findings\.length > 0 &&[\s\S]*TRANSMISSION_FINDING_LABEL\[f\.kind\][\s\S]*f\.text/,
    )
  })

  it('zeigt die Abweichungen vom As-Built im Abschnitt', () => {
    expect(renderAbschnitt()).toMatch(/sendung\.deviations\.length > 0 &&/)
  })
})
