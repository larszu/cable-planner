// ───────────────────────────────────────────────────────────────────────────
// Druckblatt — die gemeinsame Hülle der HTML-Blätter für die Übergabe.
//
// Abnahmeprotokoll, Geräte-Steckbrief und Bedien-Kurzübersicht sind Blätter,
// die jemand ausdruckt, unterschreibt oder an die Wand hängt. Sie teilen
// dieselbe Seite (A4, schwarz auf weiss, keine Rundungen), dieselbe
// Maskierung und denselben Fuss mit dem Stempel. Einmal hier, damit ein
// viertes Blatt nicht die dritte Fassung von `esc` mitbringt.
//
// Kein Import von `lib/i18n`: der Übersetzer kommt als Parameter herein. Die
// Vorgabe `quelle` liefert die englische Quelle — ein Test ohne Wörterbuch
// misst damit genau die Rückfallebene, die im Betrieb erscheint.
// ───────────────────────────────────────────────────────────────────────────

import { einsetzen } from './platzhalter'

export type Uebersetzen = (key: string, fallback: string) => string

export const quelle: Uebersetzen = (_key, fallback) => fallback

export const fmt = einsetzen

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Vergleich ohne `localeCompare`: dieselbe Reihenfolge auf jedem Rechner. */
export const vergleich = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

export interface DruckblattOptionen {
  titel: string
  /** Stempelzeile (`stampLine`) für den Fuss — optional. */
  stempel?: string
  quer?: boolean
  /** Keine Titelzeile oben: der Inhalt bringt je Seite seine eigene mit
   *  (mehrere Datenblaetter in einem Druckauftrag). */
  ohneKopf?: boolean
  /** Zusätzliche Regeln für dieses eine Blatt. */
  css?: string
}

/** Eine Tabelle mit maskierten Zellen. `leer` steht da, wenn es keine Zeile gibt. */
export const tabelle = (kopf: string[], zeilen: string[][], leer: string, klasse = ''): string =>
  `<table${klasse ? ` class="${klasse}"` : ''}><thead><tr>${kopf.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
${
  zeilen.length
    ? zeilen.map((r) => `<tr>${r.map((z) => `<td>${esc(z)}</td>`).join('')}</tr>`).join('\n')
    : `<tr><td colspan="${kopf.length}">${esc(leer)}</td></tr>`
}
</tbody></table>`

export const druckblatt = (o: DruckblattOptionen, inhalt: string): string => `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(o.titel)}</title>
<style>
  @page { size: A4${o.quer ? ' landscape' : ''}; margin: 12mm; }
  body { font-family: Inter, Arial, sans-serif; color: #000; background: #fff; margin: 0; font-size: 9pt; }
  h1 { font-size: 14pt; margin: 0 0 3mm; }
  h2 { font-size: 11pt; margin: 6mm 0 2mm; border-bottom: 0.3mm solid #000; padding-bottom: 1mm; }
  h3 { font-size: 10pt; margin: 3mm 0 1.5mm; }
  table { border-collapse: collapse; width: 100%; margin-top: 2mm; }
  th, td { border: 0.2mm solid #999; padding: 1mm 1.5mm; text-align: left; vertical-align: top; }
  th { background: #eee; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.8mm 4mm; margin: 0; }
  dt { color: #444; }
  dd { margin: 0; }
  .hinweis { font-size: 8pt; color: #333; margin: 1.5mm 0; }
  .leise { color: #555; }
  footer { margin-top: 5mm; font-size: 7pt; color: #555; }
${o.css ?? ''}
</style></head>
<body>
${o.ohneKopf ? '' : `<h1>${esc(o.titel)}</h1>`}
${inhalt}
${o.stempel ? `<footer>${esc(o.stempel)}</footer>` : ''}
</body></html>`
