/**
 * #237 — Levenshtein-Edit-Distanz fuer Smart-Routing-Fuzzy-Match.
 *
 * Klassische DP-Implementierung mit zwei rollenden Arrays (Speicher O(n)
 * statt O(m·n)). Eingaben sind als bereits klein-geschriebene Tokens
 * gedacht — Caller normalisiert vorher mit `.toLowerCase()`.
 */
export const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const m = a.length
  const n = b.length
  let prev = new Array<number>(n + 1)
  let curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      )
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]
}

/**
 * #237 — True wenn die Edit-Distanz zwischen `a` und `b` <= `maxDist` ist.
 * Early-Exit ueber Laengen-Differenz spart in den haeufigsten Faellen
 * den vollen DP-Lauf.
 */
export const isWithinDistance = (a: string, b: string, maxDist: number): boolean => {
  if (Math.abs(a.length - b.length) > maxDist) return false
  return levenshtein(a, b) <= maxDist
}
