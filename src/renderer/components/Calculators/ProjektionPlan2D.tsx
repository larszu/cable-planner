import type { ProjektionErgebnis } from '../../lib/projektionGeometrie'

/**
 * #997 — 2D-Vorschau: Seitenschnitt (Abstände, Höhen, Strahlengang) und
 * Frontansicht (Bildmaße, Objektivlage). Maßstabstreu, beide im selben
 * Meter-Maßstab je Ansicht; Farben über Theme-Variablen.
 */
export interface PlanLabels {
  min: string
  optimal: string
  max: string
  abstand: string
  breite: string
  hoehe: string
  unterkante: string
  seite: string
  front: string
}

const m = (v: number) => `${v.toFixed(2)} m`
const FARBE = { linie: 'var(--cp-text-muted)', text: 'var(--cp-text)', akzent: 'var(--cp-accent)', strahl: 'var(--cp-warn)', ok: 'var(--cp-ok)' }

export function ProjektionPlan2D({ r, projektor, labels }: { r: ProjektionErgebnis; projektor: boolean; labels: PlanLabels }) {
  const o = projektor ? r.objektiv : undefined
  const unten = r.oberkante - r.hoehe
  // Seitenschnitt: z nach rechts, y nach oben.
  const tiefe = Math.max(r.sitz.max, o?.z ?? 0) * 1.08 + 0.5
  const hoch = Math.max(r.oberkante, o?.y ?? 0) + 0.6
  const yMin = Math.min(0, o?.y ?? 0) - 0.3
  const W = 600
  const H = 260
  const pad = 28
  const s = Math.min((W * 0.62 - pad - 62) / tiefe, (H - 2 * pad) / (hoch - yMin))
  const links = 62
  const sx = (z: number) => links + z * s
  const sy = (y: number) => H - pad - (y - yMin) * s
  // Frontansicht rechts.
  const fx0 = W * 0.62 + 10
  const fw = W - fx0 - 10
  const fs = Math.min((fw - 90) / (r.breite + 0.6),(H - 2 * pad) / (hoch - yMin))
  const fmx = fx0 + (fw - 70) / 2
  const fx = (x: number) => fmx + x * fs
  const fy = (y: number) => H - pad - (y - yMin) * fs
  const sitz = [['min', r.sitz.min], ['optimal', r.sitz.optimal], ['max', r.sitz.max]] as const

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label={`${labels.seite}, ${labels.front}`} fontSize={10}>
      <text x={pad} y={14} fill={FARBE.text} fontWeight={600}>{labels.seite}</text>
      <line x1={sx(0)} y1={sy(0)} x2={sx(tiefe)} y2={sy(0)} stroke={FARBE.linie} />
      <line x1={sx(0)} y1={sy(unten)} x2={sx(0)} y2={sy(r.oberkante)} stroke={FARBE.akzent} strokeWidth={4} />
      <line x1={sx(0) - 8} y1={sy(0)} x2={sx(0) - 8} y2={sy(unten)} stroke={FARBE.linie} strokeDasharray="3 2" />
      <text x={sx(0) - 11} y={sy(unten / 2)} fill={FARBE.text} textAnchor="end" dominantBaseline="middle">{m(unten)}</text>
      <text x={sx(0) - 11} y={sy(unten + r.hoehe / 2)} fill={FARBE.text} textAnchor="end" dominantBaseline="middle">{labels.hoehe} {m(r.hoehe)}</text>
      {o && (
        <g>
          <polygon points={`${sx(o.z)},${sy(o.y)} ${sx(0)},${sy(r.oberkante)} ${sx(0)},${sy(unten)}`} fill={FARBE.strahl} fillOpacity={0.15} stroke={FARBE.strahl} />
          <rect x={sx(o.z)} y={sy(o.y) - 5} width={16} height={10} rx={2} fill={FARBE.strahl} />
          <line x1={sx(0)} y1={sy(o.y)} x2={sx(o.z)} y2={sy(o.y)} stroke={FARBE.strahl} strokeDasharray="4 3" />
          <text x={sx(o.z / 2)} y={sy(o.y) - 4} fill={FARBE.text} textAnchor="middle">{labels.abstand} {m(r.abstand)}</text>
          <text x={sx(o.z) + 20} y={sy(o.y)} fill={FARBE.text} dominantBaseline="middle">{m(o.y)}</text>
        </g>
      )}
      {sitz.map(([k, z], i) => (
        <g key={k}>
          <line x1={sx(z)} y1={sy(0)} x2={sx(z)} y2={sy(1.2)} stroke={k === 'optimal' ? FARBE.ok : FARBE.linie} strokeWidth={2} />
          <circle cx={sx(z)} cy={sy(1.2)} r={3} fill={k === 'optimal' ? FARBE.ok : FARBE.linie} />
          <text x={sx(z)} y={sy(0) + 12 + (i % 2) * 11} fill={FARBE.text} textAnchor="middle">{m(z)}</text>
          <text x={sx(z)} y={sy(1.2) - 7 - i * 12} fill={FARBE.text} textAnchor="middle">{labels[k]}</text>
        </g>
      ))}

      <text x={fx0} y={14} fill={FARBE.text} fontWeight={600}>{labels.front}</text>
      <line x1={fx0} y1={fy(0)} x2={fx0 + fw} y2={fy(0)} stroke={FARBE.linie} />
      <rect x={fx(-r.breite / 2)} y={fy(r.oberkante)} width={r.breite * fs} height={r.hoehe * fs} fill={FARBE.akzent} fillOpacity={0.18} stroke={FARBE.akzent} strokeWidth={2} />
      <text x={fmx} y={fy(r.oberkante) - 5} fill={FARBE.text} textAnchor="middle">{labels.breite} {m(r.breite)}</text>
      <text x={fx(r.breite / 2) + 4} y={fy(unten + r.hoehe / 2)} fill={FARBE.text} dominantBaseline="middle">{labels.hoehe} {m(r.hoehe)}</text>
      <line x1={fmx} y1={fy(0)} x2={fmx} y2={fy(unten)} stroke={FARBE.linie} strokeDasharray="3 2" />
      <text x={fmx + 4} y={fy(unten / 2)} fill={FARBE.text} dominantBaseline="middle">{labels.unterkante} {m(unten)}</text>
      {o && (
        <g>
          <circle cx={fx(o.x)} cy={fy(o.y)} r={4} fill={FARBE.strahl} />
          <line x1={fx(o.x) - 7} y1={fy(o.y)} x2={fx(o.x) + 7} y2={fy(o.y)} stroke={FARBE.strahl} />
          <line x1={fx(o.x)} y1={fy(o.y) - 7} x2={fx(o.x)} y2={fy(o.y) + 7} stroke={FARBE.strahl} />
        </g>
      )}
    </svg>
  )
}
