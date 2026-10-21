import { useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import { erzeugeLedWand, erzeugeMensch } from '../../avplan/scene3d'
import type { ProjektionErgebnis } from '../../lib/projektionGeometrie'
import type { PlanLabels } from '../Calculators/ProjektionPlan2D'

/**
 * #997 — 3D-Vorschau des Projektions-/Display-Rechners. Liegt in `Rack/`
 * wegen der Three-Grenze (CLAUDE.md) und wird nur lazy geladen. Display und
 * Zuschauer kommen aus `@avplan/scene3d`, damit die Planer gleich aussehen.
 */
interface Props {
  r: ProjektionErgebnis
  projektor: boolean
  isLight: boolean
  labels: PlanLabels
}

const m = (v: number) => `${v.toFixed(2)} m`

const Label = ({ p, text }: { p: [number, number, number]; text: string }) => (
  <Html position={p} center>
    <span className="whitespace-nowrap rounded-cp-s bg-cp-surface-raised px-1.5 py-0.5 font-mono text-cp-xs text-cp-text shadow-cp-1">{text}</span>
  </Html>
)

const Zuschauer = ({ z }: { z: number }) => {
  const mensch = useMemo(() => erzeugeMensch('sitzen', { oben: '#5b6b80', unten: '#2b2f36', haut: '#c99a7a', haar: '#3a2a20' }), [])
  useEffect(() => () => mensch.geometry.dispose(), [mensch])
  return <primitive object={mensch} position={[0, 0, z]} />
}

export default function ProjektionVorschau3D({ r, projektor, isLight, labels }: Props) {
  const { breite: w, hoehe: h, oberkante } = r
  const unten = oberkante - h
  const wand = useMemo(
    () => (!projektor ? erzeugeLedWand({ breiteM: w, hoeheM: h, pitchMm: 1.5, helligkeit: 1 }) : null),
    [projektor, w, h],
  )
  const tiefe = Math.max(r.sitz.max, r.abstand) + 1.5
  const ecken: [number, number, number][] = [
    [-w / 2, unten, 0],
    [w / 2, unten, 0],
    [w / 2, oberkante, 0],
    [-w / 2, oberkante, 0],
  ]
  const o = projektor ? r.objektiv : undefined
  const linie = isLight ? '#1D324F' : '#B9C7D8'
  return (
    <Canvas camera={{ position: [w / 2 + 4, oberkante + 2.5, tiefe + 3], fov: 40 }} style={{ background: isLight ? '#F6F5F0' : '#1E1F23' }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 8, 6]} intensity={1.4} />
      <gridHelper args={[Math.ceil(tiefe + 2), Math.ceil(tiefe + 2), linie, isLight ? '#d7d5cc' : '#33343A']} position={[0, 0, tiefe / 2]} />
      {wand ? (
        <primitive object={wand} position={[0, unten, 0]} />
      ) : (
        <mesh position={[0, unten + h / 2, 0]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color="#f4f4f2" emissive="#ffffff" emissiveIntensity={0.25} />
        </mesh>
      )}
      <Line points={[[-w / 2, unten - 0.15, 0.02], [w / 2, unten - 0.15, 0.02]]} color={linie} lineWidth={1.5} />
      <Label p={[0, unten - 0.3, 0.02]} text={`${labels.breite} ${m(w)}`} />
      <Line points={[[w / 2 + 0.15, unten, 0.02], [w / 2 + 0.15, oberkante, 0.02]]} color={linie} lineWidth={1.5} />
      <Label p={[w / 2 + 0.6, unten + h / 2, 0.02]} text={`${labels.hoehe} ${m(h)}`} />
      <Line points={[[-w / 2 - 0.15, 0, 0.02], [-w / 2 - 0.15, unten, 0.02]]} color={linie} lineWidth={1.5} dashed dashSize={0.08} gapSize={0.05} />
      <Label p={[-w / 2 - 0.7, unten / 2, 0.02]} text={`${labels.unterkante} ${m(unten)}`} />
      {o && (
        <>
          <mesh position={[o.x, o.y, o.z + 0.2]}>
            <boxGeometry args={[0.45, 0.18, 0.4]} />
            <meshStandardMaterial color="#33343A" />
          </mesh>
          {ecken.map((e, i) => (
            <Line key={i} points={[[o.x, o.y, o.z], e]} color="#C8892B" lineWidth={1} transparent opacity={0.7} />
          ))}
          <Line points={[[o.x, 0.01, 0], [o.x, 0.01, o.z]]} color="#C8892B" lineWidth={1.5} />
          <Label p={[o.x, 0.15, o.z / 2]} text={`${labels.abstand} ${m(r.abstand)}`} />
        </>
      )}
      {([['min', r.sitz.min], ['optimal', r.sitz.optimal], ['max', r.sitz.max]] as const).map(([k, z]) => (
        <group key={k}>
          <Zuschauer z={z} />
          <Line points={[[-w / 2, 0.01, z], [w / 2, 0.01, z]]} color={k === 'optimal' ? '#2F7D5C' : linie} lineWidth={1.5} />
          <Label p={[w / 2 + 0.4, 1.4, z]} text={`${labels[k]} ${m(z)}`} />
        </group>
      ))}
      <OrbitControls target={[0, unten + h / 2, tiefe * 0.3]} makeDefault />
    </Canvas>
  )
}
