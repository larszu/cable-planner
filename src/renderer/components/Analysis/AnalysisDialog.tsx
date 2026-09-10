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
import { BarChart3, Calculator, Download, Plus, Trash2 } from 'lucide-react'
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
import {
  CLIENT_SUMMARY_FINDING_LABEL,
  SUMMARY_BASIS_LABEL,
  clientSummary,
  clientSummaryTable,
} from '../../lib/clientSummary'
import { JOB_BASIS_LABEL } from '../../lib/jobHandover'
import {
  COST_FINDING_LABEL,
  assessCosts,
  costComparisonTable,
} from '../../lib/costComparison'
import {
  ACTUAL_SOURCE_LABEL,
  type ActualSource,
  type CostLine,
  type CostPlan,
} from '../../types/costLines'
import {
  NAMING_FINDING_LABEL,
  applyNamingScheme,
  assessNaming,
  renameSetTable,
  type NamingRefusal,
} from '../../lib/namingScheme'
import type { NamingScheme } from '../../types/namingScheme'
import {
  DANTE_DIFF_LABEL,
  DANTE_FINDING_LABEL,
  assessDantePatch,
  danteDiffTable,
  dantePatchTable,
  diffDantePatches,
  parseDanteMatrix,
} from '../../lib/dantePatch'
import type { DantePatch } from '../../types/dantePatch'
import { cableRunFindings, cableRunTable, type RunFinding } from '../../lib/cableRunChecks'
import { CrewTab } from './CrewTab'
import { ActionTab } from './ActionTab'
import { ChainTab } from './ChainTab'
import {
  RECORD_NAME_FINDING_LABEL,
  normaliseRecordNaming,
  recordNamePlan,
  recordNameSheet,
} from '../../lib/recordNaming'
import { DEFAULT_RECORD_SCHEME } from '../../types/recordNaming'
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
import { PTP_FINDING_LABEL, buildPtpPlan, ptpTable } from '../../lib/ptpPlan'
import { SegmentsPanel } from '../Network/SegmentsPanel'
import { AddressTemplatePanel } from '../Network/AddressTemplatePanel'
import { CREW_SECTION_LABEL, buildCrewSheet, crewSheetTable } from '../../lib/crewNetworkSheet'
import {
  MULTICAST_ESSENCE_LABEL,
  MULTICAST_FINDING_LABEL,
  allocateMulticast,
  buildMulticastPlan,
  multicastMac,
  multicastTable,
} from '../../lib/multicastPlan'
import { MULTICAST_LEG_LABEL } from '../../types/multicast'
import {
  ASSET_FINDING_LABEL,
  IDENTITY_ANCHOR_LABEL,
  assessAssetIdentity,
  assetIdentityTable,
} from '../../lager'
import {
  SPECTRUM_SOURCE_LABEL,
  buildSpectrumPlan,
  conflictParticipants,
  parseFreqMhz,
  spectrumTable,
} from '../../lib/spectrumPlan'
import {
  carrierCheckTable,
  checkCarriers,
  parseScanCsv,
  SCAN_FINDING_LABEL,
  scanFindings,
  scannedRange,
} from '../../lib/spectrumScan'
import { DEFAULT_OCCUPIED_DBM, VERDICT_LABEL, type SpectrumScan } from '../../types/spectrumScan'
import { PanelHint } from '../shared/PanelHint'
import { useAusgaben, useBestand, useEinheiten } from '../../lager'

/**
 * Der Weg zum passenden Rechner, direkt neben der Tabelle, die seine Zahl
 * zeigt.
 *
 * Nutzer-Frage 2026-09-07: „Die ganzen Tools muessten eigentlich besser
 * eingebaut werden da wo man sie auch wirklich braucht." Wer auf die
 * Leistungs-Spalte schaut und wissen will, ob die Phase reicht, soll den
 * Rechner HIER finden — nicht in einem Menue, das er dafuer erst schliessen
 * und wieder oeffnen muss.
 *
 * Die beiden Menue-Eintraege sind dafuer entfallen. Die zwei anderen Rechner
 * (Aufzeichnungs-Speicher, Projektion) bleiben im Menue: sie haben hier keine
 * Tabelle, neben die sie gehoerten, und ein Knopf ohne Bezug waere nur eine
 * weitere Zeile.
 */
const RechnerLink = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1 rounded border border-cp-border bg-cp-surface-2 px-2 py-0.5 text-cp-xs text-cp-text hover:border-sky-500 hover:bg-cp-surface-3"
  >
    <Icon icon={Calculator} size="xs" />
    {label}
  </button>
)

type Tab =
  | 'todo'
  | 'weight'
  | 'network'
  | 'redundancy'
  | 'rf'
  | 'runs'
  | 'chain'
  | 'sheet'
  | 'client'
  | 'cost'
  | 'crew'
  | 'naming'
  | 'dante'

const WATT_TO_BTU = 3.412

/**
 * BEDARF 95 — die Frequenz-Zerlegung steht jetzt in `spectrumPlan.ts`.
 *
 * Sie stand hier im Rumpf des Dialogs und war damit fuer jede andere Stelle
 * unerreichbar. Genau daraus entstanden ZWEI Rechnungen: das Rig rechnete mit
 * `computeRfConflicts`, dieser Reiter mit einer eigenen Schleife und einer
 * eigenen Konstante — und keine der beiden sah die Sender der anderen.
 */
const parseFreqMHz = parseFreqMhz

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
      <Icon icon={Download} size="xs" /> {t('analysis.exportCsv', 'Export CSV')}
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
      const cat = e.category || t('analysis.uncategorized', 'Uncategorized')
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
    const priceHead = hasPrices ? [t('analysis.weight.eur', 'Value (€)')] : []
    const priceCell = (eur: number) => (hasPrices ? [eur.toFixed(2)] : [])
    const rows: (string | number)[][] = [
      [
        t('analysis.weight.category', 'Category'),
        t('analysis.weight.count', 'Count'),
        t('analysis.weight.kg', 'Weight (kg)'),
        t('analysis.weight.watts', 'Power (W)'),
        t('analysis.weight.btu', 'Heat (BTU/h)'),
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
        t('analysis.total', 'Total'),
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
      <PanelHint className="mb-2 text-cp-xs text-[var(--cp-text-muted)]" text={t(
          'analysis.weight.intro',
          'Weight (kg) and heat load per category from device properties. Heat ≈ power × 3.412 BTU/h.',
        )} />
      <div>
        <RechnerLink
          onClick={() => useUiStore.getState().openPowerCalc()}
          label={t('app.menu.tools.power', 'Calculate power consumption…')}
        />
      </div>
      <table className="block overflow-x-auto w-full text-cp-xs">
        <thead>
          <tr className="border-b border-[var(--cp-border)] text-left text-[var(--cp-text-muted)]">
            <th className="py-1 pr-2">{t('analysis.weight.category', 'Category')}</th>
            <th className="py-1 pr-2 text-right">{t('analysis.weight.count', 'Count')}</th>
            <th className="py-1 pr-2 text-right">{t('analysis.weight.kg', 'Weight (kg)')}</th>
            <th className="py-1 pr-2 text-right">{t('analysis.weight.watts', 'Power (W)')}</th>
            <th className={`py-1 text-right ${hasPrices ? 'pr-2' : ''}`}>{t('analysis.weight.btu', 'Heat (BTU/h)')}</th>
            {hasPrices && <th className="py-1 text-right">{t('analysis.weight.eur', 'Value (€)')}</th>}
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
            <td className="py-1 pr-2">{t('analysis.total', 'Total')}</td>
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
          {format(t('analysis.weight.missing', '{n} device(s) without a weight value — add it in the properties.'), {
            n: missingWeight,
          })}
        </p>
      )}
      {heaviest.length > 0 && (
        <div className="rounded border border-[var(--cp-border-muted)] bg-[var(--cp-surface-3)] p-2 text-cp-xs">
          <div className="mb-1 font-semibold text-[var(--cp-text-muted)]">
            {t('analysis.weight.heaviest', 'Heaviest devices (rigging/transport)')}
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
      return t('analysis.address.missing', 'No address')
    case 'duplicate-address':
      return `${t('analysis.address.duplicate', 'Address used twice')}: ${(issue.others ?? []).join(', ')}`
    case 'missing-mask':
      return t('analysis.address.noMask', 'No mask (/24 assumed)')
    case 'gateway-outside-subnet':
      return t('analysis.address.gatewayOutside', 'Gateway outside the subnet')
    case 'network-or-broadcast-address':
      return t('analysis.address.netOrBroadcast', 'Network or broadcast address')
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
      [t('analysis.network.device', 'Device'), 'IP', t('analysis.network.mgmtVlan', 'Mgmt VLAN'), 'VLANs'],
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

  // BEDARF 73 — der Zeit-Plan. Aus denselben zwei Quellen: die PTP-Felder an
  // den Schnittstellen und die Standards an den Kabeln. Kein drittes Modell.
  const ptp = useMemo(() => buildPtpPlan(equipment, cables), [equipment, cables])

  // BEDARF 77 — das Merkblatt fuer die Crew. Nimmt das ganze Projekt, weil es
  // aus vier Quellen schoepft (Geraete, Kabel, Kontakte, Antworten des Hauses).
  const projekt = useProjectStore((s) => s.project)
  const crew = useMemo(() => buildCrewSheet(projekt), [projekt])

  // BEDARF 72 — der Multicast-Adressplan. Die Fluesse kommen aus dem
  // Kabelgraph, die Adressen aus dem Projekt.
  const setMulticastConfig = useProjectStore((s) => s.setMulticastConfig)
  const multicast = useMemo(() => buildMulticastPlan(projekt), [projekt])
  // Der Entwurf liegt lokal, damit das Tippen im Pool-Feld nicht bei jedem
  // Zeichen eine Vergabe-Rechnung ueber mehrere hundert Fluesse ausloest.
  // BEDARF 78 — welche Kiste welchen Platz fuellt. Der Bestand und die
  // Ausgabescheine liegen in eigenen Stores; hier werden sie NUR GELESEN.
  const invUnits = useEinheiten()
  const invItems = useBestand()
  const checkouts = useAusgaben()
  const asset = useMemo(
    () =>
      assessAssetIdentity({
        equipment,
        units: invUnits,
        items: invItems,
        checkouts,
      }),
    [equipment, invUnits, invItems, checkouts],
  )
  const exportAsset = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'geraete-identitaet', 'csv'),
      csvFromTable(assetIdentityTable(asset)),
      'text/csv',
    )
  }

  const [poolDraft, setPoolDraft] = useState(projekt.multicast?.pool ?? '')
  const [portDraft, setPortDraft] = useState(String(projekt.multicast?.basePort ?? 20000))

  const rahmenUebernehmen = () => {
    const port = Number(portDraft)
    setMulticastConfig({
      pool: poolDraft.trim(),
      basePort: Number.isInteger(port) && port > 0 && port <= 65535 ? port : 20000,
      assignments: projekt.multicast?.assignments ?? [],
    })
  }

  // Vergeben heisst NACHVERGEBEN. `allocateMulticast` bewegt keine bestehende
  // Adresse — eine verteilte Adresse umzunummerieren waere der stille Verlust
  // aus Bedarf 96. Deshalb braucht dieser Knopf auch keine Rueckfrage.
  const vergeben = () => {
    const cfg = projekt.multicast
    if (!cfg) return
    const res = allocateMulticast(multicast.flows, cfg)
    setMulticastConfig({ ...cfg, assignments: res.assignments })
  }

  // Verwaiste Vergaben wegzuraeumen ist eine eigene, sichtbare Handlung: sie
  // LOESCHT etwas, und was sie loescht, steht darueber namentlich da.
  const verwaisteEntfernen = () => {
    const cfg = projekt.multicast
    if (!cfg) return
    const weg = new Set(multicast.stale.map((a) => `${a.flowKey}|${a.leg}`))
    setMulticastConfig({
      ...cfg,
      assignments: cfg.assignments.filter((a) => !weg.has(`${a.flowKey}|${a.leg}`)),
    })
  }

  const exportMulticast = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'multicast-adressplan', 'csv'),
      csvFromTable(multicastTable(multicast)),
      'text/csv',
    )
  }

  // Ausgeschriebene Beschriftungen statt `t(`...${key}`)`: ein zusammengesetzter
  // Schluessel ist fuer den i18n-Abdeckungs-Test unsichtbar, und der deutsche
  // Rueckfall waere der nackte Schluessel („igmpQuerier") gewesen — in BEIDEN
  // Sprachen.
  const venueItemLabel = (key: string): string => {
    switch (key) {
      case 'vlans':
        return t('analysis.venue.item.vlans', 'VLANs')
      case 'subnets':
        return t('analysis.venue.item.subnets', 'Address ranges')
      case 'ports':
        return t('analysis.venue.item.ports', 'Network ports')
      case 'bandwidth':
        return t('analysis.venue.item.bandwidth', 'Media bandwidth')
      case 'multicast':
        return t('analysis.venue.item.multicast', 'Multicast standards')
      case 'poe':
        return t('analysis.venue.item.poe', 'PoE')
      case 'igmpQuerier':
        return t('analysis.venue.item.igmpQuerier', 'IGMP querier')
      case 'dhcp':
        return t('analysis.venue.item.dhcp', 'DHCP')
      case 'qos':
        return t('analysis.venue.item.qos', 'QoS / DSCP')
      case 'jointTest':
        return t('analysis.venue.item.jointTest', 'Joint test session')
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
      granted: t('analysis.venue.a.granted', 'granted'),
      partial: t('analysis.venue.a.partial', 'with a condition'),
      refused: t('analysis.venue.a.refused', 'refused'),
      pending: t('analysis.venue.a.pending', 'no answer yet'),
      elsewhere: t('analysis.venue.a.elsewhere', 'answer from a different venue'),
      stale: t('analysis.venue.a.stale', 'answer to a point the plan no longer raises'),
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
  const exportPtp = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'zeit-plan-ptp', 'csv'),
      csvFromTable(ptpTable(ptp)),
      'text/csv',
    )
  }
  const exportCrew = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'netz-merkblatt-crew', 'csv'),
      csvFromTable(crewSheetTable(crew)),
      'text/csv',
    )
  }

  const exportAddressPlan = () => {
    const csvRows = addressPlanTable(plan, label, [
      t('analysis.network.device', 'Device'),
      'IP',
      t('analysis.address.mask', 'Mask'),
      'Gateway',
      t('analysis.network.subnets', 'Subnets'),
      t('analysis.address.evidence', 'Evidence'),
      t('analysis.address.finding', 'Finding'),
    ])
    downloadBlob(buildExportFilenameWithSuffix(projectName, 'adressplan', 'csv'), toCsv(csvRows), 'text/csv')
  }

  return (
    <div className="space-y-3 p-4 text-cp-base">
      <p className="text-cp-xs text-[var(--cp-text-muted)]">
        {t('analysis.network.intro', 'IP/VLAN overview of all network-capable devices with duplicate-IP detection.')}
      </p>
      <div>
        <RechnerLink
          onClick={() => useUiStore.getState().openBandwidthCalc()}
          label={t('app.menu.tools.bandwidth', 'Calculate bandwidth…')}
        />
      </div>
      {duplicates.length > 0 && (
        <div className="rounded border border-red-700/60 bg-red-900/30 p-2 text-cp-xs text-red-200">
          <div className="mb-1 font-semibold">{t('analysis.network.dupTitle', 'Duplicate IP addresses')}</div>
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
            {t('analysis.network.danteTitle', 'Check Dante/AES67 names (≤31 chars, a–z/0–9/-)')}
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
      <table className="block overflow-x-auto w-full text-cp-xs">
        <thead>
          <tr className="border-b border-[var(--cp-border)] text-left text-[var(--cp-text-muted)]">
            <th className="py-1 pr-2">{t('analysis.network.device', 'Device')}</th>
            <th className="py-1 pr-2">IP</th>
            <th className="py-1 pr-2">{t('analysis.network.mgmtVlan', 'Mgmt VLAN')}</th>
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
                {t('analysis.network.empty', 'No devices with network data.')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {vlanCounts.length > 0 && (
        <p className="text-cp-xs text-[var(--cp-text-faint)]">
          {t('analysis.network.vlanSummary', 'Devices per VLAN')}:{' '}
          {vlanCounts.map((v) => `VLAN ${v.id} (${v.count})`).join(' · ')}
        </p>
      )}
      {/* BEDARF 116 — die Segmente. Sie stehen ZWISCHEN der VLAN-Zeile
          darueber (welche Ids kommen vor) und den Subnetzen darunter: erst
          die Zahl, dann ihre Bedeutung, dann die Adressen. */}
      <SegmentsPanel projectName={projectName} />

      {/* BEDARF 20 — die Adressbereiche. Sie stehen NACH den Segmenten und VOR
          der Subnetz-Uebersicht: das Segment sagt, wofuer eine VLAN da ist,
          der Bereich sagt, welche Adressen darin gelten, und die Uebersicht
          darunter zeigt, was tatsaechlich vergeben wurde. */}
      <AddressTemplatePanel projectName={projectName} />

      {/* #346 — IPAM: Subnetz-Übersicht. */}
      {subnets.length > 0 && (
        <div className="rounded border border-[var(--cp-border-muted)] bg-[var(--cp-surface-3)] p-2 text-cp-xs">
          <div className="mb-1 font-semibold text-[var(--cp-text-muted)]">
            {t('analysis.network.subnets', 'Subnets')} ({subnets.length})
          </div>
          <ul className="space-y-0.5">
            {subnets.map((s) => (
              <li key={s.cidr} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono font-semibold">{s.cidr}</span>
                <span className="text-[var(--cp-text-muted)]">
                  {format(t('analysis.network.subnetCount', '{n} devices'), { n: s.names.length })}
                </span>
                {s.assumed && (
                  <span className="text-cp-xs text-amber-300/80" title={t('analysis.network.subnetAssumedTitle', 'No mask set — /24 assumed')}>
                    {t('analysis.network.subnetAssumed', '(/24 assumed)')}
                  </span>
                )}
                <span className="text-cp-xs text-[var(--cp-text-faint)]">
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
              {t('analysis.address.title', 'Address plan')}
            </span>
            <span className="text-[var(--cp-text-faint)]">
              {format(
                t('analysis.address.coverage', '{done} of {total} networked devices addressed'),
                { done: plan.networkedCount - plan.missing.length, total: plan.networkedCount },
              )}
            </span>
          </div>
          {plan.withIssues.length === 0 ? (
            <p className="text-[var(--cp-text-faint)]">
              {t('analysis.address.clean', 'Nothing open: every networked device has an address, a mask and a gateway that fits.')}
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
                    <span className="text-cp-xs text-[var(--cp-text-faint)]">{r.evidence}</span>
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
            <span className="font-semibold">{t('analysis.switchPorts.title', 'Switch port map')}</span>
            <span className="text-cp-xs text-[var(--cp-text-muted)]">
              {format(t('analysis.switchPorts.count', '{n} switches'), { n: portMaps.length })}
            </span>
          </div>
          {portMaps.map((m) => (
            <div key={m.switchId} className="mb-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-cp-xs font-medium">{m.switchName}</span>
                <div className="flex items-center gap-1">
                  <span className="text-cp-xs text-[var(--cp-text-faint)]">
                    {format(t('analysis.switchPorts.used', '{u} of {n} occupied'), {
                      u: m.usedCount,
                      n: m.rows.length,
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => exportPortMap(m)}
                    className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-1.5 py-0.5 text-cp-xs hover:bg-[var(--cp-surface-2)]"
                  >
                    <Icon icon={Download} size="xs" /> CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => exportPortDescriptions(m)}
                    title={t(
                      'analysis.switchPorts.descHint',
                      'Vendor-neutral text to paste. The plan sends nothing to the switch \u2014 read what you paste.',
                    )}
                    className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-1.5 py-0.5 text-cp-xs hover:bg-[var(--cp-surface-2)]"
                  >
                    <Icon icon={Download} size="xs" />{' '}
                    {t('analysis.switchPorts.descriptions', 'Descriptions')}
                  </button>
                </div>
              </div>
              <ul className="flex flex-col gap-0.5">
                {m.rows.map((r) => (
                  <li key={r.port} className="flex items-center gap-2 text-cp-xs">
                    <span className="w-14 shrink-0 font-mono text-[var(--cp-text-muted)]">{r.port}</span>
                    <span className={r.device ? '' : 'text-[var(--cp-text-faint)]'}>
                      {r.device ?? t('analysis.switchPorts.free', 'free')}
                    </span>
                    {r.nicLabel && (
                      <span className="text-cp-xs text-[var(--cp-text-faint)]">{r.nicLabel}</span>
                    )}
                    {r.ipAddress && <span className="font-mono text-cp-xs">{r.ipAddress}</span>}
                    {r.vlanId !== undefined && (
                      <span className="text-cp-xs text-[var(--cp-text-muted)]">VLAN {r.vlanId}</span>
                    )}
                    {r.source && (
                      <span className="text-cp-xs text-[var(--cp-text-faint)]">
                        {r.source === 'interface'
                          ? t('analysis.switchPorts.fromNic', 'interface')
                          : t('analysis.switchPorts.fromCable', 'cable')}
                      </span>
                    )}
                    {r.conflict && (
                      <span className="text-amber-300/90">
                        {format(t('analysis.switchPorts.conflict', 'cable says: {name}'), {
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
          <span className="font-semibold">{t('analysis.venue.title', 'Request to the venue IT')}</span>
          <button
            type="button"
            onClick={exportVenueRequest}
            className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs font-medium text-[var(--cp-text)] hover:bg-[var(--cp-surface-2)]"
          >
            <Icon icon={Download} size="xs" /> CSV
          </button>
        </div>
        <PanelHint className="mb-1.5 text-cp-xs text-[var(--cp-text-muted)]" text={t(
          'analysis.venue.intro',
          'The design literature prescribes the content and a joint test session, but no document. What the plan knows is stated with a number; what it cannot know is stated as a question.',
        )} />
        {request.igmpConflict && (
          <div className="mb-1.5 rounded border border-amber-700/60 bg-amber-900/20 p-2 text-cp-xs text-amber-200">
            {format(
              t(
                'analysis.venue.igmpConflict',
                'The plan carries both: {audio} (audio vendors\u2019 field advice: turn IGMP snooping off) and {video} (does not work without multicast management). On a shared network those two pieces of advice are mutually exclusive \u2014 that belongs before the build, not into the night.',
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
                  <span className="w-full pl-52 text-cp-xs text-[var(--cp-text-faint)]">{i.source}</span>
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
                      className={`rounded border px-1.5 py-0.5 text-cp-xs ${
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
                      placeholder={t('analysis.venue.a.notePh', 'condition or workaround, in plain words')}
                      className="min-w-0 flex-1 rounded border border-[var(--cp-border)] bg-transparent px-1.5 py-0.5 text-cp-xs text-[var(--cp-text)] outline-none placeholder:text-[var(--cp-text-faint)]"
                    />
                  )}
                </span>
                {antwort?.state === 'elsewhere' && (
                  <span className="w-full pl-52 text-cp-xs text-amber-300/90">
                    {format(
                      t(
                        'analysis.venue.a.elsewhereHint',
                        'This answer was given for {dort}; this project is at {hier}. It does not apply here until somebody asks again.',
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
          <div className="mt-2 border-t border-[var(--cp-border-muted)] pt-2 text-cp-xs text-[var(--cp-text-faint)]">
            {t(
              'analysis.venue.a.staleHead',
              'Answers to points the plan no longer raises — knowledge about the venue, not rubbish:',
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
              t('analysis.venue.a.open', '{n} points to call back about: {liste}'),
              {
                n: String(offen.length),
                liste: offen.map((r) => venueItemLabel(r.key)).join(', '),
              },
            )}
          </div>
        )}
      </div>

      {/* BEDARF 73 — der Zeit-Plan. Nur sichtbar, wenn der Plan ueberhaupt
          PTP-abhaengige Essenz traegt: ein reiner SDI-Aufbau braucht diesen
          Abschnitt nicht, und ihn dort leer anzuzeigen waere Rauschen. */}
      {ptp.needsPtp && (
        <div className="rounded-cp-panel border border-[var(--cp-border)] bg-[var(--cp-surface-1)] p-cp-3">
          <div className="mb-2 text-cp-sm font-semibold text-[var(--cp-text)]">
            {t('analysis.ptp.title', 'Timing (PTP)')}
          </div>
          <div className="mb-2 text-cp-xs text-[var(--cp-text-muted)]">
            {t(
              'analysis.ptp.intro',
              'ST 2059-2 defaults to domain 127, AES67 in practice to 0. A mixed rig on one shared domain leaves one of the two families on the wrong media clock \u2014 and reports no error while doing it.',
            )}
          </div>
          {ptp.domains.length === 0 ? (
            <div className="text-cp-xs text-amber-300/90">
              {t(
                'analysis.ptp.none',
                'The plan carries PTP-dependent essence, but not one interface names a domain. The fields sit on the interface in the device panel.',
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5 text-cp-xs">
              {ptp.domains.map((d) => (
                <li key={d.domain} className="flex flex-wrap items-baseline gap-2">
                  <span className="w-28 shrink-0 font-mono text-[var(--cp-text-muted)]">
                    {t('analysis.ptp.domain', 'Domain {n}').replace('{n}', String(d.domain))}
                  </span>
                  <span className="flex-1 text-[var(--cp-text)]">
                    {d.members.map((m) => m.label).join(', ')}
                  </span>
                  <span className="shrink-0 text-[var(--cp-text-faint)]">
                    {d.grandmasters.length
                      ? d.grandmasters.join(', ')
                      : t('analysis.ptp.noGm', 'no clock named')}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {ptp.withoutDomain.length > 0 && (
            <div className="mt-2 text-cp-xs text-[var(--cp-text-faint)]">
              {format(
                t(
                  'analysis.ptp.withoutDomain',
                  '{n} devices carry PTP-dependent essence and name no domain: {liste}',
                ),
                {
                  n: String(ptp.withoutDomain.length),
                  liste: ptp.withoutDomain
                    .map((id) => equipment.find((e) => e.id === id)?.name ?? id)
                    .join(', '),
                },
              )}
            </div>
          )}
          {ptp.findings.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {ptp.findings.map((f, i) => (
                <li key={`${f.kind}-${f.domain}-${i}`} className="text-cp-xs">
                  <span
                    className={
                      f.kind === 'off-default'
                        ? 'text-[var(--cp-text-muted)]'
                        : 'text-amber-300/90'
                    }
                  >
                    <strong>{PTP_FINDING_LABEL[f.kind]}</strong> — {f.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* BEDARF 78 — welche Kiste den Platz füllt. Nur sichtbar, wenn der
          Plan überhaupt Plätze mit Netz-Identität trägt: an einem reinen
          SDI-Aufbau gibt es keinen eingebrannten Geräte-Namen, der beim
          Tausch mitwandern könnte. */}
      {asset.hasAnchored && (
        <div className="rounded-cp-panel border border-[var(--cp-border)] bg-[var(--cp-surface-1)] p-cp-3">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <div className="text-cp-sm font-semibold text-[var(--cp-text)]">
              {t('analysis.asset.title', 'Which box fills which slot')}
            </div>
            <button
              type="button"
              onClick={exportAsset}
              className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-0.5 text-cp-xs text-[var(--cp-text)] hover:bg-[var(--cp-surface-2)]"
            >
              <Icon icon={Download} size="xs" /> {t('analysis.asset.export', 'Sheet')}
            </button>
          </div>
          <div className="mb-2 text-cp-xs text-[var(--cp-text-muted)]">
            {t(
              'analysis.asset.intro',
              'Two identical stageboxes are one box on the plan, two units in the warehouse and two different devices on the network \u2014 each with its own burned-in name and its own MAC. A swap on load-in day only surfaces during rehearsal. Only records are compared here; what is actually in the rack, the plan does not know.',
            )}
          </div>
          <ul className="flex flex-col gap-0.5 text-cp-xs">
            {asset.rows.map((r) => (
              <li key={r.equipmentId} className="flex flex-wrap items-baseline gap-2">
                <span className="flex-1 text-[var(--cp-text)]">{r.name}</span>
                <span className="w-48 shrink-0 text-[var(--cp-text-faint)]">
                  {r.anchors.map((x) => IDENTITY_ANCHOR_LABEL[x]).join(', ')}
                </span>
                <span
                  className={`w-40 shrink-0 font-mono ${
                    r.unitId ? 'text-[var(--cp-text)]' : 'text-amber-300/90'
                  }`}
                >
                  {r.unitSerial ?? (r.unitId ? r.unitId : t('analysis.asset.none', 'not stated'))}
                </span>
              </li>
            ))}
          </ul>
          {asset.findings.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {asset.findings.map((f, i) => (
                <li key={`${f.kind}-${f.equipmentId}-${i}`} className="text-cp-xs text-amber-300/90">
                  <strong>{ASSET_FINDING_LABEL[f.kind]}</strong> — {f.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* BEDARF 72 — der Multicast-Adressplan. Nur sichtbar, wenn der Plan
          ueberhaupt Multicast-Essenz traegt: ein reiner SDI-Aufbau hat keine
          Gruppen, und ein leerer Abschnitt waere Rauschen. */}
      {multicast.needsMulticast && (
        <div className="rounded-cp-panel border border-[var(--cp-border)] bg-[var(--cp-surface-1)] p-cp-3">
          <div className="mb-2 text-cp-sm font-semibold text-[var(--cp-text)]">
            {t('analysis.mc.title', 'Multicast address plan')}
          </div>
          <div className="mb-2 text-cp-xs text-[var(--cp-text-muted)]">
            {t(
              'analysis.mc.intro',
              'Every essence is its own group, and the group belongs to the sender \u2014 five receivers on one camera subscribe to one, not five. Two rules a table never shows: address and port must be unique together, and 32 groups collapse onto the same L2 address. That is why the MAC is on the sheet.',
            )}
          </div>

          <div className="mb-2 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-cp-xs text-[var(--cp-text-muted)]">
                {t('analysis.mc.pool', 'Pool (CIDR)')}
              </span>
              <input
                value={poolDraft}
                onChange={(e) => setPoolDraft(e.target.value)}
                onBlur={rahmenUebernehmen}
                placeholder="239.100.0.0/16"
                className="w-44 rounded border border-[var(--cp-border)] bg-[var(--cp-surface-2)] px-2 py-1 font-mono text-cp-xs text-[var(--cp-text)]"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-cp-xs text-[var(--cp-text-muted)]">
                {t('analysis.mc.port', 'UDP port')}
              </span>
              <input
                value={portDraft}
                onChange={(e) => setPortDraft(e.target.value)}
                onBlur={rahmenUebernehmen}
                inputMode="numeric"
                className="w-24 rounded border border-[var(--cp-border)] bg-[var(--cp-surface-2)] px-2 py-1 font-mono text-cp-xs text-[var(--cp-text)]"
              />
            </label>
            <button
              type="button"
              onClick={vergeben}
              disabled={!multicast.pool || multicast.open.length === 0}
              className="rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs font-medium text-[var(--cp-text)] hover:bg-[var(--cp-surface-2)] disabled:opacity-40"
            >
              {format(t('analysis.mc.allocate', 'Allocate {n} open legs'), {
                n: String(multicast.open.length),
              })}
            </button>
          </div>

          {multicast.poolError && (
            <div className="mb-2 text-cp-xs text-amber-300/90">{multicast.poolError}</div>
          )}
          {!multicast.pool && !multicast.poolError && (
            <div className="mb-2 text-cp-xs text-[var(--cp-text-faint)]">
              {t(
                'analysis.mc.noPool',
                'No pool declared \u2014 nothing is allocated. A pool of /9 or narrower cannot collide with itself; only a wider one frees the bit that drops 32 groups onto one MAC.',
              )}
            </div>
          )}

          <ul className="flex flex-col gap-0.5 text-cp-xs">
            {multicast.flows.map((f) =>
              f.legs.map((leg) => {
                const a = multicast.assignments.find((x) => x.flowKey === f.key && x.leg === leg)
                return (
                  <li key={`${f.key}-${leg}`} className="flex flex-wrap items-baseline gap-2">
                    <span className="flex-1 text-[var(--cp-text)]">{f.label}</span>
                    <span className="w-20 shrink-0 text-[var(--cp-text-muted)]">
                      {MULTICAST_ESSENCE_LABEL[f.essence]}
                    </span>
                    <span className="w-24 shrink-0 text-[var(--cp-text-faint)]">
                      {MULTICAST_LEG_LABEL[leg]}
                    </span>
                    <span
                      className={`w-32 shrink-0 font-mono ${
                        a ? 'text-[var(--cp-text)]' : 'text-amber-300/90'
                      }`}
                    >
                      {a ? a.address : t('analysis.mc.open', 'open')}
                    </span>
                    <span className="w-40 shrink-0 font-mono text-[var(--cp-text-faint)]">
                      {a ? (multicastMac(a.address) ?? '') : ''}
                    </span>
                  </li>
                )
              }),
            )}
          </ul>

          {multicast.stale.length > 0 && (
            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <span className="text-cp-xs text-[var(--cp-text-faint)]">
                {format(
                  t(
                    'analysis.mc.stale',
                    '{n} assignment(s) belong to flows that no longer exist: {liste}',
                  ),
                  {
                    n: String(multicast.stale.length),
                    liste: multicast.stale.map((a) => a.address).join(', '),
                  },
                )}
              </span>
              <button
                type="button"
                onClick={verwaisteEntfernen}
                className="rounded border border-[var(--cp-border)] px-2 py-0.5 text-cp-xs text-[var(--cp-text)] hover:bg-[var(--cp-surface-2)]"
              >
                {t('analysis.mc.dropStale', 'Remove orphaned')}
              </button>
            </div>
          )}

          {multicast.findings.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {multicast.findings.map((f, i) => (
                <li key={`${f.kind}-${i}`} className="text-cp-xs">
                  <span
                    className={
                      f.kind === 'outside-pool'
                        ? 'text-[var(--cp-text-muted)]'
                        : 'text-amber-300/90'
                    }
                  >
                    <strong>{MULTICAST_FINDING_LABEL[f.kind]}</strong> — {f.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* BEDARF 77 — das Merkblatt. Kurz gehalten: es soll auf eine Seite
          passen und von jemandem gelesen werden, der gerade ein Kabel in der
          Hand hat. Was der Plan nicht weiss, steht als Frage drauf statt als
          Luecke — eine leere Zeile liest sich wie „gibt es nicht". */}
      <div className="rounded-cp-panel border border-[var(--cp-border)] bg-[var(--cp-surface-1)] p-cp-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <div className="text-cp-sm font-semibold text-[var(--cp-text)]">
            {t('analysis.crew.title', 'Network briefing sheet for the crew')}
          </div>
          {crew.askCount > 0 && (
            <div className="text-cp-xs text-amber-300/90">
              {format(t('analysis.crew.ask', '{n} points to settle on site'), {
                n: String(crew.askCount),
              })}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {crew.sections
            .filter((sec) => sec.lines.length > 0)
            .map((sec) => (
              <div key={sec.key}>
                <div className="text-cp-xs font-semibold text-[var(--cp-text-muted)]">
                  {CREW_SECTION_LABEL[sec.key]}
                </div>
                <ul className="flex flex-col gap-0.5">
                  {sec.lines.map((l) => (
                    <li
                      key={l.key}
                      className={`text-cp-xs ${
                        l.origin === 'ask' ? 'text-amber-300/90' : 'text-[var(--cp-text)]'
                      }`}
                    >
                      {l.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={exportRackDoor}
          className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs font-medium text-[var(--cp-text)] hover:bg-[var(--cp-surface-2)]"
        >
          <Icon icon={Download} size="xs" /> {t('analysis.venue.rackDoor', 'Rack-door sheet')}
        </button>
        <button
          type="button"
          onClick={exportVenueAnswers}
          className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs font-medium text-[var(--cp-text)] hover:bg-[var(--cp-surface-2)]"
        >
          <Icon icon={Download} size="xs" /> {t('analysis.venue.a.export', 'Question and answer')}
        </button>
        <button
          type="button"
          onClick={exportVlans}
          className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs font-medium text-[var(--cp-text)] hover:bg-[var(--cp-surface-2)]"
        >
          <Icon icon={Download} size="xs" /> {t('analysis.venue.vlanTable', 'VLAN table')}
        </button>
        <button
          type="button"
          onClick={exportPtp}
          disabled={ptp.domains.length === 0}
          className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs font-medium text-[var(--cp-text)] hover:bg-[var(--cp-surface-2)] disabled:opacity-40"
        >
          <Icon icon={Download} size="xs" /> {t('analysis.ptp.export', 'Timing plan (PTP)')}
        </button>
        <button
          type="button"
          onClick={exportMulticast}
          disabled={!multicast.needsMulticast}
          className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs font-medium text-[var(--cp-text)] hover:bg-[var(--cp-surface-2)] disabled:opacity-40"
        >
          <Icon icon={Download} size="xs" /> {t('analysis.mc.export', 'Multicast address plan')}
        </button>
        <button
          type="button"
          onClick={exportCrew}
          className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs font-medium text-[var(--cp-text)] hover:bg-[var(--cp-surface-2)]"
        >
          <Icon icon={Download} size="xs" /> {t('analysis.crew.export', 'Crew network sheet')}
        </button>
        <button
          type="button"
          onClick={exportAddressPlan}
          disabled={plan.networkedCount === 0}
          className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs font-medium text-[var(--cp-text)] hover:bg-[var(--cp-surface-2)] disabled:opacity-40"
        >
          <Icon icon={Download} size="xs" /> {t('analysis.address.export', 'Address plan as CSV')}
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
              ? t('analysis.redundancy.noPower', 'no power connection in the plan')
              : t('analysis.redundancy.singlePower', 'only one power connection (no PSU redundancy)'),
        })
      }
      // #352 — ST 2110-7: Geräte im 2110-Pfad sollten zwei unabhängige
      // Netzwerk-Pfade (Red/Blue) haben. Nur ein Netzwerk-Link → keine
      // nahtlose Protection.
      if (row.st2110 && row.network <= 1) {
        out.push({
          name: e.name,
          reason: t('analysis.redundancy.st2110', 'ST 2110 without 2110-7 redundancy (only one network path)'),
        })
      }
    }
    return out
  }, [project, t])

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      [t('analysis.redundancy.device', 'Device'), t('analysis.redundancy.finding', 'Finding')],
      ...flagged.map((f) => [f.name, f.reason]),
    ]
    downloadBlob(buildExportFilenameWithSuffix(projectName, 'redundanz', 'csv'), toCsv(rows), 'text/csv')
  }

  return (
    <div className="space-y-3 p-4 text-cp-base">
      <p className="text-cp-xs text-[var(--cp-text-muted)]">
        {t(
          'analysis.redundancy.intro',
          'Heuristic for potential single points of failure: devices that draw power but have at most one power connection (layer "Power").',
        )}
      </p>
      {flagged.length === 0 ? (
        <p className="text-cp-xs text-emerald-300">
          {t('analysis.redundancy.none', 'No obvious single power feeds found.')}
        </p>
      ) : (
        <table className="block overflow-x-auto w-full text-cp-xs">
          <thead>
            <tr className="border-b border-[var(--cp-border)] text-left text-[var(--cp-text-muted)]">
              <th className="py-1 pr-2">{t('analysis.redundancy.device', 'Device')}</th>
              <th className="py-1">{t('analysis.redundancy.finding', 'Finding')}</th>
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

  // BEDARF 95 — EIN Spektrum-Plan. Bis 2026-09-06 stand hier eine eigene
  // IM3-Schleife im Komponenten-Rumpf, die nur die KABEL-Strecken kannte,
  // waehrend `deriveRig` dieselbe Rechnung fuer die Rig-Kanaele machte. Eine
  // Handmikrofon-Strecke und ein Kamera-Funklink auf benachbarten Frequenzen
  // begegneten sich in keiner der beiden — und die beiden waren sich nicht
  // einmal einig, was ein Konflikt ist. Jetzt sammelt `buildSpectrumPlan`
  // ALLES, was funkt, und `computeRfConflicts` laeuft genau einmal darueber.
  const spectrum = useMemo(() => buildSpectrumPlan(project), [project])

  // BEDARF 112 — der Scan vor Ort. Ein Scan ist KEIN Sender und geht deshalb
  // nicht in `collectTransmitters` ein: was dort steht, sind Traeger, aus
  // denen Intermodulation gerechnet wird, und eine Messung ist ein
  // Pegelverlauf, dessen Spitzen auch eine Reflexion sein koennen. Er wird
  // GEGEN den Plan gehalten, nicht in ihn hinein.
  const [scan, setScan] = useState<SpectrumScan | null>(null)
  const [schwelle, setSchwelle] = useState(DEFAULT_OCCUPIED_DBM)
  const carrierChecks = useMemo(
    () => (scan ? checkCarriers(scan, spectrum.entries, schwelle) : []),
    [scan, spectrum, schwelle],
  )
  const scanBefunde = useMemo(
    () => (scan ? scanFindings(scan, carrierChecks, schwelle) : []),
    [scan, carrierChecks, schwelle],
  )
  const scanSpanne = useMemo(() => (scan ? scannedRange(scan) : null), [scan])

  const links = useMemo(() => {
    const nameOf = new Map(project.equipment.map((e) => [e.id, e.name]))
    return project.cables
      .filter((c) => c.wireless || parseFreqMHz(c.frequency) != null)
      .map((c) => ({
        name: c.name || '—',
        frequency: c.frequency ?? '',
        mhz: parseFreqMHz(c.frequency),
        channel: c.wifiChannel ?? '',
        from: nameOf.get(c.fromEquipmentId) ?? '?',
        to: nameOf.get(c.toEquipmentId) ?? '?',
      }))
  }, [project])

  // Gleicher WLAN-Kanal ist KEINE Frequenz-Frage und bleibt deshalb hier:
  // `computeRfConflicts` rechnet in MHz, ein Kanal-Bezeichner („36", „149")
  // ist eine Zeichenkette aus einer anderen Welt.
  const channelConflicts = useMemo(() => {
    const out: string[] = []
    for (let i = 0; i < links.length; i++) {
      for (let j = i + 1; j < links.length; j++) {
        const a = links[i]
        const b = links[j]
        if (a.channel && a.channel === b.channel) {
          out.push(
            format(t('analysis.rf.conflictChannel', '{a} ↔ {b}: same channel {ch}'), {
              a: a.name,
              b: b.name,
              ch: a.channel,
            }),
          )
        }
      }
    }
    return out
  }, [links, t])

  // Die Frequenz-Befunde in Worten — mit Geraet UND Traeger, weil „Lead Vox
  // gegen Kamera 2 Rueckweg" eine Handlungsanweisung ist und „606.4 gegen
  // 606.5" eine Zahlenkolonne.
  const rfFindings = useMemo(
    () =>
      spectrum.conflicts.map((c) => {
        const wer = conflictParticipants(spectrum, c)
          .map((e) =>
            e.carrier
              ? `${e.label} (${SPECTRUM_SOURCE_LABEL[e.source]}: ${e.carrier})`
              : `${e.label} (${SPECTRUM_SOURCE_LABEL[e.source]})`,
          )
          .join(' ↔ ')
        return { kind: c.kind, text: wer ? `${wer} — ${c.message}` : c.message }
      }),
    [spectrum],
  )

  const suggestion = useMemo(() => {
    const band = RF_BANDS[bandIdx] ?? RF_BANDS[0]
    // Belegt ist ALLES, was funkt — nicht nur die Kabel-Strecken. Ein
    // Vorschlag, der die Rig-Kanaele nicht kennt, schlaegt eine besetzte
    // Frequenz vor.
    const occupied = spectrum.entries.map((e) => e.mhz)
    return { band, freqs: suggestFreqs(band.fromMHz, band.toMHz, occupied, 8) }
  }, [bandIdx, spectrum])

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      [
        t('analysis.rf.link', 'Wireless link'),
        t('analysis.rf.freq', 'Frequency'),
        t('analysis.rf.band', 'Band'),
        t('analysis.rf.channel', 'Channel'),
        t('analysis.rf.from', 'From'),
        t('analysis.rf.to', 'To'),
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

  // BEDARF 95 — das Blatt ueber ALLES, was funkt. Der RF-Export darueber
  // listet nur die Kabel-Strecken; er bleibt, weil er Band und WLAN-Kanal
  // traegt, die das Spektrum-Blatt nicht kennt.
  const exportSpectrum = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'spektrum-plan', 'csv'),
      csvFromTable(spectrumTable(spectrum)),
      'text/csv',
    )
  }

  return (
    <div className="space-y-3 p-4 text-cp-base">
      <PanelHint className="mb-2 text-cp-xs text-[var(--cp-text-muted)]" text={t(
          'analysis.rf.intro',
          'Everything that transmits in the plan \u2014 wireless mic rig AND radio links, in one calculation. Conflict heuristic: frequency spacing, 3rd-order intermodulation (2\u00b7f\u2081\u2212f\u2082, the most common interference source for wireless mics/IEM) and same Wi-Fi channel. The table below shows only the radio links, because only they carry band and channel.',
        )} />
      {/* BEDARF 95 — der Umfang der Rechnung steht ueber ihrem Ergebnis. Eine
          Intermodulations-Rechnung, die drei von acht Sendern nicht kennt,
          sagt „frei" und meint „ich habe nicht nachgesehen". */}
      <div className="rounded border border-[var(--cp-border)] bg-[var(--cp-surface-2)] p-2 text-cp-xs">
        {format(
          t('analysis.rf.scope', '{n} transmitters in the plan: {rig} from the wireless mic rig, {link} as radio links.'),
          {
            n: String(spectrum.entries.length),
            rig: String(spectrum.entries.filter((e) => e.source === 'rig').length),
            link: String(spectrum.entries.filter((e) => e.source === 'link').length),
          },
        )}
        {spectrum.withoutFrequency.length > 0 && (
          <span className="ml-1 text-amber-300/90">
            {format(
              t('analysis.rf.noFreq', '{n} without a frequency \u2014 they are in NO calculation: {liste}'),
              {
                n: String(spectrum.withoutFrequency.length),
                liste: spectrum.withoutFrequency.join(', '),
              },
            )}
          </span>
        )}
      </div>
      {channelConflicts.length > 0 && (
        <div className="rounded border border-red-700/60 bg-red-900/30 p-2 text-cp-xs text-red-200">
          <div className="mb-1 font-semibold">{t('analysis.rf.conflictTitle', 'Possible RF conflicts')}</div>
          <ul className="list-inside list-disc">
            {channelConflicts.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      {rfFindings.length > 0 && (
        <div className="rounded border border-amber-700/60 bg-amber-900/30 p-2 text-cp-xs text-amber-200">
          <div className="mb-1 font-semibold">
            {t('analysis.rf.imTitle', 'Frequency findings across the whole spectrum')} ({rfFindings.length})
          </div>
          <ul className="list-inside list-disc">
            {rfFindings.slice(0, 20).map((f, i) => (
              <li key={i}>{f.text}</li>
            ))}
            {rfFindings.length > 20 && (
              <li className="text-amber-300/80">
                {format(t('analysis.rf.imMore', '+{n} more'), { n: rfFindings.length - 20 })}
              </li>
            )}
          </ul>
        </div>
      )}
      {/* #344 — Freie-Frequenz-Vorschlag im gewählten Band. */}
      <div className="rounded border border-emerald-700/60 bg-emerald-950/20 p-2 text-cp-xs">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[var(--cp-text-muted)]">
            {t('analysis.rf.suggestTitle', 'Free frequencies in band')}
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
            {t('analysis.rf.suggestNone', 'No conflict-free frequency found (band full/overlapping).')}
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
        <p className="mt-1.5 text-cp-xs text-[var(--cp-text-faint)]">
          {t('analysis.rf.suggestNote', 'Free of occupancy + 3rd-order intermodulation (0.4 MHz guard); suggestions mutually compatible.')}
        </p>
      </div>

      <table className="block overflow-x-auto w-full text-cp-xs">
        <thead>
          <tr className="border-b border-[var(--cp-border)] text-left text-[var(--cp-text-muted)]">
            <th className="py-1 pr-2">{t('analysis.rf.link', 'Wireless link')}</th>
            <th className="py-1 pr-2">{t('analysis.rf.freq', 'Frequency')}</th>
            <th className="py-1 pr-2">{t('analysis.rf.band', 'Band')}</th>
            <th className="py-1 pr-2">{t('analysis.rf.channel', 'Channel')}</th>
            <th className="py-1 pr-2">{t('analysis.rf.from', 'From')}</th>
            <th className="py-1">{t('analysis.rf.to', 'To')}</th>
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
                {t('analysis.rf.empty', 'No wireless links in the plan.')}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* #344 — Referenz: gängige Hersteller-Frequenzbänder. */}
      <details className="rounded border border-[var(--cp-border-muted)] bg-[var(--cp-surface-3)]">
        <summary className="cursor-pointer px-3 py-1.5 text-cp-xs uppercase tracking-wide text-[var(--cp-text-muted)]">
          {t('analysis.rf.bandRef', 'Frequency bands (Sennheiser / Shure / …)')} ({RF_BANDS.length})
        </summary>
        <div className="px-3 py-2">
          <table className="block overflow-x-auto w-full text-cp-xs">
            <thead className="text-[var(--cp-text-faint)]">
              <tr className="text-left">
                <th className="py-0.5 pr-2">{t('analysis.rf.bandMfr', 'Manufacturer')}</th>
                <th className="py-0.5 pr-2">{t('analysis.rf.bandLine', 'Series')}</th>
                <th className="py-0.5 pr-2">{t('analysis.rf.band', 'Band')}</th>
                <th className="py-0.5 pr-2 text-right">MHz</th>
                <th className="py-0.5">{t('analysis.rf.bandNote', 'Note')}</th>
              </tr>
            </thead>
            <tbody>
              {RF_BANDS.map((b, i) => (
                <tr key={i} className="border-t border-[var(--cp-border-muted)]">
                  <td className="py-0.5 pr-2">{b.mfr}</td>
                  <td className="py-0.5 pr-2 text-[var(--cp-text-muted)]">{b.line}</td>
                  <td className="py-0.5 pr-2 font-mono font-semibold">{b.band}</td>
                  <td className="py-0.5 pr-2 text-right font-mono">{b.fromMHz}–{b.toMHz}</td>
                  <td className="py-0.5 text-cp-xs text-[var(--cp-text-faint)]">{b.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <PanelHint className="mt-2 text-cp-xs text-[var(--cp-text-faint)]" text={t(
          'analysis.rf.bandDisclaimer',
          'Common nominal ranges — band letters are series/region dependent. Always verify against the current datasheet and local frequency regulations.',
        )} />
        </div>
      </details>

      {/* BEDARF 112 — die Messung gegen den Plan. „Nicht gemessen" ist ein
          eigenes Urteil und keine Entwarnung: ein Scan von 470–608 MHz sagt
          ueber 614 MHz gar nichts. */}
      <div className="rounded border border-[var(--cp-border)] p-2">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-cp-xs">
          <span className="font-medium">
            {t('scan.title', 'Spectrum scan from the analyser')}
          </span>
          <label className="cursor-pointer rounded border border-[var(--cp-border)] px-2 py-1 hover:bg-[var(--cp-surface-2)]">
            {t('scan.import', '📈 Read scan')}
            <input
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                // Das Feld wird geleert, damit dieselbe Datei zweimal gewaehlt
                // werden kann — nach einem zweiten Scan heisst sie oft gleich.
                e.target.value = ''
                if (!f) return
                void f.text().then((text) => setScan(parseScanCsv(text, f.name)))
              }}
            />
          </label>
          {scan && (
            <>
              <span className="text-[var(--cp-text-secondary)]">
                {scan.fileName ? `${scan.fileName} · ` : ''}
                {format(t('scan.points', '{n} measurement points'), { n: String(scan.points.length) })}
                {scanSpanne ? ` · ${scanSpanne.fromMhz}–${scanSpanne.toMhz} MHz` : ''}
              </span>
              <label className="flex items-center gap-1">
                {t('scan.threshold', 'occupied from (dBm)')}
                <input
                  type="number"
                  value={schwelle}
                  onChange={(e) => setSchwelle(Number(e.target.value))}
                  title={t(
                    'scan.thresholdHint',
                    'What \u201Coccupied\u201D means depends on antenna, preamp and distance \u2014 none of which is in the file. That is why the threshold is a field, not a fixed value.',
                  )}
                  className="w-20 rounded border border-[var(--cp-border)] bg-[var(--cp-surface-1)] px-1 py-0.5"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  downloadBlob(
                    buildExportFilenameWithSuffix(projectName || 'cable-planner', 'scan-abgleich', 'csv'),
                    csvFromTable(carrierCheckTable(carrierChecks)),
                    'text/csv;charset=utf-8',
                  )
                }
                className="rounded border border-[var(--cp-border)] px-2 py-1 hover:bg-[var(--cp-surface-2)]"
              >
                {t('scan.exportCheck', 'Comparison')}
              </button>
            </>
          )}
        </div>
        {scanBefunde.length > 0 && (
          <ul className="flex flex-col gap-1 text-cp-xs">
            {scanBefunde.map((f, i) => (
              <li key={`${f.kind}-${i}`} className="text-amber-300/90">
                <strong>{SCAN_FINDING_LABEL[f.kind]}</strong> — {f.text}
              </li>
            ))}
          </ul>
        )}
        {scan && carrierChecks.length > 0 && (
          <table className="block overflow-x-auto mt-2 w-full text-cp-xs">
            <thead className="text-[var(--cp-text-secondary)]">
              <tr>
                <th className="px-2 py-1 text-left">{t('scan.what', 'What transmits')}</th>
                <th className="px-2 py-1 text-left">{t('scan.freq', 'MHz')}</th>
                <th className="px-2 py-1 text-left">{t('scan.verdict', 'Verdict')}</th>
                <th className="px-2 py-1 text-left">{t('scan.peak', 'Peak (dBm)')}</th>
              </tr>
            </thead>
            <tbody>
              {carrierChecks.map((c) => (
                <tr key={c.entry.id} className="border-t border-[var(--cp-border-muted)]">
                  <td className="px-2 py-1">{c.entry.label}</td>
                  <td className="px-2 py-1">{c.entry.mhz}</td>
                  <td
                    className={`px-2 py-1 ${c.verdict === 'occupied' ? 'text-cp-danger' : c.verdict === 'not-scanned' ? 'text-[var(--cp-text-muted)]' : ''}`}
                  >
                    {VERDICT_LABEL[c.verdict]}
                  </td>
                  <td className="px-2 py-1">
                    {c.peakDbm === undefined ? VERDICT_LABEL['not-scanned'] : c.peakDbm}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={exportSpectrum}
          disabled={spectrum.entries.length === 0}
          className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs font-medium text-[var(--cp-text)] hover:bg-[var(--cp-surface-2)] disabled:opacity-40"
        >
          <Icon icon={Download} size="xs" /> {t('analysis.rf.spectrumExport', 'Spectrum plan (everything that transmits)')}
        </button>
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
              'Length {alt} m was estimated; moved {px} px since, the estimate would now give {neu} m',
            ),
            { alt: f.values[0], neu: f.values[1], px: f.values[2] },
          )
        case 'over-max-length':
          return format(
            t('analysis.runs.overMax', 'Length {laenge} m beyond the reach of {max} m ({typ})'),
            { laenge: f.values[0], max: f.values[1], typ: f.values[2] },
          )
        case 'endpoint-missing':
          return t(
            'analysis.runs.endpointMissing',
            'Derived length, but an end device is gone \u2014 it can no longer be recomputed',
          )
      }
    })()
    return f.services
      ? `${kern} — ${format(t('analysis.runs.bundled', 'one run, {n} services: {liste}'), {
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
      <PanelHint className="mb-2 text-cp-xs text-[var(--cp-text-muted)]" text={t(
          'analysis.runs.intro',
          'Estimated lengths carry their origin. Move a device and the estimate goes stale \u2014 it is stated here instead of staying silent. Hand-entered lengths are NOT held against the straight line: a real cable run is laid, not stretched.',
        )} />

      {findings.length === 0 ? (
        <p className="text-cp-xs text-[var(--cp-text-muted)]">
          {t('analysis.runs.none', 'No findings: no stale estimate, no length beyond reach.')}
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
            return format(t('analysis.sheet.current', '{label}: state {stand} \u2014 current'), {
              label: r.label ?? '',
              stand: r.stand ?? '',
            })
          case 'stale':
            return format(
              t('analysis.sheet.stale', '{label}: state {stand} \u2014 SUPERSEDED, the plan has moved on'),
              { label: r.label ?? '', stand: r.stand ?? '' },
            )
          default:
            return format(
              t('analysis.sheet.unknown', '{label}: state {stand} \u2014 not judgeable ({grund})'),
              { label: r.label ?? '', stand: r.stand ?? '', grund: r.reason ?? '' },
            )
        }
      case 'matched-by-stand':
        return format(t('analysis.sheet.matched', '{label}: current (state {stand})'), {
          label: r.label ?? '',
          stand: r.stand ?? '',
        })
      case 'stale-or-foreign':
        return format(
          t(
            'analysis.sheet.foreign',
            'State {stand} belongs to no document of this plan \u2014 most likely a superseded printout',
          ),
          { stand: r.stand ?? '' },
        )
      case 'unreadable':
        return t(
          'analysis.sheet.unreadable',
          'Neither a document code nor a state \u2014 eight characters from the foot of the sheet, or the whole code',
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
      <PanelHint className="mb-2 text-cp-xs text-[var(--cp-text-muted)]" text={t(
          'analysis.sheet.intro',
          'A sheet in your hand: type the eight-character state from its foot, or read the whole document code. The answer says which document it is and whether the plan has moved on since.',
        )} />

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') pruefen()
          }}
          placeholder={t('analysis.sheet.placeholder', '1a2b3c4d or cableplanner://doc/\u2026')}
          aria-label={t('analysis.sheet.placeholder', '1a2b3c4d or cableplanner://doc/\u2026')}
          className="min-w-[16rem] flex-1 rounded border border-cp-border bg-cp-surface-3 p-1.5"
        />
        <button
          type="button"
          onClick={pruefen}
          disabled={!draft.trim()}
          className="rounded border border-cp-border px-2.5 py-1 text-cp-text-secondary hover:text-cp-text disabled:opacity-40"
        >
          {t('analysis.sheet.check', 'Check')}
        </button>
      </div>

      {treffer && <div className={`text-cp-sm ${ton(treffer)}`}>{text(treffer)}</div>}
    </div>
  )
}

/* ---------------------------------------------------- Kunden-Übersicht -- */

/**
 * BEDARF 81 — die Übersicht, die ein Kunde lesen kann.
 *
 * Die beiden Spalten, um die es geht, stehen NEBEN der Zahl und nicht am
 * Rand: „Anteil" nennt immer seinen Nenner, „Grundlage" sagt, ob die Zahl aus
 * dem Plan, aus dem As-Built oder aus einer Feld-Rückmeldung kommt. Ohne die
 * zweite liest ein Kunde jede Planzahl als Leistungsnachweis.
 */
const ClientTab = ({ projectName }: { projectName: string }) => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const summary = useMemo(() => clientSummary(project), [project])

  const exportCsv = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'kunden-uebersicht', 'csv'),
      csvFromTable(clientSummaryTable(project)),
      'text/csv',
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-cp-sm text-[var(--cp-text-secondary)]">
          {t('analysis.client.basis', 'Basis of this sheet')}:
        </span>
        <span className="rounded border border-[var(--cp-border-muted)] px-1.5 py-0.5 text-cp-xs text-[var(--cp-text-secondary)]">
          {JOB_BASIS_LABEL[summary.basis]}
        </span>
        <CsvButton onClick={exportCsv} />
      </div>
      <table className="block overflow-x-auto w-full text-cp-xs">
        <thead>
          <tr className="text-left text-[var(--cp-text-muted)]">
            <th className="py-1">{t('analysis.client.area', 'Area')}</th>
            <th>{t('analysis.client.metric', 'Metric')}</th>
            <th>{t('analysis.client.value', 'Value')}</th>
            <th>{t('analysis.client.share', 'Share')}</th>
            <th>{t('analysis.client.source', 'Basis')}</th>
          </tr>
        </thead>
        <tbody>
          {summary.rows.map((r, i) => (
            <tr key={`${r.gruppe}-${r.kennzahl}-${i}`} className="border-t border-[var(--cp-border-muted)]">
              <td className="py-1 text-[var(--cp-text-muted)]">{r.gruppe}</td>
              <td>{r.kennzahl}</td>
              <td className="tabular-nums">{r.wert}</td>
              <td className="tabular-nums">{r.anteil}</td>
              <td className="text-[var(--cp-text-muted)]">{SUMMARY_BASIS_LABEL[r.basis]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {summary.findings.length > 0 && (
        <ul className="flex flex-col gap-1 text-cp-xs">
          {summary.findings.map((f, i) => (
            <li key={`${f.kind}-${i}`} className="text-amber-300/90">
              <strong>{CLIENT_SUMMARY_FINDING_LABEL[f.kind]}</strong> — {f.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------ Kosten: Plan gegen Ist -- */

/**
 * BEDARF 79 — der Vergleich, den ein ERP nicht macht.
 *
 * Die Projektschätzung steht hier als GERECHNETE Zeile und nicht als Feld:
 * „Project estimate is a derived quantity based on what the task estimate is."
 * Ein Eingabefeld dafür wäre der Defekt aus dem Beleg — es wird einmal
 * getippt, die Positionen wandern weiter, und ab da widersprechen sich zwei
 * Zahlen im selben System.
 */
const CostTab = ({ projectName }: { projectName: string }) => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const setCostPlan = useProjectStore((s) => s.setCostPlan)
  const kosten = useMemo(() => assessCosts(project), [project])

  const patch = (patchIn: Partial<CostPlan>) => {
    const next: CostPlan = { ...kosten.plan, ...patchIn }
    const leer = next.lines.length === 0 && !next.currency && next.tolerancePercent === undefined
    setCostPlan(leer ? undefined : next)
  }

  const addLine = () =>
    patch({
      lines: [
        ...kosten.plan.lines,
        {
          id: crypto.randomUUID(),
          label: '',
          anchor: { kind: 'free' },
          actualSource: 'unstated',
        },
      ],
    })

  const patchLine = (id: string, p: Partial<CostLine>) =>
    patch({ lines: kosten.plan.lines.map((l) => (l.id === id ? { ...l, ...p } : l)) })

  const removeLine = (id: string) => patch({ lines: kosten.plan.lines.filter((l) => l.id !== id) })

  /** Leeres Feld heisst „nicht angegeben", nicht „null". */
  const numOrUndef = (v: string): number | undefined => {
    const n = Number(v.replace(',', '.'))
    return v.trim() === '' || !Number.isFinite(n) ? undefined : n
  }

  const exportCsv = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'kosten-vergleich', 'csv'),
      csvFromTable(costComparisonTable(project)),
      'text/csv',
    )
  }

  const inp = 'rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] p-1 text-cp-xs'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={kosten.plan.currency ?? ''}
          onChange={(e) => patch({ currency: e.target.value || undefined })}
          placeholder={t('analysis.cost.currencyPh', 'Currency, e.g. EUR')}
          aria-label={t('analysis.cost.currency', 'Currency')}
          className={`${inp} w-[9rem]`}
        />
        <input
          value={kosten.plan.tolerancePercent ?? ''}
          onChange={(e) => patch({ tolerancePercent: numOrUndef(e.target.value) })}
          placeholder={t('analysis.cost.tolerancePh', 'Tolerance in %')}
          aria-label={t('analysis.cost.tolerance', 'Tolerance')}
          className={`${inp} w-[9rem]`}
        />
        <button
          type="button"
          onClick={addLine}
          className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs"
        >
          <Icon icon={Plus} size="xs" /> {t('analysis.cost.add', 'Line')}
        </button>
        <CsvButton onClick={exportCsv} />
      </div>

      {kosten.plan.lines.length > 0 && (
        <div className="flex flex-col gap-1">
          {kosten.rows.map((r) => (
            <div key={r.line.id} className="flex flex-wrap items-center gap-1.5">
              <input
                value={r.line.label}
                onChange={(e) => patchLine(r.line.id, { label: e.target.value })}
                placeholder={t('analysis.cost.labelPh', 'Line')}
                aria-label={t('analysis.cost.label', 'Label')}
                className={`${inp} min-w-0 flex-1`}
              />
              <select
                value={r.line.anchor.kind === 'equipment' ? r.line.anchor.equipmentId : ''}
                onChange={(e) =>
                  patchLine(r.line.id, {
                    anchor: e.target.value
                      ? { kind: 'equipment', equipmentId: e.target.value }
                      : { kind: 'free' },
                  })
                }
                aria-label={t('analysis.cost.anchor', 'Anchor in the plan')}
                className={inp}
              >
                <option value="">{t('analysis.cost.free', '\u2014 no anchor \u2014')}</option>
                {project.equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name}
                  </option>
                ))}
              </select>
              <input
                value={r.line.estimate ?? ''}
                onChange={(e) => patchLine(r.line.id, { estimate: numOrUndef(e.target.value) })}
                placeholder={t('analysis.cost.estimatePh', 'Estimate')}
                aria-label={t('analysis.cost.estimate', 'Estimate')}
                className={`${inp} w-[6.5rem] tabular-nums`}
              />
              <input
                value={r.line.actual ?? ''}
                onChange={(e) => patchLine(r.line.id, { actual: numOrUndef(e.target.value) })}
                placeholder={t('analysis.cost.actualPh', 'Actual')}
                aria-label={t('analysis.cost.actual', 'Actual')}
                className={`${inp} w-[6.5rem] tabular-nums`}
              />
              {/* Die Herkunft steht NEBEN der Zahl: aus dem ERP und aus dem
                  Bauch sehen in einer Spalte sonst gleich aus. */}
              <select
                value={r.line.actualSource}
                onChange={(e) =>
                  patchLine(r.line.id, { actualSource: e.target.value as ActualSource })
                }
                aria-label={t('analysis.cost.source', 'Origin of the actual')}
                className={inp}
              >
                {Object.keys(ACTUAL_SOURCE_LABEL).map((k) => (
                  <option key={k} value={k}>
                    {ACTUAL_SOURCE_LABEL[k as ActualSource]}
                  </option>
                ))}
              </select>
              <span className="w-[8rem] text-right text-cp-xs tabular-nums text-[var(--cp-text-secondary)]">
                {r.delta === undefined
                  ? t('analysis.cost.unknown', 'unknown')
                  : `${r.delta > 0 ? '+' : ''}${Math.round(r.delta * 100) / 100}${
                      r.deltaPercent === undefined ? '' : ` (${r.deltaPercent} %)`
                    }`}
              </span>
              <button
                type="button"
                onClick={() => removeLine(r.line.id)}
                aria-label={t('analysis.cost.remove', 'Remove line')}
                className="text-[var(--cp-text-muted)] hover:text-[var(--cp-danger)]"
              >
                <Icon icon={Trash2} size="xs" />
              </button>
            </div>
          ))}
          <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-[var(--cp-border-muted)] pt-1 text-cp-xs">
            <strong>{t('analysis.cost.total', 'Project estimate (derived)')}</strong>
            <span className="tabular-nums">{Math.round(kosten.totals.estimate * 100) / 100}</span>
            <span className="text-[var(--cp-text-muted)]">
              {t('analysis.cost.without', 'without an estimate')}: {kosten.totals.linesWithoutEstimate}
            </span>
            <span className="text-[var(--cp-text-muted)]">
              {t('analysis.cost.withoutActual', 'without an actual')}: {kosten.totals.linesWithoutActual}
            </span>
          </div>
        </div>
      )}

      {kosten.findings.length > 0 && (
        <ul className="flex flex-col gap-1 text-cp-xs">
          {kosten.findings.map((f, i) => (
            <li key={`${f.kind}-${i}`} className="text-amber-300/90">
              <strong>{COST_FINDING_LABEL[f.kind]}</strong> — {f.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------- Namensregel -- */

const DEFAULT_SCHEME: NamingScheme = {
  segments: [{ part: 'category' }, { part: 'location' }, { part: 'index', pad: 2 }],
  separator: '-',
  caseMode: 'as-is',
}

/**
 * BEDARF 74 — Namen nach Regel, und der Umbenennungssatz zum Abtippen.
 *
 * Der Knopf „Anwenden" bleibt KLICKBAR, wenn die Regel verweigert wird — die
 * Weigerung nennt dann ihren Grund. Ein ausgegrauter Knopf sagt nur „nein",
 * nicht „warum": dieselbe Entscheidung wie beim As-Built-zur-Vorlage
 * (Bedarf 75).
 */
/**
 * BEDARF 100 — die Aufnahmenamen, im Reiter der Namensregel.
 *
 * HIER UND NICHT IN EINEM EIGENEN REITER: es ist dieselbe Frage („wie heisst
 * das nachher?"), nur fuer Dateien statt fuer Geraete, und die Reiterleiste
 * ist bereits zwoelf Eintraege lang. Ein dreizehnter fuer denselben Begriff
 * waere die Sorte Aufteilung, nach der man an zwei Stellen sucht.
 *
 * DIE TAKE-NUMMER STEHT EINMAL. Genau ihr Hochzaehlen an zehn bis sechzehn
 * Deck-Konfigurationsseiten ist der Schaden aus dem Beleg.
 */
const AufnahmeNamen = ({ projectName }: { projectName: string }) => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const setRecordNaming = useProjectStore((s) => s.setRecordNaming)
  const schema = project.recordNaming ?? DEFAULT_RECORD_SCHEME
  const plan = useMemo(() => recordNamePlan(project, schema), [project, schema])

  const inp = 'rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] p-1 text-cp-xs'

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--cp-border)] pt-3">
      <h3 className="text-cp-sm font-semibold text-[var(--cp-text)]">
        {t('analysis.recordName.title', 'Recording names')}
      </h3>
      <PanelHint
        className="text-cp-xs leading-snug text-[var(--cp-text-muted)]"
        text={t(
          'analysis.recordName.intro',
          'The filename of every recording, built from the plan instead of deck by deck on each config page. The take number applies to the whole project. What shows up here as a finding becomes an empty card at the device — a rejected name does not announce itself on the deck.',
        )}
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-cp-xs">
          {t('analysis.recordName.take', 'Take')}
          <input
            type="number"
            min={0}
            value={schema.take ?? ''}
            onChange={(e) =>
              setRecordNaming(
                normaliseRecordNaming({
                  ...schema,
                  take: e.target.value === '' ? undefined : Number(e.target.value),
                }),
              )
            }
            className={`${inp} w-16`}
          />
        </label>
        <label className="flex items-center gap-1 text-cp-xs">
          {t('analysis.recordName.separator', 'Separator')}
          <input
            value={schema.separator}
            onChange={(e) =>
              setRecordNaming(normaliseRecordNaming({ ...schema, separator: e.target.value }))
            }
            aria-label={t('analysis.recordName.separator', 'Separator')}
            className={`${inp} w-12`}
          />
        </label>
        <button
          type="button"
          onClick={() =>
            downloadBlob(
              buildExportFilenameWithSuffix(projectName, 'aufnahmenamen', 'csv'),
              csvFromTable(
                (() => {
                  const [kopf, ...zeilen] = recordNameSheet(plan)
                  return { headers: kopf, rows: zeilen }
                })(),
              ),
              'text/csv',
            )
          }
          className="rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs hover:bg-[var(--cp-surface-4)]"
        >
          {t('analysis.recordName.export', 'Sheet for the deck (CSV)')}
        </button>
      </div>

      {plan.rows.length === 0 ? (
        <p className="text-cp-xs text-[var(--cp-text-muted)]">
          {t(
            'analysis.recordName.empty',
            'No role in the plan — without roles there is no recording name.',
          )}
        </p>
      ) : (
        <table className="block overflow-x-auto w-full border-collapse text-cp-xs">
          <thead>
            <tr className="border-b border-[var(--cp-border)] text-left text-[var(--cp-text-secondary)]">
              <th className="py-1 pr-2">{t('analysis.recordName.role', 'Role')}</th>
              <th className="py-1 pr-2">{t('analysis.recordName.recorder', 'Recorder')}</th>
              <th className="py-1 pr-2">{t('analysis.recordName.channel', 'Channel')}</th>
              <th className="py-1 pr-2">{t('analysis.recordName.file', 'Filename')}</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((r) => (
              <tr key={r.roleId} className="border-b border-[var(--cp-border-muted)] align-top">
                <td className="py-1 pr-2">{r.roleName}</td>
                <td className="py-1 pr-2 text-[var(--cp-text-muted)]">
                  {r.recorder ?? t('analysis.recordName.noRecorder', 'no recorder in the plan')}
                </td>
                <td className="py-1 pr-2 tabular-nums">{r.channel ?? ''}</td>
                <td className="py-1 pr-2">
                  <span className="font-mono">{r.name}</span>
                  {r.findings.map((f, i) => (
                    <span key={i} className="ml-2 text-amber-300/90">
                      {RECORD_NAME_FINDING_LABEL[f.kind]}
                      {f.detail ? ` (${f.detail})` : ''}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const NamingTab = ({ projectName }: { projectName: string }) => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const setNamingScheme = useProjectStore((s) => s.setNamingScheme)
  const applyNaming = useProjectStore((s) => s.applyNaming)
  const scheme = project.namingScheme ?? DEFAULT_SCHEME
  const bewertung = useMemo(() => assessNaming(project, scheme), [project, scheme])
  const [refusal, setRefusal] = useState<NamingRefusal | undefined>()

  const patch = (p: Partial<NamingScheme>) => {
    setRefusal(undefined)
    setNamingScheme({ ...scheme, ...p })
  }

  const anwenden = () => {
    // Erst fragen, was passieren WUERDE — dieselbe reine Funktion, die der
    // Store aufruft. Die Weigerung wird dadurch sichtbar, statt als stilles
    // Nichts zu enden: der Store gaebe bei einer Verweigerung nur `{}` zurueck
    // und die Oberflaeche saehe wie eingefroren aus.
    const probe = applyNamingScheme(project, scheme)
    setRefusal(probe.refused)
    if (!probe.refused) applyNaming(scheme)
  }

  const exportCsv = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'umbenennungssatz', 'csv'),
      csvFromTable(renameSetTable(project, scheme)),
      'text/csv',
    )
  }

  const inp = 'rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] p-1 text-cp-xs'
  const kategorien = [...new Set(project.equipment.map((e) => e.category).filter(Boolean))].sort()

  return (
    <div className="flex flex-col gap-3">
      <PanelHint className="text-cp-xs leading-snug text-[var(--cp-text-muted)]" text={t(
          'analysis.naming.intro',
          'Names from a rule instead of from a feeling. The rename set is a sheet to type from \u2014 not a Dante preset: this application has never seen that schema.',
        )} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={scheme.separator}
          onChange={(e) => patch({ separator: e.target.value })}
          placeholder={t('analysis.naming.sepPh', 'Separator')}
          aria-label={t('analysis.naming.sep', 'Separator')}
          className={`${inp} w-[5rem]`}
        />
        <select
          value={scheme.caseMode}
          onChange={(e) => patch({ caseMode: e.target.value as NamingScheme['caseMode'] })}
          aria-label={t('analysis.naming.case', 'Case')}
          className={inp}
        >
          <option value="as-is">{t('analysis.naming.case.asIs', 'as generated')}</option>
          <option value="upper">{t('analysis.naming.case.upper', 'UPPER')}</option>
          <option value="lower">{t('analysis.naming.case.lower', 'lower')}</option>
        </select>
        <select
          value={scheme.categoryFilter ?? ''}
          onChange={(e) => patch({ categoryFilter: e.target.value || undefined })}
          aria-label={t('analysis.naming.filter', 'Only this category')}
          className={inp}
        >
          <option value="">{t('analysis.naming.allCategories', '\u2014 all categories \u2014')}</option>
          {kategorien.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={anwenden}
          className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs"
        >
          {t('analysis.naming.apply', 'Apply')} ({bewertung.proposals.length})
        </button>
        <CsvButton onClick={exportCsv} />
      </div>

      {refusal && (
        <p className="text-cp-xs text-amber-300/90">
          {refusal === 'duplicates'
            ? t(
                'analysis.naming.refusedDuplicates',
                'Not applied: the rule would produce duplicate names. A duplicate name on the network is not a cosmetic flaw.',
              )
            : t('analysis.naming.refusedNothing', 'Not applied: there is nothing to change.')}
        </p>
      )}

      {bewertung.proposals.length > 0 && (
        <table className="block overflow-x-auto w-full text-cp-xs">
          <thead>
            <tr className="text-left text-[var(--cp-text-muted)]">
              <th className="py-1">{t('analysis.naming.before', 'Old name')}</th>
              <th>{t('analysis.naming.after', 'New name')}</th>
              <th>{t('analysis.naming.chars', 'Characters')}</th>
            </tr>
          </thead>
          <tbody>
            {bewertung.proposals.map((p) => (
              <tr key={p.equipmentId} className="border-t border-[var(--cp-border-muted)]">
                <td className="py-1">{p.before}</td>
                <td>{p.after}</td>
                <td className="tabular-nums">{p.after.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {bewertung.findings.length > 0 && (
        <ul className="flex flex-col gap-1 text-cp-xs">
          {bewertung.findings.map((f, i) => (
            <li key={`${f.kind}-${i}`} className="text-amber-300/90">
              <strong>{NAMING_FINDING_LABEL[f.kind]}</strong> — {f.text}
            </li>
          ))}
        </ul>
      )}

      <AufnahmeNamen projectName={projectName} />
    </div>
  )
}

/* ------------------------------------------------------ Dante-Patch -- */

/**
 * BEDARF 94 — der Dante-Patch als lesbares, vergleichbares Dokument.
 *
 * Eingelesen wird die MATRIX, nicht das Preset-XML: dessen Schema liegt nicht
 * vor, und ein Parser nach Vermutung sähe aus, als könnte er es. Die
 * Begründung steht ausführlich im Kopf von `types/dantePatch.ts`.
 *
 * Der zweite Import ist wie bei der Szenendatei (Bedarf 92) der eigentliche
 * Nutzen — und der erste bleibt der Bezugsstand.
 */
const DanteTab = ({ projectName }: { projectName: string }) => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const [patchA, setPatchA] = useState<DantePatch | null>(null)
  const [patchB, setPatchB] = useState<DantePatch | null>(null)

  const aktuell = patchB ?? patchA
  const befunde = useMemo(
    () => (aktuell ? assessDantePatch(aktuell, project) : []),
    [aktuell, project],
  )
  const unterschiede = useMemo(
    () => (patchA && patchB ? diffDantePatches(patchA, patchB) : []),
    [patchA, patchB],
  )

  const laden = async (f: File) => {
    const gelesen = parseDanteMatrix(await f.text())
    if (!patchA) setPatchA(gelesen)
    else setPatchB(gelesen)
  }

  return (
    <div className="flex flex-col gap-3">
      <PanelHint className="text-cp-xs leading-snug text-[var(--cp-text-muted)]" text={t(
          'analysis.dante.intro',
          'The subscription matrix as a sheet and as a comparison. This application does not go on the network, subscribes to nothing and renames nothing \u2014 it reads the table the preset is converted into anyway.',
        )} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs">
          {t('analysis.dante.import', 'Read matrix')}
          <input
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              // Geleert, damit dieselbe Datei zweimal gewählt werden kann.
              e.target.value = ''
              if (f) void laden(f)
            }}
          />
        </label>
        {aktuell && (
          <>
            <span className="text-cp-xs text-[var(--cp-text-secondary)]">
              {t('analysis.dante.count', '{n} receive channels')
                .replace('{n}', String(aktuell.subscriptions.length))}
            </span>
            {aktuell.unreadable > 0 && (
              <span className="text-cp-xs text-amber-300/90">
                {t('analysis.dante.unreadable', '{n} lines not readable').replace(
                  '{n}',
                  String(aktuell.unreadable),
                )}
              </span>
            )}
            <CsvButton
              onClick={() =>
                downloadBlob(
                  buildExportFilenameWithSuffix(projectName, 'dante-patch', 'csv'),
                  csvFromTable(dantePatchTable(aktuell)),
                  'text/csv',
                )
              }
            />
            {unterschiede.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  downloadBlob(
                    buildExportFilenameWithSuffix(projectName, 'dante-aenderungen', 'csv'),
                    csvFromTable(danteDiffTable(unterschiede)),
                    'text/csv',
                  )
                }
                className="rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs"
              >
                {t('analysis.dante.exportDiff', 'Changes')}
              </button>
            )}
          </>
        )}
      </div>

      {/* Zwei Stände, keine Änderung: das ist eine Aussage und wird gesagt. */}
      {patchB && unterschiede.length === 0 && (
        <p className="text-cp-xs text-[var(--cp-text-secondary)]">
          {t('analysis.dante.noChange', 'Nothing changed in the patch between the two states.')}
        </p>
      )}
      {unterschiede.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-cp-xs">
          {unterschiede.map((d) => (
            <li key={`${d.rx}-${d.kind}`}>
              <span className="text-[var(--cp-text-faint)]">{d.rx}</span>{' '}
              <span className="text-amber-300/90">{DANTE_DIFF_LABEL[d.kind]}</span>{' '}
              {d.before} → {d.after}
            </li>
          ))}
        </ul>
      )}
      {befunde.length > 0 && (
        <ul className="flex flex-col gap-1 text-cp-xs">
          {befunde.map((f, i) => (
            <li key={`${f.kind}-${i}`} className="text-amber-300/90">
              <strong>{DANTE_FINDING_LABEL[f.kind]}</strong> — {f.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const TABS: { id: Tab; labelKey: string; fallback: string }[] = [
  // Bedarf 108 zuerst: „users ask to be TOLD something rather than to go and
  // check". Was ansteht, steht vorn — nicht auf Platz zwoelf.
  { id: 'todo', labelKey: 'analysis.tab.todo', fallback: 'Was ansteht' },
  { id: 'client', labelKey: 'analysis.tab.client', fallback: 'Kunden-Übersicht' },
  { id: 'cost', labelKey: 'analysis.tab.cost', fallback: 'Kosten: Plan gegen Ist' },
  { id: 'crew', labelKey: 'analysis.tab.crew', fallback: 'Crew: Stunden & Auslagen' },
  { id: 'naming', labelKey: 'analysis.tab.naming', fallback: 'Namensregel' },
  { id: 'dante', labelKey: 'analysis.tab.dante', fallback: 'Dante-Patch' },
  { id: 'weight', labelKey: 'analysis.tab.weight', fallback: 'Gewicht & Wärme' },
  { id: 'network', labelKey: 'analysis.tab.network', fallback: 'Netzwerk' },
  { id: 'redundancy', labelKey: 'analysis.tab.redundancy', fallback: 'Redundanz' },
  { id: 'rf', labelKey: 'analysis.tab.rf', fallback: 'RF / Funk' },
  { id: 'runs', labelKey: 'analysis.tab.runs', fallback: 'Kabelwege' },
  // #664 — der Weg ueber mehrere Ebenen, direkt neben den Kabelwegen:
  // dort sucht, wer wissen will, wo ein Signal ankommt.
  { id: 'chain', labelKey: 'analysis.tab.chain', fallback: 'Signalwege' },
  { id: 'sheet', labelKey: 'analysis.tab.sheet', fallback: 'Blatt prüfen' },
]

/**
 * Aussenhuelle: montiert den Inhalt ERST beim Oeffnen — und damit bei jedem
 * Oeffnen neu.
 *
 * WARUM DIESE FORM UND KEIN `useEffect` (berichtigt 2026-09-07). Der
 * Start-Reiter aus `openAnalysis('network')` war zuerst als Effekt gesetzt,
 * der beim Oeffnen `setActive` rief. Das ist das Muster, das
 * `react-hooks/set-state-in-effect` als FEHLER meldet: eine zweite
 * Renderrunde, nur um einen Anfangswert zu setzen.
 *
 * Erst beim Oeffnen montiert, ist der gewuenschte Reiter schlicht der
 * ANFANGSWERT — und „nur beim Oeffnen, damit ein Reiterwechsel von Hand nicht
 * zurueckspringt" gilt von selbst, statt als Bedingung im Effekt.
 */
export const AnalysisDialog = () => {
  const open = useUiStore((s) => s.analysis.open)
  if (!open) return null
  return <AnalysisDialogInner />
}

const AnalysisDialogInner = () => {
  const t = useTranslation()
  const gewuenschterTab = useUiStore((s) => s.analysis.tab)
  const close = useUiStore((s) => s.closeAnalysis)
  const projectName = useProjectStore((s) => s.project.metadata.name)
  const [active, setActive] = useState<Tab>(() =>
    TABS.some((tb) => tb.id === gewuenschterTab) ? (gewuenschterTab as Tab) : 'weight',
  )

  return (
    <ModalShell
      open
      onClose={close}
      maxWidth="4xl"
      titleIcon={<Icon icon={BarChart3} size="md" />}
      title={t('analysis.title', 'Analyses')}
    >
      {/*
        DREIZEHN REITER IN EINER ZEILE, DIE NICHT UMBRICHT — die letzten drei
        („Kabelwege", „Signalwege", „Blatt pruefen") lagen VOLLSTAENDIG
        ausserhalb des Dialogs. Gemessen im echten Fenster: 164 px, 98 px und
        5 px ueber der rechten Kante, bei 1280x800 wie bei 1500x950. Nicht
        sichtbar, nicht anklickbar — drei Auswertungen, die es fuer den
        Nutzer nicht gab.

        Derselbe Defekt wie der, aus dem `scripts/ui-overflow.mjs` entstanden
        ist („Equipment kann man lesen, Cable schon nicht mehr"), nur eine
        Ebene tiefer: der Waechter oeffnet keine Dialoge und sah ihn deshalb
        nicht. Aufgefallen ist er beim Nachmessen der Schriftgroessen — und
        er ist AELTER als diese Migration, nachgemessen gegen 776ed7c mit
        identischen Zahlen.

        `flex-wrap` und nicht `overflow-x-auto`: eine waagerecht scrollende
        Reiterleiste versteckt die hinteren Reiter hinter einer Geste, die
        niemand sucht. Umbrechen zeigt alle dreizehn, kostet eine zweite
        Zeile und ist das Muster, das die Bibliothek fuer ihre Chip-Reihen
        ohnehin schon nutzt.
      */}
      <div className="mb-3 flex flex-wrap gap-1 border-b border-[var(--cp-border)]">
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
      {active === 'chain' && <ChainTab />}
      {active === 'sheet' && <SheetTab />}
      {active === 'client' && <ClientTab projectName={projectName} />}
      {active === 'todo' && <ActionTab />}
      {active === 'cost' && <CostTab projectName={projectName} />}
      {active === 'crew' && <CrewTab projectName={projectName} />}
      {active === 'naming' && <NamingTab projectName={projectName} />}
      {active === 'dante' && <DanteTab projectName={projectName} />}
    </ModalShell>
  )
}
