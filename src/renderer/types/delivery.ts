// ───────────────────────────────────────────────────────────────────────────
// Die Ausspielung als Datenobjekt (Initiative 9, zweite Haelfte).
//
// WARUM DAS HIER STEHT. Sieben P1-Bedarfe der Rolle „Streaming" haengen an
// genau einem fehlenden Objekt (Bedarfs-Datenbank Nr. 28-34). Nr. 28 nennt es
// beim Namen: „One per-project register of delivery destinations (platform,
// ingest URL, stream key, backup URL, backup key, required encoding
// parameters, account)". Der Rollen-Bericht sagt, was es heute ersetzt:
//
//   > None of this arrives in one place. It comes from the client by email,
//   > from a platform console the engineer may not have access to yet, and
//   > from a producer's spreadsheet.
//
// Die Contribution-Haelfte des Signalflusses steht seit langem (NDI, Dante,
// AES67, ST 2110 mit Bandbreite und Impedanz, Netz-Budget, PTP-Pruefung). Was
// fehlte, war die Distribution-Haelfte: wohin ausgespielt wird, mit welchen
// Parametern, und was passiert, wenn der Primaerweg stirbt.
//
// DER STREAM-KEY STEHT NICHT IN DIESER DATEI UND IN KEINEM PROJEKT.
// `CLAUDE.md` schreibt fuer externe Tokens den OS-Schluesselbund vor
// („niemals loggen oder ins Projekt-File schreiben"), und ein Stream-Key ist
// genau das: wer ihn hat, sendet auf den Kanal des Kunden. Das Projekt traegt
// deshalb nur die Tatsache, DASS einer hinterlegt ist; der Wert liegt via
// `keytar` unter `stream-key:<id>` neben dem Rentman- und dem NetBox-Token.
// Ein `.avplan` wandert per Mail, liegt in Dropbox und geht in den
// Mobile-Viewer — jeder dieser Wege haette den Key mitgenommen.
//
// JEDER VORGABEWERT TRAEGT SEINE QUELLE. Dieselbe Regel wie bei
// `manufacturerUrl` im Katalog (Initiative 11): eine Zahl ohne Beleg ist im
// Zweifel eine Erfindung, und die Bedarfs-Datenbank sagt fuer den
// Transport-Rechner ausdruecklich „an unattributed value would be worse than
// none". Deshalb haengt an jedem Plattform-Vorgabewert die Fundstelle.
// ───────────────────────────────────────────────────────────────────────────

/** Transport, ueber den ein Ziel beliefert wird. Teilmenge von `SignalStandard`
 *  — dieselben Vokabeln, damit ein Ziel spaeter an einem Kabel haengen kann. */
export type DeliveryTransport = 'SRT' | 'RTMP' | 'HLS'

/**
 * SRT-Verbindungsart. Der Rollen-Bericht nennt sie ausdruecklich eine
 * Firewall-/NAT-Entscheidung und keine Video-Entscheidung: der Listener
 * braucht eine Portfreigabe, der Caller meist nichts, und Rendezvous ist
 * hinter PAT weitgehend unbrauchbar.
 * Quelle: doc.haivision.com/SRT/1.5.3/Haivision/srt-connection-modes
 */
export type SrtMode = 'caller' | 'listener' | 'rendezvous'

/**
 * Die sechs Felder, die zwischen Primaer- und Backup-Weg uebereinstimmen
 * MUESSEN — nicht sollen.
 *
 * > YouTube's primary and backup streams must have the *exact same*
 * > resolution, video codec, bitrate, framerate, keyframe frequency and audio
 * > sample rate, and if they drift apart, failover breaks or throws ingest
 * > errors.
 *
 * Quellen: support.google.com/youtube/answer/2853702 und
 * docs.castr.com/en/articles/5023371-backup-ingest-how-to-use-benefits-and-limitations
 *
 * Genau diese sechs sind es, und deshalb sind es hier genau diese sechs
 * Pflichtfelder: ein optionales Feld waere ein Vergleich, der bei fehlender
 * Angabe stillschweigend „gleich" sagt.
 */
export interface EncodingProfile {
  width: number
  height: number
  fps: number
  videoCodec: 'H.264' | 'HEVC' | 'AV1'
  /** Video-Bitrate in kbit/s. */
  videoBitrateKbps: number
  /** Keyframe-Abstand in Sekunden. Plattformen verlangen meist 2. */
  keyframeSec: number
  audioCodec: 'AAC' | 'Opus'
  /** Audio-Abtastrate in Hz. */
  audioSampleRate: number
  /** Audio-Bitrate in kbit/s. */
  audioBitrateKbps: number
}

export interface DeliveryDestination {
  id: string
  /** Wie das Ziel im Ablauf heisst („YouTube Haupt", „Kunde SRT"). */
  name: string
  /** Plattform-Schluessel aus `DELIVERY_PLATFORMS`, oder `custom`. */
  platform: string
  transport: DeliveryTransport
  /** Ingest-URL ohne Key. Der Key steht NICHT im Projekt. */
  ingestUrl?: string
  /**
   * Ob fuer dieses Ziel ein Stream-Key im OS-Schluesselbund liegt.
   *
   * Eine TATSACHE, kein Wert — und sie wird beim Laden nachgeprueft statt
   * geglaubt (`refreshStreamKeyPresence`). Ein Projekt, das von einem anderen
   * Rechner kommt, behauptet sonst einen Key, den es hier nicht gibt: der
   * Techniker sieht ein Haekchen und merkt am Showtag, dass nichts hinterlegt
   * ist.
   */
  hasStreamKey?: boolean
  /** Konto/Kanal auf der Plattform — hilft, den richtigen Key zu finden. */
  account?: string
  encoding: EncodingProfile
  /** Nur bei SRT gesetzt. */
  srt?: {
    mode: SrtMode
    /** Latenz-Puffer in ms. Siehe `lib/transportParams.ts`. */
    latencyMs?: number
    /** Gemessene Rundlaufzeit in ms, wenn jemand sie gemessen hat. */
    measuredRttMs?: number
    /** Portfreigabe noetig? Ergibt sich aus `mode`, wird nicht gespeichert. */
    port?: number
  }
  /**
   * Zeigt auf das Ziel, dessen Backup dieses ist. Gesetzt heisst: dieses Ziel
   * ist der Ausweichweg fuer jenes.
   *
   * Die Richtung ist Absicht. Ein `backupId` am Primaerziel liesse zwei
   * Backups nicht zu und wuerde bei geloeschtem Backup zum Fehlzeiger; so
   * verschwindet die Beziehung mit dem Backup, das sie behauptet.
   */
  backupOfId?: string
  /**
   * Das GERAET im Plan, das dieses Ziel beliefert (Bedarf 32).
   *
   * Bis hierher endete der Signalfluss am Encoder-Eingang: das Ziel-Register
   * war ein zweites Dokument neben dem Plan, und der Bedarf sagt genau das —
   * „signal-flow diagrams stop at the encoder input; everything downstream
   * lives in encoder web UIs, platform consoles and someone's head, so no
   * artefact shows the delivery path".
   *
   * Dieses eine Feld schliesst die Naht. Es ist eine `EquipmentItem.id`, also
   * ein Zeiger in denselben Plan, aus dem Kabel und Anschluesse kommen —
   * damit ist der Weg vom Programm-Signal bis zur Plattform ableitbar
   * (`lib/deliveryPath.ts`) statt erzaehlt.
   *
   * OPTIONAL, und das bleibt es. Ein Ziel ohne benanntes Geraet ist ein
   * gueltiges Ziel — der Weg dahin ist dann eben unbekannt, und die Kette
   * sagt das als Befund (`no-encoder`), statt sich einen Encoder auszusuchen.
   * Ein Zeiger auf ein geloeschtes Geraet wird beim Laden NICHT stillschweigend
   * entfernt: `encoder-gone` ist die ehrlichere Antwort als ein Feld, das
   * kommentarlos leer wird.
   */
  encoderEquipmentId?: string
  /** Notiz — was am Showtag jemand wissen muss. */
  note?: string
}

/** Ein Plattform-Vorgabewert mit seiner Fundstelle. */
export interface DeliveryPlatform {
  key: string
  label: string
  transport: DeliveryTransport
  /** Ingest-URL-Muster, soweit die Plattform eine feste hat. */
  ingestUrl?: string
  /** Obergrenze der Video-Bitrate in kbit/s, wo die Plattform eine nennt. */
  maxVideoBitrateKbps?: number
  /** Was die Plattform als Keyframe-Abstand verlangt. */
  requiredKeyframeSec?: number
  /** Groesste Bildgroesse, die die Plattform annimmt (Kurzform). */
  maxResolution?: string
  /** Die Fundstelle. Ohne sie kein Vorgabewert. */
  source: string
}

/**
 * Plattform-Vorgaben, alle aus dem Rollen-Bericht belegt.
 *
 * ABSICHTLICH KURZ. Hier stehen nur Werte, fuer die im Korpus eine Fundstelle
 * liegt. Ein Katalog mit dreissig Plattformen und geratenen Bitraten waere
 * schlimmer als diese drei Zeilen: er saehe vollstaendig aus.
 */
export const DELIVERY_PLATFORMS: ReadonlyArray<DeliveryPlatform> = [
  {
    key: 'youtube',
    label: 'YouTube Live',
    transport: 'RTMP',
    ingestUrl: 'rtmp://a.rtmp.youtube.com/live2',
    // „YouTube accepts 9,000-12,000 kbps at 1080p60 and supports 4K, which
    // Twitch does not." Die Obergrenze der genannten Spanne.
    maxVideoBitrateKbps: 12000,
    maxResolution: '2160p',
    source: 'stream.twitch.tv/encoding/ · streamersize.com/blog/twitch-vs-youtube-bitrate-comparison/',
  },
  {
    key: 'twitch',
    label: 'Twitch',
    transport: 'RTMP',
    // „Twitch caps non-partners near 6,000 kbps."
    maxVideoBitrateKbps: 6000,
    maxResolution: '1080p',
    source: 'stream.twitch.tv/encoding/',
  },
  {
    key: 'custom',
    label: 'Eigenes Ziel',
    transport: 'SRT',
    source: '—',
  },
]

export const platformByKey = (key: string): DeliveryPlatform | undefined =>
  DELIVERY_PLATFORMS.find((p) => p.key === key)

/** Der Schluesselbund-Account eines Ziels. Abgeleitet, nie gespeichert —
 *  sonst koennten Zeiger und Ablage auseinanderlaufen. */
export const streamKeyAccount = (destinationId: string): string => `stream-key:${destinationId}`

/** Vorgabe-Encoding, wenn ein Ziel neu angelegt wird. 1080p25 H.264 mit
 *  2-Sekunden-Keyframes — das, was jede der belegten Plattformen annimmt. */
export const DEFAULT_ENCODING: EncodingProfile = {
  width: 1920,
  height: 1080,
  fps: 25,
  videoCodec: 'H.264',
  videoBitrateKbps: 6000,
  keyframeSec: 2,
  audioCodec: 'AAC',
  audioSampleRate: 48000,
  audioBitrateKbps: 128,
}

/**
 * Ein Rohsatz aus einer Projektdatei in ein gueltiges Ziel — oder `null`.
 *
 * Warum das hier steht und nicht im Store: dieselbe Regel wie bei
 * `normaliseSourceIdentity`. Ein Ziel ohne Namen oder ohne Encoding ist kein
 * Ziel; es still zu behalten hiesse, dass die Paritaetspruefung gegen
 * `undefined` vergleicht und „stimmt ueberein" sagt.
 *
 * `hasStreamKey` wird beim Laden bewusst NICHT uebernommen, sondern auf
 * `false` gesetzt: die Tatsache gilt fuer DIESEN Rechner, und die Datei kommt
 * womoeglich von einem anderen. Der Renderer fragt den Schluesselbund danach
 * nach (`refreshStreamKeyPresence`). Ein aus der Datei geglaubtes Haekchen
 * waere genau die falsche Gewissheit, gegen die ADR-003 geschrieben ist.
 */
export const normaliseDeliveryDestination = (
  raw: unknown,
  fallbackId: string,
): DeliveryDestination | null => {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const name = typeof r.name === 'string' ? r.name.trim() : ''
  if (!name) return null
  const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : fallbackId
  const enc = (r.encoding ?? {}) as Record<string, unknown>
  const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
  const encoding: EncodingProfile = {
    width: num(enc.width, DEFAULT_ENCODING.width),
    height: num(enc.height, DEFAULT_ENCODING.height),
    fps: num(enc.fps, DEFAULT_ENCODING.fps),
    videoCodec:
      enc.videoCodec === 'HEVC' || enc.videoCodec === 'AV1' ? enc.videoCodec : DEFAULT_ENCODING.videoCodec,
    videoBitrateKbps: num(enc.videoBitrateKbps, DEFAULT_ENCODING.videoBitrateKbps),
    keyframeSec: num(enc.keyframeSec, DEFAULT_ENCODING.keyframeSec),
    audioCodec: enc.audioCodec === 'Opus' ? 'Opus' : DEFAULT_ENCODING.audioCodec,
    audioSampleRate: num(enc.audioSampleRate, DEFAULT_ENCODING.audioSampleRate),
    audioBitrateKbps: num(enc.audioBitrateKbps, DEFAULT_ENCODING.audioBitrateKbps),
  }
  const transport: DeliveryTransport =
    r.transport === 'SRT' || r.transport === 'HLS' ? r.transport : 'RTMP'
  const out: DeliveryDestination = {
    id,
    name,
    platform: typeof r.platform === 'string' && r.platform ? r.platform : 'custom',
    transport,
    encoding,
    // Nie aus der Datei geglaubt — siehe oben.
    hasStreamKey: false,
  }
  if (typeof r.ingestUrl === 'string' && r.ingestUrl.trim()) out.ingestUrl = r.ingestUrl.trim()
  if (typeof r.account === 'string' && r.account.trim()) out.account = r.account.trim()
  if (typeof r.note === 'string' && r.note.trim()) out.note = r.note.trim()
  // Bedarf 32: der Zeiger auf den Encoder im Plan. Ob das Geraet noch
  // existiert, weiss diese Funktion nicht — sie sieht nur den Rohsatz. Genau
  // deshalb wird hier nichts verworfen: `buildDeliveryChains` sagt spaeter
  // `encoder-gone`, und das ist eine Auskunft. Ein hier still geleertes Feld
  // waere keine.
  if (typeof r.encoderEquipmentId === 'string' && r.encoderEquipmentId.trim()) {
    out.encoderEquipmentId = r.encoderEquipmentId.trim()
  }
  if (typeof r.backupOfId === 'string' && r.backupOfId.trim() && r.backupOfId.trim() !== id) {
    out.backupOfId = r.backupOfId.trim()
  }
  const srt = r.srt as Record<string, unknown> | undefined
  if (transport === 'SRT' && srt && typeof srt === 'object') {
    const mode: SrtMode =
      srt.mode === 'listener' || srt.mode === 'rendezvous' ? srt.mode : 'caller'
    out.srt = { mode }
    if (typeof srt.latencyMs === 'number' && srt.latencyMs > 0) out.srt.latencyMs = srt.latencyMs
    if (typeof srt.measuredRttMs === 'number' && srt.measuredRttMs > 0) {
      out.srt.measuredRttMs = srt.measuredRttMs
    }
    if (typeof srt.port === 'number' && srt.port > 0 && srt.port < 65536) out.srt.port = srt.port
  }
  return out
}
