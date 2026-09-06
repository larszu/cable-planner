import { describe, expect, it, beforeEach } from 'vitest'
import {
  loadUserTemplates,
  promoteAsBuiltToTemplate,
  saveUserTemplate,
} from '../src/renderer/lib/projectTemplates'
import type { CablePlannerProject, ProjectRevision } from '../src/renderer/types/project'
import dialogQuelle from '../src/renderer/components/Project/TemplatesDialog.tsx?raw'
import tplQuelle from '../src/renderer/lib/projectTemplates.ts?raw'
import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'

// ---------------------------------------------------------------------------
// „Promote as-built to template" (Bedarf 75, P2).
//
//   > Trucks historically 'would need to be completely reconfigured to meet
//   > the requirements of the new job' when moving between event types. Switch
//   > configs are typically not saved back after load-out, so the next show
//   > starts from the plan rather than from the as-built.
//
// Der Bedarf nennt den Weg woertlich: „a 'promote as-built to template' action
// after load-out so the reconciliation import feeds back into the next show's
// starting point."
// ---------------------------------------------------------------------------

const geraet = (id: string, name: string) =>
  ({ id, name, x: 0, y: 0, inputs: [], outputs: [] }) as never

const projekt = (over: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Show', description: '', siteAddress: 'Halle A' },
    equipment: [],
    cables: [],
    locations: [],
    ...over,
  }) as never

const revision = (label: string, asBuilt: boolean, snapshot: CablePlannerProject, at = '2026-01-01T00:00:00.000Z'): ProjectRevision =>
  ({ id: `rev-${label}`, label, note: '', createdAt: at, asBuilt, snapshot }) as never

describe('die Ablehnung ist der Punkt', () => {
  beforeEach(() => localStorage.clear())

  it('befoerdert NICHTS, wenn kein As-Built festgeschrieben ist', () => {
    // Auf den Live-Plan auszuweichen ergaebe eine Vorlage mit dem Wort „wie
    // gebaut" darauf, die den Angebotsstand traegt — genau der Fehler, gegen
    // den Bedarf 84 geschrieben ist.
    const res = promoteAsBuiltToTemplate('X', '', projekt(), 'neutral')
    expect(res.refused).toBe('no-as-built')
    expect(res.template).toBeUndefined()
    expect(loadUserTemplates()).toEqual([])
  })

  it('ignoriert eine Revision, die kein As-Built ist', () => {
    const stand = projekt()
    const p = { ...stand, revisions: [revision('Rev A', false, stand)] } as CablePlannerProject
    expect(promoteAsBuiltToTemplate('X', '', p, 'neutral').refused).toBe('no-as-built')
  })
})

describe('befoerdert den festgeschriebenen Stand, nicht den aktuellen Plan', () => {
  beforeEach(() => localStorage.clear())

  const aufbau = () => {
    const gebaut = projekt({ equipment: [geraet('e1', 'Kamera 1')] })
    return {
      gebaut,
      jetzt: {
        ...gebaut,
        // Nach dem Abbau am Plan weitergeklickt — genau der Stand, den
        // `saveUserTemplate` naehme.
        equipment: [geraet('e1', 'Kamera 1'), geraet('e9', 'Testgerät')],
        revisions: [revision('As-Built', true, gebaut)],
      } as CablePlannerProject,
    }
  }

  it('NIMMT DEN SCHNAPPSCHUSS, nicht den Live-Plan', () => {
    const { jetzt } = aufbau()
    const res = promoteAsBuiltToTemplate('Halle A Standard', '', jetzt, 'venue')
    expect(res.refused).toBeUndefined()
    expect(res.template!.project.equipment.map((e) => e.id)).toEqual(['e1'])
    expect(res.from).toBe('As-Built')
  })

  it('unterscheidet sich damit sichtbar von `saveUserTemplate`', () => {
    const { jetzt } = aufbau()
    const normal = saveUserTemplate('Normal', '', jetzt, 'venue')
    expect(normal.project.equipment.map((e) => e.id)).toEqual(['e1', 'e9'])
  })

  it('schreibt „wie gebaut" an die Vorlage — und zwar RICHTIG', () => {
    // Der Schnappschuss traegt selbst keine Revisionen; aus ihm gelesen waere
    // die Grundlage „wie geplant". Der Inhalt IST aber der Bauzustand.
    const { jetzt } = aufbau()
    const res = promoteAsBuiltToTemplate('X', '', jetzt, 'venue')
    expect(res.template!.basis).toBe('as-built')
    // Und der abgelegte Stand traegt es auch — nicht nur der Rueckgabewert.
    expect(loadUserTemplates()[0].basis).toBe('as-built')
  })

  it('legt GENAU EINE Vorlage ab, nicht zwei', () => {
    const { jetzt } = aufbau()
    promoteAsBuiltToTemplate('X', '', jetzt, 'venue')
    expect(loadUserTemplates()).toHaveLength(1)
  })

  it('nimmt die juengste As-Built-Revision', () => {
    const alt = projekt({ equipment: [geraet('e1', 'A')] })
    const neu = projekt({ equipment: [geraet('e1', 'A'), geraet('e2', 'B')] })
    const p = {
      ...neu,
      revisions: [
        revision('Alt', true, alt, '2026-01-01T00:00:00.000Z'),
        revision('Neu', true, neu, '2026-06-01T00:00:00.000Z'),
      ],
    } as CablePlannerProject
    const res = promoteAsBuiltToTemplate('X', '', p, 'neutral')
    expect(res.from).toBe('Neu')
    expect(res.template!.project.equipment).toHaveLength(2)
  })

  it('gehorcht dem Umfang aus Bedarf 91', () => {
    const { jetzt } = aufbau()
    expect(promoteAsBuiltToTemplate('A', '', jetzt, 'venue').template!.venue).toBe('Halle A')
    localStorage.clear()
    const neutral = promoteAsBuiltToTemplate('B', '', jetzt, 'neutral').template!
    expect(neutral.venue).toBeUndefined()
    expect(neutral.project.metadata.siteAddress).toBeUndefined()
  })

  it('traegt die Revisionsliste NICHT in die Vorlage', () => {
    const { jetzt } = aufbau()
    expect(promoteAsBuiltToTemplate('X', '', jetzt, 'venue').template!.project.revisions).toBeUndefined()
  })
})

describe('Erreichbarkeit', () => {
  it('ist ein eigener Knopf neben „Aktuelles als Vorlage"', () => {
    expect(dialogQuelle).toContain('onClick={() => void promoteCurrent()}')
    expect(dialogQuelle).toContain("t('templates.promote'")
    expect(dialogQuelle).toContain('promoteAsBuiltToTemplate(name, current.metadata.description')
  })

  it('SAGT den Grund, statt still etwas anderes zu tun', () => {
    expect(dialogQuelle).toMatch(/if \(res\.refused\) \{[\s\S]{0,600}templates\.promoteNoneBody/)
    // Und danach wird nichts gespeichert.
    expect(dialogQuelle).toMatch(/tone: 'warning',\n\s*\}\)\n\s*return/)
  })

  it('bleibt ANKLICKBAR ohne As-Built — ein grauer Knopf erklaert nichts', () => {
    expect(dialogQuelle).toContain('const hasAsBuilt = !!latestAsBuilt(')
    expect(dialogQuelle).toMatch(/title=\{\n\s*hasAsBuilt/)
    // Kein `disabled` an diesem Knopf.
    const block = dialogQuelle.slice(
      dialogQuelle.indexOf('onClick={() => void promoteCurrent()}'),
      dialogQuelle.indexOf("t('templates.promote'"),
    )
    expect(block).not.toContain('disabled')
  })

  it('fragt denselben Umfang wie beim normalen Speichern', () => {
    const block = dialogQuelle.slice(
      dialogQuelle.indexOf('const promoteCurrent = async'),
      dialogQuelle.indexOf('const removeTemplate ='),
    )
    expect(block.length).toBeGreaterThan(0)
    expect(block).toContain('venueBoundCount(current)')
    expect(block).toContain('await venueScopeDialog(')
    expect(block).toMatch(/if \(antwort === null\) return/)
  })

  it('korrigiert die Grundlage im Modul, nicht in der Oberflaeche', () => {
    // Sonst haette eine zweite Oberflaeche denselben Fehler wieder.
    expect(tplQuelle).toContain("const korrigiert: ProjectTemplate = { ...tpl, basis: 'as-built' }")
  })

  it('hat fuer jeden neuen Text einen EN-Eintrag', () => {
    for (const key of [
      'templates.promote',
      'templates.promoteHint',
      'templates.promoteNamePrompt',
      'templates.promoteNoneTitle',
      'templates.promoteNoneBody',
      'templates.promotedBody',
    ]) {
      expect(dictsQuelle).toContain(`'${key}'`)
    }
  })
})
