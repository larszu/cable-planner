// ───────────────────────────────────────────────────────────────────────────
// #946 — Streams am Geraet: was ein Geraet ueber das Netz sendet oder
// empfaengt (RTSP, SRT, RTMP, NDI, HLS, WebRTC …).
//
// ─── PLAN, NICHT BEOBACHTUNG ───────────────────────────────────────────────
//
// Ein Eintrag hier ist eine Angabe im Plan: „diese Kamera gibt unter dieser
// Adresse einen RTSP-Strom aus". Ob der Strom gerade laeuft, steht NICHT
// hier (Invariante 14). Die Vorschau am Canvas holt, wenn eingeschaltet, ein
// Standbild von `previewUrl` und zeigt es mit Zeitstempel — das Bild selbst
// lebt nur in der Komponente und nie im Projekt.
//
// ─── KEINE ZUGANGSDATEN IN DER ADRESSE ─────────────────────────────────────
//
// `rtsp://user:pass@…` ist die uebliche Schreibweise, und genau deshalb wird
// sie beim Speichern entfernt (`streamUrlOhneZugang`): die Projektdatei geht
// per Mail, in den Mobile-Viewer und nach GitHub Pages. Dasselbe gilt fuer
// geheime Query-Parameter (`passphrase=` bei SRT, `token=`, `password=`).
// Was herausgetrennt wird, legt die Desktop-App im Schluesselbund DIESES
// Rechners ab (`streamCredential:*`, wie die Stream-Keys der Ausspielziele);
// nur der Standbild-Abruf im Main-Prozess setzt es wieder ein. Ein
// RTMP-Stream-Key ist ein Geheimnis wie ein Token und gehoert in die
// Ausspielziele (Schluesselbund), nicht hierher.
// ───────────────────────────────────────────────────────────────────────────

// Nachtrag #946: die Liste folgt dem Vokabular von `SignalStandard`
// (`types/cableSpec.ts`), wo es dort schon Woerter gibt (NDI-HX, Dante, AES67),
// und ergaenzt die Ausspiel-Protokolle, die Encoder und Mediaserver anbieten
// (WHIP/WHEP, RTP/SDP, MJPEG). Alles andere geht als `other` mit Beschriftung.
export type StreamProtocol =
  | 'rtsp'
  | 'srt'
  | 'rtmp'
  | 'ndi'
  | 'ndi-hx'
  | 'hls'
  | 'mjpeg'
  | 'webrtc'
  | 'whip'
  | 'whep'
  | 'rtp'
  | 'st2110'
  | 'dante'
  | 'aes67'
  | 'other'

export const STREAM_PROTOCOLS: ReadonlyArray<StreamProtocol> = [
  'rtsp',
  'srt',
  'rtmp',
  'ndi',
  'ndi-hx',
  'hls',
  'mjpeg',
  'webrtc',
  'whip',
  'whep',
  'rtp',
  'st2110',
  'dante',
  'aes67',
  'other',
]

/** Sendet das Geraet den Strom, empfaengt es ihn — oder kann es beides? */
export type StreamDirection = 'send' | 'receive' | 'both'

export const STREAM_DIRECTIONS: ReadonlyArray<StreamDirection> = ['send', 'receive', 'both']

export interface StreamEndpoint {
  id: string
  protocol: StreamProtocol
  direction: StreamDirection
  /** Beschriftung („Main", „Proxy 720p", „Return-Feed"). */
  label?: string
  /** Stream-Adresse OHNE Zugangsdaten; bei NDI der Quellname. */
  url?: string
  /**
   * Adresse eines Standbilds (HTTP-JPEG/PNG, z. B. `/snapshot.jpg` der
   * Kamera). RTSP/SRT selbst kann die App nicht abspielen — ein Standbild
   * ist, was sie ehrlich zeigen kann.
   */
  previewUrl?: string
  /**
   * Vorschau am Canvas zeigen. Eine Planangabe: „diese Kachel will ich".
   * Sie startet KEINEN Abruf beim Oeffnen der Datei — das tut erst ein Klick
   * in dieser Sitzung (`streamPreviewStore`), siehe Nachtrag #946.
   */
  showPreview?: boolean
  notes?: string
  /** Port, wenn er nicht in der Adresse steht (NDI, Dante, SRT-Listener). */
  port?: number
  /** Codec, frei („H.264", „HEVC", „JPEG XS", „L24"). */
  codec?: string
  /** Aufloesung/Bildrate, frei („1920x1080p50"). */
  format?: string
}
