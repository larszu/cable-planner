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
// per Mail, in den Mobile-Viewer und nach GitHub Pages. Benutzer und Passwort
// des Geraets haben ihre eigenen Felder unter „Netzwerk & Zugang". Ein
// RTMP-Stream-Key ist ein Geheimnis wie ein Token und gehoert in die
// Ausspielziele (Schluesselbund), nicht hierher.
// ───────────────────────────────────────────────────────────────────────────

export type StreamProtocol = 'rtsp' | 'srt' | 'rtmp' | 'ndi' | 'hls' | 'webrtc' | 'st2110' | 'other'

export const STREAM_PROTOCOLS: ReadonlyArray<StreamProtocol> = [
  'rtsp',
  'srt',
  'rtmp',
  'ndi',
  'hls',
  'webrtc',
  'st2110',
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
  /** Vorschau am Canvas zeigen. Eine Planangabe: „diese Kachel will ich". */
  showPreview?: boolean
  notes?: string
}
