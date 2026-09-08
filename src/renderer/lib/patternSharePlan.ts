/**
 * Der Prüfbild-Plan für den Rundgang am Telefon (B-42, Inkrement 2b).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM DIE RECHNUNG HIER BLEIBT UND NICHT AUFS TELEFON WANDERT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * „Wo müsste das Bild ankommen" rechnet `lib/patternRouting.ts` mit
 * `signalChains` — derselben Traversierung, die Patchliste und
 * Mehr-Ebenen-Ansicht benutzen. Die Mobile-Seite bekommt deshalb das
 * ERGEBNIS als fertige Liste, nicht die Rohdaten plus eine zweite
 * Traversierung.
 *
 * Der Grund ist derselbe wie beim Crew-Kalender (Bedarf 39): eine zweite
 * Rechnung wäre die Defektform `zwei-rechnungen`. Sie liefe bei der ersten
 * Kreuzschiene mit ungesetztem Kreuzpunkt auseinander — und dann stünde am
 * Telefon ein Ankunftsort, den der Plan am Rechner nicht kennt. Wer davor
 * steht, sucht dann einen Fehler in der Anlage, den es nicht gibt.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WAS DIE LISTE TRÄGT — UND WAS SIE AUSDRÜCKLICH NICHT BEHAUPTET
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Sie trägt die ERWARTUNG: welcher Name auf dem Bild stehen müsste, an
 * welchem Gerät, an welchem Anschluss, über welchen Weg. Sie trägt KEINE
 * Aussage darüber, was dort wirklich steht — diese App hat keinen
 * Videoeingang, und ein Telefon, das eine Erwartung wie eine Rückmeldung
 * zeigt, ist genau die Falle aus Invariante 16. Das Feld `erwartung` heisst
 * deshalb so und nicht `bild`, und die Mobile-Ansicht beschriftet es.
 *
 * DIE OFFENEN WEGE FAHREN MIT. Ein Blatt, das nur die sauberen Wege listet,
 * schickt den Techniker an sieben Monitore und verschweigt den achten, an dem
 * es hakt — und genau dort versteht später niemand, warum kein Bild kommt.
 *
 * REIN: keine Uhr, kein Store, kein IO. Der Zeitpunkt kommt herein, weil ein
 * Dokument, das sich selbst stempelt, bei jedem Aufruf anders aussieht.
 */
import type { CablePlannerProject } from '../types/project'
import { patternRouting, type PatternStop } from './patternRouting'
import { patternDiagnose } from './patternDiagnose'

export interface PatternShareStop {
  /** Stabil über Neuladen hinweg — taugt als Key am Telefon. */
  id: string
  equipmentId: string
  equipmentName: string
  portId: string
  portName: string
  /** Der Weg dorthin als eine Zeile. */
  weg: string
  /**
   * Der Name, der auf dem Bild stehen müsste. Das ist die ERWARTUNG aus dem
   * Plan und keine Rückmeldung vom Gerät.
   */
  erwartung: string
  /** Bei einem offenen Weg: warum der Plan hier nicht weiterweiss. */
  hinweis: string
  /** Was zuletzt gemeldet wurde, in Worten. Leer heisst: noch niemand. */
  befund: string
  /** Wurde hier schon einmal hingesehen? */
  geprueft: boolean
}

export interface PatternSharePlan {
  quelleId: string
  quellName: string
  /** Wann der Plan gebaut wurde (ISO) — kommt vom Aufrufer. */
  stand: string
  /** Wo das Bild ankommen müsste. */
  ziele: PatternShareStop[]
  /** Wege, die der Plan nicht zu Ende kennt — mit ihrem Grund. */
  offen: PatternShareStop[]
}

/**
 * Die Liste für das Telefon — oder `null`, wenn keine Quelle gewählt ist.
 *
 * `null` und nicht eine leere Liste: „keine Quelle gewählt" und „nirgends
 * erwartet" sind verschiedene Aussagen, und die zweite wäre gelogen. Der
 * Server antwortet darauf mit 503 statt mit einem leeren Dokument.
 */
export const patternSharePlan = (
  project: CablePlannerProject,
  quelleId: string | null | undefined,
  stand: string,
): PatternSharePlan | null => {
  if (!quelleId) return null
  const quelle = project.equipment.find((e) => e.id === quelleId)
  if (!quelle) return null
  const routing = patternRouting(project, quelleId)
  // Die Befunde kommen aus DERSELBEN Ableitung wie am Rechner. Wer schon
  // gemeldet hat, sieht das am Telefon — sonst prüft der Zweite dieselben
  // drei Monitore noch einmal und der achte bleibt liegen.
  const befunde = new Map(patternDiagnose(project, quelleId).map((b) => [b.equipmentId, b]))

  const stop = (s: PatternStop, hinweis: string): PatternShareStop => {
    const b = befunde.get(s.equipmentId)
    return {
      id: s.id,
      equipmentId: s.equipmentId,
      equipmentName: s.equipmentName,
      portId: s.portId,
      portName: s.portName,
      weg: s.weg,
      erwartung: quelle.name,
      hinweis,
      befund: b && b.art !== 'noch-offen' ? b.text : '',
      geprueft: !!b && b.art !== 'noch-offen',
    }
  }

  return {
    quelleId,
    quellName: quelle.name,
    stand,
    ziele: routing.ziele.map((z) => stop(z, '')),
    offen: routing.offen.map((o) => stop(o, o.endNote || o.end)),
  }
}

/** Als JSON für den Mobile-Server — `null` bleibt `null`. */
export const patternSharePlanJson = (
  project: CablePlannerProject,
  quelleId: string | null | undefined,
  stand: string,
): string | null => {
  const plan = patternSharePlan(project, quelleId, stand)
  return plan ? JSON.stringify(plan) : null
}
