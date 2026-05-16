// v7.9.2 — Helvetica in jsPDF schickt nur ISO-8859-1 Glyphen mit.
// Zeichen außerhalb von Latin-1 (Pfeile, En/Em-Dash, Smart-Quotes,
// Bullets, Ellipsen …) werden entweder als kaputte Zwei-Byte-Sequenz
// gerendert (→ wird zu "!'", weil die 0x21 / 0x92 Bytes einzeln durch
// die Helvetica-Tabelle laufen) ODER lassen die jsPDF-Justify-Logik
// die ganze Zeile char-für-char auseinanderspreizen ("S D I  O u t").
//
// Dieses Helper ersetzt die häufigsten Problemzeichen durch ASCII-
// Äquivalente die Helvetica direkt rendert. Aufgerufen aus ALLEN
// jsPDF-Aufrufstellen vor `pdf.text(...)`.

// Map Unicode-Codepoints zu ASCII/Latin-1 Ersatz. Reine Lookup-Map,
// keine Regex-Range — eindeutig und einfach zu erweitern.
const REPLACEMENTS: Record<string, string> = {
  // Pfeile
  '←': '<-', // ←
  '↑': '^', //  ↑
  '→': '->', // →
  '↓': 'v', //  ↓
  '↔': '<->', // ↔
  '➜': '->', // ➜
  '➡': '->', // ➡
  '➔': '->', // ➔
  // Dashes
  '–': '-', //  – en-dash
  '—': '--', // — em-dash
  '―': '--', // ― horizontal bar
  // Smart quotes
  '‘': "'", //  ‘
  '’': "'", //  ’
  '‚': "'", //  ‚
  '′': "'", //  ′
  '“': '"', //  “
  '”': '"', //  ”
  '„': '"', //  „
  '″': '"', //  ″
  // Bullets / list markers
  '•': '*', //  •
  '●': '*', //  ●
  '■': '#', //  ■
  '▪': '#', //  ▪
  '◦': 'o', //  ◦
  '○': 'o', //  ○
  // Ellipsis
  '…': '...', // …
  // Math
  '±': '+/-', // ± (in Latin-1 but kept for clarity)
  '×': 'x', //   × (also in Latin-1)
  '✕': 'x', //   ✕
  // Whitespace artefacts that confuse jsPDF layout
  ' ': ' ', //   NBSP
  '​': '', //    ZWSP
  '‌': '', //    ZWNJ
  '‍': '', //    ZWJ
  '‎': '', //    LRM
  '‏': '', //    RLM
  '﻿': '', //    BOM
  '­': '', //    soft hyphen
}

/**
 * Sanitize a string for jsPDF Helvetica (ISO-8859-1) rendering.
 * Replaces common Unicode characters with ASCII equivalents so they
 * render correctly instead of being garbled or breaking the layout.
 * Any remaining characters outside Latin-1 (U+0000 – U+00FF) are
 * dropped to keep the line layout sane.
 */
export const sanitizeForPdf = (text: string | null | undefined): string => {
  if (text == null) return ''
  const s = String(text)
  let out = ''
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0
    if (REPLACEMENTS[ch] != null) {
      out += REPLACEMENTS[ch]
      continue
    }
    // Latin-1 range is U+0000..U+00FF. Helvetica covers most of it
    // (printable starts at 0x20). Keep tab/newline so multi-line
    // pdf.text() calls still work.
    if (code === 0x09 || code === 0x0a || code === 0x0d) {
      out += ch
    } else if (code >= 0x20 && code <= 0xff) {
      out += ch
    }
    // else: drop — anything outside Latin-1 with no mapping would
    // garble the line. Better to silently drop than to break layout.
  }
  return out
}

/** Apply sanitizeForPdf to each entry of an array. */
export const sanitizeForPdfArray = (lines: Array<string | null | undefined>): string[] =>
  lines.map((l) => sanitizeForPdf(l))
