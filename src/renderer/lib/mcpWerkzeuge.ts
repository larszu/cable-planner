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
import { cableLabelId } from './docIds'
import type { CablePlannerProject } from '../types/project'
import type { EquipmentItem, Port } from '../types/equipment'

/** Die Namen der Werkzeuge. Eines je Frage, die #872 Stufe 1 nennt. */
export const MCP_WERKZEUGE = [
  'list_devices',
  'device_ports',
  'trace_signal',
  'list_cables',
  'plan_findings',
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

const geraetZeile = (e: EquipmentItem) => ({
  id: e.id,
  name: e.name,
  category: e.category ?? null,
  inputs: e.inputs.length,
  outputs: e.outputs.length,
})

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
): McpAntwort => {
  switch (werkzeug) {
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
        },
        text: `${geraet.name}: ${geraet.inputs.length} inputs, ${geraet.outputs.length} outputs.`,
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
          cables: seite.map((c) => ({
            id: c.id,
            label: cableLabelId(c),
            type: c.type,
            // Eine Laenge, die niemand eingetragen hat, ist nicht 0 m.
            lengthM: c.length ?? null,
            from: name(c.fromEquipmentId),
            to: name(c.toEquipmentId),
            layer: c.layer ?? null,
          })),
        },
        text: `${alle.length} cables match; showing ${seite.length} from ${offset}.`,
      }
    }

    case 'plan_findings': {
      const schwere = typeof args.severity === 'string' ? args.severity : ''
      const limit = grenze(args.limit, MCP_SEITE, MCP_SEITE_MAX)
      // DIESELBE Pruefung wie die Fussleiste und die Plan-Check-Palette. Eine
      // zweite hier waere eine zweite Vorstellung davon, was in Ordnung ist.
      const { findings, errorCount, warningCount, infoCount } = runDrawingChecks({
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
      const gefiltert = schwere ? findings.filter((f) => f.severity === schwere) : findings
      return {
        daten: {
          errorCount,
          warningCount,
          infoCount,
          total: gefiltert.length,
          findings: gefiltert.slice(0, limit).map((f) => ({
            id: f.id,
            severity: f.severity,
            category: f.category,
            message: f.message,
          })),
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
