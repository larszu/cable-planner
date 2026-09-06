// ───────────────────────────────────────────────────────────────────────────
// Teilt die Archiv-Aufzeichnung ihr Schicksal mit der Ausspielung?
// (Bedarf 90, P2.)
//
// DER BELEG ist ein geschlossener, nicht behobener Fehlerbericht:
//
//   > with obs-multi-rtmp, „OBS encoder will overload if (any) stream upload
//   > will stall/lag", degrading the recording's frame rate to the point the
//   > material must be discarded
//
// obsproject/obs-studio#13147, „closed as not planned". Die UNABHAENGIG
// konfigurierte Aufzeichnung wird von einer stockenden Ausspielung
// mitgerissen, und es faellt erst nach dem Abbau auf — da ist die Show vorbei
// und die Kamera-Karten sind formatiert.
//
// ─── DIE GRENZE, DIE DER BEDARF SELBST ZIEHT ───────────────────────────────
//
//   > Not a Cable Planner feature but a PLANNING FACT: the plan should force
//   > an explicit answer to „where does the independent archive recording
//   > live and what is it isolated from", and flag a delivery path where the
//   > only recording shares fate with the transmission.
//
// Also keine Telemetrie. Ob ein Encoder gerade ueberlastet ist, weiss ein
// offline-Planer nicht; eine geratene Antwort saehe wie eine Messung aus.
// Dieselbe Grenze wie „is it flowing" in Bedarf 76.
//
// ─── WAS ABGELEITET WIRD UND WAS GEFRAGT ───────────────────────────────────
//
// GEFRAGT wird genau eine Sache: WELCHES Geraet aufzeichnet (oder dass es
// bewusst keines gibt). Das kann der Plan nicht wissen — ein Mischer mit
// SSD-Schacht zeichnet auf, wenn jemand auf Aufnahme drueckt, und das steht
// in keinem Kabel.
//
// ABGELEITET wird alles andere, aus dem Kabelgraph und dem Ziel-Register:
//
//   `shares-encoder`   Das aufzeichnende Geraet IST der Encoder eines Ziels.
//                      Genau der Fall aus dem Fehlerbericht.
//   `fed-by-encoder`   Der Recorder haengt HINTER dem Encoder. Stockt der
//                      Encoder, stockt auch, was er ausgibt — dieselbe
//                      Abhaengigkeit, nur eine Kabellaenge weiter.
//   `recorder-gone`    Das benannte Geraet steht nicht (mehr) im Plan.
//   `not-stated`       Es gibt Ausspielziele und keine Antwort.
//
// `none-by-choice` ist KEIN Befund. „Wir haben bewusst keine Archiv-Kopie"
// ist eine gueltige Entscheidung (ein Webinar ohne Nachverwertung), und sie
// als Fehler zu melden hiesse, den Nutzer fuer seine eigene Entscheidung zu
// ruegen. Sie steht auf dem Blatt, damit sie nachlesbar ist — mehr nicht.
//
// Und ausdruecklich KEIN Befund ist die gemeinsame QUELLE: dass Recorder und
// Encoder vom selben Mischer-Ausgang gespeist werden, ist der NORMALFALL und
// genau richtig. Wer das meldete, wuerde die Warnung entwerten, auf die es
// ankommt.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'
import type { ArchiveRecording, DeliveryDestination } from '../types/delivery'
import type { CsvCell, CsvTable } from './csv'

export type ArchiveFindingKind =
  | 'not-stated'
  | 'recorder-gone'
  | 'shares-encoder'
  | 'fed-by-encoder'

export interface ArchiveFinding {
  kind: ArchiveFindingKind
  /** Klartext-Werte zum Befund, in fester Reihenfolge. */
  values?: string[]
}

export interface ArchiveAssessment {
  /** Die Antwort, wie sie im Projekt steht — `not-stated`, wenn keine da ist. */
  answer: ArchiveRecording['answer']
  /** Der Recorder, sofern benannt UND im Plan vorhanden. */
  recorder?: { equipmentId: string; name: string }
  /** Die Begruendung bei `none-by-choice`, sonst die Anmerkung. */
  note?: string
  findings: ArchiveFinding[]
  /**
   * Die Ziele, deren Encoder das aufzeichnende Geraet IST — die Namen fuer
   * den Befundtext, damit er nicht nur „ein Ziel" sagt.
   */
  sharedWith: string[]
}

export interface ArchiveInput {
  equipment: readonly EquipmentItem[]
  cables: readonly Cable[]
  deliveryDestinations?: readonly DeliveryDestination[]
  archiveRecording?: ArchiveRecording
}

/**
 * Liegt `to` im Kabelgraph HINTER `from`? Breitensuche vorwaerts, mit einer
 * Tiefengrenze.
 *
 * Die Grenze ist kein Geschmack: ein Signalweg mit acht Zwischenstationen ist
 * moeglich, aber die Aussage „stockt der Encoder, stockt auch das" wird mit
 * jedem Konverter dazwischen schwaecher — und eine unbegrenzte Suche findet
 * in einem grossen Plan am Ende immer irgendeinen Weg.
 */
function reachesForward(
  cables: readonly Cable[],
  from: string,
  to: string,
  maxHops = 4,
): boolean {
  if (from === to) return false
  let front = new Set([from])
  const gesehen = new Set([from])
  for (let hop = 0; hop < maxHops; hop++) {
    const next = new Set<string>()
    for (const c of cables) {
      if (!front.has(c.fromEquipmentId)) continue
      if (c.toEquipmentId === to) return true
      if (!gesehen.has(c.toEquipmentId)) {
        gesehen.add(c.toEquipmentId)
        next.add(c.toEquipmentId)
      }
    }
    if (next.size === 0) return false
    front = next
  }
  return false
}

/** Die ganze Beurteilung. */
export function assessArchive(input: ArchiveInput): ArchiveAssessment {
  const { equipment, cables } = input
  const destinations = input.deliveryDestinations ?? []
  const rec = input.archiveRecording
  const answer = rec?.answer ?? 'not-stated'
  const note = rec?.note?.trim() || undefined
  const findings: ArchiveFinding[] = []
  const sharedWith: string[] = []

  // Ohne ein einziges Ausspielziel gibt es die Frage nicht: eine Show ohne
  // Uebertragung hat keine Uebertragung, die die Aufzeichnung mitreissen
  // koennte. Sie hier trotzdem zu stellen waere eine Warnung ohne Anlass.
  if (destinations.length === 0) {
    return { answer, ...(note ? { note } : {}), findings, sharedWith }
  }

  if (answer === 'not-stated') {
    findings.push({ kind: 'not-stated' })
    return { answer, ...(note ? { note } : {}), findings, sharedWith }
  }

  if (answer === 'none-by-choice') {
    // Kein Befund. Die Entscheidung steht auf dem Blatt, das genuegt.
    return { answer, ...(note ? { note } : {}), findings, sharedWith }
  }

  const byId = new Map(equipment.map((e) => [e.id, e]))
  const recorderId = rec?.equipmentId
  const recorder = recorderId ? byId.get(recorderId) : undefined
  if (!recorder) {
    findings.push({ kind: 'recorder-gone', values: recorderId ? [recorderId] : [] })
    return { answer, ...(note ? { note } : {}), findings, sharedWith }
  }

  const encoderIds = new Set(
    destinations.map((d) => d.encoderEquipmentId).filter(Boolean) as string[],
  )

  for (const d of destinations) {
    if (d.encoderEquipmentId && d.encoderEquipmentId === recorder.id) sharedWith.push(d.name)
  }
  if (sharedWith.length) {
    findings.push({ kind: 'shares-encoder', values: [recorder.name, ...sharedWith] })
  }

  // Hinter dem Encoder: dieselbe Abhaengigkeit, nur eine Kabellaenge weiter.
  // Nur pruefen, wenn der Recorder nicht ohnehin schon DER Encoder ist —
  // sonst stuenden zwei Befunde fuer dieselbe Sache.
  if (!sharedWith.length) {
    for (const encId of encoderIds) {
      if (reachesForward(cables, encId, recorder.id)) {
        findings.push({
          kind: 'fed-by-encoder',
          values: [recorder.name, byId.get(encId)?.name ?? encId],
        })
        break
      }
    }
  }

  return {
    answer,
    recorder: { equipmentId: recorder.id, name: recorder.name },
    ...(note ? { note } : {}),
    findings,
    sharedWith,
  }
}

/**
 * Der Befundtext — kanonisches Deutsch, wie jeder Text, der auf einem
 * Dokument landen kann (ADR-004: der Stand haengt am Inhalt).
 */
export function archiveFindingText(f: ArchiveFinding): string {
  const v = f.values ?? []
  switch (f.kind) {
    case 'not-stated':
      return (
        'Der Plan hat Ausspielziele, sagt aber nicht, wo die unabhaengige ' +
        'Archiv-Aufzeichnung liegt. Das ist keine Warnung ueber ein Geraet, sondern ' +
        'eine offene Frage: entweder ein Geraet benennen oder ausdruecklich sagen, ' +
        'dass es bewusst keine gibt.'
      )
    case 'recorder-gone':
      return (
        `Das als Recorder benannte Geraet steht nicht mehr im Plan${v[0] ? ` (${v[0]})` : ''}. ` +
        'Die Antwort auf die Archiv-Frage zeigt damit ins Leere.'
      )
    case 'shares-encoder':
      return (
        `${v[0]} zeichnet auf UND sendet (${v.slice(1).join(', ')}). Eine stockende ` +
        'Ausspielung ueberlastet denselben Encoder und zieht die Aufzeichnung mit ' +
        'herunter — belegt an obs-studio#13147, wo die Bildrate der Aufnahme so weit ' +
        'einbrach, dass das Material verworfen werden musste. Auffallen wird es erst ' +
        'nach dem Abbau.'
      )
    case 'fed-by-encoder':
      return (
        `${v[0]} haengt hinter ${v[1]}, also hinter dem sendenden Geraet. Stockt der ` +
        'Encoder, stockt auch, was er ausgibt: dieselbe Abhaengigkeit, nur eine ' +
        'Kabellaenge weiter.'
      )
  }
}

export const ARCHIVE_FINDING_LABEL: Record<ArchiveFindingKind, string> = {
  'not-stated': 'Archiv-Frage unbeantwortet',
  'recorder-gone': 'Benannter Recorder fehlt im Plan',
  'shares-encoder': 'Aufzeichnung und Ausspielung auf einem Geraet',
  'fed-by-encoder': 'Aufzeichnung haengt hinter dem Encoder',
}

export const ARCHIVE_ANSWER_LABEL: Record<ArchiveRecording['answer'], string> = {
  device: 'auf einem Geraet',
  'none-by-choice': 'bewusst keine',
  'not-stated': 'nicht beantwortet',
}

/** Das Blatt: die Antwort und, falls es welche gibt, die Befunde. */
export function archiveTable(a: ArchiveAssessment): CsvTable {
  const rows: CsvCell[][] = [
    ['Antwort', ARCHIVE_ANSWER_LABEL[a.answer], a.recorder?.name ?? '', a.note ?? ''],
  ]
  for (const f of a.findings) {
    rows.push(['Befund', ARCHIVE_FINDING_LABEL[f.kind], '', archiveFindingText(f)])
  }
  return { headers: ['Art', 'Was', 'Geraet', 'Text'], rows }
}
