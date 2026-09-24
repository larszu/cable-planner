import type { CsvTable } from '../csv'
import type { PlatziertesSymbol, SymbolDef } from '../../types/symbol'

/** Stueckliste der Symbole: je Zeichen die Anzahl und die Beschriftungen.
 *  Sortiert nach Kategorie und Name, damit dieselbe Zeichnung dieselbe Datei
 *  ergibt. Ein Symbol ohne Definition (geloescht, aus einer fremden Datei)
 *  wird gezaehlt und so benannt — nicht verschwiegen. */
export const symbolTabelle = (
  symbole: PlatziertesSymbol[],
  defs: Map<string, SymbolDef>,
  name: (d: SymbolDef) => string,
  kopf: { symbol: string; kategorie: string; anzahl: string; beschriftungen: string; unbekannt: string },
): CsvTable => {
  const gruppen = new Map<string, PlatziertesSymbol[]>()
  for (const s of symbole) gruppen.set(s.defId, [...(gruppen.get(s.defId) ?? []), s])
  const rows = [...gruppen.entries()].map(([defId, liste]) => {
    const d = defs.get(defId)
    const beschriftungen = liste
      .map((s) => s.beschriftung?.trim())
      .filter((b): b is string => !!b)
      .sort((a, b) => a.localeCompare(b, 'de', { numeric: true }))
    return [d ? name(d) : `${kopf.unbekannt} (${defId})`, d?.kategorie ?? '', liste.length, beschriftungen.join(', ')]
  })
  rows.sort((a, b) => String(a[1]).localeCompare(String(b[1])) || String(a[0]).localeCompare(String(b[0]), 'de'))
  return { headers: [kopf.symbol, kopf.kategorie, kopf.anzahl, kopf.beschriftungen], rows }
}
