import { beforeEach, describe, expect, it } from 'vitest'
import {
  PRE_SHOW_HEADERS,
  TALLY_VERDICT_LABEL,
  buildTallyCheck,
  checksOf,
  lastCheck,
  normaliseTallyPositions,
  preShowTallyTable,
  tallyPositionFindings,
  tallyVerdict,
} from '../src/renderer/lib/tallyPosition'
import {
  NOT_CHECKED,
  NO_ENDPOINT,
  NO_LAMP,
  TALLY_OBSERVATION_LABEL,
  TALLY_TRANSPORT_LABEL,
  type TallyObservation,
  type TallyPosition,
} from '../src/renderer/types/tallyPosition'
import { DOCUMENT_STANDS } from '../src/renderer/lib/documentRegistry'
import { useProjectStore } from '../src/renderer/store/projectStore'
import type { SourceIdentity } from '../src/renderer/types/sourceIdentity'
import libQuelle from '../src/renderer/lib/tallyPosition.ts?raw'
import typenQuelle from '../src/renderer/types/tallyPosition.ts?raw'
import panelQuelle from '../src/renderer/components/Tally/TallyPreShowPanel.tsx?raw'
import dialogQuelle from '../src/renderer/components/Export/ExportDialog.tsx?raw'
import storeQuelle from '../src/renderer/store/projectStore.ts?raw'

// ---------------------------------------------------------------------------
// Das Tally je Position (Bedarf 105, P3).
//
//   > Tally is TRUSTED UNTIL IT LIES; software tally over NDI/TSL misreports,
//   > blinks, or needs port workarounds, and lamp brightness is often wrong
//   > for the ambient light.
//
// Belegt an `DistroAV/DistroAV#318` (2019-06-17, als „not planned"
// geschlossen): OBS-NDI schickt ein Vorschau-Tally, sobald eine Quelle bloss
// in einem Multiview auftaucht — die Lampe leuchtet, ohne dass die Kamera je
// auf Sendung war. Und an der BirdDog PF120, deren Tally „rapidly blinks
// between red and green", wenn die Kamera live ist.
// ---------------------------------------------------------------------------

const rolle = (id: string, name: string): SourceIdentity => ({ id, name })
const rollen = [rolle('r1', 'Kamera 1'), rolle('r2', 'Kamera 2')]

const pos = (over: Partial<TallyPosition> = {}): TallyPosition => ({
  identityId: 'r1',
  transport: 'tsl-umd-v31',
  ...over,
})

const check = (onProgram: TallyObservation, onPreview: TallyObservation, at = '2026-09-06T10:00:00.000Z') =>
  buildTallyCheck(at, onProgram, onPreview)

// ── 1. Ohne Hinsehen kein Urteil ───────────────────────────────────────────

describe('tallyVerdict — das Vertrauen bekommt ein Datum', () => {
  it('sagt „nicht geprueft", wo niemand hingesehen hat', () => {
    // DER Satz aus dem Beleg: „tally is trusted until it lies". Eine
    // eingetragene Adresse ist eine ABSICHT, keine Beobachtung — und genau
    // diese Verwechslung kostet die Sendung.
    expect(tallyVerdict(undefined)).toBe('unchecked')
    expect(tallyVerdict(pos())).toBe('unchecked')
    expect(tallyVerdict(pos({ endpoint: '10.0.0.5', lamp: 'Kamerakopf' }))).toBe('unchecked')
  })

  it('zaehlt eine Pruefung ohne Beobachtung nicht als Pruefung', () => {
    // Die Zeile braucht KEINE eigene Abfrage im Code: „nicht geprueft" ist der
    // Rueckfall am Ende von `tallyVerdict`, und dieser Test haelt genau das
    // fest. Eine zusaetzliche Abfrage waere nachweislich wirkungslos gewesen —
    // die Gegenprobe hat sie als solche entlarvt und sie ist entfernt.
    expect(tallyVerdict(pos({ checks: [check('not-checked', 'not-checked')] }))).toBe('unchecked')
  })

  it('nennt eine HALBE Pruefung nicht „in Ordnung"', () => {
    // Der Fehler, den die Gegenprobe gefunden hat: bis dahin genuegte „rot auf
    // Programm". Der Fall aus `DistroAV#318` sitzt aber in der VORSCHAU — wer
    // nur das Programm sieht, findet ihn nie und haelt die Position fuer
    // geprueft.
    expect(tallyVerdict(pos({ checks: [check('red', 'not-checked')] }))).toBe('unchecked')
    expect(tallyVerdict(pos({ checks: [check('not-checked', 'green')] }))).toBe('unchecked')
  })

  it('nennt rot auf Programm und nicht-rot auf Vorschau richtig', () => {
    expect(tallyVerdict(pos({ checks: [check('red', 'green')] }))).toBe('verified')
    expect(tallyVerdict(pos({ checks: [check('red', 'off')] }))).toBe('verified')
  })

  it('nennt die dunkle Lampe beim Namen', () => {
    expect(tallyVerdict(pos({ checks: [check('off', 'off')] }))).toBe('dark')
  })
})

// ── 2. Die Luege ───────────────────────────────────────────────────────────

describe('was als Luege zaehlt', () => {
  it('meldet ROT auf VORSCHAU — der Fall aus DistroAV#318', () => {
    // Die gefaehrlichere Richtung: der Operator sieht rot und glaubt, er sei
    // auf Sendung. Auch dann, wenn das Programm-Tally stimmt.
    expect(tallyVerdict(pos({ checks: [check('red', 'red')] }))).toBe('lying')
  })

  it('meldet BLINKEN — der Fall der BirdDog PF120', () => {
    // Die Lampe ist da und nicht lesbar. „Aus" waere ehrlicher.
    expect(tallyVerdict(pos({ checks: [check('blinking', 'off')] }))).toBe('lying')
    expect(tallyVerdict(pos({ checks: [check('red', 'blinking')] }))).toBe('lying')
  })

  it('meldet die falsche Farbe und die falsche Position', () => {
    expect(tallyVerdict(pos({ checks: [check('wrong-colour', 'off')] }))).toBe('lying')
    expect(tallyVerdict(pos({ checks: [check('wrong-position', 'off')] }))).toBe('lying')
  })

  it('meldet gruen auf PROGRAMM als Luege, nicht als dunkel', () => {
    expect(tallyVerdict(pos({ checks: [check('green', 'green')] }))).toBe('lying')
  })

  it('laesst die Luege alles andere schlagen', () => {
    // Eine Position, die auf Vorschau rot zeigt, ist nicht „teilweise in
    // Ordnung", weil das Programm-Tally stimmt.
    expect(tallyVerdict(pos({ checks: [check('red', 'red')] }))).not.toBe('verified')
  })

  it('haelt fuer jedes Urteil eine lesbare Ueberschrift bereit', () => {
    for (const k of ['verified', 'lying', 'dark', 'unchecked'] as const) {
      expect(TALLY_VERDICT_LABEL[k].length).toBeGreaterThan(5)
    }
  })
})

// ── 3. Das Protokoll ───────────────────────────────────────────────────────

describe('die Pruefungen als Protokoll', () => {
  it('nimmt die juengste, nicht die erste', () => {
    // „Gestern ging es, heute nicht" ist die Auskunft, die den Fehler findet.
    const p = pos({
      checks: [
        check('red', 'green', '2026-09-01T10:00:00.000Z'),
        check('off', 'off', '2026-09-06T10:00:00.000Z'),
      ],
    })
    expect(lastCheck(p)?.at).toBe('2026-09-06T10:00:00.000Z')
    expect(tallyVerdict(p)).toBe('dark')
  })

  it('sortiert jung zuerst, ohne die Quelle zu drehen', () => {
    const liste = [check('red', 'green', '2026-09-01T10:00:00.000Z'), check('off', 'off')]
    const p = pos({ checks: liste })
    expect(checksOf(p).map((c) => c.at)).toEqual([
      '2026-09-06T10:00:00.000Z',
      '2026-09-01T10:00:00.000Z',
    ])
    expect(liste[0].at).toBe('2026-09-01T10:00:00.000Z')
  })

  it('laesst leere Angaben weg, statt sie als leeren String zu fuehren', () => {
    // `toEqual` sieht ein `undefined`-Feld nicht, ein JSON-Roundtrip aber
    // auch nicht — und dann steht im Protokoll eine leere Zelle, wo gar
    // nichts stehen sollte.
    const c = buildTallyCheck('2026-09-06T10:00:00.000Z', 'red', 'green', '  ', '')
    expect('by' in c).toBe(false)
    expect('note' in c).toBe(false)
    expect(buildTallyCheck('2026-09-06T10:00:00.000Z', 'red', 'green', ' Lars ').by).toBe('Lars')
  })
})

// ── 4. Die Befunde ─────────────────────────────────────────────────────────

describe('tallyPositionFindings', () => {
  it('meldet die Rolle ohne jeden Tally-Datensatz', () => {
    const f = tallyPositionFindings(rollen, [])
    expect(f.filter((x) => x.kind === 'no-position')).toHaveLength(2)
  })

  it('meldet den fehlenden Weg und die fehlende Adresse getrennt', () => {
    const f = tallyPositionFindings([rollen[0]], [pos({ transport: 'unknown' })])
    expect(f.some((x) => x.kind === 'no-transport')).toBe(true)
    expect(f.some((x) => x.kind === 'no-endpoint')).toBe(false)

    const g = tallyPositionFindings([rollen[0]], [pos({ transport: 'gpio' })])
    expect(g.some((x) => x.kind === 'no-endpoint')).toBe(true)
    expect(g.some((x) => x.kind === 'no-transport')).toBe(false)
  })

  it('warnt beim NDI-Weg mit dem Beleg, statt zu schweigen', () => {
    // Kein Fehler DIESES Plans — aber der Grund, hier hinzusehen.
    const f = tallyPositionFindings([rollen[0]], [pos({ transport: 'ndi', endpoint: 'CAM1 (OBS)' })])
    const ndi = f.find((x) => x.kind === 'ndi-preview-warning')
    expect(ndi).toBeDefined()
    expect(ndi?.message).toContain('DistroAV#318')
    expect(ndi?.message).toContain('Vorschau')
  })

  it('unterscheidet „nie geprueft" von „nur halb geprueft"', () => {
    // Fuer den Bedienenden sind das zwei verschiedene Aufgaben: hinsehen
    // gegen zu Ende sehen. Ein gemeinsamer Befund schickte ihn zweimal
    // dieselbe Strecke.
    const nie = tallyPositionFindings([rollen[0]], [pos({ endpoint: '5' })])
    expect(nie.some((x) => x.kind === 'unchecked')).toBe(true)
    expect(nie.some((x) => x.kind === 'half-checked')).toBe(false)

    const halb = tallyPositionFindings(
      [rollen[0]],
      [pos({ endpoint: '5', checks: [check('red', 'not-checked')] })],
    )
    const befund = halb.find((x) => x.kind === 'half-checked')
    expect(befund).toBeDefined()
    expect(befund?.message).toContain('Vorschau')
    expect(befund?.message).toContain('DistroAV#318')
    expect(halb.some((x) => x.kind === 'unchecked')).toBe(false)
  })

  it('nennt beim fehlenden Programm-Tally die andere Haelfte', () => {
    const befund = tallyPositionFindings(
      [rollen[0]],
      [pos({ endpoint: '5', checks: [check('not-checked', 'green')] })],
    ).find((x) => x.kind === 'half-checked')
    expect(befund?.message).toContain('Programm')
  })

  it('macht aus der Luege einen FEHLER und aus dem Ungeprueften einen Hinweis', () => {
    const luegt = tallyPositionFindings(
      [rollen[0]],
      [pos({ endpoint: '5', checks: [check('red', 'red')] })],
    )
    expect(luegt.find((x) => x.kind === 'lying')?.severity).toBe('error')

    const offen = tallyPositionFindings([rollen[0]], [pos({ endpoint: '5' })])
    expect(offen.find((x) => x.kind === 'unchecked')?.severity).toBe('warning')
  })

  it('nennt in der Luege, WAS zu sehen war', () => {
    // „Tally kaputt" schickt niemanden zum richtigen Geraet.
    const f = tallyPositionFindings(
      [rollen[0]],
      [pos({ endpoint: '5', checks: [check('blinking', 'off')] })],
    )
    expect(f.find((x) => x.kind === 'lying')?.message).toContain(
      TALLY_OBSERVATION_LABEL.blinking,
    )
  })

  it('meldet nichts Ueberfluessiges bei einer geprueften, vollstaendigen Position', () => {
    const f = tallyPositionFindings(
      [rollen[0]],
      [pos({ endpoint: '5', lamp: 'Kamerakopf', checks: [check('red', 'green')] })],
    )
    expect(f).toEqual([])
  })
})

// ── 5. Die Vor-Show-Liste ──────────────────────────────────────────────────

describe('preShowTallyTable — das Blatt, das der Bedarf verlangt', () => {
  it('haelt den Spaltenkopf fest', () => {
    expect(preShowTallyTable(rollen, []).headers).toEqual([...PRE_SHOW_HEADERS])
  })

  it('fuehrt JEDE Rolle, auch die ohne Datensatz', () => {
    // Eine Checkliste, die nur zeigt, was schon eingetragen ist, hakt genau
    // die Positionen nicht ab, an denen niemand war.
    const table = preShowTallyTable(rollen, [pos({ endpoint: '5' })])
    expect(table.rows).toHaveLength(2)
    expect(table.rows.map((r) => r[0])).toEqual(['Kamera 1', 'Kamera 2'])
  })

  it('schreibt einen NAMEN statt einer leeren Zelle', () => {
    const [zeile] = preShowTallyTable([rollen[0]], []).rows
    expect(zeile[1]).toBe(TALLY_TRANSPORT_LABEL.unknown)
    expect(zeile[2]).toBe(NO_ENDPOINT)
    expect(zeile[3]).toBe(NO_LAMP)
    expect(zeile[4]).toBe(TALLY_OBSERVATION_LABEL['not-checked'])
    expect(zeile[6]).toBe(NOT_CHECKED)
    expect(zeile[7]).toBe(TALLY_VERDICT_LABEL.unchecked)
  })

  it('traegt das Datum der letzten Pruefung', () => {
    const [zeile] = preShowTallyTable(
      [rollen[0]],
      [pos({ endpoint: '5', checks: [check('red', 'green')] })],
    ).rows
    expect(zeile[6]).toBe('2026-09-06')
    expect(zeile[7]).toBe(TALLY_VERDICT_LABEL.verified)
  })

  it('hat einen eintragbaren Stand — sonst kaeme sie ohne Datum aus dem Drucker', () => {
    expect(typeof DOCUMENT_STANDS['tally-vorshow']).toBe('function')
  })
})

// ── 6. Was beim Laden ueberlebt ────────────────────────────────────────────

describe('normaliseTallyPositions — die Schema-Migrationsschicht', () => {
  it('wirft weg, was auf keine Rolle zeigt', () => {
    expect(normaliseTallyPositions([{ transport: 'gpio' }])).toEqual([])
    expect(normaliseTallyPositions([{ identityId: '  ' }])).toEqual([])
  })

  it('nimmt bei zwei Datensaetzen fuer dieselbe Rolle den ersten', () => {
    // Zwei sind zwei Wahrheiten. Dieselbe Regel wie bei
    // `normaliseSourceIdentities`.
    const out = normaliseTallyPositions([
      { identityId: 'r1', transport: 'gpio' },
      { identityId: 'r1', transport: 'ndi' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].transport).toBe('gpio')
  })

  it('macht aus einem unbekannten Weg „unknown" statt ihn zu uebernehmen', () => {
    expect(normaliseTallyPositions([{ identityId: 'r1', transport: 'zauberei' }])[0].transport).toBe(
      'unknown',
    )
  })

  it('macht aus einer unbekannten Beobachtung „not-checked"', () => {
    const out = normaliseTallyPositions([
      { identityId: 'r1', transport: 'gpio', checks: [{ at: '2026-09-06', onProgram: 'lila' }] },
    ])
    expect(out[0].checks?.[0].onProgram).toBe('not-checked')
    expect(out[0].checks?.[0].onPreview).toBe('not-checked')
  })

  it('wirft eine Pruefung ohne Zeitpunkt weg', () => {
    // Eine Beobachtung ohne Datum beantwortet die einzige Frage nicht, um die
    // es geht: WANN hat jemand hingesehen.
    const out = normaliseTallyPositions([
      { identityId: 'r1', transport: 'gpio', checks: [{ onProgram: 'red', onPreview: 'green' }] },
    ])
    expect('checks' in out[0]).toBe(false)
  })

  it('laesst leere Felder weg statt sie leer zu fuehren', () => {
    const out = normaliseTallyPositions([{ identityId: 'r1', transport: 'gpio', endpoint: '  ' }])
    expect('endpoint' in out[0]).toBe(false)
    expect('lamp' in out[0]).toBe(false)
  })
})

// ── 7. Der Store ───────────────────────────────────────────────────────────

describe('die Verben im Store', () => {
  beforeEach(() => {
    useProjectStore.setState((s) => ({
      project: { ...s.project, sourceIdentities: [rolle('r1', 'Kamera 1')], tallyPositions: [] },
    }))
  })

  const state = () => useProjectStore.getState()

  it('legt den Datensatz beim ersten Setzen an', () => {
    expect(state().setTallyPosition('r1', { transport: 'gpio' })).toBeUndefined()
    expect(state().project.tallyPositions).toEqual([{ identityId: 'r1', transport: 'gpio' }])
  })

  it('lehnt eine unbekannte Rolle ab, statt ins Leere zu schreiben', () => {
    expect(state().setTallyPosition('weg', { transport: 'gpio' })).toBe('unknown-role')
    expect(state().recordTallyCheck('weg', check('red', 'green'))).toBe('unknown-role')
    expect(state().project.tallyPositions).toEqual([])
  })

  it('haengt die Pruefung an, statt die vorige zu ersetzen', () => {
    state().recordTallyCheck('r1', check('red', 'green', '2026-09-01T10:00:00.000Z'))
    state().recordTallyCheck('r1', check('off', 'off', '2026-09-06T10:00:00.000Z'))
    const p = state().project.tallyPositions?.[0]
    expect(p?.checks).toHaveLength(2)
    expect(tallyVerdict(p)).toBe('dark')
  })

  it('laesst den Weg beim Nachtragen der Pruefung stehen', () => {
    state().setTallyPosition('r1', { transport: 'gpio', endpoint: '17' })
    state().recordTallyCheck('r1', check('red', 'green'))
    const p = state().project.tallyPositions?.[0]
    expect(p?.transport).toBe('gpio')
    expect(p?.endpoint).toBe('17')
  })

  it('wirft beim Laden weg, was auf eine geloeschte Rolle zeigt', () => {
    // Ein Datensatz auf eine geloeschte Rolle saehe auf dem Vor-Show-Blatt
    // aus wie eine gepruefte Position und zeigte ins Leere.
    expect(storeQuelle).toContain('normaliseTallyPositions(project.tallyPositions).filter')
    expect(storeQuelle).toContain('identityIds.has(p.identityId)')
  })
})

// ── 8. Reinheit und Erreichbarkeit ─────────────────────────────────────────

describe('das Modul und die Oberflaeche', () => {
  it('nimmt keine Uhr und keinen Store', () => {
    // Der Zeitpunkt einer Beobachtung gehoert dem Beobachter. Ein Modul, das
    // seine eigene Zeit naehme, stempelte dieselbe Pruefung bei jedem Aufruf
    // anders.
    expect(libQuelle).not.toContain('new Date(')
    expect(libQuelle).not.toContain('Date.now')
    expect(libQuelle).not.toContain('useProjectStore')
  })

  it('begruendet in den Typen, warum die Adresse NICHT geprueft wird', () => {
    // Wer sie spaeter validieren will, soll erst lesen, warum sie es nicht
    // ist: was gueltig ist, haengt am Transport, und eine Pruefung, die drei
    // Formen halb kann, weist gueltige Eintraege ab.
    expect(typenQuelle).toContain('prüft ihn NICHT')
  })

  it('nennt in den Typen beide Belege', () => {
    expect(typenQuelle).toContain('DistroAV/DistroAV#318')
    expect(typenQuelle).toContain('PF120')
  })

  it('haengt an der ROLLE und nicht am Geraet', () => {
    expect(typenQuelle).toContain('identityId')
    expect(typenQuelle).not.toContain('equipmentId')
  })

  it('ist im Tally-Abschnitt erreichbar', () => {
    expect(dialogQuelle).toContain('<TallyPreShowPanel />')
  })

  it('nimmt die Uhr in der OBERFLAECHE, wo die Beobachtung gemacht wird', () => {
    expect(panelQuelle).toContain('buildTallyCheck(new Date().toISOString()')
  })

  it('haelt den Entwurf, statt beim Durchklicken zu protokollieren', () => {
    // Ein Dropdown, das sofort schreibt, legte beim Durchklicken drei
    // Beobachtungen ins Protokoll — und das Protokoll ist genau das, woran
    // man spaeter „gestern ging es" abliest.
    expect(panelQuelle).toContain('setEntwurf')
    const block = panelQuelle.slice(
      panelQuelle.indexOf('const festhalten'),
      panelQuelle.indexOf('const listeLaden'),
    )
    expect(block).toContain('recordTallyCheck(')
    // GENAU EIN Aufruf: der im Knopf. Ein zweiter waere der Weg, der beim
    // Durchklicken protokolliert.
    expect(panelQuelle.match(/recordTallyCheck\(/g) ?? []).toHaveLength(1)
  })

  it('schreibt keine Pruefung ohne Beobachtung', () => {
    expect(panelQuelle).toContain(
      "if (e.onProgram === 'not-checked' && e.onPreview === 'not-checked') return",
    )
  })
})
