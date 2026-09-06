// ───────────────────────────────────────────────────────────────────────────
// Wer trägt heute welche Strecke (Bedarf 114, P3).
//
//   > Which pack, capsule, battery and frequency is on which person is
//   > tracked on a paper card or in someone's head, and has to be REDONE FOR
//   > EVERY SESSION of a run.
//
// Zwei unabhängige Werkzeuge sind 2025/26 auf denselben Gegenstand gekommen:
// `chazw661/ShowStack#68` und `#64` beschreiben einen „Mic Tracker", nach
// Sessions und Tagen geordnet, dessen Sicht je Person „the A2 card" heisst und
// Kopfbild plus Beltpack-Einstellungen trägt; SoundDocs baut denselben
// Gegenstand als „Mic Plot Designer".
//
// ─── WARUM DAS NICHT IN DEN RIG-PLAN GEHÖRT ────────────────────────────────
//
// `WirelessRigPlan` hat schon Kanäle mit Sender, Kapsel und Frequenz — und
// genau dort endet er richtigerweise: er ist der Plan der PRODUKTION. Der
// Bedarf beschreibt das, was sich je VORSTELLUNG ändert:
//
//   > The only audio artefact that recurs per performance rather than per
//   > production — the highest-frequency touchpoint in this department.
//
// Eine zweite Besetzung, ein anderer Redner, ein getauschter Pack: der
// Kanalplan bleibt, die Zuordnung nicht. Beides in ein Objekt zu legen hiesse,
// den Kanalplan bei jeder Vorstellung zu kopieren — und die Kopien laufen
// auseinander, sobald jemand am Plan etwas ändert.
//
// ─── DAS KOPFBILD: EINE REFERENZ, NICHT DAS BILD ───────────────────────────
//
// Die A2-Karte lebt vom Wiedererkennen; der Beleg nennt das Kopfbild
// ausdrücklich. Diese Anwendung speichert trotzdem NUR EINEN VERWEIS und
// niemals das Bild selbst — aus demselben Grund, aus dem Stream-Keys nicht ins
// Projektfile wandern: ein Projektfile geht per Mail an Haus, Verleih und
// Freelancer, und ein Porträt einer namentlich genannten Person ist nichts,
// was dabei unbemerkt mitfahren soll. Wo kein Verweis steht, trägt die Karte
// eine benannte Leerstelle statt eines gebrochenen Bildes.
//
// Aus demselben Grund ist `role` (die FUNKTION) getrennt vom `name`: für den
// Aushang am Case reicht oft „Pfarrer" oder „Moderation", und wer nur die
// Funktion pflegt, hat keinen Personennamen im Projekt.
// ───────────────────────────────────────────────────────────────────────────

/** Eine Person, die eine Strecke trägt. */
export interface Performer {
  id: string
  /** Klarname. Darf leer bleiben — dann trägt die Karte die Funktion. */
  name?: string
  /** Funktion/Rolle („Pfarrer", „Moderation", „Lead Vox"). */
  role?: string
  /**
   * Verweis auf ein Kopfbild (Dateipfad oder URL).
   *
   * NUR der Verweis. Das Bild wird nicht in das Projekt kopiert und nicht
   * eingebettet — siehe Kopfkommentar.
   */
  photoRef?: string
  notes?: string
}

/** Eine Vorstellung/Session eines Laufs. */
export interface MicSession {
  id: string
  /** ISO-Datum (YYYY-MM-DD). */
  date?: string
  /** „Probe", „Vorstellung 2", „Sonntag 10:00". */
  label?: string
  notes?: string
}

/**
 * Wie eine Zuordnung entstanden ist.
 *
 * `manual`   Von Hand gesetzt.
 * `carried`  Aus der vorigen Session übernommen — und BENANNT, weil eine
 *            übernommene Zuordnung eine Vermutung über heute ist. Genau das
 *            beschreibt der Beleg als heutige Arbeit („redone for every
 *            session"); sie zu übernehmen spart die Arbeit, sie stillschweigend
 *            als bestätigt auszugeben wäre eine Behauptung.
 */
export type AssignmentOrigin = 'manual' | 'carried'

export const ORIGIN_LABEL: Readonly<Record<AssignmentOrigin, string>> = {
  manual: 'von Hand',
  carried: 'aus der vorigen Session übernommen',
}

/** Wer trägt in dieser Session welche Strecke. */
export interface MicAssignment {
  sessionId: string
  performerId: string
  /** Kanal aus dem `WirelessRigPlan` — dort stehen Sender, Kapsel, Frequenz. */
  channelId: string
  /**
   * Die konkrete Lager-Einheit des Senders (`InventoryUnit.id`), falls
   * bekannt. Der Kanalplan nennt den TYP; hier steht das Stück, das heute
   * am Körper hängt.
   */
  packUnitId?: string
  /** Abweichende Kapsel/Headset für diese Session, als Klartext. */
  capsuleNote?: string
  /**
   * Wann der Akku eingelegt wurde (ISO-Zeitstempel).
   *
   * Kein „voll"-Haken: der sagt nichts über die Restlaufzeit, und ein Haken,
   * den niemand widerlegen kann, wird geglaubt. Ein Zeitpunkt lässt sich
   * gegen die Uhr halten.
   */
  batteryFittedAt?: string
  origin: AssignmentOrigin
  notes?: string
}

export interface MicPlot {
  performers: Performer[]
  sessions: MicSession[]
  assignments: MicAssignment[]
}

export const EMPTY_MIC_PLOT: MicPlot = { performers: [], sessions: [], assignments: [] }

/** Was auf der Karte steht, wo nichts gepflegt ist. */
export const NO_PERFORMER_NAME = 'ohne Namen'
export const NO_PHOTO = 'kein Bild hinterlegt'
export const NO_BATTERY_TIME = 'nicht festgehalten'
