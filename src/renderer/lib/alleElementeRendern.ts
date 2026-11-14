import { create } from 'zustand'
import { clearCanvasSelection } from './canvasViewport'

// Bei grossen Plaenen zeichnet ReactFlow nur, was im Ausschnitt liegt
// (`onlyRenderVisibleElements`). Die Ausgaben (Bild, PDF, Vektor-PDF) lesen
// den Plan aber aus dem DOM — ohne diesen Schalter fehlten ihnen alle Geraete
// und Kabel ausserhalb des Bildschirms, und die Datei saehe aus wie der Plan.
// Ein Zaehler statt eines Booleans, damit zwei gleichzeitige Ausgaben sich
// nicht gegenseitig den Schalter wegnehmen.
//
// #1205: Der Grundwert ist 1, die Sichtbarkeitsrechnung ist also dauerhaft aus.
// ReactFlow 11 prueft eine Kante nur gegen das Rechteck ihrer beiden
// Endgeraete. Kabel mit Wegpunkten oder orthogonalem Umweg verlaufen
// ausserhalb davon und verschwanden, sobald man auf diesen Abschnitt zoomte
// und beide Enden aus dem Bild fielen. Die Leerlauf-Last aus #1144 bleibt durch
// Fluss-Pause, memo und Takt gesenkt.
export const useAlleElementeRendern = create<{ aktiv: number }>(() => ({ aktiv: 1 }))

const zweiBilder = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame !== 'function') return resolve()
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

/**
 * Vor jeder Ausgabe, die den Plan aus dem DOM liest: alles zeichnen lassen
 * und die Auswahl aufheben.
 *
 * #1210 — die Auswahl gehoert zur Bedienung, nicht zum Plan. Wer einen Raum
 * markiert und seine Dokumentation als PDF zog, bekam die Markierung mit:
 * ReactFlow hebt einen markierten Rahmen in der Ebene ueber seine Geraete,
 * und seine Flaeche lag farbig auf ihnen. Gezeichnet wird, was im DOM steht —
 * also wird die Auswahl vorher aufgehoben, nicht im Bild nachgebessert. Die
 * zwei Bilder danach warten den neuen Stand ab.
 */
export const mitAllenElementen = async <T>(arbeit: () => Promise<T>): Promise<T> => {
  clearCanvasSelection()
  useAlleElementeRendern.setState((s) => ({ aktiv: s.aktiv + 1 }))
  try {
    await zweiBilder()
    return await arbeit()
  } finally {
    useAlleElementeRendern.setState((s) => ({ aktiv: s.aktiv - 1 }))
  }
}
