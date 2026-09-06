import { describe, expect, it, beforeEach } from 'vitest'
import { useProjectStore } from '../src/renderer/store/projectStore'
import { hasOmissions } from '../src/renderer/lib/templateAddReport'
import type { EquipmentTemplate } from '../src/renderer/types/equipment'
import csvQuelle from '../src/renderer/components/Import/CsvImportDialog.tsx?raw'
import graphmlQuelle from '../src/renderer/components/Import/GraphmlImportDialog.tsx?raw'
import projectTabQuelle from '../src/renderer/components/Settings/tabs/ProjectTab.tsx?raw'
import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'

// ---------------------------------------------------------------------------
// Keine Mengen-Operation endet stumm (Bedarf 65, P2).
//
//   > Any set operation in the suite (scan a case, import a list, mark a rack
//   > packed) must end with an explicit success/skipped/why account that is
//   > actionable on the spot. CHEAPEST RELIABILITY WIN IN THE WHOLE DOSSIER.
//
// Beleg: grokability/snipe-it#18106 — „bulk checkout does not display any
// Alerts. Also the Asset is excluded from the list… Especially if scanning
// multiple items." Der Fall dort: das Case faehrt unvollstaendig los.
//
// In dieser Anwendung ueberspringt `addCustomTemplates` bestehende Namen. Das
// ist RICHTIG (Bedarf 96: ein Import darf Handarbeit nicht ueberschreiben).
// Falsch war, dass es niemand erfuhr -- an drei Stellen auf drei Arten.
// ---------------------------------------------------------------------------

const tpl = (name: string): EquipmentTemplate =>
  ({ name, category: 'Test', inputs: [], outputs: [], width: 220, height: 60 }) as EquipmentTemplate

beforeEach(() => {
  useProjectStore.setState({ customLibrary: [] })
})

describe('der Bericht sagt, was passiert ist', () => {
  it('nennt die neu angelegten Namen', () => {
    const r = useProjectStore.getState().addCustomTemplates([tpl('ATEM'), tpl('HyperDeck')])
    expect(r.added).toEqual(['ATEM', 'HyperDeck'])
    expect(r.skipped).toEqual([])
    expect(hasOmissions(r)).toBe(false)
  })

  it('nennt die uebersprungenen Namen — und ueberschreibt sie NICHT', () => {
    const eigen = { ...tpl('ATEM'), category: 'Von Hand gepflegt' }
    useProjectStore.setState({ customLibrary: [eigen] })
    const r = useProjectStore.getState().addCustomTemplates([tpl('ATEM'), tpl('Neu')])
    expect(r.added).toEqual(['Neu'])
    expect(r.skipped).toEqual(['ATEM'])
    expect(hasOmissions(r)).toBe(true)
    // Bedarf 96: die Handarbeit steht noch da.
    expect(
      useProjectStore.getState().customLibrary.find((t) => t.name === 'ATEM')?.category,
    ).toBe('Von Hand gepflegt')
  })

  it('zaehlt namenlose Eintraege, statt sie sich gegenseitig ueberschreiben zu lassen', () => {
    // Zwei namenlose haetten denselben leeren Schluessel; die zweite
    // ueberschriebe die erste. Ein yEd-Knoten ohne Beschriftung ist genau
    // dieser Fall.
    const r = useProjectStore.getState().addCustomTemplates([tpl(''), tpl('  '), tpl('Echt')])
    expect(r.unnamed).toBe(2)
    expect(r.added).toEqual(['Echt'])
    expect(useProjectStore.getState().customLibrary).toHaveLength(1)
  })

  it('nennt einen INNERHALB der Menge doppelten Namen nur einmal als uebersprungen', () => {
    const r = useProjectStore.getState().addCustomTemplates([tpl('ATEM'), tpl('ATEM')])
    expect(r.added).toEqual(['ATEM'])
    expect(r.skipped).toEqual(['ATEM'])
  })

  it('meldet bei leerer Eingabe nichts und aendert nichts', () => {
    const r = useProjectStore.getState().addCustomTemplates([])
    expect(hasOmissions(r)).toBe(false)
    expect(r.added).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// ERREICHBARKEIT. Ein Bericht, den kein Aufrufer liest, ist keine Auskunft.
// Genau das war der Zustand: die Zahl kam aus der Datei, aus dem Plan, oder
// gar nicht -- nur nicht aus dem Ergebnis.
// ---------------------------------------------------------------------------
describe('alle drei Aufrufer melden das Ergebnis', () => {
  it('CSV-Import nimmt die Zahl aus dem BERICHT, nicht aus dem Plan', () => {
    expect(csvQuelle).toContain('const bericht = addCustomTemplates(templates)')
    expect(csvQuelle).toContain('n: bericht.added.length')
    // Der Plan bleibt die Vorschau VOR dem Klick — aber er liefert die
    // Erfolgszahl nicht mehr.
    expect(csvQuelle).not.toContain('n: plan.fresh.length')
  })

  it('Library-Import meldet die ANGELEGTE Zahl, nicht die aus der Datei', () => {
    expect(projectTabQuelle).toContain('bericht = addCustomTemplates(data.customLibrary)')
    expect(projectTabQuelle).toContain('${bericht.added.length}')
    // Die Datei-Zahl war der Fehler: 200 importiert, 3 angelegt, „200" gemeldet.
    expect(projectTabQuelle).not.toContain('${data.customLibrary?.length ?? 0}')
    expect(projectTabQuelle).toContain('hasOmissions(bericht)')
  })

  it('GraphML-Import meldet ueberhaupt etwas', () => {
    // Dieser Zweig schloss den Dialog kommentarlos.
    expect(graphmlQuelle).toContain('const bericht = addCustomTemplates(templates)')
    expect(graphmlQuelle).toContain("t('graphml.dialog.libDoneTitle'")
    expect(graphmlQuelle).toContain('bericht.added.length')
  })

  it('hat fuer jeden neuen Text einen EN-Eintrag', () => {
    for (const key of [
      'settings.project.libImport.skipped',
      'settings.project.libImport.unnamed',
      'graphml.dialog.libDoneTitle',
      'graphml.dialog.libDoneBody',
      'graphml.dialog.libUnnamed',
    ]) {
      expect(dictsQuelle).toContain(`'${key}'`)
    }
  })

  it('die Auskunft steht am ENGPASS, nicht dreimal daneben', () => {
    // Drei Aufrufer, eine Wahrheit. Wer die Zahl selbst nachrechnet, rechnet
    // sie irgendwann anders — genau das war der Zustand vorher.
    for (const quelle of [csvQuelle, graphmlQuelle, projectTabQuelle]) {
      expect(quelle).toMatch(/bericht(\s*)=(\s*)addCustomTemplates\(/)
    }
  })
})
