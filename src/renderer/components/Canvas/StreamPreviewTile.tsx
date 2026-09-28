import { useEffect, useState } from 'react'
import { cablePlannerApi, type StreamSnapshotResult } from '../../lib/bridge'
import { format, useTranslation } from '../../lib/i18n'
import { protokollName, vorschauQuelle, vorschauStream, zugangsSchluessel } from '../../lib/streamEndpoints'
import { useStreamPreviewStore } from '../../store/streamPreviewStore'
import type { StreamEndpoint } from '../../types/stream'

/** So oft wird das Standbild neu geholt, solange der Knoten sichtbar ist. */
export const STREAM_PREVIEW_INTERVAL_MS = 10_000

/**
 * #946 — die Stream-Vorschau am Geraet.
 *
 * Invariante 16: ein Bild auf dem Plan ist die gefaehrlichste Behauptung.
 * Diese Kachel zeigt deshalb NUR ein wirklich abgerufenes Standbild und
 * schreibt Herkunft und Uhrzeit daran. Scheitert der Abruf, steht das da —
 * nie das letzte Bild ohne Hinweis, nie ein Platzhalter, der nach Signal
 * aussieht. Das Bild lebt in dieser Komponente und nie im Projekt
 * (Invariante 14).
 *
 * Unter dem Knoten statt im Kopf: das Port-Raster haengt an der Kopfhoehe,
 * und eine Kachel darin verschoebe jedes Kabelende.
 */
export const StreamPreviewTile = ({ streams, isLight }: { streams: StreamEndpoint[] | undefined; isLight: boolean }) => {
  const t = useTranslation()
  const stream = vorschauStream(streams)
  const quelle = stream ? vorschauQuelle(stream) : null
  const url = quelle?.url
  // Nachtrag #946: abgerufen wird erst nach einer Freigabe in dieser Sitzung,
  // nie schon beim Oeffnen der Datei (`streamPreviewStore`).
  const freigegeben = useStreamPreviewStore((s) => (stream ? s.freigegeben[stream.id] === true : false))
  const freigeben = useStreamPreviewStore((s) => s.freigeben)
  const credentialId = stream && quelle ? zugangsSchluessel(stream.id, quelle.feld) : ''
  const weg = quelle?.weg
  const protocol = stream?.protocol
  // Das Ergebnis traegt seine Adresse: nach einem Wechsel der Adresse zaehlt
  // das alte Bild nicht mehr, auch bevor das neue da ist.
  const [abruf, setAbruf] = useState<{ url: string; r: StreamSnapshotResult } | null>(null)
  const stand = abruf && abruf.url === url ? abruf.r : null

  useEffect(() => {
    if (!url || !freigegeben || !weg || !protocol) return
    let aktiv = true
    const holen = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      const r = await cablePlannerApi.streamPreview.snapshot({ credentialId, weg, protocol, url })
      if (!aktiv || (!r.ok && r.code === 'busy')) return
      setAbruf({ url, r })
      // Antworten, die sich nicht von selbst aendern, werden nicht wiederholt:
      // jede Wiederholung waere Last ohne Nutzen.
      if (!r.ok && ['desktop-only', 'not-local', 'no-ffmpeg', 'unsupported', 'invalid-url'].includes(r.code)) {
        clearInterval(uhr)
      }
    }
    const uhr = setInterval(() => void holen(), STREAM_PREVIEW_INTERVAL_MS)
    void holen()
    return () => {
      aktiv = false
      clearInterval(uhr)
    }
  }, [url, freigegeben, credentialId, weg, protocol])

  if (!stream || !url) return null
  if (!freigegeben) {
    const farbeAus = isLight ? '#0369a1' : '#38bdf8'
    return (
      <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: '100%' }}>
        <button
          type="button"
          className="nodrag"
          onClick={(e) => {
            e.stopPropagation()
            freigeben(stream.id)
          }}
          title={t(
            'canvas.stream.startTitle',
            'Fetches a still image from the device in the local network, every 10 s while visible. Not started automatically when a project is opened.',
          )}
          style={{
            width: '100%',
            fontSize: 10,
            lineHeight: '13px',
            padding: 4,
            border: `1px dashed ${farbeAus}`,
            color: farbeAus,
            background: 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          {format(t('canvas.stream.start', 'Start preview · {name}'), {
            name: [protokollName(stream.protocol), stream.label].filter(Boolean).join(' '),
          })}
        </button>
      </div>
    )
  }
  const farbe = isLight ? '#0369a1' : '#38bdf8'
  const name = [protokollName(stream.protocol), stream.label].filter(Boolean).join(' ')
  const fehler = stand && !stand.ok ? fehlerText(stand.code, stand.status, t) : null

  return (
    <div
      style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: '100%', pointerEvents: 'none' }}
    >
      <div style={{ fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', color: farbe, lineHeight: '12px' }}>
        {stand?.ok
          ? format(t('canvas.stream.still', 'Still image {time} · {name}'), {
              time: new Date(stand.fetchedAt).toLocaleTimeString(),
              name,
            })
          : format(t('canvas.stream.pending', 'Preview · {name}'), { name })}
      </div>
      {stand?.ok ? (
        <img
          src={stand.dataUri}
          alt={format(t('canvas.stream.alt', 'Still image from {url}'), { url })}
          title={format(
            t('canvas.stream.title', 'Still image fetched from {url} at {time}. Not a live video; refreshed every 10 s while visible.'),
            { url, time: new Date(stand.fetchedAt).toLocaleString() },
          )}
          draggable={false}
          style={{ display: 'block', width: '100%', border: `1px solid ${farbe}` }}
        />
      ) : (
        <div
          style={{
            fontSize: 10,
            lineHeight: '13px',
            padding: 4,
            border: `1px dashed ${farbe}`,
            color: fehler ? (isLight ? '#b91c1c' : '#f87171') : farbe,
          }}
        >
          {fehler ?? t('canvas.stream.loading', 'Fetching still image …')}
        </div>
      )}
    </div>
  )
}

function fehlerText(
  code: Extract<StreamSnapshotResult, { ok: false }>['code'],
  status: number | undefined,
  t: (key: string, fallback: string) => string,
): string {
  switch (code) {
    case 'desktop-only':
      return t('canvas.stream.err.desktopOnly', 'No preview: still images are fetched by the desktop app only.')
    case 'invalid-url':
      return t('canvas.stream.err.invalidUrl', 'No preview: the preview address must be an http(s) address of a still image.')
    case 'not-image':
      return t('canvas.stream.err.notImage', 'No preview: the address does not deliver a still image (JPEG, PNG, WebP).')
    case 'too-large':
      return t('canvas.stream.err.tooLarge', 'No preview: the answer is larger than 5 MB or never ends (a video stream instead of a still image?).')
    case 'not-local':
      return t('canvas.stream.err.notLocal', 'No preview: the address is not in the local network.')
    case 'no-ffmpeg':
      return t('canvas.stream.err.noFfmpeg', 'No preview: ffmpeg was not found. Install ffmpeg to see a still from this stream, or enter a still image address.')
    case 'unsupported':
      return t('canvas.stream.err.unsupported', 'No preview for this protocol.')
    case 'http':
      return format(t('canvas.stream.err.http', 'No preview: the device answered with HTTP {status}.'), { status: String(status ?? '') })
    default:
      return t('canvas.stream.err.unreachable', 'No preview: the device cannot be reached.')
  }
}
