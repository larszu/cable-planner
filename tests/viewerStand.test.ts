import { describe, expect, it } from 'vitest'
import viewerQuelle from '../src/viewer/ViewerApp.tsx?raw'
import { planFingerprint, stampForPlan } from '../src/renderer/lib/documentStamp'
import type { CablePlannerProject, ProjectAnnotation } from '../src/renderer/types/project'

// ---------------------------------------------------------------------------
// Der geteilte Plan sagt, welcher Stand er ist (Bedarf 1, P1).
//
//   > The technical plan on the freelancer's phone before they leave home, and
//   > offline once on site. […] Two increments: share to a person with no
//   > account, and MAKE IT THE LIVE DOCUMENT RATHER THAN A PDF FORK.
//
// Das erste Inkrement war gebaut: der Web-Viewer braucht kein Konto, keine
// Installation und kein Backend. Das zweite fehlte an der einzigen Stelle, an
// der es zaehlt — die Ansicht sagte NICHT, welche Momentaufnahme sie ist.
// Damit war das Geteilte funktional die PDF-Gabelung, die der Bedarf beklagt.
//
// Der Rueckweg dazu ist seit `cable#709` gebaut (`findByStand`, Bedarf 27).
// Geprueft wird hier deshalb nicht der Rueckweg, sondern dass die Zahl, die
// ihn ausloest, auf dem Geteilten UEBERHAUPT steht — und dass sie den Weg
// hin und zurueck ueberlebt.
// ---------------------------------------------------------------------------

const projekt = (over: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Sendung Freitag', createdAt: 1, updatedAt: 1 },
    equipment: [
      { id: 'e1', name: 'ATEM', category: 'Video', inputs: [], outputs: [], x: 0, y: 0, width: 200, height: 80 },
    ],
    cables: [],
    locations: [],
    ...over,
  }) as unknown as CablePlannerProject

const anmerkung = (id: string): ProjectAnnotation =>
  ({
    id,
    text: 'Bitte pruefen',
    status: 'open',
    author: 'Jan',
    createdAt: 1,
    anchor: { type: 'free', x: 10, y: 10 },
  }) as unknown as ProjectAnnotation

describe('der Stand steht auf dem, was geteilt wird', () => {
  it('der Kopf zeigt den Fingerabdruck', () => {
    expect(viewerQuelle).toContain('stampForPlan')
    expect(viewerQuelle).toContain('#{stamp.fingerprint}')
  })

  it('der Kopf zeigt die Revision und sagt, wenn der Plan davon abweicht', () => {
    // „Rev 2" allein liest sich als *dieser Stand ist Rev 2*. Weicht der Plan
    // ab, muss es dabeistehen — sonst behauptet die Ansicht einen Stand, den
    // sie nicht hat. Dieselbe Regel wie in `stampLine`.
    expect(viewerQuelle).toContain('{stamp.revision}')
    expect(viewerQuelle).toContain("stamp.drifted && ' + Änderungen'")
  })

  it('zeigt KEIN Druckdatum', () => {
    // `printedAt` waere im Viewer der Moment des Oeffnens: eine Aussage ueber
    // den Leser, nicht ueber das Dokument. Ein Datum, das sich bei jedem
    // Oeffnen aendert, sieht aus wie eine Aktualisierung, die es nicht gab.
    expect(viewerQuelle).not.toContain('stamp.printedAt')
    expect(viewerQuelle).not.toContain('stampLine(')
  })

  it('leitet den Stand EINMAL ab, nicht zweimal', () => {
    // Zwei Ableitungen derselben Zahl im selben Bauteil sind die zweite
    // Wahrheit, die irgendwann abweicht.
    expect((viewerQuelle.match(/stampForPlan\(/g) ?? []).length).toBe(1)
  })

  it('nennt den Rueckweg, statt nur eine Zahl hinzuschreiben', () => {
    // Acht Hex-Zeichen ohne Hinweis sind ein Rätsel. Der Bedarf will, dass
    // jemand OHNE Konto feststellen kann, ob sein Plan noch gilt.
    expect(viewerQuelle).toContain('standHinweis')
    expect(viewerQuelle).toMatch(/Blatt prüfen/)
  })
})

describe('die Zahl ueberlebt den Weg hin und zurueck', () => {
  it('Anmerkungen aendern den Stand des PLANS nicht', () => {
    // Der Reviewer darf annotieren — das ist der einzige Schreibpfad. Wuerde
    // das den Fingerabdruck aendern, meldete der zurueckgelesene Plan sich als
    // anderer Stand, und die Rueckfrage „gilt #a1b2c3d4 noch?" liefe ins Leere.
    const p = projekt()
    const mitAnmerkung = { ...p, annotations: [anmerkung('a1')] }
    expect(planFingerprint(mitAnmerkung)).toBe(planFingerprint(p))
  })

  it('eine echte Plan-Aenderung aendert ihn sehr wohl', () => {
    const p = projekt()
    const verschoben = {
      ...p,
      equipment: [{ ...p.equipment[0], x: 400 }],
    } as CablePlannerProject
    expect(planFingerprint(verschoben)).not.toBe(planFingerprint(p))
  })

  it('der Ruecklaeufer traegt den Stand im Dateinamen', () => {
    // Drei Ruecklaeufer im Download-Ordner hiessen sonst dreimal gleich.
    expect(viewerQuelle).toContain('${base}_${stamp.fingerprint}.cpviewer')
    // Kein `#`: in URLs ist das der Fragment-Trenner und faellt beim
    // Verschicken ueber Weblinks ab.
    expect(viewerQuelle).not.toContain('${base}_#${stamp.fingerprint}')
  })
})

describe('der Stempel haengt am Inhalt, nicht an der Uhr', () => {
  it('zweimal geoeffnet ergibt denselben Fingerabdruck', () => {
    const p = projekt()
    const a = stampForPlan(p, new Date('2026-01-01T00:00:00Z'))
    const b = stampForPlan(p, new Date('2026-09-06T12:00:00Z'))
    expect(a.fingerprint).toBe(b.fingerprint)
    expect(a.printedAt).not.toBe(b.printedAt)
  })

  it('ohne festgeschriebene Revision behauptet er keine Abweichung', () => {
    expect(stampForPlan(projekt(), new Date()).drifted).toBe(false)
  })
})
