import { useEffect, useMemo, useRef, useState } from 'react'
import { hasDesktopBridge } from '../../lib/bridge'
import { format, useTranslation } from '../../lib/i18n'
import { oeffneScopeFeed, type ScopeStreamInfo } from '../../lib/scopeFeed'
import { liveFehlerText, liveGrundText, liveWeg, WHEP_CONTENT_TYPE, type LiveZustand } from '../../lib/streamLive'
import type { StreamEndpoint } from '../../types/stream'

/**
 * #959 — das Live-Bild eines Streams, im Eigenschaften-Panel und in der
 * Kachel am Canvas. Laeuft nur, solange die Komponente steht: wer sie
 * schliesst, beendet den Strom (ffmpeg bzw. die WebRTC-Verbindung).
 *
 * Wie die Vorschau zeigt sie nur, was wirklich ankommt, und schreibt die
 * Erreichbarkeit dazu: verbindet, live (mit Groesse und Bildrate) oder
 * warum nicht. Das Bild lebt nie im Projekt (Invariante 14).
 */
export const StreamLiveView = ({ stream, compact = false }: { stream: StreamEndpoint; compact?: boolean }) => {
  const t = useTranslation()
  const umgebung = useMemo(
    () => ({
      desktop: hasDesktopBridge,
      seitenProtokoll: typeof location !== 'undefined' ? location.protocol : undefined,
      nativesHls:
        typeof document !== 'undefined' && document.createElement('video').canPlayType('application/vnd.apple.mpegurl') !== '',
    }),
    [],
  )
  const weg = liveWeg(stream, umgebung)
  const [zustand, setZustand] = useState<LiveZustand>({ phase: 'verbindet' })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const schluessel = weg.ok ? `${weg.weg}|${weg.url}` : ''

  useEffect(() => {
    // Ein Wechsel der Adresse baut die Komponente neu (`key` beim Aufrufer),
    // der Zustand beginnt dann wieder bei „verbindet“.
    if (!weg.ok) return
    if (weg.weg === 'ffmpeg') {
      let info: ScopeStreamInfo | null = null
      let bild: ImageData | null = null
      let schliessen: (() => void) | null = null
      let aus = false
      void oeffneScopeFeed(
        stream,
        {
          pushInfo: (i) => {
            info = i
            bild = null
            const c = canvasRef.current
            if (c) {
              c.width = i.width
              c.height = i.height
            }
          },
          pushFrame: (buf) => {
            const c = canvasRef.current
            if (!c || !info) return
            const px = new Uint8ClampedArray(buf)
            if (px.length !== info.width * info.height * 4) return
            if (!bild) bild = new ImageData(info.width, info.height)
            bild.data.set(px)
            c.getContext('2d')?.putImageData(bild, 0, 0)
          },
        },
        (z) => {
          if (z.phase === 'live') setZustand({ phase: 'live', breite: z.info.sourceWidth, hoehe: z.info.sourceHeight, fps: z.info.fps })
          else if (z.phase === 'fehler') setZustand({ phase: 'fehler', code: z.code })
          else setZustand({ phase: 'verbindet' })
        },
        { depth: 8, width: compact ? 320 : 640 },
      ).then((fn) => {
        if (aus) fn()
        else schliessen = fn
      })
      return () => {
        aus = true
        schliessen?.()
      }
    }
    if (weg.weg === 'hls') {
      const v = videoRef.current
      if (!v) return
      v.src = weg.url
      void v.play().catch(() => undefined)
      return () => {
        v.removeAttribute('src')
        v.load()
      }
    }
    if (weg.weg === 'whep') {
      const pc = new RTCPeerConnection()
      let aus = false
      pc.addTransceiver('video', { direction: 'recvonly' })
      pc.addTransceiver('audio', { direction: 'recvonly' })
      pc.ontrack = (e) => {
        const v = videoRef.current
        if (v && e.streams[0]) v.srcObject = e.streams[0]
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') setZustand({ phase: 'fehler', code: 'unreachable' })
      }
      void (async () => {
        try {
          await pc.setLocalDescription(await pc.createOffer())
          const r = await fetch(weg.url, { method: 'POST', headers: { 'Content-Type': WHEP_CONTENT_TYPE }, body: pc.localDescription?.sdp ?? '' })
          if (!r.ok) throw new Error(String(r.status))
          const sdp = await r.text()
          if (!aus) await pc.setRemoteDescription({ type: 'answer', sdp })
        } catch {
          if (!aus) setZustand({ phase: 'fehler', code: 'unreachable' })
        }
      })()
      return () => {
        aus = true
        pc.close()
      }
    }
    return undefined
    // `schluessel` fasst Weg und Adresse zusammen; der Strom selbst kommt
    // ueber `stream` und wechselt mit ihm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel, stream.id, compact])

  if (!weg.ok) {
    return <p className="text-cp-xs text-cp-text-muted">{liveGrundText(weg.grund, t)}</p>
  }

  const status =
    zustand.phase === 'live'
      ? zustand.breite && zustand.hoehe
        ? format(t('streams.live.onAir', 'Live · {w}×{h} · {fps} fps'), {
            w: String(zustand.breite),
            h: String(zustand.hoehe),
            fps: zustand.fps ? String(Math.round(zustand.fps * 100) / 100) : '–',
          })
        : t('streams.live.onAirPlain', 'Live')
      : zustand.phase === 'verbindet'
        ? t('streams.live.connecting', 'Connecting …')
        : liveFehlerText(zustand.code, t)
  const farbe =
    zustand.phase === 'live' ? 'text-cp-ok' : zustand.phase === 'fehler' ? 'text-cp-danger' : 'text-cp-text-muted'
  const flaeche = 'block w-full bg-black'

  return (
    <div className="flex flex-col gap-1" data-testid="stream-live">
      {weg.weg === 'ffmpeg' && <canvas ref={canvasRef} className={flaeche} style={{ aspectRatio: '16 / 9' }} />}
      {(weg.weg === 'hls' || weg.weg === 'whep') && (
        <video
          ref={videoRef}
          className={flaeche}
          muted
          playsInline
          autoPlay
          controls={!compact}
          onPlaying={(e) =>
            setZustand({ phase: 'live', breite: e.currentTarget.videoWidth || undefined, hoehe: e.currentTarget.videoHeight || undefined })
          }
          onError={() => setZustand({ phase: 'fehler', code: 'unreachable' })}
        />
      )}
      {weg.weg === 'mjpeg' && (
        <img
          src={weg.url}
          alt={format(t('streams.live.alt', 'Live image from {url}'), { url: weg.url })}
          className={flaeche}
          draggable={false}
          onLoad={(e) =>
            setZustand({ phase: 'live', breite: e.currentTarget.naturalWidth || undefined, hoehe: e.currentTarget.naturalHeight || undefined })
          }
          onError={() => setZustand({ phase: 'fehler', code: 'unreachable' })}
        />
      )}
      <span className={`text-cp-xs ${farbe}`} role="status">
        {status}
      </span>
    </div>
  )
}
