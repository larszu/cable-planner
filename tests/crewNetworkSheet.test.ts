import { describe, expect, it } from 'vitest'
import {
  CREW_ORIGIN_LABEL,
  CREW_SECTION_LABEL,
  buildCrewSheet,
  crewSheetTable,
} from '../src/renderer/lib/crewNetworkSheet'
import { DOCUMENT_LABELS, DOCUMENT_STANDS } from '../src/renderer/lib/documentRegistry'
import type { CablePlannerProject } from '../src/renderer/types/project'
import analyseQuelle from '../src/renderer/components/Analysis/AnalysisDialog.tsx?raw'

// ---------------------------------------------------------------------------
// Das Netz-Merkblatt fuer die Crew (Bedarf 77, P2).
//
//   > On large productions the architecture is irrelevant unless the crew can
//   > use it: FOX's World Cup build required that „all the hundreds of
//   > freelancers and staff members understand how to access the network and
//   > prevent problems". There is no standard artefact; today it is a verbal
//   > briefing plus a WhatsApp message.
//
// Der Unterschied zur Nachricht liegt nicht im Inhalt, sondern im STAND: ein
// Blatt mit Bezeichner laesst sich mit „gilt das noch?" pruefen, eine
// Nachricht nicht.
// ---------------------------------------------------------------------------

const projekt = (over: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Show', description: '', createdAt: '', updatedAt: '' },
    equipment: [],
    cables: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
    ...over,
  }) as unknown as CablePlannerProject

const geraet = (
  id: string,
  name: string,
  nics: Array<Record<string, unknown>> = [],
) =>
  ({
    id,
    name,
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    category: 'Netzwerk',
    inputs: [],
    outputs: [],
    networkInterfaces: nics.map((n, i) => ({ id: `${id}#n${i + 1}`, role: 'media-primary', ...n })),
  }) as never

const abschnitt = (p: CablePlannerProject, key: string) =>
  buildCrewSheet(p).sections.find((s) => s.key === key)!

describe('Bedarf 77 — was der Plan weiss, steht drauf', () => {
  it('nennt die VLANs mit Anzahl und Beispielen', () => {
    const p = projekt({
      equipment: [
        geraet('a', 'Kamera 1', [{ vlanId: 30, ipAddress: '10.30.0.1' }]),
        geraet('b', 'Kamera 2', [{ vlanId: 30, ipAddress: '10.30.0.2' }]),
        geraet('c', 'Stagebox', [{ vlanId: 10, ipAddress: '10.10.0.1' }]),
      ],
    })
    const zeilen = abschnitt(p, 'netze').lines.filter((l) => l.key.startsWith('vlan-'))
    expect(zeilen.map((l) => l.key)).toEqual(['vlan-10', 'vlan-30'])
    expect(zeilen[1].text).toContain('2 Geraete')
    expect(zeilen[1].text).toContain('Kamera 1')
  })

  it('nennt die belegten Subnetze als reserviert', () => {
    const p = projekt({
      equipment: [geraet('a', 'A', [{ ipAddress: '10.30.0.5', subnetMask: '255.255.255.0' }])],
    })
    const zeilen = abschnitt(p, 'reserviert').lines
    expect(zeilen.some((l) => l.text.includes('10.30.0.0/24'))).toBe(true)
  })

  it('nennt je Switch die Belegung — der freie Port ist die Gefahr', () => {
    const p = projekt({
      equipment: [
        {
          id: 'sw',
          name: 'Core-Switch',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          category: 'Netzwerk',
          deviceTypeId: 'switch',
          inputs: [
            { id: 'p1', name: '1/0/1' },
            { id: 'p2', name: '1/0/2' },
          ],
          outputs: [],
        } as never,
        geraet('a', 'Kamera', [
          { ipAddress: '10.0.0.5', switchEquipmentId: 'sw', switchPort: '1/0/1' },
        ]),
      ],
    })
    const zeilen = abschnitt(p, 'ports').lines
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0].text).toContain('Core-Switch')
    expect(zeilen[0].text).toContain('1 von 2')
    // Der Satz, um den es geht: ein freier Port sieht aus wie eine Einladung.
    expect(zeilen[0].text).toContain('nicht freigegeben')
  })

  it('nennt Notfall- und Dienstleister-Kontakt', () => {
    const p = projekt({
      metadata: {
        name: 'Show',
        description: '',
        createdAt: '',
        updatedAt: '',
        emergencyContact: '0170 1234567',
        serviceProvider: 'Haus-IT, Herr Meier',
      } as never,
    })
    const zeilen = abschnitt(p, 'kontakt').lines
    expect(zeilen.map((l) => l.text)).toEqual(['0170 1234567', 'Haus-IT, Herr Meier'])
  })
})

describe('Bedarf 77 — was der Plan NICHT weiss, steht als Frage drauf', () => {
  // Die eine Regel, die den Inhalt bestimmt. Eine leere Zeile liest sich wie
  // „gibt es nicht", und dann steckt jemand ein Kabel.

  it('die SSID ist immer eine Frage — der Plan hat kein Feld dafuer', () => {
    const zeile = abschnitt(projekt(), 'netze').lines.find((l) => l.key === 'ssid')
    expect(zeile?.origin).toBe('ask')
    expect(zeile?.text).toContain('vor Ort')
  })

  it('ohne Subnetz steht eine Frage statt einer leeren Liste', () => {
    const zeilen = abschnitt(projekt(), 'reserviert').lines
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0].origin).toBe('ask')
  })

  it('ohne Kontakt steht, dass keiner hinterlegt ist', () => {
    // Ein Merkblatt ohne Telefonnummer ist der Zettel, den jemand am Freitag
    // um 23 Uhr in der Hand haelt und wegwirft.
    const zeilen = abschnitt(projekt(), 'kontakt').lines
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0].origin).toBe('ask')
  })

  it('zaehlt die offenen Punkte', () => {
    // Leeres Projekt: SSID, kein Subnetz, kein Kontakt.
    expect(buildCrewSheet(projekt()).askCount).toBe(3)
  })

  it('zaehlt weniger, sobald der Plan antwortet', () => {
    const p = projekt({
      equipment: [geraet('a', 'A', [{ ipAddress: '10.30.0.5', subnetMask: '255.255.255.0' }])],
      metadata: {
        name: 'S',
        description: '',
        createdAt: '',
        updatedAt: '',
        emergencyContact: '0170',
      } as never,
    })
    expect(buildCrewSheet(p).askCount).toBe(1)
  })
})

describe('Bedarf 77 — was das Haus gesagt hat, gehoert auf das Blatt', () => {
  const mitAntwort = (status: string, note?: string) =>
    projekt({
      equipment: [geraet('a', 'A', [{ ipAddress: '10.0.0.1', subnetMask: '255.255.255.0' }])],
      metadata: {
        name: 'S',
        description: '',
        createdAt: '',
        updatedAt: '',
        venueAnswers: [{ key: 'dhcp', status, ...(note ? { note } : {}) }],
      } as never,
    })

  it('traegt eine Absage mit dem Umweg', () => {
    const zeilen = abschnitt(mitAntwort('refused', 'eigener Router mitgebracht'), 'haus').lines
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0].origin).toBe('venue')
    expect(zeilen[0].text).toContain('abgelehnt')
    expect(zeilen[0].text).toContain('eigener Router')
  })

  it('traegt eine Auflage — und sagt, wenn sie niemand notiert hat', () => {
    expect(abschnitt(mitAntwort('partial', 'nur 80/443'), 'haus').lines[0].text).toContain(
      'nur 80/443',
    )
    expect(abschnitt(mitAntwort('partial'), 'haus').lines[0].text).toContain('nicht notiert')
  })

  it('traegt eine GENEHMIGUNG nicht — die Crew muss nur die Grenzen kennen', () => {
    // Ein Merkblatt, das auch alles Erlaubte auffuehrt, ist kein Merkblatt.
    expect(abschnitt(mitAntwort('granted'), 'haus').lines).toHaveLength(0)
  })

  it('traegt eine unbeantwortete Frage nicht', () => {
    expect(abschnitt(mitAntwort('pending'), 'haus').lines).toHaveLength(0)
  })
})

describe('Bedarf 77 — es ist ein Dokument und keine Nachricht', () => {
  it('steht im Register mit Stand und Beschriftung', () => {
    expect(typeof DOCUMENT_STANDS['crew-netz']).toBe('function')
    expect(DOCUMENT_LABELS['crew-netz']).toBe('Netz-Merkblatt (Crew)')
  })

  it('der Stand aendert sich, wenn sich der Inhalt aendert', () => {
    const leer = projekt()
    const voll = projekt({
      equipment: [geraet('a', 'A', [{ vlanId: 30, ipAddress: '10.30.0.1', subnetMask: '255.255.255.0' }])],
    })
    expect(DOCUMENT_STANDS['crew-netz'](leer)).not.toBe(DOCUMENT_STANDS['crew-netz'](voll))
  })

  it('der Stand bleibt gleich, wenn sich nichts aendert', () => {
    const p = projekt({ equipment: [geraet('a', 'A', [{ vlanId: 30 }])] })
    expect(DOCUMENT_STANDS['crew-netz'](p)).toBe(DOCUMENT_STANDS['crew-netz'](projekt({ equipment: [geraet('a', 'A', [{ vlanId: 30 }])] })))
  })

  it('das Blatt traegt kanonisches Deutsch, nicht die Anzeigesprache', () => {
    // ADR-004: der Stand haengt am Inhalt, also darf der Inhalt nicht an der
    // Sprache haengen. Sonst meldete dasselbe Blatt auf Englisch einen
    // anderen Stand.
    const tab = crewSheetTable(buildCrewSheet(projekt()))
    expect(tab.headers).toEqual(['Abschnitt', 'Herkunft', 'Was gilt'])
    expect(tab.rows.some((r) => r[0] === CREW_SECTION_LABEL.netze)).toBe(true)
    expect(tab.rows.some((r) => r[1] === CREW_ORIGIN_LABEL.ask)).toBe(true)
  })
})

describe('Bedarf 77 — das Blatt nennt die Regeln, nicht den Bestand', () => {
  it('fuehrt keine Geraete-Adressen auf', () => {
    // Dafuer gibt es das Rack-Tuer-Blatt (Bedarf 22). Sie hier zu wiederholen
    // waere die zweite Wahrheit, und ein Merkblatt mit zweihundert Zeilen
    // liest niemand.
    const p = projekt({
      equipment: [
        geraet('a', 'Kamera 1', [{ ipAddress: '10.30.0.77', subnetMask: '255.255.255.0' }]),
      ],
    })
    const alles = crewSheetTable(buildCrewSheet(p)).rows.flat().map(String).join(' ')
    expect(alles).not.toContain('10.30.0.77')
    expect(alles).toContain('10.30.0.0/24')
  })

  it('bleibt bei vielen Geraeten kurz', () => {
    const viele = Array.from({ length: 40 }, (_, i) =>
      geraet(`d${i}`, `Geraet ${i}`, [{ vlanId: 30, ipAddress: `10.30.0.${i + 1}` }]),
    )
    const zeile = abschnitt(projekt({ equipment: viele }), 'netze').lines[0]
    // Drei Beispiele, nicht vierzig.
    expect(zeile.text.split(',').length).toBeLessThanOrEqual(4)
  })
})

describe('Bedarf 77 — verdrahtet', () => {
  it('der Netz-Tab baut das Blatt und exportiert es', () => {
    expect(analyseQuelle).toMatch(/buildCrewSheet\(projekt\)/)
    expect(analyseQuelle).toMatch(/csvFromTable\(crewSheetTable\(crew\)\)/)
  })

  it('die offenen Punkte stehen in der Ansicht', () => {
    expect(analyseQuelle).toContain('crew.askCount')
  })
})
