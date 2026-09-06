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

// ---------------------------------------------------------------------------
// Bedarf 38 — der Plot als EIN-SEITEN-LIEFERUNG.
//
// Der Markt-Standard fuer dieses Blatt ist gestorben: StagePlotPro gilt als
// „highly regarded", aber „the official purchase channels have been
// discontinued". Die Folge steht als Zaehlung im Dossier: 21 unabhaengige
// Repositories namens „stageplot" auf GitHub. Und: „Promoters expect a
// drawing, not a text field."
//
// Die Bedarfs-Datenbank verlangt mehr als ein Bild:
//
//   > Stage plot as a first-class, offline, one-page deliverable that ALSO
//   > GENERATES the input list and monitor mix list FROM THE SAME OBJECTS.
//
// Geprueft wird deshalb genau die Verbindung: dass die Nummer im Plot die
// KANALNUMMER ist und nicht eine zweite Zaehlung daneben. Zwei verschiedene
// Nummern fuer dasselbe Mikrofon auf einem Blatt sind schlimmer als keine --
// der Techniker liest „3", sucht Kanal 3 auf der Stagebox und findet ein
// anderes Geraet.
// ---------------------------------------------------------------------------
describe('Bedarf 38 — Zeichnung und Liste auf einem Blatt', () => {
  const mitKanaelen = () => {
    // Absichtlich so gelegt, dass die Canvas-Reihenfolge (oben nach unten)
    // der Absteck-Reihenfolge (Ziel-Port) WIDERSPRICHT: das Mikro auf Port 2
    // liegt oben. Nummerierte der Plot nach Position, stuende dort „1".
    const mic1 = eq('mic1', 'SM58 Vox', 0, 0)
    const mic2 = eq('mic2', 'DI Bass', 0, 400)
    const box = {
      ...eq('box', 'Stagebox A', 600, 200),
      inputs: [
        { id: 'box-1', name: '1', type: 'port', connectorType: 'XLR' },
        { id: 'box-2', name: '2', type: 'port', connectorType: 'XLR' },
      ],
    } as unknown as EquipmentItem
    const c1 = { ...cable('mic1', 'box', 'audio'), toPortId: 'box-2' } as unknown as Cable
    const c2 = { ...cable('mic2', 'box', 'audio'), toPortId: 'box-1' } as unknown as Cable
    return project([mic1, mic2, box], [c1, c2])
  }

  it('nummeriert nach KANAL und nicht nach Position', () => {
    const svg = exportStagePlotSvg(mitKanaelen())
    // „DI Bass" haengt auf Stagebox-Port 1 und ist damit Kanal 1 — obwohl es
    // im Canvas UNTEN liegt.
    const kreise = [...svg.matchAll(/font-weight="700" text-anchor="middle">(\d+)</g)].map((m) => m[1])
    expect(kreise.sort()).toEqual(['1', '2'])
    // Und die Zuordnung stimmt: die Nummer neben „DI Bass" ist die 1.
    const diY = 400
    const beiDi = svg.split('\n').filter((l) => l.includes(`y="${diY + 21}"`))
    expect(beiDi.some((l) => l.includes('>1<'))).toBe(true)
  })

  it('gibt einem Ziel-Geraet KEINE Nummer', () => {
    // Die Stagebox ist Ziel und nicht Quelle. Eine Nummer an ihr waere eine
    // Behauptung ueber die Patchliste.
    const svg = exportStagePlotSvg(mitKanaelen())
    const beiBox = svg.split('\n').filter((l) => l.includes('Stagebox A'))
    expect(beiBox.some((l) => l.includes('circle'))).toBe(false)
  })

  it('traegt die Eingangsliste auf DEMSELBEN Blatt', () => {
    // Ein zweites Blatt waere genau die Trennung, an der der Bedarf haengt:
    // das Bild geht an den Promoter, die Liste an den Tontechniker, und beide
    // veralten getrennt.
    const svg = exportStagePlotSvg(mitKanaelen())
    expect(svg).toContain('Eingangsliste')
    expect(svg).toContain('1. DI Bass')
    expect(svg).toContain('2. SM58 Vox')
  })

  it('macht das Blatt breit genug fuer die Legende', () => {
    // Sonst steht sie ausserhalb des viewBox und ist auf dem Ausdruck weg.
    const svg = exportStagePlotSvg(mitKanaelen())
    const vb = svg.match(/viewBox="(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/)
    expect(vb).toBeTruthy()
    const [, vx, , vw] = vb!.map(Number)
    // Der Legenden-Text beginnt bei maxX + pad = 600 + 240 + 60.
    expect(vx + vw).toBeGreaterThan(900)
  })

  it('haengt die Monitor-Wege an, wenn es welche gibt', () => {
    const pult = eq('pult', 'Monitorpult', 0, 800)
    const wedge = eq('wedge', 'Wedge SL', 600, 800)
    const p = project(
      [...mitKanaelen().equipment, pult, wedge],
      [...mitKanaelen().cables, cable('pult', 'wedge', 'audio')],
    )
    const svg = exportStagePlotSvg(p)
    expect(svg).toContain('Monitor-Wege')
    expect(svg).toContain('Wedge SL')
  })

  it('laesst den Monitor-Block weg, wenn es keine gibt', () => {
    // Eine leere Ueberschrift ist ein Versprechen ohne Inhalt.
    expect(exportStagePlotSvg(mitKanaelen())).not.toContain('Monitor-Wege')
  })
})
