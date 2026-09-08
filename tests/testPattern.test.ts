import { describe, expect, it } from 'vitest'
import { testPatternDataUri, testPatternSvg } from '../src/renderer/lib/testPattern'
import {
  LEERES_ROUTING,
  patternPruefzeilen,
  patternRouting,
  zielGeraete,
} from '../src/renderer/lib/patternRouting'
import patternStoreSrc from '../src/renderer/store/patternStore.ts?raw'
import equipmentNodeSrc from '../src/renderer/components/Canvas/EquipmentNode.tsx?raw'
import toolbarSrc from '../src/renderer/components/Canvas/CanvasToolbar.tsx?raw'
import chipSrc from '../src/renderer/components/Canvas/PatternChip.tsx?raw'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Ein Pruefbild, das seinen Namen traegt — und die Frage „wo kommt es an".
//
// DIE PRUEFUNG, an der sich die Bauform entscheidet, ist die VERTAUSCHTE
// KREUZSCHIENE. Zwei vertauschte Kreuzpunkte sehen mit reinen Farbbalken auf
// beiden Wegen voellig richtig aus; erst der NAME auf dem Bild macht daraus
// einen Befund. Deshalb steht hier zuerst, dass der Name im Bild vorkommt,
// und danach, dass die Wege dem GEPLANTEN Kreuzpunkt folgen.
//
// Was hier NICHT geprueft wird, weil es die App nicht kann: was wirklich auf
// dem Monitor steht. Sie hat keinen Videoeingang.
// ───────────────────────────────────────────────────────────────────────────

const port = (id: string): Port =>
  ({ id, name: id, type: 'video', connectorType: 'bnc' }) as unknown as Port

const eq = (id: string, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id,
    name: id,
    category: 'Video',
    x: 0,
    y: 0,
    inputs: [],
    outputs: [],
    ...over,
  }) as unknown as EquipmentItem

const kabel = (id: string, from: [string, string], to: [string, string]): Cable =>
  ({
    id,
    fromEquipmentId: from[0],
    fromPortId: from[1],
    toEquipmentId: to[0],
    toPortId: to[1],
  }) as unknown as Cable

const projekt = (equipment: EquipmentItem[], cables: Cable[]): CablePlannerProject =>
  ({
    metadata: { name: 'Test', description: '', createdAt: '', updatedAt: '' },
    equipment,
    cables,
    canvasState: { x: 0, y: 0, zoom: 1 },
  }) as unknown as CablePlannerProject

/**
 * Kamera 1 und Kamera 2 auf eine Kreuzschiene, dahinter zwei Monitore.
 * Kreuzpunkt: Ausgang 0 <- Eingang 0, Ausgang 1 <- Eingang 1.
 */
const anlage = (routing: Record<number, number>) =>
  projekt(
    [
      eq('cam1', { name: 'Kamera 1', outputs: [port('c1out')] }),
      eq('cam2', { name: 'Kamera 2', outputs: [port('c2out')] }),
      eq('hub', {
        // Der Name entscheidet hier NICHT allein — `detectDeviceKind` prueft
        // ihn, und diese Anlage soll ueber denselben Weg laufen wie in der
        // App. Deshalb heisst das Geraet wie ein Videohub.
        name: 'Smart Videohub 12x12',
        inputs: [port('hin0'), port('hin1')],
        outputs: [port('hout0'), port('hout1')],
        videohubRouting: { planned: routing, salvos: [] },
      }),
      eq('mon1', { name: 'Monitor Regie', inputs: [port('m1in')] }),
      eq('mon2', { name: 'Monitor Buehne', inputs: [port('m2in')] }),
    ],
    [
      kabel('k1', ['cam1', 'c1out'], ['hub', 'hin0']),
      kabel('k2', ['cam2', 'c2out'], ['hub', 'hin1']),
      kabel('k3', ['hub', 'hout0'], ['mon1', 'm1in']),
      kabel('k4', ['hub', 'hout1'], ['mon2', 'm2in']),
    ],
  )

describe('Das Bild traegt den Namen der Quelle', () => {
  it('der Name steht SICHTBAR im Bild', () => {
    const svg = testPatternSvg({ name: 'KAMERA 1' })
    // In einem <text>-Knoten, nicht bloss irgendwo. Beim ersten Anlauf stand
    // hier `toContain('KAMERA 1')` — und das war vom `aria-label` am <svg>
    // zu haben: die Gegenprobe „der Name faellt aus dem Bild" kam gruen
    // zurueck, obwohl auf dem Monitor nur noch Balken gestanden haetten.
    // Genau der Name ist aber der ganze Zweck des Bildes.
    expect(svg).toMatch(/<text[^>]*>KAMERA 1<\/text>/)
  })

  it('und auch als Textalternative, fuer die Vorlesefunktion', () => {
    expect(testPatternSvg({ name: 'KAMERA 1' })).toMatch(/aria-label="KAMERA 1"/)
  })

  it('Sonderzeichen im Namen brechen das Bild nicht auf', () => {
    // Ein Geraetename darf alles enthalten; ein `<` im Namen darf keinen
    // Knoten aufmachen. Das Bild geht per data:-URI in ein <img>, und ein
    // kaputtes SVG zeigt gar nichts — also faende jemand einen leeren
    // Monitor und suchte am falschen Ende.
    const svg = testPatternSvg({ name: 'A <b>&"1"' })
    expect(svg).toContain('A &lt;b&gt;&amp;&quot;1&quot;')
    expect(svg).not.toContain('<b>')
  })

  it('die drei Zeilen sind da, wenn sie mitgegeben werden', () => {
    const svg = testPatternSvg({ name: 'CAM1', zeile2: 'SDI OUT 1', zeile3: 'Halle A · 4f2a19bd' })
    expect(svg).toContain('SDI OUT 1')
    expect(svg).toContain('Halle A · 4f2a19bd')
  })

  it('ohne die Zusatzzeilen bleiben sie ganz weg', () => {
    // Ein leeres Textfeld auf dem Bild sieht aus wie ein Fehler in der
    // Beschriftung — und genau danach sucht dann jemand.
    const svg = testPatternSvg({ name: 'CAM1' })
    expect(svg.match(/<text/g)?.length).toBe(1)
  })

  it('das Bild ist ein gueltiges SVG mit den drei Balkenreihen', () => {
    const svg = testPatternSvg({ name: 'CAM1', breite: 640 })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    // 7 oben + 7 Mitte + 8 unten + 1 Hintergrund + 1 Namensfeld
    expect(svg.match(/<rect/g)?.length).toBe(24)
    expect(svg).toContain('width="640"')
    expect(svg).toContain('height="360"')
  })

  it('als data:-URI verwendbar', () => {
    const uri = testPatternDataUri({ name: 'CAM1' })
    expect(uri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    expect(decodeURIComponent(uri.split(',')[1])).toContain('CAM1')
  })
})

describe('Wo das Bild ankommen muesste', () => {
  it('folgt dem geplanten Kreuzpunkt', () => {
    const r = patternRouting(anlage({ 0: 0, 1: 1 }), 'cam1')
    expect(r.ziele.map((z) => z.equipmentName)).toEqual(['Monitor Regie'])
  })

  it('VERTAUSCHTE KREUZPUNKTE fuehren woandershin — und das ist der Zweck', () => {
    // Das ist der Fall, um den es geht. Mit reinen Farbbalken saehen beide
    // Monitore richtig aus; mit dem Namen auf dem Bild faellt es auf, und
    // diese Zeile sagt, welchen Monitor der Plan erwartet haette.
    const r = patternRouting(anlage({ 0: 1, 1: 0 }), 'cam1')
    expect(r.ziele.map((z) => z.equipmentName)).toEqual(['Monitor Buehne'])
  })

  it('ohne Quelle wird nichts behauptet', () => {
    expect(patternRouting(anlage({ 0: 0 }), undefined)).toEqual(LEERES_ROUTING)
  })

  it('eine direkte Verbindung ist ein Ankunftsort wie jeder andere', () => {
    // Die Mehr-Ebenen-Ansicht laesst direkte Wege bewusst weg. Hier waere das
    // eine Luecke genau dort, wo am wenigsten schiefgehen kann und deshalb
    // niemand nachsieht.
    const p = projekt(
      [
        eq('cam1', { name: 'Kamera 1', outputs: [port('c1out')] }),
        eq('mon', { name: 'Monitor', inputs: [port('min')] }),
      ],
      [kabel('k', ['cam1', 'c1out'], ['mon', 'min'])],
    )
    expect(patternRouting(p, 'cam1').ziele.map((z) => z.equipmentName)).toEqual(['Monitor'])
  })

  it('ein Verteiler bringt es an mehrere Orte', () => {
    const p = projekt(
      [
        eq('cam1', { name: 'Kamera 1', outputs: [port('c1out')] }),
        eq('da', {
          name: 'Verteiler',
          isDistributionAmp: true,
          inputs: [port('dain')],
          outputs: [port('da1'), port('da2')],
        }),
        eq('mon1', { name: 'Monitor A', inputs: [port('m1')] }),
        eq('mon2', { name: 'Monitor B', inputs: [port('m2')] }),
      ],
      [
        kabel('k1', ['cam1', 'c1out'], ['da', 'dain']),
        kabel('k2', ['da', 'da1'], ['mon1', 'm1']),
        kabel('k3', ['da', 'da2'], ['mon2', 'm2']),
      ],
    )
    const namen = patternRouting(p, 'cam1').ziele.map((z) => z.equipmentName).sort()
    expect(namen).toEqual(['Monitor A', 'Monitor B'])
  })

  it('ein Weg, den der Plan nicht zu Ende kennt, wird GENANNT statt weggelassen', () => {
    // Genau dort steht der Monitor, an dem spaeter niemand versteht, warum
    // kein Bild kommt. Eine kurze Liste, die vollstaendig aussieht, ist bei
    // einer Inbetriebnahme die teurere Auskunft.
    const p = projekt(
      [
        eq('cam1', { name: 'Kamera 1', outputs: [port('c1out')] }),
        eq('hub', {
          name: 'Smart Videohub 12x12',
          inputs: [port('hin0')],
          outputs: [port('hout0')],
          videohubRouting: { planned: {}, salvos: [] },
        }),
      ],
      [kabel('k1', ['cam1', 'c1out'], ['hub', 'hin0'])],
    )
    const r = patternRouting(p, 'cam1')
    expect(r.ziele).toEqual([])
    expect(r.offen).toHaveLength(1)
    expect(r.offen[0].end).toBe('mehrdeutig')
    expect(r.offen[0].endNote).toContain('Kreuzpunkt')
  })

  it('das Pruefblatt fuehrt die offenen Wege mit ihrem Grund', () => {
    const p = projekt(
      [
        eq('cam1', { name: 'Kamera 1', outputs: [port('c1out'), port('c1out2')] }),
        eq('mon', { name: 'Monitor', inputs: [port('min')] }),
        eq('hub', {
          name: 'Smart Videohub 12x12',
          inputs: [port('hin0')],
          outputs: [port('hout0')],
          videohubRouting: { planned: {}, salvos: [] },
        }),
      ],
      [
        kabel('k1', ['cam1', 'c1out'], ['mon', 'min']),
        kabel('k2', ['cam1', 'c1out2'], ['hub', 'hin0']),
      ],
    )
    const zeilen = patternPruefzeilen(patternRouting(p, 'cam1'))
    expect(zeilen).toHaveLength(2)
    expect(zeilen.find((z) => z.geraet === 'Monitor')?.hinweis).toBe('')
    expect(zeilen.find((z) => z.geraet === 'Smart Videohub 12x12')?.hinweis).toContain('Kreuzpunkt')
  })

  it('nennt die Geraete, an denen ein Weg endet', () => {
    expect([...zielGeraete(patternRouting(anlage({ 0: 0, 1: 1 }), 'cam1'))]).toEqual(['mon1'])
  })

  it('rechnet ohne das Projekt anzufassen', () => {
    const p = anlage({ 0: 0, 1: 1 })
    const kopie = JSON.parse(JSON.stringify(p)) as CablePlannerProject
    patternRouting(p, 'cam1')
    expect(p).toEqual(kopie)
  })
})

/** Kommentarzeilen weg: ein Waechter, der Prosa liest, ist von einem Satz zu haben. */
const ohneKommentare = (src: string): string =>
  src
    .split('\n')
    .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
    .join('\n')

describe('Die gewaehlte Quelle liegt nicht im Projekt', () => {
  it('der Store wird nicht persistiert', () => {
    const store = ohneKommentare(patternStoreSrc)
    expect(store).not.toMatch(/localStorage/)
    expect(store).not.toMatch(/persist\(/)
  })

  it('die Wahl geht nicht durch den projectStore', () => {
    // Waere sie dort, liefe jede Umschaltung durch Undo/Redo, durch die
    // Autospeicherung und in die Projektdatei.
    expect(ohneKommentare(chipSrc)).toMatch(/usePatternStore\(\(s\) => s\.waehle\)/)
    expect(ohneKommentare(chipSrc)).not.toMatch(/updateEquipment|setProject/)
  })
})

describe('Das Feld am Knoten sagt, dass es eine Erwartung ist', () => {
  const node = ohneKommentare(equipmentNodeSrc)

  it('das Bild steht nur, wenn der Plan hier etwas vorsieht', () => {
    expect(node).toMatch(/useErwartetesBild\(id\)/)
    expect(node).toMatch(/erwartetesBild !== null && \(/)
  })

  it('DIE BESCHRIFTUNG IST PFLICHT', () => {
    // Ohne sie saehe ein Pruefbild auf einer Geraete-Karte aus wie eine
    // Rueckmeldung von diesem Geraet. Genau das ist die Falschaussage, die
    // Invariante 14 verbietet — und sie waere hier besonders teuer, weil
    // Balken so ueberzeugend nach „Signal ist da" aussehen.
    expect(node).toMatch(/canvas\.pattern\.expected'/)
    expect(node).toMatch(/canvas\.pattern\.expectedTitle'/)
  })

  it('der Streifen haengt in der Werkzeugleiste', () => {
    expect(ohneKommentare(toolbarSrc)).toMatch(/<PatternChip \/>/)
  })

  it('der Streifen nennt die offenen Wege — und zwar genau dann, wenn es welche gibt', () => {
    // Erster Anlauf suchte nur den Schluesselnamen. Das war unverdient: die
    // Gegenprobe „der Streifen verschweigt die offenen Wege" hat den Block
    // hinter `{false && …}` gehaengt, und der Schluessel stand weiter da,
    // nur unerreichbar. Dieselbe Form wie beim `liveStore`-Waechter aus
    // cable#770 — ein Quelltext-Scan beweist keine Erreichbarkeit.
    //
    // Geprueft wird jetzt die BEDINGUNG: die Zahl erscheint, wenn es offene
    // Wege gibt, und sonst nicht. Ein eingeschleustes `false` faellt damit
    // auf, und eine leere Anzeige auch: „0 offen" waere die Behauptung, der
    // Plan kenne jeden Weg zu Ende.
    const chip = ohneKommentare(chipSrc)
    expect(chip).toMatch(/offen > 0 && \(/)
    expect(chip).toMatch(/canvas\.pattern\.open'/)
  })
})
