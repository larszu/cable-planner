import { format, useTranslation } from '../../lib/i18n'
import { hasDesktopBridge } from '../../lib/bridge'
import { plaketteStream, scopeQuellName } from '../../lib/scopes'
import { useScopeStore } from '../../store/scopeStore'
import { ScopeMonitorSlot } from '../Scopes/ScopesLazy'
import type { StreamEndpoint } from '../../types/stream'

/**
 * larszu/lz-scopes#15 — die Scope-Plakette unter dem Geraet: ein kleines
 * Live-Waveform (~120 × 60) des ersten Stroms mit eingeschaltetem
 * `showScope`. Doppelklick oeffnet das grosse Panel.
 *
 * Wie `StreamPreviewTile`: die Planangabe allein startet nichts. Erst ein
 * Klick in dieser Sitzung gibt den Strom frei (`scopeStore`). Ohne ffmpeg,
 * also im Browser, gibt es die Plakette nicht.
 */
export const ScopeBadge = ({
  streams,
  geraet,
  isLight,
}: {
  streams: StreamEndpoint[] | undefined
  geraet: string
  isLight: boolean
}) => {
  const t = useTranslation()
  const stream = plaketteStream(streams)
  const freigegeben = useScopeStore((s) => (stream ? s.freigegeben[stream.id] === true : false))
  const freigeben = useScopeStore((s) => s.freigeben)
  const oeffne = useScopeStore((s) => s.oeffne)
  if (!stream || !hasDesktopBridge) return null
  const name = scopeQuellName(geraet, stream)
  const farbe = isLight ? '#0369a1' : '#38bdf8'

  if (!freigegeben) {
    return (
      <button
        type="button"
        className="nodrag"
        onClick={(e) => {
          e.stopPropagation()
          freigeben(stream.id)
        }}
        title={t(
          'canvas.scope.startTitle',
          'Opens the stream in the local network and draws a live luma waveform. Runs only while this badge is visible; not started automatically when a project is opened.',
        )}
        style={{
          width: '100%',
          fontSize: 10,
          lineHeight: '13px',
          padding: 4,
          border: `1px dashed ${farbe}`,
          color: farbe,
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {format(t('canvas.scope.start', 'Start waveform · {name}'), { name })}
      </button>
    )
  }

  return (
    <div
      className="nodrag"
      onDoubleClick={(e) => {
        e.stopPropagation()
        oeffne([stream.id])
      }}
      title={t('canvas.scope.title', 'Live luma waveform of this stream. Double-click for the large scopes.')}
      style={{ width: '100%', border: `1px solid ${farbe}`, background: '#0b0c0e' }}
    >
      <ScopeMonitorSlot
        key={`${stream.id}|${stream.url ?? ''}|${stream.protocol}`}
        stream={stream}
        name={name}
        scopes={['wf-luma']}
        selectors={false}
        compact
        style={{ height: 60 }}
      />
    </div>
  )
}
