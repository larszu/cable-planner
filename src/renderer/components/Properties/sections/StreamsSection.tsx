import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { useTranslation } from '../../../lib/i18n'
import { Icon } from '../../shared/Icon'
import { SortableSection } from '../SortableSection'
import { PanelHint } from '../../shared/PanelHint'
import {
  hatteZugang,
  istVorschauUrl,
  protokollAusUrl,
  protokollName,
  streamUrlOhneZugang,
} from '../../../lib/streamEndpoints'
import {
  STREAM_DIRECTIONS,
  STREAM_PROTOCOLS,
  type StreamDirection,
  type StreamEndpoint,
  type StreamProtocol,
} from '../../../types/stream'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * #946 — Streams, die ein Geraet sendet oder empfaengt.
 *
 * Zugangsdaten in einer Adresse werden beim Verlassen des Feldes entfernt
 * und das wird gesagt (`types/stream.ts`): die Projektdatei wandert, das
 * Passwort gehoert in die Zugangsfelder des Geraets.
 */
export const StreamsSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const [gekuerzt, setGekuerzt] = useState<string | null>(null)

  const streams = equipment.streams ?? []
  const commit = (next: StreamEndpoint[]) =>
    updateEquipment(equipment.id, { streams: next.length > 0 ? next : undefined })
  const patch = (id: string, p: Partial<StreamEndpoint>) =>
    commit(streams.map((s) => (s.id === id ? { ...s, ...p } : s)))

  const add = () =>
    commit([
      ...streams,
      { id: `${equipment.id}#stream-${Math.random().toString(36).slice(2, 10)}`, protocol: 'rtsp', direction: 'send' },
    ])

  /** Beim Verlassen: Zugangsdaten raus, Protokoll aus dem Schema, wenn eindeutig. */
  const urlFertig = (s: StreamEndpoint, feld: 'url' | 'previewUrl', raw: string) => {
    const sauber = streamUrlOhneZugang(raw)
    setGekuerzt(hatteZugang(raw) ? s.id : null)
    const p: Partial<StreamEndpoint> = { [feld]: sauber || undefined }
    if (feld === 'url') {
      const erkannt = protokollAusUrl(sauber)
      if (erkannt) p.protocol = erkannt
    }
    patch(s.id, p)
  }

  const richtung = (d: StreamDirection): string =>
    d === 'send'
      ? t('streams.dir.send', 'Sends')
      : d === 'receive'
        ? t('streams.dir.receive', 'Receives')
        : t('streams.dir.both', 'Sends and receives')
  const protokoll = (p: StreamProtocol): string => protokollName(p) || t('streams.protocol.other', 'Other')

  const feld = 'w-full border border-cp-border bg-cp-surface-1 p-1.5'

  return (
    <SortableSection
      id="streams"
      title={t('streams.title', 'Streams')}
      subtitle={t('streams.subtitle', 'RTSP · SRT · NDI · preview')}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-cp-xs text-cp-text-muted">
          {t('streams.hint', 'Streams this device sends or receives. No user name or password in the address — they belong in Network & access.')}
        </span>
        <button
          type="button"
          onClick={add}
          className="flex shrink-0 items-center gap-1 border border-cp-border px-2 py-0.5 text-cp-xs text-cp-text-secondary hover:text-cp-text"
        >
          <Icon icon={Plus} size="xs" /> {t('streams.add', 'Add stream')}
        </button>
      </div>

      {streams.length === 0 ? (
        <p className="text-cp-xs text-cp-text-faint">{t('streams.none', 'No streams.')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {streams.map((s) => (
            <li key={s.id} className="border border-cp-border-muted bg-cp-surface-2 p-2">
              <div className="mb-1 flex items-center gap-2">
                <select
                  value={s.protocol}
                  onChange={(e) => patch(s.id, { protocol: e.target.value as StreamProtocol })}
                  aria-label={t('streams.protocol', 'Protocol')}
                  className="border border-cp-border bg-cp-surface-1 p-1.5"
                >
                  {STREAM_PROTOCOLS.map((p) => (
                    <option key={p} value={p}>{protokoll(p)}</option>
                  ))}
                </select>
                <select
                  value={s.direction}
                  onChange={(e) => patch(s.id, { direction: e.target.value as StreamDirection })}
                  aria-label={t('streams.direction', 'Direction')}
                  className="flex-1 border border-cp-border bg-cp-surface-1 p-1.5"
                >
                  {STREAM_DIRECTIONS.map((d) => (
                    <option key={d} value={d}>{richtung(d)}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => commit(streams.filter((x) => x.id !== s.id))}
                  aria-label={t('streams.remove', 'Remove stream')}
                  className="text-cp-text-faint hover:text-cp-danger"
                >
                  <Icon icon={Trash2} size="sm" />
                </button>
              </div>
              <input
                value={s.label ?? ''}
                onChange={(e) => patch(s.id, { label: e.target.value || undefined })}
                placeholder={t('streams.label', 'Label, e.g. Main, Proxy 720p')}
                aria-label={t('streams.label', 'Label, e.g. Main, Proxy 720p')}
                className={`${feld} mb-1`}
              />
              <input
                defaultValue={s.url ?? ''}
                key={`url-${s.url ?? ''}`}
                onBlur={(e) => urlFertig(s, 'url', e.target.value)}
                placeholder={s.protocol === 'ndi' ? t('streams.ndiName', 'NDI source name') : 'rtsp://192.168.1.20:554/stream1'}
                aria-label={t('streams.url', 'Stream address')}
                className={`${feld} mb-1 font-mono`}
              />
              <input
                defaultValue={s.previewUrl ?? ''}
                key={`prev-${s.previewUrl ?? ''}`}
                onBlur={(e) => urlFertig(s, 'previewUrl', e.target.value)}
                placeholder="http://192.168.1.20/snapshot.jpg"
                aria-label={t('streams.previewUrl', 'Still image address for the preview')}
                className={`${feld} font-mono`}
              />
              <label className="mt-1 flex items-center gap-2 text-cp-xs text-cp-text-secondary">
                <input
                  type="checkbox"
                  checked={!!s.showPreview}
                  disabled={!istVorschauUrl(s.previewUrl)}
                  onChange={(e) => patch(s.id, { showPreview: e.target.checked || undefined })}
                />
                {t('streams.showPreview', 'Show a still image under the device on the canvas')}
              </label>
              {!istVorschauUrl(s.previewUrl) && (
                <PanelHint
                  className="mt-1 text-cp-xs text-cp-text-faint"
                  text={t(
                    'streams.previewHint',
                    'The app cannot play RTSP, SRT or NDI. For a preview, enter the http(s) address of a still image (most cameras and encoders offer one, e.g. /snapshot.jpg).',
                  )}
                />
              )}
              {gekuerzt === s.id && (
                <p className="mt-1 text-cp-xs text-cp-warn">
                  {t('streams.credentialsRemoved', 'User name and password were removed from the address. Enter them under Network & access.')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </SortableSection>
  )
}
