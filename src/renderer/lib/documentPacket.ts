// ───────────────────────────────────────────────────────────────────────────
// Ein Papierstapel, den man zusammenheften kann (Bedarf 115, P3).
//
//   > Stage plot print offers only two modes (grayscale text-only on white, or
//   > full colour with icons on dark), neither of which fits a packet; a
//   > 44-row patch list SPANS PAGES AND LOSES ITS REPEATING HEADER and colour
//   > chips.
//
// Belegt an `SoundDocs/sounddocs#121` (2026-04-23): gewünscht sind
// browser-nativer Druck mit Vorschau, Papiergröße, Farbmodus und
// Icon-Schalter, ausdrücklich „for users assembling documentation packets".
// `Cryde/musicall#803` verlangt zusätzlich, dass der PDF-Export die Farbe
// behält.
//
// ─── DREI FEHLER, DIE DER BELEG BENENNT, UND WAS DAGEGEN STEHT ─────────────
//
//   1. **Der Kopf verschwindet auf Seite 2.** Eine 44-zeilige Patchliste
//      reisst um, und ab der zweiten Seite steht dort eine Zahlenkolonne ohne
//      Spaltennamen. `thead { display: table-header-group }` ist die
//      Browser-Antwort darauf, und sie steht hier einmal statt in jedem
//      Aufrufer.
//
//   2. **Zwei Modi, von denen keiner passt.** Weder „grau auf weiss, ohne
//      Icons" noch „farbig auf dunkel". Ein Packet braucht Papier: weiss,
//      Text schwarz, und die Farbe als ZUSATZ statt als Träger.
//
//   3. **Die Farbcodierung überlebt den Druck nicht.** Und das ist der
//      heikelste Punkt, denn er wird meist falsch gelöst: ein Farbfeld, das
//      im Graustufendruck zu einem grauen Kästchen wird, ist keine
//      Information mehr — zwei verschiedene Gruppen sehen gleich aus. Deshalb
//      trägt eine Farbzelle hier IMMER auch ihren NAMEN. Im Farbmodus steht
//      der Name neben dem Feld, im Monochrom-Modus steht er allein. Was
//      gedruckt wird, ist dann in beiden Fällen lesbar — und auf einer
//      Fotokopie ebenfalls.
//
// ─── EINE SEITE JE ARTEFAKT ────────────────────────────────────────────────
//
// „Packet-assemblable" heisst: jedes Blatt fängt oben auf einer neuen Seite
// an, damit man den Stapel lochen und in einen Ordner heften kann, ohne dass
// die Kabelliste auf der Rückseite der Kanalliste endet. Das ist ein
// `page-break-before` und keine Meinung.
//
// REIN: keine Uhr, kein Store, kein IO. Der Stempel kommt fertig herein —
// gebaut wird er in `documentStamp.ts`, mit der Uhr des Aufrufers.
// ───────────────────────────────────────────────────────────────────────────

import type { CsvCell, CsvTable } from './csv'
import type { DocumentStamp } from './documentStamp'
import { stampLine } from './documentStamp'
import { dictionaryRows, undescribedColumns } from './dataDictionary'

/** Papierformat. Mehr als diese drei kommen im Korpus nicht vor. */
export type PaperSize = 'A4' | 'Letter' | 'A3'

/**
 * Farbmodus.
 *
 * `colour` Farbfelder werden gedruckt — plus Name.
 * `mono`   Nur der Name. Für Schwarzweiss-Drucker und Fotokopien.
 */
export type ColourMode = 'colour' | 'mono'

export interface PacketOptions {
  paper: PaperSize
  colour: ColourMode
  /**
   * Ob das Spaltenlexikon mitgedruckt wird.
   *
   * Vorgabe an: der Beleg zu Bedarf 88 nennt ausdrücklich einen Empfänger,
   * „who might not know what each field is". Wer den Stapel für sich selbst
   * druckt, schaltet es ab.
   */
  glossary: boolean
}

export const DEFAULT_PACKET_OPTIONS: PacketOptions = {
  paper: 'A4',
  colour: 'colour',
  glossary: true,
}

/**
 * Eine Farbzelle: Wert plus Farbe.
 *
 * Der Wert ist der NAME der Gruppe/Kategorie und nicht die Farbe selbst —
 * genau das ist der Punkt aus dem Kopfkommentar. Wer hier `#ff0000` als Wert
 * übergibt, bekommt im Monochrom-Druck „#ff0000" zu lesen, und das ist
 * ehrlich, aber nutzlos.
 */
export interface ColourCell {
  value: string
  /** CSS-Farbe. Fehlt sie, ist es eine gewöhnliche Zelle. */
  colour?: string
}

export type PacketCell = CsvCell | ColourCell

export interface PacketSheet {
  title: string
  /** Untertitel/Kontext (Ort, Stichtag). Optional. */
  subtitle?: string
  headers: string[]
  rows: PacketCell[][]
  /** Der Stempel dieses Blatts. Ohne ihn steht kein Stand darauf. */
  stamp?: DocumentStamp
}

const isColourCell = (c: PacketCell): c is ColourCell =>
  typeof c === 'object' && c !== null && 'value' in c

export const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * Eine Zelle als HTML.
 *
 * Die Regel aus dem Kopfkommentar in einer Zeile: eine Farbzelle trägt
 * IMMER ihren Namen. Im Farbmodus kommt das Feld dazu; im Monochrom-Modus
 * bleibt der Name allein.
 */
export function cellHtml(cell: PacketCell, colour: ColourMode): string {
  if (!isColourCell(cell)) return esc(cell)
  const name = esc(cell.value)
  if (colour === 'mono' || !cell.colour) return name
  return `<span class="chip" style="background:${esc(cell.colour)}"></span>${name}`
}

/** Eine Tabelle aus dem übrigen Code als Packet-Blatt. */
export function sheetFromTable(
  title: string,
  table: CsvTable,
  stamp?: DocumentStamp,
  subtitle?: string,
): PacketSheet {
  return {
    title,
    ...(subtitle ? { subtitle } : {}),
    headers: [...table.headers],
    rows: table.rows.map((r) => [...r]),
    ...(stamp ? { stamp } : {}),
  }
}

/**
 * Blätter, deren Spalten im Lexikon fehlen.
 *
 * Ein Packet geht an jemanden, der die Spalten nicht kennt — das ist der
 * ganze Grund für das Lexikon. Ein Blatt mit unerklärten Spalten ist deshalb
 * ein Befund und keine Kleinigkeit.
 */
export function sheetsWithUndescribedColumns(
  sheets: readonly PacketSheet[],
): Array<{ title: string; columns: string[] }> {
  return sheets
    .map((s) => ({ title: s.title, columns: undescribedColumns(s.headers) }))
    .filter((x) => x.columns.length > 0)
}

const PAPER_CSS: Readonly<Record<PaperSize, string>> = {
  A4: 'A4',
  Letter: 'Letter',
  A3: 'A3',
}

/**
 * Der ganze Stapel als ein druckbares HTML-Dokument.
 *
 * Ein Dokument und nicht eines je Blatt: der Nutzer druckt einmal, und der
 * Stapel kommt in der Reihenfolge heraus, in der er ihn zusammengestellt hat.
 * Mehrere Dokumente hiessen mehrere Druckdialoge und eine Reihenfolge, die
 * vom Zufall abhängt.
 */
export function buildPacketHtml(
  documentTitle: string,
  sheets: readonly PacketSheet[],
  opts: PacketOptions = DEFAULT_PACKET_OPTIONS,
): string {
  const seiten = sheets
    .map((sheet, i) => {
      const kopf = sheet.headers.map((h) => `<th>${esc(h)}</th>`).join('')
      const zeilen = sheet.rows
        .map((r) => `<tr>${r.map((c) => `<td>${cellHtml(c, opts.colour)}</td>`).join('')}</tr>`)
        .join('\n')
      const lexikon =
        opts.glossary && sheet.headers.length > 0
          ? `<table class="glossary"><tbody>${dictionaryRows(sheet.headers)
              .map(
                (row) =>
                  `<tr><th>${esc(row[0])}</th><td>${esc(row[1])}</td></tr>`,
              )
              .join('')}</tbody></table>`
          : ''
      // `page-break-before` auf jedem Blatt AUSSER dem ersten: sonst beginnt
      // der Stapel mit einer leeren Seite.
      return `<section class="sheet"${i > 0 ? ' style="page-break-before:always"' : ''}>
  <h1>${esc(sheet.title)}</h1>
  ${sheet.subtitle ? `<div class="sub">${esc(sheet.subtitle)}</div>` : ''}
  <table class="data">
    <thead><tr>${kopf}</tr></thead>
    <tbody>
${zeilen}
    </tbody>
  </table>
  ${lexikon}
  ${sheet.stamp ? `<div class="stamp">${esc(stampLine(sheet.stamp))}</div>` : ''}
</section>`
    })
    .join('\n')

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(documentTitle)}</title>
<style>
  @page { size: ${PAPER_CSS[opts.paper]}; margin: 14mm; }
  /* Papier ist weiss. Der dunkle Modus der Oberflaeche hat auf Papier nichts
     zu suchen: er kostet Toner und macht die Kopie unlesbar. */
  body { font-family: Arial, sans-serif; color: #111; background: #fff; font-size: 10pt; }
  h1 { font-size: 14pt; margin: 0 0 1mm; }
  .sub { color: #555; font-size: 9pt; margin-bottom: 3mm; }
  table.data { width: 100%; border-collapse: collapse; font-size: 9pt; }
  /* DER FEHLER AUS DEM BELEG: „a 44-row patch list spans pages and loses its
     repeating header". Genau dagegen steht diese eine Zeile. */
  table.data thead { display: table-header-group; }
  table.data tfoot { display: table-footer-group; }
  table.data th, table.data td { border: 0.2mm solid #999; padding: 1mm 1.5mm; text-align: left; }
  table.data th { background: #eee; }
  /* Eine Zeile wird nicht mitten im Umbruch zerrissen. */
  table.data tr { page-break-inside: avoid; }
  .chip { display: inline-block; width: 3mm; height: 3mm; margin-right: 1.5mm;
          border: 0.2mm solid #333; vertical-align: middle; }
  table.glossary { margin-top: 4mm; font-size: 8pt; border-collapse: collapse; }
  table.glossary th { text-align: left; padding: 0.5mm 2mm 0.5mm 0; color: #333; white-space: nowrap; vertical-align: top; }
  table.glossary td { padding: 0.5mm 0; color: #555; }
  .stamp { margin-top: 4mm; font-family: 'Courier New', monospace; font-size: 8pt; color: #555; }
  .sheet { page-break-inside: auto; }
</style></head><body>
${seiten}
</body></html>`
}
