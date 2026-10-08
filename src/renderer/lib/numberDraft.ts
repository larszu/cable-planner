// #1030 — Zahlenfelder klemmten bei jedem Tastendruck: Backspace machte aus
// "" sofort wieder 1, die nächste Ziffer wurde angehängt (1 → 11 HE).
// Beim Tippen darf das Feld leer oder außerhalb der Grenzen sein; geklemmt
// wird erst beim Verlassen (blur/Enter).

export interface NumberBounds {
  min?: number
  max?: number
  integer?: boolean
}

const parse = (raw: string, integer?: boolean): number | null => {
  if (raw.trim() === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return integer ? Math.floor(n) : n
}

/** Wert, der schon beim Tippen übernommen wird — nur wenn er gültig ist. */
export const liveNumber = (raw: string, { min, max, integer }: NumberBounds = {}): number | null => {
  const n = parse(raw, integer)
  if (n === null) return null
  if (min !== undefined && n < min) return null
  if (max !== undefined && n > max) return null
  return n
}

/** Endwert beim Verlassen: geklemmt; leer/ungültig → `fallback`. */
export const commitNumber = (raw: string, fallback: number, { min, max, integer }: NumberBounds = {}): number => {
  let n = parse(raw, integer) ?? fallback
  if (min !== undefined) n = Math.max(min, n)
  if (max !== undefined) n = Math.min(max, n)
  return n
}
