/**
 * Was der Desktop von einem Handy NICHT übernommen hat.
 *
 * ADR-005, Regel 3: „Wer nicht bewahren kann, sagt es an der Stelle, an der es
 * passiert." Auf dem Mobile-Pfad war das bisher strukturell unmöglich, und
 * zwar in beide Richtungen:
 *
 * Der Server antwortet auf `POST /cables` mit `200 {"ok":true}`, **bevor** der
 * Renderer entschieden hat — `onCableAdded` ist ein Fire-and-forget-Aufruf ins
 * Fenster. Die 200 heisst also „dein JSON ist angekommen", nicht „das Kabel
 * steht im Plan". Der Renderer lehnt danach in vier Fällen ab und schrieb es
 * bis v8.3.x mit einem nackten `return {}` nirgendwohin; der Code nannte das
 * selbst „silently skip".
 *
 * Für den Menschen auf der Leiter sah das aus wie Erfolg: das Handy meldete
 * „✓ Kabel gesendet — wird am Desktop mit 📱-Marker eingefügt". Ein Versprechen
 * im Futur, abgegeben von der Seite, die es nicht einlösen kann. Er hakt ab
 * und geht weiter, das Kabel fehlt im Plan.
 *
 * Der Rückweg zum Handy bliebe eine Änderung des Draht-Formats (die 200 müsste
 * auf die Entscheidung des Renderers warten) — das ist eine offene
 * Design-Frage. Was ohne Formatänderung geht und Regel 3 verlangt: die
 * Ablehnung wenigstens dort zeigen, wo sie stattfindet, nämlich am Desktop.
 * Wer den Plan besitzt, kann handeln; das Handy kann es ohnehin nicht.
 *
 * Der Grund ist als **Code** hinterlegt, nicht als Satz: der Store soll keine
 * Sprache kennen, die Oberfläche übersetzt ihn.
 */

/** Warum ein vom Handy gesendetes Kabel nicht übernommen wurde. */
export type MobileDropReason =
  /** Plan ist finalisiert oder im Viewer-Modus — es darf nichts mehr rein. */
  | 'plan-locked'
  /** Ein Endpunkt-Gerät gibt es im Projekt nicht (mehr). */
  | 'equipment-gone'
  /** Der benannte Port existiert an diesem Gerät nicht (mehr). */
  | 'port-gone'
  /** Dieselbe Verbindung steht schon im Plan. */
  | 'duplicate'

export interface MobileDrop {
  reason: MobileDropReason
  /**
   * Bester menschenlesbarer Griff auf das verworfene Kabel, damit jemand
   * nachvollziehen kann, worum es ging. Leer, wenn die Meldung keinen hergab —
   * dann sagt der Bericht wenigstens, dass es sie gab.
   */
  label: string
}

export interface MobileDropReport {
  drops: MobileDrop[]
}

/** Ein Bericht ohne Inhalt ist kein Bericht — dann gibt es nichts zu melden. */
export const hasMobileDrops = (report: MobileDropReport | null | undefined): boolean =>
  !!report && report.drops.length > 0

/**
 * Neue Ablehnung anhängen. Der Bericht sammelt, weil ein Handy mehrere Kabel
 * hintereinander schicken kann und der Desktop-Nutzer sonst nur die letzte
 * Ablehnung saehe — die vorigen waeren wieder still verschwunden.
 */
export const addMobileDrop = (
  report: MobileDropReport | null | undefined,
  drop: MobileDrop,
): MobileDropReport => ({ drops: [...(report?.drops ?? []), drop] })
