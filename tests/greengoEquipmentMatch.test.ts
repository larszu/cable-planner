import { describe, expect, it } from 'vitest'
import { autoMatchEquipment } from '../src/renderer/lib/importGreengo'
import dialogSrc from '../src/renderer/components/Export/GreenGoExportDialog.tsx?raw'
import dictsSrc from '../src/renderer/lib/i18n/dicts.ts?raw'
import type { GreenGoUser } from '../src/renderer/types/greengo'

// ADR-005, Inkrement 4, Regel 2 — was die Datei nicht sagt, darf sie nicht
// loeschen.
//
// Die Zuordnung Station -> Canvas-Geraet ist Wissen DIESES Projekts; in der
// .gg5 steht sie nicht. Der Import hat sie trotzdem jedes Mal neu geraten und
// die von Hand gesetzten Verknuepfungen ueberschrieben.
//
// Der Fall aus der Halle: der Intercom-Techniker schickt eine korrigierte
// Matrix (Gruppen umsortiert, Namen gleich). Der Nutzer importiert sie — und
// die Zuordnungen, die er vorher einzeln geklickt hat, sind wieder Ratewerk
// aus Namensaehnlichkeit. Nichts meldete das.

const user = (id: number, name: string, equipmentId?: string): GreenGoUser => ({
  id,
  name,
  groupIds: [],
  ...(equipmentId ? { equipmentId } : {}),
})

const canvas = [
  { id: 'eq-a', name: 'GreenGo BPX 1' },
  { id: 'eq-b', name: 'GreenGo BPX 2' },
  { id: 'eq-c', name: 'GreenGo BPX 3' },
]

describe('autoMatchEquipment — der vorhandene Stand ueberlebt den Re-Import', () => {
  it('behaelt die von Hand gesetzte Zuordnung bei gleichem Slot und Namen', () => {
    // Von Hand: Slot 1 haengt an eq-c, obwohl das Raten eq-a gewaehlt haette.
    const bisher = [user(1, 'BPX1', 'eq-c')]
    const ausDatei = [user(1, 'BPX1')]
    const report = autoMatchEquipment(ausDatei, canvas, bisher)
    expect(report.mapping.get(1)).toBe('eq-c')
    expect(report.kept).toEqual([1])
    expect(report.renamed).toEqual([])
    expect(report.stale).toEqual([])
  })

  it('ohne den vorhandenen Stand raet es wie zuvor — der alte Fehler, sichtbar', () => {
    const report = autoMatchEquipment([user(1, 'BPX1')], canvas)
    expect(report.mapping.get(1)).toBe('eq-a')
    expect(report.kept).toEqual([])
  })

  it('die behaltene Zuordnung belegt das Geraet, bevor geraten wird', () => {
    // Ohne Schritt 0 wuerde Slot 2 sich eq-b schnappen und Slot 1 (der eq-b
    // von Hand hatte) danach doppelt darauf zeigen.
    const bisher = [user(2, 'BPX2', 'eq-a')]
    const ausDatei = [user(1, 'BPX1'), user(2, 'BPX2')]
    const report = autoMatchEquipment(ausDatei, canvas, bisher)
    expect(report.mapping.get(2)).toBe('eq-a')
    expect(report.mapping.get(1)).not.toBe('eq-a')
    expect(new Set(report.mapping.values()).size).toBe(2)
  })

  it('meldet den umbenannten Slot und raet dort neu', () => {
    // Gleicher Slot, anderer Name: der Slot ist moeglicherweise umgewidmet.
    // Dann ist Raten richtig — aber es muss gesagt werden.
    const bisher = [user(1, 'Regie', 'eq-c')]
    const ausDatei = [user(1, 'BPX1')]
    const report = autoMatchEquipment(ausDatei, canvas, bisher)
    expect(report.renamed).toEqual([1])
    expect(report.kept).toEqual([])
    expect(report.mapping.get(1)).toBe('eq-a')
  })

  it('meldet ein verschwundenes Geraet und raet dort neu', () => {
    const bisher = [user(1, 'BPX1', 'eq-geloescht')]
    const report = autoMatchEquipment([user(1, 'BPX1')], canvas, bisher)
    expect(report.stale).toEqual([1])
    expect(report.mapping.get(1)).toBe('eq-a')
  })

  it('mischt behalten und geraten in einem Lauf', () => {
    const bisher = [user(1, 'BPX1', 'eq-c'), user(3, 'BPX3', 'eq-a')]
    const ausDatei = [user(1, 'BPX1'), user(2, 'BPX2'), user(3, 'BPX3')]
    const report = autoMatchEquipment(ausDatei, canvas, bisher)
    expect(report.kept).toEqual([1, 3])
    expect(report.mapping.get(1)).toBe('eq-c')
    expect(report.mapping.get(3)).toBe('eq-a')
    // Slot 2 bleibt dem Raten ueberlassen — und nimmt das einzige freie.
    expect(report.mapping.get(2)).toBe('eq-b')
  })

  it('kommt ohne vorhandenen Stand und ohne Treffer klar', () => {
    const report = autoMatchEquipment([user(1, 'Regie')], [], [])
    expect(report.mapping.size).toBe(0)
    expect(report.kept).toEqual([])
  })
})

// Regel 3 — der Unterschied zwischen „uebernommen" und „geraten" ist
// unsichtbar, wenn ihn niemand zeigt. Der Bericht haengt im Import-Overlay,
// also genau dort, wo der Nutzer noch korrigieren kann.
describe('das Import-Overlay zeigt den Bericht', () => {
  it('reicht den vorhandenen Stand in den Abgleich', () => {
    const call = dialogSrc.replace(/^\s*\/\/.*$/gm, '')
    expect(call).toContain('autoMatchEquipment(result.config.users, intercomEquipment, config.users)')
  })

  it('rendert behalten, umbenannt und verschwunden', () => {
    expect(dialogSrc).toContain('greengo.importOverlay.matchKept')
    expect(dialogSrc).toContain('greengo.importOverlay.matchRenamed')
    expect(dialogSrc).toContain('greengo.importOverlay.matchStale')
  })

  it('sagt es auch auf Englisch', () => {
    expect(dictsSrc).toContain('hand-set mappings are preserved')
    expect(dictsSrc).toContain('the mapping was guessed again')
  })
})
