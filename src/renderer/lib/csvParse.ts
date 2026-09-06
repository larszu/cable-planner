// ───────────────────────────────────────────────────────────────────────────
// CSV lesen — die eine Stelle.
//
// Stand bis Bedarf 21 als private Funktion in `CsvImportDialog.tsx`, also
// genau dort, wo kein zweiter Leser sie erreichen konnte. Der Netz-Abgleich
// braucht dieselbe Arbeit (Quote-Behandlung, Trenner-Erkennung, BOM), und ein
// zweiter Parser daneben haette bei der ersten Datei mit einem Semikolon im
// Anlagennamen anders geantwortet als der erste.
//
// Hochgezogen, nicht neu geschrieben — dieselbe Bauform wie `resolvePortLabel`
// (ADR-001 Inkrement 2) und `deviceInterfaces` (Bedarf 19).
// ───────────────────────────────────────────────────────────────────────────

/** CSV → Zeilen. Quote-fähig, Trenner (; oder ,) aus der Kopfzeile erkannt. */
export const parseCsv = (text: string): string[][] => {
  const t = text.replace(/\r\n?/g, '\n').replace(/^\u{FEFF}/u, '').trim()
  if (!t) return []
  const firstLine = t.split('\n')[0] ?? ''
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQ = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (inQ) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"'
          i++
        } else inQ = false
      } else field += c
    } else if (c === '"') inQ = true
    else if (c === delim) {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  row.push(field)
  rows.push(row)
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}
