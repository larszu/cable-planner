/**
 * v7.9.87 / #205 — Mini STL-Vorschau für den Properties-Editor.
 *
 * Wenn ein Gerät eine STL hinterlegt hat, zeigt diese kleine Komponente
 * eine kompakte 3D-Vorschau (≈120×80 px) der Geometrie. Auto-Rotation,
 * kein User-Input — soll als visueller Sanity-Check dienen, ob die
 * richtige Datei hochgeladen wurde, analog zu Front/Rear-Panel-Foto-
 * Thumbnails.
 *
 * Nutzt three.js / react-three-fiber das schon im Hauptbundle drin ist
 * (vom 3D-Rack-Builder Phase A) — keine zusätzliche Dependency.
 */
import { useMemo, useRef, Suspense } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { STLLoader } from 'three-stdlib'
import * as THREE from 'three'
import { useTranslation } from '../../lib/i18n'

interface Props {
  stlDataUri: string
  size?: number
}

const SpinningMesh = ({ stlDataUri }: { stlDataUri: string }) => {
  const geometry = useLoader(STLLoader, stlDataUri)
  const meshRef = useRef<THREE.Mesh>(null)
  // Auto-fit + center: BoundingBox berechnen, geometry zentrieren und
  // auf einheitliche Größe skalieren.
  const fitted = useMemo(() => {
    const geom = geometry.clone()
    geom.computeBoundingBox()
    const bb = geom.boundingBox!
    geom.translate(
      -(bb.max.x + bb.min.x) / 2,
      -(bb.max.y + bb.min.y) / 2,
      -(bb.max.z + bb.min.z) / 2,
    )
    const size = new THREE.Vector3()
    bb.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z, 0.001)
    const targetSize = 1.4 // 3D-Welt-Einheit
    geom.scale(targetSize / maxDim, targetSize / maxDim, targetSize / maxDim)
    return geom
  }, [geometry])

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5
    }
  })

  return (
    <mesh ref={meshRef} geometry={fitted}>
      <meshStandardMaterial color="#94a3b8" metalness={0.4} roughness={0.6} />
    </mesh>
  )
}

export const StlPreview = ({ stlDataUri, size = 96 }: Props) => {
  const t = useTranslation()
  return (
    <div
      style={{
        width: size,
        height: Math.round(size * 0.7),
        borderRadius: 4,
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
        border: '1px solid #334155',
      }}
      title={t('rack.stlPreviewTitle', 'STL-Vorschau (rotiert automatisch)')}
    >
      <Canvas
        camera={{ position: [1.5, 1.2, 1.8], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 2]} intensity={0.9} />
        <directionalLight position={[-3, 2, -1]} intensity={0.4} />
        <Suspense fallback={null}>
          <SpinningMesh stlDataUri={stlDataUri} />
        </Suspense>
      </Canvas>
    </div>
  )
}
