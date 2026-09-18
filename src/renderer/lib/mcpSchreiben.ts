// ───────────────────────────────────────────────────────────────────────────
// Was der MCP-Server AENDERN darf (#873, Stufe 2).
//
// ═══════════════════════════════════════════════════════════════════════════
// DIESELBEN AKTIONEN WIE DIE OBERFLAECHE — UND ZWAR WIRKLICH
// ═══════════════════════════════════════════════════════════════════════════
//
// #873 sagt es als Ziel: „ueber dieselben Store-Aktionen wie die
// Oberflaeche". Das ist keine Stilfrage. `addCablesBulk` prueft die
// Port-Belegung, erbt den Kabeltyp aus den Ports, findet die Spezifikation
// und setzt die Ebene; `deleteCable` raeumt die Verweise auf. Eine eigene
// Schreibroutine haette all das nachzubauen — und waere ab dem ersten
// Sonderfall eine zweite Vorstellung davon, was ein Kabel ist.
//
// Dieses Modul bekommt die Aktionen deshalb HEREINGEREICHT (`Aktionen`).
// Das hat zwei Wirkungen: es kann nichts anderes anfassen als das, was hier
// steht, und ein Test kann es ohne Store stellen.
//
// ═══════════════════════════════════════════════════════════════════════════
// WAS NICHT GEHT, UND WARUM NICHT
// ═══════════════════════════════════════════════════════════════════════════
//
// KEIN SCHALTBEFEHL. Kein Videohub, kein ATEM, keine Kreuzpunkte. #873 sagt
// den Grund in einem Satz: „ein Modell, das waehrend der Sendung Routing
// schaltet, ist ein Risiko ohne Gegenwert". Lesen ja (Stufe 1), schalten nie.
//
// KEIN LOESCHEN VON GERAETEN. Ein Geraet zu loeschen nimmt seine Kabel mit,
// und was daran haengt — Rack-Platzierung, Checks, Fotos — steht an
// Dutzenden Stellen. Diese Stufe trennt Verbindungen; ein Geraet entfernt
// der Mensch.
//
// KEINE ERFUNDENEN ANGABEN. Wer ein Kabel anlegt, ohne eine Laenge zu
// nennen, bekommt kein „0 m": das Feld bleibt, wie die Aktion es setzt, und
// die Antwort sagt, was fehlt.
//
// REIN: keine Uhr ausser der hereingereichten, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import { cableCatalog, checkCableCompatibility } from '../types/cableSpec'
import type { CablePlannerProject } from '../types/project'
import type { Cable } from '../types/cable'
import type { ConnectorType, EquipmentItem } from '../types/equipment'

/** Die Namen der schreibenden Werkzeuge. */
export const MCP_SCHREIBWERKZEUGE = [
  'connect_ports',
  'disconnect_cable',
  'set_cable',
  'rename_device',
] as const

export type McpSchreibwerkzeug = (typeof MCP_SCHREIBWERKZEUGE)[number]

/** Welche davon etwas WEGNEHMEN — sie tragen `destructiveHint`. */
export const MCP_ZERSTOEREND: ReadonlySet<string> = new Set(['disconnect_cable'])

/**
 * Die Store-Aktionen, die dieses Modul benutzen darf. Mehr gibt es nicht —
 * und genau das ist der Zweck der Schnittstelle.
 */
export interface Aktionen {
  /**
   * Dieselbe Signatur wie im Store — absichtlich. Die Pflichtfelder des
   * Entwurfs sind die des Stores; sie hier optional zu machen hiesse, dass
   * dieses Modul einen zweiten, weicheren Kabelbegriff hat.
   */
  addCablesBulk: (
    drafts: Array<{
      fromEquipmentId: string
      fromPortId: string
      toEquipmentId: string
      toPortId: string
      name: string
      type: Cable['type']
      length: number
      color: string
      notes: string
    }>,
  ) => { created: number; skipped: number; skippedReasons: string[] }
  deleteCable: (id: string) => void
  updateCable: (id: string, patch: Partial<Cable>) => void
  updateEquipment: (id: string, patch: Partial<EquipmentItem>) => void
}

export interface SchreibAntwort {
  daten: Record<string, unknown>
  text: string
  /** Fuer den MCP-Aufrufer: hat es geklappt? */
  ok: boolean
}

const nein = (text: string, daten: Record<string, unknown> = {}): SchreibAntwort => ({
  ok: false,
  text,
  daten: { ok: false, ...daten },
})

const findePort = (
  project: Readonly<CablePlannerProject>,
  geraetId: string,
  portId: string,
): { geraet: EquipmentItem; port: { id: string; name: string; connectorType: ConnectorType } } | null => {
  const geraet = project.equipment.find((e) => e.id === geraetId || e.name === geraetId)
  if (!geraet) return null
  const port = [...geraet.inputs, ...geraet.outputs].find((p) => p.id === portId || p.name === portId)
  return port ? { geraet, port } : null
}

/**
 * Was statt dessen ginge.
 *
 * #873 verlangt genau das: „Fehlermeldung sagt, was stattdessen geht (z. B.
 * ‚SDI-Ausgang auf HDMI-Eingang: Konverter noetig')". Eine Ablehnung ohne
 * Ausweg schickt das Modell in eine Schleife — es versucht dasselbe noch
 * einmal, weil es nichts Besseres weiss.
 */
const rat = (von: ConnectorType, nach: ConnectorType): string => {
  if (von === nach) return ''
  const passend = cableCatalog.find((spec) => {
    const r = checkCableCompatibility(von, nach, spec)
    return r.level !== 'error'
  })
  return passend
    ? `A "${passend.name}" cable fits both ends.`
    : `No cable in the catalogue connects ${von} to ${nach} directly - this needs a converter, and the planner names converters instead of inserting them.`
}

export const fuehreSchreibwerkzeugAus = (
  project: Readonly<CablePlannerProject>,
  aktionen: Aktionen,
  werkzeug: string,
  args: Record<string, unknown> = {},
): SchreibAntwort => {
  switch (werkzeug) {
    case 'connect_ports': {
      const von = findePort(
        project,
        String(args.fromDeviceId ?? ''),
        String(args.fromPortId ?? ''),
      )
      const nach = findePort(project, String(args.toDeviceId ?? ''), String(args.toPortId ?? ''))
      if (!von) return nein(`No device/port for ${String(args.fromDeviceId)} / ${String(args.fromPortId)}.`)
      if (!nach) return nein(`No device/port for ${String(args.toDeviceId)} / ${String(args.toPortId)}.`)

      const typ = typeof args.type === 'string' ? (args.type as Cable['type']) : undefined
      // Der Rat kommt VOR dem Versuch: er haengt an den Steckertypen und
      // nicht am Ergebnis, und er gehoert auch an eine Ablehnung des Stores.
      const hinweis = rat(von.port.connectorType, nach.port.connectorType)

      // Die Laenge ist 0, wenn keine genannt wurde — wie im Vorschlags-Dialog
      // des Schaltbilds, und aus demselben Grund: der Plan kennt sie nicht.
      // Die Antwort sagt das (siehe unten), damit aus der 0 keine Messung
      // wird.
      const ergebnis = aktionen.addCablesBulk([
        {
          fromEquipmentId: von.geraet.id,
          fromPortId: von.port.id,
          toEquipmentId: nach.geraet.id,
          toPortId: nach.port.id,
          name: typeof args.name === 'string' ? args.name : '',
          type: typ ?? ('unbekannt' as Cable['type']),
          length: typeof args.length === 'number' ? args.length : 0,
          color: typeof args.color === 'string' ? args.color : '',
          notes: typeof args.notes === 'string' ? args.notes : '',
        },
      ])

      if (ergebnis.created === 0) {
        return nein(
          `Not connected: ${ergebnis.skippedReasons.join(' ') || 'the planner refused it.'} ${hinweis}`.trim(),
          { reasons: ergebnis.skippedReasons },
        )
      }
      return {
        ok: true,
        daten: {
          ok: true,
          created: ergebnis.created,
          advice: hinweis || null,
          lengthStated: typeof args.length === 'number',
        },
        text: `Connected ${von.geraet.name} · ${von.port.name} to ${nach.geraet.name} · ${nach.port.name}.${
          hinweis ? ` ${hinweis}` : ''
        }${
          typeof args.length === 'number'
            ? ''
            : ' No length was given, so it stands at 0 - that is a gap, not a measurement.'
        }`,
      }
    }

    case 'disconnect_cable': {
      const id = String(args.cableId ?? '')
      const kabel = project.cables.find((c) => c.id === id || c.cableNumber === id || c.name === id)
      if (!kabel) return nein(`No cable with id, number or name "${id}".`)
      aktionen.deleteCable(kabel.id)
      return {
        ok: true,
        daten: { ok: true, removed: kabel.id },
        text: `Removed the cable "${kabel.cableNumber || kabel.name || kabel.id}". One undo step takes it back.`,
      }
    }

    case 'set_cable': {
      const id = String(args.cableId ?? '')
      const kabel = project.cables.find((c) => c.id === id || c.cableNumber === id || c.name === id)
      if (!kabel) return nein(`No cable with id, number or name "${id}".`)
      const patch: Partial<Cable> = {}
      if (typeof args.name === 'string') patch.name = args.name
      if (typeof args.length === 'number') patch.length = args.length
      if (typeof args.notes === 'string') patch.notes = args.notes
      if (typeof args.color === 'string') patch.color = args.color
      if (typeof args.layer === 'string') patch.layer = args.layer
      if (Object.keys(patch).length === 0) {
        // Kein stiller Erfolg fuer einen Aufruf, der nichts tut: das Modell
        // haette sonst „erledigt" gemeldet und nichts geaendert.
        return nein('Nothing to change - pass at least one of name, length, notes, color, layer.')
      }
      aktionen.updateCable(kabel.id, patch)
      return {
        ok: true,
        daten: { ok: true, cableId: kabel.id, changed: Object.keys(patch) },
        text: `Updated ${Object.keys(patch).join(', ')} on "${kabel.cableNumber || kabel.name || kabel.id}".`,
      }
    }

    case 'rename_device': {
      const id = String(args.deviceId ?? '')
      const name = typeof args.name === 'string' ? args.name.trim() : ''
      const geraet = project.equipment.find((e) => e.id === id || e.name === id)
      if (!geraet) return nein(`No device with id or name "${id}".`)
      if (!name) return nein('A device needs a name - an empty one would hide it in every list.')
      aktionen.updateEquipment(geraet.id, { name })
      return {
        ok: true,
        daten: { ok: true, deviceId: geraet.id, name },
        text: `Renamed "${geraet.name}" to "${name}".`,
      }
    }

    default:
      return nein(`Unknown write tool "${werkzeug}".`, { known: MCP_SCHREIBWERKZEUGE })
  }
}
