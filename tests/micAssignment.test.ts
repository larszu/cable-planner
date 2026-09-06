import { describe, expect, it } from 'vitest'
import {
  MIC_FINDING_LABEL,
  a2Card,
  assignmentsOf,
  batteryMinutes,
  batteryText,
  carryForward,
  micFindings,
  normaliseMicPlot,
  performerLabel,
  previousSession,
  sessionTable,
  sessionsInOrder,
} from '../src/renderer/lib/micAssignment'
import {
  NO_BATTERY_TIME,
  NO_PERFORMER_NAME,
  NO_PHOTO,
  ORIGIN_LABEL,
  type MicPlot,
} from '../src/renderer/types/micAssignment'
import type { WirelessRigPlan } from '../src/renderer/types/wirelessRig'
import typenQuelle from '../src/renderer/types/micAssignment.ts?raw'
import libQuelle from '../src/renderer/lib/micAssignment.ts?raw'
import panelQuelle from '../src/renderer/components/Wireless/MicPlotPanel.tsx?raw'
import dialogQuelle from '../src/renderer/components/Wireless/WirelessRigDialog.tsx?raw'
import storeQuelle from '../src/renderer/store/projectStore.ts?raw'
import { undescribedColumns } from '../src/renderer/lib/dataDictionary'

// ---------------------------------------------------------------------------
// Wer traegt heute welche Strecke (Bedarf 114, P3).
//
//   > Which pack, capsule, battery and frequency is on which person is
//   > tracked on a paper card or in someone's head, and has to be REDONE FOR
//   > EVERY SESSION of a run.
//
// Zwei unabhaengige Werkzeuge sind 2025/26 auf denselben Gegenstand gekommen:
// `chazw661/ShowStack#68` und `#64` (ein „Mic Tracker" nach Sessions und Tagen,
// dessen Sicht je Person „the A2 card" heisst) und SoundDocs' „Mic Plot
// Designer". Die Bedarfs-Datenbank nennt ihn „the only audio artefact that
// recurs per performance rather than per production".
// ---------------------------------------------------------------------------

const rig = (): WirelessRigPlan => ({
  channels: [
    { id: 'c1', label: 'Handsender 1', frequencyMhz: 502.375 },
    { id: 'c2', label: 'Headset 1', frequencyMhz: 506.125 },
  ],
})

const plot = (over: Partial<MicPlot> = {}): MicPlot => ({
  performers: over.performers ?? [
    { id: 'p1', name: 'A. Beispiel', role: 'Moderation' },
    { id: 'p2', role: 'Pfarrer' },
  ],
  sessions: over.sessions ?? [
    { id: 's1', date: '2026-09-05', label: 'Probe' },
    { id: 's2', date: '2026-09-06', label: 'Vorstellung 1' },
  ],
  assignments: over.assignments ?? [
    { sessionId: 's1', performerId: 'p1', channelId: 'c1', packUnitId: 'u1', origin: 'manual' },
    { sessionId: 's1', performerId: 'p2', channelId: 'c2', origin: 'manual' },
  ],
})

const packLabelOf = (id: string) => `AV-${id.toUpperCase()}`

// ── 1. Der Gegenstand ist die Vorstellung, nicht die Produktion ────────────

describe('die Zuordnung haengt an der Session, nicht am Rig-Plan', () => {
  it('liegt als eigenes Feld am Projekt', () => {
    // Beides in ein Objekt zu legen hiesse, den Kanalplan je Vorstellung zu
    // kopieren — und die Kopien laufen auseinander.
    expect(typenQuelle).toContain('recurs per performance rather than per')
    expect(storeQuelle).toContain('const micPlotGeheilt = normaliseMicPlot(project.micPlot)')
  })

  it('setzt `micPlot` nur, wenn wirklich etwas drinsteht', () => {
    // Sonst traege jedes Projekt ab jetzt ein leeres Objekt mit sich, und der
    // Vergleich zweier unveraenderter Dateien zeigte einen Unterschied.
    expect(storeQuelle).toMatch(/micPlotGeheilt\.performers\.length[\s\S]{0,200}\? micPlotGeheilt\s*\n?\s*: undefined/)
  })

  it('nennt nur die Zuordnungen der gefragten Session', () => {
    const p = plot({
      assignments: [
        { sessionId: 's1', performerId: 'p1', channelId: 'c1', origin: 'manual' },
        { sessionId: 's2', performerId: 'p1', channelId: 'c2', origin: 'manual' },
      ],
    })
    expect(assignmentsOf(p, 's2').map((a) => a.channelId)).toEqual(['c2'])
  })
})

// ── 2. Wie eine Person heisst ──────────────────────────────────────────────

describe('performerLabel', () => {
  it('nimmt den Namen, wenn es einen gibt', () => {
    expect(performerLabel({ id: 'p1', name: 'A. Beispiel', role: 'Moderation' })).toBe('A. Beispiel')
  })

  it('faellt auf die Funktion zurueck', () => {
    // Wer nur die Funktion pflegt („Pfarrer"), hat keinen Personennamen im
    // Projekt — und das Blatt funktioniert trotzdem.
    expect(performerLabel({ id: 'p2', role: 'Pfarrer' })).toBe('Pfarrer')
  })

  it('sagt „ohne Namen" statt einer leeren Zelle', () => {
    expect(performerLabel({ id: 'p3' })).toBe(NO_PERFORMER_NAME)
    expect(performerLabel(undefined)).toBe(NO_PERFORMER_NAME)
    expect(performerLabel({ id: 'p3', name: '   ' })).toBe(NO_PERFORMER_NAME)
  })
})

// ── 3. Der Akku — verstrichene Zeit, keine Restlaufzeit ────────────────────

describe('der Akku', () => {
  const a = (fitted?: string) => ({
    sessionId: 's1',
    performerId: 'p1',
    channelId: 'c1',
    origin: 'manual' as const,
    ...(fitted ? { batteryFittedAt: fitted } : {}),
  })

  it('sagt, wie lange er drin ist', () => {
    expect(batteryMinutes(a('2026-09-06T10:00:00Z'), '2026-09-06T10:45:00Z')).toBe(45)
    expect(batteryText(a('2026-09-06T10:00:00Z'), '2026-09-06T10:45:00Z')).toBe('seit 45 min')
    expect(batteryText(a('2026-09-06T08:00:00Z'), '2026-09-06T10:45:00Z')).toBe('seit 2 h 45 min')
  })

  it('behauptet KEINE Restlaufzeit', () => {
    // Sie haengt an Typ, Alter, Sendeleistung und Temperatur, und keine
    // dieser Angaben steht im Plan. Eine Zahl auszurechnen, auf die sich
    // jemand im Saal verlaesst, waere eine Erfindung.
    // Geprueft an den EXPORTEN und nicht an der Prosa: der Kopfkommentar
    // erklaert gerade, warum es keine Restlaufzeit gibt, und darf das Wort
    // deshalb nennen.
    const exporte = [...libQuelle.matchAll(/export (?:function|const) (\w+)/g)].map((m) => m[1])
    expect(exporte.filter((n) => /remaining|rest|left|until/i.test(n))).toEqual([])
    expect(typenQuelle).toContain('Kein „voll"-Haken')
  })

  it('sagt „nicht festgehalten" statt Null', () => {
    expect(batteryMinutes(a(), '2026-09-06T10:00:00Z')).toBeNull()
    expect(batteryText(a(), '2026-09-06T10:00:00Z')).toBe(NO_BATTERY_TIME)
  })

  it('gibt bei einem Zeitpunkt in der Zukunft keine negative Zeit aus', () => {
    // Vertippt sich jemand im Datum, waere „seit -120 min" schlimmer als
    // „nicht festgehalten".
    expect(batteryMinutes(a('2026-09-07T10:00:00Z'), '2026-09-06T10:00:00Z')).toBeNull()
    expect(batteryMinutes(a('kein Datum'), '2026-09-06T10:00:00Z')).toBeNull()
  })
})

// ── 4. Die A2-Karte ────────────────────────────────────────────────────────

describe('a2Card', () => {
  const jetzt = '2026-09-06T10:30:00Z'

  it('holt Frequenz und Kanalnamen aus dem Rig-Plan', () => {
    const c = a2Card(plot(), rig(), 's1', 'p1', jetzt, packLabelOf)
    expect(c?.channelLabel).toBe('Handsender 1')
    expect(c?.frequency).toBe('502.375 MHz')
    expect(c?.pack).toBe('AV-U1')
    expect(c?.origin).toBe(ORIGIN_LABEL.manual)
  })

  it('sagt „Kanal entfernt", wenn der Rig-Plan ihn nicht mehr fuehrt', () => {
    const p = plot({
      assignments: [{ sessionId: 's1', performerId: 'p1', channelId: 'weg', origin: 'manual' }],
    })
    const c = a2Card(p, rig(), 's1', 'p1', jetzt, packLabelOf)
    expect(c?.channelLabel).toBe('Kanal entfernt')
    expect(c?.frequency).toBe('nicht belegt')
  })

  it('traegt fuer jede fehlende Angabe ein benanntes Ergebnis', () => {
    const c = a2Card(plot(), rig(), 's1', 'p2', jetzt, packLabelOf)
    expect(c?.performer).toBe('Pfarrer')
    expect(c?.photo).toBe(NO_PHOTO)
    expect(c?.pack).toBe('nicht benannt')
    expect(c?.capsule).toBe('wie im Kanalplan')
    expect(c?.battery).toBe(NO_BATTERY_TIME)
  })

  it('gibt den Bild-VERWEIS aus und laedt kein Bild', () => {
    // Ein Projektfile geht per Mail an Haus, Verleih und Freelancer; ein
    // Portraet einer namentlich genannten Person soll dabei nicht unbemerkt
    // mitfahren.
    const p = plot({
      performers: [{ id: 'p1', name: 'A. Beispiel', photoRef: '/tmp/kopf.jpg' }],
      assignments: [{ sessionId: 's1', performerId: 'p1', channelId: 'c1', origin: 'manual' }],
    })
    expect(a2Card(p, rig(), 's1', 'p1', jetzt, packLabelOf)?.photo).toBe('/tmp/kopf.jpg')
    expect(libQuelle).not.toMatch(/fetch\(|readFile|base64|FileReader/)
  })

  it('liefert null, wo es keine Zuordnung gibt', () => {
    expect(a2Card(plot(), rig(), 's2', 'p1', jetzt, packLabelOf)).toBeNull()
  })
})

// ── 5. Das Session-Blatt ───────────────────────────────────────────────────

describe('sessionTable', () => {
  const jetzt = '2026-09-06T10:30:00Z'

  it('nennt Kanal, Frequenz, Person, Sender und Herkunft', () => {
    const t = sessionTable(plot(), rig(), 's1', jetzt, packLabelOf)
    expect(t.headers).toEqual([
      'Kanal',
      'Frequenz',
      'Person',
      'Funktion',
      'Sender (Einheit)',
      'Kapsel',
      'Akku',
      'Herkunft',
    ])
    expect(t.rows).toHaveLength(2)
  })

  it('sortiert nach Kanal und nicht nach Anlege-Reihenfolge', () => {
    // Am Case haengt die Liste in Kanal-Reihenfolge; wer sie abarbeitet, geht
    // die Sender der Reihe nach durch.
    const p = plot({
      assignments: [
        { sessionId: 's1', performerId: 'p2', channelId: 'c2', origin: 'manual' },
        { sessionId: 's1', performerId: 'p1', channelId: 'c1', origin: 'manual' },
      ],
    })
    const t = sessionTable(p, rig(), 's1', jetzt, packLabelOf)
    expect(t.rows.map((r) => r[0])).toEqual(['Handsender 1', 'Headset 1'])
  })

  it('hat fuer jede Spalte einen Lexikon-Eintrag', () => {
    // Ueber das Lexikon selbst und nicht ueber den Quelltext: ein
    // Zeichenketten-Treffer im Quelltext ginge auch bei einem Eintrag auf,
    // der zu einer ganz anderen Spalte gehoert.
    const t = sessionTable(plot(), rig(), 's1', jetzt, packLabelOf)
    expect(undescribedColumns(t.headers)).toEqual([])
  })
})

// ── 6. Befunde ─────────────────────────────────────────────────────────────

describe('micFindings', () => {
  it('meldet zwei Personen auf demselben Kanal', () => {
    // Zwei Sender auf derselben Frequenz loeschen einander aus.
    const p = plot({
      assignments: [
        { sessionId: 's1', performerId: 'p1', channelId: 'c1', origin: 'manual' },
        { sessionId: 's1', performerId: 'p2', channelId: 'c1', origin: 'manual' },
      ],
    })
    const f = micFindings(p, rig(), 's1').filter((x) => x.kind === 'channel-double-booked')
    expect(f).toHaveLength(1)
    expect(f[0].performerIds).toEqual(['p1', 'p2'])
    expect(f[0].text).toContain('Handsender 1')
  })

  it('meldet einen Sender an zwei Personen', () => {
    const p = plot({
      assignments: [
        { sessionId: 's1', performerId: 'p1', channelId: 'c1', packUnitId: 'u9', origin: 'manual' },
        { sessionId: 's1', performerId: 'p2', channelId: 'c2', packUnitId: 'u9', origin: 'manual' },
      ],
    })
    expect(micFindings(p, rig(), 's1').map((x) => x.kind)).toContain('pack-double-booked')
  })

  it('zaehlt eine fehlende Sender-Angabe NICHT als Doppelung', () => {
    // Zwei Zeilen ohne Sender liegen nicht auf demselben Sender — sie liegen
    // auf keinem.
    const p = plot({
      assignments: [
        { sessionId: 's1', performerId: 'p1', channelId: 'c1', origin: 'manual' },
        { sessionId: 's1', performerId: 'p2', channelId: 'c2', origin: 'manual' },
      ],
    })
    expect(micFindings(p, rig(), 's1').map((x) => x.kind)).not.toContain('pack-double-booked')
  })

  it('meldet einen Kanal, den der Rig-Plan nicht mehr fuehrt', () => {
    const p = plot({
      assignments: [{ sessionId: 's1', performerId: 'p1', channelId: 'weg', origin: 'manual' }],
    })
    expect(micFindings(p, rig(), 's1').map((x) => x.kind)).toContain('channel-missing')
  })

  it('meldet uebernommene Zuordnungen als unbestaetigt', () => {
    const p = plot({
      assignments: [{ sessionId: 's1', performerId: 'p1', channelId: 'c1', origin: 'carried' }],
    })
    const f = micFindings(p, rig(), 's1').find((x) => x.kind === 'carried-unconfirmed')
    expect(f?.text).toContain('Vermutung')
  })

  it('meldet den fehlenden Akku-Zeitpunkt', () => {
    expect(micFindings(plot(), rig(), 's1').map((x) => x.kind)).toContain('battery-unrecorded')
  })

  it('schweigt bei einer sauberen Session', () => {
    const p = plot({
      assignments: [
        { sessionId: 's1', performerId: 'p1', channelId: 'c1', packUnitId: 'u1', batteryFittedAt: '2026-09-06T09:00:00Z', origin: 'manual' },
        { sessionId: 's1', performerId: 'p2', channelId: 'c2', packUnitId: 'u2', batteryFittedAt: '2026-09-06T09:00:00Z', origin: 'manual' },
      ],
    })
    expect(micFindings(p, rig(), 's1')).toEqual([])
  })

  it('haelt fuer jede Befundart eine lesbare Ueberschrift bereit', () => {
    for (const k of [
      'channel-double-booked',
      'pack-double-booked',
      'performer-twice',
      'channel-missing',
      'battery-unrecorded',
      'carried-unconfirmed',
    ] as const) {
      expect(MIC_FINDING_LABEL[k].length).toBeGreaterThan(10)
    }
  })
})

// ── 7. Die Arbeit, die der Beleg beschreibt ────────────────────────────────

describe('carryForward — „redone for every session"', () => {
  it('uebernimmt die Zuordnungen der vorigen Session', () => {
    const neu = carryForward(plot(), 's1', 's2')
    expect(neu.map((a) => a.performerId)).toEqual(['p1', 'p2'])
    expect(neu.every((a) => a.sessionId === 's2')).toBe(true)
  })

  it('benennt sie als uebernommen und nicht als bestaetigt', () => {
    // Sie sparen das Neuschreiben; eine Vermutung ueber heute bleiben sie.
    expect(carryForward(plot(), 's1', 's2').every((a) => a.origin === 'carried')).toBe(true)
  })

  it('uebernimmt den Akku-Zeitpunkt NICHT', () => {
    // Der Akku von gestern ist der einzige Wert auf der Karte, der mit
    // Sicherheit falsch ist.
    const p = plot({
      assignments: [
        { sessionId: 's1', performerId: 'p1', channelId: 'c1', batteryFittedAt: '2026-09-05T18:00:00Z', origin: 'manual' },
      ],
    })
    expect(carryForward(p, 's1', 's2')[0].batteryFittedAt).toBeUndefined()
  })

  it('uebernimmt Sender und Kapsel-Notiz', () => {
    const p = plot({
      assignments: [
        { sessionId: 's1', performerId: 'p1', channelId: 'c1', packUnitId: 'u7', capsuleNote: 'DPA 4066', origin: 'manual' },
      ],
    })
    const [a] = carryForward(p, 's1', 's2')
    expect(a.packUnitId).toBe('u7')
    expect(a.capsuleNote).toBe('DPA 4066')
  })

  it('legt nichts doppelt an, was schon dasteht', () => {
    const p = plot({
      assignments: [
        { sessionId: 's1', performerId: 'p1', channelId: 'c1', origin: 'manual' },
        { sessionId: 's2', performerId: 'p1', channelId: 'c1', origin: 'manual' },
      ],
    })
    expect(carryForward(p, 's1', 's2')).toEqual([])
  })

  it('aendert NICHTS', () => {
    // Schreiben gehoert dem Menschen: sonst uebernaehme das Oeffnen der
    // Ansicht eine Vermutung als Tatsache.
    const p = plot()
    const vorher = JSON.stringify(p)
    carryForward(p, 's1', 's2')
    expect(JSON.stringify(p)).toBe(vorher)
  })
})

describe('die Reihenfolge der Sessions', () => {
  it('sortiert nach Datum, Datumslose ans Ende', () => {
    const p = plot({
      sessions: [
        { id: 'x', label: 'ohne Datum' },
        { id: 'b', date: '2026-09-06' },
        { id: 'a', date: '2026-09-05' },
      ],
    })
    expect(sessionsInOrder(p).map((s) => s.id)).toEqual(['a', 'b', 'x'])
  })

  it('nennt die Session davor', () => {
    expect(previousSession(plot(), 's2')?.id).toBe('s1')
    expect(previousSession(plot(), 's1')).toBeUndefined()
  })
})

// ── 8. Die Heilung ─────────────────────────────────────────────────────────

describe('normaliseMicPlot', () => {
  it('heilt einen fehlenden Plan zu leer', () => {
    expect(normaliseMicPlot(undefined)).toEqual({ performers: [], sessions: [], assignments: [] })
    expect(normaliseMicPlot('kaputt')).toEqual({ performers: [], sessions: [], assignments: [] })
  })

  it('wirft Zuordnungen ohne Bezug weg', () => {
    const g = normaliseMicPlot({
      performers: [{ id: 'p1' }, { kaputt: true }],
      sessions: [{ id: 's1' }],
      assignments: [
        { sessionId: 's1', performerId: 'p1', channelId: 'c1', origin: 'manual' },
        { sessionId: 's1', performerId: 'p1' },
      ],
    })
    expect(g.performers).toHaveLength(1)
    expect(g.assignments).toHaveLength(1)
  })

  it('nimmt eine Zuordnung ohne Herkunft als von Hand gesetzt', () => {
    // „uebernommen" waere eine Behauptung ueber eine Session, die niemand
    // mehr kennt.
    const g = normaliseMicPlot({
      assignments: [{ sessionId: 's1', performerId: 'p1', channelId: 'c1' }],
    })
    expect(g.assignments[0].origin).toBe('manual')
  })
})

// ── 9. Erreichbar ──────────────────────────────────────────────────────────

describe('die Oberflaeche', () => {
  it('sitzt IM Funkstrecken-Dialog', () => {
    // Wer zuordnet, braucht die Frequenz daneben; ein zweites Fenster fuehrte
    // die Reibung wieder ein, die der Bedarf beschreibt.
    expect(dialogQuelle).toContain('<MicPlotPanel />')
  })

  it('stellt die Befunde UEBER die Liste', () => {
    const befunde = panelQuelle.indexOf('befunde.length > 0')
    const liste = panelQuelle.indexOf('{!aktuelle ? (')
    expect(befunde).toBeGreaterThan(0)
    expect(befunde).toBeLessThan(liste)
  })

  it('bietet das Uebernehmen an und nennt den Akku als Ausnahme', () => {
    expect(panelQuelle).toContain("t('micPlot.carry'")
    expect(panelQuelle).toContain('Der Akku-Zeitpunkt wird NICHT übernommen')
  })

  it('haelt einen entfernten Kanal sichtbar, statt still umzubuchen', () => {
    expect(panelQuelle).toContain("t('micPlot.channelGone'")
  })

  it('nennt den Sender an BEIDEN Stellen in der HAUS-Sicht', () => {
    // Bedarf 107 — der Lagerist ruft die Hausreferenz. Zwei Stellen lesen
    // sie: die Auswahlliste und die Beschriftung auf dem Session-Blatt.
    // `toContain` allein liesse die eine kippen, solange die andere steht.
    const treffer = [...panelQuelle.matchAll(/unitLabel\([^,]+, '(\w+)'\)/g)].map((m) => m[1])
    expect(treffer).toEqual(['house', 'house'])
  })
})

// ── 10. Rein ───────────────────────────────────────────────────────────────

describe('das Modul bleibt rein', () => {
  it('hat weder Uhr noch Store noch IO', () => {
    expect(libQuelle).not.toContain('Date.now')
    expect(libQuelle).not.toContain('new Date(')
    expect(libQuelle).not.toContain('useProjectStore')
    expect(libQuelle).not.toContain('localStorage')
  })
})
