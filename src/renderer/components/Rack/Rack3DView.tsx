/**
 * v7.9.73 / #170 — 3D Rack Builder (Phase A).
 *
 * Rendert das Rack als orbitable 3D-Szene mit react-three-fiber.
 * Pure View-Komponente: keine Mutation, ruft onSelectPlacement(id) wenn
 * der User auf eine Geräte-Box klickt. Bearbeitet wird weiterhin im 2D-Tab
 * via Seitenpanel.
 *
 * Koordinatensystem:
 *  - 1 World-Unit = 1 mm
 *  - Rack-Standpunkt: (0, 0, 0) ist die vordere untere linke Ecke
 *  - X: Breite (Rack ~482.6 mm breit, ~450 mm Mounting-Raum)
 *  - Y: Höhe (1 HE = 44.45 mm, von unten nach oben)
 *  - Z: Tiefe (positive Z geht NACH HINTEN); Front bei z=0
 *
 * Geräte mit mountSide:
 *  - 'full'  → Box von z=0 (Front) bis z=depthMm (Rückwand)
 *  - 'front' → Box von z=0 bis z=depthMm (max 1/2 Rack-Tiefe), nur vorne
 *  - 'rear'  → Box von z=(rackDepth - depthMm) bis z=rackDepth, nur hinten
 *
 * STL-Support: wenn placement.stlDataUri gesetzt, wird die Geometrie mit
 * STLLoader geladen und in die HE-Box eingepasst. Sonst prozedurale Box.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { OrbitControls, Edges, Html } from '@react-three/drei'
import { STLLoader } from 'three-stdlib'
import * as THREE from 'three'

const HE_HEIGHT_MM = 44.45
const RACK_OUTER_WIDTH_MM = 482.6
const RACK_MOUNT_WIDTH_MM = 450
const DEFAULT_RACK_DEPTH_MM = 800
const DEFAULT_DEVICE_DEPTH_MM = 400

interface Rack3DPlacement {
  id: string
  name: string
  startUnit: number
  rackUnits: number
  depthMm?: number
  mountSide?: 'front' | 'rear' | 'full'
  stlDataUri?: string
  frontPanelImageUrl?: string
  rearPanelImageUrl?: string
  /** v7.9.75 / #170 — Anzahl der Patch-Ports (für die Darstellung als
   *  Patchblende mit Port-Punkten und für die View-Mode-Filterung). */
  portCount?: number
  isPatchPanel?: boolean
  isRackShelf?: boolean
}

interface Rack3DViewProps {
  totalUnits: number
  rackDepthMm?: number
  placements: Rack3DPlacement[]
  selectedPlacementId: string | null
  onSelectPlacement: (id: string | null) => void
}

const Chassis = ({
  totalUnits,
  depthMm,
}: {
  totalUnits: number
  depthMm: number
}) => {
  const heightMm = totalUnits * HE_HEIGHT_MM
  // Solid grau-transparente Wände + Edges damit man die Geräte drin sieht.
  return (
    <group>
      {/* Boden */}
      <mesh position={[RACK_OUTER_WIDTH_MM / 2, 0, depthMm / 2]} receiveShadow>
        <boxGeometry args={[RACK_OUTER_WIDTH_MM, 4, depthMm]} />
        <meshStandardMaterial color="#1f2937" opacity={0.9} transparent />
      </mesh>
      {/* Linke Wand */}
      <mesh position={[2, heightMm / 2, depthMm / 2]}>
        <boxGeometry args={[4, heightMm, depthMm]} />
        <meshStandardMaterial color="#1f2937" opacity={0.4} transparent />
      </mesh>
      {/* Rechte Wand */}
      <mesh position={[RACK_OUTER_WIDTH_MM - 2, heightMm / 2, depthMm / 2]}>
        <boxGeometry args={[4, heightMm, depthMm]} />
        <meshStandardMaterial color="#1f2937" opacity={0.4} transparent />
      </mesh>
      {/* Decke */}
      <mesh position={[RACK_OUTER_WIDTH_MM / 2, heightMm, depthMm / 2]}>
        <boxGeometry args={[RACK_OUTER_WIDTH_MM, 4, depthMm]} />
        <meshStandardMaterial color="#1f2937" opacity={0.4} transparent />
      </mesh>
      {/* HE-Markierungen an der linken Schiene */}
      {Array.from({ length: totalUnits + 1 }, (_, i) => (
        <mesh key={i} position={[16, i * HE_HEIGHT_MM, 1]}>
          <boxGeometry args={[2, 0.6, 2]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
      ))}
    </group>
  )
}

/** v7.9.74 / #170 — Texture-Loader Hook. Lädt ein Bild zur THREE.Texture
 *  und cached pro URL. Liefert null während des Ladens (kein Suspense, damit
 *  Geräte ohne Foto sofort sichtbar sind und Foto erst beim Eintreffen
 *  "aufploppt" statt das ganze Canvas zu blockieren). */
const textureCache = new Map<string, THREE.Texture>()
const useImageTexture = (url?: string): THREE.Texture | null => {
  const [tex, setTex] = useState<THREE.Texture | null>(
    url ? (textureCache.get(url) ?? null) : null,
  )
  useEffect(() => {
    if (!url) {
      setTex(null)
      return
    }
    const cached = textureCache.get(url)
    if (cached) {
      setTex(cached)
      return
    }
    const loader = new THREE.TextureLoader()
    loader.crossOrigin = 'anonymous'
    let cancelled = false
    loader.load(
      url,
      (loaded) => {
        if (cancelled) return
        // Color space sRGB damit Panelfotos nicht ausgewaschen aussehen.
        loaded.colorSpace = THREE.SRGBColorSpace
        loaded.anisotropy = 4
        textureCache.set(url, loaded)
        setTex(loaded)
      },
      undefined,
      () => {
        if (!cancelled) setTex(null)
      },
    )
    return () => {
      cancelled = true
    }
  }, [url])
  return tex
}

/** Procedural device box mit Front/Rear-Foto als Textur.
 *  Geometry: width × height × depth in mm.
 *
 *  v7.9.74 / #170 — Wenn frontPanelImageUrl gesetzt ist, wird das Bild
 *  als Material auf die Vorder-Face geklebt (face index 5 = -Z). Das
 *  Rear-Foto landet auf face index 4 (+Z). Übrige Faces: matt-grau.
 *  Das ersetzt die ursprünglich angedachte STL-Auto-Generierung mit
 *  Front/Rear-Textur-Backing — visuell dasselbe ohne den STL-Speicher-
 *  Overhead und ohne extra Dateien. STL-Upload bleibt als Override. */
const DeviceBox = ({
  placement,
  rackDepthMm,
  totalUnits,
  selected,
  onClick,
}: {
  placement: Rack3DPlacement
  rackDepthMm: number
  totalUnits: number
  selected: boolean
  onClick: () => void
}) => {
  const mountSide = placement.mountSide ?? 'full'
  const depthMm = Math.max(20, placement.depthMm ?? DEFAULT_DEVICE_DEPTH_MM)
  const yBottom = (totalUnits - placement.startUnit - placement.rackUnits + 1) * HE_HEIGHT_MM
  const heightMm = placement.rackUnits * HE_HEIGHT_MM
  const widthMm = RACK_MOUNT_WIDTH_MM

  const zStart = mountSide === 'rear' ? rackDepthMm - depthMm : 0
  const xCenter = (RACK_OUTER_WIDTH_MM - widthMm) / 2 + widthMm / 2
  const yCenter = yBottom + heightMm / 2
  const zCenter = zStart + depthMm / 2

  // v7.9.75 / #170 — Patchblenden bekommen eine eigene Farbe damit der
  // User sie auf einen Blick von normalen Geräten unterscheidet.
  const baseColor = selected
    ? '#38bdf8'
    : placement.isPatchPanel
      ? '#f59e0b'
      : mountSide === 'rear'
        ? '#a855f7'
        : mountSide === 'front'
          ? '#22c55e'
          : '#64748b'

  const frontTex = useImageTexture(placement.frontPanelImageUrl)
  const rearTex = useImageTexture(placement.rearPanelImageUrl)

  // BoxGeometry materials order: [+x, -x, +y, -y, +z, -z]
  // Front face (sichtbar von -Z aus → Kamera vor dem Rack) = face index 5.
  // Rear face = face index 4. Wenn Foto fehlt, Fallback auf Basis-Material.
  // Die Bilder werden mit needsUpdate=false neu gerendert sobald sie aus
  // dem Cache eintreffen.
  const materials = useMemo<THREE.Material[]>(() => {
    const sideMaterial = new THREE.MeshStandardMaterial({
      color: baseColor,
      opacity: selected ? 0.9 : 0.85,
      transparent: true,
      roughness: 0.7,
      metalness: 0.15,
    })
    const frontMaterial = frontTex
      ? new THREE.MeshStandardMaterial({
          map: frontTex,
          color: selected ? '#bae6fd' : '#ffffff',
          roughness: 0.55,
          metalness: 0.2,
        })
      : sideMaterial
    const rearMaterial = rearTex
      ? new THREE.MeshStandardMaterial({
          map: rearTex,
          color: selected ? '#bae6fd' : '#ffffff',
          roughness: 0.55,
          metalness: 0.2,
        })
      : sideMaterial
    return [sideMaterial, sideMaterial, sideMaterial, sideMaterial, rearMaterial, frontMaterial]
  }, [baseColor, selected, frontTex, rearTex])

  return (
    <group>
      <mesh
        position={[xCenter, yCenter, zCenter]}
        material={materials}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
      >
        <boxGeometry args={[widthMm, heightMm, depthMm]} />
        <Edges color={selected ? '#0ea5e9' : '#020617'} threshold={15} />
      </mesh>
      <Html
        position={[xCenter, yCenter, mountSide === 'rear' ? zStart - 5 : zStart + depthMm + 5]}
        center
        style={{
          color: '#e2e8f0',
          fontSize: 10,
          background: 'rgba(15,23,42,0.7)',
          padding: '2px 6px',
          borderRadius: 3,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
        transform={false}
        distanceFactor={300}
      >
        {placement.name} ({placement.rackUnits}HE)
      </Html>
    </group>
  )
}

/** v7.9.75 / #170 — Rack-Shelf-Renderer: flache Plattform in der unteren
 *  Hälfte der zugewiesenen HE-Range. Damit darauf Non-19"-Geräte sichtbar
 *  "ruhen" können (sie werden mit eigenem startUnit auf dieselbe HE
 *  gelegt — der Shelf zeigt visuell wo die Bodenfläche liegt). */
const Shelf = ({
  placement,
  rackDepthMm,
  totalUnits,
  selected,
  onClick,
}: {
  placement: Rack3DPlacement
  rackDepthMm: number
  totalUnits: number
  selected: boolean
  onClick: () => void
}) => {
  const depthMm = Math.max(50, placement.depthMm ?? rackDepthMm * 0.75)
  const yBottom = (totalUnits - placement.startUnit - placement.rackUnits + 1) * HE_HEIGHT_MM
  const heightMm = placement.rackUnits * HE_HEIGHT_MM
  const plateThickness = 4
  const xCenter = RACK_OUTER_WIDTH_MM / 2
  const yCenter = yBottom + plateThickness / 2
  const zCenter = depthMm / 2
  const color = selected ? '#38bdf8' : '#94a3b8'
  return (
    <group>
      {/* Boden-Plate */}
      <mesh position={[xCenter, yCenter, zCenter]} onClick={(e) => { e.stopPropagation(); onClick() }}>
        <boxGeometry args={[RACK_MOUNT_WIDTH_MM, plateThickness, depthMm]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.6} />
      </mesh>
      {/* Front-Rail (kleiner Aufkant vorne, damit Plate als Plate erkennbar ist) */}
      <mesh position={[xCenter, yBottom + heightMm * 0.15, 4]}>
        <boxGeometry args={[RACK_MOUNT_WIDTH_MM, heightMm * 0.3, 4]} />
        <meshStandardMaterial color={selected ? '#0ea5e9' : '#475569'} opacity={0.6} transparent />
      </mesh>
      <Html
        position={[xCenter, yBottom + heightMm + 4, depthMm + 5]}
        center
        style={{
          color: '#cbd5e1',
          fontSize: 9,
          background: 'rgba(15,23,42,0.7)',
          padding: '1px 5px',
          borderRadius: 3,
          pointerEvents: 'none',
        }}
        transform={false}
        distanceFactor={300}
      >
        🪑 {placement.name}
      </Html>
    </group>
  )
}

/** STL-loaded device geometry. Auto-fits into the HE-box. */
const DeviceSTL = ({
  placement,
  rackDepthMm,
  totalUnits,
  selected,
  onClick,
}: {
  placement: Rack3DPlacement
  rackDepthMm: number
  totalUnits: number
  selected: boolean
  onClick: () => void
}) => {
  if (!placement.stlDataUri) return null
  const geometry = useLoader(STLLoader, placement.stlDataUri)
  const yBottom = (totalUnits - placement.startUnit - placement.rackUnits + 1) * HE_HEIGHT_MM
  const heightMm = placement.rackUnits * HE_HEIGHT_MM
  const widthMm = RACK_MOUNT_WIDTH_MM
  const mountSide = placement.mountSide ?? 'full'
  const depthMm = Math.max(20, placement.depthMm ?? DEFAULT_DEVICE_DEPTH_MM)
  const zStart = mountSide === 'rear' ? rackDepthMm - depthMm : 0

  // Auto-scale STL into the placement-bounding-box.
  const fitted = useMemo(() => {
    const geom = geometry.clone()
    geom.computeBoundingBox()
    const bb = geom.boundingBox!
    const size = new THREE.Vector3()
    bb.getSize(size)
    const scaleX = widthMm / Math.max(0.001, size.x)
    const scaleY = heightMm / Math.max(0.001, size.y)
    const scaleZ = depthMm / Math.max(0.001, size.z)
    const scale = Math.min(scaleX, scaleY, scaleZ) * 0.95
    geom.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, -(bb.max.z + bb.min.z) / 2)
    geom.scale(scale, scale, scale)
    return geom
  }, [geometry, widthMm, heightMm, depthMm])

  const xCenter = (RACK_OUTER_WIDTH_MM - widthMm) / 2 + widthMm / 2
  const yCenter = yBottom + heightMm / 2
  const zCenter = zStart + depthMm / 2

  return (
    <mesh
      geometry={fitted}
      position={[xCenter, yCenter, zCenter]}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <meshStandardMaterial
        color={selected ? '#38bdf8' : '#94a3b8'}
        metalness={0.4}
        roughness={0.6}
      />
    </mesh>
  )
}

export const Rack3DView = ({
  totalUnits,
  rackDepthMm,
  placements,
  selectedPlacementId,
  onSelectPlacement,
}: Rack3DViewProps) => {
  const depthMm = rackDepthMm ?? DEFAULT_RACK_DEPTH_MM
  const orbitRef = useRef<unknown>(null)
  const rackHeightMm = totalUnits * HE_HEIGHT_MM
  // Set initial camera so the rack is fully visible.
  const cameraPos: [number, number, number] = [
    RACK_OUTER_WIDTH_MM * 1.8,
    rackHeightMm * 0.7,
    depthMm * 2.2,
  ]
  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative', background: '#0f172a' }}
      onClick={() => onSelectPlacement(null)}
    >
      <Canvas
        camera={{ position: cameraPos, near: 1, far: 10000, fov: 35 }}
        shadows={false}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[600, 1200, 800]} intensity={0.9} />
        <directionalLight position={[-800, 600, -400]} intensity={0.4} />
        <Chassis totalUnits={totalUnits} depthMm={depthMm} />
        <Suspense fallback={null}>
          {placements.map((p) => {
            if (p.isRackShelf) {
              return (
                <Shelf
                  key={p.id}
                  placement={p}
                  rackDepthMm={depthMm}
                  totalUnits={totalUnits}
                  selected={selectedPlacementId === p.id}
                  onClick={() => onSelectPlacement(p.id)}
                />
              )
            }
            if (p.stlDataUri) {
              return (
                <DeviceSTL
                  key={p.id}
                  placement={p}
                  rackDepthMm={depthMm}
                  totalUnits={totalUnits}
                  selected={selectedPlacementId === p.id}
                  onClick={() => onSelectPlacement(p.id)}
                />
              )
            }
            return (
              <DeviceBox
                key={p.id}
                placement={p}
                rackDepthMm={depthMm}
                totalUnits={totalUnits}
                selected={selectedPlacementId === p.id}
                onClick={() => onSelectPlacement(p.id)}
              />
            )
          })}
        </Suspense>
        <OrbitControls
          ref={orbitRef as never}
          target={[RACK_OUTER_WIDTH_MM / 2, rackHeightMm / 2, depthMm / 2]}
          enablePan
          enableZoom
          enableRotate
          minDistance={150}
          maxDistance={4000}
        />
        <gridHelper
          args={[2000, 20, '#334155', '#1e293b']}
          position={[RACK_OUTER_WIDTH_MM / 2, -1, depthMm / 2]}
        />
      </Canvas>
      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          background: 'rgba(15,23,42,0.85)',
          padding: '6px 8px',
          borderRadius: 4,
          fontSize: 10,
          color: '#cbd5e1',
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: '#64748b', display: 'inline-block' }} /> Full-Depth
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: '#22c55e', display: 'inline-block' }} /> Front-Mount
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: '#a855f7', display: 'inline-block' }} /> Rear-Mount
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: '#38bdf8', display: 'inline-block' }} /> Ausgewählt
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'rgba(15,23,42,0.85)',
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 10,
          color: '#94a3b8',
          pointerEvents: 'none',
        }}
      >
        🖱 Linke Maustaste: drehen · Rechte: pannen · Scroll: zoom
      </div>
    </div>
  )
}
