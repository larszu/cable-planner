import { describe, expect, it, beforeEach } from 'vitest'
import {
  CARRY_LABEL,
  TEMPLATE_SCOPE_LABEL,
  projectVenue,
  stripForTemplate,
  templateCarryReport,
  venueBoundCount,
} from '../src/renderer/lib/templateScope'
import { sameVenue } from '../src/renderer/lib/venueAnswers'
import { loadUserTemplates, saveUserTemplate } from '../src/renderer/lib/projectTemplates'
import type { CablePlannerProject } from '../src/renderer/types/project'
import dialogQuelle from '../src/renderer/components/Project/TemplatesDialog.tsx?raw'
import tplQuelle from '../src/renderer/lib/projectTemplates.ts?raw'
import scopeDialogQuelle from '../src/renderer/lib/venueScopeDialog.tsx?raw'
import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'

// ---------------------------------------------------------------------------
// Was von einer Show in die naechste mitgeht (Bedarf 91, P2).
//
//   > SRT latency, port negotiations, which SIM worked, which uplink was real,
//   > the mix-minus arrangement and the fallback thresholds are re-derived per
//   > event and live nowhere shared; the most valuable document in the role is
//   > the one least likely to exist.
//
// Und der Weg: „Venue and template reuse in the project model, with the
// as-built network answer and transport parameters attached."
//
// Die Vorlage gab es schon. Sie trug das Falsche mit: die Genehmigungen EINES
// Hauses, die Multicast-Adressen EINER Show und das Schluessel-Haekchen EINES
// Rechners.
// ---------------------------------------------------------------------------

const projekt = (over: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Show', description: '' },
    equipment: [],
    cables: [],
    locations: [],
    ...over,
  }) as never

const mitAllem = () =>
  projekt({
    metadata: {
      name: 'Show',
      description: '',
      siteAddress: 'Halle A',
      venueAnswers: [
        { key: 'ports', status: 'granted', venue: 'Halle A' },
        { key: 'vlan', status: 'refused', venue: 'Halle A' },
      ],
    },
    multicast: {
      pool: '239.100.0.0/16',
      basePort: 20000,
      assignments: [{ flowKey: 'cam:p1', leg: 'a', address: '239.100.0.1', port: 20000 }],
    },
    deliveryDestinations: [
      {
        id: 'd1',
        name: 'YouTube',
        platform: 'youtube',
        transport: 'RTMP',
        hasStreamKey: true,
        encoding: { videoBitrateKbps: 6000, audioBitrateKbps: 160 },
      },
    ],
    revisions: [{ id: 'r1', label: 'A', note: '', createdAt: 'x', asBuilt: false, snapshot: {} }],
    pendingChanges: [{ id: 'p1' }],
  } as never)

// ---------------------------------------------------------------------------
describe('was IMMER faellt — Behauptungen, die im neuen Projekt falsch waeren', () => {
  it('nimmt die Multicast-VERGABEN weg und laesst den POOL stehen', () => {
    // Die Adressen laufen in der Show, aus der die Vorlage stammt. Der Pool
    // ist das Schema — und genau das ist das Wiederverwendbare.
    for (const scope of ['venue', 'neutral'] as const) {
      const c = stripForTemplate(mitAllem(), scope)
      expect(c.multicast?.assignments, scope).toEqual([])
      expect(c.multicast?.pool, scope).toBe('239.100.0.0/16')
      expect(c.multicast?.basePort, scope).toBe(20000)
    }
  })

  it('nimmt das Schluessel-Haekchen weg — es gilt fuer EINEN Rechner', () => {
    for (const scope of ['venue', 'neutral'] as const) {
      const c = stripForTemplate(mitAllem(), scope)
      expect(c.deliveryDestinations?.[0], scope).not.toHaveProperty('hasStreamKey')
      // Das Ziel selbst bleibt: die Plattform ist Teil der Form.
      expect(c.deliveryDestinations?.[0].name, scope).toBe('YouTube')
    }
  })

  it('nimmt die Geschichte einer anderen Show weg', () => {
    const c = stripForTemplate(mitAllem(), 'venue')
    expect(c.revisions).toBeUndefined()
    expect(c.pendingChanges).toBeUndefined()
  })

  it('fasst das UEBERGEBENE Projekt nicht an', () => {
    const p = mitAllem()
    const vorher = JSON.stringify(p)
    stripForTemplate(p, 'neutral')
    expect(JSON.stringify(p)).toBe(vorher)
  })
})

describe('was nur bei `neutral` faellt — das Ortsgebundene', () => {
  it('nimmt Adresse und Haus-Antworten weg', () => {
    const c = stripForTemplate(mitAllem(), 'neutral')
    expect(c.metadata.siteAddress).toBeUndefined()
    expect(c.metadata.venueAnswers).toBeUndefined()
  })

  it('BEHAELT sie bei `venue` — sonst gibt es den Bedarf gar nicht', () => {
    const c = stripForTemplate(mitAllem(), 'venue')
    expect(c.metadata.siteAddress).toBe('Halle A')
    expect(c.metadata.venueAnswers).toHaveLength(2)
  })

  it('zaehlt, wie viel dranhaengt — Antworten PLUS Adresse', () => {
    expect(venueBoundCount(mitAllem())).toBe(3)
    expect(venueBoundCount(projekt())).toBe(0)
    // Eine Adresse aus Leerzeichen ist keine.
    expect(venueBoundCount(projekt({ metadata: { name: 'x', siteAddress: '   ' } } as never))).toBe(0)
  })

  it('haelt die Etiketten kanonisch deutsch', () => {
    expect(TEMPLATE_SCOPE_LABEL.neutral).toBe('Neutral (nur die Form)')
    expect(CARRY_LABEL.elsewhere).toBe('Aus einem anderen Haus')
  })
})

// ---------------------------------------------------------------------------
describe('der Vorlagen-Schreiber verlangt die Entscheidung', () => {
  beforeEach(() => localStorage.clear())

  it('schreibt das Haus AN DIE VORLAGE, nicht nur ins Projekt', () => {
    // Die Karte in der Galerie muss es sagen koennen, BEVOR das Projekt
    // geladen ist.
    const tpl = saveUserTemplate('Halle A Standard', '', mitAllem(), 'venue')
    expect(tpl.venue).toBe('Halle A')
    expect(loadUserTemplates()[0].venue).toBe('Halle A')
  })

  it('setzt kein Haus bei einer neutralen Vorlage', () => {
    const tpl = saveUserTemplate('Zweikamera', '', mitAllem(), 'neutral')
    expect(tpl.venue).toBeUndefined()
    expect(tpl.project.metadata.venueAnswers).toBeUndefined()
  })

  it('setzt kein Haus, wenn das Projekt keines nennt', () => {
    const p = projekt({
      metadata: { name: 'x', venueAnswers: [{ key: 'ports', status: 'granted' }] },
    } as never)
    expect(saveUserTemplate('X', '', p, 'venue').venue).toBeUndefined()
  })

  it('strippt weiterhin die AUFTRAGS-Identitaet — beide Fragen, nicht eine', () => {
    // Das eine haengt am HAUS, das andere am KUNDEN. Eine Vorlage fuer
    // dasselbe Haus behaelt das eine und nie das andere.
    const p = mitAllem()
    p.metadata = { ...p.metadata, client: 'Kunde GmbH', projectNumber: '4711' } as never
    const tpl = saveUserTemplate('Halle A', '', p, 'venue')
    expect(tpl.project.metadata.client).toBeUndefined()
    expect(tpl.project.metadata.projectNumber).toBeUndefined()
    expect(tpl.project.metadata.siteAddress).toBe('Halle A')
  })

  it('nimmt den Umfang als PFLICHT-PARAMETER ohne Default', () => {
    // Dieselbe Bauform wie `credentials` bei `syncSharedLibrary`: ein Default
    // haette den alten Zustand („geht stillschweigend mit") wiederhergestellt,
    // sobald ein Aufrufer ihn weglaesst.
    expect(tplQuelle).toMatch(/scope: TemplateScope,\n\): ProjectTemplate => \{/)
    expect(tplQuelle).not.toMatch(/scope: TemplateScope = /)
    expect(tplQuelle).toContain('stripForTemplate(cloneProject(project), scope)')
  })
})

// ---------------------------------------------------------------------------
describe('was beim Verwenden mit den Antworten passiert', () => {
  it('nennt dasselbe Haus als geltend', () => {
    const r = templateCarryReport('Halle A', 2, 'halle a')
    expect(r.state).toBe('carries')
    expect(r.text).toContain('dasselbe Haus')
  })

  it('BENUTZT DIESELBE STRENGE als das Blatt', () => {
    // „Halle A" und „Halle A, Eingang Nord" koennen dasselbe Haus sein — und
    // sie als gleich zu behandeln hiesse, eine Genehmigung zu uebertragen,
    // die vielleicht nie fuer diesen Bereich galt. Zwei Wahrheiten darueber
    // waeren hier besonders teuer.
    expect(sameVenue('Halle A', 'Halle A, Eingang Nord')).toBe(false)
    expect(templateCarryReport('Halle A', 2, 'Halle A, Eingang Nord').state).toBe('elsewhere')
  })

  it('nennt beide Haeuser im Text', () => {
    const r = templateCarryReport('Halle A', 3, 'Kongresszentrum')
    expect(r.state).toBe('elsewhere')
    expect(r.text).toContain('Halle A')
    expect(r.text).toContain('Kongresszentrum')
    expect(r.answers).toBe(3)
  })

  it('laesst offen statt zu behaupten, wenn das Ziel keinen Ort nennt', () => {
    const r = templateCarryReport('Halle A', 2, undefined)
    expect(r.state).toBe('elsewhere')
    expect(r.text).toMatch(/bleibt offen/)
  })

  it('meldet „keine Antworten dabei" als eigenen Zustand, nicht als Fehler', () => {
    expect(templateCarryReport(undefined, 0, 'Halle A').state).toBe('none')
    // Auch mit Haus, aber ohne Antworten.
    expect(templateCarryReport('Halle A', 0, 'Halle A').state).toBe('none')
  })

  it('liest den Ort aus dem Projekt getrimmt', () => {
    expect(projectVenue(projekt({ metadata: { name: 'x', siteAddress: '  Halle A ' } } as never))).toBe(
      'Halle A',
    )
    expect(projectVenue(projekt())).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
describe('Erreichbarkeit', () => {
  it('fragt beim Speichern — aber NUR, wenn etwas dranhaengt', () => {
    // Eine Rueckfrage, die meistens „nichts dabei" bedeutet, wird zur
    // Klickgewohnheit; dieselbe Ueberlegung wie bei `credentialChoiceDialog`.
    expect(dialogQuelle).toContain('const gebunden = venueBoundCount(current)')
    expect(dialogQuelle).toMatch(/if \(gebunden > 0\) \{\n\s*const antwort = await venueScopeDialog\(/)
  })

  it('bricht bei Abbruch ab, statt neutral zu speichern', () => {
    expect(dialogQuelle).toMatch(/if \(antwort === null\) return/)
  })

  it('reicht den Umfang an den Schreiber durch', () => {
    expect(dialogQuelle).toContain(
      "saveUserTemplate(name, current.metadata.description ?? '', current, scope)",
    )
  })

  it('warnt VOR dem Laden, wenn die Antworten aus einem anderen Haus kommen', () => {
    // Danach stehen sie im Blatt und sehen aus wie Auskunft.
    expect(dialogQuelle).toMatch(/if \(bericht\.state === 'elsewhere'\) \{/)
    expect(dialogQuelle).toContain('body: bericht.text')
    expect(dialogQuelle).toMatch(/if \(!weiter\) return/)
  })

  it('zeigt das Haus auf der Karte', () => {
    expect(dialogQuelle).toContain("t('templates.venue'")
    expect(dialogQuelle).toMatch(/\{tpl\.venue && \(/)
  })

  it('bricht der Frage-Dialog bei Escape ab, statt etwas mitzugeben', () => {
    expect(scopeDialogQuelle).toContain('useModalKeyboard(() => onDone(null))')
  })

  it('hat fuer jeden neuen Text einen EN-Eintrag', () => {
    for (const key of [
      'tplScope.title',
      'tplScope.body',
      'tplScope.venue',
      'tplScope.neutral',
      'templates.venue',
      'templates.carryTitle',
      'templates.carryOk',
    ]) {
      expect(dictsQuelle).toContain(`'${key}'`)
    }
  })
})
