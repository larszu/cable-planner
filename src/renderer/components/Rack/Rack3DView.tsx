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
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber'
import { OrbitControls, Edges, Html } from '@react-three/drei'
import { STLLoader } from 'three-stdlib'
import * as THREE from 'three'
import { Mouse, Keyboard, Armchair } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { Icon } from '../shared/Icon'
import { useTranslation } from '../../lib/i18n'
import { buildPanelSymbolDataUri, panelSymbolKey } from '../../lib/panelSymbolImage'

const HE_HEIGHT_MM = 44.45
const RACK_OUTER_WIDTH_MM = 482.6
const RACK_MOUNT_WIDTH_MM = 450
const DEFAULT_RACK_DEPTH_MM = 800
const DEFAULT_DEVICE_DEPTH_MM = 400

interface Rack3DPort {
  id: string
  name: string
  connectorType: string
  /** Normalized 0..1 across panel face, or undefined for auto-layout. */
  panelPosX?: number
  panelPosY?: number
}

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
  /** v7.9.77 / #170 — Front + Rear Port-Listen für 3D-Dot-Rendering.
   *  Front entspricht inputs[], Rear entspricht outputs[]. */
  frontPorts?: Rack3DPort[]
  rearPorts?: Rack3DPort[]
  /** v7.9.80 / #170 — Physische Maße in mm für Non-19″-Shelf-Geräte.
   *  Wenn gesetzt, rendert DeviceBox mit diesen Maßen statt der vollen
   *  Rack-Mount-Breite — und positioniert das Gerät zentriert auf dem
   *  Bodenrand der HE-Reihe (= "steht auf dem Shelf darunter"). */
  widthMm?: number
  heightMm?: number
  /** v7.9.82 / #170 — Shelf-Device horizontale Position innerhalb der
   *  Rack-Mount-Breite (mm vom linken Rail). Default 0 = ganz links. */
  shelfOffsetX?: number
  /** v7.9.82 / #170 — Shelf-Device Tiefen-Position (mm von vorne).
   *  Default 0 = ganz vorne. */
  shelfOffsetZ?: number
}

/** v7.9.77 / #170 — Port-Connector-Type → Dot-Farbe. Vereinheitlicht mit
 *  dem 2D-Canvas port-by-type Color-Scheme. */
const PORT_DOT_COLORS: Record<string, string> = {
  BNC: '#fbbf24',
  HDMI: '#a855f7',
  'Ethernet/RJ45': '#10b981',
  Fiber: '#3b82f6',
  SFP: '#06b6d4',
  'SFP+': '#06b6d4',
  XLR: '#ef4444',
  Custom: '#94a3b8',
}

const portDotColor = (connectorType: string): string =>
  PORT_DOT_COLORS[connectorType] ?? '#94a3b8'

/** v7.9.77 / #170 — Default-Port-Position (Grid-Layout) wenn der User
 *  keine manuelle Position gesetzt hat. Ports werden in einer Spalten-
 *  Grid auf der Panel-Face verteilt. Vermeidet Überlapp bei vielen Ports.
 */
const computeDefaultPortPosition = (index: number, total: number): { x: number; y: number } => {
  if (total <= 1) return { x: 0.5, y: 0.5 }
  // Choose column count so layout stays ungefähr square-ish.
  const cols = Math.ceil(Math.sqrt(total * 2.5)) // mehr Spalten als Zeilen weil Panel breit ist
  const rows = Math.ceil(total / cols)
  const col = index % cols
  const row = Math.floor(index / cols)
  return {
    x: (col + 0.5) / cols,
    y: (row + 0.5) / rows,
  }
}

interface Rack3DViewProps {
  totalUnits: number
  rackDepthMm?: number
  placements: Rack3DPlacement[]
  selectedPlacementId: string | null
  onSelectPlacement: (id: string | null) => void
  /** #472 — Steckverbinder-Symbole als Panel-Textur (statt Foto) zeigen. */
  showSymbols?: boolean
  /** v7.9.77 / #170 — Drag-Callback wenn der User einen Port-Dot
   *  verschoben hat. Übergibt placement-id, port-id, side und die neue
   *  normalisierte Position. Lokales State-Tracking während des Drags
   *  passiert intern; Persistierung erst beim Drag-End. */
  onPortMoved?: (
    placementId: string,
    portId: string,
    side: 'front' | 'rear',
    pos: { x: number; y: number },
  ) => void
  /** v7.9.82 / #170 — Shelf-Device Position-Update (horizontale + Tiefen-
   *  Position in mm). Wird vom User per Pointer-Drag direkt auf der Box
   *  im 3D-Tab ausgelöst (Raycast auf die Box, e.point liefert Welt-
   *  Koordinate die wir zurück in mm-Offsets übersetzen). */
  onShelfDeviceMoved?: (
    placementId: string,
    offset: { x: number; z: number },
  ) => void
  /** v7.9.83 / #170 — Snapshot der WebGL-Refs (gl/scene/camera) für den
   *  Export-Pfad. Wird vom CanvasRefsCapture innerhalb von <Canvas>
   *  beim ersten Frame befüllt und an den Caller weitergegeben, sodass
   *  exportRack3DAsPngs() von außen auf die Szene zugreifen kann. */
  onCanvasRefsReady?: (refs: {
    gl: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
  }) => void
  /** v7.9.78 / #170 — Internal Cables zwischen Patchpunkten. */
  internalCables?: Array<{
    fromPlacementId: string
    fromPortId: string
    fromSide: 'front' | 'rear'
    toPlacementId: string
    toPortId: string
    toSide: 'front' | 'rear'
    color?: string
  }>
}

const Chassis = ({
  totalUnits,
  depthMm,
  isLight,
}: {
  totalUnits: number
  depthMm: number
  isLight: boolean
}) => {
  const heightMm = totalUnits * HE_HEIGHT_MM
  // v7.9.81 — Theme-Awareness: helles Rack-Chassis im Light-Mode (graue
  // Töne mit höherer Helligkeit), klassisches Dark-Chassis im Dark-Mode.
  const chassisColor = isLight ? '#94a3b8' : '#1f2937'
  const railColor = isLight ? '#64748b' : '#475569'
  return (
    <group>
      {/* Boden */}
      <mesh position={[RACK_OUTER_WIDTH_MM / 2, 0, depthMm / 2]} receiveShadow>
        <boxGeometry args={[RACK_OUTER_WIDTH_MM, 4, depthMm]} />
        <meshStandardMaterial color={chassisColor} opacity={0.9} transparent />
      </mesh>
      {/* Linke Wand */}
      <mesh position={[2, heightMm / 2, depthMm / 2]}>
        <boxGeometry args={[4, heightMm, depthMm]} />
        <meshStandardMaterial color={chassisColor} opacity={0.4} transparent />
      </mesh>
      {/* Rechte Wand */}
      <mesh position={[RACK_OUTER_WIDTH_MM - 2, heightMm / 2, depthMm / 2]}>
        <boxGeometry args={[4, heightMm, depthMm]} />
        <meshStandardMaterial color={chassisColor} opacity={0.4} transparent />
      </mesh>
      {/* Decke */}
      <mesh position={[RACK_OUTER_WIDTH_MM / 2, heightMm, depthMm / 2]}>
        <boxGeometry args={[RACK_OUTER_WIDTH_MM, 4, depthMm]} />
        <meshStandardMaterial color={chassisColor} opacity={0.4} transparent />
      </mesh>
      {/* HE-Markierungen an der linken Schiene */}
      {Array.from({ length: totalUnits + 1 }, (_, i) => (
        <mesh key={i} position={[16, i * HE_HEIGHT_MM, 1]}>
          <boxGeometry args={[2, 0.6, 2]} />
          <meshStandardMaterial color={railColor} />
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Textur für die URL laden/leeren (asynchrone Ressource)
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
  siblings,
  rackDepthMm,
  totalUnits,
  selected,
  showSymbols,
  onClick,
  onPortMoved,
  onShelfDeviceMoved,
  orbitRef,
}: {
  placement: Rack3DPlacement
  /** #506 — alle Placements (für Soft-Snap an Geschwister-Geräte im 3D-Drag). */
  siblings?: Rack3DPlacement[]
  rackDepthMm: number
  totalUnits: number
  selected: boolean
  showSymbols?: boolean
  onClick: () => void
  onPortMoved?: Rack3DViewProps['onPortMoved']
  onShelfDeviceMoved?: Rack3DViewProps['onShelfDeviceMoved']
  /** v7.9.82 — Ref auf OrbitControls, damit wir bei Shelf-Drag das
   *  Kamera-Drehen kurz deaktivieren können (sonst dreht/pannt der
   *  Drag gleichzeitig die Kamera, schlimmes UX). */
  orbitRef?: React.RefObject<{ enabled: boolean } | null>
}) => {
  // v7.9.82 / #170 — Shelf-Device-Drag-State. Solange aktiv: pointer-
  // move-events auf der Mesh übersetzen e.point (World-Hit auf die Box-
  // Geometrie) zurück in mm-Offsets innerhalb des Racks.
  const shelfDragRef = useRef<{ pointerId: number; offsetX: number; offsetZ: number } | null>(null)
  const [shelfDragOverride, setShelfDragOverride] = useState<{ x: number; z: number } | null>(null)
  const mountSide = placement.mountSide ?? 'full'
  const depthMm = Math.max(20, placement.depthMm ?? DEFAULT_DEVICE_DEPTH_MM)
  const yBottom = (totalUnits - placement.startUnit - placement.rackUnits + 1) * HE_HEIGHT_MM
  // v7.9.80 / #170 — Wenn das Template eigene mm-Maße trägt (Shelf-
  // Device), nehmen wir die statt der HE × Rack-Mount-Breite. Geräte
  // sitzen dann zentriert auf dem unteren Bodenrand der HE-Reihe
  // (dort wo das Shelf liegt). Klassische Rack-Geräte: HE × volle Breite.
  const isShelfDevice = !!(placement.widthMm && placement.heightMm)
  const heightMm = isShelfDevice
    ? Math.min(placement.heightMm!, placement.rackUnits * HE_HEIGHT_MM)
    : placement.rackUnits * HE_HEIGHT_MM
  const widthMm = isShelfDevice
    ? Math.min(placement.widthMm!, RACK_MOUNT_WIDTH_MM)
    : RACK_MOUNT_WIDTH_MM

  // v7.9.82 / #170 — Shelf-Devices nutzen zusätzlich shelfOffsetX (mm
  // vom linken Rail) und shelfOffsetZ (mm von der Front) — beide vom
  // User per Drag / Number-Input gesetzt. Bei klassischen Rack-Geräten
  // sind die Offsets undefined → zentriert/vorne wie bisher.
  // Während eines aktiven Drags hat shelfDragOverride Vorrang (smooth
  // live-Render).
  const railInnerOffset = (RACK_OUTER_WIDTH_MM - RACK_MOUNT_WIDTH_MM) / 2
  const effectiveShelfX = shelfDragOverride?.x ?? placement.shelfOffsetX ?? 0
  const effectiveShelfZ = shelfDragOverride?.z ?? placement.shelfOffsetZ ?? 0
  const xLeftBase = isShelfDevice
    ? railInnerOffset + effectiveShelfX
    : (RACK_OUTER_WIDTH_MM - widthMm) / 2
  // #521(c2) — Tiefen-Positionierung (shelfOffsetZ) auch für KLASSISCHE Rack-
  // Geräte respektieren, nicht nur Shelf-Devices. Vorher war ein klassisches
  // Gerät in Z auf Front (z=0) bzw. Rückwand (mountSide='rear') festgenagelt —
  // freie Zwischen-Tiefen waren nicht möglich ("Z nur auf der 1-RU-Ebene").
  // Ohne gesetzten Offset bleibt das Default-Verhalten exakt erhalten.
  const hasZOffset = shelfDragOverride?.z != null || placement.shelfOffsetZ != null
  const zStart = isShelfDevice
    ? effectiveShelfZ
    : hasZOffset
      ? Math.max(0, Math.min(effectiveShelfZ, rackDepthMm - depthMm))
      : mountSide === 'rear'
        ? rackDepthMm - depthMm
        : 0
  const xCenter = xLeftBase + widthMm / 2
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

  // #472 — Steckverbinder-Symbole als Panel-Bild (Frontblende) statt Foto,
  // wenn aktiviert. Memoisiert über Port-Position/-Typ, damit nicht jedes
  // Re-Render neu gerastert wird.
  const frontKey = panelSymbolKey(placement.frontPorts ?? [])
  const rearKey = panelSymbolKey(placement.rearPorts ?? [])
  const frontSymUri = useMemo(
    () => (showSymbols ? buildPanelSymbolDataUri(placement.frontPorts ?? [], widthMm / heightMm) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showSymbols, frontKey, widthMm, heightMm],
  )
  const rearSymUri = useMemo(
    () => (showSymbols ? buildPanelSymbolDataUri(placement.rearPorts ?? [], widthMm / heightMm) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showSymbols, rearKey, widthMm, heightMm],
  )
  const frontTex = useImageTexture(frontSymUri ?? placement.frontPanelImageUrl)
  const rearTex = useImageTexture(rearSymUri ?? placement.rearPanelImageUrl)

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
        // v7.9.82 / #170 — Shelf-Drag im 3D: Pointer-Down speichert den
        // Maus-Offset relativ zur aktuellen Mesh-Position. Move-Events
        // berechnen daraus die neue Welt-Position und konvertieren in
        // shelfOffsetX/Z (mm). Up persistiert via onShelfDeviceMoved.
        // Nicht-Shelf-Geräte ignorieren die Drag-Events (kein onShelfDeviceMoved).
        onPointerDown={(e) => {
          if (!isShelfDevice || !onShelfDeviceMoved) return
          e.stopPropagation()
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
          // v7.9.82 — OrbitControls aus, damit der gleiche Pointer-Drag
          // nicht zusätzlich die Kamera dreht.
          if (orbitRef?.current) orbitRef.current.enabled = false
          // #517 — Die Rack-Szene wird per <group scale-x=−1> gespiegelt.
          // e.point ist WORLD-Space; xCenter/zCenter sind LOCAL. Die X-Achse
          // muss daher von world→local zurückgerechnet werden (world_x =
          // RACK_OUTER_WIDTH_MM − local_x), sonst läuft der Drag invertiert
          // zum Cursor. Z ist von der X-Spiegelung unberührt.
          const hitX = RACK_OUTER_WIDTH_MM - e.point.x
          const hitZ = e.point.z
          shelfDragRef.current = {
            pointerId: e.pointerId,
            offsetX: hitX - xCenter,
            offsetZ: hitZ - zCenter,
          }
        }}
        onPointerMove={(e) => {
          const drag = shelfDragRef.current
          if (!drag || drag.pointerId !== e.pointerId) return
          if (!isShelfDevice) return
          // #517 — world→local für X (siehe onPointerDown), Z unverändert.
          const newCenterX = (RACK_OUTER_WIDTH_MM - e.point.x) - drag.offsetX
          const newCenterZ = e.point.z - drag.offsetZ
          // Center → linke Vorderkante zurück
          const newLeftX = newCenterX - widthMm / 2
          const newZ = newCenterZ - depthMm / 2
          // Klemmen auf rack-internen Bereich
          const newOffsetX = Math.max(
            0,
            Math.min(RACK_MOUNT_WIDTH_MM - widthMm, newLeftX - railInnerOffset),
          )
          const newOffsetZ = Math.max(0, Math.min(rackDepthMm - depthMm, newZ))
          // #506 — Soft edge-snap an andere Shelf-Devices mit überlappendem
          // HE-Bereich (wie im 2D-Builder, Threshold ~5 mm): Kanten bündig /
          // direkt aneinander andocken.
          let snappedX = newOffsetX
          const SNAP_MM = 5
          const myStart = placement.startUnit
          const myEnd = placement.startUnit + placement.rackUnits
          const candidates = [0, RACK_MOUNT_WIDTH_MM - widthMm]
          for (const other of siblings ?? []) {
            if (other.id === placement.id || !other.widthMm) continue
            if (myEnd <= other.startUnit || other.startUnit + other.rackUnits <= myStart) continue
            const oLeft = other.shelfOffsetX ?? 0
            const oRight = oLeft + other.widthMm
            candidates.push(oLeft, oRight, oLeft - widthMm, oRight - widthMm)
          }
          let bestDelta = SNAP_MM
          for (const target of candidates) {
            const clamped = Math.max(0, Math.min(RACK_MOUNT_WIDTH_MM - widthMm, target))
            const d = Math.abs(newOffsetX - clamped)
            if (d < bestDelta) {
              bestDelta = d
              snappedX = clamped
            }
          }
          setShelfDragOverride({ x: snappedX, z: newOffsetZ })
        }}
        onPointerUp={(e) => {
          const drag = shelfDragRef.current
          if (!drag) return
          ;(e.target as Element).releasePointerCapture?.(e.pointerId)
          if (shelfDragOverride && onShelfDeviceMoved) {
            onShelfDeviceMoved(placement.id, shelfDragOverride)
          }
          shelfDragRef.current = null
          setShelfDragOverride(null)
          // OrbitControls wieder an
          if (orbitRef?.current) orbitRef.current.enabled = true
        }}
      >
        <boxGeometry args={[widthMm, heightMm, depthMm]} />
        <Edges color={selected ? '#0ea5e9' : '#020617'} threshold={15} />
      </mesh>
      {/* v7.9.77 / #170 — Port-Dots auf Front-Face (-Z) und Rear-Face (+Z).
          Werden minimal nach außen versetzt (zOffset ±1 mm) damit sie
          immer vor dem Panel-Foto sichtbar bleiben. */}
      {placement.frontPorts && placement.frontPorts.length > 0 && (
        <PortDots
          ports={placement.frontPorts}
          side="front"
          placementId={placement.id}
          faceCenter={[xCenter, yCenter, zStart - 1]}
          widthMm={widthMm * 0.95}
          heightMm={heightMm * 0.85}
          zOffset={0}
          onPortMoved={onPortMoved}
          orbitRef={orbitRef}
        />
      )}
      {placement.rearPorts && placement.rearPorts.length > 0 && (
        <PortDots
          ports={placement.rearPorts}
          side="rear"
          placementId={placement.id}
          faceCenter={[xCenter, yCenter, zStart + depthMm + 1]}
          widthMm={widthMm * 0.95}
          heightMm={heightMm * 0.85}
          zOffset={0}
          onPortMoved={onPortMoved}
          orbitRef={orbitRef}
        />
      )}
      {/* v7.9.82 / #170 — Gerätenamen jetzt SOWOHL vorne als auch hinten,
          damit der User aus jeder Orbit-Richtung lesen kann welches Gerät
          er anschaut. Ohne Doppellabel war beim Drehen-um-180° die
          Beschriftung weg. */}
      <Html
        position={[xCenter, yCenter, zStart - 5]}
        center
        style={{
          color: '#e2e8f0',
          fontSize: 10,
          background: 'rgba(15,23,42,0.78)',
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
      <Html
        position={[xCenter, yCenter, zStart + depthMm + 5]}
        center
        style={{
          color: '#e2e8f0',
          fontSize: 10,
          background: 'rgba(15,23,42,0.78)',
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

/** v7.9.77 / #170 — Port-Dots auf einer Panel-Face (Front oder Rear).
 *  Rendert kleine Kugeln, deren Position normiert auf der Face liegt.
 *
 *  v7.9.95-Fix: Drag arbeitet jetzt mit echter Ray-Plane-Intersection.
 *  Der alte Code las e.point während des Pointer-Captures — das ist
 *  unzuverlässig, weil der Raycaster dann den Dot selbst trifft (auf
 *  seiner Position VOR dem Move) und das Ergebnis stale ist. Außerdem
 *  hat der alte Code keinen Grip-Offset gespeichert → der Dot sprang
 *  beim ersten Move auf die Cursor-Position statt unter dem Greifpunkt
 *  zu bleiben.
 *
 *  Neu:
 *   - useThree() liefert camera + pointer (Live-NDC)
 *   - Eine virtuelle Plane bei faceCenter mit Normale ±Z dient als Drag-
 *     Surface (Camera-Winkel-unabhängig)
 *   - Pointer-Down speichert (a) die initiale Dot-Position und (b) den
 *     initialen face-lokalen Hit → das Delta wird relativ zu beidem
 *     berechnet → glatter Drag, kein Initial-Jump
 *
 *  Face-Koordinaten:
 *   - Face liegt in der XY-Ebene des Geräts (W × H)
 *   - x ∈ [0..1] mappt auf widthMm
 *   - y ∈ [0..1] mappt auf heightMm
 *   - z = 0 (auf der Face) — wir lupen die Dots minimal nach außen
 *     damit sie auf dem Foto sichtbar sind (zOffset = +0.5 mm)
 */
const PortDots = ({
  ports,
  side,
  placementId,
  faceCenter,
  widthMm,
  heightMm,
  zOffset,
  onPortMoved,
  orbitRef,
}: {
  ports: Rack3DPort[]
  side: 'front' | 'rear'
  placementId: string
  faceCenter: [number, number, number] // world center of the face plane
  widthMm: number
  heightMm: number
  /** Outward offset from face center along normal (positive = outside-of-box). */
  zOffset: number
  onPortMoved?: Rack3DViewProps['onPortMoved']
  /** v7.9.87 / #209 — OrbitControls-Ref damit der Drag eines Port-Dots
   *  die Kamera nicht gleichzeitig dreht (war vorher das gleiche
   *  Problem wie beim Shelf-Drag — Pointer-Down löste BOTH OrbitControls-
   *  und Dot-Drag aus). */
  orbitRef?: React.RefObject<{ enabled: boolean } | null>
}) => {
  const { camera, pointer } = useThree()

  // Während eines Drags speichern wir lokal die neue Position, damit der
  // Dot beim Slide live folgt (statt erst nach Drop neu zu rendern).
  const [dragOverride, setDragOverride] = useState<{ id: string; x: number; y: number } | null>(null)
  // Drag-State mit Grip-Offset: startNx/startNy sind die normalisierten
  // Dot-Koordinaten zum Greif-Zeitpunkt, grabFaceX/grabFaceY der Face-
  // lokale Hit der Maus zu diesem Moment. Während des Drags berechnen
  // wir Delta-Bewegungen relativ zu diesen Anfangswerten.
  const draggingRef = useRef<{
    id: string
    pointerId: number
    startNx: number
    startNy: number
    grabFaceX: number
    grabFaceY: number
  } | null>(null)
  const meshRefs = useRef<Map<string, THREE.Mesh>>(new Map())

  // Wiederverwendbare Three-Helper damit pro Frame kein new Vector3 anfällt.
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const facePlane = useMemo(() => new THREE.Plane(), [])
  const hitPoint = useMemo(() => new THREE.Vector3(), [])
  const faceNormal = useMemo(
    () => new THREE.Vector3(0, 0, side === 'front' ? -1 : 1),
    [side],
  )

  /** Aktuelle Cursor-Position in face-lokalen Koordinaten (x, y relativ
   *  zum faceCenter, in mm). Macht einen frischen Raycast gegen die
   *  Face-Ebene — funktioniert auch wenn der Cursor gerade kein Mesh
   *  trifft. Liefert null wenn der Strahl parallel zur Ebene ist
   *  (theoretisch unmöglich bei normaler Kamera-Pose). */
  const cursorFaceHit = (): { x: number; y: number } | null => {
    facePlane.setFromNormalAndCoplanarPoint(
      faceNormal,
      hitPoint.set(faceCenter[0], faceCenter[1], faceCenter[2]),
    )
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.ray.intersectPlane(facePlane, hitPoint)
    if (!hit) return null
    // #517 — Szene per <group scale-x=−1> gespiegelt: hit.x ist WORLD,
    // faceCenter LOCAL. X von world→local zurückrechnen, sonst läuft der
    // Port-Dot-Drag horizontal invertiert. Y/Z sind unberührt.
    const localHitX = RACK_OUTER_WIDTH_MM - hit.x
    return { x: localHitX - faceCenter[0], y: hit.y - faceCenter[1] }
  }

  // Sichere Höhe für Dot-Geometrie: ~6mm Radius, aber max 1/3 der HE-Höhe
  // damit sie bei kleinen 1HE-Boxen nicht den ganzen Bereich überdecken.
  const dotRadius = Math.min(6, heightMm * 0.18)

  return (
    <group>
      {ports.map((port, idx) => {
        const override = dragOverride?.id === port.id ? dragOverride : null
        const px = override?.x ?? port.panelPosX ?? computeDefaultPortPosition(idx, ports.length).x
        const py = override?.y ?? port.panelPosY ?? computeDefaultPortPosition(idx, ports.length).y
        // Face-X: 0..1 → -widthMm/2 .. +widthMm/2 (in face local space).
        // Y wird invertiert (oben=0 fühlt sich natürlicher an): py=0 → +heightMm/2.
        const faceX = (px - 0.5) * widthMm
        const faceY = (0.5 - py) * heightMm
        // World: faceCenter ist bereits world-position. Für Front (-Z normal)
        // schieben wir den Dot in -Z Richtung (zOffset negativ); für Rear
        // in +Z. Der zOffset-Param trägt das schon vorzeichenrichtig.
        const worldX = faceCenter[0] + faceX
        const worldY = faceCenter[1] + faceY
        const worldZ = faceCenter[2] + zOffset
        return (
          <mesh
            key={port.id}
            ref={(m) => {
              if (m) meshRefs.current.set(port.id, m)
              else meshRefs.current.delete(port.id)
            }}
            position={[worldX, worldY, worldZ]}
            onPointerDown={(e) => {
              if (!onPortMoved) return
              e.stopPropagation()
              ;(e.target as Element).setPointerCapture?.(e.pointerId)
              // v7.9.87 / #209 — OrbitControls aus, damit der Drag eines
              // Port-Dots die Kamera nicht gleichzeitig dreht.
              if (orbitRef?.current) orbitRef.current.enabled = false
              // Greif-Position auf der Face merken. Falls (unwahrscheinlich)
              // der Raycast die Plane nicht trifft, fallen wir auf die
              // Dot-Position selbst zurück — dann verhält sich der Drag wie
              // im alten Modell (snap-to-cursor).
              const hit = cursorFaceHit() ?? { x: faceX, y: faceY }
              draggingRef.current = {
                id: port.id,
                pointerId: e.pointerId,
                startNx: px,
                startNy: py,
                grabFaceX: hit.x,
                grabFaceY: hit.y,
              }
            }}
            onPointerMove={(e) => {
              const drag = draggingRef.current
              if (!drag || drag.id !== port.id || drag.pointerId !== e.pointerId) return
              const hit = cursorFaceHit()
              if (!hit) return
              const dx = hit.x - drag.grabFaceX
              const dy = hit.y - drag.grabFaceY
              const newNx = Math.max(0, Math.min(1, drag.startNx + dx / widthMm))
              // Y ist invertiert: positive Welt-Y heißt nach oben heißt
              // kleinere normalisierte Y (py=0 oben).
              const newNy = Math.max(0, Math.min(1, drag.startNy - dy / heightMm))
              setDragOverride({ id: port.id, x: newNx, y: newNy })
            }}
            onPointerUp={(e) => {
              const drag = draggingRef.current
              if (!drag || drag.id !== port.id) return
              ;(e.target as Element).releasePointerCapture?.(e.pointerId)
              const override = dragOverride?.id === port.id ? dragOverride : null
              if (override && onPortMoved) {
                onPortMoved(placementId, port.id, side, { x: override.x, y: override.y })
              }
              draggingRef.current = null
              setDragOverride(null)
              // OrbitControls wieder an.
              if (orbitRef?.current) orbitRef.current.enabled = true
            }}
          >
            <sphereGeometry args={[dotRadius, 12, 12]} />
            <meshStandardMaterial
              color={portDotColor(port.connectorType)}
              emissive={portDotColor(port.connectorType)}
              emissiveIntensity={0.3}
              roughness={0.4}
              metalness={0.5}
            />
          </mesh>
        )
      })}
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
        <Icon icon={Armchair} size="xs" className="mr-1 inline-block align-text-bottom" />{placement.name}
      </Html>
    </group>
  )
}

/** STL-loaded device geometry. Auto-fits into the HE-box. */
type DeviceSTLProps = {
  placement: Rack3DPlacement
  rackDepthMm: number
  totalUnits: number
  selected: boolean
  onClick: () => void
}

// Rules of Hooks: useLoader/useMemo duerfen NICHT hinter dem `return null`
// stehen — beim Umschalten von "kein STL" zu "STL" (oder Geraetewechsel)
// aendert sich sonst die Hook-Anzahl ("Rendered more hooks than..."). Loesung:
// die Hooks in eine innere Komponente, die nur gerendert wird wenn die
// stlDataUri existiert. useLoader bekommt damit immer eine gueltige URL.
const DeviceSTL = (props: DeviceSTLProps) => {
  if (!props.placement.stlDataUri) return null
  return <DeviceSTLMesh {...props} stlDataUri={props.placement.stlDataUri} />
}

const DeviceSTLMesh = ({
  placement,
  rackDepthMm,
  totalUnits,
  selected,
  onClick,
  stlDataUri,
}: DeviceSTLProps & { stlDataUri: string }) => {
  const geometry = useLoader(STLLoader, stlDataUri)
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

/** v7.9.83 / #170 — Capture-Helper innerhalb <Canvas>. Liefert die
 *  three.js Refs (gl/scene/camera) per Effect an den Caller. */
const CanvasRefsCapture = ({
  onReady,
}: {
  onReady?: (refs: {
    gl: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
  }) => void
}) => {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    if (onReady && camera instanceof THREE.PerspectiveCamera) {
      onReady({ gl, scene, camera })
    }
  }, [gl, scene, camera, onReady])
  return null
}

/** v7.9.82 / #170 — Keyboard-Camera-Controller. Shift hält → Kamera
 *  (+ OrbitControls.target) fährt nach oben; Leertaste → nach unten.
 *  (v7.9.80 hatte Tab vorgesehen — war ungünstig weil Tab Browser-
 *  Default = Focus-Switch ist. Space ist intuitiver.) */
const CameraKeyboardController = ({
  orbitTargetRef,
}: {
  orbitTargetRef: React.RefObject<{ target: THREE.Vector3; update: () => void } | null>
}) => {
  const { camera } = useThree()
  const keys = useRef({ shift: false, space: false })
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Nicht capturen wenn der Fokus in einem Input/Textarea ist —
      // sonst killt Shift Text-Selektion und Space würde im Properties-
      // Panel die Eingabe stören.
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'Shift') keys.current.shift = true
      if (e.key === ' ' || e.code === 'Space') {
        keys.current.space = true
        e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') keys.current.shift = false
      if (e.key === ' ' || e.code === 'Space') keys.current.space = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])
  // R3F runs useFrame in the three.js render loop, where mutating the camera /
  // orbit target each frame is the idiomatic imperative pattern — the compiler's
  // immutability model doesn't apply to that loop.
  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    if (!keys.current.shift && !keys.current.space) return
    const speed = 800 * delta
    const dy = keys.current.shift ? speed : -speed
    camera.position.y += dy
    if (orbitTargetRef.current?.target) {
      orbitTargetRef.current.target.y += dy
      orbitTargetRef.current.update?.()
    }
  })
  /* eslint-enable react-hooks/immutability */
  return null
}

/** v7.9.78 / #170 — Rack-interne Verkabelung als 3D-Linien. Berechnet
 *  pro Cable die Welt-Position des From- und To-Ports, baut eine
 *  BufferGeometry mit 2 (oder mehr für Kurven) Punkten und rendert sie
 *  als <line>. Farbe aus cable.color oder Connector-Default.
 */
const InternalCables3D = ({
  placements,
  totalUnits,
  rackDepthMm,
  cables,
}: {
  placements: Rack3DPlacement[]
  totalUnits: number
  rackDepthMm: number
  cables: NonNullable<Rack3DViewProps['internalCables']>
}) => {
  // Helper: berechne World-Position eines bestimmten Port-Dots auf einer
  // Face. Identisch zur PortDots-Mathe; dupliziert hier weil wir die
  // Position OHNE Mesh-Render brauchen.
  const portWorldPos = (
    placement: Rack3DPlacement,
    portId: string,
    side: 'front' | 'rear',
  ): THREE.Vector3 | null => {
    const ports = side === 'front' ? placement.frontPorts : placement.rearPorts
    if (!ports) return null
    const idx = ports.findIndex((p) => p.id === portId)
    if (idx < 0) return null
    const p = ports[idx]
    const depthMm = Math.max(20, placement.depthMm ?? DEFAULT_DEVICE_DEPTH_MM)
    const mountSide = placement.mountSide ?? 'full'
    const yBottom = (totalUnits - placement.startUnit - placement.rackUnits + 1) * HE_HEIGHT_MM
    const heightMm = placement.rackUnits * HE_HEIGHT_MM
    const widthMm = RACK_MOUNT_WIDTH_MM * 0.95
    const heightActiveMm = heightMm * 0.85
    const zStart = mountSide === 'rear' ? rackDepthMm - depthMm : 0
    const xCenter = RACK_OUTER_WIDTH_MM / 2
    const yCenter = yBottom + heightMm / 2
    const faceZ = side === 'front' ? zStart - 1 : zStart + depthMm + 1
    const px = p.panelPosX ?? computeDefaultPortPosition(idx, ports.length).x
    const py = p.panelPosY ?? computeDefaultPortPosition(idx, ports.length).y
    const faceX = (px - 0.5) * widthMm
    const faceY = (0.5 - py) * heightActiveMm
    return new THREE.Vector3(xCenter + faceX, yCenter + faceY, faceZ)
  }

  return (
    <group>
      {cables.map((c, idx) => {
        const fromPl = placements.find((p) => p.id === c.fromPlacementId)
        const toPl = placements.find((p) => p.id === c.toPlacementId)
        if (!fromPl || !toPl) return null
        const fromPos = portWorldPos(fromPl, c.fromPortId, c.fromSide)
        const toPos = portWorldPos(toPl, c.toPortId, c.toSide)
        if (!fromPos || !toPos) return null
        // Kurze Out-of-Face-Strecke (Stub) damit das Kabel nicht direkt
        // im Port verschwindet. 30mm außerhalb der Face entlang Normal.
        const stubLen = 30
        const fromStub = fromPos.clone()
        fromStub.z += c.fromSide === 'front' ? -stubLen : stubLen
        const toStub = toPos.clone()
        toStub.z += c.toSide === 'front' ? -stubLen : stubLen
        const points = [fromPos, fromStub, toStub, toPos]
        const geom = new THREE.BufferGeometry().setFromPoints(points)
        const color = c.color ?? '#22d3ee'
        return (
          <primitive key={`${c.fromPlacementId}-${c.fromPortId}-${idx}`} object={
            new THREE.Line(
              geom,
              new THREE.LineBasicMaterial({ color, linewidth: 2 }),
            )
          } />
        )
      })}
    </group>
  )
}

export const Rack3DView = ({
  totalUnits,
  rackDepthMm,
  placements,
  selectedPlacementId,
  onSelectPlacement,
  onPortMoved,
  onShelfDeviceMoved,
  onCanvasRefsReady,
  internalCables,
  showSymbols,
}: Rack3DViewProps) => {
  const t = useTranslation()
  // v7.9.81 — Theme-Awareness: 3D-Hintergrund + Help-Overlay-Farben
  // folgen jetzt dem globalen canvasTheme.
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  const isLight = canvasTheme === 'light'
  const bgColor = isLight ? '#e2e8f0' : '#0f172a'
  const overlayBg = isLight ? 'rgba(248,250,252,0.92)' : 'rgba(15,23,42,0.85)'
  const overlayText = isLight ? '#334155' : '#94a3b8'
  const overlayLegendText = isLight ? '#475569' : '#cbd5e1'
  const kbdBg = isLight ? '#cbd5e1' : '#1e293b'
  const depthMm = rackDepthMm ?? DEFAULT_RACK_DEPTH_MM
  // v7.9.80 / #170 — OrbitControls ref für den CameraKeyboardController:
  // wir mutieren controls.target.y zusammen mit camera.y, sonst tilted
  // die Kamera statt zu pannen.
  // v7.9.82 / #170 — Plus 'enabled'-Toggle (Shelf-Drag schaltet
  // OrbitControls kurz aus damit Pointer-Drag nicht gleichzeitig die
  // Kamera dreht).
  const orbitRef = useRef<{ target: THREE.Vector3; update: () => void; enabled: boolean } | null>(null)
  const rackHeightMm = totalUnits * HE_HEIGHT_MM
  // Set initial camera so the rack is fully visible.
  // #506 — Kamera VOR das Rack (−Z): die Frontblenden zeigen nach −Z. Vorher
  // stand sie auf +Z (hinter dem Rack) → man sah die Rückseite und die
  // Frontansicht war links/rechts spiegelverkehrt zur 2D-Front-Ansicht.
  const cameraPos: [number, number, number] = [
    RACK_OUTER_WIDTH_MM * 1.8,
    rackHeightMm * 0.7,
    -depthMm * 2.2,
  ]
  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative', background: bgColor }}
      onClick={() => onSelectPlacement(null)}
    >
      <Canvas
        camera={{ position: cameraPos, near: 1, far: 10000, fov: 35 }}
        shadows={false}
        // v7.9.83 / #170 — preserveDrawingBuffer: WebGL-Canvas behält
        // gerendertes Frame im Buffer damit toBlob() / toDataURL()
        // funktionieren (für die 3D-PNG-Export-Funktion).
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <CanvasRefsCapture onReady={onCanvasRefsReady} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[600, 1200, 800]} intensity={0.9} />
        <directionalLight position={[-800, 600, -400]} intensity={0.4} />
        {/* #517 — Die Frontblenden zeigen nach −Z; mit der #506-Kamera (vor
            dem Rack) bildete world+X auf Bildschirm-LINKS ab → die 3D-Front
            war links/rechts gespiegelt gegenüber der 2D-Front-Ansicht
            (deterministisch über die Projektionsmatrix nachgewiesen). Statt
            an jeder X-Koordinate einzeln zu spiegeln, spiegeln wir die GESAMTE
            Rack-Szene an der vertikalen Mittelachse: group bei x=W + scale-x=−1
            ⇒ jedes world-x wird zu (W − x). Geräte, Port-Dots, Hitboxen und
            interne Kabel bleiben dadurch zueinander konsistent. Labels sind
            <Html> (DOM-Overlay) und bleiben aufrecht/lesbar. Kamera +
            OrbitControls liegen bewusst AUSSERHALB dieser Gruppe, damit die
            Steuerung nicht mitspiegelt. */}
        <group scale={[-1, 1, 1]} position={[RACK_OUTER_WIDTH_MM, 0, 0]}>
        <Chassis totalUnits={totalUnits} depthMm={depthMm} isLight={isLight} />
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
                siblings={placements}
                rackDepthMm={depthMm}
                totalUnits={totalUnits}
                selected={selectedPlacementId === p.id}
                showSymbols={showSymbols}
                onClick={() => onSelectPlacement(p.id)}
                onPortMoved={onPortMoved}
                onShelfDeviceMoved={onShelfDeviceMoved}
                orbitRef={orbitRef as React.RefObject<{ enabled: boolean } | null>}
              />
            )
          })}
          {/* v7.9.78 / #170 — Rack-interne Verkabelung als Linien zwischen
              den jeweiligen Port-Dots. Vereinfachte gerade Linie — wer
              schöne Routing-Kurven will, kann später CatmullRomCurve3
              dazwischen ziehen. */}
          <InternalCables3D
            placements={placements}
            totalUnits={totalUnits}
            rackDepthMm={depthMm}
            cables={internalCables ?? []}
          />
        </Suspense>
        </group>
        <OrbitControls
          ref={orbitRef as never}
          target={[RACK_OUTER_WIDTH_MM / 2, rackHeightMm / 2, depthMm / 2]}
          enablePan
          enableZoom
          enableRotate
          minDistance={150}
          maxDistance={4000}
        />
        <CameraKeyboardController orbitTargetRef={orbitRef} />
        <gridHelper
          args={[
            2000,
            20,
            isLight ? '#94a3b8' : '#334155',
            isLight ? '#cbd5e1' : '#1e293b',
          ]}
          position={[RACK_OUTER_WIDTH_MM / 2, -1, depthMm / 2]}
        />
      </Canvas>
      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          background: overlayBg,
          padding: '6px 8px',
          borderRadius: 4,
          fontSize: 10,
          color: overlayLegendText,
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: '#64748b', display: 'inline-block' }} /> {t('rack3d.legend.fullDepth', 'Full-Depth')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: '#22c55e', display: 'inline-block' }} /> {t('rack3d.legend.frontMount', 'Front-Mount')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: '#a855f7', display: 'inline-block' }} /> {t('rack3d.legend.rearMount', 'Rear-Mount')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: '#38bdf8', display: 'inline-block' }} /> {t('rack3d.legend.selected', 'Ausgewählt')}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: overlayBg,
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 10,
          color: overlayText,
          pointerEvents: 'none',
          lineHeight: 1.4,
        }}
      >
        <Icon icon={Mouse} size="xs" className="mr-1 inline-block align-text-bottom" />{t('rack3d.help.mouse', 'Drehen: links · Pannen: rechts · Zoom: scroll')}<br />
        <Icon icon={Keyboard} size="xs" className="mr-1 inline-block align-text-bottom" />{t('rack3d.help.heightLabel', 'Höhe:')} <kbd style={{ background: kbdBg, padding: '0 3px', borderRadius: 2 }}>Shift</kbd> {t('rack3d.help.up', 'hoch')} · <kbd style={{ background: kbdBg, padding: '0 3px', borderRadius: 2 }}>Space</kbd> {t('rack3d.help.down', 'runter')}
      </div>
    </div>
  )
}
