// ───────────────────────────────────────────────────────────────────────────
// Was der MCP-Server antwortet (#872, Stufe 1).
//
// ─── WARUM DIE ANTWORTEN HIER STEHEN UND NICHT IN `src/main` ───────────────
//
// Weil die Rechnungen hier stehen: `signalChains`, `runDrawingChecks`,
// `portDisplayLabel`. Sie im Hauptprozess nachzubauen waere die Defektform,
// die dieses Repo `zwei-rechnungen` nennt — und zwar an der teuersten Stelle:
// ein Assistent, der eine ANDERE Signalkette meldet als der Plan auf dem
// Bildschirm, ist schlimmer als einer, der nichts meldet.
//
// Die Architektur aus #872 sagt genau das:
//
//     Electron-Main: src/main/mcp/   → IPC mcp:* → Renderer → projectStore
//
// Der Server nimmt die Frage entgegen und reicht sie herein; beantwortet wird
// sie dort, wo der Plan lebt. Dateien liest er NIE: das umginge
// `healProjectPositions`, Undo und die Sicherungskopie.
//
// ─── NUR LESEN, UND ZWAR NACHWEISBAR ───────────────────────────────────────
//
// Dieses Modul bekommt den Plan als `readonly` und gibt einfache Objekte
// zurueck. Es hat keinen Zugriff auf den Store, keine Setter, kein IO —
// `tests/mcpWerkzeuge.test.ts` haelt fest, dass hier nichts geschrieben wird.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import { signalChains } from './signalChain'
import { runDrawingChecks } from './drawingChecks'
import { portDisplayLabel } from './portLabel'
import { deviceInterfaces } from './networkInterfaces'
import { streamZeilen } from './streamEndpoints'
import { cableLabelId } from './docIds'
import { findeGeraet, findePort } from './mcpAufloesen'
import type { CablePlannerProject } from '../types/project'
import type { EquipmentItem, EquipmentTemplate, Port } from '../types/equipment'

/** Die Namen der Werkzeuge. Eines je Frage, die #872 Stufe 1 nennt. */
export const MCP_WERKZEUGE = [
  'list_devices',
  'device_ports',
  'trace_signal',
  'list_cables',
  'plan_findings',
  'search_library',
  'verify_cabling',
] as const

export type McpWerkzeug = (typeof MCP_WERKZEUGE)[number]

export const istWerkzeug = (v: unknown): v is McpWerkzeug =>
  typeof v === 'string' && (MCP_WERKZEUGE as readonly string[]).includes(v)

/**
 * Wieviele Zeilen eine Antwort hoechstens traegt.
 *
 * Nicht aus Vorsicht, sondern aus Erfahrung mit dem Gegenueber: ein Plan mit
 * 800 Geraeten sind als JSON ein paar hundert Kilobyte, und die liest ein
 * Sprachmodell nicht besser als fuenfzig Zeilen mit einer klaren Zahl daneben,
 * wieviele es insgesamt sind. Die Paginierung steht deshalb in der Antwort
 * und nicht nur im Schema.
 */
export const MCP_SEITE = 50
export const MCP_SEITE_MAX = 200
/** Vorlagen tragen alle Ports; zehn sind schon eine lange Antwort. */
export const MCP_BIBLIOTHEK_SEITE = 10

export interface McpAntwort {
  /** Was strukturiert zurueckgeht (`structuredContent` im MCP-Sinn). */
  daten: Record<string, unknown>
  /** Ein Satz fuer den Menschen bzw. das Modell davor. */
  text: string
}

const grenze = (n: unknown, vorgabe: number, max: number): number => {
  const z = Number(n)
  if (!Number.isFinite(z) || z <= 0) return vorgabe
  return Math.min(Math.floor(z), max)
}

const passt = (text: string, suche: string): boolean =>
  !suche || text.toLowerCase().includes(suche.toLowerCase())

const portZeile = (p: Port, richtung: 'in' | 'out') => ({
  id: p.id,
  name: portDisplayLabel(p) || p.name,
  direction: richtung,
  connectorType: p.connectorType,
  standard: p.standard ?? null,
  gender: p.gender ?? null,
  // „nicht angegeben" bleibt `null` und wird nicht zu `false`: ein Modell,
  // das aus `false` „ist nicht belegt" liest, sagt es dem Menschen weiter.
  contentLabel: p.contentLabel ?? null,
})

const kabelZeile = (c: CablePlannerProject['cables'][number], name: (id: string) => string) => ({
  id: c.id,
  label: cableLabelId(c),
  type: c.type,
  // Eine Laenge, die niemand eingetragen hat, ist nicht 0 m.
  lengthM: c.length ?? null,
  from: name(c.fromEquipmentId),
  to: name(c.toEquipmentId),
  layer: c.layer ?? null,
})

const befunde = (project: Readonly<CablePlannerProject>) =>
  // DIESELBE Pruefung wie die Fussleiste und die Plan-Check-Palette. Eine
  // zweite hier waere eine zweite Vorstellung davon, was in Ordnung ist.
  runDrawingChecks({
    equipment: project.equipment,
    cables: project.cables,
    drumKit: project.drumKit,
    sourceIdentities: project.sourceIdentities,
    anschlussListe: project.anschlussListe,
    farbnormen: project.farbnormen,
    polaritaetsnormen: project.polaritaetsnormen,
    polaritaetsnormId: project.polaritaetsnormId,
    ledWalls: project.ledWalls,
    ledPanelTypes: project.ledPanelTypes,
    defaultVideoFormat: project.metadata?.defaultVideoFormat,
    hausAuskunft: project.hausAuskunft,
  })

const befundZeile = (f: ReturnType<typeof befunde>['findings'][number]) => ({
  id: f.id,
  severity: f.severity,
  category: f.category,
  message: f.message,
})

const geraetZeile = (e: EquipmentItem) => ({
  id: e.id,
  name: e.name,
  category: e.category ?? null,
  inputs: e.inputs.length,
  outputs: e.outputs.length,
})

/**
 * #946 — Adressen mit VLAN und die Streams eines Geraets. Zugangsdaten sind
 * nicht im Plan und deshalb auch hier nicht; ein fehlendes VLAN ist `null`,
 * nicht 0.
 */
const netzZeilen = (e: EquipmentItem) =>
  deviceInterfaces(e).map((n) => ({
    label: n.label ?? null,
    role: n.role,
    ip: n.ipAddress ?? null,
    vlan: n.vlanId ?? null,
  }))

const streamZeilenMcp = (e: EquipmentItem) =>
  streamZeilen([e]).map((r) => ({
    id: r.stream.id,
    direction: r.stream.direction,
    protocol: r.protokoll,
    label: r.stream.label ?? null,
    address: r.adresse || null,
    vlan: r.vlanId ?? null,
    codec: r.stream.codec ?? null,
    format: r.stream.format ?? null,
  }))

const vorlageZeile = (t: EquipmentTemplate) => ({
  template: t.name,
  category: t.category ?? null,
  rackUnits: t.isRackDevice || t.rackUnits ? Math.max(1, t.rackUnits ?? 1) : null,
  manufacturerUrl: t.manufacturerUrl ?? null,
  ports: [
    ...t.inputs.map((p) => ({ name: p.name, direction: p.direction === 'bidirectional' ? 'bidirectional' : 'in', connectorType: p.connectorType })),
    ...t.outputs.map((p) => ({ name: p.name, direction: p.direction === 'bidirectional' ? 'bidirectional' : 'out', connectorType: p.connectorType })),
  ],
})

interface SollKabel {
  from?: unknown
  fromPort?: unknown
  to?: unknown
  toPort?: unknown
}

/**
 * #1052 — Soll gegen Ist. Vier Durchgaenge, von streng nach weich, und jedes
 * Planerkabel zaehlt hoechstens fuer EINE Sollzeile: erst exakte Treffer,
 * dann dieselben Ports andersherum (falsche Richtung), dann ein Kabel
 * zwischen denselben Geraeten, das einen der beiden Ports teilt (falscher
 * Port). Was danach uebrig ist, fehlt. Ueberzaehlig sind nur Kabel zwischen
 * Geraeten, die die Liste nennt — eine Teilliste soll den Rest der Anlage
 * nicht als Abweichung melden.
 */
const pruefeVerkabelung = (project: Readonly<CablePlannerProject>, soll: readonly SollKabel[]) => {
  const name = (id: string) => project.equipment.find((e) => e.id === id)?.name ?? '?'
  const portName = (geraetId: string, portId: string) => {
    const e = project.equipment.find((x) => x.id === geraetId)
    return [...(e?.inputs ?? []), ...(e?.outputs ?? [])].find((p) => p.id === portId)?.name ?? portId
  }
  const ist = (c: CablePlannerProject['cables'][number]) => ({
    cable: cableLabelId(c),
    from: name(c.fromEquipmentId),
    fromPort: portName(c.fromEquipmentId, c.fromPortId),
    to: name(c.toEquipmentId),
    toPort: portName(c.toEquipmentId, c.toPortId),
  })
  const vergeben = new Set<string>()
  const unaufgeloest: Array<Record<string, unknown>> = []
  const offen: Array<{ zeile: SollKabel; von: string; vp: string; nach: string; np: string }> = []
  const genannt = new Set<string>()
  for (const zeile of soll) {
    const von = findeGeraet(project, zeile.from)
    const nach = findeGeraet(project, zeile.to)
    if (von.ok) genannt.add(von.wert.id)
    if (nach.ok) genannt.add(nach.wert.id)
    const vp = von.ok ? findePort(von.wert, zeile.fromPort, 'from') : null
    const np = nach.ok ? findePort(nach.wert, zeile.toPort, 'to') : null
    const fehler = !von.ok ? von.fehler : !nach.ok ? nach.fehler : vp && !vp.ok ? vp.fehler : np && !np.ok ? np.fehler : ''
    if (fehler || !von.ok || !nach.ok || !vp?.ok || !np?.ok) {
      unaufgeloest.push({ expected: zeile, error: fehler })
      continue
    }
    offen.push({ zeile, von: von.wert.id, vp: vp.wert.port.id, nach: nach.wert.id, np: np.wert.port.id })
  }
  const nimm = (passt: (c: CablePlannerProject['cables'][number], o: (typeof offen)[number]) => boolean) => {
    const treffer: Array<{ o: (typeof offen)[number]; c: CablePlannerProject['cables'][number] }> = []
    for (const o of [...offen]) {
      const c = project.cables.find((k) => !vergeben.has(k.id) && passt(k, o))
      if (!c) continue
      vergeben.add(c.id)
      offen.splice(offen.indexOf(o), 1)
      treffer.push({ o, c })
    }
    return treffer
  }
  const exakt = nimm((c, o) => c.fromEquipmentId === o.von && c.fromPortId === o.vp && c.toEquipmentId === o.nach && c.toPortId === o.np)
  const verkehrt = nimm((c, o) => c.fromEquipmentId === o.nach && c.fromPortId === o.np && c.toEquipmentId === o.von && c.toPortId === o.vp)
  const falscherPort = nimm(
    (c, o) => c.fromEquipmentId === o.von && c.toEquipmentId === o.nach && (c.fromPortId === o.vp || c.toPortId === o.np),
  )
  const fehlt = offen.map((o) => o.zeile)
  const ueberzaehlig = project.cables
    .filter((c) => !vergeben.has(c.id) && genannt.has(c.fromEquipmentId) && genannt.has(c.toEquipmentId))
    .map(ist)
  const abweichungen = unaufgeloest.length + verkehrt.length + falscherPort.length + fehlt.length + ueberzaehlig.length
  return {
    deviations: abweichungen,
    matched: exakt.length,
    missing: fehlt,
    extra: ueberzaehlig,
    wrongPort: falscherPort.map(({ o, c }) => ({ expected: o.zeile, actual: ist(c) })),
    wrongDirection: verkehrt.map(({ o, c }) => ({ expected: o.zeile, actual: ist(c) })),
    unresolved: unaufgeloest,
  }
}

/**
 * Die eine Stelle, die eine Werkzeug-Frage beantwortet.
 *
 * Unbekannte Werkzeuge werfen NICHT, sie antworten mit einem Satz: der
 * Server steht zwischen zwei Programmen, und eine Ausnahme dort wird zu einem
 * Stapelabzug statt zu einer Auskunft.
 */
export const beantworteWerkzeug = (
  project: Readonly<CablePlannerProject>,
  werkzeug: string,
  args: Record<string, unknown> = {},
  /** #1052 — die Geraete-Bibliothek fuer `search_library`. */
  bibliothek: readonly EquipmentTemplate[] = [],
): McpAntwort => {
  switch (werkzeug) {
    case 'search_library': {
      // Jedes Wort muss im Namen oder in der Kategorie stehen: „Studio
      // Camera G2" findet „Blackmagic Studio Camera 4K Pro G2".
      const worte = (typeof args.query === 'string' ? args.query : '').toLowerCase().split(/\s+/).filter(Boolean)
      const kategorie = typeof args.category === 'string' ? args.category.toLowerCase() : ''
      const limit = grenze(args.limit, MCP_BIBLIOTHEK_SEITE, MCP_SEITE)
      const offset = Math.max(0, Math.floor(Number(args.offset) || 0))
      const alle = bibliothek.filter((t) => {
        const heu = `${t.name} ${t.category ?? ''}`.toLowerCase()
        return worte.every((w) => heu.includes(w)) && (!kategorie || (t.category ?? '').toLowerCase().includes(kategorie))
      })
      const seite = alle.slice(offset, offset + limit)
      const text = `${alle.length} library templates match; showing ${seite.length} from ${offset}.`
      return { daten: { total: alle.length, offset, templates: seite.map(vorlageZeile) }, text }
    }

    case 'verify_cabling': {
      const soll = Array.isArray(args.expected) ? (args.expected as SollKabel[]) : []
      const ergebnis = pruefeVerkabelung(project, soll)
      const text =
        ergebnis.deviations === 0
          ? `All ${ergebnis.matched} expected cables are in the plan, nothing extra between these devices.`
          : `${ergebnis.deviations} deviations: ${ergebnis.missing.length} missing, ${ergebnis.extra.length} extra, ${ergebnis.wrongPort.length} wrong port, ${ergebnis.wrongDirection.length} wrong direction, ${ergebnis.unresolved.length} not resolvable. ${ergebnis.matched} match.`
      return { daten: ergebnis, text }
    }

    case 'list_devices': {
      const suche = typeof args.query === 'string' ? args.query : ''
      const kategorie = typeof args.category === 'string' ? args.category : ''
      const limit = grenze(args.limit, MCP_SEITE, MCP_SEITE_MAX)
      const offset = Math.max(0, Math.floor(Number(args.offset) || 0))
      const alle = project.equipment.filter(
        (e) => passt(e.name, suche) && (!kategorie || (e.category ?? '') === kategorie),
      )
      const seite = alle.slice(offset, offset + limit)
      return {
        daten: {
          total: alle.length,
          offset,
          devices: seite.map(geraetZeile),
        },
        text: `${alle.length} devices match; showing ${seite.length} from ${offset}.`,
      }
    }

    case 'device_ports': {
      const id = typeof args.deviceId === 'string' ? args.deviceId : ''
      const geraet = project.equipment.find((e) => e.id === id || e.name === id)
      if (!geraet) {
        return {
          daten: { found: false },
          text: `No device with id or name "${id}" in this plan.`,
        }
      }
      return {
        daten: {
          found: true,
          device: geraetZeile(geraet),
          ports: [
            ...geraet.inputs.map((p) => portZeile(p, 'in')),
            ...geraet.outputs.map((p) => portZeile(p, 'out')),
          ],
          network: netzZeilen(geraet),
          streams: streamZeilenMcp(geraet),
        },
        text: `${geraet.name}: ${geraet.inputs.length} inputs, ${geraet.outputs.length} outputs, ${(geraet.streams ?? []).length} streams.`,
      }
    }

    case 'trace_signal': {
      const id = typeof args.deviceId === 'string' ? args.deviceId : ''
      const geraet = project.equipment.find((e) => e.id === id || e.name === id)
      if (!geraet) {
        return { daten: { found: false }, text: `No device with id or name "${id}" in this plan.` }
      }
      // `auchDirekte`: fuer die Frage „wo kommt es an" gehoert ein Monitor
      // direkt am Mischer dazu. Die Mehr-Ebenen-Ansicht laesst ihn weg, weil
      // er dort schon in der Patchliste steht.
      const ketten = signalChains(project.equipment, project.cables, {
        vonEquipmentId: geraet.id,
        auchDirekte: true,
      })
      return {
        daten: {
          found: true,
          from: geraetZeile(geraet),
          chains: ketten.map((k) => ({
            id: k.id,
            end: k.end,
            endNote: k.endNote,
            levels: k.levels,
            steps: k.steps.map((s) => ({
              cable: s.cableLabel,
              from: `${s.fromEquipmentName} · ${s.fromPortName}`,
              to: `${s.toEquipmentName} · ${s.toPortName}`,
              through: s.through,
            })),
          })),
        },
        text: `${ketten.length} paths start at ${geraet.name}.`,
      }
    }

    case 'list_cables': {
      const suche = typeof args.query === 'string' ? args.query : ''
      const limit = grenze(args.limit, MCP_SEITE, MCP_SEITE_MAX)
      const offset = Math.max(0, Math.floor(Number(args.offset) || 0))
      const name = (id: string) => project.equipment.find((e) => e.id === id)?.name ?? '?'
      const alle = project.cables.filter(
        (c) =>
          passt(c.name ?? '', suche) ||
          passt(c.type ?? '', suche) ||
          passt(c.cableNumber ?? '', suche) ||
          passt(name(c.fromEquipmentId), suche) ||
          passt(name(c.toEquipmentId), suche),
      )
      const seite = alle.slice(offset, offset + limit)
      return {
        daten: {
          total: alle.length,
          offset,
          cables: seite.map((c) => kabelZeile(c, name)),
        },
        text: `${alle.length} cables match; showing ${seite.length} from ${offset}.`,
      }
    }

    case 'plan_findings': {
      const schwere = typeof args.severity === 'string' ? args.severity : ''
      const limit = grenze(args.limit, MCP_SEITE, MCP_SEITE_MAX)
      const { findings, errorCount, warningCount, infoCount } = befunde(project)
      const gefiltert = schwere ? findings.filter((f) => f.severity === schwere) : findings
      return {
        daten: {
          errorCount,
          warningCount,
          infoCount,
          total: gefiltert.length,
          findings: gefiltert.slice(0, limit).map(befundZeile),
        },
        text: `${errorCount} errors, ${warningCount} warnings, ${infoCount} notes in this plan.`,
      }
    }

    default:
      return {
        daten: { known: MCP_WERKZEUGE },
        text: `Unknown tool "${werkzeug}".`,
      }
  }
}

// ─── #874 — DIE ANTWORTEN FUER DEN REMOTE-MCP ──────────────────────────────
//
// claude.ai erreicht keinen localhost; der Remote-MCP auf devices.zumpelars.de
// antwortet deshalb aus der Cloud-Revision. Rechnen darf er dort nicht — eine
// zweite Signalkette auf dem Server waere genau die Defektform, gegen die
// dieses Modul steht. Also rechnet der Planner beim Speichern alles, was die
// Werkzeuge brauchen, mit DENSELBEN Funktionen wie oben, und legt es neben die
// Revision. Der Server filtert und blaettert nur (av-device-library
// `src/server/mcp.ts`, gleiche Zeilenformen).

export const MCP_DIGEST_FORMAT = 'cable-planner-mcp-digest'

export const mcpDigest = (project: Readonly<CablePlannerProject>): Record<string, unknown> => {
  const name = (id: string) => project.equipment.find((e) => e.id === id)?.name ?? '?'
  const chains: Record<string, unknown[]> = {}
  for (const e of project.equipment) {
    const k = (beantworteWerkzeug(project, 'trace_signal', { deviceId: e.id }).daten.chains ?? []) as unknown[]
    if (k.length > 0) chains[e.id] = k
  }
  const { findings, errorCount, warningCount, infoCount } = befunde(project)
  return {
    format: MCP_DIGEST_FORMAT,
    version: 1,
    devices: project.equipment.map((e) => ({
      ...geraetZeile(e),
      ports: [...e.inputs.map((p) => portZeile(p, 'in')), ...e.outputs.map((p) => portZeile(p, 'out'))],
      network: netzZeilen(e),
      streams: streamZeilenMcp(e),
    })),
    // `name`/`number` nur fuer die Suche des Servers; er gibt sie nicht aus.
    cables: project.cables.map((c) => ({ ...kabelZeile(c, name), name: c.name ?? null, number: c.cableNumber ?? null })),
    chains,
    findings: { errorCount, warningCount, infoCount, findings: findings.map(befundZeile) },
  }
}
