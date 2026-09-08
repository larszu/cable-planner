/**
 * Vom Weg zum BEFEHL — die einzige Stelle, die Anschlüsse in Protokoll-
 * Adressen übersetzt (S-2).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WAS HIER PASSIERT UND WARUM ES EINE EIGENE SCHICHT IST
 * ═══════════════════════════════════════════════════════════════════════
 *
 * `patternRouting` liefert die Kreuzpunkte eines Wegs als ANSCHLÜSSE. Das
 * ist richtig so: der Plan überlebt einen Gerätetausch, Protokollnummern
 * nicht. Gesendet werden muss aber eine Nummer, und welche das ist, weiss
 * erst das Protokoll:
 *
 *   Videohub  Die Position in der Anschlussliste IST die Nummer. Nicht aus
 *             Bequemlichkeit — das Protokoll legt es so fest („VIDEO OUTPUT
 *             ROUTING: <output> <input>", beide 0-basiert über die
 *             Anschlüsse des Geräts).
 *   ATEM      Die Position sagt gar nichts. Eingang 1 ist Quelle 1, ein
 *             Mediaplayer 3010, ein Aux-Ausgang 8001 aufwärts, und der
 *             Programm-Bus ist überhaupt keine Ausgangsnummer, sondern ein
 *             Mix-Effect. Deshalb steht die Nummer am Anschluss
 *             (`Port.control`), und fehlt sie, wird NICHT gesendet.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM EIN FEHLENDES STÜCK EIN BENANNTES HINDERNIS IST UND KEINE AUSNAHME
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Ein Gerät ohne erklärtes Protokoll, ohne Adresse, ohne IP ergibt keinen
 * Befehl. Das ist der Normalfall beim ersten Mal und kein Fehler — aber ein
 * grauer Knopf ohne Grund ist bei einem Eingriff die schlechteste Auskunft:
 * der Nutzer hält die Anlage für unerreichbar, obwohl nur eine Nummer fehlt.
 * Jedes Hindernis trägt deshalb den Satz, der sagt, was zu tun ist.
 *
 * REIN: keine Uhr, kein Store, kein IO.
 */
import type { CablePlannerProject } from '../types/project'
import type { HubSwitch } from '../types/hubSwitch'
import type { PatternStop } from './patternRouting'
import type { EquipmentItem, Port } from '../types/equipment'
import {
  ATEM_BEFEHL_LABEL,
  PROTOCOL_INFO,
  type AtemBefehl,
  type ControlAction,
} from '../types/switcherControl'
import type { HubKreuzpunkt } from './patternRouting'
import { buildCrosspointCommand, kreuzpunktKlartext } from './videohubCrosspoint'

export interface ControlHindernis {
  equipmentId: string
  equipmentName: string
  /** Der Satz, den die Oberfläche zeigt. Sagt, was zu tun ist. */
  grund: string
}

export interface ControlPlan {
  actions: ControlAction[]
  hindernisse: ControlHindernis[]
}

export const LEERER_PLAN: ControlPlan = { actions: [], hindernisse: [] }

/** Je Gerät die Kreuzpunkte, in der Reihenfolge des Wegs. */
const nachGeraet = (kreuzpunkte: readonly HubKreuzpunkt[]): Map<string, HubKreuzpunkt[]> => {
  const map = new Map<string, HubKreuzpunkt[]>()
  for (const k of kreuzpunkte) {
    const liste = map.get(k.equipmentId)
    if (liste) liste.push(k)
    else map.set(k.equipmentId, [k])
  }
  return map
}

const portIndex = (ports: readonly Port[], id: string): number => ports.findIndex((p) => p.id === id)

/**
 * Der Videohub-Befehl.
 *
 * Die Nummern sind die Positionen — das ist die Definition des Protokolls,
 * und deshalb steht hier auch keine Rückfrage nach `Port.control`. Gebaut
 * wird mit `buildCrosspointCommand`, das GENAU die genannten Ausgänge nennt
 * und keinen Default für die übrigen kennt (Invariante 17).
 */
const videohubAction = (
  device: EquipmentItem,
  punkte: readonly HubKreuzpunkt[],
): ControlAction | ControlHindernis => {
  const host = device.ipAddress?.trim() ?? ''
  if (!host) {
    return {
      equipmentId: device.id,
      equipmentName: device.name,
      grund: `Für „${device.name}" ist keine IP-Adresse hinterlegt (Eigenschaften des Geräts).`,
    }
  }
  const paare: { output: number; input: number }[] = []
  for (const k of punkte) {
    const output = portIndex(device.outputs, k.outputPortId)
    const input = portIndex(device.inputs, k.inputPortId)
    if (output < 0 || input < 0) {
      return {
        equipmentId: device.id,
        equipmentName: device.name,
        grund: `„${device.name}": der Anschluss „${output < 0 ? k.outputName : k.inputName}" gehört nicht mehr zum Gerät.`,
      }
    }
    paare.push({ output, input })
  }
  return {
    protocol: 'videohub',
    equipmentId: device.id,
    equipmentName: device.name,
    host,
    port: device.controlPort ?? PROTOCOL_INFO.videohub.defaultPort,
    art: 'text',
    vorschau: buildCrosspointCommand(paare),
    punkte: paare,
  }
}

/**
 * Der ATEM-Befehl.
 *
 * Was ein AUSGANG ist, entscheidet seine erklärte Rolle: der Programm-Bus
 * geht über den Mix-Effect, ein Aux über seine eigene Bus-Nummer. Ohne Rolle
 * und Nummer wird nicht gesendet — die Position in der Liste zu nehmen
 * ergäbe einen Befehl an den falschen Bus, und der ginge an eine laufende
 * Anlage.
 *
 * Die Vorschau nennt die AUFRUFE, nicht einen „gesendeten Text": der ATEM
 * spricht kein Text-Protokoll, und ein erfundener Textblock wäre genau die
 * Sorte Behauptung, gegen die der ganze Dialog gebaut ist.
 */
const atemAction = (
  device: EquipmentItem,
  punkte: readonly HubKreuzpunkt[],
): ControlAction | ControlHindernis => {
  const host = device.ipAddress?.trim() ?? ''
  if (!host) {
    return {
      equipmentId: device.id,
      equipmentName: device.name,
      grund: `Für „${device.name}" ist keine IP-Adresse hinterlegt (Eigenschaften des Geräts).`,
    }
  }
  const befehle: AtemBefehl[] = []
  for (const k of punkte) {
    const outPort = device.outputs.find((p) => p.id === k.outputPortId)
    const inPort = device.inputs.find((p) => p.id === k.inputPortId)
    const outCtl = outPort?.control
    const inCtl = inPort?.control
    if (!inCtl || inCtl.role !== 'input') {
      return {
        equipmentId: device.id,
        equipmentName: device.name,
        grund: `„${device.name}": dem Eingang „${k.inputName}" fehlt die Quellen-Nummer des Mischers (Anschlüsse → Steuerung).`,
      }
    }
    if (!outCtl) {
      return {
        equipmentId: device.id,
        equipmentName: device.name,
        grund: `„${device.name}": beim Ausgang „${k.outputName}" ist nicht eingetragen, ob er Programm, Vorschau oder ein Aux ist (Anschlüsse → Steuerung).`,
      }
    }
    if (outCtl.role === 'program') befehle.push({ kind: 'program', me: outCtl.address, source: inCtl.address })
    else if (outCtl.role === 'preview') befehle.push({ kind: 'preview', me: outCtl.address, source: inCtl.address })
    else if (outCtl.role === 'aux') befehle.push({ kind: 'aux', bus: outCtl.address, source: inCtl.address })
    else {
      return {
        equipmentId: device.id,
        equipmentName: device.name,
        grund: `„${device.name}": der Ausgang „${k.outputName}" ist als „${outCtl.role}" eingetragen — das kennt der ATEM nicht.`,
      }
    }
  }
  return {
    protocol: 'atem',
    equipmentId: device.id,
    equipmentName: device.name,
    host,
    art: 'aufruf',
    vorschau: befehle.map(atemBefehlText).join('\n'),
    befehle,
  }
}

/** Ein ATEM-Befehl als Zeile — der Aufruf mit seinen Argumenten. */
export const atemBefehlText = (b: AtemBefehl): string => {
  if (b.kind === 'program') return `changeProgramInput(${b.source}, ME ${b.me + 1})`
  if (b.kind === 'preview') return `changePreviewInput(${b.source}, ME ${b.me + 1})`
  if (b.kind === 'aux') return `setAuxSource(${b.source}, Aux ${b.bus + 1})`
  return `cut(ME ${b.me + 1})`
}

const istHindernis = (v: ControlAction | ControlHindernis): v is ControlHindernis =>
  Object.prototype.hasOwnProperty.call(v, 'grund')

/**
 * Aus den Kreuzpunkten eines Wegs die Befehle — einer je Gerät.
 *
 * EIN Befehl je Gerät und nicht einer je Kreuzpunkt: das Gerät setzt die
 * Anweisungen eines Befehls zusammen. Zwei Sendungen ergäben einen
 * Zwischenzustand, in dem der Weg halb geschaltet ist — bei einem Umbau
 * zwischen zwei Einspielern genau der Moment, in dem etwas Falsches im Bild
 * steht.
 */
export const controlActions = (
  project: CablePlannerProject,
  kreuzpunkte: readonly HubKreuzpunkt[],
): ControlPlan => {
  const geraete = new Map(project.equipment.map((e) => [e.id, e]))
  const actions: ControlAction[] = []
  const hindernisse: ControlHindernis[] = []
  for (const [id, punkte] of nachGeraet(kreuzpunkte)) {
    const device = geraete.get(id)
    if (!device) {
      hindernisse.push({
        equipmentId: id,
        equipmentName: punkte[0].equipmentName,
        grund: `„${punkte[0].equipmentName}" steht nicht mehr im Plan.`,
      })
      continue
    }
    const protokoll = device.controlProtocol
    if (!protokoll) {
      hindernisse.push({
        equipmentId: id,
        equipmentName: device.name,
        grund: `Für „${device.name}" ist kein Steuer-Protokoll erklärt (Eigenschaften → Steuerung). Ohne Erklärung wird nichts gesendet — welches Protokoll ein Gerät spricht, lässt sich nicht am Namen ablesen.`,
      })
      continue
    }
    const ergebnis =
      protokoll === 'videohub' ? videohubAction(device, punkte) : atemAction(device, punkte)
    if (istHindernis(ergebnis)) hindernisse.push(ergebnis)
    else actions.push(ergebnis)
  }
  return { actions, hindernisse }
}

/**
 * Je Befehl die Sätze, die ein Mensch vor dem Bestätigen liest.
 *
 * Sie nennen NAMEN und Nummern. „Ausgang 3 auf Eingang 1" kann jeder
 * bestätigen, ohne etwas zu wissen; „Ausgang 3 (Regie links) von Kamera 2
 * auf Kamera 1" ist die Frage, bei der jemandem auffällt, dass der Ausgang
 * gerade auf Sendung ist.
 */
export const actionKlartext = (
  action: ControlAction,
  punkte: readonly HubKreuzpunkt[],
): string[] => {
  const meine = punkte.filter((k) => k.equipmentId === action.equipmentId)
  if (action.protocol === 'videohub') {
    return action.punkte.map((p, i) =>
      kreuzpunktKlartext({
        output: p.output,
        outputName: meine[i]?.outputName ?? '',
        input: p.input,
        inputName: meine[i]?.inputName ?? '',
      }),
    )
  }
  return action.befehle.map((b, i) => {
    const k = meine[i]
    const ziel = k?.outputName ? `${ATEM_BEFEHL_LABEL[b.kind]} „${k.outputName}"` : ATEM_BEFEHL_LABEL[b.kind]
    const quelle = k?.inputName ? `„${k.inputName}"` : 'Quelle'
    return `${ziel} auf ${quelle} — ${atemBefehlText(b)}`
  })
}

/**
 * Darf gesendet werden?
 *
 * Am Verhalten prüfbar und deshalb hier und nicht im Dialog: ein Wächter,
 * der einen Ausdruck im Quelltext sucht, wird bei einer richtigen Umstellung
 * rot und dann geändert statt gelesen.
 */
export const sendebereit = (plan: ControlPlan, verstanden: boolean): boolean =>
  plan.actions.length > 0 && plan.hindernisse.length === 0 && verstanden


/**
 * Die Wege, auf denen es überhaupt etwas zu schalten gibt.
 *
 * Ein Weg ohne schaltendes Gerät ist fest verkabelt; ihn zum Schalten
 * anzubieten verspräche eine Wirkung, die es nicht gibt. Eine Funktion und
 * nicht zwei gleichlautende Filter im Streifen und im Dialog: liefen die
 * auseinander, gäbe es einen Knopf, hinter dem eine leere Liste steht.
 */
export const schaltbareWege = (ziele: readonly PatternStop[]): PatternStop[] =>
  ziele.filter((z) => z.kreuzpunkte.length > 0)

/**
 * Was nach einem Sendeversuch aufgezeichnet wird — ein Eintrag je Kreuzpunkt.
 *
 * ALS EIGENE FUNKTION und nicht inline im Dialog, damit die eigentliche
 * Zusicherung am VERHALTEN prüfbar ist: dass auch der GESCHEITERTE Versuch
 * einen Eintrag bekommt. Im Dialog wäre das nur über einen Quelltext-Scan zu
 * halten, und ein `if (ok)` liesse sich davor schieben, ohne dass eine
 * gescannte Zeile verschwände.
 *
 * Warum der gescheiterte Versuch zählt: der Datensatz beantwortet „wer hat
 * geschaltet?". Ein Versuch, der am Netz scheiterte, gehört zu dieser
 * Auskunft — er sagt, dass jemand die Absicht hatte und das Gerät in dem
 * Moment nicht erreichbar war. Wer nur Erfolge aufzeichnet, liest später
 * eine Anlage, an der nie jemand etwas versucht hat.
 *
 * Der Zeitpunkt kommt HEREIN. Diese Funktion nimmt keine Uhr, sonst
 * stempelte derselbe Vorgang bei jedem Aufruf anders.
 */
export const eintraegeFuerAction = (
  action: ControlAction,
  punkte: readonly HubKreuzpunkt[],
  ergebnis: { ok: boolean; message?: string },
  meta: { at: string; quelleId?: string; by?: string },
): HubSwitch[] => {
  const meine = punkte.filter((k) => k.equipmentId === action.equipmentId)
  const gemeinsam = {
    at: meta.at,
    equipmentId: action.equipmentId,
    protocol: action.protocol,
    ...(meta.quelleId ? { quelleId: meta.quelleId } : {}),
    ...(meta.by?.trim() ? { by: meta.by.trim() } : {}),
    ok: ergebnis.ok,
    ...(ergebnis.message ? { message: ergebnis.message } : {}),
  }
  if (action.protocol === 'videohub') {
    return action.punkte.map((p, i) => ({
      ...gemeinsam,
      output: p.output,
      input: p.input,
      outputName: meine[i]?.outputName ?? '',
      inputName: meine[i]?.inputName ?? '',
      befehl: `${p.output} ${p.input}`,
    }))
  }
  return action.befehle.map((b, i) => ({
    ...gemeinsam,
    // Beim ATEM ist der „Ausgang" der BUS (Mix-Effect oder Aux) und der
    // „Eingang" die Quellen-Nummer. Beide stehen hier so, wie sie gesendet
    // wurden — umgerechnet wird erst auf dem Blatt, und dort protokollgenau.
    output: b.kind === 'aux' ? b.bus : b.me,
    input: b.kind === 'cut' ? -1 : b.source,
    outputName: meine[i]?.outputName ?? '',
    inputName: meine[i]?.inputName ?? '',
    befehl: atemBefehlText(b),
  }))
}
