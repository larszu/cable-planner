import { describe, expect, it } from 'vitest'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'
import type { LocationFrame } from '../src/renderer/types/location'
import { abnahmeprotokollHtml, abnahmeStandTable, maengel, maengelTable } from '../src/renderer/lib/abnahme'
import { wartungsplan, wartungsplanTable } from '../src/renderer/lib/wartungsplan'
import { konfigVorgaben, konfigVorgabenTable } from '../src/renderer/lib/konfigVorgaben'
import { steckbriefe, steckbriefHtml, steckbriefStandTable } from '../src/renderer/lib/steckbrief'
import { bedienUebersicht, bedienUebersichtHtml } from '../src/renderer/lib/bedienUebersicht'
import { installStatusText } from '../src/renderer/lib/installStatusText'
import { quelle } from '../src/renderer/lib/druckblatt'
import { DOCUMENT_LABELS, DOCUMENT_STANDS } from '../src/renderer/lib/documentRegistry'

// ---------------------------------------------------------------------------
// Die Betreiber-Blätter der Übergabe: Abnahmeprotokoll mit Mängelliste,
// Wartungs- und Prüfplan, Konfigurationsvorgaben, Geräte-Steckbrief,
// Bedien-Kurzübersicht. Geprüft wird vor allem, was NICHT darauf steht:
// kein erfundener Mangel, kein geratenes Datum, kein geratener Port.
// ---------------------------------------------------------------------------

const port = (id: string, name: string, connectorType = 'Ethernet/RJ45'): Port =>
  ({ id, name, type: 'port', connectorType }) as Port

const geraet = (name: string, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id: `id-${name}`,
    name,
    category: 'Sonstiges',
    inputs: [],
    outputs: [],
    x: 20,
    y: 20,
    width: 40,
    height: 40,
    ...over,
  }) as unknown as EquipmentItem

const kabel = (id: string, from: [string, string], to: [string, string], over: Partial<Cable> = {}): Cable =>
  ({
    id,
    name: id,
    cableNumber: id,
    type: 'BNC',
    length: 5,
    color: '#000',
    fromEquipmentId: from[0],
    fromPortId: from[1],
    toEquipmentId: to[0],
    toPortId: to[1],
    notes: '',
    ...over,
  }) as Cable

const projekt = (over: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Haus', createdAt: '', updatedAt: '' },
    equipment: [],
    cables: [],
    locations: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
    ...over,
  }) as CablePlannerProject

// ─── Mängelliste ───────────────────────────────────────────────────────────

describe('maengel', () => {
  const p = () =>
    projekt({
      equipment: [
        geraet('Rack', { installStatus: 'fault' }),
        geraet('Monitor', { installStatus: 'planned' }),
        geraet('ATEM', { installStatus: 'operational' }),
      ],
      cables: [
        kabel('K-2', ['id-Rack', 'a'], ['id-ATEM', 'b'], {
          testResult: { result: 'fail', standard: 'TIA Cat 6A', marginDb: -1.2, testedAt: '2026-09-20T10:00:00Z', testedBy: 'M. Muster' },
        }),
        kabel('K-1', ['id-Rack', 'a'], ['id-ATEM', 'b'], { testResult: { result: 'pass' } }),
        // Ohne Status und ohne Messung: kein Mangel.
        kabel('K-3', ['id-Rack', 'a'], ['id-ATEM', 'b']),
      ],
      pendingChanges: [
        { id: 'p1', ts: '2026-09-21T08:00:00Z', author: 'Feld', source: 'mobile', kind: 'issue', target: { type: 'cable', id: 'K-2', name: 'alt' }, summary: 'Stecker locker' },
        { id: 'p2', ts: '2026-09-21T09:00:00Z', author: 'Feld', source: 'mobile', kind: 'note', summary: 'nur Notiz' },
      ],
    })

  it('nimmt Störung, nicht bestandene Messung, offene Meldung und Restpunkt — sonst nichts', () => {
    const liste = maengel(p())
    expect(liste.map((m) => `${m.art}:${m.betrifft}`)).toEqual([
      'stoerung:Rack',
      'messung:K-2',
      'meldung:K-2',
      'restpunkt:Monitor',
    ])
  })

  it('nennt das Kabel mit seiner heutigen Nummer, nicht mit dem Namen aus der Meldung', () => {
    expect(maengel(p()).find((m) => m.art === 'meldung')!.betrifft).toBe('K-2')
  })

  it('schreibt die Liste kanonisch deutsch und nummeriert sie', () => {
    const t = maengelTable(p())
    expect(t.headers).toEqual(['Nr.', 'Art', 'Betrifft', 'Beschreibung', 'Gemeldet', 'Gemeldet von'])
    expect(t.rows[1]).toEqual([2, 'Messung nicht bestanden', 'K-2', 'Messung FAIL · TIA Cat 6A · Marge -1.2 dB', '2026-09-20', 'M. Muster'])
    expect(t.rows[2]).toEqual([3, 'Feld-Meldung', 'K-2', 'Stecker locker', '2026-09-21', 'Feld'])
  })

  it('haengt nicht an der Reihenfolge im Projekt', () => {
    const a = p()
    const b = p()
    b.equipment = [...b.equipment].reverse()
    b.cables = [...b.cables].reverse()
    expect(maengelTable(b)).toEqual(maengelTable(a))
  })
})

describe('Abnahmeprotokoll', () => {
  it('hat Ergebnis-Kästchen ohne Kreuz und einen Unterschriftenblock je Seite', () => {
    const html = abnahmeprotokollHtml(projekt({ metadata: { name: 'Haus', createdAt: '', updatedAt: '', client: 'Stadthalle', contractor: 'LZM' } as CablePlannerProject['metadata'] }), { titel: 'T', stempel: 'Haus · #abc' })
    expect((html.match(/class="kasten"/g) ?? []).length).toBe(3)
    expect(html).not.toMatch(/checked|&#10003;|✓/)
    expect((html.match(/class="unterschrift"/g) ?? []).length).toBe(2)
    expect(html).toContain('Stadthalle')
    expect(html).toContain('LZM')
    expect(html).toContain('Haus · #abc')
  })

  it('sagt bei leerer Liste, dass der Plan keinen Mangel kennt — nicht, dass es keinen gibt', () => {
    const html = abnahmeprotokollHtml(projekt(), { titel: 'T' })
    expect(html).toContain('That does not mean there is none.')
    // Vier leere Zeilen für die Begehung.
    expect((html.match(/<tr><td>\d<\/td><td><\/td>/g) ?? []).length).toBe(4)
  })

  it('geht durch den Übersetzer und maskiert', () => {
    const p = projekt({ equipment: [geraet('<Rack & Co>', { installStatus: 'fault' })] })
    const html = abnahmeprotokollHtml(p, {
      titel: 'T',
      t: (k, f) => (k === 'lifecycle.status.fault' ? 'Störung' : k === 'abnahme.kind.fault' ? 'Störung' : f),
    })
    expect(html).toContain('&lt;Rack &amp; Co&gt;')
    expect(html).toContain('Status &quot;Störung&quot;')
  })

  it('ein neuer Status veraltet das Protokoll', () => {
    const a = projekt({ equipment: [geraet('Rack')] })
    const b = projekt({ equipment: [geraet('Rack', { installStatus: 'operational' })] })
    expect(DOCUMENT_STANDS.abnahmeprotokoll(b)).not.toBe(DOCUMENT_STANDS.abnahmeprotokoll(a))
    expect(abnahmeStandTable(b).rows.some((r) => r[0] === 'Status operational')).toBe(true)
  })
})

// ─── Wartungsplan ──────────────────────────────────────────────────────────

describe('wartungsplan', () => {
  const p = (handoverDate?: string) =>
    projekt({
      metadata: { name: 'Haus', createdAt: '', updatedAt: '', ...(handoverDate ? { handoverDate } : {}) } as CablePlannerProject['metadata'],
      equipment: [
        geraet('Beamer', {
          maintenanceIntervalDays: 180,
          serviceHistory: [
            { id: 's1', date: '2026-01-10', author: 'A', kind: 'inspection', summary: 'Filter' },
            { id: 's2', date: '2026-03-01', author: 'A', kind: 'repair', summary: 'Lampe' },
          ],
        }),
        geraet('Kamera', { maintenanceIntervalDays: 365 }),
        geraet('Monitor', { warrantyUntil: '2028-01-01' }),
        geraet('Kabeltrommel'),
      ],
    })

  it('rechnet ab dem jüngsten Service, sonst ab der Übergabe — und sagt, welches', () => {
    const z = wartungsplan(p('2026-09-01'))
    const beamer = z.find((x) => x.geraet === 'Beamer')!
    expect(beamer.basis).toBe('service')
    expect(beamer.naechste).toBe('2026-08-28')
    const kamera = z.find((x) => x.geraet === 'Kamera')!
    expect(kamera.basis).toBe('uebergabe')
    expect(kamera.naechste).toBe('2027-09-01')
  })

  it('rät kein Datum, wo die Basis fehlt, und führt Geräte ohne Intervall und ohne Garantie nicht', () => {
    const t = wartungsplanTable(p())
    const kamera = t.rows.find((r) => r[0] === 'Kamera')!
    expect(kamera[6]).toBe('')
    expect(kamera[8]).toBe('kein Ausgangsdatum: weder Service-Eintrag noch Übergabe-Datum')
    const monitor = t.rows.find((r) => r[0] === 'Monitor')!
    expect(monitor[8]).toBe('kein Wartungsintervall angegeben')
    expect(t.rows.some((r) => r[0] === 'Kabeltrommel')).toBe(false)
  })

  it('sortiert nach Fälligkeit, leere nach hinten', () => {
    expect(wartungsplan(p('2026-09-01')).map((z) => z.geraet)).toEqual(['Beamer', 'Kamera', 'Monitor'])
  })

  it('nennt ein unlesbares Ausgangsdatum', () => {
    const z = wartungsplan(p('irgendwann')).find((x) => x.geraet === 'Kamera')!
    expect(z.befund).toBe('basis-unlesbar')
    expect(z.naechste).toBe('')
  })
})

// ─── Konfigurationsvorgaben ────────────────────────────────────────────────

describe('konfigVorgaben', () => {
  const blende = (name: string, n: number) =>
    geraet(name, {
      category: 'Patch panels',
      inputs: Array.from({ length: n }, (_, i) => port(`${name}-v${i + 1}`, `${i + 1}`)),
      outputs: Array.from({ length: n }, (_, i) => port(`${name}-h${i + 1}`, `${i + 1} hinten`)),
    })

  const aufbau = () => {
    const sw = geraet('UniFi Switch', {
      inputs: [port('s1', '1'), port('s2', '2'), port('s3', '3'), port('s4', '4'), port('s5', '5')],
    })
    const pp = blende('PP-R-01', 2)
    const ptz = geraet('PTZ 1', { inputs: [port('k-lan', 'LAN')], ipAddress: '10.0.0.11', mgmtUrl: 'http://10.0.0.11' })
    const nas = geraet('NAS', {
      inputs: [port('n-a', 'LAN A'), port('n-b', 'LAN B')],
      ipAddress: '10.0.0.20',
      subnetMask: '255.255.255.0',
    })
    const encoder = geraet('Encoder', { inputs: [port('e-lan', 'LAN')] })
    const stagebox = geraet('Stagebox', { inputs: [port('sb-lan', 'LAN')], ipAddress: '10.0.1.9' })
    const pult = geraet('Pult', {
      networkInterfaces: [{ id: 'd', label: 'Dante', role: 'dante-primary', ipAddress: '10.0.1.5', subnetMask: '255.255.255.0', vlanId: 30, switchEquipmentId: sw.id, switchPort: '4' }],
    } as Partial<EquipmentItem>)
    const cables = [
      kabel('N-1', [ptz.id, 'k-lan'], [pp.id, 'PP-R-01-v1']),
      kabel('N-2', [pp.id, 'PP-R-01-h1'], [sw.id, 's1']),
      kabel('N-3', [nas.id, 'n-a'], [sw.id, 's2']),
      kabel('N-4', [nas.id, 'n-b'], [sw.id, 's3']),
      kabel('N-5', [encoder.id, 'e-lan'], [sw.id, 's5']),
      // Das Pult nennt an seiner Schnittstelle Port 4 — gesteckt ist dort die Stagebox.
      kabel('N-6', [stagebox.id, 'sb-lan'], [sw.id, 's4']),
    ]
    return projekt({ equipment: [sw, pp, ptz, nas, encoder, pult, stagebox], cables })
  }

  it('ordnet einen einzigen Kabel-Port der ersten Schnittstelle zu — durch die Blende hindurch', () => {
    const ptz = konfigVorgaben(aufbau()).filter((z) => z.geraet === 'PTZ 1')
    expect(ptz).toHaveLength(1)
    expect(ptz[0]).toMatchObject({ ip: '10.0.0.11', switchName: 'UniFi Switch', port: '1', via: ['PP-R-01'], quelle: 'kabel', web: 'http://10.0.0.11', befund: 'keine-maske' })
  })

  it('rät bei zwei Kabeln am Switch nicht, welche Buchse die Adresse trägt', () => {
    const nas = konfigVorgaben(aufbau()).filter((z) => z.geraet === 'NAS')
    expect(nas.map((z) => [z.ip, z.port])).toEqual([
      ['10.0.0.20', ''],
      ['', '2'],
      ['', '3'],
    ])
  })

  it('meldet ein Gerät am Switch ohne Adresse', () => {
    const enc = konfigVorgaben(aufbau()).find((z) => z.geraet === 'Encoder')!
    expect(enc).toMatchObject({ ip: '', port: '5', befund: 'keine-ip' })
  })

  it('nimmt die an der Schnittstelle eingetragene Belegung und schreibt kanonisch', () => {
    const t = konfigVorgabenTable(aufbau())
    const pult = t.rows.find((r) => r[0] === 'Pult')!
    expect(pult).toEqual([
      'Pult',
      'Dante',
      '10.0.1.5',
      '255.255.255.0',
      '',
      30,
      '',
      'UniFi Switch',
      '4',
      '',
      'Schnittstelle',
      '',
      'Kabel an diesem Port führt zu Stagebox',
    ])
    expect(t.rows.find((r) => r[0] === 'Encoder')![12]).toBe('keine IP-Adresse im Plan')
  })

  it('lässt Geräte ohne Netz weg', () => {
    expect(konfigVorgaben(aufbau()).some((z) => z.geraet === 'PP-R-01')).toBe(false)
  })
})

// ─── Steckbrief und Bedien-Kurzübersicht ───────────────────────────────────

const regie = () => {
  const cam = geraet('PTZ 1', {
    outputs: [port('c-sdi', 'SDI Out', 'BNC')],
    x: 20,
    y: 20,
    sourceIdentityId: 'r1',
    serialNumber: 'SN-1',
    serviceHistory: [
      { id: 'a', date: '2026-01-01', author: 'A', kind: 'install', summary: 'montiert' },
      { id: 'b', date: '2026-05-01', author: 'B', kind: 'repair', summary: 'Lüfter' },
    ],
  } as Partial<EquipmentItem>)
  const atem = geraet('ATEM Television Studio', {
    inputs: [port('a-in1', 'In 1', 'BNC'), port('a-in2', 'In 2', 'BNC')],
    outputs: [port('a-pgm', 'PGM Out', 'BNC')],
    x: 420,
    y: 20,
  })
  const pp = geraet('PP-Saal', {
    category: 'Patch panels',
    inputs: [port('pp-v1', '1', 'BNC')],
    outputs: [port('pp-h1', '1 hinten', 'BNC')],
    x: 440,
    y: 20,
  })
  const mon = geraet('Saalmonitor', { inputs: [port('m-in', 'SDI In', 'BNC')], x: 20, y: 120 })
  const locations: LocationFrame[] = [
    { id: 'saal', name: 'Saal', x: 0, y: 0, width: 300, height: 300, color: '#000', floor: 'EG' } as LocationFrame,
    { id: 'regie', name: 'Regie', x: 400, y: 0, width: 300, height: 300, color: '#000' } as LocationFrame,
  ]
  return projekt({
    metadata: { name: 'Haus', createdAt: '', updatedAt: '', serviceProvider: 'Service GmbH', emergencyContact: '+49 30 123' } as CablePlannerProject['metadata'],
    equipment: [cam, atem, pp, mon],
    cables: [
      kabel('V-1', [cam.id, 'c-sdi'], [atem.id, 'a-in2']),
      kabel('V-2', [atem.id, 'a-pgm'], [pp.id, 'pp-h1']),
      kabel('V-3', [pp.id, 'pp-v1'], [mon.id, 'm-in']),
    ],
    locations,
    sourceIdentities: [{ id: 'r1', name: 'Kamera 1' }],
  } as Partial<CablePlannerProject>)
}

describe('Steckbrief', () => {
  it('führt je Gerät Standort, Mischer-Eingang, Verbindungen und die Historie, jüngste zuerst', () => {
    const cam = steckbriefe(regie()).find((s) => s.name === 'PTZ 1')!
    expect(cam.standort).toBe('Saal (EG)')
    expect(cam.mischerEingaenge).toEqual([{ mischer: 'ATEM Television Studio', eingang: 2 }])
    expect(cam.verbindungen).toEqual([{ port: 'SDI Out', kabel: 'V-1', gegenstelle: 'ATEM Television Studio', gegenPort: 'In 2' }])
    expect(cam.service.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('nennt hinter einer Blende das Gerät, lässt aber die Blende als Gegenstelle stehen', () => {
    const atem = steckbriefe(regie()).find((s) => s.name === 'ATEM Television Studio')!
    expect(atem.verbindungen.find((v) => v.kabel === 'V-2')).toEqual({
      port: 'PGM Out',
      kabel: 'V-2',
      gegenstelle: 'PP-Saal',
      gegenPort: '1 hinten',
      dahinter: 'Saalmonitor · SDI In',
    })
    // Direkt verkabelt: kein „dahinter".
    expect(atem.verbindungen.find((v) => v.kabel === 'V-1')!.dahinter).toBeUndefined()
  })

  it('zeigt eine Lücke als Strich statt das Feld wegzulassen', () => {
    const html = steckbriefHtml(regie(), { titel: 'T' })
    expect((html.match(/<article class="karte">/g) ?? []).length).toBe(4)
    expect(html).toContain('<dt>Serial no.</dt><dd>SN-1</dd>')
    expect(html).toContain('<dt>Firmware</dt><dd>—</dd>')
    expect(html).toContain('ATEM Television Studio, input 2')
  })

  it('eine neue Service-Zeile veraltet den Steckbrief', () => {
    const a = regie()
    const b = regie()
    b.equipment[0] = { ...b.equipment[0], serviceHistory: [...(b.equipment[0].serviceHistory ?? []), { id: 'c', date: '2026-06-01', author: 'C', kind: 'note', summary: 'x' }] }
    expect(DOCUMENT_STANDS.steckbrief(b)).not.toBe(DOCUMENT_STANDS.steckbrief(a))
    expect(steckbriefStandTable(a).headers).toEqual(['Gerät', 'Feld', 'Wert'])
  })
})

describe('Bedien-Kurzübersicht', () => {
  it('nennt die Quelle mit ihrer Rolle und den Ausgang durch die Blende', () => {
    const u = bedienUebersicht(regie())
    expect(u.senken).toHaveLength(1)
    const s = u.senken[0]
    expect(s.art).toBe('mischer')
    expect(s.eingaenge).toEqual([{ eingang: 2, quelle: 'Kamera 1', geraet: 'PTZ 1', standort: 'Saal (EG)' }])
    expect(s.ausgaenge).toEqual([{ ausgang: 'PGM Out', ziel: 'Saalmonitor', zielPort: 'SDI In', standort: 'Saal (EG)', via: ['PP-Saal'] }])
  })

  it('erfindet keine Handgriffe und lässt Platz dafür', () => {
    const html = bedienUebersichtHtml(regie(), { titel: 'T' })
    expect(html).toContain('are not in the plan and are not made up here')
    expect(html).toContain('class="frei"')
    expect(html).toContain('Service GmbH')
    expect(html).toContain('+49 30 123')
  })
})

describe('Betriebs-Status als Text', () => {
  it('hat eine englische Quelle', () => {
    expect(installStatusText('fault', quelle)).toBe('Fault')
    expect(installStatusText('operational', quelle)).toBe('Operational')
  })
})

describe('Register', () => {
  it('führt alle sechs Blätter mit Namen und Stand', () => {
    for (const id of ['abnahmeprotokoll', 'maengelliste', 'wartungsplan', 'konfig-vorgaben', 'steckbrief', 'bedien-uebersicht']) {
      expect(DOCUMENT_LABELS[id], id).toBeTruthy()
      expect(DOCUMENT_STANDS[id](regie()), id).toMatch(/^[0-9a-f]{8}$/)
    }
  })
})
