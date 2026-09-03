import { describe, expect, it } from 'vitest'
import { exportStagePlotSvg } from '../src/renderer/lib/exportStagePlot'
import exportDialogSrc from '../src/renderer/components/Export/ExportDialog.tsx?raw'
import dictsSrc from '../src/renderer/lib/i18n/dicts.ts?raw'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'

// ADR-005, Inkrement 4, Regel 4 — der Stage-Plot behauptete Audio, wo keins war.
//
// Der Export sammelt die Endpunkte aller Audio-Layer-Kabel. Findet er keine,
// faellt er auf ALLE Geraete des Plans zurueck — das ist als Positions-
// Uebersicht durchaus nuetzlich und bleibt so. Die Unterzeile lief dabei
// unveraendert weiter und schrieb „N Audio-Quellen/-Ziele".
//
// Ein Video-Plan ohne ein einziges Audio-Kabel erzeugte damit ein Blatt, das
// Kameras, Mischer und Router als Audio-Quellen ausweist — und das Blatt geht
// an die Halle.

const eq = (id: string, name: string, x: number, y: number): EquipmentItem =>
  ({
    id,
    name,
    category: 'Sonstiges',
    inputs: [{ id: `${id}-in`, name: 'IN 1', type: 'port', connectorType: 'XLR' }],
    outputs: [{ id: `${id}-out`, name: 'OUT 1', type: 'port', connectorType: 'XLR' }],
    x,
    y,
    width: 240,
    height: 80,
  }) as unknown as EquipmentItem

const cable = (from: string, to: string, layer: string): Cable =>
  ({
    id: `${from}->${to}`,
    name: `${from}->${to}`,
    type: 'XLR',
    length: 10,
    color: '#fff',
    layer,
    fromEquipmentId: from,
    fromPortId: `${from}-out`,
    toEquipmentId: to,
    toPortId: `${to}-in`,
    notes: '',
  }) as unknown as Cable

const project = (equipment: EquipmentItem[], cables: Cable[]): CablePlannerProject =>
  ({
    metadata: { name: 'Halle 7' },
    equipment,
    cables,
    canvasState: { x: 0, y: 0, zoom: 1 },
  }) as unknown as CablePlannerProject

describe('exportStagePlotSvg — was die Unterzeile behauptet', () => {
  it('nennt Audio-Quellen, wenn es Audio-Kabel gibt', () => {
    const svg = exportStagePlotSvg(
      project(
        [eq('mic', 'SM58', 0, 0), eq('pult', 'X32', 400, 0), eq('cam', 'URSA', 800, 0)],
        [cable('mic', 'pult', 'audio')],
      ),
    )
    // Nur die beiden Audio-Endpunkte, und sie heissen zu Recht so.
    expect(svg).toContain('2 Audio-Quellen/-Ziele')
    expect(svg).toContain('SM58')
    expect(svg).toContain('X32')
    expect(svg).not.toContain('URSA')
  })

  it('behauptet ohne Audio-Kabel KEIN Audio mehr — und sagt, warum alle da sind', () => {
    const svg = exportStagePlotSvg(
      project(
        [eq('cam', 'URSA', 0, 0), eq('atem', 'ATEM', 400, 0)],
        [cable('cam', 'atem', 'video')],
      ),
    )
    expect(svg).not.toContain('Audio-Quellen/-Ziele')
    expect(svg).toContain('2 Geräte — kein Audio-Kabel im Plan, daher alle')
  })

  it('faellt weiterhin auf alle Geraete zurueck — die Uebersicht bleibt nuetzlich', () => {
    // Der Rueckfall ist Absicht und soll bleiben; falsch war nur die
    // Beschriftung. Deshalb hier ausdruecklich festgehalten.
    const svg = exportStagePlotSvg(
      project(
        [eq('cam', 'URSA', 0, 0), eq('atem', 'ATEM', 400, 0)],
        [cable('cam', 'atem', 'video')],
      ),
    )
    expect(svg).toContain('URSA')
    expect(svg).toContain('ATEM')
  })

  it('kommt mit einem leeren Plan klar', () => {
    const svg = exportStagePlotSvg(project([], []))
    expect(svg).toContain('<svg')
    expect(svg).toContain('0 Geräte — kein Audio-Kabel im Plan, daher alle')
  })
})

// Zweiter Fund derselben Flaeche und derselben Klasse (Regel 4): der
// Vektor-PDF-Hinweis nannte nur Vorteile. Der Vektor-Pfad klont das
// Canvas-DOM und druckt es via Chromium — einen Titelblock baut er nicht.
// Revision, Stand-Fingerprint und QR, die der Raster-Pfad mit jsPDF zeichnet,
// fehlen im Vektor-PDF also. Wer zwischen zwei Wegen waehlt, muss beide
// Seiten kennen; der Hinweis ist genau die Stelle, an der gewaehlt wird.
//
// Den Titelblock im Vektor-Pfad NACHZUBAUEN waere ein Feature, kein
// Melde-Fix — deshalb hier nur die Zusage geradegerueckt.
describe('der Vektor-PDF-Hinweis nennt auch, was fehlt', () => {
  it('sagt im deutschen Fallback, dass der Titelblock fehlt', () => {
    expect(exportDialogSrc).toContain('Ohne Titelblock')
    expect(exportDialogSrc).toContain('Stand-Fingerprint')
  })

  it('sagt es auch auf Englisch', () => {
    expect(dictsSrc).toContain('No title block')
    expect(dictsSrc).toContain('state fingerprint')
  })
})
