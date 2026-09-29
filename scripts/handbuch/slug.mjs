/**
 * Anker wie GitHub: klein, Satzzeichen weg, Leerzeichen zu Bindestrich.
 * `scripts/manual-pdf.mjs` vergibt dieselben ids — derselbe Link springt
 * auf GitHub und im PDF an dieselbe Stelle.
 */
export const slug = (t) =>
  t.toLowerCase().replace(/[`*_]/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s/g, '-')
