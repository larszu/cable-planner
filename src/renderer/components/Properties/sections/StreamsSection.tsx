import { useEffect, useState } from 'react'
import { KeyRound, Plus, Trash2 } from 'lucide-react'
import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { useTranslation } from '../../../lib/i18n'
import { cablePlannerApi } from '../../../lib/bridge'
import { useStreamPreviewStore } from '../../../store/streamPreviewStore'
import { Icon } from '../../shared/Icon'
import { SortableSection } from '../SortableSection'
import { PanelHint } from '../../shared/PanelHint'
import {
  protokollAusUrl,
  protokollName,
  trenneZugang,
  vorschauQuelle,
  zugangsSchluessel,
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
 * und das wird gesagt (`types/stream.ts`): die Projektdatei wandert. Die
 * Desktop-App legt sie im Schluesselbund dieses Rechners ab (Nachtrag #946),
 * damit die Vorschau eine geschuetzte Kamera trotzdem erreicht.
 */
export const StreamsSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const [gekuerzt, setGekuerzt] = useState<{ id: string; gespeichert: boolean } | null>(null)
  const [hinterlegt, setHinterlegt] = useState<Record<string, boolean>>({})
  const freigeben = useStreamPreviewStore((s) => s.freigeben)
  const sperren = useStreamPreviewStore((s) => s.sperren)

  const streams = equipment.streams ?? []
  const ids = streams.map((s) => s.id).join('|')

  // Ob Zugangsdaten hinterlegt sind, fragt die Oberflaeche den Schluesselbund
  // DIESES Rechners — die Datei sagt darueber nichts.
  useEffect(() => {
    let aus = false
    const liste = ids ? ids.split('|') : []
    void Promise.all(
      liste.flatMap((id) =>
        (['url', 'previewUrl'] as const).map(async (feld) => {
          const k = zugangsSchluessel(id, feld)
          return [k, await cablePlannerApi.streamCredential.has(k).catch(() => false)] as const
        }),
      ),
    ).then((paare) => {
      if (!aus) setHinterlegt(Object.fromEntries(paare))
    })
    return () => {
      aus = true
    }
  }, [ids])
  const commit = (next: StreamEndpoint[]) =>
    updateEquipment(equipment.id, { streams: next.length > 0 ? next : undefined })
  const patch = (id: string, p: Partial<StreamEndpoint>) =>
    commit(streams.map((s) => (s.id === id ? { ...s, ...p } : s)))

  const add = () =>
    commit([
      ...streams,
      { id: `${equipment.id}#stream-${Math.random().toString(36).slice(2, 10)}`, protocol: 'rtsp', direction: 'send' },
    ])

  /** Beim Verlassen: Zugangsdaten raus (in den Schluesselbund), Protokoll aus dem Schema, wenn eindeutig. */
  const urlFertig = async (s: StreamEndpoint, feld: 'url' | 'previewUrl', raw: string) => {
    const { url: sauber, zugang } = trenneZugang(raw)
    const p: Partial<StreamEndpoint> = { [feld]: sauber || undefined }
    if (feld === 'url') {
      const erkannt = protokollAusUrl(sauber)
      if (erkannt) p.protocol = erkannt
    }
    patch(s.id, p)
    if (!zugang) {
      setGekuerzt(null)
      return
    }
    const k = zugangsSchluessel(s.id, feld)
    const gespeichert = await cablePlannerApi.streamCredential.save(k, JSON.stringify(zugang)).catch(() => false)
    setHinterlegt((h) => ({ ...h, [k]: gespeichert }))
    setGekuerzt({ id: s.id, gespeichert })
  }

  const zugangLoeschen = (id: string) => {
    for (const feld of ['url', 'previewUrl'] as const) {
      void cablePlannerApi.streamCredential.delete(zugangsSchluessel(id, feld)).catch(() => undefined)
    }
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
          {t('streams.hint', 'Streams this device sends or receives. User name, password or passphrase in an address are taken out and kept in this computer\'s keychain, never in the plan.')}
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
                  onClick={() => {
                    zugangLoeschen(s.id)
                    sperren(s.id)
                    commit(streams.filter((x) => x.id !== s.id))
                  }}
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
                onBlur={(e) => void urlFertig(s, 'url', e.target.value)}
                placeholder={s.protocol === 'ndi' ? t('streams.ndiName', 'NDI source name') : 'rtsp://192.168.1.20:554/stream1'}
                aria-label={t('streams.url', 'Stream address')}
                className={`${feld} mb-1 font-mono`}
              />
              <input
                defaultValue={s.previewUrl ?? ''}
                key={`prev-${s.previewUrl ?? ''}`}
                onBlur={(e) => void urlFertig(s, 'previewUrl', e.target.value)}
                placeholder="http://192.168.1.20/snapshot.jpg"
                aria-label={t('streams.previewUrl', 'Still image address for the preview')}
                className={`${feld} mb-1 font-mono`}
              />
              {/* Nachtrag #946 — Port, Codec, Format. */}
              <div className="mb-1 grid grid-cols-1 gap-1 sm:grid-cols-3">
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={s.port ?? ''}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    patch(s.id, { port: e.target.value === '' || !Number.isInteger(v) || v < 1 || v > 65535 ? undefined : v })
                  }}
                  placeholder={t('streams.port', 'Port')}
                  aria-label={t('streams.port', 'Port')}
                  className={feld}
                />
                <input
                  value={s.codec ?? ''}
                  onChange={(e) => patch(s.id, { codec: e.target.value || undefined })}
                  placeholder={t('streams.codec', 'Codec')}
                  aria-label={t('streams.codec', 'Codec')}
                  className={feld}
                />
                <input
                  value={s.format ?? ''}
                  onChange={(e) => patch(s.id, { format: e.target.value || undefined })}
                  placeholder={t('streams.format', 'Format, e.g. 1080p50')}
                  aria-label={t('streams.format', 'Format, e.g. 1080p50')}
                  className={feld}
                />
              </div>
              {(hinterlegt[zugangsSchluessel(s.id, 'url')] || hinterlegt[zugangsSchluessel(s.id, 'previewUrl')]) && (
                <p className="mb-1 flex items-center gap-1 text-cp-xs text-cp-text-muted">
                  <Icon icon={KeyRound} size="xs" /> {t('streams.hasCredentials', 'Credentials in this computer\'s keychain')}
                  <button
                    type="button"
                    onClick={() => {
                      zugangLoeschen(s.id)
                      setHinterlegt((h) => ({
                        ...h,
                        [zugangsSchluessel(s.id, 'url')]: false,
                        [zugangsSchluessel(s.id, 'previewUrl')]: false,
                      }))
                    }}
                    className="underline hover:text-cp-danger"
                  >
                    {t('streams.removeCredentials', 'remove')}
                  </button>
                </p>
              )}
              <label className="mt-1 flex items-center gap-2 text-cp-xs text-cp-text-secondary">
                <input
                  type="checkbox"
                  checked={!!s.showPreview}
                  disabled={!vorschauQuelle(s)}
                  onChange={(e) => {
                    // Das Einschalten HIER ist die Freigabe fuer diese Sitzung;
                    // beim Oeffnen der Datei startet nichts (`streamPreviewStore`).
                    if (e.target.checked) freigeben(s.id)
                    else sperren(s.id)
                    patch(s.id, { showPreview: e.target.checked || undefined })
                  }}
                />
                {t('streams.showPreview', 'Show a still image under the device on the canvas')}
              </label>
              {!vorschauQuelle(s) && (
                <PanelHint
                  className="mt-1 text-cp-xs text-cp-text-faint"
                  text={t(
                    'streams.previewHint',
                    'No preview for this entry yet. The desktop app takes a still from RTSP, RTMP, SRT, HLS or MJPEG streams the device sends (needs ffmpeg), or from the http(s) address of a still image. NDI, Dante, AES67, ST 2110, WebRTC and RTP get no preview.',
                  )}
                />
              )}
              {gekuerzt?.id === s.id && (
                <p className="mt-1 text-cp-xs text-cp-warn">
                  {gekuerzt.gespeichert
                    ? t('streams.credentialsStored', 'Credentials were taken out of the address and stored in this computer\'s keychain.')
                    : t('streams.credentialsRemoved', 'Credentials were taken out of the address. This edition cannot store them — they were discarded.')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </SortableSection>
  )
}
