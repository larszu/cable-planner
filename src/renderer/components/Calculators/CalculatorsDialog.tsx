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
import { ModalShell } from '../shared/ModalShell'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import { Icon } from '../shared/Icon'

// v7.5.0 — Cable-Length tab removed. The standalone calculator
// can't produce meaningful estimates without inter-location distances
// + per-device location membership. A proper "real-world cable length"
// feature needs:
//   1. Distance edges between Location frames on the canvas.
//   2. Per-device location-tags (already implicit via the LocationFrame).
//   3. A length-derivation that walks: source-device → source-location
//      → distance(source-loc, dest-loc) → dest-location → dest-device,
//      plus per-cable slack.
// Until that lands, the existing per-cable `length` field captures
// the truth the user knows best.
type Tab = 'bandwidth' | 'power'

const TAB_LABEL_DE: Record<Tab, string> = {
  bandwidth: '📡 Bandbreite',
  power: '⚡ Stromverbrauch',
}

const TabBar = ({
  active,
  onChange,
}: {
  active: Tab
  onChange: (next: Tab) => void
}) => {
  const t = useTranslation()
  const TAB_LABEL: Record<Tab, string> = {
    bandwidth: t('calc.tab.bandwidth', TAB_LABEL_DE.bandwidth),
    power: t('calc.tab.power', TAB_LABEL_DE.power),
  }
  return (
    <div className="flex gap-1 border-b border-slate-800 px-4 py-2">
      {(Object.keys(TAB_LABEL) as Tab[]).map((tabId) => (
        <button
          key={tabId}
          type="button"
          onClick={() => onChange(tabId)}
          className={`rounded px-3 py-1 text-xs ${
            active === tabId
              ? 'bg-sky-700 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {TAB_LABEL[tabId]}
        </button>
      ))}
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
  const t = useTranslation()
  const [resolution, setResolution] = useState(RESOLUTION_PRESETS[1])
  const [fps, setFps] = useState(50)
  const [sampling, setSampling] = useState(SAMPLING_PRESETS[2])
  const bpsRaw = resolution.w * resolution.h * fps * sampling.factor
  const mbps = bpsRaw / 1_000_000
  const fittingTier = SDI_TIERS.find((t) => mbps <= t.mbps)
  return (
    <div className="space-y-3 p-4 text-sm">
      <p className="text-[11px] text-slate-400">
        {t(
          'calc.bandwidth.intro',
          'Brutto-Datenrate eines Video-Streams (vor Kompression) und der kleinste SDI-Tier der sie tragen kann. Pixel × Zeilen × fps × Bits-pro-Pixel.',
        )}
      </p>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">{t('calc.resolution', 'Auflösung')}</span>
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
          <span className="mb-1 block text-xs text-slate-400">{t('calc.sampling', 'Sampling / Tiefe')}</span>
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
        <div className="text-[10px] uppercase tracking-wide text-amber-300">{t('calc.dataRate', 'Datenrate')}</div>
        <div className="font-mono text-lg text-amber-100">{mbps.toLocaleString(undefined, { maximumFractionDigits: 1 })} Mbps</div>
        <div className="mt-1 text-xs text-amber-200">
          {fittingTier
            ? t('calc.bandwidth.fitsIn', 'Passt in {tier} ({mbps} Mbps).')
                .replace('{tier}', fittingTier.label)
                .replace('{mbps}', String(fittingTier.mbps))
            : t(
                'calc.bandwidth.exceeds',
                'Überschreitet 12G-SDI — nur über IP-Transport (ST 2110, NDI, JPEG-XS …) möglich.',
              )}
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

// ─── Power Consumption (+ 3-phase distribution) ────────────────────────────

/** Standard German/EU mains supply presets the user picks the cabling
 *  from. Phase column count drives the bin-packer below: 1 for Schuko,
 *  3 for CEE / Powerlock. */
const SUPPLY_PRESETS = [
  { id: 'schuko' as const, label: 'Schuko / Einphasig (16A)', voltage: 230, phases: 1, perPhaseAmps: 16 },
  { id: 'cee16' as const, label: 'CEE 16A (3-Phasen, rot)', voltage: 230, phases: 3, perPhaseAmps: 16 },
  { id: 'cee32' as const, label: 'CEE 32A (3-Phasen, rot)', voltage: 230, phases: 3, perPhaseAmps: 32 },
  { id: 'cee63' as const, label: 'CEE 63A (3-Phasen, rot)', voltage: 230, phases: 3, perPhaseAmps: 63 },
  { id: 'cee125' as const, label: 'CEE 125A (3-Phasen)', voltage: 230, phases: 3, perPhaseAmps: 125 },
  { id: 'powerlock-200' as const, label: 'Powerlock 200A (3-Phasen)', voltage: 230, phases: 3, perPhaseAmps: 200 },
  { id: 'powerlock-400' as const, label: 'Powerlock 400A (3-Phasen)', voltage: 230, phases: 3, perPhaseAmps: 400 },
  { id: 'powerlock-660' as const, label: 'Powerlock 660A (3-Phasen)', voltage: 230, phases: 3, perPhaseAmps: 660 },
]
type SupplyPresetId = (typeof SUPPLY_PRESETS)[number]['id']

/** DIN VDE 0293-308 phase identification colour code (EU harmonised):
 *  L1 brown, L2 black, L3 grey, N blue, PE green-yellow. We render the
 *  per-phase cards in those colours instead of arbitrary rosé/amber/sky
 *  so the picture matches the physical cabling at the venue. */
const PHASE_COLORS = {
  L1: {
    bg: 'bg-amber-900/40',
    border: 'border-amber-700',
    text: 'text-amber-200',
    dot: '#92400e' /* brown */,
  },
  L2: {
    bg: 'bg-slate-800/80',
    border: 'border-slate-500',
    text: 'text-slate-200',
    dot: '#0f172a' /* black */,
  },
  L3: {
    bg: 'bg-slate-700/60',
    border: 'border-slate-400',
    text: 'text-slate-100',
    dot: '#94a3b8' /* grey */,
  },
  N: {
    bg: 'bg-sky-900/40',
    border: 'border-sky-700',
    text: 'text-sky-200',
    dot: '#0284c7' /* blue */,
  },
  PE: {
    bg: 'bg-yellow-900/40',
    border: 'border-yellow-600',
    text: 'text-yellow-200',
    dot: '#84cc16' /* green-yellow */,
  },
} as const
const PHASE_KEYS = ['L1', 'L2', 'L3'] as const

interface DeviceAssignment {
  name: string
  watts: number
  phase: number // 1-indexed; 0 = no phase yet
}

/** Greedy bin-packing across N phases. Devices sorted by W desc;
 *  each device drops on the currently-lightest phase. Best-fit-
 *  decreasing is provably within 11/9 of optimal for this load-
 *  balancing problem — good enough for stage power planning,
 *  where the user can hand-tweak the result anyway. */
const balancePhases = (
  devices: { name: string; watts: number }[],
  phases: number,
): { perPhaseWatts: number[]; assignments: DeviceAssignment[] } => {
  const sorted = [...devices].sort((a, b) => b.watts - a.watts)
  const perPhaseWatts = Array.from({ length: phases }, () => 0)
  const assignments: DeviceAssignment[] = []
  for (const d of sorted) {
    let lightest = 0
    for (let i = 1; i < phases; i++) {
      if (perPhaseWatts[i] < perPhaseWatts[lightest]) lightest = i
    }
    perPhaseWatts[lightest] += d.watts
    assignments.push({ name: d.name, watts: d.watts, phase: lightest + 1 })
  }
  return { perPhaseWatts, assignments }
}

// v7.6.0 — EU phase code (DIN VDE 0293-308): L1=brown, L2=black, L3=grey.
// Use the PHASE_COLORS map directly via PHASE_KEYS[idx].

const PowerTab = () => {
  const t = useTranslation()
  const equipment = useProjectStore((s) => s.project.equipment)
  const [supplyId, setSupplyId] = useState<SupplyPresetId>('cee32')
  const [marginPercent, setMarginPercent] = useState(20)
  const supply = SUPPLY_PRESETS.find((s) => s.id === supplyId) ?? SUPPLY_PRESETS[0]

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
  const ampsSinglePhase = totalWithMargin / supply.voltage
  // For 3-phase symmetric load: I = P / (V·√3) ≈ P / 398 V.
  const ampsThreePhase = totalWithMargin / (supply.voltage * Math.sqrt(3))

  const distribution = useMemo(
    () => balancePhases(totals.devices, supply.phases),
    [totals.devices, supply.phases],
  )

  const perPhaseLoadFraction = distribution.perPhaseWatts.map(
    (w) => (w / supply.voltage) / supply.perPhaseAmps,
  )
  const overloaded = perPhaseLoadFraction.some((f) => f > 1)
  const maxImbalancePct =
    distribution.perPhaseWatts.length > 0 && Math.max(...distribution.perPhaseWatts) > 0
      ? Math.round(
          ((Math.max(...distribution.perPhaseWatts) -
            Math.min(...distribution.perPhaseWatts)) /
            Math.max(...distribution.perPhaseWatts)) *
            100,
        )
      : 0

  return (
    <div className="space-y-3 p-4 text-sm">
      <p className="text-[11px] text-slate-400">
        {t(
          'calc.power.intro1',
          'Summe der Verbrauchsangaben aus den Geräte-Eigenschaften',
        )}{' '}
        (<code className="rounded bg-slate-800 px-1">{t('calc.power.wattsField', 'Leistung (W)')}</code>).{' '}
        {t(
          'calc.power.intro2',
          'Geräte ohne Wert zählen nicht mit; in den Properties nachtragen damit die Verteilung stimmt.',
        )}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">{t('calc.connectionType', 'Anschluss-Typ')}</span>
          <select
            value={supplyId}
            onChange={(e) => setSupplyId(e.target.value as SupplyPresetId)}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2"
          >
            {SUPPLY_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-400">{t('calc.safetyReserve', 'Sicherheits-Reserve (%)')}</span>
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
          <dt className="text-slate-500">{t('calc.devicesCounted', 'Erfasste Geräte')}</dt>
          <dd className="font-mono text-slate-200">
            {totals.countedDevices} {t('calc.outOf', 'von')} {totals.countedDevices + totals.missingDevices}
            {totals.missingDevices > 0 && (
              <span className="ml-2 text-amber-300">({totals.missingDevices} {t('calc.withoutValue', 'ohne Wert')})</span>
            )}
          </dd>
          <dt className="text-slate-500">{t('calc.totalUsage', 'Gesamtverbrauch')}</dt>
          <dd className="font-mono text-slate-200">{totals.totalW.toFixed(0)} W</dd>
          <dt className="text-slate-500">+ {t('calc.reserve', 'Reserve')} ({marginPercent}%)</dt>
          <dd className="font-mono text-emerald-200 text-lg">
            {totalWithMargin.toFixed(0)} W · {(totalWithMargin / 1000).toFixed(2)} kW
          </dd>
          {supply.phases === 1 ? (
            <>
              <dt className="text-slate-500">{t('calc.current1phase', 'Stromstärke (1-phasig)')}</dt>
              <dd className="font-mono text-slate-200">
                {ampsSinglePhase.toFixed(1)} A · max {supply.perPhaseAmps} A
              </dd>
            </>
          ) : (
            <>
              <dt className="text-slate-500">{t('calc.current3phase', 'Symmetrisch (3-phasig)')}</dt>
              <dd className="font-mono text-slate-200">
                {ampsThreePhase.toFixed(1)} A · max {supply.perPhaseAmps} A {t('calc.perPhase', 'je Phase')}
              </dd>
            </>
          )}
        </dl>
      </div>

      {supply.phases === 3 && totals.devices.length > 0 && (
        <div
          className={`rounded border ${
            overloaded ? 'border-red-700 bg-red-950/30' : 'border-sky-700 bg-sky-950/20'
          } p-3`}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wide text-slate-300">
              {t('calc.phaseDistribution', 'Phasen-Verteilung')} ({supply.label})
            </div>
            <div className="text-[10px] text-slate-500">
              {t('calc.imbalance', 'Unwucht')}: {maxImbalancePct}%
              {overloaded && (
                <span className="ml-2 inline-flex items-center gap-1 rounded bg-red-700 px-1.5 py-0.5 text-[10px] text-white">
                  <Icon icon={AlertTriangle} size="xs" />
                  {t('calc.phaseOverload', 'Phase überlastet')}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {distribution.perPhaseWatts.map((watts, idx) => {
              const amps = watts / supply.voltage
              const fraction = amps / supply.perPhaseAmps
              return (
                <div
                  key={idx}
                  className={`rounded border ${PHASE_COLORS[PHASE_KEYS[idx]].border} ${PHASE_COLORS[PHASE_KEYS[idx]].bg} p-2`}
                >
                  <div
                    className={`flex items-center gap-1 text-[10px] uppercase tracking-wider ${PHASE_COLORS[PHASE_KEYS[idx]].text}`}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: PHASE_COLORS[PHASE_KEYS[idx]].dot }}
                      title={`${t('calc.euColor', 'EU-Farbcode')} L${idx + 1}`}
                    />
                    {t('calc.phaseLabel', 'Phase')} L{idx + 1}
                  </div>
                  <div className="font-mono text-base text-slate-100">
                    {watts.toFixed(0)} W
                  </div>
                  <div className="font-mono text-[11px] text-slate-300">
                    {amps.toFixed(1)} A / {supply.perPhaseAmps} A
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-800">
                    <div
                      className={`h-full ${
                        fraction > 1
                          ? 'bg-red-500'
                          : fraction > 0.85
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, fraction * 100)}%` }}
                    />
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    {Math.round(fraction * 100)}% {t('calc.load', 'Last')}
                  </div>
                </div>
              )
            })}
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] uppercase tracking-wide text-slate-400 hover:text-slate-200">
              {t('calc.devicesToPhase', 'Geräte → Phase')} ({distribution.assignments.length})
            </summary>
            <table className="mt-1 w-full text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left">{t('calc.col.device', 'Gerät')}</th>
                  <th className="text-right">W</th>
                  <th className="text-right pr-2">{t('calc.col.phase', 'Phase')}</th>
                </tr>
              </thead>
              <tbody>
                {distribution.assignments.map((a, i) => (
                  <tr key={`${a.name}-${i}`} className="border-t border-slate-800">
                    <td className="truncate py-0.5">{a.name}</td>
                    <td className="text-right font-mono text-slate-400">{a.watts}</td>
                    <td
                      className={`pr-2 text-right font-mono font-semibold ${PHASE_COLORS[PHASE_KEYS[a.phase - 1]].text}`}
                    >
                      L{a.phase}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
            <span className="font-semibold uppercase tracking-wide text-slate-500">
              {t('calc.euColorTitle', 'EU-Farbcode (DIN VDE 0293-308)')}:
            </span>
            {(['L1', 'L2', 'L3', 'N', 'PE'] as const).map((key) => (
              <span key={key} className="flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: PHASE_COLORS[key].dot }}
                />
                <span>{key}</span>
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            {t(
              'calc.greedyExplain',
              'Greedy-Verteilung: sortiert nach Leistung, jedes Gerät auf die aktuell am schwächsten belastete Phase. Bei symmetrischen Lasten zieht der Drehstrom nur {amps} A je Phase; Unwucht erhöht den höchsten Phasenstrom. Ziel: jede Phase < 85% Last + Unwucht < 20%.',
            ).replace('{amps}', ampsThreePhase.toFixed(1))}
          </p>
        </div>
      )}

      {totals.devices.length > 0 && (
        <details className="rounded border border-slate-800 bg-slate-950/40">
          <summary className="cursor-pointer px-3 py-1.5 text-[11px] uppercase tracking-wide text-slate-400">
            {t('calc.topConsumers', 'Top-Verbraucher')}
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
  const t = useTranslation()
  const open = useUiStore((s) => s.calculators.open)
  const close = useUiStore((s) => s.closeCalculators)
  // v7.5.0 — older shortcuts may still pass 'length'; coerce to bandwidth
  // since the cable-length calculator was removed (no meaningful estimate
  // without an inter-location distance graph).
  const initialTab = useUiStore((s) => s.calculators.tab)
  const [tab, setTab] = useState<Tab>(
    initialTab === 'bandwidth' || initialTab === 'power' ? initialTab : 'bandwidth',
  )
  return (
    <ModalShell
      open={open}
      onClose={close}
      title={t('calc.title', 'Werkzeuge / Rechner')}
      titleIcon="🧮"
      maxWidth="2xl"
      draggableKey="cable-planner:modal-pos:calculators"
    >
      <TabBar active={tab} onChange={setTab} />
      {tab === 'bandwidth' && <BandwidthTab />}
      {tab === 'power' && <PowerTab />}
    </ModalShell>
  )
}
