import type { IntercomChannel, IntercomMembership } from './intercomExchange'

// ───────────────────────────────────────────────────────────────────────────
// DER INTERCOM-SLOT DES PROJEKTS (E-2, Schritt 1).
//
// ═══════════════════════════════════════════════════════════════════════════
// WAS SICH HIER UMDREHT
// ═══════════════════════════════════════════════════════════════════════════
//
// Bis hierher war `GreenGoConfig` die Wahrheit: sie stand im Projekt, und
// alles andere las aus ihr. Das ist die Konfiguration EINES Herstellers, und
// sie zur Quelle zu machen hiess, dass ein Plan für eine Riedel- oder
// Clear-Com-Anlage bei null anfängt — obwohl der fachliche Inhalt derselbe
// ist.
//
// E-2 (entschieden 2026-09-08 vom Eigentümer) dreht das um: das Projekt führt
// einen eigenen Intercom-Slot, und `GreenGoConfig` ist seine
// AUSGABE-PROJEKTION. Die Vokabel ist die herstellerneutrale aus B-8
// (`types/intercomExchange.ts`) — Kanäle, Sprechstellen, Talk/Listen getrennt.
//
// ═══════════════════════════════════════════════════════════════════════════
// WARUM DAS KEIN ZWEITER WAHRHEITSORT IST (ADR-001)
// ═══════════════════════════════════════════════════════════════════════════
//
// Ein Slot, der Gerätenamen abschreibt, wäre genau der Fehler, den ADR-001
// benennt. Deshalb trägt er NUR, was der Plan sonst nicht hergibt:
//
//   * welche Konferenzen es gibt,
//   * wer auf welcher spricht und wer nur mithört,
//   * wie eine Sprechstelle beschriftet ist,
//   * welche Konferenz auf welcher Taste liegt.
//
// Das sind Regie-Entscheidungen und keine Folgen der Verkabelung — aus einem
// Signalfluss lassen sie sich nicht ableiten, eine Ableitung müsste sie
// erfinden. Alles, was der Plan schon führt (welches Gerät, welcher Port,
// welche Rolle), steht hier als VERWEIS über `equipmentId` und nie als Kopie.
// `tests/intercomSlot.test.ts` hält das fest.
//
// ═══════════════════════════════════════════════════════════════════════════
// WARUM DAS KEINE AUSTAUSCHDATEI IST
// ═══════════════════════════════════════════════════════════════════════════
//
// Kein `format`, kein `version`, kein `exportedAt`. Ein Projekt trägt keinen
// Format-Marker über einen seiner Slots — die Version des Projekts steht am
// Projekt. `IntercomExchangeFile` daneben ist die Datei, die das Haus
// verlässt; sie hat die drei Felder, weil sie allein unterwegs ist.
//
// Und der Slot ist VERLUSTFREI, die Datei ist es erklärtermassen nicht: die
// Datei vergibt beim Zurücklesen neue Anlagen-Nummern (siehe Kopf von
// `lib/intercomExchange.ts`) und kennt in Format-Version 1 keine Tasten. Für
// den Slot wäre beides untragbar — er wird bei jedem Öffnen gelesen. Das ist
// der Grund, warum es zwei Übersetzungspaare gibt und nicht eines: sie
// beantworten verschiedene Fragen. Wer sie zusammenlegt, holt sich die
// Neuvergabe der Nummern ins Projekt.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Eine Taste auf einer Sprechstelle — Seite, Position, Konferenz.
 *
 * Neutral formuliert und nicht Green-GO-spezifisch: eine Tastenkarte mit
 * Seiten und Positionen haben Beltpacks und Panels aller Hersteller. Was
 * Green-GO-eigen ist (18 Tasten je Seite, zwei Seiten), steht nicht hier,
 * sondern im Treiber.
 *
 * Warum die Tasten NICHT aus den `memberships` folgen: eine Zugehörigkeit
 * ohne Taste ist ein realer Zustand (die Karte ist voll). Dieselbe Trennung
 * wie in `types/greengo.ts`, und aus demselben Grund.
 */
export interface IntercomKey {
  /** Seite der Tastenkarte, 1-basiert. */
  page: number
  /** Tastenposition auf dieser Seite, 1-basiert. */
  button: number
  /** Die Konferenz, die auf dieser Taste liegt. */
  channelId: string
}

/** Eine Sprechstelle im Plan. */
export interface IntercomPlanStation {
  /** Stabil über die Lebenszeit des Projekts. Keine Anlagen-Nummer. */
  id: string
  /** Rollenname, wie er in der Regie gesagt wird. */
  name: string
  /** Kurzform für das Display, wenn eine gepflegt ist. */
  shortName?: string
  memberships: IntercomMembership[]
  /**
   * Die Tastenbelegung. Fehlt sie, weiss der Plan über die Positionen nichts;
   * eine LEERE Liste heisst „die Karte ist gelesen und leer". Der Unterschied
   * entscheidet, ob der Export schreiben darf — siehe `types/greengo.ts`.
   */
  keys?: IntercomKey[]
  /**
   * Das Gerät im Plan, an dem die Stelle hängt — der VERWEIS zurück in die
   * Verkabelung, und die einzige Verbindung dorthin. Name, Ort und Ports des
   * Geräts stehen im Plan und werden hier nicht wiederholt.
   */
  equipmentId?: string
}

/**
 * Herstellerspezifisches, nach Hersteller getrennt.
 *
 * DIE ANLAGEN-NUMMERN STEHEN HIER, WEIL SIE DEKLARIERT SEIN MÜSSEN (ADR-002).
 * Green-GO adressiert Sprechstellen und Konferenzen über Zahlen; der Slot über
 * Zeichenketten. Diese Zuordnung beim Export neu zu vergeben — was die
 * Austauschdatei tut und dort auch sagt — hiesse, dass eine Anlage nach dem
 * Öffnen des Projekts andere Nummern trägt als vorher. Auf einer bespielten
 * Anlage ist das kein Detail.
 */
export interface GreenGoVendorBlock {
  multicastAddress: string
  sampleRate: 32000 | 48000
  /** Sprechstellen-Id → Green-GO-Slot-Nummer. */
  stationNumbers: Record<string, number>
  /** Kanal-Id → Green-GO-Gruppen-Nummer. */
  channelNumbers: Record<string, number>
  /** Farbindizes der Anlage, wenn welche gepflegt sind. */
  stationColors?: Record<string, number>
  channelColors?: Record<string, number>
  /**
   * Das importierte Roh-Dokument der Anlage. Es reist im Projektfile mit,
   * damit der Export hineinschreiben kann statt neu zu bauen — siehe
   * `types/greengo.ts`, `basePreset`.
   */
  basePreset?: Record<string, unknown>
}

/** Der Intercom-Slot eines Projekts. */
export interface IntercomPlan {
  /** Name der Anlage/Produktion. */
  systemName: string
  description?: string
  channels: IntercomChannel[]
  stations: IntercomPlanStation[]
  vendor?: { greengo?: GreenGoVendorBlock }
}

export const defaultIntercomPlan = (): IntercomPlan => ({
  systemName: 'Produktion',
  description: '',
  channels: [],
  stations: [],
})
