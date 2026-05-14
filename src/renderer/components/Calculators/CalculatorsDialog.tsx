/**
 * Roadmap #76 follow-up — three small standalone utility calculators:
 *   • Cable-Length: Euclidean + vertical-rise + slack reserve
 *   • Bandwidth: video format → Mbps + SDI-tier check
 *   • Power Consumption: sum of equipment watts → kW + amps + breaker
 *
 * All three live in one dialog with tabs so we don't clutter the topbar
 * with three more menu items.
 */

import { useMemo, useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'

type Tab = 'length' | 'bandwidth' | 'power'

const TAB_LABEL: Record<Tab, string> = {
  length: '📐 Kabel-Länge',
  bandwidth: '📡 Bandbreite',
  power: '⚡ Stromverbrauch',
}

const TabBar = ({
  active,
  onChange,
}: {
  active: Tab
  onChange: (next: Tab) => void
}) => (
  <div className="flex gap-1 border-b border-slate-800 px-4 py-2">
    {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
      <button
        key={t}
        type="button"
        onClick={() => onChange(t)}
        className={`rounded px-3 py-1 text-xs ${
          active === t
            ? 'bg-sky-700 text-white'
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
        }`}
      >
        {TAB_LABEL[t]}
      </button>
    ))}
  </div>
)

// ─── Cable Length ──────────────────────────────────────────────────────────

const LengthTab = () => {
  const [horizontal, setHorizontal] = useState(10)
  const [vertical, setVertical] = useState(2)
  const [slackPercent, setSlackPercent] = useState(15)
  const [bendCount, setBendCount] = useState(2)
  const bendReserve = 0.3 // m per bend
  const straight = Math.sqrt(horizontal * horizontal + vertical * vertical)
  const withBends = straight + bendCount * bendReserve
  const total = withBends * (1 + slackPercent / 100)
  return (
    <div className="space-y-3 p-4 text-sm">
      <p className="text-[11px] text-slate-400">
        Schätzt die benötigte Kabel-Länge aus horizontaler Distanz, vertikaler Steigung,
        Anzahl der 90°-Bögen und einem prozentualen Reserve-Slack. Reserve pro Bogen: 0,3 m.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Horizontal (m)</span>
          <input
            type="number"
            step={0.1}
            value={horizontal}
            onChange={(e) => setHorizontal(Math.max(0, Number(e.target.value) || 0))}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Vertikal (m)</span>
          <input
            type="number"
            step={0.1}
            value={vertical}
            onChange={(e) => setVertical(Math.max(0, Number(e.target.value) || 0))}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Anzahl Bögen</span>
          <input
            type="number"
            min={0}
            value={bendCount}
            onChange={(e) => setBendCount(Math.max(0, Number(e.target.value) || 0))}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Slack-Reserve (%)</span>
          <input
            type="number"
            min={0}
            step={5}
            value={slackPercent}
            onChange={(e) => setSlackPercent(Math.max(0, Number(e.target.value) || 0))}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2"
          />
        </label>
      </div>
      <div className="rounded border border-sky-700 bg-sky-950/40 p-3">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-slate-500">Direkte Distanz</dt>
          <dd className="font-mono text-slate-200">{straight.toFixed(2)} m</dd>
          <dt className="text-slate-500">+ Bogen-Reserve</dt>
          <dd className="font-mono text-slate-200">{withBends.toFixed(2)} m</dd>
          <dt className="text-slate-500">+ Slack ({slackPercent}%)</dt>
          <dd className="font-mono text-lg font-semibold text-sky-200">{total.toFixed(2)} m</dd>
        </dl>
        <p className="mt-2 text-[10px] text-slate-500">
          Empfehlung: nächst-größere Standard-Länge nehmen (z. B. {Math.ceil(total)} m oder{' '}
          {Math.ceil(total / 5) * 5} m als 5-m-Raster).
        </p>
      </div>
    </div>
  )
}

// ─── Bandwidth ─────────────────────────────────────────────────────────────

const SDI_TIERS: { label: string; mbps: number }[] = [
  { label: 'HD-SDI (1.5G)', mbps: 1485 },
  { label: '3G-SDI', mbps: 2970 },
  { label: '6G-SDI', mbps: 5940 },
  { label: '12G-SDI', mbps: 11880 },
]

const RESOLUTION_PRESETS: { label: string; w: number; h: number }[] = [
  { label: '720p', w: 1280, h: 720 },
  { label: '1080p', w: 1920, h: 1080 },
  { label: '1440p', w: 2560, h: 1440 },
  { label: '2160p / 4K UHD', w: 3840, h: 2160 },
  { label: '4096 DCI', w: 4096, h: 2160 },
  { label: '8K UHD', w: 7680, h: 4320 },
]

const FPS_PRESETS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60]

const SAMPLING_PRESETS: { label: string; factor: number }[] = [
  { label: '4:2:0 8-bit', factor: 12 },
  { label: '4:2:2 8-bit', factor: 16 },
  { label: '4:2:2 10-bit', factor: 20 },
  { label: '4:4:4 8-bit', factor: 24 },
  { label: '4:4:4 10-bit', factor: 30 },
  { label: '4:4:4 12-bit', factor: 36 },
]

const BandwidthTab = () => {
  const [resolution, setResolution] = useState(RESOLUTION_PRESETS[1])
  const [fps, setFps] = useState(50)
  const [sampling, setSampling] = useState(SAMPLING_PRESETS[2])
  const bpsRaw = resolution.w * resolution.h * fps * sampling.factor
  const mbps = bpsRaw / 1_000_000
  const fittingTier = SDI_TIERS.find((t) => mbps <= t.mbps)
  return (
    <div className="space-y-3 p-4 text-sm">
      <p className="text-[11px] text-slate-400">
        Brutto-Datenrate eines Video-Streams (vor Kompression) und der kleinste SDI-Tier der
        sie tragen kann. Pixel × Zeilen × fps × Bits-pro-Pixel.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Auflösung</span>
          <select
            value={resolution.label}
            onChange={(e) =>
              setResolution(
                RESOLUTION_PRESETS.find((r) => r.label === e.target.value) ?? RESOLUTION_PRESETS[1],
              )
            }
            className="w-full rounded border border-slate-700 bg-slate-950 p-2"
          >
            {RESOLUTION_PRESETS.map((r) => (
              <option key={r.label} value={r.label}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">FPS</span>
          <select
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2"
          >
            {FPS_PRESETS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Sampling / Tiefe</span>
          <select
            value={sampling.label}
            onChange={(e) =>
              setSampling(
                SAMPLING_PRESETS.find((s) => s.label === e.target.value) ?? SAMPLING_PRESETS[2],
              )
            }
            className="w-full rounded border border-slate-700 bg-slate-950 p-2"
          >
            {SAMPLING_PRESETS.map((s) => (
              <option key={s.label} value={s.label}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="rounded border border-amber-700 bg-amber-950/30 p-3">
        <div className="text-[10px] uppercase tracking-wide text-amber-300">Datenrate</div>
        <div className="font-mono text-lg text-amber-100">{mbps.toLocaleString(undefined, { maximumFractionDigits: 1 })} Mbps</div>
        <div className="mt-1 text-xs text-amber-200">
          {fittingTier
            ? `Passt in ${fittingTier.label} (${fittingTier.mbps} Mbps).`
            : `Überschreitet 12G-SDI — nur über IP-Transport (ST 2110, NDI, JPEG-XS …) möglich.`}
        </div>
      </div>
      <details className="rounded border border-slate-800 bg-slate-950/40">
        <summary className="cursor-pointer px-3 py-1.5 text-[11px] uppercase tracking-wide text-slate-400">
          SDI-Tiers
        </summary>
        <ul className="space-y-0.5 px-3 py-2 text-xs">
          {SDI_TIERS.map((t) => (
            <li key={t.label}>
              <span className="inline-block w-28">{t.label}</span>
              <span className="font-mono text-slate-400">≤ {t.mbps} Mbps</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

// ─── Power Consumption ─────────────────────────────────────────────────────

const PowerTab = () => {
  const equipment = useProjectStore((s) => s.project.equipment)
  const [voltage, setVoltage] = useState(230)
  const [marginPercent, setMarginPercent] = useState(20)
  const totals = useMemo(() => {
    let totalW = 0
    let countedDevices = 0
    let missingDevices = 0
    const devices: { name: string; watts: number }[] = []
    for (const e of equipment) {
      const w = e.powerConsumptionWatts ?? 0
      if (w > 0) {
        totalW += w
        countedDevices += 1
        devices.push({ name: e.name, watts: w })
      } else {
        missingDevices += 1
      }
    }
    devices.sort((a, b) => b.watts - a.watts)
    return { totalW, countedDevices, missingDevices, devices }
  }, [equipment])
  const totalWithMargin = totals.totalW * (1 + marginPercent / 100)
  const amps = totalWithMargin / Math.max(1, voltage)
  const recommendedBreaker = amps > 0 ? [16, 25, 32, 63, 80, 125].find((b) => amps * 1.25 <= b) ?? '> 125' : '—'
  return (
    <div className="space-y-3 p-4 text-sm">
      <p className="text-[11px] text-slate-400">
        Summe der Verbrauchsangaben aus den Geräte-Eigenschaften
        (<code className="rounded bg-slate-800 px-1">powerConsumptionWatts</code>). Geräte ohne Wert
        zählen nicht mit; trage sie in den Properties nach, damit die Summe stimmt.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Netzspannung (V)</span>
          <select
            value={voltage}
            onChange={(e) => setVoltage(Number(e.target.value))}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2"
          >
            <option value={230}>230 V (EU)</option>
            <option value={120}>120 V (US)</option>
            <option value={400}>400 V (3-Phasen)</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">Sicherheits-Reserve (%)</span>
          <input
            type="number"
            min={0}
            value={marginPercent}
            onChange={(e) => setMarginPercent(Math.max(0, Number(e.target.value) || 0))}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2"
          />
        </label>
      </div>
      <div className="rounded border border-emerald-700 bg-emerald-950/30 p-3">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-slate-500">Erfasste Geräte</dt>
          <dd className="font-mono text-slate-200">
            {totals.countedDevices} von {totals.countedDevices + totals.missingDevices}
            {totals.missingDevices > 0 && (
              <span className="ml-2 text-amber-300">({totals.missingDevices} ohne Wert)</span>
            )}
          </dd>
          <dt className="text-slate-500">Gesamtverbrauch</dt>
          <dd className="font-mono text-slate-200">{totals.totalW.toFixed(0)} W</dd>
          <dt className="text-slate-500">+ Reserve ({marginPercent}%)</dt>
          <dd className="font-mono text-emerald-200 text-lg">
            {totalWithMargin.toFixed(0)} W · {(totalWithMargin / 1000).toFixed(2)} kW
          </dd>
          <dt className="text-slate-500">Stromstärke @ {voltage} V</dt>
          <dd className="font-mono text-slate-200">{amps.toFixed(1)} A</dd>
          <dt className="text-slate-500">Empfohlene Absicherung</dt>
          <dd className="font-mono text-slate-200">
            {typeof recommendedBreaker === 'number' ? `B${recommendedBreaker}` : recommendedBreaker}
          </dd>
        </dl>
      </div>
      {totals.devices.length > 0 && (
        <details className="rounded border border-slate-800 bg-slate-950/40">
          <summary className="cursor-pointer px-3 py-1.5 text-[11px] uppercase tracking-wide text-slate-400">
            Top-Verbraucher
          </summary>
          <ul className="px-3 py-2 text-xs">
            {totals.devices.slice(0, 12).map((d) => (
              <li key={d.name} className="flex justify-between border-b border-slate-800 py-0.5">
                <span className="truncate">{d.name}</span>
                <span className="font-mono text-slate-400">{d.watts} W</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export const CalculatorsDialog = () => {
  const open = useUiStore((s) => s.calculators.open)
  const close = useUiStore((s) => s.closeCalculators)
  const initialTab = useUiStore((s) => s.calculators.tab) ?? 'length'
  const [tab, setTab] = useState<Tab>(initialTab)
  const drag = useDraggablePosition('cable-planner:modal-pos:calculators', open)
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        ref={drag.containerRef}
        style={drag.containerStyle}
        className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
      >
        <header
          {...drag.headerProps}
          className="flex items-center justify-between border-b border-slate-700 px-4 py-3 select-none"
        >
          <h2 className="text-sm font-semibold">
            <span className="mr-2">🧮</span>Werkzeuge / Rechner
          </h2>
          <button
            type="button"
            onClick={close}
            className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            ✕
          </button>
        </header>
        <TabBar active={tab} onChange={setTab} />
        {tab === 'length' && <LengthTab />}
        {tab === 'bandwidth' && <BandwidthTab />}
        {tab === 'power' && <PowerTab />}
      </div>
    </div>
  )
}
