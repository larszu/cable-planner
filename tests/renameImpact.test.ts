import { beforeEach, describe, expect, it } from 'vitest'
import {
  RENAME_REFUSAL_LABEL,
  RENAME_TABLE_HEADERS,
  renameImpact,
  renameRefusal,
  renameTable,
  swallowedLandings,
} from '../src/renderer/lib/renameImpact'
import { useProjectStore } from '../src/renderer/store/projectStore'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import type { SourceIdentity } from '../src/renderer/types/sourceIdentity'
import libQuelle from '../src/renderer/lib/renameImpact.ts?raw'
import sliceQuelle from '../src/renderer/store/slices/sourceIdentitySlice.ts?raw'
import storeQuelle from '../src/renderer/store/projectStore.ts?raw'
import panelQuelle from '../src/renderer/components/Properties/sections/SourceIdentitySection.tsx?raw'

// ---------------------------------------------------------------------------
// Umbenennen kostet EINE Aenderung — und man sieht vorher, wo sie ankommt
// (Bedarf 101, P3).
//
//   > A renamed preset or source has to be re-typed on every button that
//   > references it, on every page; label editing happens several times a day
//   > during show weeks.
//
// Belegt an `bitfocus/companion#1266` (2022, PTZ-Presets auf drei Seiten) und
// `bitfocus/companion#4324` (2026, offen): die Klicks „add up very quickly …
// when changing labels several times a day".
// ---------------------------------------------------------------------------

const port = (id: string, name: string, over: Partial<Port> = {}): Port => ({
  id,
  name,
  type: 'BNC',
  connectorType: 'BNC',
  ...over,
})

const eq = (over: Partial<EquipmentItem>): EquipmentItem => ({
  id: 'e1',
  name: 'Gerät',
  category: 'Video',
  inputs: [],
  outputs: [],
  x: 0,
  y: 0,
  width: 200,
  height: 160,
  ...over,
})

const cable = (from: [string, string], to: [string, string]): Cable => ({
  id: `${from[1]}->${to[1]}`,
  name: `${from[1]}->${to[1]}`,
  type: 'BNC',
  length: 10,
  color: '#fff',
  fromEquipmentId: from[0],
  fromPortId: from[1],
  toEquipmentId: to[0],
  toPortId: to[1],
  notes: '',
})

const rolle = (id: string, name: string, over: Partial<SourceIdentity> = {}): SourceIdentity => ({
  id,
  name,
  ...over,
})

/** Eine Kamera auf ATEM-Eingang 1, mit gebundener Rolle. */
const welt = (rollenName: string, over: Partial<EquipmentItem> = {}) => {
  const kamera = eq({
    id: 'cam1',
    name: 'Kamera links',
    category: 'Kameras',
    outputs: [port('cam1-out', 'SDI Out')],
    sourceIdentityId: 'r1',
    ...over,
  })
  const mischer = eq({
    id: 'atem',
    name: 'ATEM Mini Extreme',
    inputs: [port('atem-in1', 'In 1')],
  })
  return {
    equipment: [kamera, mischer],
    cables: [cable(['cam1', 'cam1-out'], ['atem', 'atem-in1'])],
    sourceIdentities: [rolle('r1', rollenName)],
  }
}

// ── 1. Die Absage hat einen Namen ──────────────────────────────────────────

describe('renameRefusal — warum es nicht geht, statt still nichts zu tun', () => {
  const list = [rolle('r1', 'Kamera 1'), rolle('r2', 'Kamera 2')]

  it('laesst die gewoehnliche Umbenennung zu', () => {
    expect(renameRefusal(list, 'r1', 'Kamera Bühne')).toBeNull()
  })

  it('meldet die verschwundene Rolle', () => {
    expect(renameRefusal(list, 'weg', 'Egal')).toBe('unknown-role')
  })

  it('lehnt den leeren Namen ab', () => {
    // Eine namenlose Rolle kann niemand zuweisen — und ein leeres UMD-Display
    // sieht aus wie ein defektes.
    expect(renameRefusal(list, 'r1', '   ')).toBe('empty-name')
  })

  it('lehnt den unveraenderten Namen ab', () => {
    expect(renameRefusal(list, 'r1', 'Kamera 1')).toBe('same-name')
    expect(renameRefusal(list, 'r1', '  Kamera 1  ')).toBe('same-name')
  })

  it('lehnt den Namen einer ANDEREN Rolle ab — auch in anderer Schreibweise', () => {
    // Zwei Rollen mit einem Namen sind auf dem Multiviewer nicht mehr
    // auseinanderzuhalten, und das Tally zeigt dann auf beide.
    expect(renameRefusal(list, 'r1', 'Kamera 2')).toBe('name-taken')
    expect(renameRefusal(list, 'r1', 'kamera 2')).toBe('name-taken')
  })

  it('haelt fuer jede Absage eine lesbare Ueberschrift bereit', () => {
    for (const k of ['unknown-role', 'empty-name', 'same-name', 'name-taken'] as const) {
      expect(RENAME_REFUSAL_LABEL[k].length).toBeGreaterThan(10)
    }
  })
})

// ── 2. Die eine Aenderung kommt an ─────────────────────────────────────────

describe('renameImpact — wo die eine Aenderung landet', () => {
  it('nennt die abgeleiteten Blaetter, statt sie zu behaupten', () => {
    // DER Beleg: „I have to change the names of all three buttons one by one".
    // Hier aendert EIN Feld den Text bei jedem Ziel, das ihn ableitet.
    const i = renameImpact(welt('Kamera 1'), 'r1', 'Bühne links')
    expect(i.refusal).toBeUndefined()
    expect(i.landings.length).toBeGreaterThan(0)
    for (const l of i.landings) expect(l.after).not.toBe(l.before)
  })

  it('traegt das UMD-Display die Rolle, nicht den Geraetenamen', () => {
    const i = renameImpact(welt('Kamera 1'), 'r1', 'Bühne links')
    const umd = i.landings.find((l) => l.targetId === 'tsl-umd-v31')
    expect(umd).toBeDefined()
    expect(umd?.before).toBe('Kamera 1')
    expect(umd?.after).toBe('Bühne links')
  })

  it('laesst Ziele weg, die diese Rolle gar nicht speisen', () => {
    // Sonst stuende die halbe Anlage in der Liste, und niemand faende darin
    // die drei Stellen, um die es geht. Hier haengt eine zweite Kamera OHNE
    // Rolle am selben Mischer: ihre Label-Kandidaten existieren, aendern sich
    // aber nicht — und duerfen deshalb nicht als Landung erscheinen.
    const w = welt('Kamera 1')
    w.equipment.push(
      eq({
        id: 'cam2',
        name: 'Kamera rechts',
        category: 'Kameras',
        outputs: [port('cam2-out', 'SDI Out')],
      }),
    )
    w.equipment[1].inputs.push(port('atem-in2', 'In 2'))
    w.cables.push(cable(['cam2', 'cam2-out'], ['atem', 'atem-in2']))

    const i = renameImpact(w, 'r1', 'Bühne links')
    expect(i.landings.length).toBeGreaterThan(0)
    // Kein Kandidat der rollenlosen Kamera — weder ueber ihren Port noch
    // ueber ihr UMD.
    expect(i.landings.some((l) => l.key.includes('cam2') || l.where.includes('In 2'))).toBe(false)
    expect(i.landings.every((l) => l.before !== l.after || l.unchangedAtTarget)).toBe(true)
  })

  it('rechnet die Absage, statt eine Vorschau auf Unmoegliches zu bauen', () => {
    const w = welt('Kamera 1')
    w.sourceIdentities.push(rolle('r2', 'Kamera 2'))
    const i = renameImpact(w, 'r1', 'Kamera 2')
    expect(i.refusal).toBe('name-taken')
    expect(i.landings).toEqual([])
    expect(i.stragglers).toEqual([])
  })
})

// ── 3. Der unangenehme Befund: sie kommt NICHT an ──────────────────────────

describe('die Umbenennung, die beim Ziel verschluckt wird', () => {
  it('meldet, wenn das Zielbudget den Unterschied wegschneidet', () => {
    // DER Fall, um den es geht: der ATEM-Kurzname hat 4 Byte. „Kamera 1" und
    // „Kamera 2" landen dort BEIDE auf „KAME". Das Blatt aendert sich, der
    // Multiviewer nicht — und diese Ueberraschung entdeckt man sonst in der
    // Sendung.
    const i = renameImpact(welt('Kamera 1'), 'r1', 'Kamera 2')
    const kurz = i.landings.find((l) => l.targetId === 'atem-input-short')
    expect(kurz).toBeDefined()
    expect(kurz?.before).toBe('KAME')
    expect(kurz?.after).toBe('KAME')
    expect(kurz?.unchangedAtTarget).toBe(true)

    // Und die uebrigen Ziele kommen sehr wohl an — sonst waere der Befund
    // „die Umbenennung wirkt nirgends", und das waere etwas anderes.
    const lang = i.landings.find((l) => l.targetId === 'atem-input-long')
    expect(lang?.after).toBe('Kamera 2')
    expect(lang?.unchangedAtTarget).toBe(false)

    expect(swallowedLandings(i).map((l) => l.targetId)).toEqual(['atem-input-short'])
  })

  it('zaehlt das Byte-Budget und nicht die Zeichen', () => {
    // Ein Umlaut kostet im 4-Byte-Kurznamen zwei — „BÜH" statt „BÜHN". Wer
    // hier Zeichen zaehlte, versprochenes Platzangebot, das der ATEM nicht
    // hat, und der vierte Buchstabe fiele erst auf dem Geraet weg.
    const i = renameImpact(welt('Kamera 1'), 'r1', 'Bühne links')
    const kurz = i.landings.find((l) => l.targetId === 'atem-input-short')
    expect(kurz?.after).toBe('BÜH')
    expect(kurz?.truncated).toBe(true)
  })

  it('zaehlt eine echte Aenderung NICHT als verschluckt', () => {
    const i = renameImpact(welt('Kamera 1'), 'r1', 'Bühne links')
    const umd = i.landings.find((l) => l.targetId === 'tsl-umd-v31')
    expect(umd?.unchangedAtTarget).toBe(false)
  })

  it('meldet Zeichen, die das Ziel nicht transportiert', () => {
    // TSL UMD v3.1 traegt 7-Bit-ASCII. Ein Umlaut im Rollennamen kommt dort
    // nicht an — und das erfaehrt man besser vor der Umbenennung.
    const i = renameImpact(welt('Kamera 1'), 'r1', 'Bühne links')
    const umd = i.landings.find((l) => l.targetId === 'tsl-umd-v31')
    expect(umd?.invalidChars).toContain('ü')
  })
})

// ── 4. Was NICHT mitfolgt ──────────────────────────────────────────────────

describe('die abgetippten Namen', () => {
  it('nennt das Portlabel, in dem der alte Name abgetippt steht', () => {
    // Der Rest des Marktproblems im eigenen Modell: was jemand getippt hat,
    // folgt der Rolle nicht — und es stumm stehen zu lassen braeche die
    // Zusage „eine Aenderung".
    const w = welt('Cam1')
    w.equipment[1].inputs[0].contentLabel = 'Cam1'
    const i = renameImpact(w, 'r1', 'Bühne links')
    expect(i.stragglers.some((s) => s.field === 'Port-Inhalt' && s.text === 'Cam1')).toBe(true)
  })

  it('nennt Kabelname und Kabelnotiz', () => {
    const w = welt('Cam1')
    w.cables[0].name = 'Cam1 → ATEM'
    w.cables[0].notes = 'Ersatzweg für Cam1'
    const i = renameImpact(w, 'r1', 'Bühne links')
    expect(i.stragglers.filter((s) => s.field.startsWith('Kabel'))).toHaveLength(2)
  })

  it('meldet den Namen NICHT als Wortteil', () => {
    // Ohne Wortgrenze meldete eine Rolle namens „A" jedes Geraet im Plan,
    // und nach dem dritten Fehlalarm schaltet das jemand ab.
    const w = welt('Cam1')
    w.cables[0].name = 'Cam12 → ATEM'
    const i = renameImpact(w, 'r1', 'Bühne links')
    expect(i.stragglers.some((s) => s.text === 'Cam12 → ATEM')).toBe(false)
  })

  it('erkennt den Namen am Bindestrich als eigenes Wort', () => {
    const w = welt('Cam1')
    w.cables[0].name = 'Cam1-Backup'
    const i = renameImpact(w, 'r1', 'Bühne links')
    expect(i.stragglers.some((s) => s.text === 'Cam1-Backup')).toBe(true)
  })

  it('meldet den Geraetenamen des TRAEGERS nicht doppelt', () => {
    // Eine Kamera, die „Kamera 1" heisst und die Rolle „Kamera 1" traegt,
    // ist EIN Sachverhalt. Ihn zweimal zu melden macht die Liste unlesbar.
    const w = welt('Kamera 1', { name: 'Kamera 1' })
    const i = renameImpact(w, 'r1', 'Bühne links')
    expect(i.stragglers.filter((s) => s.field === 'Gerätename')).toHaveLength(0)
  })

  it('meldet den Geraetenamen eines FREMDEN Geraets sehr wohl', () => {
    const w = welt('Kamera 1')
    w.equipment.push(eq({ id: 'mon', name: 'Monitor Kamera 1', category: 'Monitore' }))
    const i = renameImpact(w, 'r1', 'Bühne links')
    expect(i.stragglers.some((s) => s.text === 'Monitor Kamera 1')).toBe(true)
  })
})

// ── 5. Die Tabelle ─────────────────────────────────────────────────────────

describe('renameTable', () => {
  it('haelt den Spaltenkopf fest', () => {
    expect(renameTable(renameImpact(welt('Kamera 1'), 'r1', 'Bühne links')).headers).toEqual([
      ...RENAME_TABLE_HEADERS,
    ])
  })

  it('schreibt den Hinweis, statt ihn dem Leser zu ueberlassen', () => {
    const i = renameImpact(welt('Kamera 1'), 'r1', 'Bühne links')
    const zeilen = renameTable(i).rows
    expect(zeilen.length).toBe(i.landings.length)
    const umdZeile = zeilen.find((r) => String(r[0]).includes('TSL'))
    expect(String(umdZeile?.[4])).toContain('nicht darstellbar')
  })
})

// ── 6. Die eine Engstelle im Store ─────────────────────────────────────────

describe('renameSourceIdentity — der einzige Weg', () => {
  beforeEach(() => {
    useProjectStore.setState((s) => ({ project: { ...s.project, sourceIdentities: [] } }))
  })

  const anlegen = () => {
    const id = useProjectStore.getState().addSourceIdentity({ name: 'Kamera 1' })
    if (!id) throw new Error('Rolle nicht angelegt')
    return id
  }

  it('benennt um und liefert keine Absage', () => {
    const id = anlegen()
    expect(useProjectStore.getState().renameSourceIdentity(id, 'Bühne links')).toBeUndefined()
    expect(
      useProjectStore.getState().project.sourceIdentities?.find((s) => s.id === id)?.name,
    ).toBe('Bühne links')
  })

  it('gibt den Grund zurueck, statt still nichts zu tun', () => {
    const id = anlegen()
    useProjectStore.getState().addSourceIdentity({ name: 'Kamera 2' })
    expect(useProjectStore.getState().renameSourceIdentity(id, 'Kamera 2')).toBe('name-taken')
    expect(useProjectStore.getState().renameSourceIdentity(id, '  ')).toBe('empty-name')
    expect(useProjectStore.getState().renameSourceIdentity('weg', 'Egal')).toBe('unknown-role')
    // Und der Name steht unveraendert da.
    expect(
      useProjectStore.getState().project.sourceIdentities?.find((s) => s.id === id)?.name,
    ).toBe('Kamera 1')
  })

  it('schneidet Leerraum ab', () => {
    const id = anlegen()
    useProjectStore.getState().renameSourceIdentity(id, '  Bühne links  ')
    expect(
      useProjectStore.getState().project.sourceIdentities?.find((s) => s.id === id)?.name,
    ).toBe('Bühne links')
  })

  it('laesst `updateSourceIdentity` den Namen NICHT mehr aendern', () => {
    // Der zweite Weg an der Kollisionspruefung vorbei ist genau der Zustand,
    // den die Pruefung verhindern soll. Der Typ verbietet ihn; hier wird
    // geprueft, dass auch ein ungetypter Aufrufer nicht durchkommt.
    const id = anlegen()
    ;(
      useProjectStore.getState().updateSourceIdentity as unknown as (
        id: string,
        patch: Record<string, unknown>,
      ) => void
    )(id, { name: 'Heimlich', umdAddress: 5 })
    const rolleNachher = useProjectStore.getState().project.sourceIdentities?.find((s) => s.id === id)
    expect(rolleNachher?.name).toBe('Kamera 1')
    // Das uebrige Patchen funktioniert weiter.
    expect(rolleNachher?.umdAddress).toBe(5)
  })
})

// ── 7. Reinheit und Erreichbarkeit ─────────────────────────────────────────

describe('das Modul und die Oberflaeche', () => {
  it('nimmt keine Uhr und keinen Store', () => {
    expect(libQuelle).not.toContain('new Date(')
    expect(libQuelle).not.toContain('useProjectStore')
  })

  it('rechnet die Landungen aus der ABLEITUNG, nicht aus einer Aufzaehlung', () => {
    // Eine von Hand gepflegte Liste der Zielsysteme waere beim sechsten
    // Zielsystem falsch — und zwar unbemerkt.
    expect(libQuelle).toContain('deriveLabels')
    expect((libQuelle.match(/deriveLabels\(/g) ?? []).length).toBe(2)
  })

  it('haelt die Umbenennung als eigenes Verb im Store', () => {
    expect(sliceQuelle).toContain('renameSourceIdentity: (id, newName)')
    expect(sliceQuelle).toContain('renameRefusal(existing, id, newName)')
  })

  it('verbietet den Namen im Patch-Typ', () => {
    expect(storeQuelle).toContain("Omit<import('../types/sourceIdentity').SourceIdentity, 'id' | 'name'>")
  })

  it('zeigt die Vorschau, bevor umbenannt wird', () => {
    expect(panelQuelle).toContain("t('rename.apply'")
    expect(panelQuelle).toContain('swallowedLandings')
    // Der Block, der die Vorschau rechnet, darf GENAU EINEN Rueckgabewert mit
    // Inhalt haben: `renameImpact`. Eine zweite Rueckgabe waere ein zweiter
    // Zustand, und der stille davon („keine Vorschau") ist der, den der
    // Bedarf abschafft.
    const block = panelQuelle.slice(
      panelQuelle.indexOf('const impact = useMemo'),
      panelQuelle.indexOf('const verschluckt'),
    )
    expect(block.length).toBeGreaterThan(0)
    expect(block.match(/return /g) ?? []).toHaveLength(2)
    expect(block).toContain('if (!bound || !nameDirty) return null')
    expect(block).toContain('return renameImpact(')
  })

  it('schreibt nicht mehr bei jedem Anschlag in den Store', () => {
    // „Kam" ist ein gueltiger Zwischenstand des Tippens und ein ungueltiger
    // Rollenname; jeden davon zu speichern hiesse, den Plan waehrend des
    // Tippens dreimal umzubenennen.
    expect(panelQuelle).not.toContain('updateSourceIdentity(bound.id, { name:')
    expect(panelQuelle).toContain('setNameDraft({ id: bound.id, text: event.target.value })')
  })
})
