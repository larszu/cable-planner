import { describe, expect, it } from 'vitest'
import {
  AS_BUILT_HEADERS,
  AS_BUILT_VERDICT_LABEL,
  NOT_STATED,
  READING_SOURCE_LABEL,
  asBuiltSummary,
  asBuiltTable,
  asBuiltVerdict,
  fromCabling,
  fromCrosspoints,
  fromLiveComparison,
  fromNetworkReport,
  mergeEntries,
  unverifiedEntries,
  type AsBuiltEntry,
} from '../src/renderer/lib/asBuilt'
import type { LiveComparison } from '../src/renderer/lib/atemLiveCompare'
import type { ReconcileReport } from '../src/renderer/lib/networkReconcile'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import libQuelle from '../src/renderer/lib/asBuilt.ts?raw'
import dialogQuelle from '../src/renderer/components/Network/ReconcileDialog.tsx?raw'
import sliceQuelle from '../src/renderer/store/slices/mobileSyncSlice.ts?raw'

// ---------------------------------------------------------------------------
// „Wie geplant" gegen „wie gebaut" (Bedarf 126, P4).
//
//   > Nothing reconciles the plan against what the devices actually hold;
//   > drift is discovered IN REHEARSAL AT BEST AND ON AIR AT WORST, and POST
//   > HAS NO RECORD of which physical source was on which input.
//
// Belegt an der Architektur von Sofie, wo „as planned" und „as played" ein
// erstklassiger Begriff sind. Die Massnahme woertlich: „Read-back/verify:
// 'the rig says X, the plan says Y'. […] it also produces the AS-BUILT
// ARTEFACT post-production currently lacks."
//
// DIE REGEL, DIE DAS BLATT TRAEGT: ohne Ablesung gibt es kein „stimmt".
// ---------------------------------------------------------------------------

const eintrag = (over: Partial<AsBuiltEntry> = {}): AsBuiltEntry => ({
  subject: 'ATEM 1 · In 3',
  field: 'Quelle',
  source: 'atem',
  ...over,
})

const jetzt = '2026-09-06T10:00:00.000Z'

// ── 1. Ohne Ablesung kein „stimmt" ─────────────────────────────────────────

describe('asBuiltVerdict — die Engstelle', () => {
  it('sagt „nicht nachgesehen", wo kein Zeitpunkt steht', () => {
    // Dieselbe Regel wie beim Tally-Urteil (Bedarf 105): „stimmt" ist eine
    // Aussage ueber die Wirklichkeit, und wer nicht hingesehen hat, hat keine.
    expect(asBuiltVerdict(eintrag({ planned: 'Kamera 1' }))).toBe('not-verified')
    // Und auch dann nicht, wenn beide Seiten zufaellig dasselbe sagen.
    expect(asBuiltVerdict(eintrag({ planned: 'Kamera 1', actual: 'Kamera 1' }))).toBe(
      'not-verified',
    )
  })

  it('nennt Uebereinstimmung erst MIT Zeitpunkt', () => {
    expect(asBuiltVerdict(eintrag({ planned: 'Kamera 1', actual: 'Kamera 1', at: jetzt }))).toBe(
      'match',
    )
  })

  it('unterscheidet Abweichung, Fehlen und Ueberraschung', () => {
    expect(asBuiltVerdict(eintrag({ planned: 'Kamera 1', actual: 'Kamera 2', at: jetzt }))).toBe(
      'differs',
    )
    expect(asBuiltVerdict(eintrag({ planned: 'Kamera 1', at: jetzt }))).toBe('missing')
    expect(asBuiltVerdict(eintrag({ actual: 'Kamera 9', at: jetzt }))).toBe('unexpected')
  })

  it('zaehlt eine Ablesung ohne beide Seiten nicht als Ablesung', () => {
    expect(asBuiltVerdict(eintrag({ at: jetzt }))).toBe('not-verified')
    expect(asBuiltVerdict(eintrag({ planned: '  ', actual: ' ', at: jetzt }))).toBe('not-verified')
  })

  it('haelt fuer jedes Urteil eine lesbare Ueberschrift bereit', () => {
    for (const k of ['match', 'differs', 'missing', 'unexpected', 'not-verified'] as const) {
      expect(AS_BUILT_VERDICT_LABEL[k].length).toBeGreaterThan(5)
    }
  })
})

// ── 2. Das Blatt ───────────────────────────────────────────────────────────

describe('asBuiltTable — das Artefakt, das der Post fehlt', () => {
  it('haelt den Spaltenkopf fest', () => {
    expect(asBuiltTable([]).headers).toEqual([...AS_BUILT_HEADERS])
  })

  it('stellt beide Seiten NEBENEINANDER', () => {
    // „the rig says X, the plan says Y" — beides, nicht eines.
    const [zeile] = asBuiltTable([
      eintrag({ planned: 'Kamera 1', actual: 'Kamera 2', at: jetzt }),
    ]).rows
    expect(zeile[2]).toBe('Kamera 1')
    expect(zeile[3]).toBe('Kamera 2')
    expect(zeile[4]).toBe(AS_BUILT_VERDICT_LABEL.differs)
  })

  it('schreibt einen NAMEN statt einer leeren Zelle', () => {
    const [zeile] = asBuiltTable([eintrag({ planned: 'Kamera 1' })]).rows
    expect(zeile[3]).toBe(NOT_STATED)
    expect(zeile[6]).toBe(NOT_STATED)
  })

  it('nennt die Quelle der Ablesung im Klartext', () => {
    const [zeile] = asBuiltTable([eintrag({ source: 'videohub', at: jetzt })]).rows
    expect(zeile[5]).toBe(READING_SOURCE_LABEL.videohub)
  })

  it('sortiert nach Gegenstand und Feld — zwei Laeufe muessen vergleichbar sein', () => {
    const rows = asBuiltTable([
      eintrag({ subject: 'Zebra', field: 'B' }),
      eintrag({ subject: 'Anton', field: 'B' }),
      eintrag({ subject: 'Anton', field: 'A' }),
    ]).rows
    expect(rows.map((r) => [r[0], r[1]])).toEqual([
      ['Anton', 'A'],
      ['Anton', 'B'],
      ['Zebra', 'B'],
    ])
  })

  it('traegt nur das Datum, nicht die volle Uhrzeit', () => {
    const [zeile] = asBuiltTable([eintrag({ planned: 'x', actual: 'x', at: jetzt })]).rows
    expect(zeile[6]).toBe('2026-09-06')
  })
})

// ── 3. Die Zusammenfassung verschweigt die Luecke nicht ────────────────────

describe('asBuiltSummary', () => {
  it('zaehlt „nicht nachgesehen" MIT', () => {
    // Ein Deckblatt, das nur „12 stimmen ueberein" sagt, liest sich wie eine
    // Freigabe — und verschweigt die dreissig Zeilen, in die niemand gesehen
    // hat.
    const s = asBuiltSummary([
      eintrag({ planned: 'a', actual: 'a', at: jetzt }),
      eintrag({ subject: 'B', planned: 'b' }),
      eintrag({ subject: 'C', planned: 'c' }),
    ])
    expect(s.counts.match).toBe(1)
    expect(s.counts['not-verified']).toBe(2)
    expect(s.verified).toBe(1)
    expect(s.total).toBe(3)
  })

  it('nennt den JUENGSTEN Zeitpunkt', () => {
    const s = asBuiltSummary([
      eintrag({ planned: 'a', actual: 'a', at: '2026-09-01T10:00:00.000Z' }),
      eintrag({ subject: 'B', planned: 'b', actual: 'b', at: '2026-09-06T10:00:00.000Z' }),
    ])
    expect(s.latest).toBe('2026-09-06T10:00:00.000Z')
  })

  it('laesst den Zeitpunkt WEG, wo es keinen gibt', () => {
    // Ein Blatt ohne Zeitpunkt behauptet sonst Gegenwart.
    const s = asBuiltSummary([eintrag({ planned: 'a' })])
    expect('latest' in s).toBe(false)
  })

  it('kommt mit einer leeren Liste zurecht', () => {
    const s = asBuiltSummary([])
    expect(s.total).toBe(0)
    expect(s.verified).toBe(0)
  })
})

// ── 4. Die Zubringer rechnen nichts neu ────────────────────────────────────

describe('fromNetworkReport', () => {
  const report: ReconcileReport = {
    takenAt: jetzt,
    source: 'arp',
    counts: {} as ReconcileReport['counts'],
    rows: [
      { verdict: 'address-mismatch', planned: 'Kamera 1', plannedIp: '10.0.0.1', found: 'Kamera 1', foundIp: '10.0.0.9' },
      { verdict: 'missing', planned: 'Kamera 2', plannedIp: '10.0.0.2' },
      { verdict: 'unexpected', found: 'Fremdgeraet', foundIp: '10.0.0.77' },
    ],
  }

  it('uebernimmt den Zeitpunkt des SCANS, nicht des Aufrufs', () => {
    expect(fromNetworkReport(report).every((e) => e.at === jetzt)).toBe(true)
  })

  it('bildet die drei Faelle auf die drei Urteile ab', () => {
    const [a, b, c] = fromNetworkReport(report)
    expect(asBuiltVerdict(a)).toBe('differs')
    expect(asBuiltVerdict(b)).toBe('missing')
    expect(asBuiltVerdict(c)).toBe('unexpected')
  })

  it('nennt die Zeile ohne beide Namen „unbenannt" statt leer', () => {
    const [e] = fromNetworkReport({ ...report, rows: [{ verdict: 'ambiguous' }] })
    expect(e.subject).toBe('unbenannt')
  })
})

describe('fromLiveComparison', () => {
  const comparison: LiveComparison = {
    deltas: [{ key: 'w1', label: 'MV Fenster 1', planned: 1, confirmed: 2 }],
    onlyPlanned: [{ key: 'w2', label: 'MV Fenster 2', planned: 3 }],
    onlyConfirmed: [{ key: 'w3', label: 'MV Fenster 3', confirmed: 4 }],
    agreeing: 5,
  }

  it('nimmt ALLE drei Listen — nicht nur die Deltas', () => {
    // „Im Plan, aber das Geraet sagt nichts dazu" ist etwas anderes als „im
    // Plan auf 0"; beide gehoeren aufs Blatt.
    expect(fromLiveComparison(comparison, 'Quelle', jetzt)).toHaveLength(3)
  })

  it('haelt planned und confirmed auseinander', () => {
    const [d, nurPlan, nurGeraet] = fromLiveComparison(comparison, 'Quelle', jetzt)
    expect([d.planned, d.actual]).toEqual(['1', '2'])
    expect('actual' in nurPlan).toBe(false)
    expect('planned' in nurGeraet).toBe(false)
  })

  it('nimmt den Zeitpunkt vom Aufrufer', () => {
    expect(fromLiveComparison(comparison, 'Quelle', jetzt)[0].at).toBe(jetzt)
  })
})

describe('fromCrosspoints', () => {
  it('fuehrt die AUFGEDRUCKTEN Nummern, nicht die internen', () => {
    // Ein Blatt, das intern ab 0 zaehlt, schickt jemanden zum falschen
    // Kreuzpunkt — dieselbe Regel wie auf dem Umbau-Zettel (Bedarf 121).
    const [e] = fromCrosspoints('Videohub', { 0: 1 }, { 0: 2 }, jetzt)
    expect(e.subject).toBe('Videohub · Ausgang 1')
    expect(e.planned).toBe('2')
    expect(e.actual).toBe('3')
  })

  it('meldet nur die Ausgaenge, die abweichen', () => {
    expect(fromCrosspoints('VH', { 0: 1, 1: 1 }, { 0: 1, 1: 2 }, jetzt)).toHaveLength(1)
  })

  it('laesst die fehlende Seite weg', () => {
    const [e] = fromCrosspoints('VH', { 0: 1 }, {}, jetzt)
    expect('actual' in e).toBe(false)
    expect(asBuiltVerdict(e)).toBe('missing')
  })
})

// ── 5. Die Luecke bleibt sichtbar ──────────────────────────────────────────

describe('unverifiedEntries', () => {
  it('macht aus einem Plan-Gegenstand eine Zeile OHNE Ablesung', () => {
    // Ohne diesen Zubringer fuehrte das Blatt nur die Gegenstaende, an denen
    // jemand war — und laese sich wie eine vollstaendige Pruefung.
    const [e] = unverifiedEntries([{ subject: 'Kamera 5', field: 'Quelle', planned: 'In 5' }])
    expect('at' in e).toBe(false)
    expect(asBuiltVerdict(e)).toBe('not-verified')
  })

  it('laesst einen leeren Plan-Wert weg statt ihn leer zu fuehren', () => {
    const [e] = unverifiedEntries([{ subject: 'X', field: 'Y' }])
    expect('planned' in e).toBe(false)
  })
})

describe('mergeEntries', () => {
  it('laesst die Ablesung gegen die Luecke gewinnen', () => {
    const gemischt = mergeEntries(
      unverifiedEntries([{ subject: 'ATEM 1 · In 3', field: 'Quelle', planned: 'Kamera 1' }]),
      [eintrag({ planned: 'Kamera 1', actual: 'Kamera 2', at: jetzt })],
    )
    expect(gemischt).toHaveLength(1)
    expect(asBuiltVerdict(gemischt[0])).toBe('differs')
  })

  it('laesst die Ablesung auch dann gewinnen, wenn sie SPAETER kommt', () => {
    // Die Reihenfolge der Zubringer darf das Ergebnis nicht bestimmen.
    const andersrum = mergeEntries(
      [eintrag({ planned: 'Kamera 1', actual: 'Kamera 2', at: jetzt })],
      unverifiedEntries([{ subject: 'ATEM 1 · In 3', field: 'Quelle', planned: 'Kamera 1' }]),
    )
    expect(asBuiltVerdict(andersrum[0])).toBe('differs')
  })

  it('nimmt bei zwei Ablesungen die JUENGERE — in BEIDEN Reihenfolgen', () => {
    // Nur die eine Richtung zu pruefen sagt nichts: dort gewinnt die zweite
    // Gruppe ohnehin. Der Fall, um den es geht, ist die ALTE Ablesung, die
    // spaeter hereinkommt — sie darf die juengere nicht ueberschreiben.
    const alt_zuerst = mergeEntries(
      [eintrag({ planned: 'a', actual: 'alt', at: '2026-09-01T10:00:00.000Z' })],
      [eintrag({ planned: 'a', actual: 'neu', at: '2026-09-06T10:00:00.000Z' })],
    )
    expect(alt_zuerst[0].actual).toBe('neu')

    const neu_zuerst = mergeEntries(
      [eintrag({ planned: 'a', actual: 'neu', at: '2026-09-06T10:00:00.000Z' })],
      [eintrag({ planned: 'a', actual: 'alt', at: '2026-09-01T10:00:00.000Z' })],
    )
    expect(neu_zuerst[0].actual).toBe('neu')
  })

  it('trennt gleiche Gegenstaende mit verschiedenem FELD', () => {
    const m = mergeEntries(
      [eintrag({ field: 'Quelle', at: jetzt, planned: 'a', actual: 'a' })],
      [eintrag({ field: 'Kreuzpunkt', at: jetzt, planned: 'b', actual: 'b' })],
    )
    expect(m).toHaveLength(2)
  })
})

// ── 5b. Die fuenfte Quelle: die Verkabelung (B-9) ──────────────────────────

const port = (id: string, name: string) => ({ id, name })

const geraet = (id: string, name: string, ports: string[]): EquipmentItem =>
  ({
    id,
    name,
    category: 'test',
    inputs: ports.map((p) => port(`${id}-${p}`, p)),
    outputs: [],
  }) as unknown as EquipmentItem

const kabel = (over: Partial<Cable> = {}): Cable =>
  ({
    id: 'k1',
    name: '',
    type: 'BNC',
    length: 5,
    color: '#fff',
    fromEquipmentId: 'a',
    fromPortId: 'a-Out 1',
    toEquipmentId: 'b',
    toPortId: 'b-In 1',
    notes: '',
    ...over,
  }) as unknown as Cable

const rig: EquipmentItem[] = [geraet('a', 'Kamera 1', ['Out 1']), geraet('b', 'ATEM', ['In 1'])]

describe('fromCabling — was kein Geraet beantworten kann', () => {
  it('fuehrt eine geplante Verbindung OHNE Haken als „nicht nachgesehen"', () => {
    // Der Kern der Regel: der Plan will das Kabel, aber niemand war dran.
    // „stimmt" waere hier eine Behauptung ueber die Wirklichkeit.
    const zeilen = fromCabling([kabel()], rig, { ports: {}, cables: {}, receivedAt: jetzt })
    expect(zeilen).toHaveLength(1)
    expect(asBuiltVerdict(zeilen[0])).toBe('not-verified')
    expect(zeilen[0].planned).toBe('ja')
  })

  it('macht aus einem Haken eine Uebereinstimmung', () => {
    const zeilen = fromCabling([kabel()], rig, {
      ports: {},
      cables: { k1: true },
      receivedAt: jetzt,
    })
    expect(asBuiltVerdict(zeilen[0])).toBe('match')
    expect(zeilen[0].at).toBe(jetzt)
    expect(zeilen[0].source).toBe('field-check')
  })

  it('nennt die Verbindung beim Namen, sonst bei ihren beiden Enden', () => {
    const ohneNamen = fromCabling([kabel()], rig, undefined)
    expect(ohneNamen[0].subject).toBe('Kamera 1 · Out 1 → ATEM · In 1')
    const mitNamen = fromCabling([kabel({ name: 'CAM1-PGM' })], rig, undefined)
    expect(mitNamen[0].subject).toBe('CAM1-PGM')
  })

  it('meldet einen Haken an einem Kabel, das der Plan nicht mehr kennt', () => {
    // DER Fall, der die Arbeit traegt: der Plan hat sich geaendert, nachdem
    // die Crew losgezogen ist. Draussen steckt das Kabel weiterhin.
    const zeilen = fromCabling([], rig, {
      ports: {},
      cables: { 'weg-1': true },
      receivedAt: jetzt,
    })
    expect(zeilen).toHaveLength(1)
    expect(asBuiltVerdict(zeilen[0])).toBe('unexpected')
    expect(zeilen[0].subject).toContain('weg-1')
  })

  it('meldet einen Haken an einem Port, den der Plan nicht erklaert', () => {
    const zeilen = fromCabling([], rig, {
      ports: { 'a|a-Out 1': true },
      cables: {},
      receivedAt: jetzt,
    })
    const portZeile = zeilen.find((z) => z.field === 'Port gesteckt')
    expect(portZeile?.subject).toBe('Kamera 1 · Out 1')
    expect(asBuiltVerdict(portZeile!)).toBe('unexpected')
  })

  it('fuehrt einen abgehakten Port MIT Kabelende als Uebereinstimmung', () => {
    const zeilen = fromCabling([kabel()], rig, {
      ports: { 'a|a-Out 1': true },
      cables: {},
      receivedAt: jetzt,
    })
    const portZeile = zeilen.find((z) => z.field === 'Port gesteckt')
    expect(asBuiltVerdict(portZeile!)).toBe('match')
  })

  it('fuehrt NICHT abgehakte Ports gar nicht auf', () => {
    // Sonst stuende jede Luecke zweimal auf dem Blatt — einmal als Kabel und
    // einmal je Ende —, und die Zahl unter dem Blatt waere doppelt so gross
    // wie die Zahl der offenen Punkte.
    const zeilen = fromCabling([kabel()], rig, { ports: {}, cables: {}, receivedAt: jetzt })
    expect(zeilen.filter((z) => z.field === 'Port gesteckt')).toHaveLength(0)
  })

  it('macht aus einem Haken OHNE Zeitpunkt keine Ablesung', () => {
    // Ein Projekt aus der Zeit vor `receivedAt`. Die Haken sind da, ihr Alter
    // kennt niemand — also ist nichts nachgesehen.
    const zeilen = fromCabling([kabel()], rig, { ports: {}, cables: { k1: true } })
    expect(asBuiltVerdict(zeilen[0])).toBe('not-verified')
    expect(zeilen[0].actual).toBeUndefined()
  })

  it('macht aus `false` kein „fehlt"', () => {
    // Der Haken ist binaer und kennt kein „nein"; `false` heisst „noch nicht
    // abgehakt". Eine `missing`-Zeile daraus waere eine Ablesung, die
    // niemand gemacht hat.
    const zeilen = fromCabling([kabel()], rig, {
      ports: {},
      cables: { k1: false },
      receivedAt: jetzt,
    })
    expect(asBuiltVerdict(zeilen[0])).toBe('not-verified')
  })

  it('kommt ohne checkState zurecht', () => {
    const zeilen = fromCabling([kabel()], rig, undefined)
    expect(zeilen).toHaveLength(1)
    expect(asBuiltVerdict(zeilen[0])).toBe('not-verified')
  })

  it('haelt eine lesbare Ueberschrift fuer die neue Quelle bereit', () => {
    expect(READING_SOURCE_LABEL['field-check']).toBeTruthy()
  })
})

describe('der Haken traegt seinen Zeitpunkt', () => {
  it('gestempelt wird beim EMPFANG, nicht beim Lesen', () => {
    // Wer den Zeitpunkt setzen darf, kann „nachgesehen" behaupten, ohne
    // nachgesehen zu haben. Deshalb faellt er im Slice an, der die Meldung
    // des Handys entgegennimmt — und nirgends sonst.
    expect(sliceQuelle).toContain('receivedAt: new Date().toISOString()')
    expect(sliceQuelle.match(/receivedAt: new Date/g) ?? []).toHaveLength(1)
  })

  it('bleibt stehen, wenn der Planer EINEN Haken zuruecknimmt', () => {
    // Ein zurueckgenommener Haken macht die Meldung nicht ungeschehen; die
    // uebrigen stammen weiter aus derselben Ablesung.
    expect(sliceQuelle).toContain('checkState: { ...cur, ports: nextPorts, cables: cur.cables }')
    expect(sliceQuelle).toContain('checkState: { ...cur, ports: cur.ports, cables: nextCables }')
  })

  it('faellt weg, wenn ALLE Haken geloescht werden', () => {
    // Ein stehengebliebener Zeitpunkt gaebe einem leeren Stand ein Alter,
    // das er nicht hat.
    expect(sliceQuelle).toContain('checkState: { ports: {}, cables: {} }')
  })
})

// ── 6. Die Oberflaeche ─────────────────────────────────────────────────────

describe('der Abgleich-Dialog', () => {
  it('fuehrt AUCH die Geraete, die der Scan nicht gesehen hat', () => {
    // Sonst fuehrte das Blatt nur die Geraete, an denen jemand war, und laese
    // sich wie eine vollstaendige Pruefung — genau der Zustand, den der
    // Bedarf beklagt („post has no record").
    expect(dialogQuelle).toContain('unverifiedEntries(')
    // Nicht auf die Zeilenumbrueche festgenagelt: geprueft wird, dass BEIDE
    // Seiten in denselben `mergeEntries`-Aufruf gehen — die geplanten
    // Gegenstaende und der Bericht. Ein Waechter, der an einer Umformatierung
    // rot wird, wird irgendwann geaendert statt gelesen.
    const zusammenfuehrung = dialogQuelle.slice(
      dialogQuelle.indexOf('return mergeEntries('),
      dialogQuelle.indexOf('const asBuiltStand'),
    )
    expect(zusammenfuehrung).toContain('geplant')
    expect(zusammenfuehrung).toContain('fromNetworkReport(report)')
  })

  it('nennt die Deckung in Zahlen, statt nur die Abweichungen zu zeigen', () => {
    expect(dialogQuelle).toContain('asBuiltSummary(asBuilt)')
    expect(dialogQuelle).toContain("t('asBuilt.count'")
  })

  it('nimmt die Verkabelung auf DASSELBE Blatt (B-9)', () => {
    // Ein zweites „As-built (Kabel)"-Dokument waere die Vervielfachung, gegen
    // die dieses Modul gebaut ist: die Post haette zwei Blaetter und muesste
    // sie selbst zusammenlegen.
    expect(dialogQuelle).toContain('fromCabling(cables, equipment, checkState)')
    expect(dialogQuelle).not.toContain('asBuiltTable(kabelBlatt)')
  })

  it('liest den Zeitpunkt aus dem Plan, statt ihn zu stellen', () => {
    // Der Dialog weiss nicht, wann jemand abgehakt hat.
    const abschnitt = dialogQuelle.slice(
      dialogQuelle.indexOf('const asBuilt = useMemo'),
      dialogQuelle.indexOf('const asBuiltStand'),
    )
    expect(abschnitt).not.toContain('new Date(')
  })
})

// ── 7. Reinheit ────────────────────────────────────────────────────────────

describe('das Modul', () => {
  it('nimmt keine Uhr und keinen Store', () => {
    expect(libQuelle).not.toContain('new Date(')
    expect(libQuelle).not.toContain('Date.now')
    expect(libQuelle).not.toContain('useProjectStore')
  })

  it('rechnet KEINEN der vier Vergleiche neu', () => {
    // Eine fuenfte Wahrheit ueber dieselbe Frage waere genau die
    // Vervielfachung, die der Bedarf beklagt.
    expect(libQuelle).toContain('allDeltas(comparison)')
    expect(libQuelle).toContain('salvoChanges(planned, live)')
    expect(libQuelle).toContain('report.rows.map')
    expect(libQuelle).not.toContain('normaliseMac')
    expect(libQuelle).not.toContain('compareAssignments')
  })

  it('schreibt den Befund nicht in den Plan zurueck', () => {
    // „Was der Hub gerade tut, ist eine Beobachtung, was im Plan steht, eine
    // Absicht." Beides in dieselbe Variable zu schreiben macht die Absicht
    // unauffindbar.
    expect(libQuelle).not.toContain('updateEquipment')
    expect(libQuelle).toContain('entscheiden tut ein')
  })
})
