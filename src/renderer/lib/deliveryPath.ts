// ───────────────────────────────────────────────────────────────────────────
// Der Ausspielweg (Bedarf 32, P1) — die Uebertragungskette als Signalfluss.
//
// WAS DER BEDARF SAGT:
//
//   > The transmission chain modelled as first-class signal flow (encoder,
//   > transport, destination, backup) rather than a note on the last node.
//   > Signal-flow diagrams stop at the encoder input; everything downstream
//   > lives in encoder web UIs, platform consoles and someone's head, so no
//   > artefact shows the delivery path.
//
// Und der Grund, warum das teuer ist, steht im Rollen-Bericht als Zitat von
// Alistair Horne: „REMI punishes sloppiness. If the timing's off, the links
// are fragile, the comms is messy or nobody's thought about what happens when
// something fails, remote production will find that weakness and expose it."
//
// WAS SEIT `cable#703` SCHON DASTAND — und was fehlte. Das Ziel-Register
// (Plattform, Ingest, Encoding, Backup), die Paritaetspruefung und der
// Transport-Rechner sind gebaut. Sie beschreiben aber alle nur das ENDE der
// Kette. `DeliveryDestination` hatte keinen einzigen Zeiger in den Plan: kein
// Geraet, kein Anschluss, kein Kabel. Das Register war damit genau das zweite
// Dokument, das der Bedarf beklagt — nur eben in unserer eigenen Anwendung.
//
// DIE NAHT IST EIN FELD. `encoderEquipmentId` zeigt auf das Geraet, das
// sendet. Alles andere ist ABGELEITET und wird nicht gespeichert: der
// Programm-Eingang des Encoders kommt aus seinen Anschluessen, die Quelle aus
// der Rueckwaertssuche im Kabelgraph (`resolveSignalSource`, ADR-001). Damit
// gibt es keine zweite Wahrheit ueber den Weg — es gibt nur den Plan.
//
// WAS HIER NICHT PASSIERT: geraten. Ein Encoder mit zwei verkabelten
// Programm-Eingaengen bekommt `feed-ambiguous` und keine Antwort. Welcher der
// beiden das Programm fuehrt, ist eine Einsatz-Entscheidung; die falsche
// Antwort waere schlimmer als keine, weil sie auf einem Blatt landet, das am
// Showtag geglaubt wird. Dieselbe Regel wie beim Router ohne gesetzten
// Kreuzpunkt.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'
import type { DeliveryDestination, DeliveryTransport } from '../types/delivery'
import { buildGraphContext, isReferencePort, resolveSignalSource } from './labelDerivation'
import type { CsvCell, CsvTable } from './csv'

export type ChainFindingKind =
  /** Das Ziel benennt kein Geraet — der Plan sagt nicht, was sendet. */
  | 'no-encoder'
  /** Das benannte Geraet steht nicht (mehr) im Plan. */
  | 'encoder-gone'
  /** Der Encoder hat an keinem Programm-Eingang ein Kabel. */
  | 'encoder-unfed'
  /** Mehrere Programm-Eingaenge sind verkabelt; welcher zaehlt, sagt der Plan nicht. */
  | 'feed-ambiguous'
  /** Backup und Primaerweg haengen am selben Geraet. */
  | 'backup-shares-encoder'

export interface ChainFinding {
  kind: ChainFindingKind
  /** Klartext-Werte zum Befund, in fester Reihenfolge (z. B. die Anschlussnamen). */
  values?: string[]
}

export interface ChainNode {
  equipmentId: string
  name: string
}

export interface DeliveryChain {
  destinationId: string
  destinationName: string
  role: 'primary' | 'backup'
  /** Bei einem Backup: der Name des Primaerwegs, sofern er existiert. */
  backupOfName?: string
  transport: DeliveryTransport
  /** Das sendende Geraet, sofern benannt UND im Plan vorhanden. */
  encoder?: ChainNode
  /** Der Programm-Eingang des Encoders — nur bei genau einem verkabelten. */
  feedPort?: { id: string; name: string }
  /** Was am anderen Ende der Rueckwaertssuche steht. `hops` = Zwischenstationen. */
  source?: ChainNode & { hops: number }
  findings: ChainFinding[]
}

type ChainInput = {
  deliveryDestinations?: DeliveryDestination[]
  equipment: EquipmentItem[]
  cables: Cable[]
}

/**
 * Die Programm-Eingaenge eines Geraets, an denen ein Kabel haengt.
 *
 * „Programm" heisst: kein Referenz-, Rueckweg- oder Steuer-Anschluss. Die
 * Abgrenzung kommt aus `labelDerivation.isReferencePort` und nicht aus einer
 * eigenen Liste — sonst zaehlte hier morgen der Intercom-Anschluss als
 * Speisung, waehrend die Label-Ableitung ihn ueberspringt.
 */
const fedProgramInputs = (
  device: EquipmentItem,
  links: Map<string, unknown>,
): EquipmentItem['inputs'] =>
  device.inputs.filter((p) => !isReferencePort(p) && links.has(p.id))

/**
 * Die Ketten aller Ausspielziele.
 *
 * Reihenfolge: wie im Register. Ein Ziel ohne Befund ist eine vollstaendige
 * Kette; ein Ziel mit Befunden traegt sie einzeln, damit die Liste nicht
 * „irgendwas stimmt nicht" sagt, sondern was.
 */
export function buildDeliveryChains(project: ChainInput): DeliveryChain[] {
  const destinations = project.deliveryDestinations ?? []
  if (destinations.length === 0) return []

  const ctx = buildGraphContext(project.equipment, project.cables)
  const byId = new Map(destinations.map((d) => [d.id, d]))

  return destinations.map((d): DeliveryChain => {
    const primary = d.backupOfId ? byId.get(d.backupOfId) : undefined
    const chain: DeliveryChain = {
      destinationId: d.id,
      destinationName: d.name,
      role: d.backupOfId ? 'backup' : 'primary',
      transport: d.transport,
      findings: [],
    }
    if (primary) chain.backupOfName = primary.name

    if (!d.encoderEquipmentId) {
      chain.findings.push({ kind: 'no-encoder' })
      return chain
    }

    const device = ctx.eqById.get(d.encoderEquipmentId)
    if (!device) {
      // Der Zeiger bleibt im Projekt stehen (siehe `normaliseDeliveryDestination`);
      // hier wird er zur Auskunft statt zum stillen Loch.
      chain.findings.push({ kind: 'encoder-gone', values: [d.encoderEquipmentId] })
      return chain
    }
    chain.encoder = { equipmentId: device.id, name: device.name }

    // Ein Backup, das am selben Blech haengt wie sein Primaerweg, ist kein
    // Ausweichweg — es ist derselbe Weg mit zwei Zielen. Genau die Schwaeche,
    // die der Bedarf zitiert: „nobody's thought about what happens when
    // something fails".
    if (primary?.encoderEquipmentId && primary.encoderEquipmentId === d.encoderEquipmentId) {
      chain.findings.push({ kind: 'backup-shares-encoder', values: [device.name] })
    }

    const fed = fedProgramInputs(device, ctx.links)
    if (fed.length === 0) {
      chain.findings.push({ kind: 'encoder-unfed', values: [device.name] })
      return chain
    }
    if (fed.length > 1) {
      chain.findings.push({
        kind: 'feed-ambiguous',
        values: fed.map((p) => p.name ?? p.id),
      })
      return chain
    }

    const port = fed[0]
    chain.feedPort = { id: port.id, name: port.name ?? port.id }
    const found = resolveSignalSource(port.id, ctx)
    if (found) {
      const src = ctx.eqById.get(found.equipmentId)
      if (src) chain.source = { equipmentId: src.id, name: src.name, hops: found.hops }
    }
    return chain
  })
}

/**
 * Der Befund in kanonischem Deutsch.
 *
 * Warum kanonisch und nicht uebersetzt: dieselbe Regel wie bei
 * `deliveryIssueText`. Dieser Text landet auf einem BLATT, und der Stand des
 * Blattes wird aus seinem Inhalt gerechnet (`documentRegistry`). Waere er
 * uebersetzt, haette dasselbe Projekt in zwei Sprachen zwei Staende — und
 * jeder Abgleich meldete das Blatt als veraltet. Auf dem BILDSCHIRM steht die
 * uebersetzte Form; die baut der Dialog.
 */
export const chainFindingText = (f: ChainFinding): string => {
  switch (f.kind) {
    case 'no-encoder':
      return 'Kein Encoder im Plan benannt'
    case 'encoder-gone':
      return 'Benanntes Gerät steht nicht mehr im Plan'
    case 'encoder-unfed':
      return `${f.values?.[0] ?? 'Der Encoder'} hat an keinem Programm-Eingang ein Kabel`
    case 'feed-ambiguous':
      return `Mehrere verkabelte Programm-Eingänge: ${(f.values ?? []).join(' / ')}`
    case 'backup-shares-encoder':
      return `Backup läuft über dasselbe Gerät wie der Primärweg (${f.values?.[0] ?? ''})`
  }
}

/**
 * Das Blatt: von der Quelle bis zur Plattform, eine Zeile je Ziel.
 *
 * Das ist das Artefakt, das der Bedarf vermisst („no artefact shows the
 * delivery path"). Es steht bewusst NEBEN dem Ablaufblatt und ersetzt es
 * nicht: dieses hier sagt, WOHER das Signal kommt, jenes, WOHIN es geht und
 * mit welchen Parametern.
 *
 * Kein Stream-Key, keine Ingest-URL — die stehen auf dem Ablaufblatt. Ein
 * Blatt ueber den Signalweg braucht kein Geheimnis.
 */
export function deliveryPathTable(project: ChainInput): CsvTable {
  const chains = buildDeliveryChains(project)
  return {
    headers: [
      'Ziel',
      'Rolle',
      'Quelle',
      'Zwischenstationen',
      'Encoder',
      'Programm-Eingang',
      'Transport',
      'Befund',
    ],
    rows: chains.map((c): CsvCell[] => [
      c.destinationName,
      c.role === 'backup' ? `Backup von ${c.backupOfName ?? '?'}` : 'Primaerweg',
      c.source?.name ?? '',
      // Leer statt 0, wenn es keine Quelle gibt: eine 0 laese sich als
      // „direkt verkabelt" lesen, und das waere eine Aussage, die niemand
      // geprueft hat.
      c.source ? String(c.source.hops) : '',
      c.encoder?.name ?? '',
      c.feedPort?.name ?? '',
      c.transport,
      c.findings.map(chainFindingText).join(' · '),
    ]),
  }
}
