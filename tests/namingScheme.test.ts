import { describe, expect, it } from 'vitest'
import {
  NAMING_FINDING_LABEL,
  applyNamingScheme,
  assessNaming,
  buildName,
  freeTextHits,
  hasDanteInterface,
  normaliseNamingScheme,
  renameSetTable,
  scopeOf,
} from '../src/renderer/lib/namingScheme'
import {
  DANTE_NAME_LIMIT,
  DANTE_NAME_LIMIT_SOURCE,
  type NamingScheme,
} from '../src/renderer/types/namingScheme'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { LocationFrame } from '../src/renderer/types/location'
import { DOCUMENT_LABELS, DOCUMENT_STANDS } from '../src/renderer/lib/documentRegistry'
import typenQuelle from '../src/renderer/types/namingScheme.ts?raw'
import libQuelle from '../src/renderer/lib/namingScheme.ts?raw'
import sliceQuelle from '../src/renderer/store/slices/metaSlice.ts?raw'
import dialogQuelle from '../src/renderer/components/Analysis/AnalysisDialog.tsx?raw'

// ---------------------------------------------------------------------------
// Namen nach Regel, und ein Umbenennungssatz zum Abtippen (Bedarf 74, P2).
//
// Der Beleg: Audinates EIGENE Anleitung zum Massen-Umbenennen ist, ein
// Dante-Preset zu speichern, die XML in einem Texteditor per
// Suchen-und-Ersetzen zu aendern und wieder einzuspielen. Wenn der Hersteller
// den Texteditor empfiehlt, fehlt das Feature unmissverstaendlich.
//
// Und die zweite Haelfte: ab Firmware 4.3 bricht das Umbenennen eines
// Sendekanals bestehende Subscriptions.
// ---------------------------------------------------------------------------

const eq = (
  id: string,
  name: string,
  over: Partial<EquipmentItem> = {},
): EquipmentItem =>
  ({
    id,
    name,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    category: 'Video',
    inputs: [],
    outputs: [],
    ...over,
  }) as never

const rahmen = (name: string, x = 0, y = 0): LocationFrame =>
  ({ id: `loc-${name}`, name, x, y, width: 100, height: 100 }) as never

const projekt = (over: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Show', description: '', createdAt: '', updatedAt: '' },
    equipment: [],
    cables: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
    ...over,
  }) as CablePlannerProject

const schema = (over: Partial<NamingScheme> = {}): NamingScheme => ({
  segments: [{ part: 'category' }, { part: 'index', pad: 2 }],
  separator: '-',
  caseMode: 'as-is',
  ...over,
})

const arten = (p: CablePlannerProject, s: NamingScheme): string[] =>
  assessNaming(p, s).findings.map((f) => f.kind)

// ── 1. Namen erzeugen ──────────────────────────────────────────────────────

describe('buildName — die Regel', () => {
  it('setzt Kategorie, Ort und laufende Nummer zusammen', () => {
    const p = projekt({ locations: [rahmen('Buehne')] })
    const name = buildName(
      schema({ segments: [{ part: 'category' }, { part: 'location' }, { part: 'index', pad: 2 }] }),
      eq('a', 'alt'),
      p,
      3,
    )
    expect(name).toBe('Video-Buehne-03')
  })

  it('lässt einen leeren Teil samt Trenner WEGFALLEN', () => {
    // Ein Geraet ohne Ort bekaeme sonst „Video--01" — ein Name mit einem Loch,
    // den jemand am Showtag fuer einen Fehler haelt und von Hand repariert.
    const name = buildName(
      schema({ segments: [{ part: 'category' }, { part: 'location' }, { part: 'index', pad: 2 }] }),
      eq('a', 'alt'),
      projekt(),
      1,
    )
    expect(name).toBe('Video-01')
  })

  it('nimmt festen Text und den bisherigen Namen auf', () => {
    const name = buildName(
      schema({ segments: [{ part: 'literal', literal: 'TRUCK' }, { part: 'current' }] }),
      eq('a', 'Cam1'),
      projekt(),
      1,
    )
    expect(name).toBe('TRUCK-Cam1')
  })

  it('wendet die Schreibweise an', () => {
    expect(buildName(schema({ caseMode: 'upper' }), eq('a', 'x'), projekt(), 1)).toBe('VIDEO-01')
    expect(buildName(schema({ caseMode: 'lower' }), eq('a', 'x'), projekt(), 1)).toBe('video-01')
  })

  it('nummeriert in Plan-Reihenfolge, damit zwei Läufe dasselbe ergeben', () => {
    const p = projekt({ equipment: [eq('a', 'A'), eq('b', 'B')] })
    const s = schema()
    expect(assessNaming(p, s).proposals.map((x) => x.after)).toEqual(['Video-01', 'Video-02'])
    expect(assessNaming(p, s).proposals.map((x) => x.after)).toEqual(['Video-01', 'Video-02'])
  })
})

// ── 2. Der Geltungsbereich ─────────────────────────────────────────────────

describe('scopeOf — welche Geräte die Regel trifft', () => {
  it('nimmt ohne Filter alle', () => {
    const p = projekt({ equipment: [eq('a', 'A'), eq('b', 'B', { category: 'Audio' })] })
    expect(scopeOf(p, schema())).toHaveLength(2)
  })

  it('nimmt mit Filter nur die passenden', () => {
    const p = projekt({ equipment: [eq('a', 'A'), eq('b', 'B', { category: 'Audio' })] })
    expect(scopeOf(p, schema({ categoryFilter: 'Audio' })).map((e) => e.id)).toEqual(['b'])
  })

  it('sagt es, wenn die Regel kein Gerät trifft', () => {
    const p = projekt({ equipment: [eq('a', 'A')] })
    expect(arten(p, schema({ categoryFilter: 'Licht' }))).toContain('scope-empty')
  })
})

// ── 3. Die Prüfung ist der eigentliche Wert ────────────────────────────────

describe('assessNaming — was die Regel anrichtet', () => {
  it('meldet doppelte Namen und verweigert die Anwendung', () => {
    const p = projekt({ equipment: [eq('a', 'A'), eq('b', 'B')] })
    const s = schema({ segments: [{ part: 'category' }] })
    expect(arten(p, s)).toContain('duplicate-name')
    expect(assessNaming(p, s).applicable).toBe(false)
    expect(applyNamingScheme(p, s).refused).toBe('duplicates')
    expect(applyNamingScheme(p, s).project).toBeUndefined()
  })

  it('prüft auch gegen Geräte AUSSERHALB des Geltungsbereichs', () => {
    // Sonst kollidiert die Regel mit einem Gerät, das sie gar nicht anfasst.
    const p = projekt({
      equipment: [eq('a', 'A', { category: 'Audio' }), eq('b', 'Audio-01')],
    })
    const s = schema({ categoryFilter: 'Audio' })
    expect(arten(p, s)).toContain('duplicate-name')
  })

  it('meldet die 31-Zeichen-Grenze NUR für Dante-Geräte', () => {
    const langesSchema = schema({
      segments: [{ part: 'literal', literal: 'X'.repeat(40) }],
    })
    const ohneDante = projekt({ equipment: [eq('a', 'A')] })
    expect(arten(ohneDante, langesSchema)).not.toContain('too-long-for-dante')

    const mitDante = projekt({
      equipment: [
        eq('a', 'A', {
          networkInterfaces: [{ id: 'n1', label: 'Dante', role: 'dante-primary' }],
        } as never),
      ],
    })
    expect(arten(mitDante, langesSchema)).toContain('too-long-for-dante')
  })

  it('kürzt einen zu langen Namen NICHT', () => {
    // Eine automatisch gekuerzte Kennung ist am Showtag nicht mehr die, die
    // auf dem Blatt steht.
    const p = projekt({
      equipment: [
        eq('a', 'A', {
          networkInterfaces: [{ id: 'n1', label: 'D', role: 'dante-primary' }],
        } as never),
      ],
    })
    const s = schema({ segments: [{ part: 'literal', literal: 'X'.repeat(40) }] })
    expect(assessNaming(p, s).proposals[0].after).toHaveLength(40)
    expect(libQuelle).not.toMatch(/\.slice\(0,\s*DANTE_NAME_LIMIT\)|substring\(0,\s*31\)/)
  })

  it('warnt beim Dante-Gerät vor brechenden Subscriptions', () => {
    const p = projekt({
      equipment: [
        eq('a', 'A', {
          networkInterfaces: [{ id: 'n1', label: 'D', role: 'dante-secondary' }],
        } as never),
      ],
    })
    const f = assessNaming(p, schema()).findings.find((x) => x.kind === 'dante-subscription-risk')
    expect(f?.text).toContain('4.3')
    // …und behauptet NICHT zu wissen, welche.
    expect(f?.text).toMatch(/kennt den Subscription-Satz nicht/)
  })

  it('behauptet nirgends, den Subscription-Satz zu kennen', () => {
    expect(libQuelle).not.toMatch(/subscriptions:\s*\[|subscriptionSet/)
  })

  it('meldet den alten Namen, wenn er als TEXT im Plan steht', () => {
    // Der Plan verweist sonst per Id — das ist der Grund, warum Umbenennen
    // ueberhaupt gefahrlos geht. Freitexte sind die Ausnahme, und dort bricht
    // nichts, weshalb es niemandem auffaellt.
    const p = projekt({
      equipment: [eq('a', 'Cam1', { notes: 'Cam1 steht hinten links' })],
    })
    expect(arten(p, schema())).toContain('name-in-free-text')
  })

  it('zählt Treffer in Kabelnotizen und Ziel-Notizen mit', () => {
    const p = projekt({
      equipment: [eq('a', 'Cam1')],
      cables: [
        { id: 'c1', name: 'c1', type: 'sdi', length: 1, fromDeviceId: 'a', toDeviceId: 'a', fromPortId: 'x', toPortId: 'y', notes: 'von Cam1' } as never,
      ],
    })
    expect(freeTextHits(p, 'Cam1')).toBe(1)
    expect(freeTextHits(p, 'Cam9')).toBe(0)
    expect(freeTextHits(p, '   ')).toBe(0)
  })

  it('meldet einen leeren Namen und setzt ihn nicht', () => {
    const p = projekt({ equipment: [eq('a', 'A', { category: '' })] })
    const s = schema({ segments: [{ part: 'category' }] })
    expect(arten(p, s)).toContain('empty-name')
    expect(assessNaming(p, s).proposals).toHaveLength(0)
  })

  it('sagt ausdrücklich, wenn die Regel nichts ändert', () => {
    const p = projekt({ equipment: [eq('a', 'Video-01')] })
    expect(arten(p, schema())).toContain('no-change')
    expect(applyNamingScheme(p, schema()).refused).toBe('nothing-to-do')
  })

  it('gibt jeder Befundart eine Beschriftung', () => {
    for (const k of Object.keys(NAMING_FINDING_LABEL)) {
      expect(NAMING_FINDING_LABEL[k as never]).toBeTruthy()
    }
  })

  it('erkennt eine Dante-Schnittstelle an ihrer Rolle', () => {
    expect(hasDanteInterface(eq('a', 'A'))).toBe(false)
    expect(
      hasDanteInterface(
        eq('a', 'A', {
          networkInterfaces: [{ id: 'n', label: 'x', role: 'media-primary' }],
        } as never),
      ),
    ).toBe(false)
    expect(
      hasDanteInterface(
        eq('a', 'A', {
          networkInterfaces: [{ id: 'n', label: 'x', role: 'dante-primary' }],
        } as never),
      ),
    ).toBe(true)
  })
})

// ── 4. Anwenden — nie still ────────────────────────────────────────────────

describe('applyNamingScheme', () => {
  it('gibt ein NEUES Projekt zurück und fasst das alte nicht an', () => {
    const p = projekt({ equipment: [eq('a', 'alt'), eq('b', 'auch alt', { category: 'Audio' })] })
    const vorher = JSON.stringify(p)
    const r = applyNamingScheme(p, schema())
    expect(r.project).toBeTruthy()
    expect(JSON.stringify(p)).toBe(vorher)
    expect(r.project?.equipment.map((e) => e.name)).toEqual(['Video-01', 'Audio-02'])
  })

  it('nennt die Verweigerung beim Namen, statt still nichts zu tun', () => {
    const p = projekt({ equipment: [eq('a', 'A'), eq('b', 'B')] })
    const r = applyNamingScheme(p, schema({ segments: [{ part: 'category' }] }))
    expect(r.refused).toBe('duplicates')
    // Die Vorschlaege bleiben sichtbar, damit jemand sieht, WAS kollidiert.
    expect(r.proposals.length).toBeGreaterThan(0)
  })

  it('lässt den Store bei einer Verweigerung unverändert', () => {
    expect(sliceQuelle).toMatch(/const result = applyNamingScheme\(state\.project, scheme\)/)
    expect(sliceQuelle).toMatch(/if \(!result\.project\) return \{\}/)
  })
})

// ── 5. Der Umbenennungssatz ────────────────────────────────────────────────

describe('renameSetTable', () => {
  it('stellt alt neben neu und nennt die Länge', () => {
    const p = projekt({ equipment: [eq('a', 'alt')] })
    const t = renameSetTable(p, schema())
    expect(t.rows[0][0]).toBe('alt')
    expect(t.rows[0][1]).toBe('Video-01')
    expect(t.rows[0][2]).toBe(8)
  })

  it('ist ohne Regel leer, mit denselben Spalten', () => {
    const leer = renameSetTable(projekt({ equipment: [eq('a', 'alt')] }))
    const voll = renameSetTable(projekt({ equipment: [eq('a', 'alt')] }), schema())
    expect(leer.rows).toEqual([])
    expect(leer.headers).toEqual(voll.headers)
  })

  it('ist KEINE Dante-Preset-XML', () => {
    // Das Schema haengt an der Controller-Version, diese Anwendung hat es nie
    // gesehen, und eine Datei, die aussieht wie ein Preset, wird in ein
    // laufendes Netz eingespielt.
    expect(libQuelle).not.toMatch(/<\?xml|DanteDeviceCaps|\.xml['"]/)
    expect(typenQuelle).toMatch(/KEINE Dante-Preset-XML/)
  })

  it('nennt die Grenze mit ihrer Quelle — im Befund, nicht nur im Kommentar', () => {
    // Erste Fassung prüfte nur, ob die URL irgendwo in der Typdatei steht —
    // und traf damit den Kommentar über der Konstante. Die Quelle muss dort
    // ankommen, wo jemand sie liest: im Befundtext.
    expect(DANTE_NAME_LIMIT).toBe(31)
    expect(DANTE_NAME_LIMIT_SOURCE).toMatch(/support\.getdante\.com/)
    const p = projekt({
      equipment: [
        eq('a', 'A', {
          networkInterfaces: [{ id: 'n', label: 'D', role: 'dante-primary' }],
        } as never),
      ],
    })
    const s = schema({ segments: [{ part: 'literal', literal: 'X'.repeat(40) }] })
    const f = assessNaming(p, s).findings.find((x) => x.kind === 'too-long-for-dante')
    expect(f?.text).toContain(DANTE_NAME_LIMIT_SOURCE)
  })

  it('trägt kanonisches Deutsch', () => {
    expect(libQuelle).not.toContain("t('")
  })

  it('ist als Dokument mit Stand und lesbarem Namen registriert', () => {
    expect(DOCUMENT_STANDS['umbenennungssatz']).toBeTruthy()
    expect(DOCUMENT_LABELS['umbenennungssatz']).toBeTruthy()
  })
})

// ── 6. Laden und Oberfläche ────────────────────────────────────────────────

describe('normaliseNamingScheme', () => {
  it('wirft ein Segment mit unbekanntem Teil weg', () => {
    const out = normaliseNamingScheme({
      segments: [{ part: 'category' }, { part: 'sternzeichen' }],
      separator: '-',
    })
    expect(out?.segments).toHaveLength(1)
  })

  it('verwirft eine Regel ohne jedes Segment', () => {
    expect(normaliseNamingScheme({ segments: [] })).toBeUndefined()
    expect(normaliseNamingScheme(null)).toBeUndefined()
  })

  it('begrenzt die Nullen-Auffüllung auf einen sinnvollen Bereich', () => {
    expect(normaliseNamingScheme({ segments: [{ part: 'index', pad: 99 }] })?.segments[0].pad)
      .toBeUndefined()
    expect(normaliseNamingScheme({ segments: [{ part: 'index', pad: 3 }] })?.segments[0].pad).toBe(3)
  })
})

describe('die Oberfläche', () => {
  const namingTab = (): string => {
    const von = dialogQuelle.indexOf('const NamingTab = ')
    const bis = dialogQuelle.indexOf('const TABS:')
    expect(von).toBeGreaterThan(-1)
    expect(bis).toBeGreaterThan(von)
    return dialogQuelle.slice(von, bis)
  }

  it('lässt den Anwenden-Knopf klickbar, damit die Weigerung sichtbar wird', () => {
    const t = namingTab()
    expect(t).toMatch(/onClick=\{anwenden\}/)
    expect(t).not.toMatch(/disabled=\{[^}]*applicable/)
  })

  it('zeigt den Grund der Weigerung an', () => {
    expect(namingTab()).toMatch(/refusal === 'duplicates'/)
    expect(namingTab()).toMatch(/analysis\.naming\.refusedNothing/)
  })

  it('zeigt jeden Befund mit seiner Beschriftung', () => {
    expect(namingTab()).toMatch(
      /bewertung\.findings\.length > 0 &&[\s\S]*NAMING_FINDING_LABEL\[f\.kind\][\s\S]*f\.text/,
    )
  })
})
