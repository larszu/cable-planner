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
import { effectiveDeviceResources } from '../../lib/equipmentSelectors'
import { checkDanteName } from '../../lib/danteNaming'
import { subnetCidr } from '../../lib/subnet'
import { RF_BANDS, bandsForFrequency, bandLabel } from '../../lib/rfBands'
import type { EquipmentItem } from '../../types/equipment'

type Tab = 'weight' | 'network' | 'redundancy' | 'rf'

/** Effektive Leistung eines Geräts: aktiver Modus (#124) > explizite Watt > V×A. */
const effectiveWatts = (e: EquipmentItem): number => {
  const modePower = e.activeModeId
    ? e.modes?.find((m) => m.id === e.activeModeId)?.powerWatts
    : undefined
  return (
    modePower ??
    e.powerConsumptionWatts ??
    (e.voltage && e.currentAmps ? e.voltage * e.currentAmps : 0)
  )
}

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

  const { byCategory, totals, missingWeight, hasPrices, heaviest } = useMemo(() => {
    const map = new Map<string, { count: number; kg: number; watts: number; eur: number }>()
    let missing = 0
    let anyPrice = false
    for (const e of equipment) {
      const cat = e.category || t('analysis.uncategorized', 'Ohne Kategorie')
      const row = map.get(cat) ?? { count: 0, kg: 0, watts: 0, eur: 0 }
      row.count += 1
      row.kg += effectiveDeviceResources(e).weightKg ?? 0
      row.watts += effectiveWatts(e)
      // #354 — Wert/Angebots-Summe: Stückpreis × 1 (pro Gerät).
      if (typeof e.priceEUR === 'number') {
        row.eur += e.priceEUR
        anyPrice = true
      }
      map.set(cat, row)
      if (effectiveDeviceResources(e).weightKg == null) missing += 1
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
    // Schwerste Geräte (für Rigging/Transport-Planung).
    const heaviest = equipment
      .map((e) => ({ name: e.name, kg: effectiveDeviceResources(e).weightKg ?? 0 }))
      .filter((e) => e.kg > 0)
      .sort((a, b) => b.kg - a.kg)
      .slice(0, 8)
    return { byCategory, totals, missingWeight: missing, hasPrices: anyPrice, heaviest }
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
    <div className="space-y-3 p-4 text-cp-base">
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
      {heaviest.length > 0 && (
        <div className="rounded border border-[var(--cp-border-muted)] bg-[var(--cp-surface-3)] p-2 text-cp-xs">
          <div className="mb-1 font-semibold text-[var(--cp-text-muted)]">
            {t('analysis.weight.heaviest', 'Schwerste Geräte (Rigging/Transport)')}
          </div>
          <ul className="space-y-0.5">
            {heaviest.map((d, i) => (
              <li key={`${d.name}-${i}`} className="flex justify-between">
                <span className="truncate">{d.name}</span>
                <span className="font-mono text-[var(--cp-text-muted)]">{d.kg.toFixed(1)} kg</span>
              </li>
            ))}
          </ul>
        </div>
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

  const { rows, duplicates, vlanCounts, danteIssues, subnets } = useMemo(() => {
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
    // #346 — IPAM: Geräte nach Subnetz gruppieren. Maske aus dem Gerät, sonst
    // /24 annehmen (häufigster Default). Markiert, wenn Maske geraten wurde.
    const subnetMap = new Map<string, { names: string[]; assumed: boolean }>()
    for (const e of equipment) {
      if (!e.ipAddress) continue
      const hasMask = !!e.subnetMask
      const cidr = subnetCidr(e.ipAddress, e.subnetMask || '255.255.255.0')
      if (!cidr) continue
      const entry = subnetMap.get(cidr) ?? { names: [], assumed: false }
      entry.names.push(e.name)
      if (!hasMask) entry.assumed = true
      subnetMap.set(cidr, entry)
    }
    const subnets = [...subnetMap.entries()]
      .map(([cidr, v]) => ({ cidr, names: v.names, assumed: v.assumed }))
      .sort((a, b) => a.cidr.localeCompare(b.cidr, undefined, { numeric: true }))
    return { rows, duplicates, vlanCounts, danteIssues, subnets }
  }, [equipment])

  const exportCsv = () => {
    const csvRows: (string | number)[][] = [
      [t('analysis.network.device', 'Gerät'), 'IP', t('analysis.network.mgmtVlan', 'Mgmt-VLAN'), 'VLANs'],
      ...rows.map((r) => [r.name, r.ip, r.mgmtVlan, r.vlans]),
    ]
    downloadBlob(buildExportFilenameWithSuffix(projectName, 'netzwerk', 'csv'), toCsv(csvRows), 'text/csv')
  }

  return (
    <div className="space-y-3 p-4 text-cp-base">
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
      {/* #346 — IPAM: Subnetz-Übersicht. */}
      {subnets.length > 0 && (
        <div className="rounded border border-[var(--cp-border-muted)] bg-[var(--cp-surface-3)] p-2 text-cp-xs">
          <div className="mb-1 font-semibold text-[var(--cp-text-muted)]">
            {t('analysis.network.subnets', 'Subnetze')} ({subnets.length})
          </div>
          <ul className="space-y-0.5">
            {subnets.map((s) => (
              <li key={s.cidr} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono font-semibold">{s.cidr}</span>
                <span className="text-[var(--cp-text-muted)]">
                  {format(t('analysis.network.subnetCount', '{n} Geräte'), { n: s.names.length })}
                </span>
                {s.assumed && (
                  <span className="text-[10px] text-amber-300/80" title={t('analysis.network.subnetAssumedTitle', 'Keine Maske gesetzt — /24 angenommen')}>
                    {t('analysis.network.subnetAssumed', '(/24 angenommen)')}
                  </span>
                )}
                <span className="text-[10px] text-[var(--cp-text-faint)]">
                  {s.names.slice(0, 6).join(', ')}
                  {s.names.length > 6 ? ` +${s.names.length - 6}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
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
    // Anzahl Kabel je Gerät, gruppiert nach Layer; plus ST-2110-Touch.
    const byDevice = new Map<string, { power: number; network: number; st2110: boolean }>()
    const get = (id: string) => {
      let r = byDevice.get(id)
      if (!r) {
        r = { power: 0, network: 0, st2110: false }
        byDevice.set(id, r)
      }
      return r
    }
    for (const c of project.cables) {
      const layer = (c.layer ?? '').toLowerCase()
      const std = c.standard ?? ''
      const isPower = layer.includes('power') || layer.includes('strom')
      const isNet =
        layer.includes('network') ||
        layer.includes('netz') ||
        std.startsWith('ST2110') ||
        std.startsWith('Eth') ||
        std === 'NDI' ||
        std === 'NDI-HX' ||
        std === 'Dante' ||
        std === 'AES67'
      const isSt = std.startsWith('ST2110')
      for (const id of [c.fromEquipmentId, c.toEquipmentId]) {
        const r = get(id)
        if (isPower) r.power += 1
        if (isNet) r.network += 1
        if (isSt) r.st2110 = true
      }
    }
    const out: { name: string; reason: string }[] = []
    for (const e of project.equipment) {
      const row = byDevice.get(e.id) ?? { power: 0, network: 0, st2110: false }
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
      // #352 — ST 2110-7: Geräte im 2110-Pfad sollten zwei unabhängige
      // Netzwerk-Pfade (Red/Blue) haben. Nur ein Netzwerk-Link → keine
      // nahtlose Protection.
      if (row.st2110 && row.network <= 1) {
        out.push({
          name: e.name,
          reason: t('analysis.redundancy.st2110', 'ST 2110 ohne 2110-7-Redundanz (nur ein Netzwerk-Pfad)'),
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
    <div className="space-y-3 p-4 text-cp-base">
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

/** #344 — Freie Frequenzen in einem Band finden: ≥ Schutzabstand zu allen
 *  belegten Frequenzen UND frei von 3.-Ordnung-Intermodulation (das Produkt
 *  darf keine belegte Frequenz treffen, und die neue Frequenz darf mit den
 *  belegten keine IM3 auf einer belegten erzeugen). Vorschläge sind zudem
 *  untereinander kompatibel (jeder Treffer wird in die Arbeitsmenge gelegt). */
const suggestFreqs = (fromMHz: number, toMHz: number, occupied: number[], count: number): number[] => {
  const guard = RF_MIN_SPACING_MHZ
  const step = 0.1
  const used = [...occupied]
  const out: number[] = []
  for (let f = Math.ceil(fromMHz / step) * step; f <= toMHz + 1e-9; f += step) {
    const fr = Math.round(f * 10) / 10
    if (used.some((u) => Math.abs(u - fr) < guard)) continue
    let bad = false
    // fr darf nicht auf einem IM3-Produkt zweier belegter Frequenzen liegen.
    for (let i = 0; i < used.length && !bad; i++)
      for (let j = 0; j < used.length && !bad; j++) {
        if (i === j) continue
        if (Math.abs(2 * used[i] - used[j] - fr) < guard) bad = true
      }
    // fr neu: erzeugt 2·fr−u bzw. 2·u−fr eine Kollision mit einer belegten?
    for (let i = 0; i < used.length && !bad; i++) {
      const p1 = 2 * fr - used[i]
      const p2 = 2 * used[i] - fr
      if (used.some((u) => u !== used[i] && (Math.abs(p1 - u) < guard || Math.abs(p2 - u) < guard)))
        bad = true
    }
    if (bad) continue
    out.push(fr)
    used.push(fr)
    if (out.length >= count) break
  }
  return out
}

const RfTab = ({ projectName }: { projectName: string }) => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const [bandIdx, setBandIdx] = useState(0)

  const { links, conflicts, imConflicts } = useMemo(() => {
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
    // #344 — 3.-Ordnung-Intermodulation (2·fi − fj). Diese Produkte fallen
    // typischerweise nahe an die Arbeitsfrequenzen anderer Sender und sind die
    // häufigste Störquelle bei Funkmikros/IEM. Treffer = Produkt liegt im
    // Schutzabstand einer ECHTEN Arbeitsfrequenz (außer den zwei Erzeugern).
    const freqs = links
      .map((l, idx) => ({ idx, name: l.name, mhz: l.mhz }))
      .filter((l): l is { idx: number; name: string; mhz: number } => l.mhz != null)
    const seen = new Set<string>()
    const imConflicts: string[] = []
    for (let i = 0; i < freqs.length; i++) {
      for (let j = 0; j < freqs.length; j++) {
        if (i === j) continue
        const prod = 2 * freqs[i].mhz - freqs[j].mhz
        if (prod <= 0) continue
        for (let k = 0; k < freqs.length; k++) {
          if (k === i || k === j) continue
          if (Math.abs(prod - freqs[k].mhz) <= RF_MIN_SPACING_MHZ) {
            const key = [freqs[i].idx, freqs[j].idx, freqs[k].idx].join('-')
            if (seen.has(key)) continue
            seen.add(key)
            imConflicts.push(
              format(
                t('analysis.rf.im3', 'IM3: 2×{a} − {b} = {prod} MHz trifft {c} ({cmhz} MHz)'),
                {
                  a: freqs[i].name,
                  b: freqs[j].name,
                  prod: prod.toFixed(2),
                  c: freqs[k].name,
                  cmhz: freqs[k].mhz,
                },
              ),
            )
          }
        }
      }
    }
    return { links, conflicts, imConflicts }
  }, [project, t])

  const suggestion = useMemo(() => {
    const band = RF_BANDS[bandIdx] ?? RF_BANDS[0]
    const occupied = links.map((l) => l.mhz).filter((m): m is number => m != null)
    return { band, freqs: suggestFreqs(band.fromMHz, band.toMHz, occupied, 8) }
  }, [bandIdx, links])

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      [
        t('analysis.rf.link', 'Funkstrecke'),
        t('analysis.rf.freq', 'Frequenz'),
        t('analysis.rf.band', 'Band'),
        t('analysis.rf.channel', 'Kanal'),
        t('analysis.rf.from', 'Von'),
        t('analysis.rf.to', 'Nach'),
      ],
      ...links.map((l) => [
        l.name,
        l.frequency,
        bandsForFrequency(l.mhz).filter((b) => !b.mfr.startsWith('Regulatorisch')).map(bandLabel).join(' / '),
        l.channel,
        l.from,
        l.to,
      ]),
    ]
    downloadBlob(buildExportFilenameWithSuffix(projectName, 'rf-plan', 'csv'), toCsv(rows), 'text/csv')
  }

  return (
    <div className="space-y-3 p-4 text-cp-base">
      <p className="text-cp-xs text-[var(--cp-text-muted)]">
        {t(
          'analysis.rf.intro',
          'Funkstrecken (Wireless-Kabel) mit Frequenz/Kanal. Konflikt-Heuristik: Frequenzabstand < 0,4 MHz oder gleicher Kanal. Zusätzlich 3.-Ordnung-Intermodulation (2·f₁−f₂) — die häufigste Störquelle bei Funkmikros/IEM.',
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
      {imConflicts.length > 0 && (
        <div className="rounded border border-amber-700/60 bg-amber-900/30 p-2 text-cp-xs text-amber-200">
          <div className="mb-1 font-semibold">
            {t('analysis.rf.imTitle', 'Intermodulation 3. Ordnung')} ({imConflicts.length})
          </div>
          <ul className="list-inside list-disc">
            {imConflicts.slice(0, 20).map((c, i) => (
              <li key={i} className="font-mono">{c}</li>
            ))}
            {imConflicts.length > 20 && (
              <li className="text-amber-300/80">
                {format(t('analysis.rf.imMore', '+{n} weitere'), { n: imConflicts.length - 20 })}
              </li>
            )}
          </ul>
        </div>
      )}
      {/* #344 — Freie-Frequenz-Vorschlag im gewählten Band. */}
      <div className="rounded border border-emerald-700/60 bg-emerald-950/20 p-2 text-cp-xs">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[var(--cp-text-muted)]">
            {t('analysis.rf.suggestTitle', 'Freie Frequenzen im Band')}
          </span>
          <select
            value={bandIdx}
            onChange={(e) => setBandIdx(Number(e.target.value))}
            className="rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] px-1.5 py-0.5"
          >
            {RF_BANDS.map((b, i) => (
              <option key={i} value={i}>
                {b.mfr} {b.band} ({b.fromMHz}–{b.toMHz})
              </option>
            ))}
          </select>
        </div>
        {suggestion.freqs.length === 0 ? (
          <span className="text-amber-300">
            {t('analysis.rf.suggestNone', 'Keine konfliktfreie Frequenz gefunden (Band voll/überlappend).')}
          </span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {suggestion.freqs.map((f) => (
              <span key={f} className="rounded bg-emerald-700/40 px-2 py-0.5 font-mono text-emerald-100">
                {f.toFixed(1)} MHz
              </span>
            ))}
          </div>
        )}
        <p className="mt-1.5 text-[10px] text-[var(--cp-text-faint)]">
          {t('analysis.rf.suggestNote', 'Frei von Belegung + 3.-Ordnung-Intermodulation (0,4 MHz Schutzabstand); Vorschläge untereinander kompatibel.')}
        </p>
      </div>

      <table className="w-full text-cp-xs">
        <thead>
          <tr className="border-b border-[var(--cp-border)] text-left text-[var(--cp-text-muted)]">
            <th className="py-1 pr-2">{t('analysis.rf.link', 'Funkstrecke')}</th>
            <th className="py-1 pr-2">{t('analysis.rf.freq', 'Frequenz')}</th>
            <th className="py-1 pr-2">{t('analysis.rf.band', 'Band')}</th>
            <th className="py-1 pr-2">{t('analysis.rf.channel', 'Kanal')}</th>
            <th className="py-1 pr-2">{t('analysis.rf.from', 'Von')}</th>
            <th className="py-1">{t('analysis.rf.to', 'Nach')}</th>
          </tr>
        </thead>
        <tbody>
          {links.map((l, i) => {
            // #344 — Band-Zuordnung: Hersteller-Bänder zuerst, Regulatorik
            // separat als Tooltip. Kurz halten (max. 3 sichtbar).
            const matches = bandsForFrequency(l.mhz)
            const mfrBands = matches.filter((b) => !b.mfr.startsWith('Regulatorisch'))
            const regBands = matches.filter((b) => b.mfr.startsWith('Regulatorisch'))
            return (
              <tr key={`${l.name}-${i}`} className="border-b border-[var(--cp-border-muted)]">
                <td className="py-1 pr-2">{l.name}</td>
                <td className="py-1 pr-2 font-mono">{l.frequency}</td>
                <td className="py-1 pr-2" title={matches.map((b) => `${bandLabel(b)} (${b.line}, ${b.fromMHz}–${b.toMHz} MHz${b.note ? `, ${b.note}` : ''})`).join('\n')}>
                  {mfrBands.length === 0 && regBands.length === 0 ? (
                    <span className="text-[var(--cp-text-faint)]">—</span>
                  ) : (
                    <span>
                      {mfrBands.slice(0, 3).map((b) => bandLabel(b)).join(' · ')}
                      {mfrBands.length > 3 && ` +${mfrBands.length - 3}`}
                      {mfrBands.length === 0 && regBands.length > 0 && (
                        <span className="text-[var(--cp-text-muted)]">{regBands[0].band}</span>
                      )}
                    </span>
                  )}
                </td>
                <td className="py-1 pr-2">{l.channel}</td>
                <td className="py-1 pr-2">{l.from}</td>
                <td className="py-1">{l.to}</td>
              </tr>
            )
          })}
          {links.length === 0 && (
            <tr>
              <td colSpan={6} className="py-2 text-[var(--cp-text-faint)]">
                {t('analysis.rf.empty', 'Keine Funkstrecken im Plan.')}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* #344 — Referenz: gängige Hersteller-Frequenzbänder. */}
      <details className="rounded border border-[var(--cp-border-muted)] bg-[var(--cp-surface-3)]">
        <summary className="cursor-pointer px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--cp-text-muted)]">
          {t('analysis.rf.bandRef', 'Frequenzbänder (Sennheiser / Shure / …)')} ({RF_BANDS.length})
        </summary>
        <div className="px-3 py-2">
          <table className="w-full text-cp-xs">
            <thead className="text-[var(--cp-text-faint)]">
              <tr className="text-left">
                <th className="py-0.5 pr-2">{t('analysis.rf.bandMfr', 'Hersteller')}</th>
                <th className="py-0.5 pr-2">{t('analysis.rf.bandLine', 'Serie')}</th>
                <th className="py-0.5 pr-2">{t('analysis.rf.band', 'Band')}</th>
                <th className="py-0.5 pr-2 text-right">MHz</th>
                <th className="py-0.5">{t('analysis.rf.bandNote', 'Hinweis')}</th>
              </tr>
            </thead>
            <tbody>
              {RF_BANDS.map((b, i) => (
                <tr key={i} className="border-t border-[var(--cp-border-muted)]">
                  <td className="py-0.5 pr-2">{b.mfr}</td>
                  <td className="py-0.5 pr-2 text-[var(--cp-text-muted)]">{b.line}</td>
                  <td className="py-0.5 pr-2 font-mono font-semibold">{b.band}</td>
                  <td className="py-0.5 pr-2 text-right font-mono">{b.fromMHz}–{b.toMHz}</td>
                  <td className="py-0.5 text-[10px] text-[var(--cp-text-faint)]">{b.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-[var(--cp-text-faint)]">
            {t('analysis.rf.bandDisclaimer', 'Gängige Nominalbereiche — Band-Buchstaben sind serien-/regionsabhängig. Immer gegen das aktuelle Datenblatt und die lokale Frequenzregulierung prüfen.')}
          </p>
        </div>
      </details>

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
