/**
 * „Wo müsste das Prüfbild ankommen?" — die Antwort AUS DEM PLAN
 * (Eigentümer-Wunsch vom 2026-09-08).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DIE FRAGE, UND WARUM SIE AUS ZWEI HÄLFTEN BESTEHT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * „Wo kommt was an" hat zwei Antworten, und sie zu verwechseln ist der ganze
 * Fehler, um den es geht:
 *
 *   SOLL — was der Plan vorsieht. Steht immer zur Verfügung, braucht keine
 *          Anlage, keine Verbindung und keinen Strom. Das rechnet diese Datei.
 *   IST  — was ein Mensch vor dem Monitor gesehen hat. Braucht jemanden, der
 *          hinsieht. Steht hier NICHT und wird auch nicht behauptet.
 *
 * Die App hat keinen Videoeingang. Sie sieht kein Bild, sie kann keines
 * sehen, und ein „Mini-Monitor", der so tut, wäre die teuerste Sorte
 * Falschaussage — man erkennt Balken, glaubt an eine Bestätigung und hat in
 * Wahrheit den Plan zweimal gelesen. Was der Canvas zeigt, ist deshalb
 * ausdrücklich die ERWARTUNG, und sie ist als solche beschriftet
 * (Invariante 14).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM DER NAME AUF DEM BILD DIE PRÜFUNG ÜBERHAUPT ERST MÖGLICH MACHT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Zwei vertauschte Kreuzpunkte sehen mit reinen Farbbalken auf beiden Wegen
 * völlig richtig aus. Erst der Name macht daraus einen Befund: steht auf dem
 * Monitor „KAMERA 3", wo der Plan „KAMERA 1" vorsieht, ist die Vertauschung
 * gefunden. `lib/testPattern.ts` erzeugt das Bild, diese Datei sagt, wo es
 * stehen müsste.
 *
 * Gerechnet wird mit `signalChains` — DERSELBEN Traversierung, die die
 * Patchliste und die Mehr-Ebenen-Ansicht benutzen, samt ihrer Behandlung von
 * Kreuzschienen (der Weiterweg folgt dem GEPLANTEN Kreuzpunkt), Blenden und
 * Verteilern. Ein zweiter Weg durch dieselbe Kreuzschiene wäre die
 * Defektform `zwei-rechnungen`: er liefe beim nächsten Sonderfall
 * auseinander, und dann widersprächen sich zwei Ansichten desselben Plans.
 */
import type { EquipmentItem } from '../types/equipment'
import type { CablePlannerProject } from '../types/project'
import { chainOneLine, signalChains, type ChainEnd, type SignalChain } from './signalChain'

/**
 * Ein Kreuzpunkt, den DIESER Weg an einer Kreuzschiene braucht.
 *
 * Er wird nicht neu gesucht, sondern aus der bereits gelaufenen Kette
 * abgelesen: `signalChains` folgt an einer Kreuzschiene ohnehin dem
 * geplanten Kreuzpunkt, also steht das Paar (Eingang, Ausgang) schon in
 * zwei aufeinanderfolgenden Schritten. Es hier ein zweites Mal aus
 * `videohubRouting.planned` zu rechnen waere die Defektform
 * `zwei-rechnungen` — zwei Wege durch dieselbe Kreuzschiene, die beim
 * naechsten Sonderfall auseinanderlaufen.
 *
 * Die Nummern sind 0-basiert wie im Videohub-Protokoll; die Anzeige zaehlt
 * ab 1 (siehe `kreuzpunktKlartext`).
 */
export interface HubKreuzpunkt {
  equipmentId: string
  equipmentName: string
  /** Aus dem Geraetedatensatz. Leer heisst: die App weiss nicht, wohin. */
  ipAddress: string
  /**
   * Die ANSCHLUESSE, nicht ihre Nummern (S-2, 2026-09-08).
   *
   * Bis dahin standen hier zwei Indizes — die Position in der
   * Anschlussliste —, und das war eine stille Festlegung auf EIN Protokoll:
   * beim Videohub IST die Position die Protokollnummer, bei einem Mischer
   * nicht (dort liegen Aux-Ausgaenge und Mediaplayer in einem ganz anderen
   * Zahlenraum). Wer die Indizes als Adresse weiterreichte, schickte den
   * Befehl an den falschen Bus.
   *
   * Die Uebersetzung Anschluss -> Adresse passiert deshalb an genau einer
   * Stelle, und zwar dort, wo das Protokoll bekannt ist:
   * `lib/controlActions.ts`.
   */
  inputPortId: string
  inputName: string
  outputPortId: string
  outputName: string
}

/** Ein Ort, an dem ein Weg endet. */
export interface PatternStop {
  /** Stabil über Neuladen hinweg — taugt als React-Key. */
  id: string
  equipmentId: string
  equipmentName: string
  portId: string
  portName: string
  /** Der Weg dorthin als eine Zeile. */
  weg: string
  /** Wie viele Zwischenstationen. */
  ebenen: number
  end: ChainEnd
  endNote: string
  /**
   * Die Kreuzpunkte, ueber die dieser Weg laeuft — in der Reihenfolge des
   * Wegs. Leer heisst: keine Kreuzschiene dazwischen, es ist nichts zu
   * schalten. Das ist die Grundlage fuer „diesen Weg schalten" und
   * ausdruecklich der PLAN, nicht der gelesene Zustand der Anlage.
   */
  kreuzpunkte: HubKreuzpunkt[]
}

export interface PatternRouting {
  /**
   * Wo das Bild ankommen müsste — Wege, die an einem Gerät enden, das nicht
   * weiterleitet.
   */
  ziele: PatternStop[]
  /**
   * Wege, die vorher aufhören: unverkabelt, mehrdeutig, im Kreis, zu lang.
   *
   * SIE STEHEN GLEICHBERECHTIGT DANEBEN und werden nicht weggelassen. „Von
   * hier weiss der Plan nicht weiter" ist bei einer Inbetriebnahme die
   * nützlichere Auskunft als eine kurze Liste, die vollständig aussieht —
   * genau dort steht nämlich der Monitor, an dem später niemand versteht,
   * warum kein Bild kommt.
   */
  offen: PatternStop[]
}

export const LEERES_ROUTING: PatternRouting = { ziele: [], offen: [] }

/**
 * Die Kreuzpunkte einer Kette, abgelesen statt gerechnet.
 *
 * Ein Schritt, dessen `through` 'router' oder 'mixer' ist, kam an einem
 * schaltenden Geraet an;
 * der FOLGESCHRITT sagt, an welchem Ausgang es weiterging. Fehlt der
 * Folgeschritt (die Kette endete dort mangels Kabel), gibt es auch keinen
 * Kreuzpunkt zu schalten — dann steht hier nichts, statt einer geratenen
 * Zeile.
 *
 * EXPORTIERT NUR FUER DEN TEST, und das mit Absicht: die Nummern-Pruefung
 * unten (`input < 0 || output < 0`) ist ueber `patternRouting` heute nicht
 * erreichbar — `forwardFrom` findet einen Kreuzschienen-Weiterweg nur ueber
 * Anschluesse, die das Geraet auch hat, also kommen -1 dort nie an. Sie
 * bleibt trotzdem stehen, weil die Folge eines Wegfalls eine GERATENE
 * Nummer waere, die als Befehl an eine laufende Anlage ginge; und sie wird
 * direkt geprueft, weil eine Zusicherung, die kein Gegenversuch rot machen
 * kann, keine ist. Genau das hat der Gegenversuch hier gezeigt: der Test,
 * der sie zu decken schien, deckte in Wahrheit den `!weiter`-Fall.
 */
export const kreuzpunkteDerKette = (
  chain: SignalChain,
  geraete: ReadonlyMap<string, EquipmentItem>,
): HubKreuzpunkt[] => {
  const punkte: HubKreuzpunkt[] = []
  chain.steps.forEach((schritt, i) => {
    if (schritt.through !== 'router' && schritt.through !== 'mixer') return
    const weiter = chain.steps[i + 1]
    if (!weiter) return
    const hub = geraete.get(schritt.toEquipmentId)
    if (!hub) return
    const input = hub.inputs.findIndex((p) => p.id === schritt.toPortId)
    const output = hub.outputs.findIndex((p) => p.id === weiter.fromPortId)
    // Ein Anschluss, den das Geraet nicht (mehr) hat, ergibt keine Nummer.
    // Eine erfundene waere hier besonders teuer: sie ginge als Befehl raus.
    if (input < 0 || output < 0) return
    punkte.push({
      equipmentId: hub.id,
      equipmentName: hub.name,
      ipAddress: hub.ipAddress?.trim() ?? '',
      inputPortId: hub.inputs[input].id,
      inputName: schritt.toPortName,
      outputPortId: hub.outputs[output].id,
      outputName: weiter.fromPortName,
    })
  })
  return punkte
}

const stopOf = (chain: SignalChain, geraete: ReadonlyMap<string, EquipmentItem>): PatternStop => {
  const letzter = chain.steps[chain.steps.length - 1]
  return {
    id: chain.id,
    equipmentId: letzter.toEquipmentId,
    equipmentName: letzter.toEquipmentName,
    portId: letzter.toPortId,
    portName: letzter.toPortName,
    weg: chainOneLine(chain),
    ebenen: chain.levels,
    end: chain.end,
    endNote: chain.endNote,
    kreuzpunkte: kreuzpunkteDerKette(chain, geraete),
  }
}

/**
 * Alle Wege ab einer Quelle.
 *
 * `auchDirekte: true` — ein Monitor direkt am Mischer ist ein Ankunftsort wie
 * jeder andere. Die Mehr-Ebenen-Ansicht lässt direkte Verbindungen bewusst
 * weg (sie stehen in der Patchliste); für diese Frage wäre das Weglassen eine
 * Lücke genau dort, wo am wenigsten schiefgehen kann und deshalb niemand
 * nachsieht.
 */
export const patternRouting = (
  project: CablePlannerProject,
  quelleId: string | undefined,
): PatternRouting => {
  if (!quelleId) return LEERES_ROUTING
  const ketten = signalChains(project.equipment, project.cables, {
    vonEquipmentId: quelleId,
    auchDirekte: true,
  })
  const geraete = new Map(project.equipment.map((e) => [e.id, e]))
  const ziele: PatternStop[] = []
  const offen: PatternStop[] = []
  for (const kette of ketten) {
    ;(kette.end === 'ziel' ? ziele : offen).push(stopOf(kette, geraete))
  }
  return { ziele, offen }
}

/** Alle Geräte-Ids, an denen ein Weg endet — für die Anzeige am Knoten. */
export const zielGeraete = (routing: PatternRouting): Set<string> =>
  new Set(routing.ziele.map((z) => z.equipmentId))

/**
 * Die Zeilen für das Prüfblatt, das jemand mit auf den Rundgang nimmt.
 *
 * Die offenen Wege stehen MIT DRIN und mit ihrem Grund. Ein Blatt, das nur
 * die sauberen Wege listet, schickt den Techniker an sieben Monitore und
 * verschweigt den achten, an dem es hakt.
 */
export const patternPruefzeilen = (
  routing: PatternRouting,
): { geraet: string; anschluss: string; weg: string; hinweis: string }[] => [
  ...routing.ziele.map((z) => ({
    geraet: z.equipmentName,
    anschluss: z.portName,
    weg: z.weg,
    hinweis: '',
  })),
  ...routing.offen.map((o) => ({
    geraet: o.equipmentName,
    anschluss: o.portName,
    weg: o.weg,
    hinweis: o.endNote || o.end,
  })),
]
