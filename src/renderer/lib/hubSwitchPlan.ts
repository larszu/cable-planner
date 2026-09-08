/**
 * Aus den Kreuzpunkten eines Wegs die Auftraege je Kreuzschiene (B-42, Ink. 3).
 *
 * Ein Weg kann ueber mehrere Kreuzschienen laufen, und jede haengt an einer
 * eigenen Adresse. Diese Datei buendelt die Kreuzpunkte je Geraet, baut je
 * Geraet GENAU EINEN Block und den Klartext dazu — mehr passiert hier nicht:
 * sie ist rein, kennt weder IPC noch Netz und sendet nichts.
 *
 * WARUM EIN BLOCK JE GERAET UND NICHT EINER JE KREUZPUNKT: die Kreuzschiene
 * setzt die Zeilen eines Blocks zusammen. Zwei Ausgaenge in zwei Sendungen
 * ergaeben einen Zwischenzustand, in dem der Weg halb geschaltet ist — bei
 * einem Umbau zwischen zwei Einspielern genau der Moment, in dem etwas
 * Falsches im Bild steht.
 *
 * WARUM DER BLOCK MIT `buildCrosspointCommand` GEBAUT WIRD UND NICHT MIT
 * `buildVideohubRoutingCommand`: der zweite schreibt eine Zeile fuer JEDEN
 * Ausgang des Geraets und setzt alles Unerwaehnte auf Eingang 0. Fuer einen
 * vollstaendigen Export ist das richtig; hier waere es das Schwarzschalten
 * fremder, womoeglich sendender Ausgaenge. `tests/hubSwitchPlan.test.ts`
 * haelt fest, dass ein Ausgang, ueber den niemand etwas gesagt hat, im Block
 * nicht vorkommt.
 */
import type { HubKreuzpunkt, PatternStop } from './patternRouting'
import type { HubSwitch } from '../types/hubSwitch'
import { buildCrosspointCommand, kreuzpunktKlartext } from './videohubCrosspoint'

export interface HubAuftrag {
  equipmentId: string
  equipmentName: string
  /** Leer heisst: im Geraetedatensatz steht keine Adresse. */
  ipAddress: string
  /** Die Kreuzpunkte an DIESEM Geraet, in der Reihenfolge des Wegs. */
  punkte: HubKreuzpunkt[]
  /** Der Befehlsblock — genau diese Ausgaenge, kein Default fuer andere. */
  block: string
  /** Je Kreuzpunkt ein Satz, den ein Mensch vor dem Bestaetigen liest. */
  klartext: string[]
}

/**
 * Die Auftraege, in der Reihenfolge, in der der Weg die Geraete beruehrt.
 *
 * Ein Geraet kommt genau einmal vor, auch wenn der Weg zweimal durch
 * dieselbe Kreuzschiene laeuft — die Zeilen landen dann im selben Block.
 * Widerspricht sich der Weg dabei (derselbe Ausgang auf zwei Eingaenge),
 * wirft `buildCrosspointCommand`; das ist beabsichtigt, denn dann ist der
 * PLAN kaputt und nicht der Befehl, und ihn stillschweigend aufzuloesen
 * hiesse zu raten, welche Haelfte gemeint war.
 */
export const hubAuftraege = (kreuzpunkte: readonly HubKreuzpunkt[]): HubAuftrag[] => {
  const nachGeraet = new Map<string, HubKreuzpunkt[]>()
  const reihenfolge: string[] = []
  for (const k of kreuzpunkte) {
    const liste = nachGeraet.get(k.equipmentId)
    if (liste) liste.push(k)
    else {
      nachGeraet.set(k.equipmentId, [k])
      reihenfolge.push(k.equipmentId)
    }
  }
  return reihenfolge.map((id) => {
    const punkte = nachGeraet.get(id) ?? []
    const erster = punkte[0]
    return {
      equipmentId: id,
      equipmentName: erster.equipmentName,
      ipAddress: erster.ipAddress,
      punkte,
      block: buildCrosspointCommand(punkte),
      klartext: punkte.map((p) =>
        kreuzpunktKlartext({
          output: p.output,
          outputName: p.outputName,
          input: p.input,
          inputName: p.inputName,
        }),
      ),
    }
  })
}

/**
 * Warum ein Auftrag (noch) nicht gesendet werden kann — oder `null`.
 *
 * Getrennt vom Bauen, damit die Anzeige den Grund NENNEN kann, statt einen
 * Knopf grau zu lassen. Ein grauer Knopf ohne Grund ist bei einem Eingriff
 * die schlechteste Auskunft: der Nutzer haelt die Anlage fuer unerreichbar,
 * obwohl nur die Adresse fehlt.
 */
export const auftragHindernis = (auftrag: HubAuftrag): string | null => {
  if (!auftrag.ipAddress) {
    return `Für „${auftrag.equipmentName}" ist keine IP-Adresse hinterlegt (Eigenschaften des Geräts).`
  }
  if (!auftrag.block) return 'Nichts zu schalten.'
  return null
}


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
 * Auskunft — er sagt, dass jemand die Absicht hatte und die Kreuzschiene in
 * dem Moment nicht erreichbar war. Wer nur Erfolge aufzeichnet, liest später
 * eine Anlage, an der nie jemand etwas versucht hat.
 *
 * Der Zeitpunkt kommt HEREIN. Diese Funktion nimmt keine Uhr, sonst
 * stempelte derselbe Vorgang bei jedem Aufruf anders.
 */
export const eintraegeFuerAuftrag = (
  auftrag: HubAuftrag,
  ergebnis: { ok: boolean; message?: string },
  meta: { at: string; quelleId?: string; by?: string },
): HubSwitch[] =>
  auftrag.punkte.map((p) => ({
    at: meta.at,
    equipmentId: p.equipmentId,
    output: p.output,
    input: p.input,
    outputName: p.outputName,
    inputName: p.inputName,
    ...(meta.quelleId ? { quelleId: meta.quelleId } : {}),
    ...(meta.by?.trim() ? { by: meta.by.trim() } : {}),
    ok: ergebnis.ok,
    ...(ergebnis.message ? { message: ergebnis.message } : {}),
  }))

/**
 * Darf gesendet werden?
 *
 * Die Entscheidung liegt hier und nicht im Dialog, damit sie am Verhalten
 * geprüft werden kann statt an der Form eines Ausdrucks. Ein Wächter, der
 * `hindernisse.length === 0 && verstanden` im Quelltext sucht, wird bei einer
 * richtigen Umstellung rot und dann geändert statt gelesen.
 *
 * `verstanden` ist der gesetzte Haken. Er ist kein Formalismus: er ist die
 * Stelle, an der jemandem auffällt, dass „Ausgang 3" der Sendeausgang ist.
 */
export const sendebereit = (
  auftraege: readonly HubAuftrag[],
  verstanden: boolean,
): boolean =>
  auftraege.length > 0 && verstanden && auftraege.every((a) => auftragHindernis(a) === null)


/**
 * Die Wege, auf denen es überhaupt etwas zu schalten gibt.
 *
 * Ein Weg ohne Kreuzschiene ist fest verkabelt; ihn zum Schalten anzubieten
 * verspräche eine Wirkung, die es nicht gibt. Eine Funktion und nicht zwei
 * gleichlautende Filter im Streifen und im Dialog: liefen die auseinander,
 * gäbe es einen Knopf, hinter dem eine leere Liste steht.
 */
export const schaltbareWege = (ziele: readonly PatternStop[]): PatternStop[] =>
  ziele.filter((z) => z.kreuzpunkte.length > 0)
