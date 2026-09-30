import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { SCOPE_LABELS, ScopeView, Source, type ScopeType } from '../../vendor/lz-scopes/src'
import { oeffneScopeFeed, scopeZustandText, type ScopeFeedZustand } from '../../lib/scopeFeed'
import { format, useTranslation } from '../../lib/i18n'
import type { StreamEndpoint } from '../../types/stream'

/**
 * larszu/lz-scopes#15 — die Scopes eines Stroms: `ScopeView` aus lz-scopes
 * (vendort, `vendor/lz-scopes/VENDOR.md`) an einem `Source`, der seine Bilder
 * ueber `lib/scopeFeed.ts` aus dem Main-Prozess bekommt.
 *
 * LIEGT IM EIGENEN CHUNK. lz-scopes bringt WebGL, Farbwissenschaft und
 * Audio-DSP mit (rund 6000 Zeilen); geladen wird das erst, wenn jemand ein
 * Scope oeffnet (`ScopesLazy.tsx`), nicht mit dem Plan.
 *
 * DIE BESCHRIFTUNG KOMMT VON HIER. Upstream ist deutsch beschriftet und bleibt
 * Byte fuer Byte gleich; die sichtbaren Woerter werden zur Laufzeit ersetzt —
 * wie in lz-camera-bridge `ScopePanel.tsx`.
 *
 * DER STROM LEBT SO LANGE WIE DIESE KOMPONENTE. Abbauen schliesst den Port,
 * und der letzte geschlossene Port beendet ffmpeg im Main-Prozess. Der Aufrufer
 * gibt einen `key` aus Id, Adresse und Protokoll, damit eine geaenderte Adresse
 * einen neuen Strom oeffnet statt den alten weiterzuzeigen.
 */
export default function ScopeMonitor({
  stream,
  name,
  scopes,
  selectors = true,
  compact = false,
  className,
  style,
}: {
  stream: StreamEndpoint
  /** Quellname im Panel (Geraet und Stream). */
  name: string
  scopes: ScopeType[]
  /** Scope-Wahl im Kopf jedes Panels. */
  selectors?: boolean
  /** Plakette am Canvas: nur die Statuszeile ohne Bildrate. */
  compact?: boolean
  className?: string
  style?: CSSProperties
}) {
  const t = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const [zustand, setZustand] = useState<ScopeFeedZustand>({ phase: 'start' })
  const [ohneWebgl, setOhneWebgl] = useState(false)
  const [fps, setFps] = useState(0)
  // Anfangswerte: die Scope-Wahl lebt danach in den Panel-Kopfzeilen, und ein
  // neues Array vom Aufrufer darf den Strom nicht abreissen.
  const anfang = useRef({ stream, name, scopes, selectors, t })

  useEffect(() => {
    const el = host.current
    if (!el) return
    const a = anfang.current
    Object.assign(SCOPE_LABELS, scopeLabels(a.t))
    let view: ScopeView
    try {
      view = new ScopeView(el, { scopes: a.scopes, selectors: a.selectors, emptyText: a.t('scopes.noSignal', 'No signal') })
    } catch {
      el.replaceChildren()
      // eslint-disable-next-line react-hooks/set-state-in-effect -- WebGL2 zeigt sich erst beim Anlegen des Kontexts; vorher gibt es nichts zu fragen
      setOhneWebgl(true)
      return
    }
    const src = new Source('stream', a.name)
    view.setSource(src)
    let schliessen: (() => void) | null = null
    let weg = false
    void oeffneScopeFeed(a.stream, src, setZustand).then((f) => {
      if (weg) f()
      else schliessen = f
    })
    const uhr = setInterval(() => setFps(src.fps), 1000)
    return () => {
      weg = true
      clearInterval(uhr)
      schliessen?.()
      src.stop()
      view.destroy()
    }
  }, [])

  const meldung = ohneWebgl
    ? t('scopes.err.webgl', 'This window cannot draw scopes: WebGL2 with float render targets is required.')
    : scopeZustandText(zustand, t)

  return (
    <div className={`relative flex min-h-0 flex-col ${className ?? ''}`} style={style}>
      <div ref={host} className="relative min-h-0 flex-1" />
      {(meldung || !compact) && (
        <div
          className={`text-cp-xs ${zustand.phase === 'fehler' || ohneWebgl ? 'text-cp-danger' : 'text-cp-text-muted'}`}
          role="status"
        >
          {meldung ??
            format(t('scopes.live', '{w}×{h} {codec} · {fps} fps'), {
              w: zustand.phase === 'live' ? String(zustand.info.sourceWidth) : '',
              h: zustand.phase === 'live' ? String(zustand.info.sourceHeight) : '',
              codec: zustand.phase === 'live' ? (zustand.info.codec ?? '') : '',
              fps: String(fps),
            })}
        </div>
      )}
    </div>
  )
}

const scopeLabels = (t: (k: string, f: string) => string): Partial<Record<ScopeType, string>> => ({
  picture: t('scopes.type.picture', 'Picture'),
  'wf-luma': t('scopes.type.wfLuma', 'Waveform luma'),
  'wf-color': t('scopes.type.wfColor', 'Waveform colour'),
  'wf-skin': t('scopes.type.wfSkin', 'Waveform skin tones'),
  'wf-rgb': t('scopes.type.wfRgb', 'Waveform RGB'),
  parade: t('scopes.type.parade', 'RGB parade'),
  yrgb: t('scopes.type.yrgb', 'YRGB parade'),
  ycbcr: t('scopes.type.ycbcr', 'YCbCr parade'),
  vector: t('scopes.type.vector', 'Vectorscope'),
  cie: t('scopes.type.cie', 'CIE diagram'),
  hist: t('scopes.type.hist', 'Histogram'),
  stats: t('scopes.type.stats', 'Readouts'),
})
