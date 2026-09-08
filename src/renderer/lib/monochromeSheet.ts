/**
 * BEDARF 128 — der Ausdruck fuer den Tisch, monochrom sicher.
 *
 * ─── WAS GEMESSEN WURDE, UND WAS DIE ERSTE MESSUNG VERFEHLTE ───────────────
 *
 * Erster Griff: „es gibt keine einzige `@media print`-Regel im Renderer."
 * Stimmt und ist bedeutungslos — der Plan wird nicht ueber CSS gedruckt,
 * sondern als PDF aus einer Aufnahme des Canvas (`exportPdf.ts`). Druck-CSS
 * beruehrt ihn nicht. Wieder dieselbe Fehlerform wie bei B-44 Befund 3: eine
 * Zahl ueber die falsche Eigenschaft.
 *
 * Die richtige Frage: WAS auf dem gedruckten Blatt unterscheidet zwei Kabel,
 * und ueberlebt es Graustufen? Antwort: die Strichfarbe, und sonst nichts.
 *
 * Nachgerechnet fuer den Modus `byLayer` (relative Helligkeit nach WCAG, also
 * genau das, was ein Graustufen-Druck uebrig laesst):
 *
 *     Ebene      Grauwert (0-255)
 *     other      114
 *     power      127
 *     audio      130
 *     video      132
 *     network    161
 *     control    175
 *
 * **Audio und Video liegen 2 von 255 Grauwerten auseinander.** Vier der sechs
 * Ebenen liegen innerhalb von 18. Auf einem Schwarzweiss-Drucker ist ein
 * Videokabel dasselbe wie ein Audiokabel. In den Modi `manual` und `byLength`
 * ist es nicht besser, nur unberechenbarer: dort kommt die Farbe vom Nutzer
 * bzw. aus einer Laengenregel.
 *
 * ─── WARUM KEIN STRICHMUSTER ───────────────────────────────────────────────
 *
 * Der naheliegende zweite Kanal waere ein Strichmuster je Ebene. Er ist
 * BESETZT, und zwar zweifach: `cable.dashed` ist eine Angabe des Nutzers, und
 * der Modus `byLength` benutzt das Muster fuer seine Laengenregeln. Ein
 * Ebenen-Muster wuerde beides ueberschreiben — also eine Angabe des Nutzers
 * loeschen, um eine abgeleitete zu zeigen. Genau dagegen steht der Kommentar
 * ueber `byLayer` in `CanvasArea.tsx`: der Modus faerbt die Darstellung und
 * laesst `item.color` in Ruhe.
 *
 * ─── DER KANAL, DER FREI IST: TEXT ─────────────────────────────────────────
 *
 * Die Beschriftung liegt ohnehin an jedem Kabel. Sie ueberlebt Graustufen,
 * Fotokopie und Fax, sie braucht keine Legende, und sie kollidiert mit
 * nichts. Im monochromen Ausdruck traegt jedes Kabel deshalb seine Ebene im
 * Klartext — und alle Striche bekommen dieselbe Tinte, damit niemand aus
 * einem Grauton etwas herausliest, was nicht drinsteht.
 *
 * REIN: keine Uhr, kein Store, kein IO.
 */

import { LAYER_STYLES, styleForLayer, type StandardLayer } from './cableLayers'

/** Die eine Tinte. Kein Grauton — ein Grauton luede zum Deuten ein. */
export const MONO_TINTE = { dark: '#f1f5f9', light: '#0f172a' } as const

/**
 * Die relative Helligkeit einer Farbe nach WCAG 2.x — das, was ein
 * Graustufen-Druck uebrig laesst.
 *
 * Steht hier und nicht im Test, weil die Zahl die BEGRUENDUNG des Moduls ist:
 * wer die Ebenenfarben aendert, soll am Waechter merken, ob sie sich auf
 * Papier noch unterscheiden.
 */
export const relativeHelligkeit = (hex: string): number => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 0
  const n = Number.parseInt(m[1], 16)
  const kanal = (v: number): number => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return (
    0.2126 * kanal((n >> 16) & 255) +
    0.7152 * kanal((n >> 8) & 255) +
    0.0722 * kanal(n & 255)
  )
}

/** Derselbe Wert als Grauwert 0..255, so wie er auf dem Papier landet. */
export const grauwert = (hex: string): number =>
  Math.round(relativeHelligkeit(hex) ** (1 / 2.2) * 255)

/**
 * Der kleinste Grauwert-Abstand zwischen zwei Ebenenfarben.
 *
 * Die Kennzahl des Befundes: liegt er im niedrigen einstelligen Bereich, sind
 * zwei Ebenen auf Papier nicht mehr zu trennen.
 */
export const engsteEbenen = (): { a: StandardLayer; b: StandardLayer; abstand: number } => {
  const werte = (Object.keys(LAYER_STYLES) as StandardLayer[])
    .map((k) => ({ k, g: grauwert(LAYER_STYLES[k].color) }))
    .sort((x, y) => x.g - y.g)
  let beste = { a: werte[0].k, b: werte[1].k, abstand: Number.POSITIVE_INFINITY }
  for (let i = 0; i < werte.length - 1; i += 1) {
    const abstand = werte[i + 1].g - werte[i].g
    if (abstand < beste.abstand) beste = { a: werte[i].k, b: werte[i + 1].k, abstand }
  }
  return beste
}

/**
 * Die Beschriftung fuer den monochromen Ausdruck.
 *
 * Die Ebene wird ANGEHAENGT und ersetzt nichts: der Name, die Nummer und die
 * Laenge stehen weiter da, wo sie standen. Ein Ausdruck, der dafuer etwas
 * anderes weglaesst, tauscht ein Problem gegen ein anderes.
 */
export const monochromLabel = (label: string, layer: string | undefined): string =>
  `${label} · ${styleForLayer(layer).label}`
