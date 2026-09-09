import { describe, expect, it } from 'vitest'
import {
  OHNE_EMPFAENGER,
  empfaengerStaende,
  revisionFuerBlatt,
} from '../src/renderer/lib/recipientDigest'
import { currentStand } from '../src/renderer/lib/documentRegistry'
import type { DocumentLogFile, DocumentLogRecord } from '../src/renderer/lib/bridge'
import type { CablePlannerProject, ProjectRevision } from '../src/renderer/types/project'
import bridgeSrc from '../src/renderer/lib/bridge.ts?raw'
import ipcSrc from '../src/main/ipc/documentLogIpc.ts?raw'
import serviceSrc from '../src/main/services/documentLog.ts?raw'

// ───────────────────────────────────────────────────────────────────────────
// BEDARF 11 — „was hat sich seit DEINEM Ausdruck geaendert?"
//
// Der Bedarf sagt: „different people end up on different versions". Was hier
// zugesichert wird, ist deshalb weniger der Vergleich selbst (den rechnet
// `planDiff`, und der hat seine eigenen Guards) als die beiden Fragen, an
// denen so eine Ansicht in die Irre fuehren kann:
//
//   * Wird richtig GETRENNT — oder landen zwei Abteilungen in einem Topf?
//   * Steht der Vergleich gegen die RICHTIGE Fassung — oder gegen eine, die
//     zeitlich in der Naehe lag?
//
// Die zweite ist die gefaehrliche. Ein Blatt ohne Vergleich sagt „ich weiss
// nicht, was sich geaendert hat"; ein Blatt mit dem FALSCHEN Vergleich sagt
// mit voller Ueberzeugung etwas Unwahres, und die Empfaengerin richtet ihre
// Arbeit danach.
// ───────────────────────────────────────────────────────────────────────────

const leeresProjekt = (): CablePlannerProject =>
  ({
    metadata: { name: 'Show' },
    equipment: [],
    cables: [],
  }) as unknown as CablePlannerProject

const mitKabel = (id: string, laenge: number): CablePlannerProject =>
  ({
    ...leeresProjekt(),
    cables: [{ id, length: laenge } as never],
  }) as unknown as CablePlannerProject

const revision = (
  id: string,
  label: string,
  createdAt: string,
  snapshot: CablePlannerProject,
): ProjectRevision =>
  ({
    id,
    label,
    note: '',
    createdAt,
    asBuilt: false,
    snapshot,
  }) as unknown as ProjectRevision

const eintrag = (over: Partial<DocumentLogRecord>): DocumentLogRecord => ({
  docId: 'plan',
  label: 'Plan',
  stand: 'ffffffff',
  emittedAt: '2026-09-01T10:00:00.000Z',
  project: 'Show',
  ...over,
})

const register = (entries: DocumentLogRecord[]): DocumentLogFile => ({
  version: 1,
  entries,
  dropped: 0,
})

describe('Bedarf 11 — je Empfaenger, was sich seit seinem Blatt geaendert hat', () => {
  it('trennt nach Empfaenger und wirft nichts zusammen', () => {
    const projekt = mitKabel('c1', 10)
    const stand = currentStand('plan', projekt)!
    const staende = empfaengerStaende(
      register([
        eintrag({ stand, recipient: 'Kamera' }),
        eintrag({ stand, recipient: 'Ton', emittedAt: '2026-09-01T11:00:00.000Z' }),
        eintrag({ stand, recipient: 'Kamera', emittedAt: '2026-09-01T12:00:00.000Z' }),
      ]),
      projekt,
    )

    expect(staende.map((e) => e.recipient)).toEqual(['Kamera', 'Ton'])
    expect(staende.find((e) => e.recipient === 'Kamera')!.blaetter).toHaveLength(2)
    expect(staende.find((e) => e.recipient === 'Ton')!.blaetter).toHaveLength(1)
  })

  it('fuehrt ein Blatt ohne genannten Empfaenger eigens — und am Ende', () => {
    const projekt = mitKabel('c1', 10)
    const stand = currentStand('plan', projekt)!
    const staende = empfaengerStaende(
      register([
        eintrag({ stand }),
        eintrag({ stand, recipient: '   ' }),
        eintrag({ stand, recipient: 'Ton' }),
      ]),
      projekt,
    )

    // Nicht unter „Ton" gemischt und nicht weggelassen: ein ausgegebenes
    // Blatt, von dem niemand weiss, wer es hat, ist die gefaehrlichste Zeile.
    expect(staende.map((e) => e.recipient)).toEqual(['Ton', OHNE_EMPFAENGER])
    expect(staende.at(-1)!.blaetter).toHaveLength(2)
  })

  it('legt einem ueberholten Blatt den Vergleich gegen SEINE Fassung bei', () => {
    const damals = mitKabel('c1', 10)
    const heute = mitKabel('c1', 25)
    const standDamals = currentStand('plan', damals)!
    expect(standDamals).not.toBe(currentStand('plan', heute))

    const projekt: CablePlannerProject = {
      ...heute,
      revisions: [revision('r1', 'A', '2026-09-01T09:00:00.000Z', damals)],
    }

    const [empfaenger] = empfaengerStaende(
      register([eintrag({ stand: standDamals, recipient: 'Kamera' })]),
      projekt,
    )
    const blatt = empfaenger.blaetter[0]

    expect(blatt.entry.status).toBe('superseded')
    expect(blatt.revisionLabel).toBe('A')
    expect(blatt.ohneVergleich).toBeUndefined()
    expect(empfaenger.mitVergleich).toBe(1)
    // Der Vergleich ist echt gerechnet und kein leeres Geruest: die
    // geaenderte Kabellaenge steht als inhaltliche Aenderung darin.
    expect(blatt.diff!.substantive).toBeGreaterThan(0)
    expect(blatt.diff!.entities.map((e) => e.kind)).toContain('cable')
  })

  it('sagt beim ueberholten Blatt ohne Fassung, dass es keinen Vergleich gibt', () => {
    const damals = mitKabel('c1', 10)
    const heute = mitKabel('c1', 25)
    const projekt: CablePlannerProject = {
      ...heute,
      // Eine Revision gibt es, aber sie ist NICHT die, aus der das Blatt kam.
      revisions: [revision('r1', 'A', '2026-09-01T09:00:00.000Z', mitKabel('c1', 99))],
    }

    const [empfaenger] = empfaengerStaende(
      register([eintrag({ stand: currentStand('plan', damals)!, recipient: 'Kamera' })]),
      projekt,
    )
    const blatt = empfaenger.blaetter[0]

    expect(blatt.entry.status).toBe('superseded')
    expect(blatt.diff).toBeUndefined()
    expect(blatt.revisionId).toBeUndefined()
    expect(blatt.ohneVergleich).toBe('keine-passende-revision')
    expect(empfaenger.mitVergleich).toBe(0)
  })

  it('ordnet ueber den Stand zu, nicht ueber die Zeit', () => {
    // Die zeitlich naechste Revision hat ANDEREN Inhalt; die inhaltlich
    // richtige liegt weiter zurueck. Wer nach Zeit zuordnet, legt dem Blatt
    // eine Aenderungsliste gegen die falsche Fassung bei.
    const gedruckt = mitKabel('c1', 10)
    const heute = mitKabel('c1', 25)
    const richtig = revision('alt', 'A', '2026-09-01T08:00:00.000Z', gedruckt)
    const naeher = revision('neu', 'B', '2026-09-01T09:59:00.000Z', mitKabel('c1', 77))

    const gefunden = revisionFuerBlatt(
      {
        ...eintrag({ stand: currentStand('plan', gedruckt)! }),
        status: 'superseded',
        standNow: currentStand('plan', heute)!,
      },
      [naeher, richtig],
    )
    expect(gefunden?.id).toBe('alt')
  })

  it('nimmt bei mehreren gleichen Fassungen die juengste als Beschriftung', () => {
    const gedruckt = mitKabel('c1', 10)
    const frueh = revision('r1', 'A', '2026-09-01T08:00:00.000Z', gedruckt)
    const spaet = revision('r2', 'B', '2026-09-01T09:00:00.000Z', gedruckt)
    const gefunden = revisionFuerBlatt(
      {
        ...eintrag({ stand: currentStand('plan', gedruckt)! }),
        status: 'superseded',
        standNow: 'anders00',
      },
      [frueh, spaet],
    )
    expect(gefunden?.label).toBe('B')
  })

  it('legt einem AKTUELLEN Blatt keinen Vergleich bei', () => {
    const projekt: CablePlannerProject = {
      ...mitKabel('c1', 10),
      revisions: [revision('r1', 'A', '2026-09-01T09:00:00.000Z', mitKabel('c1', 10))],
    }
    const [empfaenger] = empfaengerStaende(
      register([eintrag({ stand: currentStand('plan', projekt)!, recipient: 'Kamera' })]),
      projekt,
    )
    const blatt = empfaenger.blaetter[0]
    expect(blatt.entry.status).toBe('current')
    expect(blatt.diff).toBeUndefined()
    // Und auch keine Begruendung: es fehlt nichts, es ist nur nichts passiert.
    expect(blatt.ohneVergleich).toBeUndefined()
  })

  it('unterscheidet „keine Fassung" von „Stand gar nicht reproduzierbar"', () => {
    const projekt = mitKabel('c1', 10)
    // `kabel-bom` haengt am Reserve-Aufschlag und hat deshalb keinen aus dem
    // Plan reproduzierbaren Stand -- `reviewLog` fuehrt ihn als `unknown`.
    expect(currentStand('kabel-bom', projekt)).toBeUndefined()

    const [empfaenger] = empfaengerStaende(
      register([eintrag({ docId: 'kabel-bom', label: 'BOM', recipient: 'Lager' })]),
      projekt,
    )
    const blatt = empfaenger.blaetter[0]
    expect(blatt.entry.status).toBe('unknown')
    // Die beiden Gruende zusammenzuwerfen hiesse dem Nutzer sagen, er koenne
    // die Lage durch Festschreiben einer Revision heilen. Hier kann er nicht.
    expect(blatt.ohneVergleich).toBe('stand-nicht-reproduzierbar')
    expect(empfaenger.unknown).toBe(1)
  })

  it('zaehlt ueberholt und unbeurteilbar je Empfaenger getrennt', () => {
    const projekt = mitKabel('c1', 25)
    const staende = empfaengerStaende(
      register([
        eintrag({ stand: currentStand('plan', mitKabel('c1', 10))!, recipient: 'Kamera' }),
        eintrag({ stand: currentStand('plan', projekt)!, recipient: 'Kamera' }),
        eintrag({ docId: 'kabel-bom', label: 'BOM', recipient: 'Kamera' }),
      ]),
      projekt,
    )
    const kamera = staende[0]
    expect(kamera.blaetter).toHaveLength(3)
    expect(kamera.superseded).toBe(1)
    expect(kamera.unknown).toBe(1)
  })
})

describe('Bedarf 11 — der Empfaenger ueberlebt den Weg durch die Erlaubnis-Liste', () => {
  // Der Weg vom Renderer in die Datei hat DREI Stellen, an denen das Feld
  // stehen muss: der Typ, der Dienst und `sanitize` in der IPC-Schicht. Die
  // dritte ist eine Erlaubnis-Liste — ein Feld, das sie nicht kennt, faellt
  // STILL weg. Der Eintrag wird trotzdem geschrieben, sieht vollstaendig aus
  // und hat den Empfaenger verloren; genau die Sorte Fehler, die niemandem
  // auffaellt, weil nichts kaputtgeht.
  const ohneKommentare = (quelle: string) =>
    quelle
      .split('\n')
      .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
      .join('\n')

  it('nennt das Feld im Renderer-Typ', () => {
    expect(ohneKommentare(bridgeSrc)).toMatch(/recipient\?: string/)
  })

  it('nennt das Feld im Dienst, der schreibt', () => {
    expect(ohneKommentare(serviceSrc)).toMatch(/recipient\?: string/)
  })

  it('laesst das Feld durch die Erlaubnis-Liste der IPC-Schicht', () => {
    expect(ohneKommentare(ipcSrc)).toMatch(/recipient:\s*str\(e\.recipient\)/)
  })
})
