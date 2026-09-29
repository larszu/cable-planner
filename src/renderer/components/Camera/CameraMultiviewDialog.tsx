/**
 * Die Videowand des Raums: alle Livebilder, die die Bruecke liefert, mit dem
 * Tally des Mischers am oberen Rand. Ein `<img>` je Kamera auf dem
 * MJPEG-Weg der Bruecke — kein Player, keine Adresse im Renderer: die Bruecke
 * kennt die Streams (RTSP, SRT, RTMP), der Planner kennt nur die Nummern.
 * Geoeffnet aus einer Kamera heraus (Werkzeug am Geraet), nicht aus einem Menue.
 */
import { useEffect, useMemo, useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { useTranslation } from '../../lib/i18n'
import { useProjectStore } from '../../store/projectStore'
import { useCameraBridgeStore } from '../../store/cameraBridgeStore'
import { bridgeVideoUrl, isCameraDevice } from '../../lib/cameraBridgeSite'

export const CameraMultiviewDialog = ({ onClose }: { onClose: () => void }) => {
  const t = useTranslation()
  const bridge = useProjectStore((s) => s.project.cameraBridge)
  const equipment = useProjectStore((s) => s.project.equipment)
  const status = useCameraBridgeStore((s) => s.status)
  const slots = useCameraBridgeStore((s) => s.cameras)
  const tally = useCameraBridgeStore((s) => s.cameraTally)
  const attach = useCameraBridgeStore((s) => s.attach)
  const connect = useCameraBridgeStore((s) => s.connect)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => attach(), [attach])
  useEffect(() => {
    if (status !== 'connected' && bridge?.host) void connect(bridge)
  }, [status, bridge, connect])

  const tiles = useMemo(() => {
    const cams = equipment.filter((d) => isCameraDevice(d) && (d.bridgeCameraNumber ?? 0) > 0)
    return cams
      .map((d) => ({ device: d, num: d.bridgeCameraNumber as number, slot: slots[d.bridgeCameraNumber as number] }))
      .sort((a, b) => a.num - b.num)
  }, [equipment, slots])
  const cols = tiles.length <= 1 ? 1 : tiles.length <= 4 ? 2 : tiles.length <= 9 ? 3 : 4

  return (
    <ModalShell
      open
      onClose={onClose}
      title={t('camera.multiview.title', 'Video wall')}
      titleIcon={<Icon icon={LayoutGrid} size="sm" />}
      maxWidth="6xl"
    >
        <div className="mb-3 flex items-center justify-end gap-2 text-cp-xs">
          <span className={status === 'connected' ? 'text-cp-text' : 'text-cp-text-muted'}>
            {bridge ? `${bridge.host}:${bridge.port}` : t('camera.multiview.noBridge', 'no bridge address in this project')} · {status}
          </span>
          <button type="button" className="border border-cp-border bg-cp-surface-1 px-2 py-1 hover:bg-cp-surface-3" onClick={() => setAttempt((a) => a + 1)}>
            {t('camera.multiview.reload', 'Reload pictures')}
          </button>
        </div>
        {tiles.length === 0 ? (
          <p className="text-cp-sm text-cp-text-muted">
            {t('camera.multiview.empty', 'No camera of this plan is on the bridge yet. Open a camera, set its control path and stream, and send the room to the bridge.')}
          </p>
        ) : (
          <div className="grid gap-2 overflow-auto" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {tiles.map(({ device, num, slot }) => {
              const tl = tally[num] ?? 'off'
              const edge = tl === 'program' ? 'border-t-cp-signal' : tl === 'preview' ? 'border-t-cp-accent' : 'border-t-cp-border'
              return (
                <div key={device.id} className={`relative border-t-4 bg-cp-bg ${edge}`} style={{ aspectRatio: '16 / 9' }}>
                  {bridge && slot?.config.streamUrl ? (
                    <img src={`${bridgeVideoUrl(bridge, num)}?a=${attempt}`} alt="" className="block h-full w-full" style={{ objectFit: 'contain' }} draggable={false} />
                  ) : (
                    <div className="flex h-full items-center justify-center p-3 text-center text-cp-xs text-cp-text-muted">
                      {slot ? t('camera.multiview.noStream', 'no stream address') : t('camera.multiview.notOnBridge', 'not on the bridge')}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-cp-bg/90 px-2 py-1 text-cp-xs">
                    <span className="font-semibold">CAM {num}</span>
                    <span className="flex-1 truncate">{device.name}</span>
                    {tl !== 'off' && <span className={`px-1 font-semibold ${tl === 'program' ? 'bg-cp-accent text-cp-bg' : 'border border-cp-border'}`}>{tl === 'program' ? 'PGM' : 'PVW'}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
    </ModalShell>
  )
}
