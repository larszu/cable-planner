/**
 * Einzelne Kreuzpunkte an eine Kreuzschiene schicken — und NUR diese.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM DIESE DATEI NEBEN `buildVideohubRoutingCommand` STEHT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * `exportVideohub.ts` hat schon einen Bauer für den Routing-Block:
 *
 *     buildVideohubRoutingCommand(routing, totalOutputs)
 *
 * Der schreibt eine Zeile für JEDEN Ausgang von 0 bis `totalOutputs - 1` und
 * setzt fehlende Einträge auf Eingang 0. Für den Export-Dialog ist das
 * richtig: dort ist `routing` immer dicht (jeder Wechsel des Modells und
 * jede Änderung der Custom-Grösse baut die Tabelle über alle Ausgänge neu),
 * und ein vollständiger Dump SOLL vollständig sein.
 *
 * Für das gezielte Schalten aus dem Plan wäre derselbe Bauer eine Falle mit
 * Ansage. „Schalte Ausgang 7 auf Eingang 3" hiesse dann: sende 40 Zeilen, von
 * denen 39 nicht gemeint sind, und lege dabei jeden Ausgang, für den gerade
 * kein Eintrag in der Tabelle steht, auf Eingang 0. In einer laufenden Anlage
 * ist das keine Nebenwirkung, sondern das Schwarzschalten fremder Ausgänge —
 * darunter der, auf dem gerade gesendet wird.
 *
 * Deshalb baut diese Datei den Block aus GENAU DEN Zeilen, die der Aufrufer
 * benannt hat. Es gibt hier kein `totalOutputs`, weil es keinen Default
 * geben darf: ein Ausgang, über den niemand etwas gesagt hat, kommt im Block
 * nicht vor, und die Kreuzschiene lässt ihn dann unangetastet. Das ist die
 * Zusicherung, die `tests/videohubCrosspoint.test.ts` festhält, und sie ist
 * der einzige Grund, warum diese Datei existiert.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WAS HIER NICHT PASSIERT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Nichts wird gesendet. Diese Datei ist rein und kennt weder IPC noch Netz;
 * sie formt Text. Wer sendet, entscheidet der Aufrufer — und der muss vorher
 * fragen (siehe `HubSwitchDialog`), weil ein Kreuzpunkt in einer laufenden
 * Anlage kein Anzeigen ist, sondern ein Eingriff.
 */

/** Ein Kreuzpunkt, 0-basiert wie im Videohub-Protokoll. */
export interface Kreuzpunkt {
  output: number
  input: number
}

export class KreuzpunktFehler extends Error {}

/**
 * Prüft die Liste und wirft, statt etwas Halbes zu senden.
 *
 * Warum werfen und nicht stillschweigend säubern: jede Bereinigung, die hier
 * greifen würde, wäre eine Vermutung darüber, was gemeint war — bei einem
 * Befehl an eine laufende Anlage die falsche Antwort. Zwei Zeilen für
 * denselben Ausgang sind ein Widerspruch und keine Reihenfolge-Frage; welche
 * gewinnt, darf nicht davon abhängen, wie der Bauer sortiert.
 */
export const pruefeKreuzpunkte = (punkte: readonly Kreuzpunkt[]): void => {
  const gesehen = new Map<number, number>()
  for (const p of punkte) {
    if (!Number.isInteger(p.output) || p.output < 0) {
      throw new KreuzpunktFehler(`Ausgangsnummer ist keine Zahl ab 0: ${String(p.output)}`)
    }
    if (!Number.isInteger(p.input) || p.input < 0) {
      throw new KreuzpunktFehler(`Eingangsnummer ist keine Zahl ab 0: ${String(p.input)}`)
    }
    const vorher = gesehen.get(p.output)
    if (vorher !== undefined && vorher !== p.input) {
      throw new KreuzpunktFehler(
        `Ausgang ${p.output} soll gleichzeitig auf Eingang ${vorher} und ${p.input}`,
      )
    }
    gesehen.set(p.output, p.input)
  }
}

/**
 * Der VIDEO-OUTPUT-ROUTING-Block für genau diese Kreuzpunkte.
 *
 * Leere Liste ergibt eine leere Zeichenkette — nicht einen Block ohne
 * Zeilen. „Nichts zu schalten" heisst nichts senden; ein leerer Block wäre
 * ein Befehl, der wie einer aussieht und keiner ist.
 *
 * Doppelte Zeilen für denselben Ausgang mit demselben Eingang werden zu
 * einer zusammengefasst (derselbe Weg kann zweimal durch dieselbe
 * Kreuzschiene führen); widersprüchliche wirft `pruefeKreuzpunkte`.
 */
export const buildCrosspointCommand = (punkte: readonly Kreuzpunkt[]): string => {
  pruefeKreuzpunkte(punkte)
  if (punkte.length === 0) return ''
  const einmalig = new Map<number, number>()
  for (const p of punkte) einmalig.set(p.output, p.input)
  const zeilen = ['VIDEO OUTPUT ROUTING:']
  for (const [output, input] of [...einmalig].sort((a, b) => a[0] - b[0])) {
    zeilen.push(`${output} ${input}`)
  }
  zeilen.push('')
  return zeilen.join('\n') + '\n'
}

/**
 * Der Satz, den der Mensch vor dem Bestätigen liest.
 *
 * Er nennt die NAMEN und die Nummern, nicht nur die Nummern. „Ausgang 3 auf
 * Eingang 1" kann jeder bestätigen, ohne etwas zu wissen; „Ausgang 3 (Regie
 * links) von Kamera 2 auf Kamera 1" ist die Frage, bei der jemandem auffällt,
 * dass der Ausgang gerade auf Sendung ist.
 *
 * `vonName` fehlt, wenn der Ist-Zustand nicht gelesen wurde. Dann steht dort
 * KEIN erfundener Ausgangswert, sondern der Hinweis, dass die App es nicht
 * weiss — die App liest den Hub nicht automatisch, und ein „von Eingang 0"
 * aus dem Plan wäre eine Behauptung über die Anlage.
 */
export const kreuzpunktKlartext = (zeile: {
  output: number
  outputName: string
  input: number
  inputName: string
  vonName?: string
}): string => {
  const ausgang = zeile.outputName.trim()
    ? `Ausgang ${zeile.output + 1} (${zeile.outputName.trim()})`
    : `Ausgang ${zeile.output + 1}`
  const eingang = zeile.inputName.trim()
    ? `Eingang ${zeile.input + 1} (${zeile.inputName.trim()})`
    : `Eingang ${zeile.input + 1}`
  const von = zeile.vonName?.trim()
    ? `von ${zeile.vonName.trim()}`
    : 'vom aktuellen Stand (ungelesen)'
  return `${ausgang} ${von} auf ${eingang}`
}
