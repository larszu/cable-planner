// ───────────────────────────────────────────────────────────────────────────
// Was zwischen zwei Anschlüsse gehört, die nicht zusammenpassen (#876).
//
// ─── ADAPTER, KONVERTER, GESCHLECHTSWANDLER — DREI DINGE ───────────────────
//
// Sie werden im Alltag in einen Topf geworfen und sind es nicht:
//
//   Adapter             ändert die BAUFORM. BNC auf Cinch. Das Signal bleibt,
//                       was es war; ein Stück Metall genügt.
//   Geschlechtswandler  ändert nur, ob Stift oder Buchse. Zwei XLR-Stecker
//                       passen nicht ineinander, obwohl beides XLR ist.
//   Konverter           ändert das SIGNAL. SDI auf HDMI. Das ist ein Gerät
//                       mit Strom, mit Laufzeit und mit einer Grenze, was es
//                       durchlässt — und es ist eine Entscheidung, keine
//                       Ableitung.
//
// Diese Datei schlägt die ersten beiden VOR und den dritten nur an. Warum:
// ein Konverter hat einen Hersteller, eine Bandbreite und einen Preis, und
// keine dieser Angaben steht im Plan. Ein automatisch eingesetzter Konverter
// wäre eine Behauptung über ein Gerät, das niemand gewählt hat.
//
// ─── UND WAS DER VORSCHLAG NICHT BEHAUPTET ─────────────────────────────────
//
// Richtung und Speisung des vorgeschlagenen Adapters sind `'unbekannt'` —
// nicht „passiv, beidseitig". Ein aus zwei Steckertypen abgeleiteter Adapter
// ist ein PLATZHALTER für ein Teil, das jemand aus der Kiste nimmt; welche
// Richtung es kann, weiss erst, wer es in der Hand hält. Die Plan-Prüfung
// meldet ihn deshalb als „nicht erklärt" (`beurteileAdapter` → `offen`) und
// nicht als grünen Haken. Das ist Absicht: ein grüner Haken für ein Teil,
// das niemand geprüft hat, ist teurer als ein offener Punkt.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { AdapterSpec } from '../types/adapter'
import type { ConnectorType, Port } from '../types/equipment'
import {
  checkGenderMismatch,
  connectorsAreDirectlyMating,
  connectorsShareFamily,
} from '../types/cableSpec'

/** Was zwischen die beiden Anschlüsse gehört. */
export type VorschlagArt = 'keiner' | 'geschlechtswandler' | 'adapter' | 'konverter'

export interface AdapterVorschlag {
  art: VorschlagArt
  /**
   * Der Adapter, der eingesetzt würde. Fehlt bei `keiner` und bei
   * `konverter`: einen Konverter wählt ein Mensch aus.
   */
  spec?: AdapterSpec
  /** i18n-Schlüssel des Grundes. */
  schluessel: string
}

/**
 * Was zwischen diese beiden Anschlüsse gehört.
 *
 * Die Reihenfolge der Fälle ist die Entscheidung:
 *
 *   1. Gleiche Bauform, gleiches Geschlecht → Geschlechtswandler. Das ist
 *      der Fall, den sonst niemand sieht: „XLR auf XLR" ist für jede
 *      Typprüfung in Ordnung, und am Aufbau stehen zwei Stifte voreinander.
 *   2. Verschiedene Bauform, gleiche Familie → Adapter. Ein Stück Metall.
 *   3. Verschiedene Familie → Konverter. Nur angezeigt, nie gesetzt.
 *   4. Sonst: keiner.
 */
export function adapterVorschlag(
  from: Pick<Port, 'connectorType' | 'gender'> | undefined,
  to: Pick<Port, 'connectorType' | 'gender'> | undefined,
): AdapterVorschlag {
  const a = from?.connectorType
  const b = to?.connectorType
  if (!a || !b) return { art: 'keiner', schluessel: 'adapter.suggest.none' }

  if (a === b) {
    // Dieselbe Bauform: dann entscheidet nur das Geschlecht.
    return checkGenderMismatch(from?.gender, to?.gender)
      ? {
          art: 'geschlechtswandler',
          spec: { von: a, nach: b, richtung: 'beidseitig', speisung: 'passiv' },
          schluessel: 'adapter.suggest.gender',
        }
      : { art: 'keiner', schluessel: 'adapter.suggest.none' }
  }

  if (connectorsAreDirectlyMating(a, b)) {
    return { art: 'keiner', schluessel: 'adapter.suggest.none' }
  }

  if (connectorsShareFamily(a, b)) {
    return { art: 'adapter', spec: platzhalter(a, b), schluessel: 'adapter.suggest.adapter' }
  }

  return { art: 'konverter', schluessel: 'adapter.suggest.converter' }
}

/**
 * Der Platzhalter-Adapter aus zwei Steckertypen.
 *
 * `richtung` und `speisung` bleiben `'unbekannt'` — siehe Kopf dieser Datei.
 * Ein Geschlechtswandler darf dagegen `beidseitig`/`passiv` heissen: dass ein
 * Stück Metall ohne Strom in beide Richtungen dasselbe tut, ist keine
 * Annahme über ein Teil, sondern seine Bauart.
 */
const platzhalter = (von: ConnectorType, nach: ConnectorType): AdapterSpec => ({
  von,
  nach,
  richtung: 'unbekannt',
  speisung: 'unbekannt',
})
