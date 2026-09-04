import { describe, expect, it, beforeEach } from 'vitest'
import { portDisplayLabel, resolvePortLabel } from '../src/renderer/lib/portLabel'
import { buildPullListRows } from '../src/renderer/lib/installerLists'
import devicePdfSrc from '../src/renderer/lib/exportDevicePdf.ts?raw'
import locationBomSrc from '../src/renderer/components/Project/LocationBomDialog.tsx?raw'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { EquipmentItem, EquipmentTemplate, Port } from '../src/renderer/types/equipment'

// ADR-001, Inkrement 2 — die Exporter uebernehmen den Resolver.
//
// ADR-001 hat als tragende Zusage aus dem `minimal`-Entwurf uebernommen:
//
//   „Es fehlt kein Datensatz, es fehlt ein Resolver. [...] Keiner liefert
//    zurueck, WOHER der Text stammt. Eine Engstelle mit Provenienz im
//    Rueckgabewert loest das."
//
// Der eigentliche Fund beim Nachlesen: diese Engstelle EXISTIERTE schon — als
// private `portText` in labelDerivation.ts, also genau dort, wo kein Exporter
// sie erreichen konnte. Die Ableitungsschicht brauchte die Provenienz fuer ihre
// Kandidaten und hat sie sich selbst gebaut; die Exporter, fuer die ADR-001 sie
// vorgesehen hatte, blieben ohne. Sie ist jetzt in portLabel.ts hochgezogen,
// nicht neu geschrieben.
//
// ADR-001s Liste der Umgeher war dabei in zwei von vier Punkten veraltet:
// cableLabel.ts und exportVideohub.ts benutzen den Resolver inzwischen. Dafuer
// nennt sie zwei Stellen NICHT, die dieselbe Kette fuehren — die Match-Keys in
// equipmentSlice und ReplaceDeviceSection. Wieder das bekannte Muster: der
// Hinweis sagt zuverlaessig, WO man nachsieht, und unzuverlaessig, WAS dort ist.

describe('resolvePortLabel — die Engstelle mit Provenienz', () => {
  it('nennt das contentLabel als Herkunft, wenn es gesetzt ist', () => {
    expect(resolvePortLabel({ name: '1 SDI 3G PGM', contentLabel: 'PGM' })).toEqual({
      text: 'PGM',
      provenance: 'port-content-label',
    })
  })

  it('faellt auf den Port-Namen zurueck und sagt das auch', () => {
    expect(resolvePortLabel({ name: '1 SDI 3G PGM', contentLabel: undefined })).toEqual({
      text: '1 SDI 3G PGM',
      provenance: 'port-name',
    })
  })

  it('behandelt ein contentLabel aus Leerzeichen als NICHT gesetzt', () => {
    // Genau hier wichen drei der fuenf Kopien ab: sie trimmten erst NACH dem
    // Fallback, `'  '` war damit truthy und gewann gegen den Namen.
    expect(resolvePortLabel({ name: 'SDI 1', contentLabel: '   ' })).toEqual({
      text: 'SDI 1',
      provenance: 'port-name',
    })
  })

  it('sagt „none", wenn es nichts zu sagen gibt', () => {
    // Nicht der leere String allein: ein Aufrufer muss unterscheiden koennen,
    // ob der Text leer IST oder ob er fehlt — sonst raet er wieder selbst.
    expect(resolvePortLabel({ name: '', contentLabel: '' })).toEqual({
      text: '',
      provenance: 'none',
    })
    expect(resolvePortLabel({ name: '  ', contentLabel: undefined }).provenance).toBe('none')
  })

  it('portDisplayLabel bleibt der duenne Aufsatz darauf', () => {
    // Alle bisherigen Aufrufer sehen denselben Text wie vorher — sonst waere
    // die Umstellung keine Umstellung, sondern eine Aenderung.
    for (const port of [
      { name: '1 SDI 3G PGM', contentLabel: 'PGM' },
      { name: '1 SDI 3G PGM', contentLabel: undefined },
      { name: 'SDI 1', contentLabel: '   ' },
      { name: '', contentLabel: '' },
    ]) {
      expect(portDisplayLabel(port)).toBe(resolvePortLabel(port).text)
    }
  })
})

// ── Weg 1: installerLists — die Umstellung aendert die Ausgabe NICHT ────────

const port = (over: Partial<Port>): Port =>
  ({ id: 'p1', name: 'OUT 1', type: 'port', connectorType: 'BNC', ...over }) as unknown as Port

const project = (equipment: EquipmentItem[], cables: unknown[]): CablePlannerProject =>
  ({
    metadata: { name: 'Halle 7' },
    equipment,
    cables,
    canvasState: { x: 0, y: 0, zoom: 1 },
  }) as unknown as CablePlannerProject

const twoDevices = (fromPort: Partial<Port>, toPort: Partial<Port>) =>
  project(
    [
      {
        id: 'a', name: 'ATEM', category: 'Mischer', x: 0, y: 0, width: 240, height: 80,
        inputs: [], outputs: [port({ id: 'a-out', ...fromPort })],
      } as unknown as EquipmentItem,
      {
        id: 'b', name: 'Router', category: 'Router', x: 400, y: 0, width: 240, height: 80,
        inputs: [port({ id: 'b-in', ...toPort })], outputs: [],
      } as unknown as EquipmentItem,
    ],
    [
      {
        id: 'c1', name: 'K1', type: 'SDI', length: 10, color: '#fff',
        fromEquipmentId: 'a', fromPortId: 'a-out',
        toEquipmentId: 'b', toPortId: 'b-in', notes: '',
      },
    ],
  )

describe('installerLists — dieselbe Ausgabe, eine Kette weniger', () => {
  it('nimmt das contentLabel, wenn es gesetzt ist', () => {
    const rows = buildPullListRows(twoDevices({ contentLabel: 'PGM' }, { contentLabel: 'IN 3' }))
    expect(rows[0].fromPort).toBe('PGM')
    expect(rows[0].toPort).toBe('IN 3')
  })

  it('nimmt den Port-Namen, wenn keins gesetzt ist', () => {
    const rows = buildPullListRows(twoDevices({ name: 'SDI OUT 1' }, { name: 'SDI IN 3' }))
    expect(rows[0].fromPort).toBe('SDI OUT 1')
    expect(rows[0].toPort).toBe('SDI IN 3')
  })

  it('behaelt den Ausweg auf die Port-Id — eine leere Zelle sagt weniger', () => {
    // Das ist der EINE Punkt, in dem die alte Kette vom Resolver abwich, und
    // er bleibt bewusst: `portDisplayLabel` gibt '' zurueck und ueberlaesst
    // dem Caller den letzten Ausweg (so steht es in seinem Docstring).
    const rows = buildPullListRows(twoDevices({ name: '', contentLabel: '' }, { name: '' }))
    expect(rows[0].fromPort).toBe('a-out')
    expect(rows[0].toPort).toBe('b-in')
  })

  it('behandelt ein Leerzeichen-contentLabel wie vorher — hier war nichts kaputt', () => {
    // Ausdruecklich KEIN Fix: `installerLists` trimmte schon vorher, seine
    // Kette war wortgleich zum Resolver. Der erste Entwurf dieses Tests hat
    // das Gegenteil behauptet; die Gegenprobe am alten Stand hat es widerlegt.
    // Er bleibt als Regressionsschutz stehen, nicht als Beweis eines Fixes.
    const rows = buildPullListRows(twoDevices({ name: 'SDI OUT 1', contentLabel: '  ' }, {}))
    expect(rows[0].fromPort).toBe('SDI OUT 1')
  })
})

// ── Weg 2: der Match-Key im Port-Mapping — der folgenreichste ───────────────

describe('Port-Mapping beim Template-Tausch — der Key geht durch die Engstelle', () => {
  beforeEach(() => localStorage.clear())

  it('ein Port mit Leerzeichen-contentLabel findet seinen Namensvetter wieder', async () => {
    // Der alte Key `(contentLabel || name || '').trim()` ergab fuer
    // contentLabel='  ' einen LEEREN Key; ein leerer Key faellt wegen `ok &&`
    // aus Pass 1 heraus und landet in der positionellen Zuordnung.
    //
    // Der Aufbau ist bewusst so gewaehlt, dass die Position FALSCH liegt: ein
    // einziger alter Port, und in der neuen Vorlage steht ein Koeder derselben
    // Steckerart davor. Der erste Entwurf dieses Tests hatte zwei alte Ports —
    // da hatte Pass 1 den Koeder schon verbraucht und Pass 2 lag zufaellig
    // richtig, sodass der Test auf beiden Staenden gruen war. Die Gegenprobe
    // hat das aufgedeckt.
    //
    // Nach #635 laeuft der Library-Update-Prompt durch genau diesen Pfad.
    const { useProjectStore } = await import('../src/renderer/store/projectStore')

    const eq = {
      id: 'e1', name: 'Router', category: 'Router', x: 0, y: 0, width: 240, height: 80,
      inputs: [port({ id: 'in-madi', name: 'MADI', contentLabel: '  ', connectorType: 'BNC' })],
      outputs: [],
    } as unknown as EquipmentItem
    const cam = {
      id: 'e2', name: 'Kamera', category: 'Kamera', x: 400, y: 0, width: 240, height: 80,
      inputs: [], outputs: [port({ id: 'cam-out', name: 'SDI OUT', connectorType: 'BNC' })],
    } as unknown as EquipmentItem

    useProjectStore.setState((s) => ({
      project: {
        ...s.project,
        equipment: [eq, cam],
        cables: [
          {
            id: 'c1', name: 'K1', type: 'SDI', length: 10, color: '#fff',
            fromEquipmentId: 'e2', fromPortId: 'cam-out',
            toEquipmentId: 'e1', toPortId: 'in-madi', notes: '',
          },
        ] as never,
      },
    }))

    // Koeder zuerst: positionell landet das Kabel auf SDI, nicht auf MADI.
    const tpl = {
      name: 'Router', category: 'Router',
      inputs: [
        port({ id: 't-sdi', name: 'SDI', connectorType: 'BNC' }),
        port({ id: 't-madi', name: 'MADI', connectorType: 'BNC' }),
      ],
      outputs: [],
    } as unknown as EquipmentTemplate

    useProjectStore.getState().replaceEquipmentWithTemplate('e1', tpl)

    const st = useProjectStore.getState().project
    const router = st.equipment.find((e) => e.id === 'e1')!
    const cable = st.cables[0] as unknown as { toPortId: string }
    const madi = router.inputs.find((p) => p.name === 'MADI')!
    const sdi = router.inputs.find((p) => p.name === 'SDI')!
    expect(cable.toPortId).toBe(madi.id)
    expect(cable.toPortId).not.toBe(sdi.id)
  })
})

// ── Weg 3 und 4: zwei Stellen ohne Test-Naht, als Quell-Zusage ──────────────
//
// `summarizeEndpoint` in exportDevicePdf.ts und `portOf` in
// LocationBomDialog.tsx sind privat und haengen an jsPDF bzw. React. Fuer sie
// haelt dieser Abschnitt die Quelle fest — ausdruecklich eine schwaechere
// Zusage als ein Verhaltenstest, aber genauer als keine.
describe('die beiden Stellen ohne Test-Naht', () => {
  it('das Device-PDF fuehrt das Gegenende nicht mehr roh', () => {
    // Vorher: `otherPortName: otherPort?.name ?? null` — waehrend die EIGENEN
    // Ports des Blatts seit #286 durch portLabelPair gehen. Auf einem Blatt
    // standen damit beide Konventionen: links „PGM", rechts
    // „an ATEM - 1 SDI 3G PGM (1080p50/60)" fuer denselben Steckverbinder.
    const src = devicePdfSrc.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '')
    expect(src).not.toContain('otherPortName: otherPort?.name')
    expect(src).toContain('otherPortName: otherPort ? portDisplayLabel(otherPort)')
  })

  it('die Standort-Stueckliste geht durch den Resolver', () => {
    const src = locationBomSrc.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '')
    expect(src).not.toContain("p?.contentLabel || p?.name")
    expect(src).toContain('portDisplayLabel(p)')
  })
})

// ── Der Guard: keine sechste Kopie ──────────────────────────────────────────

/**
 * ALLE Quellen unter `src/`, nicht nur `src/renderer/`.
 *
 * Der Glob lautete bis 2026-09-04 `../src/renderer/**` — und genau das machte
 * den Guard schwaecher als seine eigene Zusage. `src/mobile/` (die LAN-Ansicht
 * am Telefon) und `src/viewer/` (der Web-Viewer) liegen ausserhalb. Gemessen:
 * `MobileApp.tsx` rendete an vier Stellen `port.name` roh, das Telefon zeigte
 * damit "1 SDI 3G PGM (1080p50/60)", wo Canvas, Patchliste, Geraete-PDF und
 * jeder Export "PGM" zeigten. Es ist die Oberflaeche, die jemand mit einem
 * Stecker in der Hand ansieht.
 *
 * Der Guard konnte es prinzipiell nicht finden — nicht nur wegen des Globs:
 * er sucht eine NACHGEBAUTE Kette (`contentLabel ... ||`), und `mobile` baute
 * nichts nach, es ignorierte `contentLabel` schlicht. Ein Guard, der nur
 * Nachbauten sucht, belegt "keine zweite Kopie der Kette" und nicht "jede
 * Oberflaeche geht durch die Engstelle". Deshalb steht unten ein ZWEITER,
 * positiver Guard daneben.
 */
const alleQuellen = import.meta.glob('../src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const rendererSources = Object.fromEntries(
  Object.entries(alleQuellen).filter(([p]) => p.includes('/src/renderer/')),
) as Record<string, string>

/** Kommentarzeilen weg, bevor gesucht wird — sonst findet der Guard die
 *  Erklaerung, warum er existiert, und meldet sie als Verstoss. Genau das ist
 *  in diesem Repo schon einmal passiert. */
const withoutComments = (src: string) =>
  src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')

describe('die Kette steht nur noch an einer Stelle', () => {
  it('findet die Renderer-Quellen ueberhaupt', () => {
    // Ohne diese Zeile prueft der Guard bei einem kaputten Glob still nichts.
    expect(Object.keys(rendererSources).length).toBeGreaterThan(100)
  })

  it('niemand baut die contentLabel-Kette selbst nach', () => {
    const offenders = Object.entries(alleQuellen)
      .filter(([path]) => !path.endsWith('lib/portLabel.ts'))
      .filter(([, src]) => /contentLabel[^)\n]{0,40}\|\|/.test(withoutComments(src)))
      .map(([path]) => path.split('/src/')[1])
      .sort()
    expect(offenders).toEqual([])
  })
})

// ── Der zweite Guard: die mitlesenden Oberflaechen gehen durch die Engstelle ─

/**
 * WARUM DAS KEIN PAUSCHALVERBOT IST. Gemessen am 2026-09-04 stehen unter
 * `src/` **17** JSX-Stellen, die `port.name` roh rendern (Template-Literale
 * herausgerechnet — `${port.name}` ist kein JSX-Ausdruck, und wer das nicht
 * ausschliesst, misst 38 statt 17). Die meisten davon sind richtig so:
 * `PortList`, `ModeEditorDialog`, `TemplateMergeDialog` und `NetworkConfig`
 * BEARBEITEN den Port. Wer einen Namen umbenennt, muss den Namen sehen und
 * nicht den daraufliegenden Inhalts-Text — ein Editor, der den aufgeloesten
 * Text zeigt, macht das Feld unbedienbar.
 *
 * Ein Guard, der alle 17 verbietet, waere also falsch, und ein Guard mit einer
 * Ausnahmeliste von 10 Dateien waere in vier Wochen veraltet. Geprueft wird
 * deshalb die andere Richtung: die Oberflaechen, die den Plan fuer einen LESER
 * spiegeln, benutzen die Engstelle nachweislich. Kommt eine dazu, gehoert sie
 * hier hinein — das ist eine Zeile, und sie steht an der Stelle, an der man
 * beim Lesen darueber stolpert.
 */
const MITLESENDE_OBERFLAECHEN = ['/src/mobile/MobileApp.tsx']

describe('die mitlesenden Oberflaechen benutzen die Engstelle', () => {
  for (const marke of MITLESENDE_OBERFLAECHEN) {
    const eintrag = Object.entries(alleQuellen).find(([p]) => p.endsWith(marke))

    it(`${marke} ist ueberhaupt im Glob`, () => {
      // Ohne diese Zeile prueft der Guard bei umbenannter Datei still nichts.
      expect(eintrag).toBeDefined()
    })

    it(`${marke} ruft portDisplayLabel auf`, () => {
      expect(eintrag?.[1] ?? '').toContain('portDisplayLabel(')
    })

    it(`${marke} rendert keinen rohen Port-Namen`, () => {
      const src = withoutComments(eintrag?.[1] ?? '')
      const roh = src.match(/(?<!\$)\{\s*(?:\w*[Pp]ort|p)\.name\s*\}/g) ?? []
      expect(roh).toEqual([])
    })
  }
})
