import { describe, expect, it } from 'vitest'
import {
  ARCHIVE_ANSWER_LABEL,
  ARCHIVE_FINDING_LABEL,
  archiveFindingText,
  archiveTable,
  assessArchive,
  type ArchiveInput,
} from '../src/renderer/lib/archiveIsolation'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'
import type { DeliveryDestination } from '../src/renderer/types/delivery'
import dialogQuelle from '../src/renderer/components/Delivery/DeliveryDialog.tsx?raw'
import sliceQuelle from '../src/renderer/store/slices/deliverySlice.ts?raw'

// ---------------------------------------------------------------------------
// Die Archiv-Aufzeichnung teilt nicht das Schicksal der Ausspielung
// (Bedarf 90, P2).
//
//   > with obs-multi-rtmp, „OBS encoder will overload if (any) stream upload
//   > will stall/lag", degrading the recording's frame rate to the point the
//   > material must be discarded
//
// obsproject/obs-studio#13147, „closed as not planned". Der Schaden faellt
// erst NACH dem Abbau auf.
//
// Der Bedarf zieht die Grenze selbst: „Not a Cable Planner feature but a
// PLANNING FACT: the plan should force an explicit answer […] and flag a
// delivery path where the only recording shares fate with the transmission."
// Also keine Telemetrie — eine Antwort und eine Ableitung.
// ---------------------------------------------------------------------------

const geraet = (id: string, name: string): EquipmentItem =>
  ({ id, name, x: 0, y: 0, width: 10, height: 10, category: 'Video', inputs: [], outputs: [] }) as never

const kabel = (id: string, from: string, to: string): Cable =>
  ({
    id,
    name: id,
    type: 'sdi',
    length: 1,
    color: '#fff',
    fromEquipmentId: from,
    fromPortId: 'a',
    toEquipmentId: to,
    toPortId: 'b',
    notes: '',
  }) as never

const ziel = (id: string, name: string, encoderEquipmentId?: string): DeliveryDestination =>
  ({
    id,
    name,
    platform: 'custom',
    transport: 'rtmp',
    encoding: {},
    ...(encoderEquipmentId ? { encoderEquipmentId } : {}),
  }) as never

const eingabe = (over: Partial<ArchiveInput> = {}): ArchiveInput => ({
  equipment: [],
  cables: [],
  ...over,
})

describe('Bedarf 90 — ohne Ausspielung gibt es die Frage nicht', () => {
  it('meldet nichts, wenn kein Ziel im Plan steht', () => {
    // Eine Show ohne Uebertragung hat keine Uebertragung, die die
    // Aufzeichnung mitreissen koennte. Die Frage dort zu stellen waere eine
    // Warnung ohne Anlass.
    const a = assessArchive(eingabe({ equipment: [geraet('rec', 'HyperDeck')] }))
    expect(a.findings).toHaveLength(0)
    expect(a.answer).toBe('not-stated')
  })
})

describe('Bedarf 90 — der Plan erzwingt eine ausdrueckliche Antwort', () => {
  it('meldet die unbeantwortete Frage, sobald es ein Ziel gibt', () => {
    const a = assessArchive(eingabe({ deliveryDestinations: [ziel('d1', 'YouTube')] }))
    expect(a.findings.map((f) => f.kind)).toEqual(['not-stated'])
    expect(archiveFindingText(a.findings[0])).toContain('bewusst keine')
  })

  it('„bewusst keine" ist eine ANTWORT und kein Befund', () => {
    // Ein Webinar ohne Nachverwertung braucht keine Archiv-Kopie. Das als
    // Fehler zu melden hiesse, den Nutzer fuer seine eigene Entscheidung zu
    // ruegen.
    const a = assessArchive(
      eingabe({
        deliveryDestinations: [ziel('d1', 'YouTube')],
        archiveRecording: { answer: 'none-by-choice', note: 'Webinar, keine Nachverwertung' },
      }),
    )
    expect(a.findings).toHaveLength(0)
    expect(a.answer).toBe('none-by-choice')
    expect(a.note).toBe('Webinar, keine Nachverwertung')
  })

  it('unterscheidet „bewusst keine" von „nicht beantwortet"', () => {
    const ohne = assessArchive(eingabe({ deliveryDestinations: [ziel('d1', 'Y')] }))
    const bewusst = assessArchive(
      eingabe({
        deliveryDestinations: [ziel('d1', 'Y')],
        archiveRecording: { answer: 'none-by-choice' },
      }),
    )
    expect(ohne.answer).not.toBe(bewusst.answer)
    expect(ohne.findings.length).toBeGreaterThan(0)
    expect(bewusst.findings).toHaveLength(0)
  })
})

describe('Bedarf 90 — der belegte Fehler: ein Geraet, zwei Aufgaben', () => {
  it('meldet, wenn der Recorder DER Encoder ist — mit dem Ziel im Text', () => {
    const a = assessArchive(
      eingabe({
        equipment: [geraet('obs', 'Streaming-PC')],
        deliveryDestinations: [ziel('d1', 'YouTube', 'obs')],
        archiveRecording: { answer: 'device', equipmentId: 'obs' },
      }),
    )
    const f = a.findings.find((x) => x.kind === 'shares-encoder')
    expect(f).toBeDefined()
    expect(a.sharedWith).toEqual(['YouTube'])
    const text = archiveFindingText(f!)
    expect(text).toContain('Streaming-PC')
    expect(text).toContain('YouTube')
    // Der Beleg gehoert in den Text: ohne ihn ist es eine Meinung. Und die
    // FOLGE gehoert dazu — „die Bildrate brach ein" laesst sich achselzuckend
    // lesen, „das Material musste verworfen werden" nicht.
    expect(text).toContain('obs-studio#13147')
    expect(text).toContain('verworfen')
  })

  it('nennt ALLE betroffenen Ziele', () => {
    const a = assessArchive(
      eingabe({
        equipment: [geraet('obs', 'PC')],
        deliveryDestinations: [ziel('d1', 'YouTube', 'obs'), ziel('d2', 'Twitch', 'obs')],
        archiveRecording: { answer: 'device', equipmentId: 'obs' },
      }),
    )
    expect(a.sharedWith).toEqual(['YouTube', 'Twitch'])
  })

  it('meldet NICHT, wenn der Recorder ein eigenes Geraet ist', () => {
    const a = assessArchive(
      eingabe({
        equipment: [geraet('obs', 'PC'), geraet('hd', 'HyperDeck')],
        cables: [kabel('k1', 'mix', 'hd')],
        deliveryDestinations: [ziel('d1', 'YouTube', 'obs')],
        archiveRecording: { answer: 'device', equipmentId: 'hd' },
      }),
    )
    expect(a.findings).toHaveLength(0)
    expect(a.recorder).toEqual({ equipmentId: 'hd', name: 'HyperDeck' })
  })
})

describe('Bedarf 90 — hinter dem Encoder ist dieselbe Abhaengigkeit', () => {
  it('meldet einen Recorder, der vom Encoder gespeist wird', () => {
    const a = assessArchive(
      eingabe({
        equipment: [geraet('obs', 'Streaming-PC'), geraet('hd', 'HyperDeck')],
        cables: [kabel('k1', 'obs', 'hd')],
        deliveryDestinations: [ziel('d1', 'YouTube', 'obs')],
        archiveRecording: { answer: 'device', equipmentId: 'hd' },
      }),
    )
    const f = a.findings.find((x) => x.kind === 'fed-by-encoder')
    expect(f).toBeDefined()
    expect(archiveFindingText(f!)).toContain('Streaming-PC')
  })

  it('findet den Weg auch ueber eine Zwischenstation', () => {
    const a = assessArchive(
      eingabe({
        equipment: [geraet('obs', 'PC'), geraet('conv', 'Konverter'), geraet('hd', 'HyperDeck')],
        cables: [kabel('k1', 'obs', 'conv'), kabel('k2', 'conv', 'hd')],
        deliveryDestinations: [ziel('d1', 'Y', 'obs')],
        archiveRecording: { answer: 'device', equipmentId: 'hd' },
      }),
    )
    expect(a.findings.some((f) => f.kind === 'fed-by-encoder')).toBe(true)
  })

  it('meldet NICHT, wenn beide vom selben Mischer gespeist werden', () => {
    // Der Normalfall und genau richtig: ein geteilter Ausgang. Wer das
    // meldete, wuerde die Warnung entwerten, auf die es ankommt.
    const a = assessArchive(
      eingabe({
        equipment: [geraet('mix', 'Mischer'), geraet('obs', 'PC'), geraet('hd', 'HyperDeck')],
        cables: [kabel('k1', 'mix', 'obs'), kabel('k2', 'mix', 'hd')],
        deliveryDestinations: [ziel('d1', 'Y', 'obs')],
        archiveRecording: { answer: 'device', equipmentId: 'hd' },
      }),
    )
    expect(a.findings).toHaveLength(0)
  })

  it('meldet nicht ZWEIMAL dasselbe, wenn der Recorder der Encoder ist', () => {
    // Zwei Ziele: das eine sendet VOM Recorder, das andere speist ihn. Ohne
    // die Schutzklausel stuenden `shares-encoder` und `fed-by-encoder`
    // nebeneinander und meinten dieselbe Abhaengigkeit. Eine erste Fassung
    // dieses Tests nutzte eine Selbst-Schleife (`obs -> obs`) und konnte den
    // Fall gar nicht erzeugen.
    const a = assessArchive(
      eingabe({
        equipment: [geraet('obs', 'PC'), geraet('zweit', 'Zweit-Encoder')],
        cables: [kabel('k1', 'zweit', 'obs')],
        deliveryDestinations: [ziel('d1', 'Y', 'obs'), ziel('d2', 'Z', 'zweit')],
        archiveRecording: { answer: 'device', equipmentId: 'obs' },
      }),
    )
    expect(a.findings.map((f) => f.kind)).toEqual(['shares-encoder'])
  })

  it('sucht nicht unbegrenzt weit', () => {
    // Eine unbegrenzte Suche findet in einem grossen Plan am Ende immer
    // irgendeinen Weg, und die Aussage „stockt der Encoder, stockt auch das"
    // wird mit jedem Konverter dazwischen schwaecher.
    const kette = ['obs', 'a', 'b', 'c', 'd', 'e', 'hd']
    const a = assessArchive(
      eingabe({
        equipment: kette.map((id) => geraet(id, id)),
        cables: kette.slice(0, -1).map((id, i) => kabel(`k${i}`, id, kette[i + 1])),
        deliveryDestinations: [ziel('d1', 'Y', 'obs')],
        archiveRecording: { answer: 'device', equipmentId: 'hd' },
      }),
    )
    expect(a.findings).toHaveLength(0)
  })
})

describe('Bedarf 90 — ein Zeiger ins Leere heisst so', () => {
  it('meldet einen Recorder, den es im Plan nicht gibt', () => {
    const a = assessArchive(
      eingabe({
        deliveryDestinations: [ziel('d1', 'Y', 'obs')],
        archiveRecording: { answer: 'device', equipmentId: 'weg' },
      }),
    )
    expect(a.findings.map((f) => f.kind)).toEqual(['recorder-gone'])
    expect(a.recorder).toBeUndefined()
  })

  it('meldet auch die Antwort „Geraet" ohne Geraet', () => {
    const a = assessArchive(
      eingabe({
        deliveryDestinations: [ziel('d1', 'Y')],
        archiveRecording: { answer: 'device' },
      }),
    )
    expect(a.findings.map((f) => f.kind)).toEqual(['recorder-gone'])
  })
})

describe('Bedarf 90 — das Blatt', () => {
  it('traegt Antwort, Geraet und die Befunde im Klartext', () => {
    const a = assessArchive(
      eingabe({
        equipment: [geraet('obs', 'PC')],
        deliveryDestinations: [ziel('d1', 'YouTube', 'obs')],
        archiveRecording: { answer: 'device', equipmentId: 'obs', note: 'SSD im Schacht' },
      }),
    )
    const tab = archiveTable(a)
    expect(tab.headers).toEqual(['Art', 'Was', 'Geraet', 'Text'])
    expect(tab.rows[0]).toContain(ARCHIVE_ANSWER_LABEL.device)
    expect(tab.rows[0]).toContain('SSD im Schacht')
    expect(tab.rows[1]).toContain(ARCHIVE_FINDING_LABEL['shares-encoder'])
  })

  it('setzt keinen Platzhalter, wo nichts steht', () => {
    const tab = archiveTable(assessArchive(eingabe({ deliveryDestinations: [ziel('d1', 'Y')] })))
    expect(tab.rows.every((r) => r.every((c) => String(c) !== 'undefined'))).toBe(true)
  })

  it('jeder Befund hat eine Beschriftung und einen Text', () => {
    for (const k of Object.keys(ARCHIVE_FINDING_LABEL)) {
      const kind = k as keyof typeof ARCHIVE_FINDING_LABEL
      expect(ARCHIVE_FINDING_LABEL[kind].length).toBeGreaterThan(0)
      expect(archiveFindingText({ kind, values: ['A', 'B'] }).length).toBeGreaterThan(20)
    }
  })
})

describe('Bedarf 90 — verdrahtet', () => {
  it('der Ausspiel-Dialog beurteilt und zeigt die Befunde', () => {
    expect(dialogQuelle).toMatch(/assessArchive\(project\)/)
    expect(dialogQuelle).toContain('ARCHIVE_FINDING_LABEL[f.kind]')
  })

  it('der Abschnitt erscheint nur mit mindestens einem Ziel', () => {
    expect(dialogQuelle).toMatch(/\{list\.length > 0 && \(/)
  })

  it('„noch nicht beantwortet" loescht die Antwort, statt sie zu setzen', () => {
    // Sonst waere „nicht beantwortet" ein gespeicherter Wert und damit selbst
    // eine Aussage — und die Unterscheidung zu `none-by-choice` fiele in sich
    // zusammen.
    expect(dialogQuelle).toContain("if (answer === 'not-stated') return setArchive(undefined)")
  })

  it('der Setter ebnet die Unterscheidung nicht ein', () => {
    // Auf die FORM pruefen: eine Gegenprobe setzte
    // `archiveRecording: rec ?? { answer: 'not-stated' }` und blieb gruen,
    // weil `toContain` den Teilstring fand. Ein gespeichertes
    // „nicht beantwortet" waere selbst eine Aussage, und die Unterscheidung
    // zu `none-by-choice` fiele in sich zusammen.
    expect(sliceQuelle).toMatch(/setArchiveRecording: \(rec\) =>/)
    expect(sliceQuelle).toMatch(/archiveRecording: rec\s*\}/)
  })
})
