import { describe, expect, it } from 'vitest'
import { presetFromDraft, type RackPresetDraft } from '../src/renderer/lib/rackPreset'
import type { RackPlacementDraft } from '../src/renderer/components/Rack/rackBuilderTypes'
import exportMenuSrc from '../src/renderer/components/Rack/RackBuilderDialogExportMenu.tsx?raw'

// ADR-005, Inkrement 4 — der .cpgroup-Export packte ein Rack ohne Kabel aus.
//
// Die Umwandlung Draft → GroupPreset stand ZWEIMAL von Hand im Code: im
// Speichern-Pfad des RackBuilderDialog und im Export-Menue daneben. Die
// zweite schrieb `cables: []` — die komplette interne Verkabelung fehlte in
// der Datei, obwohl der Menuepunkt „Komplettes Rack inkl. STL + Fotos"
// verspricht und itemExport.ts das Format als „inkl. interne Kabel" fuehrt.
//
// Dazu fehlten `internalCanvasPositions` und, seit #335, beide `rentmanId`.
// Die kamen nur in den Speichern-Pfad; die zweite Aufzaehlung wurde nicht
// nachgezogen, weil niemand einen Grund hatte, dort zu suchen.
//
// Der Nutzer nahm sein Rack per USB-Stick mit und packte es am Zielrechner
// ohne eine einzige interne Verbindung wieder aus.
//
// Behoben, indem die zweite Aufzaehlung GELOESCHT wurde: beide Wege rufen
// jetzt presetFromDraft. Diese Tests halten fest, was dabei mitkommen muss.

const place = (over: Partial<RackPlacementDraft> & { id: string; startUnit: number }): RackPlacementDraft =>
  ({
    templateName: 'T',
    name: `Gerät ${over.id}`,
    category: 'Sonstiges',
    rackUnits: 1,
    inputs: [{ id: 'i1', name: 'IN 1', type: 'port', connectorType: 'BNC' }],
    outputs: [{ id: 'o1', name: 'OUT 1', type: 'port', connectorType: 'BNC' }],
    isRackDevice: true,
    ...over,
  }) as unknown as RackPlacementDraft

const draft = (over: Partial<RackPresetDraft> = {}): RackPresetDraft => ({
  rackName: 'Regie-Rack',
  totalUnits: 24,
  placements: [place({ id: 'a', startUnit: 3 }), place({ id: 'b', startUnit: 1 })],
  internalCables: [],
  ...over,
})

describe('presetFromDraft — was in die .cpgroup gehoert', () => {
  it('traegt die interne Verkabelung mit — der eigentliche Fehler', () => {
    const out = presetFromDraft(
      draft({
        internalCables: [
          {
            fromPlacementId: 'b',
            fromPortName: 'OUT 1',
            toPlacementId: 'a',
            toPortName: 'IN 1',
            name: 'Patch 1',
            type: 'BNC',
            length: 0.5,
            color: '#ff0000',
            standard: 'SDI',
            waypoints: [{ x: 10, y: 20 }],
          },
        ],
      }),
    )
    expect(out.cables).toHaveLength(1)
    // Nach startUnit sortiert: b (1) -> Index 0, a (3) -> Index 1.
    expect(out.cables[0]).toEqual({
      fromItemIndex: 0,
      fromPortName: 'OUT 1',
      toItemIndex: 1,
      toPortName: 'IN 1',
      name: 'Patch 1',
      type: 'BNC',
      length: 0.5,
      color: '#ff0000',
      standard: 'SDI',
      waypoints: [{ x: 10, y: 20 }],
    })
  })

  it('bildet die Kabel auf die Indizes NACH der Sortierung ab', () => {
    // Wuerde vor dem Sortieren indiziert, zeigte das Kabel auf das falsche
    // Geraet — schlimmer als gar kein Kabel, weil es plausibel aussieht.
    const out = presetFromDraft(
      draft({
        placements: [
          place({ id: 'unten', startUnit: 10 }),
          place({ id: 'oben', startUnit: 1 }),
        ],
        internalCables: [
          {
            fromPlacementId: 'unten',
            fromPortName: 'OUT 1',
            toPlacementId: 'oben',
            toPortName: 'IN 1',
            name: 'x',
            type: 'BNC',
            length: 1,
          },
        ],
      }),
    )
    expect(out.items[0].name).toBe('Gerät oben')
    expect(out.cables[0].fromItemIndex).toBe(1) // unten
    expect(out.cables[0].toItemIndex).toBe(0) // oben
  })

  it('laesst Kabel an geloeschte Geraete fallen, statt kaputte Indizes zu schreiben', () => {
    const out = presetFromDraft(
      draft({
        internalCables: [
          {
            fromPlacementId: 'a',
            fromPortName: 'OUT 1',
            toPlacementId: 'gibt-es-nicht',
            toPortName: 'IN 1',
            name: 'verwaist',
            type: 'BNC',
            length: 1,
          },
        ],
      }),
    )
    expect(out.cables).toEqual([])
  })

  it('haelt die Canvas-Positionen der internen Ansicht', () => {
    const out = presetFromDraft(
      draft({
        placements: [
          place({ id: 'a', startUnit: 1, canvasX: 120, canvasY: 340 }),
          place({ id: 'b', startUnit: 2 }),
        ],
      }),
    )
    expect(out.rack?.internalCanvasPositions).toEqual({ 0: { x: 120, y: 340 } })
  })

  it('laesst internalCanvasPositions weg, wenn niemand etwas verschoben hat', () => {
    expect(presetFromDraft(draft()).rack?.internalCanvasPositions).toBeUndefined()
  })

  it('haelt beide Rentman-Ids (#335) — Rack und Inhalt', () => {
    const out = presetFromDraft(
      draft({
        rentmanId: 'rm-rack-9',
        placements: [place({ id: 'a', startUnit: 1, rentmanId: 'rm-dev-7' })],
      }),
    )
    expect(out.rack?.rentmanId).toBe('rm-rack-9')
    expect(out.items[0].rentmanId).toBe('rm-dev-7')
  })

  it('persistiert Shelf-Offset 0 (#521) — truthy haette die linke Kante verworfen', () => {
    const out = presetFromDraft(
      draft({ placements: [place({ id: 'a', startUnit: 1, shelfOffsetX: 0, shelfOffsetZ: 0 })] }),
    )
    expect(out.rack?.placements[0].shelfOffsetX).toBe(0)
    expect(out.rack?.placements[0].shelfOffsetZ).toBe(0)
  })

  it('uebernimmt die editingId, damit ein Rack beim Bearbeiten nicht dupliziert', () => {
    expect(presetFromDraft(draft(), 'bestehende-id').id).toBe('bestehende-id')
    expect(presetFromDraft(draft()).id).not.toBe('bestehende-id')
  })

  it('faellt bei leerem Namen auf "rack" zurueck statt auf leer', () => {
    expect(presetFromDraft(draft({ rackName: '   ' })).name).toBe('rack')
  })
})

describe('das Export-Menue baut kein eigenes Preset mehr', () => {
  // Der Fehler war nicht die Aufzaehlung selbst, sondern dass es ZWEI gab.
  // Die zweite ist geloescht; dieser Waechter haelt fest, dass sie nicht
  // zurueckkommt. Er ist schwaecher als ein Verhaltenstest — aber die
  // Divergenz zweier Aufzaehlungen ist genau das, was er sehen kann.

  it('ruft den Erbauer des Dialogs, statt selbst zu sammeln', () => {
    expect(exportMenuSrc).toContain('const preset = buildPreset()')
  })

  it('enthaelt keine eigene Feld-Aufzaehlung mehr', () => {
    // Kommentarzeilen raus: der Erklaertext oben ZITIERT `cables: []`, und
    // genau daran ist dieser Waechter im ersten Anlauf haengengeblieben.
    const code = exportMenuSrc
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n')
    expect(code).not.toContain('cables: []')
    expect(code).not.toContain('itemIndex:')
    expect(code).not.toMatch(/const preset: GroupPreset = \{/)
  })
})
