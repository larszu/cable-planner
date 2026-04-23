/**
 * Standard cable-length color coding.
 * The lengths and colors follow German broadcast convention:
 * 1m=red, 2m=yellow, 3m=green, 5m=white, 10m=red, 20m=yellow,
 * 25m=yellow/white dashed, 50m=white, 100m=red
 */

export interface LengthColorRule {
  length: number
  /** CSS stroke color. */
  color: string
  /** Optional dasharray for the stroke (e.g. "10 6"). */
  dashArray?: string
  /** Human-readable description shown in the legend. */
  label: string
}

export const LENGTH_COLOR_RULES: LengthColorRule[] = [
  { length: 1, color: '#ef4444', label: '1 m – rot' },
  { length: 2, color: '#eab308', label: '2 m – gelb' },
  { length: 3, color: '#22c55e', label: '3 m – grün' },
  { length: 5, color: '#f8fafc', label: '5 m – weiß' },
  { length: 10, color: '#ef4444', label: '10 m – rot' },
  { length: 20, color: '#eab308', label: '20 m – gelb' },
  { length: 25, color: '#eab308', dashArray: '12 8', label: '25 m – gelb/weiß gestrichelt' },
  { length: 50, color: '#f8fafc', label: '50 m – weiß' },
  { length: 100, color: '#ef4444', label: '100 m – rot' },
]

/**
 * Return the stroke color and optional dashArray for a cable based on its length.
 * Returns `null` when no rule matches the length.
 */
export const colorByLength = (
  length: number,
): { color: string; dashArray?: string } | null => {
  const rule = LENGTH_COLOR_RULES.find((r) => r.length === length)
  if (!rule) return null
  return { color: rule.color, dashArray: rule.dashArray }
}
