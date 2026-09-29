/**
 * Kamerasteuerung AM GERAET — der Kopf, der im Plan steht, wird von hier aus
 * gefahren. Nicht ein eigenes Werkzeug, sondern ein Abschnitt in den
 * Eigenschaften, wie der Multiviewer am ATEM.
 *
 * Wer faehrt, ist die LZ Camera Bridge (ein Prozess im Regieraum). Dieser
 * Abschnitt sagt ihr, WIE sie den Kopf erreicht (Steuerweg, Adresse — beides
 * Planangaben am Geraet), schickt ihr den Raum als Anlagendatei und zeigt
 * dann, was sie meldet: Verbindung, Pose, Tally, Fortschritt beim Speichern
 * der geplanten Shots. Beobachtungen bleiben im cameraBridgeStore
 * (Invariante 14); ins Projekt schreibt der Abschnitt nur Planangaben:
 * Steuerweg, Port, Familie und die Slot-Nummer, die die Bruecke vergeben hat.
 *
 * Was hier NICHT protokolliert wird: einzelne Joystick-Schritte. Ein
 * Schaltbefehl an die Kreuzschiene ist ein Eingriff in die Sendung, ein
 * Schwenk ist Bedienung; die Zeile im Projekt bekommt das Speichern der
 * Shots im Kopf (kommt mit dem naechsten Schritt), nicht jeder Tastendruck.
 */
import { useEffect, useRef, useState } from 'react'
import { Camera, Radio } from 'lucide-react'
import { Icon } from '../../shared/Icon'
import { SortableSection } from '../SortableSection'
import { PanelHint } from '../../shared/PanelHint'
import { useTranslation, format } from '../../../lib/i18n'
import { useProjectStore } from '../../../store/projectStore'
import { useUiStore } from '../../../store/uiStore'
import { useCameraBridgeStore } from '../../../store/cameraBridgeStore'
import { bridgeVideoUrl, buildSite, isCameraDevice } from '../../../lib/cameraBridgeSite'
import type { EquipmentItem } from '../../../types/equipment'
import type { ControlPath } from '../../../optics/types'

const PATHS: { id: ControlPath; label: string }[] = [
  { id: 'none', label: 'Not remote-controlled' },
  { id: 'visca', label: 'VISCA over IP' },
  { id: 'http-cgi', label: 'HTTP-CGI (Vissonic / PTZOptics, Sony SRG)' },
  { id: 'panasonic-ptz', label: 'Panasonic AW PTZ' },
  { id: 'birddog', label: 'BirdDog' },
  { id: 'jvc', label: 'JVC ConnectedCam' },
  { id: 'canon-ccapi', label: 'Canon CCAPI' },
  { id: 'blackmagic', label: 'Blackmagic REST' },
  { id: 'zcam', label: 'Z CAM' },
  { id: 'lumix-http', label: 'Panasonic Lumix' },
  { id: 'sony-mnc', label: 'Sony Monitor & Control' },
  { id: 'tcp', label: 'Sony CCU (700PTP)' },
  { id: 'visca-serial', label: 'VISCA RS-232 (at the bridge)' },
  { id: 'serial', label: 'Sony RS-422 (at the bridge)' },
  { id: 'sony-usb', label: 'Sony USB (at the bridge)' },
  { id: 'dji-ronin', label: 'DJI Ronin gimbal' },
  { id: 'dji-osmo', label: 'DJI Osmo Pocket gimbal' },
]

const JOG_INTERVAL_MS = 120

export const PtzControlSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const setCameraBridge = useProjectStore((s) => s.setCameraBridge)
  const bridgeAddress = useProjectStore((s) => s.project.cameraBridge)
  const projectName = useProjectStore((s) => s.project.metadata?.name ?? '')
  const equipmentAll = useProjectStore((s) => s.project.equipment)
  const openMultiview = useUiStore((s) => s.openCameraMultiview)

  const status = useCameraBridgeStore((s) => s.status)
  const connect = useCameraBridgeStore((s) => s.connect)
  const disconnect = useCameraBridgeStore((s) => s.disconnect)
  const send = useCameraBridgeStore((s) => s.send)
  const attach = useCameraBridgeStore((s) => s.attach)
  const lastError = useCameraBridgeStore((s) => s.lastError)
  const clearError = useCameraBridgeStore((s) => s.clearError)
  const num = equipment.bridgeCameraNumber ?? 0
  const slot = useCameraBridgeStore((s) => (num ? s.cameras[num] : undefined))
  const tally = useCameraBridgeStore((s) => (num ? s.cameraTally[num] : undefined))
  const pose = useCameraBridgeStore((s) => (num ? s.poses[num] : undefined))
  const progress = useCameraBridgeStore((s) => (num ? s.progress[num] : undefined))

  // Adresse der Bruecke direkt aus dem Projekt: eine Planangabe, kein Zwischenstand.
  const host = bridgeAddress?.host ?? ''
  const port = bridgeAddress?.port ?? 9700
  const [sent, setSent] = useState<{ n: number; skipped: string[] } | null>(null)
  const [showPicture, setShowPicture] = useState(false)
  const [calibrateFor, setCalibrateFor] = useState<number | null>(null)
  const [storeArmed, setStoreArmed] = useState(false)
  const [focal, setFocal] = useState('')

  useEffect(() => attach(), [attach])
  useEffect(() => {
    if (!storeArmed) return
    const id = setTimeout(() => setStoreArmed(false), 5000)
    return () => clearTimeout(id)
  }, [storeArmed])

  // Joystick: senden solange gehalten, Stop beim Loslassen und beim Verlassen.
  const jogTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const jogStop = () => {
    if (jogTimer.current) clearInterval(jogTimer.current)
    jogTimer.current = null
    if (num) void send({ type: 'command', cameraNumber: num, cmd: 'ptz', params: { pan: 0, tilt: 0 } })
  }
  const jogStart = (pan: number, tilt: number) => {
    if (!num) return
    const fire = () => void send({ type: 'command', cameraNumber: num, cmd: 'ptz', params: { pan, tilt } })
    fire()
    if (jogTimer.current) clearInterval(jogTimer.current)
    jogTimer.current = setInterval(fire, JOG_INTERVAL_MS)
  }
  useEffect(() => () => { if (jogTimer.current) clearInterval(jogTimer.current) }, [])
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const holdStart = (cmd: string, value: number) => {
    if (!num) return
    const fire = () => void send({ type: 'command', cameraNumber: num, cmd, params: { value } })
    fire()
    if (holdTimer.current) clearInterval(holdTimer.current)
    holdTimer.current = setInterval(fire, JOG_INTERVAL_MS)
  }
  const holdStop = (cmd: string) => {
    if (holdTimer.current) clearInterval(holdTimer.current)
    holdTimer.current = null
    if (num) void send({ type: 'command', cameraNumber: num, cmd, params: { value: 0 } })
  }

  if (!isCameraDevice(equipment)) return null

  const connected = status === 'connected'
  const camOnline = connected && Boolean(slot?.connected)
  const cmd = (c: string, params: Record<string, unknown> = {}) => {
    if (num) void send({ type: 'command', cameraNumber: num, cmd: c, params })
  }
  const shots = equipment.kameraPresets ?? []
  const offset = slot?.config.poseOffset

  const sendRoom = async () => {
    const build = buildSite(equipmentAll.filter(isCameraDevice), projectName || 'Room')
    const r = await send({ type: 'importSite', site: JSON.stringify(build.site) })
    if (!r.ok) return
    for (const [id, n] of Object.entries(build.assigned)) updateEquipment(id, { bridgeCameraNumber: n })
    setSent({ n: build.site.cameras.length, skipped: build.skipped.map((s) => `${s.name} (${s.reason === 'no-address' ? t('props.cameraControl.noAddress', 'no IP address') : t('props.cameraControl.noPath', 'no control path')})`) })
  }

  const summary = camOnline
    ? format(t('props.cameraControl.summaryOnline', 'bridge slot {n} · online'), { n: num })
    : num
      ? format(t('props.cameraControl.summarySlot', 'bridge slot {n}'), { n: num })
      : t('props.cameraControl.summaryNone', 'not on the bridge yet')

  return (
    <SortableSection id="camera-control" title={t('props.cameraControl.title', 'Camera control (bridge)')} subtitle={summary}>
      <div className="flex flex-col gap-2 text-cp-xs">
        {/* Bruecke des Raums */}
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-cp-text-muted">{t('props.cameraControl.bridgeHost', 'Bridge (room)')}</span>
            <input
              className="w-40 border border-cp-border bg-cp-surface-1 px-1 py-0.5"
              value={host}
              placeholder="192.168.1.20"
              onChange={(e) => setCameraBridge({ host: e.target.value, port })}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-cp-text-muted">{t('props.cameraControl.bridgePort', 'Port')}</span>
            <input className="w-16 border border-cp-border bg-cp-surface-1 px-1 py-0.5" value={port} onChange={(e) => setCameraBridge({ host, port: Number(e.target.value) || 9700 })} />
          </label>
          {connected ? (
            <button type="button" className="border border-cp-border bg-cp-surface-1 px-2 py-1 hover:bg-cp-surface-3" onClick={() => void disconnect()}>
              {t('props.cameraControl.disconnect', 'Disconnect')}
            </button>
          ) : (
            <button
              type="button"
              className="border border-cp-border bg-cp-surface-1 px-2 py-1 hover:bg-cp-surface-3"
              disabled={!host.trim() || status === 'connecting'}
              onClick={() => void connect({ host: host.trim(), port })}
            >
              {status === 'connecting' ? t('props.cameraControl.connecting', 'Connecting…') : t('props.cameraControl.connect', 'Connect')}
            </button>
          )}
          <span className={`inline-flex items-center gap-1 ${connected ? 'text-cp-text' : 'text-cp-text-muted'}`}>
            <Icon icon={Radio} size="xs" /> {connected ? t('props.cameraControl.bridgeOnline', 'bridge connected') : t('props.cameraControl.bridgeOffline', 'bridge not connected')}
          </span>
        </div>

        {/* Steuerweg dieses Geraets */}
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 max-w-full flex-col gap-0.5">
            <span className="text-cp-text-muted">{t('props.cameraControl.path', 'Control path')}</span>
            <select
              className="max-w-full border border-cp-border bg-cp-surface-1 px-1 py-0.5"
              value={equipment.cameraControlPath ?? ''}
              onChange={(e) => updateEquipment(equipment.id, { cameraControlPath: (e.target.value || undefined) as ControlPath | undefined })}
            >
              <option value="">{t('props.cameraControl.pathUnset', '– not declared –')}</option>
              {PATHS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          {equipment.cameraControlPath === 'http-cgi' && (
            <label className="flex flex-col gap-0.5">
              <span className="text-cp-text-muted">{t('props.cameraControl.family', 'Firmware family')}</span>
              <select
                className="border border-cp-border bg-cp-surface-1 px-1 py-0.5"
                value={equipment.cameraControlFamily ?? 'vissonic'}
                onChange={(e) => updateEquipment(equipment.id, { cameraControlFamily: e.target.value as 'vissonic' | 'sony' })}
              >
                <option value="vissonic">Vissonic / PTZOptics</option>
                <option value="sony">Sony SRG / BRC</option>
              </select>
            </label>
          )}
          <label className="flex flex-col gap-0.5">
            <span className="text-cp-text-muted">{t('props.cameraControl.port', 'Control port')}</span>
            <input
              className="w-16 border border-cp-border bg-cp-surface-1 px-1 py-0.5"
              value={equipment.cameraControlPort ?? ''}
              placeholder="auto"
              onChange={(e) => updateEquipment(equipment.id, { cameraControlPort: Number(e.target.value) || undefined })}
            />
          </label>
          <span className="text-cp-text-muted">
            {equipment.ipAddress ? format(t('props.cameraControl.address', 'address {ip} (Network section)'), { ip: equipment.ipAddress }) : t('props.cameraControl.noAddressHint', 'no IP address yet — set it in the Network section')}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="border border-cp-border bg-cp-surface-1 px-2 py-1 hover:bg-cp-surface-3" disabled={!connected} onClick={() => void sendRoom()}>
            {t('props.cameraControl.sendRoom', 'Send room to bridge')}
          </button>
          <button type="button" className="border border-cp-border bg-cp-surface-1 px-2 py-1 hover:bg-cp-surface-3" onClick={() => openMultiview(equipment.id)}>
            {t('app.menu.tools.cameraMultiview', 'Video wall (live pictures)…')}
          </button>
          {sent && (
            <span className="text-cp-text-muted">
              {format(t('props.cameraControl.sentSummary', '{n} camera(s) sent'), { n: sent.n })}
              {sent.skipped.length > 0 ? ` · ${t('props.cameraControl.skipped', 'left behind:')} ${sent.skipped.join(', ')}` : ''}
            </span>
          )}
        </div>
        <PanelHint text={t('props.cameraControl.sendRoomHint', 'Sending replaces the bridge\'s cameras with this plan\'s: address, control path, stream, heading and shots. The bridge connects them itself and keeps them across restarts.')} />

        {lastError && (
          <div className="flex items-center gap-2 border-l-2 border-cp-danger bg-cp-surface-2 px-2 py-1">
            <span>{lastError}</span>
            <button type="button" className="ml-auto underline" onClick={clearError}>{t('props.cameraControl.dismiss', 'dismiss')}</button>
          </div>
        )}

        {num > 0 && connected && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={camOnline ? 'text-cp-text' : 'text-cp-text-muted'}>
                {camOnline ? t('props.cameraControl.camOnline', 'head online') : t('props.cameraControl.camOffline', 'head offline')}
              </span>
              {!camOnline && (
                <button type="button" className="border border-cp-border bg-cp-surface-1 px-2 py-0.5 hover:bg-cp-surface-3" onClick={() => void send({ type: 'connectCamera', cameraNumber: num })}>
                  {t('props.cameraControl.connectCam', 'Connect head')}
                </button>
              )}
              {tally && tally !== 'off' && (
                <span className={`px-1 font-semibold ${tally === 'program' ? 'bg-cp-accent text-cp-bg' : 'border border-cp-border text-cp-text'}`}>
                  {tally === 'program' ? 'PGM' : 'PVW'}
                </span>
              )}
              {pose && (
                <span className="text-cp-text-muted">
                  {format(t('props.cameraControl.pose', 'pan {pan}° · tilt {tilt}°'), { pan: pose.pan, tilt: pose.tilt })}
                  {pose.zoom !== undefined ? ` · zoom ${Math.round(pose.zoom * 100)} %` : ''}
                </span>
              )}
              <button type="button" className="border border-cp-border bg-cp-surface-1 px-2 py-0.5 hover:bg-cp-surface-3" disabled={!camOnline} onClick={() => void send({ type: 'readPose', cameraNumber: num })}>
                {t('props.cameraControl.readPose', 'Read pose')}
              </button>
            </div>

            {/* Livebild — erst auf Klick in dieser Sitzung (wie die Stream-Vorschau am Canvas) */}
            {slot?.config.streamUrl && bridgeAddress && (
              <div className="border border-cp-border-muted">
                {showPicture ? (
                  <img src={bridgeVideoUrl(bridgeAddress, num)} alt="" className="block w-full bg-cp-bg" style={{ aspectRatio: '16 / 9', objectFit: 'contain' }} draggable={false} />
                ) : (
                  <button type="button" className="w-full px-2 py-3 text-cp-text-muted hover:bg-cp-surface-3" onClick={() => setShowPicture(true)}>
                    <Icon icon={Camera} size="xs" className="mr-1 inline" />
                    {t('props.cameraControl.showPicture', 'Show live picture from the bridge')}
                  </button>
                )}
              </div>
            )}

            {/* Joystick */}
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex flex-col gap-1" onPointerLeave={jogStop}>
                {[
                  [['↖', -60, 60], ['↑', 0, 60], ['↗', 60, 60]],
                  [['←', -60, 0], ['⌂', 0, 0], ['→', 60, 0]],
                  [['↙', -60, -60], ['↓', 0, -60], ['↘', 60, -60]],
                ].map((zeile, i) => (
                  <div key={i} className="flex gap-1">
                    {zeile.map(([label, pan, tilt]) => (
                      <button
                        key={String(label)}
                        type="button"
                        className="h-8 w-8 border border-cp-border bg-cp-surface-1 select-none hover:bg-cp-surface-3 disabled:opacity-40"
                        disabled={!camOnline}
                        onPointerDown={(e) => { e.preventDefault(); if (label === '⌂') cmd('home'); else jogStart(pan as number, tilt as number) }}
                        onPointerUp={() => label !== '⌂' && jogStop()}
                        onPointerCancel={jogStop}
                        title={label === '⌂' ? t('props.cameraControl.home', 'Home position') : undefined}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap gap-1">
                  {[['T', 'setZoom', 70], ['W', 'setZoom', -70], ['N', 'setFocus', 60], ['F', 'setFocus', -60]].map(([label, c, v]) => (
                    <button
                      key={String(label)}
                      type="button"
                      className="h-8 w-10 border border-cp-border bg-cp-surface-1 select-none hover:bg-cp-surface-3 disabled:opacity-40"
                      disabled={!camOnline}
                      onPointerDown={(e) => { e.preventDefault(); holdStart(String(c), Number(v)) }}
                      onPointerUp={() => holdStop(String(c))}
                      onPointerLeave={() => holdStop(String(c))}
                      onPointerCancel={() => holdStop(String(c))}
                    >
                      {label}
                    </button>
                  ))}
                  <button type="button" className="h-8 border border-cp-border bg-cp-surface-1 px-2 hover:bg-cp-surface-3 disabled:opacity-40" disabled={!camOnline} onClick={() => cmd('autoFocus')}>AF</button>
                </div>
                <span className="text-cp-text-muted">{t('props.cameraControl.jogHint', 'Hold to move. T/W zoom, N/F focus.')}</span>
              </div>
            </div>

            {/* Zoomkurve dieses Modells, vor Ort gemessen */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{t('props.cameraControl.zoomCurve', 'Zoom curve')}</span>
                <span className="text-cp-text-muted">
                  {slot?.config.zoomTable?.length
                    ? format(t('props.cameraControl.zoomMeasured', '{n} point(s) measured'), { n: slot.config.zoomTable.length })
                    : t('props.cameraControl.zoomEstimated', 'estimated between the ends')}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {[0, 0.25, 0.5, 0.75, 1].map((z) => (
                  <button key={z} type="button" className="border border-cp-border bg-cp-surface-1 px-2 py-0.5 hover:bg-cp-surface-3 disabled:opacity-40" disabled={!camOnline} onClick={() => void send({ type: 'zoomTo', cameraNumber: num, zoom: z })}>
                    {Math.round(z * 100)} %
                  </button>
                ))}
                <input
                  className="w-16 border border-cp-border bg-cp-surface-1 px-1 py-0.5"
                  value={focal}
                  placeholder="mm"
                  inputMode="decimal"
                  aria-label={t('props.cameraControl.focalRead', 'Focal length read off the lens, in mm')}
                  onChange={(e) => setFocal(e.target.value)}
                />
                <button
                  type="button"
                  className="border border-cp-border bg-cp-surface-1 px-2 py-0.5 hover:bg-cp-surface-3 disabled:opacity-40"
                  disabled={!camOnline || !(Number(focal.replace(',', '.')) > 0)}
                  onClick={() => { void send({ type: 'captureZoomPoint', cameraNumber: num, focalMm: Number(focal.replace(',', '.')) }); setFocal('') }}
                >
                  {t('props.cameraControl.recordPoint', 'Record point')}
                </button>
                {slot?.config.zoomTable?.length ? (
                  <button type="button" className="border border-cp-border bg-cp-surface-1 px-2 py-0.5 hover:bg-cp-surface-3" onClick={() => void send({ type: 'clearZoomTable', cameraNumber: num })}>
                    {t('props.cameraControl.clearCurve', 'Clear curve')}
                  </button>
                ) : null}
              </div>
            </div>

            {/* Shots aus dem Plan */}
            {shots.length > 0 && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t('props.cameraControl.shots', 'Planned shots')}</span>
                  <span className="text-cp-text-muted">
                    {offset ? format(t('props.cameraControl.offset', 'offset {pan}° / {tilt}° measured on site'), { pan: offset.pan, tilt: offset.tilt }) : t('props.cameraControl.noOffset', 'not calibrated on site')}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {shots.map((p) => (
                    <div key={p.nummer} className="flex flex-col gap-1 border border-cp-border-muted px-2 py-1">
                      {/* Zwei Zeilen: im schmalen Inspector haette der Name neben drei Knoepfen keinen Platz. */}
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold">{p.nummer}</span>
                        <span className="truncate">{p.name || `Shot ${p.nummer}`}</span>
                        <span className="truncate text-cp-text-muted">{p.panGrad}° / {p.neigungGrad}° · {p.brennweiteMm} mm</span>
                      </div>
                      {progress?.presetNumber === p.nummer && progress.step !== 'done' && (
                        <span className="text-cp-text-muted">{progress.step}{progress.fit === 'linear' ? ' (zoom estimated)' : ''}</span>
                      )}
                      <div className="flex flex-wrap gap-1">
                      <button type="button" className="border border-cp-border bg-cp-surface-1 px-2 py-0.5 hover:bg-cp-surface-3 disabled:opacity-40" disabled={!camOnline} onClick={() => cmd('recallPreset', { value: p.nummer })} title={t('props.cameraControl.recallTitle', 'Recall the preset stored in the head')}>
                        {t('props.cameraControl.recall', 'Recall')}
                      </button>
                      <button type="button" className="border border-cp-border bg-cp-surface-1 px-2 py-0.5 hover:bg-cp-surface-3 disabled:opacity-40" disabled={!camOnline} onClick={() => void send({ type: 'drivePlannedPreset', cameraNumber: num, presetNumber: p.nummer })} title={t('props.cameraControl.driveTitle', 'Drive the head to the planned pose')}>
                        {t('props.cameraControl.drive', 'Drive')}
                      </button>
                      <button
                        type="button"
                        className={`border border-cp-border px-2 py-0.5 hover:bg-cp-surface-3 disabled:opacity-40 ${calibrateFor === p.nummer ? 'bg-cp-warn text-cp-bg' : 'bg-cp-surface-1'}`}
                        disabled={!camOnline}
                        onClick={() => {
                          if (calibrateFor === p.nummer) { void send({ type: 'calibratePose', cameraNumber: num, presetNumber: p.nummer }); setCalibrateFor(null) }
                          else setCalibrateFor(p.nummer)
                        }}
                        title={t('props.cameraControl.hereTitle', 'Steer the head onto this shot by hand, then confirm: the difference to the plan becomes the offset for every shot')}
                      >
                        {calibrateFor === p.nummer ? t('props.cameraControl.hereConfirm', 'Head is here — confirm') : t('props.cameraControl.here', 'Head is here')}
                      </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`border border-cp-border px-2 py-1 hover:bg-cp-surface-3 disabled:opacity-40 ${storeArmed ? 'bg-cp-accent text-cp-bg' : 'bg-cp-surface-1'}`}
                    disabled={!camOnline}
                    onClick={() => { if (storeArmed) { void send({ type: 'storePlannedPresets', cameraNumber: num }); setStoreArmed(false) } else setStoreArmed(true) }}
                  >
                    {storeArmed ? t('props.cameraControl.storeConfirm', 'Store all in head — click again') : t('props.cameraControl.storeAll', 'Store all shots in head')}
                  </button>
                  {offset && (
                    <button type="button" className="border border-cp-border bg-cp-surface-1 px-2 py-1 hover:bg-cp-surface-3" onClick={() => void send({ type: 'setPoseOffset', cameraNumber: num, offset: null })}>
                      {t('props.cameraControl.clearOffset', 'Clear offset')}
                    </button>
                  )}
                </div>
                <PanelHint text={t('props.cameraControl.shotsHint', 'Drive uses the planned pose; Recall uses what the head has stored. Store all drives every shot and writes it into the head\'s preset memory, so any panel or Companion recalls it by number.')} />
              </div>
            )}
          </>
        )}
      </div>
    </SortableSection>
  )
}
