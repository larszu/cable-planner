/**
 * Die Treiber-Schnittstelle: EIN Befehl, viele Protokolle (S-2).
 *
 * Der Renderer baut einen `ControlAction` — was geschaltet werden soll, in
 * den Nummern des jeweiligen Protokolls. Hier wird er gesprochen. Ein Treiber
 * kennt genau ein Protokoll und sonst nichts; der Rest der App kennt kein
 * Protokoll.
 *
 * WARUM DIE TRENNUNG GENAU HIER LIEGT: die Uebersetzung Anschluss -> Nummer
 * braucht den PLAN (welcher Anschluss, welche erklaerte Adresse) und gehoert
 * deshalb in den Renderer. Das SPRECHEN braucht Netz und native Bibliotheken
 * und gehoert deshalb in den Hauptprozess. Wer die Grenze anders zieht,
 * schleppt entweder den Plan in den Hauptprozess oder ein Socket in den
 * Renderer.
 *
 * WAS EIN TREIBER NIE TUT: mehr senden, als der Befehl sagt. Kein
 * Auffuellen fehlender Ausgaenge, kein „sicherheitshalber auch die Labels",
 * kein Wiederholen bei Zeitueberschreitung (Invariante 17). Ein Befehl an
 * eine laufende Anlage nennt nur, was er meint.
 */

/** Die Antwort eines Treibers. Nie eine Ausnahme — der Aufrufer zeichnet auf. */
export interface ControlResult {
  ok: boolean
  message: string
}

/** Ein einzelner ATEM-Befehl, so wie ihn die Bibliothek kennt. */
export type AtemBefehl =
  | { kind: 'program'; me: number; source: number }
  | { kind: 'preview'; me: number; source: number }
  | { kind: 'aux'; bus: number; source: number }
  | { kind: 'cut'; me: number }

/**
 * Der Befehl, wie er ueber IPC kommt.
 *
 * Struktur-gleich mit `renderer/types/switcherControl.ts` — und bewusst hier
 * noch einmal aufgeschrieben statt importiert: der Hauptprozess baut gegen
 * eine eigene tsconfig (ESM/node16) und darf nicht in den Renderer-Baum
 * hineinreichen. Die Gleichheit haelt `tests/switcherControl.test.ts` fest,
 * damit sie nicht auseinanderlaeuft.
 */
export type ControlAction =
  | {
      protocol: 'text'
      equipmentId: string
      equipmentName: string
      host: string
      port: number
      vorschau: string
      art: 'text-vorlage'
      /** Was wirklich ueber die Leitung geht — mit Steuerzeichen. */
      rohtext: string
      quittung?: string
    }
  | {
      protocol: 'videohub'
      equipmentId: string
      equipmentName: string
      host: string
      port: number
      vorschau: string
      art: 'text'
      punkte: { output: number; input: number }[]
    }
  | {
      protocol: 'atem'
      equipmentId: string
      equipmentName: string
      host: string
      vorschau: string
      art: 'aufruf'
      befehle: AtemBefehl[]
    }

export interface SwitcherDriver {
  /** Das Protokoll, das dieser Treiber spricht. */
  readonly protocol: ControlAction['protocol']
  send(action: ControlAction): Promise<ControlResult>
}
