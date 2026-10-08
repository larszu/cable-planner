/**
 * Green-GO live AM GERAET: Sprechen, Hoeren und Pegel der Kanaele 1–6 und der
 * Hauptpegel — so, wie der Multiviewer am ATEM sitzt. Der Weg ist das
 * Geraeteskript osc-remote.gg5t (OSC ueber UDP); ohne es antwortet ein
 * Green-GO-Geraet auf gar nichts, und das steht hier, statt dass die Knoepfe
 * stumm bleiben.
 */
import { useEffect, useState } from 'react'
import { Headphones } from 'lucide-react'
import { Icon } from '../../shared/Icon'
import { PanelHint } from '../../shared/PanelHint'
import { SortableSection } from '../SortableSection'
import { useTranslation, format } from '../../../lib/i18n'
import { detectDeviceKind } from '../../../lib/deviceKind'
import { GREENGO_CHANNELS } from '../../../lib/greengoLive'
import { useGreengoLiveStore } from '../../../store/greengoLiveStore'
import type { EquipmentItem } from '../../../types/equipment'
import { NumberInput } from '../../shared/NumberInput'

const LEVEL_MIN = -40
const LEVEL_MAX = 12

export const GreenGoLiveSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const attach = useGreengoLiveStore((s) => s.attach)
  const connected = useGreengoLiveStore((s) => s.connected)
  const host = useGreengoLiveStore((s) => s.host)
  const state = useGreengoLiveStore((s) => s.state)
  const lastError = useGreengoLiveStore((s) => s.lastError)
  const connect = useGreengoLiveStore((s) => s.connect)
  const disconnect = useGreengoLiveStore((s) => s.disconnect)
  const send = useGreengoLiveStore((s) => s.send)
  const [port, setPort] = useState(8000)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => attach(), [attach])
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2000)
    return () => clearInterval(id)
  }, [])

  if (detectDeviceKind(equipment) !== 'greengo') return null

  const address = equipment.ipAddress?.trim() ?? ''
  const mine = connected && host === address
  // Das Skript schickt alle 3 s einen Herzschlag; zehn Sekunden Stille heisst: kein Skript oder kein Netz.
  const alive = mine && state.lastHeard > 0 && now - state.lastHeard < 10000
  const level = (v: number) => Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, v))

  const summary = alive
    ? t('props.greengoLive.summaryLive', 'live')
    : mine
      ? t('props.greengoLive.summaryWaiting', 'waiting for the device script')
      : t('props.greengoLive.summaryOff', 'not connected')

  return (
    <SortableSection id="greengo-live" title={t('props.greengoLive.title', 'Green-GO live')} subtitle={summary}>
      <div className="flex flex-col gap-2 text-cp-xs">
        <div className="flex flex-wrap items-end gap-2">
          <span className="text-cp-text-muted">
            {address
              ? format(t('props.greengoLive.address', 'device {ip}'), { ip: address })
              : t('props.greengoLive.noAddress', 'no IP address yet — set it in the Network section')}
          </span>
          <label className="flex flex-col gap-0.5">
            <span className="text-cp-text-muted">{t('props.greengoLive.port', 'OSC port')}</span>
            <NumberInput min={1} max={65535} integer className="w-16 border border-cp-border bg-cp-surface-1 px-1 py-0.5" value={port} onChange={setPort} />
          </label>
          {mine ? (
            <button type="button" className="border border-cp-border bg-cp-surface-1 px-2 py-1 hover:bg-cp-surface-3" onClick={() => void disconnect()}>
              {t('props.greengoLive.disconnect', 'Disconnect')}
            </button>
          ) : (
            <button type="button" className="border border-cp-border bg-cp-surface-1 px-2 py-1 hover:bg-cp-surface-3 disabled:opacity-40" disabled={!address} onClick={() => void connect(address, port)}>
              {t('props.greengoLive.connect', 'Connect')}
            </button>
          )}
          <span className={`inline-flex items-center gap-1 ${alive ? 'text-cp-text' : 'text-cp-text-muted'}`}>
            <Icon icon={Headphones} size="xs" /> {summary}
          </span>
        </div>

        {lastError && <div className="border-l-2 border-cp-danger bg-cp-surface-2 px-2 py-1">{lastError}</div>}

        {mine && (
          <>
            <div className="flex flex-col gap-1">
              {GREENGO_CHANNELS.map((ch) => {
                const c = state.channels[ch] ?? {}
                const talking = (c.talk ?? 0) > 0
                const listening = (c.listen ?? 1) > 0
                return (
                  <div key={ch} className="flex flex-wrap items-center gap-2 border border-cp-border-muted px-2 py-1">
                    <span className="w-16 font-semibold">{format(t('props.greengoLive.channel', 'Channel {n}'), { n: ch })}</span>
                    <button
                      type="button"
                      aria-pressed={talking}
                      className={`border border-cp-border px-2 py-0.5 ${talking ? 'bg-cp-accent text-cp-bg' : 'bg-cp-surface-1 hover:bg-cp-surface-3'}`}
                      onClick={() => void send('channel/talk', [talking ? 0 : 2, ch])}
                    >
                      {t('props.greengoLive.talk', 'Talk')}
                    </button>
                    <button
                      type="button"
                      aria-pressed={listening}
                      className={`border border-cp-border px-2 py-0.5 ${listening ? 'bg-cp-surface-3 text-cp-text' : 'bg-cp-surface-1 text-cp-text-muted line-through'}`}
                      onClick={() => void send('channel/listen', [listening ? 0 : 1, ch])}
                    >
                      {t('props.greengoLive.listen', 'Listen')}
                    </button>
                    <button type="button" className="h-6 w-6 border border-cp-border bg-cp-surface-1 hover:bg-cp-surface-3" onClick={() => void send('channel/level', [level((c.level ?? 0) - 3), ch])} aria-label={t('props.greengoLive.down', 'Level down')}>−</button>
                    <span className="w-14 text-center">{c.level === undefined ? '–' : `${c.level} dB`}</span>
                    <button type="button" className="h-6 w-6 border border-cp-border bg-cp-surface-1 hover:bg-cp-surface-3" onClick={() => void send('channel/level', [level((c.level ?? 0) + 3), ch])} aria-label={t('props.greengoLive.up', 'Level up')}>+</button>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{t('props.greengoLive.main', 'Main level')}</span>
              <button type="button" className="h-6 w-6 border border-cp-border bg-cp-surface-1 hover:bg-cp-surface-3" onClick={() => void send('level/main', [level((state.mainLevel ?? 0) - 3)])} aria-label={t('props.greengoLive.down', 'Level down')}>−</button>
              <span className="w-14 text-center">{state.mainLevel === undefined ? '–' : `${state.mainLevel} dB`}</span>
              <button type="button" className="h-6 w-6 border border-cp-border bg-cp-surface-1 hover:bg-cp-surface-3" onClick={() => void send('level/main', [level((state.mainLevel ?? 0) + 3)])} aria-label={t('props.greengoLive.up', 'Level up')}>+</button>
              <button type="button" className="border border-cp-border bg-cp-surface-1 px-2 py-0.5 hover:bg-cp-surface-3" onClick={() => void send('update', [1])}>
                {t('props.greengoLive.refresh', 'Read state')}
              </button>
            </div>
          </>
        )}
        <PanelHint
          text={t(
            'props.greengoLive.hint',
            'Green-GO answers only while the device script osc-remote.gg5t runs on it (Green-GO firmware 5.0.3.0255 or newer; channels 1–6). Load it with the Green-GO software and set the planner computer as the remote address.',
          )}
        />
      </div>
    </SortableSection>
  )
}
