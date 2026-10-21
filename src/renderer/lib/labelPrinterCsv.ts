// ───────────────────────────────────────────────────────────────────────────
// Label-Drucker-CSV (#349, ausgelagert mit #999).
//
// EIN Format fuer alle Etiketten, die in Brother P-touch Editor, Dymo
// Connect/Stamps oder generische Etiketten-Software gehen: Spalten Label1,
// Label2, Length, Color. Vorher lebte der Aufbau nur in der Patchliste; die
// Patchfeld-Etiketten der Netzwerk-Analyse (#999) brauchen genau dasselbe,
// und eine zweite Fassung wuerde beim naechsten Drucker-Sonderfall abweichen.
//
// ASCII-sicher via sanitizeForPdf, weil viele Drucker-Tools UTF-8 nur
// halbherzig importieren. Brother: TAB-getrennt als .txt, ohne BOM. Dymo und
// generisch: Komma, CSV mit BOM.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import { sanitizeForPdf } from './sanitizeForPdf'

export type LabelCsvFormat = 'generic' | 'brother' | 'dymo'

export const LABEL_CSV_FORMATS: readonly LabelCsvFormat[] = ['generic', 'brother', 'dymo']

/** Ein Etikett: grosse Zeile, kleine Zeile, Laenge, Farbe. */
export interface LabelRow {
  label1: string
  label2: string
  meta?: string
  color?: string
}

export interface LabelCsvFile {
  body: string
  ext: 'txt' | 'csv'
  mime: string
}

export const buildLabelCsv = (rows: readonly LabelRow[], format: LabelCsvFormat): LabelCsvFile => {
  const sep = format === 'brother' ? '\t' : ','
  const escape = (v: unknown) => {
    const s = sanitizeForPdf(String(v ?? ''))
    if (sep === '\t') return s.replace(/\t/g, ' ')
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    ['Label1', 'Label2', 'Length', 'Color'].join(sep),
    ...rows.map((l) => [l.label1, l.label2, l.meta ?? '', l.color ?? ''].map(escape).join(sep)),
  ]
  if (format === 'brother') {
    return { body: lines.join('\r\n'), ext: 'txt', mime: 'text/plain;charset=utf-8' }
  }
  return { body: '﻿' + lines.join('\r\n'), ext: 'csv', mime: 'text/csv;charset=utf-8' }
}
