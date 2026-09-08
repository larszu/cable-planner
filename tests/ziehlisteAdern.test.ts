import { describe, expect, it } from 'vitest'
import { buildPullListRows, pullListTable } from '../src/renderer/lib/installerLists'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'

// ---------------------------------------------------------------------------
// B-45 — die Farbe muss auf die ZIEHLISTE.
//
// „Und die Farbe ist keine Kosmetik. Sie ist die einzige Angabe, an der auf
// der Baustelle hängt, welcher Leiter wohin gehört. Ein vertauschter
// Aussenleiter dreht ein Drehfeld; ein als N gezogener Aussenleiter ist eine
// Gefahr." (Backlog B-45)
//
// Im Plan zu stehen reicht deshalb nicht: die Ziehliste ist das Blatt, das
// mitgeht.
// ---------------------------------------------------------------------------

const kabel = (over: Partial<Cable>): Cable => ({
  id: 'c1',
  name: 'L1',
  type: 'Powerlock',
  length: 25,
  color: '#000',
  fromEquipmentId: 'e1',
  fromPortId: 'p1',
  toEquipmentId: 'e2',
  toPortId: 'p2',
  notes: '',
  ...over,
})

const projekt = (over: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'P' },
    equipment: [],
    cables: [],
    locations: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
    ...over,
  }) as unknown as CablePlannerProject

describe('Die Ziehliste trägt Ader und Anschluss', () => {
  const p = projekt({
    farbnormen: [
      {
        id: 'n1',
        name: 'Hausstandard',
        herkunft: 'Vom Eigentümer festgelegt',
        farben: { L1: 'braun', N: 'blau' },
      },
    ],
    anschlussListe: [
      { id: 'b1', name: '400 A Bühne links', soll: ['L1', 'N'], farbnormId: 'n1' },
    ],
    cables: [
      kabel({ id: 'c1', anschlussId: 'b1', adern: [{ id: 'a1', rolle: 'L1' }] }),
      kabel({
        id: 'c2',
        anschlussId: 'b1',
        adern: [{ id: 'a2', rolle: 'N', farbe: 'hellblau', abweichungsgrund: 'Bestand' }],
      }),
      kabel({ id: 'c3' }),
    ],
  })

  it('die Farbe kommt aus der Norm des Anschlusses, wenn keine gesetzt ist', () => {
    const rows = buildPullListRows(p)
    expect(rows[0].adern).toBe('L1 (braun)')
    expect(rows[0].anschluss).toBe('400 A Bühne links')
  })

  it('eine gesetzte Farbe schlägt die Norm — auf dem Blatt steht, was gezogen wird', () => {
    const rows = buildPullListRows(p)
    expect(rows[1].adern).toBe('N (hellblau)')
  })

  it('eine Leitung ohne Adern bleibt leer und erfindet nichts', () => {
    const rows = buildPullListRows(p)
    expect(rows[2].adern).toBe('')
    expect(rows[2].anschluss).toBe('')
  })

  it('die Spalten stehen wirklich in der Tabelle', () => {
    // Sonst waere die Zeile oben eine Zeile, die niemand sieht.
    const { headers, rows } = pullListTable(p)
    expect(headers).toContain('Adern')
    expect(headers).toContain('Bündel')
    expect(rows[0]).toContain('L1 (braun)')
  })

  it('ohne gewählte Norm steht die Rolle ohne erfundene Farbe da', () => {
    const ohneNorm = projekt({
      anschlussListe: [{ id: 'b1', name: 'X', soll: ['L1'] }],
      cables: [kabel({ id: 'c1', anschlussId: 'b1', adern: [{ id: 'a1', rolle: 'L1' }] })],
    })
    expect(buildPullListRows(ohneNorm)[0].adern).toBe('L1')
  })
})
