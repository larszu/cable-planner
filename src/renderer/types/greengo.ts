/**
 * GreenGo intercom system planning data stored inside the cable-planner project.
 *
 * This mirrors the logical structure of a .gg5 configuration file:
 *  - Users  → stations / roles (Regie, Kamera 1, …)
 *  - Groups → communication channels / talk groups (CAM, PGM, …)
 */

/**
 * Eine Taste auf der Sprechstelle — Seite, Position, Gruppe (E-2, Schritt 2).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WARUM DAS EIN EIGENES FELD IST UND NICHT AUS `groupIds` FOLGT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Bis hierher kannte der Plan die Tastenpositionen nicht. `groupIds` ist eine
 * MENGE von Gruppen; der Importeur las `ButtonFunctions` nur als Rückfallweg,
 * um diese Menge zu füllen, und warf die Positionen dabei weg. Der Generator
 * erfand sie beim Export neu — positionsweise aus der Array-Reihenfolge.
 *
 * Auf einem Beltpack ist das die Tastenbelegung. Der Verlust fällt nicht am
 * Bildschirm auf, sondern in der Probe: PGM lag auf Taste 5, und nach dem
 * ersten Speichern liegt es auf Taste 1.
 *
 * `mergeButtonFunctions` hat das bisher aufgefangen, indem es die Positionen
 * aus dem Roh-Preset nie anfasste — richtig, solange der Plan sie nicht kennt.
 * Jetzt kennt er sie, und der Schutz wandert vom Roh-Dokument ins Modell.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ZWEI TATSACHEN, NICHT EINE — DESHALB BLEIBT `groupIds` STEHEN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * „Diese Station gehört zu Gruppe 3" und „Gruppe 3 liegt auf Taste 5" sind
 * verschiedene Angaben, und die zweite folgt nicht aus der ersten. Eine
 * Zugehörigkeit ohne Taste ist ein realer Zustand: `mergeButtonFunctions`
 * kennt ihn seit jeher („Karte voll — lieber nichts verdrängen"). `groupIds`
 * aus `keys` zu berechnen wäre deshalb keine Vereinfachung, sondern der
 * Verlust genau dieses Falls.
 *
 * Was gilt: jede Gruppe auf einer Taste MUSS in `groupIds` stehen. Umgekehrt
 * nicht. `tests/greengoTasten.test.ts` hält beide Richtungen fest.
 */
export interface GreenGoKey {
  /**
   * Seite der Tastenkarte, 1-basiert. Green-GO schreibt zwei; weitere
   * Seiten wurden gesehen und werden unverändert mitgeführt, statt sie auf
   * zwei zu beschneiden — was der Plan nicht versteht, verändert er nicht.
   */
  page: number
  /** Tastenposition auf dieser Seite, 1-basiert (Green-GO: 1–18). */
  button: number
  /** Die Gruppe, die auf dieser Taste liegt. */
  groupId: number
}

export interface GreenGoUser {
  /** 1-based user slot number (1–12 for standard 12-user systems). */
  id: number
  name: string
  displayName?: string
  /** GreenGo color index (0 = default white). */
  color?: number
  /** IDs of groups this user can talk/listen to. */
  groupIds: number[]
  /**
   * Die Tastenbelegung dieser Sprechstelle (E-2, Schritt 2). Siehe
   * `GreenGoKey` — sie ist eine eigene Tatsache und keine Ableitung aus
   * `groupIds`.
   *
   * Fehlt sie, weiss der Plan über die Positionen nichts: ein Projekt aus der
   * Zeit davor, oder eine Konfiguration, die nie aus einem Preset kam. Dann
   * gilt weiter, was vorher immer galt — die Positionen kommen aus dem
   * Roh-Preset und werden nicht angefasst.
   *
   * EINE LEERE LISTE IST ETWAS ANDERES ALS KEINE. `[]` heisst: der Plan kennt
   * die Karte, und sie ist leer — der Export räumt sie dann auch auf der
   * Anlage. `undefined` heisst: er hat nie eine gesehen. Die beiden zu
   * verwechseln (etwa mit `keys?.length`) lässt die Belegung, die der Nutzer
   * gerade entfernt hat, im Preset stehen.
   */
  keys?: GreenGoKey[]
  /** Cable-planner equipment ID of the assigned physical device (optional). */
  equipmentId?: string
}

export interface GreenGoGroup {
  /** 1-based group number (up to 9 in standard systems). */
  id: number
  name: string
  /** GreenGo color index (0 = default). */
  color?: number
}

export interface GreenGoConfig {
  systemName: string
  description?: string
  /** IP multicast address the system uses. Default: "239.1.160.1" */
  multicastAddress: string
  /** Audio sample rate in Hz. */
  sampleRate: 32000 | 48000
  users: GreenGoUser[]
  groups: GreenGoGroup[]
  /**
   * Das importierte Roh-Dokument, falls der Nutzer eine echte
   * Anlagen-Konfiguration geladen hat.
   *
   * ENTSCHEIDUNG „Editor UND Generator": liegt hier eins, schreibt der Export
   * hinein statt neu zu bauen — Raeume, Templates, Geraete, Netz-Einstellungen
   * und vor allem die PASSWOERTER der Anlage bleiben, wie sie waren. Liegt
   * keins, wird wie bisher aus dem Plan erzeugt.
   *
   * Der Kommentar in `importGreengo.Gg5ImportResult.unreadSections` hat genau
   * darauf gewartet: „Bis der Round-Trip sie bewahrt, muss er wenigstens
   * sagen, was er nicht gelesen hat." Jetzt bewahrt er sie.
   *
   * Der Preis: das Roh-Dokument reist im Projektfile mit. Das ist gewollt —
   * sonst waere es beim naechsten Oeffnen weg, und der Export fiele
   * unbemerkt auf „neu erzeugen" zurueck.
   */
  basePreset?: Record<string, unknown>
}

export const defaultGreenGoConfig = (): GreenGoConfig => ({
  systemName: 'Produktion',
  description: '',
  multicastAddress: '239.1.160.1',
  sampleRate: 32000,
  users: [],
  groups: [],
})
