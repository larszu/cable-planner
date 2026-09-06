// ───────────────────────────────────────────────────────────────────────────
// Kann der Encoder, was der Plan verlangt? (Bedarfe 33 und 36, beide P1)
//
// BEDARF 36 BESCHREIBT EINEN WIDERSPRUCH ZWISCHEN PLAN UND WERKZEUG:
//
//   > vMix disables multi-bitrate the moment a second destination is added
//   > and defaults all targets to identical quality; the OBS multi-RTMP
//   > plugin's per-destination quality question is open and unanswered; the
//   > recommended workaround gives up quality control to protect the CPU.
//
// Und Bedarf 31 sagt, was heute stattdessen passiert: „nothing validates
// them, so the only proof the backup works is deliberately killing the
// primary during rehearsal".
//
// Der Plan KANN Qualität je Ziel führen — das ist richtig so, denn Twitch
// nimmt 6.000 kbit/s und YouTube 12.000. Was fehlte, ist die Auskunft, ob das
// Werkzeug am Showtag das auch liefern kann. Genau die gibt diese Datei, und
// zwar aus BELEGTEN Herstellerangaben statt aus Erfahrung.
//
// ─── WAS HIER BEWUSST NICHT ENTSTEHT ───────────────────────────────────────
//
// Keine OBS-Profil-Datei, kein vMix-Preset, kein NOALBS-JSON. Bedarf 33
// nennt sie als Ziel („best-effort, versioned exporters"), aber die genauen
// Schlüssel dieser Formate liegen in dieser Recherche NICHT vor — vom NOALBS-
// Konfigurationsumfang ist die FELDLISTE gelesen, nicht das Schema. Eine
// Datei mit erfundenen Schlüsselnamen, die „OBS-Profil" heisst, sieht geprüft
// aus und ist geraten; sie kostet am Showtag mehr Zeit als das Abtippen, weil
// jemand erst herausfinden muss, warum das Werkzeug sie nicht liest.
//
// Was stattdessen entsteht, ist der Teil, den Bedarf 33 ebenfalls nennt und
// der ohne fremdes Schema auskommt: **das Ablauf-Blatt**, „a printable
// destination sheet for the run of show" — mit dem Stream-Key als VERWEIS,
// nie als Wert („secrets as references"). Wer die Exporter später baut, hat
// mit `deliveryDestinations` das Modell dafür; ihm fehlt nur noch das Schema.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { DeliveryDestination, EncodingProfile } from '../types/delivery'
import { checkDelivery } from './deliveryParity'
import type { CsvCell, CsvTable } from './csv'

/** Encoder, über die diese Recherche eine belegte Aussage hat. */
export type EncoderId = 'vmix' | 'obs-multi-rtmp'

export interface EncoderSpec {
  id: EncoderId
  label: string
  /** Wie viele gleichzeitige Ziele das Werkzeug führt. `undefined` = keine
   *  belegte Grenze; dann wird auch keine behauptet. */
  maxDestinations?: number
  /**
   * Kann es je Ziel eine EIGENE Qualität senden? `false` heisst belegt-nein,
   * `unknown` heisst: die Frage ist gestellt und unbeantwortet — und das ist
   * ein eigener Zustand, kein Nein. Ein Werkzeug, dessen Verhalten niemand
   * kennt, sollte nicht als „geht nicht" im Plan stehen.
   */
  perDestinationQuality: false | 'unknown'
  /** Felder, die über alle Ziele gleich sein müssen. */
  mustMatch: ReadonlyArray<keyof EncodingProfile>
  source: string
}

/**
 * ZWEI EINTRÄGE, NICHT ZEHN. Hier steht nur, wofür diese Recherche eine
 * Fundstelle hat. Ein Katalog mit zehn Encodern und geratenen Grenzen wäre
 * schlimmer als diese zwei Zeilen: er sähe vollständig aus.
 */
export const ENCODERS: ReadonlyArray<EncoderSpec> = [
  {
    id: 'vmix',
    label: 'vMix',
    // „up to three destinations"
    maxDestinations: 3,
    // „multi-bitrate support is *disabled* when using multiple destinations,
    // and … by default all three destinations use the same quality settings —
    // video bitrate, audio bitrate, encode size — and … keyframe frequency and
    // master frame rate must match for every additional streaming target"
    perDestinationQuality: false,
    mustMatch: ['videoBitrateKbps', 'audioBitrateKbps', 'width', 'height', 'keyframeSec', 'fps'],
    source: 'vmix.com/help23/StreamingMultipleDestinations.html · vmix.com/help23/StreamingMultiBitrate.html',
  },
  {
    id: 'obs-multi-rtmp',
    label: 'OBS + obs-multi-rtmp',
    // Keine belegte Zielgrenze — also wird keine behauptet.
    // Die Qualitätsfrage je Ziel ist gestellt und unbeantwortet:
    // sorayuki/obs-multi-rtmp#448, offen seit 2024-10-26, ohne Antwort des
    // Betreuers; der empfohlene Ausweg („Get from OBS") gibt sie ausdruecklich
    // auf, um die CPU zu schonen.
    perDestinationQuality: 'unknown',
    mustMatch: [],
    source: 'github.com/sorayuki/obs-multi-rtmp/issues/448 (offen, ohne Antwort)',
  },
]

export type FeasibilityKind =
  /** Mehr gleichzeitige Ziele, als das Werkzeug führt. */
  | 'too-many-destinations'
  /** Der Plan verlangt je Ziel eine andere Qualität; das Werkzeug kann es nicht. */
  | 'per-destination-quality-unsupported'
  /** Dasselbe, aber die Quelle sagt „unbeantwortet" statt „nein". */
  | 'per-destination-quality-unknown'
  /** Ein Feld, das über alle Ziele gleich sein muss, weicht ab. */
  | 'must-match-differs'

export interface FeasibilityFinding {
  kind: FeasibilityKind
  encoder: EncoderId
  /**
   * Das Geraet im Plan, dessen Ziele diesen Befund ausgeloest haben
   * (`DeliveryDestination.encoderEquipmentId`, Bedarf 32).
   *
   * `undefined` heisst: die Ziele dieser Gruppe benennen kein Geraet. Dann
   * gilt der Befund fuer sie gemeinsam — mehr weiss der Plan nicht.
   */
  deviceId?: string
  /** Bei `must-match-differs`: welches Feld. */
  field?: keyof EncodingProfile
  /** Die abweichenden Werte im Klartext, in Zielreihenfolge. */
  values?: string[]
  /** Die Fundstelle der Herstellerangabe. Ohne sie kein Befund. */
  source: string
}

/**
 * Die Primaerwege, gruppiert nach dem GERAET, das sie beliefert (Bedarf 32).
 *
 * WARUM DAS NOETIG WURDE. Bis `encoderEquipmentId` existierte, zaehlte diese
 * Datei alle Primaerwege in einen Topf und hielt die Summe gegen die
 * Zielgrenze eines Werkzeugs. Das setzt stillschweigend voraus, dass alle
 * Ziele auf DEMSELBEN Encoder liegen — bei zwei Maschinen mit je zwei Zielen
 * meldete sie „vier gleichzeitige Ziele, vMix fuehrt drei", obwohl keine der
 * beiden Maschinen mehr als zwei zu tragen hat. Ein falscher Befund auf einem
 * korrekten Aufbau, und laut dem Kommentar oben ist genau das der Weg, auf
 * dem auch die richtigen Befunde ignoriert werden.
 *
 * Ziele ohne benanntes Geraet bilden EINE Gruppe. Das ist die vorsichtigere
 * Annahme (der uebliche Fall ist eine Maschine, die niemand aufgeschrieben
 * hat) und zugleich das bisherige Verhalten — wer kein Geraet benennt,
 * bekommt genau die Pruefung von vorher.
 */
export interface EncoderGroup {
  /** Das benannte Geraet, oder `undefined` fuer die Ziele ohne Angabe. */
  deviceId?: string
  destinations: DeliveryDestination[]
}

export function groupByEncoder(destinations: DeliveryDestination[]): EncoderGroup[] {
  const groups = new Map<string, EncoderGroup>()
  for (const d of destinations) {
    // Der leere Schluessel ist die Gruppe „kein Geraet benannt". Ein Geraet
    // kann nie so heissen, weil `encoderEquipmentId` beim Laden getrimmt und
    // leer verworfen wird.
    const key = d.encoderEquipmentId ?? ''
    const existing = groups.get(key)
    if (existing) existing.destinations.push(d)
    else groups.set(key, { ...(key ? { deviceId: key } : {}), destinations: [d] })
  }
  return [...groups.values()]
}

/**
 * Den Plan gegen einen Encoder halten.
 *
 * Gezählt werden die PRIMÄRWEGE — ein Backup läuft im Havariefall und nicht
 * daneben; es als viertes gleichzeitiges Ziel zu zählen ergäbe einen Befund,
 * den es nicht gibt. Dieselbe Regel wie im Uplink-Budget.
 *
 * Und gezählt wird JE GERAET, nicht ueber den ganzen Plan (siehe
 * `groupByEncoder`). Die Gruppierung sitzt hier und nicht beim Aufrufer:
 * damit bekommt jede Stelle, die diese Funktion ruft, dieselbe Rechnung.
 */
export function checkEncoderFeasibility(
  destinations: DeliveryDestination[],
  encoder: EncoderSpec,
): FeasibilityFinding[] {
  const primaries = checkDelivery(destinations).primaries
  return groupByEncoder(primaries).flatMap((g) => findingsForGroup(g, encoder))
}

function findingsForGroup(group: EncoderGroup, encoder: EncoderSpec): FeasibilityFinding[] {
  const primaries = group.destinations
  const deviceId = group.deviceId
  const out: FeasibilityFinding[] = []
  if (primaries.length < 2) return out

  if (encoder.maxDestinations !== undefined && primaries.length > encoder.maxDestinations) {
    out.push({
      kind: 'too-many-destinations',
      encoder: encoder.id,
      deviceId,
      values: [String(primaries.length), String(encoder.maxDestinations)],
      source: encoder.source,
    })
  }

  // Weicht überhaupt eine Qualität ab? Sonst ist die ganze Frage gegenstandslos
  // und eine Warnung darüber wäre Rauschen auf einem korrekten Aufbau.
  const abweichend = (f: keyof EncodingProfile): boolean =>
    new Set(primaries.map((d) => String(d.encoding[f]))).size > 1

  const qualitaetsFelder: ReadonlyArray<keyof EncodingProfile> = [
    'videoBitrateKbps',
    'audioBitrateKbps',
    'width',
    'height',
    'fps',
    'keyframeSec',
    'videoCodec',
  ]
  const unterschiedlich = qualitaetsFelder.some(abweichend)

  if (unterschiedlich) {
    out.push({
      kind:
        encoder.perDestinationQuality === false
          ? 'per-destination-quality-unsupported'
          : 'per-destination-quality-unknown',
      encoder: encoder.id,
      deviceId,
      source: encoder.source,
    })
  }

  for (const f of encoder.mustMatch) {
    if (!abweichend(f)) continue
    out.push({
      kind: 'must-match-differs',
      encoder: encoder.id,
      deviceId,
      field: f,
      values: primaries.map((d) => String(d.encoding[f])),
      source: encoder.source,
    })
  }
  return out
}

/** Alle bekannten Encoder auf einmal. */
export function checkAllEncoders(destinations: DeliveryDestination[]): FeasibilityFinding[] {
  return ENCODERS.flatMap((e) => checkEncoderFeasibility(destinations, e))
}

/**
 * DAS ABLAUF-BLATT (Bedarf 33, der Teil ohne fremdes Schema).
 *
 * „a printable destination sheet for the run of show" — was am Showtag neben
 * dem Encoder liegt. Der Stream-Key steht als **Verweis** darauf, nicht als
 * Wert: „secrets as references" sagt der Bedarf, und ein Blatt, das auf einem
 * Regieplatz liegt, ist der letzte Ort für ein Geheimnis.
 */
export function runOfShowSheet(destinations: DeliveryDestination[]): CsvTable {
  const nameById = new Map(destinations.map((d) => [d.id, d.name]))
  return {
    headers: [
      'Ziel',
      'Rolle',
      'Plattform',
      'Transport',
      'Ingest-URL',
      'Stream-Key',
      'Bild',
      'Video',
      'Keyframe',
      'Audio',
      'Konto',
      'Notiz',
    ],
    rows: destinations.map((d): CsvCell[] => [
      d.name,
      d.backupOfId ? `Backup von ${nameById.get(d.backupOfId) ?? d.backupOfId}` : 'Primaerweg',
      d.platform,
      d.transport,
      d.ingestUrl ?? '',
      // Der VERWEIS, nicht der Wert.
      d.hasStreamKey ? `Schluesselbund: stream-key:${d.id}` : 'nicht hinterlegt',
      `${d.encoding.width}x${d.encoding.height}p${d.encoding.fps}`,
      `${d.encoding.videoBitrateKbps} kbit/s ${d.encoding.videoCodec}`,
      `${d.encoding.keyframeSec} s`,
      `${d.encoding.audioCodec} ${d.encoding.audioSampleRate} Hz ${d.encoding.audioBitrateKbps} kbit/s`,
      d.account ?? '',
      d.note ?? '',
    ]),
  }
}

/** Fuer den Stempel: dieselbe Tabelle aus einem Projekt (oder dessen Snapshot)
 *  gebaut, damit der Fingerabdruck denselben Inhalt misst und keine zweite,
 *  nachgebaute Wahrheit ueber dasselbe Blatt. */
export const runOfShowSheetForProject = (project: {
  deliveryDestinations?: DeliveryDestination[]
}): CsvTable => runOfShowSheet(project.deliveryDestinations ?? [])
