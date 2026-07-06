// ───────────────────────────────────────────────────────────────────────────
// Polardiagramm einer Mikrofon-Richtcharakteristik (SVG).
//
// Zeichnet die klassische Polarkurve r(θ) je Muster (Front = oben). Die Formeln
// sind die Lehrbuch-/DPA-Standardformen der 1st-order-Muster; Shotgun/Grenzfläche
// sind sinnvolle Näherungen. Rein visuell, kein Datenwert.
// ───────────────────────────────────────────────────────────────────────────

/** r(θ) je Muster; θ=0 zeigt nach vorn (oben). Werte 0..~1. */
const R_FN: Record<string, (t: number) => number> = {
  omni: () => 1,
  sub: (t) => 0.7 + 0.3 * Math.cos(t), // breite/Sub-Niere
  cardioid: (t) => 0.5 + 0.5 * Math.cos(t),
  super: (t) => 0.37 + 0.63 * Math.cos(t),
  hyper: (t) => 0.25 + 0.75 * Math.cos(t),
  fig8: (t) => Math.abs(Math.cos(t)),
  shotgun: (t) => Math.max(0, Math.cos(t)) ** 3 * 0.9 + (Math.cos(t) > 0 ? 0.1 : 0.06),
  boundary: (t) => (Math.cos(t) >= 0 ? 1 : 0.08), // Front-Halbraum
  multi: (t) => 0.5 + 0.5 * Math.cos(t), // repräsentativ als Niere gezeigt
}

const buildPath = (pattern: string, R: number, cx: number, cy: number): string => {
  const fn = R_FN[pattern] ?? R_FN.cardioid
  const pts: string[] = []
  const N = 72
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2
    const r = Math.max(0, fn(t)) * R
    const x = cx + Math.sin(t) * r
    const y = cy - Math.cos(t) * r
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
  }
  pts.push('Z')
  return pts.join(' ')
}

export const PolarPatternDiagram = ({
  pattern,
  size = 64,
  className,
}: {
  pattern: string | undefined
  size?: number
  className?: string
}) => {
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - 4
  const p = pattern && R_FN[pattern] ? pattern : undefined

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className} aria-hidden>
      {/* Gitter */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="currentColor" strokeOpacity={0.15} />
      <circle cx={cx} cy={cy} r={R * 0.66} fill="none" stroke="currentColor" strokeOpacity={0.1} />
      <circle cx={cx} cy={cy} r={R * 0.33} fill="none" stroke="currentColor" strokeOpacity={0.1} />
      <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke="currentColor" strokeOpacity={0.12} />
      <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke="currentColor" strokeOpacity={0.12} />
      {p ? (
        <path d={buildPath(p, R, cx, cy)} fill="currentColor" fillOpacity={0.22} stroke="currentColor" strokeWidth={1.5} />
      ) : (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.16} fill="currentColor" opacity={0.4}>
          ?
        </text>
      )}
      {/* Front-Markierung */}
      <text x={cx} y={cy - R + 1} textAnchor="middle" fontSize={size * 0.13} fill="currentColor" opacity={0.45}>
        ▲
      </text>
    </svg>
  )
}
