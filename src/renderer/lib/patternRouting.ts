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
import type { CablePlannerProject } from '../types/project'
import { chainOneLine, signalChains, type ChainEnd, type SignalChain } from './signalChain'

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

const stopOf = (chain: SignalChain): PatternStop => {
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
  const ziele: PatternStop[] = []
  const offen: PatternStop[] = []
  for (const kette of ketten) {
    ;(kette.end === 'ziel' ? ziele : offen).push(stopOf(kette))
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
