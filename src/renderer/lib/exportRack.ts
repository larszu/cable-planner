/**
 * v7.9.83 / #170 — Rack-Export-Pipeline.
 *
 * Vier Export-Modi für den Rack-Builder:
 *  1. 2D-PNG    — html-to-image Capture des aktuell sichtbaren 2D-Panels
 *  2. 3D-PNG    — canvas.toBlob() vom three.js Canvas, optional aus mehreren
 *                 vordefinierten Perspektiven gleichzeitig (Front / Rear /
 *                 Iso / Top) als getrennte Dateien
 *  3. 3D-STL    — STLExporter aus three-stdlib durch die r3f-Szene
 *  4. .cpgroup  — JSON-Dump des GroupPreset mit allen inline-base64-Assets
 *                 (STL, Panel-Fotos), portierbar zwischen Rechnern
 *
 * Alle Exporte triggern automatisch einen Browser-Download via
 * downloadBlob-Helper.
 */
import { toPng } from 'html-to-image'
import * as THREE from 'three'
import { STLExporter } from 'three-stdlib'
import { buildExportFilenameWithSuffix } from './exportFilename'

const downloadFile = (filename: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}

// v7.9.116 — sanitizeFilename entfernt, buildExportFilename uebernimmt das.

// ── 1) 2D Rack-Panel-Export ────────────────────────────────────────────

export const exportRack2DAsPng = async (
  rackCanvasEl: HTMLElement,
  rackName: string,
): Promise<void> => {
  // 2× Pixel-Ratio für Retina-Qualität.
  const dataUri = await toPng(rackCanvasEl, {
    pixelRatio: 2,
    backgroundColor: '#0f172a',
    cacheBust: true,
  })
  // dataUri → Blob
  const res = await fetch(dataUri)
  const blob = await res.blob()
  // v7.9.116 — Einheitlicher Stempel.
  downloadFile(buildExportFilenameWithSuffix(rackName, 'rack_2D', 'png'), blob)
}

// ── 2) 3D Rack-Canvas-Export aus mehreren Perspektiven ─────────────────

export type Rack3DPerspective = 'front' | 'rear' | 'iso' | 'top'

export interface Rack3DExportOpts {
  rackName: string
  /** Welt-Dimensionen, damit wir die Kamera entsprechend positionieren können. */
  rackWidthMm: number
  rackHeightMm: number
  rackDepthMm: number
  /** Welche Perspektiven exportieren. Default = alle 4. */
  perspectives?: Rack3DPerspective[]
}

/**
 * Render-Helper: nimmt einen vorhandenen WebGL-Canvas der r3f-Szene,
 * bewegt die Kamera kurz auf die gewünschte Perspektive, rendert ein
 * Frame und downloaded das Bild.
 *
 * Wir nutzen REAL die scene/camera des r3f-Trees — übergeben werden müssen
 * sie vom Caller. Der "Snapshot"-Mechanismus dokumentiert sich im Rack-
 * Dialog (Caller hält camera+scene+gl Refs via useThree).
 */
export const exportRack3DPerspective = async (
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  perspective: Rack3DPerspective,
  opts: { rackWidthMm: number; rackHeightMm: number; rackDepthMm: number },
): Promise<Blob> => {
  // Originale Kamera-Position merken damit wir sie nach dem Snapshot
  // wieder herstellen können (sonst springt die User-Sicht).
  const origPos = camera.position.clone()
  const origQuat = camera.quaternion.clone()

  // #export — Kamera so weit zurücksetzen, dass das KOMPLETTE Rack ins Bild
  // passt. Vorher standen feste Vielfache der Tiefe (z.B. depth*1.5) ohne
  // Bezug zur Rack-Höhe/-Breite oder zum Canvas-FOV → hohe Racks wurden
  // oben/unten abgeschnitten. Jetzt fitten wir die Bounding-Sphere des Racks
  // an das limitierende FOV (vertikal ODER horizontal, je nach Canvas-Seiten-
  // verhältnis), plus etwas Rand — so ist das Rack aus jeder Perspektive
  // vollständig sichtbar.
  const center = new THREE.Vector3(
    opts.rackWidthMm / 2,
    opts.rackHeightMm / 2,
    opts.rackDepthMm / 2,
  )
  const radius = 0.5 * Math.hypot(opts.rackWidthMm, opts.rackHeightMm, opts.rackDepthMm)
  const aspect = camera.aspect || gl.domElement.width / Math.max(1, gl.domElement.height)
  const vHalf = (camera.fov * Math.PI) / 360 // halbes vertikales FOV in rad
  const hHalf = Math.atan(Math.tan(vHalf) * aspect) // halbes horizontales FOV
  const fitDist = (radius / Math.sin(Math.min(vHalf, hHalf))) * 1.08 // +8 % Rand

  const origUp = camera.up.clone()
  const origNear = camera.near
  const origFar = camera.far

  const dir = new THREE.Vector3()
  switch (perspective) {
    case 'front':
      dir.set(0, 0, -1)
      break
    case 'rear':
      dir.set(0, 0, 1)
      break
    case 'top':
      dir.set(0, 1, 0)
      camera.up.set(0, 0, -1) // Blickrichtung sonst parallel zu up → degeneriert
      break
    case 'iso':
    default:
      dir.set(1, 0.6, -1).normalize()
      break
  }
  camera.position.copy(center).addScaledVector(dir, fitDist)
  camera.near = Math.max(1, fitDist - radius * 2)
  camera.far = fitDist + radius * 2 + 1000
  camera.lookAt(center)
  camera.updateProjectionMatrix()

  // Render und canvas.toBlob() — wir warten einen Frame damit r3f das
  // neue Camera-State auch wirklich rendert.
  gl.render(scene, camera)
  await new Promise((r) => requestAnimationFrame(r))
  gl.render(scene, camera)

  const blob = await new Promise<Blob | null>((resolve) =>
    gl.domElement.toBlob(resolve, 'image/png'),
  )

  // Kamera zurück (inkl. up/near/far, die wir oben angepasst haben).
  camera.position.copy(origPos)
  camera.quaternion.copy(origQuat)
  camera.up.copy(origUp)
  camera.near = origNear
  camera.far = origFar
  camera.updateProjectionMatrix()
  gl.render(scene, camera)

  if (!blob) throw new Error('Canvas-Capture lieferte kein Bild')
  return blob
}

export const exportRack3DAsPngs = async (
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  opts: Rack3DExportOpts,
): Promise<void> => {
  const perspectives = opts.perspectives ?? ['front', 'rear', 'iso', 'top']
  for (const p of perspectives) {
    const blob = await exportRack3DPerspective(gl, scene, camera, p, opts)
    // v7.9.116 — Einheitlicher Stempel.
    downloadFile(buildExportFilenameWithSuffix(opts.rackName, `rack_3D_${p}`, 'png'), blob)
    // kurze Pause damit der Browser den nächsten Download nicht blockt.
    await new Promise((r) => setTimeout(r, 200))
  }
}

// ── 3) 3D-STL-Export (gesamtes Rack als eine Mesh-Datei) ───────────────

export const exportRackAsStl = (
  scene: THREE.Scene,
  rackName: string,
): void => {
  const exporter = new STLExporter()
  // binary=true → kompakter (binär-STL), false → ASCII-STL.
  // Binary ist Industrie-Standard für 3D-Druck und kleinere Dateigröße.
  const result = exporter.parse(scene, { binary: true })
  const blob = result instanceof DataView
    ? new Blob([result.buffer as ArrayBuffer], { type: 'application/octet-stream' })
    : new Blob([result], { type: 'model/stl' })
  // v7.9.116 — Einheitlicher Stempel.
  downloadFile(buildExportFilenameWithSuffix(rackName, 'rack', 'stl'), blob)
}

// ── 4) .cpgroup Download mit allen inline-Assets ───────────────────────
// (Delegiert an exportPresetToFile, das schon die korrekte File-V1
//  Wrapper-Struktur baut — damit das exportierte File auf einem anderen
//  Rechner via parseLibraryItemFile wieder importiert werden kann.)
export { exportPresetToFile as exportRackAsCpgroup } from './itemExport'
