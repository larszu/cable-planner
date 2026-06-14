import { useMemo, useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useTranslation } from '../../lib/i18n'
import { ModalShell } from '../shared/ModalShell'

/**
 * #480 + #481 — Projektion & Display-Rechner. Drei Werkzeuge in einem Dialog:
 *
 *  1. Throw-Distance (#480): Projektionsabstand aus Throw-Ratio × Bildbreite
 *     (oder umgekehrt die mögliche Bildbreite aus einem festen Abstand).
 *  2. Bildgröße & Sitzabstand (#481): Diagonale + Seitenverhältnis → B×H,
 *     Fläche und empfohlene Sitzabstände (THX 36° / SMPTE 30°).
 *  3. LED-Wall: Pixel-Pitch + physische Größe → Auflösung in Pixeln.
 *
 * Reine Geometrie, keine Projekt-Daten nötig — daher self-contained.
 */

interface Aspect {
  id: string
  label: string
  a: number
  b: number
}
const ASPECTS: Aspect[] = [
  { id: '16:9', label: '16:9 (HD/UHD)', a: 16, b: 9 },
  { id: '16:10', label: '16:10 (WUXGA)', a: 16, b: 10 },
  { id: '4:3', label: '4:3 (XGA)', a: 4, b: 3 },
  { id: '21:9', label: '21:9 (UltraWide)', a: 64, b: 27 },
  { id: '2.39:1', label: '2.39:1 (CinemaScope)', a: 2.39, b: 1 },
  { id: '1:1', label: '1:1 (Quadrat)', a: 1, b: 1 },
]
const INCH_TO_M = 0.0254
const aspectById = (id: string) => ASPECTS.find((x) => x.id === id) ?? ASPECTS[0]
/** Bildbreite aus Diagonale (gleiche Einheit) + Seitenverhältnis. */
const widthFromDiagonal = (diag: number, a: number, b: number) =>
  (diag * a) / Math.hypot(a, b)
const heightFromDiagonal = (diag: number, a: number, b: number) =>
  (diag * b) / Math.hypot(a, b)

const NumField = ({
  label,
  value,
  onChange,
  step = 0.1,
  min = 0,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  suffix?: string
}) => (
  <label className="block">
    <span className="mb-1 block text-cp-xs text-cp-text-muted">{label}</span>
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-base"
      />
      {suffix && <span className="text-cp-xs text-cp-text-faint">{suffix}</span>}
    </div>
  </label>
)

const Result = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between rounded border border-cp-border-muted bg-cp-surface-1/50 px-3 py-1.5">
    <span className="text-cp-xs text-cp-text-muted">{label}</span>
    <span className="font-mono text-cp-base text-sky-300">{value}</span>
  </div>
)

type Tab = 'throw' | 'screen' | 'led'

const ProjectionCalcCore = () => {
  const t = useTranslation()
  const [tab, setTab] = useState<Tab>('throw')

  // --- Throw distance -----------------------------------------------------
  const [throwRatio, setThrowRatio] = useState(1.5)
  const [imageWidth, setImageWidth] = useState(4) // m
  const [roomDepth, setRoomDepth] = useState(8) // m
  const throwDistance = throwRatio * imageWidth
  const maxWidthForRoom = roomDepth / throwRatio

  // --- Screen size --------------------------------------------------------
  const [diagonalIn, setDiagonalIn] = useState(120)
  const [aspectId, setAspectId] = useState('16:9')
  const screen = useMemo(() => {
    const asp = aspectById(aspectId)
    const diagM = diagonalIn * INCH_TO_M
    const w = widthFromDiagonal(diagM, asp.a, asp.b)
    const h = heightFromDiagonal(diagM, asp.a, asp.b)
    return {
      w,
      h,
      area: w * h,
      // Sitzabstand: dist = (Breite/2) / tan(FOV/2)
      thx: w / 2 / Math.tan((36 * Math.PI) / 180 / 2), // 36° horizontal
      smpte: w / 2 / Math.tan((30 * Math.PI) / 180 / 2), // 30° horizontal
    }
  }, [diagonalIn, aspectId])

  // --- LED wall -----------------------------------------------------------
  const [pitch, setPitch] = useState(2.6) // mm
  const [ledW, setLedW] = useState(6) // m
  const [ledH, setLedH] = useState(3) // m
  const led = useMemo(() => {
    const pxW = pitch > 0 ? Math.round((ledW * 1000) / pitch) : 0
    const pxH = pitch > 0 ? Math.round((ledH * 1000) / pitch) : 0
    return { pxW, pxH, total: pxW * pxH, mp: (pxW * pxH) / 1_000_000 }
  }, [pitch, ledW, ledH])

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex-1 rounded px-2 py-1 text-cp-xs ${
        tab === id ? 'bg-sky-700 text-white' : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-3 text-cp-text-bright">
      <div className="flex gap-1">
        {tabBtn('throw', t('calc.projection.tab.throw', 'Projektionsabstand'))}
        {tabBtn('screen', t('calc.projection.tab.screen', 'Bildgröße & Sitzabstand'))}
        {tabBtn('led', t('calc.projection.tab.led', 'LED-Wall'))}
      </div>

      {tab === 'throw' && (
        <div className="space-y-3">
          <p className="text-cp-xs text-cp-text-muted">
            {t(
              'calc.projection.throw.intro',
              'Projektionsabstand = Throw-Ratio × Bildbreite. Die Throw-Ratio steht im Datenblatt des Objektivs (z. B. 1.2–1.8).',
            )}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField label={t('calc.projection.throwRatio', 'Throw-Ratio')} value={throwRatio} onChange={setThrowRatio} step={0.05} />
            <NumField label={t('calc.projection.imageWidth', 'Bildbreite')} value={imageWidth} onChange={setImageWidth} suffix="m" />
          </div>
          <Result label={t('calc.projection.throwDistance', 'Projektionsabstand (Objektiv → Bild)')} value={`${throwDistance.toFixed(2)} m`} />
          <div className="grid grid-cols-2 gap-3 pt-1">
            <NumField label={t('calc.projection.roomDepth', 'Verfügbare Tiefe')} value={roomDepth} onChange={setRoomDepth} suffix="m" />
            <Result label={t('calc.projection.maxWidth', 'Max. Bildbreite im Raum')} value={`${maxWidthForRoom.toFixed(2)} m`} />
          </div>
        </div>
      )}

      {tab === 'screen' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumField label={t('calc.projection.diagonal', 'Diagonale')} value={diagonalIn} onChange={setDiagonalIn} step={1} suffix="″" />
            <label className="block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('calc.projection.aspect', 'Seitenverhältnis')}</span>
              <select
                value={aspectId}
                onChange={(e) => setAspectId(e.target.value)}
                className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-base"
              >
                {ASPECTS.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="space-y-1.5">
            <Result label={t('calc.projection.dimensions', 'Bildfläche (B × H)')} value={`${screen.w.toFixed(2)} × ${screen.h.toFixed(2)} m`} />
            <Result label={t('calc.projection.area', 'Fläche')} value={`${screen.area.toFixed(2)} m²`} />
            <Result label={t('calc.projection.viewThx', 'Min. Sitzabstand (THX 36°)')} value={`${screen.thx.toFixed(2)} m`} />
            <Result label={t('calc.projection.viewSmpte', 'Optimaler Sitzabstand (SMPTE 30°)')} value={`${screen.smpte.toFixed(2)} m`} />
          </div>
          <p className="text-[11px] text-cp-text-muted">
            {t('calc.projection.screen.note', 'Sitzabstände nach horizontalem Blickwinkel: THX empfiehlt max. 36°, SMPTE EG-18 ca. 30°.')}
          </p>
        </div>
      )}

      {tab === 'led' && (
        <div className="space-y-3">
          <p className="text-cp-xs text-cp-text-muted">
            {t('calc.projection.led.intro', 'Auflösung einer LED-Wand aus Pixel-Pitch und physischer Größe.')}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <NumField label={t('calc.projection.pitch', 'Pixel-Pitch')} value={pitch} onChange={setPitch} step={0.1} suffix="mm" />
            <NumField label={t('calc.projection.ledWidth', 'Breite')} value={ledW} onChange={setLedW} suffix="m" />
            <NumField label={t('calc.projection.ledHeight', 'Höhe')} value={ledH} onChange={setLedH} suffix="m" />
          </div>
          <div className="space-y-1.5">
            <Result label={t('calc.projection.resolution', 'Auflösung')} value={`${led.pxW} × ${led.pxH} px`} />
            <Result label={t('calc.projection.totalPixels', 'Pixel gesamt')} value={`${led.total.toLocaleString()} (${led.mp.toFixed(1)} MP)`} />
          </div>
          <p className="text-[11px] text-cp-text-muted">
            {t('calc.projection.led.note', 'Faustregel Mindest-Betrachtungsabstand (m) ≈ Pixel-Pitch (mm). Bei 2.6 mm also ab ~2.6 m ohne sichtbares Pixelraster.')}
          </p>
        </div>
      )}
    </div>
  )
}

export const ProjectionCalculatorDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.projectionCalc.open)
  const close = useUiStore((s) => s.closeProjectionCalc)
  return (
    <ModalShell
      open={open}
      onClose={close}
      title={t('calc.projection.title', 'Projektion & Display')}
      maxWidth="xl"
      draggableKey="cable-planner:modal-pos:projection-calc"
    >
      <ProjectionCalcCore />
    </ModalShell>
  )
}
