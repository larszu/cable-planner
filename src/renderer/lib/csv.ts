/**
 * Minimaler, robuster CSV-Builder für die Festinstallations-Exporte
 * (Pull-Liste, Termination-Liste, Asset-Register …). Installateure
 * erwarten editierbares, sortierbares CSV/Excel.
 *
 * - RFC-4180-Quoting (Feld mit Delimiter/Quote/Zeilenumbruch → in "…",
 *   innere " verdoppelt).
 * - CRLF-Zeilenenden + UTF-8-BOM, damit Excel Umlaute korrekt erkennt.
 * - Default-Delimiter ist `;` (deutsches Excel) — überschreibbar.
 */

export type CsvCell = string | number | null | undefined

const escapeCell = (value: CsvCell, delimiter: string): string => {
  const s = value === null || value === undefined ? '' : String(value)
  const needsQuote =
    s.includes(delimiter) ||
    s.includes('"') ||
    s.includes('\n') ||
    s.includes('\r')
  return needsQuote ? `"${s.replace(/"/g, '""')}"` : s
}

export const toCsv = (
  headers: string[],
  rows: CsvCell[][],
  opts: { delimiter?: string; bom?: boolean } = {},
): string => {
  const delimiter = opts.delimiter ?? ';'
  const bom = opts.bom ?? true
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => escapeCell(cell, delimiter)).join(delimiter),
  )
  return (bom ? '﻿' : '') + lines.join('\r\n')
}
