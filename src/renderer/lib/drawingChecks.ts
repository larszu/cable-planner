// #411 — Vereinte „Plan-Check"-Engine.
//
// Sammelt alle Plan-Validierungen an EINER Stelle, damit die UI (PlanCheckPanel
// + StatusBar-Badge) einen Live-Gesamtstatus zeigen kann — analog zu ConnectCADs
// „Status"-Palette. Rein lesend, non-destruktiv.
//
// Die Heuristiken sind bewusst die GLEICHEN wie im AnalysisDialog (Doppel-IP,
// RF-Konflikt, Single-Power) plus neue, dort fehlende Checks (offene Ports,
// inkompatible Connectoren, doppelte Kabelnummern, fehlende Längen). Wir
// duplizieren nur den kleinen reinen Helfer parseFreqMHz, nicht die Report-UI.
//
// `effectiveWatts` wurde hier ebenfalls dupliziert -- und lief auseinander:
// die Kopie hier kannte den aktiven Betriebsmodus nicht, die im AnalysisDialog
// schon, obwohl der Kommentar "bewusst die GLEICHEN" behauptete. Der Helfer
// kommt deshalb jetzt aus `equipmentSelectors`, wo er nur einmal existiert.

import type { Cable } from '../types/cable'
import type { EquipmentItem, Port, ConnectorType } from '../types/equipment'
import type { DrumKitPlan } from '../types/drumKit'
import { checkImpedanceMismatch, checkBalanceMismatch, maxPassiveLengthM } from '../types/cableSpec'
import { networkAddress } from './subnet'
import { effectiveWatts } from './equipmentSelectors'
import { deriveDrumChannels } from './drumMicing'
import { labelTargetIssues } from './labelDerivation'
import { beurteileAdapter } from '../types/adapter'
import { anschlussBefunde, type AnschlussLeitung } from '../types/conductor'
import { beurteileBild } from '../types/displayCapability'
import { tr, format } from './i18n'
export type { CheckSeverity, CheckFinding } from '../types/checkFinding'
import type { CheckSeverity, CheckFinding } from '../types/checkFinding'


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

/** Strom-Connectoren — für die Single-Power-Heuristik. */
const POWER_CONNECTORS = new Set<ConnectorType>([
  'IEC 230V',
  'PowerCON',
  'Schuko 230V',
  'C7 Eurostecker',
])

const isPowerCable = (
  cable: Cable,
  portById: Map<string, Port>,
): boolean => {
  if (cable.layer === 'power') return true
  const from = portById.get(cable.fromPortId)
  const to = portById.get(cable.toPortId)
  return (
    (from != null && POWER_CONNECTORS.has(from.connectorType)) ||
    (to != null && POWER_CONNECTORS.has(to.connectorType))
  )
}

export interface DrawingCheckInput {
  equipment: EquipmentItem[]
  cables: Cable[]
  /** Optionaler Drum-Mikrofonierungs-Plan — speist den Phantom/Mic-Input-Check. */
  drumKit?: DrumKitPlan
  /** ADR-001 — Signalquellen-Rollen; speisen die Label-/UMD-Checks. */
  sourceIdentities?: import('../types/sourceIdentity').SourceIdentity[]
  /** B-45 — die Anschluesse und die gewaehlten Farbnormen. */
  anschlussListe?: import('../types/conductor').Anschluss[]
  farbnormen?: import('../types/conductor').Farbnorm[]
  /** B-47 — das Format, das gilt, wo das Kabel keines nennt. */
  defaultVideoFormat?: import('../types/videoFormat').VideoFormatId
}

export interface DrawingCheckResult {
  findings: CheckFinding[]
  errorCount: number
  warningCount: number
  infoCount: number
}

/**
 * Führt alle Plan-Checks aus und liefert eine flache, sortierte Finding-Liste
 * (errors zuerst). Pure function — leicht testbar, kein Store-Zugriff.
 */
export const runDrawingChecks = (
  {
    equipment,
    cables,
    drumKit,
    sourceIdentities,
    anschlussListe,
    farbnormen,
    defaultVideoFormat,
  }: DrawingCheckInput,
): DrawingCheckResult => {
  const findings: CheckFinding[] = []
  const eqById = new Map(equipment.map((e) => [e.id, e]))
  // Port-Lookup global (Port-IDs sind projektweit eindeutig).
  const portById = new Map<string, Port>()
  for (const e of equipment) {
    for (const p of [...e.inputs, ...e.outputs]) portById.set(p.id, p)
  }
  // Welche Ports hängen an mindestens einem Kabel?
  const connectedPorts = new Set<string>()
  for (const c of cables) {
    connectedPorts.add(c.fromPortId)
    connectedPorts.add(c.toPortId)
  }
  const eqName = (id: string) => eqById.get(id)?.name ?? '?'

  // — Check 1: offene/unverbundene Ports (info, pro Gerät gebündelt) ----------
  for (const e of equipment) {
    const all = [...e.inputs, ...e.outputs]
    // Rack-intern verkabelte Ports zählen nicht als „offen".
    const open = all.filter(
      (p) => !connectedPorts.has(p.id) && !p.rackInternallyConnected,
    )
    if (open.length > 0 && all.length > 0) {
      findings.push({
        id: `open-ports:${e.id}`,
        severity: 'info',
        category: 'Open ports',
        message: format(tr('check.openPorts', '{name}: {n} unconnected ports ({ports})'), {
          name: e.name,
          n: open.length,
          ports:
            open
              .slice(0, 4)
              .map((p) => p.name)
              .join(', ') + (open.length > 4 ? ' …' : ''),
        }),
        equipmentId: e.id,
      })
    }
  }

  // — Check 2: inkompatible Connector-Paare (warning) -------------------------
  for (const c of cables) {
    if (c.wireless || c.needsConverter) continue
    const from = portById.get(c.fromPortId)
    const to = portById.get(c.toPortId)
    if (!from || !to) continue
    if (from.connectorType === 'Custom' || to.connectorType === 'Custom') continue
    if (from.connectorType !== to.connectorType) {
      findings.push({
        id: `connector-mismatch:${c.id}`,
        severity: 'warning',
        category: 'Connector mismatch',
        message:
          (c.cableNumber ? c.cableNumber + ' · ' : '') +
          format(tr('check.connectorMismatch', '{from} ({fromType}) → {to} ({toType})'), {
            from: eqName(c.fromEquipmentId),
            fromType: from.connectorType,
            to: eqName(c.toEquipmentId),
            toType: to.connectorType,
          }),
        cableId: c.id,
      })
    }
  }

  // — Check 3: doppelte Kabelnummern (error) ---------------------------------
  const byNumber = new Map<string, Cable[]>()
  for (const c of cables) {
    const num = c.cableNumber?.trim()
    if (!num) continue
    const arr = byNumber.get(num) ?? []
    arr.push(c)
    byNumber.set(num, arr)
  }
  for (const [num, group] of byNumber) {
    if (group.length > 1) {
      for (const c of group) {
        findings.push({
          id: `dup-number:${c.id}`,
          severity: 'error',
          category: 'Duplicate cable number',
          message: format(
            tr('check.duplicateCableNumber', 'Cable number "{num}" used {n}×: {from} → {to}'),
            {
              num,
              n: group.length,
              from: eqName(c.fromEquipmentId),
              to: eqName(c.toEquipmentId),
            },
          ),
          cableId: c.id,
        })
      }
    }
  }

  // — Check 4: fehlende Längen (warning, nur kabelgebunden) -------------------
  for (const c of cables) {
    if (c.wireless) continue
    if (!c.length || c.length <= 0) {
      findings.push({
        id: `missing-length:${c.id}`,
        severity: 'warning',
        category: 'Missing length',
        message:
          (c.cableNumber ? c.cableNumber + ' · ' : '') +
          format(tr('check.missingLength', '{from} → {to}: no length set'), {
            from: eqName(c.fromEquipmentId),
            to: eqName(c.toEquipmentId),
          }),
        cableId: c.id,
      })
    }
  }

  // — Check 5: doppelte IP-Adressen (error) ----------------------------------
  const byIp = new Map<string, EquipmentItem[]>()
  for (const e of equipment) {
    const ip = e.ipAddress?.trim()
    if (!ip) continue
    const arr = byIp.get(ip) ?? []
    arr.push(e)
    byIp.set(ip, arr)
  }
  for (const [ip, group] of byIp) {
    if (group.length > 1) {
      for (const e of group) {
        findings.push({
          id: `dup-ip:${e.id}`,
          severity: 'error',
          category: 'Duplicate IP',
          message: format(tr('check.duplicateIp', 'IP {ip} used more than once: {names}'), {
            ip,
            names: group.map((g) => g.name).join(', '),
          }),
          equipmentId: e.id,
        })
      }
    }
  }

  // — Check 6: RF-/Funk-Frequenzkonflikte (warning) --------------------------
  const wireless = cables
    .filter((c) => c.wireless)
    .map((c) => ({ cable: c, mhz: parseFreqMHz(c.frequency), channel: c.wifiChannel?.trim() }))
  for (let i = 0; i < wireless.length; i++) {
    for (let j = i + 1; j < wireless.length; j++) {
      const a = wireless[i]
      const b = wireless[j]
      const sameChannel = !!a.channel && a.channel === b.channel
      const closeFreq =
        a.mhz != null && b.mhz != null && Math.abs(a.mhz - b.mhz) < RF_MIN_SPACING_MHZ
      if (sameChannel || closeFreq) {
        const why = sameChannel
          ? format(tr('check.rf.sameChannel', 'same channel {channel}'), { channel: a.channel ?? '' })
          : format(tr('check.rf.tooClose', 'frequency spacing < {mhz} MHz'), {
              mhz: RF_MIN_SPACING_MHZ,
            })
        findings.push({
          id: `rf-conflict:${a.cable.id}:${b.cable.id}`,
          severity: 'warning',
          category: 'RF conflict',
          message: format(tr('check.rfConflict', '{a} ⟷ {b}: {why}'), {
            a: eqName(a.cable.fromEquipmentId),
            b: eqName(b.cable.fromEquipmentId),
            why,
          }),
          cableId: a.cable.id,
        })
      }
    }
  }

  // — Check 7: Single-Power (info) -------------------------------------------
  // Geräte die Strom ziehen, aber ≤1 Strom-Anbindung haben → kein A/B-Netzteil.
  const powerCountByEq = new Map<string, number>()
  for (const c of cables) {
    if (!isPowerCable(c, portById)) continue
    powerCountByEq.set(c.fromEquipmentId, (powerCountByEq.get(c.fromEquipmentId) ?? 0) + 1)
    powerCountByEq.set(c.toEquipmentId, (powerCountByEq.get(c.toEquipmentId) ?? 0) + 1)
  }
  for (const e of equipment) {
    if (effectiveWatts(e) > 0 && (powerCountByEq.get(e.id) ?? 0) <= 1) {
      findings.push({
        id: `single-power:${e.id}`,
        severity: 'info',
        category: 'Single power',
        message: format(
          tr('check.singlePower', '{name}: only one power feed (no redundant PSU)'),
          { name: e.name },
        ),
        equipmentId: e.id,
      })
    }
  }

  // — Check 8: Timecode-Senken ohne TC-Quelle (#359) -------------------------
  const tcSinks = equipment.filter((e) => e.tcRole === 'sink')
  if (tcSinks.length > 0 && !equipment.some((e) => e.tcRole === 'source')) {
    for (const e of tcSinks) {
      findings.push({
        id: `tc-no-source:${e.id}`,
        severity: 'warning',
        category: 'Timecode',
        message: format(
          tr('check.tcNoSource', '{name}: timecode sink, but no timecode source (generator) in the plan'),
          { name: e.name },
        ),
        equipmentId: e.id,
      })
    }
  }

  // — Check 9: Tally-Senken ohne Tally-Quelle (#360) -------------------------
  const tallySinks = equipment.filter((e) => e.tallyRole === 'sink')
  if (tallySinks.length > 0 && !equipment.some((e) => e.tallyRole === 'source')) {
    for (const e of tallySinks) {
      findings.push({
        id: `tally-no-source:${e.id}`,
        severity: 'warning',
        category: 'Tally',
        message: format(
          tr(
            'check.tallyNoSource',
            '{name}: tally sink, but no tally source (switcher/tally hub) in the plan',
          ),
          { name: e.name },
        ),
        equipmentId: e.id,
      })
    }
  }

  // — Check 10: Verteilverstärker ohne Verteilung (#372) ---------------------
  for (const e of equipment) {
    if (e.isDistributionAmp && e.outputs.length < 2) {
      findings.push({
        id: `da-no-fanout:${e.id}`,
        severity: 'info',
        category: 'Distribution amplifier',
        message: format(
          tr(
            'check.daNoFanout',
            '{name}: marked as a distribution amplifier, but has only {n} output(s) (1→N expected)',
          ),
          { name: e.name, n: e.outputs.length },
        ),
        equipmentId: e.id,
      })
    }
  }

  // — Check 11: Impedanz-Mismatch je Kabel (#390 plan-weit) ------------------
  // Nutzt die Signal-Standards der beiden verbundenen Ports (oder den Kabel-
  // Standard als Fallback). 75Ω↔50Ω↔110Ω-Konflikte → Reflexionen/Return-Loss.
  for (const c of cables) {
    if (c.wireless || c.needsConverter) continue
    const from = portById.get(c.fromPortId)
    const to = portById.get(c.toPortId)
    if (!from || !to) continue
    const mismatch = checkImpedanceMismatch(
      from.standard ?? c.standard,
      to.standard ?? c.standard,
    )
    if (mismatch) {
      findings.push({
        id: `impedance-mismatch:${c.id}`,
        severity: 'warning',
        category: 'Impedance mismatch',
        message: format(tr('check.onLink', '{from} → {to}: {what}'), {
          from: eqName(c.fromEquipmentId),
          to: eqName(c.toEquipmentId),
          what: format(tr(mismatch.schluessel, mismatch.message), mismatch.werte),
        }),
        cableId: c.id,
      })
    }
  }

  // — Check 12: Faserklasse Multimode↔Singlemode (#362) ----------------------
  // OM* (Multimode) und OS* (Singlemode) sind optisch inkompatibel (andere
  // Wellenlänge/Kerndurchmesser) — ein Link darf nicht gemischt sein.
  const fiberKind = (fc: string | undefined): 'mm' | 'sm' | null => {
    if (!fc) return null
    const u = fc.toUpperCase()
    if (u.startsWith('OM')) return 'mm'
    if (u.startsWith('OS')) return 'sm'
    return null
  }
  for (const c of cables) {
    const from = portById.get(c.fromPortId)
    const to = portById.get(c.toPortId)
    const a = fiberKind(from?.fiberClass)
    const b = fiberKind(to?.fiberClass)
    if (a && b && a !== b) {
      const lbl = (k: 'mm' | 'sm') =>
        k === 'mm' ? tr('check.fibre.multimode', 'multimode') : tr('check.fibre.singlemode', 'singlemode')
      findings.push({
        id: `fiber-mismatch:${c.id}`,
        severity: 'warning',
        category: 'Fibre mismatch',
        message: format(
          tr(
            'check.fibreMismatch',
            '{from} → {to}: {aClass} ({aKind}) ↔ {bClass} ({bKind}) - optically incompatible',
          ),
          {
            from: eqName(c.fromEquipmentId),
            to: eqName(c.toEquipmentId),
            aClass: from?.fiberClass ?? '',
            aKind: lbl(a),
            bClass: to?.fiberClass ?? '',
            bKind: lbl(b),
          },
        ),
        cableId: c.id,
      })
    }
  }

  // — Check 13: ST 2110 ohne PTP-Referenz (#347/#348) ------------------------
  // SMPTE ST 2110 ist auf eine PTP-Grandmaster-Synchronisation (IEEE 1588)
  // angewiesen. Wenn der Plan ST-2110-Signale, aber kein PTP-Signal enthält,
  // erinnern wir an die Sync-Quelle (Info — PTP kommt oft aus dem Switch und
  // ist evtl. nicht als Kabel gezeichnet).
  const hasSt2110 = cables.some((c) => (c.standard ?? '').startsWith('ST2110'))
  const hasPtp = cables.some((c) => c.standard === 'PTP')
  if (hasSt2110 && !hasPtp) {
    findings.push({
      id: 'st2110-no-ptp',
      severity: 'info',
      category: 'Sync / PTP',
      message: tr(
        'check.st2110NoPtp',
        'ST 2110 is in the plan, but there is no PTP signal - do not forget a PTP grandmaster (IEEE 1588) as the reference.',
      ),
    })
  }
  // #365 — ST 2110 braucht eine NMOS-Registry (IS-04 Discovery + IS-05
  // Connection Management). Erinnerung, sofern kein Gerät erkennbar diese
  // Rolle übernimmt (Name enthält nmos/registry/controller/broadcast control).
  if (hasSt2110) {
    const hasController = equipment.some((e) =>
      /nmos|registry|registr|broadcast.?controller|\bctrl\b|orchestrat|sdn.?control/i.test(e.name),
    )
    if (!hasController) {
      findings.push({
        id: 'st2110-no-nmos',
        severity: 'info',
        category: 'NMOS',
        message: tr(
          'check.st2110NoNmos',
          'ST 2110 is in the plan - plan an NMOS registry (IS-04 discovery / IS-05 connection management) for findability and routing.',
        ),
      })
    }
  }

  // — Check 13b: Mehrere SDI-Signale ohne Genlock-Referenz (#348) ------------
  // Mehrere SDI-Quellen sollten auf eine gemeinsame Referenz (Blackburst/
  // Tri-Level, bei IP PTP) gelockt sein. Info-Erinnerung.
  const sdiCount = cables.filter((c) => (c.standard ?? '').startsWith('SDI')).length
  const hasGenlock = cables.some(
    (c) => c.standard === 'Blackburst' || c.standard === 'Tri-Level' || c.standard === 'Word-Clock',
  )
  if (sdiCount >= 2 && !hasGenlock && !hasPtp) {
    findings.push({
      id: 'sdi-no-genlock',
      severity: 'info',
      category: 'Sync / Genlock',
      message: format(
        tr(
          'check.sdiNoGenlock',
          '{n} SDI signals, but no genlock/reference distribution (blackburst/tri-level) - check the sync.',
        ),
        { n: sdiCount },
      ),
    })
  }

  // — Check 14: Kabel länger als passive Maximal-Länge (#367) ----------------
  // HDMI/USB/DP/Thunderbolt/12G-SDI haben praktische Kupfer-Längengrenzen.
  // Darüber → aktive Lösung (AOC / HDBaseT / Extender / Glasfaser).
  for (const c of cables) {
    if (c.wireless) continue
    const limit = maxPassiveLengthM(c.standard)
    if (limit != null && typeof c.length === 'number' && c.length > limit) {
      findings.push({
        id: `cable-too-long:${c.id}`,
        severity: 'warning',
        category: 'Cable length',
        message: format(
          tr(
            'check.cableTooLong',
            '{from} → {to}: {len} m exceeds the passive {standard} limit (~{limit} m) - an active solution (AOC/HDBaseT/extender/fibre) is needed',
          ),
          {
            from: eqName(c.fromEquipmentId),
            to: eqName(c.toEquipmentId),
            len: c.length,
            standard: c.standard ?? '',
            limit,
          },
        ),
        cableId: c.id,
      })
    }
  }

  // — Check 15: Licht/DMX-Universen-Übersicht (#361) -------------------------
  // DMX512 ist eine Linie = ein Universum (max. 512 Kanäle). Art-Net/sACN
  // tragen mehrere Universen über Ethernet (Anzahl nicht modelliert → als
  // Links gezählt). Info-Übersicht, kein Fehler.
  const isDmxConn = (p: Port | undefined): boolean =>
    !!p && (p.connectorType === 'DMX 5-pol (XLR)' || p.connectorType === 'DMX 3-pol (XLR)')
  let dmxLines = 0
  let artnetLinks = 0
  for (const c of cables) {
    const s = c.standard
    // Expliziter Art-Net/sACN-Standard hat Vorrang vor der DMX-Connector-Heuristik.
    if (s === 'Art-Net' || s === 'sACN') {
      artnetLinks += 1
    } else if (s === 'DMX512' || s === 'RDM' || isDmxConn(portById.get(c.fromPortId)) || isDmxConn(portById.get(c.toPortId))) {
      dmxLines += 1
    }
  }
  if (dmxLines > 0 || artnetLinks > 0) {
    const parts: string[] = []
    if (dmxLines > 0)
      parts.push(
        format(tr('check.dmxLines', '{n} DMX lines (≈ {n} universes, {ch} channels)'), {
          n: dmxLines,
          ch: dmxLines * 512,
        }),
      )
    if (artnetLinks > 0)
      parts.push(
        format(tr('check.artnetLinks', '{n} Art-Net/sACN links (several universes per link)'), {
          n: artnetLinks,
        }),
      )
    findings.push({
      id: 'dmx-summary',
      severity: 'info',
      category: 'Lighting / DMX',
      message: parts.join(' · '),
    })
  }

  // — Check 16: PoE-Budget überschritten (#391) ------------------------------
  // Netzwerk-Switch mit poeBudgetW (Fachdaten) gegen die Summe der per
  // Ethernet angeschlossenen PoE-fähigen Verbraucher (≤ 90 W = 802.3bt Typ 4;
  // größere Geräte haben eigene Stromversorgung und zählen nicht).
  const POE_MAX_W = 90
  for (const sw of equipment) {
    const budgetRaw = sw.categoryProps?.poeBudgetW
    const budget = typeof budgetRaw === 'number' ? budgetRaw : Number(budgetRaw)
    if (!Number.isFinite(budget) || budget <= 0) continue
    let load = 0
    let count = 0
    const seen = new Set<string>()
    for (const c of cables) {
      let swPortId: string | undefined
      let otherId: string | undefined
      if (c.fromEquipmentId === sw.id) {
        swPortId = c.fromPortId
        otherId = c.toEquipmentId
      } else if (c.toEquipmentId === sw.id) {
        swPortId = c.toPortId
        otherId = c.fromEquipmentId
      } else continue
      const swPort = portById.get(swPortId)
      if (!swPort || swPort.connectorType !== 'Ethernet/RJ45') continue
      if (!otherId || seen.has(otherId)) continue
      const consumer = eqById.get(otherId)
      if (!consumer) continue
      const w =
        consumer.powerConsumptionWatts ??
        (consumer.voltage && consumer.currentAmps ? consumer.voltage * consumer.currentAmps : 0)
      if (w <= 0 || w > POE_MAX_W) continue
      seen.add(otherId)
      load += w
      count += 1
    }
    if (load > budget) {
      findings.push({
        id: `poe-over:${sw.id}`,
        severity: 'warning',
        category: 'PoE-Budget',
        message: format(
          tr(
            'check.poeOverBudget',
            '{name}: a PoE load of {load} W across {count} devices exceeds the budget ({budget} W)',
          ),
          { name: sw.name, load: Math.round(load), count, budget },
        ),
        equipmentId: sw.id,
      })
    }
  }

  // — Check 15b: Symmetrisch↔Unsymmetrisch (Audio) (#380) --------------------
  for (const c of cables) {
    if (c.wireless || c.needsConverter) continue
    const from = portById.get(c.fromPortId)
    const to = portById.get(c.toPortId)
    if (!from || !to) continue
    const bal = checkBalanceMismatch(from.connectorType, to.connectorType)
    if (bal) {
      findings.push({
        id: `balance-mismatch:${c.id}`,
        severity: 'warning',
        category: 'Audio balanced/unbalanced',
        message: format(tr('check.onLink', '{from} → {to}: {what}'), {
          from: eqName(c.fromEquipmentId),
          to: eqName(c.toEquipmentId),
          what: format(tr(bal.schluessel, bal.message), bal.werte),
        }),
        cableId: c.id,
      })
    }
  }

  // — Check 16b: Dual-Link SDI unvollständig (#370) --------------------------
  // Ports mit gleichem dualLinkGroup bilden ein Dual-Link-Set (Link A/B). Sind
  // einige verbunden, andere nicht, fehlt ein Link → Bild unvollständig.
  for (const e of equipment) {
    const groups = new Map<string, { total: number; connected: number; names: string[] }>()
    for (const p of [...e.inputs, ...e.outputs]) {
      if (!p.dualLinkGroup) continue
      const g = groups.get(p.dualLinkGroup) ?? { total: 0, connected: 0, names: [] }
      g.total += 1
      if (connectedPorts.has(p.id)) g.connected += 1
      g.names.push(p.name)
      groups.set(p.dualLinkGroup, g)
    }
    for (const [grp, g] of groups) {
      if (g.total >= 2 && g.connected > 0 && g.connected < g.total) {
        findings.push({
          id: `dual-link:${e.id}:${grp}`,
          severity: 'warning',
          category: 'Dual-Link',
          message: format(
            tr(
              'check.dualLinkIncomplete',
              '{name}: dual-link set "{group}" incomplete - {connected}/{total} links connected ({ports})',
            ),
            {
              name: e.name,
              group: grp,
              connected: g.connected,
              total: g.total,
              ports: g.names.join(', '),
            },
          ),
          equipmentId: e.id,
        })
      }
    }
  }

  // — Check 17b: LWL-Steckertyp-Mismatch (#362) ------------------------------
  // Zwei unterschiedliche optische Stecker (z. B. LC ↔ SC) an einem Link →
  // Adapter/Hybrid-Patch nötig.
  for (const c of cables) {
    const from = portById.get(c.fromPortId)
    const to = portById.get(c.toPortId)
    const a = from?.fiberConnector
    const b = to?.fiberConnector
    if (a && b && a !== b) {
      findings.push({
        id: `fiber-conn:${c.id}`,
        severity: 'warning',
        category: 'Fibre connector',
        message: format(
          tr(
            'check.fibreConnectorMismatch',
            '{from} → {to}: {a} ↔ {b} - different optical connector types (an adapter/hybrid patch is needed)',
          ),
          { from: eqName(c.fromEquipmentId), to: eqName(c.toEquipmentId), a, b },
        ),
        cableId: c.id,
      })
    }
  }

  // — Check 18: Port-Belegung unbekannt (Datenblatt fehlt) -------------------
  // Geräte, die aus einer fremden Domäne (z. B. MultiCam-Kamera-Import)
  // übernommen wurden, aber kein Datenblatt-Match hatten, tragen
  // `portsUnknown`. Wir haben ihre I/O NICHT erfunden — der User muss die
  // realen Ports aus dem Datenblatt ergänzen, sonst sind sie unverkabelbar.
  for (const e of equipment) {
    if (e.portsUnknown && e.inputs.length === 0 && e.outputs.length === 0) {
      findings.push({
        id: `ports-unknown:${e.id}`,
        severity: 'warning',
        category: 'Ports unknown',
        message: format(
          tr(
            'check.portsUnknown',
            '{name}: the port layout is unknown (no data-sheet match) - add the real connectors from the data sheet',
          ),
          { name: e.name },
        ),
        equipmentId: e.id,
      })
    }
    // Zweiter Fall, und der stillere: Ports SIND da, aber geraten. Der
    // AI-Vorschlag leitet sie aus dem Gerätenamen ab. Vorher brachte das die
    // Warnung oben zum Schweigen — die Prüfung, die zu belegten Daten zwingen
    // soll, wurde von einer Vermutung beantwortet. Ports tragen die ganze
    // Verkabelung: ein erfundener Port ist ein Kabel, das es nicht gibt.
    else if (e.specSource?.inputs || e.specSource?.outputs) {
      // Die Meldung nennt die AUFGEZEICHNETE Herkunft, statt eine zu behaupten.
      // Vorher stand hier fest „AI-Vorschlag" — richtig, solange der
      // Port-Vorschlag die einzige Quelle ohne Datenblatt war. Sobald eine
      // zweite dazukommt (die Suite-Shell schiebt ihr Projekt als Seed in den
      // eingebetteten Planer und legt daraus Ports an), benennt derselbe Satz
      // die falsche Quelle — und zwar ausgerechnet in der Pruefung, die zu
      // belegten Daten zwingen soll. `specSource.source` traegt den Beleg
      // ohnehin als ganzen Satz; er wird hier gelesen statt nacherzaehlt.
      // Leerer Beleg zaehlt wie keiner: `??` faengt nur null/undefined, und ein
      // leerer Text ergaebe „Ports stammen aus  —" statt einer Aussage.
      const belegText = (e.specSource?.inputs?.source || e.specSource?.outputs?.source || '').trim()
      const beleg = belegText || undefined
      findings.push({
        id: `ports-guessed:${e.id}`,
        severity: 'warning',
        category: 'Ports guessed',
        message: format(
          tr(
            'check.portsGuessed',
            '{name}: the ports come from {source} - check them against the real connectors',
          ),
          {
            name: e.name,
            source: beleg ?? tr('check.portsGuessed.noSource', 'a source without a data sheet'),
          },
        ),
        equipmentId: e.id,
      })
    }
  }

  // — Check 17: Gateway nicht im Geräte-Subnetz (#346) -----------------------
  // Liegt das Default-Gateway nicht im selben Subnetz wie die Geräte-IP, ist
  // es nicht erreichbar → Fehlkonfiguration.
  for (const e of equipment) {
    if (!e.ipAddress || !e.gateway) continue
    const mask = e.subnetMask || '255.255.255.0'
    const devNet = networkAddress(e.ipAddress, mask)
    const gwNet = networkAddress(e.gateway, mask)
    if (devNet && gwNet && devNet !== gwNet) {
      findings.push({
        id: `gw-subnet:${e.id}`,
        severity: 'warning',
        category: 'Gateway/subnet',
        message: format(
          tr(
            'check.gatewaySubnet',
            '{name}: gateway {gateway} is not in the subnet of {ip} ({mask}) - unreachable',
          ),
          { name: e.name, gateway: e.gateway, ip: e.ipAddress, mask },
        ),
        equipmentId: e.id,
      })
    }
  }

  // — Check 19: Drum-Mikrofonierung — Mic-Inputs & Phantom-Bedarf ------------
  // Der Drum-Plan braucht je Kanal einen Mic-Input (XLR/Mini-XLR) und je
  // Phantom-Mic 48V. Wir zählen die REALEN XLR-Eingangsports im Plan (kein
  // Raten) und melden Unterdeckung. Unbekannte Mics werden ehrlich als solche
  // markiert — ihr Phantom-/SPL-Bedarf ist nicht prüfbar.
  if (drumKit && drumKit.mics.length > 0) {
    const d = deriveDrumChannels(drumKit)
    // Verfügbare Mic-Inputs = symmetrische XLR-Eingänge im Plan (physische I/O).
    let micInputs = 0
    for (const e of equipment) {
      for (const p of e.inputs) {
        if (p.connectorType === 'XLR' || p.connectorType === 'Mini-XLR') micInputs += 1
      }
    }
    if (d.channelCount > micInputs) {
      findings.push({
        id: 'drum-mic-inputs',
        severity: 'warning',
        category: 'Drum micing',
        message: format(
          tr(
            'check.drumMicInputs',
            'The drum kit needs {need} mic inputs, but the plan has only {have} XLR inputs - plan the missing {missing} channels (stagebox/preamps).',
          ),
          { need: d.channelCount, have: micInputs, missing: d.channelCount - micInputs },
        ),
      })
    }
    if (d.phantomCount > 0) {
      findings.push({
        id: 'drum-phantom',
        severity: 'info',
        category: 'Drum micing',
        message: format(
          tr(
            'check.drumPhantom',
            '{n} drum mic(s) need 48 V phantom - make sure the preamps/console can switch phantom power.',
          ),
          { n: d.phantomCount },
        ),
      })
    }
    if (d.unknownCount > 0) {
      findings.push({
        id: 'drum-unknown-mics',
        severity: 'warning',
        category: 'Drum micing',
        message: format(
          tr(
            'check.drumUnknownMics',
            '{n} drum channel(s) without an assigned mic model - phantom/SPL needs cannot be checked, assign a model.',
          ),
          { n: d.unknownCount },
        ),
      })
    }
    if (d.splRiskCount > 0) {
      findings.push({
        id: 'drum-spl-risk',
        severity: 'warning',
        category: 'Drum micing',
        message: format(
          tr(
            'check.drumSplRisk',
            '{n} mic(s) in a loud zone (kick/snare) with a marginal max SPL (< {db} dB) - risk of distortion, check a pad or a tougher mic.',
          ),
          { n: d.splRiskCount, db: 140 },
        ),
      })
    }
  }

  // — Check 20: Zeichenbudgets externer Systeme (ADR-001) --------------------
  // Was der Plan an ATEM, Videohub, UMD und Dante abgibt, wird dort auf harte
  // Feldlaengen zugeschnitten. Zwei Namen, die danach gleich sind, faellt
  // sonst erst auf dem Multiviewer auf. Die Ableitung liegt in
  // `labelDerivation.ts` und ist ohne Store/React testbar.
  // Uebersetzt wird HIER und nicht drueben: `labelDerivation` ist sprachfrei,
  // weil es im Importgraphen der Mobile-Ansicht liegt (#837).
  for (const befund of labelTargetIssues({ equipment, cables, sourceIdentities })) {
    findings.push(
      befund.schluessel
        ? { ...befund, message: format(tr(befund.schluessel, befund.message), befund.werte ?? {}) }
        : befund,
    )
  }

  // — Check 21: Adapter — passt er an dieser Stelle? (B-46) ------------------
  //
  // Der gefährliche Fall aus dem Wunsch des Eigentümers ist nicht der Adapter,
  // der fehlt — der fällt beim Aufbau auf. Es ist der, den der Plan als
  // „passt" zeichnet, obwohl die Quelle es nicht kann: „USB-C auf
  // DisplayPort" arbeitet nur an einem Anschluss mit
  // DisplayPort-Alternate-Mode, und zwei USB-C-Buchsen sehen gleich aus.
  //
  // Deshalb DREI Ausgänge und nicht zwei. Ein Adapter, dessen Angaben fehlen,
  // ergibt einen `info`-Befund („nicht erklärt") und keinen Fehler — aber er
  // ergibt eben auch nicht nichts. Nichts hiesse auf dem Blatt „geprüft und in
  // Ordnung", und genau das ist er nicht.
  for (const geraet of equipment) {
    if (!geraet.adapter) continue
    const hinein = cables.filter((c) => c.toEquipmentId === geraet.id)
    const hinaus = cables.filter((c) => c.fromEquipmentId === geraet.id)

    // Ohne beide Seiten gibt es keine Lage zu beurteilen. Das ist ein eigener
    // Befund und kein „nicht erklärt": hier fehlt kein Feld, hier fehlt ein
    // Kabel.
    if (hinein.length === 0 || hinaus.length === 0) {
      findings.push({
        id: `adapter-unverkabelt:${geraet.id}`,
        severity: 'warning',
        category: 'Adapter',
        message: format(
          tr(
            'check.adapterHalfWired',
            '{name}: the adapter {from} ↔ {to} is connected on one side only - the path stops here.',
          ),
          { name: geraet.name, from: geraet.adapter.von, to: geraet.adapter.nach },
        ),
        equipmentId: geraet.id,
      })
      continue
    }

    for (const rein of hinein) {
      const quellPort = portById.get(rein.fromPortId)
      const quellGeraet = equipment.find((e) => e.id === rein.fromEquipmentId)
      for (const raus of hinaus) {
        const senkePort = portById.get(raus.toPortId)
        const urteil = beurteileAdapter(geraet.adapter, {
          quelleSteckt: quellPort?.connectorType,
          senkeSteckt: senkePort?.connectorType,
          // Der Standard des ANKOMMENDEN Kabels ist der, der durch muss.
          verlangt: rein.standard,
          quelleKann: quellGeraet?.kann,
        })
        if (urteil.art === 'passt') continue
        findings.push({
          id: `adapter-${urteil.art}:${geraet.id}:${rein.id}:${raus.id}`,
          severity: urteil.art === 'passt-nicht' ? 'error' : 'info',
          category: 'Adapter',
          message: format(tr('check.onDevice', '{name}: {what}'), {
            name: geraet.name,
            what: format(tr(urteil.schluessel, urteil.text), urteil.werte),
          }),
          equipmentId: geraet.id,
          cableId: rein.id,
        })
      }
    }
  }

  // — Check 22: Adernbündel — liegt jeder geplante Leiter? (B-45) ----------
  //
  // Der Fehler, den ein Plan finden MUSS: vier gezogene Leitungen bei fünf
  // geplanten. Powerlock zieht man je Leiter einzeln, und ohne das `soll` am
  // Bündel könnte hier nur gezählt werden, was da ist — nie, was fehlt.
  //
  // Die Schwere folgt der Bedeutung und nicht der Sortierung: eine fehlende
  // Ader ist eine Leitung, die auf der Baustelle nicht liegt (`error`); eine
  // fehlende Farbnorm ist eine Angabe, die niemand eingetragen hat (`info`).
  // Wer beide gleich zeigt, lässt die erste in der zweiten untergehen.
  const SCHWERE: Record<string, CheckSeverity> = {
    'ader-fehlt': 'error',
    'ader-doppelt': 'error',
    'farbe-widerspricht': 'error',
    'leitung-stumm': 'warning',
    'norm-offen': 'info',
  }
  for (const anschluss of anschlussListe ?? []) {
    const leitungen: AnschlussLeitung[] = cables
      .filter((c) => c.anschlussId === anschluss.id)
      .map((c) => ({
        cableId: c.id,
        bezeichnung: c.cableNumber?.trim() || c.name?.trim() || c.type || c.id,
        adern: c.adern ?? [],
      }))
    const norm = (farbnormen ?? []).find((n) => n.id === anschluss.farbnormId)
    for (const b of anschlussBefunde(anschluss, leitungen, norm)) {
      findings.push({
        id: `anschluss-${b.art}:${b.anschlussId}${b.cableId ? `:${b.cableId}` : ''}:${b.text.length}`,
        severity: SCHWERE[b.art] ?? 'info',
        category: 'Wire bundle',
        message: format(tr(b.schluessel, b.text), b.werte),
        ...(b.cableId ? { cableId: b.cableId } : {}),
      })
    }
  }

  // — Check 23: kommt das Bild an, das geschickt wird? (B-47) --------------
  //
  // Der Wunsch des Eigentümers war „Monitore sind noch nicht intelligent" —
  // und die Frage dahinter ist nicht die Aushandlung am Kabel (die passiert
  // zwischen zwei Geräten und nicht in einer Planungssoftware), sondern die,
  // die man VORHER stellt: nimmt die Senke an, was ich schicke?
  //
  // Ein Monitor OHNE erklärtes Profil ergibt einen `info`-Befund und nicht
  // nichts. Nichts hiesse auf dem Blatt „geprüft und in Ordnung", und genau
  // das ist er nicht — über ihn ist schlicht nichts bekannt.
  //
  // WAS HIER NICHT NOCHMAL GERECHNET WIRD: die Grenze eines Adapters auf dem
  // Weg. Die steht in Check 21 und würde hier ein zweites Mal beantwortet —
  // `zwei-rechnungen`, und die beiden liefen beim nächsten Umbau auseinander.
  for (const c of cables) {
    if (c.wireless) continue
    const senke = eqById.get(c.toEquipmentId)
    if (!senke) continue
    // WORAN DIESER CHECK ANSPRINGT — und woran ausdrücklich nicht.
    //
    // Die erste Fassung nahm zusätzlich `category.includes('monitor')` als
    // Hinweis, dass ein Gerät eine Anzeige ist. Das ist ein Namensabgleich,
    // und ADR-002 schliesst ihn für folgenreiche Entscheidungen aus: eine
    // „Regie-Monitorwand" bekäme Befunde, ein „Display Wall Controller"
    // keine, und beides wäre eine Aussage über die Schreibweise der
    // Kategorie und nicht über das Gerät.
    //
    // Angesprungen wird deshalb nur, wo jemand etwas ERKLÄRT hat:
    //   • die Senke trägt ein Profil  -> gegen den Projekt-Vorgabewert prüfen
    //   • das Kabel nennt ein Format  -> jemand sagt „hier läuft Bild", also
    //                                    ist ein fehlendes Profil eine Lücke
    // Ohne beides schweigt der Check. Der Projekt-Vorgabewert allein reicht
    // NICHT: er gilt für jede Strecke, und ein „nicht erklärt" an jeder
    // Steckdose wäre Rauschen, in dem die echten Befunde untergehen.
    const formatId = c.videoFormat ?? (senke.senkenprofil ? defaultVideoFormat : undefined)
    if (!formatId) continue
    const urteil = beurteileBild(senke.senkenprofil, { formatId }, senke.name)
    if (urteil.art === 'passt') continue
    findings.push({
      id: `bild-${urteil.art}:${c.id}`,
      severity: urteil.art === 'passt-nicht' ? 'error' : 'info',
      category: 'Video format',
      message: format(tr(urteil.schluessel, urteil.text), urteil.werte),
      equipmentId: senke.id,
      cableId: c.id,
    })
  }

  // Sortierung: error → warning → info, innerhalb stabil nach category.
  const rank: Record<CheckSeverity, number> = { error: 0, warning: 1, info: 2 }
  findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.category.localeCompare(b.category))

  return {
    findings,
    errorCount: findings.filter((f) => f.severity === 'error').length,
    warningCount: findings.filter((f) => f.severity === 'warning').length,
    infoCount: findings.filter((f) => f.severity === 'info').length,
  }
}
