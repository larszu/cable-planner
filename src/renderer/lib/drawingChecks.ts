// #411 — Vereinte „Plan-Check"-Engine.
//
// Sammelt alle Plan-Validierungen an EINER Stelle, damit die UI (PlanCheckPanel
// + StatusBar-Badge) einen Live-Gesamtstatus zeigen kann — analog zu ConnectCADs
// „Status"-Palette. Rein lesend, non-destruktiv.
//
// Die Heuristiken sind bewusst die GLEICHEN wie im AnalysisDialog (Doppel-IP,
// RF-Konflikt, Single-Power) plus neue, dort fehlende Checks (offene Ports,
// inkompatible Connectoren, doppelte Kabelnummern, fehlende Längen). Wir
// duplizieren nur die kleinen reinen Helfer (parseFreqMHz, effectiveWatts),
// nicht die Report-UI.

import type { Cable } from '../types/cable'
import type { EquipmentItem, Port, ConnectorType } from '../types/equipment'
import type { DrumKitPlan } from '../types/drumKit'
import { checkImpedanceMismatch, checkBalanceMismatch, maxPassiveLengthM } from '../types/cableSpec'
import { networkAddress } from './subnet'
import { deriveDrumChannels } from './drumMicing'

export type CheckSeverity = 'error' | 'warning' | 'info'

export interface CheckFinding {
  /** Stabile ID (Check-Typ + betroffenes Element) — als React-key nutzbar. */
  id: string
  severity: CheckSeverity
  /** Kurzer Check-Typ als Gruppen-Label, z.B. "Doppelte IP". */
  category: string
  /** Menschlich lesbare Beschreibung des konkreten Fundes. */
  message: string
  /** Klick-Ziel: selektiert dieses Gerät bzw. Kabel auf dem Canvas. */
  equipmentId?: string
  cableId?: string
}

/** Effektive Leistung eines Geräts: explizite Watt, sonst V×A. */
const effectiveWatts = (e: EquipmentItem): number =>
  e.powerConsumptionWatts ?? (e.voltage && e.currentAmps ? e.voltage * e.currentAmps : 0)

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
  { equipment, cables, drumKit }: DrawingCheckInput,
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
        category: 'Offene Ports',
        message: `${e.name}: ${open.length} unverbundene Ports (${open
          .slice(0, 4)
          .map((p) => p.name)
          .join(', ')}${open.length > 4 ? ' …' : ''})`,
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
        category: 'Connector-Mismatch',
        message: `${c.cableNumber ? c.cableNumber + ' · ' : ''}${eqName(
          c.fromEquipmentId,
        )} (${from.connectorType}) → ${eqName(c.toEquipmentId)} (${to.connectorType})`,
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
          category: 'Doppelte Kabelnummer',
          message: `Kabelnummer „${num}" ${group.length}× vergeben: ${eqName(
            c.fromEquipmentId,
          )} → ${eqName(c.toEquipmentId)}`,
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
        category: 'Fehlende Länge',
        message: `${c.cableNumber ? c.cableNumber + ' · ' : ''}${eqName(
          c.fromEquipmentId,
        )} → ${eqName(c.toEquipmentId)}: keine Länge gesetzt`,
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
          category: 'Doppelte IP',
          message: `IP ${ip} mehrfach: ${group.map((g) => g.name).join(', ')}`,
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
          ? `gleicher Kanal ${a.channel}`
          : `Frequenzabstand < ${RF_MIN_SPACING_MHZ} MHz`
        findings.push({
          id: `rf-conflict:${a.cable.id}:${b.cable.id}`,
          severity: 'warning',
          category: 'RF-Konflikt',
          message: `${eqName(a.cable.fromEquipmentId)} ⟷ ${eqName(
            b.cable.fromEquipmentId,
          )}: ${why}`,
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
        category: 'Single-Power',
        message: `${e.name}: nur eine Strom-Anbindung (kein redundantes Netzteil)`,
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
        message: `${e.name}: TC-Senke, aber keine TC-Quelle (Generator) im Plan`,
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
        message: `${e.name}: Tally-Senke, aber keine Tally-Quelle (Mischer/Tally-Hub) im Plan`,
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
        category: 'Verteilverstärker',
        message: `${e.name}: als Verteilverstärker markiert, aber nur ${e.outputs.length} Ausgang/Ausgänge (1→N erwartet)`,
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
        category: 'Impedanz-Mismatch',
        message: `${eqName(c.fromEquipmentId)} → ${eqName(c.toEquipmentId)}: ${mismatch.message}`,
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
      const lbl = (k: 'mm' | 'sm') => (k === 'mm' ? 'Multimode' : 'Singlemode')
      findings.push({
        id: `fiber-mismatch:${c.id}`,
        severity: 'warning',
        category: 'Faser-Mismatch',
        message: `${eqName(c.fromEquipmentId)} → ${eqName(c.toEquipmentId)}: ${from?.fiberClass} (${lbl(a)}) ↔ ${to?.fiberClass} (${lbl(b)}) — optisch inkompatibel`,
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
      message:
        'ST 2110 im Plan, aber kein PTP-Signal — PTP-Grandmaster (IEEE 1588) als Referenz nicht vergessen.',
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
        message:
          'ST 2110 im Plan — NMOS-Registry (IS-04 Discovery / IS-05 Connection Management) für Auffindbarkeit + Routing einplanen.',
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
      message: `${sdiCount} SDI-Signale, aber keine Genlock-/Referenz-Verteilung (Blackburst/Tri-Level) — Sync prüfen.`,
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
        category: 'Kabellänge',
        message: `${eqName(c.fromEquipmentId)} → ${eqName(c.toEquipmentId)}: ${c.length} m überschreitet die passive ${c.standard}-Grenze (~${limit} m) — aktive Lösung (AOC/HDBaseT/Extender/LWL) nötig`,
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
    if (dmxLines > 0) parts.push(`${dmxLines} DMX-Linien (≈ ${dmxLines} Universen, ${dmxLines * 512} Kanäle)`)
    if (artnetLinks > 0) parts.push(`${artnetLinks} Art-Net/sACN-Links (mehrere Universen je Link)`)
    findings.push({
      id: 'dmx-summary',
      severity: 'info',
      category: 'Licht / DMX',
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
        message: `${sw.name}: PoE-Last ${Math.round(load)} W an ${count} Geräten übersteigt das Budget (${budget} W)`,
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
        category: 'Audio sym/unsym',
        message: `${eqName(c.fromEquipmentId)} → ${eqName(c.toEquipmentId)}: ${bal.message}`,
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
          message: `${e.name}: Dual-Link-Set „${grp}" unvollständig — ${g.connected}/${g.total} Links verbunden (${g.names.join(', ')})`,
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
        category: 'LWL-Stecker',
        message: `${eqName(c.fromEquipmentId)} → ${eqName(c.toEquipmentId)}: ${a} ↔ ${b} — optischer Steckertyp ungleich (Adapter/Hybrid-Patch nötig)`,
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
        category: 'Ports unbekannt',
        message: `${e.name}: Port-Belegung unbekannt (kein Datenblatt-Match) — reale Anschlüsse aus dem Datenblatt ergänzen`,
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
        category: 'Gateway/Subnetz',
        message: `${e.name}: Gateway ${e.gateway} liegt nicht im Subnetz von ${e.ipAddress} (${mask}) — nicht erreichbar`,
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
        category: 'Drum-Mikrofonierung',
        message: `Drum-Kit braucht ${d.channelCount} Mic-Inputs, aber nur ${micInputs} XLR-Eingänge im Plan — fehlende ${d.channelCount - micInputs} Kanäle einplanen (Stagebox/Preamps).`,
      })
    }
    if (d.phantomCount > 0) {
      findings.push({
        id: 'drum-phantom',
        severity: 'info',
        category: 'Drum-Mikrofonierung',
        message: `${d.phantomCount} Drum-Mic(s) brauchen 48V-Phantom — Preamps/Pult mit schaltbarer Phantomspeisung sicherstellen.`,
      })
    }
    if (d.unknownCount > 0) {
      findings.push({
        id: 'drum-unknown-mics',
        severity: 'warning',
        category: 'Drum-Mikrofonierung',
        message: `${d.unknownCount} Drum-Kanal/Kanäle ohne zugeordnetes Mic-Modell — Phantom-/SPL-Bedarf nicht prüfbar, Modell zuweisen.`,
      })
    }
    if (d.splRiskCount > 0) {
      findings.push({
        id: 'drum-spl-risk',
        severity: 'warning',
        category: 'Drum-Mikrofonierung',
        message: `${d.splRiskCount} Mic(s) an lauter Zone (Kick/Snare) mit grenzwertigem Max SPL (< ${140} dB) — Verzerrungsrisiko, Pad/robusteres Mic prüfen.`,
      })
    }
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
