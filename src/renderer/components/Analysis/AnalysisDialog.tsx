// Issues #346 / #351 / #352 — read-only Projekt-Analysen in einem Tab-Dialog
// (analog zur Calculators-„Hub"-Idee, aber projektbezogen statt generische
// Rechner). Alles rein lesend aus dem aktuellen Projekt — non-destruktiv.
//
//   • Gewicht & Wärme (#351): Gewicht (kg) + Wärmelast (BTU/h) je Kategorie.
//   • Netzwerk (#346): IP-Übersicht, Doppel-IP-Erkennung, VLAN-Zählung.
//   • Redundanz (#352): Single-Points-of-Failure-Heuristik (einzelne
//     Strom-/Uplink-Anbindung).
//
// Die 3-Phasen-Last-/Distro-Planung (#345) lebt weiterhin im Strom-Tab der
// Calculators (dort bereits implementiert) — hier nicht dupliziert.

import { useMemo, useState } from 'react'
import { BarChart3, Download } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { useTranslation, format } from '../../lib/i18n'
import { checkDanteName } from '../../lib/danteNaming'
import type { EquipmentItem } from '../../types/equipment'

type Tab = 'weight' | 'network' | 'redundancy' | 'rf'

/** Effektive Leistung eines Geräts: explizite Watt, sonst V×A. */
const effectiveWatts = (e: EquipmentItem): number =>
  e.powerConsumptionWatts ?? (e.voltage && e.currentAmps ? e.voltage * e.currentAmps : 0)

const WATT_TO_BTU = 3.412

/** Frequenz-String („5.8 GHz", „600 MHz", „614") → MHz (oder null). */
const parseFreqMHz = (s: string | undefined): number | null => {
  if (!s) return null
  const m = s.match(/([\d.]+)\s*(g|m|k)?hz/i) ?? s.match(/^([\d.]+)$/)
  if (!m) return null
  const value = parseFloat(m[1])
  if (Number.isNaN(value)) return null
  const unit = (m[2] ?? 'm').toLowerCase()
  return unit === 'g' ? value * 1000 : unit === 'k' ? value / 1000 : value
}

/** Mindestabstand (MHz) unter dem zwei Funkstrecken als Konflikt gelten. */
const RF_MIN_SPACING_MHZ = 0.4

/** Rows → CSV (Semikolon-getrennt, Excel-DE-freundlich, mit UTF-8-BOM). */
const toCsv = (rows: (string | number)[][]): string =>
  '﻿' +
  rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? '')
          return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(';'),
    )
    .join('\r\n')

const CsvButton = ({ onClick }: { onClick: () => void }) => {
  const t = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2 py-1 text-cp-xs font-medium text-white hover:bg-emerald-600"
    >
      <Icon icon={Download} size="xs" /> {t('analysis.exportCsv', 'CSV exportieren')}
    </button>
  )
}

/* ---------------------------------------------------------------- Weight -- */

const WeightTab = ({ projectName }: { projectName: string }) => {
  const t = useTranslation()
  const equipment = useProjectStore((s) => s.project.equipment)

  const { byCategory, totals, missingWeight, hasPrices } = useMemo(() => {
    const map = new Map<string, { count: number; kg: number; watts: number; eur: number }>()
    let missing = 0
    let anyPrice = false
    for (const e of equipment) {
      const cat = e.category || t('analysis.uncategorized', 'Ohne Kategorie')
      const row = map.get(cat) ?? { count: 0, kg: 0, watts: 0, eur: 0 }
      row.count += 1
      row.kg += e.weightKg ?? 0
      row.watts += effectiveWatts(e)
      // #354 — Wert/Angebots-Summe: Stückpreis × 1 (pro Gerät).
      if (typeof e.priceEUR === 'number') {
        row.eur += e.priceEUR
        anyPrice = true
      }
      map.set(cat, row)
      if (e.weightKg == null) missing += 1
    }
    const byCategory = [...map.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.kg - a.kg)
    const totals = byCategory.reduce(
      (acc, r) => ({
        count: acc.count + r.count,
        kg: acc.kg + r.kg,
        watts: acc.watts + r.watts,
        eur: acc.eur + r.eur,
      }),
      { count: 0, kg: 0, watts: 0, eur: 0 },
    )
    return { byCategory, totals, missingWeight: missing, hasPrices: anyPrice }
  }, [equipment, t])

  const exportCsv = () => {
    const priceHead = hasPrices ? [t('analysis.weight.eur', 'Wert (€)')] : []
    const priceCell = (eur: number) => (hasPrices ? [eur.toFixed(2)] : [])
    const rows: (string | number)[][] = [
      [
        t('analysis.weight.category', 'Kategorie'),
        t('analysis.weight.count', 'Anzahl'),
        t('analysis.weight.kg', 'Gewicht (kg)'),
        t('analysis.weight.watts', 'Leistung (W)'),
        t('analysis.weight.btu', 'Wärme (BTU/h)'),
        ...priceHead,
      ],
      ...byCategory.map((r) => [
        r.category,
        r.count,
        r.kg.toFixed(1),
        Math.round(r.watts),
        Math.round(r.watts * WATT_TO_BTU),
        ...priceCell(r.eur),
      ]),
      [
        t('analysis.total', 'Gesamt'),
        totals.count,
        totals.kg.toFixed(1),
        Math.round(totals.watts),
        Math.round(totals.watts * WATT_TO_BTU),
        ...priceCell(totals.eur),
      ],
    ]
    downloadBlob(buildExportFilenameWithSuffix(projectName, 'gewicht-waerme', 'csv'), toCsv(rows), 'text/csv')
  }

  return (
    <div className="space-y-3 p-4 text-sm">
      <p className="text-cp-xs text-[var(--cp-text-muted)]">
        {t(
          'analysis.weight.intro',
          'Gewicht (kg) und Wärmelast je Kategorie aus den Geräte-Eigenschaften. Wärme ≈ Leistung × 3,412 BTU/h.',
        )}
      </p>
      <table className="w-full text-cp-xs">
        <thead>
          <tr className="border-b border-[var(--cp-border)] text-left text-[var(--cp-text-muted)]">
            <th className="py-1 pr-2">{t('analysis.weight.category', 'Kategorie')}</th>
            <th className="py-1 pr-2 text-right">{t('analysis.weight.count', 'Anzahl')}</th>
            <th className="py-1 pr-2 text-right">{t('analysis.weight.kg', 'Gewicht (kg)')}</th>
            <th className="py-1 pr-2 text-right">{t('analysis.weight.watts', 'Leistung (W)')}</th>
            <th className={`py-1 text-right ${hasPrices ? 'pr-2' : ''}`}>{t('analysis.weight.btu', 'Wärme (BTU/h)')}</th>
            {hasPrices && <th className="py-1 text-right">{t('analysis.weight.eur', 'Wert (€)')}</th>}
          </tr>
        </thead>
        <tbody>
          {byCategory.map((r) => (
            <tr key={r.category} className="border-b border-[var(--cp-border-muted)]">
              <td className="py-1 pr-2">{r.category}</td>
              <td className="py-1 pr-2 text-right">{r.count}</td>
              <td className="py-1 pr-2 text-right">{r.kg.toFixed(1)}</td>
              <td className="py-1 pr-2 text-right">{Math.round(r.watts)}</td>
              <td className={`py-1 text-right ${hasPrices ? 'pr-2' : ''}`}>{Math.round(r.watts * WATT_TO_BTU)}</td>
              {hasPrices && <td className="py-1 text-right">{r.eur.toFixed(2)}</td>}
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-1 pr-2">{t('analysis.total', 'Gesamt')}</td>
            <td className="py-1 pr-2 text-right">{totals.count}</td>
            <td className="py-1 pr-2 text-right">{totals.kg.toFixed(1)}</td>
            <td className="py-1 pr-2 text-right">{Math.round(totals.watts)}</td>
            <td className={`py-1 text-right ${hasPrices ? 'pr-2' : ''}`}>{Math.round(totals.watts * WATT_TO_BTU)}</td>
            {hasPrices && <td className="py-1 text-right">{totals.eur.toFixed(2)}</td>}
          </tr>
        </tbody>
      </table>
      {missingWeight > 0 && (
        <p className="text-cp-xs text-[var(--cp-text-faint)]">
          {format(t('analysis.weight.missing', '{n} Gerät(e) ohne Gewichtsangabe — in den Eigenschaften ergänzen.'), {
            n: missingWeight,
          })}
        </p>
      )}
      <div className="flex justify-end">
        <CsvButton onClick={exportCsv} />
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- Network -- */

const NetworkTab = ({ projectName }: { projectName: string }) => {
  const t = useTranslation()
  const equipment = useProjectStore((s) => s.project.equipment)

  const { rows, duplicates, vlanCounts, danteIssues } = useMemo(() => {
    const rows = equipment
      .filter((e) => e.ipAddress || e.managementVlanId != null || (e.vlans?.length ?? 0) > 0)
      .map((e) => ({
        name: e.name,
        ip: e.ipAddress ?? '',
        mgmtVlan: e.managementVlanId != null ? String(e.managementVlanId) : '',
        vlans: (e.vlans ?? []).map((v) => v.id).join(', '),
      }))
    const ipMap = new Map<string, string[]>()
    for (const r of rows) {
      if (!r.ip) continue
      ipMap.set(r.ip, [...(ipMap.get(r.ip) ?? []), r.name])
    }
    const duplicates = [...ipMap.entries()].filter(([, names]) => names.length > 1)
    const vlanMap = new Map<number, number>()
    for (const e of equipment) {
      if (e.managementVlanId != null) vlanMap.set(e.managementVlanId, (vlanMap.get(e.managementVlanId) ?? 0) + 1)
      for (const v of e.vlans ?? []) vlanMap.set(v.id, (vlanMap.get(v.id) ?? 0) + 1)
    }
    const vlanCounts = [...vlanMap.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => a.id - b.id)
    // #346 — Dante-/AES67-Naming-Check fuer netzwerkfaehige Geraete: Namen
    // muessen DNS-safe sein (<=31 Zeichen, a-z/0-9/-). Verstoesse + Vorschlag.
    const danteIssues = rows
      .map((r) => ({ name: r.name, check: checkDanteName(r.name) }))
      .filter((x) => !x.check.valid)
    return { rows, duplicates, vlanCounts, danteIssues }
  }, [equipment])

  const exportCsv = () => {
    const csvRows: (string | number)[][] = [
      [t('analysis.network.device', 'Gerät'), 'IP', t('analysis.network.mgmtVlan', 'Mgmt-VLAN'), 'VLANs'],
      ...rows.map((r) => [r.name, r.ip, r.mgmtVlan, r.vlans]),
    ]
    downloadBlob(buildExportFilenameWithSuffix(projectName, 'netzwerk', 'csv'), toCsv(csvRows), 'text/csv')
  }

  return (
    <div className="space-y-3 p-4 text-sm">
      <p className="text-cp-xs text-[var(--cp-text-muted)]">
        {t('analysis.network.intro', 'IP-/VLAN-Übersicht aller netzwerkfähigen Geräte mit Doppel-IP-Prüfung.')}
      </p>
      {duplicates.length > 0 && (
        <div className="rounded border border-red-700/60 bg-red-900/30 p-2 text-cp-xs text-red-200">
          <div className="mb-1 font-semibold">{t('analysis.network.dupTitle', 'Doppelte IP-Adressen')}</div>
          <ul className="list-inside list-disc">
            {duplicates.map(([ip, names]) => (
              <li key={ip}>
                <span className="font-mono">{ip}</span>: {names.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}
      {danteIssues.length > 0 && (
        <div className="rounded border border-amber-700/60 bg-amber-900/20 p-2 text-cp-xs text-amber-200">
          <div className="mb-1 font-semibold">
            {t('analysis.network.danteTitle', 'Dante-/AES67-Namen prüfen (≤31 Zeichen, a–z/0–9/-)')}
          </div>
          <ul className="list-inside list-disc">
            {danteIssues.map((x) => (
              <li key={x.name}>
                <span className="font-mono">{x.name || '∅'}</span>: {x.check.issues.join(', ')} →{' '}
                <span className="font-mono text-amber-100">{x.check.suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <table className="w-full text-cp-xs">
        <thead>
          <tr className="border-b border-[var(--cp-border)] text-left text-[var(--cp-text-muted)]">
            <th className="py-1 pr-2">{t('analysis.network.device', 'Gerät')}</th>
            <th className="py-1 pr-2">IP</th>
            <th className="py-1 pr-2">{t('analysis.network.mgmtVlan', 'Mgmt-VLAN')}</th>
            <th className="py-1">VLANs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.name}-${i}`} className="border-b border-[var(--cp-border-muted)]">
              <td className="py-1 pr-2">{r.name}</td>
              <td className="py-1 pr-2 font-mono">{r.ip}</td>
              <td className="py-1 pr-2">{r.mgmtVlan}</td>
              <td className="py-1">{r.vlans}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-2 text-[var(--cp-text-faint)]">
                {t('analysis.network.empty', 'Keine Geräte mit Netzwerk-Daten.')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {vlanCounts.length > 0 && (
        <p className="text-cp-xs text-[var(--cp-text-faint)]">
          {t('analysis.network.vlanSummary', 'Geräte je VLAN')}:{' '}
          {vlanCounts.map((v) => `VLAN ${v.id} (${v.count})`).join(' · ')}
        </p>
      )}
      <div className="flex justify-end">
        <CsvButton onClick={exportCsv} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ Redundancy -- */

const RedundancyTab = ({ projectName }: { projectName: string }) => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)

  const flagged = useMemo(() => {
    // Anzahl Kabel je Gerät, gruppiert nach Layer.
    const byDevice = new Map<string, { power: number; network: number; total: number }>()
    const bump = (id: string, key: 'power' | 'network') => {
      const row = byDevice.get(id) ?? { power: 0, network: 0, total: 0 }
      row[key] += 1
      row.total += 1
      byDevice.set(id, row)
    }
    for (const c of project.cables) {
      const layer = (c.layer ?? '').toLowerCase()
      const key = layer.includes('power') || layer.includes('strom') ? 'power' : layer.includes('network') || layer.includes('netz') ? 'network' : null
      if (!key) continue
      bump(c.fromEquipmentId, key)
      bump(c.toEquipmentId, key)
    }
    const out: { name: string; reason: string }[] = []
    for (const e of project.equipment) {
      const row = byDevice.get(e.id) ?? { power: 0, network: 0, total: 0 }
      // Single PSU feed: zieht Strom, hat aber ≤1 Strom-Anbindung.
      if (effectiveWatts(e) > 0 && row.power <= 1) {
        out.push({
          name: e.name,
          reason:
            row.power === 0
              ? t('analysis.redundancy.noPower', 'keine Strom-Anbindung im Plan')
              : t('analysis.redundancy.singlePower', 'nur eine Strom-Anbindung (keine Netzteil-Redundanz)'),
        })
      }
    }
    return out
  }, [project, t])

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      [t('analysis.redundancy.device', 'Gerät'), t('analysis.redundancy.finding', 'Befund')],
      ...flagged.map((f) => [f.name, f.reason]),
    ]
    downloadBlob(buildExportFilenameWithSuffix(projectName, 'redundanz', 'csv'), toCsv(rows), 'text/csv')
  }

  return (
    <div className="space-y-3 p-4 text-sm">
      <p className="text-cp-xs text-[var(--cp-text-muted)]">
        {t(
          'analysis.redundancy.intro',
          'Heuristik für mögliche Single-Points-of-Failure: Geräte mit Stromaufnahme, aber höchstens einer Strom-Anbindung (Layer „Power").',
        )}
      </p>
      {flagged.length === 0 ? (
        <p className="text-cp-xs text-emerald-300">
          {t('analysis.redundancy.none', 'Keine offensichtlichen Single-Power-Feeds gefunden.')}
        </p>
      ) : (
        <table className="w-full text-cp-xs">
          <thead>
            <tr className="border-b border-[var(--cp-border)] text-left text-[var(--cp-text-muted)]">
              <th className="py-1 pr-2">{t('analysis.redundancy.device', 'Gerät')}</th>
              <th className="py-1">{t('analysis.redundancy.finding', 'Befund')}</th>
            </tr>
          </thead>
          <tbody>
            {flagged.map((f, i) => (
              <tr key={`${f.name}-${i}`} className="border-b border-[var(--cp-border-muted)]">
                <td className="py-1 pr-2">{f.name}</td>
                <td className="py-1 text-amber-300">{f.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex justify-end">
        <CsvButton onClick={exportCsv} />
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------- RF -- */

const RfTab = ({ projectName }: { projectName: string }) => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)

  const { links, conflicts } = useMemo(() => {
    const nameOf = new Map(project.equipment.map((e) => [e.id, e.name]))
    const links = project.cables
      .filter((c) => c.wireless || parseFreqMHz(c.frequency) != null)
      .map((c) => ({
        name: c.name || '—',
        frequency: c.frequency ?? '',
        mhz: parseFreqMHz(c.frequency),
        channel: c.wifiChannel ?? '',
        from: nameOf.get(c.fromEquipmentId) ?? '?',
        to: nameOf.get(c.toEquipmentId) ?? '?',
      }))
    const conflicts: string[] = []
    for (let i = 0; i < links.length; i++) {
      for (let j = i + 1; j < links.length; j++) {
        const a = links[i]
        const b = links[j]
        if (a.mhz != null && b.mhz != null && Math.abs(a.mhz - b.mhz) < RF_MIN_SPACING_MHZ) {
          conflicts.push(
            format(t('analysis.rf.conflictClose', '{a} ↔ {b}: Frequenzen < {mhz} MHz auseinander'), {
              a: a.name,
              b: b.name,
              mhz: RF_MIN_SPACING_MHZ,
            }),
          )
        } else if (a.channel && a.channel === b.channel) {
          conflicts.push(
            format(t('analysis.rf.conflictChannel', '{a} ↔ {b}: gleicher Kanal {ch}'), {
              a: a.name,
              b: b.name,
              ch: a.channel,
            }),
          )
        }
      }
    }
    return { links, conflicts }
  }, [project, t])

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      [
        t('analysis.rf.link', 'Funkstrecke'),
        t('analysis.rf.freq', 'Frequenz'),
        t('analysis.rf.channel', 'Kanal'),
        t('analysis.rf.from', 'Von'),
        t('analysis.rf.to', 'Nach'),
      ],
      ...links.map((l) => [l.name, l.frequency, l.channel, l.from, l.to]),
    ]
    downloadBlob(buildExportFilenameWithSuffix(projectName, 'rf-plan', 'csv'), toCsv(rows), 'text/csv')
  }

  return (
    <div className="space-y-3 p-4 text-sm">
      <p className="text-cp-xs text-[var(--cp-text-muted)]">
        {t(
          'analysis.rf.intro',
          'Funkstrecken (Wireless-Kabel) mit Frequenz/Kanal. Konflikt-Heuristik: Frequenzabstand < 0,4 MHz oder gleicher Kanal. Volle Intermod-Koordination ist separat geplant.',
        )}
      </p>
      {conflicts.length > 0 && (
        <div className="rounded border border-red-700/60 bg-red-900/30 p-2 text-cp-xs text-red-200">
          <div className="mb-1 font-semibold">{t('analysis.rf.conflictTitle', 'Mögliche RF-Konflikte')}</div>
          <ul className="list-inside list-disc">
            {conflicts.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      <table className="w-full text-cp-xs">
        <thead>
          <tr className="border-b border-[var(--cp-border)] text-left text-[var(--cp-text-muted)]">
            <th className="py-1 pr-2">{t('analysis.rf.link', 'Funkstrecke')}</th>
            <th className="py-1 pr-2">{t('analysis.rf.freq', 'Frequenz')}</th>
            <th className="py-1 pr-2">{t('analysis.rf.channel', 'Kanal')}</th>
            <th className="py-1 pr-2">{t('analysis.rf.from', 'Von')}</th>
            <th className="py-1">{t('analysis.rf.to', 'Nach')}</th>
          </tr>
        </thead>
        <tbody>
          {links.map((l, i) => (
            <tr key={`${l.name}-${i}`} className="border-b border-[var(--cp-border-muted)]">
              <td className="py-1 pr-2">{l.name}</td>
              <td className="py-1 pr-2 font-mono">{l.frequency}</td>
              <td className="py-1 pr-2">{l.channel}</td>
              <td className="py-1 pr-2">{l.from}</td>
              <td className="py-1">{l.to}</td>
            </tr>
          ))}
          {links.length === 0 && (
            <tr>
              <td colSpan={5} className="py-2 text-[var(--cp-text-faint)]">
                {t('analysis.rf.empty', 'Keine Funkstrecken im Plan.')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex justify-end">
        <CsvButton onClick={exportCsv} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- Container -- */

const TABS: { id: Tab; labelKey: string; fallback: string }[] = [
  { id: 'weight', labelKey: 'analysis.tab.weight', fallback: 'Gewicht & Wärme' },
  { id: 'network', labelKey: 'analysis.tab.network', fallback: 'Netzwerk' },
  { id: 'redundancy', labelKey: 'analysis.tab.redundancy', fallback: 'Redundanz' },
  { id: 'rf', labelKey: 'analysis.tab.rf', fallback: 'RF / Funk' },
]

export const AnalysisDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.analysis.open)
  const close = useUiStore((s) => s.closeAnalysis)
  const projectName = useProjectStore((s) => s.project.metadata.name)
  const [active, setActive] = useState<Tab>('weight')

  if (!open) return null

  return (
    <ModalShell
      open={open}
      onClose={close}
      maxWidth="4xl"
      titleIcon={<Icon icon={BarChart3} size="md" />}
      title={t('analysis.title', 'Analysen')}
    >
      <div className="mb-3 flex gap-1 border-b border-[var(--cp-border)]">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setActive(tb.id)}
            className={`rounded-t px-3 py-1.5 text-cp-xs ${
              active === tb.id
                ? 'bg-[var(--cp-surface-2)] font-semibold text-[var(--cp-text)]'
                : 'text-[var(--cp-text-muted)] hover:text-[var(--cp-text)]'
            }`}
          >
            {t(tb.labelKey, tb.fallback)}
          </button>
        ))}
      </div>
      {active === 'weight' && <WeightTab projectName={projectName} />}
      {active === 'network' && <NetworkTab projectName={projectName} />}
      {active === 'redundancy' && <RedundancyTab projectName={projectName} />}
      {active === 'rf' && <RfTab projectName={projectName} />}
    </ModalShell>
  )
}
