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
import { AlertTriangle, Download, Calculator, BatteryCharging, Pin} from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import { Icon } from '../shared/Icon'
import { downloadBlob } from '../../lib/downloadBlob'
import { wattsWithSource, type WattsSource } from '../../lib/equipmentSelectors'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { bandwidthMbpsForStandard, linkCapacityMbpsForStandard } from '../../types/cableSpec'
import { powerStandardById, POWER_SUPPLY_PRESETS } from '../../types/powerStandard'
import jsPDF from 'jspdf'
import { sanitizeForPdf } from '../../lib/sanitizeForPdf'
import { PanelHint } from '../shared/PanelHint'

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
// #403 — TabBar entfernt: Bandwidth + Power sind jetzt zwei
// separate Dialoge (siehe Export-Block am Dateiende).

// ─── Bandwidth ─────────────────────────────────────────────────────────────

const SDI_TIERS: { label: string; mbps: number }[] = [
  { label: 'HD-SDI (1.5G)', mbps: 1485 },
  { label: '3G-SDI', mbps: 2970 },
  { label: '6G-SDI', mbps: 5940 },
  { label: '12G-SDI', mbps: 11880 },
]

// #347/#358 — typische Brutto-Bandbreiten der IP-/Digital-Signalstandards
// als Referenz im Bandbreiten-Rechner. Werte sind format-/kanalabhängig;
// hier gängige Richtwerte (1080p50/60, 48 kHz).
const SIGNAL_STD_BANDWIDTH: { label: string; mbps: string }[] = [
  { label: 'DVB-ASI', mbps: '≤ 270' },
  { label: 'MADI (64ch @48k)', mbps: '~49 (Link 125)' },
  { label: 'Dante / AES67 (64ch @48k)', mbps: '~49' },
  { label: 'NDI Full (1080p)', mbps: '~125–250' },
  { label: 'NDI HX', mbps: '~8–20' },
  { label: 'ST 2110-20 (1080p, uncompr.)', mbps: '~3000' },
  { label: 'ST 2110-20 (2160p, uncompr.)', mbps: '~12000' },
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

// #346 — gängige Netzwerk-Link-Kapazitäten (Mbps) für die Budget-Bewertung.
const LINK_TIERS: { label: string; mbps: number }[] = [
  { label: '1 GbE', mbps: 1000 },
  { label: '10 GbE', mbps: 10000 },
  { label: '25 GbE', mbps: 25000 },
  { label: '40 GbE', mbps: 40000 },
  { label: '100 GbE', mbps: 100000 },
]

const BandwidthTab = () => {
  const t = useTranslation()
  const cables = useProjectStore((s) => s.project.cables)
  // #346 — Projekt-Netzwerk-Budget: Summe der IP-/Netzwerk-Signal-Bandbreiten
  // über alle Kabel mit gesetztem Netzwerk-Standard.
  // LAST und KAPAZITAET werden getrennt gezaehlt. Bis 2026-09-04 lieferte
  // `bandwidthMbpsForStandard` auch fuer Eth-100/1G/10G einen Wert, und diese
  // Schleife summierte ihn als Last: ein einziges gezeichnetes Cat6a-Kabel
  // ergab „10 Gbps Gesamt" und die Empfehlung „10 GbE" — bei null
  // Mediensignalen. Die Empfehlung haing daran, wie viele Netzwerkkabel jemand
  // gezeichnet hatte, nicht daran, was darueber laeuft.
  const netBudget = useMemo(() => {
    let totalMbps = 0
    let count = 0
    let linkMbps = 0
    let linkCount = 0
    const byStd = new Map<string, { mbps: number; count: number }>()
    for (const c of cables) {
      const kapazitaet = linkCapacityMbpsForStandard(c.standard)
      if (kapazitaet != null) {
        linkMbps += kapazitaet
        linkCount += 1
        continue
      }
      const mbps = bandwidthMbpsForStandard(c.standard)
      if (mbps == null) continue
      totalMbps += mbps
      count += 1
      const e = byStd.get(c.standard as string) ?? { mbps: 0, count: 0 }
      e.mbps += mbps
      e.count += 1
      byStd.set(c.standard as string, e)
    }
    const rows = [...byStd.entries()]
      .map(([std, v]) => ({ std, ...v }))
      .sort((a, b) => b.mbps - a.mbps)
    const tier = LINK_TIERS.find((l) => totalMbps <= l.mbps)
    return { totalMbps, count, rows, tier, linkMbps, linkCount }
  }, [cables])
  const [resolution, setResolution] = useState(RESOLUTION_PRESETS[1])
  const [fps, setFps] = useState(50)
  const [sampling, setSampling] = useState(SAMPLING_PRESETS[2])
  const bpsRaw = resolution.w * resolution.h * fps * sampling.factor
  const mbps = bpsRaw / 1_000_000
  const fittingTier = SDI_TIERS.find((t) => mbps <= t.mbps)
  return (
    <div className="space-y-3 p-4 text-cp-base">
      <PanelHint className="mb-2 text-cp-xs text-cp-text-muted" text={t(
          'calc.bandwidth.intro',
          'Gross data rate of a video stream (before compression) and the smallest SDI tier that carries it. Pixels × lines × fps × bits-per-pixel.',
        )} />
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('calc.resolution', 'Resolution')}</span>
          <select
            value={resolution.label}
            onChange={(e) =>
              setResolution(
                RESOLUTION_PRESETS.find((r) => r.label === e.target.value) ?? RESOLUTION_PRESETS[1],
              )
            }
            className="w-full border border-cp-border bg-cp-surface-3 p-2"
          >
            {RESOLUTION_PRESETS.map((r) => (
              <option key={r.label} value={r.label}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-cp-xs text-cp-text-muted">FPS</span>
          <select
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            className="w-full border border-cp-border bg-cp-surface-3 p-2"
          >
            {FPS_PRESETS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('calc.sampling', 'Sampling / depth')}</span>
          <select
            value={sampling.label}
            onChange={(e) =>
              setSampling(
                SAMPLING_PRESETS.find((s) => s.label === e.target.value) ?? SAMPLING_PRESETS[2],
              )
            }
            className="w-full border border-cp-border bg-cp-surface-3 p-2"
          >
            {SAMPLING_PRESETS.map((s) => (
              <option key={s.label} value={s.label}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="border border-amber-700 bg-amber-950/30 p-3">
        <div className="text-cp-xs uppercase tracking-wide text-amber-300">{t('calc.dataRate', 'Data rate')}</div>
        <div className="font-mono text-cp-xl text-amber-100">{mbps.toLocaleString(undefined, { maximumFractionDigits: 1 })} Mbps</div>
        <div className="mt-1 text-cp-xs text-amber-200">
          {fittingTier
            ? t('calc.bandwidth.fitsIn', 'Fits in {tier} ({mbps} Mbps).')
                .replace('{tier}', fittingTier.label)
                .replace('{mbps}', String(fittingTier.mbps))
            : t(
                'calc.bandwidth.exceeds',
                'Exceeds 12G-SDI — only IP transport (ST 2110, NDI, JPEG-XS …) will carry it.',
              )}
        </div>
      </div>
      <details className="border border-cp-border-muted bg-cp-surface-3/40">
        <summary className="cursor-pointer px-3 py-1.5 text-cp-xs uppercase tracking-wide text-cp-text-muted">
          SDI-Tiers
        </summary>
        <ul className="space-y-0.5 px-3 py-2 text-cp-xs">
          {SDI_TIERS.map((t) => (
            <li key={t.label}>
              <span className="inline-block w-28">{t.label}</span>
              <span className="font-mono text-cp-text-muted">≤ {t.mbps} Mbps</span>
            </li>
          ))}
        </ul>
      </details>
      <details className="border border-cp-border-muted bg-cp-surface-3/40">
        <summary className="cursor-pointer px-3 py-1.5 text-cp-xs uppercase tracking-wide text-cp-text-muted">
          {t('calc.bandwidth.signalStds', 'IP / digital signal standards')}
        </summary>
        <ul className="space-y-0.5 px-3 py-2 text-cp-xs">
          {SIGNAL_STD_BANDWIDTH.map((s) => (
            <li key={s.label}>
              <span className="inline-block w-56">{s.label}</span>
              <span className="font-mono text-cp-text-muted">{s.mbps} Mbps</span>
            </li>
          ))}
        </ul>
      </details>

      {/* #346 — Projekt-Netzwerk-Budget: Summe aller IP-/Netzwerk-Signale. */}
      {netBudget.count > 0 && (
        <div className="border border-sky-700 bg-sky-950/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-cp-xs uppercase tracking-wide text-cp-text-secondary">
              {t('calc.bandwidth.netBudget', 'Project network budget')}
            </div>
            <div className="text-cp-xs text-cp-text-muted">
              {netBudget.count} {t('calc.bandwidth.netLinks', 'IP signals')}
            </div>
          </div>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-cp-xs">
            <dt className="text-cp-text-faint font-semibold">{t('calc.bandwidth.netTotal', 'Total bandwidth')}</dt>
            <dd className="font-mono text-cp-xl text-sky-200">
              {netBudget.totalMbps >= 1000
                ? `${(netBudget.totalMbps / 1000).toFixed(2)} Gbps`
                : `${netBudget.totalMbps} Mbps`}
            </dd>
            <dt className="text-cp-text-faint">{t('calc.bandwidth.netLink', 'Smallest link')}</dt>
            <dd className="font-mono text-cp-text-bright">
              {netBudget.tier
                ? netBudget.tier.label
                : t('calc.bandwidth.netExceeds', '> 100 GbE — split / spine-leaf')}
            </dd>
          </dl>
          <ul className="mt-2 space-y-0.5 border-t border-cp-border-muted pt-2 text-cp-xs">
            {netBudget.rows.map((r) => (
              <li key={r.std} className="flex justify-between">
                <span className="text-cp-text-secondary">
                  {r.std} <span className="text-cp-text-faint">×{r.count}</span>
                </span>
                <span className="font-mono text-cp-text-muted">{r.mbps} Mbps</span>
              </li>
            ))}
          </ul>
          {netBudget.linkCount > 0 && (
            <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 border-t border-cp-border-muted pt-2 text-cp-xs">
              <dt className="text-cp-text-faint">
                {t('calc.bandwidth.netLinkCapacity', 'Drawn link capacity')}
              </dt>
              <dd className="font-mono text-cp-text-muted">
                {netBudget.linkMbps >= 1000
                  ? `${(netBudget.linkMbps / 1000).toFixed(2)} Gbps`
                  : `${netBudget.linkMbps} Mbps`}{' '}
                <span className="text-cp-text-faint">
                  ({netBudget.linkCount}{' '}
                  {t('calc.bandwidth.netEthCables', 'Ethernet cables')})
                </span>
              </dd>
            </dl>
          )}
          <PanelHint className="mt-2 text-cp-xs text-cp-text-muted" text={t(
          'calc.bandwidth.netNote',
          'Sum of the gross bandwidths of all cables carrying an IP media signal (NDI, Dante/AES67, ST 2110). Ethernet cables do NOT count as load — what a line can carry is not a load it carries; their capacity is listed separately below. Rough figures; ST 2110-20 heavily format-dependent.',
        )} />
        </div>
      )}
    </div>
  )
}

// ─── Power Consumption (+ 3-phase distribution) ────────────────────────────

// Netzanschluss-Presets kommen jetzt regional aus POWER_SUPPLY_PRESETS
// (gesteuert vom Projekt-Strom-Standard, Einstellungen → Projekt). Die
// Spannung wird zur Laufzeit aus dem Standard gesetzt.
type SupplyPresetId = string

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
    bg: 'bg-cp-surface-2/80',
    border: 'border-slate-500',
    text: 'text-cp-text-bright',
    dot: '#0f172a' /* black */,
  },
  L3: {
    bg: 'bg-cp-surface-4/60',
    border: 'border-slate-400',
    text: 'text-cp-text',
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
  id?: string
  name: string
  watts: number
  phase: number // 1-indexed; 0 = no phase yet
  /** true wenn der User die Phase fest zugeordnet hat (nicht auto-balanciert). */
  pinned?: boolean
}

// E-8 — die Herkunft der Leistungszahl, als Tabelle statt als Kette.
// `satisfies Record<WattsSource, …>` macht eine neue Quelle ohne Beschriftung
// zum Typfehler; eine Kette mit Default haette sie stumm als „geplant"
// ausgegeben, und das ist die eine Auskunft, die nicht raten darf.
const WATTS_QUELLE: Record<WattsSource, [key: string, de: string]> = {
  mode: ['calc.watts.mode', 'Modus'],
  planned: ['calc.watts.planned', 'geplant'],
  imported: ['calc.watts.imported', 'importiert'],
  derived: ['calc.watts.derived', 'aus V×A'],
  none: ['calc.watts.none', 'ohne Angabe'],
} satisfies Record<WattsSource, [string, string]>

const wattsQuelleLabel = (
  t: (key: string, fallback?: string) => string,
  source: WattsSource | undefined,
): string => (source ? t(...WATTS_QUELLE[source]) : '')

interface PhaseDevice {
  id?: string
  name: string
  watts: number
  /** Feste Phase (1..n) oder undefined = automatisch verteilen. */
  pinnedPhase?: number
  /** E-8 — woher die Zahl kommt. Eine Summe aus zwei Quellen ohne Herkunft
   *  ist genau die Zahl, an der jemand eine Verteilung zusagt. */
  source?: WattsSource
}

/** Greedy bin-packing across N phases. Devices sorted by W desc;
 *  each device drops on the currently-lightest phase. Best-fit-
 *  decreasing is provably within 11/9 of optimal for this load-
 *  balancing problem — good enough for stage power planning,
 *  where the user can hand-tweak the result anyway. */
const balancePhases = (
  devices: PhaseDevice[],
  phases: number,
): { perPhaseWatts: number[]; assignments: DeviceAssignment[] } => {
  const perPhaseWatts = Array.from({ length: phases }, () => 0)
  const assignments: DeviceAssignment[] = []
  // 1) Fest zugeordnete Geräte zuerst auf ihre Phase legen.
  const pinned = devices.filter(
    (d) => d.pinnedPhase && d.pinnedPhase >= 1 && d.pinnedPhase <= phases,
  )
  for (const d of pinned) {
    const idx = (d.pinnedPhase as number) - 1
    perPhaseWatts[idx] += d.watts
    assignments.push({ id: d.id, name: d.name, watts: d.watts, phase: idx + 1, pinned: true })
  }
  // 2) Rest greedy (Best-Fit-Decreasing) auf die jeweils schwächste Phase.
  const rest = devices.filter((d) => !pinned.includes(d)).sort((a, b) => b.watts - a.watts)
  for (const d of rest) {
    let lightest = 0
    for (let i = 1; i < phases; i++) {
      if (perPhaseWatts[i] < perPhaseWatts[lightest]) lightest = i
    }
    perPhaseWatts[lightest] += d.watts
    assignments.push({ id: d.id, name: d.name, watts: d.watts, phase: lightest + 1 })
  }
  return { perPhaseWatts, assignments }
}

// v7.6.0 — EU phase code (DIN VDE 0293-308): L1=brown, L2=black, L3=grey.
// Use the PHASE_COLORS map directly via PHASE_KEYS[idx].

const PowerTab = () => {
  const t = useTranslation()
  const equipment = useProjectStore((s) => s.project.equipment)
  const projectName = useProjectStore((s) => s.project.metadata.name)
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const [supplyId, setSupplyId] = useState<SupplyPresetId>('cee32')
  const [marginPercent, setMarginPercent] = useState(20)
  // #345 ff. — USV/Notstrom-Rechner. Reuse der Gesamtlast aus den Geräten.
  const [upsVa, setUpsVa] = useState(1500)
  const [upsPf, setUpsPf] = useState(0.9)
  const [battV, setBattV] = useState(12)
  const [battAh, setBattAh] = useState(9)
  const [battCount, setBattCount] = useState(2)
  const [usablePercent, setUsablePercent] = useState(85)
  const [targetMinutes, setTargetMinutes] = useState(15)
  // #345 ff. — Spannungsfall-Rechner für die Zuleitung (Distro-Strecke).
  const [runLength, setRunLength] = useState(25)
  const [crossSection, setCrossSection] = useState(2.5)
  // Netzspannung + Anschluss-Katalog aus dem projektweiten Strom-/Netz-
  // Standard (Einstellungen → Projekt → Plan-Standards). EU 230 V / Schuko,
  // Nordamerika 120 V / Edison, UK / BS 1363 usw. Steuert alle
  // Watt↔Ampere-Rechnungen unten (statt fix 230 V / EU-Stecker).
  const powerStandardId = useProjectStore((s) => s.project.metadata.defaultPowerStandard)
  const std = powerStandardById(powerStandardId)
  const mainsVoltage = std?.voltage ?? 230
  const supplies = POWER_SUPPLY_PRESETS[std?.region ?? 'eu']
  // Beim Regionswechsel auf ein gültiges Preset zurückfallen — OHNE setState-
  // im-Effect (vermeidet kaskadierende Re-Renders, react-hooks/set-state-in-
  // effect). rawSupply löst per Fallback immer ein gültiges Preset auf; das
  // <select> ist an rawSupply.id gebunden, zeigt also nach Regionswechsel
  // automatisch das erste gültige Preset. supplyId-State wird nur durch
  // User-Auswahl gesetzt; ein stale Wert ist hier folgenlos.
  const rawSupply = supplies.find((s) => s.id === supplyId) ?? supplies[0]
  const supply = { ...rawSupply, voltage: mainsVoltage }

  const totals = useMemo(() => {
    let totalW = 0
    let countedDevices = 0
    let missingDevices = 0
    const devices: PhaseDevice[] = []
    for (const e of equipment) {
      const { watts: w, source } = wattsWithSource(e)
      if (w > 0) {
        totalW += w
        countedDevices += 1
        devices.push({ id: e.id, name: e.name, watts: w, pinnedPhase: e.powerPhase, source })
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

  // #345 — Neutralleiterstrom-Schätzung (3-Phasen, 4-Leiter). Für lineare
  // Lasten mit um 120° versetzten, symmetrischen Spannungen gilt
  //   I_N = √(I1²+I2²+I3² − I1·I2 − I2·I3 − I3·I1).
  // Bei perfekter Symmetrie (I1=I2=I3) ist I_N = 0; je größer die Schieflast,
  // desto höher der Neutralleiterstrom — genau das, was klein bleiben soll.
  const perPhaseAmps = distribution.perPhaseWatts.map((w) => w / supply.voltage)
  const neutralAmps =
    supply.phases === 3 && perPhaseAmps.length === 3
      ? Math.sqrt(
          Math.max(
            0,
            perPhaseAmps[0] ** 2 +
              perPhaseAmps[1] ** 2 +
              perPhaseAmps[2] ** 2 -
              perPhaseAmps[0] * perPhaseAmps[1] -
              perPhaseAmps[1] * perPhaseAmps[2] -
              perPhaseAmps[2] * perPhaseAmps[0],
          ),
        )
      : 0

  // #345 — Generator-Sizing: Scheinleistung bei angenommenem Leistungsfaktor
  // 0,8 (typisch für gemischte AV-Last), inkl. der Sicherheits-Reserve. Plus
  // eine Empfehlung mit 25 % Kopffreiheit, damit der Generator nicht am Limit
  // läuft.
  const POWER_FACTOR = 0.8
  const generatorKva = totalWithMargin / POWER_FACTOR / 1000
  const generatorKvaRecommended = generatorKva * 1.25

  // #345 ff. — USV/Notstrom-Puffer.
  //  - USV-Kapazität (W) = Scheinleistung (VA) × Leistungsfaktor.
  //  - Pufferzeit ≈ (nutzbare Akku-Energie) / Last × 60. Lineare Näherung
  //    (ignoriert Peukert/Temperatur); Hersteller-Runtime-Kurven sind genauer,
  //    aber für die Planung reicht das. "nutzbar" deckt Wechselrichter-
  //    Wirkungsgrad + Entladetiefe ab.
  const upsCapacityW = upsVa * upsPf
  const upsLoadW = totals.totalW
  const upsLoadFraction = upsCapacityW > 0 ? upsLoadW / upsCapacityW : 0
  const upsOverloaded = upsLoadFraction > 1
  const recommendedVa = upsPf > 0 ? Math.ceil((upsLoadW / upsPf) * 1.25) : 0
  const batteryWh = battV * battAh * battCount
  const usableWh = batteryWh * (usablePercent / 100)
  const runtimeMin = upsLoadW > 0 ? (usableWh / upsLoadW) * 60 : 0
  // Reverse: Akku-Energie, die für die Zielpufferzeit nötig wäre.
  const requiredWhForTarget =
    usablePercent > 0 ? (upsLoadW * (targetMinutes / 60)) / (usablePercent / 100) : 0

  // #345 ff. — Spannungsfall auf der Zuleitung.
  //  - 1-phasig: ΔU = 2 · L · I · ρ / A   (Hin- + Rückleiter)
  //  - 3-phasig: ΔU = √3 · L · I · ρ / A
  // ρ(Kupfer) ≈ 0.0175 Ω·mm²/m. I = symmetrischer Laststrom (mit Reserve).
  const RHO_CU = 0.0175
  const vdropCurrent = supply.phases === 1 ? ampsSinglePhase : ampsThreePhase
  const vdropVolts =
    crossSection > 0
      ? ((supply.phases === 1 ? 2 : Math.sqrt(3)) * runLength * vdropCurrent * RHO_CU) / crossSection
      : 0
  const vdropPercent = supply.voltage > 0 ? (vdropVolts / supply.voltage) * 100 : 0

  // #345 — Wärmelast + CSV-Export der Phasen-Verteilung.
  const totalBtu = Math.round(totals.totalW * 3.412)
  const exportCsv = () => {
    const rows: (string | number)[][] = [
      [t('calc.col.device', 'Device'), 'W', t('calc.col.phase', 'Phase')],
      ...distribution.assignments.map((a) => [a.name, a.watts, `L${a.phase}`]),
      [],
      [t('calc.phaseLabel', 'Phase'), 'W', 'A'],
      ...distribution.perPhaseWatts.map((w, i) => [`L${i + 1}`, Math.round(w), (w / supply.voltage).toFixed(1)]),
      ...(supply.phases === 3 ? [['N', '', neutralAmps.toFixed(1)]] : []),
      [t('calc.power.total', 'Total'), Math.round(totals.totalW), ''],
      [t('calc.power.heat', 'Heat (BTU/h)'), totalBtu, ''],
      [t('calc.generator', 'Generator (PF 0.8)'), '', `${generatorKvaRecommended.toFixed(1)} kVA`],
    ]
    const csv = '\u{FEFF}' + rows.map((r) => r.map((c) => String(c ?? '')).join(';')).join('\r\n')
    downloadBlob(buildExportFilenameWithSuffix(projectName, 'strom-phasen', 'csv'), csv, 'text/csv')
  }

  // #345 — Strom-Verteilungs-Report als PDF (für den Elektriker): alle
  // berechneten Werte in einem Dokument — Zusammenfassung, Phasen-Balance,
  // Neutralleiter, Generator, Spannungsfall, USV, Geräte→Phase.
  const exportPdf = () => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const margin = 36
    let y = margin
    const line = (txt: string, size = 9, color = 40, dx = 0) => {
      if (y > 790) {
        pdf.addPage()
        y = margin
      }
      pdf.setFontSize(size)
      pdf.setTextColor(color)
      pdf.text(sanitizeForPdf(txt), margin + dx, y)
      y += size + 4
    }
    pdf.setFontSize(15)
    pdf.setTextColor(20)
    pdf.text(sanitizeForPdf(`${t('calc.pdf.title', 'Power distribution')} — ${projectName || 'Cable Planner'}`), margin, y)
    y += 20
    pdf.setFontSize(9)
    pdf.setTextColor(90)
    pdf.text(sanitizeForPdf(`${supply.label} · ${new Date().toLocaleString()}`), margin, y)
    y += 16
    pdf.setDrawColor(200)
    pdf.line(margin, y, pageW - margin, y)
    y += 14

    line(t('calc.pdf.summary', 'SUMMARY'), 11, 20)
    line(`${t('calc.pdf.totalUsage', 'Total usage')}: ${totals.totalW.toFixed(0)} W  ·  + ${marginPercent}% ${t('calc.pdf.reserve', 'Reserve')} = ${totalWithMargin.toFixed(0)} W (${(totalWithMargin / 1000).toFixed(2)} kW)`)
    if (supply.phases === 1) {
      line(`${t('calc.pdf.current1phase', 'Current (1-phase)')}: ${ampsSinglePhase.toFixed(1)} A  ·  ${t('calc.pdf.breakerMax', 'Breaker max')} ${supply.perPhaseAmps} A`)
    } else {
      line(`${t('calc.pdf.current3phase', 'Balanced (3-phase)')}: ${ampsThreePhase.toFixed(1)} A ${t('calc.pdf.perPhase', 'per phase')}  ·  ${t('calc.pdf.breakerMax', 'Breaker max')} ${supply.perPhaseAmps} A`)
    }
    line(`${t('calc.pdf.generator', 'Generator (cos phi 0.8)')}: ${generatorKva.toFixed(1)} kVA  ·  ${t('calc.pdf.recommended', 'recommended')} >= ${generatorKvaRecommended.toFixed(1)} kVA`)
    line(`${t('calc.pdf.heatCooling', 'Heat/cooling')}: ${totalBtu} BTU/h  ~ ${(totals.totalW / 1000).toFixed(1)} kW  ·  ${Math.max(1, Math.ceil(totalBtu / 12000))}x 12k-BTU-AC`)
    y += 6

    if (supply.phases === 3 && distribution.perPhaseWatts.length === 3) {
      line(t('calc.pdf.phaseBalance', 'PHASE BALANCE'), 11, 20)
      distribution.perPhaseWatts.forEach((w, i) => {
        const a = w / supply.voltage
        line(`L${i + 1}: ${Math.round(w)} W  ·  ${a.toFixed(1)} A  ·  ${Math.round((a / supply.perPhaseAmps) * 100)}% ${t('calc.pdf.load', 'Load')}`, 9, 40, 8)
      })
      line(`${t('calc.pdf.neutral', 'Neutral (estimated)')}: ${neutralAmps.toFixed(1)} A  ·  ${t('calc.pdf.imbalance', 'Imbalance')} ${maxImbalancePct}%`, 9, 40, 8)
      y += 6
    }

    line(t('calc.pdf.vdrop', 'VOLTAGE DROP (FEEDER)'), 11, 20)
    line(`${runLength} m  ·  ${crossSection} mm2 Cu  ·  ${vdropCurrent.toFixed(1)} A  ->  ${vdropVolts.toFixed(1)} V (${vdropPercent.toFixed(1)}%)  ·  ${t('calc.pdf.end', 'End')} ~${(supply.voltage - vdropVolts).toFixed(0)} V`, 9, 40, 8)
    y += 6

    line(t('calc.pdf.ups', 'UPS / EMERGENCY POWER'), 11, 20)
    line(`${upsVa} VA x PF ${upsPf} = ${Math.round(upsCapacityW)} W  ·  ${t('calc.pdf.load', 'Load')} ${upsLoadW.toFixed(0)} W (${Math.round(upsLoadFraction * 100)}%)  ·  ${t('calc.pdf.recShort', 'rec.')} >= ${recommendedVa} VA`, 9, 40, 8)
    line(`${t('calc.pdf.battery', 'Battery')} ${Math.round(batteryWh)} Wh (${Math.round(usableWh)} Wh ${t('calc.pdf.usable', 'usable')})  ->  ${t('calc.pdf.runtime', 'Runtime')} ~${runtimeMin <= 0 ? '-' : runtimeMin >= 60 ? `${Math.floor(runtimeMin / 60)} h ${Math.round(runtimeMin % 60)} min` : `${runtimeMin.toFixed(0)} min`}`, 9, 40, 8)
    y += 6

    line(`${t('calc.pdf.devicesToPhase', 'DEVICES -> PHASE')} (${distribution.assignments.length})`, 11, 20)
    for (const a of distribution.assignments) {
      line(`${a.pinned ? `[${t('calc.pdf.fixed', 'fixed')}] ` : ''}${a.name}  —  ${a.watts} W  —  L${a.phase}`, 8, 60, 8)
    }
    pdf.save(buildExportFilenameWithSuffix(projectName || 'cable-planner', 'stromverteilung', 'pdf'))
  }

  return (
    <div className="space-y-3 p-4 text-cp-base">
      <p className="text-cp-xs text-cp-text-muted">
        {t(
          'calc.power.intro1',
          'Sum of the consumption values in the device properties',
        )}{' '}
        (<code className="bg-cp-surface-2 px-1">{t('calc.power.wattsField', 'Power (W)')}</code>).{' '}
        {t(
          'calc.power.intro2',
          'Devices without a value are not counted; add them in the Properties so the distribution is correct.',
        )}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('calc.connectionType', 'Connection type')}</span>
          <select
            value={rawSupply.id}
            onChange={(e) => setSupplyId(e.target.value as SupplyPresetId)}
            className="w-full border border-cp-border bg-cp-surface-3 p-2"
          >
            {supplies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('calc.safetyReserve', 'Safety margin (%)')}</span>
          <input
            type="number"
            min={0}
            value={marginPercent}
            onChange={(e) => setMarginPercent(Math.max(0, Number(e.target.value) || 0))}
            className="w-full border border-cp-border bg-cp-surface-3 p-2"
          />
        </label>
      </div>

      <div className="border border-emerald-700 bg-emerald-950/30 p-3">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-cp-xs">
          <dt className="text-cp-text-faint">{t('calc.devicesCounted', 'Devices counted')}</dt>
          <dd className="font-mono text-cp-text-bright">
            {totals.countedDevices} {t('calc.outOf', 'of')} {totals.countedDevices + totals.missingDevices}
            {totals.missingDevices > 0 && (
              <span className="ml-2 text-amber-300">({totals.missingDevices} {t('calc.withoutValue', 'without value')})</span>
            )}
          </dd>
          <dt className="text-cp-text-faint">{t('calc.totalUsage', 'Total usage')}</dt>
          <dd className="font-mono text-cp-text-bright">{totals.totalW.toFixed(0)} W</dd>
          <dt className="text-cp-text-faint">+ {t('calc.reserve', 'reserve')} ({marginPercent}%)</dt>
          <dd className="font-mono text-emerald-200 text-cp-xl">
            {totalWithMargin.toFixed(0)} W · {(totalWithMargin / 1000).toFixed(2)} kW
          </dd>
          {supply.phases === 1 ? (
            <>
              <dt className="text-cp-text-faint">{t('calc.current1phase', 'Current (single-phase)')}</dt>
              <dd className="font-mono text-cp-text-bright">
                {ampsSinglePhase.toFixed(1)} A · max {supply.perPhaseAmps} A
              </dd>
            </>
          ) : (
            <>
              <dt className="text-cp-text-faint">{t('calc.current3phase', 'Symmetric (3-phase)')}</dt>
              <dd className="font-mono text-cp-text-bright">
                {ampsThreePhase.toFixed(1)} A · max {supply.perPhaseAmps} A {t('calc.perPhase', 'per phase')}
              </dd>
            </>
          )}
          <dt className="text-cp-text-faint">{t('calc.generator', 'Generator (PF 0.8)')}</dt>
          <dd className="font-mono text-cp-text-bright">
            {generatorKva.toFixed(1)} kVA ·{' '}
            <span className="text-emerald-200">
              {t('calc.generatorRec', 'rec.')} ≥ {generatorKvaRecommended.toFixed(1)} kVA
            </span>
          </dd>
          {/* Wärmelast → Kühlbedarf: die el. Leistung wird praktisch komplett
              in Wärme umgesetzt. AC-Einheiten zu je 12.000 BTU/h. */}
          <dt className="text-cp-text-faint">{t('calc.power.cooling', 'Heat / cooling')}</dt>
          <dd className="font-mono text-cp-text-bright">
            {totalBtu} BTU/h
            <span className="ml-2 text-cp-text-faint">
              ≈ {(totals.totalW / 1000).toFixed(1)} kW · {Math.max(1, Math.ceil(totalBtu / 12000))}× 12k-BTU-AC
            </span>
          </dd>
        </dl>
      </div>

      {/* Distro-Vergleich: welcher Anschluss trägt die Last? */}
      {totals.totalW > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-cp-xs">
          <span className="font-semibold uppercase tracking-wide text-cp-text-faint">
            {t('calc.power.fitsOn', 'Fits on')}:
          </span>
          {supplies.map((p) => {
            const amps = p.phases === 1 ? totalWithMargin / mainsVoltage : totalWithMargin / (mainsVoltage * Math.sqrt(3))
            const fits = amps <= p.perPhaseAmps
            return (
              <span
                key={p.id}
                title={`${amps.toFixed(1)} A / ${p.perPhaseAmps} A`}
                className={` px-1.5 py-0.5 font-mono ${fits ? 'bg-emerald-900/50 text-emerald-200' : 'bg-red-950/40 text-red-300/70'}`}
              >
                {fits ? '✓' : '✗'} {p.id.replace('powerlock-', 'PL').replace('cee', 'CEE').replace('schuko', 'Schuko')}
              </span>
            )
          })}
        </div>
      )}

      {supply.phases === 3 && totals.devices.length > 0 && (
        <div
          className={` border ${
            overloaded ? 'border-red-700 bg-red-950/30' : 'border-sky-700 bg-sky-950/20'
          } p-3`}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="text-cp-xs uppercase tracking-wide text-cp-text-secondary">
              {t('calc.phaseDistribution', 'Phase distribution')} ({supply.label})
            </div>
            <div className="text-cp-xs text-cp-text-muted">
              {t('calc.imbalance', 'Imbalance')}: {maxImbalancePct}%
              {overloaded && (
                <span className="ml-2 inline-flex items-center gap-1 bg-red-700 px-1.5 py-0.5 text-cp-xs text-white">
                  <Icon icon={AlertTriangle} size="xs" />
                  {t('calc.phaseOverload', 'Phase overloaded')}
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
                  className={` border ${PHASE_COLORS[PHASE_KEYS[idx]].border} ${PHASE_COLORS[PHASE_KEYS[idx]].bg} p-2`}
                >
                  <div
                    className={`flex items-center gap-1 text-cp-xs uppercase tracking-wider ${PHASE_COLORS[PHASE_KEYS[idx]].text}`}
                  >
                    <span
                      className="inline-block h-2 w-2"
                      style={{ background: PHASE_COLORS[PHASE_KEYS[idx]].dot }}
                      title={`${t('calc.euColor', 'EU colour code')} L${idx + 1}`}
                    />
                    {t('calc.phaseLabel', 'Phase')} L{idx + 1}
                  </div>
                  <div className="font-mono text-cp-lg text-cp-text">
                    {watts.toFixed(0)} W
                  </div>
                  <div className="font-mono text-cp-xs text-cp-text-secondary">
                    {amps.toFixed(1)} A / {supply.perPhaseAmps} A
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden bg-cp-surface-2">
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
                  <div className="mt-0.5 text-cp-xs text-cp-text-muted">
                    {Math.round(fraction * 100)}% {t('calc.load', 'load')}
                  </div>
                </div>
              )
            })}
          </div>
          {/* #345 — Neutralleiterstrom-Schätzung: klein = gut balanciert. */}
          <div className="mt-2 flex items-center gap-2 border border-sky-800 bg-sky-950/30 px-2 py-1.5 text-cp-xs">
            <span
              className="inline-block h-2 w-2 shrink-0"
              style={{ background: PHASE_COLORS.N.dot }}
            />
            <span className="text-cp-text-secondary">
              {t('calc.neutralCurrent', 'Neutral (estimated)')}:
            </span>
            <span className="font-mono text-sky-200">{neutralAmps.toFixed(1)} A</span>
            <span className="ml-auto text-cp-xs text-cp-text-muted">
              {neutralAmps < 0.05 * supply.perPhaseAmps
                ? t('calc.neutralOk', 'well balanced')
                : neutralAmps > 0.25 * supply.perPhaseAmps
                  ? t('calc.neutralHigh', 'high imbalance — rebalance phases')
                  : t('calc.neutralMid', 'slight imbalance')}
            </span>
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-cp-xs uppercase tracking-wide text-cp-text-muted hover:text-cp-text-bright">
              {t('calc.devicesToPhase', 'Devices → Phase')} ({distribution.assignments.length})
            </summary>
            <div className="mb-1 mt-1 text-cp-xs text-cp-text-muted">
              {t('calc.phasePinHint', 'Pick a phase to pin a device; "Auto" lets the balancer distribute it.')}
            </div>
            <table className="block overflow-x-auto w-full text-cp-xs">
              <thead className="text-cp-text-faint">
                <tr>
                  <th className="text-left">{t('calc.col.device', 'Device')}</th>
                  <th className="text-right">W</th>
                  <th className="text-right pr-2">{t('calc.col.phase', 'Phase')}</th>
                </tr>
              </thead>
              <tbody>
                {distribution.assignments.map((a, i) => (
                  <tr key={a.id ?? `${a.name}-${i}`} className="border-t border-cp-border-muted">
                    <td className="truncate py-0.5">
                      {a.name}
                      {a.pinned && (
                        <Icon icon={Pin} size={11} className="ml-1 inline text-cp-text-muted" label={t('calc.phasePinned', 'Pinned')} />
                      )}
                    </td>
                    <td className="text-right font-mono text-cp-text-muted">{a.watts}</td>
                    <td className="pr-2 text-right">
                      {a.id ? (
                        <select
                          value={a.pinned ? a.phase : 0}
                          onChange={(e) => {
                            const v = Number(e.target.value)
                            updateEquipment(a.id as string, {
                              powerPhase: v === 0 ? undefined : (v as 1 | 2 | 3),
                            })
                          }}
                          className={` border border-cp-border bg-cp-surface-3 py-0.5 pl-1 font-mono ${PHASE_COLORS[PHASE_KEYS[a.phase - 1]].text}`}
                          title={t('calc.col.phase', 'Phase')}
                        >
                          <option value={0}>{t('calc.phaseAuto', 'Auto')} (L{a.phase})</option>
                          {PHASE_KEYS.slice(0, supply.phases).map((_, idx) => (
                            <option key={idx} value={idx + 1}>L{idx + 1}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`font-mono font-semibold ${PHASE_COLORS[PHASE_KEYS[a.phase - 1]].text}`}>
                          L{a.phase}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-cp-xs text-cp-text-muted">
            <span className="font-semibold uppercase tracking-wide text-cp-text-faint">
              {t('calc.euColorTitle', 'EU colour code (DIN VDE 0293-308)')}:
            </span>
            {(['L1', 'L2', 'L3', 'N', 'PE'] as const).map((key) => (
              <span key={key} className="flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2"
                  style={{ background: PHASE_COLORS[key].dot }}
                />
                <span>{key}</span>
              </span>
            ))}
          </div>
          <PanelHint
            className="mt-2 text-cp-xs text-cp-text-muted"
            text={t(
              'calc.greedyExplain',
              'Greedy distribution: sorted by power, each device on the currently least-loaded phase. With symmetric loads three-phase draws only {amps} A per phase; imbalance raises the highest phase current. Target: every phase < 85% load + imbalance < 20%.',
            ).replace('{amps}', ampsThreePhase.toFixed(1))}
          />
          <div className="mt-3 flex items-center justify-between text-cp-xs">
            <span className="text-cp-text-muted">
              {t('calc.power.heat', 'Heat (BTU/h)')}:{' '}
              <span className="font-mono text-cp-text-bright">{totalBtu}</span>
            </span>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-1 bg-emerald-700 px-2 py-1 text-cp-xs font-medium text-white hover:bg-emerald-600"
            >
              <Icon icon={Download} size="xs" /> {t('analysis.exportCsv', 'Export CSV')}
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="inline-flex items-center gap-1 bg-amber-700 px-2 py-1 text-cp-xs font-medium text-white hover:bg-amber-600"
            >
              <Icon icon={Download} size="xs" /> {t('calc.power.exportPdf', 'PDF report')}
            </button>
          </div>
        </div>
      )}

      {/* #345 ff. — USV / Notstrom-Puffer-Rechner. Nutzt die Gesamtlast der
          Geräte (oben) und schätzt USV-Größe + Pufferzeit. */}
      <details className="border border-cp-border-muted bg-cp-surface-3/40" open={totals.totalW > 0}>
        <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-cp-xs uppercase tracking-wide text-cp-text-muted">
          <Icon icon={BatteryCharging} size="xs" />
          {t('calc.ups.title', 'UPS / battery backup')}
        </summary>
        <div className="space-y-3 px-3 py-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">
                {t('calc.ups.va', 'UPS rating (VA)')}
              </span>
              <input
                type="number"
                min={0}
                value={upsVa}
                onChange={(e) => setUpsVa(Math.max(0, Number(e.target.value) || 0))}
                className="w-full border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-xs"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">
                {t('calc.ups.pf', 'Power factor')}
              </span>
              <select
                value={upsPf}
                onChange={(e) => setUpsPf(Number(e.target.value))}
                className="w-full border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-xs"
              >
                {[0.6, 0.7, 0.8, 0.9, 1.0].map((pf) => (
                  <option key={pf} value={pf}>
                    {pf.toFixed(1)}
                  </option>
                ))}
              </select>
            </label>
            <div className="block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">
                {t('calc.ups.capacity', 'Capacity (W)')}
              </span>
              <div className="border border-cp-border-muted bg-cp-surface-1 px-2 py-1 font-mono text-cp-xs text-cp-text-bright">
                {Math.round(upsCapacityW)} W
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">
                {t('calc.ups.battV', 'Battery (V)')}
              </span>
              <input
                type="number"
                min={0}
                value={battV}
                onChange={(e) => setBattV(Math.max(0, Number(e.target.value) || 0))}
                className="w-full border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-xs"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">
                {t('calc.ups.battAh', 'Capacity (Ah)')}
              </span>
              <input
                type="number"
                min={0}
                value={battAh}
                onChange={(e) => setBattAh(Math.max(0, Number(e.target.value) || 0))}
                className="w-full border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-xs"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">
                {t('calc.ups.battCount', 'Battery count')}
              </span>
              <input
                type="number"
                min={1}
                value={battCount}
                onChange={(e) => setBattCount(Math.max(1, Number(e.target.value) || 1))}
                className="w-full border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-xs"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">
                {t('calc.ups.usable', 'Usable (%)')}
              </span>
              <input
                type="number"
                min={1}
                max={100}
                value={usablePercent}
                onChange={(e) =>
                  setUsablePercent(Math.min(100, Math.max(1, Number(e.target.value) || 1)))
                }
                className="w-full border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-xs"
              />
            </label>
          </div>

          <div
            className={` border p-3 ${
              upsOverloaded ? 'border-red-700 bg-red-950/30' : 'border-sky-700 bg-sky-950/20'
            }`}
          >
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-cp-xs">
              <dt className="text-cp-text-faint">{t('calc.ups.load', 'Load (measured)')}</dt>
              <dd className="font-mono text-cp-text-bright">{upsLoadW.toFixed(0)} W</dd>
              <dt className="text-cp-text-faint">{t('calc.ups.utilization', 'UPS utilisation')}</dt>
              <dd className="font-mono">
                <span className={upsOverloaded ? 'text-red-300' : 'text-cp-text-bright'}>
                  {Math.round(upsLoadFraction * 100)}%
                </span>
                {upsOverloaded && (
                  <span className="ml-2 inline-flex items-center gap-1 bg-red-700 px-1.5 py-0.5 text-cp-xs text-white">
                    <Icon icon={AlertTriangle} size="xs" />
                    {t('calc.ups.overload', 'UPS overloaded')}
                  </span>
                )}
              </dd>
              <dt className="text-cp-text-faint">{t('calc.ups.recommended', 'Recommended UPS')}</dt>
              <dd className="font-mono text-emerald-200">≥ {recommendedVa} VA</dd>
              <dt className="text-cp-text-faint">{t('calc.ups.battery', 'Battery energy')}</dt>
              <dd className="font-mono text-cp-text-bright">
                {Math.round(batteryWh)} Wh · {Math.round(usableWh)} Wh {t('calc.ups.usableShort', 'usable')}
              </dd>
              <dt className="text-cp-text-faint">{t('calc.ups.runtime', 'Runtime (estimated)')}</dt>
              <dd className="font-mono text-cp-xl text-emerald-200">
                {upsLoadW <= 0
                  ? '—'
                  : runtimeMin >= 60
                    ? `${Math.floor(runtimeMin / 60)} h ${Math.round(runtimeMin % 60)} min`
                    : `${runtimeMin.toFixed(0)} min`}
              </dd>
            </dl>
            <div className="mt-2 flex items-center gap-2 border-t border-cp-border-muted pt-2 text-cp-xs">
              <span className="text-cp-text-muted">{t('calc.ups.target', 'Target runtime')}</span>
              <input
                type="number"
                min={1}
                value={targetMinutes}
                onChange={(e) => setTargetMinutes(Math.max(1, Number(e.target.value) || 1))}
                className="w-16 border border-cp-border bg-cp-surface-3 px-1.5 py-0.5 text-cp-xs"
              />
              <span className="text-cp-text-muted">min →</span>
              <span className="font-mono text-cp-text-bright">
                {Math.round(requiredWhForTarget)} Wh {t('calc.ups.needed', 'battery needed')}
              </span>
            </div>
          </div>
          <PanelHint className="mb-2 text-cp-xs text-cp-text-muted" text={t(
          'calc.ups.note',
          'UPS capacity (W) = VA × power factor. Runtime ≈ usable battery energy / load. Linear approximation — real runtime depends on the discharge curve, battery age and temperature; check the manufacturer runtime chart when in doubt.',
        )} />
        </div>
      </details>

      {/* #345 ff. — Spannungsfall auf der Zuleitung (Distro-Strecke). */}
      <details className="border border-cp-border-muted bg-cp-surface-3/40">
        <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-cp-xs uppercase tracking-wide text-cp-text-muted">
          {t('calc.vdrop.title', 'Voltage drop (feeder)')}
        </summary>
        <div className="space-y-3 px-3 py-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">
                {t('calc.vdrop.length', 'Cable length (m)')}
              </span>
              <input
                type="number"
                min={0}
                value={runLength}
                onChange={(e) => setRunLength(Math.max(0, Number(e.target.value) || 0))}
                className="w-full border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-xs"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">
                {t('calc.vdrop.cross', 'Cross-section (mm²)')}
              </span>
              <select
                value={crossSection}
                onChange={(e) => setCrossSection(Number(e.target.value))}
                className="w-full border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-xs"
              >
                {[1.5, 2.5, 4, 6, 10, 16, 25, 35, 50].map((mm) => (
                  <option key={mm} value={mm}>
                    {mm} mm²
                  </option>
                ))}
              </select>
            </label>
            <div className="block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">
                {t('calc.vdrop.current', 'Load current')}
              </span>
              <div className="border border-cp-border-muted bg-cp-surface-1 px-2 py-1 font-mono text-cp-xs text-cp-text-bright">
                {vdropCurrent.toFixed(1)} A
              </div>
            </div>
          </div>
          <div
            className={` border p-3 ${
              vdropPercent > 5
                ? 'border-red-700 bg-red-950/30'
                : vdropPercent > 3
                  ? 'border-amber-700 bg-amber-950/30'
                  : 'border-emerald-700 bg-emerald-950/30'
            }`}
          >
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-cp-xs">
              <dt className="text-cp-text-faint">{t('calc.vdrop.drop', 'Voltage drop')}</dt>
              <dd className="font-mono text-cp-text-bright">
                {vdropVolts.toFixed(1)} V
              </dd>
              <dt className="text-cp-text-faint">{t('calc.vdrop.percent', 'Relative')}</dt>
              <dd className="font-mono text-cp-xl">
                <span
                  className={
                    vdropPercent > 5
                      ? 'text-red-300'
                      : vdropPercent > 3
                        ? 'text-amber-200'
                        : 'text-emerald-200'
                  }
                >
                  {vdropPercent.toFixed(1)} %
                </span>
                <span className="ml-2 text-cp-xs text-cp-text-muted">
                  {vdropPercent > 5
                    ? t('calc.vdrop.bad', '> 5 % — increase cross-section')
                    : vdropPercent > 3
                      ? t('calc.vdrop.warn', '> 3 % — borderline')
                      : t('calc.vdrop.ok', '≤ 3 % — ok')}
                </span>
              </dd>
              <dt className="text-cp-text-faint">{t('calc.vdrop.atLoad', 'Voltage at end')}</dt>
              <dd className="font-mono text-cp-text-bright">
                ≈ {(supply.voltage - vdropVolts).toFixed(0)} V
              </dd>
            </dl>
          </div>
          <PanelHint className="mb-2 text-cp-xs text-cp-text-muted" text={t(
          'calc.vdrop.note',
          'Copper, ρ ≈ 0.0175 Ω·mm²/m. 1-phase ΔU = 2·L·I·ρ/A, 3-phase ΔU = √3·L·I·ρ/A. Rule of thumb: ≤ 3 % at end devices. Load current = symmetric current incl. margin.',
        )} />
        </div>
      </details>

      {totals.devices.length > 0 && (
        <details className="border border-cp-border-muted bg-cp-surface-3/40">
          <summary className="cursor-pointer px-3 py-1.5 text-cp-xs uppercase tracking-wide text-cp-text-muted">
            {t('calc.topConsumers', 'Top consumers')}
          </summary>
          <ul className="px-3 py-2 text-cp-xs">
            {totals.devices.slice(0, 12).map((d) => (
              <li key={d.name} className="flex justify-between gap-2 border-b border-cp-border-muted py-0.5">
                <span className="truncate">{d.name}</span>
                <span className="flex shrink-0 items-baseline gap-1.5">
                  {/* E-8 — die Herkunft steht IN DERSELBEN ZEILE wie die Zahl,
                      nicht in einer Fussnote. Wer die Liste liest, liest sie
                      wegen der Zahlen; eine Herkunft daneben wird gelesen, eine
                      darunter nicht. */}
                  <span className="text-cp-text-faint">{wattsQuelleLabel(t, d.source)}</span>
                  <span className="font-mono text-cp-text-muted">{d.watts} W</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

/**
 * #403 — Bandbreite und Stromverbrauch sind jetzt ZWEI getrennte
 * Dialoge. Vorher tabten sie sich gemeinsam, was bedeutete: der User
 * konnte nicht beide gleichzeitig offen halten. Jetzt sind sie
 * unabhaengige Fenster mit eigenem uiStore-State.
 */
export const BandwidthCalculatorDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.bandwidthCalc.open)
  const close = useUiStore((s) => s.closeBandwidthCalc)
  return (
    <ModalShell
      open={open}
      onClose={close}
      title={t('calc.bandwidth.title', 'Calculate bandwidth')}
      titleIcon={<Icon icon={Calculator} size="sm" />}
      maxWidth="2xl"
      draggableKey="cable-planner:modal-pos:bandwidth-calc"
    >
      <BandwidthTab />
    </ModalShell>
  )
}

export const PowerCalculatorDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.powerCalc.open)
  const close = useUiStore((s) => s.closePowerCalc)
  return (
    <ModalShell
      open={open}
      onClose={close}
      title={t('calc.power.title', 'Power consumption')}
      titleIcon={<Icon icon={Calculator} size="sm" />}
      maxWidth="2xl"
      draggableKey="cable-planner:modal-pos:power-calc"
    >
      <PowerTab />
    </ModalShell>
  )
}
