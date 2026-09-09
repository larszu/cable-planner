// ───────────────────────────────────────────────────────────────────────────
// Vom Vorschlag zum Kabel — die Rückübersetzung (#666).
//
// `circuitSuggest` rechnet auf KNOTEN und KLEMMEN. Der Plan kennt GERÄTE und
// ANSCHLÜSSE. Diese Datei ist die Stelle dazwischen, und sie ist der Grund,
// warum der Rechner nichts vom Projekt weiss: `circuitFromProject` geht in die
// eine Richtung, dieses Modul in die andere, und beide teilen sich die einzige
// Zuordnung, die es gibt — `Port.circuitTerminal`.
//
// ═══════════════════════════════════════════════════════════════════════════
// EIN VORSCHLAG, DER SICH NICHT EINTRAGEN LÄSST, WIRD GESAGT UND NICHT
// WEGGELASSEN
// ═══════════════════════════════════════════════════════════════════════════
//
// Ein Wechselschalter im Plan hat nicht zwingend einen Anschluss mit
// `circuitTerminal: 2` — vielleicht hat ihn niemand angegeben. Der Rechner
// findet die Ader trotzdem, denn er rechnet auf der Bauart; eintragen lässt
// sie sich dann nicht.
//
// Solche Vorschläge stillschweigend zu verschlucken wäre die schlechteste der
// möglichen Antworten: der Nutzer sähe „keine Vorschläge" und schlösse daraus,
// dass die Verdrahtung in Ordnung ist. Sie stehen deshalb mit `hindernis` in
// der Liste — mit dem Gerät und der Klemme, die fehlt. Das ist zugleich die
// Anleitung: wer die Klemme am Anschluss einträgt, bekommt beim nächsten
// Durchlauf einen Vorschlag, den er anwenden kann.
// ───────────────────────────────────────────────────────────────────────────
import type { CablePlannerProject } from '../types/project'
import type { EquipmentItem, Port } from '../types/equipment'
import type { CableType } from '../types/cable'
import { circuitFromProject, istStromKabel, LEERE_SIM, type CircuitSim } from './circuitFromProject'
import { schaltungsVorschlaege, type Befund, type TafelZeile } from './circuitSuggest'
import { CIRCUIT_KIND_INFO } from '../types/circuit'

/** Eine Ader, die sich so in den Plan eintragen lässt. */
export interface PlanKante {
  fromEquipmentId: string
  fromPortId: string
  toEquipmentId: string
  toPortId: string
  /**
   * Der Kabeltyp — GELESEN am Anschluss, nicht ausgedacht.
   *
   * Ein Kabel braucht einen Typ, und ihn zu erfinden waere ein Namensabgleich
   * mit anderen Mitteln (ADR-002). Genommen wird deshalb der Steckertyp des
   * Anschlusses, an dem die Ader anfaengt — dieselbe Angabe, aus der der Plan
   * ueberall sonst seinen Layer ableitet. Drei Steckertypen (DIN,
   * DisplayPort, USB) sind als Kabeltyp nicht vorgesehen; dort steht
   * `Custom`, also ausdruecklich „nicht aus der Liste" statt eines
   * naheliegenden Nachbarn.
   */
  steckertyp: CableType
}

export interface PlanVorschlag {
  text: string
  wahrheitstafel: TafelZeile[]
  /** Leer, wenn `hindernis` gesetzt ist. */
  kanten: PlanKante[]
  /** Warum sich dieser Vorschlag nicht eintragen lässt. */
  hindernis?: string
}

export interface PlanErgebnis {
  befunde: Befund[]
  vorschlaege: PlanVorschlag[]
  vollstaendig: boolean
  grund?: string
  annahmen: string[]
}

/** Bauarten, deren Klemmen erst aus den Kanten entstehen. */
const KLEMMSTELLEN = new Set(['junction', 'distro'])

/** Alle Anschlüsse eines Geräts, Ein- und Ausgänge in einer Liste. */
const alleAnschluesse = (eq: EquipmentItem): Port[] => [...eq.inputs, ...eq.outputs]

/** Anschlüsse, an denen schon ein Strom-Kabel hängt. */
const belegteAnschluesse = (project: CablePlannerProject): Set<string> => {
  const s = new Set<string>()
  for (const c of project.cables) {
    if (!istStromKabel(c.layer)) continue
    s.add(c.fromPortId)
    s.add(c.toPortId)
  }
  return s
}

/**
 * Den Anschluss finden, der diese Klemme trägt.
 *
 * Bei einer Klemmstelle zählt die Klemmennummer nicht: dort geht alles nach
 * überall weiter, und die Nummer aus dem Rechner ist eine frisch vergebene.
 * Genommen wird der erste freie Anschluss. Bei jeder anderen Bauart muss die
 * Klemme ANGEGEBEN sein — sich den nächstbesten Anschluss zu greifen, wäre
 * genau die stille Umverdrahtung, gegen die `circuitTerminal` überhaupt
 * eingeführt wurde (der Befund aus B-33).
 */
const anschlussFuer = (
  eq: EquipmentItem,
  klemme: number,
  belegt: ReadonlySet<string>,
): Port | undefined => {
  const frei = alleAnschluesse(eq).filter((p) => !belegt.has(p.id))
  if (KLEMMSTELLEN.has(eq.circuitKind ?? '')) return frei[0]
  return frei.find((p) => (p.circuitTerminal ?? 0) === klemme)
}

const geraetName = (eq: EquipmentItem | undefined, id: string): string => eq?.name ?? id

/** Steckertypen, die es als Kabeltyp nicht gibt (siehe `CableType`). */
const NICHT_ALS_KABEL = new Set(['DIN', 'DisplayPort', 'USB'])

const kabeltypVon = (p: Port): CableType =>
  NICHT_ALS_KABEL.has(p.connectorType) ? 'Custom' : (p.connectorType as CableType)

/**
 * Die Vorschläge zum Stromkreis dieses Plans — schon in Geräten und
 * Anschlüssen ausgedrückt.
 *
 * Die Reihenfolge ist die von `schaltungsVorschlaege`; anwendbare und nicht
 * anwendbare stehen gemeinsam in der Liste, damit die Oberfläche beide zeigen
 * kann. Eintragen tut dieses Modul nichts — das ist ein Griff des Nutzers.
 */
export const planVorschlaege = (
  project: CablePlannerProject,
  sim: CircuitSim = LEERE_SIM,
  lampeId?: string,
): PlanErgebnis => {
  const plan = circuitFromProject(project, sim)
  const roh = schaltungsVorschlaege(plan.nodes, plan.edges, lampeId)
  const nachId = new Map(project.equipment.map((e) => [e.id, e]))
  const belegtImPlan = belegteAnschluesse(project)

  const vorschlaege: PlanVorschlag[] = roh.vorschlaege.map((v) => {
    // Innerhalb EINES Vorschlags darf kein Anschluss zweimal vergeben werden —
    // sonst traegt ein Zwei-Adern-Vorschlag beide Adern auf dieselbe Klemme.
    const belegt = new Set(belegtImPlan)
    const kanten: PlanKante[] = []
    let hindernis: string | undefined

    for (const k of v.kanten) {
      const a = nachId.get(k.fromNode)
      const b = nachId.get(k.toNode)
      if (!a || !b) {
        hindernis = `Gerät „${geraetName(a, k.fromNode)}" oder „${geraetName(b, k.toNode)}" steht nicht mehr im Plan.`
        break
      }
      const pa = anschlussFuer(a, k.fromTerminal, belegt)
      const pb = anschlussFuer(b, k.toTerminal, belegt)
      const fehlt = !pa ? { eq: a, klemme: k.fromTerminal } : !pb ? { eq: b, klemme: k.toTerminal } : undefined
      if (fehlt) {
        const bauart = fehlt.eq.circuitKind ? CIRCUIT_KIND_INFO[fehlt.eq.circuitKind].label : 'Gerät'
        hindernis =
          `${bauart} „${fehlt.eq.name}" hat keinen freien Anschluss mit Klemme ${fehlt.klemme}. ` +
          'Die Klemme steht in den Eigenschaften am Anschluss — ohne sie lässt sich die Ader nicht eintragen.'
        break
      }
      belegt.add(pa!.id)
      belegt.add(pb!.id)
      kanten.push({
        fromEquipmentId: a.id,
        fromPortId: pa!.id,
        toEquipmentId: b.id,
        toPortId: pb!.id,
        steckertyp: kabeltypVon(pa!),
      })
    }

    return {
      text: v.text,
      wahrheitstafel: v.wahrheitstafel,
      kanten: hindernis === undefined ? kanten : [],
      ...(hindernis === undefined ? {} : { hindernis }),
    }
  })

  return {
    befunde: roh.befunde,
    vorschlaege,
    vollstaendig: roh.vollstaendig,
    ...(roh.grund === undefined ? {} : { grund: roh.grund }),
    annahmen: roh.annahmen,
  }
}
