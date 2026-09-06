// ───────────────────────────────────────────────────────────────────────────
// Paritaets- und Plausibilitaetspruefung der Ausspielung (Bedarf 29 + 28, P1).
//
// BEDARF 29 IST EINE REGEL MIT AUTORITAET, KEINE MEINUNG:
//
//   > YouTube's primary and backup streams must have the *exact same*
//   > resolution, video codec, bitrate, framerate, keyframe frequency and
//   > audio sample rate, and if they drift apart, failover breaks or throws
//   > ingest errors.
//
//   Quellen: support.google.com/youtube/answer/2853702 ·
//   docs.castr.com/en/articles/5023371-backup-ingest-how-to-use-benefits-and-limitations
//
// Und der Rollen-Bericht sagt, wann das auffliegt: in der Probe, wenn man den
// Primaer-Encoder absichtlich abschaltet — „the failover itself … is the only
// opportunity to test the thing that most needs testing and is most often
// skipped". Wer sie ueberspringt, merkt es in der Show.
//
// JEDER BEFUND IST NACHRECHENBAR. Dieselbe Regel wie im Adressplan
// (Initiative 8): keine Vermutungen. Eine Warnung, die falsch anschlaegt, wird
// nach dem zweiten Mal ignoriert — dann auch die richtigen daneben. Deshalb
// steht hier NICHT „diese Bitrate ist zu hoch fuer diese Leitung" (die
// Leitung kennt der Plan nicht) und NICHT „diese Aufloesung passt nicht zur
// Kamera" (das waere eine Vermutung ueber die Produktion).
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { CsvCell, CsvTable } from './csv'
import type { DeliveryDestination, EncodingProfile } from '../types/delivery'
import { platformByKey } from '../types/delivery'

export type DeliveryIssueKind =
  /** Backup weicht in einem der sechs Pflichtfelder ab. */
  | 'backup-mismatch'
  /** `backupOfId` zeigt auf kein vorhandenes Ziel. */
  | 'backup-orphan'
  /** Ein Ziel ist sein eigenes Backup, oder der Zeiger laeuft im Kreis. */
  | 'backup-cycle'
  /** Kein Ausweichweg fuer ein Ziel, das keiner ist. */
  | 'no-backup'
  /** Ingest-URL fehlt. */
  | 'missing-url'
  /** Kein Stream-Key im Schluesselbund. */
  | 'missing-key'
  /** Bitrate ueber dem, was die Plattform belegt annimmt. */
  | 'over-platform-bitrate'
  /** Keyframe-Abstand weicht von dem ab, was die Plattform verlangt. */
  | 'keyframe-mismatch'
  /** SRT-Listener braucht eine Portfreigabe, und das steht nirgends. */
  | 'needs-port-forward'

export interface DeliveryIssue {
  kind: DeliveryIssueKind
  /** Welches Ziel. */
  destinationId: string
  /** Bei `backup-mismatch`: welche der sechs Eigenschaften abweicht. */
  field?: keyof EncodingProfile
  /** Der Wert am Primaerweg bzw. die Vorgabe der Plattform. */
  expected?: string
  /** Der Wert an diesem Ziel. */
  actual?: string
}

/** Die sechs Felder aus der YouTube-Regel, in der Reihenfolge, in der die
 *  Quelle sie nennt. Als Liste und nicht als sechs `if`, weil ein siebtes
 *  Feld sonst an sechs Stellen nachgetragen werden muesste. */
export const PARITY_FIELDS: ReadonlyArray<keyof EncodingProfile> = [
  'width',
  'height',
  'videoCodec',
  'videoBitrateKbps',
  'fps',
  'keyframeSec',
  'audioSampleRate',
]

export interface DeliveryReport {
  issues: DeliveryIssue[]
  /** Ziele, die kein Backup eines anderen sind — die eigentlichen Ausspielwege. */
  primaries: DeliveryDestination[]
  /** Summe aller Primaerwege in kbit/s. Der Nenner fuers Uplink-Budget. */
  primaryKbps: number
}

/**
 * Laeuft der Backup-Zeiger im Kreis?
 *
 * Der Fall ist selten und trotzdem noetig: ohne die Pruefung dreht sich die
 * Aufloesung des Primaerwegs unten in einer Endlosschleife, und das ist ein
 * eingefrorenes Fenster statt eines Befunds.
 */
const followsToCycle = (start: DeliveryDestination, byId: Map<string, DeliveryDestination>): boolean => {
  const seen = new Set<string>([start.id])
  let cur = start.backupOfId ? byId.get(start.backupOfId) : undefined
  while (cur) {
    if (seen.has(cur.id)) return true
    seen.add(cur.id)
    cur = cur.backupOfId ? byId.get(cur.backupOfId) : undefined
  }
  return false
}

const asText = (v: unknown): string => String(v)

/**
 * Die Ausspielung pruefen.
 *
 * Reihenfolge der Befunde folgt der Zielliste; das Sortieren gehoert der
 * Ansicht.
 */
export function checkDelivery(destinations: DeliveryDestination[]): DeliveryReport {
  const byId = new Map(destinations.map((d) => [d.id, d]))
  const issues: DeliveryIssue[] = []
  const hasBackup = new Set(
    destinations.map((d) => d.backupOfId).filter((id): id is string => !!id),
  )

  for (const d of destinations) {
    if (!d.ingestUrl?.trim()) issues.push({ kind: 'missing-url', destinationId: d.id })
    if (!d.hasStreamKey) issues.push({ kind: 'missing-key', destinationId: d.id })

    if (d.srt?.mode === 'listener') {
      issues.push({ kind: 'needs-port-forward', destinationId: d.id })
    }

    const platform = platformByKey(d.platform)
    if (platform?.maxVideoBitrateKbps && d.encoding.videoBitrateKbps > platform.maxVideoBitrateKbps) {
      issues.push({
        kind: 'over-platform-bitrate',
        destinationId: d.id,
        expected: `${platform.maxVideoBitrateKbps} kbit/s`,
        actual: `${d.encoding.videoBitrateKbps} kbit/s`,
      })
    }
    if (platform?.requiredKeyframeSec !== undefined && d.encoding.keyframeSec !== platform.requiredKeyframeSec) {
      issues.push({
        kind: 'keyframe-mismatch',
        destinationId: d.id,
        expected: `${platform.requiredKeyframeSec} s`,
        actual: `${d.encoding.keyframeSec} s`,
      })
    }

    if (d.backupOfId) {
      const primary = byId.get(d.backupOfId)
      if (!primary || d.backupOfId === d.id) {
        issues.push({ kind: 'backup-orphan', destinationId: d.id })
      } else if (followsToCycle(d, byId)) {
        issues.push({ kind: 'backup-cycle', destinationId: d.id })
      } else {
        // DIE eigentliche Pruefung: die sechs Pflichtfelder.
        for (const f of PARITY_FIELDS) {
          if (d.encoding[f] !== primary.encoding[f]) {
            issues.push({
              kind: 'backup-mismatch',
              destinationId: d.id,
              field: f,
              expected: asText(primary.encoding[f]),
              actual: asText(d.encoding[f]),
            })
          }
        }
      }
    } else if (!hasBackup.has(d.id)) {
      // Ein Ausspielweg ohne Ausweichweg. Kein Fehler — viele Produktionen
      // fahren bewusst einfach —, aber der Befund, der in der Probe zaehlt.
      issues.push({ kind: 'no-backup', destinationId: d.id })
    }
  }

  const primaries = destinations.filter((d) => !d.backupOfId)
  return {
    issues,
    primaries,
    primaryKbps: primaries.reduce(
      (n, d) => n + d.encoding.videoBitrateKbps + d.encoding.audioBitrateKbps,
      0,
    ),
  }
}

/**
 * Der Befund im Klartext — DEUTSCH und ohne `t()`.
 *
 * Warum nicht uebersetzt: diese Zeichenkette landet im CSV, und das CSV traegt
 * einen Dokument-Stempel (ADR-004). Ein Fingerabdruck ueber uebersetzten Text
 * waere sprachabhaengig — dieselbe Ausspielung ergaebe auf Englisch einen
 * anderen Stand, und ein Blatt aus der englischen Oberflaeche liesse sich mit
 * der deutschen nie wieder als aktuell nachweisen. Die Suite loest denselben
 * Fall genauso: uebersetzt wird die Ansicht, gestempelt wird die kanonische
 * Tabelle.
 */
export const deliveryIssueText = (i: DeliveryIssue): string => {
  switch (i.kind) {
    case 'backup-mismatch':
      return `Backup weicht ab: ${String(i.field)} ist ${i.actual}, muss ${i.expected} sein`
    case 'backup-orphan':
      return 'Backup-Zeiger fuehrt ins Leere'
    case 'backup-cycle':
      return 'Backup-Zeiger laufen im Kreis'
    case 'no-backup':
      return 'Kein Ausweichweg'
    case 'missing-url':
      return 'Keine Ingest-URL'
    case 'missing-key':
      return 'Kein Stream-Key hinterlegt'
    case 'over-platform-bitrate':
      return `Bitrate ${i.actual} ueber der Plattform-Grenze ${i.expected}`
    case 'keyframe-mismatch':
      return `Keyframe-Abstand ${i.actual}, verlangt ist ${i.expected}`
    case 'needs-port-forward':
      return 'SRT-Listener: Portfreigabe noetig'
  }
}

/**
 * Die Ausspielung als Tabelle — Grundlage fuer CSV und fuer den Stempel.
 *
 * DER STREAM-KEY IST HIER NICHT DRIN und darf es nie sein: ein CSV geht per
 * Mail und liegt danach im Postfach von vier Leuten. Was drinsteht, ist die
 * Tatsache, DASS einer hinterlegt ist.
 */
export function deliveryTable(destinations: DeliveryDestination[]): CsvTable {
  const report = checkDelivery(destinations)
  const byDest = new Map<string, DeliveryIssue[]>()
  for (const i of report.issues) {
    byDest.set(i.destinationId, [...(byDest.get(i.destinationId) ?? []), i])
  }
  const nameById = new Map(destinations.map((d) => [d.id, d.name]))
  return {
    headers: [
      'Ziel',
      'Plattform',
      'Transport',
      'Ingest-URL',
      'Key hinterlegt',
      'Bild',
      'Video',
      'Keyframe',
      'Audio',
      'Backup von',
      'Befund',
    ],
    rows: destinations.map((d): CsvCell[] => [
      d.name,
      d.platform,
      d.transport,
      d.ingestUrl ?? '',
      d.hasStreamKey ? 'ja' : 'nein',
      `${d.encoding.width}x${d.encoding.height}p${d.encoding.fps}`,
      `${d.encoding.videoBitrateKbps} kbit/s ${d.encoding.videoCodec}`,
      `${d.encoding.keyframeSec} s`,
      `${d.encoding.audioCodec} ${d.encoding.audioSampleRate} Hz ${d.encoding.audioBitrateKbps} kbit/s`,
      d.backupOfId ? (nameById.get(d.backupOfId) ?? d.backupOfId) : '',
      (byDest.get(d.id) ?? []).map(deliveryIssueText).join('; '),
    ]),
  }
}

/**
 * Dieselbe Tabelle, aber aus dem Projekt gegriffen.
 *
 * Braucht es, weil `stampForRows` und das Dokument-Register eine Ableitung
 * `(project) => CsvTable` erwarten — und weil ein Aufrufer sonst an drei
 * Stellen `project.deliveryDestinations ?? []` schreiben muesste. Eine
 * vergessene Stelle stempelte dann eine andere Tabelle, als sie exportiert.
 */
export const deliveryTableForProject = (project: {
  deliveryDestinations?: DeliveryDestination[]
}): CsvTable => deliveryTable(project.deliveryDestinations ?? [])
