import { lazy, Suspense, useMemo, useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useTranslation } from '../../lib/i18n'
import { ModalShell } from '../shared/ModalShell'
import { PanelHint } from '../shared/PanelHint'
import { berechneProjektion, maxBreiteFuerTiefe } from '../../lib/projektionGeometrie'
import { ProjektionPlan2D, type PlanLabels } from './ProjektionPlan2D'

// Three bleibt hinter der Lazy-Grenze (CLAUDE.md, tests/threeBundleGrenze.test.ts).
const ProjektionVorschau3D = lazy(() => import('../Rack/ProjektionVorschau3D'))

/**
 * #480 + #481 + #997 — Projektion & Display-Rechner. Zwei Werkzeuge:
 *
 *  1. Projektion & Display: Bildgröße, Montagehöhe, Throw-Distance,
 *     Lens-Shift und Sitzabstände mit 2D-Schnitt und 3D-Vorschau.
 *     Rechnung in `lib/projektionGeometrie.ts`.
 *  2. LED-Wall: Pixel-Pitch + physische Größe → Auflösung in Pixeln.
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
  { id: '1:1', label: '1:1', a: 1, b: 1 },
]
const aspectById = (id: string) => ASPECTS.find((x) => x.id === id) ?? ASPECTS[0]

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
        className="w-full rounded-cp-control border border-cp-border bg-cp-surface-3 p-1.5 text-cp-base"
      />
      {suffix && <span className="text-cp-xs text-cp-text-faint">{suffix}</span>}
    </div>
  </label>
)

const Result = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-2 rounded-cp-s border border-cp-border-muted bg-cp-surface-1/50 px-3 py-1.5">
    <span className="text-cp-xs text-cp-text-muted">{label}</span>
    <span className="font-mono text-cp-base whitespace-nowrap text-cp-accent tabular-nums">{value}</span>
  </div>
)

const Seg = ({ aktiv, onClick, label }: { aktiv: boolean; onClick: () => void; label: string }) => (
  <button
    type="button"
    role="radio"
    aria-checked={aktiv}
    onClick={onClick}
    className={`flex-1 rounded-cp-control px-2 py-1.5 text-cp-xs ${
      aktiv ? 'bg-cp-accent text-cp-accent-text' : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
    }`}
  >
    {label}
  </button>
)

type Tab = 'projection' | 'led'
type Ansicht = '2d' | '3d'

const ProjectionCalcCore = () => {
  const t = useTranslation()
  const isLight = useUiStore((s) => s.canvasTheme) === 'light'
  const [tab, setTab] = useState<Tab>('projection')
  const [ansicht, setAnsicht] = useState<Ansicht>('2d')

  // --- Projektion & Display -----------------------------------------------
  const [art, setArt] = useState<'projektor' | 'display'>('projektor')
  const [diagonalIn, setDiagonalIn] = useState(120)
  const [aspectId, setAspectId] = useState('16:9')
  const [unterkante, setUnterkante] = useState(1)
  const [throwRatio, setThrowRatio] = useState(1.5)
  const [shiftV, setShiftV] = useState(0)
  const [shiftH, setShiftH] = useState(0)
  const [roomDepth, setRoomDepth] = useState(8)
  const r = useMemo(() => {
    const asp = aspectById(aspectId)
    return berechneProjektion({
      art,
      diagonaleZoll: diagonalIn,
      seiten: { a: asp.a, b: asp.b },
      unterkanteM: unterkante,
      throwRatio,
      shiftVProzent: shiftV,
      shiftHProzent: shiftH,
    })
  }, [art, diagonalIn, aspectId, unterkante, throwRatio, shiftV, shiftH])
  const projektor = art === 'projektor' ? r.objektiv : undefined
  const labels: PlanLabels = {
    min: t('calc.projection.label.min', 'First row'),
    optimal: t('calc.projection.label.optimal', 'Optimal'),
    max: t('calc.projection.label.max', 'Last row'),
    abstand: t('calc.projection.label.throw', 'Throw'),
    breite: t('calc.projection.label.width', 'W'),
    hoehe: t('calc.projection.label.height', 'H'),
    unterkante: t('calc.projection.label.bottom', 'Bottom edge'),
    seite: t('calc.projection.label.side', 'Side view'),
    front: t('calc.projection.label.front', 'Front view'),
  }

  // --- LED wall -----------------------------------------------------------
  const [pitch, setPitch] = useState(2.6) // mm
  const [ledW, setLedW] = useState(6) // m
  const [ledH, setLedH] = useState(3) // m
  const led = useMemo(() => {
    const pxW = pitch > 0 ? Math.round((ledW * 1000) / pitch) : 0
    const pxH = pitch > 0 ? Math.round((ledH * 1000) / pitch) : 0
    return { pxW, pxH, total: pxW * pxH, mp: (pxW * pxH) / 1_000_000 }
  }, [pitch, ledW, ledH])

  const m = (v: number) => `${v.toFixed(2)} m`

  return (
    <div className="space-y-3 text-cp-text-bright">
      <div className="flex gap-1" role="radiogroup">
        <Seg aktiv={tab === 'projection'} onClick={() => setTab('projection')} label={t('calc.projection.tab.projection', 'Projection & display')} />
        <Seg aktiv={tab === 'led'} onClick={() => setTab('led')} label={t('calc.projection.tab.led', 'LED wall')} />
      </div>

      {tab === 'projection' && (
        <div className="space-y-3">
          <div className="flex gap-1" role="radiogroup" aria-label={t('calc.projection.kind', 'Type')}>
            <Seg aktiv={art === 'projektor'} onClick={() => setArt('projektor')} label={t('calc.projection.kind.projector', 'Projector')} />
            <Seg aktiv={art === 'display'} onClick={() => setArt('display')} label={t('calc.projection.kind.display', 'Display / LED')} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NumField label={t('calc.projection.diagonal', 'Diagonal')} value={diagonalIn} onChange={setDiagonalIn} step={1} suffix="″" />
            <label className="block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('calc.projection.aspect', 'Aspect ratio')}</span>
              <select
                value={aspectId}
                onChange={(e) => setAspectId(e.target.value)}
                className="w-full rounded-cp-control border border-cp-border bg-cp-surface-3 p-1.5 text-cp-base"
              >
                {ASPECTS.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            </label>
            <NumField label={t('calc.projection.bottomEdge', 'Bottom edge above floor')} value={unterkante} onChange={setUnterkante} step={0.05} suffix="m" />
            {art === 'projektor' && (
              <>
                <NumField label={t('calc.projection.throwRatio', 'Throw ratio')} value={throwRatio} onChange={setThrowRatio} step={0.05} />
                <NumField label={t('calc.projection.shiftV', 'Lens shift vertical')} value={shiftV} onChange={setShiftV} step={5} min={-150} suffix="%" />
                <NumField label={t('calc.projection.shiftH', 'Lens shift horizontal')} value={shiftH} onChange={setShiftH} step={5} min={-100} suffix="%" />
                <NumField label={t('calc.projection.roomDepth', 'Available depth')} value={roomDepth} onChange={setRoomDepth} suffix="m" />
              </>
            )}
          </div>

          <div className="flex gap-1" role="radiogroup" aria-label={t('calc.projection.preview', 'Preview')}>
            <Seg aktiv={ansicht === '2d'} onClick={() => setAnsicht('2d')} label={t('calc.projection.view2d', '2D plan')} />
            <Seg aktiv={ansicht === '3d'} onClick={() => setAnsicht('3d')} label={t('calc.projection.view3d', '3D view')} />
          </div>
          <div className="h-72 overflow-hidden rounded-cp-card border border-cp-border-muted bg-cp-surface-1">
            {ansicht === '2d' ? (
              <ProjektionPlan2D r={r} projektor={art === 'projektor'} labels={labels} />
            ) : (
              <Suspense fallback={<div className="p-3 text-cp-xs text-cp-text-muted">{t('calc.projection.loading3d', 'Loading 3D view…')}</div>}>
                <ProjektionVorschau3D r={r} projektor={art === 'projektor'} isLight={isLight} labels={labels} />
              </Suspense>
            )}
          </div>

          <div className="grid gap-1.5 sm:grid-cols-2">
            <Result label={t('calc.projection.dimensions', 'Image area (W × H)')} value={`${r.breite.toFixed(2)} × ${r.hoehe.toFixed(2)} m`} />
            <Result label={t('calc.projection.topEdge', 'Top edge above floor')} value={m(r.oberkante)} />
            {projektor && (
              <>
                <Result label={t('calc.projection.throwDistance', 'Throw distance (lens → image)')} value={m(r.abstand)} />
                <Result label={t('calc.projection.lensHeight', 'Lens height above floor')} value={m(projektor.y)} />
                <Result label={t('calc.projection.lensOffset', 'Lens offset from screen centre')} value={m(projektor.x)} />
                <Result label={t('calc.projection.maxWidth', 'Max. image width in room')} value={m(maxBreiteFuerTiefe(roomDepth, throwRatio))} />
              </>
            )}
            <Result label={t('calc.projection.viewThx', 'Min. viewing distance (THX 36°)')} value={m(r.sitz.min)} />
            <Result label={t('calc.projection.viewSmpte', 'Optimal viewing distance (SMPTE 30°)')} value={m(r.sitz.optimal)} />
            <Result label={t('calc.projection.viewMax', 'Max. viewing distance (6 × image height)')} value={m(r.sitz.max)} />
          </div>
          {projektor && r.abstand > roomDepth && (
            <p className="text-cp-xs text-cp-warn">{t('calc.projection.tooDeep', 'The throw distance exceeds the available depth. Use a shorter throw ratio or a smaller image.')}</p>
          )}
          {projektor && projektor.y < 0 && (
            <p className="text-cp-xs text-cp-warn">{t('calc.projection.lensBelowFloor', 'With this lens shift the lens would sit below the floor.')}</p>
          )}
          {projektor && <PanelHint
            className="text-cp-xs text-cp-text-muted"
            text={t('calc.projection.note', 'Throw distance = throw ratio × image width. Lens shift in % of image height or width as in the datasheet: +50 % puts the lens at the bottom edge, −50 % at the top edge (ceiling mount).')}
          />}
        </div>
      )}

      {tab === 'led' && (
        <div className="space-y-3">
          <p className="text-cp-xs text-cp-text-muted">
            {t('calc.projection.led.intro', 'Resolution of an LED wall from pixel pitch and physical size.')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <NumField label={t('calc.projection.pitch', 'Pixel pitch')} value={pitch} onChange={setPitch} step={0.1} suffix="mm" />
            <NumField label={t('calc.projection.ledWidth', 'Width')} value={ledW} onChange={setLedW} suffix="m" />
            <NumField label={t('calc.projection.ledHeight', 'Height')} value={ledH} onChange={setLedH} suffix="m" />
          </div>
          <div className="space-y-1.5">
            <Result label={t('calc.projection.resolution', 'Resolution')} value={`${led.pxW} × ${led.pxH} px`} />
            <Result label={t('calc.projection.totalPixels', 'Total pixels')} value={`${led.total.toLocaleString()} (${led.mp.toFixed(1)} MP)`} />
          </div>
          <p className="text-cp-xs text-cp-text-muted">
            {t('calc.projection.led.note', 'Rule of thumb min. viewing distance (m) ≈ pixel pitch (mm). At 2.6 mm, ~2.6 m before the pixel grid shows.')}
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
      title={t('calc.projection.title', 'Projection & display')}
      maxWidth="xl"
      draggableKey="cable-planner:modal-pos:projection-calc"
    >
      <ProjectionCalcCore />
    </ModalShell>
  )
}
