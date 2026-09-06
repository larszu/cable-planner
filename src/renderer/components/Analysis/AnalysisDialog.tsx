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
import { effectiveDeviceResources, effectiveWatts } from '../../lib/equipmentSelectors'
import { checkDanteName } from '../../lib/danteNaming'
import { subnetCidr } from '../../lib/subnet'
import { addressPlanTable, buildAddressPlan, type AddressIssue } from '../../lib/addressPlan'
import {
  buildSwitchPortMaps,
  switchPortDescriptionBlock,
  switchPortTable,
  type SwitchPortMap,
} from '../../lib/switchPortMap'
import { csvFromTable } from '../../lib/documentStamp'
import { cableRunFindings, cableRunTable, type RunFinding } from '../../lib/cableRunChecks'
import { lookUpSheet, type SheetLookup } from '../../lib/sheetLookup'
import {
  buildVenueNetworkRequest,
  rackDoorSheetTable,
  venueRequestTable,
  vlanTable,
} from '../../lib/venueNetworkRequest'
import {
  ANSWER_STATE_LABEL,
  mergeVenueAnswers,
  openQuestions,
  recordAnswer,
  upsertAnswer,
  venueAnswerTable,
  type AnswerRowState,
} from '../../lib/venueAnswers'
import type { VenueAnswerStatus } from '../../types/venueAnswer'
import { RF_BANDS, bandsForFrequency, bandLabel } from '../../lib/rfBands'

type Tab = 'weight' | 'network' | 'redundancy' | 'rf' | 'runs' | 'sheet'

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

/**
 * Was ein Adressplan-Befund bedeutet, in einem Satz (Initiative 8).
 *
 * Als Funktion und nicht als Tabelle im Modul: die Uebersetzung haengt an der
 * Sprache, das Modell nicht. `addressPlan.ts` liefert Sorten, keine Saetze --
 * sonst muesste die reine Ableitung wissen, welche Sprache jemand eingestellt
 * hat.
 */
const issueLabel = (t: ReturnType<typeof useTranslation>) => (issue: AddressIssue): string => {
  switch (issue.kind) {
    case 'missing-address':
      return t('analysis.address.missing', 'Keine Adresse')
    case 'duplicate-address':
      return `${t('analysis.address.duplicate', 'Adresse doppelt')}: ${(issue.others ?? []).join(', ')}`
    case 'missing-mask':
      return t('analysis.address.noMask', 'Keine Maske (/24 angenommen)')
    case 'gateway-outside-subnet':
      return t('analysis.address.gatewayOutside', 'Gateway ausserhalb des Subnetzes')
    case 'network-or-broadcast-address':
      return t('analysis.address.netOrBroadcast', 'Netz- oder Broadcast-Adresse')
  }
}

const NetworkTab = ({ projectName }: { projectName: string }) => {
  const t = useTranslation()
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  // BEDARF 85 — die Antwort des Hauses. Sie liegt am Projekt, nicht am Geraet.
  const venueAnswers = useProjectStore((s) => s.project.metadata.venueAnswers)
  const siteAddress = useProjectStore((s) => s.project.metadata.siteAddress)
  const updateProjectMetadata = useProjectStore((s) => s.updateProjectMetadata)

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

  // Initiative 8 -- der abgeleitete Adressplan. Die Tabelle darueber zeigt,
  // was AUSGEFUELLT ist; dieser Block zeigt, was fehlt und was nicht stimmt.
  const plan = useMemo(() => buildAddressPlan(equipment), [equipment])
  const label = issueLabel(t)

  const exportCsv = () => {
    const csvRows: (string | number)[][] = [
      [t('analysis.network.device', 'Gerät'), 'IP', t('analysis.network.mgmtVlan', 'Mgmt-VLAN'), 'VLANs'],
      ...rows.map((r) => [r.name, r.ip, r.mgmtVlan, r.vlans]),
    ]
    downloadBlob(buildExportFilenameWithSuffix(projectName, 'netzwerk', 'csv'), toCsv(csvRows), 'text/csv')
  }

  /** Der Adressplan als eigene Datei -- die Liste, die der Netzmensch abarbeitet. */
  // Bedarf 24 — die Karten je Switch. `cables` kommt aus demselben Store wie
  // `equipment`: Switch, Port und das Kabel darin stehen in EINEM Graphen, und
  // genau das verlangt der Bedarf.
  const portMaps = useMemo(() => buildSwitchPortMaps(equipment, cables), [equipment, cables])

  // OHNE Dokument-Stempel, und das ist eine Aussage: das Register in
  // `documentRegistry.ts` fuehrt EINEN Stand je Dokument-Bezeichner, und hier
  // gibt es eine Karte JE SWITCH. Ein gemeinsamer Bezeichner ergaebe einen
  // Stand, der bei jedem zweiten Switch nicht passt — schlimmer als keiner.
  // Ein Stempel je Switch braucht einen Bezeichner je Switch; das ist ein
  // eigener Schritt und keine Zeile hier.
  const exportPortMap = (m: SwitchPortMap) => {
    const table = switchPortTable(m)
    downloadBlob(
      buildExportFilenameWithSuffix(`${projectName}-${m.switchName}`, 'port-karte', 'csv'),
      csvFromTable(table),
      'text/csv',
    )
  }

  const exportPortDescriptions = (m: SwitchPortMap) => {
    downloadBlob(
      buildExportFilenameWithSuffix(`${projectName}-${m.switchName}`, 'port-beschriftung', 'txt'),
      switchPortDescriptionBlock(m),
      'text/plain',
    )
  }

  // Bedarf 22/23 — die Netz-Dokumente aus DEMSELBEN Modell. Kein zweites
  // Datenmodell fuer das Blatt: „Export artefacts other departments actually
  // consume, generated from one model."
  const request = useMemo(() => buildVenueNetworkRequest(equipment, cables), [equipment, cables])

  // Ausgeschriebene Beschriftungen statt `t(`...${key}`)`: ein zusammengesetzter
  // Schluessel ist fuer den i18n-Abdeckungs-Test unsichtbar, und der deutsche
  // Rueckfall waere der nackte Schluessel („igmpQuerier") gewesen — in BEIDEN
  // Sprachen.
  const venueItemLabel = (key: string): string => {
    switch (key) {
      case 'vlans':
        return t('analysis.venue.item.vlans', 'VLANs')
      case 'subnets':
        return t('analysis.venue.item.subnets', 'Adressbereiche')
      case 'ports':
        return t('analysis.venue.item.ports', 'Netz-Ports')
      case 'bandwidth':
        return t('analysis.venue.item.bandwidth', 'Medien-Bandbreite')
      case 'multicast':
        return t('analysis.venue.item.multicast', 'Multicast-Standards')
      case 'poe':
        return t('analysis.venue.item.poe', 'PoE')
      case 'igmpQuerier':
        return t('analysis.venue.item.igmpQuerier', 'IGMP-Querier')
      case 'dhcp':
        return t('analysis.venue.item.dhcp', 'DHCP')
      case 'qos':
        return t('analysis.venue.item.qos', 'QoS / DSCP')
      case 'jointTest':
        return t('analysis.venue.item.jointTest', 'Gemeinsamer Testtermin')
      default:
        return key
    }
  }

  // BEDARF 85 — Frage und Antwort in einer Liste. `siteAddress` ist der Ort
  // DIESES Projekts; weicht er vom eingefrorenen Ort einer Antwort ab, sagt
  // die Zeile das, statt die Genehmigung stillschweigend zu uebernehmen.
  const answerRows = useMemo(
    () =>
      mergeVenueAnswers({
        request,
        answers: venueAnswers ?? [],
        ...(siteAddress ? { venue: siteAddress } : {}),
      }),
    [request, venueAnswers, siteAddress],
  )
  const offen = useMemo(() => openQuestions(answerRows), [answerRows])

  const stateLabel = (st: AnswerRowState): string =>
    ({
      granted: t('analysis.venue.a.granted', 'genehmigt'),
      partial: t('analysis.venue.a.partial', 'mit Auflage'),
      refused: t('analysis.venue.a.refused', 'abgelehnt'),
      pending: t('analysis.venue.a.pending', 'keine Antwort'),
      elsewhere: t('analysis.venue.a.elsewhere', 'Antwort aus einem anderen Haus'),
      stale: t('analysis.venue.a.stale', 'Antwort ohne Frage im Plan'),
    })[st] ?? ANSWER_STATE_LABEL[st]

  const setzeAntwort = (key: string, status: VenueAnswerStatus) => {
    const vorher = (venueAnswers ?? []).find((a) => a.key === key)
    updateProjectMetadata({
      venueAnswers: upsertAnswer(
        venueAnswers ?? [],
        recordAnswer(key, status, new Date().toISOString(), {
          ...(vorher?.note ? { note: vorher.note } : {}),
          ...(vorher?.by ? { by: vorher.by } : {}),
          ...(siteAddress ? { venue: siteAddress } : {}),
        }),
      ),
    })
  }

  const setzeNotiz = (key: string, note: string) => {
    const vorher = (venueAnswers ?? []).find((a) => a.key === key)
    if (!vorher) return
    updateProjectMetadata({
      venueAnswers: upsertAnswer(venueAnswers ?? [], { ...vorher, note }),
    })
  }

  const exportVenueRequest = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'haus-it-anforderung', 'csv'),
      csvFromTable(venueRequestTable(request)),
      'text/csv',
    )
  }
  const exportVenueAnswers = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'haus-it-antwort', 'csv'),
      csvFromTable(venueAnswerTable(answerRows, venueItemLabel)),
      'text/csv',
    )
  }
  const exportRackDoor = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'rack-tuer', 'csv'),
      csvFromTable(rackDoorSheetTable(equipment)),
      'text/csv',
    )
  }
  const exportVlans = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'vlan-tabelle', 'csv'),
      csvFromTable(vlanTable(equipment)),
      'text/csv',
    )
  }

  const exportAddressPlan = () => {
    const csvRows = addressPlanTable(plan, label, [
      t('analysis.network.device', 'Gerät'),
      'IP',
      t('analysis.address.mask', 'Maske'),
      'Gateway',
      t('analysis.network.subnets', 'Subnetze'),
      t('analysis.address.evidence', 'Beleg'),
      t('analysis.address.finding', 'Befund'),
    ])
    downloadBlob(buildExportFilenameWithSuffix(projectName, 'adressplan', 'csv'), toCsv(csvRows), 'text/csv')
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
      {/* ── Adressplan (Initiative 8) ────────────────────────────────────
          Die Tabelle oben zeigt, was AUSGEFUELLT ist. Dieser Block zeigt, was
          fehlt und was nicht stimmt -- abgeleitet aus den Geraeten selbst,
          samt Beleg, welcher Port die Forderung ausgeloest hat. Er vergibt
          keine Adressen: woher Subnetze kommen, ist die offene
          Eigentuemer-Frage E-5. */}
      {plan.networkedCount > 0 && (
        <div className="rounded border border-[var(--cp-border-muted)] bg-[var(--cp-surface-3)] p-2 text-cp-xs">
          <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold text-[var(--cp-text-muted)]">
              {t('analysis.address.title', 'Adressplan')}
            </span>
            <span className="text-[var(--cp-text-faint)]">
              {format(
                t('analysis.address.coverage', '{done} von {total} Netzgeräten adressiert'),
                { done: plan.networkedCount - plan.missing.length, total: plan.networkedCount },
              )}
            </span>
          </div>
          {plan.withIssues.length === 0 ? (
            <p className="text-[var(--cp-text-faint)]">
              {t('analysis.address.clean', 'Kein offener Punkt: jedes Netzgerät hat Adresse, Maske und ein passendes Gateway.')}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {plan.withIssues.map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold">{r.name}</span>
                  {r.ip && <span className="font-mono text-[var(--cp-text-muted)]">{r.ip}</span>}
                  <span className="text-amber-300/90">{r.issues.map(label).join(' · ')}</span>
                  {/* Der Beleg. Wer die Zeile fuer falsch haelt, soll sehen,
                      welcher Port sie ausgeloest hat. */}
                  {r.evidence && (
                    <span className="text-[10px] text-[var(--cp-text-faint)]">{r.evidence}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {/* Bedarf 24 — die Switch-Port-Karte. Erzeugt statt gepflegt: die
          deutsche Praxis dafuer ist eine Excel-Mappe mit einem Reiter je
          Switch, und die ist die zweite Wahrheit neben dem Plan. */}
      {portMaps.length > 0 && (
        <div className="rounded border border-[var(--cp-border)] p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">{t('analysis.switchPorts.title', 'Switch-Port-Karte')}</span>
            <span className="text-cp-xs text-[var(--cp-text-muted)]">
              {format(t('analysis.switchPorts.count', '{n} Switches'), { n: portMaps.length })}
            </span>
          </div>
          {portMaps.map((m) => (
            <div key={m.switchId} className="mb-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-cp-xs font-medium">{m.switchName}</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[var(--cp-text-faint)]">
                    {format(t('analysis.switchPorts.used', '{u} von {n} belegt'), {
                      u: m.usedCount,
                      n: m.rows.length,
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => exportPortMap(m)}
                    className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--cp-surface-2)]"
                  >
                    <Icon icon={Download} size="xs" /> CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => exportPortDescriptions(m)}
                    title={t(
                      'analysis.switchPorts.descHint',
                      'Herstellerneutraler Text zum Einfügen. Der Plan schickt nichts an den Switch — lies, was du einfügst.',
                    )}
                    className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--cp-surface-2)]"
                  >
                    <Icon icon={Download} size="xs" />{' '}
                    {t('analysis.switchPorts.descriptions', 'Beschriftung')}
                  </button>
                </div>
              </div>
              <ul className="flex flex-col gap-0.5">
                {m.rows.map((r) => (
                  <li key={r.port} className="flex items-center gap-2 text-cp-xs">
                    <span className="w-14 shrink-0 font-mono text-[var(--cp-text-muted)]">{r.port}</span>
                    <span className={r.device ? '' : 'text-[var(--cp-text-faint)]'}>
                      {r.device ?? t('analysis.switchPorts.free', 'frei')}
                    </span>
                    {r.nicLabel && (
                      <span className="text-[10px] text-[var(--cp-text-faint)]">{r.nicLabel}</span>
                    )}
                    {r.ipAddress && <span className="font-mono text-[10px]">{r.ipAddress}</span>}
                    {r.vlanId !== undefined && (
                      <span className="text-[10px] text-[var(--cp-text-muted)]">VLAN {r.vlanId}</span>
                    )}
                    {r.source && (
                      <span className="text-[10px] text-[var(--cp-text-faint)]">
                        {r.source === 'interface'
                          ? t('analysis.switchPorts.fromNic', 'Schnittstelle')
                          : t('analysis.switchPorts.fromCable', 'Kabel')}
                      </span>
                    )}
                    {r.conflict && (
                      <span className="text-amber-300/90">
                        {format(t('analysis.switchPorts.conflict', 'Kabel sagt: {name}'), {
                          name: r.conflict,
                        })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {/* Bedarf 23 — das Blatt fuer die Haus-IT. Jede Zeile sagt, ob sie
          abgeleitet ist oder eine Frage: ein Blatt, das die DHCP-Reichweite
          des Hauses „ausfuellt", legt dem Administrator eine Behauptung ueber
          sein eigenes Netz vor. */}
      <div className="rounded border border-[var(--cp-border)] p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-semibold">{t('analysis.venue.title', 'Anforderung an die Haus-IT')}</span>
          <button
            type="button"
            onClick={exportVenueRequest}
            className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs font-medium text-[var(--cp-text)] hover:bg-[var(--cp-surface-2)]"
          >
            <Icon icon={Download} size="xs" /> CSV
          </button>
        </div>
        <p className="mb-1.5 text-cp-xs text-[var(--cp-text-muted)]">
          {t(
            'analysis.venue.intro',
            'Die Design-Literatur schreibt den Inhalt vor und einen gemeinsamen Testtermin, aber kein Dokument. Was der Plan weiß, steht mit Zahl da; was er nicht wissen kann, steht als Frage.',
          )}
        </p>
        {request.igmpConflict && (
          <div className="mb-1.5 rounded border border-amber-700/60 bg-amber-900/20 p-2 text-cp-xs text-amber-200">
            {format(
              t(
                'analysis.venue.igmpConflict',
                'Der Plan trägt beides: {audio} (Feldrat der Audio-Hersteller: IGMP-Snooping aus) und {video} (funktioniert ohne Multicast-Verwaltung nicht). Diese beiden Ratschläge schließen sich auf einem gemeinsamen Netz aus — das gehört vor den Aufbau, nicht in die Nacht.',
              ),
              { audio: request.igmpConflict.audio.join(', '), video: request.igmpConflict.video.join(', ') },
            )}
          </div>
        )}
        <ul className="flex flex-col gap-0.5">
          {request.items.map((i) => {
            const antwort = answerRows.find((r) => r.key === i.key)
            return (
              <li key={i.key} className="flex flex-wrap items-baseline gap-2 text-cp-xs">
                <span className="w-52 shrink-0 text-[var(--cp-text-muted)]">{venueItemLabel(i.key)}</span>
                {i.origin === 'derived' ? (
                  <span className="font-mono text-[var(--cp-text)]">{i.value}</span>
                ) : (
                  <span className="flex-1 text-amber-300/90">{i.why}</span>
                )}
                {i.source && (
                  <span className="w-full pl-52 text-[10px] text-[var(--cp-text-faint)]">{i.source}</span>
                )}
                {/* BEDARF 85 — die Antwort direkt an der Frage. Vier Knoepfe, weil
                    „mit Auflage" der haeufigste Ausgang ist und ein Ja/Nein-Kreuz
                    ihn beim naechsten Mal in beide Richtungen falsch macht. */}
                <span className="flex w-full items-center gap-1 pl-52">
                  {(['granted', 'partial', 'refused', 'pending'] as VenueAnswerStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setzeAntwort(i.key, st)}
                      className={`rounded border px-1.5 py-0.5 text-[10px] ${
                        antwort?.answered === st || (st === 'pending' && !antwort?.answered)
                          ? 'border-[var(--cp-accent)] text-[var(--cp-accent)]'
                          : 'border-[var(--cp-border)] text-[var(--cp-text-faint)] hover:text-[var(--cp-text)]'
                      }`}
                    >
                      {stateLabel(st)}
                    </button>
                  ))}
                  {antwort?.answered && antwort.answered !== 'pending' && (
                    <input
                      value={antwort.note ?? ''}
                      onChange={(e) => setzeNotiz(i.key, e.target.value)}
                      placeholder={t('analysis.venue.a.notePh', 'Auflage oder Umweg im Klartext')}
                      className="min-w-0 flex-1 rounded border border-[var(--cp-border)] bg-transparent px-1.5 py-0.5 text-[10px] text-[var(--cp-text)] outline-none placeholder:text-[var(--cp-text-faint)]"
                    />
                  )}
                </span>
                {antwort?.state === 'elsewhere' && (
                  <span className="w-full pl-52 text-[10px] text-amber-300/90">
                    {format(
                      t(
                        'analysis.venue.a.elsewhereHint',
                        'Diese Antwort wurde für {dort} gegeben, dieses Projekt steht in {hier}. Sie gilt hier nicht, bis jemand nachfragt.',
                      ),
                      { dort: antwort.venue ?? '?', hier: antwort.hier ?? '?' },
                    )}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
        {answerRows.some((r) => r.state === 'stale') && (
          <div className="mt-2 border-t border-[var(--cp-border-muted)] pt-2 text-[10px] text-[var(--cp-text-faint)]">
            {t(
              'analysis.venue.a.staleHead',
              'Antworten zu Punkten, die der Plan nicht mehr stellt — Auskunft über das Haus, nicht Müll:',
            )}{' '}
            {answerRows
              .filter((r) => r.state === 'stale')
              .map((r) => `${venueItemLabel(r.key)} (${stateLabel(r.answered ?? 'pending')})`)
              .join(', ')}
          </div>
        )}
        {offen.length > 0 && (
          <div className="mt-2 text-cp-xs text-amber-300/90">
            {format(
              t('analysis.venue.a.open', '{n} Punkte, wegen derer noch einmal anzurufen ist: {liste}'),
              {
                n: String(offen.length),
                liste: offen.map((r) => venueItemLabel(r.key)).join(', '),
              },
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={exportRackDoor}
          className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs font-medium text-[var(--cp-text)] hover:bg-[var(--cp-surface-2)]"
        >
          <Icon icon={Download} size="xs" /> {t('analysis.venue.rackDoor', 'Rack-Tür-Blatt')}
        </button>
        <button
          type="button"
          onClick={exportVenueAnswers}
          className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs font-medium text-[var(--cp-text)] hover:bg-[var(--cp-surface-2)]"
        >
          <Icon icon={Download} size="xs" /> {t('analysis.venue.a.export', 'Frage und Antwort')}
        </button>
        <button
          type="button"
          onClick={exportVlans}
          className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs font-medium text-[var(--cp-text)] hover:bg-[var(--cp-surface-2)]"
        >
          <Icon icon={Download} size="xs" /> {t('analysis.venue.vlanTable', 'VLAN-Tabelle')}
        </button>
        <button
          type="button"
          onClick={exportAddressPlan}
          disabled={plan.networkedCount === 0}
          className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs font-medium text-[var(--cp-text)] hover:bg-[var(--cp-surface-2)] disabled:opacity-40"
        >
          <Icon icon={Download} size="xs" /> {t('analysis.address.export', 'Adressplan als CSV')}
        </button>
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

// ───────────────────────────────────────────────────────────────────────────
// Bedarf 13 — die Kabelwege. Was die Laenge behauptet, und ob sie noch gilt.
//
// Der Befund nennt das stille Veralten beim Namen: „a moved position SILENTLY
// invalidates the cable call". Diese Ansicht macht es laut — und nennt bei
// einem Hybrid-Kamerakabel dazu, wie viele Dienste an dem einen Strang
// haengen: „one wrong SMPTE run kills video, return, comms, tally and power
// at once."
// ───────────────────────────────────────────────────────────────────────────
const RunsTab = ({ projectName }: { projectName: string }) => {
  const t = useTranslation()
  const cables = useProjectStore((s) => s.project.cables)
  const equipment = useProjectStore((s) => s.project.equipment)

  const findings = useMemo(() => cableRunFindings(cables, equipment), [cables, equipment])

  // Ausgeschriebener switch, ein Schluessel je Fall. Einen Schluessel aus dem
  // kind-Feld zusammenzusetzen waere fuer den i18n-Deckungs-Guard unsichtbar
  // und fiele im EN-Betrieb still auf den nackten Slug zurueck. (Die verbotene
  // Form steht hier bewusst NICHT als Beispiel: sie stuende dann im Quelltext,
  // und der Guard, der sie sucht, findet den Kommentar.)
  const text = (f: RunFinding): string => {
    const kern = (() => {
      switch (f.kind) {
        case 'derived-length-stale':
          return format(
            t(
              'analysis.runs.stale',
              'Länge {alt} m wurde geschätzt; seither um {px} px verschoben, die Schätzung ergäbe jetzt {neu} m',
            ),
            { alt: f.values[0], neu: f.values[1], px: f.values[2] },
          )
        case 'over-max-length':
          return format(
            t('analysis.runs.overMax', 'Länge {laenge} m über der Reichweite von {max} m ({typ})'),
            { laenge: f.values[0], max: f.values[1], typ: f.values[2] },
          )
        case 'endpoint-missing':
          return t(
            'analysis.runs.endpointMissing',
            'Abgeleitete Länge, aber ein Endgerät fehlt — sie lässt sich nicht mehr nachrechnen',
          )
      }
    })()
    return f.services
      ? `${kern} — ${format(t('analysis.runs.bundled', 'ein Strang, {n} Dienste: {liste}'), {
          n: f.services.length,
          liste: f.services.join(', '),
        })}`
      : kern
  }

  const exportCsv = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'kabelwege', 'csv'),
      csvFromTable(cableRunTable(cables, equipment)),
      'text/csv',
    )
  }

  return (
    <div className="space-y-3 p-4 text-cp-base">
      <p className="text-cp-xs text-[var(--cp-text-muted)]">
        {t(
          'analysis.runs.intro',
          'Geschätzte Längen tragen ihre Herkunft. Wird ein Gerät verschoben, veraltet die Schätzung — hier steht es, statt still zu bleiben. Von Hand eingetragene Längen werden NICHT gegen die Luftlinie gehalten: ein echter Kabelweg wird verlegt, nicht gespannt.',
        )}
      </p>

      {findings.length === 0 ? (
        <p className="text-cp-xs text-[var(--cp-text-muted)]">
          {t('analysis.runs.none', 'Keine Befunde: keine überholte Schätzung, keine Länge über der Reichweite.')}
        </p>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={exportCsv}
              className="rounded border border-cp-border px-2 py-1 text-cp-xs text-cp-text-secondary hover:text-cp-text"
            >
              CSV
            </button>
          </div>
          <ul className="space-y-1">
            {findings.map((f) => (
              <li
                key={`${f.kind}-${f.cableId}`}
                className={
                  f.kind === 'over-max-length'
                    ? 'rounded border border-red-700/60 bg-red-900/30 p-2 text-cp-xs text-red-200'
                    : 'rounded border border-amber-700/60 bg-amber-900/30 p-2 text-cp-xs text-amber-200'
                }
              >
                <span className="font-semibold">{f.cableLabel}</span> — {text(f)}
                {f.source && <span className="ml-1 opacity-70">({f.source})</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Bedarf 27 — der Rueckweg vom Papier.
//
// „Gilt dieses Blatt noch?" konnte `documentRegistry` seit ADR-004
// beantworten, und niemand konnte fragen: `docStandStatus` und `findByStand`
// waren gebaut, getestet und von KEINEM Knopf erreichbar. Hier ist der Knopf.
//
// Der Bedarf nennt die Frist: „Must complete in under ten seconds or it will
// not be used in the last two hours before doors." Deshalb ein Feld und kein
// Formular — acht Zeichen abtippen, Enter.
// ───────────────────────────────────────────────────────────────────────────
const SheetTab = () => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const [draft, setDraft] = useState('')
  const [treffer, setTreffer] = useState<SheetLookup | null>(null)

  const pruefen = () => setTreffer(lookUpSheet(draft, project))

  // Ausgeschriebener switch, ein Schluessel je Fall — ein aus dem `kind`
  // gebauter waere fuer den i18n-Deckungs-Guard unsichtbar.
  const text = (r: SheetLookup): string => {
    switch (r.kind) {
      case 'identified':
        switch (r.status) {
          case 'current':
            return format(t('analysis.sheet.current', '{label}: Stand {stand} — aktuell'), {
              label: r.label ?? '',
              stand: r.stand ?? '',
            })
          case 'stale':
            return format(
              t('analysis.sheet.stale', '{label}: Stand {stand} — ÜBERHOLT, der Plan ist seither weiter'),
              { label: r.label ?? '', stand: r.stand ?? '' },
            )
          default:
            return format(
              t('analysis.sheet.unknown', '{label}: Stand {stand} — nicht beurteilbar ({grund})'),
              { label: r.label ?? '', stand: r.stand ?? '', grund: r.reason ?? '' },
            )
        }
      case 'matched-by-stand':
        return format(t('analysis.sheet.matched', '{label}: aktuell (Stand {stand})'), {
          label: r.label ?? '',
          stand: r.stand ?? '',
        })
      case 'stale-or-foreign':
        return format(
          t(
            'analysis.sheet.foreign',
            'Stand {stand} gehört zu keinem Dokument dieses Plans — vermutlich ein überholter Ausdruck',
          ),
          { stand: r.stand ?? '' },
        )
      case 'unreadable':
        return t(
          'analysis.sheet.unreadable',
          'Kein Dokument-Code und kein Stand — acht Zeichen vom Fuß des Blatts oder der ganze Code',
        )
    }
  }

  const ton = (r: SheetLookup): string => {
    if (r.kind === 'identified' && r.status === 'current') return 'text-cp-text-secondary'
    if (r.kind === 'matched-by-stand') return 'text-cp-text-secondary'
    if (r.kind === 'unreadable') return 'text-cp-text-muted'
    // „Ueberholt" und „gehoert zu keinem Dokument" sind dieselbe Nachricht in
    // zwei Schaerfen: das Blatt in der Hand stimmt nicht mehr.
    return 'text-cp-warn'
  }

  return (
    <div className="space-y-3 p-4 text-cp-base">
      <p className="text-cp-xs text-[var(--cp-text-muted)]">
        {t(
          'analysis.sheet.intro',
          'Ein Blatt in der Hand: den Stand vom Fuß abtippen (acht Zeichen) oder den ganzen Dokument-Code einlesen. Die Antwort sagt, welches Dokument es ist und ob der Plan seither weiter ist.',
        )}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') pruefen()
          }}
          placeholder={t('analysis.sheet.placeholder', '1a2b3c4d oder cableplanner://doc/…')}
          aria-label={t('analysis.sheet.placeholder', '1a2b3c4d oder cableplanner://doc/…')}
          className="min-w-[16rem] flex-1 rounded border border-cp-border bg-cp-surface-3 p-1.5"
        />
        <button
          type="button"
          onClick={pruefen}
          disabled={!draft.trim()}
          className="rounded border border-cp-border px-2.5 py-1 text-cp-text-secondary hover:text-cp-text disabled:opacity-40"
        >
          {t('analysis.sheet.check', 'Prüfen')}
        </button>
      </div>

      {treffer && <div className={`text-cp-sm ${ton(treffer)}`}>{text(treffer)}</div>}
    </div>
  )
}

const TABS: { id: Tab; labelKey: string; fallback: string }[] = [
  { id: 'weight', labelKey: 'analysis.tab.weight', fallback: 'Gewicht & Wärme' },
  { id: 'network', labelKey: 'analysis.tab.network', fallback: 'Netzwerk' },
  { id: 'redundancy', labelKey: 'analysis.tab.redundancy', fallback: 'Redundanz' },
  { id: 'rf', labelKey: 'analysis.tab.rf', fallback: 'RF / Funk' },
  { id: 'runs', labelKey: 'analysis.tab.runs', fallback: 'Kabelwege' },
  { id: 'sheet', labelKey: 'analysis.tab.sheet', fallback: 'Blatt prüfen' },
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
      {active === 'runs' && <RunsTab projectName={projectName} />}
      {active === 'sheet' && <SheetTab />}
    </ModalShell>
  )
}
